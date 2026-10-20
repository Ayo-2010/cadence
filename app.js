const STORAGE_KEY = 'cadence-habits-v1';
const COLORS = ['#e76f51', '#2a9d8f', '#e0b34a', '#8f6b8f', '#5b7fa3', '#c06c84'];
const EMOJIS = ['✦', '✎', '◒', '☼', '⌁', '❋', '◍', '⌂'];
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const state = {
  habits: [],
  weeks: 12,
  draftColor: COLORS[0]
};

const $ = (id) => document.getElementById(id);

function toKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayKey() {
  return toKey(TODAY);
}

function daysAgo(offset) {
  const date = new Date(TODAY);
  date.setDate(date.getDate() - offset);
  return date;
}

function makeSeed() {
  const patterns = [
    { name: 'Read 20 minutes', emoji: '✎', color: '#2a9d8f', match: (n) => n % 7 !== 3 && n % 11 !== 0 },
    { name: 'Morning walk', emoji: '☼', color: '#e76f51', match: (n) => n % 2 === 0 && n % 9 !== 1 },
    { name: 'Drink water', emoji: '◒', color: '#5b7fa3', match: (n) => n % 3 !== 1 },
    { name: 'Evening journal', emoji: '❋', color: '#8f6b8f', match: (n) => n % 7 === 1 || n % 7 === 3 || n % 7 === 5 }
  ];
  return patterns.map((pattern, index) => {
    const logs = {};
    for (let offset = 0; offset < 130; offset += 1) {
      if (pattern.match(offset)) logs[toKey(daysAgo(offset))] = true;
    }
    return { id: `seed-${index}`, name: pattern.name, emoji: pattern.emoji, color: pattern.color, logs };
  });
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.habits)) {
      state.habits = stored.habits.map((habit) => ({
        id: habit.id || `habit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: habit.name || 'Untitled habit',
        emoji: habit.emoji || '✦',
        color: habit.color || COLORS[0],
        logs: habit.logs && typeof habit.logs === 'object' ? habit.logs : {}
      }));
      state.weeks = [8, 12, 16].includes(stored.weeks) ? stored.weeks : 12;
      return;
    }
  } catch (error) {}
  state.habits = makeSeed();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ habits: state.habits, weeks: state.weeks }));
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mondayOf(date) {
  const copy = new Date(date);
  const shift = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - shift);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function heatmapDates() {
  const start = mondayOf(TODAY);
  start.setDate(start.getDate() - (state.weeks - 1) * 7);
  const dates = [];
  for (let i = 0; i < state.weeks * 7; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function streak(habit) {
  let count = 0;
  const cursor = new Date(TODAY);
  if (!habit.logs[toKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  while (habit.logs[toKey(cursor)]) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function rate(habit, days) {
  let done = 0;
  for (let offset = 0; offset < days; offset += 1) {
    if (habit.logs[toKey(daysAgo(offset))]) done += 1;
  }
  return Math.round((done / days) * 100);
}

function toggle(habitId, key) {
  const habit = state.habits.find((item) => item.id === habitId);
  if (!habit) return;
  if (habit.logs[key]) delete habit.logs[key];
  else habit.logs[key] = true;
  saveState();
  renderAll();
}

function renderSummary() {
  const total = state.habits.length;
  const done = state.habits.filter((habit) => habit.logs[todayKey()]).length;
  const best = state.habits.reduce((max, habit) => Math.max(max, streak(habit)), 0);
  let checks = 0;
  state.habits.forEach((habit) => {
    for (let offset = 0; offset < 30; offset += 1) {
      if (habit.logs[toKey(daysAgo(offset))]) checks += 1;
    }
  });
  const rate30 = total ? Math.round((checks / (total * 30)) * 100) : 0;
  $('summary').innerHTML = `
    <div><strong>${done}<span class="summary-slash">/${total}</span></strong><small>done today</small></div>
    <div><strong>${best}</strong><small>day best streak</small></div>
    <div><strong>${rate30}%</strong><small>last 30 days</small></div>
  `;
}

function renderHabits() {
  const box = $('habits');
  box.innerHTML = '';
  $('weekday-labels').textContent = `Each column is a week · rows run Monday to Sunday · ${state.weeks} weeks`;
  if (!state.habits.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-habits';
    empty.innerHTML = '<p>No habits yet. Add the first small thing you want to keep.</p>';
    box.appendChild(empty);
    return;
  }
  const dates = heatmapDates();
  state.habits.forEach((habit) => {
    const row = document.createElement('div');
    row.className = 'habit-row';
    row.style.setProperty('--c', habit.color);
    const name = document.createElement('div');
    name.className = 'habit-name';
    name.innerHTML = `<span class="habit-icon">${habit.emoji}</span><div class="habit-title"><b>${escapeHtml(habit.name)}</b><small>${streak(habit)} day streak · ${rate(habit, 30)}% this month</small></div>`;
    row.appendChild(name);

    const todayButton = document.createElement('button');
    todayButton.type = 'button';
    todayButton.className = `today-check${habit.logs[todayKey()] ? ' done' : ''}`;
    todayButton.textContent = habit.logs[todayKey()] ? '✓' : '';
    todayButton.title = habit.logs[todayKey()] ? `Unmark ${habit.name} today` : `Mark ${habit.name} today`;
    todayButton.setAttribute('aria-label', todayButton.title);
    todayButton.addEventListener('click', () => toggle(habit.id, todayKey()));
    row.appendChild(todayButton);

    const heatmap = document.createElement('div');
    heatmap.className = 'heatmap';
    dates.forEach((date) => {
      const key = toKey(date);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'heat-cell';
      const isFuture = date > TODAY;
      if (habit.logs[key]) cell.classList.add('done');
      if (key === todayKey()) cell.classList.add('today');
      if (isFuture) cell.disabled = true;
      cell.title = `${date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}${isFuture ? ' · future' : habit.logs[key] ? ' · done' : ' · not done'}`;
      cell.setAttribute('aria-label', cell.title);
      cell.setAttribute('aria-pressed', habit.logs[key] ? 'true' : 'false');
      cell.addEventListener('click', () => {
        if (!isFuture) toggle(habit.id, key);
      });
      heatmap.appendChild(cell);
    });
    row.appendChild(heatmap);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-habit';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Delete ${habit.name}`);
    remove.addEventListener('click', () => {
      if (!window.confirm(`Delete “${habit.name}”? Its history will be removed too.`)) return;
      state.habits = state.habits.filter((item) => item.id !== habit.id);
      saveState();
      renderAll();
      showToast('Habit deleted');
    });
    row.appendChild(remove);
    box.appendChild(row);
  });
}

function renderChart() {
  const chart = $('bar-chart');
  chart.innerHTML = '';
  const counts = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const key = toKey(daysAgo(offset));
    counts.push({
      date: daysAgo(offset),
      count: state.habits.filter((habit) => habit.logs[key]).length
    });
  }
  const max = Math.max(1, state.habits.length);
  counts.forEach((item, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap';
    const bar = document.createElement('i');
    bar.className = `bar${item.count === 0 ? ' zero' : ''}`;
    bar.style.height = item.count ? `${Math.max(9, (item.count / max) * 100)}%` : '4px';
    bar.title = `${item.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${item.count} checks`;
    wrap.appendChild(bar);
    const label = document.createElement('span');
    label.textContent = index % 3 === 0 || index === 13 ? String(item.date.getDate()) : '';
    wrap.appendChild(label);
    chart.appendChild(wrap);
  });
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  $('chart-total').textContent = `${total} check${total === 1 ? '' : 's'}`;
}

function renderWeekday() {
  const box = $('weekday-chart');
  box.innerHTML = '';
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const totals = Array(7).fill(0);
  const possible = Array(7).fill(0);
  for (let offset = 0; offset < 84; offset += 1) {
    const date = daysAgo(offset);
    const index = (date.getDay() + 6) % 7;
    possible[index] += state.habits.length;
    const key = toKey(date);
    totals[index] += state.habits.filter((habit) => habit.logs[key]).length;
  }
  names.forEach((name, index) => {
    const percentage = possible[index] ? Math.round((totals[index] / possible[index]) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'weekday-row';
    row.innerHTML = `<span>${name}</span><span class="weekday-track"><i style="width:${percentage}%"></i></span><b>${percentage}%</b>`;
    box.appendChild(row);
  });
}

function renderPattern() {
  const text = $('pattern-text');
  const tag = $('pattern-tag');
  if (!state.habits.length) {
    text.textContent = 'Add a habit to begin reading the pattern.';
    tag.textContent = 'A blank page';
    return;
  }
  const doneToday = state.habits.filter((habit) => habit.logs[todayKey()]).length;
  if (doneToday === state.habits.length) {
    text.textContent = `All ${state.habits.length} habits are marked today. The smallest unit of a good week.`;
    tag.textContent = 'A clean sweep';
    return;
  }
  const steadiest = state.habits.slice().sort((a, b) => rate(b, 30) - rate(a, 30))[0];
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const totals = Array(7).fill(0);
  const possible = Array(7).fill(0);
  for (let offset = 0; offset < 84; offset += 1) {
    const date = daysAgo(offset);
    const index = (date.getDay() + 6) % 7;
    possible[index] += state.habits.length;
    totals[index] += state.habits.filter((habit) => habit.logs[toKey(date)]).length;
  }
  let best = 0;
  for (let i = 1; i < 7; i += 1) if (totals[i] / Math.max(1, possible[i]) > totals[best] / Math.max(1, possible[best])) best = i;
  text.textContent = `${steadiest.name} is your steadiest habit at ${rate(steadiest, 30)}% this month. ${names[best]} is the day you show up most often.`;
  tag.textContent = `${names[best]} is your strongest day`;
}

function renderRange() {
  document.querySelectorAll('#range button').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.weeks) === state.weeks);
  });
}

function renderAll() {
  renderSummary();
  renderRange();
  renderHabits();
  renderChart();
  renderWeekday();
  renderPattern();
  $('today-label').textContent = TODAY.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  $('year').textContent = `© ${new Date().getFullYear()}`;
}

function buildColorChoices() {
  const box = $('color-choices');
  box.innerHTML = '';
  COLORS.forEach((color, index) => {
    const label = document.createElement('label');
    label.className = 'color-choice';
    label.style.setProperty('--c', color);
    label.innerHTML = `<input type="radio" name="habit-color" value="${color}"${index === 0 ? ' checked' : ''}><span></span>`;
    label.querySelector('input').addEventListener('change', () => { state.draftColor = color; });
    box.appendChild(label);
  });
}

function openDialog() {
  state.draftColor = COLORS[state.habits.length % COLORS.length];
  buildColorChoices();
  const inputs = document.querySelectorAll('input[name="habit-color"]');
  inputs.forEach((input) => {
    input.checked = input.value === state.draftColor;
  });
  $('habit-form').reset();
  inputs.forEach((input) => {
    input.checked = input.value === state.draftColor;
  });
  $('habit-name').value = '';
  $('habit-emoji').value = EMOJIS[state.habits.length % EMOJIS.length];
  $('habit-dialog').showModal();
  setTimeout(() => $('habit-name').focus(), 30);
}

function addHabit() {
  const name = $('habit-name').value.trim();
  if (!name) return;
  state.habits.push({
    id: `habit-${Date.now()}`,
    name,
    emoji: $('habit-emoji').value,
    color: state.draftColor,
    logs: {}
  });
  saveState();
  $('habit-dialog').close();
  renderAll();
  showToast(`“${name}” added`);
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function init() {
  loadState();
  renderAll();
  $('add-habit').addEventListener('click', openDialog);
  $('dialog-close').addEventListener('click', () => $('habit-dialog').close());
  $('habit-dialog').addEventListener('click', (event) => {
    if (event.target === $('habit-dialog')) $('habit-dialog').close();
  });
  $('habit-form').addEventListener('submit', (event) => {
    event.preventDefault();
    addHabit();
  });
  document.querySelectorAll('#range button').forEach((button) => {
    button.addEventListener('click', () => {
      state.weeks = Number(button.dataset.weeks);
      saveState();
      renderAll();
    });
  });
}

init();
