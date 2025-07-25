# TuneTrees - WebAuthn/Passkey Service
#
# Copyright (c) 2024 TuneTrees Software

import logging
import base64
import json
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm.session import Session as SqlAlchemySession

try:
    from webauthn import generate_registration_options, verify_registration_response
    from webauthn import generate_authentication_options, verify_authentication_response
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria,
        UserVerificationRequirement,
        RegistrationCredential,
        AuthenticationCredential,
        PublicKeyCredentialDescriptor,
    )
    from webauthn.helpers.cose import COSEAlgorithmIdentifier
    WEBAUTHN_AVAILABLE = True
except ImportError:
    WEBAUTHN_AVAILABLE = False
    logger = logging.getLogger("webauthn")
    logger.warning("WebAuthn library not available - passkey support disabled")

from tunetrees.app.database import SessionLocal
from tunetrees.models import tunetrees as orm
from tunetrees.models.tunetrees_pydantic import UserModel, AuthenticatorModel


logger = logging.getLogger("webauthn")

router = APIRouter(
    prefix="/webauthn",
    tags=["webauthn"],
)

# Configuration
RP_ID = "localhost"  # In production, use actual domain
RP_NAME = "TuneTrees"
ORIGIN = "https://localhost:3000"  # In production, use actual origin


class RegistrationStartRequest(BaseModel):
    user_id: int = Field(description="User ID to register passkey for")


class RegistrationCompleteRequest(BaseModel):
    user_id: int = Field(description="User ID")
    credential: Dict[str, Any] = Field(description="WebAuthn credential response")


class AuthenticationStartRequest(BaseModel):
    user_id: Optional[int] = Field(default=None, description="User ID (optional for usernameless)")


class AuthenticationCompleteRequest(BaseModel):
    credential: Dict[str, Any] = Field(description="WebAuthn authentication response")


class WebAuthnResponse(BaseModel):
    success: bool = Field(description="Whether the operation was successful")
    message: str = Field(description="Response message")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Additional data")


# In-memory storage for challenges - in production, use Redis or database
challenges: Dict[str, Dict[str, Any]] = {}


@router.post("/registration/start", response_model=WebAuthnResponse)
async def start_registration(request: RegistrationStartRequest) -> WebAuthnResponse:
    """Start WebAuthn registration process"""
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(status_code=501, detail="WebAuthn not available")
        
    try:
        with SessionLocal() as db:
            # Get user
            stmt = select(orm.User).where(orm.User.id == request.user_id)
            user = db.execute(stmt).scalar_one_or_none()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
                
            # Get existing authenticators for this user
            stmt = select(orm.Authenticator).where(orm.Authenticator.user_id == request.user_id)
            existing_authenticators = db.execute(stmt).scalars().all()
            
            exclude_credentials = []
            for auth in existing_authenticators:
                exclude_credentials.append(
                    PublicKeyCredentialDescriptor(
                        id=base64.b64decode(auth.credential_id)
                    )
                )
            
            # Generate registration options
            options = generate_registration_options(
                rp_id=RP_ID,
                rp_name=RP_NAME,
                user_id=str(user.id).encode(),
                user_name=user.email or user.name or f"user_{user.id}",
                user_display_name=user.name or user.email or f"User {user.id}",
                exclude_credentials=exclude_credentials,
                authenticator_selection=AuthenticatorSelectionCriteria(
                    user_verification=UserVerificationRequirement.PREFERRED
                ),
                supported_pub_key_algs=[
                    COSEAlgorithmIdentifier.ECDSA_SHA_256,
                    COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
                ],
            )
            
            # Store challenge
            challenge_key = f"reg_{user.id}_{options.challenge}"
            challenges[challenge_key] = {
                "challenge": options.challenge,
                "user_id": user.id,
                "type": "registration",
                "created": datetime.now()
            }
            
            return WebAuthnResponse(
                success=True,
                message="Registration options generated",
                data={
                    "options": {
                        "challenge": base64.b64encode(options.challenge).decode(),
                        "rp": {"id": options.rp.id, "name": options.rp.name},
                        "user": {
                            "id": base64.b64encode(options.user.id).decode(),
                            "name": options.user.name,
                            "displayName": options.user.display_name,
                        },
                        "pubKeyCredParams": [
                            {"type": "public-key", "alg": alg.value}
                            for alg in options.pub_key_cred_params
                        ],
                        "timeout": options.timeout,
                        "excludeCredentials": [
                            {
                                "type": "public-key", 
                                "id": base64.b64encode(cred.id).decode()
                            }
                            for cred in exclude_credentials
                        ],
                        "authenticatorSelection": {
                            "userVerification": options.authenticator_selection.user_verification.value
                        },
                    }
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting registration: {e}")
        raise HTTPException(status_code=500, detail="Failed to start registration")


@router.post("/registration/complete", response_model=WebAuthnResponse)
async def complete_registration(request: RegistrationCompleteRequest) -> WebAuthnResponse:
    """Complete WebAuthn registration process"""
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(status_code=501, detail="WebAuthn not available")
        
    try:
        # Find the challenge
        challenge_key = None
        challenge_data = None
        
        for key, data in challenges.items():
            if (data["user_id"] == request.user_id and 
                data["type"] == "registration"):
                challenge_key = key
                challenge_data = data
                break
                
        if not challenge_data:
            raise HTTPException(status_code=400, detail="Registration challenge not found")
            
        # Verify registration response
        credential = RegistrationCredential.model_validate(request.credential)
        
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=challenge_data["challenge"],
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
        )
        
        if not verification.verified:
            raise HTTPException(status_code=400, detail="Registration verification failed")
            
        # Store authenticator in database
        with SessionLocal() as db:
            authenticator = orm.Authenticator(
                credential_id=base64.b64encode(verification.credential_id).decode(),
                user_id=request.user_id,
                credential_public_key=base64.b64encode(verification.credential_public_key).decode(),
                counter=verification.sign_count,
                credential_device_type=verification.credential_device_type.value,
                credential_backed_up=verification.credential_backed_up,
                transports=",".join(credential.response.transports) if credential.response.transports else None,
            )
            
            db.add(authenticator)
            db.commit()
            
        # Clean up challenge
        del challenges[challenge_key]
        
        return WebAuthnResponse(
            success=True,
            message="Passkey registered successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error completing registration: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete registration")


@router.post("/authentication/start", response_model=WebAuthnResponse)
async def start_authentication(request: AuthenticationStartRequest) -> WebAuthnResponse:
    """Start WebAuthn authentication process"""
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(status_code=501, detail="WebAuthn not available")
        
    try:
        with SessionLocal() as db:
            # Get user's authenticators
            allow_credentials = []
            
            if request.user_id:
                stmt = select(orm.Authenticator).where(orm.Authenticator.user_id == request.user_id)
                authenticators = db.execute(stmt).scalars().all()
                
                for auth in authenticators:
                    allow_credentials.append(
                        PublicKeyCredentialDescriptor(
                            id=base64.b64decode(auth.credential_id)
                        )
                    )
                    
            # Generate authentication options
            options = generate_authentication_options(
                rp_id=RP_ID,
                allow_credentials=allow_credentials,
                user_verification=UserVerificationRequirement.PREFERRED,
            )
            
            # Store challenge
            challenge_key = f"auth_{options.challenge}"
            challenges[challenge_key] = {
                "challenge": options.challenge,
                "user_id": request.user_id,
                "type": "authentication",
                "created": datetime.now()
            }
            
            return WebAuthnResponse(
                success=True,
                message="Authentication options generated",
                data={
                    "options": {
                        "challenge": base64.b64encode(options.challenge).decode(),
                        "timeout": options.timeout,
                        "rpId": options.rp_id,
                        "allowCredentials": [
                            {
                                "type": "public-key",
                                "id": base64.b64encode(cred.id).decode()
                            }
                            for cred in allow_credentials
                        ],
                        "userVerification": options.user_verification.value,
                    }
                }
            )
            
    except Exception as e:
        logger.error(f"Error starting authentication: {e}")
        raise HTTPException(status_code=500, detail="Failed to start authentication")


@router.post("/authentication/complete", response_model=Optional[UserModel])
async def complete_authentication(request: AuthenticationCompleteRequest) -> Optional[UserModel]:
    """Complete WebAuthn authentication process"""
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(status_code=501, detail="WebAuthn not available")
        
    try:
        # Find the challenge
        challenge_key = None
        challenge_data = None
        
        for key, data in challenges.items():
            if data["type"] == "authentication":
                challenge_key = key
                challenge_data = data
                break
                
        if not challenge_data:
            raise HTTPException(status_code=400, detail="Authentication challenge not found")
            
        # Get credential ID from request
        credential = AuthenticationCredential.model_validate(request.credential)
        credential_id = base64.b64encode(credential.raw_id).decode()
        
        # Get authenticator from database
        with SessionLocal() as db:
            stmt = select(orm.Authenticator).where(orm.Authenticator.credential_id == credential_id)
            authenticator = db.execute(stmt).scalar_one_or_none()
            
            if not authenticator:
                raise HTTPException(status_code=404, detail="Authenticator not found")
                
            # Verify authentication response
            verification = verify_authentication_response(
                credential=credential,
                expected_challenge=challenge_data["challenge"],
                expected_origin=ORIGIN,
                expected_rp_id=RP_ID,
                credential_public_key=base64.b64decode(authenticator.credential_public_key),
                credential_current_sign_count=authenticator.counter,
            )
            
            if not verification.verified:
                raise HTTPException(status_code=401, detail="Authentication verification failed")
                
            # Update counter
            authenticator.counter = verification.new_sign_count
            db.commit()
            
            # Get user
            stmt = select(orm.User).where(orm.User.id == authenticator.user_id)
            user = db.execute(stmt).scalar_one_or_none()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
                
            # Clean up challenge
            del challenges[challenge_key]
            
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
        logger.error(f"Error completing authentication: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete authentication")