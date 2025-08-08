"""Utility functions for SMS user phone verification"""

import logging
import os
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select

from tunetrees.app.database import SessionLocal
from tunetrees.models import tunetrees as orm
from tunetrees.api.sms import get_twilio_client

logger = logging.getLogger(__name__)


def verify_user_exists(user_email: str) -> None:
    """Verify user exists by email"""
    with SessionLocal() as db:
        stmt = select(orm.User).where(orm.User.email == user_email)
        user = db.execute(stmt).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User account not found.",
            )


def send_production_sms(phone: str, user_email: str) -> None:
    """Send SMS in production using Twilio"""
    verify_service_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID")
    if not verify_service_sid:
        raise HTTPException(status_code=500, detail="Verify service not configured")

    client = get_twilio_client()
    try:
        verification = client.verify.services(verify_service_sid).verifications.create(
            to=phone, channel="sms"
        )
        logger.info(
            f"SMS user phone verification sent to {phone} for user {user_email}, status: {verification.status}"
        )
    except Exception as e:
        from twilio.base.exceptions import TwilioRestException

        if isinstance(e, TwilioRestException):
            logger.error(f"Twilio error sending SMS user phone verification: {e.msg}")
            if getattr(e, "code", None) == 60200:
                raise HTTPException(
                    status_code=400,
                    detail="Phone number rejected. Please check the number and try again.",
                )
            raise HTTPException(
                status_code=400,
                detail="Failed to send verification code. Please try again later.",
            )
        logger.error(f"Unexpected error sending SMS user phone verification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code")


def log_development_mode(phone: str, user_email: str) -> None:
    """Log SMS sending in development mode"""
    logger.info(
        f"SMS user phone verification requested for {phone} for user {user_email} (development mode)"
    )
    logger.info("In production, SMS would be sent via Twilio Verify API")


def verify_production_code(phone: str, code: str) -> None:
    """Verify SMS code using Twilio in production"""
    verify_service_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID")
    if not verify_service_sid:
        raise HTTPException(status_code=500, detail="Verify service not configured")

    client = get_twilio_client()
    try:
        verification_check = client.verify.services(
            verify_service_sid
        ).verification_checks.create(to=phone, code=code)

        if verification_check.status != "approved":
            logger.warning(
                f"SMS verification failed for {phone}: {verification_check.status}"
            )
            raise HTTPException(status_code=400, detail="Invalid verification code")

        logger.info(f"SMS verification successful for {phone}")
    except Exception as e:
        _handle_twilio_verification_error(e)


def verify_development_code(phone: str, code: str) -> None:
    """Verify SMS code in development mode"""
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Invalid verification code format")
    logger.info(f"SMS verification accepted for {phone} (development mode)")


def update_user_phone(user_email: str, phone: str) -> None:
    """Update user with verified phone number"""
    with SessionLocal() as db:
        stmt = select(orm.User).where(orm.User.email == user_email)
        user = db.execute(stmt).scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User account not found.",
            )

        # Update phone number and set as verified
        user.phone = phone
        user.phone_verified = datetime.now(timezone.utc)

        db.commit()
        logger.info(f"Updated phone number for user {user_email}")


def _handle_twilio_verification_error(e: Exception) -> None:
    """Handle Twilio verification errors"""
    from twilio.base.exceptions import TwilioRestException

    if isinstance(e, TwilioRestException):
        logger.error(f"Twilio error verifying SMS code: {e.msg}")
        if getattr(e, "code", None) == 20404:
            raise HTTPException(
                status_code=400, detail="Invalid or expired verification code"
            )
        raise HTTPException(
            status_code=400, detail="Verification failed. Please try again."
        )
    logger.error(f"Unexpected error verifying SMS code: {e}")
    raise HTTPException(status_code=500, detail="Verification failed")
