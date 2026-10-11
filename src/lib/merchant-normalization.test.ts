import { describe, expect, it } from "vitest";
import { normalizeMerchant } from "@/lib/merchant-normalization";

describe("merchant normalization", () => {
  it("normalizes capitalization, punctuation, and spacing", () => {
    expect(normalizeMerchant("  STARBUCKS #1234 — Vancouver  ")).toBe(
      "starbucks 1234 vancouver",
    );
  });

  it("normalizes compatible Unicode forms", () => {
    expect(normalizeMerchant("Ｓｔｏｒｅ　１２")).toBe("store 12");
  });

  it("preserves letters with accents and meaningful digits", () => {
    expect(normalizeMerchant("Café 49 / Terminal 2")).toBe(
      "café 49 terminal 2",
    );
  });

  it("returns an empty value when no merchant tokens remain", () => {
    expect(normalizeMerchant(" -- / ")).toBe("");
  });
});
