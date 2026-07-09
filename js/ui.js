// Sort button highlight
const buttons = document.querySelectorAll('.sortBtn');
buttons.forEach(button => {
  button.addEventListener('click', () => {
    // Only highlight within the same parent group
    const siblings = button.closest('.sort-taks').querySelectorAll('.sortBtn');
    siblings.forEach(btn => btn.classList.remove('selected'));
    button.classList.add('selected');
  });
});

// Sidebar tab switching
const menuBtns    = document.querySelectorAll('.menu-btn[data-tab]');
const tabSections = document.querySelectorAll('.tab-section');

menuBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    menuBtns.forEach(b => b.classList.remove('active'));
    tabSections.forEach(s => s.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});