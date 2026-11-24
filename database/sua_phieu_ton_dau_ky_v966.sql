/* ================================================================================================
   sua_phieu_ton_dau_ky_v966.sql — (Nguyen 16/11/2026) chuyen cac PHIEU NHAP KHO HANG HOA dang la
   "Tu nha cung cap" ma thuc chat la NHAP TON DAU KY sang loai moi 'TonDauKy' (v9.66) -> ra khoi cong no NCC.

   Nhan dien: NCC co ten "Nhập tồn kho hàng hoá đầu kỳ" (ke toan tao NCC gia de co cho nhap), hoac ghi chu
   dau phieu co cau do. Chi dong phieu LoaiNhap = 'NhaCungCap', chua huy.

   CACH CHAY (SSMS, CSDL QLNoiBo):
     1. Chay KHOI A (chi SELECT) -> xem danh sach phieu se doi. Thay thua/thieu phieu nao thi bao, DUNG chay tiep.
     2. Dung thi chay KHOI B. Khoi B mo transaction, in so dong doi, roi ROLLBACK (mac dinh an toan).
        Doc ket qua. Dung thi sua dong cuoi: ROLLBACK -> COMMIT, chay lai.
   Doi nguoc lai (neu lo): UPDATE PhieuNhapKhoHang SET LoaiNhap=N'NhaCungCap', NCC_ID=<id NCC cu> WHERE PhieuNKID IN (...)
   — id NCC cu nam trong cot NCC_ID cua KHOI A, luu ket qua KHOI A truoc khi COMMIT.

   Sau khi COMMIT: man Cong no NCC bo ngay cac phieu nay (ke ca khi chua copy v9.66 — cong no chi cong 'NhaCungCap');
   man Phieu nhap kho hien dung nhan "Ton dau ky / khac" khi da copy module.nhapkho.js 9.66. Gia von BQGQ cua cac ma
   tren phieu KHONG doi sau khi deploy v9.66 (giaNhapHangHoa.js gom ca TonDauKy); giua luc UPDATE va deploy thi tam
   thoi khong tinh — khong sao vi gia von da chot trong bang GiaVonHangHoa, chi tinh lai khi luu/sua phieu.
   ================================================================================================ */

/* =============================== KHOI A — XEM TRUOC (khong doi gi) =============================== */
SELECT p.PhieuNKID, p.SoPhieu, p.NgayNhap, p.LoaiNhap, p.NCC_ID, n.TenNCC, p.TongSLCai, p.TongTien, p.GhiChu, p.TrangThai
FROM PhieuNhapKhoHang p
LEFT JOIN NhaCungCap n ON n.NCC_ID = p.NCC_ID
WHERE p.LoaiNhap = N'NhaCungCap'
  AND p.TrangThai <> N'Đã hủy'
  AND (
        n.TenNCC LIKE N'%Nhập tồn kho hàng hoá đầu kỳ%' OR n.TenNCC LIKE N'%Nhập tồn kho hàng hóa đầu kỳ%'
     OR p.GhiChu LIKE N'%Nhập tồn kho hàng hoá đầu kỳ%' OR p.GhiChu LIKE N'%Nhập tồn kho hàng hóa đầu kỳ%'
  )
ORDER BY p.NgayNhap, p.PhieuNKID;

-- Tong tien se RUT khoi cong no tung NCC (doi chieu voi man Cong no NCC truoc/sau):
SELECT n.NCC_ID, n.TenNCC, COUNT(*) AS SoPhieu, SUM(p.TongTien) AS TongTien
FROM PhieuNhapKhoHang p
LEFT JOIN NhaCungCap n ON n.NCC_ID = p.NCC_ID
WHERE p.LoaiNhap = N'NhaCungCap' AND p.TrangThai <> N'Đã hủy'
  AND (n.TenNCC LIKE N'%Nhập tồn kho hàng hoá đầu kỳ%' OR n.TenNCC LIKE N'%Nhập tồn kho hàng hóa đầu kỳ%'
    OR p.GhiChu LIKE N'%Nhập tồn kho hàng hoá đầu kỳ%' OR p.GhiChu LIKE N'%Nhập tồn kho hàng hóa đầu kỳ%')
GROUP BY n.NCC_ID, n.TenNCC;

/* =============================== KHOI B — DOI LOAI (mac dinh ROLLBACK) =============================== */
BEGIN TRAN;

UPDATE p
SET p.LoaiNhap = N'TonDauKy',
    p.NCC_ID   = NULL
FROM PhieuNhapKhoHang p
LEFT JOIN NhaCungCap n ON n.NCC_ID = p.NCC_ID
WHERE p.LoaiNhap = N'NhaCungCap'
  AND p.TrangThai <> N'Đã hủy'
  AND (
        n.TenNCC LIKE N'%Nhập tồn kho hàng hoá đầu kỳ%' OR n.TenNCC LIKE N'%Nhập tồn kho hàng hóa đầu kỳ%'
     OR p.GhiChu LIKE N'%Nhập tồn kho hàng hoá đầu kỳ%' OR p.GhiChu LIKE N'%Nhập tồn kho hàng hóa đầu kỳ%'
  );

PRINT CONCAT(N'Da doi ', @@ROWCOUNT, N' phieu sang TonDauKy (chua commit).');

-- Kiem lai: khong con phieu nao khop ma van la NhaCungCap
SELECT COUNT(*) AS ConSotPhieu
FROM PhieuNhapKhoHang p LEFT JOIN NhaCungCap n ON n.NCC_ID = p.NCC_ID
WHERE p.LoaiNhap = N'NhaCungCap' AND p.TrangThai <> N'Đã hủy'
  AND (n.TenNCC LIKE N'%Nhập tồn kho hàng ho_ đầu kỳ%' OR p.GhiChu LIKE N'%Nhập tồn kho hàng ho_ đầu kỳ%');

ROLLBACK;   -- <== doc ket qua tren. Dung roi thi doi dong nay thanh COMMIT; va chay lai KHOI B.
-- COMMIT;

/* Sau COMMIT (tuy chon): NCC gia "Nhập tồn kho hàng hoá đầu kỳ" nay khong con phieu nao -> xoa trong Danh muc
   -> Nha cung cap bang giao dien (neu con phieu chi / dieu chinh gan NCC do thi phan mem se chan — de nguyen). */
