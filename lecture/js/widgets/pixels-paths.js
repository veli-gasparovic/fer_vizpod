/* Raster vs vector, explained: the same three shapes stored as a grid of pixels and as instructions.
   step 0: both look the same · step 1: zoom in (pixel grid vs geometry) · step 2: what is stored · step 3: trade-offs */
(function () {
  Deck.css("pixels-paths", `
    .pp { display: grid; grid-template-columns: 1fr 1fr; gap: 2.2rem; height: 100%; min-height: 0; align-content: center; }
    .pp-panel { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1.2rem; min-height: 0; align-items: start; }
    .pp-view { position: relative; border-radius: 0.45rem; border: 1px solid var(--rule); background: var(--surface); overflow: hidden; }
    .pp-view canvas, .pp-view svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .pp-raster canvas { cursor: crosshair; }
    .pp-info { display: flex; flex-direction: column; gap: 0.55rem; min-width: 0; }
    .pp-info h3 { margin: 0; font-size: 1.15rem; }
    .pp-info h3 small { display: block; font: 400 0.68rem var(--font-sans); color: var(--ink-2); margin-top: 0.15rem; }
    .pp-res { display: flex; align-items: center; gap: 0.5rem; font-size: 0.6rem; color: var(--ink-2); }
    .pp-res input { width: 8rem; }
    .pp-res output { font: 600 0.66rem var(--font-mono); color: var(--ink); white-space: nowrap; }
    .pp-res.pp-ghost { visibility: hidden; }
    .pp-card { background: var(--code-bg); color: var(--code-ink); border-radius: 0.45rem; padding: 0.5rem 0.7rem;
      font: 0.54rem/1.6 var(--font-mono); overflow: hidden; white-space: pre-wrap; }
    .pp-card .t { color: var(--tok-kw); } .pp-card .a { color: var(--tok-fn); } .pp-card .v { color: var(--tok-str); }
    .pp-card .h { color: var(--code-dim); } .pp-card .n { color: var(--tok-num); }
    .pp-card .ln { display: block; padding: 0 0.3rem 0 calc(0.3rem + var(--ind, 0em) + 1.3em); text-indent: -1.3em; margin: 0 -0.3rem; border-radius: 0.2rem; transition: background .15s; }
    .pp-card .ln.on { background: rgba(255,255,255,0.12); }
    .pp-card .hot { background: rgba(255, 211, 107, 0.28); border-radius: 0.15rem; }
    .pp-size { font-size: 0.62rem; color: var(--ink-2); }
    .pp-size b { font: 600 0.8rem var(--font-mono); color: var(--ink); }
    .pp-facts { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 0.7rem; font-size: 0.7rem; }
    .pp-facts dt { color: var(--muted); font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.06em; padding-top: 0.12rem; }
    .pp-facts dd { margin: 0; color: var(--ink); }
    .pp .f-in { opacity: 0; transform: translateY(0.3rem); transition: opacity .45s, transform .45s; pointer-events: none; }
    .pp .f-in.show { opacity: 1; transform: none; pointer-events: auto; }
    .pp-geo { opacity: 0; transition: opacity .5s; }
    .pp-geo.show { opacity: 1; }
    .pp-geo circle.pt { stroke: var(--surface); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .pp-geo text { font: 600 3.4px var(--font-mono); paint-order: stroke; stroke: var(--surface); stroke-width: 0.8px; }
    .pp-vector .shape { transition: opacity .15s; cursor: pointer; }
    .pp-vector.hovering .shape { opacity: 0.35; }
    .pp-vector.hovering .shape.on { opacity: 1; }
  `);

  // the picture: one bar, one dot, one line, in a 100 × 100 coordinate system
  const SHAPES = [
    { tag: "rect", attrs: { x: 14, y: 50, width: 20, height: 40 }, fill: "--accent-2" },
    { tag: "circle", attrs: { cx: 63, cy: 38, r: 22 }, fill: "--accent" },
    { tag: "line", attrs: { x1: 6, y1: 94, x2: 94, y2: 30 }, stroke: "--ink", sw: 3 },
  ];
  const RES = [8, 12, 16, 24, 32, 48, 64, 128, 256];
  const fmtBytes = (n) => n >= 1024 ? `${d3.format(",.1f")(n / 1024)} KB` : `${n} bytes`;
  const hex = (v) => v.toString(16).padStart(2, "0");

  Deck.widget("pixels-paths", {
    steps: 3,
    mount(el) {
      el.classList.add("pp");
      el.innerHTML = `
        <div class="pp-panel">
          <div class="pp-view pp-raster"><canvas></canvas></div>
          <div class="pp-info">
            <h3>Raster<small>a grid of pixels, each one a colour</small></h3>
            <div class="pp-res controls"><span>resolution</span><input type="range" min="0" max="${RES.length - 1}" step="1"><output></output></div>
            <div class="f-in s2 pp-size">stored: <b class="pp-rbytes"></b></div>
            <div class="f-in s2 pp-card pp-rcard"></div>
            <dl class="f-in s3 pp-facts">
              <dt>Formats</dt><dd>PNG, JPEG, WebP, GIF</dd>
              <dt>Size</dt><dd>grows with the number of pixels</dd>
              <dt>Zoom in</dt><dd>blocks or blur: the detail was never stored</dd>
              <dt>Good for</dt><dd>photos, screenshots, millions of points</dd>
              <dt>Browser</dt><dd><code>&lt;img&gt;</code>, <code>&lt;canvas&gt;</code></dd>
            </dl>
          </div>
        </div>
        <div class="pp-panel">
          <div class="pp-view pp-vector"></div>
          <div class="pp-info">
            <h3>Vector<small>a list of shapes: instructions to draw</small></h3>
            <div class="pp-res pp-ghost"><span>resolution</span><input type="range" disabled><output></output></div>
            <div class="f-in s2 pp-size">stored: <b class="pp-vbytes"></b> <span>at any size</span></div>
            <div class="f-in s2 pp-card pp-vcard"></div>
            <dl class="f-in s3 pp-facts">
              <dt>Formats</dt><dd>SVG, PDF, EPS, fonts</dd>
              <dt>Size</dt><dd>grows with the number of shapes</dd>
              <dt>Zoom in</dt><dd>re-drawn, sharp at every size</dd>
              <dt>Good for</dt><dd>charts, maps, icons, logos, text</dd>
              <dt>Browser</dt><dd><code>&lt;svg&gt;</code>: part of the page, in the DOM</dd>
            </dl>
          </div>
        </div>`;

      const rView = el.querySelector(".pp-raster");
      const vView = el.querySelector(".pp-vector");
      const canvas = rView.querySelector("canvas");
      const slider = el.querySelector(".pp-res input");
      const out = el.querySelector(".pp-res output");
      const rcard = el.querySelector(".pp-rcard");
      const vcard = el.querySelector(".pp-vcard");
      const rbytes = el.querySelector(".pp-rbytes");
      const off = document.createElement("canvas");

      const color = (v) => getComputedStyle(el).getPropertyValue(v).trim();
      let res = 256, step = 0, hoverPx = null, pixels = null, size = 0, animTimer = null;

      // ---- vector side: real SVG, plus a geometry overlay
      const svg = d3.select(vView).append("svg").attr("viewBox", "0 0 100 100");
      const shapes = svg.selectAll(".shape").data(SHAPES).join((e) => e.append((d) => document.createElementNS("http://www.w3.org/2000/svg", d.tag)))
        .attr("class", "shape")
        .each(function (d) { for (const [k, v] of Object.entries(d.attrs)) this.setAttribute(k, v); });
      const geo = svg.append("g").attr("class", "pp-geo");
      const pts = [
        { x: 14, y: 50, l: "x,y", dx: -1, dy: -2.5 }, { x: 34, y: 90, l: "", dx: 0, dy: 0 },
        { x: 63, y: 38, l: "cx,cy", dx: -13, dy: -2.5 },
        { x: 6, y: 94, l: "x1,y1", dx: 4, dy: 3.5 }, { x: 94, y: 30, l: "x2,y2", dx: -10, dy: -3.5 },
      ];
      geo.append("line").attr("x1", 63).attr("y1", 38).attr("x2", 85).attr("y2", 38)
        .attr("stroke-dasharray", "1.5 1").attr("stroke-width", 0.6);
      geo.append("text").attr("x", 73).attr("y", 36).text("r");
      geo.append("rect").attr("x", 14).attr("y", 50).attr("width", 20).attr("height", 40)
        .attr("fill", "none").attr("stroke-dasharray", "1.5 1").attr("stroke-width", 0.6);
      geo.selectAll("circle.pt").data(pts).join("circle").attr("class", "pt")
        .attr("cx", (p) => p.x).attr("cy", (p) => p.y).attr("r", 1.7);
      geo.selectAll("text.lbl").data(pts.filter((p) => p.l)).join("text").attr("class", "lbl")
        .attr("x", (p) => p.x + p.dx).attr("y", (p) => p.y + p.dy).text((p) => p.l);

      const markup = SHAPES.map((d, i) => {
        const a = Object.entries(d.attrs).map(([k, v]) => ` <span class="a">${k}</span>=<span class="v">"${v}"</span>`).join("");
        const paint = d.fill ? ` <span class="a">fill</span>=<span class="v">"${d.fill === "--accent" ? "#b2182b" : "#2166ac"}"</span>`
          : ` <span class="a">stroke</span>=<span class="v">"#141413"</span> <span class="a">stroke-width</span>=<span class="v">"${d.sw}"</span>`;
        return `<span class="ln" data-i="${i}">&lt;<span class="t">${d.tag}</span>${a}${paint}/&gt;</span>`;
      });
      vcard.innerHTML = `<span class="ln">&lt;<span class="t">svg</span> <span class="a">viewBox</span>=<span class="v">"0 0 100 100"</span>&gt;</span>` +
        markup.map((m) => m.replace('class="ln"', 'class="ln" style="--ind:1.3em"')).join("") + `<span class="ln">&lt;/<span class="t">svg</span>&gt;</span>`;
      el.querySelector(".pp-vbytes").textContent = fmtBytes(new Blob([vcard.textContent]).size);

      shapes.on("pointerenter", (e, d) => {
        const i = SHAPES.indexOf(d);
        vView.classList.add("hovering");
        shapes.classed("on", (s) => s === d);
        vcard.querySelectorAll(".ln[data-i]").forEach((n) => n.classList.toggle("on", +n.dataset.i === i));
      }).on("pointerleave", () => {
        vView.classList.remove("hovering");
        shapes.classed("on", false);
        vcard.querySelectorAll(".ln").forEach((n) => n.classList.remove("on"));
      });

      function paintVector() {
        shapes.each(function (d) {
          if (d.fill) this.setAttribute("fill", color(d.fill));
          else { this.setAttribute("stroke", color(d.stroke)); this.setAttribute("stroke-width", d.sw); this.setAttribute("stroke-linecap", "round"); }
        });
        geo.attr("fill", color("--ink")).attr("stroke", color("--ink"));
        geo.selectAll("circle.pt").attr("fill", color("--enter"));
        geo.selectAll("text").attr("fill", color("--ink")).attr("stroke", null);
      }

      // ---- raster side: draw the same shapes into an N × N bitmap, then show it blown up
      function rasterize() {
        off.width = off.height = res;
        const c = off.getContext("2d", { willReadFrequently: true });
        c.setTransform(res / 100, 0, 0, res / 100, 0, 0);
        c.fillStyle = color("--surface"); c.fillRect(0, 0, 100, 100);
        for (const d of SHAPES) {
          const a = d.attrs;
          if (d.tag === "rect") { c.fillStyle = color(d.fill); c.fillRect(a.x, a.y, a.width, a.height); }
          if (d.tag === "circle") { c.fillStyle = color(d.fill); c.beginPath(); c.arc(a.cx, a.cy, a.r, 0, 2 * Math.PI); c.fill(); }
          if (d.tag === "line") {
            c.strokeStyle = color(d.stroke); c.lineWidth = d.sw; c.lineCap = "round";
            c.beginPath(); c.moveTo(a.x1, a.y1); c.lineTo(a.x2, a.y2); c.stroke();
          }
        }
        pixels = c.getImageData(0, 0, res, res).data;
      }

      function paintRaster() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
        const c = canvas.getContext("2d");
        c.imageSmoothingEnabled = false;
        c.drawImage(off, 0, 0, canvas.width, canvas.height);
        const cell = canvas.width / res;
        if (step >= 1 && cell >= 7 * dpr) {   // pixel grid
          c.strokeStyle = color("--rule"); c.globalAlpha = 0.9; c.lineWidth = 1;
          c.beginPath();
          for (let i = 1; i < res; i++) {
            const p = Math.round(i * cell) + 0.5;
            c.moveTo(p, 0); c.lineTo(p, canvas.height); c.moveTo(0, p); c.lineTo(canvas.width, p);
          }
          c.stroke(); c.globalAlpha = 1;
        }
        if (hoverPx) {
          c.strokeStyle = color("--ink"); c.lineWidth = 2 * dpr;
          c.strokeRect(hoverPx[0] * cell, hoverPx[1] * cell, cell, cell);
        }
      }

      function rasterCard() {
        const n = res * res;
        out.textContent = `${res} × ${res} px`;
        rbytes.textContent = `${res} × ${res} × 4 = ${fmtBytes(n * 4)}`;
        const [px, py] = hoverPx || [Math.round(res * 0.63), Math.round(res * 0.38)];
        const row = Math.min(py, res - 1), start = Math.max(0, Math.min(px - 1, res - 3));
        const cellAt = (x, y) => { const k = (y * res + x) * 4; return [pixels[k], pixels[k + 1], pixels[k + 2], pixels[k + 3]]; };
        const lines = [`<span class="h">// row ${row}, pixels ${start}–${start + 2}, as RRGGBBAA</span>`];
        const bytes = [];
        for (let x = start; x < start + 3; x++) {
          const v = cellAt(x, row);
          const s = v.map(hex).join("");
          bytes.push(x === px && hoverPx ? `<span class="hot">${s}</span>` : s);
        }
        lines.push(`<span class="n">${bytes.join("  ")}</span>`);
        const [r, g, b, a] = cellAt(px, row);
        lines.push(`<span class="h">// pixel (${px}, ${row}) = </span><span class="v">rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(2)})</span>`);
        lines.push(`<span class="h">// … × ${d3.format(",")(n)} pixels. No circle, no bar, no line.</span>`);
        rcard.innerHTML = lines.join("\n");
      }

      function render() { rasterize(); paintRaster(); rasterCard(); }

      function setRes(r, animate) {
        clearInterval(animTimer);
        if (!animate) { res = r; slider.value = RES.indexOf(r); return render(); }
        // step the resolution down/up through the list so the room sees it happen
        const target = RES.indexOf(r);
        animTimer = setInterval(() => {
          const i = RES.indexOf(res);
          if (i === target) return clearInterval(animTimer);
          res = RES[i + Math.sign(target - i)]; slider.value = RES.indexOf(res); render();
        }, 220);
      }

      slider.addEventListener("input", () => { clearInterval(animTimer); res = RES[+slider.value]; render(); });
      canvas.addEventListener("pointermove", (e) => {
        const b = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - b.left) / b.width * res), y = Math.floor((e.clientY - b.top) / b.height * res);
        if (x < 0 || y < 0 || x >= res || y >= res) return;
        if (hoverPx && hoverPx[0] === x && hoverPx[1] === y) return;
        hoverPx = [x, y]; paintRaster(); rasterCard();
      });
      canvas.addEventListener("pointerleave", () => { hoverPx = null; paintRaster(); rasterCard(); });

      function layout() {
        const panel = el.querySelector(".pp-panel");
        const w = panel.clientWidth, h = el.clientHeight;
        size = Math.floor(Math.max(120, Math.min(h, w * 0.6)));
        for (const v of [rView, vView]) { v.style.width = v.style.height = `${size}px`; }
        paintVector(); paintRaster();
      }

      const themeObs = new MutationObserver(() => { paintVector(); render(); });
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

      slider.value = RES.indexOf(res);
      layout(); render();

      return {
        step(n) {
          step = n;
          el.querySelectorAll(".s2").forEach((x) => x.classList.toggle("show", n >= 2));
          el.querySelectorAll(".s3").forEach((x) => x.classList.toggle("show", n >= 3));
          geo.classed("show", n >= 1);
          if (n === 0) setRes(256, false);
          else if (res >= 64) setRes(16, true);
          else paintRaster();
        },
        resize() { layout(); },
        leave() { clearInterval(animTimer); },
      };
    },
  });
})();
