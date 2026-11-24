/* ================================================================================================
   sua_phieu_ton_dau_ky_vai_pk_v966.sql — (Nguyen 16/11/2026) go NCC khoi cac PHIEU NHAP VAI (va PHIEU NHAP
   PHU KIEN) dang gan NCC gia "Nhập tồn kho vải đầu kỳ" / "Nhập tồn kho phụ kiện đầu kỳ" -> ra khoi cong no NCC.

   KHAC voi hang hoa: PhieuNhapVai / PhieuPhuKien KHONG co cot LoaiNhap. Cong no NCC chi cong phieu co
   NCC_ID IS NOT NULL (routes/congno.js congNoNCC + soChiTietNCC), nen chi can dat NCC_ID = NULL.
   Phan mem (ca ban dang chay) da cho phep luu phieu nhap vai KHONG chon NCC; v9.66 chi doi nhan option
   thanh "-- Không có (tồn đầu kỳ / nhập khác — không vào công nợ) --" trong module.khovai.js.

   Nhan dien: ten NCC chua "tồn kho vải đầu kỳ" / "tồn kho phụ kiện đầu kỳ" / "tồn đầu kỳ" (ca hai cach viet hoa/hoá).
   NEU ke toan dat ten NCC gia khac -> sua dong LIKE o ca 3 khoi cho khop, hoac gui ten NCC de viet lai.

   CACH CHAY (SSMS, CSDL QLNoiBo):
     1. Chay KHOI A (chi SELECT). Xem danh sach NCC khop + tung phieu. Thua/thieu thi DUNG, bao lai.
     2. LUU KET QUA KHOI A (copy ra Excel) — day la bang doi nguoc (PhieuNhapID -> NCC_ID cu).
     3. Chay KHOI B: mo transaction, UPDATE, in so dong, ROLLBACK (mac dinh). Dung roi thi doi ROLLBACK -> COMMIT, chay lai.
   Doi nguoc (neu lo): UPDATE PhieuNhapVai SET NCC_ID = <id cu> WHERE PhieuNhapID = <id>;  (tuong tu PhieuPhuKien theo PhieuID)
   ================================================================================================ */

/* =============================== KHOI A — XEM TRUOC (khong doi gi) =============================== */
-- A1. NCC gia se bi go khoi phieu
SELECT n.NCC_ID, n.TenNCC
FROM NhaCungCap n
WHERE n.TenNCC LIKE N'%tồn kho vải đầu kỳ%'
   OR n.TenNCC LIKE N'%tồn kho phụ kiện đầu kỳ%'
   OR n.TenNCC LIKE N'%tồn đầu kỳ%';

-- A2. Phieu nhap VAI dang gan cac NCC do (LUU LAI de doi nguoc)
SELECT pn.PhieuNhapID, pn.NgayNhap, pn.NCC_ID, n.TenNCC, pn.SoHoaDon, pn.GhiChu,
       (SELECT COUNT(*) FROM VaiCay vc WHERE vc.PhieuNhapID = pn.PhieuNhapID) AS SoCay
FROM PhieuNhapVai pn
JOIN NhaCungCap n ON n.NCC_ID = pn.NCC_ID
WHERE n.TenNCC LIKE N'%tồn kho vải đầu kỳ%' OR n.TenNCC LIKE N'%tồn kho phụ kiện đầu kỳ%' OR n.TenNCC LIKE N'%tồn đầu kỳ%'
ORDER BY pn.NgayNhap, pn.PhieuNhapID;

-- A3. Phieu nhap PHU KIEN dang gan cac NCC do (LUU LAI de doi nguoc)
SELECT p.PhieuID, p.Ngay, p.LoaiPhieu, p.NCC_ID, n.TenNCC, p.SoHoaDon, p.GhiChu
FROM PhieuPhuKien p
JOIN NhaCungCap n ON n.NCC_ID = p.NCC_ID
WHERE p.LoaiPhieu = N'Nhập'
  AND (n.TenNCC LIKE N'%tồn kho vải đầu kỳ%' OR n.TenNCC LIKE N'%tồn kho phụ kiện đầu kỳ%' OR n.TenNCC LIKE N'%tồn đầu kỳ%')
ORDER BY p.Ngay, p.PhieuID;

-- A4. Tong so phieu / NCC (doi chieu voi man Cong no NCC truoc/sau)
SELECT n.NCC_ID, n.TenNCC,
       (SELECT COUNT(*) FROM PhieuNhapVai pn WHERE pn.NCC_ID = n.NCC_ID) AS SoPhieuVai,
       (SELECT COUNT(*) FROM PhieuPhuKien p WHERE p.NCC_ID = n.NCC_ID AND p.LoaiPhieu = N'Nhập') AS SoPhieuPK,
       (SELECT COUNT(*) FROM PhieuChi c WHERE c.NCC_ID = n.NCC_ID AND c.LoaiDoiTuong = N'NhaCungCap') AS SoPhieuChi_PhaiLa0
FROM NhaCungCap n
WHERE n.TenNCC LIKE N'%tồn kho vải đầu kỳ%' OR n.TenNCC LIKE N'%tồn kho phụ kiện đầu kỳ%' OR n.TenNCC LIKE N'%tồn đầu kỳ%';
-- SoPhieuChi_PhaiLa0 > 0 nghia la da tung CHI TIEN cho NCC gia nay -> DUNG LAI, xem lai truoc khi go.

/* =============================== KHOI B — GO NCC (mac dinh ROLLBACK) =============================== */
BEGIN TRAN;

UPDATE pn
SET pn.NCC_ID = NULL
FROM PhieuNhapVai pn
JOIN NhaCungCap n ON n.NCC_ID = pn.NCC_ID
WHERE n.TenNCC LIKE N'%tồn kho vải đầu kỳ%' OR n.TenNCC LIKE N'%tồn kho phụ kiện đầu kỳ%' OR n.TenNCC LIKE N'%tồn đầu kỳ%';
PRINT CONCAT(N'Phieu nhap vai da go NCC: ', @@ROWCOUNT, N' (chua commit).');

UPDATE p
SET p.NCC_ID = NULL
FROM PhieuPhuKien p
JOIN NhaCungCap n ON n.NCC_ID = p.NCC_ID
WHERE p.LoaiPhieu = N'Nhập'
  AND (n.TenNCC LIKE N'%tồn kho vải đầu kỳ%' OR n.TenNCC LIKE N'%tồn kho phụ kiện đầu kỳ%' OR n.TenNCC LIKE N'%tồn đầu kỳ%');
PRINT CONCAT(N'Phieu nhap phu kien da go NCC: ', @@ROWCOUNT, N' (chua commit).');

-- Kiem lai: phai ra 0 / 0
SELECT (SELECT COUNT(*) FROM PhieuNhapVai pn JOIN NhaCungCap n ON n.NCC_ID = pn.NCC_ID
          WHERE n.TenNCC LIKE N'%tồn kho vải đầu kỳ%' OR n.TenNCC LIKE N'%tồn kho phụ kiện đầu kỳ%' OR n.TenNCC LIKE N'%tồn đầu kỳ%') AS ConSotVai,
       (SELECT COUNT(*) FROM PhieuPhuKien p JOIN NhaCungCap n ON n.NCC_ID = p.NCC_ID
          WHERE p.LoaiPhieu = N'Nhập'
            AND (n.TenNCC LIKE N'%tồn kho vải đầu kỳ%' OR n.TenNCC LIKE N'%tồn kho phụ kiện đầu kỳ%' OR n.TenNCC LIKE N'%tồn đầu kỳ%')) AS ConSotPK;

ROLLBACK;   -- <== doc ket qua tren. Dung roi thi doi dong nay thanh COMMIT; va chay lai KHOI B.
-- COMMIT;

/* Sau COMMIT (tuy chon): NCC gia khong con phieu nao -> xoa trong Danh muc -> Nha cung cap bang giao dien.
   Gia nhap vai (VaiCay.DonGiaNhap) va gia von KHONG doi — chi go lien ket NCC. */
