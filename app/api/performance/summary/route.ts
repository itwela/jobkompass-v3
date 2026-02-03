/**
 * API route for generating AI-powered performance summaries
 * Uses free OpenRouter models to analyze job hunt stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { FREE_RESUME_MODEL_IDS } from '@/lib/aiModels';

const OPENROUTER_MODEL_PRIMARY = FREE_RESUME_MODEL_IDS[0];
const OPENROUTER_MODEL_FALLBACK = FREE_RESUME_MODEL_IDS[1];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PerformanceStats {
  totalJobs: number;
  statusCounts: {
    Applied?: number;
    Callback?: number;
    Interviewing?: number;
    Offered?: number;
    Rejected?: number;
    Ghosted?: number;
    Interested?: number;
  };
  resumeStats?: Record<string, {
    totalJobs: number;
    offered: number;
    rejected: number;
    ghosted: number;
    applied: number;
    interviewing: number;
  }>;
  coverLetterStats?: Record<string, {
    totalJobs: number;
    offered: number;
    rejected: number;
    ghosted: number;
    applied: number;
    interviewing: number;
  }>;
  documentsGeneratedThisMonth?: number;
  jobsCount?: number;
}

const SYSTEM_PROMPT = `You are a career coach analyzing a job seeker's performance. Given job hunt statistics, write a personalized, actionable 2-4 sentence summary.

Guidelines:
- Be encouraging but honest
- Focus on actionable insights (e.g., "Try tailoring your Software Engineer resume more" or "Your 15% response rate suggests stronger cover letters could help")
- Mention specific numbers when relevant
- Suggest 1-2 concrete next steps
- Keep it conversational and supportive
- If they have interviews or offers, acknowledge those wins
- If stats are low, focus on improvement opportunities

Return ONLY the summary text, no additional formatting or explanations.`;

export async function POST(req: NextRequest) {
  try {
    const stats: PerformanceStats = await req.json();

    if (!stats || typeof stats.totalJobs !== 'number') {
      return NextResponse.json(
        { error: 'Invalid stats provided' },
        { status: 400 }
      );
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return NextResponse.json(
        { error: 'OpenRouter not configured' },
        { status: 500 }
      );
    }

    // Build user prompt with stats
    const userPrompt = `Analyze these job hunt stats and provide a personalized, actionable summary:

Total Jobs: ${stats.totalJobs}
Status Breakdown:
- Interested: ${stats.statusCounts.Interested || 0}
- Applied: ${stats.statusCounts.Applied || 0}
- Callback: ${stats.statusCounts.Callback || 0}
- Interviewing: ${stats.statusCounts.Interviewing || 0}
- Offered: ${stats.statusCounts.Offered || 0}
- Rejected: ${stats.statusCounts.Rejected || 0}
- Ghosted: ${stats.statusCounts.Ghosted || 0}

${stats.resumeStats && Object.keys(stats.resumeStats).length > 0 ? `Resume Performance:
${Object.entries(stats.resumeStats).map(([name, data]: [string, any]) =>
  `- ${name}: ${data.totalJobs} jobs (${data.offered} offers, ${data.callback ?? 0} callback, ${data.interviewing} interviewing, ${data.rejected} rejected)`
).join('\n')}` : ''}

${stats.coverLetterStats && Object.keys(stats.coverLetterStats).length > 0 ? `Cover Letter Performance:
${Object.entries(stats.coverLetterStats).map(([name, data]: [string, any]) =>
  `- ${name}: ${data.totalJobs} jobs (${data.offered} offers, ${data.callback ?? 0} callback, ${data.interviewing} interviewing, ${data.rejected} rejected)`
).join('\n')}` : ''}

${stats.documentsGeneratedThisMonth ? `Documents Generated This Month: ${stats.documentsGeneratedThisMonth}` : ''}`;

    const callOpenRouter = async (model: string) => {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://jobkompass.com',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
      return res;
    };

    // Try primary model with retry
    let res = await callOpenRouter(OPENROUTER_MODEL_PRIMARY);
    if (!res.ok && [502, 429, 503].includes(res.status)) {
      await sleep(2000);
      res = await callOpenRouter(OPENROUTER_MODEL_PRIMARY);
    }

    // Fall back to secondary model if primary fails
    if (!res.ok && [502, 429, 503].includes(res.status)) {
      await sleep(1000);
      res = await callOpenRouter(OPENROUTER_MODEL_FALLBACK);
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenRouter error:', res.status, errText);
      return NextResponse.json(
        { error: `AI generation failed: ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content;

    // Handle both string and array content (some models return content as array of parts)
    let summary: string;
    if (typeof rawContent === 'string') {
      summary = rawContent.trim();
    } else if (Array.isArray(rawContent)) {
      summary = rawContent
        .map((part: { type?: string; text?: string }) =>
          part?.type === 'text' && typeof part?.text === 'string' ? part.text : ''
        )
        .join(' ')
        .trim();
    } else {
      summary = '';
    }

    if (!summary) {
      return NextResponse.json(
        { error: 'AI did not return a valid summary' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      summary,
      modelUsed: res.status === 200 ? OPENROUTER_MODEL_PRIMARY : OPENROUTER_MODEL_FALLBACK
    });

  } catch (error) {
    console.error('Performance summary error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
