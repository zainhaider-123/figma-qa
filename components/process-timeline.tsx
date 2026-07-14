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
  XCircle,
} from "lucide-react";

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
  step: number;
}

interface TimelineStep {
  step: number;
  label: string;
  tool: string | null;
}

const STEPS: TimelineStep[] = [
  { step: 1, label: "Fetch Figma Design", tool: "get-frame" },
  { step: 2, label: "Collect Live Site", tool: "get-live-site" },
  { step: 3, label: "Section Alignment", tool: null },
  { step: 4, label: "Design Comparison", tool: null },
  { step: 5, label: "Responsive Testing", tool: null },
  { step: 6, label: "Generate PDF Report", tool: "generate-pdf" },
];

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

  const toolCalls = extractToolCalls(messages);
  const currentStep = deriveCurrentStep(messages);
  const errors = collectErrors(messages, error);

  if (!hasMessages && !isActive) return null;

  return (
    <div className="shrink-0 border-b bg-muted/30">
      <div className="px-4 py-3 space-y-3">
        {/* Step Stepper */}
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

        {/* Active Tool Calls */}
        {toolCalls.length > 0 && (
          <div className="space-y-1.5">
            {toolCalls.map((tc) => (
              <ToolStatusRow
                key={tc.toolCallId}
                entry={tc}
                isActive={isActive}
              />
            ))}
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-1.5">
            {errors.map((err) => (
              <div
                key={err.tool || err.message}
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

function ToolStatusRow({
  entry,
  isActive,
}: {
  entry: ToolEntry;
  isActive: boolean;
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
    <div className="flex items-center gap-2 text-xs">
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

function extractToolCalls(messages: UIMessage[]): ToolEntry[] {
  const seen = new Map<string, ToolEntry>();

  for (const msg of messages) {
    if (!msg.parts) continue;
    for (const part of msg.parts) {
      const toolPart = part as any;
      if (
        !toolPart.type?.startsWith("tool-") &&
        toolPart.type !== "dynamic-tool"
      )
        continue;

      const toolName =
        toolPart.type === "dynamic-tool"
          ? toolPart.toolName
          : toolPart.type.replace("tool-", "");
      const toolCallId = toolPart.toolCallId || toolName;
      const state: ToolState = toolPart.state || "idle";

      const step = STEPS.find((s) => s.tool === toolName)?.step ?? 0;

      const existing = seen.get(toolCallId);
      if (!existing || statePriority(state) >= statePriority(existing.state)) {
        seen.set(toolCallId, {
          toolName,
          toolCallId,
          state,
          errorText: toolPart.errorText,
          step,
        });
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.step - b.step);
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

function deriveCurrentStep(messages: UIMessage[]): number {
  const toolCalls = extractToolCalls(messages);

  const completedTools = toolCalls.filter(
    (t) => t.state === "output-available",
  );

  if (completedTools.some((t) => t.toolName === "generate-pdf")) return 6;
  if (completedTools.some((t) => t.toolName === "get-live-site")) return 3;
  if (completedTools.some((t) => t.toolName === "get-frame")) return 2;
  return 1;
}

interface TimelineError {
  tool?: string;
  message: string;
}

function collectErrors(
  messages: UIMessage[],
  chatError: Error | undefined,
): TimelineError[] {
  const errors: TimelineError[] = [];

  for (const msg of messages) {
    if (!msg.parts) continue;
    for (const part of msg.parts) {
      const toolPart = part as any;
      if (
        !toolPart.type?.startsWith("tool-") &&
        toolPart.type !== "dynamic-tool"
      )
        continue;
      if (toolPart.state === "output-error" && toolPart.errorText) {
        const toolName =
          toolPart.type === "dynamic-tool"
            ? toolPart.toolName
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
