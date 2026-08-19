// ================================================================
// PHAN HE TINH LUONG (PAYROLL) - v6.1 Phase 2 (frontend)
// ----------------------------------------------------------------
// 3 tab: Cau hinh luong, Cham cong (may cham cong IP/Port + tong hop + sua tay),
// Luong cong nhat (chon ky -> tinh -> sua tam ung -> chot -> xuat Excel / file CK).
// Cac mo hinh luong khac o Phase sau.
// ================================================================
window.ModulePayroll = (function () {
  let container, currentUser, activeTab = 'cauhinh';
  let perm = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  const now = new Date();
  let selNam = now.getFullYear(), selThang = now.getMonth() + 1;

  const TABS = [
    { key: 'cauhinh', label: 'Cấu hình lương' },
    { key: 'chamcong', label: 'Chấm công' },
    { key: 'luongcongnhat', label: 'Lương công nhật' },
    { key: 'luongmay', label: 'Lương khoán may' },
    { key: 'luonggcinthe', label: 'Lương GC / In thêu' },
    { key: 'luongladonggoi', label: 'Lương là / đóng gói' },
    { key: 'luongtraivaicat', label: 'Lương trải vải cắt' }   // v5.91
  ];
  function getTabs() { return TABS; }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.PAYROLL || {});
    perm = effectivePerm(user, 'PAYROLL', activeTab, rawPerm);
    if (activeTab === 'cauhinh') return renderCauHinh();
    if (activeTab === 'chamcong') return renderChamCong();
    if (activeTab === 'luongcongnhat') return renderLuong();
    if (activeTab === 'luongmay') return renderLuongMay();
    if (activeTab === 'luonggcinthe') return renderLuongGcInThe();
    if (activeTab === 'luongladonggoi') return renderLuongLaDongGoi();
    if (activeTab === 'luongtraivaicat') return renderLuongTraiVaiCat();   // v5.91
  }

  const money = (v) => (v == null || v === '' ? '0' : fmtNumber(Number(v)));
  const num = (v) => Number(v) || 0;
  // Bo chon ky (nam + thang) dung chung.
  function periodBar(onChange, extra) {
    const years = []; for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) years.push(y);
    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
      <label style="font-weight:600;">Kỳ lương:</label>
      <select id="pNam">${years.map(y => `<option value="${y}" ${y === selNam ? 'selected' : ''}>Năm ${y}</option>`).join('')}</select>
      <select id="pThang">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<option value="${m}" ${m === selThang ? 'selected' : ''}>Tháng ${m}</option>`).join('')}</select>
      ${extra || ''}</div>`;
  }
  function wirePeriod(root, onChange) {
    root.querySelector('#pNam').addEventListener('change', e => { selNam = parseInt(e.target.value, 10); onChange(); });
    root.querySelector('#pThang').addEventListener('change', e => { selThang = parseInt(e.target.value, 10); onChange(); });
  }
  /* v5.60.1: cột TIME của SQL Server (GioVao/GioRa) được trả về dạng '1970-01-01T08:40:00.000Z'
     nên cắt 5 ký tự đầu ra "1970-". Hàm này lấy đúng HH:mm cho mọi dạng: chuỗi ISO 1970,
     'HH:mm:ss.xxxxxxx', hoặc đối tượng Date. */
  function fmtGio(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) {
      const p = n => String(n).padStart(2, '0');
      return p(v.getUTCHours()) + ':' + p(v.getUTCMinutes());
    }
    const s = String(v);
    const iso = s.match(/T(\d{2}):(\d{2})/);            // '1970-01-01T08:40:00.000Z'
    if (iso) return iso[1] + ':' + iso[2];
    const hhmm = s.match(/^(\d{1,2}):(\d{2})/);          // '08:40:00.0000000'
    if (hhmm) return String(hhmm[1]).padStart(2, '0') + ':' + hhmm[2];
    return '';
  }
  async function downloadFile(url, filename) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) { let m = 'Lỗi tải file.'; try { m = (await res.json()).message || m; } catch (_) { } toast(m, 'error'); return; }
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) { toast(e.message, 'error'); }
  }

  /* ================================================================
     1. CAU HINH LUONG
     ================================================================ */
  async function renderCauHinh() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet('/api/payroll/config?nam=' + selNam)).data; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    const c = d.cauHinh || {};
    const f = (label, id, v, step) => `<div class="form-row" style="margin:0;"><label>${label}</label><input type="number" step="${step || 'any'}" id="${id}" value="${v != null ? v : ''}"></div>`;
    container.innerHTML = `
      <h3>Cấu hình lương ${perm.canEdit ? '' : '(chỉ xem)'}</h3>
      <p style="color:#5f6368;font-size:13px;">Các hằng số này áp dụng cho toàn bộ bảng lương. Đang seed theo file lương của công ty (giảm trừ 15.5tr/6.2tr, biểu thuế 5 bậc tùy chỉnh) — sửa được.</p>
      <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;margin-bottom:12px;"><legend style="font-weight:600;color:#1a73e8;">Bảo hiểm & giảm trừ & tăng ca</legend>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 16px;">
          ${f('BHXH NLĐ (%)', 'c_bhxhNld', c.BhxhNld)} ${f('BHYT NLĐ (%)', 'c_bhytNld', c.BhytNld)} ${f('BHTN NLĐ (%)', 'c_bhtnNld', c.BhtnNld)}
          ${f('BHXH DN (%)', 'c_bhxhDn', c.BhxhDn)} ${f('BHYT DN (%)', 'c_bhytDn', c.BhytDn)} ${f('BHTN DN (%)', 'c_bhtnDn', c.BhtnDn)}
          ${f('Giảm trừ bản thân (đ)', 'c_gtBanThan', c.GiamTruBanThan)} ${f('Giảm trừ / người phụ thuộc (đ)', 'c_gtNPT', c.GiamTruNPT)} ${f('Giờ chuẩn / ngày', 'c_gioChuan', c.GioChuanNgay)}
          ${f('Hệ số TC ngày thường', 'c_hsThuong', c.HsTangCaThuong)} ${f('Hệ số TC chủ nhật', 'c_hsCN', c.HsTangCaChuNhat)} ${f('Hệ số TC lễ tết', 'c_hsLe', c.HsTangCaLeTet)}
          ${f('Phụ cấp ca đêm (+)', 'c_caDem', c.PcCaDem)} ${f('Tăng ca đêm (+)', 'c_tcDem', c.PcTangCaDem)} ${f('Ngày trả lương', 'c_ngayTra', c.NgayTraLuong)}
        </div>
        ${perm.canEdit ? `<div style="margin-top:10px;"><button class="btn" id="btnSaveCfg">💾 Lưu cấu hình</button></div>` : ''}
      </fieldset>
      <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;margin-bottom:12px;"><legend style="font-weight:600;color:#1a73e8;">Biểu thuế TNCN (5 bậc)</legend>
        <table style="font-size:13px;"><thead><tr><th>Bậc</th><th>Từ mức (đ)</th><th>Đến mức (đ, trống=trở lên)</th><th>Thuế suất (0.05=5%)</th><th>Trừ đi (đ)</th></tr></thead>
        <tbody id="thueBody">${(d.bacThue || []).map((b, i) => rowThue(b, i)).join('')}</tbody></table>
        ${perm.canEdit ? `<div style="margin-top:10px;"><button class="btn secondary" id="btnSaveThue">💾 Lưu biểu thuế</button></div>` : ''}
      </fieldset>
      <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;"><legend style="font-weight:600;color:#1a73e8;">Công chuẩn theo tháng (năm ${selNam})</legend>
        ${periodBarYearOnly()}
        <div id="congChuanGrid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;">${congChuanInputs(d.congChuan || [])}</div>
        ${perm.canEdit ? `<div style="margin-top:10px;"><button class="btn secondary" id="btnAutoCC">📅 Tự tính theo lịch (trừ Chủ nhật)</button> <button class="btn secondary" id="btnSaveCC">💾 Lưu công chuẩn</button></div>` : ''}
      </fieldset>`;
    // year selector for cong chuan
    const yNam = container.querySelector('#ccNam');
    if (yNam) yNam.addEventListener('change', e => { selNam = parseInt(e.target.value, 10); renderCauHinh(); });
    const bCfg = container.querySelector('#btnSaveCfg'); if (bCfg) bCfg.addEventListener('click', saveCfg);
    const bThue = container.querySelector('#btnSaveThue'); if (bThue) bThue.addEventListener('click', saveThue);
    const bCC = container.querySelector('#btnSaveCC'); if (bCC) bCC.addEventListener('click', saveCongChuan);
    // v5.37: tự tính công chuẩn = số ngày trong tháng − số Chủ nhật (chưa trừ lễ/tết — điều chỉnh tay rồi Lưu).
    const bAuto = container.querySelector('#btnAutoCC');
    if (bAuto) bAuto.addEventListener('click', () => {
      for (let m = 1; m <= 12; m++) {
        const dim = new Date(selNam, m, 0).getDate();
        let cong = 0;
        for (let d = 1; d <= dim; d++) if (new Date(selNam, m - 1, d).getDay() !== 0) cong++;
        const inp = container.querySelector(`.cc-inp[data-thang="${m}"]`); if (inp) inp.value = cong;
      }
      toast('Đã tự tính công chuẩn theo lịch (trừ Chủ nhật). Kiểm tra lễ/tết rồi bấm "Lưu công chuẩn".', 'info');
    });
  }
  function periodBarYearOnly() {
    const years = []; for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) years.push(y);
    return `<div style="margin-bottom:8px;"><label style="font-weight:600;margin-right:6px;">Năm:</label>
      <select id="ccNam">${years.map(y => `<option value="${y}" ${y === selNam ? 'selected' : ''}>${y}</option>`).join('')}</select></div>`;
  }
  function rowThue(b, i) {
    return `<tr data-i="${i}">
      <td>${i + 1}</td>
      <td><input type="number" class="t-tu" value="${b.TuMuc != null ? b.TuMuc : ''}" style="width:120px;"></td>
      <td><input type="number" class="t-den" value="${b.DenMuc != null ? b.DenMuc : ''}" style="width:120px;"></td>
      <td><input type="number" step="0.0001" class="t-suat" value="${b.ThueSuat != null ? b.ThueSuat : ''}" style="width:90px;"></td>
      <td><input type="number" class="t-tru" value="${b.TruDi != null ? b.TruDi : ''}" style="width:120px;"></td></tr>`;
  }
  function congChuanInputs(list) {
    const map = {}; list.forEach(x => map[x.Thang] = x.SoNgayCong);
    return Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
      `<div class="form-row" style="margin:0;"><label>Tháng ${m}</label><input type="number" step="0.5" class="cc-inp" data-thang="${m}" value="${map[m] != null ? map[m] : ''}"></div>`).join('');
  }
  async function saveCfg() {
    const g = id => num(container.querySelector('#' + id).value);
    try {
      await apiPut('/api/payroll/config', {
        bhxhNld: g('c_bhxhNld'), bhytNld: g('c_bhytNld'), bhtnNld: g('c_bhtnNld'), bhxhDn: g('c_bhxhDn'), bhytDn: g('c_bhytDn'), bhtnDn: g('c_bhtnDn'),
        giamTruBanThan: g('c_gtBanThan'), giamTruNPT: g('c_gtNPT'), gioChuanNgay: g('c_gioChuan'),
        hsTangCaThuong: g('c_hsThuong'), hsTangCaChuNhat: g('c_hsCN'), hsTangCaLeTet: g('c_hsLe'), pcCaDem: g('c_caDem'), pcTangCaDem: g('c_tcDem'), ngayTraLuong: g('c_ngayTra')
      });
      toast('Đã lưu cấu hình.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }
  async function saveThue() {
    const rows = [...container.querySelectorAll('#thueBody tr')].map(tr => ({
      tuMuc: tr.querySelector('.t-tu').value, denMuc: tr.querySelector('.t-den').value,
      thueSuat: tr.querySelector('.t-suat').value, truDi: tr.querySelector('.t-tru').value
    }));
    try { await apiPut('/api/payroll/config/bacthue', { rows }); toast('Đã lưu biểu thuế.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }
  async function saveCongChuan() {
    try {
      for (const inp of container.querySelectorAll('.cc-inp')) {
        if (inp.value === '') continue;
        await apiPut('/api/payroll/config/congchuan', { nam: selNam, thang: parseInt(inp.dataset.thang, 10), soNgayCong: num(inp.value) });
      }
      toast('Đã lưu công chuẩn.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  /* ================================================================
     2. CHAM CONG
     ================================================================ */
  async function renderChamCong() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let mays = [], cc = { rows: [] }, ccDetail = [];
    try {
      mays = (await apiGet('/api/payroll/maychamcong')).data || [];
      cc = (await apiGet(`/api/payroll/chamcong?nam=${selNam}&thang=${selThang}`)).data || { rows: [] };
    } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    try { ccDetail = (await apiGet(`/api/payroll/chamcong/chitiet?nam=${selNam}&thang=${selThang}`)).data || []; } catch (e) { }
    container.innerHTML = `
      <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px;margin-bottom:14px;">
        <legend style="font-weight:600;color:#1a73e8;">Máy chấm công (kết nối theo IP + Port)</legend>
        ${perm.canCreate ? `<button class="btn small" id="btnAddMay">➕ Thêm máy</button>` : ''}
        <table style="font-size:13px;margin-top:8px;"><thead><tr><th>Tên máy</th><th>IP</th><th>Port</th><th>Giao thức</th><th>Trạng thái</th><th>Đồng bộ cuối</th><th style="width:260px">Thao tác</th></tr></thead>
        <tbody>${mays.map(m => `<tr>
          <td>${escapeHtml(m.TenMay)}</td><td>${escapeHtml(m.DiaChiIP)}</td><td>${m.Port}</td><td>${escapeHtml(m.LoaiGiaoThuc)}</td>
          <td>${escapeHtml(m.TrangThai || '')}</td><td>${m.LanDongBoCuoi ? fmtDate(m.LanDongBoCuoi) : '—'}</td>
          <td>${perm.canEdit ? `<button class="btn small act-pull" data-id="${m.MayChamCongID}">🔌 Kéo dữ liệu</button>
              <button class="btn small secondary act-users" data-id="${m.MayChamCongID}">👥 Tải NV từ máy</button>
              ${m.LoaiGiaoThuc === 'Hikvision' ? `<button class="btn small secondary act-maytest" data-id="${m.MayChamCongID}">🔎 Kiểm tra</button>` : ''}
              <button class="btn small secondary act-mayedit" data-id="${m.MayChamCongID}">Sửa</button>` : ''}
              ${perm.canDelete ? `<button class="btn small danger act-maydel" data-id="${m.MayChamCongID}">Xóa</button>` : ''}</td>
        </tr>`).join('') || `<tr><td colspan="7" class="empty-hint">Chưa khai báo máy chấm công nào.</td></tr>`}</tbody></table>
        ${perm.canEdit ? `<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px dashed #e0e0e0;">
          <div class="form-row" style="margin:0;"><label>Từ ngày</label><input type="date" id="pullTu"></div>
          <div class="form-row" style="margin:0;"><label>Đến ngày</label><input type="date" id="pullDen"></div>
          <div class="form-row" style="margin:0;"><label>Mã chấm công (rỗng = tất cả)</label><input type="text" id="pullMa" style="width:140px;" placeholder="VD: 5"></div>
          <span style="font-size:12px;color:#5f6368;align-self:center;">← áp dụng khi bấm "Kéo dữ liệu"</span>
          <span style="flex:1;"></span>
          <a class="btn small secondary" href="/api/payroll/chamcong/template">⬇️ File mẫu</a>
          <button class="btn small secondary" id="btnImportCC">⬆️ Tải lên file chấm công</button>
          <input type="file" id="fileCC" accept=".xlsx,.xls" style="display:none;">
        </div>` : ''}
        <p style="color:#5f6368;font-size:12px;margin:6px 0 0;">Bấm "👥 Tải NV từ máy" để lấy danh sách người trên máy rồi gán vào nhân viên (lưu trường "Mã chấm công") — hệ thống map theo mã này khi kéo. File tải lên cần 2 cột: <b>MaChamCong</b>, <b>ThoiGian</b>.</p>
      </fieldset>
      ${periodBar(null, `${perm.canEdit ? `<button class="btn small secondary" id="btnTongHop">🔄 Tổng hợp từ máy → bảng công</button>
        <button class="btn small secondary" id="btnCauHinhCC">⚙️ Cài đặt chấm công</button>
        <button class="btn small secondary" id="btnRawCC">📄 Chi tiết đã kéo về</button>` : ''}
        ${perm.canDelete ? `<button class="btn small danger" id="btnXoaBangCC">🗑️ Xóa bảng công tháng</button>` : ''}`)}
      <table><thead><tr><th>Mã NV</th><th>Họ tên</th><th>Bộ phận</th><th>Tổng công</th><th>Giờ tăng ca</th><th>Số ngày chấm</th><th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${cc.rows.map(r => `<tr>
        <td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td>${escapeHtml(r.TenBoPhan || '')}</td>
        <td style="text-align:right;font-weight:600;">${num(r.TongCong)}</td><td style="text-align:right;">${num(r.TongGioTangCa)}</td><td style="text-align:right;">${num(r.SoNgay)}</td>
        <td>${perm.canEdit ? `<button class="btn small secondary act-ccedit" data-id="${r.NhanVienID}" data-ten="${escapeHtml(r.HoTen)}">Sửa chi tiết</button>` : ''}</td>
      </tr>`).join('') || `<tr><td colspan="7" class="empty-hint">Chưa có dữ liệu chấm công.</td></tr>`}</tbody></table>
      <h4 style="margin:16px 0 4px;">Chi tiết chấm công đã kéo về (giờ vào / giờ ra) — tháng ${selThang}/${selNam}</h4>
      <div style="overflow:auto;max-height:50vh;"><table style="font-size:13px;"><thead><tr><th>Ngày</th><th>Mã NV</th><th>Họ tên / Mã máy</th><th>Giờ vào</th><th>Giờ ra</th><th>Số lần</th></tr></thead>
      <tbody>${ccDetail.map(r => `<tr><td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen || ('(mã ' + (r.MaChamMay || '') + ' — chưa gán)'))}</td><td style="text-align:center;">${escapeHtml(r.GioVao || '')}</td><td style="text-align:center;">${escapeHtml(r.GioRa || '')}</td><td style="text-align:right;">${num(r.SoLan)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty-hint">Chưa có dữ liệu kéo về trong tháng này.</td></tr>`}</tbody></table></div>`;
    wirePeriod(container, renderChamCong);
    const bAdd = container.querySelector('#btnAddMay'); if (bAdd) bAdd.addEventListener('click', () => openMayForm(null));
    // v5.60: cài đặt giờ vào/ra + tăng ca, xem chi tiết từng lần quẹt, xóa bảng công tháng.
    const bCfg = container.querySelector('#btnCauHinhCC'); if (bCfg) bCfg.addEventListener('click', openCauHinhChamCong);
    const bRaw = container.querySelector('#btnRawCC'); if (bRaw) bRaw.addEventListener('click', () => openRawChamCong());
    const bXoaCC = container.querySelector('#btnXoaBangCC');
    if (bXoaCC) bXoaCC.addEventListener('click', async () => {
      if (!confirm(`XÓA bảng chấm công tháng ${selThang}/${selNam}?\n\nChỉ xóa các dòng do MÁY tổng hợp — dòng đã SỬA TAY được giữ lại.\nSau khi xóa, bấm "Tổng hợp từ máy" để tính lại từ dữ liệu đã kéo về.`)) return;
      try {
        const r = await apiDelete(`/api/payroll/chamcong/ngay-thang?nam=${selNam}&thang=${selThang}`);
        toast(`Đã xóa ${r.data.deleted} dòng bảng công.`, 'success'); renderChamCong();
      } catch (e) { toast(e.message, 'error'); }
    });
    const bTH = container.querySelector('#btnTongHop'); if (bTH) bTH.addEventListener('click', tongHopChamCong);
    container.querySelectorAll('.act-pull').forEach(b => b.addEventListener('click', () => keoDuLieu(b.dataset.id)));
    container.querySelectorAll('.act-mayedit').forEach(b => b.addEventListener('click', () => openMayForm(mays.find(m => m.MayChamCongID == b.dataset.id))));
    container.querySelectorAll('.act-maydel').forEach(b => b.addEventListener('click', async () => { if (!confirm('Xóa máy này?')) return; try { await apiDelete('/api/payroll/maychamcong/' + b.dataset.id); toast('Đã xóa.', 'success'); renderChamCong(); } catch (e) { toast(e.message, 'error'); } }));
    container.querySelectorAll('.act-ccedit').forEach(b => b.addEventListener('click', () => openChamCongChiTiet(b.dataset.id, b.dataset.ten)));
    container.querySelectorAll('.act-users').forEach(b => b.addEventListener('click', () => openDeviceUsers(b.dataset.id)));
    container.querySelectorAll('.act-maytest').forEach(b => b.addEventListener('click', () => testMay(b.dataset.id)));   // v5.59 Hikvision
    const bImp = container.querySelector('#btnImportCC'); const fImp = container.querySelector('#fileCC');
    if (bImp && fImp) {
      bImp.addEventListener('click', () => fImp.click());
      fImp.addEventListener('change', async () => {
        const file = fImp.files[0]; if (!file) return;
        const fd = new FormData(); fd.append('file', file);
        try {
          const res = await fetch('/api/payroll/chamcong/import', { method: 'POST', credentials: 'same-origin', body: fd });
          const data = await res.json(); if (!data.success) throw new Error(data.message || 'Lỗi import.');
          toast(`Đã nhập ${data.data.inserted}/${data.data.total} dòng (bỏ ${data.data.skipped}). Bấm "Tổng hợp từ máy" để cập nhật bảng công.`, 'success'); renderChamCong();
        } catch (e) { toast(e.message, 'error'); }
      });
    }
  }
  // v5.37: lấy danh sách người trên máy (getUsers) → gán vào NhanVien (lưu NhanVien.MaChamCong). Đây là
  // đường ghi Mã chấm công còn thiếu — nguyên nhân "kéo được nhưng không hiện dữ liệu" (map rỗng).
  async function openDeviceUsers(mayId) {
    toast('Đang lấy danh sách...', 'info');
    let nvList = [], rawList = [], devUsers = [];
    try { nvList = (await apiGet('/api/danhmuc/nhanvien')).data || []; } catch (e) { toast(e.message, 'error'); return; }
    // v5.37.1: dựng danh sách từ MÃ ĐÃ KÉO VỀ (ChamCongRaw distinct) — không phụ thuộc getUsers (nhiều máy trả rỗng).
    try { rawList = (await apiGet('/api/payroll/maychamcong/' + mayId + '/machamcong-list')).data || []; } catch (e) { }
    try { devUsers = (await apiPost('/api/payroll/maychamcong/' + mayId + '/nhanvien-tumay', {})).data || []; } catch (e) { /* máy có thể không hỗ trợ getUsers/chưa cài lib — vẫn dùng danh sách đã kéo */ }
    const merged = {};
    rawList.forEach(r => { const k = String(r.MaChamMay); merged[k] = { enrollId: k, ten: r.HoTen || '', soLan: r.SoLan || 0, nvId: r.NhanVienID || null }; });
    devUsers.forEach(u => { const k = String(u.enrollId); if (!merged[k]) merged[k] = { enrollId: k, ten: u.ten || '', soLan: 0, nvId: null }; else if (!merged[k].ten) merged[k].ten = u.ten || ''; });
    const list = Object.values(merged).sort((a, b) => (b.soLan - a.soLan) || String(a.enrollId).localeCompare(String(b.enrollId)));
    if (!list.length) { toast('Chưa có mã chấm công nào — hãy bấm "Kéo dữ liệu" trước (máy này không trả về danh sách nhân viên qua getUsers).', 'error'); return; }
    const byMa = {}; nvList.forEach(nv => { if (nv.MaChamCong) byMa[String(nv.MaChamCong).trim()] = nv.NhanVienID; });
    const chuaGan = list.filter(u => !(u.nvId || byMa[u.enrollId])).length;
    const modal = openModal(`<h3>Mã chấm công (${list.length} mã — chưa gán ${chuaGan})</h3>
      <p style="font-size:12px;color:#5f6368;">Gộp từ máy + mã đã kéo về. Gán mỗi mã vào 1 nhân viên rồi bấm Lưu — các bản ghi đã kéo sẽ TỰ GÁN LẠI theo mã này (không phải kéo lại), rồi bấm "Tổng hợp từ máy".</p>
      <div style="max-height:55vh;overflow:auto;"><table style="font-size:13px;"><thead><tr><th>Mã máy</th><th>Tên trên máy</th><th>Số lần chấm</th><th>Gán vào nhân viên</th></tr></thead>
      <tbody>${list.map(u => `<tr><td>${escapeHtml(u.enrollId)}</td><td>${escapeHtml(u.ten)}</td><td style="text-align:right;">${u.soLan || 0}</td>
        <td><select class="du-nv" data-ma="${escapeHtml(u.enrollId)}"><option value="">-- Không gán --</option>${nvList.map(nv => `<option value="${nv.NhanVienID}" ${String(u.nvId || byMa[u.enrollId]) === String(nv.NhanVienID) ? 'selected' : ''}>${escapeHtml((nv.MaNhanVien ? nv.MaNhanVien + ' - ' : '') + nv.HoTen)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="duClose">Đóng</button><button type="button" class="btn secondary" id="duAuto">🔗 Tự khớp theo Mã NV</button><button type="button" class="btn" id="duSave">💾 Lưu gán</button></div>`);
    modal.querySelector('#duClose').addEventListener('click', closeModal);
    // v5.37.2: tự khớp hàng loạt — mã trên máy trùng Mã nhân viên (NVxxx) thì gán sẵn dropdown (chưa gán mới khớp).
    modal.querySelector('#duAuto').addEventListener('click', () => {
      const byMaNV = {}; nvList.forEach(nv => { if (nv.MaNhanVien) byMaNV[String(nv.MaNhanVien).trim().toLowerCase()] = nv.NhanVienID; });
      let khop = 0;
      modal.querySelectorAll('.du-nv').forEach(sel => {
        if (sel.value) return;
        const hit = byMaNV[String(sel.dataset.ma).trim().toLowerCase()];
        if (hit) { sel.value = String(hit); khop++; }
      });
      toast(khop ? `Đã tự khớp ${khop} mã theo Mã NV — kiểm tra lại rồi bấm Lưu.` : 'Không có mã nào trùng Mã NV để tự khớp.', khop ? 'success' : 'info');
    });
    modal.querySelector('#duSave').addEventListener('click', async () => {
      const maps = [];
      modal.querySelectorAll('.du-nv').forEach(sel => { if (sel.value) maps.push({ nhanVienId: parseInt(sel.value, 10), maChamCong: sel.dataset.ma }); });
      if (!maps.length) { toast('Chưa gán nhân viên nào.', 'error'); return; }
      try { const r = await apiPost('/api/payroll/maychamcong/mapnhanvien', { maps }); closeModal(); toast(`Đã gán ${r.data.updated} nhân viên, cập nhật ${r.data.backfilled || 0} bản ghi đã kéo. Bấm "Tổng hợp từ máy → bảng công".`, 'success'); renderChamCong(); } catch (e) { toast(e.message, 'error'); }
    });
  }

  function openMayForm(m) {
    m = m || {};
    const f = (label, inner) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}</div>`;
    const html = `<h3>${m.MayChamCongID ? 'Sửa' : 'Thêm'} máy chấm công</h3>
      <form id="mayForm"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
        ${f('Tên máy *', `<input id="m_ten" value="${escapeHtml(m.TenMay || '')}" required>`)}
        ${f('Vị trí', `<input id="m_vitri" value="${escapeHtml(m.ViTri || '')}">`)}
        ${f('Địa chỉ IP *', `<input id="m_ip" value="${escapeHtml(m.DiaChiIP || '')}" placeholder="192.168.1.201" required>`)}
        ${f('Port', `<input type="number" id="m_port" value="${m.Port || 4370}">`)}
        ${f('Giao thức', `<select id="m_gt" data-nosearch><option ${m.LoaiGiaoThuc === 'ZKTeco' || !m.LoaiGiaoThuc ? 'selected' : ''}>ZKTeco</option><option ${m.LoaiGiaoThuc === 'Hikvision' ? 'selected' : ''}>Hikvision</option><option ${m.LoaiGiaoThuc === 'Khác' ? 'selected' : ''}>Khác</option></select>`)}
        ${f('Trạng thái', `<select id="m_tt"><option ${m.TrangThai !== 'Tạm dừng' ? 'selected' : ''}>Hoạt động</option><option ${m.TrangThai === 'Tạm dừng' ? 'selected' : ''}>Tạm dừng</option></select>`)}
      </div>
      <div id="m_hikBox" style="display:none;border:1px solid #dadce0;border-radius:6px;padding:10px;margin-top:10px;">
        <div style="font-weight:600;margin-bottom:6px;">Đăng nhập máy Hikvision (ISAPI)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
          ${f('Tài khoản', `<input id="m_user" value="${escapeHtml(m.TenDangNhap || '')}" placeholder="admin">`)}
          ${f('Mật khẩu', `<input type="password" id="m_pass" placeholder="${m.MayChamCongID ? 'Để trống = giữ mật khẩu cũ' : 'Mật khẩu của máy'}">`)}
        </div>
        <label style="display:block;margin-top:8px;"><input type="checkbox" id="m_https" ${m.DungHTTPS ? 'checked' : ''}> Máy dùng HTTPS (mặc định bỏ trống = HTTP)</label>
        <div class="empty-hint" style="margin-top:6px;">Máy Hikvision (vd DS-K1T342MFWX) dùng cổng <b>80</b> và tài khoản quản trị của máy. Lưu xong bấm <b>🔌 Kiểm tra</b> ở danh sách để thử kết nối.</div>
      </div>
      ${f('Ghi chú', `<input id="m_gc" value="${escapeHtml(m.GhiChu || '')}">`)}
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div></form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    // v5.59: chọn Hikvision -> hiện ô tài khoản/mật khẩu + tự gợi ý cổng 80 (ZKTeco là 4370).
    const selGt = modal.querySelector('#m_gt'), inpPort = modal.querySelector('#m_port'), hikBox = modal.querySelector('#m_hikBox');
    function capNhatTheoGiaoThuc(doiPort) {
      const laHik = selGt.value === 'Hikvision';
      hikBox.style.display = laHik ? '' : 'none';
      if (doiPort) inpPort.value = laHik ? 80 : 4370;
    }
    capNhatTheoGiaoThuc(false);
    selGt.addEventListener('change', () => capNhatTheoGiaoThuc(true));
    modal.querySelector('#mayForm').addEventListener('submit', async e => {
      e.preventDefault();
      const matKhau = modal.querySelector('#m_pass').value;
      const payload = {
        tenMay: modal.querySelector('#m_ten').value.trim(), viTri: modal.querySelector('#m_vitri').value.trim(),
        diaChiIP: modal.querySelector('#m_ip').value.trim(), port: modal.querySelector('#m_port').value,
        loaiGiaoThuc: selGt.value, trangThai: modal.querySelector('#m_tt').value,
        ghiChu: modal.querySelector('#m_gc').value.trim(),
        tenDangNhap: modal.querySelector('#m_user').value.trim(),
        matKhau: matKhau ? matKhau : null,             // trống khi SỬA = giữ mật khẩu cũ
        dungHTTPS: modal.querySelector('#m_https').checked
      };
      try { if (m.MayChamCongID) await apiPut('/api/payroll/maychamcong/' + m.MayChamCongID, payload); else await apiPost('/api/payroll/maychamcong', payload); closeModal(); toast('Đã lưu.', 'success'); renderChamCong(); }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  /* v5.60: CÀI ĐẶT CHẤM CÔNG — giờ vào/ra chuẩn, nghỉ trưa, bao nhiêu giờ = 1 công,
     cách xử lý khi KHÔNG đủ 1 công (chia theo giờ), và quy tắc tính TĂNG CA. */
  async function openCauHinhChamCong() {
    let cfg;
    try { cfg = (await apiGet('/api/payroll/chamcong/cauhinh')).data || {}; }
    catch (e) { toast(e.message, 'error'); return; }
    const f = (label, inner, hint) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}${hint ? `<div style="font-size:11px;color:#5f6368;">${hint}</div>` : ''}</div>`;
    const modal = openModal(`
      <h3>⚙️ Cài đặt chấm công</h3>
      <form id="ccCfgForm">
        <fieldset style="border:1px solid #e0e0e0;border-radius:6px;padding:10px 12px;">
          <legend style="font-weight:600;">Giờ làm chuẩn → tính CÔNG</legend>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
            ${f('Giờ vào', `<input type="time" id="cc_gioVao" value="${escapeHtml(cfg.gioVao || '08:00')}">`)}
            ${f('Giờ ra', `<input type="time" id="cc_gioRa" value="${escapeHtml(cfg.gioRa || '17:00')}">`)}
            ${f('Nghỉ trưa từ', `<input type="time" id="cc_truaTu" value="${escapeHtml(cfg.nghiTruaTu || '')}">`, 'Để trống 2 ô = không trừ nghỉ trưa')}
            ${f('Nghỉ trưa đến', `<input type="time" id="cc_truaDen" value="${escapeHtml(cfg.nghiTruaDen || '')}">`)}
            ${f('Số giờ = 1 công', `<input type="number" step="0.5" min="1" id="cc_gioCong" value="${cfg.soGioMotCong != null ? cfg.soGioMotCong : 8}">`, 'Làm đủ số giờ này trong khung chuẩn = 1 công')}
            ${f('Làm tròn công', `<select id="cc_tron" data-nosearch>
                <option value="0" ${Number(cfg.lamTronCong) === 0 ? 'selected' : ''}>Không làm tròn (chia đúng theo giờ)</option>
                <option value="0.25" ${Number(cfg.lamTronCong) === 0.25 ? 'selected' : ''}>Theo 1/4 công (0.25)</option>
                <option value="0.5" ${Number(cfg.lamTronCong) === 0.5 ? 'selected' : ''}>Theo nửa công (0.5)</option>
              </select>`, 'Không đủ 1 công thì chia theo tỉ lệ giờ, làm tròn XUỐNG theo mức này')}
            ${f('Tối thiểu tính công (phút)', `<input type="number" min="0" id="cc_toiThieu" value="${cfg.toiThieuTinhCongPhut != null ? cfg.toiThieuTinhCongPhut : 30}">`, 'Làm ít hơn mức này = 0 công')}
          </div>
        </fieldset>
        <fieldset style="border:1px solid #e0e0e0;border-radius:6px;padding:10px 12px;margin-top:10px;">
          <legend style="font-weight:600;">Tăng ca (giờ ngoài khung chuẩn)</legend>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;">
            ${f('Chỉ tính khi làm quá giờ ra (phút)', `<input type="number" min="0" id="cc_otNguong" value="${cfg.otBatDauSauPhut != null ? cfg.otBatDauSauPhut : 30}">`, 'Về muộn dưới mức này không tính tăng ca')}
            ${f('Làm tròn tăng ca (giờ)', `<input type="number" step="0.25" min="0" id="cc_otTron" value="${cfg.otLamTronGio != null ? cfg.otLamTronGio : 0.5}">`, '0 = không làm tròn')}
            ${f('Tăng ca tối đa / ngày (giờ)', `<input type="number" step="0.5" min="0" id="cc_otMax" value="${cfg.otToiDaGioNgay != null ? cfg.otToiDaGioNgay : 6}">`, 'Chặn trên, tránh 1 lần quẹt sai thành tăng ca vô lý')}
            ${f('Tính cả phần đến sớm', `<label style="display:block;padding-top:6px;"><input type="checkbox" id="cc_otTruoc" ${cfg.tinhOtTruocGioVao ? 'checked' : ''}> Có tính giờ trước giờ vào là tăng ca</label>`)}
          </div>
          <div class="form-row" style="margin-top:8px;"><label>Ngày lễ / Tết (mỗi dòng 1 ngày, dạng 2026-09-02)</label>
            <textarea id="cc_ngayLe" rows="3" placeholder="2026-09-02&#10;2027-01-01">${escapeHtml((cfg.ngayLe || []).join('\n'))}</textarea>
            <div style="font-size:11px;color:#5f6368;">Tăng ca ngày lễ vào cột "Lễ/Tết"; Chủ nhật tự nhận diện vào cột "Chủ nhật".</div>
          </div>
        </fieldset>
        <p class="empty-hint" style="margin-top:8px;">Sau khi lưu, bấm <b>🔄 Tổng hợp từ máy → bảng công</b> để áp cài đặt mới cho tháng đang xem (các dòng đã sửa tay không bị ghi đè).</p>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu cài đặt</button></div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#ccCfgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        gioVao: modal.querySelector('#cc_gioVao').value, gioRa: modal.querySelector('#cc_gioRa').value,
        nghiTruaTu: modal.querySelector('#cc_truaTu').value, nghiTruaDen: modal.querySelector('#cc_truaDen').value,
        soGioMotCong: modal.querySelector('#cc_gioCong').value, lamTronCong: modal.querySelector('#cc_tron').value,
        toiThieuTinhCongPhut: modal.querySelector('#cc_toiThieu').value,
        otBatDauSauPhut: modal.querySelector('#cc_otNguong').value, otLamTronGio: modal.querySelector('#cc_otTron').value,
        otToiDaGioNgay: modal.querySelector('#cc_otMax').value, tinhOtTruocGioVao: modal.querySelector('#cc_otTruoc').checked,
        ngayLe: modal.querySelector('#cc_ngayLe').value.split('\n').map(s => s.trim()).filter(Boolean)
      };
      try { await apiPost('/api/payroll/chamcong/cauhinh', payload); closeModal(); toast('Đã lưu cài đặt chấm công. Bấm "Tổng hợp từ máy" để áp dụng.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  /* v5.60: CHI TIẾT ĐÃ KÉO VỀ — từng lần quẹt (không gộp), xóa 1 dòng sai hoặc xóa cả tháng để KÉO LẠI. */
  async function openRawChamCong(maChamCong) {
    let rows = [];
    const qs = `nam=${selNam}&thang=${selThang}` + (maChamCong ? '&maChamCong=' + encodeURIComponent(maChamCong) : '');
    try { rows = (await apiGet('/api/payroll/chamcong/raw?' + qs)).data || []; }
    catch (e) { toast(e.message, 'error'); return; }
    const modal = openModal(`
      <h3>📄 Chi tiết chấm công đã kéo về — tháng ${selThang}/${selNam}${maChamCong ? ' · mã ' + escapeHtml(maChamCong) : ''}</h3>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:8px;">
        <div class="form-row" style="margin:0;"><label>Lọc theo mã chấm công</label><input id="rawMa" value="${escapeHtml(maChamCong || '')}" style="width:140px;" placeholder="rỗng = tất cả"></div>
        <button type="button" class="btn small secondary" id="rawFilter">Xem</button>
        ${perm.canDelete ? `<button type="button" class="btn small danger" id="rawDelAll">🗑️ Xóa toàn bộ tháng (để kéo lại)</button>` : ''}
      </div>
      <p class="empty-hint">Hiển thị tối đa 3000 lần quẹt gần nhất. Xóa ở đây <b>chỉ xóa dữ liệu thô đã kéo</b>; sau khi kéo lại nhớ bấm "Tổng hợp từ máy".</p>
      <div style="overflow:auto;max-height:55vh;">
        <table style="font-size:13px;"><thead><tr><th>Thời gian</th><th>Mã máy</th><th>Mã NV</th><th>Họ tên</th><th>Máy</th><th>Nguồn</th>${perm.canDelete ? '<th style="width:60px"></th>' : ''}</tr></thead>
        <tbody>${rows.map(r => `<tr>
          <td>${escapeHtml(String(r.ThoiGian || '').replace('T', ' ').slice(0, 16))}</td>
          <td>${escapeHtml(r.MaChamMay || '')}</td>
          <td>${escapeHtml(r.MaNhanVien || '')}</td>
          <td>${escapeHtml(r.HoTen || '(chưa gán nhân viên)')}</td>
          <td>${escapeHtml(r.TenMay || '')}</td>
          <td>${escapeHtml(r.Nguon || '')}</td>
          ${perm.canDelete ? `<td><button class="btn small danger raw-del" data-id="${r.ID}">Xóa</button></td>` : ''}
        </tr>`).join('') || `<tr><td colspan="7" class="empty-hint">Chưa có dữ liệu kéo về trong tháng này.</td></tr>`}</tbody></table>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCloseRaw">Đóng</button></div>`);
    modal.querySelector('#btnCloseRaw').addEventListener('click', closeModal);
    modal.querySelector('#rawFilter').addEventListener('click', () => openRawChamCong(modal.querySelector('#rawMa').value.trim()));
    modal.querySelectorAll('.raw-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa lần quẹt này?')) return;
      try { await apiDelete('/api/payroll/chamcong/raw/' + b.dataset.id); toast('Đã xóa.', 'success'); openRawChamCong(maChamCong); }
      catch (e) { toast(e.message, 'error'); }
    }));
    const bAll = modal.querySelector('#rawDelAll');
    if (bAll) bAll.addEventListener('click', async () => {
      const ma = modal.querySelector('#rawMa').value.trim();
      if (!confirm(`XÓA dữ liệu chấm công đã kéo của tháng ${selThang}/${selNam}${ma ? ' (chỉ mã ' + ma + ')' : ' (TẤT CẢ mã)'}?\n\nSau đó bấm "🔌 Kéo dữ liệu" để kéo lại từ máy.`)) return;
      try {
        const r = await apiDelete(`/api/payroll/chamcong/raw?nam=${selNam}&thang=${selThang}` + (ma ? '&maChamCong=' + encodeURIComponent(ma) : ''));
        toast(`Đã xóa ${r.data.deleted} lần quẹt. Giờ bấm "Kéo dữ liệu" để tải lại.`, 'success');
        closeModal(); renderChamCong();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  // v5.59: thử kết nối máy Hikvision (đọc thử danh sách nhân viên trên máy).
  async function testMay(id) {
    toast('Đang thử kết nối...', 'info');
    try {
      const r = await apiPost('/api/payroll/maychamcong/' + id + '/test', {});
      toast(`Kết nối OK. Trên máy đang có ${r.data.tongNhanVienTrenMay} nhân viên.`, 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function keoDuLieu(id) {
    // v5.37: kéo theo khoảng thời gian tự chọn + theo mã chấm công (rỗng = tất cả).
    const tuNgay = (container.querySelector('#pullTu') || {}).value || null;
    const denNgay = (container.querySelector('#pullDen') || {}).value || null;
    const maChamCong = (((container.querySelector('#pullMa') || {}).value) || '').trim() || null;
    toast('Đang kết nối máy chấm công...', 'info');
    try {
      const r = await apiPost('/api/payroll/maychamcong/' + id + '/keodulieu', { tuNgay, denNgay, maChamCong });
      const d = r.data;
      toast(`Kéo ${d.filtered != null ? d.filtered : d.total}/${d.total} bản ghi — thêm mới ${d.inserted}, map ${d.matched}, chưa map ${d.unmatched}. ${d.unmatched ? 'Có ' + d.unmatched + ' bản ghi CHƯA gán nhân viên — dùng "Tải NV từ máy" để gán.' : ''} Bấm "Tổng hợp từ máy".`, d.unmatched ? 'info' : 'success');
      renderChamCong();
    } catch (e) { toast(e.message, 'error'); }
  }
  async function tongHopChamCong() {
    try {
      const r = await apiPost('/api/payroll/chamcong/tonghop', { nam: selNam, thang: selThang });
      const d = r.data || {};
      // v5.60: báo luôn số ngày CHỈ CÓ 1 LẦN QUẸT (thiếu giờ ra → không tính được công, phải sửa tay).
      toast(`Đã tổng hợp ${d.affected} dòng / ${d.ngay} ngày-người theo cài đặt chấm công.`
        + (d.thieuQuet ? ` ⚠ Có ${d.thieuQuet} ngày chỉ quẹt 1 lần (thiếu giờ ra) — mã "x?", cần sửa tay.` : ''),
        d.thieuQuet ? 'info' : 'success');
      renderChamCong();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function openChamCongChiTiet(nhanVienId, ten) {
    let rows = [];
    try { rows = (await apiGet(`/api/payroll/chamcong/${nhanVienId}?nam=${selNam}&thang=${selThang}`)).data || []; } catch (e) { toast(e.message, 'error'); return; }
    const html = `<h3>Chấm công chi tiết — ${escapeHtml(ten)} (T${selThang}/${selNam})</h3>
      <table style="font-size:13px;"><thead><tr><th>Ngày</th><th>Mã</th><th>Giờ vào</th><th>Giờ ra</th><th>Giờ làm</th><th>Số công</th><th>Giờ TC thường</th><th>Giờ TC CN</th><th>Giờ TC lễ</th><th>Nguồn</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.MaCham || '')}</td>
        <td style="text-align:center;">${escapeHtml(fmtGio(r.GioVao))}</td>
        <td style="text-align:center;">${escapeHtml(fmtGio(r.GioRa))}</td>
        <td style="text-align:right;">${r.SoGioLam != null ? num(r.SoGioLam) : ''}</td>
        <td style="text-align:right;font-weight:600;">${num(r.SoCong)}</td><td style="text-align:right;">${num(r.GioTangCaThuong)}</td><td style="text-align:right;">${num(r.GioTangCaChuNhat)}</td><td style="text-align:right;">${num(r.GioTangCaLeTet)}</td><td>${escapeHtml(r.Nguon || '')}</td></tr>`).join('') || `<tr><td colspan="10" class="empty-hint">Chưa có ngày chấm công.</td></tr>`}</tbody></table>
      <h4 style="margin:14px 0 6px;">Thêm / sửa 1 ngày</h4>
      <form id="ccForm"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px 16px;">
        <div class="form-row" style="margin:0;"><label>Ngày *</label><input type="date" id="d_ngay" required></div>
        <div class="form-row" style="margin:0;"><label>Mã (x / P / TS / KL / LT)</label><input id="d_ma" value="x"></div>
        <div class="form-row" style="margin:0;"><label>Số công</label><input type="number" step="0.5" id="d_cong" value="1"></div>
        <div class="form-row" style="margin:0;"><label>Giờ TC thường</label><input type="number" step="0.5" id="d_tcT" value="0"></div>
        <div class="form-row" style="margin:0;"><label>Giờ TC chủ nhật</label><input type="number" step="0.5" id="d_tcCN" value="0"></div>
        <div class="form-row" style="margin:0;"><label>Giờ TC lễ</label><input type="number" step="0.5" id="d_tcLe" value="0"></div>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnClose">Đóng</button><button type="submit" class="btn">Lưu ngày</button></div></form>`;
    const modal = openModal(html);
    modal.querySelector('#btnClose').addEventListener('click', closeModal);
    modal.querySelector('#ccForm').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await apiPost('/api/payroll/chamcong/ngay', {
          nhanVienId: nhanVienId, ngay: modal.querySelector('#d_ngay').value, maCham: modal.querySelector('#d_ma').value.trim(),
          soCong: modal.querySelector('#d_cong').value, gioTangCaThuong: modal.querySelector('#d_tcT').value, gioTangCaChuNhat: modal.querySelector('#d_tcCN').value, gioTangCaLeTet: modal.querySelector('#d_tcLe').value
        });
        toast('Đã lưu ngày công.', 'success'); openChamCongChiTiet(nhanVienId, ten);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================
     3. LUONG CONG NHAT
     ================================================================ */
  async function renderLuong() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/bangluong?nam=${selNam}&thang=${selThang}`)).data; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    const daChot = d.header && d.header.TrangThai === 'Đã chốt';
    const tong = (d.rows || []).reduce((s, r) => s + num(r.ThucLinh), 0);
    const actions = `
      ${perm.canEdit && !daChot ? `<button class="btn small" id="btnTinh">🧮 Tính lương</button>` : ''}
      ${d.header && perm.canEdit && !daChot ? `<button class="btn small secondary" id="btnChot">🔒 Chốt bảng lương</button>` : ''}
      ${d.header ? `<button class="btn small secondary" id="btnExcel">📊 Xuất Excel</button>
                    <button class="btn small secondary" id="btnCK">🏦 Xuất file CK</button>` : ''}
      ${(d.rows || []).length ? '<button class="btn small secondary" id="btnInCN">🖨️ In bảng lương</button>' : ''}
      ${d.header ? `<span style="margin-left:8px;color:${daChot ? '#137333' : '#b06000'};font-weight:600;">${daChot ? '● Đã chốt' : '● Nháp'}</span>` : ''}`;
    container.innerHTML = periodBar(null, actions) + `
      <div style="overflow:auto;"><table style="font-size:13px;min-width:1100px;"><thead><tr><th style="width:38px;">STT</th>
        <th>Mã NV</th><th>Họ tên</th><th>Công</th><th>Lương CB</th><th>Lương ngày công</th><th>TN chịu thuế</th><th>Tổng BH</th><th>Giảm trừ</th><th>Thuế TNCN</th><th>Tạm ứng</th><th>Thực lĩnh</th>
      </tr></thead><tbody>${(d.rows || []).map((r, __i) => `<tr class="cn-nv" data-id="${r.ID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td>
        <td style="text-align:right;">${num(r.Cong)}</td><td style="text-align:right;">${money(r.LuongCoBan)}</td>
        <td style="text-align:right;">${money(r.LuongNgayCong)}</td><td style="text-align:right;">${money(r.TnChiuThue)}</td>
        <td style="text-align:right;">${money(r.TongBH)}</td><td style="text-align:right;">${money(num(r.GiamTruBanThan) + num(r.GiamTruNPT))}</td>
        <td style="text-align:right;">${money(r.ThueTNCN)}</td>
        <td style="text-align:right;">${perm.canEdit && !daChot ? `<input type="number" class="tu-inp" data-id="${r.ID}" value="${num(r.TamUng)}" style="width:100px;text-align:right;">` : money(r.TamUng)}</td>
        <td style="text-align:right;font-weight:600;">${money(r.ThucLinh)}</td>
      </tr>`).join('') || `<tr><td colspan="11" class="empty-hint">Chưa có bảng lương. Bấm "Tính lương" để tạo.</td></tr>`}</tbody>
      ${(d.rows || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="10" style="text-align:right;">TỔNG THỰC LĨNH</td><td style="text-align:right;">${money(tong)}</td></tr></tfoot>` : ''}
      </table></div>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Lương công nhật lấy Lương CB + phụ cấp từ hợp đồng đang hiệu lực của nhân viên, và tổng công từ Chấm công tháng. Thưởng doanh thu chưa gộp (nhập ở phiên bản sau).</p>`;
    wirePeriod(container, renderLuong);
    const bTinh = container.querySelector('#btnTinh'); if (bTinh) bTinh.addEventListener('click', tinhLuong);
    const bChot = container.querySelector('#btnChot'); if (bChot) bChot.addEventListener('click', () => chotLuong(d.header.BangLuongID));
    const bEx = container.querySelector('#btnExcel'); if (bEx) bEx.addEventListener('click', () => downloadFile(`/api/payroll/bangluong/excel?nam=${selNam}&thang=${selThang}`, `BangLuong_T${selThang}_${selNam}.xlsx`));
    const bCK = container.querySelector('#btnCK'); if (bCK) bCK.addEventListener('click', () => downloadFile(`/api/payroll/bangluong/ck?nam=${selNam}&thang=${selThang}`, `CK_Luong_T${selThang}_${selNam}.xlsx`));
    container.querySelectorAll('.tu-inp').forEach(inp => inp.addEventListener('change', async () => {
      try { await apiPut('/api/payroll/bangluong/chitiet/' + inp.dataset.id, { tamUng: inp.value }); toast('Đã cập nhật tạm ứng.', 'success'); renderLuong(); }
      catch (e) { toast(e.message, 'error'); }
    }));
    // v5.91 (rà soát): in cả bảng + bấm 1 dòng để xem/in PHIẾU LƯƠNG riêng của nhân viên đó.
    const bInCN = container.querySelector('#btnInCN');
    if (bInCN) bInCN.addEventListener('click', () => printHtml(`Bang luong cong nhat T${selThang}/${selNam}`, buildLuongCongNhatBangBody(d, tong)));
    container.querySelectorAll('.cn-nv').forEach(tr => tr.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('tu-inp')) return;   // đang sửa tạm ứng thì không mở popup
      openLuongCongNhatNVDetail(tr.dataset.id, d);
    }));
  }

  /* v5.91 (rà soát) — LƯƠNG CÔNG NHẬT: trước đây tab này KHÔNG in được và không xem chi tiết được từng
     người (chỉ có Excel + file chuyển khoản). Nay bấm 1 dòng ra phiếu lương cá nhân có nút In. */
  function buildLuongCongNhatBangBody(d, tong) {
    return `<h2 style="text-align:center;">BẢNG LƯƠNG CÔNG NHẬT — Tháng ${selThang}/${selNam}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;" border="1" cellpadding="4"><thead><tr><th style="width:38px;">STT</th>
        <th>Mã NV</th><th>Họ tên</th><th>Công</th><th>Lương CB</th><th>Lương ngày công</th><th>TN chịu thuế</th><th>Tổng BH</th><th>Giảm trừ</th><th>Thuế TNCN</th><th>Tạm ứng</th><th>Thực lĩnh</th>
      </tr></thead><tbody>${(d.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td>
        <td style="text-align:right;">${num(r.Cong)}</td><td style="text-align:right;">${money(r.LuongCoBan)}</td>
        <td style="text-align:right;">${money(r.LuongNgayCong)}</td><td style="text-align:right;">${money(r.TnChiuThue)}</td>
        <td style="text-align:right;">${money(r.TongBH)}</td><td style="text-align:right;">${money(num(r.GiamTruBanThan) + num(r.GiamTruNPT))}</td>
        <td style="text-align:right;">${money(r.ThueTNCN)}</td><td style="text-align:right;">${money(r.TamUng)}</td>
        <td style="text-align:right;font-weight:600;">${money(r.ThucLinh)}</td></tr>`).join('') || '<tr><td colspan="11" style="text-align:center;">—</td></tr>'}
        <tr style="font-weight:bold;"><td></td><td colspan="10" style="text-align:right;">TỔNG THỰC LĨNH</td><td style="text-align:right;">${money(tong)}</td></tr>
      </tbody></table>`;
  }
  function buildLuongCongNhatNVBody(r) {
    const dong = (nhan, gt) => `<tr><td style="width:52%;background:#f5f6f8;"><b>${nhan}</b></td><td style="text-align:right;">${gt}</td></tr>`;
    return `<h2 style="text-align:center;">PHIẾU LƯƠNG CÔNG NHẬT — Tháng ${selThang}/${selNam}</h2>
      <p><b>Nhân viên:</b> ${escapeHtml(r.HoTen || '')} (${escapeHtml(r.MaNhanVien || '')})</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6">
        ${dong('Số công trong tháng', num(r.Cong))}
        ${dong('Lương cơ bản', money(r.LuongCoBan))}
        ${dong('Lương theo ngày công', money(r.LuongNgayCong))}
        ${dong('Thu nhập chịu thuế', money(r.TnChiuThue))}
        ${dong('Tổng bảo hiểm (trừ vào lương)', money(r.TongBH))}
        ${dong('Giảm trừ bản thân + người phụ thuộc', money(num(r.GiamTruBanThan) + num(r.GiamTruNPT)))}
        ${dong('Thuế TNCN', money(r.ThueTNCN))}
        ${dong('Tạm ứng', money(r.TamUng))}
        <tr><td style="background:#f5f6f8;"><b>THỰC LĨNH</b></td><td style="text-align:right;font-weight:700;">${money(r.ThucLinh)}</td></tr>
      </table>`;
  }
  function openLuongCongNhatNVDetail(id, d) {
    const r = (d.rows || []).find(x => String(x.ID) === String(id));
    if (!r) return;
    const modal = openModal(`<h3>Phiếu lương công nhật — ${escapeHtml(r.HoTen || '')}</h3>
      <div style="max-height:60vh;overflow:auto;">${buildLuongCongNhatNVBody(r)}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnInNVCN">🖨️ In phiếu lương</button>
        <button type="button" class="btn" id="btnCloseNVCN">Đóng</button>
      </div>`);
    modal.querySelector('#btnCloseNVCN').addEventListener('click', closeModal);
    modal.querySelector('#btnInNVCN').addEventListener('click', () => printHtml(`Luong cong nhat - ${r.HoTen || ''} - T${selThang}/${selNam}`, buildLuongCongNhatNVBody(r)));
  }
  async function tinhLuong() {
    if (!confirm(`Tính lương công nhật tháng ${selThang}/${selNam}? (Sẽ tính lại toàn bộ theo cấu hình + chấm công hiện tại.)`)) return;
    try { const r = await apiPost('/api/payroll/bangluong/tinh', { nam: selNam, thang: selThang }); toast(`Đã tính lương cho ${r.data.soNhanVien} nhân viên.`, 'success'); renderLuong(); }
    catch (e) { toast(e.message, 'error'); }
  }
  async function chotLuong(id) {
    if (!confirm('Chốt bảng lương? Sau khi chốt sẽ không tính lại/sửa tạm ứng được.')) return;
    try { await apiPut('/api/payroll/bangluong/' + id + '/chot', {}); toast('Đã chốt bảng lương.', 'success'); renderLuong(); }
    catch (e) { toast(e.message, 'error'); }
  }

  /* ================================================================
     4. LUONG KHOAN MAY (Phase 3) - tong hop tu Ghi nhan tien do cong doan May
     ================================================================ */
  async function renderLuongMay() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/luongmay?nam=${selNam}&thang=${selThang}`)).data; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    const tongAll = (d.tongHop || []).reduce((s, r) => s + num(r.ThanhTien), 0);
    container.innerHTML = periodBar(null, `${(d.rows || []).length ? `<button class="btn small secondary" id="btnInTongMay">🖨️ In tổng hợp</button> <button class="btn small secondary" id="btnExMay">📊 Xuất Excel</button>` : ''}`) + `
      <h4 style="margin:4px 0;">Tổng hợp theo nhân viên <span style="font-weight:400;font-size:12px;color:#5f6368;">(bấm 1 nhân viên để xem / in chi tiết lương)</span></h4>
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Tổng SL hoàn thành</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.tongHop || []).map((r, __i) => `<tr class="lm-nv" data-nvid="${r.NhanVienID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;font-weight:600;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty-hint">Chưa có dữ liệu khoán may tháng này.</td></tr>`}</tbody>
      ${(d.tongHop || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tongAll)}</td></tr></tfoot>` : ''}</table>
      <h4 style="margin:16px 0 4px;">Chi tiết theo đơn hàng / công đoạn</h4>
      <div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Mã ĐH</th><th>Công đoạn</th><th>Ngày</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenCongDoan || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty-hint">—</td></tr>`}</tbody></table></div>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Lấy số lượng từng nhân viên hoàn thành ở Ghi nhận tiến độ công đoạn May × đơn giá khoán công đoạn may của đơn hàng (ưu tiên đơn giá theo đơn, fallback đơn giá hệ thống). Lọc theo tháng ghi nhận tiến độ.</p>`;
    wirePeriod(container, renderLuongMay);
    const b = container.querySelector('#btnExMay'); if (b) b.addEventListener('click', () => downloadFile(`/api/payroll/luongmay/excel?nam=${selNam}&thang=${selThang}`, `LuongKhoanMay_T${selThang}_${selNam}.xlsx`));
    const bIn = container.querySelector('#btnInTongMay'); if (bIn) bIn.addEventListener('click', () => printHtml(`Tổng hợp lương khoán may T${selThang}/${selNam}`, buildLuongMayTongHopBody(d, tongAll)));
    container.querySelectorAll('.lm-nv').forEach(tr => tr.addEventListener('click', () => openLuongMayNVDetail(tr.dataset.nvid, d)));
  }

  // v5.36: in tổng hợp + xem/in chi tiết lương khoán may từng nhân viên (dữ liệu client-side d.rows/d.tongHop).
  function buildLuongMayTongHopBody(d, tongAll) {
    return `<h2 style="text-align:center;">TỔNG HỢP LƯƠNG KHOÁN MAY — Tháng ${selThang}/${selNam}</h2>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Tổng SL</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.tongHop || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('')}
      <tr style="font-weight:bold;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tongAll)}</td></tr></tbody></table>`;
  }
  function buildLuongMayNVBody(nv, rows) {
    const tong = rows.reduce((s, r) => s + num(r.ThanhTien), 0);
    return `<h2 style="text-align:center;">PHIẾU LƯƠNG KHOÁN MAY — Tháng ${selThang}/${selNam}</h2>
      <p><b>Nhân viên:</b> ${escapeHtml(nv.HoTen || '')} (${escapeHtml(nv.MaNhanVien || '')})</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Mã ĐH</th><th>Ngày</th><th>Tên sản phẩm</th><th>Công đoạn</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenCongDoan || '')}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;">—</td></tr>'}
      <tr style="font-weight:bold;"><td></td><td colspan="6" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tbody></table>`;
  }
  function openLuongMayNVDetail(nvid, d) {
    const rows = (d.rows || []).filter(r => String(r.NhanVienID) === String(nvid));
    const nv = (d.tongHop || []).find(r => String(r.NhanVienID) === String(nvid)) || rows[0] || {};
    const modal = openModal(`<h3>Chi tiết lương khoán may — ${escapeHtml(nv.HoTen || '')}</h3>
      <div style="max-height:60vh;overflow:auto;">${buildLuongMayNVBody(nv, rows)}</div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnInNV">🖨️ In chi tiết</button><button type="button" class="btn" id="btnCloseNV">Đóng</button></div>`);
    modal.querySelector('#btnCloseNV').addEventListener('click', closeModal);
    modal.querySelector('#btnInNV').addEventListener('click', () => printHtml(`Lương khoán may - ${nv.HoTen || ''} - T${selThang}/${selNam}`, buildLuongMayNVBody(nv, rows)));
  }

  // v5.36/v5.37 (Payroll P4): Lương/chi phí gia công ngoài + in thêu (tổng hợp theo nhà, từ QLSX SL nhận).
  // v5.37: hàng nhà bấm được → xem/in chi tiết từng nhà; "In tổng hợp" chỉ in phần tổng-hợp-theo-nhà.
  function gcItSectionTongHop(tongHop, tong, kind) {
    return `<table><thead><tr><th style="width:38px;">STT</th><th>Nhà</th><th>Tổng SL nhận</th><th>Thành tiền</th></tr></thead>
      <tbody>${(tongHop || []).map((r, __i) => `<tr class="gcit-nha" data-nhaid="${r.NhaGiaCongID}" data-kind="${kind}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenNha)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;font-weight:600;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="3" class="empty-hint">—</td></tr>`}</tbody>
      ${(tongHop || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="2" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tfoot>` : ''}</table>`;
  }
  // In TỔNG HỢP: chỉ 2 bảng tổng-hợp-theo-nhà (KHÔNG in từng đơn hàng).
  function buildGcItTongHopBody(d, gcTong, itTong) {
    const sec = (title, tongHop, tong) => `<h3>${title}</h3>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Nhà</th><th>Tổng SL nhận</th><th>Thành tiền</th></tr></thead>
      <tbody>${(tongHop || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenNha)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;">—</td></tr>'}
      <tr style="font-weight:bold;"><td style="text-align:right;">TỔNG</td><td></td><td style="text-align:right;">${money(tong)}</td></tr></tbody></table>`;
    return `<h2 style="text-align:center;">TỔNG HỢP LƯƠNG GIA CÔNG / IN THÊU — Tháng ${selThang}/${selNam}</h2>
      ${sec('Gia công ngoài (theo nhà)', d.giaCong.tongHop, gcTong)}
      ${sec('In thêu (theo nhà)', d.inThe.tongHop, itTong)}`;
  }
  /* v6.01: IN THÊU có thêm cột HẠNG MỤC IN THÊU (chọn ở công đoạn Giao in thêu, lấy từ Đơn giá in thêu).
     Dòng đã chọn hạng mục thì đơn giá là đơn giá CỦA hạng mục đó; để trống thì vẫn là TỔNG đơn giá in
     thêu của đơn (dữ liệu cũ). ThieuDonGia=1 = hạng mục không còn trong Đơn giá in thêu -> đơn giá 0,
     phải hiện cảnh báo chứ không được lặng lẽ tính 0. */
  function oHangMucInThe(r) {
    const ten = r.HangMucInThe || '';
    if (!ten) return '<span style="color:#5f6368;">(tổng tất cả hạng mục)</span>';
    return escapeHtml(ten) + (num(r.ThieuDonGia) ? ' <span style="color:#c0392b;" title="Hạng mục này không còn trong Đơn giá in thêu của đơn — đơn giá đang tính 0">⚠️ thiếu đơn giá</span>' : '');
  }
  // In CHI TIẾT 1 nhà (các đơn hàng của nhà đó).
  function buildGcItNhaBody(tenNha, kind, rows) {
    const tong = rows.reduce((s, r) => s + num(r.ThanhTien), 0);
    const head = kind === 'gc' ? '<th>Mã ĐH</th><th>Tên sản phẩm</th><th>Hạng mục</th><th>SL nhận</th><th>Đơn giá</th><th>Thành tiền</th>' : '<th>Mã ĐH</th><th>Tên sản phẩm</th><th>Hạng mục in thêu</th><th>SL nhận</th><th>Đơn giá</th><th>Thành tiền</th>';
    const span = 5;
    const body = rows.map((r, __i) => kind === 'gc'
      ? `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenHangMuc || '')}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`
      : `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${oHangMucInThe(r)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="${span + 1}" style="text-align:center;">—</td></tr>`;
    return `<h2 style="text-align:center;">CHI TIẾT ${kind === 'gc' ? 'GIA CÔNG' : 'IN THÊU'} — ${escapeHtml(tenNha)}</h2>
      <p style="text-align:center;">Tháng ${selThang}/${selNam}</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th>${head}</tr></thead>
      <tbody>${body}<tr style="font-weight:bold;"><td></td><td colspan="${span}" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tbody></table>`;
  }
  function openGcItNhaDetail(nhaId, kind, d) {
    const src = kind === 'gc' ? (d.giaCong.rows || []) : (d.inThe.rows || []);
    const rows = src.filter(r => String(r.NhaGiaCongID) === String(nhaId));
    const tenNha = (rows[0] && rows[0].TenNha) || '';
    const modal = openModal(`<h3>Chi tiết ${kind === 'gc' ? 'gia công' : 'in thêu'} — ${escapeHtml(tenNha)}</h3>
      <div style="max-height:60vh;overflow:auto;">${buildGcItNhaBody(tenNha, kind, rows)}</div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnInNha">🖨️ In chi tiết nhà</button><button type="button" class="btn" id="btnCloseNha">Đóng</button></div>`);
    modal.querySelector('#btnCloseNha').addEventListener('click', closeModal);
    modal.querySelector('#btnInNha').addEventListener('click', () => printHtml(`Chi tiết ${kind === 'gc' ? 'gia công' : 'in thêu'} - ${tenNha} - T${selThang}/${selNam}`, buildGcItNhaBody(tenNha, kind, rows)));
  }
  async function renderLuongGcInThe() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/giacong-inthe?nam=${selNam}&thang=${selThang}`)).data; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    const gcTong = (d.giaCong.tongHop || []).reduce((s, r) => s + num(r.ThanhTien), 0);
    const itTong = (d.inThe.tongHop || []).reduce((s, r) => s + num(r.ThanhTien), 0);
    container.innerHTML = periodBar(null, `<button class="btn small secondary" id="btnInGcIt">🖨️ In</button>`) + `
      <h4 style="margin:4px 0;">Gia công ngoài — theo nhà (SL nhận × đơn giá hạng mục)</h4>
      ${gcItSectionTongHop(d.giaCong.tongHop, gcTong, 'gc')}
      <div style="overflow:auto;margin-top:6px;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Nhà gia công</th><th>Mã ĐH</th><th>Hạng mục</th><th>SL nhận</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.giaCong.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenNha)}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenHangMuc || '')}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty-hint">Không có dữ liệu gia công tháng này.</td></tr>`}</tbody></table></div>
      <h4 style="margin:16px 0 4px;">In thêu — theo nhà (SL nhận × đơn giá hạng mục in thêu)</h4>
      ${gcItSectionTongHop(d.inThe.tongHop, itTong, 'inthe')}
      <div style="overflow:auto;margin-top:6px;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Nhà in thêu</th><th>Mã ĐH</th><th>Hạng mục in thêu</th><th>SL nhận</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.inThe.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenNha)}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${oHangMucInThe(r)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty-hint">Không có dữ liệu in thêu tháng này.</td></tr>`}</tbody></table></div>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Lọc theo tháng tạo dòng giao (CreatedAt). Gia công = SL nhận × đơn giá hạng mục. In thêu: dòng giao ĐÃ chọn hạng mục thì = SL nhận × đơn giá CỦA hạng mục đó; dòng để trống (dữ liệu cũ) thì = SL nhận × TỔNG đơn giá in thêu của đơn (khai ở Tài liệu kỹ thuật → Đơn giá in thêu). Chọn hạng mục ở công đoạn Giao in thêu (GIT); SL nhận nhập ở Nhận gia công (NGC) / Nhận in thêu (NIT).</p>`;
    wirePeriod(container, renderLuongGcInThe);
    const bIn = container.querySelector('#btnInGcIt'); if (bIn) bIn.addEventListener('click', () => printHtml(`Tổng hợp lương gia công / in thêu T${selThang}/${selNam}`, buildGcItTongHopBody(d, gcTong, itTong)));
    container.querySelectorAll('.gcit-nha').forEach(tr => tr.addEventListener('click', () => openGcItNhaDetail(tr.dataset.nhaid, tr.dataset.kind, d)));
  }

  // v5.38: Lương là (LA) + đóng gói (DG) = SL giao × đơn giá là/đóng gói. Tổng hợp theo NV + chi tiết + In.
  function buildLaDgBody(d, tongAll) {
    return `<h2 style="text-align:center;">LƯƠNG LÀ / ĐÓNG GÓI — Tháng ${selThang}/${selNam}</h2>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Công đoạn</th><th>Mã ĐH</th><th>Tên SP</th><th>Màu</th><th>Ngày</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td>${r.Loai === 'LA' ? 'Là' : 'Đóng gói'}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="10" style="text-align:center;">—</td></tr>'}
      <tr style="font-weight:bold;"><td></td><td colspan="9" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tongAll)}</td></tr></tbody></table>`;
  }
  async function renderLuongLaDongGoi() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/luongladonggoi?nam=${selNam}&thang=${selThang}`)).data; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    const tongAll = (d.tongHop || []).reduce((s, r) => s + num(r.ThanhTien), 0);
    container.innerHTML = periodBar(null, `${(d.rows || []).length ? `<button class="btn small secondary" id="btnInLaDg">🖨️ In</button>` : ''}`) + `
      <h4 style="margin:4px 0;">Tổng hợp theo nhân viên (là + đóng gói) <span style="font-weight:400;font-size:12px;color:#5f6368;">(bấm 1 nhân viên để xem / in phiếu lương)</span></h4>
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Tổng SL</th><th>Thành tiền</th></tr></thead>
      ${/* v5.91: dòng nhân viên BẤM ĐƯỢC để xem/in phiếu lương riêng (trước chỉ in được cả bảng) */''}
      <tbody>${(d.tongHop || []).map((r, __i) => `<tr class="ldg-nv" data-nvid="${r.NhanVienID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;font-weight:600;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty-hint">Chưa có dữ liệu là/đóng gói tháng này.</td></tr>`}</tbody>
      ${(d.tongHop || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tongAll)}</td></tr></tfoot>` : ''}</table>
      <h4 style="margin:16px 0 4px;">Chi tiết theo công đoạn / đơn / màu</h4>
      <div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Công đoạn</th><th>Mã ĐH</th><th>Tên SP</th><th>Màu</th><th>Ngày</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td>${r.Loai === 'LA' ? 'Là' : 'Đóng gói'}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="10" class="empty-hint">—</td></tr>`}</tbody></table></div>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Lương là/đóng gói = SL giao ở công đoạn Là (LA) / Đóng gói (DG) × đơn giá là/đóng gói của đơn (khai ở "Tài liệu may/Đóng gói"). Lọc theo tháng ghi nhận tiến độ.</p>`;
    wirePeriod(container, renderLuongLaDongGoi);
    const bIn = container.querySelector('#btnInLaDg'); if (bIn) bIn.addEventListener('click', () => printHtml(`Lương là/đóng gói T${selThang}/${selNam}`, buildLaDgBody(d, tongAll)));
    container.querySelectorAll('.ldg-nv').forEach(tr => tr.addEventListener('click', () => openLaDgNVDetail(tr.dataset.nvid, d)));   // v5.91
  }

  /* v5.91 (rà soát): phiếu lương TỪNG NHÂN VIÊN cho lương là/đóng gói — trước đây tab này chỉ in được
     cả bảng, không xem/in riêng được của 1 người. Dữ liệu lọc client-side từ d.rows như tab khoán may. */
  function buildLaDgNVBody(nv, rows) {
    const tong = rows.reduce((s, r) => s + num(r.ThanhTien), 0);
    return `<h2 style="text-align:center;">PHIẾU LƯƠNG LÀ / ĐÓNG GÓI — Tháng ${selThang}/${selNam}</h2>
      <p><b>Nhân viên:</b> ${escapeHtml(nv.HoTen || '')} (${escapeHtml(nv.MaNhanVien || '')})</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th>
        <th>Công đoạn</th><th>Mã ĐH</th><th>Tên SP</th><th>Màu</th><th>Ngày</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th>
      </tr></thead><tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${r.Loai === 'LA' ? 'Là' : 'Đóng gói'}</td><td>${escapeHtml(r.MaDH || '')}</td>
        <td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td>
        <td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td>
        <td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;">—</td></tr>'}
        <tr style="font-weight:bold;"><td></td><td colspan="7" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tbody></table>`;
  }
  function openLaDgNVDetail(nvid, d) {
    const rows = (d.rows || []).filter(r => String(r.NhanVienID) === String(nvid));
    const nv = (d.tongHop || []).find(r => String(r.NhanVienID) === String(nvid)) || rows[0] || {};
    const modal = openModal(`<h3>Chi tiết lương là / đóng gói — ${escapeHtml(nv.HoTen || '')}</h3>
      <div style="max-height:60vh;overflow:auto;">${buildLaDgNVBody(nv, rows)}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnInNVLaDg">🖨️ In phiếu lương</button>
        <button type="button" class="btn" id="btnCloseNVLaDg">Đóng</button>
      </div>`);
    modal.querySelector('#btnCloseNVLaDg').addEventListener('click', closeModal);
    modal.querySelector('#btnInNVLaDg').addEventListener('click', () => printHtml(`Luong la-dong goi - ${nv.HoTen || ''} - T${selThang}/${selNam}`, buildLaDgNVBody(nv, rows)));
  }

  /* ================================================================================================
     v5.91 — LƯƠNG TRẢI VẢI CẮT
     Quỹ lương cắt tháng = tổng tiền các SƠ ĐỒ đã cắt trong tháng
        tiền 1 sơ đồ = mét sơ đồ × tổng số lớp × khổ vải × đơn giá (cấu hình, mặc định 1100đ)
     Đơn giá 1 giờ = quỹ / tổng giờ công của toàn bộ nhân viên bộ phận Cắt (chấm công tháng)
     Lương 1 người = giờ công × hệ số lương × đơn giá 1 giờ
     LƯU Ý: theo phương án đã chọn, đơn giá giờ chia cho TỔNG GIỜ (chưa nhân hệ số) nên khi có hệ số
     khác 1, TỔNG lương trả ra sẽ lệch so với quỹ — bảng luôn in rõ dòng "Chênh lệch so với quỹ".
     ================================================================================================ */
  function lcTomTat(d) {
    const lech = num(d.chenhLech);
    const mauLech = Math.abs(lech) < 1 ? '#137333' : (lech > 0 ? '#c5221f' : '#b06000');
    return `<div class="card" style="margin-bottom:10px;">
      <table style="width:100%;font-size:13px;">
        <tr><td style="width:34%;"><b>Quỹ lương cắt tháng</b></td><td style="font-weight:700;">${money(d.quy)}</td>
            <td style="width:26%;"><b>Đơn giá</b></td><td>${money(d.donGia)} / (mét × lớp × khổ)</td></tr>
        <tr><td><b>Tổng giờ công bộ phận Cắt</b></td><td>${num(d.tongGio)} giờ</td>
            <td><b>Lương 1 giờ</b></td><td>${money(d.donGiaGio)}</td></tr>
        <tr><td><b>Tổng lương chia ra</b></td><td style="font-weight:700;">${money(d.tongLuong)}</td>
            <td><b>Chênh lệch so với quỹ</b></td><td style="color:${mauLech};font-weight:600;">${money(lech)}${Math.abs(lech) < 1 ? '' : (lech > 0 ? ' (trả VƯỢT quỹ do hệ số > 1)' : ' (trả THIẾU so với quỹ)')}</td></tr>
      </table></div>`;
  }
  // Bản in: chi tiết từng lệnh SX có bao nhiêu sơ đồ + thành tiền từng sơ đồ + tổng bàn cắt.
  function buildLuongCatQuyBody(d) {
    const donRows = (d.theoDon || []).map(o => {
      const soDoCuaDon = (d.soDo || []).filter(s => String(s.DonHangID) === String(o.DonHangID));
      const chiTiet = soDoCuaDon.map((s, i) => `<tr><td style="text-align:center;">${i + 1}</td>
          <td style="text-align:center;">${i + 1}/${soDoCuaDon.length}</td>
          <td>${fmtDate(s.NgayGhiNhan)}</td>
          <td style="text-align:center;">${escapeHtml(s.SttSoCat != null ? String(s.SttSoCat) : '')}</td>
          <td style="text-align:right;">${num(s.MetSoDoDai)}</td>
          <td style="text-align:right;">${num(s.KhoVaiSoDo)}</td>
          <td style="text-align:right;">${num(s.TongLop)}</td>
          <td style="text-align:right;">${money(s.ThanhTien)}</td></tr>`).join('');
      return `<tr style="background:#f1f3f4;font-weight:600;"><td></td><td colspan="6">Lệnh SX ${escapeHtml(o.MaDH || '')}${o.TenSanPham ? ' — ' + escapeHtml(o.TenSanPham) : ''} · ${o.SoSoDo} sơ đồ · tổng ${num(o.TongLop)} lớp</td><td style="text-align:right;">${money(o.ThanhTien)}</td></tr>${chiTiet}`;
    }).join('');
    return `<h2 style="text-align:center;">QUỸ LƯƠNG TRẢI VẢI CẮT — Tháng ${selThang}/${selNam}</h2>
      <p style="text-align:center;font-size:13px;">Công thức 1 sơ đồ: mét sơ đồ × tổng số lớp × khổ vải × ${money(d.donGia)}</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="5"><thead><tr><th style="width:38px;">STT</th>
        <th>Sơ đồ</th><th>Ngày cắt</th><th>STT sổ cắt</th><th>Mét sơ đồ</th><th>Khổ vải</th><th>Tổng lớp</th><th>Thành tiền</th>
      </tr></thead><tbody>${donRows || '<tr><td colspan="7" style="text-align:center;">Chưa có sổ cắt nào trong tháng.</td></tr>'}
        <tr style="font-weight:bold;"><td></td><td colspan="5" style="text-align:right;">TỔNG BÀN CẮT: ${(d.soDo || []).length} sơ đồ / ${(d.theoDon || []).length} lệnh SX</td>
            <td style="text-align:right;">${num((d.soDo || []).reduce((s, x) => s + num(x.TongLop), 0))}</td>
            <td style="text-align:right;">${money(d.quy)}</td></tr>
      </tbody></table>`;
  }
  // Bản in phiếu lương 1 nhân viên: kèm luôn bảng quỹ (để công nhân đối chiếu cách chia).
  function buildLuongCatNVBody(nv, d) {
    return `<h2 style="text-align:center;">PHIẾU LƯƠNG TRẢI VẢI CẮT — Tháng ${selThang}/${selNam}</h2>
      <p><b>Nhân viên:</b> ${escapeHtml(nv.HoTen || '')} (${escapeHtml(nv.MaNhanVien || '')})</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6">
        <tr><td style="width:45%;background:#f5f6f8;"><b>Tổng giờ công trong tháng</b></td><td>${num(nv.TongGioLam)} giờ${nv.TongCong != null ? ` (${num(nv.TongCong)} công / ${num(nv.SoNgay)} ngày)` : ''}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>Hệ số lương</b></td><td>${num(nv.HeSoLuong)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>Quỹ lương cắt tháng</b></td><td>${money(d.quy)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>Tổng giờ toàn bộ phận Cắt</b></td><td>${num(d.tongGio)} giờ</td></tr>
        <tr><td style="background:#f5f6f8;"><b>Lương 1 giờ</b></td><td>${money(d.donGiaGio)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>LƯƠNG KHOÁN THÁNG</b></td><td style="font-weight:700;">${money(nv.ThanhTien)} <span style="font-weight:400;font-size:12px;">= ${num(nv.TongGioLam)} giờ × ${num(nv.HeSoLuong)} × ${money(d.donGiaGio)}</span></td></tr>
      </table>
      <h3 style="margin:14px 0 4px;">Cơ sở tính quỹ tháng</h3>
      ${buildLuongCatQuyBody(d)}`;
  }
  function openLuongCatNVDetail(nvid, d) {
    const nv = (d.nhanVien || []).find(r => String(r.NhanVienID) === String(nvid));
    if (!nv) return;
    const modal = openModal(`<h3>Chi tiết lương trải vải cắt — ${escapeHtml(nv.HoTen || '')}</h3>
      <div style="max-height:60vh;overflow:auto;">${buildLuongCatNVBody(nv, d)}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnInNVCat">🖨️ In phiếu lương</button>
        <button type="button" class="btn" id="btnCloseNVCat">Đóng</button>
      </div>`);
    modal.querySelector('#btnCloseNVCat').addEventListener('click', closeModal);
    modal.querySelector('#btnInNVCat').addEventListener('click', () => printHtml(`Luong trai vai cat - ${nv.HoTen || ''} - T${selThang}/${selNam}`, buildLuongCatNVBody(nv, d)));
  }
  function openLuongCatDonDetail(donHangId, d) {
    const o = (d.theoDon || []).find(x => String(x.DonHangID) === String(donHangId));
    if (!o) return;
    const list = (d.soDo || []).filter(s => String(s.DonHangID) === String(donHangId));
    const body = `<h2 style="text-align:center;">CHI TIẾT BÀN CẮT — ${escapeHtml(o.MaDH || '')}</h2>
      <p><b>Tên sản phẩm:</b> ${escapeHtml(o.TenSanPham || '')} &nbsp; <b>Số sơ đồ:</b> ${o.SoSoDo}</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="5"><thead><tr><th style="width:38px;">STT</th>
        <th>Sơ đồ</th><th>Ngày cắt</th><th>STT sổ cắt</th><th>Mã rập</th><th>Mét sơ đồ</th><th>Khổ vải</th><th>Tổng lớp</th><th>Người trải vải</th><th>Người cắt</th><th>Thành tiền</th>
      </tr></thead><tbody>${list.map((s, i) => `<tr><td style="text-align:center;">${i + 1}</td>
        <td style="text-align:center;">${i + 1}/${list.length}</td><td>${fmtDate(s.NgayGhiNhan)}</td>
        <td style="text-align:center;">${escapeHtml(s.SttSoCat != null ? String(s.SttSoCat) : '')}</td>
        <td>${escapeHtml(s.MaRap || '')}</td>
        <td style="text-align:right;">${num(s.MetSoDoDai)}</td><td style="text-align:right;">${num(s.KhoVaiSoDo)}</td>
        <td style="text-align:right;">${num(s.TongLop)}</td>
        <td>${escapeHtml(s.NhanVienTraiVai || '')}</td><td>${escapeHtml(s.NhanVienCat || '')}</td>
        <td style="text-align:right;">${money(s.ThanhTien)}</td></tr>`).join('')}
        <tr style="font-weight:bold;"><td></td><td colspan="9" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(o.ThanhTien)}</td></tr>
      </tbody></table>`;
    const modal = openModal(`<h3>Bàn cắt của lệnh ${escapeHtml(o.MaDH || '')}</h3>
      <div style="max-height:60vh;overflow:auto;">${body}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnInDonCat">🖨️ In</button>
        <button type="button" class="btn" id="btnCloseDonCat">Đóng</button>
      </div>`);
    modal.querySelector('#btnCloseDonCat').addEventListener('click', closeModal);
    modal.querySelector('#btnInDonCat').addEventListener('click', () => printHtml(`Ban cat - ${o.MaDH || ''} - T${selThang}/${selNam}`, body));
  }
  function openCauHinhLuongCat(d) {
    const modal = openModal(`<h3>Cấu hình lương trải vải cắt</h3>
      <div class="form-row"><label>Đơn giá (đồng) — dùng trong: mét sơ đồ × tổng lớp × khổ vải × đơn giá</label>
        <input type="number" step="1" min="1" id="lcDonGia" value="${num(d.donGia)}"></div>
      <p class="empty-hint">Hệ số lương từng nhân viên bộ phận Cắt (mặc định 1). Người làm nhiều/tay nghề cao có thể đặt 1.2, 1.5...</p>
      <div class="bang-cuon" style="max-height:46vh;">
        <table><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th style="width:120px;">Hệ số</th></tr></thead>
        <tbody>${(d.nhanVien || []).map((n, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(n.MaNhanVien || '')}</td><td>${escapeHtml(n.HoTen)}</td>
          <td><input type="number" step="0.01" min="0.01" class="lc-heso" data-nvid="${n.NhanVienID}" value="${num(n.HeSoLuong)}" style="width:100px;text-align:right;"></td></tr>`).join('')
          || '<tr><td colspan="3" class="empty-hint">Chưa có nhân viên nào thuộc bộ phận "Cắt" (khai ở Quản lý nhân sự).</td></tr>'}</tbody></table>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="lcHuy">Hủy</button>
        <button type="button" class="btn" id="lcLuu">💾 Lưu cấu hình</button>
      </div>`);
    modal.querySelector('#lcHuy').addEventListener('click', closeModal);
    modal.querySelector('#lcLuu').addEventListener('click', async () => {
      const heSo = Array.from(modal.querySelectorAll('.lc-heso')).map(i => ({ nhanVienId: i.dataset.nvid, heSoLuong: i.value }));
      try {
        await apiPost('/api/payroll/luongtraivaicat/cauhinh', { donGia: modal.querySelector('#lcDonGia').value, heSo });
        closeModal(); toast('Đã lưu cấu hình lương cắt.', 'success'); renderLuongTraiVaiCat();
      } catch (e) { toast(e.message, 'error'); }
    });
  }
  async function renderLuongTraiVaiCat() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/luongtraivaicat?nam=${selNam}&thang=${selThang}`)).data; }
    catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    const actions = `${perm.canEdit ? '<button class="btn small secondary" id="btnCfgCat">⚙️ Cấu hình đơn giá / hệ số</button>' : ''}
      <button class="btn small secondary" id="btnInQuyCat">🖨️ In quỹ + bàn cắt</button>
      <button class="btn small secondary" id="btnInBangCat">🖨️ In bảng lương</button>`;
    container.innerHTML = periodBar(null, actions) + lcTomTat(d) + `
      <h4 style="margin:4px 0;">Bảng lương nhân viên bộ phận Cắt <span style="font-weight:400;font-size:12px;color:#5f6368;">(bấm 1 nhân viên để xem / in phiếu lương)</span></h4>
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Giờ công</th><th>Hệ số</th><th>Lương 1 giờ</th><th>Lương khoán tháng</th></tr></thead>
      <tbody>${(d.nhanVien || []).map((r, __i) => `<tr class="lc-nv" data-nvid="${r.NhanVienID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td>
        <td style="text-align:right;">${num(r.TongGioLam)}</td><td style="text-align:right;">${num(r.HeSoLuong)}</td>
        <td style="text-align:right;">${money(d.donGiaGio)}</td>
        <td style="text-align:right;font-weight:600;">${money(r.ThanhTien)}</td></tr>`).join('')
        || '<tr><td colspan="6" class="empty-hint">Chưa có nhân viên bộ phận Cắt, hoặc chưa có chấm công tháng này.</td></tr>'}</tbody>
      ${(d.nhanVien || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="2" style="text-align:right;">TỔNG</td><td style="text-align:right;">${num(d.tongGio)}</td><td></td><td></td><td style="text-align:right;">${money(d.tongLuong)}</td></tr></tfoot>` : ''}</table>

      <h4 style="margin:16px 0 4px;">Bàn cắt theo lệnh sản xuất <span style="font-weight:400;font-size:12px;color:#5f6368;">(bấm 1 lệnh để xem / in chi tiết từng sơ đồ)</span></h4>
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã ĐH</th><th>Mã hàng</th><th>Tên sản phẩm</th><th>Số sơ đồ</th><th>Tổng lớp</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.theoDon || []).map((o, __i) => `<tr class="lc-don" data-donid="${o.DonHangID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(o.MaDH || '')}</td><td>${escapeHtml(o.MaSanPham || '')}</td><td>${escapeHtml(o.TenSanPham || '')}</td>
        <td style="text-align:center;">${o.SoSoDo}</td><td style="text-align:right;">${num(o.TongLop)}</td>
        <td style="text-align:right;font-weight:600;">${money(o.ThanhTien)}</td></tr>`).join('')
        || '<tr><td colspan="6" class="empty-hint">Chưa có sổ cắt nào trong tháng này.</td></tr>'}</tbody>
      ${(d.theoDon || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="3" style="text-align:right;">TỔNG BÀN CẮT</td><td style="text-align:center;">${(d.soDo || []).length}</td><td></td><td style="text-align:right;">${money(d.quy)}</td></tr></tfoot>` : ''}</table>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Số liệu lấy từ TẤT CẢ sổ cắt đã ghi trong tháng (công đoạn Cắt). Mét sơ đồ / khổ vải lấy từ sơ đồ của lệnh SX. Giờ công lấy từ Chấm công (cột Số giờ làm) của nhân viên bộ phận "Cắt".</p>`;
    wirePeriod(container, renderLuongTraiVaiCat);
    const bc = container.querySelector('#btnCfgCat'); if (bc) bc.addEventListener('click', () => openCauHinhLuongCat(d));
    container.querySelector('#btnInQuyCat').addEventListener('click', () => printHtml(`Quy luong cat T${selThang}/${selNam}`, buildLuongCatQuyBody(d)));
    container.querySelector('#btnInBangCat').addEventListener('click', () => printHtml(`Bang luong trai vai cat T${selThang}/${selNam}`, buildLuongCatBangBody(d)));
    container.querySelectorAll('.lc-nv').forEach(tr => tr.addEventListener('click', () => openLuongCatNVDetail(tr.dataset.nvid, d)));
    container.querySelectorAll('.lc-don').forEach(tr => tr.addEventListener('click', () => openLuongCatDonDetail(tr.dataset.donid, d)));
  }
  // Bảng lương tháng (tất cả nhân viên) + phần cơ sở tính quỹ ở dưới.
  function buildLuongCatBangBody(d) {
    return `<h2 style="text-align:center;">BẢNG LƯƠNG TRẢI VẢI CẮT — Tháng ${selThang}/${selNam}</h2>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th>
        <th>Mã NV</th><th>Họ tên</th><th>Giờ công</th><th>Hệ số</th><th>Lương 1 giờ</th><th>Lương khoán tháng</th>
      </tr></thead><tbody>${(d.nhanVien || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td>
        <td style="text-align:right;">${num(r.TongGioLam)}</td><td style="text-align:right;">${num(r.HeSoLuong)}</td>
        <td style="text-align:right;">${money(d.donGiaGio)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;">—</td></tr>'}
        <tr style="font-weight:bold;"><td></td><td colspan="2" style="text-align:right;">TỔNG</td><td style="text-align:right;">${num(d.tongGio)}</td><td></td><td></td><td style="text-align:right;">${money(d.tongLuong)}</td></tr>
      </tbody></table>
      <p style="font-size:13px;">Quỹ lương cắt tháng: <b>${money(d.quy)}</b> · Lương 1 giờ: <b>${money(d.donGiaGio)}</b> · Chênh lệch tổng lương so với quỹ: <b>${money(d.chenhLech)}</b></p>
      ${buildLuongCatQuyBody(d)}`;
  }

  return { render, getTabs };
})();
