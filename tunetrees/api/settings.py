import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Body, HTTPException, Path
from starlette import status as status

from tunetrees.app.database import SessionLocal
from tunetrees.models.tunetrees import TabGroupMainState, TableState, TableTransientData
from pydantic import BaseModel
from tunetrees.models.tunetrees_pydantic import (
    TableTransientDataModel as TableTransientDataModelPydantic,
)

# TODO: Rename this route to "states" instead of "settings"

settings_router = APIRouter(prefix="/settings", tags=["settings"])


@settings_router.post(
    "/table_state/{user_id}/{screen_size}/{purpose}",
    summary="Create a new datagrid table state for a user, for a specific screen size and purpose",
    description="Create a new column setting with specific configurations.  The "
    "column setting entries correspond to the columns in the practice_list_joined view.  Each time the "
    "user changes a column setting, it should be reflected in this table, so the settings can "
    "be persisted between sessions and devices.",
    status_code=status.HTTP_201_CREATED,
)
def create_table_state(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table",
        ),
    ],
    screen_size: Annotated[
        str,
        Path(
            enum_values=["small", "full"],
            description="Associated screen size, one of 'small' or 'full'",
        ),
    ],
    purpose: Annotated[
        str,
        Path(
            enum_values=["practice", "repertoire", "suggestions"],
            description="Associated purpose, one of 'practice', 'repertoire', or 'suggestions'",
        ),
    ],
    settings: str = Body(...),
) -> dict[str, str | int]:
    with SessionLocal() as db:
        try:
            table_state = TableState(
                user_id=user_id,
                screen_size=screen_size,
                purpose=purpose,
                settings=settings,
            )
            db.add(table_state)
            db.commit()
            db.refresh(table_state)
            return {"status": "success", "code": 201}
        except HTTPException as e:
            if e.status_code == 404:
                logging.getLogger().warning(
                    "table state Not Found (create_table_state(%s, %s, %s))",
                    user_id,
                    screen_size,
                    purpose,
                )
            else:
                logging.getLogger().error("HTTPException (secondary catch): %s" % e)
            raise
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occured")


@settings_router.put(
    "/table_state/{user_id}/{screen_size}/{purpose}",
    summary="Update a datagrid table state for a user, for a specific screen size and purpose",
    description="Update a column setting.  The "
    "column setting entries correspond to the columns in the practice_list_joined view.  Each time the "
    "user changes a column setting, it should be reflected in this table, so the settings can "
    "be persisted between sessions and devices.",
    status_code=status.HTTP_204_NO_CONTENT,
)
def update_table_state(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table",
        ),
    ],
    screen_size: Annotated[
        str,
        Path(
            enum_values=["small", "full"],
            description="Associated screen size, one of 'small' or 'full'",
        ),
    ],
    purpose: Annotated[
        str,
        Path(
            enum_values=["practice", "repertoire", "suggestions"],
            description="Associated purpose, one of 'practice', 'repertoire', or 'suggestions'",
        ),
    ],
    settings: str,
) -> None:
    with SessionLocal() as db:
        try:
            table_state = TableState(
                user_id=user_id,
                screen_size=screen_size,
                purpose=purpose,
                settings=settings,
            )
            existing_table_state = (
                db.query(TableState)
                .filter_by(user_id=user_id, screen_size=screen_size, purpose=purpose)
                .first()
            )

            if not existing_table_state:
                raise HTTPException(status_code=404, detail="Column setting not found")

            existing_table_state.settings = table_state.settings
            db.commit()
            db.refresh(existing_table_state)
            # return {"status": "success", "code": 204}
        except HTTPException as e:
            if e.status_code == 404:
                logging.getLogger().warning(
                    "table state Not Found (update_table_state(%s, %s, %s))",
                    user_id,
                    screen_size,
                    purpose,
                )
            else:
                logging.getLogger().error("HTTPException (secondary catch): %s" % e)
            raise
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occured")


@settings_router.get(
    "/table_state/{user_id}/{screen_size}/{purpose}",
    summary="Retrieve the stored datagrid table state for a user, for a specific screen size and purpose",
    description="Retrieve the column setting with specific configurations.  The "
    "column setting entries correspond to the columns in the practice_list_joined view.",
    status_code=status.HTTP_200_OK,
)
def get_table_states(
    user_id: Annotated[
        int,
        Path(
            description="Should be a valid user id that corresponds to a user in the user table",
        ),
    ],
    screen_size: Annotated[
        str,
        Path(
            enum_values=["small", "full"],
            description="Associated screen size, one of 'small' or 'full'",
        ),
    ],
    purpose: Annotated[
        str,
        Path(
            enum_values=["practice", "repertoire", "suggestions"],
            description="Associated purpose, one of 'practice', 'repertoire', or 'suggestions'",
        ),
    ],
) -> str:
    with SessionLocal() as db:
        try:
            table_state: TableState | None = (
                db.query(TableState)
                .filter_by(user_id=user_id, screen_size=screen_size, purpose=purpose)
                .first()
            )

            if not table_state:
                raise HTTPException(status_code=404, detail="Column setting not found")

            return table_state.settings
        except HTTPException as e:
            if e.status_code == 404:
                logging.getLogger().warning(
                    "table state Not Found (get_table_state(%s, %s, %s))",
                    user_id,
                    screen_size,
                    purpose,
                )
            else:
                logging.getLogger().error("HTTPException (secondary catch): %s" % e)
            raise
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occured")


class TableTransientDataFields(BaseModel):
    note_private: Optional[str]
    note_public: Optional[str]
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
            enum_values=["practice", "repertoire", "suggestions"],
            description="Associated purpose, one of 'practice', 'repertoire', or 'suggestions'",
        ),
    ],
    field_data: TableTransientDataFields = Body(...),
) -> dict[str, str | int]:
    with SessionLocal() as db:
        try:
            table_transient_data = TableTransientData(
                user_id=user_id,
                tune_id=tune_id,
                playlist_id=playlist_id,
                purpose=purpose,
                note_private=field_data.note_private,
                note_public=field_data.note_public,
                recall_eval=field_data.recall_eval,
            )
            db.add(table_transient_data)
            db.commit()
            db.refresh(table_transient_data)
            return {"status": "success", "code": 201}
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")


@settings_router.get(
    "/table_transient_data/{user_id}/{tune_id}/{playlist_id}/{purpose}",
    summary="Retrieve a table transient data entry",
    description="Retrieve an entry from the table_transient_data table",
    status_code=status.HTTP_200_OK,
    response_model=TableTransientDataModelPydantic,
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
            enum_values=["practice", "repertoire", "suggestions"],
            description="Associated purpose, one of 'practice', 'repertoire', or 'suggestions'",
        ),
    ],
) -> TableTransientDataModelPydantic:
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
            table_transient_data_pydantic: TableTransientDataModelPydantic = (
                TableTransientDataModelPydantic.model_validate(table_transient_data)
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
            enum_values=["practice", "repertoire", "suggestions"],
            description="Associated purpose, one of 'practice', 'repertoire', or 'suggestions'",
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


class TabGroupMainStateModel(BaseModel):
    user_id: int
    which_tab: str

    class Config:
        orm_mode = True


@settings_router.get(
    "/tab_group_main_state/{user_id}",
    response_model=TabGroupMainStateModel,
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
            if not tab_group_main_state:
                raise HTTPException(
                    status_code=404, detail="Tab group main state not found"
                )
            return tab_group_main_state
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
    tab_group_main_state: TabGroupMainStateModel,
):
    with SessionLocal() as db:
        try:
            new_tab_group_main_state = TabGroupMainState(
                user_id=tab_group_main_state.user_id,
                which_tab=tab_group_main_state.which_tab,
            )
            db.add(new_tab_group_main_state)
            db.commit()
            db.refresh(new_tab_group_main_state)
            return new_tab_group_main_state
        except Exception as e:
            logging.getLogger().error("Unknown error: %s" % e)
            raise HTTPException(status_code=500, detail="Unknown error occurred")


@settings_router.put(
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
    tab_group_main_state: TabGroupMainStateModel,
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

            existing_tab_group_main_state.which_tab = tab_group_main_state.which_tab
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
