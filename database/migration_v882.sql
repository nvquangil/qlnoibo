/* ================================================================================================
   migration_v882.sql   (v8.95)  —  CHI PHÍ CHUNG MẶC ĐỊNH CHO MỌI LỆNH SX + mốc chốt giá thành
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-22: "thay đổi trong tính giá thành sản phẩm. sau khi cập nhật công đoạn QC lấy số
   lượng của QC để tính giá thành. Khi công đoạn QC cập nhật tiến độ xong sẽ tự ra giá thành lệnh sản
   xuất đó. bên tính giá thành sẽ có cài đặt phần chi phí chung chung tất cả lệnh sản xuất"

   Ba quyết định đã chốt với Nguyen (AskUserQuestion 2026-10-22):
     · Thời điểm: khi lệnh RỜI công đoạn QC (đủ số cắt hoặc tích "Đã hoàn thành") — không phải mỗi đợt.
     · Chi phí chung: lệnh CÓ khai riêng (ChiPhiChungDonHang) thì dùng riêng, BỎ phần chung;
       lệnh chưa khai gì thì dùng bảng chung này. Không bao giờ cộng hai lần.
     · Kết quả: nạp vào GiaVonHangHoa như v8.90 (luật "chỉ ghi đè khi cùng lệnh SX" giữ nguyên).

   1. ChiPhiChungMacDinh — giống hệt ChiPhiChungDonHang nhưng KHÔNG có DonHangID. SoTien là tiền
      cho MỘT sản phẩm (cùng nghĩa với ChiPhiChungDonHang từ v7.89).
   2. DonHangSanXuat.GiaThanhChot / GiaThanhChotSL / GiaThanhChotNgay — MỐC đã chốt lúc QC xong, để
      màn giá thành nói được "lúc QC xong là X, tính lại bây giờ là Y" khi ai đó thêm chi phí sau.
      NULL = chưa chốt. Không backfill: lệnh đã qua QC trước bản này chốt bằng nút trên màn giá thành.

   Chạy: SSMS trên database QLNoiBo. Có guard. Sau đó pm2 restart + Ctrl+F5.
   ================================================================================================ */
USE QLNoiBo;
GO
PRINT '=== migration_v882: ChiPhiChungMacDinh + moc chot gia thanh ===';
GO

IF OBJECT_ID('ChiPhiChungMacDinh', 'U') IS NULL
BEGIN
    CREATE TABLE ChiPhiChungMacDinh (
        ID        INT IDENTITY(1,1) PRIMARY KEY,
        TenChiPhi NVARCHAR(200) NOT NULL,
        SoTien    DECIMAL(18,2) NOT NULL DEFAULT 0,   -- đ / 1 sản phẩm
        GhiChu    NVARCHAR(500) NULL,
        ThuTu     INT NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT '  + Bang ChiPhiChungMacDinh';
END
ELSE PRINT '  = Bang ChiPhiChungMacDinh da co';
GO

IF COL_LENGTH('DonHangSanXuat', 'GiaThanhChot') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD
        GiaThanhChot     DECIMAL(18,2) NULL,   -- gia thanh 1 SP (cai) tai thoi diem chot
        GiaThanhChotSL   DECIMAL(18,4) NULL,   -- mau so da dung (SL QC)
        GiaThanhChotNgay DATETIME2     NULL;
    PRINT '  + Cot DonHangSanXuat.GiaThanhChot / GiaThanhChotSL / GiaThanhChotNgay';
END
ELSE PRINT '  = Cot GiaThanhChot da co';
GO
