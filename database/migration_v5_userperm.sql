/* ================================================================
   MIGRATION v5.0 — Phan quyen chi tiet theo TUNG USER (bo sung, KHONG thay the phan quyen theo NHOM
   da co). Yeu cau: "Phan quyen can chi tiet hon - chon tung user do va tick vao o phan quyen."

   Nguyen tac OVERRIDE (giong het tinh than cua ChucNangPermissions o migration_v5_chucnang.sql):
     - UserPermissions        : neu co dong (UserID, ModuleID) -> DUNG HAN GIA TRI cua dong nay cho
                                dung module do (bo qua hoan toan gia tri tinh tu nhom). Neu KHONG co
                                dong nao -> giu nguyen cach tinh theo nhom nhu truoc (an toan, khong
                                lam mat quyen ai ca khi vua chay migration nay xong).
     - UserChucNangPermissions: tuong tu, nhung theo tung CHUC NANG (tab con) thay vi ca phan he.
   2 bang nay la lop OVERRIDE cao nhat: User > Nhom. Xem loadUserContext.js de biet thu tu ap dung.
   Chay 1 lan. Idempotent - chay lai khong tao trung du lieu, khong xoa du lieu da co.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserPermissions')
BEGIN
    CREATE TABLE UserPermissions (
        UserPermissionID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
        ModuleID INT NOT NULL REFERENCES Modules(ModuleID) ON DELETE CASCADE,
        CanView BIT NOT NULL DEFAULT 0,
        CanCreate BIT NOT NULL DEFAULT 0,
        CanEdit BIT NOT NULL DEFAULT 0,
        CanDelete BIT NOT NULL DEFAULT 0,
        CONSTRAINT UQ_UserPermissions_User_Module UNIQUE (UserID, ModuleID)
    );
    PRINT 'Da tao bang UserPermissions.';
END ELSE PRINT 'Bang UserPermissions da ton tai, bo qua.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserChucNangPermissions')
BEGIN
    CREATE TABLE UserChucNangPermissions (
        UserChucNangPermissionID INT IDENTITY(1,1) PRIMARY KEY,
        UserID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
        ChucNangID INT NOT NULL REFERENCES ChucNang(ChucNangID) ON DELETE CASCADE,
        CanView BIT NOT NULL DEFAULT 0,
        CONSTRAINT UQ_UserChucNangPermissions_User_ChucNang UNIQUE (UserID, ChucNangID)
    );
    PRINT 'Da tao bang UserChucNangPermissions.';
END ELSE PRINT 'Bang UserChucNangPermissions da ton tai, bo qua.';
GO

PRINT 'Hoan tat migration_v5_userperm.sql.';
GO
