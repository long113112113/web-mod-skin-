import { GET } from '@/app/api/donations/stats/route'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    donation: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
        findUnique: vi.fn()
    }
  },
}))

// Mock auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(() => Promise.resolve({
    user: { role: 'ADMIN', id: 'admin-id' }
  })),
}))

// Mock auth options
vi.mock('@/lib/auth', () => ({
  authOptions: {}
}))

describe('Donation Stats API SQL Injection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should NOT pass raw SQL string for goalId condition', async () => {
    const request = new NextRequest('http://localhost:3000/api/donations/stats?goalId=123')

    // Mock successful responses for other queries to let it reach queryRaw
    ;(prisma.donation.aggregate as any).mockResolvedValue({ _sum: {}, _count: 0, _avg: {} })
    ;(prisma.donation.groupBy as any).mockResolvedValue([])
    ;(prisma.donation.findMany as any).mockResolvedValue([])

    await GET(request)

    const queryRawCalls = (prisma.$queryRaw as any).mock.calls
    // Find the call for monthly stats (checking if the first template string contains 'FROM donations')
    const monthlyStatsCall = queryRawCalls.find((call: any[]) =>
      call[0] && Array.isArray(call[0]) && call[0].some((s: string) => s.includes('FROM donations'))
    )

    expect(monthlyStatsCall).toBeDefined()

    const [strings, ...values] = monthlyStatsCall

    // Check values for SQL injection pattern
    // The vulnerable code passes "AND goalId = 123" as a string in the values array
    const hasRawSqlString = values.some((val: any) =>
      typeof val === 'string' && val.includes('AND goalId =')
    )

    if (hasRawSqlString) {
      console.error('VULNERABILITY DETECTED: Raw SQL string passed as parameter:', values)
    }

    expect(hasRawSqlString).toBe(false)
  })
})
