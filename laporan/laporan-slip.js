// --- LOGIKA SLIP GURU ---

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
    const dailyHours = {}; // Melacak total jam pelajaran per hari untuk guru ini

    filtered.forEach(row => {
        const key = `${row.tanggal}_${row.jam}_${row.kelas}_${row.mapel}`;
        if (!seen.has(key)) {
            seen.add(key);

            // Hitung durasi jam pelajaran (misal "1,2,3" = 3 jam)
            let durasi = 0;
            if (row.jam) {
                const jamArray = row.jam.toString().split(',').filter(j => j.trim() !== "");
                durasi = jamArray.length;
            }

            // Akumulasi jam per tanggal
            const tgl = row.tanggal;
            dailyHours[tgl] = (dailyHours[tgl] || 0) + durasi;

            // Format Pukul (HH:mm) dari created_at
            let pukul = "-";
            let hoursInt = -1;
            if (row.created_at) {
                const dateObj = new Date(row.created_at);
                if (!isNaN(dateObj)) {
                    hoursInt = dateObj.getHours();
                    const hours = hoursInt.toString().padStart(2, '0');
                    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                    pukul = `${hours}:${minutes}`;
                }
            }

            // Kondisi Pukul (Luar 08:00 - 14:00)
            const isOutsideTime = hoursInt !== -1 && (hoursInt < 8 || hoursInt >= 14);

            uniqueSessions.push({
                tanggal: row.tanggal,
                mapel: row.mapel,
                kelas: row.kelas,
                materi: row.materi,
                jumlah_jam: durasi,
                pukul: pukul,
                isOutsideTime: isOutsideTime
            });
        }
    });

    uniqueSessions.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

    document.getElementById('slip-empty').classList.add('hidden');
    document.getElementById('slip-preview-container').classList.remove('hidden');
    document.getElementById('slip-nama-guru').innerText = email;
    document.getElementById('slip-periode').innerText = `${startStr} s.d ${endStr}`;

    const tbody = document.getElementById('slip-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let totalJamSemua = 0;

    uniqueSessions.forEach((sess, idx) => {
        totalJamSemua += sess.jumlah_jam;
        const dateFmt = new Date(sess.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

        // Kondisi Peringatan
        const totalJamHariIni = dailyHours[sess.tanggal] || 0;
        const isOverLimit = totalJamHariIni > 8; // LEBIH DARI 8 JAM SEHARI

        let rowClass = "hover:bg-slate-50 transition-colors";
        let note = "";

        if (isOverLimit) {
            rowClass = "bg-rose-50 hover:bg-rose-100/80";
            note = `<div class="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> Total: ${totalJamHariIni} Jam (Limit 8)</div>`;
        } else if (sess.isOutsideTime) {
            rowClass = "bg-amber-50 hover:bg-amber-100/80";
            note = `<div class="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1"><i class="fa-solid fa-clock"></i> Diluar Jam Kerja</div>`;
        }

        tbody.innerHTML += `
            <tr class="${rowClass} border-b border-slate-200">
                <td class="px-4 py-3 border-r border-slate-300 text-center text-slate-500 text-xs">${idx + 1}</td>
                <td class="px-4 py-3 border-r border-slate-300 text-slate-700 text-sm whitespace-nowrap">${dateFmt}</td>
                <td class="px-4 py-3 border-r border-slate-300 text-center font-medium ${sess.isOutsideTime ? 'text-amber-700' : 'text-slate-600'} text-sm">${sess.pukul}</td>
                <td class="px-4 py-3 border-r border-slate-300">
                    <div class="font-bold text-slate-800 text-sm">${sess.mapel}</div>
                    <div class="text-[11px] text-indigo-600 font-semibold italic">Kelas: ${sess.kelas}</div>
                </td>
                <td class="px-4 py-3 border-r border-slate-300">
                    <div class="text-slate-600 text-xs leading-relaxed max-w-[200px] line-clamp-2">${sess.materi || '-'}</div>
                </td>
                <td class="px-4 py-3 text-center">
                    <div class="font-black text-slate-900 text-base">${sess.jumlah_jam}</div>
                    ${note}
                </td>
            </tr>`;
    });

    const totalJamEl = document.getElementById('slip-total-jam');
    if (totalJamEl) {
        totalJamEl.innerText = totalJamSemua;
        // Tambahkan indikasi jika total keseluruhan juga mencurigakan (opsional)
    }
}
