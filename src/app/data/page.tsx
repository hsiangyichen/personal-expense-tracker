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
        <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
          Local data
        </p>
        <h1
          className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          id="data-heading"
        >
          Data &amp; backup
        </h1>
        <p className="text-muted-foreground mt-2">
          Keep a safe copy of your data and review recent statement imports.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <Card className="min-w-0">
          <CardTitle>Create a backup</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Creates a safe copy of your expenses, categories, budgets, and
            import history while the application is running.
          </p>
          <BackupButton />
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Current data file</dt>
              <dd className="text-muted-foreground mt-1 break-all">
                {paths.databasePath}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Backup folder</dt>
              <dd className="text-muted-foreground mt-1 break-all">
                {paths.backupDirectory}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="min-w-0">
          <CardTitle>Restore a backup</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Restoring replaces your current data with the selected backup. The
            application must be stopped first so your data can be replaced
            safely.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
            <li>
              In the terminal where the application is running, press{" "}
              <code className="bg-muted rounded px-1.5 py-0.5">Ctrl+C</code>.
            </li>
            <li>Copy the full path of the backup file you want to restore.</li>
            <li>
              From this project folder, run the command below after replacing
              the example path.
            </li>
          </ol>
          <pre className="bg-muted mt-4 max-w-full overflow-hidden rounded-xl p-3 text-sm break-all whitespace-pre-wrap">
            <code>
              npm run db:restore -- /absolute/path/to/backup.db --confirm
            </code>
          </pre>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardTitle>Recent imports</CardTitle>
        {imports.length === 0 ? (
          <div className="bg-background mt-4 rounded-xl p-8 text-center">
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
                  <span className="min-w-0 font-medium break-words">
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
