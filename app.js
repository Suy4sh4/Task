/* Tasks — local-first, with optional cross-device sync via Supabase. */

(function () {
  "use strict";

  var STORAGE_KEY = "still.tasks.v1";
  var cfg = window.TASKS_CONFIG || {};
  var remoteOn = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  var pollMs = Math.max(2000, Number(cfg.pollMs) || 4000);
  var api = remoteOn
    ? cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/tasks"
    : null;
  var headers = remoteOn
    ? {
        apikey: cfg.supabaseAnonKey,
        Authorization: "Bearer " + cfg.supabaseAnonKey,
        "Content-Type": "application/json",
      }
    : null;

  var composer = document.getElementById("composer");
  var composerWrap = document.getElementById("composerWrap");
  var input = document.getElementById("taskInput");
  var list = document.getElementById("taskList");
  var empty = document.getElementById("emptyState");
  var announcer = document.getElementById("announcer");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealed = Object.create(null);
  var pendingCreate = Object.create(null);
  var pendingDelete = Object.create(null);
  var inflight = Object.create(null);

  /** @type {{id: string, text: string, createdAt: number}[]} */
  var tasks = load();

  var reveal = null;
  if (!reduceMotion && "IntersectionObserver" in window) {
    reveal = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("shown");
          revealed[entry.target.dataset.id] = true;
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
    );
  }

  render();
  updateEmpty();

  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    input.focus();
  }
  watchScroll();

  if (remoteOn) {
    pull();
    window.setInterval(pull, pollMs);
  }

  /* ---- helpers --------------------------------------------------- */

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function byTime(a, b) {
    return a.createdAt - b.createdAt;
  }

  function announce(message) {
    if (!announcer) return;
    announcer.textContent = "";
    window.requestAnimationFrame(function () {
      announcer.textContent = message;
    });
  }

  /* ---- storage --------------------------------------------------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data
        .filter(function (t) {
          return t && typeof t.text === "string" && t.text.trim().length > 0;
        })
        .map(function (t) {
          return {
            id: typeof t.id === "string" ? t.id : makeId(),
            text: t.text.slice(0, 140),
            createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
          };
        });
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      /* Storage unavailable — app still works for this session. */
    }
  }

  /* ---- rendering ------------------------------------------------- */

  function createRow(task) {
    var li = document.createElement("li");
    li.className = "task";
    li.dataset.id = task.id;

    var inner = document.createElement("div");
    inner.className = "inner";

    var check = document.createElement("button");
    check.type = "button";
    check.className = "check";
    check.setAttribute("aria-label", "Complete " + task.text);
    check.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" ' +
      'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>";

    var text = document.createElement("span");
    text.className = "text";
    text.textContent = task.text;

    inner.appendChild(check);
    inner.appendChild(text);
    li.appendChild(inner);

    if (revealed[task.id] || !reveal) {
      li.classList.add("shown");
    } else {
      reveal.observe(li);
    }
    return li;
  }

  function render() {
    list.textContent = "";
    tasks.forEach(function (task) {
      list.appendChild(createRow(task));
    });
  }

  function updateEmpty() {
    empty.hidden = tasks.length !== 0;
  }

  function applyTasks(next) {
    var changed = JSON.stringify(next) !== JSON.stringify(tasks);
    tasks = next;
    save();
    if (changed) {
      render();
      updateEmpty();
    }
  }

  /* ---- local actions --------------------------------------------- */

  composer.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (!value) {
      shake();
      return;
    }
    var task = {
      id: makeId(),
      text: value.slice(0, 140),
      createdAt: Date.now(),
    };
    tasks.push(task);
    tasks.sort(byTime);
    input.value = "";
    save();
    list.appendChild(createRow(task));
    updateEmpty();
    announce("Task added");

    if (remoteOn) {
      pendingCreate[task.id] = true;
      flush();
    }
    input.focus();
  });

  list.addEventListener("click", function (e) {
    var check = e.target.closest(".check");
    if (!check) return;
    var li = check.closest(".task");
    if (!li || li.classList.contains("done")) return;

    var id = li.dataset.id;
    var next = li.nextElementSibling || li.previousElementSibling;
    var target = next ? next.querySelector(".check") : input;

    li.classList.add("done");

    window.setTimeout(function () {
      tasks = tasks.filter(function (t) {
        return t.id !== id;
      });
      delete revealed[id];
      save();
      li.remove();
      updateEmpty();
      if (target && target.focus) target.focus();
      announce("Task completed");

      if (remoteOn) {
        if (pendingCreate[id]) {
          delete pendingCreate[id]; // never reached the server; nothing to delete
        } else {
          pendingDelete[id] = true;
        }
        flush();
      }
    }, reduceMotion ? 0 : 170);
  });

  function shake() {
    composer.classList.remove("shake");
    void composer.offsetWidth;
    composer.classList.add("shake");
    input.focus();
  }

  /* ---- sync ------------------------------------------------------ */

  function flush() {
    if (!remoteOn) return;

    Object.keys(pendingCreate).forEach(function (id) {
      if (inflight[id]) return;
      var task = null;
      tasks.forEach(function (t) {
        if (t.id === id) task = t;
      });
      if (!task) {
        delete pendingCreate[id];
        return;
      }
      inflight[id] = true;
      fetch(api, {
        method: "POST",
        headers: Object.assign({}, headers, { Prefer: "return=minimal" }),
        body: JSON.stringify({
          id: task.id,
          text: task.text,
          created_at: task.createdAt,
        }),
      })
        .then(function (r) {
          if (r.ok) delete pendingCreate[id];
        })
        .catch(function () {})
        .then(function () {
          delete inflight[id];
        });
    });

    Object.keys(pendingDelete).forEach(function (id) {
      if (inflight["del:" + id]) return;
      inflight["del:" + id] = true;
      fetch(api + "?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        headers: headers,
      })
        .then(function (r) {
          if (r.ok) delete pendingDelete[id];
        })
        .catch(function () {})
        .then(function () {
          delete inflight["del:" + id];
        });
    });
  }

  function pull() {
    if (!remoteOn) return;
    fetch(api + "?select=id,text,created_at&order=created_at.asc", {
      headers: headers,
      cache: "no-store",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("sync failed");
        return r.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows)) return;
        var remote = rows
          .filter(function (r) {
            return r && typeof r.id === "string" && typeof r.text === "string";
          })
          .map(function (r) {
            return {
              id: r.id,
              text: r.text.slice(0, 140),
              createdAt: Number(r.created_at) || 0,
            };
          })
          .filter(function (r) {
            return !pendingDelete[r.id];
          });

        // Keep local edits that haven't been pushed yet.
        var localPending = tasks.filter(function (t) {
          return pendingCreate[t.id] && !remote.some(function (r) {
            return r.id === t.id;
          });
        });

        applyTasks(remote.concat(localPending).sort(byTime));
      })
      .catch(function () {
        /* Offline or misconfigured — local list stays intact. */
      });
  }

  /* ---- scroll ---------------------------------------------------- */

  function watchScroll() {
    var ticking = false;
    function update() {
      composerWrap.classList.toggle("stuck", window.scrollY > 12);
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }
})();
