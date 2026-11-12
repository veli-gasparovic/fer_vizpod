/* anatomy: scales → axes → marks → (rescale) → shapes, built up layer by layer on one chart.
   Fixed 800-wide viewBox so the numbers in the code panel are the real ones (margin = 40).
   Steps: 0 margins + scales · 1 axes (+ invert under the pointer) · 2 marks (join)
          3 rescale (drag the y axis) · 4 d3.line / d3.area */
(function () {
  Deck.css("anatomy", `
    .an { display: grid; grid-template-columns: minmax(0, 1fr) 24.5rem; gap: 1.4rem; height: 100%; }
    .an-main { display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; }
    .an-main .controls { min-height: 2.1rem; }
    .an-grp { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.62rem; color: var(--muted); }
    .an-grp.off { display: none; }
    .an-crumbs { display: inline-flex; align-items: center; gap: 0.25rem; font: 600 0.6rem var(--font-mono); color: var(--muted); margin-right: auto; }
    .an-crumbs span { padding: 0.2rem 0.45rem; border-radius: 0.3rem; transition: background .3s, color .3s; }
    .an-crumbs span.done { color: var(--ink-2); }
    .an-crumbs span.on { background: var(--ink); color: var(--surface); }
    .an-crumbs i { font-style: normal; opacity: 0.5; }
    .an-svg { flex: 1 1 auto; min-height: 0; width: 100%; background: var(--surface); border: 1px solid var(--rule); border-radius: 0.55rem; touch-action: none; user-select: none; }
    .an-side { display: flex; flex-direction: column; gap: 0.8rem; min-height: 0; }
    .an-code { margin: 0; background: var(--code-bg); color: var(--code-ink); border-radius: 0.5rem; padding: 0.7rem 0.85rem; font: 0.62rem/1.6 var(--font-mono); white-space: pre; overflow: hidden; }
    .an-code .k { color: var(--tok-kw); } .an-code .d3 { color: var(--tok-d3); font-weight: 600; }
    .an-code .n { color: var(--tok-num); } .an-code .s { color: var(--tok-str); }
    .an-code .o { color: var(--tok-com); } .an-code .r { color: #fff; font-weight: 600; }
    .an-code .ro { display: block; margin-top: 0.6rem; padding-top: 0.55rem; border-top: 1px solid #ffffff1f; }
    .an-caption { font-size: 0.68rem; color: var(--ink-2); line-height: 1.45; }
    .an-caption b { color: var(--ink); }
    .an *, .an *::before { font-variant-ligatures: none !important; font-feature-settings: "liga" 0, "calt" 0 !important; }

    .an svg text { font-family: var(--font-sans); }
    .an .marg { fill: var(--surface-2); fill-rule: evenodd; }
    .an .plotbox { fill: none; stroke: var(--muted); stroke-dasharray: 4 4; }
    .an .ann line, .an .ann path { stroke: var(--ink-2); stroke-width: 1.4; fill: none; }
    .an .ann text { font: 13px var(--font-mono); fill: var(--ink-2); }
    .an .ann text.big { font: italic 600 20px var(--font-serif); fill: var(--ink-2); }
    .an .ann text.mut { fill: var(--muted); font-size: 12px; }
    .an .ann .em { fill: var(--accent); font-weight: 700; }
    .an .axis text { font: 13px var(--font-sans); fill: var(--ink-2); }
    .an .axis line, .an .axis path { stroke: var(--muted); }
    .an .dot { fill: var(--accent-2); stroke: var(--surface); stroke-width: 2.5; }
    .an .dot.hi { fill: var(--accent); }
    .an .line { fill: none; stroke: var(--accent-2); stroke-width: 3; stroke-linejoin: round; stroke-linecap: round; }
    .an .area { fill: var(--accent-2); fill-opacity: 0.16; }
    .an .guide { stroke: var(--ink-2); stroke-width: 1.2; stroke-dasharray: 3 4; }
    .an .pill rect { fill: var(--ink); }
    .an .pill text { font: 600 12px var(--font-mono); fill: var(--surface); text-anchor: middle; dominant-baseline: central; }
    .an .ygrab { fill: transparent; cursor: ns-resize; }
    .an .ygrab-hint { font: 600 12px var(--font-mono); fill: var(--accent); }
    .an svg.dragging, .an svg.dragging * { cursor: ns-resize !important; }
  `);

  const VW = 800, M = 40;
  const START = [2.5, 8.0, 5.5, 7.5, 6.2, 5.9, 4.3, 4.9, 4.3, 6.8, 9.6];
  const CURVES = { linear: d3.curveLinear, monotoneX: d3.curveMonotoneX };
  const CAPTIONS = [
    `<b>Margins first.</b> The scales map data (0–10) onto the plot area inside the margins. The y range is <b>flipped</b>: SVG's origin is the top-left corner and y grows downward.`,
    `<b>An axis is a scale, drawn.</b> <code>axisBottom(xScale)</code> renders ticks into a <code>&lt;g&gt;</code> that you move into place with a transform. Move the pointer over the plot: <code>invert</code> runs the scale backwards, pixels → data.`,
    `<b>Marks = the data join, positioned by the scales.</b> Every <code>cx</code> and <code>cy</code> is a scale call. Hover a circle. <b>new data</b> re-runs the join and the circles move.`,
    `<b>Rescale.</b> Change the domain, then transition the marks <i>and</i> the axis: they stay in sync because they share one scale. <b>Grab the y axis and drag it.</b>`,
    `<b>Shape generators.</b> <code>d3.line()</code> and <code>d3.area()</code> turn the whole array into one <code>&lt;path&gt;</code> string <code>d</code>. Same scales, a different mark. Next slide: what's inside <code>d</code>.`,
  ];

  // tiny syntax helpers for the code panel
  const K = (s) => `<span class="k">${s}</span>`;
  const D3 = `<span class="d3">d3</span>`;
  const N = (v) => `<span class="n">${v}</span>`;
  const S = (s) => `<span class="s">"${s}"</span>`;
  const C = (s) => `<span class="o">${s}</span>`;
  const R = (s) => `<span class="r">${s}</span>`;
  const ARROW = C("→");
  const pad = (s, n) => s + " ".repeat(Math.max(1, n - s.replace(/<[^>]+>/g, "").length));
  const f0 = d3.format(".0f"), f1 = d3.format(".1f"), f2 = d3.format(".2f");

  Deck.widget("anatomy", {
    steps: 4,
    mount(el) {
      el.innerHTML = `
        <div class="an">
          <div class="an-main">
            <div class="controls">
              <span class="an-crumbs">${["scales", "axes", "marks", "rescale", "shapes"].map((c) => `<span>${c}</span>`).join("<i>→</i>")}</span>
              <span class="an-grp" data-g="data"><button class="btn" data-a="data">new data</button></span>
              <span class="an-grp" data-g="dom">y domain <button class="btn" data-dom="10">[0, 10]</button><button class="btn" data-dom="50">[0, 50]</button></span>
              <span class="an-grp" data-g="curve">curve <button class="btn" data-curve="linear">linear</button><button class="btn" data-curve="monotoneX">monotoneX</button></span>
            </div>
            <svg class="an-svg"></svg>
          </div>
          <div class="an-side"><pre class="an-code"></pre><div class="an-caption"></div></div>
        </div>`;
      const svgEl = el.querySelector(".an-svg");
      const svg = d3.select(svgEl);
      const codeEl = el.querySelector(".an-code");
      const capEl = el.querySelector(".an-caption");

      const gMarg = svg.append("path").attr("class", "marg");
      const gBox = svg.append("rect").attr("class", "plotbox");
      const gAnn = svg.append("g").attr("class", "ann");
      const gShapes = svg.append("g").style("opacity", 0);
      const area = gShapes.append("path").attr("class", "area");
      const line = gShapes.append("path").attr("class", "line");
      const gx = svg.append("g").attr("class", "axis x-axis").style("opacity", 0);
      const gy = svg.append("g").attr("class", "axis y-axis").style("opacity", 0);
      const gGuide = svg.append("g").style("pointer-events", "none");
      const gMarks = svg.append("g").attr("class", "scatter-group").style("opacity", 0);
      const gPills = svg.append("g").style("pointer-events", "none");
      const yGrab = svg.append("rect").attr("class", "ygrab");
      const yHint = svg.append("text").attr("class", "ygrab-hint").style("opacity", 0);

      let W = VW, H = 450, step = 0;
      let data = START.map((y, x) => ({ x, y }));
      let ymax = 10, curve = "linear";
      let ptr = null;          // { px, py, i } — pointer in viewBox units; i = snapped circle
      let shapesShown = false;

      const xScale = d3.scaleLinear().domain([0, 10]);
      const yScale = d3.scaleLinear();
      const setScales = () => {
        xScale.range([M, W - M]);
        yScale.domain([0, ymax]).range([H - M, M]);
      };

      function measure() {
        const r = svgEl.getBoundingClientRect();
        if (r.width > 10 && r.height > 10) H = Math.max(300, Math.round((VW * r.height) / r.width / 10) * 10);
        svg.attr("viewBox", `0 0 ${W} ${H}`);
        setScales();
      }

      // ---------- static frame + step-0 annotations
      function frame() {
        gMarg.attr("d", `M0,0H${W}V${H}H0Z M${M},${M}V${H - M}H${W - M}V${M}Z`);
        gBox.attr("x", M).attr("y", M).attr("width", W - 2 * M).attr("height", H - 2 * M);
        gAnn.selectAll("*").remove();
        const a = gAnn;
        const arrow = (x1, y1, x2, y2) => {
          a.append("line").attr("x1", x1).attr("y1", y1).attr("x2", x2).attr("y2", y2);
          const ang = Math.atan2(y2 - y1, x2 - x1), s = 6;
          a.append("path").attr("d", `M${x2 - s * Math.cos(ang - 0.5)},${y2 - s * Math.sin(ang - 0.5)}L${x2},${y2}L${x2 - s * Math.cos(ang + 0.5)},${y2 - s * Math.sin(ang + 0.5)}`);
        };
        // SVG origin and axis directions
        a.append("circle").attr("cx", 8).attr("cy", 8).attr("r", 3.5).attr("fill", "var(--accent)");
        arrow(8, 8, 96, 8);
        a.append("text").attr("x", 101).attr("y", 13).text("x");
        arrow(8, 8, 8, 86);
        a.append("text").attr("x", 3).attr("y", 104).text("y");
        a.append("text").attr("class", "mut").attr("x", 20).attr("y", 30).text("(0, 0)");
        // margin dimension
        const mx = W / 2;
        arrow(mx, M / 2, mx, 2); arrow(mx, M / 2, mx, M - 2);
        a.append("text").attr("x", mx + 9).attr("y", M / 2 + 5).text(`margin = ${M}`);
        // x range bracket (bottom margin)
        const by = H - M + 13;
        a.append("path").attr("d", `M${M},${by - 6}V${by}H${W - M}V${by - 6}`);
        a.append("text").attr("x", M).attr("y", by + 18).html(`xScale(0) → <tspan class="em">${M}</tspan>`);
        a.append("text").attr("x", W - M).attr("y", by + 18).attr("text-anchor", "end").html(`xScale(10) → <tspan class="em">${W - M}</tspan>`);
        a.append("text").attr("class", "mut").attr("x", W / 2).attr("y", by + 18).attr("text-anchor", "middle").text("range [margin, width − margin]");
        // y range bracket (left margin)
        const bx = M - 13;
        a.append("path").attr("d", `M${bx + 6},${M}H${bx}V${H - M}H${bx + 6}`);
        a.append("text").attr("x", M + 12).attr("y", H - M - 12).html(`yScale(0) → <tspan class="em">${H - M}</tspan>`);
        a.append("text").attr("x", M + 12).attr("y", M + 22).html(`yScale(10) → <tspan class="em">${M}</tspan>`);
        a.append("text").attr("class", "mut").attr("x", M + 12).attr("y", H / 2 + 4).text("range [height − margin, margin]  ← flipped");
        // plot area label
        a.append("text").attr("class", "big").attr("x", W / 2 + 40).attr("y", H / 2 - 6).attr("text-anchor", "middle").text("plot area");
        a.append("text").attr("class", "mut").attr("x", W / 2 + 40).attr("y", H / 2 + 16).attr("text-anchor", "middle").text(`${W - 2 * M} × ${H - 2 * M}`);
      }
      
      // ---------- data layer
      function draw(dur = 0) {
        setScales();
        const t = svg.transition("an").duration(dur).ease(d3.easeCubicInOut);
        gx.attr("transform", `translate(0,${H - M})`);
        gy.attr("transform", `translate(${M},0)`);
        (dur ? gx.transition(t) : gx).call(d3.axisBottom(xScale).tickSizeOuter(0));
        (dur ? gy.transition(t) : gy).call(d3.axisLeft(yScale).ticks(Math.min(10, H / 45)).tickSizeOuter(0));

        const dots = gMarks.selectAll("circle").data(data).join((e) => e.append("circle").attr("class", "dot").attr("r", 6)
          .attr("cx", (d) => xScale(d.x)).attr("cy", (d) => yScale(d.y)));
        (dur ? dots.transition(t) : dots).attr("cx", (d) => xScale(d.x)).attr("cy", (d) => yScale(d.y));
        dots.classed("hi", (d, i) => ptr && ptr.i === i).attr("r", (d, i) => (ptr && ptr.i === i ? 9 : 6));

        const lg = d3.line().x((d) => xScale(d.x)).y((d) => yScale(d.y)).curve(CURVES[curve]);
        const ag = d3.area().x((d) => xScale(d.x)).y0(yScale(0)).y1((d) => yScale(d.y)).curve(CURVES[curve]);
        (dur ? line.transition(t) : line).attr("d", lg(data));
        (dur ? area.transition(t) : area).attr("d", ag(data));

        yGrab.attr("x", 0).attr("y", M - 10).attr("width", M + 4).attr("height", H - 2 * M + 20)
          .style("pointer-events", step >= 3 ? "all" : "none");
        yHint.attr("x", M + 10).attr("y", M - 14).text("↕ drag the axis");
        guides();
        code();
      }

      // ---------- pointer: crosshair + invert, snapping to circles from step 2
      function guides() {
        let px = null, py = null, lbl = null;
        if (ptr && step >= 1) {
          if (step >= 2 && ptr.i != null) {
            const d = data[ptr.i];
            px = xScale(d.x); py = yScale(d.y);
            lbl = [f0(d.x), f2(d.y)];
          } else {
            px = Math.max(M, Math.min(W - M, ptr.px)); py = Math.max(M, Math.min(H - M, ptr.py));
            lbl = [f2(xScale.invert(px)), f2(yScale.invert(py))];
          }
        }
        const on = px != null;
        gGuide.selectAll("line").data(on ? [[px, py, px, H - M], [px, py, M, py]] : []).join("line").attr("class", "guide")
          .attr("x1", (d) => d[0]).attr("y1", (d) => d[1]).attr("x2", (d) => d[2]).attr("y2", (d) => d[3]);
        const pills = on ? [{ x: px, y: H - M + 14, t: lbl[0] }, { x: M + 4, y: py, t: lbl[1], left: true }] : [];
        gPills.selectAll("g.pill").data(pills).join((e) => { const g = e.append("g").attr("class", "pill"); g.append("rect"); g.append("text"); return g; })
          .each(function (d) {
            const g = d3.select(this), w = d.t.length * 7.6 + 12;
            const cx = d.left ? d.x + w / 2 : d.x;
            g.select("rect").attr("x", cx - w / 2).attr("y", d.y - 10).attr("width", w).attr("height", 20).attr("rx", 4);
            g.select("text").attr("x", cx).attr("y", d.y).text(d.t);
          });
      }

      svg.on("pointermove", (ev) => {
        if (svgEl.classList.contains("dragging")) return;
        const [px, py] = d3.pointer(ev);
        let i = null;
        if (step >= 2) {
          const j = d3.leastIndex(data, (d) => Math.hypot(xScale(d.x) - px, yScale(d.y) - py));
          if (Math.hypot(xScale(data[j].x) - px, yScale(data[j].y) - py) < 28) i = j;
        }
        ptr = { px, py, i };
        gMarks.selectAll("circle").classed("hi", (d, k) => k === i).attr("r", (d, k) => (k === i ? 9 : 6));
        guides(); code();
      }).on("pointerleave", () => {
        if (svgEl.classList.contains("dragging")) return;
        ptr = null;
        gMarks.selectAll("circle").classed("hi", false).attr("r", 6);
        guides(); code();
      });

      // grab the y axis and stretch it: the value under the pointer follows the pointer
      let grabV = null;
      yGrab.call(d3.drag().container(svgEl)
        .on("start", (ev) => { svg.interrupt("an"); grabV = Math.max(0.5, yScale.invert(ev.y)); svgEl.classList.add("dragging"); ptr = null; })
        .on("drag", (ev) => {
          const py = Math.min(H - M - 8, ev.y);
          ymax = Math.round(Math.max(5, Math.min(100, (grabV * (H - 2 * M)) / (H - M - py))));
          draw(0); syncButtons();
        })
        .on("end", () => { svgEl.classList.remove("dragging"); }));

      // ---------- controls
      function setDomain(v, dur = 900, delay = 0) {
        if (ymax === v) return;
        ymax = v; syncButtons();
        if (delay) svg.transition("an").delay(delay).duration(0).on("end", () => draw(dur));
        else draw(dur);
      }
      function syncButtons() {
        el.querySelectorAll("[data-dom]").forEach((b) => b.classList.toggle("on", +b.dataset.dom === ymax));
        el.querySelectorAll("[data-curve]").forEach((b) => b.classList.toggle("on", b.dataset.curve === curve));
        el.querySelector('[data-g="data"]').classList.toggle("off", step < 2);
        el.querySelector('[data-g="dom"]').classList.toggle("off", step < 3);
        el.querySelector('[data-g="curve"]').classList.toggle("off", step < 4);
        el.querySelectorAll(".an-crumbs span").forEach((c, i) => { c.classList.toggle("on", i === step); c.classList.toggle("done", i < step); });
      }
      el.querySelector('[data-a="data"]').onclick = () => {
        data = d3.range(11).map((x) => ({ x, y: Math.random() * 10 }));
        draw(900);
      };
      el.querySelectorAll("[data-dom]").forEach((b) => (b.onclick = () => setDomain(+b.dataset.dom)));
      el.querySelectorAll("[data-curve]").forEach((b) => (b.onclick = () => { curve = b.dataset.curve; syncButtons(); draw(0); }));

      // ---------- code panel
      function code() {
        const tr = (s) => `${C("`")}${s}${C("`")}`;
        let h;
        if (step === 0) {
          h = `${K("const")} width = ${N(W)}, height = ${N(H)};
${K("const")} margin = ${N(M)};

${K("const")} xScale = ${D3}.scaleLinear()
    .domain([${N(0)}, ${N(10)}])
    .range([margin, width - margin]);
${K("const")} yScale = ${D3}.scaleLinear()
    .domain([${N(0)}, ${N(10)}])
    .range([height - margin, margin]); ${C("// flipped")}
<span class="ro">${pad(`xScale(${N(0)})`, 12)}${ARROW} ${R(M)}     ${pad(`xScale(${N(10)})`, 12)}${ARROW} ${R(W - M)}
${pad(`yScale(${N(0)})`, 12)}${ARROW} ${R(H - M)}    ${pad(`yScale(${N(10)})`, 12)}${ARROW} ${R(M)}</span>`;
        } else if (step === 1) {
          h = `svg.append(${S("g")})
    .attr(${S("transform")}, ${tr(`translate(${N(0)},\${height - margin})`)})
    .call(${D3}.axisBottom(xScale));

svg.append(${S("g")})
    .attr(${S("transform")}, ${tr(`translate(\${margin},${N(0)})`)})
    .call(${D3}.axisLeft(yScale));
${readout()}`;
        } else if (step === 2) {
          h = `${K("const")} scatterData = ${D3}.range(${N(11)})
    .map((i) => ({ x: i, y: Math.random() * ${N(10)} }));

svg.append(${S("g")})
  .selectAll(${S("circle")})
  .data(scatterData)
  .join(${S("circle")})
    .attr(${S("cx")}, (d) => xScale(d.x))
    .attr(${S("cy")}, (d) => yScale(d.y))
    .attr(${S("r")}, ${N(6)});
${readout()}`;
        } else if (step === 3) {
          h = `yScale.domain([${N(0)}, ${N(ymax)}]);

svg.selectAll(${S("circle")})
  .transition().duration(${N(1000)})
    .attr(${S("cy")}, (d) => yScale(d.y));

svg.select(${S(".y-axis")})
  .transition().duration(${N(1000)})
    .call(${D3}.axisLeft(yScale));
${readout()}`;
        } else {
          const lg = d3.line().x((d) => xScale(d.x)).y((d) => yScale(d.y)).curve(CURVES[curve]);
          const dstr = lg(data).replace(/(\d+\.\d)\d+/g, "$1");
          h = `${K("const")} line = ${D3}.line()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y))
    .curve(${D3}.curve${curve[0].toUpperCase() + curve.slice(1)});

${K("const")} area = ${D3}.area()
    .x((d) => xScale(d.x))
    .y0(yScale(${N(0)}))
    .y1((d) => yScale(d.y))
    .curve(${D3}.curve${curve[0].toUpperCase() + curve.slice(1)});

svg.append(${S("path")}).datum(scatterData).attr(${S("d")}, area);
svg.append(${S("path")}).datum(scatterData).attr(${S("d")}, line);
<span class="ro">line(scatterData) ${ARROW}
${R(`"${dstr.slice(0, 38)}…"`)}  ${C(`(${dstr.length} chars)`)}</span>`;
        }
        codeEl.innerHTML = h;
      }
      function readout() {
        if (!ptr) return `<span class="ro">${C(step >= 2 ? "// hover a circle, or anywhere on the plot" : "// move the pointer over the plot")}\n </span>`;
        if (step >= 2 && ptr.i != null) {
          const d = data[ptr.i];
          return `<span class="ro">${pad("d", 13)}${ARROW} ${R(`{x: ${d.x}, y: ${f2(d.y)}}`)}
${pad(`xScale(${N(d.x)})`, 13)}${ARROW} ${R(f1(xScale(d.x)))}   ${pad(`yScale(${N(f2(d.y))})`, 13)}${ARROW} ${R(f1(yScale(d.y)))}</span>`;
        }
        const px = Math.max(M, Math.min(W - M, ptr.px)), py = Math.max(M, Math.min(H - M, ptr.py));
        return `<span class="ro">${pad(`xScale.invert(${N(f0(px))})`, 19)}${ARROW} ${R(f2(xScale.invert(px)))}
${pad(`yScale.invert(${N(f0(py))})`, 19)}${ARROW} ${R(f2(yScale.invert(py)))}</span>`;
      }

      // ---------- steps
      function show(sel, on, dur = 500) { sel.transition().duration(dur).style("opacity", on ? 1 : 0); }
      function applyStep(prev) {
        syncButtons();
        draw(0);
        show(gAnn, step === 0);
        show(gMarg, step === 0, 400);
        show(gBox, step === 0, 400);
        show(gx, step >= 1); show(gy, step >= 1);
        show(yHint, step === 3);
        // marks: pop in when they first appear
        if (step >= 2 && prev < 2) {
          gMarks.interrupt().style("opacity", 1).selectAll("circle").attr("r", 0)
            .transition().delay((d, i) => 150 + i * 60).duration(450).ease(d3.easeBackOut).attr("r", 6);
        } else show(gMarks, step >= 2, 300);
        if (step < 3) setDomain(10, 600);
        if (step === 3 && prev < 3) setDomain(50, 1100, 450);
        // shapes: (rescale back first) draw the line, then fill the area
        if (step >= 4 && !shapesShown) {
          shapesShown = true;
          let wait = 250;
          if (ymax !== 10) { setDomain(10, 700); wait = 800; }
          gShapes.interrupt().style("opacity", 0);
          d3.timeout(() => {
            if (step < 4) return;
            gShapes.style("opacity", 1);
            const L = line.node().getTotalLength();
            line.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L)
              .transition("draw").duration(1100).ease(d3.easeCubicInOut).attr("stroke-dashoffset", 0)
              .on("end", () => line.attr("stroke-dasharray", null).attr("stroke-dashoffset", null));
            area.style("opacity", 0).transition("draw").delay(900).duration(700).style("opacity", 1);
          }, wait);
        } else if (step < 4 && shapesShown) {
          shapesShown = false;
          show(gShapes, false, 300);
        }
      }

      measure(); frame(); draw(0); syncButtons();

      return {
        step(n) {
          const prev = step;
          step = n;
          capEl.innerHTML = CAPTIONS[n];
          ptr = null;
          applyStep(prev);
        },
        resize() { measure(); frame(); draw(0); },
        enter() { measure(); frame(); draw(0); },
      };
    },
  });
})();
