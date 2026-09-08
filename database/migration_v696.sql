/* ================================================================================================
   migration_v696.sql   (v7.81)
   KHACH HANG DONG THOI LA NHA CUNG CAP  ->  theo doi cong no CHUNG (2 chieu)

   Co doi tac vua MUA cua minh (ho no minh - phai thu) vua BAN cho minh (minh no ho - phai tra).
   Truoc day hai chieu nam o hai danh muc va hai so tach roi, khong nhin duoc tong the.

   CACH GHEP (Nguyen chot): KHAI TAY MOT LAN — trong Danh muc nha cung cap chon dung ten khach hang
   tuong ung. Khong tu khop theo ten: ten lech mot dau cach hay viet tat khac la khong nhan ra, ma
   trung ten ngau nhien thi GHEP NHAM TIEN cua hai doi tac khac nhau.

   ⚠️ CHI THEM MOT COT LIEN KET. Khong gop hai bang danh muc, khong dong bo ten, khong dong vao bat ky
   so lieu tien nao dang co: hai so cong no hien tai (khach / NCC) va ban in So ke toan giu NGUYEN.
   Bang cong no 2 chieu chi la mot cach XEM gop lai tu chinh hai nguon do.

   Idempotent — chay lai nhieu lan khong loi.
   ================================================================================================ */
IF DB_NAME() <> N'QLNoiBo'
BEGIN
    RAISERROR (N'!! DANG KHONG O DATABASE QLNoiBo. Chon dung database roi chay lai.', 20, 1) WITH LOG;
    SET NOEXEC ON;
END
GO

IF COL_LENGTH('NhaCungCap', 'KhachHangID') IS NULL
BEGIN
  ALTER TABLE NhaCungCap ADD KhachHangID INT NULL;
  PRINT '  + NhaCungCap.KhachHangID (de trong = nha cung cap thuan tuy)';
END
ELSE PRINT '  = NhaCungCap.KhachHangID da co';
GO

/* Khoa ngoai: khong cho tro toi mot khach hang khong ton tai. KHONG dat ON DELETE CASCADE — xoa mot
   khach hang khong duoc phep keo theo viec xoa nha cung cap (hai thuc the khac nhau). */
IF COL_LENGTH('NhaCungCap', 'KhachHangID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_NhaCungCap_KhachHang')
BEGIN
  ALTER TABLE NhaCungCap WITH NOCHECK
    ADD CONSTRAINT FK_NhaCungCap_KhachHang FOREIGN KEY (KhachHangID) REFERENCES KhachHang(KhachHangID);
  PRINT '  + Khoa ngoai FK_NhaCungCap_KhachHang';
END
ELSE PRINT '  = Khoa ngoai FK_NhaCungCap_KhachHang da co';
GO

/* MOT khach hang chi duoc ghep voi MOT nha cung cap. Ghep hai NCC vao cung mot khach la cong no
   2 chieu dem tien phai tra HAI LAN — chan ngay o CSDL, dung de phat hien luc doi chieu.
   Chi so loc (WHERE ... IS NOT NULL) nen cac NCC chua ghep van de trong thoai mai. */
IF COL_LENGTH('NhaCungCap', 'KhachHangID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_NhaCungCap_KhachHangID')
BEGIN
  IF EXISTS (SELECT KhachHangID FROM NhaCungCap WHERE KhachHangID IS NOT NULL
             GROUP BY KhachHangID HAVING COUNT(*) > 1)
  BEGIN
    PRINT '  !! CO KHACH HANG DANG BI GHEP VOI NHIEU HON MOT NHA CUNG CAP:';
    SELECT kh.KhachHangID, kh.TenKhachHang, COUNT(*) AS SoNCCDangGhep,
           STUFF((SELECT N', ' + n2.TenNCC FROM NhaCungCap n2
                  WHERE n2.KhachHangID = ncc.KhachHangID FOR XML PATH('')), 1, 2, '') AS DanhSachNCC
    FROM NhaCungCap ncc JOIN KhachHang kh ON kh.KhachHangID = ncc.KhachHangID
    WHERE ncc.KhachHangID IS NOT NULL
    GROUP BY ncc.KhachHangID, kh.KhachHangID, kh.TenKhachHang
    HAVING COUNT(*) > 1;
    PRINT '  -> Go bot cho chi con 1 NCC / 1 khach roi chay lai migration nay.';
  END
  ELSE
  BEGIN
    CREATE UNIQUE INDEX UQ_NhaCungCap_KhachHangID ON NhaCungCap(KhachHangID)
      WHERE KhachHangID IS NOT NULL;
    PRINT '  + Chi so duy nhat UQ_NhaCungCap_KhachHangID (1 khach <-> toi da 1 NCC)';
  END
END
ELSE PRINT '  = Chi so UQ_NhaCungCap_KhachHangID da co (hoac chua co cot)';
GO

PRINT '';
PRINT '=== migration_v696 XONG ===';
PRINT 'Khai ghep o: Danh muc -> Nha cung cap -> o "Dong thoi la khach hang".';
PRINT 'PHAI pm2 restart qlnoibo (sua routes/danhmuc.js + congno.js + utils/congNoDoiTac.js) + Ctrl+F5.';
PRINT '';
