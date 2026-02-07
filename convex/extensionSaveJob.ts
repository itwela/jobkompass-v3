import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const OPENROUTER_PARSE_PROMPT = `You are a job listing parser. Extract structured information from the following webpage text that contains a job listing.

Return a JSON object with these fields:
- company: string (the company name)
- title: string (the job title/position)
- compensation: string or null (salary range if mentioned, e.g. "$100k-$150k")
- location: string or null (job location, include remote if mentioned)
- description: string (a concise 2-3 sentence summary of the role)
- skills: string[] (key skills/requirements, max 10)
- keywords: string[] (relevant keywords for this job, max 8)

If you cannot determine a field, use null for optional fields or "Unknown" for required string fields.
Respond with ONLY valid JSON, no explanation or markdown.`;

// Internal action: parse job listing text with OpenRouter and save to database
export const parseAndSave = internalAction({
  args: {
    userId: v.string(),
    apiKeyId: v.id("extensionApiKeys"),
    pageText: v.string(),
    pageUrl: v.string(),
    pageTitle: v.string(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; jobListingId: string }> => {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      throw new Error("OpenRouter API key not configured on server");
    }

    // Call OpenRouter to parse the job listing
    let parsed: any;
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://myjobkompass.com",
          "X-Title": "JobKompass Extension",
        },
        body: JSON.stringify({
          model: "google/gemma-3-27b-it:free",
          messages: [
            { role: "system", content: OPENROUTER_PARSE_PROMPT },
            { role: "user", content: args.pageText.substring(0, 12000) },
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter error:", response.status, errorText);
        // Fall back to basic parsing if OpenRouter fails
        parsed = null;
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = content.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          console.error("Failed to parse OpenRouter JSON response:", content);
          parsed = null;
        }
      }
    } catch (error) {
      console.error("OpenRouter request failed:", error);
      parsed = null;
    }

    // Build job data from parsed result or fallback
    const company = parsed?.company || extractCompanyFromTitle(args.pageTitle) || "Unknown";
    const title = parsed?.title || extractJobTitleFromTitle(args.pageTitle) || "Job Listing";
    const compensation = parsed?.compensation || undefined;
    const description = parsed?.description || args.pageText.substring(0, 500);
    const skills = Array.isArray(parsed?.skills) ? parsed.skills.slice(0, 10) : undefined;
    const keywords = Array.isArray(parsed?.keywords) ? parsed.keywords.slice(0, 8) : undefined;

    // Save to database using the internal mutation
    const jobId: string = await ctx.runMutation(internal.jobs.addInternal, {
      userId: args.userId,
      company,
      title,
      link: args.pageUrl,
      status: args.status || "Interested",
      description,
      skills,
      keywords,
    }) as string;

    // Update the API key's lastUsedAt
    await ctx.runMutation(internal.extensionApiKeys.markUsed, {
      keyId: args.apiKeyId,
    });

    return { success: true, jobListingId: jobId };
  },
});

// Fallback helpers for when OpenRouter parsing fails
function extractCompanyFromTitle(pageTitle: string): string | null {
  // Common patterns: "Job Title at Company", "Job Title - Company", "Company | Job Title"
  const atMatch = pageTitle.match(/\bat\s+(.+?)(?:\s*[-|]|$)/i);
  if (atMatch) return atMatch[1].trim();

  const dashMatch = pageTitle.match(/[-|]\s*(.+?)(?:\s*[-|]|$)/);
  if (dashMatch) return dashMatch[1].trim();

  return null;
}

function extractJobTitleFromTitle(pageTitle: string): string | null {
  // Take the first part before " at ", " - ", or " | "
  const match = pageTitle.match(/^(.+?)(?:\s+at\s+|\s*[-|]\s*)/i);
  if (match) return match[1].trim();
  return pageTitle.trim() || null;
}
