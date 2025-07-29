import logging
import os
import sys

from uvicorn.config import LOGGING_CONFIG

from tunetrees.api.reload_trigger import reload_trigger_func

log_level: str = os.getenv("LOGLEVEL", "INFO").upper()

# Configure the root logger
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)

logger: logging.Logger = logging.getLogger()
logger.setLevel(getattr(logging, log_level, logging.INFO))

LOGGING_CONFIG["loggers"]["uvicorn"]["level"] = "DEBUG"
LOGGING_CONFIG["handlers"]["default"]["stream"] = sys.stdout

logger.info(f"Starting TuneTrees API, log level set to {log_level}")
logger.debug("(test debug message)")

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

logger.debug("(tunetrees/api/main.py (26): test debug message)")

import tunetrees.api.auth as auth  # noqa: E402
import tunetrees.api.tunetrees as tunetrees_api  # noqa: E402
from tunetrees.api import settings  # noqa: E402
from tunetrees.api.preferences import preferences_router  # noqa: E402

logger.debug("(tunetrees/api/main.py (31): test debug message)")

tags_metadata = [
    {
        "name": "auth",
        "description": "Operations for authentication and user management, designed to be "
        "used by the frontend auth.js/nextauth adapter.",
    },
    {
        "name": "tunetrees",
        "description": "Core TuneTrees operations relating to scheduling, repertoire, and overall tunes db management.",
    },
    {
        "name": "settings",
        "description": "UI state and settings, such as column state.  These are meant to be used by the frontend, "
        "to persist state between sessions and devices.  There may be a fuzzy decision between these records and "
        "what should be directly stored in the user records.",
    },
    {
        "name": "preferences",
        "description": "User preferences, such as spaced repetition settings.",
    },
]

# PLEASE DON'T REMOVE THIS COMMENTED OUT CODE
# class CustomASGIMiddleware(BaseHTTPMiddleware):
#     async def dispatch(self, request: Request, call_next):
#         # Intercept the request here
#         print("Request intercepted in ASGI middleware")
#         response = await call_next(request)
#         return response


app = FastAPI(debug=True, openapi_tags=tags_metadata)

# PLEASE DON'T REMOVE THIS COMMENTED OUT CODE
# app.add_middleware(CustomASGIMiddleware)


# PLEASE DON'T REMOVE THIS COMMENTED OUT CODE
# @app.middleware("http")
# async def add_process_time_header(
#     request: Request, call_next: Callable[[Request], Awaitable[Response]]
# ) -> Response:
#     response = await call_next(request)
#     response.headers["Content-Type"] = "application/json; charset=utf-8"
#     return response


# This is an uber hacky way to enable the FastAPI server to reload,
# when it was started with --reload.
# CoPilot does not approve.  But I think it's massively simpler
# for testing purposes than trying to make the signal handling work,
# and keep vscode running in my vscode window.
# Hopefully this will be replaced with a more robust solution down the road.
reload_trigger_func()

app.include_router(auth.router)
app.include_router(tunetrees_api.router)
app.include_router(settings.settings_router)
app.include_router(preferences_router)

app.include_router(auth.router)

logger.debug("(tunetrees/api/main.py (65): test debug message)")


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and testing"""
    return {
        "status": "healthy",
        "service": "tunetrees-api",
        "version": "1.0.0",
        "message": "TuneTrees API is running"
    }


@app.get("/hello/{name}")
async def say_hello(name: str):
    logger.debug(f"(tunetrees/api/main.py (75): say_hello {name} invoked!)")
    print(f"printing: (tunetrees/api/main.py (76): say_hello {name} invoked!)")
    sys.stdout.flush()
    return {"message": f"Hello {name}! Welcome to TuneTrees!"}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

auth.register_exception(app)

logger.debug("(tunetrees/api/main.py (88): test debug message)")
