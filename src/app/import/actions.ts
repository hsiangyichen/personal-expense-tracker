"use server";

import { revalidatePath } from "next/cache";
import type { CsvReviewRow } from "@/lib/csv-parser";
import { parseCreditCardCsv } from "@/lib/csv-parser";
import {
  calculateFileFingerprint,
  findDuplicateRowGroups,
  findSimilarRefundPairs,
  type DuplicateRowGroup,
  type SimilarRefundPair,
} from "@/lib/import-review";
import {
  ImportResolutionError,
  parseImportDecisions,
  resolveImportRows,
} from "@/lib/import-workflow";
import {
  InvalidImportDataError,
  RepeatedImportError,
  findImportsByFingerprint,
  saveImportAtomically,
} from "@/lib/repositories/imports";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

class CsvUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvUploadError";
  }
}

export type ImportPreview = {
  fileName: string;
  fingerprint: string;
  rows: CsvReviewRow[];
  duplicateGroups: DuplicateRowGroup[];
  similarRefundPairs: SimilarRefundPair[];
  alreadyImported: boolean;
};

export type ImportPreviewResult =
  | { success: true; preview: ImportPreview }
  | { success: false; message: string };

export type ImportSaveSummary = {
  savedCount: number;
  excludedPaymentCount: number;
  refundCount: number;
  countedRefundCount: number;
  excludedRefundCount: number;
  duplicateWarningCount: number;
  duplicateExcludedCount: number;
  invalidExcludedCount: number;
};

export type ImportSaveResult =
  | { success: true; summary: ImportSaveSummary }
  | { success: false; message: string };

export async function previewImportAction(
  formData: FormData,
): Promise<ImportPreviewResult> {
  try {
    const uploaded = await readUploadedCsv(formData);
    const parsed = parseCreditCardCsv(uploaded.text);
    const blockingErrors = [...parsed.headerErrors, ...parsed.fileErrors];

    if (blockingErrors.length > 0) {
      return { success: false, message: blockingErrors.join(" ") };
    }
    if (parsed.rows.length === 0) {
      return { success: false, message: "The CSV has no transaction rows." };
    }

    const fingerprint = calculateFileFingerprint(uploaded.bytes);
    const previousImports = await findImportsByFingerprint(fingerprint);

    return {
      success: true,
      preview: {
        fileName: uploaded.fileName,
        fingerprint,
        rows: parsed.rows,
        duplicateGroups: findDuplicateRowGroups(parsed.rows),
        similarRefundPairs: findSimilarRefundPairs(parsed.rows),
        alreadyImported: previousImports.length > 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof CsvUploadError
          ? error.message
          : "Could not review the CSV file. Try again.",
    };
  }
}

export async function saveImportAction(
  formData: FormData,
): Promise<ImportSaveResult> {
  try {
    const uploaded = await readUploadedCsv(formData);
    const parsed = parseCreditCardCsv(uploaded.text);
    const blockingErrors = [...parsed.headerErrors, ...parsed.fileErrors];

    if (blockingErrors.length > 0 || parsed.rows.length === 0) {
      return {
        success: false,
        message: "The CSV changed or is no longer valid. Upload it again.",
      };
    }

    const fingerprint = calculateFileFingerprint(uploaded.bytes);
    const expectedFingerprint = formData.get("fingerprint")?.toString();
    if (fingerprint !== expectedFingerprint) {
      return {
        success: false,
        message: "The selected CSV changed. Review it again before importing.",
      };
    }

    const duplicateGroups = findDuplicateRowGroups(parsed.rows);
    const decisions = parseImportDecisions(
      formData.get("decisions")?.toString() ?? "",
    );
    const resolution = resolveImportRows(
      parsed.rows,
      decisions,
      duplicateGroups,
    );
    const saved = await saveImportAtomically({
      fileName: uploaded.fileName,
      fileFingerprint: fingerprint,
      rowCount: parsed.rows.length,
      importAgain: formData.get("importAgain") === "true",
      transactions: resolution.transactions,
    });

    revalidatePath("/");
    revalidatePath("/expenses");

    return {
      success: true,
      summary: {
        savedCount: saved.transactions.length,
        excludedPaymentCount: saved.transactions.filter(
          (row) => row.kind === "payment",
        ).length,
        refundCount: saved.transactions.filter((row) => row.kind === "refund")
          .length,
        countedRefundCount: resolution.countedRefundCount,
        excludedRefundCount: resolution.excludedRefundCount,
        duplicateWarningCount: duplicateGroups.length,
        duplicateExcludedCount: resolution.duplicateExcludedCount,
        invalidExcludedCount: resolution.invalidExcludedCount,
      },
    };
  } catch (error) {
    if (
      error instanceof RepeatedImportError ||
      error instanceof ImportResolutionError ||
      error instanceof InvalidImportDataError ||
      error instanceof CsvUploadError
    ) {
      return { success: false, message: error.message };
    }

    return { success: false, message: "Could not save the import. Try again." };
  }
}

async function readUploadedCsv(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new CsvUploadError("Choose a CSV file to continue.");
  }
  if (file.size > MAX_CSV_BYTES) {
    throw new CsvUploadError("The CSV file must be 2 MB or smaller.");
  }
  if (!file.name.trim() || file.name.length > 255) {
    throw new CsvUploadError("The CSV file name is invalid.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CsvUploadError("The CSV file must use UTF-8 text.");
  }

  return { bytes, text, fileName: file.name };
}
