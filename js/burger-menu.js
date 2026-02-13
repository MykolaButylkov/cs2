  const burger = document.querySelector('.burger');
  const menu = document.querySelector('#mobileMenu');

  if (burger && menu) {
    burger.addEventListener('click', () => {
      const isOpen = burger.classList.toggle('open');
      menu.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
    });

    // Закрывать меню при клике на ссылку
    menu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        burger.classList.remove('open');
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });

    // Закрывать при клике вне меню
    document.addEventListener('click', (e) => {
      const clickedInside = menu.contains(e.target) || burger.contains(e.target);
      if (!clickedInside) {
        burger.classList.remove('open');
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }
