/* Plain-JS versions of React Bits components (reactbits.dev), written for Peaksnip's no-build pages:
     DotGrid        a field of dots that light up emerald and lean away from the pointer (hero backgrounds)
     Spotlight      a soft emerald glow that follows the pointer across cards and tiles
     CountUp        numbers count up when they first appear or change
     ClickSpark     short emerald sparks where a primary button is clicked
     ShinyText      a light sweep across text (CSS only: class "shiny", styled on each page)
     ThemeToggle    a button that switches between the dark and light theme
   Everything respects "reduce motion": the effects then stay still. */
(function () {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

  /* ---------------------------------------------------------------- DotGrid */
  function DotGrid(host, opts) {
    const o = Object.assign({gap: 24, size: 1.6, base: "", active: "#3ecf8e", radius: 150, push: 8}, opts || {});
    const B = rgb(o.active);
    const baseColour = () => o.base || getComputedStyle(host).getPropertyValue("--dot").trim() || "#d4d4d4";
    const c = document.createElement("canvas");
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    host.appendChild(c);
    const ctx = c.getContext("2d");
    let w = 0, h = 0, dots = [], mx = -1e4, my = -1e4, raf = 0, visible = true;

    function layout() {
      const r = host.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      w = r.width; h = r.height;
      c.width = Math.max(1, w * dpr); c.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.max(1, Math.floor(w / o.gap)), rows = Math.max(1, Math.floor(h / o.gap));
      const ox = (w - (cols - 1) * o.gap) / 2, oy = (h - (rows - 1) * o.gap) / 2;
      dots = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) dots.push({x: ox + x * o.gap, y: oy + y * o.gap, dx: 0, dy: 0});
      kick();
    }
    function draw() {
      raf = 0;
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      let moving = false;
      const base = baseColour(), A = rgb(base.length === 4 ? "#" + [...base.slice(1)].map(c => c + c).join("") : base);
      ctx.fillStyle = base;
      ctx.beginPath();
      const lit = [];
      for (const d of dots) {
        const ex = d.x - mx, ey = d.y - my, dist = Math.hypot(ex, ey);
        let t = 0, tx = 0, ty = 0;
        if (dist < o.radius) {
          t = 1 - dist / o.radius;
          if (!still) { const f = t * t * o.push / (dist || 1); tx = ex * f; ty = ey * f; }
        }
        d.dx += (tx - d.dx) * .2; d.dy += (ty - d.dy) * .2;
        if (Math.abs(tx - d.dx) > .05 || Math.abs(ty - d.dy) > .05) moving = true;
        if (t > 0) { lit.push([d, t]); continue; }
        ctx.moveTo(d.x + d.dx + o.size, d.y + d.dy);
        ctx.arc(d.x + d.dx, d.y + d.dy, o.size, 0, 6.2832);
      }
      ctx.fill();
      for (const [d, t] of lit) {
        ctx.fillStyle = `rgb(${A.map((a, i) => Math.round(a + (B[i] - a) * t)).join(",")})`;
        ctx.beginPath();
        ctx.arc(d.x + d.dx, d.y + d.dy, o.size * (1 + t * .7), 0, 6.2832);
        ctx.fill();
      }
      if (moving) raf = requestAnimationFrame(draw);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(draw); }
    function move(e) {
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const near = x > -o.radius && y > -o.radius && x < r.width + o.radius && y < r.height + o.radius;
      if (!near && mx < -1e3) return;
      mx = near ? x : -1e4; my = near ? y : -1e4;
      kick();
    }
    const ro = new ResizeObserver(layout); ro.observe(host);
    const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }); io.observe(host);
    addEventListener("peakcut:theme", kick);
    addEventListener("pointermove", move, {passive: true});
    layout();
    return function stop() {
      ro.disconnect(); io.disconnect(); removeEventListener("pointermove", move); cancelAnimationFrame(raf); c.remove();
    };
  }

  /* ---------------------------------------------------------------- Spotlight */
  // Any element matching the selector gets --mx/--my (pointer position) and --so (0 or 1) while hovered.
  function Spotlight(selector) {
    let last = null;
    addEventListener("pointermove", e => {
      const el = e.target instanceof Element ? e.target.closest(selector) : null;
      if (last && last !== el) { last.style.setProperty("--so", "0"); last.style.setProperty("--px", "0"); last.style.setProperty("--py", "0"); }
      last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
      el.style.setProperty("--so", "1");
      if (!still) { el.style.setProperty("--px", ((e.clientX - r.left) / r.width - .5).toFixed(3)); el.style.setProperty("--py", ((e.clientY - r.top) / r.height - .5).toFixed(3)); }
    }, {passive: true});
  }

  /* ---------------------------------------------------------------- CountUp */
  // Numbers in elements matching the selector count up from their last shown value (or 0) to the new one.
  // Pages re-render with innerHTML, so the last value is remembered by the label next to the number.
  function CountUp(selector, keyOf) {
    const seen = new Map();
    const NUM = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s;
    function run(el) {
      if (el.dataset.cu) return;
      el.dataset.cu = "1";
      const m = NUM.exec(el.textContent.trim());
      if (!m || el.children.length) return;
      const key = keyOf(el), to = parseFloat(m[2].replace(/,/g, "")), dec = (m[2].split(".")[1] || "").length;
      const from = seen.has(key) ? seen.get(key) : 0;
      seen.set(key, to);
      if (still || from === to || !isFinite(to)) return;
      const fmt = v => m[1] + v.toLocaleString(undefined, {minimumFractionDigits: dec, maximumFractionDigits: dec}) + m[3];
      const t0 = performance.now(), dur = Math.min(1100, 450 + Math.abs(to - from) * 40);
      const step = now => {
        if (!el.isConnected) return;
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(step);
      };
      el.textContent = fmt(from);
      requestAnimationFrame(step);
    }
    const scan = root => { if (root.querySelectorAll) root.querySelectorAll(selector).forEach(run); };
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches(selector)) run(n); else scan(n);
    }))).observe(document.body, {childList: true, subtree: true});
    scan(document);
  }

  /* ---------------------------------------------------------------- ClickSpark */
  function ClickSpark(selector, opts) {
    const o = Object.assign({color: "#3ecf8e", count: 8, size: 10, radius: 18, life: 420}, opts || {});
    if (still) return;
    let c = null, ctx = null, sparks = [], raf = 0;
    function ensure() {
      if (c) return;
      c = document.createElement("canvas");
      c.setAttribute("aria-hidden", "true");
      c.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000";
      document.body.appendChild(c);
      ctx = c.getContext("2d");
    }
    function size() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function frame(now) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      sparks = sparks.filter(s => now - s.t < o.life);
      ctx.strokeStyle = o.color; ctx.lineWidth = 2; ctx.lineCap = "round";
      for (const s of sparks) {
        const p = (now - s.t) / o.life, e = p * (2 - p), d = e * o.radius, len = o.size * (1 - e);
        ctx.beginPath();
        ctx.moveTo(s.x + d * Math.cos(s.a), s.y + d * Math.sin(s.a));
        ctx.lineTo(s.x + (d + len) * Math.cos(s.a), s.y + (d + len) * Math.sin(s.a));
        ctx.stroke();
      }
      raf = sparks.length ? requestAnimationFrame(frame) : 0;
    }
    addEventListener("pointerdown", e => {
      if (!(e.target instanceof Element) || !e.target.closest(selector)) return;
      ensure(); size();
      const t = performance.now();
      for (let i = 0; i < o.count; i++) sparks.push({x: e.clientX, y: e.clientY, a: (2 * Math.PI * i) / o.count, t});
      if (!raf) raf = requestAnimationFrame(frame);
    }, {passive: true});
  }

  /* ---------------------------------------------------------------- ThemeToggle */
  // Buttons matching the selector switch <html data-theme> between dark and light, remembered in this browser.
  function ThemeToggle(selector) {
    const html = document.documentElement;
    const label = () => document.querySelectorAll(selector).forEach(b =>
      b.setAttribute("aria-label", html.dataset.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"));
    document.addEventListener("click", e => {
      if (!(e.target instanceof Element) || !e.target.closest(selector)) return;
      html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem("peakcut_theme", html.dataset.theme); } catch {}
      label();
      dispatchEvent(new Event("peakcut:theme"));
    });
    label();
  }

  window.Bits = {DotGrid, Spotlight, CountUp, ClickSpark, ThemeToggle};
})();
