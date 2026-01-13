let dbStudents = [];
let allJurnalData = [];
let mapelOptions = [];
let ujianOptions = [];
let kelasOptions = [];
let userEmail = "";

window.onload = () => {
    checkExistingSession();
    initGoogleAuth();
    if (typeof lucide !== 'undefined') lucide.createIcons();
    fetchOptions();
    fetchData();
};

function switchTab(tabName) {
    ['absensi', 'nilai', 'jurnal'].forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        const btn = document.getElementById(`tab-${t}`);
        btn.classList.remove('tab-active');
        btn.classList.add('tab-inactive');
    });
    document.getElementById(`content-${tabName}`).classList.remove('hidden');
    const activeBtn = document.getElementById(`tab-${tabName}`);
    activeBtn.classList.remove('tab-inactive');
    activeBtn.classList.add('tab-active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function fetchOptions() {
    try {
        const res = await fetch(`${GAS_API_URL}/api?action=get_options`);
        const data = await res.json();
        if (data.mapel) mapelOptions = data.mapel;
        if (data.ujian) ujianOptions = data.ujian;
        if (data.kelas) kelasOptions = data.kelas;
        populateAllDropdowns();
    } catch (e) { console.error("Gagal load options", e); }
}

function populateAllDropdowns() {
    // Dropdown Mapel
    const mapelTargets = ['absensiMapel', 'nilaiMapel', 'filterMapelJurnal'];
    mapelTargets.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const defaultText = el.options[0].text;
        el.innerHTML = `<option value="">${defaultText}</option>`;
        mapelOptions.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.nama_mapel;
            opt.textContent = m.nama_mapel;
            el.appendChild(opt);
        });
    });

    // Dropdown Jenis Ujian
    const elUjian = document.getElementById('nilaiJenis');
    if(elUjian) {
        elUjian.innerHTML = `<option value="">-- Pilih Jenis --</option>`;
        ujianOptions.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.jenis_ujian;
            opt.textContent = u.jenis_ujian;
            elUjian.appendChild(opt);
        });
    }

    // Dropdown KELAS
    const kelasTargets = ['absensiKelas', 'nilaiKelas', 'filterKelasJurnal'];
    kelasTargets.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        // PENTING: Mengambil teks default dari HTML (yang sudah kita ubah jadi 'Pilih Kelas')
        const defaultText = el.options[0].text;
        el.innerHTML = `<option value="">${defaultText}</option>`;

        kelasOptions.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k.nama_kelas;
            opt.textContent = k.nama_kelas;
            el.appendChild(opt);
        });
    });
}

async function fetchData() {
    toggleLoader(true);
    try {
        const [resDb, resJurnal] = await Promise.all([
            fetch(`${GAS_API_URL}/api?action=get_db`),
            fetch(`${GAS_API_URL}/api?action=get_journal`)
        ]);

        dbStudents = await resDb.json();
        allJurnalData = await resJurnal.json();

        renderJurnalTable();
    } catch (error) {
        console.error("Fetch Error:", error);
        showNotify('error', 'Gagal terhubung ke server');
    } finally {
        toggleLoader(false);
    }
}

// --- LOGIC JURNAL YANG DIPERBARUI ---

function renderJurnalTable() {
    const tbody = document.getElementById('jurnal-table-body');
    const fKelas = document.getElementById('filterKelasJurnal').value;
    const fMapel = document.getElementById('filterMapelJurnal').value;

    if (!tbody) return;

    // 1. Filter dasar berdasarkan dropdown
    const filtered = allJurnalData.filter(item => {
        const matchK = fKelas === "" || item.kelas === fKelas;
        const matchM = fMapel === "" || item.mapel === fMapel;
        return matchK && matchM;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400 italic">Tidak ada riwayat jurnal.</td></tr>';
        return;
    }

    // 2. LOGIC UNIQUE GROUPING
    // Kita kelompokkan data agar tidak berulang per siswa.
    // Kunci unik: Tanggal + Kelas + Mapel + Jam + Materi
    const uniqueJournal = [];
    const seen = new Set();

    filtered.forEach(item => {
        // Buat key unik
        const key = `${item.tanggal}-${item.kelas}-${item.mapel}-${item.jam}-${item.materi}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueJournal.push(item);
        }
    });

    // 3. Render Tabel (Tanpa Tombol Aksi)
    tbody.innerHTML = uniqueJournal.map(j => `
        <tr class="hover:bg-blue-50 transition-colors border-b">
            <!-- Format Tanggal Baru: Selasa, 13 Jan -->
            <td class="p-3 text-gray-500 whitespace-nowrap capitalize">${formatDate(j.tanggal)}</td>

            <td class="p-3">
                <span class="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">${j.kelas}</span>
            </td>

            <td class="p-3 font-medium text-gray-700">${j.mapel}</td>

            <td class="p-3 text-gray-600 text-sm italic truncate max-w-[200px]">${j.materi || '-'}</td>

            <td class="p-3 text-center text-gray-500 text-sm">${j.jam || '-'}</td>
        </tr>
    `).join('');
}

// --- FUNGSI FORMAT TANGGAL BARU ---
function formatDate(dateString) {
    if(!dateString) return '-';
    const d = new Date(dateString);
    // Format: Selasa, 13 Jan
    return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short'
    });
}

// --- SISA KODE LOGIC LAINNYA (ABSENSI & NILAI) TETAP SAMA ---

function loadAbsensiList() {
    const kelas = document.getElementById('absensiKelas').value;
    const container = document.getElementById('absensi-list-container');
    const placeholder = document.getElementById('absensi-placeholder');
    const tbody = document.getElementById('tbody-absensi');

    if (!kelas) {
        container.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }
    const siswaKelas = dbStudents.filter(s => s.kelas === kelas);
    if (siswaKelas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Belum ada data siswa di kelas ${kelas}</td></tr>`;
    } else {
        tbody.innerHTML = siswaKelas.map((s, index) => `
            <tr class="hover:bg-gray-50 border-b last:border-0 group">
                <td class="p-3 text-center text-gray-500">${index + 1}</td>
                <td class="p-3">
                    <div class="font-bold text-gray-800">${s.nama}</div>
                    <div class="text-xs text-gray-400">${s.nisn}</div>
                    <input type="hidden" name="nisn_${index}" value="${s.nisn}">
                    <input type="hidden" name="nama_${index}" value="${s.nama}">
                </td>
                <td class="p-3">
                    <div class="flex justify-center gap-2">
                        <label class="cursor-pointer flex flex-col items-center">
                            <input type="radio" name="status_${index}" value="Hadir" checked class="peer sr-only"><span class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 peer-checked:bg-green-500 peer-checked:text-white flex items-center justify-center font-bold text-xs transition-all">H</span>
                        </label>
                        <label class="cursor-pointer flex flex-col items-center">
                            <input type="radio" name="status_${index}" value="Sakit" class="peer sr-only"><span class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 peer-checked:bg-yellow-500 peer-checked:text-white flex items-center justify-center font-bold text-xs transition-all">S</span>
                        </label>
                        <label class="cursor-pointer flex flex-col items-center">
                            <input type="radio" name="status_${index}" value="Izin" class="peer sr-only"><span class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 peer-checked:bg-blue-500 peer-checked:text-white flex items-center justify-center font-bold text-xs transition-all">I</span>
                        </label>
                        <label class="cursor-pointer flex flex-col items-center">
                            <input type="radio" name="status_${index}" value="Alpha" class="peer sr-only"><span class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 peer-checked:bg-red-500 peer-checked:text-white flex items-center justify-center font-bold text-xs transition-all">A</span>
                        </label>
                    </div>
                </td>
                <td class="p-3">
                    <input type="number" name="nilai_${index}" value="100" class="w-full p-1.5 border rounded text-center text-sm focus:ring-1 focus:ring-blue-500">
                </td>
            </tr>
        `).join('');
    }
    container.classList.remove('hidden');
    placeholder.classList.add('hidden');
}

async function submitBatchAbsensi() {
    const kelas = document.getElementById('absensiKelas').value;
    const mapel = document.getElementById('absensiMapel').value;
    const materi = document.getElementById('absensiMateri').value;
    const jam = document.getElementById('absensiJam').value;

    if (!kelas || !mapel) { showNotify('error', 'Mohon pilih Kelas dan Mata Pelajaran'); return; }

    const tbody = document.getElementById('tbody-absensi');
    const rows = tbody.querySelectorAll('tr');
    const payloadData = [];

    rows.forEach((row, index) => {
        const nisn = row.querySelector(`input[name="nisn_${index}"]`).value;
        const nama = row.querySelector(`input[name="nama_${index}"]`).value;
        const status = row.querySelector(`input[name="status_${index}"]:checked`).value;
        const nilai = row.querySelector(`input[name="nilai_${index}"]`).value;

        payloadData.push({
            nisn: nisn, nama: nama, kelas: kelas, kehadiran: status,
            nilaiHarian: parseInt(nilai) || 0, mapel: mapel, materi: materi,
            jam: jam, tanggal: new Date().toISOString().split('T')[0], email: userEmail
        });
    });

    if (payloadData.length === 0) return;
    toggleLoader(true);
    const btn = document.getElementById('btnSubmitAbsensi');
    btn.disabled = true; btn.innerHTML = 'Menyimpan...';

    try {
        const res = await fetch(`${GAS_API_URL}/api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_absensi', rows: payloadData })
        });
        const result = await res.json();
        if (result.status === 'success') {
            showNotify('success', `Absensi berhasil disimpan.`);
            resetAllForms();
            fetchData();
        } else { showNotify('error', 'Gagal: ' + result.message); }
    } catch (e) { showNotify('error', 'Terjadi kesalahan sistem'); }
    finally {
        toggleLoader(false);
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Simpan Absensi';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function loadNilaiList() {
    const kelas = document.getElementById('nilaiKelas').value;
    const jenisUjian = document.getElementById('nilaiJenis').value;
    const container = document.getElementById('nilai-list-container');
    const placeholder = document.getElementById('nilai-placeholder');
    const tbody = document.getElementById('tbody-nilai');

    if (!kelas || !jenisUjian) {
        container.classList.add('hidden');
        placeholder.classList.remove('hidden');
        return;
    }
    const siswaKelas = dbStudents.filter(s => s.kelas === kelas);
    if (siswaKelas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500">Belum ada siswa di kelas ${kelas}</td></tr>`;
    } else {
        tbody.innerHTML = siswaKelas.map((s, index) => `
            <tr class="hover:bg-gray-50 border-b last:border-0">
                <td class="p-3 text-center text-gray-500">${index + 1}</td>
                <td class="p-3">
                    <div class="font-bold text-gray-800">${s.nama}</div>
                    <div class="text-xs text-gray-400">${s.nisn}</div>
                    <input type="hidden" name="n_nisn_${index}" value="${s.nisn}">
                    <input type="hidden" name="n_nama_${index}" value="${s.nama}">
                </td>
                <td class="p-3 text-center">
                    <input type="number" name="n_nilai_${index}" placeholder="0-100" class="w-24 p-2 border rounded text-center focus:ring-2 focus:ring-indigo-500 font-bold text-gray-700">
                </td>
            </tr>
        `).join('');
    }
    container.classList.remove('hidden');
    placeholder.classList.add('hidden');
}

async function submitBatchNilai() {
    const kelas = document.getElementById('nilaiKelas').value;
    const mapel = document.getElementById('nilaiMapel').value;
    const jenisUjian = document.getElementById('nilaiJenis').value;

    if (!kelas || !mapel || !jenisUjian) { showNotify('error', 'Lengkapi Kelas, Mapel, dan Jenis Ujian'); return; }

    const tbody = document.getElementById('tbody-nilai');
    const rows = tbody.querySelectorAll('tr');
    const payloadData = [];

    rows.forEach((row, index) => {
        const nisn = row.querySelector(`input[name="n_nisn_${index}"]`).value;
        const nama = row.querySelector(`input[name="n_nama_${index}"]`).value;
        const nilai = row.querySelector(`input[name="n_nilai_${index}"]`).value;
        if (nilai !== "") {
            payloadData.push({
                nisn: nisn, nama: nama, kelas: kelas, mapel: mapel,
                jenis_ujian: jenisUjian, nilai: parseInt(nilai), email: userEmail
            });
        }
    });

    if (payloadData.length === 0) { showNotify('error', 'Belum ada nilai yang diinput'); return; }
    toggleLoader(true);
    const btn = document.getElementById('btnSubmitNilai');
    btn.disabled = true; btn.innerHTML = 'Menyimpan...';

    try {
        const res = await fetch(`${GAS_API_URL}/api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_nilai', rows: payloadData })
        });
        const result = await res.json();
        if (result.status === 'success') {
            showNotify('success', `Berhasil menyimpan nilai untuk ${payloadData.length} siswa.`);
            resetAllForms();
        } else { showNotify('error', 'Gagal: ' + result.message); }
    } catch (e) { console.error(e); showNotify('error', 'Terjadi kesalahan koneksi.'); }
    finally {
        toggleLoader(false);
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Simpan Nilai';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function resetAllForms() {
    document.getElementById('absensiKelas').value = "";
    document.getElementById('absensiMapel').value = "";
    document.getElementById('absensiMateri').value = "";
    document.getElementById('absensiJam').value = "";
    document.getElementById('absensi-list-container').classList.add('hidden');
    document.getElementById('absensi-placeholder').classList.remove('hidden');

    document.getElementById('nilaiKelas').value = "";
    document.getElementById('nilaiMapel').value = "";
    const elJenis = document.getElementById('nilaiJenis');
    if(elJenis) elJenis.value = "";
    document.getElementById('nilai-list-container').classList.add('hidden');
    document.getElementById('nilai-placeholder').classList.remove('hidden');
}

// Auth & Utils
function checkExistingSession() {
    const savedUser = localStorage.getItem('school_user');
    if (savedUser) applyUserData(JSON.parse(savedUser));
}
function applyUserData(data) {
    userEmail = data.email;
    document.getElementById('user-name').innerText = data.name;
    const photo = document.getElementById('user-photo');
    photo.src = data.picture;
    photo.classList.remove('hidden');
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('main-app').classList.remove('blur-sm', 'pointer-events-none');
}
function initGoogleAuth() {
    try {
        if(typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleAuthResponse });
            const btn = document.getElementById("google-btn-container");
            if(btn) google.accounts.id.renderButton(btn, { theme: "outline", size: "large" });
        }
    } catch (e) { console.error("Google Auth Error", e); }
}
function handleAuthResponse(res) {
    const data = parseJwt(res.credential);
    localStorage.setItem('school_user', JSON.stringify(data));
    applyUserData(data);
}
function parseJwt(token) {
    try {
        return JSON.parse(decodeURIComponent(window.atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    } catch (e) { return {}; }
}
function logout() { localStorage.removeItem('school_user'); location.reload(); }
function toggleLoader(show) {
    const loader = document.getElementById('global-loader');
    if(show) loader.classList.remove('hidden'); else loader.classList.add('hidden');
}
function showNotify(type, msg) {
    const container = document.getElementById('notification-container');
    const div = document.createElement('div');
    div.className = `p-4 rounded-lg shadow-lg text-white text-sm font-medium animate-bounce-in ${type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`;
    div.innerHTML = msg;
    container.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}
async function deleteData(id) {
    // Fungsi ini tidak lagi digunakan di Jurnal View, tapi dibiarkan jika dibutuhkan di tempat lain
    if (!confirm('Hapus data ini?')) return;
    toggleLoader(true);
    try {
        const res = await fetch(`${GAS_API_URL}/api`, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete_data', id: id })
        });
        const result = await res.json();
        if (result.status === 'success') { showNotify('success', 'Data dihapus'); fetchData(); }
        else { showNotify('error', 'Gagal menghapus'); }
    } catch (e) { showNotify('error', 'Koneksi error'); }
    finally { toggleLoader(false); }
}

window.logout = logout;
window.switchTab = switchTab;
window.loadAbsensiList = loadAbsensiList;
window.submitBatchAbsensi = submitBatchAbsensi;
window.renderJurnalTable = renderJurnalTable;
window.deleteData = deleteData;
window.fetchData = fetchData;
window.loadNilaiList = loadNilaiList;
window.submitBatchNilai = submitBatchNilai;
