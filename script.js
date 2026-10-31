/* =========================================================
   PrePlanner – Smart Study Planner
   Sections: 1 Data  2 Helpers  3 Navigation  4 Dashboard
   5 Planner  6 Timer  7 Progress  8 Calendar  9 Reports
   10 Achievements  11 Settings & Reminders  12 Start-up
   ========================================================= */

/* ---------- 1. DATA (saved in LocalStorage) ---------- */
const KEY = 'preplanner_data';
function freshData() {
  return { name: '', goal: 120, notify: false, subjects: [], sessions: [], reminders: [] };
}
function loadData() {
  try { return Object.assign(freshData(), JSON.parse(localStorage.getItem(KEY))); }
  catch (e) { return freshData(); }
}
let db = loadData();
function save() { localStorage.setItem(KEY, JSON.stringify(db)); }

/* ---------- 2. HELPERS ---------- */
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => dkey(new Date());
const fmtHM = s => Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
const hms = s => [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(pad).join(':');
const hours = s => Math.round(s / 36) / 100;
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const QUOTES = [
  'Small steps every day lead to big results.',
  'Discipline is choosing what you want most over what you want now.',
  'You do not have to be perfect, just consistent.',
  'Study now, thank yourself later.',
  'Focus on progress, not perfection.',
  'One more topic done is one worry less.',
  'Your future self is cheering for you.'
];
function secondsOn(k) { return db.sessions.filter(s => s.date === k).reduce((a, s) => a + s.seconds, 0); }
function totalSeconds() { return db.sessions.reduce((a, s) => a + s.seconds, 0); }
function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(dkey(d)); }
  return out;
}
function allTopics() { return db.subjects.flatMap(s => s.topics.map(t => ({ ...t, subject: s.name }))); }
function score() { return Math.min(100, Math.round(secondsOn(today()) / 60 / db.goal * 100)); }
function streak() {
  let c = 0; const d = new Date();
  if (!secondsOn(dkey(d))) d.setDate(d.getDate() - 1);   // today may not have started yet
  while (secondsOn(dkey(d)) > 0) { c++; d.setDate(d.getDate() - 1); }
  return c;
}
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
const charts = {};
function drawChart(id, config) {
  if (charts[id]) charts[id].destroy();
  config.options = Object.assign({ responsive: true, maintainAspectRatio: false }, config.options);
  charts[id] = new Chart($(id), config);
}
function dayBarConfig(days, type) {
  return {
    type: type || 'bar',
    data: { labels: days.map(k => k.slice(5)), datasets: [{ label: 'Hours', data: days.map(k => hours(secondsOn(k))),
      backgroundColor: '#7c6cf0', borderColor: '#7c6cf0', borderRadius: 8, tension: .35, fill: false }] },
    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
  };
}

/* ---------- 3. NAVIGATION ---------- */
const renderers = {};
function go(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if (renderers[page]) renderers[page]();
  lucide.createIcons();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));

/* ---------- 4. DASHBOARD ---------- */
renderers.dashboard = () => {
  const topics = allTopics(), done = topics.filter(t => t.done).length;
  $('dashHello').textContent = 'Hello, ' + db.name + '! 👋';
  $('dToday').textContent = fmtHM(secondsOn(today()));
  $('dDone').textContent = done;
  $('dPend').textContent = topics.length - done;
  $('dScore').textContent = score() + '%';
  $('dStreak').textContent = streak() + (streak() === 1 ? ' day' : ' days');
  $('quote').textContent = QUOTES[new Date().getDate() % QUOTES.length];
  drawChart('dChart', dayBarConfig(lastDays(7)));
};
$('quickStart').addEventListener('click', () => go('timer'));

/* ---------- 5. PLANNER ---------- */
$('subjectForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('subjectName').value.trim();
  if (name.length < 2) return toast('Enter a subject name (at least 2 characters).');
  if (db.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) return toast('That subject already exists.');
  db.subjects.push({ id: uid(), name, topics: [] });
  save(); $('subjectName').value = ''; renderers.planner(); toast('Subject added.');
});
renderers.planner = () => {
  const box = $('subjectList');
  if (!db.subjects.length) { box.innerHTML = '<div class="card empty subject">No subjects yet. Add your first subject above to start planning.</div>'; return; }
  box.innerHTML = db.subjects.map(s => {
    const row = t => `<li class="topic ${t.done ? 'done' : ''}">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTopic('${s.id}','${t.id}')">
      <div><b>${esc(t.title)}</b><small>Target: ${t.date}<span class="pri ${t.priority}">${t.priority}</span></small></div>
      <button class="icon-btn" title="Edit" onclick="editTopic('${s.id}','${t.id}')"><i data-lucide="pencil"></i></button>
      <button class="icon-btn" title="Delete" onclick="deleteTopic('${s.id}','${t.id}')"><i data-lucide="trash-2"></i></button></li>`;
    const pend = s.topics.filter(t => !t.done), comp = s.topics.filter(t => t.done);
    return `<div class="card subject">
      <div class="subject-head"><h3>${esc(s.name)}</h3><div>
        <button class="icon-btn" title="Rename" onclick="editSubject('${s.id}')"><i data-lucide="pencil"></i></button>
        <button class="icon-btn" title="Delete" onclick="deleteSubject('${s.id}')"><i data-lucide="trash-2"></i></button></div></div>
      <div class="topic-form">
        <input id="tt-${s.id}" type="text" maxlength="60" placeholder="New topic">
        <input id="td-${s.id}" type="date" value="${today()}">
        <select id="tp-${s.id}"><option>High</option><option selected>Medium</option><option>Low</option></select>
        <button class="btn primary" onclick="addTopic('${s.id}')"><i data-lucide="plus"></i>Add</button></div>
      <div class="cols">
        <div><h4>Pending (${pend.length})</h4><ul class="list">${pend.map(row).join('') || '<small class="muted">Nothing pending.</small>'}</ul></div>
        <div><h4>Completed (${comp.length})</h4><ul class="list">${comp.map(row).join('') || '<small class="muted">Nothing completed yet.</small>'}</ul></div>
      </div></div>`;
  }).join('');
  lucide.createIcons();
};
const findSubject = id => db.subjects.find(s => s.id === id);
function addTopic(sid) {
  const title = $('tt-' + sid).value.trim(), date = $('td-' + sid).value, priority = $('tp-' + sid).value;
  if (title.length < 2) return toast('Enter a topic name (at least 2 characters).');
  if (!date) return toast('Choose a target date.');
  findSubject(sid).topics.push({ id: uid(), title, date, priority, done: false, doneAt: null });
  save(); renderers.planner(); toast('Topic added.');
}
function toggleTopic(sid, tid) {
  const t = findSubject(sid).topics.find(x => x.id === tid);
  t.done = !t.done; t.doneAt = t.done ? today() : null;
  save(); renderers.planner(); if (t.done) { toast('Topic completed. Great work!'); checkNewBadges(); }
}
function editTopic(sid, tid) {
  const t = findSubject(sid).topics.find(x => x.id === tid);
  const title = prompt('Edit topic name:', t.title); if (title === null) return;
  if (title.trim().length < 2) return toast('Topic name is too short.');
  const date = prompt('Edit target date (YYYY-MM-DD):', t.date); if (date === null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return toast('Date must look like 2026-11-30.');
  const p = prompt('Priority (High, Medium or Low):', t.priority); if (p === null) return;
  const pr = ['High', 'Medium', 'Low'].find(x => x.toLowerCase() === p.trim().toLowerCase());
  if (!pr) return toast('Priority must be High, Medium or Low.');
  Object.assign(t, { title: title.trim(), date: date.trim(), priority: pr });
  save(); renderers.planner(); toast('Topic updated.');
}
function deleteTopic(sid, tid) {
  if (!confirm('Delete this topic?')) return;
  const s = findSubject(sid); s.topics = s.topics.filter(t => t.id !== tid);
  save(); renderers.planner();
}
function editSubject(sid) {
  const s = findSubject(sid), n = prompt('Rename subject:', s.name);
  if (n === null) return;
  if (n.trim().length < 2) return toast('Subject name is too short.');
  s.name = n.trim(); save(); renderers.planner();
}
function deleteSubject(sid) {
  if (!confirm('Delete this subject and all its topics?')) return;
  db.subjects = db.subjects.filter(s => s.id !== sid); save(); renderers.planner();
}

/* ---------- 6. FOCUS TIMER ---------- */
// acc = study milliseconds banked so far; start = when the current study stretch began
// brk = break milliseconds banked; bstart = when the current break began
let T = { state: 'idle', acc: 0, start: 0, brk: 0, bstart: 0 };
const studySecs = () => Math.floor((T.acc + (T.state === 'running' ? Date.now() - T.start : 0)) / 1000);
const breakSecs = () => Math.floor((T.brk + (T.state === 'break' ? Date.now() - T.bstart : 0)) / 1000);
function updateTimerUI() {
  $('timerDisplay').textContent = hms(studySecs());
  $('breakDisplay').textContent = hms(breakSecs());
  const st = $('timerStatus');
  st.textContent = { idle: 'Ready', running: 'Studying', break: 'On break' }[T.state];
  st.className = 'pill ' + T.state;
  $('btnStart').disabled = T.state !== 'idle';
  $('btnBreak').disabled = T.state !== 'running';
  $('btnResume').disabled = T.state !== 'break';
  $('btnStop').disabled = T.state === 'idle';
  $('btnReset').disabled = T.state === 'idle';
  $('timerSubject').disabled = T.state !== 'idle';
}
setInterval(updateTimerUI, 250);
$('btnStart').onclick = () => { T = { state: 'running', acc: 0, start: Date.now(), brk: 0, bstart: 0 }; updateTimerUI(); };
$('btnBreak').onclick = () => { T.acc += Date.now() - T.start; T.bstart = Date.now(); T.state = 'break'; updateTimerUI(); };
$('btnResume').onclick = () => { T.brk += Date.now() - T.bstart; T.start = Date.now(); T.state = 'running'; updateTimerUI(); };
$('btnStop').onclick = () => {
  const secs = studySecs();   // break time is never included
  if (secs < 1) { toast('No study time to save.'); }
  else {
    db.sessions.push({ id: uid(), date: today(), seconds: secs, subject: $('timerSubject').value });
    save(); toast('Session saved: ' + hms(secs)); checkNewBadges();
  }
  T = { state: 'idle', acc: 0, start: 0, brk: 0, bstart: 0 }; updateTimerUI(); renderers.timer();
};
$('btnReset').onclick = () => {
  if (!confirm('Discard this running session without saving?')) return;
  T = { state: 'idle', acc: 0, start: 0, brk: 0, bstart: 0 }; updateTimerUI();
};
renderers.timer = () => {
  const sel = $('timerSubject'), keep = sel.value;
  sel.innerHTML = ['General study', ...db.subjects.map(s => s.name)].map(n => `<option>${esc(n)}</option>`).join('');
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  $('tTotal').textContent = fmtHM(totalSeconds());
  const recent = db.sessions.slice(-6).reverse();
  $('sessionList').innerHTML = recent.map(s => `<li><span>${esc(s.subject)}</span><span class="muted">${s.date}</span><b>${hms(s.seconds)}</b></li>`).join('')
    || '<li class="muted">No sessions yet. Press Start to begin.</li>';
  updateTimerUI();
};
window.addEventListener('beforeunload', e => { if (T.state !== 'idle') { e.preventDefault(); e.returnValue = ''; } });

/* ---------- 7. DAILY PROGRESS ---------- */
renderers.progress = () => {
  $('pTotal').textContent = fmtHM(totalSeconds());
  $('pDone').textContent = allTopics().filter(t => t.done).length;
  $('pScore').textContent = score() + '%';
  $('pBar').style.width = score() + '%';
  $('pGoalText').textContent = Math.floor(secondsOn(today()) / 60) + ' of ' + db.goal + ' minutes studied today.';
  const t = secondsOn(today()), y = secondsOn(lastDays(2)[0]);
  const prev = lastDays(8).slice(0, 7), avg = prev.reduce((a, k) => a + secondsOn(k), 0) / 7;
  const diff = (a, b) => a === b ? 'the same as' : fmtHM(Math.abs(a - b)) + (a > b ? ' more than' : ' less than');
  $('pCompare').innerHTML = `Today you studied <b>${diff(t, y)}</b> yesterday and <b>${diff(t, Math.round(avg))}</b> your 7-day average.`;
  drawChart('pChart', dayBarConfig(lastDays(14), 'line'));
};

/* ---------- 8. CALENDAR ---------- */
let cal = new Date(); cal.setDate(1);
$('calPrev').onclick = () => { cal.setMonth(cal.getMonth() - 1); renderers.calendar(); };
$('calNext').onclick = () => { cal.setMonth(cal.getMonth() + 1); renderers.calendar(); };
renderers.calendar = () => {
  const y = cal.getFullYear(), m = cal.getMonth();
  $('calTitle').textContent = cal.toLocaleString('default', { month: 'long', year: 'numeric' });
  let h = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) h += '<div></div>';
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
    const k = y + '-' + pad(m + 1) + '-' + pad(d), s = secondsOn(k);
    h += `<button class="day ${s ? 'study' : ''} ${k === today() ? 'today' : ''}" data-k="${k}" onclick="showDay('${k}')"><span>${d}</span>${s ? `<small>${fmtHM(s)}</small>` : ''}</button>`;
  }
  $('calGrid').innerHTML = h;
};
function showDay(k) {
  document.querySelectorAll('.day').forEach(b => b.classList.toggle('sel', b.dataset.k === k));
  const sess = db.sessions.filter(s => s.date === k), done = allTopics().filter(t => t.doneAt === k);
  $('dayInfo').innerHTML = `<h3>${k}</h3><p><b>Study time:</b> ${fmtHM(secondsOn(k))}</p>
    <p><b>Completed topics:</b> ${done.length ? done.map(t => esc(t.title) + ' (' + esc(t.subject) + ')').join(', ') : 'none'}</p>
    <ul class="list">${sess.map(s => `<li><span>${esc(s.subject)}</span><b>${hms(s.seconds)}</b></li>`).join('')}</ul>`;
}

/* ---------- 9. REPORTS ---------- */
renderers.reports = () => {
  const days = lastDays(+$('rangeSel').value), set = new Set(days);
  const sess = db.sessions.filter(s => set.has(s.date)), topics = allTopics();
  $('rTotal').textContent = fmtHM(sess.reduce((a, s) => a + s.seconds, 0));
  $('rDone').textContent = topics.filter(t => t.done && set.has(t.doneAt)).length;
  $('rPend').textContent = topics.filter(t => !t.done).length;
  drawChart('rBar', dayBarConfig(days));
  const bySub = {}; sess.forEach(s => bySub[s.subject] = (bySub[s.subject] || 0) + s.seconds);
  const names = Object.keys(bySub);
  drawChart('rPie', { type: 'doughnut', data: { labels: names.length ? names : ['No data'],
    datasets: [{ data: names.length ? names.map(n => hours(bySub[n])) : [1],
      backgroundColor: names.length ? ['#7c6cf0', '#4a90d9', '#b8a9ff', '#8cc4f5', '#f0a437', '#2fb67c', '#e5546b'] : ['#e6e2fa'] }] } });
  $('rHistory').innerHTML = sess.slice().reverse().map(s => `<li><span>${s.date}</span><span>${esc(s.subject)}</span><b>${hms(s.seconds)}</b></li>`).join('')
    || '<li class="muted">No sessions in this period.</li>';
};
$('rangeSel').onchange = renderers.reports;

/* ---------- 10. ACHIEVEMENTS ---------- */
const BADGES = [
  { id: 'first', icon: 'play-circle', name: 'First Study Session', desc: 'Save your first session.', ok: () => db.sessions.length >= 1 },
  { id: 'topic', icon: 'check-circle-2', name: 'First Topic Completed', desc: 'Complete one topic.', ok: () => allTopics().some(t => t.done) },
  { id: 's3', icon: 'flame', name: '3-Day Study Streak', desc: 'Study 3 days in a row.', ok: () => streak() >= 3 },
  { id: 's7', icon: 'zap', name: '7-Day Study Streak', desc: 'Study 7 days in a row.', ok: () => streak() >= 7 },
  { id: 'h10', icon: 'clock', name: '10 Hours Studied', desc: 'Reach 10 hours in total.', ok: () => totalSeconds() >= 36000 },
  { id: 'champ', icon: 'trophy', name: 'Study Champion', desc: '25 hours studied and 10 topics completed.', ok: () => totalSeconds() >= 90000 && allTopics().filter(t => t.done).length >= 10 }
];
function checkNewBadges() {
  const seen = JSON.parse(localStorage.getItem('preplanner_badges') || '[]');
  BADGES.filter(b => b.ok() && !seen.includes(b.id)).forEach(b => { seen.push(b.id); toast('🏆 Badge unlocked: ' + b.name); });
  localStorage.setItem('preplanner_badges', JSON.stringify(seen));
}
renderers.achievements = () => {
  const got = BADGES.filter(b => b.ok()).length;
  $('achCount').textContent = got + ' of ' + BADGES.length + ' badges unlocked';
  $('badges').innerHTML = BADGES.map(b => `<div class="badge ${b.ok() ? 'got' : ''}"><div class="ico"><i data-lucide="${b.icon}"></i></div>
    <b>${b.name}</b><span>${b.desc}</span></div>`).join('');
};

/* ---------- 11. SETTINGS & REMINDERS ---------- */
renderers.settings = () => {
  $('setName').value = db.name; $('setGoal').value = db.goal; $('notifyToggle').checked = db.notify;
  $('remList').innerHTML = db.reminders.map(r => `<li><span><b>${r.time}</b> – ${esc(r.label)}</span>
    <button class="icon-btn" onclick="deleteReminder('${r.id}')"><i data-lucide="trash-2"></i></button></li>`).join('')
    || '<li class="muted">No reminders yet.</li>';
};
$('remForm').addEventListener('submit', e => {
  e.preventDefault();
  const time = $('remTime').value, label = $('remLabel').value.trim();
  if (!time) return toast('Choose a reminder time.');
  if (label.length < 2) return toast('Enter reminder text.');
  db.reminders.push({ id: uid(), time, label, last: '' }); save();
  $('remLabel').value = ''; renderers.settings(); lucide.createIcons(); toast('Reminder added.');
});
function deleteReminder(id) { db.reminders = db.reminders.filter(r => r.id !== id); save(); renderers.settings(); lucide.createIcons(); }
$('notifyToggle').addEventListener('change', e => {
  db.notify = e.target.checked; save();
  if (db.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  toast(db.notify ? 'Notifications enabled.' : 'Notifications disabled.');
});
$('profileForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('setName').value.trim(), goal = +$('setGoal').value;
  if (name.length < 2) { $('profileError').textContent = 'Name must be at least 2 characters.'; return; }
  if (!(goal >= 10 && goal <= 1440)) { $('profileError').textContent = 'Goal must be between 10 and 1440 minutes.'; return; }
  $('profileError').textContent = ''; db.name = name; db.goal = goal; save(); toast('Profile saved.');
});
$('resetAll').onclick = () => {
  if (!confirm('This will delete ALL subjects, topics, sessions and reminders. Continue?')) return;
  const name = db.name; db = freshData(); db.name = name; save();
  localStorage.removeItem('preplanner_badges'); toast('All study data was reset.'); go('dashboard');
};
// Check reminders every 20 seconds
setInterval(() => {
  if (!db.notify) return;
  const now = new Date(), hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  db.reminders.forEach(r => {
    if (r.time === hm && r.last !== today()) {
      r.last = today(); save(); toast('⏰ ' + r.label);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('PrePlanner', { body: r.label });
    }
  });
}, 20000);

/* ---------- 12. WELCOME & START-UP ---------- */
$('welcomeForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('nameInput').value.trim();
  if (name.length < 2) { $('nameError').textContent = 'Please enter at least 2 characters.'; return; }
  db.name = name; save(); startApp();
});
function startApp() {
  $('welcome').classList.add('hidden'); $('app').classList.remove('hidden'); go('dashboard');
}
if (db.name) startApp(); else { $('welcome').classList.remove('hidden'); lucide.createIcons(); }