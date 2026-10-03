// app/jk-components/jkEmailLeads/AddLeadFromEmail.tsx
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { RATE_LIMIT_FRIENDLY } from "@/lib/rateLimit/message";

type SenderHit = {
  accountId: string;
  accountEmail: string;
  messageId: string;
  threadId: string;
  subject: string;
  snippet: string;
  receivedAt: number;
  rfcMessageId: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Manually turn one specific email into a lead: type a sender's address, pick
// from their 3 most recent messages, and the chosen one runs the same draft +
// tailor-resume pipeline as the auto-detected leads.
export function AddLeadFromEmail() {
  const searchSender = useAction(api.jobLeads.searchSenderForManualLead);
  const addManual = useAction(api.jobLeads.addManualLeadFromMessage);

  const [sender, setSender] = useState("");
  const [hits, setHits] = useState<SenderHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const validEmail = EMAIL_RE.test(sender.trim());

  const onFind = async () => {
    if (!validEmail) return;
    setBusy(true);
    setMessage(null);
    setHits(null);
    try {
      const results = await searchSender({ senderEmail: sender.trim() });
      setHits(results);
      if (results.length === 0) {
        setMessage("No emails found from that address in your connected inboxes.");
      }
    } catch (err: any) {
      setMessage(err?.message ?? "Search failed.");
    } finally {
      setBusy(false);
    }
  };

  const onUse = async (hit: SenderHit) => {
    setAddingId(hit.messageId);
    setMessage(null);
    try {
      const res = await addManual({
        accountId: hit.accountId as any,
        messageId: hit.messageId,
      });
      if (res.duplicate) {
        setMessage("That email is already a lead.");
      } else {
        setMessage("Lead added — drafting a reply and tailoring your resume now. Check Pending Approval.");
        setHits(null);
        setSender("");
      }
    } catch (err: any) {
      const raw = typeof err?.message === "string" ? err.message : "";
      setMessage(raw.includes("Too many AI requests") ? RATE_LIMIT_FRIENDLY : raw || "Could not add that email.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Add a lead from an email</h3>
        <p className="text-xs text-muted-foreground">
          Paste the sender&apos;s email address. We&apos;ll pull their 3 most recent
          messages from your connected inboxes so you can pick the right one.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="email"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onFind();
          }}
          placeholder="recruiter@company.com"
          className="flex-1 text-sm px-3 py-1.5 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={onFind}
          disabled={busy || !validEmail}
          className="text-sm px-3 py-1.5 rounded border hover:bg-accent transition-colors disabled:opacity-60"
        >
          {busy ? "Finding…" : "Find emails"}
        </button>
      </div>

      {hits && hits.length > 0 && (
        <ul className="space-y-2">
          {hits.map((hit) => (
            <li
              key={hit.messageId}
              className="flex items-start justify-between gap-3 rounded border p-3"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-medium truncate">
                  {hit.subject || "(no subject)"}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {hit.snippet}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(hit.receivedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}{" "}
                  · {hit.accountEmail}
                </div>
              </div>
              <button
                onClick={() => onUse(hit)}
                disabled={addingId !== null}
                className="shrink-0 text-xs px-3 py-1.5 rounded border hover:bg-accent transition-colors disabled:opacity-60"
              >
                {addingId === hit.messageId ? "Adding…" : "Use this one"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
