const CONFIG = {
  // GP data sources tried in order, all OMM CSV (TLE format cannot carry the
  // 6-digit NORAD IDs assigned since July 2026, so newer satellites are absent from it).
  // /api/gp is our own Vercel proxy — CDN-cached for 2h, stale-served for 24h
  // during CelesTrak outages. Direct CelesTrak URLs are fallback for local dev.
  CELESTRAK_URLS: [
    '/api/gp',
    'https://celestrak.org/NORAD/elements/gp.php?NAME=STARLINK&FORMAT=CSV',
    'https://celestrak.org/NORAD/elements/gp.php?SPECIAL=starlink&FORMAT=CSV',
  ],

  REFRESH_INTERVAL_MS: 300_000,   // re-fetch GP data every 5 minutes
  PROPAGATE_INTERVAL_MS: 5_000,   // update positions every 5 seconds

  // 550 km shell filter for POC (DTC constellation altitude)
  ORBIT_FILTER_KM: { min: 530, max: 580 },

  // 330 km VLEO shell (non-V3 hardware flying low)
  VLEO_ORBIT_KM: { min: 300, max: 360 },

  // Launches that carried V3 hardware, by international designator. V3s are
  // identified by launch rather than altitude: they deploy near 270 km and
  // raise from there. Add each new V3 launch here.
  V3_LAUNCHES: [
    { id: '2026-225', label: 'Group 31-1 · Starship Flight 14', date: '28 Sep 2026' },
  ],

  // V3 is matched by launch (above); the rest by approximate NORAD ID
  // thresholds per hardware generation. IDs jump from 69,999 to 100,000.
  VERSIONS: [
    {
      label: 'V3',
      minId: -1,
      maxId: -1,
      color: '#FFD700',
      outlineColor: '#FF8C00',
      pixelSize: 10,
      pulse: true,
      spec: 'Starlink V3 · ~1 Tbps down / 160 Gbps up · Starship-launched',
    },
    {
      label: '330 km VLEO',
      minId: -1,
      maxId: -1,
      color: '#ff4500',
      pixelSize: 6,
      pulse: false,
      spec: '330 km VLEO shell · Pre-V3 hardware',
    },
    {
      label: 'V2',
      minId: 56_100,
      maxId: Infinity,
      color: '#00cfff',
      pixelSize: 5,
      pulse: false,
      spec: 'Starlink V2 · Direct-to-Cell capable · 550 km',
    },
    {
      label: 'V2 Mini',
      minId: 54_216,
      maxId: 56_099,
      color: '#7ecfff',
      pixelSize: 4,
      pulse: false,
      spec: 'Starlink V2 Mini · DTC capable · 550 km',
    },
    {
      label: 'V1',
      minId: 0,
      maxId: 54_215,
      color: '#aaaaaa',
      pixelSize: 4,
      pulse: false,
      spec: 'Starlink V1 · Legacy constellation · 550 km',
    },
  ],

  VERSION_IMAGES: {
    'V1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Starlink_Mission_%2847926144123%29.jpg/320px-Starlink_Mission_%2847926144123%29.jpg',
    'V2 Mini': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/SpaceX_Starlink_satellites_train.jpg/320px-SpaceX_Starlink_satellites_train.jpg',
    'V2': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/SpaceX_Starlink_satellites_train.jpg/320px-SpaceX_Starlink_satellites_train.jpg',
    'V3': '',
  },
};
