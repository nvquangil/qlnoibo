/* ================================================================================================
   v9.61 — KHÁCH / NHÂN VIÊN KÝ SỐ NGAY TRÊN WEB BẰNG USB TOKEN: nói chuyện với công cụ "MOYN Ký số"
   (tools/MoynKySo, chạy trên máy người ký, lắng nghe http://localhost:8765). Dùng chung cho trang ký
   khách (ky.html) và màn quản trị (module.hopdong.js) — file này được mở ở cổng công khai (server.js).
   Giao thức:  GET /ping → {ok, version} · GET /certs → [{thumbprint, subject, issuer, serial, notAfter, certDer(base64)}]
               POST /sign {thumbprint, dataBase64} → {signatureBase64}
   Luồng ký: máy chủ (bat-dau) nhận chứng thư, trả dataKy (SET signedAttrs) → công cụ ký bằng khóa trong token
   (Windows hỏi PIN) → máy chủ (hoan-tat) ghép CMS + dấu thời gian vào PDF. Khóa riêng KHÔNG rời máy người ký.
   ================================================================================================ */
window.MoynKySo = (function () {
  const CONG = [8765, 8766];
  let goc = null;
  async function goi(duong, opts) {
    const ds = goc ? [goc] : CONG.map(p => 'http://localhost:' + p);
    let loiCuoi = null;
    for (const g of ds) {
      let r;
      try {
        const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), opts && opts.timeout ? opts.timeout : 4000);
        r = await fetch(g + duong, { method: (opts && opts.method) || 'GET', headers: { 'Content-Type': 'application/json' }, body: opts && opts.body ? JSON.stringify(opts.body) : undefined, signal: ctrl.signal, mode: 'cors' });
        clearTimeout(t);
      } catch (e) { loiCuoi = e; continue; }   // không nối được cổng này -> thử cổng kia
      // v9.62: công cụ ĐÃ trả lời (dù lỗi) thì dừng ngay — không thử cổng kia để khỏi mất câu lỗi thật (vd "Origin không được phép").
      let j = {}; try { j = await r.json(); } catch (e) { /* bỏ */ }
      if (!r.ok || j.ok === false) { const e = new Error(j.error || j.message || ('HTTP ' + r.status)); e.daTraLoi = true; throw e; }
      goc = g;
      return j;
    }
    throw loiCuoi || new Error('Không gọi được công cụ');
  }
  async function coCongCu() {
    try { const j = await goi('/ping'); return !!(j && j.ok); }
    catch (e) {
      if (e && e.daTraLoi) throw new Error('Công cụ "MOYN Ký số" đang chạy nhưng từ chối trang này: ' + e.message + ' — thêm địa chỉ trang (vd ' + location.origin + ') vào file origins.txt cạnh MoynKySo.exe rồi mở lại công cụ.');
      return false;
    }
  }
  async function danhSachChungThu() { const j = await goi('/certs'); return Array.isArray(j.certs) ? j.certs : (Array.isArray(j) ? j : []); }
  async function ky(thumbprint, dataBase64) { const j = await goi('/sign', { method: 'POST', body: { thumbprint, dataBase64, algorithm: 'SHA256withRSA' }, timeout: 180000 }); return j.signatureBase64; }
  /* Chạy TRỌN luồng: batDau(certDer) → ký → hoanTat(phienKy, chuKy). Trả kết quả của hoanTat. */
  async function kyTronLuong({ chonChungThu, batDau, hoanTat, baoTien }) {
    if (!await coCongCu()) throw new Error('Chưa chạy công cụ "MOYN Ký số" trên máy này (tải ở nút bên cạnh, mở lên rồi bấm lại).');
    const ds = (await danhSachChungThu()).filter(c => c && c.certDer);
    if (!ds.length) throw new Error('Không thấy chứng thư số nào có khóa riêng trên máy — cắm USB token, cài phần mềm của nhà cung cấp rồi thử lại.');
    const chon = ds.length === 1 ? ds[0] : await chonChungThu(ds);
    if (!chon) throw new Error('Chưa chọn chứng thư.');
    baoTien && baoTien('Đang chuẩn bị dữ liệu ký…');
    const bd = await batDau(chon.certDer);
    baoTien && baoTien('Nhập PIN USB token trong cửa sổ vừa hiện…');
    const chuKy = await ky(chon.thumbprint, bd.dataKy);
    baoTien && baoTien('Đang ghép chữ ký vào hợp đồng…');
    return hoanTat(bd.phienKy, chuKy, chon);
  }
  return { goi, coCongCu, danhSachChungThu, ky, kyTronLuong };
})();
