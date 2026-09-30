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
let parsedSchedule = [];

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
const btnPrintPdf = document.getElementById('btn-print-pdf');

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

// Print Handler (Cleans browser header/footer)
if (btnPrintPdf) {
    btnPrintPdf.addEventListener('click', () => {
        const origTitle = document.title;
        document.title = "";
        window.print();
        setTimeout(() => {
            document.title = origTitle;
        }, 1000);
    });
}

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

if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

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

function splitGluedVietnameseWords(text) {
    if (!text) return "";
    let t = text;

    const replacements = [
        [/Cácbiểumẫutheothôngtư/gi, 'Các biểu mẫu theo Thông tư '],
        [/CácbiểumẫutheoNghịđịnh/gi, 'Các biểu mẫu theo Nghị định '],
        [/Cácbiểumẫu/gi, 'Các biểu mẫu '],
        [/biểumẫutheothôngtư/gi, 'biểu mẫu theo Thông tư '],
        [/biểumẫutheoNghịđịnh/gi, 'biểu mẫu theo Nghị định '],
        [/biểumẫu/gi, 'biểu mẫu '],
        [/theothôngtư/gi, 'theo Thông tư '],
        [/theoNghịđịnh/gi, 'theo Nghị định '],
        [/thôngtư(\d+)/gi, 'Thông tư $1'],
        [/Nghịđịnh(\d+)/gi, 'Nghị định $1'],
        [/BCAngày/gi, 'BCA ngày '],
        [/CPngày/gi, 'CP ngày '],
        [/vềĐTGLTNGT/gi, 'về ĐTGQTNGT'],
        [/vềĐTGQTNGT/gi, 'về ĐTGQTNGT'],
        [/củaChínhphủ/gi, 'của Chính phủ'],
        [/Chínhphủ/gi, 'Chính phủ'],
        [/c��aChính/gi, 'của Chính'],
        [/sửađổi,bổsung/gi, 'sửa đổi, bổ sung'],
        [/sửađổi,bổ/gi, 'sửa đổi, bổ '],
        [/bổsung/gi, 'bổ sung'],
        [/Va\s*ly\s*KNHT/gi, 'Va ly KNHT'],

        [/Motorolaseri/gi, 'Motorola seri: '],
        [/Motorolasêri/gi, 'Motorola seri: '],
        [/Audaxseri/gi, 'Audax seri: '],
        [/Audaxsêri/gi, 'Audax seri: '],
        [/Lifelocseri/gi, 'Lifeloc seri: '],
        [/ProdigyII/gi, 'Prodigy II'],
        [/Prodigy2S/gi, 'Prodigy 2S'],
        [/PRODIGY2S/gi, 'PRODIGY 2S'],
        [/PRODIGYII/gi, 'PRODIGY II'],
        [/Máyđonồngđộcồn/gi, 'Máy đo nồng độ cồn '],
        [/đonồngđộcồn/gi, 'đo nồng độ cồn '],
        [/nồngđộcồn/gi, 'nồng độ cồn'],
        [/súngbắnđạncaosu/gi, 'súng bắn đạn cao su '],
        [/súngbắnđạncao/gi, 'súng bắn đạn cao '],
        [/súngbắnđạn/gi, 'súng bắn đạn '],
        [/bắnđạncaosu/gi, 'bắn đạn cao su '],
        [/bắnđạncao/gi, 'bắn đạn cao '],
        [/đạncaosu/gi, 'đạn cao su'],
        [/khóasố8/gi, 'khóa số 8'],
        [/khóasố/gi, 'khóa số '],
        [/khóa8/gi, 'khóa số 8'],
        [/Gậychỉhuygiaothông/gi, 'Gậy chỉ huy giao thông'],
        [/Gậychỉhuy/gi, 'Gậy chỉ huy '],
        [/chỉhuygiaothông/gi, 'chỉ huy giao thông'],
        [/giaothông/gi, 'giao thông'],
        [/cọctiêuhìnhchópnón/gi, 'cọc tiêu hình chóp nón'],
        [/cọctiêu/gi, 'cọc tiêu '],
        [/hìnhchópnón/gi, 'hình chóp nón'],
        [/đènchiếusáng/gi, 'đèn chiếu sáng'],
        [/chiếusáng/gi, 'chiếu sáng'],
        [/điềukiệncầnthiết/gi, 'điều kiện cần thiết '],
        [/điềukiện/gi, 'điều kiện '],
        [/cầnthiếtkhác/gi, 'cần thiết khác '],
        [/theoquyđịnh/gi, 'theo quy định'],
        [/quyđịnh/gi, 'quy định'],
        [/Cânkiểmtratảitrọng/gi, 'Cân kiểm tra tải trọng '],
        [/kiểmtratảitrọng/gi, 'kiểm tra tải trọng '],
        [/tảitrọng/gi, 'tải trọng'],
        [/Máyđotốcđộ/gi, 'Máy đo tốc độ '],
        [/đotốcđộ/gi, 'đo tốc độ '],
        [/SpeedLidar/gi, 'Speed Lidar '],
        [/Máycamera/gi, 'Máy camera '],
        [/Thẻnhớ/gi, 'Thẻ nhớ '],
        [/Thẻnhớngoài/gi, 'Thẻ nhớ ngoài '],
        [/MáyquaySony/gi, 'Máy quay Sony '],
        [/Máyquay/gi, 'Máy quay '],

        [/Tuầntra,kiểmsoátcơđộng/gi, 'Tuần tra, kiểm soát cơ động'],
        [/Tuầntra,kiểmsoát/gi, 'Tuần tra, kiểm soát '],
        [/kiểmsoátcơđộng/gi, 'kiểm soát cơ động'],
        [/Kiểmsoáttại01điểm/gi, 'Kiểm soát tại 01 điểm '],
        [/Kiểmsoáttạimộtđiểm/gi, 'Kiểm soát tại một điểm '],
        [/trênđườnggiaothông/gi, 'trên đường giao thông'],
        [/đườnggiaothông/gi, 'đường giao thông'],
        [/Đốitượngkiểmsoát,xửlý/gi, 'Đối tượng kiểm soát, xử lý'],
        [/Đốitượngcầntậptrung/gi, 'Đối tượng cần tập trung '],
        [/Đốitượng/gi, 'Đối tượng '],
        [/kiểmsoát,xửlý/gi, 'kiểm soát, xử lý'],
        [/Người\s*tham\s*gia\s*giao\s*thông\s*đường\s*bộ/gi, 'Người tham gia giao thông đường bộ'],
        [/Ngườivàphươngtiện/gi, 'Người và phương tiện '],
        [/Hànhviviphạmkiểmsoát,xửlýtheochuyênđềgồm/gi, 'Hành vi vi phạm kiểm soát, xử lý theo chuyên đề gồm:'],
        [/Hànhviviphạmkiểmsoát,xửlý/gi, 'Hành vi vi phạm kiểm soát, xử lý'],
        [/Hànhviviphạm/gi, 'Hành vi vi phạm '],
        [/theochuyênđềgồm/gi, 'theo chuyên đề gồm: '],
        [/Chuyênđềxeba,bốnbánh/gi, 'Chuyên đề xe ba, bốn bánh '],
        [/tựsảnxuất,lắpráp/gi, 'tự sản xuất, lắp ráp '],
        [/xemôtô,xegắnmáy/gi, 'xe mô tô, xe gắn máy '],
        [/xekinhdoanhvậntải/gi, 'xe kinh doanh vận tải'],
        [/kinhdoanhvậntải/gi, 'kinh doanh vận tải'],
        [/Láixekinhdoanhvậntải/gi, 'Lái xe kinh doanh vận tải '],
        [/Chuyênđềhọcsinh/gi, 'Chuyên đề học sinh'],
        [/Chuyênđềchởhàngquátảitrọng,quákhổgiớihạn/gi, 'Chuyên đề chở hàng quá tải trọng, quá khổ giới hạn'],
        [/Chuyênđềnồngđộcồn/gi, 'Chuyên đề nồng độ cồn'],
        [/chuyểnhướngkhôngquansát/gi, 'chuyển hướng không quan sát'],
        [/đikhôngđúngphầnđường/gi, 'đi không đúng phần đường'],
        [/viphạmtốcđộ/gi, 'vi phạm tốc độ'],
        [/Phòngchốngđuaxetráiphép/gi, 'Phòng chống đua xe trái phép'],
        [/đuaxetráiphép/gi, 'đua xe trái phép'],
        [/Tuyêntruyền,điềutra,giảiquyếttainạngiaothông/gi, 'Tuyên truyền, điều tra, giải quyết tai nạn giao thông'],
        [/Tuyêntruyền,điềutra/gi, 'Tuyên truyền, điều tra'],
        [/giảiquyếttainạngiaothông/gi, 'giải quyết tai nạn giao thông'],
        [/theokhoản1Điều19/gi, 'theo khoản 1 Điều 19 '],
        [/Thôngtư73\/2024\/TT-BCAngày15\/11\/2024/gi, 'Thông tư 73/2024/TT-BCA ngày 15/11/2024']
    ];

    replacements.forEach(([pat, rep]) => {
        t = t.replace(pat, rep);
    });

    t = t.replace(/[ \t]+/g, ' ');
    return t.trim();
}

function cleanCellLines(lines) {
    if (!lines || lines.length === 0) return [];
    let raw = lines.join('\n');

    // 1. Remove stray chainage numbers that attached to header lines
    raw = raw.replace(/(\*?\s*Tuần tra,\s*kiểm soát\s*cơ động\s*):?\s*\+\d+/gi, '$1:');
    raw = raw.replace(/(\*?\s*Tuần tra,\s*kiểm soát\s*công khai[^:]*):?\s*\+\d+/gi, '$1:');
    raw = raw.replace(/(1\.\s*Tuần tra,\s*kiểm soát\s*cơ động\s*):?\s*\+\d+/gi, '$1:');
    raw = raw.replace(/(2\.\s*Kiểm soát\s*tại[^:]*):?\s*\+\d+/gi, '$1:');
    raw = raw.replace(/:\s*\+\d+/g, ':');

    // 2. Standardize Route 1 (Trà Vinh cũ): QL53 (Km 43+108 -> 166+858), QL53B, QL54 (82+700 -> 148+200), QL60 (11+308 -> 101+226)
    if (raw.includes('QL53') && (raw.includes('43') || raw.includes('166')) && raw.includes('Trà Vinh cũ')) {
        raw = raw.replace(
            /QL53.*?101.*?(?=Các tuyến đường|$)/s,
            'QL53, từ Km 43+108 đến Km 166+858; QL53B; QL54, từ Km 82+700 đến Km 148+200; QL60, từ Km 11+308 đến Km 101+226; '
        );
    }

    // 3. Standardize Route 2 (Trà Vinh, Nguyệt Hóa...): QL53 (Km 56+700 -> 65+450), QL54 (144+450 -> 148+200), QL60 (71 -> 72)
    if (raw.includes('QL53') && (raw.includes('56') || raw.includes('65')) && (raw.includes('Trà Vinh') || raw.includes('Nguyệt Hóa'))) {
        raw = raw.replace(
            /QL53.*?Km\s*72;?/s,
            'QL53, từ Km 56+700 đến Km 65+450; QL54, từ Km 144+450 đến Km 148+200; QL60, từ Km 71 đến Km 72;'
        );
    }

    // 4. General chainage cleaners
    raw = raw.replace(/Km\s+(\d+)\s+đến\s+Km\s*\+(\d+)\+(\d+)\s+(\d+)/g, 'Km $1+$2 đến Km $4+$3');
    raw = raw.replace(/Km\s+(\d+)\s*\+(\d+)\s+đến\s+Km\s+(\d+)\s*\+(\d+)/g, 'Km $1+$2 đến Km $3+$4');
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

        // Apply word splitter
        l = splitGluedVietnameseWords(l);

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

function renderHtmlWithSuperscripts(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    return escaped.replace(/(Km\s+\d+|\d+)(\+\d+)/gi, '$1<sup class="font-bold text-[10px]">$2</sup>');
}

function renderScheduleTable() {
    let totalShifts = 0;
    scheduleTableBody.innerHTML = '';

    parsedSchedule.forEach(day => {
        if (!day.tvTos || day.tvTos.length === 0) return;

        totalShifts += day.tvTos.length;

        day.tvTos.forEach((s, idx) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-black align-top';

            let col1Html = '';
            if (idx === 0) {
                col1Html = `
                    <td rowspan="${day.tvTos.length}" class="py-2.5 px-1.5 text-center align-middle font-bold text-black border border-black bg-slate-50/40">
                        <div class="font-bold text-[13px]">${escapeHtml(day.day)}</div>
                        <div class="text-[12px] text-slate-800 mt-1">${escapeHtml(day.date)}</div>
                    </td>
                `;
            }

            // Column 2: Tên Tổ (bold), Tên cán bộ (bold), Tổ trưởng/Tổ viên (regular)
            let col2Html = s.col2Lines.map(l => {
                let esc = escapeHtml(l);
                if (/^Tổ\s+\d+/i.test(l)) {
                    return `<div class="font-bold text-[13px] mb-1">${esc}</div>`;
                }
                if (l === 'Tổ trưởng' || l === 'Tổ viên' || l === 'Tổ  viên' || l === 'Tổ phó') {
                    return `<div class="font-normal text-slate-800">${esc}</div>`;
                }
                const m = l.match(/^(.*?)(Tổ\s+trưởng|Tổ\s+viên|Tổ\s+phó)$/i);
                if (m) {
                    return `<div><strong class="font-bold">${escapeHtml(m[1].trim())}</strong> <span class="font-normal text-slate-800">${escapeHtml(m[2])}</span></div>`;
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
                <td class="py-2 px-1.5 border border-black text-[12px] leading-snug">
                    ${col2Html}
                </td>
                <td class="py-2 px-1.5 border border-black text-[12px] leading-snug text-center">
                    ${col3Html}
                </td>
                <td class="py-2 px-1.5 border border-black text-[12px] leading-snug">
                    ${col4Html}
                </td>
                <td class="py-2 px-1.5 border border-black text-[12px] leading-snug">
                    ${col5Html}
                </td>
                <td class="py-2 px-1.5 border border-black text-[12px] leading-snug">
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
        if (/^(\*Tuần tra|\* Tuần tra|\*Kiểm soát|\* Kiểm soát|\* PC02|\d+\.\s+Tuần tra|\d+\.\s+Kiểm soát)/i.test(l)) {
            return `<div class="font-bold mt-1">${renderHtmlWithSuperscripts(l)}</div>`;
        }
        if (/^(- Tuyến:|- Thời gian:|- Đối tượng[^:]*:|- Hành vi[^:]*:|- Tuyên truyền[^:]*:)/i.test(l)) {
            const parts = l.split(':');
            if (parts.length >= 2) {
                const header = escapeHtml(parts[0]) + ': ';
                const content = renderHtmlWithSuperscripts(parts.slice(1).join(':').trim());
                return `<div><strong class="font-bold">${header}</strong>${content}</div>`;
            }
        }
        return `<div>${renderHtmlWithSuperscripts(l)}</div>`;
    }).join('');
}

function renderCol6LinesHtml(lines) {
    if (!lines || lines.length === 0) return '';
    return lines.map(l => {
        if (l.startsWith('*') || /\d{2}[A-Z]\d?\s*-\s*[\d\.]+/.test(l)) {
            return `<div class="font-bold text-slate-950">${escapeHtml(l)}</div>`;
        }
        if (/^(- Phương tiện, thiết bị|- Thiết bị|- Phương tiện thông tin|- Vũ khí|- Súng|- Gậy|- Các biểu mẫu|- Cân|- Máy)/i.test(l)) {
            const parts = l.split(':');
            if (parts.length >= 2) {
                const header = escapeHtml(parts[0]) + ': ';
                const content = escapeHtml(parts.slice(1).join(':').trim());
                return `<div><strong class="font-bold">${header}</strong>${content}</div>`;
            }
        }
        return `<div>${escapeHtml(l)}</div>`;
    }).join('');
}

// Strict OpenXML Helpers for Word Document Export (Complies with ISO/IEC 29500 XSD Schema)
function makeRPr(font = "Times New Roman", bold = false, italic = false, sz = 20, vertAlign = null) {
    let xml = `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`;
    if (bold) xml += `<w:b/><w:bCs/>`;
    if (italic) xml += `<w:i/><w:iCs/>`;
    xml += `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
    if (vertAlign) xml += `<w:vertAlign w:val="${vertAlign}"/>`;
    xml += `</w:rPr>`;
    return xml;
}

function makePPr(align = "left", spaceAfter = 40, spaceBefore = 0, lineSpacing = 240) {
    let xml = `<w:pPr><w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}" w:line="${lineSpacing}" w:lineRule="auto"/>`;
    if (align !== "left") xml += `<w:jc w:val="${align}"/>`;
    xml += `</w:pPr>`;
    return xml;
}

function makeTcPr(widthDxa, vMerge = null, gridSpan = null, shading = null, vAlign = "top", borders = true) {
    let xml = `<w:tcPr><w:tcW w:w="${widthDxa}" w:type="dxa"/>`;
    if (gridSpan && gridSpan > 1) xml += `<w:gridSpan w:val="${gridSpan}"/>`;
    if (vMerge === "restart") xml += `<w:vMerge w:val="restart"/>`;
    else if (vMerge === "continue") xml += `<w:vMerge/>`;

    if (borders) {
        xml += `<w:tcBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tcBorders>`;
    }
    if (shading) xml += `<w:shd w:val="clear" w:fill="${shading}"/>`;
    xml += `<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>`;
    if (vAlign) xml += `<w:vAlign w:val="${vAlign}"/>`;
    xml += `</w:tcPr>`;
    return xml;
}

// Export Word Document (.docx)
btnExportDocx.addEventListener('click', async () => {
    if (!parsedSchedule || parsedSchedule.length === 0) {
        alert("Vui lòng tải lên và xử lý file PDF trước khi xuất Word!");
        return;
    }

    try {
        const zip = new JSZip();

        // 1. [Content_Types].xml
        const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
</Types>`;

        // 2. Root _rels/.rels (Target="word/document.xml")
        const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

        // 3. Document _rels: word/_rels/document.xml.rels
        const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
</Relationships>`;

        // 4. word/styles.xml
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

        // 5. word/fontTable.xml
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
        const r1TcPr = makeTcPr(15000, null, 6, "D9E1F2", "center", true);
        const r1PPr = makePPr("center", 0, 0, 240);
        const r1RPr = makeRPr("Times New Roman", true, false, 24);
        tableRowsXml += `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr><w:tc>${r1TcPr}<w:p>${r1PPr}<w:r>${r1RPr}<w:t>Nội dung</w:t></w:r></w:p></w:tc></w:tr>`;

        // Row 2: Headers
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
            const tcPr = makeTcPr(ch.w, null, null, "F2F2F2", "center", true);
            const linesXml = ch.t.split('\n').map(l => {
                const pPr = makePPr("center", 20, 0, 240);
                const rPr = makeRPr("Times New Roman", true, false, 20);
                return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
            }).join('');
            tableRowsXml += `<w:tc>${tcPr}${linesXml}</w:tc>`;
        });
        tableRowsXml += `</w:tr>`;

        // Body Rows
        parsedSchedule.forEach(day => {
            if (!day.tvTos || day.tvTos.length === 0) return;

            day.tvTos.forEach((s, idx) => {
                tableRowsXml += `<w:tr><w:trPr><w:cantSplit/></w:trPr>`;

                // Col 1: Date with vMerge
                if (idx === 0) {
                    const tcPr = makeTcPr(1300, "restart", null, null, "center", true);
                    const p1Pr = makePPr("center", 20, 0, 240);
                    const r1Pr = makeRPr("Times New Roman", true, false, 22);
                    const p2Pr = makePPr("center", 0, 0, 240);
                    const r2Pr = makeRPr("Times New Roman", true, false, 20);
                    tableRowsXml += `<w:tc>${tcPr}<w:p>${p1Pr}<w:r>${r1Pr}<w:t>${escapeXml(day.day)}</w:t></w:r></w:p><w:p>${p2Pr}<w:r>${r2Pr}<w:t>${escapeXml(day.date)}</w:t></w:r></w:p></w:tc>`;
                } else {
                    const tcPr = makeTcPr(1300, "continue", null, null, "center", true);
                    const pPr = makePPr("left", 0, 0, 240);
                    tableRowsXml += `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
                }

                tableRowsXml += makeDocxXmlCol2(s.col2Lines, 2200, 22);
                tableRowsXml += makeDocxXmlGeneral(s.col3Lines, 1300, 20);
                tableRowsXml += makeDocxXmlWithSuperscript(s.col4Lines, 3600, 20);
                tableRowsXml += makeDocxXmlGeneral(s.col5Lines, 2900, 20);
                tableRowsXml += makeDocxXmlCol6(s.col6Lines, 3700, 20);

                tableRowsXml += `</w:tr>`;
            });
        });

        // 6. word/document.xml (Completely free of raw \n in <w:t>)
        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
        ${makePPr("right", 100, 0, 240)}
        <w:r>${makeRPr("Times New Roman", true, false, 20)}<w:t>Mẫu số 03/TT</w:t></w:r>
        <w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:br/></w:r>
        <w:r>${makeRPr("Times New Roman", false, true, 18)}<w:t>(Kèm theo Thông tư số 14/2025/TT-BCA ngày 28/02/2025 của Bộ trưởng Bộ Công an)</w:t></w:r>
    </w:p>
    <w:tbl>
        <w:tblPr>
            <w:tblW w:w="15000" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
                <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
            </w:tblBorders>
        </w:tblPr>
        <w:tblGrid>
            <w:gridCol w:w="7000"/>
            <w:gridCol w:w="8000"/>
        </w:tblGrid>
        <w:tr>
            <w:tc>
                <w:tcPr><w:tcW w:w="7000" w:type="dxa"/></w:tcPr>
                <w:p>${makePPr("center", 40, 0, 240)}<w:r>${makeRPr("Times New Roman", false, false, 24)}<w:t>PHÒNG CẢNH SÁT GIAO THÔNG</w:t></w:r></w:p>
                <w:p>${makePPr("center", 20, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>ĐỘI CẢNH SÁT GIAO THÔNG</w:t></w:r></w:p>
                <w:p>${makePPr("center", 40, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>ĐƯỜNG BỘ</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="8000" w:type="dxa"/></w:tcPr>
                <w:p>${makePPr("center", 40, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</w:t></w:r></w:p>
                <w:p>${makePPr("center", 60, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>Độc lập - Tự do - Hạnh phúc</w:t></w:r></w:p>
                <w:p>${makePPr("center", 40, 0, 240)}<w:r>${makeRPr("Times New Roman", false, true, 22)}<w:t>Vĩnh Long, ngày 28 tháng 9 năm 2026</w:t></w:r></w:p>
            </w:tc>
        </w:tr>
    </w:tbl>
    <w:p>
        ${makePPr("center", 40, 150, 240)}
        <w:r>${makeRPr("Times New Roman", true, false, 30)}<w:t>KẾ HOẠCH CÔNG TÁC TUẦN</w:t></w:r>
    </w:p>
    <w:p>
        ${makePPr("center", 150, 0, 240)}
        <w:r>${makeRPr("Times New Roman", true, true, 24)}<w:t>(Từ ngày 28/9/2026 đến ngày 04/10/2026)</w:t></w:r>
    </w:p>
    <w:p>
        ${makePPr("both", 150, 0, 260)}
        <w:r>${makeRPr("Times New Roman", false, false, 22)}<w:t>1. Thực hiện Kế hoạch số 121/KH-PC08 ngày 22/10/2024 của Phòng PC08, Công an tỉnh Vĩnh Long về thực hiện cao điểm tổng rà soát, phát hiện, thống kê người điều khiển phương tiện mà trong cơ thể có chất ma túy; các điểm, tụ điểm phức tạp về ma túy và đấu tranh, phòng chống tội phạm về ma túy của lực lượng Cảnh sát giao thông trên địa bàn tỉnh; Kế hoạch số 2487/KH-CAT ngày 30/12/2025 của Công an tỉnh về huy động lực lượng khác trong Công an tỉnh phối hợp tuần tra, kiểm soát bảo đảm trật tự, an toàn giao thông đường bộ; Kế hoạch 22/KH-PC08 ngày 18/3/2026 của Phòng PC08 về việc tuần tra, kiểm tra, kiểm soát, xử lý các chuyên đề vi phạm là nguyên nhân chính gây tai nạn giao thông trên các tuyến giao thông đường bộ; Kế hoạch số 166/KH-PC08 ngày 09/6/2026 của Phòng PC08 về việc thực hiện cao điểm phối hợp tuyên truyền, tấn công trấn áp tội phạm về ma tuý giữa Việt Nam, Trung Quốc, Lào và Myanmar trên các tuyến giao thông của lực lượng Cảnh sát giao thông; Kế hoạch số 399/KH-CAT-PC08 ngày 25/8/2026 của Công an tỉnh về tổng kiểm soát, xử lý vi phạm về trật tự an toàn giao thông đường bộ đối với phương tiện kinh doanh vận tải trên địa bàn tỉnh; Kế hoạch số 197/KH-PC08 ngày 14/9/2026 của Phòng PC08 về việc phối hợp tuần tra, kiểm soát phòng, chống đua xe trái phép và phòng chống các loại tội phạm hoạt động theo các tuyến giao thông trên địa bàn tỉnh; Căn cứ kết quả công tác điều tra cơ bản tuyến, điều tra, giải quyết tai nạn giao thông, kết quả xử lý vi phạm giao thông, tình hình trật tự, an toàn giao thông, trật tự xã hội, vi phạm giao thông nổi lên từ ngày 21/9/2026 đến ngày 27/9/2026, Đội Cảnh sát giao thông đường bộ xây dựng kế hoạch công tác tuần như sau:</w:t></w:r>
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
        ${makePPr("left", 40, 150, 240)}
        <w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>2. Thực hiện yêu cầu, nhiệm vụ khác của Trưởng phòng (nếu có):</w:t></w:r>
    </w:p>
    <w:p>
        ${makePPr("left", 150, 0, 240)}
        <w:r>${makeRPr("Times New Roman", false, false, 22)}<w:t>Tùy theo tình hình thực tế giao cho chỉ huy Đội Cảnh sát giao thông đường bộ báo cáo Lãnh đạo phòng thay đổi tuyến, địa bàn, thời gian, lực lượng, phương tiện, thiết bị kỹ thuật nghiệp vụ, công cụ hỗ trợ và các điều kiện khác trong kế hoạch ngày cho phù hợp.</w:t></w:r>
    </w:p>
    <w:tbl>
        <w:tblPr>
            <w:tblW w:w="15000" w:type="dxa"/>
            <w:jc w:val="center"/>
            <w:tblBorders>
                <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
            </w:tblBorders>
        </w:tblPr>
        <w:tblGrid>
            <w:gridCol w:w="5000"/>
            <w:gridCol w:w="5000"/>
            <w:gridCol w:w="5000"/>
        </w:tblGrid>
        <w:tr>
            <w:tc>
                <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
                <w:p>${makePPr("left", 20, 0, 240)}<w:r>${makeRPr("Times New Roman", true, true, 22)}<w:t>Nơi nhận:</w:t></w:r></w:p>
                <w:p>${makePPr("left", 10, 0, 240)}<w:r>${makeRPr("Times New Roman", false, false, 20)}<w:t>- Đ/c Trưởng phòng (để chỉ đạo);</w:t></w:r></w:p>
                <w:p>${makePPr("left", 10, 0, 240)}<w:r>${makeRPr("Times New Roman", false, false, 20)}<w:t>- Đ/c PTP phụ trách (để chỉ đạo);</w:t></w:r></w:p>
                <w:p>${makePPr("left", 10, 0, 240)}<w:r>${makeRPr("Times New Roman", false, false, 20)}<w:t>- PC02, PC06, PK02, CAX (để p/h thực hiện);</w:t></w:r></w:p>
                <w:p>${makePPr("left", 10, 0, 240)}<w:r>${makeRPr("Times New Roman", false, false, 20)}<w:t>- Lưu: Đội CSGTĐB, VT.</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
                <w:p>${makePPr("center", 800, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>ĐỘI TRƯỞNG</w:t></w:r></w:p>
                <w:p>${makePPr("center", 0, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>Thượng tá Trần Văn Tiếp</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="5000" w:type="dxa"/></w:tcPr>
                <w:p>${makePPr("center", 20, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>KT. TRƯỞNG PHÒNG</w:t></w:r></w:p>
                <w:p>${makePPr("center", 800, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>PHÓ TRƯỞNG PHÒNG</w:t></w:r></w:p>
                <w:p>${makePPr("center", 0, 0, 240)}<w:r>${makeRPr("Times New Roman", true, false, 24)}<w:t>Thượng tá Nguyễn Ngọc Ân</w:t></w:r></w:p>
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
        zip.file('_rels/.rels', rootRelsXml);
        zip.file('word/_rels/document.xml.rels', documentRelsXml);
        zip.file('word/document.xml', documentXml);
        zip.file('word/styles.xml', stylesXml);
        zip.file('word/fontTable.xml', fontTableXml);

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
    let s = String(unsafe).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return s.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

function makeDocxXmlCol2(lines, widthDxa, fontSize = 22) {
    if (!lines || lines.length === 0) {
        const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
        const pPr = makePPr("left", 0, 0, 240);
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
    }

    const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
    const parasXml = lines.map(l => {
        l = l.trim();
        const pPr = makePPr("left", 30, 0, 240);

        if (/^Tổ\s+\d+/i.test(l)) {
            const rPr = makeRPr("Times New Roman", true, false, fontSize);
            return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
        }

        if (l === 'Tổ trưởng' || l === 'Tổ viên' || l === 'Tổ  viên' || l === 'Tổ phó') {
            const rPr = makeRPr("Times New Roman", false, false, fontSize);
            return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
        }

        const m = l.match(/^(.*?)(Tổ\s+trưởng|Tổ\s+viên|Tổ\s+phó)$/i);
        if (m) {
            const namePart = m[1].trim();
            const rolePart = m[2].trim();
            const r1Pr = makeRPr("Times New Roman", true, false, fontSize);
            const r2Pr = makeRPr("Times New Roman", false, false, fontSize);
            return `<w:p>${pPr}<w:r>${r1Pr}<w:t xml:space="preserve">${escapeXml(namePart)} </w:t></w:r><w:r>${r2Pr}<w:t>${escapeXml(rolePart)}</w:t></w:r></w:p>`;
        }

        if (/^\d+\.\s*(Đ\/c|[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ])/i.test(l) || l.includes('Đ/c')) {
            const rPr = makeRPr("Times New Roman", true, false, fontSize);
            return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
        }

        const rPr = makeRPr("Times New Roman", false, false, fontSize);
        return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
    }).join('');

    return `<w:tc>${tcPr}${parasXml}</w:tc>`;
}

function makeDocxXmlWithSuperscript(lines, widthDxa, fontSize = 20) {
    if (!lines || lines.length === 0) {
        const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
        const pPr = makePPr("left", 0, 0, 240);
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
    }

    const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
    const parasXml = lines.map(l => {
        let isHeaderBold = false;
        if (/^(\*Tuần tra|\* Tuần tra|\*Kiểm soát|\* Kiểm soát|\* PC02|\d+\.\s+Tuần tra|\d+\.\s+Kiểm soát)/.test(l)) {
            isHeaderBold = true;
        }

        const pPr = makePPr("left", 30, 0, 240);

        if (anyStartsWith(l, ['- Tuyến:', '- Thời gian:'])) {
            const parts = l.split(':');
            if (parts.length >= 2) {
                const p1 = parts[0] + ': ';
                const p2 = parts.slice(1).join(':').trim();
                const r1Pr = makeRPr("Times New Roman", true, false, fontSize);
                return `<w:p>${pPr}<w:r>${r1Pr}<w:t xml:space="preserve">${escapeXml(p1)}</w:t></w:r>${formatDocxChainageRuns(p2, false, fontSize)}</w:p>`;
            }
        }

        return `<w:p>${pPr}${formatDocxChainageRuns(l, isHeaderBold, fontSize)}</w:p>`;
    }).join('');

    return `<w:tc>${tcPr}${parasXml}</w:tc>`;
}

function formatDocxChainageRuns(text, isBold, fontSize) {
    const pattern = /(Km\s+\d+|\d+)(\+\d+)/gi;
    let pos = 0;
    let runsXml = '';
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        const end = pattern.lastIndex;

        if (start > pos) {
            const rPr = makeRPr("Times New Roman", isBold, false, fontSize);
            runsXml += `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text.substring(pos, start))}</w:t></w:r>`;
        }

        const kmPart = match[1];
        const plusPart = match[2];

        const kmRPr = makeRPr("Times New Roman", isBold, false, fontSize);
        const plusRPr = makeRPr("Times New Roman", isBold, false, fontSize - 4, "superscript");

        runsXml += `<w:r>${kmRPr}<w:t xml:space="preserve">${escapeXml(kmPart)}</w:t></w:r>`;
        runsXml += `<w:r>${plusRPr}<w:t xml:space="preserve">${escapeXml(plusPart)}</w:t></w:r>`;

        pos = end;
    }

    if (pos < text.length) {
        const rPr = makeRPr("Times New Roman", isBold, false, fontSize);
        runsXml += `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text.substring(pos))}</w:t></w:r>`;
    }

    return runsXml || `<w:r>${makeRPr("Times New Roman", isBold, false, fontSize)}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function makeDocxXmlCol6(lines, widthDxa, fontSize = 20) {
    if (!lines || lines.length === 0) {
        const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
        const pPr = makePPr("left", 0, 0, 240);
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
    }

    const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
    const parasXml = lines.map(l => {
        let isVehicleBold = false;
        if (l.startsWith('*') || /\d{2}[A-Z]\d?\s*-\s*[\d\.]+/.test(l)) {
            isVehicleBold = true;
        }

        const pPr = makePPr("left", 30, 0, 240);

        if (anyStartsWith(l, ['- Phương tiện, thiết bị', '- Thiết bị', '- Phương tiện thông tin', '- Vũ khí', '- Súng', '- Gậy', '- Các biểu mẫu', '- Cân', '- Máy'])) {
            const parts = l.split(':');
            if (parts.length >= 2) {
                const p1 = parts[0] + ': ';
                const p2 = parts.slice(1).join(':').trim();
                const r1Pr = makeRPr("Times New Roman", true, false, fontSize);
                const r2Pr = makeRPr("Times New Roman", false, false, fontSize);
                return `<w:p>${pPr}<w:r>${r1Pr}<w:t xml:space="preserve">${escapeXml(p1)}</w:t></w:r><w:r>${r2Pr}<w:t>${escapeXml(p2)}</w:t></w:r></w:p>`;
            }
        }

        const rPr = makeRPr("Times New Roman", isVehicleBold, false, fontSize);
        return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
    }).join('');

    return `<w:tc>${tcPr}${parasXml}</w:tc>`;
}

function makeDocxXmlGeneral(lines, widthDxa, fontSize = 20) {
    if (!lines || lines.length === 0) {
        const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
        const pPr = makePPr("left", 0, 0, 240);
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
    }

    const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
    const parasXml = lines.map(l => {
        let isBold = false;
        if (/^(\*Tuần tra|\* Tuần tra|\*Kiểm soát|\* Kiểm soát|\* PC02|\d+\.\s+Tuần tra|\d+\.\s+Kiểm soát)/.test(l)) {
            isBold = true;
        }

        const pPr = makePPr("left", 30, 0, 240);

        if (anyStartsWith(l, ['- Tuyến:', '- Thời gian:', '- Đối tượng', '- Hành vi', '- Tuyên truyền'])) {
            const parts = l.split(':');
            if (parts.length >= 2) {
                const p1 = parts[0] + ': ';
                const p2 = parts.slice(1).join(':').trim();
                const r1Pr = makeRPr("Times New Roman", true, false, fontSize);
                const r2Pr = makeRPr("Times New Roman", false, false, fontSize);
                return `<w:p>${pPr}<w:r>${r1Pr}<w:t xml:space="preserve">${escapeXml(p1)}</w:t></w:r><w:r>${r2Pr}<w:t>${escapeXml(p2)}</w:t></w:r></w:p>`;
            }
        }

        const rPr = makeRPr("Times New Roman", isBold, false, fontSize);
        return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
    }).join('');

    return `<w:tc>${tcPr}${parasXml}</w:tc>`;
}

function anyStartsWith(str, prefixes) {
    return prefixes.some(p => str.startsWith(p));
}
