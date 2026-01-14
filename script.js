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

        // Data sudah terurut by ID dari server (index.ts)
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
        const res = await fetch(`${GAS_API_URL}/api?action=get_db`);
        dbStudents = await res.json();
        // Fallback populate jika options gagal/kosong, tapi dipanggil terpisah agar tidak race condition
        if(kelasOptions.length === 0) populateFilters();
    } catch (e) { showNotify('error', 'Gagal memuat data siswa.'); }
    finally { showLoader(false); }
}

function populateFilters() {
    // 1. Populate Kelas (Server-Side Ordered)
    const kelasTargets = ['absensi-kelas', 'nilai-kelas', 'filter-jurnal-kelas'];
    kelasTargets.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const firstOpt = el.options[0] ? el.options[0].text : "-- Pilih --";
            el.innerHTML = `<option value="">${firstOpt}</option>`;

            let sources = [];
            if (kelasOptions.length > 0) {
                // Langsung map saja, urutan sudah dijamin oleh API (ORDER BY id ASC)
                sources = kelasOptions.map(k => k.nama_kelas);
            } else {
                // Fallback: Ambil dari data siswa jika tabel referensi kosong
                sources = [...new Set(dbStudents.map(s => s.kelas))].filter(Boolean).sort();
            }
            sources.forEach(c => el.add(new Option(c, c)));
        }
    });

    // 2. Populate Mapel (Server-Side Ordered)
    const mapelTargets = ['absensi-mapel', 'nilai-mapel', 'filter-jurnal-mapel'];
    mapelTargets.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            const firstOpt = el.options[0] ? el.options[0].text : "-- Pilih --";
            el.innerHTML = `<option value="">${firstOpt}</option>`;

            // Langsung map, urutan sesuai ID dari server
            if (mapelOptions.length > 0) {
                mapelOptions.forEach(m => el.add(new Option(m.nama_mapel, m.nama_mapel)));
            }
        }
    });

    // 3. Populate Jenis Ujian (Server-Side Ordered)
    const examEl = document.getElementById('nilai-ujian');
    if (examEl) {
        examEl.innerHTML = `<option value="">- Jenis Ujian -</option>`;
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
    if(tabId === 'jurnal') fetchJurnalData();
}

function loadSiswaAbsensi() {
    const kelas = document.getElementById('absensi-kelas').value;
    const container = document.getElementById('absensi-list');
    if(!kelas) { container.innerHTML = ''; return; }

    const filtered = dbStudents.filter(s => s.kelas === kelas);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-gray-500">Tidak ada siswa di kelas ini.</div>';
        return;
    }

    container.innerHTML = filtered.map(s => `
        <div class="bg-white p-4 rounded-lg shadow-sm border flex justify-between items-center" data-nisn="${s.nisn || ''}">
            <div>
                <div class="font-bold text-gray-800">${s.nama}</div>
                <div class="text-xs text-gray-500">Kelas: ${s.kelas}</div>
            </div>
            <div class="flex space-x-2">
                <select class="p-1 border rounded text-sm status-select bg-gray-50">
                    <option value="H">Hadir</option>
                    <option value="S">Sakit</option>
                    <option value="I">Izin</option>
                    <option value="A">Alpha</option>
                </select>
                <input type="number" value="100" class="w-16 p-1 border rounded text-center nilai-input focus:ring-1 ring-blue-400 outline-none">
            </div>
        </div>
    `).join('');

    if (!document.getElementById('btn-save-absensi')) {
        const btn = document.createElement('button');
        btn.id = 'btn-save-absensi';
        btn.className = "fixed bottom-6 right-6 bg-blue-600 text-white px-8 py-3 rounded-full shadow-xl font-bold hover:bg-blue-700 z-20 transition-transform active:scale-95";
        btn.innerText = "Simpan Absensi";
        btn.onclick = saveAbsensi;
        container.appendChild(btn);
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
        const nama = card.querySelector('.font-bold').innerText;
        const status = card.querySelector('.status-select').value;
        const nilai = card.querySelector('.nilai-input').value;

        rows.push({
            nisn, nama,
            kehadiran: status,
            nilaiHarian: nilai,
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
        switchTab('dashboard');

        document.getElementById('absensi-kelas').value = '';
        document.getElementById('absensi-mapel').value = '';
        document.getElementById('absensi-list').innerHTML = '';
        document.getElementById('absensi-materi').value = '';
        document.querySelectorAll('.jam-checkbox').forEach(cb => cb.checked = false);
    } catch (e) {
        showNotify('error', 'Gagal menyimpan.');
    } finally {
        showLoader(false);
    }
}

function loadSiswaNilai() {
    const kelas = document.getElementById('nilai-kelas').value;
    const container = document.getElementById('nilai-list');
    if(!kelas) { container.innerHTML = ''; return; }

    const filtered = dbStudents.filter(s => s.kelas === kelas);
    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center p-4 text-gray-500">Tidak ada siswa di kelas ini.</div>';
        return;
    }

    container.innerHTML = filtered.map(s => `
        <div class="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center" data-nisn="${s.nisn}">
            <div class="font-bold text-gray-800">${s.nama}</div>
            <input type="number" placeholder="Nilai" class="w-24 p-2 border rounded-lg text-center nilai-val outline-none focus:ring-2 ring-purple-300">
        </div>
    `).join('') + `<button onclick="saveNilai()" class="w-full mt-6 bg-purple-600 text-white py-4 rounded-xl font-bold">Simpan Nilai</button>`;
}

async function saveNilai() {
    const mapel = document.getElementById('nilai-mapel').value;
    const ujian = document.getElementById('nilai-ujian').value;
    const kelas = document.getElementById('nilai-kelas').value;
    if(!mapel || !ujian || !kelas) return showNotify('error', 'Lengkapi data kelas, mapel, dan ujian!');

    showLoader(true);
    const todayWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

    const rows = document.querySelectorAll('#nilai-list > div[data-nisn]');
    const dataRows = Array.from(rows).map(card => {
        const val = card.querySelector('.nilai-val').value;
        return val ? {
            nisn: card.dataset.nisn,
            nama: card.querySelector('.font-bold').innerText,
            nilai: val, jenisUjian: ujian, email: userEmail,
            tanggal: todayWIB,
            kelas, mapel
        } : null;
    }).filter(r => r !== null);

    if(dataRows.length === 0) { showLoader(false); return showNotify('error', 'Isi minimal satu nilai!'); }

    try {
        await fetch(`${GAS_API_URL}/api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_nilai', rows: dataRows })
        });
        showNotify('success', 'Nilai Tersimpan!');
        document.getElementById('nilai-kelas').value = '';
        document.getElementById('nilai-mapel').value = '';
        document.getElementById('nilai-ujian').value = '';
        document.getElementById('nilai-list').innerHTML = '';
        switchTab('dashboard');
    } catch(e) { showNotify('error', 'Gagal menyimpan nilai.'); }
    finally { showLoader(false); }
}

async function fetchJurnalData() {
    const kSelect = document.getElementById('filter-jurnal-kelas');
    const mSelect = document.getElementById('filter-jurnal-mapel');
    if(kSelect) kSelect.value = "";
    if(mSelect) mSelect.value = "";

    const tbody = document.getElementById('jurnal-table-body');
    tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center">Memuat data...</td></tr>';
    try {
        const res = await fetch(`${GAS_API_URL}/api?action=get_journal`);
        let rawData = await res.json();

        // 1. SORTING: Pastikan data terurut dari Terbaru ke Terlama (Descending)
        // Kita menggunakan Date constructor untuk membandingkan.
        rawData.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

        // 2. DEDUPLIKASI: Hapus duplikat berdasarkan key
        // Karena data sudah disort terbaru di atas, map akan menyimpan data yang pertama ditemukan (yaitu yang terbaru).
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

// Format Tanggal dengan Paksaan TimeZone WIB (Asia/Jakarta)
function formatTanggalIndo(dateString) {
    const opsi = {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric', // Menambahkan tahun agar lebih jelas
        timeZone: 'Asia/Jakarta' // WAJIB: Memastikan waktu dibaca sebagai WIB
    };
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toLocaleDateString('id-ID', opsi);
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
        tbody.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-gray-400">Data tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(j => `
        <tr class="text-sm hover:bg-gray-50 transition-colors">
            <td class="p-4 text-gray-500">${formatTanggalIndo(j.tanggal)}</td>
            <td class="p-4 font-bold text-gray-800">${j.kelas}</td>
            <td class="p-4 text-blue-600 font-medium">${j.mapel}</td>
            <td class="p-4 text-gray-600 italic">${j.materi || '-'}</td>
        </tr>
    `).join('');
}

function showNotify(type, msg) {
    const container = document.getElementById('notification-container');
    const el = document.createElement('div');
    el.className = `p-4 mb-2 rounded-xl shadow-lg text-white font-medium ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
    el.innerText = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function showLoader(show) { document.getElementById('global-loader').classList.toggle('hidden', !show); }
