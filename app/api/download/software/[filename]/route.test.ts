import { GET } from './route'
import { NextRequest } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { resolve } from 'path'
import { prisma } from '@/lib/prisma'
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('fs/promises')
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findUnique: vi.fn(),
    },
    download: {
      create: vi.fn(),
    },
  },
}))
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

describe('GET /api/download/software/[filename]', () => {
  const mockStat = stat as unknown as ReturnType<typeof vi.fn>
  const mockReadFile = readFile as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetAllMocks()
    // Set a predictable base path for testing
    process.env.UPLOADS_BASE_PATH = '/tmp/uploads'
  })

  it('should reject path traversal attempts with ..', async () => {
    const filename = '../../etc/passwd'
    const request = new NextRequest('http://localhost:3000/api/download/software/' + filename)

    const response = await GET(request, { params: { filename } })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.message).toBe('Invalid filename')
  })

  it('should reject sibling directory attacks', async () => {
    const filename = '/tmp/uploads/software-secret/secret.txt'
    const request = new NextRequest('http://localhost:3000/api/download/software' + filename)

    const response = await GET(request, { params: { filename } })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.message).toBe('Invalid filename')
  })

  it('should reject absolute paths', async () => {
    const filename = '/etc/passwd'
    const request = new NextRequest('http://localhost:3000/api/download/software' + filename)

    const response = await GET(request, { params: { filename } })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.message).toBe('Invalid filename')
  })

  it('should accept valid filenames', async () => {
    const filename = 'product_123_test.zip'
    const request = new NextRequest('http://localhost:3000/api/download/software/' + filename)

    // Mock FS
    mockStat.mockResolvedValue({} as any)
    mockReadFile.mockResolvedValue(Buffer.from('content'))

    // Mock Prisma
    const mockProduct = {
      id: '123',
      title: 'Test Product',
      status: 'PUBLISHED',
    }
    ;(prisma.product.findUnique as any).mockResolvedValue(mockProduct)

    const response = await GET(request, { params: { filename } })

    expect(response.status).toBe(200)

    // Check if readFile was called with the correct resolved path
    const expectedPath = resolve('/tmp/uploads/software', filename)
    expect(mockReadFile).toHaveBeenCalledWith(expectedPath)
  })

  it('should return 404 if file does not exist', async () => {
    const filename = 'product_123_missing.zip'
    const request = new NextRequest('http://localhost:3000/api/download/software/' + filename)

    // Mock FS to throw error
    mockStat.mockRejectedValue(new Error('ENOENT'))

    const response = await GET(request, { params: { filename } })

    expect(response.status).toBe(404)
  })
})
