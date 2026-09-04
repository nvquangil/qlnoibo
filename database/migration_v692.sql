/* ================================================================================================
   migration_v692.sql   (v7.56)
   KHO NHAP: GHI NHIEU DOT, CONG DON  —  chi ap dung cho cac lan ghi TU BAN NAY TRO DI

   VAN DE: `effectiveTienDoIds()` voi cong doan KHAC 'CAT' chi lay LAN GHI GAN NHAT (+ nhom cua no).
   Nen o cong doan Kho nhap, ghi lan 2 la THAY THE lan 1 — khong cong don duoc. Thuc te hang khong
   hoan thien mot luc: nhap 100 hom nay, mai nhap tiep 50 thi tong phai la 150, nay ra 50.

   ⚠️ VI SAO KHONG DOI THANG SANG CONG DON CHO CA DU LIEU CU (nguoi dung da chon):
   Truoc ban nay, ghi lai lan 2 duoc HIEU la "ghi lai de SUA" (vi he thong chi tinh lan cuoi). Neu
   doi thang sang cong don thi moi lenh cu tung ghi lai se BI CONG GAP LEN — "SL hoan thanh", gia
   thanh, bao cao nang suat cua lenh do doi so ma khong ai biet.
   => Them CO `CongDonKN`. Cac lan ghi TU BAN NAY duoc danh dau = 1 va CONG DON voi nhau; cac lan
      ghi CU (co = NULL) van chi tinh LAN GAN NHAT nhu truoc.

   QUY TAC DOC (xem effectiveTienDoIds trong routes/qlsx.js):
       ids = [lan ghi CU gan nhat, neu co]  +  [TAT CA cac lan ghi co CongDonKN = 1]
   Nho vay:
     · Lenh cu co 2 lan ghi cu (tung ghi lai de sua) -> van chi tinh lan cuoi -> SO KHONG DOI.
     · Lenh dang nhap do: 1 lan cu + 2 dot moi -> cong ca 3 (so cu duoc giu lam diem bat dau).
     · Lenh moi hoan toan -> cong tat ca cac dot.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('TienDoSanXuat', 'CongDonKN') IS NULL
BEGIN
  ALTER TABLE TienDoSanXuat ADD CongDonKN BIT NULL;
  PRINT '  + TienDoSanXuat.CongDonKN (danh dau lan ghi Kho nhap thuoc che do CONG DON)';
END
ELSE PRINT '  = TienDoSanXuat.CongDonKN da co';
GO

/* CO TINH KHONG backfill cho du lieu cu: dat = 1 cho cac dong cu chinh la doi so cua nhung lenh da
   tung ghi lai de sua — dung cai ma nguoi dung yeu cau TRANH. De NULL = giu nguyen cach tinh cu. */

PRINT '';
PRINT '=== migration_v692 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua routes/qlsx.js) + Ctrl+F5.';
PRINT 'Tu day: cong doan Kho nhap ghi duoc NHIEU DOT, cac dot CONG DON.';
PRINT 'Form Kho nhap hien: SL tu Cat / da nhap luy ke / con lai, va khoi "Kho nhap da ghi" sua-xoa tung dot.';
PRINT 'Muon soi cac lenh cu co tu 2 lan ghi Kho nhap: node utils/soi_kho_nhap_nhieu_dot.js';
GO
