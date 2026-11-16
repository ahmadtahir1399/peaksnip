/* Peaksnip film: the landing page's scroll-driven 3D scene, built from ordinary page elements in CSS 3D.
   It is a video editor's timeline floating in space: stream frames with timestamps above and the audio waveform
   below, and a playhead. Scrolling plays four chapters:
     1 record  new frames appear at a red LIVE playhead
     2 find    a playhead sweeps the timeline; the loud stretches turn emerald and are selected as clips
     3 cut     each selected stretch lifts off the timeline and becomes a vertical 9:16 clip
     4 post    the clips show their captions and are posted to Shorts, Reels and TikTok
   Usage: PeakFilm.start(hostElement, {progress: () => 0..4.6}). Styles are in landing.html (classes f-*, cphone). */
(function () {
  "use strict";
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };

  const NF = 28, W = 168, H = 95, G = 10, STEP = W + G, PER = 8, BAR = STEP / PER;
  const START = 2 * 3600 + 13 * 60 + 20;                       // the timeline starts 2:13:20 into the stream
  const time = s => `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(Math.floor(s) % 60).padStart(2, "0")}`;
  const CLIPS = [
    {a: 6, n: 3, score: 94, len: "0:41", style: "bounce", plat: "Shorts"},
    {a: 13, n: 3, score: 91, len: "0:28", style: "hype", plat: "Reels"},
    {a: 20, n: 3, score: 88, len: "0:52", style: "clean", plat: "TikTok"}
  ];
  const CHECK = '<svg viewBox="0 0 256 256" aria-hidden="true"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/></svg>';

  // loudness of each waveform bar: a quiet bed with three loud stretches where the clips are
  const AMP = Array.from({length: NF * PER}, (_, b) => {
    const f = b / PER;
    let v = .12 + .22 * hash(b) * (.6 + .4 * Math.sin(b * .21));
    for (const c of CLIPS) v += .78 * Math.exp(-(((f - (c.a + c.n / 2)) / 1.05) ** 2));
    v += .28 * Math.exp(-(((f - 25) / .7) ** 2)) + .22 * Math.exp(-(((f - 2.5) / .6) ** 2));   // loud but not kept
    return clamp(v, .06, 1);
  });
  const inClip = f => CLIPS.findIndex(c => f >= c.a && f < c.a + c.n);

  /* a stream frame: the scene, a lit player, chat down the side and the streamer's webcam */
  const frameArt = '<i class="s"></i><i class="p"></i><i class="chat"></i><i class="cam"></i>';
  const scene = (v, cls) => `<div class="f-frame v${v} ${cls || ""}">${frameArt}</div>`;

  /* caption previews: a phone in Peaksnip's blurred-fill layout, captions lighting up word by word in the same
     fonts and colours the renderer uses (studio/render.py STYLES) */
  const STY = {
    bounce: {words: "no way he actually hit that shot".split(" "), per: 3, upper: true, hook: "Wait for it", scene: 1},
    hype: {words: "chat completely lost it".split(" "), per: 2, upper: true, strong: ["lost"], hook: "Chat lost it", scene: 3},
    clean: {words: "i never said that and you know it".split(" "), per: 4, upper: false, hook: "Honest answer", scene: 0}
  };
  const phone = style => { const s = STY[style];
    return `<div class="cphone" data-style="${style}">${scene(s.scene, "bgf")}${scene(s.scene, "mid")}<span class="hook">${s.hook}</span><div class="cap"></div></div>`; };
  function captions(root) {
    (root || document).querySelectorAll(".cphone").forEach(el => {
      if (el._cap) return;
      el._cap = true;
      const s = STY[el.dataset.style], cap = el.querySelector(".cap");
      let i = 0;
      const tick = () => {
        const from = Math.floor(i / s.per) * s.per;
        cap.innerHTML = s.words.slice(from, from + s.per).map((w, k) =>
          `<span class="${from + k === i ? "on" : ""}${(s.strong || []).includes(w) ? " st" : ""}">${s.upper ? w.toUpperCase() : w}</span>`).join(" ");
        i = (i + 1) % s.words.length;
      };
      tick();
      if (!still) setInterval(() => { if (!document.hidden) tick(); }, 430);
    });
  }

  // camera for each chapter: tilt down, turn, height of the timeline on screen, and which frame is centred
  const CAM = [
    {rx: 14, ry: -30, y: .78, at: 12},
    {rx: 10, ry: -38, y: .4, at: 20},
    {rx: 16, ry: -20, y: .36, at: 14.5},
    {rx: 18, ry: -20, y: .4, at: 14.5},
    {rx: 22, ry: -20, y: .86, at: 14.5}
  ];

  function start(host, opts) {
    host.classList.add("f-scene");
    host.innerHTML = `<div class="f-cam"><div class="f-track"></div></div><div class="f-front"></div>`;
    const cam = host.querySelector(".f-cam"), track = host.querySelector(".f-track"), front = host.querySelector(".f-front");

    // the timeline: ruler, frames, waveform, selections, playhead
    let html = "";
    for (let i = 0; i < NF; i++) {
      html += `<div class="f-tick" style="left:${i * STEP}px">${time(START + i * 15)}</div>`;
      html += `<div class="f-frame v${i % 4}" style="left:${i * STEP}px" data-i="${i}">${frameArt}</div>`;
    }
    AMP.forEach((a, b) => { html += `<i class="f-bar" style="left:${(b * BAR).toFixed(1)}px;height:${(a * 64).toFixed(1)}px"></i>`; });
    CLIPS.forEach((c, n) => {
      html += `<div class="f-sel" style="left:${c.a * STEP - 5}px;width:${c.n * STEP - G + 10}px"><span>clip 0${n + 1} · score ${c.score} · ${c.len}</span></div>`;
      html += `<div class="f-seg" style="left:${c.a * STEP}px;width:${c.n * STEP - G}px"></div>`;
    });
    html += `<div class="f-head"><span></span></div>`;
    track.innerHTML = html;
    const frames = [...track.querySelectorAll(".f-frame")], ticks = [...track.querySelectorAll(".f-tick")];
    const bars = [...track.querySelectorAll(".f-bar")], sels = [...track.querySelectorAll(".f-sel")], segs = [...track.querySelectorAll(".f-seg")];
    const head = track.querySelector(".f-head"), headLbl = head.querySelector("span");

    // the clips in front: they start as copies of their frames and turn into captioned phones
    front.innerHTML = CLIPS.map(c => `<div class="f-clip">
        <div class="strip">${Array.from({length: c.n}, (_, k) => scene((c.a + k) % 4)).join("")}</div>
        ${phone(c.style)}
        <span class="f-plat">${CHECK}Posted · ${c.plat}</span></div>`).join("");
    const clips = [...front.querySelectorAll(".f-clip")];
    const phones = clips.map(c => c.querySelector(".cphone")), strips = clips.map(c => c.querySelector(".strip")), plats = clips.map(c => c.querySelector(".f-plat"));

    let raf = 0, visible = true;
    const t0 = performance.now();
    function frame(now) {
      raf = 0;
      if (!visible) return;
      const t = still ? 0 : (now - t0) / 1000, P = clamp(opts.progress(), 0, 4.6);
      const hw = host.clientWidth, hh = host.clientHeight, narrow = hw < 760;

      // camera: rests at each chapter, moves in the second half of it
      const i = Math.min(3, Math.floor(P)), f = P >= 4 ? 1 : ease(sstep(.45, 1, P - i)), A = CAM[i], B = CAM[i + 1];
      const shown = Math.round(18 + 10 * ease(sstep(.7, 1.45, P)));            // frames recorded so far
      const back = narrow ? 1.5 : 6;                                          // how far behind the live edge the camera looks
      const camAt = P < 1 ? mix(A.at, shown - back, f) : P < 2 ? mix(shown - back, B.at, f) : mix(A.at, B.at, f);
      const sc = clamp(hw / 1400, .5, 1.1);
      let camY = mix(A.y, B.y, f);
      if (narrow) camY = mix(camY, .3, sstep(.3, .8, P) * (1 - sstep(3.6, 4, P)));   // on phones the text is at the bottom, so the timeline goes up
      const drift = still ? 0 : Math.sin(t * .25) * 2.5 * (1 - sstep(0, .6, P));     // a slow sway while the hero is on screen
      cam.style.transform = `translate3d(${hw / 2}px,${(camY * hh).toFixed(1)}px,0) scale(${sc.toFixed(3)}) rotateX(${mix(A.rx, B.rx, f).toFixed(2)}deg) rotateY(${(mix(A.ry, B.ry, f) + drift).toFixed(2)}deg)`;
      track.style.transform = `translate3d(${(-(camAt * STEP + W / 2)).toFixed(1)}px,${-H / 2}px,0)`;
      track.style.opacity = (1 - .75 * sstep(3.6, 4.05, P)).toFixed(3);

      // recording: frames after the live edge do not exist yet
      frames.forEach((el, n) => { const on = n < shown; el.classList.toggle("off", !on); ticks[n].classList.toggle("off", !on); });

      // the playhead: watching in the hero, live while recording, scanning while finding
      const live = sstep(.6, .85, P) * (1 - sstep(1.55, 1.75, P));
      const scan = sstep(1.7, 2.5, P);
      let hx;
      if (P < 1.6) hx = live > .5 ? shown * STEP - G / 2 : ((t * .45) % 12 + 6) * STEP;
      else hx = mix(0, NF * STEP, scan);
      head.style.transform = `translateX(${hx.toFixed(1)}px)`;
      head.classList.toggle("live", live > .5);
      head.style.opacity = (1 - sstep(2.5, 2.7, P)).toFixed(3);
      headLbl.textContent = live > .5 ? `LIVE ${time(START + shown * 15)}` : time(START + hx / STEP * 15);

      // finding: bars the scan has passed light up when they belong to a clip; the clip gets selected
      const scanned = P >= 2.5 ? Infinity : P >= 1.7 ? hx / BAR : -1;
      bars.forEach((el, b) => {
        const fi = b / PER, k = inClip(fi);
        el.classList.toggle("off", fi >= shown);
        el.classList.toggle("hot", k >= 0 && b <= scanned);
        el.classList.toggle("near", P < 1.6 && Math.abs(b * BAR - hx) < BAR * 1.5);
      });
      CLIPS.forEach((c, n) => {
        const selOn = (c.a + c.n) * PER <= scanned ? 1 : 0;
        const lift = ease(sstep(2.85 + n * .08, 3.35 + n * .08, P));
        sels[n].style.opacity = (selOn * (1 - sstep(.2, .6, lift))).toFixed(3);
        for (let k = 0; k < c.n; k++) {
          frames[c.a + k].classList.toggle("picked", selOn > 0);
          frames[c.a + k].style.opacity = (1 - sstep(.05, .4, lift)).toFixed(3);
        }

        // the clip in front: from the selected frames' place on screen to a phone
        const el = clips[n];
        if (lift <= .001) { el.style.opacity = 0; el.style.visibility = "hidden"; return; }
        el.style.visibility = "visible";
        const host0 = host.getBoundingClientRect(), r = segs[n].getBoundingClientRect();
        const from = {x: r.left - host0.left, y: r.top - host0.top, w: r.width, h: r.height};
        const post = ease(sstep(3.7 + n * .1, 4.15 + n * .1, P));
        const ph = Math.min(hh * (narrow ? .38 : .52), 420) * mix(1, 1.06, post), pw = ph * 9 / 16, gap = narrow ? 10 : 26;
        const cx = hw * (narrow ? .5 : .63), cy = hh * (narrow ? .36 : .47);
        const to = {x: cx + (n - 1) * (pw + gap) - pw / 2, y: cy - ph / 2 + Math.abs(n - 1) * 14 * post, w: pw, h: ph};
        const x = mix(from.x, to.x, lift), y = mix(from.y, to.y, lift) - Math.sin(Math.PI * lift) * 40;
        el.style.opacity = sstep(0, .15, lift).toFixed(3);
        el.style.width = mix(from.w, to.w, lift).toFixed(1) + "px";
        el.style.height = mix(from.h, to.h, lift).toFixed(1) + "px";
        el.style.borderRadius = mix(4, 16, lift).toFixed(1) + "px";
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotateY(${mix(-18, (n - 1) * -7 * post, lift).toFixed(2)}deg)`;
        strips[n].style.opacity = (1 - sstep(.35, .75, lift)).toFixed(3);
        phones[n].style.opacity = sstep(.45, .85, lift).toFixed(3);
        plats[n].style.opacity = post.toFixed(3);
        plats[n].style.transform = `translate(-50%,${mix(8, 0, post).toFixed(1)}px)`;
      });

      if (!still) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(host);
    addEventListener("scroll", kick, {passive: true});
    addEventListener("resize", kick);
    captions(front);
    kick();
    return true;
  }

  window.PeakFilm = {start, phone, captions};
})();
