from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.database import get_session
from app.models import Provider, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("/")
def list_providers(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all active providers (used in dropdowns, care team, etc.)"""
    providers = session.exec(
        select(Provider, User)
        .join(User, Provider.user_id == User.id)
        .where(Provider.is_active == True)
        .order_by(Provider.display_name)
    ).all()

    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "display_name": p.display_name,
            "specialty": p.specialty,
            "email": u.email,
        }
        for p, u in providers
    ]


@router.get("/me")
def get_my_provider_profile(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get the provider profile for the logged-in user (if they are a provider)."""
    provider = session.exec(
        select(Provider).where(Provider.user_id == current_user.id)
    ).first()
    if not provider:
        return {"provider": None}

    return {
        "id": provider.id,
        "user_id": provider.user_id,
        "display_name": provider.display_name,
        "specialty": provider.specialty,
    }
