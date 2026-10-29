import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  if (!convexUrl) return new Response("Not configured", { status: 500 });

  const shared = await new ConvexHttpClient(convexUrl).query(api.resumeShares.getShared, { shareId });
  if (!shared) return new Response("Resume not found", { status: 404 });

  const file = await fetch(shared.url);
  if (!file.ok || !file.body) return new Response("Resume not found", { status: 404 });

  const fileName = shared.fileName.replace(/[^\w .()-]/g, "");
  return new Response(file.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
