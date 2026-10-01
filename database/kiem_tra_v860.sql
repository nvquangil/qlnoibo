/* ================================================================
   KIEM TRA SAU KHI CHAY migration_v859.sql VA migration_v860.sql
   File nay CHI DOC, khong sua gi. Chay ca file (F5), khong can boi den.
   Thuan ASCII - khong emoji, khong gach dai, khong dau tieng Viet.
   ================================================================ */

USE QLNoiBo;
GO

/* (a) Phai ra 8 dong, cot Trang_thai deu la OK */
SELECT 'v859 Bang DonHangDaiSize' AS Doi_tuong,
       CASE WHEN OBJECT_ID('DonHangDaiSize') IS NULL THEN 'THIEU' ELSE 'OK' END AS Trang_thai
UNION ALL SELECT 'v859 TienDoChiTietMau.DaiSizeID',
       CASE WHEN COL_LENGTH('TienDoChiTietMau', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL SELECT 'v859 PhanCongMay.DaiSizeID',
       CASE WHEN COL_LENGTH('PhanCongMay', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL SELECT 'v859 DonHangChiTietNhaGiaCong.DaiSizeID',
       CASE WHEN COL_LENGTH('DonHangChiTietNhaGiaCong', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL SELECT 'v859 DonHangNhaInTheu.DaiSizeID',
       CASE WHEN COL_LENGTH('DonHangNhaInTheu', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL SELECT 'v860 DonHangDonGiaCongDoanMay.DaiSizeID',
       CASE WHEN COL_LENGTH('DonHangDonGiaCongDoanMay', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL SELECT 'v860 DonHangHangMucGiaCong.DaiSizeID',
       CASE WHEN COL_LENGTH('DonHangHangMucGiaCong', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END
UNION ALL SELECT 'v860 DonHangDonGiaInThe.DaiSizeID',
       CASE WHEN COL_LENGTH('DonHangDonGiaInThe', 'DaiSizeID') IS NULL THEN 'THIEU' ELSE 'OK' END;
GO

/* (b) Tat ca phai ra 0 - chua ai tach dai nen chua co dong nao gan dai.
       Dong don gia cu deu phai la DaiSizeID = NULL, tuc "ap cho moi dai",
       nghia la KHONG MOT CON SO TIEN NAO DOI so voi truoc khi nang cap. */
SELECT 'TienDoChiTietMau'          AS Bang, COUNT(*) AS SoDongDaGanDai FROM TienDoChiTietMau          WHERE DaiSizeID IS NOT NULL
UNION ALL SELECT 'PhanCongMay',               COUNT(*) FROM PhanCongMay               WHERE DaiSizeID IS NOT NULL
UNION ALL SELECT 'DonHangChiTietNhaGiaCong',  COUNT(*) FROM DonHangChiTietNhaGiaCong  WHERE DaiSizeID IS NOT NULL
UNION ALL SELECT 'DonHangNhaInTheu',          COUNT(*) FROM DonHangNhaInTheu          WHERE DaiSizeID IS NOT NULL
UNION ALL SELECT 'DonHangDonGiaCongDoanMay',  COUNT(*) FROM DonHangDonGiaCongDoanMay  WHERE DaiSizeID IS NOT NULL
UNION ALL SELECT 'DonHangHangMucGiaCong',     COUNT(*) FROM DonHangHangMucGiaCong     WHERE DaiSizeID IS NOT NULL
UNION ALL SELECT 'DonHangDonGiaInThe',        COUNT(*) FROM DonHangDonGiaInThe        WHERE DaiSizeID IS NOT NULL;
GO

/* (c) Phai ra 0 dong - bang dai size con rong */
SELECT * FROM DonHangDaiSize;
GO
