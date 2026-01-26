import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename

    // Security: Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { message: 'Invalid filename' },
        { status: 400 }
      )
    }

    // Check if file exists
    const base = process.env.UPLOADS_BASE_PATH || join(process.cwd(), 'uploads')
    const filePath = join(base, 'software', filename)
    
    try {
      await stat(filePath)
    } catch {
      return NextResponse.json(
        { message: 'File not found' },
        { status: 404 }
      )
    }

    // Extract product ID from filename (format: product_ID_timestamp.ext)
    const productIdMatch = filename.match(/^product_([^_]+)_/)
    if (!productIdMatch) {
      return NextResponse.json(
        { message: 'Invalid file format' },
        { status: 400 }
      )
    }

    const productId = productIdMatch[1]

    // Verify product exists and is published
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true }
    })

    if (!product) {
      return NextResponse.json(
        { message: 'Software not found' },
        { status: 404 }
      )
    }

    if (product.status !== 'PUBLISHED') {
      return NextResponse.json(
        { message: 'Software not available for download' },
        { status: 403 }
      )
    }

    // Log download for analytics
    try {
      // Get user session to track authenticated downloads
      const session = await getServerSession(authOptions)
      
      await prisma.download.create({
        data: {
          userId: session?.user?.id || null, // Track user if logged in, otherwise anonymous
          productId: productId,
          downloadIp: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }
      })
      
      console.log('Download logged for product:', productId, session?.user?.id ? 'by user' : 'anonymously')
    } catch (logError) {
      console.warn('Failed to log download:', logError)
      // Don't fail the download if logging fails
    }

    // Read and serve file
    const fileBuffer = await readFile(filePath)
    const originalFilename = filename.split('_').slice(2).join('_').split('.')[0] + '.' + filename.split('.').pop()
    
    // Set appropriate headers for file download
    const headers = new Headers()
    headers.set('Content-Type', 'application/octet-stream')
    headers.set('Content-Disposition', `attachment; filename="${product.title.replace(/[^a-zA-Z0-9.-]/g, '_')}_${originalFilename}"`)
    headers.set('Content-Length', fileBuffer.length.toString())

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { message: 'Failed to download file' },
      { status: 500 }
    )
  }
}
