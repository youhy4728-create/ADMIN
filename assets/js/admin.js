/* =========================================================
   Mamdouh Fakhry Platform — Admin Dashboard App
   ========================================================= */

const NAV = [
  { key: 'dashboard', label: 'الرئيسية', icon: '🏠' },
  { key: 'units', label: 'الكورسات (Units)', icon: '📚' },
  { key: 'students', label: 'الطلاب', icon: '👥' },
  { key: 'codes', label: 'أكواد الدخول', icon: '🔑' },
  { key: 'analytics', label: 'الإحصائيات والتقارير', icon: '📊' },
  { key: 'settings', label: 'الإعدادات', icon: '⚙️' }
];

const state = { route: parseHash(), unitsCache: [] };

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  return { name: parts[0] || 'dashboard', params: parts.slice(1) };
}
window.addEventListener('hashchange', () => { state.route = parseHash(); renderPage(); });

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function loading(target) { target.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`; }

// ---------- Theme ----------
function initTheme() {
  const saved = localStorage.getItem('mfx_admin_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mfx_admin_theme', next);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

// ---------- Modal helper ----------
function openModal(title, bodyHtml, { onMount } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal-box"><h3>${title}</h3>${bodyHtml}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  if (onMount) onMount(wrap);
  return wrap;
}
function closeModals() { document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove()); }
function confirmAction(msg, onConfirm) {
  openModal('تأكيد الحذف', `
    <p style="color:var(--text-muted)">${escapeHtml(msg)}</p>
    <div class="modal-actions">
      <button class="btn danger" id="confirmYes">نعم، احذف</button>
      <button class="btn secondary" id="confirmNo">إلغاء</button>
    </div>`, {
    onMount: (wrap) => {
      wrap.querySelector('#confirmYes').addEventListener('click', async () => { wrap.remove(); await onConfirm(); });
      wrap.querySelector('#confirmNo').addEventListener('click', () => wrap.remove());
    }
  });
}

// ---------- Login ----------
function renderLoginScreen() {
  document.getElementById('shell').style.display = 'none';
  const el = document.getElementById('loginScreen');
  el.innerHTML = `
    <div class="admin-login-wrap">
      <div class="admin-login-card">
        <div class="icon-badge">🎓</div>
        <h2>لوحة تحكم المدرّس</h2>
        <p>سجّل الدخول لإدارة المنصة</p>
        <div id="loginError"></div>
        <form id="loginForm">
          <div class="field"><label>اسم المستخدم</label><input type="text" id="username" required autofocus></div>
          <div class="field"><label>كلمة المرور</label><input type="password" id="password" required></div>
          <button type="submit" class="btn primary" style="width:100%;justify-content:center" id="loginBtn">دخول</button>
        </form>
      </div>
    </div>`;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'جاري الدخول...';
    try {
      const data = await api.post('/auth/admin/login', {
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value
      });
      AdminAuth.setSession(data);
      boot();
    } catch (err) {
      document.getElementById('loginError').innerHTML = `<div class="error-msg" style="background:rgba(239,68,68,.1);color:var(--danger);border-radius:12px;padding:10px 14px;font-size:13px;margin-bottom:14px;font-weight:600">${escapeHtml(err.message)}</div>`;
      btn.disabled = false; btn.textContent = 'دخول';
    }
  });
}

// ---------- Shell ----------
function renderShell() {
  document.getElementById('loginScreen').innerHTML = '';
  document.getElementById('shell').style.display = 'flex';
  const user = AdminAuth.getUser();
  document.getElementById('sidebar').innerHTML = `
    <div class="brand"><div class="dot"></div><span>لوحة التحكم</span></div>
    <div id="navList"></div>
    <div class="sidebar-footer">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">👤 ${escapeHtml(user?.name || user?.username || '')}</div>
      <div style="display:flex;gap:8px">
        <button class="btn ghost" id="themeToggleBtn" title="الوضع الليلي">🌙</button>
        <button class="btn secondary sm" id="logoutBtn" style="flex:1">خروج</button>
      </div>
    </div>`;
  document.getElementById('navList').innerHTML = NAV.map((n) => `
    <a class="nav-item" href="#/${n.key}" data-key="${n.key}"><span class="ic">${n.icon}</span><span>${n.label}</span></a>
  `).join('');
  document.getElementById('logoutBtn').addEventListener('click', () => { AdminAuth.clear(); renderLoginScreen(); });
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
  const t = document.documentElement.getAttribute('data-theme');
  document.getElementById('themeToggleBtn').textContent = t === 'dark' ? '☀️' : '🌙';
}

function highlightNav() {
  document.querySelectorAll('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.key === state.route.name));
}

// ---------- Router ----------
const app = document.getElementById('app');
async function renderPage() {
  highlightNav();
  const { name, params } = state.route;
  if (name === 'dashboard') return renderDashboard();
  if (name === 'units') return renderUnits();
  if (name === 'unit') return renderUnitWorkspace(params[0], params[1] || 'videos');
  if (name === 'exam-questions') return renderExamQuestions(params[0]);
  if (name === 'students') return renderStudents();
  if (name === 'codes') return renderCodes();
  if (name === 'analytics') return renderAnalytics();
  if (name === 'settings') return renderSettings();
  return renderDashboard();
}

// ---------- Dashboard ----------
async function renderDashboard() {
  loading(app);
  let s; try { s = await api.get('/analytics/overview'); } catch (e) { toast(e.message, 'error'); return; }
  const cards = [
    ['👥', s.totalStudents, 'إجمالي الطلاب'],
    ['📚', s.totalUnits, 'إجمالي الوحدات'],
    ['✅', s.publishedUnits, 'وحدات منشورة'],
    ['🎬', s.totalVideos, 'إجمالي الفيديوهات'],
    ['📘', s.totalBooks, 'إجمالي الكتب'],
    ['📝', s.totalExams, 'إجمالي الامتحانات'],
    ['🧾', s.totalAttempts, 'محاولات الامتحانات'],
    ['🔑', s.activeCodes, 'أكواد مفعّلة'],
    ['📦', s.unusedCodes, 'أكواد غير مستخدمة']
  ];
  app.innerHTML = `
    <div class="topbar-row"><div><h1 class="page-title">لوحة التحكم</h1><p class="page-sub">نظرة عامة على أداء المنصة</p></div></div>
    <div class="stats-grid">${cards.map(([ic, val, lbl]) => `
      <div class="stat-card"><div class="ic">${ic}</div><div class="val">${val}</div><div class="lbl">${lbl}</div></div>
    `).join('')}</div>
    <div class="panel">
      <h3>روابط سريعة</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <a href="#/units"><button class="btn primary">+ إضافة كورس جديد</button></a>
        <a href="#/codes"><button class="btn secondary">🔑 توليد أكواد</button></a>
        <a href="#/students"><button class="btn secondary">👥 إدارة الطلاب</button></a>
        <a href="#/analytics"><button class="btn secondary">📊 عرض التقارير</button></a>
      </div>
    </div>`;
}

// ---------- Units (Courses) ----------
async function renderUnits() {
  loading(app);
  let units = []; try { units = await api.get('/units'); } catch (e) { toast(e.message, 'error'); return; }
  units.sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0));
  state.unitsCache = units;

  app.innerHTML = `
    <div class="topbar-row">
      <div><h1 class="page-title">الكورسات (Units)</h1><p class="page-sub">إدارة الوحدات التعليمية</p></div>
      <button class="btn primary" id="addUnitBtn">+ إضافة وحدة</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>العنوان</th><th>الوصف</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          ${units.length ? units.map((u) => `
            <tr>
              <td><a href="#/unit/${u.id}/videos" style="font-weight:800;color:var(--primary)">${escapeHtml(u.title)}</a></td>
              <td style="max-width:340px;color:var(--text-muted)">${escapeHtml((u.description || '').slice(0, 70))}</td>
              <td><span class="status-pill ${u.status}">${u.status === 'published' ? 'منشورة' : u.status === 'draft' ? 'مسودة' : 'مخفية'}</span></td>
              <td>
                <div class="row-actions">
                  <button class="btn sm secondary" onclick="location.hash='#/unit/${u.id}/videos'">فتح</button>
                  ${u.status === 'published'
                    ? `<button class="btn sm secondary" onclick="unitAction('${u.id}','hide')">إخفاء</button>`
                    : `<button class="btn sm secondary" onclick="unitAction('${u.id}','publish')">نشر</button>`}
                  <button class="btn sm secondary" onclick="unitAction('${u.id}','duplicate')">نسخ</button>
                  <button class="btn sm secondary" onclick="editUnit('${u.id}')">تعديل</button>
                  <button class="btn sm danger" onclick="deleteUnit('${u.id}')">حذف</button>
                </div>
              </td>
            </tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="em">📚</div>لا توجد وحدات بعد</div></td></tr>`}
        </tbody>
      </table>
    </div>`;

  document.getElementById('addUnitBtn').addEventListener('click', () => unitFormModal());
}

function unitFormModal(unit = null) {
  openModal(unit ? 'تعديل الوحدة' : 'إضافة وحدة جديدة', `
    <form id="unitForm">
      <div class="field"><label>العنوان</label><input type="text" id="f_title" value="${unit ? escapeHtml(unit.title) : ''}" required></div>
      <div class="field"><label>الوصف</label><textarea id="f_desc" rows="3">${unit ? escapeHtml(unit.description || '') : ''}</textarea></div>
      <div class="field"><label>الترتيب</label><input type="number" id="f_order" value="${unit ? unit.order || 0 : 0}"></div>
      <div class="modal-actions">
        <button type="submit" class="btn primary">حفظ</button>
        <button type="button" class="btn secondary" onclick="closeModals()">إلغاء</button>
      </div>
    </form>`, {
    onMount: (wrap) => wrap.querySelector('#unitForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('f_title').value.trim(),
        description: document.getElementById('f_desc').value.trim(),
        order: parseFloat(document.getElementById('f_order').value) || 0
      };
      try {
        if (unit) await api.patch(`/units/${unit.id}`, payload);
        else await api.post('/units', payload);
        closeModals(); toast('تم الحفظ ✅'); renderUnits();
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}
async function editUnit(id) {
  const unit = state.unitsCache.find((u) => u.id === id) || await api.get(`/units/${id}`);
  unitFormModal(unit);
}
async function unitAction(id, action) {
  try { await api.post(`/units/${id}/${action}`); toast('تم ✅'); renderUnits(); } catch (e) { toast(e.message, 'error'); }
}
function deleteUnit(id) {
  confirmAction('سيتم حذف الوحدة وكل محتواها المرتبط بها. هل أنت متأكد؟', async () => {
    try { await api.del(`/units/${id}`); toast('تم الحذف'); renderUnits(); } catch (e) { toast(e.message, 'error'); }
  });
}

// ---------- Unit workspace (videos / books / exams) ----------
async function renderUnitWorkspace(unitId, tab) {
  loading(app);
  let unit; try { unit = await api.get(`/units/${unitId}`); } catch (e) { toast(e.message, 'error'); return; }

  app.innerHTML = `
    <a href="#/units" style="display:inline-flex;gap:6px;color:var(--text-muted);font-weight:700;font-size:13px;margin-bottom:14px">→ رجوع للكورسات</a>
    <div class="topbar-row"><div><h1 class="page-title">${escapeHtml(unit.title)}</h1><p class="page-sub">إدارة محتوى الوحدة</p></div></div>
    <div class="tabs">
      <a class="tab ${tab === 'videos' ? 'active' : ''}" href="#/unit/${unitId}/videos">🎬 الفيديوهات</a>
      <a class="tab ${tab === 'books' ? 'active' : ''}" href="#/unit/${unitId}/books">📘 الكتب</a>
      <a class="tab ${tab === 'exams' ? 'active' : ''}" href="#/unit/${unitId}/exams">📝 الامتحانات</a>
    </div>
    <div id="workspaceBody"></div>`;

  const body = document.getElementById('workspaceBody');
  if (tab === 'videos') return renderVideosTab(body, unitId);
  if (tab === 'books') return renderBooksTab(body, unitId);
  if (tab === 'exams') return renderExamsTab(body, unitId);
}

// -- Videos tab --
async function renderVideosTab(body, unitId) {
  loading(body);
  let videos = []; try { videos = await api.get(`/videos/unit/${unitId}`); } catch (e) { toast(e.message, 'error'); }
  body.innerHTML = `
    <div style="text-align:left;margin-bottom:14px"><button class="btn primary sm" id="addVideoBtn">+ إضافة فيديو</button></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>العنوان</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${videos.length ? videos.map((v) => `
        <tr><td>${escapeHtml(v.title)}</td>
          <td><span class="status-pill ${v.status}">${v.status === 'published' ? 'منشور' : 'مسودة'}</span></td>
          <td><div class="row-actions">
            <button class="btn sm secondary" onclick="videoFormModal('${unitId}', ${JSON.stringify(v).replace(/"/g, '&quot;')})">تعديل</button>
            <button class="btn sm danger" onclick="deleteVideo('${v.id}','${unitId}')">حذف</button>
          </div></td></tr>`).join('') : `<tr><td colspan="3"><div class="empty-state"><div class="em">🎬</div>لا توجد فيديوهات بعد</div></td></tr>`}
      </tbody></table></div>`;
  document.getElementById('addVideoBtn').addEventListener('click', () => videoFormModal(unitId));
}
function videoFormModal(unitId, video = null) {
  openModal(video ? 'تعديل الفيديو' : 'إضافة فيديو', `
    <form id="vForm">
      <div class="field"><label>العنوان</label><input id="v_title" value="${video ? escapeHtml(video.title) : ''}" required></div>
      <div class="field"><label>رابط Google Drive</label><input id="v_url" value="${video ? escapeHtml(video.driveUrl) : ''}" placeholder="https://drive.google.com/file/d/..." required></div>
      <div class="field-row">
        <div class="field"><label>الترتيب</label><input type="number" id="v_order" value="${video ? video.order || 0 : 0}"></div>
        <div class="field"><label>المدة (ثانية)</label><input type="number" id="v_dur" value="${video ? video.durationSeconds || 0 : 0}"></div>
      </div>
      <div class="modal-actions"><button class="btn primary">حفظ</button><button type="button" class="btn secondary" onclick="closeModals()">إلغاء</button></div>
    </form>`, {
    onMount: (wrap) => wrap.querySelector('#vForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = { unitId, title: document.getElementById('v_title').value.trim(), driveUrl: document.getElementById('v_url').value.trim(), order: parseFloat(document.getElementById('v_order').value) || 0, durationSeconds: parseFloat(document.getElementById('v_dur').value) || 0 };
      try {
        if (video) await api.patch(`/videos/${video.id}`, payload); else await api.post('/videos', payload);
        closeModals(); toast('تم الحفظ ✅'); renderUnitWorkspace(unitId, 'videos');
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}
function deleteVideo(id, unitId) {
  confirmAction('هل تريد حذف هذا الفيديو؟', async () => {
    try { await api.del(`/videos/${id}`); toast('تم الحذف'); renderUnitWorkspace(unitId, 'videos'); } catch (e) { toast(e.message, 'error'); }
  });
}

// -- Books tab --
async function renderBooksTab(body, unitId) {
  loading(body);
  let books = []; try { books = await api.get(`/books/unit/${unitId}`); } catch (e) { toast(e.message, 'error'); }
  body.innerHTML = `
    <div style="text-align:left;margin-bottom:14px"><button class="btn primary sm" id="addBookBtn">+ إضافة كتاب</button></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>العنوان</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${books.length ? books.map((b) => `
        <tr><td>${escapeHtml(b.title)}</td>
          <td><span class="status-pill ${b.status}">${b.status === 'published' ? 'منشور' : 'مسودة'}</span></td>
          <td><div class="row-actions">
            <button class="btn sm secondary" onclick="bookFormModal('${unitId}', ${JSON.stringify(b).replace(/"/g, '&quot;')})">تعديل</button>
            <button class="btn sm danger" onclick="deleteBook('${b.id}','${unitId}')">حذف</button>
          </div></td></tr>`).join('') : `<tr><td colspan="3"><div class="empty-state"><div class="em">📘</div>لا توجد كتب بعد</div></td></tr>`}
      </tbody></table></div>`;
  document.getElementById('addBookBtn').addEventListener('click', () => bookFormModal(unitId));
}
function bookFormModal(unitId, book = null) {
  openModal(book ? 'تعديل الكتاب' : 'إضافة كتاب', `
    <form id="bForm">
      <div class="field"><label>العنوان</label><input id="b_title" value="${book ? escapeHtml(book.title) : ''}" required></div>
      <div class="field"><label>رابط Google Drive (PDF)</label><input id="b_url" value="${book ? escapeHtml(book.driveUrl) : ''}" placeholder="https://drive.google.com/file/d/..." required></div>
      <div class="field-row">
        <div class="field"><label>الترتيب</label><input type="number" id="b_order" value="${book ? book.order || 0 : 0}"></div>
        <div class="field"><label>عدد الصفحات</label><input type="number" id="b_pages" value="${book ? book.pageCount || 0 : 0}"></div>
      </div>
      <div class="modal-actions"><button class="btn primary">حفظ</button><button type="button" class="btn secondary" onclick="closeModals()">إلغاء</button></div>
    </form>`, {
    onMount: (wrap) => wrap.querySelector('#bForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = { unitId, title: document.getElementById('b_title').value.trim(), driveUrl: document.getElementById('b_url').value.trim(), order: parseFloat(document.getElementById('b_order').value) || 0, pageCount: parseFloat(document.getElementById('b_pages').value) || 0 };
      try {
        if (book) await api.patch(`/books/${book.id}`, payload); else await api.post('/books', payload);
        closeModals(); toast('تم الحفظ ✅'); renderUnitWorkspace(unitId, 'books');
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}
function deleteBook(id, unitId) {
  confirmAction('هل تريد حذف هذا الكتاب؟', async () => {
    try { await api.del(`/books/${id}`); toast('تم الحذف'); renderUnitWorkspace(unitId, 'books'); } catch (e) { toast(e.message, 'error'); }
  });
}

// -- Exams tab --
async function renderExamsTab(body, unitId) {
  loading(body);
  let exams = []; try { exams = await api.get(`/exams/unit/${unitId}`); } catch (e) { toast(e.message, 'error'); }
  body.innerHTML = `
    <div style="text-align:left;margin-bottom:14px"><button class="btn primary sm" id="addExamBtn">+ إضافة امتحان</button></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>العنوان</th><th>الوقت</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${exams.length ? exams.map((ex) => `
        <tr><td>${escapeHtml(ex.title)}</td><td>${ex.timerMinutes > 0 ? ex.timerMinutes + ' د' : '—'}</td>
          <td><span class="status-pill ${ex.status}">${ex.status === 'published' ? 'منشور' : 'مسودة'}</span></td>
          <td><div class="row-actions">
            <button class="btn sm secondary" onclick="location.hash='#/exam-questions/${ex.id}'">الأسئلة</button>
            ${ex.status === 'published' ? `<button class="btn sm secondary" onclick="examAction('${ex.id}','hide','${unitId}')">إخفاء</button>` : `<button class="btn sm secondary" onclick="examAction('${ex.id}','publish','${unitId}')">نشر</button>`}
            <button class="btn sm secondary" onclick="examFormModal('${unitId}', ${JSON.stringify(ex).replace(/"/g, '&quot;')})">تعديل</button>
            <button class="btn sm danger" onclick="deleteExam('${ex.id}','${unitId}')">حذف</button>
          </div></td></tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="em">📝</div>لا توجد امتحانات بعد</div></td></tr>`}
      </tbody></table></div>`;
  document.getElementById('addExamBtn').addEventListener('click', () => examFormModal(unitId));
}
function examFormModal(unitId, exam = null) {
  openModal(exam ? 'تعديل الامتحان' : 'إضافة امتحان', `
    <form id="exForm">
      <div class="field"><label>العنوان</label><input id="e_title" value="${exam ? escapeHtml(exam.title) : ''}" required></div>
      <div class="field"><label>الوصف</label><textarea id="e_desc" rows="2">${exam ? escapeHtml(exam.description || '') : ''}</textarea></div>
      <div class="field-row">
        <div class="field"><label>الوقت (دقيقة، 0 = بدون وقت)</label><input type="number" id="e_timer" value="${exam ? exam.timerMinutes || 0 : 0}"></div>
        <div class="field"><label>محاولات مسموحة</label><input type="number" id="e_attempts" value="${exam ? exam.maxAttempts || 1 : 1}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>درجة النجاح %</label><input type="number" id="e_pass" value="${exam ? exam.passingScore || 50 : 50}"></div>
        <div class="field"><label>خصم الإجابة الخاطئة</label><input type="number" id="e_neg" value="${exam ? exam.negativeMarkValue || 0 : 0}"></div>
      </div>
      <div class="checkbox-row"><input type="checkbox" id="e_shuffle" ${exam && String(exam.shuffleQuestions) === 'true' ? 'checked' : ''}><label>ترتيب عشوائي للأسئلة</label></div>
      <div class="checkbox-row"><input type="checkbox" id="e_negative" ${exam && String(exam.negativeMarking) === 'true' ? 'checked' : ''}><label>تفعيل الخصم للإجابة الخاطئة</label></div>
      <div class="modal-actions"><button class="btn primary">حفظ</button><button type="button" class="btn secondary" onclick="closeModals()">إلغاء</button></div>
    </form>`, {
    onMount: (wrap) => wrap.querySelector('#exForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        unitId, title: document.getElementById('e_title').value.trim(), description: document.getElementById('e_desc').value.trim(),
        timerMinutes: parseFloat(document.getElementById('e_timer').value) || 0,
        maxAttempts: parseFloat(document.getElementById('e_attempts').value) || 1,
        passingScore: parseFloat(document.getElementById('e_pass').value) || 50,
        negativeMarkValue: parseFloat(document.getElementById('e_neg').value) || 0,
        shuffleQuestions: document.getElementById('e_shuffle').checked,
        negativeMarking: document.getElementById('e_negative').checked
      };
      try {
        if (exam) await api.patch(`/exams/${exam.id}`, payload); else await api.post('/exams', payload);
        closeModals(); toast('تم الحفظ ✅'); renderUnitWorkspace(unitId, 'exams');
      } catch (err) { toast(err.message, 'error'); }
    })
  });
}
async function examAction(id, action, unitId) {
  try { await api.post(`/exams/${id}/${action}`); toast('تم ✅'); renderUnitWorkspace(unitId, 'exams'); } catch (e) { toast(e.message, 'error'); }
}
function deleteExam(id, unitId) {
  confirmAction('سيتم حذف الامتحان وكل أسئلته. هل أنت متأكد؟', async () => {
    try { await api.del(`/exams/${id}`); toast('تم الحذف'); renderUnitWorkspace(unitId, 'exams'); } catch (e) { toast(e.message, 'error'); }
  });
}

// ---------- Question bank ----------
async function renderExamQuestions(examId) {
  loading(app);
  let exam, questions = [];
  try { exam = await api.get(`/exams/${examId}`); questions = await api.get(`/questions/exam/${examId}`); } catch (e) { toast(e.message, 'error'); return; }

  app.innerHTML = `
    <a href="#/unit/${exam.unitId}/exams" style="display:inline-flex;gap:6px;color:var(--text-muted);font-weight:700;font-size:13px;margin-bottom:14px">→ رجوع للامتحانات</a>
    <div class="topbar-row"><div><h1 class="page-title">بنك أسئلة: ${escapeHtml(exam.title)}</h1><p class="page-sub">${questions.length} سؤال</p></div>
      <button class="btn primary" id="addQBtn">+ إضافة سؤال</button></div>
    <div id="qList">${questions.length ? questions.map((q, i) => questionRowHtml(q, i)).join('') : `<div class="empty-state"><div class="em">❓</div>لا توجد أسئلة بعد</div>`}</div>`;
  document.getElementById('addQBtn').addEventListener('click', () => questionFormModal(examId));
}
function questionRowHtml(q, i) {
  const opts = safeParse(q.options) || [];
  const correct = safeParse(q.correctAnswer);
  return `
    <div class="panel" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="flex:1">
          <div style="font-size:11px;color:var(--text-muted);font-weight:800;margin-bottom:6px">سؤال ${i + 1} — ${qTypeLabel(q.type)} — ${q.points || 1} درجة</div>
          <div style="font-weight:700;margin-bottom:10px">${escapeHtml(q.text)}</div>
          ${opts.length ? `<div style="display:flex;flex-direction:column;gap:6px">${opts.map((o, idx) => `
            <div style="font-size:13px;padding:8px 12px;border-radius:8px;background:${String(idx) === String(correct) || (Array.isArray(correct) && correct.map(String).includes(String(idx))) ? 'rgba(34,197,94,.12)' : 'var(--bg-alt)'}">${idx === correct || (Array.isArray(correct) && correct.includes(idx)) ? '✅ ' : ''}${escapeHtml(o)}</div>
          `).join('')}</div>` : ''}
        </div>
        <div class="row-actions">
          <button class="btn sm secondary" onclick='questionFormModal(${JSON.stringify(q.examId)}, ${JSON.stringify(q).replace(/'/g, "&#39;")})'>تعديل</button>
          <button class="btn sm danger" onclick="deleteQuestion('${q.id}','${q.examId}')">حذف</button>
        </div>
      </div>
    </div>`;
}
function qTypeLabel(t) { return { mcq: 'اختيار من متعدد', truefalse: 'صح/خطأ', multi: 'متعدد الإجابات', fillblank: 'أكمل الفراغ', essay: 'مقالي', image: 'صورة' }[t] || t; }
function safeParse(raw) { try { return JSON.parse(raw); } catch (e) { return raw; } }

function questionFormModal(examId, q = null) {
  const type = q ? q.type : 'mcq';
  openModal(q ? 'تعديل السؤال' : 'إضافة سؤال', `
    <form id="qForm">
      <div class="field"><label>نوع السؤال</label>
        <select id="q_type">
          <option value="mcq" ${type === 'mcq' ? 'selected' : ''}>اختيار من متعدد</option>
          <option value="truefalse" ${type === 'truefalse' ? 'selected' : ''}>صح / خطأ</option>
          <option value="multi" ${type === 'multi' ? 'selected' : ''}>متعدد الإجابات</option>
          <option value="fillblank" ${type === 'fillblank' ? 'selected' : ''}>أكمل الفراغ</option>
          <option value="essay" ${type === 'essay' ? 'selected' : ''}>سؤال مقالي</option>
        </select>
      </div>
      <div class="field"><label>نص السؤال</label><textarea id="q_text" rows="2" required>${q ? escapeHtml(q.text) : ''}</textarea></div>
      <div id="optionsArea"></div>
      <div class="field-row">
        <div class="field"><label>الدرجة</label><input type="number" id="q_points" value="${q ? q.points || 1 : 1}"></div>
        <div class="field"><label>الترتيب</label><input type="number" id="q_order" value="${q ? q.order || 0 : 0}"></div>
      </div>
      <div class="modal-actions"><button class="btn primary">حفظ</button><button type="button" class="btn secondary" onclick="closeModals()">إلغاء</button></div>
    </form>`, {
    onMount: (wrap) => {
      const optionsArea = wrap.querySelector('#optionsArea');
      const typeSelect = wrap.querySelector('#q_type');
      const existingOptions = q ? (safeParse(q.options) || []) : ['', ''];
      const existingCorrect = q ? safeParse(q.correctAnswer) : null;

      function renderOptionsArea() {
        const t = typeSelect.value;
        if (t === 'mcq' || t === 'multi') {
          const opts = existingOptions.length ? existingOptions : ['', '', '', ''];
          optionsArea.innerHTML = `
            <div class="field"><label>الاختيارات (حدد الإجابة الصحيحة)</label>
              <div id="optRows">${opts.map((o, idx) => `
                <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
                  <input type="${t === 'multi' ? 'checkbox' : 'radio'}" name="correctOpt" class="correctMark" value="${idx}" ${t === 'mcq' ? (String(existingCorrect) === String(idx) ? 'checked' : '') : ((existingCorrect || []).includes(idx) ? 'checked' : '')}>
                  <input type="text" class="optText" data-idx="${idx}" value="${escapeHtml(o)}" placeholder="اختيار ${idx + 1}" style="flex:1;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface-solid);color:var(--text)">
                </div>`).join('')}</div>
              <button type="button" class="btn sm secondary" id="addOptBtn">+ إضافة اختيار</button>
            </div>`;
          optionsArea.querySelector('#addOptBtn').addEventListener('click', () => {
            const idx = optionsArea.querySelectorAll('.optText').length;
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
            row.innerHTML = `<input type="${t === 'multi' ? 'checkbox' : 'radio'}" name="correctOpt" class="correctMark" value="${idx}">
              <input type="text" class="optText" data-idx="${idx}" placeholder="اختيار ${idx + 1}" style="flex:1;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface-solid);color:var(--text)">`;
            optionsArea.querySelector('#optRows').appendChild(row);
          });
        } else if (t === 'truefalse') {
          optionsArea.innerHTML = `
            <div class="field"><label>الإجابة الصحيحة</label>
              <select id="tfCorrect">
                <option value="0" ${String(existingCorrect) === '0' ? 'selected' : ''}>صح</option>
                <option value="1" ${String(existingCorrect) === '1' ? 'selected' : ''}>خطأ</option>
              </select>
            </div>`;
        } else if (t === 'fillblank') {
          optionsArea.innerHTML = `<div class="field"><label>الإجابة الصحيحة</label><input type="text" id="fillCorrect" value="${existingCorrect || ''}"></div>`;
        } else {
          optionsArea.innerHTML = `<p style="color:var(--text-muted);font-size:13px">الأسئلة المقالية تحتاج تصحيحًا يدويًا من المدرّس بعد التسليم.</p>`;
        }
      }
      typeSelect.addEventListener('change', renderOptionsArea);
      renderOptionsArea();

      wrap.querySelector('#qForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const t = typeSelect.value;
        let options, correctAnswer;
        if (t === 'mcq' || t === 'multi') {
          options = Array.from(wrap.querySelectorAll('.optText')).map((i) => i.value.trim());
          if (t === 'multi') {
            correctAnswer = Array.from(wrap.querySelectorAll('.correctMark:checked')).map((i) => parseInt(i.value, 10));
          } else {
            const checked = wrap.querySelector('.correctMark:checked');
            correctAnswer = checked ? parseInt(checked.value, 10) : null;
          }
        } else if (t === 'truefalse') {
          options = ['صح', 'خطأ'];
          correctAnswer = parseInt(document.getElementById('tfCorrect').value, 10);
        } else if (t === 'fillblank') {
          options = undefined;
          correctAnswer = document.getElementById('fillCorrect').value.trim();
        } else {
          options = undefined; correctAnswer = undefined;
        }
        const payload = {
          examId, type: t, text: document.getElementById('q_text').value.trim(),
          options, correctAnswer, points: parseFloat(document.getElementById('q_points').value) || 1,
          order: parseFloat(document.getElementById('q_order').value) || 0
        };
        try {
          if (q) await api.patch(`/questions/${q.id}`, payload); else await api.post('/questions', payload);
          closeModals(); toast('تم الحفظ ✅'); renderExamQuestions(examId);
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  });
}
function deleteQuestion(id, examId) {
  confirmAction('هل تريد حذف هذا السؤال؟', async () => {
    try { await api.del(`/questions/${id}`); toast('تم الحذف'); renderExamQuestions(examId); } catch (e) { toast(e.message, 'error'); }
  });
}

// ---------- Students ----------
async function renderStudents() {
  loading(app);
  let students = [], units = [];
  try { [students, units] = await Promise.all([api.get('/students'), api.get('/units')]); } catch (e) { toast(e.message, 'error'); return; }

  app.innerHTML = `
    <div class="topbar-row">
      <div><h1 class="page-title">الطلاب</h1><p class="page-sub">${students.length} طالب مسجّل</p></div>
      <div class="search-box"><input id="studentSearch" placeholder="بحث بالاسم..."></div>
    </div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>الاسم</th><th>الهاتف</th><th>الكود</th><th>الوحدات المتاحة</th><th>آخر دخول</th><th></th></tr></thead>
      <tbody id="studentsBody">${studentsRows(students, units)}</tbody>
    </table></div>`;

  document.getElementById('studentSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtered = students.filter((s) => (s.name || '').toLowerCase().includes(q));
    document.getElementById('studentsBody').innerHTML = studentsRows(filtered, units);
  });
}
function studentsRows(students, units) {
  if (!students.length) return `<tr><td colspan="6"><div class="empty-state"><div class="em">👥</div>لا يوجد طلاب بعد</div></td></tr>`;
  return students.map((s) => {
    const unitIds = (s.unitIds || '').split(',').filter(Boolean);
    const unitNames = unitIds.map((id) => (units.find((u) => u.id === id) || {}).title).filter(Boolean);
    return `<tr>
      <td style="font-weight:700">${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.phone || '—')}</td>
      <td><code>${escapeHtml(s.code)}</code></td>
      <td>${unitNames.map((n) => `<span class="status-pill active" style="margin-left:4px">${escapeHtml(n)}</span>`).join('') || '—'}</td>
      <td style="color:var(--text-muted);font-size:12px">${s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString('ar-EG') : '—'}</td>
      <td><button class="btn sm danger" onclick="deleteStudent('${s.id}')">حذف</button></td>
    </tr>`;
  }).join('');
}
function deleteStudent(id) {
  confirmAction('هل تريد حذف هذا الطالب؟ سيفقد الوصول لكل الوحدات.', async () => {
    try { await api.del(`/students/${id}`); toast('تم الحذف'); renderStudents(); } catch (e) { toast(e.message, 'error'); }
  });
}

// ---------- Codes ----------
async function renderCodes() {
  loading(app);
  let units = []; try { units = await api.get('/units'); } catch (e) { toast(e.message, 'error'); return; }

  app.innerHTML = `
    <div class="topbar-row"><div><h1 class="page-title">أكواد الدخول</h1><p class="page-sub">توليد وإدارة أكواد الوصول للطلاب</p></div></div>
    <div class="panel">
      <h3>توليد أكواد جديدة</h3>
      <form id="genForm">
        <div class="field-row">
          <div class="field"><label>الوحدة</label>
            <select id="c_unit" required>${units.map((u) => `<option value="${u.id}">${escapeHtml(u.title)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>العدد</label><input type="number" id="c_count" value="10" min="1" max="1000" required></div>
        </div>
        <div class="field"><label>بادئة الكود (اختياري)</label><input id="c_prefix" placeholder="MFX"></div>
        <button class="btn primary" id="genBtn">توليد الأكواد</button>
      </form>
      <div id="genResult"></div>
    </div>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <h3 style="margin:0">الأكواد الحالية</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="filterUnit" style="padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface-solid);color:var(--text)">
            <option value="">كل الوحدات</option>
            ${units.map((u) => `<option value="${u.id}">${escapeHtml(u.title)}</option>`).join('')}
          </select>
          <button class="btn sm secondary" id="exportExcelBtn">⬇️ Excel</button>
          <button class="btn sm secondary" id="exportPdfBtn">⬇️ PDF</button>
          <button class="btn sm secondary" id="printBtn">🖨️ طباعة</button>
        </div>
      </div>
      <div id="codesTableWrap"></div>
    </div>`;

  async function loadCodes() {
    const unitId = document.getElementById('filterUnit').value;
    const codes = await api.get(`/codes${unitId ? '?unitId=' + unitId : ''}`);
    document.getElementById('codesTableWrap').innerHTML = `
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>الكود</th><th>الحالة</th><th>الطالب</th><th></th></tr></thead>
        <tbody>${codes.length ? codes.map((c) => `
          <tr><td><code>${escapeHtml(c.code)}</code></td>
          <td><span class="status-pill ${c.status}">${c.status === 'active' ? 'مفعّل' : 'غير مستخدم'}</span></td>
          <td>${escapeHtml(c.studentName || '—')}</td>
          <td><button class="btn sm danger" onclick="deleteCode('${c.id}')">حذف</button></td></tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="em">🔑</div>لا توجد أكواد بعد</div></td></tr>`}
        </tbody></table></div>`;
  }
  document.getElementById('filterUnit').addEventListener('change', loadCodes);
  document.getElementById('exportExcelBtn').addEventListener('click', () => downloadExport('/codes/export/excel', document.getElementById('filterUnit').value, 'access-codes.xlsx'));
  document.getElementById('exportPdfBtn').addEventListener('click', () => downloadExport('/codes/export/pdf', document.getElementById('filterUnit').value, 'access-codes.pdf'));
  document.getElementById('printBtn').addEventListener('click', async () => {
    const unitId = document.getElementById('filterUnit').value;
    try {
      const res = await api.get('/codes/print' + (unitId ? '?unitId=' + unitId : ''));
      const html = await res.text();
      const win = window.open('', '_blank');
      win.document.open(); win.document.write(html); win.document.close();
    } catch (e) { toast('تعذّر فتح صفحة الطباعة', 'error'); }
  });

  document.getElementById('genForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('genBtn'); btn.disabled = true; btn.textContent = 'جاري التوليد...';
    try {
      const codes = await api.post('/codes/generate', {
        unitId: document.getElementById('c_unit').value,
        count: parseInt(document.getElementById('c_count').value, 10),
        prefix: document.getElementById('c_prefix').value.trim()
      });
      document.getElementById('genResult').innerHTML = `
        <p style="color:var(--success);font-weight:700;margin-top:16px">تم توليد ${codes.length} كود بنجاح ✅</p>
        <div class="codes-grid">${codes.map((c) => `<div class="code-chip">${escapeHtml(c.code)}</div>`).join('')}</div>`;
      toast('تم توليد الأكواد ✅'); loadCodes();
    } catch (err) { toast(err.message, 'error'); }
    btn.disabled = false; btn.textContent = 'توليد الأكواد';
  });

  loadCodes();
}
async function downloadExport(path, unitId, filename) {
  try {
    const res = await api.get(path + (unitId ? '?unitId=' + unitId : ''));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch (e) { toast('تعذّر تنزيل الملف', 'error'); }
}
function deleteCode(id) {
  confirmAction('هل تريد حذف هذا الكود؟', async () => {
    try { await api.del(`/codes/${id}`); toast('تم الحذف'); renderCodes(); } catch (e) { toast(e.message, 'error'); }
  });
}

// ---------- Analytics ----------
async function renderAnalytics() {
  loading(app);
  let overview, topStudents, examStats, videoStats;
  try {
    [overview, topStudents, examStats, videoStats] = await Promise.all([
      api.get('/analytics/overview'), api.get('/analytics/top-students'),
      api.get('/analytics/exam-stats'), api.get('/analytics/video-stats')
    ]);
  } catch (e) { toast(e.message, 'error'); return; }

  app.innerHTML = `
    <div class="topbar-row"><div><h1 class="page-title">الإحصائيات والتقارير</h1><p class="page-sub">أداء الطلاب والمحتوى</p></div></div>

    <div class="panel">
      <h3>🏆 أفضل 10 طلاب (متوسط الدرجات)</h3>
      <div class="bar-list">${topStudents.top.length ? topStudents.top.map((t) => `
        <div class="bar-row"><span>${escapeHtml(t.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${t.average}%"></div></div><span>${t.average}%</span></div>
      `).join('') : '<p style="color:var(--text-muted)">لا توجد بيانات كافية بعد</p>'}</div>
    </div>

    <div class="panel">
      <h3>📝 أداء الامتحانات</h3>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>الامتحان</th><th>عدد المحاولات</th><th>متوسط الدرجات</th><th>نسبة النجاح</th></tr></thead>
        <tbody>${examStats.length ? examStats.map((e) => `
          <tr><td>${escapeHtml(e.title)}</td><td>${e.attempts}</td><td>${e.averagePercentage}%</td><td>${e.passRate}%</td></tr>
        `).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="em">📊</div>لا توجد بيانات بعد</div></td></tr>`}</tbody>
      </table></div>
    </div>

    <div class="panel">
      <h3>🎬 الفيديوهات الأكثر مشاهدة</h3>
      <div class="bar-list">${videoStats.mostWatched.length ? videoStats.mostWatched.map((v) => `
        <div class="bar-row"><span>${escapeHtml(v.title)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, v.views * 10)}%"></div></div><span>${v.views}</span></div>
      `).join('') : '<p style="color:var(--text-muted)">لا توجد بيانات كافية بعد</p>'}</div>
    </div>`;
}

// ---------- Settings ----------
async function renderSettings() {
  loading(app);
  let settings = []; try { settings = await api.get('/settings'); } catch (e) { toast(e.message, 'error'); return; }
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  app.innerHTML = `
    <div class="topbar-row"><div><h1 class="page-title">الإعدادات</h1><p class="page-sub">إعدادات المنصة العامة</p></div></div>
    <div class="panel">
      <h3>الإعدادات العامة</h3>
      <form id="settingsForm">
        <div class="field"><label>اسم المنصة</label><input id="s_name" value="${escapeHtml(map.platformName || '')}"></div>
        <div class="checkbox-row"><input type="checkbox" id="s_dark" ${map.defaultDarkMode === 'true' ? 'checked' : ''}><label>الوضع الليلي كافتراضي للطلاب</label></div>
        <button class="btn primary" id="saveSettingsBtn">حفظ الإعدادات</button>
      </form>
    </div>`;

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api.post('/settings', { key: 'platformName', value: document.getElementById('s_name').value.trim() });
      await api.post('/settings', { key: 'defaultDarkMode', value: String(document.getElementById('s_dark').checked) });
      toast('تم حفظ الإعدادات ✅');
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ---------- Boot ----------
function boot() {
  initTheme();
  if (!AdminAuth.isLoggedIn()) { renderLoginScreen(); return; }
  renderShell();
  renderPage();
}
boot();
