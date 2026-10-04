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
let currentDocMetadata = null;

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

// Print Handler (Cleans browser header/footer & Sets default file name)
if (btnPrintPdf) {
    btnPrintPdf.addEventListener('click', () => {
        const origTitle = document.title;
        document.title = "KE_HOACH_CONG_TAC_TUAN_TO_TRA_VINH";
        window.print();
        setTimeout(() => {
            document.title = origTitle;
        }, 1500);
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

function handleSelectedFile(file) {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
        alert("Vui lòng chọn hoặc kéo thả file có định dạng PDF (.pdf)!");
        return;
    }

    currentPdfFile = file;
    uploadStatusText.innerText = `Đã chọn: ${file.name}`;
    uploadDetailText.innerText = `Kích thước: ${(file.size / (1024 * 1024)).toFixed(2)} MB - Sẵn sàng tách ca`;
    btnProcess.disabled = false;
    statusLabel.innerText = "Đã nạp file PDF";

    // Auto-process for convenience
    btnProcess.click();
}

pdfFileInput.addEventListener('click', () => {
    pdfFileInput.value = '';
});

pdfFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
        handleSelectedFile(file);
    }
});

// Dropzone Drag & Drop Support
const dropZone = document.querySelector('label[for="pdf-file-input"]');
if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('border-red-600', 'bg-red-50/50');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-red-600', 'bg-red-50/50');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt && dt.files && dt.files[0];
        if (file) {
            handleSelectedFile(file);
        }
    });
}

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

        progressText.innerText = "Đang trích xuất thông tin Kế hoạch và tách ca Tổ Trà Vinh...";
        progressBar.style.width = `85%`;
        progressPct.innerText = `85%`;

        currentDocMetadata = extractDocMetadata(allRuns);
        parsedSchedule = parseWeeklyScheduleFromRuns(allRuns, currentDocMetadata);

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

        if (prev.text.endsWith(' ') || cur.text.startsWith(' ')) {
            res += cur.text;
        } else if (gap >= 2.2) {
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
        [/độngkết\s*hợp/gi, 'động kết hợp'],
        [/độngkết/gi, 'động kết '],
        [/kếthợpvới/gi, 'kết hợp với '],
        [/kếthợp/gi, 'kết hợp '],
        [/hợpvới/gi, 'hợp với '],
        [/tạimộtđiểm/gi, 'tại một điểm '],
        [/mộtđiểm/gi, 'một điểm '],
        [/trênđườnggiaothông/gi, 'trên đường giao thông'],
        [/trênđường/gi, 'trên đường '],
        [/đườnggiaothông/gi, 'đường giao thông'],
        [/giaothông/gi, 'giao thông'],
        [/VĩnhLong/gi, 'Vĩnh Long'],
        [/TràVinh/gi, 'Trà Vinh'],
        [/NguyệtHóa/gi, 'Nguyệt Hóa'],
        [/HoàThuận/gi, 'Hoà Thuận'],
        [/LongĐức/gi, 'Long Đức'],
        [/1\.Tuầntra/gi, '1. Tuần tra'],
        [/1\.\s*Tuầntra/gi, '1. Tuần tra'],
        [/2\.Kiểmsoát/gi, '2. Kiểm soát'],
        [/2\.\s*Kiểmsoát/gi, '2. Kiểm soát'],
        [/-Tuyến:QL/gi, '- Tuyến: QL'],
        [/-Tuyến:/gi, '- Tuyến: '],
        [/-Thời gian:/gi, '- Thời gian: '],
        [/-Thờigian:/gi, '- Thời gian: '],
        [/-Hành vi/gi, '- Hành vi'],
        [/xử lýtheo/gi, 'xử lý theo'],
        [/xửlýtheo/gi, 'xử lý theo'],
        [/chuyên đề gồm:\s*:/gi, 'chuyên đề gồm:'],
        [/chuyên đề gồm: :/gi, 'chuyên đề gồm:'],
        [/Viphạmnồng độ cồn/gi, 'Vi phạm nồng độ cồn'],
        [/\(1\)\s*Viphạm/gi, '(1) Vi phạm '],
        [/\(1\)\s*Vi\s*phạm\s*nồng\s*độ\s*cồn\s*,\s*matúy/gi, '(1) Vi phạm nồng độ cồn, ma túy'],
        [/,matúy/gi, ', ma túy'],
        [/máykèotheoxekhác/gi, 'máy kéo theo xe khác'],
        [/máykèotheo/gi, 'máy kéo theo '],
        [/kèotheoxekhác/gi, 'kéo theo xe khác'],
        [/,vậtkhác/gi, ', vật khác'],
        [/\(3\)\s*Chuyênđề/gi, '(3) Chuyên đề '],
        [/\(4\)\s*Chuyênđề/gi, '(4) Chuyên đề '],
        [/\(5\)\s*Viphạm/gi, '(5) Vi phạm '],
        [/\(5\)\s*Vi\s*phạm/gi, '(5) Vi phạm '],
        [/-Phương tiện/gi, '- Phương tiện'],
        [/-Phươngtiện/gi, '- Phương tiện'],
        [/-Vũkhí/gi, '- Vũ khí'],
        [/-Vũ khí,công/gi, '- Vũ khí, công'],
        [/23\/12\/2021của/gi, '23/12/2021 của'],
        [/-Các biểu mẫu/gi, '- Các biểu mẫu'],
        [/-Cácbiểumẫu/gi, '- Các biểu mẫu'],
        [/HoàngTuấn/gi, 'Hoàng Tuấn'],
        [/VõHoàng/gi, 'Võ Hoàng'],
        [/ThạchSô/gi, 'Thạch Sô'],
        [/RanThi/gi, 'Ran Thi'],
        [/ThịỬng/gi, 'Thị Ửng'],
        [/HồngLài/gi, 'Hồng Lài'],
        [/MinhThắng/gi, 'Minh Thắng'],
        [/VũCường/gi, 'Vũ Cường'],
        [/VănNhiệm/gi, 'Văn Nhiệm'],
        [/LêDuy/gi, 'Lê Duy'],
        [/HàPhương/gi, 'Hà Phương'],
        [/VănViệt/gi, 'Văn Việt'],
        [/TrungNhu/gi, 'Trung Nhu'],
        [/ThanhTruyền/gi, 'Thanh Truyền'],
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

    // Fix and unify all combined headings FIRST (including all variants with colons, newlines, duplicate bullets)
    raw = raw.replace(/\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*Kiểm\s*soát\s*tại\s*một\s*điểm\s*(?:\r?\n|\s)*trên\s*đường\s*giao\s*thông:?/gi, '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:');
    raw = raw.replace(/\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*kiểm\s*soát\s*tại\s*một\s*điểm\s*(?:\r?\n|\s)*trên\s*đường\s*giao\s*thông:?/gi, '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:');

    raw = raw.replace(/\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*công\s*khai:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*(?:hoá|hóa)\s*trang:?/gi, '* Tuần tra, kiểm soát công khai kết hợp với hoá trang:');

    // Separate multiple headers or sub-items onto new lines
    raw = raw.replace(/([^\n])\s*(\*\s*Tuần tra|\b1\.\s*Tuần tra|\b2\.\s*Kiểm soát|\*\s*Kiểm soát)/gi, '$1\n$2');
    raw = raw.replace(/([^\n])\s*(-\s*Tuyến:|-\s*Thời gian:|-\s*Đối tượng:|-\s*Nhiệm vụ:)/gi, '$1\n$2');

    // Re-verify combined heading after line separation
    raw = raw.replace(/\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*Kiểm\s*soát\s*tại\s*một\s*điểm\s*(?:\r?\n|\s)*trên\s*đường\s*giao\s*thông:?/gi, '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:');
    raw = raw.replace(/\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*kiểm\s*soát\s*tại\s*một\s*điểm\s*(?:\r?\n|\s)*trên\s*đường\s*giao\s*thông:?/gi, '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:');
    raw = raw.replace(/\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*công\s*khai:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*(?:hoá|hóa)\s*trang:?/gi, '* Tuần tra, kiểm soát công khai kết hợp với hoá trang:');

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
    const linesArr = raw.split('\n');
    for (let i = 0; i < linesArr.length; i++) {
        let l = linesArr[i].trim();
        if (!l) continue;

        // Merge split combined heading lines if any were separated across lines
        if (clean.length > 0 && /Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động.*kết\s*hợp\s*với:?$/i.test(clean[clean.length - 1]) && /^\*?\s*Kiểm\s*soát\s*tại\s*một\s*điểm\s*trên\s*đường\s*giao\s*thông/i.test(l)) {
            clean[clean.length - 1] = '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:';
            continue;
        }

        if (clean.length > 0 && /Tuần\s*tra,\s*kiểm\s*soát\s*công\s*khai.*kết\s*hợp\s*với:?$/i.test(clean[clean.length - 1]) && /^\*?\s*(?:hoá|hóa)\s*trang:?/i.test(l)) {
            clean[clean.length - 1] = '* Tuần tra, kiểm soát công khai kết hợp với hoá trang:';
            continue;
        }

        if (/^\+\d+$/.test(l)) {
            if (clean.length > 0) clean[clean.length - 1] += l;
            continue;
        }
        l = l.replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '');
        l = l.replace(/Vơ Hoàng Tuấn/g, 'Võ Hoàng Tuấn');
        l = l.replace(/Pḥng/g, 'Phòng');
        l = l.replace(/Chìóýn đề/g, 'Chuyên đề');
        l = l.replace(/Chuyên đề l ái/g, 'Chuyên đề lái');
        l = l.replace(/nồn g độ/g, 'nồng độ');
        l = l.replace(/tỉnhVĩnh/g, 'tỉnh Vĩnh');
        l = l.replace(/Tổ 1 7/g, 'Tổ 17');
        l = l.replace(/\bTổ\s+(\d)\s+(\d)\b/g, 'Tổ $1$2');
        l = l.replace(/\b(\d{2})\s+([A-Z]\d?)\b/g, '$1$2');
        l = l.replace(/(\d+)\s+h(\d+)/gi, '$1h$2');
        l = l.replace(/họp với/g, 'hợp với');

        // Repair split words caused by PDF kerning
        l = l.replace(/\bTu\s+ần\b/gi, 'Tuần');
        l = l.replace(/\*\s*Tu\s+ần\b/gi, '* Tuần');
        l = l.replace(/\bki\s+ểm\b/gi, 'kiểm');
        l = l.replace(/\bso\s+át\b/gi, 'soát');
        l = l.replace(/\bc\s+ơ\b/gi, 'cơ');
        l = l.replace(/\bđ\s+ộng\b/gi, 'động');
        l = l.replace(/\bk\s+ết\b/gi, 'kết');
        l = l.replace(/\bh\s+ợp\b/gi, 'hợp');
        l = l.replace(/\bt\s+ại\b/gi, 'tại');
        l = l.replace(/\bđ\s+iểm\b/gi, 'điểm');
        l = l.replace(/\bđ\s+ường\b/gi, 'đường');
        l = l.replace(/\bth\s+ông\b/gi, 'thông');
        l = l.replace(/\bph\s+ương\b/gi, 'phương');
        l = l.replace(/\bti\s+ện\b/gi, 'tiện');
        l = l.replace(/\bchuy\s+ên\b/gi, 'chuyên');
        l = l.replace(/\bđ\s+ề\b/gi, 'đề');
        l = l.replace(/\bh\s+ành\b/gi, 'hành');
        l = l.replace(/\bvi\s+ph\s+ạm\b/gi, 'vi phạm');
        l = l.replace(/\bđ\s+ối\b/gi, 'đối');
        l = l.replace(/\bt\s+ượng\b/gi, 'tượng');

        // Fix officer spacing
        l = l.replace(/Đ\/c\s*([A-Za-zÀ-ỹ]+)/g, 'Đ/c $1');
        l = l.replace(/(\d{2}h\d{2})\s*-\s*(\d{2}h\d{2})/g, '$1 - $2');
        l = l.replace(/(\d{2}h\d{2})-(\d{2}h\d{2})/g, '$1 - $2');

        // Fix roles if alone
        if (l === 'trưởng') l = 'Tổ trưởng';
        if (l === 'viên') l = 'Tổ viên';
        if (l === 'phó') l = 'Tổ phó';

        // Apply word splitter
        l = splitGluedVietnameseWords(l);

        clean.push(l);
    }

    return clean;
}

function extractDocMetadata(allRuns) {
    const meta = {
        agencyDept: "PHÒNG CẢNH SÁT GIAO THÔNG",
        agencyTeam: "ĐỘI CẢNH SÁT GIAO THÔNG ĐƯỜNG BỘ",
        headerDate: "",
        title: "KẾ HOẠCH CÔNG TÁC TUẦN",
        dateRange: "",
        introText: "1. Thực hiện Kế hoạch số 121/KH-PC08 ngày 22/10/2024 của Phòng PC08, Công an tỉnh Vĩnh Long về thực hiện cao điểm tổng rà soát, phát hiện, thống kê người điều khiển phương tiện mà trong cơ thể có chất ma túy; các điểm, tụ điểm phức tạp về ma túy và đấu tranh, phòng chống tội phạm về ma túy của lực lượng Cảnh sát giao thông trên địa bàn tỉnh; Kế hoạch số 2487/KH-CAT ngày 30/12/2025 của Công an tỉnh về huy động lực lượng khác trong Công an tỉnh phối hợp tuần tra, kiểm soát bảo đảm trật tự, an toàn giao thông đường bộ; Kế hoạch 22/KH-PC08 ngày 18/3/2026 của Phòng PC08 về việc tuần tra, kiểm tra, kiểm soát, xử lý các chuyên đề vi phạm là nguyên nhân chính gây tai nạn giao thông trên các tuyến giao thông đường bộ; Kế hoạch số 166/KH-PC08 ngày 09/6/2026 của Phòng PC08 về việc thực hiện cao điểm phối hợp tuyên truyền, tấn công trấn áp tội phạm về ma tuý giữa Việt Nam, Trung Quốc, Lào và Myanmar trên các tuyến giao thông của lực lượng Cảnh sát giao thông; Kế hoạch số 399/KH-CAT-PC08 ngày 25/8/2026 của Công an tỉnh về tổng kiểm soát, xử lý vi phạm về trật tự an toàn giao thông đường bộ đối với phương tiện kinh doanh vận tải trên địa bàn tỉnh; Kế hoạch số 197/KH-PC08 ngày 14/9/2026 của Phòng PC08 về việc phối hợp tuần tra, kiểm soát phòng, chống đua xe trái phép và phòng chống các loại tội phạm hoạt động theo các tuyến giao thông trên địa bàn tỉnh; Căn cứ kết quả công tác điều tra cơ bản tuyến, điều tra, giải quyết tai nạn giao thông, kết quả xử lý vi phạm giao thông, tình hình trật tự, an toàn giao thông, trật tự xã hội, vi phạm giao thông nổi lên từ ngày 21/9/2026 đến ngày 27/9/2026, Đội Cảnh sát giao thông đường bộ xây dựng kế hoạch công tác tuần như sau:",
        section2Text: "Tùy theo tình hình thực tế giao cho chỉ huy Đội Cảnh sát giao thông đường bộ báo cáo Lãnh đạo phòng thay đổi tuyến, địa bàn, thời gian, lực lượng, phương tiện, thiết bị kỹ thuật nghiệp vụ, công cụ hỗ trợ và các điều kiện khác trong kế hoạch ngày cho phù hợp.",
        signerDoiTruong: "Thượng tá Trần Văn Tiếp",
        signerLanhDao: "Thượng tá Nguyễn Ngọc Ân",
        startDate: null,
        endDate: null
    };

    if (!allRuns || allRuns.length === 0) return meta;

    const p1Runs = allRuns.filter(r => r.p === 1);
    const p1Lines = groupRunsToLines(p1Runs);
    const p1FullText = p1Runs.map(r => r.text).join(' ');

    // 1. Header Date: e.g. "Vĩnh Long, ngày ... tháng ... năm ..."
    let foundHeaderDate = "";
    for (const line of p1Lines) {
        const m = line.match(/([A-Za-zÀ-ỹ\s]+,\s*ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})/i) ||
                  line.match(/(ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})/i);
        if (m) {
            foundHeaderDate = m[1].trim();
            break;
        }
    }
    if (!foundHeaderDate) {
        const m = p1FullText.match(/([A-Za-zÀ-ỹ\s]+,\s*ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})/i) ||
                  p1FullText.match(/(ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})/i);
        if (m) foundHeaderDate = m[1].trim();
    }
    if (foundHeaderDate) {
        if (!foundHeaderDate.includes(',')) foundHeaderDate = 'Vĩnh Long, ' + foundHeaderDate;
        meta.headerDate = foundHeaderDate;
    }

    // 2. Title: "KẾ HOẠCH CÔNG TÁC TUẦN ..."
    for (const line of p1Lines) {
        const m = line.match(/(KẾ\s+HOẠCH\s+(?:CÔNG\s+TÁC\s+)?TUẦN(?:\s+\d+)?)/i);
        if (m) {
            meta.title = m[1].trim().toUpperCase();
            break;
        }
    }
    if (meta.title === "KẾ HOẠCH CÔNG TÁC TUẦN") {
        const m = p1FullText.match(/(KẾ\s+HOẠCH\s+(?:CÔNG\s+TÁC\s+)?TUẦN(?:\s+\d+)?)/i);
        if (m) meta.title = m[1].trim().toUpperCase();
    }

    // 3. Date Range: "(Từ ngày ... đến ngày ...)"
    const drPatterns = [
        /\(?\s*(?:Từ\s+ngày|từ\s+ngày|Từ|từ)\s*(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\s*(?:đến\s+ngày|đến|-|–)\s*(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\s*\)?/i,
        /\((\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\s*(?:đến|-|–)\s*(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\)/i
    ];

    let drMatch = null;
    for (const line of p1Lines) {
        for (const pat of drPatterns) {
            drMatch = line.match(pat);
            if (drMatch) break;
        }
        if (drMatch) break;
    }
    if (!drMatch) {
        for (const pat of drPatterns) {
            drMatch = p1FullText.match(pat);
            if (drMatch) break;
        }
    }

    if (drMatch) {
        const sD = parseInt(drMatch[1], 10);
        const sM = parseInt(drMatch[2], 10);
        let sY = drMatch[3] ? parseInt(drMatch[3], 10) : null;

        const eD = parseInt(drMatch[4], 10);
        const eM = parseInt(drMatch[5], 10);
        let eY = drMatch[6] ? parseInt(drMatch[6], 10) : null;

        if (!eY && sY) eY = sY;
        if (!sY && eY) sY = eY;
        if (!sY && !eY) {
            const yM = meta.headerDate.match(/năm\s+(\d{4})/i);
            const curY = yM ? parseInt(yM[1], 10) : new Date().getFullYear();
            sY = curY;
            eY = curY;
        }
        if (sY < 100) sY += 2000;
        if (eY < 100) eY += 2000;

        meta.startDate = new Date(sY, sM - 1, sD);
        meta.endDate = new Date(eY, eM - 1, eD);

        const sDayStr = sD.toString().padStart(2, '0');
        const sMonthStr = sM.toString().padStart(2, '0');
        const eDayStr = eD.toString().padStart(2, '0');
        const eMonthStr = eM.toString().padStart(2, '0');

        meta.dateRange = `(Từ ngày ${sDayStr}/${sMonthStr}/${sY} đến ngày ${eDayStr}/${eMonthStr}/${eY})`;
    }

    // 4. Extract Intro paragraph 1
    const introArr = [];
    let isIntro = false;
    for (const line of p1Lines) {
        if (/^1\.\s*Thực\s*hiện/i.test(line)) {
            isIntro = true;
        }
        if (isIntro) {
            introArr.push(line);
            if (/như\s*sau\s*:?/i.test(line)) {
                isIntro = false;
                break;
            }
        }
    }
    if (introArr.length > 0) {
        meta.introText = introArr.join(' ');
    }

    // 5. Signatures and Section 2 from the end of the document
    const maxPage = Math.max(1, ...allRuns.map(r => r.p));
    const endRuns = allRuns.filter(r => r.p >= Math.max(1, maxPage - 1));
    const endLines = groupRunsToLines(endRuns);

    let sec2Arr = [];
    let isSec2 = false;
    for (const line of endLines) {
        if (/^2\.\s*Thực\s*hiện\s*yêu\s*cầu/i.test(line)) {
            isSec2 = true;
            continue;
        }
        if (isSec2) {
            if (/Nơi\s*nhận|ĐỘI\s*TRƯỞNG|TRƯỞNG\s*PHÒNG/i.test(line)) {
                isSec2 = false;
                break;
            }
            sec2Arr.push(line);
        }
    }
    if (sec2Arr.length > 0) {
        meta.section2Text = sec2Arr.join(' ');
    }

    // Extract Signer names
    for (let i = 0; i < endLines.length; i++) {
        const line = endLines[i].trim();
        if (/^ĐỘI\s*TRƯỞNG$/i.test(line) && i + 1 < endLines.length) {
            const nextL = endLines[i + 1].trim();
            if (nextL && !/TRƯỞNG|PHÒNG|Nơi|Lưu/i.test(nextL)) {
                meta.signerDoiTruong = nextL;
            }
        }
        if (/(?:KT\.\s*TRƯỞNG\s*PHÒNG|PHÓ\s*TRƯỞNG\s*PHÒNG)/i.test(line) && i + 1 < endLines.length) {
            for (let j = i + 1; j < Math.min(endLines.length, i + 4); j++) {
                const candidate = endLines[j].trim();
                if (candidate && !/KT\.|TRƯỞNG|PHÒNG|ĐỘI|Nơi|Lưu/i.test(candidate)) {
                    meta.signerLanhDao = candidate;
                    break;
                }
            }
        }
    }

    return meta;
}

function formatVietnameseDate(d) {
    if (!d || isNaN(d.getTime())) return "";
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatCalculatedDate(baseDate, dayOffset) {
    if (!baseDate || isNaN(baseDate.getTime())) return "";
    const d = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    return formatVietnameseDate(d);
}

function parseWeeklyScheduleFromRuns(allRuns, docMetadata) {
    const DAY_TARGETS = [
        { name: "Thứ hai", aliases: ["thứ hai", "thứ 2"] },
        { name: "Thứ ba",  aliases: ["thứ ba", "thứ 3"] },
        { name: "Thứ tư",  aliases: ["thứ tư", "thứ 4"] },
        { name: "Thứ năm", aliases: ["thứ năm", "thứ 5"] },
        { name: "Thứ sáu", aliases: ["thứ sáu", "thứ 6"] },
        { name: "Thứ bảy", aliases: ["thứ bảy", "thứ 7"] },
        { name: "Chủ nhật",aliases: ["chủ nhật", "chủ nhật:", "cn"] }
    ];

    const dayIndices = [];
    let currentTargetIdx = 0;

    for (let idx = 0; idx < allRuns.length; idx++) {
        if (currentTargetIdx >= DAY_TARGETS.length) break;

        const r = allRuns[idx];
        if (r.col === 1 || r.x < 140) {
            const textLower = r.text.trim().toLowerCase();
            const target = DAY_TARGETS[currentTargetIdx];

            const matched = target.aliases.some(alias => {
                if (textLower === alias) return true;
                if (textLower.startsWith(alias + ' ') || textLower.startsWith(alias + '\n') || textLower.startsWith(alias + ':')) return true;
                if (textLower.includes(alias)) return true;
                return false;
            });

            if (matched) {
                // Look for date in column 1 in immediate next runs
                let foundDate = "";
                for (let scanIdx = idx; scanIdx < Math.min(allRuns.length, idx + 40); scanIdx++) {
                    const sr = allRuns[scanIdx];
                    if (sr.col === 1 || sr.x < 140) {
                        const dateM = sr.text.match(/\b(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\b/);
                        if (dateM) {
                            const dVal = parseInt(dateM[1], 10);
                            const mVal = parseInt(dateM[2], 10);
                            let yVal = dateM[3] ? parseInt(dateM[3], 10) : (docMetadata?.startDate ? docMetadata.startDate.getFullYear() : new Date().getFullYear());
                            if (yVal < 100) yVal += 2000;
                            foundDate = `${dVal.toString().padStart(2, '0')}/${mVal.toString().padStart(2, '0')}/${yVal}`;
                            break;
                        }
                    }
                    if (scanIdx > idx + 5 && sr.text.trim().startsWith("Tổ ")) break;
                }

                // If Monday date was found directly in table, use it to anchor docMetadata.startDate
                if (currentTargetIdx === 0 && foundDate && !docMetadata.startDate) {
                    const [fD, fM, fY] = foundDate.split('/').map(Number);
                    docMetadata.startDate = new Date(fY, fM - 1, fD);
                }

                dayIndices.push({
                    dayIndex: currentTargetIdx,
                    day: target.name,
                    date: foundDate,
                    startIdx: idx
                });

                currentTargetIdx++;
            }
        }
    }

    // Two-pass anchor: If Monday date was missing but another day had date, calculate Monday
    if (!docMetadata.startDate) {
        for (const di of dayIndices) {
            if (di.date) {
                const [d, m, y] = di.date.split('/').map(Number);
                const dayDate = new Date(y, m - 1, d);
                docMetadata.startDate = new Date(dayDate.getTime() - di.dayIndex * 24 * 60 * 60 * 1000);
                break;
            }
        }
    }

    // Ensure all 7 days have valid dates
    dayIndices.forEach(di => {
        if (!di.date && docMetadata.startDate) {
            di.date = formatCalculatedDate(docMetadata.startDate, di.dayIndex);
        }
    });

    // Auto sync docMetadata.headerDate and docMetadata.dateRange if not extracted from Page 1
    if (dayIndices.length > 0 && dayIndices[0].date) {
        const [mD, mM, mY] = dayIndices[0].date.split('/').map(Number);
        const lastIdx = dayIndices.length - 1;
        const lastDate = dayIndices[lastIdx].date || formatCalculatedDate(docMetadata.startDate, lastIdx);

        if (!docMetadata.dateRange) {
            docMetadata.dateRange = `(Từ ngày ${dayIndices[0].date} đến ngày ${lastDate})`;
        }
        if (!docMetadata.headerDate) {
            docMetadata.headerDate = `Vĩnh Long, ngày ${mD.toString().padStart(2, '0')} tháng ${mM.toString().padStart(2, '0')} năm ${mY}`;
        }
    }

    // Final safety fallbacks
    if (!docMetadata.headerDate) docMetadata.headerDate = "Vĩnh Long, ngày 28 tháng 9 năm 2026";
    if (!docMetadata.dateRange) docMetadata.dateRange = "(Từ ngày 28/9/2026 đến ngày 04/10/2026)";

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

            const m = t.match(/^Tổ\s*(\d+)(?:\s+(\d+))?/i);
            if (m) {
                const toNum = m[2] ? (m[1] + m[2]) : m[1];
                toStarts.push({ idx: j, name: `Tổ ${toNum}` });
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
                l = l.replace(/\bTổ\s+(\d)\s+(\d)\b/g, 'Tổ $1$2');
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

    if (currentDocMetadata) {
        const elAgencyDept = document.getElementById('doc-agency-dept');
        if (elAgencyDept && currentDocMetadata.agencyDept) elAgencyDept.innerText = currentDocMetadata.agencyDept;

        const elAgencyTeam = document.getElementById('doc-agency-team');
        if (elAgencyTeam && currentDocMetadata.agencyTeam) elAgencyTeam.innerText = currentDocMetadata.agencyTeam;

        const elHeaderDate = document.getElementById('doc-header-date');
        if (elHeaderDate && currentDocMetadata.headerDate) elHeaderDate.innerText = currentDocMetadata.headerDate;

        const elTitle = document.getElementById('doc-title');
        if (elTitle && currentDocMetadata.title) elTitle.innerText = currentDocMetadata.title;

        const elDateRange = document.getElementById('doc-date-range');
        if (elDateRange && currentDocMetadata.dateRange) elDateRange.innerText = currentDocMetadata.dateRange;
    }
}

function isHeaderLine(l) {
    if (!l) return false;
    l = l.trim();

    // 1. Starts with * or number like 1., 2., 3., etc.
    if (/^(\*|\d+\.)/i.test(l)) {
        if (/Tuần\s*tra|Kiểm\s*soát|cơ\s*động|công\s*khai|hoá\s*trang|hóa\s*trang|kết\s*hợp|PC02|CAX|Phối\s*hợp|64A1|64A|84E/i.test(l) || l.endsWith(':')) {
            return true;
        }
    }

    // 2. Headings with or without asterisk / number
    if (/^\*?\s*Tuần\s*tra,\s*kiểm\s*soát/i.test(l)) {
        return true;
    }

    if (/^\*?\s*Kiểm\s*soát\s*tại\s*một\s*điểm\s*trên\s*đường\s*giao\s*thông/i.test(l)) {
        return true;
    }

    if (/^\*?\s*(?:kết\s*hợp\s*với|hợp\s*với)\s*(?:hoá\s*trang|hóa\s*trang|kiểm\s*soát)/i.test(l)) {
        return true;
    }

    if (/^hợp\s*với\s*kiểm\s*soát\s*tại\s*một\s*điểm/i.test(l) || /^trên\s*đường\s*giao\s*thông:?$/i.test(l)) {
        return true;
    }

    if (/^-?\s*Hành\s*vi\s*vi\s*phạm.*gồm:?$/i.test(l)) {
        return true;
    }

    return false;
}

function renderGeneralLinesHtml(lines) {
    if (!lines || lines.length === 0) return '';
    return lines.map(l => {
        l = l.trim();
        if (!l) return '';

        // 1. Headers: Full bold lines
        if (isHeaderLine(l)) {
            return `<div class="font-bold mt-1">${renderHtmlWithSuperscripts(l)}</div>`;
        }

        // 2. Lines starting with - and having colon: In đậm từ đầu dòng đến dấu :
        if (l.startsWith('-') && l.includes(':')) {
            const colonIdx = l.indexOf(':');
            const prefix = l.substring(0, colonIdx + 1);
            const content = l.substring(colonIdx + 1).trim();
            return `<div><strong class="font-bold">${escapeHtml(prefix)}</strong> ${renderHtmlWithSuperscripts(content)}</div>`;
        }

        return `<div>${renderHtmlWithSuperscripts(l)}</div>`;
    }).join('');
}

function renderCol6LinesHtml(lines) {
    if (!lines || lines.length === 0) return '';
    return lines.map(l => {
        l = l.trim();
        if (!l) return '';

        // 1. Vehicle header or general header: Full bold
        if (isHeaderLine(l) || l.startsWith('*') || /\d{2}[A-Z]\d?\s*-\s*[\d\.]+/.test(l)) {
            return `<div class="font-bold text-slate-950 mt-1">${escapeHtml(l)}</div>`;
        }

        // 2. Lines starting with - and having colon: In đậm từ đầu dòng đến dấu :
        if (l.startsWith('-') && l.includes(':')) {
            const colonIdx = l.indexOf(':');
            const prefix = l.substring(0, colonIdx + 1);
            const content = l.substring(colonIdx + 1).trim();
            return `<div><strong class="font-bold">${escapeHtml(prefix)}</strong> ${escapeHtml(content)}</div>`;
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
    xml += `<w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>`;
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
                tableRowsXml += `<w:tr>`;

                // Col 1: Date with vMerge
                if (idx === 0) {
                    const tcPr = makeTcPr(1300, "restart", null, null, "center", true);
                    const p1Pr = makePPr("center", 10, 0, 200);
                    const r1Pr = makeRPr("Times New Roman", true, false, 20);
                    const p2Pr = makePPr("center", 0, 0, 200);
                    const r2Pr = makeRPr("Times New Roman", true, false, 18);
                    tableRowsXml += `<w:tc>${tcPr}<w:p>${p1Pr}<w:r>${r1Pr}<w:t>${escapeXml(day.day)}</w:t></w:r></w:p><w:p>${p2Pr}<w:r>${r2Pr}<w:t>${escapeXml(day.date)}</w:t></w:r></w:p></w:tc>`;
                } else {
                    const tcPr = makeTcPr(1300, "continue", null, null, "center", true);
                    const pPr = makePPr("left", 0, 0, 200);
                    tableRowsXml += `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
                }

                tableRowsXml += makeDocxXmlCol2(s.col2Lines, 2200, 20);
                tableRowsXml += makeDocxXmlGeneral(s.col3Lines, 1300, 18);
                tableRowsXml += makeDocxXmlWithSuperscript(s.col4Lines, 3600, 18);
                tableRowsXml += makeDocxXmlGeneral(s.col5Lines, 2900, 18);
                tableRowsXml += makeDocxXmlCol6(s.col6Lines, 3700, 18);

                tableRowsXml += `</w:tr>`;
            });
        });

        // Extract dynamic metadata or use fallback
        const agencyDept = currentDocMetadata?.agencyDept || "PHÒNG CẢNH SÁT GIAO THÔNG";
        const agencyTeam = currentDocMetadata?.agencyTeam || "ĐỘI CẢNH SÁT GIAO THÔNG ĐƯỜNG BỘ";
        const headerDate = currentDocMetadata?.headerDate || "Vĩnh Long, ngày 28 tháng 9 năm 2026";
        const docTitle = currentDocMetadata?.title || "KẾ HOẠCH CÔNG TÁC TUẦN";
        const dateRange = currentDocMetadata?.dateRange || "(Từ ngày 28/9/2026 đến ngày 04/10/2026)";

        // 6. word/document.xml (Completely free of raw \n in <w:t>)
        const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
        ${makePPr("right", 30, 0, 200)}
        <w:r>${makeRPr("Times New Roman", true, false, 20)}<w:t>Mẫu số 03/TT</w:t></w:r>
        <w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:br/></w:r>
        <w:r>${makeRPr("Times New Roman", false, true, 16)}<w:t>(Kèm theo Thông tư số 14/2025/TT-BCA ngày 28/02/2025 của Bộ trưởng Bộ Công an)</w:t></w:r>
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
                <w:p>${makePPr("center", 20, 0, 200)}<w:r>${makeRPr("Times New Roman", false, false, 22)}<w:t>${escapeXml(agencyDept)}</w:t></w:r></w:p>
                <w:p>${makePPr("center", 10, 0, 200)}<w:r>${makeRPr("Times New Roman", true, false, 22)}<w:t>${escapeXml(agencyTeam)}</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="8000" w:type="dxa"/></w:tcPr>
                <w:p>${makePPr("center", 20, 0, 200)}<w:r>${makeRPr("Times New Roman", true, false, 22)}<w:t>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</w:t></w:r></w:p>
                <w:p>${makePPr("center", 30, 0, 200)}<w:r>${makeRPr("Times New Roman", true, false, 22)}<w:t>Độc lập - Tự do - Hạnh phúc</w:t></w:r></w:p>
                <w:p>${makePPr("center", 20, 0, 200)}<w:r>${makeRPr("Times New Roman", false, true, 20)}<w:t>${escapeXml(headerDate)}</w:t></w:r></w:p>
            </w:tc>
        </w:tr>
    </w:tbl>
    <w:p>
        ${makePPr("center", 20, 50, 200)}
        <w:r>${makeRPr("Times New Roman", true, false, 28)}<w:t>${escapeXml(docTitle)}</w:t></w:r>
    </w:p>
    <w:p>
        ${makePPr("center", 60, 0, 200)}
        <w:r>${makeRPr("Times New Roman", true, true, 22)}<w:t>${escapeXml(dateRange)}</w:t></w:r>
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
    <w:sectPr>
        <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
        <w:pgMar w:top="720" w:bottom="720" w:left="900" w:right="900" w:header="360" w:footer="360"/>
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

function makeDocxXmlCol2(lines, widthDxa, fontSize = 20) {
    if (!lines || lines.length === 0) {
        const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
        const pPr = makePPr("left", 0, 0, 200);
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
    }

    const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
    const parasXml = lines.map(l => {
        l = l.trim();
        l = l.replace(/\bTổ\s+(\d)\s+(\d)\b/g, 'Tổ $1$2');
        const pPr = makePPr("left", 15, 0, 200);

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

function makeDocxXmlWithSuperscript(lines, widthDxa, fontSize = 18) {
    if (!lines || lines.length === 0) {
        const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
        const pPr = makePPr("left", 0, 0, 200);
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
    }

    const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
    const parasXml = lines.map(l => {
        l = l.trim();
        const pPr = makePPr("left", 15, 0, 200);

        // 1. Full bold lines: headers
        if (isHeaderLine(l)) {
            return `<w:p>${pPr}${formatDocxChainageRuns(l, true, fontSize)}</w:p>`;
        }

        // 2. Lines starting with - and having colon: In đậm từ đầu dòng đến dấu :
        if (l.startsWith('-') && l.includes(':')) {
            const colonIdx = l.indexOf(':');
            const prefix = l.substring(0, colonIdx + 1);
            const content = l.substring(colonIdx + 1).trim();
            const r1Pr = makeRPr("Times New Roman", true, false, fontSize);
            return `<w:p>${pPr}<w:r>${r1Pr}<w:t xml:space="preserve">${escapeXml(prefix)} </w:t></w:r>${formatDocxChainageRuns(content, false, fontSize)}</w:p>`;
        }

        return `<w:p>${pPr}${formatDocxChainageRuns(l, false, fontSize)}</w:p>`;
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

function makeDocxXmlCol6(lines, widthDxa, fontSize = 18) {
    if (!lines || lines.length === 0) {
        const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
        const pPr = makePPr("left", 0, 0, 200);
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
    }

    const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
    const parasXml = lines.map(l => {
        l = l.trim();
        const pPr = makePPr("left", 15, 0, 200);

        // 1. Vehicle headers or general header: Full bold
        if (isHeaderLine(l) || l.startsWith('*') || /\d{2}[A-Z]\d?\s*-\s*[\d\.]+/.test(l)) {
            const rPr = makeRPr("Times New Roman", true, false, fontSize);
            return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
        }

        // 2. Lines starting with - and having colon: In đậm từ đầu dòng đến dấu :
        if (l.startsWith('-') && l.includes(':')) {
            const colonIdx = l.indexOf(':');
            const prefix = l.substring(0, colonIdx + 1);
            const content = l.substring(colonIdx + 1).trim();
            const r1Pr = makeRPr("Times New Roman", true, false, fontSize);
            const r2Pr = makeRPr("Times New Roman", false, false, fontSize);
            return `<w:p>${pPr}<w:r>${r1Pr}<w:t xml:space="preserve">${escapeXml(prefix)} </w:t></w:r><w:r>${r2Pr}<w:t>${escapeXml(content)}</w:t></w:r></w:p>`;
        }

        const rPr = makeRPr("Times New Roman", false, false, fontSize);
        return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
    }).join('');

    return `<w:tc>${tcPr}${parasXml}</w:tc>`;
}

function makeDocxXmlGeneral(lines, widthDxa, fontSize = 18) {
    if (!lines || lines.length === 0) {
        const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
        const pPr = makePPr("left", 0, 0, 200);
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
    }

    const tcPr = makeTcPr(widthDxa, null, null, null, "top", true);
    const parasXml = lines.map(l => {
        l = l.trim();
        const pPr = makePPr("left", 15, 0, 200);

        // 1. Headers: Full bold
        if (isHeaderLine(l)) {
            const rPr = makeRPr("Times New Roman", true, false, fontSize);
            return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
        }

        // 2. Lines starting with - and having colon: In đậm từ đầu dòng đến dấu :
        if (l.startsWith('-') && l.includes(':')) {
            const colonIdx = l.indexOf(':');
            const prefix = l.substring(0, colonIdx + 1);
            const content = l.substring(colonIdx + 1).trim();
            const r1Pr = makeRPr("Times New Roman", true, false, fontSize);
            const r2Pr = makeRPr("Times New Roman", false, false, fontSize);
            return `<w:p>${pPr}<w:r>${r1Pr}<w:t xml:space="preserve">${escapeXml(prefix)} </w:t></w:r><w:r>${r2Pr}<w:t>${escapeXml(content)}</w:t></w:r></w:p>`;
        }

        const rPr = makeRPr("Times New Roman", false, false, fontSize);
        return `<w:p>${pPr}<w:r>${rPr}<w:t>${escapeXml(l)}</w:t></w:r></w:p>`;
    }).join('');

    return `<w:tc>${tcPr}${parasXml}</w:tc>`;
}

function anyStartsWith(str, prefixes) {
    return prefixes.some(p => str.startsWith(p));
}
