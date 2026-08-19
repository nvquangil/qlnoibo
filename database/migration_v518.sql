/* ================================================================
   migration_v518.sql - Nang cap tu v5.17 len v5.18

   Yeu cau (Quan ly san xuat, muc 1.1 + 1.2):
     1.1   - Danh sach lenh san xuat: user chi duoc phan quyen "Xem" (khong
             gan cong doan nao) van phai thay danh sach don hang (sua o
             backend/routes/qlsx.js GET /orders - KHONG can migration).
     1.2.1 - Bo cong doan "Chỉ định phụ kiện" (PK) ra khoi luong Ghi nhan
             tien do.
     1.2.2 - Bo cong doan "Giao vải" (GV) ra khoi luong Ghi nhan tien do;
             dieu kien cap nhat cong doan "Cắt" la don hang phai da co
             Phieu xuat kho vai (PhieuXuatVai/PhieuXuatVaiChiTiet).
     1.2.3 - Cong doan Cat: cho CHON cay vai (trong so cay DA XUAT that cho
             don hang) vao tung so do, thay vi hien san toan bo danh sach.

   GV/PK KHONG bi xoa khoi CongDoanSanXuat (van la 2 dong LaHeThong=1, giu
   nguyen StageID cho du lieu lich su TienDoSanXuat/bao cao cu doi chieu
   dung) - CHUNG chi khong con la diem dung tren duong di cua don hang MOI
   nua (xem tinhNextStage() trong backend/routes/qlsx.js, da sua de LUON bo
   qua GV/PK khi tinh cong doan ke tiep - truoc day chi bo qua May co dieu
   kien).

   Migration nay CHI can xu ly DU LIEU: don hang nao dang "dung" (tai
   DonHangSanXuat.CongDoanHienTaiID) o GV hoac PK tai thoi diem nang cap se
   duoc CHUYEN THANG toi CAT (cong doan tiep theo ma tinhNextStage() moi se
   cho ra, neu ho ghi nhan tien do "tu day tro di"). KHONG dong den lich su
   TienDoSanXuat da co (cac dong da ghi nhan GV/PK tu truoc GIU NGUYEN,
   khong xoa/sua) - chi doi CON TRO "dang o dau" cua don hang. PhanTramHoanThanh
   duoc tinh lai theo vi tri THAT cua CAT trong ThuTu (khop voi cong thuc
   backend dang dung: (vi tri + 1) / tong so cong doan) de thanh % hien thi
   dung ngay, khong doi cho toi lan ghi tien do ke tiep moi tu cap nhat lai.

   YEU CAU TIEN QUYET: da chay migration_v59.sql (them MaCongDoan/LaHeThong)
   va migration_v52_qlsx.sql (them GV/PK) tu truoc - neu chua, script se bao
   loi va dung lai (khong lam gi ca), xem RAISERROR ben duoi.

   An toan chay lai nhieu lan (idempotent) - lan chay thu 2 tro di se
   khong con don nao dang o GV/PK nua nen @@ROWCOUNT = 0, khong gay hai gi.
   ================================================================ */

USE QLNoiBo;
GO

DECLARE @GVStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'GV');
DECLARE @PKStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'PK');
DECLARE @CATStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'CAT');

IF @GVStageID IS NULL OR @PKStageID IS NULL OR @CATStageID IS NULL
BEGIN
    RAISERROR(N'Khong tim thay du 3 cong doan GV/PK/CAT (MaCongDoan) trong CongDoanSanXuat - kiem tra lai migration_v59.sql va migration_v52_qlsx.sql da chay chua truoc khi chay migration nay.', 16, 1);
    RETURN;
END

DECLARE @TotalStages INT = (SELECT COUNT(*) FROM CongDoanSanXuat);
DECLARE @CatThuTu INT = (SELECT ThuTu FROM CongDoanSanXuat WHERE StageID = @CATStageID);
DECLARE @CatViTri INT = (SELECT COUNT(*) FROM CongDoanSanXuat WHERE ThuTu <= @CatThuTu);
DECLARE @CatPercent INT = CASE WHEN @TotalStages > 0 THEN ROUND((CAST(@CatViTri AS FLOAT) / @TotalStages) * 100, 0) ELSE 0 END;

UPDATE DonHangSanXuat
SET CongDoanHienTaiID = @CATStageID,
    PhanTramHoanThanh = @CatPercent,
    UpdatedAt = SYSDATETIME()
WHERE CongDoanHienTaiID IN (@GVStageID, @PKStageID);

PRINT N'Da chuyen ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + N' don hang dang dung o "Giao vải"/"Chỉ định phụ kiện" sang "Cắt" (% hoàn thành cập nhật lại theo vị trí Cắt).';
GO
