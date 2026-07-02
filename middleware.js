// Vercel Edge Middleware — framework-agnostic, runs before any file is served.
// Optional password gate for the whole site via HTTP Basic Auth.
//
// OFF BY DEFAULT: with no SITE_PASSWORD set, every request passes straight
// through, so the live site is unchanged until you decide to turn it on.
//
// To enable:
//   Vercel → Project → Settings → Environment Variables
//     SITE_PASSWORD = your-password        (required to turn the gate on)
//     SITE_USER     = jude                 (optional; defaults to "jude")
//   then redeploy. Clear SITE_PASSWORD to turn the gate off again.
//
// Note: this protects the deployed site at the edge (real protection).
// The username/password are only ever read on the server, never shipped to
// the browser.

export const config = {
  // Gate everything except Vercel internals and the favicon request.
  matcher: ['/((?!_vercel|favicon.ico).*)'],
};

export default function middleware(request) {
  const password = process.env.SITE_PASSWORD;

  // Gate disabled unless a password is configured.
  if (!password) return;

  const user = process.env.SITE_USER || 'jude';
  const header = request.headers.get('authorization') || '';

  if (header.startsWith('Basic ')) {
    let decoded = '';
    try {
      decoded = atob(header.slice(6));
    } catch {
      decoded = '';
    }
    const sep = decoded.indexOf(':');
    const u = decoded.slice(0, sep);
    const p = decoded.slice(sep + 1);
    if (u === user && p === password) {
      return; // credentials match → let the request continue
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ClientIQ case study", charset="UTF-8"',
    },
  });
}
