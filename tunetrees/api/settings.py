import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Body, HTTPException, Path
from pydantic import BaseModel
from starlette import status as status

from tunetrees.app.database import SessionLocal
from tunetrees.models.tunetrees import TabGroupMainState, TableState, TableTransientData
from tunetrees.models.tunetrees_pydantic import (
    PurposeEnum,
    ScreenSizeEnum,
    TabGroupMainStateModel,
    TabGroupMainStateModelPartial,
    TableStateModel,
    TableStateModelPartial,
    TableTransientDataModel,
)

# TODO: Rename this route to "states" instead of "settings"

logger = logging.getLogger(__name__)

settings_router = APIRouter(prefix="/settings", tags=["settings"])


@settings_router.get(
    "/table_state/{user_id}/{playlist_id}/{screen_size}/{purpose}",
    response_model=TableStateModel | None,
    summary="Get Table State",
    description="Retrieve the stored datagrid table state for a user, for a specific screen size and purpose.",
    status_code=status.HTTP_200_OK,
)
def get_table_state(
    user_id: int = Path(..., description="User ID"),
    playlist_id: int = Path(..., description="Playlist ID"),
    screen_size: ScreenSizeEnum = Path(..., description="Screen size"),
    purpose: PurposeEnum = Path(..., description="Purpose"),
) -> TableStateModel:
    try:
        with SessionLocal() as db:
            table_state = (
                db.query(TableState)
                .filter_by(
                    user_id=user_id,
                    screen_size=screen_size,
                    purpose=purpose,
                    playlist_id=playlist_id,
                )
                .first()
            )
            return table_state
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unable to fetch table state: {e}")
        raise HTTPException(status_code=500, detail="Unable to fetch table state")


@settings_router.post(
    "/table_state",
    response_model=TableStateModel,
    summary="Create Table State",
    description="Create a new datagrid table state for a user, for a specific screen size and purpose.",
    status_code=status.HTTP_201_CREATED,
)
def create_table_state(table_state: TableStateModel) -> TableStateModel:
    try:
        TableStateModel.model_validate(table_state)
        with SessionLocal() as db:
            new_table_state = TableState(
                user_id=table_state.user_id,
                screen_size=table_state.screen_size,
                purpose=table_state.purpose,
                settings=table_state.settings,
                current_tune=table_state.current_tune,
                playlist_id=table_state.playlist_id,
            )
            db.add(new_table_state)
            db.commit()
            db.refresh(new_table_state)
            return new_table_state
    except Exception as e:
        logger.error(f"Unable to create table state: {e}")
        raise HTTPException(status_code=500, detail="Unable to create table state")


@settings_router.patch(
    "/table_state/{user_id}/{playlist_id}/{screen_size}/{purpose}",
    response_model=TableStateModel,
    summary="Update Table State",
    description="Update an existing datagrid table state for a user, for a specific screen size and purpose.",
    status_code=status.HTTP_200_OK,
)
def update_table_state(
    user_id: int = Path(..., description="User ID"),
    playlist_id: int = Path(..., description="Playlist ID"),
    screen_size: ScreenSizeEnum = Path(..., description="Screen size"),
    purpose: PurposeEnum = Path(..., description="Purpose"),
    table_state_update: TableStateModelPartial = Body(...),
) -> TableStateModel:
    try:
        with SessionLocal() as db:
            table_state = (
                db.query(TableState)
                .filter_by(
                    user_id=user_id,
                    screen_size=screen_size,
                    purpose=purpose,
                    playlist_id=playlist_id,
                )
                .first()
            )
            if not table_state:
                raise HTTPException(status_code=404, detail="Table state not found")

            update_data = table_state_update.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(table_state, key, value)

            db.commit()
            db.refresh(table_state)
            return table_state
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unable to update table state: {e}")
        raise HTTPException(status_code=500, detail="Unable to update table state")


@settings_router.delete(
    "/table_state/{user_id}/{playlist_id}/{screen_size}/{purpose}",
    summary="Delete Table State",
    description="Delete an existing datagrid table state for a user, for a specific screen size and purpose.",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_table_state(
    user_id: int = Path(..., description="User ID"),
    playlist_id: int = Path(..., description="Playlist ID"),
    screen_size: ScreenSizeEnum = Path(..., description="Screen size"),
    purpose: PurposeEnum = Path(..., description="Purpose"),
) -> None:
    try:
        with SessionLocal() as db:
            table_state = (
                db.query(TableState)
                .filter_by(
                    user_id=user_id,
                    screen_size=screen_size,
                    purpose=purpose,
                    playlist_id=playlist_id,
                )
                .first()
            )
            if not table_state:
                raise HTTPException(status_code=404, detail="Table state not found")

        db.delete(table_state)
        db.commit()
        return
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unable to delete table state: {e}")
        raise HTTPException(status_code=500, detail="Unable to delete table state")


# @settings_router.get(
#     "/table_state/{user_id}/{screen_size}/{purpose}",
#     response_model=TableStateResponse,
#     summary="Retrieve the stored datagrid table state for a user, for a specific screen size and purpose",
#     description="Retrieve the column setting with specific configurations. The "
#     "column setting entries correspond to the columns in the practice_list_joined view.",
#     status_code=status.HTTP_200_OK,
# )
# def get_table_states(
#     user_id: Annotated[
#         int,
#         Path(
#             description="Should be a valid user id that corresponds to a user in the user table",
#         ),
#     ],
#     screen_size: Annotated[
#         str,
#         Path(
#             enum_values=["small", "full"],
#             description="Associated screen size, one of 'small' or 'full'",
#         ),
#     ],
#     purpose: Annotated[
#         str,
#         Path(
#             enum_values=["practice", "repertoire", "suggestions"],
#             description="Associated purpose, one of 'practice', 'repertoire', or 'suggestions'",
#         ),
#     ],
# ) -> TableStateResponse:
#     with SessionLocal() as db:
#         try:
#             table_state: TableState | None = (
#                 db.query(TableState)
#                 .filter_by(user_id=user_id, screen_size=screen_size, purpose=purpose)
#                 .first()
#             )

#             if not table_state:
#                 raise HTTPException(status_code=404, detail="Column setting not found")

#             return TableStateResponse.model_validate(table_state)
#         except HTTPException as e:
#             if e.status_code == 404:
#                 logging.getLogger().warning(
#                     "table state Not Found (get_table_state(%s, %s, %s))",
#                     user_id,
#                     screen_size,
#                     purpose,
#                 )
#             else:
#                 logging.getLogger().error("HTTPException (secondary catch): %s" % e)
#             raise
#         except Exception as e:
#             logging.getLogger().error("Unknown error: %s" % e)
#             raise HTTPException(status_code=500, detail="Unknown error occurred")


class TableTransientDataFields(BaseModel):
    recall_eval: Optional[str]


@settings_router.post(
    "/table_transient_data/{user_id}/{tune_id}/{playlist_id}/{purpose}",
    summary="Create or update new table transient data entry",
    description="Create a new entry or update existing in the table_transient_data table",
    status_code=status.HTTP_201_CREATED,
)
def stage_table_transient_data(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table",
        ),
    ],
    tune_id: Annotated[
        int,
        Path(
            description="The tune id that corresponds to a tune data being staged",
        ),
    ],
    playlist_id: Annotated[
        int,
        Path(
            description="The playlist id that corresponds to a tune data being staged",
        ),
    ],
    purpose: Annotated[
        str,
        Path(
            enum_values=["practice", "repertoire", "all," "analysis"],
            description="Associated purpose, one of 'practice', 'repertoire', 'all', or 'analysis'",
        ),
    ],
    field_data: TableTransientDataFields = Body(...),
) -> dict[str, str | int]:
    with SessionLocal() as db:
        try:
            table_transient_data_queried: TableTransientData | None = (
                db.query(TableTransientData)
                .filter_by(
                    user_id=user_id,
                    tune_id=tune_id,
                    playlist_id=playlist_id,
                    purpose=purpose,
                )
                .first()
            )

            if not table_transient_data_queried:
                table_transient_data = TableTransientData(
                    user_id=user_id,
                    tune_id=tune_id,
                    playlist_id=playlist_id,
                    purpose=purpose,
                    recall_eval=field_data.recall_eval,
                )
                db.add(table_transient_data)
                db.commit()
                db.refresh(table_transient_data)

                return {"status": "success", "code": 201}
            else:
                table_transient_data_queried.user_id = user_id
                table_transient_data_queried.tune_id = tune_id
                table_transient_data_queried.playlist_id = playlist_id
                table_transient_data_queried.purpose = purpose
                table_transient_data_queried.recall_eval = field_data.recall_eval

                db.commit()
                db.refresh(table_transient_data_queried)

                return {"status": "success", "code": 200}
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")


@settings_router.get(
    "/table_transient_data/{user_id}/{tune_id}/{playlist_id}/{purpose}",
    summary="Retrieve a table transient data entry",
    description="Retrieve an entry from the table_transient_data table",
    status_code=status.HTTP_200_OK,
    response_model=TableTransientDataModel,
)
def get_table_transient_data(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table",
        ),
    ],
    tune_id: Annotated[
        int,
        Path(
            description="The tune id that corresponds to a tune data being staged",
        ),
    ],
    playlist_id: Annotated[
        int,
        Path(
            description="The playlist id that corresponds to a tune data being staged",
        ),
    ],
    purpose: Annotated[
        str,
        Path(
            enum_values=["practice", "repertoire", "catalog" "anylysis"],
            description="Associated purpose, one of 'practice', 'repertoire', 'all', or 'anylysis'",
        ),
    ],
) -> TableTransientDataModel:
    with SessionLocal() as db:
        try:
            table_transient_data: TableTransientData | None = (
                db.query(TableTransientData)
                .filter_by(
                    user_id=user_id,
                    tune_id=tune_id,
                    playlist_id=playlist_id,
                    purpose=purpose,
                )
                .first()
            )

            if not table_transient_data:
                raise HTTPException(
                    status_code=404, detail="Table transient data not found"
                )
            table_transient_data_pydantic: TableTransientDataModel = (
                TableTransientDataModel.model_validate(table_transient_data)
            )
            return table_transient_data_pydantic
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")


@settings_router.delete(
    "/table_transient_data/{user_id}/{tune_id}/{playlist_id}/{purpose}",
    summary="Delete a table transient data entry",
    description="Delete an entry from the table_transient_data table",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_table_transient_data(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table",
        ),
    ],
    tune_id: Annotated[
        int,
        Path(
            description="The tune id that corresponds to a tune data being staged, use -1 for all tunes",
        ),
    ],
    playlist_id: Annotated[
        int,
        Path(
            description="The playlist id that corresponds to a tune data being staged",
        ),
    ],
    purpose: Annotated[
        str,
        Path(
            enum_values=["practice", "repertoire", "catalog", "analysis"],
            description="Associated purpose, one of 'practice', 'repertoire', 'all', or 'analysis'",
        ),
    ],
) -> None:
    with SessionLocal() as db:
        try:
            if tune_id == -1:
                db.query(TableTransientData).filter_by(
                    user_id=user_id,
                    playlist_id=playlist_id,
                    purpose=purpose,
                ).delete()
            else:
                table_transient_data = (
                    db.query(TableTransientData)
                    .filter_by(
                        user_id=user_id,
                        tune_id=tune_id,
                        playlist_id=playlist_id,
                        purpose=purpose,
                    )
                    .first()
                )

                if not table_transient_data:
                    raise HTTPException(
                        status_code=404, detail="Table transient data not found"
                    )

                db.delete(table_transient_data)

            db.commit()
            # return {"status": "success", "code": 204}
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")


@settings_router.get(
    "/tab_group_main_state/{user_id}",
    response_model=TabGroupMainStateModel | None,
    summary="Retrieve the tab group main state for a user",
    description="Retrieve the tab group main state for a user, which indicates the currently active tab.",
    status_code=status.HTTP_200_OK,
)
def get_tab_group_main_state(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table"
        ),
    ],
):
    with SessionLocal() as db:
        try:
            tab_group_main_state = (
                db.query(TabGroupMainState).filter_by(user_id=user_id).first()
            )
            return tab_group_main_state
            # return tab_group_main_state
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")


@settings_router.post(
    "/tab_group_main_state",
    response_model=TabGroupMainStateModel,
    summary="Create a new tab group main state for a user",
    description="Create a new tab group main state for a user, which indicates the currently active tab.",
    status_code=status.HTTP_201_CREATED,
)
def create_tab_group_main_state(
    tab_group_main_state: TabGroupMainStateModelPartial = Body(...),
):
    with SessionLocal() as db:
        try:
            new_tab_group_main_state = TabGroupMainState(
                user_id=tab_group_main_state.user_id,
                which_tab=tab_group_main_state.which_tab,
                playlist_id=tab_group_main_state.playlist_id,
            )
            if tab_group_main_state.tab_spec is not None:
                new_tab_group_main_state.tab_spec = tab_group_main_state.tab_spec
            db.add(new_tab_group_main_state)
            db.commit()
            db.refresh(new_tab_group_main_state)
            tab_group_main_state_from_db = (
                db.query(TabGroupMainState)
                .filter_by(user_id=tab_group_main_state.user_id)
                .first()
            )

            return tab_group_main_state_from_db
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")


@settings_router.patch(
    "/tab_group_main_state/{user_id}",
    response_model=TabGroupMainStateModel,
    summary="Update the tab group main state for a user",
    description="Update the tab group main state for a user, which indicates the currently active tab.",
    status_code=status.HTTP_200_OK,
)
def update_tab_group_main_state(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table"
        ),
    ],
    tab_group_main_state: TabGroupMainStateModelPartial = Body(...),
):
    with SessionLocal() as db:
        try:
            existing_tab_group_main_state = (
                db.query(TabGroupMainState).filter_by(user_id=user_id).first()
            )
            if not existing_tab_group_main_state:
                raise HTTPException(
                    status_code=404, detail="Tab group main state not found"
                )

            update_data = tab_group_main_state.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(existing_tab_group_main_state, key, value)

            db.commit()
            db.refresh(existing_tab_group_main_state)
            return existing_tab_group_main_state
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")


@settings_router.delete(
    "/tab_group_main_state/{user_id}",
    summary="Delete the tab group main state for a user",
    description="Delete the tab group main state for a user, which indicates the currently active tab.",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_tab_group_main_state(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table"
        ),
    ],
) -> None:
    with SessionLocal() as db:
        try:
            tab_group_main_state = (
                db.query(TabGroupMainState).filter_by(user_id=user_id).first()
            )
            if not tab_group_main_state:
                raise HTTPException(
                    status_code=404, detail="Tab group main state not found"
                )

            db.delete(tab_group_main_state)
            db.commit()
            # return {"status": "success", "code": 204}
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")
