/* lineage: four tiny demos for slide 4 ("From a mantra to the front page"), one per card.
   Each one is there so students *feel* the idea before we name it.
     lin-mantra    Shneiderman 1996: overview (stripes) → zoom (brush) → details on demand (hover)
     lin-anim      Heer & Robertson 2007: the same change, instant vs animated. "Follow the red bar."
     lin-reactive  Bret Victor 2011: a reactive sentence. Drag the numbers; the text and stripes recompute.
     lin-paths     512 Paths 2012: 9 swing states × win/lose = 512 paths. Fix a state, the tree prunes.
   data-opt {"at": n}: the slide step at which the card appears (autoplay starts there). */
(function () {
  Deck.css("lineage", `
    .lin { position: relative; height: 100%; display: flex; flex-direction: column; gap: 0.3rem; min-height: 0; }
    .lin svg { display: block; width: 100%; flex: 1 1 auto; min-height: 0; overflow: visible; }
    .lin .tag { font: 600 0.46rem var(--font-mono); color: var(--muted); letter-spacing: 0.04em; text-transform: uppercase; }
    .lin .tag b { color: var(--accent); font-weight: 700; }
    .lin .row { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
    .lin .btn { font-size: 0.5rem; padding: 0.12rem 0.45rem; }
    .lin .axis text { font: 0.42rem var(--font-mono); fill: var(--muted); }
    .lin .axis line, .lin .axis path { stroke: var(--rule); }
    .lin .tooltip { font-size: 0.5rem; }
    .lin-card-demo { flex: 1 1 auto; min-height: 11rem; margin: 0.15rem 0 0.2rem; }
    .lin-card-link { margin-top: auto; font-size: 0.5rem; }
    .lin-card-link a { color: var(--muted); }

    /* mantra */
    .lm .sel { fill: none; stroke: var(--ink); stroke-width: 1.5; }
    .lm .brush .selection { fill: none; stroke: var(--ink); stroke-width: 1.5; }
    .lm .brush .handle { fill: var(--ink); }
    .lm .bar.hi { stroke: var(--ink); stroke-width: 1.5; }

    /* animated vs instant */
    .la-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; flex: 1 1 auto; min-height: 0; }
    .la-panel { display: flex; flex-direction: column; min-height: 0; }
    .la .bar { fill: color-mix(in srgb, var(--ink) 22%, var(--surface)); }
    .la .bar.me { fill: var(--accent); }
    .la-q { font-size: 0.56rem; color: var(--ink-2); }
    .la-q b { color: var(--accent); }

    /* reactive document */
    .lr-text { font: 0.72rem/1.6 var(--font-serif); color: var(--ink); }
    .lr-out { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .lr { user-select: none; -webkit-user-select: none; }
    .lr-fix { display: inline-block; text-align: center; white-space: nowrap; }
    .lr-fix.left { text-align: left; } .lr-fix.right { text-align: right; }
    .lr-out.warm { color: var(--accent); } .lr-out.cold { color: var(--accent-2); }
    .lr-val { font-weight: 700; font-variant-numeric: tabular-nums; }
    .lr .win { fill: none; stroke: var(--ink); stroke-width: 2; rx: 2; }
    .lr .yr { fill: none; stroke: var(--ink); stroke-width: 1; }
    .lr .mark { fill: var(--ink); }
    .lr svg.grabbing { cursor: grabbing !important; }
    .lr .tag b { color: var(--ink-2); }
    .lr .lbl { font: 0.42rem var(--font-mono); fill: var(--ink-2); }

    /* 512 paths */
    .lp .node { stroke: var(--surface); stroke-width: 0.5; cursor: pointer; }
    .lp .col text { font: 600 0.42rem var(--font-mono); fill: var(--ink-2); text-anchor: middle; }
    .lp .col .ev { font-weight: 400; fill: var(--muted); }
    .lp .col.fixed text { fill: var(--ink); }
    .lp-read { font-size: 0.52rem; color: var(--ink-2); font-variant-numeric: tabular-nums; }
    .lp-read b.D { color: var(--accent-2); } .lp-read b.R { color: var(--accent); }
  `);

  const values = () => window.CLIMATE.global.values;
  const RDBU = (max) => d3.scaleDiverging([max, 0, -max], d3.interpolateRdBu).clamp(true);
  const fmt = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2) + " °C";
  const size = (svg) => { const r = svg.node().getBoundingClientRect(); return [Math.max(40, r.width), Math.max(40, r.height)]; };

  // Shared lifecycle: render on mount/resize/theme, autoplay only while the slide is active and the card is shown.
  function lifecycle(el, opts, render, play) {
    const at = +opts.at || 0;
    let active = false, step = 0, stopper = null;
    const sync = () => {
      const want = play && active && step >= at;
      if (want && !stopper) stopper = play();
      if (!want && stopper) { stopper(); stopper = null; }
    };
    Deck.onTheme(() => render());
    requestAnimationFrame(render);
    return {
      step(n) { step = n; sync(); },
      enter() { active = true; render(); sync(); },
      leave() { active = false; sync(); },
      resize: render,
    };
  }

  // ------------------------------------------------------------------ 1. Shneiderman
  Deck.widget("lin-mantra", {
    mount(el, { opts }) {
      el.innerHTML = `<div class="lin lm">
        <div class="tag"><b>1</b> overview · <b>2</b> zoom: drag the box · <b>3</b> details: hover</div>
        <svg></svg></div>`;
      const svg = d3.select(el).select("svg");
      const tip = Deck.tooltip(el.querySelector(".lin"));
      const data = values();
      const color = RDBU(1.1);
      let sel = [1976, 2025];

      function render() {
        const [W, H] = size(svg);
        svg.selectAll("*").remove();
        const oh = 24, gap = 16, top = oh + gap, m = { l: 26, r: 2, b: 14 };
        // overview: every year as a stripe
        const xo = d3.scaleBand(data.map((d) => d.year), [0, W]);
        const ov = svg.append("g");
        ov.selectAll("rect").data(data).join("rect")
          .attr("x", (d) => xo(d.year)).attr("width", xo.bandwidth() + 0.5).attr("height", oh)
          .attr("fill", (d) => color(d.anomaly));
        svg.append("text").attr("class", "lbl").attr("x", 0).attr("y", oh + 10)
          .style("font", "0.42rem var(--font-mono)").style("fill", "var(--muted)").text("1850");
        svg.append("text").attr("x", W).attr("y", oh + 10).attr("text-anchor", "end")
          .style("font", "0.42rem var(--font-mono)").style("fill", "var(--muted)").text("2025");

        // detail: bars for the selected years
        const detail = svg.append("g");
        const ax = svg.append("g").attr("class", "axis");
        const ay = svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`);
        const y = d3.scaleLinear([-0.6, 1.2], [H - m.b, top + 4]);
        ay.call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat((v) => (v > 0 ? "+" : "") + v))
          .call((g) => g.select(".domain").remove())
          .call((g) => g.selectAll(".tick line").attr("stroke-opacity", 0.6));

        function drawDetail() {
          const rows = data.filter((d) => d.year >= sel[0] && d.year <= sel[1]);
          const x = d3.scaleBand(rows.map((d) => d.year), [m.l + 2, W - m.r]).padding(0.12);
          detail.selectAll("rect").data(rows, (d) => d.year).join("rect")
            .attr("class", "bar")
            .attr("x", (d) => x(d.year)).attr("width", x.bandwidth())
            .attr("y", (d) => y(Math.max(0, d.anomaly))).attr("height", (d) => Math.abs(y(d.anomaly) - y(0)))
            .attr("fill", (d) => color(d.anomaly))
            .on("pointerenter", function (ev, d) {
              d3.select(this).classed("hi", true);
              tip.show(`<b>${d.year}</b><br>${fmt(d.anomaly)} vs 1961–1990`, ev);
            })
            .on("pointermove", (ev, d) => tip.show(`<b>${d.year}</b><br>${fmt(d.anomaly)} vs 1961–1990`, ev))
            .on("pointerleave", function () { d3.select(this).classed("hi", false); tip.hide(); });
          const a = x.domain(), every = a.length > 60 ? 25 : a.length > 20 ? 10 : 5, near = Math.ceil(every / 2);
          const ticks = a.filter((yr, i) => yr % every === 0 && yr - a[0] >= near && a[a.length - 1] - yr >= near);
          ticks.unshift(a[0]); ticks.push(a[a.length - 1]);
          ax.attr("transform", `translate(0,${H - m.b})`)
            .call(d3.axisBottom(x).tickValues(ticks).tickSize(0).tickPadding(4))
            .call((g) => g.select(".domain").remove());
        }

        const brush = d3.brushX().extent([[0, 0], [W, oh]])
          .on("brush end", (ev) => {
            if (!ev.selection) { if (ev.type === "end" && ev.sourceEvent) bg.call(brush.move, [xo(sel[0]), xo(sel[1]) + xo.bandwidth()]); return; }
            const yrs = data.map((d) => d.year).filter((yr) => {
              const c = xo(yr) + xo.bandwidth() / 2; return c >= ev.selection[0] && c <= ev.selection[1];
            });
            if (yrs.length >= 3) { sel = [yrs[0], yrs[yrs.length - 1]]; drawDetail(); }
          });
        const bg = svg.append("g").attr("class", "brush").call(brush);
        bg.call(brush.move, [xo(sel[0]), xo(sel[1]) + xo.bandwidth()]);
        drawDetail();
      }
      return lifecycle(el, opts, render);
    },
  });

  // ------------------------------------------------------------------ 2. Heer & Robertson
  Deck.widget("lin-anim", {
    mount(el, { opts }) {
      el.innerHTML = `<div class="lin la">
        <div class="la-q">Every 3 s the data changes and re-sorts. <b>Follow the red bar.</b></div>
        <div class="la-panels">
          <div class="la-panel"><div class="tag">instant</div><svg data-k="instant"></svg></div>
          <div class="la-panel"><div class="tag"><b>animated</b> + keyed</div><svg data-k="anim"></svg></div>
        </div>
        <div class="row"><button class="btn" data-a="go">change now</button><button class="btn" data-a="pause" aria-pressed="false">pause</button></div>
      </div>`;
      const N = 9, ME = 4;
      const rnd = d3.randomUniform(10, 100);
      let data = d3.range(N).map((id) => ({ id, v: rnd() }));
      let paused = false;

      function draw(animate) {
        const sorted = data.slice().sort((a, b) => b.v - a.v);
        el.querySelectorAll("svg").forEach((node) => {
          const svg = d3.select(node), [W, H] = size(svg), anim = node.dataset.k === "anim";
          const y = d3.scaleBand(sorted.map((d) => d.id), [0, H]).padding(0.18);
          const x = d3.scaleLinear([0, 100], [0, W]);
          const bars = svg.selectAll("rect").data(data, (d) => d.id).join("rect")
            .attr("class", (d) => "bar" + (d.id === ME ? " me" : "")).attr("rx", 2).attr("height", y.bandwidth());
          const t = anim && animate ? bars.transition().duration(1100).ease(d3.easeCubicInOut) : bars;
          t.attr("y", (d) => y(d.id)).attr("width", (d) => x(d.v));
        });
      }
      function change() { data = data.map((d) => ({ id: d.id, v: rnd() })); draw(true); }
      el.querySelector('[data-a="go"]').onclick = change;
      el.querySelector('[data-a="pause"]').onclick = (e) => {
        paused = !paused; e.currentTarget.setAttribute("aria-pressed", paused);
      };
      const play = () => { const h = setInterval(() => !paused && change(), 3000); return () => clearInterval(h); };
      return lifecycle(el, opts, () => draw(false), play);
    },
  });

  // ------------------------------------------------------------------ 3. Bret Victor
  Deck.widget("lin-reactive", {
    mount(el, { opts }) {
      el.innerHTML = `<div class="lin lr">
        <div class="lr-text">Measured against the 30 years from
          <span class="lr-val lr-fix" data-o="start"></span>–<span class="lr-val lr-fix" data-o="end"></span>,
          the year <span class="lr-val lr-fix" data-o="year"></span> was
          <span class="lr-out lr-fix left" data-o="diff"></span>
          <span class="lr-out lr-fix right" data-o="warm"></span> of the 176 years since 1850 are warmer than that baseline.</div>
        <div class="tag">drag the <b>baseline</b> · click a <b>year</b></div>
        <svg></svg></div>`;
      const data = values();
      const byYear = new Map(data.map((d) => [d.year, d.anomaly]));
      const color = RDBU(1.2);
      const st = { start: 1961, year: 2024 };
      const svg = d3.select(el).select("svg");

      // Every value that changes gets a fixed width (its widest possible text), so dragging never re-wraps the sentence.
      const yrs = (a, b) => d3.range(a, b + 1).map(String);
      let fitted = false;
      function fit() {
        const digit = d3.greatest("0123456789", (c) => measure(el.querySelector('[data-o="diff"]'), c));
        const samples = {
          '[data-o="start"]': yrs(1850, 1996), '[data-o="end"]': yrs(1879, 2025), '[data-o="year"]': yrs(1850, 2025),
          '[data-o="diff"]': ["warmer.", "colder."].map((w) => `${digit}.${digit}${digit} °C ${w}`),
          '[data-o="warm"]': [digit.repeat(3)],
        };
        let ok = true;
        for (const [sel, list] of Object.entries(samples)) {
          const span = el.querySelector(sel), w = d3.max(list, (t) => measure(span, t));
          if (!w) ok = false; else span.style.minWidth = Math.ceil(w) + "px";
        }
        fitted = ok;
      }
      function measure(span, text) {
        const m = document.createElement("span");
        m.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
        m.textContent = text; span.appendChild(m);
        const w = m.offsetWidth; m.remove(); return w;
      }
      document.fonts?.ready.then(() => { fitted = false; render(); });

      function baseline() { return d3.mean(data.filter((d) => d.year >= st.start && d.year < st.start + 30), (d) => d.anomaly); }

      function render() {
        if (!fitted) fit();
        const b = baseline(), diff = byYear.get(st.year) - b;
        el.querySelector('[data-o="start"]').textContent = st.start;
        el.querySelector('[data-o="end"]').textContent = st.start + 29;
        el.querySelector('[data-o="year"]').textContent = st.year;
        const o = el.querySelector('[data-o="diff"]');
        o.textContent = `${Math.abs(diff).toFixed(2)} °C ${diff >= 0 ? "warmer" : "colder"}.`;
        o.classList.toggle("warm", diff >= 0); o.classList.toggle("cold", diff < 0);
        el.querySelector('[data-o="warm"]').textContent = data.filter((d) => d.anomaly > b).length;

        const [W, H] = size(svg);
        x = d3.scaleBand(data.map((d) => d.year), [0, W]);
        const sh = H - TOP - BOT;
        svg.selectAll("rect.s").data(data, (d) => d.year).join("rect").attr("class", "s")
          .attr("x", (d) => x(d.year)).attr("width", x.bandwidth() + 0.5).attr("y", TOP).attr("height", sh)
          .attr("fill", (d) => color(d.anomaly - b));
        // the baseline: a box you drag
        const bx = x(st.start), bw = x(st.start + 29) + x.bandwidth() - bx;
        svg.selectAll("rect.win").data([0]).join("rect").attr("class", "win")
          .attr("x", bx).attr("y", TOP - 1).attr("width", bw).attr("height", sh + 2);
        svg.selectAll("text.lb").data([0]).join("text").attr("class", "lbl lb").attr("y", TOP - 4)
          .attr("x", Math.min(Math.max(bx + bw / 2, 34), W - 34)).attr("text-anchor", "middle").text("⇠ baseline ⇢");
        // the year: an outlined stripe and a marker you can drag
        const yx = x(st.year);
        svg.selectAll("rect.yr").data([0]).join("rect").attr("class", "yr")
          .attr("x", yx - 0.5).attr("y", TOP).attr("width", x.bandwidth() + 1).attr("height", sh);
        const mx = yx + x.bandwidth() / 2, my = TOP + sh + 2;
        svg.selectAll("path.mark").data([0]).join("path").attr("class", "mark")
          .attr("d", `M${mx - 5},${my + 9}L${mx + 5},${my + 9}L${mx},${my}Z`);
      }

      // Pointer: press inside the baseline box to slide it; anywhere else (or on the ▲) to scrub the year.
      const TOP = 14, BOT = 14;
      let x = null, drag = null;
      const yearAt = (px) => x.domain()[Math.max(0, Math.min(data.length - 1, Math.floor(px / x.step())))];
      svg.style("touch-action", "none")
        .on("pointerdown", (ev) => {
          if (!x) return;
          ev.preventDefault();
          const [px, py] = d3.pointer(ev), bx = x(st.start), bw = 30 * x.step();
          const inBox = px >= bx && px <= bx + bw && py < size(svg)[1] - BOT;
          drag = inBox ? { k: "start", off: px - bx } : { k: "year" };
          svg.node().setPointerCapture(ev.pointerId);
          svg.classed("grabbing", inBox);
          move(ev);
        })
        .on("pointermove", (ev) => {
          if (drag) return move(ev);
          if (!x) return;
          const [px, py] = d3.pointer(ev), bx = x(st.start);
          svg.style("cursor", px >= bx && px <= bx + 30 * x.step() && py < size(svg)[1] - BOT ? "grab" : "ew-resize");
        })
        .on("pointerup pointercancel", (ev) => { drag = null; svg.classed("grabbing", false); });
      function move(ev) {
        const [px] = d3.pointer(ev);
        if (drag.k === "start") st.start = Math.max(1850, Math.min(1996, yearAt(px - drag.off + x.step() / 2)));
        else st.year = yearAt(px);
        render();
      }

      const lc = lifecycle(el, opts, render);
      return { ...lc, resize() { fitted = false; lc.resize(); } };
    },
  });

  // ------------------------------------------------------------------ 4. 512 Paths
  // The nine 2012 battleground states and their electoral votes; the rest of the map is "safe".
  const STATES = [
    ["FL", 29], ["OH", 18], ["NC", 15], ["VA", 13], ["WI", 10], ["CO", 9], ["IA", 6], ["NV", 6], ["NH", 4],
  ];
  const SAFE_D = 237, SAFE_R = 191; // 237 + 191 + 110 = 538

  Deck.widget("lin-paths", {
    mount(el, { opts }) {
      el.innerHTML = `<div class="lin lp">
        <svg></svg>
        <div class="lp-read"></div></div>`;
      const svg = d3.select(el).select("svg");
      const tip = Deck.tooltip(el.querySelector(".lin"));
      const fixed = {}; // state → "D" | "R"
      const share = d3.scaleDiverging([0, 0.5, 1], d3.interpolateRdBu);

      // Build the tree of every path consistent with the fixed states: depth i = state i, children D / R.
      function tree() {
        const kids = (path) => {
          const i = path.length;
          if (i === STATES.length) return null;
          const s = STATES[i][0];
          return (fixed[s] ? [fixed[s]] : ["D", "R"]).map((c) => ({ path: path + c, children: kids(path + c) }));
        };
        const root = d3.hierarchy({ path: "", children: kids("") }).count();
        root.leaves().forEach((l) => {
          const d = SAFE_D + [...l.data.path].reduce((a, c, i) => a + (c === "D" ? STATES[i][1] : 0), 0);
          l.data.ev = d;
          l.data.win = d >= 270 ? "D" : d <= 268 ? "R" : "T";
        });
        root.eachAfter((n) => {
          const ls = n.leaves();
          n.data.d = ls.filter((l) => l.data.win === "D").length;
          n.data.r = ls.filter((l) => l.data.win === "R").length;
          n.data.n = ls.length;
        });
        return root;
      }

      function label(n) {
        const p = n.data.path;
        const steps = [...p].map((c, i) => `${STATES[i][0]} <b style="color:${c === "D" ? "#2166ac" : "#b2182b"}">${c === "D" ? "Obama" : "Romney"}</b>`).join(", ");
        const tail = n.children
          ? `<br>${n.data.n} paths below: Obama wins ${n.data.d}, Romney ${n.data.r}`
          : `<br>→ ${n.data.win === "T" ? "a 269–269 tie" : (n.data.win === "D" ? "Obama" : "Romney") + " wins"}, ${n.data.ev}–${538 - n.data.ev}`;
        return steps + tail;
      }

      function render(animate) {
        const [W, H] = size(svg);
        const root = tree();
        const head = 26, cols = STATES.length + 1;
        d3.partition().size([H - head, W])(root);
        const cw = W / cols;
        const nodes = root.descendants().filter((n) => n.depth > 0);

        svg.selectAll("g.col").data(STATES, (d) => d[0]).join((e) => {
          const g = e.append("g").attr("class", "col").style("cursor", "pointer");
          g.append("rect").attr("class", "chip").attr("y", 0).attr("height", 13).attr("rx", 3);
          g.append("text").attr("class", "st").attr("y", 9.5);
          g.append("text").attr("class", "ev").attr("y", 21);
          g.on("click", (ev, d) => {
            const s = d[0];
            fixed[s] = !fixed[s] ? "D" : fixed[s] === "D" ? "R" : undefined;
            if (!fixed[s]) delete fixed[s];
            update();
          });
          return g;
        }).classed("fixed", (d) => !!fixed[d[0]])
          .attr("transform", (d, i) => `translate(${(i + 1.5) * cw},0)`)
          .call((g) => g.select(".chip").attr("x", -cw / 2 + 1).attr("width", cw - 2)
            .attr("fill", (d) => (fixed[d[0]] === "D" ? "#2166ac" : fixed[d[0]] === "R" ? "#b2182b" : "var(--surface)"))
            .attr("stroke", (d) => (fixed[d[0]] ? "none" : "var(--rule)")))
          .call((g) => g.select(".st").text((d) => d[0]).style("fill", (d) => (fixed[d[0]] ? "#fff" : null)))
          .call((g) => g.select(".ev").text((d) => d[1] + " EV").style("font-size", "0.34rem"));

        const g = svg.selectAll("g.tree").data([0]).join("g").attr("class", "tree").attr("transform", `translate(0,${head})`);
        const fill = (n) => (n.data.n ? share((n.data.d + 0.5 * (n.data.n - n.data.d - n.data.r)) / n.data.n) : "#888");
        const rects = g.selectAll("rect.node").data(nodes, (n) => n.data.path).join(
          (e) => e.append("rect").attr("class", "node").attr("opacity", 0)
            .attr("x", (n) => n.depth * cw).attr("width", cw).attr("y", (n) => n.x0).attr("height", (n) => n.x1 - n.x0),
          (u) => u,
          (x) => x.transition().duration(animate ? 500 : 0).attr("opacity", 0).remove(),
        );
        rects.on("pointerenter pointermove", (ev, n) => tip.show(label(n), ev))
          .on("pointerleave", () => tip.hide())
          .on("click", (ev, n) => {
            const s = STATES[n.depth - 1][0], c = n.data.path.at(-1);
            fixed[s] = fixed[s] === c ? undefined : c;
            if (!fixed[s]) delete fixed[s];
            tip.hide(); update();
          });
        (animate ? rects.transition().duration(750).ease(d3.easeCubicInOut) : rects)
          .attr("opacity", 1)
          .attr("x", (n) => n.depth * cw).attr("width", cw)
          .attr("y", (n) => n.x0).attr("height", (n) => Math.max(0, n.x1 - n.x0))
          .attr("stroke-width", (n) => (n.x1 - n.x0 > 3 ? 0.5 : 0))
          .attr("fill", fill);

        // the outcome column on the far left: the root, coloured by the share of paths each side wins
        g.selectAll("rect.rootcell").data([root]).join("rect").attr("class", "rootcell")
          .attr("x", 0).attr("width", cw - 2).attr("y", 0).attr("height", H - head).attr("rx", 2)
          .attr("fill", fill);
        svg.selectAll("text.rootlbl").data([0]).join("text").attr("class", "rootlbl")
          .attr("x", cw / 2).attr("y", 9.5).attr("text-anchor", "middle")
          .style("font", "600 0.42rem var(--font-mono)").style("fill", "var(--ink-2)").text("all");

        const t = root.data;
        el.querySelector(".lp-read").innerHTML =
          `<b>${t.n}</b> path${t.n === 1 ? "" : "s"} left · Obama wins <b class="D">${t.d}</b> · Romney <b class="R">${t.r}</b>` +
          (t.n - t.d - t.r ? ` · tie ${t.n - t.d - t.r}` : "") + `<br><span style="color:var(--muted)">click a state on top (Obama → Romney → open) or any branch</span>`;
      }
      function update() { render(true); }
      return lifecycle(el, opts, () => render(false));
    },
  });
})();
