(function () {
  "use strict";

  var STATES = window.STATES;
  var SHAPES = window.SHAPES;
  var app = document.getElementById("app");

  var MODES = {
    quick:   { title: "Quick Quiz",  sub: "10 random states",     icon: "⚡", length: 10 },
    all:     { title: "All 50",      sub: "Every state, shuffled", icon: "🎯", length: 50 },
    endless: { title: "Endless",     sub: "Keeps going until you stop", icon: "♾️", length: Infinity }
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

  function outlineSVG(name) {
    var s = SHAPES.states[name];
    var x0 = s.b[0], y0 = s.b[1], x1 = s.b[2], y1 = s.b[3];
    var w = Math.max(x1 - x0, 0.1), h = Math.max(y1 - y0, 0.1);
    var pad = Math.max(w, h) * 0.06 + 1;
    var vb = (x0 - pad) + " " + (y0 - pad) + " " + (w + pad * 2) + " " + (h + pad * 2);
    return '<svg class="shape" viewBox="' + vb + '" role="img" aria-label="Outline of ' + esc(name) + '">' +
           '<path d="' + s.d + '"/></svg>';
  }

  function locatorSVG(name) {
    return '<svg class="locator" viewBox="0 0 ' + SHAPES.w + " " + SHAPES.h + '" aria-hidden="true">' +
           '<path class="nation" d="' + SHAPES.nation + '"/>' +
           '<path class="here" d="' + SHAPES.states[name].d + '"/></svg>';
  }

  // ---------- screens ----------

  function homeScreen() {
    var bestQuick = store("best.quick");
    var bestEndless = store("best.endless");
    var bits = [];
    if (bestQuick) bits.push("Best quick quiz: " + bestQuick + "/10");
    if (bestEndless) bits.push("Longest streak: " + bestEndless);

    app.innerHTML =
      '<div class="home">' +
        '<div class="hero">' +
          '<svg class="map" viewBox="0 0 ' + SHAPES.w + " " + SHAPES.h + '" aria-hidden="true">' +
            '<path class="nation" d="' + SHAPES.nation + '"/></svg>' +
          "<h1>States &amp; Capitals</h1>" +
          "<p>Name the capital from the state outline.</p>" +
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
    var elName = app.querySelector(".state-name");
    var elCount = app.querySelector(".count");
    var elScore = app.querySelector(".score");
    var elBar = app.querySelector(".progress i");
    var elAnswers = app.querySelector(".answers");

    function current() {
      if (mode === "endless") {
        while (questions.length <= index) questions.push(nextFromBag());
      }
      return questions[index];
    }

    function render() {
      var q = current();
      var name = q.state.name;
      elShape.innerHTML = outlineSVG(name) + locatorSVG(name);
      elName.textContent = name;

      if (mode === "endless") {
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
      if (mode !== "endless" && index >= conf.length) {
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

      if (mode === "endless") {
        elScore.innerHTML = "streak <b>" + streak + "</b>";
        if (!correct) {
          var prevBest = parseInt(store("best.endless") || "0", 10);
          if (best > prevBest) store("best.endless", String(best));
        }
      } else {
        elScore.innerHTML = "<b>" + score + "</b>/" + (index + 1);
        elBar.style.width = ((index + 1) / conf.length) * 100 + "%";
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
    var pct = Math.round((result.score / result.total) * 100);
    var emoji = pct === 100 ? "🏆" : pct >= 80 ? "🎉" : pct >= 50 ? "👍" : "📚";

    if (mode === "quick") {
      var prev = parseInt(store("best.quick") || "0", 10);
      if (result.score > prev) store("best.quick", String(result.score));
    }

    app.innerHTML =
      '<div class="results">' +
        '<div class="headline">' +
          '<div class="emoji">' + emoji + "</div>" +
          "<h2>" + result.score + " of " + result.total + "</h2>" +
          '<div class="pct">' + pct + "% correct</div>" +
        "</div>" +
        (result.misses.length
          ? '<div class="review"><h3>Review</h3>' +
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
