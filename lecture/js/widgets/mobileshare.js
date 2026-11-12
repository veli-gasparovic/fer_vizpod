/* mobile-share: slide 3, "Scale" card. Monthly share of web page views on mobile + tablet, worldwide,
   Jan 2009 → Oct 2026. Source: StatCounter Global Stats, "Desktop vs Mobile vs Tablet Market Share
   Worldwide", monthly CSV downloaded 12 Nov 2026 (StatCounter revises history slightly over time). */
(function () {
  const START = [2009, 0]; // Jan 2009
  const SERIES = [0.7,0.7,0.8,0.9,0.9,0.9,1.1,1.1,1.1,1.1,1.2,1.3,1.6,1.7,2.0,2.2,2.3,2.6,2.9,3.2,3.5,3.8,4.0,4.1,4.3,4.5,4.7,5.2,5.8,6.5,7.0,7.1,6.7,6.5,7.0,8.0,8.5,8.5,9.0,9.6,10.1,10.4,11.1,14.3,14.7,15.0,15.9,17.6,17.6,18.1,18.3,17.6,18.3,20.0,21.3,21.9,21.6,23.3,23.9,27.4,28.1,29.0,29.8,29.4,31.4,33.1,34.2,35.4,36.2,37.2,38.1,38.3,37.6,37.4,37.8,37.3,38.5,39.9,43.0,44.8,44.1,44.1,42.8,43.8,44.1,44.2,45.8,46.5,48.5,46.8,49.9,49.4,49.7,51.3,53.1,55.2,54.7,54.8,55.6,56.8,56.4,57.8,58.8,57.3,56.7,55.2,54.3,56.7,56.1,55.9,55.7,55.3,55.9,56.4,56.9,56.7,55.9,52.2,47.9,52.8,53.0,51.8,53.0,52.2,51.7,54.5,54.8,55.4,55.4,55.4,54.8,56.0,54.7,54.3,54.7,56.7,53.5,52.9,53.6,54.1,52.8,51.1,55.8,58.5,58.5,57.4,57.1,57.3,58.0,58.0,58.6,59.6,57.1,56.8,56.5,57.4,57.4,58.4,58.9,60.6,61.4,62.0,63.0,61.5,60.7,60.3,61.0,62.3,60.6,61.4,59.2,55.6,52.6,57.8,57.6,56.3,54.9,54.5,55.5,59.9,60.2,62.0,62.2,61.6,62.1,62.9,63.9,64.3,63.6,63.4,64.8,64.9,64.6,64.1,63.9,63.7,64.7,64.8,59.9,60.7,57.9,50.3,53.1,54.7,52.1,53.3,56.7,54.4,51.8,52.8,54.1,50.9,60.8,61.6];
  const data = SERIES.map((v, i) => ({ date: new Date(START[0], START[1] + i, 1), v }));

  Deck.css("mobileshare", `
    .ms { position: relative; height: 100%; min-height: 0; }
    .ms svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .ms .line { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; }
    .ms .area { fill: color-mix(in srgb, var(--ink) 8%, transparent); }
    .ms .half { stroke: var(--muted); stroke-dasharray: 3 3; }
    .ms .lbl { font: 0.46rem var(--font-mono); fill: var(--muted); }
    .ms .pt { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
    .ms .pt-lbl { font: 600 0.5rem var(--font-mono); fill: var(--ink); }
    .ms .cross { stroke: var(--ink-2); stroke-width: 1; }
    .ms .tooltip { font-size: 0.5rem; }
  `);

  const month = d3.timeFormat("%b %Y");
  const pct = (v) => v.toFixed(1) + "%";

  Deck.widget("mobile-share", {
    mount(el) {
      el.innerHTML = '<div class="ms"><svg></svg></div>';
      const host = el.querySelector(".ms");
      const svg = d3.select(host).select("svg");
      const tip = Deck.tooltip(host);
      const marks = [data[93], data.at(-1)]; // Oct 2016 (first month past half), latest month

      function render() {
        const r = host.getBoundingClientRect();
        const W = Math.max(60, r.width), H = Math.max(40, r.height), m = { t: 6, r: 34, b: 13, l: 2 };
        svg.selectAll("*").remove();
        const x = d3.scaleUtc(d3.extent(data, (d) => d.date), [m.l, W - m.r]);
        const y = d3.scaleLinear([0, 70], [H - m.b, m.t]);
        svg.append("path").attr("class", "area")
          .attr("d", d3.area().x((d) => x(d.date)).y0(y(0)).y1((d) => y(d.v))(data));
        svg.append("line").attr("class", "half").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(50)).attr("y2", y(50));
        svg.append("text").attr("class", "lbl").attr("x", m.l + 2).attr("y", y(50) + 10).text("50%");
        svg.append("path").attr("class", "line")
          .attr("d", d3.line().x((d) => x(d.date)).y((d) => y(d.v))(data));
        for (const [yr, anchor] of [[2009, "start"], [2016, "middle"], [2026, "end"]])
          svg.append("text").attr("class", "lbl").attr("text-anchor", anchor)
            .attr("x", anchor === "end" ? W - m.r + 8 : x(new Date(yr, anchor === "start" ? 0 : 9, 1))).attr("y", H - 2).text(yr);
        const pts = svg.selectAll(".pt").data(marks).join("circle").attr("class", "pt")
          .attr("cx", (d) => x(d.date)).attr("cy", (d) => y(d.v)).attr("r", 4);
        svg.selectAll(".pt-lbl").data(marks).join("text").attr("class", "pt-lbl")
          .attr("text-anchor", (d, i) => (i ? "start" : "end"))
          .attr("x", (d, i) => x(d.date) + (i ? 7 : -7)).attr("y", (d, i) => y(d.v) + (i ? 3 : -4))
          .text((d) => pct(d.v));

        // hover: crosshair + month readout
        const cross = svg.append("line").attr("class", "cross").attr("y1", m.t).attr("y2", H - m.b).style("display", "none");
        svg.append("rect").attr("width", W).attr("height", H).attr("fill", "transparent")
          .on("pointermove", (ev) => {
            const [px] = d3.pointer(ev);
            const d = data[d3.bisector((d) => d.date).center(data, x.invert(px))];
            cross.style("display", null).attr("x1", x(d.date)).attr("x2", x(d.date));
            tip.show(`<b>${month(d.date)}</b><br>mobile + tablet ${pct(d.v)}<br>desktop ${pct(100 - d.v)}`, ev);
          })
          .on("pointerleave", () => { cross.style("display", "none"); tip.hide(); });
      }
      Deck.onTheme(render);
      requestAnimationFrame(render);
      return { enter: render, resize: render };
    },
  });
})();
