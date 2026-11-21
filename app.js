/* Tasks — local-first, with optional Supabase sync.
   Long-press a task for priority + group. */

(function () {
  "use strict";

  var STORAGE_KEY = "still.tasks.v1";
  var GROUP_VIEW_KEY = "still.groupView.v1";

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
  var countEl = document.getElementById("count");
  var groupToggle = document.getElementById("groupToggle");

  var backdrop = document.getElementById("sheetBackdrop");
  var sheetText = document.getElementById("sheetText");
  var priorityOptions = document.getElementById("priorityOptions");
  var groupInput = document.getElementById("groupInput");
  var groupChips = document.getElementById("groupChips");
  var deleteBtn = document.getElementById("deleteTask");
  var doneBtn = document.getElementById("sheetDone");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealed = Object.create(null);
  var pendingCreate = Object.create(null);
  var pendingDelete = Object.create(null);
  var metaDirty = Object.create(null);
  var inflight = Object.create(null);

  var groupView = loadGroupView();
  var editingId = null;
  var pressTimer = null;
  var pressPoint = null;
  var pressingRow = null;

  var PRIORITY_RANK = { high: 0, mid: 1, low: 2, "": 3 };

  /** @type {{id: string, text: string, createdAt: number, priority: string, group_name: string}[]} */
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
  updateMeta();

  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    input.focus();
  }
  watchScroll();
  updateComposer();
  input.addEventListener("input", updateComposer);

  if (remoteOn) {
    pull();
    window.setInterval(pull, pollMs);
  }

  /* ---- helpers --------------------------------------------------- */

  function updateComposer() {
    composer.classList.toggle("ready", input.value.trim().length > 0);
  }

  function makeId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function byOrder(a, b) {
    var ra = PRIORITY_RANK[a.priority];
    var rb = PRIORITY_RANK[b.priority];
    var r = (ra === undefined ? 3 : ra) - (rb === undefined ? 3 : rb);
    return r !== 0 ? r : a.createdAt - b.createdAt;
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
            priority: ["high", "mid", "low"].indexOf(t.priority) !== -1 ? t.priority : "",
            group_name: typeof t.group_name === "string" ? t.group_name.slice(0, 32) : "",
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

  function loadGroupView() {
    try {
      return localStorage.getItem(GROUP_VIEW_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function saveGroupView() {
    try {
      localStorage.setItem(GROUP_VIEW_KEY, groupView ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }

  /* ---- rendering ------------------------------------------------- */

  function createRow(task) {
    var li = document.createElement("li");
    li.className = "task";
    li.dataset.id = task.id;
    if (task.priority) li.dataset.priority = task.priority;

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

    var dot = document.createElement("span");
    dot.className = "priority-dot";
    dot.setAttribute("aria-hidden", "true");

    var text = document.createElement("span");
    text.className = "text";
    text.textContent = task.text;

    var more = document.createElement("button");
    more.type = "button";
    more.className = "more";
    more.setAttribute("aria-label", "Options for " + task.text);
    more.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="5" cy="12" r="1.7" fill="currentColor"/>' +
      '<circle cx="12" cy="12" r="1.7" fill="currentColor"/>' +
      '<circle cx="19" cy="12" r="1.7" fill="currentColor"/>' +
      "</svg>";

    inner.appendChild(check);
    inner.appendChild(dot);
    inner.appendChild(text);
    inner.appendChild(more);
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
    var ordered = tasks.slice().sort(byOrder);

    if (!groupView) {
      ordered.forEach(function (task) {
        list.appendChild(createRow(task));
      });
    } else {
      var groups = Object.create(null);
      var order = [];
      ordered.forEach(function (task) {
        var name = task.group_name || "Other";
        if (!groups[name]) {
          groups[name] = [];
          order.push(name);
        }
        groups[name].push(task);
      });
      order.forEach(function (name) {
        var head = document.createElement("div");
        head.className = "group-head";
        var label = document.createElement("span");
        label.className = "group-name";
        label.textContent = name;
        var num = document.createElement("span");
        num.className = "group-count";
        num.textContent = groups[name].length;
        head.appendChild(label);
        head.appendChild(num);
        list.appendChild(head);
        groups[name].forEach(function (task) {
          list.appendChild(createRow(task));
        });
      });
    }
  }

  function updateMeta() {
    empty.hidden = tasks.length !== 0;
    if (!tasks.length) {
      countEl.textContent = "";
    } else if (groupView) {
      var names = Object.create(null);
      tasks.forEach(function (t) {
        names[t.group_name || "Other"] = true;
      });
      countEl.textContent = tasks.length + " tasks · " + Object.keys(names).length + " groups";
    } else {
      countEl.textContent = tasks.length + (tasks.length === 1 ? " task" : " tasks");
    }
    groupToggle.setAttribute("aria-pressed", groupView ? "true" : "false");
  }

  function applyTasks(next) {
    var changed = JSON.stringify(next) !== JSON.stringify(tasks);
    tasks = next;
    save();
    if (changed) {
      render();
      updateMeta();
    }
  }

  function findTask(id) {
    var found = null;
    tasks.forEach(function (t) {
      if (t.id === id) found = t;
    });
    return found;
  }

  /* ---- add / complete / delete ----------------------------------- */

  composer.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = input.value.trim();
    if (!value) {
      shake();
      return;
    }
    // Optional quick grouping: type "#College" anywhere in the task.
    var group = "";
    value = value.replace(/#([^\s#]+)/g, function (_, name) {
      group = name.slice(0, 32);
      return "";
    });
    value = value.replace(/\s+/g, " ").trim();
    if (!value) {
      shake();
      return;
    }

    var task = {
      id: makeId(),
      text: value.slice(0, 140),
      createdAt: Date.now(),
      priority: "",
      group_name: group,
    };
    tasks.push(task);
    input.value = "";
    updateComposer();
    save();
    render();
    updateMeta();
    announce("Task added");

    if (remoteOn) {
      pendingCreate[task.id] = true;
      flush();
    }
    input.focus();
  });

  list.addEventListener("click", function (e) {
    var more = e.target.closest(".more");
    if (more) {
      var row = more.closest(".task");
      if (row) openSheet(row.dataset.id);
      return;
    }
    var check = e.target.closest(".check");
    if (!check) return;
    complete(check.closest(".task"));
  });

  function complete(li) {
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
      render();
      updateMeta();
      if (target && target.focus) target.focus();
      announce("Task completed");

      if (remoteOn) {
        if (pendingCreate[id]) {
          delete pendingCreate[id];
        } else {
          pendingDelete[id] = true;
        }
        flush();
      }
    }, reduceMotion ? 0 : 170);
  }

  function deleteTask(id) {
    tasks = tasks.filter(function (t) {
      return t.id !== id;
    });
    delete revealed[id];
    save();
    render();
    updateMeta();
    if (remoteOn) {
      if (pendingCreate[id]) delete pendingCreate[id];
      else pendingDelete[id] = true;
      flush();
    }
    announce("Task deleted");
  }

  function shake() {
    composer.classList.remove("shake");
    void composer.offsetWidth;
    composer.classList.add("shake");
    input.focus();
  }

  /* ---- group view toggle ----------------------------------------- */

  groupToggle.addEventListener("click", function () {
    groupView = !groupView;
    saveGroupView();
    render();
    updateMeta();
    announce(groupView ? "Grouped by category" : "Grouping off");
  });

  /* ---- long press ------------------------------------------------ */

  list.addEventListener(
    "touchstart",
    function (e) {
      var row = e.target.closest(".task");
      if (!row || e.target.closest(".check") || e.target.closest(".more")) return;
      var t = e.touches[0];
      pressPoint = { x: t.clientX, y: t.clientY };
      pressingRow = row;
      pressTimer = window.setTimeout(function () {
        pressTimer = null;
        row.classList.add("pressing");
        openSheet(row.dataset.id);
        window.setTimeout(function () {
          row.classList.remove("pressing");
        }, 200);
      }, 480);
    },
    { passive: true }
  );

  list.addEventListener(
    "touchmove",
    function (e) {
      if (!pressPoint) return;
      var t = e.touches[0];
      if (Math.abs(t.clientX - pressPoint.x) > 10 || Math.abs(t.clientY - pressPoint.y) > 10) {
        cancelPress();
      }
    },
    { passive: true }
  );

  list.addEventListener("touchend", cancelPress);
  list.addEventListener("touchcancel", cancelPress);

  function cancelPress() {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
    if (pressingRow) {
      pressingRow.classList.remove("pressing");
      pressingRow = null;
    }
    pressPoint = null;
  }

  list.addEventListener("contextmenu", function (e) {
    var row = e.target.closest(".task");
    if (!row || e.target.closest(".check") || e.target.closest(".more")) return;
    e.preventDefault();
    openSheet(row.dataset.id);
  });

  /* ---- options sheet --------------------------------------------- */

  function openSheet(id) {
    var task = findTask(id);
    if (!task) return;
    editingId = id;

    sheetText.value = task.text;

    Array.prototype.forEach.call(priorityOptions.querySelectorAll("button"), function (btn) {
      btn.classList.toggle("active", btn.dataset.value === (task.priority || ""));
    });

    groupInput.value = task.group_name || "";
    renderChips();

    backdrop.hidden = false;
    // force reflow so the transition runs
    void backdrop.offsetWidth;
    backdrop.classList.add("open");
    document.body.style.overflow = "hidden";

    window.setTimeout(function () {
      sheetText.focus();
    }, 180);
  }

  function closeSheet() {
    if (backdrop.hidden) return;
    backdrop.classList.remove("open");
    document.body.style.overflow = "";
    window.setTimeout(function () {
      backdrop.hidden = true;
    }, reduceMotion ? 0 : 220);
    editingId = null;
    announce("Options closed");
  }

  function renderChips() {
    var names = Object.create(null);
    tasks.forEach(function (t) {
      if (t.group_name) names[t.group_name] = true;
    });
    var current = groupInput.value.trim();
    groupChips.textContent = "";
    Object.keys(names).forEach(function (name) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = name;
      if (name === current) btn.style.borderColor = "var(--accent)";
      btn.addEventListener("click", function () {
        groupInput.value = name;
        renderChips();
      });
      groupChips.appendChild(btn);
    });
  }

  priorityOptions.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    Array.prototype.forEach.call(priorityOptions.querySelectorAll("button"), function (b) {
      b.classList.toggle("active", b === btn);
    });
  });

  groupInput.addEventListener("input", renderChips);

  doneBtn.addEventListener("click", function () {
    var task = findTask(editingId);
    if (!task) return closeSheet();
    var active = priorityOptions.querySelector("button.active");
    var edited = sheetText.value.trim();
    if (edited) task.text = edited.slice(0, 140);
    task.priority = active ? active.dataset.value : "";
    task.group_name = groupInput.value.trim().slice(0, 32);
    save();
    metaDirty[task.id] = true;
    if (remoteOn) pushUpdate(task);
    render();
    updateMeta();
    announce("Task updated");
    closeSheet();
  });

  deleteBtn.addEventListener("click", function () {
    var id = editingId;
    closeSheet();
    if (id) deleteTask(id);
  });

  backdrop.addEventListener("click", function (e) {
    if (e.target === backdrop) closeSheet();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !backdrop.hidden) closeSheet();
  });

  /* ---- sync ------------------------------------------------------ */

  function pushUpdate(task) {
    var url = api + "?id=eq." + encodeURIComponent(task.id);
    fetch(url, {
      method: "PATCH",
      headers: headers,
      body: JSON.stringify({
        text: task.text,
        priority: task.priority,
        group_name: task.group_name,
      }),
    })
      .then(function (r) {
        if (r.ok) {
          delete metaDirty[task.id];
          return;
        }
        // New columns may not exist yet — still sync the text itself.
        if (r.status === 400) {
          return fetch(url, {
            method: "PATCH",
            headers: headers,
            body: JSON.stringify({ text: task.text }),
          }).then(function (r2) {
            if (r2.ok) delete metaDirty[task.id];
          });
        }
      })
      .catch(function () {});
  }

  function flush() {
    if (!remoteOn) return;

    Object.keys(pendingCreate).forEach(function (id) {
      if (inflight[id]) return;
      var task = findTask(id);
      if (!task) {
        delete pendingCreate[id];
        return;
      }
      inflight[id] = true;
      var full = {
        id: task.id,
        text: task.text,
        created_at: task.createdAt,
        priority: task.priority,
        group_name: task.group_name,
      };
      var minimal = { id: task.id, text: task.text, created_at: task.createdAt };

      fetch(api, {
        method: "POST",
        headers: Object.assign({}, headers, { Prefer: "return=minimal" }),
        body: JSON.stringify(full),
      })
        .then(function (r) {
          if (r.ok) {
            delete pendingCreate[id];
            delete metaDirty[id];
            return;
          }
          if (r.status === 400) {
            return fetch(api, {
              method: "POST",
              headers: Object.assign({}, headers, { Prefer: "return=minimal" }),
              body: JSON.stringify(minimal),
            }).then(function (r2) {
              if (r2.ok) delete pendingCreate[id];
            });
          }
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

    fetch(api + "?select=id,text,created_at,priority,group_name&order=created_at.asc", {
      headers: headers,
      cache: "no-store",
    })
      .then(function (r) {
        if (r.status === 400) {
          return fetch(api + "?select=id,text,created_at&order=created_at.asc", {
            headers: headers,
            cache: "no-store",
          });
        }
        return r;
      })
      .then(function (r) {
        if (!r.ok) throw new Error("sync failed");
        return r.json();
      })
      .then(function (rows) {
        if (!Array.isArray(rows)) return;
        var localById = Object.create(null);
        tasks.forEach(function (t) {
          localById[t.id] = t;
        });

        var remote = rows
          .filter(function (r) {
            return r && typeof r.id === "string" && typeof r.text === "string";
          })
          .map(function (r) {
            var local = localById[r.id];
            var priority = ["high", "mid", "low"].indexOf(r.priority) !== -1 ? r.priority : "";
            var group = typeof r.group_name === "string" ? r.group_name.slice(0, 32) : "";
            // Keep local metadata until the server confirms it (or if the
            // new columns don't exist yet).
            if (local && (metaDirty[r.id] || ((!priority && local.priority) || (!group && local.group_name)))) {
              priority = local.priority;
              group = local.group_name;
            }
            return {
              id: r.id,
              text: r.text.slice(0, 140),
              createdAt: Number(r.created_at) || 0,
              priority: priority,
              group_name: group,
            };
          })
          .filter(function (r) {
            return !pendingDelete[r.id];
          });

        var localPending = tasks.filter(function (t) {
          return pendingCreate[t.id] && !remote.some(function (r) {
            return r.id === t.id;
          });
        });

        applyTasks(remote.concat(localPending).sort(byOrder));
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
