/* ================================================================
   MIGRATION v5.34b (Giai doan B2) — Don gia cong doan may (model MOI)
   ----------------------------------------------------------------
   Muc 4.3: bang don gia cong doan may theo don hang, model MOI (khac DonHangCongDoanMay cu):
     Ten cong doan (tu do) / Giay gio (so) / He so cong doan (so) / He so cong nhan (mac dinh 4) /
     Thanh tien = Giay gio x He so cong doan x He so cong nhan.
   Nhieu dong / don. Thanh tien la cot TINH (PERSISTED) dung cho tinh luong khoan may (Giai doan C:
   luong = SL x Thanh tien). Nhap tai "Tài liệu may/Đóng gói" > "Đơn giá công đoạn may".
   Chay 1 lan. IDEMPOTENT.
   ================================================================ */
USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DonHangDonGiaCongDoanMay')
BEGIN
    CREATE TABLE DonHangDonGiaCongDoanMay (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        TenCongDoan  NVARCHAR(150) NOT NULL,
        GiayGio      DECIMAL(14,4) NULL,
        HeSoCongDoan DECIMAL(14,4) NULL,
        HeSoCongNhan DECIMAL(14,4) NOT NULL DEFAULT 4,
        ThuTu        INT NOT NULL DEFAULT 0,
        ThanhTien    AS (ISNULL(GiayGio,0) * ISNULL(HeSoCongDoan,0) * ISNULL(HeSoCongNhan,0)) PERSISTED,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_DGCDMay_Don ON DonHangDonGiaCongDoanMay(DonHangID);
    PRINT 'Da tao DonHangDonGiaCongDoanMay.';
END ELSE PRINT 'DonHangDonGiaCongDoanMay da ton tai, bo qua.';
GO

PRINT '=== migration_v534b.sql (Don gia cong doan may model moi) hoan tat ===';
GO
