const SIMPLE_CAD_AMOUNT = /^(\d+)(?:\.(\d{1,2}))?$/;
const MAX_DATABASE_CENTS = 2_147_483_647n;

export class MoneyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyValidationError";
  }
}

export function parsePositiveCadAmountToCents(value: string): number {
  const normalized = value.trim();

  if (normalized.startsWith("-")) {
    throw new MoneyValidationError("Amount must be greater than zero.");
  }

  const match = SIMPLE_CAD_AMOUNT.exec(normalized);
  if (!match) {
    throw new MoneyValidationError(
      "Enter a valid amount with up to two decimal places.",
    );
  }

  const dollars = BigInt(match[1]);
  const cents = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  const amountMinor = dollars * 100n + cents;

  if (amountMinor <= 0n) {
    throw new MoneyValidationError("Amount must be greater than zero.");
  }

  if (amountMinor > MAX_DATABASE_CENTS) {
    throw new MoneyValidationError("Amount is too large.");
  }

  return Number(amountMinor);
}

export function formatCadFromCents(amountMinor: number | bigint): string {
  if (typeof amountMinor === "number" && !Number.isSafeInteger(amountMinor)) {
    throw new MoneyValidationError("Amount must use whole cents.");
  }

  const minorUnits = BigInt(amountMinor);
  const isNegative = minorUnits < 0n;
  const absoluteMinorUnits = isNegative ? -minorUnits : minorUnits;
  const dollars = (absoluteMinorUnits / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = (absoluteMinorUnits % 100n).toString().padStart(2, "0");

  return `${isNegative ? "-" : ""}$${dollars}.${cents} CAD`;
}
