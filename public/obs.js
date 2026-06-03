const overlay = document.querySelector("#obsOverlay");
const obsId = Number(location.pathname.split("/").filter(Boolean).at(-1)) || 1;
let obsState = { scoreboards: [] };

function currentBoard() {
  return obsState.scoreboards.find((item) => item.id === obsId);
}

function renderObs() {
  const board = currentBoard();
  if (!board) return;

  document.title = `OBS - ${board.title}`;
  overlay.className = `obs-overlay theme-${board.theme}`;
  overlay.innerHTML = `
    <section class="obs-card">
      <div class="obs-title">${board.title}</div>
      <div class="obs-row">
        <span class="obs-team">${board.homeName}</span>
        <strong class="obs-score">${board.homeScore}</strong>
        <span class="obs-separator">-</span>
        <strong class="obs-score">${board.awayScore}</strong>
        <span class="obs-team">${board.awayName}</span>
      </div>
    </section>
  `;
}

async function initObs() {
  obsState = await fetch("/api/state").then((response) => response.json());
  renderObs();

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    obsState = JSON.parse(event.data);
    renderObs();
  };
}

initObs();
