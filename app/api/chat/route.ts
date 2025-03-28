import { generateText, streamText } from 'ai';
import { NextResponse } from 'next/server';
import { deepseek } from '@/app/helpers/clients/deeepseekClient';
import dotenv from 'dotenv';
dotenv.config();

// stream text
export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = await streamText({
      model: deepseek('deepseek-chat', {
      simulateStreaming: true,
      }),
      system: 'You are a helpful assistant.',
      messages,
    });

    return result.toDataStreamResponse();

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

// generate text
// export async function POST(req: Request) {
//   try {
//     const { messages } = await req.json();

//     const { text } = await generateText({
//       model: deepseek('deepseek-chat', {
//         simulateStreaming: true,}),
//       system: 'You are a helpful assistant.',
//       messages,
      
//     });

//     return NextResponse.json({ text });
//   } catch (error) {
//     console.error('Chat API error:', error);
//     return NextResponse.json(
//       { error: 'Failed to process chat request' },
//       { status: 500 }
//     );
//   }
// }
