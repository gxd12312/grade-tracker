import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authMiddleware } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const authResult = authMiddleware(request);
    if (authResult) return authResult;

    const { id } = params;

    // Validate id format (cuid)
    if (!id || id.length > 50) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Delete exam (cascades to questions)
    await prisma.exam.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete exam error');
    return NextResponse.json({ error: 'Failed to delete exam' }, { status: 500 });
  }
}
