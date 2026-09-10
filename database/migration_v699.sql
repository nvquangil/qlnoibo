/* ================================================================================================
   migration_v699.sql   (v7.98)
   DINH LUONG VAI o CHI DINH VAI SX  ->  ChiDinhVaiSX.SoDoID / SoLop / PhanTramHaoHut

   Nguyen: "phan chi dinh vai san xuat them chuc nang tinh dinh luong vai gom: (chieu dai so do +
   0.03) x so lop x 2% hao hut. chieu dai so do lay tu cong doan ky thuat. so lop nhap tay."

   CONG THUC (da chot voi Nguyen):
       Met co ban = (DonHangChiTietSoDo.MetSoDoDai + 0.03) x SoLop
       Hao hut    = Met co ban x PhanTramHaoHut%
       TONG met   = Met co ban x (1 + PhanTramHaoHut/100)      <-- ghi vao ChiDinhVaiSX.SoMet
   0.03 la MET (3cm dau ban moi lop), khong phai cm. PhanTramHaoHut mac dinh 2.

   VI SAO PHAI LUU 3 COT NAY chu khong chi luu ket qua.
   Ket qua cuoi cung da co cho de: cot SoMet san co (nut "Ap dung" ghi thang vao do — mot nghiep vu
   mot luong so lieu, phieu xuat vai van doc dung 1 cho nhu cu). Nhung neu CHI luu SoMet thi:
     - khong ai kiem lai duoc con so 533.46 tu dau ra;
     - doi so lop / doi so do phai nho lai bang dau roi go lai tu con so 0;
     - khong phan biet duoc "533.46 do may tinh" voi "533.46 do nguoi go tay" (go tay VAN duoc phep —
       o SoMet la go tu do, dinh luong chi la cong cu tinh ho).
   Luu dau vao thi tinh lai duoc bat ky luc nao.

   SoDoID co FK toi DonHangChiTietSoDo(ID) — GIONG y TienDoSanXuat.SoDoID da co tu migration_v513,
   nen mo hinh tham chieu so do trong he thong chi co MOT kieu.
   ⚠️ Hau qua: xoa 1 dong so do dang co chi dinh tro vao se bi CHAN. Route DELETE /sodo/:id da duoc
   bo sung loi bao ro rang o v7.98 thay vi de SQL nem loi FK kho hieu.

   Tat ca NULL = chua dung dinh luong -> du lieu dang co KHONG doi hanh vi.
   Idempotent — chay lai nhieu lan khong loi.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('ChiDinhVaiSX', 'SoDoID') IS NULL
BEGIN
  ALTER TABLE ChiDinhVaiSX ADD SoDoID INT NULL
      FOREIGN KEY REFERENCES DonHangChiTietSoDo(ID);
  PRINT '  + ChiDinhVaiSX.SoDoID (so do lay chieu dai — NULL = chua dung dinh luong)';
END
ELSE PRINT '  = ChiDinhVaiSX.SoDoID da co';
GO

IF COL_LENGTH('ChiDinhVaiSX', 'SoLop') IS NULL
BEGIN
  ALTER TABLE ChiDinhVaiSX ADD SoLop DECIMAL(10,2) NULL;
  PRINT '  + ChiDinhVaiSX.SoLop (so lop trai vai — nhap tay)';
END
ELSE PRINT '  = ChiDinhVaiSX.SoLop da co';
GO

IF COL_LENGTH('ChiDinhVaiSX', 'PhanTramHaoHut') IS NULL
BEGIN
  ALTER TABLE ChiDinhVaiSX ADD PhanTramHaoHut DECIMAL(6,2) NULL;
  PRINT '  + ChiDinhVaiSX.PhanTramHaoHut (mac dinh form dien 2)';
END
ELSE PRINT '  = ChiDinhVaiSX.PhanTramHaoHut da co';
GO

/* ------------------------------------------------------------------------------------------------
   KIEU = 'Phu' (vai phu) — KHONG can ALTER.
   ChiDinhVaiSX.Kieu la NVARCHAR(10) NOT NULL DEFAULT N'Chinh' va KHONG co CHECK constraint, nen
   N'Phu' vua du cho. Phan phai sua nam o TANG CODE, khong o CSDL:
     1) routes/qlsx.js  PUT /chidinhvaisx  — ep nhi phan `it.kieu === 'Phối' ? 'Phối' : 'Chính'`
     2) routes/khovai.js GET (4 cot tong)  — WHERE Kieu = N'Chính' / N'Phối' bo sot 'Phụ'
     3) frontend module.qlsx.js            — <select class="cdv-kieu"> chi co 2 option
     4) frontend module.khovai.js          — co `coChiDinh` + dong hien thi chi cong 2 kieu
   Ca 4 cho da sua trong v7.98. Ghi lai o day de lan sau them kieu thu tu con biet phai sua dau.
   ------------------------------------------------------------------------------------------------ */

PRINT '';
PRINT '=== migration_v699 XONG ===';
PRINT 'Cach dung: Quan ly san xuat -> Chi dinh vai SX -> mo 1 lenh -> moi dong co dai "Dinh luong":';
PRINT '  chon So do (Ky thuat da khai) + go So lop + % hao hut -> bam "= Ap dung" de ghi vao cot met.';
PRINT 'Chieu dai so do khai o cong doan Ky thuat (Ghi tien do -> Ky thuat -> So do), cot "Met so do dai".';
PRINT 'PHAI pm2 restart qlnoibo (sua routes/qlsx.js + routes/khovai.js) + Ctrl+F5.';
PRINT '';
