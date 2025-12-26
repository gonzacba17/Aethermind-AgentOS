import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/organizations/:id
 * 
 * Get organization details and API key info
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        rateLimitPerMin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            events: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get usage in last 24 hours
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);

    const recentUsage = await prisma.telemetryEvent.aggregate({
      where: {
        organizationId: id,
        timestamp: {
          gte: last24h,
        },
      },
      _count: {
        id: true,
      },
      _sum: {
        cost: true,
      },
    });

    return NextResponse.json({
      organization: {
        ...organization,
        apiKeyPrefix: 'aether_••••••••', // Masked for security
        usage24h: {
          requests: recentUsage._count.id || 0,
          cost: recentUsage._sum.cost?.toNumber() || 0,
        },
      },
    });
  } catch (error) {
    console.error('[API /organizations] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}
