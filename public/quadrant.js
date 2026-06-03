const WIN_TARGET = 5;
const bracketCurrent = document.querySelector("#bracketCurrent");
const bracketNext = document.querySelector("#bracketNext");
let bracketState = { scoreboards: [], players: [], bracketManual: {} };
let lastBracketStateText = "";

const rounds = [
  { key: "r64", title: "Ultims 64", matches: 32 },
  { key: "r32", title: "Ultims 32", matches: 16 },
  { key: "r16", title: "Vuitens", matches: 8 },
  { key: "qf", title: "Quarts", matches: 4 },
  { key: "sf", title: "Semifinals", matches: 2 },
  { key: "final", title: "Final", matches: 1 },
];

function playerName(index) {
  const name = bracketState.players[index]?.name;
  if (!name || name === "[object Object]") return `Jugador ${index + 1}`;
  return name;
}

function tableWinner(board) {
  if (board.homeScore >= WIN_TARGET && board.homeScore > board.awayScore) return board.homeName;
  if (board.awayScore >= WIN_TARGET && board.awayScore > board.homeScore) return board.awayName;
  return "";
}

function sideWinner(board, topName, bottomName) {
  if (board.homeScore >= WIN_TARGET && board.homeScore > board.awayScore) return topName;
  if (board.awayScore >= WIN_TARGET && board.awayScore > board.homeScore) return bottomName;
  return "";
}

function buildBracket() {
  return Object.fromEntries(
    rounds.map((round) => [
      round.key,
      Array.from({ length: round.matches }, (_, index) => {
        const manual = bracketState.bracketManual?.[round.key]?.[index] || {};
        const match = {
          title:
            round.key === "r64"
              ? `Partit ${index + 1}`
              : round.key === "r32"
                ? `Partit ${index + 33}`
                : round.key === "r16"
                  ? `Partit ${index + 49}`
                  : round.key === "qf"
                    ? `Quart ${index + 1}`
                    : round.key === "sf"
                      ? `Semi ${index + 1}`
                      : "Final",
          top: manual.top || "",
          bottom: manual.bottom || "",
          table: manual.table || "",
          winner: manual.winner || "",
          score: manual.score || "",
          live: Boolean(manual.table && !manual.winner),
        };
        const board = bracketState.scoreboards.find((item) => String(item.id) === String(match.table));
        if (board && !match.winner) {
          match.score = `${board.homeScore} - ${board.awayScore}`;
          match.winner = sideWinner(board, match.top, match.bottom);
        }
        return match;
      }),
    ]),
  );
}

function matchHtml(match) {
  const topWon = match.winner && match.winner === match.top;
  const bottomWon = match.winner && match.winner === match.bottom;
  return `
    <article class="bracket-node ${match.live ? "live" : ""} ${match.winner ? "complete" : ""}">
      <div class="node-title">
        <span>${match.title}</span>
        ${match.table ? `<small>Taula ${match.table}</small>` : ""}
      </div>
      <div class="node-player ${topWon ? "winner" : bottomWon ? "loser" : ""}">
        <span>${match.top || "Pendent"}</span>
      </div>
      <div class="node-player ${bottomWon ? "winner" : topWon ? "loser" : ""}">
        <span>${match.bottom || "Pendent"}</span>
      </div>
      ${match.score ? `<div class="node-score">${match.score}</div>` : ""}
    </article>
  `;
}

function paperMatchHtml(match, side) {
  const topWon = match.winner && match.winner === match.top;
  const bottomWon = match.winner && match.winner === match.bottom;
  return `
    <article class="paper-match ${side} ${match.live ? "live" : ""} ${match.winner ? "complete" : ""}">
      <div class="paper-meta">
        <span>${match.title}</span>
        ${match.table ? `<small>Taula ${match.table}</small>` : ""}
      </div>
      <div class="paper-player ${topWon ? "winner" : bottomWon ? "loser" : ""}">
        <span>${match.top || ""}</span>
      </div>
      <div class="paper-player ${bottomWon ? "winner" : topWon ? "loser" : ""}">
        <span>${match.bottom || ""}</span>
      </div>
      ${match.score ? `<div class="paper-score">${match.score}</div>` : ""}
    </article>
  `;
}

function sideRoundHtml(bracket, side, roundKey, title, start, end) {
  const matches = bracket[roundKey].slice(start, end);
  return `
    <section class="paper-round ${side} paper-${roundKey}">
      <h2>${title}</h2>
      <div class="paper-round-matches">
        ${matches.map((match) => paperMatchHtml(match, side)).join("")}
      </div>
    </section>
  `;
}

function finalHtml(bracket) {
  const finalMatch = bracket.final[0];
  const champion = finalMatch.winner || "";
  return `
    <section class="paper-center">
      <div class="paper-brand">
        <span>Open la Pobla</span>
        <strong>POOL</strong>
      </div>
      <div class="paper-final">
        ${paperMatchHtml(finalMatch, "center")}
      </div>
      <div class="paper-arrow"></div>
      <div class="paper-champion">
        <span>Campio</span>
        <strong>${champion}</strong>
      </div>
    </section>
  `;
}

function renderBracket() {
  const bracket = buildBracket();
  bracketCurrent.classList.add("paper-board");
  bracketCurrent.innerHTML = `
    <section class="paper-bracket">
      <header class="paper-title">
        <h2>Open la Pobla</h2>
      </header>
      <div class="paper-grid">
        <div class="paper-side paper-side-left">
          ${sideRoundHtml(bracket, "left", "r64", "Ultims 64", 0, 16)}
          ${sideRoundHtml(bracket, "left", "r32", "Ultims 32", 0, 8)}
          ${sideRoundHtml(bracket, "left", "r16", "Vuitens", 0, 4)}
          ${sideRoundHtml(bracket, "left", "qf", "Quarts", 0, 2)}
          ${sideRoundHtml(bracket, "left", "sf", "Semifinal", 0, 1)}
        </div>
        ${finalHtml(bracket)}
        <div class="paper-side paper-side-right">
          ${sideRoundHtml(bracket, "right", "sf", "Semifinal", 1, 2)}
          ${sideRoundHtml(bracket, "right", "qf", "Quarts", 2, 4)}
          ${sideRoundHtml(bracket, "right", "r16", "Vuitens", 4, 8)}
          ${sideRoundHtml(bracket, "right", "r32", "Ultims 32", 8, 16)}
          ${sideRoundHtml(bracket, "right", "r64", "Ultims 64", 16, 32)}
        </div>
      </div>
    </section>
  `;

  const completedMatches = rounds.reduce(
    (total, round) => total + bracket[round.key].filter((match) => match.winner).length,
    0,
  );
  bracketNext.innerHTML = `
    <article class="bracket-summary-card">
      <span>Configuracio</span>
      <strong>64 jugadors</strong>
      <p>Les taules carreguen automaticament els seguents partits preparats.</p>
    </article>
    <article class="bracket-summary-card">
      <span>Regla</span>
      <strong>A ${WIN_TARGET} guanyades</strong>
      <p>Quan un jugador arriba a ${WIN_TARGET}, passa automaticament al seguent enfrontament.</p>
    </article>
    <article class="bracket-summary-card">
      <span>Partits finalitzats</span>
      <strong>${completedMatches}/63</strong>
      <p>Els guanyadors apareixen col.locats en ordre del campionat.</p>
    </article>
  `;
}

function applyBracketState(nextState) {
  const nextText = JSON.stringify(nextState);
  if (nextText === lastBracketStateText) return;
  lastBracketStateText = nextText;
  bracketState = nextState;
  renderBracket();
}

async function refreshBracket() {
  const nextState = await fetch(`/api/state?t=${Date.now()}`, { cache: "no-store" }).then((response) => response.json());
  applyBracketState(nextState);
}

async function initBracket() {
  await refreshBracket();

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    applyBracketState(JSON.parse(event.data));
  };
  events.onerror = () => {
    refreshBracket();
  };
  setInterval(refreshBracket, 2000);
}

initBracket();
