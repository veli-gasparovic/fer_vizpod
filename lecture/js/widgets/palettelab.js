/* ==========================================================================
   palettelab: same data, different story.
   Colour mode × colour domain × baseline period × view, on real data.
   Steps preset the controls: 0 continuous/symmetric/native · 1 Hawkins 16 ·
   2 baseline 1850–1900 · 3 stripes + line.
   ========================================================================== */
(function () {
  "use strict";

  Deck.css("palettelab", `
    .pl { display: flex; flex-direction: column; gap: 0.6rem; height: 100%; min-height: 0; }
    .pl .controls { gap: 0.35rem 1.1rem; }
    .pl .grp { display: inline-flex; align-items: center; gap: 0.25rem; }
    .pl .grp > span { font: 600 0.5rem var(--font-sans); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-right: 0.2rem; }
    .pl .grp .btn { padding: 0.22rem 0.55rem; font-size: 0.6rem; }
    .pl-q { font: italic 500 0.9rem/1.3 var(--font-serif); color: var(--ink); min-height: 1.3em; }
    .pl-q b { font-style: normal; color: var(--accent); }
    .pl-chart { position: relative; flex: 1 1 auto; min-height: 0; }
    .pl-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .pl-chart rect.s { shape-rendering: crispEdges; }
    .pl-chart .line { fill: none; stroke: var(--ink); stroke-width: 2.25; stroke-linejoin: round; }
    .pl-chart .halo { fill: none; stroke: var(--surface); stroke-width: 6; stroke-linejoin: round; opacity: 0.85; }
    .pl-chart .zero { stroke: var(--ink-2); stroke-dasharray: 4 4; }
    .pl-chart .zero-label { font: 600 0.55rem var(--font-sans); fill: var(--ink); paint-order: stroke; stroke: var(--surface); stroke-width: 4px; stroke-linejoin: round; }
    .pl-chart .hover-line { stroke: var(--ink); stroke-width: 1; pointer-events: none; }
    .pl-foot { display: flex; gap: 1.6rem; align-items: center; min-height: 0; }
    .pl-legend { flex: 0 0 auto; }
    .pl-legend text { font: 0.5rem var(--font-sans); fill: var(--ink-2); }
    .pl-caption { font-size: 0.62rem; color: var(--ink-2); line-height: 1.4; }
    .pl-caption b { color: var(--ink); }
    .pl-shift { font-family: var(--font-mono); color: var(--accent); }
  `);

  const BASELINES = [
    { id: "native", label: "dataset's own" },
    { id: "1850-1900", label: "1850–1900", range: [1850, 1900] },
    { id: "1961-1990", label: "1961–1990", range: [1961, 1990] },
    { id: "1971-2000", label: "1971–2000", range: [1971, 2000] },
    { id: "1991-2020", label: "1991–2020", range: [1991, 2020] },
  ];
  // Hawkins: the 8 most saturated blues and 8 most saturated reds of ColorBrewer's 9-class palettes
  const HAWKINS16 = [...d3.schemeBlues[9].slice(1).reverse(), ...d3.schemeReds[9].slice(1)];

  const QUESTIONS = [
    "Continuous ColorBrewer <b>RdBu</b>, symmetric around zero. Every year gets its own shade.",
    "Ed Hawkins used <b>16 discrete colours</b>. Can you see the difference? Does it matter?",
    "<b>What counts as white?</b> Switch the baseline: pre-industrial 1850–1900 … then try 1991–2020.",
    "Stripes trade precision for impact. <b>Which would you show to whom?</b> A policymaker, a scientist, Instagram?",
  ];
  const PRESETS = [
    { mode: "continuous", domain: "symmetric", baseline: "native", view: "stripes" },
    { mode: "hawkins", domain: "symmetric", baseline: "native", view: "stripes" },
    { mode: "hawkins", domain: "symmetric", baseline: "1850-1900", view: "stripes" },
    { mode: "hawkins", domain: "symmetric", baseline: "1850-1900", view: "both" },
  ];

  Deck.widget("palettelab", {
    steps: 3,
    mount(el) {
      const DATA = window.CLIMATE;
      const state = { dataset: "global", ...PRESETS[0] };

      el.innerHTML = `
        <div class="pl">
          <div class="controls">
            <span class="grp" data-k="dataset"><span>Data</span><button class="btn" data-v="global">Global</button><button class="btn" data-v="croatia">Croatia</button></span>
            <span class="grp" data-k="mode"><span>Colour</span><button class="btn" data-v="continuous">continuous RdBu</button><button class="btn" data-v="hawkins">Hawkins 16</button></span>
            <span class="grp" data-k="domain"><span>Range</span><button class="btn" data-v="symmetric">± max</button><button class="btn" data-v="fixed">± 0.9 °C</button></span>
            <span class="grp" data-k="baseline"><span>White =</span>${BASELINES.map((b) => `<button class="btn" data-v="${b.id}">${b.label}</button>`).join("")}</span>
            <span class="grp" data-k="view"><span>View</span><button class="btn" data-v="stripes">stripes</button><button class="btn" data-v="line">line</button><button class="btn" data-v="both">both</button></span>
          </div>
          <div class="pl-q"></div>
          <div class="pl-chart"><svg>
            <g class="stripes"></g><g class="grid"></g><g class="axis y"></g><g class="axis x"></g>
            <line class="zero"></line><text class="zero-label"></text>
            <path class="halo"></path><path class="line"></path>
            <line class="hover-line" style="display:none"></line>
          </svg></div>
          <div class="pl-foot"><svg class="pl-legend"></svg><div class="pl-caption"></div></div>
        </div>`;

      const chart = el.querySelector(".pl-chart");
      const svg = d3.select(chart).select("svg");
      const legend = d3.select(el).select(".pl-legend");
      const tip = Deck.tooltip(chart);
      const q = el.querySelector(".pl-q"), caption = el.querySelector(".pl-caption");
      const M = { top: 6, right: 10, bottom: 24, left: 44 };
      let W = 0, H = 0, lastDataset = null, series = [], color = null, maxAbs = 1, shift = 0;

      el.querySelectorAll(".grp").forEach((g) => g.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        state[g.dataset.k] = b.dataset.v; update();
      }));

      function compute() {
        const ds = DATA[state.dataset];
        const bl = BASELINES.find((b) => b.id === state.baseline);
        shift = bl.range ? d3.mean(ds.values.filter((d) => d.year >= bl.range[0] && d.year <= bl.range[1]), (d) => d.anomaly) : 0;
        series = ds.values.map((d) => ({ year: d.year, anomaly: +(d.anomaly - shift).toFixed(3), raw: d.anomaly }));
        maxAbs = state.domain === "fixed" ? 0.9 : d3.max(series, (d) => Math.abs(d.anomaly));
        color = state.mode === "continuous"
          ? d3.scaleDiverging([-maxAbs, 0, maxAbs], (t) => d3.interpolateRdBu(1 - t)).clamp(true)
          : d3.scaleQuantize([-maxAbs, maxAbs], HAWKINS16);
        return ds;
      }

      function update(animate = true) {
        const ds = compute();
        el.querySelectorAll(".grp").forEach((g) => g.querySelectorAll("button").forEach((b) => b.classList.toggle("on", state[g.dataset.k] === b.dataset.v)));
        W = chart.clientWidth; H = chart.clientHeight;
        if (!W || !H) return;
        svg.attr("viewBox", `0 0 ${W} ${H}`);
        const showLine = state.view !== "stripes", showStripes = state.view !== "line";
        const left = showLine ? M.left : 0;
        const x = d3.scaleBand().domain(series.map((d) => d.year)).range([left, W - M.right * (showLine ? 1 : 0)]);
        const yExt = d3.extent(series, (d) => d.anomaly);
        const pad = (yExt[1] - yExt[0]) * 0.08;
        const y = d3.scaleLinear().domain([yExt[0] - pad, yExt[1] + pad]).range([H - M.bottom, M.top]).nice();
        const datasetChanged = lastDataset !== null && lastDataset !== state.dataset;
        lastDataset = state.dataset;
        const t = svg.transition().duration(animate ? 750 : 0).ease(d3.easeCubicInOut);

        // stripes: one rect per year, keyed by year (Croatia ends 2020 → 2021–2025 exit)
        svg.select(".stripes").selectAll("rect.s")
          .data(series, (d) => d.year)
          .join(
            (enter) => enter.append("rect").attr("class", "s")
              .attr("x", (d) => x(d.year)).attr("width", x.bandwidth() + 0.6)
              .attr("y", M.top).attr("height", H - M.top - M.bottom).attr("fill", Deck.color("--surface") || "#fff").style("opacity", 0),
            (upd) => upd,
            (exit) => exit.transition(t).style("opacity", 0).remove()
          )
          .on("pointerenter pointermove", (event, d) => {
            tip.show(`<b>${d.year}</b><br>${d3.format("+.2f")(d.anomaly)} °C vs ${baselineLabel()}`, event);
            svg.select(".hover-line").style("display", null)
              .attr("x1", x(d.year) + x.bandwidth() / 2).attr("x2", x(d.year) + x.bandwidth() / 2).attr("y1", M.top).attr("y2", H - M.bottom);
          })
          .on("pointerleave", () => { tip.hide(); svg.select(".hover-line").style("display", "none"); })
          .transition(t)
          .attr("x", (d) => x(d.year)).attr("width", x.bandwidth() + 0.6)
          .attr("y", M.top).attr("height", H - M.top - M.bottom)
          .attr("fill", (d) => color(d.anomaly))
          .style("opacity", showStripes ? 1 : 0.07);

        // axes
        const xTicks = series.filter((d) => d.year % 25 === 0).map((d) => d.year);
        svg.select(".axis.x").attr("transform", `translate(0,${H - M.bottom})`).transition(t)
          .call(d3.axisBottom(x).tickValues(xTicks).tickSizeOuter(0))
          .call((g) => g.select(".domain").remove());
        svg.select(".axis.y").attr("transform", `translate(${left},0)`).transition(t)
          .style("opacity", showLine ? 1 : 0)
          .call(d3.axisLeft(y).ticks(6).tickFormat((v) => `${v > 0 ? "+" : ""}${d3.format(".1f")(v)}°`).tickSizeOuter(0));
        svg.select(".grid").transition(t).style("opacity", showLine && !showStripes ? 1 : 0)
          .call(d3.axisLeft(y).ticks(6).tickSize(-(W - left - M.right)).tickFormat(""))
          .attr("transform", `translate(${left},0)`);
        svg.select(".grid").selectAll("line").attr("stroke", "var(--rule)").attr("stroke-opacity", 0.6);
        svg.select(".grid").select(".domain").remove();

        // zero = the baseline
        svg.select(".zero").transition(t).style("opacity", showLine ? 1 : 0)
          .attr("x1", left).attr("x2", W - M.right).attr("y1", y(0)).attr("y2", y(0));
        svg.select(".zero-label").transition(t).style("opacity", showLine ? 1 : 0)
          .attr("x", W - M.right - 4).attr("y", y(0) - 5).attr("text-anchor", "end").text(`0 = ${baselineLabel()} average`);

        // line (crossfade when the dataset changes; morph when only the baseline changes)
        const line = d3.line().x((d) => x(d.year) + x.bandwidth() / 2).y((d) => y(d.anomaly));
        const paths = svg.selectAll(".line, .halo");
        if (datasetChanged) {
          paths.interrupt().style("opacity", 0).datum(series).attr("d", line)
            .transition().delay(animate ? 500 : 0).duration(animate ? 500 : 0).style("opacity", (d, i, n) => (showLine ? (n[i].classList.contains("halo") ? (showStripes ? 0.85 : 0) : 1) : 0));
        } else {
          paths.datum(series).transition(t).attr("d", line)
            .style("opacity", (d, i, n) => (showLine ? (n[i].classList.contains("halo") ? (showStripes ? 0.85 : 0) : 1) : 0));
        }
        svg.select(".line").style("stroke", showStripes ? "var(--ink)" : "var(--accent)");

        drawLegend();
        const bl = BASELINES.find((b) => b.id === state.baseline);
        caption.innerHTML =
          `Each stripe is one year of ${state.dataset === "global" ? "global mean" : "Croatian land"} temperature (${ds.source}). ` +
          `<b>White = the ${baselineLabel()} average</b>${bl.range ? "" : " (the dataset's native baseline)"}. ` +
          (bl.range ? `Re-baselined: every value shifted by <span class="pl-shift">${d3.format("+.2f")(-shift)} °C</span>. ` : "") +
          `Colours: ${state.mode === "continuous" ? "continuous RdBu" : "16 discrete ColorBrewer steps (Hawkins)"}, ` +
          `${state.domain === "fixed" ? "fixed at ±0.9 °C, so anything warmer is simply the darkest red" : `stretched to ±${d3.format(".2f")(maxAbs)} °C, the largest anomaly in the data`}.`;
      }

      function baselineLabel() {
        const bl = BASELINES.find((b) => b.id === state.baseline);
        return bl.range ? bl.label : DATA[state.dataset].baseline;
      }

      function drawLegend() {
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const lw = rem * 13, lh = rem * 0.7, top = 2;
        legend.attr("width", lw).attr("height", lh + rem * 1.3).attr("viewBox", `0 0 ${lw} ${lh + rem * 1.3}`);
        const n = state.mode === "continuous" ? 64 : 16;
        const xs = d3.scaleLinear().domain([-maxAbs, maxAbs]).range([0, lw]);
        const cells = d3.range(n).map((i) => -maxAbs + ((i + 0.5) * 2 * maxAbs) / n);
        legend.selectAll("rect").data(cells).join("rect")
          .attr("x", (d, i) => (i * lw) / n).attr("width", lw / n + (state.mode === "continuous" ? 0.6 : -1)).attr("y", top).attr("height", lh)
          .attr("fill", (d) => color(d));
        const ticks = [-maxAbs, 0, maxAbs];
        legend.selectAll("text").data(ticks).join("text")
          .attr("x", (d) => xs(d)).attr("y", top + lh + rem * 0.85).attr("text-anchor", (d, i) => ["start", "middle", "end"][i])
          .text((d) => (d === 0 ? "0 °C" : `${d > 0 ? "+" : "−"}${d3.format(".2f")(Math.abs(d))}`));
      }

      Deck.onTheme(() => update(false));
      update(false);

      return {
        step(n) {
          Object.assign(state, PRESETS[Math.min(n, PRESETS.length - 1)]);
          q.innerHTML = QUESTIONS[Math.min(n, QUESTIONS.length - 1)];
          update(true);
        },
        resize() { update(false); },
      };
    },
  });
})();
