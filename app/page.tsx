import { FileText } from "lucide-react";
import { AuthButton } from "@/components/auth-button";
import { ChatPanel } from "@/components/chat-panel";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="size-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">
              Figma QA Agent
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Pixel-perfect design audit
            </p>
          </div>
        </div>
        <AuthButton />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <ChatPanel />
      </main>
    </div>
  );
}
