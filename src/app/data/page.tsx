import { BackupButton } from "@/components/backup-button";
import { Card, CardTitle } from "@/components/ui/card";
import { listRecentImports } from "@/lib/repositories/imports";
import { resolveStoragePaths } from "@/lib/storage-paths";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const paths = resolveStoragePaths();
  const imports = await listRecentImports();

  return (
    <section aria-labelledby="data-heading" className="min-w-0 space-y-6">
      <div>
        <p className="text-primary text-sm font-medium">Local data</p>
        <h1
          className="mt-1 text-3xl font-bold tracking-tight"
          id="data-heading"
        >
          Data &amp; backup
        </h1>
        <p className="text-muted-foreground mt-2">
          Protect the local SQLite database and review recent imports.
        </p>
      </div>

      <Card className="min-w-0">
        <CardTitle>Create a backup</CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          Creates a consistent SQLite copy while the application is running.
        </p>
        <BackupButton />
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Active database</dt>
            <dd className="text-muted-foreground mt-1 break-all">
              {paths.databasePath}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Backup directory</dt>
            <dd className="text-muted-foreground mt-1 break-all">
              {paths.backupDirectory}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="min-w-0">
        <CardTitle>Restore a backup</CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          Stop the application first. The restore command validates the backup,
          creates a safety copy, replaces the database atomically, and verifies
          all record counts.
        </p>
        <pre className="bg-muted mt-4 max-w-full overflow-x-auto rounded-md p-3 text-sm">
          <code>
            npm run db:restore -- /absolute/path/to/backup.db --confirm
          </code>
        </pre>
      </Card>

      <Card className="min-w-0">
        <CardTitle>Recent imports</CardTitle>
        {imports.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">No imports yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Imported CSV statements will appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y">
            {imports.map((item) => (
              <li className="py-4 first:pt-0 last:pb-0" key={item.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 break-words font-medium">
                    {item.fileName}
                  </span>
                  <time
                    className="text-muted-foreground shrink-0 text-sm"
                    dateTime={item.importedAt.toISOString()}
                  >
                    {new Intl.DateTimeFormat("en-CA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(item.importedAt)}
                  </time>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {item.rowCount} rows · {item.expenseCount} expenses ·{" "}
                  {item.refundCount} refunds · {item.excludedPaymentCount}{" "}
                  payments excluded
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
