/* ================================================================================================
   MIGRATION v6.31 — DANH MUC DON VI TINH LA NGUON DUY NHAT + BO CHUOI "Ri" KHOI PHEP TINH
   ------------------------------------------------------------------------------------------------
   VAN DE DANG CO:
     Chuoi 'Ri' bi GAI CUNG trong ~20 cho de quyet dinh CO NHAN/CHIA he so quy doi hay khong:
        banhang.js, khohang.js, public.js, baocao.js, common.js, module.khohang.js...
     Vi du: slSangCai() = (donVi.toLowerCase() === 'ri') ? soLuong * LoaiRi : soLuong
     => Ai khai don vi gop ten KHAC 'Ri' (Tá, Thùng, Lố...) thi he thong KHONG nhan he so
        -> TRU TON THIEU dung gap LoaiRi lan, KHONG bao loi gi ca.

   CACH CHUA (v6.31):
     Bo hoan toan viec so ten voi 'Ri'. Cau hoi dung phai la:
        "don vi nay CO PHAI la DON VI QUY DOI cua CHINH MA HANG DO khong?"
        tuc:  donVi == TheKhoHangHoa.DonViQuyDoi   ->  NHAN he so LoaiRi
     Cach nay von da duoc dung DUNG o qlsx.js (~dong 3187) tu lau — nay nhan rong ra toan he thong.
     Nho vay khai don vi gop ten gi cung chay dung, va du lieu cu (Ri) van y nguyen ket qua.

   BANG DANH MUC:
     DanhMucDonViTinh tro thanh NGUON DUY NHAT cho moi o chon don vi trong phan mem.
     Them cot LaDonViGop de danh dau "don vi nay gom nhieu don vi goc" (Ri, Tá, Thùng...) —
     dung cho GIAO DIEN goi y + canh bao, KHONG phai de tinh toan (tinh toan dua vao DonViQuyDoi
     cua tung ma hang nhu tren).

   Chay 1 lan. IDEMPOTENT.
   ================================================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Bang danh muc don vi tinh (tao neu chua co) ---------------- */
IF OBJECT_ID('dbo.DanhMucDonViTinh', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.DanhMucDonViTinh (
        DonViTinhID  INT IDENTITY(1,1) PRIMARY KEY,
        TenDonVi     NVARCHAR(30) NOT NULL UNIQUE,
        GhiChu       NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang DanhMucDonViTinh.';
END
GO

/* ---------------- 2. Them cot phan loai + thu tu hien thi ---------------- */
IF COL_LENGTH('dbo.DanhMucDonViTinh', 'LaDonViGop') IS NULL
BEGIN
    ALTER TABLE dbo.DanhMucDonViTinh ADD LaDonViGop BIT NOT NULL
        CONSTRAINT DF_DMDVT_LaDonViGop DEFAULT 0;
    PRINT 'Da them cot DanhMucDonViTinh.LaDonViGop.';
END ELSE PRINT 'Cot LaDonViGop da ton tai, bo qua.';
GO
IF COL_LENGTH('dbo.DanhMucDonViTinh', 'ThuTu') IS NULL
BEGIN
    ALTER TABLE dbo.DanhMucDonViTinh ADD ThuTu INT NULL;
    PRINT 'Da them cot DanhMucDonViTinh.ThuTu.';
END ELSE PRINT 'Cot ThuTu da ton tai, bo qua.';
GO

/* ---------------- 3. Bo sung cac don vi DANG DUOC GO CUNG trong code nhung THIEU trong danh muc ----
   Neu khong bo sung, doi dropdown sang danh muc se LAM MAT cac lua chon dang dung
   (vd Yard o "Chi dinh vai SX", Bó/Túi/Thùng o "Tai lieu ky thuat").                              */
MERGE DanhMucDonViTinh AS t
USING (VALUES
    (N'Cái',    0,  1, NULL),
    (N'Bộ',     0,  2, N'Đơn vị gốc, xử lý y hệt Cái'),
    (N'Chiếc',  0,  3, NULL),
    (N'Đôi',    0,  4, NULL),
    (N'Mét',    0, 10, NULL),
    (N'Yard',   0, 11, NULL),
    (N'Kg',     0, 12, NULL),
    (N'Ri',     1, 20, N'Đơn vị GỘP: 1 Ri = <tỷ lệ quy đổi> đơn vị gốc'),
    (N'Tá',     1, 21, N'Đơn vị GỘP: 1 Tá = 12'),
    (N'Lố',     1, 22, N'Đơn vị GỘP'),
    (N'Cuộn',   1, 23, NULL),
    (N'Bó',     1, 24, NULL),
    (N'Túi',    1, 25, NULL),
    (N'Thùng',  1, 26, NULL),
    (N'Bao',    1, 27, NULL)
) AS s (TenDonVi, LaDonViGop, ThuTu, GhiChu)
ON t.TenDonVi = s.TenDonVi
WHEN NOT MATCHED THEN
    INSERT (TenDonVi, LaDonViGop, ThuTu, GhiChu) VALUES (s.TenDonVi, s.LaDonViGop, s.ThuTu, s.GhiChu);
GO

/* Danh dau lai LaDonViGop/ThuTu cho cac dong DA CO SAN tu truoc (seed cu chi co TenDonVi). */
UPDATE d SET d.LaDonViGop = s.LaDonViGop, d.ThuTu = ISNULL(d.ThuTu, s.ThuTu)
FROM DanhMucDonViTinh d
JOIN (VALUES
    (N'Cái',0,1),(N'Bộ',0,2),(N'Chiếc',0,3),(N'Đôi',0,4),
    (N'Mét',0,10),(N'Yard',0,11),(N'Kg',0,12),
    (N'Ri',1,20),(N'Tá',1,21),(N'Lố',1,22),(N'Cuộn',1,23),(N'Bó',1,24),(N'Túi',1,25),(N'Thùng',1,26),(N'Bao',1,27)
) AS s (TenDonVi, LaDonViGop, ThuTu) ON s.TenDonVi = d.TenDonVi;
PRINT 'Da cap nhat co "don vi gop" + thu tu hien thi.';
GO

/* Don vi nao DANG DUOC DUNG trong du lieu that ma CHUA co trong danh muc -> them vao, khong de mat. */
INSERT INTO DanhMucDonViTinh (TenDonVi, LaDonViGop, ThuTu, GhiChu)
SELECT dv, 0, 90, N'Tự thêm khi nâng cấp v6.31 (đang dùng trong dữ liệu)'
FROM (
    SELECT DISTINCT LTRIM(RTRIM(DonViCoBan)) AS dv FROM TheKhoHangHoa WHERE ISNULL(DonViCoBan,'') <> ''
    UNION SELECT DISTINCT LTRIM(RTRIM(DonViQuyDoi)) FROM TheKhoHangHoa WHERE ISNULL(DonViQuyDoi,'') <> ''
    UNION SELECT DISTINCT LTRIM(RTRIM(DonVi)) FROM DonKhachDatHang WHERE ISNULL(DonVi,'') <> ''
    UNION SELECT DISTINCT LTRIM(RTRIM(DonViCoBan)) FROM DanhMucPhuKien WHERE ISNULL(DonViCoBan,'') <> ''
    UNION SELECT DISTINCT LTRIM(RTRIM(DonViQuyDoi)) FROM DanhMucPhuKien WHERE ISNULL(DonViQuyDoi,'') <> ''
) x
WHERE NOT EXISTS (SELECT 1 FROM DanhMucDonViTinh d WHERE d.TenDonVi = x.dv);
IF @@ROWCOUNT > 0 PRINT 'Da tu them cac don vi dang dung trong du lieu nhung thieu trong danh muc.';
GO

/* ---------------- 4. Noi cot DonKhachDatHang.DonVi: NVARCHAR(10) -> NVARCHAR(30) ----------------
   Ten don vi trong danh muc dai toi 30 ky tu. Giu 10 thi khai "Thùng lớn" van duoc nhung
   "Cuộn 50 mét" (11 ky tu) se LOI TRUNCATE khi luu don. Cac bang khac da la 20-30 san.        */
IF COL_LENGTH('dbo.DonKhachDatHang', 'DonVi') < 60      -- NVARCHAR: 1 ky tu = 2 byte => 10 ky tu = 20
BEGIN
    /* Bo DEFAULT truoc khi doi kieu roi gan lai (SQL Server khong cho ALTER COLUMN khi con rang buoc). */
    DECLARE @df SYSNAME;
    SELECT @df = dc.name FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.DonKhachDatHang') AND c.name = 'DonVi';
    IF @df IS NOT NULL EXEC('ALTER TABLE dbo.DonKhachDatHang DROP CONSTRAINT [' + @df + ']');

    ALTER TABLE dbo.DonKhachDatHang ALTER COLUMN DonVi NVARCHAR(30) NOT NULL;
    ALTER TABLE dbo.DonKhachDatHang ADD CONSTRAINT DF_DKDH_DonVi DEFAULT N'Cái' FOR DonVi;
    PRINT 'Da noi DonKhachDatHang.DonVi len NVARCHAR(30).';
END ELSE PRINT 'DonKhachDatHang.DonVi da du rong, bo qua.';
GO

/* ---------------- 5. Chuc nang cho man hinh danh muc (neu chua seed) ---------------- */
MERGE ChucNang AS t
USING (VALUES
    ('DANHMUC','donvitinh',  N'Đơn vị tính', 22),
    ('DANHMUC','donviquydoi', N'Đơn vị quy đổi', 23)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

/* ---------------- 6. Bao cao doi chieu sau khi chay ---------------- */
PRINT '';
PRINT '--- DANH MUC DON VI TINH SAU KHI CHAY ---';
SELECT TenDonVi, LaDonViGop AS [La don vi gop], ISNULL(ThuTu, 999) AS ThuTu, GhiChu
FROM DanhMucDonViTinh ORDER BY ISNULL(ThuTu, 999), TenDonVi;
GO
PRINT '';
PRINT '--- MA HANG THEO DON VI (de doi chieu) ---';
SELECT DonViCoBan AS [DVT chinh], DonViQuyDoi AS [DVT quy doi], COUNT(*) AS [So ma hang],
       MIN(LoaiRi) AS [Ty le nho nhat], MAX(LoaiRi) AS [Ty le lon nhat]
FROM TheKhoHangHoa GROUP BY DonViCoBan, DonViQuyDoi ORDER BY COUNT(*) DESC;
GO

/* ================================================================================================
   7. CHAN DOAN — DOI CHIEU TRUOC/SAU KHI DOI QUY TAC  (CHI DOC, KHONG SUA GI)
   ------------------------------------------------------------------------------------------------
   Quy tac CU:  don vi co ten = 'Ri'                      -> nhan he so LoaiRi
   Quy tac MOI: don vi = DonViQuyDoi cua CHINH ma hang do  -> nhan he so LoaiRi
   Voi du lieu chuan (DonViQuyDoi = N'Ri') thi HAI QUY TAC CHO KET QUA Y HET NHAU.
   3 truy van duoi liet ke DUNG nhung dong se DIEN GIAI KHAC di. Rong = khong anh huong gi.
   ================================================================================================ */
PRINT '';
PRINT '=== [1/3] MA HANG THIEU "DVT quy doi" (co ty le > 1 nhung khong khai quy doi) ===';
PRINT '     -> Don ghi don vi "Ri" cua nhung ma nay se KHONG con duoc nhan he so. Phai khai bo sung.';
SELECT MaHang, TenHang, DonViCoBan AS [DVT chinh], DonViQuyDoi AS [DVT quy doi], LoaiRi AS [Ty le]
FROM TheKhoHangHoa
WHERE LoaiRi > 1 AND ISNULL(LTRIM(RTRIM(DonViQuyDoi)), N'') = N''
ORDER BY MaHang;
GO

PRINT '';
PRINT '=== [2/3] MA HANG co "DVT quy doi" KHAC N''Ri'' ===';
PRINT '     -> Don cu ghi "Ri" cua nhung ma nay: quy tac CU nhan he so, quy tac MOI thi KHONG.';
SELECT h.MaHang, h.TenHang, h.DonViCoBan AS [DVT chinh], h.DonViQuyDoi AS [DVT quy doi], h.LoaiRi AS [Ty le],
       (SELECT COUNT(*) FROM DonKhachDatHang o
        WHERE o.MaHangID = h.MaHangID AND LTRIM(RTRIM(o.DonVi)) = N'Ri') AS [So don dang ghi "Ri"]
FROM TheKhoHangHoa h
WHERE h.LoaiRi > 1 AND ISNULL(LTRIM(RTRIM(h.DonViQuyDoi)), N'') NOT IN (N'', N'Ri')
ORDER BY h.MaHang;
GO

PRINT '';
PRINT '=== [3/3] DON KHACH DAT co don vi KHONG khop ca DVT chinh lan DVT quy doi cua ma hang ===';
PRINT '     -> Day la cac dong DIEN GIAI SE DOI. Trang thai "Da xuat hang" thi ton da tru xong, khong doi.';
SELECT o.DonID, o.ThoiGian, o.TenKhach, h.MaHang, o.SoLuongDat, o.DonVi AS [Don vi tren don],
       h.DonViCoBan AS [DVT chinh], h.DonViQuyDoi AS [DVT quy doi], h.LoaiRi AS [Ty le], o.TrangThai
FROM DonKhachDatHang o
JOIN TheKhoHangHoa h ON h.MaHangID = o.MaHangID
WHERE LTRIM(RTRIM(o.DonVi)) <> LTRIM(RTRIM(ISNULL(h.DonViCoBan, N'Cái')))
  AND LTRIM(RTRIM(o.DonVi)) <> LTRIM(RTRIM(ISNULL(h.DonViQuyDoi, N'')))
ORDER BY o.TrangThai, o.DonID DESC;
GO

PRINT '';
PRINT '=== MIGRATION v673 HOAN TAT ===';
PRINT '!! MIGRATION NAY KHONG SUA MOT SO LIEU TON KHO NAO (khong dong vao TheKhoChiTietMau).';
PRINT '!! Neu ca 3 truy van chan doan tren deu TRONG => doi quy tac khong lam doi bat ky con so nao.';
PRINT '!! Neu co dong -> khai bo sung "DVT quy doi" cho cac ma do TRUOC khi copy code v6.31.';
GO
SET NOEXEC OFF;
GO
