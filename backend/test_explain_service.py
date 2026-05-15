import os
import unittest

os.environ.setdefault("SECRET_KEY", "test-secret")

from fastapi import HTTPException
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select

from app.models.explanation import ExplainTermRequest, ExplainUsage, ExplanationCache
from app.models.user import User
from app.services.explain import explain_term
from app.services.llm_providers import LLMExplanation


class FakeProvider:
    provider_name = "fake"
    model = "fake-model"

    def __init__(self):
        self.calls = 0

    def explain(self, *, selected_text: str, context: str, language: str) -> LLMExplanation:
        self.calls += 1
        return LLMExplanation(
            meaning=f"meaning-{self.calls}",
            explanation=f"explanation-{self.calls}",
            example=f"example-{self.calls}",
            confidence="high",
        )


class ExplainServiceTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)
        self.user = User(username="alice", email="alice@example.com", hashed_password="hash")
        self.session.add(self.user)
        self.session.commit()
        self.session.refresh(self.user)

    def tearDown(self):
        self.session.close()

    def request(self, renew: bool = False) -> ExplainTermRequest:
        return ExplainTermRequest(
            selected_text="event loop",
            context_before="JavaScript async notes.",
            paragraph="The event loop schedules callbacks after the call stack is clear.",
            context_after="Promises run microtasks before timers.",
            document_title="async.md",
            local_file_id="file-1",
            language="vi",
            renew=renew,
        )

    def usage_count(self) -> int:
        usage = self.session.exec(select(ExplainUsage).where(ExplainUsage.user_id == self.user.id)).first()
        return usage.count if usage else 0

    def test_first_call_creates_cache_and_usage(self):
        provider = FakeProvider()
        result = explain_term(session=self.session, current_user=self.user, req=self.request(), provider=provider, limit=20)

        self.assertFalse(result.cached)
        self.assertEqual(result.meaning, "meaning-1")
        self.assertEqual(result.daily_remaining, 19)
        self.assertEqual(provider.calls, 1)
        self.assertEqual(self.usage_count(), 1)
        cache = self.session.exec(select(ExplanationCache)).first()
        self.assertIsNotNone(cache)

    def test_cache_hit_does_not_call_provider_or_increment_usage(self):
        first_provider = FakeProvider()
        explain_term(session=self.session, current_user=self.user, req=self.request(), provider=first_provider, limit=20)

        second_provider = FakeProvider()
        result = explain_term(session=self.session, current_user=self.user, req=self.request(), provider=second_provider, limit=20)

        self.assertTrue(result.cached)
        self.assertEqual(result.meaning, "meaning-1")
        self.assertEqual(second_provider.calls, 0)
        self.assertEqual(self.usage_count(), 1)
        self.assertEqual(result.daily_remaining, 19)

    def test_renew_bypasses_cache_and_counts_again(self):
        provider = FakeProvider()
        explain_term(session=self.session, current_user=self.user, req=self.request(), provider=provider, limit=20)
        renewed = explain_term(session=self.session, current_user=self.user, req=self.request(renew=True), provider=provider, limit=20)

        self.assertFalse(renewed.cached)
        self.assertEqual(renewed.meaning, "meaning-2")
        self.assertEqual(provider.calls, 2)
        self.assertEqual(self.usage_count(), 2)
        cache = self.session.exec(select(ExplanationCache)).first()
        self.assertEqual(cache.meaning, "meaning-2")

    def test_limit_blocks_renew_before_provider_call(self):
        provider = FakeProvider()
        explain_term(session=self.session, current_user=self.user, req=self.request(), provider=provider, limit=1)

        cached = explain_term(session=self.session, current_user=self.user, req=self.request(), provider=provider, limit=1)
        self.assertTrue(cached.cached)
        self.assertEqual(provider.calls, 1)

        with self.assertRaises(HTTPException) as ctx:
            explain_term(session=self.session, current_user=self.user, req=self.request(renew=True), provider=provider, limit=1)

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertEqual(provider.calls, 1)
        self.assertEqual(self.usage_count(), 1)


if __name__ == "__main__":
    unittest.main()
