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
    { key: 'nghiphep', label: 'Tạo giấy nghỉ phép / Nghỉ cá nhân' },   // v9.57: tách khỏi tab Chấm công (ChucNang 'nghiphep', migration_v892)
    { key: 'nghiphepnam', label: 'Ngày nghỉ theo năm' },   // v10.01 (ChucNang PAYROLL/nghiphepnam, migration_v909)
    { key: 'luongcongnhat', label: 'Lương công nhật' },
    { key: 'kpi', label: 'Đánh giá KPI' },   // v9.45: điểm KPI + sản phẩm theo tháng (ChucNang 'kpi', migration_v890)
    { key: 'luongmay', label: 'Lương khoán may' },
    { key: 'luonggcinthe', label: 'Lương GC / In thêu' },
    { key: 'luongladonggoi', label: 'Lương là / đóng gói' },
    { key: 'luongtraivaicat', label: 'Lương trải vải cắt' },   // v5.91
    { key: 'luongctv', label: 'Lương CTV thiết kế' }   // v9.70 (ChucNang PAYROLL/luongctv, migration_v896)
  ];
  function getTabs() { return TABS; }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.PAYROLL || {});
    perm = effectivePerm(user, 'PAYROLL', activeTab, rawPerm);
    if (activeTab === 'cauhinh') return renderCauHinh();
    if (activeTab === 'chamcong') return renderChamCong();
    if (activeTab === 'nghiphep') return renderNghiPhep();   // v9.57
    if (activeTab === 'nghiphepnam') return renderNghiPhepNam();   // v10.01
    if (activeTab === 'luongcongnhat') return renderLuong();
    if (activeTab === 'kpi') return renderKPI();   // v9.45
    if (activeTab === 'luongmay') return renderLuongMay();
    if (activeTab === 'luonggcinthe') return renderLuongGcInThe();
    if (activeTab === 'luongladonggoi') return renderLuongLaDongGoi();
    if (activeTab === 'luongtraivaicat') return renderLuongTraiVaiCat();   // v5.91
    if (activeTab === 'luongctv') return renderLuongCTV();   // v9.70
  }

  /* v9.70 — LƯƠNG CỘNG TÁC VIÊN THIẾT KẾ: số lệnh SX gắn CTV trong tháng (theo Ngày đặt) × đơn giá ở Danh mục.
     Bấm một CTV để xem / in chi tiết từng lệnh. Không vào bảng lương công nhật — kế toán lập phiếu chi tay. */
  /* v9.72: ô ảnh lệnh (ảnh hàng hóa ưu tiên, lùi về ảnh lệnh — máy chủ chọn); class thumb ⇒ rê chuột hiện to (v9.47). */
  function anhCTVHtml(url) {
    if (!url) return '<span style="color:#bbb;">—</span>';
    return `<a href="${escapeHtml(url)}" target="_blank"><img class="thumb" src="${escapeHtml(anhNho(url, 160))}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid var(--border);"></a>`;
  }
  /* v9.73 (Nguyen 17/11: "bản in lương ctv thiết kế đang không có ảnh"): ô ảnh cho BẢN IN + modal chi tiết —
     <img> trần, KHÔNG class thumb (iframe in không có CSS rê chuột), không <a>; đường dẫn /anh/… cùng gốc nên
     iframe tải được; printHtml đã đợi ảnh tải xong mới in (v7.x). */
  function anhInHtml(url) {
    if (!url) return '';
    return `<img src="${escapeHtml(anhNho(url, 160))}" style="width:56px;height:56px;object-fit:cover;border-radius:4px;border:1px solid #ccc;" alt="">`;
  }
  async function renderLuongCTV() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/luongctv?nam=${selNam}&thang=${selThang}`)).data; }
    catch (e) { container.innerHTML = periodBar(null, '') + `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; wirePeriod(container, renderLuongCTV); return; }
    const th = d.tongHop || [], rows = d.rows || [], trung = d.trung || [], chuaMR = d.chuaCoMaRap || [];
    /* v9.71: đơn vị tính = MÃ RẬP (Kỹ thuật cập nhật), mỗi mã rập một lần toàn hệ thống. */
    container.innerHTML = periodBar(null, `<button type="button" class="btn small secondary" id="btnInCTV">🖨️ In tổng hợp</button>`) + `
      <h4 style="margin:4px 0;">Tổng hợp theo cộng tác viên <span style="font-weight:400;font-size:12px;color:#5f6368;">(bấm một dòng để xem / in chi tiết)</span></h4>
      <table><thead><tr><th style="width:38px;">STT</th><th>Cộng tác viên</th><th>SĐT</th><th>Số TK / ngân hàng</th><th style="text-align:right;">Số mã rập</th><th style="text-align:right;">Số lệnh</th><th style="text-align:right;">Đơn giá / mã rập</th><th style="text-align:right;">Thành tiền</th></tr></thead>
      <tbody>${th.map((r, i) => `<tr class="ctv-dong" data-id="${r.CongTacVienID}" style="cursor:pointer;"><td style="text-align:center;">${i + 1}</td><td>${escapeHtml(r.TenCTV)}</td><td>${escapeHtml(r.SDT || '')}</td><td>${escapeHtml(r.NganHang || '')}</td><td style="text-align:right;">${num(r.SoMaRap)}</td><td style="text-align:right;">${num(r.SoLenh)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;font-weight:600;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty-hint">Tháng ${selThang}/${selNam} chưa có mã rập nào được tính cho cộng tác viên (lệnh phải tích "Cộng tác viên" và Kỹ thuật đã cập nhật mã rập).</td></tr>`}</tbody>
      ${th.length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="6" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(d.tong)}</td></tr></tfoot>` : ''}</table>
      <h4 style="margin:16px 0 4px;">Chi tiết theo mã rập</h4>
      <div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th style="width:48px;">Ảnh</th><th>Cộng tác viên</th><th>Mã rập</th><th>Mã lệnh</th><th>Sản phẩm</th><th>Ngày đặt</th><th style="text-align:right;">Đơn giá</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td style="text-align:center;">${i + 1}</td><td>${anhCTVHtml(r.Anh)}</td><td>${escapeHtml(r.TenCTV)}</td><td><b>${escapeHtml(r.MaRap)}</b></td><td>${escapeHtml(r.MaDH)}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${fmtDate(r.NgayDat)}</td><td style="text-align:right;">${money(r.DonGia)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty-hint">—</td></tr>'}</tbody></table></div>
      ${trung.length ? `<h4 style="margin:16px 0 4px;color:#b06000;">Mã rập đã tính ở lệnh trước — không tính lại (${trung.length})</h4>
      <div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th>Cộng tác viên</th><th>Mã rập</th><th>Lệnh này</th><th>Đã tính ở lệnh</th><th>Ngày đặt</th></tr></thead>
      <tbody>${trung.map(r => `<tr><td>${escapeHtml(r.TenCTV)}</td><td>${escapeHtml(r.MaRap)}</td><td>${escapeHtml(r.MaDH)}</td><td><b>${escapeHtml(r.DaTinhO)}</b></td><td>${fmtDate(r.NgayDat)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${chuaMR.length ? `<h4 style="margin:16px 0 4px;color:#c0392b;">Lệnh gắn CTV nhưng Kỹ thuật CHƯA cập nhật mã rập — chưa tính (${chuaMR.length})</h4>
      <div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:48px;">Ảnh</th><th>Cộng tác viên</th><th>Mã lệnh</th><th>Sản phẩm</th><th>Ngày đặt</th></tr></thead>
      <tbody>${chuaMR.map(r => `<tr><td>${anhCTVHtml(r.Anh)}</td><td>${escapeHtml(r.TenCTV)}</td><td><b>${escapeHtml(r.MaDH)}</b></td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${fmtDate(r.NgayDat)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Tính theo <b>mã rập</b> do bộ phận Kỹ thuật cập nhật (sơ đồ / tiến độ kỹ thuật của lệnh gắn CTV). Mỗi mã rập chỉ tính <b>một lần</b> — lệnh sau dùng lại mã rập cũ thì không tính. Tháng = tháng Ngày đặt của lệnh có mã rập lần đầu; đơn giá lấy từ <b>Danh mục → Cộng tác viên thiết kế</b> lúc xem. Không vào bảng lương công nhật — chi cho CTV bằng phiếu chi ở Công nợ.</p>`;
    wirePeriod(container, renderLuongCTV);
    themOTimTuDong(container);
    const inBody = (dsTH, dsRows, tieuDe) => `<h2 style="text-align:center;">${escapeHtml(tieuDe)} — Tháng ${selThang}/${selNam}</h2>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Cộng tác viên</th><th>Số mã rập</th><th>Đơn giá / mã rập</th><th>Thành tiền</th></tr></thead>
      <tbody>${dsTH.map((r, i) => `<tr><td style="text-align:center;">${i + 1}</td><td>${escapeHtml(r.TenCTV)}</td><td style="text-align:right;">${num(r.SoMaRap)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('')}
      <tr data-tong style="font-weight:bold;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(dsTH.reduce((s, x) => s + num(x.ThanhTien), 0))}</td></tr></tbody></table>
      ${dsRows.length ? `<h3>Chi tiết mã rập</h3><table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th style="width:64px;">Ảnh</th><th>Cộng tác viên</th><th>Mã rập</th><th>Mã lệnh</th><th>Sản phẩm</th><th>Ngày đặt</th><th>Đơn giá</th></tr></thead>
      <tbody>${dsRows.map((r, i) => `<tr><td style="text-align:center;">${i + 1}</td><td style="text-align:center;">${anhInHtml(r.Anh)}</td><td>${escapeHtml(r.TenCTV)}</td><td>${escapeHtml(r.MaRap || '')}</td><td>${escapeHtml(r.MaDH)}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${fmtDate(r.NgayDat)}</td><td style="text-align:right;">${money(r.DonGia)}</td></tr>`).join('')}</tbody></table>` : ''}`;
    const bIn = container.querySelector('#btnInCTV'); if (bIn) bIn.addEventListener('click', () => printHtml(`Lương CTV thiết kế T${selThang}/${selNam}`, inBody(th, rows, 'TỔNG HỢP LƯƠNG CỘNG TÁC VIÊN THIẾT KẾ')));
    container.querySelectorAll('.ctv-dong').forEach(tr => tr.addEventListener('click', () => {
      const id = tr.dataset.id, ctv = th.find(x => String(x.CongTacVienID) === id), ds = rows.filter(x => String(x.CongTacVienID) === id);
      const modal = openModal(`<h3>Chi tiết — ${escapeHtml(ctv ? ctv.TenCTV : '')}</h3><div style="max-height:60vh;overflow:auto;">${inBody(ctv ? [ctv] : [], ds, 'LƯƠNG CỘNG TÁC VIÊN THIẾT KẾ')}</div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnInCTV1">🖨️ In</button><button type="button" class="btn" id="btnDongCTV">Đóng</button></div>`);
      modal.querySelector('#btnDongCTV').addEventListener('click', closeModal);
      modal.querySelector('#btnInCTV1').addEventListener('click', () => printHtml(`Lương CTV - ${ctv ? ctv.TenCTV : ''} - T${selThang}/${selNam}`, inBody(ctv ? [ctv] : [], ds, 'LƯƠNG CỘNG TÁC VIÊN THIẾT KẾ')));
    }));
  }

  const money = (v) => (v == null || v === '' ? '0' : fmtNumber(Number(v)));
  const num = (v) => Number(v) || 0;
  // Bo chon ky (nam + thang) dung chung.
  function periodBar(onChange, extra) {
    const years = []; for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) years.push(y);
    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
      ${/* v8.02: BOP BE RONG hai o Nam/Thang, GIU nguyen chu "Nam"/"Thang".
           Nguyen: "cho chieu rong ngan lai chu co lien quan gi den cho khac" — chi hai o nay, khong
           dung den cac nut ben canh.
           v8.03: hai o nay dang GIAN HET CHIEU NGANG, moi o chiem tron mot dong (xem anh Nguyen gui)
           — do quy tac CSS chung dat width:100% cho select, de len inline style thuong. Nen width
           phai kem !important thi moi thang duoc; flex:0 0 auto de flexbox khong keo gian lai.
           92px la muc hep nhat con doc tron "Thang 12" / "Nam 2026": the <select> bi bop hep hon noi
           dung se CAT CHU (khong co dau ba cham), thanh "Nam 202...". Muon ngan hon nua thi buoc
           phai rut chu, ma Nguyen da bo cach do.
           KHONG dat dau backtick trong comment nay: no nam BEN TRONG template literal, mot dau
           backtick la dong som template -> SyntaxError, ca man hinh dung im. */''}
      <label style="font-weight:600;">Kỳ lương:</label>
      <select id="pNam" style="flex:0 0 auto;width:92px !important;font-size:13px;padding:3px 4px;">${years.map(y => `<option value="${y}" ${y === selNam ? 'selected' : ''}>Năm ${y}</option>`).join('')}</select>
      <select id="pThang" style="flex:0 0 auto;width:92px !important;font-size:13px;padding:3px 4px;">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<option value="${m}" ${m === selThang ? 'selected' : ''}>Tháng ${m}</option>`).join('')}</select>
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
          ${/* v9.45 (Nguyen 11/11): OT lương công nhật dùng MỘT hệ số cho mọi giờ = ô "ngày thường". Hai ô
               CN / lễ tết hiện KHÔNG được công thức nào đọc — nói rõ trên nhãn, kẻo sửa rồi tưởng OT đổi. */''}
          ${f('Hệ số OT — dùng cho MỌI giờ tăng ca lương công nhật', 'c_hsThuong', c.HsTangCaThuong)} ${f('Hệ số TC chủ nhật (chưa dùng ở đâu)', 'c_hsCN', c.HsTangCaChuNhat)} ${f('Hệ số TC lễ tết (chưa dùng ở đâu)', 'c_hsLe', c.HsTangCaLeTet)}
          ${f('Phụ cấp ca đêm (+)', 'c_caDem', c.PcCaDem)} ${f('Tăng ca đêm (+)', 'c_tcDem', c.PcTangCaDem)} ${f('Ngày trả lương', 'c_ngayTra', c.NgayTraLuong)}
        </div>
        ${/* v9.45: bốn tham số của bảng lương công nhật thực tế (migration_v890). Chưa chạy migration thì
             c.TruThueTNCN === undefined -> ẩn cả khối, tránh gửi giá trị lên để rồi máy chủ bỏ qua im lặng. */''}
        ${c.TruThueTNCN !== undefined ? `
        <div style="margin-top:12px;padding-top:10px;border-top:1px dashed #e0e0e0;font-weight:600;color:#1a73e8;">Lương công nhật (v9.45)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 16px;margin-top:6px;">
          <div class="form-row" style="margin:0;"><label>Trừ thuế TNCN vào thực lĩnh</label>
            <select id="c_truThue"><option value="0" ${c.TruThueTNCN ? '' : 'selected'}>Không — chỉ tính để xem (như bảng hiện tại)</option><option value="1" ${c.TruThueTNCN ? 'selected' : ''}>Có — trừ thẳng vào thực lĩnh</option></select></div>
          ${f('Tỷ lệ lương thử việc (%)', 'c_tyLeTV', c.TyLeThuViec, 1)}
          ${f('Làm tròn thực lĩnh (đ)', 'c_lamTron', c.LamTronThucLinh, 1)}
          ${f('Đi muộn châm chước (phút)', 'c_chamChuoc', c.DiMuonChamChuocPhut, 1)}
          ${/* v9.79 (Nguyen 19/11 chốt lại): xăng khai THEO TỪNG NGƯỜI bằng số tiền/1 ngày trên hợp đồng, nên ở
               đây KHÔNG còn ô đơn giá chung nào. Ô "Tiền xăng hỗ trợ (đ/1 km)" của v9.78 đã gỡ; cột
               CauHinhLuong.XangXeDonGiaKm để nguyên trong CSDL, không ai đọc. */''}
        </div>
        <p style="color:#5f6368;font-size:12px;margin:6px 0 0;">Xăng xe = <b>số tiền một ngày</b> khai ở từng hợp đồng (Nhân sự › Hợp đồng) × <b>ngày công đi làm thực tế</b> — không tính ngày phép, ngày lễ. Khai ở đây không có gì cho xăng xe: mỗi người một mức.</p>
        <p style="color:#5f6368;font-size:12px;margin:6px 0 0;">Thử việc: lương ngày × tỷ lệ này (bảng thực tế 85%) cho các ngày trước <i>Ngày hết thử việc</i> ở hợp đồng. Đi muộn = giờ vào máy chấm công trễ hơn giờ vào của nhóm quá số phút châm chước — một ngày là mất chuyên cần.</p>` : ''}
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
        hsTangCaThuong: g('c_hsThuong'), hsTangCaChuNhat: g('c_hsCN'), hsTangCaLeTet: g('c_hsLe'), pcCaDem: g('c_caDem'), pcTangCaDem: g('c_tcDem'), ngayTraLuong: g('c_ngayTra'),
        // v9.45: chỉ gửi khi khối có trên màn (đã chạy migration_v890)
        ...(container.querySelector('#c_truThue') ? {
          truThueTNCN: container.querySelector('#c_truThue').value === '1',
          tyLeThuViec: g('c_tyLeTV'), lamTronThucLinh: g('c_lamTron'), diMuonChamChuocPhut: g('c_chamChuoc')
          // v9.79: KHÔNG gửi xangXeDonGiaKm nữa — ô đã gỡ, xăng khai đ/ngày trên từng hợp đồng
        } : {})
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
  /* ================================================================================================
     v9.49 — KÉO CHẤM CÔNG TỰ ĐỘNG THEO GIỜ (Nguyen 13/11: "cho tải tự động vào 1 thời gian cài đặt").
     Ô này đọc /chamcong/tudong: cấu hình + TRẠNG THÁI THẬT của lịch (đang chạy / vì sao không) + kết
     quả lần chạy cuối. Ô tick xanh mà lịch không chạy là lời nói dối nguy hiểm nhất (bài học sao lưu
     v9.40) — nên dòng trạng thái lấy từ máy chủ, không suy từ ô tick.
     "Chạy ngay" gọi đúng hàm lịch sẽ gọi — thử được tại chỗ, không phải chờ đến giờ.
     ================================================================================================ */
  async function veKeoTuDong(o) {
    if (!o) return;
    let d;
    try { d = (await apiGet('/api/payroll/chamcong/tudong')).data; }
    catch (e) { o.innerHTML = `<span class="empty-hint" style="padding:0;">Không đọc được cài đặt kéo tự động: ${escapeHtml(e.message)}</span>`; return; }
    const c = d.cauHinh || {}, l = d.lich || {}, lc = l.lanCuoi;
    const dongLich = l.chay
      ? `<span style="color:#137333;font-weight:600;">● Đang chạy</span> — mỗi ngày lúc <b>${escapeHtml(l.gioChay)}</b>, kéo <b>${l.soNgayLui}</b> ngày gần nhất của mọi máy đang Hoạt động${l.tongHop ? ', rồi tổng hợp bảng công tháng' : ''}.`
      : `<span style="color:#b06000;font-weight:600;">● Không chạy</span> — ${escapeHtml(l.lyDo || '')}`;
    const dongCuoi = lc
      ? `Lần chạy gần nhất ${escapeHtml(lc.luc)} (${lc.nguon === 'tay' ? 'bấm tay' : 'theo lịch'}): `
        + (lc.loi ? `<span style="color:#c0392b;">${escapeHtml(lc.loi)}</span>` : '')
        + (lc.ketQua || []).map(x => x.ok
          ? `<b>${escapeHtml(x.may)}</b> +${x.inserted} lần quẹt mới${x.unmatched ? ` (<span style="color:#b06000;">${x.unmatched} chưa gán NV</span>)` : ''}`
          : `<b>${escapeHtml(x.may)}</b> <span style="color:#c0392b;">LỖI: ${escapeHtml(x.thongBao || '')}</span>`).join('; ')
        + (lc.tongHop || []).map(t => t.ok ? `; tổng hợp ${t.thang}/${t.nam}: ${t.affected} dòng${t.thieuQuet ? `, ${t.thieuQuet} ngày thiếu quẹt` : ''}` : `; tổng hợp ${t.thang}/${t.nam} <span style="color:#c0392b;">LỖI: ${escapeHtml(t.thongBao || '')}</span>`).join('')
      : 'Chưa chạy lần nào kể từ khi khởi động phần mềm.';
    o.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px;">⏰ Kéo tự động theo giờ</div>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:4px;margin:0;"><input type="checkbox" id="tdBat" ${c.bat ? 'checked' : ''} ${perm.canEdit ? '' : 'disabled'}> Bật</label>
        <div class="form-row" style="margin:0;"><label>Giờ chạy mỗi ngày</label><input type="time" id="tdGio" value="${escapeHtml(c.gioChay || '23:30')}" style="width:110px;" ${perm.canEdit ? '' : 'disabled'}></div>
        <div class="form-row" style="margin:0;"><label>Kéo mấy ngày gần nhất</label><input type="number" id="tdNgay" min="1" max="31" value="${Number(c.soNgayLui) || 3}" style="width:80px;" ${perm.canEdit ? '' : 'disabled'}></div>
        <label style="display:flex;align-items:center;gap:4px;margin:0;"><input type="checkbox" id="tdTongHop" ${c.tongHop !== false ? 'checked' : ''} ${perm.canEdit ? '' : 'disabled'}> Tổng hợp bảng công sau khi kéo</label>
        ${perm.canEdit ? `<button class="btn small" id="tdLuu">💾 Lưu</button><button class="btn small secondary" id="tdChay" title="Kéo + tổng hợp ngay bây giờ, đúng như lịch sẽ làm">▶ Chạy ngay</button>` : ''}
      </div>
      <div style="font-size:12px;margin-top:6px;">${dongLich}</div>
      <div style="font-size:12px;color:#5f6368;margin-top:2px;">${dongCuoi}</div>
      <div style="font-size:12px;color:#5f6368;margin-top:2px;">Nên đặt sau giờ tan ca cuối (quẹt ra của ca tối phải có rồi mới tổng hợp đúng). Kéo lại vài ngày gần nhất là cố ý: máy tắt hay mất mạng một hôm thì hôm sau vẫn lấy được, bản ghi trùng tự bỏ. Dòng bảng công đã <b>sửa tay</b> không bị ghi đè.</div>`;
    const bLuu = o.querySelector('#tdLuu');
    if (bLuu) bLuu.addEventListener('click', async () => {
      try {
        const r = await apiPost('/api/payroll/chamcong/tudong', {
          bat: o.querySelector('#tdBat').checked, gioChay: o.querySelector('#tdGio').value,
          soNgayLui: o.querySelector('#tdNgay').value, tongHop: o.querySelector('#tdTongHop').checked
        });
        toast(r.data.lich.chay ? `Đã lưu — lịch chạy mỗi ngày ${r.data.lich.gioChay}.` : `Đã lưu. Lịch không chạy: ${r.data.lich.lyDo}`, r.data.lich.chay ? 'success' : 'info');
        veKeoTuDong(o);
      } catch (e) { toast(e.message, 'error'); }
    });
    const bChay = o.querySelector('#tdChay');
    if (bChay) bChay.addEventListener('click', async () => {
      bChay.disabled = true; bChay.textContent = '⏳ Đang kéo…';
      try {
        const r = (await apiPost('/api/payroll/chamcong/tudong/chayngay', {})).data || {};
        if (r.boQua) toast(r.lyDo, 'info');
        else {
          const loi = (r.ketQua || []).filter(x => !x.ok).length;
          toast(loi ? `Xong, ${loi} máy lỗi — xem dòng kết quả.` : `Xong: ${(r.ketQua || []).reduce((s, x) => s + (x.inserted || 0), 0)} lần quẹt mới.`, loi ? 'error' : 'success');
        }
        renderChamCong();   // bảng công + chi tiết đã kéo đổi theo
      } catch (e) { toast(e.message, 'error'); bChay.disabled = false; bChay.textContent = '▶ Chạy ngay'; }
    });
  }

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
        ${/* v9.49: kéo TỰ ĐỘNG theo giờ cài đặt (Nguyen 13/11). Vẽ sau khi tải cấu hình — xem veKeoTuDong(). */''}
        <div id="ccTuDong" style="margin-top:10px;padding-top:8px;border-top:1px dashed #e0e0e0;"><span class="empty-hint" style="padding:0;">Đang tải cài đặt kéo tự động…</span></div>
      </fieldset>
      ${periodBar(null, `${perm.canEdit ? `<button class="btn small secondary" id="btnTongHop">🔄 Tổng hợp từ máy → bảng công</button>
        <button class="btn small secondary" id="btnCauHinhCC">⚙️ Cài đặt chấm công</button>
        <button class="btn small secondary" id="btnNhomCC">👥 Nhóm chấm công</button>
        <button class="btn small secondary" id="btnRawCC">📄 Chi tiết đã kéo về</button>` : ''}
        ${/* v9.55: lịch nghỉ lễ chung — xem được với quyền xem, thêm/xóa gác trong modal. Giấy nghỉ phép là TAB riêng (v9.57). */''}
        <button class="btn small secondary" id="btnNgayLe">📅 Lịch nghỉ lễ</button>
        ${perm.canDelete ? `<button class="btn small danger" id="btnXoaBangCC">🗑️ Xóa bảng công tháng</button>` : ''}`)}
      ${/* v8.00: ô tìm kiếm cho bảng công tháng.
           KHONG dung wireTableSearch co san: no so tren tr.textContent, ma cot Thao tac co nut
           "Sua chi tiet" => go "chi" la khop MOI DONG. Nen dung data-tim dung tu cac truong du lieu
           + boDau() (khong dau), giong cach v7.92 da lam cho danh sach lenh SX. */''}
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
        <input type="text" id="ccTim" placeholder="Gõ để tìm mã NV / họ tên / bộ phận / nhóm..." autocomplete="off" style="min-width:280px;">
        <span class="empty-hint" style="padding:0;" id="ccDemTim"></span>
      </div>
      <table><thead><tr><th>Mã NV</th><th>Họ tên</th><th>Bộ phận</th><th>Nhóm chấm công</th><th>Tổng công</th><th>Giờ tăng ca</th><th>Số ngày chấm</th><th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${cc.rows.map(r => `<tr data-tim="${escapeHtml(boDau((r.MaNhanVien || '') + ' ' + (r.HoTen || '') + ' ' + (r.TenBoPhan || '') + ' ' + (r.TenNhom || '')))}">
        ${/* v7.97: HỌ TÊN bấm được -> mở chi tiết chấm công của người đó. Trước đây chỉ vào được qua nút
             "Sửa chi tiết" mà nút đó gate theo perm.canEdit, nên người CHỈ ĐƯỢC XEM không có đường nào
             xem chi tiết. Link này chỉ cần quyền view (route GET /chamcong/:id vốn đã là 'view'). */''}
        <td>${escapeHtml(r.MaNhanVien || '')}</td>
        <td><a href="#" class="act-ccten" data-id="${r.NhanVienID}" data-ten="${escapeHtml(r.HoTen)}" title="Xem chi tiết chấm công tháng này" style="color:#1a73e8;text-decoration:none;font-weight:500;">${escapeHtml(r.HoTen)}</a></td>
        <td>${escapeHtml(r.TenBoPhan || '')}</td>
        ${/* v8.00: chua gan nhom = tinh theo cau hinh CHUNG. Ghi ro thay vi de trong, keo nguoi doc
             tuong la thieu du lieu. */''}
        <td>${r.TenNhom ? escapeHtml(r.TenNhom) : '<span style="color:#5f6368;font-size:12px;">(cấu hình chung)</span>'}</td>
        <td style="text-align:right;font-weight:600;">${num(r.TongCong)}</td><td style="text-align:right;">${num(r.TongGioTangCa)}</td><td style="text-align:right;">${num(r.SoNgay)}</td>
        <td>${perm.canEdit ? `<button class="btn small secondary act-ccedit" data-id="${r.NhanVienID}" data-ten="${escapeHtml(r.HoTen)}">Sửa chi tiết</button>` : ''}</td>
      </tr>`).join('') || `<tr><td colspan="8" class="empty-hint">Chưa có dữ liệu chấm công.</td></tr>`}</tbody></table>
      <h4 style="margin:16px 0 4px;">Chi tiết chấm công đã kéo về (giờ vào / giờ ra) — tháng ${selThang}/${selNam}</h4>
      <div style="overflow:auto;max-height:50vh;"><table style="font-size:13px;"><thead><tr><th>Ngày</th><th>Mã NV</th><th>Họ tên / Mã máy</th><th>Giờ vào</th><th>Giờ ra</th><th>Số lần</th></tr></thead>
      <tbody>${ccDetail.map(r => `<tr><td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen || ('(mã ' + (r.MaChamMay || '') + ' — chưa gán)'))}</td><td style="text-align:center;">${escapeHtml(r.GioVao || '')}</td><td style="text-align:center;">${escapeHtml(r.GioRa || '')}</td><td style="text-align:right;">${num(r.SoLan)}</td></tr>`).join('') || `<tr><td colspan="6" class="empty-hint">Chưa có dữ liệu kéo về trong tháng này.</td></tr>`}</tbody></table></div>`;
    wirePeriod(container, renderChamCong);
    /* v9.05: ô tìm ký tự bất kỳ cho Máy chấm công + Chi tiết đã kéo về.
       Bảng công tháng ĐÃ có ô tìm riêng (#ccTim, v8.00) — đánh dấu bảng đó lại để khỏi sinh ô
       thứ hai chồng lên. Nhận ra nó bằng chính dấu hiệu ô tìm cũ dùng: dòng có data-tim. */
    const bangCC = container.querySelector('tbody tr[data-tim]');
    if (bangCC && bangCC.closest('table')) bangCC.closest('table').dataset.coOTim = '1';
    themOTimTuDong(container);
    const bAdd = container.querySelector('#btnAddMay'); if (bAdd) bAdd.addEventListener('click', () => openMayForm(null));
    veKeoTuDong(container.querySelector('#ccTuDong'));   // v9.49
    // v5.60: cài đặt giờ vào/ra + tăng ca, xem chi tiết từng lần quẹt, xóa bảng công tháng.
    const bCfg = container.querySelector('#btnCauHinhCC'); if (bCfg) bCfg.addEventListener('click', () => openCauHinhChamCong());
    const bNhom = container.querySelector('#btnNhomCC'); if (bNhom) bNhom.addEventListener('click', openNhomChamCong);   // v8.00
    const bLe = container.querySelector('#btnNgayLe'); if (bLe) bLe.addEventListener('click', openLichNghiLe);            // v9.55
    /* v8.00: ô tìm bảng công tháng. Ẩn/hiện tại chỗ (dữ liệu đã nạp đủ 1 tháng, không cần gọi lại
       server). Dòng "không tìm thấy" phải dựng TRƯỚC khi themCotStt chạy thì colspan mới đúng — nên
       ở đây chỉ ẩn/hiện dòng có sẵn và đếm, không chèn dòng mới (bài học v7.92). */
    const oTim = container.querySelector('#ccTim');
    if (oTim) {
      const dsDong = Array.from(container.querySelectorAll('tbody tr[data-tim]'));
      const oDem = container.querySelector('#ccDemTim');
      oTim.addEventListener('input', () => {
        const q = boDau(oTim.value);
        let hien = 0;
        dsDong.forEach(tr => {
          const khop = !q || tr.dataset.tim.includes(q);
          tr.style.display = khop ? '' : 'none';
          if (khop) hien++;
        });
        oDem.textContent = q ? `Hiện ${hien}/${dsDong.length} người` : '';
      });
    }
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
    // v7.97: cùng một hàm mở modal với nút "Sửa chi tiết" — một nghiệp vụ, một luồng, không viết bản thứ hai.
    container.querySelectorAll('.act-ccten').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      openChamCongChiTiet(a.dataset.id, a.dataset.ten);
    }));
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
    /* 🔴 v9.11: NÓI RÕ đang hỏng ở ĐÂU. Hàm này gọi 3 API khác nhau; trước đây câu báo lỗi không
       kèm tên việc nên "tải nhân viên từ máy báo không có quyền" bị hiểu nhầm là máy chấm công
       chặn, trong khi thủ phạm là DANH MỤC NHÂN SỰ. Đoán nhầm mất nguyên một vòng sửa. */
    /* 🔴 v9.11: ĐỔI từ `/api/danhmuc/nhanvien` sang `/api/payroll/nhanvien`.
       Đường cũ thuộc phân hệ DANH MỤC, nên người làm chấm công phải được cấp cả Danh mục mới bấm
       được nút này — sai nghiệp vụ, và đúng là lỗi `huongns` gặp (có đủ Nhân sự + Tính lương nhưng
       không có Danh mục). Đường mới gác bằng chính quyền của màn này. */
    try { nvList = (await apiGet('/api/payroll/nhanvien')).data || []; }
    catch (e) {
      toast('Không đọc được DANH SÁCH NHÂN VIÊN: ' + e.message, 'error', 10000);
      return;
    }
    // v5.37.1: dựng danh sách từ MÃ ĐÃ KÉO VỀ (ChamCongRaw distinct) — không phụ thuộc getUsers (nhiều máy trả rỗng).
    try { rawList = (await apiGet('/api/payroll/maychamcong/' + mayId + '/machamcong-list')).data || []; } catch (e) { }
    /* 🔴 v9.11: KHÔNG nuốt im lặng nữa. Máy không hỗ trợ getUsers là chuyện bình thường nên vẫn đi
       tiếp bằng danh sách đã kéo về — NHƯNG phải nói ra. Bản cũ nuốt MỌI lỗi ở đây, kể cả 403 thiếu
       quyền và lỗi mạng tới máy chấm công, nên không ai từng nhìn thấy câu từ chối của backend. */
    try { devUsers = (await apiPost('/api/payroll/maychamcong/' + mayId + '/nhanvien-tumay', {})).data || []; }
    catch (e) { toast('Không lấy được danh sách TỪ MÁY CHẤM CÔNG: ' + e.message + ' — vẫn dùng mã đã kéo về.', 'error', 9000); }
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
  /* v8.00: `nhomId` có thì form này khai giờ cho ĐÚNG MỘT NHÓM; không có thì khai cấu hình CHUNG
     như trước. MỘT form phục vụ cả hai — viết bản thứ hai là hai bên trôi khỏi nhau, và người dùng
     phải học hai layout cho cùng một việc.
     Backend trả về bản ĐÃ GỘP (chung + nhóm) nên số hiện trên form chính là số sẽ được lưu — không
     có chuyện bấm Lưu mà âm thầm đổi một ô mình chưa hề chạm vào. */
  async function openCauHinhChamCong(nhomId, tenNhom) {
    let cfg, daKhaiRieng = false;
    try {
      const res = await apiGet('/api/payroll/chamcong/cauhinh' + (nhomId ? '?nhomId=' + encodeURIComponent(nhomId) : ''));
      cfg = res.data || {};
      daKhaiRieng = !!res.daKhaiRieng;
      if (res.nhom && res.nhom.TenNhom) tenNhom = res.nhom.TenNhom;
    }
    catch (e) { toast(e.message, 'error'); return; }
    const f = (label, inner, hint) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}${hint ? `<div style="font-size:11px;color:#5f6368;">${hint}</div>` : ''}</div>`;
    const modal = openModal(`
      <h3>${nhomId ? '⏰ Cài giờ cho nhóm: ' + escapeHtml(tenNhom || '') : '⚙️ Cài đặt chấm công (chung toàn công ty)'}</h3>
      ${nhomId ? `<p class="empty-hint" style="text-align:left;">Số đang hiện là giờ nhóm này <b>đang áp dụng thật</b>${daKhaiRieng ? ' (nhóm đã khai riêng)' : ' — hiện đang theo cấu hình chung, sửa và Lưu là nhóm có giờ riêng'}.
        Ngày lễ/Tết <b>không khai ở đây</b> — lễ là lễ chung toàn công ty, cài ở "⚙️ Cài đặt chấm công".</p>` : ''}
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
          ${/* v9.55: ngày lễ chuyển sang nút 📅 Lịch nghỉ lễ (bảng NgayLeChung) — ô gõ tay cũ bỏ, ngày đã gõ được máy chủ
               chép sang lịch lần đầu mở. KHÔNG đặt dấu backtick trong comment này. */''}
          ${nhomId ? '' : `<div class="form-row" style="margin-top:8px;"><label>Ngày lễ / Tết</label>
            <div style="font-size:12px;color:#5f6368;">Quản lý ở nút <b>📅 Lịch nghỉ lễ</b> trên tab Chấm công (đang có ${(cfg.ngayLe || []).length} ngày). Tăng ca ngày lễ vào cột "Lễ/Tết"; Chủ nhật tự nhận diện vào cột "Chủ nhật".</div>
          </div>`}
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
        // v8.00: form của NHÓM không có ô ngày lễ (lễ là lễ chung) -> phải kiểm ô có tồn tại.
        ngayLe: modal.querySelector('#cc_ngayLe')
          ? modal.querySelector('#cc_ngayLe').value.split('\n').map(s => s.trim()).filter(Boolean) : [],
        nhomId: nhomId || null   // v8.00
      };
      try {
        await apiPost('/api/payroll/chamcong/cauhinh', payload);
        closeModal();
        toast(nhomId
          ? 'Đã lưu giờ cho nhóm. Bấm "Tổng hợp từ máy" để tính lại tháng đang xem theo giờ mới.'
          : 'Đã lưu cài đặt chấm công. Bấm "Tổng hợp từ máy" để áp dụng.', 'success');
        if (nhomId) openNhomChamCong();   // quay lại danh sách nhóm để thấy giờ vừa đổi
      }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     v8.00 — NHÓM CHẤM CÔNG. Mỗi nhóm một bộ giờ vào/ra, tự gán nhân viên vào.
     Người CHƯA gán nhóm vẫn tính theo "⚙️ Cài đặt chấm công" chung như trước v8.00.
     ================================================================================================ */
  async function openNhomChamCong() {
    let ds = [], chung = {};
    try {
      const res = await apiGet('/api/payroll/chamcong/nhom');
      ds = res.data || []; chung = res.cauHinhChung || {};
    } catch (e) { toast(e.message, 'error'); return; }
    const modal = openModal(`
      <h3>👥 Nhóm chấm công</h3>
      <p class="empty-hint" style="text-align:left;">Mỗi nhóm một bộ <b>giờ vào / giờ ra</b> riêng. Nhân viên <b>chưa gán nhóm</b> tính theo cấu hình chung
        (${escapeHtml(chung.gioVao || '')}–${escapeHtml(chung.gioRa || '')}).
        <br>⚠️ Đổi giờ <b>không tự tính lại</b> tháng đã chốt — phải bấm <b>🔄 Tổng hợp từ máy → bảng công</b>, và lệnh đó giữ nguyên các dòng đã sửa tay.</p>
      ${perm.canCreate ? `<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:10px;">
        <div class="form-row" style="margin:0;"><label>Tên nhóm mới</label><input id="nhTen" placeholder="VD: Ca ngày / Ca đêm" style="width:220px;"></div>
        <div class="form-row" style="margin:0;flex:1;"><label>Ghi chú</label><input id="nhGhiChu" placeholder="không bắt buộc" style="width:100%;"></div>
        <button type="button" class="btn small" id="nhThem">➕ Thêm nhóm</button>
      </div>` : ''}
      <table><thead><tr><th>Tên nhóm</th><th>Giờ vào</th><th>Giờ ra</th><th>Số nhân viên</th><th>Ghi chú</th><th style="width:240px">Thao tác</th></tr></thead>
      <tbody>${ds.map(n => `<tr>
        <td><b>${escapeHtml(n.TenNhom)}</b>${n.DaKhaiRieng ? '' : ' <span class="badge">theo cấu hình chung</span>'}</td>
        <td style="text-align:center;">${escapeHtml(n.GioVao || '')}</td>
        <td style="text-align:center;">${escapeHtml(n.GioRa || '')}</td>
        <td style="text-align:right;">${num(n.SoNhanVien)}</td>
        <td>${escapeHtml(n.GhiChu || '')}</td>
        <td>${perm.canEdit ? `<button class="btn small secondary nh-gio" data-id="${n.NhomID}" data-ten="${escapeHtml(n.TenNhom)}">⏰ Cài giờ</button>
             <button class="btn small secondary nh-nv" data-id="${n.NhomID}" data-ten="${escapeHtml(n.TenNhom)}">👤 Gán nhân viên</button>
             <button class="btn small secondary nh-sua" data-id="${n.NhomID}" data-ten="${escapeHtml(n.TenNhom)}" data-gc="${escapeHtml(n.GhiChu || '')}">Sửa tên</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger nh-xoa" data-id="${n.NhomID}" data-ten="${escapeHtml(n.TenNhom)}" data-sl="${n.SoNhanVien}">Xóa</button>` : ''}</td>
      </tr>`).join('') || `<tr><td colspan="6" class="empty-hint">Chưa có nhóm nào. Thêm nhóm rồi cài giờ và gán nhân viên.</td></tr>`}</tbody></table>
      <div class="modal-actions"><button type="button" class="btn secondary" id="nhDong">Đóng</button></div>`);
    modal.querySelector('#nhDong').addEventListener('click', () => { closeModal(); renderChamCong(); });
    const bThem = modal.querySelector('#nhThem');
    if (bThem) bThem.addEventListener('click', async () => {
      const ten = modal.querySelector('#nhTen').value.trim();
      if (!ten) { toast('Nhập tên nhóm.', 'error'); return; }
      try {
        await apiPost('/api/payroll/chamcong/nhom', { tenNhom: ten, ghiChu: modal.querySelector('#nhGhiChu').value.trim() });
        toast('Đã thêm nhóm. Tiếp: bấm "Cài giờ" rồi "Gán nhân viên".', 'success');
        openNhomChamCong();
      } catch (e) { toast(e.message, 'error'); }
    });
    modal.querySelectorAll('.nh-gio').forEach(b => b.addEventListener('click', () =>
      openCauHinhChamCong(b.dataset.id, b.dataset.ten)));
    modal.querySelectorAll('.nh-nv').forEach(b => b.addEventListener('click', () =>
      openGanNhanVienNhom(b.dataset.id, b.dataset.ten)));
    modal.querySelectorAll('.nh-sua').forEach(b => b.addEventListener('click', async () => {
      const ten = prompt('Tên nhóm:', b.dataset.ten);
      if (ten == null || !ten.trim()) return;
      try {
        await apiPut('/api/payroll/chamcong/nhom/' + b.dataset.id, { tenNhom: ten.trim(), ghiChu: b.dataset.gc });
        toast('Đã lưu.', 'success'); openNhomChamCong();
      } catch (e) { toast(e.message, 'error'); }
    }));
    modal.querySelectorAll('.nh-xoa').forEach(b => b.addEventListener('click', async () => {
      const sl = Number(b.dataset.sl) || 0;
      if (!confirm(`Xóa nhóm "${b.dataset.ten}"?\n\n${sl > 0
        ? sl + ' nhân viên đang thuộc nhóm này sẽ được GỠ RA (không xóa người), và chuyển về tính theo cấu hình chung.'
        : 'Nhóm này chưa có nhân viên nào.'}`)) return;
      try {
        const r = await apiDelete('/api/payroll/chamcong/nhom/' + b.dataset.id);
        toast(`Đã xóa nhóm. Gỡ ${(r.data || {}).goRaKhoiNhom || 0} nhân viên về cấu hình chung.`, 'success');
        openNhomChamCong();
      } catch (e) { toast(e.message, 'error'); }
    }));
  }

  /* Gán nhân viên vào nhóm: tích chọn NHIỀU người. Một người chỉ thuộc ĐÚNG MỘT nhóm, nên danh sách
     ghi rõ ai đang ở nhóm khác — tích vào là KÉO SANG nhóm này, không phải thuộc cả hai. */
  async function openGanNhanVienNhom(nhomId, tenNhom) {
    let ds = [];
    try { ds = (await apiGet(`/api/payroll/chamcong/nhom/${encodeURIComponent(nhomId)}/nhanvien`)).data || []; }
    catch (e) { toast(e.message, 'error'); return; }
    const modal = openModal(`
      <h3>👤 Gán nhân viên vào nhóm: ${escapeHtml(tenNhom || '')}</h3>
      <p class="empty-hint" style="text-align:left;">Tích = thuộc nhóm này. Bỏ tích = gỡ khỏi nhóm (về tính theo cấu hình chung).
        Người đang ở <b>nhóm khác</b> có ghi rõ tên nhóm đó — tích vào là <b>kéo sang</b> nhóm này.</p>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
        <input type="text" id="gnTim" placeholder="Gõ để tìm mã / họ tên / bộ phận..." style="min-width:240px;">
        <button type="button" class="btn small secondary" id="gnTatCa">Tích tất cả đang hiện</button>
        <button type="button" class="btn small secondary" id="gnBoTatCa">Bỏ tích tất cả đang hiện</button>
        <span class="empty-hint" style="padding:0;" id="gnDem"></span>
      </div>
      <div style="max-height:52vh;overflow:auto;">
      <table data-nostt><thead><tr><th style="width:40px;"></th><th>Mã NV</th><th>Họ tên</th><th>Bộ phận</th><th>Nhóm hiện tại</th></tr></thead>
      <tbody>${ds.map(r => `<tr data-tim="${escapeHtml(boDau((r.MaNhanVien || '') + ' ' + (r.HoTen || '') + ' ' + (r.TenBoPhan || '')))}">
        <td style="text-align:center;"><input type="checkbox" class="gn-tick" data-id="${r.NhanVienID}" ${Number(r.DangThuocNhomNay) === 1 ? 'checked' : ''}></td>
        <td>${escapeHtml(r.MaNhanVien || '')}</td>
        <td>${escapeHtml(r.HoTen)}</td>
        <td>${escapeHtml(r.TenBoPhan || '')}</td>
        <td>${Number(r.DangThuocNhomNay) === 1 ? '<b style="color:#137333;">nhóm này</b>'
              : (r.TenNhomHienTai ? '<span style="color:#b06000;">' + escapeHtml(r.TenNhomHienTai) + '</span>' : '<span style="color:#5f6368;">chưa gán</span>')}</td>
      </tr>`).join('') || `<tr><td colspan="5" class="empty-hint">Không có nhân viên đang làm việc.</td></tr>`}</tbody></table></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="gnHuy">Hủy</button><button type="button" class="btn" id="gnLuu">💾 Lưu danh sách</button></div>`);
    const dong = () => Array.from(modal.querySelectorAll('tbody tr[data-tim]'));
    const demLai = () => {
      const n = modal.querySelectorAll('.gn-tick:checked').length;
      modal.querySelector('#gnDem').textContent = `Đang tích: ${n} người`;
    };
    demLai();
    modal.querySelectorAll('.gn-tick').forEach(cb => cb.addEventListener('change', demLai));
    modal.querySelector('#gnTim').addEventListener('input', (e) => {
      const q = boDau(e.target.value);
      dong().forEach(tr => { tr.style.display = !q || tr.dataset.tim.includes(q) ? '' : 'none'; });
    });
    const datTich = (v) => {
      dong().forEach(tr => {
        if (tr.style.display === 'none') return;   // chỉ áp cho dòng ĐANG HIỆN, đúng nhãn nút
        const cb = tr.querySelector('.gn-tick'); if (cb) cb.checked = v;
      });
      demLai();
    };
    modal.querySelector('#gnTatCa').addEventListener('click', () => datTich(true));
    modal.querySelector('#gnBoTatCa').addEventListener('click', () => datTich(false));
    modal.querySelector('#gnHuy').addEventListener('click', () => openNhomChamCong());
    modal.querySelector('#gnLuu').addEventListener('click', async () => {
      /* Đọc TOÀN BỘ ô tích, không chỉ dòng đang hiện: người bị ô tìm ẩn đi vẫn phải được giữ, kẻo
         gõ tìm rồi bấm Lưu là gỡ sạch những người không khớp chữ tìm. */
      const ids = Array.from(modal.querySelectorAll('.gn-tick:checked')).map(cb => cb.dataset.id);
      try {
        await apiPost(`/api/payroll/chamcong/nhom/${encodeURIComponent(nhomId)}/nhanvien`, { nhanVienIds: ids });
        toast(`Đã gán ${ids.length} nhân viên vào nhóm. Bấm "Tổng hợp từ máy" để tính lại theo giờ nhóm.`, 'success');
        openNhomChamCong();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  /* === v9.55 NGHI LE + PHIEU NGHI — BAT DAU === */
  /* v9.55 (Nguyen 14/11): "Chấm công thêm chức năng tạo lịch nghỉ lễ chung cho cả công ty. Tạo lịch nghỉ không lương,
     thai sản, tai nạn theo từng cá nhân" + "tạo phiếu nghỉ phép chọn nhân viên, chọn ngày nghỉ phép để đưa vào bảng
     lương. Chữ ký có người xin nghỉ và trưởng bộ phận". Máy chủ ghi các ngày làm việc của phiếu vào bảng chấm công
     (mã P/KL/TS/TN, nguồn PhieuNghi) — bảng lương đọc như cũ; mở tab Lương công nhật là tự tính lại (v9.53).
     Anh chốt: phép (P) KHÔNG lương như v9.45; lễ chung KHÔNG công. */
  const LOAI_NGHI = { P: 'Nghỉ phép', KL: 'Nghỉ không lương', TS: 'Nghỉ thai sản', TN: 'Nghỉ tai nạn' };
  const TIEU_DE_DON = { P: 'GIẤY NGHỈ PHÉP', KL: 'GIẤY NGHỈ KHÔNG LƯƠNG', TS: 'GIẤY NGHỈ THAI SẢN', TN: 'GIẤY NGHỈ DO TAI NẠN LAO ĐỘNG' };   // v9.57: "giấy" theo chữ Nguyen dùng
  const thuCua = (s) => { const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? '' : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]; };
  const ddmm = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : escapeHtml(String(s || '')); };
  function baoChuaMigration(tenViec) {
    const m = openModal(`<h3>${escapeHtml(tenViec)}</h3><p>Máy chủ <b>chưa chạy database/migration_v892.sql</b> nên chưa có bảng cho chức năng này. Chạy migration rồi <code>pm2 restart</code>.</p>
      <div class="modal-actions"><button type="button" class="btn" id="mgDong">Đóng</button></div>`);
    m.querySelector('#mgDong').addEventListener('click', closeModal);
  }
  async function openLichNghiLe() {
    let kq;
    try { kq = (await apiGet('/api/payroll/chamcong/ngayle?nam=' + selNam)).data || {}; } catch (e) { toast(e.message, 'error'); return; }
    if (kq.chuaMigration) { baoChuaMigration('📅 Lịch nghỉ lễ'); return; }
    const rows = kq.rows || [];
    const m = openModal(`<h3>📅 Lịch nghỉ lễ chung — năm ${selNam}</h3>
      <p class="empty-hint" style="text-align:left;">Áp cho cả công ty. Ngày lễ: <b>không tính công</b>, không tính "không phép", phiếu nghỉ bỏ qua ngày này; ai đi làm thì giờ tăng ca vào cột <b>Lễ/Tết</b>. Xem năm khác: đổi năm ở ô Kỳ lương rồi mở lại.</p>
      ${perm.canEdit ? `<div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px;">
        <div class="form-row" style="margin:0;"><label>Ngày *</label><input type="date" id="leNgay"></div>
        <div class="form-row" style="margin:0;flex:1;min-width:200px;"><label>Tên ngày lễ</label><input id="leTen" maxlength="100" placeholder="VD: Quốc khánh 2/9" style="width:100%;"></div>
        <button type="button" class="btn small" id="leThem">➕ Thêm</button>
      </div>` : ''}
      <table data-nostt><thead><tr><th style="width:120px;">Ngày</th><th style="width:50px;">Thứ</th><th>Tên ngày lễ</th><th style="width:90px;"></th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${ddmm(r.Ngay)}</td><td style="text-align:center;">${thuCua(r.Ngay)}</td><td>${escapeHtml(r.TenLe || '')}</td>
        <td>${perm.canDelete ? `<button type="button" class="btn small danger le-xoa" data-id="${r.ID}" data-ngay="${escapeHtml(r.Ngay)}">Xóa</button>` : ''}</td></tr>`).join('')
        || `<tr><td colspan="4" class="empty-hint">Năm ${selNam} chưa có ngày lễ nào.</td></tr>`}</tbody></table>
      <div class="modal-actions"><button type="button" class="btn secondary" id="leDong">Đóng</button></div>`);
    m.querySelector('#leDong').addEventListener('click', closeModal);
    const bThem = m.querySelector('#leThem');
    if (bThem) bThem.addEventListener('click', async () => {
      const ngay = m.querySelector('#leNgay').value;
      if (!ngay) { toast('Chọn ngày.', 'error'); return; }
      try { await apiPost('/api/payroll/chamcong/ngayle', { ngay, tenLe: m.querySelector('#leTen').value.trim() }); toast('Đã thêm ngày lễ.', 'success'); openLichNghiLe(); }
      catch (e) { toast(e.message, 'error'); }
    });
    m.querySelectorAll('.le-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(`Xóa ngày lễ ${ddmm(b.dataset.ngay)}?`)) return;
      try { await apiDelete('/api/payroll/chamcong/ngayle/' + b.dataset.id); toast('Đã xóa.', 'success'); openLichNghiLe(); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }
  /* v9.57 (Nguyen 14/11: "Nghỉ phép / nghỉ cá nhân đưa ra thành chức năng dưới Tính lương, sửa thành Tạo giấy nghỉ
     phép / Nghỉ cá nhân"): là TAB RIÊNG (key 'nghiphep', chức năng PAYROLL/nghiphep), không còn là nút trong tab
     Chấm công. Nút "Phiếu nghỉ của người này" ở chi tiết chấm công chuyển sang tab này với người đó chọn sẵn. */
  let nvMacDinhNghiPhep = null;
  async function renderNghiPhep() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    const nv = nvMacDinhNghiPhep; nvMacDinhNghiPhep = null;
    await veNghiPhep(container, { nvMacDinh: nv });
  }
  /* Vẽ danh sách + form vào `host` (tab). Phiếu của THÁNG đang chọn (phiếu chạm tới tháng); nvMacDinh: chọn sẵn
     người; suaId: đang sửa phiếu đó (form điền sẵn). */
  async function veNghiPhep(host, opts) {
    opts = opts || {};
    let kq, nvList = [];
    try {
      kq = (await apiGet(`/api/payroll/chamcong/phieunghi?nam=${selNam}&thang=${selThang}`)).data || {};
      if (perm.canEdit) nvList = (await apiGet('/api/payroll/nhanvien')).data || [];
    } catch (e) { host.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    const rows = kq.rows || [];
    const dangSua = opts.suaId ? rows.find(r => String(r.PhieuNghiID) === String(opts.suaId)) : null;
    const f = (label, inner) => `<div class="form-row" style="margin:0;"><label>${label}</label>${inner}</div>`;
    const h = dangSua || {};
    const nvChon = h.NhanVienID || opts.nvMacDinh || '';
    host.innerHTML = periodBar(null, '') + (kq.chuaMigration
      ? `<div class="empty-hint" style="text-align:left;">Máy chủ <b>chưa chạy database/migration_v892.sql</b> nên chưa có bảng Phiếu nghỉ. Chạy migration rồi <code>pm2 restart</code>.</div>`
      : `<p class="empty-hint" style="text-align:left;">Lưu giấy là các <b>ngày làm việc</b> trong khoảng (bỏ Chủ nhật + lễ chung) được ghi vào bảng chấm công với mã <b>P / KL / TS / TN</b>, số công 0 — bảng lương tự tính lại.
        <b>Phép (P) không lương</b> (vào cột Phép, mất chuyên cần). Ngày đã có quẹt máy thì <b>máy thắng</b> (người đi làm sớm hơn giấy). 🖨️ In giấy có chỗ ký <b>người xin nghỉ</b> và <b>trưởng bộ phận</b>. Lễ chung khai ở Chấm công → 📅 Lịch nghỉ lễ.</p>
      ${perm.canEdit ? `<form id="pnForm" style="border:1px solid #e0e0e0;border-radius:6px;padding:10px 12px;margin-bottom:10px;">
        <div style="font-weight:600;margin-bottom:6px;">${dangSua ? '✏️ Sửa giấy ' + escapeHtml(h.SoPhieu || ('#' + h.PhieuNghiID)) : '➕ Tạo giấy nghỉ phép / nghỉ cá nhân'}</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px 16px;">
          ${f('Nhân viên *', `<select id="pnNV"><option value="">-- Chọn nhân viên --</option>${nvList.map(x => `<option value="${x.NhanVienID}" ${String(nvChon) === String(x.NhanVienID) ? 'selected' : ''}>${escapeHtml((x.MaNhanVien ? x.MaNhanVien + ' - ' : '') + x.HoTen)}</option>`).join('')}</select>`)}
          ${f('Loại nghỉ *', `<select id="pnLoai" data-nosearch>${Object.keys(LOAI_NGHI).map(k => `<option value="${k}" ${(h.Loai || 'P') === k ? 'selected' : ''}>${k} — ${LOAI_NGHI[k]}</option>`).join('')}</select>`)}
          ${f('Người duyệt (trưởng bộ phận)', `<input id="pnDuyet" maxlength="100" value="${escapeHtml(h.NguoiDuyet || '')}" placeholder="Trống = lấy Quản lý trực tiếp trên hợp đồng">`)}
          ${f('Từ ngày *', `<input type="date" id="pnTu" value="${escapeHtml(h.TuNgay || '')}">`)}
          ${f('Đến ngày *', `<input type="date" id="pnDen" value="${escapeHtml(h.DenNgay || '')}">`)}
          ${f('Lý do', `<input id="pnLyDo" maxlength="255" value="${escapeHtml(h.LyDo || '')}" placeholder="VD: Việc gia đình">`)}
          ${/* v9.73 (Nguyen 17/11): nghỉ NỬA ngày — chỉ cho giấy 1 ngày; chấm công ghi P 0,5 công (phần còn lại theo máy/sửa tay). */''}
          ${f('Nửa ngày', `<label style="font-weight:normal;"><input type="checkbox" id="pnNuaNgay" ${h.NuaNgay ? 'checked' : ''}> Chỉ nghỉ ½ ngày (giấy 1 ngày — Từ = Đến)</label>`)}
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end;">
          ${dangSua ? '<button type="button" class="btn secondary" id="pnHuySua">Hủy sửa</button>' : ''}
          <button type="submit" class="btn">💾 ${dangSua ? 'Lưu sửa' : 'Lưu giấy'}</button>
        </div></form>` : ''}
      <h4 style="margin:6px 0;">Giấy nghỉ chạm tới tháng ${selThang}/${selNam}</h4>
      <table data-nostt style="font-size:13px;"><thead><tr><th>Số giấy</th><th>Nhân viên</th><th>Loại</th><th>Từ ngày</th><th>Đến ngày</th><th style="text-align:right;">Ngày LV</th><th>Lý do</th><th>Người duyệt</th><th style="width:170px;"></th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.SoPhieu || '')}</td><td>${escapeHtml((r.MaNhanVien ? r.MaNhanVien + ' - ' : '') + (r.HoTen || ''))}</td>
        <td><span class="badge">${escapeHtml(r.Loai)}</span> ${escapeHtml(LOAI_NGHI[r.Loai] || '')}</td>
        <td>${ddmm(r.TuNgay)}</td><td>${ddmm(r.DenNgay)}</td><td style="text-align:right;">${num(r.SoNgay)}</td>
        <td>${escapeHtml(r.LyDo || '')}</td><td>${escapeHtml(r.NguoiDuyet || '')}</td>
        <td><button type="button" class="btn small secondary pn-in" data-id="${r.PhieuNghiID}">🖨️ In</button>
          ${perm.canEdit ? `<button type="button" class="btn small secondary pn-sua" data-id="${r.PhieuNghiID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button type="button" class="btn small danger pn-xoa" data-id="${r.PhieuNghiID}" data-so="${escapeHtml(r.SoPhieu || '')}">Xóa</button>` : ''}</td>
      </tr>`).join('') || `<tr><td colspan="9" class="empty-hint">Tháng ${selThang}/${selNam} chưa có giấy nghỉ nào.</td></tr>`}</tbody></table>`);
    wirePeriod(host, () => veNghiPhep(host, {}));
    themOTimTuDong(host);   // v9.05: ô tìm số giấy / tên người trên danh sách
    const form = host.querySelector('#pnForm');
    if (form) {
      // Chọn Đến ngày = Từ ngày khi còn trống (nghỉ một ngày là trường hợp thường nhất).
      host.querySelector('#pnTu').addEventListener('change', (e) => { const den = host.querySelector('#pnDen'); if (!den.value || den.value < e.target.value) den.value = e.target.value; });
      const bHuy = host.querySelector('#pnHuySua'); if (bHuy) bHuy.addEventListener('click', () => veNghiPhep(host, {}));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = { nhanVienId: host.querySelector('#pnNV').value, loai: host.querySelector('#pnLoai').value, tuNgay: host.querySelector('#pnTu').value,
          denNgay: host.querySelector('#pnDen').value, lyDo: host.querySelector('#pnLyDo').value.trim(), nguoiDuyet: host.querySelector('#pnDuyet').value.trim(),
          nuaNgay: !!(host.querySelector('#pnNuaNgay') && host.querySelector('#pnNuaNgay').checked) };   // v9.73
        if (!payload.nhanVienId) { toast('Chọn nhân viên.', 'error'); return; }
        if (!payload.tuNgay || !payload.denNgay) { toast('Chọn từ ngày / đến ngày.', 'error'); return; }
        if (payload.nuaNgay && payload.tuNgay !== payload.denNgay) { toast('Nghỉ nửa ngày chỉ áp dụng cho giấy MỘT ngày (Từ ngày = Đến ngày).', 'error'); return; }
        try {
          const r = dangSua ? await apiPut('/api/payroll/chamcong/phieunghi/' + dangSua.PhieuNghiID, payload) : await apiPost('/api/payroll/chamcong/phieunghi', payload);
          toast(`Đã lưu giấy${r.data && r.data.SoPhieu ? ' ' + r.data.SoPhieu : ''} — ${num(r.data && r.data.SoNgay)} ngày làm việc đã ghi vào bảng chấm công.`, 'success');
          veNghiPhep(host, {});
        } catch (err) { toast(err.message, 'error'); }
      });
    }
    host.querySelectorAll('.pn-sua').forEach(b => b.addEventListener('click', () => veNghiPhep(host, { suaId: b.dataset.id })));
    host.querySelectorAll('.pn-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(`Xóa giấy ${b.dataset.so || '#' + b.dataset.id}? Các ngày nghỉ do giấy ghi vào bảng chấm công sẽ bị gỡ.`)) return;
      try { await apiDelete('/api/payroll/chamcong/phieunghi/' + b.dataset.id); toast('Đã xóa giấy nghỉ.', 'success'); veNghiPhep(host, {}); }
      catch (err) { toast(err.message, 'error'); }
    }));
    host.querySelectorAll('.pn-in').forEach(b => b.addEventListener('click', () => {
      const r = rows.find(x => String(x.PhieuNghiID) === String(b.dataset.id));
      /* v9.58 (Nguyen 14/11, ảnh): bỏ đầu trang công ty chung của printHtml — giấy đã có khung "Công ty | CHXHCN" riêng. */
      if (r) printHtml(`Giay nghi ${r.SoPhieu || ''} - ${r.HoTen || ''}`, buildPhieuNghiBody(r), { noLetterhead: true });
    }));
  }
  /* Bản in: hai chữ ký (trưởng bộ phận trái, người xin nghỉ phải). Tên công ty lấy từ module Nhân sự (một hằng). */
  function buildPhieuNghiBody(r) {
    const ct = (window.ModuleHRM && typeof ModuleHRM.congTy === 'function') ? ModuleHRM.congTy() : {};
    const loai = LOAI_NGHI[r.Loai] || 'Nghỉ';
    const ngayLap = r.CreatedAt ? String(r.CreatedAt).slice(0, 10) : '';
    const d = ngayLap ? new Date(ngayLap + 'T00:00:00') : new Date();
    /* v9.58: in với noLetterhead (bỏ đầu trang chung); CSS in kẻ viền mọi ô nên hai bảng đầu/cuối phải border:0 từng ô. */
    return `<table style="width:100%;font-size:13px;border:0;margin-top:0;"><tr>
        <td style="width:50%;text-align:center;vertical-align:top;border:0;"><b>${escapeHtml(ct.ten || '')}</b></td>
        <td style="width:50%;text-align:center;vertical-align:top;border:0;"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b><u>Độc lập - Tự do - Hạnh phúc</u></b></td>
      </tr></table>
      <h2 style="text-align:center;margin:18px 0 2px;">${escapeHtml(TIEU_DE_DON[r.Loai] || 'GIẤY NGHỈ')}</h2>
      <p style="text-align:center;margin:0 0 14px;font-size:12px;">Số: ${escapeHtml(r.SoPhieu || '')}</p>
      <p><b>Kính gửi:</b> Ban Giám đốc ${escapeHtml(ct.ten || 'Công ty')}${r.NguoiDuyet ? `;<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Trưởng bộ phận ${escapeHtml(r.TenBoPhan || '')} — ${escapeHtml(r.NguoiDuyet)}` : ''}.</p>
      <p>Tôi tên là: <b>${escapeHtml(r.HoTen || '')}</b>${r.MaNhanVien ? ` — Mã NV: ${escapeHtml(r.MaNhanVien)}` : ''}${r.TenBoPhan ? ` — Bộ phận: ${escapeHtml(r.TenBoPhan)}` : ''}${r.ChucVu ? ` — Chức vụ: ${escapeHtml(r.ChucVu)}` : ''}.</p>
      <p>Tôi làm giấy này xin được <b>${escapeHtml(loai.toLowerCase())}</b> từ ngày <b>${ddmm(r.TuNgay)}</b> đến hết ngày <b>${ddmm(r.DenNgay)}</b> (<b>${num(r.SoNgay)}</b> ngày làm việc, không tính Chủ nhật và ngày lễ).</p>
      <p>Lý do: ${escapeHtml(r.LyDo || '........................................................................')}</p>
      <p>Tôi đã bàn giao công việc trong thời gian nghỉ và cam kết trở lại làm việc đúng hạn. Kính mong Ban Giám đốc và Trưởng bộ phận xem xét, chấp thuận.</p>
      <p style="text-align:right;margin-top:10px;"><i>Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}</i></p>
      <table style="width:100%;margin-top:10px;font-size:13px;text-align:center;border:0;"><tr>
        <td style="width:50%;border:0;"><b>TRƯỞNG BỘ PHẬN</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>${escapeHtml(r.NguoiDuyet || '')}</td>
        <td style="width:50%;border:0;"><b>NGƯỜI XIN NGHỈ</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br>${escapeHtml(r.HoTen || '')}</td>
      </tr></table>`;
  }
  /* === v9.55 NGHI LE + PHIEU NGHI — KET THUC === */

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
    /* v7.97: tổng cộng CHÍNH TỪ `rows` đang hiển thị — không gọi thêm API tổng hợp nào, để con số
       dưới bảng không bao giờ lệch với các dòng ngay trên nó (cùng nguyên tắc đã áp cho sổ công nợ
       v7.82: in/tổng đúng cái đang xem). Làm tròn 2 chữ số để 0.1+0.2 không ra 0.30000000000000004. */
    const lamTron2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
    const tongCC = rows.reduce((a, r) => ({
      gioLam: a.gioLam + num(r.SoGioLam), cong: a.cong + num(r.SoCong),
      tcT: a.tcT + num(r.GioTangCaThuong), tcCN: a.tcCN + num(r.GioTangCaChuNhat), tcLe: a.tcLe + num(r.GioTangCaLeTet)
    }), { gioLam: 0, cong: 0, tcT: 0, tcCN: 0, tcLe: 0 });
    Object.keys(tongCC).forEach(k => { tongCC[k] = lamTron2(tongCC[k]); });
    const coSuaChamCong = !!perm.canEdit;
    /* Xuất Excel: thẻ <a> tải trực tiếp (giống nút "File mẫu" đã có) — route là 'view' nên người chỉ
       được xem cũng xuất được đúng bảng họ đang nhìn. */
    const nutXuatExcel = `<a class="btn small secondary" style="margin-right:auto;" href="/api/payroll/chamcong/${encodeURIComponent(nhanVienId)}/excel?nam=${selNam}&thang=${selThang}">📊 Xuất Excel</a>`;
    const html = `<h3>Chấm công chi tiết — ${escapeHtml(ten)} (T${selThang}/${selNam})</h3>
      <table style="font-size:13px;"><thead><tr><th>Ngày</th><th>Mã</th><th>Giờ vào</th><th>Giờ ra</th><th>Giờ làm</th><th>Số công</th><th>Giờ TC thường</th><th>Giờ TC CN</th><th>Giờ TC lễ</th><th>Nguồn</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.MaCham || '')}</td>
        <td style="text-align:center;">${escapeHtml(fmtGio(r.GioVao))}</td>
        <td style="text-align:center;">${escapeHtml(fmtGio(r.GioRa))}</td>
        <td style="text-align:right;">${r.SoGioLam != null ? num(r.SoGioLam) : ''}</td>
        <td style="text-align:right;font-weight:600;">${num(r.SoCong)}</td><td style="text-align:right;">${num(r.GioTangCaThuong)}</td><td style="text-align:right;">${num(r.GioTangCaChuNhat)}</td><td style="text-align:right;">${num(r.GioTangCaLeTet)}</td><td>${escapeHtml(r.Nguon || '')}</td></tr>`).join('') || `<tr><td colspan="10" class="empty-hint">Chưa có ngày chấm công.</td></tr>`}
      ${/* v7.97 — DÒNG TỔNG.
           Ô nhãn GỘP 4 CỘT (Ngày+Mã+Giờ vào+Giờ ra) rồi mới tới 5 cột số + 1 ô Nguồn = đủ 10 cột.
           ⚠️ themCotStt() (common.js) chèn cột STT vào MỌI bảng: dòng này vẫn được thêm 1 ô cho thẳng
           cột nhưng KHÔNG bị đánh dấu data-stt vì ô đầu là ô GỘP (__laDongDuLieu trả false) — nên nhãn
           "TỔNG CỘNG" không bị danhLaiStt() ghi số lên. Đúng cái đã vỡ ở v7.91, nay đã có chốt. */''}
      ${rows.length ? `<tr data-tong style="background:#f1f3f4;font-weight:600;">
        <td colspan="4" style="text-align:right;">TỔNG CỘNG (${rows.length} ngày)</td>
        <td style="text-align:right;">${fmtNumber(tongCC.gioLam)}</td>
        <td style="text-align:right;">${fmtNumber(tongCC.cong)}</td>
        <td style="text-align:right;">${fmtNumber(tongCC.tcT)}</td>
        <td style="text-align:right;">${fmtNumber(tongCC.tcCN)}</td>
        <td style="text-align:right;">${fmtNumber(tongCC.tcLe)}</td>
        <td></td>
      </tr>` : ''}</tbody></table>
      ${coSuaChamCong ? `<h4 style="margin:14px 0 6px;">Thêm / sửa 1 ngày</h4>
      <form id="ccForm"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px 16px;">
        <div class="form-row" style="margin:0;"><label>Ngày *</label><input type="date" id="d_ngay" required></div>
        <div class="form-row" style="margin:0;"><label>Mã (x / P phép / KL không lương / TS thai sản / TN tai nạn / LT lễ hưởng lương)</label><input id="d_ma" value="x"></div>
        ${/* v10.01 (Nguyen 23/11: "Số công đang chỉ nhập được 1 và 0.5, có thể nhập 0.7 0.8"):
             step="0.5" khiến trình duyệt CHẶN mọi số không chia hết cho 0,5 — gõ 0.7 là báo "không hợp lệ"
             và không lưu được. Đổi sang step="any" ⇒ nhập số bất kỳ. Cột trong CSDL vốn đã chịu được:
             ChamCongNgay.SoCong DECIMAL(4,2), GioTangCa* DECIMAL(5,2) — nên KHÔNG cần migration.
             min="0" vì công / giờ tăng ca âm không có nghĩa (sửa sai thì ghi đè, không ghi số âm). */''}
        <div class="form-row" style="margin:0;"><label>Số công</label><input type="number" step="any" min="0" id="d_cong" value="1"></div>
        <div class="form-row" style="margin:0;"><label>Giờ TC thường</label><input type="number" step="any" min="0" id="d_tcT" value="0"></div>
        <div class="form-row" style="margin:0;"><label>Giờ TC chủ nhật</label><input type="number" step="any" min="0" id="d_tcCN" value="0"></div>
        <div class="form-row" style="margin:0;"><label>Giờ TC lễ</label><input type="number" step="any" min="0" id="d_tcLe" value="0"></div>
      </div>
      <div class="modal-actions">${nutXuatExcel}<button type="button" class="btn small secondary" id="btnPNcuaNV" title="Sang tab Tạo giấy nghỉ phép / Nghỉ cá nhân, chọn sẵn người này">🏖️ Tạo giấy nghỉ cho người này</button><button type="button" class="btn secondary" id="btnClose">Đóng</button><button type="submit" class="btn">Lưu ngày</button></div></form>`
      : `<div class="modal-actions">${nutXuatExcel}<button type="button" class="btn secondary" id="btnClose">Đóng</button></div>`}`;
    const modal = openModal(html);
    modal.querySelector('#btnClose').addEventListener('click', closeModal);
    /* v9.57: giấy nghỉ là tab riêng — đóng modal, nhớ người đang xem rồi chuyển tab (switchModule của app.js). */
    const bPNnv = modal.querySelector('#btnPNcuaNV');
    if (bPNnv) bPNnv.addEventListener('click', () => {
      closeModal(); nvMacDinhNghiPhep = nhanVienId;
      if (typeof switchModule === 'function') switchModule('PAYROLL', 'nghiphep'); else render(container, currentUser, 'nghiphep');
    });
    // v7.97: người chỉ có quyền XEM thì không có #ccForm — phải kiểm, không thì throw giữa chừng và
    // modal "không có gì xảy ra" (đúng họ lỗi async handler tắt lặng đã ghi nhận nhiều lần).
    const fCC = modal.querySelector('#ccForm');
    if (fCC) fCC.addEventListener('submit', async e => {
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

  /* ================================================================================================
     2b. NGÀY NGHỈ THEO NĂM (v10.01 — Nguyen 23/11: "Thêm chức năng xem ngày nghỉ phép của nhân viên
     trong 1 năm. Tổng cộng bao nhiêu ngày đã nghỉ.")
     ------------------------------------------------------------------------------------------------
     Một hàng một người: 12 tháng PHÉP + tổng phép + KL/TS/TN + TỔNG ĐÃ NGHỈ. Bấm một hàng ra danh
     sách TỪNG NGÀY. Số đếm do máy chủ gộp từ `ChamCongNgay` theo đúng luật của bảng lương
     (`soNgayNghiCuaDong`: có SoCong > 0 thì lấy chính nó — giấy nửa ngày = 0,5 — không thì trọn 1).
     Hiện CẢ người chưa nghỉ ngày nào (số 0 cũng là câu trả lời), nên không lọc bớt hàng.
     ================================================================================================ */
  const soNgay = (v) => { const n = Math.round((Number(v) || 0) * 100) / 100; return n ? String(n).replace('.', ',') : ''; };
  async function renderNghiPhepNam() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/chamcong/nghiphepnam?nam=${selNam}`)).data; }
    catch (e) {
      container.innerHTML = periodBarYearOnly() + `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`;
      wireNamNghi(); return;
    }
    const rows = d.rows || [], tc = d.tongCong || {};
    const THANG = Array.from({ length: 12 }, (_, i) => i + 1);
    /* 🔴 v10.02 (Nguyen 23/11: "Cố định phần này... cố định phần tiêu đề trở lên thành 1 khối khi cuộn trang"):
       bọc ô chọn năm + tiêu đề + dòng tổng vào .toolbar — common.js (capNhatThanhCongCuDinh) tự gắn
       class .sticky-bar cho thanh NẰM Ở ĐẦU vùng cuộn và đo chiều cao vào biến --bar-h, nên dòng tiêu
       đề bảng dính NGAY DƯỚI khối này. Dùng đúng cơ chế sẵn có, KHÔNG viết position:sticky lần thứ hai.
       ⚠️ Vì vậy bảng KHÔNG được bọc trong div overflow:auto nữa — vùng cuộn phải là chính .content,
       nếu không common.js sẽ đặt lại --bar-h = 0 cho div đó và tiêu đề bảng hết dính. */
    container.innerHTML = `<div class="toolbar" style="display:block;">
      ${periodBarYearOnly()}
      <h4 style="margin:4px 0;">Ngày nghỉ năm ${d.nam} <span style="font-weight:400;font-size:12px;color:#5f6368;">(bấm một dòng để xem từng ngày nghỉ)</span></h4>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px;">
        <div>Tổng <b>phép</b> cả công ty: <b style="color:#1a73e8;">${soNgay(tc.P) || '0'}</b> ngày</div>
        <div>Không lương: <b>${soNgay(tc.KL) || '0'}</b></div>
        <div>Thai sản: <b>${soNgay(tc.TS) || '0'}</b></div>
        <div>Tai nạn: <b>${soNgay(tc.TN) || '0'}</b></div>
        <div style="color:#c0392b;">Không phép: <b>${soNgay(tc.khongPhep) || '0'}</b></div>
        <div>TỔNG đã nghỉ: <b>${soNgay(tc.tong) || '0'}</b> ngày</div>
      </div></div>
      <table style="font-size:13px;"><thead>
        <tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Bộ phận</th>
        ${THANG.map(t => `<th style="text-align:right;width:34px;" title="Phép tháng ${t}">T${t}</th>`).join('')}
        <th style="text-align:right;">Tổng phép</th><th style="text-align:right;">KL</th><th style="text-align:right;">TS</th><th style="text-align:right;">TN</th>
        <th style="text-align:right;" title="Ngày làm việc mà máy chấm công không kéo về dòng nào và cũng không có giấy nghỉ">Không phép</th>
        <th style="text-align:right;" title="Chủ nhật của người có hợp đồng ghi bộ phận nghỉ CN">Nghỉ CN</th>
        <th style="text-align:right;">TỔNG đã nghỉ</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr data-nv="${r.NhanVienID}" data-ten="${escapeHtml(r.HoTen || '')}" style="cursor:pointer;">
        <td style="text-align:center;">${i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen || '')}</td><td>${escapeHtml(r.TenBoPhan || '')}</td>
        ${THANG.map(t => `<td style="text-align:right;">${soNgay((r.thangPhep || [])[t - 1])}</td>`).join('')}
        <td style="text-align:right;font-weight:600;color:#1a73e8;">${soNgay(r.theoMa && r.theoMa.P)}</td>
        <td style="text-align:right;">${soNgay(r.theoMa && r.theoMa.KL)}</td>
        <td style="text-align:right;">${soNgay(r.theoMa && r.theoMa.TS)}</td>
        <td style="text-align:right;">${soNgay(r.theoMa && r.theoMa.TN)}</td>
        <td style="text-align:right;color:#c0392b;font-weight:600;">${soNgay(r.khongPhep)}</td>
        <td style="text-align:right;color:#5f6368;" title="${r.lamCaCN ? 'Hợp đồng tính cả chủ nhật — CN không phải ngày nghỉ' : 'Bộ phận nghỉ CN'}">${r.lamCaCN ? '—' : soNgay(r.nghiCN)}</td>
        <td style="text-align:right;font-weight:700;">${soNgay(r.tongTatCa)}</td></tr>`).join('')
        || '<tr><td colspan="23" class="empty-hint">Không có nhân viên nào đang làm việc.</td></tr>'}</tbody>
      ${rows.length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td>
        ${THANG.map(t => `<td style="text-align:right;">${soNgay(rows.reduce((s, r) => s + Number((r.thangPhep || [])[t - 1] || 0), 0))}</td>`).join('')}
        <td style="text-align:right;">${soNgay(tc.P)}</td><td style="text-align:right;">${soNgay(tc.KL)}</td><td style="text-align:right;">${soNgay(tc.TS)}</td><td style="text-align:right;">${soNgay(tc.TN)}</td>
        <td style="text-align:right;color:#c0392b;">${soNgay(tc.khongPhep)}</td><td style="text-align:right;color:#5f6368;">${soNgay(tc.nghiCN)}</td>
        <td style="text-align:right;">${soNgay(tc.tong)}</td></tr></tfoot>` : ''}</table>
      ${Number(d.ngayNghiViecBoQua) ? `<p style="color:#b06000;font-size:12px;margin-top:8px;">Có <b>${soNgay(d.ngayNghiViecBoQua)}</b> ngày nghỉ trong năm ${d.nam} thuộc về người <b>đã nghỉ việc</b> — bảng này chỉ liệt kê nhân viên đang làm nên không cộng vào.</p>` : ''}
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Phép / KL / TS / TN gộp từ <b>bảng chấm công</b> — cùng nguồn, cùng cách đếm với bảng lương nên khớp dòng "Ngày phép" trên phiếu lương; giấy nghỉ <b>nửa ngày</b> tính <b>0,5</b>.
      <b>Không phép</b> = ngày làm việc (T2…T7, trừ lễ) mà máy chấm công <b>không kéo về dòng nào</b> và cũng <b>không có giấy nghỉ</b> — đúng bộ đếm của cột "Không phép" trên bảng lương từng tháng; chỉ tính tới <b>hôm nay</b> và từ <b>ngày vào làm</b>.
      <b>Nghỉ CN</b> chỉ đếm cho người có hợp đồng tích <i>bộ phận nghỉ CN</i>; người làm cả CN hiện "—". Nghỉ CN <b>không</b> cộng vào TỔNG (là ngày nghỉ theo lịch, không phải nghỉ việc riêng). Cột T1…T12 chỉ là <b>phép</b>.</p>`;
    wireNamNghi();
    themOTimTuDong(container);
    /* Ô tìm do themOTimTuDong sinh ra nằm NGAY TRÊN bảng ⇒ kéo nó vào khối cố định để cả cụm cùng
       đứng yên khi cuộn (đúng vùng Nguyen khoanh trong ảnh). */
    const tb = container.querySelector('table');
    const hopTim = tb && tb.dataset.oTimHop ? container.querySelector('#' + tb.dataset.oTimHop) : null;
    const khoi = container.querySelector('.toolbar');
    if (hopTim && khoi) khoi.appendChild(hopTim);
    container.querySelectorAll('tbody tr[data-nv]').forEach(tr => tr.addEventListener('click', () => moChiTietNghiNam(tr.dataset.nv, tr.dataset.ten)));
  }
  function wireNamNghi() {
    const o = container.querySelector('#ccNam');
    if (o) o.addEventListener('change', e => { selNam = parseInt(e.target.value, 10); renderNghiPhepNam(); });
  }
  async function moChiTietNghiNam(nhanVienId, ten) {
    let d;
    try { d = (await apiGet(`/api/payroll/chamcong/nghiphepnam/${nhanVienId}?nam=${selNam}`)).data; }
    catch (e) { toast(e.message, 'error'); return; }
    const rows = d.rows || [], loai = d.loai || {}, tm = d.theoMa || {};
    const nv = d.nhanVien || {};
    /* v10.02: "hiện rõ phép, ko phép" — ô tóm tắt từng loại ở đầu, rồi danh sách ngày đã TRỘN cả
       ngày không phép và nghỉ CN, sắp theo ngày; mỗi loại một màu để nhìn là biết. */
    const o = (nhan, so, mau) => `<div style="border:1px solid #e0e0e0;border-radius:6px;padding:6px 10px;min-width:104px;">
      <div style="font-size:11.5px;color:#5f6368;">${nhan}</div><div style="font-weight:700;font-size:16px;${mau ? 'color:' + mau + ';' : ''}">${soNgay(so) || '0'}</div></div>`;
    const MAU = { P: '#1a73e8', KL: '#5f6368', TS: '#5f6368', TN: '#5f6368', KP: '#c0392b', CN: '#8a8f98' };
    const m = openModal(`<h3>Ngày nghỉ năm ${d.nam} — ${escapeHtml(ten || nv.HoTen || '')}${nv.TenBoPhan ? ` <span style="font-weight:400;font-size:13px;color:#5f6368;">(${escapeHtml(nv.TenBoPhan)})</span>` : ''}</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        ${o('Phép', tm.P, MAU.P)}${o('Không lương', tm.KL)}${o('Thai sản', tm.TS)}${o('Tai nạn', tm.TN)}
        ${o('KHÔNG PHÉP', d.khongPhep, MAU.KP)}${d.lamCaCN ? '' : o('Nghỉ CN', d.nghiCN, MAU.CN)}
        ${o('TỔNG đã nghỉ', d.tongTatCa)}
      </div>
      <div class="empty-hint" style="text-align:left;line-height:1.6;">
        <b>Không phép</b> = ngày làm việc mà máy chấm công không kéo về dòng nào và không có giấy nghỉ (chỉ tính tới hôm nay, từ ngày vào làm).
        ${d.lamCaCN
          ? 'Hợp đồng của người này <b>tính cả chủ nhật</b> nên CN không được xem là ngày nghỉ.'
          : 'Hợp đồng ghi <b>bộ phận nghỉ CN</b> nên chủ nhật xếp vào "nghỉ CN", không phải không phép.'}
        Nghỉ CN <b>không</b> cộng vào TỔNG.</div>
      <div style="overflow:auto;max-height:55vh;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Ngày</th><th>Loại</th><th style="text-align:right;">Số ngày</th><th>Nguồn</th><th>Ghi chú</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td style="text-align:center;">${i + 1}</td><td>${fmtDate(r.Ngay)}</td>
        <td style="color:${MAU[r.Ma] || '#202124'};font-weight:${r.Ma === 'KP' ? '700' : '400'};">${escapeHtml(loai[r.Ma] || r.Ma || '')}</td><td style="text-align:right;">${soNgay(r.SoNgay)}</td>
        <td>${escapeHtml(r.Nguon || '')}</td><td style="font-size:12px;color:#5f6368;">${escapeHtml(r.GhiChu || '')}</td></tr>`).join('')
        || '<tr><td colspan="6" class="empty-hint">Không có ngày nghỉ nào trong năm này.</td></tr>'}</tbody></table></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnDongNghiNam">Đóng</button></div>`);
    m.querySelector('#btnDongNghiNam').addEventListener('click', closeModal);
  }

  /* ================================================================
     3. LUONG CONG NHAT
     ================================================================ */
  /* === v9.53 TU TINH LAI — BAT DAU === */
  /* v9.53 (Nguyen 14/11: "có biến động ngày công, phiếu thu chi hay ký hợp đồng thì tự động tính lương
     luôn, không cần bấm"): máy chủ tự tính lại NGAY TRONG GET /bangluong khi có cờ biến động (hoặc tháng
     này / tháng trước chưa có bảng), trả `tuDong` để nói đã làm gì. Hàm dưới THUẦN TÚY (HTML từ tuDong)
     để bộ kiểm chạy được.
       · daTinhLai  → xanh: "⟳ Đã tự tính lại lúc … vì: …" (+ số người thiếu HĐ / cảnh báo, bấm xem)
       · daChot     → cam: bảng ĐÃ CHỐT nhưng có biến động sau đó — KHÔNG tự tính (luật v9.32)
       · loi        → đỏ: tự tính thất bại, cờ còn, bấm Tính lương để thấy lỗi đầy đủ
       · chuaCoBang → xám: tháng cũ chưa từng có bảng — máy chủ không tự tạo
       · lanCuoi    → xám: lần tính gần nhất (tự động / bấm tay) */
  function fmtLucTuDong(s) {   // 'yyyy-mm-dd hh:mi' (giờ máy chủ, chuỗi) → 'hh:mi dd/mm'
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(String(s || ''));
    return m ? `${m[4]} ${m[3]}/${m[2]}` : escapeHtml(String(s || ''));
  }
  function dongTuTinh(td) {
    if (!td) return '';
    const lyDo = (ds) => (Array.isArray(ds) ? ds : []).map(x => escapeHtml(String(x))).join('; ');
    const hop = (st, nd) => `<div id="blTuDong" style="margin:-4px 0 10px;padding:6px 10px;border-radius:6px;font-size:12.5px;line-height:1.5;${st}">${nd}</div>`;
    if (td.daTinhLai) {
      const kq = td.ketQua || {};
      const thieu = (kq.thieuHopDong || []).length, cb = (kq.canhBao || []).length;
      return hop('background:#e6f4ea;color:#137333;', `⟳ <b>Bảng đã tự tính lại</b> lúc ${fmtLucTuDong(td.luc)} vì: ${lyDo(td.lyDo) || 'có biến động'}.`
        + (thieu || cb ? ` <a href="#" id="blXemKq" style="color:#b06000;font-weight:600;">${thieu ? thieu + ' người chưa có hợp đồng' : ''}${thieu && cb ? ', ' : ''}${cb ? cb + ' cảnh báo' : ''} — xem</a>` : ''));
    }
    if (td.daChot) return hop('background:#fef3e0;color:#b06000;', `⚠ Bảng <b>đã chốt</b> nhưng có biến động sau đó (${fmtLucTuDong(td.luc)}): ${lyDo(td.lyDo)}. Bảng <b>không</b> tự tính lại — số đã chốt giữ nguyên; muốn cập nhật thì bấm <b>🔓 Bỏ chốt</b> (ghi lý do) rồi mở lại tab.`);
    if (td.loi) return hop('background:#fce8e6;color:#c0392b;', `⚠ Tự tính lại <b>thất bại</b>: ${escapeHtml(String(td.loi))}. Biến động chưa vào bảng (${lyDo(td.lyDo)}) — bấm <b>Tính lương</b> để thử lại và xem lỗi.`);
    if (td.chuaCoBang) return hop('background:#f1f3f4;color:#5f6368;', `Tháng này chưa từng có bảng lương nên không tự tạo (chỉ tháng này và tháng trước mới tự tạo) — bấm <b>Tính lương</b> nếu cần.`);
    if (td.lanCuoi && td.lanCuoi.luc) {
      const lc = td.lanCuoi;
      return hop('background:#f1f3f4;color:#5f6368;', `Số liệu đang là mới nhất — tính lần cuối ${fmtLucTuDong(lc.luc)} (${lc.cach === 'tay' ? 'bấm Tính lương' : 'tự động'}${(lc.lyDo || []).length ? ': ' + lyDo(lc.lyDo) : ''}). Bảng tự tính lại khi có biến động chấm công / phiếu chi tạm ứng / hợp đồng / KPI.`);
    }
    return '';
  }
  /* === v9.53 TU TINH LAI — KET THUC === */
  async function renderLuong() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/bangluong?nam=${selNam}&thang=${selThang}`)).data; } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    const daChot = d.header && d.header.TrangThai === 'Đã chốt';
    const tong = (d.rows || []).reduce((s, r) => s + num(r.ThucLinh), 0);
    const actions = `
      ${perm.canEdit && !daChot ? `<button class="btn small" id="btnTinh" title="Tính lại ngay. Bình thường không cần: bảng tự tính lại khi có biến động (v9.53).">🧮 Tính lương</button>` : ''}
      ${d.header && perm.canEdit && !daChot ? `<button class="btn small secondary" id="btnChot">🔒 Chốt bảng lương</button>` : ''}
      ${/* v9.54: bỏ chốt — có lý do, ghi dấu vết vào GhiChu; mở lại tab là tự tính nếu có biến động (v9.53). */''}
      ${d.header && perm.canEdit && daChot ? `<button class="btn small secondary" id="btnBoChot" title="Bỏ chốt để tính lại / sửa — phải ghi lý do">🔓 Bỏ chốt</button>` : ''}
      ${d.header ? `<button class="btn small secondary" id="btnExcel">📊 Xuất Excel</button>
                    <button class="btn small secondary" id="btnCK">🏦 Xuất file CK</button>` : ''}
      ${(d.rows || []).length ? '<button class="btn small secondary" id="btnInCN">🖨️ In bảng lương</button>' : ''}
      ${d.header ? `<span style="margin-left:8px;color:${daChot ? '#137333' : '#b06000'};font-weight:600;" title="${escapeHtml(d.header.GhiChu || '')}">${daChot ? '● Đã chốt' : '● Nháp'}</span>` : ''}
      ${d.header && d.header.GhiChu ? `<span style="font-size:11.5px;color:#5f6368;margin-left:6px;" title="${escapeHtml(d.header.GhiChu)}">📝 ${escapeHtml(String(d.header.GhiChu).split('\n')[0]).slice(0, 90)}</span>` : ''}`;
    /* v9.45: cột theo BẢNG THỰC TẾ T10/2026 (sheet 2) — kiểu lương, công TV/CT, phép, OT, KPI, xăng,
       chức vụ, chuyên cần, BH, thuế (hiện luôn, cột "trừ" nói có vào thực lĩnh không), tạm ứng, điều
       chỉnh có lý do. Dòng chưa có cột v890 (bảng tính trước migration) thì các ô mới trống. */
    const tongTU = (d.rows || []).reduce((s, r) => s + num(r.TamUng), 0);
    const tongDC = (d.rows || []).reduce((s, r) => s + num(r.DieuChinh), 0);
    const coV890 = (d.rows || []).some(r => r.KieuLuong != null);
    /* v9.73: KieuThuong là chuỗi tập hợp "KPI,SanPham,ChuyenCan" — nhãn ngắn KPI+SP+CC, tooltip đủ chữ. */
    const nhanKT = (k) => String(k || '').split(/[,;|\s]+/).filter(Boolean).map(x => x === 'KPI' ? 'KPI' : x === 'SanPham' ? 'SP' : x === 'ChuyenCan' ? 'CC' : x).join('+');
    const coKT = (k, x) => String(k || '').includes(x);
    container.innerHTML = periodBar(null, actions) + dongTuTinh(d.tuDong) + `
      <div style="overflow:auto;"><table style="font-size:12px;min-width:1700px;"><thead><tr><th style="width:38px;">STT</th>
        <th>Mã NV</th><th>Họ tên</th><th>Kiểu</th><th title="Công thử việc (× tỷ lệ thử việc)">Công TV</th><th title="Công chính thức (gồm lễ hưởng lương)">Công CT</th><th>Phép</th><th title="Số ngày đi muộn — một ngày là mất chuyên cần">Muộn</th>
        <th title="v9.55: ngày làm việc (T2–T7, trừ CN + lễ chung, từ ngày vào làm, tới hôm nay) không có chấm công, không phép, không nghỉ KL/TS/TN. Chỉ để đối chiếu, không trừ tiền.">Không phép</th>
        <th title="Lương tháng (kiểu Tháng) hoặc đơn giá ngày (kiểu Ngày)">Lương CB / ĐG ngày</th><th>Lương</th><th>Giờ OT</th><th>Tiền OT</th>
        <th title="Theo Kiểu thưởng trên hợp đồng: KPI / sản phẩm / chuyên cần bậc thang (CC)">Thưởng KPI/SP/CC</th><th>Xăng xe</th><th>Chức vụ</th><th title="Phụ cấp chuyên cần cố định — hợp đồng kiểu thưởng Chuyên cần bậc thang thì khoản này bỏ qua">Chuyên cần</th><th title="10,5% × mức đóng BH khai ở hợp đồng">BH</th>
        <th title="Thuế TNCN TÍNH ra. Có trừ vào thực lĩnh hay không là công tắc ở Cấu hình lương.">Thuế TNCN</th><th>Tạm ứng</th><th>Điều chỉnh</th><th>Thực lĩnh</th>
      </tr></thead><tbody>${(d.rows || []).map((r, __i) => `<tr class="cn-nv" data-id="${r.ID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}${nhanKT(r.KieuThuong) ? ` <span style="font-size:10px;color:#5f6368;">(${nhanKT(r.KieuThuong)})</span>` : ''}</td>
        <td style="text-align:center;">${r.KieuLuong === 'Ngay' ? 'Ngày' : (r.KieuLuong ? 'Tháng' : '')}</td>
        <td style="text-align:right;">${r.CongThuViec != null ? num(r.CongThuViec) : ''}</td>
        <td style="text-align:right;">${r.CongChinhThuc != null ? num(r.CongChinhThuc) : num(r.Cong)}</td>
        <td style="text-align:right;${num(r.SoPhep) > 0 ? 'color:#b06000;' : ''}">${r.SoPhep != null ? num(r.SoPhep) : ''}</td>
        <td style="text-align:right;${num(r.SoNgayMuon) > 0 ? 'color:#c0392b;' : ''}">${r.SoNgayMuon != null ? num(r.SoNgayMuon) : ''}</td>
        ${/* v9.55: không phép — đỏ khi > 0; dòng tính trước migration_v892 thì trống. v9.58: rê chuột thấy ĐÚNG những ngày bị đếm. */''}
        <td style="text-align:right;${num(r.SoKhongPhep) > 0 ? 'color:#c0392b;font-weight:600;' : ''}" title="${(r.ngayKhongPhep || []).length ? 'Không phép: ' + r.ngayKhongPhep.map(ddmm).join(', ') : (r.SoKhongPhep != null ? 'Không có ngày không phép' : '')}">${r.SoKhongPhep != null ? num(r.SoKhongPhep) : ''}</td>
        <td style="text-align:right;">${r.KieuLuong === 'Ngay' ? money(r.DonGiaNgay) : money(r.LuongCoBan)}</td>
        <td style="text-align:right;">${money(r.LuongNgayCong)}</td>
        <td style="text-align:right;">${r.GioOT != null ? num(r.GioOT) : ''}</td><td style="text-align:right;">${money(r.TangCa)}</td>
        <td style="text-align:right;" title="${[r.DiemKPI != null ? 'Điểm KPI ' + num(r.DiemKPI) + '/100' : '', coKT(r.KieuThuong, 'SanPham') ? 'có thưởng theo sản phẩm' : '', coKT(r.KieuThuong, 'ChuyenCan') ? 'có thưởng chuyên cần bậc thang' : ''].filter(Boolean).join(' · ')}">${money(r.Thuong)}${coKT(r.KieuThuong, 'KPI') && r.DiemKPI == null ? ' <span title="Chưa chấm KPI tháng này" style="color:#c0392b;">⚠️</span>' : ''}</td>
        <td style="text-align:right;">${money(r.PcXangXe)}</td><td style="text-align:right;">${money(r.PcChucVu)}</td><td style="text-align:right;">${money(r.ChuyenCan)}</td>
        <td style="text-align:right;">${money(r.TongBH)}</td>
        <td style="text-align:right;color:${r.ThueDaTru ? 'inherit' : '#8a8a8a'};" title="${r.ThueDaTru ? 'ĐÃ trừ vào thực lĩnh' : 'CHƯA trừ vào thực lĩnh (công tắc đang tắt)'}">${money(r.ThueTNCN)}${r.ThueDaTru ? '' : ' <span style="font-size:10px;">(không trừ)</span>'}</td>
        ${/* v9.32: tạm ứng = tổng phiếu chi loại "Tạm ứng" của tháng, KHÔNG gõ tay. Bấm số để xem từng phiếu. */''}
        <td style="text-align:right;">${num(r.TamUng) > 0
          ? `<a href="#" class="tu-xem" data-nv="${r.NhanVienID}" title="Xem các phiếu chi tạm ứng">${money(r.TamUng)}</a>`
          : money(r.TamUng)}</td>
        ${/* v9.45: điều chỉnh ± có lý do — bấm để sửa (bảng chưa chốt). GIỮ qua lần tính lại. */''}
        <td style="text-align:right;${num(r.DieuChinh) < 0 ? 'color:#c0392b;' : (num(r.DieuChinh) > 0 ? 'color:#137333;' : '')}" title="${escapeHtml(r.LyDoDieuChinh || '')}">
          ${perm.canEdit && !daChot && coV890 ? `<a href="#" class="dc-sua" data-id="${r.ID}">${num(r.DieuChinh) ? money(r.DieuChinh) : '±'}</a>` : (num(r.DieuChinh) ? money(r.DieuChinh) : '')}</td>
        ${/* v9.32: thực lĩnh ÂM (ứng nhiều hơn lương) phải đỏ và nói lý do — bị loại khỏi file CK. */''}
        <td style="text-align:right;font-weight:600;${num(r.ThucLinh) < 0 ? 'color:#c0392b;' : ''}"
            ${num(r.ThucLinh) < 0 ? 'title="Tạm ứng nhiều hơn lương — dòng này KHÔNG vào file chuyển khoản"' : ''}>${money(r.ThucLinh)}${num(r.ThucLinh) < 0 ? ' ⚠️' : ''}</td>
      </tr>`).join('') || `<tr><td colspan="22" class="empty-hint">${d.header ? 'Bảng lương chưa có dòng nào — chưa ai có hợp đồng hiệu lực tháng này (Nhân sự → Hợp đồng lao động).' : 'Chưa có bảng lương tháng này. Bấm "Tính lương" để tạo.'}</td></tr>`}</tbody>
      ${(d.rows || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="18" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tongTU)}</td><td style="text-align:right;">${tongDC ? money(tongDC) : ''}</td><td style="text-align:right;">${money(tong)}</td></tr></tfoot>` : ''}
      </table></div>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">
        <b>Nguồn số:</b> thông số lương lấy từ <b>hợp đồng đang hiệu lực</b> (Nhân sự → Hợp đồng: kiểu lương Ngày/Tháng, đơn giá ngày hoặc lương CB, mức đóng BH, quỹ KPI, chức vụ, chuyên cần, xăng xe, ngày hết thử việc) — <b>người chưa có hợp đồng thì KHÔNG có trong bảng</b> (danh sách hiện lên sau mỗi lần tính).
        Công, phép, đi muộn, giờ OT lấy từ <b>Chấm công</b>. Điểm KPI / số sản phẩm lấy từ tab <b>Đánh giá KPI</b>.
        <b>Bảng tự tính lại</b> khi mở tab này sau mỗi biến động (chấm công, phiếu chi tạm ứng, hợp đồng, KPI, cấu hình) — trừ bảng đã chốt. Nút Tính lương chỉ để tính lại ngay khi muốn.
        <br><b>OT</b> = lương cơ bản ÷ số giờ một ngày × hệ số (cấu hình, mặc định 1,5) × giờ OT — một công thức cho mọi người. <b>Chuyên cần</b> mất khi có phép, thiếu công chuẩn, hoặc đi muộn dù một ngày. <b>Xăng</b> = phụ cấp xăng xe (đ/NGÀY, khai trên hợp đồng) × ngày đi làm thực tế (không tính phép, lễ).
        <br><b>Tạm ứng</b> lấy tự động từ <b>Công nợ → Phiếu chi</b> loại Tạm ứng — bấm con số để xem từng phiếu. <b>Điều chỉnh</b> ± bắt buộc ghi lý do, được giữ nguyên khi tính lại. Thực lĩnh làm tròn theo cấu hình (mặc định nghìn đồng).
      </p>`;
    wirePeriod(container, renderLuong);
    themOTimTuDong(container);   // v9.05: ô tìm Mã NV / Họ tên trên bảng lương công nhật
    const bTinh = container.querySelector('#btnTinh'); if (bTinh) bTinh.addEventListener('click', tinhLuong);
    const bChot = container.querySelector('#btnChot'); if (bChot) bChot.addEventListener('click', () => chotLuong(d.header.BangLuongID));
    const bBoChot = container.querySelector('#btnBoChot'); if (bBoChot) bBoChot.addEventListener('click', () => boChotLuong(d.header));   // v9.54
    // v9.53: bảng vừa tự tính lại mà có người thiếu hợp đồng / cảnh báo thì xem được đúng hộp như lúc bấm Tính lương.
    const aXemKq = container.querySelector('#blXemKq');
    if (aXemKq) aXemKq.addEventListener('click', (e) => { e.preventDefault(); hienKetQuaTinh((d.tuDong && d.tuDong.ketQua) || {}, 'Bảng đã tự tính lại'); });
    const bEx = container.querySelector('#btnExcel'); if (bEx) bEx.addEventListener('click', () => downloadFile(`/api/payroll/bangluong/excel?nam=${selNam}&thang=${selThang}`, `BangLuong_T${selThang}_${selNam}.xlsx`));
    const bCK = container.querySelector('#btnCK'); if (bCK) bCK.addEventListener('click', () => downloadFile(`/api/payroll/bangluong/ck?nam=${selNam}&thang=${selThang}`, `CK_Luong_T${selThang}_${selNam}.xlsx`));
    /* v9.32: bấm vào số tạm ứng -> xem ĐÚNG những phiếu chi tạo nên con số đó. "Tự tính" mà không
       soi được từng phiếu thì với kế toán nó là hộp đen, và nhân viên hỏi "sao trừ tôi ngần này"
       thì không ai trả lời được. */
    container.querySelectorAll('.tu-xem').forEach(a => a.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      const nvId = a.dataset.nv;
      const r = (d.rows || []).find(x => String(x.NhanVienID) === String(nvId)) || {};
      let kq;
      try { kq = (await apiGet(`/api/payroll/bangluong/tamung/${nvId}?nam=${selNam}&thang=${selThang}`)).data; }
      catch (err) { toast(err.message, 'error'); return; }
      const m = openModal(`<h3>Tạm ứng tháng ${selThang}/${selNam} — ${escapeHtml(r.HoTen || '')}</h3>
        <table><thead><tr><th style="width:38px;">STT</th><th>Số phiếu</th><th>Ngày chi</th><th>Hình thức</th><th>Diễn giải</th><th style="text-align:right;">Số tiền</th></tr></thead>
        <tbody>${(kq.rows || []).map((x, i) => `<tr><td style="text-align:center;">${i + 1}</td>
          <td>${escapeHtml(x.SoPhieu || '')}</td><td>${fmtDate(x.NgayChi)}</td>
          <td>${escapeHtml(x.HinhThuc || '')}</td><td>${escapeHtml(x.DienGiai || '')}</td>
          <td style="text-align:right;">${money(x.SoTien)}</td></tr>`).join('')
          || '<tr><td colspan="6" class="empty-hint">Không có phiếu chi tạm ứng nào.</td></tr>'}</tbody>
        <tfoot><tr style="font-weight:700;"><td colspan="5" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(kq.tong)}</td></tr></tfoot></table>
        <div class="empty-hint" style="text-align:left;margin-top:6px;">Sửa số ở <b>Công nợ → Phiếu chi</b> — mở lại tab này là bảng tự tính lại (v9.53).</div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Đóng</button></div>`);
      m.querySelector('#btnCancel').addEventListener('click', closeModal);
    }));
    /* v9.45: sửa ĐIỀU CHỈNH ± của một dòng — bắt buộc lý do khi khác 0 (máy chủ cũng chặn). Không
       gọi lại bộ tính: máy chủ dịch thực lĩnh đúng phần chênh từ các cột đã lưu. */
    container.querySelectorAll('.dc-sua').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = (d.rows || []).find(x => String(x.ID) === String(a.dataset.id)) || {};
      const m = openModal(`<h3>Điều chỉnh lương — ${escapeHtml(r.HoTen || '')}</h3>
        <div class="form-grid">
          <div class="form-group"><label>Số tiền (+ cộng thêm / − trừ bớt)</label>
            <input type="number" id="dcTien" step="1000" value="${num(r.DieuChinh) || ''}" placeholder="VD: -200000"></div>
          <div class="form-group" style="grid-column:1/-1;"><label>Lý do <span style="color:#c0392b;">*</span></label>
            <input type="text" id="dcLyDo" maxlength="255" value="${escapeHtml(r.LyDoDieuChinh || '')}" placeholder="VD: Nghỉ nhiều không xin phép"></div>
        </div>
        <div class="empty-hint" style="text-align:left;">Thực lĩnh hiện tại: <b>${money(r.ThucLinh)}</b>. Khoản này được <b>giữ nguyên</b> qua mọi lần tính lại (tự động hay bấm Tính lương). Đặt 0 để bỏ.</div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="dcHuy">Hủy</button>
          <button type="button" class="btn" id="dcLuu">💾 Lưu</button>
        </div>`);
      m.querySelector('#dcHuy').addEventListener('click', closeModal);
      m.querySelector('#dcLuu').addEventListener('click', async () => {
        const dieuChinh = Math.round(Number(m.querySelector('#dcTien').value) || 0);
        const lyDoDieuChinh = m.querySelector('#dcLyDo').value.trim();
        if (dieuChinh !== 0 && !lyDoDieuChinh) { toast('Điều chỉnh khác 0 thì phải ghi lý do.', 'error'); return; }
        try { await apiPut(`/api/payroll/bangluong/chitiet/${r.ID}`, { dieuChinh, lyDoDieuChinh }); closeModal(); toast('Đã lưu điều chỉnh.', 'success'); renderLuong(); }
        catch (err) { toast(err.message, 'error'); }
      });
    }));
    // v5.91 (rà soát): in cả bảng + bấm 1 dòng để xem/in PHIẾU LƯƠNG riêng của nhân viên đó.
    const bInCN = container.querySelector('#btnInCN');
    if (bInCN) bInCN.addEventListener('click', () => printHtml(`Bang luong cong nhat T${selThang}/${selNam}`, buildLuongCongNhatBangBody(d, tong)));
    container.querySelectorAll('.cn-nv').forEach(tr => tr.addEventListener('click', (e) => {
      // Bấm vào link tạm ứng / điều chỉnh thì link đã tự xử lý (stopPropagation) — còn lại mở phiếu lương.
      if (e.target && e.target.closest && e.target.closest('a')) return;
      openLuongCongNhatNVDetail(tr.dataset.id, d);
    }));
  }

  /* v5.91 (rà soát) — LƯƠNG CÔNG NHẬT: trước đây tab này KHÔNG in được và không xem chi tiết được từng
     người (chỉ có Excel + file chuyển khoản). Nay bấm 1 dòng ra phiếu lương cá nhân có nút In. */
  /* v8.06 — data-tong trên MỌI dòng TỔNG của file này (buildLuongCongNhatBangBody trở xuống).
     Các bảng in ở đây tự viết sẵn cột STT (không nhờ common.js chèn), nên dòng TỔNG luôn mở đầu bằng
     MỘT Ô TRỐNG cho thẳng cột STT rồi mới tới ô gộp "TỔNG". Cột STT tự động (common.js) chỉ nhận ra
     ô GỘP nếu nó nằm Ở VỊ TRÍ ĐẦU DÒNG — ô trống đứng trước làm nó "nhìn không ra", nên trước đây
     những dòng TỔNG này bị đánh số y như một dòng lương thật. Cùng lớp lỗi với Báo cáo kinh doanh. */
  /* v9.45: bảng in theo cột của BẢNG THỰC TẾ + ba chữ ký (Người lập / Kế toán trưởng / Giám đốc) như
     sheet 2 T10/2026. Thuế chỉ in khi có trừ (công tắc bật) — bảng thực tế không có cột thuế. */
  function buildLuongCongNhatBangBody(d, tong) {
    const rows = d.rows || [];
    const coThue = rows.some(r => r.ThueDaTru);
    const sum = (k) => rows.reduce((s, r) => s + num(r[k]), 0);
    const td = (v) => `<td style="text-align:right;">${v}</td>`;
    const nCot = 18 + (coThue ? 1 : 0);   // v9.55: + Không phép
    return `<h2 style="text-align:center;margin-bottom:2px;">BẢNG LƯƠNG CÔNG NHẬT — Tháng ${selThang}/${selNam}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px;" border="1" cellpadding="3"><thead><tr><th style="width:30px;">STT</th>
        <th>Họ tên</th><th>Kiểu</th><th>Công TV</th><th>Công CT</th><th>Phép</th><th>Không phép</th><th>Lương CB / ĐG</th><th>Lương</th><th>Giờ OT</th><th>Tiền OT</th>
        <th>Thưởng</th><th>Xăng xe</th><th>Chức vụ</th><th>Chuyên cần</th><th>BH</th>${coThue ? '<th>Thuế TNCN</th>' : ''}<th>Tạm ứng</th><th>Điều chỉnh</th><th>Thực lĩnh</th>
      </tr></thead><tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(r.HoTen)}</td><td style="text-align:center;">${r.KieuLuong === 'Ngay' ? 'Ngày' : (r.KieuLuong ? 'Tháng' : '')}</td>
        ${td(r.CongThuViec != null ? num(r.CongThuViec) : '')}${td(r.CongChinhThuc != null ? num(r.CongChinhThuc) : num(r.Cong))}${td(r.SoPhep != null ? num(r.SoPhep) : '')}${td(r.SoKhongPhep != null ? num(r.SoKhongPhep) : '')}
        ${td(r.KieuLuong === 'Ngay' ? money(r.DonGiaNgay) : money(r.LuongCoBan))}${td(money(r.LuongNgayCong))}
        ${td(r.GioOT != null ? num(r.GioOT) : '')}${td(money(r.TangCa))}${td(money(r.Thuong))}${td(money(r.PcXangXe))}${td(money(r.PcChucVu))}${td(money(r.ChuyenCan))}
        ${td(money(r.TongBH))}${coThue ? td(money(r.ThueDaTru ? r.ThueTNCN : 0)) : ''}${td(money(r.TamUng))}
        <td style="text-align:right;" title="${escapeHtml(r.LyDoDieuChinh || '')}">${num(r.DieuChinh) ? money(r.DieuChinh) : ''}</td>
        <td style="text-align:right;font-weight:600;">${money(r.ThucLinh)}</td></tr>`).join('') || `<tr><td colspan="${nCot + 1}" style="text-align:center;">—</td></tr>`}
        <tr data-tong style="font-weight:bold;"><td></td><td colspan="7" style="text-align:right;">TỔNG</td>
          ${td(money(sum('LuongNgayCong')))}<td></td>${td(money(sum('TangCa')))}${td(money(sum('Thuong')))}${td(money(sum('PcXangXe')))}${td(money(sum('PcChucVu')))}${td(money(sum('ChuyenCan')))}
          ${td(money(sum('TongBH')))}${coThue ? td(money(rows.reduce((s, r) => s + (r.ThueDaTru ? num(r.ThueTNCN) : 0), 0))) : ''}${td(money(sum('TamUng')))}${td(money(sum('DieuChinh')))}${td(money(tong))}</tr>
      </tbody></table>
      ${rows.some(r => r.LyDoDieuChinh) ? `<p style="font-size:11px;margin:6px 0 0;"><b>Điều chỉnh:</b> ${rows.filter(r => r.LyDoDieuChinh).map(r => `${escapeHtml(r.HoTen)}: ${money(r.DieuChinh)} (${escapeHtml(r.LyDoDieuChinh)})`).join('; ')}</p>` : ''}
      <table style="width:100%;margin-top:28px;font-size:12px;text-align:center;border:0;"><tr>
        <td style="width:33%;"><b>NGƯỜI LẬP</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br></td>
        <td style="width:33%;"><b>KẾ TOÁN TRƯỞNG</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br></td>
        <td style="width:33%;"><b>GIÁM ĐỐC</b><br><i>(Ký, ghi rõ họ tên)</i><br><br><br><br></td>
      </tr></table>`;
  }
  /* v9.73: mỗi kiểu thưởng một dòng (KPI / sản phẩm / chuyên cần bậc thang) — luật ở common.js cacDongThuongPhieuLuong.
     Có đúng một dòng thì ẩn khi 0 như cũ; nhiều dòng thì in cả (kể cả 0) để người đọc thấy khoản nào không đạt. */
  function dongThuongPhieu(r, dong) {
    const ds = cacDongThuongPhieuLuong(r);
    return ds.map(x => dong(x.nhan, money(x.tien), ds.length === 1 && !num(x.tien))).join('');
  }
  function buildLuongCongNhatNVBody(r) {
    const dong = (nhan, gt, an) => an ? '' : `<tr><td style="width:52%;background:#f5f6f8;"><b>${nhan}</b></td><td style="text-align:right;">${gt}</td></tr>`;
    const coV890 = r.KieuLuong != null;
    return `<h2 style="text-align:center;">PHIẾU LƯƠNG CÔNG NHẬT — Tháng ${selThang}/${selNam}</h2>
      <p><b>Nhân viên:</b> ${escapeHtml(r.HoTen || '')} (${escapeHtml(r.MaNhanVien || '')})${coV890 ? ` — lương theo <b>${r.KieuLuong === 'Ngay' ? 'ngày' : 'tháng'}</b>` : ''}</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6">
        ${coV890
          ? dong('Công thử việc', num(r.CongThuViec), !num(r.CongThuViec)) + dong('Công chính thức (gồm lễ hưởng lương)', num(r.CongChinhThuc))
            + dong('Ngày phép (không lương)', num(r.SoPhep), !num(r.SoPhep)) + dong('Ngày đi muộn', num(r.SoNgayMuon), !num(r.SoNgayMuon))
            + dong('Ngày nghỉ không phép' + ((r.ngayKhongPhep || []).length ? ' (' + r.ngayKhongPhep.map(ddmm).join(', ') + ')' : ''), num(r.SoKhongPhep), !num(r.SoKhongPhep))   // v9.55 / v9.58 liệt kê ngày
          : dong('Số công trong tháng', num(r.Cong))}
        ${r.KieuLuong === 'Ngay' ? dong('Đơn giá ngày', money(r.DonGiaNgay)) : dong('Lương cơ bản', money(r.LuongCoBan))}
        ${dong('Lương theo ngày công', money(r.LuongNgayCong))}
        ${dong(`Tăng ca (${num(r.GioOT)} giờ × ${money(r.DonGiaGioOT)})`, money(r.TangCa), !num(r.TangCa))}
        ${dongThuongPhieu(r, dong)}
        ${dong('Phụ cấp ăn ca', money(r.PcAnCa), !num(r.PcAnCa))}
        ${/* v9.78: nếu hợp đồng khai số km thì nói rõ km × đ/km (số km lấy từ hợp đồng hiện tại — bảng lương
             không chụp km, nên phiếu của tháng cũ chỉ hiện số tiền đã chốt). */''}
        ${/* v9.79: BangLuongChiTiet chỉ lưu SỐ TIỀN xăng, không lưu đơn giá ngày ⇒ không bịa chú thích "x đ/ngày"
             (chia PcXangXe cho Cong là SAI: Cong có cả phép và lễ, xăng thì không). Muốn biết đơn giá thì xem hợp đồng. */''}
        ${dong('Phụ cấp xăng xe', money(r.PcXangXe), !num(r.PcXangXe))}
        ${dong('Phụ cấp điện thoại', money(r.PcDienThoai), !num(r.PcDienThoai))}
        ${dong('Phụ cấp chức vụ', money(r.PcChucVu), !num(r.PcChucVu))}
        ${dong('Chuyên cần', money(r.ChuyenCan), !num(r.ChuyenCan))}
        ${dong('Bảo hiểm (trừ vào lương)', money(r.TongBH), !num(r.TongBH))}
        ${dong('Thuế TNCN' + (r.ThueDaTru ? '' : ' (tính, chưa trừ)'), money(r.ThueTNCN), !num(r.ThueTNCN))}
        ${dong('Tạm ứng', money(r.TamUng), !num(r.TamUng))}
        ${dong(`Điều chỉnh${r.LyDoDieuChinh ? ` — ${escapeHtml(r.LyDoDieuChinh)}` : ''}`, money(r.DieuChinh), !num(r.DieuChinh))}
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
    if (!confirm(`Tính lương công nhật tháng ${selThang}/${selNam} ngay bây giờ? (Sẽ tính lại toàn bộ theo hợp đồng + chấm công + KPI hiện tại. Điều chỉnh đã ghi được giữ nguyên. Bình thường bảng đã tự tính lại khi có biến động — nút này chỉ để tính lại ngay.)`)) return;
    let r;
    try { r = (await apiPost('/api/payroll/bangluong/tinh', { nam: selNam, thang: selThang })).data || {}; }
    catch (e) { toast(e.message, 'error'); return; }
    /* v9.45: kết quả tính phải NÓI ai bị bỏ ra (chưa có hợp đồng) và tiền nào đang là 0 vì thiếu dữ
       liệu — toast 3 giây không đủ, kế toán chốt bảng thiếu người mới biết. Có gì đáng nói thì mở hộp. */
    const thieu = r.thieuHopDong || [], cb = r.canhBao || [];
    if (!thieu.length && !cb.length) { toast(`Đã tính lương cho ${r.soNhanVien} nhân viên.`, 'success'); renderLuong(); return; }
    renderLuong();
    hienKetQuaTinh(r, `Đã tính lương cho ${r.soNhanVien} nhân viên`);
  }
  /* v9.53: tách hộp kết quả ra — dùng cả khi bấm Tính lương lẫn khi bảng tự tính lại (link "xem" ở dòng trạng thái). */
  function hienKetQuaTinh(r, tieuDe) {
    const thieu = r.thieuHopDong || [], cb = r.canhBao || [];
    const m = openModal(`<h3>${escapeHtml(tieuDe)} — có ${thieu.length + cb.length} điều cần xem</h3>
      ${thieu.length ? `<p style="margin:6px 0;"><b style="color:#c0392b;">${thieu.length} người KHÔNG có trong bảng</b> vì chưa có hợp đồng hiệu lực (Nhân sự → Hợp đồng lao động → Thêm, khai kiểu lương + đơn giá):</p>
        <div style="max-height:160px;overflow:auto;border:1px solid #e0e0e0;padding:6px;font-size:13px;">${thieu.map(x => `${escapeHtml(x.MaNhanVien || '')} ${escapeHtml(x.HoTen || '')}`).join('<br>')}</div>` : ''}
      ${cb.length ? `<p style="margin:10px 0 6px;"><b style="color:#b06000;">${cb.length} cảnh báo</b> (dòng vẫn có trong bảng nhưng số có thể thiếu):</p>
        <div style="max-height:200px;overflow:auto;border:1px solid #e0e0e0;padding:6px;font-size:13px;">${cb.map(x => '• ' + escapeHtml(x)).join('<br>')}</div>` : ''}
      <p class="empty-hint" style="text-align:left;margin-top:8px;">Thuế TNCN: ${r.truThue ? '<b>ĐANG trừ</b> vào thực lĩnh' : 'chỉ tính để xem, <b>KHÔNG trừ</b> (bật ở Cấu hình lương nếu muốn trừ)'}. Sửa xong, mở lại tab là bảng tự tính lại (hoặc bấm <b>Tính lương</b>).</p>
      <div class="modal-actions"><button type="button" class="btn" id="btnCancel">Đã hiểu</button></div>`);
    m.querySelector('#btnCancel').addEventListener('click', closeModal);
  }
  async function chotLuong(id) {
    if (!confirm('Chốt bảng lương? Sau khi chốt sẽ không tính lại/sửa được (muốn sửa phải Bỏ chốt, có ghi lý do). Biến động về sau (chấm công, phiếu chi tạm ứng, hợp đồng) chỉ được BÁO trên bảng, không tự tính lại.')) return;
    try { await apiPut('/api/payroll/bangluong/' + id + '/chot', {}); toast('Đã chốt bảng lương.', 'success'); renderLuong(); }
    catch (e) { toast(e.message, 'error'); }
  }
  /* v9.54: bỏ chốt — lý do bắt buộc (máy chủ cũng chặn), ghi vào ghi chú bảng lương. Sau khi bỏ, tab tự tải
     lại: có biến động chờ sẵn (v9.53) thì bảng tự tính lại ngay lúc đó và nói rõ vì sao. */
  function boChotLuong(header) {
    const m = openModal(`<h3>🔓 Bỏ chốt bảng lương tháng ${selThang}/${selNam}</h3>
      <p style="margin:6px 0;">Bảng sẽ về <b>Nháp</b>: tính lại / sửa điều chỉnh được; nếu đã có biến động (chấm công, phiếu chi tạm ứng, hợp đồng, KPI) thì mở lại tab là <b>tự tính lại</b> theo số mới nhất. Số đã trả cho nhân viên <b>không</b> tự đổi theo — anh/chị tự đối chiếu.</p>
      <div class="form-group"><label>Lý do bỏ chốt <span style="color:#c0392b;">*</span></label>
        <input type="text" id="bcLyDo" maxlength="200" placeholder="VD: Sửa chấm công ngày 12/11 cho Ngọc" style="width:100%;"></div>
      ${header && header.GhiChu ? `<div class="empty-hint" style="text-align:left;white-space:pre-line;">Dấu vết cũ:\n${escapeHtml(header.GhiChu)}</div>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="bcHuy">Hủy</button>
        <button type="button" class="btn" id="bcLuu">🔓 Bỏ chốt</button>
      </div>`);
    m.querySelector('#bcHuy').addEventListener('click', closeModal);
    m.querySelector('#bcLuu').addEventListener('click', async () => {
      const lyDo = m.querySelector('#bcLyDo').value.trim();
      if (!lyDo) { toast('Phải ghi lý do bỏ chốt.', 'error'); return; }
      try { await apiPut('/api/payroll/bangluong/' + header.BangLuongID + '/bochot', { lyDo }); closeModal(); toast('Đã bỏ chốt — bảng về Nháp.', 'success'); renderLuong(); }
      catch (e) { toast(e.message, 'error'); }
    });
  }

  /* ================================================================
     3b. ĐÁNH GIÁ KPI THÁNG + THƯỞNG THEO SẢN PHẨM (v9.45)
     Nguyen 11/11: "thêm chức năng đánh giá KPI từng người", "theo sản phẩm: tên, đơn giá, số lượng =
     thành tiền", "Ký hợp đồng có lựa chọn theo KPI hay theo SP", "người có thể nhiều SP, mỗi SP 1 đơn giá".
     Chỉ hiện người mà HỢP ĐỒNG hiệu lực có khai Kiểu thưởng. Điểm 0–100; tiền KPI thật = quỹ KPI ×
     điểm/100 × tổng công/công chuẩn (bộ tính), nên ở đây chỉ xem trước mức "đủ công". Ô "Tiền ghi đè"
     để kế toán ấn định số (bảng thực tế có người được 450.000 không theo tỷ lệ nào).
     ================================================================ */
  async function renderKPI() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let d;
    try { d = (await apiGet(`/api/payroll/kpi?nam=${selNam}&thang=${selThang}`)).data; }
    catch (e) { container.innerHTML = periodBar(null, '') + `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; wirePeriod(container, renderKPI); return; }
    const rows = d.rows || [];
    /* v9.67: thưởng SP = phần TỰ ĐỘNG từ lệnh SX (may mẫu / ảnh / video — r.sanPhamTuLenh, sửa ở QLSX › Sản lượng
       theo lệnh) + phần nhập tay (r.sanPhamThang). Dòng từ lệnh không khớp tên hợp đồng ⇒ 0 đồng, báo đỏ. */
    const tongSP = (r) => (r.sanPhamThang || []).reduce((s, x) => s + num(x.ThanhTien), 0) + num(r.tienTuLenh);
    const tuLenhHtml = (r) => {
      const ds = r.sanPhamTuLenh || [];
      if (!ds.length) return '';
      return `<div><span style="color:#1a73e8;">Từ lệnh SX:</span> ${ds.map(x => `${escapeHtml(x.TenSanPham)} × ${num(x.SoLuong)}${x.khop ? '' : ' <span style="color:#c0392b;" title="Tên không có trong danh mục sản phẩm của hợp đồng — 0 đồng. Thêm đúng tên này vào hợp đồng.">(không khớp HĐ)</span>'}`).join('; ')}</div>`;
    };
    container.innerHTML = periodBar(null, `<span style="color:#5f6368;font-size:12px;">Chỉ hiện người có <b>Kiểu thưởng</b> ở hợp đồng hiệu lực.</span>`) + `
      <div style="overflow:auto;"><table style="font-size:13px;min-width:900px;"><thead><tr><th style="width:38px;">STT</th>
        <th>Mã NV</th><th>Họ tên</th><th>Kiểu thưởng</th><th>Quỹ KPI / Danh mục SP</th><th style="width:90px;">Điểm (0–100)</th><th style="width:120px;" title="Để trống = tính theo điểm. Điền = lấy đúng số này.">Tiền ghi đè</th><th>Nhận xét</th><th style="width:110px;">Tiền thưởng</th><th style="width:90px;"></th>
      </tr></thead><tbody>${rows.flatMap((r, i) => {
        /* v9.73: Kiểu thưởng là TẬP HỢP ("KPI,SanPham") — người có cả hai thì vẽ HAI dòng: dòng KPI
           (chấm điểm) + dòng Sản phẩm (nhập SL). Chuyên cần không chấm ở đây (tự tính theo chấm công). */
        const kieu = String(r.KieuThuong || '');
        const coKPI = kieu.includes('KPI'), coSP = kieu.includes('SanPham');
        const cacDong = [];
        if (coKPI) cacDong.push(true);
        if (coSP || !coKPI) cacDong.push(false);
        return cacDong.map((laKPI, j) => {
        const duKien = laKPI ? (r.TienGhiDe != null ? num(r.TienGhiDe) : Math.round(num(r.QuyKPI) * num(r.DiemKPI) / 100)) : tongSP(r);
        return `<tr data-nv="${r.NhanVienID}">
          <td style="text-align:center;">${j ? '' : i + 1}</td><td>${j ? '' : escapeHtml(r.MaNhanVien || '')}</td><td>${j ? '<span style="color:#5f6368;">(cùng người)</span>' : escapeHtml(r.HoTen)}</td>
          <td style="text-align:center;">${laKPI ? 'KPI' : 'Sản phẩm'}${cacDong.length > 1 ? ' <span style="font-size:10px;color:#5f6368;">(' + (j + 1) + '/' + cacDong.length + ')</span>' : ''}</td>
          <td>${laKPI ? money(r.QuyKPI) : (r.danhMucSanPham || []).map(x => `${escapeHtml(x.TenSanPham)} <span style="color:#5f6368;">(${money(x.DonGia)})</span>`).join(', ') || '<span style="color:#c0392b;">chưa khai SP ở hợp đồng</span>'}</td>
          ${laKPI ? `
          <td><input type="number" class="k-diem" min="0" max="100" step="1" value="${r.DiemKPI != null ? num(r.DiemKPI) : ''}" style="width:80px;" ${perm.canEdit ? '' : 'disabled'}></td>
          <td><input type="number" class="k-ghide" step="1000" value="${r.TienGhiDe != null ? num(r.TienGhiDe) : ''}" style="width:110px;" ${perm.canEdit ? '' : 'disabled'}></td>
          <td><input type="text" class="k-nx" maxlength="500" value="${escapeHtml(r.NhanXet || '')}" style="width:100%;min-width:160px;" ${perm.canEdit ? '' : 'disabled'}></td>
          <td style="text-align:right;" class="k-tien" title="Mức khi đủ công chuẩn — bộ tính nhân thêm tổng công/công chuẩn">${r.DiemKPI == null && r.TienGhiDe == null ? '<span style="color:#c0392b;">chưa chấm</span>' : money(duKien)}${r.TienGhiDe == null && r.DiemKPI != null && num(r.DiemKPI) === 0 ? ' <span title="Điểm 0 ⇒ thưởng 0. Nếu từng điền Tiền ghi đè rồi xóa, điểm vẫn là 0 — chấm lại." style="color:#b06000;">(0 điểm)</span>' : ''}</td>
          <td>${perm.canEdit ? `<button class="btn small k-luu" data-nv="${r.NhanVienID}">💾 Lưu</button>` : ''}</td>`
          : `
          <td colspan="3" style="color:#5f6368;">${tuLenhHtml(r)}${(r.sanPhamThang || []).length ? `<div>${(r.sanPhamTuLenh || []).length ? 'Nhập tay: ' : ''}${(r.sanPhamThang || []).map(x => `${escapeHtml(x.TenSanPham)} × ${num(x.SoLuong)}`).join('; ')}</div>` : ((r.sanPhamTuLenh || []).length ? '' : 'chưa có sản phẩm tháng này')}</td>
          <td style="text-align:right;">${money(duKien)}</td>
          <td>${perm.canEdit ? `<button class="btn small secondary k-sp" data-nv="${r.NhanVienID}">📝 Sản phẩm</button>` : ''}</td>`}
        </tr>`;
        });
      }).join('') || '<tr><td colspan="10" class="empty-hint">Chưa có ai khai Kiểu thưởng (KPI / Sản phẩm) ở hợp đồng lao động hiệu lực.</td></tr>'}</tbody></table></div>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Tiền KPI = quỹ KPI (hợp đồng) × điểm/100 × tổng công/công chuẩn. Điền <b>Tiền ghi đè</b> khi muốn ấn định số bất kể điểm. Lưu xong sang tab <b>Lương công nhật</b> là bảng tự tính lại (v9.53), không cần bấm Tính lương.</p>`;
    wirePeriod(container, renderKPI);
    themOTimTuDong(container);
    container.querySelectorAll('.k-luu').forEach(b => b.addEventListener('click', async () => {
      const tr = b.closest('tr');
      const diemRaw = tr.querySelector('.k-diem').value, ghiDe = tr.querySelector('.k-ghide').value;
      if (diemRaw === '' && ghiDe === '') { toast('Nhập điểm (0–100) hoặc tiền ghi đè.', 'error'); return; }
      const diem = Math.max(0, Math.min(100, num(diemRaw)));
      try {
        await apiPut('/api/payroll/kpi/diem', { nam: selNam, thang: selThang, nhanVienId: b.dataset.nv, diemKPI: diem, tienGhiDe: ghiDe === '' ? null : num(ghiDe), nhanXet: tr.querySelector('.k-nx').value });
        toast('Đã lưu điểm KPI.', 'success'); renderKPI();
      } catch (e) { toast(e.message, 'error'); }
    }));
    container.querySelectorAll('.k-sp').forEach(b => b.addEventListener('click', () => {
      const r = rows.find(x => String(x.NhanVienID) === String(b.dataset.nv));
      if (r) openSanPhamThangModal(r);
    }));
  }
  /* Bảng sản phẩm tháng của MỘT người.
     v9.48 (Nguyen 12/11: "bên đánh giá KPI phần nhập sản phẩm lấy list danh mục từ hợp đồng"): DANH MỤC
     SẢN PHẨM LẤY TỪ HỢP ĐỒNG — mỗi sản phẩm hợp đồng đã khai là MỘT DÒNG sẵn, tên + đơn giá KHÓA (đúng
     cái đã in ở điều khoản e)/3.4), người chấm chỉ gõ SỐ LƯỢNG. Dòng để trống SL thì không lưu. Dòng
     tháng trước đã nhập mà KHÔNG còn trong danh mục hợp đồng vẫn hiện (đánh dấu "ngoài danh mục") để
     không mất dữ liệu; "＋ Thêm dòng" cho sản phẩm phát sinh ngoài hợp đồng (tên + đơn giá gõ tay).
     Lưu = ghi lại toàn bộ dòng có SL > 0 (PUT /kpi/sanpham). */
  function openSanPhamThangModal(r) {
    const dm = (r.danhMucSanPham || []).filter(x => x && String(x.TenSanPham || '').trim());
    const khoa = (ten) => String(ten || '').trim().toLowerCase();
    const daCo = r.sanPhamThang || [];
    const timDaCo = (ten) => daCo.find(x => khoa(x.TenSanPham) === khoa(ten));
    const rowHtml = (x, theoHD) => `<tr data-hd="${theoHD ? 1 : 0}">
      <td>${theoHD
        ? `<input type="text" class="sp-ten" value="${escapeHtml(x.TenSanPham || '')}" readonly style="width:100%;min-width:160px;background:#f1f3f4;" title="Theo danh mục hợp đồng">`
        : `<input type="text" class="sp-ten" list="spDM_${r.NhanVienID}" value="${escapeHtml((x && x.TenSanPham) || '')}" placeholder="Tên sản phẩm" style="width:100%;min-width:160px;">`}
        ${!theoHD && x ? '<div style="font-size:11px;color:#b06000;">ngoài danh mục hợp đồng</div>' : ''}</td>
      <td><input type="number" class="sp-dg" step="1000" value="${x && x.DonGia != null ? num(x.DonGia) : ''}" ${theoHD ? 'readonly style="width:110px;background:#f1f3f4;" title="Đơn giá theo hợp đồng"' : 'style="width:110px;"'}></td>
      <td><input type="number" class="sp-sl" step="1" min="0" value="${x && x.SoLuong != null && num(x.SoLuong) ? num(x.SoLuong) : ''}" style="width:80px;" placeholder="0"></td>
      <td style="text-align:right;" class="sp-tt">${x ? money(num(x.DonGia) * num(x.SoLuong)) : '0'}</td>
      <td><input type="text" class="sp-gc" maxlength="255" value="${escapeHtml((x && x.GhiChu) || '')}" style="width:100%;min-width:100px;"></td>
      <td>${theoHD ? '' : '<button type="button" class="btn small secondary sp-xoa" title="Bỏ dòng">✕</button>'}</td></tr>`;
    /* Dòng theo hợp đồng: đơn giá của HỢP ĐỒNG, số lượng (và ghi chú) lấy từ bản đã nhập tháng này nếu có. */
    const dongHD = dm.map(sp => { const c = timDaCo(sp.TenSanPham); return rowHtml({ TenSanPham: sp.TenSanPham, DonGia: sp.DonGia, SoLuong: c ? c.SoLuong : null, GhiChu: c ? c.GhiChu : '' }, true); });
    const dongNgoai = daCo.filter(x => !dm.some(sp => khoa(sp.TenSanPham) === khoa(x.TenSanPham))).map(x => rowHtml(x, false));
    /* v9.67: phần TỰ ĐỘNG từ lệnh SX — chỉ xem, không lưu ở đây (không nằm trong #spBody nên không vào PUT). */
    const tuLenh = r.sanPhamTuLenh || [];
    const tienTuLenh = num(r.tienTuLenh);
    const khoiTuLenh = tuLenh.length ? `<div style="margin-bottom:8px;padding:6px 8px;background:#e8f0fe;border-radius:6px;font-size:13px;">
        <b>Tự động từ lệnh sản xuất</b> (may mẫu / ảnh / video — sửa ở <b>QLSX › Sản lượng theo lệnh</b>, không sửa ở đây):
        <table style="font-size:13px;margin-top:4px;"><thead><tr><th>Sản phẩm</th><th>Số lệnh</th><th>Số lượng</th><th>Đơn giá HĐ</th><th>Thành tiền</th></tr></thead><tbody>
        ${tuLenh.map(x => `<tr><td>${escapeHtml(x.TenSanPham)}${x.khop ? '' : ' <span style="color:#c0392b;">(không có trong hợp đồng — 0 đ)</span>'}</td><td style="text-align:center;">${num(x.SoLenh)}</td><td style="text-align:right;">${num(x.SoLuong)}</td><td style="text-align:right;">${money(x.DonGia)}</td><td style="text-align:right;">${money(x.ThanhTien)}</td></tr>`).join('')}
        </tbody><tfoot><tr style="font-weight:700;"><td colspan="4" style="text-align:right;">Cộng tự động</td><td style="text-align:right;">${money(tienTuLenh)}</td></tr></tfoot></table></div>` : '';
    const m = openModal(`<h3>Sản phẩm tháng ${selThang}/${selNam} — ${escapeHtml(r.HoTen || '')}</h3>
      ${khoiTuLenh}
      <datalist id="spDM_${r.NhanVienID}">${dm.map(x => `<option value="${escapeHtml(x.TenSanPham)}">`).join('')}</datalist>
      ${tuLenh.length ? '<div style="font-weight:600;margin-bottom:4px;">Nhập tay (sản phẩm ngoài lệnh SX — cộng thêm vào phần tự động)</div>' : ''}
      <div style="max-height:50vh;overflow:auto;"><table style="font-size:13px;"><thead><tr><th>Tên sản phẩm</th><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th><th>Ghi chú</th><th></th></tr></thead>
        <tbody id="spBody">${dongHD.join('')}${dongNgoai.join('')}</tbody>
        <tfoot><tr style="font-weight:700;"><td colspan="3" style="text-align:right;">TỔNG${tuLenh.length ? ' (tự động + nhập tay)' : ''}</td><td style="text-align:right;" id="spTong">${money(daCo.reduce((s, x) => s + num(x.ThanhTien), 0) + tienTuLenh)}</td><td colspan="2"></td></tr></tfoot></table></div>
      <div style="margin-top:6px;"><button type="button" class="btn small secondary" id="spThem">＋ Thêm dòng ngoài danh mục</button>
        <span style="color:#5f6368;font-size:12px;margin-left:8px;">${dm.length
          ? `${dm.length} sản phẩm theo <b>hợp đồng</b> (tên + đơn giá khóa) — chỉ gõ số lượng; để trống là không tính. Thêm sản phẩm vào hợp đồng ở Nhân sự → Hợp đồng.`
          : 'Hợp đồng chưa khai danh mục sản phẩm — nhập tay tên + đơn giá (nên khai ở hợp đồng để in ra điều khoản thưởng).'}</span></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="spHuy">Hủy</button><button type="button" class="btn" id="spLuu">💾 Lưu</button></div>`);
    const body = m.querySelector('#spBody');
    const tinhLai = () => {
      let tong = tienTuLenh;   // v9.67: cộng sẵn phần tự động từ lệnh SX
      body.querySelectorAll('tr').forEach(tr => {
        const tt = num(tr.querySelector('.sp-dg').value) * num(tr.querySelector('.sp-sl').value);
        tr.querySelector('.sp-tt').textContent = money(tt); tong += tt;
      });
      m.querySelector('#spTong').textContent = money(tong);
    };
    const wireRow = (tr) => {
      tr.querySelector('.sp-ten').addEventListener('change', (e) => {
        if (tr.dataset.hd === '1') return;
        const hit = dm.find(x => khoa(x.TenSanPham) === khoa(e.target.value));
        if (hit) tr.querySelector('.sp-dg').value = num(hit.DonGia);
        tinhLai();
      });
      tr.querySelector('.sp-dg').addEventListener('input', tinhLai);
      tr.querySelector('.sp-sl').addEventListener('input', tinhLai);
      const xoa = tr.querySelector('.sp-xoa');
      if (xoa) xoa.addEventListener('click', () => { tr.remove(); tinhLai(); });
    };
    body.querySelectorAll('tr').forEach(wireRow);
    m.querySelector('#spThem').addEventListener('click', () => {
      body.insertAdjacentHTML('beforeend', rowHtml(null, false));
      const tr = body.lastElementChild; wireRow(tr); tr.querySelector('.sp-ten').focus();
    });
    if (!body.children.length) m.querySelector('#spThem').click();
    else { const slDau = body.querySelector('.sp-sl'); if (slDau) slDau.focus(); }
    m.querySelector('#spHuy').addEventListener('click', closeModal);
    m.querySelector('#spLuu').addEventListener('click', async () => {
      const ds = [...body.querySelectorAll('tr')].map(tr => ({
        tenSanPham: tr.querySelector('.sp-ten').value.trim(), donGia: num(tr.querySelector('.sp-dg').value),
        soLuong: num(tr.querySelector('.sp-sl').value), ghiChu: tr.querySelector('.sp-gc').value.trim()
      })).filter(x => x.tenSanPham && x.soLuong > 0);
      try {
        const kq = await apiPut('/api/payroll/kpi/sanpham', { nam: selNam, thang: selThang, nhanVienId: r.NhanVienID, rows: ds });
        closeModal(); toast(`Đã lưu ${ds.length} dòng nhập tay — ${money(kq.data && kq.data.tong)}${tienTuLenh ? ` (+ tự động từ lệnh ${money(tienTuLenh)})` : ''}.`, 'success'); renderKPI();
      } catch (e) { toast(e.message, 'error'); }
    });
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
    themOTimTuDong(container);   // v9.05: ô tìm cho CẢ bảng tổng hợp NV lẫn bảng chi tiết theo đơn
    const b = container.querySelector('#btnExMay'); if (b) b.addEventListener('click', () => downloadFile(`/api/payroll/luongmay/excel?nam=${selNam}&thang=${selThang}`, `LuongKhoanMay_T${selThang}_${selNam}.xlsx`));
    const bIn = container.querySelector('#btnInTongMay'); if (bIn) bIn.addEventListener('click', () => printHtml(`Tổng hợp lương khoán may T${selThang}/${selNam}`, buildLuongMayTongHopBody(d, tongAll)));
    container.querySelectorAll('.lm-nv').forEach(tr => tr.addEventListener('click', () => openLuongMayNVDetail(tr.dataset.nvid, d)));
  }

  // v5.36: in tổng hợp + xem/in chi tiết lương khoán may từng nhân viên (dữ liệu client-side d.rows/d.tongHop).
  function buildLuongMayTongHopBody(d, tongAll) {
    return `<h2 style="text-align:center;">TỔNG HỢP LƯƠNG KHOÁN MAY — Tháng ${selThang}/${selNam}</h2>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Tổng SL</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.tongHop || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('')}
      <tr data-tong style="font-weight:bold;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tongAll)}</td></tr></tbody></table>`;
  }
  function buildLuongMayNVBody(nv, rows) {
    const tong = rows.reduce((s, r) => s + num(r.ThanhTien), 0);
    return `<h2 style="text-align:center;">PHIẾU LƯƠNG KHOÁN MAY — Tháng ${selThang}/${selNam}</h2>
      <p><b>Nhân viên:</b> ${escapeHtml(nv.HoTen || '')} (${escapeHtml(nv.MaNhanVien || '')})</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Mã ĐH</th><th>Ngày</th><th>Tên sản phẩm</th><th>Công đoạn</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenCongDoan || '')}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;">—</td></tr>'}
      <tr data-tong style="font-weight:bold;"><td></td><td colspan="6" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tbody></table>`;
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
  /* v9.52 (Nguyen 14/11: "Chi tiết gia công thêm cột sl giao"): cột SL GIAO đặt cạnh SL NHẬN ở mọi bảng
     của tab này (tổng hợp theo nhà, chi tiết, modal + bản in từng nhà). SL giao = ct.SoLuong (ghi ở Giao
     gia công) / it.SoLuongGiao (Giao in thêu) — CHỈ ĐỂ ĐỐI CHIẾU hao hụt, tiền vẫn = SL NHẬN × đơn giá.
     Dòng giao mà CHƯA nhận không nằm trong bảng này (util lọc SoLuongNhan > 0 — tiền chỉ phát sinh khi
     hàng về), nên "SL giao" ở đây là của những dòng đã nhận. */
  function gcItSectionTongHop(tongHop, tong, kind) {
    return `<table><thead><tr><th style="width:38px;">STT</th><th>Nhà</th><th>Tổng SL giao</th><th>Tổng SL nhận</th><th>Thành tiền</th></tr></thead>
      <tbody>${(tongHop || []).map((r, __i) => `<tr class="gcit-nha" data-nhaid="${r.NhaGiaCongID}" data-kind="${kind}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenNha)}</td><td style="text-align:right;">${num(r.SoLuongGiao)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;font-weight:600;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty-hint">—</td></tr>`}</tbody>
      ${(tongHop || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tfoot>` : ''}</table>`;
  }
  // In TỔNG HỢP: chỉ 2 bảng tổng-hợp-theo-nhà (KHÔNG in từng đơn hàng).
  function buildGcItTongHopBody(d, gcTong, itTong) {
    const sec = (title, tongHop, tong) => `<h3>${title}</h3>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Nhà</th><th>Tổng SL giao</th><th>Tổng SL nhận</th><th>Thành tiền</th></tr></thead>
      <tbody>${(tongHop || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenNha)}</td><td style="text-align:right;">${num(r.SoLuongGiao)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;">—</td></tr>'}
      <tr data-tong style="font-weight:bold;"><td colspan="4" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tbody></table>`;
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
    // v9.52: thêm cột SL giao trước SL nhận (span = số cột giữa STT và Thành tiền: 6).
    const head = kind === 'gc' ? '<th>Mã ĐH</th><th>Tên sản phẩm</th><th>Hạng mục</th><th>SL giao</th><th>SL nhận</th><th>Đơn giá</th><th>Thành tiền</th>' : '<th>Mã ĐH</th><th>Tên sản phẩm</th><th>Hạng mục in thêu</th><th>SL giao</th><th>SL nhận</th><th>Đơn giá</th><th>Thành tiền</th>';
    const span = 6;
    const body = rows.map((r, __i) => kind === 'gc'
      ? `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenHangMuc || '')}</td><td style="text-align:right;">${num(r.SoLuongGiao)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`
      : `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${oHangMucInThe(r)}</td><td style="text-align:right;">${num(r.SoLuongGiao)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="${span + 2}" style="text-align:center;">—</td></tr>`;
    return `<h2 style="text-align:center;">CHI TIẾT ${kind === 'gc' ? 'GIA CÔNG' : 'IN THÊU'} — ${escapeHtml(tenNha)}</h2>
      <p style="text-align:center;">Tháng ${selThang}/${selNam}</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th>${head}</tr></thead>
      <tbody>${body}<tr data-tong style="font-weight:bold;"><td></td><td colspan="${span}" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tbody></table>`;
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
      <div style="overflow:auto;margin-top:6px;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Nhà gia công</th><th>Mã ĐH</th><th>Hạng mục</th><th>SL giao</th><th>SL nhận</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.giaCong.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenNha)}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenHangMuc || '')}</td><td style="text-align:right;">${num(r.SoLuongGiao)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty-hint">Không có dữ liệu gia công tháng này.</td></tr>`}</tbody></table></div>
      <h4 style="margin:16px 0 4px;">In thêu — theo nhà (SL nhận × đơn giá hạng mục in thêu)</h4>
      ${gcItSectionTongHop(d.inThe.tongHop, itTong, 'inthe')}
      <div style="overflow:auto;margin-top:6px;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Nhà in thêu</th><th>Mã ĐH</th><th>Hạng mục in thêu</th><th>SL giao</th><th>SL nhận</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.inThe.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenNha)}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${oHangMucInThe(r)}</td><td style="text-align:right;">${num(r.SoLuongGiao)}</td><td style="text-align:right;">${num(r.SoLuongNhan)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty-hint">Không có dữ liệu in thêu tháng này.</td></tr>`}</tbody></table></div>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;"><b>SL giao</b> (ghi ở Giao gia công / Giao in thêu) chỉ để đối chiếu với SL nhận — tiền vẫn tính theo <b>SL nhận</b>; dòng giao mà chưa nhận không nằm trong bảng. Lọc theo tháng QC. Gia công = SL nhận × đơn giá hạng mục. In thêu: dòng giao ĐÃ chọn hạng mục thì = SL nhận × đơn giá CỦA hạng mục đó; dòng để trống (dữ liệu cũ) thì = SL nhận × TỔNG đơn giá in thêu của đơn (khai ở Tài liệu kỹ thuật → Đơn giá in thêu). Chọn hạng mục ở công đoạn Giao in thêu (GIT); SL nhận nhập ở Nhận gia công (NGC) / Nhận in thêu (NIT).</p>`;
    wirePeriod(container, renderLuongGcInThe);
    themOTimTuDong(container);   // v9.05: ô tìm cho 4 bảng (tổng hợp + chi tiết, gia công + in thêu)
    const bIn = container.querySelector('#btnInGcIt'); if (bIn) bIn.addEventListener('click', () => printHtml(`Tổng hợp lương gia công / in thêu T${selThang}/${selNam}`, buildGcItTongHopBody(d, gcTong, itTong)));
    container.querySelectorAll('.gcit-nha').forEach(tr => tr.addEventListener('click', () => openGcItNhaDetail(tr.dataset.nhaid, tr.dataset.kind, d)));
  }

  // v5.38: Lương là (LA) + đóng gói (DG) = SL giao × đơn giá là/đóng gói. Tổng hợp theo NV + chi tiết + In.
  function buildLaDgBody(d, tongAll) {
    return `<h2 style="text-align:center;">LƯƠNG LÀ / ĐÓNG GÓI — Tháng ${selThang}/${selNam}</h2>
      ${/* v9.02: + cột Ngày QC — kỳ lương = tháng muộn hơn giữa Ngày ghi và Ngày QC. 12 cột. */''}
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Công đoạn</th><th>Mã ĐH</th><th>Tên SP</th><th>Màu</th><th>Ngày</th><th>Ngày QC</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td>${r.Loai === 'LA' ? 'Là' : 'Đóng gói'}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td><td>${fmtDate(r.NgayQC)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="12" style="text-align:center;">—</td></tr>'}
      <tr data-tong style="font-weight:bold;"><td></td><td colspan="10" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tongAll)}</td></tr></tbody></table>`;
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
      <tbody>${(d.tongHop || []).map((r, __i) => `<tr class="ldg-nv" data-nvid="${r.NhanVienID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;font-weight:600;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="5" class="empty-hint">Chưa có dữ liệu là/đóng gói tháng này (lệnh chưa ghi QC thì chưa tính).</td></tr>`}</tbody>
      ${(d.tongHop || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="3" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tongAll)}</td></tr></tfoot>` : ''}</table>
      <h4 style="margin:16px 0 4px;">Chi tiết theo công đoạn / đơn / màu</h4>
      ${/* v9.02: + cột Ngày QC. Lệnh chưa ghi QC không có trong bảng; kỳ = tháng muộn hơn giữa Ngày và Ngày QC. */''}
      <div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Công đoạn</th><th>Mã ĐH</th><th>Tên SP</th><th>Màu</th><th>Ngày</th><th>Ngày QC</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.rows || []).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td>${r.Loai === 'LA' ? 'Là' : 'Đóng gói'}</td><td>${escapeHtml(r.MaDH || '')}</td><td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td><td>${fmtDate(r.NgayQC)}</td><td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || `<tr><td colspan="12" class="empty-hint">—</td></tr>`}</tbody></table></div>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Lương là/đóng gói = SL giao ở công đoạn Là (LA) / Đóng gói (DG) × đơn giá là/đóng gói của đơn (khai ở "Tài liệu may/Đóng gói").
        <b>Chỉ tính lệnh đã ghi tiến độ QC</b>; kỳ lương = tháng <b>muộn hơn</b> giữa ngày ghi đóng gói và ngày QC đầu tiên của lệnh (v9.02) — lệnh chưa QC sẽ tự xuất hiện ở tháng QC.</p>`;
    wirePeriod(container, renderLuongLaDongGoi);
    themOTimTuDong(container);   // v9.05: ô tìm Mã NV / Họ tên / Công đoạn / Mã ĐH / Tên SP / Màu
    const bIn = container.querySelector('#btnInLaDg'); if (bIn) bIn.addEventListener('click', () => printHtml(`Lương là/đóng gói T${selThang}/${selNam}`, buildLaDgBody(d, tongAll)));
    container.querySelectorAll('.ldg-nv').forEach(tr => tr.addEventListener('click', () => openLaDgNVDetail(tr.dataset.nvid, d)));   // v5.91
  }

  /* v5.91 (rà soát): phiếu lương TỪNG NHÂN VIÊN cho lương là/đóng gói — trước đây tab này chỉ in được
     cả bảng, không xem/in riêng được của 1 người. Dữ liệu lọc client-side từ d.rows như tab khoán may. */
  function buildLaDgNVBody(nv, rows) {
    const tong = rows.reduce((s, r) => s + num(r.ThanhTien), 0);
    return `<h2 style="text-align:center;">PHIẾU LƯƠNG LÀ / ĐÓNG GÓI — Tháng ${selThang}/${selNam}</h2>
      <p><b>Nhân viên:</b> ${escapeHtml(nv.HoTen || '')} (${escapeHtml(nv.MaNhanVien || '')})</p>
      ${/* v9.02: + cột Ngày QC — 10 cột. */''}
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6"><thead><tr><th style="width:38px;">STT</th>
        <th>Công đoạn</th><th>Mã ĐH</th><th>Tên SP</th><th>Màu</th><th>Ngày</th><th>Ngày QC</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th>
      </tr></thead><tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${r.Loai === 'LA' ? 'Là' : 'Đóng gói'}</td><td>${escapeHtml(r.MaDH || '')}</td>
        <td>${escapeHtml(r.TenSanPham || '')}</td><td>${escapeHtml(r.TenMau || '')}</td><td>${fmtDate(r.NgayGhiNhan)}</td><td>${fmtDate(r.NgayQC)}</td>
        <td style="text-align:right;">${num(r.SoLuong)}</td><td style="text-align:right;">${money(r.DonGia)}</td>
        <td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="10" style="text-align:center;">—</td></tr>'}
        <tr data-tong style="font-weight:bold;"><td></td><td colspan="8" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(tong)}</td></tr></tbody></table>`;
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
  /* v9.60: kỳ in trên phiếu lấy từ DỮ LIỆU (d.thang / d.nam — route trả về) rồi mới lùi về kỳ đang chọn.
     Lý do: "Bảng lương của tôi" (module.mypay.js) nay dựng phiếu lương trải vải cắt của nhân viên bằng
     chính buildLuongCatNVBody ở đây (ModulePayroll.buildLuongCatNVBody) với kỳ CỦA PHÂN HỆ ĐÓ — không
     phải selThang/selNam của tab kế toán. Ở tab kế toán d.thang luôn = selThang nên không đổi gì. */
  const kyCua = (d) => `${(d && d.thang) || selThang}/${(d && d.nam) || selNam}`;
  /* v9.20 — Nguyen 2026-11-04: phiếu lương của MỘT nhân viên Cắt "chỉ hiển thị bàn cắt nhân viên đó
     trải vải hoặc cắt".
     🔴 Lọc theo ID, KHÔNG theo tên (hai người trùng họ tên là phiếu hiện nhầm bàn của nhau).
     `NhanVienTraiVaiIDs` là chuỗi id nối dấu phẩy (một bàn có thể nhiều người trải vải) — backend
     loadSoDoCat v9.20 trả về, lùi về td.NhanVienTraiVaiID cho bàn ghi theo kiểu cũ.
     v9.60: route tự phục vụ /luongtraivaicat/cuatoi có BẢN BACKEND của hàm này (routes/payroll.js) —
     đổi luật thì đổi CẢ HAI, bộ kiểm kiem_mypay_luong_trai_vai_cat so hai bản. */
  function laBanCuaNV(s, nvId) {
    const id = String(nvId || '');
    if (!id) return true;
    if (String(s.NhanVienCatID || '') === id) return true;
    return String(s.NhanVienTraiVaiIDs || '').split(',').map(x => x.trim()).includes(id);
  }

  /* `nv` (tuỳ chọn) — có thì CHỈ liệt kê bàn cắt người đó tham gia; dòng tổng + tiêu đề nói rõ đây
     không phải cả quỹ tháng. Số CỘT KHÔNG đổi theo nhánh (9 cột) để bản in, colspan và STT của
     common.js cư xử y hệt hai trường hợp. */
  function buildLuongCatQuyBody(d, nv) {
    const nvId = nv ? nv.NhanVienID : null;
    const soDoHien = (d.soDo || []).filter(s => !nvId || laBanCuaNV(s, nvId));
    const donHien = (d.theoDon || []).filter(o => soDoHien.some(s => String(s.DonHangID) === String(o.DonHangID)));
    const tienHien = soDoHien.reduce((t, x) => t + (Number(x.ThanhTien) || 0), 0);
    const donRows = donHien.map(o => {
      // Lọc trên DANH SÁCH ĐÃ LỌC; tổng của lệnh tính lại từ chính các sơ đồ đang hiện (khi không
      // lọc thì bằng đúng o.ThanhTien/o.SoSoDo — cùng một phép cộng của tongHopLuongCat).
      const soDoCuaDon = soDoHien.filter(s => String(s.DonHangID) === String(o.DonHangID));
      const tienLenh = soDoCuaDon.reduce((t, x) => t + (Number(x.ThanhTien) || 0), 0);
      const lopLenh = soDoCuaDon.reduce((t, x) => t + num(x.TongLop), 0);
      const chiTiet = soDoCuaDon.map((s, i) => `<tr><td style="text-align:center;">${i + 1}</td>
          <td style="text-align:center;">${i + 1}/${soDoCuaDon.length}</td>
          <td>${fmtDate(s.NgayGhiNhan)}</td>
          <td>${fmtDate(s.NgayQC)}</td>
          <td style="text-align:center;">${escapeHtml(s.SttSoCat != null ? String(s.SttSoCat) : '')}</td>
          <td style="text-align:right;">${num(s.MetSoDoDai)}</td>
          <td style="text-align:right;">${num(s.KhoVaiSoDo)}</td>
          <td style="text-align:right;">${num(s.TongLop)}</td>
          <td style="text-align:right;">${money(s.ThanhTien)}</td></tr>`).join('');
      // v9.02: data-tong — dòng tiêu đề lệnh KHÔNG phải dòng dữ liệu; thiếu nó thì danhLaiStt (common.js)
      // coi là dòng thường, đánh số vào ô trống đầu và ghi đè STT của các dòng sơ đồ. Lỗi có từ trước.
      // v9.19: + MÃ RẬP (nguồn Kỹ thuật) và NGÀY CẮT ngay trên dòng tiêu đề lệnh — bản in phải nói
      // cùng thứ với bảng "Bàn cắt theo lệnh sản xuất" trên màn. Số cột KHÔNG đổi (vẫn colspan 7).
      /* v9.20: ở bản LỌC ghi rõ "2/5 sơ đồ" — người đối chiếu với màn chính (lệnh có 5 sơ đồ) nhìn
         thấy ngay vì sao ở đây chỉ có 2, không tưởng là thiếu dữ liệu. */
      const nhanSoDo = nvId ? `${soDoCuaDon.length}/${o.SoSoDo} sơ đồ (tham gia / cả lệnh)` : `${soDoCuaDon.length} sơ đồ`;
      return `<tr data-tong style="background:#f1f3f4;font-weight:600;"><td></td><td colspan="7">Lệnh SX ${escapeHtml(o.MaDH || '')}${o.MaRap ? ' · rập ' + escapeHtml(o.MaRap) : ''}${o.TenSanPham ? ' — ' + escapeHtml(o.TenSanPham) : ''} · ${nhanSoDo} · tổng ${num(lopLenh)} lớp${khoangNgayCat(o) ? ' · cắt ' + escapeHtml(khoangNgayCat(o)) : ''}</td><td style="text-align:right;">${money(tienLenh)}</td></tr>${chiTiet}`;
    }).join('');
    // v9.18: kỳ = THÁNG GHI SỔ CẮT, không chờ QC (bỏ luật v9.02 cho riêng quỹ cắt). Cột Ngày QC giữ
    // lại chỉ để biết lệnh đã QC chưa — trống = chưa QC.
    /* v9.20: bản của MỘT nhân viên — đổi tiêu đề + nhãn dòng tổng, và NÓI RÕ lương không tính theo
       tổng tiền các bàn này (chia theo giờ công trên quỹ cả bộ phận). Thiếu câu đó là người xem
       cộng cột Thành tiền rồi hỏi "sao lương tôi không bằng số này". */
    return `<h2 style="text-align:center;">${nvId ? `BÀN CẮT CÓ ${escapeHtml((nv.HoTen || '').toUpperCase())} THAM GIA` : 'QUỸ LƯƠNG TRẢI VẢI CẮT'} — Tháng ${kyCua(d)}</h2>
      <p style="text-align:center;font-size:13px;">Công thức 1 sơ đồ: mét sơ đồ × tổng số lớp × khổ vải × ${money(d.donGia)} · kỳ = tháng ghi sổ cắt (không chờ QC — v9.18)</p>
      ${nvId ? `<p style="text-align:center;font-size:12px;color:#5f6368;">Chỉ liệt kê bàn cắt nhân viên này <b>trải vải hoặc cắt</b>. Lương khoán tháng <b>KHÔNG</b> bằng tổng tiền các bàn dưới đây — nó chia theo <b>giờ công</b> trên quỹ của cả bộ phận Cắt (xem bảng trên).</p>` : ''}
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="5"><thead><tr><th style="width:38px;">STT</th>
        <th>Sơ đồ</th><th>Ngày cắt</th><th>Ngày QC</th><th>STT sổ cắt</th><th>Mét sơ đồ</th><th>Khổ vải</th><th>Tổng lớp</th><th>Thành tiền</th>
      </tr></thead><tbody>${donRows || `<tr><td colspan="9" style="text-align:center;">${nvId ? 'Tháng này nhân viên không tham gia bàn cắt nào (lương vẫn chia theo giờ công).' : 'Chưa có sổ cắt nào ghi trong tháng này.'}</td></tr>`}
        <tr data-tong style="font-weight:bold;"><td></td><td colspan="6" style="text-align:right;">${nvId ? 'TỔNG BÀN CÓ THAM GIA' : 'TỔNG BÀN CẮT'}: ${soDoHien.length} sơ đồ / ${donHien.length} lệnh SX</td>
            <td style="text-align:right;">${num(soDoHien.reduce((s, x) => s + num(x.TongLop), 0))}</td>
            <td style="text-align:right;">${money(nvId ? tienHien : d.quy)}</td></tr>
      </tbody></table>`;
  }
  // Bản in phiếu lương 1 nhân viên: kèm luôn bảng quỹ (để công nhân đối chiếu cách chia).
  function buildLuongCatNVBody(nv, d) {
    return `<h2 style="text-align:center;">PHIẾU LƯƠNG TRẢI VẢI CẮT — Tháng ${kyCua(d)}</h2>
      <p><b>Nhân viên:</b> ${escapeHtml(nv.HoTen || '')} (${escapeHtml(nv.MaNhanVien || '')})</p>
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="6">
        <tr><td style="width:45%;background:#f5f6f8;"><b>Tổng giờ công trong tháng</b></td><td>${num(nv.TongGioLam)} giờ${nv.TongCong != null ? ` (${num(nv.TongCong)} công / ${num(nv.SoNgay)} ngày)` : ''}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>Hệ số lương</b></td><td>${num(nv.HeSoLuong)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>Quỹ lương cắt tháng</b></td><td>${money(d.quy)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>Tổng giờ toàn bộ phận Cắt</b></td><td>${num(d.tongGio)} giờ</td></tr>
        <tr><td style="background:#f5f6f8;"><b>Lương 1 giờ</b></td><td>${money(d.donGiaGio)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>LƯƠNG KHOÁN THÁNG</b></td><td style="font-weight:700;">${money(nv.ThanhTien)} <span style="font-weight:400;font-size:12px;">= ${num(nv.TongGioLam)} giờ × ${num(nv.HeSoLuong)} × ${money(d.donGiaGio)}</span></td></tr>
      </table>
      ${/* v9.20: phần này trước đây in CẢ quỹ tháng (mọi bàn cắt của bộ phận). Nguyen 2026-11-04:
           chỉ hiện bàn cắt mà chính nhân viên này trải vải hoặc cắt. */''}
      <h3 style="margin:14px 0 4px;">Bàn cắt ${escapeHtml(nv.HoTen || '')} tham gia trong tháng</h3>
      ${buildLuongCatQuyBody(d, nv)}`;
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
        <th>Sơ đồ</th><th>Ngày cắt</th><th>Ngày QC</th><th>STT sổ cắt</th><th>Mã rập</th><th>Mét sơ đồ</th><th>Khổ vải</th><th>Tổng lớp</th><th>Người trải vải</th><th>Người cắt</th><th>Thành tiền</th>
      </tr></thead><tbody>${list.map((s, i) => `<tr><td style="text-align:center;">${i + 1}</td>
        <td style="text-align:center;">${i + 1}/${list.length}</td><td>${fmtDate(s.NgayGhiNhan)}</td><td>${fmtDate(s.NgayQC)}</td>
        <td style="text-align:center;">${escapeHtml(s.SttSoCat != null ? String(s.SttSoCat) : '')}</td>
        ${/* v9.19: sơ đồ chưa khai mã rập thì lùi về mã rập của CẢ LỆNH — khớp với sheet "Chi tiết
             sơ đồ" của file Excel (trước đây màn để trống, Excel lại có, hai nơi nhìn khác nhau). */''}
        <td>${escapeHtml(String(s.MaRap || '').trim() || o.MaRap || '')}</td>
        <td style="text-align:right;">${num(s.MetSoDoDai)}</td><td style="text-align:right;">${num(s.KhoVaiSoDo)}</td>
        <td style="text-align:right;">${num(s.TongLop)}</td>
        <td>${escapeHtml(s.NhanVienTraiVai || '')}</td><td>${escapeHtml(s.NhanVienCat || '')}</td>
        <td style="text-align:right;">${money(s.ThanhTien)}</td></tr>`).join('')}
        <tr data-tong style="font-weight:bold;"><td></td><td colspan="10" style="text-align:right;">TỔNG</td><td style="text-align:right;">${money(o.ThanhTien)}</td></tr>
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
  /* v9.19 — NGÀY CẮT của một LỆNH trên bảng "Bàn cắt theo lệnh sản xuất" (thay cột Ngày QC cũ).
     Một lệnh nhiều sơ đồ ghi nhiều ngày ⇒ hiện KHOẢNG "dd/mm – dd/mm"; cùng ngày thì một ngày.
     ⚠️ BẢN SAO CÓ CHỦ ĐÍCH của chuoiNgayCat() trong backend/routes/payroll.js (file Excel dùng bản
     backend) — không có bundler để dùng chung; đổi quy tắc thì đổi CẢ HAI, bộ kiểm so hai bản. */
  function khoangNgayCat(o) {
    const a = o && o.NgayCatDau ? fmtDate(o.NgayCatDau) : '';
    const b = o && o.NgayCatCuoi ? fmtDate(o.NgayCatCuoi) : '';
    if (!a && !b) return '';
    if (!a || !b || a === b) return a || b;
    return a + ' – ' + b;
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
      <button class="btn small secondary" id="btnInBangCat">🖨️ In bảng lương</button>
      ${/* v9.19: 3 sheet — bảng lương NV Cắt / bàn cắt theo lệnh / chi tiết sơ đồ, cùng bộ số với màn. */''}
      <button class="btn small secondary" id="btnExCat">📊 Xuất Excel</button>`;
    container.innerHTML = periodBar(null, actions) + lcTomTat(d) + `
      <h4 style="margin:4px 0;">Bảng lương nhân viên bộ phận Cắt <span style="font-weight:400;font-size:12px;color:#5f6368;">(bấm 1 nhân viên để xem / in phiếu lương)</span></h4>
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã NV</th><th>Họ tên</th><th>Giờ công</th><th>Hệ số</th><th>Lương 1 giờ</th><th>Lương khoán tháng</th></tr></thead>
      <tbody>${(d.nhanVien || []).map((r, __i) => `<tr class="lc-nv" data-nvid="${r.NhanVienID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td>
        <td style="text-align:right;">${num(r.TongGioLam)}</td><td style="text-align:right;">${num(r.HeSoLuong)}</td>
        <td style="text-align:right;">${money(d.donGiaGio)}</td>
        <td style="text-align:right;font-weight:600;">${money(r.ThanhTien)}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty-hint">Chưa có nhân viên bộ phận Cắt, hoặc chưa có chấm công tháng này.</td></tr>'}</tbody>
      ${(d.nhanVien || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="2" style="text-align:right;">TỔNG</td><td style="text-align:right;">${num(d.tongGio)}</td><td></td><td></td><td style="text-align:right;">${money(d.tongLuong)}</td></tr></tfoot>` : ''}</table>

      <h4 style="margin:16px 0 4px;">Bàn cắt theo lệnh sản xuất <span style="font-weight:400;font-size:12px;color:#5f6368;">(bấm 1 lệnh để xem / in chi tiết từng sơ đồ)</span></h4>
      ${/* v9.18: quỹ tháng = mọi sổ cắt GHI trong tháng (không chờ QC).
           v9.19 (Nguyen 2026-11-04): cột "Ngày QC" → "NGÀY CẮT" (khoảng ngày ghi tiến độ của các sơ
           đồ trong lệnh); cột "Mã hàng" → "MÃ RẬP" (nguồn: công đoạn Kỹ thuật — gộp bảng Sơ đồ +
           ghi tiến độ KT qua utils/maRapCuaDon.js). */''}
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã ĐH</th><th>Mã rập</th><th>Tên sản phẩm</th><th>Ngày cắt</th><th>Số sơ đồ</th><th>Tổng lớp</th><th>Thành tiền</th></tr></thead>
      <tbody>${(d.theoDon || []).map((o, __i) => `<tr class="lc-don" data-donid="${o.DonHangID}" style="cursor:pointer;"><td style="text-align:center;">${__i + 1}</td>
        <td>${escapeHtml(o.MaDH || '')}</td><td>${escapeHtml(o.MaRap || '')}</td><td>${escapeHtml(o.TenSanPham || '')}</td>
        <td>${escapeHtml(khoangNgayCat(o))}</td>
        <td style="text-align:center;">${o.SoSoDo}</td><td style="text-align:right;">${num(o.TongLop)}</td>
        <td style="text-align:right;font-weight:600;">${money(o.ThanhTien)}</td></tr>`).join('')
        || '<tr><td colspan="8" class="empty-hint">Chưa có sổ cắt nào ghi trong tháng này.</td></tr>'}</tbody>
      ${(d.theoDon || []).length ? `<tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="4" style="text-align:right;">TỔNG BÀN CẮT</td><td style="text-align:center;">${(d.soDo || []).length}</td><td></td><td style="text-align:right;">${money(d.quy)}</td></tr></tfoot>` : ''}</table>
      <p style="color:#5f6368;font-size:12px;margin-top:8px;">Mét sơ đồ / khổ vải lấy từ sơ đồ của lệnh SX. Giờ công lấy từ Chấm công (cột Số giờ làm) của nhân viên bộ phận "Cắt" trong tháng.
        <b>Quỹ tháng = mọi sổ cắt GHI trong tháng — không chờ QC</b> (v9.18, bỏ luật chờ-QC v9.02 cho riêng quỹ cắt; các bảng lương khác vẫn chờ QC).
        Cột <b>Ngày cắt</b> = ngày ghi tiến độ của các sơ đồ trong lệnh (nhiều ngày thì hiện khoảng đầu – cuối). Cột <b>Mã rập</b> lấy từ công đoạn <b>Kỹ thuật</b> (bảng Sơ đồ + mã rập gõ lúc ghi tiến độ KT) — trống nghĩa là Kỹ thuật chưa khai mã rập cho lệnh đó.</p>`;
    wirePeriod(container, renderLuongTraiVaiCat);
    themOTimTuDong(container);   // v9.05: ô tìm cho bảng lương NV Cắt + bảng bàn cắt theo lệnh SX
    const bc = container.querySelector('#btnCfgCat'); if (bc) bc.addEventListener('click', () => openCauHinhLuongCat(d));
    // v9.19: xuất Excel 3 sheet — dùng downloadFile() chung (báo lỗi bằng toast nếu máy chủ từ chối).
    const bxc = container.querySelector('#btnExCat');
    if (bxc) bxc.addEventListener('click', () => downloadFile(
      `/api/payroll/luongtraivaicat/excel?nam=${selNam}&thang=${selThang}`, `LuongTraiVaiCat_T${selThang}_${selNam}.xlsx`));
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
        <td style="text-align:right;">${money(d.donGiaGio)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;">—</td></tr>'}
        <tr data-tong style="font-weight:bold;"><td></td><td colspan="2" style="text-align:right;">TỔNG</td><td style="text-align:right;">${num(d.tongGio)}</td><td></td><td></td><td style="text-align:right;">${money(d.tongLuong)}</td></tr>
      </tbody></table>
      <p style="font-size:13px;">Quỹ lương cắt tháng: <b>${money(d.quy)}</b> · Lương 1 giờ: <b>${money(d.donGiaGio)}</b> · Chênh lệch tổng lương so với quỹ: <b>${money(d.chenhLech)}</b></p>
      ${buildLuongCatQuyBody(d)}`;
  }

  /* v9.60: buildLuongCatNVBody dùng chung cho "Bảng lương của tôi" (module.mypay.js) — phiếu lương trải
     vải cắt của nhân viên tự xem phải nói đúng một thứ với phiếu kế toán in (cùng hàm, không bản hai). */
  return { render, getTabs, buildLuongCatNVBody };
})();
