/* ==================================================================================================
   migration_v899.sql — v9.73:
     1. HopDongLaoDong.KieuThuong NVARCHAR(10) -> NVARCHAR(50), BO CHECK "mot gia tri"
        (Nguyen 17/11/2026: "kieu thuong ... co the chon 2 hoac 3 kieu thuong, ap dung ca cac kieu da chon trong tinh luong").
        Luu chuoi tap hop theo thu tu co dinh: 'KPI' | 'SanPham' | 'ChuyenCan' | 'KPI,SanPham' | 'KPI,SanPham,ChuyenCan' ...
        Gia tri cu mot kieu GIU NGUYEN — khong doi du lieu. Luat tach/ghep o backend/utils/kieuThuong.js.
        KHONG dat CHECK moi: to hop hop le do ma kiem; bo CHECK de khoi phai sua migration moi lan them kieu.
     2. BangLuongChiTiet.KieuThuong NVARCHAR(10) -> NVARCHAR(50) (anh chup kieu thuong luc tinh bang).
     3. PhieuNghi.NuaNgay BIT NOT NULL DEFAULT 0 — giay nghi phep NUA NGAY (Tu = Den, tinh 0,5 cong nghi).
   🔴 Gac IF — chay lai an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v899: KieuThuong nhieu kieu + PhieuNghi.NuaNgay (v9.73) ===';
GO

/* ---------- 1. HopDongLaoDong.KieuThuong rong ra 50, bo CHECK ---------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_HopDongLaoDong_KieuThuong')
BEGIN
    ALTER TABLE HopDongLaoDong DROP CONSTRAINT CK_HopDongLaoDong_KieuThuong;
    PRINT '  - CK_HopDongLaoDong_KieuThuong (cu: mot kieu KPI/SanPham/ChuyenCan)';
END ELSE PRINT '  = CK_HopDongLaoDong_KieuThuong khong co (da bo)';
GO
IF COL_LENGTH('HopDongLaoDong', 'KieuThuong') IS NOT NULL AND COL_LENGTH('HopDongLaoDong', 'KieuThuong') < 100
BEGIN
    ALTER TABLE HopDongLaoDong ALTER COLUMN KieuThuong NVARCHAR(50) NULL;
    PRINT '  ~ HopDongLaoDong.KieuThuong -> NVARCHAR(50)';
END ELSE PRINT '  = HopDongLaoDong.KieuThuong da du rong (hoac chua co cot — chay migration_v890 truoc)';
GO

/* ---------- 2. BangLuongChiTiet.KieuThuong rong ra 50 ---------- */
IF COL_LENGTH('BangLuongChiTiet', 'KieuThuong') IS NOT NULL AND COL_LENGTH('BangLuongChiTiet', 'KieuThuong') < 100
BEGIN
    ALTER TABLE BangLuongChiTiet ALTER COLUMN KieuThuong NVARCHAR(50) NULL;
    PRINT '  ~ BangLuongChiTiet.KieuThuong -> NVARCHAR(50)';
END ELSE PRINT '  = BangLuongChiTiet.KieuThuong da du rong (hoac chua co cot)';
GO

/* ---------- 2b. BangLuongChiTiet.ThuongKPI / ThuongSP / ThuongCC — tung phan cua Thuong (phieu luong tach dong) ----------
   Thuong van la TONG (cot cu khong doi nghia). Dong tinh truoc v9.73: 3 cot NULL -> phieu luong in mot dong gop nhu cu. */
IF COL_LENGTH('BangLuongChiTiet', 'ThuongKPI') IS NULL
BEGIN
    ALTER TABLE BangLuongChiTiet ADD ThuongKPI DECIMAL(14,2) NULL, ThuongSP DECIMAL(14,2) NULL, ThuongCC DECIMAL(14,2) NULL;
    PRINT '  + BangLuongChiTiet.ThuongKPI / ThuongSP / ThuongCC';
END ELSE PRINT '  = BangLuongChiTiet.ThuongKPI da co';
GO

/* ---------- 3. PhieuNghi.NuaNgay ---------- */
IF OBJECT_ID('PhieuNghi') IS NOT NULL AND COL_LENGTH('PhieuNghi', 'NuaNgay') IS NULL
BEGIN
    ALTER TABLE PhieuNghi ADD NuaNgay BIT NOT NULL CONSTRAINT DF_PhieuNghi_NuaNgay DEFAULT 0;
    PRINT '  + PhieuNghi.NuaNgay';
END ELSE PRINT '  = PhieuNghi.NuaNgay da co (hoac chua co bang PhieuNghi)';
GO

PRINT '=== migration_v899 xong. pm2 restart qlnoibo ===';
GO
