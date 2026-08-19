/* ================================================================
   migration_v520.sql - Nang cap tu v5.19 len v5.20

   Yeu cau (dot lon - "xac dinh lai luong ghi tien do san xuat"):

   1   - Dinh nghia lai toan bo trinh tu cong doan san xuat (CongDoanSanXuat)
         theo luong moi:
         Ra lenh SX -> Tai lieu KT -> Ky thuat -> Chi dinh vai SX -> Xuat vai
         -> Cat -> Chi dinh phu kien -> Xuat phu kien -> Giao nha in theu ->
         Nhan nha in theu -> Giao nha gia cong -> Nhan nha gia cong -> May ->
         Nhat chi -> QC -> La -> Dong goi -> Kho nhap.
         Cac buoc KHONG phai 1 "cong doan" thuc su trong CongDoanSanXuat (vi
         da co san man hinh/co che rieng, khong can them 1 diem dung Ghi nhan
         tien do nua):
           - "Ra lenh SX": diem bat dau, khong phai cong doan.
           - "Tai lieu KT": chuc nang rieng tu v5.14 (module.tailieukythuat.js).
           - "Chi dinh vai SX": chuc nang rieng tu v5.19 (DonHangChiTietVai.
             SoKGYeuCau), nay LA NGUON DU LIEU cho "Xuat vai" (xem muc 4/4.1
             duoi day) thay vi 1 cong doan can bam "Gui" rieng.
           - "Xuat vai": chinh la Phieu xuat kho vai (KHOVAI - da la dieu
             kien CUNG cho cong doan "Cat" tu v5.18, khong doi).
           - "Chi dinh phu kien": chinh la khoi "Phu kien can dung (NPL)" da
             co san trong Ra lenh san xuat (DonHangChiTietPhuKien).
           - "Xuat phu kien": Phieu xuat phu kien (module PHUKIEN, da co san).
         2 cong doan DU DINH ban dau (GNIT/NNIT, SUA LAI o v5.21, xem duoi)
         va 2 cong doan khac (GNGC/NNGC, SUA LAI o v5.22, xem duoi) KHONG con
         duoc them vao CongDoanSanXuat nua - ca 4 deu da bi rut khoi ke hoach
         ban dau cua migration nay truoc khi tung duoc trien khai (an toan
         sua truc tiep, khong can migration "undo" rieng).
         SUA LAI o v5.21 (yeu cau muc 8, "Tách Giao nhà in thêu, nhận nhà in
         thêu ra thành chức năng riêng... không phải trong ghi nhận tiến
         độ"): "Giao nha in theu"/"Nhan nha in theu" (GNIT/NNIT) KHONG con
         duoc them vao CongDoanSanXuat nua (migration nay CHUA tung duoc
         trien khai nen sua truc tiep an toan, khong can 1 migration "undo"
         rieng) - thay bang 2 chuc nang doc lap (xem migration_v521.sql +
         backend/routes/qlsx.js GET/POST /giaonhaintheu, /nhannhaintheu).
         SUA LAI TIEP o v5.22 (muc 1.1, "xóa bỏ Giao nhà in thêu, nhận nhà in
         thêu, giao nhà gia công, nhận nhà gia công ở trong tiến độ sản
         xuất"): "Giao nha gia cong"/"Nhan nha gia cong" (GNGC/NNGC) CUNG bi
         rut khoi CongDoanSanXuat theo DUNG cach v5.21 da lam cho GNIT/NNIT -
         thay bang 2 tab doc lap /giaonhagiacong, /nhannhagiacong (ChucNang
         da co san tu v5.19, xem migration_v519.sql - KHONG can them dong
         ChucNang moi), nay xay lai theo mo hinh danh-sach-don-hang-truoc
         (xem migration_v522.sql neu co + backend/routes/qlsx.js).
         3 cong doan MOI khac, don gian (dung chung form "SL luy ke theo
         mau" nhu Hoan thien cu, KHONG can sua renderStageFields): "Nhat chi"
         (NCH), "QC", "La" (LA) - chen giua May va Dong goi.
         "Hoan thien" (HT) - KHONG con trong luong moi (khong nam trong danh
         sach cong doan nguoi dung liet ke) - them vao danh sach BO QUA
         KHONG DIEU KIEN (MA_CONG_DOAN_BO_QUA trong qlsx.js), CUNG canh voi
         GV/PK (da bo qua tu v5.18) - GIU NGUYEN dong nay trong danh muc,
         KHONG xoa, de khong pha vo du lieu lich su TienDoSanXuat cu.
         "Dong goi" (DG) chuyen ra SAU "Kho nhap" (KN) trong ThuTu hien tai
         (KT=1,GV=2,PK=3,CAT=4,MAY=5,HT=6,KN=7,DG=8) - doi thanh KN o SAU DG
         (dung thu tu nguoi dung yeu cau "...Đóng gói → Kho Nhập").

   2/3 - Xem ghi chu tai frontend/js/module.qlsx.js (openVendorForm da bi
         XOA) va backend/routes/qlsx.js (POST /orders/:maDH/vendor da bi
         XOA). "Giao/nhan nha gia cong" VA "Giao/nhan nha in theu" deu dung
         2 tab doc lap co san (khong con la cong doan trong CongDoanSanXuat,
         xem SUA LAI o muc 1 phia tren) - nha gia cong dung ChucNang
         giaonhagiacong/nhannhagiacong (co san tu v5.19), nha in/theu dung
         ChucNang giaonhaintheu/nhannhaintheu (them moi o migration_v521.sql).

   4/4.1 - Xem ghi chu tai backend/routes/khovai.js (GET /orders VA GET
         /orders/:donHangId/vaichophep) - co che "Giao vai" (GiaoVaiSanXuat)
         KHONG con duoc dung lam nguon "cay vai cho phep xuat" nua; thay
         bang JOIN truc tiep DonHangChiTietVai (Chi dinh vai SX/Cau truc
         vai) -> DanhMucVai -> vw_TonCayVai theo Loai vai + Mau. Bang
         GiaoVaiSanXuat KHONG bi xoa (van con du lieu lich su, van duoc cac
         kiem tra "da phat sinh giao dich" o Nhap kho vai/1.3.x tham chieu -
         xem khovai.js PUT /nhap/:id) - chi khong con la co che gating cho
         Xuat kho vai nua.

   Bang moi: KHONG co (chi them dong CongDoanSanXuat + doi ThuTu, dung lai
   100% cot da co san tren DonHangSanXuat: NhaInID/NgayGiaoIn/NgayNhanIn/
   NhaGiaCongID/NgayGiaoGC/NgayNhanGC).

   YEU CAU TIEN QUYET: da chay migration_v59.sql (MaCongDoan/LaHeThong) va
   migration_v518.sql (GV/PK bo qua khong dieu kien) tu truoc.

   An toan chay lai nhieu lan (idempotent) - dung IF NOT EXISTS/IF EXISTS
   truoc moi INSERT/UPDATE dinh danh theo MaCongDoan (UNIQUE khi khac NULL,
   xem migration_v59.sql).
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'KT')
BEGIN
    RAISERROR(N'Khong tim thay cong doan he thong (MaCongDoan) trong CongDoanSanXuat - can chay migration_v59.sql va migration_v518.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
GO

/* ---------- 1a: danh so lai (renumber) cac cong doan HE THONG hien co theo
   khoang cach 10 don vi - de lai khoang trong cho cac cong doan MOI chen
   vao giua ma KHONG can dich chuyen (shift) hang loat nhu cac migration
   truoc (v5.2). Khong doi StageID (identity) cua bat ky dong nao nen KHONG
   anh huong don hang dang o giua chung (CongDoanHienTaiID tham chieu StageID,
   khong tham chieu ThuTu). ---------- */
UPDATE CongDoanSanXuat SET ThuTu = 10  WHERE MaCongDoan = N'KT';
UPDATE CongDoanSanXuat SET ThuTu = 20  WHERE MaCongDoan = N'CAT';
UPDATE CongDoanSanXuat SET ThuTu = 70  WHERE MaCongDoan = N'MAY';
UPDATE CongDoanSanXuat SET ThuTu = 110 WHERE MaCongDoan = N'DG';
UPDATE CongDoanSanXuat SET ThuTu = 120 WHERE MaCongDoan = N'KN';
-- Cac cong doan da/dang bi loai khoi luong Ghi nhan tien do (GV/PK tu v5.18,
-- HT tu migration nay) - day ve cuoi danh sach, GIU NGUYEN LaHeThong=1/du
-- lieu lich su, chi khong con anh huong gi den tinhNextStage() (van luon bi
-- bo qua qua MA_CONG_DOAN_BO_QUA, xem qlsx.js).
UPDATE CongDoanSanXuat SET ThuTu = 900 WHERE MaCongDoan = N'GV';
UPDATE CongDoanSanXuat SET ThuTu = 910 WHERE MaCongDoan = N'PK';
UPDATE CongDoanSanXuat SET ThuTu = 920 WHERE MaCongDoan = N'HT';
PRINT N'Da danh so lai ThuTu cac cong doan he thong hien co.';
GO

/* ---------- 1b: them 3 cong doan MOI ---------- */
/* v5.21 (muc 8): BO 2 dong GNIT/NNIT (Giao/Nhan nha in theu) khoi day - da doi thanh 2 chuc nang doc
   lap ngoai CongDoanSanXuat, xem migration_v521.sql.
   v5.22 (muc 1.1): BO TIEP 2 dong GNGC/NNGC (Giao/Nhan nha gia cong) khoi day - cung ly do, cung doi
   thanh 2 tab doc lap (ChucNang giaonhagiacong/nhannhagiacong da co san tu v5.19). Chi con lai 3 cong
   doan don gian (Nhat chi/QC/La) thuc su can them vao CongDoanSanXuat. */
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'NCH')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Nhặt chỉ', 80, N'NCH', 1);
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'QC')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'QC', 90, N'QC', 1);
IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'LA')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Là', 100, N'LA', 1);
PRINT N'Da them (neu chua co) 3 cong doan moi: NCH/QC/LA.';
GO

/* ---------- 1c: chuyen don hang dang "dung" o Hoan thien (HT) - cong doan
   nay khong con trong luong moi - sang "Nhat chi" (NCH), cong doan ke tiep
   thuc su trong danh muc moi ngay sau May. Mirror dung cach lam cua
   migration_v518.sql cho GV/PK -> Cat (StageID khong doi voi don KHONG o
   HT nen an toan chay lai nhieu lan - @@ROWCOUNT = 0 tu lan thu 2). ---------- */
DECLARE @HTStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'HT');
DECLARE @NCHStageID INT = (SELECT StageID FROM CongDoanSanXuat WHERE MaCongDoan = N'NCH');

IF @HTStageID IS NOT NULL AND @NCHStageID IS NOT NULL
BEGIN
    DECLARE @TotalStages INT = (SELECT COUNT(*) FROM CongDoanSanXuat);
    DECLARE @NCHThuTu INT = (SELECT ThuTu FROM CongDoanSanXuat WHERE StageID = @NCHStageID);
    DECLARE @NCHViTri INT = (SELECT COUNT(*) FROM CongDoanSanXuat WHERE ThuTu <= @NCHThuTu);
    DECLARE @NCHPercent INT = CASE WHEN @TotalStages > 0 THEN ROUND((CAST(@NCHViTri AS FLOAT) / @TotalStages) * 100, 0) ELSE 0 END;

    UPDATE DonHangSanXuat
    SET CongDoanHienTaiID = @NCHStageID,
        PhanTramHoanThanh = @NCHPercent,
        UpdatedAt = SYSDATETIME()
    WHERE CongDoanHienTaiID = @HTStageID;

    PRINT N'Da chuyen ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + N' đơn hàng đang đứng ở "Hoàn thiện" sang "Nhặt chỉ" (% hoàn thành cập nhật lại theo vị trí mới).';
END
GO

PRINT N'migration_v520.sql hoan tat.';
GO
