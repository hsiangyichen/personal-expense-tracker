import { describe, expect, it } from "vitest";
import type { ImportPreview, ImportSaveSummary } from "@/app/import/actions";
import {
  importReviewReducer,
  initialImportReviewState,
} from "@/lib/import-review-state";

const preview = { fileName: "sample.csv" } as ImportPreview;
const file = new File(["sample"], "sample.csv", { type: "text/csv" });
const decisions = {
  2: { rowNumber: 2, merchant: "Sample", categoryId: "category-1" },
};

function reviewedState() {
  return importReviewReducer(initialImportReviewState, {
    type: "preview-succeeded",
    preview,
    selectedFile: file,
    decisions,
  });
}

describe("CSV review state", () => {
  it("stores a successful preview as one transition", () => {
    expect(reviewedState()).toMatchObject({
      preview,
      selectedFile: file,
      decisions,
      importAgain: false,
      result: null,
    });
  });

  it("merges a row update while preserving the row number", () => {
    const state = importReviewReducer(reviewedState(), {
      type: "update-decision",
      rowNumber: 2,
      change: { categoryId: "category-2", excluded: true },
    });

    expect(state.decisions[2]).toEqual({
      rowNumber: 2,
      merchant: "Sample",
      categoryId: "category-2",
      excluded: true,
    });
  });

  it("clears prior review state before reading another file", () => {
    const approved = importReviewReducer(reviewedState(), {
      type: "set-import-again",
      value: true,
    });
    expect(approved.importAgain).toBe(true);

    expect(
      importReviewReducer(
        { ...approved, message: "Previous message" },
        { type: "prepare-preview" },
      ),
    ).toEqual(initialImportReviewState);
  });

  it("clears review state when the selected file changes", () => {
    const state = importReviewReducer(reviewedState(), {
      type: "file-changed",
      hadPreview: true,
    });

    expect(state).toEqual({
      ...initialImportReviewState,
      message: "Review the newly selected file before importing.",
    });
  });

  it("keeps review state when showing a save error", () => {
    const reviewed = reviewedState();
    const state = importReviewReducer(reviewed, {
      type: "set-message",
      message: "Could not save the import. Try again.",
    });

    expect(state.preview).toBe(preview);
    expect(state.decisions).toBe(decisions);
    expect(state.message).toBe("Could not save the import. Try again.");
  });

  it("stores a result and resets the complete workflow", () => {
    const result = { savedCount: 1 } as ImportSaveSummary;
    const completed = importReviewReducer(reviewedState(), {
      type: "import-succeeded",
      result,
    });

    expect(completed.result).toBe(result);
    expect(importReviewReducer(completed, { type: "reset" })).toEqual(
      initialImportReviewState,
    );
  });
});
