export const CURRENCY = "CAD" as const;

export const TRANSACTION_KINDS = ["expense", "payment", "refund"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const TRANSACTION_SOURCES = ["manual", "csv"] as const;
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

export const REVIEW_STATUSES = [
  "included",
  "excluded",
  "needs_review",
  "duplicate_warning",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
