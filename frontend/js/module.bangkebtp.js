// ================================================================
// MODULE: BANG KE BAN THANH PHAM (BTP) - v5.34 (Giai doan A)
// Bang luoi: cot Size (them tu do) x hang Mau vai CHINH (nut "Điền màu từ Cắt" -> lay mau + so lop tu
// cong doan Cat). Moi o = so lop (sua duoc). Tong cong theo hang = tong o. Xem/In + Tao/Ap mau.
// Dung window.ModuleBangKeBTP.render(el, user) - la 1 tab trong QLSX (giong ModuleTaiLieuKyThuat).
// ================================================================
window.ModuleBangKeBTP = (function () {
  let currentUser = null, container = null, perm = null;

  function render(el, user) {
    container = el; currentUser = user;
    const raw = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.QLSX || {});
    perm = effectivePerm(user, 'QLSX', 'bangkebtp', raw);
    renderOrderList();
  }

  async function renderOrderList() {
    let rows;
    try { rows = (await apiGet('/api/bangke/orders')).data; }   // v5.55: hiện lỗi thay vì để trắng tab nếu bị chặn quyền
    catch (err) { container.innerHTML = `<div class="empty-hint">Không tải được Bảng kê BTP: ${escapeHtml(err.message)}.<br>Nếu là tài khoản thường: nhờ Admin tích quyền "Xem — Bảng kê bán thành phẩm" trong Phân quyền chức năng rồi đăng nhập lại.</div>`; return; }
    container.innerHTML = `
      <div class="card">
        <div class="toolbar"><button class="btn small secondary" id="btnBkMau">📁 Tài liệu mẫu</button></div>
        <table><thead><tr><th>Mã ĐH</th><th>Sản phẩm</th><th>Bảng kê</th><th style="width:120px"></th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><a href="#" class="bk-lenh" data-madh="${escapeHtml(r.MaDH)}" title="Xem phiếu In lệnh SX">${escapeHtml(r.MaDH)}</a></td><td>${escapeHtml(r.TenSanPham || '')}</td>
          <td>${r.DaCo ? '✅ Đã có' : '—'}</td>
          <td><button class="btn small act-open" data-madh="${escapeHtml(r.MaDH)}">${perm.canEdit ? 'Lập/Sửa' : 'Xem'}</button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty-hint">Chưa có đơn hàng</td></tr>'}</tbody></table>
      </div>`;
    container.querySelectorAll('.act-open').forEach(b => b.addEventListener('click', () => openBtpBanList(b.dataset.madh)));   // v5.55: danh sách BẢN
    container.querySelectorAll('.bk-lenh').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); if (window.ModuleQLSX && window.ModuleQLSX.printLenhSanXuat) window.ModuleQLSX.printLenhSanXuat(a.dataset.madh); }));   // v5.53: click Mã ĐH → In lệnh SX
    container.querySelector('#btnBkMau').addEventListener('click', openMauManager);
  }

  function totalOfRow(r) { return (r.values || []).reduce((s, v) => s + (Number(v) || 0), 0); }

  // v5.55: 1 đơn có NHIỀU bản bảng kê BTP (mỗi bản 1 tên).
  async function openBtpBanList(maDH) {
    const res = await apiGet('/api/bangke/' + encodeURIComponent(maDH) + '/phieu');
    const order = res.order || {}; const phieu = res.data || [];
    const rowsHtml = (phieu.length ? phieu : []).map(p => `<tr>
        <td>${p.TenPhieu ? escapeHtml(p.TenPhieu) : '<i>(không tên)</i>'}</td>
        <td>
          <button class="btn small secondary bkb-open" data-ten="${escapeHtml(p.TenPhieu)}">${perm.canEdit ? 'Mở / Sửa' : 'Xem'}</button>
          <button class="btn small secondary bkb-print" data-ten="${escapeHtml(p.TenPhieu)}" title="In bản này">🖨️ In</button>
          ${perm.canDelete ? `<button class="btn small danger bkb-del" data-ten="${escapeHtml(p.TenPhieu)}">Xóa bản</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="2" class="empty-hint">Chưa có bản bảng kê nào</td></tr>';
    const modal = openModal(`
      <h3>Bảng kê BTP — ${escapeHtml(maDH)}${order.TenSanPham ? ' · ' + escapeHtml(order.TenSanPham) : ''}</h3>
      <p class="empty-hint">1 đơn có thể có NHIỀU bản bảng kê — đặt tên để phân biệt (vd Áo / Quần / Đợt 1).</p>
      <table><thead><tr><th>Tên bản</th><th style="width:300px">Thao tác</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="bkbClose">Đóng</button>
        ${perm.canEdit ? '<button type="button" class="btn" id="bkbAdd">+ Thêm bảng kê</button>' : ''}
      </div>`);
    modal.querySelector('#bkbClose').addEventListener('click', closeModal);
    // v5.56 FIX: bọc try/catch — trước đây openEditor() lỗi giữa đường (vd 1 API phụ bị 403) thì nút
    // "Thêm bảng kê"/"Mở/Sửa" IM LẶNG không làm gì; nay luôn hiện thông báo lỗi cụ thể.
    const openOne = async (ten) => {
      try { await openEditor(maDH, ten, () => openBtpBanList(maDH)); }
      catch (err) { toast('Không mở được bảng kê: ' + err.message, 'error'); }
    };
    const addBtn = modal.querySelector('#bkbAdd');
    if (addBtn) addBtn.addEventListener('click', () => openOne(''));
    modal.querySelectorAll('.bkb-open').forEach(b => b.addEventListener('click', () => openOne(b.dataset.ten)));
    // v5.57: IN ngay tại danh sách bản (không cần mở form).
    modal.querySelectorAll('.bkb-print').forEach(b => b.addEventListener('click', async () => {
      try {
        const html = await buildOrderSectionHtml(maDH, b.dataset.ten);
        if (!html) { toast('Bản này chưa có dữ liệu để in.', 'error'); return; }
        printHtml('Bảng kê bán thành phẩm - ' + maDH + (b.dataset.ten ? ' - ' + b.dataset.ten : ''), html);
      } catch (err) { toast('Không in được: ' + err.message, 'error'); }
    }));
    modal.querySelectorAll('.bkb-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa bản bảng kê này?')) return;
      try { await apiDelete('/api/bangke/' + encodeURIComponent(maDH) + '?ten=' + encodeURIComponent(b.dataset.ten)); toast('Đã xóa bản.', 'success'); openBtpBanList(maDH); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }
  async function openEditor(maDH, tenPhieu, onDone) {
    tenPhieu = tenPhieu || '';
    const res = await apiGet('/api/bangke/' + encodeURIComponent(maDH) + '?ten=' + encodeURIComponent(tenPhieu));
    const order = res.order, data = res.data, prefill = res.prefill || [];
    const sizeCols = Array.isArray(res.sizeCols) ? res.sizeCols : [];   // v5.44.5: cột size từ Thông số đo
    const mauList = (await apiGet('/api/bangke/mau/list').catch(() => ({ data: [] }))).data || [];   // v5.44.6: danh sách mẫu để CHỌN khi Áp mẫu. v5.56: KHÔNG để lỗi API phụ này chặn việc mở form.
    // Nếu đơn CHƯA có bảng kê -> cột size TỰ NHẢY từ Thông số đo (nếu có), không thì mặc định S/M/L.
    const state = (data && Array.isArray(data.cols) && data.cols.length)
      ? { cols: JSON.parse(JSON.stringify(data.cols)), rows: JSON.parse(JSON.stringify(data.rows || [])) }
      : { cols: (sizeCols.length ? sizeCols.slice() : ['S', 'M', 'L']), rows: [] };
    // dam bao moi hang co du values theo so cot
    const fixRows = () => state.rows.forEach(r => { r.values = r.values || []; while (r.values.length < state.cols.length) r.values.push(''); r.values.length = state.cols.length; });
    fixRows();
    const today = new Date().toISOString().slice(0, 10);

    const modal = openModal(`
      <h3>Bảng kê bán thành phẩm — ${escapeHtml(maDH)}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}</h3>
      <form id="bkForm">
        <div class="form-grid">
          <div class="form-row"><label>Mã hàng</label><input name="maHang" value="${escapeHtml((data && data.MaHang) || order.MaDH || '')}" ${perm.canEdit ? '' : 'readonly'}></div>
          <div class="form-row"><label>Tên bản</label><input name="tenBan" value="${escapeHtml(tenPhieu)}" placeholder="VD: Áo / Quần / Đợt 1 (để trống nếu chỉ 1 bản)" ${perm.canEdit ? '' : 'readonly'}></div>
          <div class="form-row"><label>Tên sản phẩm</label><div class="readonly-fact">${escapeHtml(order.TenSanPham || '')}</div></div>
          <div class="form-row"><label>Mã rập</label><div class="readonly-fact">${escapeHtml(order.MaRap || '')}</div></div>
          <div class="form-row"><label>Ngày cập nhật</label><input type="date" name="ngayCapNhat" value="${data && data.NgayCapNhat ? String(data.NgayCapNhat).slice(0, 10) : today}" ${perm.canEdit ? '' : 'readonly'}></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu" value="${escapeHtml((data && data.GhiChu) || '')}" ${perm.canEdit ? '' : 'readonly'}></div>
        </div>
        <div class="toolbar" style="margin:8px 0;">
          ${perm.canEdit ? `<button type="button" class="btn small secondary" id="btnDienMau" title="Gộp TẤT CẢ sổ cắt của lệnh này, chỉ tính cây VẢI CHÍNH">↧ Điền màu từ Cắt (tất cả sổ)</button>
          ${sizeCols.length ? '<button type="button" class="btn small secondary" id="btnSizeTsd">↧ Cột size từ Thông số đo</button>' : ''}
          <button type="button" class="btn small secondary" id="btnAddSize">+ Thêm size (cột)</button>
          ${mauList.length ? `<select id="bkMauSelect" style="max-width:220px;"><option value="">-- Chọn mẫu (cột size) --</option>${mauList.map(m => `<option value="${m.ID}">${escapeHtml(m.TenMau)}</option>`).join('')}</select> <button type="button" class="btn small secondary" id="btnApMau">📁 Áp mẫu</button>` : ''}` : ''}
        </div>
        ${/* v5.81: class bang-cuon đặt lại --top0/--tabs-h/--bar-h = 0 -> tiêu đề bảng dính ĐÚNG đỉnh
              vùng cuộn này, không bị đẩy xuống đè lên dòng đầu (xem style.css). */''}
        <div id="bkGrid" class="bang-cuon"></div>
        <div class="modal-actions">
          ${perm.canEdit ? '<button type="button" class="btn secondary" id="btnLuuMau">Lưu thành mẫu</button><button type="button" class="btn secondary" id="btnQlMauBtp">Quản lý mẫu</button>' : ''}
          <button type="button" class="btn secondary" id="btnPrintBk">🖨️ In</button>
          <button type="button" class="btn secondary" id="btnCancelBk">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>
          ${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu</button>' : ''}
        </div>
      </form>`);
    modal.querySelector('#btnCancelBk').addEventListener('click', closeModal);
    const gridBox = modal.querySelector('#bkGrid');

    function renderGrid() {
      fixRows();
      const headSizes = state.cols.map((c, i) => `<th style="min-width:56px;"><input value="${escapeHtml(c)}" class="bk-colname" data-ci="${i}" style="width:52px;text-align:center;" ${perm.canEdit ? '' : 'readonly'}> ${perm.canEdit ? `<button type="button" class="bk-delcol" data-ci="${i}" title="Xóa cột" style="border:none;background:none;color:#c0392b;cursor:pointer;">×</button>` : ''}</th>`).join('');
      const body = state.rows.map((r, ri) => `<tr data-ri="${ri}">
          <td style="text-align:center;">${ri + 1}</td>
          <td style="min-width:120px;">${escapeHtml(r.tenMau || '')}</td>
          ${state.cols.map((c, ci) => `<td><input type="number" min="0" class="bk-cell" data-ri="${ri}" data-ci="${ci}" value="${r.values[ci] != null ? r.values[ci] : ''}" style="width:52px;text-align:center;" ${perm.canEdit ? '' : 'readonly'}></td>`).join('')}
          <td class="bk-rowtot" style="text-align:right;font-weight:600;min-width:60px;">${fmtNumber(totalOfRow(r))}</td>
          <td><input class="bk-ghichu" data-ri="${ri}" value="${escapeHtml(r.ghiChu || '')}" style="width:120px;" ${perm.canEdit ? '' : 'readonly'}></td>
          <td>${perm.canEdit ? `<button type="button" class="btn small danger bk-delrow" data-ri="${ri}">X</button>` : ''}</td>
        </tr>`).join('') || `<tr><td colspan="${state.cols.length + 5}" class="empty-hint">Chưa có màu — bấm "Điền màu từ Cắt" hoặc "+ Màu".</td></tr>`;
      const grandTotal = state.rows.reduce((s, r) => s + totalOfRow(r), 0);
      gridBox.innerHTML = `<table border="1" cellpadding="3" style="border-collapse:collapse;">
        <thead><tr><th style="width:38px;">STT</th><th>Màu vải chính</th>${headSizes}<th>Tổng cộng</th><th>Ghi chú</th><th></th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td></td><td style="text-align:right;font-weight:700;">Tổng cộng</td><td colspan="${state.cols.length}"></td><td style="text-align:right;font-weight:700;">${fmtNumber(grandTotal)}</td><td colspan="2"></td></tr></tfoot>
      </table>
      ${perm.canEdit ? '<button type="button" class="btn small secondary" id="btnAddRow" style="margin-top:6px;">+ Màu (thủ công)</button>' : ''}`;
      wireGrid();
    }
    function syncGrid() {
      gridBox.querySelectorAll('.bk-colname').forEach(inp => { state.cols[Number(inp.dataset.ci)] = inp.value; });
      gridBox.querySelectorAll('.bk-cell').forEach(inp => { const r = state.rows[Number(inp.dataset.ri)]; if (r) r.values[Number(inp.dataset.ci)] = inp.value; });
      gridBox.querySelectorAll('.bk-ghichu').forEach(inp => { const r = state.rows[Number(inp.dataset.ri)]; if (r) r.ghiChu = inp.value; });
    }
    function wireGrid() {
      gridBox.querySelectorAll('.bk-cell').forEach(inp => inp.addEventListener('input', () => {
        const r = state.rows[Number(inp.dataset.ri)]; if (!r) return; r.values[Number(inp.dataset.ci)] = inp.value;
        const tr = inp.closest('tr'); if (tr) tr.querySelector('.bk-rowtot').textContent = fmtNumber(totalOfRow(r));
      }));
      gridBox.querySelectorAll('.bk-delcol').forEach(b => b.addEventListener('click', () => { syncGrid(); const ci = Number(b.dataset.ci); state.cols.splice(ci, 1); state.rows.forEach(r => r.values.splice(ci, 1)); renderGrid(); }));
      gridBox.querySelectorAll('.bk-delrow').forEach(b => b.addEventListener('click', () => { syncGrid(); state.rows.splice(Number(b.dataset.ri), 1); renderGrid(); }));
      const addRow = gridBox.querySelector('#btnAddRow');
      if (addRow) addRow.addEventListener('click', () => { syncGrid(); const ten = prompt('Tên màu:'); if (ten && ten.trim()) { state.rows.push({ mauSacId: null, tenMau: ten.trim(), ghiChu: '', values: state.cols.map(() => '') }); renderGrid(); } });
    }
    renderGrid();

    modal.querySelector('#btnAddSize')?.addEventListener('click', () => { syncGrid(); const ten = prompt('Tên size (cột):', ''); state.cols.push(ten != null ? ten : ''); state.rows.forEach(r => r.values.push('')); renderGrid(); });
    modal.querySelector('#btnDienMau')?.addEventListener('click', () => {
      syncGrid();
      if (!prefill.length) { toast('Chưa có dữ liệu Cắt (màu chính) cho đơn này.', 'error'); return; }
      // Them cac mau chua co; dien so lop vao TAT CA cac o size cua hang do.
      prefill.forEach(p => {
        let row = state.rows.find(r => (p.mauSacId != null && String(r.mauSacId) === String(p.mauSacId)) || (r.tenMau === p.tenMau));
        if (!row) { row = { mauSacId: p.mauSacId, tenMau: p.tenMau, ghiChu: '', values: state.cols.map(() => '') }; state.rows.push(row); }
        row.values = state.cols.map(() => String(p.soLop || ''));
      });
      renderGrid();
      // v6.00: nói rõ đã gộp bao nhiêu sổ cắt để người dùng biết là lấy ĐỦ, không phải chỉ lần cắt cuối.
      const soSo = Math.max(...prefill.map(p => Number(p.soSoCat) || 0), 0);
      toast(`Đã điền màu + số lớp VẢI CHÍNH từ ${soSo ? soSo + ' sổ cắt' : 'sổ cắt'} của lệnh này.`, 'success');
    });
    modal.querySelector('#btnSizeTsd')?.addEventListener('click', () => {
      syncGrid();
      state.cols = sizeCols.slice();
      state.rows.forEach(r => { r.values = state.cols.map((c, i) => (r.values[i] != null ? r.values[i] : '')); });
      renderGrid(); toast('Đã lấy cột size từ Thông số đo.', 'success');
    });
    modal.querySelector('#btnApMau')?.addEventListener('click', async () => {
      const sel = modal.querySelector('#bkMauSelect');   // v5.44.6: chọn mẫu từ dropdown (bỏ prompt ID)
      const pick = sel ? sel.value : '';
      if (!pick) { toast('Hãy chọn một mẫu trong danh sách.', 'error'); return; }
      try {
        const m = (await apiGet('/api/bangke/mau/' + Number(pick))).data;
        syncGrid();
        state.cols = Array.isArray(m.cols) && m.cols.length ? [...m.cols] : state.cols;
        state.rows.forEach(r => { r.values = state.cols.map((c, i) => (r.values[i] != null ? r.values[i] : '')); });
        renderGrid(); toast('Đã áp cột size từ mẫu.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });

    const btnLuuMau = modal.querySelector('#btnLuuMau');
    if (btnLuuMau) btnLuuMau.addEventListener('click', async () => {
      syncGrid(); const ten = prompt('Tên mẫu (chỉ lưu danh sách cột size):'); if (!ten || !ten.trim()) return;
      try { await apiPost('/api/bangke/mau/create', { tenMau: ten.trim(), cols: state.cols }); toast('Đã lưu mẫu.', 'success'); } catch (err) { toast(err.message, 'error'); }
    });
    const btnQlMauBtp = modal.querySelector('#btnQlMauBtp');
    if (btnQlMauBtp) btnQlMauBtp.addEventListener('click', openBtpMauManager);
    modal.querySelector('#btnPrintBk').addEventListener('click', () => {
      syncGrid(); const fd = new FormData(modal.querySelector('#bkForm'));
      printBangKe({   // v5.57: bản in kèm Tên SP + Mã rập + tên bản
        maHang: fd.get('maHang'), ngayCapNhat: fd.get('ngayCapNhat'), ghiChu: fd.get('ghiChu'),
        cols: state.cols, rows: state.rows, anh: order.AnhSanPham,
        tenSanPham: order.TenSanPham, maRap: order.MaRap, tenBan: (fd.get('tenBan') || '').trim()
      }, maDH);
    });

    modal.querySelector('#bkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!perm.canEdit) return;
      syncGrid();
      const fd = new FormData(e.target);
      try {
        await apiPost('/api/bangke/' + maDH, { maHang: fd.get('maHang'), ten: (fd.get('tenBan') || '').trim(), oldTen: tenPhieu, ngayCapNhat: fd.get('ngayCapNhat'), ghiChu: fd.get('ghiChu'), cols: state.cols, rows: state.rows });
        closeModal(); toast('Đã lưu bảng kê.', 'success'); if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.45: Quản lý mẫu BTP (list + Sửa đổi tên + Xóa) — giống Quản lý mẫu tài liệu.
  async function openBtpMauManager() {
    const list = (await apiGet('/api/bangke/mau/list')).data || [];
    const modal = openModal(`<h3>Quản lý mẫu — Bảng kê BTP</h3>
      <table><thead><tr><th style="text-align:center;">Tên mẫu</th><th style="width:150px"></th></tr></thead>
      <tbody>${list.map(m => `<tr><td style="text-align:center;">${escapeHtml(m.TenMau)}</td><td style="white-space:nowrap;">${perm.canEdit ? `<button class="btn small secondary bmm-edit" data-id="${m.ID}" data-ten="${escapeHtml(m.TenMau)}">Sửa</button> ` : ''}${perm.canDelete ? `<button class="btn small danger bmm-del" data-id="${m.ID}">Xóa</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="2" class="empty-hint">Chưa có mẫu</td></tr>'}</tbody></table>
      <div class="modal-actions"><button type="button" class="btn secondary" id="bmmClose">Đóng</button></div>`);
    modal.querySelector('#bmmClose').addEventListener('click', closeModal);
    modal.querySelectorAll('.bmm-edit').forEach(b => b.addEventListener('click', async () => {
      const ten = prompt('Đổi tên mẫu:', b.dataset.ten || '');
      if (ten == null) return;
      if (!ten.trim()) { toast('Tên mẫu không được để trống.', 'error'); return; }
      try { await apiPut('/api/bangke/mau/' + b.dataset.id, { tenMau: ten.trim() }); toast('Đã đổi tên.', 'success'); openBtpMauManager(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    modal.querySelectorAll('.bmm-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa mẫu này?')) return;
      try { await apiDelete('/api/bangke/mau/' + b.dataset.id); toast('Đã xóa.', 'success'); openBtpMauManager(); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  function buildBangKeBodyHtml(d) {
    const anh = d.anh ? `<img src="${escapeHtml(d.anh)}" style="width:90px;height:90px;object-fit:cover;float:right;">` : '';
    const grand = (d.rows || []).reduce((s, r) => s + totalOfRow(r), 0);
    return `
      <h2 style="text-align:center;">BẢNG KÊ BÁN THÀNH PHẨM</h2>
      ${anh}
      <p><b>Mã hàng:</b> ${escapeHtml(d.maHang || '')} &nbsp; <b>Ngày:</b> ${d.ngayCapNhat ? fmtDate(d.ngayCapNhat) : ''}</p>
      <p><b>Tên sản phẩm:</b> ${escapeHtml(d.tenSanPham || '')} &nbsp; <b>Mã rập:</b> ${escapeHtml(d.maRap || '')}${d.tenBan ? ' &nbsp; <b>Bản:</b> ' + escapeHtml(d.tenBan) : ''}</p>
      ${d.ghiChu ? `<p><b>Ghi chú:</b> ${escapeHtml(d.ghiChu)}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4">
        <thead><tr><th style="width:38px;">STT</th><th>Màu vải chính</th>${(d.cols || []).map(c => `<th>${escapeHtml(c)}</th>`).join('')}<th>Tổng cộng</th><th>Ghi chú</th></tr></thead>
        <tbody>${(d.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.tenMau || '')}</td>${(d.cols || []).map((c, i) => `<td style="text-align:center;">${escapeHtml(String(r.values[i] != null ? r.values[i] : ''))}</td>`).join('')}<td style="text-align:right;font-weight:600;">${fmtNumber(totalOfRow(r))}</td><td>${escapeHtml(r.ghiChu || '')}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td></td><td style="text-align:right;font-weight:700;">Tổng cộng</td><td colspan="${(d.cols || []).length}"></td><td style="text-align:right;font-weight:700;">${fmtNumber(grand)}</td><td></td></tr></tfoot>
      </table>`;
  }
  function printBangKe(d, maDH) {
    printHtml('Bảng kê bán thành phẩm - ' + maDH, buildBangKeBodyHtml(d));
  }
  // v5.43: dựng HTML "Bảng kê BTP" của 1 đơn để in GỘP cùng tài liệu kỹ thuật (module.tailieukythuat gọi).
  // Trả null nếu đơn CHƯA CÓ bảng kê (để bỏ qua khi in). Map response /api/bangke/:maDH -> shape build.
  async function buildOrderSectionHtml(maDH, ten) {
    let res;
    // v5.57: +ten = dựng ĐÚNG 1 BẢN (bỏ trống = bản đầu tiên, giữ hành vi in gộp cũ). +Mã rập/Tên SP.
    const tenQ = (ten !== undefined && ten !== null) ? '?ten=' + encodeURIComponent(ten) : '';
    try { res = await apiGet('/api/bangke/' + encodeURIComponent(maDH) + tenQ); } catch (e) { return null; }
    if (!res || !res.data) return null;
    const order = res.order || {};
    const d = res.data;
    return buildBangKeBodyHtml({
      maHang: d.MaHang || order.MaSanPham || maDH, ngayCapNhat: d.NgayCapNhat, ghiChu: d.GhiChu,
      cols: d.cols || [], rows: d.rows || [], anh: order.AnhSanPham,
      tenSanPham: order.TenSanPham, maRap: order.MaRap, tenBan: ten || ''
    });
  }

  async function openMauManager() {
    const list = (await apiGet('/api/bangke/mau/list')).data || [];
    const modal = openModal(`<h3>Tài liệu mẫu — Bảng kê BTP</h3>
      <p style="font-size:13px;color:#5f6368;">Mẫu chỉ lưu danh sách cột size (tạo mẫu từ trong màn lập bảng kê).</p>
      <table><thead><tr><th>Tên mẫu</th><th style="width:80px"></th></tr></thead>
      <tbody>${list.map(m => `<tr><td>${escapeHtml(m.TenMau)}</td><td>${perm.canDelete ? `<button class="btn small danger bkm-del" data-id="${m.ID}">Xóa</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="2" class="empty-hint">Chưa có mẫu</td></tr>'}</tbody></table>
      <div class="modal-actions"><button type="button" class="btn secondary" id="bkmClose">Đóng</button></div>`);
    modal.querySelector('#bkmClose').addEventListener('click', closeModal);
    modal.querySelectorAll('.bkm-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa mẫu này?')) return;
      try { await apiDelete('/api/bangke/mau/' + b.dataset.id); toast('Đã xóa.', 'success'); openMauManager(); } catch (err) { toast(err.message, 'error'); }
    }));
  }

  return { render, buildOrderSectionHtml };
})();
