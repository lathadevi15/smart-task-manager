// ── Elements ──────────────────────────────────────────────
const input       = document.getElementById("taskInput");
const button      = document.getElementById("addBtn");
const taskList          = document.getElementById("taskList");          // Dashboard recent-activity list
const totalTaskList     = document.getElementById("totalTaskList");     // Total Tasks list
const completedTaskList = document.getElementById("completedTaskList"); // Completed list
const pendingTaskList   = document.getElementById("pendingTaskList");   // Pending list
const totalTasksSearchInput = document.getElementById("totalTasksSearchInput"); // Total Tasks search
const dueDateInput = document.getElementById("dueDate");

// Custom Dropdown
const customSelect = document.querySelector(".custom-select");
const selected     = document.querySelector(".selected span:first-child");
const options      = document.querySelectorAll(".options li");

// ── State ─────────────────────────────────────────────────
let tasks            = [];
let totalTasksFilter  = "all";     // for Total Tasks tab
let selectedPriority = "";
let taskStatusChart = null;

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
    createdAt: new Date().toISOString()
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
    saveToLocalStorage();
    renderTasks();
  });

  const span = document.createElement("span");
  span.classList.add("task-text");

  const due = document.createElement("small");
  due.classList.add("task-due");
  if (task.dueDate) {
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
  if (task.dueDate) {
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
function populateList(ulElement, filter, searchText) {
  if (!ulElement) return;
  ulElement.innerHTML = "";

  let filtered = [...tasks];

  if (filter === "completed") filtered = filtered.filter(t => t.completed);
  else if (filter === "pending") filtered = filtered.filter(t => !t.completed);
  else if (filter === "recent") {
    // Reverse to show newest first, then take only the 10 most recent
    filtered = [...tasks].reverse().slice(0, 10);
  }

  if (searchText) {
    filtered = filtered.filter(t => t.text.toLowerCase().includes(searchText.toLowerCase()));
  }

  filtered.forEach(task => ulElement.appendChild(buildTaskItem(task)));
}

// ── Render ALL tabs at once ────────────────────────────────
function renderTasks() {
  const totalTasksSearch = totalTasksSearchInput ? totalTasksSearchInput.value : "";

  // Dashboard — Recent Activity (last 10 tasks, newest first)
  populateList(taskList, "recent", "");

  // Total Tasks tab
  populateList(totalTaskList, totalTasksFilter, totalTasksSearch);

  // Completed tab — always shows only completed
  populateList(completedTaskList, "completed", "");

  // Pending tab — always shows only pending
  populateList(pendingTaskList, "pending", "");

  updateStats();
}

// ── Stats ─────────────────────────────────────────────────
function updateStats() {
  const total       = tasks.length;
  const completed   = tasks.filter(t => t.completed).length;
  const pending     = tasks.filter(t => !t.completed).length;
  const highPending = tasks.filter(t => t.priority === "high" && !t.completed).length;

  // Dashboard cards
  const totalCountEl        = document.getElementById("totalCount");
  const completedCountEl    = document.getElementById("completedCount");
  const pendingCountEl      = document.getElementById("pendingCount");
  const highPriorityCountEl = document.getElementById("highPriorityCount");

  if (totalCountEl)        totalCountEl.textContent        = total;
  if (completedCountEl)    completedCountEl.textContent    = completed;
  if (pendingCountEl)      pendingCountEl.textContent      = pending;
  if (highPriorityCountEl) highPriorityCountEl.textContent = highPending;

  // Total Tasks tab's own card (separate id to avoid duplicate-id clash with dashboard)
  const totalCountAltEl = document.getElementById("totalCountAlt");
  if (totalCountAltEl) totalCountAltEl.textContent = total;

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
updateTaskStatusChart(
    completed,
    pending,
    overdue
);
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

// ── Total Tasks tab filter buttons ─────────────────────────
const totalTasksAllBtn       = document.getElementById("totalTasksAllBtn");
const totalTasksCompletedBtn = document.getElementById("totalTasksCompletedBtn");
const totalTasksPendingBtn   = document.getElementById("totalTasksPendingBtn");

if (totalTasksAllBtn) {
  totalTasksAllBtn.addEventListener("click", () => {
    totalTasksFilter = "all"; renderTasks();
  });
}
if (totalTasksCompletedBtn) {
  totalTasksCompletedBtn.addEventListener("click", () => {
    totalTasksFilter = "completed"; renderTasks();
  });
}
if (totalTasksPendingBtn) {
  totalTasksPendingBtn.addEventListener("click", () => {
    totalTasksFilter = "pending"; renderTasks();
  });
}

// ── Total Tasks search ──────────────────────────────────────
if (totalTasksSearchInput) {
  totalTasksSearchInput.addEventListener("input", renderTasks);
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
activateTab("dashboard"); // Dashboard is the default landing view