import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:8080'

async function proxy(request: NextRequest, method: string, pathParts: string[]) {
  const path = pathParts.join('/')
  const body = method !== 'GET' ? await request.text() : undefined

  const res = await fetch(`${API_URL}/auth/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('cookie') || '',
    },
    body,
  })

  const text = await res.text()
  const response = new NextResponse(text, { status: res.status })

  // Forward Set-Cookie headers so the browser receives session cookies
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      response.headers.append('Set-Cookie', value)
    }
  })

  return response
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxy(request, 'GET', path)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxy(request, 'POST', path)
}
