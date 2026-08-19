/* ================================================================
   MIGRATION v5.27 — Ra lenh SX: loai vai GO TU DO + bo Chi dinh vai SX/NPL
   ----------------------------------------------------------------
   - Cau truc vai: "Loai vai" chuyen tu chon-tu-danh-muc (LoaiVaiID) sang GO TU DO
     (cot moi TenLoaiVaiTuDo). Muc dich: khong rang buoc buoc xuat vai theo lenh SX
     (truoc day Phieu xuat kho vai match cay vai theo LoaiVaiID+MauSacID). LoaiVaiID
     GIU LAI (nullable) cho don CU; don MOI dung TenLoaiVaiTuDo.
   - "Mau" v5.27.1 CUNG go tu do (cot moi TenMauTuDo) - chi la thong tin THAM KHAO tren Ra lenh SX,
     KHONG con dieu khien theo doi tien do (yeu cau: "mau chi de tham khao, khong anh huong cong doan
     khac"). Per-mau tracking o May/Kho nhap gio lay danh sach mau tu KET QUA CAT (cay vai da xuat,
     DanhMucVai.MauSacID that) chu khong tu DonHangChiTietVai - xem getStageActualQtyByColor +
     openProgressForm (Option 4). DonHangChiTietVai.MauSacID doi sang NULLABLE.
   - Chuc nang "Chi dinh vai SX" (chidinhvaisx) + "Chi dinh NPL" (chidinhnpl) bi BO
     khoi giao dien. KHONG xoa cot/ChucNang - de "mo coi" theo dung quy uoc (giong
     giaonhagiacong/nhannhagiacong). Cong DonHangChiTietVai.DVTVaiYeuCau/SoKGYeuCau
     (v5.19) tu nay khong con noi nhap - de trong, khong xoa.

   Chay 1 lan. IDEMPOTENT. YEU CAU TIEN QUYET: schema.sql + migration_v519.sql.
   ================================================================ */

USE QLNoiBo;
GO

IF COL_LENGTH('dbo.DonHangChiTietVai','TenLoaiVaiTuDo') IS NULL
    ALTER TABLE DonHangChiTietVai ADD TenLoaiVaiTuDo NVARCHAR(150) NULL;
-- v5.27.1 (yeu cau bo sung): mau CUNG go tu do (chi la thong tin tham khao, khong anh huong cong doan
-- khac) + moi dong mau chinh them 1 o Ghi chu.
IF COL_LENGTH('dbo.DonHangChiTietVai','TenMauTuDo') IS NULL
    ALTER TABLE DonHangChiTietVai ADD TenMauTuDo NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.DonHangChiTietVai','GhiChu') IS NULL
    ALTER TABLE DonHangChiTietVai ADD GhiChu NVARCHAR(255) NULL;
GO

-- v5.27.1: mau go tu do -> DonHangChiTietVai.MauSacID doi sang NULLABLE (don moi co the khong gan mau
-- catalog). Idempotent (chi doi khi dang NOT NULL). Theo doi per-mau tien do KHONG dung cot nay nua.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DonHangChiTietVai') AND name = 'MauSacID' AND is_nullable = 0)
    ALTER TABLE DonHangChiTietVai ALTER COLUMN MauSacID INT NULL;
GO

PRINT '=== migration_v527.sql (Ra lenh SX - loai vai + mau tu do) hoan tat ===';
GO
