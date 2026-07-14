"use client";

import type { UIMessage } from "ai";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileText,
  Globe,
  Loader2,
  Paintbrush,
  Smartphone,
  Tablet,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToolState =
  | "idle"
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

interface ToolEntry {
  toolName: string;
  toolCallId: string;
  state: ToolState;
  errorText?: string;
  order: number;
}

interface BreakpointStatus {
  dims: string;
  category: string;
  state: "pending" | "active" | "done";
}

interface TimelineError {
  tool?: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const toolIcons: Record<string, React.ReactNode> = {
  "get-frame": <Paintbrush className="size-3.5" />,
  "get-live-site": <Globe className="size-3.5" />,
  "generate-pdf": <FileText className="size-3.5" />,
};

const toolLabels: Record<string, string> = {
  "get-frame": "get-frame",
  "get-live-site": "get-live-site",
  "generate-pdf": "generate-pdf",
};

const BREAKPOINT_ORDER = [
  "1280x720",
  "1366x768",
  "1400x900",
  "1440x900",
  "1536x864",
  "1600x900",
  "1680x1050",
  "1792x1120",
  "1920x1080",
  "2048x1536",
  "2560x1440",
  "768x1024",
  "810x1180",
  "1024x1366",
  "360x740",
  "412x915",
  "430x932",
  "375x740",
];

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> =
  {
    desktop: { label: "Desktop", icon: <Globe className="size-3" /> },
    ipad: { label: "iPad", icon: <Tablet className="size-3" /> },
    mobile: { label: "Mobile", icon: <Smartphone className="size-3" /> },
  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBreakpointProgress(messages: UIMessage[]): BreakpointStatus[] {
  const map = new Map<string, BreakpointStatus>();
  let inBreakpointSection = false;

  for (const msg of messages) {
    if (!msg.parts) continue;
    for (const part of msg.parts) {
      if (part.type !== "text") continue;
      const text = (part as unknown as { text: string }).text ?? "";
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("[3/4] Testing responsive breakpoints")) {
          inBreakpointSection = true;
        }
        if (
          trimmed === "[4/4] Closing browser..." ||
          trimmed === "=== QA Collection Complete ==="
        ) {
          inBreakpointSection = false;
        }
        const match = trimmed.match(/^→\s+(\d+x\d+)\s+\((\w+)\)/);
        if (match) {
          const [, dims, category] = match;
          const isActive = inBreakpointSection && !map.has(dims);
          const existing = map.get(dims);
          map.set(dims, {
            dims,
            category,
            state: existing ? "done" : isActive ? "active" : "done",
          });
        }
      }
    }
  }

  // Ensure all breakpoints exist (pending if not yet seen)
  for (const dims of BREAKPOINT_ORDER) {
    if (!map.has(dims)) {
      map.set(dims, { dims, category: inferCategory(dims), state: "pending" });
    }
  }

  return Array.from(map.values());
}

function inferCategory(dims: string): string {
  const idx = BREAKPOINT_ORDER.indexOf(dims);
  if (idx >= 11 && idx <= 13) return "ipad";
  if (idx >= 14) return "mobile";
  return "desktop";
}

function extractToolCalls(messages: UIMessage[]): ToolEntry[] {
  const seen = new Map<string, ToolEntry>();
  let orderCounter = 0;

  for (const msg of messages) {
    if (!msg.parts) continue;
    for (const part of msg.parts) {
      const toolPart = part as unknown as {
        type: string;
        toolName?: string;
        toolCallId?: string;
        state?: ToolState;
        errorText?: string;
      };
      if (
        !toolPart.type?.startsWith("tool-") &&
        toolPart.type !== "dynamic-tool"
      )
        continue;

      const toolName =
        toolPart.type === "dynamic-tool"
          ? (toolPart.toolName ?? "")
          : toolPart.type.replace("tool-", "");
      const toolCallId = toolPart.toolCallId || toolName;
      const state: ToolState = toolPart.state || "idle";

      const existing = seen.get(toolCallId);
      if (!existing) {
        seen.set(toolCallId, {
          toolName,
          toolCallId,
          state,
          errorText: toolPart.errorText,
          order: orderCounter++,
        });
      } else if (statePriority(state) >= statePriority(existing.state)) {
        seen.set(toolCallId, {
          ...existing,
          state,
          errorText: toolPart.errorText,
        });
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.order - b.order);
}

function statePriority(state: ToolState): number {
  const order: ToolState[] = [
    "idle",
    "input-streaming",
    "input-available",
    "output-error",
    "output-available",
  ];
  return order.indexOf(state);
}

function collectErrors(
  messages: UIMessage[],
  chatError: Error | undefined,
): TimelineError[] {
  const errors: TimelineError[] = [];

  for (const msg of messages) {
    if (!msg.parts) continue;
    for (const part of msg.parts) {
      const toolPart = part as unknown as {
        type: string;
        toolName?: string;
        state?: ToolState;
        errorText?: string;
      };
      if (
        !toolPart.type?.startsWith("tool-") &&
        toolPart.type !== "dynamic-tool"
      )
        continue;
      if (toolPart.state === "output-error" && toolPart.errorText) {
        const toolName =
          toolPart.type === "dynamic-tool"
            ? (toolPart.toolName ?? "")
            : toolPart.type.replace("tool-", "");
        errors.push({ tool: toolName, message: toolPart.errorText });
      }
    }
  }

  if (chatError) {
    errors.push({ message: chatError.message });
  }

  return errors;
}

function deriveActiveTool(
  toolCalls: ToolEntry[],
  isActive: boolean,
): string | null {
  if (!isActive) return null;
  const running = toolCalls.find(
    (t) => t.state === "input-streaming" || t.state === "input-available",
  );
  if (running) return running.toolName;
  return null;
}

function deriveCurrentStep(toolCalls: ToolEntry[]): number {
  const completedSet = new Set<string>();
  for (const t of toolCalls) {
    if (t.state === "output-available") completedSet.add(t.toolName);
  }

  if (completedSet.has("generate-pdf")) return 6;
  if (completedSet.has("get-live-site")) return 3;
  if (completedSet.has("get-frame")) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessTimeline({
  messages,
  status,
  error,
}: {
  messages: UIMessage[];
  status: string;
  error: Error | undefined;
}) {
  const isActive = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

  const toolCalls = useMemo(() => extractToolCalls(messages), [messages]);
  const breakpoints = useMemo(
    () => parseBreakpointProgress(messages),
    [messages],
  );
  const currentStep = deriveCurrentStep(toolCalls);
  const errors = collectErrors(messages, error);
  const activeTool = deriveActiveTool(toolCalls, isActive);

  if (!hasMessages && !isActive) return null;

  return (
    <div className="shrink-0 border-b bg-muted/30">
      <div className="px-4 py-3 space-y-3">
        {/* Step Stepper */}
        <Stepper currentStep={currentStep} isActive={isActive} />

        {/* Active Tool Calls (in actual call order) */}
        {toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {toolCalls.map((tc) => (
              <ToolStatusRow
                key={tc.toolCallId}
                entry={tc}
                isActive={isActive}
                isCurrent={tc.toolName === activeTool}
              />
            ))}
          </div>
        )}

        {/* Breakpoint Grid for get-live-site */}
        {(activeTool === "get-live-site" ||
          toolCalls.some((t) => t.toolName === "get-live-site")) && (
          <BreakpointGrid breakpoints={breakpoints} />
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-1.5">
            {errors.map((err, idx) => (
              <div
                key={`${err.tool ?? "global"}-${idx}`}
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs"
              >
                <AlertTriangle className="size-3.5 text-destructive shrink-0 mt-0.5" />
                <div>
                  {err.tool && (
                    <span className="font-mono font-medium text-destructive">
                      {err.tool}
                    </span>
                  )}
                  <span className="text-destructive/80 ml-1">
                    {err.message}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Idle animation when waiting for first tool */}
        {isActive && toolCalls.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>Waiting for AI to start...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Stepper({
  currentStep,
  isActive,
}: {
  currentStep: number;
  isActive: boolean;
}) {
  const STEPS = [
    { step: 1, label: "Fetch Figma Design" },
    { step: 2, label: "Collect Live Site" },
    { step: 3, label: "Section Alignment" },
    { step: 4, label: "Design Comparison" },
    { step: 5, label: "Responsive Testing" },
    { step: 6, label: "Generate PDF Report" },
  ];

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const isCurrent = s.step === currentStep;
        const isPast = s.step < currentStep;

        let stepClass =
          "size-5 rounded-full flex items-center justify-center text-[10px] font-medium border shrink-0";

        if (isPast) {
          stepClass +=
            " bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400";
        } else if (isCurrent) {
          stepClass +=
            " bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-400 animate-pulse";
        } else {
          stepClass += " bg-background border-border text-muted-foreground";
        }

        return (
          <div key={s.step} className="flex items-center gap-1.5 shrink-0">
            <div className="flex flex-col items-center gap-0.5">
              <div className={stepClass}>
                {isPast ? (
                  <CheckCircle2 className="size-3" />
                ) : isCurrent && isActive ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <span>{s.step}</span>
                )}
              </div>
              <span
                className={`text-[9px] leading-tight text-center max-w-[60px] ${
                  isCurrent
                    ? "text-blue-700 dark:text-blue-400 font-medium"
                    : isPast
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-4 h-px shrink-0 ${
                  s.step < currentStep ? "bg-emerald-400" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ToolStatusRow({
  entry,
  isActive,
  isCurrent,
}: {
  entry: ToolEntry;
  isActive: boolean;
  isCurrent: boolean;
}) {
  const isRunning =
    entry.state === "input-streaming" || entry.state === "input-available";
  const isDone = entry.state === "output-available";
  const isError = entry.state === "output-error";

  let badge: { text: string; className: string };
  if (isRunning) {
    badge = {
      text: "Executing...",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  } else if (isDone) {
    badge = {
      text: "Done",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    };
  } else if (isError) {
    badge = {
      text: "Error",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
  } else {
    badge = {
      text: "Idle",
      className: "bg-muted text-muted-foreground",
    };
  }

  return (
    <div
      className={`flex items-center gap-2 text-xs rounded-lg border px-2.5 py-1.5 ${
        isCurrent && isActive
          ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10"
          : "border-transparent"
      }`}
    >
      {isRunning && isActive ? (
        <Loader2 className="size-3 animate-spin text-amber-600" />
      ) : isDone ? (
        <CheckCircle2 className="size-3 text-emerald-600" />
      ) : isError ? (
        <XCircle className="size-3 text-red-600" />
      ) : (
        <Circle className="size-3 text-muted-foreground" />
      )}
      <span className="text-muted-foreground">{toolIcons[entry.toolName]}</span>
      <span className="font-mono font-medium">
        {toolLabels[entry.toolName] || entry.toolName}
      </span>
      <span
        className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.className}`}
      >
        {badge.text}
      </span>
    </div>
  );
}

function BreakpointGrid({ breakpoints }: { breakpoints: BreakpointStatus[] }) {
  const groups: Record<string, BreakpointStatus[]> = {
    desktop: [],
    ipad: [],
    mobile: [],
  };
  for (const bp of breakpoints) {
    groups[bp.category]?.push(bp);
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Screenshots
      </div>
      {(["desktop", "ipad", "mobile"] as const).map((cat) => {
        const meta = CATEGORY_META[cat];
        const list = groups[cat];
        if (!list?.length) return null;
        return (
          <div key={cat} className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {meta.icon}
              <span>{meta.label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {list.map((bp) => {
                const chipClass =
                  "text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors " +
                  (bp.state === "done"
                    ? "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400"
                    : bp.state === "active"
                      ? "bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400 animate-pulse"
                      : "bg-background border-border text-muted-foreground");
                return (
                  <span key={bp.dims} className={chipClass} title={bp.state}>
                    {bp.dims}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
