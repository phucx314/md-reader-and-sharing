from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.database import get_session
from app.models.explanation import ExplainTermRequest, ExplainTermResponse
from app.models.user import User
from app.routers.auth import get_current_user
from app.services.explain import explain_term
from app.services.llm_providers import get_explain_provider

router = APIRouter(prefix="/api/explain-term", tags=["explain"])


@router.post("", response_model=ExplainTermResponse)
def explain_selected_term(
    body: ExplainTermRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        provider = get_explain_provider()
        return explain_term(session=session, current_user=current_user, req=body, provider=provider)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate explanation: {exc}",
        ) from exc
