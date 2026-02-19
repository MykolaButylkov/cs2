(() => {
  "use strict";

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
    search: document.getElementById("adminSearch"),
  };

  // ===== STATE =====
  let allUsers = [];
  let viewUsers = [];

  // default sorting
  let sortKey = "createdAt";
  let sortDir = "desc"; // "asc" | "desc"

  // edit state (only one row at a time)
  let editingId = null;

  // ===== TOKEN =====
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

  // ===== UI =====
  function showLoggedInUI() {
    if (els.loginBox) els.loginBox.style.display = "none";
    if (els.tableBox) els.tableBox.style.display = "block";
  }
  function showLoggedOutUI() {
    if (els.loginBox) els.loginBox.style.display = "block";
    if (els.tableBox) els.tableBox.style.display = "none";
  }

  // ===== HELPERS =====
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));
  }
  function norm(v) {
    return String(v ?? "").trim().toLowerCase();
  }
  function setCount(n) {
    if (els.count) els.count.textContent = `${n} users`;
  }
  function badgeYesNo(v, yesText = "Yes", noText = "No") {
    const ok = Number(v) === 1 || v === true;
    const text = ok ? yesText : noText;
    const style = ok
      ? "border-color: rgba(62,255,180,.35);"
      : "border-color: rgba(255,120,120,.35);";
    return `<span class="pill" style="${style}">${esc(text)}</span>`;
  }
  function parseDateMs(v) {
    const t = new Date(v || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function compareByKey(a, b, key) {
    if (key === "id") return Number(a?.id || 0) - Number(b?.id || 0);
    if (key === "createdAt") return parseDateMs(a?.createdAt) - parseDateMs(b?.createdAt);

    const av = norm(a?.[key]);
    const bv = norm(b?.[key]);

    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;

    return av.localeCompare(bv);
  }

  function matchesSearch(u, q) {
    if (!q) return true;
    const hay = [
      u.firstName,
      u.nick,
      u.teamName,
      u.email,
      u.phone,
      u.tournament,
    ].map(norm).join(" ");
    return hay.includes(q);
  }

  // ===== SORT ARROWS =====
  function renderSortArrows() {
    document.querySelectorAll("[data-arrow]").forEach((el) => {
      const key = el.getAttribute("data-arrow");
      if (key === sortKey) {
        el.textContent = sortDir === "asc" ? "▲" : "▼";
      } else {
        el.textContent = "";
      }
    });
  }

  // ===== API =====
  async function adminLogin(username, password) {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: username, password }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Admin login failed");
    setToken(data.token);
  }

  async function adminUpdateUser(id, patch) {
    const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(patch),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Update failed");
    return data.user;
  }

  async function adminSetPaid(id, paid) {
    const res = await fetch(`${API_BASE}/api/admin/user/${id}/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ paid }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Update failed");
    return data.user;
  }

  async function fetchUsers() {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { ...authHeaders() },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || "Load users failed");

    allUsers = Array.isArray(data.users) ? data.users : [];
    applySearchAndSort();
  }

  // ===== RENDER =====
  function renderUsers(users) {
    if (!els.tbody) return;

    els.tbody.innerHTML = (users || []).map((u) => {
      const isEdit = String(editingId) === String(u.id);
      const paidChecked = Number(u.paid) === 1 ? "checked" : "";

      const tdBase = `style="padding:10px;"`;

      const nickCell = isEdit
        ? `<input class="admin-input tiny" data-edit-nick="${esc(u.id)}" value="${esc(u.nick)}" />`
        : `<span class="tiny">${esc(u.nick)}</span>`;

      const teamCell = isEdit
        ? `<input class="admin-input tiny" data-edit-team="${esc(u.id)}" value="${esc(u.teamName)}" />`
        : `<span class="tiny">${esc(u.teamName)}</span>`;

      const emailCell = isEdit
        ? `<input class="admin-input tiny" data-edit-email="${esc(u.id)}" value="${esc(u.email)}" />`
        : `<span class="tiny">${esc(u.email)}</span>`;

      const actionCell = `
        <label class="auth-check" style="gap:8px;">
          <input type="checkbox" data-paid-toggle="${esc(u.id)}" ${paidChecked}/>
          <span class="tiny">Mark paid</span>
        </label>
      `;

      const editButtons = isEdit
        ? `
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-gold tiny" type="button" data-save-user="${esc(u.id)}">Save</button>
            <button class="btn btn-ghost tiny" type="button" data-cancel-edit="${esc(u.id)}">Cancel</button>
          </div>
        `
        : `
          <button class="btn btn-ghost tiny" type="button" data-edit-row="${esc(u.id)}">Edit</button>
        `;

      return `
        <tr data-user-row="${esc(u.id)}" style="border-top:1px solid rgba(255,255,255,.10);">
          <td ${tdBase} class="tiny">${esc(u.id)}</td>
          <td ${tdBase}>${esc(u.firstName)}</td>

          <td ${tdBase}>${nickCell}</td>
          <td ${tdBase}>${teamCell}</td>
          <td ${tdBase}>${emailCell}</td>

          <td ${tdBase} class="tiny">${esc(u.phone)}</td>

          <td ${tdBase} class="tiny">${esc(u.tournament)}</td>
          <td ${tdBase}>${badgeYesNo(u.phoneVerified, "Verified", "No")}</td>
          <td ${tdBase}>${badgeYesNo(u.paid, "Paid", "No")}</td>

          <td ${tdBase}>${actionCell}</td>
          <td ${tdBase}>${editButtons}</td>
        </tr>
      `;
    }).join("");

    bindRowActions();
  }

  function bindRowActions() {
    // paid toggles
    document.querySelectorAll("[data-paid-toggle]").forEach((ch) => {
      ch.addEventListener("change", async () => {
        const id = ch.getAttribute("data-paid-toggle");
        const paid = ch.checked;

        try {
          ch.disabled = true;
          await adminSetPaid(id, paid);
          await fetchUsers();
        } catch (e) {
          alert(e.message || "Update error");
        } finally {
          ch.disabled = false;
        }
      });
    });

    // enter edit mode
    document.querySelectorAll("[data-edit-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingId = btn.getAttribute("data-edit-row");
        applySearchAndSort(); // rerender keeps current filter/sort
      });
    });

    // cancel edit mode
    document.querySelectorAll("[data-cancel-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingId = null;
        applySearchAndSort();
      });
    });

    // save nick/team/email
    document.querySelectorAll("[data-save-user]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-save-user");

        const nickEl = document.querySelector(`[data-edit-nick="${CSS.escape(id)}"]`);
        const teamEl = document.querySelector(`[data-edit-team="${CSS.escape(id)}"]`);
        const emailEl = document.querySelector(`[data-edit-email="${CSS.escape(id)}"]`);

        const newNick = nickEl?.value ?? "";
        const newTeam = teamEl?.value ?? "";
        const newEmail = emailEl?.value ?? "";

        try {
          btn.disabled = true;
          const prev = btn.textContent;
          btn.textContent = "Saving...";

          await adminUpdateUser(id, { nick: newNick, teamName: newTeam, email: newEmail });

          btn.textContent = "Saved ✅";
          setTimeout(() => (btn.textContent = prev), 700);

          editingId = null;
          await fetchUsers();
        } catch (e) {
          alert(e.message || "Save error");
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  // ===== SEARCH + SORT PIPELINE =====
  function applySearchAndSort() {
    const q = norm(els.search?.value);

    viewUsers = allUsers
      .filter((u) => matchesSearch(u, q))
      .sort((a, b) => {
        const c = compareByKey(a, b, sortKey);
        return sortDir === "asc" ? c : -c;
      });

    setCount(viewUsers.length);
    renderUsers(viewUsers);
    renderSortArrows();
  }

  function bindSortHeaders() {
    document.querySelectorAll("th[data-sort]").forEach((th) => {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (!key) return;

        // если редактируем строку — лучше выйти из режима (иначе будет путаница при сортировке)
        editingId = null;

        if (sortKey === key) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          sortDir = "asc";
        }
        applySearchAndSort();
      });
    });
  }

  function bindSearch() {
    if (!els.search) return;
    let t = null;
    els.search.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        editingId = null; // при поиске тоже выходим из edit
        applySearchAndSort();
      }, 120);
    });
  }

  // ===== BOOT =====
  async function boot() {
    bindSortHeaders();
    bindSearch();

    if (getToken()) {
      try {
        showLoggedInUI();
        await fetchUsers();
        return;
      } catch {
        clearToken();
      }
    }
    showLoggedOutUI();
  }

  // ===== EVENTS =====
  els.form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await adminLogin(els.u.value, els.p.value);
      showLoggedInUI();
      await fetchUsers();
      if (els.p) els.p.value = "";
    } catch (err) {
      alert(err.message || "Admin login failed");
    }
  });

  els.refresh?.addEventListener("click", async () => {
    editingId = null;
    await fetchUsers();
  });

  els.logout?.addEventListener("click", () => {
    clearToken();
    showLoggedOutUI();
  });

  boot();
})();
