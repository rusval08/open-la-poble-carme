const playersGrid = document.querySelector("#playersGrid");
const bulkPlayers = document.querySelector("#bulkPlayers");
const applyBulk = document.querySelector("#applyBulk");
const savePlayers = document.querySelector("#savePlayers");

let players = [];

function renderPlayers() {
  playersGrid.innerHTML = players
    .map(
      (player, index) => `
        <label class="player-field">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <input data-index="${index}" value="${player.name}" placeholder="Jugador ${index + 1}" />
        </label>
      `,
    )
    .join("");
}

async function saveCurrentPlayers() {
  await fetch("/api/players", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players }),
  });
  savePlayers.textContent = "Guardat";
  setTimeout(() => {
    savePlayers.textContent = "Guardar jugadors";
  }, 1200);
}

playersGrid.addEventListener("input", (event) => {
  const input = event.target.closest("[data-index]");
  if (!input) return;
  players[Number(input.dataset.index)].name = input.value;
});

applyBulk.addEventListener("click", () => {
  const names = bulkPlayers.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  players = players.map((player, index) => ({
    ...player,
    name: names[index] || player.name,
  }));
  renderPlayers();
});

savePlayers.addEventListener("click", saveCurrentPlayers);

async function initPlayers() {
  const state = await fetch("/api/state").then((response) => response.json());
  players = state.players;
  renderPlayers();
}

initPlayers();
