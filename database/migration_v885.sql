/* ================================================================================================
   MIGRATION v8.85 (app v9.23) — TACH THEO "MAU" (bien the) MA VAN CHUNG MOT DAI SIZE

   Yeu cau Nguyen (2026-11-05): *"Mot so lenh san xuat toi muon tach lam 2 mau tu khau cat nhung van
   cung dai size"* — vi du da nghe: *"lenh ra ao coc size 2-7, ghi chu mau 1 in cho, mau 2 in tho"*.
   Chot qua hoi dap:
     · Hai "mau" = hai BIEN THE cua cung san pham (khac hinh in), CUNG bo size.
     · VAI CAT CHUNG mot ban — so cat GIU NGUYEN, khong tach.
     · Tu cac cong doan sau (May/QC/Dong goi/Kho nhap/In theu/Gia cong): moi MAU hien 2 DONG,
       moi mau mot dong.

   ⚠️ VI SAO KHONG TAO BANG MOI: cau truc "nhieu dong theo mot chieu phu" DA CO SAN tu v8.59
   (DonHangDaiSize + cot DaiSizeID o 4 bang tien do + 3 bang don gia v8.60). Them bang thu hai la
   phai nhan doi moi cho no dong (dongNhapList, slTheoMauDai, gate in theu/gia cong, bang ke, luong
   gia cong...). Nen chi them MOT COT NHAN LOAI vao chinh bang do.

   KHAC BIET DUY NHAT giua hai kieu nam o RANG BUOC HE SO (tang ung dung kiem, khong phai CHECK o DB
   vi he so doi chieu nam o BANG KHAC — so cat):
     · LoaiTach = 'DAI' (mac dinh, nhu cu): TONG he so cac dong = he so hieu luc.
         2-7 (6) + 8-12 (5) = 11   -> mot lop cat ra 11 cai, chia lam hai dai.
     · LoaiTach = 'MAU' (moi): MOI dong mang DUNG he so hieu luc (khong cong don).
         "Mau 1 in cho" (6) va "Mau 2 in tho" (6) -> ca hai cung dai 2-7, cung 6 cai/ri.
       Vai cat chung nen SL tu Cat cua moi dong = SL CA MAU; man hinh phai ghi ro dieu do.

   AN TOAN: cot co DEFAULT N'DAI' va backfill cho dong cu -> moi lenh dang tach dai giu nguyen hanh
   vi. Khong xoa, khong sua du lieu nao khac. Lui lai duoc bang ALTER TABLE ... DROP COLUMN LoaiTach.

   CHAY 1 LAN. Neu pm2 dang chay thi PHAI restart lai sau khi chay migration.
   ================================================================================================ */

IF COL_LENGTH('DonHangDaiSize', 'LoaiTach') IS NULL
BEGIN
    ALTER TABLE DonHangDaiSize ADD LoaiTach NVARCHAR(10) NOT NULL
        CONSTRAINT DF_DonHangDaiSize_LoaiTach DEFAULT N'DAI';
    PRINT N'Da them cot DonHangDaiSize.LoaiTach (mac dinh DAI).';
END ELSE PRINT N'Cot DonHangDaiSize.LoaiTach da ton tai, bo qua.';
GO

/* Dong cu (neu co dong nao NULL do duoc them truoc bang duong khac) -> ve DAI. */
UPDATE DonHangDaiSize SET LoaiTach = N'DAI'
 WHERE LoaiTach IS NULL OR LTRIM(RTRIM(LoaiTach)) = N'';
GO

/* Chi nhan hai gia tri. CHECK nay an toan vi chi nhin MOT cot cua CHINH bang nay. */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_DonHangDaiSize_LoaiTach')
BEGIN
    ALTER TABLE DonHangDaiSize WITH CHECK
        ADD CONSTRAINT CK_DonHangDaiSize_LoaiTach CHECK (LoaiTach IN (N'DAI', N'MAU'));
    PRINT N'Da them CHECK CK_DonHangDaiSize_LoaiTach.';
END ELSE PRINT N'CHECK CK_DonHangDaiSize_LoaiTach da ton tai, bo qua.';
GO

PRINT N'migration_v885.sql hoan tat. NHO: pm2 restart qlnoibo.';
GO

/* ================================================================================================
   KIEM TRA SAU KHI CHAY:

   -- (a) Phai ra OK
   SELECT CASE WHEN COL_LENGTH('DonHangDaiSize','LoaiTach') IS NULL THEN N'THIEU' ELSE N'OK' END AS Cot_LoaiTach;

   -- (b) Moi dong cu phai la DAI (khong dong nao thanh MAU ngoai y muon)
   SELECT LoaiTach, COUNT(*) AS SoDong FROM DonHangDaiSize GROUP BY LoaiTach;
   ================================================================================================ */
