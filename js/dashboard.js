// js/dashboard.js
const API_BASE = "https://cs2-backend-0jh2.onrender.com";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.assign("login.html");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

(async function initDashboard() {
  const token = localStorage.getItem("token");
  const user = getUser();

  // ✅ если нет логина — на login
  if (!token || !user) {
    logout();
    return;
  }

  // ✅ заполняем dashboard данными (из localStorage)
  setText("uNick", user.nick || "Player");
  setText("uName", user.firstName || "—");
  setText("uNickname", user.nick || "—");
  setText("uEmail", user.email || "—");
  setText("uPhone", user.phone || "—");
  setText("uTournament", user.tournament || "—");

  // кнопки logout
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);

  // (опционально) можно проверить токен на сервере (если сделаем /api/auth/me)
})();
