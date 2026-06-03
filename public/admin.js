const logoutButton = document.querySelector("#logoutButton");

logoutButton?.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login";
});
