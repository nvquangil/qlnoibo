/* ================================================================================================
   migration_v678.sql   (v6.68)
   CAU HINH RIENG CUA TUNG NGUOI DUNG - dung dau tien cho "khach theo doi tren dashboard".

   VI SAO KHONG DE localStorage NUA (v6.67 dang de o do):
     localStorage gan voi TUNG TRINH DUYET TREN TUNG MAY. Doi may, doi trinh duyet, xoa cache hay
     dung che do an danh la danh sach bien mat -> nguoi dung phai chon lai. Yeu cau la "chi chon 1
     lan", nen phai luu theo TAI KHOAN o may chu.

   Bang dung CHUNG cho moi cau hinh ca nhan ve sau (khoa tu do), khong phai moi thu lai them 1 bang:
     Khoa = 'dashboard_khach_theo_doi'  ->  GiaTri = JSON mang ten khach
   ================================================================================================ */

IF OBJECT_ID('CauHinhNguoiDung', 'U') IS NULL
BEGIN
  CREATE TABLE CauHinhNguoiDung (
    UserID    INT           NOT NULL,
    Khoa      NVARCHAR(60)  NOT NULL,
    GiaTri    NVARCHAR(MAX) NULL,          -- luu JSON cho linh hoat
    UpdatedAt DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT PK_CauHinhNguoiDung PRIMARY KEY (UserID, Khoa),
    CONSTRAINT FK_CauHinhNguoiDung_User FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
  );
  PRINT '  + Da tao bang CauHinhNguoiDung';
END
ELSE PRINT '  = CauHinhNguoiDung da co, bo qua';
GO

PRINT '';
PRINT '=== migration_v678 XONG ===';
PRINT 'Dashboard: danh sach khach theo doi nay luu theo TAI KHOAN, chon 1 lan la xong,';
PRINT 'dang nhap o may nao cung thay danh sach do.';
GO
