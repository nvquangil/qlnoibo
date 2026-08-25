/* ================================================================================================
   migration_v689.sql   (v7.45)
   THONG TIN XUAT HOA DON cua KHACH HANG  ->  de hoa don GTGT tu dien duoc, khong go tay

   VAN DE: bang `KhachHang` chi co TenKhachHang / DiaChi / SDT / Email / GhiChu. Khong co cho nao
   khai TEN PHAP NHAN va MA SO THUE, ma hoa don GTGT thi bat buoc phai co hai thu do.
   Thuc te ke toan da go MST vao O EMAIL ("MST: 0123456789") vi khong con cho nao khac -> xuat hoa
   don ra thi cot Email chua chuoi "MST: ..." con cot Ma so thue thi trong. Sai o hai cot mot luc.

   Ten tren danh muc va ten tren hoa don THUONG KHAC NHAU va deu can giu:
     · TenKhachHang = ten GOI HANG NGAY ("NPP Vinh Phuc - A Chung") — la KHOA GOM CONG NO
       (congno.js GROUP BY LTRIM(RTRIM(TenKhach))), doi la lech cong no -> KHONG duoc dung cho hoa don.
     · TenHoaDon    = ten PHAP NHAN tren hoa don ("Cong ty TNHH Thuong mai ABC").
   Vi vay them cot rieng thay vi sua cot cu.

   Dia chi cung tach: DiaChi la dia chi GIAO HANG, DiaChiHoaDon la dia chi tren giay to.
   EmailHoaDon: cho email nhan hoa don dien tu (thuong la mail ke toan, khac mail lien lac).

   TAT CA DEU NULL: chua khai thi hoa don tu lui ve dung du lieu cu (TenKhach cua phieu / DiaChi),
   khong bat ai phai nhap lai gi de he thong chay tiep.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('KhachHang', 'TenHoaDon') IS NULL
BEGIN
  ALTER TABLE KhachHang ADD TenHoaDon NVARCHAR(255) NULL;
  PRINT '  + KhachHang.TenHoaDon (ten phap nhan de viet hoa don)';
END
ELSE PRINT '  = KhachHang.TenHoaDon da co';
GO

IF COL_LENGTH('KhachHang', 'MaSoThue') IS NULL
BEGIN
  ALTER TABLE KhachHang ADD MaSoThue NVARCHAR(30) NULL;
  PRINT '  + KhachHang.MaSoThue';
END
ELSE PRINT '  = KhachHang.MaSoThue da co';
GO

IF COL_LENGTH('KhachHang', 'DiaChiHoaDon') IS NULL
BEGIN
  ALTER TABLE KhachHang ADD DiaChiHoaDon NVARCHAR(255) NULL;
  PRINT '  + KhachHang.DiaChiHoaDon';
END
ELSE PRINT '  = KhachHang.DiaChiHoaDon da co';
GO

IF COL_LENGTH('KhachHang', 'EmailHoaDon') IS NULL
BEGIN
  ALTER TABLE KhachHang ADD EmailHoaDon NVARCHAR(150) NULL;
  PRINT '  + KhachHang.EmailHoaDon (mail nhan hoa don dien tu)';
END
ELSE PRINT '  = KhachHang.EmailHoaDon da co';
GO

/* ------------------------------------------------------------------------------------------------
   DON DU LIEU CU: keo MST da bi go lan vao o Email / Ghi chu ra dung cot MaSoThue.
   Chi nhan khi CO NHAN ro rang ("MST"/"Mã số thuế"/"Tax") HOAC ca o chi la 10 chu so — de khong
   nham so dien thoai (cung 10 so) thanh ma so thue.
   Neu o Email chi chua MST (khong phai email) thi XOA o Email luon, vi de lai la hoa don van dien
   sai cot mot lan nua.
   ------------------------------------------------------------------------------------------------ */
IF COL_LENGTH('KhachHang', 'MaSoThue') IS NOT NULL
BEGIN
  /* a) Email/GhiChu la DAY SO 10 chu so tron -> chinh la MST */
  UPDATE KhachHang SET MaSoThue = LTRIM(RTRIM(Email))
  WHERE MaSoThue IS NULL AND LTRIM(RTRIM(ISNULL(Email, ''))) LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
  PRINT '  + MST lay tu o Email (day so tron): ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' khach';

  UPDATE KhachHang SET MaSoThue = LTRIM(RTRIM(GhiChu))
  WHERE MaSoThue IS NULL AND LTRIM(RTRIM(ISNULL(GhiChu, ''))) LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]';
  PRINT '  + MST lay tu o Ghi chu (day so tron): ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' khach';

  /* b) Co nhan "MST" -> cat 10 chu so ngay sau dau ':' (dang "MST: 0123456789") */
  UPDATE KhachHang
     SET MaSoThue = SUBSTRING(Email, PATINDEX('%[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%', Email), 10)
   WHERE MaSoThue IS NULL AND Email LIKE '%MST%'
     AND PATINDEX('%[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%', Email) > 0
     /* 11 chu so lien nhau = go sai/thua -> BO QUA, de ke toan go tay. Cat 10 so dau se ra mot MST
        sai ma trong "hop le", khong ai phat hien. */
     AND PATINDEX('%[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%', Email) = 0;
  PRINT '  + MST tach tu o Email co nhan "MST": ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' khach';

  UPDATE KhachHang
     SET MaSoThue = SUBSTRING(GhiChu, PATINDEX('%[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%', GhiChu), 10)
   WHERE MaSoThue IS NULL AND GhiChu LIKE '%MST%'
     AND PATINDEX('%[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%', GhiChu) > 0
     AND PATINDEX('%[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%', GhiChu) = 0;
  PRINT '  + MST tach tu o Ghi chu co nhan "MST": ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' khach';

  /* c) O Email khong phai email (khong co '@') va da lay duoc MST -> xoa cho khoi dien sai cot */
  UPDATE KhachHang SET Email = NULL
   WHERE MaSoThue IS NOT NULL AND Email IS NOT NULL AND CHARINDEX('@', Email) = 0;
  PRINT '  + Da don o Email khong phai email: ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' khach';
END
GO

PRINT '';
PRINT '=== migration_v689 XONG ===';
PRINT 'PHAI pm2 restart qlnoibo (sua backend/routes/danhmuc.js + banhang.js).';
PRINT 'Vao Danh muc -> Khach hang khai: Ten viet hoa don / Ma so thue / Dia chi hoa don / Email hoa don.';
PRINT 'De trong o nao thi hoa don tu lay du lieu cu: ten khach cua phieu, dia chi cua phieu.';
GO
