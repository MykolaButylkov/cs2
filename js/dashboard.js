// js/dashboard.js
const API_BASE = "https://cs2-backend-0jh2.onrender.com";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
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

function fillUI(u) {
  setText("uNick", u?.nick || "Player");
  setText("uName", u?.firstName || "—");
  setText("uNickname", u?.nick || "—");
  setText("uTeam", u?.teamName || "—");
  setText("uEmail", u?.email || "—");
  setText("uPhone", u?.phone || "—");
  setText("uTournament", u?.tournament || "—");
}

async function fetchMe(token) {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + token,
    },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `Me failed (${res.status})`);
  }
  return data.user;
}

(async function initDashboard() {
  const token = localStorage.getItem("token");
  const user = getUser();

  // ✅ если нет логина — на login
  if (!token) {
    logout();
    return;
  }

  // ✅ быстро показываем из localStorage (если есть)
  if (user) fillUI(user);

  // кнопки logout
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);

  // ✅ подтягиваем актуальные данные с сервера
  try {
    const freshUser = await fetchMe(token);
    setUser(freshUser);
    fillUI(freshUser);
  } catch (e) {
    console.error(e);
    // токен протух/невалидный или сервер недоступен
    // если совсем нет user — выкидываем на логин
    if (!user) logout();
  }
})();
