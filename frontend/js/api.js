import config from './config.js';

export class AuthError extends Error {
    constructor() {
        super('Unauthorized');
        this.name = 'AuthError';
    }
}

export async function apiFetch(path, options = {}) {
    const { _isRetry, ...fetchOptions } = options;

    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiBase}/${path}`, {
        ...fetchOptions,
        signal: fetchOptions.signal,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...fetchOptions.headers,
        },
    });

    if (res.status === 401) {
        // Attempt a silent token refresh once before giving up.
        // _isRetry prevents infinite loops if the refresh endpoint itself 401s.
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken && !_isRetry) {
            try {
                const refreshed = await apiFetch('auth/refresh', {
                    method:    'POST',
                    body:      JSON.stringify({ refreshToken }),
                    _isRetry:  true,
                });
                localStorage.setItem('token', refreshed.token);
                if (refreshed.accessToken) {
                    localStorage.setItem('accessToken', refreshed.accessToken);
                }
                // Retry the original request — apiFetch will read the new token
                // from localStorage on the next call.
                return apiFetch(path, { ...options, _isRetry: true });
            } catch (_) {
                // Refresh failed — fall through to clear tokens and throw
            }
        }

        localStorage.removeItem('token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        throw new AuthError();
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err  = new Error(body.error ?? `Request failed: ${res.status}`);
        err.status = res.status;
        throw err;
    }

    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        return null;
    }

    return res.json();
}

export async function apiFetchForm(path, formData) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${config.apiBase}/${path}`, {
        method: 'POST',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.error ?? `Request failed: ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}
