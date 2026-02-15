// js/register.js
(() => {
const API_BASE = "https://cs2-backend-0jh2.onrender.com";

  const form =
    document.querySelector("[data-register-form]") ||
    document.querySelector("form");

  const phoneIL = document.getElementById("phoneIL");
  const phoneFull = document.getElementById("phoneFull");

  const smsSendBtn = document.getElementById("smsSendBtn");
  const smsVerifyBtn = document.getElementById("smsVerifyBtn");
  const smsCodeInput = document.getElementById("smsCode");

  const submitBtn = form?.querySelector('button[type="submit"]');

  let phoneVerified = false;

  function setLoading(isLoading, text = "Creating...") {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    submitBtn.dataset.prevText = submitBtn.dataset.prevText || submitBtn.textContent;
    submitBtn.textContent = isLoading ? text : submitBtn.dataset.prevText;
  }

  function setSmsButtons(sendDisabled, verifyDisabled) {
    if (smsSendBtn) smsSendBtn.disabled = !!sendDisabled;
    if (smsVerifyBtn) smsVerifyBtn.disabled = !!verifyDisabled;
  }

  function markVerifiedUI() {
    phoneVerified = true;
    if (smsVerifyBtn) {
      smsVerifyBtn.textContent = "Verified ✅";
      smsVerifyBtn.disabled = true;
    }
    if (smsSendBtn) smsSendBtn.disabled = true;
  }

  function getPayload() {
    return {
      firstName: document.getElementById("firstName").value.trim(),
      nick: document.getElementById("nick").value.trim(),
      email: document.getElementById("regEmail").value.trim(),
      phone: (phoneFull?.value || "").trim(),
      tournament: document.getElementById("regTournament").value,
      password: document.getElementById("regPass").value,
    };
  }

  function validateBeforeSubmit() {
    const pass1 = document.getElementById("regPass")?.value || "";
    const pass2 = document.getElementById("regPass2")?.value || "";

    if (pass1.length < 4) throw new Error("Password is too short.");
    if (pass1 !== pass2) throw new Error("Passwords do not match.");

    const phone = (phoneFull?.value || "").trim();
    if (!phone || !phone.startsWith("+972")) {
      throw new Error("Enter valid Israeli phone (0501234567).");
    }

    if (!phoneVerified) {
      throw new Error("Verify phone first.");
    }
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

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

  // --- SMS SEND ---
  smsSendBtn?.addEventListener("click", async () => {
    try {
      setSmsButtons(true, true);

      // phoneFull у тебя заполняется отдельным inline-скриптом в HTML.
      // Но на всякий случай убедимся, что оно не пустое.
      const phone = (phoneFull?.value || "").trim();
      if (!phone) throw new Error("Phone is empty. Type number first.");

      await postJson(`${API_BASE}/api/sms/send`, { phone });
      alert("✅ SMS sent. Enter the code and press Verify.");
      setSmsButtons(false, false);
    } catch (e) {
      console.error(e);
      alert(e.message || "SMS send failed");
      setSmsButtons(false, false);
    }
  });

  // --- SMS VERIFY ---
  smsVerifyBtn?.addEventListener("click", async () => {
    try {
      setSmsButtons(true, true);

      const phone = (phoneFull?.value || "").trim();
      const code = (smsCodeInput?.value || "").trim();

      if (!phone) throw new Error("Phone is empty.");
      if (!code) throw new Error("Enter SMS code.");

      await postJson(`${API_BASE}/api/sms/verify`, { phone, code });

      markVerifiedUI();
      alert("✅ Phone verified!");
      setSmsButtons(true, true);
    } catch (e) {
      console.error(e);
      alert(e.message || "Verification failed");
      setSmsButtons(false, false);
    }
  });

  // --- REGISTER SUBMIT ---
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      validateBeforeSubmit();
      setLoading(true);

      const payload = getPayload();

      const data = await postJson(`${API_BASE}/api/auth/register`, payload);

      // ВАЖНО: чтобы перейти на dashboard “с данными”, нужно сохранить token+user
      if (data.token) localStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      // ✅ РЕДИРЕКТ НА DASHBOARD
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error(err);

      // Если юзер уже существует — предложим логин
      const msg = err?.message || "Register failed";
      if (msg.toLowerCase().includes("already exists")) {
        alert("User already exists. Go to Login.");
        window.location.href = "login.html";
        return;
      }

      alert(msg);
    } finally {
      setLoading(false);
    }
  });
})();
