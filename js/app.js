// ===== MFX Admin App =====
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

function getToken() { return localStorage.getItem('mfx_admin_token'); }
function setToken(t) { localStorage.setItem('mfx_admin_token', t); }
function logout() { localStorage.removeItem('mfx_admin_token'); location.href = 'login.html'; }

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

function requireAuth() {
  if (!getToken() && !location.pathname.includes('login.html')) {
    location.href = 'login.html';
  }
}

// Admin Login
async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('admin-user')?.value.trim();
  const password = document.getElementById('admin-pass')?.value.trim();
  if (!username || !password) { toast('❌ أدخل جميع البيانات'); return; }
  toast('⏳ جاري التحقق...');
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.token) {
      setToken(data.token);
      toast('✅ تم تسجيل الدخول');
      setTimeout(() => location.href = 'index.html', 800);
    } else {
      toast('❌ ' + (data.error || 'بيانات غير صحيحة'));
    }
  } catch (e) {}
}

// Dashboard
async function loadAdminDashboard() {
  try {
    const data = await api('/analytics/overview');
    if (data.students != null) document.getElementById('stat-students').textContent = data.students;
    if (data.courses != null) document.getElementById('stat-courses').textContent = data.courses;
    if (data.exams != null) document.getElementById('stat-exams').textContent = data.exams;
    if (data.activeCodes != null) document.getElementById('stat-codes').textContent = data.activeCodes;

    // Recent activity
    const act = document.getElementById('recent-activity');
    if (act && data.recentActivity) {
      act.innerHTML = '';
      data.recentActivity.forEach(a => {
        const div = document.createElement('div');
        div.style.cssText = 'background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;';
        div.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:1.2rem;">${a.icon || '•'}</span>
            <div>
              <div style="font-weight:600; font-size:0.9rem;">${a.text}</div>
              <div style="color:var(--text-muted); font-size:0.8rem;">${a.time || ''}</div>
            </div>
          </div>
        `;
        act.appendChild(div);
      });
    }

    // Top students
    const top = document.getElementById('top-students');
    if (top && data.topStudents) {
      top.innerHTML = '';
      data.topStudents.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-item';
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
        div.innerHTML = `
          <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
          <div style="flex:1;">
            <div style="font-weight:600;">${s.name}</div>
            <div style="color:var(--text-muted); font-size:0.85rem;">${s.course || ''}</div>
          </div>
          <div style="font-weight:700; color:var(--accent-light);">${s.avgScore}%</div>
        `;
        top.appendChild(div);
      });
    }
  } catch (e) {}
}

// Codes
async function loadCodesPage() {
  // Load courses dropdown
  try {
    const data = await api('/units');
    const select = document.getElementById('code-course');
    if (select && data.courses) {
      select.innerHTML = '<option value="">اختر الكورس</option>' + 
        data.courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
    }
    loadCodesList();
  } catch (e) {}
}

async function loadCodesList() {
  try {
    const data = await api('/codes');
    const tbody = document.getElementById('codes-table');
    if (!tbody) return;
    if (!data.codes || !data.codes.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">لا توجد أكواد</td></tr>';
      return;
    }
    tbody.innerHTML = data.codes.map(c => `
      <tr>
        <td style="font-family:monospace; font-weight:600; color:var(--accent-light);">${c.code}</td>
        <td>${c.courseTitle || '—'}</td>
        <td><span class="badge ${c.used ? 'badge-ok' : 'badge-info'}">${c.used ? '✓ مستخدم' : 'متاح'}</span></td>
        <td>${c.createdAt || '—'}</td>
        <td>${c.expiresAt || '—'}</td>
      </tr>
    `).join('');
  } catch (e) {}
}

async function generateCodes() {
  const courseId = document.getElementById('code-course')?.value;
  const count = document.getElementById('code-count')?.value;
  const expiry = document.getElementById('code-expiry')?.value;
  if (!courseId) { toast('❌ اختر الكورس'); return; }
  toast('⏳ جاري توليد الأكواد...');
  try {
    await api('/codes/generate', {
      method: 'POST',
      body: JSON.stringify({ courseId, count: parseInt(count) || 10, expiryDays: parseInt(expiry) || 30 })
    });
    toast('✅ تم توليد الأكواد');
    loadCodesList();
  } catch (e) {}
}

// Students
async function loadStudentsPage() {
  try {
    const data = await api('/students');
    const tbody = document.getElementById('students-table');
    if (!tbody) return;
    if (!data.students || !data.students.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">لا يوجد طلاب</td></tr>';
      return;
    }
    tbody.innerHTML = data.students.map(s => `
      <tr>
        <td style="font-weight:600;">${s.name}</td>
        <td style="font-family:monospace; color:var(--text-muted);">${s.code}</td>
        <td>${s.courseTitle || '—'}</td>
        <td>
          <div class="prog" style="width:100px;"><div class="prog-fill" style="width:${s.progress || 0}%"></div></div>
          <span style="font-size:0.8rem; color:var(--text-muted);">${s.progress || 0}%</span>
        </td>
        <td>${s.examsTaken || 0}</td>
        <td style="font-weight:700; color:${s.avgScore >= 50 ? 'var(--success)' : 'var(--danger)'}">${s.avgScore != null ? s.avgScore + '%' : '—'}</td>
        <td>${s.videosWatched || 0}/${s.totalVideos || 0} <span style="color:var(--text-muted); font-size:0.8rem;">فيديو</span></td>
      </tr>
    `).join('');
  } catch (e) {}
}

// Exams / Results
async function loadExamsPage() {
  try {
    // Load exams dropdown
    const examsData = await api('/exams');
    const select = document.getElementById('exam-select');
    if (select && examsData.exams) {
      select.innerHTML = '<option value="">جميع الامتحانات</option>' + 
        examsData.exams.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
    }
    loadExamResults();
  } catch (e) {}
}

async function loadExamResults() {
  const examId = document.getElementById('exam-select')?.value;
  try {
    const path = examId ? '/analytics/exam-results?examId=' + examId : '/analytics/exam-results';
    const data = await api(path);

    // Stats
    if (data.avgScore != null) document.getElementById('exam-avg').textContent = data.avgScore + '%';
    if (data.highestScore != null) document.getElementById('exam-highest').textContent = data.highestScore + '%';
    if (data.lowestScore != null) document.getElementById('exam-lowest').textContent = data.lowestScore + '%';
    if (data.attemptsCount != null) document.getElementById('exam-count').textContent = data.attemptsCount;

    // Leaderboard
    const lb = document.getElementById('exam-leaderboard');
    if (lb && data.leaderboard) {
      lb.innerHTML = '';
      data.leaderboard.forEach((s, i) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-item';
        const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
        div.innerHTML = `
          <div class="leaderboard-rank ${rankClass}">${i + 1}</div>
          <div style="flex:1;">
            <div style="font-weight:600;">${s.name}</div>
            <div style="color:var(--text-muted); font-size:0.85rem;">${s.time || ''}</div>
          </div>
          <div style="font-weight:700; color:var(--accent-light);">${s.score}%</div>
        `;
        lb.appendChild(div);
      });
    }

    // Results table
    const tbody = document.getElementById('results-table');
    if (tbody && data.results) {
      if (!data.results.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">لا توجد نتائج</td></tr>';
      } else {
        tbody.innerHTML = data.results.map((r, i) => `
          <tr>
            <td style="font-weight:700;">#${i + 1}</td>
            <td style="font-weight:600;">${r.name}</td>
            <td style="color:${r.score >= 50 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${r.score}%</td>
            <td style="color:var(--text-muted);">${r.time || '—'}</td>
            <td style="color:var(--text-muted); font-size:0.85rem;">${r.date || '—'}</td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {}
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  const path = location.pathname;
  if (path.includes('login.html')) return;
  if (path.includes('index.html')) loadAdminDashboard();
  if (path.includes('codes.html')) loadCodesPage();
  if (path.includes('students.html')) loadStudentsPage();
  if (path.includes('exams.html')) loadExamsPage();
});
