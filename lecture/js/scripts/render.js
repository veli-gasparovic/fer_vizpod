// From ../d3.html render(): scales + axes → scatter → rescale with transition → line → area
Deck.script("render", {
  file: "d3.html  render()",
  stageLabel: "<svg>",
  explain: [
    "Two linear scales and two axes. An axis is just a scale, drawn.",
    "Eleven random points → eleven <code>&lt;circle&gt;</code>s, positioned by the scales.",
    "Change the y domain to [0, 50]: the circles and the axis transition to the new mapping.",
    "<b>d3.line()</b> turns the same array into one path string <code>d</code>.",
    "<b>d3.area()</b> with a curve, inserted behind the points.",
  ],
  chunks: [
    { code: `
      const margin = 40;
      const svg = d3.select(root).append("svg")
        .attr("width", width)
        .attr("height", height);

      // let's create x and y scales and axes
      const xScale = d3.scaleLinear().domain([0, 10]).range([margin, width - margin]);
      const yScale = d3.scaleLinear().domain([0, 10]).range([height - margin, margin]);
      const yAxis = d3.axisLeft(yScale);

      svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", \`translate(0, \${height - margin})\`)
        .call(d3.axisBottom(xScale));
      svg.append("g")
        .attr("class", "y-axis")
        .attr("transform", \`translate(\${margin}, 0)\`)
        .call(yAxis);
    ` },
    { at: 1, label: "data → circles", code: `

      // 11 points, x = 0…10, y random between 0 and 10
      const scatterData = d3.range(11).map((i) => ({ x: i, y: Math.random() * 10 }));
      console.log(scatterData);

      svg.append("g")
        .attr("class", "scatter-group")
        .selectAll("circle")
        .data(scatterData)
        .join("circle")
        .attr("cx", (d) => xScale(d.x))
        .attr("cy", (d) => yScale(d.y))
        .attr("r", 6)
        .attr("fill", "#bcbddc")
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    ` },
    { at: 2, label: "rescale + transition", code: `

      // RESCALE: y between 0 and 50, transition the circles and the axis
      yScale.domain([0, 50]);
      svg.selectAll("circle")
        .transition().duration(2000)
        .attr("cy", (d) => yScale(d.y));
      svg.select(".y-axis").transition().duration(2000).call(yAxis);
    ` },
    { at: 3, label: "d3.line", code: `

      const line = d3.line()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y));
        // .curve(d3.curveMonotoneX);

      svg.insert("path", ".scatter-group")   // behind the points
        .attr("class", "line")
        .datum(scatterData)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 4)
        .attr("stroke-opacity", 0.5);
    ` },
    { at: 4, label: "d3.area", code: `

      const area = d3.area()
        .x((d) => xScale(d.x))
        .y0(yScale(0))
        .y1((d) => yScale(d.y))
        .curve(d3.curveMonotoneX);

      svg.insert("path", ".line")   // behind the line
        .datum(scatterData)
        .attr("d", area)
        .attr("fill", "#e34a33")
        .attr("opacity", 0)
        .transition().duration(1500)
        .attr("opacity", 0.85);
    ` },
  ],
});
