// ===== MFX Student App =====
const API = 'https://mrmomd-production.up.railway.app/api';

function toast(msg) {
  let t = document.querySelector('.toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 3000);
}

// ===== Global loading / anti-duplicate-click helpers =====
// Every important action (login, start exam, save, submit) routes through
// withButtonLock so a double-click / double-tap can only ever fire ONE
// request: the button is disabled + shows a spinner immediately, and any
// extra clicks while it's busy are ignored until the request settles.
const activeLocks = new Set();
async function withButtonLock(btn, busyText, fn) {
  if (!btn || btn.dataset.locked === '1') return; // already running — ignore the extra click
  const original = btn.innerHTML;
  btn.dataset.locked = '1';
  btn.disabled = true;
  btn.classList.add('is-loading');
  if (busyText) btn.innerHTML = busyText + '<span class="mfx-spinner"></span>';
  try {
    return await fn();
  } finally {
    btn.dataset.locked = '0';
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.innerHTML = original;
  }
}

function getToken() { return localStorage.getItem('mfx_student_token'); }
function setToken(t) { localStorage.setItem('mfx_student_token', t); }
function getUser() { try { return JSON.parse(localStorage.getItem('mfx_student_user') || '{}'); } catch(e) { return {}; } }
function logout() { localStorage.removeItem('mfx_student_token'); localStorage.removeItem('mfx_student_user'); location.href = 'login.html'; }

// Reads the JWT's own expiry (exp claim) without a network call, so an
// expired session is caught the instant the page loads instead of only
// after some data request fails with 401.
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch (e) {
    return true; // unreadable token = treat as expired
  }
}

async function api(path, opts = {}) {
  const url = API + path;
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(url, { ...opts, headers: { ...headers, ...opts.headers } });
    if (res.status === 401) { logout(); return; }
    return await res.json();
  } catch (e) { toast('❌ خطأ في الاتصال'); throw e; }
}

// Auth check
function requireAuth() {
  const onLoginPage = location.pathname.includes('login.html');
  const token = getToken();
  if (onLoginPage) return;
  if (!token || isTokenExpired(token)) {
    logout();
  }
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-submit-btn');
  const code = document.getElementById('login-code')?.value.trim();
  const name = document.getElementById('login-name')?.value.trim();
  const phone = document.getElementById('login-phone')?.value.trim();
  const guardianPhone = document.getElementById('login-guardian-phone')?.value.trim();
  if (!code || !name || !phone || !guardianPhone) { toast('❌ أدخل الكود والاسم ورقم تليفونك ورقم تليفون ولي الأمر'); return; }

  await withButtonLock(btn, 'جاري تسجيل الدخول...', async () => {
    if (form) form.querySelectorAll('input').forEach((i) => i.disabled = true);
    try {
      const data = await api('/auth/student-login', {
        method: 'POST',
        body: JSON.stringify({ code, name, phone, guardianPhone })
      });
      if (data && data.token) {
        setToken(data.token);
        localStorage.setItem('mfx_student_user', JSON.stringify(data.user));
        toast('✅ تم تسجيل الدخول');
        location.href = 'index.html'; // single navigation — no repeated reloads
      } else {
        toast('❌ ' + ((data && data.error) || 'كود أو اسم غير صحيح'));
        if (form) form.querySelectorAll('input').forEach((i) => i.disabled = false);
      }
    } catch (err) {
      if (form) form.querySelectorAll('input').forEach((i) => i.disabled = false);
    }
  });
}

// Load my courses
async function loadMyCourses() {
  const grid = document.getElementById('my-courses');
  const empty = document.getElementById('courses-empty');
  if (!grid) return;
  try {
    const data = await api('/students/my-courses');
    grid.innerHTML = '';
    if (!data.courses || !data.courses.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    data.courses.forEach(c => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `
        <div class="card-img">${c.icon || '📚'}</div>
        <div class="card-body">
          <span class="card-tag">${c.tag || 'كورس'}</span>
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.description || '')}</p>
          <div style="margin:12px 0;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem;">
              <span style="color:var(--text-secondary);">التقدم</span>
              <span style="color:var(--accent-light); font-weight:600;">${c.progress || 0}%</span>
            </div>
            <div class="prog"><div class="prog-fill" style="width:${c.progress || 0}%"></div></div>
          </div>
          <a href="course.html?id=${c.id}" class="btn btn-primary" style="width:100%;">متابعة الكورس</a>
        </div>
      `;
      grid.appendChild(div);
    });
  } catch (e) { grid.innerHTML = ''; if (empty) empty.style.display = 'block'; }
}

// Load course detail
async function loadCourse() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { toast('❌ كورس غير موجود'); return; }
  try {
    // These two are independent — fire them together, and reuse the
    // course-detail response for the units accordion instead of the old
    // code's second (redundant) call to the same endpoint.
    const [c] = await Promise.all([
      api('/units?courseId=' + id),
      loadCourseExams(id)
    ]);
    document.getElementById('course-title').textContent = c.title || 'كورس';
    document.getElementById('course-desc').textContent = c.description || '';
    document.getElementById('course-meta').innerHTML = `
      <span>📚 ${c.units || 0} وحدة</span>
      <span>🎥 ${c.videos || 0} فيديو</span>
      <span>📝 ${c.exams || 0} امتحان</span>
    `;
    document.getElementById('course-badges').innerHTML = `
      ${c.popular ? '<span class="badge badge-warn">🔥 شائع</span>' : ''}
      <span class="badge badge-ok">✓ مسجل</span>
    `;
    renderUnits(c.units || []);
  } catch (e) { toast('❌ فشل تحميل الكورس'); }
}

function renderUnits(units) {
  const list = document.getElementById('units-list');
  const empty = document.getElementById('units-empty');
  if (!list) return;
  list.innerHTML = '';
  if (!units.length) { if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  units.forEach((u, i) => {
    const item = document.createElement('div');
    item.className = 'accordion-item' + (i === 0 ? ' open' : '');
    item.innerHTML = `
      <div class="accordion-header" onclick="toggleAcc(this)">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="color:var(--accent);">📁</span>
          <h4>${escapeHtml(u.title)}</h4>
        </div>
        <div class="meta">
          <span>${u.videoCount || 0} فيديو</span>
          <span>${u.examCount || 0} امتحان</span>
          <span style="transform:${i===0?'rotate(180deg)':'rotate(0deg)'};">▼</span>
        </div>
      </div>
      <div class="accordion-content">
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${(u.videos || []).map(v => `
            <a href="video.html?id=${v.id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--bg); border-radius:var(--radius-md); text-decoration:none; color:inherit;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span>▶️</span>
                <span>${escapeHtml(v.title)}</span>
                ${v.watched ? '<span class="badge badge-ok">✓ شُاهد</span>' : ''}
              </div>
              <span style="color:var(--text-muted); font-size:0.85rem;">${v.duration || ''}</span>
            </a>
          `).join('')}
          ${(u.presentations || []).map(p => `
            <a href="presentation.html?id=${p.id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--bg); border-radius:var(--radius-md); text-decoration:none; color:inherit;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span>📊</span>
                <span>${escapeHtml(p.title)}</span>
              </div>
              <span style="color:var(--text-muted); font-size:0.85rem;">${p.slideCount ? p.slideCount + ' شريحة' : 'بوربوينت'}</span>
            </a>
          `).join('')}
          ${(u.exams || []).map(ex => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--bg); border-radius:var(--radius-md);">
              <div style="display:flex; align-items:center; gap:10px;">
                <span>📝</span>
                <span>${escapeHtml(ex.title)}</span>
              </div>
              <a href="exam.html?id=${ex.id}" class="btn btn-primary btn-sm">بدء</a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

async function loadCourseExams(courseId) {
  const list = document.getElementById('exams-list');
  const empty = document.getElementById('exams-empty');
  if (!list) return;
  try {
    const data = await api('/exams?courseId=' + courseId);
    list.innerHTML = '';
    const exams = data.exams || [];
    if (!exams.length) { if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';
    exams.forEach(ex => {
      const div = document.createElement('div');
      div.style.cssText = 'background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); padding:24px;';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
          <div>
            <h3 style="margin-bottom:6px;">${escapeHtml(ex.title)}</h3>
            <p style="color:var(--text-secondary); font-size:0.9rem;">${ex.questionCount || 0} سؤال | ${ex.duration || 0} دقيقة</p>
          </div>
          ${ex.completed ? '<span class="badge badge-ok">✓ تم</span>' : '<span class="badge badge-info">جديد</span>'}
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <a href="exam.html?id=${ex.id}" class="btn btn-primary">${ex.completed ? 'إعادة المحاولة' : 'بدء الامتحان'}</a>
          ${ex.score != null ? `<span style="color:var(--accent-light); font-weight:700; align-self:center;">النتيجة: ${ex.score}%</span>` : ''}
        </div>
      `;
      list.appendChild(div);
    });
  } catch (e) { list.innerHTML = ''; if (empty) empty.style.display = 'block'; }
}

// Exam
// examState.attemptId / expiresAt come from the server (POST /attempts/start)
// — the server's clock is the only source of truth for when time is up.
// examState.answers is mirrored into localStorage on every change so a
// refresh (or the browser dying) never loses an answer that hasn't made it
// to the server yet.
let examState = { examId: null, attemptId: null, questions: [], current: 0, answers: {}, expiresAt: null };
let dirtyAnswerKeys = new Set(); // which question IDs changed since the last autosave

function answersStorageKey_() { return 'mfx_exam_answers_' + examState.attemptId; }
function saveAnswersLocally_() {
  if (!examState.attemptId) return;
  try { localStorage.setItem(answersStorageKey_(), JSON.stringify(examState.answers)); } catch (e) {}
}
function loadAnswersLocally_() {
  try {
    const raw = localStorage.getItem(answersStorageKey_());
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function clearAnswersLocally_() {
  try { localStorage.removeItem(answersStorageKey_()); } catch (e) {}
}

async function loadExam() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { toast('❌ امتحان غير موجود'); return; }
  examState.examId = id;
  setExamLoading_(true, 'جاري بدء الامتحان...');
  try {
    // Start (or resume) the attempt FIRST — this is what gives us a
    // server-issued attemptId + expiresAt to anchor everything else to.
    // One request, deduped server-side, so a double-tap or a page reload
    // never creates a second attempt.
    const startRes = await api('/attempts/start', { method: 'POST', body: JSON.stringify({ examId: id }) });
    if (!startRes || !startRes.ok) {
      const container = document.getElementById('questions-container');
      if (container) container.innerHTML = `<div style="text-align:center; padding:40px 0; color:var(--text-secondary);">❌ ${escapeHtml((startRes && startRes.error) || 'تعذر بدء الامتحان')}</div>`;
      toast('❌ ' + ((startRes && startRes.error) || 'تعذر بدء الامتحان'));
      return;
    }
    const attempt = startRes.data;
    examState.attemptId = attempt.id;
    examState.expiresAt = attempt.expiresAt ? new Date(attempt.expiresAt).getTime() : null;

    setExamLoading_(true, 'جاري تحميل الأسئلة...');
    const res = await api('/exams/' + id);
    const data = (res && res.data) || {};
    examState.questions = data.questions || [];

    // Resume any answers already saved on the server for this attempt,
    // then let localStorage fill in anything saved locally that a slow
    // network hadn't autosaved yet (local always wins — it's newer).
    const serverAnswers = safeParseAnswers_(attempt.answers);
    const localAnswers = loadAnswersLocally_();
    examState.answers = { ...serverAnswers, ...localAnswers };

    document.getElementById('exam-badge').textContent = data.title || 'امتحان';
    document.getElementById('exam-title').textContent = data.description || '';
    const minutes = parseInt(data.timerMinutes, 10) || 0;
    document.getElementById('exam-meta').textContent = `${examState.questions.length} سؤال` + (minutes ? ` | ${minutes} دقيقة` : '');
    setExamLoading_(false);
    renderExam();
    if (examState.expiresAt) startTimer();
    else { const t = document.getElementById('timer'); if (t) t.textContent = '∞'; }
    startAutosaveLoop();
  } catch (e) {
    setExamLoading_(false);
    toast('❌ فشل تحميل الامتحان');
  }
}

function safeParseAnswers_(raw) {
  if (!raw) return {};
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; }
}

function setExamLoading_(isLoading, text) {
  const container = document.getElementById('questions-container');
  if (!container) return;
  if (isLoading) {
    container.innerHTML = `<div style="text-align:center; padding:60px 0; color:var(--text-secondary);">
      <span class="mfx-spinner" style="width:28px; height:28px;"></span>
      <p style="margin-top:12px;">${escapeHtml(text || 'جاري التحميل...')}</p>
    </div>`;
  }
}

function renderExam() {
  const container = document.getElementById('questions-container');
  const empty = document.getElementById('exam-empty');
  if (!examState.questions.length) { container.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  container.innerHTML = examState.questions.map((q, i) => `
    <div class="q-card" data-idx="${i}" data-qid="${q.id}" style="display:${i===0?'block':'none'}">
      <span class="q-num">السؤال ${i+1}</span>
      <p class="q-text">${escapeHtml(q.text)}</p>
      ${q.type === 'listening' && q.audioUrl ? `<audio class="q-audio" controls preload="none" src="${escapeAttr_(q.audioUrl)}">متصفحك لا يدعم الصوت</audio>` : ''}
      <div class="opts" data-qid="${q.id}">${renderQuestionInput(q)}</div>
    </div>
  `).join('');
  updateProg();
  renderQNav();
}

function renderQuestionInput(q) {
  const current = examState.answers[q.id];
  if (q.type === 'mcq' || q.type === 'listening') {
    return (q.options || []).map((opt) => `
      <label class="opt ${current === opt ? 'sel' : ''}" onclick="pickOpt('${q.id}', ${JSON.stringify(opt)})">
        <input type="radio" name="q${q.id}" ${current === opt ? 'checked' : ''}>
        <span>${escapeHtml(opt)}</span>
      </label>`).join('');
  }
  if (q.type === 'truefalse') {
    return ['true', 'false'].map((v) => `
      <label class="opt ${String(current) === v ? 'sel' : ''}" onclick="pickOpt('${q.id}', ${v})">
        <input type="radio" name="q${q.id}" ${String(current) === v ? 'checked' : ''}>
        <span>${v === 'true' ? 'صح' : 'غلط'}</span>
      </label>`).join('');
  }
  if (q.type === 'multi') {
    const selected = Array.isArray(current) ? current : [];
    return (q.options || []).map((opt) => `
      <label class="opt ${selected.includes(opt) ? 'sel' : ''}" onclick="toggleMultiOpt('${q.id}', ${JSON.stringify(opt)})">
        <input type="checkbox" ${selected.includes(opt) ? 'checked' : ''}>
        <span>${escapeHtml(opt)}</span>
      </label>`).join('');
  }
  if (q.type === 'fillblank') {
    return `<input type="text" class="inp" value="${escapeAttr_(current || '')}" oninput="setTextAnswer('${q.id}', this.value)" placeholder="اكتب إجابتك">`;
  }
  // essay
  return `<textarea class="inp" rows="4" oninput="setTextAnswer('${q.id}', this.value)" placeholder="اكتب إجابتك">${escapeHtml(current || '')}</textarea>`;
}

// Selecting an option updates just that question's option list in place
// (not the whole exam) — this is what stops a <audio> listening player
// from being torn down and restarted every time an answer is picked, and
// avoids re-rendering all N questions for a single click.
function updateAnswer_(qId, value) {
  examState.answers[qId] = value;
  dirtyAnswerKeys.add(qId);
  saveAnswersLocally_();
  const optsWrap = document.querySelector(`.opts[data-qid="${qId}"]`);
  const q = examState.questions.find((x) => x.id === qId);
  if (optsWrap && q) optsWrap.innerHTML = renderQuestionInput(q);
  updateProg();
}

function pickOpt(qId, value) { updateAnswer_(qId, value); }
function toggleMultiOpt(qId, value) {
  const arr = Array.isArray(examState.answers[qId]) ? [...examState.answers[qId]] : [];
  const idx = arr.indexOf(value);
  if (idx === -1) arr.push(value); else arr.splice(idx, 1);
  updateAnswer_(qId, arr);
}
function setTextAnswer(qId, value) {
  examState.answers[qId] = value;
  dirtyAnswerKeys.add(qId);
  saveAnswersLocally_();
  updateProg();
}

function renderQNav() {
  const nav = document.getElementById('q-nav');
  if (!nav) return;
  nav.innerHTML = examState.questions.map((_, i) => `
    <button class="btn btn-sm ${i===examState.current?'btn-primary':'btn-secondary'}" style="width:36px; height:36px; padding:0; border-radius:50%;" onclick="goQ(${i})">${i+1}</button>
  `).join('');
  document.getElementById('prev-btn').disabled = examState.current === 0;
  const next = document.getElementById('next-btn');
  if (examState.current === examState.questions.length - 1) {
    next.textContent = 'تسليم 🏁';
    next.onclick = submitExam;
  } else {
    next.textContent = 'التالي →';
    next.onclick = nextQ;
  }
  document.getElementById('submit-btn').disabled = false;
}

function goQ(n) { examState.current = n; document.querySelectorAll('.q-card').forEach((c, i) => c.style.display = i === n ? 'block' : 'none'); renderQNav(); }
function nextQ() { if (examState.current < examState.questions.length - 1) goQ(examState.current + 1); }
function prevQ() { if (examState.current > 0) goQ(examState.current - 1); }

function updateProg() {
  const total = examState.questions.length;
  const ans = Object.keys(examState.answers).filter(k => {
    const v = examState.answers[k];
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  const fill = document.getElementById('progress-fill');
  const txt = document.getElementById('progress-text');
  if (fill) fill.style.width = total ? (ans / total * 100) + '%' : '0%';
  if (txt) txt.textContent = ans + ' / ' + total;
}

// ===== Autosave =====
// Batches every answer changed since the last save into ONE request,
// on a fixed interval — never one request per click. Skips the request
// entirely if nothing changed since the last tick.
let autosaveInt;
function startAutosaveLoop() {
  clearInterval(autosaveInt);
  autosaveInt = setInterval(runAutosave, 10000);
  window.addEventListener('beforeunload', runAutosave);
}
async function runAutosave() {
  if (!examState.attemptId || dirtyAnswerKeys.size === 0) return;
  const keysToSave = [...dirtyAnswerKeys];
  dirtyAnswerKeys.clear();
  const batch = {};
  keysToSave.forEach((k) => { batch[k] = examState.answers[k]; });
  const status = document.getElementById('autosave-status');
  if (status) status.textContent = 'جاري الحفظ...';
  try {
    const res = await api('/attempts/' + examState.attemptId + '/answers', {
      method: 'POST',
      body: JSON.stringify({ answers: batch })
    });
    if (status) status.textContent = (res && res.ok) ? '✓ تم الحفظ' : '';
  } catch (e) {
    // Failed silently — the keys are still in examState/localStorage,
    // so re-add them to be retried on the next tick instead of losing them.
    keysToSave.forEach((k) => dirtyAnswerKeys.add(k));
    if (status) status.textContent = '';
  }
}

// ===== Server-anchored countdown =====
// The countdown always recomputes from examState.expiresAt (a server
// timestamp), never from a locally-ticked "minutes left" counter — so a
// slow tab, a laptop sleeping, or clock drift can't desync the timer from
// what the server will actually enforce.
let timerInt;
function startTimer() {
  clearInterval(timerInt);
  const el = document.getElementById('timer');
  const tick = () => {
    const sec = Math.max(0, Math.round((examState.expiresAt - Date.now()) / 1000));
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    if (el) el.textContent = m + ':' + s;
    if (sec <= 0) { clearInterval(timerInt); confirmSubmit(); }
  };
  tick();
  timerInt = setInterval(tick, 1000);
}

function submitExam() {
  const total = examState.questions.length;
  const ans = Object.keys(examState.answers).length;
  const modal = document.getElementById('submit-modal');
  const msg = document.getElementById('modal-msg');
  if (modal) modal.style.display = 'flex';
  if (msg) msg.innerHTML = `أجبت على <strong style="color:var(--text);">${ans}</strong> من <strong style="color:var(--text);">${total}</strong> سؤال.`;
}

function closeModal() { document.getElementById('submit-modal').style.display = 'none'; }

// Submit now returns immediately (202 PROCESSING) — the actual Sheets
// write happens in a batch on the server. We show the "received" state
// right away, then poll /:id/status with growing intervals (2s, 4s, 8s,
// then staying at 8s) until it settles, instead of holding one long HTTP
// connection open or hammering the server every second.
async function confirmSubmit() {
  closeModal();
  clearInterval(timerInt);
  clearInterval(autosaveInt);
  const confirmBtn = document.querySelector('#submit-modal .btn-primary');
  toast('⏳ جاري تسليم الامتحان...');
  await withButtonLock(confirmBtn, 'جاري التسليم...', async () => {
    try {
      const data = await api('/attempts/' + examState.attemptId + '/submit', {
        method: 'POST',
        body: JSON.stringify({ answers: examState.answers })
      });
      if (!data || !data.ok) {
        toast('❌ ' + ((data && data.error) || 'فشل تسليم الامتحان'));
        return;
      }
      clearAnswersLocally_();
      showSubmissionReceived_();

      if (data.data && data.data.status === 'COMPLETED') {
        // Already flushed (e.g. queue was empty and flushed instantly) —
        // no need to poll at all.
        showResult(data.data);
        return;
      }
      pollSubmissionStatus_(examState.attemptId);
    } catch (e) {}
  });
}

// Step 1 of the two-step message from the spec: confirm receipt instantly,
// independently of whether Sheets has actually been written to yet.
function showSubmissionReceived_() {
  const modal = document.getElementById('result-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  const scoreEl = document.getElementById('result-score');
  const rankEl = document.getElementById('result-rank');
  const timeEl = document.getElementById('result-time');
  if (scoreEl) scoreEl.textContent = '✓';
  if (rankEl) rankEl.textContent = 'تم استلام إجاباتك';
  if (timeEl) timeEl.textContent = 'جاري حفظ الامتحان وحساب النتيجة...';
}

// Graduated polling: 2s, 4s, 8s, then holds at 8s. Stops immediately on
// COMPLETED or FAILED — never polls once a second, never polls forever.
function pollSubmissionStatus_(attemptId) {
  const delays = [2000, 4000, 8000];
  let step = 0;

  const poll = async () => {
    let data;
    try {
      data = await api('/attempts/' + attemptId + '/status');
    } catch (e) {
      // Connection hiccup — just try again on the same backoff schedule.
    }
    const status = data && data.ok && data.data && data.data.status;

    if (status === 'COMPLETED') {
      showResult(data.data);
      return;
    }
    if (status === 'FAILED') {
      toast('❌ حدث خطأ أثناء حفظ الامتحان، سيتم إعادة المحاولة تلقائيًا');
      // The server-side batch processor retries on its own; keep polling
      // so the student sees it resolve without needing to do anything.
    }

    const delay = delays[Math.min(step, delays.length - 1)];
    step += 1;
    setTimeout(poll, delay);
  };

  setTimeout(poll, delays[0]);
}

function showResult(attempt) {
  const modal = document.getElementById('result-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  const scoreEl = document.getElementById('result-score');
  const rankEl = document.getElementById('result-rank');
  const timeEl = document.getElementById('result-time');

  if (!attempt || attempt.resultsPublished === false) {
    // Results not published yet — never show a score/rank the student
    // wasn't meant to see, even transiently.
    if (scoreEl) scoreEl.textContent = '✅';
    if (rankEl) rankEl.textContent = 'تم تسليم الامتحان بنجاح.';
    if (timeEl) timeEl.textContent = 'سيتم إعلان النتيجة بعد اعتماد المعلم.';
    return;
  }
  const pct = Math.round(parseFloat(attempt.percentage) || 0);
  const mins = Math.round((parseFloat(attempt.durationSeconds) || 0) / 60);
  if (scoreEl) scoreEl.textContent = pct + '%';
  if (rankEl) rankEl.textContent = attempt.needsManualGrading ? 'بعض الأسئلة تحتاج تصحيح يدوي' : '';
  if (timeEl) timeEl.textContent = 'الوقت: ' + mins + ' دقيقة';
}

function escapeAttr_(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

// Dashboard
async function loadDashboard() {
  const user = getUser();
  document.getElementById('student-name').textContent = user.name || '—';
  document.getElementById('nav-name').textContent = user.name || '—';
  try {
    const data = await api('/students/dashboard');
    if (data.courses != null) document.getElementById('dash-courses').textContent = data.courses;
    if (data.exams != null) document.getElementById('dash-exams').textContent = data.exams;
    if (data.avgScore != null) document.getElementById('dash-score').textContent = data.avgScore + '%';
    if (data.rank != null) document.getElementById('dash-rank').textContent = '#' + data.rank;

    // Progress
    const prog = document.getElementById('my-progress');
    const progEmpty = document.getElementById('progress-empty');
    if (prog) {
      prog.innerHTML = '';
      if (!data.progress || !data.progress.length) { if (progEmpty) progEmpty.style.display = 'block'; }
      else {
        if (progEmpty) progEmpty.style.display = 'none';
        data.progress.forEach(p => {
          const div = document.createElement('div');
          div.className = 'card';
          div.innerHTML = `
            <div class="card-body">
              <h3>${p.courseTitle}</h3>
              <div style="margin-top:12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:0.85rem;">
                  <span style="color:var(--text-secondary);">التقدم</span>
                  <span style="color:var(--accent-light); font-weight:600;">${p.progress}%</span>
                </div>
                <div class="prog"><div class="prog-fill" style="width:${p.progress}%"></div></div>
              </div>
              <div style="margin-top:12px; font-size:0.85rem; color:var(--text-muted);">
                <span>🎥 ${p.videosWatched}/${p.totalVideos} فيديو</span>
                <span style="margin-right:12px;">📝 ${p.examsTaken} امتحان</span>
              </div>
            </div>
          `;
          prog.appendChild(div);
        });
      }
    }

    // Recent exams
    const recent = document.getElementById('recent-exams');
    const recentEmpty = document.getElementById('exams-empty');
    if (recent) {
      recent.innerHTML = '';
      if (!data.recentExams || !data.recentExams.length) { if (recentEmpty) recentEmpty.style.display = 'block'; }
      else {
        if (recentEmpty) recentEmpty.style.display = 'none';
        data.recentExams.forEach(ex => {
          const div = document.createElement('div');
          div.style.cssText = 'background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px 20px; display:flex; justify-content:space-between; align-items:center;';
          div.innerHTML = `
            <div>
              <div style="font-weight:600;">${escapeHtml(ex.title)}</div>
              <div style="color:var(--text-muted); font-size:0.85rem; margin-top:2px;">${ex.date || ''}</div>
            </div>
            <span class="badge ${ex.score >= 50 ? 'badge-ok' : 'badge-err'}">${ex.score}%</span>
          `;
          recent.appendChild(div);
        });
      }
    }

    // Leaderboard
    const lb = document.getElementById('leaderboard-list');
    const lbEmpty = document.getElementById('leaderboard-empty');
    if (lb) {
      lb.innerHTML = '';
      if (!data.leaderboard || !data.leaderboard.length) { if (lbEmpty) lbEmpty.style.display = 'block'; }
      else {
        if (lbEmpty) lbEmpty.style.display = 'none';
        data.leaderboard.forEach((s, i) => {
          const div = document.createElement('div');
          div.className = 'leaderboard-item';
          const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
          div.innerHTML = `
            <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
            <div style="flex:1;">
              <div style="font-weight:600;">${escapeHtml(s.name)}</div>
              <div style="color:var(--text-muted); font-size:0.85rem;">${s.examsCount} امتحان</div>
            </div>
            <div style="font-weight:700; color:var(--accent-light);">${s.avgScore}%</div>
          `;
          lb.appendChild(div);
        });
      }
    }
  } catch (e) {}
}

// ===== Video player + comments =====
let videoProgressTimer = null;
let videoWatchState = { videoId: null, startedAt: 0, durationSeconds: 0, sentPercentage: 0 };

async function loadVideoPage() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { toast('❌ فيديو غير موجود'); return; }
  try {
    const res = await api('/videos/' + id);
    const video = res.data;
    if (!video) { toast('❌ الفيديو غير موجود'); return; }
    document.getElementById('video-title').textContent = video.title || 'فيديو';
    document.getElementById('back-to-course').href = 'course.html?id=' + video.unitId;
    const frame = document.getElementById('video-frame');
    if (frame && video.driveFileId) {
      frame.src = 'https://drive.google.com/file/d/' + video.driveFileId + '/preview';
    } else if (frame && video.driveUrl) {
      frame.src = video.driveUrl;
    }

    videoWatchState = { videoId: id, startedAt: Date.now(), durationSeconds: parseFloat(video.durationSeconds) || 0, sentPercentage: 0 };
    startVideoProgressTracking();
    loadComments(id);
  } catch (e) { toast('❌ فشل تحميل الفيديو'); }
}

function startVideoProgressTracking() {
  if (videoProgressTimer) clearInterval(videoProgressTimer);
  videoProgressTimer = setInterval(sendVideoProgress, 15000);
  window.addEventListener('beforeunload', sendVideoProgress);
}

async function sendVideoProgress() {
  if (!videoWatchState.videoId) return;
  const watchSeconds = Math.round((Date.now() - videoWatchState.startedAt) / 1000);
  const watchPercentage = videoWatchState.durationSeconds > 0
    ? Math.min(100, Math.round((watchSeconds / videoWatchState.durationSeconds) * 100))
    : Math.min(95, Math.round(watchSeconds / 3)); // rough fallback if no duration is set
  if (watchPercentage <= videoWatchState.sentPercentage) return;
  videoWatchState.sentPercentage = watchPercentage;
  try {
    await api('/videos/' + videoWatchState.videoId + '/progress', {
      method: 'POST',
      body: JSON.stringify({ watchSeconds, watchPercentage })
    });
  } catch (e) {}
}

async function loadComments(videoId) {
  const list = document.getElementById('comments-list');
  const empty = document.getElementById('comments-empty');
  if (!list) return;
  try {
    const res = await api('/comments/video/' + videoId);
    const comments = res.data || [];
    list.innerHTML = '';
    if (!comments.length) { if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';
    const me = getUser();
    comments.forEach(c => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:14px; background:var(--bg); border-radius:var(--radius-md); border:1px solid var(--border);';
      const isTeacher = c.authorRole === 'admin';
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-weight:600; ${isTeacher ? 'color:var(--accent-light);' : ''}">${isTeacher ? '👨‍🏫 ' : ''}${escapeHtml(c.authorName || 'مستخدم')}</span>
          <span style="color:var(--text-muted); font-size:0.75rem;">${formatDate(c.createdAt)}</span>
        </div>
        <p style="color:var(--text-secondary); line-height:1.7;">${escapeHtml(c.text)}</p>
        ${(me.id === c.authorId) ? `<button class="btn btn-ghost btn-sm" style="margin-top:6px; color:var(--danger);" onclick="deleteComment('${c.id}', '${videoId}')">حذف</button>` : ''}
      `;
      list.appendChild(div);
    });
  } catch (e) { if (empty) empty.style.display = 'block'; }
}

async function postComment() {
  const input = document.getElementById('comment-input');
  const params = new URLSearchParams(location.search);
  const videoId = params.get('id');
  const text = input?.value.trim();
  if (!text) return;
  try {
    const res = await api('/comments/video/' + videoId, { method: 'POST', body: JSON.stringify({ text }) });
    if (res.ok) { input.value = ''; loadComments(videoId); }
    else toast('❌ ' + (res.error || 'فشل إرسال التعليق'));
  } catch (e) {}
}

async function deleteComment(commentId, videoId) {
  try {
    await api('/comments/' + commentId, { method: 'DELETE' });
    loadComments(videoId);
  } catch (e) {}
}

// ===== Presentation viewer =====
async function loadPresentationPage() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { toast('❌ ملف غير موجود'); return; }
  try {
    const res = await api('/presentations/' + id);
    const item = res.data;
    if (!item) { toast('❌ الملف غير موجود'); return; }
    document.getElementById('presentation-title').textContent = item.title || 'عرض تقديمي';
    document.getElementById('back-to-course').href = 'course.html?id=' + item.unitId;
    const frame = document.getElementById('presentation-frame');
    const previewUrl = item.driveFileId
      ? 'https://drive.google.com/file/d/' + item.driveFileId + '/preview'
      : item.driveUrl;
    if (frame) frame.src = previewUrl;
    renderPresentationWatermark();
    setupPresentationDeterrents();
  } catch (e) { toast('❌ فشل تحميل العرض التقديمي'); }
}

// Tiles the student's name + code across the presentation area so any
// screenshot or photo of the screen is traceable back to them. This is a
// deterrent, not a real block — nothing on the web can stop someone from
// literally photographing their own screen.
function renderPresentationWatermark() {
  const layer = document.getElementById('presentation-watermark');
  if (!layer) return;
  const user = getUser();
  const label = `${user.name || ''} · ${user.code || ''}`;
  let html = '';
  for (let row = 0; row < 6; row++) {
    html += `<div style="position:absolute; top:${row * 18}%; left:${(row % 2) * -8}%; width:130%; display:flex; gap:60px; opacity:0.16; transform:rotate(-18deg); white-space:nowrap; font-size:0.8rem; color:#fff;">`;
    for (let col = 0; col < 6; col++) html += `<span>${escapeHtml(label)}</span>`;
    html += '</div>';
  }
  layer.innerHTML = html;
}

// A handful of low-friction deterrents against the *casual* "right click,
// save" or "select all, copy" path. None of this stops a determined
// person with a phone camera or a screen recorder — that's simply not
// something any website can prevent.
function setupPresentationDeterrents() {
  const viewer = document.getElementById('presentation-viewer');
  if (!viewer) return;

  viewer.addEventListener('contextmenu', (e) => e.preventDefault());
  viewer.addEventListener('dragstart', (e) => e.preventDefault());
  viewer.style.userSelect = 'none';

  const cover = document.getElementById('presentation-blur-cover');
  const blurNow = () => { if (cover) cover.style.display = 'flex'; };
  const unblurNow = () => { if (cover) cover.style.display = 'none'; };

  // Hide the content the moment the tab loses focus or is backgrounded —
  // makes casual screen-recording apps (which usually need the tab
  // visible/focused) capture a blurred cover instead of the real slides.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) blurNow(); else unblurNow();
  });
  window.addEventListener('blur', blurNow);
  window.addEventListener('focus', unblurNow);

  // Block the most common keyboard shortcuts someone would reach for
  // first (Print, Save, DevTools). Anyone who actually knows what
  // they're doing can still get around this — it just raises the floor
  // above "accidentally easy".
  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const blocked =
      key === 'printscreen' ||
      (e.ctrlKey && (key === 'p' || key === 's' || key === 'u')) ||
      key === 'f12' ||
      (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'c' || key === 'j'));
    if (blocked) {
      e.preventDefault();
      toast('❌ العرض ده محمي');
    }
  });
}

// ===== Chat with teacher =====
let chatPollTimer = null;
async function loadChatPage() {
  const user = getUser();
  const nameEl = document.getElementById('nav-name');
  if (nameEl) nameEl.textContent = user.name || '—';
  await refreshChatMessages();
  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = setInterval(refreshChatMessages, 8000);
}

async function refreshChatMessages() {
  const box = document.getElementById('chat-messages');
  const empty = document.getElementById('chat-empty');
  if (!box) return;
  try {
    const res = await api('/chat/me');
    const messages = res.data || [];
    if (!messages.length) {
      box.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    const wasNearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = messages.map(m => {
      const mine = m.senderRole === 'student';
      return `
        <div style="align-self:${mine ? 'flex-start' : 'flex-end'}; max-width:75%;">
          <div style="background:${mine ? 'var(--bg)' : 'var(--accent)'}; color:${mine ? 'var(--text)' : '#fff'}; padding:10px 14px; border-radius:var(--radius-md); line-height:1.6;">
            ${escapeHtml(m.text)}
          </div>
          <div style="color:var(--text-muted); font-size:0.7rem; margin-top:4px; text-align:${mine ? 'right' : 'left'};">${formatDate(m.createdAt)}</div>
        </div>
      `;
    }).join('');
    if (wasNearBottom) box.scrollTop = box.scrollHeight;
  } catch (e) {}
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  try {
    const res = await api('/chat/me', { method: 'POST', body: JSON.stringify({ text }) });
    if (!res.ok) toast('❌ ' + (res.error || 'فشل إرسال الرسالة'));
    await refreshChatMessages();
    const box = document.getElementById('chat-messages');
    if (box) box.scrollTop = box.scrollHeight;
  } catch (e) {}
}

// ===== small helpers =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

// UI Helpers
function switchTab(tab, id) {
  tab.parentElement.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  const container = tab.closest('div').parentElement;
  container.querySelectorAll('[id^="tab-"]').forEach(c => c.style.display = 'none');
  const target = container.querySelector('#tab-' + id);
  if (target) target.style.display = 'block';
}

function toggleAcc(header) {
  const item = header.closest('.accordion-item');
  item.classList.toggle('open');
  const arrow = header.querySelector('.meta span:last-child, span:last-child');
  if (arrow) arrow.style.transform = item.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  const path = location.pathname;
  if (path.includes('login.html')) {
    // Pre-fill the code when a student arrives via a QR-code deep link
    // (login.html?code=XXXX) instead of typing it in by hand.
    const qrCode = new URLSearchParams(location.search).get('code');
    const codeInput = document.getElementById('login-code');
    if (qrCode && codeInput) codeInput.value = qrCode;
    return;
  }
  if (path.includes('index.html')) loadMyCourses();
  if (path.includes('course.html')) loadCourse();
  if (path.includes('exam.html')) loadExam();
  if (path.includes('dashboard.html')) loadDashboard();
  if (path.includes('video.html')) loadVideoPage();
  if (path.includes('presentation.html')) loadPresentationPage();
  if (path.includes('chat.html')) loadChatPage();
});

// When the browser restores a page from its back/forward cache (e.g. the
// student hits the back button), it shows the old DOM as-is without
// re-running any of the code above — including the login check. That's
// what made an expired/logged-out session look like it was still showing
// "the old page". Forcing a fresh load re-runs requireAuth() and re-fetches
// real data instead.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});

window.onclick = e => {
  if (e.target.id === 'submit-modal') closeModal();
};
