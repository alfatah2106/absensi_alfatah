// --- KONFIGURASI API ---
const GAS_API_URL = "https://neon-api.miqdad-alfatah.workers.dev/api";

// State Global
let rawData = {
    mapel: [], absensi: [], students: [], nilai: [],
    ref_kelas: [], ref_ujian: []
};



// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.innerText = new Date().toLocaleDateString('id-ID', options);

    // Default Dates
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // Tab Guru, Siswa & Slip Dates
    ['guru', 'filter', 'slip'].forEach(prefix => {
        const endInput = document.getElementById(`${prefix}-end-date`);
        const startInput = document.getElementById(`${prefix}-start-date`);
        if (endInput) endInput.value = todayStr;
        if (startInput) startInput.value = todayStr; // Keduanya hari ini (WIB sesuai device user)
    });

    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchAllData);

    fetchAllData();
});

// --- FETCH DATA ---
async function fetchAllData() {
    updateStatus('loading');
    const loader = document.getElementById('guru-loader');
    const container = document.getElementById('guru-data-container');
    if (loader) loader.classList.remove('hidden');
    if (container) container.classList.add('hidden');

    try {
        const [resOptions, resAbsensi, resStudents] = await Promise.all([
            fetch(`${GAS_API_URL}?action=get_options`),
            fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'admin_load_table', table: 'absensi' }) }),
            fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'admin_load_table', table: 'students' }) })
        ]);

        const dataOptions = await resOptions.json();
        rawData.absensi = await resAbsensi.json();
        const dataStudents = await resStudents.json();

        rawData.mapel = dataOptions.mapel || [];
        rawData.ref_kelas = dataOptions.kelas || [];
        rawData.ref_ujian = dataOptions.ujian || [];
        rawData.students = dataStudents || [];
        rawData.absensi = Array.isArray(rawData.absensi) ? rawData.absensi : [];

        console.log("Data Loaded. Absensi Rows:", rawData.absensi.length);

        populateDropdowns();
        if (typeof filterGuru === 'function') filterGuru();
        updateStatus('online');

    } catch (error) {
        console.error("Fetch Error:", error);
        updateStatus('error');
    } finally {
        if (loader) loader.classList.add('hidden');
        if (container) container.classList.remove('hidden');
    }
}

function populateDropdowns() {
    // 1. Dropdown Kelas
    const kelasSelect = document.getElementById('filter-kelas-select');
    if (kelasSelect) {
        kelasSelect.innerHTML = '<option value="">-- Semua Kelas --</option>';
        if (rawData.ref_kelas) {
            rawData.ref_kelas.forEach(k => kelasSelect.innerHTML += `<option value="${k.nama_kelas}">${k.nama_kelas}</option>`);
        }
    }

    // 2. Dropdown Ujian
    const ujianSelect = document.getElementById('filter-ujian-select');
    if (ujianSelect) {
        ujianSelect.innerHTML = `
            <option value="">-- Pilih Jenis Nilai --</option>
            <option value="Nilai Harian" class="font-bold text-indigo-700 bg-indigo-50">★ Rata-rata Nilai Harian</option>
        `;
        if (rawData.ref_ujian) {
            rawData.ref_ujian.forEach(u => ujianSelect.innerHTML += `<option value="${u.jenis_ujian}">${u.jenis_ujian}</option>`);
        }
    }

    // 3. Dropdown Slip Guru
    const slipSelect = document.getElementById('slip-email-select');
    if (slipSelect && rawData.absensi) {
        const uniqueEmails = [...new Set(rawData.absensi.map(item => item.email_guru).filter(email => email))];
        uniqueEmails.sort();
        slipSelect.innerHTML = '<option value="">-- Pilih Guru --</option>';
        uniqueEmails.forEach(email => {
            slipSelect.innerHTML += `<option value="${email}">${email}</option>`;
        });
    }
}

// --- UTILS ---
function updateStatus(status) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    if (status === 'loading') {
        el.innerHTML = `<div class="loader" style="width:10px;height:10px;border-width:2px;"></div> Syncing...`;
        el.className = "px-2 py-1 bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1";
    } else if (status === 'online') {
        el.innerHTML = `<div class="w-2 h-2 rounded-full bg-emerald-500"></div> Online`;
        el.className = "px-2 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1";
    } else {
        el.innerHTML = `<div class="w-2 h-2 rounded-full bg-rose-500"></div> Error`;
        el.className = "px-2 py-1 bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1";
    }
}

function switchMainTab(tabName) {
    ['guru', 'siswa', 'slip'].forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const content = document.getElementById(`content-${t}`);
        if (btn && content) {
            if (t === tabName) {
                btn.classList.replace('tab-inactive', 'tab-active');
                content.classList.remove('hidden');
            } else {
                btn.classList.replace('tab-active', 'tab-inactive');
                content.classList.add('hidden');
            }
        }
    });
}
