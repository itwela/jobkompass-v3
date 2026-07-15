// app/jk-components/jkEmailLeads/ScanNowButton.tsx
"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

// Manually runs the lead-scan that the cron normally runs on a schedule, but only
// over the current user's own inboxes. Shows an inline result so you know whether it
// found anything or hit an account error — no need to wait for the next cron tick.
export function ScanNowButton() {
  const scan = useAction(api.emailAgent.poll.pollMyAccounts);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runScan = async () => {
    setScanning(true);
    setResult(null);
    try {
      const { scanned, newLeads, errors } = await scan({});
      if (errors.length > 0) {
        setResult(errors.join(" "));
      } else if (scanned === 0) {
        setResult("No connected inboxes to scan.");
      } else if (newLeads === 0) {
        setResult(`Scanned ${scanned} inbox${scanned === 1 ? "" : "es"} — no new leads.`);
      } else {
        setResult(`Found ${newLeads} new lead${newLeads === 1 ? "" : "s"}.`);
      }
    } catch (err: any) {
      setResult(err?.message ?? "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={runScan}
        disabled={scanning}
        className="text-sm px-3 py-1.5 rounded border hover:bg-accent transition-colors disabled:opacity-60"
        title="Check your connected inboxes for new job leads right now"
      >
        {scanning ? "Scanning…" : "Scan now"}
      </button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </div>
  );
}
