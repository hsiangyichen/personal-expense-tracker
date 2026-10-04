# Personal Expense Tracker MVP Development Tasks

This checklist breaks the MVP into small, testable development tasks. Complete tasks in order within each milestone unless a task says otherwise.

## Working rules

- Keep all financial data on the local computer.
- Store money as integer cents.
- Use CAD throughout the MVP.
- Store transaction dates as `YYYY-MM-DD` and budget months as `YYYY-MM`.
- Add automated tests for financial calculations and import decisions.
- Keep receipt processing, cloud hosting, authentication, and multiple currencies outside the MVP.

## Milestone 0: Project foundation

- [x] **T001 — Scaffold the application.** Create a Next.js application using TypeScript.
- [x] **T002 — Add application styling.** Configure Tailwind CSS and an accessible component library.
- [x] **T003 — Add code-quality commands.** Configure formatting, linting, and type checking.
- [x] **T004 — Add unit-test tooling.** Configure Vitest and React Testing Library.
- [x] **T005 — Add browser-test tooling.** Configure Playwright with desktop and mobile-sized projects.
- [x] **T006 — Configure Prisma.** Add Prisma with a local SQLite database.
- [x] **T007 — Protect local data.** Exclude database files, backups, and local environment files from Git.
- [x] **T008 — Add the application shell.** Create navigation for Dashboard, Expenses, Import CSV, and Categories and budgets.

**Milestone complete when:** The empty application starts locally and formatting, linting, type checking, unit tests, and one browser smoke test pass.

## Milestone 1: Database foundation

- [x] **T009 — Define transaction constants.** Define supported kinds, sources, review states, and the CAD currency rule.
- [x] **T010 — Create the Category model.** Add `name`, unique `normalizedName`, `color`, and timestamps.
- [x] **T011 — Create the Import model.** Add file identity, currency, counts, and import time fields.
- [x] **T012 — Create the Transaction model.** Add source and spending amounts, merchant, original CSV details, dates, kind, review state, category, import, and timestamps.
- [x] **T013 — Create the Budget model.** Add category, `monthKey`, amount, and a unique category-and-month constraint.
- [x] **T014 — Add database relationships.** Connect transactions to categories and imports, and budgets to categories.
- [x] **T015 — Create the first migration.** Generate and apply the initial SQLite migration.
- [x] **T016 — Seed default categories.** Add groceries, dining, transportation, housing, shopping, entertainment, health, and other.
- [x] **T017 — Add the data-access boundary.** Create repository functions so pages do not call Prisma directly.
- [x] **T018 — Test database constraints.** Verify category uniqueness, budget uniqueness, and required category rules.

**Milestone complete when:** A fresh local database can be created, seeded, queried, and rejected writes cannot break the MVP constraints.

## Milestone 2: Manual expense management

- [x] **T019 — Define expense validation.** Validate CAD, positive integer cents, `YYYY-MM-DD` dates, merchant, category, and optional note.
- [x] **T020 — Build the money helpers.** Convert display amounts to integer cents and format cents as CAD without floating-point calculations.
- [x] **T021 — Test the money helpers.** Cover whole dollars, cents, invalid decimals, zero, negative manual amounts, and large values.
- [x] **T022 — Build the expense form.** Add date, amount, merchant, category, and note fields.
- [x] **T023 — Create manual expenses.** Validate and save a manual expense with matching source and spending amounts.
- [x] **T024 — Build the expense list.** Show date, merchant, category, amount, and source.
- [x] **T025 — Add month filtering.** Filter the list using the transaction date without timezone conversion.
- [x] **T026 — Add category filtering.** Filter the list by one category.
- [x] **T027 — Add expense search.** Search merchant and original CSV details text.
- [x] **T028 — Edit an expense.** Load an existing expense, validate changes, and save them.
- [x] **T029 — Delete an expense safely.** Require confirmation and remove only the selected transaction.
- [x] **T030 — Add expense flow tests.** Cover create, validation failure, filtering, search, edit, delete, and persistence after reload.

**Milestone complete when:** A user can manage one month of manual expenses without editing the database directly.

## Milestone 3: Dashboard

- [x] **T031 — Build monthly total calculation.** Sum `spendingAmountMinor` for the selected month.
- [x] **T032 — Build category totals.** Group spending by category using integer cents.
- [x] **T033 — Identify the largest category.** Handle ties and months without spending.
- [x] **T034 — Build the month selector.** Switch dashboard data between months.
- [x] **T035 — Build dashboard summary cards.** Show monthly spending, largest category, and recent expenses.
- [x] **T036 — Build the category breakdown.** Show simple category totals without advanced chart interactions.
- [x] **T037 — Test dashboard calculations.** Cover purchases, refunds, payments, empty months, ties, and month boundaries.
- [x] **T038 — Add a dashboard browser test.** Verify dashboard totals match the filtered expense list.

**Milestone complete when:** Dashboard totals exactly match the transactions that affect spending for the selected month.

## Milestone 4: CSV parsing and validation

- [x] **T039 — Add a safe CSV fixture.** Create synthetic test data using the six supported headers and no real financial information.
- [x] **T040 — Validate CSV headers.** Accept required headers in any order and reject missing or unknown formats clearly.
- [x] **T041 — Parse CSV rows.** Read UTF-8 comma-separated rows without saving them.
- [x] **T042 — Validate CSV dates.** Accept only valid `YYYY-MM-DD` transaction and post dates.
- [x] **T043 — Validate CSV amounts.** Accept signed decimal amounts with no more than two decimal places and convert them to cents.
- [x] **T044 — Validate CSV currency.** Accept CAD and reject unsupported or mixed currencies.
- [x] **T045 — Validate and normalize purchases.** Require a positive source amount, set spending to that positive amount, and initialize merchant from `details`; treat a zero or negative purchase as invalid.
- [x] **T046 — Validate and normalize payments.** Require a negative source amount and preserve the payment with zero spending and no category; treat a zero or positive payment as invalid.
- [x] **T047 — Normalize refund candidates.** Accept either non-zero source sign, mark initiated and settled refund rows for review, and give them zero spending initially.
- [x] **T048 — Preserve source values.** Keep the original type, signed amount, dates, and `details` text unchanged.
- [x] **T049 — Test CSV parsing.** Cover reordered headers, quoted commas, blank lines, malformed rows, unsupported types, invalid dates, invalid amounts, mixed currencies, negative purchases, positive payments, and both refund source signs.

**Milestone complete when:** The supported CSV can be parsed into validated review rows without writing to the database.

## Milestone 5: CSV review and import

- [x] **T050 — Calculate a file fingerprint.** Hash the original file bytes before parsing.
- [x] **T051 — Handle repeated files.** Block an import whose fingerprint matches an earlier import and continue only after an explicit **Import again** decision.
- [x] **T052 — Detect possible duplicate rows.** Compare the six source fields and warn without automatically removing either row.
- [x] **T053 — Build the import summary.** Show included purchases, excluded payments, refund candidates, invalid rows, and duplicate warnings.
- [x] **T054 — Build the row review table.** Let the user inspect every row before saving.
- [x] **T055 — Add merchant correction.** Allow merchant edits while preserving `sourceDetails`.
- [x] **T056 — Add category assignment.** Require a category for included purchases and confirmed refunds.
- [x] **T057 — Add refund decisions.** Let the user choose **Count as refund** or **Exclude from spending** for every refund candidate; set counted refunds to a negative spending effect and warn when similar rows are both counted.
- [x] **T058 — Add duplicate decisions.** Let the user include or exclude each warned row manually.
- [x] **T059 — Resolve or block invalid rows.** Let the user explicitly exclude each invalid row or cancel the import and re-upload a corrected file; prevent saving while invalid rows or required decisions remain unresolved.
- [x] **T060 — Save imports atomically.** Create the import and all confirmed transactions in one database transaction.
- [x] **T061 — Show the import result.** Display saved, excluded-payment, refund, duplicate-warning, and invalid-row counts.
- [x] **T062 — Test import rollback.** Force a failed row and verify that no partial import or transactions remain.
- [x] **T063 — Add CSV browser tests.** Cover a successful import, both refund decisions, similar-refund warnings, duplicate decisions, repeated-file blocking and explicit approval, invalid-row exclusion, and correction before saving.

**Milestone complete when:** A user can review and import the supported statement without counting payments or refund stages incorrectly.

## Milestone 6: Categories and budgets

- [ ] **T064 — Build category creation.** Validate, normalize, and save a custom category name and color.
- [ ] **T065 — Handle duplicate category names.** Show a concise message when capitalization or spacing matches an existing category.
- [ ] **T066 — Build budget validation.** Validate category, positive integer cents, and `YYYY-MM` month keys; budget amounts use the application's CAD currency.
- [ ] **T067 — Create a monthly budget.** Save one budget for a category and month.
- [ ] **T068 — Edit a monthly budget.** Update the existing category-and-month budget instead of creating another row.
- [ ] **T069 — Calculate budget progress.** Calculate used, remaining, percentage used, and exceeded state.
- [ ] **T070 — Display budget progress.** Show a simple progress bar and exact amounts on the dashboard.
- [ ] **T071 — Test budget behavior.** Cover no spending, refunds, exact limit, exceeded limit, and duplicate month attempts.

**Milestone complete when:** A user can create or update category budgets and see accurate monthly progress.

## Milestone 7: Backup, restore, and release quality

- [ ] **T072 — Choose the local data directory.** Resolve and document where the SQLite database and backups are stored.
- [ ] **T073 — Create a safe backup service.** Use SQLite's backup operation to create a consistent timestamped database copy.
- [ ] **T074 — Build the backup action.** Let the user create a backup and see its location and completion time.
- [ ] **T075 — Create the standalone restore command.** Require the web application to be stopped, accept a selected backup path, and refuse to run when the active database is in use.
- [ ] **T076 — Implement safe database replacement.** Validate the backup's SQLite format and schema, create a timestamped safety copy of the current database, and atomically replace it only after both checks succeed.
- [ ] **T077 — Verify or roll back the restore.** Open the restored database, check transaction, category, budget, and import counts, and restore the safety copy if verification fails.
- [ ] **T078 — Test backup and restore.** Cover successful restoration, malformed backups, incompatible schemas, interrupted replacement, failed count verification, and recovery from the safety copy.
- [ ] **T079 — Add empty states.** Cover no expenses, no results, no budgets, and no imports.
- [ ] **T080 — Add loading and error states.** Prevent duplicate submissions and show concise recovery actions.
- [ ] **T081 — Check keyboard and screen-reader use.** Verify forms, dialogs, tables, validation messages, and progress information.
- [ ] **T082 — Check responsive layouts.** Verify every core screen at desktop and mobile-sized browser widths.
- [ ] **T083 — Run the complete test suite.** Run formatting, linting, type checking, unit tests, and browser tests.
- [ ] **T084 — Complete a real-data rehearsal.** Use a local copy of the provided statement, verify totals manually, and keep the file and database out of Git.
- [ ] **T085 — Write local setup instructions.** Document installation, startup, database location, backup, restore, and test commands.

**Milestone complete when:** The application passes the MVP success checks with no known data-loss or financial-total defects.

## After the MVP

Create separate plans later for receipt uploads, OCR or AI extraction, automatic categorization, hosted access, authentication, multiple currencies, bank connections, shared accounts, native applications, and advanced reports.
