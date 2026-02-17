// --- LOGIKA TAB SISWA & EXCEL EXPORT ---

async function loadSiswaData() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    const kelas = document.getElementById('filter-kelas-select').value;
    const jenisUjian = document.getElementById('filter-ujian-select').value;

    if (!jenisUjian) { alert("Mohon pilih Jenis Nilai terlebih dahulu."); return; }

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
    } catch (e) {
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
        pivotData[key] = { nama: s.nama, kelas: s.kelas, s: 0, i: 0, a: 0, nilai: {}, tempHarian: {} };
        if (normName) studentLookup.set(normName, key);
    });

    if (rawData.absensi) {
        rawData.absensi.forEach(abs => {
            const absDate = new Date(abs.tanggal);
            if (absDate < start || absDate > end) return;
            const key = studentLookup.get((abs.nama_santri || abs.nama || "").toLowerCase().trim());
            if (key && pivotData[key]) {
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
    } else if (rawData.nilai) {
        rawData.nilai.forEach(n => {
            if (n.jenis_ujian !== filterUjian) return;
            const key = studentLookup.get((n.nama_santri || n.nama || "").toLowerCase().trim());
            if (key && pivotData[key]) pivotData[key].nilai[n.mapel] = n.nilai;
        });
    }

    const thead = document.getElementById('siswa-table-head-row');
    const tbody = document.getElementById('siswa-table-body');
    if (!thead || !tbody) return;

    while (thead.children.length > 6) thead.removeChild(thead.lastChild);

    if (rawData.mapel) {
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
            <td class="px-2 py-3 text-center font-bold ${d.s > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-slate-300'} border-l border-slate-100">${d.s || '-'}</td>
            <td class="px-2 py-3 text-center font-bold ${d.i > 0 ? 'text-amber-700 bg-amber-50' : 'text-slate-300'} border-l border-slate-100">${d.i || '-'}</td>
            <td class="px-2 py-3 text-center font-bold ${d.a > 0 ? 'text-rose-700 bg-rose-50' : 'text-slate-300'} border-l border-slate-100 border-r border-slate-300">${d.a || '-'}</td>
        `;
        if (rawData.mapel) {
            rawData.mapel.forEach(m => {
                const val = d.nilai[m.nama_mapel];
                let cls = "text-slate-700";
                if (val && parseFloat(val) < 75) cls = "text-rose-600 font-bold";
                html += `<td class="px-4 py-3 text-center border-l border-slate-100 ${cls}">${val || ''}</td>`;
            });
        }
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// **FUNGSI EXPORT CSV (Data Siswa)**
function exportSiswaCSV() {
    const headers = [];
    document.querySelectorAll('#siswa-table-head-row th').forEach(th => {
        headers.push(th.innerText.replace(/\n/g, ' '));
    });

    const rows = [];
    document.querySelectorAll('#siswa-table-body tr').forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            let text = td.innerText.replace(/"/g, '""');
            if (text.includes(',')) text = `"${text}"`;
            rowData.push(text);
        });
        rows.push(rowData.join(','));
    });

    const csvContent = headers.join(',') + '\n' + rows.join('\n');
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
