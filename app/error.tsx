"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { captureClientException } from "@/lib/analytics/client";

export default function AppError({
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
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground">Try again. If it keeps happening, refresh the page.</p>
        {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </div>
  );
}
