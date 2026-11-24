/* ==================================================================================================
   migration_v894.sql — v9.62: HOP DONG MUA BAN GIAI DOAN 2 (Nguyen 14/11/2026: "làm luôn giai đoạn 2")
   --------------------------------------------------------------------------------------------------
   · Phu luc / Bien ban thanh ly: LoaiVanBan (HopDong | PhuLuc | ThanhLy) + HopDongChaID (van ban goc).
   · Hoa don: SoHoaDon / NgayHoaDon ghi tay sau khi ky (ke toan doi chieu voi hoa don dien tu).
   · Nhac han ky tu dong: NhacLanCuoi (utils/nhacHanKy.js, node-cron).
   · Ky tu xa qua CA (VNPT SmartCA / CSC): BenKy.KyTuXaNha + KyTuXaUserId; ChuoiTinCay = ket qua kiem chuoi tin cay
     chung thu (utils/chuoiTinCay.js) de in len trang chung nhan.
   · Them 2 mau: PHULUC_CHUAN, THANHLY_CHUAN (chi chen khi chua co).
   🔴 Chay SAU migration_v893. Moi lenh gac IF — chay lai nhieu lan an toan. Sau do: pm2 restart.
   ================================================================================================== */
PRINT '=== migration_v894: hop dong mua ban giai doan 2 (v9.62) ===';
GO
IF OBJECT_ID('HopDongMB') IS NULL BEGIN RAISERROR (N'!! Chua chay migration_v893 (bang HopDongMB chua co).', 16, 1); END
GO
IF COL_LENGTH('HopDongMB', 'LoaiVanBan') IS NULL BEGIN ALTER TABLE HopDongMB ADD LoaiVanBan NVARCHAR(10) NOT NULL CONSTRAINT DF_HopDongMB_LoaiVanBan DEFAULT N'HopDong'; PRINT '  + HopDongMB.LoaiVanBan'; END ELSE PRINT '  = HopDongMB.LoaiVanBan da co';
GO
IF COL_LENGTH('HopDongMB', 'HopDongChaID') IS NULL BEGIN ALTER TABLE HopDongMB ADD HopDongChaID INT NULL; PRINT '  + HopDongMB.HopDongChaID'; END ELSE PRINT '  = HopDongMB.HopDongChaID da co';
GO
IF COL_LENGTH('HopDongMB', 'SoHoaDon') IS NULL BEGIN ALTER TABLE HopDongMB ADD SoHoaDon NVARCHAR(50) NULL; PRINT '  + HopDongMB.SoHoaDon'; END ELSE PRINT '  = HopDongMB.SoHoaDon da co';
GO
IF COL_LENGTH('HopDongMB', 'NgayHoaDon') IS NULL BEGIN ALTER TABLE HopDongMB ADD NgayHoaDon DATE NULL; PRINT '  + HopDongMB.NgayHoaDon'; END ELSE PRINT '  = HopDongMB.NgayHoaDon da co';
GO
IF COL_LENGTH('HopDongMB', 'NhacLanCuoi') IS NULL BEGIN ALTER TABLE HopDongMB ADD NhacLanCuoi DATETIME2 NULL; PRINT '  + HopDongMB.NhacLanCuoi'; END ELSE PRINT '  = HopDongMB.NhacLanCuoi da co';
GO
IF COL_LENGTH('HopDongMBBenKy', 'KyTuXaNha') IS NULL BEGIN ALTER TABLE HopDongMBBenKy ADD KyTuXaNha NVARCHAR(20) NULL; PRINT '  + HopDongMBBenKy.KyTuXaNha'; END ELSE PRINT '  = HopDongMBBenKy.KyTuXaNha da co';
GO
IF COL_LENGTH('HopDongMBBenKy', 'KyTuXaUserId') IS NULL BEGIN ALTER TABLE HopDongMBBenKy ADD KyTuXaUserId NVARCHAR(100) NULL; PRINT '  + HopDongMBBenKy.KyTuXaUserId'; END ELSE PRINT '  = HopDongMBBenKy.KyTuXaUserId da co';
GO
IF COL_LENGTH('HopDongMBBenKy', 'ChuoiTinCay') IS NULL BEGIN ALTER TABLE HopDongMBBenKy ADD ChuoiTinCay NVARCHAR(300) NULL; PRINT '  + HopDongMBBenKy.ChuoiTinCay'; END ELSE PRINT '  = HopDongMBBenKy.ChuoiTinCay da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_HopDongMB_LoaiVanBan')
BEGIN
    ALTER TABLE HopDongMB WITH CHECK ADD CONSTRAINT CK_HopDongMB_LoaiVanBan CHECK (LoaiVanBan IN (N'HopDong', N'PhuLuc', N'ThanhLy'));
    PRINT '  + CK_HopDongMB_LoaiVanBan';
END ELSE PRINT '  = CK_HopDongMB_LoaiVanBan da co';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HopDongMB_Cha')
BEGIN
    CREATE INDEX IX_HopDongMB_Cha ON HopDongMB(HopDongChaID);
    PRINT '  + IX_HopDongMB_Cha';
END
GO

/* ---------- Mau phu luc / thanh ly (chi chen khi chua co; ke toan sua trong phan mem) ---------- */
IF OBJECT_ID('MauHopDongMB') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM MauHopDongMB WHERE MaMau = N'PHULUC_CHUAN')
BEGIN
    INSERT INTO MauHopDongMB (MaMau, TenMau, NoiDung, PhienBan) VALUES (N'PHULUC_CHUAN', N'Phụ lục hợp đồng mua bán (mẫu chuẩn)', N'
<p style="text-align:center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b></p>
<p style="text-align:center"><b>PHỤ LỤC HỢP ĐỒNG</b><br>Số: {{SoHopDong}} — của Hợp đồng số {{HopDongCha_So}} ký ngày {{HopDongCha_Ngay}}</p>
<p>Hôm nay, ngày {{NgayKy}}, tại {{DiaDiemKy}}, chúng tôi gồm:</p>
<p><b>BÊN BÁN (Bên A):</b> {{BenBan_Ten}} — MST {{BenBan_MST}} — Đại diện: {{BenBan_NguoiDaiDien}}, {{BenBan_ChucVu}}</p>
<p><b>BÊN MUA (Bên B):</b> {{BenMua_Ten}} — MST/ĐKKD {{BenMua_MST}} {{BenMua_SoDKKD}} — Đại diện: {{BenMua_NguoiDaiDien}}, {{BenMua_ChucVu}}</p>
<p>Hai bên thống nhất sửa đổi, bổ sung Hợp đồng số {{HopDongCha_So}} như sau:</p>
<p><b>Điều 1. Nội dung sửa đổi, bổ sung</b><br>{{NoiDungSuaDoi}}</p>
{{BangHang}}
<p>Giá trị phụ lục: <b>{{TongTien}}</b> đồng (bằng chữ: {{TongTienBangChu}}).</p>
<p><b>Điều 2. Điều khoản khác</b><br>Các điều khoản khác của Hợp đồng số {{HopDongCha_So}} không thay đổi. Phụ lục là một phần không tách rời của hợp đồng, có hiệu lực từ ngày ký. Các bên ký phụ lục bằng phương thức điện tử (OTP / chữ ký số) như đã thỏa thuận tại hợp đồng.</p>
<table style="width:100%;margin-top:24px"><tr><td style="width:50%;text-align:center"><b>ĐẠI DIỆN BÊN A</b><br><i>(ký số)</i><br><br><br><br>{{BenBan_NguoiDaiDien}}</td><td style="width:50%;text-align:center"><b>ĐẠI DIỆN BÊN B</b><br><i>(ký điện tử / ký số)</i><br><br><br><br>{{BenMua_NguoiDaiDien}}</td></tr></table>
');
    PRINT '  + Mau PHULUC_CHUAN';
END ELSE PRINT '  = Mau PHULUC_CHUAN da co (hoac chua co bang)';
GO
IF OBJECT_ID('MauHopDongMB') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM MauHopDongMB WHERE MaMau = N'THANHLY_CHUAN')
BEGIN
    INSERT INTO MauHopDongMB (MaMau, TenMau, NoiDung, PhienBan) VALUES (N'THANHLY_CHUAN', N'Biên bản thanh lý hợp đồng mua bán (mẫu chuẩn)', N'
<p style="text-align:center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b></p>
<p style="text-align:center"><b>BIÊN BẢN THANH LÝ HỢP ĐỒNG</b><br>Số: {{SoHopDong}} — thanh lý Hợp đồng số {{HopDongCha_So}} ký ngày {{HopDongCha_Ngay}}</p>
<p>Hôm nay, ngày {{NgayKy}}, tại {{DiaDiemKy}}, chúng tôi gồm:</p>
<p><b>BÊN BÁN (Bên A):</b> {{BenBan_Ten}} — MST {{BenBan_MST}} — Đại diện: {{BenBan_NguoiDaiDien}}, {{BenBan_ChucVu}}</p>
<p><b>BÊN MUA (Bên B):</b> {{BenMua_Ten}} — MST/ĐKKD {{BenMua_MST}} {{BenMua_SoDKKD}} — Đại diện: {{BenMua_NguoiDaiDien}}, {{BenMua_ChucVu}}</p>
<p><b>Điều 1. Kết quả thực hiện hợp đồng</b><br>{{KetQuaThucHien}}</p>
<p><b>Điều 2. Nghĩa vụ còn lại</b><br>Giá trị đã thanh toán: {{DaThanhToan}} đồng. Còn phải thanh toán: {{ConPhaiThanhToan}} đồng, thời hạn: {{ThoiHanThanhToanConLai}}. {{NghiaVuKhac}}</p>
<p><b>Điều 3. Hiệu lực</b><br>Hai bên thống nhất thanh lý Hợp đồng số {{HopDongCha_So}} kể từ ngày ký biên bản này; không bên nào còn khiếu nại gì ngoài các nghĩa vụ nêu tại Điều 2. Biên bản ký bằng phương thức điện tử (OTP / chữ ký số) như đã thỏa thuận tại hợp đồng.</p>
<table style="width:100%;margin-top:24px"><tr><td style="width:50%;text-align:center"><b>ĐẠI DIỆN BÊN A</b><br><i>(ký số)</i><br><br><br><br>{{BenBan_NguoiDaiDien}}</td><td style="width:50%;text-align:center"><b>ĐẠI DIỆN BÊN B</b><br><i>(ký điện tử / ký số)</i><br><br><br><br>{{BenMua_NguoiDaiDien}}</td></tr></table>
');
    PRINT '  + Mau THANHLY_CHUAN';
END ELSE PRINT '  = Mau THANHLY_CHUAN da co (hoac chua co bang)';
GO
PRINT '=== migration_v894 xong. pm2 restart qlnoibo ===';
GO
