import { NextRequest, NextResponse } from "next/server";

const OPENAI_KEY =
  process.env.NODE_ENV === "production"
    ? process.env.OPENAI_API_KEY
    : process.env.NEXT_PUBLIC_OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  if (!OPENAI_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  let body: { excerpt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const excerpt =
    typeof body.excerpt === "string" ? body.excerpt.trim() : "";
  if (!excerpt) {
    return NextResponse.json(
      { error: "Conversation excerpt is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Generate a concise, descriptive title (max 50 characters) for this conversation. Only return the title, nothing else.",
          },
          {
            role: "user",
            content: excerpt,
          },
        ],
        max_tokens: 50,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data.error?.message || data.message || "OpenAI request failed";
      return NextResponse.json(
        { error: message },
        { status: response.status >= 500 ? 502 : 400 }
      );
    }

    const rawTitle = data.choices?.[0]?.message?.content;
    if (typeof rawTitle !== "string") {
      return NextResponse.json(
        { error: "Invalid response from title generation" },
        { status: 502 }
      );
    }

    const title = rawTitle.trim().slice(0, 100) || "New chat";
    return NextResponse.json({ title });
  } catch (err) {
    console.error("Retitle API error:", err);
    return NextResponse.json(
      { error: "Failed to generate title" },
      { status: 500 }
    );
  }
}
