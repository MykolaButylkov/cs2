// js/auth-firebase.js
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  RecaptchaVerifier,
  linkWithPhoneNumber, // ✅ ВАЖНО: привязка телефона к текущему юзеру
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* ---------------------------
   Helpers
--------------------------- */
function qs(sel) { return document.querySelector(sel); }
function byId(id) { return document.getElementById(id); }

function normalizeILMobileToE164(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return { ok: false, e164: "", reason: "Phone is empty" };

  // 0501234567 -> 501234567
  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);

  // expecting 9 digits starting with 5
  if (!(digits.length === 9 && digits.startsWith("5"))) {
    return { ok: false, e164: "", reason: "Enter Israeli mobile like 0501234567" };
  }

  const prefix = digits.slice(0, 2);
  const allowed = ["50", "51", "52", "53", "54", "55", "56", "57", "58", "59"];
  if (!allowed.includes(prefix)) {
    return { ok: false, e164: "", reason: "Phone must be Israeli mobile (05X...)" };
  }

  return { ok: true, e164: "+972" + digits, reason: "" };
}

function setText(id, v) {
  const el = byId(id);
  if (el) el.textContent = v ?? "—";
}

function show(el) { if (el) el.style.display = ""; }
function hide(el) { if (el) el.style.display = "none"; }

/* ---------------------------
   REGISTER (register.html)
   Требуем:
   - <form data-register-form>
   - id: firstName, nick, regEmail, regPass, regPass2, phoneIL, regTournament (optional)
   - блок телефона:
      #phoneVerifyBox
      #smsCode
      #smsSendBtn
      #smsVerifyBtn
      #recaptcha-container
--------------------------- */
(async function initRegister() {
  const form = qs("[data-register-form]");
  if (!form) return;

  const phoneVerifyBox = byId("phoneVerifyBox");
  const smsSendBtn = byId("smsSendBtn");
  const smsVerifyBtn = byId("smsVerifyBtn");
  const smsCodeInput = byId("smsCode");

  // прячем до создания аккаунта
  hide(phoneVerifyBox);

  let confirmationResult = null;
  let profileDraft = null;

  let recaptcha = null;
  async function ensureRecaptcha() {
    if (recaptcha) return recaptcha;
    recaptcha = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
    // ✅ важно отрендерить один раз
    await recaptcha.render();
    return recaptcha;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const firstName = byId("firstName")?.value.trim();
    const nick = byId("nick")?.value.trim();
    const email = byId("regEmail")?.value.trim();
    const pass = byId("regPass")?.value;
    const pass2 = byId("regPass2")?.value;

    const phoneRaw = byId("phoneIL")?.value;
    const tournament = byId("regTournament")?.value || "";

    if (!firstName || !nick || !email || !pass || !pass2 || !phoneRaw) {
      alert("Please fill all fields.");
      return;
    }
    if (pass !== pass2) {
      alert("Passwords do not match.");
      return;
    }

    const phoneCheck = normalizeILMobileToE164(phoneRaw);
    if (!phoneCheck.ok) {
      alert(phoneCheck.reason);
      byId("phoneIL")?.focus();
      return;
    }

    try {
      // 1) создаём email/password аккаунт
      const cred = await createUserWithEmailAndPassword(auth, email, pass);

      profileDraft = {
        firstName,
        nick,
        email,
        phone: phoneCheck.e164,
        tournament,
        paymentStatus: "UNPAID",
      };

      // 2) показываем SMS блок
      show(phoneVerifyBox);

      alert("Account created. Now confirm your phone via SMS.");

      // ⚠️ НЕ отправляем SMS автоматически — ты сам жмёшь "Send SMS"
      // но можно включить автосенд, если хочешь.

    } catch (err) {
      console.error("REGISTER ERROR:", err);
      alert(err?.message || "Registration error");
    }
  });

  // SEND SMS (привязка телефона к текущему пользователю)
  smsSendBtn?.addEventListener("click", async () => {
    try {
      const phoneRaw = byId("phoneIL")?.value;
      const phoneCheck = normalizeILMobileToE164(phoneRaw);
      if (!phoneCheck.ok) {
        alert(phoneCheck.reason);
        return;
      }

      const u = auth.currentUser;
      if (!u) {
        alert("No active user session. Please register again.");
        return;
      }

      console.log("SENDING SMS TO:", phoneCheck.e164);

      await ensureRecaptcha();

      // ✅ ВАЖНО: linkWithPhoneNumber вместо signInWithPhoneNumber
      confirmationResult = await linkWithPhoneNumber(u, phoneCheck.e164, recaptcha);

      alert("SMS sent. Enter the code.");

    } catch (err) {
      console.error("SMS SEND ERROR:", err);
      alert(err?.message || "SMS send error");
    }
  });

  // VERIFY SMS + SAVE PROFILE
  smsVerifyBtn?.addEventListener("click", async () => {
    try {
      if (!confirmationResult) {
        alert("First click 'Send SMS'.");
        return;
      }

      const code = String(smsCodeInput?.value || "").trim();
      if (!/^\d{4,8}$/.test(code)) {
        alert("Enter the SMS code.");
        return;
      }

      await confirmationResult.confirm(code);

      const u = auth.currentUser;
      if (!u) {
        alert("No active session. Please log in again.");
        window.location.href = "login.html";
        return;
      }

      await setDoc(doc(db, "users", u.uid), {
        name: profileDraft?.firstName || "",
        nick: profileDraft?.nick || "",
        email: u.email || profileDraft?.email || "",
        phone: profileDraft?.phone || "",
        tournament: profileDraft?.tournament || "",
        paymentStatus: "UNPAID",
        createdAt: serverTimestamp(),
        phoneVerified: true,
      }, { merge: true });

      window.location.href = "dashboard.html";

    } catch (err) {
      console.error("SMS VERIFY ERROR:", err);
      alert(err?.message || "SMS verify error");
    }
  });
})();

/* ---------------------------
   LOGIN (login.html)
--------------------------- */
(async function initLogin() {
  const form = qs("[data-login-form]");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = byId("loginEmail")?.value.trim();
    const pass = byId("loginPass")?.value;

    if (!email || !pass) {
      alert("Enter email and password.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      alert(err?.message || "Login error");
    }
  });
})();

/* ---------------------------
   DASHBOARD (dashboard.html)
--------------------------- */
(function initDashboard() {
  const nickEl = byId("uNick");
  if (!nickEl) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};

    setText("uNick", data.nick || "Player");
    setText("uName", data.name || "—");
    setText("uNickname", data.nick || "—");
    setText("uEmail", user.email || data.email || "—");
    setText("uPhone", data.phone || "—");
    setText("uTournament", data.tournament || "—");
  });

  const logout = async () => {
    await signOut(auth);
    window.location.href = "login.html";
  };

  byId("logoutBtn")?.addEventListener("click", logout);
  byId("logoutBtnMobile")?.addEventListener("click", logout);
})();
