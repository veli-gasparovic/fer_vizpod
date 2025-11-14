const svg = d3.select(".chart");
const width = svg.node().clientWidth;
const height = svg.node().clientHeight;

svg.style("background-color", "purple");

// let's create a path generator that will create snowflake shapes
const centerX = width / 2;
const centerY = height / 2;

// Create a group for the snowflake and center it
const snowflake = svg
  .append("g")
  .attr("transform", `translate(${centerX}, ${centerY})`);

const generateSnowflakeGroup = (numArms, size) => {
  const snowflake = svg.append("g");

  // Add central circle
  snowflake
    .append("circle")
    .attr("r", size / 2)
    .attr("fill", "white");

  for (let i = 0; i < numArms; i++) {
    const rotation = (i * 360) / numArms;

    // Main line
    snowflake
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", -size * 2)
      .attr("transform", `rotate(${rotation})`)
      .attr("stroke", "white")
      .attr("stroke-width", 2);
  }

  return snowflake;
};

let FLAKES = 100;

function createSnowflake(x, y) {
  const size = Math.random() * 10;
  const randomArms = Math.floor(Math.random() * 6) + 3;

  const snowflake = generateSnowflakeGroup(randomArms, size)
    .attr("transform", `translate(${x}, ${y}) scale(${size / 10})`)
    .attr("fill", "white");

  // Add a random rotation and transition towards the ground

  if (true) {
    snowflake
      .transition()
      .duration(Math.random() * 10000 + 5000)
      .delay(Math.random() * 3000)
      .attr("transform", `translate(${x}, ${height}))`)
      .attr(
        "transform",
        `translate(${x}, ${height}) scale(${size / 10}) rotate(${
          Math.random() * 360
        })`
      )
      .on("end", () => {
        snowflake.transition().duration(250).style("opacity", 0).remove();
      });
  }
}

for (let i = 0; i < FLAKES; i++) {
  const x = Math.random() * width;
  const y = Math.random() * height;
  createSnowflake(x, y);
}

if (false) {
  svg.on("mousemove", function (event) {
    const [currentX, currentY] = d3.pointer(event);
    const numNewFlakes = 3; // Fixed number of flakes per move

    for (let i = 0; i < numNewFlakes; i++) {
      const offsetX = Math.random() * 40 - 20; // Random offset ±20px
      const offsetY = Math.random() * 40 - 20;
      createSnowflake(currentX + offsetX, currentY + offsetY);
    }
  });
}
