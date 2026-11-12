/* ================================================================================================
   migration_v891.sql — v9.46: PHIEU BAN HANG ghi NGUOI SUA + THOI DIEM SUA CUOI (Nguyen 11/11/2026)

   Yeu cau: "phiếu bán hàng thêm giờ, ngày tháng lập đầu tiên để dưới người làm phiếu, tên người làm
   phiếu theo tên user đăng nhập. Nếu sửa ghi rõ, ngày sửa cuối cùng".

   Bang PhieuBanHang DA CO NguoiTaoID + CreatedAt (migration_v668) — nguoi lap va luc lap khong can
   them cot. Them HAI cot cho lan SUA cuoi:
     NguoiSuaID  INT NULL       — Users.UserID cua nguoi SUA / HUY lan cuoi (NULL = chua tung sua)
     UpdatedAt   DATETIME2 NULL — luc sua / huy lan cuoi (NULL = chua tung sua)
   Khong dat FK toi Users: user bi xoa thi phieu van phai giu duoc dau vet (ten in ra se trong).

   Chay lai duoc nhieu lan. Chay TRUOC `pm2 restart`. Cot duoc do moi lan (khong cache) nen chay sau
   cung khong lech so — chi la chua ghi duoc nguoi sua cho den khi co cot.
   ================================================================================================ */
SET NOCOUNT ON;
PRINT '>>> migration_v891.sql — PhieuBanHang.NguoiSuaID / UpdatedAt';
GO

IF COL_LENGTH('PhieuBanHang', 'NguoiSuaID') IS NULL
BEGIN
    ALTER TABLE PhieuBanHang ADD NguoiSuaID INT NULL;
    PRINT '  + PhieuBanHang.NguoiSuaID';
END
ELSE PRINT '  = PhieuBanHang.NguoiSuaID da co';
GO

IF COL_LENGTH('PhieuBanHang', 'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE PhieuBanHang ADD UpdatedAt DATETIME2 NULL;
    PRINT '  + PhieuBanHang.UpdatedAt';
END
ELSE PRINT '  = PhieuBanHang.UpdatedAt da co';
GO

PRINT '<<< migration_v891.sql xong.';
GO
