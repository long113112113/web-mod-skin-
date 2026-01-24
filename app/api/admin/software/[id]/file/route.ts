import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageSoftware } from '@/lib/auth-utils'

export const runtime = 'nodejs'
// Extend timeout for large file uploads
export const maxDuration = 300; // 5 minutes for Pro/Enterprise Vercel plans
export const dynamic = 'force-dynamic'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://modskinslol.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*', // Allow all headers
  'Access-Control-Allow-Credentials': 'true',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Set headers to bypass Cloudflare and optimize for large uploads
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'CF-Cache-Status': 'BYPASS',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
    ...corsHeaders, // Add CORS headers
  }

  console.log(`🔵 Starting file upload for product ${params.id}`)
  const startTime = Date.now()
  
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions)

    if (!session || !canManageSoftware(session.user.role)) {
      console.log('❌ Unauthorized upload attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      console.log('❌ No file provided in request')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(`📁 File details: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type}`)

    // Validate file type
    const allowedTypes = [
      'application/x-msdownload', // .exe
      'application/x-msi', // .msi
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'application/x-tar',
      'application/gzip',
      'application/vnd.debian.binary-package', // .deb
      'application/x-rpm', // .rpm
      'application/x-apple-diskimage', // .dmg
      'application/x-newton-compatible-pkg' // .pkg
    ]

    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(exe|msi|zip|rar|7z|tar\.gz|deb|rpm|dmg|pkg)$/i)) {
      console.log(`❌ Invalid file type: ${file.type}`)
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Validate file size (300MB max)
    const maxSize = 300 * 1024 * 1024
    console.log('Software upload size (bytes):', file.size)
    if (file.size > maxSize) {
      console.log(`❌ File too large: ${file.size} bytes (max: ${maxSize})`)
      return NextResponse.json({ error: 'File too large (max 300MB)', received: file.size }, { status: 413 })
    }

    // Generate safe filename with proper format: product_{productId}_{timestamp}.ext
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const filename = `product_${params.id}_${timestamp}.${extension}`
    
    // Ensure upload directory exists
    const base = process.env.UPLOADS_BASE_PATH || path.join(process.cwd(), 'uploads')
    const uploadDir = path.join(base, 'software')
    
    try {
      await import('fs').then(fs => fs.promises.mkdir(uploadDir, { recursive: true }))
      console.log(`📁 Upload directory ensured: ${uploadDir}`)
    } catch (error) {
      console.error('Failed to create upload directory:', error)
    }

    const filePath = path.join(uploadDir, filename)
    console.log(`💾 Starting file save to: ${filePath}`)

    // Save file with progress logging
    const bytes = await file.arrayBuffer()
    console.log(`🔄 File converted to buffer: ${(bytes.byteLength / 1024 / 1024).toFixed(2)}MB`)
    
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)
    
    const processingTime = Date.now() - startTime
    console.log(`✅ File saved successfully in ${processingTime}ms`)

    // Generate proper download URL that matches the download API
    const downloadUrl = `/api/download/software/${filename}`

    // Update product with file info
    await prisma.product.update({
      where: { id: params.id },
      data: {
        filename: filename,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        downloadUrl: downloadUrl
      }
    })

    console.log(`📊 Database updated for product ${params.id}`)

    return NextResponse.json({
      message: 'File uploaded successfully',
      filename: filename,
      size: file.size,
      downloadUrl: downloadUrl,
      processingTimeMs: processingTime
    }, { headers })

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error(`❌ File upload error after ${processingTime}ms:`, error)
    
    // More detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: processingTime
      },
      { status: 500, headers }
    )
  }
}
