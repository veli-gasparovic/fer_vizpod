/* scales: a scale is a function from data space (domain) to visual space (range).
   Steps: 0 linear · 1 inverted range (SVG y points down) · 2 log · 3 band · 4 sequential colour */
(function () {
  Deck.css("scales", `
    .sc { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; gap: 1.4rem; height: 100%; }
    .sc-main { display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; }
    .sc-svg { flex: 1 1 auto; min-height: 0; width: 100%; background: var(--surface); border: 1px solid var(--rule); border-radius: 0.55rem; touch-action: none; }
    .sc-side { display: flex; flex-direction: column; gap: 0.8rem; min-height: 0; }
    .sc-code { margin: 0; background: var(--code-bg); color: var(--code-ink); border-radius: 0.5rem; padding: 0.7rem 0.85rem; font: 0.58rem/1.6 var(--font-mono); white-space: pre; overflow: hidden; }
    .sc-code .d3 { color: var(--tok-d3); font-weight: 600; } .sc-code .n { color: var(--tok-num); } .sc-code .s { color: var(--tok-str); }
    .sc-code .o { color: var(--tok-com); } .sc-code .r { color: #fff; font-weight: 600; }
    .sc-caption { font-size: 0.68rem; color: var(--ink-2); line-height: 1.45; }
    .sc-caption b { color: var(--ink); }
    .sc-extra { display: inline-flex; align-items: center; gap: 0.4rem; }
    .sc-extra[hidden] { display: none; }
    .sc svg text { font-family: var(--font-sans); }
    .sc .lineLabel { font-size: 0.55rem; fill: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; }
    .sc .lineLabel tspan { font: italic 600 0.75rem var(--font-serif); fill: var(--ink-2); text-transform: none; letter-spacing: 0; }
    .sc .numline { stroke: var(--ink-2); stroke-width: 2; }
    .sc .axis text { font-size: 0.5rem; fill: var(--muted); }
    .sc .axis line, .sc .axis path { stroke: var(--rule); }
    .sc .map { stroke: var(--muted); stroke-opacity: 0.35; stroke-width: 1.2; fill: none; }
    .sc .span { stroke-width: 6; stroke-linecap: round; }
    .sc .span.dom { stroke: var(--accent-2); stroke-opacity: 0.55; }
    .sc .span.rng { stroke: var(--accent); stroke-opacity: 0.55; }
    .sc .handle { cursor: ew-resize; }
    .sc .handle circle { fill: var(--surface); stroke-width: 3; }
    .sc .handle.dom circle { stroke: var(--accent-2); }
    .sc .handle.rng circle { stroke: var(--accent); }
    .sc .handle text { font: 600 0.55rem var(--font-mono); fill: var(--ink-2); text-anchor: middle; }
    .sc .vline { stroke: var(--ink); stroke-width: 2.5; fill: none; }
    .sc .vmark { cursor: ew-resize; }
    .sc .vmark circle { fill: var(--ink); stroke: var(--surface); stroke-width: 2; }
    .sc .vmark text { font: 600 0.62rem var(--font-mono); fill: var(--ink); text-anchor: middle; }
    .sc .band rect { fill: var(--accent); fill-opacity: 0.12; stroke: var(--accent); stroke-opacity: 0.6; }
    .sc .band.sel rect { fill-opacity: 0.35; }
    .sc .band text, .sc .cat text { font: 600 0.6rem var(--font-mono); fill: var(--ink-2); text-anchor: middle; }
    .sc .cat circle { fill: var(--accent-2); }
    .sc .swatch { stroke: var(--surface); stroke-width: 3; }
      .sc *, .sc *::before { font-variant-ligatures: none !important; font-feature-settings: "liga" 0, "calt" 0 !important; }
  `);

  const CATS = ["A", "B", "C", "D", "E", "F"];
  const PRESETS = {
    linear: { d0: 0, d1: 100, r0: 40, r1: 760, v: 42 },
    inverted: { d0: 0, d1: 100, r0: 760, r1: 40, v: 42 },
    log: { d0: 1, d1: 1000, r0: 40, r1: 760, v: 42 },
    sqrt: { d0: 0, d1: 100, r0: 40, r1: 760, v: 42 },
    band: { r0: 40, r1: 760, vi: 2, pad: 0.2 },
    sequential: { d0: 0, d1: 100, v: 42 },
  };
  const STEP_PRESET = [["linear", "linear"], ["linear", "inverted"], ["log", "log"], ["band", "band"], ["sequential", "sequential"]];
  const CAPTIONS = [
    `Drag the handles. The <b>domain</b> is in data units, the <b>range</b> in pixels. Thin lines show where each tick lands; for a linear scale they're evenly spaced on both sides.`,
    `Flip the range. <b>SVG's y axis points down</b>, so y ranges are usually <code>[height, 0]</code> to make big values go up. The lines cross; the function is still linear.`,
    `A <b>log</b> scale spreads out small values and squeezes big ones: 1 → 10 takes as much room as 100 → 1000. The domain can't include 0.`,
    `<b>Categories → bands.</b> <code>x.bandwidth()</code> is the width of each bar; padding is the gap. The warming stripes use exactly this: one band per year, padding 0.`,
    `The range doesn't have to be pixels. Here it's a <b>colour ramp</b>. A diverging scale (RdBu) needs a midpoint. That's the warming stripes' colour scale.`,
  ];
  const INTERPS = { Blues: d3.interpolateBlues, Reds: d3.interpolateReds, RdBu: (t) => d3.interpolateRdBu(1 - t) };

  Deck.widget("scales", {
    steps: 4,
    mount(el) {
      el.innerHTML = `
        <div class="sc">
          <div class="sc-main">
            <div class="controls">
              ${["linear", "sqrt", "log", "band", "sequential"].map((t) => `<button class="btn" data-type="${t}">${t}</button>`).join("")}
              <span style="flex:1"></span>
              <label class="sc-extra" data-x="pad" hidden>padding <input type="range" min="0" max="0.6" step="0.05" value="0.2"></label>
              <span class="sc-extra" data-x="interp" hidden>${Object.keys(INTERPS).map((k) => `<button class="btn" data-interp="${k}">${k}</button>`).join("")}</span>
              <button class="btn" data-a="flip">flip range</button>
            </div>
            <svg class="sc-svg"></svg>
          </div>
          <div class="sc-side"><pre class="sc-code"></pre><div class="sc-caption"></div></div>
        </div>`;
      const svg = d3.select(el).select(".sc-svg");
      const defs = svg.append("defs");
      const grad = defs.append("linearGradient").attr("id", "sc-grad");
      const g = svg.append("g");
      const codeEl = el.querySelector(".sc-code");
      const capEl = el.querySelector(".sc-caption");
      const padInput = el.querySelector('[data-x="pad"] input');

      let W = 800, H = 400, rem = 16;
      let type = "linear", interp = "Blues";
      let st = { ...PRESETS.linear, vi: 2, pad: 0.2 };
      let ready = false;

      function measure() {
        rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const r = svg.node().getBoundingClientRect();
        if (r.width > 10) { W = r.width; H = r.height; }
        svg.attr("viewBox", `0 0 ${W} ${H}`);
      }
      const yD = () => H * 0.24, yR = () => H * 0.74;
      const m = () => 3 * rem;
      // display scales for the two number lines themselves
      const domDisp = () => {
        const ext = type === "log" ? [0, 1100] : [-10, 110];
        return d3.scaleLinear(ext, [m(), W - m()]);
      };
      const rngDisp = () => d3.scaleLinear([0, 800], [m(), W - m()]);

      function makeScale() {
        st.vi = Math.max(0, Math.min(CATS.length - 1, Math.round(st.vi)));
        if (type === "log") { st.d0 = Math.max(1, st.d0); st.d1 = Math.max(1, st.d1); st.v = Math.max(1, st.v); }
        if (type === "band") return d3.scaleBand(CATS, [st.r0, st.r1]).padding(st.pad);
        if (type === "sequential") {
          if (interp === "RdBu") return d3.scaleDiverging(INTERPS.RdBu).domain([st.d0, (st.d0 + st.d1) / 2, st.d1]);
          return d3.scaleSequential(INTERPS[interp]).domain([st.d0, st.d1]);
        }
        const s = type === "log" ? d3.scaleLog() : type === "sqrt" ? d3.scaleSqrt() : d3.scaleLinear();
        return s.domain([st.d0, st.d1]).range([st.r0, st.r1]);
      }
      const f1 = (v) => (Math.abs(v) >= 100 || Number.isInteger(v) ? d3.format(",.0f")(v) : d3.format(",.1f")(v)).replace(/\.0$/, "");

      function render() {
        const D = domDisp(), R = rngDisp(), s = makeScale();
        const isBand = type === "band", isSeq = type === "sequential";

        // --- static frame (labels, axes)
        g.selectAll(".lineLabel").data([
          { y: yD() - 3.5 * rem, sym: "domain", t: isBand ? "categories" : "data space" },
          { y: yR() + 3.9 * rem, sym: "range", t: isSeq ? "colours" : "pixels" },
        ]).join("text").attr("class", "lineLabel").attr("x", m()).attr("y", (d) => d.y)
          .html((d) => `<tspan>${d.sym}</tspan>  ${d.t}`);

        g.selectAll(".axis.dom").data(isBand ? [] : [0]).join("g").attr("class", "axis dom")
          .attr("transform", `translate(0,${yD() - 0.4 * rem})`)
          .call(d3.axisTop(D).ticks(type === "log" ? 11 : 12).tickSize(4).tickFormat(d3.format("~s")));
        g.selectAll(".axis.rng").data(isSeq || isBand ? [] : [0]).join("g").attr("class", "axis rng")
          .attr("transform", `translate(0,${yR() + 0.4 * rem})`)
          .call(d3.axisBottom(R).ticks(8).tickSize(4).tickFormat((d) => d + "px"));
        g.selectAll(".numline").data([yD(), ...(isSeq ? [] : [yR()])]).join("line").attr("class", "numline")
          .attr("x1", m()).attr("x2", W - m()).attr("y1", (d) => d).attr("y2", (d) => d);

        // colour bar for sequential
        if (isSeq) {
          grad.selectAll("stop").data(d3.range(0, 1.001, 0.05)).join("stop")
            .attr("offset", (t) => t).attr("stop-color", (t) => INTERPS[interp](t));
        }
        g.selectAll(".cbar").data(isSeq ? [0] : []).join("rect").attr("class", "cbar")
          .attr("x", m()).attr("width", W - 2 * m()).attr("y", yR() - 0.8 * rem).attr("height", 1.6 * rem).attr("rx", 0.3 * rem)
          .attr("fill", "url(#sc-grad)");

        // --- mapping lines (ticks of the domain → where they land)
        let maps = [];
        if (isBand) maps = CATS.map((c, i) => ({ x1: catX(i), x2: R(s(c) + s.bandwidth() / 2), key: c }));
        else {
          const lo = Math.min(st.d0, st.d1), hi = Math.max(st.d0, st.d1);
          const ticks = type === "log" ? d3.scaleLog().domain([lo, hi]).ticks() : d3.ticks(lo, hi, 10);
          maps = ticks.map((t) => ({ x1: D(t), x2: isSeq ? seqX(s, t) : R(s(t)), key: t }));
        }
        g.selectAll(".map").data(maps, (d) => d.key).join("path").attr("class", "map")
          .attr("d", (d) => curve(d.x1, d.x2));

        // --- domain span + handles
        g.selectAll(".span.dom").data(isBand ? [] : [0]).join("line").attr("class", "span dom")
          .attr("x1", D(st.d0)).attr("x2", D(st.d1)).attr("y1", yD()).attr("y2", yD());
        g.selectAll(".span.rng").data(isSeq ? [] : [0]).join("line").attr("class", "span rng")
          .attr("x1", R(st.r0)).attr("x2", R(st.r1)).attr("y1", yR()).attr("y2", yR());

        handles("dom", isBand ? [] : [{ k: "d0", x: D(st.d0), label: f1(st.d0) }, { k: "d1", x: D(st.d1), label: f1(st.d1) }], yD(), -1);
        handles("rng", isSeq ? [] : [{ k: "r0", x: R(st.r0), label: f1(st.r0) }, { k: "r1", x: R(st.r1), label: f1(st.r1) }], yR(), 1);

        // --- band: categories as points + bands as rects
        g.selectAll(".cat").data(isBand ? CATS : []).join((e) => {
          const c = e.append("g").attr("class", "cat");
          c.append("circle").attr("r", 0.32 * rem);
          c.append("text").attr("y", -0.8 * rem);
          return c;
        }).attr("transform", (d, i) => `translate(${catX(i)},${yD()})`).select("text").text((d) => d);
        g.selectAll(".band").data(isBand ? CATS : []).join((e) => {
          const b = e.append("g").attr("class", "band");
          b.append("rect"); b.append("text");
          return b;
        }).classed("sel", (d, i) => i === st.vi)
          .call((b) => b.select("rect").attr("x", (d) => R(Math.min(s(d), s(d) + s.bandwidth())))
            .attr("width", isBand ? Math.max(1, Math.abs(R(s.bandwidth()) - R(0))) : 0).attr("y", yR() - 3 * rem).attr("height", 2.4 * rem).attr("rx", 0.2 * rem))
          .call((b) => b.select("text").attr("x", (d) => R(s(d) + s.bandwidth() / 2)).attr("y", yR() - 1.8 * rem).attr("dominant-baseline", "central").text((d) => d));

        // --- the value
        let vx, out, outX;
        if (isBand) { const c = CATS[st.vi]; vx = catX(st.vi); out = s(c); outX = R(s(c) + s.bandwidth() / 2); }
        else { vx = D(st.v); out = s(st.v); outX = isSeq ? seqX(s, st.v) : R(out); }
        g.selectAll(".vline").data([0]).join("path").attr("class", "vline").attr("d", curve(vx, outX));
        g.selectAll(".swatch").data(isSeq ? [0] : []).join("circle").attr("class", "swatch")
          .attr("cx", outX).attr("cy", yR()).attr("r", 1.25 * rem).attr("fill", out);
        const vm = g.selectAll(".vmark.in").data([{ v: isBand ? CATS[st.vi] : st.v }]).join((e) => {
          const k = e.append("g").attr("class", "vmark in");
          k.append("circle").attr("r", 0.55 * rem);
          k.append("text").attr("x", 0.85 * rem).attr("y", 1.45 * rem).style("text-anchor", "start");
          return k;
        }).attr("transform", `translate(${vx},${yD()})`);
        vm.select("text").text(isBand ? `"${CATS[st.vi]}"` : f1(st.v));
        vm.call(dragValue);
        const om = g.selectAll(".vmark.out").data(isSeq ? [] : [{ px: isBand ? out : out }]).join((e) => {
          const k = e.append("g").attr("class", "vmark out");
          k.append("circle").attr("r", 0.55 * rem);
          k.append("text").attr("x", 0.85 * rem).style("text-anchor", "start");
          return k;
        }).attr("transform", `translate(${isBand ? R(out) : outX},${yR()})`);
        om.select("text").attr("y", isBand ? 1.6 * rem : -0.9 * rem);
        om.select("text").text(f1(out) + "px");
        if (!isBand && !isSeq) om.call(dragOut); else om.on(".drag", null);
        g.selectAll(".vmark").raise();
        g.selectAll(".handle").raise();

        renderCode(s, out);
      }

      const catX = (i) => d3.scalePoint(CATS, [m() + 4 * rem, W - m() - 4 * rem])(CATS[i]);
      const seqX = (s, v) => {
        const t = (v - st.d0) / (st.d1 - st.d0 || 1);
        return m() + Math.max(0, Math.min(1, t)) * (W - 2 * m());
      };
      function curve(x1, x2) {
        const y1 = yD() + 0.2 * rem, y2 = yR() - (type === "sequential" ? 0.9 * rem : type === "band" ? 3.05 * rem : 0.2 * rem), my = (y1 + y2) / 2;
        return `M${x1},${y1}C${x1},${my} ${x2},${my} ${x2},${y2}`;
      }

      function handles(cls, data, y, side) {
        const h = g.selectAll(`.handle.${cls}`).data(data, (d) => d.k).join((e) => {
          const k = e.append("g").attr("class", `handle ${cls}`);
          k.append("circle").attr("r", 0.62 * rem);
          k.append("text").attr("y", side < 0 ? -2.05 * rem : 2.55 * rem);
          return k;
        }).attr("transform", (d) => `translate(${d.x},${y})`);
        h.select("text").text((d) => d.label);
        h.call(d3.drag().container(svg.node()).on("drag", (ev, d) => {
          if (cls === "dom") {
            const D = domDisp();
            let v = D.invert(Math.max(m(), Math.min(W - m(), ev.x)));
            if (type === "log") v = Math.max(1, v);
            st[d.k] = Math.round(v);
            if (st.d0 === st.d1) st[d.k] += 1;
          } else {
            const R = rngDisp();
            st[d.k] = Math.round(R.invert(Math.max(m(), Math.min(W - m(), ev.x))));
          }
          render();
        }));
      }
      const dragValue = d3.drag().container(() => svg.node()).on("drag", (ev) => {
        if (type === "band") {
          const xs = CATS.map((c, i) => catX(i));
          st.vi = d3.leastIndex(xs, (x) => Math.abs(x - ev.x));
        } else {
          const D = domDisp();
          let v = D.invert(Math.max(m(), Math.min(W - m(), ev.x)));
          if (type === "log") v = Math.max(1, v);
          st.v = Math.round(v * 10) / 10;
        }
        render();
      });
      const dragOut = d3.drag().container(() => svg.node()).on("drag", (ev) => {
        const R = rngDisp(), s = makeScale();
        let v = s.invert(R.invert(Math.max(m(), Math.min(W - m(), ev.x))));
        if (type === "log") v = Math.max(1, v);
        st.v = Math.round(v * 10) / 10;
        render();
      });

      function renderCode(s, out) {
        const N = (v) => `<span class="n">${f1(v)}</span>`;
        const ctor = { linear: "scaleLinear", log: "scaleLog", sqrt: "scaleSqrt", band: "scaleBand" }[type];
        let html;
        if (type === "band") {
          html = `const x = <span class="d3">d3</span>.${ctor}()
    .domain([${CATS.map((c) => `<span class="s">"${c}"</span>`).join(",")}])
    .range([${N(st.r0)}, ${N(st.r1)}])
    .padding(${N(st.pad)});

x(<span class="s">"${CATS[st.vi]}"</span>)        <span class="o">→</span> <span class="r">${f1(out)}</span>
x.bandwidth()  <span class="o">→</span> <span class="r">${f1(s.bandwidth())}</span>
x.step()       <span class="o">→</span> <span class="r">${f1(s.step())}</span>`;
        } else if (type === "sequential") {
          const c = d3.color(out).formatHex();
          html = interp === "RdBu"
            ? `const color = <span class="d3">d3</span>.scaleDiverging(
    t => <span class="d3">d3</span>.interpolateRdBu(1 - t))
  .domain([${N(st.d0)}, ${N((st.d0 + st.d1) / 2)}, ${N(st.d1)}]);`
            : `const color = <span class="d3">d3</span>.scaleSequential(
    <span class="d3">d3</span>.interpolate${interp})
  .domain([${N(st.d0)}, ${N(st.d1)}]);`;
          html += `

color(${N(st.v)})  <span class="o">→</span> <span class="r" style="color:${c}">■</span> <span class="r">"${c}"</span>`;
        } else {
          html = `const x = <span class="d3">d3</span>.${ctor}()
    .domain([${N(st.d0)}, ${N(st.d1)}])
    .range([${N(st.r0)}, ${N(st.r1)}]);

x(${N(st.v)})${" ".repeat(Math.max(1, 9 - f1(st.v).length))}<span class="o">→</span> <span class="r">${f1(out)}</span>
x.invert(${N(out)}) <span class="o">→</span> <span class="r">${f1(s.invert(out))}</span>`;
        }
        codeEl.innerHTML = html;
      }

      // --- presets / controls
      function setType(t, preset, animate = true) {
        const prev = { ...st };
        type = t;
        const target = { ...st, ...PRESETS[preset || t] };
        el.querySelectorAll("[data-type]").forEach((b) => b.classList.toggle("on", b.dataset.type === t));
        el.querySelector('[data-x="pad"]').hidden = t !== "band";
        el.querySelector('[data-x="interp"]').hidden = t !== "sequential";
        el.querySelector('[data-a="flip"]').hidden = t === "sequential";
        padInput.value = target.pad;
        if (!animate || !ready) { st = target; render(); return; }
        svg.interrupt("preset");
        const i = d3.interpolateObject(prev, target);
        st = i(0); render();
        svg.transition("preset").duration(700).ease(d3.easeCubicInOut)
          .tween("st", () => (t) => { st = i(t); if (t === 1) st = target; render(); });
      }
      el.querySelectorAll("[data-type]").forEach((b) => (b.onclick = () => setType(b.dataset.type)));
      el.querySelectorAll("[data-interp]").forEach((b) => (b.onclick = () => {
        interp = b.dataset.interp;
        el.querySelectorAll("[data-interp]").forEach((x) => x.classList.toggle("on", x === b));
        render();
      }));
      el.querySelector('[data-interp="Blues"]').classList.add("on");
      padInput.oninput = () => { st.pad = +padInput.value; render(); };
      el.querySelector('[data-a="flip"]').onclick = () => {
        const target = { ...st, r0: st.r1, r1: st.r0 };
        const i = d3.interpolateObject({ ...st }, target);
        svg.transition("preset").duration(600).tween("st", () => (t) => { st = i(t); if (t === 1) st = target; render(); });
      };

      measure();
      setType("linear", "linear", false);
      ready = true;

      return {
        step(n) {
          capEl.innerHTML = CAPTIONS[n];
          const [t, p] = STEP_PRESET[n];
          setType(t, p, true);
        },
        resize() { measure(); render(); },
      };
    },
  });
})();
