import type { ImportPreview, ImportSaveSummary } from "@/app/import/actions";
import type { ImportRowDecision } from "@/lib/import-workflow";

export type ImportReviewState = {
  preview: ImportPreview | null;
  selectedFile: File | null;
  decisions: Record<number, ImportRowDecision>;
  importAgain: boolean;
  message?: string;
  result: ImportSaveSummary | null;
};

export type ImportReviewAction =
  | { type: "prepare-preview" }
  | {
      type: "preview-succeeded";
      preview: ImportPreview;
      selectedFile: File;
      decisions: Record<number, ImportRowDecision>;
    }
  | { type: "file-changed"; hadPreview: boolean }
  | {
      type: "update-decision";
      rowNumber: number;
      change: Partial<ImportRowDecision>;
    }
  | { type: "set-import-again"; value: boolean }
  | { type: "set-message"; message?: string }
  | { type: "import-succeeded"; result: ImportSaveSummary }
  | { type: "reset" };

export const initialImportReviewState: ImportReviewState = {
  preview: null,
  selectedFile: null,
  decisions: {},
  importAgain: false,
  message: undefined,
  result: null,
};

export function importReviewReducer(
  state: ImportReviewState,
  action: ImportReviewAction,
): ImportReviewState {
  switch (action.type) {
    case "prepare-preview":
      return initialImportReviewState;
    case "preview-succeeded":
      return {
        ...initialImportReviewState,
        preview: action.preview,
        selectedFile: action.selectedFile,
        decisions: action.decisions,
      };
    case "file-changed":
      return {
        ...initialImportReviewState,
        message: action.hadPreview
          ? "Review the newly selected file before importing."
          : undefined,
      };
    case "update-decision":
      return {
        ...state,
        decisions: {
          ...state.decisions,
          [action.rowNumber]: {
            ...state.decisions[action.rowNumber],
            ...action.change,
            rowNumber: action.rowNumber,
          },
        },
      };
    case "set-import-again":
      return { ...state, importAgain: action.value };
    case "set-message":
      return { ...state, message: action.message };
    case "import-succeeded":
      return { ...state, message: undefined, result: action.result };
    case "reset":
      return initialImportReviewState;
  }
}
