(() => {
  "use strict";

  const canvases = Array.from(document.querySelectorAll("canvas.fx-canvas"));
  if (!canvases.length) return;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function createFx(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    let w = 0, h = 0;
    let dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    let particles = [];
    let lines = [];
    let raf = 0;

    function rebuild() {
      // берём реальные размеры элемента
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));

      dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // плотность частиц
      const count = Math.floor((w * h) / 22000);
      const pCount = clamp(count, 28, 90);

      particles = new Array(pCount).fill(0).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2.4,
        vx: (-0.35 + Math.random() * 0.7),
        vy: (-0.25 + Math.random() * 0.5),
        a: 0.20 + Math.random() * 0.35,
      }));

      lines = new Array(7).fill(0).map(() => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0.6 + Math.random() * 1.2,
        vy: 0.2 + Math.random() * 0.6,
        len: 220 + Math.random() * 240,
        a: 0.08 + Math.random() * 0.10,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // мягкая “дымка”
      const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.7);
      g.addColorStop(0, "rgba(120, 70, 255, 0.06)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // линии
      for (const l of lines) {
        l.x += l.vx;
        l.y += l.vy;

        if (l.x > w + l.len) l.x = -l.len;
        if (l.y > h + l.len) l.y = -l.len;

        ctx.save();
        ctx.globalAlpha = l.a;
        ctx.lineWidth = 1.2;

        // “неон” градиент линии
        const lg = ctx.createLinearGradient(l.x, l.y, l.x + l.len, l.y + l.len * 0.25);
        lg.addColorStop(0, "rgba(255, 217, 138, 0)");
        lg.addColorStop(0.5, "rgba(255, 217, 138, 0.9)");
        lg.addColorStop(1, "rgba(160, 90, 255, 0)");
        ctx.strokeStyle = lg;

        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x + l.len, l.y + l.len * 0.25);
        ctx.stroke();
        ctx.restore();
      }

      // частицы
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        ctx.save();
        ctx.globalAlpha = p.a;

        const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        rg.addColorStop(0, "rgba(255, 217, 138, 0.9)");
        rg.addColorStop(0.55, "rgba(160, 90, 255, 0.35)");
        rg.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    // public
    return {
      start() {
        cancelAnimationFrame(raf);
        rebuild();
        draw();
      },
      stop() {
        cancelAnimationFrame(raf);
      },
      resize() {
        rebuild();
      },
    };
  }

  // init all
  const engines = canvases.map(createFx).filter(Boolean);

  // resize observer — точечно на каждый canvas
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const canvas = e.target;
      const idx = canvases.indexOf(canvas);
      const eng = engines[idx];
      if (eng) eng.resize();
    }
  });

  canvases.forEach((c) => ro.observe(c));
  engines.forEach((e) => e.start());

  // если меняется DPR/окно
  window.addEventListener("resize", () => engines.forEach((e) => e.resize()), { passive: true });
})();
