import json
import logging
import time
import urllib.parse
from datetime import datetime, timezone
from os import environ
from typing import Any, Dict, List, Optional

import pydantic
from fastapi import (
    APIRouter,
    Body,
    HTTPException,
    Path,
    Query,
)
from sqlalchemy import ColumnElement, Table, and_, delete, func, insert
from sqlalchemy.future import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.query import Query as QueryOrm
from starlette import status as status

from tunetrees.app.database import SessionLocal
from tunetrees.app.queries import (
    query_practice_list_scheduled,
)
from tunetrees.app.schedule import (
    TuneFeedbackUpdate,
    TuneScheduleUpdate,
    update_practice_feedbacks,
    update_practice_schedules,
)
from tunetrees.models.tunetrees import (
    Genre,
    Instrument,
    Note,
    Playlist,
    PlaylistTune,
    PracticeRecord,
    Reference,
    Tune,
    TuneOverride,
    TuneType,
    t_genre_tune_type,
    t_practice_list_joined,
    t_practice_list_staged,
    t_view_playlist_joined,
)
from tunetrees.models.tunetrees_pydantic import (
    ColumnSort,
    GenreModel,
    GenreModelCreate,
    GenreModelPartial,
    GenreTuneTypeModel,
    GenreTuneTypeModelPartial,
    InstrumentModel,
    InstrumentModelPartial,
    NoteModel,
    NoteModelCreate,
    NoteModelPartial,
    PlaylistModel,
    PlaylistModelPartial,
    PlaylistTuneJoinedModel,
    PlaylistTuneModel,
    PlaylistTuneModelPartial,
    PracticeListStagedModel,
    PracticeRecordModel,
    PracticeRecordModelPartial,
    ReferenceModel,
    ReferenceModelCreate,
    ReferenceModelPartial,
    ResponseStatusModel,
    TuneModel,
    TuneModelCreate,
    TuneModelPartial,
    TuneOverrideModel,
    TuneOverrideModelPartial,
    TuneTypeModel,
    TuneTypeModelPartial,
    ViewPlaylistJoinedModel,
)

logger = logging.getLogger("tunetrees.api")

logger.debug("logger(tunetrees.api)(test debug message)")

router = APIRouter(
    prefix="/tunetrees",
    tags=["tunetrees"],
)

DEBUG_SLOWDOWN = int(environ.get("DEBUG_SLOWDOWN", 0))


@router.get(
    "/scheduled_tunes_overview/{user_id}/{playlist_ref}",
    response_model=List[PlaylistTuneJoinedModel],
    summary="Get Scheduled Tunes Overview",
    description=(
        "Retrieve an overview of scheduled tunes for a specific user and playlist. "
        "Returns a list of scheduled tunes, including their joined playlist information, "
        "for the given user and playlist reference. Supports filtering for deleted tunes and playlists, "
        "and requires a review sitdown date to determine scheduling. The acceptable delinquency window "
        "can be customized to adjust which tunes are considered delinquent."
    ),
)
async def get_scheduled_tunes_overview(
    user_id: int = Path(..., description="User identifier"),
    playlist_ref: int = Path(..., description="Playlist reference identifier"),
    show_deleted: bool = Query(False, description="Include deleted tunes"),
    show_playlist_deleted: bool = Query(
        False, description="Include tunes from deleted playlists"
    ),
    sitdown_date: datetime = Query(
        ..., description="Review sitdown date (timezone-aware, UTC recommended)"
    ),
    acceptable_delinquency_window: Optional[int] = Query(
        None, description="Acceptable delinquency window in days"
    ),
) -> List[PlaylistTuneJoinedModel]:
    """
    Retrieve an overview of scheduled tunes for a specific user and playlist.

    Returns a list of scheduled tunes, including their joined playlist information,
    for the given user and playlist reference. Supports filtering for deleted tunes and playlists,
    and requires a review sitdown date to determine scheduling. The acceptable delinquency window
    can be customized to adjust which tunes are considered delinquent.
    """
    try:
        # FSRS requires dates to be timezoned, so ensure sitdown_date has a UTC timezone.
        if sitdown_date.tzinfo is None:
            sitdown_date = sitdown_date.replace(tzinfo=timezone.utc)
        with SessionLocal() as db:
            if DEBUG_SLOWDOWN > 0:
                time.sleep(DEBUG_SLOWDOWN)
            tunes_scheduled = query_practice_list_scheduled(
                db,
                limit=10,
                user_ref=user_id,
                playlist_ref=playlist_ref,
                show_deleted=show_deleted,
                show_playlist_deleted=show_playlist_deleted,
                review_sitdown_date=sitdown_date,
                acceptable_delinquency_window=acceptable_delinquency_window,
            )
            validated_tune_list = [
                PlaylistTuneJoinedModel.model_validate(tune) for tune in tunes_scheduled
            ]
            return validated_tune_list
    except Exception as e:
        logger.error(f"Unable to fetch scheduled practice list: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500, detail=f"Unable to fetch scheduled practice list: {e}"
        )


@router.get(
    "/repertoire_tunes_overview/{user_id}/{playlist_ref}",
    response_model=List[PracticeListStagedModel],
    description="Retrieve an overview of repertoire tunes for a user and playlist with optional filters and pagination.",
)
async def get_repertoire_tunes_overview(
    user_id: int,
    playlist_ref: int,
    show_deleted: bool = Query(False),
    show_playlist_deleted: bool = Query(False),
    sorting: Optional[str] = Query(None),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        100, ge=1, le=100000, description="Maximum number of records to return"
    ),
) -> List[PracticeListStagedModel]:
    try:
        with SessionLocal() as db:
            if DEBUG_SLOWDOWN > 0:
                time.sleep(DEBUG_SLOWDOWN)
            filters = [
                t_practice_list_staged.c.user_ref == user_id,
                t_practice_list_staged.c.playlist_id == playlist_ref,
            ]
            if not show_deleted:
                filters.append(t_practice_list_staged.c.deleted.is_(False))
            if not show_playlist_deleted:
                filters.append(t_practice_list_staged.c.playlist_deleted.is_(False))

            query = build_query(
                db,
                filters,
                sorting,
            )
            tunes_recently_played = query.offset(skip).limit(limit).all()
            return tunes_recently_played
    except Exception as e:
        logger.error(f"Unable to fetch recently played tunes: {e}")
        raise HTTPException(
            status_code=500, detail=f"Unable to fetch recently played tunes: {e}"
        )


def build_query(
    db: Session, filters: List[ColumnElement[bool]], sorting: Optional[str]
) -> QueryOrm[Any]:
    query = db.query(t_practice_list_staged).filter(and_(*filters))
    if sorting:
        try:
            unencoded_sorting = urllib.parse.unquote(sorting)
            sortingLoaded = json.loads(unencoded_sorting)
            column_sorts: List[ColumnSort] = pydantic.TypeAdapter(
                List[ColumnSort]
            ).validate_python(sortingLoaded)
        except (json.JSONDecodeError, pydantic.ValidationError) as e:
            raise HTTPException(
                status_code=400,
                detail=f"Unable to fetch recently played tunes: Invalid sorting parameter: {e}",
            )
        for sort_spec in column_sorts:
            column = getattr(t_practice_list_staged.c, sort_spec.id, None)
            if column is not None:
                query = query.order_by(
                    column.desc() if sort_spec.desc else column.asc()
                )
    return query


@router.get(
    "/get_tune_staged/{user_id}/{playlist_ref}/{tune_id}",
    response_model=PracticeListStagedModel | None,
    description="Retrieve a repertoire tune for a user and playlist.",
)
async def get_tune_staged(
    user_id: str, playlist_ref: str, tune_id: str
) -> PracticeListStagedModel | None:
    try:
        with SessionLocal() as db:
            query = db.query(t_practice_list_staged).filter(
                and_(
                    t_practice_list_staged.c.id == tune_id,
                    t_practice_list_staged.c.user_ref == user_id,
                    t_practice_list_staged.c.playlist_id == playlist_ref,
                )
            )

            tune = query.first()
            return tune
    except Exception as e:
        logger.error(f"Unable to fetch tune: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch tune: {e}")


# DEADCODE: Dead code?
@router.post("/practice/submit_schedules/{playlist_id}")
async def submit_schedules(
    playlist_id: str,
    tune_updates: Dict[str, TuneScheduleUpdate],
):
    logger.debug(f"{tune_updates=}")

    update_practice_schedules(tune_updates, playlist_id)

    return status.HTTP_302_FOUND


@router.post("/practice/submit_feedbacks/{playlist_id}")
async def submit_feedbacks(
    playlist_id: str,
    tune_updates: Dict[str, TuneFeedbackUpdate],
    sitdown_date: datetime = Query(...),
):
    try:
        logger.debug(f"{tune_updates=}")

        # FSRS requires dates to be timezoned, so ensure sitdown_date has a UTC timezone.
        if sitdown_date.tzinfo is None:
            sitdown_date = sitdown_date.replace(tzinfo=timezone.utc)

        update_practice_feedbacks(
            tune_updates,
            playlist_id,
            review_sitdown_date=sitdown_date,
        )

        return status.HTTP_302_FOUND
    except Exception as e:
        logger.error(f"Error in submit_feedbacks: {e}")
        # Return a proper HTTP error instead of letting it bubble up as a 500
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def update_table(
    db: Session,
    table: Table,
    conditions: List[ColumnElement[bool]],
    values: dict[str, Any],
):
    stmt = table.update().where(*conditions).values(**values)
    db.execute(stmt)


@router.get(
    "/playlist-tune-overview/{user_id}/{playlist_ref}/{tune_id}",
    response_model=PlaylistTuneJoinedModel,
)
async def get_playlist_tune_overview(user_id: int, playlist_ref: int, tune_id: int):
    """
    Retrieve a tune from the database.

    Args:
        user_id (int): Unique user ID.
        playlist_ref (int): Unique playlist ID.
        tune_id (int): Unique tune ID.

    Returns:
        PlaylistTuneJoinedModel | dict[str, str]: The retrieved tune data or an error message.
            Example:
                PlaylistTune object
                {"detail": "Tune not found"}
                {"detail": "Unable to fetch tune: <error_message>"}
    """
    try:
        with SessionLocal() as db:
            result = (
                db.query(t_practice_list_joined)
                .filter(
                    t_practice_list_joined.c.user_ref == user_id,
                    t_practice_list_joined.c.playlist_ref == playlist_ref,
                    t_practice_list_joined.c.id == tune_id,
                )
                .first()
            )

            if result is None:
                raise HTTPException(
                    status_code=404, detail=f"Tune not found: ({tune_id})"
                )
            return PlaylistTuneJoinedModel.model_validate(result)
    except HTTPException as e:
        logger.error(f"Unable to fetch tune ({tune_id}): {e}")
        raise
    except Exception as e:
        logger.error(f"Unable to fetch tune ({tune_id}): {e}")
        raise HTTPException(
            status_code=500, detail=f"Unable to fetch tune ({tune_id}): {e}"
        )


@router.get(
    "/playlist_tune/{user_id}/{playlist_ref}/{tune_id}",
    response_model=PlaylistTuneModel | None,
    summary="Get Playlist Tune (unjoined)",
    description="Retrieve a playlist tune by its tune ID and playlist ID.",
    status_code=200,
)
def get_playlist_tune(
    user_id: int = Path(..., description="User ID"),
    playlist_ref: int = Path(..., description="Playlist reference ID"),
    tune_id: int = Path(..., description="Tune ID"),
):
    try:
        with SessionLocal() as db:
            playlist_tune = (
                db.query(PlaylistTune)
                .filter(
                    PlaylistTune.tune_ref == tune_id,
                    PlaylistTune.playlist_ref == playlist_ref,
                )
                .first()
            )
            return playlist_tune
    except Exception as e:
        logger.error(f"Unable to fetch tune({tune_id}): {e}")
        if isinstance(e, HTTPException):
            raise e
        else:
            raise HTTPException(
                status_code=500, detail=f"Unable to fetch tune({tune_id}): {e}"
            )


@router.get(
    "/intersect_playlist_tunes",
    response_model=List[int] | None,
    summary="Return Tune IDs that are in the Playlist that match the tune_refs passed in",
    description="Retrieve a playlist tune by its tune ID and playlist ID.",
    status_code=200,
)
def intersect_playlist_tunes(
    tune_refs: List[int] = Query(...), playlist_ref: int = Query(...)
) -> List[int]:
    try:
        with SessionLocal() as db:
            playlist_tunes = (
                db.query(PlaylistTune)
                .filter(
                    PlaylistTune.tune_ref.in_(tune_refs),
                    PlaylistTune.playlist_ref == playlist_ref,
                )
                .all()
            )
            playlist_tunes_ids = [
                playlist_tune.tune_ref for playlist_tune in playlist_tunes
            ]
            return playlist_tunes_ids
    except Exception as e:
        logger.error(f"Unable to fetch tune({tune_refs}): {e}")
        if isinstance(e, HTTPException):
            raise e
        else:
            raise HTTPException(
                status_code=500, detail=f"Unable to fetch tune({tune_refs}): {e}"
            )


@router.post(
    "/playlist_tune",
    response_model=PlaylistTuneModel,
    summary="Create Playlist Tune",
    description="Create a new playlist tune entry.",
    status_code=201,
)
def playlist_tune_create(
    playlist_tune: PlaylistTuneModelPartial, playlist_ref: Optional[int] = None
):
    try:
        with SessionLocal() as db:
            new_tune = PlaylistTune(**playlist_tune.model_dump())
            db.add(new_tune)
            db.flush()  # Explicitly flush the session
            db.commit()
            db.refresh(new_tune)
            print(
                f"Created playlist tune: {new_tune.tune_ref}, {new_tune.playlist_ref}"
            )

            playlist_tune_from_db = (
                db.query(PlaylistTune)
                .filter(
                    PlaylistTune.tune_ref == playlist_tune.tune_ref,
                    PlaylistTune.playlist_ref == playlist_tune.playlist_ref,
                )
                .first()
            )
            return playlist_tune_from_db
    except Exception as e:
        logger.error(f"Unable to create tune: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to create tune: {e}")


@router.delete(
    "/playlist-tune-overview/{user_id}/{playlist_ref}/{tune_id}", response_model=dict
)
async def delete_playlist_tune(user_id: int, playlist_ref: int, tune_id: int):
    """
    Delete a tune from the database.

    Args:
        user_id (int): Unique user ID.
        playlist_ref (int): Unique playlist ID.
        tune_id (int): Unique tune ID.

    Returns:
        dict: A dictionary containing either a success message or an error message.
            Example:
                {"success": "Tune deleted successfully"}
                {"detail": "No tune found to delete"}
                {"detail": "Unable to delete tune: <error_message>"}
    """
    try:
        with SessionLocal() as db:
            stmt = t_practice_list_joined.delete().where(
                t_practice_list_joined.c.user_ref == user_id,
                t_practice_list_joined.c.playlist_ref == playlist_ref,
                t_practice_list_joined.c.id == tune_id,
            )
            result = db.execute(stmt)
            db.commit()
            if result.rowcount == 0:
                raise HTTPException(status_code=404, detail="No tune found to delete")
            return {"success": f"Tune {tune_id} deleted successfully"}
    except Exception as e:
        logger.error(f"Unable to delete tune ({tune_id}): {e}")
        raise HTTPException(status_code=500, detail=f"Unable to delete tune: {e}")


@router.patch(
    "/playlist_tunes",
    response_model=ResponseStatusModel,
    summary="Update Multiple Playlist Tunes",
    description="Update multiple playlist tunes by their reference ID.  Note this is only updating the playlist_tune table, not the tune table.",
    status_code=200,
)
def update_playlist_tunes(
    tune_refs: list[int] = Query(...),
    playlist_ref: int = Query(...),
    tune: PlaylistTuneModelPartial = Body(...),
):
    try:
        with SessionLocal() as db:
            updated_playlist_tunes = []
            for tune_ref in tune_refs:
                existing_tune = (
                    db.query(PlaylistTune)
                    .filter(
                        PlaylistTune.tune_ref == tune_ref,
                        PlaylistTune.playlist_ref == playlist_ref,
                    )
                    .first()
                )
                if not existing_tune:
                    raise HTTPException(status_code=404, detail="Tune not found")

                for key, value in tune.model_dump(exclude_unset=True).items():
                    setattr(existing_tune, key, value)
                db.flush()  # Stage changes for this tune
                updated_playlist_tunes.append(existing_tune)

            db.commit()  # Commit all changes at once

            # Refresh the session to ensure views reflect the latest data
            db.expire_all()

            # If we need the updated objects immediately:
            for playlist_tune in updated_playlist_tunes:
                db.refresh(playlist_tune)

            return ResponseStatusModel(status="Tunes updated successfully")
    except Exception as e:
        logger.error(f"Unable to update tune: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to update tune: {e}")


@router.get(
    "/references/{user_ref}/{tune_ref}",
    response_model=List[ReferenceModel],
    summary="Get References",
    description="Get all references for a user and tune or public references.",
    status_code=200,
)
def get_references(
    user_ref: int = Path(..., description="User reference ID"),
    tune_ref: int = Path(..., description="Tune reference ID"),
    public: int = Query(0, ge=0, le=1),
):
    try:
        logger.debug(
            f"Fetching references for user_ref ({user_ref}) and tune_ref ({tune_ref})"
        )
        with SessionLocal() as db:
            stmt = (
                select(Reference).where(
                    (Reference.tune_ref == tune_ref)
                    & ((Reference.user_ref == user_ref) | (Reference.public == public))
                )
                if public
                else select(Reference).where(
                    (Reference.user_ref == user_ref) & (Reference.tune_ref == tune_ref)
                )
            )
            logger.debug(f"Generated SQL: {stmt}")
            logger.debug(
                f"Parameters: user_ref={user_ref}, tune_ref={tune_ref}, public={public}"
            )

            result = db.execute(stmt)
            references = result.scalars().all()
            # Debugging: Print the fetched references
            logger.debug(f"Fetched references: {references}")
            for reference in references:
                logger.debug(
                    f"Reference type: {type(reference)}, Reference: {reference}"
                )

            result = [
                ReferenceModel.model_validate(reference) for reference in references
            ]
            return result
    except Exception as e:
        logger.error(
            f"Unable to fetch references for user_ref ({user_ref}) and tune_ref ({tune_ref}): {e}"
        )
        raise HTTPException(status_code=500, detail=f"Unable to fetch references: {e}")


@router.get(
    "/references_query",
    response_model=List[ReferenceModel],
    summary="Get References by column query",
    description="Get all references that have a given value in a specified column.",
    status_code=200,
)
def get_references_by_query(
    url: Optional[str] = Query(None, description="URL to search for in references"),
) -> List[ReferenceModel]:
    try:
        if url is None:
            return []

        logger.debug(f"Fetching references with URL ({url})")
        with SessionLocal() as db:
            stmt = select(Reference).where(Reference.url == url)
            logger.debug(f"Generated SQL: {stmt}")
            logger.debug(f"Parameters: url={url}")

            result = db.execute(stmt)
            references = result.scalars().all()
            # Debugging: Print the fetched references
            logger.debug(f"Fetched references: {references}")
            for reference in references:
                logger.debug(
                    f"Reference type: {type(reference)}, Reference: {reference}"
                )

            result = [
                ReferenceModel.model_validate(reference) for reference in references
            ]
            return result
    except Exception as e:
        logger.error(f"Unable to fetch references with URL ({url}): {e}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch references: {e}")


@router.post(
    "/references",
    response_model=ReferenceModel,
    summary="Create Reference",
    description="Create a new reference.",
    status_code=201,
)
def create_reference(reference: ReferenceModelCreate):
    try:
        with SessionLocal() as db:
            new_reference = Reference(**reference.model_dump())
            db.add(new_reference)
            db.commit()
            db.refresh(new_reference)
            return ReferenceModel.model_validate(new_reference)
    except Exception as e:
        logger.error(f"Unable to create reference: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to create reference: {e}")


@router.patch(
    "/references/{id}",
    response_model=ReferenceModel,
    summary="Update Reference",
    description="Update an existing reference.",
    status_code=200,
)
def update_reference(
    id: int = Path(..., description="Reference ID"),
    reference: ReferenceModelPartial = Body(...),
):
    try:
        with SessionLocal() as db:
            stmt = select(Reference).where((Reference.id == id))
            result = db.execute(stmt)
            existing_reference = result.scalars().first()

            if not existing_reference:
                raise HTTPException(
                    status_code=404,
                    detail=f"Reference not found: ({id})",
                )

            for key, value in reference.model_dump(exclude_unset=True).items():
                setattr(existing_reference, key, value)

            db.commit()
            db.refresh(existing_reference)
            return ReferenceModel.model_validate(existing_reference)
    except Exception as e:
        logger.error(f"Unable to update reference ({id}: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to update reference: {e}")


@router.delete(
    "/references/{id}",
    summary="Delete Reference",
    description="Delete an existing reference.",
    status_code=204,
)
def delete_reference(id: int):  # noqa: C901
    try:
        with SessionLocal() as db:
            stmt = select(Reference).where(Reference.id == id)
            result = db.execute(stmt)
            existing_reference = result.scalars().first()

            if not existing_reference:
                raise HTTPException(
                    status_code=404,
                    detail=f"Reference not found: {id}",
                )

            db.delete(existing_reference)
            db.commit()
            return {"detail": "Reference deleted successfully"}
    except Exception as e:
        logger.error(f"Unable to delete reference {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to delete reference: {e}")


@router.get(
    "/notes/{user_ref}/{tune_ref}",
    response_model=List[NoteModel],
    summary="Get Notes",
    description="Retrieve notes based on tune_ref and optional playlist_ref, user_ref, or public.",
    status_code=200,
)
def get_notes(
    user_ref: int = Path(..., description="User reference ID"),
    tune_ref: int = Path(..., description="Tune reference ID"),
    playlist_ref: Optional[int] = Query(None),
    public: Optional[int] = Query(None, ge=0, le=1),
):
    try:
        with SessionLocal() as db:
            stmt = select(Note).where(
                Note.tune_ref == tune_ref,
                (Note.playlist_ref == playlist_ref)
                | (Note.user_ref == user_ref)
                | (Note.public == public),
            )
            result = db.execute(stmt)
            notes = result.scalars().all()
            return [NoteModel.model_validate(note) for note in notes]
    except Exception as e:
        logger.error(f"Unable to fetch notes: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch notes: {e}")


@router.post(
    "/notes",
    response_model=NoteModel,
    summary="Create Note",
    description="Create a new note.",
    status_code=201,
)
def create_note(note: NoteModelCreate):
    try:
        with SessionLocal() as db:
            new_note = Note(**note.model_dump())
            db.add(new_note)
            db.commit()
            db.refresh(new_note)
            return NoteModel.model_validate(new_note)
    except Exception as e:
        logger.error(f"Unable to create note: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to create note: {e}")


@router.patch(
    "/notes/{note_id}",
    response_model=NoteModel,
    summary="Update Note",
    description="Update an existing note.",
    status_code=200,
)
def update_note(
    note_id: int = Path(..., description="Note ID"),
    note: NoteModelPartial = Body(...),
):
    try:
        with SessionLocal() as db:
            stmt = select(Note).where(Note.id == note_id)
            result = db.execute(stmt)
            existing_note = result.scalars().first()

            if not existing_note:
                raise HTTPException(
                    status_code=404, detail=f"Note not found: {note_id}"
                )

            for key, value in note.model_dump(exclude_unset=True).items():
                setattr(existing_note, key, value)

            db.commit()
            db.refresh(existing_note)
            return NoteModel.model_validate(existing_note)
    except Exception as e:
        logger.error(f"Unable to update note ({note_id}): {e}")
        raise HTTPException(status_code=500, detail=f"Unable to update note: {e}")


@router.delete(
    "/notes/{note_id}",
    summary="Delete Note",
    description="Delete an existing note.",
    status_code=204,
)
def delete_note(
    note_id: int = Path(..., description="Note ID"),
):
    try:
        with SessionLocal() as db:
            stmt = select(Note).where(Note.id == note_id)
            result = db.execute(stmt)
            existing_note = result.scalars().first()

            if not existing_note:
                raise HTTPException(
                    status_code=404, detail=f"Note not found: {note_id}"
                )

            db.delete(existing_note)
            db.commit()
            return {"detail": "Note deleted successfully"}
    except Exception as e:
        logger.error(f"Unable to delete note ({note_id}): {e}")
        raise HTTPException(status_code=500, detail=f"Unable to delete note: {e}")


@router.get(
    "/tune/{tune_ref}",
    response_model=TuneModel,
    summary="Get Tune",
    description="Retrieve a tune by its reference ID.",
    status_code=200,
)
def get_tune(
    tune_ref: int = Path(..., description="Tune reference ID"),
):
    try:
        with SessionLocal() as db:
            tune = db.query(Tune).filter(Tune.id == tune_ref).first()
            if not tune:
                raise HTTPException(
                    status_code=404, detail=f"Tune({tune_ref}) not found"
                )
            return TuneModel.model_validate(tune)
    except Exception as e:
        logger.error(f"Unable to fetch tune({tune_ref}): {e}")
        if isinstance(e, HTTPException):
            raise e
        else:
            raise HTTPException(
                status_code=500, detail=f"Unable to fetch tune({tune_ref}): {e}"
            )


# TODO: This will need to accept user_ref and playlist_ref, in order to search titles
#       that are in tune_override table.
@router.get(
    "/tunes/search",
    response_model=List[TuneModel],
    summary="Search Tunes by Title",
    description="Search for tunes by title using Levenshtein Distance.",
    status_code=200,
)
def search_tunes_by_title(
    title: str = Query(..., description="Title to search for"),
    limit: int = Query(10, description="Maximum number of results to return"),
):
    try:
        with SessionLocal() as db:
            stmt = (
                select(Tune)
                .order_by(func.levenshtein(Tune.title, title).desc())
                .filter(func.levenshtein(Tune.title, title) > 70.0)
                .limit(limit)
            )
            tunes = db.execute(stmt).scalars().all()
            # if not tunes:
            #     raise HTTPException(
            #         status_code=404, detail=f"No tunes found matching title '{title}'"
            #     )
            return [TuneModel.model_validate(tune) for tune in tunes]
    except Exception as e:
        logger.error(f"Unable to search tunes by title '{title}': {e}")
        raise HTTPException(
            status_code=500, detail=f"Unable to search tunes by title '{title}': {e}"
        )


@router.get(
    "/tunes",
    response_model=List[TuneModel],
    summary="Get Tunes",
    description="Retrieve tunes with pagination.",
)
def get_tunes(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(
        -1, ge=-1, le=10000, description="Maximum number of records to return"
    ),
    show_deleted: bool = Query(False),
):
    try:
        with SessionLocal() as db:
            if DEBUG_SLOWDOWN > 0:
                time.sleep(DEBUG_SLOWDOWN)
            query = db.query(Tune)
            if not show_deleted:
                query = query.filter(Tune.deleted.is_(False))
            query = query.offset(skip)
            if limit > 0:
                query = query.limit(limit)
            tunes = query.all()
            return tunes
    except Exception as e:
        logger.error(f"Unable to fetch tunes: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/tune",
    response_model=TuneModel,
    summary="Create Tune",
    description="Create a new tune.",
    status_code=201,
)
def create_tune(tune: TuneModelCreate, playlist_ref: Optional[int] = None):
    try:
        with SessionLocal() as db:
            new_tune = Tune(**tune.model_dump())
            db.add(new_tune)
            db.flush()  # Explicitly flush the session

            # Optionally create a playlist_tune row if playlist_ref is provided
            if playlist_ref is not None:
                playlist_tune = PlaylistTune(
                    tune_ref=new_tune.id,
                    playlist_ref=playlist_ref,
                    learned=datetime.now(timezone.utc).strftime(
                        "%Y-%m-%d"
                    ),  # Set current UTC date as a default
                    current="T",
                )
                db.add(playlist_tune)
                db.flush()  # Explicitly flush the session

            db.commit()
            db.refresh(new_tune)
            print(f"Created tune: {new_tune.id}")
            return TuneModel.model_validate(new_tune)
    except Exception as e:
        logger.error(f"Unable to create tune: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to create tune: {e}")


@router.patch(
    "/tune/{tune_ref}",
    response_model=TuneModel,
    summary="Update Tune",
    description="Update an existing tune by its reference ID.",
    status_code=200,
)
def update_tune(
    tune_ref: int = Path(..., description="Tune reference ID"),
    tune: TuneModelPartial = Body(...),
):
    try:
        with SessionLocal() as db:
            existing_tune = db.query(Tune).filter(Tune.id == tune_ref).first()
            if not existing_tune:
                raise HTTPException(status_code=404, detail="Tune not found")

            for key, value in tune.model_dump(exclude_unset=True).items():
                setattr(existing_tune, key, value)

            db.flush()  # Ensure changes are flushed to the database
            db.commit()
            db.refresh(existing_tune)
            return TuneModel.model_validate(existing_tune)
    except Exception as e:
        logger.error(f"Unable to update tune: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to update tune: {e}")


@router.patch(
    "/tunes",
    response_model=ResponseStatusModel,
    summary="Update Multiple Tunes",
    description="Update multiple tunes by their reference IDs.",
    status_code=200,
)
def update_tunes(
    tune_refs: list[int] = Query(...),
    tune: TuneModelPartial = Body(...),
):
    try:
        with SessionLocal() as db:
            updated_tunes = []
            for tune_ref in tune_refs:
                existing_tune = db.query(Tune).filter(Tune.id == tune_ref).first()
                if not existing_tune:
                    raise HTTPException(status_code=404, detail="Tune not found")

                for key, value in tune.model_dump(exclude_unset=True).items():
                    setattr(existing_tune, key, value)
                db.flush()  # Stage changes for this tune
                updated_tunes.append(existing_tune)

            db.commit()  # Commit all changes at once

            # Refresh the session to ensure views reflect the latest data
            db.expire_all()

            # If we need the updated objects immediately:
            for tune in updated_tunes:
                db.refresh(tune)

            return ResponseStatusModel(status="Tunes updated successfully")
    except Exception as e:
        logger.error(f"Unable to update tune: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to update tune: {e}")


@router.delete(
    "/tune/{tune_ref}",
    summary="Delete Tune",
    description="Delete an existing tune by its reference ID.",
    status_code=204,
)
def delete_tune(
    tune_ref: int = Path(..., description="Tune reference ID"),
):
    try:
        with SessionLocal() as db:
            existing_tune = db.query(Tune).filter(Tune.id == tune_ref).first()
            if not existing_tune:
                raise HTTPException(status_code=404, detail="Tune not found")

            # Delete related records in other tables
            db.query(PlaylistTune).filter(PlaylistTune.tune_ref == tune_ref).delete()
            db.query(TuneOverride).filter(TuneOverride.tune_ref == tune_ref).delete()
            db.query(PracticeRecord).filter(
                PracticeRecord.tune_ref == tune_ref
            ).delete()
            db.query(Note).filter(Note.tune_ref == tune_ref).delete()
            db.query(Reference).filter(Reference.tune_ref == tune_ref).delete()

            # Delete the tune
            db.delete(existing_tune)
            db.commit()
            return
    except Exception as e:
        logger.error(f"Unable to delete tune: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to delete tune: {e}")


@router.get(
    "/playlist",
    response_model=List[PlaylistModel],
    summary="Get Playlists",
    description="Retrieve playlists by user reference.",
    status_code=200,
)
def get_playlists(
    user_ref: int = Query(
        -1, description="User reference ID, defaults to -1 meaning all playlists"
    ),
    show_deleted: bool = Query(False, description="Show deleted playlists if true"),
) -> List[PlaylistModel]:
    try:
        with SessionLocal() as db:
            query = db.query(Playlist)
            if user_ref != -1:
                query = query.filter(Playlist.user_ref == user_ref)
            if not show_deleted:
                query = query.filter(Playlist.deleted.is_(False))
            playlists = query.all()
            return [PlaylistModel.model_validate(playlist) for playlist in playlists]
    except Exception as e:
        logger.error(f"Unable to fetch playlists: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch playlists: {e}")


@router.post(
    "/playlist",
    response_model=PlaylistModel,
    summary="Create Playlist",
    description="Create a new playlist.",
    status_code=201,
)
def create_playlist(playlist: PlaylistModelPartial):
    try:
        with SessionLocal() as db:
            new_playlist = Playlist(**playlist.model_dump())
            db.add(new_playlist)
            db.commit()
            db.refresh(new_playlist)
            return PlaylistModel.model_validate(new_playlist)
    except Exception as e:
        logger.error(f"Unable to create playlist: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to create playlist: {e}")


@router.patch(
    "/playlist/{playlist_id}",
    response_model=PlaylistModel,
    summary="Update Playlist",
    description="Update an existing playlist by its ID.",
    status_code=200,
)
def update_playlist(
    playlist_id: int = Path(..., description="Playlist ID"),
    playlist: PlaylistModelPartial = Body(...),
):
    try:
        with SessionLocal() as db:
            existing_playlist = (
                db.query(Playlist).filter(Playlist.playlist_id == playlist_id).first()
            )
            if not existing_playlist:
                raise HTTPException(status_code=404, detail="Playlist not found")

            for key, value in playlist.model_dump(exclude_unset=True).items():
                setattr(existing_playlist, key, value)

            db.commit()
            db.refresh(existing_playlist)
            return PlaylistModel.model_validate(existing_playlist)
    except Exception as e:
        logger.error(f"Unable to update playlist: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to update playlist: {e}")


@router.delete(
    "/playlist/{playlist_id}",
    summary="Delete Playlist",
    description="Delete an existing playlist by its ID.",
    status_code=204,
)
def delete_playlist(
    playlist_id: int = Path(..., description="Playlist ID"),
):
    try:
        with SessionLocal() as db:
            existing_playlist = (
                db.query(Playlist).filter(Playlist.playlist_id == playlist_id).first()
            )
            if not existing_playlist:
                raise HTTPException(status_code=404, detail="Playlist not found")

            db.delete(existing_playlist)
            db.commit()
            return
    except Exception as e:
        logger.error(f"Unable to delete playlist: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to delete playlist: {e}")


@router.get(
    "/playlist/{playlist_id}",
    response_model=PlaylistModel,
    summary="Get Playlist by ID",
    description="Retrieve a playlist by its ID.",
    status_code=200,
)
def get_playlist_by_id(
    playlist_id: int = Path(..., description="Playlist ID"),
):
    try:
        with SessionLocal() as db:
            playlist = (
                db.query(Playlist).filter(Playlist.playlist_id == playlist_id).first()
            )
            if not playlist:
                raise HTTPException(status_code=404, detail="Playlist not found")
            return PlaylistModel.model_validate(playlist)
    except Exception as e:
        logger.error(f"Unable to fetch playlist: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch playlist: {e}")


@router.get(
    "/genres",
    response_model=List[GenreModel],
    summary="Get all genres",
    description="Retrieve all genres from the database.",
    status_code=200,
)
def get_genres() -> List[GenreModel]:
    """
    Returns all genres.
    """
    try:
        with SessionLocal() as db:
            # We assume there's a Genre model in tunetrees/models/tunetrees.py
            genres = db.query(Genre).all()
            return [GenreModel.model_validate(g) for g in genres]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/genres/{genre_id}",
    response_model=GenreModel,
    summary="Get a genre",
    description="Retrieve a genre by its ID.",
    status_code=200,
)
def get_genre(genre_id: int) -> GenreModel:
    """
    Returns a single genre by ID.
    """
    try:
        with SessionLocal() as db:
            genre = db.get(Genre, genre_id)
            if not genre:
                raise HTTPException(status_code=404, detail="Genre not found")
            return GenreModel(**genre.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/genres",
    response_model=GenreModel,
    summary="Create a new genre",
    description="Create a new genre with name and description (optional).",
    status_code=201,
)
def create_genre(new_genre: GenreModelCreate) -> GenreModel:
    """
    Creates a genre in the database.
    """
    try:
        with SessionLocal() as db:
            genre = Genre(name=new_genre.name, description=new_genre.description)
            db.add(genre)
            db.commit()
            db.refresh(genre)
            return GenreModel(**genre.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put(
    "/genres/{genre_id}",
    response_model=GenreModel,
    summary="Update a genre",
    description="Update an existing genre by its ID, changing name and/or description.",
    status_code=200,
)
def update_genre(genre_id: int, genre_update: GenreModelPartial) -> GenreModel:
    """
    Updates the genre's fields.
    """
    try:
        with SessionLocal() as db:
            genre = db.get(Genre, genre_id)
            if not genre:
                raise HTTPException(status_code=404, detail="Genre not found")
            if genre_update.name is not None:
                genre.name = genre_update.name
            if genre_update.description is not None:
                genre.description = genre_update.description
            db.commit()
            db.refresh(genre)
            return GenreModel(**genre.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/genres/{genre_id}",
    summary="Delete a genre",
    description="Delete an existing genre by its ID.",
    status_code=204,
)
def delete_genre(genre_id: int) -> None:
    """
    Deletes a genre from the database.
    """
    try:
        with SessionLocal() as db:
            genre = db.get(Genre, genre_id)
            if not genre:
                raise HTTPException(status_code=404, detail="Genre not found")
            db.delete(genre)
            db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/instruments",
    response_model=List[InstrumentModel],
    summary="Get Instruments",
    description="Retrieve all instruments.",
    status_code=200,
)
def get_instruments(
    user_ref: Optional[int] = Query(None, description="User reference ID"),
    show_deleted: bool = Query(False),
) -> List[InstrumentModel]:
    try:
        with SessionLocal() as db:
            query = db.query(Instrument)
            if user_ref is not None:
                query = query.filter(Instrument.private_to_user == user_ref)
            if not show_deleted:
                query = query.filter(Instrument.deleted.is_(False))
            instruments = query.all()
            return [
                InstrumentModel.model_validate(instrument) for instrument in instruments
            ]
    except Exception as e:
        logger.error(f"Unable to fetch instruments: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch instruments: {e}")


@router.get(
    "/instruments/{instrument_id}",
    response_model=InstrumentModel,
    summary="Get Instrument by ID",
    description="Retrieve an instrument by its ID.",
    status_code=200,
)
def get_instrument_by_id(
    instrument_id: int = Path(..., description="Instrument ID"),
) -> InstrumentModel:
    try:
        with SessionLocal() as db:
            instrument = (
                db.query(Instrument).filter(Instrument.id == instrument_id).first()
            )
            if not instrument:
                raise HTTPException(status_code=404, detail="Instrument not found")
            return InstrumentModel.model_validate(instrument)
    except Exception as e:
        logger.error(f"Unable to fetch instrument: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to fetch instrument: {e}")


@router.post(
    "/instruments",
    response_model=InstrumentModel,
    summary="Create Instrument",
    description="Create a new instrument.",
    status_code=201,
)
def create_instrument(instrument: InstrumentModelPartial):
    try:
        with SessionLocal() as db:
            new_instrument = Instrument(**instrument.model_dump())
            db.add(new_instrument)
            db.commit()
            db.refresh(new_instrument)
            return InstrumentModel.model_validate(new_instrument)
    except Exception as e:
        logger.error(f"Unable to create instrument: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to create instrument: {e}")


@router.patch(
    "/instruments/{instrument_id}",
    response_model=InstrumentModel,
    summary="Update Instrument",
    description="Update an existing instrument by its ID.",
    status_code=200,
)
def update_instrument(
    instrument_id: int = Path(..., description="Instrument ID"),
    instrument: InstrumentModelPartial = Body(...),
):
    try:
        with SessionLocal() as db:
            existing_instrument = (
                db.query(Instrument).filter(Instrument.id == instrument_id).first()
            )
            if not existing_instrument:
                raise HTTPException(status_code=404, detail="Instrument not found")

            for key, value in instrument.model_dump(exclude_unset=True).items():
                setattr(existing_instrument, key, value)

            db.commit()
            db.refresh(existing_instrument)
            return InstrumentModel.model_validate(existing_instrument)
    except Exception as e:
        logger.error(f"Unable to update instrument: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to update instrument: {e}")


@router.delete(
    "/instruments/{instrument_id}",
    summary="Delete Instrument",
    description="Delete an existing instrument by its ID.",
    status_code=204,
)
def delete_instrument(
    instrument_id: int = Path(..., description="Instrument ID"),
):
    try:
        with SessionLocal() as db:
            existing_instrument = (
                db.query(Instrument).filter(Instrument.id == instrument_id).first()
            )
            if not existing_instrument:
                raise HTTPException(status_code=404, detail="Instrument not found")

            db.delete(existing_instrument)
            db.commit()
            return
    except Exception as e:
        logger.error(f"Unable to delete instrument: {e}")
        raise HTTPException(status_code=500, detail=f"Unable to delete instrument: {e}")


@router.get(
    "/view_playlist_joined/{user_id}",
    response_model=List[ViewPlaylistJoinedModel],
    summary="Get View Playlist Joined",
    description="Retrieve the joined playlist and instrument data for a user.",
    status_code=200,
)
async def get_view_playlist_joined(
    user_id: int,
    instrument_ref: Optional[int] = Query(None),
    show_deleted: bool = Query(False),
    show_playlist_deleted: bool = Query(False),
    all_public: bool = Query(
        False, description="Include public records (user_id == 0)"
    ),
) -> List[ViewPlaylistJoinedModel]:
    try:
        with SessionLocal() as db:
            query = db.query(t_view_playlist_joined).filter(
                (t_view_playlist_joined.c.user_ref == user_id)
                | (all_public and t_view_playlist_joined.c.private_to_user == 0)
            )
            if instrument_ref is not None:
                query = query.filter(
                    t_view_playlist_joined.c.instrument_ref == instrument_ref
                )
            if not show_deleted:
                query = query.filter(
                    t_view_playlist_joined.c.instrument_deleted.is_(False)
                )
            if not show_playlist_deleted:
                query = query.filter(
                    t_view_playlist_joined.c.playlist_deleted.is_(False)
                )
            result = query.all()
            return [ViewPlaylistJoinedModel.model_validate(record) for record in result]
    except Exception as e:
        logger.error(f"Unable to fetch view playlist joined: {e}")
        raise HTTPException(
            status_code=500, detail=f"Unable to fetch view playlist joined: {e}"
        )


@router.get(
    "/practice_record/{playlist_ref}/{tune_ref}",
    response_model=PracticeRecordModel,
    summary="Get a single practice record",
    description="Retrieve a single practice record by playlist_ref and tune_ref",
    status_code=200,
)
def get_practice_record(playlist_ref: int, tune_ref: int) -> PracticeRecordModel:
    try:
        with SessionLocal() as db:
            # Get the latest practice record for this tune/playlist combination
            stmt = (
                select(PracticeRecord)
                .where(
                    PracticeRecord.playlist_ref == playlist_ref,
                    PracticeRecord.tune_ref == tune_ref,
                )
                .order_by(PracticeRecord.id.desc())
            )
            record = db.execute(stmt).scalar_one_or_none()

            if not record:
                raise HTTPException(status_code=404, detail="Practice record not found")

            return PracticeRecordModel.model_validate(record)
    except HTTPException as e:
        logger.error("HTTPException in get_practice_record: %s", e)
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in get_practice_record: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post(
    "/practice_record",
    response_model=PracticeRecordModel,
    summary="Create a practice record",
    description="Create a new practice record (playlist_ref and tune_ref in the body)",
    status_code=201,
)
def create_practice_record(record: PracticeRecordModelPartial) -> PracticeRecordModel:
    try:
        with SessionLocal() as db:
            db_record = PracticeRecord(**record.model_dump(exclude_unset=True))
            db.add(db_record)
            db.commit()
            db.refresh(db_record)
            result = PracticeRecordModel.model_validate(
                db_record
            )  # Using model_validate
            return result
    except HTTPException as e:
        logger.error("HTTPException in create_practice_record: %s", e)
        raise e
    except Exception as e:
        logger.error("Unexpected error in create_practice_record: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.patch(
    "/practice_record/{playlist_ref}/{tune_ref}",
    response_model=PracticeRecordModel,
    summary="Update a practice record",
    description="Update an existing practice record by playlist_ref and tune_ref",
    status_code=200,
)
def update_practice_record_patch(
    playlist_ref: int, tune_ref: int, record: PracticeRecordModelPartial
) -> PracticeRecordModel:
    try:
        with SessionLocal() as db:
            # Get the latest practice record for this tune/playlist combination
            stmt = (
                select(PracticeRecord)
                .where(
                    PracticeRecord.playlist_ref == playlist_ref,
                    PracticeRecord.tune_ref == tune_ref,
                )
                .order_by(PracticeRecord.id.desc())
            )
            db_record = db.execute(stmt).scalar_one_or_none()

            if not db_record:
                raise HTTPException(status_code=404, detail="Practice record not found")

            update_data = record.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(db_record, key, value)

            db.commit()
            db.refresh(db_record)
            result = PracticeRecordModel.model_validate(db_record)
            return result
    except HTTPException as e:
        logger.error("HTTPException in update_practice_record: %s", e)
        raise e
    except Exception as e:
        logger.error("Unexpected error in update_practice_record: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.put(
    "/practice_record/{playlist_ref}/{tune_ref}",
    response_model=PracticeRecordModel,
    summary="Create or update a practice record",
    description="Create a new practice record if it doesn't exist, or update an existing one",
    status_code=200,
)
def upsert_practice_record(
    playlist_ref: int, tune_ref: int, record: PracticeRecordModelPartial
) -> PracticeRecordModel:
    try:
        with SessionLocal() as db:
            # Get the latest practice record for this tune/playlist combination
            stmt = (
                select(PracticeRecord)
                .where(
                    PracticeRecord.playlist_ref == playlist_ref,
                    PracticeRecord.tune_ref == tune_ref,
                )
                .order_by(PracticeRecord.id.desc())
            )
            db_record = db.execute(stmt).scalar_one_or_none()

            update_data = record.model_dump(exclude_unset=True)

            if not db_record:
                # Create new record if not found
                db_record = PracticeRecord(
                    playlist_ref=playlist_ref, tune_ref=tune_ref, **update_data
                )
                db.add(db_record)
                logger.debug(
                    f"Creating new practice record for playlist_ref={playlist_ref}, tune_ref={tune_ref}"
                )
            else:
                # For historical tracking, always create a new record instead of updating
                # This preserves the historical practice data
                # Use the practiced date from the frontend if provided, otherwise generate one
                if "practiced" not in update_data or not update_data["practiced"]:
                    # Only generate a timestamp if none was provided by the frontend
                    import datetime

                    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    update_data["practiced"] = current_time
                    logger.debug(
                        f"Generated timestamp {current_time} for new practice record"
                    )
                else:
                    # Check if a record with this timestamp already exists to avoid unique constraint violation
                    import datetime

                    frontend_timestamp = update_data["practiced"]
                    logger.debug(
                        f"Using frontend-provided timestamp {frontend_timestamp} for new practice record"
                    )

                    # Check for existing record with same timestamp
                    conflict_stmt = select(PracticeRecord).where(
                        PracticeRecord.playlist_ref == playlist_ref,
                        PracticeRecord.tune_ref == tune_ref,
                        PracticeRecord.practiced == frontend_timestamp,
                    )
                    existing_record = db.execute(conflict_stmt).scalar_one_or_none()

                    if existing_record:
                        # Increment by one second to avoid unique constraint violation
                        dt = datetime.datetime.strptime(
                            frontend_timestamp, "%Y-%m-%d %H:%M:%S"
                        )
                        dt += datetime.timedelta(seconds=1)
                        new_timestamp = dt.strftime("%Y-%m-%d %H:%M:%S")
                        update_data["practiced"] = new_timestamp
                        logger.debug(
                            f"Incremented timestamp to {new_timestamp} to avoid constraint violation"
                        )

                db_record = PracticeRecord(
                    playlist_ref=playlist_ref, tune_ref=tune_ref, **update_data
                )
                db.add(db_record)
                logger.debug(
                    f"Creating new practice record for playlist_ref={playlist_ref}, tune_ref={tune_ref} (historical tracking)"
                )

            db.commit()
            db.refresh(db_record)
            result = PracticeRecordModel.model_validate(db_record)
            return result
    except HTTPException as e:
        logger.error("HTTPException in upsert_practice_record: %s", e)
        raise e
    except Exception as e:
        logger.error("Unexpected error in upsert_practice_record: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.delete(
    "/practice_record/{playlist_ref}/{tune_ref}",
    summary="Delete a practice record",
    description="Delete an existing practice record by playlist_ref and tune_ref",
    status_code=204,
)
def delete_practice_record(playlist_ref: int, tune_ref: int) -> None:
    try:
        with SessionLocal() as db:
            # Get the latest practice record for this tune/playlist combination
            stmt = (
                select(PracticeRecord)
                .where(
                    PracticeRecord.playlist_ref == playlist_ref,
                    PracticeRecord.tune_ref == tune_ref,
                )
                .order_by(PracticeRecord.id.desc())
            )
            db_record = db.execute(stmt).scalar_one_or_none()
            if not db_record:
                raise HTTPException(status_code=404, detail="Practice record not found")
            db.delete(db_record)
            db.commit()
    except HTTPException as e:
        logger.error("HTTPException in delete_practice_record: %s", e)
        raise e
    except Exception as e:
        logger.error("Unexpected error in delete_practice_record: %s", e)
        raise HTTPException(status_code=500, detail="Internal Server Error")


# BOOKMARK: tune_override_query
@router.get(
    "/query_tune_override",
    response_model=TuneOverrideModel,
    summary="Get Tune Override",
    description="Retrieve a tune override by its ID.",
    status_code=200,
)
def query_tune_override(
    user_ref: int = Query(description="User reference ID"),
    tune_ref: int = Query(description="Tune reference ID"),
) -> TuneOverrideModel:
    try:
        with SessionLocal() as db:
            # Example usage:
            tune_override = (
                db.query(TuneOverride)
                .filter(
                    TuneOverride.tune_ref == tune_ref, TuneOverride.user_ref == user_ref
                )
                .first()
            )
            if not tune_override:
                raise HTTPException(status_code=404, detail="Tune override not found")
            return TuneOverrideModel.model_validate(tune_override)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Tune Override API
@router.get(
    "/tune_override/{override_id}",
    response_model=TuneOverrideModel,
    summary="Get Tune Override",
    description="Retrieve a tune override by its ID.",
    status_code=200,
)
def get_tune_override(override_id: int) -> TuneOverrideModel:
    try:
        with SessionLocal() as db:
            # Example usage:
            tune_override = (
                db.query(TuneOverride).filter(TuneOverride.id == override_id).first()
            )
            if not tune_override:
                raise HTTPException(status_code=404, detail="Tune override not found")
            return TuneOverrideModel.model_validate(tune_override)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/tune_override",
    response_model=TuneOverrideModel,
    summary="Create Tune Override",
    description="Create a new tune override entry.",
    status_code=201,
)
def create_tune_override(override: TuneOverrideModelPartial) -> TuneOverrideModel:
    try:
        with SessionLocal() as db:
            new_override = TuneOverride(**override.model_dump(exclude_unset=True))
            db.add(new_override)
            db.commit()
            db.refresh(new_override)
            return TuneOverrideModel.model_validate(new_override)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch(
    "/tune_override/{override_id}",
    response_model=TuneOverrideModel,
    summary="Update Tune Override",
    description="Update an existing tune override by ID.",
    status_code=200,
)
def update_tune_override(
    override_id: int, override: TuneOverrideModelPartial
) -> TuneOverrideModel:
    try:
        with SessionLocal() as db:
            tune_override = (
                db.query(TuneOverride).filter(TuneOverride.id == override_id).first()
            )
            if not tune_override:
                raise HTTPException(status_code=404, detail="Tune override not found")
            for key, value in override.model_dump(exclude_unset=True).items():
                setattr(tune_override, key, value)
            db.commit()
            db.refresh(tune_override)
            return TuneOverrideModel.model_validate(tune_override)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete(
    "/tune_override/{override_id}",
    summary="Delete Tune Override",
    description="Delete an existing tune override by ID.",
    status_code=204,
)
def delete_tune_override(override_id: int) -> None:
    try:
        with SessionLocal() as db:
            tune_override = (
                db.query(TuneOverride).filter(TuneOverride.id == override_id).first()
            )
            if not tune_override:
                raise HTTPException(status_code=404, detail="Tune override not found")
            db.delete(tune_override)
            db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/tune_type/{tune_type_id}",
    response_model=TuneTypeModel,
    summary="Get TuneType",
    description="Retrieve a TuneType by its ID",
    status_code=status.HTTP_200_OK,
)
async def get_tune_type(tune_type_id: str):
    with SessionLocal() as db:
        tune_type = db.query(TuneType).filter(TuneType.id == tune_type_id).first()
        if not tune_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="TuneType not found"
            )
        return TuneTypeModel.model_validate(tune_type)


@router.post(
    "/tune_type",
    response_model=TuneTypeModel,
    summary="Create TuneType",
    description="Create a new TuneType",
    status_code=status.HTTP_201_CREATED,
)
async def create_tune_type(tune_type: TuneTypeModel):
    with SessionLocal() as db:
        new_tune_type = TuneType(**tune_type.model_dump())
        db.add(new_tune_type)
        db.commit()
        db.refresh(new_tune_type)
        return TuneTypeModel.model_validate(new_tune_type)


@router.patch(
    "/tune_type/{tune_type_id}",
    response_model=TuneTypeModel,
    summary="Update TuneType",
    description="Update an existing TuneType",
    status_code=status.HTTP_200_OK,
)
async def update_tune_type(tune_type_id: str, tune_type: TuneTypeModelPartial):
    with SessionLocal() as db:
        existing_tune_type = (
            db.query(TuneType).filter(TuneType.id == tune_type_id).first()
        )
        if not existing_tune_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="TuneType not found"
            )
        for key, value in tune_type.model_dump().items():
            if value is not None:
                setattr(existing_tune_type, key, value)
        db.commit()
        db.refresh(existing_tune_type)
        return TuneTypeModel.model_validate(existing_tune_type)


@router.delete(
    "/tune_type/{tune_type_id}",
    summary="Delete TuneType",
    description="Delete a TuneType by its ID",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_tune_type(tune_type_id: str):
    with SessionLocal() as db:
        tune_type = db.query(TuneType).filter(TuneType.id == tune_type_id).first()
        if not tune_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="TuneType not found"
            )
        db.delete(tune_type)
        db.commit()
        return {"detail": "TuneType deleted successfully"}


@router.get(
    "/genre_tune_type/{genre_id}/{tune_type_id}",
    response_model=GenreTuneTypeModel,
    summary="Get Genre-TuneType association",
    description="Retrieve a Genre-TuneType association by its IDs.",
    status_code=200,
)
async def get_genre_tune_type(genre_id: str, tune_type_id: str) -> GenreTuneTypeModel:
    with SessionLocal() as db:
        row = (
            db.execute(
                select(t_genre_tune_type).where(
                    t_genre_tune_type.c.genre_id == genre_id,
                    t_genre_tune_type.c.tune_type_id == tune_type_id,
                )
            )
            .mappings()
            .first()
        )
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Association not found",
            )
        return GenreTuneTypeModel.model_validate(row)


@router.post(
    "/genre_tune_type",
    response_model=GenreTuneTypeModel,
    summary="Create Genre-TuneType association",
    description="Create a new association between Genre and TuneType.",
    status_code=201,
)
async def create_genre_tune_type(data: GenreTuneTypeModelPartial) -> GenreTuneTypeModel:
    with SessionLocal() as db:
        insert_stmt = (
            insert(t_genre_tune_type)
            .values(**data.model_dump())
            .returning(t_genre_tune_type)
        )
        row = db.execute(insert_stmt).mappings().first()
        db.commit()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insert failed",
            )
        return GenreTuneTypeModel.model_validate(row)


@router.delete(
    "/genre_tune_type/{genre_id}/{tune_type_id}",
    summary="Delete Genre-TuneType association",
    status_code=204,
)
async def delete_genre_tune_type(genre_id: str, tune_type_id: str):
    with SessionLocal() as db:
        row_current = (
            db.execute(
                select(t_genre_tune_type).where(
                    t_genre_tune_type.c.genre_id == genre_id,
                    t_genre_tune_type.c.tune_type_id == tune_type_id,
                )
            )
            .mappings()
            .first()
        )
        if not row_current:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Association not found",
            )
        db.execute(
            delete(t_genre_tune_type).where(
                t_genre_tune_type.c.genre_id == genre_id,
                t_genre_tune_type.c.tune_type_id == tune_type_id,
            )
        )
        db.commit()


@router.get(
    "/tune_types/{genre_id}",
    response_model=List[TuneTypeModel],
    summary="Get TuneTypes by Genre",
    description="Retrieve a list of TuneTypes associated with a specific Genre ID",
    status_code=status.HTTP_200_OK,
)
async def get_tune_types_by_genre(genre_id: str):
    with SessionLocal() as db:
        tune_types = (
            db.query(TuneType)
            .join(t_genre_tune_type, TuneType.id == t_genre_tune_type.c.tune_type_id)
            .filter(t_genre_tune_type.c.genre_id == genre_id)
            .all()
        )
        if not tune_types:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No TuneTypes found for the given Genre ID",
            )
        return [TuneTypeModel.model_validate(tune_type) for tune_type in tune_types]
