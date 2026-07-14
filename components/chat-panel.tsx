"use client";

import { useChat } from "@ai-sdk/react";
import {
  Brain,
  Bug,
  FileText,
  Globe,
  Loader2,
  Paintbrush,
  Send,
} from "lucide-react";
import { useState } from "react";
import { ProcessTimeline } from "@/components/process-timeline";
import { Button } from "@/components/ui/button";

interface UrlFormState {
  figmaUrl: string;
  liveSiteUrl: string;
}

export function ChatPanel() {
  const [urls, setUrls] = useState<UrlFormState>({
    figmaUrl: "",
    liveSiteUrl: "",
  });

  const { messages, sendMessage, status, error } = useChat();

  const isLoading = status === "submitted" || status === "streaming";
  const hasStarted = messages.length > 0;

  function handleStartAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!urls.figmaUrl.trim() || !urls.liveSiteUrl.trim() || isLoading) return;

    const prompt = `Please run a full QA audit comparing the live site ${urls.liveSiteUrl.trim()} against the Figma design ${urls.figmaUrl.trim()}. Follow all steps in your instructions: fetch the Figma frame, collect live site data, compare section-by-section, test responsive breakpoints, and compile the final PDF report.`;

    sendMessage({ text: prompt });
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* URL Input Form */}
      <div className="shrink-0 p-4 border-b bg-card">
        <form onSubmit={handleStartAudit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="figma-url"
                className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
              >
                <Paintbrush className="size-3.5" />
                Figma Design URL
              </label>
              <input
                id="figma-url"
                type="url"
                placeholder="https://www.figma.com/file/...?node-id=1-2"
                value={urls.figmaUrl}
                onChange={(e) =>
                  setUrls((u) => ({ ...u, figmaUrl: e.target.value }))
                }
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="live-url"
                className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
              >
                <Globe className="size-3.5" />
                Live Site URL
              </label>
              <input
                id="live-url"
                type="url"
                placeholder="https://example.com"
                value={urls.liveSiteUrl}
                onChange={(e) =>
                  setUrls((u) => ({ ...u, liveSiteUrl: e.target.value }))
                }
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              The agent will fetch the Figma frame, crawl the live site across
              18 breakpoints, and produce a section-by-section comparison
              report.
            </p>
            <Button
              type="submit"
              disabled={isLoading || !urls.figmaUrl || !urls.liveSiteUrl}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Running Audit...
                </>
              ) : (
                <>
                  <Bug className="size-4 mr-1.5" />
                  Run QA Audit
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Process Timeline */}
      <ProcessTimeline messages={messages} status={status} error={error} />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!hasStarted && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center">
              <FileText className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-foreground">
                QA Agent Test Console
              </h3>
              <p className="text-sm max-w-sm">
                Enter a Figma design URL and a live site URL above to start a
                pixel-perfect design audit powered by AI.
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${
              message.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted border border-border"
              }`}
            >
              {message.parts?.map((part, i) => {
                switch (part.type) {
                  case "text":
                    return (
                      <div
                        key={`${message.id}-${i}`}
                        className="whitespace-pre-wrap"
                      >
                        {part.text}
                      </div>
                    );
                  case "reasoning": {
                    const reasoningPart = part as unknown as {
                      text: string;
                    };
                    return (
                      <details
                        key={`${message.id}-${i}`}
                        className="mt-2 text-xs text-muted-foreground"
                      >
                        <summary className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
                          <Brain className="size-3" />
                          Thinking...
                        </summary>
                        <div className="mt-1 pl-4 border-l-2 border-muted whitespace-pre-wrap">
                          {reasoningPart.text}
                        </div>
                      </details>
                    );
                  }
                  case "tool-get-frame": {
                    const toolPart = part as unknown as {
                      toolCallId: string;
                      state: string;
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    return (
                      <ToolCallCard
                        key={toolPart.toolCallId}
                        icon={<Paintbrush className="size-3.5" />}
                        title="get-frame"
                        input={toolPart.input}
                        output={toolPart.output}
                        state={toolPart.state}
                        errorText={toolPart.errorText}
                      />
                    );
                  }
                  case "tool-get-live-site": {
                    const toolPart = part as unknown as {
                      toolCallId: string;
                      state: string;
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    return (
                      <ToolCallCard
                        key={toolPart.toolCallId}
                        icon={<Globe className="size-3.5" />}
                        title="get-live-site"
                        input={toolPart.input}
                        output={toolPart.output}
                        state={toolPart.state}
                        errorText={toolPart.errorText}
                      />
                    );
                  }
                  case "tool-generate-pdf": {
                    const toolPart = part as unknown as {
                      toolCallId: string;
                      state: string;
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    return (
                      <ToolCallCard
                        key={toolPart.toolCallId}
                        icon={<FileText className="size-3.5" />}
                        title="generate-pdf"
                        input={toolPart.input}
                        output={toolPart.output}
                        state={toolPart.state}
                        errorText={toolPart.errorText}
                      />
                    );
                  }
                  default:
                    return (
                      <pre
                        key={`${message.id}-${i}`}
                        className="text-xs mt-2 overflow-x-auto"
                      >
                        {JSON.stringify(part, null, 2)}
                      </pre>
                    );
                }
              }) ?? (
                <div className="whitespace-pre-wrap">
                  {/* biome-ignore lint/suspicious/noExplicitAny: legacy content fallback */}
                  {(message as any).content ?? ""}
                </div>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 px-1">
              {message.role === "user" ? "You" : "QA Agent"}
            </span>
          </div>
        ))}

        {error && (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
            <strong>Error:</strong> {error.message}
          </div>
        )}
      </div>

      {/* Follow-up Input */}
      {hasStarted && (
        <div className="shrink-0 p-4 border-t bg-card">
          <FollowUpInput
            onSend={(text) => sendMessage({ text })}
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}

function getStatusBadge(state?: string) {
  if (state === "input-streaming" || state === "input-available") {
    return {
      text: "Executing...",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  if (state === "output-error") {
    return {
      text: "Error",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
  }
  return {
    text: "Done",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  };
}

function ToolCallCard({
  icon,
  title,
  input,
  output,
  state,
  errorText,
}: {
  icon: React.ReactNode;
  title: string;
  input?: unknown;
  output?: unknown;
  state?: string;
  errorText?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const statusBadge = getStatusBadge(state);

  return (
    <div className="mt-2 rounded-xl border border-border bg-background/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
      >
        {icon}
        <span className="font-mono">{title}</span>
        <span
          className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadge.className}`}
        >
          {statusBadge.text}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 text-xs font-mono">
          {input != null && (
            <div>
              <div className="text-muted-foreground mb-0.5">Arguments</div>
              <pre className="rounded-lg bg-muted p-2 overflow-x-auto">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output != null && (
            <div>
              <div className="text-muted-foreground mb-0.5">Result</div>
              <pre className="rounded-lg bg-muted p-2 overflow-x-auto max-h-40">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
          {errorText != null && (
            <div>
              <div className="text-muted-foreground mb-0.5">Error</div>
              <pre className="rounded-lg bg-destructive/10 text-destructive p-2 overflow-x-auto">
                {errorText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FollowUpInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        placeholder="Ask a follow-up question..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" size="icon" disabled={disabled || !text.trim()}>
        <Send className="size-4" />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );
}
