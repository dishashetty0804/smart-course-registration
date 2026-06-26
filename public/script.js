// =============================================
// SHARED UTILITIES
// =============================================

function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

function requireAuth(role) {
  const user = getUser();
  if (!user) { window.location.href = '/index.html'; return null; }
  if (role && user.role !== role) { window.location.href = '/index.html'; return null; }
  return user;
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}

function showAlert(msg, type = 'error', duration = 4000) {
  const box = document.getElementById('alert-global');
  if (!box) return;
  box.textContent = msg;
  box.className = type;
  box.style.display = 'block';
  clearTimeout(window._alertTimer);
  window._alertTimer = setTimeout(() => { box.style.display = 'none'; }, duration);
}

function showTab(id) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const pane = document.getElementById('pane-' + id);
  const tab = document.getElementById('t-' + id);
  if (pane) pane.classList.add('active');
  if (tab) tab.classList.add('active');
}

// =============================================
// STUDENT DASHBOARD
// =============================================

const isStudentPage = document.getElementById('pane-overview');

if (isStudentPage) {
  const user = requireAuth('student');
  if (user) {
    document.getElementById('nav-name').textContent = user.name;
    initDashboard(user);
  }
}

async function initDashboard(user) {
  await loadOverview(user);
}

async function loadOverview(user) {
  const [coursesRes, myRegsRes] = await Promise.all([
    fetch('/api/courses'),
    fetch('/api/studentCourses/' + user.id)
  ]);
  const courses = await coursesRes.json();
  const myRegs = await myRegsRes.json();

  const registeredIds = new Set(myRegs.map(r => r.courseId?._id));
  const totalSeats = courses.reduce((a, c) => a + c.availableSeats, 0);

  document.getElementById('stat-total').textContent = courses.length;
  document.getElementById('stat-registered').textContent = myRegs.length;
  document.getElementById('stat-seats').textContent = totalSeats;

  // Overview tab: show first 6 courses
  renderCourseCards(courses.slice(0, 6), registeredIds, 'overview-courses', user);

  // All courses tab
  document.getElementById('courses-count').textContent = courses.length + ' courses';
  renderCourseCards(courses, registeredIds, 'all-courses', user);

  // Enrolled tab
  renderEnrolled(myRegs);

  // Recommendations
  renderRecommendations(courses, myRegs);
}

function renderCourseCards(courses, registeredIds, containerId, user) {
  const container = document.getElementById(containerId);
  if (!courses.length) {
    container.innerHTML = '<div class="empty-state"><div style="font-size:3rem">📚</div><p>No courses available yet.</p></div>';
    return;
  }
  container.innerHTML = courses.map(c => {
    const isReg = registeredIds.has(c._id);
    const pct = ((c.maxSeats - c.availableSeats) / c.maxSeats) * 100;
    const low = c.availableSeats <= Math.ceil(c.maxSeats * 0.2);
    return `
      <div class="course-card" id="card-${c._id}">
        <div class="course-header">
          <div class="course-name">${c.name}</div>
          <div class="course-code">${c.code}</div>
        </div>
        <div class="course-meta">
          <span>👤 ${c.instructor}</span>
          <span>🕐 ${c.time}</span>
        </div>
        <div class="seats-bar"><div class="seats-fill ${low ? 'low' : ''}" style="width:${pct}%"></div></div>
        <div class="seats-text">${c.availableSeats} / ${c.maxSeats} seats available ${low && c.availableSeats > 0 ? '⚠️ Almost full' : ''} ${c.availableSeats === 0 ? '🚫 Full' : ''}</div>
        <button
          class="reg-btn ${isReg ? 'registered' : ''}"
          ${isReg ? 'disabled' : ''}
          onclick="registerCourse('${c._id}', '${user.id}')">
          ${isReg ? '✓ Enrolled' : c.availableSeats === 0 ? 'No Seats Left' : 'Register'}
        </button>
      </div>`;
  }).join('');
}

async function registerCourse(courseId, userId) {
  const res = await fetch('/api/registerCourse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId })
  });
  const data = await res.json();

  if (!res.ok) {
    showAlert('⚠ ' + data.error, 'error');
    return;
  }

  showAlert('✓ Successfully registered!', 'success');

  if (data.recommendations && data.recommendations.length > 0) {
    setTimeout(() => {
      showAlert('💡 Recommended: ' + data.recommendations.map(r => r.name).join(', '), 'info', 6000);
    }, 1500);
  }

  // Refresh dashboard
  const user = getUser();
  await loadOverview(user);
}

function renderEnrolled(myRegs) {
  const container = document.getElementById('enrolled-list');
  const countEl = document.getElementById('enrolled-count');
  const valid = myRegs.filter(r => r.courseId);
  countEl.textContent = valid.length + ' courses';

  if (!valid.length) {
    container.innerHTML = '<div class="empty-state"><div style="font-size:3rem">📋</div><p>You haven\'t registered for any courses yet.</p></div>';
    return;
  }

  container.innerHTML = valid.map(r => {
    const c = r.courseId;
    return `
      <div class="enrolled-card">
        <div class="enrolled-info">
          <div class="ename">${c.name} <span style="font-size:.75rem;font-weight:600;background:#f3f4f6;padding:.15rem .5rem;border-radius:4px;">${c.code}</span></div>
          <div class="emeta">👤 ${c.instructor} &nbsp;&nbsp; 💺 ${c.availableSeats} seats left</div>
        </div>
        <div class="time-chip">🕐 ${c.time}</div>
      </div>`;
  }).join('');
}

function renderRecommendations(allCourses, myRegs) {
  const container = document.getElementById('rec-list');
  const registeredIds = new Set(myRegs.map(r => r.courseId?._id));

  // Find AI-related registered courses
  const aiReg = myRegs.filter(r =>
    r.courseId && r.courseId.name.toLowerCase().includes('ai') ||
    (r.courseId && r.courseId.name.toLowerCase().includes('artificial intelligence'))
  );

  if (!aiReg.length) {
    container.innerHTML = `
      <div style="background:#fff;border:2px solid var(--border);border-radius:12px;padding:2rem;text-align:center;color:var(--muted);">
        <div style="font-size:2.5rem;margin-bottom:.5rem;">🤖</div>
        <p>Register for an AI-related course to unlock smart recommendations.</p>
      </div>`;
    return;
  }

  const recs = allCourses.filter(c =>
    !registeredIds.has(c._id) &&
    (c.name.toLowerCase().includes('machine learning') || c.name.toLowerCase().includes('data science'))
  );

  if (!recs.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:.9rem;">No new recommendations right now — you\'re on top of it! 🎯</div>';
    return;
  }

  container.innerHTML = `
    <div class="rec-badge">🤖 AI Recommendations</div>
    ${recs.map(c => `
      <div class="rec-card">
        <div class="rec-name">${c.name}</div>
        <div class="rec-code">${c.code} &bull; ${c.instructor} &bull; ${c.time}</div>
      </div>
    `).join('')}`;
}

// =============================================
// ADMIN PANEL
// =============================================

const isAdminPage = document.getElementById('pane-stats');

if (isAdminPage) {
  const user = requireAuth('admin');
  if (user) initAdmin();
}

async function initAdmin() {
  await loadAdminStats();
  await loadAdminCourses();
}

async function loadAdminStats() {
  const res = await fetch('/api/admin/stats');
  if (!res.ok) return;
  const data = await res.json();

  document.getElementById('s-students').textContent = data.totalStudents;
  document.getElementById('s-courses').textContent = data.totalCourses;
  document.getElementById('s-regs').textContent = data.totalRegistrations;

  const tbody = document.getElementById('stats-table');
  if (!data.courseStats.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No courses yet.</td></tr>';
    return;
  }
  tbody.innerHTML = data.courseStats.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td><span class="badge badge-blue">${c.code}</span></td>
      <td>${c.instructor}</td>
      <td>${c.time}</td>
      <td><span class="badge badge-green">${c.enrolled}</span></td>
      <td>${c.availableSeats > 0
        ? `<span class="badge badge-green">${c.availableSeats} left</span>`
        : '<span class="badge badge-red">Full</span>'}</td>
    </tr>`).join('');
}

async function loadAdminCourses() {
  const res = await fetch('/api/courses');
  const courses = await res.json();

  document.getElementById('admin-course-count').textContent = courses.length + ' total';

  const tbody = document.getElementById('courses-table');
  if (!courses.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">No courses yet.</td></tr>';
    return;
  }
  tbody.innerHTML = courses.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td><span class="badge badge-blue">${c.code}</span></td>
      <td>${c.instructor}</td>
      <td>${c.time}</td>
      <td>${c.availableSeats} / ${c.maxSeats}</td>
      <td>${c.availableSeats > 0
        ? '<span class="badge badge-green">Open</span>'
        : '<span class="badge badge-red">Full</span>'}</td>
      <td>
        <button class="view-btn" onclick="viewStudents('${c._id}', '${c.name}')">View</button>
        <button class="delete-btn" onclick="deleteCourse('${c._id}')">Delete</button>
      </td>
    </tr>`).join('');
}

async function addCourse() {
  const name = document.getElementById('c-name').value.trim();
  const code = document.getElementById('c-code').value.trim();
  const instructor = document.getElementById('c-instructor').value.trim();
  const time = document.getElementById('c-time').value.trim();
  const maxSeats = document.getElementById('c-seats').value.trim();

  if (!name || !code || !instructor || !time || !maxSeats) {
    return showAlert('All fields are required', 'error');
  }

  const res = await fetch('/api/addCourse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, code, instructor, time, maxSeats })
  });
  const data = await res.json();

  if (!res.ok) return showAlert(data.error, 'error');

  showAlert('✓ Course added successfully!', 'success');
  ['c-name','c-code','c-instructor','c-time','c-seats'].forEach(id => document.getElementById(id).value = '');
  await loadAdminStats();
  await loadAdminCourses();
}

async function deleteCourse(id) {
  if (!confirm('Delete this course? All registrations will be removed.')) return;
  const res = await fetch('/api/course/' + id, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) return showAlert(data.error, 'error');
  showAlert('Course deleted.', 'success');
  await loadAdminStats();
  await loadAdminCourses();
}

async function viewStudents(courseId, courseName) {
  const res = await fetch('/api/courseStudents/' + courseId);
  const regs = await res.json();

  document.getElementById('modal-title').textContent = `Students — ${courseName}`;
  const body = document.getElementById('modal-body');

  if (!regs.length) {
    body.innerHTML = '<p style="color:var(--muted);text-align:center;padding:1.5rem;">No students enrolled yet.</p>';
  } else {
    body.innerHTML = regs.map(r => {
      const u = r.userId;
      if (!u) return '';
      const initials = u.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
      return `
        <div class="student-row">
          <div class="avatar">${initials}</div>
          <div>
            <div class="student-name">${u.name}</div>
            <div class="student-email">${u.email}</div>
          </div>
        </div>`;
    }).join('');
  }

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}