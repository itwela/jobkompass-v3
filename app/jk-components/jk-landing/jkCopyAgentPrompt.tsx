'use client'

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { CLI_AGENT_PROMPT } from "./jkLandingAgents";

/** Copies the setup prompt a person pastes into their agent. */
export default function JkCopyAgentPrompt() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CLI_AGENT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {}
  };
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
      <button type="button" onClick={copy} className="jk-fx jk-fx-cream inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full bg-primary px-5 text-[14.5px] font-medium text-primary-foreground">
        <span className="relative z-[2] flex items-center gap-2.5">
          {copied ? <Check className="size-4" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={1.8} />}
          {copied ? "Copied. Paste it into your agent" : "Copy the setup prompt"}
        </span>
      </button>
      <p className="text-[13.5px] leading-5 text-muted-foreground">Paste it into any agent. It installs jk, asks you for a key and starts saving jobs.</p>
    </div>
  );
}
