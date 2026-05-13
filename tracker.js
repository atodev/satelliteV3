let viewer;
let pointCollection;
let satelliteData = []; // { ...tleMeta, point }

function initViewer() {
  viewer = new Cesium.Viewer('cesiumContainer', {
    // Built-in Natural Earth II texture — no Ion token required
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')
      )
    ),
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    baseLayerPicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    creditContainer: document.createElement('div'),
  });

  viewer.scene.backgroundColor = Cesium.Color.BLACK;
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 20, 25_000_000),
  });

  pointCollection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection());
  startCountdown();
  return viewer;
}

async function loadSatellites() {
  updateStatus('Fetching TLE data… (may take up to 30s)');

  let result;
  try {
    result = await fetchTLEs();
  } catch (err) {
    updateStatus('Failed to fetch TLE data.');
    console.error(err);
    return;
  }

  // null = no live data and no cache
  if (result === null) {
    if (satelliteData.length === 0) {
      updateStatus('No TLE data available — retrying in 30s…');
      setTimeout(loadSatellites, 30_000);
    } else {
      scheduleRefresh();
    }
    return;
  }

  // Unwrap cached vs live result
  const all = result.sats ?? result;
  const cacheLabel = result.fromCache
    ? ` (cached data, ${result.ageHours.toFixed(1)}h old)`
    : '';

  const filtered = filterByOrbit(all, CONFIG.ORBIT_FILTER_KM);

  // Always include V3-orbit satellites and override their version to V3 styling
  const v3Found = checkForV3(all);
  const v3Version = CONFIG.VERSIONS.find(v => v.label === 'V3 orbit');
  const v3Display = v3Found.map(s => ({ ...s, version: v3Version }));

  const toRender = [...filtered, ...v3Display];
  updateStatus(`${filtered.length} at 550 km · ${v3Display.length} at 330 km${cacheLabel}.`);

  // Rebuild point collection
  pointCollection.removeAll();
  satelliteData = [];

  for (const sat of toRender) {
    const point = pointCollection.add({
      position: Cesium.Cartesian3.fromDegrees(0, 0, sat.altKm * 1000),
      pixelSize: sat.version.pixelSize,
      color: Cesium.Color.fromCssColorString(sat.version.color),
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      id: satelliteData.length,
    });
    satelliteData.push({ ...sat, point });
  }

  const trueV3 = v3Found.filter(s => s.noradId >= CONFIG.V3_TRUE_MIN_NORAD_ID);
  if (trueV3.length > 0) {
    announceV3(trueV3);
    startPulse();
  }

  propagateAll();
  startAnimationLoop();
  scheduleRefresh();
}

function propagateAll() {
  const now = new Date();
  for (const sat of satelliteData) {
    const posVel = satellite.propagate(sat.satrec, now);
    if (!posVel.position) continue;

    const gmst = satellite.gstime(now);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);

    sat.point.position = Cesium.Cartesian3.fromRadians(
      geo.longitude,
      geo.latitude,
      geo.height * 1000  // satellite.js returns km, Cesium needs metres
    );

    // Cache current geodetic for popup use
    sat.currentGeo = geo;
  }
}

let animationTimer = null;
let refreshTimer = null;

function startAnimationLoop() {
  if (animationTimer) clearInterval(animationTimer);
  animationTimer = setInterval(propagateAll, CONFIG.PROPAGATE_INTERVAL_MS);
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    await loadSatellites();
  }, CONFIG.REFRESH_INTERVAL_MS);
}

function updateStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

function setOrbitFilter(filter, btn) {
  // Toggle active state on buttons
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  for (const sat of satelliteData) {
    const is550 = sat.altKm >= CONFIG.ORBIT_FILTER_KM.min && sat.altKm <= CONFIG.ORBIT_FILTER_KM.max;
    const is330 = sat.altKm >= CONFIG.V3_ORBIT_KM.min && sat.altKm <= CONFIG.V3_ORBIT_KM.max;

    sat.point.show = filter === 'all'
      || (filter === '550' && is550)
      || (filter === '330' && is330);
  }
}

function announceV3(v3Sats) {
  const banner = document.getElementById('v3-banner');
  if (!banner) return;
  banner.textContent = `330 km VLEO shell: ${v3Sats.length} satellites active. True V3 DTC hardware expected Q4 2026.`;
  banner.style.background = '#ff4500';
  banner.style.display = 'block';
}

// ── Countdown ─────────────────────────────────────────────────────────────

function startCountdown() {
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const panel  = document.getElementById('countdown-panel');
  const digits = document.getElementById('countdown-digits');
  const label  = document.getElementById('countdown-label');
  if (!panel || !digits) return;

  const now  = Date.now();
  const target = CONFIG.V3_LAUNCH_TARGET.getTime();
  const diff = target - now;

  if (diff <= 0) {
    // Launch window open — check if CelesTrak has real V3 yet
    panel.classList.add('launched');
    digits.textContent = 'Launch window open';
    label.textContent = 'Watching CelesTrak for V3 DTC satellites…';
    return;
  }

  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  const secs  = Math.floor((diff % 60_000) / 1_000);

  digits.textContent =
    `${days}d  ${String(hours).padStart(2,'0')}h  ${String(mins).padStart(2,'0')}m  ${String(secs).padStart(2,'0')}s`;
  label.textContent = CONFIG.V3_LAUNCH_DATE_LABEL;
}

// ── V3 DTC pulse animation ─────────────────────────────────────────────────

function pulseTrueV3() {
  const base = CONFIG.VERSIONS.find(v => v.label === 'V3 DTC');
  if (!base) return;
  const amplitude = 4;
  const period = 1500; // ms for one full pulse
  const scale = 1 + (amplitude / base.pixelSize) * Math.sin(Date.now() * Math.PI * 2 / period);

  for (const sat of satelliteData) {
    if (sat.version.pulse) {
      sat.point.pixelSize = base.pixelSize * scale;
    }
  }
}

let pulseTimer = null;

function startPulse() {
  if (pulseTimer) return;
  pulseTimer = setInterval(pulseTrueV3, 50);
}
