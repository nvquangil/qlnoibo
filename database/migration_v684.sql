/* ================================================================================================
   migration_v684.sql   (v7.10)
   QUYEN "XEM TAT CA LENH SX" — tach PHAM VI XEM khoi QUYEN GHI TIEN DO

   VAN DE: tu truoc den nay "user nao thay lenh SX nao" bi quyet dinh boi bang UserCongDoan — chinh
   la bang dung de cap QUYEN GHI TIEN DO cong doan. Mot bang ganh HAI viec:
       - Khong tick cong doan nao  => thay TAT CA lenh SX (nhung khong ghi duoc tien do o dau)
       - Tick vai cong doan        => chi thay lenh dang o dung cong doan do
   Nen muon cho 1 nguoi XEM HET lenh SX ma VAN ghi tien do o 1 cong doan la KHONG THE LAM DUOC.

   CACH GIAI: them 1 CHUC NANG rieng 'QLSX/xemtatca' — tick o Ma tran phan quyen la thay het,
   khong lien quan gi den danh sach cong doan nua.

   ⚠️ VI SAO PHAI THEM COT `ChucNang.MacDinhCho`:
   Toan bo he thong chuc nang hien hanh chay theo quy uoc "KHONG co dong cau hinh = DUOC PHEP"
   (xem middleware/auth.js:requireChucNang va users.js: `ISNULL(cp.CanView, 1)`). Neu de
   'xemtatca' theo quy uoc do thi vua chay migration la MOI NGUOI thay het lenh SX — nguoc hoan
   toan y muon. Con te hon: o Ma tran phan quyen no se hien TICK SAN, ai mo ra bam Luu la vo tinh
   cap quyen cho ca nhom.
   Vi vay them cot `MacDinhCho` (mac dinh 1 = giu nguyen hanh vi cu cho MOI chuc nang dang co);
   rieng cac chuc nang kieu "NANG LUC MO RONG" (nhu xemtatca) dat 0 = PHAI TICK MOI CO.

   Chay lai file nay nhieu lan khong sao (idempotent).
   ================================================================================================ */
SET NOCOUNT ON;
GO

/* --- 1. Cot MacDinhCho tren ChucNang ------------------------------------------------------------ */
IF COL_LENGTH('ChucNang', 'MacDinhCho') IS NULL
BEGIN
    ALTER TABLE ChucNang ADD MacDinhCho BIT NOT NULL CONSTRAINT DF_ChucNang_MacDinhCho DEFAULT 1;
    PRINT '  + Da them cot ChucNang.MacDinhCho (mac dinh 1 = giu nguyen hanh vi cu).';
END
ELSE
    PRINT '  = Cot ChucNang.MacDinhCho da co.';
GO

/* --- 2. Chuc nang QLSX/xemtatca (MacDinhCho = 0: phai tick moi co) ------------------------------ */
MERGE ChucNang AS t
USING (VALUES
    ('QLSX', 'xemtatca', N'Xem tất cả lệnh SX (mọi công đoạn)', 90, CAST(0 AS BIT))
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN MATCHED THEN UPDATE SET TenChucNang = s.TenChucNang, MacDinhCho = s.MacDinhCho
WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
     VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu, s.MacDinhCho);
GO

PRINT '';
PRINT '=== migration_v684 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua loadUserContext.js + middleware/auth.js + routes/qlsx.js + routes/users.js).';
PRINT 'Cach dung: Quan ly User -> Ma tran phan quyen -> nhom (hoac tab "Theo tung user") ->';
PRINT '           khoi QLSX -> tick o "Xem" cua dong "Xem tat ca lenh SX (moi cong doan)" -> Luu.';
PRINT 'Nguoi duoc cap PHAI dang xuat / dang nhap lai (quyen cache trong session).';
GO
