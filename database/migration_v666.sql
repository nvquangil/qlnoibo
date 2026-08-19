/* ================================================================
   MIGRATION v6.20 — THE KHO HANG HOA: % CHIET KHAU SHOP / NPP
   ----------------------------------------------------------------
   Yeu cau: "The kho hang hoa: them cot gia sau CK shop (nhap %), cot gia sau CK NPP (nhap %)".
   => NGUOI DUNG CHI NHAP % CHIET KHAU, gia sau CK KHONG luu vao CSDL ma TINH LUC DOC:
        Gia sau CK = GiaBan x (1 - PhanTram/100)
      (nguyen tac da dung tu v5.89/v6.06: tinh o duong DOC de du lieu cu khong can migration du lieu;
       sua GiaBan la moi cot gia sau CK tu dung theo, khong bao gio lech)

   !! LUU Y VE DON VI: 2 cot nay luu SO PHAN TRAM (20 = 20%), KHAC voi
      BaoGiaAloha.PhanTramVAT (luu dang PHAN SO: 0.1 = 10%). Dung sao chep cong thuc giua 2 cho.

   DECIMAL(5,2) => toi da 999.99 (du cho 0-100, van cho phep nhap sai > 100 de con thay ma sua,
   khong chan cung o CSDL vi co the co truong hop CK 100% - hang tang).

   Chay 1 lan. IDEMPOTENT (chay lai khong sao). YEU CAU: schema.sql.
   ================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('dbo.TheKhoHangHoa', 'PhanTramCKShop') IS NULL
BEGIN
    ALTER TABLE dbo.TheKhoHangHoa ADD PhanTramCKShop DECIMAL(5,2) NULL;   -- 20 = 20% (KHONG phai 0.2)
    PRINT 'Da them cot TheKhoHangHoa.PhanTramCKShop.';
END ELSE PRINT 'Cot PhanTramCKShop da ton tai, bo qua.';
GO

IF COL_LENGTH('dbo.TheKhoHangHoa', 'PhanTramCKNPP') IS NULL
BEGIN
    ALTER TABLE dbo.TheKhoHangHoa ADD PhanTramCKNPP DECIMAL(5,2) NULL;    -- 20 = 20% (KHONG phai 0.2)
    PRINT 'Da them cot TheKhoHangHoa.PhanTramCKNPP.';
END ELSE PRINT 'Cot PhanTramCKNPP da ton tai, bo qua.';
GO

/* Khong sua vw_TonKhoHangHoa: route /khohang/items da JOIN TheKhoHangHoa (de lay UpdatedAt tu v658)
   nen chi can bo sung 2 cot vao SELECT do -> khong phai ALTER VIEW, khong rui ro voi cac ban DB
   chua chay du migration (backend van do bang COL_LENGTH truoc khi doc). */

PRINT '';
PRINT '=== MIGRATION v666 HOAN TAT ===';
PRINT 'Nho: Ctrl+F5 trinh duyet. Khong can cap quyen moi (dung chuc nang KHOHANG/items san co).';
GO
SET NOEXEC OFF;
GO
