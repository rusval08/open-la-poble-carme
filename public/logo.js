function addGlobalLogo() {
  if (document.querySelector(".global-logo")) return;

  const logo = document.createElement("img");
  logo.className = "global-logo";
  logo.src = "/cpool-logo.png";
  logo.alt = "CPool";
  logo.decoding = "async";
  logo.loading = "eager";
  document.body.appendChild(logo);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", addGlobalLogo);
} else {
  addGlobalLogo();
}
