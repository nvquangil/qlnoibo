/* ================================================================================================
   migration_v874.sql   (v8.74)
   QC + DONG GOI: GHI NHIEU DOT, CONG DON  —  chi ap dung cho cac lan ghi TU BAN NAY TRO DI

   Nguyen yeu cau 2026-10-08: "Cong doan QC, dong goi sua nhap nhieu lan nhu cong doan kho nhap,
   khi ghi nhan chua du so luong thi van hien o cong doan".

   VAN DE: `effectiveTienDoIds()` co 3 nhanh — CAT (cong don theo tung SoDoID), KN (cong don theo
   co `CongDonKN`, v7.56), va NHANH MAC DINH cho moi cong doan con lai. QC/DG dang o nhanh mac dinh
   nen ghi lan 2 la THAY THE lan 1. Them nua, gate "chua du thi giu lai o cong doan" (v7.57) chi co
   cho KN, nen dong goi 300/600 cai la lenh nhay sang Kho nhap va BIEN MAT khoi danh sach Dong goi.

   ⚠️ VI SAO KHONG DOI THANG SANG CONG DON CHO CA DU LIEU CU — y het ly do cua v7.56:
   Truoc ban nay, ghi lai lan 2 duoc HIEU la "ghi lai de SUA" (vi he thong chi tinh lan cuoi). Doi
   thang sang cong don thi moi lenh cu tung ghi lai se BI CONG GAP LEN, ma khong ai biet.
   => Them CO `CongDonQCDG`. Cac lan ghi TU BAN NAY duoc danh dau = 1 va CONG DON voi nhau; cac lan
      ghi CU (co = NULL) van chi tinh LAN GAN NHAT nhu truoc.

   MOT cot dung chung cho CA QC LAN DONG GOI — khong can hai cot, vi `StageID` da phan biet roi.

   QUY TAC DOC (xem effectiveTienDoIds trong routes/qlsx.js):
       ids = [lan ghi CU gan nhat cua cong doan do, neu co] + [TAT CA cac lan ghi co CongDonQCDG = 1]

   ------------------------------------------------------------------------------------------------
   🔴 LUU Y QUAN TRONG VE TIEN LUONG — doc truoc khi dung tay vao du lieu bang nay:

   Luong KHONG doc so luong QC. No chi lay MIN(NgayGhiNhan) cua cong doan QC lam MOC KY:
       payroll.js:1279-1286   (luong khoan may)
       utils/luongGiaCongInThe.js:46-52  (luong gia cong / in theu, va CA CONG NO NHA GIA CONG)

   MIN la CO Y, khong phai MAX (xem ghi chu payroll.js:1271-1273): lay MAX thi moi lan ghi bo sung
   QC la ca cuc tien nhay sang thang khac, ke ca thang DA CHOT va DA TRA.

   => GHI THEM dot QC  : MIN khong doi  -> ky luong dung yen. AN TOAN.
   => XOA dot QC DAU   : MIN dich sang dot sau -> tien nhay thang. Vi vay ung dung CHAN xoa dot QC
                         dau tien (chan o BACKEND, xem routes/qlsx.js).
   Dung UPDATE/DELETE tay tren TienDoSanXuat cua cong doan QC neu chua doi chieu lai bang luong.
   ------------------------------------------------------------------------------------------------

   CHAY 1 LAN. Chay xong PHAI pm2 restart qlnoibo.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('TienDoSanXuat', 'CongDonQCDG') IS NULL
BEGIN
  ALTER TABLE TienDoSanXuat ADD CongDonQCDG BIT NULL;
  PRINT '  + TienDoSanXuat.CongDonQCDG (danh dau lan ghi QC / Dong goi thuoc che do CONG DON)';
END
ELSE PRINT '  = TienDoSanXuat.CongDonQCDG da co';
GO

/* CO TINH KHONG backfill cho du lieu cu: dat = 1 cho cac dong cu chinh la doi so cua nhung lenh da
   tung ghi lai de sua — dung cai ma nguoi dung yeu cau TRANH. De NULL = giu nguyen cach tinh cu. */

PRINT '';
PRINT '=== migration_v874 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua routes/qlsx.js) + Ctrl+F5 (sua module.qlsx.js).';
PRINT 'Tu day: cong doan QC va Dong goi ghi duoc NHIEU DOT, cac dot CONG DON;';
PRINT 'ghi chua du tong so cat thi lenh GIU NGUYEN o cong doan do (tich "Da hoan thanh" de dong som).';
PRINT '';
PRINT 'LENH DANG DO o QC/DG truoc ban nay VAN NAM SAI CHO (da bi day sang cong doan sau).';
PRINT 'Nguyen da chot: KHONG keo ve. Muon nhap tiep thi dung duong ep cong doan thu cong (admin)';
PRINT 'de keo con tro ve QC/DG, tu do co che cong don moi co hieu luc cho lenh do.';
GO
