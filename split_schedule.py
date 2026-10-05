#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PHẦN MỀM TÁCH TỔ TUẦN TRA - KẾ HOẠCH TUẦN CSGT (MẪU 03/TT)
Chạy 100% OFFLINE trên máy tính, KHÔNG CẦN INTERNET, KHÔNG CẦN CÀI THÊM THƯ VIỆN NGOÀI.
"""

import sys
import os
import re
import json
import zlib
import zipfile
import datetime

DEFAULT_OFFICERS = [
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
]

DAYS_INFO = [
    ("Thứ hai", "28/9/2026"),
    ("Thứ ba", "29/9/2026"),
    ("Thứ tư", "30/9/2026"),
    ("Thứ năm", "01/10/2026"),
    ("Thứ sáu", "02/10/2026"),
    ("Thứ bảy", "03/10/2026"),
    ("Chủ nhật", "04/10/2026")
]

def decompress_stream(data):
    try:
        return zlib.decompress(data)
    except Exception:
        try:
            return zlib.decompress(data, -15)
        except Exception:
            return data

def parse_tounicode(cmap_data):
    mapping = {}
    bfchar_blocks = re.findall(r'(\d+)\s+beginbfchar\s+(.*?)\s+endbfchar', cmap_data, re.DOTALL)
    for count, block in bfchar_blocks:
        for line in block.strip().splitlines():
            line = line.strip()
            if not line: continue
            parts = re.findall(r'<([0-9a-fA-F]+)>', line)
            if len(parts) == 2:
                try:
                    mapping[int(parts[0], 16)] = bytes.fromhex(parts[1]).decode('utf-16-be')
                except Exception: pass

    bfrange_blocks = re.findall(r'(\d+)\s+beginbfrange\s+(.*?)\s+endbfrange', cmap_data, re.DOTALL)
    for count, block in bfrange_blocks:
        for line in block.strip().splitlines():
            line = line.strip()
            if not line: continue
            m1 = re.match(r'<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>', line)
            if m1:
                start_code = int(m1.group(1), 16)
                end_code = int(m1.group(2), 16)
                dst_start_code = int(m1.group(3), 16)
                for code in range(start_code, end_code + 1):
                    offset = code - start_code
                    dst_code = dst_start_code + offset
                    dst_hex = f"{dst_code:04x}"
                    if len(dst_hex) % 2 != 0: dst_hex = '0' + dst_hex
                    try: mapping[code] = bytes.fromhex(dst_hex).decode('utf-16-be')
                    except Exception: pass
            else:
                m2 = re.match(r'<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[(.*?)\]', line)
                if m2:
                    start_code = int(m2.group(1), 16)
                    end_code = int(m2.group(2), 16)
                    dst_hexes = re.findall(r'<([0-9a-fA-F]+)>', m2.group(3))
                    for i, dst_hex in enumerate(dst_hexes):
                        code = start_code + i
                        try: mapping[code] = bytes.fromhex(dst_hex).decode('utf-16-be')
                        except Exception: pass
    return mapping

def decode_item(item, font_info):
    if not font_info:
        if item.startswith('(') and item.endswith(')'):
            return item[1:-1].replace(r'\(', '(').replace(r'\)', ')').replace(r'\\', '\\')
        return ""
    subtype = font_info.get('subtype', '')
    cmap = font_info.get('cmap', {})
    if subtype == 'Type0':
        if item.startswith('<') and item.endswith('>'):
            hex_str = item[1:-1].strip()
            res = []
            for i in range(0, len(hex_str), 4):
                code = int(hex_str[i:i+4], 16)
                res.append(cmap.get(code, ""))
            return ''.join(res)
        elif item.startswith('(') and item.endswith(')'):
            content = item[1:-1].replace(r'\(', '(').replace(r'\)', ')').replace(r'\\', '\\')
            raw_bytes = content.encode('latin1')
            res = []
            for i in range(0, len(raw_bytes), 2):
                if i + 1 < len(raw_bytes):
                    code = (raw_bytes[i] << 8) | raw_bytes[i+1]
                    res.append(cmap.get(code, ""))
            return ''.join(res)
    else:
        if item.startswith('(') and item.endswith(')'):
            content = item[1:-1].replace(r'\(', '(').replace(r'\)', ')').replace(r'\\', '\\')
            try: return content.encode('latin1').decode('windows-1258')
            except Exception: return content
        elif item.startswith('<') and item.endswith('>'):
            hex_str = item[1:-1].strip()
            res = []
            for i in range(0, len(hex_str), 2):
                code = int(hex_str[i:i+2], 16)
                res.append(chr(code))
            return ''.join(res)
    return ""

def parse_pdf_elements(pdf_path):
    with open(pdf_path, 'rb') as f:
        raw_pdf = f.read()

    objects = {}
    obj_pattern = re.compile(rb'(\d+)\s+(\d+)\s+obj\s*(.*?)\s*endobj', re.DOTALL)
    for m in obj_pattern.finditer(raw_pdf):
        objects[int(m.group(1))] = m.group(3)

    cmaps = {}
    for obj_id, body in objects.items():
        if b'stream' in body:
            sm = re.search(rb'stream\r?\n(.*?)\r?\nendstream', body, re.DOTALL)
            if sm:
                stream_data = decompress_stream(sm.group(1))
                try:
                    text = stream_data.decode('latin1')
                    if 'beginbfchar' in text or 'beginbfrange' in text:
                        cmaps[obj_id] = parse_tounicode(text)
                except Exception: pass

    font_objs = {}
    for obj_id, body in objects.items():
        if b'/Type /Font' in body or b'/Type/Font' in body:
            subtype_m = re.search(rb'/Subtype\s*/([A-Za-z0-9]+)', body)
            subtype = subtype_m.group(1).decode('latin1') if subtype_m else ""
            tu_m = re.search(rb'/ToUnicode\s+(\d+)\s+\d+\s+R', body)
            cmap = {}
            if tu_m: cmap = cmaps.get(int(tu_m.group(1)), {})
            font_objs[obj_id] = {'subtype': subtype, 'cmap': cmap}

    def find_pages(obj_id):
        body = objects.get(obj_id, b'')
        if b'/Type /Pages' in body or b'/Type/Pages' in body:
            kids_m = re.search(rb'/Kids\s*\[(.*?)\]', body, re.DOTALL)
            if kids_m:
                kids = [int(x) for x in re.findall(rb'(\d+)\s+\d+\s+R', kids_m.group(1))]
                res = []
                for k in kids: res.extend(find_pages(k))
                return res
        elif b'/Type /Page' in body or b'/Type/Page' in body:
            return [obj_id]
        return []

    cat_m = re.search(rb'/Root\s+(\d+)\s+\d+\s+R', raw_pdf)
    root_id = int(cat_m.group(1)) if cat_m else 1
    root_body = objects.get(root_id, b'')
    pages_root_m = re.search(rb'/Pages\s+(\d+)\s+\d+\s+R', root_body)
    pages_root_id = int(pages_root_m.group(1)) if pages_root_m else 2
    ordered_page_ids = find_pages(pages_root_id)

    def get_col(x):
        if x < 100: return 1
        if x < 230: return 2
        if x < 330: return 3
        if x < 475: return 4
        if x < 610: return 5
        return 6

    flattened = []
    for p_idx, pid in enumerate(ordered_page_ids):
        p_num = p_idx + 1
        body = objects.get(pid, b'')
        res_body = body
        res_m = re.search(rb'/Resources\s+(\d+)\s+\d+\s+R', body)
        if res_m: res_body = objects.get(int(res_m.group(1)), b'')

        font_map = {}
        font_dict_m = re.search(rb'/Font\s*<<([^>]+)>>', res_body)
        if font_dict_m:
            for f_match in re.finditer(rb'/([A-Za-z0-9_\-]+)\s+(\d+)\s+\d+\s+R', font_dict_m.group(1)):
                fname = f_match.group(1).decode('latin1')
                fobj = int(f_match.group(2))
                font_map[fname] = font_objs.get(fobj, {})

        contents_ids = []
        contents_m = re.search(rb'/Contents\s+(\d+)\s+\d+\s+R', body)
        contents_arr = re.search(rb'/Contents\s*\[(.*?)\]', body, re.DOTALL)
        if contents_m: contents_ids.append(int(contents_m.group(1)))
        elif contents_arr: contents_ids.extend([int(x) for x in re.findall(rb'(\d+)\s+\d+\s+R', contents_arr.group(1))])

        content_data = b''
        for cid in contents_ids:
            cbody = objects.get(cid, b'')
            sm = re.search(rb'stream\r?\n(.*?)\r?\nendstream', cbody, re.DOTALL)
            if sm: content_data += decompress_stream(sm.group(1)) + b'\n'

        text_content = content_data.decode('latin1', errors='ignore')
        bt_blocks = re.findall(r'BT\s*(.*?)\s*ET', text_content, re.DOTALL)
        page_elems = []

        for block in bt_blocks:
            fm = re.search(r'/([A-Za-z0-9_\-]+)\s+([\d\.]+)\s+Tf', block)
            font_name = fm.group(1) if fm else None
            font_info = font_map.get(font_name, {})

            tm_m = re.search(r'([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+Tm', block)
            x = float(tm_m.group(5)) if tm_m else 0.0
            y = float(tm_m.group(6)) if tm_m else 0.0

            text_parts = []
            for tj_m in re.finditer(r'\[(.*?)\]\s*TJ', block, re.DOTALL):
                items = re.findall(r'(<[0-9a-fA-F]+>|\([^\)]*\))', tj_m.group(1))
                text_parts.append(''.join(decode_item(it, font_info) for it in items))

            for single_m in re.finditer(r'(<[0-9a-fA-F]+>|\([^\)]*\))\s*Tj', block):
                text_parts.append(decode_item(single_m.group(1), font_info))

            full_t = ''.join(text_parts).strip()
            if full_t:
                page_elems.append({'x': x, 'y': y, 'page': p_num, 'text': full_t, 'col': get_col(x)})

        page_elems.sort(key=lambda el: (-el['y'], el['x']))
        flattened.extend(page_elems)

    return flattened

def split_glued_vietnamese_words(text):
    if not text: return ""
    t = text

    replacements = [
        (r'Cácbiểumẫutheothôngtư', 'Các biểu mẫu theo Thông tư '),
        (r'CácbiểumẫutheoNghịđịnh', 'Các biểu mẫu theo Nghị định '),
        (r'Cácbiểumẫu', 'Các biểu mẫu '),
        (r'biểumẫutheothôngtư', 'biểu mẫu theo Thông tư '),
        (r'biểumẫutheoNghịđịnh', 'biểu mẫu theo Nghị định '),
        (r'biểumẫu', 'biểu mẫu '),
        (r'theothôngtư', 'theo Thông tư '),
        (r'theoNghịđịnh', 'theo Nghị định '),
        (r'thôngtư(\d+)', r'Thông tư \1'),
        (r'Nghịđịnh(\d+)', r'Nghị định \1'),
        (r'BCAngày', 'BCA ngày '),
        (r'CPngày', 'CP ngày '),
        (r'vềĐTGLTNGT', 'về ĐTGQTNGT'),
        (r'vềĐTGQTNGT', 'về ĐTGQTNGT'),
        (r'củaChínhphủ', 'của Chính phủ'),
        (r'Chínhphủ', 'Chính phủ'),
        (r'củaChính', 'của Chính'),
        (r'sửađổi,bổsung', 'sửa đổi, b��� sung'),
        (r'sửađổi,bổ', 'sửa đổi, bổ '),
        (r'bổsung', 'bổ sung'),
        (r'Va\s*ly\s*KNHT', 'Va ly KNHT'),

        (r'Motorolaseri', 'Motorola seri: '),
        (r'Motorolasêri', 'Motorola seri: '),
        (r'Audaxseri', 'Audax seri: '),
        (r'Audaxsêri', 'Audax seri: '),
        (r'Lifelocseri', 'Lifeloc seri: '),
        (r'ProdigyII', 'Prodigy II'),
        (r'Prodigy2S', 'Prodigy 2S'),
        (r'PRODIGY2S', 'PRODIGY 2S'),
        (r'PRODIGYII', 'PRODIGY II'),
        (r'Máyđonồngđộcồn', 'Máy đo nồng độ cồn '),
        (r'đonồngđộcồn', 'đo nồng độ cồn '),
        (r'nồngđộcồn', 'nồng độ cồn'),
        (r'súngbắnđạncaosu', 'súng bắn đạn cao su '),
        (r'súngbắnđạncao', 'súng bắn đạn cao '),
        (r'súngbắnđạn', 'súng bắn đạn '),
        (r'bắnđạncaosu', 'bắn đạn cao su '),
        (r'bắnđạncao', 'bắn đạn cao '),
        (r'đạncaosu', 'đạn cao su'),
        (r'khóasố8', 'khóa số 8'),
        (r'khóasố', 'khóa số '),
        (r'khóa8', 'khóa số 8'),
        (r'Gậychỉhuygiaothông', 'Gậy chỉ huy giao thông'),
        (r'Gậychỉhuy', 'Gậy chỉ huy '),
        (r'chỉhuygiaothông', 'chỉ huy giao thông'),
        (r'giaothông', 'giao thông'),
        (r'cọctiêuhìnhchópnón', 'cọc tiêu hình chóp nón'),
        (r'cọctiêu', 'cọc tiêu '),
        (r'hìnhchópnón', 'hình chóp nón'),
        (r'đènchiếusáng', 'đèn chiếu sáng'),
        (r'chiếusáng', 'chiếu sáng'),
        (r'điềukiệncầnthiết', 'điều kiện cần thiết '),
        (r'điềukiện', 'điều kiện '),
        (r'cầnthiếtkhác', 'cần thiết khác '),
        (r'theoquyđịnh', 'theo quy định'),
        (r'quyđịnh', 'quy định'),
        (r'Cânkiểmtratảitrọng', 'Cân kiểm tra tải trọng '),
        (r'kiểmtratảitrọng', 'kiểm tra tải trọng '),
        (r'tảitrọng', 'tải trọng'),
        (r'Máyđotốcđộ', 'Máy đo tốc độ '),
        (r'đotốcđộ', 'đo tốc độ '),
        (r'SpeedLidar', 'Speed Lidar '),
        (r'Máycamera', 'Máy camera '),
        (r'Thẻnhớ', 'Thẻ nhớ '),
        (r'Thẻnhớngoài', 'Thẻ nhớ ngoài '),
        (r'MáyquaySony', 'Máy quay Sony '),
        (r'Máyquay', 'Máy quay '),

        (r'Tuầntra,kiểmsoátcơđộng', 'Tuần tra, kiểm soát cơ động'),
        (r'Tuầntra,kiểmsoát', 'Tuần tra, kiểm soát '),
        (r'kiểmsoátcơđộng', 'kiểm soát cơ động'),
        (r'Kiểmsoáttại01điểm', 'Kiểm soát tại 01 điểm '),
        (r'Kiểmsoáttạimộtđiểm', 'Kiểm soát tại một điểm '),
        (r'trênđườnggiaothông', 'trên đường giao thông'),
        (r'đườnggiaothông', 'đường giao thông'),
        (r'Đốitượngkiểmsoát,xửlý', 'Đối tượng kiểm soát, xử lý'),
        (r'Đốitượngcầntậptrung', 'Đối tượng cần tập trung '),
        (r'Đốitượng', 'Đối tượng '),
        (r'kiểmsoát,xửlý', 'kiểm soát, xử lý'),
        (r'Người\s*tham\s*gia\s*giao\s*thông\s*đường\s*bộ', 'Người tham gia giao thông đường bộ'),
        (r'Ngườivàphươngtiện', 'Người và phương tiện '),
        (r'Hànhviviphạmkiểmsoát,xửlýtheochuyênđềgồm', 'Hành vi vi phạm kiểm soát, xử lý theo chuyên đề gồm:'),
        (r'Hànhviviphạmkiểmsoát,xửlý', 'Hành vi vi phạm kiểm soát, xử lý'),
        (r'Hànhviviphạm', 'Hành vi vi phạm '),
        (r'theochuyênđềgồm', 'theo chuyên đề gồm: '),
        (r'Chuyênđềxeba,bốnbánh', 'Chuyên đề xe ba, bốn bánh '),
        (r'tựsảnxuất,lắpráp', 'tự sản xuất, lắp ráp '),
        (r'xemôtô,xegắnmáy', 'xe mô tô, xe gắn máy '),
        (r'xekinhdoanhvậntải', 'xe kinh doanh vận tải'),
        (r'kinhdoanhvậntải', 'kinh doanh vận tải'),
        (r'Láixekinhdoanhvậntải', 'Lái xe kinh doanh vận tải '),
        (r'Chuyênđềhọcsinh', 'Chuyên đề học sinh'),
        (r'Chuyênđềchởhàngquátảitrọng,quákhổgiớihạn', 'Chuyên đề chở hàng quá tải trọng, quá khổ giới hạn'),
        (r'Chuyênđềnồngđộcồn', 'Chuyên đề nồng độ cồn'),
        (r'chuyểnhướngkhôngquansát', 'chuyển hướng không quan sát'),
        (r'đikhôngđúngphầnđường', 'đi không đúng phần đường'),
        (r'viphạmtốcđộ', 'vi phạm tốc độ'),
        (r'Phòngchốngđuaxetráiphép', 'Phòng chống đua xe trái phép'),
        (r'đuaxetráiphép', 'đua xe trái phép'),
        (r'Tuyêntruyền,điềutra,giảiquyếttainạngiaothông', 'Tuyên truyền, điều tra, giải quyết tai nạn giao thông'),
        (r'Tuyêntruyền,điềutra', 'Tuyên truyền, điều tra'),
        (r'giảiquyếttainạngiaothông', 'giải quyết tai nạn giao thông'),
        (r'theokhoản1Điều19', 'theo khoản 1 Điều 19 '),
        (r'Thôngtư73/2024/TT-BCAngày15/11/2024', 'Thông tư 73/2024/TT-BCA ngày 15/11/2024')
    ]

    for pat, rep in replacements:
        t = re.sub(pat, rep, t, flags=re.IGNORECASE)

    t = re.sub(r'[ \t]+', ' ', t)
    return t.strip()

def is_header_line(l):
    if not l: return False
    l = l.strip()

    # 1. Starts with * or number like 1., 2., 3., etc.
    if re.match(r'^(\*|\d+\.)', l, re.IGNORECASE):
        if re.search(r'Tuần\s*tra|Kiểm\s*soát|cơ\s*động|công\s*khai|hoá\s*trang|hóa\s*trang|kết\s*hợp|PC02|CAX|Phối\s*hợp|64A1|64A|84E', l, re.IGNORECASE) or l.endswith(':'):
            return True

    # 2. Headings with or without asterisk / number
    if re.match(r'^\*?\s*Tuần\s*tra,\s*kiểm\s*soát', l, re.IGNORECASE):
        return True

    if re.match(r'^\*?\s*Kiểm\s*soát\s*tại\s*một\s*điểm\s*trên\s*đường\s*giao\s*thông', l, re.IGNORECASE):
        return True

    if re.match(r'^\*?\s*(?:kết\s*hợp\s*với|hợp\s*với)\s*(?:hoá\s*trang|hóa\s*trang|kiểm\s*soát)', l, re.IGNORECASE):
        return True

    if re.match(r'^hợp\s*với\s*kiểm\s*soát\s*tại\s*một\s*điểm', l, re.IGNORECASE) or re.match(r'^trên\s*đường\s*giao\s*thông:?$', l, re.IGNORECASE):
        return True

    if re.match(r'^-?\s*Hành\s*vi\s*vi\s*phạm.*gồm:?$', l, re.IGNORECASE):
        return True

    return False

def clean_cell_lines(lines):
    if not lines: return []
    raw = '\n'.join(lines)

    raw = re.sub(r'(\*?\s*Tuần tra,\s*kiểm soát\s*cơ động\s*):?\s*\+\d+', r'\1:', raw, flags=re.IGNORECASE)
    raw = re.sub(r'(\*?\s*Tuần tra,\s*kiểm soát\s*công khai[^:]*):?\s*\+\d+', r'\1:', raw, flags=re.IGNORECASE)
    raw = re.sub(r'(1\.\s*Tuần tra,\s*kiểm soát\s*cơ động\s*):?\s*\+\d+', r'\1:', raw, flags=re.IGNORECASE)
    raw = re.sub(r'(2\.\s*Kiểm soát\s*tại[^:]*):?\s*\+\d+', r'\1:', raw, flags=re.IGNORECASE)
    raw = re.sub(r':\s*\+\d+', ':', raw)

    # Fix and unify all combined headings FIRST (including all variants with colons, newlines, duplicate bullets)
    raw = re.sub(r'\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*Kiểm\s*soát\s*tại\s*một\s*điểm\s*(?:\r?\n|\s)*trên\s*đường\s*giao\s*thông:?', '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*kiểm\s*soát\s*tại\s*một\s*điểm\s*(?:\r?\n|\s)*trên\s*đường\s*giao\s*thông:?', '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:', raw, flags=re.IGNORECASE)

    raw = re.sub(r'\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*công\s*khai:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*(?:hoá|hóa)\s*trang:?', '* Tuần tra, kiểm soát công khai kết hợp với hoá trang:', raw, flags=re.IGNORECASE)

    # Separate multiple headers or sub-items onto new lines
    raw = re.sub(r'([^\n])\s*(\*\s*Tuần tra|\b1\.\s*Tuần tra|\b2\.\s*Kiểm soát|\*\s*Kiểm soát)', r'\1\n$2', raw, flags=re.IGNORECASE)
    raw = re.sub(r'([^\n])\s*(-\s*Tuyến:|-\s*Thời gian:|-\s*Đối tượng:|-\s*Nhiệm vụ:)', r'\1\n$2', raw, flags=re.IGNORECASE)

    # Re-verify combined heading after line separation
    raw = re.sub(r'\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*Kiểm\s*soát\s*tại\s*một\s*điểm\s*(?:\r?\n|\s)*trên\s*đường\s*giao\s*thông:?', '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*kiểm\s*soát\s*tại\s*một\s*điểm\s*(?:\r?\n|\s)*trên\s*đường\s*giao\s*thông:?', '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:', raw, flags=re.IGNORECASE)
    raw = re.sub(r'\*?\s*Tuần\s*tra,\s*kiểm\s*soát\s*công\s*khai:?\s*(?:\r?\n|\s)*(?:kết\s*hợp\s*với|hợp\s*với):?\s*(?:\r?\n|\s)*\*?\s*(?:hoá|hóa)\s*trang:?', '* Tuần tra, kiểm soát công khai kết hợp với hoá trang:', raw, flags=re.IGNORECASE)

    if 'QL53' in raw and ('43' in raw or '166' in raw) and 'Trà Vinh cũ' in raw:
        raw = re.sub(
            r'QL53.*?101.*?(?=Các tuyến đường|$)',
            'QL53, từ Km 43+108 đến Km 166+858; QL53B; QL54, từ Km 82+700 đến Km 148+200; QL60, từ Km 11+308 đến Km 101+226; ',
            raw,
            flags=re.DOTALL
        )

    if 'QL53' in raw and ('56' in raw or '65' in raw) and ('Trà Vinh' in raw or 'Nguyệt Hóa' in raw):
        raw = re.sub(
            r'QL53.*?Km\s*72;?',
            'QL53, từ Km 56+700 đến Km 65+450; QL54, từ Km 144+450 đến Km 148+200; QL60, từ Km 71 đến Km 72;',
            raw,
            flags=re.DOTALL
        )

    raw = re.sub(r'Km\s+(\d+)\s+đến\s+Km\s*\+(\d+)\+(\d+)\s+(\d+)', r'Km \1+\2 đến Km \4+\3', raw)
    raw = re.sub(r'Km\s+(\d+)\s*\+(\d+)\s+đến\s+Km\s+(\d+)\s*\+(\d+)', r'Km \1+\2 đến Km \3+\4', raw)
    raw = re.sub(r'Km\s+(\d+)\s*\n*\s*\+(\d+)', r'Km \1+\2', raw)
    raw = re.sub(r'(\d+)\s*\n*\s*\+(\d+)', r'$1+$2', raw)

    clean = []
    lines_arr = raw.splitlines()
    for i, l in enumerate(lines_arr):
        l = l.strip()
        if not l: continue

        # Merge split combined heading lines if any were separated across lines
        if clean and re.search(r'Tuần\s*tra,\s*kiểm\s*soát\s*cơ\s*động.*kết\s*hợp\s*với:?$', clean[-1], re.IGNORECASE) and re.match(r'^\*?\s*Kiểm\s*soát\s*tại\s*một\s*điểm\s*trên\s*đường\s*giao\s*thông', l, re.IGNORECASE):
            clean[-1] = '* Tuần tra, kiểm soát cơ động kết hợp với kiểm soát tại một điểm trên đường giao thông:'
            continue

        if clean and re.search(r'Tuần\s*tra,\s*kiểm\s*soát\s*công\s*khai.*kết\s*hợp\s*với:?$', clean[-1], re.IGNORECASE) and re.match(r'^\*?\s*(?:hoá|hóa)\s*trang:?', l, re.IGNORECASE):
            clean[-1] = '* Tuần tra, kiểm soát công khai kết hợp với hoá trang:'
            continue

        if re.match(r'^\+\d+$', l):
            if clean: clean[-1] += l
            continue
        l = l.replace(r'\(', '(').replace(r'\)', ')').replace(r'\\', '')
        l = l.replace('Vơ Hoàng Tuấn', 'Võ Hoàng Tuấn')
        l = l.replace('Pḥng', 'Phòng')
        l = l.replace('Chìóýn đề', 'Chuyên đề')
        l = l.replace('Chuyên đề l ái', 'Chuyên đề lái')
        l = l.replace('nồn g độ', 'nồng độ')
        l = l.replace('tỉnhVĩnh', 'tỉnh Vĩnh')
        l = l.replace('Tổ 1 7', 'Tổ 17')
        l = re.sub(r'\bTổ\s+(\d)\s+(\d)\b', r'Tổ \1\2', l)
        l = re.sub(r'\b(\d{2})\s+([A-Z]\d?)\b', r'\1\2', l)
        l = re.sub(r'(\d+)\s+h(\d+)', r'\1h\2', l, flags=re.IGNORECASE)
        l = l.replace('họp với', 'hợp với')

        # Repair split words
        l = re.sub(r'\bTu\s+ần\b', 'Tuần', l, flags=re.IGNORECASE)
        l = re.sub(r'\*\s*Tu\s+ần\b', '* Tuần', l, flags=re.IGNORECASE)
        l = re.sub(r'\bki\s+ểm\b', 'kiểm', l, flags=re.IGNORECASE)
        l = re.sub(r'\bso\s+át\b', 'soát', l, flags=re.IGNORECASE)
        l = re.sub(r'\bc\s+ơ\b', 'cơ', l, flags=re.IGNORECASE)
        l = re.sub(r'\bđ\s+ộng\b', 'động', l, flags=re.IGNORECASE)
        l = re.sub(r'\bk\s+ết\b', 'kết', l, flags=re.IGNORECASE)
        l = re.sub(r'\bh\s+ợp\b', 'hợp', l, flags=re.IGNORECASE)
        l = re.sub(r'\bt\s+ại\b', 'tại', l, flags=re.IGNORECASE)
        l = re.sub(r'\bđ\s+iểm\b', 'điểm', l, flags=re.IGNORECASE)
        l = re.sub(r'\bđ\s+ường\b', 'đường', l, flags=re.IGNORECASE)
        l = re.sub(r'\bth\s+ông\b', 'thông', l, flags=re.IGNORECASE)
        l = re.sub(r'\bph\s+ương\b', 'phương', l, flags=re.IGNORECASE)
        l = re.sub(r'\bti\s+ện\b', 'tiện', l, flags=re.IGNORECASE)
        l = re.sub(r'\bchuy\s+ên\b', 'chuyên', l, flags=re.IGNORECASE)
        l = re.sub(r'\bđ\s+ề\b', 'đề', l, flags=re.IGNORECASE)
        l = re.sub(r'\bh\s+ành\b', 'hành', l, flags=re.IGNORECASE)
        l = re.sub(r'\bvi\s+ph\s+ạm\b', 'vi phạm', l, flags=re.IGNORECASE)
        l = re.sub(r'\bđ\s+ối\b', 'đối', l, flags=re.IGNORECASE)
        l = re.sub(r'\bt\s+ượng\b', 'tượng', l, flags=re.IGNORECASE)
        l = split_glued_vietnamese_words(l)
        clean.append(l)

    return clean

def escape_xml(unsafe):
    if not unsafe: return ''
    return str(unsafe).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;')

def make_rPr_xml(font="Times New Roman", bold=False, italic=False, sz=20, vert_align=None):
    parts = [f'<w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>']
    if bold: parts.append('<w:b/><w:bCs/>')
    if italic: parts.append('<w:i/><w:iCs/>')
    parts.append(f'<w:sz w:val="{sz}"/><w:szCs w:val="{sz}"/>')
    if vert_align: parts.append(f'<w:vertAlign w:val="{vert_align}"/>')
    return f'<w:rPr>{"".join(parts)}</w:rPr>'

make_rPr = make_rPr_xml

def make_pPr_xml(align="left", space_after=40, space_before=0, line_spacing=240):
    parts = [f'<w:spacing w:before="{space_before}" w:after="{space_after}" w:line="{line_spacing}" w:lineRule="auto"/>']
    if align != "left": parts.append(f'<w:jc w:val="{align}"/>')
    return f'<w:pPr>{"".join(parts)}</w:pPr>'

make_pPr = make_pPr_xml

def make_tcPr_xml(width_dxa, v_merge=None, grid_span=None, shading=None, v_align="top", borders=True):
    parts = [f'<w:tcW w:w="{width_dxa}" w:type="dxa"/>']
    if grid_span and grid_span > 1: parts.append(f'<w:gridSpan w:val="{grid_span}"/>')
    if v_merge == "restart": parts.append('<w:vMerge w:val="restart"/>')
    elif v_merge == "continue": parts.append('<w:vMerge/>')
    if borders:
        parts.append('''<w:tcBorders>
            <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tcBorders>''')
    if shading: parts.append(f'<w:shd w:val="clear" w:fill="{shading}"/>')
    parts.append('''<w:tcMar>
        <w:top w:w="40" w:type="dxa"/>
        <w:bottom w:w="40" w:type="dxa"/>
        <w:left w:w="80" w:type="dxa"/>
        <w:right w:w="80" w:type="dxa"/>
    </w:tcMar>''')
    if v_align: parts.append(f'<w:vAlign w:val="{v_align}"/>')
    return f'<w:tcPr>{"".join(parts)}</w:tcPr>'

make_tcPr = make_tcPr_xml

def make_r(text, bold=False, italic=False, size=24, font="Times New Roman", vert_align=None):
    rPr = make_rPr_xml(font=font, bold=bold, italic=italic, sz=size, vert_align=vert_align)
    space_attr = ' xml:space="preserve"' if (text.startswith(' ') or text.endswith(' ')) else ''
    return f'<w:r>{rPr}<w:t{space_attr}>{escape_xml(text)}</w:t></w:r>'

def make_p(runs_xml, align="left", space_after=40, space_before=0, line_spacing=240):
    pPr = make_pPr_xml(align=align, space_after=space_after, space_before=space_before, line_spacing=line_spacing)
    return f'<w:p>{pPr}{runs_xml}</w:p>'

def format_docx_chainage_runs(text, is_bold, font_size):
    pattern = re.compile(r'(Km\s+\d+|\d+)(\+\d+)', re.IGNORECASE)
    pos = 0
    runs_xml = ''
    for match in pattern.finditer(text):
        start, end = match.span()
        if start > pos:
            rPr = make_rPr_xml("Times New Roman", is_bold, False, font_size)
            runs_xml += f'<w:r>{rPr}<w:t xml:space="preserve">{escape_xml(text[pos:start])}</w:t></w:r>'
        km_part = match.group(1)
        plus_part = match.group(2)
        km_rPr = make_rPr_xml("Times New Roman", is_bold, False, font_size)
        plus_rPr = make_rPr_xml("Times New Roman", is_bold, False, font_size - 4, "superscript")
        runs_xml += f'<w:r>{km_rPr}<w:t xml:space="preserve">{escape_xml(km_part)}</w:t></w:r>'
        runs_xml += f'<w:r>{plus_rPr}<w:t xml:space="preserve">{escape_xml(plus_part)}</w:t></w:r>'
        pos = end
    if pos < len(text):
        rPr = make_rPr_xml("Times New Roman", is_bold, False, font_size)
        runs_xml += f'<w:r>{rPr}<w:t xml:space="preserve">{escape_xml(text[pos:])}</w:t></w:r>'
    return runs_xml or f'<w:r>{make_rPr_xml("Times New Roman", is_bold, False, font_size)}<w:t xml:space="preserve">{escape_xml(text)}</w:t></w:r>'

def get_week_number(date_obj):
    if not date_obj: date_obj = datetime.date.today()
    return date_obj.isocalendar()[1]

def get_week_number_from_doc(doc_meta, elements):
    # 1. Check title e.g. "KẾ HOẠCH CÔNG TÁC TUẦN 41"
    if doc_meta and doc_meta.get('title'):
        m = re.search(r'TUẦN(?:\s+THỨ|\s+SỐ)?\s*(\d+)', doc_meta['title'], re.IGNORECASE)
        if m: return int(m.group(1))

    # 2. Check text on page 1
    p1_elems = [e for e in elements if e.get('page') == 1]
    p1_text = ' '.join(e.get('text', '') for e in p1_elems)
    m = re.search(r'TUẦN(?:\s+THỨ|\s+SỐ)?\s*(\d+)', p1_text, re.IGNORECASE)
    if m: return int(m.group(1))

    # 3. Check start date
    if doc_meta and doc_meta.get('start_date'):
        return get_week_number(doc_meta['start_date'])

    return get_week_number(datetime.date.today())

def get_export_file_name(doc_meta, elements):
    week_num = get_week_number_from_doc(doc_meta, elements)
    return f"KH TTKS TỔ TPTV-{week_num}"

def extract_doc_metadata(elements):
    meta = {
        'agency_dept': 'PHÒNG CẢNH SÁT GIAO THÔNG',
        'agency_team': 'ĐỘI CẢNH SÁT GIAO THÔNG ĐƯỜNG BỘ',
        'header_date': '',
        'title': 'KẾ HOẠCH CÔNG TÁC TUẦN',
        'date_range': '',
        'intro_text': '1. Thực hiện Kế hoạch số 121/KH-PC08 ngày 22/10/2024 của Phòng PC08, Công an tỉnh Vĩnh Long về thực hiện cao điểm tổng rà soát, phát hiện, thống kê người điều khiển phương tiện mà trong cơ thể có chất ma túy; các điểm, tụ điểm phức tạp về ma túy và đấu tranh, phòng chống tội phạm về ma túy của lực lượng Cảnh sát giao thông trên địa bàn tỉnh; Kế hoạch số 2487/KH-CAT ngày 30/12/2025 của Công an tỉnh về huy động lực lượng khác trong Công an tỉnh phối hợp tuần tra, kiểm soát bảo đảm trật tự, an toàn giao thông đường bộ; Kế hoạch 22/KH-PC08 ngày 18/3/2026 của Phòng PC08 về việc tuần tra, kiểm tra, kiểm soát, xử lý các chuyên đề vi phạm là nguyên nhân chính gây tai nạn giao thông trên các tuyến giao thông đường bộ; Kế hoạch số 166/KH-PC08 ngày 09/6/2026 của Phòng PC08 về việc thực hiện cao điểm phối hợp tuyên truyền, tấn công trấn áp tội phạm về ma tuý giữa Việt Nam, Trung Quốc, Lào và Myanmar trên các tuyến giao thông của lực lượng Cảnh sát giao thông; Kế hoạch số 399/KH-CAT-PC08 ngày 25/8/2026 của Công an tỉnh về tổng kiểm soát, xử lý vi phạm về trật tự an toàn giao thông đường bộ đối với phương tiện kinh doanh vận tải trên địa bàn tỉnh; Kế hoạch số 197/KH-PC08 ngày 14/9/2026 của Phòng PC08 về việc phối hợp tuần tra, kiểm soát phòng, chống đua xe trái phép và phòng chống các loại tội phạm hoạt động theo các tuyến giao thông trên địa bàn tỉnh; Căn cứ kết quả công tác điều tra cơ bản tuyến, điều tra, giải quyết tai nạn giao thông, kết quả xử lý vi phạm giao thông, tình hình trật tự, an toàn giao thông, trật tự xã hội, vi phạm giao thông nổi lên từ ngày 21/9/2026 đến ngày 27/9/2026, Đội Cảnh sát giao thông đường bộ xây dựng kế hoạch công tác tuần như sau:',
        'section2_text': 'Tùy theo tình hình thực tế giao cho chỉ huy Đội Cảnh sát giao thông đường bộ báo cáo Lãnh đạo phòng thay đổi tuyến, địa bàn, thời gian, lực lượng, phương tiện, thiết bị kỹ thuật nghiệp vụ, công cụ hỗ trợ và các điều kiện khác trong kế hoạch ngày cho phù hợp.',
        'signer_doitruong': 'Thượng tá Trần Văn Tiếp',
        'signer_lanhdao': 'Thượng tá Nguyễn Ngọc Ân',
        'start_date': None,
        'end_date': None
    }

    p1_elems = [e for e in elements if e['page'] == 1]
    p1_lines = clean_cell_lines([e['text'] for e in p1_elems])
    p1_full_text = ' '.join(e['text'] for e in p1_elems)

    # 1. Header Date
    found_hd = ""
    for line in p1_lines:
        m = re.search(r'([A-Za-zÀ-ỹ\s]+,\s*ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})', line, re.IGNORECASE) or \
            re.search(r'(ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})', line, re.IGNORECASE)
        if m:
            found_hd = m.group(1).strip()
            break
    if not found_hd:
        m = re.search(r'([A-Za-zÀ-ỹ\s]+,\s*ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})', p1_full_text, re.IGNORECASE) or \
            re.search(r'(ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})', p1_full_text, re.IGNORECASE)
        if m: found_hd = m.group(1).strip()

    if found_hd:
        if ',' not in found_hd: found_hd = 'Vĩnh Long, ' + found_hd
        meta['header_date'] = found_hd

    # 2. Title
    for line in p1_lines:
        m = re.search(r'(KẾ\s+HOẠCH\s+(?:CÔNG\s+TÁC\s+)?TUẦN(?:\s+THỨ|\s+SỐ)?(?:\s+\d+)?)', line, re.IGNORECASE)
        if m:
            meta['title'] = m.group(1).strip().upper()
            break
    if meta['title'] == 'KẾ HOẠCH CÔNG TÁC TUẦN':
        m = re.search(r'(KẾ\s+HOẠCH\s+(?:CÔNG\s+TÁC\s+)?TUẦN(?:\s+THỨ|\s+SỐ)?(?:\s+\d+)?)', p1_full_text, re.IGNORECASE)
        if m: meta['title'] = m.group(1).strip().upper()

    # 3. Date Range
    dr_patterns = [
        r'\(?\s*(?:Từ\s+ngày|từ\s+ngày|Từ|từ)\s*(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\s*(?:đến\s+ngày|đến|-|–)\s*(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\s*\)?',
        r'\((\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\s*(?:đến|-|–)\s*(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\)'
    ]

    dr_m = None
    for line in p1_lines:
        for pat in dr_patterns:
            dr_m = re.search(pat, line, re.IGNORECASE)
            if dr_m: break
        if dr_m: break
    if not dr_m:
        for pat in dr_patterns:
            dr_m = re.search(pat, p1_full_text, re.IGNORECASE)
            if dr_m: break

    if dr_m:
        s_d = int(dr_m.group(1))
        s_m = int(dr_m.group(2))
        s_y = int(dr_m.group(3)) if dr_m.group(3) else None

        e_d = int(dr_m.group(4))
        e_m = int(dr_m.group(5))
        e_y = int(dr_m.group(6)) if dr_m.group(6) else None

        if not e_y and s_y: e_y = s_y
        if not s_y and e_y: s_y = e_y
        if not s_y and not e_y:
            y_m = re.search(r'năm\s+(\d{4})', meta['header_date'], re.IGNORECASE)
            cur_y = int(y_m.group(1)) if y_m else datetime.datetime.now().year
            s_y = cur_y
            e_y = cur_y

        if s_y < 100: s_y += 2000
        if e_y < 100: e_y += 2000

        meta['start_date'] = datetime.date(s_y, s_m, s_d)
        meta['end_date'] = datetime.date(e_y, e_m, e_d)
        meta['date_range'] = f"(Từ ngày {s_d:02d}/{s_m:02d}/{s_y} đến ngày {e_d:02d}/{e_m:02d}/{e_y})"

    intro_lines = []
    is_intro = False
    for line in p1_lines:
        if re.match(r'^1\.\s*Thực\s*hiện', line, re.IGNORECASE):
            is_intro = True
        if is_intro:
            intro_lines.append(line)
            if re.search(r'như\s*sau\s*:?', line, re.IGNORECASE):
                is_intro = False
                break
    if intro_lines:
        meta['intro_text'] = ' '.join(intro_lines)

    max_p = max((e['page'] for e in elements), default=1)
    end_elems = [e for e in elements if e['page'] >= max(1, max_p - 1)]
    end_lines = clean_cell_lines([e['text'] for e in end_elems])

    for i, line in enumerate(end_lines):
        if re.match(r'^ĐỘI\s*TRƯỞNG$', line.strip(), re.IGNORECASE) and i + 1 < len(end_lines):
            nxt = end_lines[i+1].strip()
            if nxt and not any(k in nxt for k in ['TRƯỞNG', 'PHÒNG', 'Nơi', 'Lưu']):
                meta['signer_doitruong'] = nxt
        if re.search(r'(?:KT\.\s*TRƯỞNG\s*PHÒNG|PHÓ\s*TRƯỞNG\s*PHÒNG)', line, re.IGNORECASE):
            for j in range(i+1, min(len(end_lines), i+4)):
                cand = end_lines[j].strip()
                if cand and not any(k in cand for k in ['KT.', 'TRƯỞNG', 'PHÒNG', 'ĐỘI', 'Nơi', 'Lưu']):
                    meta['signer_lanhdao'] = cand
                    break

    return meta

def format_date_vietnamese(d):
    if not d: return ""
    return f"{d.day:02d}/{d.month:02d}/{d.year}"

def process_schedule(pdf_path, officers=None, output_docx=None):
    if officers is None: officers = DEFAULT_OFFICERS

    print(f"[*] Đang đọc và bóc tách file PDF: {pdf_path}...")
    elements = parse_pdf_elements(pdf_path)

    doc_meta = extract_doc_metadata(elements)
    print(f"[*] Kế hoạch: {doc_meta['title']} {doc_meta['date_range']}")

    day_targets = [
        ("Thứ hai", ["thứ hai", "thứ 2"]),
        ("Thứ ba", ["thứ ba", "thứ 3"]),
        ("Thứ tư", ["thứ tư", "thứ 4"]),
        ("Thứ năm", ["thứ năm", "thứ 5"]),
        ("Thứ sáu", ["thứ sáu", "thứ 6"]),
        ("Thứ bảy", ["thứ bảy", "thứ 7"]),
        ("Chủ nhật", ["chủ nhật", "chủ nhật:", "cn"])
    ]

    day_indices = []
    current_target_idx = 0

    for idx, e in enumerate(elements):
        if current_target_idx >= len(day_targets): break
        if e['col'] == 1 or e['x'] < 140:
            text_lower = e['text'].strip().lower()
            d_name, aliases = day_targets[current_target_idx]
            matched = any(text_lower == al or text_lower.startswith(al + ' ') or text_lower.startswith(al + ':') or al in text_lower for al in aliases)
            if matched:
                found_date = ""
                for s_idx in range(idx, min(len(elements), idx + 40)):
                    se = elements[s_idx]
                    if se['col'] == 1 or se['x'] < 140:
                        dm = re.search(r'\b(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?\b', se['text'])
                        if dm:
                            d_val = int(dm.group(1))
                            m_val = int(dm.group(2))
                            y_val = int(dm.group(3)) if dm.group(3) else (doc_meta['start_date'].year if doc_meta['start_date'] else datetime.datetime.now().year)
                            if y_val < 100: y_val += 2000
                            found_date = f"{d_val:02d}/{m_val:02d}/{y_val}"
                            break
                    if s_idx > idx + 5 and se['text'].strip().startswith('Tổ '): break

                if current_target_idx == 0 and found_date and not doc_meta['start_date']:
                    f_d, f_m, f_y = map(int, found_date.split('/'))
                    doc_meta['start_date'] = datetime.date(f_y, f_m, f_d)

                day_indices.append({
                    'day_index': current_target_idx,
                    'name': d_name,
                    'date': found_date,
                    'idx': idx
                })
                current_target_idx += 1

    # Two-pass anchor
    if not doc_meta['start_date']:
        for di in day_indices:
            if di['date']:
                d_p, m_p, y_p = map(int, di['date'].split('/'))
                day_dt = datetime.date(y_p, m_p, d_p)
                doc_meta['start_date'] = day_dt - datetime.timedelta(days=di['day_index'])
                break

    for di in day_indices:
        if not di['date'] and doc_meta['start_date']:
            c_d = doc_meta['start_date'] + datetime.timedelta(days=di['day_index'])
            di['date'] = format_date_vietnamese(c_d)

    if day_indices and day_indices[0]['date']:
        m_d, m_m, m_y = map(int, day_indices[0]['date'].split('/'))
        last_d = day_indices[-1]['date']
        if not doc_meta['date_range']:
            doc_meta['date_range'] = f"(Từ ngày {day_indices[0]['date']} đến ngày {last_d})"
        if not doc_meta['header_date']:
            doc_meta['header_date'] = f"Vĩnh Long, ngày {m_d:02d} tháng {m_m:02d} năm {m_y}"

    if not doc_meta['header_date']: doc_meta['header_date'] = "Vĩnh Long, ngày 28 tháng 9 năm 2026"
    if not doc_meta['date_range']: doc_meta['date_range'] = "(Từ ngày 28/9/2026 đến ngày 04/10/2026)"

    print(f"[*] Kế hoạch: {doc_meta['title']} {doc_meta['date_range']}")

    parsed_days = []
    for i in range(len(day_indices)):
        di = day_indices[i]
        d_name, d_date, start_idx = di['name'], di['date'], di['idx']
        end_idx = day_indices[i+1]['idx'] if i+1 < len(day_indices) else len(elements)
        day_elems = elements[start_idx:end_idx]

        to_starts = []
        for j, e in enumerate(day_elems):
            t = e['text'].strip()
            if "Tổ Cảnh sát" in t or "Tổ CSGT" in t: continue
            m = re.match(r'^Tổ\s*(\d+)', t, re.IGNORECASE)
            if m: to_starts.append((j, f"Tổ {m.group(1)}"))
            elif t.lower() == 'tổ' and j + 1 < len(day_elems) and day_elems[j+1]['text'].strip().isdigit():
                to_starts.append((j, f"Tổ {day_elems[j+1]['text'].strip()}"))

        tv_tos = []
        for k in range(len(to_starts)):
            to_idx, to_name = to_starts[k]
            next_to_idx = to_starts[k+1][0] if k+1 < len(to_starts) else len(day_elems)
            slice_elems = day_elems[to_idx:next_to_idx]

            cols = {1: [], 2: [], 3: [], 4: [], 5: [], 6: []}
            for el in slice_elems:
                if el['page'] >= 2 and el['y'] > 540 and el['text'].isdigit(): continue
                if '2. Thực hiện yêu cầu' in el['text']: break
                cols[el['col']].append(el['text'])

            col2_lines = clean_cell_lines(cols[2])
            col2_full = ' '.join(col2_lines)
            matched = []
            for off in officers:
                words = off.split()
                pattern = r'\b' + r'\s+'.join(re.escape(w) for w in words) + r'\b'
                if off == "Võ Hoàng Tuấn": pattern = r'\b(Võ|Vơ)\s+Hoàng\s+Tuấn\b'
                if re.search(pattern, col2_full, re.IGNORECASE): matched.append(off)

            if matched:
                tv_tos.append({
                    'to_name': to_name,
                    'matched_officers': matched,
                    'col1_lines': clean_cell_lines(cols[1]),
                    'col2_lines': col2_lines,
                    'col3_lines': clean_cell_lines(cols[3]),
                    'col4_lines': clean_cell_lines(cols[4]),
                    'col5_lines': clean_cell_lines(cols[5]),
                    'col6_lines': clean_cell_lines(cols[6])
                })

        # Renumber shifts sequentially for this day: Tổ 1, Tổ 2, ...
        for shift_idx, s in enumerate(tv_tos):
            shift_num = shift_idx + 1
            new_to_name = f"Tổ {shift_num}"
            s['to_name'] = new_to_name
            found_to_header = False
            for l_idx in range(len(s['col2_lines'])):
                l = s['col2_lines'][l_idx].strip()
                if re.match(r'^Tổ\s*\d+', l, re.IGNORECASE) or l.lower() == 'tổ':
                    s['col2_lines'][l_idx] = new_to_name
                    found_to_header = True
                    break
            if not found_to_header:
                s['col2_lines'].insert(0, new_to_name)

        parsed_days.append({'day': d_name, 'date': d_date, 'tv_tos': tv_tos})

    total_shifts = sum(len(d['tv_tos']) for d in parsed_days)
    print(f"[+] Đã tách thành công {total_shifts} ca thuộc Tổ Trà Vinh qua 7 ngày!")

    export_name = get_export_file_name(doc_meta, elements)
    if output_docx is None and pdf_path:
        dir_name = os.path.dirname(pdf_path) or "."
        output_docx = os.path.join(dir_name, f"{export_name}.docx")

    if output_docx:
        export_docx(parsed_days, output_docx, doc_meta)
        print(f"[+] Đã lưu file Word 100% chuẩn OpenXML tại: {output_docx}")

    return parsed_days

def export_docx(parsed_days, output_path, doc_meta=None):
    if doc_meta is None:
        doc_meta = {
            'agency_dept': 'PHÒNG CẢNH SÁT GIAO THÔNG',
            'agency_team': 'ĐỘI CẢNH SÁT GIAO THÔNG ĐƯỜNG BỘ',
            'header_date': 'Vĩnh Long, ngày 28 tháng 9 năm 2026',
            'title': 'KẾ HOẠCH CÔNG TÁC TUẦN',
            'date_range': '(Từ ngày 28/9/2026 đến ngày 04/10/2026)',
            'intro_text': '1. Thực hiện Kế hoạch số 121/KH-PC08 ngày 22/10/2024 của Phòng PC08, Công an tỉnh Vĩnh Long về thực hiện cao điểm tổng rà soát, phát hiện, thống kê người điều khiển phương tiện mà trong cơ thể có chất ma túy; các điểm, tụ điểm phức tạp về ma túy và đấu tranh, phòng chống tội phạm về ma túy của lực lượng Cảnh sát giao thông trên địa bàn tỉnh; Kế hoạch số 2487/KH-CAT ngày 30/12/2025 của Công an tỉnh về huy động lực lượng khác trong Công an tỉnh phối hợp tuần tra, kiểm soát bảo đảm trật tự, an toàn giao thông đường bộ; Kế hoạch 22/KH-PC08 ngày 18/3/2026 của Phòng PC08 về việc tuần tra, kiểm tra, kiểm soát, xử lý các chuyên đề vi phạm là nguyên nhân chính gây tai nạn giao thông trên các tuyến giao thông đường bộ; Kế hoạch số 166/KH-PC08 ngày 09/6/2026 của Phòng PC08 về việc thực hiện cao điểm phối hợp tuyên truyền, tấn công trấn áp tội phạm về ma tuý giữa Việt Nam, Trung Quốc, Lào và Myanmar trên các tuyến giao thông của lực lượng Cảnh sát giao thông; Kế hoạch số 399/KH-CAT-PC08 ngày 25/8/2026 của Công an tỉnh về tổng kiểm soát, xử lý vi phạm về trật tự an toàn giao thông đường bộ đối với phương tiện kinh doanh vận tải trên địa bàn tỉnh; Kế hoạch số 197/KH-PC08 ngày 14/9/2026 của Phòng PC08 về việc phối hợp tuần tra, kiểm soát phòng, chống đua xe trái phép và phòng chống các loại tội phạm hoạt động theo các tuyến giao thông trên địa bàn tỉnh; Căn cứ kết quả công tác điều tra cơ bản tuyến, điều tra, giải quyết tai nạn giao thông, kết quả xử lý vi phạm giao thông, tình hình trật tự, an toàn giao thông, trật tự xã hội, vi phạm giao thông nổi lên từ ngày 21/9/2026 đến ngày 27/9/2026, Đội Cảnh sát giao thông đường bộ xây dựng kế hoạch công tác tuần như sau:',
            'section2_text': 'Tùy theo tình hình thực tế giao cho chỉ huy Đội Cảnh sát giao thông đường bộ báo cáo Lãnh đạo phòng thay đổi tuyến, địa bàn, thời gian, lực lượng, phương tiện, thiết bị kỹ thuật nghiệp vụ, công cụ hỗ trợ và các điều kiện khác trong kế hoạch ngày cho phù hợp.',
            'signer_doitruong': 'Thượng tá Trần Văn Tiếp',
            'signer_lanhdao': 'Thượng tá Nguyễn Ngọc Ân'
        }

    col_widths = [1250, 2250, 1250, 3600, 2900, 3788]
    table_rows_xml = []

    # Row 1: "Nội dung"
    r1_tcPr = make_tcPr_xml(15038, grid_span=6, shading="D9E1F2", v_align="center", borders=True)
    r1_pPr = make_pPr_xml("center", 0, 0, 240)
    r1_rPr = make_rPr_xml("Times New Roman", True, False, 24)
    table_rows_xml.append(f'<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr><w:tc>{r1_tcPr}<w:p>{r1_pPr}<w:r>{r1_rPr}<w:t>Nội dung</w:t></w:r></w:p></w:tc></w:tr>')

    # Row 2: Headers
    headers = [
        "Ngày, tháng",
        "Tổ Cảnh sát\ngiao thông",
        "Lực lượng CS khác,\nCAX được huy động",
        "Hình thức tuần tra,\nkiểm soát",
        "Nhiệm vụ",
        "Sử dụng xe tuần tra, kiểm soát,\nphương tiện, thiết bị kỹ thuật,\nnghiệp vụ, vũ khí, công cụ hỗ trợ"
    ]
    r2_tcs = []
    for h_text, w in zip(headers, col_widths):
        tcPr = make_tcPr_xml(w, shading="F2F2F2", v_align="center", borders=True)
        linesXml = "".join([f'<w:p>{make_pPr_xml("center", 20, 0, 240)}<w:r>{make_rPr_xml("Times New Roman", True, False, 20)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>' for l in h_text.split('\n')])
        r2_tcs.append(f'<w:tc>{tcPr}{linesXml}</w:tc>')
    table_rows_xml.append(f'<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>{"".join(r2_tcs)}</w:tr>')

    # Body Rows
    for day in parsed_days:
        if not day['tv_tos']: continue
        for s_idx, s in enumerate(day['tv_tos']):
            tcs = []
            if s_idx == 0:
                tcPr = make_tcPr_xml(col_widths[0], v_merge="restart", v_align="center", borders=True)
                p1 = f'<w:p>{make_pPr_xml("center", 10, 0, 200)}<w:r>{make_rPr_xml("Times New Roman", True, False, 20)}<w:t>{escape_xml(day["day"])}</w:t></w:r></w:p>'
                p2 = f'<w:p>{make_pPr_xml("center", 0, 0, 200)}<w:r>{make_rPr_xml("Times New Roman", True, False, 18)}<w:t>{escape_xml(day["date"])}</w:t></w:r></w:p>'
                tcs.append(f'<w:tc>{tcPr}{p1}{p2}</w:tc>')
            else:
                tcPr = make_tcPr_xml(col_widths[0], v_merge="continue", v_align="center", borders=True)
                tcs.append(f'<w:tc>{tcPr}<w:p>{make_pPr_xml("left", 0, 0, 200)}</w:p></w:tc>')

            # Col 2
            tc2Pr = make_tcPr_xml(col_widths[1], v_align="top", borders=True)
            p_col2 = []
            for l in s['col2_lines']:
                l = l.strip()
                l = re.sub(r'\bTổ\s+(\d)\s+(\d)\b', r'Tổ \1\2', l)
                pPr = make_pPr_xml("left", 15, 0, 200)
                if re.match(r'^Tổ\s+\d+', l, re.IGNORECASE):
                    p_col2.append(f'<w:p>{pPr}<w:r>{make_rPr_xml("Times New Roman", True, False, 20)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>')
                elif l in ['Tổ trưởng', 'Tổ viên', 'Tổ  viên', 'Tổ phó', 'trưởng', 'viên', 'phó']:
                    role = l
                    if role == 'trưởng': role = 'Tổ trưởng'
                    if role == 'viên': role = 'Tổ viên'
                    if role == 'phó': role = 'Tổ phó'
                    p_col2.append(f'<w:p>{pPr}<w:r>{make_rPr_xml("Times New Roman", False, False, 20)}<w:t>{escape_xml(role)}</w:t></w:r></w:p>')
                else:
                    m = re.match(r'^(.*?)(Tổ\s+trưởng|Tổ\s+viên|Tổ\s+phó|trưởng|viên|phó)$', l, re.IGNORECASE)
                    if m:
                        role = m.group(2)
                        if role == 'trưởng': role = 'Tổ trưởng'
                        if role == 'viên': role = 'Tổ viên'
                        if role == 'phó': role = 'Tổ phó'
                        r1 = f'<w:r>{make_rPr_xml("Times New Roman", True, False, 20)}<w:t xml:space="preserve">{escape_xml(m.group(1).strip())} </w:t></w:r>'
                        r2 = f'<w:r>{make_rPr_xml("Times New Roman", False, False, 20)}<w:t>{escape_xml(role)}</w:t></w:r>'
                        p_col2.append(f'<w:p>{pPr}{r1}{r2}</w:p>')
                    elif re.match(r'^\d+\.\s*(Đ/c|[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ])', l) or 'Đ/c' in l:
                        p_col2.append(f'<w:p>{pPr}<w:r>{make_rPr_xml("Times New Roman", True, False, 20)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>')
                    else:
                        p_col2.append(f'<w:p>{pPr}<w:r>{make_rPr_xml("Times New Roman", False, False, 20)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>')
            tcs.append(f'<w:tc>{tc2Pr}{"".join(p_col2) or "<w:p/>"}</w:tc>')

            # Col 3
            tc3Pr = make_tcPr_xml(col_widths[2], v_align="top", borders=True)
            p_col3 = [f'<w:p>{make_pPr_xml("left", 15, 0, 200)}<w:r>{make_rPr_xml("Times New Roman", False, False, 18)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>' for l in s['col3_lines']]
            tcs.append(f'<w:tc>{tc3Pr}{"".join(p_col3) or "<w:p/>"}</w:tc>')

            # Col 4
            tc4Pr = make_tcPr_xml(col_widths[3], v_align="top", borders=True)
            p_col4 = []
            for l in s['col4_lines']:
                l = l.strip()
                pPr = make_pPr_xml("left", 15, 0, 200)
                if is_header_line(l):
                    p_col4.append(f'<w:p>{pPr}{format_docx_chainage_runs(l, True, 18)}</w:p>')
                elif l.startswith('-') and ':' in l:
                    colon_idx = l.index(':')
                    prefix = l[:colon_idx + 1]
                    content = l[colon_idx + 1:].strip()
                    r1 = f'<w:r>{make_rPr_xml("Times New Roman", True, False, 18)}<w:t xml:space="preserve">{escape_xml(prefix)} </w:t></w:r>'
                    r2 = format_docx_chainage_runs(content, False, 18)
                    p_col4.append(f'<w:p>{pPr}{r1}{r2}</w:p>')
                else:
                    p_col4.append(f'<w:p>{pPr}{format_docx_chainage_runs(l, False, 18)}</w:p>')
            tcs.append(f'<w:tc>{tc4Pr}{"".join(p_col4) or "<w:p/>"}</w:tc>')

            # Col 5
            tc5Pr = make_tcPr_xml(col_widths[4], v_align="top", borders=True)
            p_col5 = []
            for l in s['col5_lines']:
                l = l.strip()
                pPr = make_pPr_xml("left", 15, 0, 200)
                if is_header_line(l):
                    p_col5.append(f'<w:p>{pPr}<w:r>{make_rPr_xml("Times New Roman", True, False, 18)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>')
                elif l.startswith('-') and ':' in l:
                    colon_idx = l.index(':')
                    prefix = l[:colon_idx + 1]
                    content = l[colon_idx + 1:].strip()
                    r1 = f'<w:r>{make_rPr_xml("Times New Roman", True, False, 18)}<w:t xml:space="preserve">{escape_xml(prefix)} </w:t></w:r>'
                    r2 = f'<w:r>{make_rPr_xml("Times New Roman", False, False, 18)}<w:t>{escape_xml(content)}</w:t></w:r>'
                    p_col5.append(f'<w:p>{pPr}{r1}{r2}</w:p>')
                else:
                    p_col5.append(f'<w:p>{pPr}<w:r>{make_rPr_xml("Times New Roman", False, False, 18)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>')
            tcs.append(f'<w:tc>{tc5Pr}{"".join(p_col5) or "<w:p/>"}</w:tc>')

            # Col 6
            tc6Pr = make_tcPr_xml(col_widths[5], v_align="top", borders=True)
            p_col6 = []
            for l in s['col6_lines']:
                l = l.strip()
                pPr = make_pPr_xml("left", 15, 0, 200)
                is_veh = is_header_line(l) or l.startswith('*') or bool(re.search(r'\d{2}[A-Z]\d?\s*-\s*[\d\.]+', l))
                if is_veh:
                    p_col6.append(f'<w:p>{pPr}<w:r>{make_rPr_xml("Times New Roman", True, False, 18)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>')
                elif l.startswith('-') and ':' in l:
                    colon_idx = l.index(':')
                    prefix = l[:colon_idx + 1]
                    content = l[colon_idx + 1:].strip()
                    r1 = f'<w:r>{make_rPr_xml("Times New Roman", True, False, 18)}<w:t xml:space="preserve">{escape_xml(prefix)} </w:t></w:r>'
                    r2 = f'<w:r>{make_rPr_xml("Times New Roman", False, False, 18)}<w:t>{escape_xml(content)}</w:t></w:r>'
                    p_col6.append(f'<w:p>{pPr}{r1}{r2}</w:p>')
                else:
                    p_col6.append(f'<w:p>{pPr}<w:r>{make_rPr_xml("Times New Roman", False, False, 18)}<w:t>{escape_xml(l)}</w:t></w:r></w:p>')
            tcs.append(f'<w:tc>{tc6Pr}{"".join(p_col6) or "<w:p/>"}</w:tc>')

            table_rows_xml.append(f'<w:tr>{"".join(tcs)}</w:tr>')

    agency_dept = doc_meta.get('agency_dept', 'PHÒNG CẢNH SÁT GIAO THÔNG')
    agency_team = doc_meta.get('agency_team', 'ĐỘI CẢNH SÁT GIAO THÔNG ĐƯỜNG BỘ')
    header_date = doc_meta.get('header_date', 'Vĩnh Long, ngày 28 tháng 9 năm 2026')
    doc_title = doc_meta.get('title', 'KẾ HOẠCH CÔNG TÁC TUẦN')
    date_range = doc_meta.get('date_range', '(Từ ngày 28/9/2026 đến ngày 04/10/2026)')

    document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
        {make_pPr_xml("right", 30, 0, 200)}
        <w:r>{make_rPr_xml("Times New Roman", True, False, 20)}<w:t>Mẫu số 03/TT</w:t></w:r>
        <w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:br/></w:r>
        <w:r>{make_rPr_xml("Times New Roman", False, True, 16)}<w:t>(Kèm theo Thông tư số 14/2025/TT-BCA ngày 28/02/2025 của Bộ trưởng Bộ Công an)</w:t></w:r>
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
                <w:p>{make_pPr_xml("center", 20, 0, 200)}<w:r>{make_rPr_xml("Times New Roman", False, False, 22)}<w:t>{escape_xml(agency_dept)}</w:t></w:r></w:p>
                <w:p>{make_pPr_xml("center", 10, 0, 200)}<w:r>{make_rPr_xml("Times New Roman", True, False, 22)}<w:t>{escape_xml(agency_team)}</w:t></w:r></w:p>
            </w:tc>
            <w:tc>
                <w:tcPr><w:tcW w:w="8000" w:type="dxa"/></w:tcPr>
                <w:p>{make_pPr_xml("center", 20, 0, 200)}<w:r>{make_rPr_xml("Times New Roman", True, False, 22)}<w:t>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</w:t></w:r></w:p>
                <w:p>{make_pPr_xml("center", 30, 0, 200)}<w:r>{make_rPr_xml("Times New Roman", True, False, 22)}<w:t>Độc lập - Tự do - Hạnh phúc</w:t></w:r></w:p>
                <w:p>{make_pPr_xml("center", 20, 0, 200)}<w:r>{make_rPr_xml("Times New Roman", False, True, 20)}<w:t>{escape_xml(header_date)}</w:t></w:r></w:p>
            </w:tc>
        </w:tr>
    </w:tbl>
    <w:p>
        {make_pPr_xml("center", 20, 50, 200)}
        <w:r>{make_rPr_xml("Times New Roman", True, False, 28)}<w:t>{escape_xml(doc_title)}</w:t></w:r>
    </w:p>
    <w:p>
        {make_pPr_xml("center", 60, 0, 200)}
        <w:r>{make_rPr_xml("Times New Roman", True, True, 22)}<w:t>{escape_xml(date_range)}</w:t></w:r>
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
        {"".join(table_rows_xml)}
    </w:tbl>
    <w:sectPr>
        <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
        <w:pgMar w:top="720" w:bottom="720" w:left="900" w:right="900" w:header="360" w:footer="360"/>
    </w:sectPr>
  </w:body>
</w:document>'''

    styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
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
</w:styles>'''

    font_table_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="Times New Roman">
    <w:panose1 w:val="02020603050405020304"/>
    <w:charset w:val="00"/>
    <w:family w:val="roman"/>
    <w:pitch w:val="variable"/>
  </w:font>
</w:fonts>'''

    content_types_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
</Types>'''

    root_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''

    document_rels_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
</Relationships>'''

    with zipfile.ZipFile(output_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', content_types_xml.encode('utf-8'))
        z.writestr('_rels/.rels', root_rels_xml.encode('utf-8'))
        z.writestr('word/_rels/document.xml.rels', document_rels_xml.encode('utf-8'))
        z.writestr('word/document.xml', document_xml.encode('utf-8'))
        z.writestr('word/styles.xml', styles_xml.encode('utf-8'))
        z.writestr('word/fontTable.xml', font_table_xml.encode('utf-8'))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        pdf_file = sys.argv[1]
        out_docx = sys.argv[2] if len(sys.argv) > 2 else None
        process_schedule(pdf_file, output_docx=out_docx)
    else:
        # Prompt user interactively
        print("=== PHẦN MỀM TÁCH TỔ TUẦN TRA CSGT (OFFLINE) ===")
        pdf_path = input("Kéo thả hoặc nhập đường dẫn file PDF Kế hoạch tuần: ").strip().strip("'\"")
        if pdf_path and os.path.exists(pdf_path):
            process_schedule(pdf_path, output_docx=None)
            input("\nNhấn Enter để kết thúc...")
        else:
            print("Không tìm thấy file PDF. Vui lòng kiểm tra lại đường dẫn!")
