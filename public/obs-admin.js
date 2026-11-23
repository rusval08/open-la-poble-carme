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
      const response = await fetch('/obs-admin.html');
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
      monitor: section.querySelector('[data-monitor]'),
      project: section.querySelector('[data-project]'),
      program: section.querySelector('[data-program]'),
      status: section.querySelector('[data-table-status]')
    };
  });

  function updateButtons() {
    connect.disabled = Boolean(socket);
    disconnect.disabled = !socket;
    for (const table of tables) {
      table.scene.disabled = !connected;
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
    for (const table of tables) populate(table.scene, entries, 'Tria una escena', `TV Table ${table.number}`);
    updateButtons();
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
      updateButtons();
    });
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
