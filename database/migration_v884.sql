/* ================================================================================================
   migration_v884.sql   (v9.08)  —  HÀNG MẪU: ĐÁNH DẤU "KHÁCH MUA LUÔN" Ở CẤP DÒNG
   ------------------------------------------------------------------------------------------------
   Nguyen 2026-10-27: "những mẫu khách mua luôn thì xử lý như thế nào để theo dõi" → chốt: đánh dấu
   "đã chốt bán" ở CẤP DÒNG (PhieuBanHangChiTiet), theo SỐ LƯỢNG.

   VÌ SAO KHÔNG ĐỤNG TIỀN / TỒN: phiếu "Gửi mẫu" vốn là phiếu bán hàng bình thường có cờ
   PhieuBanHang.LaHangMau (migration_v693) — nó ĐÃ trừ tồn và ĐÃ ghi công nợ đủ giá. Khách mua luôn
   nghĩa là KHÔNG CÒN GÌ PHẢI LÀM về số liệu; chỉ còn một việc: cho dòng đó RỜI sổ "Hàng mẫu ở
   khách", vì sổ ấy chỉ biết trừ khi có phiếu nhập lại. Nên 3 cột dưới đây thuần TRẠNG THÁI THEO DÕI,
   không tham gia bất kỳ phép tính tiền hay tồn kho nào.

   🔴 HỆ QUẢ PHẢI NHỚ: từ v9.08 công thức dùng chung ở utils/dongDaBanChoKhach.js đổi thành
        Còn ở khách / Còn trả được = SoLuongCai − DaTraCai − MauDaChotCai
      Tức dòng đã chốt bán thì KHÔNG trả lại được nữa (đúng: hàng đã bán đứt). Hai màn Sổ hàng mẫu
      và Phiếu nhập lại dùng CHUNG một công thức nên không thể lệch nhau.

   Cột mới (PhieuBanHangChiTiet) — đều NULL được, không backfill, dữ liệu cũ giữ nguyên:
     MauDaChotCai   INT            — số CÁI khách mua luôn (cùng đơn vị với SoLuongCai, KHÔNG phải Ri)
     MauChotNgay    DATE           — ngày chốt, để tính "gửi bao lâu thì chốt"
     MauChotGhiChu  NVARCHAR(200)  — lý do / người chốt, tự do

   Chạy: SSMS trên database QLNoiBo. Có guard, chạy lại nhiều lần vô hại. Sau đó pm2 restart + Ctrl+F5.
   ================================================================================================ */
USE QLNoiBo;
GO
PRINT '=== migration_v884: PhieuBanHangChiTiet — chot ban hang mau ===';
GO
IF COL_LENGTH('PhieuBanHangChiTiet', 'MauDaChotCai') IS NULL
BEGIN
    ALTER TABLE PhieuBanHangChiTiet ADD MauDaChotCai INT NULL;
    PRINT '  + Cot PhieuBanHangChiTiet.MauDaChotCai';
END
ELSE PRINT '  = Cot PhieuBanHangChiTiet.MauDaChotCai da co';
GO
IF COL_LENGTH('PhieuBanHangChiTiet', 'MauChotNgay') IS NULL
BEGIN
    ALTER TABLE PhieuBanHangChiTiet ADD MauChotNgay DATE NULL;
    PRINT '  + Cot PhieuBanHangChiTiet.MauChotNgay';
END
ELSE PRINT '  = Cot PhieuBanHangChiTiet.MauChotNgay da co';
GO
IF COL_LENGTH('PhieuBanHangChiTiet', 'MauChotGhiChu') IS NULL
BEGIN
    ALTER TABLE PhieuBanHangChiTiet ADD MauChotGhiChu NVARCHAR(200) NULL;
    PRINT '  + Cot PhieuBanHangChiTiet.MauChotGhiChu';
END
ELSE PRINT '  = Cot PhieuBanHangChiTiet.MauChotGhiChu da co';
GO
PRINT '=== xong migration_v884 ===';
GO
