const MERCHANT_SEPARATORS = /[^\p{Letter}\p{Number}]+/gu;

export function normalizeMerchant(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-CA")
    .replace(MERCHANT_SEPARATORS, " ")
    .trim();
}
