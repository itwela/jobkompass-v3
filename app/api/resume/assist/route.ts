import {
	Agent,
	assistant,
	run,
	setDefaultOpenAIKey,
	user,
} from '@openai/agents';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const requestSchema = z.object({
	message: z.string().min(1),
	history: z
		.array(
			z.object({
				role: z.union([z.literal('user'), z.literal('assistant')]),
				content: z.string(),
			}),
		)
		.optional()
		.default([]),
});

const instructions = `
You are a concise resume writing assistant who helps users craft professional, ATS-friendly content.
Always respond with a short, well-formed answer that the user can read.

When you want the client to automatically fill resume fields, append a fenced code block with the language tag \`updates\`.
Inside that block, provide a JSON array of update objects. Follow the schema exactly:

\`\`\`updates
[
  { "type": "personal", "field": "firstName", "value": "Jordan" },
  { "type": "experience", "id": "exp123", "field": "title", "value": "Senior Software Engineer" },
  { "type": "experience_bullet", "experienceId": "exp123", "bulletId": "bul456", "value": "Drove 20% growth..." },
  { "type": "experience_bullet", "experienceId": "exp123", "value": "Introduced CI/CD pipeline..." }
]
\`\`\`

Allowed types:
- "personal": field must be one of firstName, lastName, email, location.
- "experience": field must be one of company, title, start, end, location; include the experience item's id.
- "experience_bullet": include experienceId. Provide bulletId to update an existing bullet; omit bulletId to add a new one.

Do not include extra commentary inside the updates block. Always keep the readable answer outside the updates block.
If you have no structured updates, simply omit the updates block.
`;

setDefaultOpenAIKey(
	process.env.NODE_ENV === 'production'
		? process.env.OPENAI_API_KEY!
		: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
);

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { message, history } = requestSchema.parse(body);

		const agent = new Agent({
			name: 'ResumeAssistant',
			instructions,
			model: 'gpt-5-mini',
		});

		const conversation = [
			...history.map(item => (item.role === 'user' ? user(item.content) : assistant(item.content))),
			user(message),
		];

		const result = await run(agent, conversation, { maxTurns: 4 });
		const responseText = result.finalOutput?.trim() || 'I was not able to generate a response.';

		return NextResponse.json({
			success: true,
			message: responseText,
		});
	} catch (error) {
		console.error('Resume assistant error:', error);
		return NextResponse.json(
			{
				success: false,
				message: 'Sorry, something went wrong while talking to the resume assistant.',
			},
			{ status: 500 },
		);
	}
}


