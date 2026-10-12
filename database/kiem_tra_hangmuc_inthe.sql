/* ================================================================================================
   CHAN DOAN — "Don gia in theu co nhieu dong gia khac nhau nhung o chon Hang muc khong hien het"
   ⚠️ CHI DOC. Khong UPDATE / DELETE / INSERT.

   DOI MaDH o dong duoi thanh ma lenh dang bi loi.

   CACH O CHON DANG LAM VIEC (getHangMucInTheList, routes/qlsx.js):
     - Gom theo TEN hang muc (LTRIM/RTRIM), moi TEN ra DUNG MOT dong.
     - Don gia lay cua ban dau tien theo ORDER BY ISNULL(TenPhieu,''), ID — khop voi bang luong.
     - Dong co Ten RONG bi loai han.

   => Hai dong CUNG TEN khac gia se CHI RA MOT. Do la gioi han that: dong giao chi luu TEN hang muc
      (cot DonHangNhaInTheu.HangMucInThe la chuoi, khong co ma dong), nen co tra ra hai dong cung ten
      thi luu xuong cung khong phan biet duoc, va bang luong cung khop theo ten.
   ================================================================================================ */

DECLARE @MaDH NVARCHAR(50) = N'DH2608064';   -- << DOI MA LENH O DAY
DECLARE @id INT = (SELECT TOP 1 DonHangID FROM DonHangSanXuat WHERE MaDH = @MaDH);

IF @id IS NULL BEGIN PRINT 'KHONG TIM THAY lenh ' + @MaDH; RETURN; END

/* ---------- 1. TOAN BO dong don gia in theu cua lenh (nguyen trang) ---------- */
SELECT ID, ISNULL(TenPhieu, N'(ban khong ten)') AS Ban, Ten, DonGia, ThuTu
FROM DonHangDonGiaInThe
WHERE DonHangID = @id
ORDER BY ISNULL(TenPhieu, N''), ThuTu, ID;

/* ---------- 2. DONG NAO BI GOM MAT? ----------
   SoDong > 1  => nhieu dong CUNG TEN; o chon chi hien MOT, va chi hien gia cua dong dau.
   SoGiaKhac > 1 => cac dong cung ten do khai GIA KHAC NHAU  -> day la ca dang bi loi.
   SoDong = 1 cho moi dong => khong co gi bi gom, o chon phai hien DU. Neu van thieu thi
   nguyen nhan o cho khac (xem muc 4). */
SELECT LTRIM(RTRIM(Ten)) AS TenHangMuc,
       COUNT(*) AS SoDong,
       COUNT(DISTINCT ISNULL(CAST(DonGia AS NVARCHAR(50)), N'')) AS SoGiaKhac,
       COUNT(DISTINCT ISNULL(TenPhieu, N'')) AS SoBan,
       MIN(DonGia) AS GiaNhoNhat, MAX(DonGia) AS GiaLonNhat
FROM DonHangDonGiaInThe
WHERE DonHangID = @id AND LTRIM(RTRIM(ISNULL(Ten, N''))) <> N''
GROUP BY LTRIM(RTRIM(Ten))
ORDER BY SoDong DESC, TenHangMuc;

/* ---------- 3. DONG BI LOAI VI TEN RONG ----------
   O chon loai han dong co Ten rong. Co dong o day => nguoi dung khai gia ma QUEN dien ten. */
SELECT ID, ISNULL(TenPhieu, N'(ban khong ten)') AS Ban, Ten, DonGia
FROM DonHangDonGiaInThe
WHERE DonHangID = @id AND LTRIM(RTRIM(ISNULL(Ten, N''))) = N'';

/* ---------- 4. DANH SACH O CHON SE HIEN (ban v8.75) ----------
   So dong o day = so lua chon nguoi dung thay. So sanh voi muc 1 de biet mat bao nhieu dong. */
SELECT x.Ten, x.DonGia
FROM (
  SELECT g.Ten, g.DonGia,
         ROW_NUMBER() OVER (PARTITION BY LTRIM(RTRIM(g.Ten))
                            ORDER BY ISNULL(g.TenPhieu, N''), g.ID) AS rn
  FROM DonHangDonGiaInThe g
  WHERE g.DonHangID = @id AND LTRIM(RTRIM(ISNULL(g.Ten, N''))) <> N''
) x WHERE x.rn = 1 ORDER BY x.Ten;

/* ---------- 5. Cac dong GIAO IN THEU da ghi cua lenh ---------- */
SELECT it.ID, ncc.TenNha, it.HangMucInThe, it.SoLuongGiao, it.SoLuongNhan
FROM DonHangNhaInTheu it
LEFT JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = it.NhaInID
WHERE it.DonHangID = @id ORDER BY it.ID;
