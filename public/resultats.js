window.CPoolEscape=window.CPoolEscape||function(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
const resultsGrid = document.querySelector("#resultsGrid");
const liveNowSection = document.querySelector("#liveNowSection");
const finishBanner = document.querySelector("#finishBanner");
const tournamentNameElements = document.querySelectorAll(
  "[data-tournament-name]",
);
const winTargetElements = document.querySelectorAll("[data-win-target]");
const winTargetTextElements = document.querySelectorAll(
  "[data-win-target-text]",
);
let resultsState = {
  settings: { tournamentName: "Open la Pobla", winTarget: 5 },
  scoreboards: [],
};
let previousScores = new Map();
const otherScoreHighlights = new Map();
let previousWinners = new Map();
let hasRenderedResults = false;
let lastStateText = "";
function winTarget(board) {
  const target = Number(board?.winTarget ?? resultsState.settings?.winTarget ?? 5);
  return [4, 5, 6, 7].includes(target) ? target : 5;
}
function resultWinner(board) {
  const target = winTarget(board);
  if (board.homeScore >= target && board.homeScore > board.awayScore)
    return board.homeName;
  if (board.awayScore >= target && board.awayScore > board.homeScore)
    return board.awayName;
  return null;
}
function isActiveBoard(board) {
  const hasPlayers =
    board.homeName !== "JUGADOR LOCAL" || board.awayName !== "JUGADOR VISITANT";
  const hasScore = board.homeScore > 0 || board.awayScore > 0;
  return (
    hasPlayers &&
    !resultWinner(board) &&
    (hasScore || board.status !== "Preparat")
  );
}
function renderLiveNow() {
  const active = resultsState.scoreboards.filter(isActiveBoard);
  if (!active.length) {
    liveNowSection.innerHTML = `<article class="live-now-card empty"><span>En joc ara</span><strong>Cap partida activa</strong><p>Les taules apareixeran aqui quan comenci un enfrontament.</p></article>`;
    return;
  }
  liveNowSection.innerHTML = `<article class="live-now-card"><span>En joc ara</span><strong>${active.length} partida${active.length === 1 ? "" : "es"} activa${active.length === 1 ? "" : "s"}</strong><div class="live-now-list">${active.map((board) => `<a href="#taula-${window.CPoolEscape(board.id)}"><b>${window.CPoolEscape(board.title)}</b><em>${window.CPoolEscape(board.homeName)} ${board.homeScore} - ${board.awayScore} ${window.CPoolEscape(board.awayName)}</em></a>`).join("")}</div></article>`;
}
const largeResults = new URLSearchParams(location.search).get("pantalla") === "1";
const tvCards = [...document.querySelectorAll(".results-tv-card")];

function renderTvTables() {
  if (largeResults) return;
  for (const [index, card] of tvCards.entries()) {
    const number = index + 1;
    const board = resultsState.scoreboards.find(item => Number(item.id) === number);
    const scoreboard = card.querySelector(".results-tv-score");
    const hasMatch = Boolean(
      board?.homeName?.trim() && board.homeName !== "JUGADOR LOCAL" &&
      board.awayName?.trim() && board.awayName !== "JUGADOR VISITANT"
    );
    scoreboard.hidden = !hasMatch;
    if (hasMatch) {
      const [home, score, away] = scoreboard.children;
      home.textContent = board.homeName;
      away.textContent = board.awayName;
      score.textContent = `${board.homeScore} — ${board.awayScore}`;
    }

    const video = card.querySelector(".results-tv-video");
    const frame = video.querySelector("iframe");
    const open = resultsState.settings?.publicBroadcast?.open === true;
    card.querySelector(".results-tv-status").textContent = open ? "En directe" : "Sense emissió";
    card.classList.toggle("broadcast-open", open);
    if (!open) {
      frame?.remove();
    } else if (!frame) {
      const player = document.createElement("iframe");
      player.title = `Emissió de TV Table ${number}`;
      player.allow = "autoplay; fullscreen";
      player.allowFullscreen = true;
      player.src = `/tv-directe.html?taula=${number}&embed=1`;
      video.append(player);
    }
  }
}

function renderOtherScore(board, side, now) {
  const score = board[side + "Score"];
  const previous = previousScores.get(board.id);
  let highlights = otherScoreHighlights.get(board.id);
  if (!previous || !highlights || previous.homeName !== board.homeName || previous.awayName !== board.awayName) {
    highlights = {};
    otherScoreHighlights.set(board.id, highlights);
  } else if (score > previous[side + "Score"]) {
    highlights[side] = now + 5000;
  } else if (score < previous[side + "Score"]) {
    delete highlights[side];
  }
  const remaining = (highlights[side] ?? 0) - now;
  const span = remaining > 0
    ? '<span class="results-point-highlight" style="animation-duration:' + remaining + 'ms">'
    : "<span>";
  return span + window.CPoolEscape(score) + "</span>";
}

function renderResults() {
  tournamentNameElements.forEach((element) => {
    element.textContent =
      resultsState.settings?.tournamentName || "Open la Pobla";
  });
  winTargetElements.forEach((element) => {
    element.textContent = winTarget();
  });
  winTargetTextElements.forEach((element) => {
    element.textContent = "El format de cada partit s’indica a la seva taula.";
  });
  renderLiveNow();
  renderTvTables();
  if (!largeResults) {
    const otherTables = document.querySelector("#otherTables");
    if (otherTables) {
      const escape = window.CPoolEscape;
      const now = performance.now();
      otherTables.innerHTML = resultsState.scoreboards
        .filter(board => ![1, 2].includes(Number(board.id)))
        .map(board => `<div class="results-table-row" id="taula-${escape(board.id)}"><span>${escape(board.title)}</span><span>${escape(board.homeName)} – ${escape(board.awayName)}</span><strong>${renderOtherScore(board, "home", now)} – ${renderOtherScore(board, "away", now)}</strong></div>`)
        .join("") || "<p>Encara no hi ha resultats.</p>";
    }
  }
  resultsGrid.innerHTML = resultsState.scoreboards
    .filter(board => largeResults || tvCards.length === 0 || ![1, 2].includes(Number(board.id)))
    .map((board) => {
      const winner = resultWinner(board);
      const previous = previousScores.get(board.id);
      const homeRaised =
        hasRenderedResults && previous && board.homeScore > previous.homeScore;
      const awayRaised =
        hasRenderedResults && previous && board.awayScore > previous.awayScore;
      return `<article class="result-card theme-${window.CPoolEscape(board.theme)}">${largeResults ? `<span id="taula-${window.CPoolEscape(board.id)}" class="anchor-target"></span>` : ""}<div class="result-title"><span>${window.CPoolEscape(board.title)}</span><small>${winner ? "Final" : `A ${winTarget(board)}`}</small></div><div class="result-score"><div class="result-player ${homeRaised ? "player-flash" : ""}"><strong>${window.CPoolEscape(board.homeName)}</strong><span class="${homeRaised ? "score-flash" : ""}">${board.homeScore}</span></div><div class="result-divider">-</div><div class="result-player right ${awayRaised ? "player-flash" : ""}"><strong>${window.CPoolEscape(board.awayName)}</strong><span class="${awayRaised ? "score-flash" : ""}">${board.awayScore}</span></div></div><div class="result-winner">${winner ? `Guanya: ${window.CPoolEscape(winner)}` : `Partit a ${winTarget(board)} guanyades`}</div></article>`;
    })
    .join("");
  previousScores = new Map(
    resultsState.scoreboards.map((board) => [
      board.id,
      { homeScore: board.homeScore, awayScore: board.awayScore, homeName: board.homeName, awayName: board.awayName },
    ]),
  );
  previousWinners = new Map(
    resultsState.scoreboards.map((board) => [board.id, resultWinner(board)]),
  );
  hasRenderedResults = true;
}
function showFinishBanner(board, winner) {
  if (!finishBanner || !winner) return;
  finishBanner.hidden = false;
  finishBanner.innerHTML = `<strong>Partit finalitzat</strong><span>${window.CPoolEscape(board.title)}: guanya ${window.CPoolEscape(winner)} (${board.homeScore} - ${board.awayScore})</span>`;
  window.clearTimeout(showFinishBanner.timer);
  showFinishBanner.timer = window.setTimeout(() => {
    finishBanner.hidden = true;
  }, 6000);
}
function detectFinishedMatches(nextState) {
  if (!hasRenderedResults) return;
  (nextState.scoreboards || []).forEach((board) => {
    const oldWinner = previousWinners.get(board.id);
    const target = Number(board.winTarget ?? nextState.settings?.winTarget ?? 5);
    const safeTarget = [4, 5, 6, 7].includes(target) ? target : 5;
    let winner = null;
    if (board.homeScore >= safeTarget && board.homeScore > board.awayScore)
      winner = board.homeName;
    if (board.awayScore >= safeTarget && board.awayScore > board.homeScore)
      winner = board.awayName;
    if (!oldWinner && winner) showFinishBanner(board, winner);
  });
}
function applyState(nextState) {
  const nextText = JSON.stringify(nextState);
  if (nextText === lastStateText) return;
  detectFinishedMatches(nextState);
  lastStateText = nextText;
  resultsState = nextState;
  renderResults();
}
async function refreshResults() {
  const nextState = await fetch(`/api/state?t=${Date.now()}`, {
    cache: "no-store",
  }).then((response) => response.json());
  applyState(nextState);
}
function initResults() {
  const refresh = () => refreshResults().catch(() => {});
  setInterval(refresh, 2000);
  refresh();
  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    applyState(JSON.parse(event.data));
  };
  events.onerror = refresh;
}
initResults();
