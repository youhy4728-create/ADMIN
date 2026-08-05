// ===== MFX Student App =====
const API_BASE = 'https://mrmomd-production.up.railway.app/api';

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

function getToken() { return localStorage.getItem('mfx_student_token'); }
function setToken(t) { localStorage.setItem('mfx_student_token', t); }
function getUser() { try { return JSON.parse(localStorage.getItem('mfx_student_user') || '{}'); } catch(e) { return {}; } }
function logout() { localStorage.removeItem('mfx_student_token'); localStorage.removeItem('mfx_student_user'); location.href = 'login.html'; }

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
  if (!getToken() && !location.pathname.includes('login.html')) {
    location.href = 'login.html';
  }
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  const code = document.getElementById('login-code')?.value.trim();
  const name = document.getElementById('login-name')?.value.trim();
  if (!code || !name) { toast('❌ أدخل الكود والاسم'); return; }
  toast('⏳ جاري التحقق...');
  try {
    const data = await api('/auth/student-login', {
      method: 'POST',
      body: JSON.stringify({ code, name })
    });
    if (data.token) {
      setToken(data.token);
      localStorage.setItem('mfx_student_user', JSON.stringify(data.user));
      toast('✅ تم تسجيل الدخول');
      setTimeout(() => location.href = 'index.html', 800);
    } else {
      toast('❌ ' + (data.error || 'كود أو اسم غير صحيح'));
    }
  } catch (e) {}
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
          <h3>${c.title}</h3>
          <p>${c.description || ''}</p>
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
    const c = await api('/units?courseId=' + id);
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
    loadUnits(id);
    loadCourseExams(id);
  } catch (e) { toast('❌ فشل تحميل الكورس'); }
}

async function loadUnits(courseId) {
  const list = document.getElementById('units-list');
  const empty = document.getElementById('units-empty');
  if (!list) return;
  try {
    const data = await api('/units?courseId=' + courseId);
    list.innerHTML = '';
    const units = data.units || [];
    if (!units.length) { if (empty) empty.style.display = 'block'; return; }
    if (empty) empty.style.display = 'none';
    units.forEach((u, i) => {
      const item = document.createElement('div');
      item.className = 'accordion-item' + (i === 0 ? ' open' : '');
      item.innerHTML = `
        <div class="accordion-header" onclick="toggleAcc(this)">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="color:var(--accent);">📁</span>
            <h4>${u.title}</h4>
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
              <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--bg); border-radius:var(--radius-md);">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span>▶️</span>
                  <span>${v.title}</span>
                  ${v.watched ? '<span class="badge badge-ok">✓ شُاهد</span>' : ''}
                </div>
                <span style="color:var(--text-muted); font-size:0.85rem;">${v.duration || ''}</span>
              </div>
            `).join('')}
            ${(u.exams || []).map(ex => `
              <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--bg); border-radius:var(--radius-md);">
                <div style="display:flex; align-items:center; gap:10px;">
                  <span>📝</span>
                  <span>${ex.title}</span>
                </div>
                <a href="exam.html?id=${ex.id}" class="btn btn-primary btn-sm">بدء</a>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      list.appendChild(item);
    });
  } catch (e) { list.innerHTML = ''; if (empty) empty.style.display = 'block'; }
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
            <h3 style="margin-bottom:6px;">${ex.title}</h3>
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
let examState = { questions: [], current: 0, answers: {}, startTime: null };

async function loadExam() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { toast('❌ امتحان غير موجود'); return; }
  try {
    const data = await api('/exams/' + id);
    examState.questions = data.questions || [];
    examState.startTime = Date.now();
    document.getElementById('exam-badge').textContent = data.title || 'امتحان';
    document.getElementById('exam-title').textContent = data.subtitle || '';
    document.getElementById('exam-meta').textContent = `${examState.questions.length} سؤال | ${data.duration || 0} دقيقة`;
    renderExam();
    startTimer(data.duration || 30);
  } catch (e) { toast('❌ فشل تحميل الامتحان'); }
}

function renderExam() {
  const container = document.getElementById('questions-container');
  const empty = document.getElementById('exam-empty');
  if (!examState.questions.length) { container.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  container.innerHTML = examState.questions.map((q, i) => `
    <div class="q-card" data-idx="${i}" style="display:${i===0?'block':'none'}">
      <span class="q-num">السؤال ${i+1}</span>
      <p class="q-text">${q.text}</p>
      <div class="opts">
        ${(q.options || []).map((opt, j) => `
          <label class="opt ${examState.answers[i] === j ? 'sel' : ''}" onclick="pickOpt(${i}, ${j})">
            <input type="radio" name="q${i}" value="${j}" ${examState.answers[i] === j ? 'checked' : ''}>
            <span>${opt}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');
  updateProg();
  renderQNav();
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

function pickOpt(qIdx, optIdx) {
  examState.answers[qIdx] = optIdx;
  const card = document.querySelector(`.q-card[data-idx="${qIdx}"]`);
  if (card) {
    card.querySelectorAll('.opt').forEach((o, i) => o.classList.toggle('sel', i === optIdx));
  }
  updateProg();
}

function goQ(n) { examState.current = n; document.querySelectorAll('.q-card').forEach((c, i) => c.style.display = i === n ? 'block' : 'none'); renderQNav(); }
function nextQ() { if (examState.current < examState.questions.length - 1) goQ(examState.current + 1); }
function prevQ() { if (examState.current > 0) goQ(examState.current - 1); }

function updateProg() {
  const total = examState.questions.length;
  const ans = Object.keys(examState.answers).length;
  const fill = document.getElementById('progress-fill');
  const txt = document.getElementById('progress-text');
  if (fill) fill.style.width = total ? (ans / total * 100) + '%' : '0%';
  if (txt) txt.textContent = ans + ' / ' + total;
}

let timerInt;
function startTimer(minutes) {
  let sec = minutes * 60;
  const el = document.getElementById('timer');
  timerInt = setInterval(() => {
    sec--;
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    if (el) el.textContent = m + ':' + s;
    if (sec <= 0) { clearInterval(timerInt); confirmSubmit(); }
  }, 1000);
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

async function confirmSubmit() {
  closeModal();
  clearInterval(timerInt);
  toast('⏳ جاري التصحيح...');
  try {
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const timeTaken = Math.floor((Date.now() - examState.startTime) / 1000 / 60);
    const data = await api('/exams/' + id + '/submit', {
      method: 'POST',
      body: JSON.stringify({ answers: examState.answers, timeTaken })
    });
    showResult(data);
  } catch (e) {}
}

function showResult(data) {
  const modal = document.getElementById('result-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('result-score').textContent = (data.score || 0) + '%';
    document.getElementById('result-rank').textContent = 'ترتيبك: #' + (data.rank || '—');
    document.getElementById('result-time').textContent = 'الوقت: ' + (data.timeTaken || '—') + ' دقيقة';
  }
}

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
              <div style="font-weight:600;">${ex.title}</div>
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
              <div style="font-weight:600;">${s.name}</div>
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
  if (path.includes('login.html')) return;
  if (path.includes('index.html')) loadMyCourses();
  if (path.includes('course.html')) loadCourse();
  if (path.includes('exam.html')) loadExam();
  if (path.includes('dashboard.html')) loadDashboard();
});

window.onclick = e => {
  if (e.target.id === 'submit-modal') closeModal();
};
