/* ==================================================================================================
   migration_v897.sql — v9.71: Users.PhaiDoiMatKhau — tao user khong mat khau => mat khau tam = ten dang nhap,
   dang nhap lan dau BAT doi (Nguyen 16/11/2026: "Khi tao user moi neu khong co mat khau thi dang nhap lan dau yeu cau
   doi mat khau").
   Co = 1: app.js chan toan man hinh bang form doi mat khau (khong Huy), doi xong PUT /auth/change-password ha co.
   🔴 Gac IF — chay lai an toan. Sau khi chay: pm2 restart qlnoibo.
   ================================================================================================== */
PRINT '=== migration_v897: Users.PhaiDoiMatKhau (v9.71) ===';
GO
IF COL_LENGTH('Users', 'PhaiDoiMatKhau') IS NULL
BEGIN
    ALTER TABLE Users ADD PhaiDoiMatKhau BIT NOT NULL CONSTRAINT DF_Users_PhaiDoiMatKhau DEFAULT 0;
    PRINT '  + Users.PhaiDoiMatKhau';
END ELSE PRINT '  = Users.PhaiDoiMatKhau da co';
GO
PRINT '=== migration_v897 xong. pm2 restart qlnoibo ===';
GO
