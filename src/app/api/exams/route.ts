import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    return NextResponse.json({ error: '获取考试记录失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, grade } = body;

    if (!name) {
      return NextResponse.json({ error: '学生姓名不能为空' }, { status: 400 });
    }

    const student = await prisma.student.create({
      data: { name, grade },
    });
    return NextResponse.json(student);
  } catch (error) {
    return NextResponse.json({ error: '创建学生失败' }, { status: 500 });
  }
}