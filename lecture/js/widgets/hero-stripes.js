/* Warming stripes: "hero" (full-bleed title background) and "card" (framed, hoverable) */
(function () {
  Deck.css("hero-stripes", `
    .hs { position: absolute; inset: 0; }
    .hs svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .hs-years { position: absolute; left: 0; right: 0; bottom: calc(var(--u) * 3); display: flex; justify-content: space-between;
      padding: 0 calc(var(--u) * 1.4); font: 600 0.55rem var(--font-mono); color: rgba(255,255,255,0.85); pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,0.35); }
    .hs-card { display: flex; flex-direction: column; gap: 0.5rem; height: 100%; min-height: 0; }
    .hs-card .hs-frame { position: relative; flex: 1 1 auto; min-height: 0; border-radius: 0.5rem; overflow: hidden;
      box-shadow: 0 1px 0 var(--rule), 0 10px 30px rgba(0,0,0,0.08); }
    .hs-card .hs-frame svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .hs-card .hs-axis { display: flex; justify-content: space-between; font: 0.55rem var(--font-mono); color: var(--ink-2); position: relative; height: 1em; }
    .hs-card .hs-axis span { position: absolute; transform: translateX(-50%); }
    .hs-card .hs-axis span:first-child { transform: none; }
    .hs-card .hs-axis span:last-child { transform: translateX(-100%); }
    .hs-card .hs-cap { font-size: 0.6rem; color: var(--muted); display: flex; justify-content: space-between; gap: 1rem; }
    .hs-card rect.hover { stroke: var(--ink); stroke-width: 2; }
  `);

  const colorFor = (values) => {
    const max = d3.max(values, (d) => Math.abs(d.anomaly));
    return d3.scaleDiverging([-max, 0, max], (t) => d3.interpolateRdBu(1 - t));
  };

  Deck.widget("hero-stripes", {
    steps: 0,
    mount(el, ctx) {
      const mode = ctx.opts.mode || "hero";
      return mode === "card" ? mountCard(el, ctx) : mountHero(el);
    },
  });

  function mountHero(el) {
    const data = CLIMATE.global.values;
    const color = colorFor(data);
    el.classList.add("hs");
    // viewBox in "data units": one unit per year, stretched to the viewport
    const svg = d3.select(el).append("svg")
      .attr("viewBox", `0 0 ${data.length} 1`).attr("preserveAspectRatio", "none")
      .attr("role", "img").attr("aria-label", `Warming stripes, global temperature anomaly ${data[0].year}–${data[data.length - 1].year}`);
    const rects = svg.selectAll("rect").data(data, (d) => d.year).join("rect")
      .attr("x", (d, i) => i).attr("y", 0).attr("width", 1.02).attr("height", 1)
      .attr("fill", (d) => color(d.anomaly)).attr("shape-rendering", "crispEdges");
    rects.append("title").text((d) => `${d.year}: ${d3.format("+.2f")(d.anomaly)} °C`);
    el.insertAdjacentHTML("beforeend", `<div class="hs-years"><span>${data[0].year}</span><span>${data[data.length - 1].year}</span></div>`);

    let played = false;
    return {
      enter() {
        if (played) return;
        played = true;
        rects.interrupt().attr("opacity", 0)
          .transition().delay((d, i) => 300 + i * 14).duration(500).ease(d3.easeCubicOut)
          .attr("opacity", 1);
      },
    };
  }

  function mountCard(el, ctx) {
    el.classList.add("hs-card");
    el.innerHTML = `
      <div class="controls" role="group" aria-label="dataset">
        <button class="btn on" data-k="global">Global</button>
        <button class="btn" data-k="croatia">Croatia</button>
      </div>
      <div class="hs-frame"></div>
      <div class="hs-axis"></div>
      <div class="hs-cap"><span class="hs-src"></span><span>hover a stripe</span></div>`;
    const frame = el.querySelector(".hs-frame");
    const axis = el.querySelector(".hs-axis");
    const src = el.querySelector(".hs-src");
    const tip = Deck.tooltip(frame);
    // fixed time domain so both datasets share an x axis
    const years = [1850, 2025];
    const W = 1000, H = 1000;
    const svg = d3.select(frame).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "none");
    const x = d3.scaleBand().domain(d3.range(years[0], years[1] + 1)).range([0, W]);
    axis.innerHTML = [1850, 1900, 1950, 2000, 2025].map((y) => `<span style="left:${(x(y) / W) * 100}%">${y}</span>`).join("");

    let key = "global";
    function draw(animate) {
      const set = CLIMATE[key];
      const color = colorFor(set.values);
      src.textContent = `${set.label} · ${set.source} · anomaly vs ${set.baseline}`;
      svg.attr("aria-label", `Warming stripes, ${set.label}`).attr("role", "img");
      svg.selectAll("rect").data(set.values, (d) => d.year).join(
        (enter) => enter.append("rect").attr("x", (d) => x(d.year)).attr("y", 0)
          .attr("width", x.bandwidth() + 0.5).attr("height", H).attr("fill", Deck.color("--surface") || "#fff")
          .attr("shape-rendering", "crispEdges")
          .call((e) => e.transition().duration(animate ? 700 : 0).delay((d, i) => (animate ? i * 4 : 0)).attr("fill", (d) => color(d.anomaly))),
        (update) => update.call((u) => u.transition().duration(700).delay((d, i) => i * 3).attr("fill", (d) => color(d.anomaly))),
        (exit) => exit.call((e) => e.transition().duration(500).attr("fill", Deck.color("--surface") || "#fff").remove())
      )
        .on("pointerenter", function (ev, d) {
          d3.select(this).classed("hover", true).raise();
          tip.show(`<b>${d.year}</b> · ${d3.format("+.2f")(d.anomaly)} °C<br><span style="opacity:.7">${CLIMATE[key].label}, vs ${CLIMATE[key].baseline}</span>`, ev);
        })
        .on("pointermove", (ev) => tip.el.style.display === "block" && tip.show(tip.el.innerHTML, ev))
        .on("pointerleave", function () { d3.select(this).classed("hover", false); tip.hide(); });
    }
    el.querySelectorAll(".controls .btn").forEach((b) => (b.onclick = () => {
      key = b.dataset.k;
      el.querySelectorAll(".controls .btn").forEach((o) => o.classList.toggle("on", o === b));
      draw(false);
    }));
    draw(true);
    return {};
  }
})();
