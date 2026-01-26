import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

// GET /api/donations/stats - Get donation statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const goalId = searchParams.get('goalId')
    const isPublic = searchParams.get('public') === 'true'

    // For public access, only return basic stats
    if (isPublic) {
      const activeGoals = await prisma.donationGoal.findMany({
        where: {
          isActive: true,
          isVisible: true,
        },
        include: {
          donations: {
            where: {
              status: 'COMPLETED'
            },
            select: {
              amount: true,
              donorName: true,
              message: true,
              isAnonymous: true,
              isMessagePublic: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 10, // Recent 10 donations
          },
          _count: {
            select: {
              donations: {
                where: {
                  status: 'COMPLETED'
                }
              }
            }
          }
        },
        orderBy: {
          priority: 'desc'
        }
      })

      // Calculate total statistics
      const totalStats = await prisma.donation.aggregate({
        where: {
          status: 'COMPLETED'
        },
        _sum: {
          amount: true
        },
        _count: true
      })

      return NextResponse.json({
        goals: activeGoals.map(goal => ({
          id: goal.id,
          title: goal.title,
          description: goal.description,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          currency: goal.currency,
          showProgress: goal.showProgress,
          showAmount: goal.showAmount,
          showDonors: goal.showDonors,
          startDate: goal.startDate,
          endDate: goal.endDate,
          donorCount: goal._count.donations,
          recentDonations: goal.donations.map(donation => ({
            amount: donation.amount,
            donorName: donation.isAnonymous ? 'Anonymous' : donation.donorName,
            message: donation.isMessagePublic ? donation.message : null,
            createdAt: donation.createdAt,
          }))
        })),
        totalRaised: totalStats._sum.amount || 0,
        totalDonations: totalStats._count
      })
    }

    // Admin access - detailed statistics
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const where = goalId ? { goalId } : {}

    const [
      totalStats,
      statusStats,
      recentDonations,
      topDonors,
      monthlyStats
    ] = await Promise.all([
      // Total statistics
      prisma.donation.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
        _avg: { amount: true }
      }),

      // Status breakdown
      prisma.donation.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        _count: true
      }),

      // Recent donations
      prisma.donation.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true }
          },
          goal: {
            select: { title: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      // Top donors (non-anonymous)
      prisma.donation.groupBy({
        by: ['userId'],
        where: {
          ...where,
          isAnonymous: false,
          userId: { not: null },
          status: 'COMPLETED'
        },
        _sum: { amount: true },
        _count: true,
        orderBy: {
          _sum: {
            amount: 'desc'
          }
        },
        take: 10
      }),

      // Monthly statistics for last 12 months
      prisma.$queryRaw`
        SELECT 
          DATE_FORMAT(createdAt, '%Y-%m') as month,
          COUNT(*) as count,
          SUM(amount) as total
        FROM donations 
        WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
          AND status = 'COMPLETED'
          ${goalId ? Prisma.sql`AND goalId = ${goalId}` : Prisma.empty}
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY month DESC
      `
    ])

    // Get user details for top donors
    const topDonorsWithDetails = await Promise.all(
      topDonors.map(async (donor) => {
        const user = await prisma.user.findUnique({
          where: { id: donor.userId! },
          select: { name: true, email: true }
        })
        return {
          ...donor,
          user
        }
      })
    )

    return NextResponse.json({
      total: {
        amount: totalStats._sum.amount || 0,
        count: totalStats._count,
        average: totalStats._avg.amount || 0
      },
      byStatus: statusStats,
      recentDonations,
      topDonors: topDonorsWithDetails,
      monthlyTrend: monthlyStats
    })

  } catch (error) {
    console.error('Error fetching donation stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}