// js/forgot-password.js
const API_BASE = "https://cs2-backend-0jh2.onrender.com";

const form = document.querySelector("[data-forgot-form]");
const emailEl = document.getElementById("fpEmail");

function setBtnLoading(isLoading) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Sending..." : "Send reset link";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    setBtnLoading(true);

    const email = (emailEl?.value || "").trim().toLowerCase();
    if (!email) {
      alert("Enter email");
      return;
    }

    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    // Всегда ok:true — даже если email не существует (защита)
    await res.json().catch(() => null);

    alert("If this email exists, we sent a reset link. Check your inbox (and Spam).");
    window.location.assign("login.html");
  } catch (err) {
    console.error(err);
    alert("Failed to send email. Try again later.");
  } finally {
    setBtnLoading(false);
  }
});
