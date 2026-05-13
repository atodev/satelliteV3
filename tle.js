// Earth's gravitational parameter (km³/s²) and radius (km)
const GM = 398600.4418;
const EARTH_RADIUS_KM = 6371;

// CelesTrak returns 403 when the same IP fetches the same group within 2 hours.
// We try each URL in order; skip any that are rate-limited (403) or otherwise fail.
// Only throw if every URL fails with a non-403 error.
async function fetchTLEs() {
  let lastErr = null;

  for (const url of CONFIG.CELESTRAK_URLS) {
    try {
      const resp = await fetch(url);
      const status = Number(resp.status);

      if (status === 403) continue; // dedup rate-limit — try next URL
      if (!resp.ok) { lastErr = new Error(`CelesTrak fetch failed: ${status}`); continue; }

      const text = await resp.text();
      if (text.startsWith('GP data')) continue; // text form of the dedup message

      const sats = parseTLEText(text);
      if (sats.length > 0) return sats;
    } catch (err) {
      lastErr = err;
    }
  }

  // All URLs exhausted — return null so caller keeps existing data
  if (lastErr) console.warn('All CelesTrak URLs failed:', lastErr.message);
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
    } catch (_) {
      // skip malformed TLEs
    }
  }

  return satellites;
}

// Compute mean circular orbital altitude directly from the TLE line 2 string.
// Reads mean motion from the fixed-width field (cols 53-63, rev/day) to avoid
// any unit ambiguity with satrec.no after satellite.js SGP4 initialisation.
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
