// Medicita - JS Core (localStorage-based)
// Este archivo contiene toda la lógica del sistema en JavaScript.
// No necesitas instalar nada: todo se guarda en el navegador (localStorage).
// Las funciones están agrupadas por temas: utilidades, autenticación, navegación, y CRUD de datos.

// ---------- Utilities ----------
// Constantes con las claves usadas en el almacenamiento del navegador
const LS_KEYS = {
  users: 'med_users',
  session: 'med_session',
  patients: 'med_patients',
  doctors: 'med_doctors',
  citas: 'med_citas',
  historial: 'med_historial'
};

function readLS(key, fallback) {
  // Lee y convierte a objeto lo que haya guardado con la clave dada
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeLS(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function genId(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString().slice(-4); }

// ---------- Seed defaults ----------
function seedDefaults() {
  // Crea datos de ejemplo al inicio (usuarios y doctores) si no existen aún
  // Esto permite entrar y probar el sistema de inmediato
  // Usuarios por defecto: admin/admin, doctor/doctor, recep/recep
  // Doctores de ejemplo para poder asignarlos a pacientes/citas
  // Seed roles and default admin if empty
  const users = readLS(LS_KEYS.users, []);
  if (!users.length) {
    users.push(
      { id: genId('usr'), nombre: 'Admin', usuario: 'admin', password: 'admin', rol: 'Administrador' },
      { id: genId('usr'), nombre: 'Dra. Demo', usuario: 'doctor', password: 'doctor', rol: 'Doctor' },
      { id: genId('usr'), nombre: 'Recep Demo', usuario: 'recep', password: 'recep', rol: 'Recepcionista' }
    );
    writeLS(LS_KEYS.users, users);
  }
  // Seed doctors to allow selection initially
  const doctors = readLS(LS_KEYS.doctors, []);
  if (!doctors.length) {
    doctors.push(
      { id: genId('doc'), nombre: 'Dra. Sofía Pérez', especialidad: 'Medicina General', telefono: '999-111-2222', correo: 'sofia@clinic.com', horario: 'L-V 9:00-17:00' },
      { id: genId('doc'), nombre: 'Dr. Luis García', especialidad: 'Pediatría', telefono: '999-333-4444', correo: 'luis@clinic.com', horario: 'L-V 10:00-16:00' }
    );
    writeLS(LS_KEYS.doctors, doctors);
  }
}

// ---------- Auth ----------
function getSession() { return readLS(LS_KEYS.session, null); }
// Guarda en memoria quién está logueado actualmente
function setSession(user) { writeLS(LS_KEYS.session, user ? { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol } : null); }

function registerUser({ nombre, usuario, password, rol }) {
  const users = readLS(LS_KEYS.users, []);
  if (users.some(u => u.usuario.toLowerCase() === usuario.toLowerCase())) {
    return { success: false, message: 'El usuario ya existe' };
  }
  const newUser = { id: genId('usr'), nombre, usuario, password, rol };
  users.push(newUser);
  writeLS(LS_KEYS.users, users);
  return { success: true, user: newUser };
}

function login(usuario, password) {
  // Verifica credenciales: busca un usuario con nombre y contraseña iguales
  const users = readLS(LS_KEYS.users, []);
  const user = users.find(u => u.usuario === usuario && u.password === password);
  if (!user) return { success: false, message: 'Usuario o contraseña incorrectos' };
  setSession(user);
  return { success: true, user };
}

function logout() { setSession(null); window.location.href = 'index.html'; }

function requireAuth(roles = null) {
  // Protege las pantallas: si no hay sesión, manda al login;
  // si hay sesión pero el rol no tiene permiso, lo redirige a una pantalla permitida.
  const session = getSession();
  if (!session) { window.location.replace('index.html'); return; }
  if (roles && !roles.includes(session.rol)) {
    // basic guard: redirect to allowed default
    if (session.rol === 'Doctor') window.location.replace('historial.html');
    else if (session.rol === 'Recepcionista') window.location.replace('citas.html');
    else window.location.replace('pacientes.html');
  }
}

// ---------- Navbar ----------
function renderNavbar(active = '') {
  // Dibuja la barra superior con enlaces visibles según el rol del usuario
  const session = getSession();
  const el = document.getElementById('navbar');
  if (!el) return;
  const links = [
    { href: 'pacientes.html', label: 'Pacientes', roles: ['Administrador','Recepcionista'] },
    { href: 'doctores.html', label: 'Doctores', roles: ['Administrador'] },
    { href: 'citas.html', label: 'Citas', roles: ['Administrador','Recepcionista'] },
    { href: 'historial.html', label: 'Historial', roles: ['Administrador','Doctor'] },
  ];
  const navLinks = links
    .filter(l => !session || l.roles.includes(session.rol))
    .map(l => `<a href="${l.href}" class="${active === l.label ? 'active' : ''}">${l.label}</a>`) 
    .join('');
  el.innerHTML = `
    <nav class="navbar">
      <div class="brand">Medicita</div>
      ${navLinks}
      <div class="spacer"></div>
      <div class="muted">${session ? session.nombre + ' (' + session.rol + ')' : ''}</div>
      <button class="btn" onclick="logout()">Cerrar sesión</button>
    </nav>
  `;
}

// ---------- Validators ----------
// Teléfono internacional: acepta números locales (por ej. 9999-9999) y formato con código de país (+)
// Permite 7 a 15 dígitos (E.164) tras limpiar separadores.
function isPhoneIntl(v) {
  if (!v) return false;
  const s = String(v).trim();
  if (!s) return false;
  let t = s.replace(/[\s().-]/g, '');
  if (t.startsWith('+')) {
    t = t.slice(1);
    return /^\d{8,15}$/.test(t);
  }
  return /^\d{7,15}$/.test(t);
}
// Email más estricto: requiere dominio y TLD de 2 a 24 letras
function isEmail(v) {
  if (!v) return false;
  return /^[^\s@]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}$/.test(v);
}
// Valida horarios en formato: "L-V 09:00-17:00" o "S 08:00-12:00, D 09:00-13:00"
function validateSchedule(str) {
  if (!str || !str.trim()) return { valid: false, message: 'Ingrese un horario (ej: L-V 09:00-17:00)' };
  const segments = str.split(',').map(s => s.trim()).filter(Boolean);
  const re = /^([LMXJVSD](?:\s*-\s*[LMXJVSD])?)\s+((?:[01]\d|2[0-3]):[0-5]\d)\s*-\s*((?:[01]\d|2[0-3]):[0-5]\d)$/;
  const toMin = (hm) => { const [h,m] = hm.split(':').map(Number); return h*60+m; };
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const m = seg.match(re);
    if (!m) return { valid: false, message: `Formato inválido en tramo ${i+1}. Ej: L-V 09:00-17:00` };
    const start = toMin(m[2]), end = toMin(m[3]);
    if (start >= end) return { valid: false, message: `Rango horario inválido en tramo ${i+1} (inicio debe ser menor que fin)` };
  }
  return { valid: true };
}

// ---------- Doctors CRUD ----------
function getDoctors() { return readLS(LS_KEYS.doctors, []); }
function saveDoctors(list) { writeLS(LS_KEYS.doctors, list); }

// Guarda o actualiza un doctor cuando se envía el formulario
function handleDoctorSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('doctorId').value;
  const nombre = document.getElementById('dNombre').value.trim();
  const especialidad = document.getElementById('dEspecialidad').value.trim();
  const telefono = document.getElementById('dTelefono').value.trim();
  const correo = document.getElementById('dCorreo').value.trim();
  const horario = document.getElementById('dHorario').value.trim();

  const fb = document.getElementById('doctorFeedback');
  if (!isPhoneIntl(telefono)) { fb.textContent = 'Teléfono inválido. Ej: 9999-9999 o +1 202-555-0123'; fb.classList.add('show'); return; }
  if (!isEmail(correo)) { fb.textContent = 'Correo inválido'; fb.classList.add('show'); return; }
  const sch = validateSchedule(horario);
  if (!sch.valid) { fb.textContent = sch.message; fb.classList.add('show'); return; }

  const list = getDoctors();
  if (id) {
    const idx = list.findIndex(d => d.id === id);
    if (idx >= 0) list[idx] = { id, nombre, especialidad, telefono, correo, horario };
  } else {
    list.push({ id: genId('doc'), nombre, especialidad, telefono, correo, horario });
  }
  saveDoctors(list);
  resetDoctorForm();
  renderDoctors();
}

function resetDoctorForm() {
  document.getElementById('doctorForm').reset();
  document.getElementById('doctorId').value = '';
  document.getElementById('doctorFeedback').textContent = '';
}

function renderDoctors() {
  const tbody = document.querySelector('#doctorsTable tbody');
  const q = (document.getElementById('doctorSearch')?.value || '').toLowerCase();
  const list = getDoctors().filter(d => d.nombre.toLowerCase().includes(q) || d.especialidad.toLowerCase().includes(q));
  tbody.innerHTML = list.map(d => `
    <tr>
      <td>${d.id}</td>
      <td>${d.nombre}</td>
      <td>${d.especialidad}</td>
      <td>${d.telefono}</td>
      <td>${d.correo}</td>
      <td>${d.horario}</td>
      <td>
        <button class="btn" data-action="edit" data-id="${d.id}">Editar</button>
        <button class="btn danger" data-action="del" data-id="${d.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// Maneja los botones Editar/Eliminar en la tabla de doctores
function onDoctorsTableClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');
  const list = getDoctors();
  const item = list.find(d => d.id === id);
  if (action === 'edit' && item) {
    document.getElementById('doctorId').value = item.id;
    document.getElementById('dNombre').value = item.nombre;
    document.getElementById('dEspecialidad').value = item.especialidad;
    document.getElementById('dTelefono').value = item.telefono;
    document.getElementById('dCorreo').value = item.correo;
    document.getElementById('dHorario').value = item.horario;
  } else if (action === 'del') {
    if (confirm('¿Eliminar doctor?')) {
      saveDoctors(list.filter(d => d.id !== id));
      renderDoctors();
    }
  }
}

function populateDoctorOptions(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const list = getDoctors();
  sel.innerHTML = '<option value="">Seleccione...</option>' + list.map(d => `<option value="${d.id}">${d.nombre} (${d.especialidad})</option>`).join('');
}

// ---------- Patients CRUD ----------
function getPatients() { return readLS(LS_KEYS.patients, []); }
function savePatients(list) { writeLS(LS_KEYS.patients, list); }

// Guarda o actualiza un paciente cuando se envía el formulario
function handlePatientSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('patientId').value;
  const nombre = document.getElementById('pNombre').value.trim();
  const edad = parseInt(document.getElementById('pEdad').value, 10);
  const sexo = document.getElementById('pSexo').value;
  const telefono = document.getElementById('pTelefono').value.trim();
  const direccion = document.getElementById('pDireccion').value.trim();
  const medicoId = document.getElementById('pMedico').value;

  const fb = document.getElementById('patientFeedback');
  if (!isPhoneIntl(telefono)) { fb.textContent = 'Teléfono inválido. Ej: 9999-9999 o +1 202-555-0123'; fb.classList.add('show'); return; }

  const list = getPatients();
  const medico = getDoctors().find(d => d.id === medicoId);
  const medicoNombre = medico ? medico.nombre : '';
  if (id) {
    const idx = list.findIndex(p => p.id === id);
    if (idx >= 0) list[idx] = { id, nombre, edad, sexo, telefono, direccion, medicoId, medicoNombre };
  } else {
    list.push({ id: genId('pac'), nombre, edad, sexo, telefono, direccion, medicoId, medicoNombre });
  }
  savePatients(list);
  resetPatientForm();
  renderPatients();
}

function resetPatientForm() {
  document.getElementById('patientForm').reset();
  document.getElementById('patientId').value = '';
  document.getElementById('patientFeedback').textContent = '';
}

function renderPatients() {
  const tbody = document.querySelector('#patientsTable tbody');
  const q = (document.getElementById('patientSearch')?.value || '').toLowerCase();
  const list = getPatients().filter(p =>
    p.nombre.toLowerCase().includes(q) ||
    p.id.toLowerCase().includes(q)
  );
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.nombre}</td>
      <td>${p.edad}</td>
      <td>${p.sexo}</td>
      <td>${p.telefono}</td>
      <td>${p.direccion}</td>
      <td>${p.medicoNombre || ''}</td>
      <td>
        <button class="btn" data-action="edit" data-id="${p.id}">Editar</button>
        <button class="btn danger" data-action="del" data-id="${p.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// Maneja los botones Editar/Eliminar en la tabla de pacientes
function onPatientsTableClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');
  const list = getPatients();
  const item = list.find(p => p.id === id);
  if (action === 'edit' && item) {
    document.getElementById('patientId').value = item.id;
    document.getElementById('pNombre').value = item.nombre;
    document.getElementById('pEdad').value = item.edad;
    document.getElementById('pSexo').value = item.sexo;
    document.getElementById('pTelefono').value = item.telefono;
    document.getElementById('pDireccion').value = item.direccion;
    document.getElementById('pMedico').value = item.medicoId || '';
  } else if (action === 'del') {
    if (confirm('¿Eliminar paciente?')) {
      savePatients(list.filter(p => p.id !== id));
      renderPatients();
    }
  }
}

function populatePatientOptions(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const list = getPatients();
  sel.innerHTML = '<option value="">Seleccione...</option>' + list.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
}

// ---------- Citas CRUD ----------
function getCitas() { return readLS(LS_KEYS.citas, []); }
function saveCitas(list) { writeLS(LS_KEYS.citas, list); }

// Guarda o actualiza una cita cuando se envía el formulario
function handleCitaSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('citaId').value;
  const pacienteId = document.getElementById('cPaciente').value;
  const doctorId = document.getElementById('cDoctor').value;
  const fecha = document.getElementById('cFecha').value;
  const motivo = document.getElementById('cMotivo').value.trim();
  const estado = document.getElementById('cEstado').value;

  const fb = document.getElementById('citaFeedback');
  if (!pacienteId || !doctorId) { fb.textContent = 'Seleccione paciente y doctor'; fb.classList.add('show'); return; }
  if (!fecha) { fb.textContent = 'Seleccione fecha'; fb.classList.add('show'); return; }

  const list = getCitas();
  const paciente = getPatients().find(p => p.id === pacienteId);
  const doctor = getDoctors().find(d => d.id === doctorId);
  const pacienteNombre = paciente ? paciente.nombre : '';
  const doctorNombre = doctor ? doctor.nombre : '';

  if (id) {
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) list[idx] = { id, pacienteId, pacienteNombre, doctorId, doctorNombre, fecha, motivo, estado };
  } else {
    // simple overlap check: same doctor & datetime
    const overlap = list.some(c => c.doctorId === doctorId && c.fecha === fecha && c.estado !== 'Cancelada');
    if (overlap) { fb.textContent = 'Ya existe una cita para ese doctor en la misma fecha y hora'; fb.classList.add('show'); return; }
    list.push({ id: genId('cit'), pacienteId, pacienteNombre, doctorId, doctorNombre, fecha, motivo, estado });
  }
  saveCitas(list);
  resetCitaForm();
  renderCitas();
}

function resetCitaForm() {
  document.getElementById('appointmentForm').reset();
  document.getElementById('citaId').value = '';
  document.getElementById('citaFeedback').textContent = '';
}

function renderCitas() {
  const tbody = document.querySelector('#citasTable tbody');
  const q = (document.getElementById('citaSearch')?.value || '').toLowerCase();
  const list = getCitas().filter(c => c.pacienteNombre.toLowerCase().includes(q) || c.doctorNombre.toLowerCase().includes(q));
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.pacienteNombre}</td>
      <td>${c.doctorNombre}</td>
      <td>${formatDateTime(c.fecha)}</td>
      <td>${c.motivo}</td>
      <td>${c.estado}</td>
      <td>
        <button class="btn" data-action="edit" data-id="${c.id}">Editar</button>
        <button class="btn danger" data-action="del" data-id="${c.id}">Cancelar</button>
      </td>
    </tr>
  `).join('');
}

// Maneja los botones Editar/Cancelar en la tabla de citas
function onCitasTableClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');
  const list = getCitas();
  const item = list.find(c => c.id === id);
  if (action === 'edit' && item) {
    document.getElementById('citaId').value = item.id;
    document.getElementById('cPaciente').value = item.pacienteId;
    document.getElementById('cDoctor').value = item.doctorId;
    document.getElementById('cFecha').value = item.fecha;
    document.getElementById('cMotivo').value = item.motivo;
    document.getElementById('cEstado').value = item.estado;
  } else if (action === 'del') {
    if (confirm('¿Cancelar cita?')) {
      saveCitas(list.map(c => c.id === id ? { ...c, estado: 'Cancelada' } : c));
      renderCitas();
    }
  }
}

// ---------- Historial CRUD ----------
function getHistorial() { return readLS(LS_KEYS.historial, []); }
function saveHistorial(list) { writeLS(LS_KEYS.historial, list); }

// Guarda o actualiza un registro de historial médico cuando se envía el formulario
function handleHistSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('hId').value;
  const pacienteId = document.getElementById('hPaciente').value;
  const doctorId = document.getElementById('hDoctor').value;
  const fecha = document.getElementById('hFecha').value;
  const diagnostico = document.getElementById('hDiagnostico').value.trim();
  const medicamentos = document.getElementById('hMedicamentos').value.trim();
  const observaciones = document.getElementById('hObservaciones').value.trim();

  const fb = document.getElementById('histFeedback');
  if (!pacienteId || !doctorId) { fb.textContent = 'Seleccione paciente y doctor'; fb.classList.add('show'); return; }
  if (!fecha) { fb.textContent = 'Seleccione fecha'; fb.classList.add('show'); return; }

  const list = getHistorial();
  const paciente = getPatients().find(p => p.id === pacienteId);
  const doctor = getDoctors().find(d => d.id === doctorId);
  const pacienteNombre = paciente ? paciente.nombre : '';
  const doctorNombre = doctor ? doctor.nombre : '';

  if (id) {
    const idx = list.findIndex(h => h.id === id);
    if (idx >= 0) list[idx] = { id, pacienteId, pacienteNombre, doctorId, doctorNombre, fecha, diagnostico, medicamentos, observaciones };
  } else {
    list.push({ id: genId('his'), pacienteId, pacienteNombre, doctorId, doctorNombre, fecha, diagnostico, medicamentos, observaciones });
  }
  saveHistorial(list);
  resetHistForm();
  renderHistorial();
}

function resetHistForm() {
  document.getElementById('historyForm').reset();
  document.getElementById('hId').value = '';
  document.getElementById('histFeedback').textContent = '';
}

function renderHistorial() {
  const tbody = document.querySelector('#histTable tbody');
  const q = (document.getElementById('histSearch')?.value || '').toLowerCase();
  const list = getHistorial().filter(h => h.pacienteNombre.toLowerCase().includes(q) || h.doctorNombre.toLowerCase().includes(q));
  tbody.innerHTML = list.map(h => `
    <tr>
      <td>${h.id}</td>
      <td>${h.pacienteNombre}</td>
      <td>${h.doctorNombre}</td>
      <td>${formatDate(h.fecha)}</td>
      <td>${h.diagnostico}</td>
      <td>${h.medicamentos}</td>
      <td>${h.observaciones}</td>
      <td>
        <button class="btn" data-action="edit" data-id="${h.id}">Editar</button>
        <button class="btn danger" data-action="del" data-id="${h.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// Maneja los botones Editar/Eliminar en la tabla de historial
function onHistTableClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');
  const list = getHistorial();
  const item = list.find(h => h.id === id);
  if (action === 'edit' && item) {
    document.getElementById('hId').value = item.id;
    document.getElementById('hPaciente').value = item.pacienteId;
    document.getElementById('hDoctor').value = item.doctorId;
    document.getElementById('hFecha').value = item.fecha;
    document.getElementById('hDiagnostico').value = item.diagnostico;
    document.getElementById('hMedicamentos').value = item.medicamentos;
    document.getElementById('hObservaciones').value = item.observaciones;
  } else if (action === 'del') {
    if (confirm('¿Eliminar registro?')) {
      saveHistorial(list.filter(h => h.id !== id));
      renderHistorial();
    }
  }
}

// ---------- Format helpers ----------
function pad(n){ return n.toString().padStart(2,'0'); }
function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}
