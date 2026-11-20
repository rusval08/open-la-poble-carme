const origin = window.location.origin;
const links = {
  results: `${origin}/resultats`,
  bracket: `${origin}/quadrant`,
};

function qrUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(value)}`;
}

document.querySelector("#resultsUrl").textContent = links.results;
document.querySelector("#bracketUrl").textContent = links.bracket;
document.querySelector("#resultsQr").src = qrUrl(links.results);
document.querySelector("#bracketQr").src = qrUrl(links.bracket);
