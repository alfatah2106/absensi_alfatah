let dbStudents = [];
let allJurnalData = [];
let mapelOptions = [];
let ujianOptions = [];
let kelasOptions = [];
let userEmail = "";

window.onload = () => {
    checkExistingSession();
    initGoogleAuth();
    lucide.createIcons();
    fetchOptions();
    fetchData();
};

function checkExistingSession() {
    const savedUser = localStorage.getItem('school_user');
    if (savedUser) applyUserData(JSON.parse(savedUser));
}

function applyUserData(data) {
    userEmail = data.email;
    document.getElementById('user-display').innerText = data.email;
    document.getElementById('user-name').innerText = data.name;
    document.getElementById('user-photo').src = data.picture;
    document.getElementById('user-photo').classList.remove('hidden');
    document.getElementById('welcome-msg').innerText = `Halo, ${data.given_name || data.name.split(' ')[0]}!`;
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('main-app').classList.remove('blur-sm', 'pointer-events-none');
}

function initGoogleAuth() {
    try {
        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleAuthResponse });
        google.accounts.id.renderButton(document.getElementById("google-btn-container"), { theme: "outline", size: "large", width: 250 });
    } catch (e) { console.error("Auth failed"); }
}

function handleAuthResponse(response) {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    localStorage.setItem('school_user', JSON.stringify(payload));
    applyUserData(payload);
    showNotify('success', `Berhasil Login!`);
}

function logout() { localStorage.removeItem('school_user'); location.reload(); }

async function fetchOptions() {
    try {
        const res = await fetch(`${GAS_API_URL}/api?action=get_options`);
        const data = await res.json();

        if (data.mapel) mapelOptions = data.mapel;
        if (data.ujian) ujianOptions = data.ujian;
        if (data.kelas) kelasOptions = data.kelas;

        populateFilters();
    } catch (e) {
        console.error("Gagal memuat options", e);
        showNotify('error', 'Gagal memuat daftar mapel/kelas.');
    }
}

async function fetchData() {
    showLoader(true);
    try {
        // PERBAIKAN: Hanya fetch database siswa, JURNAL DI-FETCH NANTI SAAT TAB DIBUKA
        const res = await fetch(`${GAS_API_URL}/api?action=get_db`);
        dbStudents = await res.json();

        if(kelasOptions.length === 0) populateFilters();
    } catch (e) { showNotify('error', 'Gagal memuat data siswa.'); }
    finally { showLoader(false); }
}

function populateFilters() {
    const kelasTargets = ['absensi-kelas', 'nilai-kelas', 'filter-jurnal-kelas'];
    kelasTargets.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const firstOpt = el.options[0] ? el.options[0].text : "-- Pilih --";
            el.innerHTML = `<option value="">${firstOpt}</option>`;

            let sources = [];
            if (kelasOptions.length > 0) {
                sources = kelasOptions.map(k => k.nama_kelas);
            } else {
                sources = [...new Set(dbStudents.map(s => s.kelas))].filter(Boolean).sort();
            }
            sources.forEach(c => el.add(new Option(c, c)));
        }
    });

    const mapelTargets = ['absensi-mapel', 'nilai-mapel', 'filter-jurnal-mapel'];
    mapelTargets.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const firstOpt = el.options[0] ? el.options[0].text : "-- Pilih --";
            el.innerHTML = `<option value="">${firstOpt}</option>`;
            if (mapelOptions.length > 0) {
                mapelOptions.forEach(m => el.add(new Option(m.nama_mapel, m.nama_mapel)));
            }
        }
    });

    const examEl = document.getElementById('nilai-ujian');
    if (examEl) {
        examEl.innerHTML = `<option value="">-- Pilih Jenis --</option>`;
        if (ujianOptions.length > 0) {
            ujianOptions.forEach(u => examEl.add(new Option(u.jenis_ujian, u.jenis_ujian)));
        }
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden-tab'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden-tab');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active-tab-btn');
        if(btn.dataset.tab === tabId) btn.classList.add('active-tab-btn');
    });

    // PERBAIKAN: Fetch Jurnal hanya jika tab dibuka
    if(tabId === 'jurnal') fetchJurnalData();
    if(tabId === 'nilai') loadSiswaNilai();
}

// --- ABSENSI ---

function applyDefaultNilaiAbsensi(val) {
    if(!val) return;
    document.querySelectorAll('.nilai-absensi-input').forEach(el => {
        el.value = val;
        el.parentElement.classList.add('ring-2', 'ring-blue-300');
        setTimeout(() => el.parentElement.classList.remove('ring-2', 'ring-blue-300'), 500);
    });
}

function loadSiswaAbsensi() {
    const kelas = document.getElementById('absensi-kelas').value;
    const container = document.getElementById('absensi-list');
    if(!kelas) { container.innerHTML = ''; return; }

    const filtered = dbStudents.filter(s => s.kelas === kelas);
    filtered.sort((a,b) => a.nama.localeCompare(b.nama));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-gray-500 italic bg-gray-50 rounded-lg">Tidak ada siswa di kelas ini.</div>';
        return;
    }

    container.innerHTML = filtered.map((s, idx) => `
        <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 transition-all hover:border-blue-400" data-nisn="${s.nisn || ''}">
            <div class="flex items-center gap-4 w-full md:w-auto">
                <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100">${idx+1}</div>
                <div>
                    <div class="font-bold text-gray-800 nama-siswa">${s.nama}</div>
                    <div class="text-xs text-gray-400 font-mono">${s.nisn}</div>
                </div>
            </div>

            <div class="flex items-center gap-3 w-full md:w-auto justify-end">
                <select class="status-select p-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none w-24">
                    <option value="H">Hadir</option>
                    <option value="S">Sakit</option>
                    <option value="I">Izin</option>
                    <option value="A">Alpha</option>
                </select>

                <select class="nilai-absensi-input w-20 p-2 border border-gray-300 rounded-lg text-center font-bold text-gray-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="100" class="text-emerald-600">100</option>
                    <option value="90" class="text-emerald-600">90</option>
                    <option value="80" class="text-blue-600">80</option>
                    <option value="70" class="text-amber-600">70</option>
                    <option value="50" class="text-red-500">50</option>
                    <option value="0" class="text-red-700">0</option>
                </select>
            </div>
        </div>
    `).join('');

    if (!document.getElementById('btn-save-absensi')) {
        const btn = document.createElement('button');
        btn.id = 'btn-save-absensi';
        btn.className = "fixed bottom-6 right-6 bg-blue-600 text-white px-8 py-3 rounded-full shadow-xl font-bold hover:bg-blue-700 z-20 transition-transform active:scale-95 flex items-center gap-2";
        btn.innerHTML = `<i data-lucide="save"></i> Simpan Absensi`;
        btn.onclick = saveAbsensi;
        container.appendChild(btn);
        lucide.createIcons();
    }
}

async function saveAbsensi() {
    const mapel = document.getElementById('absensi-mapel').value;
    const materi = document.getElementById('absensi-materi').value;
    const selectedJams = Array.from(document.querySelectorAll('.jam-checkbox:checked')).map(cb => cb.value);

    if(!mapel) return showNotify('error', 'Pilih Mata Pelajaran!');
    if(!materi) return showNotify('error', 'Materi wajib diisi!');
    if(selectedJams.length === 0) return showNotify('error', 'Pilih minimal satu jam pelajaran!');

    showLoader(true);
    const rows = [];
    const cards = document.querySelectorAll('#absensi-list > div[data-nisn]');
    const todayWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    cards.forEach(card => {
        const nisn = card.dataset.nisn;
        const nama = card.querySelector('.nama-siswa').innerText;
        const status = card.querySelector('.status-select').value;
        const nilai = card.querySelector('.nilai-absensi-input').value;

        rows.push({
            nisn, nama,
            kehadiran: status,
            nilaiHarian: parseInt(nilai),
            materi: materi,
            jam: selectedJams.join(','),
            email: userEmail,
            tanggal: todayWIB,
            kelas: document.getElementById('absensi-kelas').value,
            mapel: mapel
        });
    });

    try {
        await fetch(`${GAS_API_URL}/api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_absensi', rows })
        });
        showNotify('success', 'Data absensi tersimpan!');

        document.getElementById('absensi-materi').value = '';
        document.getElementById('absensi-kelas').value = '';
        document.getElementById('absensi-mapel').value = '';
        document.getElementById('absensi-list').innerHTML = '';
        document.querySelectorAll('.jam-checkbox').forEach(cb => cb.checked = false);

    } catch (e) {
        showNotify('error', 'Gagal menyimpan.');
    } finally {
        showLoader(false);
    }
}

// --- LOGIC NILAI ---

function loadSiswaNilai() {
    const kelas = document.getElementById('nilai-kelas').value;
    const container = document.getElementById('nilai-list-container');
    const tableCard = document.getElementById('nilai-table-card');

    // PERBAIKAN: Sembunyikan card jika belum pilih kelas
    if(!kelas) {
        tableCard.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    const filtered = dbStudents.filter(s => s.kelas === kelas);
    filtered.sort((a, b) => a.nama.localeCompare(b.nama));

    if (filtered.length === 0) {
        tableCard.classList.remove('hidden');
        container.innerHTML = '<tr><td colspan="3" class="p-10 text-center text-gray-400 italic">Tidak ada siswa di kelas ini.</td></tr>';
        return;
    }

    // Tampilkan Card
    tableCard.classList.remove('hidden');

    // PERBAIKAN: Hapus kolom NISN di render
    container.innerHTML = filtered.map((s, index) => `
        <tr class="hover:bg-emerald-50/30 transition-colors group border-b border-gray-50 last:border-0" data-nisn="${s.nisn}">
            <td class="p-4 text-center text-gray-500 font-medium">${index + 1}</td>
            <td class="p-4">
                <div class="font-bold text-gray-800 nama-siswa">${s.nama}</div>
            </td>
            <!-- Kolom NISN Dihapus -->
            <td class="p-4 text-center">
                <input
                    type="number"
                    class="nilai-val w-24 p-2.5 border border-gray-300 rounded-lg text-center font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder-gray-300 mx-auto block"
                    placeholder="0"
                    min="0"
                    max="100"
                >
            </td>
        </tr>
    `).join('');
}

async function saveNilai() {
    const mapel = document.getElementById('nilai-mapel').value;
    const ujian = document.getElementById('nilai-ujian').value;
    const kelas = document.getElementById('nilai-kelas').value;

    if(!mapel || !ujian || !kelas) return showNotify('error', 'Lengkapi data Kelas, Mapel, dan Jenis Ujian!');

    showLoader(true);
    const todayWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    const rows = document.querySelectorAll('#nilai-list-container > tr[data-nisn]');
    const dataRows = Array.from(rows).map(row => {
        const val = row.querySelector('.nilai-val').value;
        if (val === "" || val === null) return null;

        return {
            nisn: row.dataset.nisn,
            nama: row.querySelector('.nama-siswa').innerText,
            nilai: parseInt(val),
            jenis_ujian: ujian,
            email: userEmail,
            tanggal: todayWIB,
            kelas, mapel
        };
    }).filter(r => r !== null);

    if(dataRows.length === 0) {
        showLoader(false);
        return showNotify('info', 'Isi minimal satu nilai siswa sebelum menyimpan.');
    }

    try {
        await fetch(`${GAS_API_URL}/api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_nilai', rows: dataRows })
        });
        showNotify('success', `Berhasil menyimpan ${dataRows.length} nilai siswa!`);

        // Reset Form Nilai
        document.getElementById('nilai-kelas').value = '';
        document.getElementById('nilai-mapel').value = '';
        document.getElementById('nilai-ujian').value = '';
        document.getElementById('nilai-table-card').classList.add('hidden'); // Sembunyikan lagi cardnya

    } catch(e) { showNotify('error', 'Gagal menyimpan nilai.'); }
    finally { showLoader(false); }
}

// --- JURNAL ---

async function fetchJurnalData() {
    const kSelect = document.getElementById('filter-jurnal-kelas');
    const mSelect = document.getElementById('filter-jurnal-mapel');
    if(kSelect) kSelect.value = "";
    if(mSelect) mSelect.value = "";

    const tbody = document.getElementById('jurnal-table-body');
    tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-400">Memuat data...</td></tr>';
    try {
        const res = await fetch(`${GAS_API_URL}/api?action=get_journal`);
        let rawData = await res.json();
        rawData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

        const uniqueDataMap = new Map();
        rawData.forEach(item => {
            const key = `${item.tanggal}-${item.kelas}-${item.mapel}`;
            if (!uniqueDataMap.has(key)) {
                uniqueDataMap.set(key, item);
            }
        });

        allJurnalData = Array.from(uniqueDataMap.values());
        renderJurnalTable();
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-red-500">Gagal mengambil riwayat.</td></tr>';
    }
}

function renderJurnalTable() {
    const tbody = document.getElementById('jurnal-table-body');
    const fKelas = document.getElementById('filter-jurnal-kelas').value;
    const fMapel = document.getElementById('filter-jurnal-mapel').value;

    const filtered = allJurnalData.filter(item => {
        const matchK = fKelas === "" || item.kelas === fKelas;
        const matchM = fMapel === "" || item.mapel === fMapel;
        return matchK && matchM;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-400 italic">Data tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(j => `
        <tr class="text-sm hover:bg-amber-50/50 transition-colors border-b border-gray-50 last:border-0">
            <td class="p-4 text-gray-500 font-mono">${formatTanggalIndo(j.tanggal)}</td>
            <td class="p-4 font-bold text-gray-800">${j.kelas}</td>
            <td class="p-4 text-blue-600 font-medium">${j.mapel}</td>
            <td class="p-4 text-gray-600 italic">${j.materi || '-'}</td>
        </tr>
    `).join('');
}

function formatTanggalIndo(dateString) {
    const opsi = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' };
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toLocaleDateString('id-ID', opsi);
}

function showNotify(type, msg) {
    const container = document.getElementById('notification-container');
    const el = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-emerald-500' : (type === 'error' ? 'bg-red-500' : 'bg-blue-500');
    const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');

    el.className = `p-4 mb-2 rounded-xl shadow-lg text-white font-medium flex items-center gap-3 transform translate-x-10 opacity-0 transition-all duration-300 ${bgColor}`;
    el.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i> <span>${msg}</span>`;

    container.appendChild(el);
    lucide.createIcons();

    requestAnimationFrame(() => el.classList.remove('translate-x-10', 'opacity-0'));
    setTimeout(() => {
        el.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

function showLoader(show) { document.getElementById('global-loader').classList.toggle('hidden', !show); }
