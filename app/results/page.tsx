"use client";

import { ArrowLeft, FileText, Globe, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";

interface QaRun {
  id: number;
  url: string;
  siteTitle: string | null;
  siteFavicon: string | null;
  createdAt: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<QaRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch("/api/runs");
        if (res.status === 401) {
          router.push("/");
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch runs");
        const data = await res.json();
        setRuns(data.runs);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchRuns();
  }, [router]);

  return (
    <div className="flex flex-col h-screen">
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon-sm">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="size-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">
                QA Test Results
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {runs.length} run{runs.length !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>
        </div>
        <AuthButton />
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive max-w-xl mx-auto">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
              <Globe className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-foreground">No runs yet</h3>
              <p className="text-sm max-w-sm">
                Run a QA audit from the home page to see results here.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <div className="max-w-4xl mx-auto space-y-3">
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/results/${run.id}`}
                className="block rounded-xl border border-border bg-card p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Globe className="size-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium truncate">
                        {run.siteTitle || run.url}
                      </h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                        #{run.id}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {run.url}
                    </p>
                  </div>
                  <time className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(run.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
