// 관리자용 클라이언트 헬퍼 (index.html과 같은 페이지에서 로드되어야 함)
// 전제: index.html에서 supabaseClient, initializeStableOptions(), refreshReadAndSelRemaining(),
// populateFormFromPayload(), updateSummaryLine() 등이 정의되어 있어야 합니다.

let __admin_currentRegistrationId = null;
let __admin_currentStudentId = null;

document.addEventListener('DOMContentLoaded', () => {
  const loadBtn = document.getElementById('loadRegBtn');
  const saveBtn = document.getElementById('saveAdminBtn');

  if (loadBtn) loadBtn.addEventListener('click', handleLoadRegistration);
  if (saveBtn) saveBtn.addEventListener('click', handleSaveAsAdmin);

  if (typeof initializeStableOptions === 'function') initializeStableOptions();
});

async function handleLoadRegistration() {
  const studentIdInput = document.getElementById('adminStudentId')?.value?.trim();
  const cls = document.getElementById('cls')?.value?.trim();
  const name = document.getElementById('name')?.value?.trim();

  let studentId = null;
  if (studentIdInput) {
    studentId = Number(studentIdInput);
    if (!studentId) { alert('올바른 학생 ID를 입력하세요.'); return; }
  } else {
    if (!cls || !name) { alert('학생 ID를 입력하거나, 반과 이름을 입력하세요.'); return; }
    const { data: sdata, error: serr } = await supabaseClient
      .from('students')
      .select('student_id')
      .eq('class', cls)
      .eq('name', name)
      .limit(1)
      .maybeSingle();
    if (serr) { console.error('students lookup error', serr); alert('학생 조회 중 오류'); return; }
    if (!sdata) { alert('학생을 찾을 수 없습니다. 반/이름을 확인하세요.'); return; }
    studentId = sdata.student_id;
  }

  const { data, error } = await supabaseClient
    .from('registrations')
    .select('*')
    .eq('student_id', studentId)
    .limit(1)
    .maybeSingle();

  if (error) { console.error('registrations fetch error', error); alert('신청 불러오기 실패'); return; }
  if (!data || !data.payload) {
    alert('저장된 신청이 없습니다.');
    __admin_currentRegistrationId = data ? data.registration_id : null;
    __admin_currentStudentId = studentId;
    return;
  }

  __admin_currentRegistrationId = data.registration_id;
  __admin_currentStudentId = studentId;

  try {
    populateFormFromPayload(data.payload);
    alert('신청을 불러왔습니다. 폼을 확인하세요.');
  } catch (err) {
    console.error('populate error', err);
    alert('폼 채우기 중 오류가 발생했습니다.');
  }
}

function populateFormFromPayload(payload) {
  if (!payload) return;

  if (Array.isArray(payload.reads)) {
    document.querySelectorAll('.read').forEach(sel => { try { sel.value = ''; } catch(e){} });
    payload.reads.forEach(r => {
      if (!r || !r.day || !r.period) return;
      const sel = Array.from(document.querySelectorAll('.read')).find(s => s.dataset.day === r.day && String(s.dataset.period) === String(r.period));
      if (sel) {
        const value = r.value || '';
        if (![...sel.options].some(o => (o.value && o.value.trim()) === value.trim())) {
          const opt = document.createElement('option'); opt.value = value; opt.text = value; sel.appendChild(opt);
        }
        sel.value = value;
      }
    });
  }

  if (Array.isArray(payload.movies)) {
    document.querySelectorAll('.mov').forEach(cb => cb.checked = false);
    payload.movies.forEach(m => {
      const cb = Array.from(document.querySelectorAll('.mov')).find(x => x.dataset.day === m.day && String(x.dataset.start) === String(m.start));
      if (cb) cb.checked = true;
    });
  }

  if (Array.isArray(payload.lou)) {
    document.querySelectorAll('.lou').forEach(cb => cb.checked = false);
    payload.lou.forEach(l => {
      const cb = Array.from(document.querySelectorAll('.lou')).find(x => x.dataset.day === l.day && String(x.dataset.period) === String(l.period));
      if (cb) cb.checked = true;
    });
  }

  if (Array.isArray(payload.bible)) {
    document.querySelectorAll('.bible').forEach(cb => cb.checked = false);
    payload.bible.forEach(b => {
      const cb = Array.from(document.querySelectorAll('.bible')).find(x => x.dataset.day === b.day && String(x.dataset.period) === String(b.period));
      if (cb) cb.checked = true;
    });
  }

  if (payload.sels && typeof payload.sels === 'object') {
    Object.entries(payload.sels).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (![...el.options].some(o => (o.value && o.value.trim()) === (val || '').trim())) {
        const opt = document.createElement('option'); opt.value = val; opt.text = val; el.appendChild(opt);
      }
      el.value = val;
    });
  }

  if (typeof initializeStableOptions === 'function') initializeStableOptions();
  if (typeof refreshReadAndSelRemaining === 'function') refreshReadAndSelRemaining();
  if (typeof updateSummaryLine === 'function') updateSummaryLine();
}

async function handleSaveAsAdmin() {
  if (!__admin_currentStudentId) {
    const cls = document.getElementById('cls')?.value?.trim();
    const name = document.getElementById('name')?.value?.trim();
    if (!cls || !name) { alert('저장하려면 먼저 학생을 불러오거나, 반/이름을 입력하세요.'); return; }
    const { data: sdata, error: serr } = await supabaseClient
      .from('students')
      .select('student_id')
      .eq('class', cls)
      .eq('name', name)
      .limit(1)
      .maybeSingle();
    if (serr) { console.error('students lookup error', serr); alert('학생 조회 중 오류'); return; }
    if (!sdata) { alert('학생을 찾을 수 없습니다.'); return; }
    __admin_currentStudentId = sdata.student_id;
  }

  const adminId = document.getElementById('adminId')?.value?.trim() || 'admin';

  const payload = {
    reads: Array.from(document.querySelectorAll('.read')).map(s => {
      const idx = s.selectedIndex; if (idx < 0) return null;
      const opt = s.options[idx]; const isPlaceholder = opt && opt.dataset && opt.dataset.placeholder === '1';
      const val = opt && opt.value ? String(opt.value).trim() : '';
      if (!isPlaceholder && val !== '') return { day: s.dataset.day, period: Number(s.dataset.period), value: val };
      return null;
    }).filter(Boolean),
    movies: Array.from(document.querySelectorAll('.mov:checked')).map(cb => ({ day: cb.dataset.day, start: Number(cb.dataset.start) })),
    lou: Array.from(document.querySelectorAll('.lou:checked')).map(cb => ({ day: cb.dataset.day, period: Number(cb.dataset.period) })),
    bible: Array.from(document.querySelectorAll('.bible:checked')).map(cb => ({ day: cb.dataset.day, period: Number(cb.dataset.period) })),
    sels: {}
  };
  ['sel-0126','sel-0127','sel-0128','sel-0129','sel-0202'].forEach(id => {
    const el = document.getElementById(id);
    if (el && (el.value && String(el.value).trim())) payload.sels[id] = String(el.value).trim();
  });

  try {
    const rpcRes = await supabaseClient.rpc('admin_upsert_registration', {
      p_student_id: __admin_currentStudentId,
      p_payload: payload,
      p_admin: adminId
    });

    if (rpcRes.error) {
      console.warn('RPC failed, doing fallback upsert', rpcRes.error);
      const fallback = await fallbackUpsertRegistration(__admin_currentStudentId, payload, adminId);
      if (fallback.error) { console.error('fallback upsert failed', fallback.error); alert('저장 실패'); }
      else alert('관리자 저장 성공 (fallback)');
    } else {
      alert('관리자 저장 성공 (RPC)');
    }
  } catch (err) {
    console.error('admin save error', err);
    const fallback = await fallbackUpsertRegistration(__admin_currentStudentId, payload, adminId);
    if (fallback.error) { console.error('fallback upsert failed', fallback.error); alert('저장 실패'); }
    else alert('관리자 저장 성공 (fallback)');
  }

  if (typeof refreshReadAndSelRemaining === 'function') refreshReadAndSelRemaining();
}

async function fallbackUpsertRegistration(studentId, payload, adminId) {
  if (!studentId) return { error: { message: 'studentId required' } };
  try {
    const body = { student_id: studentId, payload: payload, updated_by: adminId };
    const { data, error } = await supabaseClient
      .from('registrations')
      .upsert(body, { onConflict: 'student_id' });
    return { data, error };
  } catch (err) {
    return { error: err };
  }
}