from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import tunetrees.api.auth as auth
import tunetrees.api.tunetrees as tunetrees_api
from tunetrees.api import settings

tags_metadata = [
    {
        "name": "auth",
        "description": "Operations for authentication and user management, designed to be "
        "used by the frontend auth.js/nextauth adapter.",
    },
    {
        "name": "tunetrees",
        "description": "Core TuneTrees operations relating to practice, scheduling, and repertoire management.",
    },
    {
        "name": "settings",
        "description": "UI state and settings, such as column state.  These are meant to be used by the frontend, "
        "to persist state between sessions and devices.  There may be a fuzzy decision between these records and "
        "what should be directly stored in the user records.",
    },
]

app = FastAPI(debug=True, openapi_tags=tags_metadata)

app.include_router(auth.router)
app.include_router(tunetrees_api.router)
app.include_router(settings.settings_router)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}! Welcome to TuneTrees!"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

auth.register_exception(app)
