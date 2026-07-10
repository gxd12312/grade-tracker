import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/lib/auth';

export async function GET() {
  try {
    const students = await prisma.student.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(students);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = authMiddleware(request);
    if (authResult) return authResult;

    const body = await request.json();
    const name = body.name?.toString().trim();
    const grade = body.grade?.toString().trim();
    const school = body.school?.toString().trim();

    if (!name) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    // Length limits
    if (name.length > 50) {
      return NextResponse.json({ error: 'Name too long (max 50 chars)' }, { status: 400 });
    }

    const student = await prisma.student.create({
      data: {
        name: name.slice(0, 50),
        grade: grade?.slice(0, 30) || null,
        school: school?.slice(0, 100) || null,
      },
    });
    return NextResponse.json(student);
  } catch (error) {
    console.error('Create student error');
    return NextResponse.json({ error: 'Failed to create student' }, { status: 500 });
  }
}
