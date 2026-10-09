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
  return viewer;
}

async function loadSatellites() {
  updateStatus('Fetching orbital data… (may take up to 30s)');

  let result;
  try {
    result = await fetchTLEs();
  } catch (err) {
    updateStatus('Failed to fetch orbital data.');
    console.error(err);
    return;
  }

  // null = no live data and no cache
  if (result === null) {
    if (satelliteData.length === 0) {
      updateStatus('CelesTrak unreachable — retrying in 30s… <button onclick="loadSatellites()" style="margin-left:8px;padding:2px 10px;border-radius:10px;border:1px solid #aaa;background:rgba(255,255,255,0.1);color:#fff;cursor:pointer;font-size:12px">Retry now</button>');
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

  // V3s are always shown, wherever they are in their orbit raise
  const v3 = all.filter(s => s.isV3);
  const others = all.filter(s => !s.isV3);

  const filtered = filterByOrbit(others, CONFIG.ORBIT_FILTER_KM);

  // Always include 330 km shell satellites, restyled as VLEO but remembering
  // their hardware generation for the popup
  const vleoVersion = getVersionByLabel('330 km VLEO');
  const vleo = filterByOrbit(others, CONFIG.VLEO_ORBIT_KM)
    .map(s => ({ ...s, hardware: s.version, version: vleoVersion }));

  const toRender = [...filtered, ...vleo, ...v3];
  updateStatus(`${filtered.length} at 550 km · ${vleo.length} at 330 km · ${v3.length} V3${cacheLabel}.`);

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

  updateV3Panel(v3);
  if (v3.length > 0) startPulse();

  propagateAll();
  startAnimationLoop();
  scheduleRefresh();
}

function propagateAll() {
  const now = new Date();
  for (const sat of satelliteData) {
    const posVel = satellite.propagate(sat.satrec, now);
    if (!posVel || !posVel.position) continue;

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
  if (el) el.innerHTML = msg;
}

function setOrbitFilter(filter, btn) {
  // Toggle active state on buttons
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  for (const sat of satelliteData) {
    const is550 = sat.altKm >= CONFIG.ORBIT_FILTER_KM.min && sat.altKm <= CONFIG.ORBIT_FILTER_KM.max;
    const is330 = sat.altKm >= CONFIG.VLEO_ORBIT_KM.min && sat.altKm <= CONFIG.VLEO_ORBIT_KM.max;

    sat.point.show = filter === 'all'
      || (filter === '550' && is550)
      || (filter === '330' && is330)
      || (filter === 'v3' && sat.isV3);
  }
}

// ── V3 status panel ───────────────────────────────────────────────────────

function updateV3Panel(v3Sats) {
  const panel  = document.getElementById('countdown-panel');
  const digits = document.getElementById('countdown-digits');
  const label  = document.getElementById('countdown-label');
  if (!panel || !digits || !label) return;

  const launch = CONFIG.V3_LAUNCHES[CONFIG.V3_LAUNCHES.length - 1];
  panel.classList.add('launched');

  if (v3Sats.length === 0) {
    digits.textContent = 'Not in current feed';
    label.textContent = `Last launch ${launch.date} · ${launch.label}`;
    return;
  }

  const alts = v3Sats.map(s => s.altKm);
  const lo = Math.round(Math.min(...alts));
  const hi = Math.round(Math.max(...alts));
  digits.textContent = `${v3Sats.length} in orbit · ${lo === hi ? lo : `${lo}–${hi}`} km`;
  label.textContent = `Last launch ${launch.date} · ${launch.label}`;
}

// ── V3 pulse animation ─────────────────────────────────────────────────

function pulseV3() {
  const base = getVersionByLabel('V3');
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
  pulseTimer = setInterval(pulseV3, 50);
}
