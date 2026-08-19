// ================================================================
// PHAN HE QUAN LY NHAN SU (HRM) - v6.0 Phase 1
// ----------------------------------------------------------------
// 5 chuc nang (tab): Ho so nhan su, Hop dong lao dong, Phu luc hop dong, Quyet dinh
// nhan su, Thanh ly hop dong. Dung CHUNG bang NhanVien voi Danh muc>Nhan vien (module
// DANHMUC) - mo rong them cot ho so (xem migration_v600.sql), KHONG tao bang nhan vien moi.
// In hop dong / quyet dinh: dung lai printHtml() (iframe in - xem common.js), khong can
// thu vien docx phia server; van ban theo mau chuan (tham khao HD/PL/QDTL/QDTV trong file
// luong.xlsm cua cong ty).
// ================================================================
window.ModuleHRM = (function () {
  let container, currentUser, activeTab = 'hoso';
  let perm = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  let refs = null;              // { boPhan:[], nhanVien:[] } - cache cho dropdown
  let nhanVienCache = [];       // danh sach ho so (de loc tim client-side)

  // Thong tin doanh nghiep (lay tu sheet TTDN cua file luong.xlsm) - dung o dau van ban khi in.
  const COMPANY = {
    ten: 'CÔNG TY TNHH THỜI TRANG MOYN',
    mst: '0111266453',
    diaChi: 'Thôn Đại Tự, Xã Hoài Đức, Thành phố Hà Nội',
    giamDoc: ''   // de trong - dien tay khi in neu can
  };

  const LOAI_HOP_DONG = ['Thử việc', 'Xác định thời hạn', 'Không xác định thời hạn'];
  const TT_LAO_DONG = ['Thử việc', 'Chính thức', 'Đã nghỉ việc'];
  const TT_HOP_DONG = ['Hiệu lực', 'Hết hạn', 'Đã thanh lý'];
  const LOAI_QUYET_DINH = ['Tăng lương', 'Khen thưởng', 'Kỷ luật', 'Bổ nhiệm', 'Điều chuyển'];
  const TT_BAN_GIAO = ['Chưa bàn giao', 'Đang bàn giao', 'Đã bàn giao'];
  const GIOI_TINH = ['Nam', 'Nữ', 'Khác'];

  const TABS = [
    { key: 'hoso', label: 'Hồ sơ nhân sự' },
    { key: 'hopdong', label: 'Hợp đồng lao động' },
    { key: 'phuluc', label: 'Phụ lục hợp đồng' },
    { key: 'quyetdinh', label: 'Quyết định nhân sự' },
    { key: 'thanhly', label: 'Thanh lý hợp đồng' }
  ];

  function getTabs() { return TABS; }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.HRM || {});
    perm = effectivePerm(user, 'HRM', activeTab, rawPerm);
    if (!refs) { try { refs = (await apiGet('/api/hrm/refs')).data; } catch (e) { refs = { boPhan: [], nhanVien: [] }; } }
    if (activeTab === 'hoso') return renderHoSo();
    if (activeTab === 'hopdong') return renderHopDong();
    if (activeTab === 'phuluc') return renderPhuLuc();
    if (activeTab === 'quyetdinh') return renderQuyetDinh();
    if (activeTab === 'thanhly') return renderThanhLy();
  }

  async function reloadRefs() { try { refs = (await apiGet('/api/hrm/refs')).data; } catch (e) { /* giu cache cu */ } }

  // ---- Helpers chung ----
  const dInput = (v) => (v ? String(v).slice(0, 10) : '');                  // ISO -> yyyy-mm-dd cho <input date>
  const money = (v) => (v == null || v === '' ? '' : fmtNumber(Number(v))); // hien thi tien
  function selOpts(list, selected, valKey, txtFn) {
    return list.map(o => {
      const val = valKey ? o[valKey] : o;
      const txt = txtFn ? txtFn(o) : o;
      return `<option value="${escapeHtml(String(val))}" ${String(val) === String(selected == null ? '' : selected) ? 'selected' : ''}>${escapeHtml(String(txt))}</option>`;
    }).join('');
  }
  // Doc gia tri input trong modal theo id
  const val = (modal, id) => { const e = modal.querySelector('#' + id); return e ? e.value.trim() : ''; };

  /* ================================================================
     1. HO SO NHAN SU
     ================================================================ */
  async function renderHoSo() {
    const body = container;
    body.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    try { nhanVienCache = (await apiGet('/api/hrm/nhanvien')).data || []; }
    catch (e) { body.innerHTML = `<div class="empty-hint">Lỗi tải dữ liệu: ${escapeHtml(e.message)}</div>`; return; }
    body.innerHTML = `
      <div class="hrm-toolbar" style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
        ${perm.canCreate ? `<button class="btn" id="btnAddNV">➕ Thêm nhân viên</button>` : ''}
        ${perm.canCreate ? `<a class="btn secondary" href="/api/hrm/nhanvien/template">⬇️ File mẫu</a><button class="btn secondary" id="btnImportNV">⬆️ Tải lên (file có sẵn)</button><input type="file" id="fileNV" accept=".xlsx,.xls" style="display:none;">` : ''}
        <input type="text" id="nvSearch" placeholder="🔍 Tìm theo mã / tên / SĐT..." style="flex:1;min-width:220px;">
        <span class="hrm-count" style="color:#5f6368;font-size:13px;">Tổng: ${nhanVienCache.length}</span>
      </div>
      <div id="nvTableWrap"></div>`;
    const btnAdd = body.querySelector('#btnAddNV');
    if (btnAdd) btnAdd.addEventListener('click', () => openNhanVienForm(null));
    // v5.38: tải lên file nhân sự có sẵn (upsert theo Mã NV).
    const btnImp = body.querySelector('#btnImportNV'); const fImp = body.querySelector('#fileNV');
    if (btnImp && fImp) {
      btnImp.addEventListener('click', () => fImp.click());
      fImp.addEventListener('change', async () => {
        const file = fImp.files[0]; if (!file) return;
        const fd = new FormData(); fd.append('file', file);
        try {
          const res = await fetch('/api/hrm/nhanvien/import', { method: 'POST', credentials: 'same-origin', body: fd });
          const data = await res.json(); if (!data.success) throw new Error(data.message || 'Lỗi import.');
          toast(`Đã nhập: thêm ${data.data.inserted}, cập nhật ${data.data.updated}${data.data.skipped ? ', bỏ ' + data.data.skipped : ''}.`, 'success'); renderHoSo();
        } catch (e) { toast(e.message, 'error'); }
      });
    }
    const search = body.querySelector('#nvSearch');
    search.addEventListener('input', () => drawNvTable(search.value.trim().toLowerCase()));
    drawNvTable('');
  }

  function drawNvTable(q) {
    const wrap = document.getElementById('nvTableWrap');
    if (!wrap) return;
    const rows = !q ? nhanVienCache : nhanVienCache.filter(nv =>
      (nv.MaNhanVien || '').toLowerCase().includes(q) ||
      (nv.HoTen || '').toLowerCase().includes(q) ||
      (nv.SDT || '').toLowerCase().includes(q));
    wrap.innerHTML = `
      <table><thead><tr>
        <th>Mã NV</th><th>Họ và tên</th><th>Giới tính</th><th>Ngày sinh</th><th>Bộ phận</th>
        <th>Chức vụ</th><th>Trạng thái</th><th>SĐT</th><th style="width:230px">Thao tác</th>
      </tr></thead><tbody>${rows.map(nv => `<tr>
        <td>${escapeHtml(nv.MaNhanVien || '')}</td>
        <td>${escapeHtml(nv.HoTen || '')}</td>
        <td>${escapeHtml(nv.GioiTinh || '')}</td>
        <td>${fmtDate(nv.NgaySinh)}</td>
        <td>${escapeHtml(nv.TenBoPhan || '')}</td>
        <td>${escapeHtml(nv.ChucVu || '')}</td>
        <td>${statusBadge(nv.TrangThaiLaoDong)}</td>
        <td>${escapeHtml(nv.SDT || '')}</td>
        <td>
          <button class="btn small secondary act-view" data-id="${nv.NhanVienID}">Hồ sơ</button>
          ${perm.canEdit ? `<button class="btn small secondary act-edit" data-id="${nv.NhanVienID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger act-del" data-id="${nv.NhanVienID}">Xóa</button>` : ''}
        </td></tr>`).join('') || `<tr><td colspan="9" class="empty-hint">Không có nhân viên nào.</td></tr>`}</tbody></table>`;
    wrap.querySelectorAll('.act-view').forEach(b => b.addEventListener('click', () => openNhanVienDetail(b.dataset.id)));
    wrap.querySelectorAll('.act-edit').forEach(b => b.addEventListener('click', () => openNhanVienForm(b.dataset.id)));
    wrap.querySelectorAll('.act-del').forEach(b => b.addEventListener('click', () => deleteNhanVien(b.dataset.id)));
  }

  function statusBadge(tt) {
    const color = tt === 'Chính thức' ? '#137333' : tt === 'Thử việc' ? '#b06000' : tt === 'Đã nghỉ việc' ? '#a50e0e' : '#5f6368';
    return `<span style="color:${color};font-weight:600;">${escapeHtml(tt || '')}</span>`;
  }

  async function openNhanVienForm(id) {
    let nv = {};
    if (id) { try { nv = (await apiGet('/api/hrm/nhanvien/' + id)).data || {}; } catch (e) { toast(e.message, 'error'); return; } }
    const grp = (title, inner) => `<fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;margin:0 0 12px;">
      <legend style="font-weight:600;padding:0 6px;color:#1a73e8;">${title}</legend>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">${inner}</div></fieldset>`;
    const f = (label, inner) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}</div>`;
    const html = `
      <h3>${id ? 'Sửa hồ sơ nhân sự' : 'Thêm nhân viên mới'}</h3>
      <form id="nvForm">
        ${grp('Thông tin cá nhân', `
          ${f('Mã nhân viên', `<input id="f_maNV" value="${escapeHtml(nv.MaNhanVien || '')}" placeholder="${id ? '' : 'Tự động (NV001, NV002...)'}">`)}
          ${f('Họ và tên *', `<input id="f_hoTen" value="${escapeHtml(nv.HoTen || '')}" required>`)}
          ${f('Ngày sinh', `<input type="date" id="f_ngaySinh" value="${dInput(nv.NgaySinh)}">`)}
          ${f('Giới tính', `<select id="f_gioiTinh"><option value="">--</option>${selOpts(GIOI_TINH, nv.GioiTinh)}</select>`)}
          ${f('Số CMND/CCCD', `<input id="f_soCCCD" value="${escapeHtml(nv.SoCCCD || '')}">`)}
          ${f('Ngày cấp', `<input type="date" id="f_ngayCapCCCD" value="${dInput(nv.NgayCapCCCD)}">`)}
          ${f('Nơi cấp', `<input id="f_noiCapCCCD" value="${escapeHtml(nv.NoiCapCCCD || '')}">`)}
          ${f('Số điện thoại', `<input id="f_sdt" value="${escapeHtml(nv.SDT || '')}">`)}
          ${f('Email', `<input id="f_email" value="${escapeHtml(nv.Email || '')}">`)}
          ${f('Địa chỉ cư trú', `<input id="f_diaChi" value="${escapeHtml(nv.DiaChi || '')}">`)}
        `)}
        ${grp('Thông tin công việc', `
          ${f('Phòng ban / Tổ đội', `<select id="f_boPhan"><option value="">--</option>${selOpts(refs.boPhan, nv.BoPhanID, 'BoPhanID', o => o.TenBoPhan)}</select>`)}
          ${f('Chức vụ', `<input id="f_chucVu" value="${escapeHtml(nv.ChucVu || '')}">`)}
          ${f('Chuyên môn', `<input id="f_chuyenMon" value="${escapeHtml(nv.ChuyenMon || '')}">`)}
          ${f('Ngày vào làm', `<input type="date" id="f_ngayVao" value="${dInput(nv.NgayVao)}">`)}
          ${f('Trạng thái', `<select id="f_ttLaoDong">${selOpts(TT_LAO_DONG, nv.TrangThaiLaoDong || 'Thử việc')}</select>`)}
          ${f('Số người phụ thuộc', `<input type="number" id="f_npt" min="0" value="${nv.SoNguoiPhuThuoc != null ? nv.SoNguoiPhuThuoc : ''}">`)}
          ${f('Mã chấm công (trên máy)', `<input id="f_maChamCong" value="${escapeHtml(nv.MaChamCong || '')}" placeholder="VD: 5 — ID của người này trên máy chấm công">`)}
        `)}
        ${grp('Thông tin tài khoản / thuế / BHXH', `
          ${f('Số tài khoản ngân hàng', `<input id="f_stk" value="${escapeHtml(nv.SoTaiKhoanNH || '')}">`)}
          ${f('Tên ngân hàng', `<input id="f_tenNH" value="${escapeHtml(nv.TenNganHang || '')}">`)}
          ${f('Chi nhánh NH', `<input id="f_cnNH" value="${escapeHtml(nv.ChiNhanhNH || '')}">`)}
          ${f('Mã số thuế cá nhân', `<input id="f_mst" value="${escapeHtml(nv.MaSoThueCaNhan || '')}">`)}
          ${f('Ngày cấp MST', `<input type="date" id="f_ngayCapMST" value="${dInput(nv.NgayCapMST)}">`)}
          ${f('Số sổ BHXH', `<input id="f_bhxh" value="${escapeHtml(nv.SoSoBHXH || '')}">`)}
        `)}
        ${f('Ghi chú', `<textarea id="f_ghiChu" rows="2">${escapeHtml(nv.GhiChu || '')}</textarea>`)}
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">${id ? 'Lưu thay đổi' : 'Thêm nhân viên'}</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#nvForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        maNhanVien: val(modal, 'f_maNV'), hoTen: val(modal, 'f_hoTen'), ngaySinh: val(modal, 'f_ngaySinh'),
        gioiTinh: val(modal, 'f_gioiTinh'), soCCCD: val(modal, 'f_soCCCD'), ngayCapCCCD: val(modal, 'f_ngayCapCCCD'),
        noiCapCCCD: val(modal, 'f_noiCapCCCD'), sdt: val(modal, 'f_sdt'), email: val(modal, 'f_email'),
        diaChi: val(modal, 'f_diaChi'), boPhanId: val(modal, 'f_boPhan'), chucVu: val(modal, 'f_chucVu'),
        chuyenMon: val(modal, 'f_chuyenMon'), ngayVao: val(modal, 'f_ngayVao'), trangThaiLaoDong: val(modal, 'f_ttLaoDong'),
        soNguoiPhuThuoc: val(modal, 'f_npt'), soTaiKhoanNH: val(modal, 'f_stk'), tenNganHang: val(modal, 'f_tenNH'),
        chiNhanhNH: val(modal, 'f_cnNH'), maSoThueCaNhan: val(modal, 'f_mst'), ngayCapMST: val(modal, 'f_ngayCapMST'),
        soSoBHXH: val(modal, 'f_bhxh'), ghiChu: val(modal, 'f_ghiChu'),
        maChamCong: val(modal, 'f_maChamCong')   // v5.59: gán mã trên máy chấm công ngay từ hồ sơ
      };
      try {
        if (id) await apiPut('/api/hrm/nhanvien/' + id, payload);
        else await apiPost('/api/hrm/nhanvien', payload);
        closeModal(); toast('Đã lưu hồ sơ nhân sự.', 'success');
        await reloadRefs(); renderHoSo();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function deleteNhanVien(id) {
    if (!confirm('Xóa nhân viên này? (Nếu nhân viên đã có dữ liệu sản xuất/lương thì không xóa được — hãy chuyển trạng thái "Đã nghỉ việc").')) return;
    try { await apiDelete('/api/hrm/nhanvien/' + id); toast('Đã xóa.', 'success'); await reloadRefs(); renderHoSo(); }
    catch (err) { toast(err.message, 'error'); }
  }

  // Chi tiet ho so: thong tin day du + tom tat HD/PL/QD/thanh ly cua nhan vien do (co nut them nhanh).
  async function openNhanVienDetail(id) {
    let nv;
    try { nv = (await apiGet('/api/hrm/nhanvien/' + id)).data; } catch (e) { toast(e.message, 'error'); return; }
    if (!nv) return;
    const row = (k, v) => `<div style="display:flex;gap:8px;"><b style="min-width:150px;color:#5f6368;">${k}:</b><span>${v || ''}</span></div>`;
    const docList = (title, items, cols) => `
      <h4 style="margin:14px 0 6px;">${title} <span style="color:#5f6368;font-weight:400;">(${items.length})</span></h4>
      ${items.length ? `<table style="font-size:13px;"><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join('')}</tr></thead>
        <tbody>${items.map(it => `<tr>${cols.map(c => `<td>${c.f(it)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        : `<div class="empty-hint" style="padding:8px;">Chưa có.</div>`}`;
    const html = `
      <h3>Hồ sơ: ${escapeHtml(nv.HoTen)} <span style="color:#5f6368;font-weight:400;">(${escapeHtml(nv.MaNhanVien || '')})</span></h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:14px;margin-bottom:8px;">
        ${row('Giới tính', escapeHtml(nv.GioiTinh || ''))}
        ${row('Ngày sinh', fmtDate(nv.NgaySinh))}
        ${row('CMND/CCCD', escapeHtml(nv.SoCCCD || ''))}
        ${row('Ngày cấp', fmtDate(nv.NgayCapCCCD))}
        ${row('Nơi cấp', escapeHtml(nv.NoiCapCCCD || ''))}
        ${row('Điện thoại', escapeHtml(nv.SDT || ''))}
        ${row('Email', escapeHtml(nv.Email || ''))}
        ${row('Địa chỉ', escapeHtml(nv.DiaChi || ''))}
        ${row('Bộ phận', escapeHtml(nv.TenBoPhan || ''))}
        ${row('Chức vụ', escapeHtml(nv.ChucVu || ''))}
        ${row('Ngày vào làm', fmtDate(nv.NgayVao))}
        ${row('Trạng thái', statusBadge(nv.TrangThaiLaoDong))}
        ${row('Số TK NH', escapeHtml(nv.SoTaiKhoanNH || ''))}
        ${row('Ngân hàng', escapeHtml(nv.TenNganHang || ''))}
        ${row('MST cá nhân', escapeHtml(nv.MaSoThueCaNhan || ''))}
        ${row('Số sổ BHXH', escapeHtml(nv.SoSoBHXH || ''))}
        ${row('Số người phụ thuộc', nv.SoNguoiPhuThuoc != null ? nv.SoNguoiPhuThuoc : '')}
      </div>
      ${docList('Hợp đồng lao động', nv.hopDong, [
        { h: 'Số HĐ', f: h => escapeHtml(h.SoHopDong || '') }, { h: 'Loại', f: h => escapeHtml(h.LoaiHopDong || '') },
        { h: 'Từ ngày', f: h => fmtDate(h.TuNgay) }, { h: 'Đến ngày', f: h => fmtDate(h.DenNgay) },
        { h: 'Lương CB', f: h => money(h.LuongCoBan) }, { h: 'Trạng thái', f: h => escapeHtml(h.TrangThai || '') }])}
      ${docList('Phụ lục hợp đồng', nv.phuLuc, [
        { h: 'Số PL', f: p => escapeHtml(p.SoPhuLuc || '') }, { h: 'Ngày ký', f: p => fmtDate(p.NgayKy) },
        { h: 'Hiệu lực', f: p => fmtDate(p.NgayHieuLuc) }, { h: 'Lương mới', f: p => money(p.LuongCoBanMoi) }])}
      ${docList('Quyết định', nv.quyetDinh, [
        { h: 'Số QĐ', f: q => escapeHtml(q.SoQuyetDinh || '') }, { h: 'Loại', f: q => escapeHtml(q.LoaiQuyetDinh || '') },
        { h: 'Hiệu lực', f: q => fmtDate(q.NgayHieuLuc) }, { h: 'Cũ→Mới', f: q => `${escapeHtml(q.GiaTriCu || '')} → ${escapeHtml(q.GiaTriMoi || '')}` }])}
      ${docList('Thanh lý hợp đồng', nv.thanhLy, [
        { h: 'Ngày nghỉ', f: t => fmtDate(t.NgayNghiViec) }, { h: 'Lý do', f: t => escapeHtml(t.LyDoNghi || '') },
        { h: 'Bàn giao', f: t => escapeHtml(t.TrangThaiBanGiao || '') }])}
      <div class="modal-actions" style="flex-wrap:wrap;gap:6px;">
        ${perm.canCreate ? `<button type="button" class="btn small secondary" id="qAddHD">+ Hợp đồng</button>
        <button type="button" class="btn small secondary" id="qAddQD">+ Quyết định</button>
        <button type="button" class="btn small secondary" id="qAddTL">+ Thanh lý</button>` : ''}
        ${perm.canEdit ? `<button type="button" class="btn secondary" id="qEdit">Sửa hồ sơ</button>` : ''}
        <button type="button" class="btn" id="btnClose">Đóng</button>
      </div>`;
    const modal = openModal(html);
    modal.querySelector('#btnClose').addEventListener('click', closeModal);
    const qEdit = modal.querySelector('#qEdit'); if (qEdit) qEdit.addEventListener('click', () => openNhanVienForm(id));
    const qAddHD = modal.querySelector('#qAddHD'); if (qAddHD) qAddHD.addEventListener('click', () => openHopDongForm(null, id));
    const qAddQD = modal.querySelector('#qAddQD'); if (qAddQD) qAddQD.addEventListener('click', () => openQuyetDinhForm(null, id));
    const qAddTL = modal.querySelector('#qAddTL'); if (qAddTL) qAddTL.addEventListener('click', () => openThanhLyForm(null, id));
  }

  /* ================================================================
     2. HOP DONG LAO DONG
     ================================================================ */
  async function renderHopDong() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let rows;
    try { rows = (await apiGet('/api/hrm/hopdong')).data || []; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    container.innerHTML = `
      <div style="margin-bottom:12px;">${perm.canCreate ? `<button class="btn" id="btnAddHD">➕ Tạo hợp đồng</button>` : ''}</div>
      <table><thead><tr><th>Số HĐ</th><th>Nhân viên</th><th>Loại HĐ</th><th>Từ ngày</th><th>Đến ngày</th><th>Lương CB</th><th>Trạng thái</th><th style="width:230px">Thao tác</th></tr></thead>
      <tbody>${rows.map(h => `<tr>
        <td>${escapeHtml(h.SoHopDong || '')}</td>
        <td>${escapeHtml(h.HoTen || '')} <span style="color:#5f6368;">(${escapeHtml(h.MaNhanVien || '')})</span></td>
        <td>${escapeHtml(h.LoaiHopDong || '')}</td><td>${fmtDate(h.TuNgay)}</td><td>${h.DenNgay ? fmtDate(h.DenNgay) : '—'}</td>
        <td style="text-align:right;">${money(h.LuongCoBan)}</td><td>${escapeHtml(h.TrangThai || '')}</td>
        <td>
          <button class="btn small secondary act-print" data-id="${h.HopDongID}">🖨 In</button>
          ${perm.canEdit ? `<button class="btn small secondary act-edit" data-id="${h.HopDongID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger act-del" data-id="${h.HopDongID}">Xóa</button>` : ''}
        </td></tr>`).join('') || `<tr><td colspan="8" class="empty-hint">Chưa có hợp đồng nào.</td></tr>`}</tbody></table>`;
    const btnAdd = container.querySelector('#btnAddHD'); if (btnAdd) btnAdd.addEventListener('click', () => openHopDongForm(null));
    container.querySelectorAll('.act-print').forEach(b => b.addEventListener('click', () => printHopDong(rows.find(r => r.HopDongID == b.dataset.id))));
    container.querySelectorAll('.act-edit').forEach(b => b.addEventListener('click', () => openHopDongForm(b.dataset.id)));
    container.querySelectorAll('.act-del').forEach(b => b.addEventListener('click', () => del('/api/hrm/hopdong/', b.dataset.id, renderHopDong)));
  }

  async function openHopDongForm(id, presetNvId) {
    let h = {};
    if (id) { try { h = (await apiGet('/api/hrm/hopdong?')).data.find(x => x.HopDongID == id) || {}; } catch (e) { } }
    const nvId = h.NhanVienID || presetNvId || '';
    const f = (label, inner) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}</div>`;
    const html = `
      <h3>${id ? 'Sửa hợp đồng lao động' : 'Tạo hợp đồng lao động'}</h3>
      <form id="hdForm"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
        ${f('Nhân viên *', `<select id="f_nv" ${id ? 'disabled' : 'required'}><option value="">--</option>${selOpts(refs.nhanVien, nvId, 'NhanVienID', o => (o.MaNhanVien ? o.MaNhanVien + ' - ' : '') + o.HoTen)}</select>`)}
        ${f('Số hợp đồng', `<input id="f_so" value="${escapeHtml(h.SoHopDong || '')}">`)}
        ${f('Loại hợp đồng', `<select id="f_loai">${selOpts(LOAI_HOP_DONG, h.LoaiHopDong || 'Xác định thời hạn')}</select>`)}
        ${f('Trạng thái', `<select id="f_tt">${selOpts(TT_HOP_DONG, h.TrangThai || 'Hiệu lực')}</select>`)}
        ${f('Từ ngày', `<input type="date" id="f_tu" value="${dInput(h.TuNgay)}">`)}
        ${f('Đến ngày (trống = không thời hạn)', `<input type="date" id="f_den" value="${dInput(h.DenNgay)}">`)}
        ${f('Chức vụ', `<input id="f_cv" value="${escapeHtml(h.ChucVu || '')}">`)}
        ${f('Nơi làm việc', `<input id="f_nlv" value="${escapeHtml(h.NoiLamViec || '')}">`)}
        ${f('Lương cơ bản (đ/tháng)', `<input type="number" id="f_luong" value="${h.LuongCoBan != null ? h.LuongCoBan : ''}">`)}
        ${f('Hệ số lương', `<input type="number" step="0.0001" id="f_heso" value="${h.HeSoLuong != null ? h.HeSoLuong : ''}">`)}
        ${f('Phụ cấp ăn ca', `<input type="number" id="f_anca" value="${h.PhuCapAnCa != null ? h.PhuCapAnCa : ''}">`)}
        ${f('Phụ cấp trang phục', `<input type="number" id="f_tp" value="${h.PhuCapTrangPhuc != null ? h.PhuCapTrangPhuc : ''}">`)}
        ${f('Phụ cấp xăng xe', `<input type="number" id="f_xang" value="${h.PhuCapXangXe != null ? h.PhuCapXangXe : ''}">`)}
        ${f('Phụ cấp điện thoại', `<input type="number" id="f_dt" value="${h.PhuCapDienThoai != null ? h.PhuCapDienThoai : ''}">`)}
      </div>
      ${f('Ghi chú', `<textarea id="f_gc" rows="2">${escapeHtml(h.GhiChu || '')}</textarea>`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#hdForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        nhanVienId: id ? h.NhanVienID : val(modal, 'f_nv'), soHopDong: val(modal, 'f_so'), loaiHopDong: val(modal, 'f_loai'),
        trangThai: val(modal, 'f_tt'), tuNgay: val(modal, 'f_tu'), denNgay: val(modal, 'f_den'), chucVu: val(modal, 'f_cv'),
        noiLamViec: val(modal, 'f_nlv'), luongCoBan: val(modal, 'f_luong'), heSoLuong: val(modal, 'f_heso'),
        phuCapAnCa: val(modal, 'f_anca'), phuCapTrangPhuc: val(modal, 'f_tp'), phuCapXangXe: val(modal, 'f_xang'),
        phuCapDienThoai: val(modal, 'f_dt'), ghiChu: val(modal, 'f_gc')
      };
      if (!payload.nhanVienId) { toast('Chọn nhân viên.', 'error'); return; }
      try {
        if (id) await apiPut('/api/hrm/hopdong/' + id, payload); else await apiPost('/api/hrm/hopdong', payload);
        closeModal(); toast('Đã lưu hợp đồng.', 'success');
        if (activeTab === 'hopdong') renderHopDong(); else closeModal();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function printHopDong(h) {
    if (!h) return;
    const nv = refs.nhanVien.find(x => x.NhanVienID == h.NhanVienID) || {};
    const body = `
      ${docHeader()}
      <h2 style="text-align:center;margin:6px 0;">HỢP ĐỒNG LAO ĐỘNG</h2>
      <p style="text-align:center;font-style:italic;margin-top:0;">Số: ${escapeHtml(h.SoHopDong || '.................')}</p>
      <p>Hôm nay, ngày ${dmy(h.TuNgay)}, tại ${escapeHtml(COMPANY.ten)}, chúng tôi gồm:</p>
      <p><b>BÊN A (NGƯỜI SỬ DỤNG LAO ĐỘNG):</b> ${escapeHtml(COMPANY.ten)}<br>
      Mã số thuế: ${escapeHtml(COMPANY.mst)} — Địa chỉ: ${escapeHtml(COMPANY.diaChi)}<br>
      Đại diện: ${escapeHtml(COMPANY.giamDoc || '..............................')} — Chức vụ: Giám đốc</p>
      <p><b>BÊN B (NGƯỜI LAO ĐỘNG):</b> ${escapeHtml(h.HoTen || nv.HoTen || '')}<br>
      Ngày sinh: ${dmy(nv.NgaySinh)} — Số CMND/CCCD: ${escapeHtml(nv.SoCCCD || '')}<br>
      Địa chỉ: ${escapeHtml(nv.DiaChi || '')}</p>
      <p>Hai bên thỏa thuận ký kết Hợp đồng lao động với các điều khoản sau:</p>
      <p><b>Điều 1.</b> Loại hợp đồng: <b>${escapeHtml(h.LoaiHopDong || '')}</b>.
      Thời hạn: từ ${dmy(h.TuNgay)}${h.DenNgay ? ' đến ' + dmy(h.DenNgay) : ' (không xác định thời hạn)'}.<br>
      Chức vụ/Công việc: ${escapeHtml(h.ChucVu || '')} — Nơi làm việc: ${escapeHtml(h.NoiLamViec || COMPANY.ten)}.</p>
      <p><b>Điều 2.</b> Mức lương cơ bản: <b>${money(h.LuongCoBan)} đồng/tháng</b>${h.HeSoLuong ? ' — Hệ số lương: ' + h.HeSoLuong : ''}.<br>
      Phụ cấp: ăn ca ${money(h.PhuCapAnCa) || 0}đ, trang phục ${money(h.PhuCapTrangPhuc) || 0}đ, xăng xe ${money(h.PhuCapXangXe) || 0}đ, điện thoại ${money(h.PhuCapDienThoai) || 0}đ.<br>
      Hình thức trả lương: chuyển khoản, vào ngày 10 hằng tháng.</p>
      <p><b>Điều 3.</b> Người lao động được đóng BHXH, BHYT, BHTN theo quy định của pháp luật hiện hành.</p>
      <p><b>Điều 4.</b> Hợp đồng có hiệu lực kể từ ngày ${dmy(h.TuNgay)}. Hợp đồng lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.</p>
      ${signBlock('NGƯỜI LAO ĐỘNG', h.HoTen || nv.HoTen, 'NGƯỜI SỬ DỤNG LAO ĐỘNG', COMPANY.giamDoc)}`;
    printHtml('Hop dong lao dong - ' + (h.SoHopDong || h.HoTen || ''), wrapA4(body));
  }

  /* ================================================================
     3. PHU LUC HOP DONG
     ================================================================ */
  async function renderPhuLuc() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let rows;
    try { rows = (await apiGet('/api/hrm/phuluc')).data || []; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    container.innerHTML = `
      <div style="margin-bottom:12px;">${perm.canCreate ? `<button class="btn" id="btnAddPL">➕ Tạo phụ lục</button>` : ''}</div>
      <table><thead><tr><th>Số PL</th><th>Nhân viên</th><th>HĐ gốc</th><th>Ngày ký</th><th>Hiệu lực</th><th>Lương mới</th><th>Nội dung thay đổi</th><th style="width:190px">Thao tác</th></tr></thead>
      <tbody>${rows.map(p => `<tr>
        <td>${escapeHtml(p.SoPhuLuc || '')}</td>
        <td>${escapeHtml(p.HoTen || '')} <span style="color:#5f6368;">(${escapeHtml(p.MaNhanVien || '')})</span></td>
        <td>${escapeHtml(p.SoHopDong || '')}</td><td>${fmtDate(p.NgayKy)}</td><td>${fmtDate(p.NgayHieuLuc)}</td>
        <td style="text-align:right;">${money(p.LuongCoBanMoi)}</td><td>${escapeHtml((p.NoiDungThayDoi || '').slice(0, 60))}</td>
        <td>
          <button class="btn small secondary act-print" data-id="${p.PhuLucID}">🖨 In</button>
          ${perm.canEdit ? `<button class="btn small secondary act-edit" data-id="${p.PhuLucID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger act-del" data-id="${p.PhuLucID}">Xóa</button>` : ''}
        </td></tr>`).join('') || `<tr><td colspan="8" class="empty-hint">Chưa có phụ lục nào.</td></tr>`}</tbody></table>`;
    const btnAdd = container.querySelector('#btnAddPL'); if (btnAdd) btnAdd.addEventListener('click', () => openPhuLucForm(null));
    container.querySelectorAll('.act-print').forEach(b => b.addEventListener('click', () => printPhuLuc(rows.find(r => r.PhuLucID == b.dataset.id))));
    container.querySelectorAll('.act-edit').forEach(b => b.addEventListener('click', () => openPhuLucForm(b.dataset.id, null, rows.find(r => r.PhuLucID == b.dataset.id))));
    container.querySelectorAll('.act-del').forEach(b => b.addEventListener('click', () => del('/api/hrm/phuluc/', b.dataset.id, renderPhuLuc)));
  }

  async function openPhuLucForm(id, presetHopDongId, preset) {
    const p = preset || {};
    // Danh sach hop dong de chon (chi khi tao moi) - lay tu API.
    let hopDongList = [];
    if (!id) { try { hopDongList = (await apiGet('/api/hrm/hopdong')).data || []; } catch (e) { } }
    const f = (label, inner) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}</div>`;
    const hopDongOpts = hopDongList.map(h => `<option value="${h.HopDongID}" ${String(h.HopDongID) === String(p.HopDongID || presetHopDongId || '') ? 'selected' : ''}>${escapeHtml((h.SoHopDong || 'HĐ#' + h.HopDongID) + ' — ' + h.HoTen)}</option>`).join('');
    const html = `
      <h3>${id ? 'Sửa phụ lục hợp đồng' : 'Tạo phụ lục hợp đồng'}</h3>
      <form id="plForm"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
        ${id ? f('Hợp đồng gốc', `<input value="${escapeHtml((p.SoHopDong || '') + ' — ' + (p.HoTen || ''))}" disabled>`)
             : f('Hợp đồng gốc *', `<select id="f_hd" required><option value="">--</option>${hopDongOpts}</select>`)}
        ${f('Số phụ lục', `<input id="f_so" value="${escapeHtml(p.SoPhuLuc || '')}">`)}
        ${f('Ngày ký', `<input type="date" id="f_ky" value="${dInput(p.NgayKy)}">`)}
        ${f('Ngày hiệu lực', `<input type="date" id="f_hl" value="${dInput(p.NgayHieuLuc)}">`)}
        ${f('Lương cơ bản mới', `<input type="number" id="f_luong" value="${p.LuongCoBanMoi != null ? p.LuongCoBanMoi : ''}">`)}
        ${f('Chức vụ mới', `<input id="f_cv" value="${escapeHtml(p.ChucVuMoi || '')}">`)}
      </div>
      ${f('Nội dung thay đổi', `<textarea id="f_nd" rows="3">${escapeHtml(p.NoiDungThayDoi || '')}</textarea>`)}
      ${f('Ghi chú', `<textarea id="f_gc" rows="2">${escapeHtml(p.GhiChu || '')}</textarea>`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#plForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        hopDongId: id ? p.HopDongID : val(modal, 'f_hd'), soPhuLuc: val(modal, 'f_so'), ngayKy: val(modal, 'f_ky'),
        ngayHieuLuc: val(modal, 'f_hl'), luongCoBanMoi: val(modal, 'f_luong'), chucVuMoi: val(modal, 'f_cv'),
        noiDungThayDoi: val(modal, 'f_nd'), ghiChu: val(modal, 'f_gc')
      };
      if (!payload.hopDongId) { toast('Chọn hợp đồng gốc.', 'error'); return; }
      try {
        if (id) await apiPut('/api/hrm/phuluc/' + id, payload); else await apiPost('/api/hrm/phuluc', payload);
        closeModal(); toast('Đã lưu phụ lục.', 'success'); if (activeTab === 'phuluc') renderPhuLuc();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function printPhuLuc(p) {
    if (!p) return;
    const body = `
      ${docHeader()}
      <h2 style="text-align:center;margin:6px 0;">PHỤ LỤC HỢP ĐỒNG LAO ĐỘNG</h2>
      <p style="text-align:center;font-style:italic;margin-top:0;">Số: ${escapeHtml(p.SoPhuLuc || '.........')}</p>
      <p>Căn cứ Hợp đồng lao động số ${escapeHtml(p.SoHopDong || '.........')} đã ký giữa ${escapeHtml(COMPANY.ten)} và Ông/Bà <b>${escapeHtml(p.HoTen || '')}</b>.</p>
      <p>Hai bên thống nhất sửa đổi, bổ sung một số nội dung của hợp đồng, hiệu lực từ ngày ${dmy(p.NgayHieuLuc)}:</p>
      <p><b>Nội dung thay đổi:</b> ${escapeHtml(p.NoiDungThayDoi || '')}</p>
      ${p.LuongCoBanMoi != null ? `<p><b>Mức lương mới:</b> ${money(p.LuongCoBanMoi)} đồng/tháng.</p>` : ''}
      ${p.ChucVuMoi ? `<p><b>Chức vụ mới:</b> ${escapeHtml(p.ChucVuMoi)}.</p>` : ''}
      <p>Các nội dung khác của hợp đồng lao động không thay đổi. Phụ lục này là bộ phận không tách rời của hợp đồng.</p>
      ${signBlock('NGƯỜI LAO ĐỘNG', p.HoTen, 'NGƯỜI SỬ DỤNG LAO ĐỘNG', COMPANY.giamDoc)}`;
    printHtml('Phu luc HD - ' + (p.SoPhuLuc || p.HoTen || ''), wrapA4(body));
  }

  /* ================================================================
     4. QUYET DINH NHAN SU
     ================================================================ */
  async function renderQuyetDinh() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let rows;
    try { rows = (await apiGet('/api/hrm/quyetdinh')).data || []; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    container.innerHTML = `
      <div style="margin-bottom:12px;">${perm.canCreate ? `<button class="btn" id="btnAddQD">➕ Tạo quyết định</button>` : ''}</div>
      <table><thead><tr><th>Số QĐ</th><th>Nhân viên</th><th>Loại</th><th>Ngày hiệu lực</th><th>Giá trị cũ → mới</th><th>Nội dung</th><th style="width:190px">Thao tác</th></tr></thead>
      <tbody>${rows.map(q => `<tr>
        <td>${escapeHtml(q.SoQuyetDinh || '')}</td>
        <td>${escapeHtml(q.HoTen || '')} <span style="color:#5f6368;">(${escapeHtml(q.MaNhanVien || '')})</span></td>
        <td>${escapeHtml(q.LoaiQuyetDinh || '')}</td><td>${fmtDate(q.NgayHieuLuc)}</td>
        <td>${escapeHtml(q.GiaTriCu || '')}${q.GiaTriMoi ? ' → ' + escapeHtml(q.GiaTriMoi) : ''}</td>
        <td>${escapeHtml((q.NoiDung || '').slice(0, 50))}</td>
        <td>
          <button class="btn small secondary act-print" data-id="${q.QuyetDinhID}">🖨 In</button>
          ${perm.canEdit ? `<button class="btn small secondary act-edit" data-id="${q.QuyetDinhID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger act-del" data-id="${q.QuyetDinhID}">Xóa</button>` : ''}
        </td></tr>`).join('') || `<tr><td colspan="7" class="empty-hint">Chưa có quyết định nào.</td></tr>`}</tbody></table>`;
    const btnAdd = container.querySelector('#btnAddQD'); if (btnAdd) btnAdd.addEventListener('click', () => openQuyetDinhForm(null));
    container.querySelectorAll('.act-print').forEach(b => b.addEventListener('click', () => printQuyetDinh(rows.find(r => r.QuyetDinhID == b.dataset.id))));
    container.querySelectorAll('.act-edit').forEach(b => b.addEventListener('click', () => openQuyetDinhForm(b.dataset.id, null, rows.find(r => r.QuyetDinhID == b.dataset.id))));
    container.querySelectorAll('.act-del').forEach(b => b.addEventListener('click', () => del('/api/hrm/quyetdinh/', b.dataset.id, renderQuyetDinh)));
  }

  async function openQuyetDinhForm(id, presetNvId, preset) {
    const q = preset || {};
    const nvId = q.NhanVienID || presetNvId || '';
    const f = (label, inner) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}</div>`;
    const html = `
      <h3>${id ? 'Sửa quyết định' : 'Tạo quyết định nhân sự'}</h3>
      <form id="qdForm"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
        ${f('Nhân viên *', `<select id="f_nv" ${id ? 'disabled' : 'required'}><option value="">--</option>${selOpts(refs.nhanVien, nvId, 'NhanVienID', o => (o.MaNhanVien ? o.MaNhanVien + ' - ' : '') + o.HoTen)}</select>`)}
        ${f('Loại quyết định *', `<select id="f_loai" required>${selOpts(LOAI_QUYET_DINH, q.LoaiQuyetDinh || 'Tăng lương')}</select>`)}
        ${f('Số quyết định', `<input id="f_so" value="${escapeHtml(q.SoQuyetDinh || '')}">`)}
        ${f('Ngày hiệu lực', `<input type="date" id="f_hl" value="${dInput(q.NgayHieuLuc)}">`)}
        ${f('Giá trị cũ', `<input id="f_cu" value="${escapeHtml(q.GiaTriCu || '')}" placeholder="VD: lương cũ / chức vụ cũ">`)}
        ${f('Giá trị mới', `<input id="f_moi" value="${escapeHtml(q.GiaTriMoi || '')}" placeholder="VD: lương mới / chức vụ mới">`)}
      </div>
      ${f('Nội dung', `<textarea id="f_nd" rows="3">${escapeHtml(q.NoiDung || '')}</textarea>`)}
      ${f('Ghi chú', `<textarea id="f_gc" rows="2">${escapeHtml(q.GhiChu || '')}</textarea>`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#qdForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        nhanVienId: id ? q.NhanVienID : val(modal, 'f_nv'), loaiQuyetDinh: val(modal, 'f_loai'), soQuyetDinh: val(modal, 'f_so'),
        ngayHieuLuc: val(modal, 'f_hl'), giaTriCu: val(modal, 'f_cu'), giaTriMoi: val(modal, 'f_moi'),
        noiDung: val(modal, 'f_nd'), ghiChu: val(modal, 'f_gc')
      };
      if (!payload.nhanVienId) { toast('Chọn nhân viên.', 'error'); return; }
      try {
        if (id) await apiPut('/api/hrm/quyetdinh/' + id, payload); else await apiPost('/api/hrm/quyetdinh', payload);
        closeModal(); toast('Đã lưu quyết định.', 'success'); if (activeTab === 'quyetdinh') renderQuyetDinh();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function printQuyetDinh(q) {
    if (!q) return;
    const body = `
      ${docHeader()}
      <h2 style="text-align:center;margin:6px 0;">QUYẾT ĐỊNH</h2>
      <p style="text-align:center;margin-top:0;">V/v: ${escapeHtml(q.LoaiQuyetDinh || '')}${q.HoTen ? ' đối với Ông/Bà ' + escapeHtml(q.HoTen) : ''}</p>
      <p style="text-align:center;font-style:italic;">Số: ${escapeHtml(q.SoQuyetDinh || '........./QĐ')}</p>
      <p style="text-align:center;font-weight:600;">GIÁM ĐỐC ${escapeHtml(COMPANY.ten)}</p>
      <p><i>Căn cứ Bộ luật Lao động và Quy chế hoạt động của Công ty;<br>Xét năng lực và nhu cầu công tác,</i></p>
      <p style="text-align:center;font-weight:600;">QUYẾT ĐỊNH:</p>
      <p><b>Điều 1.</b> ${escapeHtml(q.LoaiQuyetDinh || '')} đối với Ông/Bà <b>${escapeHtml(q.HoTen || '')}</b> (Mã NV: ${escapeHtml(q.MaNhanVien || '')}).
      ${q.GiaTriCu || q.GiaTriMoi ? `Từ <b>${escapeHtml(q.GiaTriCu || '...')}</b> thành <b>${escapeHtml(q.GiaTriMoi || '...')}</b>.` : ''}</p>
      ${q.NoiDung ? `<p><b>Điều 2.</b> ${escapeHtml(q.NoiDung)}</p>` : ''}
      <p><b>Điều ${q.NoiDung ? 3 : 2}.</b> Quyết định có hiệu lực kể từ ngày ${dmy(q.NgayHieuLuc)}. Các bộ phận liên quan và Ông/Bà có tên chịu trách nhiệm thi hành.</p>
      ${signBlock('', '', 'GIÁM ĐỐC', COMPANY.giamDoc)}`;
    printHtml('Quyet dinh - ' + (q.SoQuyetDinh || q.HoTen || ''), wrapA4(body));
  }

  /* ================================================================
     5. THANH LY HOP DONG
     ================================================================ */
  async function renderThanhLy() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let rows;
    try { rows = (await apiGet('/api/hrm/thanhly')).data || []; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    container.innerHTML = `
      <div style="margin-bottom:12px;">${perm.canCreate ? `<button class="btn" id="btnAddTL">➕ Tạo thanh lý</button>` : ''}
        <span style="color:#5f6368;font-size:13px;margin-left:8px;">Tạo thanh lý sẽ tự chuyển nhân viên sang trạng thái "Đã nghỉ việc".</span></div>
      <table><thead><tr><th>Nhân viên</th><th>Ngày nghỉ</th><th>Lý do</th><th>Trợ cấp</th><th>Khấu trừ</th><th>Bàn giao</th><th style="width:190px">Thao tác</th></tr></thead>
      <tbody>${rows.map(t => `<tr>
        <td>${escapeHtml(t.HoTen || '')} <span style="color:#5f6368;">(${escapeHtml(t.MaNhanVien || '')})</span></td>
        <td>${fmtDate(t.NgayNghiViec)}</td><td>${escapeHtml((t.LyDoNghi || '').slice(0, 50))}</td>
        <td style="text-align:right;">${money(t.TroCap)}</td><td style="text-align:right;">${money(t.KhauTru)}</td>
        <td>${escapeHtml(t.TrangThaiBanGiao || '')}</td>
        <td>
          <button class="btn small secondary act-print" data-id="${t.ThanhLyID}">🖨 In</button>
          ${perm.canEdit ? `<button class="btn small secondary act-edit" data-id="${t.ThanhLyID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger act-del" data-id="${t.ThanhLyID}">Xóa</button>` : ''}
        </td></tr>`).join('') || `<tr><td colspan="7" class="empty-hint">Chưa có thanh lý nào.</td></tr>`}</tbody></table>`;
    const btnAdd = container.querySelector('#btnAddTL'); if (btnAdd) btnAdd.addEventListener('click', () => openThanhLyForm(null));
    container.querySelectorAll('.act-print').forEach(b => b.addEventListener('click', () => printThanhLy(rows.find(r => r.ThanhLyID == b.dataset.id))));
    container.querySelectorAll('.act-edit').forEach(b => b.addEventListener('click', () => openThanhLyForm(b.dataset.id, null, rows.find(r => r.ThanhLyID == b.dataset.id))));
    container.querySelectorAll('.act-del').forEach(b => b.addEventListener('click', () => del('/api/hrm/thanhly/', b.dataset.id, renderThanhLy)));
  }

  async function openThanhLyForm(id, presetNvId, preset) {
    const t = preset || {};
    const nvId = t.NhanVienID || presetNvId || '';
    // Hop dong cua nhan vien (de gan tuy chon)
    const f = (label, inner) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}</div>`;
    const html = `
      <h3>${id ? 'Sửa thanh lý hợp đồng' : 'Tạo thanh lý hợp đồng (nghỉ việc)'}</h3>
      <form id="tlForm"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
        ${f('Nhân viên *', `<select id="f_nv" ${id ? 'disabled' : 'required'}><option value="">--</option>${selOpts(refs.nhanVien, nvId, 'NhanVienID', o => (o.MaNhanVien ? o.MaNhanVien + ' - ' : '') + o.HoTen)}</select>`)}
        ${f('Ngày nghỉ việc *', `<input type="date" id="f_ngay" value="${dInput(t.NgayNghiViec)}" required>`)}
        ${f('Trợ cấp (đồng)', `<input type="number" id="f_trocap" value="${t.TroCap != null ? t.TroCap : ''}">`)}
        ${f('Khấu trừ (đồng)', `<input type="number" id="f_khautru" value="${t.KhauTru != null ? t.KhauTru : ''}">`)}
        ${f('Trạng thái bàn giao', `<select id="f_bg">${selOpts(TT_BAN_GIAO, t.TrangThaiBanGiao || 'Chưa bàn giao')}</select>`)}
      </div>
      ${f('Lý do nghỉ', `<textarea id="f_lydo" rows="2">${escapeHtml(t.LyDoNghi || '')}</textarea>`)}
      ${f('Ghi chú', `<textarea id="f_gc" rows="2">${escapeHtml(t.GhiChu || '')}</textarea>`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#tlForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        nhanVienId: id ? t.NhanVienID : val(modal, 'f_nv'), ngayNghiViec: val(modal, 'f_ngay'), troCap: val(modal, 'f_trocap'),
        khauTru: val(modal, 'f_khautru'), trangThaiBanGiao: val(modal, 'f_bg'), lyDoNghi: val(modal, 'f_lydo'), ghiChu: val(modal, 'f_gc')
      };
      if (!payload.nhanVienId) { toast('Chọn nhân viên.', 'error'); return; }
      try {
        if (id) await apiPut('/api/hrm/thanhly/' + id, payload); else await apiPost('/api/hrm/thanhly', payload);
        closeModal(); toast('Đã lưu thanh lý.', 'success'); await reloadRefs();
        if (activeTab === 'thanhly') renderThanhLy();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function printThanhLy(t) {
    if (!t) return;
    const body = `
      ${docHeader()}
      <h2 style="text-align:center;margin:6px 0;">BIÊN BẢN THANH LÝ HỢP ĐỒNG LAO ĐỘNG</h2>
      <p>Hôm nay, ngày ${dmy(t.NgayNghiViec)}, ${escapeHtml(COMPANY.ten)} và Ông/Bà <b>${escapeHtml(t.HoTen || '')}</b> (Mã NV: ${escapeHtml(t.MaNhanVien || '')}) thống nhất thanh lý hợp đồng lao động${t.SoHopDong ? ' số ' + escapeHtml(t.SoHopDong) : ''}.</p>
      <p><b>Ngày nghỉ việc chính thức:</b> ${dmy(t.NgayNghiViec)}.</p>
      <p><b>Lý do:</b> ${escapeHtml(t.LyDoNghi || '')}.</p>
      <p><b>Trợ cấp:</b> ${money(t.TroCap) || 0} đồng — <b>Khấu trừ:</b> ${money(t.KhauTru) || 0} đồng.</p>
      <p><b>Tình trạng bàn giao:</b> ${escapeHtml(t.TrangThaiBanGiao || '')}.</p>
      <p>Hai bên xác nhận đã hoàn tất các nghĩa vụ và không còn khiếu nại gì liên quan đến hợp đồng lao động nêu trên.</p>
      ${signBlock('NGƯỜI LAO ĐỘNG', t.HoTen, 'NGƯỜI SỬ DỤNG LAO ĐỘNG', COMPANY.giamDoc)}`;
    printHtml('Thanh ly HD - ' + (t.HoTen || ''), wrapA4(body));
  }

  /* ================================================================
     Tien ich dung chung: xoa, in van ban (header/chu ky/khung A4)
     ================================================================ */
  async function del(base, id, after) {
    if (!confirm('Xóa mục này?')) return;
    try { await apiDelete(base + id); toast('Đã xóa.', 'success'); after(); } catch (err) { toast(err.message, 'error'); }
  }

  function dmy(d) {
    if (!d) return '......../......../..........';
    const s = String(d).slice(0, 10).split('-'); // yyyy-mm-dd
    if (s.length !== 3) return fmtDate(d);
    return `${s[2]}/${s[1]}/${s[0]}`;
  }

  function docHeader() {
    return `
      <table style="width:100%;border:none;margin-bottom:6px;"><tr>
        <td style="border:none;text-align:center;width:50%;vertical-align:top;">
          <div style="font-weight:600;text-transform:uppercase;">${escapeHtml(COMPANY.ten)}</div>
          <div style="font-size:12px;">MST: ${escapeHtml(COMPANY.mst)}</div>
          <div style="font-size:12px;">${escapeHtml(COMPANY.diaChi)}</div>
        </td>
        <td style="border:none;text-align:center;width:50%;vertical-align:top;">
          <div style="font-weight:600;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div style="font-weight:600;">Độc lập - Tự do - Hạnh phúc</div>
          <div>-------o0o-------</div>
        </td>
      </tr></table>`;
  }

  function signBlock(leftTitle, leftName, rightTitle, rightName) {
    return `
      <table style="width:100%;border:none;margin-top:24px;"><tr>
        <td style="border:none;text-align:center;width:50%;vertical-align:top;">
          ${leftTitle ? `<div style="font-weight:600;">${escapeHtml(leftTitle)}</div><div style="font-size:12px;font-style:italic;">(Ký, ghi rõ họ tên)</div>` : ''}
          <div style="height:64px;"></div><div>${escapeHtml(leftName || '')}</div>
        </td>
        <td style="border:none;text-align:center;width:50%;vertical-align:top;">
          ${rightTitle ? `<div style="font-weight:600;">${escapeHtml(rightTitle)}</div><div style="font-size:12px;font-style:italic;">(Ký, đóng dấu)</div>` : ''}
          <div style="height:64px;"></div><div>${escapeHtml(rightName || '')}</div>
        </td>
      </tr></table>`;
  }

  // Khung A4 + CSS in (printHtml da bao <html>; day chi la phan body voi style rieng cho van ban HR).
  function wrapA4(inner) {
    return `<div style="max-width:720px;margin:0 auto;font-family:'Times New Roman',serif;font-size:14px;line-height:1.5;color:#000;">
      <style>@media print{@page{size:A4;margin:18mm 16mm;}} p{margin:6px 0;text-align:justify;} h2{font-size:18px;} table td{padding:2px 4px;}</style>
      ${inner}</div>`;
  }

  return { render, getTabs };
})();
