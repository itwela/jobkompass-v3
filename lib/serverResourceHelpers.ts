/**
 * Server-side resource helpers for AI agents
 * These functions can be called from API routes and server-side code
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const envConvexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
if (!envConvexUrl) {
  throw new Error("CONVEX_URL not configured");
}
const resolvedConvexUrl: string = envConvexUrl;

export function createServerConvexClient(authToken?: string) {
  const client = new ConvexHttpClient(resolvedConvexUrl);
  if (authToken) {
    client.setAuth(authToken);
  }
  return client;
}

/**
 * Add a new resource from server-side (for AI agents)
 * Expects the provided Convex client to already be authenticated.
 */
export async function serverAddResource(
  convexClient: ConvexHttpClient,
  params: {
    title: string;
    url: string;
    description?: string;
    category?: string;
    notes?: string;
    tags?: string[];
    type?: string;
  }
): Promise<Id<"resources">> {
  try {
    const resourceId = await convexClient.mutation(api.resources.add, {
      type: params.type ?? 'resource',
      title: params.title,
      url: params.url,
      description: params.description,
      category: params.category,
      notes: params.notes,
      tags: params.tags,
    });

    return resourceId;
  } catch (error) {
    console.error('Error adding resource from server:', error);
    throw error;
  }
}

/**
 * Update a resource from server-side (for AI agents)
 */
export async function serverUpdateResource(
  convexClient: ConvexHttpClient,
  params: {
    id: Id<"resources">;
    title: string;
    url: string;
    description?: string;
    category?: string;
    notes?: string;
    tags?: string[];
  }
): Promise<void> {
  try {
    await convexClient.mutation(api.resources.update, {
      id: params.id,
      type: 'resource',
      title: params.title,
      url: params.url,
      description: params.description,
      category: params.category,
      notes: params.notes,
      tags: params.tags,
    });
  } catch (error) {
    console.error('Error updating resource from server:', error);
    throw error;
  }
}

/**
 * Delete a resource from server-side (for AI agents)
 */
export async function serverDeleteResource(
  convexClient: ConvexHttpClient,
  resourceId: Id<"resources">
): Promise<void> {
  try {
    await convexClient.mutation(api.resources.remove, {
      id: resourceId,
    });
  } catch (error) {
    console.error('Error deleting resource from server:', error);
    throw error;
  }
}

