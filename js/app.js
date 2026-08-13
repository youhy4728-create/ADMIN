// ===== MFX Admin App =====
const API = 'https://mrmomd-production.up.railway.app/api';
// Used to build the QR-code deep link students scan to log in with a
// pre-filled code. Update this if the student site's domain ever changes.
const STUDENT_SITE_URL = 'https://student-momdoh.vercel.app';

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

function requireAuth() {
  const onLoginPage = location.pathname.includes('login.html');
  const token = getToken();
  if (onLoginPage) return;
  if (!token || isTokenExpired(token)) {
    logout();
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
              <div style="font-weight:600; font-size:0.9rem;">${escapeHtmlAdmin(a.text)}</div>
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
            <div style="font-weight:600;">${escapeHtmlAdmin(s.name)}</div>
            <div style="color:var(--text-muted); font-size:0.85rem;">${escapeHtmlAdmin(s.course || '')}</div>
          </div>
          <div style="font-weight:700; color:var(--accent-light);">${s.avgScore}%</div>
        `;
        top.appendChild(div);
      });
    }
  } catch (e) {}
}

// Units / Courses
async function loadUnitsPage() {
  loadUnitsList();
}

async function loadUnitsList() {
  try {
    const res = await api('/units');
    const units = res && res.data ? res.data : [];
    const wrap = document.getElementById('units-list');
    if (!wrap) return;
    if (!units.length) {
      wrap.innerHTML = '<p style="color:var(--text-muted);">لا توجد كورسات لسه — دوس "كورس جديد" عشان تضيف أول كورس.</p>';
      return;
    }
    units.sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0));
    wrap.innerHTML = units.map(u => `
      <div class="card">
        <div class="card-body">
          <span class="badge ${u.status === 'published' ? 'badge-ok' : 'badge-warn'}">${u.status === 'published' ? '✓ منشور' : (u.status === 'hidden' ? 'مخفي' : 'مسودة')}</span>
          <h3 style="margin-top:12px;">${escapeHtmlAdmin(u.title)}</h3>
          <p>${escapeHtmlAdmin(u.description || 'بدون وصف')}</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" onclick="openVideosPanel('${u.id}', '${escapeHtmlAdmin(u.title)}')">🎥 الفيديوهات</button>
            ${u.status === 'published'
              ? `<button class="btn btn-secondary btn-sm" onclick="hideUnit('${u.id}')">🙈 إخفاء</button>`
              : `<button class="btn btn-primary btn-sm" onclick="publishUnit('${u.id}')">🚀 نشر</button>`}
            <button class="btn btn-danger btn-sm" onclick="deleteUnit('${u.id}')">🗑 حذف</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

function openAddUnitForm() {
  document.getElementById('unit-form-wrap').style.display = 'block';
}
function closeAddUnitForm() {
  document.getElementById('unit-form-wrap').style.display = 'none';
  document.getElementById('unit-title').value = '';
  document.getElementById('unit-description').value = '';
}

async function saveUnit() {
  const title = document.getElementById('unit-title')?.value.trim();
  const description = document.getElementById('unit-description')?.value.trim();
  if (!title) { toast('❌ اكتب عنوان الكورس'); return; }
  try {
    const res = await api('/units', {
      method: 'POST',
      body: JSON.stringify({ title, description })
    });
    if (res && res.ok) {
      toast('✅ تم إضافة الكورس (مسودة — دوس نشر عشان يظهر للطلاب)');
      closeAddUnitForm();
      loadUnitsList();
    } else {
      toast('❌ ' + (res?.error || 'فشل إضافة الكورس'));
    }
  } catch (e) {}
}

async function publishUnit(id) {
  try {
    const res = await api('/units/' + id + '/publish', { method: 'POST' });
    if (res && res.ok) { toast('✅ الكورس بقى منشور للطلاب'); loadUnitsList(); }
  } catch (e) {}
}

async function hideUnit(id) {
  try {
    const res = await api('/units/' + id + '/hide', { method: 'POST' });
    if (res && res.ok) { toast('✅ تم إخفاء الكورس'); loadUnitsList(); }
  } catch (e) {}
}

async function deleteUnit(id) {
  if (!confirm('حذف الكورس هيمسح كل الفيديوهات والامتحانات جواه كمان. متأكد؟')) return;
  try {
    const res = await api('/units/' + id, { method: 'DELETE' });
    if (res && res.ok) { toast('✅ تم حذف الكورس'); loadUnitsList(); }
  } catch (e) {}
}

function escapeHtmlAdmin(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Units / Courses — videos
let currentVideosUnitId = null;

function openVideosPanel(unitId, unitTitle) {
  currentVideosUnitId = unitId;
  document.getElementById('videos-wrap').style.display = 'block';
  document.getElementById('videos-unit-title').textContent = unitTitle;
  setVideoMode('upload');
  loadVideosForUnit();
  document.getElementById('videos-wrap').scrollIntoView({ behavior: 'smooth' });
}
function closeVideosPanel() {
  currentVideosUnitId = null;
  document.getElementById('videos-wrap').style.display = 'none';
}
function setVideoMode(mode) {
  document.getElementById('video-mode-upload').style.display = mode === 'upload' ? 'block' : 'none';
  document.getElementById('video-mode-link').style.display = mode === 'link' ? 'block' : 'none';
  document.getElementById('video-mode-upload-btn').className = 'btn btn-sm ' + (mode === 'upload' ? 'btn-primary' : 'btn-secondary');
  document.getElementById('video-mode-link-btn').className = 'btn btn-sm ' + (mode === 'link' ? 'btn-primary' : 'btn-secondary');
}

async function loadVideosForUnit() {
  if (!currentVideosUnitId) return;
  const list = document.getElementById('videos-list');
  list.innerHTML = '⏳ جاري التحميل...';
  try {
    const res = await api('/videos/unit/' + currentVideosUnitId);
    const videos = res && res.data ? res.data : [];
    if (!videos.length) {
      list.innerHTML = '<p style="color:var(--text-muted);">مفيش فيديوهات في الكورس ده لسه.</p>';
      return;
    }
    videos.sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0));
    list.innerHTML = videos.map(v => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border:1px solid var(--border); border-radius:var(--radius-md); margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span>▶️</span>
          <span>${escapeHtmlAdmin(v.title)}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteVideo('${v.id}')">🗑</button>
      </div>
    `).join('');
  } catch (e) {}
}

async function uploadVideo() {
  const title = document.getElementById('video-title')?.value.trim();
  const fileInput = document.getElementById('video-file');
  const file = fileInput?.files?.[0];
  if (!currentVideosUnitId) return;
  if (!title) { toast('❌ اكتب عنوان الفيديو'); return; }
  if (!file) { toast('❌ اختار ملف الفيديو'); return; }

  const progressWrap = document.getElementById('video-upload-progress');
  const fill = document.getElementById('video-upload-fill');
  const pct = document.getElementById('video-upload-pct');
  const btn = document.getElementById('video-upload-btn');
  progressWrap.style.display = 'block';
  btn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subfolder', 'videos');

    const uploadRes = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API + '/upload');
      const token = getToken();
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const p = Math.round((e.loaded / e.total) * 100);
          fill.style.width = p + '%';
          pct.textContent = p + '%';
        }
      };
      xhr.onload = () => {
        if (xhr.status === 401) { logout(); return; }
        try { resolve(JSON.parse(xhr.responseText)); } catch (e) { reject(e); }
      };
      xhr.onerror = () => reject(new Error('network error'));
      xhr.send(formData);
    });

    if (!uploadRes || !uploadRes.ok) {
      toast('❌ ' + (uploadRes?.error || 'فشل رفع الفيديو'));
      return;
    }

    const res = await api('/videos', {
      method: 'POST',
      body: JSON.stringify({
        unitId: currentVideosUnitId,
        title,
        driveFileId: uploadRes.data.driveFileId,
        driveUrl: uploadRes.data.previewUrl || uploadRes.data.driveUrl
      })
    });
    if (res && res.ok) {
      toast('✅ تم رفع الفيديو');
      document.getElementById('video-title').value = '';
      fileInput.value = '';
      loadVideosForUnit();
    } else {
      toast('❌ ' + (res?.error || 'فشل حفظ الفيديو'));
    }
  } catch (e) {
    toast('❌ فشل رفع الفيديو');
  } finally {
    progressWrap.style.display = 'none';
    fill.style.width = '0%';
    pct.textContent = '0%';
    btn.disabled = false;
  }
}

async function addVideoByLink() {
  const title = document.getElementById('video-title')?.value.trim();
  const link = document.getElementById('video-link')?.value.trim();
  if (!currentVideosUnitId) return;
  if (!title) { toast('❌ اكتب عنوان الفيديو'); return; }
  if (!link) { toast('❌ الصق رابط الفيديو'); return; }
  try {
    const res = await api('/videos', {
      method: 'POST',
      body: JSON.stringify({ unitId: currentVideosUnitId, title, driveUrl: link })
    });
    if (res && res.ok) {
      toast('✅ تم إضافة الفيديو');
      document.getElementById('video-title').value = '';
      document.getElementById('video-link').value = '';
      loadVideosForUnit();
    } else {
      toast('❌ ' + (res?.error || 'فشل إضافة الفيديو'));
    }
  } catch (e) {}
}

async function deleteVideo(id) {
  if (!confirm('متأكد إنك عايز تحذف الفيديو ده؟')) return;
  try {
    const res = await api('/videos/' + id, { method: 'DELETE' });
    if (res && res.ok) { toast('✅ تم حذف الفيديو'); loadVideosForUnit(); }
  } catch (e) {}
}

// Codes
async function loadCodesPage() {
  loadCodesList();
}

async function loadCodesList() {
  try {
    const res = await api('/codes');
    const codes = res && res.data ? res.data : [];
    const tbody = document.getElementById('codes-table');
    if (!tbody) return;
    if (!codes.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">لا توجد أكواد</td></tr>';
      return;
    }
    tbody.innerHTML = codes.map(c => `
      <tr>
        <td style="font-family:monospace; font-weight:600; color:var(--accent-light);">${c.code}</td>
        <td>${c.unitId ? 'كورس محدد' : 'كل الكورسات'}</td>
        <td><span class="badge ${c.status === 'active' ? 'badge-ok' : 'badge-info'}">${c.status === 'active' ? '✓ مستخدم' : 'متاح'}</span></td>
        <td>${escapeHtmlAdmin(c.studentName || '—')}</td>
        <td>${c.activationDate ? new Date(c.activationDate).toLocaleDateString('ar-EG') : '—'}</td>
        <td><button class="btn btn-secondary" style="padding:4px 10px; font-size:0.8rem;" onclick="showQrCode('${c.code}')">📱 QR</button> <button class="btn btn-danger" style="padding:4px 10px; font-size:0.8rem;" onclick="deleteCode('${c.id}')">🗑 حذف</button></td>
      </tr>
    `).join('');
  } catch (e) {}
}

async function generateCodes() {
  const count = document.getElementById('code-count')?.value;
  const prefix = document.getElementById('code-prefix')?.value.trim();
  toast('⏳ جاري توليد الأكواد...');
  try {
    const res = await api('/codes/generate', {
      method: 'POST',
      body: JSON.stringify({ count: parseInt(count) || 10, prefix: prefix || undefined })
    });
    if (res && res.ok) {
      toast('✅ تم توليد الأكواد');
      loadCodesList();
    } else {
      toast('❌ ' + (res?.error || 'فشل توليد الأكواد'));
    }
  } catch (e) {}
}

async function deleteCode(id) {
  if (!confirm('متأكد إنك عايز تحذف الكود ده؟')) return;
  try {
    const res = await api('/codes/' + id, { method: 'DELETE' });
    if (res && res.ok) {
      toast('✅ تم حذف الكود');
      loadCodesList();
    } else {
      toast('❌ ' + (res?.error || 'فشل حذف الكود'));
    }
  } catch (e) {}
}

function showQrCode(code) {
  const modal = document.getElementById('qr-modal');
  const canvas = document.getElementById('qr-canvas');
  const label = document.getElementById('qr-modal-code');
  if (!modal || !canvas || typeof QRCode === 'undefined') { toast('❌ مكتبة QR مش متاحة'); return; }
  label.textContent = code;
  const link = STUDENT_SITE_URL + '/login.html?code=' + encodeURIComponent(code);
  QRCode.toCanvas(canvas, link, { width: 220, margin: 2 }, (err) => { if (err) toast('❌ فشل توليد QR'); });
  modal.style.display = 'flex';
}
function closeQrModal() {
  const modal = document.getElementById('qr-modal');
  if (modal) modal.style.display = 'none';
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
      <td style="font-weight:600;">${escapeHtmlAdmin(s.name)}</td>
      <td style="font-family:monospace; color:var(--text-muted);">${escapeHtmlAdmin(s.code)}</td>
      <td>${escapeHtmlAdmin(s.courseTitle || '—')}</td>
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
    if (d.student.code && typeof QRCode !== 'undefined') {
      const canvas = document.getElementById('detail-qr-canvas');
      const link = STUDENT_SITE_URL + '/login.html?code=' + encodeURIComponent(d.student.code);
      QRCode.toCanvas(canvas, link, { width: 90, margin: 1 }, () => {});
    }
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
            <div style="color:var(--text-muted); font-size:0.8rem; margin-bottom:4px;">على فيديو: ${escapeHtmlAdmin(c.videoTitle)}</div>
            <div>${escapeHtmlAdmin(c.text)}</div>
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
    formData.append('restrictDownload', 'true');
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
        driveUrl: uploadData.data.previewUrl || uploadData.data.driveUrl
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
              <div style="font-weight:600;">${escapeHtmlAdmin(t.studentName)}</div>
              <div style="color:var(--text-muted); font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtmlAdmin(t.lastMessage || '')}</div>
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
                ${escapeHtmlAdmin(m.text)}
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
let currentManageExamId = null;

async function loadExamsPage() {
  // Course dropdown + exam dropdown are independent reads — fire them
  // together instead of waiting on one before starting the other.
  const [unitsRes, examsRes] = await Promise.allSettled([
    api('/units'),
    api('/exams/admin/all')
  ]);

  if (unitsRes.status === 'fulfilled') {
    const units = (unitsRes.value && unitsRes.value.data) || [];
    const courseSelect = document.getElementById('manage-course-select');
    if (courseSelect) {
      courseSelect.innerHTML = '<option value="">اختر الكورس</option>' +
        units.map(u => `<option value="${u.id}">${u.title}</option>`).join('');
    }
  }

  if (examsRes.status === 'fulfilled') {
    const exams = (examsRes.value && examsRes.value.data) || [];
    const select = document.getElementById('exam-select');
    if (select) {
      select.innerHTML = '<option value="">جميع الامتحانات</option>' +
        exams.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
    }
  }

  loadExamResults();
}

async function loadUnitExams() {
  const unitId = document.getElementById('manage-course-select')?.value;
  const wrap = document.getElementById('unit-exams-list');
  const addBtn = document.getElementById('add-exam-btn');
  closeAddExamForm();
  closeQuestionsPanel();
  if (!unitId) { wrap.style.display = 'none'; addBtn.style.display = 'none'; return; }
  addBtn.style.display = 'inline-block';
  wrap.style.display = 'block';
  wrap.innerHTML = '⏳ جاري التحميل...';
  try {
    const res = await api('/exams/unit/' + unitId);
    const exams = res && res.data ? res.data : [];
    if (!exams.length) {
      wrap.innerHTML = '<p style="color:var(--text-muted);">مفيش امتحانات في الكورس ده لسه.</p>';
      return;
    }
    wrap.innerHTML = exams.map(e => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border:1px solid var(--border); border-radius:var(--radius-md); margin-bottom:8px; flex-wrap:wrap; gap:8px;">
        <div>
          <span class="badge ${e.status === 'published' ? 'badge-ok' : 'badge-warn'}">${e.status === 'published' ? '✓ منشور' : (e.status === 'hidden' ? 'مخفي' : 'مسودة')}</span>
          ${String(e.resultsPublished) === 'true' ? '<span class="badge badge-ok">🏆 النتائج ظاهرة</span>' : '<span class="badge badge-info">⏳ النتائج مخفية</span>'}
          <strong style="margin-right:8px;">${escapeHtmlAdmin(e.title)}</strong>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="openQuestionsPanel('${e.id}', '${escapeHtmlAdmin(e.title)}')">❓ الأسئلة</button>
          ${e.status === 'published'
            ? `<button class="btn btn-secondary btn-sm" onclick="hideExam('${e.id}')">🙈 إخفاء</button>`
            : `<button class="btn btn-primary btn-sm" onclick="publishExam('${e.id}')">🚀 نشر</button>`}
          ${String(e.resultsPublished) !== 'true'
            ? `<button class="btn btn-primary btn-sm" onclick="publishExamResults('${e.id}')">✅ اعتماد وإظهار النتائج</button>`
            : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteExam('${e.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

function openAddExamForm() { document.getElementById('exam-form-wrap').style.display = 'block'; }
function closeAddExamForm() {
  const wrap = document.getElementById('exam-form-wrap');
  if (wrap) wrap.style.display = 'none';
  ['exam-title'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

async function saveExam() {
  const unitId = document.getElementById('manage-course-select')?.value;
  const title = document.getElementById('exam-title')?.value.trim();
  if (!unitId) { toast('❌ اختر الكورس الأول'); return; }
  if (!title) { toast('❌ اكتب عنوان الامتحان'); return; }
  try {
    const res = await api('/exams', {
      method: 'POST',
      body: JSON.stringify({
        unitId, title,
        timerMinutes: parseInt(document.getElementById('exam-timer')?.value) || 0,
        maxAttempts: parseInt(document.getElementById('exam-attempts')?.value) || 1,
        passingScore: parseInt(document.getElementById('exam-passing')?.value) || 50,
        shuffleQuestions: document.getElementById('exam-shuffle')?.checked || false,
        negativeMarking: document.getElementById('exam-negative')?.checked || false
      })
    });
    if (res && res.ok) {
      toast('✅ تم إضافة الامتحان (مسودة — دوس نشر عشان يظهر للطلاب)');
      closeAddExamForm();
      loadUnitExams();
    } else {
      toast('❌ ' + (res?.error || 'فشل إضافة الامتحان'));
    }
  } catch (e) {}
}

async function publishExam(id) {
  try { const res = await api('/exams/' + id + '/publish', { method: 'POST' }); if (res?.ok) { toast('✅ الامتحان بقى منشور'); loadUnitExams(); } } catch (e) {}
}
async function hideExam(id) {
  try { const res = await api('/exams/' + id + '/hide', { method: 'POST' }); if (res?.ok) { toast('✅ تم إخفاء الامتحان'); loadUnitExams(); } } catch (e) {}
}
async function publishExamResults(id) {
  if (!confirm('هيتم حساب الترتيب واعتماد النتائج، وهتظهر للطلاب فورًا. متأكد؟')) return;
  try {
    const res = await api('/attempts/exam/' + id + '/publish-results', { method: 'POST' });
    if (res?.ok) { toast('✅ اتعمد النتائج وبقت ظاهرة للطلاب'); loadUnitExams(); loadExamResults(); }
    else toast('❌ ' + (res?.error || 'فشل اعتماد النتائج'));
  } catch (e) {}
}
async function deleteExam(id) {
  if (!confirm('حذف الامتحان هيمسح كل أسئلته كمان. متأكد؟')) return;
  try { const res = await api('/exams/' + id, { method: 'DELETE' }); if (res?.ok) { toast('✅ تم حذف الامتحان'); loadUnitExams(); } } catch (e) {}
}

// ----- Questions -----
function openQuestionsPanel(examId, examTitle) {
  currentManageExamId = examId;
  document.getElementById('questions-wrap').style.display = 'block';
  document.getElementById('questions-exam-title').textContent = examTitle;
  renderQuestionFields();
  loadQuestions();
  document.getElementById('questions-wrap').scrollIntoView({ behavior: 'smooth' });
}
function closeQuestionsPanel() {
  currentManageExamId = null;
  const wrap = document.getElementById('questions-wrap');
  if (wrap) wrap.style.display = 'none';
}

async function loadQuestions() {
  if (!currentManageExamId) return;
  const list = document.getElementById('questions-list');
  list.innerHTML = '⏳ جاري التحميل...';
  try {
    const res = await api('/questions/exam/' + currentManageExamId);
    const questions = res && res.data ? res.data : [];
    if (!questions.length) {
      list.innerHTML = '<p style="color:var(--text-muted);">مفيش أسئلة لسه — ضيف أول سؤال تحت.</p>';
      return;
    }
    const typeLabels = { mcq: 'اختيار من متعدد', truefalse: 'صح/غلط', multi: 'اختيار متعدد', fillblank: 'ملء فراغ', essay: 'مقالي', image: 'صورة', listening: 'استماع 🎧' };
    list.innerHTML = questions.map((q, i) => `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:12px 16px; border:1px solid var(--border); border-radius:var(--radius-md); margin-bottom:8px;">
        <div>
          <span class="badge badge-info">${typeLabels[q.type] || q.type}</span>
          <span style="margin-right:8px; font-weight:600;">${i + 1}. ${escapeHtmlAdmin(q.text)}</span>
          <div style="color:var(--text-muted); font-size:0.8rem; margin-top:4px;">${q.points || 1} درجة</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteQuestion('${q.id}')">🗑</button>
      </div>
    `).join('');
  } catch (e) {}
}

// In-memory state for the option-rows editor (click the correct answer
// instead of retyping it). Reset whenever the question type changes.
let qOptionsState = [{ text: '', correct: true }, { text: '', correct: false }];
let qFillAnswersState = [''];

function renderQuestionFields() {
  const type = document.getElementById('q-type')?.value;
  const wrap = document.getElementById('q-dynamic-fields');
  if (!wrap) return;
  if (type === 'mcq' || type === 'multi' || type === 'listening') {
    if (type !== 'multi') {
      // single-answer types: only one row may be marked correct
      const firstCorrectIdx = qOptionsState.findIndex((o) => o.correct);
      qOptionsState = qOptionsState.map((o, i) => ({ ...o, correct: i === (firstCorrectIdx === -1 ? 0 : firstCorrectIdx) }));
    }
    wrap.innerHTML = `
      ${type === 'listening' ? `
        <div class="form-group">
          <label>رابط الصوت (Audio URL)</label>
          <input type="text" class="inp" id="q-audio-url" placeholder="https://...">
        </div>` : ''}
      <div class="form-group">
        <label>الاختيارات — دوس على ${type === 'multi' ? 'المربعات' : 'الدائرة'} بجانب الإجابة الصح</label>
        <div id="q-options-rows"></div>
        <button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="addOptionRow()">+ إضافة اختيار</button>
      </div>`;
    renderOptionRows_(type);
  } else if (type === 'truefalse') {
    wrap.innerHTML = `
      <div class="form-group">
        <label>الإجابة الصحيحة</label>
        <select class="inp" id="q-correct-tf" style="max-width:200px;">
          <option value="true">صح</option>
          <option value="false">غلط</option>
        </select>
      </div>`;
  } else if (type === 'fillblank') {
    wrap.innerHTML = `
      <div class="form-group">
        <label>الإجابات الصحيحة المقبولة (ممكن أكتر من إجابة)</label>
        <div id="q-fill-rows"></div>
        <button type="button" class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="addFillAnswerRow()">+ إضافة إجابة مقبولة</button>
      </div>`;
    renderFillRows_();
  } else {
    wrap.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">السؤال المقالي بيتصحح يدوي — مفيش إجابة نموذجية تتحط هنا.</p>';
  }
}

function renderOptionRows_(type) {
  const rows = document.getElementById('q-options-rows');
  if (!rows) return;
  const inputType = type === 'multi' ? 'checkbox' : 'radio';
  rows.innerHTML = qOptionsState.map((opt, i) => `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
      <input type="${inputType}" ${type === 'multi' ? 'name="q-opt-correct-multi"' : 'name="q-opt-correct"'} ${opt.correct ? 'checked' : ''} onchange="setOptionCorrect(${i}, this.checked)" title="إجابة صحيحة">
      <input type="text" class="inp" style="flex:1;" value="${escapeHtmlAdmin(opt.text)}" placeholder="اختيار ${i + 1}" oninput="setOptionText(${i}, this.value)">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeOptionRow(${i})" ${qOptionsState.length <= 2 ? 'disabled' : ''}>🗑</button>
    </div>`).join('');
}

function addOptionRow() {
  qOptionsState.push({ text: '', correct: false });
  renderOptionRows_(document.getElementById('q-type')?.value);
}
function removeOptionRow(i) {
  if (qOptionsState.length <= 2) return;
  const wasCorrect = qOptionsState[i].correct;
  qOptionsState.splice(i, 1);
  if (wasCorrect && !qOptionsState.some((o) => o.correct)) qOptionsState[0].correct = true;
  renderOptionRows_(document.getElementById('q-type')?.value);
}
function setOptionText(i, value) { if (qOptionsState[i]) qOptionsState[i].text = value; }
function setOptionCorrect(i, checked) {
  const type = document.getElementById('q-type')?.value;
  if (type === 'multi') {
    qOptionsState[i].correct = checked;
  } else {
    qOptionsState = qOptionsState.map((o, idx) => ({ ...o, correct: idx === i }));
    renderOptionRows_(type);
  }
}

function renderFillRows_() {
  const rows = document.getElementById('q-fill-rows');
  if (!rows) return;
  rows.innerHTML = qFillAnswersState.map((val, i) => `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
      <input type="text" class="inp" style="flex:1;" value="${escapeHtmlAdmin(val)}" placeholder="إجابة مقبولة ${i + 1}" oninput="setFillAnswer(${i}, this.value)">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeFillAnswerRow(${i})" ${qFillAnswersState.length <= 1 ? 'disabled' : ''}>🗑</button>
    </div>`).join('');
}
function addFillAnswerRow() { qFillAnswersState.push(''); renderFillRows_(); }
function removeFillAnswerRow(i) {
  if (qFillAnswersState.length <= 1) return;
  qFillAnswersState.splice(i, 1);
  renderFillRows_();
}
function setFillAnswer(i, value) { qFillAnswersState[i] = value; }

async function addQuestion() {
  if (!currentManageExamId) return;
  const type = document.getElementById('q-type')?.value;
  const text = document.getElementById('q-text')?.value.trim();
  const points = parseFloat(document.getElementById('q-points')?.value) || 1;
  if (!text) { toast('❌ اكتب نص السؤال'); return; }

  let options, correctAnswer, audioUrl;
  if (type === 'mcq' || type === 'multi' || type === 'listening') {
    const cleaned = qOptionsState.map((o) => ({ text: o.text.trim(), correct: o.correct })).filter((o) => o.text);
    if (cleaned.length < 2) { toast('❌ اكتب اختيارين على الأقل'); return; }
    const correctOnes = cleaned.filter((o) => o.correct).map((o) => o.text);
    if (!correctOnes.length) { toast('❌ حدد الإجابة الصحيحة'); return; }
    options = cleaned.map((o) => o.text);
    correctAnswer = type === 'multi' ? correctOnes : correctOnes[0];
    if (type === 'listening') {
      audioUrl = document.getElementById('q-audio-url')?.value.trim();
      if (!audioUrl) { toast('❌ حط رابط الصوت'); return; }
    }
  } else if (type === 'truefalse') {
    correctAnswer = document.getElementById('q-correct-tf')?.value === 'true';
  } else if (type === 'fillblank') {
    const answers = qFillAnswersState.map((a) => a.trim()).filter(Boolean);
    if (!answers.length) { toast('❌ اكتب إجابة صحيحة واحدة على الأقل'); return; }
    correctAnswer = answers.length === 1 ? answers[0] : answers;
  }

  try {
    const res = await api('/questions', {
      method: 'POST',
      body: JSON.stringify({ examId: currentManageExamId, type, text, options, correctAnswer, audioUrl, points })
    });
    if (res && res.ok) {
      toast('✅ تم إضافة السؤال');
      document.getElementById('q-text').value = '';
      qOptionsState = [{ text: '', correct: true }, { text: '', correct: false }];
      qFillAnswersState = [''];
      renderQuestionFields();
      loadQuestions();
    } else {
      toast('❌ ' + (res?.error || 'فشل إضافة السؤال'));
    }
  } catch (e) {}
}

async function deleteQuestion(id) {
  if (!confirm('متأكد إنك عايز تحذف السؤال ده؟')) return;
  try {
    const res = await api('/questions/' + id, { method: 'DELETE' });
    if (res && res.ok) { toast('✅ تم حذف السؤال'); loadQuestions(); }
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
            <div style="font-weight:600;">${escapeHtmlAdmin(s.name)}</div>
            <div style="color:var(--text-muted); font-size:0.85rem;">${escapeHtmlAdmin(s.time || '')}</div>
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
            <td style="font-weight:600;">${escapeHtmlAdmin(r.name)}</td>
            <td style="color:${r.score >= 50 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${r.score}%</td>
            <td style="color:var(--text-muted);">${r.time || '—'}</td>
            <td style="color:var(--text-muted); font-size:0.85rem;">${r.date || '—'}</td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {}
}

async function changeAdminPassword() {
  const currentPassword = document.getElementById('current-password')?.value;
  const newPassword = document.getElementById('new-password')?.value;
  const confirmPassword = document.getElementById('confirm-password')?.value;
  if (!currentPassword || !newPassword) { toast('❌ املا كل الحقول'); return; }
  if (newPassword.length < 8) { toast('❌ كلمة المرور الجديدة لازم تكون 8 حروف على الأقل'); return; }
  if (newPassword !== confirmPassword) { toast('❌ كلمة المرور الجديدة مش متطابقة مع التأكيد'); return; }
  try {
    const res = await api('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    if (res && res.ok) {
      toast('✅ تم تغيير كلمة المرور — سجل دخول تاني بيها');
      ['current-password', 'new-password', 'confirm-password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    } else {
      toast('❌ ' + (res?.error || 'فشل تغيير كلمة المرور'));
    }
  } catch (e) {}
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  requireAuth();
  const path = location.pathname;
  if (path.includes('login.html')) return;
  if (path.includes('index.html')) loadAdminDashboard();
  if (path.includes('units.html')) loadUnitsPage();
  if (path.includes('codes.html')) loadCodesPage();
  if (path.includes('students.html')) loadStudentsPage();
  if (path.includes('exams.html')) loadExamsPage();
  if (path.includes('student-detail.html')) loadStudentDetailPage();
  if (path.includes('presentations.html')) loadPresentationsPage();
  if (path.includes('chat.html')) loadChatPage();
});

// When the browser restores a page from its back/forward cache (e.g. the
// user hits the back button), it shows the old DOM as-is without re-running
// any of the code above — including the login check. That's what made an
// expired/logged-out session look like it was still showing "the old page".
// Forcing a fresh load re-runs requireAuth() and re-fetches real data.
window.addEventListener('pageshow', (e) => {
  if (e.persisted) location.reload();
});
