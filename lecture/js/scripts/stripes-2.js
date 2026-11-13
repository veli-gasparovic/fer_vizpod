// Warming stripes, part 2: update(series) with a keyed join + transition → line overlay → brush
Deck.script("stripes-2", {
  file: "stripes.js  (refactored)",
  args: { datasets: () => CLIMATE },
  stageLabel: "<svg>",
  explain: [
    "Same chart, refactored into <code>update(series)</code> so it can run again with other data.",
    "<b>Keyed join</b> (by year) + <b>transition</b>. Switch datasets: matching years recolour, Croatia's missing 2021–2025 <span style='color:var(--exit)'>exit</span>.",
    "<b>d3.line()</b> on a linear y scale, drawn over the stripes: precision on top of impact.",
    "<b>d3.brushX()</b>: select a period and read its mean anomaly.",
  ],
  chunks: [
    { code: `
      // in the HTML: <div id="chart"></div>  (here: the live preview)
      const chart = d3.select("#chart");
      const W = 800, H = 300;
      const svg = chart.append("svg")
        .attr("viewBox", [0, 0, W, H])
        .attr("preserveAspectRatio", "none")
        .style("width", "100%").style("height", "100%");

      const years = d3.range(1850, 2026);   // fixed x domain, so datasets line up
      const x = d3.scaleBand().domain(years).range([0, W]);
      const color = d3.scaleDiverging(d3.interpolateRdBu);
      const gStripes = svg.append("g");
      let current;
    ` },
    { at: 2, code: `

      const y = d3.scaleLinear().range([H - 24, 24]);
      const line = d3.line()
        .x((d) => x(d.year) + x.bandwidth() / 2)
        .y((d) => y(d.anomaly));
      const gLine = svg.append("g");
    ` },
    { code: `

      function update(series) {
        current = series;
        const data = series.values;
        const maxAbs = d3.max(data, (d) => Math.abs(d.anomaly));
        color.domain([maxAbs, 0, -maxAbs]);
    ` },
    { until: 1, code: `
        gStripes.selectAll("rect")
          .data(data)
          .join("rect")
          .attr("x", (d) => x(d.year))
          .attr("width", x.bandwidth() + 0.5)
          .attr("height", H)
          .attr("fill", (d) => color(d.anomaly));
    ` },
    { at: 1, label: "keyed join + transition", code: `
        gStripes.selectAll("rect")
          .data(data, (d) => d.year)          // key: the year
          .join(
            (enter) => enter.append("rect")
              .attr("x", (d) => x(d.year))
              .attr("width", x.bandwidth() + 0.5)
              .attr("y", H).attr("height", 0),
            (update) => update,
            (exit) => exit.transition().duration(800)
              .attr("y", H).attr("height", 0).remove()
          )
          .transition().duration(900).delay((d, i) => i * 4)
          .attr("y", 0).attr("height", H)
          .attr("fill", (d) => color(d.anomaly));
    ` },
    { at: 2, label: "line overlay", code: `

        y.domain(d3.extent(data, (d) => d.anomaly)).nice();
        gLine.selectAll("path")
          .data([data])
          .join("path")
          .attr("fill", "none")
          .attr("stroke", "#111")
          .attr("stroke-width", 2)
          .attr("vector-effect", "non-scaling-stroke")
          .transition().duration(900)
          .attr("d", line);
    ` },
    { code: `
      }

      update(datasets.global);
    ` },
    { at: 1, label: "dataset buttons", code: `

      // SWITCH DATASETS
      chart.append("div").attr("class", "stage-buttons")
        .selectAll("button")
        .data([datasets.global, datasets.croatia])
        .join("button")
        .text((d) => d.label)
        .on("click", (event, d) => update(d));
    ` },
    { at: 3, label: "brush a period", code: `

      // BRUSH: select a period, report its mean
      const readout = chart.append("div").attr("class", "stage-readout");
      svg.append("g").call(
        d3.brushX()
          .extent([[0, 0], [W, H]])
          .on("brush end", ({ selection }) => {
            if (!selection) return readout.text("");
            const [y0, y1] = selection.map((px) => years[Math.min(years.length - 1, Math.floor(px / x.step()))]);
            const period = current.values.filter((d) => d.year >= y0 && d.year <= y1);
            const mean = d3.mean(period, (d) => d.anomaly);
            readout.text(\`\${current.label} \${y0}–\${y1}: mean \${d3.format("+.2f")(mean)} °C\`);
          })
      );
    ` },
  ],
});
