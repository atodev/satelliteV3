// Earth's gravitational parameter (km³/s²) and radius (km)
const GM = 398600.4418;
const EARTH_RADIUS_KM = 6371;
const CACHE_KEY = 'starlink_gp_cache';
const LEGACY_CACHE_KEY = 'starlink_tle_cache'; // pre-OMM cache, ~2 MB of TLE text

// CelesTrak returns 403 when data hasn't changed since the last download from
// this IP (2-hour dedup window). We try multiple URLs with separate dedup keys,
// and fall back to localStorage-cached GP data so the app always shows satellites.
//
// Data is OMM CSV rather than TLE: satellites catalogued since July 2026 have
// 6-digit NORAD IDs, which CelesTrak cannot serve in TLE format.
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
      if (!text.startsWith('OBJECT_NAME')) continue;

      const sats = parseGPText(text);
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

function saveCache(gpText) {
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      text: gpText,
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
    const sats = parseGPText(text);
    if (sats.length > 0) {
      console.info(`Using cached GP data (${ageHours.toFixed(1)}h old).`);
      return { sats, fromCache: true, ageHours };
    }
  } catch (_) {}
  return null;
}

// Parses CelesTrak OMM CSV: a header row of field names, one satellite per row.
function parseGPText(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const fields = lines[0].split(',');
  const satellites = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length !== fields.length) continue;

    const omm = {};
    fields.forEach((f, j) => { omm[f] = values[j]; });

    try {
      const satrec = satellite.json2satrec(omm);
      const noradId = parseInt(omm.NORAD_CAT_ID, 10);
      const meanMotion = parseFloat(omm.MEAN_MOTION);
      if (!Number.isFinite(noradId) || !Number.isFinite(meanMotion)) continue;

      const launchId = launchOf(omm.OBJECT_ID);
      const isV3 = CONFIG.V3_LAUNCHES.some(l => l.id === launchId);
      satellites.push({
        name: omm.OBJECT_NAME,
        satrec,
        noradId,
        launchId,
        isV3,
        altKm: meanAltitudeKm(meanMotion),
        inclination: parseFloat(omm.INCLINATION),
        version: isV3 ? getVersionByLabel('V3') : getVersion(noradId),
      });
    } catch (_) {}
  }

  return satellites;
}

// '2026-225AB' → '2026-225' (international designator minus the piece letters)
function launchOf(objectId) {
  const m = /^(\d{4}-\d{3})/.exec(objectId || '');
  return m ? m[1] : '';
}

function meanAltitudeKm(revPerDay) {
  const nRad = revPerDay * 2 * Math.PI / 86400;  // rad/s
  const a = Math.cbrt(GM / (nRad * nRad));       // semi-major axis km
  return a - EARTH_RADIUS_KM;
}

function getVersion(noradId) {
  for (const v of CONFIG.VERSIONS) {
    if (noradId >= v.minId && noradId <= v.maxId) return v;
  }
  return CONFIG.VERSIONS[CONFIG.VERSIONS.length - 1];
}

function getVersionByLabel(label) {
  return CONFIG.VERSIONS.find(v => v.label === label);
}

function filterByOrbit(satellites, { min, max }) {
  return satellites.filter(s => s.altKm >= min && s.altKm <= max);
}
