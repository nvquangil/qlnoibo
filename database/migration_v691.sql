/* ================================================================================================
   migration_v691.sql   (v7.53)
   CONG NO NHA GIA CONG / IN THEU

   Phan he Cong no truoc day chi co KHACH HANG va NHA CUNG CAP. Nha gia cong / in theu thi da co
   PHIEU CHI (PhieuChi.LoaiDoiTuong = N'NhaGiaCong' + NhaGiaCongID, co tu dau) — tuc TIEN CHI da ghi
   duoc, nhung khong co man nao doi chieu "phai tra bao nhieu, da tra bao nhieu, con no bao nhieu".

   Ben "PHAI TRA" KHONG can bang moi: lay tu chinh so lieu Bang luong gia cong/in theu
   (SoLuongNhan x don gia hang muc — xem utils/luongGiaCongInThe.js). Migration nay chi mo them:

   1) CongNoDieuChinh.NhaGiaCongID — dieu chinh cong no cho nha gia cong (bang nay von chi co
      KhachHangID/NCC_ID). Khong co cot nay thi khong ghi duoc dong dieu chinh nao cho nha gia cong.
   2) Chuc nang 'congnogiacong' cua module CONGNO — de phan quyen theo tab nhu cac tab khac.
      KHONG cap quyen tu dong cho ai: admin vao Phan quyen tich cho nguoi can dung.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('CongNoDieuChinh', 'NhaGiaCongID') IS NULL
BEGIN
  ALTER TABLE CongNoDieuChinh ADD NhaGiaCongID INT NULL;
  PRINT '  + CongNoDieuChinh.NhaGiaCongID';
END
ELSE PRINT '  = CongNoDieuChinh.NhaGiaCongID da co';
GO

/* Khoa ngoai tach rieng: cot vua them o batch tren, cung batch se bao "invalid column". */
IF COL_LENGTH('CongNoDieuChinh', 'NhaGiaCongID') IS NOT NULL
   AND OBJECT_ID('NhaGiaCong', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CongNoDieuChinh_NhaGiaCong')
BEGIN
  ALTER TABLE CongNoDieuChinh
    ADD CONSTRAINT FK_CongNoDieuChinh_NhaGiaCong FOREIGN KEY (NhaGiaCongID)
        REFERENCES NhaGiaCong(NhaGiaCongID);
  PRINT '  + FK_CongNoDieuChinh_NhaGiaCong';
END
ELSE PRINT '  = FK_CongNoDieuChinh_NhaGiaCong da co / bo qua';
GO

/* Chuc nang cho tab moi. Bang ChucNang co the chua ton tai o ban rat cu -> bo qua an toan. */
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode = N'CONGNO' AND MaChucNang = N'congnogiacong')
  BEGIN
    /* ThuTu: dat sau congnoncc. Lay MAX + 1 de khong dung so cung (danh sach tab co the da doi). */
    DECLARE @tt INT = (SELECT ISNULL(MAX(ThuTu), 0) + 1 FROM ChucNang WHERE ModuleCode = N'CONGNO');
    INSERT INTO ChucNang (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    VALUES (N'CONGNO', N'congnogiacong', N'Công nợ nhà gia công / in thêu', @tt);
    PRINT '  + ChucNang CONGNO/congnogiacong';
  END
  ELSE PRINT '  = ChucNang CONGNO/congnogiacong da co';
END
ELSE PRINT '  = Chua co bang ChucNang, bo qua phan quyen theo chuc nang';
GO

PRINT '';
PRINT '=== migration_v691 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua routes/congno.js + routes/payroll.js + utils moi).';
PRINT 'Vao Phan quyen -> CONGNO -> tich "Cong no nha gia cong / in theu" cho nguoi can dung,';
PRINT 'roi Ctrl+F5. Tien PHAI TRA lay tu Bang luong gia cong/in theu (SL NHAN x don gia hang muc),';
PRINT 'tien DA TRA lay tu Phieu chi co Loai doi tuong = Nha gia cong.';
GO
