/* ================================================================
   MIGRATION v5.33 — Cờ "Có in thêu" cho đơn hàng (bỏ qua công đoạn GIT/NIT nếu không in thêu)
   ----------------------------------------------------------------
   Theo yeu cau: don KHONG in theu thi bo qua 2 cong doan Giao/Nhan in theu (GIT/NIT), chuyen thang tu
   Cat sang Giao gia cong. Them cot bit CoInTheu tren DonHangSanXuat (mac dinh 0 = khong in theu).
   tinhNextStage() (qlsx.js) se bo qua GIT/NIT khi CoInTheu = 0; dropdown Ghi nhan tien do cung an GIT/NIT
   khi don khong in theu. Khai bao CoInTheu o "Ra lenh san xuat" (tao/sua don).

   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF COL_LENGTH('dbo.DonHangSanXuat', 'CoInTheu') IS NULL
    ALTER TABLE DonHangSanXuat ADD CoInTheu BIT NOT NULL DEFAULT 0;
GO

PRINT '=== migration_v533.sql hoan tat (them DonHangSanXuat.CoInTheu) ===';
GO
