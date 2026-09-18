/* NASA Astronomy Picture of the Day, proxied.
 *
 * The key lives in the NASA_API_KEY secret, so it never reaches the browser.
 * Without one it falls back to NASA's DEMO_KEY, which is rate limited to ~30
 * requests/hour per IP — fine for a prototype, not for traffic. Responses are
 * cached at the edge so one upstream call serves every visitor.
 */

const UPSTREAM = 'https://api.nasa.gov/planetary/apod';

function json(body, status, cacheSeconds) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds
        ? `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`
        : 'no-store',
    },
  });
}

export async function handleApod(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'GET, HEAD' },
    });
  }

  const key = (env && env.NASA_API_KEY) || 'DEMO_KEY';
  const url = `${UPSTREAM}?thumbs=true&api_key=${encodeURIComponent(key)}`;

  let upstream;
  try {
    upstream = await fetch(url, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 1800, cacheEverything: true },
    });
  } catch (err) {
    return json({ error: 'upstream_unreachable' }, 502);
  }

  if (!upstream.ok) {
    // 429 here almost always means the DEMO_KEY quota is gone.
    return json({ error: 'upstream_error', status: upstream.status }, 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch (err) {
    return json({ error: 'bad_upstream_payload' }, 502);
  }

  // APOD is sometimes a video; then NASA gives us a thumbnail instead.
  const image =
    data.media_type === 'image'
      ? data.url || data.hdurl
      : data.thumbnail_url || null;

  if (!image) return json({ error: 'no_image_today' }, 404, 300);

  return json(
    {
      image,
      title: data.title || '',
      date: data.date || '',
      credit: data.copyright ? String(data.copyright).trim() : '',
    },
    200,
    1800
  );
}
