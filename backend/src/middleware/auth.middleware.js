import { CognitoJwtVerifier } from 'aws-jwt-verify';
import env from '../config/env.js';

// Verifier is created once and caches Cognito's JWKS internally.
// It validates: signature, expiry, issuer (User Pool), and audience (Client ID).
// Exported so lambda.js can pre-warm the JWKS fetch during cold start.
export const verifier = CognitoJwtVerifier.create({
  userPoolId: env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: env.COGNITO_CLIENT_ID,
});

export async function requireAuth(req, res, next) {
  // Cookie-based auth (browser) takes precedence over the Authorization header
  // so that httpOnly cookies are used when available.  The header path remains
  // for non-browser API clients and backwards compatibility.
  const authHeader = req.headers.authorization;
  const token =
    req.cookies?.id_token ??
    (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  try {
    const payload = await verifier.verify(token);

    // Map Cognito claims to the shape the rest of the app expects.
    // sub = stable user identifier, given_name = firstName from signup.
    req.user = {
      userId:    payload.sub,
      email:     payload.email,
      firstName: payload.given_name,
    };

    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token' });
  }
}
