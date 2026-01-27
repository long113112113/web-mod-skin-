import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return new NextResponse('Access denied', { status: 400 });
    }

    const base = process.env.UPLOADS_BASE_PATH || path.join(process.cwd(), 'uploads')
    const softwareBase = path.join(base, 'software');
    const filePath = path.resolve(softwareBase, filename)

    // Verify resolved path is strictly within the intended directory
    if (!filePath.startsWith(path.resolve(softwareBase) + path.sep)) {
      return new NextResponse('Access denied', { status: 403 });
    }

    // Check if file exists
    try {
      const file = await readFile(filePath)

      // Determine content type based on file extension
      const ext = path.extname(filename).toLowerCase()
      const contentTypes: { [key: string]: string } = {
        '.exe': 'application/x-msdownload',
        '.msi': 'application/x-msi',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed',
        '.7z': 'application/x-7z-compressed',
        '.tar': 'application/x-tar',
        '.gz': 'application/gzip',
        '.deb': 'application/vnd.debian.binary-package',
        '.rpm': 'application/x-rpm',
        '.dmg': 'application/x-apple-diskimage',
        '.pkg': 'application/x-newton-compatible-pkg'
      }

      const contentType = contentTypes[ext] || 'application/octet-stream'

      return new Response(file as any, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'public, max-age=3600',
          'Content-Length': file.length.toString(),
        },
      })
    } catch (error) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

  } catch (error) {
    console.error('File serving error:', error)
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    )
  }
}
