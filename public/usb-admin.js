(function () {
  'use strict';
  if (!document.body.classList.contains('admin-body')) return;

  const media = navigator.mediaDevices;
  const tables = new Map();
  let busy = false;
  let scanVersion = 0;
  const cameraKey = id => 'cpool-usb-camera-' + id;
  const liveTrack = id => window.AdminCameraPreview?.stream(id)?.getVideoTracks()
    .find(track => track.readyState === 'live');

  function saved(key) {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  }

  function status(table, message, error = false) {
    table.status.textContent = message;
    table.status.setAttribute('role', error ? 'alert' : 'status');
  }

  function renderControls() {
    for (const [id, table] of tables) {
      const connected = Boolean(liveTrack(id));
      table.start.textContent = connected ? 'Desconnectar USB' : 'Connectar USB';
      table.start.disabled = !connected && (busy || !media?.getUserMedia);
      table.select.disabled = connected || busy || !media?.enumerateDevices;
      table.detect.disabled = busy || !media?.enumerateDevices;
    }
  }

  async function scan() {
    if (!media?.enumerateDevices) return [];
    const version = ++scanVersion;
    const devices = (await media.enumerateDevices()).filter(device => device.kind === 'videoinput');
    if (version !== scanVersion) return devices;
    for (const [id, table] of tables) {
      const assigned = liveTrack(id)?.getSettings().deviceId || table.selected;
      const options = [new Option('Tria una càmera', '')];
      devices.forEach((device, index) => {
        if (!device.deviceId) return;
        options.push(new Option(device.label || 'Càmera ' + (index + 1), device.deviceId));
      });
      if (assigned && !options.some(option => option.value === assigned)) {
        const label = saved('cpool-usb-label-' + id) || 'Càmera assignada';
        const unavailable = new Option(label + ' · no detectada', assigned);
        unavailable.disabled = true;
        options.push(unavailable);
      }
      table.select.replaceChildren(...options);
      table.select.value = assigned;
      const visible = devices.filter(device => device.deviceId).length;
      const message = visible === 1 ? '1 càmera detectada' : visible + ' càmeres detectades';
      table.detection.textContent = visible ? message : 'Prem «Detectar càmeres» per comprovar la connexió.';
    }
    return devices;
  }

  function errorMessage(error) {
    return {
      NotAllowedError: 'Permet l’accés a la càmera al navegador i torna-ho a provar.',
      NotFoundError: 'No s’ha trobat cap càmera. Comprova la connexió USB.',
      NotReadableError: 'La càmera no respon o està en ús en una altra aplicació.',
      OverconstrainedError: 'La càmera seleccionada ja no està disponible.'
    }[error.name] || error.message || 'No s’ha pogut accedir a la càmera.';
  }

  async function detect(table) {
    if (busy) return;
    busy = true;
    renderControls();
    status(table, 'Cercant càmeres…');
    let probe;
    try {
      const devices = await scan();
      if (!devices.some(device => device.deviceId && device.label)) {
        if (!media.getUserMedia) throw new Error('Aquest navegador no permet obrir la càmera.');
        probe = await media.getUserMedia({ audio: false, video: true });
        await scan();
      }
      status(table, 'Llista actualitzada. Tria la càmera d’aquesta taula.');
    } catch (error) {
      status(table, errorMessage(error), true);
    } finally {
      probe?.getTracks().forEach(track => track.stop());
      busy = false;
      renderControls();
    }
  }

  function disconnect(id, table, unplugged = false) {
    try { localStorage.removeItem('cpool-usb-active-' + id); } catch {}
    window.dispatchEvent(new CustomEvent('cpool-usb-disconnected', { detail: { table: id } }));
    renderControls();
    status(table, unplugged ? 'S’ha perdut la connexió amb la càmera. Torna-la a connectar.' : 'Càmera desconnectada.', unplugged);
  }

  async function connect(id, table) {
    if (liveTrack(id)) {
      disconnect(id, table);
      return;
    }
    if (busy) return;
    const selected = table.select.value;
    if (!selected || table.select.selectedOptions[0]?.disabled) {
      status(table, 'Prem «Detectar càmeres» i tria una càmera disponible.', true);
      return;
    }
    const other = id === 1 ? 2 : 1;
    if (liveTrack(other)?.getSettings().deviceId === selected) {
      status(table, 'Aquesta càmera ja està en ús a la TV Table ' + other + '.', true);
      return;
    }

    busy = true;
    renderControls();
    status(table, 'Connectant la càmera…');
    let stream;
    try {
      if (!window.AdminCameraPreview) throw new Error('La previsualització encara no està disponible. Recarrega la pàgina.');
      stream = await media.getUserMedia({
        audio: false,
        video: { deviceId: { exact: selected }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const track = stream.getVideoTracks()[0];
      const label = track.label || 'Càmera seleccionada';
      try {
        localStorage.setItem(cameraKey(id), selected);
        localStorage.setItem('cpool-usb-label-' + id, label);
        localStorage.setItem('cpool-usb-active-' + id, '1');
      } catch {}
      const attached = stream;
      track.addEventListener('ended', () => {
        if (window.AdminCameraPreview?.stream(id) === attached) disconnect(id, table, true);
        refresh();
      }, { once: true });
      window.AdminCameraPreview.attach(id, attached);
      stream = null;
      status(table, 'Connectada · ' + label);
      refresh();
    } catch (error) {
      status(table, errorMessage(error), true);
    } finally {
      stream?.getTracks().forEach(track => track.stop());
      busy = false;
      renderControls();
    }
  }

  function refresh() {
    scan().catch(() => {
      for (const table of tables.values()) table.detection.textContent = 'No s’ha pogut actualitzar la llista de càmeres.';
    });
  }

  for (const id of [1, 2]) {
    const card = document.querySelector('.production-camera[data-table="' + id + '"]');
    const anchor = card?.querySelector('.production-current');
    if (!anchor) continue;
    const panel = document.createElement('details');
    panel.className = 'tv-usb-panel';
    panel.open = true;
    panel.innerHTML = '<summary>Càmera USB · TV Table ' + id + '</summary>' +
      '<div class="tv-usb-controls"><label>Càmera de la taula ' + id +
      '<select><option value="">Tria una càmera</option></select></label>' +
      '<button type="button" class="tv-usb-detect">Detectar càmeres</button>' +
      '<button type="button" class="tv-usb-start">Connectar USB</button></div>' +
      '<p class="tv-usb-status" data-detection role="status"></p>' +
      '<p class="tv-usb-status" data-connection role="status" aria-live="polite"></p>';
    anchor.before(panel);
    const table = {
      select: panel.querySelector('select'),
      start: panel.querySelector('.tv-usb-start'),
      detect: panel.querySelector('.tv-usb-detect'),
      detection: panel.querySelector('[data-detection]'),
      status: panel.querySelector('[data-connection]'),
      selected: saved(cameraKey(id))
    };
    tables.set(id, table);
    table.select.addEventListener('change', () => { table.selected = table.select.value; });
    table.detect.addEventListener('click', () => detect(table));
    table.start.addEventListener('click', () => connect(id, table));
    if (!media?.enumerateDevices) status(table, 'Obre el panell en un navegador amb accés a les càmeres.', true);
  }

  window.addEventListener('cpool-preview-ready', renderControls);
  window.addEventListener('cpool-preview-stopped', () => queueMicrotask(renderControls));
  media?.addEventListener?.('devicechange', refresh);
  renderControls();
  refresh();
})();
