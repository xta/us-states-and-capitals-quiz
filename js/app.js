(function () {
  "use strict";

  var STATES = window.STATES;
  var SHAPES = window.SHAPES;
  var app = document.getElementById("app");

  var MODES = {
    quick:     { title: "Quick Quiz", sub: "10 random states",           icon: "⚡",  length: 10 },
    all:       { title: "All 50",     sub: "Every state, shuffled",      icon: "🎯", length: 50 },
    endless:   { title: "Endless",    sub: "Keeps going until you stop", icon: "♾️", length: Infinity, streak: true },
    challenge: { title: "Challenge",  sub: "One wrong answer ends it",   icon: "🔥", length: Infinity, streak: true, suddenDeath: true }
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

  // ---------- questions ----------

  function makeQuestion(state) {
    var pool = shuffle(STATES.filter(function (s) { return s.capital !== state.capital; }))
      .slice(0, CHOICES - 1)
      .map(function (s) { return s.capital; });
    return { state: state, choices: shuffle(pool.concat(state.capital)) };
  }

  // Endless draws from a reshuffled bag so states cycle without immediate repeats.
  function makeBag() {
    var bag = [];
    return function next() {
      if (!bag.length) bag = shuffle(STATES.slice());
      return makeQuestion(bag.pop());
    };
  }

  // ---------- svg ----------

  // The map is built once per quiz and then re-used: only the highlight moves.
  function mapMarkup() {
    var paths = Object.keys(SHAPES.states).map(function (name) {
      return '<path data-s="' + esc(name) + '" d="' + SHAPES.states[name].d + '"/>';
    }).join("");
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

  // ---------- screens ----------

  function homeScreen() {
    var bits = [];
    if (store("best.quick")) bits.push("Quick " + store("best.quick") + "/10");
    if (store("best.endless")) bits.push("Endless " + store("best.endless"));
    if (store("best.challenge")) bits.push("Challenge " + store("best.challenge"));
    if (bits.length) bits.unshift("Best");

    app.innerHTML =
      '<div class="home">' +
        '<div class="hero">' +
          '<svg class="map" viewBox="0 0 ' + SHAPES.w + " " + SHAPES.h + '" aria-hidden="true">' +
            '<path class="nation" d="' + SHAPES.nation + '"/></svg>' +
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
      "</div>";
  }

  function quizScreen(mode) {
    var conf = MODES[mode];
    var nextFromBag = makeBag();
    var questions = conf.length === Infinity ? [] : shuffle(STATES.slice()).slice(0, conf.length).map(makeQuestion);
    var index = 0, score = 0, streak = 0, best = 0, locked = false, timer = null;
    var misses = [];

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
        if (streak > best) best = streak;
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
        if (!correct && mode === "endless") {
          var prevBest = parseInt(store("best.endless") || "0", 10);
          if (best > prevBest) store("best.endless", String(best));
        }
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

  function resultsScreen(mode, result) {
    var conf = MODES[mode];
    var headline, sub, emoji;

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
      emoji = pct === 100 ? "🏆" : pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "📚";
      headline = result.score + " of " + result.total;
      sub = pct + "% correct";
    }

    app.innerHTML =
      '<div class="results">' +
        '<div class="headline">' +
          '<div class="emoji">' + emoji + "</div>" +
          "<h2>" + esc(headline) + "</h2>" +
          '<div class="pct">' + esc(sub) + "</div>" +
        "</div>" +
        (result.misses.length
          ? '<div class="review"><h3>' + (conf.suddenDeath ? "Ended on" : "Review") + "</h3>" +
            result.misses.map(function (m) {
              return '<div class="miss"><span class="st">' + esc(m.state) + "</span>" +
                '<span class="cap">' + esc(m.capital) + "</span>" +
                '<span class="gave">' + esc(m.gave) + "</span></div>";
            }).join("") + "</div>"
          : '<div class="note">Perfect run — every capital correct.</div>') +
        '<div class="actions">' +
          '<button class="btn primary" data-mode="' + mode + '">Play again</button>' +
          '<button class="btn ghost" data-nav="home">Home</button>' +
        "</div>" +
      "</div>";
  }

  // ---------- routing ----------

  function route() {
    var hash = (location.hash || "").replace(/^#\/?/, "");
    var m = hash.match(/^quiz\/(\w+)$/);
    window.scrollTo(0, 0);
    if (m && MODES[m[1]]) quizScreen(m[1]);
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
    if (e.target.closest('[data-nav="home"]')) location.hash = "#/";
  });

  window.addEventListener("hashchange", route);
  route();
})();
