# Personal Expense Tracker

A local personal web application for recording expenses, importing credit-card CSV files, categorizing spending, setting monthly budgets, and creating SQLite backups.

## Requirements

- Node.js 20
- npm
- A local filesystem for the SQLite database and backups

Use personal accounts and synthetic test data for development. Never commit real statements, receipts, databases, backups, tokens, or other financial data.

## Local setup

```bash
npm install --registry=https://registry.npmjs.org
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

The application includes:

- Dashboard totals, category breakdowns, recent expenses, and budget progress
- Manual expense creation, editing, filtering, search, and deletion
- Local CSV review and import with refund and duplicate decisions
- Custom categories and monthly budgets
- Local database backup and import history

## Local data

The default `.env` uses:

```text
DATABASE_URL="file:../data/expense-tracker.db"
```

Prisma resolves that path from the project's `prisma/` directory, so the active database is:

```text
data/expense-tracker.db
```

Backups are written to:

```text
backups/
```

Both directories and all SQLite sidecar files are ignored by Git. The **Data & backup** page shows the resolved absolute paths used by the running application.

## Create a backup

Open **Data & backup** and select **Create backup**. The application uses SQLite `VACUUM INTO` to create a consistent timestamped copy while the application is running. It validates the copy before reporting success.

Keep important backups on another personal storage device. A backup on the same disk does not protect against disk failure.

## Restore a backup

Restoration replaces the active database, so stop the web application first with **Ctrl+C**. Then run:

```bash
npm run db:restore -- /absolute/path/to/backup.db --confirm
```

The restore command:

1. Refuses to continue while the application is running.
2. Validates the SQLite header, integrity, relationships, schema, and migration history.
3. Creates a timestamped safety copy of the current database.
4. Copies and synchronizes the selected backup beside the active database.
5. Atomically replaces the active database and clears stale SQLite sidecars.
6. Verifies category, transaction, budget, and import counts.
7. Restores the safety copy automatically if verification fails.

The command prints the restored file, safety-copy path, and verified counts.

## Tests and quality checks

```bash
npm run validate
npm run test:e2e
npm run build
```

Useful individual commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Unit and database tests use disposable SQLite files. Playwright uses separate disposable database and backup paths. Automated tests must never open the personal database.

## Planning documents

- [MVP plan](docs/MVP_PLAN.md)
- [MVP development tasks](docs/DEVELOPMENT_TASKS.md)
