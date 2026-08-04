const shell = document.getElementById('shell');
const loginScreen = document.getElementById('loginScreen');
const sidebar = document.getElementById('sidebar');
const app = document.getElementById('app');

const NAV = [
  ['#/dashboard', '📊 لوحة القيادة'],
  ['#/units', '📚 الوحدات'],
  ['#/codes', '🔑 أكواد الطلاب'],
  ['#/students', '👨‍🎓 الطلاب'],
  ['#/rankings', '🏆 الترتيب'],
  ['#/analytics', '📈 التحليلات'],
  ['#/reports', '📄 التقارير'],
  ['#/notifications', '🔔 الإشعارات'],
  ['#/settings', '⚙️ الإعدادات']
];

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function loading() { app.innerHTML = `<div class="spinner"></div>`; }

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

function router() {
  if (!AdminAuth.isLoggedIn()) return renderLogin();
  shell.style.display = 'flex';
  loginScreen.innerHTML = '';
  renderSidebar();

  const hash = location.hash || '#/dashboard';
  if (hash.startsWith('#/dashboard')) return renderDashboard();
  if (hash.startsWith('#/units') && hash === '#/units') return renderUnits();
  if (hash.startsWith('#/unit/')) return renderUnitDetail(hash.split('/')[2]);
  if (hash.startsWith('#/exam/')) return renderExamDetail(hash.split('/')[2]);
  if (hash.startsWith('#/codes')) return renderCodes();
  if (hash.startsWith('#/students')) return renderStudents();
  if (hash.startsWith('#/rankings')) return renderRankingsPicker();
  if (hash.startsWith('#/analytics')) return renderAnalytics();
  if (hash.startsWith('#/reports')) return renderReports();
  if (hash.startsWith('#/notifications')) return renderNotifications();
  if (hash.startsWith('#/settings')) return renderSettings();
  location.hash = '#/dashboard';
}

function renderSidebar() {
  const user = AdminAuth.getUser();
  sidebar.innerHTML = `
    <div class="brand">👋 ${esc(user?.name || 'المدرّس')}</div>
    ${NAV.map(([href, label]) => `<a href="${href}" class="${location.hash.startsWith(href) ? 'active' : ''}">${label}</a>`).join('')}
    <a href="#" id="logoutLink" style="color:var(--danger);margin-top:10px">🚪 خروج</a>`;
  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault(); AdminAuth.clear(); router();
  });
}

// ---------- LOGIN ----------
function renderLogin() {
  shell.style.display = 'none';
  loginScreen.innerHTML = `
    <div class="center-screen">
      <div class="card" style="width:100%;max-width:380px">
        <h2 style="text-align:center;margin-top:0">دخول المدرّس</h2>
        <div style="margin-bottom:14px"><label>اسم المستخدم</label><input id="u"></div>
        <div style="margin-bottom:18px"><label>كلمة المرور</label><input id="p" type="password"></div>
        <button class="btn" style="width:100%" id="loginBtn">دخول</button>
        <p id="err" style="color:var(--danger)"></p>
      </div>
    </div>`;
  document.getElementById('loginBtn').addEventListener('click', async () => {
    try {
      const data = await api.post('/auth/admin/login', {
        username: document.getElementById('u').value, password: document.getElementById('p').value
      });
      AdminAuth.setSession(data);
      location.hash = '#/dashboard';
      router();
    } catch (e) { document.getElementById('err').textContent = e.message; }
  });
}

// ---------- DASHBOARD ----------
async function renderDashboard() {
  loading();
  const overview = await api.get('/analytics/overview');
  const cards = [
    ['totalStudents', 'الطلاب'], ['publishedUnits', 'الوحدات المنشورة'],
    ['totalVideos', 'الفيديوهات'], ['totalBooks', 'الكتب'],
    ['totalExams', 'الاختبارات'], ['totalAttempts', 'محاولات الاختبار'],
    ['activeCodes', 'أكواد مفعّلة'], ['unusedCodes', 'أكواد غير مستخدمة']
  ];
  app.innerHTML = `
    <h2>لوحة القيادة</h2>
    <div class="grid cols-3">
      ${cards.map(([k, label]) => `
        <div class="card stat-card"><div class="value">${overview[k]}</div><div class="label">${label}</div></div>
      `).join('')}
    </div>`;
}

// ---------- UNITS ----------
async function renderUnits() {
  loading();
  const units = await api.get('/units');
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2>الوحدات</h2>
      <button class="btn" id="addUnitBtn">+ وحدة جديدة</button>
    </div>
    <div class="grid cols-3">
      ${units.map(u => `
        <div class="card">
          <div style="display:flex;justify-content:space-between">
            <b>${esc(u.title)}</b><span class="badge ${u.status}">${u.status}</span>
          </div>
          <p style="color:var(--text-muted);font-size:13px">${esc(u.description || '')}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            <a class="btn secondary" href="#/unit/${u.id}">إدارة</a>
            <button class="btn ${u.status === 'published' ? 'secondary' : ''}" data-act="toggle" data-id="${u.id}" data-status="${u.status}">
              ${u.status === 'published' ? 'إخفاء' : 'نشر'}
            </button>
            <button class="btn secondary" data-act="dup" data-id="${u.id}">نسخ</button>
            <button class="btn danger" data-act="del" data-id="${u.id}">حذف</button>
          </div>
        </div>`).join('') || '<p class="empty-state">لا توجد وحدات بعد</p>'}
    </div>`;

  document.getElementById('addUnitBtn').addEventListener('click', async () => {
    const title = prompt('عنوان الوحدة:');
    if (!title) return;
    await api.post('/units', { title });
    renderUnits();
  });

  app.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    if (btn.dataset.act === 'toggle') {
      await api.post(`/units/${id}/${btn.dataset.status === 'published' ? 'hide' : 'publish'}`);
    } else if (btn.dataset.act === 'dup') {
      await api.post(`/units/${id}/duplicate`);
    } else if (btn.dataset.act === 'del') {
      if (!confirm('حذف الوحدة نهائيًا؟')) return;
      await api.del(`/units/${id}`);
    }
    renderUnits();
  }));
}

async function renderUnitDetail(unitId) {
  loading();
  const [unit, videos, books, exams] = await Promise.all([
    api.get(`/units/${unitId}`), api.get(`/videos/unit/${unitId}`),
    api.get(`/books/unit/${unitId}`), api.get(`/exams/unit/${unitId}`)
  ]);

  app.innerHTML = `
    <a href="#/units" class="btn ghost">→ الوحدات</a>
    <h2>${esc(unit.title)}</h2>

    <div class="tabs">
      <button class="active" data-tab="videos">فيديوهات</button>
      <button data-tab="books">كتب</button>
      <button data-tab="exams">اختبارات</button>
    </div>

    <div id="tabVideos">
      <button class="btn" id="uploadVideoBtn">⬆ رفع فيديو</button>
      <div class="grid cols-3" style="margin-top:14px">
        ${videos.map(v => `
          <div class="card">
            <b>${esc(v.title)}</b>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn danger" data-del-video="${v.id}" data-file="${v.driveFileId}">حذف</button>
            </div>
          </div>`).join('') || '<p class="empty-state">لا يوجد فيديوهات</p>'}
      </div>
    </div>
    <div id="tabBooks" style="display:none">
      <button class="btn" id="uploadBookBtn">⬆ رفع كتاب PDF</button>
      <div class="grid cols-3" style="margin-top:14px">
        ${books.map(b => `
          <div class="card">
            <b>${esc(b.title)}</b>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn danger" data-del-book="${b.id}" data-file="${b.driveFileId}">حذف</button>
            </div>
          </div>`).join('') || '<p class="empty-state">لا يوجد كتب</p>'}
      </div>
    </div>
    <div id="tabExams" style="display:none">
      <button class="btn" id="addExamBtn">+ اختبار جديد</button>
      <div class="grid cols-3" style="margin-top:14px">
        ${exams.map(e => `
          <div class="card">
            <div style="display:flex;justify-content:space-between"><b>${esc(e.title)}</b><span class="badge ${e.status}">${e.status}</span></div>
            <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
              <a class="btn secondary" href="#/exam/${e.id}">إدارة الأسئلة</a>
              <button class="btn" data-exam-publish="${e.id}" data-status="${e.status}">${e.status === 'published' ? 'إخفاء' : 'نشر'}</button>
            </div>
          </div>`).join('') || '<p class="empty-state">لا يوجد اختبارات</p>'}
      </div>
    </div>`;

  // tabs
  document.querySelectorAll('.tabs button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['videos', 'books', 'exams'].forEach(t => {
      document.getElementById('tab' + t[0].toUpperCase() + t.slice(1)).style.display = t === btn.dataset.tab ? 'block' : 'none';
    });
  }));

  document.getElementById('uploadVideoBtn').addEventListener('click', () => uploadMedia(unitId, 'video'));
  document.getElementById('uploadBookBtn').addEventListener('click', () => uploadMedia(unitId, 'book'));

  document.getElementById('addExamBtn').addEventListener('click', async () => {
    const title = prompt('عنوان الاختبار:');
    if (!title) return;
    const exam = await api.post('/exams', { unitId, title });
    location.hash = `#/exam/${exam.id}`;
  });

  app.querySelectorAll('[data-del-video]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('حذف الفيديو؟')) return;
    await api.del(`/videos/${b.dataset.delVideo}`);
    renderUnitDetail(unitId);
  }));
  app.querySelectorAll('[data-del-book]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('حذف الكتاب؟')) return;
    await api.del(`/books/${b.dataset.delBook}`);
    renderUnitDetail(unitId);
  }));
  app.querySelectorAll('[data-exam-publish]').forEach(b => b.addEventListener('click', async () => {
    await api.post(`/exams/${b.dataset.examPublish}/${b.dataset.status === 'published' ? 'hide' : 'publish'}`);
    renderUnitDetail(unitId);
  }));
}

function uploadMedia(unitId, kind) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = kind === 'video' ? 'video/*' : 'application/pdf';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const title = prompt('العنوان:', file.name) || file.name;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subfolder', kind === 'video' ? 'videos' : 'books');
    app.insertAdjacentHTML('afterbegin', '<p id="uploadStatus">⏳ جاري الرفع...</p>');
    try {
      const uploaded = await api.upload('/upload', formData);
      const endpoint = kind === 'video' ? '/videos' : '/books';
      await api.post(endpoint, {
        unitId, title, driveFileId: uploaded.driveFileId, driveUrl: uploaded.driveUrl
      });
      renderUnitDetail(unitId);
    } catch (e) {
      alert('فشل الرفع: ' + e.message);
      document.getElementById('uploadStatus')?.remove();
    }
  };
  input.click();
}

// ---------- EXAM QUESTIONS ----------
async function renderExamDetail(examId) {
  loading();
  const exam = await api.get(`/exams/${examId}`);
  app.innerHTML = `
    <a href="#/unit/${exam.unitId}" class="btn ghost">→ رجوع للوحدة</a>
    <h2>${esc(exam.title)} — بنك الأسئلة</h2>

    <div class="card" style="margin-bottom:16px">
      <div class="grid cols-3">
        <div><label>الوقت (دقيقة)</label><input id="cfgTimer" type="number" value="${exam.timerMinutes}"></div>
        <div><label>عدد المحاولات</label><input id="cfgAttempts" type="number" value="${exam.maxAttempts}"></div>
        <div><label>درجة النجاح %</label><input id="cfgPassing" type="number" value="${exam.passingScore}"></div>
        <div><label><input id="cfgShuffle" type="checkbox" ${String(exam.shuffleQuestions) === 'true' ? 'checked' : ''}> ترتيب عشوائي</label></div>
        <div><label><input id="cfgNegative" type="checkbox" ${String(exam.negativeMarking) === 'true' ? 'checked' : ''}> خصم درجات</label></div>
        <div><label>قيمة الخصم</label><input id="cfgNegativeVal" type="number" value="${exam.negativeMarkValue}"></div>
      </div>
      <button class="btn" id="saveExamCfg" style="margin-top:12px">حفظ الإعدادات</button>
    </div>

    <button class="btn" id="addQuestionBtn">+ سؤال جديد</button>
    <div id="questionsList" class="grid cols-2" style="margin-top:14px"></div>`;

  document.getElementById('saveExamCfg').addEventListener('click', async () => {
    await api.patch(`/exams/${examId}`, {
      timerMinutes: +document.getElementById('cfgTimer').value,
      maxAttempts: +document.getElementById('cfgAttempts').value,
      passingScore: +document.getElementById('cfgPassing').value,
      shuffleQuestions: document.getElementById('cfgShuffle').checked,
      negativeMarking: document.getElementById('cfgNegative').checked,
      negativeMarkValue: +document.getElementById('cfgNegativeVal').value
    });
    alert('تم الحفظ');
  });

  document.getElementById('addQuestionBtn').addEventListener('click', () => openQuestionModal(examId));
  loadQuestions(examId);
}

async function loadQuestions(examId) {
  const questions = await api.get(`/questions/exam/${examId}`);
  document.getElementById('questionsList').innerHTML = questions.map(q => `
    <div class="card">
      <span class="badge draft">${q.type}</span>
      <p>${esc(q.text)}</p>
      <div style="display:flex;gap:6px">
        <button class="btn secondary" data-edit-q="${q.id}">تعديل</button>
        <button class="btn danger" data-del-q="${q.id}">حذف</button>
      </div>
    </div>`).join('') || '<p class="empty-state">لا يوجد أسئلة بعد</p>';

  document.querySelectorAll('[data-del-q]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('حذف السؤال؟')) return;
    await api.del(`/questions/${b.dataset.delQ}`);
    loadQuestions(examId);
  }));
  document.querySelectorAll('[data-edit-q]').forEach(b => b.addEventListener('click', () => {
    const q = questions.find(x => x.id === b.dataset.editQ);
    openQuestionModal(examId, q);
  }));
}

function openQuestionModal(examId, existing) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const opts = existing?.options ? JSON.parse(existing.options) : ['', ''];
  backdrop.innerHTML = `
    <div class="modal">
      <h3>${existing ? 'تعديل سؤال' : 'سؤال جديد'}</h3>
      <label>نوع السؤال</label>
      <select id="qType">
        ${['mcq', 'truefalse', 'multi', 'fillblank', 'essay', 'image'].map(t =>
          `<option value="${t}" ${existing?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <label style="margin-top:10px">نص السؤال</label>
      <textarea id="qText" rows="2">${esc(existing?.text || '')}</textarea>
      <div id="qOptionsWrap" style="margin-top:10px"></div>
      <label style="margin-top:10px">الدرجة</label>
      <input id="qPoints" type="number" value="${existing?.points || 1}">
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn" id="saveQ">حفظ</button>
        <button class="btn secondary" id="cancelQ">إلغاء</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  function renderOptionsUI() {
    const type = document.getElementById('qType').value;
    const wrap = document.getElementById('qOptionsWrap');
    if (type === 'mcq' || type === 'multi') {
      wrap.innerHTML = `
        <label>الاختيارات (سطر لكل اختيار)</label>
        <textarea id="qOptions" rows="3">${opts.join('\n')}</textarea>
        <label style="margin-top:8px">الإجابة الصحيحة (رقم الاختيار بدءًا من 0، افصل بفاصلة للمتعدد)</label>
        <input id="qCorrect" value="${existing?.correctAnswer ? JSON.parse(existing.correctAnswer) : ''}">`;
    } else if (type === 'truefalse') {
      wrap.innerHTML = `<label>الإجابة الصحيحة</label>
        <select id="qCorrect"><option value="true">صح</option><option value="false">خطأ</option></select>`;
    } else if (type === 'fillblank') {
      wrap.innerHTML = `<label>الإجابة الصحيحة</label><input id="qCorrect" value="${existing?.correctAnswer ? JSON.parse(existing.correctAnswer) : ''}">`;
    } else if (type === 'image') {
      wrap.innerHTML = `<label>رابط الصورة</label><input id="qImageUrl" value="${esc(existing?.imageUrl || '')}">`;
    } else {
      wrap.innerHTML = '<p style="color:var(--text-muted);font-size:13px">تُصحَّح يدويًا من المدرّس</p>';
    }
  }
  document.getElementById('qType').addEventListener('change', renderOptionsUI);
  renderOptionsUI();

  document.getElementById('cancelQ').addEventListener('click', () => backdrop.remove());
  document.getElementById('saveQ').addEventListener('click', async () => {
    const type = document.getElementById('qType').value;
    const text = document.getElementById('qText').value;
    const points = +document.getElementById('qPoints').value || 1;
    let options, correctAnswer, imageUrl;

    if (type === 'mcq' || type === 'multi') {
      options = document.getElementById('qOptions').value.split('\n').map(s => s.trim()).filter(Boolean);
      const raw = document.getElementById('qCorrect').value;
      correctAnswer = type === 'multi' ? raw.split(',').map(s => s.trim()) : raw.trim();
    } else if (type === 'truefalse' || type === 'fillblank') {
      correctAnswer = document.getElementById('qCorrect').value;
    } else if (type === 'image') {
      imageUrl = document.getElementById('qImageUrl').value;
    }

    const payload = { examId, type, text, points, options, correctAnswer, imageUrl };
    if (existing) await api.patch(`/questions/${existing.id}`, payload);
    else await api.post('/questions', payload);

    backdrop.remove();
    loadQuestions(examId);
  });
}

// ---------- CODES ----------
async function renderCodes() {
  loading();
  const [codes, units] = await Promise.all([api.get('/codes'), api.get('/units')]);
  app.innerHTML = `
    <h2>أكواد الطلاب</h2>
    <div class="card" style="margin-bottom:16px">
      <div class="grid cols-3">
        <div><label>الوحدة</label>
          <select id="codeUnit">${units.map(u => `<option value="${u.id}">${esc(u.title)}</option>`).join('')}</select>
        </div>
        <div><label>عدد الأكواد</label><input id="codeCount" type="number" value="10"></div>
        <div><label>البادئة</label><input id="codePrefix" value="MFX"></div>
      </div>
      <button class="btn" id="genBtn" style="margin-top:12px">توليد الأكواد</button>
      <a class="btn secondary" id="excelBtn">تصدير Excel</a>
      <a class="btn secondary" id="pdfBtn">تصدير PDF</a>
      <a class="btn secondary" id="printBtn" target="_blank">طباعة</a>
    </div>
    <table>
      <thead><tr><th>الكود</th><th>الحالة</th><th>الطالب</th><th></th></tr></thead>
      <tbody>
        ${codes.map(c => `<tr>
          <td>${esc(c.code)}</td><td><span class="badge ${c.status}">${c.status}</span></td>
          <td>${esc(c.studentName || '-')}</td>
          <td><button class="btn danger" data-del-code="${c.id}">حذف</button></td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  const unitSelect = document.getElementById('codeUnit');
  const updateLinks = () => {
    const uid = unitSelect.value;
    document.getElementById('excelBtn').href = `/api/codes/export/excel?unitId=${uid}`;
    document.getElementById('pdfBtn').href = `/api/codes/export/pdf?unitId=${uid}`;
    document.getElementById('printBtn').href = `/api/codes/print?unitId=${uid}`;
  };
  unitSelect.addEventListener('change', updateLinks);
  updateLinks();

  document.getElementById('genBtn').addEventListener('click', async () => {
    await api.post('/codes/generate', {
      unitId: unitSelect.value, count: +document.getElementById('codeCount').value,
      prefix: document.getElementById('codePrefix').value
    });
    renderCodes();
  });
  app.querySelectorAll('[data-del-code]').forEach(b => b.addEventListener('click', async () => {
    await api.del(`/codes/${b.dataset.delCode}`);
    renderCodes();
  }));
}

// ---------- STUDENTS ----------
async function renderStudents() {
  loading();
  const [students, units] = await Promise.all([api.get('/students'), api.get('/units')]);
  const unitTitle = (id) => (units.find(u => u.id === id) || {}).title || id;
  app.innerHTML = `
    <h2>إدارة الطلاب</h2>
    <table>
      <thead><tr><th>الاسم</th><th>الكود</th><th>الوحدات</th><th></th></tr></thead>
      <tbody>
        ${students.map(s => `<tr>
          <td>${esc(s.name)}</td><td>${esc(s.code)}</td>
          <td>${(s.unitIds || '').split(',').filter(Boolean).map(unitTitle).join(', ')}</td>
          <td><button class="btn danger" data-del-student="${s.id}">حذف</button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty-state">لا يوجد طلاب بعد</td></tr>'}
      </tbody>
    </table>`;
  app.querySelectorAll('[data-del-student]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('حذف الطالب؟')) return;
    await api.del(`/students/${b.dataset.delStudent}`);
    renderStudents();
  }));
}

// ---------- RANKINGS ----------
async function renderRankingsPicker() {
  loading();
  const units = await api.get('/units');
  const examsPerUnit = await Promise.all(units.map(u => api.get(`/exams/unit/${u.id}`)));
  const allExams = examsPerUnit.flat();
  app.innerHTML = `
    <h2>الترتيب</h2>
    <div class="grid cols-3">
      ${allExams.map(e => `<a class="card" href="#/leaderboard-admin/${e.id}" data-exam="${e.id}"><b>${esc(e.title)}</b></a>`).join('') || '<p class="empty-state">لا يوجد اختبارات</p>'}
    </div>
    <div id="rankingsTable" style="margin-top:16px"></div>`;

  app.querySelectorAll('[data-exam]').forEach(el => el.addEventListener('click', async (e) => {
    e.preventDefault();
    const rankings = await api.get(`/attempts/exam/${el.dataset.exam}/rankings`);
    document.getElementById('rankingsTable').innerHTML = `
      <table><thead><tr><th>#</th><th>الاسم</th><th>الدرجة</th></tr></thead>
      <tbody>${rankings.map(r => `<tr><td>${r.rank}</td><td>${esc(r.studentName)}</td><td>${r.percentage}%</td></tr>`).join('')}</tbody></table>`;
  }));
}

// ---------- ANALYTICS ----------
async function renderAnalytics() {
  loading();
  const [topStudents, videoStats, examStats] = await Promise.all([
    api.get('/analytics/top-students'), api.get('/analytics/video-stats'), api.get('/analytics/exam-stats')
  ]);
  app.innerHTML = `
    <h2>التحليلات</h2>
    <div class="grid cols-2">
      <div class="card">
        <h3>أفضل الطلاب</h3>
        ${topStudents.top.map(s => `<div>${esc(s.name)} — ${s.average}%</div>`).join('') || '<p class="empty-state">لا توجد بيانات</p>'}
      </div>
      <div class="card">
        <h3>الأضعف تحصيلًا</h3>
        ${topStudents.lowest.map(s => `<div>${esc(s.name)} — ${s.average}%</div>`).join('') || '<p class="empty-state">لا توجد بيانات</p>'}
      </div>
      <div class="card">
        <h3>الأكثر مشاهدة</h3>
        ${videoStats.mostWatched.map(v => `<div>${esc(v.title)} — ${v.views} مشاهدة</div>`).join('') || '<p class="empty-state">لا توجد بيانات</p>'}
      </div>
      <div class="card">
        <h3>إحصائيات الاختبارات</h3>
        ${examStats.map(e => `<div>${esc(e.title)} — متوسط ${e.averagePercentage}% — نجاح ${e.passRate}%</div>`).join('') || '<p class="empty-state">لا توجد بيانات</p>'}
      </div>
    </div>`;
}

// ---------- REPORTS ----------
async function renderReports() {
  loading();
  const [bookStats, unitPerf] = await Promise.all([api.get('/analytics/book-stats'), api.get('/analytics/unit-performance')]);
  app.innerHTML = `
    <h2>التقارير</h2>
    <div class="grid cols-2">
      <div class="card">
        <h3>الكتب المقروءة</h3>
        <table><thead><tr><th>الكتاب</th><th>فتحوه</th><th>أنهوه</th></tr></thead>
        <tbody>${bookStats.map(b => `<tr><td>${esc(b.title)}</td><td>${b.opened}</td><td>${b.finished}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="card">
        <h3>أداء الوحدات</h3>
        <table><thead><tr><th>الوحدة</th><th>المحاولات</th><th>المتوسط</th></tr></thead>
        <tbody>${unitPerf.map(u => `<tr><td>${esc(u.title)}</td><td>${u.attempts}</td><td>${u.averagePercentage}%</td></tr>`).join('')}</tbody></table>
      </div>
    </div>`;
}

// ---------- NOTIFICATIONS ----------
async function renderNotifications() {
  loading();
  const notifications = await api.get('/notifications');
  app.innerHTML = `
    <h2>الإشعارات</h2>
    <button class="btn secondary" id="readAllBtn">تعليم الكل كمقروء</button>
    <div class="grid cols-2" style="margin-top:14px">
      ${notifications.map(n => `
        <div class="card" style="${String(n.isRead) === 'true' ? 'opacity:.6' : ''}">
          <b>${esc(n.title)}</b><p>${esc(n.message)}</p>
          <small style="color:var(--text-muted)">${new Date(n.createdAt).toLocaleString('ar-EG')}</small>
        </div>`).join('') || '<p class="empty-state">لا توجد إشعارات</p>'}
    </div>`;
  document.getElementById('readAllBtn').addEventListener('click', async () => {
    await api.post('/notifications/read-all');
    renderNotifications();
  });
}

// ---------- SETTINGS ----------
async function renderSettings() {
  loading();
  const settings = await api.get('/settings');
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  app.innerHTML = `
    <h2>الإعدادات</h2>
    <div class="card" style="max-width:480px">
      <label>اسم المنصة</label><input id="setPlatformName" value="${esc(map.platformName || '')}">
      <label style="margin-top:10px"><input id="setDarkMode" type="checkbox" ${map.defaultDarkMode === 'true' ? 'checked' : ''}> الوضع الليلي افتراضيًا</label>
      <button class="btn" id="saveSettings" style="margin-top:14px">حفظ</button>
    </div>`;
  document.getElementById('saveSettings').addEventListener('click', async () => {
    await api.post('/settings', { key: 'platformName', value: document.getElementById('setPlatformName').value });
    await api.post('/settings', { key: 'defaultDarkMode', value: String(document.getElementById('setDarkMode').checked) });
    alert('تم الحفظ');
  });
}
