// ================================================================
// MODULE: XUAT VAT TU (VATTU) - v5.28 (item 2)
// Gop "Phieu xuat kho vai" + "Phieu xuat phu kien" thanh 1 "Phieu xuat Vat tu": 1 phieu xuat CHUNG
// vai CHINH + vai PHOI (theo cay, KG) + PHU KIEN/NPL (theo so luong). Vai chinh mang mau THAT (tu cay
// vai) -> chinh la khoa theo doi tien do Cat/May/Kho theo mau (getVaiCayDaXuatChoDon o qlsx.js da union
// PhieuXuatVatTuVai). Man hinh "Phieu xuat kho vai"/"Phieu xuat phu kien" cu duoc doi thanh CHI-XEM lich su
// (tab doi ten "(cu)", da bo nut tao moi) - route + du lieu giu nguyen. Theo mau roll-picker (module.khovai)
// + pk-picker (module.phukien).
// ================================================================
window.ModuleVATTU = (function () {
  let currentUser = null;
  let container = null;   // luu lai de re-render list sau khi tao phieu (giong module.khovai)
  let vseq = 0, pseq = 0;

  function rawPermOf(user) {
    return user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.VATTU || { canView: false, canCreate: false, canEdit: false, canDelete: false });
  }
  function getTabs(user) {
    const perm = effectivePerm(user, 'VATTU', 'xuatvattu', rawPermOf(user));
    if (!perm.canView) return [];
    // key = 'xuatvattu' khop MaChucNang da seed (migration_v528) de he thong an/hien chuc nang (VATTU:xuatvattu) hoat dong dung
    return [{ key: 'xuatvattu', label: 'Phiếu xuất vật tư' }];
  }

  function rollLabel(r) {
    const viTri = r.ViTriKho ? `, vị trí ${r.ViTriKho}` : '';
    const ngay = r.NgayNhap ? `, nhập ${new Date(r.NgayNhap).toLocaleDateString('vi-VN')}` : '';
    return `${r.MaCay} — ${r.TenLoaiVai || ''} ${r.TenMau || ''} — còn ${fmtNumber(r.KGCon)} KG${viTri}${ngay}`;
  }
  function pkLabel(p) {
    const size = p.Size ? ` (${escapeHtml(p.Size)})` : '';
    return `${p.MaPhuKien} - ${p.TenPhuKien}${size} — tồn ${fmtNumber(p.TonKho)} ${p.DonViCoBan || ''}`;
  }

  async function render(el, user) {
    container = el; currentUser = user;
    const perm = effectivePerm(user, 'VATTU', 'xuatvattu', rawPermOf(user));
    container.innerHTML = `<div class="tab-body" id="vtBody"></div>`;
    const rows = (await apiGet('/api/vattu/xuat')).data;
    const body = document.getElementById('vtBody');
    body.innerHTML = `
      <div class="card">
        <div class="toolbar">${perm.canCreate ? '<button class="btn" id="btnAddVt">+ Tạo phiếu xuất vật tư</button>' : ''}</div>
        <table>
          <thead><tr><th>Số phiếu</th><th>Ngày xuất</th><th>Mã đơn</th><th>Đơn hàng SX</th><th>Người nhận</th>
            <th>Số cây vải</th><th>Tổng KG vải</th><th>Số dòng PK</th><th style="width:150px">Thao tác</th></tr></thead>
          <tbody>${rows.map(r => `<tr>
            <td>PXVT-${r.PhieuVatTuID}</td>
            <td>${fmtDate(r.NgayXuat)}</td>
            <td>${escapeHtml(r.MaDon || '')}</td>
            <td>${escapeHtml(r.MaDH || '')}</td>
            <td>${escapeHtml(r.NguoiNhan || '')}</td>
            <td style="text-align:right;">${r.SoDongVai || 0}</td>
            <td style="text-align:right;">${fmtNumber(r.TongKGVai)}</td>
            <td style="text-align:right;">${r.SoDongPK || 0}</td>
            <td><button class="btn small secondary act-view" data-id="${r.PhieuVatTuID}">Xem</button>
              ${perm.canDelete ? `<button class="btn small danger act-del" data-id="${r.PhieuVatTuID}">Xóa</button>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Chưa có phiếu xuất vật tư nào</td></tr>'}</tbody>
        </table>
      </div>`;
    if (perm.canCreate) document.getElementById('btnAddVt').addEventListener('click', openCreateModal);
    body.querySelectorAll('.act-view').forEach(btn => btn.addEventListener('click', () => openDetailModal(btn.dataset.id)));
    body.querySelectorAll('.act-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu xuất vật tư này? Tồn kho vải/phụ kiện sẽ được trả lại.')) return;
      try { await apiDelete('/api/vattu/xuat/' + btn.dataset.id); toast('Đã xóa.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function openCreateModal() {
    const [rollsRes, pkRes, ordersRes] = await Promise.all([
      apiGet('/api/vattu/rolls'), apiGet('/api/vattu/phukien'), apiGet('/api/vattu/orders')
    ]);
    const rolls = rollsRes.data, phuKiens = pkRes.data, orders = ordersRes.data;

    function vaiRowHtml(preCay) {
      vseq++;
      const idx = vseq;
      return `<div class="form-grid" style="grid-template-columns:auto 4fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;" data-vrow data-idx="${idx}">
        <div><label>Kiểu</label><select class="v-kieu"><option value="Chính">Chính</option><option value="Phối">Phối</option></select></div>
        <div><label>Mã cây</label>${rolls.length ? searchableSelectHtml('vtcay_' + idx, rolls, 'CayID', rollLabel, preCay || null) : '<input disabled placeholder="-- Không còn cây vải tồn kho --">'}</div>
        <div><label>KG xuất *</label><input class="v-kg" type="number" step="0.01" min="0"></div>
        <div><button type="button" class="btn small danger v-remove">X</button></div>
      </div>`;
    }
    function pkRowHtml() {
      pseq++;
      const rid = pseq;
      return `<div class="form-grid" style="grid-template-columns:2fr .8fr .8fr 1.3fr auto;gap:8px;align-items:end;margin-bottom:8px;" data-prow data-rid="${rid}">
        <div><label>Phụ kiện (gõ để tìm)</label>${phuKiens.length ? searchableSelectHtml('vtpk_' + rid, phuKiens, 'PhuKienID', pkLabel) : '<input disabled placeholder="-- Không có phụ kiện --">'}</div>
        <div><label>Số lượng *</label><input class="p-sl" type="number" step="0.01" min="0"></div>
        <div><label>ĐVT</label><input class="p-dvt"></div>
        <div><label>Ghi chú</label><input class="p-ghichu"></div>
        <div><button type="button" class="btn small danger p-remove">X</button></div>
      </div>`;
    }

    const modal = openModal(`
      <h3>Tạo phiếu xuất vật tư (vải chính + vải phối + phụ kiện)</h3>
      <form id="vtForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày xuất *</label><input type="date" name="ngayXuat" value="${new Date().toISOString().slice(0, 10)}" required></div>
          <div class="form-row"><label>Đơn hàng sản xuất</label>
            <select name="donHangId" id="vtOrder">
              <option value="">-- Xuất tự do (không gắn đơn hàng) --</option>
              ${orders.map(o => `<option value="${o.DonHangID}">${escapeHtml(o.MaDH + (o.TenSanPham ? ' - ' + o.TenSanPham : ''))}</option>`).join('')}
            </select>
          </div>
          <div class="form-row"><label>Mã đơn</label><input name="maDon" id="vtMaDon"></div>
          <div class="form-row"><label>Người nhận</label><input name="nguoiNhan"></div>
          <div class="form-row"><label>Mục đích</label><input name="mucDich"></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu"></div>
        </div>
        <p style="font-size:12px;color:#5f6368;margin:6px 0 2px;">Gắn đơn hàng để công đoạn Cắt/May theo dõi tiến độ theo <b>màu vải chính</b> của phiếu này.</p>

        <h4 style="margin:14px 0 6px;">Vải (chính + phối)</h4>
        <div id="vtVaiRows">${rolls.length ? vaiRowHtml() : ''}</div>
        <div class="empty-hint" style="${rolls.length ? 'display:none;' : ''}">Không còn cây vải nào trong kho để xuất</div>
        <button type="button" class="btn small secondary" id="btnAddVai" style="${rolls.length ? '' : 'display:none;'}">+ Thêm cây vải</button>

        <h4 style="margin:14px 0 6px;">Phụ kiện / NPL</h4>
        <div id="vtPkRows">${phuKiens.length ? pkRowHtml() : ''}</div>
        <div class="empty-hint" style="${phuKiens.length ? 'display:none;' : ''}">Chưa có phụ kiện trong danh mục</div>
        <button type="button" class="btn small secondary" id="btnAddPk2" style="${phuKiens.length ? '' : 'display:none;'}">+ Thêm phụ kiện</button>

        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancelVt">Hủy</button>
          <button type="submit" class="btn">Lưu phiếu xuất</button>
        </div>
      </form>`);
    modal.querySelector('#btnCancelVt').addEventListener('click', closeModal);

    // Order -> auto fill Ma don
    modal.querySelector('#vtOrder').addEventListener('change', (e) => {
      const o = orders.find(x => String(x.DonHangID) === e.target.value);
      const m = modal.querySelector('#vtMaDon');
      m.value = o ? o.MaDH : ''; m.readOnly = !!o;
    });

    function wireVaiRow(row) {
      const idx = row.dataset.idx;
      if (rolls.length) wireSearchableSelect('vtcay_' + idx, rolls, 'CayID', rollLabel);
      row.querySelector('.v-remove').onclick = () => { if (modal.querySelectorAll('#vtVaiRows > [data-vrow]').length > 1) row.remove(); };
    }
    function wirePkRow(row) {
      const rid = row.dataset.rid;
      if (phuKiens.length) wireSearchableSelect('vtpk_' + rid, phuKiens, 'PhuKienID', pkLabel, (match) => {
        if (match) row.querySelector('.p-dvt').value = match.DonViCoBan || '';
      });
      row.querySelector('.p-remove').onclick = () => { if (modal.querySelectorAll('#vtPkRows > [data-prow]').length > 1) row.remove(); };
    }
    modal.querySelectorAll('#vtVaiRows [data-vrow]').forEach(wireVaiRow);
    modal.querySelectorAll('#vtPkRows [data-prow]').forEach(wirePkRow);

    const addVaiBtn = modal.querySelector('#btnAddVai');
    if (addVaiBtn) addVaiBtn.addEventListener('click', () => {
      modal.querySelector('#vtVaiRows').insertAdjacentHTML('beforeend', vaiRowHtml());
      wireVaiRow(modal.querySelector('#vtVaiRows > [data-vrow]:last-child'));
    });
    const addPkBtn = modal.querySelector('#btnAddPk2');
    if (addPkBtn) addPkBtn.addEventListener('click', () => {
      modal.querySelector('#vtPkRows').insertAdjacentHTML('beforeend', pkRowHtml());
      wirePkRow(modal.querySelector('#vtPkRows > [data-prow]:last-child'));
    });

    modal.querySelector('#vtForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const vai = Array.from(modal.querySelectorAll('#vtVaiRows > [data-vrow]')).map(r => ({
        cayId: getSearchableValue('vtcay_' + r.dataset.idx),
        kieuVai: r.querySelector('.v-kieu').value,
        kgXuat: r.querySelector('.v-kg').value
      })).filter(r => r.cayId && Number(r.kgXuat) > 0);
      const phuKien = Array.from(modal.querySelectorAll('#vtPkRows > [data-prow]')).map(r => ({
        phuKienId: getSearchableValue('vtpk_' + r.dataset.rid),
        soLuong: r.querySelector('.p-sl').value,
        donVi: r.querySelector('.p-dvt').value,
        ghiChu: r.querySelector('.p-ghichu').value
      })).filter(r => r.phuKienId && Number(r.soLuong) > 0);
      if (!vai.length && !phuKien.length) { toast('Phiếu chưa có dòng vải hoặc phụ kiện hợp lệ.', 'error'); return; }
      try {
        const res = await apiPost('/api/vattu/xuat', {
          ngayXuat: fd.get('ngayXuat'), maDon: fd.get('maDon'), donHangId: fd.get('donHangId') || null,
          nguoiNhan: fd.get('nguoiNhan'), mucDich: fd.get('mucDich'), ghiChu: fd.get('ghiChu'), vai, phuKien
        });
        toast('Đã tạo phiếu xuất vật tư.', 'success');
        closeModal();
        await render(container, currentUser);
        openDetailModal(res.data.phieuVatTuId);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function openDetailModal(id) {
    const res = await apiGet('/api/vattu/xuat/' + id);
    const d = res.data;
    const bodyHtml = detailBodyHtml(d);
    const modal = openModal(`
      <h3>Phiếu xuất vật tư PXVT-${d.PhieuVatTuID}</h3>
      ${bodyHtml}
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnCloseVtd">Đóng</button>
        <button type="button" class="btn" id="btnPrintVt">🖨️ In phiếu</button>
      </div>`);
    modal.querySelector('#btnCloseVtd').addEventListener('click', closeModal);
    modal.querySelector('#btnPrintVt').addEventListener('click', () => printHtml('Phiếu xuất vật tư PXVT-' + d.PhieuVatTuID, printBodyHtml(d)));
  }

  function detailBodyHtml(d) {
    const vaiRows = (d.vai || []).map(v => `<tr>
      <td>${escapeHtml(v.KieuVai || '')}</td><td>${escapeHtml(v.MaCay || '')}</td>
      <td>${escapeHtml((v.TenLoaiVai || '') + ' ' + (v.TenMau || ''))}</td>
      <td style="text-align:right;">${fmtNumber(v.KGXuat)}</td></tr>`).join('')
      || '<tr><td colspan="4" class="empty-hint">Không có dòng vải</td></tr>';
    const pkRows = (d.phuKien || []).map(k => `<tr>
      <td>${escapeHtml(k.MaPhuKien || '')}</td><td>${escapeHtml(k.TenPhuKien || '')}</td>
      <td style="text-align:right;">${fmtNumber(k.SoLuong)}</td><td>${escapeHtml(k.DonVi || '')}</td>
      <td>${escapeHtml(k.GhiChu || '')}</td></tr>`).join('')
      || '<tr><td colspan="5" class="empty-hint">Không có dòng phụ kiện</td></tr>';
    return `
      <div class="form-grid" style="margin-bottom:10px;">
        <div class="form-row"><label>Ngày xuất</label><div>${fmtDate(d.NgayXuat)}</div></div>
        <div class="form-row"><label>Mã đơn</label><div>${escapeHtml(d.MaDon || '')}</div></div>
        <div class="form-row"><label>Đơn hàng SX</label><div>${escapeHtml(d.MaDH || '')}</div></div>
        <div class="form-row"><label>Người nhận</label><div>${escapeHtml(d.NguoiNhan || '')}</div></div>
        <div class="form-row"><label>Mục đích</label><div>${escapeHtml(d.MucDich || '')}</div></div>
        <div class="form-row"><label>Ghi chú</label><div>${escapeHtml(d.GhiChu || '')}</div></div>
      </div>
      <h4 style="margin:8px 0 4px;">Vải</h4>
      <table><thead><tr><th>Kiểu</th><th>Mã cây</th><th>Loại vải / Màu</th><th>KG xuất</th></tr></thead><tbody>${vaiRows}</tbody></table>
      <h4 style="margin:10px 0 4px;">Phụ kiện / NPL</h4>
      <table><thead><tr><th>Mã PK</th><th>Tên phụ kiện</th><th>Số lượng</th><th>ĐVT</th><th>Ghi chú</th></tr></thead><tbody>${pkRows}</tbody></table>`;
  }

  function printBodyHtml(d) {
    const vaiRows = (d.vai || []).map(v => `<tr>
      <td>${escapeHtml(v.KieuVai || '')}</td><td>${escapeHtml(v.MaCay || '')}</td>
      <td>${escapeHtml((v.TenLoaiVai || '') + ' ' + (v.TenMau || ''))}</td>
      <td style="text-align:right;">${fmtNumber(v.KGXuat)}</td></tr>`).join('');
    const pkRows = (d.phuKien || []).map(k => `<tr>
      <td>${escapeHtml(k.MaPhuKien || '')}</td><td>${escapeHtml(k.TenPhuKien || '')}</td>
      <td style="text-align:right;">${fmtNumber(k.SoLuong)}</td><td>${escapeHtml(k.DonVi || '')}</td>
      <td>${escapeHtml(k.GhiChu || '')}</td></tr>`).join('');
    return `
      <h2 style="text-align:center;margin:0 0 4px;">PHIẾU XUẤT VẬT TƯ</h2>
      <p style="text-align:center;margin:0 0 10px;">Số phiếu: PXVT-${d.PhieuVatTuID} &nbsp;|&nbsp; Ngày xuất: ${fmtDate(d.NgayXuat)}</p>
      <p style="margin:2px 0;"><b>Mã đơn:</b> ${escapeHtml(d.MaDon || '')} &nbsp;&nbsp; <b>Đơn hàng SX:</b> ${escapeHtml(d.MaDH || '')}</p>
      <p style="margin:2px 0;"><b>Người nhận:</b> ${escapeHtml(d.NguoiNhan || '')} &nbsp;&nbsp; <b>Mục đích:</b> ${escapeHtml(d.MucDich || '')}</p>
      ${vaiRows ? `<h3 style="margin:10px 0 4px;">Vải</h3>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4">
        <thead><tr><th>Kiểu</th><th>Mã cây</th><th>Loại vải / Màu</th><th>KG xuất</th></tr></thead>
        <tbody>${vaiRows}</tbody></table>` : ''}
      ${pkRows ? `<h3 style="margin:10px 0 4px;">Phụ kiện / NPL</h3>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4">
        <thead><tr><th>Mã PK</th><th>Tên phụ kiện</th><th>Số lượng</th><th>ĐVT</th><th>Ghi chú</th></tr></thead>
        <tbody>${pkRows}</tbody></table>` : ''}
      <div style="display:flex;justify-content:space-around;margin-top:40px;text-align:center;">
        <div>Người lập phiếu<br><br><br>____________</div>
        <div>Thủ kho<br><br><br>____________</div>
        <div>Người nhận<br><br><br>____________</div>
      </div>`;
  }

  return { render, getTabs };
})();
