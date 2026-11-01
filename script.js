/* =========================================================
   PrePlanner – Smart Study Planner
   Sections: 1 Data  2 Helpers  3 Navigation  4 Dashboard
   5 Planner  6 Timer  7 Progress  8 Calendar  9 Reports
   10 Achievements  11 Settings & Reminders  12 Today's Task (NEW)  13 Start-up
   ========================================================= */

/* ---------- 1. DATA (saved in LocalStorage) ---------- */
const KEY = 'preplanner_data';
function freshData() {
  return { name: '', goal: 120, notify: false, subjects: [], sessions: [], reminders: [],
    task: null, timer: null, reports: [] };   // NEW: today's plan, live timer, daily reports
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
$('btnStart').onclick = () => { if (TK.state !== 'idle') return toast("Stop the Today's Task timer first."); T = { state: 'running', acc: 0, start: Date.now(), brk: 0, bstart: 0 }; updateTimerUI(); };
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
window.addEventListener('beforeunload', e => { if (T.state !== 'idle' || TK.state !== 'idle') { e.preventDefault(); e.returnValue = ''; } });

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
  const name = db.name; db = freshData(); db.name = name; save(); TK = { ...TK_IDLE }; tkMsg = '';
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

/* ---------- 12. TODAY'S TASK (upload -> confirm -> study -> final report) ---------- */
// Saved in db (LocalStorage):
//   db.subjects : uploaded subjects/topics are MERGED here, so Planner, Calendar, Reports keep working
//   db.task     : { id, date, phase: 'confirm' | 'run' | 'report', items: [{ sid, tid }] }  (today's plan)
//   db.sessions : one entry per studied topic { ..., seconds, breakSeconds, subjectId, tid, topic, plan }
//   db.timer    : live timer snapshot so a browser refresh does not lose time
//   db.reports  : final daily report snapshots
const TK_TARGET_SECS = 15 * 3600;                 // baseline study target used by the score
const TK_IDLE = { state: 'idle', sid: '', tid: '', acc: 0, start: 0, brk: 0, bstart: 0 };
let TK = { ...TK_IDLE };                          // the Today's Task timer (separate from the Focus Timer "T")
let tkMsg = '';                                   // banner message shown after Stop
const hhmm = s => pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60));
const tkSum = (list, key) => list.reduce((n, x) => n + (x[key] || 0), 0);
const tkShow = id => ['tkIntro', 'tkSheet', 'tkConfirm', 'tkRun', 'tkReport'].forEach(p => $(p).classList.toggle('hidden', p !== id));

/* --- plan helper: resolves saved ids to live subject/topic objects --- */
function tkPlan() {
  if (!db.task) return [];
  return db.task.items.map(i => {
    const s = findSubject(i.sid), t = s && s.topics.find(x => x.id === i.tid);
    return t ? { s, t } : null;
  }).filter(Boolean);
}

/* --- Step 1: spreadsheet-style upload table --- */
function tkOpenSheet() {
  if (TK.state !== 'idle' || T.state !== 'idle') return toast('Stop the running timer first.');
  $('tkRows').innerHTML = '';
  for (let i = 0; i < 5; i++) tkAddRow();            // 5 default rows
  $('tkSheetError').textContent = '';
  tkShow('tkSheet'); $('tkEndBtn').classList.add('hidden');
  $('tkRows').querySelector('input').focus();
}
const tkNumberRows = () => [...$('tkRows').rows].forEach((r, i) => r.cells[0].textContent = i + 1);
function tkAddRow() {
  const tr = $('tkRows').insertRow();
  tr.innerHTML = `<td class="n"></td>
    <td><input type="text" maxlength="40" placeholder="e.g. Mathematics" aria-label="Subject name"></td>
    <td><input type="text" maxlength="60" placeholder="e.g. Algebra" aria-label="Topic name"></td>
    <td><button type="button" class="icon-btn" title="Remove row"><i data-lucide="x"></i></button></td>`;
  tr.querySelector('button').onclick = () => { if ($('tkRows').rows.length > 1) { tr.remove(); tkNumberRows(); } };
  tkNumberRows(); lucide.createIcons();
}
// Pressing Enter in the last topic cell adds a new row, like a spreadsheet
$('tkRows').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const rows = $('tkRows').rows, inputs = rows[rows.length - 1].querySelectorAll('input');
  if (e.target === inputs[1]) { tkAddRow(); $('tkRows').rows[rows.length - 1].querySelector('input').focus(); }
});

function tkSaveSheet() {
  const seen = new Set(), valid = []; let error = '';
  [...$('tkRows').rows].forEach(tr => {
    const [a, b] = tr.querySelectorAll('input'), subject = a.value.trim(), topic = b.value.trim();
    a.classList.remove('bad'); b.classList.remove('bad');
    if (!subject && !topic) return;                                  // blank row: ignore
    if (!subject) { a.classList.add('bad'); error = 'Every filled row needs a subject name.'; return; }
    if (!topic) { b.classList.add('bad'); error = 'Every filled row needs a topic name.'; return; }
    const k = subject.toLowerCase() + '|' + topic.toLowerCase();
    if (seen.has(k)) { b.classList.add('bad'); error = 'The same subject and topic appears twice.'; return; }
    seen.add(k); valid.push({ subject, topic });
  });
  if (!error && !valid.length) error = 'Enter at least one subject and topic.';
  $('tkSheetError').textContent = error;
  if (error) return;

  const items = [];
  valid.forEach(r => {
    let s = db.subjects.find(x => x.name.toLowerCase() === r.subject.toLowerCase());
    if (!s) { s = { id: uid(), name: r.subject, topics: [] }; db.subjects.push(s); }
    let t = s.topics.find(x => x.title.toLowerCase() === r.topic.toLowerCase());
    if (!t) { t = { id: uid(), title: r.topic, date: today(), priority: 'Medium', done: false, doneAt: null }; s.topics.push(t); }
    else if (t.done) { t.done = false; t.doneAt = null; }              // studying a finished topic again
    items.push({ sid: s.id, tid: t.id });
  });
  db.task = { id: uid(), date: today(), phase: 'confirm', items }; tkMsg = '';
  save(); toast('Study data saved.'); renderers.task();
}

/* --- Step 3: dropdowns, checklist and timer --- */
function tkRenderRun() {
  const plan = tkPlan(), done = plan.filter(p => p.t.done).length, pend = plan.length - done;
  const ids = [...new Set(plan.map(p => p.s.id))];
  $('tkSubject').innerHTML = '<option value="">Select subject</option>' + ids.map(id => {
    const n = plan.filter(p => p.s.id === id && !p.t.done).length;
    return `<option value="${id}" ${n ? '' : 'disabled'}>${esc(findSubject(id).name)} (${n} pending)</option>`;
  }).join('');
  $('tkSubject').value = TK.sid;                       // empty after Stop => dropdowns are reset
  tkFillTopics();
  $('tkBar').style.width = (plan.length ? done / plan.length * 100 : 0) + '%';
  $('tkProg').textContent = done + ' of ' + plan.length + ' topics completed, ' + pend + ' pending';
  $('tkList').innerHTML = ids.map(id => `<h4 class="tk-sh">${esc(findSubject(id).name)}</h4><ul class="list">` +
    plan.filter(p => p.s.id === id).map(p => {
      const st = p.t.done ? 'Completed' : (TK.tid === p.t.id ? 'Studying' : 'Pending');
      return `<li><span>${esc(p.t.title)}</span><span class="st ${st}">${st}</span></li>`;
    }).join('') + '</ul>').join('');
  const cur = plan.find(p => p.t.id === TK.tid);
  $('tkBanner').textContent = cur ? 'Now studying: ' + cur.t.title
    : pend === 0 ? 'All topics are completed! Click "End Today\'s Task" to see your report.'
    : tkMsg || 'Select a subject and topic, then press Start.';
  $('tkEndBtn').classList.remove('hidden');
}
// Topic dropdown shows ONLY the topics of the selected subject (completed ones are locked)
function tkFillTopics() {
  const sid = $('tkSubject').value;
  $('tkTopic').innerHTML = '<option value="">' + (sid ? 'Select topic' : 'Select a subject first') + '</option>' +
    tkPlan().filter(p => p.s.id === sid).map(p =>
      `<option value="${p.t.id}" ${p.t.done ? 'disabled' : ''}>${esc(p.t.title)}${p.t.done ? ' (completed)' : ''}</option>`).join('');
  $('tkTopic').value = TK.tid;
  tkUpdateUI();
}
const tkStudy = () => Math.floor((TK.acc + (TK.state === 'running' ? Date.now() - TK.start : 0)) / 1000);
const tkBreakS = () => Math.floor((TK.brk + (TK.state === 'break' ? Date.now() - TK.bstart : 0)) / 1000);
function tkUpdateUI() {
  const s = tkStudy(), idle = TK.state === 'idle';
  $('tkHM').textContent = hhmm(s); $('tkSec').textContent = ':' + pad(s % 60);
  $('tkBreak').textContent = hhmm(tkBreakS());
  $('tkStatus').textContent = { idle: 'Ready', running: 'Studying', break: 'On break' }[TK.state];
  $('tkStatus').className = 'pill ' + TK.state;
  $('tkStart').disabled = !(idle && $('tkTopic').value);
  $('tkBrk').disabled = TK.state !== 'running';
  $('tkResume').disabled = TK.state !== 'break';
  $('tkStop').disabled = idle;
  $('tkSubject').disabled = $('tkTopic').disabled = !idle;
}
function tkSync() { db.timer = TK.state === 'idle' ? null : { ...TK, beat: Date.now() }; save(); }
setInterval(() => { tkUpdateUI(); if (TK.state !== 'idle') tkSync(); }, 1000);   // tick + heartbeat save

$('tkSubject').onchange = () => { $('tkTopic').value = ''; tkFillTopics(); };
$('tkTopic').onchange = tkUpdateUI;
$('tkStart').onclick = () => {
  if (TK.state !== 'idle') return;                                    // never two timers at once
  if (T.state !== 'idle') return toast('Stop the Focus Timer session first.');
  const p = tkPlan().find(x => x.t.id === $('tkTopic').value);
  if (!p || p.t.done) return toast('Choose a pending topic.');
  TK = { ...TK_IDLE, state: 'running', sid: p.s.id, tid: p.t.id, start: Date.now() };
  tkMsg = ''; tkSync(); tkRenderRun();
};
$('tkBrk').onclick = () => {
  if (TK.state !== 'running') return;
  TK.acc += Date.now() - TK.start; TK.bstart = Date.now(); TK.state = 'break'; tkSync(); tkUpdateUI();
};
$('tkResume').onclick = () => {
  if (TK.state !== 'break') return;
  TK.brk += Date.now() - TK.bstart; TK.start = Date.now(); TK.state = 'running'; tkSync(); tkUpdateUI();
};

// Saves the running topic. Break time is stored separately and never added to study time.
// complete = true (Stop) marks the topic done; false (End Today's Task mid-topic) keeps it pending.
function tkSaveSession(complete) {
  const secs = tkStudy(), brk = tkBreakS(), p = tkPlan().find(x => x.t.id === TK.tid);
  let saved = 0;
  if (p && !p.t.done && secs >= 1) {                                  // !done => a topic is never counted twice
    db.sessions.push({ id: uid(), date: today(), seconds: secs, breakSeconds: brk, subject: p.s.name,
      subjectId: p.s.id, tid: p.t.id, topic: p.t.title, plan: db.task.id });
    if (complete) { p.t.done = true; p.t.doneAt = today(); }
    saved = secs;
  }
  TK = { ...TK_IDLE }; db.timer = null; save();
  return saved;
}
$('tkStop').onclick = () => {
  if (TK.state === 'idle') return;
  const secs = tkSaveSession(true);
  tkMsg = 'Choose your next Subject and Topic to continue.';
  toast(secs ? 'Topic saved: ' + hms(secs) + ' of study time.' : 'Less than 1 second studied, nothing saved.');
  if (secs) checkNewBadges();
  tkRenderRun();
};

/* --- Step 4: end the day and build the report --- */
$('tkEndBtn').onclick = () => {
  const warn = TK.state !== 'idle' ? 'A timer is running. It will be stopped and saved. ' : '';
  if (!confirm(warn + "End today's task and open the final report?")) return;
  if (TK.state !== 'idle') tkSaveSession(false);
  const r = tkBuildReport();
  db.reports = db.reports.filter(x => x.id !== r.id).concat(r);
  db.task.phase = 'report'; save(); checkNewBadges(); renderers.task();
};

/* SMART PERFORMANCE SCORE (0 - 100)
   planned = topics in today's plan, completed = topics finished, pending = planned - completed
   Rule 1: pending = 0 (ALL planned topics done)  ->  score = 100, even if studied < 15 hours.
   Rule 2: otherwise
             base  = activeHours / 15 * 100            (capped at 100)  <- study time vs the 15 h target
             score = base * (completed / planned)                       <- reduced in proportion to pending topics
   Example: 6 h studied, 3 of 4 topics done -> base 40, score = 40 * 0.75 = 30.
   The result is rounded and kept between 0 and 100. */
function tkScore(activeSecs, planned, completed) {
  if (planned > 0 && completed === planned) return 100;
  const base = Math.min(100, activeSecs / TK_TARGET_SECS * 100);
  const completion = planned ? completed / planned : 0;
  return Math.max(0, Math.min(100, Math.round(base * completion)));
}
function tkBuildReport() {
  const rows = tkPlan().map(p => {
    const ss = db.sessions.filter(x => x.tid === p.t.id && x.plan === db.task.id);
    return { sid: p.s.id, subject: p.s.name, topic: p.t.title, active: tkSum(ss, 'seconds'), brk: tkSum(ss, 'breakSeconds'), done: p.t.done };
  });
  const subjects = [...new Set(rows.map(r => r.sid))].map(id => {
    const r = rows.filter(x => x.sid === id);
    return { name: r[0].subject, planned: r.length, done: r.filter(x => x.done).length,
      pending: r.filter(x => !x.done).length, active: tkSum(r, 'active') };
  });
  const active = tkSum(rows, 'active'), done = rows.filter(r => r.done).length;
  return { id: db.task.id, date: db.task.date, active, brk: tkSum(rows, 'brk'), planned: rows.length, done,
    pending: rows.length - done, covered: subjects.filter(s => s.active > 0 || s.done > 0).length,
    subjects, rows, score: tkScore(active, rows.length, done) };
}
function tkRenderReport(r) {
  $('tkrDate').textContent = 'Final report for ' + r.date;
  $('tkrActive').textContent = fmtHM(r.active); $('tkrBreak').textContent = fmtHM(r.brk);
  $('tkrDone').textContent = r.done; $('tkrPend').textContent = r.pending; $('tkrSubj').textContent = r.covered;
  $('tkrScore').textContent = r.score + ' / 100'; $('tkrBar').style.width = r.score + '%';
  $('tkrMsg').textContent = r.pending === 0 ? 'Perfect! Every planned topic is complete.'
    : r.score >= 75 ? 'Excellent work! You are very close to a perfect day.'
    : r.score >= 50 ? 'Good effort. Finish the pending topics next time.'
    : r.score >= 25 ? 'A decent start. Try to study a little longer next time.'
    : 'Every session counts. Plan a focused study day tomorrow.';
  $('tkrFormula').textContent = r.pending === 0
    ? 'All planned topics were completed, so the full 100/100 is awarded.'
    : 'Score = (' + hours(r.active) + ' h / 15 h target, max 100%) x (' + r.done + ' completed / ' + r.planned + ' planned) = ' + r.score;
  const st = d => `<span class="st ${d ? 'Completed' : 'Pending'}">${d ? 'Completed' : 'Pending'}</span>`;
  $('tkrTbl').innerHTML = '<thead><tr><th>Subject</th><th>Topic</th><th>Active Study Time</th><th>Break Time</th><th>Status</th></tr></thead><tbody>' +
    r.rows.map(x => `<tr><td>${esc(x.subject)}</td><td>${esc(x.topic)}</td><td>${hms(x.active)}</td><td>${hms(x.brk)}</td><td>${st(x.done)}</td></tr>`).join('') + '</tbody>';
  $('tkrSubjTbl').innerHTML = '<thead><tr><th>Subject</th><th>Planned</th><th>Completed</th><th>Pending</th><th>Study Time</th></tr></thead><tbody>' +
    r.subjects.map(s => `<tr><td>${esc(s.name)}</td><td>${s.planned}</td><td>${s.done}</td><td>${s.pending}</td><td>${hms(s.active)}</td></tr>`).join('') + '</tbody>';
  drawChart('tkrChart', { type: 'bar', data: { labels: r.subjects.map(s => s.name),
    datasets: [{ label: 'Hours', data: r.subjects.map(s => hours(s.active)), backgroundColor: '#7c6cf0', borderRadius: 8 }] },
    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
}

/* --- Page router for the Today's Task section --- */
renderers.task = () => {
  const ph = db.task ? db.task.phase : 'intro';
  tkShow({ intro: 'tkIntro', confirm: 'tkConfirm', run: 'tkRun', report: 'tkReport' }[ph]);
  $('tkEndBtn').classList.toggle('hidden', ph !== 'run');
  $('tkLast').classList.toggle('hidden', !db.reports.length);
  if (ph === 'confirm') {
    const plan = tkPlan(), n = new Set(plan.map(p => p.s.id)).size;
    $('tkConfirmInfo').textContent = n + (n === 1 ? ' subject' : ' subjects') + ' and ' + plan.length + (plan.length === 1 ? ' topic' : ' topics') + ' are ready.';
  }
  if (ph === 'run') tkRenderRun();
  if (ph === 'report') tkRenderReport(db.reports.find(x => x.id === db.task.id) || tkBuildReport());
  lucide.createIcons();
};
$('tkUploadBtn').onclick = tkOpenSheet;
$('tkAddRow').onclick = () => tkAddRow();
$('tkSave').onclick = tkSaveSheet;
$('tkCancel').onclick = () => renderers.task();
$('tkYes').onclick = () => { db.task.phase = 'run'; save(); renderers.task(); };
$('tkRedo').onclick = () => { db.task = null; save(); renderers.task(); tkOpenSheet(); };
$('tkNew').onclick = () => { db.task = null; save(); renderers.task(); tkOpenSheet(); };
$('tkHome').onclick = () => go('dashboard');
$('tkLast').onclick = () => { tkShow('tkReport'); tkRenderReport(db.reports[db.reports.length - 1]); lucide.createIcons(); };

// Refresh safety: restore an unfinished timer. Time while the page was closed is NOT counted,
// so the timer comes back on "break" and the student presses Resume.
if (db.timer && db.task && db.task.phase === 'run') {
  const { beat, ...t } = db.timer;
  if (t.state === 'running') t.acc += beat - t.start; else t.brk += beat - t.bstart;
  TK = { ...t, state: 'break', bstart: Date.now() }; tkSync();
  setTimeout(() => toast('Your timer was restored. Press Resume to continue.'), 800);
} else if (db.timer) { db.timer = null; save(); }

/* ---------- 13. WELCOME & START-UP ---------- */
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
