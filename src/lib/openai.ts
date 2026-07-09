import OpenAI from 'openai';

let _openai: OpenAI | null = null;

export function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return _openai;
}

export function createOpenAI(apiKey: string, baseURL?: string) {
  return new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL || undefined,
  });
}

export const AI_MODEL = process.env.AI_MODEL || 'gpt-4o';
export const AI_NAME = process.env.AI_NAME || 'AI';
