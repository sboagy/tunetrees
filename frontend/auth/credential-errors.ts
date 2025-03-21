import { AuthError, CredentialsSignin } from "next-auth";

class VerificationTokenError extends CredentialsSignin {
  constructor(message: string) {
    super(message);
    this.name = "VerificationTokenError";
  }
}
export class GetUserByEmailError extends VerificationTokenError {
  constructor() {
    super("getUserByEmail is not defined in ttHttpAdapter.");
    this.name = "GetUserByEmailError";
  }
}
export class UseVerificationTokenError extends VerificationTokenError {
  constructor() {
    super("useVerificationToken is not defined in ttHttpAdapter.");
    this.name = "UseVerificationTokenError";
  }
}
export class VerificationTokenNotFoundError extends VerificationTokenError {
  constructor() {
    super("verificationToken is not defined.");
    this.name = "VerificationTokenNotFoundError";
  }
}
export class VerificationTokenExpiredError extends VerificationTokenError {
  constructor() {
    super("verificationToken is expired.");
    this.name = "VerificationTokenExpiredError";
  }
}
export class EmptyEmailError extends CredentialsSignin {
  constructor() {
    super("Empty Email.");
    this.name = "EmptyEmailError";
  }
}
export class EmptyPasswordError extends CredentialsSignin {
  constructor() {
    super("Empty Password.");
    this.name = "EmptyPasswordError";
  }
}
export class NoPasswordHashError extends CredentialsSignin {
  constructor() {
    super("No password hash found for user.");
    this.name = "NoPasswordHashError";
  }
}
export class EmailNotVerifiedError extends CredentialsSignin {
  constructor() {
    super("User's email has not been verified.");
    this.name = "EmailNotVerifiedError";
  }
}
export class PasswordMismatchError extends AuthError {
  constructor() {
    super("Password does not match.");
    this.name = "PasswordMismatchError";
  }
}
export class UserNotFoundError extends CredentialsSignin {
  constructor() {
    super("User not found.");
    this.name = "UserNotFoundError";
  }
}
