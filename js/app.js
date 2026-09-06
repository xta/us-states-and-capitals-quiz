(function () {
  "use strict";

  var STATES = window.STATES;
  var SHAPES = window.SHAPES;
  var app = document.getElementById("app");

  var MODES = {
    quick:     { title: "Quick Quiz", sub: "10 random states",           icon: "⚡",  length: 10 },
    all:       { title: "All 50",     sub: "All 50 states",              icon: "🎯", length: 50 },
    challenge: { title: "Challenge",  sub: "One wrong answer and you’re done", icon: "🔥", length: Infinity, streak: true, suddenDeath: true },
    advanced:  { title: "Advanced Quiz", sub: "Zoomed-in region — name the state, then its capital", icon: "🎓", length: 10, pair: true }
  };

  var CHOICES = 4;
  var REVEAL_MS = 850;

  // ---------- utils ----------

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* private mode */ }
    return null;
  }

  function answerMode() {
    return store("answers") === "cities" ? "cities" : "capitals";
  }

  // ---------- questions ----------

  function makeQuestion(state, answers) {
    var pool;
    if (answers === "cities") {
      // Other cities in the same state, so elimination by region does not help.
      pool = shuffle(state.cities.slice()).slice(0, CHOICES - 1);
    } else {
      pool = shuffle(STATES.filter(function (s) { return s.capital !== state.capital; }))
        .slice(0, CHOICES - 1)
        .map(function (s) { return s.capital; });
    }
    return { state: state, choices: shuffle(pool.concat(state.capital)) };
  }

  // Challenge draws from a reshuffled bag so states cycle without immediate repeats.
  function makeBag(answers) {
    var bag = [];
    return function next() {
      if (!bag.length) bag = shuffle(STATES.slice());
      return makeQuestion(bag.pop(), answers);
    };
  }

  // ---------- svg ----------

  var cachedPaths = null;
  function statePaths() {
    if (cachedPaths === null) {
      cachedPaths = Object.keys(SHAPES.states).map(function (name) {
        return '<path data-s="' + esc(name) + '" d="' + SHAPES.states[name].d + '"/>';
      }).join("");
    }
    return cachedPaths;
  }

  // The map is built once per quiz and then re-used: only the highlight moves.
  function mapMarkup() {
    var paths = statePaths();
    return '<svg class="usmap" viewBox="0 0 ' + SHAPES.w + " " + SHAPES.h + '" role="img">' +
             '<g class="all">' + paths + "</g></svg>" +
           '<div class="detail"><svg viewBox="0 0 1 1" aria-hidden="true"><path d=""/></svg></div>';
  }

  function highlight(wrap, name) {
    var group = wrap.querySelector(".usmap .all");
    var prev = group.querySelector(".here");
    if (prev) prev.classList.remove("here");

    var el = group.querySelector('[data-s="' + name + '"]');
    group.appendChild(el); // paint the highlighted state above its neighbours
    el.classList.add("here");
    wrap.querySelector(".usmap")
        .setAttribute("aria-label", name + " highlighted on a map of the United States");

    // Inset: the same path, zoomed to its own bounds, so small states stay readable.
    var s = SHAPES.states[name];
    var x0 = s.b[0], y0 = s.b[1];
    var w = Math.max(s.b[2] - x0, 0.1), h = Math.max(s.b[3] - y0, 0.1);
    var pad = Math.max(w, h) * 0.08 + 1;
    var box = wrap.querySelector(".detail");
    var cx = (s.b[0] + s.b[2]) / 2, cy = (s.b[1] + s.b[3]) / 2;
    box.className = "detail " + (cy < SHAPES.h / 2 ? "b" : "t") + (cx < SHAPES.w / 2 ? "r" : "l");

    var svg = box.querySelector("svg");
    svg.setAttribute("viewBox", (x0 - pad) + " " + (y0 - pad) + " " + (w + pad * 2) + " " + (h + pad * 2));
    svg.firstElementChild.setAttribute("d", s.d);
  }

  // ---------- confetti ----------

  var COLORS = ["#4f9cf9", "#34b37a", "#ffd166", "#ef6f8f", "#c084fc", "#ffffff"];

  // Falls until the results screen is replaced — the canvas goes with it.
  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var canvas = document.createElement("canvas");
    canvas.className = "confetti";
    canvas.setAttribute("aria-hidden", "true");
    app.appendChild(canvas);

    var ctx = canvas.getContext("2d");
    var w = 0, h = 0;

    function fit() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fit();

    function spawn(p, atTop) {
      p.x = Math.random() * w;
      p.y = atTop ? -20 - Math.random() * 40 : -20 - Math.random() * h;
      p.vx = (Math.random() - 0.5) * 1.4;
      p.vy = 1.6 + Math.random() * 2.4;
      p.w = 5 + Math.random() * 5;
      p.h = 8 + Math.random() * 6;
      p.rot = Math.random() * Math.PI;
      p.vr = (Math.random() - 0.5) * 0.22;
      p.color = COLORS[(Math.random() * COLORS.length) | 0];
      return p;
    }

    var pieces = [];
    for (var i = 0; i < 80; i++) pieces.push(spawn({}, false));

    function frame() {
      // The screen was replaced (play again, home) — stop rather than animate
      // into a detached canvas.
      if (!canvas.isConnected) return;
      if (window.innerWidth !== w || window.innerHeight !== h) fit();

      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < pieces.length; i++) {
        var p = pieces[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.012;
        p.rot += p.vr;
        if (p.y - p.h > h) spawn(p, true); // recycle to the top, so it keeps showering
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------- screens ----------

  function homeScreen() {
    var bits = [];
    if (store("best.quick")) bits.push("Quick " + store("best.quick") + "/10");
    if (store("best.challenge")) bits.push("Challenge " + store("best.challenge"));
    if (store("best.advanced")) bits.push("Advanced " + store("best.advanced") + "/20");
    if (bits.length) bits.unshift("Best");

    app.innerHTML =
      '<div class="home">' +
        '<div class="hero">' +
          '<svg class="map" viewBox="0 0 ' + SHAPES.w + " " + SHAPES.h + '" aria-hidden="true">' +
            statePaths() + "</svg>" +
          "<h1>States &amp; Capitals</h1>" +
          "<p>Name the capital of the highlighted state.</p>" +
        "</div>" +
        '<div class="modes">' +
          Object.keys(MODES).map(function (key) {
            var m = MODES[key];
            return '<button class="mode" data-mode="' + key + '">' +
              '<span class="icon">' + m.icon + "</span>" +
              '<span class="label"><span class="title">' + esc(m.title) + "</span>" +
              '<span class="sub">' + esc(m.sub) + "</span></span>" +
              '<span class="chev">›</span></button>';
          }).join("") +
        "</div>" +
        '<div class="best">' + esc(bits.join(" · ")) + "</div>" +
        settingsMarkup() +
      "</div>";

    app.className = "scrollable"; // home may run past the viewport; the quiz may not
  }

  var ANSWER_HELP = {
    capitals: "Four capitals from around the country.",
    cities: "The capital mixed with three other cities from the same state — harder, since you cannot rule answers out by region."
  };

  function settingsMarkup() {
    var current = answerMode();
    return '<div class="settings">' +
      '<div class="settings-head">Answer choices</div>' +
      '<div class="segmented" role="radiogroup" aria-label="Answer choices">' +
        ["capitals", "cities"].map(function (key) {
          var on = key === current;
          return '<button class="seg' + (on ? " is-on" : "") + '" role="radio" ' +
            'aria-checked="' + on + '" data-answers="' + key + '">' +
            (key === "capitals" ? "Capitals" : "Cities") + "</button>";
        }).join("") +
      "</div>" +
      '<p class="settings-help">' + esc(ANSWER_HELP[current]) + "</p>" +
    "</div>";
  }

  function quizScreen(mode) {
    var conf = MODES[mode];
    var answers = answerMode();
    var nextFromBag = makeBag(answers);
    var questions = conf.length === Infinity ? [] : shuffle(STATES.slice()).slice(0, conf.length)
      .map(function (st) { return makeQuestion(st, answers); });
    var index = 0, score = 0, streak = 0, locked = false, timer = null;
    var misses = [];

    app.className = "";
    app.innerHTML =
      '<div class="quiz">' +
        '<div class="bar">' +
          '<button class="back" data-nav="home">‹ Home</button>' +
          '<span class="count"></span>' +
          '<span class="score"></span>' +
        "</div>" +
        '<div class="progress"><i style="width:0"></i></div>' +
        '<div class="stage">' +
          '<div class="shape-wrap"></div>' +
          '<div class="state-name"></div>' +
          '<div class="prompt">What is the capital?</div>' +
        "</div>" +
        '<div class="answers"></div>' +
      "</div>";

    var elShape = app.querySelector(".shape-wrap");
    elShape.innerHTML = mapMarkup();
    var elName = app.querySelector(".state-name");
    var elCount = app.querySelector(".count");
    var elScore = app.querySelector(".score");
    var elBar = app.querySelector(".progress i");
    var elAnswers = app.querySelector(".answers");

    function current() {
      if (conf.length === Infinity) {
        while (questions.length <= index) questions.push(nextFromBag());
      }
      return questions[index];
    }

    function render() {
      var q = current();
      var name = q.state.name;
      highlight(elShape, name);
      elName.textContent = name;

      if (conf.streak) {
        elCount.textContent = "Question " + (index + 1);
        elScore.innerHTML = "streak <b>" + streak + "</b>";
        elBar.style.width = "100%";
      } else {
        elCount.textContent = index + 1 + " of " + conf.length;
        elScore.innerHTML = "<b>" + score + "</b>/" + (index || "0");
        elBar.style.width = (index / conf.length) * 100 + "%";
      }

      elAnswers.innerHTML = q.choices.map(function (c) {
        return '<button class="answer" data-capital="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("");
      locked = false;
    }

    function advance() {
      clearTimeout(timer);
      timer = null;
      index++;
      if (conf.length !== Infinity && index >= conf.length) {
        resultsScreen(mode, { score: score, total: conf.length, misses: misses });
      } else {
        render();
      }
    }

    function answer(picked) {
      if (locked) return;
      locked = true;
      var q = current();
      var right = q.state.capital;
      var correct = picked === right;

      if (correct) {
        score++;
        streak++;
      } else {
        misses.push({ state: q.state.name, capital: right, gave: picked });
        streak = 0;
      }

      Array.prototype.forEach.call(elAnswers.children, function (btn) {
        var cap = btn.dataset.capital;
        btn.disabled = true;
        if (cap === right) btn.classList.add("correct");
        else if (cap === picked) btn.classList.add("wrong");
        else btn.classList.add("faded");
      });

      if (conf.streak) {
        elScore.innerHTML = "streak <b>" + streak + "</b>";
      } else {
        elScore.innerHTML = "<b>" + score + "</b>/" + (index + 1);
        elBar.style.width = ((index + 1) / conf.length) * 100 + "%";
      }

      if (conf.suddenDeath && !correct) {
        // The run is over; hold on the reveal a moment, then show the score.
        timer = setTimeout(function () {
          clearTimeout(timer);
          timer = null;
          resultsScreen(mode, { score: score, total: index + 1, misses: misses });
        }, REVEAL_MS + 550);
        return;
      }

      // A wrong answer lingers a beat longer so the right one registers.
      timer = setTimeout(advance, correct ? REVEAL_MS : REVEAL_MS + 550);
    }

    elAnswers.addEventListener("click", function (e) {
      var btn = e.target.closest(".answer");
      if (btn && !btn.disabled) {
        e.stopPropagation(); // don't let this same click hit the skip handler below
        answer(btn.dataset.capital);
      }
    });

    // Tapping anywhere during the reveal skips the wait. Bound to the screen,
    // not to #app, so it dies with the screen instead of outliving the quiz.
    app.querySelector(".quiz").addEventListener("click", function (e) {
      if (timer && !e.target.closest("[data-nav]")) advance();
    });

    render();
  }

  function flatMiss(m) {
    return '<div class="miss"><span class="st">' + esc(m.state) + "</span>" +
      '<span class="cap">' + esc(m.capital) + "</span>" +
      '<span class="gave">' + esc(m.gave) + "</span></div>";
  }

  // Advanced misses carry two parts, either of which may have gone wrong.
  function pairMiss(m) {
    return '<div class="miss pair"><span class="st">' + esc(m.state) + "</span>" +
      m.parts.map(function (part) {
        return '<span class="part"><span class="k">' + esc(part.k) + "</span>" +
          '<span class="cap">' + esc(part.right) + "</span>" +
          '<span class="gave">' + esc(part.gave) + "</span></span>";
      }).join("") + "</div>";
  }

  function resultsScreen(mode, result) {
    var conf = MODES[mode];
    var headline, sub, emoji, perfect = false;

    if (conf.suddenDeath) {
      // A sudden-death run is scored by how far you got, not by a percentage.
      var prevRun = parseInt(store("best.challenge") || "0", 10);
      var isBest = result.score > prevRun;
      if (isBest) store("best.challenge", String(result.score));

      emoji = result.score >= 25 ? "🏆" : result.score >= 15 ? "🎉" : result.score >= 7 ? "👍" : "📚";
      headline = result.score + (result.score === 1 ? " state" : " states") + " in a row";
      sub = isBest && result.score > 0 ? "New personal best" : "Best run: " + Math.max(prevRun, result.score);
    } else {
      var pct = Math.round((result.score / result.total) * 100);
      if (mode === "quick") {
        var prev = parseInt(store("best.quick") || "0", 10);
        if (result.score > prev) store("best.quick", String(result.score));
      }
      if (conf.pair) {
        var prevAdv = parseInt(store("best.advanced") || "0", 10);
        if (result.score > prevAdv) store("best.advanced", String(result.score));
      }
      emoji = pct === 100 ? "🏆" : pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "📚";
      headline = result.score + " of " + result.total;
      sub = pct + "% correct";
      perfect = pct === 100;
    }

    app.className = "";
    app.innerHTML =
      '<div class="results">' +
        '<div class="headline">' +
          '<div class="emoji">' + emoji + "</div>" +
          "<h2>" + esc(headline) + "</h2>" +
          '<div class="pct">' + esc(sub) + "</div>" +
        "</div>" +
        (result.misses.length
          ? '<div class="review"><h3>' + (conf.suddenDeath ? "Ended on" : "Review") + "</h3>" +
            result.misses.map(conf.pair ? pairMiss : flatMiss).join("") + "</div>"
          : '<div class="note">Perfect run — every ' +
            (conf.pair ? "state and capital" : "capital") + " correct.</div>") +
        '<div class="actions">' +
          '<button class="btn primary" data-mode="' + mode + '">Play again</button>' +
          '<button class="btn ghost" data-nav="home">Home</button>' +
        "</div>" +
      "</div>";

    if (perfect) confetti();
  }

  // ---------- advanced: a zoomed region, then two questions about it ----------

  // Alaska and Hawaii sit off on their own in the atlas, so a region around
  // them is empty water. Those two are shown zoomed to themselves.
  var SOLO = { Alaska: true, Hawaii: true };
  var REGION_AR = 5 / 4; // matches the panel the region is drawn into

  function centerOf(name) {
    var b = SHAPES.states[name].b;
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  }

  // Nearest states by centre distance: the ones sharing the snapshot, which
  // makes them the honest distractors — you cannot rule them out by region.
  var nearCache = {};
  function nearby(name, count) {
    if (!nearCache[name]) {
      var c = centerOf(name);
      nearCache[name] = STATES.filter(function (s) { return s.name !== name; })
        .map(function (s) {
          var o = centerOf(s.name);
          return { s: s, d: (o[0] - c[0]) * (o[0] - c[0]) + (o[1] - c[1]) * (o[1] - c[1]) };
        })
        .sort(function (a, b) { return a.d - b.d; })
        .map(function (x) { return x.s; });
    }
    return nearCache[name].slice(0, count);
  }

  // Widen the state's own bounds until enough neighbours share the frame, then
  // square up to the panel's aspect and keep the window inside the map.
  function regionBox(name) {
    var b = SHAPES.states[name].b;
    var sw = Math.max(b[2] - b[0], 1), sh = Math.max(b[3] - b[1], 1);
    // Padding grows with the state but is capped, so a small state is not lost
    // in the frame and a large one still shows the states around it.
    var pad = SOLO[name]
      ? Math.max(sw, sh) * 0.12 + 30
      : Math.min(120 + 0.9 * Math.max(sw, sh), 800);
    var vw = sw + pad * 2, vh = sh + pad * 2;
    if (vw / vh < REGION_AR) vw = vh * REGION_AR; else vh = vw / REGION_AR;

    var c = centerOf(name);
    var x = c[0] - vw / 2, y = c[1] - vh / 2;
    // A region is kept inside the map so the frame is never half empty; the two
    // states shown on their own stay centred instead.
    if (!SOLO[name]) {
      if (vw <= SHAPES.w) x = Math.min(Math.max(x, 0), SHAPES.w - vw);
      if (vh <= SHAPES.h) y = Math.min(Math.max(y, 0), SHAPES.h - vh);
    }
    return x + " " + y + " " + vw + " " + vh;
  }

  function makePair(state, answers) {
    var near = nearby(state.name, 8);
    var names = shuffle(near.slice(0, 6)).slice(0, CHOICES - 1)
      .map(function (s) { return s.name; });
    var caps = answers === "cities"
      ? shuffle(state.cities.slice()).slice(0, CHOICES - 1)
      : shuffle(near.slice()).slice(0, CHOICES - 1).map(function (s) { return s.capital; });
    return {
      state: state,
      names: shuffle(names.concat(state.name)),
      caps: shuffle(caps.concat(state.capital))
    };
  }

  function advancedScreen(mode) {
    var conf = MODES[mode];
    var answers = answerMode();
    var rounds = shuffle(STATES.slice()).slice(0, conf.length)
      .map(function (st) { return makePair(st, answers); });
    var picks = rounds.map(function () { return { name: null, capital: null }; });
    var index = 0, timer = null;

    app.className = "scrollable"; // two questions and a map: this one may scroll
    app.innerHTML =
      '<div class="quiz adv">' +
        '<div class="bar">' +
          '<button class="back" data-nav="home">‹ Home</button>' +
          '<span class="count"></span>' +
          '<span class="score"></span>' +
        "</div>" +
        '<div class="progress"><i style="width:0"></i></div>' +
        '<div class="region"></div>' +
        '<div class="adv-q">' +
          '<div class="q-head"><span class="q-num">1</span>State?</div>' +
          '<div class="answers" data-pick="name"></div>' +
        "</div>" +
        '<div class="adv-q q-cap">' +
          '<div class="q-head"><span class="q-num">2</span>Capital?</div>' +
          '<div class="answers" data-pick="capital"></div>' +
        "</div>" +
      "</div>";

    var wrap = app.querySelector(".adv");
    var elRegion = wrap.querySelector(".region");
    elRegion.innerHTML = '<svg class="usmap" viewBox="0 0 ' + SHAPES.w + " " + SHAPES.h +
      '" role="img"><g class="all">' + statePaths() + "</g></svg>";

    var elCount = wrap.querySelector(".count");
    var elScore = wrap.querySelector(".score");
    var elBar = wrap.querySelector(".progress i");
    var elNames = wrap.querySelector('[data-pick="name"]');
    var elCaps = wrap.querySelector('[data-pick="capital"]');
    var capBlock = wrap.querySelector(".q-cap");

    function settled(i) { return picks[i].name !== null && picks[i].capital !== null; }

    function points(i) {
      return (picks[i].name === rounds[i].state.name ? 1 : 0) +
             (picks[i].capital === rounds[i].state.capital ? 1 : 0);
    }

    function total() {
      return rounds.reduce(function (sum, r, i) { return sum + points(i); }, 0);
    }

    function fill(box, choices, picked, right, reveal, live) {
      box.innerHTML = choices.map(function (c) {
        return '<button class="answer" data-v="' + esc(c) + '">' + esc(c) + "</button>";
      }).join("");
      Array.prototype.forEach.call(box.children, function (btn) {
        var v = btn.dataset.v;
        btn.disabled = reveal || !live;
        // Nothing is marked right or wrong until both answers are in — otherwise
        // a revealed state name would hand over the capital.
        if (reveal) {
          if (v === right) btn.classList.add("correct");
          else if (v === picked) btn.classList.add("wrong");
          else btn.classList.add("faded");
        } else if (v === picked) {
          btn.classList.add("picked");
        }
      });
    }

    function render() {
      var r = rounds[index], p = picks[index], done = settled(index);

      var svg = elRegion.querySelector("svg");
      svg.setAttribute("viewBox", regionBox(r.state.name));
      svg.classList.toggle("solo", !!SOLO[r.state.name]);
      var g = svg.querySelector(".all");
      var prev = g.querySelector(".here");
      if (prev) prev.classList.remove("here");
      var el = g.querySelector('[data-s="' + r.state.name + '"]');
      g.appendChild(el); // paint the highlighted state above its neighbours
      el.classList.add("here");
      svg.setAttribute("aria-label", done
        ? r.state.name + " highlighted, zoomed in on its region"
        : "One state highlighted, zoomed in on its region");

      elCount.textContent = index + 1 + " of " + conf.length;
      elScore.innerHTML = "<b>" + total() + "</b>/" + conf.length * 2;
      elBar.style.width = rounds.filter(function (_, i) { return settled(i); }).length /
        conf.length * 100 + "%";

      // Both answers stay open, in either order, until the second pick settles
      // the round — so a first guess can be reconsidered rather than locked in.
      fill(elNames, r.names, p.name, r.state.name, done, !done);
      fill(elCaps, r.caps, p.capital, r.state.capital, done, !done);
    }

    function advance() {
      clearTimeout(timer);
      timer = null;
      index++;
      if (index >= conf.length) return finish();
      window.scrollTo(0, 0);
      render();
    }

    function finish() {
      var misses = [];
      rounds.forEach(function (r, i) {
        var parts = [];
        if (picks[i].name !== r.state.name) {
          parts.push({ k: "State", right: r.state.name, gave: picks[i].name });
        }
        if (picks[i].capital !== r.state.capital) {
          parts.push({ k: "Capital", right: r.state.capital, gave: picks[i].capital });
        }
        if (parts.length) misses.push({ state: r.state.name, parts: parts });
      });
      resultsScreen(mode, { score: total(), total: conf.length * 2, misses: misses });
    }

    wrap.addEventListener("click", function (e) {
      // Mid-reveal, a tap anywhere but Home skips the wait — as in the other modes.
      if (timer) {
        if (!e.target.closest("[data-nav]")) advance();
        return;
      }
      var pick = e.target.closest(".answer");
      if (!pick || pick.disabled) return;

      picks[index][pick.parentNode.dataset.pick] = pick.dataset.v;
      render();
      if (settled(index)) {
        // Two answers to take in, so hold a beat longer than a single-question
        // reveal, and longer again when something was missed.
        timer = setTimeout(advance, REVEAL_MS + (points(index) === 2 ? 250 : 700));
      } else {
        // The other question is often below the fold.
        (picks[index].capital === null ? capBlock : elNames)
          .scrollIntoView({ block: "nearest" });
      }
    });

    render();
  }

  // ---------- routing ----------

  function route() {
    var hash = (location.hash || "").replace(/^#\/?/, "");
    var m = hash.match(/^quiz\/(\w+)$/);
    window.scrollTo(0, 0);
    if (m && MODES[m[1]]) (MODES[m[1]].pair ? advancedScreen : quizScreen)(m[1]);
    else homeScreen();
  }

  document.addEventListener("click", function (e) {
    var mode = e.target.closest("[data-mode]");
    if (mode) {
      var to = "#/quiz/" + mode.dataset.mode;
      if (location.hash === to) route(); // replay same mode
      else location.hash = to;
      return;
    }
    var seg = e.target.closest("[data-answers]");
    if (seg) {
      var y = window.scrollY;
      store("answers", seg.dataset.answers);
      homeScreen();
      window.scrollTo(0, y);
      return;
    }

    if (e.target.closest('[data-nav="home"]')) location.hash = "#/";
  });

  window.addEventListener("hashchange", route);
  route();
})();
