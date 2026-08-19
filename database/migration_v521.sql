/* ================================================================
   migration_v521.sql - Nang cap tu v5.20 len v5.21

   Yeu cau (dot 8 muc, sua/tinh chinh lai mot phan cua v5.20 - xem
   HUONG_DAN_CAI_DAT.md Buoc 2.27 de biet chi tiet tung muc va ly do chon
   giai phap):

   1   - Danh muc MOI "Đơn vị quy đổi" (DanhMucDonViQuyDoi): moi dong la 1
         CAP don vi (Don vi chinh -> Don vi quy doi, Phep tinh Nhan/Chia,
         He so) - cho phep khai bao NHIEU cap (yeu cau "Tạo nhiều danh mục
         đơn vị quy đổi"). Quan ly qua Danh muc (module DANHMUC, tab moi
         "Đơn vị quy đổi") dung chung buildCrudRouter() - xem danhmuc.js.

   2   - Cau truc vai (Ra lenh san xuat): dong "Tổng cộng" doi tu CHIA lay
         thuong/du (fmtDualUnit() - vay tu The kho hang hoa, sai ban chat -
         xem v5.19 muc 1.2/1.3) sang NHAN theo dung dong "Đơn vị quy đổi"
         da chon cho don hang (fmtQuyDoi() moi trong common.js). Them cot
         DonHangSanXuat.DonViQuyDoiID (FK toi DanhMucDonViQuyDoi) - CHI
         dung de dinh dang hien thi; DonHangSanXuat.HeSoQuyDoi (da co tu
         v5.13) VAN la con so THAT SU dung cho tinh toan o cong doan Cat,
         khong doi - chon 1 dong danh muc chi AUTO-DIEN lai o "He so quy
         đổi" (van sua tay duoc rieng sau do).

   3   - Ky thuat: them toggle TUONG MINH "Giao nhà làm"/"Giao gia công"
         (radio, cot moi DonHangSanXuat.KenhSanXuat NVARCHAR(20) NULL) -
         TACH KHOI viec chon nha gia cong CU THE (ktNhaGiaCong/Nhà gia
         công chi tiết van con, nay chi la THAM KHAO/dai dien). tinhNextStage()
         (GNGC/NNGC/May) va frontend showGiaoViec doc KenhSanXuat truoc
         tien, fallback ve suy luan CU (NhaGiaCongID/LaNoiBoNhaGiaCong)
         cho don hang CU chua tung mo lai Ky thuat sau nang cap (KenhSanXuat
         con NULL) - xem backend qlsx.js tinhNextStage()/module.qlsx.js
         showGiaoViec. Man hinh con "Giao nhà gia công" (chon tung nha +
         gia + so luong, nhieu nha) da co san tu v5.19 - khong doi.

   5   - "Nhận nhà gia công" (GET /nhannhagiacong): CHI liet ke dong "Nha
         gia cong chi tiet" DA co it nhat 1 lan Giao (TongDaGiao > 0) -
         truoc day hien TAT CA dong da khai bao o Ky thuat, ke ca chua
         tung duoc giao lan nao.

   6   - Phieu xuat kho vai (KHOVAI, khong doi schema, xem backend/routes/
         khovai.js):
           a) GET /orders (dropdown chon don hang o Tao phieu xuat): PHAI
              co Chi dinh vai SX (SUM SoKGYeuCau > 0) moi hien - dao nguoc
              lai quyet dinh "cho hien ca don CHUA khai" cua v5.20.
           b) GET /orders/:donHangId/vaichophep: them chiTietTheoMau (KG
              yeu cau + KG da xuat rieng TUNG Loai vai/Mau) thay vi chi co
              tong Chinh/Phoi gop lai.
           c) In phieu: cot "Kg chỉ định" doi nguon tu DonHangChiTietVai.
              SoKGYeuCau (Chi dinh vai SX) thay vi .SoLuong (Ra lenh SX,
              sai don vi).

   7   - getStageActualQty()/getStageActualQtyByColor() (backend qlsx.js):
         sua bug cong SAI cho don hang >= 2 so do (chi lay 1 ban thay vi
         tat ca) - dong nhat cach gop nhom NhomTienDoID voi getStageCayCount()
         da dung tu v5.16. Sua ca "Tổng SL cắt" o cong doan May LAN "SL cắt
         thực tế" o bao cao in phieu (dung chung 1 ham).

   8   - "Giao/Nhận nhà in thêu": DAO NGUOC lai phan tuong ung cua v5.20 -
         KHONG con la 2 cong doan (GNIT/NNIT) trong CongDoanSanXuat/Ghi
         nhan tien do nua (2 dong nay CHUA tung duoc them vao CSDL that su
         - migration_v520.sql da duoc sua truc tiep de KHONG con tao 2 dong
         nay, an toan vi CHUA deploy) - thay bang 2 chuc nang DOC LAP
         (ChucNang moi 'giaonhaintheu'/'nhannhaintheu', tab rieng trong
         Quan ly san xuat) khong gate/chan luong Ghi nhan tien do, dung
         LAI dung 3 cot DonHangSanXuat.NhaInID/NgayGiaoIn/NgayNhanIn (khong
         doi schema). "Giao": chon nha in/theu + ngay giao, cho doi lai bat
         ky luc nao. "Nhan": CHI hien don DA duoc giao, chi ghi ngay nhan -
         KHONG can so luong. Lich su "Ghi nhận tiến độ" (GET /orders/:maDH/
         print) van chen 2 dong tong hop "Giao/Nhận nhà in thêu" (tu chinh
         NgayGiaoIn/NgayNhanIn cua don hang) de van phan anh du 2 su kien
         nay nhu yeu cau, du KHONG con la cong doan that.

   Bang moi: DanhMucDonViQuyDoi.
   Cot moi: DonHangSanXuat.DonViQuyDoiID, DonHangSanXuat.KenhSanXuat.
   ChucNang moi (QLSX): giaonhaintheu, nhannhaintheu.

   YEU CAU TIEN QUYET: da chay migration_v520.sql (ban da SUA - khong con
   tao GNIT/NNIT nua), migration_v519.sql, migration_v5_chucnang.sql tu truoc.

   An toan chay lai nhieu lan (idempotent) - dung IF COL_LENGTH/OBJECT_ID/
   MERGE giong cac migration truoc.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    RAISERROR(N'Khong tim thay bang ChucNang - can chay migration_v5_chucnang.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
IF OBJECT_ID('DonHangSanXuat') IS NULL
BEGIN
    RAISERROR(N'Khong tim thay bang DonHangSanXuat - kiem tra lai schema.sql da chay chua.', 16, 1);
    RETURN;
END
GO

/* ---------- 1/2: Danh muc Don vi quy doi + cot FK tren DonHangSanXuat ---------- */
IF OBJECT_ID('DanhMucDonViQuyDoi') IS NULL
BEGIN
    CREATE TABLE DanhMucDonViQuyDoi (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonViChinh   NVARCHAR(30) NOT NULL,
        DonViQuyDoi  NVARCHAR(30) NOT NULL,
        HeSo         DECIMAL(14,4) NOT NULL DEFAULT 1,
        PhepTinh     NVARCHAR(10) NOT NULL DEFAULT N'Nhan',   -- 'Nhan' hoac 'Chia'
        GhiChu       NVARCHAR(255) NULL
    );
    PRINT N'Da tao bang DanhMucDonViQuyDoi.';
END ELSE PRINT N'Bang DanhMucDonViQuyDoi da ton tai, bo qua.';
GO

-- Seed 1 dong vi du pho bien nhat (Ri -> Cai, x5) - khop dung dong dan trong yeu cau
-- ("ví dụ đơn vị tính chính là ri thì đơn vị quy đổi sẽ là ri x hệ số quy đổi (cái)").
-- Chi seed neu bang dang RONG (tranh tao trung lap moi lan chay lai migration).
IF NOT EXISTS (SELECT 1 FROM DanhMucDonViQuyDoi)
BEGIN
    INSERT INTO DanhMucDonViQuyDoi (DonViChinh, DonViQuyDoi, HeSo, PhepTinh, GhiChu)
    VALUES (N'Ri', N'Cái', 5, N'Nhan', N'Mặc định — chỉnh sửa hệ số cho đúng thực tế nếu khác 5.');
    PRINT N'Da seed 1 dong vi du (Ri -> Cái, x5) vao DanhMucDonViQuyDoi.';
END
GO

IF COL_LENGTH('DonHangSanXuat', 'DonViQuyDoiID') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD DonViQuyDoiID INT NULL FOREIGN KEY REFERENCES DanhMucDonViQuyDoi(ID);
    PRINT N'Da them cot DonHangSanXuat.DonViQuyDoiID.';
END ELSE PRINT N'Cot DonHangSanXuat.DonViQuyDoiID da ton tai, bo qua.';
GO

/* ---------- 3: Kenh san xuat (Nha Lam / Gia cong) - toggle tuong minh o Ky thuat ---------- */
IF COL_LENGTH('DonHangSanXuat', 'KenhSanXuat') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD KenhSanXuat NVARCHAR(20) NULL;
    PRINT N'Da them cot DonHangSanXuat.KenhSanXuat.';
END ELSE PRINT N'Cot DonHangSanXuat.KenhSanXuat da ton tai, bo qua.';
GO

-- Backfill KenhSanXuat cho don hang DA CO tu truoc nang cap, tu chinh cach suy luan CU
-- (NhaGiaCongID/LaNoiBoNhaGiaCong) - tranh doi kenh cua don dang chay so voi ngay hom truoc
-- khi ho quay lai Ky thuat sau nang cap (form se hien dung radio da duoc backfill, khong bi
-- mac dinh nham ve "Giao nhà làm"). Chi backfill dong con NULL (chua tung ghi qua form moi).
UPDATE d
SET d.KenhSanXuat = CASE
    WHEN d.NhaGiaCongID IS NOT NULL AND ncc.LaNoiBo = 0 THEN N'GiaCong'
    ELSE N'NhaLam'
END
FROM DonHangSanXuat d
LEFT JOIN NhaGiaCong ncc ON ncc.NhaGiaCongID = d.NhaGiaCongID
WHERE d.KenhSanXuat IS NULL;
PRINT N'Da backfill KenhSanXuat cho don hang da co tu truoc (tu NhaGiaCongID/LaNoiBoNhaGiaCong).';
GO

/* ---------- 8: ChucNang moi (QLSX) - Giao/Nhan nha in theu (chuc nang doc lap) ---------- */
MERGE ChucNang AS t
USING (VALUES
    ('QLSX','giaonhaintheu',N'Giao nhà in thêu',8),
    ('QLSX','nhannhaintheu',N'Nhận nhà in thêu',9)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
GO
PRINT N'Da seed ChucNang moi cho QLSX (giaonhaintheu/nhannhaintheu).';
GO

PRINT N'migration_v521.sql hoan tat.';
GO
