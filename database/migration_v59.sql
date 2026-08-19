/* ================================================================
   migration_v59.sql - Nang cap tu v5.8 len v5.9

   Yeu cau: "Mã công đoạn" cho Công đoạn sản xuất — mở rộng thành sửa lại
   TOÀN BỘ các chỗ trong qlsx.js (và các file liên quan) đang so sánh trực
   tiếp theo TÊN công đoạn (renderStageFields, hằng số TEN_CONG_DOAN_MAY,
   các câu lệnh WHERE TenCongDoan=N'...') sang so sánh theo mã/StageID.

   v5.7 da them cot CongDoanSanXuat.MaCongDoan nhung CHI dung de hien
   thi/tra cuu trong Danh muc - chua khoa, chua duoc code dung cho logic
   that su (van con nguyen rui ro: doi TEN cong doan trong Danh muc lam
   gian doan luong Ghi nhan tien do, bao cao nang suat, phan quyen theo
   cong doan...).

   Dot nay (code da doi xong o backend/frontend, xem HUONG_DAN_CAI_DAT.md
   Buoc 2.13):
   1. Them CongDoanSanXuat.LaHeThong (BIT) - danh dau 8 cong doan HE THONG
      goc (Ky thuat/Giao vai/Phu kien/Cat/May/Hoan thien/Kho nhap/Dong goi).
      Cot nay la CHOT AN TOAN: neu MaCongDoan van tu do sua duoc nhu
      TenCongDoan truoc day thi coi nhu chi CHUYEN fragility sang cho khac,
      khong that su fix duoc gi - LaHeThong=1 se bi backend (xem
      backend/routes/danhmuc.js, PUT/DELETE /congdoan/:id) CHAN sua/xoa
      MaCongDoan cua chinh dong do.
   2. Backfill MaCongDoan canonical (KT/GV/PK/CAT/MAY/HT/KN/DG) + LaHeThong=1
      cho 8 cong doan he thong, khop theo TenCongDoan HIEN TAI. Neu 1 trong
      8 ten nay da bi doi TRUOC khi chay migration nay (vd ai do da sua
      "Cắt" thanh ten khac o ban v5.8 tro ve truoc), script se KHONG khop
      duoc dong do va se PRINT canh bao - can tu gan MaCongDoan/LaHeThong
      thu cong qua SSMS cho dung dong tuong ung (xem Buoc 2.13).
   3. Filtered unique index tren MaCongDoan (cho phep nhieu dong NULL - cac
      cong doan tuy chinh nguoi dung tu them sau nay chua chac co ma - nhung
      khong cho 2 dong CUNG 1 ma khac NULL, tranh nham lan).

   LUU Y PHAM VI: day la bang CongDoanSanXuat (cac CONG DOAN SAN XUAT /
   STAGE - Ky thuat, Cat, May...), KHAC voi bang CongDoanMay (danh muc CAC
   THAO TAC MAY - vd "Ráp cổ", "Vắt sổ" - da dung CongDoanMayID lam FK moi
   noi tu truoc, khong can sua gi them o dot nay).
   ================================================================ */

IF COL_LENGTH('CongDoanSanXuat', 'LaHeThong') IS NULL
BEGIN
    ALTER TABLE CongDoanSanXuat ADD LaHeThong BIT NOT NULL DEFAULT 0;
    PRINT 'Da them cot CongDoanSanXuat.LaHeThong.';
END ELSE PRINT 'Cot CongDoanSanXuat.LaHeThong da ton tai, bo qua.';
GO

-- Backfill ma cong doan canonical + khoa (LaHeThong=1) cho 8 cong doan he thong,
-- khop theo TEN HIEN TAI (dung nguyen ban tu schema.sql + migration_v52_qlsx.sql).
-- An toan chay lai nhieu lan (cung dieu kien, cung gia tri gan lai).
UPDATE CongDoanSanXuat SET MaCongDoan = 'KT',  LaHeThong = 1 WHERE TenCongDoan = N'Kỹ thuật';
UPDATE CongDoanSanXuat SET MaCongDoan = 'GV',  LaHeThong = 1 WHERE TenCongDoan = N'Giao vải';
UPDATE CongDoanSanXuat SET MaCongDoan = 'PK',  LaHeThong = 1 WHERE TenCongDoan = N'Phụ kiện';
UPDATE CongDoanSanXuat SET MaCongDoan = 'CAT', LaHeThong = 1 WHERE TenCongDoan = N'Cắt';
UPDATE CongDoanSanXuat SET MaCongDoan = 'MAY', LaHeThong = 1 WHERE TenCongDoan = N'May';
UPDATE CongDoanSanXuat SET MaCongDoan = 'HT',  LaHeThong = 1 WHERE TenCongDoan = N'Hoàn thiện';
UPDATE CongDoanSanXuat SET MaCongDoan = 'KN',  LaHeThong = 1 WHERE TenCongDoan = N'Kho nhập';
UPDATE CongDoanSanXuat SET MaCongDoan = 'DG',  LaHeThong = 1 WHERE TenCongDoan = N'Đóng gói';
GO

-- Canh bao neu khong du 8 dong duoc khoa (vd 1 ten da bi doi truoc khi nang cap) - KHONG chan migration,
-- chi in canh bao de nguoi trien khai tu kiem tra lai thu cong qua SSMS truoc khi coi nhu xong.
DECLARE @locked INT = (SELECT COUNT(*) FROM CongDoanSanXuat WHERE LaHeThong = 1);
IF @locked < 8
    PRINT 'CANH BAO: chi khoa duoc ' + CAST(@locked AS NVARCHAR) + '/8 cong doan he thong - kiem tra lai TenCongDoan cua Ky thuat/Giao vai/Phu kien/Cat/May/Hoan thien/Kho nhap/Dong goi co bi doi ten truoc khi nang cap khong (xem HUONG_DAN_CAI_DAT.md Buoc 2.13) va tu gan MaCongDoan + LaHeThong=1 thu cong cho dung dong qua SSMS neu can.';
ELSE
    PRINT 'Da khoa du 8/8 cong doan he thong voi ma tuong ung (KT/GV/PK/CAT/MAY/HT/KN/DG).';
GO

-- Filtered unique index: cho phep nhieu dong MaCongDoan = NULL (cong doan tuy chinh chua gan ma),
-- nhung khong cho 2 dong CUNG 1 ma khac NULL (tranh nham lan neu sau nay ai do vo tinh dat trung ma).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_CongDoanSanXuat_MaCongDoan')
BEGIN
    CREATE UNIQUE INDEX UQ_CongDoanSanXuat_MaCongDoan ON CongDoanSanXuat(MaCongDoan) WHERE MaCongDoan IS NOT NULL;
    PRINT 'Da them unique index UQ_CongDoanSanXuat_MaCongDoan.';
END ELSE PRINT 'Index UQ_CongDoanSanXuat_MaCongDoan da ton tai, bo qua.';
GO
