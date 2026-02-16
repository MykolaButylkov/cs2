const API_BASE = window.API_BASE || "https://cs2-backend-0jh2.onrender.com";

const els = {
  loginBox: document.getElementById("adminLoginBox"),
  tableBox: document.getElementById("adminTableBox"),
  form: document.getElementById("adminLoginForm"),
  u: document.getElementById("adminUser"),
  p: document.getElementById("adminPass"),
  tbody: document.getElementById("usersTbody"),
  count: document.getElementById("usersCount"),
  refresh: document.getElementById("refreshUsers"),
  logout: document.getElementById("adminLogout"),
};

function getToken() {
  return localStorage.getItem("adminToken");
}
function setToken(t) {
  localStorage.setItem("adminToken", t);
}
function clearToken() {
  localStorage.removeItem("adminToken");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: "Bearer " + token } : {};
}

function showLoggedInUI() {
  els.loginBox.style.display = "none";
  els.tableBox.style.display = "block";
}

function showLoggedOutUI() {
  els.loginBox.style.display = "block";
  els.tableBox.style.display = "none";
}

async function adminLogin(username, password) {
  const res = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: username, password }), // ✅ ВАЖНО: login, а не username
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Admin login failed");
  setToken(data.token);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function badgeYesNo(v, yesText = "Yes", noText = "No") {
  const ok = Number(v) === 1 || v === true;
  const text = ok ? yesText : noText;
  const style = ok
    ? "border-color: rgba(62,255,180,.35);"
    : "border-color: rgba(255,120,120,.35);";
  return `<span class="pill" style="${style}">${esc(text)}</span>`;
}

async function loadUsers() {
  const res = await fetch(`${API_BASE}/api/admin/users`, {
    headers: { ...authHeaders() },
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Load users failed");

  const users = data.users || [];
  els.count.textContent = `${users.length} users`;

  els.tbody.innerHTML = users.map(u => {
    const paidChecked = Number(u.paid) === 1 ? "checked" : "";
    return `
      <tr style="border-top:1px solid rgba(255,255,255,.10);">
        <td style="padding:10px;" class="tiny">${esc(u.id)}</td>
        <td style="padding:10px;">${esc(u.firstName)}</td>
        <td style="padding:10px;">${esc(u.nick)}</td>
        <td style="padding:10px;" class="tiny">${esc(u.email)}</td>
        <td style="padding:10px;" class="tiny">${esc(u.phone)}</td>
        <td style="padding:10px;" class="tiny">${esc(u.tournament)}</td>
        <td style="padding:10px;">${badgeYesNo(u.phoneVerified, "Verified", "No")}</td>
        <td style="padding:10px;">${badgeYesNo(u.paid, "Paid", "No")}</td>
        <td style="padding:10px;">
          <label class="auth-check" style="gap:8px;">
            <input type="checkbox" data-paid-toggle="${esc(u.id)}" ${paidChecked}/>
            <span class="tiny">Mark paid</span>
          </label>
        </td>
      </tr>
    `;
  }).join("");

  // навесим события на чекбоксы
  document.querySelectorAll("[data-paid-toggle]").forEach(ch => {
    ch.addEventListener("change", async () => {
      const id = ch.getAttribute("data-paid-toggle");
      const paid = ch.checked;

      try {
        ch.disabled = true;
        const res2 = await fetch(`${API_BASE}/api/admin/user/${id}/payment`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ paid }),
        });
        const d2 = await res2.json().catch(() => null);
        if (!res2.ok || !d2?.ok) throw new Error(d2?.error || "Update failed");

        await loadUsers();
      } catch (e) {
        alert(e.message || "Update error");
      } finally {
        ch.disabled = false;
      }
    });
  });
}

async function boot() {
  if (getToken()) {
    try {
      showLoggedInUI();
      await loadUsers();
      return;
    } catch (e) {
      // токен протух/невалидный
      clearToken();
    }
  }
  showLoggedOutUI();
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await adminLogin(els.u.value, els.p.value);
    showLoggedInUI();
    await loadUsers();
    els.p.value = "";
  } catch (err) {
    alert(err.message || "Admin login failed");
  }
});

els.refresh?.addEventListener("click", loadUsers);

els.logout?.addEventListener("click", () => {
  clearToken();
  showLoggedOutUI();
});

boot();
