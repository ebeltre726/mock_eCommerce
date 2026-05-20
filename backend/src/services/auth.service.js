import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  NotAuthorizedException,
  UserNotConfirmedException,
  UsernameExistsException,
  CodeMismatchException,
  ExpiredCodeException,
  InvalidPasswordException,
  LimitExceededException,
} from '@aws-sdk/client-cognito-identity-provider';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const cognito = new CognitoIdentityProviderClient({ region: env.AWS_REGION });

// Decodes the payload of a JWT without verifying the signature.
// Safe to call on tokens received directly from Cognito (not from the client).
function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(Buffer.from(base64, 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

// ======================
// LOGIN USER
// ======================
// Uses USER_PASSWORD_AUTH — backend proxies the credentials to Cognito.
// ALLOW_USER_PASSWORD_AUTH has been removed from the Cognito client so this
// path is disabled in production. It remains here only for local dev and
// integration tests (which mock the Cognito SDK).
//
// The production browser login path uses client-side SRP (amazon-cognito-identity-js)
// which never sends the password to this backend. See POST /api/auth/tokens.
export async function loginUser(email, password) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('USER_PASSWORD_AUTH is disabled in production. Use the SRP login flow.');
  }

  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  try {
    const { AuthenticationResult } = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: env.COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email.trim().toLowerCase(),
          PASSWORD: password,
        },
      })
    );

    // Decode the ID token (trusted — came from Cognito directly) to surface
    // userId/firstName without requiring a separate /me round-trip on login.
    const claims = decodeJwtPayload(AuthenticationResult.IdToken);

    return {
      token:        AuthenticationResult.IdToken,
      accessToken:  AuthenticationResult.AccessToken,
      refreshToken: AuthenticationResult.RefreshToken,
      userId:       claims.sub        ?? null,
      email:        claims.email      ?? email.trim().toLowerCase(),
      firstName:    claims.given_name ?? '',
      lastName:     claims.family_name ?? '',
    };
  } catch (err) {
    if (err instanceof UserNotConfirmedException) {
      throw new Error('Please verify your email before logging in. Check your inbox for a verification link.', { cause: err });
    }
    if (err instanceof NotAuthorizedException) {
      // Never reveal whether the email exists — same message for all wrong-password attempts
      throw new Error('Invalid credentials.', { cause: err });
    }
    throw err;
  }
}

// ======================
// SIGNUP USER
// ======================
// Cognito creates the user and sends a verification email.
// The PostConfirmation Lambda (cognito/main.tf) creates the DynamoDB profile
// rows after the user clicks the link — no DynamoDB writes happen here.
export async function signupUser({ firstName, lastName, email, password, termsConditions }) {
  if (!firstName || !lastName || !email || !password) {
    throw new Error('All fields are required.');
  }

  if (termsConditions !== true) {
    throw new Error('You must accept the terms and conditions.');
  }

  try {
    await cognito.send(
      new SignUpCommand({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: email.trim().toLowerCase(),
        Password: password,
        UserAttributes: [
          { Name: 'email',       Value: email.trim().toLowerCase() },
          { Name: 'given_name',  Value: firstName.trim() },
          { Name: 'family_name', Value: lastName.trim() },
        ],
      })
    );

    return { message: 'Please check your email to verify your account before logging in.' };
  } catch (err) {
    if (err instanceof UsernameExistsException) {
      throw new Error('An account with this email already exists.', { cause: err });
    }
    if (err instanceof InvalidPasswordException) {
      throw new Error(
        'Password does not meet requirements: minimum 8 characters, must include uppercase, lowercase, number, and special character.',
        { cause: err }
      );
    }
    throw err;
  }
}

// ======================
// CONFIRM SIGNUP (verify code)
// ======================
export async function confirmSignup(email, code) {
  if (!email || !code) throw new Error('Email and code are required.');

  try {
    await cognito.send(
      new ConfirmSignUpCommand({
        ClientId:         env.COGNITO_CLIENT_ID,
        Username:         email.trim().toLowerCase(),
        ConfirmationCode: code.trim(),
      })
    );
    return { message: 'Account verified! You can now sign in.' };
  } catch (err) {
    if (err instanceof CodeMismatchException) {
      throw new Error('Incorrect verification code. Please check your email and try again.');
    }
    if (err instanceof ExpiredCodeException) {
      throw new Error('That code has expired. Please request a new one.');
    }
    if (err instanceof LimitExceededException) {
      throw new Error('Too many attempts. Please wait before trying again.');
    }
    throw err;
  }
}

// ======================
// RESEND VERIFICATION EMAIL
// ======================
// Called when a user loses the verification email or it expired.
// Always returns success to avoid revealing whether the address is registered.
export async function resendConfirmation(email) {
  if (!email) throw new Error('Email is required.');

  try {
    await cognito.send(
      new ResendConfirmationCodeCommand({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: email.trim().toLowerCase(),
      })
    );
  } catch (err) {
    if (err instanceof LimitExceededException) {
      throw new Error('Too many attempts. Please wait before requesting another verification email.', { cause: err });
    }
    // Swallow all other errors (e.g. UserNotFoundException) — never reveal
    // whether the email is registered.
  }

  return { message: 'If that email is registered and unverified, a new verification link has been sent.' };
}

// ======================
// REFRESH TOKENS
// ======================
export async function refreshTokens(refreshToken) {
  if (!refreshToken) throw new Error('Refresh token is required.');

  try {
    const { AuthenticationResult } = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: env.COGNITO_CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })
    );

    return {
      token:       AuthenticationResult.IdToken,
      accessToken: AuthenticationResult.AccessToken,
      // Cognito does not rotate refresh tokens on every refresh
    };
  } catch (err) {
    if (err instanceof NotAuthorizedException) {
      throw new Error('Refresh token expired. Please log in again.', { cause: err });
    }
    throw err;
  }
}

// ======================
// FORGOT PASSWORD
// ======================
export async function forgotPassword(email) {
  if (!email) throw new Error('Email is required.');

  try {
    await cognito.send(
      new ForgotPasswordCommand({
        ClientId: env.COGNITO_CLIENT_ID,
        Username: email.trim().toLowerCase(),
      })
    );

    // Always return success — never reveal whether the email is registered
    return { message: 'If an account with that email exists, a reset code has been sent.' };
  } catch (err) {
    if (err instanceof LimitExceededException) {
      throw new Error('Too many attempts. Please wait before requesting another reset code.', { cause: err });
    }
    throw err;
  }
}

// ======================
// CONFIRM FORGOT PASSWORD
// ======================
export async function confirmForgotPassword(email, code, newPassword) {
  if (!email || !code || !newPassword) {
    throw new Error('Email, code, and new password are required.');
  }

  try {
    await cognito.send(
      new ConfirmForgotPasswordCommand({
        ClientId:         env.COGNITO_CLIENT_ID,
        Username:         email.trim().toLowerCase(),
        ConfirmationCode: code.trim(),
        Password:         newPassword,
      })
    );

    return { message: 'Password reset successfully. You can now log in.' };
  } catch (err) {
    if (err instanceof CodeMismatchException || err instanceof ExpiredCodeException) {
      throw new Error('Invalid or expired code. Please request a new one.', { cause: err });
    }
    if (err instanceof InvalidPasswordException) {
      throw new Error(
        'New password does not meet requirements.',
        { cause: err }
      );
    }
    throw err;
  }
}

// ======================
// LOGOUT
// ======================
// GlobalSignOut invalidates ALL tokens (access, ID, refresh) for the user.
// The accessToken (not the ID token) is required for this call.
export async function logoutUser(accessToken) {
  if (!accessToken) return; // graceful no-op if client already cleared tokens

  try {
    await cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
  } catch (err) {
    // Log but don't fail — token may have already expired server-side
    logger.warn({ err: err.message }, 'GlobalSignOut error (non-fatal)');
  }
}
