// ================================================================
// PHAN HE "BANG LUONG CUA TOI" (MYPAY) - v6.2 Phase 3 (self-service)
// ----------------------------------------------------------------
// Hien cho MOI nhan vien dang nhap (module MYPAY duoc cap CanView cho tat ca nhom -
// xem migration_v620.sql; v9.59: tai khoan co NhanVienID TU co MYPAY bat ke nhom —
// luat o backend/utils/loadUserContext.js). Nhan vien CHI thay luong CUA CHINH MINH:
// backend loc theo Users.NhanVienID (endpoint /cuatoi chi can requireAuth). Neu tai
// khoan chua duoc lien ket voi ho so nhan vien (Quan ly User -> chon nhan vien), se bao
// huong dan. v9.60: + muc Luong trai vai cat (chi bo phan Cat), muc Luong khoan may chi
// bo phan May (hoac co dong that).
// ================================================================
window.ModuleMyPay = (function () {
  let container;
  const now = new Date();
  let selNam = now.getFullYear(), selThang = now.getMonth() + 1;
  const money = (v) => (v == null || v === '' ? '0' : fmtNumber(Number(v)));
  const num = (v) => Number(v) || 0;

  /* v9.99 — Nguyen 23/11/2026: "Bảng lương của tôi đang hiện bảng chấm công trên 1 trang. Sửa thành
     1 chức năng bảng chấm công trong bảng lương của tôi. Vẫn auto có khi tạo user."
     ⇒ Bảng chấm công TÁCH khỏi trang phiếu lương, thành MỘT CHỨC NĂNG (menu con) riêng của phân hệ
     MYPAY. Dòng ChucNang 'MYPAY/chamcongcuatoi' khai ở migration_v908.sql với MacDinhCho = 1 ⇒ TICK
     SẴN, nên tài khoản mới TỰ CÓ (đúng "vẫn auto có khi tạo user"); quản trị muốn giấu thì bỏ tick ở
     Ma trận phân quyền. Chưa chạy migration cũng không sao: không có dòng cấu hình = được xem. */
  function getTabs() {
    return [
      { key: 'luongcuatoi', label: 'Bảng lương của tôi' },
      { key: 'chamcongcuatoi', label: 'Chấm công của tôi' },
      { key: 'congdoanmaycuatoi', label: 'Công đoạn may của tôi' }
    ];
  }

  /* Chức năng đang mở — ô chọn kỳ lương (periodBar) dùng chung cho cả ba, nên khi đổi tháng phải
     vẽ lại ĐÚNG trang đang xem, không mặc định quay về phiếu lương. */
  let tabHienTai = 'luongcuatoi';
  const VE_THEO_TAB = {
    chamcongcuatoi: () => drawChamCong(),
    congdoanmaycuatoi: () => drawCongDoanMay()
  };
  const veLai = () => (VE_THEO_TAB[tabHienTai] || draw)();

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
    if (yn) yn.addEventListener('change', e => { selNam = parseInt(e.target.value, 10); veLai(); });
    if (tn) tn.addEventListener('change', e => { selThang = parseInt(e.target.value, 10); veLai(); });
  }

  let currentUser = null;
  /* app.js gọi render(content, currentUser, tabKey) — trước v9.99 module này chỉ có 1 chức năng nên
     bỏ qua tabKey. Nay có 2, phải định tuyến; tabKey rỗng (mở thẳng phân hệ) ⇒ giữ trang đang xem. */
  async function render(el, user, tabKey) {
    container = el; currentUser = user || currentUser;
    if (tabKey) tabHienTai = tabKey;
    return veLai();
  }
  /* v9.67c: phân quyền — ChucNang MYPAY/sanluongcuatoi (migration_v895). Quản trị bỏ tick ⇒ ẩn mục, không gọi API
     (máy chủ cũng chặn 403 — hai lớp cùng một luật). */
  /* v9.67d: MacDinhCho = 0 ("mặc định không có") ⇒ loadUserContext điền canView=false vào chucNangPerm (không vào
     hiddenChucNang) — hỏi cả hai cho chắc. Admin luôn thấy. */
  const bimatSanLuong = () => {
    if (!currentUser || currentUser.isAdmin) return false;
    const cn = currentUser.chucNangPerm && currentUser.chucNangPerm['MYPAY:sanluongcuatoi'];
    return (cn && cn.canView === false) || (currentUser.hiddenChucNang || []).indexOf('MYPAY:sanluongcuatoi') !== -1;
  };

  /* v9.60 — Nguyen 14/11/2026: "Bảng lương của tôi, nhân viên bộ phận cắt thể hiện bảng lương cắt trải vải.
     Chỉ thể hiện bảng lương của nhân viên được gắn vào."
     Máy chủ đã CẮT về một người (/luongtraivaicat/cuatoi: một dòng lương + chỉ bàn cắt người đó tham gia;
     không thuộc bộ phận Cắt ⇒ boPhanCat:false ⇒ không có mục này — không vẽ mục trống cho người không
     liên quan). Phiếu dựng bằng CHÍNH hàm của tab kế toán (ModulePayroll.buildLuongCatNVBody): cùng cách
     chia, cùng câu chữ, không viết bản thứ hai. Thiếu hàm (module.payroll.js cũ) hay máy chủ lỗi thì NÓI,
     không im. */
  function phanLuongCat(cat) {
    if (!cat || cat.linked === false || cat.boPhanCat === false) return '';
    if (cat.loi) return `<p style="font-size:12px;color:#b06000;margin-top:18px;">Không tải được lương trải vải cắt: ${escapeHtml(cat.loi)}</p>`;
    const PR = window.ModulePayroll;
    if (!cat.nhanVien || !PR || typeof PR.buildLuongCatNVBody !== 'function') {
      return '<p style="font-size:12px;color:#b06000;margin-top:18px;">Không dựng được phiếu lương trải vải cắt (module.payroll.js chưa cập nhật?).</p>';
    }
    return `<div style="margin-top:22px;max-width:900px;">${PR.buildLuongCatNVBody(cat.nhanVien, cat)}</div>`;
  }

  /* v9.69 — bảng chấm công của chính mình: ngày, thứ, mã, giờ vào, giờ ra, công, tăng ca.
     Ngày/giờ là CHUỖI từ máy chủ (không qua Date — tránh lệch múi giờ). Chủ nhật tô nhạt.
     v9.99: không còn nằm cạnh phiếu lương nữa — hàm này giờ là thân của chức năng "Chấm công của
     tôi" (drawChamCong ngay bên dưới). Giữ nguyên cách dựng bảng, chỉ đổi chỗ đặt. */
  function phanChamCong(cc) {
    if (!cc || cc.linked === false) return '';
    if (cc.loi) return `<p style="font-size:12px;color:#b06000;">Không tải được chấm công: ${escapeHtml(cc.loi)}</p>`;
    const rows = cc.rows || [];
    const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const thuCua = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? THU[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : ''; };
    const ddmm = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? `${m[3]}/${m[2]}` : escapeHtml(String(s || '')); };
    const ot = (r) => (num(r.GioTangCaThuong) + num(r.GioTangCaChuNhat) + num(r.GioTangCaLeTet)) || '';
    return `<div style="font-weight:600;margin-bottom:6px;">Chấm công — ${rows.length} ngày · ${num(cc.tongCong)} công${num(cc.tongGioTangCa) ? ` · ${num(cc.tongGioTangCa)} giờ tăng ca` : ''}</div>
      ${rows.length ? `<div style="overflow:auto;max-height:520px;"><table style="font-size:13px;"><thead><tr><th>Ngày</th><th>Thứ</th><th>Mã</th><th>Giờ vào</th><th>Giờ ra</th><th>Công</th><th>TC (giờ)</th><th>Ghi chú</th></tr></thead>
        <tbody>${rows.map(r => `<tr${thuCua(r.Ngay) === 'CN' ? ' style="background:#fff8e1;"' : ''}><td>${ddmm(r.Ngay)}</td><td>${thuCua(r.Ngay)}</td><td style="text-align:center;">${escapeHtml(r.MaCham || '')}</td>
          <td style="text-align:center;">${escapeHtml(r.GioVao || '')}</td><td style="text-align:center;">${escapeHtml(r.GioRa || '')}</td><td style="text-align:right;">${num(r.SoCong) || ''}</td><td style="text-align:right;">${ot(r)}</td><td style="font-size:12px;color:#5f6368;">${escapeHtml(r.GhiChu || '')}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-hint">Chưa có ngày chấm công nào trong tháng này.</div>'}`;
  }

  /* v9.99 — CHỨC NĂNG RIÊNG "Chấm công của tôi". Chỉ gọi một route duy nhất; trang phiếu lương
     KHÔNG gọi /chamcong/cuatoi nữa (bớt một lượt gọi cho mỗi lần mở bảng lương).
     phanChamCong() trả chuỗi RỖNG khi tài khoản chưa gắn nhân viên — ở trang riêng thì màn trắng là
     vô nghĩa, nên nói rõ lý do y như trang phiếu lương vẫn nói (không im lặng giấu mục). */
  async function drawChamCong() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let cc;
    try { cc = (await apiGet(`/api/payroll/chamcong/cuatoi?nam=${selNam}&thang=${selThang}`)).data; }
    catch (e) { cc = { loi: e.message }; }
    const than = phanChamCong(cc);
    container.innerHTML = periodBar() + `
      <h3>Chấm công của tôi — Tháng ${selThang}/${selNam}</h3>
      ${than || `<div class="empty-hint" style="line-height:1.6;">
        Tài khoản của bạn <b>chưa được liên kết</b> với hồ sơ nhân viên nên chưa xem được chấm công.<br>
        Vui lòng liên hệ quản trị: <i>Quản lý User → sửa tài khoản của bạn → chọn "Liên kết nhân viên"</i>.</div>`}`;
    wirePeriod();
  }

  /* v9.99 — CHỨC NĂNG RIÊNG "Công đoạn may của tôi" (Nguyen 23/11: "Tách luôn công đoạn may thành
     chức năng riêng trong bảng lương của tôi"). Trước đây là mục cuối trang phiếu lương.
     Thân mục do `phanCongDoanMayCuaToi()` dựng — GIỮ NGUYÊN, kể cả câu lý do khi người xem không
     thuộc bộ phận May (máy chủ quyết, xem chanNeuKhongPhaiThoMay trong routes/qlsx.js). Hàm đó chỉ
     trả rỗng khi tài khoản CHƯA gắn hồ sơ nhân viên ⇒ ở trang riêng phải tự nói, không để trắng. */
  async function drawCongDoanMay() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let cm;
    try { cm = (await apiGet(`/api/qlsx/congdoanmay/cuatoi?nam=${selNam}&thang=${selThang}`)).data; }
    catch (e) { cm = { loi: e.message }; }
    const than = phanCongDoanMayCuaToi(cm);
    container.innerHTML = periodBar() + (than || `<div class="empty-hint" style="line-height:1.6;">
      Tài khoản của bạn <b>chưa được liên kết</b> với hồ sơ nhân viên nên chưa ghi được công đoạn may.<br>
      Vui lòng liên hệ quản trị: <i>Quản lý User → sửa tài khoản của bạn → chọn "Liên kết nhân viên"</i>.</div>`);
    wirePeriod();
    wireCongDoanMayCuaToi(cm);
  }

  async function draw() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let cn, may, cat;
    try {
      cn = (await apiGet(`/api/payroll/bangluong/cuatoi?nam=${selNam}&thang=${selThang}`)).data;
      may = (await apiGet(`/api/payroll/luongmay/cuatoi?nam=${selNam}&thang=${selThang}`)).data;
    } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${escapeHtml(e.message)}</div>`; return; }
    /* v9.60: lương trải vải cắt — route tự phục vụ riêng; lỗi ở đây KHÔNG làm mất hai phần trên (máy chủ
       chưa cập nhật thì chỉ thiếu phần cắt, và nói rõ vì sao). */
    try { cat = (await apiGet(`/api/payroll/luongtraivaicat/cuatoi?nam=${selNam}&thang=${selThang}`)).data; }
    catch (e) { cat = { loi: e.message }; }
    /* v9.67: sản lượng theo lệnh CỦA TÔI — chỉ khi hợp đồng kiểu "Theo sản phẩm" (máy chủ quyết). Lỗi ⇒ nói, không mất phần trên. */
    /* v9.99: chấm công và công đoạn may KHÔNG tải ở đây nữa — mỗi cái là một chức năng riêng
       (drawChamCong / drawCongDoanMay). Trang phiếu lương bớt hai lượt gọi mỗi lần mở. */
    let sl = null;
    if (!bimatSanLuong()) {
      try { sl = (await apiGet(`/api/qlsx/sanluong/cuatoi?nam=${selNam}&thang=${selThang}`)).data; }
      catch (e) { sl = { loi: e.message }; }
    }

    if (cn.linked === false && may.linked === false) {
      container.innerHTML = periodBar() + `<div class="empty-hint" style="line-height:1.6;">
        Tài khoản của bạn <b>chưa được liên kết</b> với hồ sơ nhân viên nên chưa xem được bảng lương.<br>
        Vui lòng liên hệ quản trị: <i>Quản lý User → sửa tài khoản của bạn → chọn "Liên kết nhân viên"</i>.</div>`;
      wirePeriod(); return;
    }

    const r = (cn.rows || [])[0];
    const tongMay = (may.rows || []).reduce((s, x) => s + num(x.ThanhTien), 0);
    const line = (k, v, bold) => `<div style="display:flex;justify-content:space-between;padding:3px 0;${bold ? 'font-weight:700;border-top:1px solid #ddd;margin-top:4px;padding-top:6px;' : ''}"><span>${k}</span><span>${v}</span></div>`;
    // Dòng chỉ hiện khi có số — phiếu của nhân viên không nên đầy dòng 0.
    const lineNeu = (k, v) => (num(v) ? line(k, money(v)) : '');
    /* v9.45 — cùng cách đọc với phiếu lương ở màn kế toán (module.payroll.js buildLuongCongNhatNVBody):
       · Thuế TNCN nay được TÍNH nhưng chỉ TRỪ khi cấu hình bật (cờ ThueDaTru) — bản cũ in cứng "−thuế"
         nên các dòng cộng lại KHÔNG ra thực lĩnh, nhân viên đi hỏi kế toán (rà chéo v9.45 bắt được).
       · Thêm dòng Điều chỉnh (± có lý do) — thiếu nó thì −200k của Ngọc lại thành con số không giải thích.
       · "Công" tách phép ra: r.Cong GỒM cả phép (không lương). */
    const coV890 = r && r.KieuLuong != null;
    /* v9.53: máy chủ tự tính lại bảng khi có biến động (ngay trong GET /bangluong/cuatoi) — chỉ nói LÚC NÀO,
       không nói vì sao (lý do nhắc tới phiếu chi / hợp đồng của người khác). */
    const td = cn.tuDong || {};
    const lucTD = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(String(s || '')); return m ? `${m[4]} ${m[3]}/${m[2]}` : escapeHtml(String(s || '')); };
    const dongTD = td.luc ? `<div style="font-size:12px;color:#5f6368;margin:-6px 0 8px;">${td.daTinhLai ? '⟳ Vừa cập nhật tự động lúc' : 'Số liệu tính lúc'} ${lucTD(td.luc)}${td.daChot ? ' — bảng đã chốt' : ' — tự cập nhật khi có biến động chấm công / tạm ứng / hợp đồng'}</div>` : '';
    /* v9.60 — Nguyen 14/11: "Lương khoán may chỉ những người thuộc bộ phận may mới hiện ra". boPhanMay do máy
       chủ trả (/luongmay/cuatoi, so tên bộ phận "May"); máy chủ cũ chưa trả (undefined) thì giữ như trước.
       Có dòng khoán may THẬT thì vẫn hiện dù khác bộ phận — tiền có thì không được giấu. */
    const hienMay = may.boPhanMay === undefined || !!may.boPhanMay || (may.rows || []).length > 0;
    container.innerHTML = periodBar() + `
      <h3>Lương công nhật — Tháng ${selThang}/${selNam}</h3>${dongTD}
      ${/* v9.99: bỏ cột phải (bảng chấm công) — nay là chức năng riêng "Chấm công của tôi". Phiếu lương về MỘT cột. */''}
      <div style="max-width:560px;">
      ${r ? `<div style="border:1px solid #e0e0e0;border-radius:8px;padding:12px 16px;">
        ${coV890
          ? line('Công hưởng lương' + (num(r.CongThuViec) ? ' (thử việc ' + num(r.CongThuViec) + ')' : ''), num(r.CongThuViec) + num(r.CongChinhThuc))
            + (num(r.SoPhep) ? line('Ngày phép (không lương)', num(r.SoPhep)) : '')
            + (num(r.SoKhongPhep) ? line('Ngày nghỉ không phép', num(r.SoKhongPhep)) : '')   // v9.55
            + (r.KieuLuong === 'Ngay' ? line('Đơn giá ngày', money(r.DonGiaNgay)) : line('Lương cơ bản', money(r.LuongCoBan)))
          : line('Công thực tế', num(r.Cong)) + line('Lương cơ bản', money(r.LuongCoBan))}
        ${line('Lương ngày công', money(r.LuongNgayCong))}
        ${lineNeu(`Tăng ca (${num(r.GioOT)} giờ)`, r.TangCa)}
        ${/* v9.73: mỗi kiểu thưởng MỘT dòng (KPI / sản phẩm / chuyên cần bậc thang) — common.js cacDongThuongPhieuLuong; nhiều dòng thì in cả dòng 0 */''}
        ${(() => { const ds = cacDongThuongPhieuLuong(r); return ds.map(x => ds.length === 1 ? lineNeu(x.nhan, x.tien) : line(x.nhan, money(x.tien))).join(''); })()}
        ${lineNeu('Phụ cấp ăn ca', r.PcAnCa)}${lineNeu('Phụ cấp trang phục', r.PcTrangPhuc)}
        ${lineNeu('Phụ cấp xăng xe', r.PcXangXe)}${lineNeu('Phụ cấp điện thoại', r.PcDienThoai)}
        ${lineNeu('Phụ cấp chức vụ', r.PcChucVu)}${lineNeu('Chuyên cần', r.ChuyenCan)}
        ${num(r.TongBH) ? line('Trừ bảo hiểm (10,5%)', '-' + money(r.TongBH)) : ''}
        ${num(r.ThueTNCN) ? (r.ThueDaTru ? line('Thuế TNCN', '-' + money(r.ThueTNCN)) : line('Thuế TNCN (tính để xem, chưa trừ)', money(r.ThueTNCN))) : ''}
        ${num(r.TamUng) ? line('Tạm ứng', '-' + money(r.TamUng)) : ''}
        ${num(r.DieuChinh) ? line('Điều chỉnh' + (r.LyDoDieuChinh ? ' — ' + escapeHtml(r.LyDoDieuChinh) : ''), (num(r.DieuChinh) > 0 ? '+' : '') + money(r.DieuChinh)) : ''}
        ${line('THỰC LĨNH', money(r.ThucLinh), true)}
      </div>` : `<div class="empty-hint">Chưa có dòng lương công nhật của bạn tháng này (chưa có hợp đồng hiệu lực, hoặc tháng cũ chưa tính).</div>`}
      </div>
      ${hienMay ? `<h3 style="margin-top:18px;">Lương khoán may — Tháng ${selThang}/${selNam}</h3>
      ${(may.rows || []).length ? `<div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Mã ĐH</th><th>Công đoạn</th><th>Ngày</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
        <tbody>${may.rows.map((x, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(x.MaDH || '')}</td><td>${escapeHtml(x.TenCongDoan || '')}</td><td>${fmtDate(x.NgayGhiNhan)}</td><td style="text-align:right;">${num(x.SoLuong)}</td><td style="text-align:right;">${money(x.DonGia)}</td><td style="text-align:right;">${money(x.ThanhTien)}</td></tr>`).join('')}</tbody>
        <tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="5" style="text-align:right;">TỔNG KHOÁN MAY</td><td style="text-align:right;">${money(tongMay)}</td></tr></tfoot></table></div>`
        : `<div class="empty-hint">Không có lương khoán may tháng này.</div>`}` : ''}
      ${phanLuongCat(cat)}
      ${phanSanLuongCuaToi(sl)}`;
    wirePeriod();
    wireSanLuongCuaToi(sl);
    themOTimTuDong(container);   // v9.05: ô tìm Mã ĐH / Công đoạn trong bảng lương khoán may
  }

  /* ================================================================================================
     🔴 v9.90 — CÔNG ĐOẠN MAY CỦA TÔI (Nguyen 23/11)

     *"Công đoạn may phần cập nhật nhân viên và số lượng có thể cho nhân viên tự nhập khi phân quyền...
     hoặc nhân viên thuộc bộ phận may nhập công đoạn của mình. Khi nhân viên tự nhập thì CHỈ HIỆN RA
     CHỌN CÔNG ĐOẠN VÀ ĐIỀN SỐ LƯỢNG. Để cả 2 cách cập nhật."* + *"chỉ nhìn thấy của mình... thêm tick
     quyền cho tổ trưởng nhìn thấy hết của mọi người."*

     Form rút gọn đúng yêu cầu: KHÔNG có ô chọn nhân viên (máy chủ ép = chính mình), KHÔNG có ô màu,
     KHÔNG có bảng giao việc. Chỉ: ngày · lệnh SX · công đoạn · số lượng.
     Ô LỆNH SX vẫn phải có — danh mục công đoạn may là của TỪNG LỆNH, không chọn lệnh thì không biết
     lấy bảng đơn giá nào (và lương khoán may tính theo đơn giá của chính lệnh đó).

     Đường ghi hộ ở QLSX › Ghi tiến độ › May GIỮ NGUYÊN — hai đường, một bảng `PhanCongMay`.
     ================================================================================================ */
  function phanCongDoanMayCuaToi(cm) {
    if (!cm || cm.linked === false) return '';
    if (cm.loi) return `<p style="font-size:12px;color:#b06000;margin-top:18px;">Không tải được công đoạn may: ${escapeHtml(cm.loi)}</p>`;
    /* 🔴 v9.93 — LUÔN VẼ MỤC NÀY, kể cả khi không được ghi.
       v9.90 `return ''` khi không phải bộ phận May: thợ may mở ra thấy TRỐNG TRƠN, không biết là
       chưa liên kết nhân viên, sai tên bộ phận, hay file chưa copy — đúng lỗi "ẩn mà không nói lý
       do" mà chính dự án này đã ghi thành luật. Nay hiện tiêu đề + CÂU LÝ DO của máy chủ. */
    const rows = cm.rows || [];
    const tuGhi = !!cm.laBoPhanMay;
    if (!tuGhi && !cm.xemTatCa) {
      return `<h3 style="margin-top:22px;">Công đoạn may của tôi</h3>
        <div class="empty-hint" style="text-align:left;line-height:1.6;">
          Bạn <b>chưa tự ghi được</b> công đoạn may.<br>${escapeHtml(cm.lyDo || 'Không rõ lý do — báo quản trị kiểm tra hồ sơ nhân viên và bộ phận.')}
        </div>`;
    }
    /* 🔴 v9.96 (Nguyen 23/11: "Phần này CHỈ HIỆN DANH SÁCH LỆNH. Khi click vào lệnh hiện list danh
       sách các công đoạn và công nhân đã cập nhật"): BỎ HẲN bảng dòng-phẳng-theo-tháng.
       Không mất gì: tổng lương khoán may theo tháng đã có mục "Lương khoán may" riêng ở trên cùng
       màn này (route /api/payroll/luongmay/cuatoi) — giữ hai bảng cùng nói một chuyện là thừa và
       sớm muộn lệch nhau. */
    return `<h3 style="margin-top:22px;">Công đoạn may${cm.xemTatCa ? ' — bạn xem được của CẢ TỔ' : ''}</h3>
      <div id="mcmLenhMay" class="empty-hint" style="margin:-2px 0 10px;">Đang tải danh sách lệnh...</div>
      ${cm.xemTatCa ? '<div style="font-size:12px;color:#5f6368;margin:-4px 0 8px;">Bạn có tick <b>MYPAY/congdoanmaytatca</b> — bấm vào một lệnh để xem ai đã làm, và <b>sửa được số lượng của mọi người</b> (bấm thẳng vào ô SL) khi lệnh còn ở công đoạn May.</div>' : ''}
      ${/* Bảng dòng-phẳng-theo-tháng ĐÃ BỎ (v9.96) — xem khối ghi chú ngay trên. */''}`;
  }
  /* v9.93: bảng LỆNH ĐANG Ở CÔNG ĐOẠN MAY — thợ may bấm thẳng vào lệnh để ghi phần của mình.
     Ba cột số để đối chiếu ngay: tổng bàn cắt · cả tổ đã may · còn lại. */
  async function veLenhDangMay(cm) {
    const box = container.querySelector('#mcmLenhMay');
    if (!box) return;
    let ds = [];
    try { ds = (await apiGet('/api/qlsx/congdoanmay/cuatoi/lenhmay')).data || []; }
    catch (e) { box.innerHTML = `<span style="color:#b06000;">Không tải được danh sách lệnh: ${escapeHtml(e.message)}</span>`; return; }
    if (!ds.length) {
      box.innerHTML = 'Hiện <b>không có lệnh nào đang ở công đoạn May</b>. Khi tổ trưởng chuyển lệnh sang công đoạn May thì lệnh sẽ tự hiện ở đây.';
      return;
    }
    box.className = '';
    /* v9.96: thêm cột ẢNH + MÃ RẬP (Nguyen: "Thêm mã rập và hình ảnh"); lệnh ĐANG ĐỨNG ở công đoạn
       May có chấm xanh và xếp trước — lệnh đã sang khâu khác vẫn hiện (còn phải ghi nốt) nhưng ghi
       rõ đang ở đâu, thay vì biến mất khiến màn hình trông như hỏng.
       🔴 v9.98 (Nguyen: "Lệnh đã đủ qua công đoạn may không hiện ra nữa"): mặc định ẨN lệnh đã đủ
       MỌI công đoạn. Nhưng KHÔNG ẩn hẳn — có ô tích "Hiện cả lệnh đã đủ", vì nếu ai lỡ ghi thừa thì
       đường DUY NHẤT để sửa/xóa là qua nút 👥 của chính dòng lệnh đó; ẩn cứng là bít lối sửa. */
    const dsDu = ds.filter(o => o.DuHet);
    const hienDu = !!(box.dataset.hienDu === '1');
    const dsHien = hienDu ? ds : ds.filter(o => !o.DuHet);
    box.innerHTML = `<div style="font-weight:600;margin-bottom:4px;">Lệnh có công đoạn may — bấm <b>👥</b> để xem ai đã làm, bấm <b>＋</b> để ghi phần của bạn</div>
      ${dsDu.length ? `<label style="display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:#5f6368;margin-bottom:6px;cursor:pointer;">
        <input type="checkbox" id="mcmHienDu" ${hienDu ? 'checked' : ''} style="width:auto;margin:0;">
        Hiện cả <b>${dsDu.length}</b> lệnh đã may đủ (chỉ cần khi phải sửa lại số đã ghi thừa)</label>` : ''}
      ${/* 🔴 v9.97 (Nguyen 23/11): BỎ cột "Còn lại" — nó lấy tổng MỌI công đoạn trừ tổng bàn cắt,
           lệnh 5 công đoạn thì ra số âm to đùng (−5964) hoàn toàn vô nghĩa. Số lượng so theo TỪNG
           CÔNG ĐOẠN, nên thay bằng cột GHI CHÚ liệt kê công đoạn nào còn thiếu bao nhiêu cái.
           Cột "Đã may" giữ lại nhưng ghi rõ là CỘNG MỌI CÔNG ĐOẠN, để không ai đem nó đi so nữa. */''}
      <div style="overflow:auto;"><table style="font-size:13px;"><thead><tr>
        <th style="width:52px;">Ảnh</th><th>Lệnh SX</th><th>Mã rập</th><th>Đang ở</th><th>Deadline</th>
        <th>Tổng bàn cắt</th><th>Đã may<div style="font-weight:400;font-size:10px;">(theo từng công đoạn)</div></th>
        <th>Ghi chú</th><th style="width:150px;"></th>
      </tr></thead><tbody>${dsHien.map(o => {
        const thieu = o.Thieu || [];
        const ghiChu = Number(o.TongSLCat) > 0
          ? (o.DuHet
              ? `<span style="color:#1e8e3e;font-weight:600;">✔ Đủ cả ${num(o.SoCongDoan)} công đoạn</span>`
              : (thieu.length
                  ? `<span style="color:#b06000;">Thiếu: ${thieu.map(t => `${escapeHtml(t.ten)} <b>${num(t.thieu)}</b>`).join(' · ')}</span>`
                  : '<span style="color:#5f6368;">chưa khai công đoạn may</span>'))
          : '<span style="color:#b06000;">chưa ghi sổ cắt — không có mốc để so</span>';
        return `<tr data-madh="${escapeHtml(o.MaDH)}">
          <td>${o.Anh ? `<a href="${escapeHtml(o.Anh)}" target="_blank"><img class="thumb" src="${escapeHtml(anhNho(o.Anh, 160))}" style="width:44px;height:44px;object-fit:cover;border-radius:4px;"></a>` : '<span style="color:#bbb;">—</span>'}</td>
          <td><b>${escapeHtml(o.MaDH)}</b><div style="font-size:12px;color:#5f6368;">${escapeHtml(o.TenSanPham || '')}</div></td>
          <td>${escapeHtml(o.MaRap || '')}</td>
          <td>${Number(o.DangOMay) === 1
            ? '<span style="color:#1e8e3e;font-weight:600;">● Đang ở May</span>'
            : `<span style="color:#b06000;">${escapeHtml(o.CongDoanHienTai || 'khâu khác')}</span>`}</td>
          <td>${fmtDate(o.NgayGiao)}</td>
          <td style="text-align:right;">${num(o.TongSLCat) || '<span style="color:#b06000;">—</span>'}</td>
          ${/* v9.98: liệt kê TỪNG công đoạn, KHÔNG cộng tổng. Đủ thì xanh, chưa đủ thì cam. */''}
          <td style="font-size:12.5px;">${(o.CongDoan || []).length
            ? (o.CongDoan || []).map(c => {
                const du = Number(o.TongSLCat) > 0 && c.daMay >= Number(o.TongSLCat);
                return `<div style="color:${du ? '#1e8e3e' : '#b06000'};">${escapeHtml(c.ten)}: <b>${num(c.daMay)}</b></div>`;
              }).join('')
            : '<span style="color:#5f6368;">—</span>'}</td>
          <td style="font-size:12.5px;">${ghiChu}</td>
          <td>${Number(o.DangOMay) === 1 ? '<button type="button" class="btn small mcm-ghi">＋ Ghi phần của tôi</button> ' : ''}<button type="button" class="btn small secondary mcm-ai">👥 Ai đã làm</button></td></tr>`;
      }).join('')}</tbody></table></div>`;
    /* Lọc xong rỗng thì NÓI RA, đừng để bảng trống không ai hiểu vì sao. */
    if (!dsHien.length) {
      box.insertAdjacentHTML('beforeend',
        `<div class="empty-hint" style="text-align:left;">Tất cả ${ds.length} lệnh đều đã may đủ mọi công đoạn — không còn gì phải ghi.${dsDu.length ? ' Tích ô trên nếu cần sửa lại số đã ghi.' : ''}</div>`);
    }
    const oTich = box.querySelector('#mcmHienDu');
    if (oTich) oTich.addEventListener('change', () => { box.dataset.hienDu = oTich.checked ? '1' : '0'; veLenhDangMay(cm); });
    box.querySelectorAll('.mcm-ghi').forEach(b => b.addEventListener('click', () => {
      const tr = b.closest('tr');
      const o = ds.find(x => x.MaDH === tr.dataset.madh);
      moFormCongDoanMayCuaToi(o);
    }));
    box.querySelectorAll('.mcm-ai').forEach(b => b.addEventListener('click', () => {
      moAiDaLamLenh(b.closest('tr').dataset.madh);
    }));
  }
  /* v9.95: nút "Ai đã làm" nay hiện cho MỌI thợ may (Nguyen: "Người khác cùng bộ phận may nhìn được
     số lượng của người khác từng công đoạn") — không còn phụ thuộc tick quyền. */
  /* v9.93 (Nguyen: "click vào 1 lệnh ra danh sách mọi người làm lệnh đó sẽ dễ nhìn hơn").
     v9.95: GOM THEO CÔNG ĐOẠN (Nguyen: "nhìn được số lượng của người khác TỪNG CÔNG ĐOẠN"), mỗi
     công đoạn có dòng tổng đối chiếu với tổng bàn cắt — đủ thì xanh, vượt thì đỏ. Kèm nút Sửa/Xóa
     ở những dòng máy chủ cho phép (cờ `suaDuoc`: lệnh còn ở công đoạn May VÀ là dòng của mình
     hoặc mình là tổ trưởng). Màn hình KHÔNG tự đoán luật — máy chủ nói. */
  async function moAiDaLamLenh(maDH) {
    let d;
    try { d = (await apiGet(`/api/qlsx/congdoanmay/lenh/${encodeURIComponent(maDH)}/moinguoi`)).data; }
    catch (e) { toast(e.message, 'error'); return; }
    const rows = d.rows || [];
    const tongCat = num(d.tongSLCat);
    // Gom theo công đoạn, giữ nguyên thứ tự máy chủ đã sắp (ThuTu của đơn giá).
    const nhom = [];
    rows.forEach(r => {
      const khoa = String(r.CongDoanID || '0');
      let g = nhom.find(x => x.khoa === khoa);
      if (!g) { g = { khoa, ten: r.TenCongDoan || '(đơn giá đã xóa)', ds: [] }; nhom.push(g); }
      g.ds.push(r);
    });
    const khoiCD = nhom.map(g => {
      const tongCD = g.ds.reduce((s, r) => s + num(r.SoLuong), 0);
      const mau = tongCat > 0 ? (tongCD > tongCat ? '#c0392b' : (tongCD >= tongCat ? '#1e8e3e' : '#b06000')) : '#5f6368';
      const ghi = tongCat > 0
        ? (tongCD > tongCat ? `VƯỢT ${tongCD - tongCat}` : (tongCD >= tongCat ? 'đủ' : `còn thiếu ${tongCat - tongCD}`))
        : 'chưa có tổng bàn cắt để so';
      return `<div style="margin-top:10px;">
        <div style="font-weight:700;">${escapeHtml(g.ten)}
          <span style="font-weight:400;color:${mau};">— ${tongCD}${tongCat > 0 ? ' / ' + tongCat : ''} (${ghi})</span></div>
        <table style="font-size:13px;width:100%;"><thead><tr><th>Nhân viên</th><th>Ngày</th><th style="width:70px;">SL</th>
          <th style="width:90px;">Đơn giá</th><th style="width:100px;">Thành tiền</th><th style="width:110px;"></th></tr></thead>
        <tbody>${g.ds.map(r => `<tr data-id="${r.ID}">
          <td>${escapeHtml(r.HoTen || '')}${r.cuaToi ? ' <span style="color:#0b57d0;font-size:12px;">(bạn)</span>' : ''}</td>
          <td>${fmtDate(r.Ngay)}</td>
          ${/* 🔴 v9.96 (Nguyen: "tổ trưởng kích vào ô SL của công nhân cần sửa để sửa số lượng"):
               ô SL BẤM THẲNG vào là sửa — không qua nút, không qua prompt. Ô nào sửa được thì có
               gạch chân nét đứt + con trỏ bàn tay để nhìn là biết bấm được. */''}
          <td style="text-align:right;">${r.suaDuoc
            ? `<a href="#" class="mcm-sl" title="Bấm để sửa số lượng" style="border-bottom:1px dashed #0b57d0;color:#0b57d0;font-weight:600;">${num(r.SoLuong)}</a>`
            : num(r.SoLuong)}</td>
          <td style="text-align:right;">${money(r.DonGia)}</td><td style="text-align:right;">${money(r.ThanhTien)}</td>
          <td>${r.suaDuoc ? '<button type="button" class="btn small secondary mcm-xoa2">Xóa</button>' : ''}</td>
        </tr>`).join('')}</tbody></table></div>`;
    }).join('');
    const m = openModal(`<h3>Ai đã làm lệnh ${escapeHtml(d.maDH)}</h3>
      <div class="empty-hint" style="text-align:left;">${escapeHtml(d.tenSanPham || '')} · Tổng bàn cắt: <b>${tongCat || '—'}</b>
        ${d.conOMay ? '' : ' · <b style="color:#b06000;">Lệnh đã chuyển khỏi công đoạn May — không sửa được ở đây nữa.</b>'}
        ${d.toTruong && d.conOMay ? ' · Bạn có quyền sửa dòng của <b>mọi người</b>.' : ''}</div>
      ${rows.length ? khoiCD : '<div class="empty-hint">Chưa ai ghi công đoạn may cho lệnh này.</div>'}
      <div class="modal-actions"><button type="button" class="btn secondary" id="mcmAiDong">Đóng</button></div>`, { rong: true });
    m.querySelector('#mcmAiDong').addEventListener('click', closeModal);
    /* v9.96: bấm vào ô SL ⇒ biến thành ô nhập ngay tại chỗ. Enter hoặc rời ô = lưu; Esc = bỏ.
       Không dùng prompt(): trên máy tính bảng ở xưởng, prompt bật bàn phím che hết bảng. */
    m.querySelectorAll('.mcm-sl').forEach(a => a.addEventListener('click', (ev) => {
      ev.preventDefault();
      const td = a.parentElement;
      const r = rows.find(x => String(x.ID) === a.closest('tr').dataset.id);
      if (!r || td.querySelector('input')) return;
      const cu = num(r.SoLuong);
      td.innerHTML = `<input type="number" min="1" step="1" value="${cu}" style="width:80px;text-align:right;">`;
      const o = td.querySelector('input');
      o.focus(); o.select();
      let xong = false;
      const huy = () => { if (xong) return; xong = true; td.innerHTML = `<a href="#" class="mcm-sl" style="border-bottom:1px dashed #0b57d0;color:#0b57d0;font-weight:600;">${cu}</a>`; moAiDaLamLenh(d.maDH); };
      const luu = async () => {
        if (xong) return;
        const sl = Number(o.value);
        if (!(sl > 0)) { toast('Số lượng phải lớn hơn 0.', 'error'); o.focus(); return; }
        if (sl === cu) return huy();
        xong = true;
        try {
          const kq = await apiPut(`/api/qlsx/congdoanmay/cuatoi/${r.ID}`, { soLuong: sl });
          toast('Đã sửa.', 'success');
          const dc = kq && kq.data && kq.data.daChuyen;
          if (dc) toast(`✅ Lệnh ${d.maDH} đã đủ ${num(dc.tongCat)} theo bàn cắt — TỰ CHUYỂN sang "${dc.den || 'HOÀN THÀNH'}".`, 'success', 12000);
          closeModal(); veLai();   // v9.99: veLai, KHÔNG draw — nếu không sẽ nhảy về trang phiếu lương
        } catch (e) { toast(e.message, 'error'); xong = false; o.focus(); }
      };
      o.addEventListener('keydown', (e2) => {
        if (e2.key === 'Enter') { e2.preventDefault(); luu(); }
        if (e2.key === 'Escape') { e2.preventDefault(); huy(); }
      });
      o.addEventListener('blur', luu);
    }));
    m.querySelectorAll('.mcm-xoa2').forEach(b => b.addEventListener('click', async () => {
      const r = rows.find(x => String(x.ID) === b.closest('tr').dataset.id);
      if (!r || !confirm(`Xóa dòng của ${r.HoTen || ''} — ${r.TenCongDoan || ''} × ${num(r.SoLuong)}?`)) return;
      try { await apiDelete(`/api/qlsx/congdoanmay/cuatoi/${r.ID}`); toast('Đã xóa.', 'success'); closeModal(); veLai(); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }
  function wireCongDoanMayCuaToi(cm) {
    if (!cm || cm.loi) return;
    /* v9.96: vẽ danh sách lệnh cho CẢ thợ may LẪN tổ trưởng chỉ-có-tick (người không thuộc bộ phận
       May nhưng được xem) — trước đây chỉ vẽ khi laBoPhanMay, nên tổ trưởng mở ra thấy tiêu đề mà
       dưới trống trơn. Nút "＋ Ghi phần của tôi" thì vẫn chỉ hiện ở lệnh đang ở May. */
    if (cm.laBoPhanMay || cm.xemTatCa) veLenhDangMay(cm);
  }
  /* v9.93: lệnh ĐÃ CHỌN từ bảng ở trên (tham số `o`) — form chỉ còn ĐÚNG hai thứ phải điền:
     công đoạn + số lượng, đúng yêu cầu "chỉ hiện ra chọn công đoạn và điền số lượng".
     Không còn ô gõ tìm lệnh. Tên người ghi là chính mình (máy chủ ép), nên không có ô nhân viên. */
  async function moFormCongDoanMayCuaToi(o) {
    if (!o || !o.MaDH) { toast('Chưa chọn lệnh.', 'error'); return; }
    const conLai = (Number(o.TongSLCat) || 0) - (Number(o.DaMayCaTo) || 0);
    const m = openModal(`<h3>Ghi công đoạn may — lệnh ${escapeHtml(o.MaDH)}</h3>
      <div class="empty-hint" style="text-align:left;">${escapeHtml(o.TenSanPham || '')}
        · Tổng bàn cắt: <b>${num(o.TongSLCat) || 'chưa ghi sổ cắt'}</b>
        · Cả tổ đã may: <b>${num(o.DaMayCaTo)}</b>${Number(o.TongSLCat) > 0 ? ` · Còn lại: <b>${conLai}</b>` : ''}</div>
      <div class="form-row"><label>Ngày</label><input type="date" id="mcmNgay" value="${homNayISO()}"></div>
      ${/* 🔴 v9.97 (Nguyen: "1 người có thể chọn được nhiều công đoạn trong 1 lần cập nhật, thêm
           dòng"): mỗi dòng = một công đoạn + số lượng; nút ＋ thêm dòng, ✕ bỏ dòng. */''}
      <div class="form-row"><label>Công đoạn đã may <span style="font-weight:400;color:#5f6368;">(chọn được nhiều)</span></label>
        <div id="mcmRows"></div>
        <button type="button" class="btn small secondary" id="mcmThemDong" style="margin-top:6px;">＋ Thêm công đoạn</button>
        ${/* v9.95: cảnh báo NGAY LÚC GÕ, không đợi bấm Lưu. Máy chủ vẫn chặn 409 — đây là lớp nói sớm. */''}
        <div id="mcmCanhBao" style="margin-top:6px;font-size:13px;"></div></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="mcmHuy">Hủy</button>
        <button type="button" class="btn" id="mcmLuu">Lưu</button></div>`);
    const $ = (s) => m.querySelector(s);
    $('#mcmHuy').addEventListener('click', closeModal);
    let dsCD = [], tongCat = Number(o.TongSLCat) || 0;
    try {
      const kq = await apiGet(`/api/qlsx/congdoanmay/cuatoi/congdoan?maDH=${encodeURIComponent(o.MaDH)}`);
      dsCD = kq.data || [];
      if (Number(kq.tongSLCat) > 0) tongCat = Number(kq.tongSLCat);
    } catch (e) { toast(e.message, 'error'); }
    const optCD = () => '<option value="">-- Chọn công đoạn --</option>' + dsCD.map(c => {
      const con = tongCat > 0 ? tongCat - (Number(c.DaMay) || 0) : null;
      return `<option value="${c.ID}">${escapeHtml(c.TenCongDoan)} — ${money(c.ThanhTien)} đ/cái${con != null ? ` · còn ${con}` : ''}</option>`;
    }).join('');
    function themDong() {
      if (!dsCD.length) { toast('Lệnh này chưa khai công đoạn may nào — báo tổ trưởng khai ở Kỹ thuật.', 'error'); return; }
      $('#mcmRows').insertAdjacentHTML('beforeend',
        `<div class="mcm-dong" style="display:flex;gap:6px;align-items:center;margin-bottom:5px;">
           <select class="mcm-cd" style="flex:1;">${optCD()}</select>
           <input type="number" class="mcm-sl" min="1" step="1" placeholder="SL" style="width:90px;text-align:right;">
           <button type="button" class="btn small danger mcm-bo" title="Bỏ dòng" style="padding:2px 7px;">✕</button>
         </div>`);
      const d = $('#mcmRows').lastElementChild;
      d.querySelector('.mcm-cd').addEventListener('change', soatLai);
      d.querySelector('.mcm-sl').addEventListener('input', soatLai);
      d.querySelector('.mcm-bo').addEventListener('click', () => { d.remove(); soatLai(); });
      soatLai();
    }
    $('#mcmThemDong').addEventListener('click', themDong);

    const docDong = () => Array.from(m.querySelectorAll('.mcm-dong')).map(d => ({
      cd: d.querySelector('.mcm-cd').value,
      sl: Number(d.querySelector('.mcm-sl').value) || 0
    }));
    /* Đỏ + KHOÁ nút Lưu khi vượt. 🔴 CỘNG DỒN các dòng CÙNG công đoạn trong chính lần nhập này —
       tách 100 thành 2 dòng 50 cũng phải bị chặn y như một dòng 100 (máy chủ cũng cộng dồn). */
    function soatLai() {
      const ds2 = docDong();
      const o2 = $('#mcmCanhBao'), nut = $('#mcmLuu');
      if (tongCat <= 0) {
        o2.innerHTML = '<span style="color:#5f6368;">Lệnh chưa ghi sổ cắt — không có mốc để đối chiếu.</span>';
        nut.disabled = false; return;
      }
      const them = new Map();
      ds2.forEach(x => { if (x.cd) them.set(x.cd, (them.get(x.cd) || 0) + x.sl); });
      const loi = [], ok = [];
      them.forEach((sl, id) => {
        const cd = dsCD.find(c => String(c.ID) === String(id));
        if (!cd) return;
        const daCo = Number(cd.DaMay) || 0, tong = daCo + sl;
        if (tong > tongCat) loi.push(`"${escapeHtml(cd.TenCongDoan)}" đã ghi ${daCo}, chỉ còn ${tongCat - daCo} — bạn nhập ${sl}`);
        else ok.push(`${escapeHtml(cd.TenCongDoan)}: ${daCo}+${sl}/${tongCat}${tong === tongCat ? ' ✔ đủ' : ''}`);
      });
      if (loi.length) {
        o2.innerHTML = `<b style="color:#c0392b;">⛔ VƯỢT TỔNG BÀN CẮT (${tongCat}).</b><br>${loi.join('<br>')}`;
        nut.disabled = true;
      } else {
        o2.innerHTML = ok.length ? `<span style="color:#5f6368;">${ok.join(' · ')}</span>` : '';
        nut.disabled = false;
      }
    }
    themDong();   // mở form là có sẵn một dòng

    $('#mcmLuu').addEventListener('click', async () => {
      const ds2 = docDong().filter(x => x.cd && x.sl > 0);
      if (!ds2.length) return toast('Chưa có dòng nào — chọn công đoạn và nhập số lượng.', 'error');
      if (docDong().some(x => (x.cd && !(x.sl > 0)) || (!x.cd && x.sl > 0)))
        return toast('Có dòng chọn công đoạn mà chưa nhập SL (hoặc ngược lại) — bỏ dòng đó hoặc điền nốt.', 'error');
      try {
        const kq = await apiPost('/api/qlsx/congdoanmay/cuatoi', {
          maDH: o.MaDH, ngay: $('#mcmNgay').value,
          dong: ds2.map(x => ({ donGiaCongDoanMayId: x.cd, soLuong: x.sl }))
        });
        closeModal(); toast(`Đã ghi ${(kq.data && kq.data.soDong) || ds2.length} công đoạn may.`, 'success');
        /* 🔴 v9.94: tự chuyển công đoạn là việc LỚN (lệnh rời khỏi danh sách của thợ may) — phải NÓI
           RA, không được lặng lẽ. Toast để lâu hơn cho người đọc kịp. */
        const dc = kq && kq.data && kq.data.daChuyen;
        if (dc) {
          toast(dc.den
            ? `✅ Lệnh ${o.MaDH} đã may đủ ${num(dc.tongCat)} theo bàn cắt — TỰ CHUYỂN sang công đoạn "${dc.den}". Lệnh này không còn trong danh sách của bạn nữa.`
            : `✅ Lệnh ${o.MaDH} đã may đủ ${num(dc.tongCat)} theo bàn cắt — lệnh chuyển sang HOÀN THÀNH.`, 'success', 12000);
        }
        if (kq && kq.data && kq.data.loiChuyen) {
          toast(`Đã ghi số, nhưng KHÔNG tự chuyển được công đoạn: ${kq.data.loiChuyen}. Báo tổ trưởng chuyển tay ở QLSX › Ghi tiến độ.`, 'error', 12000);
        }
        veLai();   // v9.99: veLai, KHÔNG draw — nếu không sẽ nhảy về trang phiếu lương
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  /* ================================================================================================
     v9.67 — SẢN LƯỢNG THEO LỆNH CỦA TÔI (Nguyen 16/11: "Sản lượng theo lệnh gán với nhân viên luôn, nghĩa là
     tự cập nhật cho mình. Khi nhân viên ký hợp đồng theo sản phẩm thì sẽ hiện ở chức năng này... thêm dòng
     chọn list sản phẩm để nhập số lượng").
     Chỉ vẽ khi máy chủ trả theoSanPham:true (hợp đồng hiệu lực kiểu "Theo sản phẩm"). Danh sách sản phẩm =
     danh mục của CHÍNH hợp đồng (tên + đơn giá), người dùng chỉ chọn lệnh, chọn SP, gõ số lượng, ngày.
     Dòng may mẫu (tự động từ lệnh) chỉ xem. Lưu xong lương tháng đó tự tính lại (v9.53).
     ================================================================================================ */
  function phanSanLuongCuaToi(sl) {
    if (!sl || sl.linked === false) return '';
    if (sl.loi) return `<p style="font-size:12px;color:#b06000;margin-top:18px;">Không tải được sản lượng theo lệnh: ${escapeHtml(sl.loi)}</p>`;
    if (!sl.theoSanPham) return '';
    const rows = sl.rows || [];
    return `<h3 style="margin-top:22px;">Sản lượng theo lệnh của tôi — Tháng ${selThang}/${selNam}
        <button type="button" class="btn small" id="mslThem" style="margin-left:8px;">＋ Ghi sản lượng</button></h3>
      <div style="font-size:12px;color:#5f6368;margin:-4px 0 8px;">Sản phẩm theo hợp đồng: ${(sl.sanPham || []).map(x => `<b>${escapeHtml(x.TenSanPham)}</b> ${money(x.DonGia)} đ`).join(' · ') || '<span style="color:#c0392b;">hợp đồng chưa khai danh mục sản phẩm — báo nhân sự</span>'}</div>
      ${rows.length ? `<div style="overflow:auto;"><table style="font-size:13px;"><thead><tr><th style="width:38px;">STT</th><th>Ngày</th><th style="width:48px;">Ảnh</th><th>Lệnh SX</th><th>Mã rập</th><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th><th style="width:100px;"></th></tr></thead>
        <tbody>${rows.map((x, i) => `<tr data-id="${x.ID}"><td style="text-align:center;">${i + 1}</td><td>${fmtDate(x.Ngay)}</td>
          <td>${x.Anh ? `<a href="${escapeHtml(x.Anh)}" target="_blank"><img class="thumb" src="${escapeHtml(anhNho(x.Anh, 160))}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></a>` : '<span style="color:#bbb;">—</span>'}</td>
          <td>${x.MaDH ? `<b>${escapeHtml(x.MaDH)}</b><div style="font-size:12px;color:#5f6368;">${escapeHtml(x.TenSPLenh || '')}</div>`
            : `<span style="color:#b26a00;">♻️ Làm lại mã cũ</span><div style="font-size:12px;"><b>${escapeHtml(x.MaHangCu || '')}</b></div>`}</td><td>${escapeHtml(x.MaRap || '')}</td>
          <td>${escapeHtml(x.TenSanPham)}${x.Nguon === 'MayMau' ? ' <span style="color:#5f6368;font-size:12px;">(tự động từ lệnh)</span>' : ''}${x.khop ? '' : ' <span style="color:#c0392b;font-size:12px;">(không có trong hợp đồng — 0 đ)</span>'}</td>
          <td style="text-align:right;">${num(x.SoLuong)}</td><td style="text-align:right;">${money(x.DonGia)}</td><td style="text-align:right;">${money(x.ThanhTien)}</td>
          <td>${x.Nguon === 'MayMau' ? '' : '<button type="button" class="btn small secondary msl-sua">Sửa</button> <button type="button" class="btn small secondary msl-xoa">Xóa</button>'}</td></tr>`).join('')}</tbody>
        <tfoot><tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="7" style="text-align:right;">TỔNG THƯỞNG THEO SẢN PHẨM (từ lệnh)</td><td style="text-align:right;">${money(sl.tong)}</td><td></td></tr></tfoot></table></div>`
        : '<div class="empty-hint">Chưa ghi sản lượng nào tháng này — bấm "＋ Ghi sản lượng".</div>'}`;
  }
  function wireSanLuongCuaToi(sl) {
    if (!sl || !sl.theoSanPham) return;
    const rows = sl.rows || [];
    const b = container.querySelector('#mslThem');
    if (b) b.addEventListener('click', () => moFormSanLuongCuaToi(null, sl));
    container.querySelectorAll('.msl-sua').forEach(x => x.addEventListener('click', () => {
      const r = rows.find(y => String(y.ID) === x.closest('tr').dataset.id); if (r) moFormSanLuongCuaToi(r, sl);
    }));
    container.querySelectorAll('.msl-xoa').forEach(x => x.addEventListener('click', async () => {
      const r = rows.find(y => String(y.ID) === x.closest('tr').dataset.id);
      if (!r || !confirm(`Xóa dòng ${r.TenSanPham} × ${num(r.SoLuong)} (${r.MaDH ? 'lệnh ' + r.MaDH : 'làm lại mã cũ ' + (r.MaHangCu || '')})?`)) return;
      try { await apiDelete(`/api/qlsx/sanluong/cuatoi/${r.ID}`); toast('Đã xóa.', 'success'); draw(); } catch (e) { toast(e.message, 'error'); }
    }));
  }
  function moFormSanLuongCuaToi(r, sl) {
    const ds = sl.sanPham || [];
    const khoa = (s) => String(s || '').trim().toLowerCase();
    const optSP = (dangChon) => '<option value="">-- Chọn --</option>'
      + ds.map(x => `<option value="${escapeHtml(x.TenSanPham)}" ${dangChon && khoa(dangChon) === khoa(x.TenSanPham) ? 'selected' : ''}>${escapeHtml(x.TenSanPham)} — ${money(x.DonGia)} đ</option>`).join('')
      + (dangChon && !ds.some(x => khoa(x.TenSanPham) === khoa(dangChon)) ? `<option value="${escapeHtml(dangChon)}" selected>${escapeHtml(dangChon)} (không có trong hợp đồng — 0 đ)</option>` : '');
    function dongHtml(x) {
      return `<tr><td style="min-width:180px;"><select class="msl-sp" style="width:100%;">${optSP(x ? x.TenSanPham : '')}</select></td>
        <td><input type="number" class="msl-sl" min="0" step="1" value="${x ? num(x.SoLuong) || '' : ''}" placeholder="SL" style="width:80px;"></td>
        <td><input type="text" class="msl-gc" maxlength="255" value="${x ? escapeHtml(x.GhiChu || '') : ''}" placeholder="Ghi chú" style="width:100%;min-width:100px;"></td>
        <td>${x ? '' : '<button type="button" class="btn small secondary msl-bo" title="Bỏ dòng">✕</button>'}</td></tr>`;
    }
    const m = openModal(`<h3>${r ? 'Sửa' : 'Ghi'} sản lượng theo lệnh</h3>
      <div class="form-row"><label>Ngày</label><input type="date" id="mslNgay" value="${r ? String(r.Ngay).slice(0, 10) : homNayISO()}"></div>
      ${/* v9.81: cùng dấu tích "Làm lại mã cũ" như màn QLSX — một nghiệp vụ thì một luồng, không để nhân viên
           tự ghi thì chịu mà quản lý ghi hộ thì được. Cần migration_v905. */''}
      <div class="form-row"><label>Lệnh sản xuất</label>
        <label style="font-weight:400;display:block;margin-bottom:4px;"><input type="checkbox" id="mslLamLai" ${r && !r.MaDH ? 'checked' : ''}> ♻️ Làm lại mã cũ (không có lệnh — nhập mã hàng)</label>
        <div id="mslOLenh">
          <input type="text" id="mslLenhTim" list="mslLenhDS" placeholder="Gõ mã lệnh hoặc tên sản phẩm rồi chọn" value="${r && r.MaDH ? escapeHtml(r.MaDH) : ''}" autocomplete="off">
          <datalist id="mslLenhDS"></datalist>
          <div id="mslLenhChon" style="font-size:12px;color:#5f6368;margin-top:2px;">${r && r.MaDH ? escapeHtml(r.MaDH + ' — ' + (r.TenSPLenh || '')) : 'Chưa chọn lệnh'}</div>
        </div>
        <div id="mslOMaCu" style="display:none;">
          <input type="text" id="mslMaCu" placeholder="Mã hàng cũ" maxlength="100" value="${r && r.MaHangCu ? escapeHtml(r.MaHangCu) : ''}" autocomplete="off">
        </div></div>
      ${/* v9.67c: NHIỀU dòng sản phẩm cho một lệnh — mỗi dòng chọn SP từ list hợp đồng của mình + SL. Sửa (r) = 1 dòng. */''}
      <div class="form-row"><label>Sản phẩm (theo hợp đồng của bạn) — số lượng — ghi chú</label>
        <table style="font-size:13px;"><tbody id="mslDong">${dongHtml(r)}</tbody></table>
        ${r ? '' : '<button type="button" class="btn small secondary" id="mslThemDong" style="margin-top:4px;">＋ Thêm dòng sản phẩm</button>'}</div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="mslHuy">Hủy</button><button type="button" class="btn" id="mslLuu">💾 Lưu</button></div>`);
    const oDong = m.querySelector('#mslDong');
    const noiDong = (tr) => { const x = tr.querySelector('.msl-bo'); if (x) x.addEventListener('click', () => { if (oDong.children.length > 1) tr.remove(); }); };
    oDong.querySelectorAll('tr').forEach(noiDong);
    const bThem = m.querySelector('#mslThemDong');
    if (bThem) bThem.addEventListener('click', () => { oDong.insertAdjacentHTML('beforeend', dongHtml(null)); noiDong(oDong.lastElementChild); oDong.lastElementChild.querySelector('.msl-sp').focus(); });
    let lenhChon = r && r.MaDH ? { DonHangID: r.DonHangID, MaDH: r.MaDH } : null, dsLenh = [], timer = null;
    const oTim = m.querySelector('#mslLenhTim'), dl = m.querySelector('#mslLenhDS'), oChon = m.querySelector('#mslLenhChon');
    const oLamLai = m.querySelector('#mslLamLai'), oKhoiLenh = m.querySelector('#mslOLenh'), oKhoiMaCu = m.querySelector('#mslOMaCu'), oMaCu = m.querySelector('#mslMaCu');
    const doiKieuLenh = () => {   // v9.81
      oKhoiLenh.style.display = oLamLai.checked ? 'none' : '';
      oKhoiMaCu.style.display = oLamLai.checked ? '' : 'none';
      if (oLamLai.checked) oMaCu.focus();
    };
    oLamLai.addEventListener('change', doiKieuLenh);
    doiKieuLenh();
    const timLenh = async () => {
      if (oLamLai.checked) return;   // v9.81: làm lại mã cũ thì không cần tìm lệnh
      const q = oTim.value.trim();
      try { dsLenh = (await apiGet(`/api/qlsx/sanluong/cuatoi/lenh?q=${encodeURIComponent(q)}&giu=${encodeURIComponent(r ? r.MaDH : '')}`)).data || []; } catch (e) { dsLenh = []; }   // v9.70: lệnh mình đã ghi không hiện nữa
      /* v9.78: list lệnh có thêm MÃ RẬP (máy chủ gắn trong timLenhChuaGhi) — người ghi sản lượng nhận ra lệnh nhanh hơn. */
      dl.innerHTML = dsLenh.map(l => `<option value="${escapeHtml(l.MaDH)}">${l.MaRap ? 'Rập ' + escapeHtml(l.MaRap) + ' · ' : ''}${escapeHtml(l.TenSanPham || '')} · ${fmtDate(l.NgayDat)}</option>`).join('');
      const hit = dsLenh.find(l => l.MaDH === q);
      if (hit) { lenhChon = hit; oChon.textContent = `${hit.MaDH} — ${hit.TenSanPham || ''}${hit.MaRap ? ' — rập ' + hit.MaRap : ''} (${fmtDate(hit.NgayDat)})`; }
      else if (q !== (lenhChon && lenhChon.MaDH)) { lenhChon = null; oChon.textContent = 'Chưa chọn lệnh'; }
    };
    oTim.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(timLenh, 250); });
    oTim.addEventListener('change', timLenh);
    timLenh();
    m.querySelector('#mslHuy').addEventListener('click', closeModal);
    m.querySelector('#mslLuu').addEventListener('click', async () => {
      const lamLai = oLamLai.checked;   // v9.81
      if (!lamLai && !lenhChon) { toast('Chưa chọn lệnh sản xuất (gõ mã rồi chọn trong danh sách), hoặc tích "Làm lại mã cũ".', 'error'); return; }
      if (lamLai && !oMaCu.value.trim()) { toast('Đã tích "Làm lại mã cũ" thì phải nhập mã hàng.', 'error'); return; }
      const rows = [...oDong.querySelectorAll('tr')].map(tr => ({ tenSanPham: tr.querySelector('.msl-sp').value, soLuong: tr.querySelector('.msl-sl').value, ghiChu: tr.querySelector('.msl-gc').value }))
        .filter(x => x.tenSanPham || num(x.soLuong) > 0);
      if (!rows.length) { toast('Chưa có dòng sản phẩm nào có số lượng.', 'error'); return; }
      const payload = { donHangId: lamLai ? null : lenhChon.DonHangID, lamLaiMaCu: lamLai, maHangCu: lamLai ? oMaCu.value.trim() : null,
        ngay: m.querySelector('#mslNgay').value, rows, tenSanPham: rows[0].tenSanPham, soLuong: rows[0].soLuong, ghiChu: rows[0].ghiChu };
      try {
        const kq = r ? await apiPut(`/api/qlsx/sanluong/cuatoi/${r.ID}`, payload) : await apiPost('/api/qlsx/sanluong/cuatoi', payload);
        closeModal(); toast(r ? 'Đã sửa.' : `Đã ghi ${(kq.data && kq.data.soDong) || rows.length} dòng sản lượng.`, 'success');
        if (kq.data && kq.data.canhBao) toast(kq.data.canhBao, 'error');
        draw();
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  return { render, getTabs };
})();
