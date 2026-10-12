/* ================================================================================================
   migration_v875.sql   (v8.78)
   PHIEU THU: them loai doi tuong NHA CUNG CAP
   ------------------------------------------------------------------------------------------------
   Yeu cau: o "Loai doi tuong" cua phieu thu truoc day chi co KhachHang / Khac. Nay them NhaCungCap
   de ghi nhan tien NCC HOAN LAI (tien thua, hang loi, chiet khau tra sau).

   Them DUY NHAT mot cot: PhieuThu.NCC_ID INT NULL  (+ khoa ngoai ve NhaCungCap).
   KHONG dung den du lieu da co: moi phieu thu cu giu nguyen LoaiDoiTuong = N'KhachHang' va
   NCC_ID = NULL, nen cong no khach hang va cong no NCC khong doi mot dong nao sau khi chay file nay.

   ⚠️ VI SAO KHONG DUNG LAI COT KhachHangID
   PhieuChi da co san CA HAI cot rieng (NCC_ID, NhaGiaCongID) va chuanHoaPhieuChi() NULL hoa cheo
   theo LoaiDoiTuong. Phieu thu lam y het: moi loai doi tuong mot cot khoa ngoai rieng. Nhoi id NCC
   vao cot KhachHangID la pha khoa ngoai (FK_PhieuThu_KhachHang) va lam moi cau JOIN theo
   KhachHangID tra ve rac.

   ⚠️ CONG NO NCC SE DOI KE TU PHIEU THU NCC DAU TIEN
   Thu tien tu NCC = minh da tra it di => SO CON NO NCC TANG LAI.
   congNoNCC():    daTra = SUM(PhieuChi) - SUM(PhieuThu cua NCC do)
   soChiTietNCC(): phieu thu vao cot ThanhToan voi DAU AM (luy ke = PhatSinh - ThanhToan)
   Hai cong thuc nay PHAI KHOP NHAU — lech la bang tong va so chi tiet ra hai con so khac nhau.
   Chay rieng file nay (chua copy code moi) thi KHONG co gi doi, vi chua ai tao duoc phieu thu NCC.

   Chay:  sqlcmd / SSMS tren database QLNoiBo
   Sau do: pm2 restart qlnoibo   +   Ctrl+F5 tren trinh duyet
   ================================================================================================ */

USE QLNoiBo;
GO

IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

PRINT '=== migration_v875: PhieuThu.NCC_ID ===';
GO

/* ---------------- 1. Them cot NCC_ID ---------------- */
IF COL_LENGTH('PhieuThu', 'NCC_ID') IS NULL
BEGIN
    ALTER TABLE PhieuThu ADD NCC_ID INT NULL;
    PRINT '  + PhieuThu.NCC_ID (thu tien NCC hoan lai)';
END
ELSE PRINT '  = PhieuThu.NCC_ID da co, bo qua';
GO

/* ---------------- 2. Khoa ngoai ve NhaCungCap ----------------
   WITH NOCHECK: khong bat SQL Server quet lai toan bo bang cu (moi dong deu NCC_ID = NULL nen
   khong the vi pham), giong cach migration_v696 lam voi NhaCungCap.KhachHangID. */
IF COL_LENGTH('PhieuThu', 'NCC_ID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_PhieuThu_NhaCungCap')
BEGIN
    ALTER TABLE PhieuThu WITH NOCHECK
      ADD CONSTRAINT FK_PhieuThu_NhaCungCap FOREIGN KEY (NCC_ID) REFERENCES NhaCungCap(NCC_ID);
    PRINT '  + FK_PhieuThu_NhaCungCap';
END
ELSE PRINT '  = FK_PhieuThu_NhaCungCap da co (hoac chua co cot), bo qua';
GO

/* ---------------- 3. Chi muc tra cuu theo NCC ----------------
   congNoNCC() va soChiTietNCC() deu loc WHERE NCC_ID = @id AND LoaiDoiTuong = N'NhaCungCap'.
   Chi muc LOC (filtered index) chi phu phan NCC_ID IS NOT NULL — bang phieu thu phan lon la cua
   khach hang nen chi muc day du se phi cho khong. */
IF COL_LENGTH('PhieuThu', 'NCC_ID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PhieuThu_NCC' AND object_id = OBJECT_ID('PhieuThu'))
BEGIN
    CREATE INDEX IX_PhieuThu_NCC ON PhieuThu(NCC_ID) WHERE NCC_ID IS NOT NULL;
    PRINT '  + IX_PhieuThu_NCC (filtered)';
END
ELSE PRINT '  = IX_PhieuThu_NCC da co, bo qua';
GO

/* ---------------- 4. DOI CHIEU SAU KHI CHAY ----------------
   Ca hai con so duoi day PHAI bang 0 ngay sau khi chay migration (chua ai tao phieu thu NCC). */
PRINT '';
PRINT '--- Doi chieu (ca hai phai = 0 ngay sau khi chay) ---';
SELECT COUNT(*) AS SoPhieuThuGanNCC FROM PhieuThu WHERE NCC_ID IS NOT NULL;
SELECT COUNT(*) AS SoPhieuThuLoaiNhaCungCap FROM PhieuThu WHERE LoaiDoiTuong = N'NhaCungCap';
GO

/* ---------------- 5. CAU KIEM TRA DUNG VE SAU ----------------
   Dong nao hien ra o day la DU LIEU HONG — loai va cot khoa khong khop nhau:
     LoaiDoiTuong = N'NhaCungCap' ma NCC_ID NULL  -> khong biet thu cua NCC nao
     NCC_ID co gia tri ma loai KHAC 'NhaCungCap'  -> tien se khong vao cong no NCC (bi loc ra)
     LoaiDoiTuong = N'NhaCungCap' ma con KhachHangID -> chuanHoaPhieuThu() quen NULL hoa cheo
   Binh thuong phai TRONG. */
SELECT PhieuThuID, SoPhieu, NgayThu, LoaiDoiTuong, KhachHangID, NCC_ID, TenDoiTuong, SoTien
FROM PhieuThu
WHERE (LoaiDoiTuong = N'NhaCungCap' AND NCC_ID IS NULL)
   OR (NCC_ID IS NOT NULL AND LoaiDoiTuong <> N'NhaCungCap')
   OR (LoaiDoiTuong = N'NhaCungCap' AND KhachHangID IS NOT NULL);
GO

PRINT '';
PRINT '=== migration_v875 XONG ===';
PRINT 'Tiep theo: copy code moi -> pm2 restart qlnoibo -> Ctrl+F5 tren trinh duyet.';
GO
