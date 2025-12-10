import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  throw new Error('🧪 Test Sentry Error - Server Side');
  return NextResponse.json({ message: 'This should not be reached' });
}
