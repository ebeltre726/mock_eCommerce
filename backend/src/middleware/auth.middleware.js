import { CognitoJwtVerifier } from 'aws-jwt-verify';
import env from '../config/env.js';

// Verifier is created once and caches Cognito's JWKS internally.
// It validates: signature, expiry, issuer (User Pool), and audience (Client ID).
const verifier = CognitoJwtVerifier.create({
  userPoolId: env.COGNITO_USER_POOL_ID,
  tokenUse: 'id',
  clientId: env.COGNITO_CLIENT_ID,
});

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  const token = authHeader.split(' ')[1];

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
