import { NextResponse } from 'next/server';
import { tool } from '@openai/agents';
import { z } from 'zod';

export async function GET() {
  // Provide a summary of JobKompass for an AI consumer
  const info = {
    name: "JobKompass",
    description: "JobKompass is a web platform that helps users explore careers, craft professional resumes, and receive guided assistance in their job search. It provides intelligent tools to draft, edit, and optimize job documents with AI support, as well as resources to make job hunting more effective.",
    apiPurpose: "This API offers endpoints for interacting with JobKompass features, resume tools, and guidance systems. It is intended to enable AI agents to offer better help or deeper integration with the platform.",
    usageHint: "To get started, explore available endpoints or see the documentation for writing resumes, career search guidance, or accessing platform resources."
  };


  return NextResponse.json(info);
}