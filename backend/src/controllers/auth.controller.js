import {
  loginUser,
  signupUser,
  logoutUser,
  refreshTokens,
  forgotPassword,
  confirmForgotPassword,
} from '../services/auth.service.js';
import { fetchOverview } from '../services/account.service.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const data = await loginUser(email, password);
    res.json(data);
  } catch (err) {
    console.error('login error:', err);
    res.status(401).json({ error: err.message || 'Login failed' });
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
    console.error('signup error:', err);
    res.status(400).json({ error: err.message || 'Signup failed' });
  }
}

export async function logout(req, res) {
  try {
    // The access token (not the ID token) is required for GlobalSignOut.
    // Client must send it as X-Access-Token header alongside the usual Bearer ID token.
    const accessToken = req.headers['x-access-token'];
    await logoutUser(accessToken);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    console.error('logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    const tokens = await refreshTokens(refreshToken);
    res.json(tokens);
  } catch (err) {
    console.error('refresh error:', err);
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
    console.error('forgotPassword error:', err);
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
    console.error('confirmForgotPassword error:', err);
    res.status(400).json({ error: err.message || 'Password reset failed' });
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
    console.error('getMe error:', err);
    const isInfra = err.name?.includes('DynamoDB') || err.$metadata !== undefined;
    res.status(isInfra ? 503 : 404).json({ error: isInfra ? 'Service temporarily unavailable' : 'Account not found' });
  }
}
