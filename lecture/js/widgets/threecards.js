/* threecards: live mini demos for slide 3 ("Three things a picture can't do"), cards 2 and 3.
   (Card 1, "Scale", is mobileshare.js.) Each demo has an SVG / PNG switch: the same chart as a
   document, then flattened to pixels, so students feel what the picture loses.
     respond-demo   overview (1850–2025) → zoom (drag) → filter (record years) → details (hover)
     machine-demo   labels are <text> nodes: find them, count them; the PNG has none */
(function () {
  Deck.css("threecards", `
    .tc { position: relative; height: 100%; display: flex; flex-direction: column; gap: 0.3rem; min-height: 0; }
    .tc-row { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
    .tc-row .btn { font-size: 0.5rem; padding: 0.12rem 0.45rem; }
    .tc-row .btn:disabled { opacity: 0.35; cursor: default; }
    .tc-seg { display: inline-flex; }
    .tc-seg .btn:first-child { border-top-right-radius: 0; border-bottom-right-radius: 0; }
    .tc-seg .btn:last-child { border-top-left-radius: 0; border-bottom-left-radius: 0; margin-left: -1px; }
    .tc-hint { font: 0.46rem var(--font-mono); color: var(--muted); margin-left: auto; }
    .tc-plot { position: relative; flex: 1 1 auto; min-height: 0; }
    .tc-plot svg, .tc-plot img { display: block; width: 100%; height: 100%; }
    .tc-plot svg { overflow: visible; }
    .tc-plot img { image-rendering: auto; cursor: crosshair; }
    .tc-plot img[hidden] { display: none; }
    .tc .lbl { font: 0.46rem var(--font-mono); fill: var(--muted); }
    .tc .rule { stroke: var(--rule); }
    .tc .line { fill: none; stroke: var(--ink); stroke-width: 1.5; stroke-linejoin: round; }
    .tc .line.dim { stroke-opacity: 0.25; }
    .tc .rec { fill: var(--accent); stroke: var(--surface); stroke-width: 1.5; }
    .tc .cross { stroke: var(--ink-2); }
    .tc .brush .selection { fill: var(--ink); fill-opacity: 0.08; stroke: var(--ink); }
    .tc .bar { fill: color-mix(in srgb, var(--ink) 30%, var(--surface)); }
    .tc .bar.hit { fill: var(--accent); }
    .tc .name { font: 0.52rem var(--font-sans); fill: var(--ink); }
    .tc .val { font: 0.46rem var(--font-mono); fill: var(--ink-2); }
    .tc .name.hit { fill: var(--accent); font-weight: 700; }
    .tc-find { font: 0.5rem var(--font-mono); padding: 0.14rem 0.4rem; border: 1px solid var(--rule); border-radius: 0.3rem;
      background: var(--surface); color: var(--ink); width: 9.5rem; }
    .tc-read { font: 0.46rem/1.45 var(--font-mono); color: var(--ink-2); min-height: 2.9em; }
    .tc-read b { color: var(--accent); font-weight: 600; }
    .tc .tooltip { font-size: 0.5rem; }
  `);

  const signed = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + " °C";

  // Shared: the SVG/PNG switch. `draw(ctx, W, H)` paints the flat version; hovering it reads one pixel.
  function pngMode(host, img, tip, draw) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    function paint() {
      const r = host.getBoundingClientRect(), W = Math.max(60, Math.round(r.width)), H = Math.max(40, Math.round(r.height));
      canvas.width = W; canvas.height = H; // 1 px per CSS px: a plain screenshot, no retina
      ctx.fillStyle = Deck.color("--surface"); ctx.fillRect(0, 0, W, H);
      draw(ctx, W, H);
      img.src = canvas.toDataURL("image/png");
    }
    img.addEventListener("pointermove", (ev) => {
      const b = img.getBoundingClientRect();
      const px = Math.floor((ev.clientX - b.left) * canvas.width / b.width), py = Math.floor((ev.clientY - b.top) * canvas.height / b.height);
      const [r, g, bl] = ctx.getImageData(px, py, 1, 1).data;
      tip.show(`<span style="display:inline-block;width:.7em;height:.7em;vertical-align:-.05em;border:1px solid #888;background:rgb(${r},${g},${bl})"></span>
        rgb(${r}, ${g}, ${bl})<br><span style="opacity:.7">that's all a PNG knows</span>`, ev);
    });
    img.addEventListener("pointerleave", () => tip.hide());
    return paint;
  }

  function segment(el, onChange) {
    const btns = el.querySelectorAll("[data-mode]");
    btns.forEach((b) => b.addEventListener("click", () => {
      btns.forEach((o) => o.classList.toggle("on", o === b));
      onChange(b.dataset.mode);
    }));
  }

  // ------------------------------------------------------------------ Respond
  Deck.widget("respond-demo", {
    mount(el) {
      el.innerHTML = `<div class="tc">
        <div class="tc-row">
          <span class="tc-seg"><button class="btn on" data-mode="svg">SVG</button><button class="btn" data-mode="png">PNG</button></span>
          <button class="btn" data-act="rec" aria-pressed="false">filter: record years</button>
          <span class="tc-hint"></span>
        </div>
        <div class="tc-plot"><svg></svg><img alt="" hidden></div></div>`;
      const plot = el.querySelector(".tc-plot"), svg = d3.select(plot).select("svg"), img = plot.querySelector("img");
      const hint = el.querySelector(".tc-hint"), recBtn = el.querySelector("[data-act=rec]");
      const tip = Deck.tooltip(el.querySelector(".tc"));
      const data = window.CLIMATE.global.values;
      // a record year: warmer than every year before it (the first year doesn't count)
      const records = new Set(data.filter((d, i) => i > 0 && d.anomaly > d3.max(data.slice(0, i), (p) => p.anomaly)).map((d) => d.year));
      const full = d3.extent(data, (d) => d.year);
      let mode = "svg", domain = full, rec = false;
      const m = { t: 6, r: 4, b: 13, l: 24 };

      const scales = (W, H, dom) => [d3.scaleLinear(dom, [m.l, W - m.r]), d3.scaleLinear([-0.7, 1.2], [H - m.b, m.t])];

      function render() {
        svg.selectAll("*").remove();
        if (mode === "png") return paintPng();
        const r = plot.getBoundingClientRect(), W = Math.max(60, r.width), H = Math.max(40, r.height);
        const [x, y] = scales(W, H, domain);
        const rows = data.filter((d) => d.year >= domain[0] && d.year <= domain[1]);
        svg.append("line").attr("class", "rule").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
        svg.append("text").attr("class", "lbl").attr("x", m.l - 3).attr("y", y(0) + 3).attr("text-anchor", "end").text("0");
        svg.append("text").attr("class", "lbl").attr("x", m.l - 3).attr("y", y(1) + 3).attr("text-anchor", "end").text("+1");
        svg.append("text").attr("class", "lbl").attr("x", m.l).attr("y", H - 2).text(domain[0]);
        svg.append("text").attr("class", "lbl").attr("x", W - m.r).attr("y", H - 2).attr("text-anchor", "end").text(domain[1]);
        svg.append("path").attr("class", "line" + (rec ? " dim" : ""))
          .attr("d", d3.line().x((d) => x(d.year)).y((d) => y(d.anomaly))(rows));
        if (rec) svg.selectAll(".rec").data(rows.filter((d) => records.has(d.year))).join("circle").attr("class", "rec")
          .attr("cx", (d) => x(d.year)).attr("cy", (d) => y(d.anomaly)).attr("r", 3);
        const cross = svg.append("line").attr("class", "cross").attr("y1", m.t).attr("y2", H - m.b).style("display", "none");

        const brush = d3.brushX().extent([[m.l, m.t], [W - m.r, H - m.b]])
          .on("end", (ev) => {
            if (!ev.selection) return;
            const [a, b] = ev.selection.map((v) => Math.round(x.invert(v)));
            if (b - a >= 4) { domain = [a, b]; render(); } else g.call(brush.move, null);
          });
        const g = svg.append("g").attr("class", "brush").call(brush)
          .on("dblclick", () => { domain = full; render(); })
          .on("pointermove.tip", (ev) => {
            const [px] = d3.pointer(ev, svg.node());
            const yr = Math.round(x.invert(px)), d = rows.find((r) => r.year === yr);
            if (!d) return;
            cross.style("display", null).attr("x1", x(yr)).attr("x2", x(yr));
            tip.show(`<b>${yr}</b> ${signed(d.anomaly)}${records.has(yr) ? "<br>a new record" : ""}`, ev);
          })
          .on("pointerleave.tip", () => { cross.style("display", "none"); tip.hide(); });
        const nRec = rows.filter((d) => records.has(d.year));
        hint.textContent = rec
          ? `${nRec.length} record years · ${nRec.filter((d) => d.year >= 2000).length} since 2000`
          : domain === full ? "drag to zoom · hover" : "double-click to zoom out";
      }

      const paintPng = pngMode(plot, img, tip, (ctx, W, H) => {
        const [x, y] = scales(W, H, full);
        ctx.strokeStyle = Deck.color("--rule"); ctx.beginPath(); ctx.moveTo(m.l, y(0)); ctx.lineTo(W - m.r, y(0)); ctx.stroke();
        ctx.fillStyle = Deck.color("--muted"); ctx.font = "9px monospace";
        ctx.fillText(full[0], m.l, H - 2); ctx.textAlign = "end"; ctx.fillText(full[1], W - m.r, H - 2);
        ctx.fillText("0", m.l - 3, y(0) + 3); ctx.fillText("+1", m.l - 3, y(1) + 3);
        ctx.strokeStyle = Deck.color("--ink"); ctx.lineWidth = 1.5; ctx.beginPath();
        d3.line().x((d) => x(d.year)).y((d) => y(d.anomaly)).context(ctx)(data); ctx.stroke();
        hint.textContent = "no zoom, no filter";
      });

      segment(el, (md) => {
        mode = md; img.hidden = md !== "png"; svg.style("display", md === "png" ? "none" : null);
        recBtn.disabled = md === "png"; tip.hide(); render();
      });
      recBtn.addEventListener("click", () => { rec = !rec; recBtn.setAttribute("aria-pressed", rec); render(); });
      Deck.onTheme(render);
      requestAnimationFrame(render);
      return { enter: render, resize: render };
    },
  });

  // ------------------------------------------------------------------ Be read by machines
  Deck.widget("machine-demo", {
    mount(el) {
      el.innerHTML = `<div class="tc">
        <div class="tc-row">
          <span class="tc-seg"><button class="btn on" data-mode="svg">SVG</button><button class="btn" data-mode="png">PNG</button></span>
          <input class="tc-find" type="search" placeholder="find: type a city…" spellcheck="false">
        </div>
        <div class="tc-plot"><svg role="img"></svg><img alt="" hidden></div>
        <div class="tc-read"></div></div>`;
      const plot = el.querySelector(".tc-plot"), svg = d3.select(plot).select("svg"), img = plot.querySelector("img");
      const find = el.querySelector(".tc-find"), read = el.querySelector(".tc-read");
      const tip = Deck.tooltip(el.querySelector(".tc"));
      const title = (s) => s.toLowerCase().replace(/^grad /, "").replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
      const rows = d3.csvParse(window.POPULATION_CSV, d3.autoType)
        .sort((a, b) => b.Population - a.Population).slice(0, 6)
        .map((d) => ({ name: title(d.Name), pop: d.Population }));
      const fmtN = d3.format(",");
      let mode = "svg";
      svg.attr("aria-label", "Bar chart: the six largest Croatian cities by population, 2011 census");

      function layout(W, H) {
        const y = d3.scaleBand(rows.map((d) => d.name), [2, H - 2]).padding(0.22);
        const x = d3.scaleLinear([0, rows[0].pop], [74, W - 46]);
        return [x, y];
      }

      function render() {
        if (mode === "png") { svg.selectAll("*").remove(); paintPng(); return update(); }
        const r = plot.getBoundingClientRect(), W = Math.max(60, r.width), H = Math.max(40, r.height);
        const [x, y] = layout(W, H);
        svg.selectAll("*").remove();
        const g = svg.selectAll("g").data(rows).join("g").attr("transform", (d) => `translate(0,${y(d.name)})`);
        g.append("rect").attr("class", "bar").attr("x", x(0)).attr("height", y.bandwidth()).attr("width", (d) => x(d.pop) - x(0)).attr("rx", 1.5);
        g.append("text").attr("class", "name").attr("x", x(0) - 5).attr("y", y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end").text((d) => d.name);
        g.append("text").attr("class", "val").attr("x", (d) => x(d.pop) + 4).attr("y", y.bandwidth() / 2).attr("dy", "0.35em").text((d) => fmtN(d.pop));
        update();
      }

      function update() {
        const q = find.value.trim().toLowerCase();
        const texts = svg.selectAll("text");
        const hits = q ? texts.filter(function () { return this.textContent.toLowerCase().includes(q); }) : d3.select(null);
        svg.selectAll(".name").classed("hit", function () { return !!q && this.textContent.toLowerCase().includes(q); });
        svg.selectAll(".bar").classed("hit", (d) => !!q && d.name.toLowerCase().includes(q));
        if (mode === "png") {
          read.innerHTML = `<code>&lt;img src="chart.png"&gt;</code>: <b>0</b> text nodes${q ? `, <b>0</b> matches for "${q}"` : ""}.<br>A screen reader, Ctrl-F and Google all get nothing.`;
          return;
        }
        const n = texts.size();
        read.innerHTML = q
          ? `<b>${hits.size()}</b> of ${n} &lt;text&gt; nodes match: ${hits.nodes().map((t) => `&lt;text&gt;${t.textContent}&lt;/text&gt;`).join(" ") || "none"}`
          : `<b>${n}</b> &lt;text&gt; nodes: ${texts.nodes().slice(0, 6).map((t) => t.textContent).join(" · ")} …<br>screen reader: "${svg.attr("aria-label")}"`;
      }

      const paintPng = pngMode(plot, img, tip, (ctx, W, H) => {
        const [x, y] = layout(W, H);
        ctx.font = "11px sans-serif"; ctx.textBaseline = "middle";
        for (const d of rows) {
          const cy = y(d.name) + y.bandwidth() / 2;
          ctx.fillStyle = Deck.color("--muted"); ctx.fillRect(x(0), y(d.name), x(d.pop) - x(0), y.bandwidth());
          ctx.fillStyle = Deck.color("--ink"); ctx.textAlign = "end"; ctx.fillText(d.name, x(0) - 5, cy);
          ctx.fillStyle = Deck.color("--ink-2"); ctx.textAlign = "start"; ctx.font = "10px monospace"; ctx.fillText(fmtN(d.pop), x(d.pop) + 4, cy);
          ctx.font = "11px sans-serif";
        }
      });

      segment(el, (md) => { mode = md; img.hidden = md !== "png"; svg.style("display", md === "png" ? "none" : null); tip.hide(); render(); });
      find.addEventListener("input", update);
      Deck.onTheme(render);
      requestAnimationFrame(render);
      return { enter: render, resize: render };
    },
  });
})();
