/* Fig. 3 of the D3 paper: the same operation in the raw DOM, CSS, jQuery and D3, runnable on a live mini-document */
(function () {
  Deck.css("fig3", `
    .f3 { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(0, 1fr); gap: 1.6rem; height: 100%; min-height: 0; }
    .f3-cards { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 0.9rem; min-height: 0; }
    .f3-card { position: relative; display: flex; flex-direction: column; gap: 0.4rem; text-align: left; cursor: pointer;
      background: var(--code-bg); color: var(--code-ink); border: 2px solid transparent; border-radius: 0.55rem;
      padding: 0.7rem 0.9rem; font: inherit; transition: border-color .2s, transform .15s; min-height: 0; }
    .f3-card:hover { border-color: var(--code-dim); transform: translateY(-2px); }
    .f3-card.ran { border-color: var(--tok-d3); }
    .f3-card h4 { margin: 0; display: flex; align-items: baseline; gap: 0.6rem; font: 600 0.72rem var(--font-sans); color: #fff; }
    .f3-card h4 small { font: 0.5rem var(--font-mono); color: var(--code-dim); font-weight: 400; }
    .f3-card pre { margin: 0.3rem 0 0; font: 0.64rem/1.6 var(--font-mono); white-space: pre; overflow: hidden; color: var(--code-ink); flex: 1 1 auto; }
    .f3-card .run { font: 0.55rem var(--font-mono); color: var(--code-dim); display: flex; justify-content: space-between; }
    .f3-card.d3 { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent); }
    .f3-card.d3 .tag { position: absolute; right: 0.7rem; top: 0.6rem; font: 600 0.5rem var(--font-sans); letter-spacing: .1em;
      text-transform: uppercase; color: #fff; background: var(--accent); padding: 0.15rem 0.45rem; border-radius: 999px; }
    .f3 .s { color: var(--tok-str); } .f3 .k { color: var(--tok-kw); } .f3 .d { color: var(--tok-d3); font-weight: 600; } .f3 .m { color: var(--tok-fn); } .f3 .c { color: var(--tok-com); }
    .f3-side { display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; }
    .f3-doc { flex: 1 1 auto; background: #2b2b28; border-radius: 0.55rem; padding: 1.2rem 1.4rem; display: flex; flex-direction: column;
      justify-content: center; gap: 0.5rem; border: 1px solid var(--rule); position: relative; min-height: 0; }
    .f3-doc::before { content: "<body>"; position: absolute; left: 0.7rem; top: 0.5rem; font: 0.5rem var(--font-mono); color: #77756d; }
    .f3-doc p { margin: 0; font: 600 1.6rem/1.15 var(--font-serif); color: #6d6b64; transition: color 0.8s ease; }
    .f3-doc p::before { content: "<p>"; font: 0.45rem var(--font-mono); color: #77756d; margin-right: 0.5rem; vertical-align: middle; }
    .f3-log { font: 0.58rem/1.5 var(--font-mono); color: var(--ink-2); min-height: 3em; }
    .f3-log b { color: var(--ink); }
  `);

  const cards = [
    { id: "dom", title: "W3C DOM API", note: "the browser, raw",
      code: `<span class="k">var</span> ps = document.<span class="m">getElementsByTagName</span>(<span class="s">"p"</span>);
<span class="k">for</span> (<span class="k">var</span> i = 0; i &lt; ps.length; i++) {
  <span class="k">var</span> p = ps.<span class="m">item</span>(i);
  p.style.<span class="m">setProperty</span>(<span class="s">"color"</span>, <span class="s">"white"</span>, <span class="k">null</span>);
}`,
      run(doc) { const ps = doc.getElementsByTagName("p"); for (let i = 0; i < ps.length; i++) ps.item(i).style.setProperty("color", "white", null); return ps.length; } },
    { id: "css", title: "CSS", note: "declarative, but static",
      code: `p { <span class="m">color</span>: <span class="s">white</span>; }`,
      run(doc) {
        let s = doc.querySelector("style");
        if (!s) { s = document.createElement("style"); doc.appendChild(s); }
        s.textContent = `#${doc.id} p { color: white; }`; // scoped to this panel
        return doc.querySelectorAll("p").length;
      } },
    { id: "jq", title: "jQuery", note: "2006 · emulated with a 3-line $ shim",
      code: `<span class="d">$</span>(<span class="s">"p"</span>).<span class="m">css</span>(<span class="s">"color"</span>, <span class="s">"white"</span>);`,
      run(doc) {
        const $ = (sel) => { const nodes = doc.querySelectorAll(sel); return { css(k, v) { nodes.forEach((n) => (n.style[k] = v)); return this; }, length: nodes.length }; };
        return $("p").css("color", "white").length;
      } },
    { id: "d3", title: "D3", note: "2011 · the W3C Selectors API, chained",
      code: `<span class="d">d3</span>.<span class="m">selectAll</span>(<span class="s">"p"</span>).<span class="m">style</span>(<span class="s">"color"</span>, <span class="s">"white"</span>);`,
      run(doc) { return d3.select(doc).selectAll("p").style("color", "white").size(); } },
  ];

  Deck.widget("fig3", {
    steps: 0,
    mount(el) {
      el.classList.add("f3");
      const docId = "fig3-doc";
      el.innerHTML = `
        <div class="f3-cards">${cards.map((c) => `
          <button class="f3-card ${c.id === "d3" ? "d3" : ""}" data-id="${c.id}">
            ${c.id === "d3" ? '<span class="tag">what we use</span>' : ""}
            <h4>${c.title}<small>${c.note}</small></h4>
            <pre>${c.code}</pre>
            <span class="run"><span>▶ click to run on the document →</span><span class="chars"></span></span>
          </button>`).join("")}
        </div>
        <div class="f3-side">
          <div class="f3-doc" id="${docId}"><p>The document</p><p>is the</p><p>scenegraph.</p></div>
          <div class="controls"><button class="btn" data-act="reset">↺ reset</button></div>
          <div class="f3-log">Four ways to make every paragraph white. Same result; one of them also knows about data.</div>
        </div>`;
      el.querySelectorAll(".f3-card").forEach((b) => {
        b.querySelector(".chars").textContent = b.querySelector("pre").textContent.replace(/\s+/g, " ").trim().length + " chars";
      });
      const doc = el.querySelector(".f3-doc");
      const log = el.querySelector(".f3-log");
      // bind something to the paragraphs so X-ray has a story to tell
      d3.select(doc).selectAll("p").data(["The document", "is the", "scenegraph."]);

      function reset() {
        doc.querySelectorAll("p").forEach((p) => p.style.removeProperty("color"));
        const s = doc.querySelector("style"); if (s) s.remove();
        el.querySelectorAll(".f3-card").forEach((c) => c.classList.remove("ran"));
      }
      el.querySelectorAll(".f3-card").forEach((btn) => btn.addEventListener("click", () => {
        reset();
        const c = cards.find((x) => x.id === btn.dataset.id);
        // let the reset paint before re-colouring, so the transition is visible
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const n = c.run(doc);
          btn.classList.add("ran");
          const chars = btn.querySelector("pre").textContent.replace(/\s+/g, " ").trim().length;
          log.innerHTML = `<b>${c.title}</b> changed ${n} &lt;p&gt; nodes · ${chars} characters of code` +
            (c.id === "d3" ? `<br>…and it returned a selection you can keep chaining: <b>.data()</b>, <b>.transition()</b>, <b>.on()</b>` :
             c.id === "css" ? `<br>…but CSS can't add or remove elements to match a dataset` :
             c.id === "jq" ? `<br>…but jQuery "lacks a mechanism for adding or removing elements to match a dataset"` : "");
        }));
      }));
      el.querySelector('[data-act="reset"]').onclick = () => { reset(); log.textContent = "Reset."; };
      return { leave: reset };
    },
  });
})();
