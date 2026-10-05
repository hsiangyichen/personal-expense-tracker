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
  const unresolved = preview
    ? countUnresolved(preview.rows, decisions, duplicateRows)
    : 0;
  const countedSimilarRefunds = preview
    ? preview.similarRefundPairs.filter(({ rowNumbers }) =>
        rowNumbers.every(
          (rowNumber) =>
            decisions[rowNumber]?.refundDecision === "count" &&
            decisions[rowNumber]?.duplicateDecision !== "exclude",
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
              setDecisions(initialDecisions(response.preview.rows));
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
          <ImportSummary preview={preview} />

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

function ImportSummary({ preview }: Readonly<{ preview: ImportPreview }>) {
  const validRows = preview.rows.filter((row) => row.status === "valid");
  const items = [
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
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
  decisions,
  duplicateRows,
  onDecisionChange,
  rows,
}: Readonly<{
  categories: CategoryOption[];
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
      <h2 className="text-xl font-semibold" id="review-heading">
        Review rows
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Correct merchant names, assign categories, and resolve every warning.
        Original details remain unchanged.
      </p>
      <div className="relative mt-3 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-xl border bg-white">
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
                "Decision",
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

function ReviewRow({
  categories,
  decision,
  duplicateWarning,
  onDecisionChange,
  row,
}: Readonly<{
  categories: CategoryOption[];
  decision: ImportRowDecision;
  duplicateWarning: boolean;
  onDecisionChange: (change: Partial<ImportRowDecision>) => void;
  row: CsvReviewRow;
}>) {
  const excludedDuplicate = decision?.duplicateDecision === "exclude";
  const merchantTooLong = (decision?.merchant?.trim().length ?? 0) > 120;

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
            <label className="flex min-h-11 items-center gap-2">
              <input
                aria-label={`Exclude invalid row ${row.rowNumber}`}
                checked={decision?.invalidDecision === "exclude"}
                className="size-5"
                onChange={(event) =>
                  onDecisionChange({
                    invalidDecision: event.target.checked
                      ? "exclude"
                      : undefined,
                  })
                }
                type="checkbox"
              />
              Exclude invalid row
            </label>
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
              disabled={excludedDuplicate}
              id={`merchant-${row.rowNumber}`}
              maxLength={120}
              onChange={(event) =>
                onDecisionChange({ merchant: event.target.value })
              }
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
          <td className="px-3 py-3">
            {row.kind === "payment" ? (
              <span className="text-muted-foreground">Not required</span>
            ) : (
              <>
                <label
                  className="sr-only"
                  htmlFor={`category-${row.rowNumber}`}
                >
                  Category for row {row.rowNumber}
                </label>
                <select
                  className={fieldClassName}
                  disabled={
                    excludedDuplicate ||
                    (row.kind === "refund" &&
                      decision?.refundDecision !== "count")
                  }
                  id={`category-${row.rowNumber}`}
                  onChange={(event) =>
                    onDecisionChange({ categoryId: event.target.value })
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
              </>
            )}
          </td>
          <td className="space-y-3 px-3 py-3">
            {row.kind === "payment" ? (
              <p className="text-muted-foreground">Excluded from spending</p>
            ) : null}
            {row.kind === "refund" ? (
              <div>
                <label
                  className="text-xs font-medium"
                  htmlFor={`refund-${row.rowNumber}`}
                >
                  Refund
                </label>
                <select
                  className={fieldClassName}
                  disabled={excludedDuplicate}
                  id={`refund-${row.rowNumber}`}
                  onChange={(event) =>
                    onDecisionChange({
                      refundDecision:
                        (event.target.value as "count" | "exclude") ||
                        undefined,
                      categoryId:
                        event.target.value === "count"
                          ? decision?.categoryId
                          : "",
                    })
                  }
                  value={decision?.refundDecision ?? ""}
                >
                  <option value="">Choose</option>
                  <option value="count">Count as refund</option>
                  <option value="exclude">Exclude from spending</option>
                </select>
              </div>
            ) : null}
            {duplicateWarning ? (
              <div>
                <label
                  className="text-xs font-medium"
                  htmlFor={`duplicate-${row.rowNumber}`}
                >
                  Possible duplicate
                </label>
                <select
                  className={fieldClassName}
                  id={`duplicate-${row.rowNumber}`}
                  onChange={(event) =>
                    onDecisionChange({
                      duplicateDecision:
                        (event.target.value as "include" | "exclude") ||
                        undefined,
                    })
                  }
                  value={decision?.duplicateDecision ?? ""}
                >
                  <option value="">Choose</option>
                  <option value="include">Include row</option>
                  <option value="exclude">Exclude row</option>
                </select>
              </div>
            ) : null}
          </td>
        </>
      )}
    </tr>
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
    { label: "Invalid rows excluded", value: summary.invalidExcludedCount },
  ];

  return (
    <section aria-labelledby="result-heading" className="mt-6">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Import complete
      </p>
      <h2 className="mt-1 text-2xl font-bold" id="result-heading">
        Statement saved
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => (
          <Card className="rounded-xl" key={item.label}>
            <p className="text-muted-foreground text-sm">{item.label}</p>
            <p className="mt-1 text-2xl font-bold">{item.value}</p>
          </Card>
        ))}
      </div>
      <p className="text-muted-foreground mt-4 text-sm">
        {summary.countedRefundCount} refunds counted,{" "}
        {summary.excludedRefundCount} excluded from spending, and{" "}
        {summary.duplicateExcludedCount} duplicate-warning rows excluded.
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

function initialDecisions(rows: CsvReviewRow[]) {
  return Object.fromEntries(
    rows.map((row) => [
      row.rowNumber,
      row.status === "valid"
        ? {
            rowNumber: row.rowNumber,
            merchant: row.merchant,
            categoryId: "",
          }
        : { rowNumber: row.rowNumber },
    ]),
  );
}

function countUnresolved(
  rows: CsvReviewRow[],
  decisions: Record<number, ImportRowDecision>,
  duplicateRows: Set<number>,
) {
  return rows.filter((row) => {
    const decision = decisions[row.rowNumber];
    if (row.status === "invalid") {
      return decision?.invalidDecision !== "exclude";
    }
    if (duplicateRows.has(row.rowNumber) && !decision?.duplicateDecision) {
      return true;
    }
    if (decision?.duplicateDecision === "exclude") {
      return false;
    }
    const merchantLength = decision?.merchant?.trim().length ?? 0;
    if (merchantLength === 0 || merchantLength > 120) {
      return true;
    }
    if (row.kind === "expense") {
      return !decision?.categoryId;
    }
    if (row.kind === "refund") {
      return (
        !decision?.refundDecision ||
        (decision.refundDecision === "count" && !decision.categoryId)
      );
    }
    return false;
  }).length;
}
