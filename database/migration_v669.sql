/* ================================================================
   MIGRATION v6.24 — TAI KHOAN NGAN HANG + SO QUY (tien mat / ngan hang)
   ----------------------------------------------------------------
   1. DanhMucTaiKhoanNganHang: danh muc SO TAI KHOAN cua cong ty. Phieu thu / phieu chi chon
      hinh thuc "Chuyển khoản" thi chon them TK ngan hang nao -> biet tien vao/ra tai khoan nao.
   2. PhieuThu.TaiKhoanNHID / PhieuChi.TaiKhoanNHID: gan phieu vao 1 tai khoan ngan hang.
   3. SO QUY = so du dau ky + tong THU - tong CHI, tach rieng:
        - Quy TIEN MAT   : cac phieu HinhThuc = N'Tiền mặt'      (dau ky: CauHinhHeThong.QUY_TIEN_MAT_DAU_KY)
        - Quy NGAN HANG  : cac phieu HinhThuc = N'Chuyển khoản'  (dau ky: tung dong DanhMucTaiKhoanNganHang.SoDuDauKy)
      => KHONG tao bang so quy rieng: so quy luon TINH LAI tu chung tu, khong bao gio lech voi phieu.

   Chay 1 lan. IDEMPOTENT. YEU CAU: migration_v668.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Danh muc tai khoan ngan hang ---------------- */
IF OBJECT_ID('dbo.DanhMucTaiKhoanNganHang', 'U') IS NULL
BEGIN
    CREATE TABLE DanhMucTaiKhoanNganHang (
        TaiKhoanNHID  INT IDENTITY(1,1) PRIMARY KEY,
        TenNganHang   NVARCHAR(150) NOT NULL,          -- vd: BIDV - CN Ha Dong
        SoTaiKhoan    NVARCHAR(50) NOT NULL,
        ChuTaiKhoan   NVARCHAR(150) NULL,
        ChiNhanh      NVARCHAR(150) NULL,
        SoDuDauKy     DECIMAL(18,2) NOT NULL DEFAULT 0,
        MacDinh       BIT NOT NULL DEFAULT 0,          -- 1 = tai khoan chon san khi lap phieu
        GhiChu        NVARCHAR(255) NULL,
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE UNIQUE INDEX UX_TKNH_SoTaiKhoan ON DanhMucTaiKhoanNganHang(SoTaiKhoan);
    PRINT 'Da tao bang DanhMucTaiKhoanNganHang.';
END ELSE PRINT 'Bang DanhMucTaiKhoanNganHang da ton tai, bo qua.';
GO

/* ---------------- 2. Gan tai khoan ngan hang vao phieu thu / chi ---------------- */
IF COL_LENGTH('dbo.PhieuThu', 'TaiKhoanNHID') IS NULL
BEGIN
    ALTER TABLE dbo.PhieuThu ADD TaiKhoanNHID INT NULL
        FOREIGN KEY REFERENCES DanhMucTaiKhoanNganHang(TaiKhoanNHID);
    PRINT 'Da them cot PhieuThu.TaiKhoanNHID.';
END ELSE PRINT 'Cot PhieuThu.TaiKhoanNHID da ton tai, bo qua.';
GO
IF COL_LENGTH('dbo.PhieuChi', 'TaiKhoanNHID') IS NULL
BEGIN
    ALTER TABLE dbo.PhieuChi ADD TaiKhoanNHID INT NULL
        FOREIGN KEY REFERENCES DanhMucTaiKhoanNganHang(TaiKhoanNHID);
    PRINT 'Da them cot PhieuChi.TaiKhoanNHID.';
END ELSE PRINT 'Cot PhieuChi.TaiKhoanNHID da ton tai, bo qua.';
GO

/* ---------------- 3. Cau hinh so du dau ky quy tien mat ---------------- */
MERGE CauHinhHeThong AS t
USING (VALUES ('QUY_TIEN_MAT_DAU_KY', N'0')) AS s (ConfigKey, ConfigValue)
  ON t.ConfigKey = s.ConfigKey
WHEN NOT MATCHED THEN INSERT (ConfigKey, ConfigValue) VALUES (s.ConfigKey, s.ConfigValue);
GO

/* ---------------- 4. Chuc nang moi ---------------- */
MERGE ChucNang AS t
USING (VALUES
    ('CONGNO','soquy', N'Sổ quỹ tiền mặt / ngân hàng', 6),
    ('DANHMUC','taikhoannganhang', N'Tài khoản ngân hàng', 22)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== MIGRATION v669 HOAN TAT ===';
PRINT 'Nho: Danh muc -> Tai khoan ngan hang: khai cac STK + SO DU DAU KY.';
PRINT '     Quy tien mat dau ky: Danh muc -> Cau hinh he thong -> QUY_TIEN_MAT_DAU_KY.';
PRINT '     Cap quyen chuc nang "Sổ quỹ" cua phan he Quan ly cong no.';
GO
SET NOEXEC OFF;
GO
