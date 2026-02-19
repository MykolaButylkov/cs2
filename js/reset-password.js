// js/reset-password.js
const API_BASE = "https://cs2-backend-0jh2.onrender.com";

const form = document.querySelector("[data-reset-form]");
const p1 = document.getElementById("rpPass1");
const p2 = document.getElementById("rpPass2");
const emailLabel = document.getElementById("rpEmail");

const qs = new URLSearchParams(location.search);
const email = (qs.get("email") || "").trim().toLowerCase();
const token = (qs.get("token") || "").trim();

if (emailLabel) emailLabel.textContent = email || "—";

function setBtnLoading(isLoading) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Saving..." : "Update password";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    if (!email || !token) {
      alert("Invalid reset link.");
      return;
    }

    const pass1 = p1?.value || "";
    const pass2 = p2?.value || "";

    if (pass1.length < 4) throw new Error("Password is too short.");
    if (pass1 !== pass2) throw new Error("Passwords do not match.");

    setBtnLoading(true);

    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, newPassword: pass1 }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || "Reset failed");
    }

    alert("✅ Password updated. You can log in now.");
    window.location.assign("login.html");
  } catch (err) {
    console.error(err);
    alert(err.message || "Reset failed");
  } finally {
    setBtnLoading(false);
  }
});
