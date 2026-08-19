/* ================================================================
   MIGRATION v5.6 — QLSX: mau khong con bat buoc o Giao viec may (PhanCongMay.
   MauSacID -> NULL-able), tach chuc nang "Ghi nhan tien do" rieng khoi "Xem/
   Sua lenh san xuat" (yeu cau v5.6 phan phan quyen); Kho vai: Ton kho tong hop
   bo sung dem cay theo trang thai (view vw_TonKhoVai). Additive - KHONG xoa
   bang/cot cu. Idempotent - chay lai an toan, khong mat du lieu.
   ================================================================ */

USE QLNoiBo;
GO

/* ---- 1. PhanCongMay.MauSacID -> cho phep NULL (yeu cau v5.6 "không cần chọn mầu" o cong doan May) -
   SL cat theo mau da hien san (mauQtyRowsHtml, tu du lieu TienDoChiTietMau) de doi chieu, khong can bat
   nguoi dung chon lai mau moi lan giao viec. FK toi MauSac van giu nguyen (NULL van hop le voi FK). ---- */
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'PhanCongMay' AND COLUMN_NAME = 'MauSacID' AND IS_NULLABLE = 'NO'
)
BEGIN
    ALTER TABLE PhanCongMay ALTER COLUMN MauSacID INT NULL;
    PRINT 'Da doi PhanCongMay.MauSacID sang cho phep NULL.';
END ELSE PRINT 'PhanCongMay.MauSacID da cho phep NULL (hoac khong ton tai), bo qua.';
GO

/* ---- 2. Cap nhat view vw_TonKhoVai: them 3 cot dem cay theo TUNG trang thai (Nguyen cay/Cay le/Het) -
   dung cho drilldown "kích vào trạng thái" o tab Ton kho TONG HOP (yeu cau v5.6 - truoc day drilldown
   nay CHI co o tab "Tồn theo cây", vi tab tong hop gop nhieu cay/nhieu trang thai chung 1 dong theo Ma
   vai, khong co san 1 cot Trang thai don le de bam vao). CREATE OR ALTER de idempotent - view khong
   luu du lieu nen chay lai an toan. */
CREATE OR ALTER VIEW vw_TonKhoVai AS
SELECT
    v.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau,
    v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG,
    ISNULL(SUM(c.KGNhap), 0) AS TongKGNhap,
    ISNULL(SUM(x.KGXuatTong), 0) AS TongKGXuat,
    ISNULL(SUM(c.KGNhap), 0) - ISNULL(SUM(x.KGXuatTong), 0) AS TonKG,
    COUNT(DISTINCT c.CayID) AS TongCayNhap,
    SUM(CASE WHEN c.TrangThai <> N'Hết' THEN 1 ELSE 0 END) AS CayConTon,
    SUM(CASE WHEN c.TrangThai = N'Nguyên cây' THEN 1 ELSE 0 END) AS SoCayNguyenCay,
    SUM(CASE WHEN c.TrangThai = N'Cây lẻ' THEN 1 ELSE 0 END) AS SoCayLe,
    SUM(CASE WHEN c.TrangThai = N'Hết' THEN 1 ELSE 0 END) AS SoCayHet
FROM DanhMucVai v
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = v.LoaiVaiID
LEFT JOIN MauSac ms ON ms.MauSacID = v.MauSacID
LEFT JOIN VaiCay c ON c.VaiID = v.VaiID
LEFT JOIN (
    SELECT CayID, SUM(KGXuat) AS KGXuatTong FROM PhieuXuatVaiChiTiet GROUP BY CayID
) x ON x.CayID = c.CayID
GROUP BY v.VaiID, v.MaVai, v.MaPM, lv.TenLoaiVai, lv.MaLoai, ms.TenMau, v.KhoVai, v.GSM, v.ViTriKho, v.TonToiThieuKG;
GO
PRINT 'Da cap nhat view vw_TonKhoVai (them SoCayNguyenCay/SoCayLe/SoCayHet).';
GO

/* ---- 3. Chuc nang moi QLSX.'tiendo' ("Ghi nhận tiến độ") - tach rieng khoi QLSX.'orders' ("Xem/Sửa
   lệnh sản xuất") - yeu cau v5.6 "nếu cho user sửa thì sửa được cả lệnh sản xuất... thêm chi tiết là
   được ghi nhận tiến độ, xem sửa lệnh sản xuất". Truoc day 1 chuc nang 'orders' duy nhat gate CA hai
   viec (sua thong tin lenh VA ghi nhan tien do/giao vai/phu kien/giao viec may/vendor/forcestage), nen
   khong the giao rieng "chi ghi tien do, khong sua duoc lenh" cho 1 nhom/user. Xem backend qlsx.js:
   cac route lien quan da doi sang requireChucNang('QLSX','tiendo'), CHI con GET/PUT/DELETE lenh + in
   phieu la con dung 'orders'. */
IF NOT EXISTS (SELECT 1 FROM ChucNang WHERE ModuleCode = 'QLSX' AND MaChucNang = 'tiendo')
BEGIN
    INSERT INTO ChucNang (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    SELECT 'QLSX', 'tiendo', N'Ghi nhận tiến độ', ISNULL(MAX(ThuTu), 0) + 1 FROM ChucNang WHERE ModuleCode = 'QLSX';
    PRINT 'Da them chuc nang QLSX.tiendo (Ghi nhan tien do).';
END ELSE PRINT 'Chuc nang QLSX.tiendo da ton tai, bo qua.';
GO

/* ---- 4. Sao chep quyen HIEN CO cua 'orders' sang 'tiendo' cho TUNG NHOM (ChucNangPermissions) - giu
   nguyen hanh vi cho MOI nguoi dung ngay sau khi nang cap (ai dang sua/ghi tien do duoc thi van tiep
   tuc lam duoc ca 2 cho toi khi Admin chu dong vao "Ma trận phân quyền" tach rieng ra). Chi copy neu
   nhom do CHUA co dong rieng cho 'tiendo' (idempotent - chay lai khong ghi de tuy chinh da lam sau nay). */
INSERT INTO ChucNangPermissions (GroupID, ChucNangID, CanView, CanEdit, CanDelete)
SELECT gcp.GroupID, cnMoi.ChucNangID, gcp.CanView, gcp.CanEdit, gcp.CanDelete
FROM ChucNangPermissions gcp
JOIN ChucNang cnCu ON cnCu.ChucNangID = gcp.ChucNangID AND cnCu.ModuleCode = 'QLSX' AND cnCu.MaChucNang = 'orders'
JOIN ChucNang cnMoi ON cnMoi.ModuleCode = 'QLSX' AND cnMoi.MaChucNang = 'tiendo'
WHERE NOT EXISTS (
    SELECT 1 FROM ChucNangPermissions x WHERE x.GroupID = gcp.GroupID AND x.ChucNangID = cnMoi.ChucNangID
);
PRINT 'Da sao chep quyen theo NHOM tu QLSX.orders sang QLSX.tiendo (neu chua co).';
GO

/* ---- 5. Sao chep quyen ghi de RIENG TUNG USER (UserChucNangPermissions) - cung nguyen tac nhu muc 4,
   ap dung cho cac user co ghi de rieng (khac voi quyen mac dinh cua nhom). ---- */
INSERT INTO UserChucNangPermissions (UserID, ChucNangID, CanView, CanEdit, CanDelete)
SELECT ucp.UserID, cnMoi.ChucNangID, ucp.CanView, ucp.CanEdit, ucp.CanDelete
FROM UserChucNangPermissions ucp
JOIN ChucNang cnCu ON cnCu.ChucNangID = ucp.ChucNangID AND cnCu.ModuleCode = 'QLSX' AND cnCu.MaChucNang = 'orders'
JOIN ChucNang cnMoi ON cnMoi.ModuleCode = 'QLSX' AND cnMoi.MaChucNang = 'tiendo'
WHERE NOT EXISTS (
    SELECT 1 FROM UserChucNangPermissions x WHERE x.UserID = ucp.UserID AND x.ChucNangID = cnMoi.ChucNangID
);
PRINT 'Da sao chep quyen ghi de RIENG USER tu QLSX.orders sang QLSX.tiendo (neu chua co).';
GO

PRINT 'Hoan tat migration v5.6.';
GO
