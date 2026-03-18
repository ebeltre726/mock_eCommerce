// ============================================================
// api.js — Shared API utility
//
// All authenticated requests go through apiFetch.
// To switch environments, update API_BASE here only.
// When you add a bundler (e.g. Vite), replace the constant with:
//   const API_BASE = import.meta.env.VITE_API_URL;
// ============================================================

const API_BASE = 'http://localhost:3000/api';

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

export async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');

    const res = await fetch(`${API_BASE}/${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });

    if (res.status === 401) {
        localStorage.removeItem('token');
        throw new AuthError();
    }

    if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
    }

    return res.json();
}