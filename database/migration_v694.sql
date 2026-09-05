/* ================================================================================================
   migration_v694.sql   (v7.62)
   VAI MUA THEO MET — don gia tinh theo Kg hay theo Met, khai o DAU PHIEU nhap kho vai

   VAN DE: ca he thong chi co MOT cong thuc tien vai:  KGNhap * DonGiaNhap.
   Vai mua theo met (khai so met, bo trong KG) vi the ra tien 0 — o CA phieu nhap LAN cong no nha
   cung cap. Nghia la so no NCC dang THIEU dung phan vai mua theo met, khong phai chi sai hien thi.

   CACH LAM: them `PhieuNhapVai.DonViTinhGia`:
        NULL hoac N'Kg'  -> tien = KGNhap * DonGiaNhap   (nhu cu)
        N'Met'           -> tien = SoMet  * DonGiaNhap
   Bieu thuc nam o backend/utils/tienVaiNhap.js va duoc DUNG CHUNG boi congno.js (4 cho) va
   khovai.js (2 cho), nen sua mot noi la phieu va cong no cung doi — khong the lech nhau.

   ⚠️ CO Y KHONG BACKFILL. Nguoi dung da chot: "de nguyen, chi ap dung tu nay".
   Cot de NULL cho toan bo phieu cu => moi con so cong no cu GIU NGUYEN TUYET DOI. Neu sau nay muon
   tinh lai vai mua theo met da nhap tu truoc thi phai:
     1. Soi truoc de biet so tien se phat sinh them va thuoc nha cung cap nao;
     2. Doi cot cua dung nhung phieu do sang N'Met';
   => cong no NCC se TANG. Do la thay doi SO SACH, phai co nguoi doi chieu, khong duoc lam am tham
   trong mot cau UPDATE o day.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('PhieuNhapVai', 'DonViTinhGia') IS NULL
BEGIN
  ALTER TABLE PhieuNhapVai ADD DonViTinhGia NVARCHAR(10) NULL;
  PRINT '  + PhieuNhapVai.DonViTinhGia (NULL/N''Kg'' = tinh tien theo KG; N''Met'' = theo so met)';
END
ELSE PRINT '  = PhieuNhapVai.DonViTinhGia da co';
GO

/* Chan gia tri la: chi nhan dung 2 gia tri (hoac de trong). Rang buoc kiem tra nay re va bit han
   duong "go tay vao SSMS mot chuoi khac roi ca he thong tinh sai am tham". */
IF COL_LENGTH('PhieuNhapVai', 'DonViTinhGia') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_PhieuNhapVai_DonViTinhGia')
BEGIN
  ALTER TABLE PhieuNhapVai WITH NOCHECK
    ADD CONSTRAINT CK_PhieuNhapVai_DonViTinhGia
    CHECK (DonViTinhGia IS NULL OR DonViTinhGia IN (N'Kg', N'Met'));
  PRINT '  + Rang buoc CK_PhieuNhapVai_DonViTinhGia (chi nhan Kg / Met / de trong)';
END
ELSE PRINT '  = Rang buoc CK_PhieuNhapVai_DonViTinhGia da co';
GO

PRINT '';
PRINT '=== migration_v694 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua routes/khovai.js + congno.js + utils/tienVaiNhap.js) + Ctrl+F5.';
PRINT '';
PRINT 'Tu day:';
PRINT '  · Form Tao/Sua phieu nhap kho vai co o "Don gia tinh theo": Kg (mac dinh) hoac Met.';
PRINT '  · Chon Met -> tong tien phieu = SUM(So met x Don gia), va cong no NCC ghi DUNG so do.';
PRINT '  · Phieu CU (cot de trong) van tinh theo KG y nhu truoc — khong mot con so nao doi.';
PRINT '  · Soi cac cay dang ra tien 0 mot cach dang ngo:  node utils/soi_tien_vai_theo_met.js';
GO
