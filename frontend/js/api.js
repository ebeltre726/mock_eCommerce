import config from './config.js';

export class AuthError extends Error {
    constructor() {
        super('Unauthorized');
        this.name = 'AuthError';
    }
}

export async function apiFetch(path, options = {}) {
    const { _isRetry, ...fetchOptions } = options;

    const res = await fetch(`${config.apiBase}/${path}`, {
        ...fetchOptions,
        credentials: 'include',
        signal: fetchOptions.signal,
        headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
        },
    });

    if (res.status === 401) {
        // Attempt a silent token refresh once before giving up.
        // _isRetry prevents infinite loops if the refresh endpoint itself 401s.
        if (!_isRetry) {
            try {
                await apiFetch('auth/refresh', {
                    method:   'POST',
                    _isRetry: true,
                });
                // New tokens are in cookies — retry the original request.
                return apiFetch(path, { ...options, _isRetry: true });
            } catch (_) {
                // Refresh failed — fall through and throw AuthError
            }
        }

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

export async function apiFetchForm(path, formData, { _isRetry } = {}) {
    const res = await fetch(`${config.apiBase}/${path}`, {
        method:      'POST',
        credentials: 'include',
        body:        formData,
    });

    if (res.status === 401) {
        if (!_isRetry) {
            try {
                await apiFetch('auth/refresh', { method: 'POST', _isRetry: true });
                return apiFetchForm(path, formData, { _isRetry: true });
            } catch (_) {
                // Refresh failed — fall through and throw AuthError
            }
        }
        throw new AuthError();
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.error ?? `Request failed: ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}
