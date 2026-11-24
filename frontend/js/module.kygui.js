/* ================================================================================================
   HÀNG KÝ GỬI  (v9.75 — Nguyen 17/11/2026)
   Tab nằm TRONG phân hệ "Thẻ kho hàng hóa", quyền KHOHANG/kygui (module.khohang.js ủy quyền sang đây).

   Ba màn trong một tab:
     1. SỔ KÝ GỬI Ở KHÁCH — theo khách: gửi / đã báo bán / đã trả / còn / giá trị còn. Từ đây:
        · BÁO BÁN KỲ: nhập số bán từng dòng ⇒ máy chủ sinh PHIẾU BÁN HÀNG THẬT (CK NPP = % ký gửi của khách)
          ⇒ công nợ = giá × (1 − CK) = đúng số khách trả; phiếu hiện ở tab Phiếu bán hàng như mọi phiếu.
        · TRẢ VỀ: khách trả hàng CHƯA bán — chỉ giảm "còn ở khách" (hàng chưa bao giờ rời sổ tồn).
     2. PHIẾU XUẤT KÝ GỬI — lập / sửa (khi chưa báo bán/trả) / hủy / in biên bản giao hàng ký gửi.
     3. PHIẾU TRẢ VỀ — danh sách / xem / hủy.
   Luật tiền + tồn nằm hết ở máy chủ (routes/kygui.js, utils/kyGuiDangGiu.js); màn hình chỉ vẽ.
   ================================================================================================ */
(function () {
  let container = null, perm = {}, dm = null, man = 'so';
  const so = (v) => Number(v) || 0;
  const money = (v) => fmtNumber(Math.round(so(v)));
  const $ = (id) => document.getElementById(id);

  async function render(el, user, tabKey) {
    container = el;
    perm = user.isAdmin ? { canView: 1, canCreate: 1, canEdit: 1, canDelete: 1 }
      : effectivePerm(user, 'KHOHANG', 'kygui', user.permissions.KHOHANG || {});
    await ve();
  }
  async function napDM() { if (!dm) dm = (await apiGet('/api/kygui/danhmuc')).data; return dm; }

  function thanhMan() {
    const nut = (k, nhan) => `<button class="btn ${man === k ? '' : 'secondary'} small" data-man="${k}">${nhan}</button>`;
    return `<div class="toolbar" style="gap:6px;flex-wrap:wrap;align-items:center;">
      ${nut('so', '📋 Sổ ký gửi ở khách')}${nut('phieu', '📦 Phiếu xuất ký gửi')}${nut('tra', '↩ Phiếu trả về')}
      <div style="flex:1"></div>
      ${man === 'phieu' && perm.canCreate ? '<button class="btn" id="kgThem">+ Lập phiếu xuất ký gửi</button>' : ''}
    </div>`;
  }
  async function ve() {
    const body = $('khBody') || container;
    body.innerHTML = thanhMan() + '<div id="kgBang"><div class="empty-hint">Đang tải...</div></div>';
    body.querySelectorAll('[data-man]').forEach(b => b.onclick = () => { man = b.dataset.man; ve().catch(e => toast(e.message, 'error')); });
    const them = $('kgThem'); if (them) them.onclick = () => moFormPhieu(null).catch(e => toast(e.message, 'error'));
    try {
      if (man === 'so') await veSo();
      else if (man === 'phieu') await veDanhSachPhieu();
      else await veDanhSachTra();
    } catch (e) { $('kgBang').innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; }
  }

  /* ================================ 1. SỔ KÝ GỬI Ở KHÁCH ================================ */
  async function veSo() {
    const d = (await apiGet('/api/kygui/okhach')).data;
    const th = d.tongHop || [];
    const tong = th.reduce((a, r) => ({ gui: a.gui + so(r.GuiCai), ban: a.ban + so(r.DaBaoBanCai), tra: a.tra + so(r.DaTraCai), con: a.con + so(r.ConCai), gt: a.gt + so(r.GiaTriCon) }), { gui: 0, ban: 0, tra: 0, con: 0, gt: 0 });
    $('kgBang').innerHTML = `
      <p style="color:#5f6368;font-size:12px;margin:4px 0 8px;">Hàng ký gửi <b>vẫn là tồn kho</b> của công ty (chỉ bớt khả dụng). Khách bán được bao nhiêu thì <b>Báo bán</b> bấy nhiêu — máy sinh phiếu bán hàng với CK của khách, công nợ đúng bằng số khách trả. Hàng chưa bán mang về thì <b>Trả về</b>.</p>
      <table><thead><tr><th style="width:38px;">STT</th><th>Khách hàng</th><th style="text-align:right;">% CK</th><th style="text-align:right;">Số phiếu</th><th style="text-align:right;">Đã gửi (cái)</th><th style="text-align:right;">Đã báo bán</th><th style="text-align:right;">Đã trả về</th><th style="text-align:right;">Còn ở khách</th><th style="text-align:right;">Giá trị còn (nguyên giá)</th><th style="width:250px;"></th></tr></thead>
      <tbody>${th.map((r, i) => `<tr><td style="text-align:center;">${i + 1}</td><td><b>${escapeHtml(r.TenKhach)}</b></td><td style="text-align:right;">${so(r.PhanTramCK)}%</td><td style="text-align:right;">${r.SoPhieu}</td><td style="text-align:right;">${fmtNumber(r.GuiCai)}</td><td style="text-align:right;">${fmtNumber(r.DaBaoBanCai)}</td><td style="text-align:right;">${fmtNumber(r.DaTraCai)}</td><td style="text-align:right;font-weight:700;">${fmtNumber(r.ConCai)}</td><td style="text-align:right;">${money(r.GiaTriCon)}</td>
        <td><button class="btn small secondary kg-ct" data-ten="${escapeHtml(r.TenKhach)}">Chi tiết</button> ${perm.canCreate ? `<button class="btn small kg-bb" data-ten="${escapeHtml(r.TenKhach)}" data-kh="${r.KhachHangID || ''}" data-ck="${so(r.PhanTramCK)}">Báo bán</button> <button class="btn small secondary kg-tra" data-ten="${escapeHtml(r.TenKhach)}" data-kh="${r.KhachHangID || ''}">Trả về</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="10" class="empty-hint">Chưa có hàng ký gửi nào đang ở khách. Lập phiếu ở màn "Phiếu xuất ký gửi".</td></tr>'}</tbody>
      ${th.length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${fmtNumber(tong.gui)}</td><td style="text-align:right;">${fmtNumber(tong.ban)}</td><td style="text-align:right;">${fmtNumber(tong.tra)}</td><td style="text-align:right;">${fmtNumber(tong.con)}</td><td style="text-align:right;">${money(tong.gt)}</td><td></td></tr></tfoot>` : ''}</table>`;
    themOTimTuDong($('kgBang'));
    $('kgBang').querySelectorAll('.kg-ct').forEach(b => b.onclick = () => moChiTietKhach(b.dataset.ten).catch(e => toast(e.message, 'error')));
    $('kgBang').querySelectorAll('.kg-bb').forEach(b => b.onclick = () => moBaoBan(b.dataset.ten, b.dataset.kh, Number(b.dataset.ck)).catch(e => toast(e.message, 'error')));
    $('kgBang').querySelectorAll('.kg-tra').forEach(b => b.onclick = () => moTraVe(b.dataset.ten, b.dataset.kh).catch(e => toast(e.message, 'error')));
  }
  const anhHtml = (u) => (u ? `<img class="thumb" src="${escapeHtml(anhNho(u, 160))}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;border:1px solid var(--border);">` : '');
  function bangDongHtml(rows, cotNhap) {
    return `<div style="max-height:60vh;overflow:auto;"><table style="font-size:13px;"><thead><tr><th>Phiếu KG</th><th>Ngày</th><th style="width:44px;">Ảnh</th><th>Mã hàng</th><th>Tên hàng</th><th>Màu</th><th style="text-align:right;">Giá</th><th style="text-align:right;">Gửi</th><th style="text-align:right;">Đã bán</th><th style="text-align:right;">Đã trả</th><th style="text-align:right;">Còn</th>${cotNhap ? `<th style="width:110px;">${cotNhap}</th>` : ''}</tr></thead>
      <tbody>${rows.map(r => `<tr data-ct="${r.KyGuiCTID}" data-con="${r.ConCai}"><td>${escapeHtml(r.SoPhieu)}</td><td>${fmtDate(r.Ngay)}</td><td>${anhHtml(r.AnhDaiDien)}</td><td><b>${escapeHtml(r.MaHang)}</b></td><td>${escapeHtml(r.TenHang || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td style="text-align:right;">${money(r.GiaBanLe)}</td><td style="text-align:right;">${fmtNumber(r.SoLuongCai)}</td><td style="text-align:right;">${fmtNumber(r.DaBaoBanCai)}</td><td style="text-align:right;">${fmtNumber(r.DaTraCai)}</td><td style="text-align:right;font-weight:700;">${fmtNumber(r.ConCai)}</td>${cotNhap ? `<td><input type="number" class="kg-sl" min="0" max="${r.ConCai}" step="1" style="width:90px;" placeholder="0"></td>` : ''}</tr>`).join('') || `<tr><td colspan="${cotNhap ? 12 : 11}" class="empty-hint">Không còn hàng ở khách.</td></tr>`}</tbody></table></div>`;
  }
  async function moChiTietKhach(tenKhach) {
    const rows = (await apiGet('/api/kygui/okhach?tenKhach=' + encodeURIComponent(tenKhach) + '&tatCa=1')).data.rows;
    const m = openModal(`<h3>Hàng ký gửi — ${escapeHtml(tenKhach)}</h3>${bangDongHtml(rows, null)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="kgIn">🖨️ In</button><button type="button" class="btn" id="kgDong">Đóng</button></div>`);
    m.querySelector('#kgDong').onclick = () => closeModal();
    m.querySelector('#kgIn').onclick = () => printHtml('Hang ky gui - ' + tenKhach, `<h2 style="text-align:center;">BẢNG KÊ HÀNG KÝ GỬI ĐANG Ở KHÁCH</h2><p><b>Khách hàng:</b> ${escapeHtml(tenKhach)} &nbsp; <b>Ngày in:</b> ${fmtDate(homNayISO())}</p>
      <table><thead><tr><th>Phiếu KG</th><th>Ngày</th><th>Mã hàng</th><th>Tên hàng</th><th>Màu</th><th>Giá</th><th>Gửi</th><th>Đã bán</th><th>Đã trả</th><th>Còn</th></tr></thead><tbody>${rows.map(r => `<tr><td>${escapeHtml(r.SoPhieu)}</td><td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.MaHang)}</td><td>${escapeHtml(r.TenHang || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td style="text-align:right;">${money(r.GiaBanLe)}</td><td style="text-align:right;">${r.SoLuongCai}</td><td style="text-align:right;">${r.DaBaoBanCai}</td><td style="text-align:right;">${r.DaTraCai}</td><td style="text-align:right;"><b>${r.ConCai}</b></td></tr>`).join('')}
      <tr data-tong style="font-weight:bold;"><td colspan="6" style="text-align:right;">TỔNG</td><td style="text-align:right;">${rows.reduce((s, r) => s + so(r.SoLuongCai), 0)}</td><td style="text-align:right;">${rows.reduce((s, r) => s + so(r.DaBaoBanCai), 0)}</td><td style="text-align:right;">${rows.reduce((s, r) => s + so(r.DaTraCai), 0)}</td><td style="text-align:right;">${rows.reduce((s, r) => s + so(r.ConCai), 0)}</td></tr></tbody></table>`);
  }
  function docDongNhap(m) {
    return [...m.querySelectorAll('tr[data-ct]')].map(tr => ({ kyGuiCTID: Number(tr.dataset.ct), con: Number(tr.dataset.con), soCai: Number(tr.querySelector('.kg-sl').value) || 0 })).filter(x => x.soCai > 0);
  }
  async function moBaoBan(tenKhach, khachHangId, ck) {
    const rows = (await apiGet('/api/kygui/okhach?tenKhach=' + encodeURIComponent(tenKhach))).data.rows;
    const m = openModal(`<h3>Báo bán hàng ký gửi — ${escapeHtml(tenKhach)}</h3>
      <p style="color:#5f6368;font-size:12px;margin:0 0 8px;">Nhập số khách <b>đã bán</b> trong kỳ theo bảng kê của khách. Lưu ⇒ sinh một <b>phiếu bán hàng</b> (nguyên giá, CK ${ck}% áp cả phiếu) ⇒ công nợ = số khách phải trả sau CK.</p>
      <table class="phieu-form"><tr><th>Ngày bán (ngày kỳ báo)</th><td><input type="date" id="bbNgay" value="${homNayISO()}"></td><th>% CK ký gửi</th><td><input type="number" id="bbCK" value="${ck}" step="0.01" min="0" max="100" style="width:90px;"> %</td><th>Ghi chú</th><td><input type="text" id="bbGhiChu" placeholder="VD: bảng kê tháng 11" style="width:100%;"></td></tr></table>
      ${bangDongHtml(rows, 'Bán kỳ này')}
      <div style="margin-top:6px;font-weight:600;">Tạm tính: <span id="bbTong">0</span> cái — tiền sau CK <span id="bbTien">0</span> đ</div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="bbHuy">Hủy</button><button type="button" class="btn" id="bbLuu">💾 Lưu — sinh phiếu bán hàng</button></div>`);
    const giaCua = new Map(rows.map(r => [Number(r.KyGuiCTID), so(r.GiaBanLe)]));
    const tinh = () => { const ds = docDongNhap(m); const ckv = so(m.querySelector('#bbCK').value); const tien = ds.reduce((s, x) => s + x.soCai * (giaCua.get(x.kyGuiCTID) || 0), 0); m.querySelector('#bbTong').textContent = fmtNumber(ds.reduce((s, x) => s + x.soCai, 0)); m.querySelector('#bbTien').textContent = money(tien * (1 - ckv / 100)); };
    m.querySelectorAll('.kg-sl, #bbCK').forEach(i => i.addEventListener('input', tinh));
    m.querySelector('#bbHuy').onclick = () => closeModal();
    m.querySelector('#bbLuu').onclick = async () => {
      const ds = docDongNhap(m);
      if (!ds.length) { toast('Chưa nhập số bán dòng nào.', 'error'); return; }
      const qua = ds.find(x => x.soCai > x.con); if (qua) { toast('Có dòng báo bán nhiều hơn số còn ở khách.', 'error'); return; }
      const nut = m.querySelector('#bbLuu'); nut.disabled = true;
      try {
        const kq = await apiPost('/api/kygui/baoban', { tenKhach, khachHangId: khachHangId || null, ngayBan: m.querySelector('#bbNgay').value, phanTramCKNPP: m.querySelector('#bbCK').value, ghiChu: m.querySelector('#bbGhiChu').value, dong: ds });
        closeModal(); toast(`Đã sinh phiếu bán hàng ${kq.data.soPhieu} — công nợ ${money(kq.data.tongThanhToan)} đ.`, 'success', 6000); ve();
      } catch (e) { nut.disabled = false; toast(e.message, 'error', 8000); }
    };
  }
  async function moTraVe(tenKhach, khachHangId) {
    const rows = (await apiGet('/api/kygui/okhach?tenKhach=' + encodeURIComponent(tenKhach))).data.rows;
    const m = openModal(`<h3>Khách trả hàng ký gửi chưa bán — ${escapeHtml(tenKhach)}</h3>
      <p style="color:#5f6368;font-size:12px;margin:0 0 8px;">Chỉ giảm số "còn ở khách" (hàng vẫn luôn là tồn kho, không có chứng từ nhập). Hàng khách <b>đã mua</b> mà trả thì dùng <b>Phiếu nhập lại</b>.</p>
      <table class="phieu-form"><tr><th>Ngày trả</th><td><input type="date" id="tvNgay" value="${homNayISO()}"></td><th>Ghi chú</th><td><input type="text" id="tvGhiChu" style="width:100%;"></td></tr></table>
      ${bangDongHtml(rows, 'Trả về')}
      <div class="modal-actions"><button type="button" class="btn secondary" id="tvHuy">Hủy</button><button type="button" class="btn" id="tvLuu">💾 Lưu phiếu trả</button></div>`);
    m.querySelector('#tvHuy').onclick = () => closeModal();
    m.querySelector('#tvLuu').onclick = async () => {
      const ds = docDongNhap(m);
      if (!ds.length) { toast('Chưa nhập số trả dòng nào.', 'error'); return; }
      const qua = ds.find(x => x.soCai > x.con); if (qua) { toast('Có dòng trả nhiều hơn số còn ở khách.', 'error'); return; }
      const nut = m.querySelector('#tvLuu'); nut.disabled = true;
      try {
        const kq = await apiPost('/api/kygui/tra', { tenKhach, khachHangId: khachHangId || null, ngay: m.querySelector('#tvNgay').value, ghiChu: m.querySelector('#tvGhiChu').value, dong: ds });
        closeModal(); toast('Đã lưu phiếu trả ' + kq.data.soPhieu + '.', 'success'); ve();
      } catch (e) { nut.disabled = false; toast(e.message, 'error', 8000); }
    };
  }

  /* ================================ 2. PHIẾU XUẤT KÝ GỬI ================================ */
  async function veDanhSachPhieu() {
    const rows = (await apiGet('/api/kygui/phieu')).data;
    $('kgBang').innerHTML = `<table><thead><tr><th style="width:38px;">STT</th><th>Số phiếu</th><th>Ngày</th><th>Khách hàng</th><th style="text-align:right;">% CK</th><th style="text-align:right;">Số cái</th><th style="text-align:right;">Giá trị (nguyên giá)</th><th>Ghi chú</th><th>Trạng thái</th><th>Người lập</th><th style="width:210px;"></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr${r.TrangThai === 'Đã hủy' ? ' style="color:#999;text-decoration:line-through;"' : ''}><td style="text-align:center;">${i + 1}</td><td><b>${escapeHtml(r.SoPhieu)}</b></td><td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.TenKhach)}</td><td style="text-align:right;">${so(r.PhanTramCK)}%</td><td style="text-align:right;">${fmtNumber(r.TongCai)}</td><td style="text-align:right;">${money(r.GiaTri)}</td><td>${escapeHtml(r.GhiChu || '')}</td><td>${escapeHtml(r.TrangThai)}</td><td>${escapeHtml(r.NguoiTao || '')}</td>
        <td><button class="btn small secondary kg-xem" data-id="${r.PhieuKGID}">Xem / In</button> ${perm.canEdit && r.TrangThai !== 'Đã hủy' ? `<button class="btn small secondary kg-sua" data-id="${r.PhieuKGID}">Sửa</button>` : ''} ${perm.canDelete && r.TrangThai !== 'Đã hủy' ? `<button class="btn small danger kg-huy" data-id="${r.PhieuKGID}" data-so="${escapeHtml(r.SoPhieu)}">Hủy</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="11" class="empty-hint">Chưa có phiếu ký gửi.</td></tr>'}</tbody></table>`;
    themOTimTuDong($('kgBang'));
    $('kgBang').querySelectorAll('.kg-xem').forEach(b => b.onclick = () => xemPhieu(b.dataset.id).catch(e => toast(e.message, 'error')));
    $('kgBang').querySelectorAll('.kg-sua').forEach(b => b.onclick = () => moFormPhieu(b.dataset.id).catch(e => toast(e.message, 'error')));
    $('kgBang').querySelectorAll('.kg-huy').forEach(b => b.onclick = async () => {
      if (!confirm(`Hủy phiếu ký gửi ${b.dataset.so}? Số hàng của phiếu không còn tính là "ở khách".`)) return;
      try { await apiPut('/api/kygui/phieu/' + b.dataset.id + '/huy', {}); toast('Đã hủy.', 'success'); ve(); } catch (e) { toast(e.message, 'error', 8000); }
    });
  }
  function inPhieuBody(h, ct) {
    const tong = ct.reduce((s, r) => s + so(r.SoLuongCai), 0), gt = ct.reduce((s, r) => s + so(r.SoLuongCai) * so(r.GiaBanLe), 0);
    return `<h2 style="text-align:center;">PHIẾU XUẤT HÀNG KÝ GỬI</h2><p style="text-align:center;" class="p-meta">Số: <b>${escapeHtml(h.SoPhieu)}</b> — Ngày ${fmtDate(h.Ngay)}</p>
      <p class="p-meta"><b>Bên nhận ký gửi:</b> ${escapeHtml(h.TenKhach)}${h.GhiChu ? ' — ' + escapeHtml(h.GhiChu) : ''}</p>
      <p class="p-meta">Hàng dưới đây thuộc sở hữu của bên gửi cho tới khi bán; bên nhận thanh toán theo số thực bán, chiết khấu <b>${so(h.PhanTramCK)}%</b> trên giá bán ghi trong phiếu; hàng không bán trả lại nguyên trạng.</p>
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã hàng</th><th>Tên hàng</th><th>Màu</th><th>Số lượng (cái)</th><th>Giá bán</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
      <tbody>${ct.map((r, i) => `<tr><td style="text-align:center;">${i + 1}</td><td>${escapeHtml(r.MaHang)}</td><td>${escapeHtml(r.TenHang || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td style="text-align:right;">${r.SoLuongCai}</td><td style="text-align:right;">${money(r.GiaBanLe)}</td><td style="text-align:right;">${money(so(r.SoLuongCai) * so(r.GiaBanLe))}</td><td>${escapeHtml(r.GhiChu || '')}</td></tr>`).join('')}
      <tr data-tong style="font-weight:bold;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${tong}</td><td></td><td style="text-align:right;">${money(gt)}</td><td></td></tr></tbody></table>
      <div class="p-sign"><div><b>BÊN GIAO</b><br><i>(Ký, ghi rõ họ tên)</i><div class="line"></div></div><div><b>BÊN NHẬN KÝ GỬI</b><br><i>(Ký, ghi rõ họ tên)</i><div class="line"></div></div></div>`;
  }
  async function xemPhieu(id) {
    const { header: h, chiTiet: ct } = (await apiGet('/api/kygui/phieu/' + id)).data;
    const m = openModal(`<h3>Phiếu ký gửi ${escapeHtml(h.SoPhieu)}${h.TrangThai === 'Đã hủy' ? ' — ĐÃ HỦY' : ''}</h3>${bangDongHtml(ct, null)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="kgIn1">🖨️ In</button><button type="button" class="btn" id="kgDong1">Đóng</button></div>`);
    m.querySelector('#kgDong1').onclick = () => closeModal();
    m.querySelector('#kgIn1').onclick = () => printHtml('Phieu ky gui ' + h.SoPhieu, inPhieuBody(h, ct));
  }
  /* Form lập / sửa. Dòng: mã (datalist theo MaHang), màu (nạp theo mã, hiện khả dụng), số cái, giá (mặc định giá bán). */
  async function moFormPhieu(id) {
    await napDM();
    let h = null, ct = [];
    if (id) { const d = (await apiGet('/api/kygui/phieu/' + id)).data; h = d.header; ct = d.chiTiet; if (h.LyDoKhongSua) { toast(h.LyDoKhongSua, 'error', 8000); return; } }
    const khachOpt = dm.khach.map(k => `<option value="${k.KhachHangID}" data-ten="${escapeHtml(k.TenKhachHang)}" data-ck="${k.PhanTramCKKyGui != null ? so(k.PhanTramCKKyGui) : ''}"${h && String(h.KhachHangID) === String(k.KhachHangID) ? ' selected' : ''}>${escapeHtml(k.TenKhachHang)}</option>`).join('');
    const m = openModal(`<h3>${h ? 'Sửa phiếu ký gửi ' + escapeHtml(h.SoPhieu) : 'Lập phiếu xuất hàng ký gửi'}</h3>
      <table class="phieu-form">
        <tr><th>Khách hàng <span class="bat-buoc">*</span></th><td><select id="kgfKhach" style="width:100%;"><option value="">-- Chọn khách --</option>${khachOpt}</select></td>
            <th>Ngày</th><td><input type="date" id="kgfNgay" value="${h ? h.Ngay : homNayISO()}"></td></tr>
        <tr><th>% chiết khấu ký gửi</th><td><input type="number" id="kgfCK" step="0.01" min="0" max="100" value="${h ? so(h.PhanTramCK) : ''}" style="width:90px;"> % <span style="color:#5f6368;font-size:12px;">(tự điền từ hồ sơ khách — Danh mục › Khách hàng; báo bán dùng số này)</span></td>
            <th>Ghi chú</th><td><input type="text" id="kgfGhiChu" value="${escapeHtml(h ? h.GhiChu || '' : '')}" style="width:100%;"></td></tr>
      </table>
      <datalist id="kgfDSHang">${dm.hang.map(x => `<option value="${escapeHtml(x.MaHang)}">${escapeHtml(x.TenHang || '')}</option>`).join('')}</datalist>
      <div style="max-height:50vh;overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:170px;">Mã hàng</th><th>Tên hàng</th><th style="width:200px;">Màu (khả dụng)</th><th style="width:90px;">Số cái</th><th style="width:120px;">Giá bán</th><th>Ghi chú</th><th style="width:36px;"></th></tr></thead><tbody id="kgfBody"></tbody></table></div>
      <div style="margin-top:6px;"><button type="button" class="btn small secondary" id="kgfThemDong">＋ Thêm dòng</button> <span style="color:#5f6368;font-size:12px;">Khả dụng = tồn − đang giữ bởi đơn khách / ký gửi khác (đơn vị chính của mã).</span></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="kgfHuy">Hủy</button><button type="button" class="btn" id="kgfLuu">💾 Lưu</button></div>`);
    const body = m.querySelector('#kgfBody');
    const hangTheoMa = new Map(dm.hang.map(x => [String(x.MaHang).trim().toUpperCase(), x]));
    const selKhach = m.querySelector('#kgfKhach');
    selKhach.addEventListener('change', () => { const o = selKhach.selectedOptions[0]; if (o && o.dataset.ck !== '' && !m.querySelector('#kgfCK').value) m.querySelector('#kgfCK').value = o.dataset.ck; });
    async function napMau(tr, maHangId, chonId) {
      const sel = tr.querySelector('.kgf-mau');
      sel.innerHTML = '<option value="">...</option>';
      if (!maHangId) { sel.innerHTML = '<option value="">-- chọn mã trước --</option>'; return; }
      const ds = (await apiGet('/api/kygui/mau?maHangId=' + maHangId)).data;
      sel.innerHTML = '<option value="">-- Chọn màu --</option>' + ds.map(x => `<option value="${x.MauSacID}"${String(x.MauSacID) === String(chonId) ? ' selected' : ''}>${escapeHtml(x.TenMau)} — KD ${fmtNumber(x.KhaDung)} / tồn ${fmtNumber(x.TonCai)}</option>`).join('');
    }
    function themDong(d) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><input type="text" class="kgf-ma" list="kgfDSHang" value="${escapeHtml(d ? d.MaHang : '')}" style="width:100%;" placeholder="Gõ mã..."><input type="hidden" class="kgf-mhid" value="${d ? d.MaHangID : ''}"></td>
        <td class="kgf-ten" style="color:#5f6368;">${escapeHtml(d ? d.TenHang || '' : '')}</td>
        <td><select class="kgf-mau" style="width:100%;"><option value="">-- chọn mã trước --</option></select></td>
        <td><input type="number" class="kgf-sl" min="1" step="1" value="${d ? d.SoLuongCai : ''}" style="width:80px;"></td>
        <td><input type="number" class="kgf-gia" step="1000" value="${d ? so(d.GiaBanLe) : ''}" style="width:110px;"></td>
        <td><input type="text" class="kgf-gc" maxlength="255" value="${escapeHtml(d ? d.GhiChu || '' : '')}" style="width:100%;"></td>
        <td><button type="button" class="btn small secondary kgf-xoa">✕</button></td>`;
      body.appendChild(tr);
      const inpMa = tr.querySelector('.kgf-ma');
      const chonMa = () => {
        const hg = hangTheoMa.get(String(inpMa.value).trim().toUpperCase());
        tr.querySelector('.kgf-mhid').value = hg ? hg.MaHangID : '';
        tr.querySelector('.kgf-ten').textContent = hg ? (hg.TenHang || '') : '';
        if (hg && !tr.querySelector('.kgf-gia').value) tr.querySelector('.kgf-gia').value = so(hg.GiaBan);
        napMau(tr, hg ? hg.MaHangID : null, null).catch(e => toast(e.message, 'error'));
      };
      inpMa.addEventListener('change', chonMa);
      tr.querySelector('.kgf-xoa').onclick = () => tr.remove();
      if (d) napMau(tr, d.MaHangID, d.MauSacID).catch(e => toast(e.message, 'error'));
    }
    if (ct.length) ct.forEach(themDong); else themDong(null);
    m.querySelector('#kgfThemDong').onclick = () => { themDong(null); body.lastElementChild.querySelector('.kgf-ma').focus(); };
    m.querySelector('#kgfHuy').onclick = () => closeModal();
    m.querySelector('#kgfLuu').onclick = async () => {
      const o = selKhach.selectedOptions[0];
      if (!selKhach.value) { toast('Chưa chọn khách hàng.', 'error'); return; }
      const dong = [...body.querySelectorAll('tr')].map(tr => ({ maHangId: tr.querySelector('.kgf-mhid').value, mauSacId: tr.querySelector('.kgf-mau').value, soCai: tr.querySelector('.kgf-sl').value, giaBanLe: tr.querySelector('.kgf-gia').value, ghiChu: tr.querySelector('.kgf-gc').value }))
        .filter(x => x.maHangId || x.soCai);
      if (!dong.length) { toast('Chưa có dòng hàng nào.', 'error'); return; }
      if (dong.some(x => !x.maHangId)) { toast('Có dòng gõ mã không có trong danh mục.', 'error'); return; }
      if (dong.some(x => !x.mauSacId)) { toast('Có dòng chưa chọn màu.', 'error'); return; }
      const payload = { khachHangId: selKhach.value, tenKhach: o.dataset.ten, ngay: m.querySelector('#kgfNgay').value, phanTramCK: m.querySelector('#kgfCK').value, ghiChu: m.querySelector('#kgfGhiChu').value, dong };
      const nut = m.querySelector('#kgfLuu'); nut.disabled = true;
      try {
        const kq = h ? await apiPut('/api/kygui/phieu/' + h.PhieuKGID, payload) : await apiPost('/api/kygui/phieu', payload);
        closeModal(); toast(h ? 'Đã lưu.' : 'Đã lập phiếu ' + kq.data.soPhieu + '.', 'success'); man = 'phieu'; ve();
      } catch (e) { nut.disabled = false; toast(e.message, 'error', 9000); }
    };
  }

  /* ================================ 3. PHIẾU TRẢ VỀ ================================ */
  async function veDanhSachTra() {
    const rows = (await apiGet('/api/kygui/tra')).data;
    $('kgBang').innerHTML = `<table><thead><tr><th style="width:38px;">STT</th><th>Số phiếu</th><th>Ngày</th><th>Khách hàng</th><th style="text-align:right;">Số cái</th><th>Ghi chú</th><th>Trạng thái</th><th>Người lập</th><th style="width:150px;"></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr${r.TrangThai === 'Đã hủy' ? ' style="color:#999;text-decoration:line-through;"' : ''}><td style="text-align:center;">${i + 1}</td><td><b>${escapeHtml(r.SoPhieu)}</b></td><td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.TenKhach)}</td><td style="text-align:right;">${fmtNumber(r.TongCai)}</td><td>${escapeHtml(r.GhiChu || '')}</td><td>${escapeHtml(r.TrangThai)}</td><td>${escapeHtml(r.NguoiTao || '')}</td>
        <td><button class="btn small secondary kg-xemtra" data-id="${r.PhieuKGTID}">Xem</button> ${perm.canDelete && r.TrangThai !== 'Đã hủy' ? `<button class="btn small danger kg-huytra" data-id="${r.PhieuKGTID}" data-so="${escapeHtml(r.SoPhieu)}">Hủy</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Chưa có phiếu trả. Lập từ màn Sổ ký gửi › Trả về.</td></tr>'}</tbody></table>`;
    themOTimTuDong($('kgBang'));
    $('kgBang').querySelectorAll('.kg-xemtra').forEach(b => b.onclick = async () => {
      const { header: h, chiTiet: ct } = (await apiGet('/api/kygui/tra/' + b.dataset.id)).data;
      const m = openModal(`<h3>Phiếu trả hàng ký gửi ${escapeHtml(h.SoPhieu)} — ${escapeHtml(h.TenKhach)} — ${fmtDate(h.Ngay)}</h3>
        <table style="font-size:13px;"><thead><tr><th>Phiếu KG</th><th>Mã hàng</th><th>Tên hàng</th><th>Màu</th><th style="text-align:right;">Giá</th><th style="text-align:right;">Trả về (cái)</th></tr></thead>
        <tbody>${ct.map(r => `<tr><td>${escapeHtml(r.SoPhieuKG)}</td><td>${escapeHtml(r.MaHang)}</td><td>${escapeHtml(r.TenHang || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td style="text-align:right;">${money(r.GiaBanLe)}</td><td style="text-align:right;">${r.SoLuongCai}</td></tr>`).join('')}</tbody></table>
        <div class="modal-actions"><button type="button" class="btn" id="kgDong2">Đóng</button></div>`);
      m.querySelector('#kgDong2').onclick = () => closeModal();
    });
    $('kgBang').querySelectorAll('.kg-huytra').forEach(b => b.onclick = async () => {
      if (!confirm(`Hủy phiếu trả ${b.dataset.so}? Số hàng sẽ tính lại là "còn ở khách".`)) return;
      try { await apiPut('/api/kygui/tra/' + b.dataset.id + '/huy', {}); toast('Đã hủy.', 'success'); ve(); } catch (e) { toast(e.message, 'error', 8000); }
    });
  }

  window.ModuleKyGui = { render };
})();
