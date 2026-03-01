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

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || `Request failed (${res.status})`);
  if (data.ok === false) throw new Error(data.error || "Request failed");
  return data;
}

async function refreshPaymentUI() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const st = await fetchJson(`${API_BASE}/api/payment/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const payBtn = document.getElementById("payBtn");
  const payHint = document.getElementById("payHint");
  const uStatus = document.getElementById("uStatus");

  if (st.paid) {
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = "Paid ✅";
    }
    if (payHint) payHint.textContent = `Payment received (${st.paymentRef || "ok"})`;
    if (uStatus) uStatus.textContent = "Active";
  } else {
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = "Pay ₪50 Entry Fee";
    }
    if (payHint) payHint.textContent = "Pay to confirm your spot in the tournament.";
    if (uStatus) uStatus.textContent = "Registered";
  }
}

document.getElementById("payBtn")?.addEventListener("click", async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("No token");

    const data = await fetchJson(`${API_BASE}/api/payment/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    });

    if (data.alreadyPaid) {
      await refreshPaymentUI();
      return;
    }

    // переходим на mock оплату
    window.location.href = data.url;
  } catch (e) {
    alert(e.message || "Payment init failed");
  }
});

// при загрузке
refreshPaymentUI().catch(console.error);