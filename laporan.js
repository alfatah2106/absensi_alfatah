// --- KONFIGURASI API ---
const GAS_API_URL = "https://neon-api2.miqdad-alfatah.workers.dev/api";

// State Global
let rawData = {
    mapel: [], absensi: [], students: [], nilai: [],
    ref_kelas: [], ref_ujian: []
};

let currentFilterGuru = 'bulan';

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateEl = document.getElementById('currentDate');
    if(dateEl) dateEl.innerText = new Date().toLocaleDateString('id-ID', options);

    // Default Dates
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    // Tab Siswa & Slip Dates
    ['filter', 'slip'].forEach(prefix => {
        const endInput = document.getElementById(`${prefix}-end-date`);
        const startInput = document.getElementById(`${prefix}-start-date`);
        if(endInput) endInput.valueAsDate = today;
        if(startInput) startInput.valueAsDate = firstDay;
    });

    const refreshBtn = document.getElementById('btn-refresh');
    if(refreshBtn) refreshBtn.addEventListener('click', fetchAllData);

    fetchAllData();
});

// --- 1. FETCH DATA ---
async function fetchAllData() {
    updateStatus('loading');
    const loader = document.getElementById('guru-loader');
    const container = document.getElementById('guru-data-container');
    if(loader) loader.classList.remove('hidden');
    if(container) container.classList.add('hidden');

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
        filterGuru(currentFilterGuru);
        updateStatus('online');

    } catch (error) {
        console.error("Fetch Error:", error);
        updateStatus('error');
    } finally {
        if(loader) loader.classList.add('hidden');
        if(container) container.classList.remove('hidden');
    }
}

function populateDropdowns() {
    // 1. Dropdown Kelas
    const kelasSelect = document.getElementById('filter-kelas-select');
    if(kelasSelect) {
        kelasSelect.innerHTML = '<option value="">-- Semua Kelas --</option>';
        if(rawData.ref_kelas) {
            rawData.ref_kelas.forEach(k => kelasSelect.innerHTML += `<option value="${k.nama_kelas}">${k.nama_kelas}</option>`);
        }
    }

    // 2. Dropdown Ujian
    const ujianSelect = document.getElementById('filter-ujian-select');
    if(ujianSelect) {
        ujianSelect.innerHTML = `
            <option value="">-- Pilih Jenis Nilai --</option>
            <option value="Nilai Harian" class="font-bold text-indigo-700 bg-indigo-50">★ Rata-rata Nilai Harian</option>
        `;
        if(rawData.ref_ujian) {
            rawData.ref_ujian.forEach(u => ujianSelect.innerHTML += `<option value="${u.jenis_ujian}">${u.jenis_ujian}</option>`);
        }
    }

    // 3. Dropdown Slip Guru
    const slipSelect = document.getElementById('slip-email-select');
    if(slipSelect && rawData.absensi) {
        const uniqueEmails = [...new Set(rawData.absensi.map(item => item.email_guru).filter(email => email))];
        uniqueEmails.sort();
        slipSelect.innerHTML = '<option value="">-- Pilih Guru --</option>';
        uniqueEmails.forEach(email => {
             slipSelect.innerHTML += `<option value="${email}">${email}</option>`;
        });
    }
}

// --- 2. LOGIKA TAB GURU & PDF EXPORT ---
function filterGuru(period) {
    currentFilterGuru = period;

    ['hari', 'minggu', 'bulan'].forEach(p => {
        const btn = document.getElementById(`filter-${p}`);
        if(btn) {
            if (p === period) { btn.classList.remove('subtab-inactive'); btn.classList.add('subtab-active'); }
            else { btn.classList.remove('subtab-active'); btn.classList.add('subtab-inactive'); }
        }
    });

    const labelEl = document.getElementById('period-label');
    const labels = { 'hari': 'Hari Ini', 'minggu': 'Minggu Ini', 'bulan': 'Bulan Ini' };
    if(labelEl) labelEl.innerText = labels[period];

    if (rawData.mapel.length === 0) return;

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (period === 'hari') {
        startDate.setHours(0,0,0,0); endDate.setHours(23,59,59,999);
    } else if (period === 'minggu') {
        const day = now.getDay() || 7;
        startDate.setHours(-24 * (day - 1)); startDate.setHours(0,0,0,0);
        endDate.setDate(startDate.getDate() + 6);
    } else if (period === 'bulan') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const filteredAbsensi = rawData.absensi.filter(row => {
        const rowDate = new Date(row.tanggal);
        return rowDate >= startDate && rowDate <= endDate;
    });

    const stats = {};
    filteredAbsensi.forEach(row => {
        const mapelName = row.mapel;
        const uniqueSessionKey = `${row.tanggal}_${row.kelas}`;
        if (!stats[mapelName]) stats[mapelName] = new Set();
        stats[mapelName].add(uniqueSessionKey);
    });

    const result = rawData.mapel.map(m => {
        const mapelName = m.nama_mapel;
        const sessions = stats[mapelName] ? stats[mapelName].size : 0;
        let avg = period === 'bulan' ? (sessions / 4.0).toFixed(2) : "-";
        return { mapel: mapelName, total: sessions, avg: avg };
    });

    result.sort((a, b) => b.total - a.total);

    const tbody = document.getElementById('guru-table-body');
    if(tbody) {
        tbody.innerHTML = '';
        let sAktif = 0, sTotal = 0, sKosong = 0;
        result.forEach((row, index) => {
            if (row.total > 0) sAktif++; else sKosong++;
            sTotal += row.total;
            let badge = row.total > 0 ? 'Aktif' : 'Kosong';
            let badgeClass = row.total > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';

            tbody.innerHTML += `
                <tr class="${row.total === 0 ? "bg-rose-50/50" : "hover:bg-slate-50"} transition-colors">
                    <td class="px-6 py-4 text-slate-500 font-medium">${index + 1}</td>
                    <td class="px-6 py-4 font-semibold text-slate-700">${row.mapel}</td>
                    <td class="px-6 py-4 text-center"><span class="font-bold">${row.total}</span> <span class="text-xs text-slate-400">Sesi</span></td>
                    <td class="px-6 py-4 text-center text-slate-600">${row.avg}</td>
                    <td class="px-6 py-4 text-center"><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${badge}</span></td>
                </tr>`;
        });
        if(document.getElementById('stat-mapel-aktif')) document.getElementById('stat-mapel-aktif').innerText = sAktif;
        if(document.getElementById('stat-total-pertemuan')) document.getElementById('stat-total-pertemuan').innerText = sTotal;
        if(document.getElementById('stat-mapel-kosong')) document.getElementById('stat-mapel-kosong').innerText = sKosong;
    }
}

// **FUNGSI EXPORT PDF (Data Mapel)**
function exportMapelPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const labels = { 'hari': 'Hari Ini', 'minggu': 'Minggu Ini', 'bulan': 'Bulan Ini' };
    const periodName = labels[currentFilterGuru] || 'Periode';

    // Judul
    doc.setFontSize(16);
    doc.text("Laporan Kehadiran Mata Pelajaran", 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Filter: ${periodName} | Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

    // Ambil Data dari HTML Table (lebih aman karena sesuai visual)
    const tableEl = document.getElementById('table-guru-export');

    // Parse Baris untuk AutoTable
    const headers = [['No', 'Mata Pelajaran', 'Total Sesi', 'Rata-rata/Mg', 'Status']];
    const rows = [];

    document.querySelectorAll('#guru-table-body tr').forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            // Ambil text bersih (hapus 'Sesi' kecil dll)
            rowData.push(td.innerText.replace('Sesi', '').trim());
        });
        rows.push(rowData);
    });

    doc.autoTable({
        head: headers,
        body: rows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
        columnStyles: {
            0: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' }
        }
    });

    doc.save(`Laporan_Mapel_${periodName}.pdf`);
}

// --- 3. LOGIKA TAB SISWA & EXCEL EXPORT ---
async function loadSiswaData() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    const kelas = document.getElementById('filter-kelas-select').value;
    const jenisUjian = document.getElementById('filter-ujian-select').value;

    if(!jenisUjian) { alert("Mohon pilih Jenis Nilai terlebih dahulu."); return; }

    document.getElementById('siswa-empty').classList.add('hidden');
    document.getElementById('siswa-data-container').classList.add('hidden');
    document.getElementById('siswa-loader').classList.remove('hidden');

    try {
        if (jenisUjian !== 'Nilai Harian' && rawData.nilai.length === 0) {
            const resNilai = await fetch(GAS_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'admin_load_table', table: 'nilai' })
            });
            const dataNilai = await resNilai.json();
            rawData.nilai = Array.isArray(dataNilai) ? dataNilai : [];
        }
        processSiswaPivot(startDate, endDate, kelas, jenisUjian);
    } catch(e) {
        console.error(e);
        alert("Gagal memuat data nilai.");
    } finally {
        document.getElementById('siswa-loader').classList.add('hidden');
        document.getElementById('siswa-data-container').classList.remove('hidden');
    }
}

function processSiswaPivot(startDateStr, endDateStr, filterKelas, filterUjian) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59);

    let filteredStudents = rawData.students || [];
    if (filterKelas) filteredStudents = filteredStudents.filter(s => s.kelas === filterKelas);

    filteredStudents.sort((a, b) => {
        const kC = (b.kelas || "").localeCompare(a.kelas || "");
        if (kC !== 0) return kC;
        return (a.nama || "").localeCompare(b.nama || "");
    });

    const pivotData = {};
    const studentLookup = new Map();

    filteredStudents.forEach(s => {
        const key = s.nisn || s.nama;
        const normName = (s.nama || "").toLowerCase().trim();
        pivotData[key] = { nama: s.nama, kelas: s.kelas, s:0, i:0, a:0, nilai: {}, tempHarian: {} };
        if(normName) studentLookup.set(normName, key);
    });

    if(rawData.absensi) {
        rawData.absensi.forEach(abs => {
            const absDate = new Date(abs.tanggal);
            if (absDate < start || absDate > end) return;
            const key = studentLookup.get((abs.nama_santri || abs.nama || "").toLowerCase().trim());
            if (key && pivotData[key]) {
                // BUG FIX: Cek kedua properti 'status' dan 'kehadiran'
                const status = (abs.status || abs.kehadiran || "").toUpperCase();

                if (status.startsWith('S')) pivotData[key].s++;
                else if (status.startsWith('I')) pivotData[key].i++;
                else if (status.startsWith('A')) pivotData[key].a++;

                if (filterUjian === 'Nilai Harian') {
                    const val = parseFloat(abs.nilai_harian);
                    const mapel = (abs.mapel || "").trim();
                    if (mapel && !isNaN(val)) {
                        if (!pivotData[key].tempHarian[mapel]) pivotData[key].tempHarian[mapel] = { sum: 0, count: 0 };
                        pivotData[key].tempHarian[mapel].sum += val;
                        pivotData[key].tempHarian[mapel].count++;
                    }
                }
            }
        });
    }

    if (filterUjian === 'Nilai Harian') {
        Object.keys(pivotData).forEach(key => {
            const s = pivotData[key];
            Object.keys(s.tempHarian).forEach(m => {
                if (s.tempHarian[m].count > 0) s.nilai[m] = (s.tempHarian[m].sum / s.tempHarian[m].count).toFixed(2);
            });
        });
    } else if(rawData.nilai) {
        rawData.nilai.forEach(n => {
            if (n.jenis_ujian !== filterUjian) return;
            const key = studentLookup.get((n.nama_santri || n.nama || "").toLowerCase().trim());
            if (key && pivotData[key]) pivotData[key].nilai[n.mapel] = n.nilai;
        });
    }

    const thead = document.getElementById('siswa-table-head-row');
    const tbody = document.getElementById('siswa-table-body');
    while (thead.children.length > 6) thead.removeChild(thead.lastChild);

    if(rawData.mapel) {
        rawData.mapel.forEach(m => {
            const th = document.createElement('th');
            th.className = "px-4 py-3 bg-slate-50 text-center border-l border-slate-200 min-w-[100px]";
            th.innerText = m.nama_mapel;
            thead.appendChild(th);
        });
    }

    tbody.innerHTML = '';
    let no = 1;
    filteredStudents.forEach(s => {
        const d = pivotData[s.nisn || s.nama];
        if (!d) return;
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 border-b border-slate-100";
        let html = `
            <td class="px-4 py-3 sticky-col bg-white text-slate-500">${no++}</td>
            <td class="px-4 py-3 sticky-col bg-white font-semibold text-slate-700" style="left: 48px;">${d.nama}</td>
            <td class="px-4 py-3 text-center border-l border-slate-100">${d.kelas}</td>
            <td class="px-2 py-3 text-center font-bold ${d.s>0?'text-emerald-700 bg-emerald-50':'text-slate-300'} border-l border-slate-100">${d.s||'-'}</td>
            <td class="px-2 py-3 text-center font-bold ${d.i>0?'text-amber-700 bg-amber-50':'text-slate-300'} border-l border-slate-100">${d.i||'-'}</td>
            <td class="px-2 py-3 text-center font-bold ${d.a>0?'text-rose-700 bg-rose-50':'text-slate-300'} border-l border-slate-100 border-r border-slate-300">${d.a||'-'}</td>
        `;
        if(rawData.mapel) {
            rawData.mapel.forEach(m => {
                const val = d.nilai[m.nama_mapel];
                let cls = "text-slate-700";
                if(val && parseFloat(val) < 75) cls = "text-rose-600 font-bold";
                html += `<td class="px-4 py-3 text-center border-l border-slate-100 ${cls}">${val||''}</td>`;
            });
        }
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// **FUNGSI EXPORT CSV (Data Siswa)**
function exportSiswaCSV() {
    // 1. Ambil Header
    const headers = [];
    document.querySelectorAll('#siswa-table-head-row th').forEach(th => {
        headers.push(th.innerText.replace(/\n/g, ' ')); // Hapus enter jika ada
    });

    // 2. Ambil Rows
    const rows = [];
    document.querySelectorAll('#siswa-table-body tr').forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            // Escape quote jika ada koma dalam data
            let text = td.innerText.replace(/"/g, '""');
            if (text.includes(',')) text = `"${text}"`;
            rowData.push(text);
        });
        rows.push(rowData.join(','));
    });

    // 3. Gabungkan
    const csvContent = headers.join(',') + '\n' + rows.join('\n');

    // 4. Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const kelas = document.getElementById('filter-kelas-select').value || 'SemuaKelas';
    const ujian = document.getElementById('filter-ujian-select').value || 'Data';

    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Siswa_${kelas}_${ujian}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- 4. LOGIKA SLIP GURU ---
function generateSlipGuru() {
    const email = document.getElementById('slip-email-select').value;
    const startStr = document.getElementById('slip-start-date').value;
    const endStr = document.getElementById('slip-end-date').value;

    if (!email || !startStr || !endStr) {
        alert("Mohon lengkapi Email Guru dan Periode Tanggal.");
        return;
    }

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    endDate.setHours(23, 59, 59);

    const filtered = rawData.absensi.filter(row => {
        const d = new Date(row.tanggal);
        return row.email_guru === email && d >= startDate && d <= endDate;
    });

    if (filtered.length === 0) {
        alert("Tidak ada data mengajar.");
        return;
    }

    const uniqueSessions = [];
    const seen = new Set();

    filtered.forEach(row => {
        const key = `${row.tanggal}_${row.jam}_${row.kelas}_${row.mapel}`;
        if (!seen.has(key)) {
            seen.add(key);
            let durasi = 0;
            if (row.jam) durasi = row.jam.toString().split(',').length;
            uniqueSessions.push({ tanggal: row.tanggal, mapel: row.mapel, kelas: row.kelas, materi: row.materi, jumlah_jam: durasi });
        }
    });

    uniqueSessions.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    document.getElementById('slip-empty').classList.add('hidden');
    document.getElementById('slip-preview-container').classList.remove('hidden');
    document.getElementById('slip-nama-guru').innerText = email;
    document.getElementById('slip-periode').innerText = `${startStr} s.d ${endStr}`;

    const tbody = document.getElementById('slip-table-body');
    tbody.innerHTML = '';
    let totalJam = 0;

    uniqueSessions.forEach((sess, idx) => {
        totalJam += sess.jumlah_jam;
        const dateFmt = new Date(sess.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
        tbody.innerHTML += `
            <tr>
                <td class="px-4 py-2 border-r border-slate-300 text-center text-slate-500">${idx + 1}</td>
                <td class="px-4 py-2 border-r border-slate-300 text-slate-700">${dateFmt}</td>
                <td class="px-4 py-2 border-r border-slate-300 font-medium text-slate-800">${sess.mapel} <span class="text-xs text-slate-500 ml-1">(${sess.kelas})</span></td>
                <td class="px-4 py-2 border-r border-slate-300 text-slate-600 text-sm truncate max-w-xs">${sess.materi || '-'}</td>
                <td class="px-4 py-2 text-center font-bold text-slate-800">${sess.jumlah_jam}</td>
            </tr>`;
    });
    document.getElementById('slip-total-jam').innerText = totalJam;
}

// --- UTILS ---
function updateStatus(status) {
    const el = document.getElementById('connection-status');
    if(!el) return;
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
        if(btn && content) {
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
