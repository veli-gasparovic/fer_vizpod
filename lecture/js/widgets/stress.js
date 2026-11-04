/* stress: SVG vs Canvas with the same d3 scales.
   Each panel can run on its own so its frame rate is measured honestly
   (in "both" mode they share one frame budget).                               */
(function () {
  Deck.css("stress", `
    .st { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 0.7rem; height: 100%; }
    .st-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; min-height: 0; }
    .st-panel { position: relative; border: 1px solid var(--rule); border-radius: 0.55rem; overflow: hidden; background: var(--surface); min-height: 0; }
    .st-panel.idle { opacity: 0.55; }
    .st-panel svg, .st-panel canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .st-hud { position: absolute; left: 0.6rem; top: 0.5rem; z-index: 2; font: 0.58rem/1.4 var(--font-mono); color: var(--ink-2); background: color-mix(in srgb, var(--surface) 85%, transparent); padding: 0.25rem 0.5rem; border-radius: 0.3rem; pointer-events: none; }
    .st-hud b { font: 700 1.1rem var(--font-mono); color: var(--ink); display: block; }
    .st-hud .bad { color: var(--exit); }
    .st-name { position: absolute; right: 0.6rem; top: 0.5rem; z-index: 2; font: 600 0.6rem var(--font-sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); pointer-events: none; }
    .st .controls label { display: inline-flex; align-items: center; gap: 0.45rem; }
    .st .controls input[type=range] { width: 12rem; }
    .st .nval { font: 700 0.75rem var(--font-mono); min-width: 4.5em; }
    .st table { border-collapse: collapse; width: 100%; font-size: 0.56rem; }
    .st th, .st td { text-align: left; padding: 0.22rem 0.5rem; border-bottom: 1px solid var(--rule); vertical-align: top; }
    .st th { font-weight: 600; color: var(--ink); }
    .st td:first-child { color: var(--muted); white-space: nowrap; }
    .st svg circle { fill: var(--accent-2); fill-opacity: 0.6; }
      .st *, .st *::before { font-variant-ligatures: none !important; font-feature-settings: "liga" 0, "calt" 0 !important; }
  `);

  const NS = [100, 500, 1000, 2000, 5000, 10000, 20000];

  Deck.widget("stress", {
    steps: 0,
    mount(el) {
      el.innerHTML = `
        <div class="st">
          <div class="controls">
            <label>points <input type="range" min="0" max="${NS.length - 1}" step="1" value="2"><span class="nval"></span></label>
            <span style="flex:1"></span>
            <span class="small muted">animate:</span>
            <button class="btn" data-m="svg">SVG</button>
            <button class="btn" data-m="canvas">Canvas</button>
            <button class="btn" data-m="both">both</button>
          </div>
          <div class="st-panels">
            <div class="st-panel" data-p="svg"><div class="st-name">SVG · ${"&lt;circle&gt;"} × N</div><div class="st-hud"></div><svg></svg></div>
            <div class="st-panel" data-p="canvas"><div class="st-name">Canvas 2D · one bitmap</div><div class="st-hud"></div><canvas></canvas></div>
          </div>
          <table>
            <tr><th></th><th>SVG (retained-mode, DOM)</th><th>Canvas 2D (immediate-mode)</th><th>WebGL / WebGPU (GPU)</th></tr>
            <tr><td>scale</td><td>hundreds to low thousands of elements</td><td>tens of thousands of marks</td><td>hundreds of thousands to millions</td></tr>
            <tr><td>crisp at any zoom</td><td>yes</td><td>only if you handle <code>devicePixelRatio</code></td><td>same as Canvas</td></tr>
            <tr><td>events per element</td><td>native: <code>.on("mouseover")</code></td><td>manual hit-testing (d3-quadtree, d3-delaunay)</td><td>manual picking</td></tr>
            <tr><td>CSS / devtools / a11y</td><td>yes; text nodes + ARIA</td><td>no; needs a parallel DOM</td><td>no; needs a parallel DOM</td></tr>
          </table>
        </div>`;
      const slider = el.querySelector('input[type=range]');
      const nval = el.querySelector(".nval");
      const pSvg = el.querySelector('[data-p="svg"]'), pCan = el.querySelector('[data-p="canvas"]');
      const svg = d3.select(pSvg).select("svg");
      const gSvg = svg.append("g");
      const canvas = pCan.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const hudSvg = pSvg.querySelector(".st-hud"), hudCan = pCan.querySelector(".st-hud");

      let W = 400, H = 300, dpr = 1;
      let fill = Deck.color("--accent-2") || "#2166ac"; // cached: reading CSS per frame would force a style flush
      let n = NS[2], mode = "both", pts = [], nodes = [], running = false, raf = 0;
      const stats = { svg: { fps: 0, ms: 0, last: 0, frames: 0, acc: 0, accMs: 0 }, canvas: { fps: 0, ms: 0, last: 0, frames: 0, acc: 0, accMs: 0 } };
      // same scales drive both renderers
      const x = d3.scaleLinear([-1, 1], [0, W]);
      const y = d3.scaleLinear([-1, 1], [0, H]);

      function measure() {
        const r = pSvg.getBoundingClientRect();
        if (r.width > 10) { W = r.width; H = r.height; }
        dpr = window.devicePixelRatio || 1;
        x.range([0, W]); y.range([0, H]);
        svg.attr("viewBox", `0 0 ${W} ${H}`);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      }

      function makePoints() {
        const rnd = d3.randomNormal.source(d3.randomLcg(42))(0, 0.35);
        pts = d3.range(n).map((i) => {
          const r = Math.min(0.95, Math.abs(rnd()) + 0.05);
          return { i, a: Math.random() * Math.PI * 2, r, s: (0.25 + Math.random() * 0.5) * (1.1 - r) * (i % 2 ? 1 : -1), x: 0, y: 0 };
        });
        nodes = gSvg.selectAll("circle").data(pts, (d) => d.i).join("circle").attr("r", n > 5000 ? 1.4 : 2.2).nodes();
        nval.textContent = d3.format(",")(n);
      }

      function stepPoints(t) {
        for (const p of pts) {
          const a = p.a + t * p.s;
          p.x = Math.cos(a) * p.r * 0.9;
          p.y = Math.sin(a) * p.r * 0.75 + Math.sin(a * 3 + p.i) * 0.02;
        }
      }
      function drawSvg() {
        for (let k = 0; k < nodes.length; k++) {
          const p = pts[k];
          nodes[k].setAttribute("cx", x(p.x));
          nodes[k].setAttribute("cy", y(p.y));
        }
      }
      function drawCanvas() {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = fill;
        ctx.globalAlpha = 0.6;
        const r = n > 5000 ? 1.4 : 2.2;
        // one fill per mark, like one <circle> per mark (so overlaps blend the same way)
        for (const p of pts) { ctx.beginPath(); ctx.arc(x(p.x), y(p.y), r, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }

      function hud(elH, s, active) {
        if (!active) { elH.innerHTML = s.fps ? `<b>${Math.round(s.fps)} fps</b>last measured` : `<b>—</b>paused`; return; }
        const bad = s.fps < 40 ? "bad" : "";
        elH.innerHTML = `<b class="${bad}">${Math.round(s.fps)} fps</b>${s.ms.toFixed(1)} ms JS / frame`;
      }

      let t0 = performance.now(), lastFrame = 0, lastHud = 0;
      function frame(now) {
        if (!running) return;
        raf = requestAnimationFrame(frame);
        const t = (now - t0) / 1000;
        stepPoints(t);
        const doSvg = mode !== "canvas", doCan = mode !== "svg";
        let a = performance.now();
        if (doSvg) drawSvg();
        let b = performance.now();
        if (doCan) drawCanvas();
        let c = performance.now();
        // frame interval = what the viewer actually sees (includes style/layout/paint)
        if (lastFrame) {
          const dt = now - lastFrame;
          for (const [k, on, ms] of [["svg", doSvg, b - a], ["canvas", doCan, c - b]]) {
            if (!on) continue;
            const s = stats[k];
            s.acc += dt; s.accMs += ms; s.frames++;
          }
        }
        lastFrame = now;
        if (now - lastHud > 400) {
          for (const k of ["svg", "canvas"]) {
            const s = stats[k];
            if (s.frames) { s.fps = (1000 * s.frames) / s.acc; s.ms = s.accMs / s.frames; }
            s.frames = 0; s.acc = 0; s.accMs = 0;
          }
          hud(hudSvg, stats.svg, doSvg); hud(hudCan, stats.canvas, doCan);
          lastHud = now;
        }
      }
      function start() { if (running) return; running = true; lastFrame = 0; raf = requestAnimationFrame(frame); }
      function stop() { running = false; cancelAnimationFrame(raf); }

      function setMode(m) {
        mode = m;
        el.querySelectorAll("[data-m]").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
        pSvg.classList.toggle("idle", m === "canvas");
        pCan.classList.toggle("idle", m === "svg");
        stats.svg.frames = stats.canvas.frames = 0; stats.svg.acc = stats.canvas.acc = 0; stats.svg.accMs = stats.canvas.accMs = 0;
        lastFrame = 0;
      }
      el.querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
      slider.oninput = () => { n = NS[+slider.value]; makePoints(); stepPoints((performance.now() - t0) / 1000); drawSvg(); drawCanvas(); lastFrame = 0; };

      measure(); makePoints(); setMode("both");
      stepPoints(0); drawSvg(); drawCanvas();
      hud(hudSvg, stats.svg, false); hud(hudCan, stats.canvas, false);
      Deck.onTheme(() => { fill = Deck.color("--accent-2") || fill; drawCanvas(); });

      return {
        enter() { start(); },
        leave() { stop(); },
        resize() { measure(); drawSvg(); drawCanvas(); },
      };
    },
  });
})();
