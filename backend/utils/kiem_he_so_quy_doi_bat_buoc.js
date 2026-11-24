/* ================================================================================================
   kiem_he_so_quy_doi_bat_buoc.js — v9.88: "Hệ số quy đổi (số cái trong 1 ri)" BẮT BUỘC và KHÁC 1
   ------------------------------------------------------------------------------------------------
   Chạy:  node backend\utils\kiem_he_so_quy_doi_bat_buoc.js        (không cần CSDL)

   Nguyen 21/11/2026: *"Hệ số quy đổi (số cái trong 1 ri) thêm điều kiện bắt buộc phải nhập khác 1"*
   — ở màn **Chỉ định sản xuất**.

   Luật này được chép ở HAI nơi (frontend chặn sớm cho người dùng, backend chặn thật). Bộ kiểm lấy
   HÀM THẬT ra khỏi cả hai file bằng regex rồi CHẠY nó trên cùng một bảng ca — viết lại hàm trong bộ
   kiểm là tự tay bỏ đi đúng cái mình định kiểm.

   Hai nơi mà lệch luật = người dùng qua được form nhưng bị máy chủ chặn (hoặc ngược lại, tệ hơn:
   form chặn mà API mở toang). Vì vậy ca nào cũng so KẾT QUẢ CỦA CẢ HAI.
   ================================================================================================ */
const fs = require('fs');
const path = require('path');
const doc = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let dat = 0, truot = 0;
const kiem = (ok, ten, them) => { if (ok) { dat++; console.log('   ✓ ' + ten); } else { truot++; console.log('   ✗ ' + ten + (them ? '  → ' + them : '')); } };

const sFe = doc('../frontend/js/module.qlsx.js');
const sBe = doc('routes/qlsx.js');
const sIndex = doc('../frontend/index.html');
/* Mọi phép "KHÔNG được chứa X" phải chạy trên bản ĐÃ LỌC COMMENT — chính ghi chú v9.88 của tôi có
   nhắc chuỗi "|| 1" trong lời văn, không lọc thì bộ kiểm đỏ oan (bài học đã vấp 3 lần). */
const boComment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ------------------------------------------------------------------------------------------------
console.log('=== 1. Lấy hàm THẬT loiHeSoQuyDoi() ra khỏi cả hai file ===');
const catHam = (s) => {
  const m = s.match(/function loiHeSoQuyDoi\(v\) \{[\s\S]*?\n(?:  )?\}/);
  return m ? m[0] : null;
};
const mFe = catHam(sFe), mBe = catHam(sBe);
kiem(!!mFe, 'cắt được loiHeSoQuyDoi() từ frontend/js/module.qlsx.js');
kiem(!!mBe, 'cắt được loiHeSoQuyDoi() từ backend/routes/qlsx.js');

const lam = (src) => new Function('return (' + src + ')')();
const fFe = mFe ? lam(mFe) : null;
const fBe = mBe ? lam(mBe) : null;

// ------------------------------------------------------------------------------------------------
console.log('\n=== 2. Hành vi: trống / <= 0 / = 1 bị CHẶN; > 1 được qua ===');
/* [giá trị gửi lên, có phải chặn không, mô tả] */
const ca = [
  ['',          true,  'để trống'],
  [null,        true,  'null (client cũ không gửi trường)'],
  [undefined,   true,  'undefined'],
  ['   ',       true,  'toàn khoảng trắng'],
  [0,           true,  '0'],
  ['0',         true,  'chuỗi "0"'],
  [-5,          true,  'số âm'],
  ['abc',       true,  'không phải số'],
  [1,           true,  '= 1 (chính là luật Nguyen yêu cầu)'],
  ['1',         true,  'chuỗi "1"'],
  ['1.0',       true,  'chuỗi "1.0" — vẫn là 1'],
  [' 1 ',       true,  '"1" có khoảng trắng hai bên'],
  [2,           false, '= 2'],
  [5,           false, '= 5 (dải 3-7 có 5 size)'],
  ['11',        false, 'chuỗi "11"'],
  [1.5,         false, '1,5 (lẻ nhưng khác 1 — không chặn)'],
  [0.5,         true,  '0,5 — khác 1 nhưng < 1 thì vô nghĩa, vẫn chặn']
];
if (fFe && fBe) {
  ca.forEach(([v, phaiChan, ten]) => {
    const rFe = fFe(v), rBe = fBe(v);
    const chanFe = rFe !== '', chanBe = rBe !== '';
    kiem(chanFe === phaiChan && chanBe === phaiChan,
      `${ten} → ${phaiChan ? 'CHẶN' : 'cho qua'}`,
      `frontend ${chanFe ? 'chặn' : 'qua'} / backend ${chanBe ? 'chặn' : 'qua'}`);
    kiem(chanFe === chanBe, `  ${ten}: hai nơi CÙNG kết luận`, `fe="${rFe}" | be="${rBe}"`);
  });
  kiem(/khác 1|KHÔNG được để 1/.test(fFe(1)), 'thông báo khi = 1 nói rõ "không được để 1"', fFe(1));
  kiem(/5 size/.test(fFe('')), 'thông báo khi để trống có ví dụ dải 3-7 → 5', fFe(''));
}

// ------------------------------------------------------------------------------------------------
console.log('\n=== 3. Frontend: chặn TRƯỚC khi gọi API, cả 2 form ===');
const feSach = boComment(sFe);
kiem((feSach.match(/loiHeSoQuyDoi\(fd\.get\('heSoQuyDoi'\)\)/g) || []).length === 2,
  'cả form Chỉ định sản xuất VÀ form Sửa lệnh đều gọi loiHeSoQuyDoi(fd.get(...))',
  'đang ' + (feSach.match(/loiHeSoQuyDoi\(fd\.get\('heSoQuyDoi'\)\)/g) || []).length + ' chỗ');
kiem(/#inpHeSoQuyDoiEdit'\);\s*\n\s*if \(oHS\)/.test(feSach) || /modal\.querySelector\('#inpHeSoQuyDoiEdit'\)/.test(feSach),
  'form Sửa: đưa con trỏ về đúng ô khi báo lỗi');
kiem(/getElementById\('inpHeSoQuyDoi'\)/.test(feSach), 'form Chỉ định SX: đưa con trỏ về đúng ô khi báo lỗi');
/* "|| 1" trong payload là thứ ĐÃ giấu lỗi chưa khai suốt từ v5.13 — bỏ rồi thì đừng để quay lại. */
kiem(!/heSoQuyDoi: fd\.get\('heSoQuyDoi'\) \|\| 1/.test(feSach),
  'KHÔNG còn payload "heSoQuyDoi: fd.get(...) || 1" (chính nó biến ô trống thành 1 hợp lệ)');
kiem((feSach.match(/heSoQuyDoi: Number\(fd\.get\('heSoQuyDoi'\)\)/g) || []).length === 2,
  'cả hai payload gửi Number(...) thẳng, không fallback');

console.log('\n=== 4. Frontend: ô nhập nói ra điều kiện ===');
kiem(/id="inpHeSoQuyDoi"[^>]*placeholder="Bắt buộc/.test(sFe), 'form Chỉ định SX: placeholder "Bắt buộc"');
kiem(/id="inpHeSoQuyDoi"[^>]*value=""/.test(sFe), 'form Chỉ định SX: BỎ value="1" mặc định (mặc định cũ chính là thứ làm ai cũng bỏ qua)');
kiem(/id="inpHeSoQuyDoiEdit"[^>]*value="\$\{Number\(detail\.HeSoQuyDoi\) > 1/.test(sFe),
  'form Sửa: lệnh cũ hệ số ≤ 1 thì để TRỐNG ô, không hiện "1" (hiện 1 = tưởng đã khai)');
kiem((sFe.match(/Bắt buộc nhập và phải khác 1/g) || []).length === 2, 'cả hai ô đều có dòng nhắc "phải khác 1"');
kiem(/Lệnh này chưa khai số cái trong 1 ri/.test(sFe), 'form Sửa: có dòng đỏ giải thích vì sao ô trống');
/* Ghi chú cũ dạy ngược hẳn luật mới — còn sót là người dùng làm theo rồi bị chặn. */
kiem(!/Để 1 = ô Ri bị khoá, chỉ gõ được số Cái/.test(sFe),
  'KHÔNG còn câu hướng dẫn cũ "Để 1 = ô Ri bị khoá" (nay 1 là giá trị bị từ chối)');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 5. Backend: chặn THẬT ở cả POST và PUT ===');
const beSach = boComment(sBe);
kiem((beSach.match(/const loiHS = loiHeSoQuyDoi\(heSoQuyDoi\);/g) || []).length === 2,
  'POST /orders và PUT /orders/:maDH đều gọi loiHeSoQuyDoi',
  'đang ' + (beSach.match(/const loiHS = loiHeSoQuyDoi\(heSoQuyDoi\);/g) || []).length + ' chỗ');
kiem((beSach.match(/if \(loiHS\) return res\.status\(400\)/g) || []).length === 2,
  'cả hai trả 400 (lỗi NGHIỆP VỤ — không phải 401, xem bài học cũ)');
kiem(!/\.input\('HeSoQuyDoi', sql\.Decimal\(10, 3\), Number\(heSoQuyDoi\) \|\| 1\)/.test(beSach),
  'KHÔNG còn ghi xuống CSDL bằng "Number(heSoQuyDoi) || 1"');
kiem((beSach.match(/\.input\('HeSoQuyDoi', sql\.Decimal\(10, 3\), Number\(heSoQuyDoi\)\)/g) || []).length === 2,
  'cả INSERT và UPDATE ghi Number(heSoQuyDoi) thẳng');
/* Chặn phải nằm TRƯỚC mọi lệnh ghi — chặn sau khi đã INSERT là không chặn gì cả. */
const viTriChan = beSach.indexOf('const loiHS = loiHeSoQuyDoi(heSoQuyDoi);');
const viTriInsert = beSach.indexOf('INSERT INTO DonHangSanXuat');
kiem(viTriChan > 0 && viTriInsert > viTriChan, 'ở POST: chặn nằm TRƯỚC câu INSERT');
kiem(/INSERT INTO DonHangSanXuat/.test(beSach) && (beSach.match(/INSERT INTO DonHangSanXuat/g) || []).length === 1,
  'vẫn chỉ có MỘT đường ghi lệnh SX (không có cửa sau né được luật)');

// ------------------------------------------------------------------------------------------------
console.log('\n=== 6. Bump ?v= ===');
const v = (sIndex.match(/module\.qlsx\.js\?v=([\d.]+)/) || [])[1] || '';
kiem(parseFloat(v) >= 9.88, 'index.html: module.qlsx.js bump ≥ 9.88', 'đang ' + v);

console.log(`\n================ KẾT QUẢ: ${dat} đạt / ${truot} sai ================`);
process.exit(truot ? 1 : 0);
