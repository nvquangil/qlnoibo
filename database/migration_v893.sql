/* ==================================================================================================
   migration_v893.sql — v9.61: HOP DONG MUA BAN + KY DIEN TU QUA LINK (Nguyen 14/11/2026)
   --------------------------------------------------------------------------------------------------
   Nguyen 14/11: "ky ket hop dong mua ban voi cong ty va ho kinh doanh; phan he tao hop dong va ky hop
   dong, gui link ky; ben khong co chu ky so ky OTP (SMS / Zalo / Gmail), ben co chu ky so (USB token)
   ky truc tiep; MOYN ky so tu dong + dau thoi gian; trang quan tri (loc Cho ky / Da ky / Chua thanh
   toan, gui lai OTP/link, nhat ky ai xem luc nao IP nao, tai PDF du chu ky so); portal khach
   (responsive, bang chi tiet, o OTP, nut Toi dong y ky ket, tai PDF); soan hop dong RIENG khong lien
   quan don hang si; tai file mau len nhu hop dong lao dong, dien cac truong nhap vao."
   PRD: docs/PRD_v961_hop_dong_mua_ban_ky_dien_tu.md. Thiet ke: 1 hop dong = 1 ben MOYN + 1 ben khach;
   khach ky truoc (OTP hoac ky so), MOYN ky so sau cung (tu dong PFX/PKCS#11, hoac nguoi co quyen ky
   bang cong cu MOYN Ky so / tai len).

   🔴 Moi lenh gac IF — chay lai nhieu lan an toan. Sau khi chay: pm2 restart (server.js gan route moi).
   🔴 File PDF KHONG nam trong CSDL: backend/uploads_hopdong/ (ngoai uploads/, KHONG static) — sao luu
      cung luc voi CSDL nhu uploads_hr.
   ================================================================================================== */
PRINT '=== migration_v893: hop dong mua ban + ky dien tu (v9.61) ===';
GO

/* ---------- 1. KhachHang: thong tin ben mua de dien hop dong (cong ty / ho kinh doanh / ca nhan) ---------- */
IF COL_LENGTH('KhachHang', 'LoaiDoiTac') IS NULL BEGIN ALTER TABLE KhachHang ADD LoaiDoiTac NVARCHAR(10) NULL; PRINT '  + KhachHang.LoaiDoiTac (CongTy | HoKD | CaNhan)'; END ELSE PRINT '  = KhachHang.LoaiDoiTac da co';
GO
IF COL_LENGTH('KhachHang', 'NguoiDaiDien') IS NULL BEGIN ALTER TABLE KhachHang ADD NguoiDaiDien NVARCHAR(150) NULL; PRINT '  + KhachHang.NguoiDaiDien'; END ELSE PRINT '  = KhachHang.NguoiDaiDien da co';
GO
IF COL_LENGTH('KhachHang', 'ChucVuNDD') IS NULL BEGIN ALTER TABLE KhachHang ADD ChucVuNDD NVARCHAR(100) NULL; PRINT '  + KhachHang.ChucVuNDD'; END ELSE PRINT '  = KhachHang.ChucVuNDD da co';
GO
IF COL_LENGTH('KhachHang', 'SoCCCD') IS NULL BEGIN ALTER TABLE KhachHang ADD SoCCCD NVARCHAR(20) NULL; PRINT '  + KhachHang.SoCCCD'; END ELSE PRINT '  = KhachHang.SoCCCD da co';
GO
IF COL_LENGTH('KhachHang', 'SoDKKD') IS NULL BEGIN ALTER TABLE KhachHang ADD SoDKKD NVARCHAR(50) NULL; PRINT '  + KhachHang.SoDKKD'; END ELSE PRINT '  = KhachHang.SoDKKD da co';
GO
IF COL_LENGTH('KhachHang', 'NgayCapDKKD') IS NULL BEGIN ALTER TABLE KhachHang ADD NgayCapDKKD DATE NULL; PRINT '  + KhachHang.NgayCapDKKD'; END ELSE PRINT '  = KhachHang.NgayCapDKKD da co';
GO
IF COL_LENGTH('KhachHang', 'NoiCapDKKD') IS NULL BEGIN ALTER TABLE KhachHang ADD NoiCapDKKD NVARCHAR(150) NULL; PRINT '  + KhachHang.NoiCapDKKD'; END ELSE PRINT '  = KhachHang.NoiCapDKKD da co';
GO
IF COL_LENGTH('KhachHang', 'SDTNguoiKy') IS NULL BEGIN ALTER TABLE KhachHang ADD SDTNguoiKy NVARCHAR(30) NULL; PRINT '  + KhachHang.SDTNguoiKy (nhan OTP)'; END ELSE PRINT '  = KhachHang.SDTNguoiKy da co';
GO
IF COL_LENGTH('KhachHang', 'EmailNguoiKy') IS NULL BEGIN ALTER TABLE KhachHang ADD EmailNguoiKy NVARCHAR(150) NULL; PRINT '  + KhachHang.EmailNguoiKy (nhan link + OTP)'; END ELSE PRINT '  = KhachHang.EmailNguoiKy da co';
GO

/* ---------- 2. MauHopDongMB: mau hop dong mua ban (HTML co bien {{Bien}}), cung co che MauVanBanHRM ----------
   Mau tai len (.docx -> HTML qua mammoth o backend) hoac soan trong phan mem. Phan mem doc cac {{Bien}} trong mau
   de sinh form "dien cac truong nhap vao" khi tao hop dong (bien chuan duoc dien san tu Ben ban / Ben mua). */
IF OBJECT_ID('MauHopDongMB') IS NULL
BEGIN
    CREATE TABLE MauHopDongMB (
        MaMau       NVARCHAR(50) NOT NULL PRIMARY KEY,
        TenMau      NVARCHAR(150) NOT NULL,
        NoiDung     NVARCHAR(MAX) NOT NULL,
        PhienBan    INT NOT NULL DEFAULT 1,
        NguoiSuaID  INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CapNhatLuc  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT '  + bang MauHopDongMB';
END ELSE PRINT '  = bang MauHopDongMB da co';
GO
IF OBJECT_ID('MauHopDongMB_LichSu') IS NULL
BEGIN
    CREATE TABLE MauHopDongMB_LichSu (
        LichSuID    INT IDENTITY(1,1) PRIMARY KEY,
        MaMau       NVARCHAR(50) NOT NULL,
        NoiDung     NVARCHAR(MAX) NOT NULL,
        PhienBan    INT NOT NULL,
        NguoiSuaID  INT NULL,
        CapNhatLuc  DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_MauHopDongMB_LichSu ON MauHopDongMB_LichSu(MaMau, LichSuID);
    PRINT '  + bang MauHopDongMB_LichSu';
END ELSE PRINT '  = bang MauHopDongMB_LichSu da co';
GO

/* ---------- 3. HopDongMB: hop dong mua ban ----------
   TrangThai: Nhap | ChoKy (da xuat ban PDF, link con hieu luc) | DangKySo (khach da ky, may chu dang ky so MOYN)
              | ChoMoynKy (ky tu dong tat/loi — nguoi co quyen ky bang cong cu hoac tai len) | DaKy | TuChoi | HetHan | Huy
   TrangThaiThanhToan: ChuaTT | MotPhan | DaTT — ke toan tu danh dau (hop dong KHONG gan don hang/phieu ban hang,
   theo Nguyen 14/11 "soan hop dong mua ban rieng khong lien quan den don hang si").
   FileGoc/HashGoc: PDF da xuat ban de ky (noi dung KHOA — sua = xuat ban phien ban moi, link cu vo hieu).
   FileKhachKy: PDF khach ky so tai len (neu khach chon ky so). FileCuoi/HashCuoi: PDF cuoi cung co trang chung nhan
   + chu ky so MOYN + dau thoi gian. */
IF OBJECT_ID('HopDongMB') IS NULL
BEGIN
    CREATE TABLE HopDongMB (
        HopDongMBID        INT IDENTITY(1,1) PRIMARY KEY,
        SoHopDong          NVARCHAR(30) NOT NULL UNIQUE,
        TenHopDong         NVARCHAR(255) NOT NULL,
        KhachHangID        INT NULL FOREIGN KEY REFERENCES KhachHang(KhachHangID),
        BenMuaJson         NVARCHAR(MAX) NULL,           -- snapshot ben mua luc tao (ten, MST, dia chi, nguoi dai dien...)
        Nguon              NVARCHAR(10) NOT NULL DEFAULT N'Mau',   -- Mau | PDF (tai PDF soan san len)
        MaMau              NVARCHAR(50) NULL,
        PhienBanMau        INT NULL,
        GiaTriBien         NVARCHAR(MAX) NULL,           -- JSON: gia tri cac truong nguoi dung dien
        NoiDungHtml        NVARCHAR(MAX) NULL,           -- HTML da dien bien (ban dung de xuat PDF)
        TongTien           DECIMAL(18,2) NULL,
        TrangThai          NVARCHAR(20) NOT NULL DEFAULT N'Nhap',
        TrangThaiThanhToan NVARCHAR(10) NOT NULL DEFAULT N'ChuaTT',
        PhienBan           INT NOT NULL DEFAULT 0,       -- so lan xuat ban
        FileNguon          NVARCHAR(260) NULL,           -- PDF soan san tai len (Nguon='PDF')
        FileGoc            NVARCHAR(260) NULL,
        HashGoc            CHAR(64) NULL,
        FileKhachKy        NVARCHAR(260) NULL,
        FileChoMoyn        NVARCHAR(260) NULL,           -- ban da co trang chung nhan, CHO MOYN ky so
        FileCuoi           NVARCHAR(260) NULL,
        HashCuoi           CHAR(64) NULL,
        MaTraCuu           NVARCHAR(24) NULL,
        HanKy              DATETIME2 NULL,
        XuatBanLuc         DATETIME2 NULL,
        KhachKyLuc         DATETIME2 NULL,
        KyXongLuc          DATETIME2 NULL,
        LoiKySo            NVARCHAR(500) NULL,
        GhiChu             NVARCHAR(500) NULL,
        NguoiTaoID         INT NULL FOREIGN KEY REFERENCES Users(UserID),
        CreatedAt          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt          DATETIME2 NULL
    );
    CREATE UNIQUE INDEX UX_HopDongMB_MaTraCuu ON HopDongMB(MaTraCuu) WHERE MaTraCuu IS NOT NULL;
    CREATE INDEX IX_HopDongMB_TrangThai ON HopDongMB(TrangThai, CreatedAt);
    CREATE INDEX IX_HopDongMB_Khach ON HopDongMB(KhachHangID);
    PRINT '  + bang HopDongMB';
END ELSE PRINT '  = bang HopDongMB da co';
GO

/* ---------- 4. HopDongMBHang: dong hang hoa (tuy chon — mau co {{BangHang}} thi in bang nay) ---------- */
IF OBJECT_ID('HopDongMBHang') IS NULL
BEGIN
    CREATE TABLE HopDongMBHang (
        ID           INT IDENTITY(1,1) PRIMARY KEY,
        HopDongMBID  INT NOT NULL FOREIGN KEY REFERENCES HopDongMB(HopDongMBID) ON DELETE CASCADE,
        MaHangID     INT NULL,
        MaSanPham    NVARCHAR(50) NULL,
        TenSanPham   NVARCHAR(255) NULL,
        MauSac       NVARCHAR(100) NULL,
        DonVi        NVARCHAR(20) NULL,
        SoLuong      DECIMAL(14,2) NOT NULL DEFAULT 0,
        DonGia       DECIMAL(14,2) NOT NULL DEFAULT 0,
        ThanhTien    DECIMAL(18,2) NOT NULL DEFAULT 0,
        GhiChu       NVARCHAR(255) NULL,
        ThuTu        INT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_HopDongMBHang_HD ON HopDongMBHang(HopDongMBID);
    PRINT '  + bang HopDongMBHang';
END ELSE PRINT '  = bang HopDongMBHang da co';
GO

/* ---------- 5. HopDongMBBenKy: moi ben ky (Khach / MOYN) ----------
   CachKy: OTP | KySo (khach tai len / ky bang cong cu) | TuDong (may chu ky PFX/PKCS#11) | TaiLen (MOYN tai len)
   TrangThai: ChoKy | DaKy | TuChoi. ChungThu*: thong tin chung thu so (neu ky so). */
IF OBJECT_ID('HopDongMBBenKy') IS NULL
BEGIN
    CREATE TABLE HopDongMBBenKy (
        BenKyID        INT IDENTITY(1,1) PRIMARY KEY,
        HopDongMBID    INT NOT NULL FOREIGN KEY REFERENCES HopDongMB(HopDongMBID) ON DELETE CASCADE,
        Ben            NVARCHAR(10) NOT NULL,            -- Khach | MOYN
        HoTen          NVARCHAR(150) NULL,
        ChucVu         NVARCHAR(100) NULL,
        Email          NVARCHAR(150) NULL,
        SDT            NVARCHAR(30) NULL,
        CachKy         NVARCHAR(10) NULL,
        TrangThai      NVARCHAR(20) NOT NULL DEFAULT N'ChoKy',
        KyLuc          DATETIME2 NULL,
        IP             NVARCHAR(64) NULL,
        UserAgent      NVARCHAR(300) NULL,
        AnhChuKy       NVARCHAR(MAX) NULL,               -- data URL PNG (ve tay) — gioi han 200 KB o backend
        KenhOTP        NVARCHAR(10) NULL,
        DichOTP        NVARCHAR(150) NULL,               -- da che: ***1234 / a***@gmail.com
        ChungThuCN     NVARCHAR(255) NULL,
        ChungThuMST    NVARCHAR(50) NULL,
        ChungThuSerial NVARCHAR(100) NULL,
        ChungThuHetHan DATETIME2 NULL,
        LyDoTuChoi     NVARCHAR(500) NULL,
        ThuTu          INT NOT NULL DEFAULT 1
    );
    CREATE INDEX IX_HopDongMBBenKy_HD ON HopDongMBBenKy(HopDongMBID);
    PRINT '  + bang HopDongMBBenKy';
END ELSE PRINT '  = bang HopDongMBBenKy da co';
GO

/* ---------- 6. HopDongMBLink: link ky gui cho khach — CHI LUU HASH cua token (token 32 byte chi co trong email/SMS) ---------- */
IF OBJECT_ID('HopDongMBLink') IS NULL
BEGIN
    CREATE TABLE HopDongMBLink (
        LinkID       INT IDENTITY(1,1) PRIMARY KEY,
        HopDongMBID  INT NOT NULL FOREIGN KEY REFERENCES HopDongMB(HopDongMBID) ON DELETE CASCADE,
        BenKyID      INT NOT NULL,
        TokenHash    CHAR(64) NOT NULL UNIQUE,
        PhienBan     INT NOT NULL DEFAULT 1,
        HetHan       DATETIME2 NOT NULL,
        VoHieu       BIT NOT NULL DEFAULT 0,
        MoLanDau     DATETIME2 NULL,
        MoLanCuoi    DATETIME2 NULL,
        SoLanMo      INT NOT NULL DEFAULT 0,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_HopDongMBLink_HD ON HopDongMBLink(HopDongMBID);
    PRINT '  + bang HopDongMBLink';
END ELSE PRINT '  = bang HopDongMBLink da co';
GO

/* ---------- 7. HopDongMBOTP: OTP (chi luu hash), 6 so, han 5 phut, sai 5 lan khoa 15 phut ---------- */
IF OBJECT_ID('HopDongMBOTP') IS NULL
BEGIN
    CREATE TABLE HopDongMBOTP (
        OtpID        INT IDENTITY(1,1) PRIMARY KEY,
        BenKyID      INT NOT NULL,
        OtpHash      CHAR(64) NOT NULL,
        Kenh         NVARCHAR(10) NOT NULL,              -- sms | email | zalo
        Dich         NVARCHAR(150) NULL,                 -- da che
        HetHan       DATETIME2 NOT NULL,
        SoLanSai     INT NOT NULL DEFAULT 0,
        KhoaDen      DATETIME2 NULL,
        DungLuc      DATETIME2 NULL,
        CreatedAt    DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    CREATE INDEX IX_HopDongMBOTP_Ben ON HopDongMBOTP(BenKyID, OtpID);
    PRINT '  + bang HopDongMBOTP';
END ELSE PRINT '  = bang HopDongMBOTP da co';
GO

/* ---------- 8. HopDongMBNhatKy: nhat ky CHI THEM (audit trail), moi dong bam noi dong truoc (phat hien sua tay) ---------- */
IF OBJECT_ID('HopDongMBNhatKy') IS NULL
BEGIN
    CREATE TABLE HopDongMBNhatKy (
        NhatKyID     INT IDENTITY(1,1) PRIMARY KEY,
        HopDongMBID  INT NOT NULL FOREIGN KEY REFERENCES HopDongMB(HopDongMBID) ON DELETE CASCADE,
        HanhDong     NVARCHAR(40) NOT NULL,
        ChiTiet      NVARCHAR(MAX) NULL,                 -- JSON
        IP           NVARCHAR(64) NULL,
        UserAgent    NVARCHAR(300) NULL,
        UserID       INT NULL,
        BenKyID      INT NULL,
        Luc          DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        HashTruoc    CHAR(64) NULL,
        Hash         CHAR(64) NOT NULL
    );
    CREATE INDEX IX_HopDongMBNhatKy_HD ON HopDongMBNhatKy(HopDongMBID, NhatKyID);
    PRINT '  + bang HopDongMBNhatKy';
END ELSE PRINT '  = bang HopDongMBNhatKy da co';
GO

/* ---------- 9. Module HOPDONG + chuc nang ----------
   KHONG tu cap quyen cho nhom nao (hop dong la viec cua ke toan / kinh doanh — Quan tri cap). Admin thay san.
   kyso: MacDinhCho = 0 — "nang luc" phai tick moi co: ky so lai / tai len ban MOYN da ky / ky bang cong cu. */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = N'HOPDONG')
BEGIN
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu) VALUES (N'HOPDONG', N'Hợp đồng mua bán', 8);
    PRINT '  + Module HOPDONG';
END ELSE PRINT '  = Module HOPDONG da co';
GO
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang') AND COL_LENGTH('ChucNang', 'MacDinhCho') IS NOT NULL
BEGIN
    MERGE ChucNang AS t
    USING (VALUES
        ('HOPDONG', 'danhsach', N'Danh sách hợp đồng', 1, 1),
        ('HOPDONG', 'mau',      N'Mẫu hợp đồng', 2, 1),
        ('HOPDONG', 'cauhinh',  N'Cấu hình ký', 3, 1),
        ('HOPDONG', 'kyso',     N'Ký số phía MOYN (ký lại / tải lên / ký bằng công cụ) — phải tick mới có', 4, 0)
    ) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu, MacDinhCho)
         VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu, s.MacDinhCho);
    PRINT '  + ChucNang HOPDONG/danhsach, mau, cauhinh, kyso';
END
ELSE IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChucNang')
BEGIN
    MERGE ChucNang AS t
    USING (VALUES
        ('HOPDONG', 'danhsach', N'Danh sách hợp đồng', 1),
        ('HOPDONG', 'mau',      N'Mẫu hợp đồng', 2),
        ('HOPDONG', 'cauhinh',  N'Cấu hình ký', 3),
        ('HOPDONG', 'kyso',     N'Ký số phía MOYN', 4)
    ) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
    WHEN NOT MATCHED THEN INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu) VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
    PRINT '  + ChucNang HOPDONG (chua co cot MacDinhCho — chay migration_v684 de kyso thanh nang luc)';
END
GO

/* ---------- 10. Mau hop dong mac dinh (chi chen khi CHUA co) — kế toán sửa lại trong phần mềm ----------
   Co san dieu khoan "thoa thuan ky dien tu" (Luat Giao dich dien tu 2023). Nguyen nho ke toan / luat su ra cau chu. */
IF OBJECT_ID('MauHopDongMB') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM MauHopDongMB WHERE MaMau = N'HDMB_CHUAN')
BEGIN
    INSERT INTO MauHopDongMB (MaMau, TenMau, NoiDung, PhienBan) VALUES (N'HDMB_CHUAN', N'Hợp đồng mua bán hàng hóa (mẫu chuẩn)', N'
<p style="text-align:center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b></p>
<p style="text-align:center"><b>HỢP ĐỒNG MUA BÁN HÀNG HÓA</b><br>Số: {{SoHopDong}}</p>
<p>Hôm nay, ngày {{NgayKy}}, tại {{DiaDiemKy}}, chúng tôi gồm:</p>
<p><b>BÊN BÁN (Bên A):</b> {{BenBan_Ten}}<br>Địa chỉ: {{BenBan_DiaChi}}<br>Mã số thuế: {{BenBan_MST}}<br>Đại diện: {{BenBan_NguoiDaiDien}} — Chức vụ: {{BenBan_ChucVu}}<br>Điện thoại: {{BenBan_SDT}} — Email: {{BenBan_Email}}</p>
<p><b>BÊN MUA (Bên B):</b> {{BenMua_Ten}}<br>Địa chỉ: {{BenMua_DiaChi}}<br>Mã số thuế / Số ĐKKD: {{BenMua_MST}} {{BenMua_SoDKKD}}<br>Đại diện: {{BenMua_NguoiDaiDien}} — Chức vụ: {{BenMua_ChucVu}}<br>Số CCCD: {{BenMua_CCCD}} — Điện thoại: {{BenMua_SDT}} — Email: {{BenMua_Email}}</p>
<p><b>Điều 1. Hàng hóa, số lượng, giá cả</b></p>
{{BangHang}}
<p>Tổng giá trị hợp đồng: <b>{{TongTien}}</b> đồng (bằng chữ: {{TongTienBangChu}}). Giá trên {{GhiChuThue}}.</p>
<p><b>Điều 2. Giao hàng</b><br>Thời gian giao hàng: {{ThoiGianGiao}}. Địa điểm giao hàng: {{DiaDiemGiao}}. Chi phí vận chuyển: {{ChiPhiVanChuyen}}.</p>
<p><b>Điều 3. Thanh toán</b><br>Phương thức: {{PhuongThucThanhToan}}. Thời hạn thanh toán: {{ThoiHanThanhToan}}.</p>
<p><b>Điều 4. Trách nhiệm các bên</b><br>Bên A giao đúng hàng, đúng số lượng, chất lượng, thời hạn đã thỏa thuận. Bên B nhận hàng, kiểm tra và thanh toán đúng hạn. Hàng lỗi do sản xuất được đổi trả trong {{ThoiHanDoiTra}} kể từ ngày nhận.</p>
<p><b>Điều 5. Ký kết bằng phương thức điện tử</b><br>Các bên thỏa thuận giao kết hợp đồng này bằng phương thức điện tử theo Luật Giao dịch điện tử năm 2023: bên B xác nhận ý chí giao kết bằng mã OTP gửi tới số điện thoại / địa chỉ email do chính bên B cung cấp ({{BenMua_SDT}} / {{BenMua_Email}}) hoặc bằng chữ ký số; bên A ký bằng chữ ký số. Các bên công nhận bản điện tử có chữ ký điện tử / chữ ký số kèm nhật ký xác thực của hệ thống có giá trị pháp lý như văn bản ký tay, đóng dấu. Thời điểm giao kết là thời điểm bên ký sau cùng hoàn tất ký.</p>
<p><b>Điều 6. Điều khoản chung</b><br>Hợp đồng có hiệu lực từ ngày ký. Tranh chấp được giải quyết bằng thương lượng; không thành thì đưa ra Tòa án có thẩm quyền. {{DieuKhoanKhac}}</p>
<table style="width:100%;margin-top:24px"><tr><td style="width:50%;text-align:center"><b>ĐẠI DIỆN BÊN A</b><br><i>(ký số)</i><br><br><br><br>{{BenBan_NguoiDaiDien}}</td><td style="width:50%;text-align:center"><b>ĐẠI DIỆN BÊN B</b><br><i>(ký điện tử / ký số)</i><br><br><br><br>{{BenMua_NguoiDaiDien}}</td></tr></table>
');
    PRINT '  + Mau HDMB_CHUAN';
END ELSE PRINT '  = Mau HDMB_CHUAN da co (hoac chua co bang)';
GO

PRINT '=== migration_v893 xong. npm install (backend) + pm2 restart qlnoibo ===';
GO
