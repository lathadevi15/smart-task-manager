// ── Elements ──────────────────────────────────────────────
const input       = document.getElementById("taskInput");
const button      = document.getElementById("addBtn");
const taskList          = document.getElementById("taskList");          // Dashboard recent-activity list
const totalTaskList     = document.getElementById("totalTaskList");     // Total Tasks list
const completedTaskList = document.getElementById("completedTaskList"); // Completed list
const pendingTaskList   = document.getElementById("pendingTaskList");   // Pending list
const totalTasksSearchInput = document.getElementById("totalTasksSearchInput"); // Total Tasks search
const dueDateInput = document.getElementById("dueDate");
const overdueTaskList = document.getElementById("overdueTaskList");

// Custom Dropdown
const customSelect = document.querySelector(".custom-select");
const selected     = document.querySelector(".selected span:first-child");
const options      = document.querySelectorAll(".options li");

// ── State ─────────────────────────────────────────────────
let tasks            = [];
let totalTasksFilter  = "all";     // for Total Tasks tab
let selectedPriority = "";
let taskStatusChart = null;
let dailyCompletionChart = null;
let weeklyTrendChart = null;
let monthlyTrendChart = null;
let priorityDistributionChart = null;

// Selected date range per Overview card tab (null = "All Time").
// Each entry is either null or { start: Date, end: Date } (midnight-normalized).
let overviewRanges = { totalTasks: null, completed: null, pending: null, overdue: null };
let taskStatusRange = null;         // null = "All Time"
let weeklyTrendRange = null;        // null = default "Last 4 Weeks" behavior
let priorityDistributionRange = null; // null = "All Time"
let heatmapCustomRange = null;      // set once the user picks dates via "Custom Range"
let dailyCompletionRange = null;    // null = default "This Week" (Mon-Sun) behavior

// Pagination state per Overview card list — default 10 tasks per page.
let listPagination = {
  totalTasks: { page: 1, perPage: 10 },
  completed:  { page: 1, perPage: 10 },
  pending:    { page: 1, perPage: 10 },
  overdue:    { page: 1, perPage: 10 }
};

// ── Dropdown ──────────────────────────────────────────────
document.querySelector(".selected").addEventListener("click", (e) => {
  e.stopPropagation();
  customSelect.classList.toggle("active");
});

options.forEach(option => {
  option.addEventListener("click", (e) => {
    e.stopPropagation();
    selected.textContent  = option.textContent;
    selectedPriority      = option.dataset.value;
    customSelect.classList.remove("active");
  });
});

document.addEventListener("click", (e) => {
  if (!customSelect.contains(e.target)) {
    customSelect.classList.remove("active");
  }
});

// ── Add Task ──────────────────────────────────────────────
button.addEventListener("click", addTask);
input.addEventListener("keypress", (e) => { if (e.key === "Enter") addTask(); });

function addTask() {
  const taskText = input.value.trim();
  if (taskText === "") { alert("Please enter a task"); return; }

  tasks.push({
    text: taskText,
    completed: false,
    priority: selectedPriority,
    dueDate: dueDateInput.value,
    createdAt: new Date().toISOString(),
    completedAt: null
  });
  saveToLocalStorage();
  renderTasks();

  input.value        = "";
  dueDateInput.value = "";
  selected.textContent = "No Priority";
  selectedPriority     = "";
}

// ── Storage ───────────────────────────────────────────────
function saveToLocalStorage() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function loadTasks() {
  const data = localStorage.getItem("tasks");
  if (data) tasks = JSON.parse(data);
}

// ── Build a single <li> for a task ────────────────────────
function buildTaskItem(task) {
  const li = document.createElement("li");
  li.classList.add("task-item");

  // Left: checkbox + text
  const leftDiv = document.createElement("div");
  leftDiv.classList.add("task-left");

  const checkbox = document.createElement("input");
  checkbox.type  = "checkbox";
  checkbox.classList.add("task-checkbox");
  checkbox.checked = task.completed;
  checkbox.addEventListener("change", () => {
    task.completed = !task.completed;
    // Track when a task was completed so we can chart daily completions.
    // Clearing it when a task is un-checked keeps the chart accurate.
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveToLocalStorage();
    renderTasks();
  });

  const span = document.createElement("span");
  span.classList.add("task-text");

  const due = document.createElement("small");
  due.classList.add("task-due");
  if (task.completed && task.completedAt) {
    const formattedCompleted = new Date(task.completedAt).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    due.innerText = "Completed at: " + formattedCompleted;
  } else if (task.dueDate) {
    const formatted = new Date(task.dueDate).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    due.innerText = "Due: " + formatted;
  }

  const dueDate = new Date(task.dueDate);
  if (!task.completed && dueDate < new Date()) {
    due.style.color = "red";
  }

  span.innerText = task.text;
  if (task.completed) span.classList.add("completed");

  const textWrapper = document.createElement("div");
  textWrapper.appendChild(span);
  if ((task.completed && task.completedAt) || task.dueDate) {
    textWrapper.appendChild(due);
  }

  leftDiv.appendChild(checkbox);
  leftDiv.appendChild(textWrapper);

  // Right: priority badge + edit + delete
  const rightDiv = document.createElement("div");
  rightDiv.classList.add("task-right");

  const priorityBadge = document.createElement("span");
  priorityBadge.classList.add("priority-badge");
  if (task.priority) {
    priorityBadge.innerText = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    priorityBadge.classList.add(task.priority);
  } else {
    priorityBadge.innerText = "No Priority";
    priorityBadge.classList.add("no-priority");
  }

  const editBtn = document.createElement("button");
  editBtn.classList.add("edit-btn");
  editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i> Edit';
  editBtn.onclick = () => {
    const newText = prompt("Edit task:", task.text);
    if (newText !== null && newText.trim() !== "") {
      task.text = newText.trim();
      saveToLocalStorage();
      renderTasks();
    }
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.classList.add("delete-btn");
  deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
  deleteBtn.onclick = () => {
    tasks.splice(tasks.indexOf(task), 1);
    saveToLocalStorage();
    renderTasks();
  };

  // Created date badge
  const createdBadge = document.createElement("span");
  createdBadge.classList.add("created-badge");
  if (task.createdAt) {
    const formatted = new Date(task.createdAt).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
    createdBadge.innerText = formatted;
  } else {
    createdBadge.innerText = "—";
  }

  rightDiv.appendChild(createdBadge);
  rightDiv.appendChild(priorityBadge);
  rightDiv.appendChild(editBtn);
  rightDiv.appendChild(deleteBtn);

  li.appendChild(leftDiv);
  li.appendChild(rightDiv);
  return li;
}

// ── Populate a <ul> with a filtered task array ─────────────
// dateRange/dateField are optional: when provided, only tasks whose
// dateField falls within [dateRange.start, dateRange.end] are kept.
// Maps a pagination state key to the HTML id prefix used by its controls.
const paginationIdPrefixes = {
  totalTasks: "totalTaskList",
  completed: "completedTaskList",
  pending: "pendingTaskList",
  overdue: "overdueTaskList"
};

function renderPaginationControls(key, totalItems, page, totalPages) {
  const idPrefix = paginationIdPrefixes[key];
  if (!idPrefix) return;

  const infoEl = document.getElementById(`${idPrefix}PageInfo`);
  const prevBtn = document.getElementById(`${idPrefix}PrevBtn`);
  const nextBtn = document.getElementById(`${idPrefix}NextBtn`);

  if (infoEl) {
    infoEl.textContent = totalItems === 0
      ? "No tasks"
      : `Page ${page} of ${totalPages} (${totalItems} task${totalItems === 1 ? "" : "s"})`;
  }
  if (prevBtn) prevBtn.disabled = page <= 1;
  if (nextBtn) nextBtn.disabled = page >= totalPages;
}

function populateList(ulElement, filter, searchText, dateRange = null, dateField = null, paginationKey = null) {
  if (!ulElement) return;
  ulElement.innerHTML = "";

  let filtered = [...tasks];

  if (filter === "completed") filtered = filtered.filter(t => t.completed);
  else if (filter === "pending") filtered = filtered.filter(t => !t.completed);
  else if (filter === "recent") {
    // Reverse to show newest first, then take only the 10 most recent
    filtered = [...tasks].reverse().slice(0, 10);
  }
  else if (filter === "overdue") {
  const now = new Date();
  filtered = filtered.filter(t => !t.completed && t.dueDate && new Date(t.dueDate) < now);
}

  if (dateRange && dateField) {
    filtered = filtered.filter(t => {
      const raw = t[dateField];
      if (!raw) return false;
      const d = new Date(raw);
      d.setHours(0, 0, 0, 0);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }

  if (searchText) {
    filtered = filtered.filter(t => t.text.toLowerCase().includes(searchText.toLowerCase()));
  }

  let itemsToRender = filtered;

  if (paginationKey && listPagination[paginationKey]) {
    const state = listPagination[paginationKey];
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / state.perPage));

    // Clamp in case a filter/search/range change left the page out of bounds.
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    const startIdx = (state.page - 1) * state.perPage;
    itemsToRender = filtered.slice(startIdx, startIdx + state.perPage);

    renderPaginationControls(paginationKey, totalItems, state.page, totalPages);
  }

  itemsToRender.forEach(task => ulElement.appendChild(buildTaskItem(task)));

  
}

// ── Render ALL tabs at once ────────────────────────────────
function renderTasks() {
  const totalTasksSearch = totalTasksSearchInput ? totalTasksSearchInput.value : "";

  // Dashboard — Recent Activity (last 10 tasks, newest first)
  populateList(taskList, "recent", "");

  // Total Tasks tab (ranged by createdAt, paginated)
  populateList(totalTaskList, totalTasksFilter, totalTasksSearch, overviewRanges.totalTasks, "createdAt", "totalTasks");

  // Completed tab — always shows only completed (ranged by completedAt, paginated)
  populateList(completedTaskList, "completed", "", overviewRanges.completed, "completedAt", "completed");

  // Pending tab — always shows only pending (ranged by createdAt, paginated)
  populateList(pendingTaskList, "pending", "", overviewRanges.pending, "createdAt", "pending");

  // Overdue tab (ranged by dueDate, paginated)
  populateList(overdueTaskList, "overdue", "", overviewRanges.overdue, "dueDate", "overdue");

  updateStats();
}

// ── Stats ─────────────────────────────────────────────────
// Range-aware counters for the Overview cards (Total/Completed/Pending/
// Overdue). A null range means "All Time" — matches prior behavior.
function isWithinRange(rawDate, range) {
  if (!range) return true;
  if (!rawDate) return false;
  const d = new Date(rawDate);
  d.setHours(0, 0, 0, 0);
  return d >= range.start && d <= range.end;
}

function countTotalInRange(range) {
  return tasks.filter(t => isWithinRange(t.createdAt, range)).length;
}

function countCompletedInRange(range) {
  return tasks.filter(t => t.completed && isWithinRange(t.completedAt, range)).length;
}

function countPendingInRange(range) {
  return tasks.filter(t => !t.completed && isWithinRange(t.createdAt, range)).length;
}

function countOverdueInRange(range) {
  const now = new Date();
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    if (new Date(t.dueDate) >= now) return false;
    return isWithinRange(t.dueDate, range);
  }).length;
}

function updateStats() {
  const total       = tasks.length;
  const completed   = tasks.filter(t => t.completed).length;
  const pending     = tasks.filter(t => !t.completed).length;
  const highPending = tasks.filter(t => t.priority === "high" && !t.completed).length;

  // Dashboard cards
  const totalCountEl        = document.getElementById("totalCount");
const completedCountDashboard = document.getElementById("completedCountAlt");
const pendingCountDashboard   = document.getElementById("pendingCountAlt");

const completedCountTab = document.getElementById("completedCount");
const pendingCountTab   = document.getElementById("pendingCount");
  const highPriorityCountEl = document.getElementById("highPriorityCount");

  if (totalCountEl)        totalCountEl.textContent        = total;
// Dashboard cards
if (completedCountDashboard)
    completedCountDashboard.textContent = completed;

if (pendingCountDashboard)
    pendingCountDashboard.textContent = pending;

// Completed/Pending tabs
if (completedCountTab)
    completedCountTab.textContent = countCompletedInRange(overviewRanges.completed);

if (pendingCountTab)
    pendingCountTab.textContent = countPendingInRange(overviewRanges.pending);
  if (highPriorityCountEl) highPriorityCountEl.textContent = highPending;









  // Total Tasks tab's own card (separate id to avoid duplicate-id clash with dashboard)
  const totalCountAltEl = document.getElementById("totalCountAlt");
  if (totalCountAltEl) totalCountAltEl.textContent = countTotalInRange(overviewRanges.totalTasks);

  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  const completedPercentEl = document.getElementById("completedPercent");
  const pendingPercentEl   = document.getElementById("pendingPercent");

  if (completedPercentEl) completedPercentEl.textContent = `${pct(completed)}% of total`;
  if (pendingPercentEl)   pendingPercentEl.textContent   = `${pct(pending)}% of total`;

  const overdue = tasks.filter(task => {

    if(task.completed) return false;

    if(!task.dueDate) return false;

    return new Date(task.dueDate) < new Date();

}).length;
const taskStatusCompleted = countCompletedInRange(taskStatusRange);
const taskStatusPending   = countPendingInRange(taskStatusRange);
const taskStatusOverdue   = countOverdueInRange(taskStatusRange);
updateTaskStatusChart(
    taskStatusCompleted,
    taskStatusPending,
    taskStatusOverdue
);

const overdueCountEl = document.getElementById("overdueCount");
if (overdueCountEl) overdueCountEl.textContent = countOverdueInRange(overviewRanges.overdue);

updateDailyCompletionChart();
updateWeeklyTrendChart();
updatePriorityDistributionChart();
updateMonthlyTrendChart();
updateHeatmap();
refreshBestDay();
updateRecentActivity();
updateCompletionRate();
}

function updateTaskStatusChart(completed, pending, overdue) {
  const canvas = document.getElementById("taskStatusChart");
  if (!canvas) return; // tab markup not present, skip safely

  const ctx = canvas.getContext("2d");
  const data = [completed, pending, overdue];
  const total = completed + pending + overdue;

  if (taskStatusChart) {
    // Chart already exists — update in place instead of recreating it
    taskStatusChart.data.datasets[0].data = data;
    taskStatusChart.update();
    return;
  }

  taskStatusChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Completed", "Pending", "Overdue"],
      datasets: [{
        data: data,
        backgroundColor: ["#28a745", "#ffc107", "#dc3545"],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            generateLabels: (chart) => {
              const ds = chart.data.datasets[0].data;
              const sum = ds.reduce((a, b) => a + b, 0);
              return chart.data.labels.map((label, i) => {
                const value = ds[i];
                const pct = sum > 0 ? Math.round((value / sum) * 100) : 0;
                return {
                  text: `${label}: ${pct}%`,
                  fillStyle: chart.data.datasets[0].backgroundColor[i],
                  index: i
                };
              });
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.raw;
              const sum = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = sum > 0 ? Math.round((value / sum) * 100) : 0;
              return `${context.label}: ${value} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ── Daily Completion chart ──────────────────────────────────
// Answers: "How many tasks did I complete every day?" for the current
// week (Monday → Sunday), based on each task's completedAt timestamp.
function computeWeeklyCompletionCounts() {
  const now = new Date();

  // Find this week's Monday (start of day), treating Sunday as day 7.
  const dayIndex = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - dayIndex);

  const counts = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun

  tasks.forEach(task => {
    if (!task.completed || !task.completedAt) return;
    const completedDate = new Date(task.completedAt);
    const diffDays = Math.floor((completedDate - monday) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) {
      counts[diffDays]++;
    }
  });

  return counts;
}

// Custom range mode: reuses the SAME helpers the Heatmap already built —
// generateDateRangeArray() to list every day, groupCompletedTasksByDate()
// to count completions per day, formatHeatmapDateKey() to match them up.
// This is the "good function" — it doesn't reinvent date math, it just
// asks for a day-by-day count over an arbitrary range and re-labels it.
function computeDailyCompletionForRange(range) {
  const dates = generateDateRangeArray(range.start, range.end);
  const counts = groupCompletedTasksByDate(range.start, range.end);

  const labels = dates.map(d => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }));
  const data = dates.map(d => counts[formatHeatmapDateKey(d)] || 0);

  return { labels, data };
}

function updateDailyCompletionChart() {
  const canvas = document.getElementById("dailyCompletionChart");
  if (!canvas) return; // tab markup not present, skip safely

  const ctx = canvas.getContext("2d");
  let labels, data;

  if (dailyCompletionRange) {
    const result = computeDailyCompletionForRange(dailyCompletionRange);
    labels = result.labels;
    data = result.data;
  } else {
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    data = computeWeeklyCompletionCounts();
  }

  if (dailyCompletionChart) {
    dailyCompletionChart.data.labels = labels;
    dailyCompletionChart.data.datasets[0].data = data;
    dailyCompletionChart.update();
    return;
  }

  dailyCompletionChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Tasks Completed",
        data: data,
        borderColor: "#28a745",
        backgroundColor: "rgba(40, 167, 69, 0.15)",
        pointBackgroundColor: "#28a745",
        pointRadius: 4,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Completed: ${context.raw}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: "Tasks Completed" }
        }
      }
    }
  });
}

// ── Weekly Trend chart ───────────────────────────────────────
// Default: "How many tasks did I complete each of the last 4 weeks?"
// Week 4 is the current week (Mon→Sun), Week 1 is 3 weeks before that.
function computeWeeklyTrendCounts() {
  const now = new Date();

  // Start of the current week (Monday, 00:00).
  const dayIndex = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const currentWeekStart = new Date(now);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(currentWeekStart.getDate() - dayIndex);

  // Start of each of the last 4 weeks, oldest first.
  const weekStarts = [3, 2, 1, 0].map(weeksAgo => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - weeksAgo * 7);
    return d;
  });

  const counts = [0, 0, 0, 0];

  tasks.forEach(task => {
    if (!task.completed || !task.completedAt) return;
    const completedDate = new Date(task.completedAt);

    for (let i = 0; i < weekStarts.length; i++) {
      const weekStart = weekStarts[i];
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      if (completedDate >= weekStart && completedDate < weekEnd) {
        counts[i]++;
        break;
      }
    }
  });

  return counts;
}

// Custom range mode: every Mon→Sun week overlapping the selected range,
// labeled "Week N (Mon)" where N is that week's ordinal position within
// its own calendar month (day 1-7 = Week 1, 8-14 = Week 2, etc).
function getWeekOfMonthLabel(weekStartDate) {
  const monthName = weekStartDate.toLocaleDateString("en-US", { month: "short" });
  const weekNum = Math.ceil(weekStartDate.getDate() / 7);
  return `Week ${weekNum} (${monthName})`;
}

function getWeeksInRange(start, end) {
  const weeks = [];
  let cursor = getStartOfWeek(start); // reuses the helper defined for Best Day
  const lastWeekStart = getStartOfWeek(end);

  while (cursor <= lastWeekStart) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({ start: weekStart, end: weekEnd });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

function countCompletedInWeek(week) {
  return tasks.filter(t => {
    if (!t.completed || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    d.setHours(0, 0, 0, 0);
    return d >= week.start && d <= week.end;
  }).length;
}

function computeWeeklyTrendForRange(range) {
  const weeks = getWeeksInRange(range.start, range.end);
  return {
    labels: weeks.map(w => getWeekOfMonthLabel(w.start)),
    data: weeks.map(w => countCompletedInWeek(w))
  };
}

function updateWeeklyTrendChart() {
  const canvas = document.getElementById("weeklyTrendChart");
  if (!canvas) return; // tab markup not present, skip safely

  const ctx = canvas.getContext("2d");
  let labels, data;

  if (weeklyTrendRange) {
    const result = computeWeeklyTrendForRange(weeklyTrendRange);
    labels = result.labels;
    data = result.data;
  } else {
    labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
    data = computeWeeklyTrendCounts();
  }

  if (weeklyTrendChart) {
    weeklyTrendChart.data.labels = labels;
    weeklyTrendChart.data.datasets[0].data = data;
    weeklyTrendChart.update();
    return;
  }

  weeklyTrendChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Tasks Completed",
        data: data,
        backgroundColor: "#6f42c1",
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      indexAxis: "y", // horizontal bars, like the ████ mockup
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Completed: ${context.raw}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: "Tasks Completed" }
        }
      }
    }
  });
}

// ── Priority Distribution chart ─────────────────────────────
// Shows workload by priority: how many tasks fall into each of
// High / Medium / Low (regardless of completion status).
// When priorityDistributionRange is set, only tasks created within
// that range are counted (null = "All Time", the original behavior).
function computePriorityDistribution() {
  const counts = { high: 0, medium: 0, low: 0 };

  tasks.forEach(task => {
    if (!isWithinRange(task.createdAt, priorityDistributionRange)) return;
    if (task.priority === "high" || task.priority === "medium" || task.priority === "low") {
      counts[task.priority]++;
    }
  });

  return [counts.high, counts.medium, counts.low];
}

function updatePriorityDistributionChart() {
  const canvas = document.getElementById("priorityDistributionChart");
  if (!canvas) return; // tab markup not present, skip safely

  const ctx = canvas.getContext("2d");
  const labels = ["High", "Medium", "Low"];
  const data = computePriorityDistribution();

  if (priorityDistributionChart) {
    priorityDistributionChart.data.datasets[0].data = data;
    priorityDistributionChart.update();
    return;
  }

  priorityDistributionChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Tasks",
        data: data,
        backgroundColor: ["#dc3545", "#fd7e14", "#28a745"],
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      indexAxis: "y", // horizontal bars, matching the ████ mockup
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Tasks: ${context.raw}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: "Number of Tasks" }
        }
      }
    }
  });
}

// ── Productivity Heatmap ─────────────────────────────────────
// Visualizes how many tasks were COMPLETED each day, using ONLY
// task.completedAt (never createdAt or dueDate). Pending tasks are
// never counted. Layout is a normal vertical calendar (weeks stacked
// top-to-bottom, Mon→Sun columns) — not GitHub's rotated grid.

let currentHeatmapRange = "30d"; // default selected filter

// Color thresholds — edit `max` / `level` / `emoji` here to retune.
// `level` maps to the .level-N CSS classes (level-0 = white … level-4 = dark green).
const HEATMAP_THRESHOLDS = [
  { level: 0, max: 0,        emoji: "⬜" }, // 0 tasks
  { level: 1, max: 1,        emoji: "🟨" }, // 1 task
  { level: 2, max: 3,        emoji: "🟩" }, // 2-3 tasks
  { level: 3, max: 6,        emoji: "🟩" }, // 4-6 tasks
  { level: 4, max: Infinity, emoji: "🟩" }  // 7+ tasks
];

// getFilteredDates(): turns the selected filter key into a concrete
// { start, end } date range (both normalized to midnight).
function getHeatmapDateRange(rangeKey) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);

  switch (rangeKey) {
    case "today":
      break; // start === end
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setMonth(start.getMonth() - 1);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6m":
      start.setMonth(start.getMonth() - 6);
      break;
    case "year":
      start.setMonth(0, 1); // Jan 1st of this year
      break;
    case "custom":
      if (heatmapCustomRange) {
        return { start: heatmapCustomRange.start, end: heatmapCustomRange.end };
      }
      start.setMonth(start.getMonth() - 1); // fallback until a range is actually picked
      break;
    default:
      start.setMonth(start.getMonth() - 1);
  }

  return { start, end };
}

// Generates every calendar date between start and end (inclusive).
function generateDateRangeArray(start, end) {
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatHeatmapDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// groupCompletedTasks(): filters completed tasks, reads completedAt,
// filters to the selected range, groups by calendar date, and counts.
function groupCompletedTasksByDate(start, end) {
  const counts = {};

  tasks.forEach(task => {
    if (!task.completed || !task.completedAt) return; // pending tasks never counted

    const completedDate = new Date(task.completedAt);
    completedDate.setHours(0, 0, 0, 0);

    if (completedDate >= start && completedDate <= end) {
      const key = formatHeatmapDateKey(completedDate);
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  return counts;
}

// generateCalendarWeeks(): arranges dates into normal calendar weeks
// (Mon…Sun columns). Weeks are generated dynamically, never stored.
// The first week is padded with nulls so the first real date lines
// up under its correct weekday column — exactly like a normal calendar.
function generateCalendarWeeks(dates) {
  if (dates.length === 0) return [];

  const weeks = [];
  let currentWeek = [];

  const firstWeekday = (dates[0].getDay() + 6) % 7; // Mon=0 ... Sun=6
  for (let i = 0; i < firstWeekday; i++) currentWeek.push(null);

  dates.forEach(date => {
    currentWeek.push(date);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

// getColorLevel(): converts a completed-task count into a threshold entry.
function getColorLevel(count) {
  for (const t of HEATMAP_THRESHOLDS) {
    if (count <= t.max) return t;
  }
  return HEATMAP_THRESHOLDS[HEATMAP_THRESHOLDS.length - 1];
}

function renderHeatmapLegend() {
  const legendEl = document.getElementById("heatmapLegend");
  if (!legendEl) return;

  const legendLabels = ["0", "1", "2-3", "4-6", "7+"];
  legendEl.innerHTML = "";

  HEATMAP_THRESHOLDS.forEach((t, i) => {
    const item = document.createElement("span");
    item.classList.add("legend-item");

    const swatch = document.createElement("span");
    swatch.classList.add("heatmap-day", `level-${t.level}`);
    swatch.style.width = "16px";
    swatch.style.height = "16px";
    swatch.style.fontSize = "10px";
    swatch.textContent = t.emoji;

    const label = document.createElement("span");
    label.textContent = legendLabels[i];

    item.appendChild(swatch);
    item.appendChild(label);
    legendEl.appendChild(item);
  });
}

// renderHeatmap(): builds every week row and day cell dynamically —
// no hardcoded HTML squares.
function renderHeatmap(weeks, counts) {
  const calendarEl = document.getElementById("heatmapCalendar");
  if (!calendarEl) return;

  calendarEl.innerHTML = "";
  const dayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  weeks.forEach((week, weekIndex) => {
    const weekWrapper = document.createElement("div");
    weekWrapper.classList.add("heatmap-week");

    const weekLabel = document.createElement("div");
    weekLabel.classList.add("heatmap-week-label");
    weekLabel.textContent = `Week ${weekIndex + 1}`;
    weekWrapper.appendChild(weekLabel);

    const headerRow = document.createElement("div");
    headerRow.classList.add("heatmap-days-header");
    dayHeaders.forEach(d => {
      const span = document.createElement("span");
      span.textContent = d;
      headerRow.appendChild(span);
    });
    weekWrapper.appendChild(headerRow);

    const daysRow = document.createElement("div");
    daysRow.classList.add("heatmap-days-row");

    week.forEach(date => {
      const dayCell = document.createElement("div");

      if (!date) {
        // Empty leading cell so the first week lines up under the
        // correct weekday column, per normal calendar behavior.
        dayCell.classList.add("heatmap-day", "heatmap-day-empty");
        daysRow.appendChild(dayCell);
        return;
      }

      const key = formatHeatmapDateKey(date);
      const count = counts[key] || 0;
      const levelInfo = getColorLevel(count);

      dayCell.classList.add("heatmap-day", `level-${levelInfo.level}`);
      dayCell.textContent = levelInfo.emoji;

      const dateLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
      dayCell.title = `${dateLabel}\nCompleted Tasks: ${count}`;

      daysRow.appendChild(dayCell);
    });

    weekWrapper.appendChild(daysRow);
    calendarEl.appendChild(weekWrapper);
  });
}

// updateHeatmap(): the single entry point — orchestrates the full
// tasks[] → filtered dates → grouped counts → weeks → render pipeline.
function updateHeatmap() {
  const calendarEl = document.getElementById("heatmapCalendar");
  if (!calendarEl) return; // tab markup not present, skip safely

  const { start, end } = getHeatmapDateRange(currentHeatmapRange);
  const dates = generateDateRangeArray(start, end);
  const counts = groupCompletedTasksByDate(start, end);
  const weeks = generateCalendarWeeks(dates);

  renderHeatmapLegend();
  renderHeatmap(weeks, counts);
}

// Filter buttons: switch range, mark active, re-render.
const heatmapFilterButtons = document.querySelectorAll(".heatmap-filter-btn");
heatmapFilterButtons.forEach(btn => {
  if (btn.dataset.range === "custom") return; // handled separately by flatpickr below
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    currentHeatmapRange = btn.dataset.range;
    heatmapFilterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    updateHeatmap();
  });
});

// ── Best Day ──────────────────────────────────────────────────
// Shows the day (within a user-selected range) on which the most
// tasks were COMPLETED — based only on completedAt, same rule as
// the heatmap. Defaults to "Last Week" on first load.

let currentBestDayRange = null; // { start, end } — remembered so task edits can refresh the view

function getStartOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const weekday = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - weekday);
  return d;
}

function getBestDayPresetRange(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (preset === "today") {
    return { start: new Date(today), end: new Date(today) };
  }

  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { start: y, end: new Date(y) };
  }

  // "last-week" = the previous full Mon→Sun calendar week
  const thisWeekStart = getStartOfWeek(today);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  return { start: lastWeekStart, end: lastWeekEnd };
}

// Reuses formatHeatmapDateKey() (already defined above) to group by date.
function computeBestDayCounts(start, end) {
  const counts = {};

  tasks.forEach(task => {
    if (!task.completed || !task.completedAt) return;

    const completedDate = new Date(task.completedAt);
    completedDate.setHours(0, 0, 0, 0);

    if (completedDate >= start && completedDate <= end) {
      const key = formatHeatmapDateKey(completedDate);
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  return counts;
}

function formatBestDayDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function renderBestDay(counts) {
  const resultEl = document.getElementById("bestDayResult");
  if (!resultEl) return;

  resultEl.innerHTML = "";

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    resultEl.innerHTML = '<p class="best-day-empty">No completed tasks in this range yet.</p>';
    return;
  }

  const maxCount = entries[0][1];
  const bestDays = entries.filter(([, count]) => count === maxCount);

  const bestCard = document.createElement("div");
  bestCard.classList.add("best-day-card");
  const bestDatesLabel = bestDays.map(([key]) => formatBestDayDate(key)).join(" & ");
  bestCard.innerHTML = `
    <div class="best-day-card-label">🏆 Best Day${bestDays.length > 1 ? "s" : ""}</div>
    <div class="best-day-card-date">${bestDatesLabel}</div>
    <div class="best-day-card-count">${maxCount} task${maxCount === 1 ? "" : "s"} completed</div>
  `;
  resultEl.appendChild(bestCard);

  // Ranked list of every day in range that had at least one completion,
  // for context around the best day(s).
  if (entries.length > 1) {
    const listEl = document.createElement("div");
    listEl.classList.add("best-day-list");
    entries.forEach(([key, count]) => {
      const row = document.createElement("div");
      row.classList.add("best-day-list-row");
      if (count === maxCount) row.classList.add("is-best");
      row.innerHTML = `<span>${formatBestDayDate(key)}</span><span>${count} completed</span>`;
      listEl.appendChild(row);
    });
    resultEl.appendChild(listEl);
  }
}

function updateBestDay(start, end) {
  currentBestDayRange = { start, end };
  renderBestDay(computeBestDayCounts(start, end));
}

// Re-renders the currently selected range (called on every task change),
// without altering which range is selected.
function refreshBestDay() {
  if (currentBestDayRange) {
    renderBestDay(computeBestDayCounts(currentBestDayRange.start, currentBestDayRange.end));
  }
}

// Range picker (flatpickr, already loaded for the due-date field) —
// double-month range calendar, same interaction as the screenshot.
const bestDayRangeInput = document.getElementById("bestDayRangeInput");
let bestDayRangePicker = null;
if (bestDayRangeInput) {
  bestDayRangePicker = flatpickr(bestDayRangeInput, {
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 2,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const start = new Date(selectedDates[0]);
        const end = new Date(selectedDates[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        document.querySelectorAll(".best-day-preset-btn").forEach(b => b.classList.remove("active"));
        updateBestDay(start, end);
      }
    }
  });
}

// Preset buttons (Today / Yesterday / Last Week)
const bestDayPresetButtons = document.querySelectorAll(".best-day-preset-btn");
bestDayPresetButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const { start, end } = getBestDayPresetRange(btn.dataset.preset);
    bestDayPresetButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    if (bestDayRangePicker) bestDayRangePicker.setDate([start, end], false);
    updateBestDay(start, end);
  });
});

// Default view: Last Week
if (bestDayRangeInput) {
  const defaultRange = getBestDayPresetRange("last-week");
  if (bestDayRangePicker) bestDayRangePicker.setDate([defaultRange.start, defaultRange.end], false);
  updateBestDay(defaultRange.start, defaultRange.end);
}

// ── Recent Activity ──────────────────────────────────────────
// Three independent panels: Recently Added (createdAt), Recently
// Completed (completedAt), Upcoming Deadlines (dueDate, pending only).

// formatRelativeTime(): "Just now" / "5 minutes ago" / "1 hour ago" /
// "Yesterday" / "2 days ago" / "1 week ago" — never a raw timestamp.
function formatRelativeTime(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24));

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;

  const weeks = Math.floor(dayDiff / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  const months = Math.floor(dayDiff / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

// formatDeadlineStatus(): "Today" / "Tomorrow" / "3 days left" / "1 week left"
function formatDeadlineStatus(dueDateInput) {
  const due = new Date(dueDateInput);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `${diffDays} days left`;

  const weeks = Math.floor(diffDays / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} left`;
}

function getActivityPriorityLabel(priority) {
  if (!priority) return "No Priority";
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} Priority`;
}

// Builds one <li class="activity-item"> using safe DOM APIs (textContent
// for the task name) so task text is never interpreted as HTML.
function buildActivityItem(icon, taskText, priority, metaText) {
  const li = document.createElement("li");
  li.classList.add("activity-item");

  const iconSpan = document.createElement("span");
  iconSpan.classList.add("activity-icon");
  iconSpan.textContent = icon;

  const main = document.createElement("div");
  main.classList.add("activity-main");

  const nameEl = document.createElement("div");
  nameEl.classList.add("activity-name");
  nameEl.textContent = taskText;

  const metaEl = document.createElement("div");
  metaEl.classList.add("activity-meta");

  const badge = document.createElement("span");
  badge.classList.add("priority-badge", priority || "no-priority");
  badge.textContent = getActivityPriorityLabel(priority);

  const timeEl = document.createElement("span");
  timeEl.classList.add("activity-time");
  timeEl.textContent = metaText;

  metaEl.appendChild(badge);
  metaEl.appendChild(timeEl);
  main.appendChild(nameEl);
  main.appendChild(metaEl);

  li.appendChild(iconSpan);
  li.appendChild(main);
  return li;
}

function renderActivityEmptyState(listEl, message) {
  listEl.innerHTML = "";
  const li = document.createElement("li");
  li.classList.add("activity-empty");
  li.textContent = message;
  listEl.appendChild(li);
}

// FEATURE 1 — Recently Added: sorted by createdAt, newest first, top 5.
function renderRecentlyAdded() {
  const listEl = document.getElementById("recentlyAddedList");
  if (!listEl) return;

  const items = [...tasks]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (items.length === 0) {
    renderActivityEmptyState(listEl, "No tasks added yet.");
    return;
  }

  listEl.innerHTML = "";
  items.forEach(task => {
    listEl.appendChild(
      buildActivityItem("➕", task.text, task.priority, formatRelativeTime(task.createdAt))
    );
  });
}

// FEATURE 2 — Recently Completed: completed tasks only, sorted by
// completedAt, newest first, top 5.
function renderRecentlyCompleted() {
  const listEl = document.getElementById("recentlyCompletedList");
  if (!listEl) return;

  const items = tasks
    .filter(t => t.completed && t.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 5);

  if (items.length === 0) {
    renderActivityEmptyState(listEl, "No completed tasks yet.");
    return;
  }

  listEl.innerHTML = "";
  items.forEach(task => {
    listEl.appendChild(
      buildActivityItem("✔", task.text, task.priority, `Completed ${formatRelativeTime(task.completedAt)}`)
    );
  });
}

// FEATURE 3 — Upcoming Deadlines: pending tasks with a dueDate that is
// today or later, sorted nearest-first, top 5.
function renderUpcomingDeadlines() {
  const listEl = document.getElementById("upcomingDeadlinesList");
  if (!listEl) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = tasks
    .filter(t => {
      if (t.completed || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due >= today;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  if (items.length === 0) {
    renderActivityEmptyState(listEl, "No upcoming deadlines.");
    return;
  }

  listEl.innerHTML = "";
  items.forEach(task => {
    listEl.appendChild(
      buildActivityItem("⏰", task.text, task.priority, formatDeadlineStatus(task.dueDate))
    );
  });
}

function updateRecentActivity() {
  renderRecentlyAdded();
  renderRecentlyCompleted();
  renderUpcomingDeadlines();
}

// ── Monthly Trend chart ──────────────────────────────────────
// Same bar-chart design as Weekly Trend. Shows how many tasks were
// COMPLETED each month of a selected year (based on completedAt only).
// Defaults to the current year; the year dropdown covers every year
// from the user's very first task up to the current year.

let currentMonthlyTrendYear = new Date().getFullYear();

// Every year from the earliest task's createdAt to the current year —
// i.e. "all years since the user started using this app".
function getAvailableTrendYears() {
  const currentYear = new Date().getFullYear();
  let earliestYear = currentYear;

  tasks.forEach(task => {
    if (!task.createdAt) return;
    const year = new Date(task.createdAt).getFullYear();
    if (year < earliestYear) earliestYear = year;
  });

  const years = [];
  for (let y = currentYear; y >= earliestYear; y--) years.push(y);
  return years;
}

function computeMonthlyTrendCounts(year) {
  const counts = new Array(12).fill(0);

  tasks.forEach(task => {
    if (!task.completed || !task.completedAt) return;
    const completedDate = new Date(task.completedAt);
    if (completedDate.getFullYear() === year) {
      counts[completedDate.getMonth()]++;
    }
  });

  return counts;
}

function updateMonthlyTrendChart() {
  const canvas = document.getElementById("monthlyTrendChart");
  if (!canvas) return; // tab markup not present, skip safely

  const ctx = canvas.getContext("2d");
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const data = computeMonthlyTrendCounts(currentMonthlyTrendYear);

  if (monthlyTrendChart) {
    monthlyTrendChart.data.datasets[0].data = data;
    monthlyTrendChart.update();
    return;
  }

  monthlyTrendChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Tasks Completed",
        data: data,
        backgroundColor: "#6f42c1",
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      indexAxis: "y", // horizontal bars, matching Weekly Trend
      responsive: true,
      maintainAspectRatio: false, // let the taller container control height for all 12 bars
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Completed: ${context.raw}`
          }
        }
      },
      scales: {
        y: {
          ticks: { autoSkip: false } // always show every month label, Jan–Dec
        },
        x: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: "Tasks Completed" }
        }
      }
    }
  });
}

// Year dropdown: populated dynamically, defaults to the current year.
const monthlyTrendYearSelect = document.getElementById("monthlyTrendYearSelect");
if (monthlyTrendYearSelect) {
  getAvailableTrendYears().forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    if (year === currentMonthlyTrendYear) option.selected = true;
    monthlyTrendYearSelect.appendChild(option);
  });

  monthlyTrendYearSelect.addEventListener("change", () => {
    currentMonthlyTrendYear = parseInt(monthlyTrendYearSelect.value, 10);
    updateMonthlyTrendChart();
  });
}

// ── Completion Rate ──────────────────────────────────────────
// Completion Rate (%) = (Completed Tasks ÷ Total Tasks) × 100
// Respects the same range picker pattern as the other Overview cards.
// Both numerator and denominator use createdAt, so the rate answers
// "of the tasks created in this window, what % are now completed?"

let completionRateRange = null; // null = "All Time"

function getCompletionRateColorClass(rate) {
  if (rate <= 25) return "rate-red";
  if (rate <= 50) return "rate-yellow";
  if (rate <= 75) return "rate-light-green";
  return "rate-dark-green";
}

function updateCompletionRate() {
  const valueEl = document.getElementById("completionRateValue");
  const fillEl = document.getElementById("completionRateBarFill");
  const subEl = document.getElementById("completionRateSub");
  if (!valueEl || !fillEl || !subEl) return; // tab markup not present, skip safely

  const totalInRange = tasks.filter(t => isWithinRange(t.createdAt, completionRateRange)).length;
  const completedInRange = tasks.filter(t => t.completed && isWithinRange(t.createdAt, completionRateRange)).length;
  const rate = totalInRange > 0 ? Math.round((completedInRange / totalInRange) * 100) : 0;
  const colorClass = getCompletionRateColorClass(rate);

  valueEl.textContent = `${rate}%`;
  valueEl.classList.remove("rate-red", "rate-yellow", "rate-light-green", "rate-dark-green");
  valueEl.classList.add(colorClass);

  fillEl.style.width = `${rate}%`;
  fillEl.classList.remove("rate-red", "rate-yellow", "rate-light-green", "rate-dark-green");
  fillEl.classList.add(colorClass);

  subEl.textContent = `${completedInRange} of ${totalInRange} tasks completed`;
}

const completionRateRangeInput = document.getElementById("completionRateRangeInput");
const completionRateRangeReset = document.getElementById("completionRateRangeReset");
if (completionRateRangeInput) {
  const completionRatePicker = flatpickr(completionRateRangeInput, {
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 2,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const start = new Date(selectedDates[0]);
        const end = new Date(selectedDates[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        completionRateRange = { start, end };
        updateCompletionRate();
      }
    }
  });

  if (completionRateRangeReset) {
    completionRateRangeReset.addEventListener("click", () => {
      completionRateRange = null;
      completionRatePicker.clear();
      updateCompletionRate();
    });
  }
}

// ── Overview card range pickers ─────────────────────────────
// Total Tasks / Completed / Pending / Overdue each get a top-right
// date-range picker (same flatpickr double-month range calendar used
// by Best Day). Selecting a range filters both that tab's list and
// its stat-card number; "All Time" resets back to unfiltered.
function setupOverviewRangePicker(key, inputId, resetBtnId) {
  const inputEl = document.getElementById(inputId);
  const resetBtn = document.getElementById(resetBtnId);
  if (!inputEl) return;

  const picker = flatpickr(inputEl, {
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 2,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const start = new Date(selectedDates[0]);
        const end = new Date(selectedDates[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        overviewRanges[key] = { start, end };
        if (listPagination[key]) listPagination[key].page = 1;
        renderTasks();
      }
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      overviewRanges[key] = null;
      picker.clear();
      if (listPagination[key]) listPagination[key].page = 1;
      renderTasks();
    });
  }
}

setupOverviewRangePicker("totalTasks", "totalTasksRangeInput", "totalTasksRangeReset");
setupOverviewRangePicker("completed", "completedRangeInput", "completedRangeReset");
setupOverviewRangePicker("pending", "pendingRangeInput", "pendingRangeReset");
setupOverviewRangePicker("overdue", "overdueRangeInput", "overdueRangeReset");

// ── Pagination controls (per-page select + prev/next) ───────
function setupListPagination(key) {
  const idPrefix = paginationIdPrefixes[key];
  const perPageSelect = document.getElementById(`${idPrefix}PerPage`);
  const prevBtn = document.getElementById(`${idPrefix}PrevBtn`);
  const nextBtn = document.getElementById(`${idPrefix}NextBtn`);

  if (perPageSelect) {
    perPageSelect.value = listPagination[key].perPage;
    perPageSelect.addEventListener("change", () => {
      listPagination[key].perPage = parseInt(perPageSelect.value, 10);
      listPagination[key].page = 1; // reset to first page when page size changes
      renderTasks();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (listPagination[key].page > 1) {
        listPagination[key].page--;
        renderTasks();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      listPagination[key].page++; // populateList() clamps if out of bounds
      renderTasks();
    });
  }
}

setupListPagination("totalTasks");
setupListPagination("completed");
setupListPagination("pending");
setupListPagination("overdue");

// ── Daily Completion range picker ───────────────────────────
// Selecting a range switches from the default "this week" 7-point line
// into custom-range mode showing one point per calendar day in range.
const dailyCompletionRangeInput = document.getElementById("dailyCompletionRangeInput");
const dailyCompletionRangeReset = document.getElementById("dailyCompletionRangeReset");
const dailyCompletionSubHead = document.getElementById("dailyCompletionSubHead");
if (dailyCompletionRangeInput) {
  const dailyCompletionPicker = flatpickr(dailyCompletionRangeInput, {
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 2,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const start = new Date(selectedDates[0]);
        const end = new Date(selectedDates[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        dailyCompletionRange = { start, end };
        if (dailyCompletionSubHead) dailyCompletionSubHead.textContent = "How many tasks did I complete each day in the selected range?";
        updateDailyCompletionChart();
      }
    }
  });

  if (dailyCompletionRangeReset) {
    dailyCompletionRangeReset.addEventListener("click", () => {
      dailyCompletionRange = null;
      dailyCompletionPicker.clear();
      if (dailyCompletionSubHead) dailyCompletionSubHead.textContent = "How many tasks did I complete every day? (this week)";
      updateDailyCompletionChart();
    });
  }
}

// ── Task Status range picker ────────────────────────────────
const taskStatusRangeInput = document.getElementById("taskStatusRangeInput");
const taskStatusRangeReset = document.getElementById("taskStatusRangeReset");
if (taskStatusRangeInput) {
  const taskStatusPicker = flatpickr(taskStatusRangeInput, {
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 2,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const start = new Date(selectedDates[0]);
        const end = new Date(selectedDates[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        taskStatusRange = { start, end };
        updateStats();
      }
    }
  });

  if (taskStatusRangeReset) {
    taskStatusRangeReset.addEventListener("click", () => {
      taskStatusRange = null;
      taskStatusPicker.clear();
      updateStats();
    });
  }
}

// ── Weekly Trend range picker ───────────────────────────────
// Selecting a range switches from the default "last 4 weeks" view into
// custom-range mode with "Week N (Month)" labels; reset returns to default.
const weeklyTrendRangeInput = document.getElementById("weeklyTrendRangeInput");
const weeklyTrendRangeReset = document.getElementById("weeklyTrendRangeReset");
const weeklyTrendSubHead = document.getElementById("weeklyTrendSubHead");
if (weeklyTrendRangeInput) {
  const weeklyTrendPicker = flatpickr(weeklyTrendRangeInput, {
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 2,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const start = new Date(selectedDates[0]);
        const end = new Date(selectedDates[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        weeklyTrendRange = { start, end };
        if (weeklyTrendSubHead) weeklyTrendSubHead.textContent = "Tasks completed in the selected range";
        updateWeeklyTrendChart();
      }
    }
  });

  if (weeklyTrendRangeReset) {
    weeklyTrendRangeReset.addEventListener("click", () => {
      weeklyTrendRange = null;
      weeklyTrendPicker.clear();
      if (weeklyTrendSubHead) weeklyTrendSubHead.textContent = "Tasks completed over the last 4 weeks";
      updateWeeklyTrendChart();
    });
  }
}

// ── Priority Distribution range picker ──────────────────────
const priorityDistributionRangeInput = document.getElementById("priorityDistributionRangeInput");
const priorityDistributionRangeReset = document.getElementById("priorityDistributionRangeReset");
if (priorityDistributionRangeInput) {
  const priorityDistributionPicker = flatpickr(priorityDistributionRangeInput, {
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 2,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const start = new Date(selectedDates[0]);
        const end = new Date(selectedDates[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        priorityDistributionRange = { start, end };
        updatePriorityDistributionChart();
      }
    }
  });

  if (priorityDistributionRangeReset) {
    priorityDistributionRangeReset.addEventListener("click", () => {
      priorityDistributionRange = null;
      priorityDistributionPicker.clear();
      updatePriorityDistributionChart();
    });
  }
}

// ── Productivity Heatmap: Custom Range button ───────────────
// Attaches flatpickr directly to the button; selecting a range sets it
// active (like the other heatmap filter buttons) and re-renders.
const heatmapCustomRangeBtn = document.getElementById("heatmapCustomRangeBtn");
if (heatmapCustomRangeBtn) {
  const heatmapCustomRangeDefaultLabel = heatmapCustomRangeBtn.textContent;

  flatpickr(heatmapCustomRangeBtn, {
    mode: "range",
    dateFormat: "Y-m-d",
    showMonths: 2,
    onChange: (selectedDates) => {
      if (selectedDates.length === 2) {
        const start = new Date(selectedDates[0]);
        const end = new Date(selectedDates[1]);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        heatmapCustomRange = { start, end };
        currentHeatmapRange = "custom";

        document.querySelectorAll(".heatmap-filter-btn").forEach(b => b.classList.remove("active"));
        heatmapCustomRangeBtn.classList.add("active");
        heatmapCustomRangeBtn.textContent =
          `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

        updateHeatmap();
      }
    }
  });
}

// ── Total Tasks tab filter buttons ─────────────────────────
const totalTasksAllBtn       = document.getElementById("totalTasksAllBtn");
const totalTasksCompletedBtn = document.getElementById("totalTasksCompletedBtn");
const totalTasksPendingBtn   = document.getElementById("totalTasksPendingBtn");

if (totalTasksAllBtn) {
  totalTasksAllBtn.addEventListener("click", () => {
    totalTasksFilter = "all"; listPagination.totalTasks.page = 1; renderTasks();
  });
}
if (totalTasksCompletedBtn) {
  totalTasksCompletedBtn.addEventListener("click", () => {
    totalTasksFilter = "completed"; listPagination.totalTasks.page = 1; renderTasks();
  });
}
if (totalTasksPendingBtn) {
  totalTasksPendingBtn.addEventListener("click", () => {
    totalTasksFilter = "pending"; listPagination.totalTasks.page = 1; renderTasks();
  });
}

// ── Total Tasks search ──────────────────────────────────────
if (totalTasksSearchInput) {
  totalTasksSearchInput.addEventListener("input", () => {
    listPagination.totalTasks.page = 1;
    renderTasks();
  });
}

flatpickr("#dueDate", {
  enableTime: true,
  dateFormat: "d M Y h:i K"
});

// ── Sidebar: Accordion groups ──────────────────────────────
const accordionGroups = document.querySelectorAll(".accordion-group");

accordionGroups.forEach(group => {
  const header = group.querySelector(".accordion-header");
  header.addEventListener("click", () => {
    const isOpen = group.classList.contains("open");

    // Close all groups first (one open at a time)
    accordionGroups.forEach(g => g.classList.remove("open"));

    // Re-open this one if it wasn't already open
    if (!isOpen) group.classList.add("open");
  });
});

// ── Sidebar: Tab switching (accordion items + bottom menu) ──
const allTabTriggers = document.querySelectorAll("[data-tab]");
const allTabSections = document.querySelectorAll(".tab-section");

function activateTab(tabName) {
  localStorage.setItem("activeTab", tabName); 
  // Switch visible section
  allTabSections.forEach(section => section.classList.remove("active"));
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.add("active");

  // Switch active state on triggers
  allTabTriggers.forEach(trigger => trigger.classList.remove("active"));
  const activeTrigger = document.querySelector(`[data-tab="${tabName}"]`);
  if (activeTrigger) {
    activeTrigger.classList.add("active");

    // If this trigger lives inside an accordion group, make sure that group is open
    const parentGroup = activeTrigger.closest(".accordion-group");
    if (parentGroup) {
      accordionGroups.forEach(g => g.classList.remove("open"));
      parentGroup.classList.add("open");
    }
  }

  // Chart.js can't measure a canvas while its tab is display:none.
  // Once the Task Status tab becomes visible, force a resize/repaint.
  if (tabName === "task-status" && taskStatusChart) {
    taskStatusChart.resize();
  }
  if (tabName === "daily-completion" && dailyCompletionChart) {
    dailyCompletionChart.resize();
  }
  if (tabName === "weekly-trend" && weeklyTrendChart) {
    weeklyTrendChart.resize();
  }
  if (tabName === "priority-distribution" && priorityDistributionChart) {
    priorityDistributionChart.resize();
  }
  if (tabName === "monthly-trend" && monthlyTrendChart) {
    monthlyTrendChart.resize();
  }
}

allTabTriggers.forEach(trigger => {
  trigger.addEventListener("click", () => {
    activateTab(trigger.dataset.tab);
  });
});

// ── Dashboard: "View All Tasks →" button ───────────────────
const viewAllBtn = document.getElementById("viewAllBtn");
if (viewAllBtn) {
  viewAllBtn.addEventListener("click", () => activateTab("total-tasks"));
}

// ── Init ──────────────────────────────────────────────────
loadTasks();
renderTasks();
const savedTab = localStorage.getItem("activeTab") || "dashboard";
activateTab(savedTab);