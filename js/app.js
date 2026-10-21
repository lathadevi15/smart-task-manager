// ── Elements ──────────────────────────────────────────────
const input       = document.getElementById("taskInput");
const button      = document.getElementById("addBtn");
const taskList          = document.getElementById("taskList");          // Dashboard recent-activity list
const totalTaskList     = document.getElementById("totalTaskList");     // Total Tasks list
const completedTaskList = document.getElementById("completedTaskList"); // Completed list
const pendingTaskList   = document.getElementById("pendingTaskList");   // Pending list
const totalTasksSearchInput = document.getElementById("totalTasksSearchInput"); // Total Tasks search
const completedSearchInput = document.getElementById("completedSearchInput"); // Completed search
const pendingSearchInput   = document.getElementById("pendingSearchInput");   // Pending search
const overdueSearchInput   = document.getElementById("overdueSearchInput");   // Overdue search
const dueDateInput = document.getElementById("dueDate");
const overdueTaskList = document.getElementById("overdueTaskList");

// Custom Dropdown (multi-instance — Add Task priority, Total Tasks sort-by-priority,
// and Edit Task priority all reuse this same visual design).
function initCustomSelect(rootEl, onSelect) {
  if (!rootEl) return null;
  const selectedEl = rootEl.querySelector(".selected");
  const selectedTextEl = rootEl.querySelector(".selected span:first-child");
  const optionEls = rootEl.querySelectorAll(".options li");

  selectedEl.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".custom-select.active").forEach(el => {
      if (el !== rootEl) el.classList.remove("active");
    });
    rootEl.classList.toggle("active");
  });

  optionEls.forEach(option => {
    option.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedTextEl.textContent = option.textContent;
      rootEl.classList.remove("active");
      if (onSelect) onSelect(option.dataset.value, option.textContent);
    });
  });

  return {
    setValue(value, label) {
      selectedTextEl.textContent = label;
    }
  };
}

document.addEventListener("click", (e) => {
  document.querySelectorAll(".custom-select.active").forEach(el => {
    if (!el.contains(e.target)) el.classList.remove("active");
  });
});

const addTaskPriorityDropdown = initCustomSelect(
  document.getElementById("addTaskPriorityDropdown"),
  (value) => { selectedPriority = value; }
);

// ── State ─────────────────────────────────────────────────
let tasks            = [];
let totalTasksFilter  = "all";     // for Total Tasks tab: "all" | "completed" | "pending" | "overdue"
let totalTasksPriorityFilter = ""; // "", "high", "medium", "low", or "none" — filters the list to that priority only
let completedPriorityFilter = ""; // same as above, scoped to the Completed tab
let pendingPriorityFilter   = ""; // same as above, scoped to the Pending tab
let overduePriorityFilter   = ""; // same as above, scoped to the Overdue tab
let selectedPriority = "";
let taskStatusChart = null;
let dailyCompletionChart = null;
let weeklyTrendChart = null;
let monthlyTrendChart = null;
let priorityDistributionChart = null;
let dashTaskStatusChart = null;
let dashDailyChart = null;
let dashWeeklyChart = null;
let dashPriorityChart = null;
let dashMonthlyChart = null;

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
// (Wired above via initCustomSelect for the Add Task priority dropdown.)

// ── Add Task ──────────────────────────────────────────────
if (button) button.addEventListener("click", addTask);
if (input) input.addEventListener("keypress", (e) => { if (e.key === "Enter") addTask(); });

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
  if (addTaskPriorityDropdown) addTaskPriorityDropdown.setValue("", "No Priority");
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

// ── Profile storage + time-format preference ──────────────
// Profile = { fullName, username, profession, bio, avatar (data URL), timeFormat: "12" | "24" }
function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem("profile")) || {};
  } catch (e) {
    return {};
  }
}

function saveProfile(profile) {
  localStorage.setItem("profile", JSON.stringify(profile));
}

function use12Hour() {
  return loadProfile().timeFormat !== "24"; // 12-hour is the default
}

function getDueDateFormat() {
  return use12Hour() ? "d M Y h:i K" : "d M Y H:i";
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
    const wasCompleted = task.completed;
    const nowChecked = checkbox.checked;

    if (wasCompleted && !nowChecked) {
      // Unchecking a completed task needs confirmation before it actually changes.
      openConfirmModal({
        title: "Mark as Incomplete",
        message: "Are you sure you want to mark this task as incomplete?",
        onConfirm: () => {
          task.completed = false;
          task.completedAt = null;
          saveToLocalStorage();
          renderTasks();
        },
        onCancel: () => {
          checkbox.checked = true;
        }
      });
      return;
    }

    task.completed = nowChecked;
    task.completedAt = nowChecked ? new Date().toISOString() : null;
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
      minute: "2-digit",
      hour12: use12Hour()
    });
    due.innerText = "Completed at: " + formattedCompleted;
  } else if (task.dueDate) {
    const formatted = new Date(task.dueDate).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: use12Hour()
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
    openEditTaskModal(task);
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.classList.add("delete-btn");
  deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
  deleteBtn.onclick = () => {
    openConfirmModal({
      title: "Delete Task",
      message: "Are you sure you want to delete this task? This can't be undone.",
      onConfirm: () => {
        tasks.splice(tasks.indexOf(task), 1);
        saveToLocalStorage();
        renderTasks();
      }
    });
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
      minute: "2-digit",
      hour12: use12Hour()
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

function populateList(ulElement, filter, searchText, dateRange = null, dateField = null, paginationKey = null, priorityFilter = "") {
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

  // Filter by Priority — applies to any list (Total Tasks, Completed,
  // Pending, Overdue) when a priority is selected in that tab's
  // "Filter by Priority" dropdown.
  if (priorityFilter === "high" || priorityFilter === "medium" || priorityFilter === "low" || priorityFilter === "none") {
    const matchesPriority = (t) => (priorityFilter === "none" ? !t.priority : t.priority === priorityFilter);
    filtered = filtered.filter(matchesPriority);
  }

  // Total Tasks tab: newest → oldest by default (most recently created task first).
  if (paginationKey === "totalTasks") {
    const byCreatedAtDesc = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    filtered = [...filtered].sort(byCreatedAtDesc);
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
  const completedSearch  = completedSearchInput  ? completedSearchInput.value  : "";
  const pendingSearch    = pendingSearchInput    ? pendingSearchInput.value    : "";
  const overdueSearch    = overdueSearchInput    ? overdueSearchInput.value    : "";

  // Dashboard — Recent Activity (last 10 tasks, newest first)
  populateList(taskList, "recent", "");

  // Total Tasks tab (ranged by createdAt, paginated, newest→oldest, optionally filtered by priority)
  populateList(totalTaskList, totalTasksFilter, totalTasksSearch, overviewRanges.totalTasks, "createdAt", "totalTasks", totalTasksPriorityFilter);

  // Completed tab — always shows only completed (ranged by completedAt, paginated, searchable, filterable by priority)
  populateList(completedTaskList, "completed", completedSearch, overviewRanges.completed, "completedAt", "completed", completedPriorityFilter);

  // Pending tab — always shows only pending (ranged by createdAt, paginated, searchable, filterable by priority)
  populateList(pendingTaskList, "pending", pendingSearch, overviewRanges.pending, "createdAt", "pending", pendingPriorityFilter);

  // Overdue tab (ranged by dueDate, paginated, searchable, filterable by priority)
  populateList(overdueTaskList, "overdue", overdueSearch, overviewRanges.overdue, "dueDate", "overdue", overduePriorityFilter);

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

// ── Static Completed counters (Completed tab) ───────────────
// These four always reflect "right now" — they deliberately ignore
// overviewRanges.completed / the Completed tab's range picker, per
// requirement that they stay fixed regardless of the selected date range.
function countCompletedToday() {
  const now = new Date();
  return tasks.filter(t => {
    if (!t.completed || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  }).length;
}

function countCompletedThisWeek() {
  const now = new Date();
  // Monday → Sunday, same convention used by the Daily/Weekly charts.
  const dayIndex = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - dayIndex);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  return tasks.filter(t => {
    if (!t.completed || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= monday && d < nextMonday;
  }).length;
}

function countCompletedThisMonth() {
  const now = new Date();
  return tasks.filter(t => {
    if (!t.completed || !t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
}

function countCompletedOnTime() {
  // "On time" = finished a task that had a due date, at or before that due date.
  return tasks.filter(t => {
    if (!t.completed || !t.completedAt || !t.dueDate) return false;
    return new Date(t.completedAt) <= new Date(t.dueDate);
  }).length;
}

// ── Static Pending due-date buckets (Pending tab) ────────────
// Always based on today's real date — ignore overviewRanges.pending.
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekBounds(referenceDate) {
  // Monday → next Monday, same convention used by the Daily/Weekly charts.
  const dayIndex = (referenceDate.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const monday = startOfDay(referenceDate);
  monday.setDate(monday.getDate() - dayIndex);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  return { start: monday, end: nextMonday };
}

function countPendingDueToday() {
  const today = startOfDay(new Date());
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const d = startOfDay(t.dueDate);
    return d.getTime() === today.getTime();
  }).length;
}

function countPendingDueTomorrow() {
  const tomorrow = startOfDay(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const d = startOfDay(t.dueDate);
    return d.getTime() === tomorrow.getTime();
  }).length;
}

function countPendingDueThisWeek() {
  const { start, end } = getWeekBounds(new Date());
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const d = startOfDay(t.dueDate);
    return d >= start && d < end;
  }).length;
}

function countPendingDueThisMonth() {
  // All pending tasks due anywhere in the current calendar month
  // (this intentionally overlaps with Today/Tomorrow/This Week above).
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const d = startOfDay(t.dueDate);
    return d >= thisMonthStart && d < nextMonthStart;
  }).length;
}

function countPendingDueLater() {
  // Anything due beyond the current calendar month.
  const now = new Date();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    const d = startOfDay(t.dueDate);
    return d >= nextMonthStart;
  }).length;
}

function countPendingOverdue() {
  // Pending tasks whose due date has already passed — pending tasks include overdue ones too.
  const now = new Date();
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    return new Date(t.dueDate) < now;
  }).length;
}

// ── Static Overdue age buckets (Overdue tab) ─────────────────
// Always based on today's real date — ignore overviewRanges.overdue.
function countOverdueYesterday() {
  const now = new Date();
  const yesterday = startOfDay(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    if (new Date(t.dueDate) >= now) return false; // must actually be overdue
    const d = startOfDay(t.dueDate);
    return d.getTime() === yesterday.getTime();
  }).length;
}

function countOverdueLastWeek() {
  const now = new Date();
  const { start: thisWeekStart } = getWeekBounds(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    if (new Date(t.dueDate) >= now) return false;
    const d = startOfDay(t.dueDate);
    return d >= lastWeekStart && d < thisWeekStart;
  }).length;
}

function countOverdueLastMonth() {
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    if (new Date(t.dueDate) >= now) return false;
    const d = startOfDay(t.dueDate);
    return d >= lastMonthStart && d < thisMonthStart;
  }).length;
}

function countOverdueMonthAgoPlus() {
  // Anything overdue from before the "last month" window above.
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return tasks.filter(t => {
    if (t.completed || !t.dueDate) return false;
    if (new Date(t.dueDate) >= now) return false;
    const d = startOfDay(t.dueDate);
    return d < lastMonthStart;
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

  // Static Completed-tab counters — intentionally NOT range-filtered.
  const completedTodayEl     = document.getElementById("completedTodayCount");
  const completedThisWeekEl  = document.getElementById("completedThisWeekCount");
  const completedThisMonthEl = document.getElementById("completedThisMonthCount");
  const completedOnTimeEl    = document.getElementById("completedOnTimeCount");

  if (completedTodayEl)     completedTodayEl.textContent     = countCompletedToday();
  if (completedThisWeekEl)  completedThisWeekEl.textContent  = countCompletedThisWeek();
  if (completedThisMonthEl) completedThisMonthEl.textContent = countCompletedThisMonth();
  if (completedOnTimeEl)    completedOnTimeEl.textContent    = countCompletedOnTime();

  // Static Pending-tab counters — intentionally NOT range-filtered.
  const pendingOverdueEl      = document.getElementById("pendingOverdueCount");
  const pendingDueTodayEl     = document.getElementById("pendingDueTodayCount");
  const pendingDueTomorrowEl  = document.getElementById("pendingDueTomorrowCount");
  const pendingDueThisWeekEl  = document.getElementById("pendingDueThisWeekCount");
  const pendingDueThisMonthEl = document.getElementById("pendingDueThisMonthCount");
  const pendingDueLaterEl     = document.getElementById("pendingDueLaterCount");

  if (pendingOverdueEl)      pendingOverdueEl.textContent      = countPendingOverdue();
  if (pendingDueTodayEl)     pendingDueTodayEl.textContent     = countPendingDueToday();
  if (pendingDueTomorrowEl)  pendingDueTomorrowEl.textContent  = countPendingDueTomorrow();
  if (pendingDueThisWeekEl)  pendingDueThisWeekEl.textContent  = countPendingDueThisWeek();
  if (pendingDueThisMonthEl) pendingDueThisMonthEl.textContent = countPendingDueThisMonth();
  if (pendingDueLaterEl)     pendingDueLaterEl.textContent     = countPendingDueLater();

  // Static Overdue-tab counters — intentionally NOT range-filtered.
  const overdueYesterdayEl    = document.getElementById("overdueYesterdayCount");
  const overdueLastWeekEl     = document.getElementById("overdueLastWeekCount");
  const overdueLastMonthEl    = document.getElementById("overdueLastMonthCount");
  const overdueMonthAgoPlusEl = document.getElementById("overdueMonthAgoPlusCount");

  if (overdueYesterdayEl)    overdueYesterdayEl.textContent    = countOverdueYesterday();
  if (overdueLastWeekEl)     overdueLastWeekEl.textContent     = countOverdueLastWeek();
  if (overdueLastMonthEl)    overdueLastMonthEl.textContent    = countOverdueLastMonth();
  if (overdueMonthAgoPlusEl) overdueMonthAgoPlusEl.textContent = countOverdueMonthAgoPlus();









  // Total Tasks tab's own card (separate id to avoid duplicate-id clash with dashboard)
  const totalCountAltEl = document.getElementById("totalCountAlt");
  if (totalCountAltEl) totalCountAltEl.textContent = countTotalInRange(overviewRanges.totalTasks);

  // Priority breakdown (High/Medium/Low/No Priority) alongside the Total
  // Tasks card — counted over the same date range as that card (createdAt).
  const totalTasksRange = overviewRanges.totalTasks;
  const countByPriorityInRange = (priority, range) => tasks.filter(t => {
    const matches = priority === "none" ? !t.priority : t.priority === priority;
    return matches && isWithinRange(t.createdAt, range);
  }).length;

  const highPriorityBreakdownEl   = document.getElementById("totalTasksHighPriorityCount");
  const mediumPriorityBreakdownEl = document.getElementById("totalTasksMediumPriorityCount");
  const lowPriorityBreakdownEl    = document.getElementById("totalTasksLowPriorityCount");
  const noPriorityBreakdownEl     = document.getElementById("totalTasksNoPriorityCount");

  if (highPriorityBreakdownEl)   highPriorityBreakdownEl.textContent   = countByPriorityInRange("high", totalTasksRange);
  if (mediumPriorityBreakdownEl) mediumPriorityBreakdownEl.textContent = countByPriorityInRange("medium", totalTasksRange);
  if (lowPriorityBreakdownEl)    lowPriorityBreakdownEl.textContent    = countByPriorityInRange("low", totalTasksRange);
  if (noPriorityBreakdownEl)     noPriorityBreakdownEl.textContent     = countByPriorityInRange("none", totalTasksRange);

  // Priority breakdown for the Completed / Pending / Overdue tabs — each
  // counted within that tab's own status filter + date range.
  const countByPriorityForStatus = (status, priority, range) => tasks.filter(t => {
    const matchesPriority = priority === "none" ? !t.priority : t.priority === priority;
    if (!matchesPriority) return false;

    if (status === "completed") return t.completed && isWithinRange(t.completedAt, range);
    if (status === "pending")   return !t.completed && isWithinRange(t.createdAt, range);
    if (status === "overdue") {
      if (t.completed || !t.dueDate) return false;
      if (new Date(t.dueDate) >= new Date()) return false;
      return isWithinRange(t.dueDate, range);
    }
    return false;
  }).length;

  const setBreakdown = (prefix, status, range) => {
    const highEl   = document.getElementById(`${prefix}PriorityHighCount`);
    const mediumEl = document.getElementById(`${prefix}PriorityMediumCount`);
    const lowEl    = document.getElementById(`${prefix}PriorityLowCount`);
    const noneEl   = document.getElementById(`${prefix}PriorityNoneCount`);

    if (highEl)   highEl.textContent   = countByPriorityForStatus(status, "high", range);
    if (mediumEl) mediumEl.textContent = countByPriorityForStatus(status, "medium", range);
    if (lowEl)    lowEl.textContent    = countByPriorityForStatus(status, "low", range);
    if (noneEl)   noneEl.textContent   = countByPriorityForStatus(status, "none", range);
  };

  setBreakdown("completed", "completed", overviewRanges.completed);
  setBreakdown("pending", "pending", overviewRanges.pending);
  setBreakdown("overdue", "overdue", overviewRanges.overdue);

  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  const completedPercentEl = document.getElementById("completedPercent");
  const pendingPercentEl   = document.getElementById("pendingPercent");

  if (completedPercentEl) completedPercentEl.innerHTML = `<strong>${pct(completed)}%</strong> of total`;
  if (pendingPercentEl)   pendingPercentEl.innerHTML   = `<strong>${pct(pending)}%</strong> of total`;

  // Dashboard cards (separate ids from the Completed / Pending tabs)
  const completedPercentAltEl = document.getElementById("completedPercentAlt");
  const pendingPercentAltEl   = document.getElementById("pendingPercentAlt");
  const overdueCountDashEl    = document.getElementById("overdueCountDashboard");
  const overduePercentAltEl   = document.getElementById("overduePercentAlt");
  const overdueAll            = countPendingOverdue();

  if (completedPercentAltEl) completedPercentAltEl.textContent = `${pct(completed)}% of total`;
  if (pendingPercentAltEl)   pendingPercentAltEl.textContent   = `${pct(pending)}% of total`;
  if (overdueCountDashEl)    overdueCountDashEl.textContent    = overdueAll;
  if (overduePercentAltEl)   overduePercentAltEl.textContent   = `${pct(overdueAll)}% of total`;

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
updateInfoCardBars();
updateDashboardCharts();
}

// ── Info card bars ───────────────────────────────────────────
// Fills the progress bars inside the redesigned info cards:
//  • "Tasks by Priority" rows: each bar = that priority's share of the card's total
//  • "x% of total" bars: width taken from the percentage text (e.g. "22% of total")
function updateInfoCardBars() {
  document.querySelectorAll(".info-card-priority").forEach(card => {
    const rows = [...card.querySelectorAll(".info-row")];
    const counts = rows.map(r => parseInt(r.querySelector(".info-row-count").textContent, 10) || 0);
    const sum = counts.reduce((a, b) => a + b, 0);
    rows.forEach((row, i) => {
      const fill = row.querySelector(".info-bar-fill");
      if (fill) fill.style.width = sum > 0 ? `${Math.round((counts[i] / sum) * 100)}%` : "0%";
    });
  });

  document.querySelectorAll(".info-percent-bar-fill").forEach(fill => {
    const source = document.getElementById(fill.dataset.source);
    const pct = source ? (parseInt(source.textContent, 10) || 0) : 0;
    fill.style.width = `${pct}%`;
  });
}

// ── Dashboard charts ─────────────────────────────────────────
// Five charts shown on the Dashboard. They use their own canvases (dash*)
// and always show ALL-TIME / current-period data (no range pickers):
//  Task Status · Daily Completion Trend (this week) · Weekly Trend (last 5 weeks)
//  Priority Distribution · Monthly Trend (last 6 months)

// Draws each point's value above the point on line charts.
const dashValueLabelsPlugin = {
  id: "dashValueLabels",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      ctx.save();
      ctx.font = "600 11px Poppins, sans-serif";
      ctx.fillStyle = ds.borderColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      meta.data.forEach((point, idx) => ctx.fillText(ds.data[idx], point.x, point.y - 8));
      ctx.restore();
    });
  }
};

function upsertDashLine(chart, canvasId, labels, data, color, fillColor, tooltipLabel) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return chart; // tab markup not present, skip safely

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
    return chart;
  }

  return new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: tooltipLabel,
        data: data,
        borderColor: color,
        backgroundColor: fillColor,
        pointBackgroundColor: color,
        pointRadius: 4,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${tooltipLabel}: ${context.raw}` } }
      },
      scales: {
        y: { beginAtZero: true, grace: "10%", ticks: { precision: 0 } },
        x: { grid: { display: false } }
      }
    },
    plugins: [dashValueLabelsPlugin]
  });
}

function upsertDashDonut(chart, canvasId, labels, data, colors) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return chart;

  if (chart) {
    chart.data.datasets[0].data = data;
    chart.update();
    return chart;
  }

  return new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, spacing: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "64%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const sum = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = sum > 0 ? Math.round((context.raw / sum) * 1000) / 10 : 0;
              return `${context.label}: ${context.raw} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// Legend to the right of a donut: dot · label · "69.5% (89)"
function renderDashLegend(listEl, items, total) {
  if (!listEl) return;
  listEl.innerHTML = "";
  items.forEach(item => {
    const li = document.createElement("li");

    const dot = document.createElement("span");
    dot.classList.add("info-dot");
    dot.style.background = item.color;

    const label = document.createElement("span");
    label.classList.add("dash-legend-label");
    label.textContent = item.label;

    const value = document.createElement("span");
    value.classList.add("dash-legend-value");
    const pct = total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0;
    value.textContent = `${pct}% (${item.count})`;

    li.appendChild(dot);
    li.appendChild(label);
    li.appendChild(value);
    listEl.appendChild(li);
  });
}

// 1) Task Status — all tasks. The three slices don't overlap, so they add up
//    to the total shown in the centre (Pending here = pending AND not overdue).
function updateDashTaskStatusChart() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const overdue = countPendingOverdue();
  const pending = total - completed - overdue;

  const items = [
    { label: "Completed",           color: "#28a745", count: completed },
    { label: "Pending (not overdue)", color: "#ffc107", count: pending },
    { label: "Overdue",             color: "#dc3545", count: overdue }
  ];

  dashTaskStatusChart = upsertDashDonut(
    dashTaskStatusChart, "dashTaskStatusChart",
    items.map(i => i.label), items.map(i => i.count), items.map(i => i.color)
  );

  const totalEl = document.getElementById("dashTaskStatusTotal");
  if (totalEl) totalEl.textContent = total;
  renderDashLegend(document.getElementById("dashTaskStatusLegend"), items, total);
}

// 2) Daily Completion Trend — this week (Mon → Sun), same data as the
//    Daily Completion chart in Performance Charts.
function updateDashDailyChart() {
  dashDailyChart = upsertDashLine(
    dashDailyChart, "dashDailyChart",
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    computeWeeklyCompletionCounts(),
    "#8b5cf6", "rgba(139, 92, 246, 0.15)", "Completed"
  );
}

// 3) Weekly Trend — tasks completed in each of the last 5 weeks (Mon → Sun),
//    the current week is the last point.
function computeDashWeeklyTrend(weeksCount = 5) {
  const thisWeekStart = getStartOfWeek(new Date());
  const monthShort = (d) => d.toLocaleDateString("en-US", { month: "short" });
  const labels = [];
  const data = [];

  for (let i = weeksCount - 1; i >= 0; i--) {
    const start = new Date(thisWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const nextWeekStart = new Date(start);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);

    labels.push(
      monthShort(start) === monthShort(end)
        ? `${monthShort(start)} ${start.getDate()} - ${end.getDate()}`
        : `${monthShort(start)} ${start.getDate()} - ${monthShort(end)} ${end.getDate()}`
    );

    data.push(tasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d >= start && d < nextWeekStart;
    }).length);
  }

  return { labels, data };
}

function updateDashWeeklyChart() {
  const { labels, data } = computeDashWeeklyTrend(5);
  dashWeeklyChart = upsertDashLine(
    dashWeeklyChart, "dashWeeklyChart", labels, data,
    "#3b82f6", "rgba(59, 130, 246, 0.15)", "Completed"
  );
}

// 4) Priority Distribution — all tasks by priority (No Priority included so the
//    centre total matches the total number of tasks).
function updateDashPriorityChart() {
  const total = tasks.length;
  const countOf = (p) => tasks.filter(t => (p === "none" ? !t.priority : t.priority === p)).length;

  const items = [
    { label: "High",        color: "#dc3545", count: countOf("high") },
    { label: "Medium",      color: "#fd7e14", count: countOf("medium") },
    { label: "Low",         color: "#28a745", count: countOf("low") },
    { label: "No Priority", color: "#9aa0a6", count: countOf("none") }
  ];

  dashPriorityChart = upsertDashDonut(
    dashPriorityChart, "dashPriorityChart",
    items.map(i => i.label), items.map(i => i.count), items.map(i => i.color)
  );

  const totalEl = document.getElementById("dashPriorityTotal");
  if (totalEl) totalEl.textContent = total;
  renderDashLegend(document.getElementById("dashPriorityLegend"), items, total);
}

// 5) Monthly Trend — tasks completed in each of the last 6 months
//    (current month is the last point).
function updateDashMonthlyChart() {
  const now = new Date();
  const labels = [];
  const data = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(monthDate.toLocaleDateString("en-US", { month: "short" }));
    data.push(tasks.filter(t => {
      if (!t.completed || !t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth();
    }).length);
  }

  dashMonthlyChart = upsertDashLine(
    dashMonthlyChart, "dashMonthlyChart", labels, data,
    "#22a447", "rgba(34, 164, 71, 0.15)", "Completed"
  );
}

function updateDashboardCharts() {
  updateDashTaskStatusChart();
  updateDashDailyChart();
  updateDashWeeklyChart();
  updateDashPriorityChart();
  updateDashMonthlyChart();
  updateDashHeatmap();
  updateDashRecentActivity();
}

// 6) Productivity Heatmap — GitHub-style grid: one column per week, one row per
//    weekday (Mon → Sun), covering the last 6 months. Reuses the Heatmap tab's
//    helpers (generateDateRangeArray / groupCompletedTasksByDate / getColorLevel).
function updateDashHeatmap() {
  const grid = document.getElementById("dashHeatmapGrid");
  if (!grid) return; // tab markup not present, skip safely

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const start = getStartOfWeek(sixMonthsAgo); // begins on a Monday, so index % 7 = weekday row
  const dates = generateDateRangeArray(start, today);
  const counts = groupCompletedTasksByDate(start, today);
  const weekCount = Math.ceil(dates.length / 7);

  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `34px repeat(${weekCount}, 16px)`;

  // Weekday labels (column 1)
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((day, row) => {
    const label = document.createElement("span");
    label.classList.add("dash-hm-daylabel");
    label.textContent = day;
    label.style.gridRow = row + 2;
    grid.appendChild(label);
  });

  // Month labels (row 1): placed above the first week of each month.
  // A label is skipped if the next month starts within 3 columns (would overlap).
  const monthStarts = [];
  let previousMonth = -1;
  for (let w = 0; w < weekCount; w++) {
    const month = dates[w * 7].getMonth();
    if (month !== previousMonth) {
      monthStarts.push({ col: w + 2, label: dates[w * 7].toLocaleDateString("en-US", { month: "short" }) });
      previousMonth = month;
    }
  }
  monthStarts.forEach((m, i) => {
    const next = monthStarts[i + 1];
    if (next && next.col - m.col < 3) return;
    const label = document.createElement("span");
    label.classList.add("dash-hm-monthlabel");
    label.textContent = m.label;
    label.style.gridRow = 1;
    label.style.gridColumn = `${m.col} / span 3`;
    grid.appendChild(label);
  });

  // Day cells
  dates.forEach((date, i) => {
    const count = counts[formatHeatmapDateKey(date)] || 0;
    const cell = document.createElement("div");
    cell.classList.add("dash-hm-cell", `lvl-${getColorLevel(count).level}`);
    cell.style.gridRow = (i % 7) + 2;
    cell.style.gridColumn = Math.floor(i / 7) + 2;
    const dateLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    cell.title = `${dateLabel}\nCompleted Tasks: ${count}`;
    grid.appendChild(cell);
  });
}

// 7) Recent Activity — Recently Added / Recently Completed / Upcoming Deadlines
//    (4 items each). Same rules as the Recent Activity tabs; "View all" buttons
//    use data-tab so the existing tab switching handles them.
function renderDashActivityList(listId, items, emptyMessage, metaFn) {
  const listEl = document.getElementById(listId);
  if (!listEl) return;
  listEl.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("dash-act-empty");
    empty.textContent = emptyMessage;
    listEl.appendChild(empty);
    return;
  }

  items.forEach(task => {
    const li = document.createElement("li");
    li.classList.add("dash-act-item");

    const name = document.createElement("span");
    name.classList.add("dash-act-name");
    name.textContent = task.text;
    name.title = task.text;

    const badge = document.createElement("span");
    badge.classList.add("priority-badge", task.priority || "no-priority");
    badge.textContent = task.priority
      ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1)
      : "None";

    const time = document.createElement("span");
    time.classList.add("dash-act-time");
    time.textContent = metaFn(task);

    li.appendChild(name);
    li.appendChild(badge);
    li.appendChild(time);
    listEl.appendChild(li);
  });
}

function updateDashRecentActivity() {
  const LIMIT = 4;

  const added = [...tasks]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, LIMIT);

  const completed = tasks
    .filter(t => t.completed && t.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, LIMIT);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = tasks
    .filter(t => {
      if (t.completed || !t.dueDate) return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due >= today;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, LIMIT);

  renderDashActivityList("dashRecentlyAddedList", added, "No tasks added yet.", t => formatRelativeTime(t.createdAt));
  renderDashActivityList("dashRecentlyCompletedList", completed, "No completed tasks yet.", t => formatRelativeTime(t.completedAt));
  renderDashActivityList("dashUpcomingDeadlinesList", upcoming, "No upcoming deadlines.", t => formatDeadlineStatus(t.dueDate));
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
    showMonths: window.innerWidth < 700 ? 1 : 2,
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

// FEATURE 1 — Recently Added: sorted by createdAt, newest first, all tasks.
function renderRecentlyAdded() {
  const listEl = document.getElementById("recentlyAddedList");
  if (!listEl) return;

  const items = [...tasks]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
// completedAt, newest first, all tasks.
function renderRecentlyCompleted() {
  const listEl = document.getElementById("recentlyCompletedList");
  if (!listEl) return;

  const items = tasks
    .filter(t => t.completed && t.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

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
// today or later, sorted nearest-first, all of them.
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
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

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
    showMonths: window.innerWidth < 700 ? 1 : 2,
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
    showMonths: window.innerWidth < 700 ? 1 : 2,
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
    showMonths: window.innerWidth < 700 ? 1 : 2,
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
    showMonths: window.innerWidth < 700 ? 1 : 2,
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
    showMonths: window.innerWidth < 700 ? 1 : 2,
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
    showMonths: window.innerWidth < 700 ? 1 : 2,
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
    showMonths: window.innerWidth < 700 ? 1 : 2,
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

// ── Total Tasks: filter by actions (All / Completed / Pending / Overdue) ──
initCustomSelect(
  document.getElementById("totalTasksActionFilterDropdown"),
  (value) => {
    totalTasksFilter = value || "all";
    listPagination.totalTasks.page = 1;
    renderTasks();
  }
);

// ── Total Tasks: filter by priority ─────────────────────────
initCustomSelect(
  document.getElementById("totalTasksPriorityFilterDropdown"),
  (value) => {
    totalTasksPriorityFilter = value;
    listPagination.totalTasks.page = 1;
    renderTasks();
  }
);

// ── Total Tasks search ──────────────────────────────────────
if (totalTasksSearchInput) {
  totalTasksSearchInput.addEventListener("input", () => {
    listPagination.totalTasks.page = 1;
    renderTasks();
  });
}

// ── Completed / Pending / Overdue: filter by priority ───────
initCustomSelect(
  document.getElementById("completedPriorityFilterDropdown"),
  (value) => {
    completedPriorityFilter = value;
    listPagination.completed.page = 1;
    renderTasks();
  }
);

initCustomSelect(
  document.getElementById("pendingPriorityFilterDropdown"),
  (value) => {
    pendingPriorityFilter = value;
    listPagination.pending.page = 1;
    renderTasks();
  }
);

initCustomSelect(
  document.getElementById("overduePriorityFilterDropdown"),
  (value) => {
    overduePriorityFilter = value;
    listPagination.overdue.page = 1;
    renderTasks();
  }
);

// ── Completed / Pending / Overdue: search ────────────────────
if (completedSearchInput) {
  completedSearchInput.addEventListener("input", () => {
    listPagination.completed.page = 1;
    renderTasks();
  });
}

if (pendingSearchInput) {
  pendingSearchInput.addEventListener("input", () => {
    listPagination.pending.page = 1;
    renderTasks();
  });
}

if (overdueSearchInput) {
  overdueSearchInput.addEventListener("input", () => {
    listPagination.overdue.page = 1;
    renderTasks();
  });
}

if (dueDateInput) {
  flatpickr("#dueDate", {
    enableTime: true,
    time_24hr: !use12Hour(),
    dateFormat: getDueDateFormat()
  });
}

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
  // Top bar title follows the active section (greeting on Dashboard)
  if (typeof window.renderTopbarGreeting === "function") window.renderTopbarGreeting();
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
  if (tabName === "dashboard") {
    [dashTaskStatusChart, dashDailyChart, dashWeeklyChart, dashPriorityChart, dashMonthlyChart]
      .forEach(c => { if (c) c.resize(); });
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

// ── Theme: dark / light toggle ───────────────────────────────
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeToggleIcon = themeToggleBtn ? themeToggleBtn.querySelector("i") : null;

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    if (themeToggleIcon) {
      themeToggleIcon.classList.remove("fa-moon");
      themeToggleIcon.classList.add("fa-sun");
    }
    if (themeToggleBtn) themeToggleBtn.title = "Switch to light theme";
  } else {
    document.documentElement.removeAttribute("data-theme");
    if (themeToggleIcon) {
      themeToggleIcon.classList.remove("fa-sun");
      themeToggleIcon.classList.add("fa-moon");
    }
    if (themeToggleBtn) themeToggleBtn.title = "Switch to dark theme";
  }
}

function getPreferredTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || saved === "light") return saved;
  // Fall back to the user's OS-level preference the first time they visit
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

applyTheme(getPreferredTheme());

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const nextTheme = isDark ? "light" : "dark";
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  });
}

// ── Confirm Modal (mark-as-incomplete / delete) ─────────────
const confirmModalOverlay = document.getElementById("confirmModalOverlay");
const confirmModalTitle   = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const confirmModalYesBtn  = document.getElementById("confirmModalYesBtn");
const confirmModalNoBtn   = document.getElementById("confirmModalNoBtn");
let pendingConfirmAction = null;

function openConfirmModal({ title = "Are you sure?", message = "", onConfirm = null, onCancel = null }) {
  if (!confirmModalOverlay) return;
  if (confirmModalTitle) confirmModalTitle.textContent = title;
  if (confirmModalMessage) confirmModalMessage.textContent = message;
  pendingConfirmAction = { onConfirm, onCancel };
  confirmModalOverlay.classList.add("open");
}

function closeConfirmModal() {
  if (confirmModalOverlay) confirmModalOverlay.classList.remove("open");
  pendingConfirmAction = null;
}

if (confirmModalYesBtn) {
  confirmModalYesBtn.addEventListener("click", () => {
    const action = pendingConfirmAction;
    closeConfirmModal();
    if (action && typeof action.onConfirm === "function") action.onConfirm();
  });
}

if (confirmModalNoBtn) {
  confirmModalNoBtn.addEventListener("click", () => {
    const action = pendingConfirmAction;
    closeConfirmModal();
    if (action && typeof action.onCancel === "function") action.onCancel();
  });
}

if (confirmModalOverlay) {
  confirmModalOverlay.addEventListener("click", (e) => {
    if (e.target !== confirmModalOverlay) return;
    const action = pendingConfirmAction;
    closeConfirmModal();
    if (action && typeof action.onCancel === "function") action.onCancel();
  });
}

// ── Edit Task Modal ──────────────────────────────────────────
const editTaskModalOverlay = document.getElementById("editTaskModalOverlay");
const editTaskTextInput    = document.getElementById("editTaskText");
const editTaskDueDateInput = document.getElementById("editTaskDueDate");
const editTaskSaveBtn      = document.getElementById("editTaskSaveBtn");
const editTaskCancelBtn    = document.getElementById("editTaskCancelBtn");
let taskBeingEdited = null;
let editTaskPriorityValue = "";
let editTaskDueDatePicker = null;

const editTaskPriorityLabels = { "": "No Priority", high: "High", medium: "Medium", low: "Low" };
const editTaskPriorityDropdown = initCustomSelect(
  document.getElementById("editTaskPriorityDropdown"),
  (value) => { editTaskPriorityValue = value; }
);

if (editTaskDueDateInput) {
  editTaskDueDatePicker = flatpickr(editTaskDueDateInput, {
    enableTime: true,
    time_24hr: !use12Hour(),
    dateFormat: getDueDateFormat()
  });
}

function openEditTaskModal(task) {
  if (!editTaskModalOverlay) return;
  taskBeingEdited = task;

  if (editTaskTextInput) editTaskTextInput.value = task.text;

  editTaskPriorityValue = task.priority || "";
  if (editTaskPriorityDropdown) {
    editTaskPriorityDropdown.setValue(editTaskPriorityValue, editTaskPriorityLabels[editTaskPriorityValue] || "No Priority");
  }

  if (editTaskDueDatePicker) {
    if (task.dueDate) editTaskDueDatePicker.setDate(new Date(task.dueDate), false);
    else editTaskDueDatePicker.clear();
  }

  editTaskModalOverlay.classList.add("open");
}

function closeEditTaskModal() {
  if (editTaskModalOverlay) editTaskModalOverlay.classList.remove("open");
  taskBeingEdited = null;
}

if (editTaskSaveBtn) {
  editTaskSaveBtn.addEventListener("click", () => {
    if (!taskBeingEdited) return;

    const newText = editTaskTextInput ? editTaskTextInput.value.trim() : "";
    if (newText === "") { alert("Please enter a task"); return; }

    taskBeingEdited.text = newText;
    taskBeingEdited.priority = editTaskPriorityValue;
    taskBeingEdited.dueDate = editTaskDueDateInput ? editTaskDueDateInput.value : "";

    saveToLocalStorage();
    renderTasks();
    closeEditTaskModal();
  });
}

if (editTaskCancelBtn) {
  editTaskCancelBtn.addEventListener("click", closeEditTaskModal);
}

if (editTaskModalOverlay) {
  editTaskModalOverlay.addEventListener("click", (e) => {
    if (e.target === editTaskModalOverlay) closeEditTaskModal();
  });
}

// ── Add Task Modal (opened by the top bar "Add Task" button) ──
const addTaskModalOverlay = document.getElementById("addTaskModalOverlay");
const addTaskModalTextInput = document.getElementById("addTaskModalText");
const addTaskModalDueDateInput = document.getElementById("addTaskModalDueDate");
const addTaskModalSaveBtn = document.getElementById("addTaskModalSaveBtn");
const addTaskModalCancelBtn = document.getElementById("addTaskModalCancelBtn");
let addTaskModalPriorityValue = "";
let addTaskModalDueDatePicker = null;

const addTaskModalPriorityDropdown = initCustomSelect(
  document.getElementById("addTaskModalPriorityDropdown"),
  (value) => { addTaskModalPriorityValue = value; }
);

if (addTaskModalDueDateInput) {
  addTaskModalDueDatePicker = flatpickr(addTaskModalDueDateInput, {
    enableTime: true,
    time_24hr: !use12Hour(),
    dateFormat: getDueDateFormat()
  });
}

function openAddTaskModal() {
  if (!addTaskModalOverlay) return;

  // Always start with a clean form
  if (addTaskModalTextInput) addTaskModalTextInput.value = "";
  addTaskModalPriorityValue = "";
  if (addTaskModalPriorityDropdown) addTaskModalPriorityDropdown.setValue("", "No Priority");
  if (addTaskModalDueDatePicker) addTaskModalDueDatePicker.clear();

  addTaskModalOverlay.classList.add("open");
  setTimeout(() => addTaskModalTextInput && addTaskModalTextInput.focus(), 60);
}

function closeAddTaskModal() {
  if (addTaskModalOverlay) addTaskModalOverlay.classList.remove("open");
}

function saveAddTaskModal() {
  const taskText = addTaskModalTextInput ? addTaskModalTextInput.value.trim() : "";
  if (taskText === "") { alert("Please enter a task"); return; }

  tasks.push({
    text: taskText,
    completed: false,
    priority: addTaskModalPriorityValue,
    dueDate: addTaskModalDueDateInput ? addTaskModalDueDateInput.value : "",
    createdAt: new Date().toISOString(),
    completedAt: null
  });
  saveToLocalStorage();
  renderTasks();
  closeAddTaskModal();
}

if (addTaskModalSaveBtn) addTaskModalSaveBtn.addEventListener("click", saveAddTaskModal);
if (addTaskModalCancelBtn) addTaskModalCancelBtn.addEventListener("click", closeAddTaskModal);

if (addTaskModalTextInput) {
  addTaskModalTextInput.addEventListener("keypress", (e) => { if (e.key === "Enter") saveAddTaskModal(); });
}

if (addTaskModalOverlay) {
  addTaskModalOverlay.addEventListener("click", (e) => {
    if (e.target === addTaskModalOverlay) closeAddTaskModal();
  });
}

// Esc closes whichever modal is currently open
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (confirmModalOverlay && confirmModalOverlay.classList.contains("open")) {
    const action = pendingConfirmAction;
    closeConfirmModal();
    if (action && typeof action.onCancel === "function") action.onCancel();
  } else if (editTaskModalOverlay && editTaskModalOverlay.classList.contains("open")) {
    closeEditTaskModal();
  } else if (addTaskModalOverlay && addTaskModalOverlay.classList.contains("open")) {
    closeAddTaskModal();
  }
});

// ── Profile tab ───────────────────────────────────────────────
(function initProfileTab() {
  const form = document.getElementById("profileForm");
  if (!form) return; // tab markup not present, skip safely

  const fullNameInput   = document.getElementById("profileFullName");
  const usernameInput   = document.getElementById("profileUsername");
  const professionInput = document.getElementById("profileProfession");
  const bioInput        = document.getElementById("profileBio");
  const bioCountEl      = document.getElementById("profileBioCount");
  const photoInput      = document.getElementById("profilePhotoInput");
  const uploadBtn       = document.getElementById("profilePhotoUploadBtn");
  const removeBtn       = document.getElementById("profilePhotoRemoveBtn");
  const previewEl       = document.getElementById("profileAvatarPreview");
  const initialsEl      = document.getElementById("profileAvatarInitials");
  const photoErrorEl    = document.getElementById("profilePhotoError");
  const fullNameError   = document.getElementById("profileFullNameError");
  const usernameError   = document.getElementById("profileUsernameError");
  const statusEl        = document.getElementById("profileSaveStatus");
  const cancelBtn       = document.getElementById("profileCancelBtn");
  const timeFormatRadios = form.querySelectorAll('input[name="profileTimeFormat"]');

  let pendingAvatar = ""; // photo chosen in the form but not saved yet
  let statusTimer = null;

  function renderAvatarPreview() {
    if (pendingAvatar) {
      previewEl.style.backgroundImage = `url(${pendingAvatar})`;
      initialsEl.textContent = "";
    } else {
      previewEl.style.backgroundImage = "";
      const first = fullNameInput.value.trim().charAt(0);
      if (first) initialsEl.textContent = first.toUpperCase();
      else initialsEl.innerHTML = '<i class="fa-solid fa-user"></i>';
    }
    removeBtn.disabled = !pendingAvatar;
  }

  function updateBioCount() {
    bioCountEl.textContent = bioInput.value.length;
  }

  function clearErrors() {
    fullNameError.textContent = "";
    usernameError.textContent = "";
    photoErrorEl.textContent = "";
    fullNameInput.classList.remove("invalid");
    usernameInput.classList.remove("invalid");
  }

  function getSelectedTimeFormat() {
    const checked = form.querySelector('input[name="profileTimeFormat"]:checked');
    return checked ? checked.value : "12";
  }

  // Load the saved profile into the form
  function fillForm() {
    const profile = loadProfile();
    fullNameInput.value   = profile.fullName   || "";
    usernameInput.value   = profile.username   || "";
    professionInput.value = profile.profession || "";
    bioInput.value        = profile.bio        || "";
    timeFormatRadios.forEach(r => { r.checked = r.value === (profile.timeFormat === "24" ? "24" : "12"); });
    pendingAvatar = profile.avatar || "";
    clearErrors();
    updateBioCount();
    renderAvatarPreview();
  }

  // Crop to a centred square and shrink, so the saved photo stays small
  function imageFileToDataUrl(file, size = 256) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff"; // keeps transparent PNGs from turning black in JPEG
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  uploadBtn.addEventListener("click", () => photoInput.click());

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files && photoInput.files[0];
    photoInput.value = ""; // lets the same file be picked again later
    if (!file) return;

    photoErrorEl.textContent = "";
    if (!file.type.startsWith("image/")) {
      photoErrorEl.textContent = "Please choose an image file.";
      return;
    }
    try {
      pendingAvatar = await imageFileToDataUrl(file);
      renderAvatarPreview();
    } catch (e) {
      photoErrorEl.textContent = "Couldn't read that image. Try another one.";
    }
  });

  removeBtn.addEventListener("click", () => {
    pendingAvatar = "";
    renderAvatarPreview();
  });

  bioInput.addEventListener("input", updateBioCount);
  fullNameInput.addEventListener("input", () => {
    fullNameError.textContent = "";
    fullNameInput.classList.remove("invalid");
    if (!pendingAvatar) renderAvatarPreview(); // keep the initial letter in sync
  });
  usernameInput.addEventListener("input", () => {
    usernameError.textContent = "";
    usernameInput.classList.remove("invalid");
  });

  function showSavedStatus() {
    statusEl.classList.add("visible");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => statusEl.classList.remove("visible"), 2500);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    clearErrors();

    const fullName = fullNameInput.value.trim();
    const username = usernameInput.value.trim().replace(/^@/, "");
    let valid = true;

    if (fullName === "") {
      fullNameError.textContent = "Please enter your full name.";
      fullNameInput.classList.add("invalid");
      valid = false;
    }
    if (username !== "" && !/^[A-Za-z0-9._]{3,20}$/.test(username)) {
      usernameError.textContent = "Use 3–20 letters, numbers, dots or underscores.";
      usernameInput.classList.add("invalid");
      valid = false;
    }
    if (!valid) return;

    try {
      saveProfile({
        fullName,
        username,
        profession: professionInput.value.trim(),
        bio: bioInput.value.trim(),
        avatar: pendingAvatar,
        timeFormat: getSelectedTimeFormat()
      });
    } catch (err) {
      photoErrorEl.textContent = "Couldn't save — browser storage is full. Try a smaller photo.";
      return;
    }

    // The greeting uses the first name
    localStorage.setItem("topbar_user_name", fullName.split(/\s+/)[0]);
    usernameInput.value = username;

    // Apply the time format to the due-date pickers, task lists, and top bar
    [addTaskModalDueDatePicker, editTaskDueDatePicker].forEach(picker => {
      if (!picker) return;
      picker.set("time_24hr", !use12Hour());
      picker.set("dateFormat", getDueDateFormat());
    });
    renderTasks();
    if (typeof window.renderTopbarGreeting === "function") window.renderTopbarGreeting();

    showSavedStatus();
  });

  cancelBtn.addEventListener("click", () => {
    fillForm();
    statusEl.classList.remove("visible");
  });

  fillForm();
})();

// ── Init ──────────────────────────────────────────────────
loadTasks();
renderTasks();
let savedTab = localStorage.getItem("activeTab") || "dashboard";
// Settings / Plugins were removed — fall back to Dashboard if one of them was the last open tab
if (!document.getElementById(`tab-${savedTab}`)) savedTab = "dashboard";
activateTab(savedTab);














/* =====================================================================
   STICKY TOP BAR — greeting, date, add-task shortcut, profile, theme
   ===================================================================== */

(function initTopbar() {

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  function formatDate(d) {
    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
    const nth = (n) => {
      if (n > 3 && n < 21) return n + 'th';
      return n + ['th','st','nd','rd'][n % 10 > 3 ? 0 : n % 10];
    };
    return `${days[d.getDay()]}, ${nth(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function getUserName() {
    return localStorage.getItem('topbar_user_name') || 'there';
  }

  function setUserName(name) {
    const trimmed = name.trim() || 'there';
    localStorage.setItem('topbar_user_name', trimmed);
    return trimmed;
  }

  function renderGreeting() {
    const greetingEl = document.getElementById('topbarGreeting');
    const dateEl     = document.getElementById('topbarDate');
    const avatarEl   = document.getElementById('topbarAvatarInitials');
    const nameEl     = document.getElementById('topbarProfileName');

    const name = getUserName();

    // Dashboard keeps the greeting; every other section shows its own title
    // (read from that section's heading), the date stays the same.
    const activeTab = localStorage.getItem('activeTab') || 'dashboard';
    const sectionHead = document.querySelector(`#tab-${activeTab} .head`);
    const greetingText = (activeTab !== 'dashboard' && sectionHead)
      ? sectionHead.textContent.trim()
      : `Hi ${name}, ${getGreeting()}`;

    if (greetingEl) greetingEl.textContent = greetingText;
    if (dateEl)     dateEl.textContent     = formatDate(new Date());
    const profile = loadProfile();
    const avatarBox = document.getElementById('topbarAvatar');
    const roleEl    = document.getElementById('topbarProfileRole');

    if (avatarEl)   avatarEl.textContent   = profile.avatar ? '' : (name === 'there' ? '👤' : name[0].toUpperCase());
    if (nameEl)     nameEl.textContent     = profile.username ? `@${profile.username}` : (profile.fullName || (name === 'there' ? 'User' : name));
    if (roleEl)     roleEl.textContent     = profile.profession || 'Task Manager';
    if (avatarBox) {
      avatarBox.style.backgroundImage    = profile.avatar ? `url(${profile.avatar})` : '';
      avatarBox.style.backgroundSize     = 'cover';
      avatarBox.style.backgroundPosition = 'center';
    }
  }

  window.renderTopbarGreeting = renderGreeting;
  renderGreeting();

  // Refresh greeting at top of every new minute
  const msUntilNextMin = (60 - new Date().getSeconds()) * 1000;
  setTimeout(() => { renderGreeting(); setInterval(renderGreeting, 60_000); }, msUntilNextMin);

  // ── Profile dropdown ────────────────────────────────────────────────
  const profileWrapper = document.getElementById('topbarProfile');
  const avatar         = document.getElementById('topbarAvatar');

  if (avatar && profileWrapper) {
    avatar.addEventListener('click', (e) => {
      e.stopPropagation();
      profileWrapper.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!profileWrapper.contains(e.target)) profileWrapper.classList.remove('open');
    });
  }

  // ── Edit name modal ─────────────────────────────────────────────────
  const editNameBtn      = document.getElementById('topbarEditNameBtn');
  const nameModalOverlay = document.getElementById('topbarNameModalOverlay');
  const nameInput        = document.getElementById('topbarNameInput');
  const nameSaveBtn      = document.getElementById('topbarNameSaveBtn');
  const nameCancelBtn    = document.getElementById('topbarNameCancelBtn');

  function openNameModal() {
    const name = getUserName();
    if (nameInput) nameInput.value = name === 'there' ? '' : name;
    if (nameModalOverlay) nameModalOverlay.classList.add('open');
    if (profileWrapper)   profileWrapper.classList.remove('open');
    setTimeout(() => nameInput && nameInput.focus(), 60);
  }

  function closeNameModal() {
    if (nameModalOverlay) nameModalOverlay.classList.remove('open');
  }

  // "Edit Profile" now opens the Profile page instead of the name popup
  if (editNameBtn) {
    editNameBtn.addEventListener('click', () => {
      if (profileWrapper) profileWrapper.classList.remove('open');
      activateTab('profile');
    });
  }
  if (nameCancelBtn)    nameCancelBtn.addEventListener('click', closeNameModal);
  if (nameModalOverlay) nameModalOverlay.addEventListener('click', (e) => {
    if (e.target === nameModalOverlay) closeNameModal();
  });

  if (nameSaveBtn) {
    nameSaveBtn.addEventListener('click', () => {
      if (nameInput) { setUserName(nameInput.value); renderGreeting(); closeNameModal(); }
    });
  }

  if (nameInput) {
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  nameSaveBtn && nameSaveBtn.click();
      if (e.key === 'Escape') closeNameModal();
    });
  }

  // First-visit: ask for name automatically
  if (!localStorage.getItem('topbar_user_name')) {
    setTimeout(openNameModal, 800);
  }

  // ── Add Task shortcut ───────────────────────────────────────────────
  const topbarAddBtn = document.getElementById('topbarAddTaskBtn');
  if (topbarAddBtn) {
    topbarAddBtn.addEventListener('click', () => {
      openAddTaskModal();
    });
  }

})();


/* =====================================================================
   RESPONSIVE SIDEBAR — off-canvas drawer on tablet / mobile (≤1024px)
   Opened by the hamburger in the top bar; closed by the ✕ button, the dim
   backdrop, the Esc key, choosing a page, or growing the window to desktop.
   ===================================================================== */
(function initSidebarDrawer() {
  const sidebar    = document.getElementById('appSidebar');
  const toggleBtn  = document.getElementById('sidebarToggleBtn');
  const closeBtn   = document.getElementById('sidebarCloseBtn');
  const backdrop   = document.getElementById('sidebarBackdrop');
  if (!sidebar || !toggleBtn) return; // markup not present, skip safely

  const desktopQuery = window.matchMedia('(min-width: 1025px)');

  function isOpen() {
    return document.body.classList.contains('sidebar-open');
  }

  function openDrawer() {
    document.body.classList.add('sidebar-open');
    toggleBtn.setAttribute('aria-expanded', 'true');
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer(restoreFocus = true) {
    if (!isOpen()) return;
    document.body.classList.remove('sidebar-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggleBtn.focus();
  }

  toggleBtn.addEventListener('click', () => (isOpen() ? closeDrawer() : openDrawer()));
  if (closeBtn) closeBtn.addEventListener('click', () => closeDrawer());
  if (backdrop) backdrop.addEventListener('click', () => closeDrawer());

  // Picking a page (any sidebar item that switches tabs) closes the drawer
  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('[data-tab]')) closeDrawer(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Window grew to desktop size: reset so the sidebar is simply visible
  desktopQuery.addEventListener('change', (e) => {
    if (e.matches) closeDrawer(false);
  });
})();