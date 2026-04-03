# Project Notes

## Current App State

- App is a full-stack crypto trading journal.
- Frontend uses React + Vite.
- Backend uses Express + Prisma + SQLite.
- Delta Exchange API keys are loaded from `.env` and kept server-side.
- Market pulse is implemented with curated news + OpenAI fallback support.

## Delta Integration Status

- Delta sync is working with authenticated backend requests.
- Full historical fill backfill is implemented through pagination.
- Current local dataset imported from Delta: `725` trades at the last verified sync.
- Demo trades are removed once real Delta trades are imported.

## PnL Logic Status

- Early generic PnL estimation was replaced.
- Current realized PnL uses Delta fill metadata from `meta_data.new_position.realized_pnl`.
- Per-fill realized PnL is derived from Delta's cumulative realized PnL progression.
- This is much more accurate than the previous fallback, but still not claimed as fully reconciled against Delta exports/account statements.

## UI Status

- UI was restyled to match the darker "terminal" look from the external `CryptoJournal.jsx` reference.
- Reference was used for visual direction only, not as an implementation source of truth.
- Current app keeps existing Delta-backed data flow and backend logic.

## Known Gaps

- Data accuracy is improved, but not yet fully reconciled against official Delta CSV/export totals.
- Frontend dev server can occasionally be flaky in this Windows + OneDrive workspace.
- Market section is visually improved, but still lighter than the full chart-heavy reference experience.
- Analysis visuals can still be expanded with richer chart components.

## Recommended Next Steps

1. Add reconciliation against Delta export/CSV so totals can be verified.
2. Add richer charts for analysis and market views.
3. Improve dev-server stability in the local Windows environment.
4. Add explicit sync modes such as `latest sync` and `full resync`.
