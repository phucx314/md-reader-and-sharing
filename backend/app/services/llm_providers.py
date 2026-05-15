import json
from dataclasses import dataclass
from typing import Any, Dict, Protocol
from urllib import request, error

from app.config import (
    ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL,
    ANTHROPIC_MODEL,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    LLM_PROVIDER,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_MODEL,
)


@dataclass
class LLMExplanation:
    meaning: str
    explanation: str
    example: str | None = None
    confidence: str | None = None


class ExplainProvider(Protocol):
    provider_name: str
    model: str

    def explain(self, *, selected_text: str, context: str, language: str) -> LLMExplanation:
        ...


def _post_json(url: str, headers: Dict[str, str], payload: Dict[str, Any]) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers=headers, method="POST")
    try:
        with request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"LLM provider request failed: {exc.code} {body}") from exc


def _join_url(base: str, suffix: str) -> str:
    return f"{base.rstrip('/')}/{suffix.lstrip('/')}"


def _parse_json_object(text: str) -> Dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if stripped.lower().startswith("json"):
            stripped = stripped[4:].strip()
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end >= start:
        stripped = stripped[start : end + 1]
    parsed = json.loads(stripped)
    if not isinstance(parsed, dict):
        raise ValueError("LLM response is not a JSON object")
    return parsed


def _result_from_text(text: str) -> LLMExplanation:
    data = _parse_json_object(text)
    return LLMExplanation(
        meaning=str(data.get("meaning", "")).strip(),
        explanation=str(data.get("explanation", "")).strip(),
        example=(str(data["example"]).strip() if data.get("example") else None),
        confidence=(str(data["confidence"]).strip() if data.get("confidence") else None),
    )


def build_prompt(*, selected_text: str, context: str, language: str) -> str:
    target_language = "Vietnamese" if language.lower().startswith("vi") else language
    return f"""You explain selected terms in markdown notes.

Selected term:
{selected_text}

Context:
{context}

Rules:
- Explain in {target_language}.
- Focus on the meaning in this context.
- Do not give every possible dictionary meaning.
- If context is insufficient, say so.
- Be concise.
- Return JSON only with these fields: meaning, explanation, example, confidence.
"""


class OpenAIExplainProvider:
    provider_name = "openai"

    def __init__(
        self,
        api_key: str = OPENAI_API_KEY,
        model: str = OPENAI_MODEL,
        base_url: str = OPENAI_BASE_URL,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    def explain(self, *, selected_text: str, context: str, language: str) -> LLMExplanation:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY or LLM_API_KEY is not configured")
        payload = {
            "model": self.model,
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "You return concise JSON explanations."},
                {"role": "user", "content": build_prompt(selected_text=selected_text, context=context, language=language)},
            ],
        }
        data = _post_json(
            _join_url(self.base_url, "/chat/completions"),
            {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            payload,
        )
        text = data["choices"][0]["message"]["content"]
        return _result_from_text(text)


class AnthropicExplainProvider:
    provider_name = "anthropic"

    def __init__(
        self,
        api_key: str = ANTHROPIC_API_KEY,
        model: str = ANTHROPIC_MODEL,
        base_url: str = ANTHROPIC_BASE_URL,
    ):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url

    def explain(self, *, selected_text: str, context: str, language: str) -> LLMExplanation:
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not configured")
        payload = {
            "model": self.model,
            "max_tokens": 500,
            "temperature": 0.2,
            "messages": [
                {"role": "user", "content": build_prompt(selected_text=selected_text, context=context, language=language)}
            ],
        }
        data = _post_json(
            _join_url(self.base_url, "/v1/messages"),
            {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            payload,
        )
        text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
        return _result_from_text(text)


class GeminiExplainProvider:
    provider_name = "gemini"

    def __init__(self, api_key: str = GEMINI_API_KEY, model: str = GEMINI_MODEL):
        self.api_key = api_key
        self.model = model

    def explain(self, *, selected_text: str, context: str, language: str) -> LLMExplanation:
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        payload = {
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": build_prompt(selected_text=selected_text, context=context, language=language)}],
                }
            ],
        }
        data = _post_json(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}",
            {"Content-Type": "application/json"},
            payload,
        )
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return _result_from_text(text)


def get_explain_provider() -> ExplainProvider:
    provider = LLM_PROVIDER.lower()
    if provider == "anthropic":
        return AnthropicExplainProvider()
    if provider == "gemini":
        return GeminiExplainProvider()
    return OpenAIExplainProvider()
