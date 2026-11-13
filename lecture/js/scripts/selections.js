// From ../d3.html: SELECTION → MODIFICATION → TRANSITION → INTERACTIVITY
Deck.script("selections", {
  file: "d3.html  <script>",
  rootClass: "padded",
  stageLabel: "<div id=\"chart\"> · live document",
  setup(root) {
    root.innerHTML = `<h1 style="font:600 4rem/1.1 var(--font-serif);margin:2rem 0 0 1rem">Hello World!</h1>
      <p style="margin:1rem 0 0 1rem;color:var(--muted);font-size:.8rem">(this stage is &lt;div id="chart"&gt;. In the original file the &lt;h1&gt; was straight in the page.)</p>`;
  },
  explain: [
    "<b>Select</b>: a CSS selector → a selection of DOM nodes.",
    "<b>Modify</b>: operators like <code>.style()</code> and <code>.attr()</code> return the selection, so they chain.",
    "<b>Transition</b>: the same operators, interpolated over time.",
    "<b>Listen</b>: <code>.on(type, listener)</code>. Click the title!",
  ],
  chunks: [
    { code: `
      // SELECTION: any CSS selector. This one: the <h1> inside <div id="chart">
      const title = d3.select("#chart h1");
      console.log(title);
    ` },
    { at: 1, label: "modification", code: `

      // MODIFICATION
      title.style("color", "green").style("cursor", "pointer");
    ` },
    { at: 2, label: "transition", code: `

      // TRANSITION
      title.transition().duration(3000).style("color", "red");
    ` },
    { at: 3, label: "interactivity", code: `

      // INTERACTIVITY
      title.on("click", function () {
        // on click change to a random color from the d3 tableau10 color scheme
        d3.select(this)
          .transition()
          .style("color", d3.schemeTableau10[Math.floor(Math.random() * 10)]);
      });
    ` },
  ],
});
