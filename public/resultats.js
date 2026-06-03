const resultsGrid = document.querySelector("#resultsGrid");
const WIN_TARGET = 5;
let resultsState = { scoreboards: [] };
let previousScores = new Map();
let hasRenderedResults = false;
let lastStateText = "";

function resultWinner(board) {
  if (board.homeScore >= WIN_TARGET && board.homeScore > board.awayScore) return board.homeName;
  if (board.awayScore >= WIN_TARGET && board.awayScore > board.homeScore) return board.awayName;
  return null;
}

function renderResults() {
  resultsGrid.innerHTML = resultsState.scoreboards
    .map((board) => {
      const winner = resultWinner(board);
      const previous = previousScores.get(board.id);
      const homeRaised = hasRenderedResults && previous && board.homeScore > previous.homeScore;
      const awayRaised = hasRenderedResults && previous && board.awayScore > previous.awayScore;
      return `
        <article class="result-card theme-${board.theme}">
          <div class="result-title">
            <span>${board.title}</span>
            <small>${winner ? "Final" : `A ${WIN_TARGET}`}</small>
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
          <div class="result-winner">${winner ? `Guanya: ${winner}` : "En joc"}</div>
        </article>
      `;
    })
    .join("");

  previousScores = new Map(
    resultsState.scoreboards.map((board) => [
      board.id,
      { homeScore: board.homeScore, awayScore: board.awayScore },
    ]),
  );
  hasRenderedResults = true;
}

function applyState(nextState) {
  const nextText = JSON.stringify(nextState);
  if (nextText === lastStateText) return;
  lastStateText = nextText;
  resultsState = nextState;
  renderResults();
}

async function refreshResults() {
  const nextState = await fetch(`/api/state?t=${Date.now()}`, { cache: "no-store" }).then((response) => response.json());
  applyState(nextState);
}

async function initResults() {
  await refreshResults();

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    applyState(JSON.parse(event.data));
  };
  events.onerror = () => {
    refreshResults();
  };
  setInterval(refreshResults, 2000);
}

initResults();
