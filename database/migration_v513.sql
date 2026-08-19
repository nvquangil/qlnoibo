/* ================================================================
   migration_v513.sql - Nang cap tu v5.12 len v5.13

   Yeu cau (Quan ly san xuat, 1 dot lon gom nhieu muc - xem HUONG_DAN_CAI_DAT.md
   Buoc 2.18 de biet chi tiet tung muc va ly do chon giai phap):

   1.1 Ra lenh san xuat:
       - Bo "Tong so luong" nhap tay - tu tinh tu tong SL cac dong mau CHINH
         trong Cau truc vai (xem POST/PUT /orders trong qlsx.js).
       - Them "He so quy doi" (Cai/Ri) O DON HANG - dung CHUNG cho cong doan
         Cat thay vi phai nhap lai o TUNG cay vai moi lan Ghi tien do.
       - Cau truc vai: them hang "Tong cong" (SL + SL sau quy doi), them Loai
         vai/Mau moi ngay tai cho (goi lai /api/danhmuc/loaivai,mausac da co
         san), o chon go tim duoc (searchableSelectHtml da co san).

   1.2 Ghi nhan tien do:
       - Ky thuat: "Met so do"/"Kho vai so do" tu 1 bo gia tri DUY NHAT tren
         TienDoSanXuat (khong doi duoc, khong ghi chu rieng) sang NHIEU "so
         do" moi don hang (bang moi DonHangChiTietSoDo, dung CHUNG mo hinh
         voi Giao vai/Phu kien - danh sach rieng, luu ngay qua nut "Luu",
         doc lap voi lan "Gui" chinh cua form Ghi tien do).
       - Ky thuat: "Giao nha gia cong" gio co THEM 1 danh sach chi tiet
         (DonHangChiTietNhaGiaCong) cho phep nhieu nha gia cong + ghi chu -
         DAY LA BO SUNG, KHONG thay the o chon don-nha-gia-cong hien co
         (DonHangSanXuat.NhaGiaCongID) - o do van la nguon du lieu DUY NHAT
         quyet dinh co bo qua cong doan May hay khong (tinhNextStage() trong
         qlsx.js) va hien thi o Dashboard/bao cao vendor; doi thanh nhieu gia
         tri se pha vo logic dieu huong 1-doi-1 do. Xem ghi chu chi tiet
         ngay tren khai bao route /nhagiacongchitiet trong qlsx.js.
       - Cat: them lua chon "So do" (chi hien khi don hang co > 1 dong trong
         DonHangChiTietSoDo) va bo o nhap "He so" tren tung cay - gio lay
         thang tu DonHangSanXuat.HeSoQuyDoi (server tinh, khong con tin theo
         gia tri client gui).

   Bang moi: DonHangChiTietSoDo, DonHangChiTietNhaGiaCong.
   Cot moi: DonHangSanXuat.HeSoQuyDoi, TienDoSanXuat.SoDoID (FK toi dong so
   do DA DUNG cho lan Ghi tien do Cat nay - NULL cho cac cong doan khac hoac
   don hang chua khai bao so do nao).

   An toan chay lai nhieu lan (idempotent) - dung IF COL_LENGTH/OBJECT_ID
   giong cac migration truoc.
   ================================================================ */

IF COL_LENGTH('DonHangSanXuat', 'HeSoQuyDoi') IS NULL
BEGIN
    ALTER TABLE DonHangSanXuat ADD HeSoQuyDoi DECIMAL(10,3) NOT NULL DEFAULT 1;
    PRINT 'Da them cot DonHangSanXuat.HeSoQuyDoi.';
END ELSE PRINT 'Cot DonHangSanXuat.HeSoQuyDoi da ton tai, bo qua.';
GO

IF OBJECT_ID('DonHangChiTietSoDo') IS NULL
BEGIN
    CREATE TABLE DonHangChiTietSoDo (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        MetSoDoDai   DECIMAL(10,2) NULL,
        KhoVaiSoDo   DECIMAL(10,2) NULL,
        MaRap        NVARCHAR(50) NULL,
        GhiChu       NVARCHAR(255) NULL,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang DonHangChiTietSoDo.';
END ELSE PRINT 'Bang DonHangChiTietSoDo da ton tai, bo qua.';
GO

IF COL_LENGTH('TienDoSanXuat', 'SoDoID') IS NULL
BEGIN
    ALTER TABLE TienDoSanXuat ADD SoDoID INT NULL FOREIGN KEY REFERENCES DonHangChiTietSoDo(ID);
    PRINT 'Da them cot TienDoSanXuat.SoDoID.';
END ELSE PRINT 'Cot TienDoSanXuat.SoDoID da ton tai, bo qua.';
GO

IF OBJECT_ID('DonHangChiTietNhaGiaCong') IS NULL
BEGIN
    CREATE TABLE DonHangChiTietNhaGiaCong (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        DonHangID    INT NOT NULL FOREIGN KEY REFERENCES DonHangSanXuat(DonHangID) ON DELETE CASCADE,
        NhaGiaCongID INT NOT NULL FOREIGN KEY REFERENCES NhaGiaCong(NhaGiaCongID),
        GhiChu       NVARCHAR(255) NULL,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT 'Da tao bang DonHangChiTietNhaGiaCong.';
END ELSE PRINT 'Bang DonHangChiTietNhaGiaCong da ton tai, bo qua.';
GO

-- Backfill HeSoQuyDoi cho don hang DA CO tu truoc nang cap, tu he so Cat GAN NHAT
-- da tung nhap tay cho don do (neu da co Ghi tien do Cat) - tranh SL cai tinh sai
-- lech nếu ho quay lai Sua/xem sau nang cap. Don chua tung ghi nhan Cat -> giu
-- mac dinh 1 (DEFAULT o cau ALTER TABLE tren).
UPDATE d
SET d.HeSoQuyDoi = t.HeSo
FROM DonHangSanXuat d
CROSS APPLY (
    SELECT TOP 1 c.HeSoQuyDoi AS HeSo
    FROM TienDoCatChiTietCay c
    JOIN TienDoSanXuat td ON td.TienDoID = c.TienDoID
    WHERE td.DonHangID = d.DonHangID
    ORDER BY td.TienDoID DESC
) t
WHERE t.HeSo IS NOT NULL;
PRINT 'Da backfill HeSoQuyDoi cho don hang da co tien do Cat truoc do (neu co).';
GO
