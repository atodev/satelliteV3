// Earth's gravitational parameter (km³/s²) and radius (km)
const GM = 398600.4418;
const EARTH_RADIUS_KM = 6371;

async function fetchTLEs() {
  const resp = await fetch(CONFIG.CELESTRAK_URL);
  const text = await resp.text();

  // CelesTrak returns HTTP 403 + this message when data hasn't changed since the
  // last download from this IP (within the 2-hour update window). Not a real error.
  if (text.startsWith('GP data has not updated')) return null;

  if (!resp.ok) throw new Error(`CelesTrak fetch failed: ${resp.status}`);

  return parseTLEText(text);
}

function parseTLEText(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const satellites = [];
  let parseErrors = 0;
  let altSample = [];

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

      if (altSample.length < 5) altSample.push(altKm);
      satellites.push({ name, tle1, tle2, satrec, noradId, altKm, version });
    } catch (err) {
      parseErrors++;
      if (parseErrors <= 3) console.error('TLE parse error:', err, { name });
    }
  }

  console.log(`parseTLEText: ${lines.length} lines → ${satellites.length} satellites, ${parseErrors} errors`);
  console.log('altitude sample (first 5):', altSample);
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
  return CONFIG.VERSIONS[CONFIG.VERSIONS.length - 1]; // default to V1
}

function filterByOrbit(satellites, { min, max }) {
  return satellites.filter(s => s.altKm >= min && s.altKm <= max);
}

// Check if any V3-orbit satellites have appeared (called on each TLE refresh)
function checkForV3(satellites) {
  return satellites.filter(
    s => s.altKm >= CONFIG.V3_ORBIT_KM.min && s.altKm <= CONFIG.V3_ORBIT_KM.max
  );
}
