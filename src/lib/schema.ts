import { z } from 'zod';

export const parseResponseSchema = z.object({
  subject: z.string(),
  totalScore: z.number(),
  maxScore: z.number(),
  questions: z.array(z.object({
    number: z.string(),
    content: z.string().optional(),
    score: z.number(),
    maxScore: z.number(),
    isCorrect: z.boolean(),
    knowledgePoint: z.string().optional(),
    suggestion: z.string().optional(),
  })),
  analysis: z.string().optional(),
  rawResponse: z.string().optional(),
});

export type ParseResponse = z.infer<typeof parseResponseSchema>;
