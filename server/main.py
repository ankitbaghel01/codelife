"""CodeLife interview API. Run from the project root:

python -m uvicorn server.main:app --port 8000
"""

import logging
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import ai as ai_mod
from . import db, executor as executor_mod, interview

logging.basicConfig(level=logging.INFO)


class Services:  # swapped out in tests
    ai = ai_mod.from_env()
    executor = executor_mod.from_env()


@asynccontextmanager
async def lifespan(app):
    db.init()
    logging.getLogger("codelife").info(
        "AI provider: %s, executor: %s", Services.ai.name, Services.executor.name
    )
    if Services.executor.name == "dev-subprocess":
        logging.getLogger("codelife").warning(
            "Executor is DEV ONLY (local subprocess, not a sandbox). Set JUDGE0_URL for real use."
        )
    yield


app = FastAPI(title="CodeLife API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://{h}:{p}" for h in ("localhost", "127.0.0.1") for p in (5173, 5179)
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Player-Id"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(x) for x in first.get("loc", []) if x != "body")
    return JSONResponse(
        status_code=422,
        content={
            "detail": f"Invalid {where or 'request'}: {first.get('msg', 'bad input')}"
        },
    )


Str = lambda n: Annotated[str, Field(max_length=n)]  # noqa: E731


class Skill(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=40)]
    proficiency: Annotated[float, Field(ge=0, le=100)]
    source: Literal["start", "claimed"]


class Project(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=80)]
    description: Str(500) = ""


class Resume(BaseModel):
    summary: Str(1000) = ""
    projects: Annotated[list[Project], Field(max_length=10)] = []


class PlayerProfile(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=60)]
    skills: Annotated[list[Skill], Field(max_length=30)]
    resume: Resume


class CreateBody(BaseModel):
    playerId: Annotated[str, Field(min_length=1, max_length=64)]
    companyId: Str(64)
    roleId: Str(64)
    profile: PlayerProfile


class AnswerBody(BaseModel):
    text: Str(2000)


class CodeBody(BaseModel):
    questionId: Str(16)
    code: Annotated[str, Field(max_length=20_000)]


def get_con():
    con = db.connect()
    try:
        with con:  # commit on success, roll back on any error
            yield con
    finally:
        con.close()


def owned(
    iid: str, x_player_id: Annotated[str, Header(max_length=64)], con=Depends(get_con)
):
    """Every /interviews/{id} call must come from the player who created it."""
    iv = interview.load(con, iid)
    if iv["player_id"] != x_player_id:
        raise HTTPException(403, "This interview belongs to another player")
    return con


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "aiProvider": Services.ai.name,
        "executor": Services.executor.name,
    }


@app.post("/api/interviews")
def create(body: CreateBody, con=Depends(get_con)):
    iid = interview.create(
        con,
        Services.ai,
        body.playerId,
        body.companyId,
        body.roleId,
        body.profile.model_dump(),
    )
    return interview.view(con, iid, Services.ai.name)


@app.get("/api/interviews/{iid}")
def get(iid: str, con=Depends(owned)):
    return interview.view(con, iid, Services.ai.name)


@app.post("/api/interviews/{iid}/answer")
def answer(iid: str, body: AnswerBody, con=Depends(owned)):
    interview.answer(con, Services.ai, iid, body.text)
    return interview.view(con, iid, Services.ai.name)


@app.post("/api/interviews/{iid}/run")
def run(iid: str, body: CodeBody, con=Depends(owned)):
    return interview.run(con, Services.executor, iid, body.questionId, body.code)


@app.post("/api/interviews/{iid}/submit")
def submit(iid: str, body: CodeBody, con=Depends(owned)):
    result = interview.submit(
        con, Services.ai, Services.executor, iid, body.questionId, body.code
    )
    return {"result": result, "interview": interview.view(con, iid, Services.ai.name)}


@app.post("/api/interviews/{iid}/finish")
def finish(iid: str, con=Depends(owned)):
    return interview.finish(con, iid)


@app.get("/api/interviews/{iid}/report")
def report(iid: str, con=Depends(owned)):
    return interview.report(con, iid)
