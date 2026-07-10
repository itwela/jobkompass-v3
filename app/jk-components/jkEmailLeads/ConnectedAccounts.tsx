"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function ConnectedAccounts() {
  const accounts = useQuery(api.emailAccounts.list, {});
  const disconnect = useMutation(api.emailAccounts.disconnect);

  return (
    <div className="space-y-4">
      {accounts === undefined ? (
        <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          No Gmail accounts connected yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li
              key={account._id}
              className="flex items-center justify-between p-3 rounded-md border"
              style={{ borderColor: "var(--border)" }}
            >
              <div>
                <div className="text-sm font-medium">{account.email}</div>
                <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {account.status === "active" ? "Connected" : "Revoked"} · since{" "}
                  {new Date(account.connectedAt).toLocaleDateString()}
                </div>
              </div>
              {account.status === "active" && (
                <button
                  onClick={() => disconnect({ accountId: account._id })}
                  className="text-xs px-3 py-1 rounded border"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                >
                  Disconnect
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <a
        href="/api/gmail/oauth/start"
        className="inline-block px-4 py-2 rounded-md font-medium text-sm"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        Connect Gmail Account
      </a>
    </div>
  );
}
