/* ================================================================================================
   DEM SO CAY VAI / DONG PHU KIEN DANG THIEU DON GIA
   ⚠️ CHI DOC. Khong UPDATE / DELETE / INSERT. Chay bao nhieu lan cung duoc.

   Muc dich: biet QUY MO truoc khi quyet dinh cach dien gia (xem PRD_v876).
   Chay lai sau khi dien gia de doi chieu: cac con so phai giam dung bang so dong da dien.

   NHAC LAI CHO DE HIEU KET QUA:
     - Gia VAI luu o tung CAY  (VaiCay.DonGiaNhap)
     - Gia PHU KIEN luu o tung DONG phieu NHAP  (PhieuPhuKienChiTiet.DonGia)
     - Khong co cot gia nao o DanhMucVai / DanhMucPhuKien
   ================================================================================================ */

SET NOCOUNT ON;

/* ---------- 1. TONG QUAN ---------- */
SELECT N'Cay vai' AS Nhom,
       COUNT(*) AS TongDong,
       SUM(CASE WHEN ISNULL(DonGiaNhap, 0) = 0 THEN 1 ELSE 0 END) AS ThieuGia,
       SUM(CASE WHEN ISNULL(DonGiaNhap, 0) > 0 THEN 1 ELSE 0 END) AS DaCoGia
FROM VaiCay
UNION ALL
SELECT N'Dong phieu NHAP phu kien',
       COUNT(*),
       SUM(CASE WHEN ISNULL(ct.DonGia, 0) = 0 THEN 1 ELSE 0 END),
       SUM(CASE WHEN ISNULL(ct.DonGia, 0) > 0 THEN 1 ELSE 0 END)
FROM PhieuPhuKienChiTiet ct
JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
WHERE p.LoaiPhieu = N'Nhập';

/* ---------- 2. VAI: bao nhieu MA VAI co cay thieu gia ----------
   SoCayThieu = so dong se phai dien neu dien theo tung cay.
   GiaDangCo  = neu ma nay da co cay khac co gia thi day la gia tham khao de dien cho nhanh. */
SELECT dv.MaVai,
       lv.TenLoaiVai,
       ms.TenMau,
       COUNT(*)                                                          AS TongCay,
       SUM(CASE WHEN ISNULL(vc.DonGiaNhap, 0) = 0 THEN 1 ELSE 0 END)     AS SoCayThieu,
       MIN(NULLIF(vc.DonGiaNhap, 0))                                     AS GiaThapNhatDangCo,
       MAX(vc.DonGiaNhap)                                                AS GiaCaoNhatDangCo,
       COUNT(DISTINCT CASE WHEN ISNULL(vc.DonGiaNhap,0) > 0
                           THEN CAST(vc.DonGiaNhap AS NVARCHAR(50)) END) AS SoMucGiaKhacNhau
FROM VaiCay vc
JOIN DanhMucVai dv  ON dv.VaiID = vc.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
LEFT JOIN MauSac  ms ON ms.MauSacID  = dv.MauSacID
GROUP BY dv.MaVai, lv.TenLoaiVai, ms.TenMau
HAVING SUM(CASE WHEN ISNULL(vc.DonGiaNhap, 0) = 0 THEN 1 ELSE 0 END) > 0
ORDER BY SoCayThieu DESC, dv.MaVai;

/* ---------- 3. ⚠️ MA VAI CO NHIEU MUC GIA KHAC NHAU ----------
   Co dong o day => KHONG duoc dien mot gia chung cho ca ma do; gia that thay doi theo dot nhap.
   Nhung ma nay phai dien THEO TUNG CAY. */
SELECT dv.MaVai, lv.TenLoaiVai, ms.TenMau,
       COUNT(DISTINCT CAST(vc.DonGiaNhap AS NVARCHAR(50))) AS SoMucGia,
       MIN(vc.DonGiaNhap) AS GiaMin, MAX(vc.DonGiaNhap) AS GiaMax
FROM VaiCay vc
JOIN DanhMucVai dv  ON dv.VaiID = vc.VaiID
LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = dv.LoaiVaiID
LEFT JOIN MauSac  ms ON ms.MauSacID  = dv.MauSacID
WHERE ISNULL(vc.DonGiaNhap, 0) > 0
GROUP BY dv.MaVai, lv.TenLoaiVai, ms.TenMau
HAVING COUNT(DISTINCT CAST(vc.DonGiaNhap AS NVARCHAR(50))) > 1
ORDER BY SoMucGia DESC, dv.MaVai;

/* ---------- 4. 🔴 CAU HOI QUAN TRONG NHAT: DIEN GIA CO LAM TANG CONG NO NCC KHONG? ----------

   CACH HE THONG TINH NO NCC (congno.js:951-954) — doc ky, de hieu NHAM:

       SUM(KGNhap x DonGiaNhap)  cua MOI cay thuoc PhieuNhapVai CO NCC_ID

   => No phat sinh luc NHAP, KHONG lien quan den viec cay da xuat hay chua.
      (Cau "KGXuat x DonGiaNhap" o congno.js:973 la phieu TRA HANG VE NCC — GIAM no.)

   => Cay nam im trong kho chua xuat met nao, neu phieu nhap CO NCC thi dien gia vao
      la no NCC TANG NGAY.
   => Nguoc lai, cay thuoc phieu nhap KHONG gan NCC (vd ton dau ky nhap bang CLI
      nhap_ton_vai_excel.js — CLI do khong ghi NCC_ID) thi dien gia bao nhieu cung
      KHONG dung den cong no.

   DOC KET QUA:
     - Dong "KHONG co NCC"  -> dien gia an toan, cong no khong doi.
     - Dong "CO NCC"        -> TienSeTang chinh la so tien no NCC se tang them neu dien
                               het so cay do. Nhin con so nay roi hay quyet dinh. */
SELECT CASE WHEN pn.NCC_ID IS NULL THEN N'KHONG co NCC (an toan)'
            ELSE N'CO NCC -> SE TANG NO' END                 AS NhomPhieu,
       COUNT(*)                                              AS SoCayThieuGia,
       SUM(ISNULL(vc.KGNhap, 0))                             AS TongKG,
       COUNT(DISTINCT pn.PhieuNhapID)                        AS SoPhieuNhap,
       MIN(vc.NgayNhap)                                      AS NhapSomNhat,
       MAX(vc.NgayNhap)                                      AS NhapGanNhat
FROM VaiCay vc
LEFT JOIN PhieuNhapVai pn ON pn.PhieuNhapID = vc.PhieuNhapID
WHERE ISNULL(vc.DonGiaNhap, 0) = 0
GROUP BY CASE WHEN pn.NCC_ID IS NULL THEN N'KHONG co NCC (an toan)'
              ELSE N'CO NCC -> SE TANG NO' END;

/* ---------- 4b. Neu muc 4 co dong "CO NCC": chi tiet theo tung NHA CUNG CAP ----------
   TongKG x don gia se dien = so tien no tang them cua NCC do. */
SELECT ncc.TenNCC,
       COUNT(*)                   AS SoCayThieuGia,
       SUM(ISNULL(vc.KGNhap, 0))  AS TongKG,
       COUNT(DISTINCT pn.PhieuNhapID) AS SoPhieu
FROM VaiCay vc
JOIN PhieuNhapVai pn ON pn.PhieuNhapID = vc.PhieuNhapID
JOIN NhaCungCap ncc  ON ncc.NCC_ID = pn.NCC_ID
WHERE ISNULL(vc.DonGiaNhap, 0) = 0
GROUP BY ncc.TenNCC
ORDER BY TongKG DESC;

/* ---------- 4c. Phu kien: cung cau hoi ----------
   No phu kien = SUM(SoLuong x DonGia) tren phieu LoaiPhieu = N'Nhập' CO NCC_ID
   (congno.js:955-958). Cung co che voi vai. */
SELECT CASE WHEN p.NCC_ID IS NULL THEN N'KHONG co NCC (an toan)'
            ELSE N'CO NCC -> SE TANG NO' END   AS NhomPhieu,
       COUNT(*)                                AS SoDongThieuGia,
       SUM(ISNULL(ct.SoLuong, 0))              AS TongSoLuong,
       COUNT(DISTINCT p.PhieuID)               AS SoPhieu
FROM PhieuPhuKienChiTiet ct
JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
WHERE p.LoaiPhieu = N'Nhập' AND ISNULL(ct.DonGia, 0) = 0
GROUP BY CASE WHEN p.NCC_ID IS NULL THEN N'KHONG co NCC (an toan)'
              ELSE N'CO NCC -> SE TANG NO' END;

/* ---------- 5. PHU KIEN: ma nao chua co gia ----------
   "ChuaCoGiaNaoHet" = ca ma khong co bat ky dong nhap nao co gia => man Gia thanh bao thieu don gia.
   "CoDongThieu"     = co gia roi nhung van con dong nhap cu de trong (chi anh huong cong no phieu do). */
SELECT dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan,
       COUNT(ct.ID)                                                   AS SoDongNhap,
       SUM(CASE WHEN ISNULL(ct.DonGia, 0) = 0 THEN 1 ELSE 0 END)      AS SoDongThieuGia,
       MAX(ct.DonGia)                                                 AS GiaCaoNhatDangCo,
       CASE WHEN MAX(ISNULL(ct.DonGia, 0)) = 0 THEN N'CHUA CO GIA NAO'
            ELSE N'con dong le thieu' END                             AS TinhTrang
FROM DanhMucPhuKien dm
LEFT JOIN PhieuPhuKienChiTiet ct ON ct.PhuKienID = dm.PhuKienID
LEFT JOIN PhieuPhuKien p         ON p.PhieuID    = ct.PhieuID AND p.LoaiPhieu = N'Nhập'
LEFT JOIN LoaiPhuKien lpk        ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
WHERE p.PhieuID IS NOT NULL
GROUP BY dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size, dm.DonViCoBan
HAVING SUM(CASE WHEN ISNULL(ct.DonGia, 0) = 0 THEN 1 ELSE 0 END) > 0
ORDER BY TinhTrang, SoDongThieuGia DESC, dm.MaPhuKien;

/* ================================================================================================
   PHAN B — KIEM TRA KHOA KHOP CUA FILE BANG GIA
   File bang gia cua Nguyen khop theo MA LOAI VAI (LoaiVai.MaLoai) va MA PHU KIEN
   (DanhMucPhuKien.MaPhuKien). Hai cot nay KHAC nhau han ve do tin cay:
       DanhMucVai.MaVai           NOT NULL UNIQUE   <- chac chan
       DanhMucPhuKien.MaPhuKien   (kiem tra muc 9)
       LoaiVai.MaLoai             NULL duoc, KHONG UNIQUE   <- phai kiem tra truoc khi dung
   ================================================================================================ */

/* ---------- 7. 🔴 MA LOAI VAI co dung lam khoa duoc khong? ----------
   Dong nao SoLoaiVai > 1 => MOT ma loai dang tro toi NHIEU loai vai khac nhau.
   Dien gia theo ma do se ap nham sang loai vai khac. Phai xu ly tay nhung ma nay. */
SELECT ISNULL(MaLoai, N'(TRONG)') AS MaLoai,
       COUNT(*)                   AS SoLoaiVai,
       MIN(TenLoaiVai)            AS TenVanDu1,
       MAX(TenLoaiVai)            AS TenVanDu2
FROM LoaiVai
GROUP BY ISNULL(MaLoai, N'(TRONG)')
HAVING COUNT(*) > 1 OR ISNULL(MaLoai, N'(TRONG)') = N'(TRONG)'
ORDER BY SoLoaiVai DESC, MaLoai;

/* ---------- 8. Doi chieu: MOI MA LOAI VAI co bao nhieu cay thieu gia ----------
   Day la danh sach de so khop voi file bang gia. Ma loai nao co trong file ma KHONG co o day
   => file thua dong (khong co cay nao can dien). Ma loai co o day ma khong co trong file
   => con thieu gia sau khi chay. */
SELECT ISNULL(lv.MaLoai, N'(TRONG)')                             AS MaLoai,
       lv.TenLoaiVai,
       COUNT(DISTINCT dv.VaiID)                                  AS SoMaVai,
       COUNT(vc.CayID)                                           AS TongCay,
       SUM(CASE WHEN ISNULL(vc.DonGiaNhap,0) = 0 THEN 1 ELSE 0 END) AS SoCayThieuGia,
       SUM(CASE WHEN ISNULL(vc.DonGiaNhap,0) = 0 THEN ISNULL(vc.KGNhap,0) ELSE 0 END) AS KGThieuGia,
       MIN(NULLIF(vc.DonGiaNhap, 0))                             AS GiaThapNhatDangCo,
       MAX(vc.DonGiaNhap)                                        AS GiaCaoNhatDangCo
FROM LoaiVai lv
JOIN DanhMucVai dv ON dv.LoaiVaiID = lv.LoaiVaiID
JOIN VaiCay vc     ON vc.VaiID     = dv.VaiID
GROUP BY ISNULL(lv.MaLoai, N'(TRONG)'), lv.TenLoaiVai
HAVING SUM(CASE WHEN ISNULL(vc.DonGiaNhap,0) = 0 THEN 1 ELSE 0 END) > 0
ORDER BY SoCayThieuGia DESC;

/* ---------- 9. MA PHU KIEN co trung / trong khong? ---------- */
SELECT ISNULL(MaPhuKien, N'(TRONG)') AS MaPhuKien, COUNT(*) AS SoDong,
       MIN(TenPhuKien) AS TenVanDu1, MAX(TenPhuKien) AS TenVanDu2
FROM DanhMucPhuKien
GROUP BY ISNULL(MaPhuKien, N'(TRONG)')
HAVING COUNT(*) > 1 OR ISNULL(MaPhuKien, N'(TRONG)') = N'(TRONG)'
ORDER BY SoDong DESC;

/* ---------- 6. PHU KIEN CHUA TUNG CO PHIEU NHAP NAO ----------
   Nhung ma nay khong the dien gia qua phieu nhap vi khong co dong nao de dien.
   Muon co gia thi phai lap phieu nhap that (hoac bo qua neu la ma khong dung nua). */
SELECT dm.MaPhuKien, dm.TenPhuKien, lpk.TenLoai, dm.Size
FROM DanhMucPhuKien dm
LEFT JOIN LoaiPhuKien lpk ON lpk.LoaiPhuKienID = dm.LoaiPhuKienID
WHERE NOT EXISTS (
        SELECT 1 FROM PhieuPhuKienChiTiet ct
        JOIN PhieuPhuKien p ON p.PhieuID = ct.PhieuID
        WHERE ct.PhuKienID = dm.PhuKienID AND p.LoaiPhieu = N'Nhập')
ORDER BY dm.MaPhuKien;
