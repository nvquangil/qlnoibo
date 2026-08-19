/* ================================================================
   migration_v659.sql  (QLNoiBo v5.67)

   WEB PUSH NOTIFICATION — thông báo đẩy tới máy tính / điện thoại
   kể cả khi KHÔNG mở trang web.

   Bảng PushSubscription lưu "địa chỉ nhận thông báo" mà trình duyệt
   cấp cho từng THIẾT BỊ (endpoint + 2 khoá mã hoá). Một người dùng
   có thể có nhiều dòng (máy tính công ty, máy tính nhà, điện thoại).

   AN TOÀN: chỉ THÊM bảng mới, không đụng dữ liệu cũ. Chạy nhiều lần vô hại.
   ================================================================ */
USE QLNoiBo;
GO

IF DB_NAME() <> 'QLNoiBo'
BEGIN
    PRINT '*** SAI DATABASE: dang o [' + DB_NAME() + ']. Hay chon QLNoiBo roi chay lai. ***';
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.PushSubscription', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PushSubscription (
        PushID      INT IDENTITY(1,1) PRIMARY KEY,
        UserID      INT NOT NULL FOREIGN KEY REFERENCES Users(UserID) ON DELETE CASCADE,
        Endpoint    NVARCHAR(500) NOT NULL,   -- địa chỉ đẩy do trình duyệt cấp (dài, duy nhất/thiết bị)
        P256dh      NVARCHAR(200) NOT NULL,   -- khoá công khai của thiết bị
        Auth        NVARCHAR(100) NOT NULL,   -- khoá xác thực của thiết bị
        UserAgent   NVARCHAR(300) NULL,       -- để người dùng nhận ra "máy nào" khi cần gỡ
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        LanGuiCuoi  DATETIME2 NULL
    );
    -- Endpoint dài -> đánh index trên 200 ký tự đầu là đủ để tra cứu nhanh.
    CREATE UNIQUE INDEX UX_PushSubscription_Endpoint ON dbo.PushSubscription (Endpoint);
    CREATE INDEX IX_PushSubscription_User ON dbo.PushSubscription (UserID);
    PRINT '   + Da tao bang PushSubscription.';
END
ELSE
    PRINT '   = Bang PushSubscription da co tu truoc.';
GO

PRINT '';
PRINT '=== migration_v659.sql HOAN TAT ===';
PRINT 'Buoc tiep theo (xem HUONG_DAN_CAI_DAT.md BUOC 2.86):';
PRINT '   1) cd backend  &&  npm install web-push';
PRINT '   2) node utils/taoVapidKeys.js   -> dan 3 dong VAPID_* vao .env';
PRINT '   3) pm2 restart qlnoibo';
SELECT OBJECT_ID('dbo.PushSubscription') AS PushSubscription_ObjectID;
GO

SET NOEXEC OFF;
GO
