// ── Sidebar accordion + scroll-to-section navigation ───────
// Self-contained: does not depend on app.js / ui.js, so it
// won't conflict with your existing tab-switching logic.

document.addEventListener("DOMContentLoaded", () => {
  const dashboardBtn      = document.getElementById("dashboardMenuBtn");
  const dashboardSubmenu  = document.getElementById("dashboardSubmenu");

  function switchToTab(tabName) {
    document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));

    const section = document.getElementById("tab-" + tabName);
    if (section) section.classList.add("active");

    const btn = document.querySelector(`.menu-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add("active");
  }

  // Generic tab switching for every sidebar button (Dashboard, All Tasks,
  // Completed, Pending, Categories, Settings, Plugins). Safe to run even if
  // similar logic already exists elsewhere — it's idempotent.
  document.querySelectorAll(".menu-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchToTab(btn.dataset.tab);
    });
  });

  // Clicking "Dashboard" also opens/closes its submenu
  if (dashboardBtn && dashboardSubmenu) {
    dashboardBtn.addEventListener("click", () => {
      dashboardSubmenu.classList.toggle("open");
    });
  }

  // Group headings: Overview Cards / Performance Charts / Insights / Recent Activity
  document.querySelectorAll(".submenu-heading").forEach(heading => {
    heading.addEventListener("click", (e) => {
      e.stopPropagation();

      const itemsList = heading.nextElementSibling;
      const wasOpen    = itemsList.classList.contains("open");

      // Accordion behavior: only one group open at a time
      dashboardSubmenu.querySelectorAll(".submenu-items").forEach(el => el.classList.remove("open"));
      dashboardSubmenu.querySelectorAll(".submenu-heading").forEach(el => el.classList.remove("open"));

      if (!wasOpen) {
        itemsList.classList.add("open");
        heading.classList.add("open");
      }

      dashboardSubmenu.classList.add("open");
      switchToTab("dashboard");

      const target = document.getElementById(heading.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Individual sub-items: e.g. "Total Tasks", "Weekly Trend", "Best Day"
  document.querySelectorAll(".submenu-items a").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      switchToTab("dashboard");
      dashboardSubmenu.classList.add("open");

      const targetId = link.dataset.scroll;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("highlight-flash");
        setTimeout(() => target.classList.remove("highlight-flash"), 1200);
      }
    });
  });
});
