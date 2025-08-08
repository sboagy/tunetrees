from fastapi import APIRouter, HTTPException, Query, status
from typing import Dict, Any, List
from pydantic import BaseModel

from tunetrees.app.database import (
    SessionLocal,
)
from tunetrees.app.schedule import (
    optimize_fsrs_parameters,
    create_tuned_scheduler,
    get_user_review_history,
)
from tunetrees.models.tunetrees import (
    PrefsSpacedRepetition,
    PrefsSchedulingOptions,
    User,
)
from tunetrees.models.tunetrees_pydantic import (
    PrefsSpacedRepetitionModel,
    PrefsSpacedRepetitionModelPartial,
    AlgorithmType,
    PrefsSchedulingOptionsModel,
    PrefsSchedulingOptionsModelPartial,
)  # Import SessionLocal from your database module


# Response models for FSRS endpoints
class ISchedulerConfig(BaseModel):
    parameters: List[float]
    desired_retention: float
    maximum_interval: int
    enable_fuzzing: bool


class IOptimizationResponse(BaseModel):
    message: str
    user_id: int
    algorithm: AlgorithmType
    review_count: int
    loss: float
    optimized_parameters: List[float]
    scheduler_config: Dict[str, Any]


class ISchedulerResponse(BaseModel):
    message: str
    user_id: int
    algorithm: AlgorithmType
    scheduler_config: ISchedulerConfig


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


# New endpoints: prefs_scheduling_options CRUD with mirroring
@preferences_router.get(
    "/prefs_scheduling_options",
    response_model=PrefsSchedulingOptionsModel,
    summary="Get scheduling options",
    description="Retrieve scheduling options for a user.",
    status_code=status.HTTP_200_OK,
)
def get_prefs_scheduling_options(
    user_id: int = Query(..., description="The user ID"),
):
    with SessionLocal() as db:
        prefs = db.get(PrefsSchedulingOptions, user_id)
        if not prefs:
            raise HTTPException(status_code=404, detail="Scheduling options not found")
        return prefs


@preferences_router.post(
    "/prefs_scheduling_options",
    response_model=PrefsSchedulingOptionsModel,
    summary="Create scheduling options",
    description="Create scheduling options for a user.",
    status_code=status.HTTP_201_CREATED,
)
def create_prefs_scheduling_options(prefs: PrefsSchedulingOptionsModel):
    with SessionLocal() as db:
        # Ensure user exists
        user = db.get(User, prefs.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Create
        db_prefs = PrefsSchedulingOptions(**prefs.model_dump())
        db.add(db_prefs)
        # Mirror acceptable_delinquency_window to user
        if prefs.acceptable_delinquency_window is not None:
            user.acceptable_delinquency_window = prefs.acceptable_delinquency_window
        db.commit()
        db.refresh(db_prefs)
        return db_prefs


@preferences_router.put(
    "/prefs_scheduling_options",
    response_model=PrefsSchedulingOptionsModel,
    summary="Update scheduling options",
    description="Update existing scheduling options for a user.",
    status_code=status.HTTP_200_OK,
)
def update_prefs_scheduling_options(
    user_id: int = Query(..., description="The user ID"),
    prefs: PrefsSchedulingOptionsModelPartial = Query(...),
):
    with SessionLocal() as db:
        db_prefs = db.get(PrefsSchedulingOptions, user_id)
        if not db_prefs:
            raise HTTPException(status_code=404, detail="Scheduling options not found")
        # Apply updates
        updates = prefs.model_dump(exclude_unset=True)
        for key, value in updates.items():
            setattr(db_prefs, key, value)

        # Mirror acceptable_delinquency_window to user if present
        if (
            "acceptable_delinquency_window" in updates
            and updates["acceptable_delinquency_window"] is not None
        ):
            user = db.get(User, user_id)
            if user:
                user.acceptable_delinquency_window = updates[
                    "acceptable_delinquency_window"
                ]

        db.commit()
        db.refresh(db_prefs)
        return db_prefs


@preferences_router.post(
    "/optimize_fsrs",
    response_model=IOptimizationResponse,
    summary="Optimize FSRS parameters",
    description="Optimize the FSRS parameters based on user review history.",
    status_code=status.HTTP_200_OK,
)
def optimize_fsrs(
    user_id: int = Query(..., description="The user ID"),
    alg_type: AlgorithmType = Query(
        AlgorithmType.FSRS, description="The algorithm type (e.g., SM2, FSRS)"
    ),
    force_optimization: bool = Query(
        False, description="Force re-optimization even if preferences exist"
    ),
) -> IOptimizationResponse:
    with SessionLocal() as db:
        try:
            # Get user review history for validation
            review_history = get_user_review_history(db, str(user_id))

            if len(review_history) < 10:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient review history: {len(review_history)} records. Need at least 10.",
                )

            # Optimize FSRS parameters
            optimized_params, loss = optimize_fsrs_parameters(
                db, str(user_id), alg_type
            )

            # Create and save tuned scheduler which handles the preference creation/update
            scheduler = create_tuned_scheduler(
                db, str(user_id), alg_type, force_optimization=force_optimization
            )

            return IOptimizationResponse(
                message="FSRS optimization completed successfully",
                user_id=user_id,
                algorithm=alg_type,
                review_count=len(review_history),
                loss=loss,
                optimized_parameters=list(optimized_params),
                scheduler_config={
                    "desired_retention": scheduler.desired_retention,
                    "maximum_interval": scheduler.maximum_interval,
                    "enable_fuzzing": scheduler.enable_fuzzing,
                },
            )

        except HTTPException:
            # Re-raise HTTPException as-is
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error during FSRS optimization: {str(e)}"
            )


@preferences_router.post(
    "/create_tuned_scheduler",
    response_model=ISchedulerResponse,
    summary="Create a tuned scheduler",
    description="Create a tuned scheduler based on user preferences.",
    status_code=status.HTTP_200_OK,
)
def create_tuned_scheduler_endpoint(
    user_id: int = Query(..., description="The user ID"),
    alg_type: AlgorithmType = Query(
        AlgorithmType.FSRS, description="The algorithm type (e.g., SM2, FSRS)"
    ),
    force_optimization: bool = Query(False, description="Force re-optimization"),
) -> ISchedulerResponse:
    with SessionLocal() as db:
        try:
            # Create the tuned scheduler - this will handle optimization if needed
            scheduler = create_tuned_scheduler(
                db, str(user_id), alg_type, force_optimization=force_optimization
            )

            return ISchedulerResponse(
                message="Tuned scheduler created successfully",
                user_id=user_id,
                algorithm=alg_type,
                scheduler_config=ISchedulerConfig(
                    parameters=list(scheduler.parameters),
                    desired_retention=scheduler.desired_retention,
                    maximum_interval=scheduler.maximum_interval,
                    enable_fuzzing=scheduler.enable_fuzzing,
                ),
            )

        except HTTPException:
            # Re-raise HTTPException as-is
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error creating tuned scheduler: {str(e)}"
            )
