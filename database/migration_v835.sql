/* ================================================================
   MIGRATION v8.35 — Chi dinh san xuat: them truong "Ten san pham tren tem"

   Yeu cau Nguyen (2026-09-23): "Chỉ định sản xuất thêm trường nhập tự do:
   tên sản phẩm trên tem thể hiện cả ở bản in".

   Day la o GHI CHEP TU DO (khong lay tu danh muc, khong rang buoc) — ten ma
   xuong se in len NHAN/TEM cua san pham, co the khac "Tên sản phẩm" dung noi
   bo. KHONG lien quan toi chuc nang in tem CAY VAI (printTemHangLoat/
   printTemMang trong module.khovai.js) — he thong hien KHONG co module in tem
   san pham nao, nen cot nay chi de ghi nhan + hien tren ban in "Chi dinh san
   xuat".

   An toan: cot NULL, khong DEFAULT, khong rang buoc — don CU khong bi anh
   huong; moi noi doc don hang dung "SELECT d.*" nen tu co cot nay.

   CHAY 1 LAN. Neu pm2 dang chay thi PHAI restart lai sau khi chay migration.
   ================================================================ */

IF COL_LENGTH('DonHangSanXuat', 'TenSanPhamTem') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD TenSanPhamTem NVARCHAR(255) NULL;
    PRINT N'Da them cot DonHangSanXuat.TenSanPhamTem.';
END ELSE PRINT N'Cot DonHangSanXuat.TenSanPhamTem da ton tai, bo qua.';
GO
