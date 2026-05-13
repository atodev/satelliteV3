// Earth's gravitational parameter (km³/s²) and radius (km)
const GM = 398600.4418;
const EARTH_RADIUS_KM = 6371;
const CACHE_KEY = 'starlink_tle_cache';

// CelesTrak returns 403 when data hasn't changed since the last download from
// this IP (2-hour dedup window). We try multiple URLs with separate dedup keys,
// and fall back to localStorage-cached TLE text so the app always shows satellites.
async function fetchTLEs() {
  // Try each URL in order, with a 12-second timeout per attempt
  for (const url of CONFIG.CELESTRAK_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      const status = Number(resp.status);

      if (status === 403) continue;
      if (!resp.ok) continue;

      const text = await resp.text();
      if (text.startsWith('GP data')) continue;

      const sats = parseTLEText(text);
      if (sats.length > 0) {
        saveCache(text);
        return sats;
      }
    } catch (_) {
      clearTimeout(timer);
      // timeout or network error — try next URL
    }
  }

  // All live URLs failed — load from cache
  return loadFromCache();
}

function saveCache(tleText) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      text: tleText,
      savedAt: Date.now(),
    }));
  } catch (_) {}
}

function loadFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { text, savedAt } = JSON.parse(raw);
    const ageHours = (Date.now() - savedAt) / 3_600_000;
    const sats = parseTLEText(text);
    if (sats.length > 0) {
      console.info(`Using cached TLE data (${ageHours.toFixed(1)}h old).`);
      return { sats, fromCache: true, ageHours };
    }
  } catch (_) {}
  return null;
}

function parseTLEText(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const satellites = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const tle1 = lines[i + 1];
    const tle2 = lines[i + 2];

    if (!tle1.startsWith('1 ') || !tle2.startsWith('2 ')) continue;

    try {
      const satrec = satellite.twoline2satrec(tle1, tle2);
      const noradId = parseInt(tle2.substring(2, 7).trim(), 10);
      const altKm = meanAltitudeKm(tle2);
      const version = getVersion(noradId);
      satellites.push({ name, tle1, tle2, satrec, noradId, altKm, version });
    } catch (_) {}
  }

  return satellites;
}

function meanAltitudeKm(tle2) {
  const n = parseFloat(tle2.substring(52, 63)); // rev/day
  const nRad = n * 2 * Math.PI / 86400;         // rad/s
  const a = Math.cbrt(GM / (nRad * nRad));       // semi-major axis km
  return a - EARTH_RADIUS_KM;
}

function getVersion(noradId) {
  for (const v of CONFIG.VERSIONS) {
    if (noradId >= v.minId && noradId <= v.maxId) return v;
  }
  return CONFIG.VERSIONS[CONFIG.VERSIONS.length - 1];
}

function filterByOrbit(satellites, { min, max }) {
  return satellites.filter(s => s.altKm >= min && s.altKm <= max);
}

function checkForV3(satellites) {
  return satellites.filter(
    s => s.altKm >= CONFIG.V3_ORBIT_KM.min && s.altKm <= CONFIG.V3_ORBIT_KM.max
  );
}
