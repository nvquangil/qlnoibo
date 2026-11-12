# PRD v9.43 — Giá thành theo từng dải size

*Soạn 10/11/2026. **Chưa viết mã, chờ anh duyệt.***

---

## 1. Vấn đề

Nguyen 10/11: *"nên cho tách dải size … thì mới tính đúng chi phí giá thành từng dải"*.

Hiện tại `tinhGiaThanh()` gộp toàn bộ chi phí của lệnh rồi chia cho SL hoàn thành — ra **một con số chung cho mọi size**. Nhưng áo size 12 tốn vải hơn áo size 2 rõ rệt, nên con số chung đó:

- **giấu mất** việc dải size lớn đang lãi mỏng hơn (hoặc lỗ),
- làm mọi quyết định báo giá theo dải size đều dựa trên một con số không đúng cho dải nào cả.

Cột `TyLeVai` đã có từ v9.38 và người dùng đã khai được, nhưng **chưa nơi nào đọc nó**. Màn hình hiện đang nói đúng sự thật đó — *"đã khai đủ tỷ lệ vải (chưa dùng vào giá thành)"* — và PRD này là để gỡ dòng chữ đó đi.

---

## 2. Phát hiện làm việc này nhẹ đi nhiều

Trước khi bàn phương án, hai điều đã kiểm trên mã và trên nghiệp vụ:

**① Mẫu số KHÔNG cần dữ liệu mới.** Một ri luôn gồm đúng 6 cái của dải `2-7` và 5 cái của dải `8-12` — đó chính là định nghĩa của hệ số. Nên tỷ lệ **số cái** giữa các dải **bằng đúng** tỷ lệ hệ số, chính xác tuyệt đối, không phải ước lượng và không cần cột nào mới:

```
SL hoàn thành của dải = SL hoàn thành của lệnh × (HệSố[dải] / Σ HệSố)
```

Đây là lý do không cần gắn `DaiSizeID` vào sơ đồ, và **không cần migration**.

**② In thêu và gia công ngoài ĐÃ có dải size sẵn.** `DonHangNhaInTheu.DaiSizeID` và `DonHangChiTietNhaGiaCong.DaiSizeID` đã tồn tại từ v8.59/v9.13. Hai khoản này tính **chính xác theo dải**, không phải chia.

---

## 3. Cách chia từng khoản — và vì sao mỗi khoản một kiểu

🔴 **Đây là phần quan trọng nhất của PRD. Chia sai kiểu thì con số trông hợp lý mà vô nghĩa.**

| Khoản chi phí | Chia theo | Vì sao |
|---|---|---|
| **Vải** | `TyLeVai` | Khoản DUY NHẤT thật sự khác nhau giữa các dải. Size lớn ăn nhiều vải hơn — đó là cả lý do tính năng này tồn tại. |
| **In thêu** | *không chia* — đọc thẳng `DaiSizeID` | Đã khai theo dải từ v9.13. Số **chính xác**, không ước lượng. |
| **Gia công ngoài** | *không chia* — đọc thẳng `DaiSizeID` | Như trên. |
| **Công may nhà làm** | hệ số (số cái) | Đơn giá may tính theo CÁI, không theo size. |
| **Công cắt** | hệ số (số cái) | Tính theo cái. |
| **Phụ kiện** | hệ số (số cái) | Mỗi áo một cúc, một nhãn — không phụ thuộc size. |
| **Chi phí chung** | hệ số (số cái) | Vốn đã là số tiền cho MỘT sản phẩm. |

**Hệ quả phải nói thẳng:** mọi khoản chia theo hệ số, khi lấy chia cho mẫu số cũng theo hệ số, sẽ ra **đơn giá/cái giống hệt nhau ở mọi dải**. Nghĩa là thứ **duy nhất** làm giá thành các dải khác nhau là **tiền vải** (cộng in thêu/gia công nếu chúng khai khác nhau theo dải).

Đó không phải khiếm khuyết — đó là sự thật về cơ cấu chi phí, và đúng điều anh muốn nắm. Nhưng phải nói ra trên màn hình, nếu không người xem sẽ tưởng hệ thống tính ẩu.

---

## 4. Tiêu chí nghiệm thu

1. Lệnh **có tách dải** + **đã khai đủ `TyLeVai`** → bảng giá thành hiện **một dòng cho mỗi dải**, mỗi dòng có: SL hoàn thành, tiền vải, các khoản khác, giá thành 1 SP.
2. **Tổng của các dải = đúng con số tổng cũ, từng đồng.** Đây là phép kiểm quan trọng nhất: lệch một đồng nghĩa là một khoản bị chia sót hoặc chia hai lần.
3. Lệnh **chưa khai `TyLeVai`** hoặc **không tách dải** → hiện **y nguyên như hiện nay**, một dòng chung. Không có bất kỳ thay đổi nào với lệnh cũ.
4. Lệnh tách **MẪU** (không phải dải) → cũng hiện một dòng chung. Các mẫu dùng chung dải size nên tỷ lệ vải bằng nhau; chia ra chỉ tạo thêm dòng chứ không thêm thông tin.
5. Dòng chữ *"chưa dùng vào giá thành"* trên khung tách dải được thay bằng câu nói đúng việc mới.
6. Bộ tự kiểm chạy THẬT phép chia trên dữ liệu giả, khẳng định tiêu chí 2 và 3.

---

## 5. Phạm vi

**Trong phạm vi:**

- `tinhGiaThanh()` trả thêm mảng `theoDai[]` bên cạnh các số tổng hiện có. **Không đổi** bất kỳ trường nào đang có — màn hình cũ và mọi nơi khác đọc giá thành không bị ảnh hưởng.
- Bảng giá thành ở `module.qlsx.js` hiện thêm phần theo dải khi có dữ liệu.
- Bộ tự kiểm.

**Ngoài phạm vi (cố ý):**

- ❌ Gắn `DaiSizeID` vào sơ đồ — **không cần**, xem §2①. Anh xác nhận một sơ đồ luôn trải cả ri của lệnh.
- ❌ Migration — không có cột mới nào.
- ❌ Đổi cách tính tổng giá thành hiện tại. Tổng phải y nguyên.
- ❌ Giá bán / báo giá theo dải. Việc khác.
- ❌ Sửa "giá trị tồn kho vải" (nợ từ v9.36) — không liên quan.

---

## 6. Ràng buộc

🔴 **Tổng không được đổi.** Lệnh đang chạy, số giá thành đã có người đọc và dùng. Phần theo dải là **thêm vào**, không thay thế.

🔴 **Khuyết dữ liệu thì KHÔNG đoán.** Thiếu `TyLeVai` của một dải bất kỳ ⇒ không hiện phần theo dải, giữ nguyên một dòng chung. Đúng luật đã dùng ở `tyLeTheoMet()`: thà không có còn hơn có một con số sai mà nhìn như đúng.

🔴 **`TyLeVai` là số người dùng tự khai, đơn vị tự do.** Chỉ lấy TỶ LỆ, không bao giờ coi nó là mét hay kg. Màn hình phải nói rõ con số chia vải là **ước lượng theo tỷ lệ anh khai**, khác hẳn phần in thêu/gia công vốn là số đo thật.

🔴 **Mẫu số lấy cùng nguồn với bản hiện tại** — SL nhập kho thực tế, chưa nhập kho thì lấy SL cắt. Không được âm thầm đổi sang nguồn khác chỉ vì nguồn khác có sẵn dải size: hai màn cùng nói "giá thành" mà lấy hai mẫu số khác nhau là lỗi không ai đối chiếu nổi (đúng bài học v6.91.1).

---

## 7. Kế hoạch

| # | Việc | Phụ thuộc |
|---|---|---|
| 1 | `tinhGiaThanh()`: tính `theoDai[]` — vải theo `TyLeVai`, in thêu/gia công đọc thẳng `DaiSizeID`, phần còn lại theo hệ số | — |
| 2 | Phép tự kiểm "tổng các dải = tổng cũ" ngay trong hàm, lệch thì **bỏ phần theo dải** và ghi log thay vì trả ra số sai | 1 |
| 3 | Màn giá thành: bảng theo dải + câu nói rõ khoản nào đo thật, khoản nào ước lượng | 1 |
| 4 | Sửa câu trên khung tách dải (`module.qlsx.js`, chỗ *"chưa dùng vào giá thành"*) | 3 |
| 5 | Bộ tự kiểm chạy thật phép chia: tổng khớp · khuyết `TyLeVai` thì lùi · tách MẪU thì lùi · lệnh không tách không đổi gì | 1–4 |
| 6 | Rà chéo độc lập trước khi bàn giao | 1–5 |

Không migration. Bump `module.qlsx.js`.

---

## 8. Câu hỏi còn mở — cần anh chốt trước khi tôi viết

**① Dải cắt xong không đều thì sao?**

Giả sử dải `2-7` đã nhập kho đủ, dải `8-12` mới được nửa. Mẫu số chia theo hệ số sẽ coi như cả hai cùng tiến độ, trong khi tiền vải đã tiêu cho cả hai rồi. Kết quả: giá thành dải `8-12` **bị thổi lên** trong lúc nó chưa xong.

Ba cách:

- **(a)** Kệ — số sẽ đúng khi lệnh xong. Đơn giản nhất, nhưng xem giữa chừng dễ hiểu nhầm.
- **(b)** Chỉ hiện phần theo dải khi lệnh đã hoàn thành. An toàn nhất, nhưng mất khả năng theo dõi sớm.
- **(c)** Hiện kèm cảnh báo "dải này mới xong X%, giá thành còn đang cao hơn thực tế". **Tôi nghiêng về cách này.**

**② Lệnh đã khai `TyLeVai` nhưng tổng số lạ (ví dụ 2 dải cùng gõ 50) — có chặn không?**

Hiện `tyLeTheoMet()` chấp nhận mọi số dương vì đơn vị tự do. 50/50 là hợp lệ về mặt kỹ thuật (ra 50%/50%) nhưng với hai dải size khác nhau thì gần như chắc chắn là người dùng chưa hiểu ô đó. Có nên cảnh báo khi mọi dải cùng một số không?

**③ Hiện ở đâu?**

- **(a)** Thêm vài dòng vào cuối bảng giá thành hiện có.
- **(b)** Một bảng riêng bên dưới, có tiêu đề. **Tôi nghiêng về cách này** — bảng giá thành hiện đã dài, chen vào giữa dễ đọc nhầm dòng nào thuộc phần nào.

---

## 9. Việc đang treo, liên quan nhưng KHÔNG nằm trong PRD này

- 🔴 **Kiểm sơ đồ lót** (câu SQL đã gửi 10/11). Lót có sơ đồ riêng và cây khai `'Phối'` nên số đang đúng — nhưng nếu sơ đồ lót bị đánh `Kieu = 'Chính'` thì luật sơ đồ **đè** luật cây và lót chui vào SL cắt. Việc này ảnh hưởng **mẫu số** của chính PRD này, nên nên xử xong trước.
- 🔶 Mọi báo cáo tách chính/phối đang **gom lót vào phối** (vì lót khai `'Phối'`). Sơ đồ chỉ có hai kiểu `Chính`/`Phối`, không có `Phụ`. Muốn tách bạch thì cần migration riêng.
- 🔶 Đơn giá in thêu / công may theo dải (nợ 5c/5d từ v8.60) — nếu làm xong thì hai khoản đó càng chính xác theo dải.
