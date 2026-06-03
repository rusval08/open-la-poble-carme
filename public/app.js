let state = { scoreboards: [] };
let selectedId = 1;

const tabs = document.querySelector("#boardTabs");
const panel = document.querySelector("#controlPanel");
const previewList = document.querySelector("#previewList");
const bracketRounds = [
  { key: "r64", title: "Ultims 64", offset: 1 },
  { key: "r32", title: "Ultims 32", offset: 33 },
  { key: "r16", title: "Vuitens", offset: 49 },
  { key: "qf", title: "Quarts", offset: 57 },
  { key: "sf", title: "Semifinals", offset: 61 },
  { key: "final", title: "Final", offset: 63 },
];

function postBoard(id, patch) {
  return fetch(`/api/scoreboards/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then((response) => response.json());
}

async function updateBoard(id, patch) {
  const updated = await postBoard(id, patch);
  state.scoreboards = state.scoreboards.map((board) => (board.id === id ? updated : board));
  render();
  return updated;
}

async function loadSelectedMatchToTable(board) {
  const select = panel.querySelector("[data-match-select]");
  if (!select?.value) return;
  const [round, index] = select.value.split(":");
  const response = await fetch("/api/bracket-load-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round, index: Number(index), table: board.id }),
  });
  const nextState = await response.json();
  if (nextState.scoreboards) state = nextState;
  render();
}

async function freeSelectedTable(board) {
  const response = await fetch("/api/bracket-unassign-table", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table: board.id }),
  });
  const nextState = await response.json();
  if (nextState.scoreboards) state = nextState;
  render();
}

function selectedBoard() {
  return state.scoreboards.find((board) => board.id === selectedId) || state.scoreboards[0];
}

function clampScore(value) {
  return Math.max(0, Number(value) || 0);
}

function matchLabel(round, index) {
  if (round.key === "qf") return `Quart ${index + 1}`;
  if (round.key === "sf") return `Semi ${index + 1}`;
  if (round.key === "final") return "Final";
  return `Partit ${round.offset + index}`;
}

function programmedMatches() {
  return bracketRounds.flatMap((round) =>
    (state.bracketManual?.[round.key] || [])
      .map((match, index) => ({ ...match, round: round.key, index, label: matchLabel(round, index) }))
      .filter((match) => match.top && match.bottom && !match.winner),
  );
}

function assignedMatchForBoard(boardId) {
  return programmedMatches().find((match) => String(match.table || "") === String(boardId));
}

function matchOptions(board) {
  const matches = programmedMatches();
  if (!matches.length) return `<option value="">No hi ha enfrontaments programats</option>`;
  return [
    `<option value="">Tria un enfrontament del quadrant</option>`,
    ...matches.map((match) => {
      const value = `${match.round}:${match.index}`;
      const selected = String(match.table || "") === String(board.id) ? "selected" : "";
      const tableText = match.table ? ` - ara a Taula ${match.table}` : " - sense taula";
      return `<option value="${value}" ${selected}>${match.label}: ${match.top} vs ${match.bottom}${tableText}</option>`;
    }),
  ].join("");
}

function disabledAttr(board) {
  return board.locked ? "disabled" : "";
}

function rectificationText(board) {
  const endsAt = Number(board.rectificationEndsAt || 0);
  if (!endsAt) return "El partit esta finalitzat.";
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return `Tens ${remaining} segons per rectificar. Despres la taula tornara a 0 fins posar els seguents contrincants.`;
}

function renderTabs() {
  tabs.innerHTML = state.scoreboards
    .map(
      (board) => `
        <button class="tab ${board.id === selectedId ? "active" : ""}" data-id="${board.id}" type="button">
          <span>${board.id}</span>
          <strong>${board.title}</strong>
        </button>
      `,
    )
    .join("");
}

function scoreControls(board, side, label) {
  const nameKey = `${side}Name`;
  const scoreKey = `${side}Score`;
  const disabled = disabledAttr(board);
  return `
    <div class="team-control ${board.locked ? "locked" : ""}">
      <label>
        <span>${label}</span>
        <input data-field="${nameKey}" value="${board[nameKey]}" ${disabled} />
      </label>
      <div class="score-row">
        <button data-score="${scoreKey}" data-delta="-1" type="button" ${disabled}>-</button>
        <input class="score-input" data-field="${scoreKey}" type="number" min="0" value="${board[scoreKey]}" ${disabled} />
        <button data-score="${scoreKey}" data-delta="1" type="button" ${disabled}>+</button>
      </div>
      <div class="quick-row">
        <button data-score="${scoreKey}" data-delta="2" type="button" ${disabled}>+2</button>
        <button data-score="${scoreKey}" data-delta="3" type="button" ${disabled}>+3</button>
      </div>
    </div>
  `;
}

function renderPanel() {
  const board = selectedBoard();
  if (!board) return;
  const disabled = disabledAttr(board);
  const assignedMatch = assignedMatchForBoard(board.id);

  panel.innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="eyebrow">Editant taula ${board.id}</p>
        <h2>${board.title}</h2>
      </div>
      <div class="panel-links">
        <a class="screen-link" href="/scoreboard/${board.id}" target="_blank" rel="noreferrer">Pantalla</a>
        <a class="screen-link" href="/obs/${board.id}" target="_blank" rel="noreferrer">OBS</a>
        ${board.id === 1 ? '<a class="screen-link primary-link" href="/tv-table" target="_blank" rel="noreferrer">TV table</a>' : ""}
      </div>
    </div>

    ${
      board.locked
        ? `<div class="lock-banner">
            <div>
              <strong>Partit finalitzat</strong>
              <span>${rectificationText(board)}</span>
            </div>
            <button class="rectify-button" data-preset="rectify" type="button">Rectificar resultat</button>
          </div>`
        : ""
    }

    <section class="match-loader">
      <div>
        <p class="eyebrow">Enfrontament programat</p>
        <h3>${assignedMatch ? `${assignedMatch.label}: ${assignedMatch.top} vs ${assignedMatch.bottom}` : "Taula lliure"}</h3>
        <span>${assignedMatch ? "Aquest partit s'actualitza en directe per al public quan puntuis." : "Tria qualsevol partit programat del quadrant, sense ordre obligatori."}</span>
      </div>
      <label>
        <span>Partit del quadrant</span>
        <select data-match-select ${disabled}>
          ${matchOptions(board)}
        </select>
      </label>
      <div class="actions compact-actions">
        <button data-preset="load-match" type="button" ${disabled}>Carregar enfrontament</button>
        <button data-preset="free-table" type="button" ${disabled}>Deixar taula lliure</button>
      </div>
    </section>

    <div class="form-grid">
      <label>
        <span>Titol</span>
        <input data-field="title" value="${board.title}" ${disabled} />
      </label>
      <label>
        <span>Color</span>
        <select data-field="theme" ${disabled}>
          ${["red", "blue", "green", "amber", "violet", "cyan"].map((value) => `<option value="${value}" ${board.theme === value ? "selected" : ""}>${value}</option>`).join("")}
        </select>
      </label>
    </div>

    <div class="teams-grid">
      ${scoreControls(board, "home", "Jugador local")}
      ${scoreControls(board, "away", "Jugador visitant")}
    </div>

    <div class="actions">
      <button data-preset="zero" type="button" ${disabled}>Posar a 0</button>
      <button data-preset="swap" type="button" ${disabled}>Intercanviar jugadors</button>
    </div>
  `;
}

function renderPreview() {
  previewList.innerHTML = state.scoreboards
    .map(
      (board) => `
        <button class="preview-card theme-${board.theme} ${board.id === selectedId ? "active" : ""}" data-id="${board.id}" type="button">
          <span>${board.title}${board.locked ? " - finalitzat" : ""}</span>
          <strong>${board.homeScore} - ${board.awayScore}</strong>
          <small>${board.homeName} / ${board.awayName}</small>
        </button>
      `,
    )
    .join("");
}

function render() {
  renderTabs();
  renderPanel();
  renderPreview();
}

tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  selectedId = Number(button.dataset.id);
  render();
});

previewList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  selectedId = Number(button.dataset.id);
  render();
});

panel.addEventListener("change", async (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  const board = selectedBoard();
  if (board?.locked) return;
  const value = event.target.type === "number" ? clampScore(event.target.value) : event.target.value;
  await updateBoard(selectedId, { [field]: value });
});

panel.addEventListener("click", async (event) => {
  const scoreButton = event.target.closest("[data-score]");
  const presetButton = event.target.closest("[data-preset]");
  const board = selectedBoard();
  if (!board) return;

  if (presetButton?.dataset.preset === "rectify") {
    await updateBoard(selectedId, { locked: false });
    return;
  }

  if (board.locked) return;

  if (presetButton?.dataset.preset === "load-match") {
    await loadSelectedMatchToTable(board);
    return;
  }

  if (presetButton?.dataset.preset === "free-table") {
    await freeSelectedTable(board);
    return;
  }

  if (scoreButton) {
    const field = scoreButton.dataset.score;
    const delta = Number(scoreButton.dataset.delta);
    await updateBoard(selectedId, { [field]: clampScore(board[field] + delta) });
    return;
  }

  if (presetButton?.dataset.preset === "zero") {
    await updateBoard(selectedId, { homeScore: 0, awayScore: 0 });
    return;
  }

  if (presetButton?.dataset.preset === "swap") {
    await updateBoard(selectedId, {
      homeName: board.awayName,
      awayName: board.homeName,
      homeScore: board.awayScore,
      awayScore: board.homeScore,
    });
  }
});

async function init() {
  state = await fetch("/api/state").then((response) => response.json());
  render();

  setInterval(() => {
    if (selectedBoard()?.rectificationEndsAt) render();
  }, 1000);

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    state = JSON.parse(event.data);
    render();
  };
}

init();
