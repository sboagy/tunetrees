# This is the HTTP interface for the "next-auth-http-adapter", see
# https://github.com/mabdullahadeel/next-auth-http-adapter/blob/master/src/validation.ts
# Note it has to transform from our SQLAlchemy ORM/Schema to the schema that nextauth
# likes, which we define here via Pydantic.

import datetime
import logging
from enum import Enum
from typing import Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Result, Row, Select, select
from sqlalchemy.orm.session import Session as SqlAlchemySession

from tunetrees.app.database import SessionLocal
from tunetrees.models import tunetrees as orm

# from tunetrees.app.database import SessionLocal

# import models as orm

logger = logging.getLogger()

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


class User(BaseModel):
    id: Optional[str] = Field(
        doc="This will be assigned and will be ignored for create or update",
        default=None,
    )
    name: Optional[str] = Field(
        doc="For now assume this is the user name.  It's exact meaning is a little ambigious at the moment",
        default=None,
    )
    email: Optional[str] = None  # Needs validator?
    emailVerified: Optional[datetime.datetime] = (
        None  # date and time value, may be null
    )
    image: Optional[str] = None


class AccountType(str, Enum):
    oauth = "oauth"
    email = "email"
    credentials = "credentials"


class Account(BaseModel):
    userId: str
    providerAccountId: str
    provider: str
    type: AccountType
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    scope: Optional[str] = None
    expires_at: Optional[int] = None
    session_state: Optional[str] = None


class Session(BaseModel):
    expires: datetime.date
    sessionToken: str
    userId: str


class Token(BaseModel):
    identifier: str
    token: str
    expires: datetime.date


class SessionAndUser(BaseModel):
    session: Session
    user: User


class VerificationToken(BaseModel):
    identifier: str
    token: str
    expires: str


class Params(BaseModel):
    identifier: str
    token: str


@router.post(
    "/signup/", response_model=Optional[User], response_model_exclude_none=True
)
async def create_user(user: User) -> Optional[User]:
    db = None
    try:
        db = SessionLocal()

        orm_user = orm.User(
            ID=user.name,  # The DB will need to set this
            user_name=user.name,
            email=user.email,
            email_verified=user.emailVerified,
            image=user.image,
        )

        db.add(orm_user)

        # We won't have an ID until the DB does it's thing.
        db.commit()
        db.flush(orm_user)

        # For right now, query the user again just to make sure the update was applied.
        # We might want to not do this in the future.
        user_query = select(orm.User).where(orm.User.ID == orm_user.ID)
        updated_user = query_user_to_auth_user(user_query, db)

        return updated_user

    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")
    finally:
        if db is not None:
            db.close()


@router.get(
    "/get-user/{id}", response_model=Optional[User], response_model_exclude_none=True
)
async def get_user(id: str) -> Optional[User]:
    try:
        stmt = select(orm.User).where(orm.User.user_name == id)
        auth_user = query_user_to_auth_user(stmt)
        return auth_user
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


@router.get("/get-user-by-email/{email}", response_model=Optional[User])
async def get_user_by_email(email: str) -> Optional[User]:
    try:
        stmt = select(orm.User).where(orm.User.email == email)
        auth_user = query_user_to_auth_user(stmt)
        return auth_user
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")


# auth/get-user-by-account/{provider}/{providerAccountId}/
@router.get(
    "/get-user-by-account/{provider}/{providerAccountId}", response_model=Optional[User]
)
async def get_user_by_account(provider: str, providerAccountId: str) -> Optional[User]:
    db = None
    try:
        db = SessionLocal()

        stmt = select(orm.Account).where(
            orm.Account.provider == provider,
            orm.Account.provider_account_id == providerAccountId,
        )

        result: Result = db.execute(stmt)
        which_row: Optional[Row[orm.Account]] = result.fetchone()
        if which_row and len(which_row) > 0:
            account: orm.Account = which_row[0]

            # There's probably a way to do with with a single query
            user_query = select(orm.User).where(orm.User.ID == account.i)
            auth_user = query_user_to_auth_user(user_query, db)

            return auth_user
        else:
            raise HTTPException(status_code=404, detail="User Not Found")
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")
    finally:
        if db is not None:
            db.close()


@router.patch("/update-user/", response_model=Optional[User])
async def update_user(user: User) -> Optional[User]:
    db = None
    try:
        db = SessionLocal()

        update_dict = {}

        update_dict["user_name"] = user.name
        update_dict["email"] = user.email
        update_dict["email_verified"] = user.emailVerified
        update_dict["image"] = user.image

        db.query(orm.User).filter_by(id=user.id).update(update_dict)

        # For right now, query the user again to flush the update,
        # and just to make sure the update was applied.  Good chance
        # we'll want to not do this in the future.
        user_query = select(orm.User).where(orm.User.ID == user.id)
        updated_user = query_user_to_auth_user(user_query, db)

        return updated_user

    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise

    finally:
        if db is not None:
            db.close()


@router.delete("/delete-user/{id}", response_model=None)
async def delete_user(id: str) -> None:
    db = None
    try:
        db = SessionLocal()

        orm_user = db.get(User, id)
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
    finally:
        if db is not None:
            db.close()


@router.post("/link-account/", response_model=Account)
async def link_account(account: Account) -> Account:
    db = None
    try:
        db = SessionLocal()

        orm_account = orm.Account(
            user_id=account.userId,
            provider_account_id=account.providerAccountId,
            provider=account.provider,
            type=account.type,
            access_token=account.access_token,
            token_type=account.token_type,
            id_token=account.id_token,
            refresh_token=account.refresh_token,
            scope=account.scope,
            expires_at=account.expires_at,
            session_state=account.session_state,
        )

        db.add(orm_account)

        # We won't have an ID until the DB does it's thing.
        db.commit()
        db.flush(orm_account)

        stmt = select(orm.Account).where(
            orm.Account.user_id == orm_account.user_id,
            orm.Account.provider_account_id == orm_account.provider_account_id,
        )

        result: Result = db.execute(stmt)
        which_row: Optional[Row[orm.Account]] = result.fetchone()
        if which_row and len(which_row) > 0:
            found_orm_account: orm.Account = which_row[0]

            expires_at = (
                int(str(found_orm_account.expires_at))
                if found_orm_account.expires_at is not None
                else None
            )

            auth_account = Account(
                userId=str(found_orm_account.user_id),
                providerAccountId=str(found_orm_account.provider_account_id),
                provider=str(found_orm_account.provider),
                type=AccountType(found_orm_account.type),
                access_token=str(found_orm_account.access_token),
                token_type=str(found_orm_account.token_type),
                id_token=str(found_orm_account.id_token),
                refresh_token=str(found_orm_account.refresh_token),
                scope=str(found_orm_account.scope),
                expires_at=expires_at,
                session_state=str(found_orm_account.session_state0),
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
    finally:
        if db is not None:
            db.close()


@router.delete("/unlink-account/{provider}/{providerAccountId}", response_model=None)
async def unlink_account(provider: str, providerAccountId: str) -> None:
    db = None
    try:
        db = SessionLocal()

        stmt = select(orm.Account).where(
            orm.Account.provider == provider,
            orm.Account.provider_account_id == providerAccountId,
        )

        result: Result = db.execute(stmt)
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
    finally:
        if db is not None:
            db.close()


@router.post("/create-session/", response_model=User)
async def create_session(session: Session) -> Session:
    db = None
    try:
        db = SessionLocal()

        orm_session = orm.Session(
            expires=session.expires,
            session_token=session.sessionToken,
            user_id=session.userId,
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
        result: Result = db.execute(stmt)
        which_row: Optional[Row[orm.Session]] = result.fetchone()
        if which_row and len(which_row) > 0:
            orm_session_new: orm.Session = which_row[0]

            updated_session = Session(
                expires=orm_session_new.expires,
                sessionToken=orm_session_new.session_token,
                userId=orm_session_new.user_id,
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
    finally:
        if db is not None:
            db.close()


@router.get("/get-session/{sessionToken}", response_model=Optional[SessionAndUser])
async def get_session_and_user(sessionToken: str) -> Optional[SessionAndUser]:
    db = None
    try:
        db = SessionLocal()
        stmt = select(orm.Session).where(orm.Session.session_token == sessionToken)
        result: Result = db.execute(stmt)
        which_row: Optional[Row[orm.User]] = result.fetchone()
        if which_row and len(which_row) > 0:
            orm_session: orm.Session = which_row[0]
            user_id = str(orm_session.user_id)
            stmt = select(orm.User).where(orm.User.ID == user_id)
            auth_user = query_user_to_auth_user(stmt, db)
            auth_session = Session(
                expires=orm_session.expires,
                sessionToken=orm_session.session_token,
                userId=orm_session.user_id,
            )

            if auth_session is not None and auth_user is not None:
                return SessionAndUser(session=auth_session, user=auth_user)
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
    finally:
        if db is not None:
            db.close()


@router.patch("/update-session/", response_model=Session)
async def update_session(session: Session) -> Session:
    db = None
    try:
        db = SessionLocal()

        update_dict = {}

        update_dict["expires"] = session.expires
        update_dict["session_token"] = session.sessionToken
        update_dict["user_id"] = session.userId

        db.query(orm.Session).filter_by(session_token=session.sessionToken).update(
            update_dict
        )

        # For right now, query the user again to flush the update,
        # and just to make sure the update was applied.  Good chance
        # we'll want to not do this in the future.
        session_query = select(orm.User).where(
            orm.Session.session_token == session.sessionToken
        )
        result: Result = db.execute(session_query)
        which_row: Optional[Row[orm.Session]] = result.fetchone()
        if which_row and len(which_row) > 0:
            orm_session: orm.Session = which_row[0]
            updated_session = Session(
                expires=orm_session.expires,
                sessionToken=orm_session.session_token,
                userId=orm_session.user_id,
            )
            return updated_session
        else:
            logger.error(f"Could not find session for token: {session.sessionToken}")
            raise HTTPException(
                status_code=404, detail="Session Not Found for for updated session"
            )

    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise

    finally:
        if db is not None:
            db.close()


@router.delete("/delete-session/{sessionToken}", response_model=None)
async def delete_session(session_token: str) -> None:
    db = None
    try:
        db = SessionLocal()

        orm_session = db.get(Session, session_token)
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
    finally:
        if db is not None:
            db.close()


@router.post("/create-verification-token/", response_model=VerificationToken)
async def create_verification_token(
    verification_token: VerificationToken,
) -> VerificationToken:
    db = None
    try:
        db = SessionLocal()

        orm_verification_token = orm.VerificationToken(
            identifier=verification_token.identifier,
            token=verification_token.token,
            expires=verification_token.token,
        )

        db.add(orm_verification_token)

        db.commit()
        db.flush(orm_verification_token)

        stmt = select(orm.VerificationToken).where(
            orm.VerificationToken.identifier == verification_token.identifier
        )
        result: Result = db.execute(stmt)
        which_row: Optional[Row[orm.Session]] = result.fetchone()
        if which_row and len(which_row) > 0:
            orm_verification_token_new: orm.VerificationToken = which_row[0]

            updated_verification_toke = VerificationToken(
                identifier=orm_verification_token_new.identifier,
                token=orm_verification_token_new.token,
                expires=orm_verification_token_new.token,
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
    finally:
        if db is not None:
            db.close()


@router.post("/get-use-verification-token/", response_model=VerificationToken)
async def use_verification_token(params: Params) -> VerificationToken:
    db = None
    try:
        db = SessionLocal()
        if params.identifier:
            stmt = select(orm.VerificationToken).where(
                orm.VerificationToken.identifier == params.identifier
            )
        elif params.token:
            stmt = select(orm.VerificationToken).where(
                orm.VerificationToken.token == params.token
            )
        else:
            raise HTTPException(
                status_code=422, detail="params must have identifier or token"
            )

        result: Result = db.execute(stmt)
        which_row: Optional[Row[orm.VerificationToken]] = result.fetchone()
        if which_row and len(which_row) > 0:
            orm_verification_token: orm.VerificationToken = which_row[0]
            auth_verification_token = VerificationToken(
                identifier=orm_verification_token.identifier,
                token=orm_verification_token.token,
                expires=orm_verification_token.token,
            )
            db.delete(orm_verification_token)

            return auth_verification_token

        else:
            logger.error(f"Could not find session for params: {params}")
            raise HTTPException(
                status_code=404, detail="Verification token Not Found for session_token"
            )
    except HTTPException as e:
        logger.error("HTTPException (secondary catch): %s" % e)
        raise
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")
    finally:
        if db is not None:
            db.close()


def query_user_to_auth_user(
    stmt: Select[Tuple[orm.User]], db: Optional[SqlAlchemySession] = None
) -> Optional[User]:
    local_session = db is None
    try:
        if local_session:
            db = SessionLocal()

        result: Result = db.execute(stmt)
        which_row: Optional[Row[orm.User]] = result.fetchone()
        if which_row and len(which_row) > 0:
            user: orm.User = which_row[0]

            auth_user = User(
                id=str(user.user_name),
                name=str(user.user_name),
                email=str(user.email),
                emailVerified=datetime.datetime.now(),  # for the moment
                image=None,  # for the moment
            )
            return auth_user
        else:
            return None
    except Exception as e:
        logger.error("Unknown error: %s" % e)
        raise HTTPException(status_code=500, detail="Unknown error occured")
    finally:
        if local_session and db is not None:
            db.close()
