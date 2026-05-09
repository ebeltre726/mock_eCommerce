const config = {
    apiBase: import.meta.env?.VITE_API_URL ?? 'http://localhost:3000/api',
    // Exposed to the frontend for client-side SRP auth (not secrets — public SPA values).
    // Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID in .env or at build time.
    cognito: {
        userPoolId: import.meta.env?.VITE_COGNITO_USER_POOL_ID ?? '',
        clientId:   import.meta.env?.VITE_COGNITO_CLIENT_ID   ?? '',
        region:     import.meta.env?.VITE_AWS_REGION          ?? 'us-east-1',
    },
};

export default config;