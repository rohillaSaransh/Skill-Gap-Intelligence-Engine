// Netlify serverless function that acts as a secure API gateway.
// - Frontend should call paths like:
//     /.netlify/functions/api/skills/analyze
//     /.netlify/functions/api/skills/top-tools
//     /.netlify/functions/api/skills/top-certifications
//     /.netlify/functions/api/skills/suggestions
//
// - All third-party API keys must be provided via environment variables.
//   For example:
//     process.env.API_KEY          -> generic external API key (if used)
//     process.env.OPENAI_API_KEY   -> OpenAI key (used by backend services)
//
// - This function currently proxies requests to the existing backend API
//   (running separately), so that the browser never talks directly to
//   third‑party services or to any URL containing secrets.

const BACKEND_BASE =
  process.env.INTERNAL_API_BASE || process.env.BACKEND_BASE_URL || 'http://localhost:3000';

// Read, but never log, any generic API key you may choose to configure
// for direct third‑party calls inside this function.
// (Not currently used, but wired for future external integrations.)
const GENERIC_API_KEY = process.env.API_KEY || '';

/**
 * Normalize the path received from Netlify so we can forward only the
 * `/api/...` portion to the backend.
 */
function getBackendPath(netlifyPath) {
  // Example incoming paths:
  //   /.netlify/functions/api
  //   /.netlify/functions/api/skills/analyze
  //   /.netlify/functions/api/skills/top-tools
  const prefix = '/.netlify/functions/api';
  if (!netlifyPath.startsWith(prefix)) return netlifyPath;
  const remainder = netlifyPath.slice(prefix.length) || '';

  // If caller hits just `/.netlify/functions/api`, treat it as `/api/health`
  if (remainder === '' || remainder === '/') {
    return '/health';
  }

  // Ensure leading slash so we forward like `/api/...`
  return remainder.startsWith('/') ? remainder : `/${remainder}`;
}

exports.handler = async function handler(event) {
  try {
    const backendPath = getBackendPath(event.path || '/');

    // Build full backend URL, preserving query string.
    const url = new URL(BACKEND_BASE.replace(/\/$/, '') + backendPath);
    if (event.rawQuery) {
      url.search = event.rawQuery;
    } else if (event.rawQueryString) {
      url.search = event.rawQueryString.startsWith('?')
        ? event.rawQueryString
        : `?${event.rawQueryString}`;
    }

    const method = event.httpMethod || 'GET';

    // Start from incoming headers but strip hop‑by‑hop headers and
    // anything that should not be forwarded.
    const headers = new Headers();
    for (const [key, value] of Object.entries(event.headers || {})) {
      if (!value) continue;
      const lower = key.toLowerCase();
      if (['host', 'content-length', 'connection'].includes(lower)) continue;
      headers.set(key, value);
    }

    // IMPORTANT: never forward cookies or authorization headers from
    // the browser to third‑party APIs. Here we only talk to our own
    // backend base URL. If you later add direct third‑party calls,
    // use GENERIC_API_KEY or other server‑side env vars instead.
    //
    // Example for future external calls (not currently used):
    //   headers.set('Authorization', `Bearer ${GENERIC_API_KEY}`);

    const init = {
      method,
      headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      if (event.body) {
        const bodyBuffer = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64')
          : Buffer.from(event.body);
        init.body = bodyBuffer;
      }
    }

    const response = await fetch(url.toString(), init);
    const responseBody = await response.text();

    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      // Do not expose any server internals via headers.
      if (key.toLowerCase() === 'set-cookie') continue;
      responseHeaders[key] = value;
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
    };
  } catch (err) {
    // Never log secrets. Only log sanitized error messages.
    console.error('Netlify API function error:', err && err.message ? err.message : String(err));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal API gateway error' }),
    };
  }
};

