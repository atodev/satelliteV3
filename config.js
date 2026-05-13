const CONFIG = {
  // CelesTrak returns 403 when the same IP fetched the same group within 2 hours.
  // Each query type (NAME vs SPECIAL) has a separate dedup key, so we try them in
  // order and use the first that returns valid TLE data.
  CELESTRAK_URLS: [
    'https://celestrak.org/NORAD/elements/gp.php?NAME=STARLINK&FORMAT=TLE',
    'https://celestrak.org/NORAD/elements/gp.php?SPECIAL=starlink&FORMAT=TLE',
  ],

  REFRESH_INTERVAL_MS: 300_000,   // re-fetch TLEs every 5 minutes
  PROPAGATE_INTERVAL_MS: 5_000,   // update positions every 5 seconds

  // 550 km shell filter for POC (DTC constellation altitude)
  ORBIT_FILTER_KM: { min: 530, max: 580 },

  // V3 watch: alert when satellites appear at ~330 km
  V3_ORBIT_KM: { min: 300, max: 360 },

  // V3 DTC launch target — SpaceX said Q4 2026, no specific date announced yet.
  // Update this when a launch date is confirmed.
  V3_LAUNCH_TARGET: new Date('2026-10-01T00:00:00Z'),
  V3_LAUNCH_DATE_LABEL: 'Q4 2026 · No specific date announced',

  // NORAD IDs above this threshold are considered true V3 hardware (post-2026 launches).
  // Adjust upward once we know the actual first V3 NORAD ID.
  V3_TRUE_MIN_NORAD_ID: 80_000,

  // Approximate NORAD ID thresholds by hardware generation
  VERSIONS: [
    {
      label: 'V3 DTC',
      minId: 80_000,
      maxId: Infinity,
      color: '#FFD700',
      outlineColor: '#FF8C00',
      pixelSize: 10,
      pulse: true,
      spec: '~150 Mbps · True V3 DTC hardware · 330 km orbit',
    },
    {
      label: 'V3 orbit',
      minId: 999_998,
      maxId: 999_999,
      color: '#ff4500',
      pixelSize: 6,
      pulse: false,
      spec: '330 km VLEO shell · Current-gen hardware',
    },
    {
      label: 'V2',
      minId: 56_100,
      maxId: 79_999,
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
