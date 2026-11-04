/* ==========================================================================
   Code stage: a live editor next to a live stage.
   Each step "uncomments" the next chunk of code and re-runs it, which is the
   gradual-uncommenting live-coding routine built into the deck. You can also
   type in the editor and press Ctrl+Enter (or ▶) to re-run your own edits.

   Deck.script(name, {
     file: "stripes.js",                   // label in the editor bar
     args: { data: () => [...] },          // extra variables visible to the code
     setup(root) {},                       // prepare the stage before each run
     rootClass: "padded",                  // css class for the stage root
     stageLabel: "<svg> in this page",
     future: "placeholder" | "commented",  // how not-yet-revealed chunks look
     explain: ["text for step 0", "text for step 1", ...],
     chunks: [
       { code: `...` },                            // visible from the start
       { at: 1, label: "band scale", code: `...` }, // revealed at step 1
       { at: 1, until: 3, code: `...` },           // revealed at 1, commented out again at 3
     ],
   })
   Markup: <div class="widget" data-widget="code" data-script="name" data-layout="wide-code|wide-stage|stacked"></div>
   ========================================================================== */
(function () {
  "use strict";

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // ---- tiny JS highlighter -------------------------------------------------
  const TOKEN = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(`(?:\\[\s\S]|[^`\\])*`)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(\b(?:const|let|var|function|return|if|else|for|of|in|new|await|async|true|false|null|undefined|this|while|break|continue|typeof|try|catch)\b|=>)|(\bd3\b)|(\.[A-Za-z_$][\w$]*(?=\s*\())|(\.[A-Za-z_$][\w$]*)|(\b[A-Za-z_$][\w$]*(?=\s*\())/g;
  const CLS = [null, "com", "com", "str", "str", "num", "kw", "d3", "fn", "prop", "fn"];
  function wrap(cls, text) {
    // never let a span cross a newline (lines are wrapped individually later)
    return text.split("\n").map((p) => (p ? `<span class="tk-${cls}">${esc(p)}</span>` : "")).join("\n");
  }
  function highlight(src) {
    let out = "", last = 0, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src))) {
      out += esc(src.slice(last, m.index));
      const g = m.findIndex((v, i) => i > 0 && v !== undefined);
      out += wrap(CLS[g], m[0]);
      last = TOKEN.lastIndex;
    }
    return out + esc(src.slice(last));
  }

  // ---- text helpers -----------------------------------------------------------
  function dedent(s) {
    s = s.replace(/^\n/, "").replace(/\s+$/, "");
    const ind = Math.min(...s.split("\n").filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return s.split("\n").map((l) => l.slice(ind)).join("\n");
  }
  const commentOut = (code) => code.split("\n").map((l) => (l.trim() ? l.replace(/^(\s*)/, "$1// ") : l)).join("\n");

  function chunkState(c, step) {
    const at = c.at || 0;
    if (step < at) return "future";
    if (c.until != null && step >= c.until) return "retired";
    return "live";
  }
  function chunkText(c, state, def) {
    if (state === "live") return c.code;
    if (state === "retired") return commentOut(c.code);
    if (def.future === "commented") return commentOut(c.code);
    return c.label ? `// ▸ ${c.label}` : null; // null = not shown at all
  }

  // ---- error line offset of new Function in this engine ----------------------
  let LINE_OFFSET = 2;
  try { new Function("\nthrow new Error('probe')")(); } catch (e) {
    const m = String(e.stack).match(/<anonymous>:(\d+):\d+/);
    if (m) LINE_OFFSET = +m[1] - 2;
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

  let activeStage = null; // the stage whose code ran most recently (for async errors)
  window.addEventListener("error", (e) => activeStage && activeStage.asyncError(e.error || e.message));
  window.addEventListener("unhandledrejection", (e) => activeStage && activeStage.asyncError(e.reason));

  const totalSteps = (def) => Math.max(0, ...def.chunks.map((c) => Math.max(c.at || 0, c.until || 0)), (def.explain || []).length - 1, def.steps || 0);

  Deck.widget("code", {
    steps: (el) => {
      const def = Deck.scripts[el.dataset.script];
      return def ? totalSteps(def) : 0;
    },
    mount(el) {
      const def = Deck.scripts[el.dataset.script];
      if (!def) throw new Error(`unknown script "${el.dataset.script}"`);
      def.chunks.forEach((c) => (c.code = dedent(c.code)));
      const n = totalSteps(def);

      el.classList.add("codestage");
      if (el.dataset.layout) el.dataset.layout.split(" ").forEach((c) => el.classList.add(c));
      el.innerHTML = `
        <div class="cs-editor">
          <div class="cs-bar"><span class="file">${esc(def.file || "script.js")}</span>
            <button data-act="run" title="Ctrl+Enter">▶ run</button>
            <button data-act="reset" title="discard edits">↺ reset</button>
            <span class="step-label"></span></div>
          <div class="cs-scroll"><div class="cs-code"><pre></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off"></textarea></div></div>
          <div class="cs-error"></div>
        </div>
        <div class="cs-stage-wrap">
          <div class="cs-stage ${def.resizable ? "resizable" : ""}"><div class="cs-root ${def.rootClass || ""}"></div>
            <div class="cs-stage-label">${esc(def.stageLabel || "live")}</div></div>
          <div class="cs-console"></div>
          ${def.explain ? `<div class="cs-explain"></div>` : ""}
        </div>`;
      const pre = el.querySelector("pre");
      const ta = el.querySelector("textarea");
      const scroller = el.querySelector(".cs-scroll");
      const errBox = el.querySelector(".cs-error");
      const stage = el.querySelector(".cs-stage");
      let root = el.querySelector(".cs-root");
      const consoleBox = el.querySelector(".cs-console");
      const explain = el.querySelector(".cs-explain");
      const stepLabel = el.querySelector(".step-label");

      let step = 0, dirty = false, timers = [], intervals = [], rafs = [], errLine = null;

      // -------- rendering the editor
      function compose(s) {
        return def.chunks.map((c) => ({ c, state: chunkState(c, s), text: chunkText(c, chunkState(c, s), def) })).filter((x) => x.text !== null);
      }
      function renderStructured(s, freshAt) {
        const parts = compose(s);
        ta.value = parts.map((p) => p.text).join("\n");
        let lineNo = 1;
        pre.innerHTML = parts.map((p) => {
          const fresh = freshAt != null && (p.c.at || 0) === freshAt && p.state === "live";
          const lines = highlight(p.text).split("\n").map((l) => `<span class="cs-line" data-n="${lineNo++}">${l || " "}</span>`).join("");
          return `<span class="cs-chunk ${p.state}${fresh ? " fresh" : ""}">${lines}</span>`;
        }).join("");
        markError();
        const f = pre.querySelector(".cs-chunk.fresh");
        if (f) {
          requestAnimationFrame(() => {
            const top = f.offsetTop - scroller.clientHeight * 0.25;
            scroller.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
            setTimeout(() => f.classList.add("fade"), 1600);
          });
        }
      }
      function renderPlain() {
        pre.innerHTML = highlight(ta.value).split("\n").map((l, i) => `<span class="cs-line" data-n="${i + 1}">${l || " "}</span>`).join("");
        markError();
      }
      function markError() {
        pre.querySelectorAll(".cs-line.err").forEach((l) => l.classList.remove("err"));
        if (errLine) { const l = pre.querySelector(`.cs-line[data-n="${errLine}"]`); if (l) l.classList.add("err"); }
      }

      // -------- running the code
      function cleanup() {
        timers.forEach(clearTimeout); intervals.forEach(clearInterval); rafs.forEach(cancelAnimationFrame);
        timers = []; intervals = []; rafs = [];
        d3.select(root).selectAll("*").interrupt();
        // replace the root so listeners bound by previous runs are gone too
        const fresh = root.cloneNode(false);
        root.replaceWith(fresh); root = fresh;
        consoleBox.innerHTML = ""; consoleBox.classList.remove("show");
      }
      function fmt(v) {
        if (typeof v === "string") return v;
        if (v instanceof Element) return `<${v.tagName.toLowerCase()}>`;
        if (v && typeof v.node === "function" && typeof v.attr === "function") return `Selection(${v.size()}) [${v.nodes().slice(0, 5).map((n) => `<${n.tagName ? n.tagName.toLowerCase() : "?"}>`).join(", ")}${v.size() > 5 ? ", …" : ""}]`;
        if (typeof v === "function") return `ƒ ${v.name || "anonymous"}()`;
        try {
          let s = JSON.stringify(v, (k, x) => (typeof x === "number" ? +x.toFixed(3) : x));
          if (Array.isArray(v)) s = `Array(${v.length}) ` + s;
          return s.length > 260 ? s.slice(0, 260) + " …" : s;
        } catch (e) { return String(v); }
      }
      const fakeConsole = {};
      ["log", "info", "warn", "error", "table"].forEach((k) => {
        fakeConsole[k] = (...a) => {
          console[k === "table" ? "log" : k](...a);
          const line = document.createElement("div");
          if (k === "error") line.className = "err";
          line.textContent = a.map(fmt).join(" ");
          consoleBox.appendChild(line); consoleBox.classList.add("show");
          while (consoleBox.childElementCount > 50) consoleBox.firstElementChild.remove();
          consoleBox.scrollTop = consoleBox.scrollHeight;
        };
      });

      function showError(err) {
        const msg = (err && err.message) || String(err);
        const m = err && err.stack && String(err.stack).match(/<anonymous>:(\d+):(\d+)/);
        errLine = m ? +m[1] - LINE_OFFSET : null;
        errBox.textContent = (errLine ? `Line ${errLine}: ` : "") + `${err && err.name ? err.name + ": " : ""}${msg}`;
        errBox.classList.add("show");
        markError();
      }
      function clearError() { errLine = null; errBox.classList.remove("show"); markError(); }

      function run() {
        cleanup(); clearError();
        if (def.setup) def.setup(root);
        activeStage = api;
        const args = def.args || {};
        const names = ["d3", "root", "width", "height", "console", "setTimeout", "setInterval", "requestAnimationFrame", ...Object.keys(args)];
        const values = [
          d3, root, root.clientWidth, root.clientHeight, fakeConsole,
          (f, t) => { const id = setTimeout(guard(f), t); timers.push(id); return id; },
          (f, t) => { const id = setInterval(guard(f), t); intervals.push(id); return id; },
          (f) => { const id = requestAnimationFrame(guard(f)); rafs.push(id); return id; },
          ...Object.values(args).map((a) => (typeof a === "function" ? a() : a)),
        ];
        const code = ta.value;
        try {
          const F = /\bawait\b/.test(code) ? AsyncFunction : Function;
          const res = new F(...names, code)(...values);
          if (res && typeof res.catch === "function") res.catch(showError);
        } catch (err) { showError(err); }
      }
      function guard(f) { return (...a) => { try { f(...a); } catch (e) { showError(e); } }; }

      // -------- steps
      function setStep(s, info = {}) {
        const old = step;
        step = s;
        if (!dirty) renderStructured(s, s > 0 && (s > old || info.changedSlide) ? s : null);
        else {
          // keep the presenter's own edits: transform the text chunk by chunk
          let text = ta.value, ok = true, pos = 0;
          def.chunks.forEach((c) => {
            const a = chunkText(c, chunkState(c, old), def), b = chunkText(c, chunkState(c, s), def);
            if (a === b) { if (a) { const i = text.indexOf(a, pos); if (i >= 0) pos = i + a.length; } return; }
            if (a === null) { // insert b after current position (end of previous chunk)
              text = text.slice(0, pos) + (pos ? "\n" : "") + b + (pos ? "" : "\n") + text.slice(pos);
              pos += b.length + 1; return;
            }
            const i = text.indexOf(a, pos);
            if (i < 0) { ok = false; return; }
            const rep = b === null ? "" : b;
            text = text.slice(0, i) + rep + text.slice(i + a.length);
            if (b === null && text[i] === "\n") text = text.slice(0, i) + text.slice(i + 1);
            pos = i + rep.length;
          });
          if (ok) { ta.value = text; renderPlain(); }
          else { dirty = false; renderStructured(s, s); Deck.toast("Edits didn't match the script; reset to step " + s); }
        }
        const fresh = def.chunks.find((c) => (c.at || 0) === s && s > 0 && c.label);
        stepLabel.textContent = n ? `step ${s}/${n}${fresh && fresh.label ? " · " + fresh.label : ""}` : "";
        if (explain) explain.innerHTML = (def.explain || [])[s] || (def.explain || [])[Math.min(s, (def.explain || []).length - 1)] || "";
        run();
      }

      ta.addEventListener("input", () => { dirty = true; renderPlain(); });
      ta.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
        if (e.key === "Tab") {
          e.preventDefault();
          const a = ta.selectionStart;
          ta.setRangeText("  ", a, ta.selectionEnd, "end"); dirty = true; renderPlain();
        }
      });
      el.querySelector('[data-act="run"]').onclick = run;
      el.querySelector('[data-act="reset"]').onclick = () => { dirty = false; renderStructured(step, null); run(); };

      const api = {
        step: (s, info) => setStep(s, info),
        asyncError: (e) => { if (activeStage === api) showError(e); },
        enter: () => { activeStage = api; },
        leave: () => { cleanup(); if (activeStage === api) activeStage = null; },
        resize: () => { if (def.rerunOnResize) run(); },
      };
      renderStructured(0, null);
      return api;
    },
  });
})();
