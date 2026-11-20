const logoutButton = document.querySelector("#logoutButton");const settingsForm = document.querySelector("#settingsForm");const tournamentNameInput = document.querySelector("#tournamentNameInput");const saveSettings = document.querySelector("#saveSettings");const tournamentNameElements = document.querySelectorAll("[data-tournament-name]");const adminLiveSummary = document.querySelector("#adminLiveSummary");function applyTournamentName(name) {const value = name || "Open la Pobla";tournamentNameElements.forEach((element) => {element.textContent = value;});if (tournamentNameInput && document.activeElement !== tournamentNameInput && tournamentNameInput.value === tournamentNameInput.defaultValue) tournamentNameInput.value = value; if (tournamentNameInput) tournamentNameInput.defaultValue = value;}let adminStateLoading = false;
async function loadAdminState() {
  if (adminStateLoading) return;
  adminStateLoading = true;
  const status = document.querySelector("#adminStateStatus");
  try {
    const response = await fetch("/api/state", {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Error de connexió");
    const state = await response.json();
    applyTournamentName(state.settings?.tournamentName);
    renderAdminSummary(state);
    renderAdminScorecards(state.scoreboards || [], Number(state.settings?.winTarget || 5));
    if (status) status.textContent = "";
  } catch {
    if (status) status.textContent = "No s’han pogut actualitzar els marcadors. Tornant-ho a provar…";
  } finally {
    adminStateLoading = false;
  }
}
function renderAdminSummary(state) {if (!adminLiveSummary) return;const target = Number(state.settings?.winTarget || 5);const boards = state.scoreboards || [];const active = boards.filter((board) => {const hasPlayers = board.homeName !== "JUGADOR LOCAL" || board.awayName !== "JUGADOR VISITANT";const finished = board.homeScore >= (board.winTarget ?? target) || board.awayScore >= (board.winTarget ?? target);return hasPlayers && !finished;}).length;const finished = boards.filter((board) => board.homeScore >= (board.winTarget ?? target) || board.awayScore >= (board.winTarget ?? target)).length;adminLiveSummary.innerHTML = `<article><span>Taules actives</span><strong>${active}</strong></article><article><span>Finalitzades ara</span><strong>${finished}</strong></article><article><span>Format actual</span><strong>${new Set(boards.map(b=>b.winTarget ?? target)).size>1 ? "Per taula" : "A "+(boards[0]?.winTarget ?? target)}</strong></article>`;}settingsForm?.addEventListener("submit", async (event) => {event.preventDefault();const tournamentName = tournamentNameInput.value.trim() || "Open la Pobla";saveSettings.textContent = "Guardant...";const response = await fetch("/api/settings", {method: "POST",headers: { "Content-Type": "application/json" },body: JSON.stringify({ tournamentName }),});if (response.ok) {const data = await response.json();applyTournamentName(data.settings?.tournamentName);saveSettings.textContent = "Nom guardat";} else {saveSettings.textContent = "Error";}setTimeout(() => {saveSettings.textContent = "Guardar nom";}, 1400);});logoutButton?.addEventListener("click", async () => {await fetch("/api/logout", { method: "POST" });window.location.href = "/login";});loadAdminState();setInterval(loadAdminState, 3000);


let lastScorecards = "";
function renderAdminScorecards(boards, defaultTarget) {
  const grid = document.querySelector("#adminScorecards");
  if (!grid) return;
  const current = JSON.stringify([boards, defaultTarget]);
  if (current === lastScorecards) return;
  lastScorecards = current;
  const focusedTable = grid.contains(document.activeElement) ? document.activeElement.dataset.tableControl : undefined;
  grid.replaceChildren(...boards.map(board => {
    const card = document.createElement("article");
    const title = document.createElement("h3");
    title.textContent = board.title || "Taula " + board.id;
    const target = board.winTarget ?? defaultTarget;
    const finished = board.locked || board.homeScore >= target || board.awayScore >= target;
    const empty = board.homeName === "JUGADOR LOCAL" && board.awayName === "JUGADOR VISITANT";
    const status = document.createElement("p");
    status.className = "admin-table-status";
    status.textContent = (finished ? "Finalitzada" : empty ? "Lliure" : "En joc") + " · A " + target;
    card.append(title, status);
    for (const side of ["home", "away"]) {
      const row = document.createElement("div");
      const player = document.createElement("span");
      const score = document.createElement("strong");
      player.textContent = board[side + "Name"];
      score.textContent = board[side + "Score"] ?? 0;
      row.append(player, score);
      card.append(row);
    }
    const control = document.createElement("a");
    control.href = "/control?taula=" + encodeURIComponent(board.id);
    control.dataset.tableControl = String(board.id);
    control.textContent = "Controlar taula";
    control.setAttribute("aria-label", "Controlar la taula " + board.id);
    card.append(control);
    return card;
  }));
  if (focusedTable) [...grid.querySelectorAll("[data-table-control]")].find(link => link.dataset.tableControl === focusedTable)?.focus();
  if (!boards.length) grid.textContent = "Encara no hi ha taules.";
}
