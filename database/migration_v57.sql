/* ================================================================
   MIGRATION v5.7 — QLSX: them "Ma cong doan" cho danh muc Cong doan
   san xuat (Cat/May/Ky thuat...), luu VET SU KIEN don vi tinh da chon
   luc "Kho nhap" va ten nha gia cong TAI THOI DIEM ghi nhan "May" (de
   hien thi day du hon o Lich su cap nhat tien do / phieu in). Additive
   - KHONG xoa bang/cot cu, chi ALTER TABLE ADD cot moi NULL-able.
   Idempotent - chay lai an toan, khong mat du lieu.
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. CongDoanSanXuat.MaCongDoan - yeu cau v5.7 "Danh mục Công đoạn sản xuất – thêm mã công đoạn,
   để công đoạn Ghi nhận tiến độ liên kết theo mã, không bị đứt khi đổi tên công đoạn". Chi them COT,
   KHONG doi cac cho dang so sanh truc tiep theo TenCongDoan trong code (qlsx.js) sang so sanh theo
   StageID/MaCongDoan - pham vi v5.7 dung o muc "them truong + hien thi trong danh muc" (xem
   HUONG_DAN_CAI_DAT.md - phan quyet dinh v5.7 - de biet ly do khong lam full refactor ngay). Cung
   pattern da dung cho CongDoanMay.MaCongDoan (migration_v5_qlsx.sql). */
IF COL_LENGTH('CongDoanSanXuat', 'MaCongDoan') IS NULL
    ALTER TABLE CongDoanSanXuat ADD MaCongDoan NVARCHAR(30) NULL;
GO

/* ---- 2. TienDoChiTietMau.DonViDaChon - yeu cau v5.7 "Lịch sử cập nhật tiến độ - Kho nhập hiển thị đơn
   vị tính". Truoc day don vi chon o cong doan "Kho nhap" (Cai/Ri) CHI dung TAM THOI de tinh delta cho
   The kho hang hoa (xem POST /orders/:maDH/tiendo) roi bi bo, khong luu lai lam ban ghi lich su - day
   la CHUA co du lieu de hien (khac loi hien thi/truy van don thuan), can them cot moi. Chi ap dung cho
   dong Kho nhap tu sau khi nang cap; du lieu Kho nhap TRUOC do se hien trong (khong bia them lich su
   khong co that). */
IF COL_LENGTH('TienDoChiTietMau', 'DonViDaChon') IS NULL
    ALTER TABLE TienDoChiTietMau ADD DonViDaChon NVARCHAR(30) NULL;
GO

/* ---- 3. TienDoSanXuat.TenNhaGiaCongTaiThoiDiem - yeu cau v5.7 "Lịch sử cập nhật tiến độ - May hiển thị
   tên nhà gia công". NhaGiaCongID tren DonHangSanXuat la 1 GIA TRI DUY NHAT bi GHI DE moi lan doi (xem
   openVendorForm/POST .../tiendo nhanh "Ky thuat"), khong co lich su rieng theo tung lan cap nhat "May".
   Chup lai (snapshot) ten nha gia cong HIEN TAI ngay luc ghi nhan tien do "May" vao cot moi nay - CHINH
   XAC cho tung lan ghi nhan tu sau khi nang cap, khong hoi to lai duoc cho du lieu "May" da co TRUOC do
   (se hien trong - phieu in van con hien 1 dong "Nha gia cong hien tai" rieng ngoai bang lich su, xem
   openPrint() trong module.qlsx.js, nen thong tin khong bi mat hoan toan). */
IF COL_LENGTH('TienDoSanXuat', 'TenNhaGiaCongTaiThoiDiem') IS NULL
    ALTER TABLE TienDoSanXuat ADD TenNhaGiaCongTaiThoiDiem NVARCHAR(200) NULL;
GO

PRINT 'Hoan tat migration v5.7.';
GO
