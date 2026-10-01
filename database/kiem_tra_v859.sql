/* ================================================================
   KIEM TRA SAU KHI CHAY migration_v859.sql
   File nay CHI DOC, khong sua gi. Chay ca file (F5), khong can boi den.
   Co y viet THUAN ASCII: khong emoji, khong gach dai, khong dau tieng Viet
   - de loai han rui ro loi ma hoa khi SSMS mo file bang ANSI thay vi UTF-8.
   ================================================================ */

USE QLNoiBo;
GO

/* (a) Phai ra 5 dong, cot Trang_thai deu la OK */
SELECT 'Bang DonHangDaiSize' AS Doi_tuong,
       CASE WHEN OBJECT_ID('DonHangDaiSize') IS NULL THEN 'THIEU' ELSE 'OK' END AS Trang_thai
UNION ALL
SELECT 'TienDoChiTietMau.DaiSizeID',
       CASE WHEN COL_LENGTH('TienDoChiTietMau', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL
SELECT 'PhanCongMay.DaiSizeID',
       CASE WHEN COL_LENGTH('PhanCongMay', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL
SELECT 'DonHangChiTietNhaGiaCong.DaiSizeID',
       CASE WHEN COL_LENGTH('DonHangChiTietNhaGiaCong', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL
SELECT 'DonHangNhaInTheu.DaiSizeID',
       CASE WHEN COL_LENGTH('DonHangNhaInTheu', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END;
GO

/* (b) Phai ra 0 - chua ai tach dai nen chua co dong tien do nao gan dai */
SELECT COUNT(*) AS SoDongTienDoDaGanDai
FROM TienDoChiTietMau
WHERE DaiSizeID IS NOT NULL;
GO

/* (c) Phai ra 0 dong - bang dai size vua tao nen con rong */
SELECT * FROM DonHangDaiSize;
GO
