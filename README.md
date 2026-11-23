# Pantau Tokder

An internal tool for a small YouTube production team. It tracks channel analytics, staff work and attendance, affiliate links and posting to several social platforms from one place. The backend is an Express API on Postgres; the frontend is a static Vite app. It is deployed on Vercel.

[Bahasa Indonesia](README.id.md)

## What it does

- **Channel analytics** for several YouTube channels, with CTR taken from the YouTube Reporting API, channel comparison and trends.
- **Suggestions** for titles, topics and keywords from real YouTube search and best-selling videos, and from affiliate product sales.
- **Affiliate links:** a link tracker, a CSV import and top products with rupiah amounts.
- **Staff:** a daily dashboard, attendance checked against the office Wi-Fi IP and GPS, working hours, public holidays, payroll, leave and claims, and performance.
- **Roles:** owners see earnings and settings; staff see only their own data.
- **Posting** one upload to TikTok, Instagram, Facebook and YouTube. Files go to Vercel Blob, every post is saved as a draft first, then published. OAuth is read-only for analytics, tokens are encrypted, and there is a Meta data deletion callback.
- **Phone notifications** through web push and an hourly sync.
- Privacy Policy, Terms of Service and Data Deletion pages in Indonesian and English.

## Tech stack

Node.js, Express, Postgres (`pg`), `node-cron`, `web-push`, `@vercel/blob`, Vite, Vercel.

## Getting started

```bash
npm install
cp api/.env.example api/.env   # then fill in the values
npm run dev                    # frontend
npm start                      # API
npm test
```

Apply `migrations/001_init.sql` and `migrations/002_seed.sql` to your Postgres database.

### Environment variables

`DATABASE_URL`, `ADMIN_PASSWORD`, `ENCRYPTION_KEY`, `CRON_SECRET`, `PUBLIC_URL`, `ALLOWED_ORIGIN`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_IDS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BLOB_READ_WRITE_TOKEN`, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `META_GRAPH_VERSION`. Platform keys are only needed for the platforms you connect. Trim whitespace from keys you paste into Vercel, because some platforms reject them otherwise.

## Project structure

```
app/          frontend (index.html, src, styles)
api/          Express API and serverless entry
migrations/   SQL schema and seed
scripts/      CSP check, YouTube upload helper
docs/         user guide, TikTok and Meta registration notes, app icons
```

Only `main` is deployed. Branch previews are blocked on the Vercel Hobby plan.
