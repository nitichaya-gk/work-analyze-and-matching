# CareerOS

Personal career workspace for saving job opportunities, reviewing requirement evidence,
planning learning tasks and tracking applications. Thailand-first, with Thai copy and English labels.

This delivery is the **local prototype** defined in [the implementation plan](docs/IMPLEMENTATION_PLAN.md).
It stores data in this browser's localStorage. No account, server sync, external job ingestion,
LLM requests or automatic application submission is enabled.

## Run

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Start with **My profile & skills**, save a job with a JD you own or
have permission to use, analyze it, and generate a learning plan. Restricted platforms accept
links and your own metadata only. You confirm application status changes yourself.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests launch the production server on port 3100 and cover desktop and a 390px mobile viewport.
Run the build first. Screenshots and failure traces are written under `test-results/`.
The build uses Next.js's supported Webpack option because Turbopack's internal port binding
fails in this managed environment. The development command retains Next.js defaults.

## Data and analysis

- Export JSON or reset local data in **Settings & privacy**. Reset requires typing `DELETE`.
- Corrupt or incompatible saved data is preserved and writes are blocked until reset;
  the original raw data can still be downloaded when browser storage is readable.
- Failed writes leave the import form open. Do not keep CVs, passwords or secrets in local mode.
- The deterministic rules parser uses a limited Tech taxonomy, not an LLM. Review its evidence,
  priority and confidence; mixed or negated clauses may need manual correction.
- Coverage uses self-reported levels and explicit weights. It is not a hiring probability.
- Daily task generation and date changes respect capacity. Follow-up dates are records;
  no notifications are delivered.

## Database foundation

`supabase/migrations/202610210001_workspace.sql` defines an initial user-owned schema,
RLS policies and composite owner foreign keys. It is **not connected to the UI** and has
not yet been executed against Supabase. Files, auth, async AI, transactional status changes,
server-side capacity enforcement and production data-rights flows remain integration work.

In a disposable Supabase development database, apply the migration and run:

```sh
psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610210001_workspace.sql
psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ownership.sql
```

The ownership test rolls back fixtures and checks cross-user reads/writes, ownership changes,
child reparenting and application-history preservation. Database execution and authenticated
end-to-end isolation are separate required gates before production use. See
[PRODUCT_REQUIREMENTS.md](docs/PRODUCT_REQUIREMENTS.md) for the broader product scope.
# work-analyze-and-matching
