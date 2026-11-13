/* ==========================================================================
   VizPod living deck — engine
   - slides are <section class="slide"> in index.html, steps are fragments
     (.f[data-step]) and/or widget steps
   - widgets register with Deck.widget(name, def) and are mounted lazily
   - presenter window (P) syncs over BroadcastChannel
   - X-ray (X) shows the DOM node + bound __data__ under the cursor
   ========================================================================== */
(function () {
  "use strict";

  const registry = {};
  const scripts = {};
  const themeListeners = [];
  const presenterTools = [];
  const isPresenter = new URLSearchParams(location.search).has("presenter");
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("vizpod-deck") : null;

  const Deck = (window.Deck = {
    isPresenter,
    slides: [],
    index: 0,
    step: 0,

    /** Register a widget. def = { steps?: number | (el) => number, mount(el, ctx) => instance }
     *  instance (all optional): step(n, info), enter(), leave(), resize(), destroy() */
    widget(name, def) { registry[name] = def; },

    /** Register a code-stage script (see codestage.js). */
    script(name, def) { scripts[name] = def; },
    scripts,

    /** Read a theme CSS variable, e.g. Deck.color('--ink'). */
    color(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); },
    onTheme(fn) { themeListeners.push(fn); },

    /** A control that exists only in the presenter window, shown while one of `slideIds` is current.
     *  build(box) fills the box and may return { show(), hide() }. */
    presenterTool(slideIds, build) { presenterTools.push({ ids: slideIds, build, box: null, api: null, on: false }); },
    theme() { return document.documentElement.dataset.theme || "light"; },

    /** Inject widget CSS once. */
    css(id, text) {
      if (document.getElementById("css-" + id)) return;
      const s = document.createElement("style");
      s.id = "css-" + id; s.textContent = text; document.head.appendChild(s);
    },

    toast(msg, ms = 1600) {
      const t = document.querySelector(".toast");
      t.textContent = msg; t.classList.add("show");
      clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms);
    },

    /** Parse JSON options from data-opt. */
    opts(el) { try { return JSON.parse(el.dataset.opt || "{}"); } catch (e) { return {}; } },

    /** Shared tooltip helper: returns {show(html, event|[x,y]), hide()} positioned inside `host`. */
    tooltip(host) {
      const tip = document.createElement("div");
      tip.className = "tooltip"; tip.style.display = "none";
      host.appendChild(tip);
      if (getComputedStyle(host).position === "static") host.style.position = "relative";
      return {
        el: tip,
        show(html, ev) {
          tip.innerHTML = html; tip.style.display = "block";
          const hb = host.getBoundingClientRect();
          let x, y;
          if (Array.isArray(ev)) [x, y] = ev; else { x = ev.clientX - hb.left; y = ev.clientY - hb.top; }
          const tw = tip.offsetWidth, th = tip.offsetHeight;
          let left = x + 14, top = y + 14;
          if (left + tw > hb.width) left = x - tw - 14;
          if (top + th > hb.height) top = y - th - 14;
          tip.style.left = Math.max(0, left) + "px"; tip.style.top = Math.max(0, top) + "px";
        },
        hide() { tip.style.display = "none"; },
      };
    },

    go, next, prev,
  });

  // ------------------------------------------------------------------ setup
  function init() {
    const saved = new URLSearchParams(location.search).get("theme") || localStorage.getItem("vizpod-theme");
    if (saved) document.documentElement.dataset.theme = saved;

    Deck.slides = [...document.querySelectorAll(".deck > .slide")].map((el, i) => {
      el.dataset.n = i + 1;
      return {
        el, i,
        id: el.id || null,
        title: el.dataset.title || (el.querySelector("h1,h2") || {}).textContent || `Slide ${i + 1}`,
        block: el.dataset.block || "",
        minutes: +el.dataset.minutes || 0,
        notes: (el.querySelector(".notes") || {}).innerHTML || "",
        mounted: false, instances: [],
        steps: 0,
      };
    });
    Deck.slides.forEach((s) => (s.steps = countSteps(s)));

    buildChrome();
    bindKeys();
    if (isPresenter) buildPresenter();

    const [i, st] = parseHash();
    document.body.classList.add("instant"); // no fade on first paint
    go(i, st, { broadcast: false, instant: true });
    setTimeout(() => document.body.classList.remove("instant"), 100);

    window.addEventListener("hashchange", () => {
      const [i, st] = parseHash();
      if (i !== Deck.index || st !== Deck.step) go(i, st, { fromHash: true });
    });
    if (channel) channel.onmessage = (e) => {
      const m = e.data;
      if (m.type === "go") go(m.slide, m.step, { broadcast: false });
      if (m.type === "cmd") command(m.cmd, false);
      if (m.type === "hello" && !isPresenter) channel.postMessage({ type: "go", slide: Deck.index, step: Deck.step });
    };
    if (channel && isPresenter) channel.postMessage({ type: "hello" });

    let rz;
    window.addEventListener("resize", () => {
      clearTimeout(rz);
      rz = setTimeout(() => Deck.slides.forEach((s) => s.instances.forEach((w) => w.inst.resize && w.inst.resize())), 150);
    });
  }

  function countSteps(s) {
    let n = +s.el.dataset.steps || 0;
    s.el.querySelectorAll(".f[data-step]").forEach((f) => (n = Math.max(n, +f.dataset.step)));
    s.el.querySelectorAll("[data-widget]").forEach((w) => {
      const def = registry[w.dataset.widget];
      if (!def) return;
      let k = typeof def.steps === "function" ? def.steps(w) : def.steps || 0;
      n = Math.max(n, k + (+w.dataset.stepOffset || 0));
    });
    return n;
  }

  function mount(s) {
    if (s.mounted || isPresenter) return;
    s.mounted = true;
    s.el.querySelectorAll("[data-widget]").forEach((el) => {
      const name = el.dataset.widget;
      const def = registry[name];
      if (!def) { console.warn("Unknown widget", name); el.textContent = `[missing widget: ${name}]`; return; }
      try {
        const inst = def.mount(el, { slide: s, opts: Deck.opts(el) }) || {};
        s.instances.push({ el, inst, offset: +el.dataset.stepOffset || 0 });
      } catch (err) {
        console.error(`Widget ${name} failed to mount`, err);
        el.innerHTML = `<pre style="color:var(--exit);font-size:.6rem">${name}: ${err.message}</pre>`;
      }
    });
  }

  // ------------------------------------------------------------- navigation
  function go(i, step = 0, o = {}) {
    i = Math.max(0, Math.min(Deck.slides.length - 1, i | 0));
    const s = Deck.slides[i];
    step = Math.max(0, Math.min(s.steps, step | 0));
    const prevIndex = Deck.index, prevStep = Deck.step;
    const changedSlide = i !== prevIndex || !s.el.classList.contains("active");

    if (changedSlide) {
      const old = Deck.slides[prevIndex];
      if (old && old !== s) {
        old.el.classList.remove("active");
        old.instances.forEach((w) => w.inst.leave && safe(() => w.inst.leave()));
      }
      mount(s);
      s.el.classList.add("active");
      s.instances.forEach((w) => w.inst.enter && safe(() => w.inst.enter()));
      // warm up the next slide (visibility:hidden keeps layout, so it can measure itself)
      const nxt = Deck.slides[i + 1];
      if (nxt) setTimeout(() => mount(nxt), 400);
    }

    Deck.index = i; Deck.step = step;
    applyStep(s, step, { dir: changedSlide ? (i > prevIndex ? 1 : -1) : Math.sign(step - prevStep), changedSlide, prevStep });

    const hash = `#${i + 1}${step ? "." + step : ""}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    updateChrome();
    if (o.broadcast !== false && channel) channel.postMessage({ type: "go", slide: i, step });
    if (isPresenter) renderPresenter();
  }

  function applyStep(s, step, info) {
    s.el.dataset.step = step;
    s.el.querySelectorAll(".f[data-step]").forEach((f) => {
      const k = +f.dataset.step;
      f.classList.toggle("visible", step >= k);
      f.classList.toggle("past", step > k);
      f.classList.toggle("current", step === k);
      if (f.dataset.until) f.classList.toggle("visible", step >= k && step < +f.dataset.until);
    });
    s.instances.forEach((w) => w.inst.step && safe(() => w.inst.step(Math.max(0, step - w.offset), info)));
  }

  function next() {
    const s = Deck.slides[Deck.index];
    if (Deck.step < s.steps) go(Deck.index, Deck.step + 1);
    else if (Deck.index < Deck.slides.length - 1) go(Deck.index + 1, 0);
  }
  function prev() {
    if (Deck.step > 0) go(Deck.index, Deck.step - 1);
    else if (Deck.index > 0) go(Deck.index - 1, Deck.slides[Deck.index - 1].steps);
  }

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, "");
    if (!h) return [0, 0];
    const [a, b] = h.split(".");
    let i = /^\d+$/.test(a) ? +a - 1 : Deck.slides.findIndex((s) => s.id === a);
    return [Math.max(0, i), +b || 0];
  }

  function safe(fn) { try { fn(); } catch (e) { console.error(e); } }

  // ----------------------------------------------------------------- chrome
  let progressCells = [];
  function buildChrome() {
    const body = document.body;
    body.insertAdjacentHTML("beforeend", `
      <div class="progress"></div>
      <div class="counter"></div>
      <nav class="stepnav" aria-label="steps on this slide">
        <span class="sn-hint"></span>
        <button class="sn-arrow" data-d="-1" aria-label="previous step">‹</button>
        <span class="sn-dots"></span>
        <button class="sn-arrow sn-next" data-d="1" aria-label="next step">›</button>
      </nav>
      <div class="xray-badge">X-RAY · hover any mark</div>
      <div class="xray-box"></div><div class="xray-panel"></div>
      <div class="toast"></div>
      <div class="blackout"></div>
      <div class="menu"></div>`);

    // The progress bar is itself a warming-stripes chart: one stripe per slide,
    // coloured by the global anomaly of that slice of 1850–2025.
    const prog = document.querySelector(".progress");
    const n = Deck.slides.length;
    const vals = (window.CLIMATE && CLIMATE.global.values.map((d) => d.anomaly)) || d3.range(n).map((i) => i / n - 0.5);
    const color = d3.scaleDiverging([1.1, 0, -1.1], d3.interpolateRdBu);
    progressCells = Deck.slides.map((s, i) => {
      const lo = Math.floor((i * vals.length) / n), hi = Math.max(lo + 1, Math.floor(((i + 1) * vals.length) / n));
      const c = document.createElement("i");
      c.style.background = color(d3.mean(vals.slice(lo, hi)));
      prog.appendChild(c);
      return c;
    });
    buildMenu();
    setupXray();
  }

  // Label for a step, if a widget on the slide knows one (code stages name their chunks).
  function stepLabel(s, n) {
    for (const w of s.instances) {
      if (!w.inst.label) continue;
      let l = null; safe(() => { l = w.inst.label(n - w.offset); });
      if (l) return l;
    }
    return "";
  }

  let navSlide = -1;
  const touchUI = matchMedia("(pointer: coarse)").matches && !matchMedia("(pointer: fine)").matches;

  // ----------------------------------------------------------------- touch
  // Swipe left / right = next / previous step, unless the finger started on something that
  // handles its own gestures (inputs, editors, sliders, d3 drag/zoom/brush, scrollable code).
  function bindTouch() {
    if (isPresenter) return;
    if (touchUI) document.body.classList.add("touch-ui");
    let t0 = null, hinted = false;
    const ownsGesture = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.matches("input, textarea, select, button, a, [contenteditable], .cm-editor, .stepnav, .menu")) return true;
        const cs = getComputedStyle(n);
        if (cs.touchAction === "none" || cs.touchAction.includes("pan-y") && !cs.touchAction.includes("pan-x")) return true;
        if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 2) return true;
      }
      return false;
    };
    document.addEventListener("touchstart", (e) => {
      if (!hinted && touchUI) {
        hinted = true;
        Deck.toast(innerHeight > innerWidth ? "Swipe ← → to move · turn your phone sideways for a bigger view" : "Swipe ← → to move, or use the arrows", 3200);
      }
      t0 = e.touches.length === 1 && !ownsGesture(e.target)
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    }, { passive: true });
    document.addEventListener("touchmove", (e) => { if (t0 && e.touches.length > 1) t0 = null; }, { passive: true });
    document.addEventListener("touchend", (e) => {
      if (!t0 || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y, dt = Date.now() - t0.t;
      t0 = null;
      if (dt > 900 || Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      if (dx < 0) next(); else prev();
    }, { passive: true });
  }
  function updateStepNav() {
    const s = Deck.slides[Deck.index], nav = document.querySelector(".stepnav");
    if (!nav) return;
    // touch screens get the arrows on every slide (there is no keyboard); elsewhere only when a slide has steps
    nav.classList.toggle("show", s.steps > 0 || touchUI);
    nav.querySelector('[data-d="-1"]').disabled = touchUI ? (Deck.index === 0 && Deck.step === 0) : Deck.step === 0;
    nav.querySelector('[data-d="1"]').disabled = Deck.index === Deck.slides.length - 1 && Deck.step >= s.steps;
    const dots = nav.querySelector(".sn-dots");
    if (!s.steps) { dots.innerHTML = ""; navSlide = Deck.index; nav.querySelector(".sn-hint").textContent = ""; return; }
    if (navSlide !== Deck.index) {
      navSlide = Deck.index;
      dots.innerHTML = d3.range(1, s.steps + 1).map((k) => {
        const l = stepLabel(s, k);
        return `<button class="sn-dot" data-s="${k}" title="step ${k}${l ? ": " + l : ""}" aria-label="step ${k}">${k}</button>`;
      }).join("");
      // a gentle nudge that there is more on this slide
      if (Deck.step === 0) { nav.classList.remove("nudge"); void nav.offsetWidth; nav.classList.add("nudge"); }
    }
    dots.querySelectorAll(".sn-dot").forEach((d) => {
      const k = +d.dataset.s;
      d.classList.toggle("done", k <= Deck.step);
      d.classList.toggle("current", k === Deck.step);
    });
    const editing = document.body.classList.contains("editing");
    const last = Deck.step >= s.steps;
    const nl = last ? "" : stepLabel(s, Deck.step + 1);
    nav.querySelector(".sn-hint").innerHTML = editing
      ? `editing · <kbd>Esc</kbd> to leave, then <kbd>→</kbd>`
      : last ? (Deck.index < Deck.slides.length - 1 ? "next slide" : "") : `next${nl ? ": " + nl.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) : ` step ${Deck.step + 1}/${s.steps}`}`;
  }

  function updateChrome() {
    progressCells.forEach((c, i) => c.classList.toggle("future", i > Deck.index));
    updateStepNav();
    document.querySelector(".counter").innerHTML =
      `<b>${Deck.index + 1}</b>/${Deck.slides.length}`;
    document.querySelectorAll(".menu li").forEach((li) => li.classList.toggle("current", +li.dataset.i === Deck.index));
  }

  function buildMenu() {
    const menu = document.querySelector(".menu");
    const groups = d3.groups(Deck.slides, (s) => s.block);
    menu.innerHTML = groups.map(([b, ss]) => `
      <h3>${b ? (b === "break" ? "Break" : "Block " + b) : ""} · ${d3.sum(ss, (s) => s.minutes)} min</h3>
      <ol>${ss.map((s) => `<li data-i="${s.i}"><span class="n">${s.i + 1}</span>${s.title}<span class="m">${s.minutes ? s.minutes + "′" : ""}</span></li>`).join("")}</ol>`).join("") +
      `<div class="keys">
        <span><kbd>→</kbd>/<kbd>Space</kbd> next step (or the <kbd>›</kbd> bottom right)</span><span><kbd>←</kbd> back</span>
        <span><kbd>Shift</kbd>+<kbd>→</kbd> next slide</span><span><kbd>G</kbd> this menu</span>
        <span><kbd>P</kbd> presenter window</span><span><kbd>X</kbd> X-ray</span><span><kbd>T</kbd> light/dark</span>
        <span><kbd>F</kbd> fullscreen</span><span><kbd>B</kbd> blackout</span>
        <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> run code</span><span><kbd>Esc</kbd> leave editor</span>
      </div>`;
    menu.addEventListener("click", (e) => {
      const li = e.target.closest("li");
      if (li) { go(+li.dataset.i, 0); document.body.classList.remove("menu-on"); }
    });
  }

  // -------------------------------------------------------------- keyboard
  function bindKeys() {
    bindTouch();
    const nav = document.querySelector(".stepnav");
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.d === "1") next();
      else if (b.dataset.d === "-1") prev();
      else if (b.dataset.s) go(Deck.index, +b.dataset.s);
    });
    // After clicking a button or a slider in a slide, hand the keyboard back to the deck,
    // so Space / arrows move steps instead of pressing that button again.
    document.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("button, a, input[type=range], input[type=checkbox], input[type=radio], select");
      if (b && b.tagName !== "SELECT") requestAnimationFrame(() => b.blur());
    });
    document.addEventListener("change", (e) => {
      if (e.target.matches && e.target.matches("select, input[type=range], input[type=checkbox], input[type=radio]")) e.target.blur();
    });
    const isText = (t) => t && (t.tagName === "TEXTAREA" || t.isContentEditable ||
      (t.tagName === "INPUT" && !/^(range|checkbox|radio|button|submit|reset|color)$/i.test(t.type)));
    document.addEventListener("focusin", (e) => { if (isText(e.target)) { document.body.classList.add("editing"); updateStepNav(); } });
    document.addEventListener("focusout", (e) => { if (isText(e.target)) { document.body.classList.remove("editing"); updateStepNav(); } });

    document.addEventListener("keydown", (e) => {
      const t = e.target;
      const typing = isText(t) || (t && t.tagName === "SELECT");
      if (typing) {
        if (e.key === "Escape") t.blur();
        // clickers send PageDown/PageUp — honour them even while editing
        if (e.key !== "PageDown" && e.key !== "PageUp") return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "ArrowDown") { e.preventDefault(); e.shiftKey ? go(Deck.index + 1, 0) : next(); }
      else if (k === "ArrowLeft" || k === "PageUp" || k === "ArrowUp") { e.preventDefault(); e.shiftKey ? go(Deck.index - 1, 0) : prev(); }
      else if (k === "Home") go(0, 0);
      else if (k === "End") go(Deck.slides.length - 1, 0);
      else if (k === "Escape") { document.body.classList.remove("menu-on", "blackout-on"); }
      else command(k.toLowerCase(), true);
    });
  }

  function command(c, broadcast) {
    if (c === "g" || c === "m" || c === "?") document.body.classList.toggle("menu-on");
    else if (c === "t") {
      const nt = Deck.theme() === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nt;
      localStorage.setItem("vizpod-theme", nt);
      themeListeners.forEach((fn) => safe(() => fn(nt)));
      if (broadcast && channel) channel.postMessage({ type: "cmd", cmd: "t-sync:" + nt });
    } else if (c.startsWith("t-sync:")) {
      document.documentElement.dataset.theme = c.slice(7);
      themeListeners.forEach((fn) => safe(() => fn(c.slice(7))));
    } else if (c === "x") toggleXray();
    else if (c === "b" || c === ".") { document.body.classList.toggle("blackout-on"); if (broadcast && channel && isPresenter) channel.postMessage({ type: "cmd", cmd: "b" }); }
    else if (c === "f") { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
    else if (c === "p" && !isPresenter) {
      const u = location.pathname + "?presenter" + location.hash;
      window.open(u, "vizpod-presenter", "width=1200,height=800");
    } else if (c === "h") document.body.classList.toggle("hide-chrome");
  }

  // ----------------------------------------------------------------- X-ray
  let xrayOn = false;
  function toggleXray() {
    xrayOn = !xrayOn;
    document.body.classList.toggle("xray-on", xrayOn);
    if (!xrayOn) { document.querySelector(".xray-box").style.display = "none"; document.querySelector(".xray-panel").style.display = "none"; }
    Deck.toast(xrayOn ? "X-ray on: hover any element to see its DOM node and bound data" : "X-ray off");
  }
  function setupXray() {
    const box = document.querySelector(".xray-box");
    const panel = document.querySelector(".xray-panel");
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const fmtVal = (v) => {
      if (/^-?\d+\.\d{3,}$/.test(v)) return String(+(+v).toFixed(2));
      return v.length > 60 ? v.slice(0, 57) + "…" : v;
    };
    const fmtData = (d) => {
      try {
        const seen = new WeakSet();
        let s = JSON.stringify(d, (k, v) => {
          if (typeof v === "number") return +v.toFixed(3);
          if (v && typeof v === "object") { if (seen.has(v)) return "[circular]"; seen.add(v); }
          if (k === "geometry") return "{…geometry…}";
          return v;
        }, 1);
        if (s && s.length > 420) s = s.slice(0, 420) + " …";
        return s;
      } catch (e) { return String(d); }
    };
    document.addEventListener("mousemove", (e) => {
      if (!xrayOn) return;
      let t = e.target;
      const active = Deck.slides[Deck.index]?.el;
      if (!active || !active.contains(t) || t.closest(".cs-editor, .controls, .xray-skip")) { box.style.display = panel.style.display = "none"; return; }
      // prefer the nearest element that actually carries data
      let host = t;
      while (host && host !== active && host.__data__ === undefined && !(host instanceof SVGElement && host.tagName !== "svg")) host = host.parentNode;
      if (!host || host === active) { box.style.display = panel.style.display = "none"; return; }
      t = host;
      const r = t.getBoundingClientRect();
      Object.assign(box.style, { display: "block", left: r.left + "px", top: r.top + "px", width: Math.max(2, r.width) + "px", height: Math.max(2, r.height) + "px" });
      const attrs = [...t.attributes].filter((a) => a.name !== "style" || a.value.length < 80).slice(0, 8)
        .map((a) => ` <span class="a">${a.name}</span>=<span class="v">"${esc(fmtVal(a.value))}"</span>`).join("");
      let html = `<span class="t">&lt;${t.tagName.toLowerCase()}</span>${attrs}<span class="t">&gt;</span>`;
      const own = t.__data__;
      if (own !== undefined) html += `<span class="h">__data__</span>${esc(fmtData(own))}`;
      else html += `<span class="h">no data bound</span>`;
      panel.innerHTML = html;
      panel.style.display = "block";
      const pw = panel.offsetWidth, ph = panel.offsetHeight;
      let x = e.clientX + 18, y = e.clientY + 18;
      if (x + pw > innerWidth - 8) x = e.clientX - pw - 18;
      if (y + ph > innerHeight - 8) y = e.clientY - ph - 18;
      panel.style.left = x + "px"; panel.style.top = y + "px";
    }, true);
  }

  // ------------------------------------------------------------- presenter
  let pv = null;
  function buildPresenter() {
    document.body.classList.add("presenter");
    document.title = "Presenter · " + document.title;
    const ui = document.createElement("div");
    ui.className = "presenter-ui";
    ui.innerHTML = `
      <div class="pv-top">
        <div class="pv-clock" id="pv-clock">00:00</div>
        <div><div class="pv-sub" id="pv-plan-delta"></div><div class="pv-sub" id="pv-wall"></div></div>
        <div style="margin-left:auto" class="pv-sub">Presenter view: arrows work here too · audience window follows</div>
      </div>
      <div class="pv-now">
        <div class="kicker" id="pv-kicker"></div>
        <h2 id="pv-title"></h2>
        <div class="pv-steps" id="pv-steps"></div>
        <div class="pv-notes" id="pv-notes"></div>
      </div>
      <div class="pv-side">
        <div class="pv-next"><div class="kicker">Next</div><h3 id="pv-next"></h3></div>
        <ol class="pv-plan" id="pv-plan"></ol>
      </div>
      <div class="pv-bottom">
        <button class="btn" id="pv-prev">← prev</button>
        <button class="btn primary" id="pv-nextbtn">next →</button>
        <button class="btn" id="pv-pause">pause timer</button>
        <button class="btn" id="pv-reset">reset block timer</button>
        <button class="btn" id="pv-black">blackout (B)</button>
        <button class="btn" id="pv-xray">X-ray on audience (X)</button>
        <span class="pv-tools" id="pv-tools"></span>
      </div>`;
    document.body.appendChild(ui);
    pv = { start: Date.now(), paused: false, pausedAt: 0, block: null };
    ui.querySelector("#pv-prev").onclick = prev;
    ui.querySelector("#pv-nextbtn").onclick = next;
    ui.querySelector("#pv-pause").onclick = (e) => {
      if (pv.paused) { pv.start += Date.now() - pv.pausedAt; pv.paused = false; e.target.textContent = "pause timer"; }
      else { pv.paused = true; pv.pausedAt = Date.now(); e.target.textContent = "resume timer"; }
    };
    ui.querySelector("#pv-reset").onclick = () => { pv.start = Date.now(); pv.pausedAt = Date.now(); };
    ui.querySelector("#pv-black").onclick = () => channel && channel.postMessage({ type: "cmd", cmd: "b" });
    ui.querySelector("#pv-xray").onclick = () => channel && channel.postMessage({ type: "cmd", cmd: "x" });
    setInterval(tickPresenter, 500);
  }
  const mmss = (ms) => { const s = Math.round(Math.abs(ms) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  function tickPresenter() {
    const s = Deck.slides[Deck.index];
    const now = pv.paused ? pv.pausedAt : Date.now();
    const elapsed = now - pv.start;
    const inBlock = Deck.slides.filter((x) => x.block === s.block);
    const planned = d3.sum(inBlock.filter((x) => x.i < s.i), (x) => x.minutes) * 60000;
    const delta = elapsed - planned;
    const clock = document.getElementById("pv-clock");
    clock.textContent = mmss(elapsed);
    clock.classList.toggle("behind", delta > 120000);
    document.getElementById("pv-plan-delta").textContent =
      `${s.block === "break" ? "Break" : "Block " + s.block}: planned ${mmss(planned)} at this slide · ${Math.abs(delta) < 30000 ? "on time" : mmss(delta) + (delta > 0 ? " behind" : " ahead")}`;
    document.getElementById("pv-wall").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function renderPresenter() {
    const s = Deck.slides[Deck.index];
    if (pv.block !== s.block) { pv.block = s.block; pv.start = Date.now(); pv.pausedAt = Date.now(); }
    document.getElementById("pv-kicker").textContent = `Slide ${s.i + 1}/${Deck.slides.length} · ${s.block === "break" ? "Break" : "Block " + s.block} · ${s.minutes}′`;
    document.getElementById("pv-title").textContent = s.title;
    document.getElementById("pv-steps").innerHTML = d3.range(s.steps).map((k) => `<i class="${k < Deck.step ? "done" : ""}"></i>`).join("");
    document.getElementById("pv-notes").innerHTML = s.notes || "<p class='muted'>No notes.</p>";
    const n = Deck.slides[s.i + 1];
    document.getElementById("pv-next").textContent = n ? n.title : "— end —";
    presenterTools.forEach((t) => {
      const on = t.ids.includes(s.el.id);
      if (on && !t.box) {
        t.box = document.createElement("span");
        t.box.className = "pv-tool";
        document.getElementById("pv-tools").appendChild(t.box);
        try { t.api = t.build(t.box) || {}; } catch (e) { console.error(e); t.api = {}; }
      }
      if (!t.box || on === t.on) return;
      t.on = on; t.box.hidden = !on;
      if (on) t.api.show && safe(() => t.api.show()); else t.api.hide && safe(() => t.api.hide());
    });
    document.getElementById("pv-plan").innerHTML = Deck.slides.filter((x) => x.block === s.block)
      .map((x) => `<li class="${x.i === s.i ? "current" : x.i < s.i ? "done" : ""}">${x.title} <span class="muted">${x.minutes}′</span></li>`).join("");
    tickPresenter();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else setTimeout(init, 0);
})();
