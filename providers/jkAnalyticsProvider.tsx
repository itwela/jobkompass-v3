"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/providers/jkAuthProvider";
import {
  captureFirstTouchFromBrowser,
  capturePageview,
  identifyUser,
  initAnalytics,
  readPendingResumeSource,
  resetAnalytics,
  syncSessionReplay,
  trackFirstResumeCreated,
} from "@/lib/analytics/client";

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    capturePageview(pathname || "/", search ? `?${search}` : "");
  }, [pathname, search]);

  return null;
}

function IdentityTracker() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && user?._id) {
      identifyUser(user._id);
      wasAuthenticated.current = true;
      return;
    }
    if (wasAuthenticated.current) {
      resetAnalytics();
      wasAuthenticated.current = false;
    }
  }, [isAuthenticated, isLoading, user?._id]);

  return null;
}

/**
 * Fires once when an account goes from zero saved resumes to one.
 * The resume list is only used for its length.
 */
function FirstResumeTracker() {
  const { user, isAuthenticated } = useAuth();
  const resumes = useQuery(api.documents.listResumes, isAuthenticated ? {} : "skip");
  const userId = user?._id;
  const previousUser = useRef<string | null>(null);
  const previousCount = useRef<number | null>(null);
  const count = resumes?.length;

  useEffect(() => {
    if (!userId || count === undefined) return;
    if (previousUser.current !== userId) {
      previousUser.current = userId;
      previousCount.current = count;
      return;
    }
    if (previousCount.current === 0 && count > 0) {
      trackFirstResumeCreated(userId, readPendingResumeSource());
    }
    previousCount.current = count;
  }, [userId, count]);

  return null;
}

export function JkAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    captureFirstTouchFromBrowser();
    initAnalytics();
  }, []);

  useEffect(() => {
    syncSessionReplay(pathname || "/");
  }, [pathname]);

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentityTracker />
      <FirstResumeTracker />
      {children}
    </>
  );
}
