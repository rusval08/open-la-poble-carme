const screen = document.querySelector("#scoreboardScreen");
const id = Number(location.pathname.split("/").filter(Boolean).at(-1)) || 1;
let state = { scoreboards: [] };

function board() {
  return state.scoreboards.find((item) => item.id === id);
}

function fitText() {
  for (const item of document.querySelectorAll("[data-fit]")) {
    item.style.fontSize = "";
    let size = Number.parseFloat(getComputedStyle(item).fontSize);
    while (item.scrollWidth > item.clientWidth && size > 20) {
      size -= 2;
      item.style.fontSize = `${size}px`;
    }
  }
}

function render() {
  const current = board();
  if (!current) return;
  document.title = current.title;
  screen.className = `scoreboard-screen theme-${current.theme}`;
  screen.innerHTML = `
    <section class="screen-header">
      <h1 data-fit>${current.title}</h1>
    </section>

    <section class="score-display">
      <article>
        <h2 data-fit>${current.homeName}</h2>
        <strong>${current.homeScore}</strong>
      </article>
      <article>
        <h2 data-fit>${current.awayName}</h2>
        <strong>${current.awayScore}</strong>
      </article>
    </section>
  `;
  requestAnimationFrame(fitText);
}

async function init() {
  state = await fetch("/api/state").then((response) => response.json());
  render();

  const events = new EventSource("/api/events");
  events.onmessage = (event) => {
    state = JSON.parse(event.data);
    render();
  };
}

init();
