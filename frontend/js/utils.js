/**
 * Shared HTML-escaping utilities.
 * Import these wherever API/server-controlled values are injected into innerHTML.
 */

/**
 * Escapes HTML special characters in text content.
 * Use for values placed between tags: `<span>${esc(value)}</span>`
 */
export function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Returns true when the server has set the non-httpOnly `logged_in` cookie,
 * indicating that valid auth cookies are present.  Use this instead of reading
 * tokens from localStorage — the actual tokens live in httpOnly cookies.
 */
export function isLoggedIn() {
    return document.cookie.split(';').some(c => c.trim() === 'logged_in=1');
}

/**
 * Escapes all HTML-significant characters for use inside HTML attributes.
 * Use for values placed inside double-quoted attributes: `data-id="${escAttr(value)}"`
 */
export function escAttr(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}
