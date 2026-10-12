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
    giamDoc: 'NGUYỄN VĂN QUÂN'   // v8.82: mẫu hợp đồng / quyết định của công ty ghi sẵn tên giám đốc
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
    { key: 'thanhly', label: 'Thanh lý hợp đồng' },
    { key: 'mauvanban', label: 'Mẫu văn bản' }   // v8.85
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
    if (activeTab === 'mauvanban') return renderMauVanBan();
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

  /* ================================================================================================
     v8.80 — FILE HỒ SƠ NHÂN SỰ (ảnh chân dung + giấy tờ PDF)
     ------------------------------------------------------------------------------------------------
     ⚠️ KHÔNG dùng uploadFile() của common.js ở đây. Hàm đó đẩy lên /api/upload và file rơi vào
     backend/uploads/ — thư mục đó được express.static phục vụ KHÔNG cần đăng nhập VÀ nằm trong
     whitelist của cổng 80 công khai. Đặt CCCD / hợp đồng / ảnh nhân viên vào đó là công khai ra
     internet cho ai biết tên file.
     Hồ sơ nhân sự đi đường riêng: POST /api/hrm/upload -> backend/uploads_hr/ (không có static nào
     trỏ tới), và xem lại qua GET /api/hrm/file/<tên> có kiểm quyền HRM.
     ================================================================================================ */
  const LOAI_GIAY_TO = ['CCCD / CMND', 'Hợp đồng lao động', 'Phụ lục hợp đồng', 'Quyết định',
    'Sơ yếu lý lịch', 'Bằng cấp / chứng chỉ', 'Giấy khám sức khỏe', 'Hồ sơ người phụ thuộc', 'Khác'];

  // Đường dẫn XEM file (ảnh hiện trực tiếp, PDF mở trong tab) và đường dẫn TẢI VỀ (giữ tên gốc).
  const urlXemHR = (tenLuu) => '/api/hrm/file/' + encodeURIComponent(tenLuu) + '?xem=1';
  const urlTaiHR = (tenLuu) => '/api/hrm/file/' + encodeURIComponent(tenLuu);

  // Tải 1 file lên kho hồ sơ. Trả { tenLuu, tenFile, kichThuoc } — CHƯA gắn vào nhân viên nào.
  async function uploadHoSo(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/hrm/upload', { method: 'POST', credentials: 'include', body: fd });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Không tải được file lên.');
    return data.data;
  }

  const fmtKB = (n) => {
    const b = Number(n) || 0;
    if (!b) return '';
    return b >= 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  };

  /* --- Ô đính kèm cho 4 form văn bản (hợp đồng / phụ lục / quyết định / thanh lý) ---
     ⚠️ Cột FileDinhKem NVARCHAR(500) ĐÃ CÓ trên cả 4 bảng từ v6.00 và backend ĐÃ đọc/ghi b.fileDinhKem
     — nhưng frontend chưa bao giờ gửi nên cột luôn NULL. Ở đây chỉ nối nốt đoạn còn thiếu.
     Lưu TÊN LƯU trong uploads_hr (giống ảnh nhân viên), không lưu /uploads/... công khai. */
  function oFileVanBanHtml(tenLuu) {
    return `<div class="form-row" style="margin:0;"><label>File đính kèm (bản scan PDF)</label>
      <input type="hidden" id="f_file" value="${escapeHtml(tenLuu || '')}">
      <div id="f_fileHT" style="font-size:13px;margin-bottom:4px;">${tenLuu
        ? `<a href="${urlXemHR(tenLuu)}" target="_blank" rel="noopener">Xem file đang đính kèm</a>
           <button type="button" class="btn small secondary" id="f_fileXoa" style="margin-left:6px;">Bỏ file</button>`
        : '<span class="empty-hint" style="padding:0;">Chưa có file.</span>'}</div>
      <input type="file" id="f_fileChon" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx">
    </div>`;
  }
  function wireOFileVanBan(modal) {
    const elHidden = modal.querySelector('#f_file');
    const elChon = modal.querySelector('#f_fileChon');
    const elHT = modal.querySelector('#f_fileHT');
    if (!elHidden || !elChon) return;
    const ve = (ten) => {
      elHidden.value = ten || '';
      elHT.innerHTML = ten
        ? `<a href="${urlXemHR(ten)}" target="_blank" rel="noopener">Xem file đang đính kèm</a>
           <button type="button" class="btn small secondary" id="f_fileXoa" style="margin-left:6px;">Bỏ file</button>`
        : '<span class="empty-hint" style="padding:0;">Chưa có file.</span>';
      const x = modal.querySelector('#f_fileXoa');
      if (x) x.addEventListener('click', () => ve(''));
    };
    const xCu = modal.querySelector('#f_fileXoa');
    if (xCu) xCu.addEventListener('click', () => ve(''));
    elChon.addEventListener('change', async () => {
      const file = elChon.files && elChon.files[0];
      if (!file) return;
      try { const kq = await uploadHoSo(file); ve(kq.tenLuu); toast('Đã tải file lên.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
      elChon.value = '';
    });
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
        ${/* v8.80: ảnh chân dung. Ô ẩn giữ TÊN LƯU trên máy chủ (không phải đường dẫn) — xem chú
             thích ở uploadHoSo() về lý do không dùng /uploads. */''}
        <div class="form-row" style="display:flex;gap:14px;align-items:flex-start;margin-bottom:12px;">
          <div style="text-align:center;">
            <img id="f_anhXem" src="${nv.AnhDaiDien ? urlXemHR(nv.AnhDaiDien) : ''}"
              style="width:110px;height:140px;object-fit:cover;border:1px solid #dadce0;border-radius:6px;background:#f8f9fa;${nv.AnhDaiDien ? '' : 'display:none;'}">
            <div id="f_anhTrong" style="width:110px;height:140px;border:1px dashed #dadce0;border-radius:6px;background:#f8f9fa;display:${nv.AnhDaiDien ? 'none' : 'flex'};align-items:center;justify-content:center;color:#9aa0a6;font-size:12px;">Chưa có ảnh</div>
            <input type="hidden" id="f_anh" value="${escapeHtml(nv.AnhDaiDien || '')}">
          </div>
          <div style="flex:1;">
            <label>Ảnh nhân viên</label>
            <input type="file" id="f_anhFile" accept="image/*">
            <div class="empty-hint" style="margin-top:4px;">Ảnh chỉ người có quyền Nhân sự xem được — không công khai như ảnh sản phẩm.</div>
            <button type="button" class="btn small secondary" id="f_anhXoa" style="margin-top:6px;${nv.AnhDaiDien ? '' : 'display:none;'}">Bỏ ảnh</button>
          </div>
        </div>
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
          ${/* v8.82: mẫu HĐLĐ có dòng "Quốc tịch". Mặc định Việt Nam khi thêm mới. */''}
          ${f('Quốc tịch', `<input id="f_quocTich" value="${escapeHtml(nv.QuocTich || (id ? '' : 'Việt Nam'))}">`)}
        `)}
        ${grp('Thông tin công việc', `
          ${f('Phòng ban / Tổ đội', `<select id="f_boPhan"><option value="">--</option>${selOpts(refs.boPhan, nv.BoPhanID, 'BoPhanID', o => o.TenBoPhan)}</select>`)}
          ${f('Chức vụ', `<input id="f_chucVu" value="${escapeHtml(nv.ChucVu || '')}">`)}
          ${f('Chuyên môn', `<input id="f_chuyenMon" value="${escapeHtml(nv.ChuyenMon || '')}">`)}
          ${f('Ngày vào làm', `<input type="date" id="f_ngayVao" value="${dInput(nv.NgayVao)}">`)}
          ${f('Trạng thái', `<select id="f_ttLaoDong">${selOpts(TT_LAO_DONG, nv.TrangThaiLaoDong || 'Thử việc')}</select>`)}
          ${/* v8.88: CHỈ ĐỌC. Trước đây gõ tay, trong khi backend dongBoSoNPT() tự đếm từ bảng
               NguoiPhuThuoc và ghi đè — hai nguồn cho một con số, người dùng gõ 3 lưu xong thành 1
               mà không báo gì. Con số này vào thẳng giảm trừ gia cảnh khi tính lương.
               Muốn đổi số thì thêm/bớt người ở khối "Người phụ thuộc" bên dưới. */''}
          ${f('Số người phụ thuộc', `<input type="number" id="f_npt" readonly tabindex="-1"
              value="${nv.SoNguoiPhuThuoc != null ? nv.SoNguoiPhuThuoc : 0}"
              title="Tự đếm theo danh sách Người phụ thuộc bên dưới"
              style="background:#f1f3f4;cursor:not-allowed;">`)}
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
        ${/* ==========================================================================================
             v8.88 — HAI KHỐI NÀY TRƯỚC ĐÂY CHỈ CÓ Ở MÀN HỒ SƠ (Nguyen 2026-10-12: "thêm mới, sửa đều
             có luôn"). Chúng ghi qua /nhanvien/:id/... nên CẦN NhanVienID — lúc thêm mới chưa có.

             Cách giải đã có sẵn ngay trong form này: ảnh chân dung lúc thêm mới cũng không có ID,
             nó tải file lên trước (route /upload không cần ID, chỉ trả TÊN LƯU) rồi ghi cùng lúc
             bấm Thêm. Hai khối này làm y vậy: giữ trong bộ nhớ, ghi sau khi có ID.
             ========================================================================================== */''}
        <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;margin:0 0 12px;">
          <legend style="font-weight:600;padding:0 6px;color:#1a73e8;">Hồ sơ đính kèm</legend>
          <div id="hsDinhKem"><div class="empty-hint" style="padding:8px;">Đang tải...</div></div>
        </fieldset>
        <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;margin:0 0 12px;">
          <legend style="font-weight:600;padding:0 6px;color:#1a73e8;">
            Người phụ thuộc (<span id="hsSoNPT">0</span>)</legend>
          <div id="hsNPT"><div class="empty-hint" style="padding:8px;">Đang tải...</div></div>
        </fieldset>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">${id ? 'Lưu thay đổi' : 'Thêm nhân viên'}</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);

    /* v8.80 — chọn ảnh thì tải lên NGAY, ô ẩn giữ tên lưu. Tải ngay (thay vì gom lúc bấm Lưu) để
       người dùng thấy ảnh hiện ra và biết đã nhận được; cũng là cách mọi màn khác trong hệ thống
       đang làm (module.khohang/qlsx dùng uploadFile khi chọn). */
    const elAnhFile = modal.querySelector('#f_anhFile');
    const elAnhXem = modal.querySelector('#f_anhXem');
    const elAnhTrong = modal.querySelector('#f_anhTrong');
    const elAnh = modal.querySelector('#f_anh');
    const elAnhXoa = modal.querySelector('#f_anhXoa');
    const veAnh = (ten) => {
      elAnh.value = ten || '';
      if (ten) { elAnhXem.src = urlXemHR(ten); elAnhXem.style.display = ''; elAnhTrong.style.display = 'none'; elAnhXoa.style.display = ''; }
      else { elAnhXem.src = ''; elAnhXem.style.display = 'none'; elAnhTrong.style.display = 'flex'; elAnhXoa.style.display = 'none'; }
    };
    elAnhFile.addEventListener('change', async () => {
      const file = elAnhFile.files && elAnhFile.files[0];
      if (!file) return;
      try {
        const kq = await uploadHoSo(file);
        veAnh(kq.tenLuu);
        toast('Đã tải ảnh lên.', 'success');
      } catch (err) { toast(err.message, 'error'); }
      elAnhFile.value = '';
    });
    elAnhXoa.addEventListener('click', () => veAnh(''));

    /* v8.88 — hai danh sách CHỜ, chỉ dùng khi thêm mới (chưa có NhanVienID).
       Khi sửa thì dùng lại nguyên hai hàm của màn Hồ sơ: ghi ngay, không chờ bấm Lưu — giữ đúng
       hành vi cũ, và không có bản thứ hai của cùng một khối để trôi khỏi nhau. */
    const dkCho = [], nptCho = [];
    if (id) { veDinhKem(modal, id); veNguoiPhuThuoc(modal, id); }
    else { veDinhKemCho(modal, dkCho); veNPTCho(modal, nptCho); }

    modal.querySelector('#nvForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        maNhanVien: val(modal, 'f_maNV'), hoTen: val(modal, 'f_hoTen'), ngaySinh: val(modal, 'f_ngaySinh'),
        gioiTinh: val(modal, 'f_gioiTinh'), soCCCD: val(modal, 'f_soCCCD'), ngayCapCCCD: val(modal, 'f_ngayCapCCCD'),
        noiCapCCCD: val(modal, 'f_noiCapCCCD'), sdt: val(modal, 'f_sdt'), email: val(modal, 'f_email'),
        diaChi: val(modal, 'f_diaChi'), boPhanId: val(modal, 'f_boPhan'), chucVu: val(modal, 'f_chucVu'),
        chuyenMon: val(modal, 'f_chuyenMon'), ngayVao: val(modal, 'f_ngayVao'), trangThaiLaoDong: val(modal, 'f_ttLaoDong'),
        /* v8.88 — CON SỐ NÀY VÀO THẲNG GIẢM TRỪ GIA CẢNH, hai đường xử lý khác nhau:

           SỬA: gửi giá trị đang hiện trên ô (chỉ đọc, luôn bằng số dòng thật vì veNguoiPhuThuoc()
             vẽ lại nó sau mỗi lần thêm/xóa). KHÔNG lấy nv.SoNguoiPhuThuoc đọc lúc mở form — người
             dùng thêm một người rồi mới bấm Lưu thì số đó đã cũ, gửi lên là ghi đè ngược số backend
             vừa đồng bộ, mất đúng một suất giảm trừ.

           THÊM MỚI: gửi 0, KHÔNG gửi nptCho.length. Lúc này các dòng NguoiPhuThuoc chưa chèn.
             Gửi 2 rồi cả 2 lần chèn đều hỏng (mạng, quyền) là cột còn nguyên 2 trong khi bảng rỗng
             ⇒ payroll cho 2 suất giảm trừ cho người không có ai phụ thuộc, không ai phát hiện.
             dongBoSoNPT() ở backend chạy sau mỗi lần chèn và là nơi DUY NHẤT được ghi cột này. */
        soNguoiPhuThuoc: id ? val(modal, 'f_npt') : 0,
        soTaiKhoanNH: val(modal, 'f_stk'), tenNganHang: val(modal, 'f_tenNH'),
        chiNhanhNH: val(modal, 'f_cnNH'), maSoThueCaNhan: val(modal, 'f_mst'), ngayCapMST: val(modal, 'f_ngayCapMST'),
        soSoBHXH: val(modal, 'f_bhxh'), ghiChu: val(modal, 'f_ghiChu'),
        maChamCong: val(modal, 'f_maChamCong'),   // v5.59: gán mã trên máy chấm công ngay từ hồ sơ
        anhDaiDien: elAnh.value || null,          // v8.80: TÊN LƯU trong uploads_hr, không phải đường dẫn
        quocTich: val(modal, 'f_quocTich')        // v8.82: in trên HĐLĐ
      };
      try {
        if (id) {
          await apiPut('/api/hrm/nhanvien/' + id, payload);
          closeModal(); toast('Đã lưu hồ sơ nhân sự.', 'success');
          await reloadRefs(); renderHoSo();
          return;
        }
        const kq = await apiPost('/api/hrm/nhanvien', payload);
        const idMoi = kq && kq.data && kq.data.NhanVienID;
        if (!idMoi) throw new Error('Máy chủ không trả về mã nhân viên vừa tạo.');

        /* ⚠️ KHÔNG XÓA nhân viên vừa tạo khi phần phụ ghi lỗi. Rollback ở đây là xóa mất cả hồ sơ
           người dùng vừa gõ chỉ vì một file hỏng — tệ hơn nhiều so với thiếu một đính kèm.
           Ghi được bao nhiêu thì ghi, đếm số hỏng, báo rõ rồi MỞ LUÔN hồ sơ để bổ sung tại chỗ. */
        const hong = [];
        for (const x of dkCho) {
          try { await apiPost('/api/hrm/nhanvien/' + idMoi + '/dinhkem', x); }
          catch (err) { hong.push('file "' + (x.tenFile || '') + '": ' + err.message); }
        }
        for (const x of nptCho) {
          try { await apiPost('/api/hrm/nhanvien/' + idMoi + '/nguoiphuthuoc', x.payload); }
          catch (err) { hong.push('người phụ thuộc "' + (x.payload.hoTen || '') + '": ' + err.message); }
        }
        closeModal();
        await reloadRefs(); renderHoSo();
        if (hong.length) {
          toast(`Đã lưu nhân viên, nhưng ${hong.length} mục chưa ghi được: ${hong.join('; ')}`, 'error');
          openNhanVienDetail(idMoi);   // mở hồ sơ để bổ sung ngay, khỏi đi tìm lại trong danh sách
        } else {
          toast('Đã lưu hồ sơ nhân sự.', 'success');
        }
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     v8.88 — HAI KHỐI "CHỜ" dùng khi thêm mới nhân viên (chưa có NhanVienID)

     Hiển thị y như hai khối thật ở màn Hồ sơ, nhưng ghi vào mảng trong bộ nhớ thay vì gọi API.
     Có một dòng nhắc rõ "lưu khi bấm Thêm nhân viên" — người dùng phải biết những mục này CHƯA nằm
     trong CSDL, không thì họ đóng cửa sổ và tưởng đã lưu.

     ⚠️ FILE THÌ ĐÃ LÊN ĐĨA NGAY lúc chọn (phải vậy, vì route /upload là chỗ duy nhất nhận file).
     Bấm Hủy ⇒ file nằm lại trong uploads_hr/ mà không bản ghi nào trỏ tới. ẢNH CHÂN DUNG ĐÃ NHƯ VẬY
     TỪ v8.80 — không phải lỗi mới. Dọn file mồ côi là việc riêng (quét đối chiếu bảng
     HoSoDinhKemNhanVien + cột AnhDaiDien), cố ý KHÔNG gộp vào đây.
     ================================================================================================ */
  const GHI_CHU_CHO = '<div class="empty-hint" style="margin-top:4px;">Các mục này được lưu khi bấm <b>Thêm nhân viên</b>. Bấm Hủy là mất.</div>';

  function veDinhKemCho(modal, ds) {
    const box = modal.querySelector('#hsDinhKem');
    if (!box) return;
    box.innerHTML = `
      ${ds.length ? `<table style="font-size:13px;"><thead><tr>
          <th>Loại giấy tờ</th><th>Tên file</th><th>Ngày văn bản</th><th>Cỡ</th><th style="width:80px;"></th>
        </tr></thead><tbody>${ds.map((r, i) => `<tr>
          <td>${escapeHtml(r.loaiGiayTo || '')}</td>
          <td><b>${escapeHtml(r.tenFile || '')}</b></td>
          <td>${r.ngayVanBan ? fmtDate(r.ngayVanBan) : ''}</td>
          <td>${fmtKB(r.kichThuoc)}</td>
          <td><button type="button" class="btn small danger act-dkc-xoa" data-i="${i}">Bỏ</button></td>
        </tr>`).join('')}</tbody></table>`
        : '<div class="empty-hint" style="padding:8px;">Chưa chọn file nào.</div>'}
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select id="dkcLoai" style="max-width:200px;"><option value="">-- Loại giấy tờ --</option>
          ${LOAI_GIAY_TO.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}</select>
        <input type="date" id="dkcNgay" title="Ngày trên văn bản" style="max-width:160px;">
        <input type="file" id="dkcFile" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx">
        <span class="empty-hint" id="dkcTT"></span>
      </div>
      ${GHI_CHU_CHO}`;
    box.querySelectorAll('.act-dkc-xoa').forEach(b => b.addEventListener('click', () => {
      ds.splice(Number(b.dataset.i), 1);
      veDinhKemCho(modal, ds);
    }));
    const elFile = box.querySelector('#dkcFile');
    elFile.addEventListener('change', async () => {
      const file = elFile.files && elFile.files[0];
      if (!file) return;
      const tt = box.querySelector('#dkcTT');
      tt.textContent = 'Đang tải lên...';
      try {
        const kq = await uploadHoSo(file);
        ds.push({
          tenLuu: kq.tenLuu, tenFile: kq.tenFile, kichThuoc: kq.kichThuoc,
          loaiGiayTo: (box.querySelector('#dkcLoai') || {}).value || null,
          ngayVanBan: (box.querySelector('#dkcNgay') || {}).value || null
        });
        veDinhKemCho(modal, ds);
      } catch (err) { tt.textContent = ''; toast(err.message, 'error'); }
    });
  }

  function veNPTCho(modal, ds) {
    const box = modal.querySelector('#hsNPT');
    if (!box) return;
    const oSo = modal.querySelector('#hsSoNPT'); if (oSo) oSo.textContent = ds.length;
    const oNhap = modal.querySelector('#f_npt'); if (oNhap) oNhap.value = ds.length;
    box.innerHTML = `
      ${ds.length ? `<table style="font-size:13px;"><thead><tr>
          <th>Họ và tên</th><th>Quan hệ</th><th>Ngày sinh</th><th>MST</th><th>Từ tháng</th>
          <th>Hồ sơ</th><th style="width:110px;"></th></tr></thead>
        <tbody>${ds.map((r, i) => `<tr>
          <td><b>${escapeHtml(r.hienThi.HoTen || '')}</b></td>
          <td>${escapeHtml(r.hienThi.QuanHe || '')}</td>
          <td>${r.hienThi.NgaySinh ? fmtDate(r.hienThi.NgaySinh) : ''}</td>
          <td>${escapeHtml(r.hienThi.MaSoThue || '')}</td>
          <td>${r.hienThi.TuThang ? fmtDate(r.hienThi.TuThang) : ''}</td>
          <td>${Number(r.hienThi.DuHoSo) === 1 ? '<span style="color:#137333;">✔ Đủ hồ sơ</span>' : '<span style="color:#b06000;">Chưa đủ</span>'}</td>
          <td><button type="button" class="btn small secondary act-nptc-sua" data-i="${i}">Sửa</button>
              <button type="button" class="btn small danger act-nptc-xoa" data-i="${i}">Bỏ</button></td>
        </tr>`).join('')}</tbody></table>`
        : '<div class="empty-hint" style="padding:8px;">Chưa khai người phụ thuộc nào.</div>'}
      <button type="button" class="btn small secondary" id="nptcThem" style="margin-top:8px;">+ Thêm người phụ thuộc</button>
      ${GHI_CHU_CHO}`;
    box.querySelector('#nptcThem').addEventListener('click', () =>
      formNPT(null, null, null, p => { ds.push(goiNPT(p)); veNPTCho(modal, ds); }));
    box.querySelectorAll('.act-nptc-sua').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      formNPT(ds[i].hienThi, null, null, p => { ds[i] = goiNPT(p); veNPTCho(modal, ds); });
    }));
    box.querySelectorAll('.act-nptc-xoa').forEach(b => b.addEventListener('click', () => {
      ds.splice(Number(b.dataset.i), 1);
      veNPTCho(modal, ds);
    }));
  }
  /* Giữ CẢ HAI dạng của một người phụ thuộc đang chờ: `payload` (camelCase) để gửi lên API, và
     `hienThi` (đúng tên cột CSDL) để vẽ bảng và mở lại form sửa — formNPT() đọc theo tên cột. */
  function goiNPT(p) {
    return {
      payload: p,
      hienThi: {
        HoTen: p.hoTen, QuanHe: p.quanHe, NgaySinh: p.ngaySinh, SoGiayTo: p.soGiayTo,
        MaSoThue: p.maSoThue, TuThang: p.tuThang, DenThang: p.denThang,
        DuHoSo: p.duHoSo ? 1 : 0, GhiChu: p.ghiChu
      }
    };
  }

  async function deleteNhanVien(id) {
    if (!confirm('Xóa nhân viên này? (Nếu nhân viên đã có dữ liệu sản xuất/lương thì không xóa được — hãy chuyển trạng thái "Đã nghỉ việc").')) return;
    try { await apiDelete('/api/hrm/nhanvien/' + id); toast('Đã xóa.', 'success'); await reloadRefs(); renderHoSo(); }
    catch (err) { toast(err.message, 'error'); }
  }

  /* ================================================================================================
     v8.80 — KHỐI "HỒ SƠ ĐÍNH KÈM" trong màn Hồ sơ nhân viên
     Vẽ vào một thẻ div có sẵn (#hsDinhKem) sau khi modal đã mở — không dựng cùng lúc với modal vì
     phải gọi thêm một API nữa, chờ nó xong mới mở modal thì người dùng thấy màn hình đứng.
     ================================================================================================ */
  async function veDinhKem(modal, nhanVienId) {
    const box = modal.querySelector('#hsDinhKem');
    if (!box) return;
    let rows = [];
    try { rows = (await apiGet('/api/hrm/nhanvien/' + nhanVienId + '/dinhkem')).data || []; }
    catch (e) { box.innerHTML = `<div class="empty-hint">Không đọc được danh sách file: ${escapeHtml(e.message)}</div>`; return; }
    box.innerHTML = `
      ${rows.length ? `<table style="font-size:13px;"><thead><tr>
          <th>Loại giấy tờ</th><th>Tên file</th><th>Ngày văn bản</th><th>Cỡ</th><th>Người tải</th>
          <th style="width:150px;">Thao tác</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${escapeHtml(r.LoaiGiayTo || '')}</td>
          <td><a href="${urlXemHR(r.TenLuu)}" target="_blank" rel="noopener"><b>${escapeHtml(r.TenFile || '')}</b></a></td>
          <td>${fmtDate(r.NgayVanBan)}</td>
          <td>${fmtKB(r.KichThuoc)}</td>
          <td>${escapeHtml(r.NguoiTai || '')}</td>
          <td>
            <a class="btn small secondary" href="${urlTaiHR(r.TenLuu)}">Tải về</a>
            ${/* v8.88: type="button" BẮT BUỘC — khối này giờ còn nằm trong <form> của màn thêm/sửa
                 nhân viên. Thiếu type, trình duyệt coi là nút submit: bấm Xóa file là lưu luôn
                 hồ sơ. */''}
            ${perm.canDelete ? `<button type="button" class="btn small danger act-dk-xoa" data-id="${r.DinhKemID}">Xóa</button>` : ''}
          </td></tr>`).join('')}</tbody></table>`
        : '<div class="empty-hint" style="padding:8px;">Chưa có file nào.</div>'}
      ${perm.canEdit ? `<div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <select id="dkLoai" style="max-width:200px;"><option value="">-- Loại giấy tờ --</option>
            ${LOAI_GIAY_TO.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}</select>
          <input type="date" id="dkNgay" title="Ngày trên văn bản" style="max-width:160px;">
          <input type="file" id="dkFile" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx">
          <span class="empty-hint" id="dkTT"></span>
        </div>` : ''}`;
    box.querySelectorAll('.act-dk-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa file này khỏi hồ sơ? File sẽ bị xóa hẳn khỏi máy chủ.')) return;
      try {
        await apiDelete('/api/hrm/dinhkem/' + b.dataset.id);
        toast('Đã xóa file.', 'success');
        veDinhKem(modal, nhanVienId);
      } catch (err) { toast(err.message, 'error'); }
    }));
    const elFile = box.querySelector('#dkFile');
    if (elFile) elFile.addEventListener('change', async () => {
      const file = elFile.files && elFile.files[0];
      if (!file) return;
      const tt = box.querySelector('#dkTT');
      tt.textContent = 'Đang tải lên...';
      try {
        const kq = await uploadHoSo(file);
        await apiPost('/api/hrm/nhanvien/' + nhanVienId + '/dinhkem', {
          tenLuu: kq.tenLuu, tenFile: kq.tenFile, kichThuoc: kq.kichThuoc,
          loaiGiayTo: (box.querySelector('#dkLoai') || {}).value || null,
          ngayVanBan: (box.querySelector('#dkNgay') || {}).value || null
        });
        toast('Đã thêm file vào hồ sơ.', 'success');
        veDinhKem(modal, nhanVienId);
      } catch (err) { tt.textContent = ''; toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     v8.80 — KHỐI "NGƯỜI PHỤ THUỘC"
     ⚠️ Mỗi lần thêm/sửa/xóa, backend tự cập nhật NhanVien.SoNguoiPhuThuoc (cột payroll.js dùng tính
     giảm trừ gia cảnh). Vì vậy sau mỗi thao tác phải vẽ lại cả con số đó trên màn hình, không thì
     người dùng thấy "Số người phụ thuộc: 1" trong khi bảng đã có 2 dòng.
     ================================================================================================ */
  async function veNguoiPhuThuoc(modal, nhanVienId) {
    const box = modal.querySelector('#hsNPT');
    if (!box) return;
    let rows = [];
    try { rows = (await apiGet('/api/hrm/nhanvien/' + nhanVienId + '/nguoiphuthuoc')).data || []; }
    catch (e) { box.innerHTML = `<div class="empty-hint">Không đọc được: ${escapeHtml(e.message)}</div>`; return; }
    const oSo = modal.querySelector('#hsSoNPT');
    if (oSo) oSo.textContent = rows.length;
    /* v8.88: form Sửa hồ sơ cũng có khối này, và có thêm ô "Số người phụ thuộc" (chỉ đọc). Backend
       vừa đồng bộ lại con số, nên phải vẽ lại cả ô đó — không thì người dùng vừa thêm một người mà
       ô vẫn hiện số cũ. */
    const oNhap = modal.querySelector('#f_npt');
    if (oNhap) oNhap.value = rows.length;
    box.innerHTML = `
      ${rows.length ? `<table style="font-size:13px;"><thead><tr>
          <th>Họ và tên</th><th>Quan hệ</th><th>Ngày sinh</th><th>MST</th><th>Từ tháng</th>
          <th>Hồ sơ</th><th style="width:110px;">Thao tác</th></tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td><b>${escapeHtml(r.HoTen || '')}</b></td>
          <td>${escapeHtml(r.QuanHe || '')}</td>
          <td>${fmtDate(r.NgaySinh)}</td>
          <td>${escapeHtml(r.MaSoThue || '')}</td>
          <td>${fmtDate(r.TuThang)}</td>
          <td>${Number(r.DuHoSo) === 1 ? '<span style="color:#137333;">✔ Đủ hồ sơ</span>' : '<span style="color:#b06000;">Chưa đủ</span>'}</td>
          <td>
            ${/* v8.88: type="button" BẮT BUỘC — xem ghi chú ở veDinhKem(). */''}
            ${perm.canEdit ? `<button type="button" class="btn small secondary act-npt-sua" data-id="${r.NPTID}">Sửa</button>` : ''}
            ${perm.canDelete ? `<button type="button" class="btn small danger act-npt-xoa" data-id="${r.NPTID}">Xóa</button>` : ''}
          </td></tr>`).join('')}</tbody></table>`
        : '<div class="empty-hint" style="padding:8px;">Chưa khai người phụ thuộc nào.</div>'}
      ${perm.canCreate ? '<button type="button" class="btn small secondary" id="nptThem" style="margin-top:8px;">+ Thêm người phụ thuộc</button>' : ''}
      <div class="empty-hint" style="margin-top:4px;">Số người phụ thuộc dùng tính giảm trừ gia cảnh được lấy bằng đúng số dòng ở bảng này.</div>`;
    const btnThem = box.querySelector('#nptThem');
    if (btnThem) btnThem.addEventListener('click', () => formNPT(null, nhanVienId, modal));
    box.querySelectorAll('.act-npt-sua').forEach(b => b.addEventListener('click', () =>
      formNPT(rows.find(x => String(x.NPTID) === b.dataset.id), nhanVienId, modal)));
    box.querySelectorAll('.act-npt-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa người phụ thuộc này? Số người phụ thuộc dùng tính thuế TNCN sẽ giảm theo.')) return;
      try {
        await apiDelete('/api/hrm/nguoiphuthuoc/' + b.dataset.id);
        toast('Đã xóa.', 'success');
        veNguoiPhuThuoc(modal, nhanVienId);
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  /* `luuTam`: v8.88 — khi form nhân viên chưa có NhanVienID. Có hàm này thì KHÔNG gọi API, chỉ trả
     payload về cho bên gọi giữ trong bộ nhớ. Ba tham số đầu giữ nguyên nên mọi chỗ gọi cũ không đổi. */
  function formNPT(npt, nhanVienId, modalCha, luuTam) {
    const e = npt || {};
    const f = (label, inner) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}</div>`;
    const m = openModal(`
      <h3>${npt ? 'Sửa người phụ thuộc' : 'Thêm người phụ thuộc'}</h3>
      <form id="nptForm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
          ${f('Họ và tên *', `<input id="p_hoTen" value="${escapeHtml(e.HoTen || '')}" required>`)}
          ${f('Quan hệ', `<input id="p_quanHe" value="${escapeHtml(e.QuanHe || '')}" placeholder="Con / Vợ / Chồng / Cha / Mẹ">`)}
          ${f('Ngày sinh', `<input type="date" id="p_ngaySinh" value="${dInput(e.NgaySinh)}">`)}
          ${f('CCCD / Giấy khai sinh', `<input id="p_soGiayTo" value="${escapeHtml(e.SoGiayTo || '')}">`)}
          ${f('Mã số thuế NPT', `<input id="p_mst" value="${escapeHtml(e.MaSoThue || '')}">`)}
          ${f('Giảm trừ từ tháng', `<input type="date" id="p_tuThang" value="${dInput(e.TuThang)}">`)}
          ${f('Đến tháng (để trống nếu còn hiệu lực)', `<input type="date" id="p_denThang" value="${dInput(e.DenThang)}">`)}
          ${f('Hồ sơ', `<label style="font-weight:400;"><input type="checkbox" id="p_duHoSo" ${Number(e.DuHoSo) === 1 ? 'checked' : ''}> Đã nộp đủ giấy tờ</label>`)}
        </div>
        ${f('Ghi chú', `<input id="p_ghiChu" value="${escapeHtml(e.GhiChu || '')}">`)}
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="pCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`);
    m.querySelector('#pCancel').addEventListener('click', closeModal);
    m.querySelector('#nptForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = {
        hoTen: val(m, 'p_hoTen'), quanHe: val(m, 'p_quanHe'), ngaySinh: val(m, 'p_ngaySinh'),
        soGiayTo: val(m, 'p_soGiayTo'), maSoThue: val(m, 'p_mst'),
        tuThang: val(m, 'p_tuThang'), denThang: val(m, 'p_denThang'),
        duHoSo: m.querySelector('#p_duHoSo').checked, ghiChu: val(m, 'p_ghiChu')
      };
      if (luuTam) {                     // v8.88: nhân viên chưa tồn tại — chưa có gì để gọi API
        luuTam(payload);
        closeModal();                   // modal stack của common.js trả lại form nhân viên đang mở
        return;
      }
      try {
        if (npt) await apiPut('/api/hrm/nguoiphuthuoc/' + npt.NPTID, payload);
        else await apiPost('/api/hrm/nhanvien/' + nhanVienId + '/nguoiphuthuoc', payload);
        closeModal();   // modal stack của common.js trả lại màn hồ sơ đang mở
        toast('Đã lưu người phụ thuộc.', 'success');
        if (modalCha) veNguoiPhuThuoc(modalCha, nhanVienId);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // Chi tiet ho so: thong tin day du + tom tat HD/PL/QD/thanh ly cua nhan vien do (co nut them nhanh).
  async function openNhanVienDetail(id) {
    let nv;
    try { nv = (await apiGet('/api/hrm/nhanvien/' + id)).data; } catch (e) { toast(e.message, 'error'); return; }
    if (!nv) return;
    const row = (k, v) => `<div style="display:flex;gap:8px;"><b style="min-width:150px;color:#5f6368;">${k}:</b><span>${v || ''}</span></div>`;
    /* v8.81 — mỗi dòng văn bản BẤM ĐƯỢC để mở chi tiết (xem đầy đủ + In + Sửa + file đính kèm).
       Trước đây bảng này chỉ đọc: muốn xem/in một quyết định phải thoát hồ sơ, sang tab Quyết định,
       tìm lại đúng dòng đó. `loai` dùng để biết mở modal nào và gọi hàm in nào. */
    const docList = (title, items, cols, loai) => `
      <h4 style="margin:14px 0 6px;">${title} <span style="color:#5f6368;font-weight:400;">(${items.length})</span></h4>
      ${items.length ? `<table style="font-size:13px;"><thead><tr>${cols.map(c => `<th>${c.h}</th>`).join('')}</tr></thead>
        <tbody>${items.map((it, i) => `<tr class="vb-dong" data-loai="${loai}" data-i="${i}" style="cursor:pointer;" title="Bấm để xem chi tiết">
          ${cols.map(c => `<td>${c.f(it)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        : `<div class="empty-hint" style="padding:8px;">Chưa có.</div>`}`;
    const html = `
      <h3>Hồ sơ: ${escapeHtml(nv.HoTen)} <span style="color:#5f6368;font-weight:400;">(${escapeHtml(nv.MaNhanVien || '')})</span></h3>
      ${/* v8.80: ảnh chân dung — đọc qua route có kiểm quyền, không phải /uploads công khai. */''}
      ${nv.AnhDaiDien ? `<div style="float:right;margin:0 0 8px 12px;">
          <img src="${urlXemHR(nv.AnhDaiDien)}" style="width:110px;height:140px;object-fit:cover;border:1px solid #dadce0;border-radius:6px;">
        </div>` : ''}
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
        ${row('Số người phụ thuộc', `<span id="hsSoNPT">${nv.SoNguoiPhuThuoc != null ? nv.SoNguoiPhuThuoc : 0}</span>`)}
      </div>
      <div style="clear:both;"></div>
      ${/* v8.80 — hai khối này vẽ SAU khi modal mở (mỗi khối một lần gọi API riêng). Dựng sẵn thẻ
           rỗng ở đây để không phải chờ 2 API xong mới thấy được hồ sơ. */''}
      <h4 style="margin:14px 0 6px;">Hồ sơ đính kèm</h4>
      <div id="hsDinhKem"><div class="empty-hint" style="padding:8px;">Đang tải...</div></div>
      <h4 style="margin:14px 0 6px;">Người phụ thuộc</h4>
      <div id="hsNPT"><div class="empty-hint" style="padding:8px;">Đang tải...</div></div>
      ${docList('Hợp đồng lao động', nv.hopDong, [
        { h: 'Số HĐ', f: h => escapeHtml(h.SoHopDong || '') }, { h: 'Loại', f: h => escapeHtml(h.LoaiHopDong || '') },
        { h: 'Từ ngày', f: h => fmtDate(h.TuNgay) }, { h: 'Đến ngày', f: h => fmtDate(h.DenNgay) },
        { h: 'Lương CB', f: h => money(h.LuongCoBan) }, { h: 'Trạng thái', f: h => escapeHtml(h.TrangThai || '') }], 'hopDong')}
      ${docList('Phụ lục hợp đồng', nv.phuLuc, [
        { h: 'Số PL', f: p => escapeHtml(p.SoPhuLuc || '') }, { h: 'Ngày ký', f: p => fmtDate(p.NgayKy) },
        { h: 'Hiệu lực', f: p => fmtDate(p.NgayHieuLuc) }, { h: 'Lương mới', f: p => money(p.LuongCoBanMoi) }], 'phuLuc')}
      ${docList('Quyết định', nv.quyetDinh, [
        { h: 'Số QĐ', f: q => escapeHtml(q.SoQuyetDinh || '') }, { h: 'Loại', f: q => escapeHtml(q.LoaiQuyetDinh || '') },
        { h: 'Hiệu lực', f: q => fmtDate(q.NgayHieuLuc) }, { h: 'Cũ→Mới', f: q => `${escapeHtml(q.GiaTriCu || '')} → ${escapeHtml(q.GiaTriMoi || '')}` }], 'quyetDinh')}
      ${docList('Thanh lý hợp đồng', nv.thanhLy, [
        { h: 'Ngày nghỉ', f: t => fmtDate(t.NgayNghiViec) }, { h: 'Lý do', f: t => escapeHtml(t.LyDoNghi || '') },
        { h: 'Bàn giao', f: t => escapeHtml(t.TrangThaiBanGiao || '') }], 'thanhLy')}
      <div class="empty-hint" style="margin-top:4px;">Bấm vào một dòng văn bản ở trên để xem chi tiết, in hoặc sửa.</div>
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
    // v8.80: vẽ 2 khối cần API riêng, chạy song song cho nhanh. Lỗi của khối này không chặn khối kia.
    veDinhKem(modal, id);
    veNguoiPhuThuoc(modal, id);
    /* v8.81: bấm 1 dòng văn bản -> mở chi tiết. Lấy dữ liệu từ chính mảng đã tải (nv.hopDong...),
       KHÔNG gọi lại API — dòng đang hiện trên màn hình chính là dòng người dùng vừa bấm. */
    modal.querySelectorAll('.vb-dong').forEach(tr => tr.addEventListener('click', () => {
      const ds = nv[tr.dataset.loai] || [];
      const item = ds[Number(tr.dataset.i)];
      if (item) xemVanBan(tr.dataset.loai, item, nv, id);
    }));
  }

  /* ================================================================================================
     v8.81 — XEM CHI TIẾT 1 VĂN BẢN (hợp đồng / phụ lục / quyết định / thanh lý) ngay từ màn Hồ sơ
     ------------------------------------------------------------------------------------------------
     Chỉ XEM + In + Sửa + mở file scan. Không gọi thêm API: dữ liệu lấy từ mảng đã tải cùng hồ sơ.
     Modal stack của common.js tự trả lại màn Hồ sơ khi đóng.
     ================================================================================================ */
  const CAU_HINH_VAN_BAN = {
    hopDong: {
      tieuDe: h => 'Hợp đồng lao động ' + (h.SoHopDong || ''),
      in: h => printHopDong(h),
      sua: (h, nvId) => openHopDongForm(h.HopDongID, nvId),
      dong: h => [
        ['Số hợp đồng', h.SoHopDong], ['Loại hợp đồng', h.LoaiHopDong], ['Trạng thái', h.TrangThai],
        ['Từ ngày', fmtDate(h.TuNgay)], ['Đến ngày', h.DenNgay ? fmtDate(h.DenNgay) : 'Không thời hạn'],
        ['Chức vụ', h.ChucVu], ['Nơi làm việc', h.NoiLamViec],
        ['Lương cơ bản', money(h.LuongCoBan) + ' đ'], ['Hệ số lương', h.HeSoLuong],
        ['Phụ cấp ăn ca', money(h.PhuCapAnCa) + ' đ'], ['Phụ cấp trang phục', money(h.PhuCapTrangPhuc) + ' đ'],
        ['Phụ cấp xăng xe', money(h.PhuCapXangXe) + ' đ'], ['Phụ cấp điện thoại', money(h.PhuCapDienThoai) + ' đ'],
        ['Ghi chú', h.GhiChu]
      ]
    },
    phuLuc: {
      tieuDe: p => 'Phụ lục hợp đồng ' + (p.SoPhuLuc || ''),
      in: p => printPhuLuc(p),
      sua: (p) => openPhuLucForm(p.PhuLucID),
      dong: p => [
        ['Số phụ lục', p.SoPhuLuc], ['Hợp đồng gốc', p.SoHopDong],
        ['Ngày ký', fmtDate(p.NgayKy)], ['Ngày hiệu lực', fmtDate(p.NgayHieuLuc)],
        ['Lương cơ bản mới', p.LuongCoBanMoi != null ? money(p.LuongCoBanMoi) + ' đ' : ''],
        ['Chức vụ mới', p.ChucVuMoi], ['Nội dung thay đổi', p.NoiDungThayDoi], ['Ghi chú', p.GhiChu]
      ]
    },
    quyetDinh: {
      tieuDe: q => 'Quyết định ' + (q.SoQuyetDinh || ''),
      in: q => printQuyetDinh(q),
      sua: (q, nvId) => openQuyetDinhForm(q.QuyetDinhID, nvId),
      dong: q => [
        ['Số quyết định', q.SoQuyetDinh], ['Loại quyết định', q.LoaiQuyetDinh],
        ['Ngày hiệu lực', fmtDate(q.NgayHieuLuc)],
        ['Giá trị cũ', q.GiaTriCu], ['Giá trị mới', q.GiaTriMoi],
        ['Nội dung', q.NoiDung], ['Ghi chú', q.GhiChu]
      ]
    },
    thanhLy: {
      tieuDe: () => 'Thanh lý hợp đồng',
      in: t => printThanhLy(t),
      sua: (t, nvId) => openThanhLyForm(t.ThanhLyID, nvId),
      dong: t => [
        ['Ngày nghỉ việc', fmtDate(t.NgayNghiViec)], ['Lý do nghỉ', t.LyDoNghi],
        ['Trợ cấp', t.TroCap != null ? money(t.TroCap) + ' đ' : ''],
        ['Khấu trừ', t.KhauTru != null ? money(t.KhauTru) + ' đ' : ''],
        ['Trạng thái bàn giao', t.TrangThaiBanGiao], ['Ghi chú', t.GhiChu]
      ]
    }
  };

  function xemVanBan(loai, item, nv, nhanVienId) {
    const cfg = CAU_HINH_VAN_BAN[loai];
    if (!cfg) return;
    // Hàm in cần tên nhân viên — các mảng trong hồ sơ không kèm HoTen như ở tab riêng.
    const duLieuIn = { ...item, HoTen: item.HoTen || nv.HoTen, MaNhanVien: item.MaNhanVien || nv.MaNhanVien };
    const dong = cfg.dong(item).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '');
    const m = openModal(`
      <h3>${escapeHtml(cfg.tieuDe(item))}</h3>
      <p class="p-meta">${escapeHtml(nv.HoTen || '')}${nv.MaNhanVien ? ' · ' + escapeHtml(nv.MaNhanVien) : ''}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:14px;">
        ${dong.map(([k, v]) => `<div style="display:flex;gap:8px;">
          <b style="min-width:150px;color:#5f6368;">${escapeHtml(k)}:</b><span>${escapeHtml(String(v))}</span></div>`).join('')}
      </div>
      ${item.FileDinhKem ? `<div style="margin-top:10px;">
          📎 <a href="${urlXemHR(item.FileDinhKem)}" target="_blank" rel="noopener">Xem bản scan đính kèm</a>
          · <a href="${urlTaiHR(item.FileDinhKem)}">Tải về</a>
        </div>` : '<div class="empty-hint" style="margin-top:10px;">Chưa gắn bản scan. Bấm Sửa để thêm file.</div>'}
      <div class="modal-actions" style="flex-wrap:wrap;gap:6px;">
        <button type="button" class="btn secondary" id="vbDong">Đóng</button>
        <button type="button" class="btn" id="vbIn">🖨️ In</button>
        ${perm.canEdit ? '<button type="button" class="btn secondary" id="vbSua">Sửa</button>' : ''}
      </div>`);
    m.querySelector('#vbDong').addEventListener('click', closeModal);
    m.querySelector('#vbIn').addEventListener('click', () => cfg.in(duLieuIn));
    const bSua = m.querySelector('#vbSua');
    if (bSua) bSua.addEventListener('click', () => cfg.sua(item, nhanVienId));
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
        ${/* v8.82 — các ô dưới đây phục vụ IN theo đúng mẫu hợp đồng của công ty.
             ⚠️ Chuyên cần / chức vụ / KPI CHỈ ĐỂ IN: payroll.js không cộng chúng vào bảng lương
             (xem ghi chú đầu migration_v877). Nói rõ ngay trên form để không ai tưởng khai vào là
             tự tính lương. */''}
        ${f('Ngày ký hợp đồng', `<input type="date" id="f_ngayKy" value="${dInput(h.NgayKy)}">`)}
        ${f('Quản lý trực tiếp', `<input id="f_qltt" value="${escapeHtml(h.QuanLyTrucTiep || '')}" placeholder="Ghi trên HĐ thử việc">`)}
        ${f('Phụ cấp chuyên cần', `<input type="number" id="f_chuyencan" value="${h.PhuCapChuyenCan != null ? h.PhuCapChuyenCan : ''}">`)}
        ${f('Phụ cấp chức vụ / trách nhiệm', `<input type="number" id="f_chucvu_pc" value="${h.PhuCapChucVu != null ? h.PhuCapChucVu : ''}">`)}
        ${f('Quỹ KPI tối đa / tháng', `<input type="number" id="f_kpi" value="${h.QuyKPI != null ? h.QuyKPI : ''}">`)}
        ${f('Số công chuẩn — xăng xe', `<input type="number" step="0.5" id="f_congxang" value="${h.SoCongXangXe != null ? h.SoCongXangXe : ''}" placeholder="VD: 26">`)}
        ${f('Số công chuẩn — ăn trưa', `<input type="number" step="0.5" id="f_congan" value="${h.SoCongAnTrua != null ? h.SoCongAnTrua : ''}" placeholder="VD: 26">`)}
        ${f('Tỷ lệ lương thử việc (%)', `<input type="number" step="0.01" id="f_tlthuviec" value="${h.TyLeThuViec != null ? h.TyLeThuViec : (h.HopDongID ? '' : 85)}" placeholder="85">`)}
        ${oFileVanBanHtml(h.FileDinhKem)}
      </div>
      <div class="empty-hint" style="margin-top:-4px;">Chuyên cần / chức vụ / KPI hiện <b>chỉ dùng để in hợp đồng</b> — bảng lương chưa tự cộng các khoản này.</div>
      ${f('Ghi chú', `<textarea id="f_gc" rows="2">${escapeHtml(h.GhiChu || '')}</textarea>`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wireOFileVanBan(modal);   // v8.80
    modal.querySelector('#hdForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        nhanVienId: id ? h.NhanVienID : val(modal, 'f_nv'), soHopDong: val(modal, 'f_so'), loaiHopDong: val(modal, 'f_loai'),
        trangThai: val(modal, 'f_tt'), tuNgay: val(modal, 'f_tu'), denNgay: val(modal, 'f_den'), chucVu: val(modal, 'f_cv'),
        noiLamViec: val(modal, 'f_nlv'), luongCoBan: val(modal, 'f_luong'), heSoLuong: val(modal, 'f_heso'),
        phuCapAnCa: val(modal, 'f_anca'), phuCapTrangPhuc: val(modal, 'f_tp'), phuCapXangXe: val(modal, 'f_xang'),
        phuCapDienThoai: val(modal, 'f_dt'), ghiChu: val(modal, 'f_gc'),
        fileDinhKem: val(modal, 'f_file') || null,  // v8.80: cột đã có từ v6.00, nay frontend mới gửi
        // v8.82 — 8 trường phục vụ in theo mẫu công ty
        ngayKy: val(modal, 'f_ngayKy'), quanLyTrucTiep: val(modal, 'f_qltt'),
        phuCapChuyenCan: val(modal, 'f_chuyencan'), phuCapChucVu: val(modal, 'f_chucvu_pc'),
        quyKPI: val(modal, 'f_kpi'), soCongXangXe: val(modal, 'f_congxang'),
        soCongAnTrua: val(modal, 'f_congan'), tyLeThuViec: val(modal, 'f_tlthuviec')
      };
      if (!payload.nhanVienId) { toast('Chọn nhân viên.', 'error'); return; }
      try {
        if (id) await apiPut('/api/hrm/hopdong/' + id, payload); else await apiPost('/api/hrm/hopdong', payload);
        closeModal(); toast('Đã lưu hợp đồng.', 'success');
        if (activeTab === 'hopdong') renderHopDong(); else closeModal();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     v8.82 — IN HỢP ĐỒNG THEO ĐÚNG MẪU CỦA CÔNG TY
     ------------------------------------------------------------------------------------------------
     Nguyen gửi 2 mẫu Word thật (HĐLĐ chính thức, HĐ thử việc). Bản cũ ở đây là mẫu tôi tự soạn —
     bố cục đúng nhưng câu chữ điều khoản khác hẳn, không dùng để ký được.

     CHỌN MẪU theo LoaiHopDong (Nguyen chốt 2026-10-10):
        'Thử việc'                  -> mẫu HỢP ĐỒNG THỬ VIỆC
        Xác định / Không xác định   -> mẫu HỢP ĐỒNG LAO ĐỘNG chính thức

     ⚠️ Chỗ nào CHƯA có dữ liệu thì in ra dấu chấm để điền tay, KHÔNG in "null"/"0 đồng".
     Hợp đồng là văn bản pháp lý: một ô "0 đồng" in nhầm còn tệ hơn một ô để trống.
     ================================================================================================ */
  // Dấu chấm điền tay khi thiếu dữ liệu — độ dài theo loại ô.
  const ch = (v, n) => (v == null || String(v).trim() === '' ? '.'.repeat(n || 20) : escapeHtml(String(v)));
  const chTien = (v) => (v == null || v === '' || Number(v) === 0 ? '..................' : money(v));
  const chNgay = (d) => (d ? dmy(d) : '..... / ..... / ..........');
  // "Hà Nội, ngày … tháng … năm …" — mẫu để trống khi chưa khai ngày ký.
  function dongNgayThang(d) {
    if (!d) return 'Hà Nội, ngày ...... tháng ...... năm ............';
    const x = new Date(d);
    return `Hà Nội, ngày ${String(x.getDate()).padStart(2, '0')} tháng ${String(x.getMonth() + 1).padStart(2, '0')} năm ${x.getFullYear()}`;
  }
  // Số năm của hợp đồng xác định thời hạn (mục 1.1 của mẫu: "… năm từ ngày … đến hết ngày …").
  function soNamHopDong(tu, den) {
    if (!tu || !den) return '......';
    const n = (new Date(den) - new Date(tu)) / (365.25 * 24 * 3600 * 1000);
    if (n <= 0) return '......';
    const lam = Math.round(n * 10) / 10;
    return Number.isInteger(lam) ? String(lam) : lam.toFixed(1);
  }
  function soNgayThuViec(tu, den) {
    if (!tu || !den) return '......';
    const n = Math.round((new Date(den) - new Date(tu)) / (24 * 3600 * 1000)) + 1;
    return n > 0 ? String(n) : '......';
  }
  /* v8.85 — khoiBenA() / khoiBenB() / tieuDeVanBan() / khoiKy() đã gỡ: nội dung của chúng nằm
     trong MAU_GOC (KHOI_TIEU_DE, KHOI_BEN_A, khoiKyMau và bảng BÊN B viết thẳng trong từng mẫu),
     vì người dùng phải sửa được cả tiêu đề lẫn khối ký. Giữ lại ở đây là có hai bản trôi khỏi nhau.
     docHeader() / signBlock() cũng đã gỡ — xem ghi chú ở chỗ cũ của chúng, phía dưới. */

  /* v8.85: bản in lấy mẫu từ MAU_GOC (hoặc bản người dùng đã sửa trong CSDL) thay vì dựng HTML tại chỗ.
     Các hàm mauHopDongChinhThuc()/mauHopDongThuViec()/mauQuyetDinh*() bên dưới đã GỠ — nội dung của
     chúng chuyển nguyên văn vào MAU_GOC, giữ lại hai bản là chắc chắn lệch nhau. */
  function printHopDong(h) {
    if (!h) return;
    const nv = nvCuaHoSo(h);
    const laThuViec = String(h.LoaiHopDong || '') === 'Thử việc';
    inVanBan(laThuViec ? 'HDLD_THUVIEC' : 'HDLD_CHINHTHUC', bienChoHopDong(h, nv),
      (laThuViec ? 'Hop dong thu viec - ' : 'Hop dong lao dong - ') + (h.SoHopDong || h.HoTen || ''));
  }

  /* Ghép bản ghi nhân viên đầy đủ (từ refs) với tên/mã nằm sẵn trên chính phiếu.
     Phiếu nào cũng có HoTen do JOIN sẵn ở backend; refs mới có CCCD, địa chỉ, bộ phận. */
  function nvCuaHoSo(rec) {
    const goc = refs.nhanVien.find(x => x.NhanVienID == rec.NhanVienID) || {};
    const them = {};
    if (rec.HoTen) them.HoTen = rec.HoTen;
    if (rec.MaNhanVien) them.MaNhanVien = rec.MaNhanVien;
    return Object.assign({}, goc, them);
  }

  /* v8.85 — hai mẫu hợp đồng đã chuyển sang MAU_GOC (HDLD_CHINHTHUC / HDLD_THUVIEC).
     Nội dung cũ gỡ khỏi đây để không có hai bản văn bản pháp lý trôi khỏi nhau. */

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
        ${oFileVanBanHtml(p.FileDinhKem)}
      </div>
      ${f('Nội dung thay đổi', `<textarea id="f_nd" rows="3">${escapeHtml(p.NoiDungThayDoi || '')}</textarea>`)}
      ${f('Ghi chú', `<textarea id="f_gc" rows="2">${escapeHtml(p.GhiChu || '')}</textarea>`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wireOFileVanBan(modal);   // v8.80
    modal.querySelector('#plForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        hopDongId: id ? p.HopDongID : val(modal, 'f_hd'), soPhuLuc: val(modal, 'f_so'), ngayKy: val(modal, 'f_ky'),
        ngayHieuLuc: val(modal, 'f_hl'), luongCoBanMoi: val(modal, 'f_luong'), chucVuMoi: val(modal, 'f_cv'),
        noiDungThayDoi: val(modal, 'f_nd'), ghiChu: val(modal, 'f_gc'),
        fileDinhKem: val(modal, 'f_file') || null   // v8.80
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
    inVanBan('PHULUC', bienChoPhuLuc(p, nvCuaHoSo(p)),
      'Phu luc HD - ' + (p.SoPhuLuc || p.HoTen || ''));
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
        ${f('Số quyết định', `<input id="f_so" value="${escapeHtml(q.SoQuyetDinh || '')}" placeholder="${id ? '' : 'Để trống → tự đánh số (VD: 05/2026/QĐTL)'}">`)}
        ${/* v8.82: mẫu quyết định có CẢ ngày ký ("Hà Nội, ngày…") lẫn ngày hiệu lực
             ("Thời điểm áp dụng: kể từ ngày…") — hai ngày này thường khác nhau. */''}
        ${f('Ngày ký quyết định', `<input type="date" id="f_ngayKy" value="${dInput(q.NgayKy)}">`)}
        ${f('Ngày hiệu lực (thời điểm áp dụng)', `<input type="date" id="f_hl" value="${dInput(q.NgayHieuLuc)}">`)}
        ${f('Giá trị cũ', `<input id="f_cu" value="${escapeHtml(q.GiaTriCu || '')}" placeholder="VD: lương cũ / chức vụ cũ">`)}
        ${f('Giá trị mới', `<input id="f_moi" value="${escapeHtml(q.GiaTriMoi || '')}" placeholder="VD: lương mới / chức vụ mới">`)}
        ${oFileVanBanHtml(q.FileDinhKem)}
      </div>
      ${f('Nội dung', `<textarea id="f_nd" rows="3">${escapeHtml(q.NoiDung || '')}</textarea>`)}
      ${f('Ghi chú', `<textarea id="f_gc" rows="2">${escapeHtml(q.GhiChu || '')}</textarea>`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wireOFileVanBan(modal);   // v8.80
    modal.querySelector('#qdForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        nhanVienId: id ? q.NhanVienID : val(modal, 'f_nv'), loaiQuyetDinh: val(modal, 'f_loai'), soQuyetDinh: val(modal, 'f_so'),
        ngayHieuLuc: val(modal, 'f_hl'), giaTriCu: val(modal, 'f_cu'), giaTriMoi: val(modal, 'f_moi'),
        noiDung: val(modal, 'f_nd'), ghiChu: val(modal, 'f_gc'),
        fileDinhKem: val(modal, 'f_file') || null,  // v8.80
        ngayKy: val(modal, 'f_ngayKy')              // v8.82
      };
      if (!payload.nhanVienId) { toast('Chọn nhân viên.', 'error'); return; }
      try {
        let kq;
        if (id) kq = await apiPut('/api/hrm/quyetdinh/' + id, payload);
        else kq = await apiPost('/api/hrm/quyetdinh', payload);
        closeModal();
        // v8.84: báo số vừa cấp để người dùng biết ngay, khỏi mở lại xem.
        const soMoi = kq && kq.data && kq.data.SoQuyetDinh;
        toast(soMoi && !id ? `Đã lưu quyết định số ${soMoi}.` : 'Đã lưu quyết định.', 'success');
        if (activeTab === 'quyetdinh') renderQuyetDinh();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     v8.82 — IN QUYẾT ĐỊNH
     ------------------------------------------------------------------------------------------------
     'Tăng lương' in theo ĐÚNG mẫu công ty Nguyen gửi (có Điều 1/2/3, khối "Nơi nhận", ký giám đốc).
     Bốn loại còn lại (Khen thưởng / Kỷ luật / Bổ nhiệm / Điều chuyển) GIỮ khuôn tổng quát cũ —
     Nguyen sẽ gửi mẫu riêng sau (chốt 2026-10-10). Đừng ép chúng vào mẫu tăng lương: Điều 2 của mẫu
     đó nói riêng về căn cứ trả lương, áp cho quyết định kỷ luật là sai nội dung.
     ================================================================================================ */
  function printQuyetDinh(q) {
    if (!q) return;
    const laTangLuong = String(q.LoaiQuyetDinh || '') === 'Tăng lương';
    inVanBan(laTangLuong ? 'QD_TANGLUONG' : 'QD_CHUNG', bienChoQuyetDinh(q, nvCuaHoSo(q)),
      'Quyet dinh - ' + (q.SoQuyetDinh || q.HoTen || ''));
  }

  /* v8.85 — hai mẫu quyết định đã chuyển sang MAU_GOC (QD_TANGLUONG / QD_CHUNG).
     v8.84 vẫn giữ: in NGUYÊN SoQuyetDinh, KHÔNG ghép thêm "/QĐTL" — backend đã sinh số đầy đủ
     (05/2026/QĐTL) khi để trống, ghép thêm sẽ ra "04/2026/QĐTL/QĐTL". */

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
        ${oFileVanBanHtml(t.FileDinhKem)}
      </div>
      ${f('Lý do nghỉ', `<textarea id="f_lydo" rows="2">${escapeHtml(t.LyDoNghi || '')}</textarea>`)}
      ${f('Ghi chú', `<textarea id="f_gc" rows="2">${escapeHtml(t.GhiChu || '')}</textarea>`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wireOFileVanBan(modal);   // v8.80
    modal.querySelector('#tlForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        nhanVienId: id ? t.NhanVienID : val(modal, 'f_nv'), ngayNghiViec: val(modal, 'f_ngay'), troCap: val(modal, 'f_trocap'),
        khauTru: val(modal, 'f_khautru'), trangThaiBanGiao: val(modal, 'f_bg'), lyDoNghi: val(modal, 'f_lydo'), ghiChu: val(modal, 'f_gc'),
        fileDinhKem: val(modal, 'f_file') || null   // v8.80
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
    inVanBan('THANHLY', bienChoThanhLy(t, nvCuaHoSo(t)), 'Thanh ly HD - ' + (t.HoTen || ''));
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

  /* v8.85 — docHeader() và signBlock() đã gỡ. Trước đây Phụ lục / Thanh lý / Quyết định chung dùng
     chúng; nay cả 6 mẫu đi qua MAU_GOC. Hai thay đổi về NỘI DUNG do việc này, cố ý:
       1. Đầu văn bản: docHeader() in "tên công ty / MST / địa chỉ" bên trái. MAU_GOC dùng khối tiêu
          đề hành chính (tên công ty + "Số: ..." bên trái, Quốc hiệu bên phải) cho ĐỒNG BỘ với mẫu
          hợp đồng và quyết định tăng lương mà Nguyen gửi. ⇒ Phụ lục và Thanh lý KHÔNG còn in MST và
          địa chỉ ở đầu trang. Muốn có lại thì vào tab "Mẫu văn bản" thêm vào, không phải sửa code.
       2. signBlock() in cột phải là "(Ký, đóng dấu)". Giữ lại bằng tham số thứ 5 của khoiKyMau()
          cho Phụ lục và Thanh lý. Hợp đồng/HĐTV để "(Ký, ghi rõ họ tên)" đúng như mẫu Word công ty. */

  // Khung A4 + CSS in (printHtml da bao <html>; day chi la phan body voi style rieng cho van ban HR).
  function wrapA4(inner) {
    return `<div style="max-width:720px;margin:0 auto;font-family:'Times New Roman',serif;font-size:14px;line-height:1.5;color:#000;">
      <style>@media print{@page{size:A4;margin:18mm 16mm;}} p{margin:6px 0;text-align:justify;} h2{font-size:18px;} table td{padding:2px 4px;}</style>
      ${inner}</div>`;
  }

  /* ================================================================================================
     v8.83 — TUỲ CHỌN IN CHO VĂN BẢN HÀNH CHÍNH (hợp đồng, quyết định)
     ------------------------------------------------------------------------------------------------
     Hai cờ này sửa đúng hai lỗi Nguyen báo 2026-10-10:

     noLetterhead: printHtml() MẶC ĐỊNH chèn sẵn một letterhead (tên công ty + địa chỉ + đường kẻ
       đậm) vào đầu mọi bản in — xem common.js, dòng dựng body. Với phiếu kho/bán hàng thì đúng,
       nhưng hợp đồng và quyết định ĐÃ CÓ khối tiêu đề riêng theo mẫu hành chính (tên công ty bên
       trái, Quốc hiệu bên phải) ⇒ in ra bị HAI tiêu đề chồng nhau.

     khongSoTrang: printHtml() tự đánh "Trang k/n" bằng cách đo chiều cao rồi RÓT nội dung vào các
       khối .p-page cao cố định. Cách đó hợp với phiếu có bảng (cắt được theo dòng), nhưng wrapA4()
       gói cả văn bản vào MỘT <div> duy nhất — không cắt nhỏ được, nên nguyên khối bị đẩy xuống và
       để lại TRANG TRẮNG ở đầu (hợp đồng dài 3-4 trang thì thấy rõ: 2 trang trắng).
       Bỏ đánh số ⇒ trình duyệt tự dàn trang tự nhiên như Word, không còn trang trắng.
       Đánh đổi: bản in không có dòng "Trang k/n" — với hợp đồng/quyết định thì không cần.
     ================================================================================================ */
  const IN_VAN_BAN = { noLetterhead: true, khongSoTrang: true };

  /* ================================================================================================
     v8.85 — MẪU VĂN BẢN SỬA ĐƯỢC
     ------------------------------------------------------------------------------------------------
     Mẫu gốc nằm ở MAU_GOC bên dưới. Người dùng sửa thì bản sửa lưu trong CSDL (bảng MauVanBanHRM)
     và được dùng thay cho bản gốc. Không có bản sửa ⇒ dùng bản gốc ⇒ CSDL chưa chạy migration_v878
     vẫn in bình thường.

     ⚠️ MỘT NGUỒN DUY NHẤT cho bản gốc: MAU_GOC trong file này. KHÔNG seed nội dung vào CSDL —
     seed là tạo bản sao thứ hai, sửa một bên thì bên kia không đổi theo và không ai biết bản nào đúng.

     Biến viết {{TenBien}}. Giá trị lấy từ bảng biến dựng ở biếnChoHopDong() / biếnChoQuyetDinh()...
     Biến không có giá trị ⇒ in dấu chấm để điền tay, KHÔNG in "0 đồng" hay "undefined".
     ================================================================================================ */
  let mauDaSua = null;    // cache các mẫu đã sửa
  let dangNapMau = null;  // Promise của lần nạp đang chạy

  /* ⚠️ Cache CẢ LỜI HỨA chứ không chỉ kết quả. Bản đầu gán mauDaSua = {} TRƯỚC await, nên hai lệnh
     in bấm gần nhau thì lệnh thứ hai thấy {} (truthy) và dùng ngay — IN BẰNG MẪU GỐC dù đã có bản
     sửa, mà không báo gì. Lỗi mạng cũng để lại {} kẹt suốt phiên, không bao giờ thử lại. */
  async function napMauDaSua() {
    if (mauDaSua) return mauDaSua;
    if (dangNapMau) return dangNapMau;
    dangNapMau = (async () => {
      try {
        const ra = {};
        (((await apiGet('/api/hrm/mauvanban')).data) || []).forEach(m => { ra[m.MaMau] = m.NoiDung; });
        mauDaSua = ra;
      } catch (e) {
        mauDaSua = null;   // không đọc được thì dùng mẫu gốc, và lần in sau VẪN thử lại
        return {};
      } finally { dangNapMau = null; }
      return mauDaSua;
    })();
    return dangNapMau;
  }

  // Lấy nội dung mẫu: bản đã sửa nếu có, không thì bản gốc trong code.
  function layMau(maMau) {
    const sua = mauDaSua && mauDaSua[maMau];
    return (sua && String(sua).trim()) ? sua : (MAU_GOC[maMau] ? MAU_GOC[maMau].than : '');
  }

  /* Thay {{Bien}} bằng giá trị. Biến KHÔNG có trong bảng thì giữ nguyên {{Bien}} để người sửa mẫu
     nhìn thấy ngay là mình gõ sai tên — thay bằng chuỗi rỗng sẽ làm lỗi biến mất không dấu vết. */
  function thayBien(mau, bien) {
    return String(mau || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (ca, ten) =>
      Object.prototype.hasOwnProperty.call(bien, ten) ? bien[ten] : ca);
  }

  // Tìm biến lạ trong mẫu (dùng ở màn sửa mẫu để cảnh báo trước khi lưu).
  function bienLa(mau, dsBienHopLe) {
    const thay = new Set();
    String(mau || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (ca, ten) => { thay.add(ten); return ca; });
    return [...thay].filter(t => !dsBienHopLe.includes(t));
  }

  async function inVanBan(maMau, bien, tieuDeFile) {
    await napMauDaSua();
    const mau = layMau(maMau);
    if (!mau) { toast('Không tìm thấy mẫu "' + maMau + '".', 'error'); return; }
    printHtml(tieuDeFile, wrapA4(thayBien(mau, bien)), IN_VAN_BAN);
  }

  /* --- Bảng biến dùng chung cho mọi mẫu --- */
  function bienCongTy() {
    return {
      TenCongTy: escapeHtml(COMPANY.ten),
      DiaChiCongTy: escapeHtml(COMPANY.diaChi),
      MaSoThueCongTy: escapeHtml(COMPANY.mst),
      TenGiamDoc: escapeHtml(COMPANY.giamDoc)
    };
  }
  function bienNhanVien(nv) {
    nv = nv || {};
    return {
      HoTen: ch(nv.HoTen, 25),
      MaNV: ch(nv.MaNhanVien, 12),
      NgaySinh: chNgay(nv.NgaySinh),
      GioiTinh: ch(nv.GioiTinh, 8),
      SoCCCD: ch(nv.SoCCCD, 15),
      NgayCapCCCD: chNgay(nv.NgayCapCCCD),
      NoiCapCCCD: ch(nv.NoiCapCCCD, 30),
      DiaChi: ch(nv.DiaChi, 40),
      SDT: ch(nv.SDT, 12),
      Email: ch(nv.Email, 20),
      QuocTich: ch(nv.QuocTich, 12),
      BoPhan: ch(nv.TenBoPhan, 20),
      ChucVuNhanVien: ch(nv.ChucVu, 20),
      MaSoThueCaNhan: ch(nv.MaSoThueCaNhan, 15),
      SoSoBHXH: ch(nv.SoSoBHXH, 15)
    };
  }
  function bienChoHopDong(h, nv) {
    const khongThoiHan = String(h.LoaiHopDong || '') === 'Không xác định thời hạn';
    const tyLe = h.TyLeThuViec != null && h.TyLeThuViec !== '' ? Number(h.TyLeThuViec) : 85;
    return Object.assign({}, bienCongTy(), bienNhanVien(nv), {
      SoHopDong: ch(h.SoHopDong, 6),
      LoaiHopDong: escapeHtml(h.LoaiHopDong || ''),
      NgayThangNamKy: dongNgayThang(h.NgayKy),
      NgayKy: chNgay(h.NgayKy),
      TuNgay: chNgay(h.TuNgay),
      DenNgay: chNgay(h.DenNgay),
      SoNamHopDong: soNamHopDong(h.TuNgay, h.DenNgay),
      SoNgayThuViec: soNgayThuViec(h.TuNgay, h.DenNgay),
      ChucVu: ch(h.ChucVu, 30),
      NoiLamViec: escapeHtml(h.NoiLamViec || (COMPANY.ten + ' tại ' + COMPANY.diaChi)),
      QuanLyTrucTiep: ch(h.QuanLyTrucTiep, 25),
      LuongCoBan: chTien(h.LuongCoBan),
      LuongCoBanBangChu: h.LuongCoBan ? escapeHtml(docSoTienBangChu(h.LuongCoBan)) : '............................',
      HeSoLuong: ch(h.HeSoLuong, 6),
      PhuCapAnCa: chTien(h.PhuCapAnCa),
      PhuCapTrangPhuc: chTien(h.PhuCapTrangPhuc),
      PhuCapXangXe: chTien(h.PhuCapXangXe),
      PhuCapDienThoai: chTien(h.PhuCapDienThoai),
      PhuCapChuyenCan: chTien(h.PhuCapChuyenCan),
      PhuCapChucVu: chTien(h.PhuCapChucVu),
      QuyKPI: chTien(h.QuyKPI),
      SoCongXangXe: ch(h.SoCongXangXe, 4),
      SoCongAnTrua: ch(h.SoCongAnTrua, 4),
      TyLeThuViec: String(tyLe),
      // Câu mô tả thời hạn đổi theo loại — để trong biến thay vì bắt người sửa mẫu tự viết điều kiện.
      CauThoiHan: khongThoiHan
        ? `Loại HĐLĐ <b>Không xác định thời hạn</b>, kể từ ngày ${chNgay(h.TuNgay)}.`
        : `Loại HĐLĐ <b>Xác định thời hạn</b> ${soNamHopDong(h.TuNgay, h.DenNgay)} năm từ ngày ${chNgay(h.TuNgay)} đến hết ngày ${chNgay(h.DenNgay)}.`
    });
  }
  function bienChoQuyetDinh(q, nv) {
    return Object.assign({}, bienCongTy(), bienNhanVien(nv), {
      SoQuyetDinh: ch(q.SoQuyetDinh, 14),
      LoaiQuyetDinh: escapeHtml(q.LoaiQuyetDinh || ''),
      NgayThangNamKy: dongNgayThang(q.NgayKy),
      NgayKy: chNgay(q.NgayKy),
      NgayHieuLuc: chNgay(q.NgayHieuLuc),
      GiaTriCu: ch(q.GiaTriCu, 15),
      GiaTriMoi: ch(q.GiaTriMoi, 15),
      NoiDung: q.NoiDung ? escapeHtml(q.NoiDung) : '...........................',
      // Ghi chú chỉ in khi có — để trống thì không chừa đoạn <i></i> rỗng giữa Điều 3 và khối ký.
      KhoiNoiDung: q.NoiDung ? `<p style="margin:0 0 10px;"><i>${escapeHtml(q.NoiDung)}</i></p>` : '',
      BoPhanChucVu: ch([nv && nv.TenBoPhan, (nv && nv.ChucVu) || q.ChucVu].filter(Boolean).join(' / '), 25)
    });
  }
  function bienChoPhuLuc(p, nv) {
    return Object.assign({}, bienCongTy(), bienNhanVien(nv), {
      SoPhuLuc: ch(p.SoPhuLuc, 10),
      SoHopDong: ch(p.SoHopDong, 10),
      NgayThangNamKy: dongNgayThang(p.NgayKy),
      NgayKy: chNgay(p.NgayKy),
      NgayHieuLuc: chNgay(p.NgayHieuLuc),
      LuongCoBanMoi: chTien(p.LuongCoBanMoi),
      LuongCoBanMoiBangChu: p.LuongCoBanMoi ? escapeHtml(docSoTienBangChu(p.LuongCoBanMoi)) : '............................',
      ChucVuMoi: ch(p.ChucVuMoi, 25),
      NoiDungThayDoi: p.NoiDungThayDoi ? escapeHtml(p.NoiDungThayDoi) : '...........................'
    });
  }
  function bienChoThanhLy(t, nv) {
    return Object.assign({}, bienCongTy(), bienNhanVien(nv), {
      SoHopDong: ch(t.SoHopDong, 10),
      NgayThangNamKy: dongNgayThang(t.NgayNghiViec),
      NgayNghiViec: chNgay(t.NgayNghiViec),
      LyDoNghi: ch(t.LyDoNghi, 30),
      TroCap: chTien(t.TroCap),
      KhauTru: chTien(t.KhauTru),
      TrangThaiBanGiao: ch(t.TrangThaiBanGiao, 15)
    });
  }

  /* ================================================================================================
     MẪU GỐC — nguồn DUY NHẤT của bản gốc 6 văn bản nhân sự.
     ------------------------------------------------------------------------------------------------
     ⚠️ Viết bằng backtick nhưng KHÔNG dùng ${...}: biến ở đây là {{TenBien}}, do thayBien() xử lý.
     Lỡ gõ ${ vào là JavaScript nội suy ngay lúc tải file, không phải lúc in — lỗi khó hiểu.
     ⚠️ Mỗi mẫu gồm CẢ tiêu đề và khối ký, để người dùng sửa được mọi phần. Sửa hỏng thì bấm
     "Khôi phục mẫu gốc" ở màn Mẫu văn bản.
     ================================================================================================ */
  const KHOI_TIEU_DE = `
    <table style="width:100%;border:none;margin-bottom:10px;"><tbody style="border:none;"><tr>
      <td style="width:42%;text-align:center;vertical-align:top;border:none;">
        <b>CÔNG TY TNHH<br>THỜI TRANG MOYN</b>
        <div style="margin-top:6px;">Số: {{SO_VAN_BAN}}</div>
      </td>
      <td style="text-align:center;vertical-align:top;border:none;">
        <b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br>
        <b>Độc lập - Tự do - Hạnh phúc</b>
        <div style="border-top:1px solid #000;width:200px;margin:2px auto 6px;"></div>
        <i>{{NgayThangNamKy}}</i>
      </td></tr></tbody></table>`;
  /* phaiGhiChu: cột bên phải là người sử dụng lao động. Mẫu HĐLĐ/HĐTV Nguyen gửi ghi "(Ký, ghi rõ
     họ tên)" cả hai cột nên giữ nguyên; Phụ lục và Thanh lý trước v8.85 dùng signBlock() với
     "(Ký, đóng dấu)" — không truyền tham số này là âm thầm bỏ mất yêu cầu đóng dấu. */
  const khoiKyMau = (traiNhan, traiTen, phaiNhan, phaiTen, phaiGhiChu) => `
    <table style="width:100%;border:none;margin-top:24px;"><tbody style="border:none;"><tr>
      <td style="width:50%;text-align:center;border:none;vertical-align:top;">
        <b>${traiNhan}</b><br><i>(Ký, ghi rõ họ tên)</i>
        <div style="height:70px;"></div><b>${traiTen}</b></td>
      <td style="width:50%;text-align:center;border:none;vertical-align:top;">
        <b>${phaiNhan}</b><br><i>(${phaiGhiChu || 'Ký, ghi rõ họ tên'})</i>
        <div style="height:70px;"></div><b>${phaiTen}</b></td>
    </tr></tbody></table>`;
  const KHOI_BEN_A = `
    <p style="margin:10px 0 4px;"><b>BÊN A - NGƯỜI SỬ DỤNG LAO ĐỘNG</b></p>
    <table style="width:100%;border:none;font-size:13px;"><tbody style="border:none;">
      <tr><td style="width:150px;">Tên doanh nghiệp</td><td style="width:40px;">:</td><td><b>{{TenCongTy}}</b></td></tr>
      <tr><td>Địa chỉ</td><td>:</td><td>{{DiaChiCongTy}}</td></tr>
      <tr><td>Mã số thuế</td><td>:</td><td>{{MaSoThueCongTy}}</td></tr>
      <tr><td>Đại diện/Chức vụ</td><td>:</td><td>Ông <b>{{TenGiamDoc}}</b> - Giám đốc</td></tr>
    </tbody></table>`;

  const MAU_GOC = {
    /* Tên hiển thị của từng mẫu nằm ở TEN_MAU (mục 6), KHÔNG thêm một khóa "ten" ở đây —
       rà chéo 2026-10-10 bắt được: hai bảng đã lệch nhau 2/6 ngay trong lần viết đầu tiên. */
    HDLD_CHINHTHUC: {
      than: KHOI_TIEU_DE.replace('{{SO_VAN_BAN}}', '{{SoHopDong}}/HĐLĐ-MOYN') + `
        <h2 style="text-align:center;margin:14px 0 12px;">HỢP ĐỒNG LAO ĐỘNG</h2>
        <p style="margin:0 0 2px;">- Căn cứ Bộ luật Lao động hiện hành và các văn bản hướng dẫn thi hành;</p>
        <p style="margin:0 0 10px;">- Căn cứ nhu cầu sử dụng lao động của Công ty và sự tự nguyện thỏa thuận của hai bên:</p>
        <p>Hôm nay, {{NgayThangNamKy}}, tại Công ty TNHH Thời trang MOYN, chúng tôi gồm:</p>
        ` + KHOI_BEN_A + `
        <p style="margin:10px 0 4px;"><b>BÊN B - NGƯỜI LAO ĐỘNG</b></p>
        <table style="width:100%;border:none;font-size:13px;"><tbody style="border:none;">
          <tr><td style="width:150px;">Họ và tên</td><td style="width:40px;">:</td><td><b>{{HoTen}}</b></td>
              <td style="width:130px;">Số điện thoại</td><td style="width:30px;">:</td><td>{{SDT}}</td></tr>
          <tr><td>Ngày sinh</td><td>:</td><td>{{NgaySinh}}</td>
              <td>Quốc tịch</td><td>:</td><td>{{QuocTich}}</td></tr>
          <tr><td>CCCD/Hộ chiếu</td><td>:</td><td>{{SoCCCD}}</td>
              <td>Ngày cấp</td><td>:</td><td>{{NgayCapCCCD}}</td></tr>
          <tr><td>Nơi cấp</td><td>:</td><td colspan="4">{{NoiCapCCCD}}</td></tr>
          <tr><td>Nơi cư trú</td><td>:</td><td colspan="4">{{DiaChi}}</td></tr>
        </tbody></table>
        <p style="margin-top:10px;">Hai bên thỏa thuận giao kết Hợp đồng lao động với các điều khoản sau:</p>

        <p><b>Điều 1. Công việc, địa điểm làm việc và thời hạn hợp đồng</b></p>
        <p style="margin:0 0 2px;">1.1. {{CauThoiHan}}</p>
        <p style="margin:0 0 2px;">1.2. Chức danh/công việc: {{ChucVu}}</p>
        <p style="margin:0 0 2px;">1.3. Bộ phận: {{BoPhan}}</p>
        <p style="margin:0 0 2px;">1.4. Địa điểm làm việc chính: {{NoiLamViec}}; địa điểm khác chỉ áp dụng khi hai bên thỏa thuận hoặc thuộc trường hợp pháp luật cho phép.</p>
        <p style="margin:0 0 10px;">1.5. Nội dung công việc: thực hiện công việc theo chức danh nêu trên, Bản mô tả công việc (nếu có), tiêu chuẩn kỹ thuật/quy trình liên quan và các phân công hợp pháp, hợp lý, có liên quan đến phạm vi công việc.</p>

        <p><b>Điều 2. Thời giờ làm việc và thời giờ nghỉ ngơi</b></p>
        <p style="margin:0 0 2px;">2.1. Thời giờ làm việc bình thường của khối văn phòng/quản lý: 08 giờ/ngày, 48 giờ/tuần, từ thứ Hai đến thứ Bảy; buổi sáng 08:00-12:00, buổi chiều 13:30-17:30; nghỉ trưa 12:00-13:30 và không tính vào thời giờ làm việc bình thường. Chủ nhật là ngày nghỉ hằng tuần, trừ trường hợp Công ty tổ chức làm thêm giờ hoặc bố trí lịch làm việc hợp pháp khác theo quy định.</p>
        <p style="margin:0 0 2px;">2.2. Nghỉ giữa giờ, nghỉ hằng tuần, nghỉ lễ, Tết, nghỉ hằng năm, nghỉ việc riêng và các chế độ nghỉ khác thực hiện theo pháp luật, Nội quy lao động và quy định hợp pháp của Công ty.</p>
        <p style="margin:0 0 10px;">2.3. Làm thêm giờ, làm việc ban đêm, làm việc vào ngày nghỉ hằng tuần/ngày lễ chỉ thực hiện khi có nhu cầu công việc, phê duyệt và sự đồng ý của Người lao động theo trường hợp pháp luật yêu cầu; tiền lương được tính theo quy định hiện hành và dữ liệu thực tế được xác nhận.</p>

        <p><b>Điều 3. Tiền lương theo thời gian, thưởng/hỗ trợ và phương thức trả lương</b></p>
        <p style="margin:0 0 2px;">3.1. Mức lương theo công việc/chức danh: <b>{{LuongCoBan}}</b> đồng/tháng (Bằng chữ: {{LuongCoBanBangChu}}). Mức lương này sẽ làm căn cứ đóng BHXH, BHYT, BHTN.</p>
        <p style="margin:0 0 2px;">3.2. Hình thức trả lương: Theo thời gian, trả lương theo tháng.</p>
        <p style="margin:0 0 2px;">3.3. Các khoản phụ cấp và chế độ khác.</p>
        <p style="margin:0 0 2px 20px;">a) Chuyên cần: Người lao động được hưởng {{PhuCapChuyenCan}} đồng/tháng khi đáp ứng đầy đủ điều kiện chuyên cần theo quy định của Công ty.</p>
        <p style="margin:0 0 2px 20px;">b) Hỗ trợ xăng xe: {{PhuCapXangXe}} đồng/tháng {{SoCongXangXe}} công.</p>
        <p style="margin:0 0 2px 20px;">c) Ăn trưa: {{PhuCapAnCa}} đồng/tháng {{SoCongAnTrua}} công.</p>
        <p style="margin:0 0 2px 20px;">d) Phụ cấp chức vụ/trách nhiệm: <b>{{PhuCapChucVu}}</b> đồng/tháng. Người lao động được hưởng phụ cấp chức vụ/trách nhiệm theo vị trí công việc và theo quyết định hoặc chính sách của Công ty.</p>
        <p style="margin:0 0 10px 20px;">e) Thưởng/thu nhập hiệu suất KPI: Quỹ KPI tham chiếu tối đa là {{QuyKPI}} đồng/tháng tương ứng 100 điểm. Mức hưởng thực tế được xác định căn cứ kết quả đánh giá KPI và Quy chế lương, thưởng/KPI của Công ty trong từng thời kỳ.</p>

        <p><b>Điều 4. Bảo hiểm, thuế và các chế độ bắt buộc</b></p>
        <p style="margin:0 0 2px;">4.1. Hai bên thực hiện BHXH, BHYT, BHTN và các chế độ bảo hiểm bắt buộc khác theo đúng đối tượng, mức đóng, căn cứ đóng và thời điểm tham gia do pháp luật quy định; căn cứ đóng được xác định theo các thành phần tiền lương thuộc diện tính đóng tại từng thời kỳ.</p>
        <p style="margin:0 0 10px;">4.2. Thuế thu nhập cá nhân và các khoản nghĩa vụ tài chính khác của người lao động (nếu phát sinh) được khấu trừ, kê khai và thực hiện theo pháp luật.</p>

        <p><b>Điều 5. Trang bị làm việc, bảo hộ lao động và đào tạo</b></p>
        <p style="margin:0 0 2px;">5.1. Công ty cung cấp hoặc bố trí máy móc, công cụ, phương tiện làm việc cần thiết theo vị trí; việc giao nhận tài sản/công cụ có thể được lập thành biên bản riêng.</p>
        <p style="margin:0 0 2px;">5.2. Phương tiện bảo vệ cá nhân/bảo hộ lao động (nếu công việc yêu cầu).</p>
        <p style="margin:0 0 10px;">5.3. Người lao động được hướng dẫn/đào tạo về công việc, quy trình, chất lượng, an toàn, PCCC và các nội dung cần thiết. Trường hợp đào tạo có chi phí và ràng buộc đặc biệt, hai bên ký thỏa thuận đào tạo riêng theo pháp luật.</p>

        <p><b>Điều 6. Quyền và nghĩa vụ của Người lao động</b></p>
        <p style="margin:0 0 2px;">6.1. Thực hiện đúng công việc, thời giờ làm việc, quy trình nghiệp vụ, yêu cầu chất lượng, bảo mật, an toàn và Nội quy lao động hợp pháp của Công ty.</p>
        <p style="margin:0 0 2px;">6.2. Chấp hành sự phân công, điều hành hợp pháp của người có thẩm quyền; chủ động báo cáo khi phát hiện sai sót, rủi ro, nguy cơ mất an toàn hoặc sự cố có thể ảnh hưởng công việc và hoạt động của Công ty.</p>
        <p style="margin:0 0 2px;">6.3. Bảo quản tài sản, hồ sơ, tài liệu, thiết bị và dữ liệu được giao; bàn giao đầy đủ khi thay đổi vị trí hoặc chấm dứt HĐLĐ.</p>
        <p style="margin:0 0 2px;">6.4. Được trả lương, nghỉ ngơi, tham gia các chế độ bảo hiểm và hưởng các quyền lợi khác theo HĐLĐ, quy chế hợp pháp và pháp luật.</p>
        <p style="margin:0 0 10px;">6.5. Có quyền phản ánh, khiếu nại, đề nghị giải quyết quyền lợi và từ chối yêu cầu trái pháp luật hoặc có nguy cơ rõ ràng đe dọa trực tiếp đến tính mạng, sức khỏe theo quy định.</p>

        <p><b>Điều 7. Quyền và nghĩa vụ của Người sử dụng lao động</b></p>
        <p style="margin:0 0 2px;">7.1. Bố trí công việc, quản lý, điều hành và đánh giá kết quả làm việc theo HĐLĐ, Nội quy, quy chế và pháp luật.</p>
        <p style="margin:0 0 2px;">7.2. Thanh toán đầy đủ, đúng hạn tiền lương và các quyền lợi của Người lao động; thực hiện các nghĩa vụ bảo hiểm, thuế và hồ sơ lao động theo quy định.</p>
        <p style="margin:0 0 2px;">7.3. Bảo đảm điều kiện làm việc, an toàn, vệ sinh lao động; tôn trọng danh dự, nhân phẩm và quyền hợp pháp của Người lao động.</p>
        <p style="margin:0 0 10px;">7.4. Có quyền khen thưởng, điều chuyển, tạm đình chỉ, xử lý kỷ luật hoặc chấm dứt HĐLĐ khi có căn cứ và thực hiện đúng thẩm quyền, trình tự, thủ tục pháp luật.</p>

        <p><b>Điều 8. Bảo mật, dữ liệu và sở hữu trí tuệ</b></p>
        <p style="margin:0 0 2px;">8.1. Người lao động có trách nhiệm bảo mật các thông tin được xác định hợp pháp là bí mật kinh doanh, bí mật công nghệ hoặc thông tin nội bộ như dữ liệu khách hàng/nhà cung cấp, bảng giá, mẫu thiết kế, dữ liệu tài chính - kế toán, nhân sự - tiền lương, kế hoạch kinh doanh, tài khoản, mật khẩu và các dữ liệu nghiệp vụ thuộc phạm vi được giao.</p>
        <p style="margin:0 0 2px;">8.2. Việc thu thập, lưu trữ và sử dụng dữ liệu cá nhân của Người lao động phục vụ quản trị nhân sự, tiền lương, bảo hiểm, an toàn, kiểm soát ra/vào và các mục đích hợp pháp khác được thực hiện theo pháp luật về bảo vệ dữ liệu cá nhân và quy định nội bộ được công bố.</p>
        <p style="margin:0 0 10px;">8.3. Quyền sở hữu, quyền sử dụng đối với tài liệu, mẫu, rập, hình ảnh, dữ liệu và kết quả công việc phát sinh trong phạm vi nhiệm vụ được xác định theo pháp luật, HĐLĐ và thỏa thuận/quy chế có liên quan.</p>

        <p><b>Điều 9. Sửa đổi, tạm hoãn và chấm dứt HĐLĐ</b></p>
        <p style="margin:0 0 2px;">9.1. Việc sửa đổi, bổ sung nội dung HĐLĐ được thực hiện bằng phụ lục HĐLĐ hoặc HĐLĐ mới theo thỏa thuận và quy định pháp luật.</p>
        <p style="margin:0 0 2px;">9.2. Tạm hoãn, đơn phương chấm dứt, chấm dứt HĐLĐ, thời hạn báo trước, trợ cấp và các quyền lợi liên quan thực hiện theo pháp luật và thỏa thuận hợp pháp giữa hai bên.</p>
        <p style="margin:0 0 10px;">9.3. Khi chấm dứt HĐLĐ, Người lao động thực hiện bàn giao công việc, tài sản, tài liệu và quyền truy cập thuộc Công ty; Công ty thực hiện thanh toán và xác nhận/chốt các thủ tục thuộc trách nhiệm theo thời hạn pháp luật.</p>

        <p><b>Điều 10. Điều khoản thi hành</b></p>
        <p style="margin:0 0 2px;">10.1. Hợp đồng này có hiệu lực từ ngày ký.</p>
        <p style="margin:0 0 2px;">10.2. Những nội dung chưa quy định trong Hợp đồng này được thực hiện theo pháp luật, Nội quy lao động hợp lệ, thỏa ước lao động tập thể (nếu có) và các quy chế/chính sách hợp pháp đã được Công ty công bố.</p>
        <p style="margin:0 0 2px;">10.3. Hợp đồng được lập thành 02 bản có giá trị như nhau; Người lao động giữ 01 bản, Công ty giữ 01 bản. Hai bên xác nhận đã đọc, hiểu và tự nguyện ký Hợp đồng.</p>
        ` + khoiKyMau('NGƯỜI LAO ĐỘNG', '{{HoTen}}', 'NGƯỜI SỬ DỤNG LAO ĐỘNG', '{{TenGiamDoc}}')
    },

    HDLD_THUVIEC: {
      /* v8.82 viết '{{SoHopDong}} HĐTV-MOYN' (thiếu dấu /) — in ra "Số: 012 HĐTV-MOYN".
         Ba mẫu còn lại đều có dấu /. Sửa cho thống nhất. */
      than: KHOI_TIEU_DE.replace('{{SO_VAN_BAN}}', '{{SoHopDong}}/HĐTV-MOYN') + `
        <h2 style="text-align:center;margin:14px 0 12px;">HỢP ĐỒNG THỬ VIỆC</h2>
        <p style="margin:0 0 2px;">- Căn cứ Bộ luật Lao động số 45/2019/QH14 và các văn bản hướng dẫn thi hành;</p>
        <p style="margin:0 0 10px;">- Căn cứ nhu cầu sử dụng lao động của Công ty và sự tự nguyện thỏa thuận của hai bên;</p>
        <p>Hôm nay, {{NgayThangNamKy}}, tại Công ty TNHH Thời trang MOYN, chúng tôi gồm:</p>
        ` + KHOI_BEN_A + `
        <p style="margin:10px 0 4px;"><b>BÊN B - NGƯỜI THỬ VIỆC: {{HoTen}}</b></p>
        <table style="width:100%;border:none;font-size:13px;"><tbody style="border:none;">
          <tr><td style="width:150px;">Mã NV</td><td style="width:40px;">:</td><td>{{MaNV}}</td>
              <td style="width:130px;">Quốc tịch</td><td style="width:30px;">:</td><td>{{QuocTich}}</td></tr>
          <tr><td>Ngày sinh</td><td>:</td><td>{{NgaySinh}}</td>
              <td>Số điện thoại</td><td>:</td><td>{{SDT}}</td></tr>
          <tr><td>CCCD/Hộ chiếu</td><td>:</td><td>{{SoCCCD}}</td>
              <td>Ngày cấp</td><td>:</td><td>{{NgayCapCCCD}}</td></tr>
          <tr><td>Nơi cấp</td><td>:</td><td colspan="4">{{NoiCapCCCD}}</td></tr>
          <tr><td>Nơi cư trú</td><td>:</td><td colspan="4">{{DiaChi}}</td></tr>
        </tbody></table>
        <p style="margin-top:10px;">Hai bên thỏa thuận giao kết Hợp đồng thử việc với các điều khoản sau:</p>

        <p><b>Điều 1. Công việc, địa điểm và thời gian thử việc</b></p>
        <p style="margin:0 0 2px;">1.1. Chức danh/công việc thử việc: {{ChucVu}}</p>
        <p style="margin:0 0 2px;">1.2. Bộ phận: {{BoPhan}}. Quản lý trực tiếp: {{QuanLyTrucTiep}}</p>
        <p style="margin:0 0 2px;">1.3. Địa điểm làm việc: {{NoiLamViec}}; địa điểm khác chỉ áp dụng khi có thỏa thuận hoặc pháp luật cho phép.</p>
        <p style="margin:0 0 2px;">1.4. Thời gian thử việc: {{SoNgayThuViec}} ngày, từ ngày {{TuNgay}} đến hết ngày {{DenNgay}}.</p>
        <p style="margin:0 0 10px;">1.5. Nội dung công việc: theo chức danh nêu trên, Bản mô tả công việc và các phân công hợp pháp, hợp lý trong phạm vi công việc.</p>

        <p><b>Điều 2. Thời giờ làm việc, nghỉ ngơi và điều kiện làm việc</b></p>
        <p style="margin:0 0 2px;">2.1. Lịch làm việc: sáng từ 08:00-12:00 và chiều từ 13:30-17:30. Làm việc từ thứ 2 đến thứ 7, nghỉ chủ nhật hằng tuần, nghỉ lễ/Tết và các chế độ nghỉ khác thực hiện theo Nội quy lao động, lịch làm việc của Công ty và pháp luật.</p>
        <p style="margin:0 0 2px;">2.2. Làm thêm giờ, làm việc ban đêm hoặc ngày nghỉ thực hiện theo nhu cầu công việc, phê duyệt của Công ty và quy định pháp luật; tiền lương làm thêm được tính theo quy định hiện hành.</p>
        <p style="margin:0 0 10px;">2.3. Công ty cung cấp công cụ làm việc và trang bị bảo hộ lao động cần thiết theo tính chất công việc, quy định an toàn và quy định nội bộ của Công ty.</p>

        <p><b>Điều 3. Tiền lương thử việc và phương thức trả lương</b></p>
        <p style="margin:0 0 2px;">3.1. Mức lương cơ bản: {{LuongCoBan}} đồng/tháng.</p>
        <p style="margin:0 0 2px;">3.2. Trong thời gian thử việc, Người lao động được hưởng <b>{{TyLeThuViec}}%</b> mức lương theo công việc/chức danh nêu trên. Khoản này được tính theo ngày công thực tế trong tháng.</p>
        <p style="margin:0 0 2px;">3.3. Các khoản phụ cấp, hỗ trợ và phúc lợi được tính riêng theo quy định của Công ty, không áp dụng mức {{TyLeThuViec}}%.</p>
        <p style="margin:0 0 2px 20px;">a) Chuyên cần: Người lao động được hưởng {{PhuCapChuyenCan}} đồng/tháng khi đáp ứng đầy đủ điều kiện chuyên cần theo quy định của Công ty.</p>
        <p style="margin:0 0 2px 20px;">b) Hỗ trợ xăng xe: {{PhuCapXangXe}} đồng/tháng {{SoCongXangXe}} công.</p>
        <p style="margin:0 0 2px 20px;">c) Ăn trưa: {{PhuCapAnCa}} đồng/tháng {{SoCongAnTrua}} công.</p>
        <p style="margin:0 0 2px 20px;">d) Phụ cấp chức vụ/trách nhiệm: {{PhuCapChucVu}} đồng.</p>
        <p style="margin:0 0 2px 20px;">e) Nguyên tắc áp dụng: Các khoản phụ cấp, hỗ trợ và phúc lợi trên được tính riêng, không áp dụng mức {{TyLeThuViec}}% của lương thử việc.</p>
        <p style="margin:0 0 10px;">3.4. Thưởng/thu nhập hiệu suất KPI: Quỹ KPI tham chiếu tối đa là {{QuyKPI}} đồng/tháng tương ứng 100 điểm. Mức hưởng thực tế được xác định căn cứ kết quả đánh giá KPI và Quy chế lương, thưởng/KPI của Công ty trong từng thời kỳ.</p>

        <p><b>Điều 4. Quyền và nghĩa vụ của hai bên</b></p>
        <p style="margin:0 0 2px;">4.1. Người thử việc có trách nhiệm thực hiện đúng công việc, tiêu chuẩn chất lượng, tiến độ, Nội quy lao động, quy trình an toàn, 5S; bảo quản tài sản, công cụ và nguyên phụ liệu được giao; báo ngay cho quản lý khi phát hiện sự cố hoặc nguy cơ mất an toàn.</p>
        <p style="margin:0 0 2px;">4.2. Công ty bố trí, hướng dẫn công việc, cung cấp điều kiện làm việc cần thiết, bảo đảm an toàn vệ sinh lao động, theo dõi đánh giá kết quả thử việc và thanh toán đầy đủ, đúng hạn các khoản phải trả.</p>
        <p style="margin:0 0 10px;">4.3. Hai bên thực hiện các quyền và nghĩa vụ khác theo Hợp đồng này, Nội quy lao động, quy định nội bộ hợp pháp của Công ty và pháp luật hiện hành.</p>

        <p><b>Điều 5. Đánh giá, kết thúc thử việc và bảo mật</b></p>
        <p style="margin:0 0 2px;">5.1. Khi kết thúc thời gian thử việc, Công ty thông báo kết quả cho Người thử việc. Nếu đạt yêu cầu, hai bên giao kết Hợp đồng lao động; nếu không đạt yêu cầu, Hợp đồng thử việc chấm dứt.</p>
        <p style="margin:0 0 2px;">5.2. Trong thời gian thử việc, mỗi bên có quyền hủy bỏ Hợp đồng thử việc mà không cần báo trước và không phải bồi thường theo quy định pháp luật.</p>
        <p style="margin:0 0 10px;">5.3. Người thử việc có trách nhiệm bảo mật thông tin, dữ liệu khách hàng/nhà cung cấp, bảng giá, mẫu thiết kế, rập, BOM, định mức, dữ liệu sản xuất, tài chính, tài khoản, mật khẩu và thông tin nội bộ; đồng thời bàn giao đầy đủ tài liệu, tài sản và quyền truy cập khi kết thúc thử việc.</p>

        <p><b>Điều 6. Hiệu lực và điều khoản chung</b></p>
        <p style="margin:0 0 2px;">6.1. Hợp đồng có hiệu lực từ ngày ký, trừ trường hợp chấm dứt sớm theo pháp luật hoặc thỏa thuận hợp pháp của hai bên.</p>
        <p style="margin:0 0 2px;">6.2. Các nội dung chưa quy định tại Hợp đồng này thực hiện theo pháp luật, Nội quy lao động và quy định nội bộ hợp pháp của Công ty. Hợp đồng được lập thành 02 bản có giá trị như nhau; mỗi bên giữ 01 bản.</p>
        ` + khoiKyMau('NGƯỜI THỬ VIỆC', '{{HoTen}}', 'GIÁM ĐỐC', '{{TenGiamDoc}}')
    },

    QD_TANGLUONG: {
      than: KHOI_TIEU_DE.replace('{{SO_VAN_BAN}}', '{{SoQuyetDinh}}') + `
        <h2 style="text-align:center;margin:14px 0 2px;">QUYẾT ĐỊNH</h2>
        <p style="text-align:center;margin:0 0 12px;"><i>V/v: Điều chỉnh tăng lương đối với người lao động</i></p>
        <p style="margin:0 0 2px;">- Căn cứ Bộ luật Lao động năm 2019;</p>
        <p style="margin:0 0 2px;">- Căn cứ Hợp đồng lao động đã ký giữa Công ty và người lao động;</p>
        <p style="margin:0 0 2px;">- Căn cứ Quy chế tiền lương, thưởng của Công ty và tình hình hoạt động thực tế;</p>
        <p style="margin:0 0 12px;">- Xét năng lực, kết quả công việc và đề xuất của bộ phận liên quan;</p>
        <p style="text-align:center;font-weight:600;margin:0;">GIÁM ĐỐC CÔNG TY TNHH THỜI TRANG MOYN</p>
        <p style="text-align:center;font-weight:600;margin:4px 0 12px;">QUYẾT ĐỊNH</p>
        <p style="margin:0 0 4px;"><b>Điều 1.</b> Điều chỉnh tăng lương đối với người lao động có thông tin sau:</p>
        <p style="margin:0 0 2px 30px;">Họ và tên: <b>{{HoTen}}</b></p>
        <p style="margin:0 0 2px 30px;">Bộ phận/chức vụ: {{BoPhanChucVu}}</p>
        <p style="margin:0 0 2px 30px;">Mức lương cũ: {{GiaTriCu}} đồng/tháng.</p>
        <p style="margin:0 0 2px 30px;">Mức lương mới: {{GiaTriMoi}} đồng/tháng.</p>
        <p style="margin:0 0 10px 30px;">Thời điểm áp dụng: Kể từ ngày {{NgayHieuLuc}}</p>
        <p style="margin:0 0 10px;"><b>Điều 2.</b> Mức lương mới tại Điều 1 là căn cứ để tính, chi trả lương và thực hiện các nghĩa vụ liên quan theo quy định pháp luật và quy chế của Công ty. Trường hợp điều chỉnh nội dung đã thỏa thuận trong Hợp đồng lao động, các bên thực hiện thủ tục sửa đổi, bổ sung Hợp đồng lao động theo quy định.</p>
        <p style="margin:0 0 10px;"><b>Điều 3.</b> Bộ phận Hành chính - Nhân sự, bộ phận Kế toán và người lao động có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này. Quyết định có hiệu lực kể từ ngày ký, trừ thời điểm áp dụng mức lương quy định tại Điều 1.</p>
        {{KhoiNoiDung}}
        <table style="width:100%;border:none;margin-top:18px;"><tbody style="border:none;"><tr>
          <td style="width:50%;border:none;vertical-align:top;font-size:13px;">
            <b><i>Nơi nhận:</i></b><br>- Như Điều 3;<br>- Lưu: HCNS, hồ sơ người lao động.</td>
          <td style="width:50%;border:none;text-align:center;vertical-align:top;">
            <b>GIÁM ĐỐC</b><br><i>(Ký, ghi rõ họ tên, đóng dấu)</i>
            <div style="height:80px;"></div><b>{{TenGiamDoc}}</b></td>
        </tr></tbody></table>`
    },

    QD_CHUNG: {
      than: KHOI_TIEU_DE.replace('{{SO_VAN_BAN}}', '{{SoQuyetDinh}}') + `
        <h2 style="text-align:center;margin:14px 0 2px;">QUYẾT ĐỊNH</h2>
        <p style="text-align:center;margin:0 0 12px;"><i>V/v: {{LoaiQuyetDinh}} đối với Ông/Bà {{HoTen}}</i></p>
        <p style="margin:0 0 2px;">- Căn cứ Bộ luật Lao động năm 2019;</p>
        <p style="margin:0 0 2px;">- Căn cứ Hợp đồng lao động đã ký giữa Công ty và người lao động;</p>
        <p style="margin:0 0 12px;">- Xét năng lực, kết quả công việc và đề xuất của bộ phận liên quan;</p>
        <p style="text-align:center;font-weight:600;margin:0;">GIÁM ĐỐC CÔNG TY TNHH THỜI TRANG MOYN</p>
        <p style="text-align:center;font-weight:600;margin:4px 0 12px;">QUYẾT ĐỊNH</p>
        <p style="margin:0 0 4px;"><b>Điều 1.</b> {{LoaiQuyetDinh}} đối với Ông/Bà <b>{{HoTen}}</b> (Mã NV: {{MaNV}}).</p>
        <p style="margin:0 0 2px 30px;">Bộ phận/chức vụ: {{BoPhanChucVu}}</p>
        <p style="margin:0 0 2px 30px;">Từ: {{GiaTriCu}} &nbsp;→&nbsp; Thành: {{GiaTriMoi}}</p>
        <p style="margin:0 0 10px 30px;">Thời điểm áp dụng: Kể từ ngày {{NgayHieuLuc}}</p>
        <p style="margin:0 0 10px;"><b>Điều 2.</b> {{NoiDung}}</p>
        <p style="margin:0 0 10px;"><b>Điều 3.</b> Bộ phận Hành chính - Nhân sự, các bộ phận liên quan và người lao động có tên tại Điều 1 chịu trách nhiệm thi hành Quyết định này. Quyết định có hiệu lực kể từ ngày ký.</p>
        <table style="width:100%;border:none;margin-top:18px;"><tbody style="border:none;"><tr>
          <td style="width:50%;border:none;vertical-align:top;font-size:13px;">
            <b><i>Nơi nhận:</i></b><br>- Như Điều 3;<br>- Lưu: HCNS, hồ sơ người lao động.</td>
          <td style="width:50%;border:none;text-align:center;vertical-align:top;">
            <b>GIÁM ĐỐC</b><br><i>(Ký, ghi rõ họ tên, đóng dấu)</i>
            <div style="height:80px;"></div><b>{{TenGiamDoc}}</b></td>
        </tr></tbody></table>`
    },

    PHULUC: {
      than: KHOI_TIEU_DE.replace('{{SO_VAN_BAN}}', '{{SoPhuLuc}}/PLHĐ-MOYN') + `
        <h2 style="text-align:center;margin:14px 0 12px;">PHỤ LỤC HỢP ĐỒNG LAO ĐỘNG</h2>
        <p>Căn cứ Hợp đồng lao động số {{SoHopDong}} đã ký giữa {{TenCongTy}} và Ông/Bà <b>{{HoTen}}</b>.</p>
        <p>Hai bên thống nhất sửa đổi, bổ sung một số nội dung của hợp đồng, hiệu lực từ ngày {{NgayHieuLuc}}:</p>
        <p style="margin:0 0 2px;"><b>Nội dung thay đổi:</b> {{NoiDungThayDoi}}</p>
        <p style="margin:0 0 2px;"><b>Mức lương mới:</b> {{LuongCoBanMoi}} đồng/tháng (Bằng chữ: {{LuongCoBanMoiBangChu}}).</p>
        <p style="margin:0 0 10px;"><b>Chức vụ mới:</b> {{ChucVuMoi}}</p>
        <p>Các nội dung khác của hợp đồng lao động không thay đổi. Phụ lục này là bộ phận không tách rời của hợp đồng.</p>
        ` + khoiKyMau('NGƯỜI LAO ĐỘNG', '{{HoTen}}', 'NGƯỜI SỬ DỤNG LAO ĐỘNG', '{{TenGiamDoc}}', 'Ký, ghi rõ họ tên, đóng dấu')
    },

    THANHLY: {
      than: KHOI_TIEU_DE.replace('{{SO_VAN_BAN}}', '......../TLHĐ-MOYN') + `
        <h2 style="text-align:center;margin:14px 0 12px;">BIÊN BẢN THANH LÝ HỢP ĐỒNG LAO ĐỘNG</h2>
        <p>Hôm nay, {{NgayThangNamKy}}, {{TenCongTy}} và Ông/Bà <b>{{HoTen}}</b> (Mã NV: {{MaNV}}) thống nhất thanh lý Hợp đồng lao động số {{SoHopDong}}.</p>
        <p style="margin:0 0 2px;"><b>Ngày nghỉ việc chính thức:</b> {{NgayNghiViec}}</p>
        <p style="margin:0 0 2px;"><b>Lý do:</b> {{LyDoNghi}}</p>
        <p style="margin:0 0 2px;"><b>Trợ cấp:</b> {{TroCap}} đồng &nbsp;·&nbsp; <b>Khấu trừ:</b> {{KhauTru}} đồng</p>
        <p style="margin:0 0 10px;"><b>Tình trạng bàn giao:</b> {{TrangThaiBanGiao}}</p>
        <p>Hai bên xác nhận đã hoàn tất các nghĩa vụ phát sinh từ Hợp đồng lao động nêu trên, không còn khiếu nại gì với nhau kể từ ngày ký biên bản này.</p>
        <p>Biên bản được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản.</p>
        ` + khoiKyMau('NGƯỜI LAO ĐỘNG', '{{HoTen}}', 'NGƯỜI SỬ DỤNG LAO ĐỘNG', '{{TenGiamDoc}}', 'Ký, ghi rõ họ tên, đóng dấu')
    }
  };

  // Danh sách biến hợp lệ cho từng mẫu — màn sửa mẫu dùng để hiện bảng tra và cảnh báo biến lạ.
  const BIEN_THEO_MAU = {
    HDLD_CHINHTHUC: () => Object.keys(bienChoHopDong({}, {})),
    HDLD_THUVIEC: () => Object.keys(bienChoHopDong({}, {})),
    QD_TANGLUONG: () => Object.keys(bienChoQuyetDinh({}, {})),
    QD_CHUNG: () => Object.keys(bienChoQuyetDinh({}, {})),
    PHULUC: () => Object.keys(bienChoPhuLuc({}, {})),
    THANHLY: () => Object.keys(bienChoThanhLy({}, {}))
  };

  /* ================================================================================================
     6. MAN "MAU VAN BAN"  (v8.85)
     ------------------------------------------------------------------------------------------------
     Sửa trực quan bằng contenteditable + document.execCommand, KHÔNG thêm thư viện soạn thảo nào.
     Lý do: cả hệ thống đang không có thư viện soạn thảo; thêm Quill/TinyMCE là thêm ~200KB và một
     phụ thuộc phải tự host. contenteditable gõ như Word cho các thao tác cần ở đây (đậm/nghiêng/
     căn lề/danh sách), đủ cho việc sửa câu chữ văn bản hành chính.

     ⚠️ execCommand đã bị đánh dấu "deprecated" nhưng mọi trình duyệt vẫn chạy và chưa có lịch bỏ.
     Nếu một ngày nó ngừng chạy: các nút định dạng mất tác dụng, PHẦN GÕ CHỮ VẪN CHẠY — không mất mẫu.
     ================================================================================================ */
  const TEN_MAU = {
    HDLD_CHINHTHUC: 'Hợp đồng lao động (chính thức)',
    HDLD_THUVIEC: 'Hợp đồng thử việc',
    QD_TANGLUONG: 'Quyết định tăng lương',
    QD_CHUNG: 'Quyết định (khen thưởng / kỷ luật / bổ nhiệm / điều chuyển)',
    PHULUC: 'Phụ lục hợp đồng lao động',
    THANHLY: 'Biên bản thanh lý hợp đồng'
  };

  async function renderMauVanBan() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    mauDaSua = null; dangNapMau = null;    // vào tab là nạp lại, tránh thấy bản cũ trong cache
    let rows = [], chuaCaiDat = false;
    try {
      const kq = await apiGet('/api/hrm/mauvanban');
      rows = kq.data || []; chuaCaiDat = !!kq.chuaCaiDat;
    } catch (e) {
      container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return;
    }
    mauDaSua = {}; rows.forEach(m => { mauDaSua[m.MaMau] = m.NoiDung; });
    const theoMa = {}; rows.forEach(m => { theoMa[m.MaMau] = m; });

    const canhBaoCaiDat = chuaCaiDat ? `
      <div class="empty-hint" style="text-align:left;background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:10px;margin-bottom:12px;">
        ⚠️ CSDL chưa chạy <b>migration_v878.sql</b> nên chưa lưu được mẫu đã sửa.
        Mọi bản in vẫn chạy bình thường bằng <b>mẫu gốc</b>. Chạy migration rồi <b>pm2 restart</b> là sửa được.
      </div>` : '';

    container.innerHTML = `
      ${canhBaoCaiDat}
      <div class="empty-hint" style="text-align:left;margin-bottom:12px;">
        Sửa mẫu là sửa <b>văn bản pháp lý</b>. Hệ thống chỉ giữ cho bố cục không vỡ, không biết nội dung
        đúng hay sai — sửa xong nên <b>in thử một bản</b> đối chiếu trước khi dùng để ký thật.
        Giữ <b>10</b> bản gần nhất mỗi mẫu; bấm "Mẫu gốc" là quay về bản trong phần mềm.
      </div>
      <table><thead><tr>
        <th>Văn bản</th><th style="width:160px">Đang dùng</th><th style="width:190px">Sửa lần cuối</th>
        <th style="width:330px">Thao tác</th>
      </tr></thead><tbody>
      ${Object.keys(TEN_MAU).map(ma => {
        const m = theoMa[ma];
        return `<tr>
          <td>${escapeHtml(TEN_MAU[ma])}<div style="color:#5f6368;font-size:12px;">${ma}</div></td>
          <td>${m
            ? `<span style="color:#1967d2;font-weight:600;">Bản sửa (v${m.PhienBan})</span>`
            : '<span style="color:#5f6368;">Mẫu gốc</span>'}</td>
          <td>${m ? `${fmtDate(m.CapNhatLuc)}<div style="color:#5f6368;font-size:12px;">${escapeHtml(m.NguoiSua || '')}</div>` : '—'}</td>
          <td>
            <button class="btn small" data-sua="${ma}">${perm.canEdit ? '✏️ Sửa' : '👁 Xem'}</button>
            <button class="btn small secondary" data-xem="${ma}">🖨 In thử</button>
            <button class="btn small secondary" data-ls="${ma}">🕘 Lịch sử</button>
            ${/* canDelete chứ không phải canEdit: route là DELETE, middleware requireChucNang map
                  DELETE -> quyền 'delete'. Hiện nút theo canEdit là người chỉ có quyền sửa bấm vào
                  ăn 403 mà không hiểu vì sao. */''}
            ${m && perm.canDelete ? `<button class="btn small secondary" data-goc="${ma}">↩ Mẫu gốc</button>` : ''}
          </td></tr>`;
      }).join('')}
      </tbody></table>`;

    container.querySelectorAll('[data-sua]').forEach(b => b.addEventListener('click', () => openSuaMau(b.dataset.sua)));
    container.querySelectorAll('[data-xem]').forEach(b => b.addEventListener('click', () => inThuMau(b.dataset.xem, layMau(b.dataset.xem))));
    container.querySelectorAll('[data-ls]').forEach(b => b.addEventListener('click', () => openLichSuMau(b.dataset.ls)));
    container.querySelectorAll('[data-goc]').forEach(b => b.addEventListener('click', () => khoiPhucMauGoc(b.dataset.goc)));
  }

  /* In thử: thay biến bằng chính TÊN BIẾN trong ngoặc ‹ › để thấy ngay chỗ nào sẽ điền dữ liệu gì,
     thay vì dựng một nhân viên giả rồi người xem tưởng là dữ liệu thật. */
  function inThuMau(maMau, noiDung) {
    const gia = {};
    (BIEN_THEO_MAU[maMau] ? BIEN_THEO_MAU[maMau]() : []).forEach(t => { gia[t] = '‹' + t + '›'; });
    printHtml('In thu mau - ' + maMau, wrapA4(thayBien(noiDung, gia)), IN_VAN_BAN);
  }

  async function khoiPhucMauGoc(maMau) {
    if (!confirm(`Khôi phục "${TEN_MAU[maMau]}" về mẫu gốc?\n\nBản đang dùng được đẩy vào Lịch sử, lấy lại được.`)) return;
    try {
      await apiDelete('/api/hrm/mauvanban/' + encodeURIComponent(maMau));
      toast('Đã quay về mẫu gốc.', 'success');
      renderMauVanBan();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function openLichSuMau(maMau) {
    let ds = [];
    try { ds = (await apiGet('/api/hrm/mauvanban/' + encodeURIComponent(maMau) + '/lichsu')).data || []; }
    catch (err) { toast(err.message, 'error'); return; }
    const html = `
      <h3>Lịch sử: ${escapeHtml(TEN_MAU[maMau] || maMau)}</h3>
      ${ds.length ? `<table><thead><tr><th style="width:80px">Bản</th><th>Lúc sửa</th><th>Người sửa</th><th style="width:210px"></th></tr></thead>
        <tbody>${ds.map(r => `<tr>
          <td>v${r.PhienBan}</td><td>${fmtDate(r.CapNhatLuc)}</td><td>${escapeHtml(r.NguoiSua || '')}</td>
          <td><button class="btn small secondary" data-inls="${r.LichSuID}">🖨 In thử</button>
              ${perm.canEdit ? `<button class="btn small" data-dungls="${r.LichSuID}">↩ Dùng lại</button>` : ''}</td>
        </tr>`).join('')}</tbody></table>`
        : '<div class="empty-hint">Mẫu này chưa có bản nào trong lịch sử.</div>'}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnDong">Đóng</button></div>`;
    const modal = openModal(html);
    modal.querySelector('#btnDong').addEventListener('click', closeModal);
    const tim = id => ds.find(x => String(x.LichSuID) === String(id));
    modal.querySelectorAll('[data-inls]').forEach(b =>
      b.addEventListener('click', () => inThuMau(maMau, (tim(b.dataset.inls) || {}).NoiDung || '')));
    modal.querySelectorAll('[data-dungls]').forEach(b => b.addEventListener('click', () => {
      const r = tim(b.dataset.dungls); if (!r) return;
      closeModal();
      // Mở màn sửa với nội dung bản cũ — CHƯA ghi; người dùng xem rồi bấm Lưu mới thành bản đang dùng.
      openSuaMau(maMau, r.NoiDung, `Đang xem lại bản v${r.PhienBan}. Bấm Lưu mới áp dụng.`);
    }));
  }

  function openSuaMau(maMau, noiDungBanDau, ghiChuDau) {
    const dsBien = BIEN_THEO_MAU[maMau] ? BIEN_THEO_MAU[maMau]() : [];
    const noiDung = noiDungBanDau != null ? noiDungBanDau : layMau(maMau);
    const nut = (lenh, nhan, tip) =>
      `<button type="button" class="btn small secondary" data-lenh="${lenh}" title="${tip}" style="min-width:34px;">${nhan}</button>`;
    const html = `
      <h3>${perm.canEdit ? 'Sửa mẫu' : 'Xem mẫu'}: ${escapeHtml(TEN_MAU[maMau] || maMau)}</h3>
      ${ghiChuDau ? `<div class="empty-hint" style="text-align:left;margin:0 0 8px;">${escapeHtml(ghiChuDau)}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 240px;gap:12px;align-items:start;">
        <div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
            ${nut('bold', '<b>B</b>', 'Đậm')}
            ${nut('italic', '<i>I</i>', 'Nghiêng')}
            ${nut('underline', '<u>U</u>', 'Gạch chân')}
            <span style="width:8px;"></span>
            ${nut('justifyLeft', '⬅', 'Căn trái')}
            ${nut('justifyCenter', '↔', 'Căn giữa')}
            ${nut('justifyRight', '➡', 'Căn phải')}
            <span style="width:8px;"></span>
            ${nut('insertUnorderedList', '• ≡', 'Danh sách')}
            ${nut('removeFormat', '✖ĐD', 'Xóa định dạng')}
            ${nut('undo', '↶', 'Hoàn tác')}
            ${nut('redo', '↷', 'Làm lại')}
            ${/* v8.86: bảng phải có nút riêng. Đặt con trỏ trong bảng rồi bấm Delete KHÔNG xóa được
                  bảng — trình duyệt coi bảng là một khối, phím xóa chỉ xóa chữ trong ô. */''}
            <span style="width:8px;"></span>
            <button type="button" class="btn small secondary" data-bang="themDong" title="Thêm một dòng ngay dưới dòng đang đứng">＋Dòng</button>
            <button type="button" class="btn small secondary" data-bang="xoaDong" title="Xóa dòng đang đứng">－Dòng</button>
            <button type="button" class="btn small secondary" data-bang="themCot" title="Thêm một cột ngay bên phải cột đang đứng">＋Cột</button>
            <button type="button" class="btn small secondary" data-bang="xoaCot" title="Xóa cột đang đứng">－Cột</button>
            <button type="button" class="btn small secondary" data-bang="xoaBang" title="Xóa cả bảng đang đứng trong">🗑 Bảng</button>
          </div>
          <div style="font-size:12px;color:#5f6368;margin-bottom:6px;">
            Bảng: bấm chuột vào một ô rồi dùng các nút ＋/－ ở trên. <b>Phím Delete không xóa được bảng</b> —
            trình duyệt coi bảng là một khối, phím xóa chỉ xóa chữ trong ô.
          </div>
          <div id="oSoan" contenteditable="${perm.canEdit ? 'true' : 'false'}"
            style="border:1px solid #dadce0;border-radius:6px;padding:14px 16px;min-height:320px;max-height:52vh;
                   overflow:auto;background:#fff;font-family:'Times New Roman',serif;font-size:14px;line-height:1.45;"></div>
          <div id="canhBao" style="margin-top:6px;font-size:13px;color:#c5221f;"></div>
        </div>
        <div>
          <div style="font-weight:600;margin-bottom:4px;">Biến điền dữ liệu</div>
          <div style="font-size:12px;color:#5f6368;margin-bottom:6px;">Bấm để chèn vào chỗ con trỏ. Khi in, biến được thay bằng dữ liệu thật.</div>
          <div style="max-height:46vh;overflow:auto;border:1px solid #eee;border-radius:6px;padding:6px;">
            ${dsBien.map(t => `<button type="button" class="btn small secondary" data-bien="${t}"
                style="display:block;width:100%;text-align:left;margin-bottom:3px;font-family:monospace;font-size:12px;">${t}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnDong">Đóng</button>
        <button type="button" class="btn secondary" id="btnInThu">🖨 In thử</button>
        ${perm.canEdit ? '<button type="button" class="btn" id="btnLuu">Lưu mẫu</button>' : ''}
      </div>`;
    const modal = openModal(html);
    const o = modal.querySelector('#oSoan');
    /* Đặt nội dung bằng innerHTML CHỦ ĐÍCH: đây là mẫu do chính người có quyền HRM soạn, và backend
       đã lọc thẻ nguy hiểm trước khi lưu (locMauAnToan). Mẫu gốc thì nằm trong chính file này. */
    o.innerHTML = noiDung;

    /* Hai loại hỏng đều làm biến in ra nguyên chữ {{...}}, nên phải báo cả hai:
       - gõ sai tên biến;
       - biến bị CẮT ĐÔI bởi thẻ. Bôi đậm nửa chữ trong ô soạn thảo là trình duyệt chèn thẻ vào
         giữa: {{Ho<b>Ten}}. Nhìn trên màn hình vẫn thấy "{{HoTen}}" nên không ai nghi gì, mà
         regex thay biến không còn khớp. So số biến ở TEXT với số biến ở HTML là lòi ra ngay. */
    const demBien = s => (String(s).match(/\{\{\s*[A-Za-z0-9_]+\s*\}\}/g) || []).length;
    const raCanhBao = () => {
      const la = bienLa(o.innerHTML, dsBien);
      const bo = [];
      if (la.length) bo.push('⚠️ Biến không có thật, khi in sẽ hiện nguyên chữ: ' + la.map(x => '{{' + x + '}}').join(', '));
      if (demBien(o.textContent) > demBien(o.innerHTML))
        bo.push('⚠️ Có biến bị thẻ định dạng cắt đôi (ví dụ bôi đậm nửa chữ). Xóa biến đó đi rồi bấm lại nút biến ở cột phải.');
      modal.querySelector('#canhBao').innerHTML = bo.map(x => escapeHtml(x)).join('<br>');
    };
    o.addEventListener('input', raCanhBao);
    raCanhBao();

    // Chặn mousedown ở MỌI nút tác động vào ô soạn thảo: không chặn thì bấm nút là mất con trỏ,
    // định dạng rơi vào chỗ khác hoặc không ăn gì.
    modal.querySelectorAll('[data-lenh],[data-bien]').forEach(b =>
      b.addEventListener('mousedown', e => e.preventDefault()));

    modal.querySelectorAll('[data-lenh]').forEach(b => b.addEventListener('click', () => {
      o.focus();
      try { document.execCommand(b.dataset.lenh, false, null); } catch (e) { /* trình duyệt bỏ lệnh này */ }
      raCanhBao();
    }));
    modal.querySelectorAll('[data-bien]').forEach(b => b.addEventListener('click', () => {
      o.focus();
      const txt = '{{' + b.dataset.bien + '}}';
      try { document.execCommand('insertText', false, txt); }
      catch (e) { o.innerHTML += txt; }    // trình duyệt không hỗ trợ thì nối vào cuối, không mất chữ
      raCanhBao();
    }));

    /* ------------------------------------------------------------------------------------------
       SỬA BẢNG (v8.86)
       ------------------------------------------------------------------------------------------
       Nguyen 2026-10-10: "không xóa được bảng". Đúng — trong ô soạn thảo, bảng là một khối:
       bôi đen rồi bấm Delete chỉ xóa chữ trong các ô, cái bảng rỗng vẫn nằm đó. execCommand cũng
       không có lệnh nào cho bảng. Nên phải thao tác thẳng trên DOM.

       ⚠️ Nút phải chặn mousedown: bấm nút là ô soạn thảo mất focus, con trỏ (selection) bay mất và
       không còn biết đang đứng ở ô nào. preventDefault giữ nguyên con trỏ ở chỗ cũ.

       ⚠️ Ô GỘP (colspan): các mẫu có sẵn dùng colspan (dòng "Nơi cấp", "Nơi cư trú" gộp 4 ô). Thêm
       hoặc xóa cột ở bảng có ô gộp sẽ làm các dòng lệch nhau — có cảnh báo trước khi làm. */
    function oDangDung() {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return null;
      let n = sel.anchorNode;
      if (n && n.nodeType === 3) n = n.parentNode;
      while (n && n !== o && n.nodeName) {
        const t = n.nodeName.toLowerCase();
        if (t === 'td' || t === 'th') return n;
        n = n.parentNode;
      }
      return null;
    }
    function cacDong(bang) { return Array.prototype.slice.call(bang.rows || []); }
    function coOGop(bang) {
      return cacDong(bang).some(tr => Array.prototype.slice.call(tr.cells)
        .some(td => (td.colSpan || 1) > 1 || (td.rowSpan || 1) > 1));
    }

    const viecBang = {
      themDong(td) {
        const tr = td.parentNode, moi = tr.cloneNode(true);
        // clone để giữ đúng số ô + style + colspan, rồi dọn sạch chữ.
        Array.prototype.slice.call(moi.cells).forEach(c => { c.innerHTML = '&nbsp;'; });
        tr.parentNode.insertBefore(moi, tr.nextSibling);
      },
      xoaDong(td) {
        const tr = td.parentNode, bang = tr.closest('table');
        if (cacDong(bang).length <= 1) {
          if (!confirm('Đây là dòng cuối cùng. Xóa nó là xóa luôn cả bảng. Đồng ý?')) return;
          bang.remove(); return;
        }
        tr.remove();
      },
      themCot(td) {
        const bang = td.closest('table'), i = td.cellIndex;
        if (coOGop(bang) && !confirm('Bảng này có ô gộp (colspan). Thêm cột có thể làm các dòng lệch nhau, phải căn lại tay.\n\nVẫn thêm?')) return;
        cacDong(bang).forEach(tr => {
          const moi = document.createElement(tr.cells[0] && tr.cells[0].nodeName.toLowerCase() === 'th' ? 'th' : 'td');
          moi.innerHTML = '&nbsp;';
          if (i + 1 < tr.cells.length) tr.insertBefore(moi, tr.cells[i + 1]);
          else tr.appendChild(moi);
        });
      },
      xoaCot(td) {
        const bang = td.closest('table'), i = td.cellIndex;
        if (coOGop(bang) && !confirm('Bảng này có ô gộp (colspan). Xóa cột có thể làm các dòng lệch nhau, phải căn lại tay.\n\nVẫn xóa?')) return;
        if ((td.parentNode.cells || []).length <= 1) {
          if (!confirm('Đây là cột cuối cùng. Xóa nó là xóa luôn cả bảng. Đồng ý?')) return;
          bang.remove(); return;
        }
        cacDong(bang).forEach(tr => { if (tr.cells[i]) tr.deleteCell(i); });
      },
      xoaBang(td) {
        if (!confirm('Xóa cả bảng này?')) return;
        td.closest('table').remove();
      }
    };

    modal.querySelectorAll('[data-bang]').forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault());   // giữ con trỏ trong ô soạn thảo
      b.addEventListener('click', () => {
        const td = oDangDung();
        if (!td) { toast('Bấm chuột vào một ô trong bảng trước đã.', 'error'); return; }
        viecBang[b.dataset.bang](td);
        raCanhBao();
      });
    });

    modal.querySelector('#btnDong').addEventListener('click', closeModal);
    modal.querySelector('#btnInThu').addEventListener('click', () => inThuMau(maMau, o.innerHTML));
    const btnLuu = modal.querySelector('#btnLuu');
    if (btnLuu) btnLuu.addEventListener('click', async () => {
      const nd = o.innerHTML;
      if (!nd.replace(/<[^>]*>/g, '').trim()) { toast('Nội dung mẫu đang trống.', 'error'); return; }
      const la = bienLa(nd, dsBien);
      if (la.length && !confirm(`Mẫu có biến không có thật: ${la.map(x => '{{' + x + '}}').join(', ')}\n\nKhi in sẽ hiện nguyên chữ đó. Vẫn lưu?`)) return;
      if (demBien(o.textContent) > demBien(nd) &&
          !confirm('Có biến bị thẻ định dạng cắt đôi — khi in sẽ hiện nguyên chữ {{...}}.\n\nVẫn lưu?')) return;
      btnLuu.disabled = true;
      try {
        await apiPut('/api/hrm/mauvanban/' + encodeURIComponent(maMau), { noiDung: nd });
        closeModal(); toast('Đã lưu mẫu.', 'success'); renderMauVanBan();
      } catch (err) { btnLuu.disabled = false; toast(err.message, 'error'); }
    });
  }

  return { render, getTabs };
})();
