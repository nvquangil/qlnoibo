/* ==================================================================================================
   migration_v888.sql  (v9.36)  —  PHI VAN CHUYEN VAI VAO GIA THANH, KHONG VAO CONG NO NCC

   Nguyen 2026-11-09: "vai nhap ve chua co gia van chuyen. moi NCC gia van chuyen khac nhau. lam the
   nao de dua vao gia thanh tung cay vai ma khong anh huong den cong no NCC".

   🔴 VI SAO PHAI LA COT RIENG, KHONG CONG VAO VaiCay.DonGiaNhap:
   congNoNCC() (routes/congno.js) va tinhGiaThanh() (routes/qlsx.js) CUNG doc DonGiaNhap. Cong phi
   vao do thi cong no phai tra NCC PHINH THEO DUNG SO PHI — he thong bao ta no nha cung cap ca tien
   cuoc da tra cho nha xe. Xem khoi ghi chu v9.36 trong backend/utils/tienVaiNhap.js.

   BA COT:
     NhaCungCap.PhiVanChuyenDonGia  — don gia phi cua NCC do (d/kg hoac d/met), de tu ap khi nhap
     NhaCungCap.PhiVanChuyenDVT     — don vi cua don gia tren ('Kg' | 'Met')
     VaiCay.PhiVanChuyenDonGia      — don gia phi DA AP cho chinh cay do (ban chup)

   🔴 VaiCay.PhiVanChuyenDonGia la BAN CHUP, co chu dinh: doi don gia trong danh muc NCC sau nay
   KHONG duoc lam doi gia thanh cua nhung cay da nhap truoc do. Ke toan khong chap nhan hoi to —
   cung nguyen tac da ghi o khoi GiaVonHangHoa.

   NULL duoc phep o ca ba cot: vai NCC giao tan noi / tu cho thi khong co phi. Moi bieu thuc deu
   ISNULL(...,0) nen du lieu cu giu nguyen TUYET DOI, khong backfill (cung lua chon nhu DonViTinhGia
   cua migration_v694).

   🔴 CHAY TRUOC `pm2 restart qlnoibo`.
   An toan chay LAI nhieu lan. KHONG xoa, KHONG sua du lieu nghiep vu nao.
   ================================================================================================== */

SET NOCOUNT ON;
PRINT N'--- migration_v888: phi van chuyen vai ---';

IF OBJECT_ID('NhaCungCap', 'U') IS NULL OR OBJECT_ID('VaiCay', 'U') IS NULL
BEGIN
    PRINT N'!! Thieu bang NhaCungCap hoac VaiCay — chay schema goc truoc. Dung lai.';
END
ELSE
BEGIN
    IF COL_LENGTH('NhaCungCap', 'PhiVanChuyenDonGia') IS NULL
    BEGIN
        ALTER TABLE NhaCungCap ADD PhiVanChuyenDonGia DECIMAL(14,2) NULL;
        PRINT N'  + NhaCungCap.PhiVanChuyenDonGia';
    END
    ELSE PRINT N'  = NhaCungCap.PhiVanChuyenDonGia da co';

    IF COL_LENGTH('NhaCungCap', 'PhiVanChuyenDVT') IS NULL
    BEGIN
        ALTER TABLE NhaCungCap ADD PhiVanChuyenDVT NVARCHAR(10) NULL;
        PRINT N'  + NhaCungCap.PhiVanChuyenDVT';
    END
    ELSE PRINT N'  = NhaCungCap.PhiVanChuyenDVT da co';

    IF COL_LENGTH('VaiCay', 'PhiVanChuyenDonGia') IS NULL
    BEGIN
        ALTER TABLE VaiCay ADD PhiVanChuyenDonGia DECIMAL(14,2) NULL;
        PRINT N'  + VaiCay.PhiVanChuyenDonGia  (ban chup — KHONG hoi to khi doi gia o danh muc NCC)';
    END
    ELSE PRINT N'  = VaiCay.PhiVanChuyenDonGia da co';
END
GO

/* ==================================================================================================
   🔴 RANG BUOC CHECK PHAI NAM O BATCH RIENG, SAU MOT `GO`.
   Ra soat cheo bat duoc: de chung batch voi ALTER TABLE ADD thi SQL Server bind ten cot luc BIEN DICH
   ca batch ⇒ cau CHECK bao "Invalid column name 'PhiVanChuyenDVT'" ⇒ HUY CA BATCH truoc khi mot
   ALTER nao kip chay ⇒ migration khong bao gio hoan tat, chay lai bao nhieu lan cung vay.
   Day la mau da chung minh cua chinh repo nay — xem migration_v694.sql:36.
   Khong the chen `GO` vao trong BEGIN/END, nen khoi nay o CAP NGOAI CUNG.

   Rang buoc giong CK_PhieuNhapVai_DonViTinhGia: chi nhan Kg/Met/NULL. Cot vua them nen moi dong cu
   deu NULL, ma CHECK cho phep IS NULL ⇒ khong dong nao vi pham, khong can WITH NOCHECK.
   ================================================================================================== */
IF COL_LENGTH('NhaCungCap', 'PhiVanChuyenDVT') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_NhaCungCap_PhiVCDVT')
BEGIN
    ALTER TABLE NhaCungCap ADD CONSTRAINT CK_NhaCungCap_PhiVCDVT
        CHECK (PhiVanChuyenDVT IS NULL OR PhiVanChuyenDVT IN (N'Kg', N'Met'));
    PRINT N'  + CK_NhaCungCap_PhiVCDVT';
END
ELSE PRINT N'  = CK_NhaCungCap_PhiVCDVT da co (hoac chua co cot)';
GO

PRINT N'--- migration_v888: XONG ---';
GO
