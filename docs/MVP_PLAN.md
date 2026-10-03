# Personal Expense Tracker MVP Plan

## 1. Goal

Help one person record expenses and quickly understand where their money goes.

The MVP should answer three questions:

1. How much did I spend this month?
2. Which categories received the most spending?
3. Am I staying within my category budgets?

## 2. Assumptions

- The first version is for one user.
- The first release runs locally and stores financial data only on the user's computer.
- Every transaction and budget in the MVP uses CAD. Configurable and multiple currencies come after the MVP.
- Manual entry and CSV import are part of the MVP.
- Receipt image storage and automatic receipt reading come after the MVP.
- The first release should work well on desktop and mobile-sized browser windows.

## 3. Core user flow

1. Open the application.
2. Add expenses manually or import a CSV file.
3. Review and correct imported rows before saving them.
4. Assign each expense to a category.
5. View monthly totals and spending by category.
6. Set a monthly budget for a category.
7. See how much of each budget has been used.

## 4. MVP scope

### Expense management

- Add an expense with date, amount, merchant, category, and optional note.
- Edit and delete an expense.
- View expenses in a list.
- Filter by month and category.
- Search merchant and original CSV details text.

### Categories

- Start with common categories such as groceries, dining, transportation, housing, shopping, entertainment, health, and other.
- Create custom categories.
- Category renaming and archiving come after the MVP.

### CSV import

The first importer supports the provided credit-card export format instead of a general column-mapping system.

Required headers, in any order:

- `transaction_date`
- `post_date`
- `type`
- `details`
- `amount`
- `currency`

Version 1 import rules:

- Accept UTF-8 comma-separated files with one header row.
- Accept `YYYY-MM-DD` transaction and post dates.
- Accept decimal amounts with up to two decimal places.
- Accept `CAD` and reject mixed or unsupported currencies with a clear message.
- Require `Purchase` amounts to be positive and `Payment` amounts to be negative. Treat unexpected type-and-sign combinations as invalid instead of changing their signs automatically.
- Allow either source sign for refund rows because the provided export uses both; refund rows always require review.
- Import `Purchase` rows as expenses with a positive spending effect.
- Import `Payment` rows as payments with zero spending effect.
- Mark `Refund initiated` and `Refund settled` rows for review with zero spending initially. For each row, the user chooses **Count as refund** or **Exclude from spending**. A counted refund receives a negative spending effect.
- Warn when similar refund rows are both counted, using matching details, absolute amount, currency, and nearby dates. The warning never changes either decision automatically.
- Preserve the original type, signed source amount, transaction date, post date, and `details` text for traceability.
- Initialize `merchant` from the CSV `details` value and allow correction during import review without changing the preserved `sourceDetails`.
- Warn about possible duplicates using transaction date, post date, type, details, amount, and currency. Never discard matching rows automatically because two legitimate transactions can be identical.
- Block a file whose fingerprint matches an earlier import by default. Continue only after the user explicitly chooses **Import again**.
- Save all confirmed rows in one transaction so a failed import cannot leave a partial result.
- Process CSV contents locally and never send financial data to a third-party service.

The review screen shows included expenses, excluded payments, refund candidates, invalid rows, and duplicate warnings before anything is saved. Every invalid row must be explicitly excluded, or the user can cancel the import, fix the source file, and upload it again. Invalid rows are never edited into valid financial data inside the application.

### Local storage and backup

- Store the SQLite database in the application's local data directory and exclude it from Git.
- Provide a backup action that uses SQLite's backup operation to create a consistent timestamped copy.
- Provide a standalone local restore command that runs while the web application is stopped.
- Validate the selected backup's SQLite format and schema before changing the current database.
- Copy the current database to a timestamped safety file, then replace it atomically with the validated backup.
- Reopen the restored database and verify transaction, category, budget, and import counts. Restore the safety copy if verification fails.

### Dashboard

- Show total spending for the selected month.
- Show spending totals by category.
- Show the largest spending category.
- Show recent expenses.
- Allow switching between months.

### Budgets

- Set a monthly amount for any category.
- Show amount spent, amount remaining, and percentage used.
- Clearly mark a budget that has been exceeded.

## 5. Outside the MVP

Build these only after the core workflow is useful:

- Receipt image upload
- Automatic receipt reading with OCR or AI
- Automatic category suggestions
- Bank account connections
- Shared or family accounts
- Recurring-expense detection
- Notifications and spending forecasts
- Multiple currencies and currency conversion
- Native mobile applications
- Advanced reports and exports

## 6. Main screens

### Dashboard

Monthly total, category breakdown, budget progress, and recent expenses.

### Expenses

Expense list with search, filters, add, edit, and delete actions.

### Add or edit expense

A simple form for date, amount, merchant, category, and note.

### Import CSV

File selection, format validation, row review, refund decisions, duplicate warnings, and import confirmation.

### Categories and budgets

Category management and monthly budget settings.

## 7. Initial data model

### Transaction

- `id`
- `transactionDate`
- `postDate` when provided by an import
- `sourceAmountMinor` as the original signed integer amount
- `spendingAmountMinor` as the normalized effect on spending totals
- `currency`
- `merchant` as the displayed and searchable merchant name
- `sourceDetails` containing the unchanged CSV `details` value when imported
- `categoryId` when included in spending
- `note`
- `kind` (`expense`, `payment`, or `refund`)
- `reviewStatus` for unresolved refund and duplicate warnings
- `source` (`manual` or `csv`)
- `sourceType` containing the original CSV transaction type
- `importId` when imported
- `createdAt`
- `updatedAt`

Store both amounts as integer minor units, such as cents, to avoid rounding errors. `sourceAmountMinor` preserves the imported value. `spendingAmountMinor` is positive for expenses, negative for confirmed refunds, and zero for payments or excluded refund stages. Manual expenses must be positive.

### Category

- `id`
- `name`
- `normalizedName` containing the trimmed lowercase name for uniqueness checks
- `color`
- `createdAt`

### Budget

- `id`
- `categoryId`
- `monthKey` as `YYYY-MM`
- `amountMinor`

### Import

- `id`
- `fileName`
- `fileFingerprint`
- `currency`
- `importedAt`
- `rowCount`
- `expenseCount`
- `excludedPaymentCount`
- `refundCount`

### Data constraints

- Store `transactionDate` and `postDate` as `YYYY-MM-DD` strings so timezone conversion cannot move a transaction into another day or month.
- Require `Category.normalizedName` to be unique.
- Require a category for every expense and confirmed refund. Payments and excluded refund stages have no category.
- Require the combination of `Budget.categoryId` and `Budget.monthKey` to be unique.
- Treat every transaction and budget amount as CAD for the MVP.

## 8. Suggested implementation approach

Use a single full-stack web application to keep development and deployment simple:

- TypeScript
- Next.js
- A component library with accessible form and table controls
- Prisma ORM with schema migrations
- SQLite for the local MVP
- PostgreSQL only if a hosted version is built later
- Automated tests for calculations, CSV parsing, duplicate detection, and important user flows

Keep storage behind a small data-access layer so the local database can be replaced without rewriting the interface.

## 9. Build order

### Milestone 1: Expense foundation

- Create the application shell and database.
- Add default categories.
- Implement add, edit, delete, list, and filtering.
- Add validation for dates and positive amounts.

**Done when:** A user can manage a month of expenses without editing the database directly.

### Milestone 2: Dashboard

- Calculate monthly totals.
- Group spending by category.
- Show the largest category and recent expenses.

**Done when:** Dashboard totals exactly match the expense list for the selected month.

### Milestone 3: CSV import

- Upload and validate the supported six-column CSV format.
- Preview expenses, excluded payments, refund candidates, and invalid rows.
- Warn about likely duplicate rows and block repeated files until the user explicitly chooses to import again.
- Let the user categorize expenses, decide each refund row, and explicitly exclude invalid rows.
- Block saving while any required decision remains unresolved.
- Save confirmed rows atomically.

**Done when:** A user can safely review and import the provided statement format without counting payments as spending, double-counting refunds, or silently removing legitimate matching transactions.

### Milestone 4: Budgets

- Create and edit monthly category budgets.
- Calculate used and remaining amounts.
- Display budget progress on the dashboard.

**Done when:** A user can see whether each category is within budget for the selected month.

### Milestone 5: MVP release

- Improve responsive and accessible behavior.
- Add empty, loading, and error states.
- Add a documented backup flow that uses SQLite's backup operation to create a timestamped database copy.
- Add a standalone restore command that validates the backup, creates a safety copy, replaces the database atomically, and verifies the restored data.
- Run automated and manual end-to-end tests.

**Done when:** The main workflows work in desktop and mobile-sized browser windows with no known data-loss defects.

## 10. MVP success checks

The MVP is successful when the user can:

- Record an expense in under 30 seconds.
- Import a CSV after reviewing every row that will be saved.
- Find and correct an expense.
- Understand monthly spending by category at a glance.
- See whether category budgets are on track.
- Refresh or reopen the application without losing data.

Correct totals and safe imports matter more than advanced charts or visual polish.
