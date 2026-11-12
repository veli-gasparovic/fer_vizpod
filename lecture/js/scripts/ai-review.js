// "AI-generated" bar chart with four planted problems; each step fixes one.
(function () {
  let cache;
  function municipalityRows() {
    if (cache) return cache;
    const csv = d3.csvParse(POPULATION_CSV, d3.autoType);
    const byName = new Map(csv.map((r) => [r.Name.trim().toUpperCase(), r]));
    const seen = new Set();
    cache = HRVATSKA_TOPO.objects.hrvatska.geometries.map((g) => g.properties)
      .filter((p) => {
        const k = p.NAME_1 + "|" + p.NAME_2;
        if (seen.has(k) || !byName.has(p.NAME_2.trim().toUpperCase())) return false;
        seen.add(k); return true;
      })
      .map((p) => ({ county: p.NAME_1, municipality: p.NAME_2, population: byName.get(p.NAME_2.trim().toUpperCase()).Population }));
    return cache;
  }

  Deck.script("ai-review", {
    file: "chart.js  ✨ generated",
    args: { rows: municipalityRows },
    stageLabel: "<svg>",
    explain: [
      "Prompt: <i>“D3 bar chart of population by county, with top-8 and sort buttons.”</i> It looks plausible. Does it run?",
      "<b>Bug 1, version drift:</b> <code>d3.nest()</code> was removed in D3 v6. It runs now, but look at the smallest bar.",
      "<b>Bug 2, a lying scale:</b> <code>d3.extent</code> starts the y axis at the minimum, so Ličko-senjska gets a zero-height bar. Bars must start at 0. Now press <b>top 8 / all</b>.",
      "<b>Bug 3, enter-only:</b> nothing updated or left. <code>.join()</code> fixes it. Now press <b>sort</b> and watch Zagreb.",
      "<b>Bug 4, no key:</b> the bars morph in place instead of moving. Key by county. Each bar keeps its identity.",
    ],
    chunks: [
      { code: `
        // ✨ AI-generated: "D3 bar chart of population by county, with top-8 and sort buttons"
        const margin = { top: 56, right: 20, bottom: 120, left: 70 };
        const svg = d3.select(root).append("svg")
          .attr("width", width).attr("height", height);
        const x = d3.scaleBand().range([margin.left, width - margin.right]).padding(0.15);
        const y = d3.scaleLinear().range([height - margin.bottom, margin.top]);
        const xAxis = svg.append("g").attr("transform", \`translate(0, \${height - margin.bottom})\`);
        const yAxis = svg.append("g").attr("transform", \`translate(\${margin.left}, 0)\`);
        const fill = (d) => (d.county === "Grad Zagreb" ? "#b2182b" : "steelblue");
        let topN = 21, byName = false;

        function draw() {
          // total population per county, from municipality rows
      ` },
      { until: 1, code: `
          const data = d3.nest()
            .key((d) => d.county)
            .rollup((v) => d3.sum(v, (d) => d.population))
            .entries(rows)
            .map((d) => ({ county: d.key, population: d.value }))
      ` },
      { at: 1, label: "fix 1 · d3.nest → d3.rollups", code: `
          // FIX 1: d3.nest() was removed in D3 v6 → d3.rollups
          const data = d3.rollups(rows, (v) => d3.sum(v, (d) => d.population), (d) => d.county)
            .map(([county, population]) => ({ county, population }))
      ` },
      { code: `
            .sort((a, b) => b.population - a.population)
            .slice(0, topN);
          if (byName) data.sort((a, b) => d3.ascending(a.county, b.county));

          x.domain(data.map((d) => d.county));
      ` },
      { until: 2, code: `
          y.domain(d3.extent(data, (d) => d.population));
      ` },
      { at: 2, label: "fix 2 · start bars at zero", code: `
          // FIX 2: bar length encodes the value, so the domain must start at 0
          y.domain([0, d3.max(data, (d) => d.population)]);
      ` },
      { until: 3, code: `

          svg.selectAll("rect")
            .data(data)
            .enter()
            .append("rect")
            .attr("x", (d) => x(d.county))
            .attr("width", x.bandwidth())
            .attr("y", (d) => y(d.population))
            .attr("height", (d) => y(y.domain()[0]) - y(d.population))
            .attr("fill", fill);
      ` },
      { at: 3, until: 4, label: "fix 3 · enter-only → join", code: `

          // FIX 3: .enter().append() only handles NEW data → .join()
          svg.selectAll("rect")
            .data(data)
            .join("rect")
            .transition().duration(900)
            .attr("x", (d) => x(d.county))
            .attr("width", x.bandwidth())
            .attr("y", (d) => y(d.population))
            .attr("height", (d) => y(0) - y(d.population))
            .attr("fill", fill);
      ` },
      { at: 4, label: "fix 4 · key the join", code: `

          // FIX 4: key by county, so each bar keeps its identity
          svg.selectAll("rect")
            .data(data, (d) => d.county)
            .join(
              (enter) => enter.append("rect")
                .attr("x", (d) => x(d.county)).attr("y", y(0)).attr("height", 0),
              (update) => update,
              (exit) => exit.transition().duration(500)
                .attr("y", y(0)).attr("height", 0).remove()
            )
            .transition().duration(900)
            .attr("x", (d) => x(d.county))
            .attr("width", x.bandwidth())
            .attr("y", (d) => y(d.population))
            .attr("height", (d) => y(0) - y(d.population))
            .attr("fill", fill);
      ` },
      { code: `

          xAxis.transition().duration(900).call(d3.axisBottom(x))
            .selectAll("text")
            .attr("transform", "rotate(-40)")
            .attr("text-anchor", "end");
          yAxis.transition().duration(900).call(d3.axisLeft(y).ticks(5, "~s"));
        }

        draw();
        const ui = d3.select(root).append("div").attr("class", "stage-buttons");
        ui.append("button").text("top 8 / all")
          .on("click", () => { topN = topN === 21 ? 8 : 21; draw(); });
        ui.append("button").text("sort A–Z / by size")
          .on("click", () => { byName = !byName; draw(); });
      ` },
    ],
  });
})();
