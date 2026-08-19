/* ================================================================================================
   MIGRATION v6.26 — PHAN HE "BAO CAO KINH DOANH"
   ------------------------------------------------------------------------------------------------
   Them 1 module moi (BAOCAO) voi 5 nhom bao cao:
       1. Ton kho hang hoa (thanh pham)      3. Ton kho phu kien       5. Ket qua kinh doanh (lai/lo)
       2. Ton kho vai                        4. Bao cao tai chinh

   BANG MOI DUY NHAT: GiaVonHangHoa
   ------------------------------------------------------------------------------------------------
   TAI SAO PHAI CO BANG NAY (dung nghiep vu ke toan):
     - Gia von phai duoc "CHOT" tai thoi diem ban, KHONG duoc doi hoi to. Neu bao cao goi thang
       ham tinhGiaThanh() cua lenh SX thi hom nay ai do them 1 dong chi phi chung -> lai/lo cua
       THANG TRUOC tu dong doi theo. Ke toan khong chap nhan dieu do.
     - Ma hang DAT NGOAI (LoaiHang = N'DatNgoai') khong co lenh SX nen khong co gia thanh -> phai
       khai tay, neu khong se tinh gia von = 0 va bao lai ao.
     - Toc do: tinhGiaThanh() chay ~10 truy van cho MOI lenh SX. Bao cao 50 ma hang = 500 truy van.
       Doc 1 bang nho thi tuc thi.
   => Man hinh "Ket qua kinh doanh" co nut "Lay gia thanh tu lenh SX" de NAP/CAP NHAT bang nay.

   Chay 1 lan. IDEMPOTENT (chay lai khong hong gi).
   YEU CAU: da chay migration_v665.sql (gia thanh) va migration_v668.sql (cong no).
   ================================================================================================ */
USE QLNoiBo;
GO
IF DB_NAME() <> 'QLNoiBo'
BEGIN
    RAISERROR('KHONG ket noi duoc database QLNoiBo - dung migration.', 16, 1);
    SET NOEXEC ON;
END
GO

/* ---------------- 1. Bang gia von hang hoa (chot theo tung ma hang) ---------------- */
IF OBJECT_ID('dbo.GiaVonHangHoa', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.GiaVonHangHoa (
        ID             INT IDENTITY(1,1) PRIMARY KEY,
        MaHangID       INT NOT NULL UNIQUE FOREIGN KEY REFERENCES TheKhoHangHoa(MaHangID) ON DELETE CASCADE,
        GiaVon         DECIMAL(18,2) NOT NULL DEFAULT 0,   -- gia von 1 CAI (cung don vi voi GiaBan)
        NguonGia       NVARCHAR(20) NOT NULL DEFAULT N'Lệnh SX',  -- N'Lệnh SX' / N'Khai tay'
        MaDHNguon      NVARCHAR(30) NULL,                  -- ma lenh SX da lay gia thanh (de doi chieu)
        NgayCapNhat    DATE NOT NULL DEFAULT CAST(SYSDATETIME() AS DATE),
        NguoiCapNhatID INT NULL FOREIGN KEY REFERENCES Users(UserID),
        GhiChu         NVARCHAR(255) NULL
    );
    PRINT 'Da tao bang GiaVonHangHoa.';
END ELSE PRINT 'Bang GiaVonHangHoa da ton tai, bo qua.';
GO

/* ================================================================================================
   2. SUA CO "TINH CHI PHI KD" CHO CAC KHOAN DA NAM TRONG GIA VON  — QUAN TRONG
   ------------------------------------------------------------------------------------------------
   Bao cao ket qua kinh doanh tinh:  LOI NHUAN = (Doanh thu - GIA VON) - CHI PHI KD
   Gia von = gia thanh lenh SX, DA GOM: vai + phu kien + gia cong ngoai + may nha lam + in theu
             + bo phan cat + chi phi chung cua lenh.
   => Neu tai khoan "Chi mua nguyen phu lieu" / "Chi gia cong / in theu" van de TinhChiPhiKD = 1 thi
      cung mot dong tien bi TRU HAI LAN (1 lan qua gia von, 1 lan qua chi phi KD) -> BAO LO AO dung
      bang so tien mua nguyen phu lieu trong ky.
   migration_v668 seed 2 loai nay = 1 (luc do chua co bao cao lai/lo) -> nay tat di.

   ⚠️ "Chi lương" GIU NGUYEN, phai tu quyet dinh: luong may/cat da nam trong gia thanh lenh SX,
      nhung luong van phong/quan ly thi khong. Neu dang tra chung 1 tai khoan thi nen TACH LAM 2
      loai tai khoan (Danh muc -> Loai tai khoan): "Chi luong san xuat" (TinhChiPhiKD = 0, vi da
      trong gia von) va "Chi luong quan ly" (TinhChiPhiKD = 1).
   ================================================================================================ */
UPDATE DanhMucLoaiTaiKhoan SET TinhChiPhiKD = 0,
       GhiChu = ISNULL(GhiChu, N'') + N' [v6.26: đã nằm trong giá vốn, không tính lại vào chi phí KD]'
WHERE TenLoai IN (N'Chi mua nguyên phụ liệu', N'Chi gia công / in thêu')
  AND TinhChiPhiKD = 1;
IF @@ROWCOUNT > 0
    PRINT 'Da TAT co "tinh chi phi KD" cho cac loai tai khoan thuoc GIA VON (tranh tru 2 lan).';
ELSE
    PRINT 'Cac loai tai khoan thuoc gia von da tat co tu truoc, bo qua.';
GO

/* ---------------- 3. Module + quyen + chuc nang ---------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'BAOCAO')
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'BAOCAO', N'Báo cáo kinh doanh', 12);
GO
/* Seed DONG quyen (mac dinh TAT ca 0) cho moi nhom chua co - Admin bypass.
   Cap quyen that trong "Quản lý User -> Ma trận phân quyền". */
INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
FROM Groups g CROSS JOIN Modules m
WHERE m.ModuleCode = N'BAOCAO'
  AND NOT EXISTS (SELECT 1 FROM Permissions p WHERE p.GroupID = g.GroupID AND p.ModuleID = m.ModuleID);
GO
MERGE ChucNang AS t
USING (VALUES
    ('BAOCAO','tonhanghoa', N'Tồn kho hàng hóa', 1),
    ('BAOCAO','tonvai',     N'Tồn kho vải', 2),
    ('BAOCAO','tonphukien', N'Tồn kho phụ kiện', 3),
    ('BAOCAO','taichinh',   N'Báo cáo tài chính', 4),
    ('BAOCAO','kinhdoanh',  N'Kết quả kinh doanh', 5),
    ('BAOCAO','giavon',     N'Khai giá vốn hàng hóa', 6)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO

PRINT '';
PRINT '=== MIGRATION v672 HOAN TAT ===';
PRINT '!! BUOC TIEP THEO:';
PRINT '   1. Cap quyen phan he "Báo cáo kinh doanh" + 6 chuc nang trong Ma tran phan quyen.';
PRINT '   2. Vao Bao cao > Ket qua kinh doanh > nut "Lay gia thanh tu lenh SX" de nap gia von lan dau.';
PRINT '   3. Ma hang DAT NGOAI (khong co lenh SX) phai khai gia von tay o tab "Gia von hang hoa".';
GO
SET NOEXEC OFF;
GO
