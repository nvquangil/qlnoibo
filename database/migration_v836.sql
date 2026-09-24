/* ================================================================
   MIGRATION v8.36 — Module "Hoa don dien tu" (ket noi Cong TCT)

   Yeu cau Nguyen 2026-09-23: tai hoa don dau vao / dau ra tu
   hoadondientu.gdt.gov.vn ngay trong QLNoiBo. Dang nhap co go captcha TAY,
   chon tu ngay-den ngay hoac theo thang, xuat Excel danh sach.

   Quyet dinh da chot voi Nguyen:
   - CHI 1 MST (MOYN 0111266453) - khong lam da-MST nhu tool hddt cu.
   - Mat khau TCT LUU trong CSDL (ma hoa AES-256-GCM, khoa o .env), moi lan
     tai chi phai go captcha. DANH DOI da duoc bao truoc: ai doc duoc CA CSDL
     lan file .env thi giai ma duoc mat khau thue.
   - Hoa don DAU RA chi can Excel (khong tai file goc).
   - File hoa don luu TREN SERVER (backend/uploads/hoadon/...) + co nut tai ve.

   Giao thuc GDT: xem memory reference_gdt_hoadondientu_api (endpoint + 5 cai
   bay da tra gia that: cookie giua captcha/login, ngay DD/MM/YYYY trong query,
   export-xml tra ZIP...).

   CHAY 1 LAN. pm2 dang chay thi PHAI restart lai sau khi chay migration.
   ================================================================ */

/* ---------------- 1. Dang ky module + quyen ---------------- */
IF NOT EXISTS (SELECT 1 FROM Modules WHERE ModuleCode = 'HOADON')
BEGIN
    INSERT INTO Modules (ModuleCode, TenModule, ThuTu)
    SELECT N'HOADON', N'Hóa đơn điện tử', ISNULL(MAX(ThuTu), 0) + 1 FROM Modules;
    PRINT N'Da dang ky module HOADON.';

    -- Mac dinh: KHONG cap quyen xem cho nhom nao ca (khac cac module truoc).
    -- Ly do: man nay cham toi mat khau co quan thue va chung tu ke toan - phai
    -- co chu dinh cap quyen, khong de "ai cung thay" theo mac dinh. Admin van
    -- toan quyen san. Vao Quan ly User -> Ma tran phan quyen de cap them.
    INSERT INTO Permissions (GroupID, ModuleID, CanView, CanCreate, CanEdit, CanDelete)
    SELECT g.GroupID, m.ModuleID, 0, 0, 0, 0
    FROM Groups g CROSS JOIN Modules m
    WHERE g.TenNhom <> N'Admin' AND m.ModuleCode = 'HOADON';

    PRINT N'Da tao dong phan quyen (mac dinh TAT) cho module HOADON.';
END ELSE PRINT N'Module HOADON da duoc dang ky, bo qua.';
GO

/* MaChucNang phai KHOP "key" tra ve tu getTabs() ben frontend (module.hoadon.js). */
MERGE ChucNang AS t
USING (VALUES
    ('HOADON', 'dauvao',  N'Hóa đơn đầu vào', 1),
    ('HOADON', 'daura',   N'Hóa đơn đầu ra',  2),
    ('HOADON', 'cauhinh', N'Cấu hình kết nối TCT', 3)
) AS s (ModuleCode, MaChucNang, TenChucNang, ThuTu)
ON t.ModuleCode = s.ModuleCode AND t.MaChucNang = s.MaChucNang
WHEN NOT MATCHED THEN
    INSERT (ModuleCode, MaChucNang, TenChucNang, ThuTu)
    VALUES (s.ModuleCode, s.MaChucNang, s.TenChucNang, s.ThuTu);
PRINT N'Da seed ChucNang cho module HOADON (idempotent).';
GO

/* ---------------- 2. Cau hinh ket noi TCT (1 dong duy nhat) ---------------- */
IF OBJECT_ID('CauHinhHoaDonDienTu') IS NULL
BEGIN
    CREATE TABLE CauHinhHoaDonDienTu (
        ID            INT IDENTITY(1,1) PRIMARY KEY,
        MST           NVARCHAR(20)  NOT NULL,
        TenDonVi      NVARCHAR(400) NULL,
        -- Chuoi ma hoa AES-256-GCM dang "iv:tag:ciphertext" (base64) - KHONG BAO GIO
        -- tra ve frontend, chi giai ma o server ngay truoc khi goi GDT.
        MatKhauMaHoa  NVARCHAR(MAX) NULL,
        UpdatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedBy     NVARCHAR(100) NULL
    );
    PRINT N'Da tao bang CauHinhHoaDonDienTu.';
END ELSE PRINT N'Bang CauHinhHoaDonDienTu da ton tai, bo qua.';
GO

/* ---------------- 3. Danh sach hoa don da tra cuu ---------------- */
IF OBJECT_ID('HoaDonDienTu') IS NULL
BEGIN
    CREATE TABLE HoaDonDienTu (
        HoaDonID    INT IDENTITY(1,1) PRIMARY KEY,
        Loai        NVARCHAR(4)   NOT NULL,        -- 'VAO' (mua vao) / 'RA' (ban ra)
        GdtId       NVARCHAR(100) NULL,            -- inv.id cua GDT (du phong tai file theo id)
        KhmshDon    NVARCHAR(5)   NULL,            -- khmshdon
        KhhDon      NVARCHAR(20)  NULL,            -- ky hieu hoa don
        ShDon       NVARCHAR(20)  NULL,            -- so hoa don
        TDLap       DATE          NULL,            -- ngay lap
        MstBan      NVARCHAR(20)  NULL,
        TenBan      NVARCHAR(400) NULL,
        MstMua      NVARCHAR(20)  NULL,
        TenMua      NVARCHAR(400) NULL,
        TgTCThue    DECIMAL(18,2) NULL,            -- tong tien chua thue
        TgTThue     DECIMAL(18,2) NULL,            -- tien thue
        TgTTSo      DECIMAL(18,2) NULL,            -- tong tien thanh toan
        TrangThai   NVARCHAR(200) NULL,            -- tttddn
        /* v8.36 P3: duong dan tra cuu ban goc BEN NHA CUNG CAP, boc tu TTKhac trong
           XML cua GDT. Doi chieu 45 hoa don that cua MOYN: 16 co PortalLink+Fkey
           (deu tro ve easyinvoice.vn/.com.vn), 2 co MaTraCuu, 26 KHONG co gi.
           TCT khong giu ban goc NCC nen day la duong duy nhat lan ve duoc. */
        PortalLink  NVARCHAR(400) NULL,
        Fkey        NVARCHAR(100) NULL,
        MaTraCuu    NVARCHAR(100) NULL,
        ThuMucFile  NVARCHAR(400) NULL,            -- vd hoadon/0111266453/2026-09
        TenFile     NVARCHAR(200) NULL,            -- prefix: {YYYYMMDD}_{mstban}_{khhdon}_{shdon}
        /* P3: XML/PDF ban goc lay tu CONG TRA CUU CUA NCC (khac ban TCT - da doi
           chieu that: cung cau truc HDon/DLHDon/DSCKS nhung ban NCC co them khoi
           chu ky NMua). Tai tay hoac qua PortalLink+Fkey o tren. */
        FileDinhKem NVARCHAR(400) NULL,
        CreatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    /* Tai lai cung khoang ngay KHONG duoc sinh dong trung - dung MERGE theo khoa nay. */
    CREATE UNIQUE INDEX UX_HoaDonDienTu_Khoa
        ON HoaDonDienTu (Loai, MstBan, KhmshDon, KhhDon, ShDon);
    CREATE INDEX IX_HoaDonDienTu_TDLap ON HoaDonDienTu (Loai, TDLap);
    PRINT N'Da tao bang HoaDonDienTu.';
END ELSE PRINT N'Bang HoaDonDienTu da ton tai, bo qua.';
GO
