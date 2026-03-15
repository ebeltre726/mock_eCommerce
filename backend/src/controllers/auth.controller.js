import { loginUser, signupUser } from '../services/auth.service.js';

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
        if (!firstName || !lastName || !email || !password || !termsConditions) {
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
    // In production: call Cognito GlobalSignOutCommand to invalidate all tokens
    // For local JWT: client simply discards the token — nothing to invalidate server-side
    res.json({ success: true, message: 'Logged out' });
}

export async function getSession(req, res) {
    // req.user is set by requireAuth middleware
    res.json({ user: req.user });
}