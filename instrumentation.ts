import type { Instrumentation } from "next";

export async function register() {
  // The PostHog server client is created on the first captured exception.
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { captureServerException, readDistinctIdFromCookie, serverExceptionProperties } = await import(
    "@/lib/analytics/server"
  );
  await captureServerException(
    error,
    readDistinctIdFromCookie(request.headers.cookie),
    serverExceptionProperties({
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
    })
  );
};
