# TuneTrees - SMS Verification Service
#
# Copyright (c) 2024 TuneTrees Software

import logging
from typing import Optional
from datetime import datetime, timedelta
import random
import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm.session import Session as SqlAlchemySession

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


class SMSVerificationResponse(BaseModel):
    success: bool = Field(description="Whether the verification was successful")
    message: str = Field(description="Response message")


# In-memory storage for demo - in production, use Redis or database
verification_codes: dict[str, dict] = {}


@router.post("/send-verification", response_model=SMSVerificationResponse)
async def send_sms_verification(request: SMSVerificationRequest) -> SMSVerificationResponse:
    """Send SMS verification code to phone number"""
    try:
        # Generate 6-digit verification code
        code = str(random.randint(100000, 999999))
        
        # Store code with expiration (5 minutes)
        expiry = datetime.now() + timedelta(minutes=5)
        verification_codes[request.phone] = {
            "code": code,
            "expires": expiry,
            "attempts": 0
        }
        
        # In production, send actual SMS using Twilio
        if os.getenv("NODE_ENV") == "production":
            # TODO: Implement actual Twilio SMS sending
            # from twilio.rest import Client
            # client = Client(account_sid, auth_token)
            # message = client.messages.create(
            #     body=f"Your TuneTrees verification code is: {code}",
            #     from_=os.getenv("TWILIO_PHONE_NUMBER"),
            #     to=request.phone
            # )
            pass
        else:
            # For development, log the code
            logger.info(f"SMS verification code for {request.phone}: {code}")
            
        return SMSVerificationResponse(
            success=True,
            message="Verification code sent successfully"
        )
        
    except Exception as e:
        logger.error(f"Error sending SMS verification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code")


@router.post("/verify-code", response_model=SMSVerificationResponse)
async def verify_sms_code(verification: SMSVerificationCode) -> SMSVerificationResponse:
    """Verify SMS code and update user phone verification status"""
    try:
        phone_data = verification_codes.get(verification.phone)
        
        if not phone_data:
            return SMSVerificationResponse(
                success=False,
                message="No verification code found for this phone number"
            )
            
        # Check if code expired
        if datetime.now() > phone_data["expires"]:
            del verification_codes[verification.phone]
            return SMSVerificationResponse(
                success=False,
                message="Verification code has expired"
            )
            
        # Check attempt limit
        if phone_data["attempts"] >= 3:
            del verification_codes[verification.phone]
            return SMSVerificationResponse(
                success=False,
                message="Too many failed attempts"
            )
            
        # Verify code
        if phone_data["code"] != verification.code:
            phone_data["attempts"] += 1
            return SMSVerificationResponse(
                success=False,
                message="Invalid verification code"
            )
            
        # Code is valid - mark phone as verified
        with SessionLocal() as db:
            stmt = select(orm.User).where(orm.User.phone == verification.phone)
            user = db.execute(stmt).scalar_one_or_none()
            
            if user:
                user.phone_verified = datetime.now().isoformat()
                db.commit()
                
        # Clean up verification code
        del verification_codes[verification.phone]
        
        return SMSVerificationResponse(
            success=True,
            message="Phone number verified successfully"
        )
        
    except Exception as e:
        logger.error(f"Error verifying SMS code: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify code")


@router.post("/verify", response_model=Optional[UserModel])
async def verify_sms_login(verification: SMSVerificationCode) -> Optional[UserModel]:
    """Verify SMS code for login authentication"""
    try:
        phone_data = verification_codes.get(verification.phone)
        
        if not phone_data:
            raise HTTPException(status_code=401, detail="Invalid verification code")
            
        # Check if code expired
        if datetime.now() > phone_data["expires"]:
            del verification_codes[verification.phone]
            raise HTTPException(status_code=401, detail="Verification code has expired")
            
        # Check attempt limit
        if phone_data["attempts"] >= 3:
            del verification_codes[verification.phone]
            raise HTTPException(status_code=401, detail="Too many failed attempts")
            
        # Verify code
        if phone_data["code"] != verification.code:
            phone_data["attempts"] += 1
            raise HTTPException(status_code=401, detail="Invalid verification code")
            
        # Code is valid - get user
        with SessionLocal() as db:
            stmt = select(orm.User).where(orm.User.phone == verification.phone)
            user = db.execute(stmt).scalar_one_or_none()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
                
            # Clean up verification code
            del verification_codes[verification.phone]
            
            return UserModel(
                id=user.id,
                name=user.name,
                email=user.email,
                phone=user.phone,
                email_verified=user.email_verified,
                phone_verified=user.phone_verified,
                image=user.image,
                sr_alg_type=user.sr_alg_type
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying SMS login: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify login")