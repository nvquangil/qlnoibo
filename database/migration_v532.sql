/* ================================================================
   MIGRATION v5.32 — In thêu thành 2 công đoạn (Giao/Nhận nhà in thêu), chèn sau Cắt trước Giao gia công
   ----------------------------------------------------------------
   Theo yeu cau: "Giao nha in theu" + "Nhan nha in theu" tro thanh 2 CONG DOAN trong Ghi nhan tien do
   (thay cho 2 tab rieng cu, se bo o frontend). Moi don CHON DUOC NHIEU nha in theu, moi nha co SL giao
   (cong doan Giao) + SL nhan (cong doan Nhan). Hien tong SL ban cat mau chinh o cong doan Giao (tham khao).

   - Bang moi DonHangNhaInTheu: nhieu dong/don (1 dong = 1 nha in theu + SL giao + SL nhan).
   - 2 cong doan moi: GIT (Giao in theu, ThuTu 22) + NIT (Nhan in theu, ThuTu 24) - nam GIUA Cat(20) va
     Giao gia cong GC(30). Luong: ... Cat -> Giao in theu -> Nhan in theu -> Giao gia cong -> ...
   - Cot cu DonHangSanXuat.NhaInID/NgayGiaoIn/NgayNhanIn GIU LAI (mo coi) cho lich su don cu + bao cao in.

   Chay 1 lan. IDEMPOTENT. YEU CAU: schema.sql (co NhaGiaCong, DonHangSanXuat, CongDoanSanXuat).
   ================================================================ */
USE QLNoiBo;
GO

/* ---------------- 1. Bang DonHangNhaInTheu (nhieu nha in theu / don) ---------------- */
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangNhaInTheu')
BEGIN
    CREATE TABLE DonHangNhaInTheu (
        ID          INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID   INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        NhaInID     INT NOT NULL FOREIGN KEY REFERENCES NhaGiaCong(NhaGiaCongID),
        SoLuongGiao INT NULL,
        SoLuongNhan INT NULL,
        GhiChu      NVARCHAR(255) NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_DHNhaInTheu_Don ON DonHangNhaInTheu(DonHangID);
    PRINT 'Da tao DonHangNhaInTheu.';
END ELSE PRINT 'DonHangNhaInTheu da ton tai, bo qua.';
GO

/* ---------------- 2. 2 cong doan moi GIT + NIT (giua Cat 20 va GC 30) ---------------- */
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'GIT')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Giao in thêu', 22, N'GIT', 1);
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'NIT')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Nhận in thêu', 24, N'NIT', 1);
GO

PRINT '=== migration_v532.sql hoan tat (in theu 2 cong doan + DonHangNhaInTheu) ===';
GO
