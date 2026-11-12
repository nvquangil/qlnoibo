# Triển khai v9.36 → v9.40 — danh sách kiểm

*Soạn 10/11/2026. Máy khách hiện đang chạy **v9.33**.*

Đợt này gồm **4 nhóm việc độc lập**. Có thể deploy từng nhóm, nhưng migration phải chạy trước khi `pm2 restart`.

| Nhóm | Nội dung | Migration | Rủi ro tiền |
|---|---|---|---|
| v9.35 | Nội dung công việc → mục 1.5 hợp đồng lao động | `migration_v887` | không |
| v9.36 | Phí vận chuyển vải vào giá thành, không vào công nợ NCC | `migration_v888` | **CÓ** — số "Phải trả NCC" sẽ đổi |
| v9.37 → v9.41 | Sao lưu CSDL tự động (phân hệ mới) + bản sao Google Drive + **sao lưu transaction log** | không | không |
| v9.38 → v9.39 | Tách dải size về Kỹ thuật + cột tỷ lệ vải | `migration_v889` | không (xem §5) |
| **v9.45** | **Lương công nhật theo bảng thực tế** — bộ tính mới, thông số trên hợp đồng, tab Đánh giá KPI, điều chỉnh có lý do, in 3 chữ ký | `migration_v890` | **CÓ** — bảng lương công nhật đổi hẳn cách tính (xem §9) |
| v9.46 | Phiếu bán hàng: tên người lập + giờ/ngày lập dưới ô "Người làm phiếu"; phiếu đã sửa/hủy in "Sửa lần cuối: ai — lúc nào" | `migration_v891` | không (xem §10) |
| v9.47 | Rê chuột vào ảnh nhỏ (thẻ kho hàng hóa, chi tiết hàng hóa, thẻ kho phụ kiện, thẻ kho vải — và mọi ô ảnh nhỏ khác) là hiện to ngay; bấm vẫn mở toàn màn | không | không (xem §11) |

*✅ **Toàn bộ đợt v9.35 → v9.47 ĐÃ deploy, migration v887 → v891 đã chạy** (Nguyen xác nhận 12/11/2026). Phần §0–§3 dưới đây giữ lại làm hồ sơ; việc còn mở nằm ở §9.1–§9.3 (khai hợp đồng + 3 giả định lương công nhật) và §8.*

---

## 0. Bắt buộc làm trước — không bỏ qua

🔴 **Bash sandbox của tôi hỏng suốt phiên này (12 lần liên tiếp).** Tôi **không chạy được** `node --check` lẫn bộ tự kiểm nào. Toàn bộ phần dưới là đọc mã bằng tay cộng với rà soát chéo độc lập. Bước 1 và bước 2 dưới đây là lưới an toàn **duy nhất** còn lại.

### Bước 1 — Biên dịch thử. Chạy trên thư mục C:\ (bản sửa), KHÔNG phải D:\

```
cd C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo
node --check backend\utils\saoLuuCSDL.js
node --check backend\utils\lichSaoLuu.js
node --check backend\utils\canhBaoSaoLuu.js
node --check backend\routes\saoluu.js
node --check backend\routes\qlsx.js
node --check backend\routes\hrm.js
node --check backend\routes\khovai.js
node --check backend\routes\danhmuc.js
node --check backend\routes\baocao.js
node --check backend\utils\tienVaiNhap.js
node --check backend\utils\crudFactory.js
node --check frontend\js\module.saoluu.js
node --check frontend\js\module.qlsx.js
node --check frontend\js\module.hrm.js
node --check frontend\js\module.khovai.js
node --check frontend\js\module.danhmuc.js
node --check frontend\js\app.js
node --check backend\utils\luongCongNhat.js
node --check backend\routes\payroll.js
node --check frontend\js\module.payroll.js
node --check frontend\js\module.mypay.js
node --check backend\routes\banhang.js
node --check frontend\js\module.khohang.js
node --check frontend\js\common.js
```

*(bốn dòng v9.45: luongCongNhat / payroll / module.payroll / module.mypay — `hrm.js` hai phía đã có ở trên nhưng v9.45 sửa tiếp, chạy lại. banhang / module.khohang là v9.46; `common.js` là v9.47 — file này nạp cho MỌI màn hình, vỡ cú pháp là cả phần mềm đứng.)*

**Yêu cầu: KHÔNG dòng nào in ra gì cả.** In ra một dòng = máy chủ sẽ không khởi động được.

> Vì sao gắt: lỗi "dấu backtick nằm trong comment bên trong template literal" đã **sập production hai lần** (v7.98, v8.73), và trong chính đợt này rà soát chéo bắt được tôi tái phạm ở `baocao.js`. `node --check` bắt được nó trong 1 giây.

### Bước 2 — Bộ tự kiểm

```
node backend\utils\kiem_sao_luu_csdl.js
node backend\utils\kiem_bang_rieng_theo_dai.js
node backend\utils\kiem_he_so_hieu_luc.js
node backend\utils\kiem_phi_van_chuyen_vai.js
node backend\utils\kiem_noi_dung_cong_viec.js
node backend\utils\kiem_tach_mau_cung_dai.js
node backend\utils\kiem_luong_cong_nhat_v945.js
node backend\utils\kiem_tam_ung_tru_luong.js
node backend\utils\kiem_dau_vet_phieu_ban_hang.js
node backend\utils\kiem_xem_truoc_anh_khi_re_chuot.js
node backend\utils\kiem_xem_anh_dien_thoai.js
```

*(`kiem_xem_anh_dien_thoai.js` là bộ kiểm cũ của lightbox v7.77 — chạy lại vì v9.47 chèn mã ngay dưới khối đó trong `common.js`; mục 2 của nó cần jsdom, không có thì tự bỏ qua, không phải lỗi.)*

`kiem_luong_cong_nhat_v945.js` chạy **bộ tính thật trên đúng 47 dòng của file `Tháng 10.2026.xlsx`** — đỏ ở dòng nào là công thức tôi giải mã sai dòng đó. `kiem_tam_ung_tru_luong.js` (v9.32) phải chạy lại vì v9.45 đổi route tính lương.

**Đỏ nào cũng gửi tôi nguyên văn, đừng tự sửa.** Bộ kiểm có thể đỏ oan — và đỏ oan là lỗi của tôi, không phải của anh.

⚠️ **Biết trước một chỗ đỏ KHÔNG phải do đợt này:** `kiem_tong_tien_phieu_nhap_vai.js` dòng 107 đỏ sẵn **từ trước v9.36** (nó đòi `congno.js` gọi `bieuThucTienCay(` 4 lần, thực tế 3 — bảng chứng từ đã dời sang `utils/chungTu.js`). Thấy đỏ đừng truy vào v9.36.

---

## 1. Trước khi deploy — hai câu SQL phải chạy

### 1.1 🔴 Ước lượng chênh lệch "Phải trả NCC" (v9.36)

Số công nợ NCC **sẽ đổi** sau v9.36. Phải biết trước đổi bao nhiêu, nếu không thì sau deploy không phân biệt được "đổi do tính năng mới" với "có người sửa phiếu".

Câu SQL nằm ở **`docs/PRD_v936_phi_van_chuyen_vai.md` §7**. Chạy, chụp màn hình kết quả, giữ lại.

### 1.2 Mẫu hợp đồng đã bị sửa trong CSDL chưa (v9.35)

```sql
SELECT MaMau FROM MauVanBanHRM WHERE MaMau IN ('HDLD_CHINHTHUC','HDLD_THUVIEC');
```

- **Không ra dòng nào** → tốt, phần mềm dùng mẫu gốc, tính năng chạy đúng.
- **Ra dòng** → mẫu đó đã bị sửa tay trước v9.35 và **không có chỗ cắm `{{NoiDungCongViec}}`**. Gõ nội dung vào sẽ lưu được, hiện được trên màn hình, mà **bản hợp đồng IN RA vẫn là điều khoản cũ**. v9.35 có toast cảnh báo, nhưng tốt nhất là sửa lại mẫu trước.

---

## 2. Migration — chạy TRƯỚC `pm2 restart`

Ba file, chạy theo thứ tự, trên CSDL `QLNoiBo` ở máy chủ:

```
database\migration_v887.sql    -- HopDongLaoDong.NoiDungCongViec
database\migration_v888.sql    -- VaiCay.PhiVanChuyenDonGia + NhaCungCap.PhiVanChuyenDonGia/DVT
database\migration_v889.sql    -- DonHangDaiSize.TyLeVai
database\migration_v890.sql    -- v9.45: HopDongLaoDong +6 cột, CauHinhLuong +4 cột, BangLuongChiTiet +16 cột,
                               --        3 bảng mới (HopDongSanPham, DanhGiaKPI, ThuongSanPhamThang), ChucNang PAYROLL/kpi
database\migration_v891.sql    -- v9.46: PhieuBanHang.NguoiSuaID + UpdatedAt (ai sửa/hủy, lúc nào)
```

Cả năm đều chạy lại được nhiều lần không sao (`IF COL_LENGTH(...) IS NULL`). v887–v889 anh đã chạy; **còn v890, v891**.

⚠️ v890: cột mới được dò **mỗi lần gọi** (không cache) nên thứ tự migration/restart không gây lệch số. Tab **Đánh giá KPI** hiện cho mọi người có quyền PAYROLL ngay sau khi copy JS (dòng `ChucNang PAYROLL/kpi` chỉ để **Quản trị → Phân quyền** có thể *cấm* riêng tab này cho ai đó).

Kiểm sau khi chạy:

```
node backend\utils\kiem_cot_migration.js
```

⚠️ Bộ kiểm này đọc cấu hình CSDL của chính phần mềm. Bản đầu tôi **đoán nhầm tên 2 bảng** và nó báo "THIẾU CỘT" rất thuyết phục — suýt đẩy anh đi sửa lược đồ production. Nay tên bảng chép từ `ALTER TABLE` trong file migration. **Vẫn vậy: nó báo thiếu cột thì gửi tôi, đừng tự `ALTER`.**

---

## 3. Deploy

1. Copy các file đã đổi từ `C:\Users\QUAN\Claude\Projects\Quan\QLNoiBo` sang `D:\QLSX` (giữ nguyên cấu trúc thư mục).
2. Nhớ file **mới hoàn toàn** — dễ quên nhất:
   - `backend\utils\saoLuuCSDL.js`
   - `backend\utils\lichSaoLuu.js`
   - `backend\utils\canhBaoSaoLuu.js`
   - `backend\routes\saoluu.js`
   - `frontend\js\module.saoluu.js`
   - **v9.45:** `backend\utils\luongCongNhat.js` (bộ tính mới — thiếu file này `payroll.js` nổ ngay lúc `require`, máy chủ không lên), `database\migration_v890.sql`
   - v9.45 sửa: `backend\routes\payroll.js`, `backend\routes\hrm.js`, `frontend\js\module.payroll.js`, `frontend\js\module.hrm.js`, `frontend\js\module.mypay.js` (phiếu lương nhân viên tự xem — rà chéo bắt được in cứng "−thuế")
   - v9.46: `database\migration_v891.sql` (mới), `backend\routes\banhang.js`, `frontend\js\module.khohang.js`
   - v9.47: `frontend\js\common.js` (bump `?v=9.47` trong index.html — PWA sẽ tự nạp lại)
3. `frontend\index.html` — bắt buộc copy, nếu không trình duyệt vẫn chạy JS cũ.
4. `pm2 restart` (sau migration).
5. `pm2 logs` — tìm dòng `[saoluu] Lịch: ...`. Không thấy dòng đó là lịch chưa chạy.

> ⚠️ Máy chủ chạy dưới tài khoản Windows **Admin** (`C:\Users\Admin\.pm2`), không phải QUAN. Đường dẫn `C:\Users\QUAN\...` không dùng được trong PowerShell trên máy đó.
>
> ⚠️ `findstr` **nói dối** trên `backend\routes\hrm.js` (có byte điều khiển ở comment chết dòng 603-610 từ v8.85). Kiểm file đó đã copy chưa bằng **kích thước + ngày sửa**, đừng dùng `findstr`.

---

## 4. Nghiệm thu — sao lưu CSDL (v9.37 → v9.40)

Đây là phần anh vừa vấp sáng nay nên để trước.

### 4.1 Tìm phân hệ

Menu trái phải có **💾 Sao lưu dữ liệu** (biểu tượng đĩa mềm). Chỉ tài khoản Admin thấy — cố ý: file `.bak` chứa **toàn bộ dữ liệu công ty**.

### 4.2 Chọn thư mục — điều đã làm hỏng lần thử sáng nay

🔴 **`G:\BackupQLNoiBo` (Google Drive) KHÔNG dùng được làm thư mục sao lưu chính, và không có cách nào sửa được điều đó.**

Lý do: ổ Google Drive (cũng như OneDrive, Dropbox, ổ ánh xạ mạng) được gắn vào **phiên đăng nhập của anh**. Dịch vụ SQL Server chạy ở phiên khác, dưới tài khoản khác — với nó ký tự ổ `G:` **không tồn tại**. Cấp quyền thư mục bao nhiêu cũng vô ích. Lỗi `BACKUP DATABASE is terminating abnormally` anh nhận được là **câu tổng kết cuối cùng** của SQL Server, không phải lý do; lý do thật (Msg 3201) bị driver vứt đi — nay đã sửa, phần mềm gom đủ cả hai.

Cách làm đúng, đã cài sẵn:

| Ô | Điền | Ai ghi |
|---|---|---|
| **Thư mục lưu \*** | `D:\BackupQLNoiBo` | SQL Server |
| **Bản sao thứ hai** | `G:\BackupQLNoiBo` | phần mềm (Node) chép sang sau khi đã xác minh |

Danh sách ổ trên màn hình nay đánh dấu **🚫 SQL không ghi được** cho đúng những ổ kiểu này, và bấm vào chúng sẽ điền vào ô **Bản sao thứ hai**, không phải ô chính.

### 4.3 Chạy thử

1. Điền hai ô như trên, đặt **Giữ lại 30 ngày**, **Bản sao thứ hai giữ 30 ngày**.
2. Bấm **Kiểm tra thư mục**. Phải ra **hai dòng xanh**:
   - `SQL Server GHI ĐƯỢC vào D:\BackupQLNoiBo...`
   - `Bản sao thứ hai: Phần mềm GHI ĐƯỢC vào G:\BackupQLNoiBo...`
   - Đỏ thì **đọc nguyên câu** — nó nói thẳng phải làm gì và nêu đúng tên tài khoản dịch vụ SQL (đọc từ chính SQL Server, không phải đoán).
3. Bấm **Lưu cấu hình**. Toast phải nói *"Lịch chạy lúc 01:15 mỗi ngày"*. Nói *"Lịch KHÔNG chạy"* thì đọc lý do kèm theo.
4. Bấm **Sao lưu ngay**.
   - Nếu trình duyệt báo hết giờ chờ, **đừng đóng trang** — phần mềm sẽ tự hỏi lại máy chủ 15 giây một lần tới 10 phút rồi báo kết quả thật. (Sao lưu vẫn chạy tiếp ở máy chủ sau khi trình duyệt bỏ cuộc; bản cũ báo "thất bại" ở đây là **nói sai**.)
5. Kiểm bằng mắt:
   - `D:\BackupQLNoiBo\QLNoiBo_20261110_HHMM.bak` — có file, kích thước vài chục MB.
   - `G:\BackupQLNoiBo\` — có **đúng một file cùng tên**, và **không có** file nào tên bắt đầu bằng `~dangchep_`.
   - Màn hình: ô to màu xanh *"Bản sao lưu dùng được gần nhất"* hiện giờ vừa rồi.
6. Bấm **Tải về** ở một bản — file tải được.

### 4.4 Đọc kỹ phần cảnh báo đỏ trên đầu màn hình

Màn hình nay tự nêu các vấn đề sau nếu có. **Đọc hết, đừng bỏ qua:**

- 🔴 **Lịch tự động không chạy** — kèm lý do cụ thể. Trước đây ô tick "Chạy tự động" chỉ phản ánh **ý muốn đã lưu**, không phản ánh thực tế; lịch có thể chết câm mà ô vẫn xanh.
- 🔴 **Bản sao ngoài máy hỏng** — sao lưu vào máy vẫn tốt, nhưng mất tuyến phòng thủ ngoài máy.
- ⚠️ **Chưa cấu hình SMTP** → cảnh báo **chỉ hiện trên màn hình, không có email nào được gửi**. Ô "Email báo khi hỏng" lưu được, hiện được, mà không ai đọc — trước v9.40 đúng là như vậy, nay đã sửa nhưng vẫn cần `SMTP_HOST` trong `backend\.env`.
- ⚠️ **Thư mục sao lưu cùng ổ với file CSDL** — `D:` đang chứa `QLNoiBo1.ndf`, nên cảnh báo này **sẽ hiện** với cấu hình ở §4.2. Đó là lý do bản trên Google Drive là tuyến phòng thủ chính.

### 4.5 Sao lưu transaction log (v9.41) — Nguyen đã chốt giữ FULL recovery

**Trước khi bật, chạy câu này trên máy chủ:**

```sql
SELECT name, size*8/1024 AS MB, log_reuse_wait_desc
FROM sys.database_files;
```

```powershell
Get-PSDrive C,D | Select-Object Name, @{n='TrongGB';e={[math]::Round($_.Free/1GB,1)}}
```

🔴 **Nếu ổ D: còn dưới ~5 GB thì ĐỪNG bật.** Giữ 30 ngày log ở chu kỳ 1 giờ nghĩa là tới **720 file `.trn`** cộng 30 bản `.bak` — trên chính ổ đang chứa file CSDL. Ổ đầy là vòng lặp chết: `BACKUP LOG` hỏng → log không được cắt → `.ldf` phình → đầy nốt ổ chứa CSDL → **SQL Server ngừng nhận ghi → cả xưởng dừng**. Phần mềm có chặn (sàn 2 GB) nhưng chặn xong thì log vẫn không được cắt.

Nếu `log_reuse_wait_desc` ra gì khác `NOTHING` / `LOG_BACKUP` thì gửi tôi — có thứ khác đang giữ log, sao lưu log sẽ không cắt được.

**Bật thế nào:** màn hình Sao lưu → tick **Sao lưu transaction log** → chọn chu kỳ (mặc định 1 giờ) → **Lưu cấu hình** → bấm **📝 Sao lưu log ngay** một lần để thử.

**Nghiệm thu:**

1. Có file `QLNoiBo_LOG_20261110_HHMMSS.trn` trong `D:\BackupQLNoiBo` và trong `G:\BackupQLNoiBo`.
2. Màn hình hiện mục **"Bản sao lưu log gần đây"** với dòng **"Log đang dùng X% của 136 MB"**.
3. Sau vài lần chạy, `X%` phải **giảm** và ở mức thấp. Đó là bằng chứng log thực sự được cắt.
4. 🔴 **File `.ldf` vẫn 136 MB** — đúng như vậy, không phải lỗi. `BACKUP LOG` giải phóng chỗ *bên trong* file, không thu nhỏ file. Nó đã **thôi phình**, đó là mục tiêu. Muốn lấy lại 136 MB trên ổ thì phải `DBCC SHRINKFILE` một lần — thao tác riêng, làm phân mảnh chỉ mục, **nói tôi trước khi làm**.
5. Khối trên cùng màn hình đổi từ *"mất nhiều nhất 14 giờ"* thành *"mất nhiều nhất 1 giờ"*.

### 4.6 Tự xóa bản cũ nhất khi ổ sắp đầy (v9.44)

Anh yêu cầu: *"khi còn 5 GB thì xóa file cũ nhất để lưu file mới, có chỗ cài đặt"*. Ô **Giữ trống ổ đích (GB)** trong Cấu hình, mặc định 5.

Luật chạy, đọc kỹ vì nó **xóa file sao lưu**:

| | |
|---|---|
| Khi nào xóa | Trước mỗi lần sao lưu, nếu ổ đích còn **dưới ngưỡng** (hoặc không đủ chỗ cho bản mới) |
| Xóa gì, thứ tự | ① file `.HONG` (đã biết hỏng) → ② bản log vô dụng → ③ bản **đầy đủ cũ nhất**, kéo theo log của nó |
| Xóa bao nhiêu | Tới khi lên lại ngưỡng, nhưng **tối đa 3 bản đầy đủ mỗi lần chạy** |
| Không bao giờ | Xóa xuống dưới **"Luôn giữ ít nhất"** (3 bản) — lưới an toàn cuối, không nới |
| Sao lưu **log** | **Không được xóa bản đầy đủ** — chỉ dọn log vô dụng. Lịch log chạy mỗi giờ; để nó xóa bản đầy đủ là vài giờ mất hết |
| Xóa xong vẫn thiếu | Đủ chỗ cho bản mới thì **vẫn ghi**, kèm cảnh báo. Không đủ thì từ chối và nói rõ |
| Báo | **Email mỗi lần có xóa** — thao tác không đảo ngược mà im lặng là sai |

🔴 **Vì sao giới hạn 3 bản/lần**: rà soát chéo chỉ ra bản đầu không giới hạn — ổ tụt sâu một đêm (vì file `.ldf` phình chẳng hạn) là xóa sạch 27 bản **rồi vẫn từ chối**, hủy toàn bộ lịch sử mà không đổi lại được gì. Giờ lịch sử mòn 3 bản/đêm, có email, nhìn thấy được — đủ thời gian để anh đi tìm thứ thật sự đang ăn ổ.

**Nghiệm thu:** đặt ngưỡng tạm **thật cao** (ví dụ 500 GB — chắc chắn ổ D: đang dưới) → Lưu → **Sao lưu ngay** → dòng kết quả phải có *"đã xóa N bản đầy đủ cũ nhất … để lấy chỗ"* với N ≤ 3, và email tới. Rồi **đặt lại 5 GB**. Đừng quên bước cuối.

**Hai điều phải biết để không tự phá:**

- 🔴 **Đừng xóa tay file `.trn`.** Chúng là một **chuỗi liên tục**: xóa một file ở giữa làm mất khả năng khôi phục của *tất cả* các mốc sau nó, và không có dấu hiệu nào nhìn thấy được cho tới đúng lúc cần. Phần mềm tự quyết hạn giữ (chỉ xóa bản cũ hơn bản `.bak` cũ nhất còn giữ) — vì thế màn hình **không có ô** để gõ số ngày giữ log.
- Khôi phục về **đúng một thời điểm**: phục hồi bản `.bak` `WITH NORECOVERY`, rồi lần lượt các `.trn` sau nó theo đúng thứ tự, bản cuối dùng `WITH STOPAT`. Chỉ cần quay về mốc 01:15 thì **một mình file `.bak` là đủ**, không cần `.trn` nào.

---

## 5. Nghiệm thu — tách dải size + tỷ lệ vải (v9.38 → v9.39)

### 5.1 Nút nằm ở đâu

| Công đoạn | Nút hiện |
|---|---|
| **Kỹ thuật** | 📏 Tách dải size |
| **Cắt** | 🧩 Tách mẫu |
| Công đoạn khác | không nút, nhưng **vẫn thấy tóm tắt** dải/mẫu |

Đúng như anh chốt: *"chỉ tách dải size ở công đoạn kỹ thuật, còn tách mẫu vẫn ở công đoạn cắt"*.

### 5.2 Cột tỷ lệ vải

Mở **Kỹ thuật → Tách dải size**. Bảng có hai cột mới: **Tỷ lệ vải** (gõ tay) và **= %** (tự tính).

Kiểm:

1. Gõ `0.8` và `1.2` → cột `= %` ra **40,0%** và **60,0%**.
2. Xóa đi, gõ `40` và `60` → vẫn ra **40,0%** và **60,0%**. (Đơn vị tự do — hệ thống chỉ lấy tỷ lệ.)
3. Xóa trắng **một** dải → cả hai dòng về `—`, và dòng chữ dưới bảng chuyển sang màu cam. Cố ý: khuyết một dải thì không bịa tỷ lệ nửa vời.
4. **Lưu**, đóng, **mở lại** → hai số vẫn còn nguyên.

🔴 **Bước 4 là bước quan trọng nhất.** Rà soát chéo bắt được lỗi: backend **vứt sạch** `tyLeVai` trước khi ghi, nên nó luôn lưu NULL — và câu `UPDATE` còn **đè NULL lên số đã khai trước đó**, nghĩa là chỉ cần mở hộp thoại sửa tên dải là mất sạch tỷ lệ, im lặng. Đã sửa, nhưng phải tự mắt kiểm.

5. Mở **Cắt → Tách mẫu** → **không có** hai cột đó. Đúng: các mẫu dùng chung một dải size nên tỷ lệ vải của chúng bằng nhau theo định nghĩa.

### 5.2b Hệ số ở sổ cắt nay ĐIỀN SẴN từ tách dải (v9.42)

Tổ cắt **không phải gõ** hệ số nữa — ô tự điền:

| Lệnh | Ô hệ số điền sẵn |
|---|---|
| Tách dải `2-7` (6) + `8-12` (5) | **11** — một lớp cắt ra cả ri gồm mọi dải |
| Tách mẫu (mỗi mẫu 6) | **6** — các mẫu chung một dải size, không cộng dồn |
| Không tách | hệ số ở Ra lệnh SX, y như trước |

🔴 **Ô vẫn sửa được, cố ý.** Tách dải là kế hoạch, sổ cắt là cái đã xảy ra. Khóa cứng thì khi ri thật khác kế hoạch sẽ không còn chỗ nào khai đúng, và sai đó chảy thẳng vào lương cắt lẫn giá thành mà không ai thấy.

Gõ số khác tổng dải thì hiện chữ đỏ ngay dưới ô: *"Lệch với tách dải size: 11. Kiểm lại — nhiều khả năng gõ nhầm."* Chỉ cảnh báo, không chặn.

**Nghiệm thu — làm ở CẢ HAI màn, đây là chỗ tôi suýt bỏ sót:**

1. **Ghi tiến độ → Cắt** → thêm một cây → ô Hệ số phải hiện sẵn **11** (không phải hệ số ở Ra lệnh SX).
2. **Sửa sổ cắt** (nút Sửa ở một sổ cắt cũ) → dòng cũ giữ **nguyên hệ số đã lưu**, dòng **thêm mới** hiện **11**.
3. Gõ 12 vào một dòng → chữ đỏ hiện ngay; xóa về 11 → chữ đỏ biến mất.
4. Lưu rồi mở lại → số không bị nhảy.

🔴 **Trước khi deploy, xác nhận hai điều** (nếu không, lệnh tách MẪU sẽ bị cộng dồn và **SL cái gấp đôi** — sai thẳng vào lương cắt):

```sql
SELECT COL_LENGTH('DonHangDaiSize','LoaiTach') AS CoCot;   -- phải KHÁC NULL
```

và **pm2 đã restart SAU khi chạy migration_v885**. Phần mềm nhớ kết quả dò cột vĩnh viễn trong một lần chạy, nên chạy migration mà không restart thì nó vẫn tưởng cột chưa có.

### 5.3 🔴 Phải nói rõ: tỷ lệ này CHƯA vào giá thành

Hiện tại `tinhGiaThanh()` vẫn gộp toàn bộ tiền vải của lệnh rồi chia cho số lượng hoàn thành — ra **một con số chung**, giống hệt trước v9.38. Cột `TyLeVai` **đã được lưu nhưng chưa được dùng**.

Bản đầu của tôi viết trên màn hình *"giá thành chia vải theo tỷ lệ trên"* — **sai**, hứa một cơ chế chưa tồn tại, mà đây đúng là chữ anh đọc để quyết định về tiền. Rà soát chéo bắt được, đã sửa thành *"đã khai đủ tỷ lệ vải (chưa dùng vào giá thành)"*.

Chia giá thành theo dải là việc riêng, vì phải tách **cả mẫu số** (số lượng hoàn thành theo dải) chứ không chỉ tử số — không thì ra đơn giá vô nghĩa. Anh muốn làm thì nói, tôi viết PRD riêng.

### 5.4 ⚠️ Việc anh cần kiểm — ai bị khóa ngoài công đoạn Kỹ thuật

```sql
SELECT u.Username, u.HoTen, s.TenCongDoan
FROM UserCongDoan uc
JOIN Users u ON u.UserID = uc.UserID
JOIN CongDoan s ON s.StageID = uc.StageID
ORDER BY u.Username;
```

Ai **chỉ** được gán công đoạn Cắt (không có Kỹ thuật) thì từ v9.39 **không còn đường nào mở hộp thoại tách dải size** — ở Cắt họ thấy dòng chữ *"— sửa ở công đoạn Kỹ thuật"* dẫn tới nơi họ vào không được.

Đây đúng là triệu chứng anh báo ngày 06/11 (*"nhân viên tổ cắt không thấy chức năng tách dải size"*), lần này qua một cửa khác. Gửi tôi kết quả câu trên, tôi sẽ nói nên cấp thêm công đoạn hay nới điều kiện hiện nút.

---

## 6. Nghiệm thu — phí vận chuyển vải (v9.36)

1. **Danh mục → Nhà cung cấp**: mỗi NCC có **Đơn giá phí vận chuyển** + **ĐVT phí VC** (kg / mét). Điền cho vài NCC rồi Lưu.
   - 🔴 Sửa một NCC **không điền** hai ô này → giá cũ phải **còn nguyên**, không bị xóa.
2. **Kho vải → lập phiếu nhập** cho NCC đã có đơn giá phí → mỗi cây vải tự mang phí theo **bản chụp tại thời điểm nhập**. Đổi giá ở danh mục **không** hồi tố phiếu cũ — cố ý.
3. **QLSX → tính giá thành** một lệnh dùng vải đó → dưới Đơn giá có dòng `gồm phí VC ...`.
4. 🔴 **Công nợ NCC**: mở sổ công nợ của chính NCC đó → số **không được** chứa phí vận chuyển. Đây là ràng buộc trung tâm của v9.36.
5. So **"Phải trả NCC"** với ảnh chụp ở §1.1. Chênh lệch phải khớp với ước lượng.

⚠️ **Nợ đã biết, cố ý chưa sửa:** số **"giá trị tồn kho vải"** trong báo cáo vẫn sai (bỏ sót vải mua theo mét). Tôi đã thử sửa, rà soát chéo chỉ ra bản sửa **còn sai hơn** (`tonCuoiKG` luôn là KG trong khi đơn giá bình quân thành đ/mét), nên đã rút khỏi đợt. Sửa đúng cần quy đổi mét ↔ kg (định lượng + khổ vải) hoặc thêm cột riêng. Lý do đầy đủ nằm trong khối ghi chú của CTE `gia` trong `baocao.js`.

---

## 7. Nghiệm thu — nội dung công việc hợp đồng (v9.35)

1. **Nhân sự → Hợp đồng → Ký hợp đồng**: có ô **Nội dung công việc** (ô nhiều dòng, nhập tay).
2. Để trống → in hợp đồng → mục 1.5 phải là **đúng câu gốc của mẫu đó** (hai mẫu Chính thức / Thử việc có câu khác nhau), **không được để trống**. In chỗ trống = hợp đồng thiếu điều khoản.
3. Gõ nội dung riêng → in → mục 1.5 đúng nội dung vừa gõ, **xuống dòng giữ nguyên**.
4. Nếu hiện toast cảnh báo "mẫu không có chỗ cắm" → xem lại §1.2.

---

## 9. Nghiệm thu — lương công nhật theo bảng thực tế (v9.45)

Anh chốt 11/11 (10 điểm + "mỗi SP một đơn giá"). Những gì đã làm theo đúng từng điểm:

| Anh chốt | Phần mềm làm |
|---|---|
| 1. OT = lương CB ÷ giờ/ngày × 1,5 × giờ OT, chung mọi người | Hệ số lấy ở **Cấu hình lương → Hệ số TC ngày thường** (đang 1,5). CN/lễ **không** nhân khác. Thử việc × tỷ lệ thử việc (Loan: 25.000 × 1,5 × 0,85) |
| 2. Thuế TNCN để sẵn, không trừ | Cột **Thuế TNCN** luôn tính và hiện (xám, "không trừ"). Công tắc **Cấu hình → Trừ thuế TNCN vào thực lĩnh**, mặc định **Không** |
| 3. KPI 100 điểm tối đa | Tab **Đánh giá KPI**: điểm 0–100; tiền = quỹ KPI (hợp đồng) × điểm/100 × tổng công ÷ công chuẩn (chặn trên 1). Ô **Tiền ghi đè** khi muốn ấn định số |
| 4. Chuyên cần: đủ công chuẩn + không phép + không đi muộn | Đúng ba điều kiện; đi muộn = giờ vào máy chấm công trễ hơn giờ vào của nhóm quá **phút châm chước** (cấu hình, mặc định 5) |
| 5. Công chuẩn theo tháng | Lấy `CongChuanThang` — **một số cho cả 47 người** (sheet 1 đang chia 26, sheet 2 chia 27 ⇒ KPI kế toán Soan/Duyên sẽ khác file) |
| 6. Xăng trừ ngày phép | = đơn giá/ngày × ROUND(ngày đi làm thật) |
| 7. Gộp một bảng, cột kiểu lương | Cột **Kiểu** (Ngày/Tháng), cột Công TV / Công CT / Phép / Muộn / OT / KPI-SP / Xăng / Chức vụ / Chuyên cần / BH / Thuế / Tạm ứng / **Điều chỉnh** / Thực lĩnh. In có **3 chữ ký** |
| 8. Đánh giá KPI từng người | Tab mới **Lương → Đánh giá KPI**, theo tháng |
| 9–10. Theo SP: tên, đơn giá, SL; HĐ chọn KPI hay SP; nhiều SP mỗi SP một đơn giá | Hợp đồng: **Kiểu thưởng** = KPI / Sản phẩm + **danh mục SP & đơn giá** (nhiều dòng). Tab KPI: nút **📝 Sản phẩm** nhập SL từng SP trong tháng, đơn giá tự điền từ hợp đồng |

### 9.1 🔴 Việc anh phải làm TRƯỚC khi tính được: khai hợp đồng cho 47 người

Bảng lương chỉ tính người có **hợp đồng Hiệu lực** (Nhân sự → Hợp đồng lao động). Người chưa có **không có trong bảng** — sau khi bấm Tính lương, hộp kết quả liệt kê tên. Với mỗi người, khung **"Thông số tính lương công nhật (v9.45)"** trong form hợp đồng:

| Ô | Sheet 1 (36 người lương ngày) | Sheet 2 (11 người lương tháng) |
|---|---|---|
| Kiểu lương | **Ngày** | **Tháng** |
| Đơn giá ngày | cột "Lương ngày công" (Soan 500.000) | — |
| Lương cơ bản (ô cũ phía trên) | — | "Mức lương cơ bản" (Lan 10.000.000) |
| Mức đóng BHXH | suy từ tiền BH: 840k→8tr, 630k→6tr, 584k→**5,56tr**, 558k→**5,31tr**; người không đóng để trống | Hường 7tr, Ngọc 8tr; còn lại trống |
| Lương cố định/tháng | O Tám **10.000.000** | — |
| Ngày hết thử việc | — | người có "Ngày công thử việc" > 0 (Lan 16/10…) |
| Kiểu thưởng + quỹ KPI | Soan, Duyên: KPI, quỹ 500.000 | KPI, quỹ = "Thưởng KPIs"; **Hương Media: Sản phẩm** (ảnh 20.000, video 50.000) |
| Phụ cấp chức vụ (ô cũ) | Hợp 500.000 ("TN") | Lan 2tr, Thanh 1tr, Loan 1,6tr |
| Phụ cấp chuyên cần (ô cũ) | Hợp 300k, Nhung 300k, Cô Lan 200k | 500k / Thanh 300k / Ngọc 0 |
| Phụ cấp xăng xe + số công xăng (ô cũ) | Nhung: 15.000 × 26 = **390.000**, số công **26** | 20.000 × 27 = 540.000, số công 27 (Hường/Xuân 30.000 × 27) |
| Tỷ lệ thử việc (ô cũ) | trống | **Sâm: 70** (file 829.630 = 8tr/27 × 4 × 0,7 — không phải 85%) |

Nếu 47 hợp đồng là quá nặng để khai tay, nói tôi — tôi viết màn "Khai nhanh thông số lương" nhập một bảng, mỗi người một dòng.

### 9.2 Chạy thử T10/2026 và so với file

1. Cấu hình lương: **Công chuẩn tháng 10** = số anh chọn (file dùng cả 26 và 27 — phải chọn một). Hệ số TC ngày thường 1,5. Trừ thuế: Không. Làm tròn 1.000.
2. Tab Đánh giá KPI tháng 10: chấm **100 điểm** cho mọi người KPI (file đang trả đủ quỹ). **Lan: Tiền ghi đè 8.000.000** (file trả đủ 8tr dù 26,5/27 công — không theo công thức). Hương Media: 📝 Sản phẩm → ảnh × 247.
3. Lương công nhật → Tính lương. So **Thực lĩnh** với cột Thành tiền / Thực nhận của file:
   - **Khớp đến đồng** (đã kiểm bằng bộ tự kiểm trên 47 dòng): mọi người **không có OT** ở sheet 1 (15 người) và 10/11 người sheet 2 — *sheet 2 file không làm tròn nghìn, phần mềm làm tròn ⇒ lệch dưới 500đ là đúng*.
   - **Cố ý khác file:** 17 người có OT (công thức OT mới — file dùng 4 tỷ lệ lẫn lộn và hệ số 1,0); Duyên KPI 500k (file 519.231 vì chia 26 trong tháng 27 công); Hợp OT 7h = 468.563 (file 249.900).
   - **Ngọc −200k**: bấm ô **±** ở cột Điều chỉnh, ghi lý do "Nghỉ nhiều không xin phép". Số này giữ nguyên khi tính lại.
4. Chấm công: phần mềm lấy **công, phép (P), lễ (LT), giờ OT, giờ vào** từ Chấm công. Nếu T10 chưa có dữ liệu chấm công trong phần mềm thì chưa so được — khi đó so từng khoản bằng bộ tự kiểm là đủ để tin công thức, còn số công thì tháng 11 mới so được.
5. 🔴 **Nhìn cột "Muộn" trước khi chốt.** Luật "đi muộn dù một ngày = mất chuyên cần" (anh chốt) chạy trên **giờ vào của nhóm chấm công** (mặc định 08:00) + châm chước 5 phút. Nếu giờ vào cấu hình lệch giờ thật của xưởng thì **cả xưởng mất chuyên cần** ngay lần tính đầu (200k–500k/người). Thấy quá nhiều người "Muộn" ⇒ sửa giờ vào ở Chấm công → Cấu hình nhóm / phút châm chước ở Cấu hình lương, **không phải** sửa luật.
6. Nhân viên tự xem (menu "Bảng lương của tôi") thấy đúng các khoản như phiếu lương: thuế chỉ in dấu trừ khi có trừ, có dòng Điều chỉnh kèm lý do.

### 9.3 Giả định tôi tự đặt — anh xác nhận hoặc bác

- **Khoản tháng (quỹ KPI, chức vụ, trang phục, điện thoại) chặn trên 1 × mức tháng** khi công > công chuẩn. Bằng chứng: Hợp 31 công/26 nhận đúng 500k. Hệ quả: Duyên 27/26 nhận 500k thay vì 519.231.
- **Phép không tính xăng nhưng CÓ tính KPI và chức vụ** (Lan: chức vụ 2tr × 26,5/27 với 1 phép).
- **Lễ hưởng lương (LT)** tính như ngày làm cho lương + chuyên cần, **không** tính xăng.
- Người có **lương cố định** (O Tám) vẫn tính xăng/chuyên cần/BH theo công nếu có khai.
- **OT thử việc xét ở CUỐI THÁNG, không theo từng ngày**: người còn thử việc đến hết tháng thì toàn bộ giờ OT × tỷ lệ thử việc (Loan); hết thử việc giữa tháng thì toàn bộ OT tính 100%. Phần LƯƠNG thì tách đúng theo ngày. Đơn giản hóa cố ý — tách OT theo ngày cần sửa `gomChamCong`, làm khi anh thấy cần.
- Hợp đồng **hết hạn (Đến ngày đã qua) nhưng còn trạng thái Hiệu lực** vẫn được dùng để tính, kèm cảnh báo tên người — không tự loại ai.

---

## 10. Nghiệm thu — dấu vết lập / sửa trên phiếu bán hàng (v9.46)

Anh yêu cầu 11/11: *"phiếu bán hàng thêm giờ, ngày tháng lập đầu tiên để dưới người làm phiếu, tên người làm phiếu theo tên user đăng nhập. Nếu sửa ghi rõ, ngày sửa cuối cùng."*

| Chỗ | Trước | Nay |
|---|---|---|
| Bản in, ô ký **Người làm phiếu** | chỉ có nhãn | dưới nhãn: **tên user đã lập** (cách chỗ ký ~1 cm) + *Lập lúc hh:mm ngày dd/mm/yyyy* (giờ lập **đầu tiên**, không đổi khi sửa) |
| Bản in, chân phiếu | — | phiếu đã sửa hoặc đã hủy: dòng nghiêng *Sửa lần cuối: &lt;tên&gt; — hh:mm ngày dd/mm/yyyy* (căn phải). Chưa sửa thì **không có dòng này** |
| Màn xem phiếu (bấm số phiếu) | "Người lập: tên" | "Người lập: tên (hh:mm ngày …)" + dòng cam "Sửa lần cuối: …" khi có |

Kiểm nhanh (sau `migration_v891` + copy file + `pm2 restart`):

1. **Lập phiếu mới** bằng tài khoản A → In → dưới "Người làm phiếu" thấy tên A và giờ vừa lập. **Không** có dòng "Sửa lần cuối".
2. **Sửa phiếu đó** (đổi ghi chú) bằng tài khoản B → In → tên A + giờ lập **giữ nguyên**; thêm dòng *Sửa lần cuối: B — giờ vừa sửa*.
3. **Hủy** một phiếu → in bản hủy → có "(PHIẾU ĐÃ HỦY)" như cũ **và** dòng "Sửa lần cuối" = người hủy.
4. **Phiếu cũ** (lập trước v9.46, chưa ai sửa): có tên + giờ lập (cột `CreatedAt` có từ v6.68), không có "Sửa lần cuối" — đúng, vì chưa ai sửa **kể từ khi có v9.46**. Phiếu cũ từng sửa trước v9.46 cũng không có dòng này — phần mềm không bịa dấu vết quá khứ.
5. Giờ hiện trên phiếu phải là **giờ máy chủ** (giờ VN) — nếu lệch đúng 7 tiếng, gửi tôi: nghĩa là có chỗ nào đó đã đổi `useUTC`.

Chưa chạy `migration_v891` thì mọi thứ vẫn chạy: tên + giờ lập vẫn in; chỉ thiếu dấu vết sửa (im lặng, vì sửa phiếu không được phép thất bại vì thiếu một cột dấu vết).

---

## 11. Nghiệm thu — rê chuột vào ảnh nhỏ là hiện to (v9.47)

Anh yêu cầu 12/11: *"thẻ kho hàng hóa, chi tiết hàng hóa, thẻ kho phụ kiện, thẻ kho vải có hình ảnh: hiện tại đang phải click vào ảnh mới hiện to. Sửa để khi di chuột vào hình ảnh là hiện to luôn."*

Làm **một chỗ** trong `common.js` (bắt ở tầng trang, như lightbox v7.77) nên áp cho **mọi ô ảnh nhỏ** trong phần mềm, không riêng bốn màn — ô ảnh ở danh mục màu vải, đơn khách đặt, DMS… cũng được luôn. Luật: ảnh đang hiện **nhỏ** (≤ 160px) và là ảnh của phần mềm (trong link ảnh, có class `thumb`, hoặc src `/uploads/`, `/anh/`) thì rê vào là hiện bản to bên cạnh.

| Việc | Mong đợi |
|---|---|
| Rê chuột vào ô ảnh ở **Thẻ kho hàng hóa** | Sau ~0,1 giây, khung ảnh to (tới 640px, không quá 60% ngang / 80% dọc màn hình) hiện **bên phải** ô ảnh; ảnh ở sát mép phải thì khung sang **bên trái**. Dưới ảnh có mã hàng |
| Rời chuột khỏi ô ảnh | Khung biến mất ngay |
| Rê lướt dọc cột ảnh | Không nháy liên tục — chỉ ảnh chuột dừng lại mới hiện |
| **Bấm** vào ảnh | Vẫn mở toàn màn hình có nút ✕ như trước (khung xem trước tự ẩn) |
| **Chi tiết hàng hóa** (bấm vào dòng → "Lịch sử & chi tiết theo màu"): rê vào ảnh đại diện 72px và ảnh từng màu 36px | Hiện to như trên, kể cả khi đang ở trong cửa sổ |
| **Thẻ kho phụ kiện**, **Thẻ kho vải** (ô ảnh 40px) | Như trên |
| Cuộn trang / lăn chuột / gõ phím khi đang hiện | Khung ẩn |
| Trên **điện thoại / máy tính bảng** | **Không có** xem trước khi rê (không có chuột thật); chạm vẫn mở toàn màn như cũ |
| Ảnh **đang hiện lớn hơn 160px** (đã to sẵn, không có gì để "hiện to") | Không hiện khung. Ảnh sản phẩm 80px ở đầu bảng phụ kiện / kho vải vẫn ≤ 160 nên **có** |

Kỹ thuật, để anh biết khi thấy khác: bản xem trước tải ảnh cỡ **800px** (`/anh/800/…`) cho nhanh — hiện ảnh nhỏ phóng lên trước, tải xong thì nét lại; bấm mở toàn màn vẫn là ảnh gốc. Trong lúc khung đang hiện, chú giải "Bấm để phóng to" của trình duyệt được tạm tắt để không đè lên ảnh. Muốn **tắt** xem trước cho một chỗ nào đó: thêm `data-khong-xem-truoc` vào thẻ ảnh (hoặc thẻ cha) — nói tôi, tôi thêm.

---

## 8. Còn treo — không nằm trong đợt này

| Việc | Trạng thái |
|---|---|
| 🔴 **Đổi app secret Zalo đã lộ** (anh chụp màn hình trong hội thoại) | chưa làm |
| 🔴 **Đối chiếu tiền quỹ cắt T8–T11** sau v9.18 (`database\kiem_tra_v918_quy_cat_theo_thang.sql`) | chưa chạy |
| 🔴 **Đo chỗ trống ổ D: trước khi bật sao lưu log** (§4.5) | chờ anh |
| 🔶 `DBCC SHRINKFILE` lấy lại 136 MB của file .ldf — chỉ sau khi log đã được cắt ổn định vài ngày | chờ anh |
| 🔶 Zalo OA: nâng gói dịch vụ (`error -224`), tắt `user_received_message`, gỡ cờ `ZALO_OA_LOG_CHU_KY` | chờ |
| 🔶 Giá thành theo từng dải (§5.3) | chờ anh quyết |
| 🔶 Hoàn ứng (v9.32): chưa có đường ghi nhận. **Ai hoàn ứng thì ĐỪNG sửa phiếu chi cũ** | chưa viết |
| 🔶 "Giá trị tồn kho vải" (§6) | hoãn có chủ đích |
| 🔶 Xóa khối chết `__CU_renderSaoLuu_KHONG_DUNG` trong `module.users.js` | dọn sau |
