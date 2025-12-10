import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET(request: NextRequest) {
  try {
    Sentry.captureMessage('Sentry Example API called', 'info');

    return NextResponse.json({
      message: 'Test API endpoint for Sentry',
      timestamp: new Date().toISOString(),
      success: true
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
