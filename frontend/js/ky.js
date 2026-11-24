/* ================================================================================================
   v9.61 — TRANG KÝ HỢP ĐỒNG CHO KHÁCH (ky.html). Độc lập, không common.js.
   v9.62 — Cách 0: ký từ xa qua CA (VNPT SmartCA / CSC) khi máy chủ bật; hiện loại văn bản + hợp đồng gốc (phụ lục / thanh lý).
   ?t=<token>  : xem + ký (OTP / chữ ký số) + tải PDF.     ?tra=<mã> : tra cứu trạng thái công khai.
   Mọi lời gọi: /api/public/ky/... (routes/publicKy.js). Lỗi nào cũng hiện câu rõ ràng, không im.
   ================================================================================================ */
(function () {
  const app = document.getElementById('app');
  const qs = new URLSearchParams(location.search);
  const token = qs.get('t'), maTra = qs.get('tra');
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tien = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('vi-VN'));
  const TEN_TT = { Nhap: 'Nháp', ChoKy: 'Chờ ký', DangKySo: 'Đang ký số', ChoMoynKy: 'Chờ bên bán ký số', DaKy: 'Đã ký xong', TuChoi: 'Đã từ chối', HetHan: 'Hết hạn', Huy: 'Đã hủy', LoiKySo: 'Bên bán đang xử lý ký số' };
  const TEN_LOAI = { HopDong: 'Hợp đồng', PhuLuc: 'Phụ lục hợp đồng', ThanhLy: 'Biên bản thanh lý hợp đồng' };   // v9.62
  const MAU_TT = { ChoKy: '#b06000', DangKySo: '#1a73e8', ChoMoynKy: '#1a73e8', LoiKySo: '#1a73e8', DaKy: '#137333', TuChoi: '#c5221f', HetHan: '#9aa0a6', Huy: '#9aa0a6' };
  const nhan = (tt) => `<span class="nhan" style="background:${MAU_TT[tt] || '#5f6368'}">${h(TEN_TT[tt] || tt)}</span>`;
  async function api(duong, opts) {
    const o = Object.assign({ headers: {} }, opts || {});
    if (o.body && !(o.body instanceof FormData)) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.body); }
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), o.timeout || 90000); o.signal = ctrl.signal;
    let r; try { r = await fetch('/api/public/ky' + duong, o); } catch (e) { throw new Error(e.name === 'AbortError' ? 'Máy chủ phản hồi chậm — thử lại.' : 'Không kết nối được máy chủ.'); } finally { clearTimeout(t); }
    let j = {}; try { j = await r.json(); } catch (e) { /* bỏ */ }
    if (!r.ok || j.success === false) { const err = new Error(j.message || 'Lỗi ' + r.status); err.status = r.status; err.data = j; throw err; }
    return j;
  }
  const bao = (id, loai, msg) => { const el = document.getElementById(id); if (!el) return; el.className = 'bao ' + loai; el.innerHTML = msg; el.classList.toggle('an', !msg); };

  // ---------------------------------------------------------------- tra cứu
  async function veTraCuu() {
    app.innerHTML = `<div class="the"><div class="dau"><span class="logo">Tra cứu hợp đồng điện tử</span></div>
      <div class="dong" style="margin-top:10px"><input type="text" id="oMa" placeholder="Mã tra cứu, vd HDAB3K7-9XQ2P" value="${h(maTra || '')}"><button class="nut" id="bTra" style="flex:0 0 auto">Tra cứu</button></div><div id="kqTra"></div></div>`;
    const chay = async () => {
      const ma = document.getElementById('oMa').value.trim().toUpperCase(); const kq = document.getElementById('kqTra');
      kq.innerHTML = '<div class="nho">Đang tra…</div>';
      try {
        const d = (await api('/tra/' + encodeURIComponent(ma))).data;
        kq.innerHTML = `<h2>${h(d.soHopDong)} — ${h(d.tenHopDong)} ${nhan(d.trangThai)}</h2>
          <table><tr><td>Xuất bản</td><td>${h(d.xuatBanLuc || '—')} (phiên bản ${h(d.phienBan)})</td></tr><tr><td>Bên mua ký</td><td>${h(d.khachKyLuc || '—')}</td></tr><tr><td>Ký xong</td><td>${h(d.kyXongLuc || '—')}</td></tr>
          <tr><td>SHA-256 bản gửi ký</td><td style="font-family:monospace;font-size:11px;word-break:break-all">${h(d.hashGoc || '—')}</td></tr><tr><td>SHA-256 bản cuối</td><td style="font-family:monospace;font-size:11px;word-break:break-all">${h(d.hashCuoi || '—')}</td></tr></table>
          <h2>Các bên</h2><table>${(d.benKy || []).map(b => `<tr><td>${h(b.ben)}</td><td>${h(b.hoTen || '')}</td><td>${b.trangThai === 'DaKy' ? '✅ ' + h(b.kyLuc || '') : (b.trangThai === 'TuChoi' ? '❌ từ chối' : '⏳ chờ ký')}${b.chungThu ? '<div class="nho">Chứng thư: ' + h(b.chungThu) + '</div>' : ''}</td></tr>`).join('')}</table>
          <p class="nho">Mã băm trên phải khớp với mã in ở trang "Chứng nhận ký điện tử" cuối bản PDF. Trang này không hiện nội dung hợp đồng.</p>`;
      } catch (e) { kq.innerHTML = `<div class="bao loi">${h(e.message)}</div>`; }
    };
    document.getElementById('bTra').addEventListener('click', chay);
    if (maTra) chay();
  }

  // ---------------------------------------------------------------- xem + ký
  let d = null, pollTimer = null;
  async function nap() {
    try { d = (await api('/' + encodeURIComponent(token))).data; }
    catch (e) {
      app.innerHTML = `<div class="the"><div class="logo">Ký hợp đồng điện tử</div><div class="bao loi" style="margin-top:10px">${h(e.message)}</div>${e.data && e.data.trangThai === 'HetHan' ? '<p class="nho">Liên hệ bên gửi để nhận link mới.</p>' : ''}</div>`;
      return;
    }
    ve();
  }
  function ve() {
    clearInterval(pollTimer);
    const bm = d.benMua || {}, nk = d.nguoiKy || {}, bb = d.benBan || {};
    const pdfUrl = '/api/public/ky/' + encodeURIComponent(token) + '/pdf';
    const bangHang = (d.hang || []).length ? `<h2>Chi tiết đơn hàng</h2><div style="overflow:auto"><table><thead><tr><th>#</th><th>Mã SP</th><th>Tên sản phẩm</th><th>Màu</th><th class="phai">SL</th><th class="phai">Đơn giá</th><th class="phai">Thành tiền</th></tr></thead>
      <tbody>${d.hang.map((x, i) => `<tr><td>${i + 1}</td><td>${h(x.MaSanPham)}</td><td>${h(x.TenSanPham)}</td><td>${h(x.MauSac)}</td><td class="phai">${tien(x.SoLuong)} ${h(x.DonVi || '')}</td><td class="phai">${tien(x.DonGia)}</td><td class="phai">${tien(x.ThanhTien)}</td></tr>`).join('')}
      <tr><td colspan="6" class="phai"><b>TỔNG</b></td><td class="phai"><b>${tien(d.tongTien)}</b></td></tr></tbody></table></div>` : (d.tongTien ? `<p><b>Giá trị hợp đồng:</b> ${tien(d.tongTien)} đ</p>` : '');
    let phanKy = '';
    if (d.choKy && nk.trangThai === 'ChoKy') phanKy = khungKy();
    else if (d.daKy) phanKy = `<div class="bao ok">✅ Hợp đồng đã được các bên ký xong${d.kyXongLuc ? ' lúc ' + h(d.kyXongLuc) : ''}.</div><a class="nut lon" href="${pdfUrl}?tai=1" style="text-align:center;display:block;text-decoration:none">⬇ Tải bản PDF có chữ ký số</a>${d.coPdfKhachKy ? `<p><a class="nut phu nho" href="${pdfUrl}?tai=1&loai=khach">⬇ Bản PDF bạn đã ký số (file riêng, giữ nguyên chữ ký của bạn)</a></p>` : ''}<p class="nho">Mã tra cứu: <b>${h(d.maTraCuu || '')}</b> — kiểm tra bất kỳ lúc nào tại trang tra cứu.</p>`;
    else if (['DangKySo', 'ChoMoynKy', 'LoiKySo'].includes(d.trangThai)) { phanKy = `<div class="bao ok">✅ Bạn đã ký${nk.kyLuc ? ' lúc ' + h(nk.kyLuc) : ''}. Bên bán đang ký số — bản PDF đầy đủ sẽ gửi tới email của bạn và hiện ở đây khi xong.</div><div class="nho">Trang tự cập nhật mỗi 10 giây…</div>`; pollTimer = setInterval(nap, 10000); }
    else if (d.trangThai === 'TuChoi') phanKy = `<div class="bao chu">Bạn đã từ chối ký hợp đồng này. Bên bán sẽ liên hệ lại.</div>`;
    else phanKy = `<div class="bao chu">Hợp đồng đang ở trạng thái: ${h(d.tenTrangThai || d.trangThai)}.</div>`;
    app.innerHTML = `
      <div class="the"><div class="dau"><span class="logo">${h(bb.ten || 'MOYN')}</span>${nhan(d.trangThai)}</div>
        <h1 style="margin-top:8px">${h(d.tenHopDong)}</h1><div class="nho">${h(TEN_LOAI[d.loaiVanBan] || 'Hợp đồng')} số ${h(d.soHopDong)}${d.hanKy && d.choKy ? ' · hạn ký ' + h(d.hanKy) : ''}</div>
        ${d.hopDongCha ? `<div class="nho">Thuộc hợp đồng gốc: <b>${h(d.hopDongCha.so)}</b>${d.hopDongCha.ten ? ' — ' + h(d.hopDongCha.ten) : ''}${d.hopDongCha.ngay ? ' (ký ' + h(d.hopDongCha.ngay) + ')' : ''}</div>` : ''}</div>
      <div class="the"><table><tr><td style="width:40%"><b>Bên bán</b></td><td>${h(bb.ten)}${bb.mst ? ' · MST ' + h(bb.mst) : ''}${bb.diaChi ? '<div class="nho">' + h(bb.diaChi) + '</div>' : ''}${bb.nguoiKy ? '<div class="nho">Đại diện: ' + h(bb.nguoiKy) + (bb.chucVu ? ' — ' + h(bb.chucVu) : '') + '</div>' : ''}</td></tr>
        <tr><td><b>Bên mua</b></td><td>${h(bm.Ten)}${bm.MST ? ' · MST ' + h(bm.MST) : ''}${bm.DiaChi ? '<div class="nho">' + h(bm.DiaChi) + '</div>' : ''}<div class="nho">Người ký: ${h(nk.hoTen || bm.NguoiDaiDien || '')}${nk.chucVu ? ' — ' + h(nk.chucVu) : ''}</div></td></tr></table>
        ${bangHang}
        <h2>Nội dung hợp đồng</h2>
        ${d.coPdfGoc ? `<a class="nut phu nho" href="${pdfUrl}" target="_blank">📄 Mở PDF ở tab mới</a> <a class="nut phu nho" href="${pdfUrl}?tai=1&loai=goc">⬇ Tải PDF về</a><iframe class="pdf" src="${pdfUrl}#toolbar=1" title="Hợp đồng"></iframe>` : '<div class="bao chu">Chưa có bản PDF.</div>'}
      </div>
      <div class="the" id="khungKy">${phanKy}</div>
      <p class="nho" style="text-align:center">Mã tra cứu: ${h(d.maTraCuu || '')} · <a href="/ky.html?tra=${encodeURIComponent(d.maTraCuu || '')}">tra cứu công khai</a></p>`;
    if (d.choKy && nk.trangThai === 'ChoKy') noiKy();
  }

  function khungKy() {
    const nk = d.nguoiKy || {}, k = d.kenh || {};
    const kenhNut = [['sms', '📱 SMS tới ' + h(nk.sdtChe || ''), k.sms], ['zalo', '💬 Zalo tới ' + h(nk.sdtChe || ''), k.zalo], ['email', '📧 Email tới ' + h(nk.emailChe || ''), k.email]]
      .map(([ma, nhan2, co]) => `<button type="button" class="nut phu nho kenh ${d.kenhMacDinh === ma && co ? 'dang' : ''}" data-kenh="${ma}" ${co ? '' : 'disabled title="Kênh này chưa sẵn sàng"'}>${nhan2}</button>`).join('');
    return `
      <h2 style="margin-top:0">Ký hợp đồng</h2>
      <div class="tab"><button type="button" id="tabOtp" class="dang">Ký bằng mã OTP</button><button type="button" id="tabKySo">Ký bằng chữ ký số</button></div>
      <div id="phanOtp">
        <p class="nho">Bước 1 — nhận mã OTP (6 số) qua kênh đã đăng ký với bên bán:</p>
        <div class="dong">${kenhNut}</div>
        <div style="margin:10px 0"><button type="button" class="nut" id="bGuiOtp">Gửi mã OTP</button> <span class="nho" id="demNguoc"></span></div>
        <div id="baoOtp" class="bao an"></div>
        <p class="nho">Bước 2 — nhập mã OTP:</p>
        <input class="otp" id="oOtp" inputmode="numeric" maxlength="6" placeholder="______" autocomplete="one-time-code">
        <p class="nho" style="margin-top:12px">Bước 3 — chữ ký tay (tùy chọn, vẽ bằng ngón tay / chuột):</p>
        <canvas class="ky" id="padKy"></canvas><div><button type="button" class="nut phu nho" id="bXoaKy">Xóa chữ ký</button></div>
        <label style="display:block;margin:14px 0;font-size:15px"><input type="checkbox" id="ckDongY"> Tôi đã đọc toàn bộ nội dung và <b>đồng ý ký kết hợp đồng này bằng phương thức điện tử</b>. Thao tác xác nhận bằng OTP ghi nhận ý chí giao kết hợp đồng điện tử của tôi theo Luật Giao dịch điện tử.</label>
        <button type="button" class="nut lon" id="bKy">✍️ Tôi đồng ý ký kết / Xác nhận đơn hàng</button>
        <div id="baoKy" class="bao an"></div>
      </div>
      <div id="phanKySo" class="an">
        <p class="nho">Dùng chứng thư số của bạn. Chọn một cách:</p>
        ${d.kyTuXa && d.kyTuXa.san ? `<div class="the" style="margin:8px 0"><b>Cách 0 — Ký từ xa qua ${h(d.kyTuXa.tenHienThi || 'nhà cung cấp chữ ký số')}</b> (không cần USB token, không cài gì — xác nhận trên điện thoại)
          <p class="nho">Nhập ${h(d.kyTuXa.nhanUserId || 'mã người dùng')} đã đăng ký với ${h(d.kyTuXa.tenHienThi || 'nhà cung cấp')}. Hệ thống gửi yêu cầu ký, bạn xác nhận trên ứng dụng ${h(d.kyTuXa.tenHienThi || '')} hoặc nhập OTP tại đây.</p>
          <input id="oTuXaUser" placeholder="${h(d.kyTuXa.nhanUserId || 'Mã người dùng')}" style="width:100%;max-width:360px;padding:10px;font-size:16px;border:1px solid #bbb;border-radius:8px">
          <label style="display:block;margin:10px 0"><input type="checkbox" id="ckDongY0"> Tôi đã đọc và đồng ý ký kết hợp đồng này bằng chữ ký số.</label>
          <button type="button" class="nut" id="bKyTuXa">📲 Gửi yêu cầu ký</button><div id="baoTuXa" class="bao an"></div>
          <div id="khungOtpTuXa" class="an" style="margin-top:8px"><input class="otp" id="oOtpTuXa" inputmode="numeric" maxlength="8" placeholder="OTP" autocomplete="one-time-code"> <button type="button" class="nut" id="bXacNhanTuXa">Xác nhận OTP</button></div></div>` : ''}
        <div class="the" style="margin:8px 0"><b>Cách 1 — Ký ngay trên trang này</b> (cần cắm USB token và mở công cụ <a href="/tools/MoynKySo/" target="_blank">MOYN Ký số</a> trên máy tính Windows này)
          <label style="display:block;margin:10px 0"><input type="checkbox" id="ckDongY2"> Tôi đã đọc và đồng ý ký kết hợp đồng này bằng chữ ký số.</label>
          <button type="button" class="nut" id="bKyToken">🔐 Ký bằng USB token</button><div id="baoToken" class="bao an"></div></div>
        <div class="the" style="margin:8px 0"><b>Cách 2 — Tải PDF về, ký bằng phần mềm của nhà cung cấp chữ ký số (VNPT, Viettel, FPT…) hoặc Adobe Reader, rồi tải lên</b>
          <p class="nho">Ký lên ĐÚNG file vừa tải về, không in lại / không ghi lại thành file mới.</p>
          <a class="nut phu nho" href="/api/public/ky/${encodeURIComponent(token)}/pdf?tai=1&loai=goc">⬇ Tải PDF để ký</a>
          <input type="file" id="fKySo" accept=".pdf" style="margin-top:8px">
          <label style="display:block;margin:10px 0"><input type="checkbox" id="ckDongY3"> Tôi đã đọc và đồng ý ký kết hợp đồng này bằng chữ ký số.</label>
          <button type="button" class="nut" id="bTaiLen">⬆ Tải lên bản đã ký</button><div id="baoTaiLen" class="bao an"></div></div>
      </div>
      <p style="margin-top:16px"><a href="#" id="lkTuChoi" class="nho">Tôi không đồng ý — từ chối ký</a></p>`;
  }

  function noiKy() {
    const Q = (s) => document.querySelector(s);
    let kenhChon = (d.kenh || {})[d.kenhMacDinh] ? d.kenhMacDinh : (['sms', 'zalo', 'email'].find(k => (d.kenh || {})[k]) || 'email');
    document.querySelectorAll('.kenh').forEach(b => { b.classList.toggle('dang', b.dataset.kenh === kenhChon); b.addEventListener('click', () => { kenhChon = b.dataset.kenh; document.querySelectorAll('.kenh').forEach(x => x.classList.toggle('dang', x === b)); }); });
    Q('#tabOtp').addEventListener('click', () => { Q('#tabOtp').classList.add('dang'); Q('#tabKySo').classList.remove('dang'); Q('#phanOtp').classList.remove('an'); Q('#phanKySo').classList.add('an'); });
    Q('#tabKySo').addEventListener('click', () => { Q('#tabKySo').classList.add('dang'); Q('#tabOtp').classList.remove('dang'); Q('#phanKySo').classList.remove('an'); Q('#phanOtp').classList.add('an'); });
    // OTP
    let demTimer = null;
    Q('#bGuiOtp').addEventListener('click', async () => {
      const b = Q('#bGuiOtp'); b.disabled = true; bao('baoOtp', 'chu', 'Đang gửi mã…');
      try {
        const r = await api('/' + encodeURIComponent(token) + '/otp', { method: 'POST', body: { kenh: kenhChon } });
        bao('baoOtp', 'ok', h(r.message)); Q('#oOtp').focus();
        let con = 60; Q('#demNguoc').textContent = 'Gửi lại sau 60 s'; clearInterval(demTimer);
        demTimer = setInterval(() => { con -= 1; if (con <= 0) { clearInterval(demTimer); Q('#demNguoc').textContent = ''; b.disabled = false; b.textContent = 'Gửi lại mã OTP'; } else Q('#demNguoc').textContent = 'Gửi lại sau ' + con + ' s'; }, 1000);
      } catch (e) { bao('baoOtp', 'loi', h(e.message)); b.disabled = false; }
    });
    const pad = taoPad(Q('#padKy'));
    Q('#bXoaKy').addEventListener('click', pad.xoa);
    Q('#bKy').addEventListener('click', async () => {
      const otp = Q('#oOtp').value.replace(/\D/g, '');
      if (otp.length !== 6) { bao('baoKy', 'loi', 'Nhập đủ 6 số OTP.'); return; }
      if (!Q('#ckDongY').checked) { bao('baoKy', 'loi', 'Bạn cần tick ô đồng ý ký kết.'); return; }
      const b = Q('#bKy'); b.disabled = true; b.textContent = 'Đang ký…'; bao('baoKy', 'chu', 'Đang xác thực OTP và ký… (có thể mất 10–20 giây vì bên bán ký số ngay sau đó)');
      try {
        const r = await api('/' + encodeURIComponent(token) + '/ky', { method: 'POST', body: { otp, dongY: true, anhChuKy: pad.coVe() ? pad.png() : null }, timeout: 120000 });
        bao('baoKy', 'ok', h(r.message)); setTimeout(nap, 800);
      } catch (e) { bao('baoKy', 'loi', h(e.message)); b.disabled = false; b.textContent = '✍️ Tôi đồng ý ký kết / Xác nhận đơn hàng'; }
    });
    // ký số — công cụ
    Q('#bKyToken').addEventListener('click', async () => {
      if (!Q('#ckDongY2').checked) { bao('baoToken', 'loi', 'Bạn cần tick ô đồng ý ký kết.'); return; }
      const b = Q('#bKyToken'); b.disabled = true;
      try {
        const r = await window.MoynKySo.kyTronLuong({
          chonChungThu: chonChungThu, baoTien: (s) => bao('baoToken', 'chu', h(s)),
          batDau: async (certDer) => { const x = (await api('/' + encodeURIComponent(token) + '/ky-so/bat-dau', { method: 'POST', body: { certDer } })).data; if (x.canhBao && x.canhBao.length && !confirm(x.canhBao.join('\n') + '\n\nVẫn ký?')) throw new Error('Đã dừng.'); return x; },
          hoanTat: async (phienKy, chuKy) => api('/' + encodeURIComponent(token) + '/ky-so/hoan-tat', { method: 'POST', body: { phienKy, chuKy, dongY: true }, timeout: 120000 })
        });
        bao('baoToken', 'ok', h(r.message || 'Đã ký số.')); setTimeout(nap, 800);
      } catch (e) { bao('baoToken', 'loi', h(e.message)); b.disabled = false; }
    });
    // v9.62 ký số — từ xa qua CA (poll app hoặc OTP)
    if (Q('#bKyTuXa')) {
      let phienTuXa = null, pollTuXa = null;
      const duongTuXa = '/' + encodeURIComponent(token) + '/ky-tu-xa';
      const xongTuXa = (r) => { clearInterval(pollTuXa); bao('baoTuXa', 'ok', h(r.message || 'Đã ký số.')); setTimeout(nap, 800); };
      const loiTuXa = (e) => { clearInterval(pollTuXa); bao('baoTuXa', 'loi', h(e.message)); Q('#bKyTuXa').disabled = false; Q('#khungOtpTuXa').classList.add('an'); };
      Q('#bKyTuXa').addEventListener('click', async () => {
        const userId = Q('#oTuXaUser').value.trim();
        if (!userId) { bao('baoTuXa', 'loi', 'Nhập ' + (d.kyTuXa.nhanUserId || 'mã người dùng') + '.'); return; }
        if (!Q('#ckDongY0').checked) { bao('baoTuXa', 'loi', 'Bạn cần tick ô đồng ý ký kết.'); return; }
        const b = Q('#bKyTuXa'); b.disabled = true; bao('baoTuXa', 'chu', 'Đang lấy chứng thư và gửi yêu cầu ký…');
        try {
          const x = (await api(duongTuXa + '/bat-dau', { method: 'POST', body: { userId, dongY: true }, timeout: 60000 })).data;
          if (x.canhBao && x.canhBao.length && !confirm(x.canhBao.join('\n') + '\n\nVẫn ký?')) throw new Error('Đã dừng.');
          phienTuXa = x.phienKy;
          bao('baoTuXa', 'chu', h(x.huongDan || 'Hãy xác nhận trên ứng dụng của nhà cung cấp chữ ký số.') + (x.chungThu && x.chungThu.CN ? '<div class="nho">Chứng thư: ' + h(x.chungThu.CN) + '</div>' : ''));
          if (x.kieu === 'otp') { Q('#khungOtpTuXa').classList.remove('an'); Q('#oOtpTuXa').focus(); return; }
          let lan = 0;
          pollTuXa = setInterval(async () => {
            lan += 1;
            if (lan > 90) { loiTuXa(new Error('Quá 3 phút chưa xác nhận — bấm gửi lại.')); return; }
            try { const r = await api(duongTuXa + '/' + encodeURIComponent(phienTuXa), { timeout: 60000 }); if (r.data && r.data.xong) xongTuXa(r); else if (r.data && r.data.thongDiep) bao('baoTuXa', 'chu', h(r.data.thongDiep)); }
            catch (e) { loiTuXa(e); }
          }, 2000);
        } catch (e) { loiTuXa(e); }
      });
      Q('#bXacNhanTuXa').addEventListener('click', async () => {
        const otp = Q('#oOtpTuXa').value.trim();
        if (!otp) { bao('baoTuXa', 'loi', 'Nhập mã OTP.'); return; }
        const b = Q('#bXacNhanTuXa'); b.disabled = true; bao('baoTuXa', 'chu', 'Đang xác nhận và ký…');
        try { xongTuXa(await api(duongTuXa + '/' + encodeURIComponent(phienTuXa) + '/xac-nhan', { method: 'POST', body: { otp }, timeout: 120000 })); }
        catch (e) { bao('baoTuXa', 'loi', h(e.message)); b.disabled = false; }
      });
    }
    // ký số — tải lên
    Q('#bTaiLen').addEventListener('click', async () => {
      const f = Q('#fKySo').files[0];
      if (!f) { bao('baoTaiLen', 'loi', 'Chọn file PDF đã ký.'); return; }
      if (!Q('#ckDongY3').checked) { bao('baoTaiLen', 'loi', 'Bạn cần tick ô đồng ý ký kết.'); return; }
      const b = Q('#bTaiLen'); b.disabled = true; bao('baoTaiLen', 'chu', 'Đang kiểm chữ ký số…');
      try {
        const fd = new FormData(); fd.append('file', f); fd.append('dongY', 'true');
        const r = await api('/' + encodeURIComponent(token) + '/ky-so/tai-len', { method: 'POST', body: fd, timeout: 120000 });
        bao('baoTaiLen', 'ok', h(r.message)); setTimeout(nap, 800);
      } catch (e) { bao('baoTaiLen', 'loi', h(e.message)); b.disabled = false; }
    });
    Q('#lkTuChoi').addEventListener('click', async (e) => {
      e.preventDefault();
      const lyDo = prompt('Lý do từ chối (để bên bán biết cần sửa gì):');
      if (!lyDo) return;
      try { const r = await api('/' + encodeURIComponent(token) + '/tu-choi', { method: 'POST', body: { lyDo } }); alert(r.message || 'Đã ghi nhận.'); nap(); } catch (e2) { alert(e2.message); }
    });
  }
  function chonChungThu(ds) {
    return new Promise(resolve => {
      const txt = ds.map((c, i) => (i + 1) + '. ' + c.subject + (c.notAfter ? ' (hết hạn ' + c.notAfter + ')' : '')).join('\n');
      const n = parseInt(prompt('Chọn chứng thư (nhập số):\n' + txt, '1'), 10);
      resolve(ds[n - 1] || null);
    });
  }
  /* Bảng vẽ chữ ký: canvas 2x độ phân giải, PNG nhỏ. */
  function taoPad(cv) {
    const ctx = cv.getContext('2d'); let ve = false, daVe = false;
    const kich = () => { const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * 2); cv.height = Math.round(r.height * 2); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a237e'; };
    kich(); window.addEventListener('resize', kich);
    const toa = (e) => { const r = cv.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [(p.clientX - r.left) * 2, (p.clientY - r.top) * 2]; };
    const bd = (e) => { ve = true; daVe = true; const [x, y] = toa(e); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault(); };
    const di = (e) => { if (!ve) return; const [x, y] = toa(e); ctx.lineTo(x, y); ctx.stroke(); e.preventDefault(); };
    const kt = () => { ve = false; };
    cv.addEventListener('mousedown', bd); cv.addEventListener('mousemove', di); window.addEventListener('mouseup', kt);
    cv.addEventListener('touchstart', bd, { passive: false }); cv.addEventListener('touchmove', di, { passive: false }); cv.addEventListener('touchend', kt);
    return { xoa() { ctx.clearRect(0, 0, cv.width, cv.height); daVe = false; }, coVe: () => daVe, png: () => cv.toDataURL('image/png') };
  }

  if (token) nap(); else veTraCuu();
})();
