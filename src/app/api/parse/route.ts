import { NextRequest, NextResponse } from 'next/server';
import { parseExamImage } from '@/lib/parser';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const studentId = formData.get('studentId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '未收到图片文件' }, { status: 400 });
    }
    if (!studentId) {
      return NextResponse.json({ error: '请选择学生' }, { status: 400 });
    }

    // Read custom API settings from headers
    const apiKey = request.headers.get('x-api-key') || undefined;
    const baseURL = request.headers.get('x-base-url') || undefined;
    const model = request.headers.get('x-model') || undefined;

    // Convert to base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    // Parse with AI (using custom config if apiKey provided)
    const parseResult = await parseExamImage(base64, mimeType, apiKey ? { apiKey, baseURL, model } : undefined);
    const { rawResponse, ...result } = parseResult;

    // Save to database
    const exam = await prisma.exam.create({
      data: {
        studentId,
        subject: result.subject,
        totalScore: result.totalScore,
        maxScore: result.maxScore,
        analysis: result.analysis,
        rawResponse: rawResponse,
        questions: {
          create: result.questions.map((q) => ({
            number: q.number,
            content: q.content,
            score: q.score,
            maxScore: q.maxScore,
            isCorrect: q.isCorrect,
            knowledgePoint: q.knowledgePoint,
            suggestion: q.suggestion,
          })),
        },
      },
      include: { questions: true, student: true },
    });

    return NextResponse.json(exam);
  } catch (error) {
    console.error('Parse error:', error);
    const message = error instanceof Error ? error.message : '解析失败，请重试';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}