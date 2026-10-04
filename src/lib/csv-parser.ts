import Papa, { type ParseError } from "papaparse";
import {
  CURRENCY,
  type ReviewStatus,
  type TransactionKind,
} from "@/lib/constants";
import { isValidDateOnly } from "@/lib/expense-validation";

export const CSV_HEADERS = [
  "transaction_date",
  "post_date",
  "type",
  "details",
  "amount",
  "currency",
] as const;

const CSV_HEADER_SET = new Set<string>(CSV_HEADERS);
const REFUND_TYPES = new Set(["Refund initiated", "Refund settled"]);
const SIGNED_DECIMAL_AMOUNT = /^[+-]?\d+(?:\.\d{1,2})?$/;
const MAX_DATABASE_CENTS = 2_147_483_647n;

type CsvRecord = Record<(typeof CSV_HEADERS)[number], string> & {
  __parsed_extra?: string[];
};

type NormalizedCsvTransaction =
  | {
      kind: TransactionKind;
      spendingAmountMinor: number;
      reviewStatus: ReviewStatus;
    }
  | { error: string };

export type CsvSourceValues = {
  transactionDate: string;
  postDate: string;
  sourceType: string;
  sourceAmount: string;
  sourceDetails: string;
  currency: string;
};

export type ValidatedCsvRow = CsvSourceValues & {
  status: "valid";
  rowNumber: number;
  sourceAmountMinor: number;
  spendingAmountMinor: number;
  merchant: string;
  kind: TransactionKind;
  reviewStatus: ReviewStatus;
  categoryId: null;
};

export type InvalidCsvRow = CsvSourceValues & {
  status: "invalid";
  rowNumber: number;
  errors: string[];
};

export type CsvReviewRow = ValidatedCsvRow | InvalidCsvRow;

export type CsvParseResult = {
  headerErrors: string[];
  fileErrors: string[];
  rows: CsvReviewRow[];
  isValid: boolean;
};

export function parseCreditCardCsv(csv: string): CsvParseResult {
  const parsed = Papa.parse<CsvRecord>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header, index) =>
      index === 0 ? header.replace(/^\uFEFF/, "") : header,
  });
  const headerErrors = validateHeaders(
    parsed.meta.fields ?? [],
    parsed.meta.renamedHeaders,
  );

  if (headerErrors.length > 0) {
    return { headerErrors, fileErrors: [], rows: [], isValid: false };
  }

  const errorsByRow = groupParseErrors(parsed.errors);
  const rows = parsed.data.map((record, index) =>
    validateRecord(record, index + 2, errorsByRow.get(index) ?? []),
  );
  const currencies = new Set(
    rows.map((row) => row.currency.trim()).filter(Boolean),
  );
  const parseFileErrors = parsed.errors
    .filter(
      (error) =>
        error.code !== "TooFewFields" && error.code !== "TooManyFields",
    )
    .map((error) => `Malformed CSV: ${error.message}.`);
  const currencyErrors =
    currencies.size > 1 || [...currencies].some((value) => value !== CURRENCY)
      ? ["CSV rows must all use CAD."]
      : [];
  const fileErrors = unique([...parseFileErrors, ...currencyErrors]);

  return {
    headerErrors,
    fileErrors,
    rows,
    isValid:
      fileErrors.length === 0 && rows.every((row) => row.status === "valid"),
  };
}

function validateHeaders(
  headers: string[],
  renamedHeaders?: Record<string, string>,
): string[] {
  const errors: string[] = [];
  const missing = CSV_HEADERS.filter((header) => !headers.includes(header));
  const unknown = headers.filter((header) => !CSV_HEADER_SET.has(header));

  if (missing.length > 0) {
    errors.push(`Missing required headers: ${missing.join(", ")}.`);
  }
  if (unknown.length > 0) {
    errors.push(`Unsupported headers: ${unknown.join(", ")}.`);
  }
  if (
    new Set(headers).size !== headers.length ||
    Object.keys(renamedHeaders ?? {}).length > 0
  ) {
    errors.push("CSV headers must not be repeated.");
  }

  return errors;
}

function groupParseErrors(errors: ParseError[]) {
  const errorsByRow = new Map<number, string[]>();

  for (const error of errors) {
    if (
      (error.code === "TooFewFields" || error.code === "TooManyFields") &&
      typeof error.row === "number"
    ) {
      const rowErrors = errorsByRow.get(error.row) ?? [];
      rowErrors.push("Row does not contain exactly six values.");
      errorsByRow.set(error.row, rowErrors);
    }
  }

  return errorsByRow;
}

function validateRecord(
  record: CsvRecord,
  rowNumber: number,
  parseErrors: string[],
): CsvReviewRow {
  const source: CsvSourceValues = {
    transactionDate: record.transaction_date ?? "",
    postDate: record.post_date ?? "",
    sourceType: record.type ?? "",
    sourceAmount: record.amount ?? "",
    sourceDetails: record.details ?? "",
    currency: record.currency ?? "",
  };
  const errors = [...parseErrors];

  if (record.__parsed_extra?.length) {
    errors.push("Row does not contain exactly six values.");
  }
  if (!isValidDateOnly(source.transactionDate)) {
    errors.push("Transaction date must use a valid YYYY-MM-DD date.");
  }
  if (!isValidDateOnly(source.postDate)) {
    errors.push("Post date must use a valid YYYY-MM-DD date.");
  }
  if (!source.sourceDetails.trim()) {
    errors.push("Details must not be empty.");
  }
  if (source.currency !== CURRENCY) {
    errors.push("Currency must be CAD.");
  }

  const amountResult = parseSignedAmountToCents(source.sourceAmount);
  if (typeof amountResult === "string") {
    errors.push(amountResult);
  }

  const normalized =
    typeof amountResult === "number"
      ? normalizeTransaction(source.sourceType, amountResult)
      : null;
  if (normalized && "error" in normalized) {
    errors.push(normalized.error);
  }

  if (
    errors.length > 0 ||
    typeof amountResult !== "number" ||
    !normalized ||
    "error" in normalized
  ) {
    return { ...source, status: "invalid", rowNumber, errors: unique(errors) };
  }

  return {
    ...source,
    ...normalized,
    status: "valid",
    rowNumber,
    sourceAmountMinor: amountResult,
    merchant: source.sourceDetails,
    categoryId: null,
  };
}

function parseSignedAmountToCents(value: string): number | string {
  const match = SIGNED_DECIMAL_AMOUNT.exec(value);
  if (!match) {
    return "Amount must be a signed decimal with up to two decimal places.";
  }

  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.replace(/^[+-]/, "");
  const separator = unsigned.indexOf(".");
  const dollars = separator === -1 ? unsigned : unsigned.slice(0, separator);
  const fraction = separator === -1 ? "" : unsigned.slice(separator + 1);
  const absoluteMinor =
    BigInt(dollars) * 100n + BigInt(fraction.padEnd(2, "0") || "0");

  if (absoluteMinor > MAX_DATABASE_CENTS) {
    return "Amount is too large.";
  }

  return Number(sign * absoluteMinor);
}

function normalizeTransaction(
  type: string,
  sourceAmountMinor: number,
): NormalizedCsvTransaction {
  if (type === "Purchase") {
    return sourceAmountMinor > 0
      ? {
          kind: "expense" as const,
          spendingAmountMinor: sourceAmountMinor,
          reviewStatus: "included" as const,
        }
      : { error: "Purchase amount must be greater than zero." };
  }

  if (type === "Payment") {
    return sourceAmountMinor < 0
      ? {
          kind: "payment" as const,
          spendingAmountMinor: 0,
          reviewStatus: "excluded" as const,
        }
      : { error: "Payment amount must be less than zero." };
  }

  if (REFUND_TYPES.has(type)) {
    return sourceAmountMinor !== 0
      ? {
          kind: "refund" as const,
          spendingAmountMinor: 0,
          reviewStatus: "needs_review" as const,
        }
      : { error: "Refund amount must not be zero." };
  }

  return { error: `Unsupported transaction type: ${type || "(empty)"}.` };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
