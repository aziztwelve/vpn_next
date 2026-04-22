import { NextRequest, NextResponse } from 'next/server';

const GATEWAY_URL = 'http://localhost:8081/api/v1';

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  
  // Копируем все query параметры кроме 'path'
  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete('path');
  const queryString = params.toString();
  
  const url = `${GATEWAY_URL}${path}${queryString ? '?' + queryString : ''}`;
  
  console.log('Proxy GET:', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || '';
  const url = `${GATEWAY_URL}${path}`;
  
  console.log('Proxy POST:', url);

  try {
    const body = await request.json();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 500 });
  }
}
