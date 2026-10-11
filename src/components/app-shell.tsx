"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ChartNoAxesColumnIncreasing,
  Database,
  FileUp,
  House,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Dashboard", shortLabel: "Dashboard", icon: House },
  {
    href: "/expenses",
    label: "Expenses",
    shortLabel: "Expenses",
    icon: ReceiptText,
  },
  { href: "/import", label: "Import CSV", shortLabel: "Import", icon: FileUp },
  {
    href: "/categories",
    label: "Categories & budgets",
    shortLabel: "Budgets",
    icon: ChartNoAxesColumnIncreasing,
  },
  { href: "/data", label: "Data & backup", shortLabel: "Data", icon: Database },
] as const;

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
      <aside className="bg-sidebar sticky top-0 hidden h-screen flex-col px-6 py-8 text-white lg:flex">
        <Brand inverse />
        <Navigation pathname={pathname} variant="sidebar" />
        <div className="border-sidebar-active bg-sidebar-active/55 text-sidebar-muted mt-auto rounded-2xl border px-4 py-4 text-xs leading-relaxed">
          <strong className="mb-1 block text-sm text-white">
            Local and private
          </strong>
          Your financial data stays on this computer.
        </div>
      </aside>

      <div className="min-w-0">
        <header className="bg-card border-b lg:hidden">
          <div className="px-4 pt-5 sm:px-6">
            <Brand />
          </div>
          <Navigation pathname={pathname} variant="mobile" />
          <p className="bg-background text-muted-foreground mx-4 mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-xs sm:mx-6">
            <ShieldCheck aria-hidden="true" className="text-accent size-4" />
            Your financial data stays on this computer.
          </p>
        </header>
        <main className="mx-auto w-full max-w-[90rem] px-4 py-7 sm:px-6 sm:py-9 xl:px-9">
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand({ inverse = false }: Readonly<{ inverse?: boolean }>) {
  return (
    <Link
      aria-label="Expense Tracker home"
      className="flex items-center gap-3"
      href="/"
    >
      <span className="from-primary to-accent grid size-10 place-items-center rounded-xl bg-gradient-to-br shadow-lg shadow-blue-950/20">
        <Image
          alt=""
          aria-hidden="true"
          className="size-6 brightness-0 invert"
          height={24}
          src="/icon.ico"
          width={24}
        />
      </span>
      <span
        className={cn(
          "text-xl font-bold tracking-tight",
          inverse ? "text-white" : "text-foreground",
        )}
      >
        Expense Tracker
      </span>
    </Link>
  );
}

function Navigation({
  pathname,
  variant,
}: Readonly<{
  pathname: string;
  variant: "sidebar" | "mobile";
}>) {
  return (
    <nav
      aria-label="Main navigation"
      className={cn(variant === "sidebar" ? "mt-11" : "mt-4 px-4 pb-4 sm:px-6")}
    >
      <ul
        className={cn(
          variant === "sidebar" ? "grid gap-2" : "grid grid-cols-3 gap-2",
        )}
      >
        {navigation.map((item) => {
          const isCurrent =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href}>
              <Link
                aria-current={isCurrent ? "page" : undefined}
                aria-label={variant === "mobile" ? item.label : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-2 rounded-xl px-2.5 py-2.5 text-sm font-semibold sm:gap-3 sm:px-3.5",
                  variant === "mobile" && "justify-center",
                  variant === "sidebar"
                    ? isCurrent
                      ? "bg-sidebar-active text-white"
                      : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-white"
                    : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                href={item.href}
              >
                <item.icon
                  aria-hidden="true"
                  className="size-5 shrink-0"
                  strokeWidth={1.8}
                />
                <span>
                  {variant === "mobile" ? item.shortLabel : item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
