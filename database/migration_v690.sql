/* ================================================================================================
   migration_v690.sql   (v7.46)
   TEN VIET HOA DON cua MA HANG  ->  hoa don GTGT ghi ten theo giay to, khong ghi ten noi bo

   VAN DE: `TheKhoHangHoa.TenHang` la ten NOI BO ("Bộ dài tay bé gái BD26C0501") — go de nhan hang,
   co ca ma hang trong ten, co khi kem chu viet tat. Ten tren hoa don GTGT thi phai la ten thuong mai
   sach se ("Bộ quần áo trẻ em"). Truoc day hoa don do nguyen TenHang sang cot S.
   Doi TenHang cho dep hon la khong duoc: no hien khap the kho, phieu nhap, phieu ban, catalogue,
   bao gia — va nguoi trong xuong tim hang theo dung cai ten do.

   => Them cot RIENG. De trong thi hoa don TU LUI VE TenHang (khong bat khai lai hang nghin ma hang).
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('TheKhoHangHoa', 'TenHoaDon') IS NULL
BEGIN
  ALTER TABLE TheKhoHangHoa ADD TenHoaDon NVARCHAR(255) NULL;
  PRINT '  + TheKhoHangHoa.TenHoaDon (ten hang ghi tren hoa don GTGT)';
END
ELSE PRINT '  = TheKhoHangHoa.TenHoaDon da co';
GO

PRINT '';
PRINT '=== migration_v690 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua khohang.js / danhmuc.js / banhang.js / maHangCapNhat.js).';
PRINT 'Khai o "Ten viet hoa don" khi tao ma hang, hoac sua sau o Danh muc -> Hang hoa (ma hang).';
PRINT 'De trong = hoa don lay TenHang nhu cu.';
GO
