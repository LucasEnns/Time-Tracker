# Time Tracker

Simple mobile-first time tracking app for GitHub Pages.

## Features

- Start/Stop timer
- Work/Break mode toggle
- Project field (with suggestions from previous entries)
- Local persistence via `localStorage`
- Stats:
  - Total worked (effective)
  - Year average per active week
  - Week so far
  - Day so far
- Rules:
  - Configure target hours per week
  - Configure allowed break minutes per 8h of work
  - Break over cap is subtracted from reported worked time
- JSON export/import for backup or migration

## Data Model

Stored under key `time-tracker-v1`:

- `version`
- `settings`
  - `targetHoursPerWeek`
  - `breakMinutesPer8h`
  - `weekStartsOn` (fixed to Monday)
- `sessions[]`
  - `id`, `start`, `end`, `mode`, `project`, `durationMs`
- `activeSession`

## Local Run

Open `index.html` directly in a browser.

## Deploy To GitHub Pages

1. Push this folder to a GitHub repo named `Time-Tracker`.
2. In GitHub: **Settings > Pages**.
3. Set source to **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`.
5. Save and wait for the Pages URL.

## Notes

- Import merges sessions by `id` and skips duplicates.
- Active session is not imported intentionally (to avoid phantom running sessions).
- This app is fully client-side and works offline after initial load.
