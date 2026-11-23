(async () => {
  'use strict';

  const cameraConsole = document.querySelector('.admin-camera-console');
  let controls = document;
  if (cameraConsole) {
    const connectionPanel = document.createElement('div');
    connectionPanel.className = 'obs-connection-panel';
    const title = document.createElement('h3');
    title.textContent = 'Connexió d’OBS Studio';
    connectionPanel.append(title);
    cameraConsole.querySelector('.camera-console-title').after(connectionPanel);
    try {
      const response = await fetch('/obs-admin.html?v=obs-framing', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      controls = new DOMParser().parseFromString(await response.text(), 'text/html');
      const connection = controls.querySelector('#obs-connection');
      const status = controls.querySelector('#obs-status');
      if (!connection || !status || !controls.querySelector('#obs-table-template')) throw new Error();
      connectionPanel.append(document.importNode(connection, true), document.importNode(status, true));
    } catch {
      const error = document.createElement('p');
      error.setAttribute('role', 'status');
      error.textContent = 'No s’han pogut carregar els controls d’OBS. Recarrega la pàgina o torna a iniciar sessió.';
      connectionPanel.append(error);
      return;
    }
  }

  const form = document.querySelector('#obs-connection');
  const connect = form.querySelector('[type=submit]');
  const disconnect = document.querySelector('#obs-disconnect');
  const status = document.querySelector('#obs-status');
  const pending = new Map();
  const originalFraming = new Map();
  const adjusting = new Set();
  let socket;
  let connected = false;
  let nextRequest = 0;
  let program = '';
  let scheduledPreview;

  const tables = [1, 2].map(number => {
    const section = document.importNode(controls.querySelector('#obs-table-template').content.firstElementChild, true);
    const heading = section.querySelector('h2');
    if (cameraConsole) {
      const label = document.createElement('h4');
      label.textContent = 'OBS Studio';
      heading.replaceWith(label);
      section.className = 'obs-camera-controls';
      cameraConsole.querySelector(`.production-camera[data-table="${number}"]`).append(section);
    } else {
      heading.textContent = `TV Table ${number}`;
      document.querySelector('#obs-tables').append(section);
    }
    const image = section.querySelector('img');
    image.alt = `Previsualització OBS de la TV Table ${number}`;
    return {
      number, image,
      scene: section.querySelector('[data-scene]'),
      source: section.querySelector('[data-source]'),
      framing: Array.from(section.querySelectorAll('[data-adjust]')),
      monitor: section.querySelector('[data-monitor]'),
      project: section.querySelector('[data-project]'),
      program: section.querySelector('[data-program]'),
      status: section.querySelector('[data-table-status]')
    };
  });

  function sourceKey(scene, item) {
    return JSON.stringify([scene, item]);
  }

  function updateButtons() {
    connect.disabled = Boolean(socket);
    disconnect.disabled = !socket;
    for (const table of tables) {
      table.scene.disabled = !connected;
      table.source.disabled = !connected || !table.scene.value;
      const key = sourceKey(table.scene.value, table.source.value);
      for (const button of table.framing) {
        button.disabled = !connected || !table.source.value || adjusting.has(key)
          || (button.dataset.adjust === 'reset' && !originalFraming.has(key));
      }
      table.monitor.disabled = !connected;
      table.project.disabled = !connected || !table.scene.value || !table.monitor.value;
      table.program.disabled = !connected || !table.scene.value || table.scene.value === program;
      table.program.textContent = table.scene.value && table.scene.value === program
        ? 'Al programa d’OBS'
        : 'Envia al programa d’OBS';
    }
  }

  function request(requestType, requestData = {}) {
    if (!connected) return Promise.reject(new Error('OBS desconnectat.'));
    const requestId = String(++nextRequest);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('OBS no ha respost a temps.'));
      }, 4000);
      pending.set(requestId, { resolve, reject, timeout });
      try {
        socket.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
      } catch (error) {
        clearTimeout(timeout);
        pending.delete(requestId);
        reject(error);
      }
    });
  }

  function populate(select, entries, placeholder, preferred) {
    const previous = select.value || preferred;
    select.replaceChildren(new Option(placeholder, ''));
    for (const [label, value] of entries) select.add(new Option(label, String(value)));
    if (Array.from(select.options).some(option => option.value === previous)) select.value = previous;
  }

  async function refreshScenes(activeSocket) {
    const data = await request('GetSceneList');
    if (socket !== activeSocket) return;
    program = data.currentProgramSceneName;
    const entries = data.scenes.map(({ sceneName }) => [sceneName, sceneName]);
    await Promise.all(tables.map(table => {
      const previous = table.scene.value;
      populate(table.scene, entries, 'Tria una escena', `TV Table ${table.number}`);
      return refreshSources(table, previous === table.scene.value);
    }));
    updateButtons();
  }

  async function refreshSources(table, preserveSelection = false) {
    const sceneName = table.scene.value;
    const activeSocket = socket;
    const previous = preserveSelection ? table.source.value : '';
    populate(table.source, [], 'Tria la font de càmera');
    updateButtons();
    if (!sceneName) return;
    try {
      const { sceneItems } = await request('GetSceneItemList', { sceneName });
      if (socket !== activeSocket || table.scene.value !== sceneName) return;
      const inputs = sceneItems
        .filter(item => item.inputKind && !item.isGroup)
        .map(item => [item.sourceName, item.sceneItemId]);
      populate(table.source, inputs, 'Tria la font de càmera', previous);
      updateButtons();
    } catch (error) {
      if (socket === activeSocket && table.scene.value === sceneName) {
        table.status.textContent = error.message;
      }
    }
  }

  const pan = { left: [-16, 0], right: [16, 0], up: [0, -16], down: [0, 16] };

  function framingFields(transform) {
    const { positionX, positionY, scaleX, scaleY, boundsType, boundsWidth, boundsHeight } = transform;
    const size = boundsType === 'OBS_BOUNDS_NONE' ? { scaleX, scaleY } : { boundsWidth, boundsHeight };
    return { positionX, positionY, ...size };
  }

  async function adjustFraming(table, action) {
    const sceneName = table.scene.value;
    const item = table.source.value;
    const key = sourceKey(sceneName, item);
    if (!connected || !sceneName || !item || adjusting.has(key)) return;
    const target = { sceneName, sceneItemId: Number(item) };
    adjusting.add(key);
    updateButtons();
    try {
      const { sceneItemTransform } = await request('GetSceneItemTransform', target);
      const current = framingFields(sceneItemTransform);
      if (!originalFraming.has(key)) originalFraming.set(key, current);
      let changes;
      if (action === 'reset') {
        changes = originalFraming.get(key);
      } else if (pan[action]) {
        const [x, y] = pan[action];
        changes = { positionX: current.positionX + x, positionY: current.positionY + y };
      } else {
        const factor = action === 'in' ? 1.1 : 1 / 1.1;
        changes = Object.fromEntries(Object.entries(current)
          .filter(([name]) => name !== 'positionX' && name !== 'positionY')
          .map(([name, value]) => [name, value * factor]));
      }
      await request('SetSceneItemTransform', { ...target, sceneItemTransform: changes });
      table.status.textContent = action === 'reset' ? 'Enquadrament restablert a OBS.' : 'Enquadrament actualitzat a OBS.';
    } catch (error) {
      table.status.textContent = error.message;
    } finally {
      adjusting.delete(key);
      updateButtons();
    }
  }

  async function preview(activeSocket) {
    await Promise.all(tables.map(async table => {
      const sourceName = table.scene.value;
      if (!sourceName || document.hidden) return;
      try {
        const data = await request('GetSourceScreenshot', {
          sourceName, imageFormat: 'jpg', imageWidth: 480, imageCompressionQuality: 70
        });
        if (socket !== activeSocket || table.scene.value !== sourceName) return;
        table.image.src = data.imageData;
        table.image.hidden = false;
      } catch {
        if (socket === activeSocket && table.scene.value === sourceName) table.image.hidden = true;
      }
    }));
    if (socket === activeSocket) scheduledPreview = setTimeout(() => preview(activeSocket), 1200);
  }

  async function hash64(value) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return btoa(String.fromCharCode(...new Uint8Array(digest)));
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (socket) return;
    let password = form.elements.password.value;
    const activeSocket = new WebSocket(`ws://127.0.0.1:${form.elements.port.value}`);
    socket = activeSocket;
    updateButtons();
    status.textContent = 'Connectant amb OBS…';
    const handshake = setTimeout(() => activeSocket.close(), 6000);

    activeSocket.addEventListener('message', async event => {
      if (socket !== activeSocket) return;
      try {
        const { op, d } = JSON.parse(event.data);
        if (op === 0) {
          if (!d.authentication) {
            status.textContent = 'Activa l’autenticació del servidor WebSocket a OBS.';
            activeSocket.close();
            return;
          }
          const secret = await hash64(password + d.authentication.salt);
          password = '';
          const authentication = await hash64(secret + d.authentication.challenge);
          if (activeSocket.readyState !== WebSocket.OPEN) return;
          activeSocket.send(JSON.stringify({ op: 1, d: { rpcVersion: 1, authentication, eventSubscriptions: 132 } }));
        } else if (op === 2) {
          clearTimeout(handshake);
          form.elements.password.value = '';
          connected = true;
          status.textContent = 'OBS connectat';
          await Promise.all([
            refreshScenes(activeSocket),
            request('GetMonitorList').then(({ monitors }) => {
              for (const table of tables) {
                populate(table.monitor, monitors.map(monitor => [
                  `${monitor.monitorIndex + 1}. ${monitor.monitorName}`, monitor.monitorIndex
                ]), 'Tria una pantalla');
              }
            })
          ]);
          if (socket !== activeSocket) return;
          updateButtons();
          preview(activeSocket);
        } else if (op === 5 && d.eventType === 'CurrentProgramSceneChanged') {
          program = d.eventData.sceneName;
          updateButtons();
        } else if (op === 5 && ['SceneListChanged', 'SceneNameChanged'].includes(d.eventType)) {
          await refreshScenes(activeSocket);
        } else if (op === 7 && pending.has(d.requestId)) {
          const item = pending.get(d.requestId);
          pending.delete(d.requestId);
          clearTimeout(item.timeout);
          if (d.requestStatus.result) item.resolve(d.responseData);
          else item.reject(new Error(d.requestStatus.comment || 'OBS ha rebutjat l’ordre.'));
        }
      } catch (error) {
        if (socket === activeSocket) status.textContent = error.message;
      }
    });

    activeSocket.addEventListener('close', event => {
      clearTimeout(handshake);
      clearTimeout(scheduledPreview);
      password = '';
      for (const item of pending.values()) {
        clearTimeout(item.timeout);
        item.reject(new Error('OBS desconnectat.'));
      }
      pending.clear();
      status.textContent = event.code === 4009
        ? 'La contrasenya d’OBS és incorrecta.'
        : connected || event.code === 1000
          ? 'OBS desconnectat'
          : 'No s’ha pogut connectar. Comprova el port, que OBS estigui obert i que el navegador permeti accedir a la xarxa local.';
      socket = null;
      connected = false;
      program = '';
      originalFraming.clear();
      for (const table of tables) table.image.hidden = true;
      updateButtons();
    });
  });

  disconnect.addEventListener('click', () => socket?.close(1000));
  addEventListener('pagehide', () => socket?.close(1000));

  for (const table of tables) {
    table.scene.addEventListener('change', () => {
      table.image.hidden = true;
      table.status.textContent = '';
      refreshSources(table);
    });
    table.source.addEventListener('change', updateButtons);
    for (const button of table.framing) {
      button.addEventListener('click', () => adjustFraming(table, button.dataset.adjust));
    }
    table.monitor.addEventListener('change', updateButtons);
    async function send(button, type, data, success) {
      button.disabled = true;
      try {
        await request(type, data);
        table.status.textContent = success;
      } catch (error) {
        table.status.textContent = error.message;
      } finally {
        updateButtons();
      }
    }
    table.project.addEventListener('click', () => send(table.project, 'OpenSourceProjector', {
      sourceName: table.scene.value, monitorIndex: Number(table.monitor.value)
    }, 'OBS ha obert el projector.'));
    table.program.addEventListener('click', () => send(table.program, 'SetCurrentProgramScene', {
      sceneName: table.scene.value
    }, 'Escena enviada al programa d’OBS.'));
  }

  updateButtons();
})();
