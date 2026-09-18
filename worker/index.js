/* Entry point for the ad-astra Worker.
 *
 * Static files in public/ are served straight from Cloudflare's asset storage
 * and never reach this code. The Worker only runs for paths with no matching
 * asset, which is how /api/apod gets here. */

import { handleApod } from './apod.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/apod') {
      return handleApod(request, env);
    }

    // No asset matched and it is not an API route.
    return env.ASSETS
      ? env.ASSETS.fetch(request)
      : new Response('Not Found', { status: 404 });
  },
};
