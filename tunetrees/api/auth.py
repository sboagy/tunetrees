# This is the HTTP interface for the "next-auth-http-adapter", see
# https://github.com/mabdullahadeel/next-auth-http-adapter/blob/master/src/validation.ts
# Note it has to transform from our SQLAlchemy ORM/Schema to the schema that nextauth
# likes, which we define here via Pydantic.

import logging
import traceback
from typing import Any, Optional, Tuple

from fastapi import APIRouter, Body, FastAPI, HTTPException, Path, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import Result, Row, Select, select
from sqlalchemy.orm.session import Session as SqlAlchemySession

from tunetrees.app.database import SessionLocal
from tunetrees.models import tunetrees as orm
from tunetrees.models.tunetrees_pydantic import (
    AccountModel,
    AccountType,
    SessionAndUserModel,
    SessionModel,
    UserModel,
    UserModelPartial,
    VerificationTokenModel,
    VerificationTokenParamsModel,
)


class StatusCode(object):
    success = 10000

    bad_request = 40000
    unauthorized = 40100
    forbidden = 40300
    not_found = 40400
    method_not_allowed = 40500
    not_acceptable = 40600
    request_timeout = 40800
    length_required = 41100
    entity_too_large = 41300
    request_uri_too_long = 41400
    validator_error = 42200
    locked = 42300
    header_fields_too_large = 43100

    server_error = 45000
    unknown_error = 45001


# from tunetrees.app.database import SessionLocal

# import models as orm

logger = logging.getLogger("auth")

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


# pyright: reportUnusedFunction=false
def register_exception(app: FastAPI):
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        """catch FastAPI RequestValidationError"""

        exc_str = f"{exc}".replace("\n", " ").replace("   ", " ")
        logger.error("%s %s %s", request.method, request.url, exc)
        # content = exc.errors()
        content = {"code": StatusCode.validator_error, "message": exc_str, "data": None}
        return JSONResponse(
            content=content, status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
        )

    @app.exception_handler(Exception)
    async def exception_handle(request: Request, exc: Exception):
        """catch other exception"""

        logger.error(request.method, request.url, traceback.format_exc())
        content = {"code": StatusCode.server_error, "message": str(exc), "data": None}
        return JSONResponse(
            content=content, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# id
# userId
# type
# provider
# providerAccountId
# refresh_token
# access_token
# expires_at
# token_type
# scope
# id_token
# session_state

# access_token ='ya29.a0AcM612wD4MjR6munqu8g8SdapPhmtwOB_XsqtoSxgPA3axEB8ZsNFNWbVCneRZp5zcC92ADy1dc_psLUlkG8X6hn89ggrpWBV17hqlbZwY3ZnyIv5RDCz4IcbLMcOVBKykpbPWyUGjK6xBgArpRYHFfMga7R8P8ypwaCgYKAZESARMSFQHGX2MiPNko26CctBnKmsxM_CTMqQ0169'
# expires_at =1722822259
# id_token ='eyJhbGciOiJSUzI1NiIsImtpZCI6IjQ1MjljNDA5Zjc3YTEwNmZiNjdlZTFhODVkMTY4ZmQyY2ZiN2MwYjciLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiIxODI0MTYyMDI4NjktcmJzYWMzY2VqdG80OGxzMmg5dXEwdW02NWJhY2k3bHUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiIxODI0MTYyMDI4NjktcmJzYWMzY2VqdG80OGxzMmg5dXEwdW02NWJhY2k3bHUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDIzMzI1MTY2NjgyOTQxODI0MjIiLCJlbWFpbCI6InNib2FneUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiYXRfaGFzaCI6IjJUaUpOU0Jn…EtmWUNfQlNzb25xU3I4TXZsck1XOTdINF91MEQ0aDZ3PXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6IlNjb3R0IiwiZmFtaWx5X25hbWUiOiJCb2FnIiwiaWF0IjoxNzIyODE4NjYwLCJleHAiOjE3MjI4MjIyNjB9.gyhZJD_djSQpNd6y4qr0iJMAjjfAb9AgoD64biBQXz_KSZbhL0iU2V6q2fSGks6kjFNSky5fEls3Vbi77hz9Ivq4cHkzsDC0NOqRwZUI4p8FiTFKFA5SuNVMHcKB00vav-htmL4cqUIQ4uAIgSNuKCFn8ivYLLXjAe-jAw6CQnVXI8cNyffsQHkWXG4-YKRvE2UJRrwtEiXVKUWIamdYyVl9AGkV-h5YZJxwxcUcEmr99tzsYbBBRXF4HPd7O0RyvC3Lrn5T4my2XfCY8cGhcXEL9PdJcR19_k2t8R4jzUT3jkomRiwvE9mrGs0PH6y5vHDZWjlfWE339TAieXZSrg'
# provider ='google'
# providerAccountId ='102332516668294182422'
# scope ='https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid'
# token_type ='bearer'
# type ='oidc'
# userId ='15'


@router.post(
    "/signup/", response_model=Optional[UserModel], response_model_exclude_none=True
)
async def create_user(user: UserModel) -> Optional[UserModel]:
    try:
        with SessionLocal() as db:
            orm_user = orm.User(
                # id=user.name,  # The DB will need to set this
                name=user.name,
                email=user.email,
                email_verified=user.email_verified,
                image=user.image,
                hash=user.hash,
            )

            db.add(orm_user)

            # We won't have an ID until the DB does it's thing.
            db.commit()
            db.flush(orm_user)

            # For right now, query the user again just to make sure the update was applied.
            # We might want to not do this in the future.
            user_query = select(orm.User).where(orm.User.email == orm_user.email)
            updated_user = query_user_to_auth_user(user_query, db)

            return updated_user

    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.get(
    "/get-user/{id}",
    response_model=Optional[UserModel],
    response_model_exclude_none=True,
)
async def get_user(id: str) -> Optional[UserModel]:
    try:
        stmt = select(orm.User).where(orm.User.id == id)
        auth_user = query_user_to_auth_user(stmt)
        return auth_user
    except HTTPException as e:
        if e.status_code == 404:
            logger.warning(
                "User Not Found (get_user(%s))",
                id,
            )
        else:
            logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.get(
    "/get-user-by-email/{email}",
    response_model=Optional[UserModel],
    response_model_exclude_none=True,
)
async def get_user_by_email(email: str) -> Optional[UserModel]:
    try:
        stmt = select(orm.User).where(orm.User.email == email)
        auth_user = query_user_to_auth_user(stmt)
        logger.info(f"get_user_by_email {auth_user=}")
        return auth_user
    except HTTPException as e:
        if e.status_code == 404:
            logger.warning(
                "User Not Found (get_user_by_email(%s))",
                email,
            )
        else:
            logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


# auth/get-user-by-account/{provider}/{providerAccountId}/
@router.get(
    "/get-user-by-account/{provider}/{providerAccountId}",
    response_model=Optional[UserModel],
    response_model_exclude_none=True,
)
async def get_user_by_account(
    provider: str, providerAccountId: str
) -> Optional[UserModel]:
    try:
        with SessionLocal() as db:
            stmt = select(orm.Account).where(
                orm.Account.provider == provider,
                orm.Account.provider_account_id == providerAccountId,
            )

            result: Result = db.execute(stmt)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.Account]] = result.fetchone()
            if which_row and len(which_row) > 0:
                account: orm.Account = which_row[0]

                # There's probably a way to do with with a single query
                user_query = select(orm.User).where(orm.User.id == account.user_id)
                auth_user = query_user_to_auth_user(user_query, db)

                return auth_user
            else:
                raise HTTPException(status_code=404, detail="User Not Found")
    except HTTPException as e:
        if e.status_code == 404:
            logger.warning(
                "User Not Found (get_user_by_account(%s, %s))",
                provider,
                providerAccountId,
            )
        else:
            logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.patch(
    "/update-user/{id}",
    response_model=UserModel,
    response_model_exclude_none=True,
)
async def update_user(
    id: int = Path(..., description="Reference ID"), user: UserModelPartial = Body(...)
) -> UserModel:
    try:
        with SessionLocal() as db:
            # Extract fields to update
            user_dict: dict[str, Optional[Any]] = user.model_dump(exclude_unset=True)
            update_dict = {key: value for key, value in user_dict.items()}

            # Query the existing user
            stmt = select(orm.User).where(orm.User.id == id)
            existing_user = db.execute(stmt).scalar_one_or_none()

            if not existing_user:
                raise HTTPException(status_code=404, detail="User Not Found")

            # Update the fields dynamically
            for key, value in update_dict.items():
                setattr(existing_user, key, value)

            # Commit the changes
            db.commit()
            db.refresh(existing_user)

            # Return the updated user
            return UserModel.model_validate(existing_user)

    except HTTPException as e:
        logger.error(f"HTTPException (secondary catch): {e}")
        raise

    except Exception as e:
        logger.error(f"Unexpected Exception: {e}")
        raise HTTPException(status_code=500, detail="Unexpected error occurred")


@router.delete("/delete-user/{id}", response_model=None)
async def delete_user(id: str) -> None:
    try:
        with SessionLocal() as db:
            orm_user = db.get(UserModel, id)
            if orm_user:
                db.delete(orm_user)
            else:
                raise HTTPException(status_code=404, detail="User Not Found")

            return None
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.post("/link-account/", response_model=AccountModel)
async def link_account(account: AccountModel) -> AccountModel:
    try:
        with SessionLocal() as db:
            existing = db.query(orm.Account).filter_by(user_id=account.user_id)
            if existing.count() > 0:
                # Why on earth do I need to do and update with a dictionary?
                # and why is this so hard?  Isn't the orm supposed to make this easier?
                existing.update(
                    {
                        "user_id": account.user_id,
                        "provider_account_id": account.provider_account_id,
                        "provider": account.provider,
                        "type": account.type,
                        "access_token": account.access_token,
                        "token_type": account.token_type,
                        "id_token": account.id_token,
                        "scope": account.scope,
                        "expires_at": account.expires_at,
                        "refresh_token": account.refresh_token,
                        "session_state": account.session_state,
                    }
                )
                db.commit()
                db.flush()
            else:
                orm_account = orm.Account(
                    user_id=account.user_id,
                    provider_account_id=account.provider_account_id,
                    provider=account.provider,
                    type=account.type,
                    access_token=account.access_token,
                    token_type=account.token_type,
                    id_token=account.id_token,
                    scope=account.scope,
                    expires_at=account.expires_at,
                    refresh_token=account.refresh_token,
                    session_state=account.session_state,
                )
                db.add(orm_account)
                # We won't have an ID until the DB does it's thing.
                db.commit()
                db.flush(orm_account)

            stmt = select(orm.Account).where(
                orm.Account.user_id == account.user_id,
                orm.Account.provider_account_id == account.provider_account_id,
            )

            result: Result = db.execute(stmt)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.Account]] = result.fetchone()
            if which_row and len(which_row) > 0:
                found_orm_account: orm.Account = which_row[0]

                expires_at = (
                    int(str(found_orm_account.expires_at))
                    if found_orm_account.expires_at is not None
                    else None
                )

                auth_account = AccountModel(
                    user_id=str(found_orm_account.user_id),
                    provider_account_id=str(found_orm_account.provider_account_id),
                    provider=str(found_orm_account.provider),
                    type=AccountType(found_orm_account.type),
                    access_token=str(found_orm_account.access_token),
                    token_type=str(found_orm_account.token_type),
                    id_token=str(found_orm_account.id_token),
                    refresh_token=str(found_orm_account.refresh_token),
                    scope=str(found_orm_account.scope),
                    expires_at=expires_at,
                    session_state=str(found_orm_account.session_state),
                )

                return auth_account
            else:
                raise HTTPException(
                    status_code=404, detail="Account Not Found after insert"
                )

    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.delete("/unlink-account/{provider}/{providerAccountId}", response_model=None)
async def unlink_account(provider: str, providerAccountId: str) -> None:
    try:
        with SessionLocal() as db:
            stmt = select(orm.Account).where(
                orm.Account.provider == provider,
                orm.Account.provider_account_id == providerAccountId,
            )

            result: Result = db.execute(stmt)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.Account]] = result.fetchone()
            if which_row and len(which_row) > 0:
                orm_account: orm.Account = which_row[0]

                db.delete(orm_account)

                return None
            else:
                raise HTTPException(status_code=404, detail="Account Not Found")

        return None
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.post("/create-session/", response_model=SessionModel)
async def create_session(session: SessionModel) -> SessionModel:
    try:
        with SessionLocal() as db:
            orm_session = orm.Session(
                expires=session.expires,
                session_token=session.session_token,
                user_id=session.user_id,
            )

            db.add(orm_session)

            # We won't have an ID until the DB does it's thing.
            db.commit()
            db.flush(orm_session)

            # For right now, query the user again just to make sure the update was applied.
            # We might want to not do this in the future.
            stmt = select(orm.Session).where(
                orm.Session.session_token == orm_session.session_token
            )
            result: Result = db.execute(stmt)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.Session]] = result.fetchone()
            if which_row and len(which_row) > 0:
                orm_session_new: orm.Session = which_row[0]

                updated_session = SessionModel(
                    expires=orm_session_new.expires,
                    session_token=orm_session_new.session_token,
                    user_id=orm_session_new.user_id,
                )

                return updated_session
            else:
                raise HTTPException(
                    status_code=404, detail="Session Not Found after insert"
                )

    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.get(
    "/get-session/{sessionToken}",
    response_model=Optional[SessionAndUserModel],
    response_model_exclude_none=True,
)
async def get_session_and_user(sessionToken: str) -> Optional[SessionAndUserModel]:
    try:
        with SessionLocal() as db:
            stmt = select(orm.Session).where(orm.Session.session_token == sessionToken)
            result: Result = db.execute(stmt)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.User]] = result.fetchone()
            if which_row and len(which_row) > 0:
                orm_session: orm.Session = which_row[0]
                user_id = str(orm_session.user_id)
                stmt = select(orm.User).where(orm.User.id == user_id)
                auth_user = query_user_to_auth_user(stmt, db)
                auth_session = SessionModel(
                    expires=orm_session.expires,
                    session_token=orm_session.session_token,
                    user_id=orm_session.user_id,
                )

                if auth_user is not None:
                    session_and_user = SessionAndUserModel(
                        session=auth_session, user=auth_user
                    )
                    return session_and_user
                else:
                    return None

            else:
                logger.error(f"Could not find session for token: {sessionToken}")
                return None
                # raise HTTPException(
                #     status_code=404, detail="Session Not Found for session_token"
                # )
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.patch("/update-session/", response_model=SessionModel)
async def update_session(session: SessionModel) -> SessionModel:
    try:
        with SessionLocal() as db:
            update_dict = {}

            update_dict["expires"] = session.expires
            update_dict["session_token"] = session.session_token
            update_dict["user_id"] = session.user_id

            db.query(orm.Session).filter_by(session_token=session.session_token).update(
                update_dict
            )

            # For right now, query the user again to flush the update,
            # and just to make sure the update was applied.  Good chance
            # we'll want to not do this in the future.
            session_query = select(orm.User).where(
                orm.Session.session_token == session.session_token
            )
            result: Result = db.execute(session_query)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.Session]] = result.fetchone()
            if which_row and len(which_row) > 0:
                orm_session: orm.Session = which_row[0]
                updated_session = SessionModel(
                    expires=orm_session.expires,
                    session_token=orm_session.session_token,
                    user_id=orm_session.user_id,
                )
                return updated_session
            else:
                logger.error(
                    f"Could not find session for token: {session.session_token}"
                )
                raise HTTPException(
                    status_code=404, detail="Session Not Found for for updated session"
                )

    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise


@router.delete("/delete-session/{sessionToken}", response_model=None)
async def delete_session(session_token: str) -> None:
    try:
        with SessionLocal() as db:
            orm_session = db.get(SessionModel, session_token)
            if orm_session:
                db.delete(orm_session)
            else:
                raise HTTPException(status_code=404, detail="Session Not Found")

            return None
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.post("/create-verification-token/", response_model=VerificationTokenModel)
async def create_verification_token(
    verification_token: VerificationTokenModel,
) -> VerificationTokenModel:
    try:
        with SessionLocal() as db:
            orm_verification_token = orm.VerificationToken(
                identifier=verification_token.identifier,
                token=verification_token.token,
                expires=verification_token.expires,
            )

            db.add(orm_verification_token)

            db.commit()
            db.flush(orm_verification_token)

            stmt = select(orm.VerificationToken).where(
                orm.VerificationToken.identifier == verification_token.identifier
            )
            result: Result = db.execute(stmt)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.Session]] = result.fetchone()
            if which_row and len(which_row) > 0:
                orm_verification_token_new: orm.VerificationToken = which_row[0]

                updated_verification_toke = VerificationTokenModel(
                    identifier=orm_verification_token_new.identifier,
                    token=orm_verification_token_new.token,
                    expires=orm_verification_token_new.expires,
                )

                return updated_verification_toke
            else:
                raise HTTPException(
                    status_code=404, detail="Session Not Found after insert"
                )

    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.post("/use-verification-token/", response_model=VerificationTokenModel)
async def use_verification_token(
    params: VerificationTokenParamsModel,
) -> VerificationTokenModel:
    try:
        with SessionLocal() as db:
            if params.identifier:
                stmt = select(orm.VerificationToken).where(
                    orm.VerificationToken.identifier == params.identifier
                )
            else:
                raise HTTPException(
                    status_code=422, detail="params must have identifier"
                )

            result: Result = db.execute(stmt)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.VerificationToken]] = result.fetchone()
            if which_row and len(which_row) > 0:
                orm_verification_token: orm.VerificationToken = which_row[0]
                try:
                    if orm_verification_token.token != params.token:
                        # I assume this is the right thing to do if the tokens don't match?
                        raise HTTPException(
                            status_code=404,  # Not sure if this is the right status code
                            detail="Verification token in storage does not match submitted token",
                        )
                    auth_verification_token = VerificationTokenModel(
                        identifier=orm_verification_token.identifier,
                        token=orm_verification_token.token,
                        expires=orm_verification_token.expires,
                    )

                    return auth_verification_token
                finally:
                    db.delete(orm_verification_token)
                    db.commit()
                    db.flush(orm_verification_token)

            else:
                logger.error(f"Could not find session for params: {params}")
                raise HTTPException(
                    status_code=404,
                    detail="Verification token Not Found for session_token",
                )
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


def query_user_to_auth_user(
    stmt: Select[Tuple[orm.User]], db: Optional[SqlAlchemySession] = None
) -> Optional[UserModel]:
    try:
        with SessionLocal() as db:
            result: Result = db.execute(stmt)  # pyright: ignore[reportMissingTypeArgument]
            which_row: Optional[Row[orm.User]] = result.fetchone()
            if which_row and len(which_row) > 0:
                user: orm.User = which_row[0]

                auth_user = UserModel(
                    id=user.id,
                    name=str(user.name),
                    email=str(user.email),
                    email_verified=user.email_verified,  # for the moment
                    hash=user.hash,
                    image=None,  # for the moment
                )
                return auth_user
            else:
                return None
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")
