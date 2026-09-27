# ỨNG DỤNG TÁCH TỔ TUẦN TRA - KẾ HOẠCH TUẦN CSGT (MẪU 03/TT)

Ứng dụng web tự động đọc Kế hoạch tuần tra, kiểm soát giao thông tổng thể (File PDF Mẫu số 03/TT của Bộ Công an), tự động quét và lọc ra các ca trực thuộc **Tổ Trà Vinh** (hoặc bất kỳ Tổ nào), tự động gộp dòng ngày/thứ để bảng biểu gọn gàng, rõ ràng, giúp cán bộ chiến sĩ dễ dàng tra cứu và ghi vào **Sổ Nhật ký tuần tra (NKTT)**.

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Tự động lọc ca trực chính xác:**
   - Quét toàn bộ các ca/tổ trong tuần (Thứ 2 đến Chủ Nhật).
   - Tự động nhận diện ca trực khi có từ 1 đến nhiều cán bộ thuộc Tổ Trà Vinh tham gia.
   - Loại bỏ các ca trực của các địa bàn/tổ khác, giúp giảm bớt tài liệu cồng kềnh (từ ~70 trang xuống chỉ còn các ca của Tổ mình).

2. **Gộp dòng ngày/thứ thông minh:**
   - Cột ngày/tháng được gộp lại (merge cell) cho từng ngày, không lặp lại `Thứ hai`, `Thứ ba` nhiều lần, giúp giao diện bảng trực quan, khoa học.

3. **Xuất file Word (.docx) chuẩn Mẫu số 03/TT:**
   - Tạo file Word hoàn chỉnh gồm: Quốc hiệu, Tiêu ngữ, Tên cơ quan, Căn cứ pháp lý, Bảng 6 cột chuẩn quy định, Mục 2 (Nhiệm vụ khác), Nơi nhận và Chữ ký Lãnh đạo Đội / Phòng.
   - Khổ giấy ngang A4 chuẩn in ấn.

4. **Chạy trực tiếp 100% trên Trình duyệt (Client-Side):**
   - Không gửi dữ liệu lên máy chủ ngoài, an toàn và bảo mật tuyệt đối cho tài liệu ngành.
   - Chạy mượt mà trên máy tính, laptop, điện thoại.

5. **Tùy chỉnh danh sách cán bộ linh hoạt:**
   - Có sẵn 13 cán bộ Tổ Trà Vinh mặc định.
   - Có thể thêm, sửa, xóa hoặc đổi sang danh sách của Tổ khác khi có thay đổi nhân sự.

---

## 🚀 HƯỚNG DẪN ĐƯA LÊN GITHUB & CHẠY MIỄN PHÍ VỚI GITHUB PAGES

Chỉ với 3 bước đơn giản, anh em có thể đưa lên GitHub để tất cả đồng chí trong Tổ cùng dùng qua trình duyệt:

### Bước 1: Đẩy mã nguồn lên GitHub
Nếu dùng Git trên máy tính:
```bash
git init
git add .
git commit -m "feat: Phan mem tach to tuan tra CSGT"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/tach-to-tuan-tra-csgt.git
git push -u origin main
```

### Bước 2: Kích hoạt GitHub Pages
1. Vào repository trên GitHub -> Chọn tab **Settings** (Cài đặt).
2. Ở thanh bên trái, chọn mục **Pages**.
3. Tại phần **Build and deployment** -> **Branch**, chọn nhánh `main` và thư mục `/ (root)` -> Bấm **Save**.

### Bước 3: Sử dụng
Sau 1-2 phút, GitHub sẽ cung cấp một đường link (ví dụ: `https://<ten-tai-khoan>.github.io/tach-to-tuan-tra-csgt/`).  
Anh em chỉ cần mở link này trên điện thoại hoặc máy tính:
1. Nhấn chọn file PDF Kế hoạch tuần.
2. Bấm **Bắt đầu tách ca Tổ Trà Vinh**.
3. Xem bảng tổng hợp hoặc bấm **Xuất file Word (.docx)** để tải về.

---

## 💻 CHẠY OFFLINE BẰNG PYTHON (NẾU CẦN)

Nếu muốn chạy offline bằng dòng lệnh trên máy tính:

```bash
python3 split_schedule.py "duong_dan_file_ke_hoach_tuan.pdf" "KE_HOACH_TO_TRA_VINH.docx"
```

---

## 👥 DANH SÁCH 13 CÁN BỘ TỔ TRÀ VINH (MẶC ĐỊNH)

1. Nguyễn Hoàng Tuấn (Thiếu tá)
2. Đường Thanh Truyền (Thiếu tá)
3. Thạch Sô Ran Thi (Trung tá)
4. Võ Hoàng Tuấn (Trung tá)
5. Nguyễn Thị Ửng (Trung tá)
6. Lý Thị Hồng Lài (Trung tá)
7. Trần Minh Thắng (Thiếu tá)
8. Nguyễn Vũ Cường (Thiếu tá)
9. Nguyễn Văn Nhiệm (Đại uý)
10. Phạm Lê Duy (Đại uý)
11. Lê Hà Phương (Đại uý)
12. Võ Văn Việt (Đại uý)
13. Hà Trung Nhu (Thượng uý)
