// ============================================================
// api.js — Shared API utility
//
// All authenticated requests go through apiFetch.
// To switch environments, update API_BASE here only.
// When you add a bundler (e.g. Vite), replace the constant with:
//   const API_BASE = import.meta.env.VITE_API_URL;
// ============================================================

import config from './config.js';

/**
 * Authenticated fetch wrapper.
 * - Attaches the JWT from localStorage to every request
 * - Throws a typed AuthError on 401 so callers can redirect to login
 * - Throws a generic Error on any other non-ok response
 *
 * @param {string} endpoint  - Path after the base URL, e.g. 'account/overview'
 * @param {RequestInit} [options] - Optional fetch options (method, body, etc.)
 * @returns {Promise<any>} Parsed JSON response
 */

export class AuthError extends Error {
    constructor() {
        super('Unauthorized');
        this.name = 'AuthError';
    }
}

/*
export async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const isFormData = options.body instanceof FormData;

    const res = await fetch(`${API_BASE}/${endpoint}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...options.headers,
        },
    });

    if (res.status === 401) {
        localStorage.removeItem('token');
        throw new AuthError();
    }

    if (!res.ok) {
        let message = `API error: ${res.status}`;
        try {
            const body = await res.json();
            if (body.error) message += ` — ${body.error}`;
        } catch (_) {}
        throw new Error(message);
    }

    const contentType = res.headers.get('content-type');

    if (!contentType || !contentType.includes('application/json')) {
        return null;
    }

    return res.json();
}
*/

export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const res   = await fetch(`${config.apiBase}/${path}`, {
        ...options,
        signal: options.signal, // caller can pass AbortController signal
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
    });

    if (res.status === 401) {
        localStorage.removeItem('token');
        throw new AuthError();
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err  = new Error(body.error ?? `Request failed: ${res.status}`);
        err.status = res.status; // attach status so callers can check it
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