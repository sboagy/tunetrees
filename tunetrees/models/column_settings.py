from pydantic import BaseModel


class ColumnConfig(BaseModel):
    sort_direction: str | None = None
    visible: bool = False
    enabled: bool = True


class ColumnSettingsModel(BaseModel):
    id: ColumnConfig
    title: ColumnConfig
    type: ColumnConfig
    structure: ColumnConfig
    mode: ColumnConfig
    incipit: ColumnConfig
    learned: ColumnConfig
    practiced: ColumnConfig
    quality: ColumnConfig
    easiness: ColumnConfig
    interval: ColumnConfig
    repetitions: ColumnConfig
    review_date: ColumnConfig
    backup_practiced: ColumnConfig
    external_ref: ColumnConfig
    note_private: ColumnConfig
    note_public: ColumnConfig
    tags: ColumnConfig
    recallEval: ColumnConfig


column_settings_example_data = {
    "id": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "title": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "type": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "structure": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "mode": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "incipit": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "learned": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "practiced": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "quality": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "easiness": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "interval": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "repetitions": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "review_date": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "backup_practiced": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "external_ref": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "note_private": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "note_public": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "tags": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
    "recallEval": {
        "sort_direction": None,
        "visible": False,
        "enabled": True,
    },
}
