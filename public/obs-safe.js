const safeOverlay = document.querySelector("#obsSafeOverlay");
const safeBody = document.querySelector("#obsSafeBody");
const safeId = Number(location.pathname.split("/").filter(Boolean).at(-1)) || 1;
const debugMode = new URLSearchParams(location.search).has("debug");
let safeState = { scoreboards: [] };

if (debugMode) {
  safeBody.classList.add("debug");
}

function safeBoard() {
  return safeState.scoreboards.find((item) => item.id === safeId);
}

function renderSafeObs() {
  const board = safeBoard();
  if (!board) return;

  document.title = `OBS SAFE - ${board.title}`;
  safeOverlay.innerHTML = `
    <section class="obs-safe-card">
      <div class="obs-safe-label">OBS ${board.id}</div>
      <div class="obs-safe-teams">
        <span>${board.homeName}</span>
        <strong>${board.homeScore} - ${board.awayScore}</strong>
        <span>${board.awayName}</span>
      </div>
      <div class="obs-safe-meta">${board.title}</div>
    </section>
  `;
}

async function initSafeObs() {
  safeState = await fetch("/api/state").then((response) => response.json());
  renderSafeObs();

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    safeState = JSON.parse(event.data);
    renderSafeObs();
  };
}

initSafeObs();
