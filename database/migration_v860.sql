/* ================================================================================================
   MIGRATION v8.60 - DON GIA KHAC NHAU THEO DAI SIZE

   Nguyen xac nhan 2026-10-01: "don gia khac theo dai".
   Tuc may / gia cong / in theu DAI LON va DAI NHO co don gia KHAC NHAU, khong dung chung mot gia.

   Bo sung cho migration_v859.sql (bang DonHangDaiSize + 4 cot DaiSizeID o cac bang SO LUONG).
   File nay them chieu dai size vao 3 bang DON GIA.

   ------------------------------------------------------------------------------------------------
   QUY TAC TRA DON GIA (tang ung dung se lam dung thu tu nay):
     1. Co dong don gia khop DUNG dai dang xet  -> lay dong do.
     2. Khong co    -> lay dong co DaiSizeID = NULL (nghia la "ap cho moi dai").
     3. Khong co nua -> THIEU DON GIA: tra 0 kem co bao thieu.
        ⚠️ TUYET DOI khong lay bua don gia cua mot dai khac. Day la quy tac da co san trong
        backend/utils/luongGiaCongInThe.js: "CO Y khong lay tong thay the: lay tong luc do se ra
        mot so SAI ma khong ai biet". Lay nham gia cua dai khac cung chinh la loi do.

   ------------------------------------------------------------------------------------------------
   VI SAO KHONG DUNG CO CHE "NHIEU BAN" (TenPhieu) CO SAN, MA PHAI THEM COT:
   Ba bang nay deu da co cot TenPhieu (v5.56/v6.51) va co the dat ten ban = ten dai ("2-7", "8-12").
   KHONG LAM THE, vi 2 ly do deu dan toi SAI SO AM THAM:
     - TenPhieu la chu TU DO, khong co rang buoc nao noi no voi DonHangDaiSize.ID. Doi ten dai
       o mot cho la dut lien ket, khong co loi nao bao.
     - Nhieu cho trong code dang lay "ban DAU TIEN" theo MIN(TenPhieu) / ORDER BY TenPhieu (xem
       loadGiaCong, loadInThe, GET /orders/:maDH/dongiacongdoanmay). Neu ban = dai thi cac cho do
       se lay gia cua MOT dai roi ap cho MOI dai.

   ------------------------------------------------------------------------------------------------
   AN TOAN / TUONG THICH NGUOC:
   Moi cot deu NULL, khong DEFAULT, khong backfill. Toan bo dong don gia hien co se co
   DaiSizeID = NULL, tuc "ap cho moi dai" - dung y nghia hom nay. Khong mot con so tien nao doi
   cho toi khi nguoi dung CHU DONG tao dong don gia rieng cho tung dai.

   Khoa ngoai de NO ACTION (mac dinh): xoa mot dai dang co dong don gia rieng se bi DB chan;
   tang ung dung phai kiem truoc va bao bang tieng nguoi (bai hoc v8.55).

   CHAY 1 LAN, SAU migration_v859.sql. Chay xong PHAI pm2 restart qlnoibo.
   ================================================================================================ */

IF OBJECT_ID('DonHangDaiSize') IS NULL
BEGIN
    RAISERROR(N'DUNG: chua co bang DonHangDaiSize. Chay migration_v859.sql TRUOC.', 16, 1);
END
GO

/* ---------- 1. Don gia CONG DOAN MAY theo dai ----------
   Luong khoan may: PhanCongMay.DonGiaCongDoanMayID da tro THANG vao mot dong don gia cu the, nen
   khi moi dai co dong don gia rieng thi con tro do DA MANG san thong tin dai.
   => loadLuongKhoanMay() KHONG phai doi cong thuc. Chi form giao viec may phai cho chon dung dong. */
IF COL_LENGTH('DonHangDonGiaCongDoanMay', 'DaiSizeID') IS NULL
BEGIN
    ALTER TABLE DonHangDonGiaCongDoanMay ADD DaiSizeID INT NULL
        FOREIGN KEY REFERENCES DonHangDaiSize(ID);
    PRINT N'Da them cot DonHangDonGiaCongDoanMay.DaiSizeID.';
END ELSE PRINT N'Cot DonHangDonGiaCongDoanMay.DaiSizeID da ton tai, bo qua.';
GO

/* ---------- 2. Don gia HANG MUC GIA CONG theo dai ----------
   ⚠️ Bang nay nuoi CA Bang luong gia cong LAN So cong no nha gia cong (dung chung
   backend/utils/luongGiaCongInThe.js tu v7.53).
   Rang buoc UNIQUE(DonHangID, HangMucGiaCongID) cu DA BI GO tu migration_v651.sql, nen mot don
   duoc phep co NHIEU dong cho cung mot hang muc - dung cai ta can de moi dai mot dong. */
IF COL_LENGTH('DonHangHangMucGiaCong', 'DaiSizeID') IS NULL
BEGIN
    ALTER TABLE DonHangHangMucGiaCong ADD DaiSizeID INT NULL
        FOREIGN KEY REFERENCES DonHangDaiSize(ID);
    PRINT N'Da them cot DonHangHangMucGiaCong.DaiSizeID.';
END ELSE PRINT N'Cot DonHangHangMucGiaCong.DaiSizeID da ton tai, bo qua.';
GO

/* ---------- 3. Don gia IN THEU theo dai ---------- */
IF COL_LENGTH('DonHangDonGiaInThe', 'DaiSizeID') IS NULL
BEGIN
    ALTER TABLE DonHangDonGiaInThe ADD DaiSizeID INT NULL
        FOREIGN KEY REFERENCES DonHangDaiSize(ID);
    PRINT N'Da them cot DonHangDonGiaInThe.DaiSizeID.';
END ELSE PRINT N'Cot DonHangDonGiaInThe.DaiSizeID da ton tai, bo qua.';
GO

PRINT N'migration_v860.sql hoan tat. NHO: pm2 restart qlnoibo.';
GO

/* ================================================================================================
   KIEM TRA - chay file database/kiem_tra_v860.sql (file rieng, thuan ASCII, khong copy tu day ra).
   ================================================================================================ */
