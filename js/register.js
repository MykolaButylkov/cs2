// js/register.js
(() => {
  const API_BASE = "https://cs2-backend-0jh2.onrender.com";

  const form =
    document.querySelector("[data-register-form]") ||
    document.querySelector("form");

  // ✅ NEW input id
  const phoneInput = document.getElementById("phoneNumber");
  const phoneFull = document.getElementById("phoneFull");

  const smsSendBtn = document.getElementById("smsSendBtn");
  const smsVerifyBtn = document.getElementById("smsVerifyBtn");
  const smsCodeInput = document.getElementById("smsCode");

  const submitBtn = form?.querySelector('button[type="submit"]');

  let phoneVerified = false;

  // ✅ intl-tel-input init
  let iti = null;
  if (phoneInput && window.intlTelInput) {
    iti = window.intlTelInput(phoneInput, {
      initialCountry: "il",        // Израиль по умолчанию
      separateDialCode: true,      // показывать +972 отдельно
      nationalMode: false,         // чтобы getNumber() давал E.164
      formatOnDisplay: true,
      autoPlaceholder: "aggressive",
      // важно для корректного форматирования/валидации
      utilsScript:
        "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/utils.js",
    });
  }

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

  // ✅ always sync hidden phoneFull as E.164 (+972..., +380..., +1...)
  function syncPhone() {
    if (!phoneFull) return;

    if (!iti) {
      // fallback (если вдруг библиотека не загрузилась)
      const raw = (phoneInput?.value || "").trim();
      phoneFull.value = raw.startsWith("+") ? raw : "";
      return;
    }

    const number = iti.getNumber(); // E.164
    phoneFull.value = number || "";
  }

  phoneInput?.addEventListener("input", () => {
    syncPhone();
    // если меняли номер — сбрасываем верификацию
    if (phoneVerified) {
      phoneVerified = false;
      if (smsVerifyBtn) {
        smsVerifyBtn.textContent = "Verify";
        smsVerifyBtn.disabled = false;
      }
      if (smsSendBtn) smsSendBtn.disabled = false;
    }
  });

  // при смене страны тоже синкаем
  phoneInput?.addEventListener("countrychange", syncPhone);

  // initial
  syncPhone();

  function getPayload() {
    syncPhone();
    return {
      firstName: document.getElementById("firstName").value.trim(),
      nick: document.getElementById("nick").value.trim(),
      teamName: document.getElementById("teamName").value.trim(),
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

    const teamName = document.getElementById("teamName")?.value.trim();
    if (!teamName) throw new Error("Enter team name.");

    syncPhone();
    const phone = (phoneFull?.value || "").trim();

    // ✅ validation through intl-tel-input
    if (iti) {
      if (!phone) throw new Error("Enter phone number.");
      if (!iti.isValidNumber()) throw new Error("Enter a valid phone number.");
    } else {
      // fallback: require +...
      if (!phone || !phone.startsWith("+")) {
        throw new Error("Enter phone in international format (example: +972501234567).");
      }
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

      syncPhone();
      const phone = (phoneFull?.value || "").trim();
      if (!phone) throw new Error("Phone is empty. Type number first.");

      if (iti && !iti.isValidNumber()) {
        throw new Error("Enter a valid phone number.");
      }

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

      syncPhone();
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

      if (data.token) localStorage.setItem("token", data.token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      window.location.href = "dashboard.html";
    } catch (err) {
      console.error(err);

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