/* ================================================================
   MIGRATION v5.0 — Phan quyen chi tiet theo tung CHUC NANG (tab/man hinh con trong 1 phan he).
   Bo sung, KHONG thay doi logic phan quyen theo PHAN HE (Modules/Permissions) da co - 2 lop nay
   hoat dong song song:
     - Permissions (cu)        : co duoc VAO phan he nay khong, co duoc Them/Sua/Xoa trong do khong.
     - ChucNangPermissions (moi): trong phan he da duoc vao, co duoc THAY man hinh con (tab) cu the
                                  nay trong menu khong. Mac dinh (chua co dong nao) = duoc thay (an toan,
                                  khong lam mat quyen cua nhom da cau hinh tu truoc khi chay migration nay).
   Chay 1 lan. Idempotent - chay lai khong tao trung du lieu.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    CREATE TABLE ChucNang (
        ChucNangID INT IDENTITY(1,1) PRIMARY KEY,
        ModuleCode NVARCHAR(30) NOT NULL,
        MaChucNang NVARCHAR(30) NOT NULL,     -- khop dung voi "key" tra ve tu getTabs() o frontend
        TenChucNang NVARCHAR(100) NOT NULL,
        ThuTu INT NOT NULL DEFAULT 0,
        CONSTRAINT UQ_ChucNang_Module_Ma UNIQUE (ModuleCode, MaChucNang)
    );
    PRINT 'Da tao bang ChucNang.';
END ELSE PRINT 'Bang ChucNang da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNangPermissions')
BEGIN
    CREATE TABLE ChucNangPermissions (
        GroupID INT NOT NULL REFERENCES Groups(GroupID) ON DELETE CASCADE,
        ChucNangID INT NOT NULL REFERENCES ChucNang(ChucNangID) ON DELETE CASCADE,
        CanView BIT NOT NULL DEFAULT 1,
        PRIMARY KEY (GroupID, ChucNangID)
    );
    PRINT 'Da tao bang ChucNangPermissions.';
END ELSE PRINT 'Bang ChucNangPermissions da ton tai, bo qua.';
GO

-- Seed danh muc chuc nang (khop dung key/label trong getTabs() cua tung module.*.js frontend).
-- Dung MERGE de idempotent - chay lai nhieu lan khong tao trung, khong xoa/doi ThuTu cua dong da co.
-- (Phase 4 patch: bo sung 2 dong QLSX 'ralenh'/'dongiamay' bi thieu tu Phase 2 - khien 2 tab nay
--  khong the bi an/chan qua man hinh Ma tran phan quyen du middleware requireChucNang da co san.)
MERGE ChucNang AS t
USING (VALUES
    ('DANHMUC','bophan',N'Bộ phận',1),
    ('DANHMUC','loaivai',N'Loại vải',2),
    ('DANHMUC','mausac',N'Màu sắc',3),
    ('DANHMUC','vai',N'Danh mục vải (mã vải)',4),
    ('DANHMUC','phulieu',N'Phụ liệu',5),
    ('DANHMUC','nhagiacong',N'Nhà gia công / In thêu',6),
    ('DANHMUC','nhacungcap',N'Nhà cung cấp',7),
    ('DANHMUC','khachhang',N'Khách hàng',8),
    ('DANHMUC','thekhodanhmuc',N'Danh mục thẻ kho',9),
    ('DANHMUC','congdoan',N'Công đoạn sản xuất',10),
    ('DANHMUC','donvitinh',N'Đơn vị tính',11),
    ('DANHMUC','congdoanmay',N'Công đoạn may',12),
    ('DANHMUC','nhanvien',N'Nhân viên',13),
    ('DANHMUC','cauhinh',N'Cấu hình hệ thống',14),
    ('USERS','users',N'Tài khoản',1),
    ('USERS','groups',N'Nhóm quyền',2),
    ('USERS','perm',N'Ma trận phân quyền',3),
    ('QLSX','dashboard',N'Dashboard',1),
    ('QLSX','ralenh',N'Ra lệnh sản xuất',2),
    ('QLSX','orders',N'Danh sách đơn hàng',3),
    ('QLSX','dongiamay',N'Đơn giá công đoạn may',4),
    ('KHOVAI','dashboard',N'Tồn kho',1),
    ('KHOVAI','rolls',N'Tồn theo cây',2),
    ('KHOVAI','nhap',N'Nhập kho',3),
    ('KHOVAI','xuat',N'Xuất kho',4),
    ('KHOVAI','dinhmuc',N'Định mức & Hao hụt',5),
    ('KHOVAI','kiemke',N'Kiểm kê',6),
    ('KHOVAI','tem',N'In tem theo ngày nhập',7),
    ('KHOHANG','items',N'Thẻ kho / Tồn kho',1),
    ('KHOHANG','orders',N'Đơn khách đặt hàng',2),
    ('PHUKIEN','phieunhap',N'Phiếu Nhập',1),
    ('PHUKIEN','phieuxuat',N'Phiếu Xuất',2),
    ('PHUKIEN','thekho',N'Thẻ kho / Tồn kho',3),
    ('PHUKIEN','danhmuc',N'Danh mục phụ kiện',4),
    ('PHUKIEN','loai',N'Loại phụ kiện',5)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO
PRINT 'Da seed danh muc ChucNang (idempotent).';
GO
