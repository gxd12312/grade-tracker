import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/lib/auth';

export async function GET() {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        student: true,
        questions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(exams);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch exams' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = authMiddleware(request);
    if (authResult) return authResult;

    const body = await request.json();
    const name = body.name?.toString().trim();
    const subject = body.subject?.toString().trim();
    const studentId = body.studentId?.toString();
    const semester = body.semester?.toString().trim();

    if (!subject || !studentId) {
      return NextResponse.json({ error: 'Subject and student required' }, { status: 400 });
    }

    // Validate length limits
    if (subject.length > 50 || (name && name.length > 100)) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    const exam = await prisma.exam.create({
      data: {
        name: (name || subject).slice(0, 100),
        subject: subject.slice(0, 50),
        totalScore: Number(body.totalScore) || 0,
        maxScore: Number(body.maxScore) || 100,
        studentId,
        semester: semester?.slice(0, 30) || null,
      },
      include: { student: true, questions: true },
    });
    return NextResponse.json(exam);
  } catch (error) {
    console.error('Create exam error');
    return NextResponse.json({ error: 'Failed to create exam' }, { status: 500 });
  }
}
