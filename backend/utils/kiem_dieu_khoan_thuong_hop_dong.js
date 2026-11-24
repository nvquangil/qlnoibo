/* ================================================================================================
   kiem_dieu_khoan_thuong_hop_dong.js — bo tu kiem cho v9.48 (dieu khoan thuong e)/3.4 cua hop dong
   in THEO Kieu thuong da chon; Nguyen 12/11/2026)

   CHAY THAT kieuThuongCua / dieuKhoanThuong / nhanKieuThuong cat tu module.hrm.js theo MOC (khong
   dem ngoac), voi chTien/ch/money/escapeHtml/fmtNumber la BAN THAT cat tu cung file + common.js.

   Chay:  node backend\utils\kiem_dieu_khoan_thuong_hop_dong.js
   KHONG copy sang D:\QLSX. KHONG dung toi CSDL.
   ================================================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GOC = path.join(__dirname, '..', '..');
const doc = (...p) => fs.existsSync(path.join(GOC, ...p)) ? fs.readFileSync(path.join(GOC, ...p), 'utf8') : '';
let sai = 0, dat = 0;
function kiem(ten, dung, td) {
  if (dung) { dat++; console.log('  ✓ ' + ten); }
  else { sai++; console.log('  ❌ ' + ten + (td ? ' — ' + td : '')); }
}
const fe = doc('frontend', 'js', 'module.hrm.js');
const be = doc('backend', 'routes', 'hrm.js');
const common = doc('frontend', 'js', 'common.js');
const html = doc('frontend', 'index.html');
const kiemCu = doc('backend', 'utils', 'kiem_ho_so_nhan_su.js');

console.log('\n=== 1. BIEN DICH (vm.Script) ===');
[['frontend/js/module.hrm.js', fe], ['backend/routes/hrm.js', be]].forEach(([f, s]) => {
  if (!s) { sai++; console.log('  ❌ ' + f + ' KHONG DOC DUOC'); return; }
  try { new vm.Script(s, { filename: f }); dat++; console.log('  ✓ ' + f); }
  catch (e) { sai++; console.log('  ❌ ' + f + ' VO CU PHAP: ' + e.message); }
});

/* ---- Cat theo MOC ---- */
function catTheoMoc(s, tu, den) {
  const i = s.indexOf(tu); if (i < 0) return '';
  const j = s.indexOf(den, i); if (j < 0) return '';
  return s.slice(i, j);
}
const dong = (s, bat) => { const m = new RegExp('^' + bat + '.*$', 'm').exec(s); return m ? m[0] : ''; };
/* v9.73: khối bắt đầu từ THU_TU_KIEU / tachKieu (đứng TRƯỚC kieuThuongCua) — cắt từ đó mới đủ hàm. */
const kHam = catTheoMoc(fe, "  const THU_TU_KIEU = ['KPI', 'SanPham', 'ChuyenCan'];", '\n  function bienChoHopDong(');
const kCh = [dong(fe, '  const ch = '), dong(fe, '  const chTien = '), dong(fe, '  const money = ')].join('\n');
const kCommon = catTheoMoc(common, 'function escapeHtml(str) {', '\n\n') + '\n' + catTheoMoc(common, 'function fmtNumber(n) {', '\n\n');
kiem('cat duoc 3 ham v9.48 (kieuThuongCua / dieuKhoanThuong / nhanKieuThuong)',
  /function kieuThuongCua/.test(kHam) && /function dieuKhoanThuong/.test(kHam) && /function nhanKieuThuong/.test(kHam), String(kHam.length));
kiem('cat duoc ch / chTien / money that', /const ch = /.test(kCh) && /const chTien = /.test(kCh) && /const money = /.test(kCh));
kiem('cat duoc escapeHtml / fmtNumber that tu common.js', /function escapeHtml/.test(kCommon) && /function fmtNumber/.test(kCommon));

const ctx = {};
vm.createContext(ctx);
vm.runInContext(kCommon + '\n' + kCh + '\n' + kHam, ctx, { filename: 'dieu_khoan_thuong_gia.js' });
const F = { kieu: ctx.kieuThuongCua, dk: ctx.dieuKhoanThuong, nhan: ctx.nhanKieuThuong };
kiem('3 ham chay duoc trong vm', typeof F.kieu === 'function' && typeof F.dk === 'function' && typeof F.nhan === 'function');

console.log('\n=== 2. kieuThuongCua: THEO DUNG KieuThuong, khong doan ===');
kiem("'KPI' -> KPI", F.kieu({ KieuThuong: 'KPI' }) === 'KPI');
kiem("'SanPham' -> SanPham", F.kieu({ KieuThuong: 'SanPham' }) === 'SanPham');
kiem('null -> Khong', F.kieu({ KieuThuong: null }) === 'Khong' && F.kieu({}) === 'Khong' && F.kieu(null) === 'Khong');
kiem('🔴 co QuyKPI > 0 ma KieuThuong trong -> VAN Khong (cung luat voi bo tinh luong, khong in mot dang tinh mot neo)',
  F.kieu({ KieuThuong: null, QuyKPI: 2000000 }) === 'Khong');
kiem("gia tri la ('kpi', 'XYZ') -> Khong", F.kieu({ KieuThuong: 'kpi' }) === 'Khong' && F.kieu({ KieuThuong: 'XYZ' }) === 'Khong');
/* v9.73: nhiều kiểu — chuỗi tập hợp, thứ tự cố định KPI/SanPham/ChuyenCan, bỏ rác và trùng. */
kiem("v9.73 'KPI,SanPham' -> 'KPI,SanPham'; 'SanPham; KPI' cung ket qua; 'ChuyenCan,XYZ,KPI' -> 'KPI,ChuyenCan'",
  F.kieu({ KieuThuong: 'KPI,SanPham' }) === 'KPI,SanPham' && F.kieu({ KieuThuong: 'SanPham; KPI' }) === 'KPI,SanPham' && F.kieu({ KieuThuong: 'ChuyenCan,XYZ,KPI' }) === 'KPI,ChuyenCan');
{
  const cHai = F.dk({ KieuThuong: 'KPI,SanPham', QuyKPI: 8000000, sanPham: [{ TenSanPham: 'Video', DonGia: 50000 }] });
  kiem('v9.73 dieuKhoanThuong 2 kieu = cau KPI NGUYEN VAN + " " + cau SanPham (ca hai cau co trong ban in)',
    cHai.indexOf('Thưởng/thu nhập hiệu suất KPI: Quỹ KPI tham chiếu tối đa là 8.000.000 đồng/tháng') === 0 && /\. Thưởng theo sản phẩm: /.test(cHai) && /Video: <b>50\.000<\/b> đồng\/sản phẩm/.test(cHai) && /\.$/.test(cHai), cHai);
  kiem('v9.73 nhanKieuThuong 2 kieu noi " + "', /^Theo KPI — quỹ 8\.000\.000 đ\/tháng \(100 điểm\) \+ Theo sản phẩm — Video 50\.000 đ$/.test(F.nhan({ KieuThuong: 'KPI,SanPham', QuyKPI: 8000000, sanPham: [{ TenSanPham: 'Video', DonGia: 50000 }] })));
}

console.log('\n=== 3. dieuKhoanThuong: ba cau theo ba kieu ===');
const CAU_KPI_CU = 'Thưởng/thu nhập hiệu suất KPI: Quỹ KPI tham chiếu tối đa là 8.000.000 đồng/tháng tương ứng 100 điểm. Mức hưởng thực tế được xác định căn cứ kết quả đánh giá KPI và Quy chế lương, thưởng/KPI của Công ty trong từng thời kỳ.';
const cKPI = F.dk({ KieuThuong: 'KPI', QuyKPI: 8000000 });
kiem('KPI: dung NGUYEN VAN cau cu (chi thay {{QuyKPI}} bang so) — hop dong da ky truoc day in lai van y nhu cu', cKPI === CAU_KPI_CU, cKPI);
kiem('KPI chua khai quy -> dau cham dien tay, khong in "0 đồng"', /là \.{10,} đồng\/tháng/.test(F.dk({ KieuThuong: 'KPI' })) && !/0 đồng/.test(F.dk({ KieuThuong: 'KPI' })));

const cSP = F.dk({ KieuThuong: 'SanPham', sanPham: [{ TenSanPham: 'Ảnh sản phẩm', DonGia: 20000 }, { TenSanPham: 'Video', DonGia: 50000 }] });
kiem('SanPham: liet ke TUNG san pham + don gia (Hương Media: ảnh 20.000, video 50.000)',
  /Thưởng theo sản phẩm/.test(cSP) && /Ảnh sản phẩm: <b>20\.000<\/b> đồng\/sản phẩm/.test(cSP) && /Video: <b>50\.000<\/b> đồng\/sản phẩm/.test(cSP), cSP);
kiem('SanPham: KHONG dinh chu "KPI" / "100 điểm"', !/KPI/.test(cSP) && !/100 điểm/.test(cSP));
kiem('SanPham: noi cach tinh (so luong nghiem thu nhan don gia)', /số lượng sản phẩm nghiệm thu nhân với đơn giá/.test(cSP));
const cSPtrong = F.dk({ KieuThuong: 'SanPham', sanPham: [] });
kiem('SanPham chua khai san pham -> dau cham dien tay (khong in "undefined" / rong)', /đơn giá: \.{10,}\./.test(cSPtrong) && !/undefined/.test(cSPtrong));
kiem('SanPham: sanPham thieu han (route cu khong gan) -> van ra cau, dau cham', /Thưởng theo sản phẩm/.test(F.dk({ KieuThuong: 'SanPham' })));
kiem('SanPham: ten san pham duoc escapeHtml (ten co < > khong thanh the HTML)',
  /&lt;b&gt;x&lt;\/b&gt;/.test(F.dk({ KieuThuong: 'SanPham', sanPham: [{ TenSanPham: '<b>x</b>', DonGia: 1000 }] })));
kiem('SanPham: dong trong ten rong bi bo qua', !/: <b>/.test(F.dk({ KieuThuong: 'SanPham', sanPham: [{ TenSanPham: '  ', DonGia: 1000 }] })));

const cKhong = F.dk({ KieuThuong: null, QuyKPI: 5000000 });
kiem('Khong: noi ro KHONG ap dung thuong KPI / san pham co dinh', /Không áp dụng thưởng KPI hay thưởng theo sản phẩm cố định/.test(cKhong));
kiem('Khong: KHONG in so quy KPI du hop dong co khai (khong in mot dang tinh mot neo)', !/5\.000\.000/.test(cKhong));
kiem('ca ba cau deu la mot cau hoan chinh, ket thuc bang dau cham (dieu khoan phap ly)', [cKPI, cSP, cKhong].every(c => /\.$/.test(c)));

console.log('\n=== 4. nhanKieuThuong (man Xem hop dong) ===');
kiem('KPI -> "Theo KPI — quỹ 8.000.000"', /^Theo KPI — quỹ 8\.000\.000 đ\/tháng/.test(F.nhan({ KieuThuong: 'KPI', QuyKPI: 8000000 })));
kiem('SanPham co danh muc -> liet ke', /^Theo sản phẩm — Ảnh 20\.000 đ; Video 50\.000 đ$/.test(F.nhan({ KieuThuong: 'SanPham', sanPham: [{ TenSanPham: 'Ảnh', DonGia: 20000 }, { TenSanPham: 'Video', DonGia: 50000 }] })));
kiem('SanPham chua khai -> noi CHUA khai', /CHƯA khai sản phẩm/.test(F.nhan({ KieuThuong: 'SanPham' })));
kiem('Khong + co quy KPI -> canh bao ⚠️ ngay tren man xem', /^Không ⚠️ có khai quỹ KPI 2\.000\.000/.test(F.nhan({ KieuThuong: null, QuyKPI: 2000000 })));
kiem('Khong + khong quy -> chi "Không"', F.nhan({}) === 'Không');

console.log('\n=== 5. MAU_GOC + bien + in ===');
const khoiMauGoc = fe.slice(fe.indexOf('const MAU_GOC = {'), fe.indexOf('const BIEN_THEO_MAU'));
kiem('MAU_GOC co DUNG 2 cho {{DieuKhoanThuong}} (HĐLĐ e) + HĐ thử việc 3.4)', (khoiMauGoc.match(/\{\{DieuKhoanThuong\}\}/g) || []).length === 2);
kiem('🔴 cau KPI CUNG da bi go khoi MAU_GOC (khong con mau nao in KPI bat ke kieu thuong)', !/Quỹ KPI tham chiếu tối đa là \{\{QuyKPI\}\}/.test(khoiMauGoc));
kiem('e) va 3.4 giu dung vi tri/nhan: "e) {{DieuKhoanThuong}}" va "3.4. {{DieuKhoanThuong}}"', /e\) \{\{DieuKhoanThuong\}\}/.test(khoiMauGoc) && /3\.4\. \{\{DieuKhoanThuong\}\}/.test(khoiMauGoc));
kiem('bienChoHopDong sinh khoa DieuKhoanThuong (mau sua tay chen duoc, BIEN_THEO_MAU tu thay)', /DieuKhoanThuong: dieuKhoanThuong\(h\)/.test(fe));
kiem('{{QuyKPI}} VAN con trong bang bien (mau nguoi dung tu sua khong vo)', /QuyKPI: chTien\(h\.QuyKPI\)/.test(fe));
kiem('printHopDong: kieu != KPI thi doi mau phai co cho cam DieuKhoanThuong (mau da sua con cau KPI cung -> bao)',
  /kieu === 'KPI' \? \['NoiDungCongViec'\] : \['NoiDungCongViec', 'DieuKhoanThuong'\]/.test(fe));
kiem('printHopDong: khai quy KPI ma kieu != KPI -> toast truoc khi in', /if \(kieu !== 'KPI' && Number\(h\.QuyKPI\) > 0\) \{\s*toast\(/.test(fe));
kiem('man Xem hop dong co dong Thuong + Kieu luong', /\['Thưởng \(điều khoản e \/ 3\.4\)', nhanKieuThuong\(h\)\]/.test(fe) && /\['Kiểu lương', /.test(fe));
kiem('form: canh bao lech Kieu thuong / Quy KPI, cap nhat khi doi select va khi go quy', /id="ktCanhBao"/.test(fe) && /capNhatCanhBaoKT\(\);/.test(fe)
  && /modal\.querySelector\('#f_kpi'\)\.addEventListener\('input', capNhatCanhBaoKT\)/.test(fe));
kiem('kiem_ho_so_nhan_su.js da biet bien DieuKhoanThuong (keo do oan "bien khong co that")', /'DieuKhoanThuong'/.test(kiemCu));

console.log('\n=== 5b. v9.48b: mau DA SUA trong CSDL con cau KPI cung -> nang cap tai cho khi doc ===');
/* Nguyen 12/11 sau deploy: "van co dinh KPI" — mau HDLD da sua trong tab Mau van ban truoc v9.48,
   layMau() uu tien ban CSDL. Chay THAT nangCapMauCu (cat theo moc) voi cau cu y nhu MAU_GOC truoc v9.48. */
const kNangCap = catTheoMoc(fe, 'const NOI_CACH = ', '\n  // Lấy nội dung mẫu');
kiem('cat duoc CAU_KPI_CU + nangCapMauCu', /function nangCapMauCu\(maMau, noiDung\)/.test(kNangCap), String(kNangCap.length));
const ctx2 = {}; vm.createContext(ctx2);
vm.runInContext(kNangCap, ctx2, { filename: 'nang_cap_mau_gia.js' });
const NC = ctx2.nangCapMauCu;
const CAU_CU_TRONG_MAU = '<p style="margin:0 0 10px 20px;">e) Thưởng/thu nhập hiệu suất KPI: Quỹ KPI tham chiếu tối đa là {{QuyKPI}} đồng/tháng tương ứng 100 điểm. Mức hưởng thực tế được xác định căn cứ kết quả đánh giá KPI và Quy chế lương, thưởng/KPI của Công ty trong từng thời kỳ.</p>';
kiem('cau KPI cu NGUYEN VAN (HDLD_CHINHTHUC) -> e) {{DieuKhoanThuong}}', NC('HDLD_CHINHTHUC', CAU_CU_TRONG_MAU) === '<p style="margin:0 0 10px 20px;">e) {{DieuKhoanThuong}}</p>', NC('HDLD_CHINHTHUC', CAU_CU_TRONG_MAU));
kiem('cau 3.4 cua HD thu viec cung duoc nang cap', NC('HDLD_THUVIEC', '<p>3.4. Thưởng/thu nhập hiệu suất KPI: Quỹ KPI tham chiếu tối đa là {{QuyKPI}} đồng/tháng tương ứng 100 điểm. Mức hưởng thực tế được xác định căn cứ kết quả đánh giá KPI và Quy chế lương, thưởng/KPI của Công ty trong từng thời kỳ.</p>') === '<p>3.4. {{DieuKhoanThuong}}</p>');
kiem('o soan thao sinh &nbsp; va {{ QuyKPI }} co dau cach -> van nhan ra', /\{\{DieuKhoanThuong\}\}/.test(NC('HDLD_CHINHTHUC', 'e) Thưởng/thu nhập hiệu suất KPI:&nbsp;Quỹ KPI tham chiếu tối đa là&nbsp;{{ QuyKPI }} đồng/tháng tương ứng 100 điểm. Mức hưởng thực tế được xác định căn cứ kết quả đánh giá KPI và Quy chế lương, thưởng/KPI của Công ty trong từng thời kỳ.')));
kiem('ban cu hon ket cau "…của Công ty." (khong co "trong từng thời kỳ") -> van nang cap', NC('HDLD_CHINHTHUC', 'e) Thưởng/thu nhập hiệu suất KPI: Quỹ KPI tham chiếu tối đa là {{QuyKPI}} đồng/tháng tương ứng 100 điểm. Mức hưởng thực tế được xác định căn cứ kết quả đánh giá KPI và Quy chế lương, thưởng/KPI của Công ty.') === 'e) {{DieuKhoanThuong}}');
/* Ban in Nguyen gui 12/11: mau da sua tach "KPI: - Quy KPI…" thanh gach dau dong va CHEN TAY bien moi
   phia sau => in ra CA HAI. Phai thanh dung MOT bien. */
const MAU_NGUYEN = 'e) Thưởng/thu nhập hiệu suất KPI: - Quỹ KPI tham chiếu tối đa là {{QuyKPI}} đồng/tháng tương ứng 100 điểm. Mức hưởng thực tế được xác định căn cứ kết quả đánh giá KPI và Quy chế lương, thưởng/KPI của Công ty. - {{DieuKhoanThuong}}';
kiem('🔴 mau cua Nguyen (gach dau dong + chen tay bien) -> dung MOT {{DieuKhoanThuong}}', NC('HDLD_CHINHTHUC', MAU_NGUYEN) === 'e) {{DieuKhoanThuong}}', NC('HDLD_CHINHTHUC', MAU_NGUYEN));
kiem('bien lap qua <br> / &nbsp; cung gop ve mot', NC('HDLD_CHINHTHUC', '<p>e) {{DieuKhoanThuong}}<br>&nbsp;- {{DieuKhoanThuong}}</p>') === '<p>e) {{DieuKhoanThuong}}</p>');
kiem('cau da bi nguoi dung viet KHAC -> giu nguyen (inVanBan se bao thieu cho cam)', NC('HDLD_CHINHTHUC', 'e) Thưởng KPI theo thỏa thuận riêng, quỹ {{QuyKPI}} đồng.') === 'e) Thưởng KPI theo thỏa thuận riêng, quỹ {{QuyKPI}} đồng.');
kiem('mau khac (QD_TANGLUONG) khong bi dung toi', NC('QD_TANGLUONG', CAU_CU_TRONG_MAU) === CAU_CU_TRONG_MAU);
kiem('mau da co {{DieuKhoanThuong}} -> giu nguyen', NC('HDLD_CHINHTHUC', '<p>e) {{DieuKhoanThuong}}</p>') === '<p>e) {{DieuKhoanThuong}}</p>');
kiem('null / rong -> chuoi rong, khong no', NC('HDLD_CHINHTHUC', null) === '' && NC('HDLD_CHINHTHUC', '') === '');
kiem('layMau() goi nangCapMauCu cho ban da sua', /\? nangCapMauCu\(maMau, sua\) : /.test(fe));
/* v9.68 (Nguyen 16/11): bo o "So cong chuan — xang xe / an trua"; mau cu trong CSDL con "{{SoCongXangXe}} công." -> cau moi. */
/* v9.78 (Nguyen 19/11, "chi khai theo 1 cong thuc"): xang CHI theo km ⇒ ca cau b) gom vao MOT bien
   {{HoTroXangXe}}. Moi doi mau cu — v9.68 ("{{SoCongXangXe}} công."), v9.72 ("đồng/ngày, nhân với…") —
   deu phai di het chuoi nang cap ve bien moi, neu khong ban in se noi muc d/ngay da bo. */
kiem('v9.78: mau cu "{{SoCongXangXe}} công." -> xang = "{{HoTroXangXe}}"; an trua van = ", tính theo số công chuẩn của tháng."',
  NC('HDLD_CHINHTHUC', '<p>b) Hỗ trợ xăng xe: {{PhuCapXangXe}} đồng/tháng {{SoCongXangXe}} công.</p><p>c) Ăn trưa: {{PhuCapAnCa}} đồng/tháng&nbsp;{{ SoCongAnTrua }}&nbsp;công.</p>')
  === '<p>b) Hỗ trợ xăng xe: {{HoTroXangXe}}</p><p>c) Ăn trưa: {{PhuCapAnCa}} đồng/tháng, tính theo số công chuẩn của tháng.</p>',
  NC('HDLD_CHINHTHUC', '<p>b) Hỗ trợ xăng xe: {{PhuCapXangXe}} đồng/tháng {{SoCongXangXe}} công.</p>'));
kiem('v9.78: mau v9.68 (đồng/tháng…) VA mau v9.72 (đồng/ngày…) deu thanh {{HoTroXangXe}}; mau da moi giu nguyen',
  NC('HDLD_CHINHTHUC', 'b) Hỗ trợ xăng xe: {{PhuCapXangXe}} đồng/tháng, tính theo số công chuẩn của tháng.') === 'b) Hỗ trợ xăng xe: {{HoTroXangXe}}'
  && NC('HDLD_CHINHTHUC', 'b) Hỗ trợ xăng xe: {{PhuCapXangXe}} đồng/ngày, nhân với số ngày công làm việc thực tế trong tháng.') === 'b) Hỗ trợ xăng xe: {{HoTroXangXe}}'
  && NC('HDLD_CHINHTHUC', 'b) Hỗ trợ xăng xe: {{HoTroXangXe}}') === 'b) Hỗ trợ xăng xe: {{HoTroXangXe}}');
kiem('v9.68: MAU_GOC khong con {{SoCongXangXe}}/{{SoCongAnTrua}}; form khong con o f_congxang/f_congan; payload khong gui soCongXangXe',
  !/\{\{\s*SoCong(?:XangXe|AnTrua)\s*\}\}/.test(khoiMauGoc) && !/id="f_congxang"|id="f_congan"/.test(fe) && !/soCongXangXe: val\(/.test(fe));
/* So TUNG mau (layMau chay tren mot mau): ca khoi MAU_GOC co 2 bien (hai mau) thi phep gop-lap se bo mot. */
const mauCT = catTheoMoc(khoiMauGoc, 'HDLD_CHINHTHUC: {', 'HDLD_THUVIEC: {'), mauTV = catTheoMoc(khoiMauGoc, 'HDLD_THUVIEC: {', 'QD_TANGLUONG: {');
kiem('MAU_GOC moi (tung mau) KHONG bi nang cap dung toi — chi dung cho ban cu', mauCT.length > 100 && NC('HDLD_CHINHTHUC', mauCT) === mauCT && mauTV.length > 100 && NC('HDLD_THUVIEC', mauTV) === mauTV);

console.log('\n=== 6. BACKEND: ho so nhan vien kem sanPham cho tung hop dong ===');
const thanHoSo = catTheoMoc(be, "router.get('/nhanvien/:id'", "\nrouter.post('/nhanvien'");
kiem('GET /nhanvien/:id gan h.sanPham tu docSanPhamHopDong (in tu man Ho so moi co danh muc SP)',
  /docSanPhamHopDong\(pool, hopDongIds\)/.test(thanHoSo) && /h\.sanPham = /.test(thanHoSo));
kiem('index.html bump module.hrm.js >= 9.48', (() => { const m = /module\.hrm\.js\?v=([\d.]+)/.exec(html); return !!m && parseFloat(m[1]) >= 9.48; })());

console.log('\n=== 7. Tab Danh gia KPI: bang san pham thang lay DANH MUC TU HOP DONG ===');
const fePR = doc('frontend', 'js', 'module.payroll.js');
const thanSP = catTheoMoc(fePR, 'function openSanPhamThangModal(r) {', '\n     4. LUONG KHOAN MAY');
kiem('cat duoc openSanPhamThangModal', thanSP.length > 500, String(thanSP.length));
kiem('moi san pham hop dong = mot dong san (dongHD = dm.map)', /const dongHD = dm\.map\(/.test(thanSP));
kiem('dong theo hop dong: ten + don gia KHOA (readonly), chi go so luong', /readonly style="width:100%;min-width:160px;background:#f1f3f4;" title="Theo danh mục hợp đồng"/.test(thanSP) && /readonly style="width:110px;background:#f1f3f4;" title="Đơn giá theo hợp đồng"/.test(thanSP));
kiem('so luong da nhap thang nay duoc dien lai vao dong hop dong (timDaCo)', /SoLuong: c \? c\.SoLuong : null/.test(thanSP));
kiem('dong da nhap NGOAI danh muc van hien, co nhan "ngoài danh mục hợp đồng"', /const dongNgoai = daCo\.filter\(/.test(thanSP) && /ngoài danh mục hợp đồng/.test(thanSP));
kiem('dong hop dong KHONG co nut xoa (danh muc sua o hop dong, khong sua o day)', /\$\{theoHD \? '' : '<button type="button" class="btn small secondary sp-xoa"/.test(thanSP));
kiem('luu van loc SL > 0 (dong de trong khong ghi)', /\.filter\(x => x\.tenSanPham && x\.soLuong > 0\)/.test(thanSP));
kiem('index.html bump module.payroll.js >= 9.48', (() => { const m = /module\.payroll\.js\?v=([\d.]+)/.exec(html); return !!m && parseFloat(m[1]) >= 9.48; })());

console.log(`\n=== KET QUA: ${dat} dat, ${sai} sai ===`);
process.exit(sai ? 1 : 0);
