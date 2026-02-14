const phoneInput = document.getElementById("phoneIL");
const phoneFull = document.getElementById("phoneFull");

function fillPhoneFull() {
  if (!phoneInput || !phoneFull) return;

  // Оставляем только цифры
  let digits = phoneInput.value.replace(/\D/g, "");

  // Ограничиваем длину (10 цифр максимум)
  if (digits.length > 10) digits = digits.slice(0, 10);

  phoneInput.value = digits;

  // Если начинается с 0 — убираем его
  if (digits.startsWith("0")) digits = digits.substring(1);

  // Записываем международный формат (может быть пусто, если digits пустые)
  phoneFull.value = digits ? "+972" + digits : "";
}

if (phoneInput && phoneFull) {
  phoneInput.addEventListener("input", fillPhoneFull);
  phoneInput.addEventListener("change", fillPhoneFull);
  // на случай автозаполнения/вставки при загрузке
  window.addEventListener("load", fillPhoneFull);
}


/* =============================
   CS2 AUTH MVP (NO SERVER)
   - register -> saves user
   - login -> checks email+password
   - dashboard -> shows profile
   ============================= */

const LS_USERS = "cs2_users";       // массив пользователей
const LS_SESSION = "cs2_session";   // текущий userId

function readJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function getUsers(){ return readJSON(LS_USERS, []); }
function setUsers(users){ writeJSON(LS_USERS, users); }

function setSession(userId){ localStorage.setItem(LS_SESSION, userId); }
function getSession(){ return localStorage.getItem(LS_SESSION); }
function clearSession(){ localStorage.removeItem(LS_SESSION); }

function findUserByEmail(email){
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}
function findUserById(id){
  return getUsers().find(u => u.id === id);
}

// MVP hashing (не безопасность, просто чтобы НЕ хранить пароль "в лоб")
// Позже заменим на сервер + bcrypt/Firebase Auth
async function hashPassword(pw){
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

function formatILPhoneToE164(raw){
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  return "+972" + digits;
}

/* ===== Register page ===== */
(async function initRegister(){
  const form = document.querySelector("[data-register-form]");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ✅ под твою форму:
    const name = document.getElementById("firstName")?.value.trim(); // было regName
    const nick = document.getElementById("nick")?.value.trim();      // было regNick
    const email = document.getElementById("regEmail")?.value.trim();
    const pass = document.getElementById("regPass")?.value;
    const pass2 = document.getElementById("regPass2")?.value;

    // телефон: предпочитаем скрытое поле +972..., но подстрахуемся
    const phoneHidden = document.getElementById("phoneFull")?.value?.trim();
    const phoneRaw = document.getElementById("phoneIL")?.value;

    const tournament = document.getElementById("regTournament")?.value; // добавлено в register.html

    // если phoneFull не заполнен (например, не было input события) — соберём вручную
    const phone = phoneHidden || formatILPhoneToE164(phoneRaw);

    if (!name || !nick || !email || !pass || !pass2 || !phone || !tournament){
      alert("Please fill all fields.");
      return;
    }
    if (pass !== pass2){
      alert("Passwords do not match.");
      return;
    }
    if (findUserByEmail(email)){
      alert("Email already registered. Please log in.");
      window.location.href = "login.html";
      return;
    }

    const passwordHash = await hashPassword(pass);

    const user = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      nick,
      email,
      phone,
      tournament,
      createdAt: new Date().toISOString(),
      passwordHash,
      paymentStatus: "UNPAID" // later
    };

    const users = getUsers();
    users.push(user);
    setUsers(users);

    setSession(user.id);
    window.location.href = "dashboard.html";
  });
})();

/* ===== Login page ===== */
(async function initLogin(){
  const form = document.querySelector("[data-login-form]");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail")?.value.trim();
    const pass = document.getElementById("loginPass")?.value;

    if (!email || !pass){
      alert("Enter email and password.");
      return;
    }

    const user = findUserByEmail(email);
    if (!user){
      alert("User not found. Please register.");
      window.location.href = "register.html";
      return;
    }

    const passwordHash = await hashPassword(pass);
    if (passwordHash !== user.passwordHash){
      alert("Wrong password.");
      return;
    }

    setSession(user.id);
    window.location.href = "dashboard.html";
  });
})();

/* ===== Dashboard page ===== */
(function initDashboard(){
  const nickEl = document.getElementById("uNick");
  if (!nickEl) return;

  const sessionId = getSession();
  if (!sessionId){
    window.location.href = "login.html";
    return;
  }

  const user = findUserById(sessionId);
  if (!user){
    clearSession();
    window.location.href = "login.html";
    return;
  }

  document.getElementById("uName").textContent = user.name;
  document.getElementById("uNickname").textContent = user.nick;
  document.getElementById("uEmail").textContent = user.email;
  document.getElementById("uPhone").textContent = user.phone;
  document.getElementById("uTournament").textContent = user.tournament;
  nickEl.textContent = user.nick;

  const logout = () => {
    clearSession();
    window.location.href = "login.html";
  };
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("logoutBtnMobile")?.addEventListener("click", logout);
})();
