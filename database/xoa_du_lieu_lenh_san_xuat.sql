/* ================================================================================================
   XOA TOAN BO DU LIEU LENH SAN XUAT (Quan ly san xuat) — QLNoiBo
   ------------------------------------------------------------------------------------------------
   Pham vi (theo yeu cau): XOA SACH TAT CA lenh san xuat + moi du lieu con
     (tien do, cat, phan cong may, tai lieu gan don, cau truc vai, gia cong, in theu, bang ke...),
     VA xoa luon phieu xuat kho vai/phu kien GAN THEO DON de HOAN TRA TON kho.

   GIU LAI (khong xoa):
     - Danh muc dung chung: KhachHang, NhaGiaCong, CongDoanMay, DanhMucVai, DonViTinh, HangMucGiaCong...
     - TAI LIEU MAU (LaMau=1, DonHangID NULL): mau Tai lieu ky thuat / Thong so / Mo ta / Quy cach / Bang ke
       -> la mau dung lai nhieu lan, KHONG thuoc 1 don cu the -> giu nguyen.
     - Phieu xuat kho "xuat tu do" (DonHangID NULL, khong gan don) -> giu nguyen.
     - TheKhoHangHoa (ma hang kho thanh pham): KHONG xoa, chi NGAT lien ket (DonHangID=NULL) —
       vi ma hang nay con duoc Bao gia Aloha / Don khach dat hang tham chieu, va ton thanh pham la so du luu.
     - Cham cong / luong / HRM: doc lap, khong dung toi.

   AN TOAN:
     - Chay trong 1 TRANSACTION. SET XACT_ABORT ON (loi bat ky -> rollback het).
     - Co co @ThucSuXoa: mac dinh = 0 => CHAY THU (rollback, chi in so lieu). Doi thanh 1 => XOA THAT (commit).
     - LUON BACKUP DATABASE truoc khi chay that.

   CACH DUNG:
     1) Chay nguyen file voi @ThucSuXoa = 0  -> xem so dong se xoa (khong thay doi gi).
     2) Neu so lieu dung, sua @ThucSuXoa = 1  -> chay lai -> xoa that.
   ================================================================================================ */
USE QLNoiBo;
GO

SET XACT_ABORT ON;
SET NOCOUNT ON;

DECLARE @ThucSuXoa BIT = 0;   -- <<<<<< 0 = chay thu (rollback) ; 1 = XOA THAT (commit) >>>>>>

BEGIN TRAN;

PRINT N'--- TRUOC KHI XOA ---';
PRINT N'So lenh san xuat hien co: ' + CAST((SELECT COUNT(*) FROM DonHangSanXuat) AS NVARCHAR(20));
PRINT N'So dong tien do (TienDoSanXuat): ' + CAST((SELECT COUNT(*) FROM TienDoSanXuat) AS NVARCHAR(20));
PRINT N'So phieu xuat vai gan don: ' + CAST((SELECT COUNT(*) FROM PhieuXuatVai WHERE DonHangID IS NOT NULL) AS NVARCHAR(20));

/* ============ A. TIEN DO SAN XUAT + cac bang con ============ */
DELETE FROM TienDoChiTietMauPhu;
DELETE FROM TienDoChiTietMau;
DELETE FROM PhanCongMay;
DELETE FROM TienDoTraiVai;
DELETE FROM TienDoCatChiTietCay;
UPDATE TienDoSanXuat SET NhomTienDoID = NULL;   -- go self-FK truoc khi xoa
DELETE FROM TienDoSanXuat;

/* ============ B. NHA GIA CONG CHI TIET ============ */
DELETE FROM GiaoNhaGiaCongChiTiet;
DELETE FROM NhanNhaGiaCongChiTiet;
DELETE FROM DonHangChiTietNhaGiaCong;

/* ============ C. TAI LIEU GAN DON (GIU MAU: chi xoa dong co DonHangID) ============ */
-- Tai lieu ky thuat chung
DELETE FROM TaiLieuKyThuatChungDong WHERE MucID IN (SELECT ID FROM TaiLieuKyThuatChungMuc WHERE TaiLieuID IN (SELECT ID FROM TaiLieuKyThuatChung WHERE DonHangID IS NOT NULL));
DELETE FROM TaiLieuKyThuatChungMuc WHERE TaiLieuID IN (SELECT ID FROM TaiLieuKyThuatChung WHERE DonHangID IS NOT NULL);
DELETE FROM TaiLieuKyThuatChung WHERE DonHangID IS NOT NULL;
-- Thong so ky thuat (do)
DELETE FROM TaiLieuThongSoDoGiaTri WHERE DongID IN (SELECT ID FROM TaiLieuThongSoDoDong WHERE TaiLieuID IN (SELECT ID FROM TaiLieuThongSoDo WHERE DonHangID IS NOT NULL));
DELETE FROM TaiLieuThongSoDoCot WHERE TaiLieuID IN (SELECT ID FROM TaiLieuThongSoDo WHERE DonHangID IS NOT NULL);
DELETE FROM TaiLieuThongSoDoDong WHERE TaiLieuID IN (SELECT ID FROM TaiLieuThongSoDo WHERE DonHangID IS NOT NULL);
DELETE FROM TaiLieuThongSoDo WHERE DonHangID IS NOT NULL;
-- Mo ta duong may / Quy cach dong goi / Hinh anh in theu (dung chung bang, phan biet Loai)
DELETE FROM TaiLieuMoTaSanPhamO WHERE TaiLieuID IN (SELECT ID FROM TaiLieuMoTaSanPham WHERE DonHangID IS NOT NULL);
DELETE FROM TaiLieuMoTaSanPham WHERE DonHangID IS NOT NULL;

/* ============ D. DON GIA / HANG MUC / IN THEU / BANG KE / PHU KIEN / GIAO VAI (gan don) ============ */
DELETE FROM DonHangDonGiaCongDoanMay;   -- sau PhanCongMay (da xoa o buoc A)
DELETE FROM DonHangCongDoanMay;
DELETE FROM DonHangHangMucGiaCong;
DELETE FROM DonHangNhaInTheu;
DELETE FROM DonHangDonGiaInThe;
DELETE FROM BangKeBanThanhPham WHERE DonHangID IS NOT NULL;   -- giu mau (DonHangID NULL)
DELETE FROM DonHangChiTietPhuKien;
DELETE FROM GiaoVaiSanXuat;

/* ============ E. SO DO + CAU TRUC VAI ============ */
DELETE FROM DonHangChiTietSoDo;                       -- sau TienDoSanXuat (SoDoID tro toi day)
UPDATE DonHangChiTietVai SET MauChinhLienKetID = NULL;-- go self-FK (Phoi -> Chinh) truoc khi xoa
DELETE FROM DonHangChiTietVai;

/* ============ F. PHIEU XUAT KHO GAN DON -> XOA de HOAN TRA TON (chi dong co DonHangID) ============ */
DELETE FROM PhieuXuatVaiChiTiet WHERE PhieuXuatID IN (SELECT PhieuXuatID FROM PhieuXuatVai WHERE DonHangID IS NOT NULL);
DELETE FROM PhieuXuatVai WHERE DonHangID IS NOT NULL;

-- PhieuXuatVatTu (ban gop v5.28, co the DA bi hoan tac o v5.29) -> chi xu ly neu bang con ton tai
IF OBJECT_ID('PhieuXuatVatTu', 'U') IS NOT NULL
BEGIN
    DELETE FROM PhieuXuatVatTuVai WHERE PhieuVatTuID IN (SELECT PhieuVatTuID FROM PhieuXuatVatTu WHERE DonHangID IS NOT NULL);
    DELETE FROM PhieuXuatVatTuPhuKien WHERE PhieuVatTuID IN (SELECT PhieuVatTuID FROM PhieuXuatVatTu WHERE DonHangID IS NOT NULL);
    DELETE FROM PhieuXuatVatTu WHERE DonHangID IS NOT NULL;
END

DELETE FROM PhieuPhuKienChiTiet WHERE PhieuID IN (SELECT PhieuID FROM PhieuPhuKien WHERE DonHangID IS NOT NULL);
DELETE FROM PhieuPhuKien WHERE DonHangID IS NOT NULL;

/* ============ G. THONG BAO + THE KHO (bang chia se) ============ */
DELETE FROM ThongBao WHERE DonHangID IS NOT NULL;                 -- thong bao gan don -> xoa
UPDATE TheKhoHangHoa SET DonHangID = NULL WHERE DonHangID IS NOT NULL;  -- GIU ma hang, chi ngat lien ket

/* ============ H. XOA GOC: LENH SAN XUAT ============ */
DELETE FROM DonHangSanXuat;
DECLARE @soDaXoa INT = @@ROWCOUNT;

/* ============ I. HOAN TRA TRANG THAI CAY VAI ============
   Ton kho vai (vw_TonCayVai) la VIEW -> tu hoan sau khi xoa phieu xuat. Nhung VaiCay.TrangThai la cot LUU
   -> tinh lai theo phan xuat CON LAI (chi tu PhieuXuatVaiChiTiet - nguon that su cua view ton). */
UPDATE vc
   SET TrangThai = CASE WHEN r.KGXuat IS NULL OR r.KGXuat <= 0 THEN N'Nguyên cây'
                        WHEN vc.KGNhap - r.KGXuat > 0          THEN N'Cây lẻ'
                        ELSE N'Hết' END
FROM VaiCay vc
LEFT JOIN (SELECT CayID, SUM(KGXuat) AS KGXuat FROM PhieuXuatVaiChiTiet GROUP BY CayID) r ON r.CayID = vc.CayID;

PRINT N'--- SAU KHI XOA (trong transaction) ---';
PRINT N'So lenh san xuat con lai: ' + CAST((SELECT COUNT(*) FROM DonHangSanXuat) AS NVARCHAR(20));
PRINT N'So lenh san xuat da xoa: ' + CAST(@soDaXoa AS NVARCHAR(20));
PRINT N'So tai lieu MAU con giu (khong bi xoa): '
      + CAST(( (SELECT COUNT(*) FROM TaiLieuKyThuatChung WHERE LaMau=1)
             + (SELECT COUNT(*) FROM TaiLieuThongSoDo   WHERE LaMau=1)
             + (SELECT COUNT(*) FROM TaiLieuMoTaSanPham WHERE LaMau=1) ) AS NVARCHAR(20));

/* ============ CHOT ============ */
IF @ThucSuXoa = 1
BEGIN
    COMMIT;
    PRINT N'>>> DA COMMIT: du lieu lenh san xuat da bi XOA THAT.';
END
ELSE
BEGIN
    ROLLBACK;
    PRINT N'>>> CHAY THU (da ROLLBACK - CHUA xoa gi). Dat @ThucSuXoa = 1 roi chay lai de xoa that.';
END
GO
