/* ================================================================================================
   kiem_cong_doan_may_cua_toi.js — v9.90: thợ may TỰ GHI công đoạn may của mình
   ------------------------------------------------------------------------------------------------
   Chạy:  node backend\utils\kiem_cong_doan_may_cua_toi.js        (không cần CSDL)

   Nguyen 23/11/2026: *"cho nhân viên tự nhập khi phân quyền... hoặc nhân viên thuộc bộ phận may
   nhập công đoạn của mình. Khi nhân viên tự nhập thì chỉ hiện ra chọn công đoạn và điền số lượng.
   Để cả 2 cách cập nhật."* + *"chỉ nhìn thấy của mình... thêm tick quyền cho tổ trưởng nhìn thấy
   hết của mọi người."*

   BA ĐIỀU PHẢI ĐÚNG, KIỂM TỪNG ĐIỀU:
     ① NhanVienID ÉP = người đăng nhập. Nhận nhanVienId từ client là thợ A ghi được vào lương thợ B.
     ② Cổng vào = BỘ PHẬN MAY (không phải tick quyền). Cổng "xem hết" = tick, và phải OPT-IN.
     ③ Đường ghi hộ cũ ở QLSX › Ghi tiến độ KHÔNG được mất — Nguyen yêu cầu "để cả 2 cách".
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let dat = 0, truot = 0;
const kiem = (ok, ten, them) => { if (ok) { dat++; console.log('   ✓ ' + ten); } else { truot++; console.log('   ✗ ' + ten + (them ? '  → ' + them : '')); } };

const sBe = doc('routes/qlsx.js');
const sFe = doc('../frontend/js/module.mypay.js');
const sQlsx = doc('../frontend/js/module.qlsx.js');
const sSql = doc('../database/migration_v907.sql');
const sIndex = doc('../frontend/index.html');
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const beSach = boComment(sBe);

// ------------------------------------------------------------------------------------------------
console.log('=== 1. Bốn route "của tôi" có đủ ===');
/* v9.93: '/cuatoi/lenh' (gõ tìm) ĐÃ BỎ, thay bằng '/cuatoi/lenhmay' (tự liệt kê lệnh ở công đoạn May). */
[['get', '/congdoanmay/cuatoi'], ['get', '/congdoanmay/cuatoi/lenhmay'], ['get', '/congdoanmay/cuatoi/congdoan'],
 ['post', '/congdoanmay/cuatoi'], ['delete', '/congdoanmay/cuatoi/:id']].forEach(([m, p]) => {
  kiem(new RegExp(`router\\.${m}\\('${p.replace(/\//g, '\\/').replace(/:/g, ':')}'`).test(beSach), `${m.toUpperCase()} ${p}`);
});

console.log('\n=== 2. 🔴 NhanVienID ÉP = người đăng nhập ===');
const postBody = (beSach.match(/router\.post\('\/congdoanmay\/cuatoi'[\s\S]*?\n\}\);/) || [''])[0];
kiem(!!postBody, 'cắt được thân route POST');
kiem(/\.input\('NhanVienID', sql\.Int, t\.nv\)/.test(postBody), 'INSERT dùng t.nv (nhân viên của phiên), KHÔNG phải giá trị từ client');
/* Nếu route đọc nhanVienId từ req.body thì dù hiện tại không dùng, bản sau rất dễ "tiện tay" nối vào. */
kiem(!/nhanVienId/.test(postBody), 'route POST KHÔNG hề đọc nhanVienId từ body (cắt tận gốc khả năng ghi hộ người khác)');
kiem(/thoMayCuaPhien|chanNeuKhongPhaiThoMay/.test(postBody), 'POST đi qua hàm xác định thợ may của phiên');

console.log('\n=== 3. Cổng vào = BỘ PHẬN MAY (không phải tick quyền) ===');
kiem(/const BO_PHAN_MAY = 'May'/.test(beSach), 'tên bộ phận khai thành hằng BO_PHAN_MAY (một chỗ, dễ đổi)');
/* v9.93: khớp theo TỪ ("Tổ may", "May 1" đều được) nhưng GIỮ DẤU — bỏ dấu thì "Máy" (cơ khí) lọt. */
kiem(/function laTenBoPhanMay/.test(beSach), 'v9.93: có hàm khớp tên bộ phận theo TỪ');
kiem(/\.split\(\/\[\^\\p\{L\}\\p\{N\}\]\+\/u\)/.test(beSach), 'tách theo từ (không so bằng nhau tuyệt đối như v9.90)');
const thanLaTen = (beSach.match(/function laTenBoPhanMay[\s\S]*?\n\}/) || [''])[0];
kiem(!/boDau|removeDiacritic|normalize\('NFD'\)/.test(thanLaTen),
  '🔴 KHÔNG bỏ dấu khi so (bỏ dấu thì bộ phận "Máy" thành "may", cả tổ cơ khí ghi được vào lương may)');
/* Lỗi v9.90: ẩn mục mà không nói lý do ⇒ thợ may không biết vướng gì. */
kiem(/lyDo:/.test(beSach), 'máy chủ trả về câu lyDo để màn hình nói ra');
kiem(/CHƯA KHAI BỘ PHẬN/.test(sBe) && /chưa được liên kết với hồ sơ nhân viên/.test(sBe),
  'lyDo phân biệt được: chưa liên kết nhân viên / chưa khai bộ phận / sai bộ phận');
kiem(/function chanNeuKhongPhaiThoMay/.test(beSach), 'có hàm chặn dùng chung');
kiem(/LEFT JOIN BoPhan bp ON bp\.BoPhanID = nv\.BoPhanID/.test(beSach), 'đọc bộ phận qua JOIN BoPhan (NhanVien không có cột TenBoPhan)');
/* Câu từ chối phải GỌI TÊN bộ phận đang khai — "không có quyền" chung chung thì quản trị không biết sửa ở đâu. */
kiem(/Hồ sơ của bạn đang thuộc bộ phận/.test(sBe), 'câu từ chối nói RÕ hồ sơ đang thuộc bộ phận nào');
kiem(/Tài khoản chưa liên kết hồ sơ nhân viên/.test(sBe), 'có câu riêng cho tài khoản chưa gắn nhân viên');
/* Dùng requireChucNang cho đường TỰ GHI là sai chốt: Nguyen nói không cần tick. */
const cacRouteMoi = (beSach.match(/router\.(get|post|delete)\('\/congdoanmay\/cuatoi[^)]*\)/g) || []).join(' | ');
kiem(!/requireChucNang/.test(cacRouteMoi), 'các route này KHÔNG gắn requireChucNang (đúng chốt: chỉ cần thuộc bộ phận May)', cacRouteMoi);
kiem(/requireAuth/.test(cacRouteMoi), 'nhưng vẫn phải requireAuth');

console.log('\n=== 4. "Xem hết của mọi người" phải là OPT-IN ===');
kiem(/coQuyenChucNang\(req\.session\.user, 'MYPAY', 'congdoanmaytatca'\)/.test(beSach),
  'dùng coQuyenChucNang (không-cấu-hình = KHÔNG có quyền), không dùng requireChucNang (thiếu = cho qua)');
const getBody = (beSach.match(/router\.get\('\/congdoanmay\/cuatoi',[\s\S]*?\n\}\);/) || [''])[0];
kiem(/\$\{tatCa \? '' : 'AND p\.NhanVienID = @nv'\}/.test(getBody), 'không có quyền xem hết ⇒ câu SQL lọc AND p.NhanVienID = @nv');
/* Xem ≠ sửa: tổ trưởng thấy hết nhưng không xóa được dòng người khác. */
const delBody = (beSach.match(/router\.delete\('\/congdoanmay\/cuatoi\/:id'[\s\S]*?\n\}\);/) || [''])[0];
kiem(/Number\(cu\.NhanVienID\) !== t\.nv/.test(delBody), 'DELETE chỉ cho xóa dòng của CHÍNH MÌNH');
kiem(!/congdoanmaytatca/.test(delBody), 'quyền "xem hết" KHÔNG mở đường xóa dòng người khác');

console.log('\n=== 5. Công đoạn phải thuộc ĐÚNG lệnh đang chọn ===');
kiem(/WHERE ID = @id AND DonHangID = @dh/.test(postBody),
  'POST kiểm công đoạn thuộc đúng lệnh (không kiểm = ghi số lệnh này vào đơn giá lệnh khác, lương sai âm thầm)');
kiem(/Số lượng phải lớn hơn 0/.test(postBody), 'POST chặn số lượng <= 0');
/* Ô chọn công đoạn của thợ may phải TRÙNG danh sách quản lý thấy, nếu không hai bên nhìn hai bảng khác nhau. */
/* Cắt bằng regex có thể KHÔNG khớp (đổi cách viết route) — lấy '' thay vì để [0] ném TypeError,
   bộ kiểm phải báo ĐỎ MỘT PHÉP chứ không được tự sập giữa chừng (sập = mất luôn các phép sau). */
const cdBody = (beSach.match(/router\.get\('\/congdoanmay\/cuatoi\/congdoan'[\s\S]*?\n\}\);/) || [''])[0];
kiem(/MIN\(ISNULL\(x\.TenPhieu, N''\)\)/.test(cdBody),
  'lọc "bản đơn giá đầu tiên" (v5.56) giống hệt GET /orders/:maDH/dongiacongdoanmay');

console.log('\n=== 6. Ngày theo GIỜ VN, và lương được đánh dấu tính lại ===');
kiem(!/toISOString\(\)/.test(postBody), 'KHÔNG dùng toISOString() (lệch -7 giờ ⇒ 0h–7h ghi lùi sang hôm trước, rơi nhầm kỳ lương)');
kiem(/homNayVN\(\)/.test(postBody), 'dùng homNayVN()');
kiem(/bangLuongTuDong\.danhDauTheoNgay/.test(postBody) && /bangLuongTuDong\.danhDauTheoNgay/.test(delBody),
  'ghi VÀ xóa đều đánh dấu bảng lương tháng đó phải tính lại');

console.log('\n=== 7. 🔴 Đường ghi hộ CŨ ở QLSX vẫn còn (Nguyen: "để cả 2 cách") ===');
kiem(/router\.post\('\/orders\/:maDH\/giaoviecmay'/.test(beSach), 'route /orders/:maDH/giaoviecmay còn nguyên');
kiem(/giaoviecmay/.test(boComment(sQlsx)), 'màn QLSX vẫn gọi giaoviecmay');
kiem(/INSERT INTO PhanCongMay/.test(beSach) && (beSach.match(/INSERT INTO PhanCongMay/g) || []).length === 2,
  'ĐÚNG HAI đường ghi PhanCongMay (ghi hộ + tự ghi), không sinh thêm đường thứ ba');

console.log('\n=== 8. Màn MYPAY ===');
const feSach = boComment(sFe);
kiem(/function phanCongDoanMayCuaToi/.test(feSach) && /function wireCongDoanMayCuaToi/.test(feSach), 'có hàm vẽ + hàm nối dây');
/* v9.99: mục này TÁCH khỏi trang phiếu lương, thành chức năng riêng MYPAY/congdoanmaycuatoi
   (drawCongDoanMay). Trước đây nó được nhúng vào draw() bằng ${phanCongDoanMayCuaToi(cm)}. */
kiem(/async function drawCongDoanMay\(\) \{/.test(feSach), 'có chức năng riêng drawCongDoanMay()');
kiem(/const than = phanCongDoanMayCuaToi\(cm\);/.test(feSach), 'drawCongDoanMay() có gọi vẽ');
kiem(/wireCongDoanMayCuaToi\(cm\);/.test(feSach), 'có gọi nối dây');
kiem(/key: 'congdoanmaycuatoi'/.test(feSach), 'getTabs có chức năng congdoanmaycuatoi');
/* Sửa / xóa / ghi xong phải vẽ lại ĐÚNG trang đang xem — gọi draw() sẽ nhảy về phiếu lương. */
kiem(!/closeModal\(\); draw\(\);/.test(feSach), 'luồng công đoạn may dùng veLai(), KHÔNG gọi thẳng draw()');
/* Form rút gọn đúng yêu cầu: KHÔNG có ô chọn nhân viên. */
kiem(!/mcmNhanVien|chọn nhân viên/i.test((feSach.match(/async function moFormCongDoanMayCuaToi[\s\S]*?\n  \}/) || [''])[0]),
  'form tự ghi KHÔNG có ô chọn nhân viên (đúng yêu cầu "chỉ hiện ra chọn công đoạn và điền số lượng")');
['mcmNgay', 'mcmLenh', 'mcmCongDoan', 'mcmSL', 'mcmLuu'].forEach(id => kiem(new RegExp(`id="${id}"`).test(sFe), `form có #${id}`));
/* Lỗi tải không được làm mất phần lương phía trên — bài học "một mục hỏng kéo cả màn trắng". */
kiem(/catch \(e\) \{ cm = \{ loi: e\.message \}; \}/.test(feSach), 'lỗi tải mục này KHÔNG kéo đổ cả màn lương');
kiem(/if \(!cm\.laBoPhanMay && !cm\.xemTatCa\) return ''/.test(feSach), 'không thuộc bộ phận May và không có quyền xem hết ⇒ không vẽ gì');

console.log('\n=== 9. migration_v907 ===');
kiem(/MYPAY', 'congdoanmaytatca'/.test(sSql) || /'congdoanmaytatca'/.test(sSql), 'có khai chức năng congdoanmaytatca');
kiem(/MacDinhCho/.test(sSql) && /congdoanmaytatca[^)]*, 0\)/.test(sSql.replace(/\s+/g, ' ')), 'MacDinhCho = 0 (phải tick mới có)');
kiem(/MERGE ChucNang/.test(sSql), 'dùng MERGE ⇒ chạy lại nhiều lần vô hại');
/* File migration KHÔNG được tạo bảng/cột mới — v9.90 cố ý dùng lại PhanCongMay. */
kiem(!/CREATE TABLE|ADD\s+\w+\s+(INT|NVARCHAR|DECIMAL)/i.test(boComment(sSql).replace(/--.*$/gm, '')),
  'migration KHÔNG tạo bảng/cột mới (dùng lại PhanCongMay — một nghiệp vụ một bảng)');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 10. v9.93 — lệnh ĐANG Ở công đoạn May tự hiện, đối chiếu tổng bàn cắt ===');
kiem(/router\.get\('\/congdoanmay\/cuatoi\/lenhmay'/.test(beSach), 'có route /congdoanmay/cuatoi/lenhmay');
kiem(!/router\.get\('\/congdoanmay\/cuatoi\/lenh'/.test(beSach), 'route gõ-tìm-lệnh cũ đã bỏ (không để hai đường)');
kiem(/d\.CongDoanHienTaiID = @st/.test(beSach), 'chỉ lấy lệnh ĐANG ĐỨNG ở công đoạn May');
/* 🔴 Tổng bàn cắt phải lấy bằng getCatMauList — ĐÚNG hàm màn Ghi tiến độ dùng (slCatTongChinh).
   Tự viết SUM khác là hai màn ra hai số; đây là họ bẫy Ri/hệ số đã sai 3 lần. */
const lenhMayBody = (beSach.match(/router\.get\('\/congdoanmay\/cuatoi\/lenhmay'[\s\S]*?\n\}\);/) || [''])[0];
kiem(/getCatMauList\(pool, o\.DonHangID\)/.test(lenhMayBody), 'tổng bàn cắt dùng getCatMauList (cùng nguồn với màn Ghi tiến độ)');
kiem(/DaMayCaTo/.test(lenhMayBody), 'trả về SL cả tổ đã may để đối chiếu');
/* Chặn vượt tổng bàn cắt phải ở MÁY CHỦ — chặn ở màn hình thì gọi thẳng API là lách được. */
kiem(/Vượt tổng bàn cắt/.test(postBody), 'POST chặn vượt tổng bàn cắt (409)');
kiem(/if \(tongCat > 0\)/.test(postBody), 'cắt CHƯA ghi sổ (tổng 0) thì KHÔNG chặn — không khoá cả tổ vì khâu trước chưa nhập');
kiem(/getCatMauList\(pool, order\.DonHangID\)/.test(postBody), 'POST cũng dùng getCatMauList, không tự tính kiểu khác');

console.log('\n=== 11. v9.93 — "xem tất cả" theo LỆNH, không phải danh sách dòng phẳng ===');
kiem(/router\.get\('\/congdoanmay\/lenh\/:maDH\/moinguoi'/.test(beSach), 'có route ai-đã-làm-lệnh-này');
const aiBody = (beSach.match(/router\.get\('\/congdoanmay\/lenh\/:maDH\/moinguoi'[\s\S]*?\n\}\);/) || [''])[0];
kiem(/if \(!MAY_XEM_TAT_CA\(req\)\) return res\.status\(403\)/.test(aiBody), 'route này đòi quyền congdoanmaytatca (403 nếu không có)');
kiem(/function moAiDaLamLenh/.test(feSach), 'màn hình có hàm mở danh sách mọi người');
kiem(/mcm-ai/.test(feSach), 'nút "Ai đã làm" trên từng dòng lệnh');

console.log('\n=== 12. v9.93 — KHÔNG ẩn im lặng nữa ===');
/* Lỗi v9.90: không phải bộ phận May thì return '' ⇒ màn trống, không ai biết vì sao. */
kiem(!/if \(!cm\.laBoPhanMay && !cm\.xemTatCa\) return ''/.test(feSach), 'bỏ nhánh return rỗng im lặng');
kiem(/Bạn <b>chưa tự ghi được<\/b> công đoạn may/.test(sFe), 'không ghi được thì VẪN hiện mục + nói lý do');
kiem(/escapeHtml\(cm\.lyDo/.test(sFe), 'in đúng câu lyDo của máy chủ');
kiem(/function veLenhDangMay/.test(feSach), 'có bảng lệnh đang ở công đoạn May');
kiem(/không có lệnh nào đang ở công đoạn May/.test(sFe), 'không có lệnh nào cũng NÓI RA, không để trống');
/* Form rút gọn: lệnh đã chọn sẵn từ bảng ⇒ không còn ô gõ tìm. */
kiem(!/id="mcmTim"/.test(sFe), 'form bỏ ô gõ tìm lệnh (lệnh chọn từ bảng ở trên)');
kiem(/moFormCongDoanMayCuaToi\(o\)/.test(feSach), 'form nhận lệnh đã chọn');
kiem(/Tổng bàn cắt:/.test(sFe), 'form hiện tổng bàn cắt để đối chiếu');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 13. v9.94 — đủ số theo bàn cắt thì TỰ CHUYỂN công đoạn ===');
kiem(/async function mayDaDuTheoBanCat/.test(beSach), 'có hàm xét "đã đủ theo bàn cắt"');
kiem(/async function tuChuyenKhoiCongDoanMay/.test(beSach), 'có hàm tự chuyển công đoạn');
const duBody = (beSach.match(/async function mayDaDuTheoBanCat[\s\S]*?\n\}/) || [''])[0];
const chuyenBody = (beSach.match(/async function tuChuyenKhoiCongDoanMay[\s\S]*?\n\}/) || [''])[0];
/* ④ MỌI công đoạn đã khai đơn giá phải đủ — dùng every(), dùng some() là một công đoạn đủ đã chuyển. */
kiem(/\.every\(x => Number\(x\.DaMay\) >= tongCat\)/.test(duBody), '🔴 phải ĐỦ TẤT CẢ công đoạn (every), không phải một cái (some)');
kiem(/if \(!ds\.length\) return false/.test(duBody), 'chưa khai công đoạn nào ⇒ KHÔNG tự chuyển');
kiem(/if \(!\(tongCat > 0\)\) return false/.test(duBody), 'chưa ghi sổ cắt (tổng 0) ⇒ KHÔNG tự chuyển');
kiem(/MIN\(ISNULL\(x\.TenPhieu, N''\)\)/.test(duBody), 'đếm đúng "bản đơn giá đầu tiên" (v5.56), không lẫn bản khác');
/* ① không kéo con trỏ của lệnh đã đi xa hơn — luật v5.48. */
kiem(/Number\(order\.CongDoanHienTaiID\) !== Number\(mayStage\.StageID\)\) return null/.test(chuyenBody),
  '🔴 chỉ chuyển khi lệnh ĐANG ĐỨNG ở công đoạn May (không kéo lùi/đẩy lệnh đã qua)');
kiem(/ORDER BY ThuTu/.test(chuyenBody), 'lấy công đoạn kế tiếp theo ThuTu, không đoán');
/* Khâu sau đọc TienDoChiTietMau — tự chuyển mà bỏ trống thì Đóng gói/Kho nhập thấy May = 0. */
kiem(/getStageActualQtyByColor/.test(chuyenBody), 'có ghi SL lũy kế THEO MÀU cho công đoạn May');
kiem(/if \(!daCoMau\)/.test(chuyenBody), '🔴 CHỈ ghi khi May chưa có dòng nào (quản lý đã nhập tay thì giữ của họ)');
kiem(/getCatStageId\(pool\)/.test(chuyenBody), 'số theo màu lấy từ công đoạn CẮT (không tự chia tỉ lệ)');
kiem(/notifyStageUsers/.test(chuyenBody), 'báo cho người của công đoạn sau, y đường "Gửi"');
kiem(/catch \(e\) \{ console\.warn\('\[v9\.94\] khong gui duoc thong bao/.test(chuyenBody),
  'lỗi gửi thông báo KHÔNG làm hỏng việc đã ghi');
/* Lỗi lúc tự chuyển không được nuốt mất dòng vừa ghi, cũng không được im lặng. */
kiem(/catch \(e\) \{ loiChuyen = e\.message;/.test(postBody), 'POST bọc try/catch quanh việc tự chuyển');
kiem(/daChuyen, loiChuyen/.test(postBody), 'POST trả cả daChuyen lẫn loiChuyen cho màn hình');
kiem(/TỰ CHUYỂN sang công đoạn/.test(sFe), 'màn hình NÓI RA khi lệnh được tự chuyển (không lặng lẽ)');
kiem(/KHÔNG tự chuyển được công đoạn/.test(sFe), 'màn hình nói ra khi ghi được nhưng chuyển hỏng');
/* 🔴 Mốc "tổng bàn cắt" phải là MỘT hàm dùng chung với gate Kho nhập/QC/ĐG. */
kiem(!/getCatMauList\(pool, o\.DonHangID\)/.test(beSach) && !/getCatMauList\(pool, order\.DonHangID\)/.test(beSach),
  '🔴 KHÔNG gọi getCatMauList thiếu stageId — phải qua getTongSLCatForOrder');
kiem((beSach.match(/getTongSLCatForOrder\(pool/g) || []).length >= 3,
  'cả 3 chỗ (danh sách lệnh, ai-đã-làm, gate POST) đều dùng getTongSLCatForOrder');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 14. v9.95 — cảnh báo ngay khi gõ · sửa khi lệnh còn ở May · ai cũng xem được ===');
/* ① Cảnh báo sống + khoá nút Lưu. Máy chủ vẫn phải chặn — màn hình chỉ nói sớm. */
kiem(/id="mcmCanhBao"/.test(sFe), 'form có ô cảnh báo');
kiem(/function soatLai/.test(feSach) && /\$\('#mcmSL'\)\.addEventListener\('input', soatLai\)/.test(feSach),
  'gõ tới đâu soát tới đó (không đợi bấm Lưu)');
kiem(/nut\.disabled = true;/.test(feSach), 'vượt tổng bàn cắt ⇒ KHOÁ nút Lưu');
kiem(/VƯỢT TỔNG BÀN CẮT/.test(sFe), 'câu cảnh báo nói rõ là vượt');
kiem(/DaMay/.test((beSach.match(/router\.get\('\/congdoanmay\/cuatoi\/congdoan'[\s\S]*?\n\}\);/) || [''])[0]),
  'route công đoạn trả kèm DaMay để màn hình soát sớm');

/* ② Sửa/xóa: ba cổng. */
kiem(/router\.put\('\/congdoanmay\/cuatoi\/:id'/.test(beSach), 'có route PUT sửa số lượng');
kiem(/async function dongMayDuocSua/.test(beSach), 'có hàm kiểm ba cổng dùng chung cho PUT và DELETE');
const cuaSua = (beSach.match(/async function dongMayDuocSua[\s\S]*?\n\}/) || [''])[0];
kiem(/Number\(cu\.NhanVienID\) !== t\.nv && !toTruong/.test(cuaSua), '③ dòng người khác thì phải là tổ trưởng');
kiem(/lenhConODangCongDoanMay/.test(cuaSua), '② lệnh phải CÒN ở công đoạn May');
kiem(/đã chuyển khỏi công đoạn May/.test(sBe), 'lệnh đã chuyển thì báo rõ lý do, không im');
kiem(/bạn chỉ sửa được dòng của chính mình/.test(sBe), 'từ chối sửa dòng người khác thì nói rõ nhờ tổ trưởng');
const putBody = (beSach.match(/router\.put\('\/congdoanmay\/cuatoi\/:id'[\s\S]*?\n\}\);/) || [''])[0];
/* 🔴 Sửa 50 thành 60 mà vẫn cộng cả dòng cũ là chặn oan — phải TRỪ chính dòng đang sửa. */
kiem(/AND ID <> @id/.test(putBody), '🔴 gate vượt-bàn-cắt khi SỬA phải trừ chính dòng đang sửa ra');
kiem(/tuChuyenKhoiCongDoanMay/.test(putBody), 'sửa xong cũng xét tự chuyển công đoạn (y như ghi mới)');
/* Sửa số ăn lương của người khác ⇒ phải có dấu vết. */
kiem(/SUA dong cong doan may cua/.test(sBe) && /XOA dong cong doan may cua/.test(sBe),
  '🔴 sửa/xóa dòng NGƯỜI KHÁC được ghi nhật ký (số này ăn vào lương khoán của họ)');
kiem(/bangLuongTuDong\.danhDauTheoNgay/.test(putBody), 'sửa xong đánh dấu bảng lương tính lại');

/* ③ Mọi thợ may xem được của nhau — KHÔNG còn chặn bằng tick. */
const aiBody2 = (beSach.match(/router\.get\('\/congdoanmay\/lenh\/:maDH\/moinguoi'[\s\S]*?\n\}\);/) || [''])[0];
kiem(!/if \(!MAY_XEM_TAT_CA\(req\)\) return res\.status\(403\)/.test(aiBody2),
  'bỏ chặn 403 — mọi thợ may xem được công đoạn của nhau');
kiem(/suaDuoc = conOMay && \(r\.cuaToi \|\| toTruong\)/.test(beSach), 'máy chủ tự tính cờ suaDuoc, màn hình không đoán luật');
kiem(/mcm-ai/.test(feSach) && !/cm\.xemTatCa \? ' <button type="button" class="btn small secondary mcm-ai"/.test(feSach),
  'nút "Ai đã làm" hiện cho MỌI thợ may, không phụ thuộc tick');
kiem(/const nhom = \[\]/.test(feSach) && /g\.ds\.push\(r\)/.test(feSach), 'bảng gom THEO CÔNG ĐOẠN');
kiem(/còn thiếu|VƯỢT \$\{tongCD - tongCat\}/.test(sFe), 'mỗi công đoạn có dòng tổng đối chiếu tổng bàn cắt');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 15. v9.96 — chỉ còn DANH SÁCH LỆNH · sửa SL bằng cách bấm vào ô · mã rập + ảnh ===');
/* Nguyen: "Phần này chỉ hiện danh sách lệnh" ⇒ bảng dòng-phẳng-theo-tháng phải BỎ HẲN. */
kiem(!/TỔNG KHOÁN MAY \$\{cm\.xemTatCa/.test(sFe), 'đã bỏ bảng dòng-phẳng-theo-tháng trong mục công đoạn may');
kiem(!/class="btn small secondary mcm-xoa"/.test(sFe), 'bỏ luôn nút Xóa của bảng cũ (không để nút mồ côi)');
/* Lý do bỏ được: tổng lương khoán may tháng đã có mục riêng ở trên. */
kiem(/Lương khoán may — Tháng/.test(sFe), 'vẫn còn mục "Lương khoán may — Tháng" (chỗ xem tổng tháng)');

kiem(/class="mcm-sl"/.test(sFe), 'ô SL bấm được để sửa');
kiem(!/const s = prompt\(/.test(feSach), 'KHÔNG dùng prompt() (máy tính bảng: bàn phím che hết bảng)');
kiem(/o\.addEventListener\('blur', luu\)/.test(feSach) && /e2\.key === 'Enter'/.test(feSach), 'Enter hoặc rời ô = lưu');
kiem(/e2\.key === 'Escape'/.test(feSach), 'Esc = bỏ, trả lại số cũ');
kiem(/if \(sl === cu\) return huy\(\)/.test(feSach), 'không đổi số thì KHÔNG gọi API');

/* Nguyen: "Công nhân bộ phận May vẫn chưa thấy danh sách lệnh" — vì v9.93 lọc cứng CongDoanHienTaiID. */
const lenhMayBody2 = (beSach.match(/router\.get\('\/congdoanmay\/cuatoi\/lenhmay'[\s\S]*?\n\}\);/) || [''])[0];
kiem(!/WHERE d\.CongDoanHienTaiID = @st\b/.test(lenhMayBody2), '🔴 KHÔNG còn lọc cứng CongDoanHienTaiID (đó là lý do danh sách rỗng)');
kiem(/ISNULL\(d\.TrangThai, N''\) <> N'Hoàn thành'/.test(lenhMayBody2), 'lấy mọi lệnh chưa Hoàn thành có khai đơn giá may');
kiem(/AS DangOMay/.test(lenhMayBody2), 'có cờ DangOMay để phân biệt + xếp lên đầu');
kiem(/ORDER BY CASE WHEN d\.CongDoanHienTaiID = @st THEN 0 ELSE 1 END/.test(lenhMayBody2), 'lệnh đang ở May xếp TRƯỚC');
kiem(/COT_ANH_SAN_LUONG\('d'\)/.test(lenhMayBody2), 'ẢNH dùng COT_ANH_SAN_LUONG (bản công thức ảnh lệnh dùng chung)');
kiem(/maRapTheoDon/.test(lenhMayBody2), 'MÃ RẬP dùng maRapTheoDon (một bản công thức, hai nguồn)');
kiem(/<th style="width:52px;">Ảnh<\/th>/.test(sFe) && /<th>Mã rập<\/th>/.test(sFe), 'bảng lệnh có cột Ảnh + Mã rập');
/* Tổ trưởng chỉ-có-tick (không thuộc bộ phận May) cũng phải thấy danh sách. */
kiem(/if \(cm\.laBoPhanMay \|\| cm\.xemTatCa\) veLenhDangMay\(cm\)/.test(feSach), 'tổ trưởng chỉ-có-tick cũng thấy danh sách lệnh');
kiem(/chanNeuKhongPhaiThoMay\(pool, req, res, true\)/.test(beSach), 'route ĐỌC nhận cờ choXem để tổ trưởng vào được');
kiem(/if \(choXem && MAY_XEM_TAT_CA\(req\)\) return t;/.test(beSach), 'cờ choXem CHỈ nới cho route đọc, route ghi vẫn đòi bộ phận May');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 16. v9.97 — so theo TỪNG CÔNG ĐOẠN · cột Ghi chú · nhiều công đoạn 1 lần ===');
/* 🔴 Cột "Còn lại" cũ = tổng MỌI công đoạn − tổng bàn cắt ⇒ lệnh 5 công đoạn ra −5964. Phải bỏ. */
kiem(!/<th>Còn lại<\/th>/.test(sFe), '🔴 BỎ cột "Còn lại" (tổng mọi công đoạn trừ bàn cắt = số vô nghĩa)');
kiem(/<th>Ghi chú<\/th>/.test(sFe), 'có cột Ghi chú');
/* v9.98 thay luôn: cột "Đã may" KHÔNG cộng tổng nữa mà liệt kê từng công đoạn — xem mục 17. */
kiem(/Thiếu: \$\{thieu\.map/.test(sFe), 'ghi chú liệt kê công đoạn nào thiếu bao nhiêu');
kiem(/Đủ cả \$\{num\(o\.SoCongDoan\)\} công đoạn/.test(sFe), 'đủ hết thì nói đủ');
/* Máy chủ phải gom theo (lệnh × CÔNG ĐOẠN), không gom cả lệnh. */
const lenhMayBody3 = (beSach.match(/router\.get\('\/congdoanmay\/cuatoi\/lenhmay'[\s\S]*?\n\}\);/) || [''])[0];
kiem(/GROUP BY g\.DonHangID, g\.TenCongDoan/.test(lenhMayBody3), '🔴 gom theo (lệnh × công đoạn), KHÔNG gom cả lệnh');
kiem(/o\.Thieu = /.test(lenhMayBody3) && /o\.DuHet = /.test(lenhMayBody3), 'trả về danh sách thiếu + cờ đủ hết');

/* Nhiều công đoạn trong một lần gửi. */
kiem(/Array\.isArray\(b\.dong\) && b\.dong\.length/.test(postBody), 'POST nhận mảng `dong`');
kiem(/donGiaCongDoanMayId: b\.donGiaCongDoanMayId, soLuong: b\.soLuong/.test(postBody),
  'vẫn nhận dạng 1 dòng cũ (bản JS trong cache trình duyệt không gãy)');
/* 🔴 Tách 100 thành 2 dòng 50 trên CÙNG công đoạn phải bị chặn y như 1 dòng 100. */
kiem(/themTheoCD\.set\(String\(it\.cd\.ID\), \(themTheoCD\.get\(String\(it\.cd\.ID\)\) \|\| 0\) \+ it\.sl\)/.test(postBody),
  '🔴 máy chủ CỘNG DỒN các dòng cùng công đoạn trước khi so (không lách được bằng cách tách dòng)');
kiem(/for \(const it of items\) \{[\s\S]*?INSERT INTO PhanCongMay/.test(postBody), 'ghi lần lượt từng dòng');
kiem(/class="mcm-dong"/.test(sFe) && /id="mcmThemDong"/.test(sFe), 'form có nhiều dòng + nút thêm dòng');
kiem(/them\.set\(x\.cd, \(them\.get\(x\.cd\) \|\| 0\) \+ x\.sl\)/.test(feSach), 'màn hình cũng cộng dồn cùng công đoạn khi soát sớm');
kiem(/dong: ds2\.map\(x => \(\{ donGiaCongDoanMayId: x\.cd, soLuong: x\.sl \}\)\)/.test(feSach), 'gửi lên dạng mảng');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 17. v9.98 — cột "Đã may" theo TỪNG công đoạn · ẩn lệnh đã đủ ===');
kiem(/\(theo từng công đoạn\)/.test(sFe), 'tiêu đề cột ghi rõ "theo từng công đoạn"');
kiem(!/<td style="text-align:right;">\$\{num\(o\.DaMayCaTo\)\}<\/td>/.test(sFe), '🔴 KHÔNG còn in con số TỔNG mọi công đoạn');
kiem(/\(o\.CongDoan \|\| \[\]\)\.map\(c =>/.test(feSach), 'liệt kê từng công đoạn kèm SL');
kiem(/o\.CongDoan = cds\.map\(c => \(\{ ten: c\.ten, daMay: c\.daMay \}\)\)/.test(beSach), 'máy chủ trả mảng CongDoan');
/* Ẩn lệnh đã đủ — nhưng KHÔNG được bít lối sửa: 👥 là đường duy nhất để sửa/xóa dòng ghi thừa. */
kiem(/ds\.filter\(o => !o\.DuHet\)/.test(feSach), 'mặc định ẩn lệnh đã đủ MỌI công đoạn');
kiem(/id="mcmHienDu"/.test(sFe), '🔴 vẫn có ô tích "Hiện cả lệnh đã đủ" (ẩn cứng là bít lối sửa số ghi thừa)');
kiem(/box\.dataset\.hienDu/.test(feSach), 'trạng thái ô tích giữ được khi vẽ lại');
kiem(/Tất cả \$\{ds\.length\} lệnh đều đã may đủ/.test(sFe), 'lọc hết sạch thì NÓI RA, không để bảng trống');

console.log('\n=== 18. Bump ?v= ===');
const v = parseFloat((sIndex.match(/module\.mypay\.js\?v=([\d.]+)/) || [])[1] || '0');
kiem(v >= 9.98, 'index.html: module.mypay.js ≥ 9.98', String(v));

console.log(`\n================ KẾT QUẢ: ${dat} đạt / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
