import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// CORS headers for Chrome extension requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle CORS preflight for extension endpoint
http.route({
  path: "/extension/saveJob",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }),
});

// Chrome Extension endpoint: Save a job listing
http.route({
  path: "/extension/saveJob",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { apiKey, pageText, pageUrl, pageTitle, status } = body;

      // Validate required fields
      if (!apiKey || typeof apiKey !== "string") {
        return new Response(
          JSON.stringify({ success: false, error: "API key is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!pageText || typeof pageText !== "string" || pageText.trim().length < 20) {
        return new Response(
          JSON.stringify({ success: false, error: "Page text is required (minimum 20 characters)" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Authenticate via API key
      const keyRecord = await ctx.runQuery(internal.extensionApiKeys.lookupByKey, { key: apiKey });
      if (!keyRecord) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid API key" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Run the parse + save action
      const result = await ctx.runAction(internal.extensionSaveJob.parseAndSave, {
        userId: keyRecord.userId,
        apiKeyId: keyRecord._id,
        pageText: pageText,
        pageUrl: pageUrl || "",
        pageTitle: pageTitle || "",
        status: status || undefined,
      });

      return new Response(
        JSON.stringify({
          success: true,
          jobListingId: result.jobListingId,
          message: "Job listing saved successfully",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } catch (error: any) {
      console.error("Extension saveJob error:", error);

      const message = error.message || "Failed to save job listing";
      const errorStatus = message.includes("Job limit") ? 429 : 500;

      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: errorStatus, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }),
});

export default http;
