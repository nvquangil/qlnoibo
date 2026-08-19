/* ================================================================
   migration_v523.sql - Nang cap tu v5.22 len v5.23

   Sua sai kien truc v5.21 (muc 3) theo phan hoi truc tiep cua nguoi dung:

   "Sau công đoạn cắt có công đoạn giao gia công. khi đó sẽ chọn giao nhà
   làm hay giao gia công. Nếu giao gia công bên chức năng Giao gia công sẽ
   hiển thị lệnh sx như hiện tại. Nếu giao nhà làm thì chuyển sang công
   đoạn may trong ghi nhận tiến độ. Trong công đoạn may ở các công đoạn chi
   tiết có chọn giao cho nhân viên (1 công đoạn chọn nhiều nhân viên) số
   lượng. hiển thị đơn giá từ công đoạn kỹ thuật đã nhập"

   v5.21 (muc 3) dat toggle "Kenh san xuat" (NhaLam/GiaCong, cot
   DonHangSanXuat.KenhSanXuat) NGAY TAI Ky thuat (KT) - SAI vi tri theo dung
   yeu cau nay: toggle phai la 1 CONG DOAN THAT rieng, dung NGAY SAU Cat,
   TRUOC May - KHONG con o Ky thuat nua.

   1 - Them 1 CongDoanSanXuat MOI: MaCongDoan='GC', TenCongDoan='Giao gia
       công', ThuTu=30 (giua CAT=20 va MAY=70 - dung khoang trong da bo lai
       tu khi GNGC bi rut khoi day o v5.22, xem migration_v520.sql), LaHeThong=1.
       Day KHONG phai hoi sinh lai GNGC/NNGC day du (ledger nhieu nha gia
       cong/nhieu lan giao-nhan cua v5.19 VAN o nguyen, KHONG doi, van qua 2
       tab doc lap /giaonhagiacong, /nhannhagiacong) - 'GC' o day CHI la 1
       diem QUYET DINH kenh (NhaLam/GiaCong) + 1 nha gia cong dai dien/don
       gia tham khao, dung dung vai tro ma 'KT' tung lam o v5.21, chi doi
       VI TRI trong luong (tu KT chuyen sang sau CAT).

   2 - KHONG can doi schema DonHangSanXuat - KenhSanXuat/NhaGiaCongID/
       DonGiaGiaCongNgoai (da co tu migration_v521.sql/v55) dung nguyen,
       chi doi CONG DOAN nao ghi vao chung (xem backend/routes/qlsx.js POST
       /orders/:maDH/tiendo, nhanh doi tu stage.MaCongDoan==='KT' sang
       ==='GC'). Don hang DA tung mo Ky thuat va chon kenh truoc khi nang
       cap nay (KenhSanXuat da co gia tri) KHONG bi anh huong - gia tri cu
       van dung, chi lan SUA/chon LAI tiep theo moi thuc hien o 'GC' thay
       vi 'KT'.

   3 - Don hang dang o dung STAGEID cua 'KT' KHONG can chuyen di dau (KT
       van la 1 cong doan hop le, chi khong con giu vai tro quyet dinh kenh
       nua) - luong Ghi nhan tien do se tu nhien dua don di qua 'GC' (dong
       StageID MOI nay) ngay sau khi hoan tat 'Cat', truoc khi den 'May'.

   YEU CAU TIEN QUYET: da chay migration_v59.sql, migration_v520.sql,
   migration_v521.sql, migration_v522.sql (neu co) tu truoc.

   An toan chay lai nhieu lan (idempotent) - IF NOT EXISTS truoc INSERT.
   ================================================================ */

USE QLNoiBo;
GO

IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'CAT')
BEGIN
    RAISERROR(N'Khong tim thay cong doan he thong CAT trong CongDoanSanXuat - can chay migration_v520.sql truoc khi chay migration nay.', 16, 1);
    RETURN;
END
GO

IF NOT EXISTS (SELECT 1 FROM CongDoanSanXuat WHERE MaCongDoan = N'GC')
    INSERT INTO CongDoanSanXuat (TenCongDoan, ThuTu, MaCongDoan, LaHeThong) VALUES (N'Giao gia công', 30, N'GC', 1);
PRINT N'Da them (neu chua co) cong doan moi: Giao gia công (GC), ThuTu=30 - giua Cắt (20) va May (70).';
GO

PRINT N'migration_v523.sql hoan tat.';
GO
