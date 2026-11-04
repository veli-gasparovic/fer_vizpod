/* ==========================================================================
   break: full-bleed countdown with the audience's live dots behind it.
   Offline → slowly drifting warming stripes instead.
   ========================================================================== */
(function () {
  "use strict";

  Deck.css("break", `
    /* engine workaround: .widget{position:relative} overrides .bleed-fill in deck.css */
    .slide .widget.bleed-fill { position: absolute; inset: 0; }
    .brk { position: absolute; inset: 0; overflow: hidden; background: var(--bg); }
    .brk svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .brk .stripes rect { transition: opacity 1.2s; shape-rendering: crispEdges; }
    .brk circle.pt { fill-opacity: 0.55; stroke: var(--surface); stroke-width: 2; }
    .brk-card {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 2;
      display: flex; flex-direction: column; align-items: center; gap: 0.6rem; text-align: center;
      background: color-mix(in srgb, var(--bg) 86%, transparent); backdrop-filter: blur(8px);
      padding: 1.6rem 3rem 1.8rem; border-radius: 1rem; box-shadow: 0 10px 40px rgba(0,0,0,0.12);
    }
    .brk-time { font: 600 8.5rem/0.95 var(--font-serif); letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
      cursor: pointer; user-select: none; }
    .brk-time.paused { color: var(--muted); }
    .brk-time.done { font-size: 4.2rem; color: var(--accent); }
    .brk-join { font-size: 0.85rem; color: var(--ink-2); max-width: 34rem; }
    .brk-join b { display: block; margin: 0.25rem 0; font-family: var(--font-mono); color: var(--ink); font-weight: 600; font-size: 1.05rem; white-space: nowrap; }
    .brk-meta { font: 0.55rem var(--font-mono); color: var(--muted); }
  `);

  Deck.widget("break", {
    steps: 0,
    mount(el) {
      const client = window.DotSocketsClient;
      const cfg = window.LECTURE || {};
      el.innerHTML = `
        <div class="brk">
          <svg><g class="stripes"></g><g class="dots"></g></svg>
          <div class="brk-card">
            <div class="kicker">Break</div>
            <div class="brk-time" title="click to pause / resume">15:00</div>
            <div class="controls">
              <button class="btn" data-d="-1">−1 min</button>
              <button class="btn" data-act="pause">pause</button>
              <button class="btn" data-d="1">+1 min</button>
            </div>
            <div class="brk-join">Meanwhile, open this on your phone <b></b> and tap anywhere. Your dots appear here.</div>
            <div class="brk-meta"></div>
          </div>
        </div>`;
      el.querySelector(".brk-join b").textContent = (client && client.joinUrl) || "the join page";
      const svg = d3.select(el).select("svg");
      const gStripes = svg.select(".stripes"), gDots = svg.select(".dots");
      const timeEl = el.querySelector(".brk-time"), pauseBtn = el.querySelector('[data-act="pause"]'), meta = el.querySelector(".brk-meta");

      const values = (window.CLIMATE ? CLIMATE.global.values : d3.range(176).map((i) => ({ year: 1850 + i, anomaly: (i - 100) / 80 })));
      const color = d3.scaleDiverging([1.1, 0, -1.1], d3.interpolateRdBu).clamp(true);
      let W = 0, H = 0;

      // ---- countdown (based on an end time, so leaving the slide doesn't stop it)
      let end = null, remaining = (cfg.breakMinutes || 15) * 60000, paused = false, tick = null;
      const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
      function left() { return paused || end === null ? remaining : end - Date.now(); }
      function draw() {
        const ms = left();
        if (ms <= 0) { timeEl.textContent = "We're back"; timeEl.classList.add("done"); }
        else { timeEl.textContent = fmt(ms); timeEl.classList.remove("done"); }
        timeEl.classList.toggle("paused", paused);
        pauseBtn.textContent = paused ? "resume" : "pause";
      }
      function togglePause() {
        if (end === null) return;
        if (paused) { end = Date.now() + remaining; paused = false; }
        else { remaining = Math.max(0, end - Date.now()); paused = true; }
        draw();
      }
      timeEl.addEventListener("click", togglePause);
      pauseBtn.addEventListener("click", togglePause);
      el.querySelectorAll("[data-d]").forEach((b) => b.addEventListener("click", () => {
        const d = +b.dataset.d * 60000;
        if (paused || end === null) remaining = Math.max(0, remaining + d); else end = Math.max(Date.now(), end + d);
        draw();
      }));

      // ---- background
      let drift = null, offset = 0;
      function layout() {
        W = el.clientWidth || innerWidth; H = el.clientHeight || innerHeight;
        svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none");
        const bw = W / values.length;
        // two copies side by side so the drift loops seamlessly
        gStripes.selectAll("rect").data(values.concat(values.map((d) => ({ ...d, copy: true }))))
          .join("rect")
          .attr("x", (d, i) => i * bw).attr("y", 0).attr("width", Math.ceil(bw) + 1).attr("height", H)
          .attr("fill", (d) => color(d.anomaly));
        renderDots(client ? client.points : [], false);
      }
      function startDrift() {
        if (drift) return;
        drift = d3.timer((elapsed) => {
          offset = (elapsed * 0.012) % W; // ~12 px/s
          gStripes.attr("transform", `translate(${-offset},0)`);
        });
      }
      function stopDrift() { if (drift) { drift.stop(); drift = null; } }

      let points = [], status = "offline", unsub = null;
      function renderDots(pts, animate = true) {
        points = pts;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const R = rem * 1.4;
        const t = svg.transition().duration(animate ? 600 : 0);
        gDots.selectAll("circle.pt").data(points, (d) => d.timestamp)
          .join(
            (en) => en.append("circle").attr("class", "pt").attr("r", 0)
              .attr("cx", (d) => (d.x / 100) * W).attr("cy", (d) => (d.y / 100) * H)
              .attr("fill", (d) => d3.interpolateRdBu(1 - d.x / 100))
              .call((s) => s.transition(t).attr("r", R)),
            (up) => up.call((s) => s.transition(t).attr("cx", (d) => (d.x / 100) * W).attr("cy", (d) => (d.y / 100) * H).attr("r", R)),
            (ex) => ex.call((s) => s.transition(t).attr("r", 0).remove())
          );
        const live = status === "connected" && points.length > 0;
        const dark = Deck.theme() === "dark";
        gStripes.selectAll("rect").style("opacity", live ? (dark ? 0.2 : 0.12) : (dark ? 0.45 : 0.32));
        meta.textContent = status === "connected" ? `${points.length} ${points.length === 1 ? "dot" : "dots"} · live` : status === "connecting" ? "connecting…" : "offline";
      }

      layout();
      Deck.onTheme(() => renderDots(points, false));
      return {
        enter() {
          if (end === null && !paused) end = Date.now() + remaining;
          draw();
          tick = setInterval(draw, 250);
          startDrift();
          if (client && !unsub) unsub = client.subscribe((p, s) => { status = s; renderDots(p, true); });
        },
        leave() {
          clearInterval(tick); tick = null;
          stopDrift();
          if (unsub) { unsub(); unsub = null; }
        },
        resize: layout,
      };
    },
  });
})();
