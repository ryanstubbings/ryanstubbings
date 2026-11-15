/* Open every page at the top. Going back or forward returns to where you left off. */
(function () {
  var key = "y:" + location.pathname, nav = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || {};
  try { if ("scrollRestoration" in history) history.scrollRestoration = "manual"; } catch (e) {}
  function place() {
    var y = 0;
    if (nav.type === "back_forward") { try { y = +sessionStorage.getItem(key) || 0; } catch (e) {} }
    if (location.hash) return;
    scrollTo(0, y);
  }
  var touched = false;   // once the visitor starts scrolling, never move them
  ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (t) { addEventListener(t, function () { touched = true; }, { passive: true, once: true }); });
  place(); addEventListener("load", function () { if (!touched) place(); });
  
  addEventListener("pagehide", function () { try { sessionStorage.setItem(key, String(scrollY)); } catch (e) {} });
})();

/* Motion for the site. Every effect is skipped for visitors who ask for reduced motion. */
(function () {
  var doc = document.documentElement;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = matchMedia("(hover: hover)").matches;
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var gothicFont = getComputedStyle(doc).getPropertyValue("--gothic");

  /* ---------- 1. Blackletter flicker (from the Framer override GothicFlicker.tsx) ----------
     Words marked data-flicker stutter between the blackletter face and the normal one. */
  function setGothic(word, on) {
    word.style.fontFamily = on ? gothicFont : "";
    word.style.fontStyle = on ? "italic" : "";
    word.style.fontWeight = on ? "400" : "";
  }
  if (!reduced) {
    $$("[data-flicker]").forEach(function (word) {
      var host = word.closest("[data-flicker-host]") || word.closest("a") || word;
      var pattern = [65, 100, 55, 260, 80, 140, 550], timer, active = false, step = 0;
      function tick() {
        if (!active) return;
        setGothic(word, step % 2 === 0);
        timer = setTimeout(tick, pattern[step % pattern.length]); step++;
      }
      host.addEventListener("pointerenter", function () { if (active) return; active = true; step = 0; tick(); });
      host.addEventListener("pointerleave", function () { active = false; clearTimeout(timer); setGothic(word, false); });
    });
  }

  /* ---------- 2. Breathing hover on images ---------- */
  if (canHover && !reduced) {
    $$(".card .cover:not(video), .shots img, .shots video, .mockup img").forEach(function (img) {
      var host = img.closest(".card") || img, over = false;
      host.addEventListener("pointerenter", function () { over = true; img.classList.add("breathing"); });
      host.addEventListener("pointerleave", function () { over = false; });
      img.addEventListener("animationiteration", function () { if (!over) img.classList.remove("breathing"); });
    });
  }

  if (reduced || !("IntersectionObserver" in window)) return;   // everything below is scroll and load motion

  /* ---------- 3. Film grain: one small noise tile, drawn once ---------- */
  try {
    var cv = document.createElement("canvas"); cv.width = cv.height = 256;
    var g = cv.getContext("2d"), d = g.createImageData(256, 256);
    for (var i = 0; i < d.data.length; i += 4) { var v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    var grain = document.createElement("div"); grain.className = "grain"; grain.setAttribute("aria-hidden", "true");
    grain.style.backgroundImage = "url(" + cv.toDataURL() + ")"; document.body.appendChild(grain);
  } catch (e) {}

  /* ---------- 4. Headline: split into masked lines ---------- */
  $$(".title").forEach(function (h) {
    var groups = [[]];
    Array.prototype.slice.call(h.childNodes).forEach(function (n) { if (n.nodeName === "BR") groups.push([]); else groups[groups.length - 1].push(n); });
    h.textContent = "";
    groups.forEach(function (nodes, i) {
      var line = document.createElement("span"), inner = document.createElement("span");
      line.className = "line"; inner.style.setProperty("--i", i);
      nodes.forEach(function (n) { inner.appendChild(n); }); line.appendChild(inner); h.appendChild(line);
    });
  });

  /* ---------- 5. Mark what moves, and how ---------- */
  function mark(sel, how) { $$(sel).forEach(function (el) { if (!el.hasAttribute("data-m")) el.setAttribute("data-m", how); }); }
  mark(".card", "wipe");
  $$(".shots figure").forEach(function (f) { if (!f.querySelector(".wide-placeholder")) f.setAttribute("data-m", "wipe"); });
  mark(".about, .talk", "draw");
  mark(".page > .contact, .hero .body, .faves > h2, .card-head, .card > .label, .about h2, .about .heading, .talk .heading, .foot, " +
       ".case-top, .case-kicker, .case-intro > *, .feature, .feature-media, .direction > *, .more > *, .wide-placeholder, .mockup, .ticker, .ux-cols > *, .ux-style > *, .pains > li, .persona, .fixes > li, .lens, .monitor, .frame, .email", "up");

  /* about text: wrap each word so it can light up */
  var words = [];
  $$(".about .body p").forEach(function (p) {
    var parts = p.textContent.split(/(\s+)/); p.textContent = "";
    parts.forEach(function (t) {
      if (/^\s+$/.test(t) || !t) { p.appendChild(document.createTextNode(t)); return; }
      var s = document.createElement("span"); s.className = "w"; s.textContent = t; p.appendChild(s); words.push(s);
    });
  });

  doc.classList.add("motion");

  /* ---------- 6. Reveal on scroll, with a small stagger between neighbours ---------- */
  var io = new IntersectionObserver(function (entries) {
    var n = 0;
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.style.setProperty("--d", (n++ * 80) + "ms");
      e.target.classList.add("in"); io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  $$("[data-m]").forEach(function (el) { io.observe(el); });

  /* ---------- 7. Word-by-word light on the about text ---------- */
  var body = document.querySelector(".about .body"), queued = false;
  function light() {
    queued = false; if (!body) return;
    var r = body.getBoundingClientRect(), vh = innerHeight;
    var prog = (vh * 0.9 - r.top) / r.height;                       // done once the last line is 10% clear of the bottom
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) prog = 1;
    var upto = Math.round(Math.max(0, Math.min(1, prog)) * words.length);
    for (var k = 0; k < words.length; k++) words[k].classList.toggle("lit", k < upto);
  }
  /* anything sitting at the very bottom of the page is revealed once you get there */
  function end() {
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - innerHeight * 0.1)
      $$("[data-m]:not(.in)").forEach(function (el) { if (el.getBoundingClientRect().top < innerHeight) { el.classList.add("in"); io.unobserve(el); } });
  }
  addEventListener("scroll", function () { if (!queued) { queued = true; requestAnimationFrame(function () { light(); end(); }); } }, { passive: true });
  addEventListener("resize", function () { light(); end(); }); light(); end();
})();

/* Smooth, slow scrolling. The mouse wheel or trackpad sets a destination and the page glides to it.
   Touch screens keep their own native scrolling, and so do visitors who ask for reduced motion. */
(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var EASE = 0.075;                 // lower = slower, floatier glide (0.05 to 0.15 is the useful range)
  var target = scrollY, current = scrollY, running = false;
  function limit() { return document.documentElement.scrollHeight - innerHeight; }
  function step() {
    current += (target - current) * EASE;
    if (Math.abs(target - current) < 0.4) { current = target; running = false; }
    scrollTo(0, current);
    if (running) requestAnimationFrame(step);
  }
  addEventListener("wheel", function (e) {
    if (e.ctrlKey || e.metaKey || e.defaultPrevented) return;          // leave pinch-zoom alone
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;               // leave sideways swipes alone
    var inner = e.target.closest && e.target.closest("[data-native-scroll]");   // let scrollable panels (the monitor screen) scroll themselves
    if (inner) { var up = e.deltaY < 0; if ((up && inner.scrollTop > 0) || (!up && inner.scrollTop + inner.clientHeight < inner.scrollHeight - 1)) return; }
    e.preventDefault();
    var dy = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1);
    if (!running) target = current = scrollY;
    target = Math.max(0, Math.min(limit(), target + dy));
    if (!running) { running = true; requestAnimationFrame(step); }
  }, { passive: false });
  /* keyboard, scrollbar and link jumps scroll natively; keep our position in step with them */
  addEventListener("scroll", function () { if (!running) target = current = scrollY; }, { passive: true });
  addEventListener("keydown", function () { running = false; });
  addEventListener("pointerdown", function () { running = false; });
  document.documentElement.style.scrollBehavior = "auto";
})();

/* The word "Different.": ignites on load, stutters now and then, and glitches through typefaces on hover.
   The word keeps an invisible copy of itself in its normal typeface, which is what the line is laid out around.
   The visible copy floats on top of it, so changing its typeface can never move "A little" or anything else. */
(function () {
  var word = document.querySelector("[data-glitch]");
  if (!word || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var FACES = ["Break Gothic", "Blackville", "Gloomy Horror", "Gothic Horror", "Infolk", "Aresink"];   // add or remove faces here
  var css = getComputedStyle(document.documentElement);
  var BASE = { family: css.getPropertyValue("--gothic"), style: "italic", weight: "400", scale: 1, color: "", spacing: "" };
  var PLAIN = { family: css.getPropertyValue("--sans"), style: "normal", weight: "500", scale: 1 / 1.06, color: "var(--text)", spacing: "-0.04em" };
  var text = word.textContent, faces = [], current = BASE, cache = {};
  var rnd = function (a, b) { return a + Math.random() * (b - a); };

  /* build: invisible copy (holds the layout) + baseline marker + visible copy (floats) */
  word.textContent = "";
  word.style.display = "inline-block"; word.style.position = "relative"; word.style.whiteSpace = "nowrap";
  var ghost = document.createElement("span"); ghost.textContent = text; ghost.style.visibility = "hidden"; ghost.setAttribute("aria-hidden", "true");
  var mark = document.createElement("span"); mark.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
  var live = document.createElement("span"); live.className = "glitch-live"; live.textContent = text; live.setAttribute("data-text", text);
  live.style.cssText = "position:absolute;left:0;top:0;line-height:1;white-space:nowrap";
  word.appendChild(ghost); word.appendChild(mark); word.appendChild(live);

  /* how far below the top of its own box a typeface's baseline sits, as a share of the type size */
  function baseline(f) {
    var key = f.family + f.style + f.weight; if (cache[key] != null) return cache[key];
    var box = document.createElement("div"), m = document.createElement("span");
    box.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;line-height:1;font-size:200px";
    box.style.fontFamily = f.family; box.style.fontStyle = f.style; box.style.fontWeight = f.weight;
    box.textContent = text; m.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline"; box.appendChild(m);
    document.body.appendChild(box); var r = (m.getBoundingClientRect().top - box.getBoundingClientRect().top) / 200; box.remove();
    return (cache[key] = r);
  }
  function show(f) {                       // put a typeface on the visible copy, sitting on the same baseline as always
    current = f;
    live.style.fontFamily = f.family; live.style.fontStyle = f.style; live.style.fontWeight = f.weight;
    live.style.fontSize = f.scale + "em"; live.style.color = f.color; live.style.letterSpacing = f.spacing;
    var px = parseFloat(getComputedStyle(live).fontSize);
    live.style.top = ((mark.getBoundingClientRect().top - word.getBoundingClientRect().top) - baseline(f) * px) + "px";
  }
  show(BASE);
  addEventListener("resize", function () { show(current); });
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(function () { cache = {}; show(current); });
    if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", function () { cache = {}; show(current); });
  }
  /* once the headline has risen into place, let tall typefaces poke outside its line */
  setTimeout(function () { document.querySelectorAll(".title .line").forEach(function (l) { l.style.overflow = "visible"; }); }, 1600);

  /* ---------- ignite on load, then an occasional stutter ---------- */
  var busy = false, over = false;
  function run(steps, done) {              // steps: [gothic?, ms]
    var k = 0; busy = true;
    (function next() {
      if (over) { busy = false; return; }
      if (k >= steps.length) { show(BASE); busy = false; if (done) done(); return; }
      show(steps[k][0] ? BASE : PLAIN); setTimeout(next, steps[k][1]); k++;
    })();
  }
  if (document.documentElement.classList.contains("motion")) {
    show(PLAIN);
    setTimeout(function () { run([[1, 70], [0, 110], [1, 50], [0, 160], [1, 60], [0, 60]]); }, 1150);
  }
  (function idle() {
    setTimeout(function () { if (!document.hidden && !over && !busy) run([[0, 60], [1, 80], [0, 45]]); idle(); }, 7000 + Math.random() * 7000);
  })();

  /* ---------- hover glitch (mouse only) ---------- */
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  var ready = false, timer, hold = 0;
  function prepare() {
    if (!document.fonts || !document.fonts.load) return;
    Promise.all(FACES.map(function (f) { return document.fonts.load('48px "' + f + '"', text).catch(function () {}); })).then(function () {
      var probe = document.createElement("span"); probe.textContent = text;
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font-size:100px;left:-9999px;top:0";
      document.body.appendChild(probe);
      probe.style.fontFamily = BASE.family; probe.style.fontStyle = "italic";
      var base = probe.getBoundingClientRect().width; probe.style.fontStyle = "normal";
      FACES.forEach(function (f) {
        if (!document.fonts.check('48px "' + f + '"', text)) return;
        probe.style.fontFamily = '"' + f + '"';
        faces.push({ family: '"' + f + '"', style: "normal", weight: "400", scale: Math.max(0.72, Math.min(1.3, base / probe.getBoundingClientRect().width)), color: "", spacing: "" });
      });
      probe.remove(); ready = faces.length > 0;
    });
  }
  if (document.readyState === "complete") prepare(); else addEventListener("load", prepare);

  function tear(on) {
    live.classList.toggle("glitching", on);
    if (!on) return;
    var a = rnd(4, 60), b = rnd(50, 86), set = function (k, v) { live.style.setProperty(k, v); };
    set("--gx", rnd(2, 6).toFixed(1) + "px"); set("--jx", rnd(-3, 3).toFixed(1) + "px"); set("--jy", rnd(-2, 2).toFixed(1) + "px");
    set("--sk", rnd(-7, 7).toFixed(1) + "deg"); set("--sx", rnd(-14, 14).toFixed(1) + "px");
    set("--c1", a.toFixed(0) + "%"); set("--c2", (100 - a - rnd(8, 22)).toFixed(0) + "%");
    set("--c3", b.toFixed(0) + "%"); set("--c4", Math.max(0, 100 - b - rnd(6, 14)).toFixed(0) + "%");
  }
  function burst(n, settle, then) {        // n quick frames of random faces with the tear on, then settle
    clearTimeout(timer);
    (function frame() {
      if (n-- <= 0) { tear(false); show(settle); if (then) then(); return; }
      show(Math.random() < 0.18 ? BASE : faces[Math.floor(Math.random() * faces.length)]); tear(true);
      timer = setTimeout(frame, rnd(45, 110));
    })();
  }
  function linger() {
    timer = setTimeout(function () { if (!over) return; hold = (hold + 1) % faces.length; burst(3, faces[hold], linger); }, rnd(1100, 2400));
  }

  /* the disc that follows the cursor */
  var orb = document.createElement("div"); orb.className = "orb"; orb.setAttribute("aria-hidden", "true"); document.body.appendChild(orb);
  var ox = -200, oy = -200, tx = -200, ty = -200, os = 0, ts = 0, moving = false;
  function follow() {
    ox += (tx - ox) * 0.2; oy += (ty - oy) * 0.2; os += (ts - os) * 0.16;
    orb.style.transform = "translate(" + ox.toFixed(1) + "px," + oy.toFixed(1) + "px) scale(" + os.toFixed(3) + ")";
    if (ts > 0 || os > 0.01) requestAnimationFrame(follow); else { moving = false; orb.style.transform = "translate(-200px,-200px) scale(0)"; }
  }
  function orbOn(e, label) {
    orb.textContent = label || ""; orb.classList.toggle("big", !!label);
    if (os < 0.05) { ox = e.clientX; oy = e.clientY; }
    tx = e.clientX; ty = e.clientY; ts = 1; if (!moving) { moving = true; requestAnimationFrame(follow); }
  }
  /* the same ring on the project cards, with a label */
  document.querySelectorAll(".card").forEach(function (card) {
    card.addEventListener("pointerenter", function (e) { card.style.cursor = "none"; orbOn(e, card.tagName === "A" ? "View" : ""); });
    card.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; });
    card.addEventListener("pointerleave", function () { ts = 0; card.style.cursor = ""; });
  });
  word.addEventListener("pointerenter", function (e) {
    over = true; word.style.cursor = "none"; orbOn(e, "");
    if (ready) { hold = (hold + 1) % faces.length; burst(8, faces[hold], linger); } else show(BASE);
  });
  word.addEventListener("pointermove", function (e) { tx = e.clientX; ty = e.clientY; });
  word.addEventListener("pointerleave", function () {
    ts = 0; word.style.cursor = "";
    if (ready) burst(4, BASE, function () { over = false; }); else { over = false; show(BASE); }
  });
})();

/* Wireframe lens: a large circle follows the cursor and shows the final design through it.
   On touch screens a tap flips the whole wireframe to the final design and back. */
(function () {
  document.querySelectorAll("[data-lens]").forEach(function (box) {
    var top = box.querySelector(".lens-top"), ring = box.querySelector(".lens-ring");
    var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var x = 0, y = 0, tx = 0, ty = 0, r = 0, tr = 0, running = false, open = false;
    function size() { return Math.max(120, Math.min(240, box.clientWidth * 0.2)); }   // lens radius in px
    function draw() {
      var k = still ? 1 : 0.22;
      x += (tx - x) * k; y += (ty - y) * k; r += (tr - r) * (still ? 1 : 0.16);
      top.style.clipPath = "circle(" + r.toFixed(1) + "px at " + x.toFixed(1) + "px " + y.toFixed(1) + "px)";
      ring.style.width = ring.style.height = (2 * r).toFixed(1) + "px";
      ring.style.transform = "translate(" + (x - r).toFixed(1) + "px," + (y - r).toFixed(1) + "px)";
      ring.style.opacity = (fine && r > 2) ? 1 : 0;
      if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(tr - r) > 0.3) requestAnimationFrame(draw); else running = false;
    }
    function go() { if (!running) { running = true; requestAnimationFrame(draw); } }
    function at(e) { var b = box.getBoundingClientRect(); tx = e.clientX - b.left; ty = e.clientY - b.top; }
    var last = null;   // keep the lens under the cursor while the page scrolls beneath it
    if (fine) {
      box.addEventListener("pointerenter", function (e) { last = e; at(e); if (r < 1) { x = tx; y = ty; } tr = size(); go(); });
      box.addEventListener("pointermove", function (e) { last = e; at(e); go(); });
      addEventListener("scroll", function () { if (last && tr > 0) { at(last); go(); } }, { passive: true });
      box.addEventListener("pointerleave", function () { tr = 0; go(); });
    } else {
      box.addEventListener("click", function (e) {
        at(e); x = tx; y = ty; open = !open;
        tr = open ? Math.hypot(box.clientWidth, box.clientHeight) : 0; go();
      });
    }
  });
})();

/* EDM pop-out: hovering an email shows the whole design large; moving the cursor down the
   email scrolls through it. On touch screens a tap opens it (scrollable) and a tap closes it. */
(function () {
  var mails = document.querySelectorAll(".email[data-edm]");
  if (!mails.length) return;
  var fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  var pop = document.createElement("div"); pop.className = "edm-pop"; pop.setAttribute("aria-hidden", "true");
  pop.innerHTML = '<div class="edm-frame"><img alt=""></div>';
  document.body.appendChild(pop);
  var frame = pop.firstChild, img = frame.firstChild, cur = null, ty = 0, target = 0, raf = 0;
  function open(m) {
    cur = m; img.src = m.dataset.edm; img.alt = (m.querySelector(".email-body img") || {}).alt || "";
    var w = +m.dataset.w, h = +m.dataset.h;
    img.width = w; img.height = h; ty = target = 0; img.style.transform = "";
    frame.scrollTop = 0; pop.classList.add("on");
  }
  function close() { cur = null; pop.classList.remove("on"); }
  function tick() {
    ty += (target - ty) * 0.18; img.style.transform = "translateY(" + (-ty).toFixed(1) + "px)";
    raf = Math.abs(target - ty) > 0.5 ? requestAnimationFrame(tick) : 0;
  }
  function follow(e, m) {
    var b = m.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
    var extra = Math.max(0, img.getBoundingClientRect().height - frame.clientHeight);
    target = extra * f; if (!raf) raf = requestAnimationFrame(tick);
  }
  mails.forEach(function (m) {
    if (fine) {
      m.addEventListener("pointerenter", function (e) { open(m); follow(e, m); });
      m.addEventListener("pointermove", function (e) { if (cur === m) follow(e, m); });
      m.addEventListener("pointerleave", close);
      m.addEventListener("focus", function () { open(m); });
      m.addEventListener("blur", close);
    } else {
      m.addEventListener("click", function () { pop.classList.add("touch"); open(m); });
    }
  });
  pop.addEventListener("click", function () { if (!fine) close(); });
  addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  addEventListener("scroll", function () { if (fine && cur) close(); }, { passive: true });
})();
