import { NextRequest } from 'next/server';

// Gateway берём из переменной окружения (server-side).
// Дефолт — локальный gateway из vpn_go (см. docker-compose.yml).
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8081/api/v1';

// Единственный универсальный обработчик: мы честно пробрасываем
// метод, путь, query, тело, и необходимые заголовки (в т.ч. Authorization).
async function forward(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await ctx.params;
  const pathStr = (path ?? []).map(encodeURIComponent).join('/');
  const qs = request.nextUrl.search; // включает ведущий "?", если есть
  const url = `${GATEWAY_URL}/${pathStr}${qs}`;

  // Пробрасываем только релевантные заголовки. `host`, `connection` и т.п.
  // Node fetch всё равно пересобирает сам.
  const outHeaders = new Headers();
  const forwardable = ['authorization', 'content-type', 'accept', 'accept-language'];
  for (const name of forwardable) {
    const v = request.headers.get(name);
    if (v) outHeaders.set(name, v);
  }

  const hasBody =
    request.method !== 'GET' && request.method !== 'HEAD' && request.body !== null;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: request.method,
      headers: outHeaders,
      body: hasBody ? await request.text() : undefined,
      // Gateway — это backend API, кэшировать нельзя.
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch (err) {
    console.error('[proxy] upstream error:', request.method, url, err);
    return Response.json(
      { error: 'proxy_upstream_error', details: String(err) },
      { status: 502 }
    );
  }

  // Отдаём тело как есть, сохраняя content-type и статус.
  const body = await resp.arrayBuffer();
  const respHeaders = new Headers();
  const passThrough = ['content-type', 'content-length', 'cache-control'];
  for (const name of passThrough) {
    const v = resp.headers.get(name);
    if (v) respHeaders.set(name, v);
  }
  return new Response(body, { status: resp.status, headers: respHeaders });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
