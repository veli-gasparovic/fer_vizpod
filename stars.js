const svg = d3.select(".chart");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

svg.style("background-color", "purple");

function createStarPath(radius, points = 5) {
  const angleStep = (Math.PI * 2) / points;
  const innerRadius = radius * 0.4; // unutarnji radius na 40% od vanjskog

  // Generate the path using d3.line
  const curve = d3.curveLinearClosed;
  // const curve = d3.curveBasisClosed;
  const lineGenerator = d3.line().curve(curve);

  const coordinates = [];

  // Generate star points
  for (let i = 0; i < points; i++) {
    // Outer point
    const outerAngle = i * angleStep - Math.PI / 2; // Start at top
    coordinates.push([
      radius * Math.cos(outerAngle),
      radius * Math.sin(outerAngle),
    ]);

    // Inner point
    const innerAngle = outerAngle + angleStep / 2;
    coordinates.push([
      innerRadius * Math.cos(innerAngle),
      innerRadius * Math.sin(innerAngle),
    ]);
  }

  // Close the path by connecting back to first point
  coordinates.push(coordinates[0]);

  return lineGenerator(coordinates);
}

const centerX = width / 2;
const centerY = height / 2;

const zoomGroup = svg.append("g");

const starGroup = zoomGroup
  .append("g")
  .attr("transform", `translate(${centerX}, ${centerY})`);

// let's add 10 stars

const randomLocations = d3.range(0, 10).map((d) => {
  return {
    x: Math.random() * width - centerX,
    y: Math.random() * height - centerY,
  };
});

starGroup
  .selectAll("path")
  .data(randomLocations)
  .enter()
  .append("path")
  .attr("d", (d, i) => createStarPath(50, 5 + i))
  .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
  .attr("fill", "none")
  .attr("stroke", "white")
  .attr("stroke-width", 2)
  .attr("fill", "white")
  .attr("fill-opacity", 0.4)
  .style("cursor", "pointer");

//   dodajem zoom i pan:
const zoom = d3.zoom().on("zoom", (event) => {
  console.log(event.transform);
  zoomGroup.attr("transform", event.transform);

  // const newStrokeWidth = 2 / event.transform.k;
  // starGroup.selectAll("path").attr("stroke-width", newStrokeWidth);
});

// svg.style('overflow', 'hidden');
svg.call(zoom);

//point and click
if (true) {
  starGroup.selectAll("path").on("click", function () {
    console.log(d3.select(this).attr("transform"));
    //get the star x position
    const x = parseFloat(
      d3.select(this).attr("transform").split(",")[0].split("(")[1]
    );

    d3.select(this)
      .transition()
      .duration(2000)
      .attr("fill", "yellow")
      .attr("fill-opacity", 1)
      .attr("stroke", "yellow")
      .ease(d3.easeBounceOut)
      .attr("transform", `translate(${x}, ${height - centerY}) rotate(180)`) // drop to the bottom
      .on("end", function () {
        d3.select(this).transition().duration(250).style("opacity", 0).remove();
      });
  });
}
