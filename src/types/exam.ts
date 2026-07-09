export interface ParsedQuestion {
  number: string;
  content?: string;
  score: number;
  maxScore: number;
  isCorrect: boolean;
  knowledgePoint?: string;
  suggestion?: string;
}

export interface ParsedExam {
  subject: string;
  totalScore: number;
  maxScore: number;
  questions: ParsedQuestion[];
  analysis?: string;
}
