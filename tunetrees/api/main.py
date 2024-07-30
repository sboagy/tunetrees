from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import tunetrees.api.auth as auth
import tunetrees.api.tunetrees as tunetrees_api

app = FastAPI()

app.include_router(auth.router)
app.include_router(tunetrees_api.router)


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
