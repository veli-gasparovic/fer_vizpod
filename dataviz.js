// D3 code for creating a simple chart in the center section
const svg = d3.select(".chart");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

//read the data form a local wordl_annual.json file
d3.json("world_annual.json").then((data) => {
  console.log(data);
  //   debugger;

  //   enrich data with years
  data = data.map((d, i) => {
    return {
      year: 1850 + i,
      anomaly: d,
    };
  });

  render(data);
});

function render(data) {
  // create a scaleBand for the x axis, spanning full width of the chart
  const xScale = d3
    .scaleBand()
    .domain(data.map((_, i) => i))
    .range([0, width]);

  const maxAnomaly = d3.max(data, (d) => Math.abs(d.anomaly));

  // let's contruct a color scale for the rectangles, divergent (blue to red, white in the middle)
  const colorScale = d3.scaleDiverging(
    [maxAnomaly, 0, -maxAnomaly],
    d3.interpolateRdBu
  );

  // let's iterate data and drawing full heigh rectangles:
  const rectGroup = svg.append("g");
  data.forEach((d, i) => {
    rectGroup
      .append("rect")
      .attr("x", xScale(i))
      .attr("y", 0)
      .attr("width", xScale.bandwidth())
      .attr("fill", "white")
      .attr("height", height)
      .transition()
      .duration(1000)
      .delay(20 * i)
      .attr("fill", colorScale(d.anomaly));
  });

  //   let's add x axis to the bottom:
  const xAxis = d3
    .axisBottom(xScale)
    // print only years every 10 years
    .tickValues(xScale.domain().filter((d, i) => i % 10 === 0))
    .tickFormat((d) => d.year);

  svg.append("g").attr("transform", `translate(0, ${height})`).call(xAxis);
}
