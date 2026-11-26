# Kryptex Login Portal

A mobile-friendly private login portal with an administrator dashboard.

## Features
- No public sign-up. Admin creates accounts manually.
- User passwords are **never stored as plain text**. They are bcrypt-hashed on the server and are never shown in the dashboard.
- Separate admin password, stored only as a hosting environment secret.
- Login and password reset flow (SMTP configuration required for reset emails).
- Visitor IP and connection address family logging.
- Latitude/longitude are collected only after an explicit browser permission prompt.
- Admin-only user and visit dashboard.

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and set strong random `SESSION_SECRET` and `ADMIN_PASSWORD`.
3. Run `npm install`, then `npm start`.
4. Open `http://localhost:3000`.

## Required production configuration
Set `SESSION_SECRET`, `ADMIN_PASSWORD`, `NODE_ENV=production`, and `BASE_URL` in your hosting provider's environment settings. For password reset emails, also set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS and SMTP_FROM.

## Data storage note
This starter uses a local JSON file (`data.json`) for demonstration. On ephemeral hosting (including many free Render instances), local files can be lost on restart/redeploy. Use a persistent disk or managed database before production. Never commit `.env` or `data.json`.

## Privacy
Show a clear privacy notice before collecting visitor data. IP addresses and exact coordinates are personal information. Coordinates are optional and only stored when the visitor grants browser location permission. IP-derived city/country is not guessed; add a reputable geolocation provider only after reviewing its privacy policy and disclosing the third-party transfer.
