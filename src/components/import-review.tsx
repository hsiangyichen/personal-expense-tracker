"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  previewImportAction,
  saveImportAction,
  type ImportPreview,
  type ImportSaveSummary,
} from "@/app/import/actions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { CsvReviewRow } from "@/lib/csv-parser";
import type { ImportRowDecision } from "@/lib/import-workflow";
import { normalizeMerchant } from "@/lib/merchant-normalization";
import { formatCadFromCents } from "@/lib/money";

const fieldClassName =
  "bg-card min-h-11 w-full rounded-xl border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-blue-100";

type CategoryOption = {
  id: string;
  name: string;
};

type ImportReviewProps = {
  categories: CategoryOption[];
};

export function ImportReview({ categories }: ImportReviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ImportRowDecision>>(
    {},
  );
  const [importAgain, setImportAgain] = useState(false);
  const [message, setMessage] = useState<string>();
  const [result, setResult] = useState<ImportSaveSummary | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const duplicateRows = useMemo(
    () =>
      new Set(
        preview?.duplicateGroups.flatMap((group) => group.rowNumbers) ?? [],
      ),
    [preview],
  );
  const categorizationsByRow = useMemo(
    () =>
      new Map(
        preview?.categorizations.map((categorization) => [
          categorization.rowNumber,
          categorization,
        ]) ?? [],
      ),
    [preview],
  );
  const unresolved = preview ? countUnresolved(preview.rows, decisions) : 0;
  const countedSimilarRefunds = preview
    ? preview.similarRefundPairs.filter(({ rowNumbers }) =>
        rowNumbers.every(
          (rowNumber) =>
            !decisions[rowNumber]?.excluded &&
            Boolean(decisions[rowNumber]?.categoryId),
        ),
      )
    : [];

  if (result) {
    return (
      <ImportResult
        onReset={() => {
          setResult(null);
          setPreview(null);
          setSelectedFile(null);
          setDecisions({});
          setImportAgain(false);
          setMessage(undefined);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        summary={result}
      />
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardTitle>Choose a statement</CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          The file stays on this computer. Nothing is saved until you finish
          reviewing every row.
        </p>
        <p className="bg-background text-muted-foreground mt-4 rounded-xl p-3 text-sm leading-relaxed">
          Use a CSV with these columns: transaction_date, post_date, type,
          details, amount, and currency. Dates must use YYYY-MM-DD and currency
          must be CAD.
        </p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const file = fileInputRef.current?.files?.[0];
            if (!file) {
              setMessage("Choose a CSV file to continue.");
              return;
            }

            setMessage(undefined);
            setPreview(null);
            setSelectedFile(null);
            setDecisions({});
            setImportAgain(false);
            startTransition(async () => {
              const formData = new FormData(form);
              const response = await previewImportAction(formData);
              if (!response.success) {
                setMessage(response.message);
                return;
              }

              setSelectedFile(file);
              setPreview(response.preview);
              setDecisions(
                initialDecisions(
                  response.preview.rows,
                  response.preview.categorizations,
                ),
              );
              setImportAgain(false);
            });
          }}
        >
          <div className="min-w-0 flex-1">
            <label className="text-sm font-medium" htmlFor="csv-file">
              CSV file
            </label>
            <input
              accept=".csv,text/csv"
              className={`${fieldClassName} file:bg-muted file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:font-semibold`}
              id="csv-file"
              name="file"
              disabled={pending}
              onChange={() => {
                const hadPreview = Boolean(preview);
                setPreview(null);
                setSelectedFile(null);
                setDecisions({});
                setImportAgain(false);
                setMessage(
                  hadPreview
                    ? "Review the newly selected file before importing."
                    : undefined,
                );
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>
          <Button disabled={pending || !hydrated} type="submit">
            {pending ? "Reading…" : "Review file"}
          </Button>
        </form>
      </Card>

      {message ? (
        <p
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      {preview ? (
        <>
          <ImportSummary decisions={decisions} preview={preview} />

          {preview.alreadyImported ? (
            <div
              className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950"
              role="alert"
            >
              <p className="font-semibold">This file was already imported.</p>
              <label className="mt-3 flex min-h-11 items-center gap-3">
                <input
                  checked={importAgain}
                  className="size-5"
                  onChange={(event) => setImportAgain(event.target.checked)}
                  type="checkbox"
                />
                Import again
              </label>
            </div>
          ) : null}

          {countedSimilarRefunds.length > 0 ? (
            <div
              className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950"
              role="alert"
            >
              <p className="font-semibold">Similar refunds are both counted.</p>
              <ul className="mt-1 list-disc pl-5">
                {countedSimilarRefunds.map(({ rowNumbers }) => (
                  <li key={rowNumbers.join("-")}>
                    Rows {rowNumbers[0]} and {rowNumbers[1]} have matching
                    details and amounts on nearby dates.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ReviewTable
            categories={categories}
            categorizations={categorizationsByRow}
            decisions={decisions}
            duplicateRows={duplicateRows}
            onDecisionChange={(rowNumber, change) =>
              setDecisions((current) => ({
                ...current,
                [rowNumber]: { ...current[rowNumber], ...change, rowNumber },
              }))
            }
            rows={preview.rows}
          />

          <Card>
            <CardTitle>Finish import</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm" role="status">
              {unresolved === 0
                ? "All required decisions are complete."
                : `${unresolved} row${unresolved === 1 ? "" : "s"} still need review.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                disabled={
                  pending ||
                  unresolved > 0 ||
                  (preview.alreadyImported && !importAgain)
                }
                onClick={() => {
                  if (!selectedFile) {
                    setMessage("Choose the CSV again before importing.");
                    return;
                  }

                  setMessage(undefined);
                  startTransition(async () => {
                    const formData = new FormData();
                    formData.set("file", selectedFile);
                    formData.set("fingerprint", preview.fingerprint);
                    formData.set(
                      "decisions",
                      JSON.stringify(
                        Object.values(decisions).sort(
                          (left, right) => left.rowNumber - right.rowNumber,
                        ),
                      ),
                    );
                    formData.set("importAgain", String(importAgain));
                    const response = await saveImportAction(formData);
                    if (!response.success) {
                      setMessage(response.message);
                      return;
                    }
                    setResult(response.summary);
                  });
                }}
              >
                {pending ? "Importing…" : "Import reviewed rows"}
              </Button>
              <Button
                onClick={() => {
                  setPreview(null);
                  setSelectedFile(null);
                  setDecisions({});
                  setImportAgain(false);
                  setMessage(undefined);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                variant="secondary"
              >
                Cancel import
              </Button>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function ImportSummary({
  decisions,
  preview,
}: Readonly<{
  decisions: Record<number, ImportRowDecision>;
  preview: ImportPreview;
}>) {
  const validRows = preview.rows.filter((row) => row.status === "valid");
  const categorizationsByRow = new Map(
    preview.categorizations.map((categorization) => [
      categorization.rowNumber,
      categorization,
    ]),
  );
  const automaticSelections = validRows.filter((row) => {
    const decision = decisions[row.rowNumber];
    const categorization = categorizationsByRow.get(row.rowNumber);
    return (
      row.kind !== "payment" &&
      !decision?.excluded &&
      categorization?.status === "matched" &&
      decision?.categoryId === categorization.categoryId &&
      normalizeMerchant(decision?.merchant ?? "") ===
        categorization.normalizedMerchant
    );
  }).length;
  const needsCategory = validRows.filter((row) => {
    const decision = decisions[row.rowNumber];
    if (row.kind === "payment" || decision?.excluded) {
      return false;
    }
    return !decision?.categoryId;
  }).length;
  const items = [
    { label: "Automatically selected", value: automaticSelections },
    { label: "Needs category", value: needsCategory },
    {
      label: "Included purchases",
      value: validRows.filter((row) => row.kind === "expense").length,
    },
    {
      label: "Excluded payments",
      value: validRows.filter((row) => row.kind === "payment").length,
    },
    {
      label: "Refund candidates",
      value: validRows.filter((row) => row.kind === "refund").length,
    },
    {
      label: "Invalid rows",
      value: preview.rows.filter((row) => row.status === "invalid").length,
    },
    { label: "Duplicate warnings", value: preview.duplicateGroups.length },
  ];

  return (
    <section aria-labelledby="summary-heading">
      <h2 className="text-xl font-semibold" id="summary-heading">
        Import summary
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        {preview.fileName} · {preview.rows.length} rows
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {items.map((item) => (
          <Card className="rounded-xl" key={item.label}>
            <p className="text-muted-foreground text-sm">{item.label}</p>
            <p className="mt-1 text-2xl font-bold">{item.value}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ReviewTable({
  categories,
  categorizations,
  decisions,
  duplicateRows,
  onDecisionChange,
  rows,
}: Readonly<{
  categories: CategoryOption[];
  categorizations: Map<number, ImportPreview["categorizations"][number]>;
  decisions: Record<number, ImportRowDecision>;
  duplicateRows: Set<number>;
  onDecisionChange: (
    rowNumber: number,
    change: Partial<ImportRowDecision>,
  ) => void;
  rows: CsvReviewRow[];
}>) {
  return (
    <section aria-labelledby="review-heading" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold" id="review-heading">
          Review rows
        </h2>
        <Link
          className="text-primary text-sm font-semibold hover:underline"
          href="/categories#categorization-rules"
        >
          Manage categorization rules
        </Link>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">
        Correct merchant names and assign categories. Kept purchases and refunds
        count toward spending, payments remain excluded, and Delete skips a row.
        Original details remain unchanged.
      </p>
      <div className="mt-3 grid min-w-0 gap-3 md:hidden">
        {rows.map((row) => (
          <MobileReviewCard
            categories={categories}
            categorization={categorizations.get(row.rowNumber)}
            decision={decisions[row.rowNumber]}
            duplicateWarning={duplicateRows.has(row.rowNumber)}
            key={row.rowNumber}
            onDecisionChange={(change) =>
              onDecisionChange(row.rowNumber, change)
            }
            row={row}
          />
        ))}
      </div>
      <div className="relative mt-3 hidden w-full max-w-full overflow-x-auto overscroll-x-contain rounded-xl border bg-white md:block">
        <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              {[
                "Row",
                "Date",
                "Type",
                "Amount",
                "Original details",
                "Merchant",
                "Category",
                "Row actions",
              ].map((heading) => (
                <th
                  className="px-3 py-3 font-semibold"
                  key={heading}
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ReviewRow
                categories={categories}
                categorization={categorizations.get(row.rowNumber)}
                decision={decisions[row.rowNumber]}
                duplicateWarning={duplicateRows.has(row.rowNumber)}
                key={row.rowNumber}
                onDecisionChange={(change) =>
                  onDecisionChange(row.rowNumber, change)
                }
                row={row}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MobileReviewCard({
  categories,
  categorization,
  decision,
  duplicateWarning,
  onDecisionChange,
  row,
}: Readonly<{
  categories: CategoryOption[];
  categorization?: ImportPreview["categorizations"][number];
  decision: ImportRowDecision;
  duplicateWarning: boolean;
  onDecisionChange: (change: Partial<ImportRowDecision>) => void;
  row: CsvReviewRow;
}>) {
  const deleted = decision?.excluded === true;
  const merchantTooLong = (decision?.merchant?.trim().length ?? 0) > 120;
  const automaticMatch =
    categorization?.status === "matched" &&
    normalizeMerchant(decision?.merchant ?? "") ===
      categorization.normalizedMerchant &&
    decision?.categoryId === categorization.categoryId;
  const selectedCategory = categories.find(
    (category) => category.id === decision?.categoryId,
  );
  const canRememberRule =
    row.status === "valid" &&
    row.kind !== "payment" &&
    Boolean(decision?.categoryId) &&
    !deleted &&
    !automaticMatch;

  return (
    <article
      className="bg-card min-w-0 rounded-xl border p-4 shadow-sm"
      data-row-number={row.rowNumber}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-semibold">
            Row {row.rowNumber} · {row.transactionDate || "No date"}
          </p>
          <p className="mt-1 font-semibold break-words">
            {row.sourceDetails || "No original details"}
          </p>
        </div>
        <span className="shrink-0 font-bold tabular-nums">
          {row.status === "valid"
            ? formatCadFromCents(BigInt(row.sourceAmountMinor))
            : row.sourceAmount || "—"}
        </span>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {row.sourceType || "Unknown type"}
      </p>

      {row.status === "invalid" ? (
        <div className="mt-4">
          <ul className="list-disc pl-5 text-sm text-red-800">
            {row.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 grid gap-4">
          <div>
            <label
              className="text-sm font-medium"
              htmlFor={`mobile-merchant-${row.rowNumber}`}
            >
              Merchant
            </label>
            <input
              aria-label={`Merchant for row ${row.rowNumber}`}
              className={fieldClassName}
              disabled={deleted}
              id={`mobile-merchant-${row.rowNumber}`}
              maxLength={120}
              onChange={(event) => {
                const merchant = event.target.value;
                onDecisionChange({
                  merchant,
                  categoryId:
                    automaticMatch &&
                    normalizeMerchant(merchant) !==
                      categorization.normalizedMerchant
                      ? ""
                      : decision?.categoryId,
                  rememberCategoryRule: false,
                });
              }}
              value={decision?.merchant ?? ""}
            />
            {merchantTooLong ? (
              <p className="mt-1 text-xs text-red-700">
                Shorten the merchant to 120 characters.
              </p>
            ) : null}
          </div>

          {row.kind === "payment" ? (
            <p className="bg-background text-muted-foreground rounded-xl p-3 text-sm">
              Payment excluded from spending · No category required
            </p>
          ) : (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {automaticMatch ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                    <span className="size-1.5 rounded-full bg-emerald-600" />
                    Automatic · 100%
                  </span>
                ) : decision?.categoryId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
                    <span className="size-1.5 rounded-full bg-blue-600" />
                    Selected manually
                  </span>
                ) : categorization?.status === "conflict" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    <span className="size-1.5 rounded-full bg-amber-600" />
                    Rule conflict
                  </span>
                ) : (
                  <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2 py-1 text-xs font-semibold">
                    Needs category
                  </span>
                )}
              </div>
              <label
                className="text-sm font-medium"
                htmlFor={`mobile-category-${row.rowNumber}`}
              >
                Category
              </label>
              <select
                aria-label={`Category for row ${row.rowNumber}`}
                className={fieldClassName}
                disabled={deleted}
                id={`mobile-category-${row.rowNumber}`}
                onChange={(event) =>
                  onDecisionChange({
                    categoryId: event.target.value,
                    rememberCategoryRule: false,
                  })
                }
                value={decision?.categoryId ?? ""}
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {automaticMatch && categorization.status === "matched" ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  {categorization.explanation}
                </p>
              ) : null}
              {canRememberRule && selectedCategory ? (
                <label className="text-muted-foreground mt-3 flex items-start gap-2 text-xs leading-relaxed">
                  <input
                    aria-label={`Always categorize ${decision?.merchant ?? "this merchant"} as ${selectedCategory.name}`}
                    checked={decision?.rememberCategoryRule === true}
                    className="mt-0.5 size-4 shrink-0"
                    onChange={(event) =>
                      onDecisionChange({
                        rememberCategoryRule: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  Always use {selectedCategory.name} for this merchant
                </label>
              ) : null}
            </div>
          )}

          {row.kind === "refund" ? (
            <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
              This refund will reduce spending unless you delete the row.
            </p>
          ) : null}

          {duplicateWarning ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
              Possible duplicate · Delete this row if it should not be imported.
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-4 border-t pt-3">
        <RowDeleteButton
          deleted={deleted}
          onDecisionChange={onDecisionChange}
          rowNumber={row.rowNumber}
        />
      </div>
    </article>
  );
}

function ReviewRow({
  categories,
  categorization,
  decision,
  duplicateWarning,
  onDecisionChange,
  row,
}: Readonly<{
  categories: CategoryOption[];
  categorization?: ImportPreview["categorizations"][number];
  decision: ImportRowDecision;
  duplicateWarning: boolean;
  onDecisionChange: (change: Partial<ImportRowDecision>) => void;
  row: CsvReviewRow;
}>) {
  const deleted = decision?.excluded === true;
  const merchantTooLong = (decision?.merchant?.trim().length ?? 0) > 120;
  const automaticMatch =
    categorization?.status === "matched" &&
    normalizeMerchant(decision?.merchant ?? "") ===
      categorization.normalizedMerchant &&
    decision?.categoryId === categorization.categoryId;
  const selectedCategory = categories.find(
    (category) => category.id === decision?.categoryId,
  );
  const canRememberRule =
    row.status === "valid" &&
    row.kind !== "payment" &&
    Boolean(decision?.categoryId) &&
    !deleted &&
    !automaticMatch;

  return (
    <tr className="border-t align-top" data-row-number={row.rowNumber}>
      <th className="px-3 py-3" scope="row">
        {row.rowNumber}
      </th>
      <td className="px-3 py-3 whitespace-nowrap">
        {row.transactionDate || "—"}
      </td>
      <td className="px-3 py-3">{row.sourceType || "—"}</td>
      <td className="px-3 py-3 whitespace-nowrap">
        {row.status === "valid"
          ? formatCadFromCents(BigInt(row.sourceAmountMinor))
          : row.sourceAmount || "—"}
      </td>
      <td className="max-w-48 px-3 py-3 break-words">
        {row.sourceDetails || "—"}
      </td>
      {row.status === "invalid" ? (
        <>
          <td className="px-3 py-3 text-red-800" colSpan={2}>
            <ul className="list-disc pl-5">
              {row.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </td>
          <td className="px-3 py-3">
            <RowDeleteButton
              deleted={deleted}
              onDecisionChange={onDecisionChange}
              rowNumber={row.rowNumber}
            />
          </td>
        </>
      ) : (
        <>
          <td className="px-3 py-3">
            <label className="sr-only" htmlFor={`merchant-${row.rowNumber}`}>
              Merchant for row {row.rowNumber}
            </label>
            <input
              aria-describedby={
                merchantTooLong ? `merchant-${row.rowNumber}-error` : undefined
              }
              aria-invalid={merchantTooLong}
              className={fieldClassName}
              disabled={deleted}
              id={`merchant-${row.rowNumber}`}
              maxLength={120}
              onChange={(event) => {
                const merchant = event.target.value;
                onDecisionChange({
                  merchant,
                  categoryId:
                    automaticMatch &&
                    normalizeMerchant(merchant) !==
                      categorization.normalizedMerchant
                      ? ""
                      : decision?.categoryId,
                  rememberCategoryRule: false,
                });
              }}
              type="text"
              value={decision?.merchant ?? ""}
            />
            {merchantTooLong ? (
              <p
                className="mt-1 text-xs text-red-700"
                id={`merchant-${row.rowNumber}-error`}
              >
                Shorten the merchant to 120 characters.
              </p>
            ) : null}
          </td>
          <td className="min-w-64 px-3 py-3">
            {row.kind === "payment" ? (
              <span className="text-muted-foreground">Not required</span>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {automaticMatch ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                      <span className="size-1.5 rounded-full bg-emerald-600" />
                      Automatic · 100%
                    </span>
                  ) : decision?.categoryId ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">
                      <span className="size-1.5 rounded-full bg-blue-600" />
                      Selected manually
                    </span>
                  ) : categorization?.status === "conflict" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                      <span className="size-1.5 rounded-full bg-amber-600" />
                      Rule conflict
                    </span>
                  ) : (
                    <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2 py-1 text-xs font-semibold">
                      Needs category
                    </span>
                  )}
                </div>
                <label
                  className="sr-only"
                  htmlFor={`category-${row.rowNumber}`}
                >
                  Category for row {row.rowNumber}
                </label>
                <select
                  className={fieldClassName}
                  disabled={deleted}
                  id={`category-${row.rowNumber}`}
                  onChange={(event) =>
                    onDecisionChange({
                      categoryId: event.target.value,
                      rememberCategoryRule: false,
                    })
                  }
                  value={decision?.categoryId ?? ""}
                >
                  <option value="">Choose a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {automaticMatch && categorization.status === "matched" ? (
                  <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                    {categorization.explanation}
                  </p>
                ) : null}
                {canRememberRule && selectedCategory ? (
                  <label className="text-muted-foreground mt-3 flex items-start gap-2 text-xs leading-relaxed">
                    <input
                      aria-label={`Always categorize ${decision?.merchant ?? "this merchant"} as ${selectedCategory.name}`}
                      checked={decision?.rememberCategoryRule === true}
                      className="mt-0.5 size-4 shrink-0"
                      onChange={(event) =>
                        onDecisionChange({
                          rememberCategoryRule: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    Always use {selectedCategory.name} for this merchant
                  </label>
                ) : null}
              </>
            )}
          </td>
          <td className="space-y-2 px-3 py-3">
            {row.kind === "payment" ? (
              <p className="text-muted-foreground text-xs">
                Excluded from spending
              </p>
            ) : null}
            {row.kind === "refund" ? (
              <p className="text-xs text-blue-800">Reduces spending</p>
            ) : null}
            {duplicateWarning ? (
              <p className="text-xs font-medium text-amber-800">
                Possible duplicate
              </p>
            ) : null}
            <RowDeleteButton
              deleted={deleted}
              onDecisionChange={onDecisionChange}
              rowNumber={row.rowNumber}
            />
          </td>
        </>
      )}
    </tr>
  );
}

function RowDeleteButton({
  deleted,
  onDecisionChange,
  rowNumber,
}: Readonly<{
  deleted: boolean;
  onDecisionChange: (change: Partial<ImportRowDecision>) => void;
  rowNumber: number;
}>) {
  return (
    <div className="space-y-1">
      <Button
        aria-label={`${deleted ? "Restore" : "Delete"} row ${rowNumber}`}
        className={
          deleted
            ? undefined
            : "border-red-300 text-red-700 hover:bg-red-50 focus-visible:bg-red-50"
        }
        onClick={() =>
          onDecisionChange({
            excluded: !deleted,
            rememberCategoryRule: false,
          })
        }
        variant="secondary"
      >
        {deleted ? "Restore" : "Delete"}
      </Button>
      {deleted ? (
        <p className="text-muted-foreground text-xs" role="status">
          Will not import
        </p>
      ) : null}
    </div>
  );
}

function ImportResult({
  onReset,
  summary,
}: Readonly<{ onReset: () => void; summary: ImportSaveSummary }>) {
  const items = [
    { label: "Saved rows", value: summary.savedCount },
    { label: "Excluded payments", value: summary.excludedPaymentCount },
    { label: "Refund rows", value: summary.refundCount },
    { label: "Duplicate warnings", value: summary.duplicateWarningCount },
    { label: "Invalid rows deleted", value: summary.invalidExcludedCount },
    { label: "Rules learned", value: summary.learnedRuleCount },
  ];

  return (
    <section aria-labelledby="result-heading" className="mt-6">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Import complete
      </p>
      <h2 className="mt-1 text-2xl font-bold" id="result-heading">
        Statement saved
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <Card className="rounded-xl" key={item.label}>
            <p className="text-muted-foreground text-sm">{item.label}</p>
            <p className="mt-1 text-2xl font-bold">{item.value}</p>
          </Card>
        ))}
      </div>
      <p className="text-muted-foreground mt-4 text-sm">
        {summary.countedRefundCount} refunds counted,{" "}
        {summary.excludedRefundCount} refunds deleted, and{" "}
        {summary.duplicateExcludedCount} duplicate-warning rows deleted.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={onReset}>Review another CSV</Button>
        <Link
          className="bg-card hover:bg-muted inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium"
          href="/expenses"
        >
          View expenses
        </Link>
      </div>
    </section>
  );
}

function initialDecisions(
  rows: CsvReviewRow[],
  categorizations: ImportPreview["categorizations"],
) {
  const categorizationsByRow = new Map(
    categorizations.map((categorization) => [
      categorization.rowNumber,
      categorization,
    ]),
  );

  return Object.fromEntries(
    rows.map((row) => {
      const categorization = categorizationsByRow.get(row.rowNumber);
      return [
        row.rowNumber,
        row.status === "valid"
          ? {
              rowNumber: row.rowNumber,
              merchant: row.merchant,
              categoryId:
                categorization?.status === "matched"
                  ? categorization.categoryId
                  : "",
            }
          : { rowNumber: row.rowNumber },
      ];
    }),
  );
}

function countUnresolved(
  rows: CsvReviewRow[],
  decisions: Record<number, ImportRowDecision>,
) {
  return rows.filter((row) => {
    const decision = decisions[row.rowNumber];
    if (decision?.excluded) {
      return false;
    }
    if (row.status === "invalid") {
      return true;
    }
    const merchantLength = decision?.merchant?.trim().length ?? 0;
    if (merchantLength === 0 || merchantLength > 120) {
      return true;
    }
    if (row.kind === "expense" || row.kind === "refund") {
      return !decision?.categoryId;
    }
    return false;
  }).length;
}
