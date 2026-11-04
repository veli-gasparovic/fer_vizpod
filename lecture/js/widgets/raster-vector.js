/* Raster vs vector: the same chart as pixels (canvas, drawn once at 1×) and as a document (SVG).
   step 0: both at 1× · step 1: zoom to 6× · step 2: inspect (click) · step 3: Ctrl-F hint */
(function () {
  Deck.css("raster-vector", `
    .rv { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 0.8rem; height: 100%; }
    .rv-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; min-height: 0; }
    .rv-panel { display: flex; flex-direction: column; gap: 0.35rem; min-height: 0; }
    .rv-label { display: flex; align-items: baseline; gap: 0.6rem; font-size: 0.62rem; color: var(--ink-2); }
    .rv-label b { font: 600 0.7rem var(--font-mono); color: var(--ink); letter-spacing: 0.04em; }
    .rv-view { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; border-radius: 0.45rem;
      border: 1px solid var(--rule); background: var(--surface); }
    .rv-view canvas { position: absolute; left: 0; top: 0; transform-origin: 0 0; image-rendering: auto; cursor: crosshair; }
    .rv-view svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .rv-view svg rect.stripe { cursor: pointer; }
    .rv-view svg rect.stripe.picked { stroke: var(--ink); stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
    .rv-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; align-items: start; }
    .rv-zoom { display: flex; align-items: center; gap: 0.6rem; font-size: 0.62rem; color: var(--ink-2); }
    .rv-zoom input { width: 12rem; }
    .rv-zoom output { font: 600 0.75rem var(--font-mono); color: var(--ink); min-width: 3.2em; }
    .rv-dpr { font: 0.58rem var(--font-mono); color: var(--muted); }
    .rv-insp { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; grid-column: 1 / -1;
      opacity: 0; transform: translateY(0.3rem); transition: opacity .4s, transform .4s; pointer-events: none; }
    .rv-insp.show { opacity: 1; transform: none; pointer-events: auto; }
    .rv-card { background: var(--code-bg); color: var(--code-ink); border-radius: 0.45rem; padding: 0.55rem 0.75rem;
      font: 0.58rem/1.55 var(--font-mono); height: 6.4em; overflow: hidden; }
    .rv-card .t { color: var(--tok-kw); } .rv-card .a { color: var(--tok-fn); } .rv-card .v { color: var(--tok-str); }
    .rv-card .h { color: var(--code-dim); }
    .rv-card .sw { display: inline-block; width: 0.8em; height: 0.8em; border-radius: 2px; vertical-align: -0.1em; margin-right: 0.3em; border: 1px solid #555; }
    .rv-card label { display: inline-flex; gap: 0.4em; align-items: center; color: var(--tok-d3); margin-top: 0.2rem; }
    .rv-card input[type=color] { width: 2.2em; height: 1.3em; border: 0; padding: 0; background: none; cursor: pointer; }
    .rv-card em { font-style: normal; color: var(--tok-d3); }
    .rv-hint { grid-column: 1 / -1; font-size: 0.72rem; color: var(--ink); opacity: 0; transition: opacity .4s; text-align: center; }
    .rv-hint.show { opacity: 1; }
    .rv-hint kbd { font-size: 0.68rem; }
  `);

  Deck.widget("raster-vector", {
    steps: 3,
    mount(el) {
      el.classList.add("rv");
      el.innerHTML = `
        <div class="rv-panels">
          <div class="rv-panel"><div class="rv-label"><b>PNG · 1×</b><span>rendered once, to pixels</span></div><div class="rv-view rv-raster"><canvas></canvas></div></div>
          <div class="rv-panel"><div class="rv-label"><b>SVG</b><span>a document, re-rendered at every zoom</span></div><div class="rv-view rv-vector"></div></div>
        </div>
        <div class="rv-bar">
          <div class="rv-zoom controls"><span>zoom</span><input type="range" min="1" max="8" step="0.1" value="1"><output>1.0×</output></div>
          <div class="rv-dpr"></div>
          <div class="rv-insp">
            <div class="rv-card rv-card-raster"><span class="h">// click the picture</span></div>
            <div class="rv-card rv-card-vector"><span class="h">// click a stripe</span></div>
          </div>
          <div class="rv-hint">Press <kbd>Ctrl</kbd>+<kbd>F</kbd> and search <b>1998</b>. <span class="rv-count"></span></div>
        </div>`;
      const rasterView = el.querySelector(".rv-raster");
      const vectorView = el.querySelector(".rv-vector");
      const canvas = rasterView.querySelector("canvas");
      const slider = el.querySelector("input[type=range]");
      const out = el.querySelector("output");
      const insp = el.querySelector(".rv-insp");
      const cardR = el.querySelector(".rv-card-raster");
      const cardV = el.querySelector(".rv-card-vector");
      const hint = el.querySelector(".rv-hint");
      el.querySelector(".rv-dpr").textContent = `window.devicePixelRatio = ${window.devicePixelRatio} · this screen draws ${window.devicePixelRatio} device px per CSS px`;

      const data = CLIMATE.global.values;
      const max = d3.max(data, (d) => Math.abs(d.anomaly));
      const color = d3.scaleDiverging([-max, 0, max], (t) => d3.interpolateRdBu(1 - t));
      let W = 0, H = 0, k = 1, anchor = [0, 0], svg = null, picked = null, step = 0;
      const overrides = new Map(); // year -> fill chosen in the inspector

      function layout() {
        W = vectorView.clientWidth; H = vectorView.clientHeight;
        const m = { top: H * 0.2, right: W * 0.04, bottom: H * 0.2, left: W * 0.04 };
        const x = d3.scaleBand().domain(data.map((d) => d.year)).range([m.left, W - m.right]);
        return { m, x, y0: m.top, y1: H - m.bottom };
      }

      function build() {
        const L = layout();
        if (!W || !H) return;
        const ink = Deck.color("--ink"), ink2 = Deck.color("--ink-2"), muted = Deck.color("--muted"), surf = Deck.color("--surface");
        const sans = Deck.color("--font-sans"), serif = Deck.color("--font-serif");
        const fs = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const y98 = data.find((d) => d.year === 1998);
        const ax = L.x(1998) + L.x.bandwidth() / 2, ay = L.y1 + fs * 0.9;
        anchor = [ax + fs * 2.0, L.y1 + fs * 1.35]; // zoom into the 1998 label
        const ticks = data.filter((d) => d.year % 25 === 0);

        // ---- vector
        d3.select(vectorView).selectAll("svg").remove();
        svg = d3.select(vectorView).append("svg").attr("role", "img").attr("aria-label", "Global temperature anomaly, warming stripes 1850–2025");
        svg.append("rect").attr("width", W).attr("height", H).attr("fill", surf);
        svg.append("text").attr("x", L.m.left).attr("y", L.m.top - fs * 1.6).attr("font-family", serif).attr("font-weight", 600)
          .attr("font-size", fs * 0.95).attr("fill", ink).text("Global temperature anomaly");
        svg.append("text").attr("x", L.m.left).attr("y", L.m.top - fs * 0.55).attr("font-family", sans)
          .attr("font-size", fs * 0.55).attr("fill", muted).text("°C vs 1961–1990 · HadCRUT 5.1 · one stripe per year");
        svg.append("g").selectAll("rect").data(data, (d) => d.year).join("rect").attr("class", "stripe")
          .attr("x", (d) => L.x(d.year)).attr("y", L.y0).attr("width", L.x.bandwidth() + 0.3).attr("height", L.y1 - L.y0)
          .attr("fill", (d) => overrides.get(d.year) || color(d.anomaly)).attr("shape-rendering", "crispEdges")
          .on("click", function (ev, d) { pickVector(this, d); });
        const ga = svg.append("g").attr("font-family", sans).attr("font-size", fs * 0.5).attr("fill", ink2);
        ga.selectAll("text").data(ticks).join("text").attr("x", (d) => L.x(d.year)).attr("y", L.y1 + fs * 0.75)
          .attr("text-anchor", "start").text((d) => d.year);
        // annotation: 1998
        const ann = svg.append("g").attr("font-family", sans).attr("fill", ink);
        ann.append("line").attr("x1", ax).attr("x2", ax).attr("y1", L.y1).attr("y2", L.y1 + fs * 1.15).attr("stroke", ink).attr("stroke-width", 1);
        ann.append("text").attr("x", ax + 3).attr("y", L.y1 + fs * 1.55).attr("font-size", fs * 0.46).attr("font-weight", 600)
          .text(`1998 · ${d3.format("+.2f")(y98.anomaly)} °C`);

        // ---- raster: same drawing, once, at 1 device pixel per CSS pixel
        canvas.width = W; canvas.height = H;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        const c = canvas.getContext("2d");
        c.fillStyle = surf; c.fillRect(0, 0, W, H);
        c.textBaseline = "alphabetic";
        c.fillStyle = ink; c.font = `600 ${fs * 0.95}px ${serif}`; c.fillText("Global temperature anomaly", L.m.left, L.m.top - fs * 1.6);
        c.fillStyle = muted; c.font = `${fs * 0.55}px ${sans}`; c.fillText("°C vs 1961–1990 · HadCRUT 5.1 · one stripe per year", L.m.left, L.m.top - fs * 0.55);
        data.forEach((d) => { c.fillStyle = color(d.anomaly); c.fillRect(L.x(d.year), L.y0, L.x.bandwidth() + 0.3, L.y1 - L.y0); });
        c.fillStyle = ink2; c.font = `${fs * 0.5}px ${sans}`;
        ticks.forEach((d) => c.fillText(String(d.year), L.x(d.year), L.y1 + fs * 0.75));
        c.strokeStyle = ink; c.lineWidth = 1; c.beginPath(); c.moveTo(ax, L.y1); c.lineTo(ax, L.y1 + fs * 1.15); c.stroke();
        c.fillStyle = ink; c.font = `600 ${fs * 0.46}px ${sans}`; c.fillText(`1998 · ${d3.format("+.2f")(y98.anomaly)} °C`, ax + 3, L.y1 + fs * 1.55);

        el.querySelector(".rv-count").textContent = `The SVG has ${svg.selectAll("text").size()} <text> nodes. The PNG has 0.`;
        applyZoom(k);
        if (picked != null) {
          const node = svg.selectAll("rect.stripe").filter((d) => d.year === picked).node();
          if (node) pickVector(node, node.__data__, true);
        }
      }

      function applyZoom(z) {
        k = z;
        slider.value = z; out.textContent = z.toFixed(1) + "×";
        const [ax, ay] = anchor;
        canvas.style.transform = `translate(${ax}px, ${ay}px) scale(${z}) translate(${-ax}px, ${-ay}px)`;
        if (svg) svg.attr("viewBox", `${ax - ax / z} ${ay - ay / z} ${W / z} ${H / z}`);
      }
      function animateZoom(to) {
        const from = k;
        d3.select(el).transition("zoom").duration(2200).ease(d3.easeCubicInOut)
          .tween("zoom", () => (t) => applyZoom(from + (to - from) * t));
      }
      slider.addEventListener("input", () => { d3.select(el).interrupt("zoom"); applyZoom(+slider.value); });

      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const toHex = (c) => d3.color(c).formatHex();
      function pickVector(node, d, silent) {
        picked = d.year;
        svg.selectAll("rect.stripe").classed("picked", false);
        d3.select(node).classed("picked", true).raise();
        const r = (n) => +(+node.getAttribute(n)).toFixed(1);
        const fill = node.getAttribute("fill");
        cardV.innerHTML =
          `<span class="t">&lt;rect</span> <span class="a">x</span>=<span class="v">"${r("x")}"</span> <span class="a">y</span>=<span class="v">"${r("y")}"</span> <span class="a">width</span>=<span class="v">"${r("width")}"</span> <span class="a">height</span>=<span class="v">"${r("height")}"</span> <span class="a">fill</span>=<span class="v">"<i class="sw" style="background:${esc(fill)}"></i>${esc(toHex(fill))}"</span><span class="t">&gt;</span><br>` +
          `<span class="h">__data__</span> { year: <em>${d.year}</em>, anomaly: <em>${d3.format("+.3f")(d.anomaly)}</em> }<br>` +
          `<label>fill <input type="color" value="${toHex(fill)}"></label> <span class="h">← it's a document: change it</span>`;
        cardV.querySelector("input").addEventListener("input", (e) => {
          overrides.set(d.year, e.target.value);
          d3.select(node).attr("fill", e.target.value);
          cardV.querySelector(".sw").style.background = e.target.value;
          cardV.querySelectorAll(".v")[4].lastChild.textContent = e.target.value;
        });
        if (!silent) pickRasterAt(+node.getAttribute("x") + +node.getAttribute("width") / 2, +node.getAttribute("y") + 40);
      }
      function pickRasterAt(px, py) {
        px = Math.max(0, Math.min(W - 1, Math.round(px))); py = Math.max(0, Math.min(H - 1, Math.round(py)));
        let rgb;
        try { const p = canvas.getContext("2d").getImageData(px, py, 1, 1).data; rgb = `rgb(${p[0]}, ${p[1]}, ${p[2]})`; }
        catch (e) { rgb = "(unreadable)"; }
        cardR.innerHTML = `<span class="h">// that's all a picture knows</span><br>pixel (<em>${px}</em>, <em>${py}</em>): <i class="sw" style="background:${rgb}"></i><span class="v">${rgb}</span><br><span class="h">no element · no year · no anomaly · no text</span>`;
      }
      canvas.addEventListener("click", (ev) => {
        const r = canvas.getBoundingClientRect();
        pickRasterAt(((ev.clientX - r.left) / r.width) * W, ((ev.clientY - r.top) / r.height) * H);
      });

      build();
      Deck.onTheme(() => build());
      let lastSize = [W, H], roT;
      new ResizeObserver(() => {
        clearTimeout(roT);
        roT = setTimeout(() => {
          if (vectorView.clientWidth !== lastSize[0] || vectorView.clientHeight !== lastSize[1]) { build(); lastSize = [W, H]; }
        }, 60);
      }).observe(vectorView);

      return {
        step(n) {
          const prev = step; step = n;
          if (n >= 1 && prev < 1) animateZoom(6);
          if (n === 0 && k !== 1) animateZoom(1);
          insp.classList.toggle("show", n >= 2);
          hint.classList.toggle("show", n >= 3);
          if (n >= 2 && picked == null && svg) {
            const node = svg.selectAll("rect.stripe").filter((d) => d.year === 1998).node();
            if (node) pickVector(node, node.__data__);
          }
        },
        resize() { build(); },
      };
    },
  });
})();
