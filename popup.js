const POPUP_OFFSET = { x: 16, y: 16 };
const POPUP_WIDTH = 270;
const POPUP_HEIGHT = 320; // approximate, used for edge clamping

function initPopup() {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.endPosition);

    if (Cesium.defined(picked) && Cesium.defined(picked.id) && satelliteData[picked.id]) {
      const sat = satelliteData[picked.id];
      showPopup(sat, movement.endPosition);
    } else {
      hidePopup();
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

function showPopup(sat, screenPos) {
  const popup = document.getElementById('popup');
  const version = sat.version;
  const altKm = sat.currentGeo
    ? Math.round(sat.currentGeo.height)
    : Math.round(sat.altKm);

  const imgUrl = CONFIG.VERSION_IMAGES[version.label] || '';
  const imgHtml = imgUrl
    ? `<img src="${imgUrl}" alt="${version.label}" onerror="this.style.display='none'">`
    : `<div class="no-image">No image available yet</div>`;

  popup.innerHTML = `
    <div class="popup-name">${sat.name}</div>
    <span class="popup-badge" style="background:${version.color}">${version.label}</span>
    <div class="popup-alt">Altitude: ${altKm} km</div>
    <div class="popup-spec">${version.spec}</div>
    ${imgHtml}
  `;

  // Position near cursor, clamped to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = screenPos.x + POPUP_OFFSET.x;
  let top = screenPos.y + POPUP_OFFSET.y;

  if (left + POPUP_WIDTH > vw) left = screenPos.x - POPUP_WIDTH - POPUP_OFFSET.x;
  if (top + POPUP_HEIGHT > vh) top = screenPos.y - POPUP_HEIGHT - POPUP_OFFSET.y;

  popup.style.left = `${Math.max(0, left)}px`;
  popup.style.top = `${Math.max(0, top)}px`;
  popup.style.display = 'block';
}

function hidePopup() {
  const popup = document.getElementById('popup');
  if (popup) popup.style.display = 'none';
}
