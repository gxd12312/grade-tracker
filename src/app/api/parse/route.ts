import { NextRequest, NextResponse } from 'next/server';
import { parseExamImage } from '@/lib/parser';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = authMiddleware(request);
    if (authResult) return authResult;

    // Rate limiting (per IP)
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests, please wait' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const studentId = formData.get('studentId') as string | null;
    const name = formData.get('name') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file received' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images allowed.' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 });
    }

    if (!studentId) {
      return NextResponse.json({ error: 'Student required' }, { status: 400 });
    }

    // Sanitize name input
    const sanitizedName = name?.slice(0, 100) || null;

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
        name: sanitizedName || result.subject || 'Untitled Exam',
        studentId,
        subject: result.subject.slice(0, 50),
        totalScore: result.totalScore,
        maxScore: result.maxScore,
        analysis: result.analysis?.slice(0, 5000),
        rawResponse: rawResponse?.slice(0, 10000),
        questions: {
          create: result.questions.slice(0, 50).map((q) => ({
            number: q.number.slice(0, 20),
            content: q.content?.slice(0, 500),
            score: q.score,
            maxScore: q.maxScore,
            isCorrect: q.isCorrect,
            knowledgePoint: q.knowledgePoint?.slice(0, 200),
            suggestion: q.suggestion?.slice(0, 500),
          })),
        },
      },
      include: { questions: true, student: true },
    });

    return NextResponse.json(exam);
  } catch (error) {
    // Sanitized error - don't leak internal details
    console.error('Parse error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json({ error: 'Processing failed, please retry' }, { status: 500 });
  }
}
