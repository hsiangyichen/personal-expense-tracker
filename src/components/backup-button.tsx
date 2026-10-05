"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createBackupAction,
  type BackupActionResult,
} from "@/app/data/actions";
import { Button } from "@/components/ui/button";

export function BackupButton() {
  const [result, setResult] = useState<BackupActionResult>();
  const [pending, startTransition] = useTransition();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return (
    <div className="mt-4">
      <Button
        disabled={pending || !hydrated}
        onClick={() => {
          setResult(undefined);
          startTransition(async () => setResult(await createBackupAction()));
        }}
      >
        {pending ? "Creating backup…" : "Create backup"}
      </Button>

      {result?.success ? (
        <div
          className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950"
          role="status"
        >
          <p className="font-medium">Backup created.</p>
          <p className="mt-1 break-all">{result.path}</p>
          <p className="mt-1">
            {new Intl.DateTimeFormat("en-CA", {
              dateStyle: "medium",
              timeStyle: "medium",
            }).format(new Date(result.createdAt))}
            {" · "}
            {formatFileSize(result.sizeBytes)}
          </p>
        </div>
      ) : null}

      {result && !result.success ? (
        <p
          className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          role="alert"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
