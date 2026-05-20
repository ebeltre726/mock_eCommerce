import {
  loginUser,
  signupUser,
  confirmSignup,
  logoutUser,
  refreshTokens,
  forgotPassword,
  confirmForgotPassword,
  resendConfirmation,
} from '../services/auth.service.js';
import { fetchOverview, ensureUserProfile } from '../services/account.service.js';
import { verifier } from '../middleware/auth.middleware.js';
import logger from '../utils/logger.js';

// Tokens are delivered via httpOnly cookies so client-side JS cannot read them.
// A non-httpOnly `logged_in` cookie lets the frontend determine auth state
// without a round-trip and without exposing any sensitive value.
function cookieBase() {
  const isProd = process.env.NODE_ENV === 'production';
  // Frontend and API share the same CloudFront domain, so 'lax' is sufficient in
  // production and prevents cookies from being sent in third-party cross-site contexts.
  // 'none' would be required only if the API were on a different domain — it is not.
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/' };
}

function setAuthCookies(res, { token, accessToken, refreshToken }) {
  const base = cookieBase();
  res.cookie('id_token',      token,        { ...base, maxAge: 60 * 60 * 1000 });
  if (accessToken)  res.cookie('access_token',  accessToken,  { ...base, maxAge: 60 * 60 * 1000 });
  if (refreshToken) res.cookie('refresh_token', refreshToken, { ...base, maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.cookie('logged_in', '1', { ...base, httpOnly: false, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function clearAuthCookies(res) {
  const base = cookieBase();
  res.clearCookie('id_token',      base);
  res.clearCookie('access_token',  base);
  res.clearCookie('refresh_token', base);
  res.clearCookie('logged_in',     { ...base, httpOnly: false });
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const data = await loginUser(email, password);

    // Fire-and-forget profile init. In dev this creates DynamoDB Local rows that
    // the PostConfirmation Lambda won't have created. In prod this is a no-op
    // (ConditionalCheckFailed) on every login after the first, and a self-heal
    // if the Lambda ever failed transiently.
    ensureUserProfile({
      userId:    data.userId,
      email:     data.email,
      firstName: data.firstName,
      lastName:  data.lastName,
    }).catch(err => logger.error({ err: err.message }, 'ensureUserProfile error (non-fatal)'));

    setAuthCookies(res, data);

    const { token, accessToken, refreshToken, ...user } = data;
    res.json(user);
  } catch (err) {
    logger.error({ err }, 'login error');
    res.status(401).json({ error: 'Invalid email or password' });
  }
}

export async function signup(req, res) {
  try {
    const { firstName, lastName, email, password, termsConditions } = req.body;
    if (!firstName || !lastName || !email || !password || termsConditions === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const data = await signupUser({ firstName, lastName, email, password, termsConditions });
    res.status(201).json(data);
  } catch (err) {
    logger.error({ err }, 'signup error');
    res.status(400).json({ error: 'Signup failed. Please check your details and try again.' });
  }
}

export async function confirmSignupHandler(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }
    const result = await confirmSignup(email, code);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'confirmSignup error');
    res.status(400).json({ error: err.message || 'Verification failed' });
  }
}

export async function resendConfirmationHandler(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const result = await resendConfirmation(email);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'resendConfirmation error');
    const status = err.message?.includes('Too many') ? 429 : 500;
    res.status(status).json({ error: err.message || 'Request failed' });
  }
}

export async function logout(req, res) {
  try {
    const accessToken = req.cookies?.access_token;
    await logoutUser(accessToken);
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    logger.error({ err }, 'logout error');
    res.status(500).json({ error: 'Logout failed' });
  }
}

export async function refresh(req, res) {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }
    const tokens = await refreshTokens(refreshToken);
    setAuthCookies(res, tokens);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'refresh error');
    clearAuthCookies(res);
    res.status(401).json({ error: err.message || 'Token refresh failed' });
  }
}

export async function forgotPasswordHandler(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const result = await forgotPassword(email);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'forgotPassword error');
    const status = err.message?.includes('Too many') ? 429 : 500;
    res.status(status).json({ error: err.message || 'Request failed' });
  }
}

export async function confirmForgotPasswordHandler(req, res) {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }
    const result = await confirmForgotPassword(email, code, password);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'confirmForgotPassword error');
    res.status(400).json({ error: err.message || 'Password reset failed' });
  }
}

// Accepts tokens from a successful client-side SRP auth (via amazon-cognito-identity-js),
// verifies the IdToken, and sets the same httpOnly cookies as the proxied login.
// This lets the frontend do zero-knowledge SRP while still using the httpOnly cookie session model.
export async function session(req, res) {
  try {
    const { idToken, accessToken, refreshToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const payload = await verifier.verify(idToken);

    ensureUserProfile({
      userId:    payload.sub,
      email:     payload.email,
      firstName: payload.given_name ?? '',
      lastName:  payload.family_name ?? '',
    }).catch(err => logger.error({ err: err.message }, 'ensureUserProfile error (non-fatal)'));

    setAuthCookies(res, { token: idToken, accessToken, refreshToken });

    res.json({
      userId:    payload.sub,
      email:     payload.email,
      firstName: payload.given_name  ?? '',
      lastName:  payload.family_name ?? '',
    });
  } catch (err) {
    logger.error({ err }, 'session error');
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function getMe(req, res) {
  try {
    const user = await fetchOverview(req.user.userId);
    if (!user || !user.userId) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(user);
  } catch (err) {
    logger.error({ err }, 'getMe error');
    // AWS SDK v3 errors carry $metadata with the HTTP status code.
    // A 5xx from DynamoDB means the service is degraded — surface a 503.
    // Anything else (404 from item not found, etc.) falls through to 404.
    const awsStatus = err.$metadata?.httpStatusCode;
    const isInfra = awsStatus !== undefined && awsStatus >= 500;
    res.status(isInfra ? 503 : 404).json({ error: isInfra ? 'Service temporarily unavailable' : 'Account not found' });
  }
}
