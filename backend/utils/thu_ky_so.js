/* ==================================================================================================
   v9.61 — THỬ KÝ SỐ / KIỂM CHỮ KÝ ngoài phần mềm (chạy TRÊN MÁY CHỦ, đọc backend\.env).
     node backend\utils\thu_ky_so.js <file.pdf> [ra.pdf]     ký bằng bộ ký tự động (HOPDONG_KY_TU_DONG=pfx|pkcs11) + TSA
     node backend\utils\thu_ky_so.js --kiem <file_da_ky.pdf> kiểm mọi chữ ký trong file (hợp lệ? chứng thư? dấu thời gian?)
     node backend\utils\thu_ky_so.js --chungthu              chỉ đọc chứng thư của bộ ký (không ký, không PIN với PKCS#11)
   Làm bước này TRƯỚC khi bật cho hợp đồng thật: mở ra.pdf bằng Adobe Reader → bảng Signatures.
   ================================================================================================== */
'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const kySo = require('./kySoPdf');
const kiem = require('./kiemChuKySo');

(async () => {
  const a = process.argv.slice(2);
  if (!a.length) { console.log('Cách dùng: xem đầu file.'); process.exit(1); }
  if (a[0] === '--chungthu') {
    const cfg = kySo.cauHinh();
    console.log('Bộ ký:', cfg.loai, '| TSA:', cfg.tsaUrl || '(tắt)');
    if (cfg.loai === 'tat') { console.log('HOPDONG_KY_TU_DONG trống → ký tự động TẮT.'); process.exit(0); }
    const b = kySo.boKyTuDong();
    console.log(JSON.stringify(b.thongTin, null, 2));
    try { b.dong && b.dong(); } catch (e) { /* bỏ */ }
    process.exit(0);
  }
  if (a[0] === '--kiem') {
    const buf = fs.readFileSync(a[1]);
    const kq = await kiem.kiemPdf(buf);
    console.log(JSON.stringify(kq, (k, v) => (v instanceof Date ? v.toISOString() : v), 2));
    process.exit(kq.ok ? 0 : 1);
  }
  const vao = a[0], ra = a[1] || vao.replace(/\.pdf$/i, '') + '_da_ky.pdf';
  const buf = fs.readFileSync(vao);
  console.log('Đang ký', vao, '…');
  const t0 = Date.now();
  const kq = await kySo.kyTuDong(buf, { lyDo: 'Ký thử', viTri: 'Việt Nam' });
  if (!kq) { console.log('HOPDONG_KY_TU_DONG trống → ký tự động TẮT. Khai pfx hoặc pkcs11 trong backend\\.env'); process.exit(1); }
  fs.writeFileSync(ra, kq.pdf);
  console.log('Xong sau', Date.now() - t0, 'ms →', ra);
  console.log('Chứng thư:', kq.thongTin && kq.thongTin.CN, '| MST:', kq.thongTin && kq.thongTin.MST, '| hết hạn:', kq.thongTin && kq.thongTin.denNgay);
  console.log('Dấu thời gian:', kq.tsa && kq.tsa.ok ? ('CÓ (' + kq.tsa.tsaUrl + ', ' + kq.tsa.luc + ')') : ('KHÔNG — ' + (kq.tsa && kq.tsa.loi)));
  const kl = await kiem.kiemPdf(kq.pdf);
  console.log('Tự kiểm lại:', kl.ok ? 'HỢP LỆ' : ('KHÔNG HỢP LỆ: ' + kl.loi));
  process.exit(kl.ok ? 0 : 1);
})().catch(e => { console.error('LỖI:', e && e.stack || e); process.exit(1); });
