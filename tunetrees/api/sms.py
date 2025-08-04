# TuneTrees - SMS Verification Service using Twilio Verify API
#
# Copyright (c) 2024 TuneTrees Software

import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from tunetrees.app.database import SessionLocal
from tunetrees.models import tunetrees as orm
from tunetrees.models.tunetrees_pydantic import UserModel

logger = logging.getLogger("sms")

router = APIRouter(
    prefix="/sms",
    tags=["sms"],
)


class SMSVerificationRequest(BaseModel):
    phone: str = Field(description="Phone number to send verification code to")


class SMSVerificationCode(BaseModel):
    phone: str = Field(description="Phone number")
    code: str = Field(description="Verification code")


class SMSSignupVerificationRequest(BaseModel):
    email: str = Field(description="Email address to link with verified phone")
    phone: str = Field(description="Verified phone number")


class SMSVerificationResponse(BaseModel):
    success: bool = Field(description="Whether the verification was successful")
    message: str = Field(description="Response message")


def get_twilio_client():
    """Get Twilio client for Verify API"""
    try:
        from twilio.rest import Client

        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")

        if not account_sid or not auth_token:
            raise ValueError("Missing Twilio credentials")

        return Client(account_sid, auth_token)
    except ImportError:
        logger.error("Twilio library not installed. Install with: pip install twilio")
        raise HTTPException(status_code=500, detail="SMS service not available")
    except Exception as e:
        logger.error(f"Failed to initialize Twilio client: {e}")
        raise HTTPException(status_code=500, detail="SMS service not configured")


@router.post("/send-verification", response_model=SMSVerificationResponse)
async def send_sms_verification(
    request: SMSVerificationRequest,
) -> SMSVerificationResponse:
    """Send SMS verification code using Twilio Verify API"""
    try:
        # Check if user with this phone exists
        with SessionLocal() as db:
            stmt = select(orm.User).where(orm.User.phone == request.phone)
            user = db.execute(stmt).scalar_one_or_none()

            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="No account found with this phone number. Please add your phone number to your profile first.",
                )

        # Use Twilio Verify API to send verification
        if os.getenv("NODE_ENV") == "production":
            verify_service_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID")
            if not verify_service_sid:
                raise HTTPException(
                    status_code=500, detail="Verify service not configured"
                )
            client = get_twilio_client()
            try:
                verification = client.verify.services(
                    verify_service_sid
                ).verifications.create(to=request.phone, channel="sms")
                logger.info(
                    f"SMS verification sent to {request.phone}, status: {verification.status}"
                )
            except Exception as e:
                from twilio.base.exceptions import TwilioRestException

                if isinstance(e, TwilioRestException):
                    logger.error(f"Twilio error sending SMS verification: {e.msg}")
                    if getattr(e, "code", None) == 60200:
                        raise HTTPException(
                            status_code=400,
                            detail="Phone number rejected. Please check the number and try again.",
                        )
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to send verification code. Please try again later.",
                    )
                logger.error(f"Unexpected error sending SMS verification: {e}")
                raise HTTPException(
                    status_code=500, detail="Failed to send verification code"
                )
        else:
            # For development, log a demo code
            logger.info(
                f"SMS verification requested for {request.phone} (development mode)"
            )
            logger.info("In production, SMS would be sent via Twilio Verify API")

        return SMSVerificationResponse(
            success=True, message="Verification code sent successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending SMS verification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code")


@router.post("/verify-code", response_model=SMSVerificationResponse)
async def verify_sms_code(verification: SMSVerificationCode) -> SMSVerificationResponse:
    """Verify SMS code using Twilio Verify API"""
    try:
        verify_service_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID")
        if not verify_service_sid:
            raise HTTPException(status_code=500, detail="Verify service not configured")

        # Verify code with Twilio Verify API
        if os.getenv("NODE_ENV") == "production":
            client = get_twilio_client()
            verification_check = client.verify.services(
                verify_service_sid
            ).verification_checks.create(to=verification.phone, code=verification.code)

            if verification_check.status != "approved":
                raise HTTPException(status_code=401, detail="Invalid verification code")

            logger.info(f"SMS verification successful for {verification.phone}")
        else:
            # For development, accept any 6-digit code for testing
            if len(verification.code) != 6 or not verification.code.isdigit():
                raise HTTPException(
                    status_code=401, detail="Invalid verification code format"
                )
            logger.info(
                f"SMS verification accepted for {verification.phone} (development mode)"
            )

        # Mark phone as verified in database
        with SessionLocal() as db:
            stmt = select(orm.User).where(orm.User.phone == verification.phone)
            user = db.execute(stmt).scalar_one_or_none()

            if user and not user.phone_verified:
                user.phone_verified = True
                db.commit()
                logger.info(
                    f"Phone {verification.phone} marked as verified for user {user.id}"
                )

        return SMSVerificationResponse(
            success=True, message="Phone number verified successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying SMS code: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify code")


@router.post("/verify-login", response_model=Optional[UserModel])
async def verify_sms_login(verification: SMSVerificationCode) -> Optional[UserModel]:
    """Verify SMS code and return user for authentication"""
    try:
        verify_service_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID")
        if not verify_service_sid:
            raise HTTPException(status_code=500, detail="Verify service not configured")

        # Verify code with Twilio Verify API
        if os.getenv("NODE_ENV") == "production":
            client = get_twilio_client()
            verification_check = client.verify.services(
                verify_service_sid
            ).verification_checks.create(to=verification.phone, code=verification.code)

            if verification_check.status != "approved":
                raise HTTPException(status_code=401, detail="Invalid verification code")
        else:
            # For development, accept any 6-digit code for testing
            if len(verification.code) != 6 or not verification.code.isdigit():
                raise HTTPException(
                    status_code=401, detail="Invalid verification code format"
                )
            logger.info(
                f"SMS login verification accepted for {verification.phone} (development mode)"
            )

        # Look up user by phone number
        with SessionLocal() as db:
            stmt = select(orm.User).where(orm.User.phone == verification.phone)
            user = db.execute(stmt).scalar_one_or_none()

            if not user:
                raise HTTPException(
                    status_code=404, detail="No account found with this phone number"
                )

            # Mark phone as verified if not already
            if not user.phone_verified:
                user.phone_verified = True
                db.commit()

            return UserModel(
                id=user.id,
                name=user.name,
                email=user.email,
                email_verified=user.email_verified,
                image=user.image,
                sr_alg_type=user.sr_alg_type,
                phone=user.phone,
                phone_verified=user.phone_verified,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying SMS login: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify login")


@router.post("/send-password-reset", response_model=SMSVerificationResponse)
async def send_sms_password_reset(request: SMSVerificationRequest):
    """Send SMS password reset code to user's phone number"""
    try:
        with SessionLocal() as db:
            # Check if user with this phone exists
            stmt = select(orm.User).where(orm.User.phone == request.phone)
            user = db.execute(stmt).scalars().first()

            if not user:
                # Return success response to prevent phone enumeration
                # But don't actually send SMS
                logger.info(
                    f"Password reset requested for non-existent phone: {request.phone}"
                )
                return SMSVerificationResponse(
                    success=True,
                    message="If an account with that phone number exists, a reset code has been sent.",
                )

            # Send SMS using Twilio Verify API
            twilio_client = get_twilio_client()
            service_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID")

            if not service_sid:
                raise HTTPException(
                    status_code=500, detail="SMS service not configured"
                )

            try:
                verification = twilio_client.verify.v2.services(
                    service_sid
                ).verifications.create(to=request.phone, channel="sms")
                if verification.status == "pending":
                    logger.info(
                        f"Password reset SMS sent to {request.phone} for user {user.id}"
                    )
                    return SMSVerificationResponse(
                        success=True, message="Password reset code sent successfully"
                    )
                else:
                    logger.error(
                        f"Failed to send password reset SMS to {request.phone}"
                    )
                    raise HTTPException(
                        status_code=500, detail="Failed to send password reset code"
                    )
            except Exception as e:
                from twilio.base.exceptions import TwilioRestException

                if isinstance(e, TwilioRestException):
                    logger.error(f"Twilio error sending password reset SMS: {e.msg}")
                    if getattr(e, "code", None) == 60200:
                        raise HTTPException(
                            status_code=400,
                            detail="Phone number rejected. Please check the number and try again.",
                        )
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to send password reset code. Please try again later.",
                    )
                logger.error(f"Unexpected error sending password reset SMS: {e}")
                raise HTTPException(
                    status_code=500, detail="Failed to send password reset code"
                )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending password reset SMS: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to send password reset code"
        )


@router.post("/verify-signup", response_model=SMSVerificationResponse)
async def verify_sms_signup(
    request: SMSSignupVerificationRequest,
) -> SMSVerificationResponse:
    """Complete account verification via SMS after phone verification"""
    try:
        with SessionLocal() as db:
            # Find user by email
            stmt = select(orm.User).where(orm.User.email == request.email)
            user = db.execute(stmt).scalar_one_or_none()

            if not user:
                raise HTTPException(status_code=404, detail="Account not found")

            # Check if account is already verified
            if user.email_verified or user.phone_verified:
                return SMSVerificationResponse(
                    success=True, message="Account already verified"
                )

            # Update user with phone number and verify account
            user.phone = request.phone
            from datetime import timezone

            user.phone_verified = datetime.now(
                timezone.utc
            ).isoformat()  # Store timestamp as string
            user.email_verified = datetime.now(
                timezone.utc
            ).isoformat()  # Set for NextAuth compatibility

            user.modified = datetime.now(timezone.utc)

            # Clean up verification token after successful SMS verification
            from tunetrees.models.tunetrees import VerificationToken

            stmt_delete = select(VerificationToken).where(
                VerificationToken.identifier == request.email
            )
            tokens_to_delete = db.execute(stmt_delete).scalars().all()
            for token in tokens_to_delete:
                db.delete(token)

            db.commit()

            logger.info(
                f"Account verified via SMS for user {user.id} ({request.email})"
            )
            return SMSVerificationResponse(
                success=True, message="Account verified successfully via SMS"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing SMS signup verification: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to complete SMS verification"
        )


@router.post("/send-verification-signup", response_model=SMSVerificationResponse)
async def send_sms_verification_signup(
    request: SMSVerificationRequest,
) -> SMSVerificationResponse:
    """Send SMS verification code for signup (doesn't require existing user)"""
    try:
        # Use Twilio Verify API to send verification
        if os.getenv("NODE_ENV") == "production":
            verify_service_sid = os.getenv("TWILIO_VERIFY_SERVICE_SID")
            if not verify_service_sid:
                raise HTTPException(
                    status_code=500, detail="Verify service not configured"
                )

            client = get_twilio_client()
            try:
                verification = client.verify.services(
                    verify_service_sid
                ).verifications.create(to=request.phone, channel="sms")
                logger.info(
                    f"SMS signup verification sent to {request.phone}, status: {verification.status}"
                )
            except Exception as e:
                from twilio.base.exceptions import TwilioRestException

                if isinstance(e, TwilioRestException):
                    logger.error(
                        f"Twilio error sending SMS signup verification: {e.msg}"
                    )
                    if getattr(e, "code", None) == 60200:
                        raise HTTPException(
                            status_code=400,
                            detail="Phone number rejected. Please check the number and try again.",
                        )
                    raise HTTPException(
                        status_code=400,
                        detail="Failed to send verification code. Please try again later.",
                    )
                logger.error(f"Unexpected error sending SMS signup verification: {e}")
                raise HTTPException(
                    status_code=500, detail="Failed to send verification code"
                )
        else:
            # For development, log a demo code
            logger.info(
                f"SMS signup verification requested for {request.phone} (development mode)"
            )
            logger.info("In production, SMS would be sent via Twilio Verify API")

        return SMSVerificationResponse(
            success=True, message="Verification code sent to your phone"
        )

    except HTTPException as e:
        logger.error(f"HTTP error sending SMS signup verification: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Error sending SMS signup verification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code")
