/* ================================================================================================
   migration_v677.sql   (v6.67)
   DASHBOARD KINH DOANH - trang hien NGAY khi dang nhap cho nguoi duoc phan quyen.
   Noi dung: doanh thu + tinh hinh cong no cua NHUNG KHACH HANG DUOC CHON de theo doi.

   KHONG co bang du lieu moi: dashboard chi DOC lai PhieuBanHang / PhieuThu / PhieuNhapLai /
   CongNoDieuChinh - dung y het nguon ma man "Cong no khach hang" dang dung, nen hai man khong
   the ra hai con so khac nhau.
   Danh sach "khach theo doi" luu tren MAY NGUOI DUNG (localStorage), moi nguoi mot danh sach,
   nen cung khong can bang.

   Chi can THEM MODULE de co cho cap quyen.
   ================================================================================================ */

IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'DASHBOARD')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'DASHBOARD', N'Dashboard kinh doanh', 0);
GO

/* Seed DONG quyen (mac dinh TAT ca 0) cho moi nhom chua co - Admin bypass.
   => Sau khi chay migration, KHONG AI thay dashboard cho toi khi vao
      "Quan ly User -> Ma tran phan quyen" bat quyen Xem cho nhom can dung. */
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'DASHBOARD'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO

PRINT '';
PRINT '=== migration_v677 XONG ===';
PRINT 'NHO: Quan ly User -> Ma tran phan quyen -> bat CanView cho module DASHBOARD,';
PRINT '     khong thi dang nhap van vao trang chu cu (dung nhu thiet ke: khong co quyen thi khong doi gi).';
GO
