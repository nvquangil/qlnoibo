/* ==================================================================================================
   migration_v889.sql  (v9.38)  —  TY LE VAI CUA TUNG DAI SIZE

   Nguyen 2026-11-10: "Chi can ghi ty le size nay bao nhieu ty le size kia bao nhieu. Vi du tong
   size 2-12 la 2 met thi size 2-7 la bao nhieu size 8-12 la bao nhieu".

   🔴 VI SAO KHONG PHAI "MET SO DO TUNG SIZE" (ban nhap dau cua toi, Nguyen bac bo — va dung):
   Mot so do chay CHUNG, chi tiet cua moi size nam LAN LON tren cung mot la vai. Khong co cach nao
   do duoc "size 2-7 chiem bao nhieu met so do" — con so do khong ton tai trong thuc te. Dat ten cot
   theo mot dai luong khong do duoc la moi cho du lieu rac: nguoi dung se dien bua cho co.
   Nen cot nay la TY LE NGUOI DUNG TU KHAI, khong phai so do.

   DON VI TU DO, he thong chi lay TY LE: go 0.8 / 1.2 (met) hay 40 / 60 (phan tram) hay 4 / 6 deu ra
   cung ket qua 40% va 60%. Cong thuc: ty le cua dai = TyLeVai cua dai / TONG TyLeVai cac dai.

   🔴 VI SAO KHONG PHAI HE SO: `HeSo` la SO CAI trong mot ri. Chia vai theo so cai thi dai 2-7
   (he so 6) va 8-12 (he so 5) ra CUNG MOT so kg tren moi cai — tach dai xong khong biet them gi,
   trong khi ao size 12 ton vai hon size 2 ro ret.

   NULL duoc phep: chua khai thi LUI VE chia theo HeSo nhu truoc (tuong thich nguoc tuyet doi — moi
   lenh da tach tu truoc v9.38 giu nguyen moi con so).

   DECIMAL(10,4) chu KHONG phai INT: ty le co the la 0.8 hoac 1.25. Bai hoc `HeSo` INT o
   qlsx.js:2098-2101 (tedious parseInt IM LANG, 1.85 thanh 1) — khong lap lai o cot nay.

   🔴 CHAY TRUOC `pm2 restart qlnoibo`.
   An toan chay LAI nhieu lan. KHONG xoa, KHONG sua du lieu nghiep vu nao.
   ================================================================================================== */

SET NOCOUNT ON;
PRINT N'--- migration_v889: DonHangDaiSize.TyLeVai ---';

IF OBJECT_ID('DonHangDaiSize', 'U') IS NULL
BEGIN
    PRINT N'!! KHONG CO BANG DonHangDaiSize — chay migration_v859.sql truoc. Dung lai.';
END
ELSE
BEGIN
    IF COL_LENGTH('DonHangDaiSize', 'TyLeVai') IS NULL
    BEGIN
        ALTER TABLE DonHangDaiSize ADD TyLeVai DECIMAL(10,4) NULL;
        PRINT N'  + DonHangDaiSize.TyLeVai  (NULL = chua khai -> lui ve chia theo HeSo)';
    END
    ELSE PRINT N'  = Cot DonHangDaiSize.TyLeVai da ton tai, bo qua.';
END

PRINT N'--- migration_v889: XONG ---';
GO
