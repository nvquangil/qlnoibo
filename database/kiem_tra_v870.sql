/* ================================================================
   KIEM TRA SAU KHI CHAY migration_v870.sql
   File nay CHI DOC, khong sua gi. Chay ca file (F5).
   Thuan ASCII - khong emoji, khong gach dai, khong dau tieng Viet.
   ================================================================ */

USE QLNoiBo;
GO

/* (a) Phai ra 3 dong, cot Trang_thai deu la OK */
SELECT 'Bang ChuongTrinhKhuyenMai' AS Doi_tuong,
       CASE WHEN OBJECT_ID('ChuongTrinhKhuyenMai') IS NULL THEN 'THIEU' ELSE 'OK' END AS Trang_thai
UNION ALL SELECT 'Bang ChuongTrinhKhuyenMaiChiTiet',
       CASE WHEN OBJECT_ID('ChuongTrinhKhuyenMaiChiTiet') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL SELECT 'PhieuBanHangChiTiet.ChuongTrinhID',
       CASE WHEN COL_LENGTH('PhieuBanHangChiTiet', 'ChuongTrinhID') IS NULL THEN 'THIEU' ELSE 'OK' END;
GO

/* (b) Phai ra 0 - chua tao chuong trinh nao, chua phieu nao gan chuong trinh.
       Dong nay chung minh KHONG MOT PHIEU CU NAO BI DOI. */
SELECT 'ChuongTrinhKhuyenMai'      AS Bang, COUNT(*) AS SoDong FROM ChuongTrinhKhuyenMai
UNION ALL SELECT 'ChuongTrinhKhuyenMaiChiTiet', COUNT(*) FROM ChuongTrinhKhuyenMaiChiTiet
UNION ALL SELECT 'Dong phieu ban hang da gan chuong trinh',
       COUNT(*) FROM PhieuBanHangChiTiet WHERE ChuongTrinhID IS NOT NULL;
GO

/* (c) Ty le CK dung chung dang la bao nhieu - de doi chieu khi khai chuong trinh.
       Chuong trinh se THAY THE con so nay cho cac ma duoc gan. */
SELECT ConfigKey, ConfigValue FROM CauHinhHeThong WHERE ConfigKey IN ('CK_SHOP', 'CK_NPP');
GO
