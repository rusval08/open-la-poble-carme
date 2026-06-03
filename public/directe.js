const WIN_TARGET = 5;
const tabs = document.querySelectorAll(".live-tabs button");
const views = {
  tables: document.querySelector("#liveTables"),
  bracket: document.querySelector("#liveBracket"),
};
const tablesGrid = document.querySelector("#liveTablesGrid");
const bracketGrid = document.querySelector("#liveBracketGrid");
let liveState = { scoreboards: [], players: [], bracketManual: {} };
let previousLiveScores = new Map();
let hasRenderedLiveTables = false;
let lastLiveStateText = "";

const rounds = [
  { key: "r64", title: "Ultims 64", matches: 32 },
  { key: "r32", title: "Ultims 32", matches: 16 },
  { key: "r16", title: "Vuitens", matches: 8 },
  { key: "qf", title: "Quarts", matches: 4 },
  { key: "sf", title: "Semifinals", matches: 2 },
  { key: "final", title: "Final", matches: 1 },
];

function switchView(view) {
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
  Object.entries(views).forEach(([key, element]) => element.classList.toggle("active", key === view));
}

function winner(board) {
  if (board.homeScore >= WIN_TARGET && board.homeScore > board.awayScore) return board.homeName;
  if (board.awayScore >= WIN_TARGET && board.awayScore > board.homeScore) return board.awayName;
  return "";
}

function sideWinner(board, topName, bottomName) {
  if (board.homeScore >= WIN_TARGET && board.homeScore > board.awayScore) return topName;
  if (board.awayScore >= WIN_TARGET && board.awayScore > board.homeScore) return bottomName;
  return "";
}

function playerName(index) {
  const name = liveState.players[index]?.name;
  if (!name || name === "[object Object]") return `Jugador ${index + 1}`;
  return name;
}

function buildBracket() {
  return Object.fromEntries(
    rounds.map((round) => [
      round.key,
      Array.from({ length: round.matches }, (_, index) => {
        const manual = liveState.bracketManual?.[round.key]?.[index] || {};
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
        const board = liveState.scoreboards.find((item) => String(item.id) === String(match.table));
        if (board && !match.winner) {
          match.score = `${board.homeScore} - ${board.awayScore}`;
          match.winner = sideWinner(board, match.top, match.bottom);
        }
        return match;
      }),
    ]),
  );
}

function renderTables() {
  tablesGrid.innerHTML = liveState.scoreboards
    .map((board) => {
      const matchWinner = winner(board);
      const previous = previousLiveScores.get(board.id);
      const homeRaised = hasRenderedLiveTables && previous && board.homeScore > previous.homeScore;
      const awayRaised = hasRenderedLiveTables && previous && board.awayScore > previous.awayScore;
      return `
        <article class="result-card theme-${board.theme}">
          <div class="result-title">
            <span>${board.title}</span>
            <small>${matchWinner ? "Final" : `A ${WIN_TARGET}`}</small>
          </div>
          <div class="result-score">
            <div class="result-player ${homeRaised ? "player-flash" : ""}">
              <strong>${board.homeName}</strong>
              <span class="${homeRaised ? "score-flash" : ""}">${board.homeScore}</span>
            </div>
            <div class="result-divider">-</div>
            <div class="result-player right ${awayRaised ? "player-flash" : ""}">
              <strong>${board.awayName}</strong>
              <span class="${awayRaised ? "score-flash" : ""}">${board.awayScore}</span>
            </div>
          </div>
          <div class="result-winner">${matchWinner ? `Guanya: ${matchWinner}` : "En joc"}</div>
        </article>
      `;
    })
    .join("");

  previousLiveScores = new Map(
    liveState.scoreboards.map((board) => [
      board.id,
      { homeScore: board.homeScore, awayScore: board.awayScore },
    ]),
  );
  hasRenderedLiveTables = true;
}

function renderBracket() {
  const bracket = buildBracket();
  bracketGrid.innerHTML = rounds
    .map(
      (round, roundIndex) => `
        <section class="mobile-round round-${roundIndex + 1}">
          <h2>${round.title}</h2>
          ${bracket[round.key]
            .map(
              (match) => {
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
              },
            )
            .join("")}
        </section>
      `,
    )
    .join("");
}

function renderLive() {
  renderTables();
  renderBracket();
}

function applyLiveState(nextState) {
  const nextText = JSON.stringify(nextState);
  if (nextText === lastLiveStateText) return;
  lastLiveStateText = nextText;
  liveState = nextState;
  renderLive();
}

async function refreshLive() {
  const nextState = await fetch(`/api/state?t=${Date.now()}`, { cache: "no-store" }).then((response) => response.json());
  applyLiveState(nextState);
}

tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));

async function initLive() {
  await refreshLive();

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    applyLiveState(JSON.parse(event.data));
  };
  events.onerror = () => {
    refreshLive();
  };
  setInterval(refreshLive, 2000);
}

initLive();
