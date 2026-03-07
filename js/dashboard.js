// js/dashboard.js
const API_BASE = "https://cs2-backend-0jh2.onrender.com";

/** ===== Tournament images map (название -> путь к картинке) =====
 *  Добавляй сюда турниры 1-в-1 как в register.html <option value="...">
 */
const TOURNAMENT_IMAGES = {
  "Global Esports Championship": "./img/tournaments/global-esports-championship.png",
  // "Inferno Open": "./img/tournaments/inferno-open.png",
  // "Verdant Cup": "./img/tournaments/verdant-cup.png",
  // "City Clash": "./img/tournaments/city-clash.png",
};

const DEFAULT_TOURNAMENT_IMAGE = "./img/tournaments/default.png";

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

function setTournamentImage(tournamentName) {
  const img = document.getElementById("uTournamentImg");
  if (!img) return;

  const src = TOURNAMENT_IMAGES[tournamentName] || DEFAULT_TOURNAMENT_IMAGE;
  img.src = src;
  img.alt = tournamentName ? `Tournament: ${tournamentName}` : "Tournament image";
}

function fillUI(u) {
  setText("uNick", u?.nick || "Player");
  setText("uName", u?.firstName || "—");
  setText("uNickname", u?.nick || "—");
  setText("uTeam", u?.teamName || "—");
  setText("uEmail", u?.email || "—");
  setText("uPhone", u?.phone || "—");
  setText("uTournament", u?.tournament || "—");

  setTournamentImage(u?.tournament || "");
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => null);

  if (!res.ok || !data) {
    const msg = data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  if (data.ok === false) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function fetchMe(token) {
  const data = await fetchJson(`${API_BASE}/api/auth/me`, {
    method: "GET",
    headers: { Authorization: "Bearer " + token },
  });
  return data.user;
}

/** ===== Payment ===== */
async function refreshPaymentUI(token) {
  const payBtn = document.getElementById("payBtn");
  const payHint = document.getElementById("payHint");
  const uStatus = document.getElementById("uStatus");

  // если на странице нет кнопки оплаты — просто выходим
  if (!payBtn && !payHint && !uStatus) return;

  const st = await fetchJson(`${API_BASE}/api/payment/status`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const paid = !!st.paid;

  if (paid) {
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = "Paid ✅";
    }
    if (payHint) payHint.textContent = `Payment received ${st.paymentRef ? "(" + st.paymentRef + ")" : ""}`.trim();
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

async function startPayment(token) {
  const data = await fetchJson(`${API_BASE}/api/payment/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (data.alreadyPaid) return;

  // backend вернёт ссылку на pay-mock.html?session=...
  if (!data.url) throw new Error("Payment URL missing");
  window.location.href = data.url;
}

(async function initDashboard() {
  const token = localStorage.getItem("token");
  const user = getUser();

  if (!token) {
    logout();
    return;
  }

  // быстрый UI из localStorage
  if (user) fillUI(user);

  // logout кнопки
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);

  // pay button
  document.getElementById("payBtn")?.addEventListener("click", async () => {
    try {
      await startPayment(token);
    } catch (e) {
      console.error(e);
      alert(e.message || "Payment init failed");
    }
  });

  // подтянуть актуальные данные
  try {
    const freshUser = await fetchMe(token);
    setUser(freshUser);
    fillUI(freshUser);

    // после me — подтягиваем статус оплаты
    await refreshPaymentUI(token);
  } catch (e) {
    console.error(e);
    if (!user) logout();
  }
})();