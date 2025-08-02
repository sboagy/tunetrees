# TuneTrees - SMS Verification Service
#
# Copyright (c) 2024 TuneTrees Software

import logging
from typing import Optional
from datetime import datetime, timedelta
import random
import os

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
            try:
                from twilio.rest import Client
                
                account_sid = os.getenv("TWILIO_ACCOUNT_SID")
                auth_token = os.getenv("TWILIO_AUTH_TOKEN")
                from_phone = os.getenv("TWILIO_PHONE_NUMBER")
                
                if not all([account_sid, auth_token, from_phone]):
                    logger.error("Missing Twilio configuration in environment variables")
                    raise HTTPException(
                        status_code=500, 
                        detail="SMS service not configured"
                    )
                
                client = Client(account_sid, auth_token)
                message = client.messages.create(
                    body=f"Your TuneTrees verification code is: {code}",
                    from_=from_phone,
                    to=request.phone
                )
                logger.info(f"SMS sent to {request.phone}, message SID: {message.sid}")
                
            except Exception as e:
                logger.error(f"Failed to send SMS via Twilio: {e}")
                raise HTTPException(
                    status_code=500,
                    detail="Failed to send verification code"
                )
        else:
            # For development, log the code
            logger.info(f"SMS verification code for {request.phone}: {code}")
            
        return SMSVerificationResponse(
            success=True,
            message="Verification code sent successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending SMS verification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code")


@router.post("/verify-code", response_model=SMSVerificationResponse)
async def verify_sms_code(verification: SMSVerificationCode) -> SMSVerificationResponse:
    """Verify SMS verification code"""
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
            
        # Code is valid - clean up
        del verification_codes[verification.phone]
        
        return SMSVerificationResponse(
            success=True,
            message="Phone number verified successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying SMS code: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify code")


@router.post("/verify-login", response_model=Optional[UserModel])
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
            
        # Code is valid - for now, create a temporary user since phone field doesn't exist in DB yet
        # In production, this would look up the user by phone number
        with SessionLocal() as db:
            # For now, look up by email if available, or create a temporary demo user
            # This is a temporary solution until phone fields are added to the database
            stmt = select(orm.User).limit(1)  # Get any user for demo purposes
            user = db.execute(stmt).scalar_one_or_none()
            
            if not user:
                # Create a demo user if none exists
                demo_user = orm.User(
                    name="SMS Demo User",
                    email=f"sms-{verification.phone}@demo.tunetrees.com",
                    email_verified=datetime.now(),
                    sr_alg_type="FSRS"
                )
                db.add(demo_user)
                db.commit()
                db.refresh(demo_user)
                user = demo_user
                
            # Clean up verification code
            del verification_codes[verification.phone]
            
            return UserModel(
                id=user.id,
                name=user.name,
                email=user.email,
                email_verified=user.email_verified,
                image=user.image,
                sr_alg_type=user.sr_alg_type
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying SMS login: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify login")