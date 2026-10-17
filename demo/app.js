// The website demo window. The document area is the Mac app's own preview code (engine/), loaded
// unchanged. This file plays the part of the app around it: the toolbar, the editor, the history
// that the command-line tool would keep, two agents editing the file, and a guided tour.
(function () {
  "use strict";

  var D = window.MDDemoData;
  var params = new URLSearchParams(location.search);
  var scenario = ["review", "kinetic"].indexOf(params.get("scenario")) >= 0 ? params.get("scenario") : "tour";
  var $ = function (id) { return document.getElementById(id); };
  var demoEl = $("demo"), frame = $("preview"), source = $("source"), content = $("content");
  var cursor = $("cursor"), caption = $("caption"), progress = $("progress");
  var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var pv = null;      // the preview's window
  var pdoc = null;    // the preview's document
  var resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });

  var meta = {};
  D.history.forEach(function (h) { meta[h.revision] = h; });

  var state = {
    mode: "read", text: D.texts.r1, rev: "r1",
    base: null,          // the text you last read, while there are unread changes
    revisions: [],       // agents' checkpoints since then (oldest first)
    compare: null,       // { base, title } while comparing with an earlier version
    unread: 0, edited: false
  };

  // -----------------------------------------------------------------------------------------------
  // The app around the preview

  function readZoom() {
    var w = frame.clientWidth || 900;
    return Math.max(0.5, Math.min(0.9, (w - 168 - 48) / 816));
  }

  function render() {
    if (!pv || state.mode === "edit") return;
    pv.mdRender(state.text);
  }

  var renderTimer = 0;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 200);
  }

  function reviewObject() {
    if (state.compare) return { mode: "compare", baseText: state.compare.base, title: state.compare.title };
    if (state.base !== null) return { mode: "unread", baseText: state.base, revisions: state.revisions };
    return null;
  }

  function pushReview() {
    if (!pv) return;
    pv.mdSetReview(reviewObject());
    updateToolbar();
  }

  function updateToolbar() {
    var n = state.base !== null && !state.compare ? state.unread : 0;
    var b = $("changes");
    b.disabled = n === 0;
    $("changes-label").textContent = n ? n + (n === 1 ? " change" : " changes") : "Up to date";
    b.setAttribute("aria-label", n ? n + " unread changes. Go to the next change." : "No unread changes");
    $("subtitle").textContent = "History " + state.rev + (state.edited ? " · Edited" : "");
  }

  function setText(text, edited) {
    state.text = text;
    source.value = text;
    state.edited = edited;
    render();
    updateToolbar();
  }

  function setMode(mode) {
    state.mode = mode;
    content.dataset.mode = mode;
    document.querySelectorAll(".modes button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    });
    if (mode === "edit" || !pv) return;
    // Let the layout settle, then fit the pages to the space the preview now has.
    requestAnimationFrame(function () {
      pv.mdSetLayout(mode === "split" ? { zoomMode: "fitWidth" } : { zoomMode: "manual", zoom: readZoom() });
      render();
    });
  }

  function showHistory() {
    if (!pv) return;
    var order = ["r1", "r2", "r3"];
    var upto = order.indexOf(state.rev);
    var list = D.history.filter(function (h) { return order.indexOf(h.revision) <= upto; });
    pv.mdShowHistory(list, state.base !== null ? "r1" : state.rev);
  }

  /** Same as the app: put a removed passage back as an unsaved edit, before the line it came from. */
  function restoreBlock(block, beforeLine, kind) {
    var t = state.text;
    var tight = kind === "list-item" || kind === "table-row";
    var at = t.length;
    if (beforeLine > 0) {
      var line = 1, i = 0;
      while (line < beforeLine && i < t.length) {
        var nl = t.indexOf("\n", i);
        i = nl < 0 ? t.length : nl + 1;
        line++;
      }
      at = Math.min(i, t.length);
    }
    var insert;
    if (at >= t.length) {
      var needsNewline = t.length > 0 && t.slice(-1) !== "\n";
      insert = (needsNewline ? "\n" : "") + (tight || !t.length ? "" : "\n") + block + "\n";
    } else {
      insert = block + (tight ? "\n" : "\n\n");
    }
    setText(t.slice(0, at) + insert + t.slice(at), true);
  }

  /** An agent writes a new version of the file and checks it in, as the CLI would record it. */
  function applyRevision(rev) {
    if (state.base === null) state.base = state.text;
    state.rev = rev;
    state.revisions = state.revisions.concat([meta[rev]]);
    state.text = D.texts[rev];
    source.value = state.text;
    state.edited = false;
    state.compare = null;
    if (pv) { pv.mdRender(state.text); pv.mdSetReview(reviewObject()); }
    updateToolbar();
  }

  // Messages from the preview, as the app's message handlers receive them.
  window.mdDemo = {
    message: function (m) {
      if (!m || !m.action) return;
      switch (m.action) {
        case "count":
          if (m.mode === "unread") { state.unread = m.n; updateToolbar(); }
          break;
        case "markRead":
          state.base = null; state.revisions = []; state.unread = 0; state.compare = null;
          pushReview();
          break;
        case "history": showHistory(); break;
        case "compare": {
          var h = meta[m.revision];
          if (!h) return;
          state.compare = { base: D.texts[m.revision], title: m.revision + " (" + h.author + ")" };
          if (state.mode === "edit") setMode("read");
          pushReview();
          break;
        }
        case "endCompare": state.compare = null; pushReview(); break;
        case "restoreBlock": restoreBlock(m.text, m.beforeLine || 0, m.kind || "paragraph"); break;
        case "restoreVersion":
          if (D.texts[m.revision]) { setText(D.texts[m.revision], true); pv.mdHideHistory(); }
          break;
        default: break; // layout, annotations, find: kept in the page while it's open
      }
    },
    link: function (href) {
      if (/^https?:/i.test(href)) window.open(href, "_blank", "noopener");
    }
  };

  document.querySelectorAll(".modes button").forEach(function (b) {
    b.addEventListener("click", function () { setMode(b.dataset.mode); });
  });
  $("changes").addEventListener("click", function () { if (pv) pv.mdNav(1); });
  $("history-button").addEventListener("click", showHistory);
  source.addEventListener("input", function () {
    state.text = source.value;
    state.edited = true;
    updateToolbar();
    scheduleRender();
  });

  frame.addEventListener("load", function () {
    pv = frame.contentWindow;
    pdoc = frame.contentDocument;
    pv.mdSetFontSize(16);
    pv.mdSetLayout({ paged: true, size: "letter", sidebar: true, spread: false, tab: "pages", zoomMode: "manual", zoom: readZoom() });
    watchForPeople(pdoc);
    resolveReady();
  });

  // -----------------------------------------------------------------------------------------------
  // Starting points for each part of the tour

  function clearSelection() {
    try { pv.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
  }

  async function base(kind) {
    await ready;
    clearSelection();
    hideAgent();
    if (pv.mdFindClose) pv.mdFindClose();
    pv.mdHideHistory();
    state.text = D.texts.r1; state.rev = "r1"; state.base = null; state.revisions = [];
    state.compare = null; state.unread = 0; state.edited = false;
    source.value = state.text;
    state.mode = "read";
    content.dataset.mode = "read";
    document.querySelectorAll(".modes button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === "read")); });
    pv.mdSetReview(null);
    pv.mdSetAnnotations(null);
    pv.mdSetLayout({ spread: false, zoomMode: "manual", zoom: readZoom() });
    pv.mdShowSidebarTab("pages");
    pv.mdRender(state.text);
    pv.scrollTo(0, 0);
    updateToolbar();
    if (kind === "annotated" || kind === "agent") {
      annotate("No report should take more than a minute to export.", "highlight", "yellow");
      annotate("Should exports include archived rows?", "highlight", "green");
      var n = annotate("The delivery timeline depends on the vendor's storage API.", "note");
      if (n) {
        setNoteText(n.id, "Confirm the sandbox date with the vendor before Friday.");
        var marker = pdoc.querySelector('#doc .anno-marker[data-anno="' + n.id + '"]');
        if (marker) marker.click(); // collapse it to its marker
      }
      clearSelection();
      pv.scrollTo(0, 0);
    }
    if (kind === "agent") {
      applyRevision("r2");
      applyRevision("r3");
      pv.scrollTo(0, 0);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Finding things in the preview

  /** A Range over the nth occurrence of `text` in the document's visible text. */
  function findRange(text, nth) {
    var docEl = pdoc.getElementById("doc");
    var walker = pdoc.createTreeWalker(docEl, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return n.parentElement.closest(".no-find, .anno-card, .page-num, .anno-marker") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], all = "", n;
    while ((n = walker.nextNode())) { nodes.push([n, all.length]); all += n.data; }
    var idx = -1, from = 0;
    for (var k = 0; k <= (nth || 0); k++) { idx = all.indexOf(text, from); if (idx < 0) return null; from = idx + 1; }
    function pos(o, end) {
      for (var i = nodes.length - 1; i >= 0; i--) if (end ? nodes[i][1] < o : nodes[i][1] <= o) return [nodes[i][0], o - nodes[i][1]];
      return [nodes[0][0], 0];
    }
    var r = pdoc.createRange();
    var s = pos(idx, false), e = pos(idx + text.length, true);
    r.setStart(s[0], s[1]);
    r.setEnd(e[0], e[1]);
    return r;
  }

  function select(range) {
    var sel = pv.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function annotate(text, kind, color) {
    var r = findRange(text);
    if (!r) return null;
    select(r);
    return pv.mdAnnotateSelection(kind, color);
  }

  function setNoteText(id, text) {
    var t = pdoc.querySelector('#doc .anno-card[data-anno="' + id + '"] textarea');
    if (!t) return;
    t.value = text;
    t.dispatchEvent(new pv.Event("input", { bubbles: true }));
  }

  // -----------------------------------------------------------------------------------------------
  // The tour's pointer, keys and typing

  var STOP = { stopped: true };
  var run = 0;
  var playing = false;

  function sleep(ms) {
    var token = run;
    return new Promise(function (resolve, reject) {
      setTimeout(function () { token === run ? resolve() : reject(STOP); }, reduceMotion ? Math.min(ms, 400) : ms);
    });
  }

  /** Where a point inside the preview (or the demo itself) is, relative to the demo. */
  function toDemo(rect, inPreview) {
    var d = demoEl.getBoundingClientRect();
    var ox = -d.left, oy = -d.top;
    if (inPreview) { var f = frame.getBoundingClientRect(); ox += f.left; oy += f.top; }
    return { x: rect.left + ox, y: rect.top + oy, w: rect.width, h: rect.height };
  }

  async function pointAt(x, y) {
    cursor.classList.add("on", "moving");
    cursor.style.left = (x - 4) + "px";
    cursor.style.top = (y - 2) + "px";
    await sleep(620);
  }

  async function pointTo(el, inPreview, where) {
    var r = toDemo(el.getBoundingClientRect(), inPreview);
    var x = where === "start" ? r.x + 4 : r.x + r.w / 2;
    var y = r.y + r.h / 2;
    await pointAt(x, y);
  }

  async function click(el, inPreview) {
    if (!el) return;
    await pointTo(el, inPreview);
    cursor.classList.remove("click");
    void cursor.offsetWidth;
    cursor.classList.add("click");
    el.click();
    await sleep(320);
  }

  async function key(label, fire) {
    var k = $("keycap");
    k.textContent = label;
    k.hidden = false;
    if (fire) fire();
    await sleep(750);
    k.hidden = true;
  }

  function pressInPreview(keyName, target) {
    (target || pdoc).dispatchEvent(new pv.KeyboardEvent("keydown", { key: keyName, bubbles: true }));
  }

  async function typeInto(el, text, win, ms) {
    for (var i = 0; i < text.length; i++) {
      el.value += text.charAt(i);
      el.dispatchEvent(new (win || window).Event("input", { bubbles: true }));
      await sleep(ms || 45);
    }
  }

  /** Drags across a passage the way a person selects it, then lets go. */
  async function dragSelect(text) {
    var r = findRange(text);
    if (!r) return false;
    var start = r.startContainer.parentElement;
    start.scrollIntoView({ block: "center" });
    await sleep(250);
    var first = r.getClientRects()[0];
    var p = toDemo(first, true);
    await pointAt(p.x + 2, p.y + p.h / 2);
    var words = text.split(" ");
    var sofar = "";
    for (var i = 0; i < words.length; i++) {
      sofar += (i ? " " : "") + words[i];
      var part = findRange(sofar);
      select(part);
      var rects = part.getClientRects();
      var last = rects[rects.length - 1];
      var q = toDemo(last, true);
      cursor.classList.remove("moving");
      cursor.style.left = (q.x + q.w - 4) + "px";
      cursor.style.top = (q.y + q.h / 2 - 2) + "px";
      await sleep(70);
    }
    cursor.classList.add("moving");
    r.endContainer.parentElement.dispatchEvent(new pv.MouseEvent("mouseup", { bubbles: true, button: 0 }));
    await sleep(380);
    return true;
  }

  function q(sel) { return pdoc.querySelector(sel); }

  function say(title, text) {
    caption.innerHTML = "";
    var b = document.createElement("b");
    b.textContent = title;
    caption.appendChild(b);
    caption.appendChild(document.createTextNode(" " + text));
  }

  // -----------------------------------------------------------------------------------------------
  // The agent's terminal

  function showAgent(name) {
    $("agent-name").textContent = name;
    $("agent-log").textContent = "";
    $("agent").hidden = false;
  }

  function hideAgent() { $("agent").hidden = true; }

  async function agentLine(text, cls, typed) {
    var log = $("agent-log");
    var span = document.createElement("span");
    if (cls) span.className = cls;
    log.appendChild(span);
    if (typed) {
      for (var i = 0; i < text.length; i += 2) { span.textContent = text.slice(0, i + 2); await sleep(14); }
    } else span.textContent = text;
    log.appendChild(document.createTextNode("\n"));
    await sleep(typed ? 250 : 120);
  }

  // -----------------------------------------------------------------------------------------------
  // The tour

  var steps = [
    {
      name: "Pages", base: "start", run: async function () {
        say("Pages, like Preview.", "Files open as pages with numbered thumbnails. Click one to jump; the selection follows as you scroll.");
        await sleep(900);
        await click(q('#thumb-list button[aria-label="Page 2"]'), true);
        await sleep(900);
        await click(q('#thumb-list button[aria-label="Page 3"]'), true);
        await sleep(900);
        pv.scrollBy({ top: -420, behavior: "smooth" });
        await sleep(1300);
        await click(q("#page-bar .pb-button[aria-label='Next page']"), true);
        await sleep(900);
      }
    },
    {
      name: "Two pages", base: "start", run: async function () {
        say("Two pages side by side.", "Read like an open book. ← and → turn a pair at a time, and the whole spread fits the window.");
        pv.mdSetLayout({ zoomMode: "fitPage" });
        await sleep(700);
        await click(q("#page-bar .pb-spread"), true);
        await sleep(1000);
        await key("→", function () { pressInPreview("ArrowRight"); });
        await sleep(700);
        await key("→", function () { pressInPreview("ArrowRight"); });
        await sleep(700);
        await key("←", function () { pressInPreview("ArrowLeft"); });
        await sleep(900);
      }
    },
    {
      name: "Find", base: "start", run: async function () {
        say("Find in the formatted text.", "⌘F searches what you read, across bold, links and code, and across page breaks.");
        await key("⌘F", function () { pv.mdFindOpen(); });
        var input = q("#find-input");
        await typeInto(input, "export", pv, 90);
        await sleep(800);
        await click(q('#find-bar button[aria-label="Next match"]'), true);
        await sleep(700);
        await click(q('#find-bar button[aria-label="Next match"]'), true);
        await sleep(700);
        await click(q('#find-bar button[aria-label="Next match"]'), true);
        await sleep(1000);
      }
    },
    {
      name: "Highlights & notes", base: "start", run: async function () {
        say("Highlight and take notes.", "Select text and pick a color, or add a note. Notes sit in the margin beside their passage and never touch the file.");
        await dragSelect("No report should take more than a minute to export.");
        await click(q(".anno-pop .anno-s-yellow"), true);
        await sleep(600);
        await dragSelect("Should exports include archived rows?");
        await click(q(".anno-pop .anno-s-green"), true);
        await sleep(600);
        await dragSelect("The delivery timeline depends on the vendor's storage API.");
        await click(Array.prototype.filter.call(pdoc.querySelectorAll(".anno-pop .anno-pop-btn"), function (b) { return b.textContent === "Add Note"; })[0], true);
        await sleep(300);
        var t = q("#doc .anno-card:not([hidden]) textarea");
        if (t) { t.value = ""; await typeInto(t, "Confirm the sandbox date with the vendor before Friday.", pv, 38); }
        await sleep(900);
        await click(q("#side-tab-notes"), true);
        await sleep(1500);
      }
    },
    {
      name: "Agent edits", base: "annotated", run: async function () {
        say("Then agents edit the file.", "Two coding agents change the plan and check in their edits. The open document refreshes on its own.");
        await sleep(600);
        showAgent("planner");
        await agentLine("$ mdeditdiff changes export-plan.md --reader planner", "cmd", true);
        await agentLine("  Up to date with r1. Editing the plan…", "dim");
        await sleep(500);
        applyRevision("r2");
        await agentLine("$ mdeditdiff checkpoint export-plan.md --author planner \\\n    --note \"Added streaming and a row limit\"", "cmd", true);
        await agentLine("  ✓ Recorded r2", "ok");
        await sleep(900);
        showAgent("reviewer");
        await agentLine("$ mdeditdiff checkpoint export-plan.md --author reviewer \\\n    --note \"Widened the beta to 25 customers\"", "cmd", true);
        applyRevision("r3");
        await agentLine("  ✓ Recorded r3", "ok");
        await sleep(1100);
        hideAgent();
        say("You see exactly what changed.", "The toolbar counts changes since you last read, and the bar names who made them. Your note followed its passage; the highlighted question was removed, so it waits under Needs Reattachment.");
        await pointTo($("changes"), false);
        await sleep(1200);
        await click(q("#side-tab-notes"), true);
        await sleep(1800);
      }
    },
    {
      name: "Review & restore", base: "agent", run: async function () {
        say("Review, restore, mark as read.", "Step through each change. Bring back a removed passage as an unsaved edit. Then mark the file as read.");
        await click($("changes"), false);
        await sleep(1100);
        await click($("changes"), false);
        await sleep(1100);
        var restore = q("#doc .md-restore");
        if (restore) {
          restore.scrollIntoView({ block: "center" });
          await sleep(500);
          await click(restore, true);
          await sleep(1300);
        }
        pv.scrollTo({ top: 0, behavior: "smooth" });
        await sleep(700);
        await click(q("#review-bar .rb-button.primary"), true);
        await sleep(1300);
      }
    },
    {
      name: "History", base: "agent", run: async function () {
        say("Every version, with who and why.", "History lists each version with the agent's note. Compare any version with the current text, or restore it.");
        await click($("history-button"), false);
        await sleep(1000);
        var items = pdoc.querySelectorAll("#history .hp-item");
        var r2 = Array.prototype.filter.call(items, function (li) { return li.querySelector(".hp-rev").textContent === "r2"; })[0];
        var compare = r2 && r2.querySelector(".hp-actions .rb-button");
        await click(compare, true);
        await sleep(1800);
        pv.mdHideHistory();
        await click(q('#review-bar button[aria-label="Stop comparing"]'), true);
        await sleep(900);
      }
    },
    {
      name: "Edit & Split", base: "start", run: async function () {
        say("Edit the Markdown, see it live.", "Split shows the source next to the pages. Saves change only what you changed.");
        await click(document.querySelector('.modes button[data-mode="split"]'), false);
        await sleep(900);
        var at = source.value.indexOf(D.typedAfter);
        if (at >= 0) {
          var pos = at + D.typedAfter.length;
          var lineNo = source.value.slice(0, pos).split("\n").length;
          source.scrollTop = Math.max(0, lineNo * 20.6 - 200);
          await pointTo(source, false);
          for (var i = 0; i < D.typed.length; i++) {
            source.value = source.value.slice(0, pos + i) + D.typed.charAt(i) + source.value.slice(pos + i);
            source.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(55);
          }
          await sleep(500);
          var added = findRange("Add a help article and a short video.");
          if (added) added.startContainer.parentElement.scrollIntoView({ block: "center" });
        }
        await sleep(1500);
        await click(document.querySelector('.modes button[data-mode="edit"]'), false);
        await sleep(1100);
        await click(document.querySelector('.modes button[data-mode="read"]'), false);
        await sleep(900);
      }
    }
  ];

  // -----------------------------------------------------------------------------------------------
  // The kinetic hero: no chips or captions; the view zooms to what each headline word is about

  var winEl = $("window");
  var camScale = 1;

  /** Position of an element relative to the window, ignoring the zoom (offsets aren't transformed,
      and a rectangle inside the preview frame is relative to the frame). */
  function offsetIn(el) {
    if (el.ownerDocument !== document) {
      var r = el.getBoundingClientRect();
      var o = offsetIn(frame);
      return { x: o.x + r.left, y: o.y + r.top, w: r.width, h: r.height };
    }
    var x = 0, y = 0, w = el.offsetWidth, h = el.offsetHeight;
    while (el && el !== winEl) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x: x, y: y, w: w, h: h };
  }

  /** Zooms the window so `el` is centered at `scale`; with no element, shows the whole window. */
  function camera(el, scale) {
    if (!el || reduceMotion) { camScale = 1; winEl.style.transform = ""; return; }
    var W = winEl.offsetWidth, H = winEl.offsetHeight;
    var b = offsetIn(el);
    var s = scale || 1.5;
    var tx = W / 2 - (b.x + b.w / 2) * s, ty = H / 2 - (b.y + b.h / 2) * s;
    tx = Math.min(0, Math.max(W - W * s, tx));
    ty = Math.min(0, Math.max(H - H * s, ty));
    camScale = s;
    winEl.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";
  }

  /** Scrolls the preview (and only the preview, never the page around the demo) to an element. */
  function scrollPreviewTo(el) {
    var r = el.getBoundingClientRect();
    pv.scrollTo(0, Math.max(0, pv.scrollY + r.top + r.height / 2 - pv.innerHeight / 2));
  }

  function hero(i) {
    try { if (window.parent !== window && window.parent.mdHeroWord) window.parent.mdHeroWord(i); } catch (e) { /* ignore */ }
  }

  var kineticSteps = [
    {
      name: "Read it.", base: "start", run: async function () {
        hero(0);
        camera(null);
        pv.mdSetLayout({ zoomMode: "fitWidth" });
        await sleep(1400);
        q('#thumb-list button[aria-label="Page 2"]').click();
        await sleep(1300);
        q('#thumb-list button[aria-label="Page 3"]').click();
        await sleep(1100);
        q('#thumb-list button[aria-label="Page 1"]').click();
        await sleep(700);
      }
    },
    {
      name: "Mark it.", base: "start", run: async function () {
        hero(1);
        camera(null);
        var r = findRange("No report should take more than a minute to export.");
        scrollPreviewTo(r.startContainer.parentElement);
        await sleep(150);
        camera(r.startContainer.parentElement.closest("ul") || r.startContainer.parentElement, 1.7);
        await sleep(900);
        annotate("No report should take more than a minute to export.", "highlight", "yellow");
        clearSelection();
        await sleep(900);
        var n = annotate("The delivery timeline depends on the vendor's storage API.", "note");
        clearSelection();
        var card = n && pdoc.querySelector('#doc .anno-card[data-anno="' + n.id + '"]');
        if (card) {
          camera(card, 1.55);
          var t = card.querySelector("textarea");
          t.value = "";
          await sleep(500);
          await typeInto(t, "Confirm the sandbox date with the vendor.", pv, 28);
        }
        await sleep(900);
      }
    },
    {
      name: "Track it.", base: "annotated", run: async function () {
        hero(2);
        camera(null);
        await sleep(500);
        applyRevision("r2");
        await sleep(600);
        applyRevision("r3");
        await sleep(300);
        camera(q("#review-bar"), 1.45);
        await sleep(1700);
        var first = q("#doc .md-ins") || q("#doc .md-change");
        if (first) { scrollPreviewTo(first); await sleep(100); camera(first.closest("li, p") || first, 1.6); }
        await sleep(1700);
      }
    },
    {
      name: "Restore it.", base: "agent", run: async function () {
        hero(3);
        camera(null);
        var restore = q("#doc .md-restore");
        if (!restore) return;
        var block = restore.closest(".md-removed") || restore;
        scrollPreviewTo(block);
        await sleep(300);
        camera(block, 1.7);
        await sleep(1400);
        restore.click();
        await sleep(300);
        var back = findRange("Should exports include archived rows?");
        if (back) camera(back.startContainer.parentElement.closest("ul") || back.startContainer.parentElement, 1.7);
        await sleep(1800);
      }
    }
  ];

  if (scenario === "kinetic") {
    demoEl.classList.add("kinetic");
    var cam = document.createElement("div");
    cam.className = "cam";
    winEl.parentNode.insertBefore(cam, winEl);
    cam.appendChild(winEl);
    steps = kineticSteps;
  }

  window.mdDemoSetMode = function (m) { stopTour(true); setMode(m); };

  // Chips
  var chips = $("chips");
  steps.forEach(function (s, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = s.name;
    b.addEventListener("click", function () { playFrom(i); });
    chips.appendChild(b);
  });

  var current = 0;
  function markChip(i) {
    chips.querySelectorAll(".chip").forEach(function (c, k) {
      if (k === i) c.setAttribute("aria-current", "step"); else c.removeAttribute("aria-current");
    });
    progress.textContent = (i + 1) + " / " + steps.length;
  }

  function setPlayButton() {
    var p = $("play");
    p.textContent = playing ? "Ⅱ Pause tour" : "▶ Play tour";
    p.setAttribute("aria-pressed", String(playing));
  }

  function heroPaused(paused) {
    try { if (window.parent !== window && window.parent.mdHeroPaused) window.parent.mdHeroPaused(paused); } catch (e) { /* ignore */ }
  }

  async function playFrom(i) {
    var token = ++run;
    playing = true;
    setPlayButton();
    if (scenario === "kinetic") heroPaused(false);
    try {
      for (var k = i; ; k = (k + 1) % steps.length) {
        current = k;
        markChip(k);
        await base(steps[k].base);
        if (token !== run) return;
        await steps[k].run();
        await sleep(1400);
      }
    } catch (e) {
      if (e !== STOP) { console.error(e); stopTour(); }
    }
  }

  function stopTour(quiet) {
    run++;
    playing = false;
    setPlayButton();
    cursor.classList.remove("on");
    $("keycap").hidden = true;
    if (scenario === "kinetic") { camera(null); if (!quiet) heroPaused(true); }
    if (!quiet && scenario === "tour") yourTurn();
  }

  function yourTurn() {
    caption.innerHTML = "";
    var b = document.createElement("b");
    b.textContent = "Your turn.";
    caption.appendChild(b);
    caption.appendChild(document.createTextNode(" This is the app's real preview: select text to highlight, use the page bar, switch to Edit and type. "));
    var r = document.createElement("button");
    r.type = "button";
    r.className = "resume";
    r.textContent = "Resume the tour";
    r.addEventListener("click", function () { playFrom(current); });
    caption.appendChild(r);
  }

  $("play").addEventListener("click", function () { if (playing) stopTour(); else playFrom(current); });
  $("reset").addEventListener("click", function () {
    stopTour(true);
    base(scenario === "review" ? "agent" : "start").then(function () {
      if (scenario === "review") reviewHint(); else yourTurn();
    });
  });

  // A person taking over pauses the tour.
  function watchForPeople(doc) {
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (type) {
      doc.addEventListener(type, function (e) {
        if (!e.isTrusted || !playing) return;
        if (e.target && e.target.closest && e.target.closest(".tour, .caption")) return;
        stopTour();
      }, { capture: true, passive: true });
    });
  }
  watchForPeople(document);

  function reviewHint() {
    caption.innerHTML = "";
    var b = document.createElement("b");
    b.textContent = "Try it.";
    caption.appendChild(b);
    caption.appendChild(document.createTextNode(" Click the changes button to step through them, Restore the removed question, open History (the clock) to compare versions, or Mark as read."));
    progress.textContent = "";
  }

  window.mdDemoResume = function () { playFrom(current); };

  // Start: the review scenario is hands-on; the tour and the hero play while they're on screen.
  if (scenario === "review") {
    demoEl.classList.add("no-tour");
    base("agent").then(reviewHint);
  } else {
    base("start").then(function () {
      if (scenario === "kinetic") { hero(0); pv.mdSetLayout({ zoomMode: "fitWidth" }); }
      say("A live demo of the real app.", "The document below runs mdEditDiff's own preview code. Press Play, pick a topic, or just try it.");
      markChip(0);
      if (reduceMotion || !("IntersectionObserver" in window)) return;
      var autoPaused = false, started = false;
      new IntersectionObserver(function (entries) {
        var visible = entries[0].intersectionRatio >= 0.55;
        if (visible && !started) { started = true; playFrom(0); return; }
        if (!visible && playing) { autoPaused = true; stopTour(true); }
        else if (visible && autoPaused) { autoPaused = false; playFrom(current); }
      }, { threshold: [0, 0.55, 1] }).observe(demoEl);
    });
  }

  /** Lets the page around the demo start the tour at a topic ("Edit & Split", say). */
  window.mdDemoJump = function (name) {
    var i = steps.findIndex(function (s) { return s.name === name; });
    if (i >= 0) playFrom(i);
  };

  window.mdDemoState = function () {
    return { mode: state.mode, rev: state.rev, unread: state.unread, edited: state.edited, playing: playing, step: current };
  };
})();
