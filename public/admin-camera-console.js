(() => {
  'use strict';
  const consolePanel = document.querySelector('.admin-camera-console');
  if (!consolePanel) return;

  const cards = new Map();
  let publicOpen = false;

  function updateStatus() {
    for (const [table, card] of cards) {
      const preview = window.AdminCameraPreview?.stream(table);
      const hasVideo = preview?.getVideoTracks().some(track => track.readyState === 'live');
      const onAir = Boolean(publicOpen && card.connected);
      const label = onAir ? 'En directe' : hasVideo ? 'Prèvia' : 'Sense senyal';
      if (card.badge.textContent !== label) card.badge.textContent = label;
      card.badge.dataset.live = String(onAir);
    }
  }

  for (const section of consolePanel.querySelectorAll('.production-camera')) {
    const usb = section.querySelector('.tv-usb-panel');
    const picture = section.querySelector('.usb-picture');
    const fields = picture?.querySelector('.usb-picture-fields');
    const zoom = fields?.querySelector('.usb-zoom');
    const movement = fields?.querySelector('[data-center]')?.parentElement;
    const header = section.querySelector('.production-camera-header');
    if (!usb || !fields || !zoom || !movement || !header) continue;

    const badge = document.createElement('span');
    badge.className = 'camera-feed-state';
    header.append(badge);
    cards.set(Number(section.dataset.table), { badge, connected: false });

    const strip = document.createElement('div');
    strip.className = 'camera-control-strip';
    usb.querySelector('label').firstChild.textContent = 'Càmera USB';
    movement.classList.add('camera-joystick');
    for (const [selector, glyph, label] of [
      ['[data-pan="panX"][data-step="-20"]', '←', 'Esquerra'],
      ['[data-pan="panX"][data-step="20"]', '→', 'Dreta'],
      ['[data-pan="panY"][data-step="-20"]', '↑', 'Amunt'],
      ['[data-pan="panY"][data-step="20"]', '↓', 'Avall'],
      ['[data-center]', '•', 'Centra l’enquadrament']
    ]) {
      const button = movement.querySelector(selector);
      button.textContent = glyph;
      button.setAttribute('aria-label', label);
    }

    const zoomLabel = document.createElement('span');
    zoomLabel.textContent = 'Zoom';
    const value = zoom.querySelector('output');
    const slider = zoom.querySelector('input');
    const fineZoom = document.createElement('label');
    fineZoom.append('Ajust fi del zoom', slider);
    fields.prepend(fineZoom);
    const zoomButtons = zoom.querySelector('div');
    const [minus, plus] = zoomButtons.querySelectorAll('button');
    zoomButtons.replaceChildren(minus, value, plus);
    zoom.replaceChildren(zoomLabel, zoomButtons);

    strip.append(usb, zoom, movement);
    picture.before(strip);
  }

  window.addEventListener('cpool-admin-public-gate', event => {
    publicOpen = event.detail?.open === true;
    updateStatus();
  });
  window.addEventListener('cpool-publisher-state', event => {
    const card = cards.get(Number(event.detail.table));
    if (card) card.connected = event.detail.connected;
    updateStatus();
  });
  window.addEventListener('cpool-preview-ready', updateStatus);
  window.addEventListener('cpool-preview-stopped', () => queueMicrotask(updateStatus));

  const pane = document.querySelector('#admin-tv');
  if (pane) pane.prepend(consolePanel);
  else {
    const observer = new MutationObserver(() => {
      const target = document.querySelector('#admin-tv');
      if (!target) return;
      observer.disconnect();
      target.prepend(consolePanel);
    });
    observer.observe(document.querySelector('.admin-layout'), { childList: true });
  }
  updateStatus();
})();
