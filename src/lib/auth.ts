import { NextRequest, NextResponse } from 'next/server';

const SITE_PASSWORD = process.env.SITE_PASSWORD || '';

export function authMiddleware(request: NextRequest): NextResponse | null {
  // Skip auth if no password configured
  if (!SITE_PASSWORD) return null;

  // Check header first, then cookie
  const authHeader = request.headers.get('x-site-auth') || '';
  const authCookie = request.cookies.get('site_auth')?.value || '';

  if (authHeader === SITE_PASSWORD || authCookie === SITE_PASSWORD) {
    return null; // Auth OK, continue
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
