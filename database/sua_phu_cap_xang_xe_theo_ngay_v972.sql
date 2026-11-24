/* ================================================================================================
   🔴🔴🔴 LAI CAN CHAY — v9.79 (19/11/2026) Nguyen CHOT LAI: xang xe = so tien /1 NGAY x ngay cong thuc te.
   (Ban v9.78 "tinh theo km" da bi bo; ghi chu "het hieu luc" dan o day luc 19/11 nay KHONG con dung.)
   => Cot HopDongLaoDong.PhuCapXangXe LAI la DON GIA NGAY va LAI duoc dung de tinh luong.
   => Hop dong khai tu truoc v9.72 dang ghi SO THANG (vd 540.000). Neu khong chia, bang luong se tra
      540.000 x 27 = 14.580.000 tien xang MOT NGUOI. CHAY FILE NAY (hoac sua tay) TRUOC KHI TINH LUONG.
   Bang luong co luoi chan: dong canh bao "TRA THUA" liet ke moi hop dong con khai >= 100.000 d/ngay.
   ================================================================================================
   sua_phu_cap_xang_xe_theo_ngay_v972.sql — (Nguyen 17/11/2026) doi HopDongLaoDong.PhuCapXangXe tu SO THANG sang DON GIA NGAY.

   v9.72 doi luat: xang xe = PhuCapXangXe (dong/NGAY) x so cong di lam thuc te. Hop dong khai TRUOC v9.72 ghi SO THANG
   (vd 540.000 = 20.000 x 27). Khong tu chia trong code (khong biet hop dong nao da sua tay). File nay:
     KHOI A: xem hop dong hieu luc co PhuCapXangXe > 0 kem so "neu chia @CC". Hop dong nao da ghi don gia ngay roi
             (vd 20.000) thi THEM vao danh sach loai tru o KHOI B (hoac sua tay tren form).
     KHOI B: UPDATE PhuCapXangXe = ROUND(PhuCapXangXe / @CC, -3) cho hop dong HIEU LUC co PhuCapXangXe >= @NguongThang
             (mac dinh 100.000 — so nho hon coi nhu da la don gia ngay). Mac dinh ROLLBACK.
   Doi nguoc: lay cot PhuCapXangXe_Cu trong ket qua KHOI A (luu ra Excel truoc khi COMMIT).
   ================================================================================================ */
DECLARE @CC DECIMAL(5,1) = 27;              -- cong chuan da dung khi khai so thang (26 hay 27 — anh chot)
DECLARE @NguongThang DECIMAL(14,2) = 100000; -- >= nguong nay coi la SO THANG can chia; nho hon = da la don gia ngay

/* =============================== KHOI A — XEM TRUOC =============================== */
SELECT h.HopDongID, nv.MaNhanVien, nv.HoTen, h.SoHopDong, h.TrangThai,
       h.PhuCapXangXe AS PhuCapXangXe_Cu,
       CASE WHEN h.PhuCapXangXe >= @NguongThang THEN ROUND(h.PhuCapXangXe / @CC, -3) ELSE h.PhuCapXangXe END AS PhuCapXangXe_Moi_DonGiaNgay,
       CASE WHEN h.PhuCapXangXe >= @NguongThang THEN N'SE CHIA' ELSE N'giu nguyen (da la don gia ngay?)' END AS XuLy
FROM HopDongLaoDong h JOIN NhanVien nv ON nv.NhanVienID = h.NhanVienID
WHERE ISNULL(h.PhuCapXangXe, 0) > 0
ORDER BY h.TrangThai, nv.HoTen;

/* =============================== KHOI B — DOI (mac dinh ROLLBACK) =============================== */
BEGIN TRAN;
UPDATE h SET h.PhuCapXangXe = ROUND(h.PhuCapXangXe / @CC, -3)
FROM HopDongLaoDong h
WHERE h.TrangThai = N'Hiệu lực' AND ISNULL(h.PhuCapXangXe, 0) >= @NguongThang
  AND h.HopDongID NOT IN (0 /* , <HopDongID da sua tay> */);
PRINT CONCAT(N'Da doi ', @@ROWCOUNT, N' hop dong (chua commit).');
SELECT h.HopDongID, nv.HoTen, h.PhuCapXangXe FROM HopDongLaoDong h JOIN NhanVien nv ON nv.NhanVienID = h.NhanVienID
WHERE h.TrangThai = N'Hiệu lực' AND ISNULL(h.PhuCapXangXe, 0) > 0 ORDER BY nv.HoTen;
ROLLBACK;   -- <== dung roi thi doi thanh COMMIT; va chay lai KHOI B. Sau COMMIT: mo tab Luong cong nhat de bang tu tinh lai.
-- COMMIT;
