import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/metrics
 * 
 * Returns telemetry metrics for an organization
 * 
 * Query params:
 * - organizationId: string (required)
 * - days: number (optional, default 30)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    const days = parseInt(searchParams.get('days') || '30');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get aggregated metrics
    const metrics = await prisma.telemetryEvent.groupBy({
      by: ['provider', 'model'],
      where: {
        organizationId,
        timestamp: {
          gte: startDate,
        },
      },
      _sum: {
        cost: true,
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        latency: true,
      },
    });

    // Daily cost trend
    const dailyCosts = await prisma.$queryRaw<Array<{
      date: Date;
      total_cost: number;
      event_count: number;
    }>>`
      SELECT 
        DATE(timestamp) as date,
        SUM(cost)::numeric as total_cost,
        COUNT(*)::int as event_count
      FROM telemetry_events
      WHERE organization_id = ${organizationId}
        AND timestamp >= ${startDate}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `;

    // Provider breakdown
    const providerStats = await prisma.telemetryEvent.groupBy({
      by: ['provider'],
      where: {
        organizationId,
        timestamp: {
          gte: startDate,
        },
      },
      _sum: {
        cost: true,
      },
      _count: {
        id: true,
      },
    });

    // Recent events
    const recentEvents = await prisma.telemetryEvent.findMany({
      where: {
        organizationId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 100,
      select: {
        id: true,
        timestamp: true,
        provider: true,
        model: true,
        totalTokens: true,
        cost: true,
        latency: true,
        status: true,
        error: true,
      },
    });

    // Summary stats
    const summary = await prisma.telemetryEvent.aggregate({
      where: {
        organizationId,
        timestamp: {
          gte: startDate,
        },
      },
      _sum: {
        cost: true,
        totalTokens: true,
      },
      _count: {
        id: true,
      },
      _avg: {
        latency: true,
      },
    });

    // Error rate
    const errors = await prisma.telemetryEvent.count({
      where: {
        organizationId,
        timestamp: {
          gte: startDate,
        },
        status: 'error',
      },
    });

    const errorRate = summary._count.id > 0 
      ? (errors / summary._count.id) * 100 
      : 0;

    return NextResponse.json({
      summary: {
        totalCost: summary._sum.cost?.toNumber() || 0,
        totalRequests: summary._count.id || 0,
        totalTokens: summary._sum.totalTokens || 0,
        avgLatency: Math.round(summary._avg.latency || 0),
        errorRate: errorRate.toFixed(2),
        errors,
      },
      metrics,
      dailyCosts,
      providerStats,
      recentEvents,
    });
  } catch (error) {
    console.error('[API /metrics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
