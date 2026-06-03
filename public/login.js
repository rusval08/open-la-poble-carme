const loginForm = document.querySelector("#loginForm");
const passwordInput = document.querySelector("#password");
const loginError = document.querySelector("#loginError");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: passwordInput.value }),
  });

  if (!response.ok) {
    loginError.hidden = false;
    return;
  }

  const next = new URLSearchParams(window.location.search).get("next") || "/admin";
  window.location.href = next;
});
