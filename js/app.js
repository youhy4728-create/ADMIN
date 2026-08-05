// ===== MFX Admin App =====
const API = '/api';

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
let allStudentsCache = [];
async function loadStudentsPage() {
  try {
    const data = await api('/students');
    allStudentsCache = data.students || [];
    renderStudentsTable(allStudentsCache);
  } catch (e) {}
}

function renderStudentsTable(students) {
  const tbody = document.getElementById('students-table');
  const emptySearch = document.getElementById('students-empty-search');
  if (!tbody) return;
  if (!students.length) {
    tbody.innerHTML = '';
    if (emptySearch) emptySearch.style.display = 'block';
    return;
  }
  if (emptySearch) emptySearch.style.display = 'none';
  tbody.innerHTML = students.map(s => `
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
      <td style="display:flex; gap:6px;">
        <a href="student-detail.html?id=${s.id}" class="btn btn-secondary btn-sm">👁️ عرض</a>
        <a href="chat.html?studentId=${s.id}" class="btn btn-ghost btn-sm">💬</a>
      </td>
    </tr>
  `).join('');
}

function filterStudents() {
  const q = (document.getElementById('student-search')?.value || '').trim().toLowerCase();
  if (!q) { renderStudentsTable(allStudentsCache); return; }
  const filtered = allStudentsCache.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
  renderStudentsTable(filtered);
}

// Student detail (activity view reached from the search/list page)
async function loadStudentDetailPage() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) { toast('❌ طالب غير موجود'); return; }
  try {
    const res = await api('/students/' + id + '/activity');
    if (!res.ok) { toast('❌ ' + (res.error || 'فشل تحميل بيانات الطالب')); return; }
    const d = res.data;

    document.getElementById('detail-name').textContent = d.student.name || '—';
    document.getElementById('detail-code').textContent = d.student.code || '—';
    document.getElementById('detail-last-login').textContent = d.student.lastLoginAt ? new Date(d.student.lastLoginAt).toLocaleString('ar-EG') : '—';
    document.getElementById('detail-chat-link').href = 'chat.html?studentId=' + id;

    document.getElementById('detail-videos-watched').textContent = d.videosWatched || 0;
    document.getElementById('detail-exams-taken').textContent = (d.examActivity || []).length;
    document.getElementById('detail-comments-count').textContent = (d.comments || []).length;
    document.getElementById('detail-units-count').textContent = (d.enrolledUnits || []).length;

    const videosBox = document.getElementById('detail-videos');
    videosBox.innerHTML = (d.videoActivity || []).length
      ? d.videoActivity.map(v => `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
            <span>${v.videoTitle}</span>
            <span class="badge ${v.status === 'finished' ? 'badge-ok' : 'badge-info'}">${v.status === 'finished' ? '✓ خلص' : v.watchPercentage + '%'}</span>
          </div>
        `).join('')
      : '<p style="color:var(--text-muted);">لسه ما شافش أي فيديو</p>';

    const examsBox = document.getElementById('detail-exams');
    examsBox.innerHTML = (d.examActivity || []).length
      ? d.examActivity.map(e => `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
            <span>${e.examTitle}</span>
            <span style="font-weight:700; color:${e.percentage >= 50 ? 'var(--success)' : 'var(--danger)'};">${e.percentage}%</span>
          </div>
        `).join('')
      : '<p style="color:var(--text-muted);">لسه ما دخلش أي امتحان</p>';

    const commentsBox = document.getElementById('detail-comments');
    commentsBox.innerHTML = (d.comments || []).length
      ? d.comments.map(c => `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 16px;">
            <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:4px;">على فيديو: ${c.videoTitle}</div>
            <div>${c.text}</div>
          </div>
        `).join('')
      : '<p style="color:var(--text-muted);">لسه ماعملش أي تعليق</p>';
  } catch (e) { toast('❌ فشل تحميل بيانات الطالب'); }
}

// Presentations (PowerPoint) management
async function loadPresentationsPage() {
  try {
    const units = (await api('/units')).data || [];
    const select = document.getElementById('pres-unit');
    if (select) {
      select.innerHTML = '<option value="">اختر الكورس</option>' + units.map(u => `<option value="${u.id}">${u.title}</option>`).join('');
    }
  } catch (e) {}
}

async function uploadPresentation() {
  const unitId = document.getElementById('pres-unit')?.value;
  const title = document.getElementById('pres-title')?.value.trim();
  const fileInput = document.getElementById('pres-file');
  const file = fileInput?.files?.[0];
  if (!unitId) { toast('❌ اختر الكورس أولاً'); return; }
  if (!title) { toast('❌ اكتب عنوان العرض'); return; }
  if (!file) { toast('❌ اختر ملف بوربوينت'); return; }

  toast('⏳ جاري رفع الملف...');
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subfolder', 'presentations');
    const token = getToken();
    const uploadRes = await fetch(API + '/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.ok) { toast('❌ ' + (uploadData.error || 'فشل رفع الملف')); return; }

    const created = await api('/presentations', {
      method: 'POST',
      body: JSON.stringify({
        unitId, title,
        driveFileId: uploadData.data.driveFileId,
        driveUrl: uploadData.data.driveUrl
      })
    });
    if (created.ok) {
      toast('✅ تم رفع العرض التقديمي');
      document.getElementById('pres-title').value = '';
      fileInput.value = '';
      loadPresentationsList(unitId);
    } else {
      toast('❌ ' + (created.error || 'فشل حفظ العرض'));
    }
  } catch (e) { toast('❌ فشل رفع الملف'); }
}

async function loadPresentationsList(unitId) {
  const list = document.getElementById('pres-list');
  if (!list) return;
  if (!unitId) { list.innerHTML = ''; return; }
  try {
    const res = await api('/presentations/unit/' + unitId);
    const items = res.data || [];
    list.innerHTML = items.length
      ? items.map(p => `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 16px;">
            <span>📊 ${p.title}</span>
            <div style="display:flex; gap:8px;">
              <a href="${p.driveUrl}" target="_blank" class="btn btn-ghost btn-sm">فتح</a>
              <button class="btn btn-danger btn-sm" onclick="deletePresentation('${p.id}', '${unitId}')">حذف</button>
            </div>
          </div>
        `).join('')
      : '<p style="color:var(--text-muted);">لا توجد عروض تقديمية لهذا الكورس بعد</p>';
  } catch (e) {}
}

async function deletePresentation(id, unitId) {
  try {
    await api('/presentations/' + id, { method: 'DELETE' });
    toast('✅ تم الحذف');
    loadPresentationsList(unitId);
  } catch (e) {}
}

// Chat (admin side: thread list + one conversation)
let adminChatPollTimer = null;
async function loadChatPage() {
  const params = new URLSearchParams(location.search);
  const studentId = params.get('studentId');
  await loadChatThreads();
  if (studentId) openChatThread(studentId);
  if (adminChatPollTimer) clearInterval(adminChatPollTimer);
  adminChatPollTimer = setInterval(loadChatThreads, 10000);
}

async function loadChatThreads() {
  const list = document.getElementById('chat-threads');
  if (!list) return;
  try {
    const res = await api('/chat/threads');
    const threads = res.data || [];
    list.innerHTML = threads.length
      ? threads.map(t => `
          <div class="dash-nav-item" style="cursor:pointer;" onclick="openChatThread('${t.studentId}')">
            <span>${t.unread > 0 ? '🔴' : '👤'}</span>
            <div style="flex:1; overflow:hidden;">
              <div style="font-weight:600;">${t.studentName}</div>
              <div style="color:var(--text-muted); font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${t.lastMessage || ''}</div>
            </div>
          </div>
        `).join('')
      : '<p style="color:var(--text-muted); padding:12px;">لا توجد محادثات بعد</p>';
  } catch (e) {}
}

let currentChatStudentId = null;
async function openChatThread(studentId) {
  currentChatStudentId = studentId;
  const title = document.getElementById('chat-with-title');
  try {
    const students = (await api('/students')).students || [];
    const student = students.find(s => s.id === studentId);
    if (title) title.textContent = student ? ('💬 ' + student.name) : '💬 المحادثة';
  } catch (e) {}
  await refreshAdminChatMessages();
}

async function refreshAdminChatMessages() {
  if (!currentChatStudentId) return;
  const box = document.getElementById('chat-messages');
  if (!box) return;
  try {
    const res = await api('/chat/' + currentChatStudentId);
    const messages = res.data || [];
    box.innerHTML = messages.length
      ? messages.map(m => {
          const fromAdmin = m.senderRole === 'admin';
          return `
            <div style="align-self:${fromAdmin ? 'flex-start' : 'flex-end'}; max-width:75%;">
              <div style="background:${fromAdmin ? 'var(--accent)' : 'var(--bg)'}; color:${fromAdmin ? '#fff' : 'var(--text)'}; padding:10px 14px; border-radius:var(--radius-md); line-height:1.6;">
                ${m.text}
              </div>
            </div>
          `;
        }).join('')
      : '<p style="color:var(--text-muted); text-align:center; padding:24px;">ابدأ المحادثة مع الطالب</p>';
    box.scrollTop = box.scrollHeight;
  } catch (e) {}
}

async function sendAdminChatMessage() {
  if (!currentChatStudentId) { toast('❌ اختر طالب أولاً'); return; }
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  try {
    await api('/chat/' + currentChatStudentId, { method: 'POST', body: JSON.stringify({ text }) });
    await refreshAdminChatMessages();
    loadChatThreads();
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
  if (path.includes('student-detail.html')) loadStudentDetailPage();
  if (path.includes('presentations.html')) loadPresentationsPage();
  if (path.includes('chat.html')) loadChatPage();
});
