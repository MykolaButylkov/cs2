(() => {
  // 1) UNSPLASH-like images (без API-ключа, просто source)
  const imgs = document.querySelectorAll("[data-unsplash]");
  imgs.forEach((el) => {
    const q = encodeURIComponent(el.dataset.unsplash || "esports");
    // random + sig чтобы были разные картинки
    const sig = Math.floor(Math.random() * 10000);
    el.style.backgroundImage =
      `url("https://source.unsplash.com/900x700/?${q}&sig=${sig}")`;
  });

  // 2) Counters
  const nums = document.querySelectorAll("[data-count]");
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function animateCounters() {
    nums.forEach((el) => {
      const target = Number(el.dataset.count || 0);
      const start = 0;
      const dur = 900;
      const t0 = performance.now();

      function tick(now) {
        const p = Math.min(1, (now - t0) / dur);
        const v = Math.round(start + (target - start) * easeOut(p));
        el.textContent = String(v);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  // 3) Neon particles canvas
  const canvas = document.getElementById("fxCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let particles = [];
  let lines = [];

  function resize() {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.floor((w * h) / 22000);
    particles = new Array(Math.max(28, Math.min(90, count))).fill(0).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1 + Math.random() * 2.4,
      vx: (-0.35 + Math.random() * 0.7),
      vy: (-0.25 + Math.random() * 0.5),
      a: 0.20 + Math.random() * 0.35
    }));

    lines = new Array(7).fill(0).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0.6 + Math.random() * 1.2,
      vy: 0.2 + Math.random() * 0.6,
      len: 220 + Math.random() * 240,
      a: 0.08 + Math.random() * 0.10
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    // soft vignette
    const g = ctx.createRadialGradient(w * 0.35, h * 0.25, 40, w * 0.5, h * 0.5, Math.max(w, h));
    g.addColorStop(0, "rgba(139,92,246,0.10)");
    g.addColorStop(0.35, "rgba(245,158,11,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0.0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // neon lines
    ctx.lineWidth = 1;
    lines.forEach((ln) => {
      ln.x += ln.vx; ln.y += ln.vy;
      if (ln.x - ln.len > w) ln.x = -40;
      if (ln.y > h + 60) ln.y = -60;

      ctx.strokeStyle = `rgba(139,92,246,${ln.a})`;
      ctx.beginPath();
      ctx.moveTo(ln.x, ln.y);
      ctx.lineTo(ln.x - ln.len, ln.y + ln.len * 0.12);
      ctx.stroke();

      ctx.strokeStyle = `rgba(245,158,11,${ln.a * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(ln.x, ln.y + 16);
      ctx.lineTo(ln.x - ln.len * 0.75, ln.y + 16 + ln.len * 0.10);
      ctx.stroke();
    });

    // particles
    particles.forEach((p) => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;

      ctx.fillStyle = `rgba(255,255,255,${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // subtle connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          const alpha = (1 - dist / 110) * 0.08;
          ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(step);
  }

  // Run
  resize();
  window.addEventListener("resize", resize);

  // Counters when visible
  const hero = document.querySelector(".about-hero");
  if ("IntersectionObserver" in window && hero) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        animateCounters();
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(hero);
  } else {
    animateCounters();
  }

  requestAnimationFrame(step);
})();
