/* ================================================================================================
   kiem_bo_cuc_phieu_2_cot.js — v9.89: bố cục 2 cột kiểu KiotViet ở phiếu BÁN HÀNG + NHẬP KHO
   ------------------------------------------------------------------------------------------------
   Chạy:  node backend\utils\kiem_bo_cuc_phieu_2_cot.js        (không cần CSDL)

   Nguyen 23/11/2026, kèm 2 ảnh màn KiotViet: *"thay đổi lại giao diện phiếu bán hàng và nhập kho
   hàng hóa"*. Chốt phạm vi: **chỉ bố cục 2 cột**, giữ nguyên luồng lưu và cách thu tiền.

   🔴 BỘ KIỂM NÀY CHỦ YẾU KIỂM CÁI **KHÔNG ĐƯỢC ĐỔI**. Hai màn này là màn TIỀN (banhang.js là nơi
   DUY NHẤT ghi XuatCai) và có ~24 bộ tự kiểm khác bám vào id/class/payload bằng so chuỗi. Đổi bố
   cục mà lỡ đổi một id là vừa vỡ bộ kiểm vừa vỡ nghiệp vụ. Nên: mọi id cũ phải CÒN ĐỦ.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let dat = 0, truot = 0;
const kiem = (ok, ten, them) => { if (ok) { dat++; console.log('   ✓ ' + ten); } else { truot++; console.log('   ✗ ' + ten + (them ? '  → ' + them : '')); } };

const sBH = doc('../frontend/js/module.khohang.js');
const sNK = doc('../frontend/js/module.nhapkho.js');
const sCss = doc('../frontend/css/style.css');
const sIndex = doc('../frontend/index.html');
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ------------------------------------------------------------------------------------------------
console.log('=== 1. CSS khung 2 cột ===');
kiem(/\.phieu-2cot \{[^}]*display: flex/.test(sCss), '.phieu-2cot là flex');
kiem(/\.phieu-2cot \{[^}]*flex-wrap: wrap/.test(sCss), '.phieu-2cot có flex-wrap ⇒ màn hẹp tự về 1 cột (không cần media query)');
/* min-width:0 ở cột trái: thiếu nó thì bảng rộng làm phình flex item, cả modal tràn ngang thay vì
   cuộn trong .table-wrap. Lỗi kinh điển của flex + bảng, rất khó nhìn ra sau này. */
kiem(/\.p2-trai \{[^}]*min-width: 0/.test(sCss), '.p2-trai có min-width:0 (không thì bảng rộng làm tràn ngang cả modal)');
kiem(/\.p2-phai \{[^}]*flex: 0 1 340px/.test(sCss), '.p2-phai có bề ngang cố định ~340px');
kiem(/\.phieu-2cot \.p2-phai \.form-grid \{ grid-template-columns: 1fr/.test(sCss), 'form-grid trong cột phải xếp 1 cột');
kiem(/\.p2-tien \{[^}]*justify-content: space-between/.test(sCss), '.p2-tien: nhãn trái — số phải');

console.log('\n=== 2. Hai màn đều dùng khung đó ===');
[['Bán hàng', sBH], ['Nhập kho', sNK]].forEach(([ten, s]) => {
  kiem(/class="phieu-2cot"/.test(s), `${ten}: có <div class="phieu-2cot">`);
  kiem(/class="p2-trai"/.test(s), `${ten}: có cột trái`);
  kiem(/class="p2-phai"/.test(s), `${ten}: có cột phải`);
});

// ------------------------------------------------------------------------------------------------
console.log('\n=== 3. 🔴 PHIẾU BÁN HÀNG — mọi id/class CŨ phải còn đủ ===');
/* Danh sách này chép từ chính các bộ kiểm đang bám vào màn (kiem_quet_ma_vach_phieu_ban_hang,
   kiem_sua_phieu_ban_hang, kiem_chot_ban_hang_mau, kiem_hang_mau_o_khach...). Mất một cái là một
   bộ kiểm khác đỏ — và tệ hơn, một mảnh nghiệp vụ câm. */
const ID_BH = ['fBH', 'bhKhachSel', 'bhKhachId', 'bhKhach', 'bhSDT', 'bhDiaChi', 'bhLaHangMau',
  'bhNhacMauBox', 'bhThemKhach', 'bhDong', 'bhTbody', 'bhThem', 'bhQuet', 'bhCKNPP', 'bhApNPP',
  'bhVAT', 'bhTongSL', 'bhTongHang', 'bhTienCK', 'bhTruocVAT', 'bhTienVAT', 'bhTongTT', 'bhBangChu', 'btnCancel'];
ID_BH.forEach(id => kiem(new RegExp(`id="${id}"`).test(sBH), `còn id="${id}"`));
const CLASS_BH = ['bh-row', 'bh-mahang', 'bh-mau', 'bh-sl', 'bh-ri', 'bh-gia', 'bh-ck', 'bh-giaban',
  'bh-tt', 'bh-xoa', 'bh-trong', 'bh-them-row'];
CLASS_BH.forEach(c => kiem(new RegExp(`${c}`).test(sBH), `còn class .${c}`));
kiem(/name="ckNPP"/.test(sBH) && /name="vat"/.test(sBH), 'còn name="ckNPP" và name="vat" (FormData lúc lưu đọc 2 ô này)');
kiem(/name="laHangMau" id="bhLaHangMau"/.test(sBH), 'ô "Gửi mẫu" giữ nguyên name+id liền nhau (bộ kiểm hàng mẫu so chuỗi chính xác)');
/* Bộ kiểm quét mã vạch ràng ĐÚNG thứ tự hai nút này. Dời bố cục mà đổi thứ tự là nó đỏ. */
kiem(/id="bhThem">\+ Thêm dòng hàng<\/button>\s*(\$\{''\}\s*)?<button type="button" class="btn small secondary" id="bhQuet"/.test(boComment(sBH)),
  '#bhQuet vẫn đứng NGAY SAU #bhThem (ràng buộc của kiem_quet_ma_vach_phieu_ban_hang.js)');

console.log('\n=== 4. Chân phiếu rời khỏi bảng — phải rời DỨT ĐIỂM ===');
const bhSach = boComment(sBH);
kiem(!/function chanPhieuHtml\(\)/.test(bhSach), 'hàm chanPhieuHtml() đã BỎ HẲN (không để hàm chết sinh ra 2 chỗ cùng id)');
kiem(!/chanPhieuHtml\(\)/.test(bhSach), 'không còn chỗ nào GỌI chanPhieuHtml()');
kiem(!/class="bh-chan"/.test(bhSach), 'không còn <tr class="bh-chan"> trong bảng');
/* Dòng "Chưa có dòng nào" trước đây neo vào .bh-chan — neo cũ còn sót là ném lỗi khi xóa dòng cuối. */
kiem(!/querySelector\('\.bh-chan'\)/.test(bhSach), 'không còn querySelector(\'.bh-chan\') (neo cũ ⇒ lỗi khi xóa dòng cuối cùng)');
kiem(/querySelector\('\.bh-them-row'\)\.insertAdjacentHTML\('beforebegin'/.test(bhSach),
  'dòng "Chưa có dòng nào" neo vào .bh-them-row');
/* 3 ô ở cột phải vẽ một lần ⇒ nối dây một lần. Để trong veDong() là chồng handler mỗi lần vẽ lại. */
const veDongBody = (bhSach.match(/function veDong\(\) \{[\s\S]*?\n    \}/) || [''])[0];
kiem(!!veDongBody, 'cắt được thân veDong()');
kiem(!/#bhCKNPP'\)\.addEventListener/.test(veDongBody), 'veDong() KHÔNG còn nối sự kiện #bhCKNPP (tránh chồng handler)');
kiem(!/#bhApNPP'\)\.addEventListener/.test(veDongBody), 'veDong() KHÔNG còn nối sự kiện #bhApNPP');
kiem(/#bhThem'\)\.addEventListener/.test(veDongBody), 'veDong() VẪN nối #bhThem (nút này nằm trong bảng, vẽ lại mỗi lần)');
kiem(/#bhQuet'\)\.addEventListener/.test(veDongBody), 'veDong() VẪN nối #bhQuet');
kiem((bhSach.match(/#bhCKNPP'\)\.addEventListener\('input', tinhTong\)/g) || []).length === 1,
  '#bhCKNPP được nối ĐÚNG MỘT lần trong cả hàm');
/* Nút Lưu là type=submit và vẫn nằm trong <form id="fBH"> ⇒ submit handler cũ không phải sửa. */
kiem(/<button type="submit" class="btn p2-luu">/.test(sBH), 'nút Lưu ở cột phải vẫn là type="submit"');

console.log('\n=== 5. 🔴 PHIẾU NHẬP KHO — mọi id CŨ phải còn đủ ===');
const ID_NK = ['nkfNgay', 'nkfLoai', 'nkfNhanNguon', 'nkfONguon', 'nkfSoHD', 'nkfNgayHD', 'nkfGhiChu',
  'nkfTaoThe', 'nkfDmChung', 'nkfBang', 'nkfTong', 'nkfHuy', 'nkfLuu'];
ID_NK.forEach(id => kiem(new RegExp(`id="${id}"`).test(sNK), `còn id="${id}"`));
kiem(/<option value="TonDauKy"/.test(sNK), 'còn option TonDauKy (v9.66 — bộ kiểm kiem_ton_dau_ky_khong_cong_no bám vào)');
kiem(/value="NhaCungCap"/.test(sNK) && /value="SanXuat"/.test(sNK), 'còn 2 option loại nhập kia');
kiem(/<div class="modal-foot">[\s\S]{0,200}id="nkfLuu"/.test(sNK), 'nút Lưu vẫn ở .modal-foot (không dời, tránh phá luồng cũ)');

console.log('\n=== 6. Thu tiền: KHÔNG đổi (Nguyen chốt giữ phiếu thu riêng) ===');
/* KiotViet thu ngay trên phiếu; Nguyen chốt GIỮ cách cũ. Nếu bản sau lỡ thêm ô "khách trả ngay"
   thì phiếu vừa lập đã có DaThu > 0 ⇒ bị luật khóa sửa v9.04 chặn ngay — phải rà lại luật đó trước. */
kiem(!/id="bhKhachTra"|name="khachTraNgay"|id="bhThanhToan"/.test(bhSach),
  'phiếu bán hàng CHƯA thêm ô thu tiền ngay (đúng chốt; thêm thì phải nới luật khóa sửa v9.04)');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 7. v9.91 — phiếu bán hàng 2 cột CỐ ĐỊNH, cuộn riêng ===');
kiem(/class="phieu-2cot co-dinh"/.test(sBH), 'phiếu bán hàng dùng biến thể .co-dinh');
kiem(!/co-dinh/.test(sNK), 'phiếu NHẬP KHO KHÔNG dùng .co-dinh (vẫn tự về 1 cột khi hẹp — Nguyen chỉ yêu cầu cho bán hàng)');
kiem(/\.phieu-2cot\.co-dinh \{[^}]*flex-wrap: nowrap/.test(sCss), 'co-dinh: flex-wrap nowrap ⇒ cột phải KHÔNG bao giờ xuống dưới');
kiem(/\.phieu-2cot\.co-dinh \{[^}]*overflow-x: auto/.test(sCss), 'co-dinh: màn hẹp thì cuộn NGANG (hệ quả cố ý của "cố định bất kể độ phân giải")');
kiem(/\.phieu-2cot\.co-dinh > \.p2-phai \{ flex: 0 0 340px/.test(sCss), 'co-dinh: cột phải không co lại');
kiem(/overflow-y: auto/.test((sCss.match(/\.phieu-2cot\.co-dinh > \.p2-trai,[\s\S]*?\}/) || [''])[0]), 'co-dinh: hai cột có vùng cuộn RIÊNG');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 7b. v10.04 — phiếu bán hàng dùng hết màn rộng (Nguyen: "cho rộng hơn, 1657x865") ===');
/* Nới cho RIÊNG phiếu bán hàng bằng class trên BACKDROP; .modal chung PHẢI giữ 1240px vì 200+ cửa sổ
   khác dựa vào mốc đó. Đây là chỗ dễ "tiện tay" sửa nhầm nhất nên kiểm cả hai chiều. */
kiem(/\.modal \{[^}]*max-width: 1240px/.test(sCss), '🔴 .modal CHUNG vẫn 1240px (KHÔNG nới toàn hệ thống)');
kiem(/\.modal-backdrop\.bh-rong > \.modal \{[^}]*max-width: calc\(100vw - 16px\)/.test(sCss), 'v10.05: .modal của phiếu BH lấy TRỌN bề ngang khung nhìn (bỏ trần 1700px)');
kiem(/\.modal-backdrop\.bh-rong \{[^}]*padding: 8px/.test(sCss), 'màn THẤP: thu đệm backdrop 40px → 8px');
kiem(/\.modal-backdrop\.bh-rong[\s\S]*?max-height: calc\(100vh - 150px\)/.test(sCss), 'màn THẤP: hai cột chừa 150px');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 7c. v10.05 — cột MÀU không bị bóp về 0 (Nguyen: "Cột mầu ko hiện ra") ===');
/* 🔴 Gốc lỗi: `width:` trên <th> là GỢI Ý MỀM — bảng thiếu chỗ thì trình duyệt bóp ô CO ĐƯỢC NHẤT, mà
   ô Màu chứa <select style="width:100%"> nên co gần về 0. `min-width` mới là SÀN CỨNG. */
kiem(!/<th style="width:130px;">Màu<\/th>/.test(sBH), '🔴 KHÔNG còn width:130px (gợi ý mềm ⇒ bị bóp về 0)');
kiem(/<th style="min-width:\$\{rongMau\}px;">Màu<\/th>/.test(sBH), 'cột Màu dùng min-width theo rongMau');
kiem(/const rongMau = Math\.min\(260, Math\.max\(130,/.test(sBH), 'rongMau kẹp 130…260px');
kiem(/chiTietMau \|\| \[\]\)\.reduce/.test(sBH), 'rongMau tính theo TÊN MÀU DÀI NHẤT (rộng theo tên — đúng yêu cầu)');
kiem(/class="bh-o-mau"/.test(sBH) && /\.bh-o-mau \{ white-space: normal/.test(sCss), 'ô Màu cho XUỐNG DÒNG (lựa chọn thứ hai Nguyen đưa ra)');
kiem(/overflowX = 'auto'/.test(sBH), 'thiếu chỗ thì bảng CUỘN NGANG, không bóp cột nào về 0');
kiem(/\.modal-backdrop\.bh-rong .*\.p2-phai \{ flex: 0 0 380px/.test(sCss), 'phần dư dồn cho cột TRÁI (cột phải chỉ 340→380px)');
/* Cả HAI đường mở form đều phải rộng — thiếu một là mở phiếu lẻ về 1240px, cùng form mà khác bề ngang. */
kiem(/classList\.add\('bh-rong'\)/.test(sBH) && (sBH.match(/classList\.add\('bh-rong'\)/g) || []).length === 2,
  'gắn class ở CẢ hai đường: nhiều tab + một phiếu', (sBH.match(/classList\.add\('bh-rong'\)/g) || []).length + ' chỗ');
kiem(/if \(!khung\) modal\.classList\.add\('bh-rong'\)/.test(sBH), 'đường một phiếu gác !khung (nhánh có khung thì modal là PANE, không phải backdrop)');

console.log('\n=== 8. v9.91 — ẩn Shop bán lẻ + NVKD nhưng KHÔNG đánh mất giá trị ===');
/* Ẩn mà xóa luôn trường thì phiếu MỚI lấy từ đơn (shop / NVKD Đi tuyến) mất giá trị điền sẵn
   ⇒ doanh số NVKD hụt âm thầm. Phải là hidden giữ nguyên name + value. */
kiem(!/<select name="shopId"/.test(sBH), 'ô chọn Shop bán lẻ đã ẩn khỏi form');
kiem(!/<select name="nhanVienId"/.test(sBH), 'ô chọn Nhân viên kinh doanh đã ẩn khỏi form');
kiem(/<input type="hidden" name="shopId"/.test(sBH), 'vẫn còn hidden name="shopId" (giữ giá trị khi lưu/sửa)');
kiem(/<input type="hidden" name="nhanVienId"/.test(sBH), 'vẫn còn hidden name="nhanVienId"');
kiem(/shopId: fd\.get\('shopId'\) != null \? \(fd\.get\('shopId'\) \|\| null\) : undefined/.test(bhSach),
  'payload v7.24 giữ nguyên (gửi undefined = máy chủ giữ nguyên giá trị cũ)');

console.log('\n=== 9. v9.91 — nhiều tab hoá đơn ===');
kiem(/async function moPhieuBanHangNhieuTab/.test(bhSach), 'có hàm khung nhiều tab');
/* 3 chỗ mở phiếu (nút Lập phiếu, nút Sửa, "Lấy từ đơn khách") đều phải đi qua khung — sót một chỗ
   là chỗ đó mở modal kiểu cũ, không có nút ⊕, người dùng tưởng tính năng lúc có lúc không. */
const soKhung = (bhSach.match(/moPhieuBanHangNhieuTab\(perm/g) || []).length - 1;   // trừ chính dòng khai báo hàm
kiem(soKhung === 3, 'cả 3 chỗ mở phiếu (Lập phiếu / Sửa / Lấy từ đơn khách) đều qua khung nhiều tab', 'đang ' + soKhung);
/* Còn chỗ nào gọi thẳng openPhieuBanHangForm (ngoài khung) là chỗ đó mở modal kiểu cũ, không có ⊕
   — người dùng tưởng tính năng lúc có lúc không. Chỉ được đúng 1 lệnh gọi, nằm trong themTab(). */
const soThang = (bhSach.match(/openPhieuBanHangForm\(perm/g) || []).length - 1;
kiem(soThang === 1, 'chỉ CÒN ĐÚNG MỘT chỗ gọi openPhieuBanHangForm (bên trong themTab)', 'đang ' + soThang);
kiem(/const modal = khung \? khung\.veVao\(noiDungForm\) : openModal\(noiDungForm\)/.test(bhSach),
  'form vẽ được vào pane HOẶC modal riêng (đường cũ còn nguyên)');
kiem(/const dongChoNay = \(\) => \{ if \(khung\) khung\.dongTab\(\); else closeModal\(\); \}/.test(bhSach),
  'Hủy / lưu xong: có khung thì đóng TAB, không thì đóng modal');
kiem(/dongChoNay\(\);/.test(bhSach) && !/\n        closeModal\(\);\n        toast\(`Đã lưu phiếu/.test(bhSach),
  'sau khi lưu gọi dongChoNay() chứ không closeModal() cứng (tab khác đang nhập dở phải còn)');
/* Giữ DOM từng tab = giữ state. Vẽ lại khi đổi tab là mất sạch dòng đang nhập. */
kiem(/t\.pane\.style\.display = t\.hien \? '' : 'none'/.test(bhSach), 'đổi tab = ẩn/hiện pane, KHÔNG vẽ lại (giữ nguyên dòng đang nhập)');
kiem(/\.bh-row'\)\.length && !confirm\(/.test(bhSach), 'đóng tab đang có dòng hàng thì phải hỏi trước');
kiem(/if \(!tabs\.length\) \{ closeModal\(\); return; \}/.test(bhSach), 'đóng tab cuối cùng = đóng cả cửa sổ');
/* Nhiều pane ⇒ id trùng nhau. An toàn CHỈ KHI không chỗ nào dùng document.getElementById trong form. */
const dauForm = bhSach.indexOf('async function openPhieuBanHangForm');
kiem(dauForm > 0 && !/document\.(getElementById|querySelector)/.test(bhSach.slice(dauForm)),
  '🔴 trong form bán hàng KHÔNG có document.getElementById/querySelector (id trùng giữa các pane sẽ bắt nhầm)');
kiem(/\.bh-tab-them/.test(sCss) && /\.bh-tab\.dang-xem/.test(sCss), 'CSS thanh tab có nút ＋ và trạng thái tab đang xem');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 10. v9.92 — gỡ chú thích, SĐT/Địa chỉ chỉ-đọc, ghi chú ghim đáy cột trái ===');
const sDM = doc('../frontend/js/module.danhmuc.js');
const dmSach = boComment(sDM);
/* Ba dòng chú thích Nguyen khoanh đỏ phải biến mất khỏi FORM (vẫn được phép còn trong comment). */
kiem(!/Công nợ nhóm theo <b>TÊN KHÁCH<\/b>/.test(bhSach), 'gỡ dòng "Công nợ nhóm theo TÊN KHÁCH"');
kiem(!/Đánh dấu để theo dõi ở tab <b>Hàng mẫu ở khách<\/b>/.test(bhSach), 'gỡ dòng chú thích dài dưới ô "Gửi mẫu"');
kiem(/id="bhNhacMauBox"/.test(sBH), 'GIỮ khối nhắc "khách đang giữ mẫu" (cảnh báo theo dữ liệu thật, không phải chú thích)');

kiem(/id="bhSDT" readonly/.test(sBH) && /id="bhDiaChi" readonly/.test(sBH), 'SĐT và Địa chỉ là ô CHỈ ĐỌC');
/* Phải vẫn là <input name=...> — đổi sang span là payload mất sdt/diaChi, phiếu in trống địa chỉ. */
kiem(/<input name="sdt" id="bhSDT"/.test(sBH) && /<input name="diaChi" id="bhDiaChi"/.test(sBH),
  'vẫn là input có name (giữ nguyên payload sdt/diaChi)');
kiem(/id="bhKhachTT" style="display:none;"/.test(sBH), 'khối SĐT·Địa chỉ mặc định ẩn');
kiem(/function hienKhachTT/.test(bhSach) && /hienKhachTT\(\);/.test(bhSach), 'có hàm hiện/ẩn và được gọi');
kiem(/apKhach\(k\) \{[\s\S]*?hienKhachTT\(\);/.test(bhSach), 'đổi khách là gọi lại hienKhachTT()');

kiem(/class="form-row p2-ghichu"/.test(sBH), 'ô Ghi chú có lớp .p2-ghichu');
kiem(/\.p2-trai > \.p2-ghichu \{[\s\S]*?position: sticky/.test(sCss), 'CSS ghim ô Ghi chú ở đáy cột trái');
/* 🔴 Chỉ được MỘT ô name="ghiChu" — FormData lấy ô ĐẦU TIÊN, hai ô là mất chữ người dùng gõ (lỗi v6.75). */
const soGhiChu = ((bhSach.match(/openPhieuBanHangForm[\s\S]*/) || [''])[0].match(/name="ghiChu"/g) || []).length;
kiem(soGhiChu === 1, '🔴 chỉ còn ĐÚNG MỘT ô name="ghiChu" trong form bán hàng', 'đang ' + soGhiChu);

console.log('\n=== 11. v9.92 — "+ Khách mới" dùng form của DANH MỤC ===');
kiem(/moFormKhachHang/.test(dmSach), 'module.danhmuc.js có moFormKhachHang');
kiem(/return \{ render, getTabs, moFormKhachHang \}/.test(dmSach), 'và ĐÃ export ra ngoài');
kiem(/async function openForm\(tab, row, perm, opts\)/.test(dmSach), 'openForm nhận opts');
/* sauKhiLuu BẮT BUỘC thay render(container,currentUser): gọi từ phân hệ khác thì container là null. */
kiem(/if \(opts\.sauKhiLuu\) await opts\.sauKhiLuu\(body\);/.test(dmSach), 'có sauKhiLuu thì KHÔNG gọi render của Danh mục');
kiem(/opts\.giaTriSan/.test(dmSach), 'có giaTriSan (điền sẵn mà vẫn là chế độ THÊM, không thành apiPut)');
kiem(/dm && typeof dm\.moFormKhachHang === 'function'/.test(bhSach), 'phiếu bán hàng gọi qua window.ModuleDanhMuc, có kiểm tồn tại');
kiem(/themKhachNhanh\(modal\.querySelector\('#bhKhach'\)\.value\)/.test(bhSach),
  'vẫn còn ĐƯỜNG LÙI themKhachNhanh (PWA còn cache module.danhmuc cũ thì nút không được câm)');
kiem(/function themKhachNhanh/.test(bhSach), 'themKhachNhanh chưa bị xóa (Lên đơn đặt hàng còn dùng)');

console.log('\n=== 11b. v9.96 — nhắc hàng mẫu thành POPUP khi chọn khách ===');
kiem(/function moPopupNhacMau/.test(bhSach), 'có hàm mở popup nhắc hàng mẫu');
kiem(/taiNhacMau\(true\)/.test(bhSach), 'ĐỔI KHÁCH ⇒ bật popup');
/* Popup phải bật khi CHỌN KHÁCH, KHÔNG bật mỗi lần vẽ lại dòng hàng — nhảy liên tục lúc đang nhập. */
kiem(/if \(hopDong\) hopDong\.addEventListener\('change', veNhacMau\)/.test(bhSach),
  'đổi mã hàng chỉ vẽ lại DÒNG TÓM TẮT, không bật popup');
kiem(/bhXemNhacMau/.test(sBH), 'còn dòng tóm tắt bấm được (đóng popup rồi vẫn xem lại được)');
kiem(/id="bhNhacMauBox"/.test(sBH), 'GIỮ #bhNhacMauBox (bộ kiểm hàng mẫu khác bám vào)');

console.log('\n=== 12. Bump ?v= ===');
const v = (t) => parseFloat((sIndex.match(new RegExp(t.replace('.', '\\.') + '\\?v=([\\d.]+)')) || [])[1] || '0');
kiem(v('module.khohang.js') >= 10.05, 'index.html: module.khohang.js ≥ 10.05 (cột Màu min-width)', String(v('module.khohang.js')));
kiem(v('module.danhmuc.js') >= 9.92, 'index.html: module.danhmuc.js ≥ 9.92 (quên bump = nút "+ Khách mới" rơi về đường lùi)', String(v('module.danhmuc.js')));
kiem(v('module.nhapkho.js') >= 9.89, 'index.html: module.nhapkho.js ≥ 9.89', String(v('module.nhapkho.js')));
/* CSS mới mà quên bump là người dùng vẫn ăn file cũ ⇒ 2 cột xếp chồng, nhìn như hỏng hẳn. */
kiem(v('style.css') >= 10.05, 'index.html: style.css ≥ 10.05 (quên bump = trình duyệt giữ CSS cũ ⇒ phiếu vẫn 1240px, nhìn như không sửa gì)', String(v('style.css')));

console.log(`\n================ KẾT QUẢ: ${dat} đạt / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
