// ================================================================
// PHAN HE "BANG LUONG CUA TOI" (MYPAY) - v6.2 Phase 3 (self-service)
// ----------------------------------------------------------------
// Hien cho MOI nhan vien dang nhap (module MYPAY duoc cap CanView cho tat ca nhom -
// xem migration_v620.sql). Nhan vien CHI thay luong CUA CHINH MINH: backend loc theo
// Users.NhanVienID (endpoint /cuatoi chi can requireAuth). Neu tai khoan chua duoc
// lien ket voi ho so nhan vien (Quan ly User -> chon nhan vien), se bao huong dan.
// ================================================================
window.ModuleMyPay = (function () {
  let container;
  const now = new Date();
  let selNam = now.getFullYear(), selThang = now.getMonth() + 1;
  const money = (v) => (v == null || v === '' ? '0' : fmtNumber(Number(v)));
  const num = (v) => Number(v) || 0;

  function getTabs() { return [{ key: 'luongcuatoi', label: 'Bảng lương của tôi' }]; }

  function periodBar() {
    const years = []; for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) years.push(y);
    return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
      <label style="font-weight:600;">Kỳ lương:</label>
      <select id="myNam">${years.map(y => `<option value="${y}" ${y === selNam ? 'selected' : ''}>Năm ${y}</option>`).join('')}</select>
      <select id="myThang">${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `<option value="${m}" ${m === selThang ? 'selected' : ''}>Tháng ${m}</option>`).join('')}</select>
    </div>`;
  }
  function wirePeriod() {
    const yn = container.querySelector('#myNam'), tn = container.querySelector('#myThang');
    if (yn) yn.addEventListener('change', e => { selNam = parseInt(e.target.value, 10); draw(); });
    if (tn) tn.addEventListener('change', e => { selThang = parseInt(e.target.value, 10); draw(); });
  }

  async function render(el) { container = el; return draw(); }

  async function draw() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let cn, may;
    try {
      cn = (await apiGet(`/api/payroll/bangluong/cuatoi?nam=${selNam}&thang=${selThang}`)).data;
      may = (await apiGet(`/api/payroll/luongmay/cuatoi?nam=${selNam}&thang=${selThang}`)).data;
    } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }

    if (cn.linked === false && may.linked === false) {
      container.innerHTML = periodBar() + `<div class="empty-hint" style="line-height:1.6;">
        Tài khoản của bạn <b>chưa được liên kết</b> với hồ sơ nhân viên nên chưa xem được bảng lương.<br>
        Vui lòng liên hệ quản trị: <i>Quản lý User → sửa tài khoản của bạn → chọn "Liên kết nhân viên"</i>.</div>`;
      wirePeriod(); return;
    }

    const r = (cn.rows || [])[0];
    const tongMay = (may.rows || []).reduce((s, x) => s + num(x.ThanhTien), 0);
    const line = (k, v, bold) => `<div style="display:flex;justify-content:space-between;padding:3px 0;${bold ? 'font-weight:700;border-top:1px solid #ddd;margin-top:4px;padding-top:6px;' : ''}"><span>${k}</span><span>${v}</span></div>`;
    container.innerHTML = periodBar() + `
      <h3>Lương công nhật — Tháng ${selThang}/${selNam}</h3>
      ${r ? `<div style="max-width:460px;border:1px solid #e0e0e0;border-radius:8px;padding:12px 16px;">
        ${line('Công thực tế', num(r.Cong))}
        ${line('Lương cơ bản', money(r.LuongCoBan))}
        ${line('Lương ngày công', money(r.LuongNgayCong))}
        ${line('Phụ cấp (ăn ca + trang phục)', money(r.TnMienThue))}
        ${line('TN chịu thuế', money(r.TnChiuThue))}
        ${line('Trừ bảo hiểm (10.5%)', '-' + money(r.TongBH))}
        ${line('Thuế TNCN', '-' + money(r.ThueTNCN))}
        ${line('Tạm ứng', '-' + money(r.TamUng))}
        ${line('THỰC LĨNH', money(r.ThucLinh), true)}
      </div>` : `<div class="empty-hint">Chưa có bảng lương công nhật tháng này (chưa chốt/tính).</div>`}
      <h3 style="margin-top:18px;">Lương khoán may — Tháng ${selThang}/${selNam}</h3>
      ${(may.rows || []).length ? `<div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Mã ĐH</th><th>Công đoạn</th><th>Ngày</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>${may.rows.map((x, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(x.MaDH || '')}</td><td>${escapeHtml(x.TenCongDoan || '')}</td><td>${fmtDate(x.NgayGhiNhan)}</td><td style="text-align:right;">${num(x.SoLuong)}</td><td style="text-align:right;">${money(x.DonGia)}</td><td style="text-align:right;">${money(x.ThanhTien)}</td></tr>`).join('')}</tbody>
        <tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="5" style="text-align:right;">TỔNG KHOÁN MAY</td><td style="text-align:right;">${money(tongMay)}</td></tr></tfoot></table></div>`
        : `<div class="empty-hint">Không có lương khoán may tháng này.</div>`}`;
    wirePeriod();
  }

  return { render, getTabs };
})();
