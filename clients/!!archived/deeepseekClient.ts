import { createDeepSeek } from '@ai-sdk/deepseek';
import dotenv from 'dotenv';

dotenv.config();


const DEEPSEEK_API_KEY = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY

export const deepseek = createDeepSeek({
    apiKey: DEEPSEEK_API_KEY, 
});

