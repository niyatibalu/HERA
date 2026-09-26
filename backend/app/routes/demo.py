from fastapi import APIRouter

from app.data.store import store

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/reset")
def reset_demo():
    """Restore the seeded demo state (journeys, consent, preferences, symptom log, MyChart).

    For rehearsing a deployed demo without restarting the server. All data is synthetic,
    so this is safe to expose for the hackathon; remove it before any real deployment.
    """
    store.reset()
    return {"status": "reset"}
