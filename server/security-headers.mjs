export const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://*.clarity.ms https://*.bing.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' https://challenges.cloudflare.com https://www.clarity.ms https://scripts.clarity.ms https://va.vercel-scripts.com",
  "connect-src 'self' https://auth.demokracija-20.si https://*.supabase.co https://router.huggingface.co https://challenges.cloudflare.com https://www.clarity.ms https://*.clarity.ms https://*.bing.com https://va.vercel-scripts.com https://*.vercel-insights.com https://vitals.vercel-insights.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:"
].join("; ");

export const securityHeaders = {
  "Content-Security-Policy": contentSecurityPolicy,
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin"
};

export function applySecurityHeaders(response, extraHeaders = {}) {
  for (const [name, value] of Object.entries({ ...securityHeaders, ...extraHeaders })) {
    response.setHeader(name, value);
  }
}

export function securityHeadersForVercel() {
  return Object.entries(securityHeaders).map(([key, value]) => ({ key, value }));
}

