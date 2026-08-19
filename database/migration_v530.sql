/* ================================================================
   MIGRATION v5.30 — Gia cong: hang muc + nhieu nha + SL nhan; cong doan "Nhan gia cong" (NGC)
   ----------------------------------------------------------------
   Theo yeu cau (Ghi nhan tien do):
   - Cong doan "Giao gia cong" (GC): tick giao gia cong -> chon HANG MUC gia cong (don gia lay tu Ky
     thuat, BO he so), duoi moi hang muc them NHIEU nha gia cong + so luong tung nha. => them cot
     HangMucGiaCongID vao DonHangChiTietNhaGiaCong (moi dong = 1 nha thuoc 1 hang muc, don gia dung
     chung cua hang muc do lay tu DonHangHangMucGiaCong - chi xem).
   - Cong doan MOI "Nhan gia cong" (NGC) sau GC: hien cac nha da giao + SL giao, nhap SL NHAN.
     => them cot SoLuongNhan vao DonHangChiTietNhaGiaCong + them cong doan NGC vao CongDoanSanXuat.
   - He so o "Don gia Giao gia cong" (HangMucGiaCong.HeSoMacDinh / DonHangHangMucGiaCong.HeSo) chi bo
     KHOI GIAO DIEN, cot DB giu nguyen (mo coi) de khong mat du lieu / khong can migration pha.

   Chay 1 lan. IDEMPOTENT. YEU CAU: da co DonHangChiTietNhaGiaCong (migration_v513/v519/v524) +
   HangMucGiaCong/DonHangHangMucGiaCong (migration_v524) + CongDoanSanXuat.
   ================================================================ */
USE QLNoiBo;
GO

/* ---------------- 1. DonHangChiTietNhaGiaCong: + HangMucGiaCongID, + SoLuongNhan ---------------- */
IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'HangMucGiaCongID') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD HangMucGiaCongID INT NULL
        FOREIGN KEY REFERENCES HangMucGiaCong(HangMucGiaCongID);
    PRINT 'Da them cot DonHangChiTietNhaGiaCong.HangMucGiaCongID.';
END ELSE PRINT 'Cot HangMucGiaCongID da ton tai, bo qua.';
GO

IF COL_LENGTH('DonHangChiTietNhaGiaCong', 'SoLuongNhan') IS NULL
BEGIN
    ALTER TABLE DonHangChiTietNhaGiaCong ADD SoLuongNhan INT NULL;
    PRINT 'Da them cot DonHangChiTietNhaGiaCong.SoLuongNhan.';
END ELSE PRINT 'Cot SoLuongNhan da ton tai, bo qua.';
GO

/* ---------------- 2. Cong doan moi 'NGC' (Nhan gia cong) - ThuTu 40, ngay sau GC(30), truoc MAY(70) --------- */
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'NGC')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Nhận gia công', 40, N'NGC', 1);
GO

PRINT '=== migration_v530.sql hoan tat ===';
GO
