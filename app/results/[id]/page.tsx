"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  FileText,
  Globe,
  Image,
  Layers,
  Loader2,
  Maximize2,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";

interface QaRun {
  id: number;
  url: string;
  siteTitle: string | null;
  siteFavicon: string | null;
  siteHeadings: unknown;
  siteImages: unknown;
  siteLinks: unknown;
  siteSections: unknown;
  siteOverflows: unknown;
  siteBrokenImages: unknown;
  siteHeadingInversion: unknown;
  siteLinkTransition: string | null;
  createdAt: string;
}

interface QaBreakpoint {
  id: number;
  runId: number;
  dims: string;
  category: string;
  width: number;
  height: number;
  overflows: unknown;
  hiddenSections: unknown;
  hamburgerDetected: boolean;
  hamburgerLinks: unknown;
  sectionBounds: unknown;
  screenshotBlobUrl: string | null;
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor,
  ipad: Tablet,
  mobile: Smartphone,
};

const CATEGORY_ORDER = ["desktop", "ipad", "mobile"];

function imageUrl(blobUrl: string): string {
  return `/api/analyze-image?imageUrl=${encodeURIComponent(blobUrl)}`;
}

function HeadingList({ data }: { data: unknown }) {
  if (!data || !Array.isArray(data))
    return <span className="text-muted-foreground">—</span>;
  const items = data as Array<{ level?: number; text?: string }>;
  if (items.length === 0)
    return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
      {items.slice(0, 10).map((h) => (
        <li key={`h${h.level}-${h.text?.slice(0, 20)}`}>
          <span className="font-mono text-[10px]">H{h.level ?? "?"}</span>{" "}
          {h.text ?? "—"}
        </li>
      ))}
      {items.length > 10 && (
        <li className="text-muted-foreground/60">+{items.length - 10} more</li>
      )}
    </ul>
  );
}

function JsonSummary({ data, label }: { data: unknown; label: string }) {
  if (!data) return <span className="text-muted-foreground">—</span>;
  if (Array.isArray(data)) {
    return (
      <span className="text-xs text-muted-foreground">
        {data.length} {label}
        {data.length !== 1 ? "s" : ""}
      </span>
    );
  }
  if (typeof data === "object") {
    const keys = Object.keys(data);
    return (
      <span className="text-xs text-muted-foreground">
        {keys.length} {label}
        {keys.length !== 1 ? "s" : ""}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{String(data)}</span>;
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;

  const [run, setRun] = useState<QaRun | null>(null);
  const [breakpoints, setBreakpoints] = useState<QaBreakpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBp, setSelectedBp] = useState<QaBreakpoint | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedBp(null);
    }
    if (selectedBp) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [selectedBp]);

  useEffect(() => {
    async function fetchRun() {
      try {
        const res = await fetch(`/api/runs?runId=${runId}`);
        if (res.status === 401) {
          router.push("/");
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch run");
        const data = await res.json();
        setRun(data.run);
        setBreakpoints(data.breakpoints);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchRun();
  }, [runId, router]);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: breakpoints.filter((bp) => bp.category === cat),
  })).filter((g) => g.items.length > 0);

  const siteHeadings = run?.siteHeadings as
    | Array<{ level?: number; text?: string }>
    | undefined;

  return (
    <div className="flex flex-col h-screen">
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Link href="/results">
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
                {run?.siteTitle || `Run #${runId}`}
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[300px]">
                {run?.url}
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

        {!loading && !error && run && (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Site Metadata */}
            <section className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="size-4" />
                Site Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground font-medium">
                    URL
                  </div>
                  <a
                    href={run.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary underline underline-offset-2 break-all"
                  >
                    {run.url}
                  </a>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground font-medium">
                    Title
                  </div>
                  <div className="text-xs">{run.siteTitle ?? "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground font-medium">
                    Run Date
                  </div>
                  <div className="text-xs">
                    {new Date(run.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase text-muted-foreground font-medium">
                    Breakpoints
                  </div>
                  <div className="text-xs">{breakpoints.length} captured</div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Layers className="size-3.5" />
                  <JsonSummary data={run.siteSections} label="section" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="size-3.5" />
                  <JsonSummary data={run.siteImages} label="image" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="size-3.5" />
                  <JsonSummary data={run.siteLinks} label="link" />
                </div>
                {Array.isArray(run.siteBrokenImages) &&
                  run.siteBrokenImages.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="size-3.5" />
                      {run.siteBrokenImages.length} broken image
                      {run.siteBrokenImages.length !== 1 ? "s" : ""}
                    </div>
                  )}
                {Array.isArray(run.siteOverflows) &&
                  run.siteOverflows.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="size-3.5" />
                      {run.siteOverflows.length} overflow
                      {run.siteOverflows.length !== 1 ? "s" : ""}
                    </div>
                  )}
              </div>
            </section>

            {/* Headings */}
            {siteHeadings && siteHeadings.length > 0 && (
              <section className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4" />
                  Headings ({siteHeadings.length})
                </h2>
                <HeadingList data={run.siteHeadings} />
              </section>
            )}

            {/* Screenshots by Category */}
            {grouped.map((group) => {
              const Icon = CATEGORY_ICONS[group.category] ?? Monitor;
              return (
                <section
                  key={group.category}
                  className="rounded-xl border border-border bg-card p-5 space-y-4"
                >
                  <h2 className="text-sm font-semibold flex items-center gap-2 capitalize">
                    <Icon className="size-4" />
                    {group.category} ({group.items.length})
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.items.map((bp) => (
                      <button
                        key={bp.id}
                        type="button"
                        onClick={() =>
                          setSelectedBp(selectedBp?.id === bp.id ? null : bp)
                        }
                        className={`group rounded-lg border overflow-hidden transition-all text-left ${
                          selectedBp?.id === bp.id
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="aspect-video bg-muted relative overflow-hidden">
                          {bp.screenshotBlobUrl ? (
                            // biome-ignore lint/performance/noImgElement: proxied through auth endpoint, next/image won't work
                            <img
                              src={imageUrl(bp.screenshotBlobUrl)}
                              alt={`Screenshot at ${bp.dims}`}
                              className="w-full h-full object-cover object-top"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                              <Image className="size-6" />
                            </div>
                          )}
                          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
                            {bp.hamburgerDetected && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/90 text-white font-medium">
                                Menu
                              </span>
                            )}
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-white font-mono">
                              {bp.dims}
                            </span>
                          </div>
                        </div>
                        <div className="p-2 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {bp.width}×{bp.height}
                          </span>
                          <Maximize2 className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Lightbox */}
            {selectedBp?.screenshotBlobUrl && (
              <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6">
                <div className="relative max-w-5xl w-full">
                  <div className="rounded-xl overflow-hidden bg-card border border-border shadow-2xl">
                    {/* biome-ignore lint/performance/noImgElement: proxied through auth endpoint, next/image won't work */}
                    <img
                      src={imageUrl(selectedBp.screenshotBlobUrl)}
                      alt={`Screenshot at ${selectedBp.dims}`}
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-white/80 font-mono">
                      {selectedBp.dims} — {selectedBp.category}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBp(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
