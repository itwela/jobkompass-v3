"use client";

import { useEffect } from "react";
import { captureClientException } from "@/lib/analytics/client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ opacity: 0.75 }}>Try again. If it keeps happening, refresh the page.</p>
          {error.digest ? <p style={{ fontSize: 12, opacity: 0.6 }}>Reference: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, border: "1px solid #444", background: "transparent", color: "inherit" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
