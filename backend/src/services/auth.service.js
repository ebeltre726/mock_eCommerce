import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
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

const cognito = new CognitoIdentityProviderClient({ region: env.AWS_REGION });

// ======================
// LOGIN USER
// ======================
// Uses USER_PASSWORD_AUTH — backend proxies the credentials to Cognito.
// Cognito returns three tokens; we pass all three back so the frontend can
// store the access token (for logout) and refresh token (for silent re-auth).
//
// Best practice note: USER_SRP_AUTH from the frontend is more secure because
// the password never transits your backend. Consider migrating to Amplify's
// signIn() (SRP) on the frontend if you want zero-knowledge auth.
export async function loginUser(email, password) {
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

    return {
      token:        AuthenticationResult.IdToken,
      accessToken:  AuthenticationResult.AccessToken,
      refreshToken: AuthenticationResult.RefreshToken,
      // sub and email come from the ID token claims, but the frontend needs
      // them immediately (before decoding the JWT) for local state.
      userId: null,   // populated from Cognito ID token sub — frontend should decode or call /me
      email:  email.trim().toLowerCase(),
    };
  } catch (err) {
    if (
      err instanceof NotAuthorizedException ||
      err instanceof UserNotConfirmedException
    ) {
      // Never reveal whether the email exists — same message for all auth failures
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
    console.error('GlobalSignOut error (non-fatal):', err.message);
  }
}
