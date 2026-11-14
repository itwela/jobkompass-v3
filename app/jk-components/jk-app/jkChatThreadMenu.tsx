'use client'

/**
 * The "…" menu for an open chat thread (Retitle). Moved here from the old desktop top bar,
 * which the v4 frames drop. The shell shows it top-right of the content on desktop and in
 * the phone header on small screens, only while a thread is open in Chat.
 */
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, MoreHorizontal, Type } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { toast } from "@/lib/toast";
import { rateLimitMessageFromResponse } from "@/lib/rateLimit/message";
import { cn } from "@/lib/utils";

export default function JkChatThreadMenu({ className }: { className?: string }) {
  const { currentMode, currentThreadId } = useJobKompassChatWindow();
  const [retitling, setRetitling] = useState(false);
  const threadData = useQuery(api.threads.get, currentThreadId ? { threadId: currentThreadId } : "skip");
  const updateTitle = useMutation(api.threads.updateTitle);

  if (currentMode.id !== "/chat" || !currentThreadId) return null;

  const handleRetitle = async () => {
    const messages = threadData?.messages;
    const allText = (messages ?? [])
      .map((msg: { role?: string; content?: string }) => `${msg.role ?? "user"}: ${typeof msg.content === "string" ? msg.content : ""}`)
      .join("\n");
    const excerpt = allText.slice(-2000);
    if (!excerpt.trim()) {
      toast.info("Add some messages first", "Start a conversation, then use Retitle to generate a title.");
      return;
    }
    setRetitling(true);
    try {
      const response = await fetch("/api/chat/retitle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excerpt }),
      });
      if (response.status === 429) {
        toast.error("Retitle failed", rateLimitMessageFromResponse(response));
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        toast.error("Retitle failed", typeof data.error === "string" ? data.error : "Please try again.");
        return;
      }
      const newTitle = typeof data.title === "string" ? data.title.trim().slice(0, 100) : null;
      if (!newTitle) {
        toast.error("Retitle failed", "No title was generated. Please try again.");
        return;
      }
      await updateTitle({ threadId: currentThreadId, title: newTitle });
      toast.success("Title updated", "Chat title has been updated.");
    } catch (error) {
      console.error("Error retitling:", error);
      toast.error("Retitle failed", "Something went wrong. Please try again.");
    } finally {
      setRetitling(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={retitling}
          aria-label={retitling ? "Retitling" : "Chat options"}
          className={cn("flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", className)}
        >
          {retitling ? <Loader2 className="size-[18px] animate-spin" /> : <MoreHorizontal className="size-[18px]" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleRetitle} disabled={retitling}>
          <Type className="mr-2 size-4" />
          {retitling ? "Retitling..." : "Retitle"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
