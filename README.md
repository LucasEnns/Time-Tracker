# Time Tracker

Client-side work tracker optimized for mobile and hosted on GitHub Pages.

Live app: https://lucasenns.github.io/Time-Tracker/

## What It Does

- Clock in / clock out tracking with a live timer.
- Project-based tracking with reusable project names.
- Paid break awards automatically added at a configurable interval.
- Dashboard metrics:
  - Day so far
  - Week so far
  - Avg per active week (since start)
  - Over/under vs target (week and since start)
- Since-start metrics exclude the current week so partial-week values do not skew long-range stats.
- Full-screen overlays for Projects and Settings.
- Light and dark mode via system preference.
- English/French UI support based on browser language.

## Recent Entries Editor (Last 14 Days)

- Add backfilled entries with date, project, start, and optional end time.
- Optional end time can start a running session from a past start time.
- Inline edit/save/cancel (no browser prompt popups).
- One editor row open at a time.
- Inline delete with confirmation overlay.

## Project Handling

- Project pickers support:
  - selecting existing projects
  - explicit + Add New Project mode
- Existing project names can still be renamed where applicable.

## Settings

- Target hours per week
- Target days per week
- First day of week (Sunday-Saturday)
- Tracking start date
- Paid break interval (hours)
- Paid break length (minutes)

## Data Storage

- Stored locally in browser localStorage under key `time-tracker-v2`.
- Main saved shape:
  - `version`
  - `settings`
    - `targetHoursPerWeek`
    - `targetDaysPerWeek`
    - `weekStartsOn`
    - `trackingStartDate`
    - `paidBreakIntervalHours`
    - `paidBreakMinutes`
  - `sessions[]`
    - `id`, `start`, `end`, `project`, `durationMs`
  - `paidBreakAwards[]`
    - `id`, `at`, `project`, `durationMs`
  - `activeSession`
  - `activeRunStart`
  - `activeBreaksGranted`
  - `lastProject`

## Import / Export

- Export JSON backup from Settings.
- Import JSON merges by record `id` (does not duplicate existing ids).
- Export Project CSV from Projects.

## Run Locally

Open [index.html](index.html) directly in a browser.

## Deploy / Update GitHub Pages

1. Push to `main`.
2. In GitHub, open repository Settings > Pages.
3. Ensure source is Deploy from a branch, branch `main`, folder `/ (root)`.
