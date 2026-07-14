# Matchestool.pro — Advanced Market Intelligence Terminal

A React-based trading analytics SPA with a cyber-hacking theme. Features digit frequency analysis, over/under, even/odd, rise/fall, and tick streaming analytics.

## Running the app

The app is a pre-built static SPA served by a Python server:

```
cd protraderanalysistool.com && python3 serve.py
```

Runs on **port 5000**. The "Start application" workflow handles this automatically.

## Dev login

The auth gate accepts a hardcoded dev credential:

- **Email/Username:** `dev@protraders.app` or `dev`
- **Password:** `dev123456`

## Project structure

- `protraderanalysistool.com/` — static site root
  - `index.html` — app shell
  - `serve.py` — Python SPA server (port 5000)
  - `auth-gate.js` — cyber-themed login overlay (runs before React)
  - `dev-supabase-bypass.js` — mocks Supabase auth for local dev
  - `cyber-theme.css` — matrix/cyber visual theme
  - `assets/` — compiled React bundle
- `_DataURI/` — data URI resource files

## Notes

- The built React bundle references Supabase for production auth. Real Supabase credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) would be needed to wire up live authentication.
- The `dev-supabase-bypass.js` script mocks Supabase so the app works without credentials in development.
- POST requests to the Python server return 501 (expected — static server only handles GET).
