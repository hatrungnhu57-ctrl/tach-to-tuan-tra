// Default 13 Officers of To Tra Vinh
const DEFAULT_OFFICERS = [
    "Nguyễn Hoàng Tuấn",
    "Đường Thanh Truyền",
    "Thạch Sô Ran Thi",
    "Võ Hoàng Tuấn",
    "Nguyễn Thị Ửng",
    "Lý Thị Hồng Lài",
    "Trần Minh Thắng",
    "Nguyễn Vũ Cường",
    "Nguyễn Văn Nhiệm",
    "Phạm Lê Duy",
    "Lê Hà Phương",
    "Võ Văn Việt",
    "Hà Trung Nhu"
];

// Initialize State
let officersList = JSON.parse(localStorage.getItem('tv_officers') || JSON.stringify(DEFAULT_OFFICERS));
let currentPdfFile = null;
let parsedSchedule = []; // Array of day objects with tv_tos

// DOM Elements
const pdfFileInput = document.getElementById('pdf-file-input');
const uploadStatusText = document.getElementById('upload-status-text');
const uploadDetailText = document.getElementById('upload-detail-text');
const btnProcess = document.getElementById('btn-process');
const statusLabel = document.getElementById('status-label');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const progressPct = document.getElementById('progress-pct');
const progressIndicator = document.getElementById('progress-indicator');
const resultSection = document.getElementById('result-section');
const scheduleTableBody = document.getElementById('schedule-table-body');
const statTotalShiftsBadge = document.getElementById('stat-total-shifts-badge');
const statDaysBadge = document.getElementById('stat-days-badge');
const btnExportDocx = document.getElementById('btn-export-docx');

// Personnel Modal Elements
const modalPersonnel = document.getElementById('modal-personnel');
const btnOpenPersonnel = document.getElementById('btn-open-personnel');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnSavePersonnel = document.getElementById('btn-save-personnel');
const btnAddOfficer = document.getElementById('btn-add-officer');
const inputNewOfficer = document.getElementById('input-new-officer');
const personnelTableBody = document.getElementById('personnel-table-body');
const officerCountBadge = document.getElementById('officer-count-badge');
const btnResetDefaultOfficers = document.getElementById('btn-reset-default-officers');

// Initialize Lucide Icons
if (window.lucide) {
    lucide.createIcons();
}

// Update Personnel UI
function renderPersonnelModal() {
    officerCountBadge.innerText = officersList.length;
    personnelTableBody.innerHTML = '';
    officersList.forEach((name, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';
        tr.innerHTML = `
            <td class="py-2.5 px-3 text-center text-slate-400 font-medium">${idx + 1}</td>
            <td class="py-2.5 px-3 font-medium text-slate-800">${escapeHtml(name)}</td>
            <td class="py-2.5 px-3 text-center">
                <button onclick="removeOfficer(${idx})" class="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        personnelTableBody.appendChild(tr);
    });
    if (window.lucide) lucide.createIcons();
}

window.removeOfficer = function(idx) {
    officersList.splice(idx, 1);
    localStorage.setItem('tv_officers', JSON.stringify(officersList));
    renderPersonnelModal();
};

btnOpenPersonnel.addEventListener('click', () => {
    renderPersonnelModal();
    modalPersonnel.classList.remove('hidden');
});

btnCloseModal.addEventListener('click', () => {
    modalPersonnel.classList.add('hidden');
});

btnSavePersonnel.addEventListener('click', () => {
    localStorage.setItem('tv_officers', JSON.stringify(officersList));
    modalPersonnel.classList.add('hidden');
    if (parsedSchedule.length > 0) {
        renderScheduleTable();
    }
});

btnAddOfficer.addEventListener('click', () => {
    const val = inputNewOfficer.value.trim();
    if (val && !officersList.includes(val)) {
        officersList.push(val);
        localStorage.setItem('tv_officers', JSON.stringify(officersList));
        inputNewOfficer.value = '';
        renderPersonnelModal();
    }
});

inputNewOfficer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        btnAddOfficer.click();
    }
});

btnResetDefaultOfficers.addEventListener('click', () => {
    if (confirm("Khôi phục lại danh sách 13 cán bộ mặc định của Tổ Trà Vinh?")) {
        officersList = [...DEFAULT_OFFICERS];
        localStorage.setItem('tv_officers', JSON.stringify(officersList));
        renderPersonnelModal();
    }
});

// Handle File Selection
pdfFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        currentPdfFile = file;
        uploadStatusText.innerText = `Đã chọn: ${file.name}`;
        uploadDetailText.innerText = `Kích thước: ${(file.size / (1024 * 1024)).toFixed(2)} MB - Sẵn sàng tách ca`;
        btnProcess.disabled = false;
        statusLabel.innerText = "Đã nạp file PDF";
    }
});

// Configure PDF.js Worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Process PDF
btnProcess.addEventListener('click', async () => {
    if (!currentPdfFile) return;

    btnProcess.disabled = true;
    progressContainer.classList.remove('hidden');
    progressIndicator.classList.remove('hidden');
    statusLabel.innerText = "Đang xử lý...";

    try {
        const fileData = await currentPdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
        const totalPages = pdf.numPages;

        let allRuns = [];

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const pct = Math.round((pageNum / totalPages) * 70);
            progressBar.style.width = `${pct}%`;
            progressPct.innerText = `${pct}%`;
            progressText.innerText = `Đang đọc trang ${pageNum} / ${totalPages}...`;

            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            const rawItems = textContent.items;
            const items = [];

            for (let i = 0; i < rawItems.length; i++) {
                const it = rawItems[i];
                if (!it.str || it.str.trim().length === 0) continue;

                const tx = it.transform;
                const x = tx[4];
                const y = tx[5];
                const width = it.width || 0;

                items.push({
                    text: it.str,
                    x: x,
                    y: y,
                    w: width,
                    p: pageNum,
                    col: getColumnIndex(x)
                });
            }

            items.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 3.5) {
                    return b.y - a.y;
                }
                return a.x - b.x;
            });

            allRuns.push(...items);
        }

        progressText.innerText = "Đang tách các ca thuộc Tổ Trà Vinh...";
        progressBar.style.width = `85%`;
        progressPct.innerText = `85%`;

        parsedSchedule = parseWeeklyScheduleFromRuns(allRuns);

        progressBar.style.width = `100%`;
        progressPct.innerText = `100%`;
        progressText.innerText = "Hoàn tất!";

        setTimeout(() => {
            progressContainer.classList.add('hidden');
            progressIndicator.classList.add('hidden');
            resultSection.classList.remove('hidden');
            statusLabel.innerText = "Đã tách xong";
            btnProcess.disabled = false;
            renderScheduleTable();
        }, 300);

    } catch (err) {
        console.error(err);
        alert("Có lỗi khi xử lý file PDF: " + err.message);
        btnProcess.disabled = false;
        progressContainer.classList.add('hidden');
        progressIndicator.classList.add('hidden');
        statusLabel.innerText = "Lỗi xử lý";
    }
});

function getColumnIndex(x) {
    if (x < 100) return 1;
    if (x < 230) return 2;
    if (x < 330) return 3;
    if (x < 475) return 4;
    if (x < 610) return 5;
    return 6;
}

function groupRunsToLines(runs) {
    if (!runs || runs.length === 0) return [];

    const pagesMap = {};
    runs.forEach(r => {
        if (!pagesMap[r.p]) pagesMap[r.p] = [];
        pagesMap[r.p].push(r);
    });

    const allLines = [];
    Object.keys(pagesMap).map(Number).sort((a,b) => a - b).forEach(pNum => {
        const pRuns = pagesMap[pNum];
        pRuns.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 3.5) return b.y - a.y;
            return a.x - b.x;
        });

        let curLine = [pRuns[0]];
        let curY = pRuns[0].y;

        for (let i = 1; i < pRuns.length; i++) {
            const r = pRuns[i];
            if (Math.abs(r.y - curY) < 3.5) {
                curLine.push(r);
            } else {
                curLine.sort((a, b) => a.x - b.x);
                allLines.push(joinRunsWithSpaces(curLine));
                curLine = [r];
                curY = r.y;
            }
        }
        if (curLine.length > 0) {
            curLine.sort((a, b) => a.x - b.x);
            allLines.push(joinRunsWithSpaces(curLine));
        }
    });

    return cleanCellLines(allLines);
}

function joinRunsWithSpaces(lineRuns) {
    if (!lineRuns || lineRuns.length === 0) return '';
    let res = lineRuns[0].text;
    for (let i = 1; i < lineRuns.length; i++) {
        const prev = lineRuns[i - 1];
        const cur = lineRuns[i];
        const gap = cur.x - (prev.x + (prev.w || 0));

        if (gap > 1.5 || (!prev.text.endsWith(' ') && !cur.text.startsWith(' '))) {
            res += ' ' + cur.text;
        } else {
            res += cur.text;
        }
    }
    return res;
}

function cleanCellLines(lines) {
    if (!lines || lines.length === 0) return [];
    let raw = lines.join('\n');

    raw = raw.replace(/Km\s+(\d+)\s*\n*\s*\+(\d+)/g, 'Km $1+$2');
    raw = raw.replace(/(\d+)\s*\n*\s*\+(\d+)/g, '$1+$2');

    const clean = [];
    raw.split('\n').forEach(l => {
        l = l.trim();
        if (!l) return;
        if (/^\+\d+$/.test(l)) {
            if (clean.length > 0) clean[clean.length - 1] += l;
            return;
        }
        l = l.replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '');
        l = l.replace(/Vơ Hoàng Tuấn/g, 'Võ Hoàng Tuấn');
        l = l.replace(/Pḥng/g, 'Phòng');
        l = l.replace(/Chìóýn đề/g, 'Chuyên đề');
        l = l.replace(/Chuyên đề l ái/g, 'Chuyên đề lái');
        l = l.replace(/nồn g độ/g, 'nồng độ');
        l = l.replace(/tỉnhVĩnh/g, 'tỉnh Vĩnh');
        l = l.replace(/Tổ 1 7/g, 'Tổ 17');
        l = l.replace(/họp với/g, 'hợp với');

        l = l.replace(/ngày\s*23\/12\/2021củaChínhphủ/g, 'ngày 23/12/2021 của Chính phủ');
        l = l.replace(/vềĐTGLTNGT/g, 'về ĐTGQTNGT');
        l = l.replace(/Audaxseri/g, 'Audax seri: ');
        l = l.replace(/Chínhphủ/g, 'Chính phủ');
        l = l.replace(/củaChính/g, 'của Chính');

        clean.push(l);
    });

    return clean;
}

function parseWeeklyScheduleFromRuns(allRuns) {
    const daysInfo = [
        { name: "Thứ hai", date: "28/9/2026", minP: 1 },
        { name: "Thứ ba", date: "29/9/2026", minP: 10 },
        { name: "Thứ tư", date: "30/9/2026", minP: 19 },
        { name: "Thứ năm", date: "01/10/2026", minP: 29 },
        { name: "Thứ sáu", date: "02/10/2026", minP: 39 },
        { name: "Thứ bảy", date: "03/10/2026", minP: 50 },
        { name: "Chủ nhật", date: "04/10/2026", minP: 60 }
    ];

    const dayIndices = [];
    daysInfo.forEach(d => {
        for (let idx = 0; idx < allRuns.length; idx++) {
            const r = allRuns[idx];
            if (r.p >= d.minP && r.col === 1 && r.text.toLowerCase().includes(d.name.toLowerCase())) {
                dayIndices.push({ day: d.name, date: d.date, startIdx: idx });
                break;
            }
        }
    });

    const parsedDays = [];

    for (let i = 0; i < dayIndices.length; i++) {
        const dInfo = dayIndices[i];
        const nextStart = (i + 1 < dayIndices.length) ? dayIndices[i + 1].startIdx : allRuns.length;
        const dayRuns = allRuns.slice(dInfo.startIdx, nextStart);

        const toStarts = [];
        for (let j = 0; j < dayRuns.length; j++) {
            const r = dayRuns[j];
            const t = r.text.trim();
            if (t.includes("Tổ Cảnh sát") || t.includes("Tổ CSGT")) continue;

            const m = t.match(/^Tổ\s*(\d+)/i);
            if (m) {
                toStarts.push({ idx: j, name: `Tổ ${m[1]}` });
            } else if (t.toLowerCase() === 'tổ' && j + 1 < dayRuns.length && /^\d+$/.test(dayRuns[j+1].text.trim())) {
                toStarts.push({ idx: j, name: `Tổ ${dayRuns[j+1].text.trim()}` });
            }
        }

        const tvTos = [];

        for (let k = 0; k < toStarts.length; k++) {
            const toItem = toStarts[k];
            const nextIdx = (k + 1 < toStarts.length) ? toStarts[k + 1].idx : dayRuns.length;
            const toRuns = dayRuns.slice(toItem.idx, nextIdx);

            const colRuns = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
            for (const r of toRuns) {
                if (r.p >= 2 && r.y > 540 && /^\d+$/.test(r.text)) continue;
                if (r.text.includes("2. Thực hiện yêu cầu")) break;
                colRuns[r.col].push(r);
            }

            const col1Lines = groupRunsToLines(colRuns[1]);
            const col2Lines = groupRunsToLines(colRuns[2]);
            const col3Lines = groupRunsToLines(colRuns[3]);
            const col4Lines = groupRunsToLines(colRuns[4]);
            const col5Lines = groupRunsToLines(colRuns[5]);
            const col6Lines = groupRunsToLines(colRuns[6]);

            const col2Str = col2Lines.join(' ');
            const matchedOfficers = [];

            officersList.forEach(off => {
                const words = off.trim().split(/\s+/);
                const pattern = new RegExp('\\b' + words.map(w => escapeRegExp(w)).join('\\s+') + '\\b', 'i');
                const isVoHoangTuan = off.includes("Võ Hoàng Tuấn") && /\b(Võ|Vơ)\s+Hoàng\s+Tuấn\b/i.test(col2Str);

                if (pattern.test(col2Str) || isVoHoangTuan) {
                    matchedOfficers.push(off);
                }
            });

            if (matchedOfficers.length > 0) {
                tvTos.push({
                    toName: toItem.name,
                    matchedOfficers: matchedOfficers,
                    col1Lines: col1Lines,
                    col2Lines: col2Lines,
                    col3Lines: col3Lines,
                    col4Lines: col4Lines,
                    col5Lines: col5Lines,
                    col6Lines: col6Lines
                });
            }
        }

        parsedDays.push({
            day: dInfo.day,
            date: dInfo.date,
            tvTos: tvTos
        });
    }

    return parsedDays;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

function renderScheduleTable() {
    let totalShifts = 0;
    scheduleTableBody.innerHTML = '';

    parsedSchedule.forEach(day => {
        if (!day.tvTos || day.tvTos.length === 0) return;

        totalShifts += day.tvTos.length;

        day.tvTos.forEach((s, idx) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-900 align-top';

            let col1Html = '';
            if (idx === 0) {
                col1Html = `
                    <td rowspan="${day.tvTos.length}" class="py-3 px-2 text-center align-middle font-bold text-slate-900 border border-slate-900 bg-slate-50/50">
                        <div class="font-bold text-[13px]">${escapeHtml(day.day)}</div>
                        <div class="text-[12px] text-slate-700 mt-1">${escapeHtml(day.date)}</div>
                    </td>
                `;
            }

            let col2Html = s.col2Lines.map(l => {
                let esc = escapeHtml(l);
                if (/^Tổ\s+\d+/i.test(l)) {
                    return `<div class="font-bold text-[13px] mb-1">${esc}</div>`;
                }
                if (l === 'Tổ trưởng' || l === 'Tổ viên' || l === 'Tổ  viên' || l === 'Tổ phó') {
                    return `<div class="font-normal text-slate-700">${esc}</div>`;
                }
                const m = l.match(/^(.*?)(Tổ\s+trưởng|Tổ\s+viên|Tổ\s+phó)$/i);
                if (m) {
                    return `<div><strong class="font-bold">${escapeHtml(m[1].trim())}</strong> <span class="font-normal text-slate-700">${escapeHtml(m[2])}</span></div>`;
                }
                if (/^\d+\.\s*(Đ\/c|[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ])/i.test(l) || l.includes('Đ/c')) {
                    return `<div class="font-bold">${esc}</div>`;
                }
                return `<div>${esc}</div>`;
            }).join('');

            let col3Html = s.col3Lines.length > 0 ? s.col3Lines.map(l => `<div>${escapeHtml(l)}</div>`).join('') : '<span class="text-slate-400 italic"></span>';
            let col4Html = renderGeneralLinesHtml(s.col4Lines);
            let col5Html = renderGeneralLinesHtml(s.col5Lines);
            let col6Html = renderCol6LinesHtml(s.col6Lines);

            tr.innerHTML = `
                ${col1Html}
                <td class="py-2.5 px-2 border border-slate-900 text-[12px] leading-snug">
                    ${col2Html}
                </td>
                <td class="py-2.5 px-2 border border-slate-900 text-[12px] leading-snug text-center">
                    ${col3Html}
                </td>
                <td class="py-2.5 px-2 border border-slate-900 text-[12px] leading-snug">
                    ${col4Html}
                </td>
                <td class="py-2.5 px-2 border border-slate-900 text-[12px] leading-snug">
                    ${col5Html}
                </td>
                <td class="py-2.5 px-2 border border-slate-900 text-[12px] leading-snug">
                    ${col6Html}
                </td>
            `;

            scheduleTableBody.appendChild(tr);
        });
    });

    statTotalShiftsBadge.innerText = `Đã tách ${totalShifts} ca Tổ Trà Vinh`;
    statDaysBadge.innerText = `Đủ 7 ngày từ Thứ Hai đến Chủ Nhật`;
}

function renderGeneralLinesHtml(lines) {
    if (!lines || lines.length === 0) return '';
    return lines.map(l => {
        let esc = escapeHtml(l);
        if (/^(\*Tuần tra|\* Tuần tra|\*Kiểm soát|\* Kiểm soát|\* PC02|\d+\.\s+Tuần tra|\d+\.\s+Kiểm soát)/.test(l)) {
            return `<div class="font-bold mt-1">${esc}</div>`;
        }
        if (/^(- Tuyến:|- Thời gian:|- Đối tượng[^:]*:|- Hành vi[^:]*:|- Tuyên truyền[^:]*:)/.test(l)) {
            const parts = esc.split(':');
            if (parts.length >= 2) {
                return `<div><strong class="font-bold">${parts[0]}:</strong> ${parts.slice(1).join(':')}</div>`;
            }
        }
        return `<div>${esc}</div>`;
    }).join('');
}

function renderCol6LinesHtml(lines) {
    if (!lines || lines.length === 0) return '';
    return lines.map(l => {
        let esc = escapeHtml(l);
        if (l.startsWith('*') || /\d{2}[A-Z]\d?\s*-\s*[\d\.]+/.test(l)) {
            return `<div class="font-bold text-slate-950">${esc}</div>`;
        }
        if (/^(- Phương tiện, thiết bị|- Thiết bị|- Phương tiện thông tin|- Vũ khí|- Súng|- Gậy|- Các biểu mẫu|- Cân|- Máy)/.test(l)) {
            const parts = esc.split(':');
            if (parts.length >= 2) {
                return `<div><strong class="font-bold">${parts[0]}:</strong> ${parts.slice(1).join(':')}</div>`;
            }
        }
        return `<div>${esc}</div>`;
    }).join('');
}

// Export Word Document (.docx) with Full Style and Border Definitions
btnExportDocx.addEventListener('click', async () => {
    if (!parsedSchedule || parsedSchedule.length === 0) {
        alert("Vui lòng tải lên và xử lý file PDF trước khi xuất Word!");
        return;
    }

    try {
        const zip = new JSZip();

        const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
</Types>`;

        const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="word/styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="word/fontTable.xml"/>
</Relationships>`;

        const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="vi-VN"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="table" w:default="1" w:styleId="TableNormal">
    <w:name w:val="Normal Table"/>
    <w:tblPr>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
    </w:tblPr>
  </w:style>
</w:styles>`;

        const fontTableXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="Times New Roman">
    <w:panose1 w:val="02020603050405020304"/>
    <w:charset w:val="00"/>
    <w:family w:val="roman"/>
    <w:pitch w:val="variable"/>
  </w:font>
</w:fonts>`;

        let tableRowsXml = '';

        // Header Row 1: "Nội dung"
        tableRowsXml += `
        <w:tr>
            <w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>
            <w:tc>
                <w:tcPr>
                    <w:tcW w:w="15000" w:type="dxa"/>
                    <w:gridSpan w:val="6"/>
                    <w:shd w:val="clear" w:fill="D9E1F2"/>
                    <w:vAlign w:val="center"/>
                    <w:tcBorders>
                        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                    </w:tcBorders>
                </w:tcPr>
                <w:p>
                    <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
                    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>Nội dung</w:t></w:r>
                </w:p>
            </w:tc>
        </w:tr>`;

        // Header Row 2: Columns Header
        const colHeaders = [
            { t: "Ngày, tháng", w: 1300 },
            { t: "Tổ Cảnh sát\ngiao thông", w: 2200 },
            { t: "Lực lượng CS khác,\nCAX được huy động", w: 1300 },
            { t: "Hình thức tuần tra,\nkiểm soát", w: 3600 },
            { t: "Nhiệm vụ", w: 2900 },
            { t: "Sử dụng xe tuần tra, kiểm soát,\nphương tiện, thiết bị kỹ thuật,\nnghiệp vụ, vũ khí, công cụ hỗ trợ", w: 3700 }
        ];

        tableRowsXml += `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>`;
        colHeaders.forEach(ch => {
            const linesXml = ch.t.split('\n').map(l => `
                <w:p>
                    <w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
                    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(l)}</w:t></w:r>
                </w:p>
            `).join('');
            tableRowsXml += `
            <w:tc>
                <w:tcPr>
                    <w:tcW w:w="${ch.w}" w:type="dxa"/>
                    <w:shd w:val="clear" w:fill="F2F2F2"/>
                    <w:vAlign w:val="center"/>
                    <w:tcBorders>
                        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                    </w:tcBorders>
                </w:tcPr>
                ${linesXml}
            </w:tc>`;
        });
        tableRowsXml += `</w:tr>`;

        // Body Rows
        parsedSchedule.forEach(day => {
            if (!day.tvTos || day.tvTos.length === 0) return;

            day.tvTos.forEach((s, idx) => {
                tableRowsXml += `<w:tr><w:trPr><w:cantSplit/></w:trPr>`;

                if (idx === 0) {
                    tableRowsXml += `
                    <w:tc>
                        <w:tcPr>
                            <w:tcW w:w="1300" w:type="dxa"/>
                            <w:vMerge w:val="restart"/>
                            <w:vAlign w:val="center"/>
                            <w:tcBorders>
                                <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                                <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                                <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                            </w:tcBorders>
                        </w:tcPr>
                        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(day.day)}</w:t></w:r></w:p>
                        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(day.date)}</w:t></w:r></w:p>
                    </w:tc>`;
                } else {
                    tableRowsXml += `
                    <w:tc>
                        <w:tcPr>
                            <w:tcW w:w="1300" w:type="dxa"/>
                            <w:vMerge/>
                            <w:vAlign w:val="center"/>
                            <w:tcBorders>
                                <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                                <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                                <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                            </w:tcBorders>
                        </w:tcPr>
                        <w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>
                    </w:tc>`;
                }

                tableRowsXml += makeXmlCol2(s.col2Lines, 2200, 22);
                tableRowsXml += makeXmlGeneral(s.col3Lines, 1300, 20);
                tableRowsXml += makeXmlGeneral(s.col4Lines, 3600, 20);
                tableRowsXml += makeXmlGeneral(s.col5Lines, 2900, 20);
                tableRowsXml += makeXmlCol6(s.col6Lines, 3700, 20);

                tableRowsXml += `</w:tr>`;
            });
        });

        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
        <w:pPr><w:jc w:val="right"/><w:spacing w:after="100"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="20"/></w:rPr><w:t>Mẫu số 03/TT</w:t></w:r>
        <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:br/></w:r>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:sz w:val="18"/></w:rPr><w:t>(Kèm theo Thông tư số 14/2025/TT-BCA ngày 28/02/2025 của Bộ trưởng Bộ Công an)</w:t></w:r>
    </w:p>
    <w:tbl>
        <w:tblPr>
            <w:tblW w:w="15000" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
                <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
            </w:tblBorders>
        </w:tblPr>
        <w:tr>
            <w:tc>
                <w:tcPr><w:tcW w:w="7000" w:type="dxa"/></w:tcPr>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t>PHÒNG CẢNH SÁT GIAO THÔNG</w:t></w:r></w:p>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>ĐỘI CẢNH SÁT GIAO THÔNG\nĐƯỜNG BỘ</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="8000" w:type="dxa"/></w:tcPr>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</w:t></w:r></w:p>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>Độc lập - Tự do - Hạnh phúc</w:t></w:r></w:p>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:i/><w:sz w:val="22"/></w:rPr><w:t>Vĩnh Long, ngày 28 tháng 9 năm 2026</w:t></w:r></w:p>
            </w:tc>
        </w:tr>
    </w:tbl>
    <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:before="150" w:after="40"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="30"/></w:rPr><w:t>KẾ HOẠCH CÔNG TÁC TUẦN</w:t></w:r>
    </w:p>
    <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:after="150"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:i/><w:sz w:val="24"/></w:rPr><w:t>(Từ ngày 28/9/2026 đến ngày 04/10/2026)</w:t></w:r>
    </w:p>
    <w:p>
        <w:pPr><w:jc w:val="both"/><w:spacing w:after="150" w:line="260" w:lineRule="auto"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/></w:rPr><w:t>1. Thực hiện Kế hoạch số 121/KH-PC08 ngày 22/10/2024 của Phòng PC08, Công an tỉnh Vĩnh Long về thực hiện cao điểm tổng rà soát, phát hiện, thống kê người điều khiển phương tiện mà trong cơ thể có chất ma túy; các điểm, tụ điểm phức tạp về ma túy và đấu tranh, phòng chống tội phạm về ma túy của lực lượng Cảnh sát giao thông trên địa bàn tỉnh; Kế hoạch số 2487/KH-CAT ngày 30/12/2025 của Công an tỉnh về huy động lực lượng khác trong Công an tỉnh phối hợp tuần tra, kiểm soát bảo đảm trật tự, an toàn giao thông đường bộ; Kế hoạch 22/KH-PC08 ngày 18/3/2026 của Phòng PC08 về việc tuần tra, kiểm tra, kiểm soát, xử lý các chuyên đề vi phạm là nguyên nhân chính gây tai nạn giao thông trên các tuyến giao thông đường bộ; Kế hoạch số 166/KH-PC08 ngày 09/6/2026 của Phòng PC08 về việc thực hiện cao điểm phối hợp tuyên truyền, tấn công trấn áp tội phạm về ma tuý giữa Việt Nam, Trung Quốc, Lào và Myanmar trên các tuyến giao thông của lực lượng Cảnh sát giao thông; Kế hoạch số 399/KH-CAT-PC08 ngày 25/8/2026 của Công an tỉnh về tổng kiểm soát, xử lý vi phạm về trật tự an toàn giao thông đường bộ đối với phương tiện kinh doanh vận tải trên địa bàn tỉnh; Kế hoạch số 197/KH-PC08 ngày 14/9/2026 của Phòng PC08 về việc phối hợp tuần tra, kiểm soát phòng, chống đua xe trái phép và phòng chống các loại tội phạm hoạt động theo các tuyến giao thông trên địa bàn tỉnh; Căn cứ kết quả công tác điều tra cơ bản tuyến, điều tra, giải quyết tai nạn giao thông, kết quả xử lý vi phạm giao thông, tình hình trật tự, an toàn giao thông, trật tự xã hội, vi phạm giao thông nổi lên từ ngày 21/9/2026 đến ngày 27/9/2026, Đội Cảnh sát giao thông đường bộ xây dựng kế hoạch công tác tuần như sau:</w:t></w:r>
    </w:p>
    <w:tbl>
        <w:tblPr>
            <w:tblW w:w="15000" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
                <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            </w:tblBorders>
        </w:tblPr>
        <w:tblGrid>
            <w:gridCol w:w="1300"/>
            <w:gridCol w:w="2200"/>
            <w:gridCol w:w="1300"/>
            <w:gridCol w:w="3600"/>
            <w:gridCol w:w="2900"/>
            <w:gridCol w:w="3700"/>
        </w:tblGrid>
        ${tableRowsXml}
    </w:tbl>
    <w:p>
        <w:pPr><w:spacing w:before="150" w:after="40"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>2. Thực hiện yêu cầu, nhiệm vụ khác của Trưởng phòng (nếu có):</w:t></w:r>
    </w:p>
    <w:p>
        <w:pPr><w:spacing w:after="150"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/></w:rPr><w:t>Tùy theo tình hình thực tế giao cho chỉ huy Đội Cảnh sát giao thông đường bộ báo cáo Lãnh đạo phòng thay đổi tuyến, địa bàn, thời gian, lực lượng, phương tiện, thiết bị kỹ thuật nghiệp vụ, công cụ hỗ trợ và các điều kiện khác trong kế hoạch ngày cho phù hợp.</w:t></w:r>
    </w:p>
    <w:tbl>
        <w:tblPr>
            <w:tblW w:w="15000" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
                <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
            </w:tblBorders>
        </w:tblPr>
        <w:tr>
            <w:tc>
                <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
                <w:p><w:pPr><w:spacing w:after="20"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:i/><w:sz w:val="22"/></w:rPr><w:t>Nơi nhận:</w:t></w:r></w:p>
                <w:p><w:pPr><w:spacing w:after="10"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t>- Đ/c Trưởng phòng (để chỉ đạo);</w:t></w:r></w:p>
                <w:p><w:pPr><w:spacing w:after="10"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t>- Đ/c PTP phụ trách (để chỉ đạo);</w:t></w:r></w:p>
                <w:p><w:pPr><w:spacing w:after="10"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t>- PC02, PC06, PK02, CAX (để p/h thực hiện);</w:t></w:r></w:p>
                <w:p><w:pPr><w:spacing w:after="10"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t>- Lưu: Đội CSGTĐB, VT.</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="800"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>ĐỘI TRƯỞNG</w:t></w:r></w:p>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>Thượng tá Trần Văn Tiếp</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>KT. TRƯỞNG PHÒNG</w:t></w:r></w:p>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="800"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>PHÓ TRƯỞNG PHÒNG</w:t></w:r></w:p>
                <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="24"/></w:rPr><w:t>Thượng tá Nguyễn Ngọc Ân</w:t></w:r></w:p>
            </w:tc>
        </w:tr>
    </w:tbl>
    <w:sectPr>
        <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
        <w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;

        zip.file('[Content_Types].xml', contentTypesXml);
        zip.folder('_rels').file('.rels', relsXml);
        zip.folder('word').file('document.xml', documentXml);
        zip.folder('word').file('styles.xml', stylesXml);
        zip.folder('word').file('fontTable.xml', fontTableXml);

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `KE_HOACH_CONG_TAC_TUAN_TO_TRA_VINH.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error(err);
        alert("Lỗi khi tạo file Word: " + err.message);
    }
});

function escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function makeXmlCol2(lines, widthDxa, fontSize = 22) {
    if (!lines || lines.length === 0) {
        return `<w:tc><w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/><w:vAlign w:val="top"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:tc>`;
    }
    const parasXml = lines.map(l => {
        l = l.trim();
        if (/^Tổ\s+\d+/i.test(l)) {
            return `
            <w:p>
                <w:pPr><w:spacing w:after="30"/></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(l)}</w:t></w:r>
            </w:p>`;
        }

        if (l === 'Tổ trưởng' || l === 'Tổ viên' || l === 'Tổ  viên' || l === 'Tổ phó') {
            return `
            <w:p>
                <w:pPr><w:spacing w:after="30"/></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(l)}</w:t></w:r>
            </w:p>`;
        }

        const m = l.match(/^(.*?)(Tổ\s+trưởng|Tổ\s+viên|Tổ\s+phó)$/i);
        if (m) {
            const namePart = m[1].trim();
            const rolePart = m[2].trim();
            return `
            <w:p>
                <w:pPr><w:spacing w:after="30"/></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(namePart)} </w:t></w:r>
                <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(rolePart)}</w:t></w:r>
            </w:p>`;
        }

        if (/^\d+\.\s*(Đ\/c|[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ])/i.test(l) || l.includes('Đ/c')) {
            return `
            <w:p>
                <w:pPr><w:spacing w:after="30"/></w:pPr>
                <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(l)}</w:t></w:r>
            </w:p>`;
        }

        return `
        <w:p>
            <w:pPr><w:spacing w:after="30"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(l)}</w:t></w:r>
        </w:p>`;
    }).join('');

    return `
    <w:tc>
        <w:tcPr>
            <w:tcW w:w="${widthDxa}" w:type="dxa"/>
            <w:vAlign w:val="top"/>
            <w:tcBorders>
                <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            </w:tcBorders>
        </w:tcPr>
        ${parasXml}
    </w:tc>`;
}

function makeXmlCol6(lines, widthDxa, fontSize = 20) {
    if (!lines || lines.length === 0) {
        return `<w:tc><w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/><w:vAlign w:val="top"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:tc>`;
    }
    const parasXml = lines.map(l => {
        let isVehicleBold = false;
        if (l.startsWith('*') || /\d{2}[A-Z]\d?\s*-\s*[\d\.]+/.test(l)) {
            isVehicleBold = true;
        }

        if (anyStartsWith(l, ['- Phương tiện, thiết bị', '- Thiết bị', '- Phương tiện thông tin', '- Vũ khí', '- Súng', '- Gậy', '- Các biểu mẫu', '- Cân', '- Máy'])) {
            const parts = l.split(':');
            if (parts.length >= 2) {
                const p1 = parts[0] + ': ';
                const p2 = parts.slice(1).join(':').trim();
                return `
                <w:p>
                    <w:pPr><w:spacing w:after="30"/></w:pPr>
                    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(p1)}</w:t></w:r>
                    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(p2)}</w:t></w:r>
                </w:p>`;
            }
        }

        return `
        <w:p>
            <w:pPr><w:spacing w:after="30"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${isVehicleBold ? '<w:b/>' : ''}<w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(l)}</w:t></w:r>
        </w:p>`;
    }).join('');

    return `
    <w:tc>
        <w:tcPr>
            <w:tcW w:w="${widthDxa}" w:type="dxa"/>
            <w:vAlign w:val="top"/>
            <w:tcBorders>
                <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            </w:tcBorders>
        </w:tcPr>
        ${parasXml}
    </w:tc>`;
}

function makeXmlGeneral(lines, widthDxa, fontSize = 20) {
    if (!lines || lines.length === 0) {
        return `<w:tc><w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/><w:vAlign w:val="top"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:tc>`;
    }
    const parasXml = lines.map(l => {
        let isBold = false;
        if (/^(\*Tuần tra|\* Tuần tra|\*Kiểm soát|\* Kiểm soát|\* PC02|\d+\.\s+Tuần tra|\d+\.\s+Kiểm soát)/.test(l)) {
            isBold = true;
        }

        if (anyStartsWith(l, ['- Tuyến:', '- Thời gian:', '- Đối tượng', '- Hành vi', '- Tuyên truyền'])) {
            const parts = l.split(':');
            if (parts.length >= 2) {
                const p1 = parts[0] + ': ';
                const p2 = parts.slice(1).join(':').trim();
                return `
                <w:p>
                    <w:pPr><w:spacing w:after="30"/></w:pPr>
                    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(p1)}</w:t></w:r>
                    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(p2)}</w:t></w:r>
                </w:p>`;
            }
        }

        return `
        <w:p>
            <w:pPr><w:spacing w:after="30"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${isBold ? '<w:b/>' : ''}<w:sz w:val="${fontSize}"/></w:rPr><w:t>${escapeXml(l)}</w:t></w:r>
        </w:p>`;
    }).join('');

    return `
    <w:tc>
        <w:tcPr>
            <w:tcW w:w="${widthDxa}" w:type="dxa"/>
            <w:vAlign w:val="top"/>
            <w:tcBorders>
                <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
                <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            </w:tcBorders>
        </w:tcPr>
        ${parasXml}
    </w:tc>`;
}

function anyStartsWith(str, prefixes) {
    return prefixes.some(p => str.startsWith(p));
}
