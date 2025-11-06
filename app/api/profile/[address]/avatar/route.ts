import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import path from 'path'

export async function POST(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address?.toLowerCase()
    if (!address) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 })
    }
    const form = await request.formData()
    const file = form.get('avatar') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Invalid file type' }, { status: 400 })
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()

    const avatarsDir = path.join(process.cwd(), 'public', 'avatars')
    if (!existsSync(avatarsDir)) {
      await fs.mkdir(avatarsDir, { recursive: true })
    }
    const filename = `${address}-${hash}.${ext}`
    const filePath = path.join(avatarsDir, filename)
    try {
      await fs.writeFile(filePath, buffer)
    } catch {}

    const avatarUrl = `/avatars/${filename}`
    // Also persist into profiles.json if exists
    try {
      const profilesPath = path.join(process.cwd(), 'data', 'profiles.json')
      const raw = await fs.readFile(profilesPath, 'utf-8').catch(() => '{}')
      const index = JSON.parse(raw || '{}')
      const profile = index[address] || {}
      profile.avatarUrl = avatarUrl
      index[address] = profile
      await fs.writeFile(profilesPath, JSON.stringify(index, null, 2), 'utf-8')
    } catch {}

    return NextResponse.json({ success: true, avatarUrl })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to upload avatar' }, { status: 500 })
  }
}


