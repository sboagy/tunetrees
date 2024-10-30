from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum

from tunetrees.models.tunetrees import PrefsSpacedRepetition
from tunetrees.app.database import (
    SessionLocal,
)  # Import SessionLocal from your database module

# Existing preferences_router
preferences_router = APIRouter(prefix="/preferences", tags=["preferences"])


# Enum for algorithm types (modify as per your actual algorithms)
class AlgorithmType(str, Enum):
    SM2 = "SM2"
    FSRS = "FSRS"
    # Add other algorithms if applicable


# Pydantic models matching ORM definitions
class PrefsSpacedRepetitionBase(BaseModel):
    user_id: int
    algorithm: AlgorithmType
    # Add other fields from your ORM definition if needed


class PrefsSpacedRepetitionCreate(PrefsSpacedRepetitionBase):
    pass  # Inherit all fields from PrefsSpacedRepetitionBase


class PrefsSpacedRepetitionUpdate(BaseModel):
    algorithm: Optional[AlgorithmType] = None
    # Add other optional fields for updating if needed


class PrefsSpacedRepetitionResponse(PrefsSpacedRepetitionBase):
    id: int  # Include the ID in the response

    class Config:
        orm_mode = True  # Enable ORM mode for automatic data conversion


@preferences_router.get(
    "/prefs_spaced_repetition",
    response_model=List[PrefsSpacedRepetitionResponse],
    summary="Get all spaced repetition preferences",
    description="Retrieve all spaced repetition preferences from the database.",
    status_code=status.HTTP_200_OK,
)
def get_prefs_spaced_repetition():
    with SessionLocal() as db:
        preferences = db.query(PrefsSpacedRepetition).all()
        return preferences


@preferences_router.post(
    "/prefs_spaced_repetition",
    response_model=PrefsSpacedRepetitionResponse,
    summary="Create a new spaced repetition preference",
    description="Create a new spaced repetition preference in the database.",
    status_code=status.HTTP_201_CREATED,
)
def create_prefs_spaced_repetition(prefs: PrefsSpacedRepetitionCreate):
    with SessionLocal() as db:
        db_prefs = PrefsSpacedRepetition(**prefs.model_dump())
        db.add(db_prefs)
        db.commit()
        db.refresh(db_prefs)
        return db_prefs


@preferences_router.put(
    "/prefs_spaced_repetition/{prefs_id}",
    response_model=PrefsSpacedRepetitionResponse,
    summary="Update a spaced repetition preference",
    description="Update an existing spaced repetition preference in the database.",
    status_code=status.HTTP_200_OK,
)
def update_prefs_spaced_repetition(prefs_id: int, prefs: PrefsSpacedRepetitionUpdate):
    with SessionLocal() as db:
        db_prefs = (
            db.query(PrefsSpacedRepetition)
            .filter(PrefsSpacedRepetition.id == prefs_id)
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
    "/prefs_spaced_repetition/{prefs_id}",
    summary="Delete a spaced repetition preference",
    description="Delete an existing spaced repetition preference from the database.",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_prefs_spaced_repetition(prefs_id: int):
    with SessionLocal() as db:
        db_prefs = (
            db.query(PrefsSpacedRepetition)
            .filter(PrefsSpacedRepetition.id == prefs_id)
            .first()
        )
        if not db_prefs:
            raise HTTPException(status_code=404, detail="Preference not found")
        db.delete(db_prefs)
        db.commit()
    return None  # No content to return for status code 204
