(function () {
  const root = document.documentElement;
  const burger = document.querySelector(".burger");
  const menu = document.getElementById("mobileMenu");
  const closeBtn = document.querySelector(".mobile-close");

  if (!burger || !menu || !closeBtn) return;

  function openMenu() {
    root.classList.add("is-menu-open");
    document.body.classList.add("no-scroll");
    burger.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-hidden", "false");
  }

  function closeMenu() {
    root.classList.remove("is-menu-open");
    document.body.classList.remove("no-scroll");
    burger.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-hidden", "true");
  }

  burger.addEventListener("click", () => {
    root.classList.contains("is-menu-open") ? closeMenu() : openMenu();
  });

  closeBtn.addEventListener("click", closeMenu);

  // click outside panel closes menu
  menu.addEventListener("click", (e) => {
    const panel = menu.querySelector(".mobile-menu__panel");
    if (!panel) return;
    if (!panel.contains(e.target)) closeMenu();
  });

  // close on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("is-menu-open")) {
      closeMenu();
    }
  });

  // close on link click
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
})();
