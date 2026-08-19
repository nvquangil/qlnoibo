/* ================================================================
   migration_v516.sql - Nang cap tu v5.15 len v5.16

   Yeu cau lien quan schema (xem HUONG_DAN_CAI_DAT.md Buoc 2.21 cho toan bo
   9 muc cua dot nay, phan lon la thay doi frontend/backend logic thuan tuy,
   khong dong schema):

     Muc 2.2.1/2.2.2 - Cong doan "Cắt": khi don hang khai bao >= 2 dong "sơ đồ"
     (DonHangChiTietSoDo, xem migration_v513.sql), man hinh Ghi nhan tien do
     Cat gio tach thanh N form RIENG (1 form/so do) thay vi 1 form phang dung
     chung 1 o chon so do nhu truoc (v5.13). Nop 1 lan (1 nut "Gửi" duy nhat)
     se tao NHIEU ban ghi TienDoSanXuat - 1 ban ghi/so do CO du lieu nhap -
     thay vi CHI 1 ban ghi nhu truoc gio. De "Tổng số bàn cắt" (tham khao, xem
     getStageCayCount() trong qlsx.js) cong don DUNG qua ca N ban ghi nay (thay
     vi chi tinh rieng 1 ban ghi "moi nhat" nhu quy uoc cu, se bi thieu neu chi
     tinh 1/N ban ghi), can 1 cot MOI de "danh dau" cac ban ghi nay thuoc CUNG
     1 lan nop - xem TienDoSanXuat.NhomTienDoID duoi day.

   An toan chay lai nhieu lan (idempotent) - dung IF COL_LENGTH/sys.indexes
   giong cac migration truoc (vd migration_v58.sql, migration_v513.sql).
   ================================================================ */

-- ============ TienDoSanXuat.NhomTienDoID ============
-- NULL cho MOI ban ghi tu truoc gio (submission "1-form-1-ban-ghi" nhu cu,
-- van la truong hop pho bien nhat - don hang chi co 0/1 so do). CHI duoc set
-- (bang chinh TienDoID cua ban ghi DAU TIEN trong lan nop) khi 1 lan Gửi tao
-- ra >= 2 ban ghi cung luc (don hang co >= 2 so do) - xem POST
-- /orders/:maDH/tiendo trong qlsx.js. Tu tham chieu (self-FK) vi luon tro toi
-- 1 TienDoID KHAC (hoac chinh no) DA TON TAI trong CUNG bang, dam bao toan
-- ven du lieu ma khong can bang phu.
IF COL_LENGTH('TienDoSanXuat', 'NhomTienDoID') IS NULL
BEGIN
    ALTER TABLE TienDoSanXuat ADD NhomTienDoID INT NULL FOREIGN KEY REFERENCES TienDoSanXuat(TienDoID);
    PRINT 'Da them cot TienDoSanXuat.NhomTienDoID.';
END ELSE PRINT 'Cot TienDoSanXuat.NhomTienDoID da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TienDoSanXuat_NhomTienDoID')
    CREATE INDEX IX_TienDoSanXuat_NhomTienDoID ON TienDoSanXuat(NhomTienDoID) WHERE NhomTienDoID IS NOT NULL;
GO
