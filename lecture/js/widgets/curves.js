/* curves: shape generators turn data into a path string `d`.
   Step 0: curve explorer (drag points, switch curves, line/area).
   Step 1: "a star is also a line" (createStarPath from stars.js).            */
(function () {
  Deck.css("curves", `
    .cv { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1.6rem; height: 100%; }
    .cv-panel { display: flex; flex-direction: column; gap: 0.55rem; min-height: 0; min-width: 0; }
    .cv-right { transition: opacity 0.5s ease, transform 0.5s ease; }
    .cv-right.hidden { opacity: 0; transform: translateX(1rem); pointer-events: none; }
    .cv-svg { flex: 1 1 auto; min-height: 0; width: 100%; border-radius: 0.55rem; touch-action: none; }
    .cv-left .cv-svg { background: var(--surface); border: 1px solid var(--rule); }
    .cv-right .cv-svg { background: #2a1846; border: 1px solid #2a1846; }
    .cv-code, .cv-d, .cv .controls { flex-shrink: 0; }
    .cv-code { margin: 0; background: var(--code-bg); color: var(--code-ink); border-radius: 0.5rem; padding: 0.5rem 0.75rem; font: 0.55rem/1.5 var(--font-mono); white-space: pre; overflow: hidden; }
    .cv-code .d3 { color: var(--tok-d3); font-weight: 600; } .cv-code .h { color: var(--tok-fn); }
    .cv-d { margin: 0; background: var(--surface-2); color: var(--ink-2); border-radius: 0.5rem; padding: 0.45rem 0.7rem; font: 0.5rem/1.5 var(--font-mono); word-break: break-all; white-space: pre-wrap; height: 4.9em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .cv-d b { color: var(--accent); font-weight: 700; }
    .cv-d .len { color: var(--muted); }
    .cv h3 { font: 600 0.85rem var(--font-serif); margin: 0; }
    .cv .controls label { display: inline-flex; align-items: center; gap: 0.35rem; }
    .cv .controls input[type=range] { width: 6rem; }
    .cv .pt { cursor: grab; fill: var(--surface); stroke: var(--ink); stroke-width: 2.5; }
    .cv .pt:active { cursor: grabbing; }
    .cv .ctrl { fill: none; stroke: var(--muted); stroke-dasharray: 4 4; stroke-width: 1.2; }
    .cv .shape { fill: none; stroke: var(--accent-2); stroke-width: 3.5; stroke-linejoin: round; }
    .cv .shape.area { fill: var(--accent-2); fill-opacity: 0.18; stroke-width: 3; }
    .cv .base { stroke: var(--rule); stroke-width: 1.5; }
    .cv .star { fill: #fff; fill-opacity: 0.25; stroke: #fff; stroke-width: 2.5; stroke-linejoin: round; }
    .cv .spt { fill: #ffd36b; }
    .cv .spt.inner { fill: #c7b8ff; }
    .cv .sky { fill: #fff; }
      .cv *, .cv *::before { font-variant-ligatures: none !important; font-feature-settings: "liga" 0, "calt" 0 !important; }
  `);

  const CURVES = ["curveLinear", "curveMonotoneX", "curveBasis", "curveCardinal", "curveCatmullRom", "curveStep", "curveNatural"];
  const START = [[0.06, 0.62], [0.2, 0.3], [0.34, 0.5], [0.5, 0.18], [0.64, 0.7], [0.8, 0.42], [0.94, 0.55]];

  // createStarPath from the repo's stars.js (plus an inner-radius ratio and curve option)
  function starPoints(radius, points, ratio) {
    const angleStep = (Math.PI * 2) / points;
    const innerRadius = radius * ratio;
    const coordinates = [];
    for (let i = 0; i < points; i++) {
      const outerAngle = i * angleStep - Math.PI / 2;
      coordinates.push([radius * Math.cos(outerAngle), radius * Math.sin(outerAngle), "outer"]);
      const innerAngle = outerAngle + angleStep / 2;
      coordinates.push([innerRadius * Math.cos(innerAngle), innerRadius * Math.sin(innerAngle), "inner"]);
    }
    return coordinates;
  }

  function fmtD(d) {
    const s = d.length > 300 ? d.slice(0, 300) + "…" : d;
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/([MLCQZHVSA])/g, "<b>$1</b>") + `  <span class="len">(${d.length} chars)</span>`;
  }

  Deck.widget("curves", {
    steps: 1,
    mount(el) {
      el.innerHTML = `
        <div class="cv">
          <div class="cv-panel cv-left">
            <div class="controls">${CURVES.map((c) => `<button class="btn" data-c="${c}">${c.replace("curve", "").replace("CatmullRom", "Catmull–Rom")}</button>`).join("")}
              <span style="flex:1"></span>
              <button class="btn" data-a="area">area</button>
              <button class="btn" data-a="reset">reset</button></div>
            <svg class="cv-svg"></svg>
            <pre class="cv-code"></pre>
            <div class="cv-d"></div>
          </div>
          <div class="cv-panel cv-right hidden">
            <h3>A star is also a line</h3>
            <div class="controls">
              <label>points <input type="range" min="3" max="12" step="1" value="5" data-s="points"><span data-v="points">5</span></label>
              <label>inner radius <input type="range" min="0.2" max="0.9" step="0.05" value="0.4" data-s="ratio"><span data-v="ratio">0.4</span></label>
              <button class="btn" data-sc="curveLinearClosed">LinearClosed</button>
              <button class="btn" data-sc="curveBasisClosed">BasisClosed</button>
              <button class="btn" data-a="pts" aria-pressed="true">show points</button>
            </div>
            <svg class="cv-svg"></svg>
            <div class="cv-d"></div>
          </div>
        </div>`;
      const [lsvgN, rsvgN] = el.querySelectorAll(".cv-svg");
      const lsvg = d3.select(lsvgN), rsvg = d3.select(rsvgN);
      const [ldEl, rdEl] = el.querySelectorAll(".cv-d");
      const codeEl = el.querySelector(".cv-code");
      const right = el.querySelector(".cv-right");

      let LW = 600, LH = 300, RW = 400, RH = 300, rem = 16;
      let curve = "curveMonotoneX", asArea = false;
      let pts = START.map(([x, y], i) => ({ id: i, x, y })); // normalized 0..1
      let star = { points: 5, ratio: 0.4, curve: "curveLinearClosed", showPts: true };

      const gBase = lsvg.append("line").attr("class", "base");
      const gCtrl = lsvg.append("path").attr("class", "ctrl");
      const gShape = lsvg.append("path").attr("class", "shape");
      const gPts = lsvg.append("g");
      const sky = rsvg.append("g");
      const starG = rsvg.append("g");
      const starPath = starG.append("path").attr("class", "star");
      const starPts = starG.append("g");

      function measure() {
        rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        let r = lsvgN.getBoundingClientRect();
        if (r.width > 10) { LW = r.width; LH = r.height; }
        r = rsvgN.getBoundingClientRect();
        if (r.width > 10) { RW = r.width; RH = r.height; }
        lsvg.attr("viewBox", `0 0 ${LW} ${LH}`);
        rsvg.attr("viewBox", `0 0 ${RW} ${RH}`);
        // a few background stars, like stars.js
        sky.selectAll("circle").data(d3.range(40).map((i) => ({ x: (Math.sin(i * 91.7) * 0.5 + 0.5) * RW, y: (Math.sin(i * 47.3 + 1) * 0.5 + 0.5) * RH, r: 0.6 + (i % 3) * 0.5 })))
          .join("circle").attr("class", "sky").attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", (d) => d.r).attr("opacity", 0.35);
      }
      const pad = () => 2 * rem;
      const X = () => d3.scaleLinear([0, 1], [pad(), LW - pad()]);
      const Y = () => d3.scaleLinear([0, 1], [pad(), LH - pad()]);

      function renderLeft() {
        const x = X(), y = Y();
        const sorted = pts; // keep the user's order; MonotoneX assumes increasing x, which is part of the lesson
        const gen = asArea
          ? d3.area().x((d) => x(d.x)).y0(LH - pad()).y1((d) => y(d.y)).curve(d3[curve])
          : d3.line().x((d) => x(d.x)).y((d) => y(d.y)).curve(d3[curve]);
        gen.digits && gen.digits(1);
        const dStr = gen(sorted);
        gShape.datum(sorted).attr("d", dStr).classed("area", asArea);
        gCtrl.attr("d", d3.line().x((d) => x(d.x)).y((d) => y(d.y))(sorted));
        gBase.attr("x1", pad()).attr("x2", LW - pad()).attr("y1", LH - pad()).attr("y2", LH - pad()).attr("opacity", asArea ? 1 : 0);
        gPts.selectAll("circle").data(pts, (d) => d.id).join("circle").attr("class", "pt").attr("r", 0.55 * rem)
          .attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.y))
          .call(d3.drag().on("drag", function (ev, d) {
            d.x = Math.max(0, Math.min(1, x.invert(ev.x)));
            d.y = Math.max(0, Math.min(1, y.invert(ev.y)));
            renderLeft();
          }));
        ldEl.innerHTML = `<span class="len">d = </span>${fmtD(dStr)}`;
        codeEl.innerHTML = asArea
          ? `const area = <span class="d3">d3</span>.area()\n    .x(d => x(d.x)).y0(height).y1(d => y(d.y))\n    .curve(<span class="d3">d3</span>.<span class="h">${curve}</span>);\npath.attr("d", area(points));`
          : `const line = <span class="d3">d3</span>.line()\n    .x(d => x(d.x)).y(d => y(d.y))\n    .curve(<span class="d3">d3</span>.<span class="h">${curve}</span>);\npath.attr("d", line(points));`;
        el.querySelectorAll("[data-c]").forEach((b) => b.classList.toggle("on", b.dataset.c === curve));
        el.querySelector('[data-a="area"]').classList.toggle("on", asArea);
      }

      function renderStar() {
        const R = Math.min(RW, RH) * 0.36;
        const coords = starPoints(R, star.points, star.ratio);
        const gen = d3.line().curve(d3[star.curve]);
        gen.digits && gen.digits(1);
        const closed = coords.map(([x, y]) => [x, y]);
        const dStr = gen(closed);
        starG.attr("transform", `translate(${RW / 2},${RH / 2})`);
        starPath.datum(coords).attr("d", dStr);
        starPts.selectAll("circle").data(star.showPts ? coords : []).join("circle")
          .attr("class", (d) => "spt " + d[2]).attr("r", 0.28 * rem).attr("cx", (d) => d[0]).attr("cy", (d) => d[1]);
        rdEl.innerHTML = `<span class="len">createStarPath(${Math.round(R)}, ${star.points}) → </span>${fmtD(dStr)}`;
        el.querySelectorAll("[data-sc]").forEach((b) => b.classList.toggle("on", b.dataset.sc === star.curve));
        el.querySelector('[data-a="pts"]').setAttribute("aria-pressed", star.showPts);
        el.querySelectorAll("[data-v]").forEach((s) => (s.textContent = star[s.dataset.v]));
      }

      el.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { curve = b.dataset.c; renderLeft(); }));
      el.querySelector('[data-a="area"]').onclick = () => { asArea = !asArea; renderLeft(); };
      el.querySelector('[data-a="reset"]').onclick = () => {
        const from = pts.map((p) => ({ ...p }));
        const to = START.map(([x, y], i) => ({ id: i, x, y }));
        lsvg.transition("reset").duration(600).tween("pts", () => (t) => {
          pts = from.map((p, i) => ({ id: p.id, x: p.x + (to[i].x - p.x) * t, y: p.y + (to[i].y - p.y) * t }));
          renderLeft();
        });
      };
      el.querySelectorAll("[data-sc]").forEach((b) => (b.onclick = () => { star.curve = b.dataset.sc; renderStar(); }));
      el.querySelector('[data-a="pts"]').onclick = () => { star.showPts = !star.showPts; renderStar(); };
      el.querySelectorAll("[data-s]").forEach((inp) => (inp.oninput = () => { star[inp.dataset.s] = +inp.value; renderStar(); }));

      measure(); renderLeft(); renderStar();

      return {
        step(n) { right.classList.toggle("hidden", n < 1); },
        resize() { measure(); renderLeft(); renderStar(); },
      };
    },
  });
})();
