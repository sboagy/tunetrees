from fastapi import APIRouter, HTTPException, Query, status

from tunetrees.app.database import (
    SessionLocal,
)
from tunetrees.models.tunetrees import PrefsSpacedRepetition
from tunetrees.models.tunetrees_pydantic import (
    PrefsSpacedRepetitionModel,
    PrefsSpacedRepetitionModelPartial,
)  # Import SessionLocal from your database module

# Existing preferences_router
preferences_router = APIRouter(prefix="/preferences", tags=["preferences"])


@preferences_router.get(
    "/prefs_spaced_repetition",
    response_model=PrefsSpacedRepetitionModel,
    summary="Get a spaced repetition preference",
    description="Retrieve a specific spaced repetition preference using alg_type and user_id.",
    status_code=status.HTTP_200_OK,
)
def get_prefs_spaced_repetition(
    alg_type: str = Query(..., description="The algorithm type (e.g., SM2, FSRS)"),
    user_id: int = Query(..., description="The user ID"),
):
    with SessionLocal() as db:
        preference = (
            db.query(PrefsSpacedRepetition)
            .filter(
                PrefsSpacedRepetition.alg_type == alg_type,
                PrefsSpacedRepetition.user_id == user_id,
            )
            .first()
        )
        if not preference:
            raise HTTPException(status_code=404, detail="Preference not found")
        return preference


@preferences_router.post(
    "/prefs_spaced_repetition",
    response_model=PrefsSpacedRepetitionModel,
    summary="Create a new spaced repetition preference",
    description="Create a new spaced repetition preference in the database.",
    status_code=status.HTTP_201_CREATED,
)
def create_prefs_spaced_repetition(prefs: PrefsSpacedRepetitionModelPartial):
    with SessionLocal() as db:
        db_prefs = PrefsSpacedRepetition(**prefs.model_dump())
        db.add(db_prefs)
        db.commit()
        db.refresh(db_prefs)
        return db_prefs


@preferences_router.put(
    "/prefs_spaced_repetition",
    response_model=PrefsSpacedRepetitionModel,
    summary="Update a spaced repetition preference",
    description="Update an existing spaced repetition preference using alg_type and user_id.",
    status_code=status.HTTP_200_OK,
)
def update_prefs_spaced_repetition(
    alg_type: str = Query(..., description="The algorithm type (e.g., SM2, FSRS)"),
    user_id: int = Query(..., description="The user ID"),
    prefs: PrefsSpacedRepetitionModelPartial = Query(...),
):
    with SessionLocal() as db:
        db_prefs = (
            db.query(PrefsSpacedRepetition)
            .filter(
                PrefsSpacedRepetition.alg_type == alg_type,
                PrefsSpacedRepetition.user_id == user_id,
            )
            .first()
        )
        if not db_prefs:
            raise HTTPException(status_code=404, detail="Preference not found")
        for key, value in prefs.model_dump(exclude_unset=True).items():
            setattr(db_prefs, key, value)
        db.commit()
        db.refresh(db_prefs)
        return db_prefs


@preferences_router.delete(
    "/prefs_spaced_repetition",
    summary="Delete a spaced repetition preference",
    description="Delete an existing spaced repetition preference using alg_type and user_id.",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_prefs_spaced_repetition(
    alg_type: str = Query(..., description="The algorithm type (e.g., SM2, FSRS)"),
    user_id: int = Query(..., description="The user ID"),
):
    with SessionLocal() as db:
        db_prefs = (
            db.query(PrefsSpacedRepetition)
            .filter(
                PrefsSpacedRepetition.alg_type == alg_type,
                PrefsSpacedRepetition.user_id == user_id,
            )
            .first()
        )
        if not db_prefs:
            raise HTTPException(status_code=404, detail="Preference not found")
        db.delete(db_prefs)
        db.commit()
    return None  # No content to return for status code 204
