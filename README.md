# SpendWise

Personal income, expenses, budgets, and spending analytics, built with React, Bootstrap, Express, and PostgreSQL. This is a single-user local application; authentication is outside the initial project scope.

## Live GitHub Pages version

https://SutikshanUpman.github.io/expenditure_tracker/

The hosted version runs PostgreSQL in the browser using PGlite and saves transactions and budgets in IndexedDB, separately for each BT ID on that browser. The name/BT ID form selects a local workspace; it is not secure authentication. Data is not synced between devices. Clearing site data removes records; use CSV export for backups.

The original Express/PostgreSQL server mode remains available below. Both modes use the same SQL queries and validation from `shared/`. The Pages build has no backend server or database credentials.

`npm run build:pages` builds for the repository subpath. `.github/workflows/pages.yml` runs the tests, builds the static app, tests browser persistence with Chromium, and deploys to GitHub Pages on pushes to main.

## Run with sample data

Requires Node.js 22.12+.

```sh
npm ci
npm run demo
```

Open http://127.0.0.1:5173. The demo uses embedded PostgreSQL (PGlite) with temporary sample records. Demo changes reset when the server restarts. No database installation is needed for this mode.

## Run with persistent PostgreSQL

1. Create a PostgreSQL database named `spendwise`.
2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` to your database credentials.
3. Run:

```sh
npm ci
npm run db:setup
npm run dev
```

Open http://127.0.0.1:5173. Database setup is safe to repeat. To add optional sample records to a fresh database, run `npm run db:setup -w backend -- --demo` once.

## Docker

With Docker Desktop running:

```sh
docker compose up --build -d
```

Open http://localhost:5000. PostgreSQL data persists in the `postgres_data` volume. Schema and base categories initialize on the first database startup. Docker builds from the repository root using `backend/Dockerfile` and serves the compiled React app through Express.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | React and API development servers; requires PostgreSQL |
| `npm run demo` | Local preview with temporary sample data |
| `npm test` | PostgreSQL-backed API and React component tests |
| `npm run build` | Build the React application |
| `npm start` | Serve the API and built frontend on port 5000 |
| `npm run format` | Format JavaScript, JSX, CSS, JSON, and configuration |

## Features and API

- Income and expense CRUD; month, date range, type, category, city, and search filters; pagination.
- Expense-category monthly budgets with utilization and overspending warnings.
- Monthly income, expense, balance, category distribution, six-month trends, city totals, and budget comparisons.
- Custom income/expense categories and filtered CSV export for Power BI.
- PostgreSQL constraints, indexes, a monthly expense view, and example analytical queries.

Endpoints are under `/api`: `transactions`, `transactions/:id`, `transactions/export`, `categories`, `budgets`, `budgets/:id`, `analytics/summary`, `analytics/categories`, `analytics/monthly`, `analytics/cities`, `user`, and `health`. Month filters use `YYYY-MM`; transaction dates use `YYYY-MM-DD`. Transaction lists return `{ data, pagination }`; errors return `{ error }`.

The four implementation phases are recorded in Git: database foundation, API, frontend, and integration/testing. Power BI data is available through the CSV export; starter measures are in `powerbi/measures.dax`. Power BI Desktop report authoring and cloud deployment are not included in the coding scope.

## Verification

`npm test` runs API tests against an actual embedded PostgreSQL engine and UI interaction tests in jsdom. CI also builds and starts the Docker Compose stack. These tests do not replace browser layout testing. Financial amounts are stored as PostgreSQL `NUMERIC(10,2)`, and date-only values remain date-only strings.

Keep this initial version on localhost: it has no login or access control. Use your own database credentials in ignored `.env` files. The optional web font falls back to system sans-serif when offline.
