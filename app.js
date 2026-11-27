(function () {
  "use strict";

  const $ = function (selector) { return document.querySelector(selector); };
  const $$ = function (selector) { return Array.from(document.querySelectorAll(selector)); };
  const statusMessage = $("#status-message");
  let statusTimer;

  function showStatus(message) {
    statusMessage.textContent = message;
    statusMessage.classList.add("visible");
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(function () {
      statusMessage.classList.remove("visible");
    }, 4200);
  }

  function makeId() {
    return window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function starterTasks() {
    return STARTER_TASKS.map(function (task) {
      return {
        id: makeId(),
        title: task.title,
        date: task.date,
        completed: false,
        source: "Sample assignment"
      };
    });
  }

  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2], 12);
    return date.getFullYear() === parts[0] &&
      date.getMonth() === parts[1] - 1 &&
      date.getDate() === parts[2];
  }

  function normalizeCard(card) {
    if (!card || typeof card.question !== "string" || typeof card.answer !== "string") return null;
    const term = typeof card.term === "string"
      ? card.term
      : card.question.replace(/^What is\s+/i, "").replace(/\?$/, "");
    const answer = card.answer;
    const definition = answer.replace(new RegExp("^" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+", "i"), "");
    return {
      id: typeof card.id === "string" ? card.id : makeId(),
      question: card.question,
      answer: answer,
      term: term,
      cloze: typeof card.cloze === "string" ? card.cloze : "_____ is " + definition
    };
  }

  function loadState() {
    const now = new Date().toISOString();
    try {
      const saved = localStorage.getItem(DESK_APP.storageKey);
      if (saved === null) {
        return {
          boardText: "",
          strokes: [],
          cards: [],
          tasks: starterTasks(),
          studySeconds: 0,
          cycleStudySeconds: 0,
          cycleStart: now,
          lastQuiz: null
        };
      }

      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tasks)) {
        throw new Error("Saved data has an unexpected format.");
      }
      const oldNotes = Array.isArray(parsed.notes)
        ? parsed.notes.map(function (note) {
          return note && typeof note.text === "string" ? note.text : "";
        }).filter(Boolean).join("\n\n")
        : "";
      const cards = Array.isArray(parsed.cards)
        ? parsed.cards.map(normalizeCard).filter(Boolean)
        : [];
      const cycleStart = typeof parsed.cycleStart === "string" && Number.isFinite(Date.parse(parsed.cycleStart))
        ? parsed.cycleStart
        : now;
      const lastQuiz = parsed.lastQuiz && Number.isFinite(parsed.lastQuiz.score) &&
        Number.isFinite(parsed.lastQuiz.total) ? parsed.lastQuiz : null;

      return {
        boardText: typeof parsed.boardText === "string" ? parsed.boardText : oldNotes,
        strokes: Array.isArray(parsed.strokes) ? parsed.strokes.filter(function (stroke) {
          return stroke && Array.isArray(stroke.points) && stroke.points.length > 0;
        }) : [],
        cards: cards,
        tasks: parsed.tasks.filter(function (task) {
          return task && typeof task.title === "string" && validDate(task.date);
        }).map(function (task) {
          return {
            id: typeof task.id === "string" ? task.id : makeId(),
            title: task.title,
            date: task.date,
            completed: Boolean(task.completed),
            source: typeof task.source === "string" ? task.source : ""
          };
        }),
        studySeconds: Number.isFinite(parsed.studySeconds) && parsed.studySeconds >= 0
          ? parsed.studySeconds
          : 0,
        cycleStudySeconds: Number.isFinite(parsed.cycleStudySeconds) && parsed.cycleStudySeconds >= 0
          ? parsed.cycleStudySeconds
          : (Number.isFinite(parsed.studySeconds) && parsed.studySeconds >= 0 ? parsed.studySeconds : 0),
        cycleStart: cycleStart,
        lastQuiz: lastQuiz
      };
    } catch (error) {
      showStatus("We couldn't read saved study data. Your new changes will be saved in this browser.");
      return {
        boardText: "",
        strokes: [],
        cards: [],
        tasks: starterTasks(),
        studySeconds: 0,
        cycleStudySeconds: 0,
        cycleStart: now,
        lastQuiz: null
      };
    }
  }

  const state = loadState();
  let currentScreen = "home";
  let studyFileText = "";
  let quizCards = [];
  let timerInterval = null;
  let runningSeconds = 0;
  let lastTick = 0;
  let saveTextTimeout = null;

  function saveState() {
    try {
      localStorage.setItem(DESK_APP.storageKey, JSON.stringify(state));
      return true;
    } catch (error) {
      showStatus("This browser couldn't save your changes. Check its storage settings before leaving.");
      return false;
    }
  }

  function formatDate(dateString, options) {
    const parts = dateString.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2], 12);
    return date.toLocaleDateString(undefined, options || { month: "short", day: "numeric" });
  }

  function renderDate() {
    $("#today-label").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric"
    });
  }

  const menuToggle = $("#menu-toggle");
  const menu = $("#main-menu");

  function closeMenu() {
    menu.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
  }

  function showScreen(name) {
    currentScreen = name;
    $$("[data-screen]").forEach(function (screen) {
      screen.hidden = screen.dataset.screen !== name;
    });
    $$("[data-screen-link]").forEach(function (button) {
      const active = button.dataset.screenLink === name;
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    closeMenu();
    window.scrollTo(0, 0);
  }

  menuToggle.addEventListener("click", function () {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menu.hidden = isOpen;
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Open menu" : "Close menu");
  });

  $$("[data-screen-link]").forEach(function (button) {
    button.addEventListener("click", function () {
      showScreen(button.dataset.screenLink);
    });
  });

  $$("[data-scroll-to]").forEach(function (button) {
    button.addEventListener("click", function () {
      if (currentScreen !== "home") showScreen("home");
      else closeMenu();
      window.setTimeout(function () {
        $("#study-time").scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
    });
  });

  $$("[data-home-link]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      showScreen("home");
    });
  });

  document.addEventListener("click", function (event) {
    if (!menu.hidden && !menu.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !menu.hidden) {
      closeMenu();
      menuToggle.focus();
    }
  });

  const boardText = $("#board-text");
  const canvas = $("#drawing-layer");
  const context = canvas.getContext("2d");
  let boardMode = "type";
  let activeStroke = null;

  boardText.textContent = state.boardText;

  function saveBoardText() {
    state.boardText = boardText.textContent;
    window.clearTimeout(saveTextTimeout);
    saveTextTimeout = window.setTimeout(saveState, 250);
  }

  boardText.addEventListener("input", saveBoardText);

  function setBoardMode(mode) {
    boardMode = mode;
    canvas.classList.toggle("drawing-enabled", mode !== "type");
    boardText.contentEditable = mode === "type" ? "true" : "false";
    $("#type-tool").classList.toggle("selected", mode === "type");
    $("#draw-tool").classList.toggle("selected", mode === "draw");
    $("#erase-tool").classList.toggle("selected", mode === "erase");
    $("#type-tool").setAttribute("aria-pressed", String(mode === "type"));
    $("#draw-tool").setAttribute("aria-pressed", String(mode === "draw"));
    $("#erase-tool").setAttribute("aria-pressed", String(mode === "erase"));
  }

  $("#type-tool").addEventListener("click", function () { setBoardMode("type"); });
  $("#draw-tool").addEventListener("click", function () { setBoardMode("draw"); });
  $("#erase-tool").addEventListener("click", function () { setBoardMode("erase"); });

  function drawStroke(stroke, width, height) {
    if (!stroke.points.length) return;
    context.save();
    context.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    context.strokeStyle = stroke.erase ? "#000" : stroke.color;
    context.fillStyle = stroke.erase ? "#000" : stroke.color;
    context.lineWidth = stroke.width || 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    const first = stroke.points[0];
    context.beginPath();
    context.moveTo(first.x * width, first.y * height);
    stroke.points.slice(1).forEach(function (point) {
      context.lineTo(point.x * width, point.y * height);
    });
    if (stroke.points.length === 1) {
      context.arc(first.x * width, first.y * height, context.lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.stroke();
    }
    context.restore();
  }

  function renderStrokes() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    state.strokes.forEach(function (stroke) {
      drawStroke(stroke, rect.width, rect.height);
    });
    if (activeStroke) drawStroke(activeStroke, rect.width, rect.height);
  }

  const resizeObserver = new ResizeObserver(renderStrokes);
  resizeObserver.observe($("#whiteboard"));
  window.addEventListener("resize", renderStrokes);

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  }

  canvas.addEventListener("pointerdown", function (event) {
    if (boardMode === "type") return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    activeStroke = {
      color: "#d96f98",
      erase: boardMode === "erase",
      width: boardMode === "erase" ? 22 : 3.5,
      points: [canvasPoint(event)]
    };
    renderStrokes();
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!activeStroke || !canvas.hasPointerCapture(event.pointerId)) return;
    activeStroke.points.push(canvasPoint(event));
    renderStrokes();
  });

  function finishStroke() {
    if (!activeStroke) return;
    state.strokes.push(activeStroke);
    activeStroke = null;
    saveState();
    renderStrokes();
  }
  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointercancel", finishStroke);

  $("#clear-board").addEventListener("click", function () {
    boardText.textContent = "";
    state.boardText = "";
    state.strokes = [];
    saveState();
    renderStrokes();
    showStatus("Your whiteboard is clear.");
  });

  function renderCards() {
    const grid = $("#cards-grid");
    grid.replaceChildren();
    state.cards.forEach(function (card) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "flashcard";
      button.setAttribute("aria-expanded", "false");

      const top = document.createElement("span");
      top.className = "flashcard-top";
      const topic = document.createElement("span");
      topic.className = "card-topic";
      topic.textContent = "FROM YOUR NOTES";
      const hint = document.createElement("span");
      hint.className = "card-flip-hint";
      hint.textContent = "Tap to reveal";
      const question = document.createElement("span");
      question.className = "card-question";
      question.textContent = card.question;
      const answer = document.createElement("span");
      answer.className = "card-answer";
      answer.textContent = card.answer;
      answer.hidden = true;

      top.append(topic, hint);
      button.append(top, question, answer);
      button.addEventListener("click", function () {
        const expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!expanded));
        answer.hidden = expanded;
        hint.textContent = expanded ? "Tap to reveal" : "Tap to hide";
      });
      grid.append(button);
    });
    $("#cards-empty").hidden = state.cards.length > 0;
    $("#card-count").textContent = state.cards.length + (state.cards.length === 1 ? " card" : " cards");
    $("#start-quiz").disabled = state.cards.length === 0;
    $("#last-score").textContent = state.lastQuiz
      ? "Last score: " + state.lastQuiz.score + " / " + state.lastQuiz.total
      : "";
  }

  function extractDefinitions(text) {
    const definitions = [];
    const lines = text.split(/\r?\n/);
    const definitionPattern = /^(.{1,100}?)\s+(is defined as|refers to|is the process of|is)\s+(.+?)[.!?]*$/i;

    lines.forEach(function (line) {
      const sentences = line.match(/[^.!?]+[.!?]?/g) || [];
      sentences.forEach(function (sentence) {
        const cleaned = sentence.trim().replace(/^[*•\-]\s*/, "");
        const match = cleaned.match(definitionPattern);
        if (!match) return;

        const sourceTerm = match[1].trim();
        const term = sourceTerm.replace(/^(?:the|a|an)\s+/i, "");
        const definition = match[3].trim().replace(/[.!?]+$/, "");
        if (!term || !definition) return;

        const question = "What is " + term + "?";
        if (definitions.some(function (item) { return item.question.toLowerCase() === question.toLowerCase(); })) return;

        const relation = match[2].toLowerCase();
        definitions.push({
          id: makeId(),
          question: question,
          answer: sourceTerm + " " + relation + " " + definition + ".",
          term: term,
          cloze: "_____ " + relation + " " + definition + "."
        });
      });
    });
    return definitions;
  }

  $("#study-file").addEventListener("change", async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showStatus("Choose a text file smaller than 1 MB.");
      event.target.value = "";
      return;
    }
    try {
      studyFileText = await file.text();
      $("#study-source").value = studyFileText;
      $("#study-file-label").textContent = file.name;
      showStatus("Notes read in this browser. The file wasn't uploaded.");
    } catch (error) {
      studyFileText = "";
      $("#study-file-label").textContent = "Could not read that file";
      showStatus("This file couldn't be read. Try a plain-text, Markdown, or CSV file.");
    }
  });

  $("#make-cards").addEventListener("click", function () {
    const text = $("#study-source").value.trim() || studyFileText;
    if (!text) {
      showStatus("Paste some class notes or choose a text file first.");
      $("#study-source").focus();
      return;
    }

    const extracted = extractDefinitions(text);
    if (extracted.length === 0) {
      showStatus("No definition found. Try a sentence like “Photosynthesis is the process of...”");
      return;
    }

    const existing = new Set(state.cards.map(function (card) { return card.question.toLowerCase(); }));
    const newCards = extracted.filter(function (card) { return !existing.has(card.question.toLowerCase()); });
    if (newCards.length === 0) {
      showStatus("Those study cards are already in your set.");
      showScreen("practice");
      return;
    }
    state.cards = newCards.concat(state.cards).slice(0, 80);
    saveState();
    renderCards();
    showScreen("practice");
    showStatus(newCards.length + " " + (newCards.length === 1 ? "card is" : "cards are") + " ready. Start a short quiz when you like.");
  });

  function normalizeAnswer(value) {
    return value.toLowerCase().trim().replace(/^(?:the|a|an)\s+/i, "").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ");
  }

  function startQuiz() {
    if (state.cards.length === 0) return;
    quizCards = state.cards.slice(0, 5);
    const form = $("#quiz-form");
    form.replaceChildren();
    quizCards.forEach(function (card, index) {
      const question = document.createElement("label");
      question.className = "quiz-question";
      const prompt = document.createElement("span");
      prompt.textContent = (index + 1) + ". " + card.cloze;
      const input = document.createElement("input");
      input.type = "text";
      input.name = "answer-" + index;
      input.autocomplete = "off";
      input.setAttribute("aria-label", "Answer for question " + (index + 1));
      question.append(prompt, input);
      form.append(question);
    });
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "button button-pink";
    submit.textContent = "Check my answers";
    form.append(submit);
    form.hidden = false;
    $("#quiz-result").textContent = "";
    $("#quiz-intro").textContent = "Answer each blank with the missing term.";
    form.querySelector("input").focus();
  }

  $("#start-quiz").addEventListener("click", startQuiz);
  $("#quiz-form").addEventListener("submit", function (event) {
    event.preventDefault();
    if (quizCards.length === 0) return;
    let score = 0;
    quizCards.forEach(function (card, index) {
      const input = $("#quiz-form").elements.namedItem("answer-" + index);
      const correct = normalizeAnswer(input.value) === normalizeAnswer(card.term);
      if (correct) score += 1;
      input.classList.toggle("answer-correct", correct);
      input.classList.toggle("answer-incorrect", !correct);
      input.disabled = true;
      const feedback = document.createElement("span");
      feedback.className = "answer-feedback";
      feedback.textContent = correct ? "Correct!" : "Answer: " + card.term;
      input.after(feedback);
    });
    $("#quiz-result").textContent = "Your score: " + score + " / " + quizCards.length;
    state.lastQuiz = { score: score, total: quizCards.length, completedAt: new Date().toISOString() };
    saveState();
    renderCards();
  });

  function sortedTasks(includeCompleted) {
    return state.tasks.filter(function (task) {
      return includeCompleted || !task.completed;
    }).sort(function (first, second) {
      return first.date.localeCompare(second.date) || first.title.localeCompare(second.title);
    });
  }

  function renderCalendar() {
    const list = $("#calendar-list");
    list.replaceChildren();
    const tasks = sortedTasks(true);
    const months = new Map();
    tasks.forEach(function (task) {
      const monthKey = task.date.slice(0, 7);
      if (!months.has(monthKey)) months.set(monthKey, []);
      months.get(monthKey).push(task);
    });

    months.forEach(function (items, monthKey) {
      const group = document.createElement("section");
      group.className = "month-group";
      const heading = document.createElement("h3");
      heading.textContent = formatDate(monthKey + "-01", { month: "long", year: "numeric" });
      group.append(heading);
      items.forEach(function (task) {
        const row = document.createElement("div");
        row.className = "calendar-item" + (task.completed ? " completed" : "");
        const date = document.createElement("span");
        date.className = "calendar-date";
        date.textContent = formatDate(task.date, { weekday: "short", month: "short", day: "numeric" });
        const title = document.createElement("span");
        title.className = "calendar-task";
        title.textContent = task.title;
        const status = document.createElement("span");
        status.className = "calendar-status";
        status.textContent = task.completed ? "Done" : "To do";
        row.append(date, title, status);
        group.append(row);
      });
      list.append(group);
    });
    $("#calendar-empty").hidden = tasks.length > 0;
    $("#calendar-count").textContent = tasks.length + (tasks.length === 1 ? " date" : " dates");
  }

  function renderTasks() {
    const taskList = $("#task-list");
    taskList.replaceChildren();
    sortedTasks(true).forEach(function (task) {
      const row = document.createElement("div");
      row.className = "task-item" + (task.completed ? " completed" : "");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.className = "task-check";
      check.checked = task.completed;
      check.setAttribute("aria-label", "Mark " + task.title + " complete");
      check.addEventListener("change", function () {
        task.completed = check.checked;
        saveState();
        renderTasks();
        renderCalendar();
      });

      const details = document.createElement("span");
      details.className = "task-details";
      const title = document.createElement("span");
      title.className = "task-name";
      title.textContent = task.title;
      const meta = document.createElement("span");
      meta.className = "task-meta";
      meta.textContent = formatDate(task.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) +
        (task.source ? " · " + task.source : "");
      details.append(title, meta);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-task";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove " + task.title);
      remove.addEventListener("click", function () {
        state.tasks = state.tasks.filter(function (item) { return item.id !== task.id; });
        saveState();
        renderTasks();
        renderCalendar();
      });
      row.append(check, details, remove);
      taskList.append(row);
    });
    const activeCount = sortedTasks(false).length;
    $("#tasks-empty").hidden = state.tasks.length > 0;
    $("#task-count").textContent = activeCount + (activeCount === 1 ? " item left" : " items left");
  }

  $("#task-date").min = DESK_APP.schoolYearStart;
  $("#task-date").max = DESK_APP.schoolYearEnd;
  $("#task-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const title = $("#task-title").value.trim();
    const date = $("#task-date").value;
    if (!title || !validDate(date) || date < DESK_APP.schoolYearStart || date > DESK_APP.schoolYearEnd) {
      showStatus("Add a title and choose a date in the 2026–27 school year.");
      return;
    }
    state.tasks.push({ id: makeId(), title: title, date: date, completed: false, source: "Added by you" });
    saveState();
    event.target.reset();
    renderTasks();
    renderCalendar();
    showStatus("Added to your checklist.");
  });

  function addMonthsClamped(date, count) {
    const targetMonth = date.getMonth() + count;
    const target = new Date(date.getFullYear(), targetMonth, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(date.getDate(), lastDay));
    return target;
  }

  function currentCycle(now) {
    let start = new Date(state.cycleStart);
    if (!Number.isFinite(start.getTime())) start = now;
    let changed = false;
    let next = addMonthsClamped(start, 6);
    while (next <= now) {
      start = next;
      state.cycleStudySeconds = 0;
      next = addMonthsClamped(start, 6);
      changed = true;
    }
    if (changed || state.cycleStart !== start.toISOString()) {
      state.cycleStart = start.toISOString();
      if (changed) saveState();
    }
    return { start: start, next: next };
  }

  function formatDuration(seconds) {
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return totalMinutes + (totalMinutes === 1 ? " minute" : " minutes");
    return hours + " hr " + minutes + " min";
  }

  function formatClock(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    if (hours > 0) {
      return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
    }
    return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
  }

  function renderStudyTime() {
    const now = new Date();
    const cycle = currentCycle(now);
    const hours = state.cycleStudySeconds / 3600;
    let rank;
    if (hours >= 100) rank = { name: "Pink heart", symbol: "♥", className: "heart-pink", next: null };
    else if (hours >= 72) rank = { name: "Red heart", symbol: "♥", className: "heart-red", next: 100 };
    else if (hours >= 40) rank = { name: "Purple heart", symbol: "♥", className: "heart-purple", next: 72 };
    else if (hours >= 24) rank = { name: "White heart", symbol: "♥", className: "heart-white", next: 40 };
    else rank = { name: "Empty heart", symbol: "♡", className: "heart-empty", next: 24 };

    const heart = $("#rank-heart");
    heart.textContent = rank.symbol;
    heart.className = "rank-heart " + rank.className;
    heart.setAttribute("aria-label", rank.name);
    $("#rank-name").textContent = rank.name;
    $("#next-heart").textContent = rank.next === null
      ? "You've reached the highest heart rank!"
      : Math.ceil((rank.next * 3600 - state.cycleStudySeconds) / 3600) + " hours to your next heart";
    $("#study-total").textContent = formatDuration(state.studySeconds);
    $("#cycle-total").textContent = (hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)) + (hours === 1 ? " hour this cycle" : " hours this cycle");
    $("#reset-countdown").textContent = "Resets in " + Math.max(0, Math.ceil((cycle.next.getTime() - now.getTime()) / 86400000)) + " days";
    $("#timer-display").textContent = formatClock(runningSeconds);
    $("#timer-toggle").textContent = timerInterval === null ? "Start studying" : "Pause timer";
  }

  function tickTimer() {
    if (timerInterval === null) return;
    const now = Date.now();
    const elapsed = Math.floor((now - lastTick) / 1000);
    if (elapsed < 1) return;
    lastTick += elapsed * 1000;
    runningSeconds += elapsed;
    currentCycle(new Date(now));
    state.cycleStudySeconds += elapsed;
    state.studySeconds += elapsed;
    renderStudyTime();
    if (state.studySeconds % 10 < elapsed) saveState();
  }

  $("#timer-toggle").addEventListener("click", function () {
    if (timerInterval !== null) {
      tickTimer();
      window.clearInterval(timerInterval);
      timerInterval = null;
      saveState();
    } else {
      lastTick = Date.now();
      timerInterval = window.setInterval(tickTimer, 1000);
    }
    renderStudyTime();
  });

  $("#demo-reset").addEventListener("click", function () {
    state.cycleStudySeconds = 0;
    state.cycleStart = new Date().toISOString();
    saveState();
    renderStudyTime();
    showStatus("Heart rank reset for a new six-month cycle. Your total study time is unchanged.");
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) tickTimer();
  });
  window.addEventListener("beforeunload", function () {
    if (timerInterval !== null) tickTimer();
    saveState();
  });

  document.title = DESK_APP.name;
  renderDate();
  renderStrokes();
  renderCards();
  renderTasks();
  renderCalendar();
  renderStudyTime();
  showScreen("home");
})();
