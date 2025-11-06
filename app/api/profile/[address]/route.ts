import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

type ProfilesIndex = Record<string, any>

async function readProfiles(): Promise<ProfilesIndex> {
  const dataDir = path.join(process.cwd(), 'data')
  const filePath = path.join(dataDir, 'profiles.json')
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
  try {
    const buf = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(buf || '{}') as ProfilesIndex
  } catch {
    return {}
  }
}

async function writeProfiles(index: ProfilesIndex) {
  const dataDir = path.join(process.cwd(), 'data')
  const filePath = path.join(dataDir, 'profiles.json')
  await fs.writeFile(filePath, JSON.stringify(index, null, 2), 'utf-8')
}

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address?.toLowerCase()
    if (!address) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 })
    }
    const profiles = await readProfiles()
    const profile = profiles[address]
    return NextResponse.json({ success: true, profile: profile || null })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to load profile' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address?.toLowerCase()
    if (!address) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 })
    }
    const body = await request.json()
    const profiles = await readProfiles()
    profiles[address] = body
    await writeProfiles(profiles)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to save profile' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const address = params.address?.toLowerCase()
    if (!address) {
      return NextResponse.json({ success: false, error: 'Invalid address' }, { status: 400 })
    }
    const profiles = await readProfiles()
    delete profiles[address]
    await writeProfiles(profiles)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to delete profile' }, { status: 500 })
  }
}



