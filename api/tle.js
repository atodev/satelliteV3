// Vercel serverless function — caching proxy for CelesTrak Starlink TLE data.
//
// Vercel's CDN caches a successful response for 2 hours (s-maxage=7200).
// During a CelesTrak outage, stale-while-revalidate=86400 keeps serving the
// last good copy for up to 24 hours while the CDN retries in the background.
// This means CelesTrak only needs to respond once per 2 hours globally, not
// once per visitor — and the app survives day-long CelesTrak outages.

const SOURCES = [
  'https://celestrak.org/NORAD/elements/gp.php?NAME=STARLINK&FORMAT=TLE',
  'https://celestrak.org/NORAD/elements/gp.php?SPECIAL=starlink&FORMAT=TLE',
];

export default async function handler(req, res) {
  for (const url of SOURCES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const upstream = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!upstream.ok) continue;

      const text = await upstream.text();

      // CelesTrak sends this body (with various HTTP codes) when data hasn't changed
      if (text.startsWith('GP data') || text.length < 1000) continue;

      res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=86400');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(text);
    } catch (_) {
      clearTimeout(timer);
      // timeout or network error — try next source
    }
  }

  // All sources failed — CDN will continue serving stale if available
  res.status(503).send('CelesTrak unavailable');
}
