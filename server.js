const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;
const DATA_FILE = process.env.DATA_FILE ? path.resolve(process.env.DATA_FILE) : path.join(DATA_DIR, "campionat-data.json");

const clients = new Set();
const pendingFinishTimers = new Map();
const SCOREBOARD_COUNT = 6;
const PLAYER_COUNT = 64;
const RECTIFICATION_MS = 20000;
const MANUAL_ROUNDS = [
  ["r64", 32],
  ["r32", 16],
  ["r16", 8],
  ["qf", 4],
  ["sf", 2],
  ["final", 1],
];
const ROUND_KEYS = MANUAL_ROUNDS.map(([key]) => key);

function defaultPlayers() {
  return Array.from({ length: PLAYER_COUNT }, (_, index) => ({
    seed: index + 1,
    name: "",
  }));
}

function normalizePlayerName(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value.name === "string") return value.name.trim();
  return "";
}

function defaultBracketManual() {
  return Object.fromEntries(
    MANUAL_ROUNDS.map(([key, count]) => [
      key,
      Array.from({ length: count }, () => ({
        top: "",
        bottom: "",
        table: "",
        winner: "",
        score: "",
        topManual: false,
        bottomManual: false,
      })),
    ]),
  );
}

function loadSavedData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    return {};
  }
}

function saveData() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const payload = JSON.stringify(
      {
        scoreboards: state.scoreboards,
        players: state.players,
        bracketManual: state.bracketManual,
      },
      null,
      2,
    );
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, payload);
    fs.renameSync(tempFile, DATA_FILE);
  } catch (error) {
    console.error("No s'han pogut guardar les dades:", error.message);
  }
}

const state = {
  scoreboards: Array.from({ length: SCOREBOARD_COUNT }, (_, index) => ({
    id: index + 1,
    title: `Taula ${index + 1}`,
    homeName: "JUGADOR LOCAL",
    awayName: "JUGADOR VISITANT",
    homeScore: 0,
    awayScore: 0,
    period: "1",
    clock: "00:00",
    status: "Preparat",
    locked: false,
    rectificationEndsAt: "",
    theme: ["red", "blue", "green", "amber", "violet", "cyan"][index],
  })),
  players: defaultPlayers(),
  bracketManual: defaultBracketManual(),
};

const savedData = loadSavedData();
if (Array.isArray(savedData.scoreboards)) {
  state.scoreboards = state.scoreboards.map((board, index) => {
    const savedBoard = savedData.scoreboards[index] || {};
    return {
      ...board,
      title: String(savedBoard.title || board.title),
      homeName: String(savedBoard.homeName || board.homeName),
      awayName: String(savedBoard.awayName || board.awayName),
      homeScore: Math.min(5, Math.max(0, Number(savedBoard.homeScore) || 0)),
      awayScore: Math.min(5, Math.max(0, Number(savedBoard.awayScore) || 0)),
      period: String(savedBoard.period || board.period),
      clock: String(savedBoard.clock || board.clock),
      status: String(savedBoard.status || board.status),
      locked: Boolean(savedBoard.locked),
      rectificationEndsAt: String(savedBoard.rectificationEndsAt || ""),
      theme: String(savedBoard.theme || board.theme),
    };
  });
}

if (Array.isArray(savedData.players)) {
  state.players = defaultPlayers().map((player, index) => ({
    ...player,
    name: normalizePlayerName(savedData.players[index]),
  }));
}

if (savedData.bracketManual && typeof savedData.bracketManual === "object") {
  const defaults = defaultBracketManual();
  state.bracketManual = Object.fromEntries(
    MANUAL_ROUNDS.map(([key]) => [
      key,
      defaults[key].map((slot, index) => ({
        top: String(savedData.bracketManual[key]?.[index]?.top || ""),
        bottom: String(savedData.bracketManual[key]?.[index]?.bottom || ""),
        table: String(savedData.bracketManual[key]?.[index]?.table || ""),
        winner: String(savedData.bracketManual[key]?.[index]?.winner || ""),
        score: String(savedData.bracketManual[key]?.[index]?.score || ""),
        topManual: Boolean(savedData.bracketManual[key]?.[index]?.topManual),
        bottomManual: Boolean(savedData.bracketManual[key]?.[index]?.bottomManual),
      })),
    ]),
  );
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function sendJson(res, statusCode, value) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

function broadcast() {
  const payload = `data: ${JSON.stringify(publicState())}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function publicState() {
  return {
    scoreboards: state.scoreboards,
    players: state.players,
    bracketManual: state.bracketManual,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function updateScoreboard(id, patch) {
  const board = state.scoreboards.find((item) => item.id === id);
  if (!board) return null;

  if (patch.locked === false) {
    clearPendingFinish(board.id);
    board.rectificationEndsAt = "";
  }

  if (board.locked && patch.locked !== false) {
    return board;
  }

  const scoreChanged =
    Object.prototype.hasOwnProperty.call(patch, "homeScore") ||
    Object.prototype.hasOwnProperty.call(patch, "awayScore");
  const previousHomeScore = Number(board.homeScore) || 0;
  const previousAwayScore = Number(board.awayScore) || 0;

  const allowed = [
    "title",
    "homeName",
    "awayName",
    "homeScore",
    "awayScore",
    "period",
    "clock",
    "status",
    "locked",
    "rectificationEndsAt",
    "theme",
  ];

  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      board[key] = patch[key];
    }
  }

  board.homeScore = Number.isFinite(Number(board.homeScore)) ? Number(board.homeScore) : 0;
  board.awayScore = Number.isFinite(Number(board.awayScore)) ? Number(board.awayScore) : 0;
  board.homeScore = Math.min(5, Math.max(0, board.homeScore));
  board.awayScore = Math.min(5, Math.max(0, board.awayScore));

  const matchFinished = board.homeScore >= 5 || board.awayScore >= 5;
  if (scoreChanged && patch.locked !== false && matchFinished) {
    finishTableMatch(board, previousHomeScore, previousAwayScore);
  }

  return board;
}

function matchTitle(roundKey, index) {
  if (roundKey === "r64") return `Partit ${index + 1}`;
  if (roundKey === "r32") return `Partit ${index + 33}`;
  if (roundKey === "r16") return `Partit ${index + 49}`;
  if (roundKey === "qf") return `Quart ${index + 1}`;
  if (roundKey === "sf") return `Semi ${index + 1}`;
  return "Final";
}

function allBracketMatches() {
  return ROUND_KEYS.flatMap((roundKey) =>
    state.bracketManual[roundKey].map((match, index) => ({ roundKey, index, match })),
  );
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function findCurrentMatchForBoard(board) {
  const table = String(board.id);
  const boardHome = normalizeName(board.homeName);
  const boardAway = normalizeName(board.awayName);
  return (
    allBracketMatches().find(({ match }) => {
      if (String(match.table || "") !== table || match.winner) return false;
      return normalizeName(match.top) === boardHome && normalizeName(match.bottom) === boardAway;
    }) ||
    allBracketMatches().find(({ match }) => String(match.table || "") === table && !match.winner)
  );
}

function advanceWinner(roundKey, index, winner) {
  const roundPosition = ROUND_KEYS.indexOf(roundKey);
  const nextRoundKey = ROUND_KEYS[roundPosition + 1];
  if (!nextRoundKey) return;

  const nextMatch = state.bracketManual[nextRoundKey][Math.floor(index / 2)];
  if (!nextMatch) return;

  if (index % 2 === 0) nextMatch.top = winner;
  else nextMatch.bottom = winner;
}

function resetInvalidMatchResult(match) {
  if (!match.winner) return;
  const validWinner = match.top && match.bottom && (match.winner === match.top || match.winner === match.bottom);
  if (!validWinner) {
    match.winner = "";
    match.score = "";
  }
}

function recomputeBracketProgression() {
  const generated = Object.fromEntries(ROUND_KEYS.map((key) => [key, []]));

  for (const [roundPosition, roundKey] of ROUND_KEYS.entries()) {
    if (roundPosition > 0) {
      for (const [index, match] of state.bracketManual[roundKey].entries()) {
        const players = generated[roundKey][index] || {};
        if (!match.topManual) match.top = players.top || "";
        if (!match.bottomManual) match.bottom = players.bottom || "";
        if (!match.top || !match.bottom) {
          match.table = "";
        }
      }
    }

    for (const [index, match] of state.bracketManual[roundKey].entries()) {
      resetInvalidMatchResult(match);
      if (match.winner) {
        const nextRoundKey = ROUND_KEYS[roundPosition + 1];
        if (nextRoundKey) {
          const nextIndex = Math.floor(index / 2);
          generated[nextRoundKey][nextIndex] = generated[nextRoundKey][nextIndex] || {};
          if (index % 2 === 0) generated[nextRoundKey][nextIndex].top = match.winner;
          else generated[nextRoundKey][nextIndex].bottom = match.winner;
        }
      }
    }
  }
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function nextReadyMatch() {
  const matches = allBracketMatches().filter(({ match }) => match.top && match.bottom && !match.winner && !match.table);
  return shuffle(matches)[0];
}

function clearBoardMatchAssignment(boardId) {
  for (const { match } of allBracketMatches()) {
    if (!match.winner && String(match.table || "") === String(boardId)) {
      match.table = "";
    }
  }
}

function loadMatchToTable(roundKey, index, tableId) {
  const match = state.bracketManual[roundKey]?.[index];
  const board = state.scoreboards.find((item) => item.id === Number(tableId));
  if (!match || !board || !match.top || !match.bottom || match.winner) return null;
  const previousTable = String(match.table || "");

  for (const { match: otherMatch } of allBracketMatches()) {
    if (otherMatch !== match && !otherMatch.winner && String(otherMatch.table || "") === String(tableId)) {
      otherMatch.table = "";
    }
  }

  if (previousTable && previousTable !== String(tableId)) {
    const previousBoard = state.scoreboards.find((item) => item.id === Number(previousTable));
    if (
      previousBoard &&
      !previousBoard.locked &&
      previousBoard.homeScore === 0 &&
      previousBoard.awayScore === 0 &&
      normalizeName(previousBoard.homeName) === normalizeName(match.top) &&
      normalizeName(previousBoard.awayName) === normalizeName(match.bottom)
    ) {
      previousBoard.homeName = "JUGADOR LOCAL";
      previousBoard.awayName = "JUGADOR VISITANT";
      previousBoard.status = "Preparat";
      previousBoard.rectificationEndsAt = "";
    }
  }

  match.table = String(tableId);
  board.homeName = match.top;
  board.awayName = match.bottom;
  board.homeScore = 0;
  board.awayScore = 0;
  board.status = matchTitle(roundKey, index);
  board.locked = false;
  board.rectificationEndsAt = "";
  return board;
}

function unassignTable(tableId) {
  const board = state.scoreboards.find((item) => item.id === Number(tableId));
  if (!board) return null;

  clearPendingFinish(board.id);
  clearBoardMatchAssignment(board.id);
  board.homeName = "JUGADOR LOCAL";
  board.awayName = "JUGADOR VISITANT";
  board.homeScore = 0;
  board.awayScore = 0;
  board.status = "Preparat";
  board.locked = false;
  board.rectificationEndsAt = "";
  return board;
}

function randomizeFreeTables() {
  const freeBoards = state.scoreboards.filter((board) => !board.locked && board.homeScore === 0 && board.awayScore === 0);
  const freeTableIds = new Set(freeBoards.map((board) => String(board.id)));

  for (const { match } of allBracketMatches()) {
    if (!match.winner && freeTableIds.has(String(match.table || ""))) {
      match.table = "";
    }
  }

  const readyMatches = shuffle(
    allBracketMatches().filter(({ match }) => match.top && match.bottom && !match.winner && !match.table),
  );
  const shuffledBoards = shuffle(freeBoards);

  const assigned = [];
  for (const [index, board] of shuffledBoards.entries()) {
    const next = readyMatches[index];
    if (!next) break;
    const loaded = loadMatchToTable(next.roundKey, next.index, board.id);
    if (loaded) assigned.push({ table: board.id, round: next.roundKey, index: next.index });
  }

  return assigned;
}

function syncAssignedMatchesToTables() {
  for (const { roundKey, index, match } of allBracketMatches()) {
    if (!match.table || match.winner || !match.top || !match.bottom) continue;

    const board = state.scoreboards.find((item) => item.id === Number(match.table));
    if (!board || board.locked || board.homeScore !== 0 || board.awayScore !== 0) continue;

    board.homeName = match.top;
    board.awayName = match.bottom;
    board.status = matchTitle(roundKey, index);
  }
}

function clearPendingFinish(boardId) {
  const timer = pendingFinishTimers.get(boardId);
  if (timer) clearTimeout(timer);
  pendingFinishTimers.delete(boardId);
}

function finishTableMatch(board, previousHomeScore, previousAwayScore) {
  clearPendingFinish(board.id);
  board.locked = true;
  board.status = "Pendent de rectificar";
  board.rectificationEndsAt = String(Date.now() + RECTIFICATION_MS);

  const timer = setTimeout(() => {
    pendingFinishTimers.delete(board.id);
    completeTableMatch(board, previousHomeScore, previousAwayScore);
    broadcast();
  }, RECTIFICATION_MS);
  pendingFinishTimers.set(board.id, timer);
}

function completeTableMatch(board, previousHomeScore, previousAwayScore) {
  board.rectificationEndsAt = "";
  const current = findCurrentMatchForBoard(board);
  const homeReached = board.homeScore >= 5 && previousHomeScore < 5;
  const awayReached = board.awayScore >= 5 && previousAwayScore < 5;
  let winner = "";

  if (homeReached && !awayReached) winner = board.homeName;
  else if (awayReached && !homeReached) winner = board.awayName;
  else if (board.homeScore >= 5 && board.homeScore > board.awayScore) winner = board.homeName;
  else if (board.awayScore >= 5 && board.awayScore > board.homeScore) winner = board.awayName;

  if (!winner) {
    board.locked = true;
    board.status = "Partit finalitzat";
    return;
  }

  if (current) {
    current.match.winner = winner;
    current.match.score = `${board.homeScore} - ${board.awayScore}`;
    recomputeBracketProgression();
  }

  board.homeName = "JUGADOR LOCAL";
  board.awayName = "JUGADOR VISITANT";
  board.homeScore = 0;
  board.awayScore = 0;
  board.status = "Preparat";
  board.locked = false;
  board.rectificationEndsAt = "";

  saveData();
}

function restorePendingFinishes() {
  for (const board of state.scoreboards) {
    const endsAt = Number(board.rectificationEndsAt || 0);
    if (!board.locked || !endsAt) continue;

    const remaining = endsAt - Date.now();
    if (remaining <= 0) {
      completeTableMatch(board, 0, 0);
      continue;
    }

    const timer = setTimeout(() => {
      pendingFinishTimers.delete(board.id);
      completeTableMatch(board, 0, 0);
      broadcast();
    }, remaining);
    pendingFinishTimers.set(board.id, timer);
  }
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);

  if (urlPath === "/" || urlPath === "/admin") urlPath = "/admin.html";
  if (urlPath === "/control") urlPath = "/index.html";
  if (urlPath.startsWith("/scoreboard/")) urlPath = "/scoreboard.html";
  if (urlPath.startsWith("/obs/")) urlPath = "/obs.html";
  if (urlPath.startsWith("/obs-safe/")) urlPath = "/obs-safe.html";
  if (urlPath === "/tv-table" || urlPath === "/obs-tv") urlPath = "/tv-table.html";
  if (urlPath === "/resultats") urlPath = "/resultats.html";
  if (urlPath === "/quadrant") urlPath = "/quadrant.html";
  if (urlPath === "/quadrant-admin") urlPath = "/quadrant-admin.html";
  if (urlPath === "/quadrant-control") urlPath = "/quadrant-control.html";
  if (urlPath === "/jugadors") urlPath = "/jugadors.html";
  if (urlPath === "/directe") urlPath = "/directe.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, publicState());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "open-la-pobla", time: new Date().toISOString() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("retry: 1000\n\n");
    res.write(`data: ${JSON.stringify(publicState())}\n\n`);
    clients.add(res);
    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, 10000);
    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(res);
    });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/scoreboards/")) {
    const id = Number(url.pathname.split("/").at(-1));
    try {
      const patch = JSON.parse(await readBody(req) || "{}");
      const updated = updateScoreboard(id, patch);
      if (!updated) {
        sendJson(res, 404, { error: "Taula no trobada" });
        return;
      }
      saveData();
      broadcast();
      sendJson(res, 200, updated);
    } catch (error) {
      sendJson(res, 400, { error: "JSON invalid" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    for (const board of state.scoreboards) {
      clearPendingFinish(board.id);
      board.homeScore = 0;
      board.awayScore = 0;
      board.period = "1";
      board.clock = "00:00";
      board.status = "Preparat";
      board.locked = false;
      board.rectificationEndsAt = "";
    }
    saveData();
    broadcast();
    sendJson(res, 200, publicState());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/players") {
    try {
      const body = JSON.parse(await readBody(req) || "{}");
      const players = Array.isArray(body.players) ? body.players : [];
      state.players = defaultPlayers().map((player, index) => ({
        ...player,
        name: normalizePlayerName(players[index]),
      }));
      saveData();
      broadcast();
      sendJson(res, 200, { players: state.players });
    } catch (error) {
      sendJson(res, 400, { error: "JSON invalid" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bracket-manual") {
    try {
      const body = JSON.parse(await readBody(req) || "{}");
      const incoming = body.bracketManual && typeof body.bracketManual === "object" ? body.bracketManual : {};
      const defaults = defaultBracketManual();
      state.bracketManual = Object.fromEntries(
        MANUAL_ROUNDS.map(([key]) => [
          key,
          defaults[key].map((slot, index) => {
            const incomingSlot = incoming[key]?.[index] || {};
            return {
              top: String(incomingSlot.top || "").trim(),
              bottom: String(incomingSlot.bottom || "").trim(),
              table: String(incomingSlot.table || "").trim(),
              winner: String(
                Object.prototype.hasOwnProperty.call(incomingSlot, "winner")
                  ? incomingSlot.winner
                  : state.bracketManual[key]?.[index]?.winner || "",
              ).trim(),
              score: String(
                Object.prototype.hasOwnProperty.call(incomingSlot, "score")
                  ? incomingSlot.score
                  : state.bracketManual[key]?.[index]?.score || "",
              ).trim(),
              topManual: Boolean(incomingSlot.topManual),
              bottomManual: Boolean(incomingSlot.bottomManual),
            };
          }),
        ]),
      );
      recomputeBracketProgression();
      syncAssignedMatchesToTables();
      saveData();
      broadcast();
      sendJson(res, 200, { bracketManual: state.bracketManual });
    } catch (error) {
      sendJson(res, 400, { error: "JSON invalid" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bracket-load-match") {
    try {
      const body = JSON.parse(await readBody(req) || "{}");
      const roundKey = String(body.round || "");
      const index = Number(body.index);
      const table = Number(body.table);
      const updated = loadMatchToTable(roundKey, index, table);
      if (!updated) {
        sendJson(res, 400, { error: "No s'ha pogut carregar aquest partit a la taula" });
        return;
      }
      saveData();
      broadcast();
      sendJson(res, 200, publicState());
    } catch (error) {
      sendJson(res, 400, { error: "JSON invalid" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bracket-unassign-table") {
    try {
      const body = JSON.parse(await readBody(req) || "{}");
      const table = Number(body.table);
      const updated = unassignTable(table);
      if (!updated) {
        sendJson(res, 400, { error: "No s'ha pogut deixar lliure aquesta taula" });
        return;
      }
      saveData();
      broadcast();
      sendJson(res, 200, publicState());
    } catch (error) {
      sendJson(res, 400, { error: "JSON invalid" });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/bracket-random-tables") {
    const assigned = randomizeFreeTables();
    saveData();
    broadcast();
    sendJson(res, 200, { assigned, state: publicState() });
    return;
  }

  serveStatic(req, res);
});

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

restorePendingFinishes();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Taula TV activa: http://localhost:${PORT}/control`);
  for (const address of localAddresses()) {
    console.log(`Wi-Fi/LAN: http://${address}:${PORT}/control`);
  }
  console.log(`Pantalles: http://localhost:${PORT}/scoreboard/1 ... /scoreboard/${SCOREBOARD_COUNT}`);
});
