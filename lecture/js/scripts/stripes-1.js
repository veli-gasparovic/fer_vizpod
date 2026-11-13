// Warming stripes: encode → colour → responsive → tooltip
Deck.script("stripes-1", {
  file: "stripes.js",
  args: { data: () => CLIMATE.global.values },
  stageLabel: "<svg> · drag my corner to resize",
  resizable: true,
  explain: [
    "<code>data</code> is 176 years of HadCRUT 5.1: <code>{year, anomaly}</code>, in °C vs 1961–1990.",
    "<b>scaleBand</b>: one band per year. One <code>&lt;rect&gt;</code> per datum.",
    "<b>scaleDiverging</b> + <b>interpolateRdBu</b>. Why is the domain reversed?",
    "<b>Responsive</b>: draw in a fixed 800×300 coordinate system; the <code>viewBox</code> scales it. Drag the corner ↘.",
    "<b>Details on demand</b>: pointer events + an HTML tooltip.",
  ],
  chunks: [
    { code: `
      // data = [{year: 1850, anomaly: -0.426}, …]  (HadCRUT 5.1, °C vs 1961–1990)
      console.log(data.length, "years", data[0], "…", data.at(-1));

      // in the HTML: <div id="chart"></div>  (here: the live preview)
      const chart = d3.select("#chart");
    ` },
    { until: 3, code: `

      const W = chart.node().clientWidth;
      const H = chart.node().clientHeight;
      const svg = chart.append("svg")
        .attr("width", W)
        .attr("height", H);
    ` },
    { at: 3, label: "responsive viewBox", code: `

      // RESPONSIVE: a fixed coordinate system, scaled by the browser
      const W = 800, H = 300;
      const svg = chart.append("svg")
        .attr("viewBox", [0, 0, W, H])
        .attr("preserveAspectRatio", "none")
        .style("width", "100%")
        .style("height", "100%");
    ` },
    { at: 1, label: "band scale + rects", code: `

      // x: one band per year
      const x = d3.scaleBand()
        .domain(data.map((d) => d.year))
        .range([0, W]);

      const stripes = svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", (d) => x(d.year))
        .attr("y", 0)
        .attr("width", x.bandwidth() + 0.5)   // +0.5 hides hairline gaps
        .attr("height", H);
    ` },
    { at: 1, until: 2, code: `
      stripes.attr("fill", "#ccc").attr("stroke", "white");
    ` },
    { at: 2, label: "diverging colour scale", code: `

      // colour: blue = colder, red = warmer than the baseline
      const maxAbs = d3.max(data, (d) => Math.abs(d.anomaly));
      const color = d3.scaleDiverging()
        .domain([maxAbs, 0, -maxAbs])   // reversed: RdBu runs red → blue
        .interpolator(d3.interpolateRdBu);

      stripes.attr("fill", "white")
        .transition().duration(800).delay((d, i) => i * 8)
        .attr("fill", (d) => color(d.anomaly));
    ` },
    { at: 4, label: "tooltip", code: `

      // DETAILS ON DEMAND
      const tip = chart.append("div").attr("class", "tip");
      stripes
        .on("pointerenter", (event, d) => {
          stripes.attr("opacity", (s) => (s === d ? 1 : 0.35));
          tip.style("opacity", 1)
            .html(\`<b>\${d.year}</b> \${d3.format("+.2f")(d.anomaly)} °C\`);
        })
        .on("pointermove", (event) => {
          const [mx, my] = d3.pointer(event, chart.node());
          tip.style("left", \`\${mx + 14}px\`).style("top", \`\${my - 34}px\`);
        })
        .on("pointerleave", () => {
          stripes.attr("opacity", 1);
          tip.style("opacity", 0);
        });
    ` },
  ],
});
