// js/login.js
const API_BASE = "https://cs2-backend-0jh2.onrender.com";

const form =
  document.querySelector("[data-login-form]") ||
  document.querySelector("form");

const emailEl = document.getElementById("loginEmail");
const passEl = document.getElementById("loginPass");

function setBtnLoading(isLoading) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Logging in..." : "Log in";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    setBtnLoading(true);

    const email = emailEl?.value?.trim().toLowerCase();
    const password = passEl?.value;

    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || `Login failed (${res.status})`);
    }

    // ✅ сохраняем токен + профиль
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    // ✅ переход на dashboard
    window.location.assign("dashboard.html");
  } catch (err) {
    console.error(err);
    alert(err.message || "Login failed");
  } finally {
    setBtnLoading(false);
  }
});
