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

  function dateOffset(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function starterTasks() {
    return STARTER_TASKS.map(function (task) {
      return {
        id: makeId(),
        title: task.title,
        date: dateOffset(task.dayOffset),
        completed: false,
        source: "A gentle nudge"
      };
    });
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(DESK_APP.storageKey);
      if (saved === null) {
        return { notes: [], cards: [], tasks: starterTasks(), studySeconds: 0 };
      }

      const parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.notes) ||
          !Array.isArray(parsed.cards) || !Array.isArray(parsed.tasks)) {
        throw new Error("Saved data has an unexpected format.");
      }

      return {
        notes: parsed.notes,
        cards: parsed.cards,
        tasks: parsed.tasks,
        studySeconds: Number.isFinite(parsed.studySeconds) && parsed.studySeconds >= 0
          ? parsed.studySeconds
          : 0
      };
    } catch (error) {
      showStatus("We couldn't read saved study data. Your new changes will be saved in this browser.");
      return { notes: [], cards: [], tasks: starterTasks(), studySeconds: 0 };
    }
  }

  const state = loadState();
  let studyFileText = "";
  let importCandidates = [];
  let timerInterval = null;
  let runningSeconds = 0;

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

  function isInSchoolYear(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) ||
        dateString < DESK_APP.schoolYearStart ||
        dateString > DESK_APP.schoolYearEnd) return false;
    const parts = dateString.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2], 12);
    return date.getFullYear() === parts[0] &&
      date.getMonth() === parts[1] - 1 &&
      date.getDate() === parts[2];
  }

  function renderDate() {
    const now = new Date();
    $("#today-label").textContent = now.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric"
    });
    $("#date-stamp").textContent = now.toLocaleDateString(undefined, {
      weekday: "short", month: "short", day: "numeric"
    });
  }

  function showScreen(name) {
    $$("[data-screen]").forEach(function (screen) {
      screen.hidden = screen.dataset.screen !== name;
    });
    $$("[data-screen-link]").forEach(function (button) {
      const active = button.dataset.screenLink === name;
      button.classList.toggle("active", active);
      if (active) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
    window.scrollTo(0, 0);
  }

  $$("[data-screen-link]").forEach(function (button) {
    button.addEventListener("click", function () {
      showScreen(button.dataset.screenLink);
    });
  });
  $$("[data-open-screen]").forEach(function (button) {
    button.addEventListener("click", function () {
      showScreen(button.dataset.openScreen);
    });
  });

  function renderNotes() {
    const grid = $("#notes-grid");
    grid.replaceChildren();
    state.notes.forEach(function (note) {
      const article = document.createElement("article");
      article.className = "sticky-note";
      article.append(document.createTextNode(note.text));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-note";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove note");
      remove.addEventListener("click", function () {
        state.notes = state.notes.filter(function (item) { return item.id !== note.id; });
        saveState();
        renderNotes();
      });

      const time = document.createElement("span");
      time.className = "note-time";
      time.textContent = note.createdAt ? formatDate(note.createdAt.slice(0, 10)) : "A thought for later";
      article.append(remove, time);
      grid.append(article);
    });
    $("#notes-empty").hidden = state.notes.length > 0;
  }

  $("#note-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const input = $("#note-input");
    const text = input.value.trim();
    if (!text) {
      showStatus("Add a thought before pinning it to your board.");
      input.focus();
      return;
    }
    state.notes.unshift({ id: makeId(), text: text, createdAt: new Date().toISOString() });
    saveState();
    input.value = "";
    renderNotes();
    showStatus("Your note is on the board.");
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
    $("#card-count").textContent = String(state.cards.length);
  }

  function extractDefinitions(text) {
    const definitions = [];
    const lines = text.split(/\r?\n/);
    const definitionPattern = /^(.{2,80}?)\s+(is defined as|refers to|is the process of|is)\s+(.+?)[.!?]?$/i;

    lines.forEach(function (line) {
      const cleaned = line.trim().replace(/^[*•\-]\s*/, "");
      const match = cleaned.match(definitionPattern);
      if (!match) return;

      const sourceTerm = match[1].trim();
      const questionTerm = sourceTerm.replace(/^(?:the|a|an)\s+/i, "");
      const definition = match[3].trim().replace(/[.!?]+$/, "");
      if (!questionTerm || !definition) return;

      const question = "What is " + questionTerm + "?";
      if (definitions.some(function (item) { return item.question === question; })) return;

      definitions.push({
        id: makeId(),
        question: question,
        answer: sourceTerm + " " + match[2].toLowerCase() + " " + definition + "."
      });
    });
    return definitions;
  }

  $("#study-file").addEventListener("change", async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showStatus("Choose a text file smaller than 1 MB for this preview.");
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

    const cards = extractDefinitions(text);
    if (cards.length === 0) {
      showStatus("No definition pattern found. Try a line like “Photosynthesis is the process of...”");
      return;
    }

    const existing = new Set(state.cards.map(function (card) { return card.question; }));
    const newCards = cards.filter(function (card) { return !existing.has(card.question); });
    if (newCards.length === 0) {
      showStatus("Those study cards are already in your set.");
      return;
    }
    state.cards = newCards.concat(state.cards).slice(0, 60);
    saveState();
    renderCards();
    showScreen("cards");
    showStatus(newCards.length + " study " + (newCards.length === 1 ? "card is" : "cards are") + " ready. Tap one to reveal the answer.");
  });

  function taskDateLabel(task) {
    const today = dateOffset(0);
    const tomorrow = dateOffset(1);
    if (task.date === today) return "Due today";
    if (task.date === tomorrow) return "Due tomorrow";
    return formatDate(task.date, { weekday: "short", month: "short", day: "numeric" });
  }

  function sortedTasks(includeCompleted) {
    return state.tasks.filter(function (task) {
      return includeCompleted || !task.completed;
    }).sort(function (first, second) {
      return first.date.localeCompare(second.date);
    });
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
      check.checked = Boolean(task.completed);
      check.setAttribute("aria-label", "Mark " + task.title + " complete");
      check.addEventListener("change", function () {
        task.completed = check.checked;
        saveState();
        renderTasks();
      });

      const details = document.createElement("span");
      details.className = "task-details";
      const title = document.createElement("span");
      title.className = "task-name";
      title.textContent = task.title;
      const meta = document.createElement("span");
      meta.className = "task-meta";
      meta.textContent = formatDate(task.date, { weekday: "long", month: "long", day: "numeric" }) +
        (task.source ? "  ·  " + task.source : "");
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
      });
      row.append(check, details, remove);
      taskList.append(row);
    });

    const upcoming = sortedTasks(false).slice(0, 3);
    const miniList = $("#mini-task-list");
    miniList.replaceChildren();
    upcoming.forEach(function (task) {
      const item = document.createElement("div");
      item.className = "mini-task";
      const dot = document.createElement("span");
      dot.className = "task-dot";
      dot.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span");
      copy.className = "mini-task-copy";
      const title = document.createElement("span");
      title.className = "mini-task-title";
      title.textContent = task.title;
      const date = document.createElement("span");
      date.className = "mini-task-date";
      date.textContent = taskDateLabel(task);
      copy.append(title, date);
      item.append(dot, copy);
      miniList.append(item);
    });

    $("#tasks-empty").hidden = state.tasks.length > 0;
    $("#mini-task-empty").hidden = upcoming.length > 0;
    const activeCount = sortedTasks(false).length;
    $("#task-count").textContent = activeCount + (activeCount === 1 ? " item" : " items");
  }

  $("#task-date").min = DESK_APP.schoolYearStart;
  $("#task-date").max = DESK_APP.schoolYearEnd;
  $("#task-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const title = $("#task-title").value.trim();
    const date = $("#task-date").value;
    if (!title || !isInSchoolYear(date)) {
      showStatus("Add a title and choose a date in the 2026–27 school year.");
      return;
    }
    state.tasks.push({ id: makeId(), title: title, date: date, completed: false, source: "Added by you" });
    saveState();
    event.target.reset();
    renderTasks();
    showStatus("Added to your checklist.");
  });

  function unfoldCalendar(text) {
    return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  }

  function unescapeCalendarText(text) {
    return text.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
  }

  function readCalendarEvents(text) {
    const candidates = [];
    if (!/BEGIN:VCALENDAR/i.test(text)) {
      text.split(/\r?\n/).forEach(function (line) {
        const cleaned = line.trim();
        const match = cleaned.match(/^(.{2,100}?)\s*(?:[:,\u2013\u2014-]\s*)?(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s*[.:]?\s*$/);
        if (!match) return;

        let date = match[2];
        if (date.indexOf("/") !== -1) {
          const parts = date.split("/");
          date = parts[2] + "-" + parts[0].padStart(2, "0") + "-" + parts[1].padStart(2, "0");
        }
        const title = match[1].replace(/[\s,:;\u2013\u2014-]+$/, "").trim();
        if (title && isInSchoolYear(date)) {
          candidates.push({
            id: makeId(),
            title: title,
            date: date,
            completed: false,
            source: "Syllabus import"
          });
        }
      });
      return candidates;
    }

    let current = null;
    unfoldCalendar(text).split("\n").forEach(function (line) {
      if (line === "BEGIN:VEVENT") {
        current = {};
      } else if (line === "END:VEVENT" && current) {
        if (current.title && current.date && isInSchoolYear(current.date)) {
          candidates.push({
            id: makeId(),
            title: current.title,
            date: current.date,
            completed: false,
            source: "Calendar import"
          });
        }
        current = null;
      } else if (current) {
        const summary = line.match(/^SUMMARY(?:;[^:]*)?:(.*)$/i);
        const start = line.match(/^DTSTART(?:;[^:]*)?:(\d{4})(\d{2})(\d{2})/i);
        if (summary) current.title = unescapeCalendarText(summary[1]).trim();
        if (start) current.date = start[1] + "-" + start[2] + "-" + start[3];
      }
    });
    return candidates;
  }

  function renderImportPreview() {
    const preview = $("#import-preview");
    preview.replaceChildren();
    preview.hidden = importCandidates.length === 0;
    if (importCandidates.length === 0) return;

    const heading = document.createElement("p");
    heading.textContent = "Review these dates before adding:";
    preview.append(heading);
    importCandidates.forEach(function (candidate) {
      const row = document.createElement("div");
      row.className = "import-candidate";
      const detail = document.createElement("span");
      detail.textContent = candidate.title + " · " + formatDate(candidate.date, { month: "short", day: "numeric", year: "numeric" });
      const add = document.createElement("button");
      add.type = "button";
      add.textContent = "Add to checklist";
      add.addEventListener("click", function () {
        state.tasks.push(candidate);
        importCandidates = importCandidates.filter(function (item) { return item.id !== candidate.id; });
        saveState();
        renderTasks();
        renderImportPreview();
        showStatus("Calendar date added to your checklist.");
      });
      row.append(detail, add);
      preview.append(row);
    });
  }

  $("#calendar-file").addEventListener("change", async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      showStatus("Choose a calendar file smaller than 1 MB for this preview.");
      event.target.value = "";
      return;
    }
    $("#calendar-file-label").textContent = file.name;
    try {
      const candidates = readCalendarEvents(await file.text());
      const existing = new Set(state.tasks.map(function (task) {
        return task.title.toLowerCase() + "|" + task.date;
      }));
      importCandidates = candidates.filter(function (candidate) {
        return !existing.has(candidate.title.toLowerCase() + "|" + candidate.date);
      });
      renderImportPreview();
      if (importCandidates.length === 0) {
        showStatus("No new 2026–27 dates found. Use an .ics export or lines like “Essay due: 2026-12-10”.");
      } else {
        showStatus(importCandidates.length + " calendar " + (importCandidates.length === 1 ? "date is" : "dates are") + " ready for review.");
      }
    } catch (error) {
      $("#calendar-file-label").textContent = "Could not read that file";
      showStatus("This calendar file couldn't be read. Please choose a valid .ics export.");
    }
  });

  function renderTimer() {
    const minutes = Math.floor(runningSeconds / 60);
    const seconds = runningSeconds % 60;
    $("#timer-display").textContent = String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    $("#sidebar-study-time").textContent = Math.floor(state.studySeconds / 60) + " min";
  }

  $("#timer-toggle").addEventListener("click", function () {
    if (timerInterval !== null) {
      window.clearInterval(timerInterval);
      timerInterval = null;
      $("#timer-label").textContent = "Resume focus";
      saveState();
      return;
    }

    $("#timer-label").textContent = "Pause session";
    timerInterval = window.setInterval(function () {
      runningSeconds += 1;
      state.studySeconds += 1;
      renderTimer();
      if (state.studySeconds % 15 === 0) saveState();
    }, 1000);
  });

  window.addEventListener("beforeunload", saveState);
  document.title = DESK_APP.name;
  renderDate();
  renderNotes();
  renderCards();
  renderTasks();
  renderTimer();
  renderImportPreview();
  showScreen("desk");
})();
