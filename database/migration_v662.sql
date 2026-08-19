/* ================================================================
   MIGRATION v6.01 — (1) Sổ cắt: cột GIẬT CẤP; (2) Giao in thêu: HẠNG MỤC IN THÊU
   ----------------------------------------------------------------
   1) TienDoCatChiTietCay.SoCaiGiatCap (INT NULL)
      Số lượng CÁI cắt giật cấp của từng cây/bàn cắt.
      QUY TẮC NGHIỆP VỤ (theo yêu cầu): giật cấp KHÔNG cộng vào SỐ LỚP, chỉ cộng vào TỔNG SỐ LƯỢNG CÁI
      của bàn cắt đó. Vì vậy:
        - Cột tính sẵn SoLuongCai (= SoLuongLop * HeSoQuyDoi, PERSISTED từ migration_v5_qlsx.sql) GIỮ
          NGUYÊN, KHÔNG sửa công thức (sửa cột tính sẵn phải DROP/ADD lại, rủi ro cao và không cần thiết).
        - Tổng SL cái thật = SoLuongCai + ISNULL(SoCaiGiatCap, 0) — được cộng ở tầng code (qlsx.js khi ghi
          TienDoChiTietMau, và ở bản in sổ cắt).
      Hệ quả có Ý ĐỊNH: TienDoChiTietMau (SL cắt theo màu — Kho nhập / báo cáo năng suất đọc) TĂNG thêm
      phần giật cấp. KHÔNG ảnh hưởng: Bảng kê BTP (điền theo SỐ LỚP) và Lương trải vải cắt (mét × lớp × khổ).

   2) DonHangNhaInTheu.HangMucInThe (NVARCHAR(200) NULL)
      Tên hạng mục in/thêu của dòng giao — CHỌN từ "Đơn giá in thêu" của đơn (DonHangDonGiaInThe.Ten)
      nhưng lưu dạng CHỮ (snapshot), KHÔNG lưu khóa ngoại: màn "Đơn giá in thêu" khi Lưu là XÓA HẾT dòng
      của bản rồi chèn lại (ID đổi mỗi lần sửa) nên khóa ngoại sẽ mồ côi. Cùng quy ước với
      TienDoSanXuat.TenNhaGiaCongTaiThoiDiem.
      Bảng lương gia công in thêu: dòng ĐÃ chọn hạng mục -> đơn giá = đơn giá CỦA hạng mục đó; dòng để
      trống (dữ liệu cũ) -> giữ cách cũ = TỔNG đơn giá in thêu của đơn.

   Chạy 1 lần. IDEMPOTENT. Chạy được nhiều lần không lỗi.
   YEU CAU: migration_v5_qlsx.sql (TienDoCatChiTietCay), migration_v532.sql (DonHangNhaInTheu).
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. TienDoCatChiTietCay.SoCaiGiatCap ---------------- */
IF COL_LENGTH('TienDoCatChiTietCay', 'SoCaiGiatCap') IS NULL
BEGIN
    ALTER TABLE TienDoCatChiTietCay ADD SoCaiGiatCap INT NULL;
    PRINT 'Da them TienDoCatChiTietCay.SoCaiGiatCap.';
END
ELSE PRINT 'TienDoCatChiTietCay.SoCaiGiatCap da co, bo qua.';
GO

/* ---------------- 2. DonHangNhaInTheu.HangMucInThe ---------------- */
IF COL_LENGTH('DonHangNhaInTheu', 'HangMucInThe') IS NULL
BEGIN
    ALTER TABLE DonHangNhaInTheu ADD HangMucInThe NVARCHAR(200) NULL;
    PRINT 'Da them DonHangNhaInTheu.HangMucInThe.';
END
ELSE PRINT 'DonHangNhaInTheu.HangMucInThe da co, bo qua.';
GO

PRINT 'MIGRATION v662 HOAN TAT.';
GO
SET NOEXEC OFF;
GO
