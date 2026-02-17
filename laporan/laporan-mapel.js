// --- LOGIKA TAB GURU (MAPEL) & PDF EXPORT ---

function filterGuru() {
    const startInput = document.getElementById('guru-start-date');
    const endInput = document.getElementById('guru-end-date');
    if (!startInput || !endInput) return;

    const startDate = new Date(startInput.value);
    const endDate = new Date(endInput.value);

    // Set jam untuk mencakup seluruh hari di endDate
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const labelEl = document.getElementById('period-label');
    if (labelEl) labelEl.innerText = `${startInput.value} s.d ${endInput.value}`;

    if (rawData.mapel.length === 0) return;

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

        // Hitung selisih minggu untuk rata-rata
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        const diffWeeks = diffDays / 7;
        let avg = diffWeeks >= 1 ? (sessions / diffWeeks).toFixed(2) : sessions.toFixed(2);

        return { mapel: mapelName, total: sessions, avg: avg };
    });

    result.sort((a, b) => b.total - a.total);

    const tbody = document.getElementById('guru-table-body');
    if (tbody) {
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
        if (document.getElementById('stat-mapel-aktif')) document.getElementById('stat-mapel-aktif').innerText = sAktif;
        if (document.getElementById('stat-total-pertemuan')) document.getElementById('stat-total-pertemuan').innerText = sTotal;
        if (document.getElementById('stat-mapel-kosong')) document.getElementById('stat-mapel-kosong').innerText = sKosong;
    }
}

// **FUNGSI EXPORT PDF (Data Mapel)**
function exportMapelPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const startVal = document.getElementById('guru-start-date').value;
    const endVal = document.getElementById('guru-end-date').value;
    const periodName = `${startVal}_sd_${endVal}`;

    // Judul
    doc.setFontSize(16);
    doc.text("Laporan Kehadiran Mata Pelajaran", 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Periode: ${startVal} s.d ${endVal} | Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);

    // Ambil Data dari HTML Table
    const headers = [['No', 'Mata Pelajaran', 'Total Sesi', 'Rata-rata/Mg', 'Status']];
    const rows = [];

    document.querySelectorAll('#guru-table-body tr').forEach(tr => {
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            rowData.push(td.innerText.replace('Sesi', '').trim());
        });
        rows.push(rowData);
    });

    doc.autoTable({
        head: headers,
        body: rows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        columnStyles: {
            0: { halign: 'center' },
            2: { halign: 'center' },
            3: { halign: 'center' },
            4: { halign: 'center' }
        }
    });

    doc.save(`Laporan_Mapel_${periodName}.pdf`);
}
