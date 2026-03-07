const STORAGE_KEY = "privacyConsentAccepted";

document.addEventListener("DOMContentLoaded", () => {

  const popup = document.getElementById("privacyConsentPopup");
  const acceptBtn = document.getElementById("privacyAcceptBtn");
  const closeBtn = document.getElementById("privacyCloseBtn");

  if (!popup) return;

  const accepted = localStorage.getItem(STORAGE_KEY);

  if (!accepted) {
    popup.classList.remove("hidden");
  }

  acceptBtn?.addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY,"yes");
    popup.classList.add("hidden");
  });

  closeBtn?.addEventListener("click", () => {
    popup.classList.add("hidden");
  });

});