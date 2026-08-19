/* ================================================================================================
   migration_v682.sql   (v6.89)
   PHIEU NHAP KHO LA MOT NGUON TON KHO RIENG — KHONG GHI VAO O "NHAP" CUA THE KHO NUA.

   YEU CAU: luu phieu nhap kho thi chi (a) tao ma hang neu chua co, (b) cong cong no NCC,
   (c) len BAO CAO TON KHO. O "Nhap" cua the kho chi do nguoi dung khai khi tao/sua the kho.

   CACH LAM: ton kho hang hoa nay co HAI NGUON CONG LAI, khong chong nhau:
     Nguon 1 - THE KHO   : TheKhoChiTietMau.NhapCai  (nguoi dung khai tay, hoac QLSX cong doan KN)
     Nguon 2 - CHUNG TU  : PhieuNhapKhoHangChiTiet.SoLuongChinh (phieu chua huy)
     TON = (Nguon1 + Nguon2) - XuatCai

   ⚠️ VI SAO KHONG DUNG CO "DaVaoTheKho" ROI CHUYEN NGUON: chuyen nguon la lam hai buoc ghi cho cung
   mot so luong, va bat ky lan nao lech nhau la ton kho sai am tham. O day hai nguon RỜI NHAU HAN
   theo cau truc — phieu nhap khong bao gio ghi vao NhapCai — nen KHONG THE dem hai lan.

   ⚠️ HE QUA: huy/xoa phieu nhap thi ton TU DONG giam, vi view doc thang tu bang phieu. Backend
   KHONG con phai tru NhapCai khi huy phieu (da go trong nhapkho.js cung ban nay).

   ⚠️ BUOC GO MOT LAN: cac ban v6.78-v6.88 DA cong NhapCai tu phieu nhap. Neu khong go ra thi sau khi
   doi view se dem hai lan. Buoc 3 duoi day tru dung so da cong, co chot chong chay lai 2 lan.
   Phep tru nay BU TRU CHINH XAC voi phan view cong vao => ton kho KHONG doi mot don vi nao.
   ================================================================================================ */

/* ---------------- 0. Chan chay khi chua co bang cua migration_v681 ----------------
   ⚠️ RAISERROR mot minh KHONG dung script; phai SET NOEXEC ON thi cac batch sau moi bi bo qua.
   Khong chan la buoc 3 se tru NhapCai roi ghi chot ma view chua kip tao => ton tut. */
IF OBJECT_ID('PhieuNhapKhoHangChiTiet', 'U') IS NULL
BEGIN
  RAISERROR('DUNG: chua co bang PhieuNhapKhoHangChiTiet - phai chay migration_v681 truoc.', 16, 1);
  SET NOEXEC ON;
END
GO

/* ---------------- 1. Nguon 2: so luong tu PHIEU NHAP KHO ----------------
   ⚠️ CREATE VIEW PHAI LA CAU DAU TIEN CUA BATCH (SQL Server Msg 111). Khong duoc de PRINT hay bat cu
   cau nao khac dung truoc no trong cung mot batch — moi CREATE VIEW o day deu co GO ngay truoc. */
GO
CREATE OR ALTER VIEW vw_NhapKhoTuPhieu AS
SELECT ct.MaHangID, ct.MauSacID, SUM(ISNULL(ct.SoLuongChinh, 0)) AS NhapTuPhieu
FROM PhieuNhapKhoHangChiTiet ct
JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
WHERE p.TrangThai <> N'Đã hủy'
GROUP BY ct.MaHangID, ct.MauSacID;
GO
PRINT '  + vw_NhapKhoTuPhieu';
GO

/* ---------------- 2. TON THEO TUNG MAU — MOT DINH NGHIA DUY NHAT ----------------
   Truoc day co 14 cho trong backend tu viet SUM(NhapCai - XuatCai). Them nguon thu hai ma de nguyen
   14 ban sao la chac chan se co cho bi bo sot. Nay MOI cho doc ton deu phai JOIN view nay.

   Khoa la UNION cua hai nguon: ma hang moi chi co phieu nhap thi CHUA co dong nao trong
   TheKhoChiTietMau (chua tao the kho) — neu chi LEFT JOIN tu TheKhoChiTietMau thi hang vua nhap se
   khong ton tai trong moi phep tinh ton. */
GO
CREATE OR ALTER VIEW vw_TonTheoMau AS
SELECT k.MaHangID, k.MauSacID,
       ISNULL(ct.SoCatCai, 0)      AS SoCatCai,
       ISNULL(ct.NhapCai, 0)       AS NhapCai,        -- nguon 1: khai tay o the kho / QLSX
       ISNULL(pk.NhapTuPhieu, 0)   AS NhapTuPhieu,    -- nguon 2: phieu nhap kho
       ISNULL(ct.NhapCai, 0) + ISNULL(pk.NhapTuPhieu, 0) AS TongNhapCai,
       ISNULL(ct.XuatCai, 0)       AS XuatCai,
       ISNULL(ct.NhapCai, 0) + ISNULL(pk.NhapTuPhieu, 0) - ISNULL(ct.XuatCai, 0) AS TonCai,
       ct.ID AS ChiTietID, ct.LinkAnh, ct.GhiChu
FROM (
  SELECT MaHangID, MauSacID FROM TheKhoChiTietMau
  UNION
  SELECT MaHangID, MauSacID FROM vw_NhapKhoTuPhieu
) k
LEFT JOIN TheKhoChiTietMau ct ON ct.MaHangID = k.MaHangID AND ct.MauSacID = k.MauSacID
LEFT JOIN vw_NhapKhoTuPhieu pk ON pk.MaHangID = k.MaHangID AND pk.MauSacID = k.MauSacID;
GO
PRINT '  + vw_TonTheoMau';
PRINT '  ! Luu y: cot vat ly TheKhoChiTietMau.TonCai (computed = NhapCai - XuatCai) TU NAY LA SO SAI';
PRINT '    - no khong gom nguon phieu nhap kho. Moi cho tinh ton phai doc vw_TonTheoMau.TonCai.';
GO

/* ---------------- 3. GO MOT LAN phan NhapCai ma phieu nhap da cong (v6.78-v6.88) ----------------
   Chot: CauHinhHeThong.ConfigKey = 'V682_GO_NHAPCAI_PHIEUNK'. Co chot roi thi BO QUA.
   Phep tru nay khong lam ton doi: so tru ra dung bang so view vua cong vao.

   ⚠️ HAI DIEU KIEN, thieu mot la KHONG duoc tru:
     (a) chua co chot   -> chua tru lan nao;
     (b) vw_TonTheoMau DA TON TAI -> chac chan co ai do cong lai phan vua tru.
   Thieu (b) thi khi buoc 2 loi ma buoc nay van chay, ton se TUT dung bang tong phieu nhap va chot da
   ghi nen chay lai cung khong tu sua. */
IF NOT EXISTS (SELECT 1 FROM CauHinhHeThong WHERE ConfigKey = 'V682_GO_NHAPCAI_PHIEUNK')
   AND OBJECT_ID('vw_TonTheoMau', 'V') IS NOT NULL
BEGIN
  DECLARE @soDong INT = 0, @soLuong INT = 0;

  SELECT @soDong = COUNT(*), @soLuong = ISNULL(SUM(NhapTuPhieu), 0) FROM vw_NhapKhoTuPhieu;

  UPDATE ct
     SET ct.NhapCai = ct.NhapCai - pk.NhapTuPhieu
    FROM TheKhoChiTietMau ct
    JOIN vw_NhapKhoTuPhieu pk ON pk.MaHangID = ct.MaHangID AND pk.MauSacID = ct.MauSacID;

  INSERT INTO CauHinhHeThong (ConfigKey, ConfigValue)
  VALUES ('V682_GO_NHAPCAI_PHIEUNK',
          CONVERT(NVARCHAR(30), SYSDATETIME(), 120) + N' | dong=' + CAST(@soDong AS NVARCHAR(20))
          + N' | soluong=' + CAST(@soLuong AS NVARCHAR(20)));

  PRINT '  + Da GO NhapCai do phieu nhap cong truoc day: ' + CAST(@soDong AS VARCHAR(20))
        + ' dong ma-mau, tong ' + CAST(@soLuong AS VARCHAR(20)) + ' (don vi chinh).';
  PRINT '    Ton kho KHONG doi - view vw_TonTheoMau cong lai dung so nay tu bang phieu.';
END
ELSE IF OBJECT_ID('vw_TonTheoMau', 'V') IS NULL
  PRINT '  ! BO QUA buoc go NhapCai: chua tao duoc vw_TonTheoMau (xem loi o tren). CHAY LAI file nay.';
ELSE PRINT '  = Da go NhapCai tu truoc (co chot V682_GO_NHAPCAI_PHIEUNK), bo qua';
GO

/* ---------------- 4. Dung lai vw_TonKhoHangHoa tren nguon moi ----------------
   Giu NGUYEN bo cot cua ban v642 (nhieu noi dang doc: khohang.js GET /items + export,
   public.js catalogue/danhmuc) va THEM TongNhapTuPhieu de man hinh phan biet duoc ton den tu dau.
   ⚠️ Khong doi ten cot TongNhap/TongXuat/TongTon - doi la vo cac route dang chay. */
GO
CREATE OR ALTER VIEW vw_TonKhoHangHoa AS
SELECT
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien,
    h.TheKhoDanhMucID, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.GiaAloha, h.MaBarcode,
    h.NhomSanPhamID, nsp.TenNhom,
    ISNULL(SUM(t.SoCatCai), 0)     AS TongSoCat,
    ISNULL(SUM(t.TongNhapCai), 0)  AS TongNhap,          -- da GOM ca 2 nguon
    ISNULL(SUM(t.NhapTuPhieu), 0)  AS TongNhapTuPhieu,   -- rieng phan den tu phieu nhap kho
    ISNULL(SUM(t.XuatCai), 0)      AS TongXuat,
    ISNULL(SUM(t.TonCai), 0)       AS TongTon
FROM TheKhoHangHoa h
LEFT JOIN TheKhoDanhMuc tk ON tk.TheKhoDanhMucID = h.TheKhoDanhMucID
LEFT JOIN DanhMucNhomSanPham nsp ON nsp.NhomSanPhamID = h.NhomSanPhamID
LEFT JOIN vw_TonTheoMau t ON t.MaHangID = h.MaHangID
LEFT JOIN DonHangSanXuat d ON d.DonHangID = h.DonHangID
GROUP BY
    h.MaHangID, h.MaHang, h.TenHang, h.GiaBan, h.LoaiRi, h.AnhDaiDien,
    h.TheKhoDanhMucID, tk.TenTheKho,
    h.LoaiHang, h.DonHangID, h.DonViCoBan, h.DonViQuyDoi, d.MaDH,
    h.GiaAloha, h.MaBarcode, h.NhomSanPhamID, nsp.TenNhom;
GO
PRINT '  + vw_TonKhoHangHoa (dung lai tren vw_TonTheoMau)';

PRINT '';
PRINT '=== migration_v682 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes: nhapkho, khohang, banhang, baocao, public).';
PRINT 'Kiem nhanh - hai so nay phai BANG NHAU:';
PRINT '  SELECT SUM(TongTon) FROM vw_TonKhoHangHoa;';
PRINT '  SELECT SUM(NhapCai) - SUM(XuatCai) FROM TheKhoChiTietMau';
PRINT '   + (SELECT SUM(NhapTuPhieu) FROM vw_NhapKhoTuPhieu);';
GO
SET NOEXEC OFF;
GO
