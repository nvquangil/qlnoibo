// Phan he QUAN LY SAN XUAT - chuc nang con "Tài liệu kỹ thuật" (v5.14)
// 4 chuc nang con: Tài liệu kỹ thuật chung (+ quản lý tài liệu mẫu), Thông số đo, Chỉ định NPL (tách
// ra khỏi Ghi nhận tiến độ - xem module.qlsx.js stageCode === 'PK', dùng lại NGUYÊN VẸN API
// /api/qlsx/orders/:maDH/phukien), Mô tả sản phẩm (lưới ảnh dán/paste). Cả 4: lấy danh sách đơn từ
// GET /api/tailieukythuat/orders?loai=..., mỗi đơn hàng = 1 "hồ sơ/tài liệu" riêng (đặt tên khi in
// theo đúng Mã ĐH), lưu xong đều có nút in.
//
// v5.14 - quyết định kiến trúc quan trọng (đã trao đổi trong HUONG_DAN_CAI_DAT.md Bước 2.19):
// - 3 loại tài liệu mới (tailieuchung/thongsodo/motasp) dùng model "mục/dòng" hoặc "lưới" chung, LƯU =
//   GHI ĐÈ TOÀN BỘ mỗi lần lưu (khác hẳn pattern "chỉ thêm dòng" của Giao vải/Phụ kiện) - phù hợp hơn vì
//   đây là soạn thảo 1 văn bản hoàn chỉnh, không phải bổ sung liên tục nhiều thời điểm khác nhau.
// - Chỉ định NPL KHÔNG có bảng/route riêng - vẫn là DonHangChiTietPhuKien + 3 route cũ trong qlsx.js,
//   gate quyền THEO 'tiendo' (không phải 'tailieukythuat') vì dùng lại nguyên route cũ. Nghĩa là: 1 user
//   cần CẢ 'tailieukythuat' (để thấy menu/danh sách đơn) LẪN 'tiendo' (để thực sự xem/lưu/xóa NPL) - xem
//   permTiendo bên dưới. Trong thực tế ai trước đây làm được NPL qua Ghi nhận tiến độ đã sẵn có 'tiendo'.
// - Dán ảnh (Ctrl+V) là tương tác MỚI hoàn toàn trong hệ thống (đã xác nhận không có tiền lệ) - đã làm
//   thêm nút "Chọn file" dự phòng cho các trường hợp không dùng được clipboard (di động, quyền trình
//   duyệt...).
window.ModuleTaiLieuKyThuat = (function () {
  let container, currentUser;
  let perm = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  let permTiendo = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  let permNpl = { canView: true, canCreate: true, canEdit: true, canDelete: true };   // v5.52: quyền Chỉ định NPL (ChucNang chidinhnpl)
  let activeChild = 'tailieuchung';
  let dmCache = null;

  // v5.34 (Giai doan B): module nay phuc vu NHIEU nhom tab (goi render(el, user, group)):
  //  - 'tlkt'  Tài liệu kỹ thuật     -> [Tài liệu kỹ thuật chung]
  //  - 'tlmay' Tài liệu may/Đóng gói -> [Thông số kỹ thuật (=thongsodo cu), Mô tả đường may (=motasp cu)]
  //    (Quy cách đóng gói + Đơn giá công đoạn may/Giao gia công se them o buoc B2)
  // KEY con GIU nguyen (thongsodo/motasp) de dung lai route + bang cu; chi doi NHAN + chuyen nhom.
  const GROUPS = {
    tlkt: [{ key: 'tailieuchung', label: 'Tài liệu kỹ thuật chung' }],
    // v5.88: BỎ mục con "Quy cách đóng gói" khỏi nhóm này theo yêu cầu. Dữ liệu cũ (nếu đã nhập) VẪN
    // CÒN NGUYÊN trong bảng TaiLieuMoTaSanPham (Loai='quycach') và mọi route backend giữ nguyên — chỉ
    // ẩn lối vào. Muốn dùng lại chỉ cần thêm dòng { key: 'quycach', label: 'Quy cách đóng gói' } vào đây.
    tlmay: [{ key: 'thongsodo', label: 'Thông số kỹ thuật' }, { key: 'motasp', label: 'Mô tả đường may' }, { key: 'dongiamay', label: 'Đơn giá công đoạn may' }, { key: 'dongiagiacong', label: 'Đơn giá giao gia công' }, { key: 'dongialadonggoi', label: 'Đơn giá là/đóng gói' }],
    // v5.34c (mục 7): Tài liệu in thêu.
    tlinthue: [{ key: 'hinhanhinthue', label: 'Hình ảnh mô tả in/thêu' }, { key: 'dongiainthe', label: 'Đơn giá in thêu' }],
    // v5.50: "Chỉ định NPL" TÁCH thành TAB RIÊNG của QLSX (module.qlsx.js dispatch nhóm 'chidinhnpl'); trước là mục con của tlmay.
    chidinhnpl: [{ key: 'chidinhnpl', label: 'Chỉ định NPL' }]
  };
  let currentGroup = 'tlkt';
  function childrenOf() { return GROUPS[currentGroup] || GROUPS.tlkt; }

  async function getDm() {
    if (!dmCache) dmCache = (await apiGet('/api/qlsx/danhmuc')).data;
    return dmCache;
  }

  /* ================= SHELL: sub-nav 4 chuc nang con + danh sach don hang (dung chung ca 4) ================= */
  async function render(el, user, group) {
    container = el; currentUser = user;
    currentGroup = group && GROUPS[group] ? group : 'tlkt';   // v5.34 (Giai doan B)
    if (!childrenOf().some(c => c.key === activeChild)) activeChild = childrenOf()[0].key;
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.QLSX || {});
    // v5.38b: perm theo nhóm tab — Tài liệu kỹ thuật / may-đóng gói / in thêu là 3 chức năng riêng.
    const cnByGroup = { tlkt: 'tailieukythuat', tlmay: 'tailieumay', tlinthue: 'tailieuinthe', chidinhnpl: 'chidinhnpl' };   // v5.50: nhóm 'chidinhnpl' gate theo ChucNang 'chidinhnpl'
    perm = effectivePerm(user, 'QLSX', cnByGroup[currentGroup] || 'tailieukythuat', rawPerm);
    permTiendo = effectivePerm(user, 'QLSX', 'tiendo', rawPerm);
    permNpl = effectivePerm(user, 'QLSX', 'chidinhnpl', rawPerm);   // v5.52: Chỉ định NPL gate theo ChucNang riêng, không phụ thuộc 'tiendo'
    return renderShell();
  }

  async function renderShell() {
    container.innerHTML = `
      <div class="tlkt-subnav">
        ${childrenOf().map(c => `<button type="button" class="btn small ${c.key === activeChild ? '' : 'secondary'}" data-child="${c.key}">${escapeHtml(c.label)}</button>`).join('')}
        ${activeChild === 'tailieuchung' && perm.canEdit ? `<button type="button" class="btn small secondary" id="btnQuanLyMau" style="margin-left:auto;">📑 Quản lý tài liệu mẫu</button>` : ''}
      </div>
      <div id="tlktBody"></div>`;
    container.querySelectorAll('[data-child]').forEach(btn => btn.addEventListener('click', () => {
      if (activeChild === btn.dataset.child) return;
      activeChild = btn.dataset.child;
      renderShell();
    }));
    const btnMau = container.querySelector('#btnQuanLyMau');
    if (btnMau) btnMau.addEventListener('click', openMauManager);
    return renderOrderList();
  }

  async function renderOrderList() {
    const body = document.getElementById('tlktBody');
    if (!body) return;
    body.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let orders;
    try {
      orders = (await apiGet('/api/tailieukythuat/orders?loai=' + activeChild)).data || [];
    } catch (err) {
      body.innerHTML = `<div class="empty-hint">Lỗi tải danh sách: ${escapeHtml(err.message)}</div>`;
      return;
    }
    body.innerHTML = `
      <div class="form-row">${searchBoxHtml('tlktSearchBox')}</div>
      ${/* v5.84: riêng tab Chỉ định NPL có thêm cột trạng thái XUẤT KHO phụ kiện */''}
      <table><thead><tr><th>Mã ĐH</th><th>Mã hàng</th><th>Tên sản phẩm</th><th>Khách hàng</th><th>Ngày giao dự kiến</th><th>Trạng thái</th><th>Tài liệu</th>${activeChild === 'chidinhnpl' ? '<th>Xuất kho PK</th>' : ''}<th>Cập nhật lúc</th><th></th></tr></thead>
      <tbody>${orders.map(o => rowHtml(o)).join('') || `<tr><td colspan="${activeChild === 'chidinhnpl' ? 10 : 9}" class="empty-hint">Chưa có lệnh sản xuất nào.</td></tr>`}</tbody></table>`;
    wireTableSearch(body, 'tlktSearchBox');
    body.querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => {
      const orderRow = orders.find(o => o.MaDH === btn.dataset.open);
      openEditorFor(btn.dataset.open, orderRow);
    }));
    body.querySelectorAll('.tlkt-lenh').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); if (window.ModuleQLSX && window.ModuleQLSX.printLenhSanXuat) window.ModuleQLSX.printLenhSanXuat(a.dataset.madh); }));   // v5.53: click Mã ĐH → In lệnh SX
    body.querySelectorAll('.tlkt-xuatpk').forEach(b => b.addEventListener('click', () => xuatKhoPhuKienTheoChiDinh(b.dataset.madh)));   // v5.83
    body.querySelectorAll('.tlkt-xem-px').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); xemPhieuXuatPKCuaDon(a.dataset.donid, a.dataset.madh); }));   // v5.85
  }

  function rowHtml(o) {
    // v5.39b: nut hanh dong ton trong quyen. Quyen XEM (canView, khong canEdit):
    //   - da co tai lieu  -> "Xem" (mo xem, khong sua duoc)
    //   - chua co tai lieu -> khong hien nut "+ Tao" nua (truoc day luon hien -> user chi-xem van thay Tao)
    let actionBtn;
    if (o.DaCo) {
      actionBtn = `<button type="button" class="btn small" data-open="${escapeHtml(o.MaDH)}">${perm.canEdit ? 'Mở' : 'Xem'}</button>`;
    } else {
      actionBtn = perm.canEdit
        ? `<button type="button" class="btn small" data-open="${escapeHtml(o.MaDH)}">+ Tạo</button>`
        : '<span class="empty-hint">—</span>';
    }
    return `<tr>
      <td><a href="#" class="tlkt-lenh" data-madh="${escapeHtml(o.MaDH)}" title="Xem phiếu In lệnh SX">${escapeHtml(o.MaDH)}</a></td><td>${escapeHtml(o.MaSanPham || '')}</td><td>${escapeHtml(o.TenSanPham || '')}</td>
      <td>${escapeHtml(o.TenKhachHang || '')}</td><td>${fmtDate(o.NgayGiaoDuKien)}</td><td>${statusWithStage(o.TrangThai, o.TenCongDoan)}</td>
      <td>${o.DaCo ? '<span class="badge ok">Đã có</span>' : '<span class="badge warn">Chưa có</span>'}</td>
      ${activeChild === 'chidinhnpl' ? `<td>${trangThaiXuatPKHtml(o)}</td>` : ''}
      <td>${o.CapNhatLuc ? fmtDateTime(o.CapNhatLuc) : ''}</td>
      <td>${actionBtn}${/* v5.83: đã chỉ định NPL thì lập luôn Phiếu xuất phụ kiện ngay tại đây (giống Chỉ định vải SX v5.69) */''}${(activeChild === 'chidinhnpl' && o.DaCo && coQuyenXuatPhuKien()) ? ` <button type="button" class="btn small tlkt-xuatpk" data-madh="${escapeHtml(o.MaDH)}" title="Lập Phiếu xuất kho phụ kiện cho đơn này">📦 Xuất kho</button>` : ''}</td>
    </tr>`;
  }

  /* ================================================================================================
     v5.83 — TỪ "CHỈ ĐỊNH NPL" LẬP LUÔN PHIẾU XUẤT KHO PHỤ KIỆN (đối xứng với v5.69 của Chỉ định vải SX)
     Trước đây phải tự sang phân hệ Quản lý phụ kiện → tab Phiếu Xuất → tìm lại đơn trong danh sách dài.
     Nay bấm "📦 Xuất kho" là chuyển sang đó với form mở sẵn, đơn hàng đã chọn — nên danh sách phụ kiện
     trong form CHỈ còn những phụ kiện đã chỉ định NPL cho đơn đó (khóa xuất theo chỉ định, v5.47).
     ================================================================================================ */
  /* v5.84: trạng thái XUẤT KHO PHỤ KIỆN của 1 đơn (chỉ dùng ở tab Chỉ định NPL).
     ĐẾM THEO PHỤ KIỆN chứ không cộng tổng số lượng — mỗi phụ kiện một đơn vị (cái/mét/kg), cộng lại
     là vô nghĩa. Backend trả SoPKChiDinh / SoPKDaXuatDu / SoPhieuXuatPK (tailieukythuat.js). */
  function trangThaiXuatPKHtml(o) {
    const tong = Number(o.SoPKChiDinh || 0);
    const du = Number(o.SoPKDaXuatDu || 0);
    const soPhieu = Number(o.SoPhieuXuatPK || 0);
    if (!tong) return '<span class="empty-hint">—</span>';   // chưa chỉ định thì chưa nói chuyện xuất kho
    if (!soPhieu) return '<span class="badge">Chưa xuất</span>';
    const chiTiet = `<div style="font-size:11px;color:#5f6368;">${du}/${tong} phụ kiện · ${soPhieu} phiếu</div>`;
    const nhan = du < tong ? '<span class="badge warn">Xuất một phần</span>' : '<span class="badge green">Đã xuất kho</span>';
    // v5.85: bấm vào trạng thái -> xem danh sách phiếu xuất phụ kiện đã lập cho đơn này.
    return `<a href="#" class="tlkt-xem-px" data-donid="${o.DonHangID}" data-madh="${escapeHtml(o.MaDH)}" title="Xem các phiếu xuất phụ kiện của đơn này" style="text-decoration:none;">${nhan}${chiTiet}</a>`;
  }

  /* v5.85 — POPUP "CÁC PHIẾU XUẤT PHỤ KIỆN" của 1 đơn. Route /api/phukien/donhang/:id/phieuxuat gate
     theo quyền XEM của phân hệ Quản lý phụ kiện — người không có quyền đó sẽ nhận 403, ta báo rõ ràng
     thay vì để nút "bấm không thấy gì". */
  async function xemPhieuXuatPKCuaDon(donHangId, maDH) {
    let rows = [];
    try { rows = (await apiGet('/api/phukien/donhang/' + donHangId + '/phieuxuat')).data || []; }
    catch (err) { toast('Không xem được danh sách phiếu xuất phụ kiện: ' + err.message, 'error'); return; }
    const modal = openModal(`
      <h3>Phiếu xuất phụ kiện — ${escapeHtml(maDH || '')}</h3>
      <table><thead><tr><th>Số phiếu</th><th>Ngày</th><th>Số dòng PK</th><th style="text-align:right;">Tổng SL</th><th>Người lập</th><th>Ghi chú</th></tr></thead>
      ${/* v5.97: bấm 1 phiếu để xem chi tiết ngay tại đây; đóng chi tiết sẽ quay lại danh sách này */''}
      <tbody>${rows.map(r => `<tr class="act-xem-1pxpk" data-id="${r.PhieuID}" style="cursor:pointer;">
        <td>XPK-${String(r.PhieuID).padStart(5, '0')}</td>
        <td>${fmtDate(r.Ngay)}</td><td>${fmtNumber(r.SoDongPhuKien)}</td>
        <td style="text-align:right;">${fmtNumber(r.TongSoLuong)}</td>
        <td>${escapeHtml(r.NguoiTao || '')}</td><td>${escapeHtml(r.GhiChu || '')}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Chưa có phiếu xuất nào cho đơn này.</td></tr>'}</tbody></table>
      <p class="empty-hint">Bấm vào một phiếu để xem / in chi tiết. Tổng SL chỉ để tham khảo (mỗi phụ kiện một đơn vị).</p>
      <div class="modal-actions"><button type="button" class="btn secondary" id="pxpkClose">Đóng</button></div>`);
    modal.querySelector('#pxpkClose').addEventListener('click', closeModal);
    modal.querySelectorAll('.act-xem-1pxpk').forEach(tr => tr.addEventListener('click', () => xemChiTietPhieuXuatPK(tr.dataset.id)));
  }

  /* v5.97 — CHI TIẾT 1 PHIẾU XUẤT PHỤ KIỆN mở ngay từ popup "đã xuất kho" của Chỉ định NPL.
     Dùng lại route sẵn có /api/phukien/phieuxuat/:id (cùng lớp quyền với danh sách phiếu ở popup trên),
     nên không phát sinh route mới. Đóng lại là quay về danh sách phiếu (cửa sổ lồng nhau v5.97). */
  async function xemChiTietPhieuXuatPK(phieuId) {
    let d;
    try { d = (await apiGet('/api/phukien/phieuxuat/' + phieuId)).data; }
    catch (err) { toast('Không xem được chi tiết phiếu: ' + err.message, 'error'); return; }
    const h = d.header || {}, lines = d.lines || [];
    const tongSL = lines.reduce((t, r) => t + (Number(r.SoLuong) || 0), 0);
    const body = `<h2 style="text-align:center;">PHIẾU XUẤT KHO PHỤ KIỆN</h2>
      <p class="p-meta"><b>Số phiếu:</b> XPK-${String(h.PhieuID).padStart(5, '0')} &nbsp; <b>Ngày:</b> ${fmtDate(h.Ngay)}</p>
      <p class="p-meta"><b>Đơn hàng:</b> ${escapeHtml(h.MaDH || h.MaDon || '')}${h.MaRap ? ` &nbsp; <b>Mã rập:</b> ${escapeHtml(h.MaRap)}` : ''}</p>
      ${h.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(h.GhiChu)}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="5">
        <thead><tr><th style="width:38px;">STT</th><th style="width:80px;">Ảnh</th><th>Mã PK</th><th>Loại PK</th><th>Tên phụ kiện</th><th>ĐVT</th><th>SL chỉ định</th><th>SL xuất</th><th>Ghi chú</th></tr></thead>
        <tbody>${lines.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td>
          <td style="text-align:center;">${r.AnhDaiDien ? `<img src="${escapeHtml(r.AnhDaiDien)}" style="max-width:70px;max-height:70px;object-fit:contain;">` : ''}</td>
          <td>${escapeHtml(r.MaPhuKien || '')}</td><td>${escapeHtml(r.TenLoai || '')}</td><td>${escapeHtml(r.TenPhuKien || '')}</td>
          <td>${escapeHtml(r.DonVi || '')}</td>
          <td style="text-align:right;">${r.SLTheoChiDinh != null ? fmtNumber(r.SLTheoChiDinh) : ''}</td>
          <td style="text-align:right;">${fmtNumber(r.SoLuong)}</td><td>${escapeHtml(r.GhiChu || '')}</td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;">(phiếu chưa có dòng nào)</td></tr>'}
          <tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="6" style="text-align:right;">TỔNG CỘNG</td>
            <td style="text-align:right;">${fmtNumber(tongSL)}</td><td></td></tr>
        </tbody></table>`;
    const modal = openModal(`<h3>Chi tiết phiếu xuất phụ kiện</h3>
      <div style="max-height:60vh;overflow:auto;">${body}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="pxpk1In">🖨️ In phiếu</button>
        <button type="button" class="btn" id="pxpk1Dong">← Quay lại danh sách</button>
      </div>`);
    modal.querySelector('#pxpk1Dong').addEventListener('click', closeModal);
    modal.querySelector('#pxpk1In').addEventListener('click', () => printHtml('Phieu xuat phu kien XPK-' + h.PhieuID, body));
  }

  function coQuyenXuatPhuKien() {
    if (!currentUser) return false;
    if (currentUser.isAdmin) return true;
    const p = (currentUser.permissions || {}).PHUKIEN;
    return !!(p && p.canEdit);
  }
  async function xuatKhoPhuKienTheoChiDinh(maDH) {
    if (!window.ModulePhuKien || !window.ModulePhuKien.openPhieuXuatFormChoDon) {
      toast('Không mở được màn hình Phiếu xuất phụ kiện (thiếu quyền hoặc chưa tải xong).', 'error');
      return;
    }
    try { closeModal(); } catch (e) { /* không có modal nào đang mở thì bỏ qua */ }
    await switchModule('PHUKIEN', 'phieuxuat');
    await window.ModulePhuKien.openPhieuXuatFormChoDon(maDH);
  }

  function openEditorFor(maDH, orderRow) {
    // v5.56: các loại tài liệu này giờ có NHIỀU BẢN có tên/đơn → mở DANH SÁCH BẢN trước (chooser), rồi mới vào editor.
    if (activeChild === 'tailieuchung') return openDocBanList({ maDH, base: 'tailieuchung', loai: 'tailieuchung', title: 'Tài liệu kỹ thuật chung', openEditor: openTaiLieuChungEditor });
    if (activeChild === 'thongsodo') return openDocBanList({ maDH, base: 'thongsodo', loai: 'thongsodo', title: 'Thông số đo', openEditor: openThongSoDoEditor });
    if (activeChild === 'motasp') return openMoTaSanPhamBanList(maDH, 'motasp', 'Mô tả đường may');
    if (activeChild === 'quycach') return openMoTaSanPhamBanList(maDH, 'quycach', 'Quy cách đóng gói');   // v5.34c
    if (activeChild === 'hinhanhinthue') return openMoTaSanPhamBanList(maDH, 'hinhanhinthue', 'Hình ảnh mô tả in/thêu');   // v5.34c
    // v5.56: 4 loại đơn giá cũng NHIỀU BẢN có tên → qua chooser.
    if (activeChild === 'dongiainthe') return openDocBanList({ maDH, base: 'dongiainthe', title: 'Đơn giá in thêu', openEditor: openDonGiaInTheEditor });   // v5.34c
    if (activeChild === 'dongiamay') return openDocBanList({ maDH, base: 'dongiamay', title: 'Đơn giá công đoạn may', openEditor: openDonGiaMayEditor });   // v5.34 (B2)
    if (activeChild === 'dongiagiacong') return openDocBanList({ maDH, base: 'dongiagiacong', title: 'Đơn giá giao gia công', openEditor: openDonGiaGiaCongEditor });   // v5.34 (B2)
    if (activeChild === 'dongialadonggoi') return openDocBanList({ maDH, base: 'dongialadonggoi', title: 'Đơn giá là / đóng gói', openEditor: openDonGiaLaDongGoiEditor });   // v5.38
    if (activeChild === 'chidinhnpl') return openNplBanList(maDH);   // v5.54: danh sách BẢN chỉ định NPL (nhiều bản/đơn)
    // v5.27 (1.2): "Chỉ định NPL" da BO khoi giao dien (tab). Bang DonHangChiTietPhuKien + route
    // /orders/:maDH/phukien VAN giu (con dung boi bao cao / xuat phu kien). openChiDinhNplModal thanh dead code.
  }

  // Diem vao "deep-link" duoc goi TU module.qlsx.js (nut "Mở Chỉ định NPL" o cong doan PK trong Ghi
  // nhan tien do) - dam bao shell duoc render dung vao #content (dong bo sidebar/URL qua switchModule,
  // ham global tu app.js) roi moi mo THANG modal NPL cho don hang duoc chi dinh, khong bat nguoi dung
  // phai tu tim lai trong danh sach.
  async function openChiDinhNPL(maDH) {
    activeChild = 'chidinhnpl';
    await switchModule('QLSX', 'chidinhnpl');   // v5.50: NPL giờ là tab riêng (trước mở qua tab 'tailieukythuat')
    await openNplBanList(maDH);   // v5.54
  }

  // v5.53: hậu tố header " · Tên SP · Mã rập: X" cho các form đơn giá (không có form-grid header).
  function orderInfoSuffix(o) {
    if (!o) return '';
    return (o.TenSanPham ? ' · ' + escapeHtml(o.TenSanPham) : '') + (o.MaRap ? ' · Mã rập: ' + escapeHtml(o.MaRap) : '');
  }
  /* ================================================================================================
     v5.56 — CHOOSER "NHIỀU BẢN CÓ TÊN" DÙNG CHUNG cho các tài liệu header-based (tài liệu chung /
     thông số đo / mô tả·quy cách·hình in thêu). Cùng khuôn với openBtpBanList/openNplBanList:
     GET <base>/:maDH/phieu (list bản) — DELETE <base>/:maDH?ten= (xóa 1 bản) — mở editor(maDH, ten, onDone).
     ================================================================================================ */
  async function openDocBanList(opts) {
    // opts = { maDH, base (vd 'tailieuchung'), title, qs (vd '?loai=quycach' hoặc ''), openEditor(maDH,ten,onDone), loai (để IN theo bản) }
    const { maDH, base, title, openEditor } = opts;
    const qs = opts.qs || '';
    const url = `/api/tailieukythuat/${base}/${encodeURIComponent(maDH)}/phieu${qs}`;
    const res = await apiGet(url);
    const order = res.order || {}; const phieu = res.data || [];
    const rowsHtml = phieu.map(p => `<tr>
        <td>${p.TenPhieu ? escapeHtml(p.TenPhieu) : '<i>(không tên)</i>'}</td>
        <td>
          <button class="btn small secondary docb-open" data-ten="${escapeHtml(p.TenPhieu)}">${perm.canEdit ? 'Mở / Sửa' : 'Xem'}</button>
          <button class="btn small secondary docb-print" data-ten="${escapeHtml(p.TenPhieu)}" title="In bản này">🖨️ In</button>
          ${perm.canDelete ? `<button class="btn small danger docb-del" data-ten="${escapeHtml(p.TenPhieu)}">Xóa bản</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="2" class="empty-hint">Chưa có bản nào</td></tr>';
    const modal = openModal(`
      <h3>${escapeHtml(title)} — ${escapeHtml(maDH)}${order.TenSanPham ? ' · ' + escapeHtml(order.TenSanPham) : ''}${order.MaRap ? ' · Mã rập: ' + escapeHtml(order.MaRap) : ''}</h3>
      <p class="empty-hint">1 đơn có thể có NHIỀU bản — đặt tên để phân biệt (vd Áo / Quần / Đợt 1). Mỗi bản có nút <b>In</b> riêng.</p>
      <table><thead><tr><th>Tên bản</th><th style="width:300px">Thao tác</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="docbClose">Đóng</button>
        ${perm.canEdit ? `<button type="button" class="btn" id="docbAdd">+ Thêm ${escapeHtml(title.toLowerCase())}</button>` : ''}
      </div>`);
    const reopen = () => openDocBanList(opts);
    modal.querySelector('#docbClose').addEventListener('click', closeModal);
    // Bọc try/catch: editor lỗi giữa đường thì BÁO LỖI, không im lặng (bài học Bảng kê BTP v5.56).
    const openOne = async (ten) => {
      try { await openEditor(maDH, ten, reopen); } catch (err) { toast('Không mở được: ' + err.message, 'error'); }
    };
    const addBtn = modal.querySelector('#docbAdd');
    if (addBtn) addBtn.addEventListener('click', () => openOne(''));
    modal.querySelectorAll('.docb-open').forEach(b => b.addEventListener('click', () => openOne(b.dataset.ten)));
    // v5.57: IN ngay tại danh sách bản (không cần mở form). Dùng chung printOneOrderDoc theo loai + bản.
    modal.querySelectorAll('.docb-print').forEach(b => b.addEventListener('click', async () => {
      try { await printOneOrderDoc(maDH, opts.loai || base, b.dataset.ten); }
      catch (err) { toast('Không in được: ' + err.message, 'error'); }
    }));
    modal.querySelectorAll('.docb-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa bản này?')) return;
      const sep = qs ? '&' : '?';
      try {
        await apiDelete(`/api/tailieukythuat/${base}/${encodeURIComponent(maDH)}${qs}${sep}ten=${encodeURIComponent(b.dataset.ten)}`);
        toast('Đã xóa bản.', 'success'); reopen();
      } catch (err) { toast(err.message, 'error'); }
    }));
  }

  // v5.56: mô tả/quy cách/hình in thêu dùng chung 1 bảng, phân biệt ?loai= → chooser cần truyền loai + label.
  function openMoTaSanPhamBanList(maDH, loai, label) {
    return openDocBanList({
      maDH, base: 'motasp', loai, title: label, qs: '?loai=' + encodeURIComponent(loai),
      openEditor: (m, ten, onDone) => openMoTaSanPhamEditor(m, loai, label, ten, onDone)
    });
  }

  /* ================= HEADER DUNG CHUNG (Mã hàng/Diễn giải/Ngày cập nhật/Người lập) ================= */
  // v5.56: +ô "Tên bản" (tenBan) khi tài liệu hỗ trợ nhiều bản/đơn.
  function tlktHeaderFieldsHtml(data, order, tenPhieu) {
    const today = new Date().toISOString().slice(0, 10);
    const tenBanRow = tenPhieu === undefined ? '' :
      `<div class="form-row"><label>Tên bản</label><input name="tenBan" ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml(tenPhieu || '')}" placeholder="VD: Áo / Quần / Đợt 1 (để trống nếu chỉ 1 bản)"></div>`;
    return `
      <div class="form-grid">
        <div class="form-row"><label>Mã hàng</label><input name="maHang" ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml((data && data.maHang) || (order && (order.MaSanPham || order.MaDH)) || '')}"></div>
        ${tenBanRow}
        <div class="form-row"><label>Tên sản phẩm</label><div class="readonly-fact">${escapeHtml((order && order.TenSanPham) || '')}</div></div>
        <div class="form-row"><label>Mã rập</label><div class="readonly-fact">${escapeHtml((order && order.MaRap) || '')}</div></div>
        <div class="form-row"><label>Ngày cập nhật</label><input type="date" name="ngayCapNhat" ${perm.canEdit ? '' : 'disabled'} value="${data && data.ngayCapNhat ? String(data.ngayCapNhat).slice(0, 10) : today}"></div>
        <div class="form-row"><label>Diễn giải</label><input name="dienGiai" ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml((data && data.dienGiai) || (order && order.TenSanPham) || '')}"></div>
        <div class="form-row"><label>Người lập</label><div class="readonly-fact">${escapeHtml((data && data.nguoiLap) || (currentUser && currentUser.hoTen) || '')}</div></div>
      </div>`;
  }

  /* ================================================================================================
     1. TAI LIEU KY THUAT CHUNG - editor "mục/dòng" dùng chung cho tài liệu gắn đơn hàng LẪN tài liệu mẫu.
     ================================================================================================ */
  function taiLieuChungMucHtml(mucArr) {
    return (mucArr && mucArr.length ? mucArr.map((m, mi) => `
      <div class="row-repeater" data-muc="${mi}">
        <div class="form-row" style="display:flex;gap:10px;align-items:flex-end;">
          <div style="flex:1;"><label>Mục ${mi + 1} — Tiêu đề</label><textarea class="tlktc-tieude" rows="1" ${perm.canEdit ? '' : 'disabled'} placeholder="VD: Yêu cầu về nguyên phụ liệu...">${escapeHtml(m.tieuDe || '')}</textarea></div>
          ${perm.canEdit ? '<button type="button" class="btn small danger tlktc-del-muc">Xóa mục</button>' : ''}
        </div>
        <div class="sub-row-box">
          ${(m.dong && m.dong.length ? m.dong.map((d, di) => `
            <div class="sub-row-item" data-dong="${di}">
              <textarea class="tlktc-noidung" style="flex:1;" rows="2" ${perm.canEdit ? '' : 'disabled'} placeholder="Nội dung dòng...">${escapeHtml(d.noiDung || '')}</textarea>
              ${perm.canEdit ? '<button type="button" class="btn small danger tlktc-del-dong">X</button>' : ''}
            </div>`).join('') : '<div class="empty-hint" style="padding:6px;">Chưa có dòng nào</div>')}
          ${perm.canEdit ? '<button type="button" class="btn small secondary tlktc-add-dong" style="margin-top:4px;">+ Thêm dòng</button>' : ''}
        </div>
      </div>`).join('') : '<div class="empty-hint">Chưa có mục nào — bấm "Thêm mục" bên dưới.</div>');
  }

  function readMucFromDom(box) {
    return Array.from(box.querySelectorAll(':scope > [data-muc]')).map(mucEl => ({
      tieuDe: mucEl.querySelector('.tlktc-tieude').value,
      dong: Array.from(mucEl.querySelectorAll('[data-dong]')).map(dongEl => ({ noiDung: dongEl.querySelector('.tlktc-noidung').value }))
    }));
  }

  function renderMucBox(box, state) {
    box.innerHTML = taiLieuChungMucHtml(state.muc);
    wireMucBox(box, state);
  }

  function wireMucBox(box, state) {
    box.querySelectorAll('.tlktc-del-muc').forEach(btn => btn.addEventListener('click', () => {
      state.muc = readMucFromDom(box);
      state.muc.splice(Number(btn.closest('[data-muc]').dataset.muc), 1);
      renderMucBox(box, state);
    }));
    box.querySelectorAll('.tlktc-add-dong').forEach(btn => btn.addEventListener('click', () => {
      state.muc = readMucFromDom(box);
      state.muc[Number(btn.closest('[data-muc]').dataset.muc)].dong.push({ noiDung: '' });
      renderMucBox(box, state);
    }));
    box.querySelectorAll('.tlktc-del-dong').forEach(btn => btn.addEventListener('click', () => {
      state.muc = readMucFromDom(box);
      const mi = Number(btn.closest('[data-muc]').dataset.muc);
      state.muc[mi].dong.splice(Number(btn.closest('[data-dong]').dataset.dong), 1);
      renderMucBox(box, state);
    }));
  }

  async function openTaiLieuChungEditor(maDH, tenPhieu, onDone) {
    tenPhieu = tenPhieu || '';
    const res = await apiGet(`/api/tailieukythuat/tailieuchung/${maDH}?ten=${encodeURIComponent(tenPhieu)}`);
    const data = res.data, order = res.order;
    const mauList = (await apiGet('/api/tailieukythuat/tailieuchung-mau').catch(() => ({ data: [] }))).data || [];   // v5.56: lỗi API phụ không được chặn mở form
    const state = { muc: (data && data.muc && data.muc.length) ? JSON.parse(JSON.stringify(data.muc)) : [{ tieuDe: '', dong: [{ noiDung: '' }] }] };
    const html = `
      <h3>Tài liệu kỹ thuật chung — ${escapeHtml(maDH)}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}</h3>
      <form id="tlktcForm">
        ${tlktHeaderFieldsHtml(data, order, tenPhieu)}
        ${perm.canEdit ? `<div class="form-row"><label>Lấy nội dung từ tài liệu mẫu (sẽ THAY THẾ toàn bộ nội dung bên dưới)</label>
          <div style="display:flex;gap:8px;">
            <select id="tlktcMauSelect" style="flex:1;"><option value="">-- Chọn mẫu --</option>${mauList.map(m => `<option value="${m.ID}">${escapeHtml(m.TenMau)}</option>`).join('')}</select>
            <button type="button" class="btn secondary" id="btnLoadMau">Tải mẫu này</button>
          </div>
        </div>` : ''}
        <div class="form-row"><label>Nội dung (các mục có thể thêm/xóa, mỗi mục có nhiều dòng có thể thêm/xóa)</label>
          <div id="tlktcMucBox"></div>
          ${perm.canEdit ? '<button type="button" class="btn small secondary" id="btnAddMuc" style="margin-top:6px;">+ Thêm mục</button>' : ''}
        </div>
        <div class="modal-actions">
          ${perm.canDelete && data ? '<button type="button" class="btn danger" id="btnDeleteDoc">Xóa tài liệu</button>' : ''}
          <button type="button" class="btn secondary" id="btnPrintDoc">🖨️ In</button>
          <button type="button" class="btn secondary" id="btnCancel">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>
          ${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu</button>' : ''}
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    const mucBox = modal.querySelector('#tlktcMucBox');
    renderMucBox(mucBox, state);
    const btnAddMuc = modal.querySelector('#btnAddMuc');
    if (btnAddMuc) btnAddMuc.addEventListener('click', () => {
      state.muc = readMucFromDom(mucBox);
      state.muc.push({ tieuDe: '', dong: [{ noiDung: '' }] });
      renderMucBox(mucBox, state);
    });
    const btnLoadMau = modal.querySelector('#btnLoadMau');
    if (btnLoadMau) btnLoadMau.addEventListener('click', async () => {
      const id = modal.querySelector('#tlktcMauSelect').value;
      if (!id) { toast('Vui lòng chọn 1 mẫu.', 'error'); return; }
      if (!confirm('Tải mẫu sẽ THAY THẾ toàn bộ nội dung đang soạn bên dưới. Tiếp tục?')) return;
      try {
        const mauData = (await apiGet(`/api/tailieukythuat/tailieuchung-mau/${id}`)).data;
        state.muc = JSON.parse(JSON.stringify(mauData.muc || []));
        renderMucBox(mucBox, state);
        toast('Đã tải nội dung mẫu.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    modal.querySelector('#btnPrintDoc').addEventListener('click', () => {
      state.muc = readMucFromDom(mucBox);
      const fd = new FormData(modal.querySelector('#tlktcForm'));
      printTaiLieuChung({ maHang: fd.get('maHang'), dienGiai: fd.get('dienGiai'), ngayCapNhat: fd.get('ngayCapNhat'), nguoiLap: (data && data.nguoiLap) || (currentUser && currentUser.hoTen), muc: state.muc, maRap: (order && order.MaRap) || '', tenBan: (fd.get('tenBan') || '').trim() }, maDH);   // v5.57 +Mã rập
    });
    const btnDelete = modal.querySelector('#btnDeleteDoc');
    if (btnDelete) btnDelete.addEventListener('click', async () => {
      if (!confirm('Xóa bản tài liệu kỹ thuật chung này?')) return;
      try {
        await apiDelete(`/api/tailieukythuat/tailieuchung/${maDH}?ten=${encodeURIComponent(tenPhieu)}`);
        closeModal(); toast('Đã xóa.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
    modal.querySelector('#tlktcForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!perm.canEdit) return;
      state.muc = readMucFromDom(mucBox);
      const fd = new FormData(e.target);
      try {
        await apiPost(`/api/tailieukythuat/tailieuchung/${maDH}`, {
          maHang: fd.get('maHang'), dienGiai: fd.get('dienGiai'), ngayCapNhat: fd.get('ngayCapNhat'), muc: state.muc,
          ten: fd.get('tenBan') || '', oldTen: tenPhieu   // v5.56: bản có tên (+đổi tên)
        });
        closeModal(); toast('Đã lưu tài liệu kỹ thuật chung.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ---- Quản lý tài liệu MẪU (LaMau=1, dùng chung UI mục/dòng ở trên) ---- */
  async function openMauManager() {
    const list = (await apiGet('/api/tailieukythuat/tailieuchung-mau')).data || [];
    const html = `
      <h3>Quản lý tài liệu mẫu (Tài liệu kỹ thuật chung)</h3>
      ${perm.canEdit ? '<div class="form-row"><button type="button" class="btn small" id="btnNewMau">+ Tạo mẫu mới</button></div>' : ''}
      <table><thead><tr><th>Tên mẫu</th><th></th></tr></thead>
        <tbody>${list.map(m => `<tr><td>${escapeHtml(m.TenMau)}</td><td>
          <button type="button" class="btn small secondary mau-edit" data-id="${m.ID}">${perm.canEdit ? 'Sửa' : 'Xem'}</button>
          ${perm.canDelete ? `<button type="button" class="btn small danger mau-del" data-id="${m.ID}">Xóa</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="2" class="empty-hint">Chưa có tài liệu mẫu nào.</td></tr>'}</tbody></table>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCloseMauList">Đóng</button></div>`;
    const modal = openModal(html);
    modal.querySelector('#btnCloseMauList').addEventListener('click', closeModal);
    const btnNew = modal.querySelector('#btnNewMau');
    if (btnNew) btnNew.addEventListener('click', () => openMauEditor(null));
    modal.querySelectorAll('.mau-edit').forEach(btn => btn.addEventListener('click', () => openMauEditor(btn.dataset.id)));
    modal.querySelectorAll('.mau-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa tài liệu mẫu này?')) return;
      try { await apiDelete(`/api/tailieukythuat/tailieuchung-mau/${btn.dataset.id}`); toast('Đã xóa.', 'success'); openMauManager(); } catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function openMauEditor(id) {
    const data = id ? (await apiGet(`/api/tailieukythuat/tailieuchung-mau/${id}`)).data : null;
    const state = { muc: (data && data.muc && data.muc.length) ? JSON.parse(JSON.stringify(data.muc)) : [{ tieuDe: '', dong: [{ noiDung: '' }] }] };
    const html = `
      <h3>${id ? (perm.canEdit ? 'Sửa' : 'Xem') : 'Tạo'} tài liệu mẫu</h3>
      <form id="mauForm">
        <div class="form-row"><label>Tên mẫu *</label><input name="tenMau" required ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml((data && data.tenMau) || '')}"></div>
        <div class="form-row"><label>Nội dung (các mục có thể thêm/xóa, mỗi mục có nhiều dòng có thể thêm/xóa)</label>
          <div id="mauMucBox"></div>
          ${perm.canEdit ? '<button type="button" class="btn small secondary" id="btnAddMucMau" style="margin-top:6px;">+ Thêm mục</button>' : ''}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancelMau">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>
          ${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu mẫu</button>' : ''}
        </div>
      </form>`;
    const modal = openModal(html, { onClose: openMauManager });
    modal.querySelector('#btnCancelMau').addEventListener('click', openMauManager);
    const mucBox = modal.querySelector('#mauMucBox');
    renderMucBox(mucBox, state);
    const btnAddMuc = modal.querySelector('#btnAddMucMau');
    if (btnAddMuc) btnAddMuc.addEventListener('click', () => {
      state.muc = readMucFromDom(mucBox);
      state.muc.push({ tieuDe: '', dong: [{ noiDung: '' }] });
      renderMucBox(mucBox, state);
    });
    modal.querySelector('#mauForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!perm.canEdit) return;
      state.muc = readMucFromDom(mucBox);
      const fd = new FormData(e.target);
      const payload = { tenMau: fd.get('tenMau'), muc: state.muc };
      try {
        if (id) await apiPut(`/api/tailieukythuat/tailieuchung-mau/${id}`, payload);
        else await apiPost('/api/tailieukythuat/tailieuchung-mau', payload);
        toast('Đã lưu tài liệu mẫu.', 'success');
        openMauManager();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     2. THONG SO DO — BIỂU MẪU MỚI v5.58 (theo file thongsodo.xls của khách):
        DÒNG = 1 THÔNG SỐ:  TT | THÔNG SỐ (Dài áo…) | VỊ TRÍ ĐO (cách đo) | [giá trị theo SIZE] | dung sai (+/-)
        CỘT  = SIZE (80, 90, 100, 110, 120, 130, 140…) — thêm/xóa được.
        Khối "Ghi chú / YÊU CẦU KỸ THUẬT" + ảnh minh hoạ nằm ở phần riêng bên dưới lưới (in ra sẽ
        nằm ở cột Ghi chú gộp bên phải bảng, giống bản Excel).
        LƯU Ý: mẫu CŨ ngược chiều (dòng = size). Bản ghi cũ mở lên sẽ thấy lệch — dùng nút
        "⇄ Đổi chiều dòng/cột" để chuyển 1 phát rồi Lưu.
     ================================================================================================ */
  function tsdGridHtml(state) {
    const cols = state.cols, rows = state.rows;
    return `<table>
      <thead><tr>
        <th style="width:44px;">TT</th>
        <th style="min-width:130px;">THÔNG SỐ</th>
        <th style="min-width:180px;">VỊ TRÍ ĐO</th>
        ${cols.map((c, ci) => `<th data-col="${ci}" style="min-width:64px;"><input class="tlkt-grid-input tsd-colname" ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml(c.tenCot)}" placeholder="Size" style="text-align:center;">${perm.canEdit ? '<button type="button" class="btn small danger tsd-del-col" style="margin-top:4px;width:100%;">Xóa</button>' : ''}</th>`).join('')}
        ${perm.canEdit ? `<th style="width:70px;"><button type="button" class="btn small secondary" id="btnTsdAddCol">+ Size</button></th>` : ''}
        <th style="width:86px;">dung sai (+/-)</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, ri) => `<tr data-row="${ri}">
          <td style="text-align:center;">${ri + 1}</td>
          <td><input class="tlkt-grid-input tsd-rowname" ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml(r.tenDong)}" placeholder="VD: Dài áo">${perm.canEdit ? '<button type="button" class="btn small danger tsd-del-row" style="margin-top:4px;width:100%;">Xóa dòng</button>' : ''}</td>
          <td><input class="tlkt-grid-input tsd-vitrido" ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml(r.viTriDo || '')}" placeholder="VD: Đo từ cạnh cổ trước đến gấu áo"></td>
          ${cols.map((c, ci) => `<td><input class="tlkt-grid-input tsd-val" ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml(r.values[ci] != null ? r.values[ci] : '')}" style="text-align:center;"></td>`).join('')}
          ${perm.canEdit ? '<td></td>' : ''}
          <td><input class="tlkt-grid-input tsd-dungsai" ${perm.canEdit ? '' : 'disabled'} value="${escapeHtml(r.dungSai || '')}" placeholder="1" style="text-align:center;"></td>
        </tr>`).join('') || `<tr><td colspan="${cols.length + (perm.canEdit ? 5 : 4)}" class="empty-hint">Chưa có dòng thông số nào</td></tr>`}
      </tbody>
    </table>
    ${perm.canEdit ? `<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn small secondary" id="btnTsdAddRow">+ Thêm dòng (thông số)</button>
        <button type="button" class="btn small secondary" id="btnTsdSizeChuan">↧ Điền size chuẩn (80→140)</button>
        <button type="button" class="btn small secondary" id="btnTsdTranspose" title="Dữ liệu cũ có dòng = size; bấm để đổi chiều cho đúng mẫu mới">⇄ Đổi chiều dòng/cột</button>
      </div>` : ''}`;
  }

  function readTsdGridFromDom(box) {
    const table = box.querySelector('table');
    const cols = Array.from(table.querySelectorAll('thead [data-col]')).map(th => ({ tenCot: th.querySelector('.tsd-colname').value }));
    const rows = Array.from(table.querySelectorAll('tbody [data-row]')).map(tr => ({
      tenDong: tr.querySelector('.tsd-rowname').value,
      viTriDo: tr.querySelector('.tsd-vitrido') ? tr.querySelector('.tsd-vitrido').value : '',
      dungSai: tr.querySelector('.tsd-dungsai') ? tr.querySelector('.tsd-dungsai').value : '',
      values: Array.from(tr.querySelectorAll('.tsd-val')).map(inp => inp.value)
    }));
    return { cols, rows };
  }

  function syncTsdGrid(box, state) { Object.assign(state, readTsdGridFromDom(box)); }

  function renderTsdGridBox(box, state) {
    box.innerHTML = tsdGridHtml(state);
    wireTsdGridBox(box, state);
  }

  function wireTsdGridBox(box, state) {
    const btnAddCol = box.querySelector('#btnTsdAddCol');
    if (btnAddCol) btnAddCol.addEventListener('click', () => {
      syncTsdGrid(box, state);
      state.cols.push({ tenCot: '' });
      state.rows.forEach(r => r.values.push(''));
      renderTsdGridBox(box, state);
    });
    const btnAddRow = box.querySelector('#btnTsdAddRow');
    if (btnAddRow) btnAddRow.addEventListener('click', () => {
      syncTsdGrid(box, state);
      state.rows.push({ tenDong: '', viTriDo: '', dungSai: '', values: new Array(state.cols.length).fill('') });
      renderTsdGridBox(box, state);
    });
    // v5.58: điền nhanh dải size chuẩn của biểu mẫu (80 → 140).
    const btnSizeChuan = box.querySelector('#btnTsdSizeChuan');
    if (btnSizeChuan) btnSizeChuan.addEventListener('click', () => {
      syncTsdGrid(box, state);
      if (state.cols.length && !confirm('Thay TOÀN BỘ cột size hiện tại bằng 80/90/100/110/120/130/140?')) return;
      state.cols = ['80', '90', '100', '110', '120', '130', '140'].map(s => ({ tenCot: s }));
      state.rows.forEach(r => { r.values = state.cols.map((c, i) => (r.values && r.values[i] != null ? r.values[i] : '')); });
      renderTsdGridBox(box, state);
    });
    // v5.58: dữ liệu theo mẫu CŨ có dòng = size → đổi chiều 1 phát cho khớp mẫu mới.
    const btnTranspose = box.querySelector('#btnTsdTranspose');
    if (btnTranspose) btnTranspose.addEventListener('click', () => {
      syncTsdGrid(box, state);
      if (!state.rows.length || !state.cols.length) { toast('Chưa có dữ liệu để đổi chiều.', 'error'); return; }
      if (!confirm('Đổi chiều: DÒNG hiện tại sẽ thành CỘT và ngược lại. Tiếp tục?')) return;
      const oldCols = state.cols.slice(), oldRows = state.rows.slice();
      state.cols = oldRows.map(r => ({ tenCot: r.tenDong }));
      state.rows = oldCols.map((c, ci) => ({
        tenDong: c.tenCot, viTriDo: '', dungSai: '',
        values: oldRows.map(r => (r.values && r.values[ci] != null ? r.values[ci] : ''))
      }));
      renderTsdGridBox(box, state);
      toast('Đã đổi chiều. Kiểm tra lại rồi bấm Lưu.', 'success');
    });
    box.querySelectorAll('.tsd-del-col').forEach(btn => btn.addEventListener('click', () => {
      syncTsdGrid(box, state);
      const ci = Number(btn.closest('[data-col]').dataset.col);
      state.cols.splice(ci, 1);
      state.rows.forEach(r => r.values.splice(ci, 1));
      renderTsdGridBox(box, state);
    }));
    box.querySelectorAll('.tsd-del-row').forEach(btn => btn.addEventListener('click', () => {
      syncTsdGrid(box, state);
      state.rows.splice(Number(btn.closest('[data-row]').dataset.row), 1);
      renderTsdGridBox(box, state);
    }));
  }

  // v5.34e: quan ly (liet ke + xoa) tai lieu MAU dung chung cho Thong so/Mo ta/Quy cach. listUrl co the kem
  // ?loai=; delBase = url xoa (tu them /:id). Mo lai chinh no sau khi xoa.
  async function openDocMauManager(listUrl, delBase, title) {
    const list = (await apiGet(listUrl)).data || [];
    const modal = openModal(`<h3>Quản lý mẫu — ${escapeHtml(title)}</h3>
      <table><thead><tr><th style="text-align:center;">Tên mẫu</th><th style="width:150px"></th></tr></thead>
      <tbody>${list.map(m => `<tr><td style="text-align:center;">${escapeHtml(m.TenMau)}</td><td style="white-space:nowrap;">${perm.canEdit ? `<button class="btn small secondary dmm-edit" data-id="${m.ID}" data-ten="${escapeHtml(m.TenMau)}">Sửa</button> ` : ''}${perm.canDelete ? `<button class="btn small danger dmm-del" data-id="${m.ID}">Xóa</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="2" class="empty-hint">Chưa có mẫu</td></tr>'}</tbody></table>
      <div class="modal-actions"><button type="button" class="btn secondary" id="dmmClose">Đóng</button></div>`);
    modal.querySelector('#dmmClose').addEventListener('click', closeModal);
    modal.querySelectorAll('.dmm-edit').forEach(b => b.addEventListener('click', async () => {
      const ten = prompt('Đổi tên mẫu:', b.dataset.ten || '');
      if (ten == null) return;
      if (!ten.trim()) { toast('Tên mẫu không được để trống.', 'error'); return; }
      try { await apiPut(delBase + '/' + b.dataset.id, { tenMau: ten.trim() }); toast('Đã đổi tên.', 'success'); openDocMauManager(listUrl, delBase, title); }
      catch (err) { toast(err.message, 'error'); }
    }));
    modal.querySelectorAll('.dmm-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa mẫu này?')) return;
      try { await apiDelete(delBase + '/' + b.dataset.id); toast('Đã xóa.', 'success'); openDocMauManager(listUrl, delBase, title); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function openThongSoDoEditor(maDH, tenPhieu, onDone) {
    tenPhieu = tenPhieu || '';
    const res = await apiGet(`/api/tailieukythuat/thongsodo/${maDH}?ten=${encodeURIComponent(tenPhieu)}`);
    const data = res.data, order = res.order;
    const tsdMauList = (await apiGet('/api/tailieukythuat/thongsodo-mau').catch(() => ({ data: [] }))).data || [];   // v5.34e (v5.56: lỗi API phụ không chặn mở form)
    // v5.58: mẫu mới — mặc định 1 dòng thông số + dải size chuẩn 80→140 khi tạo mới.
    const state = (data && data.cols && data.cols.length) ? { cols: JSON.parse(JSON.stringify(data.cols)), rows: JSON.parse(JSON.stringify(data.rows)) }
      : { cols: ['80', '90', '100', '110', '120', '130', '140'].map(s => ({ tenCot: s })), rows: [{ tenDong: '', viTriDo: '', dungSai: '', values: new Array(7).fill('') }] };
    const anhState = { list: (data && Array.isArray(data.anhGhiChu)) ? data.anhGhiChu.slice() : [] };
    const html = `
      <h3>Thông số đo — ${escapeHtml(maDH)}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}</h3>
      <form id="tsdForm">
        ${tlktHeaderFieldsHtml(data, order, tenPhieu)}
        ${perm.canEdit && tsdMauList.length ? `<div class="form-row"><label>Áp mẫu (THAY THẾ bảng bên dưới)</label><div style="display:flex;gap:8px;"><select id="tsdMauSelect" style="flex:1;"><option value="">-- Chọn mẫu --</option>${tsdMauList.map(m => `<option value="${m.ID}">${escapeHtml(m.TenMau)}</option>`).join('')}</select><button type="button" class="btn secondary" id="btnApTsdMau">Tải mẫu này</button></div></div>` : ''}
        <div class="form-row"><label>BẢNG THÔNG SỐ — mỗi dòng 1 thông số (Dài áo, Rộng ngang ngực…), cột là size</label>
          <div id="tsdGridBox"></div>
        </div>
        <div class="form-row"><label>Ghi chú / YÊU CẦU KỸ THUẬT (in ở cột Ghi chú bên phải bảng)</label>
          <textarea name="yeuCauKyThuat" rows="6" ${perm.canEdit ? '' : 'disabled'} placeholder="VD:&#10;• Các đường can chắp bằng vắt sổ bờ 0.8cm - chỉ may đồng màu vải chính, may theo mẫu.&#10;• Mật độ mũi chỉ 4 mũi/1cm.&#10;Lưu ý: Sản phẩm may xong vệ sinh công nghiệp sạch sẽ…">${escapeHtml((data && data.yeuCauKyThuat) || '')}</textarea>
        </div>
        <div class="form-row"><label>Ảnh minh hoạ kèm phần Ghi chú ${perm.canEdit ? '(dán Ctrl+V hoặc chọn file — nhiều ảnh)' : ''}</label>
          <div id="tsdAnhBox"></div>
          ${perm.canEdit ? '<input type="file" id="tsdAnhFile" accept="image/*" multiple style="margin-top:6px;">' : ''}
        </div>
        <div class="modal-actions">
          ${perm.canDelete && data ? '<button type="button" class="btn danger" id="btnDeleteDoc">Xóa tài liệu</button>' : ''}
          ${perm.canEdit ? '<button type="button" class="btn secondary" id="btnLuuTsdMau">Lưu thành mẫu</button><button type="button" class="btn secondary" id="btnQlTsdMau">Quản lý mẫu</button>' : ''}
          <button type="button" class="btn secondary" id="btnPrintDoc">🖨️ In</button>
          <button type="button" class="btn secondary" id="btnCancel">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>
          ${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu</button>' : ''}
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    const gridBox = modal.querySelector('#tsdGridBox');
    renderTsdGridBox(gridBox, state);
    // v5.58: quản lý ảnh minh hoạ của khối Ghi chú (dán Ctrl+V hoặc chọn file, xóa từng ảnh).
    const anhBox = modal.querySelector('#tsdAnhBox');
    function renderAnh() {
      anhBox.innerHTML = anhState.list.length
        ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">${anhState.list.map((u, i) => `
            <div style="position:relative;border:1px solid #dadce0;border-radius:6px;padding:4px;">
              <img src="${escapeHtml(u)}" style="width:110px;height:110px;object-fit:contain;">
              ${perm.canEdit ? `<button type="button" class="btn small danger tsd-anh-del" data-i="${i}" style="position:absolute;top:2px;right:2px;">×</button>` : ''}
            </div>`).join('')}</div>`
        : '<div class="empty-hint">Chưa có ảnh nào.</div>';
      anhBox.querySelectorAll('.tsd-anh-del').forEach(b => b.addEventListener('click', () => {
        anhState.list.splice(Number(b.dataset.i), 1); renderAnh();
      }));
    }
    renderAnh();
    async function addAnhFiles(files) {
      for (const f of Array.from(files || [])) {
        if (!f.type || f.type.indexOf('image/') !== 0) continue;
        try { anhState.list.push(await uploadFile(f, 'thongsodo')); }
        catch (err) { toast('Lỗi tải ảnh: ' + err.message, 'error'); }
      }
      renderAnh();
    }
    const anhFile = modal.querySelector('#tsdAnhFile');
    if (anhFile) anhFile.addEventListener('change', () => { addAnhFiles(anhFile.files); anhFile.value = ''; });
    if (perm.canEdit) modal.addEventListener('paste', (e) => {
      const items = (e.clipboardData && e.clipboardData.files) || null;
      if (items && items.length) { addAnhFiles(items); }
    });
    // v5.34e: áp mẫu / lưu thành mẫu / quản lý mẫu.
    const btnApTsdMau = modal.querySelector('#btnApTsdMau');
    if (btnApTsdMau) btnApTsdMau.addEventListener('click', async () => {
      const id = modal.querySelector('#tsdMauSelect').value;
      if (!id) { toast('Vui lòng chọn 1 mẫu.', 'error'); return; }
      if (!confirm('Áp mẫu sẽ THAY THẾ bảng đang soạn. Tiếp tục?')) return;
      try { const m = (await apiGet('/api/tailieukythuat/thongsodo-mau/' + id)).data; state.cols = JSON.parse(JSON.stringify(m.cols || [])); state.rows = JSON.parse(JSON.stringify(m.rows || [])); renderTsdGridBox(gridBox, state); toast('Đã áp mẫu.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    });
    const btnLuuTsdMau = modal.querySelector('#btnLuuTsdMau');
    if (btnLuuTsdMau) btnLuuTsdMau.addEventListener('click', async () => {
      syncTsdGrid(gridBox, state); const ten = prompt('Tên mẫu:'); if (!ten || !ten.trim()) return;
      try { await apiPost('/api/tailieukythuat/thongsodo-mau', { tenMau: ten.trim(), cols: state.cols, rows: state.rows }); toast('Đã lưu mẫu.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    });
    const btnQlTsdMau = modal.querySelector('#btnQlTsdMau');
    if (btnQlTsdMau) btnQlTsdMau.addEventListener('click', () => openDocMauManager('/api/tailieukythuat/thongsodo-mau', '/api/tailieukythuat/thongsodo-mau', 'Thông số kỹ thuật'));
    modal.querySelector('#btnPrintDoc').addEventListener('click', () => {
      syncTsdGrid(gridBox, state);
      const fd = new FormData(modal.querySelector('#tsdForm'));
      printThongSoDo({ maHang: fd.get('maHang'), dienGiai: fd.get('dienGiai'), ngayCapNhat: fd.get('ngayCapNhat'), nguoiLap: (data && data.nguoiLap) || (currentUser && currentUser.hoTen), cols: state.cols, rows: state.rows, maRap: (order && order.MaRap) || '', tenBan: (fd.get('tenBan') || '').trim(), yeuCauKyThuat: fd.get('yeuCauKyThuat') || '', anhGhiChu: anhState.list }, maDH);   // v5.57 +Mã rập; v5.58 +yêu cầu KT + ảnh
    });
    const btnDelete = modal.querySelector('#btnDeleteDoc');
    if (btnDelete) btnDelete.addEventListener('click', async () => {
      if (!confirm('Xóa bản thông số đo này?')) return;
      try {
        await apiDelete(`/api/tailieukythuat/thongsodo/${maDH}?ten=${encodeURIComponent(tenPhieu)}`);
        closeModal(); toast('Đã xóa.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
    modal.querySelector('#tsdForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!perm.canEdit) return;
      syncTsdGrid(gridBox, state);
      const fd = new FormData(e.target);
      try {
        await apiPost(`/api/tailieukythuat/thongsodo/${maDH}`, {
          maHang: fd.get('maHang'), dienGiai: fd.get('dienGiai'), ngayCapNhat: fd.get('ngayCapNhat'), cols: state.cols, rows: state.rows,
          ten: fd.get('tenBan') || '', oldTen: tenPhieu,   // v5.56
          yeuCauKyThuat: fd.get('yeuCauKyThuat') || '', anhGhiChu: anhState.list   // v5.58
        });
        closeModal(); toast('Đã lưu thông số đo.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.34 (B2): "Đơn giá công đoạn may" (model mới, mục 4.3). Nhiều dòng: Tên công đoạn / Giây giờ /
  // Hệ số công đoạn / Hệ số công nhân (mặc định 4) / Thành tiền = Giây giờ × Hệ số CĐ × Hệ số CN (auto).
  // Dùng cho lương khoán may (SL × Thành tiền) ở công đoạn May (Giai đoạn C).
  // v5.56: ô "Tên bản" dùng chung cho 4 form đơn giá (các form này không có form-grid header).
  function tenBanRowHtml(tenPhieu) {
    return `<div class="form-row" style="margin-bottom:8px;"><label>Tên bản</label>
      <input name="tenBan" value="${escapeHtml(tenPhieu || '')}" placeholder="VD: Áo / Quần / Đợt 1 (để trống nếu chỉ 1 bản)" ${perm.canEdit ? '' : 'disabled'}></div>`;
  }
  async function openDonGiaMayEditor(maDH, tenPhieu, onDone) {
    tenPhieu = tenPhieu || '';
    const res = await apiGet('/api/tailieukythuat/dongiamay/' + maDH + '?ten=' + encodeURIComponent(tenPhieu));
    let rows = (res.data || []).map(r => ({ tenCongDoan: r.TenCongDoan || '', giayGio: r.GiayGio != null ? r.GiayGio : '', heSoCongDoan: r.HeSoCongDoan != null ? r.HeSoCongDoan : '', heSoCongNhan: r.HeSoCongNhan != null ? r.HeSoCongNhan : 4 }));
    if (!rows.length) rows = [{ tenCongDoan: '', giayGio: '', heSoCongDoan: '', heSoCongNhan: 4 }];
    const tt = r => (Number(r.giayGio) || 0) * (Number(r.heSoCongDoan) || 0) * (Number(r.heSoCongNhan) || 0);
    const modal = openModal(`<h3>Đơn giá công đoạn may — ${escapeHtml(maDH)}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}${orderInfoSuffix(res.order)}</h3>
      <form id="dgmForm">${tenBanRowHtml(tenPhieu)}<div id="dgmBox"></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnPrintDgm">🖨️ In</button>
          <button type="button" class="btn secondary" id="btnCancelDgm">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>
          ${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu</button>' : ''}
        </div></form>`);
    modal.querySelector('#btnCancelDgm').addEventListener('click', closeModal);
    const box = modal.querySelector('#dgmBox');
    function sync() {
      box.querySelectorAll('[data-dgmrow]').forEach(el => {
        const r = rows[Number(el.dataset.i)]; if (!r) return;
        r.tenCongDoan = el.querySelector('.dgm-ten').value; r.giayGio = el.querySelector('.dgm-gio').value;
        r.heSoCongDoan = el.querySelector('.dgm-hscd').value; r.heSoCongNhan = el.querySelector('.dgm-hscn').value;
      });
    }
    function renderRows() {
      const grand = rows.reduce((s, r) => s + tt(r), 0);
      box.innerHTML = `<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;">
        <thead><tr><th style="width:38px;">STT</th><th>Tên công đoạn</th><th>Giây giờ</th><th>Hệ số công đoạn</th><th>Hệ số công nhân</th><th>Thành tiền</th><th></th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr data-dgmrow data-i="${i}"><td style="text-align:center;">${i + 1}</td>
          <td><input class="dgm-ten" value="${escapeHtml(r.tenCongDoan || '')}" style="width:160px;"></td>
          <td><input type="number" step="0.0001" min="0" class="dgm-gio" value="${r.giayGio}" style="width:80px;"></td>
          <td><input type="number" step="0.0001" min="0" class="dgm-hscd" value="${r.heSoCongDoan}" style="width:80px;"></td>
          <td><input type="number" step="0.0001" min="0" class="dgm-hscn" value="${r.heSoCongNhan}" style="width:70px;"></td>
          <td class="dgm-tt" style="text-align:right;font-weight:600;">${fmtNumber(tt(r))}</td>
          <td><button type="button" class="btn small danger dgm-del" data-i="${i}">X</button></td></tr>`).join('')}</tbody>
        <tfoot><tr><td></td><td colspan="4" style="text-align:right;font-weight:700;">Tổng</td><td style="text-align:right;font-weight:700;">${fmtNumber(grand)}</td><td></td></tr></tfoot>
      </table><button type="button" class="btn small secondary" id="dgmAdd" style="margin-top:6px;">+ Thêm công đoạn</button>`;
      box.querySelectorAll('.dgm-gio, .dgm-hscd, .dgm-hscn').forEach(inp => inp.addEventListener('input', () => {
        const trEl = inp.closest('[data-dgmrow]'); const r = rows[Number(trEl.dataset.i)];
        r.giayGio = trEl.querySelector('.dgm-gio').value; r.heSoCongDoan = trEl.querySelector('.dgm-hscd').value; r.heSoCongNhan = trEl.querySelector('.dgm-hscn').value;
        trEl.querySelector('.dgm-tt').textContent = fmtNumber(tt(r));
      }));
      box.querySelectorAll('.dgm-del').forEach(b => b.addEventListener('click', () => { sync(); rows.splice(Number(b.dataset.i), 1); if (!rows.length) rows.push({ tenCongDoan: '', giayGio: '', heSoCongDoan: '', heSoCongNhan: 4 }); renderRows(); }));
      box.querySelector('#dgmAdd').addEventListener('click', () => { sync(); rows.push({ tenCongDoan: '', giayGio: '', heSoCongDoan: '', heSoCongNhan: 4 }); renderRows(); });
    }
    renderRows();
    modal.querySelector('#btnPrintDgm').addEventListener('click', () => { sync(); printHtml('Đơn giá công đoạn may - ' + maDH, `<h2>ĐƠN GIÁ CÔNG ĐOẠN MAY</h2><p><b>Mã ĐH:</b> ${escapeHtml(maDH)}</p><table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4"><thead><tr><th style="width:38px;">STT</th><th>Tên công đoạn</th><th>Giây giờ</th><th>Hệ số công đoạn</th><th>Hệ số công nhân</th><th>Thành tiền</th></tr></thead><tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.tenCongDoan || '')}</td><td style="text-align:center;">${escapeHtml(String(r.giayGio || ''))}</td><td style="text-align:center;">${escapeHtml(String(r.heSoCongDoan || ''))}</td><td style="text-align:center;">${escapeHtml(String(r.heSoCongNhan || ''))}</td><td style="text-align:right;">${fmtNumber(tt(r))}</td></tr>`).join('')}</tbody></table>`); });
    modal.querySelector('#dgmForm').addEventListener('submit', async (e) => {
      e.preventDefault(); if (!perm.canEdit) return; sync();
      const ten = (modal.querySelector('[name="tenBan"]').value || '').trim();
      try {
        await apiPost('/api/tailieukythuat/dongiamay/' + maDH, { rows: rows.filter(r => (r.tenCongDoan || '').trim()), ten, oldTen: tenPhieu });
        closeModal(); toast('Đã lưu đơn giá công đoạn may.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.34 (B2, mục 5): "Đơn giá giao gia công" — chuyển từ Kỹ thuật sang. Chọn hạng mục (danh mục
  // HangMucGiaCong) + đơn giá theo đơn (DonHangHangMucGiaCong). "+ Mới" thêm hạng mục vào danh mục.
  async function openDonGiaGiaCongEditor(maDH, tenPhieu, onDone) {
    tenPhieu = tenPhieu || '';
    const res = await apiGet('/api/tailieukythuat/dongiagiacong/' + maDH + '?ten=' + encodeURIComponent(tenPhieu));
    let catalog = res.catalog || [];
    let rows = (res.chosen || []).map(c => ({ hangMucGiaCongId: c.HangMucGiaCongID, donGia: c.DonGia != null ? c.DonGia : '' }));
    if (!rows.length) rows = [{ hangMucGiaCongId: '', donGia: '' }];
    const modal = openModal(`<h3>Đơn giá giao gia công — ${escapeHtml(maDH)}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}${orderInfoSuffix(res.order)}</h3>
      <form id="dggForm">${tenBanRowHtml(tenPhieu)}<div id="dggBox"></div>
        <div class="toolbar" style="margin-top:6px;"><button type="button" class="btn small secondary" id="dggAddRow">+ Thêm hạng mục</button><button type="button" class="btn small secondary" id="dggNew">+ Mới (danh mục)</button></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnPrintDgg">🖨️ In</button>
          <button type="button" class="btn secondary" id="btnCancelDgg">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>
          ${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu</button>' : ''}
        </div></form>`);
    modal.querySelector('#btnCancelDgg').addEventListener('click', closeModal);
    const box = modal.querySelector('#dggBox');
    function optionsFor(sel) { return catalog.map(c => `<option value="${c.HangMucGiaCongID}" ${String(c.HangMucGiaCongID) === String(sel) ? 'selected' : ''}>${escapeHtml(c.TenHangMuc)}</option>`).join(''); }
    function sync() {
      box.querySelectorAll('[data-dggrow]').forEach(el => { const r = rows[Number(el.dataset.i)]; if (!r) return; r.hangMucGiaCongId = el.querySelector('.dgg-hm').value; r.donGia = el.querySelector('.dgg-gia').value; });
    }
    function renderRows() {
      box.innerHTML = `<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;">
        <thead><tr><th style="width:38px;">STT</th><th>Hạng mục gia công</th><th>Đơn giá</th><th></th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr data-dggrow data-i="${i}"><td style="text-align:center;">${i + 1}</td>
          <td><select class="dgg-hm" style="min-width:200px;"><option value="">-- Chọn hạng mục --</option>${optionsFor(r.hangMucGiaCongId)}</select></td>
          <td><input type="number" step="0.01" min="0" class="dgg-gia" value="${r.donGia}" style="width:110px;"></td>
          <td><button type="button" class="btn small danger dgg-del" data-i="${i}">X</button></td></tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('.dgg-del').forEach(b => b.addEventListener('click', () => { sync(); rows.splice(Number(b.dataset.i), 1); if (!rows.length) rows.push({ hangMucGiaCongId: '', donGia: '' }); renderRows(); }));
    }
    renderRows();
    modal.querySelector('#dggAddRow').addEventListener('click', () => { sync(); rows.push({ hangMucGiaCongId: '', donGia: '' }); renderRows(); });
    modal.querySelector('#dggNew').addEventListener('click', async () => {
      const ten = prompt('Tên hạng mục gia công mới:'); if (!ten || !ten.trim()) return;
      try { const r = await apiPost('/api/tailieukythuat/dongiagiacong-hangmuc', { tenHangMuc: ten.trim() }); catalog.push(r.data); sync(); rows.push({ hangMucGiaCongId: r.data.HangMucGiaCongID, donGia: r.data.DonGiaMacDinh || '' }); renderRows(); toast('Đã thêm hạng mục.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    });
    modal.querySelector('#btnPrintDgg').addEventListener('click', () => { sync(); const nameOf = id => (catalog.find(c => String(c.HangMucGiaCongID) === String(id)) || {}).TenHangMuc || ''; printHtml('Đơn giá giao gia công - ' + maDH, `<h2>ĐƠN GIÁ GIAO GIA CÔNG</h2><p><b>Mã ĐH:</b> ${escapeHtml(maDH)}</p><table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4"><thead><tr><th style="width:38px;">STT</th><th>Hạng mục gia công</th><th>Đơn giá</th></tr></thead><tbody>${rows.filter(r => r.hangMucGiaCongId).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(nameOf(r.hangMucGiaCongId))}</td><td style="text-align:right;">${fmtNumber(r.donGia)}</td></tr>`).join('')}</tbody></table>`); });
    modal.querySelector('#dggForm').addEventListener('submit', async (e) => {
      e.preventDefault(); if (!perm.canEdit) return; sync();
      const items = rows.filter(r => r.hangMucGiaCongId).map(r => ({ hangMucGiaCongId: r.hangMucGiaCongId, donGia: r.donGia || 0 }));
      const ten = (modal.querySelector('[name="tenBan"]').value || '').trim();
      try {
        await apiPost('/api/tailieukythuat/dongiagiacong/' + maDH, { items, ten, oldTen: tenPhieu });
        closeModal(); toast('Đã lưu đơn giá giao gia công.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.38: "Đơn giá là/đóng gói" — 2 đơn giá theo đơn (LÀ + ĐÓNG GÓI) dùng tính lương là/đóng gói.
  async function openDonGiaLaDongGoiEditor(maDH, tenPhieu, onDone) {
    tenPhieu = tenPhieu || '';
    const res = await apiGet('/api/tailieukythuat/dongialadonggoi/' + maDH + '?ten=' + encodeURIComponent(tenPhieu));
    const d = res.data || {};
    const modal = openModal(`<h3>Đơn giá là / đóng gói — ${escapeHtml(maDH)}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}${orderInfoSuffix(res.order)}</h3>
      <form id="dgldForm">
        ${tenBanRowHtml(tenPhieu)}
        <div class="form-row"><label>Đơn giá LÀ (ủi) / cái</label><input type="number" step="0.01" min="0" name="la" value="${d.la != null ? d.la : ''}" ${perm.canEdit ? '' : 'disabled'}></div>
        <div class="form-row"><label>Đơn giá ĐÓNG GÓI / cái</label><input type="number" step="0.01" min="0" name="dg" value="${d.dg != null ? d.dg : ''}" ${perm.canEdit ? '' : 'disabled'}></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancelDgld">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu</button>' : ''}</div>
      </form>`);
    modal.querySelector('#btnCancelDgld').addEventListener('click', closeModal);
    modal.querySelector('#dgldForm').addEventListener('submit', async (e) => {
      e.preventDefault(); if (!perm.canEdit) return;
      const fd = new FormData(e.target);
      try {
        await apiPost('/api/tailieukythuat/dongialadonggoi/' + maDH, { la: fd.get('la'), dg: fd.get('dg'), ten: (fd.get('tenBan') || '').trim(), oldTen: tenPhieu });
        closeModal(); toast('Đã lưu đơn giá là/đóng gói.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.34c (mục 7): "Đơn giá in thêu" — nhiều dòng Tên (tự do) + Đơn giá. Lưu = ghi đè toàn bộ.
  async function openDonGiaInTheEditor(maDH, tenPhieu, onDone) {
    tenPhieu = tenPhieu || '';
    const res = await apiGet('/api/tailieukythuat/dongiainthe/' + maDH + '?ten=' + encodeURIComponent(tenPhieu));
    // v5.87: mỗi dòng có thêm ẢNH MINH HỌA (lưu đường dẫn /uploads/..., xem migration_v660).
    let rows = (res.data || []).map(r => ({ ten: r.Ten || '', donGia: r.DonGia != null ? r.DonGia : '', anhMinhHoa: r.AnhMinhHoa || '' }));
    if (!rows.length) rows = [{ ten: '', donGia: '', anhMinhHoa: '' }];
    const modal = openModal(`<h3>Đơn giá in thêu — ${escapeHtml(maDH)}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}${orderInfoSuffix(res.order)}</h3>
      <form id="dgitForm">${tenBanRowHtml(tenPhieu)}<div id="dgitBox"></div>
        <div class="toolbar" style="margin-top:6px;"><button type="button" class="btn small secondary" id="dgitAddRow">+ Thêm dòng</button></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnPrintDgit">🖨️ In</button>
          <button type="button" class="btn secondary" id="btnCancelDgit">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>
          ${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu</button>' : ''}
        </div></form>`);
    modal.querySelector('#btnCancelDgit').addEventListener('click', closeModal);
    const box = modal.querySelector('#dgitBox');
    function sync() { box.querySelectorAll('[data-dgitrow]').forEach(el => { const r = rows[Number(el.dataset.i)]; if (!r) return; r.ten = el.querySelector('.dgit-ten').value; r.donGia = el.querySelector('.dgit-gia').value; }); }
    function renderRows() {
      /* v5.87: cột ẢNH cho từng dòng — chọn file (hoặc chụp thẳng bằng camera trên điện thoại nhờ
         thuộc tính capture) -> tải lên ngay, chỉ lưu đường dẫn. Bấm vào ảnh để xem to ở tab mới. */
      box.innerHTML = `<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;">
        <thead><tr><th style="width:38px;">STT</th><th>Tên hạng mục in/thêu</th><th>Đơn giá</th><th style="width:150px;">Ảnh</th><th></th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr data-dgitrow data-i="${i}"><td style="text-align:center;">${i + 1}</td>
          <td><input type="text" class="dgit-ten" value="${escapeHtml(r.ten)}" style="width:100%;min-width:240px;"></td>
          <td><input type="number" step="0.01" min="0" class="dgit-gia" value="${r.donGia}" style="width:120px;"></td>
          <td>
            ${r.anhMinhHoa ? `<a href="${escapeHtml(r.anhMinhHoa)}" target="_blank" title="Bấm để xem ảnh to"><img src="${escapeHtml(r.anhMinhHoa)}" style="width:64px;height:64px;object-fit:cover;border-radius:4px;display:block;margin-bottom:4px;"></a>` : '<div class="empty-hint" style="padding:0 0 4px;">Chưa có ảnh</div>'}
            ${perm.canEdit ? `<input type="file" accept="image/*" capture="environment" class="dgit-file" data-i="${i}" style="font-size:11px;max-width:140px;">
            ${r.anhMinhHoa ? `<button type="button" class="btn small danger dgit-xoaanh" data-i="${i}" style="margin-top:3px;">Xóa ảnh</button>` : ''}` : ''}
          </td>
          <td><button type="button" class="btn small danger dgit-del" data-i="${i}">X</button></td></tr>`).join('')}</tbody></table>`;
      box.querySelectorAll('.dgit-del').forEach(b => b.addEventListener('click', () => { sync(); rows.splice(Number(b.dataset.i), 1); if (!rows.length) rows.push({ ten: '', donGia: '', anhMinhHoa: '' }); renderRows(); }));
      box.querySelectorAll('.dgit-xoaanh').forEach(b => b.addEventListener('click', () => { sync(); rows[Number(b.dataset.i)].anhMinhHoa = ''; renderRows(); }));
      box.querySelectorAll('.dgit-file').forEach(inp => inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        try {
          const url = await uploadFile(f, 'dongiainthe');
          sync();                                   // giữ chữ đang gõ ở các dòng trước khi vẽ lại
          rows[Number(inp.dataset.i)].anhMinhHoa = url;
          renderRows();
        } catch (err) { toast(err.message, 'error'); }
      }));
    }
    renderRows();
    modal.querySelector('#dgitAddRow').addEventListener('click', () => { sync(); rows.push({ ten: '', donGia: '', anhMinhHoa: '' }); renderRows(); });
    modal.querySelector('#btnPrintDgit').addEventListener('click', () => { sync(); printHtml('Đơn giá in thêu - ' + maDH, `<h2>ĐƠN GIÁ IN THÊU</h2><p><b>Mã ĐH:</b> ${escapeHtml(maDH)}</p><table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4"><thead><tr><th style="width:38px;">STT</th><th>Tên hạng mục in/thêu</th><th>Đơn giá</th><th style="width:120px;">Ảnh</th></tr></thead><tbody>${rows.filter(r => (r.ten || '').trim()).map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.ten)}</td><td style="text-align:right;">${fmtNumber(r.donGia)}</td><td style="text-align:center;">${r.anhMinhHoa ? `<img src="${escapeHtml(r.anhMinhHoa)}" style="max-width:110px;max-height:110px;object-fit:contain;">` : ''}</td></tr>`).join('')}</tbody></table>`); });
    modal.querySelector('#dgitForm').addEventListener('submit', async (e) => {
      e.preventDefault(); if (!perm.canEdit) return; sync();
      const tenBan = (modal.querySelector('[name="tenBan"]').value || '').trim();
      try {
        // LƯU Ý: r.ten = tên DÒNG (hạng mục), tenPhieu = tên BẢN → backend nhận qua 'tenPhieu' để không trùng khóa.
        await apiPost('/api/tailieukythuat/dongiainthe/' + maDH, { rows: rows.filter(r => (r.ten || '').trim()), tenPhieu: tenBan, oldTen: tenPhieu });
        closeModal(); toast('Đã lưu đơn giá in thêu.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     3. CHI DINH NPL - dung lai NGUYEN VEN /api/qlsx/orders/:maDH/phukien (GET/POST/DELETE), gate quyen
     theo permTiendo (KHONG phai perm) vi day la route cu cua Ghi nhan tien do.
     ================================================================================================ */
  // v5.54: 1 đơn có NHIỀU bản chỉ định NPL — danh sách bản + Thêm/Mở/Xóa từng bản.
  async function openNplBanList(maDH) {
    let orderInfo = null;
    try { const list = (await apiGet('/api/tailieukythuat/orders?loai=chidinhnpl')).data || []; orderInfo = list.find(o => o.MaDH === maDH) || null; } catch (e) { }
    const phieu = (await apiGet(`/api/qlsx/orders/${encodeURIComponent(maDH)}/phukien-phieu`)).data || [];
    const rowsHtml = (phieu.length ? phieu : []).map(p => `<tr>
        <td>${p.TenPhieu ? escapeHtml(p.TenPhieu) : '<i>(không tên)</i>'}</td>
        <td style="text-align:center;">${p.SoDong}</td>
        <td>
          <button class="btn small secondary nplb-open" data-ten="${escapeHtml(p.TenPhieu)}">Mở / Sửa</button>
          ${permNpl.canEdit ? `<button class="btn small danger nplb-del" data-ten="${escapeHtml(p.TenPhieu)}">Xóa bản</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="3" class="empty-hint">Chưa có bản chỉ định NPL nào</td></tr>';
    const modal = openModal(`
      <h3>Chỉ định NPL — ${escapeHtml(maDH)}${orderInfo ? ` (${escapeHtml(orderInfo.TenSanPham || '')})` : ''}${orderInfo && orderInfo.MaRap ? ' · Mã rập: ' + escapeHtml(orderInfo.MaRap) : ''}</h3>
      <p class="empty-hint">1 đơn có thể có NHIỀU bản chỉ định NPL — đặt tên để phân biệt (vd Áo / Quần / Đợt 1).</p>
      ${/* v5.84: trạng thái xuất kho phụ kiện của đơn (cùng số liệu với cột ở danh sách) */''}
      ${orderInfo ? `<p class="p-meta"><b>Xuất kho phụ kiện:</b> ${trangThaiXuatPKHtml(orderInfo)}</p>` : ''}
      <table><thead><tr><th>Tên bản</th><th>Số dòng</th><th style="width:210px">Thao tác</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="nplbClose">Đóng</button>
        ${/* v5.83: xuất kho phụ kiện ngay từ đây (chỉ khi đã có ít nhất 1 bản chỉ định NPL) */''}
        ${(phieu.length && coQuyenXuatPhuKien()) ? '<button type="button" class="btn secondary" id="nplbXuat">📦 Xuất kho theo chỉ định</button>' : ''}
        ${permNpl.canEdit ? '<button type="button" class="btn" id="nplbAdd">+ Thêm chỉ định NPL</button>' : ''}
      </div>`);
    modal.querySelector('#nplbClose').addEventListener('click', closeModal);
    const nplXuatBtn = modal.querySelector('#nplbXuat');
    if (nplXuatBtn) nplXuatBtn.addEventListener('click', () => xuatKhoPhuKienTheoChiDinh(maDH));
    // v5.85: badge trạng thái trong modal cũng bấm được để xem các phiếu đã xuất.
    modal.querySelectorAll('.tlkt-xem-px').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); xemPhieuXuatPKCuaDon(a.dataset.donid, a.dataset.madh); }));
    const addBtn = modal.querySelector('#nplbAdd');
    if (addBtn) addBtn.addEventListener('click', () => {
      const ten = (prompt('Tên bản chỉ định NPL (vd Áo / Quần / Đợt 1; để trống nếu chỉ 1 bản):', '') || '').trim();
      openChiDinhNplModal(maDH, ten, orderInfo, () => openNplBanList(maDH));
    });
    modal.querySelectorAll('.nplb-open').forEach(b => b.addEventListener('click', () => openChiDinhNplModal(maDH, b.dataset.ten, orderInfo, () => openNplBanList(maDH))));
    modal.querySelectorAll('.nplb-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa toàn bộ bản chỉ định NPL này?')) return;
      try { await apiDelete(`/api/qlsx/orders/${encodeURIComponent(maDH)}/phukien-phieu?ten=${encodeURIComponent(b.dataset.ten)}`); toast('Đã xóa bản.', 'success'); openNplBanList(maDH); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }
  async function openChiDinhNplModal(maDH, tenPhieu, orderInfoIn, onClose) {
    tenPhieu = tenPhieu || '';
    let orderInfo = orderInfoIn || null;
    if (!orderInfo) {
      try {
        const list = (await apiGet('/api/tailieukythuat/orders?loai=chidinhnpl')).data || [];
        orderInfo = list.find(o => o.MaDH === maDH) || null;
      } catch (e) { /* bo qua - khong chan mo modal chi vi thieu thong tin trang tri */ }
    }
    const [dm, phuKienListRaw] = await Promise.all([
      getDm(),
      apiGet(`/api/qlsx/orders/${maDH}/phukien?ten=${encodeURIComponent(tenPhieu)}`).then(r => r.data)
    ]);
    let phuKienList = phuKienListRaw || [];
    const html = `
      <h3>Chỉ định NPL — ${escapeHtml(maDH)}${orderInfo ? ` (${escapeHtml(orderInfo.MaSanPham || '')} - ${escapeHtml(orderInfo.TenSanPham || '')})` : ''}${orderInfo && orderInfo.MaRap ? ' · Mã rập: ' + escapeHtml(orderInfo.MaRap) : ''}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}</h3>
      <div id="cdnplBox"></div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnCdnplPrint">🖨️ In</button>
        <button type="button" class="btn secondary" id="btnCdnplClose">Đóng</button>
      </div>`;
    const modal = openModal(html);
    modal.querySelector('#btnCdnplClose').addEventListener('click', () => { if (onClose) onClose(); else closeModal(); });
    modal.querySelector('#btnCdnplPrint').addEventListener('click', () => printChiDinhNpl(phuKienList, maDH, orderInfo));

    let addRowIdx = 0;
    function existingRowsHtml() {
      // v5.88: + cột Ảnh phụ kiện (bấm xem to).
      return phuKienList.map(p => `<tr data-id="${p.ID}">
        <td>${p.AnhDaiDien ? `<a href="${escapeHtml(p.AnhDaiDien)}" target="_blank"><img src="${escapeHtml(p.AnhDaiDien)}" style="width:42px;height:42px;object-fit:cover;border-radius:4px;"></a>` : ''}</td>
        <td>${escapeHtml(p.MaPhuKien)}</td><td>${escapeHtml(p.TenPhuKien)}</td><td>${fmtNumber(p.SoLuong)}</td>
        <td>${escapeHtml(p.DonVi || p.DonViGoc || '')}</td><td>${escapeHtml(p.GhiChu || '')}</td>
        <td>${permNpl.canEdit ? `<button type="button" class="btn small danger cdnpl-del" data-id="${p.ID}">Xóa</button>` : ''}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty-hint">Chưa chỉ định NPL nào</td></tr>';
    }
    function addRowHtml() {
      const idx = ++addRowIdx;
      return `<div class="form-grid" style="grid-template-columns:1fr 2fr .8fr .8fr 1.3fr auto;gap:8px;align-items:end;margin-bottom:8px;" data-addrow data-idx="${idx}">
        <div><label>Loại PK</label><select class="cdnpl-loai">
          <option value="">-- Tất cả loại --</option>
          ${(dm.loaiPhuKien || []).map(l => `<option value="${escapeHtml(l.TenLoai)}">${escapeHtml(l.TenLoai)}</option>`).join('')}
        </select></div>
        <div><label>Phụ kiện (gõ để tìm)</label>${searchableSelectHtml('cdnpla_' + idx, dm.phuKien, 'PhuKienID', p => `${p.MaPhuKien} — ${p.TenPhuKien}`)}</div>
        <div><label>SL</label><input type="number" min="0" class="cdnpl-sl"></div>
        ${/* v5.87: ĐVT = ô GÕ TỰ DO + danh sách gợi ý (datalist). Trước đây là <select> chỉ có đúng 2
             đơn vị của phụ kiện được chọn -> không gõ được đơn vị khác. Nay bấm vào ô là ra danh sách
             mọi đơn vị đang dùng trong danh mục phụ kiện, gõ ký tự bất kỳ để lọc, và vẫn nhập được
             đơn vị hoàn toàn mới. Chọn phụ kiện xong hệ thống tự điền ĐVT cơ bản làm mặc định. */''}
        <div><label>ĐVT (gõ hoặc chọn)</label><input class="cdnpl-donvi" list="dlDonViNpl" placeholder="Cái, Bộ, Mét..." autocomplete="off"></div>
        <div><label>Ghi chú</label><input class="cdnpl-ghichu"></div>
        <div><button type="button" class="btn small danger cdnpl-remove">X</button></div>
      </div>`;
    }
    // Danh sách gợi ý ĐVT: gom mọi ĐVT cơ bản + ĐVT quy đổi đang có trong danh mục phụ kiện, thêm vài
    // đơn vị thường dùng để lần đầu chưa có dữ liệu vẫn có cái để chọn.
    function danhSachDonViHtml() {
      /* v6.31: nguồn CHÍNH là Danh mục → Đơn vị tính (dm.donViTinh, đã có sẵn trong /api/qlsx/danhmuc).
         Vẫn gộp thêm đơn vị đang dùng ở danh mục phụ kiện để không mất lựa chọn nào của dữ liệu cũ. */
      const ds = new Set((dm.donViTinh || []).map(x => String(x.TenDonVi || '').trim()).filter(Boolean));
      (dm.phuKien || []).forEach(p => {
        if (p.DonViCoBan) ds.add(String(p.DonViCoBan).trim());
        if (p.DonViQuyDoi) ds.add(String(p.DonViQuyDoi).trim());
      });
      return `<datalist id="dlDonViNpl">${[...ds].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi')).map(v => `<option value="${escapeHtml(v)}">`).join('')}</datalist>`;
    }
    function fillDonViForRow(rowEl, item) {
      // Chỉ ĐIỀN MẶC ĐỊNH khi ô còn trống — không đè lên đơn vị người dùng đã tự gõ.
      const o = rowEl.querySelector('.cdnpl-donvi');
      if (!o) return;
      if (item && !String(o.value || '').trim()) o.value = item.DonViCoBan || '';
    }
    function renderBox() {
      const box = modal.querySelector('#cdnplBox');
      box.innerHTML = `
        <div class="form-row"><label>Đã chỉ định</label>
          <table><thead><tr><th style="width:52px">Ảnh</th><th>Mã PK</th><th>Tên phụ kiện</th><th>SL</th><th>ĐVT</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>${existingRowsHtml()}</tbody></table>
        </div>
        ${danhSachDonViHtml()}
        ${permNpl.canEdit ? `<div class="form-row"><label>Thêm phụ kiện</label>
          <div id="cdnplAddRows">${addRowHtml()}</div>
          <button type="button" class="btn small secondary" id="btnAddCdnplRow">+ Thêm dòng</button>
          <div style="margin-top:8px;"><button type="button" class="btn small" id="btnSaveCdnpl">💾 Lưu</button></div>
        </div>` : '<div class="empty-hint">Bạn không có quyền chỉnh sửa Chỉ định NPL (cần quyền Sửa ở chức năng "Chỉ định NPL").</div>'}`;
      wireBox(box);
    }
    function wireBox(box) {
      if (!permNpl.canEdit) return;
      function wireAddRow(rowEl) {
        const idx = rowEl.dataset.idx;
        function currentList() {
          const loaiVal = rowEl.querySelector('.cdnpl-loai').value;
          return loaiVal ? dm.phuKien.filter(p => p.TenLoai === loaiVal) : dm.phuKien;
        }
        // v5.88: tham số cuối = lấy ảnh phụ kiện -> danh sách xổ xuống hiện kèm ảnh.
        wireSearchableSelect('cdnpla_' + idx, currentList(), 'PhuKienID', p => `${p.MaPhuKien} — ${p.TenPhuKien}`, (match) => fillDonViForRow(rowEl, match), p => p.AnhDaiDien);
        rowEl.querySelector('.cdnpl-loai').addEventListener('change', () => {
          const textEl = document.getElementById('cdnpla_' + idx + '_text');
          const hiddenEl = document.getElementById('cdnpla_' + idx + '_val');
          if (textEl) textEl.value = '';
          if (hiddenEl) hiddenEl.value = '';
          fillDonViForRow(rowEl, null);
          // v5.88: tham số cuối = lấy ảnh phụ kiện -> danh sách xổ xuống hiện kèm ảnh.
        wireSearchableSelect('cdnpla_' + idx, currentList(), 'PhuKienID', p => `${p.MaPhuKien} — ${p.TenPhuKien}`, (match) => fillDonViForRow(rowEl, match), p => p.AnhDaiDien);
        });
        rowEl.querySelector('.cdnpl-remove').addEventListener('click', () => {
          if (box.querySelectorAll('#cdnplAddRows > [data-addrow]').length > 1) rowEl.remove();
        });
      }
      box.querySelectorAll('#cdnplAddRows > [data-addrow]').forEach(wireAddRow);
      box.querySelector('#btnAddCdnplRow').addEventListener('click', () => {
        box.querySelector('#cdnplAddRows').insertAdjacentHTML('beforeend', addRowHtml());
        wireAddRow(box.querySelector('#cdnplAddRows').lastElementChild);
      });
      box.querySelectorAll('.cdnpl-del').forEach(btn => btn.addEventListener('click', async () => {
        try {
          await apiDelete(`/api/qlsx/orders/${maDH}/phukien/${btn.dataset.id}`);
          phuKienList = phuKienList.filter(p => String(p.ID) !== String(btn.dataset.id));
          toast('Đã xóa.', 'success'); renderBox();
        } catch (err) { toast(err.message, 'error'); }
      }));
      box.querySelector('#btnSaveCdnpl').addEventListener('click', async () => {
        const rows = Array.from(box.querySelectorAll('#cdnplAddRows > [data-addrow]')).map(r => ({
          phuKienId: getSearchableValue('cdnpla_' + r.dataset.idx),
          soLuong: r.querySelector('.cdnpl-sl').value || 0,
          donVi: r.querySelector('.cdnpl-donvi').value,
          ghiChu: r.querySelector('.cdnpl-ghichu').value
        })).filter(p => p.phuKienId);
        if (!rows.length) { toast('Vui lòng chọn ít nhất 1 phụ kiện.', 'error'); return; }
        try {
          await apiPost(`/api/qlsx/orders/${maDH}/phukien`, { rows, tenPhieu });
          const fresh = await apiGet(`/api/qlsx/orders/${maDH}/phukien?ten=${encodeURIComponent(tenPhieu)}`);
          phuKienList = fresh.data || [];
          toast('Đã lưu.', 'success'); renderBox();
        } catch (err) { toast(err.message, 'error'); }
      });
    }
    renderBox();
  }

  /* ================================================================================================
     4. MO TA SAN PHAM - luoi o "Khoang trong" dan/chon anh + chu thich, them/xoa dong VA cot duoc.
     ================================================================================================ */
  function buildGridFromOGrid(oGrid) {
    let maxDong = -1, maxCot = -1;
    (oGrid || []).forEach(o => { if (o.dong > maxDong) maxDong = o.dong; if (o.cot > maxCot) maxCot = o.cot; });
    const numRows = Math.max(maxDong + 1, 1), numCols = Math.max(maxCot + 1, 1);
    const grid = Array.from({ length: numRows }, () => Array.from({ length: numCols }, () => ({ anhUrl: null, chuThich: '' })));
    (oGrid || []).forEach(o => { grid[o.dong][o.cot] = { anhUrl: o.anhUrl, chuThich: o.chuThich || '' }; });
    return { numCols, grid };
  }

  function flattenGrid(state) {
    const out = [];
    state.grid.forEach((row, ri) => row.forEach((cell, ci) => {
      if (cell && (cell.anhUrl || cell.chuThich)) out.push({ dong: ri, cot: ci, anhUrl: cell.anhUrl || null, chuThich: cell.chuThich || null });
    }));
    return out;
  }

  function ocellHtml(cell, ri, ci) {
    const has = cell && cell.anhUrl;
    return `<div class="tlkt-ocell" tabindex="0" data-row="${ri}" data-col="${ci}">
      ${has ? `<img src="${escapeHtml(cell.anhUrl)}">` : `<div class="tlkt-ocell-placeholder">Khoảng trống<br>${perm.canEdit ? 'Dán ảnh (Ctrl+V) hoặc bấm "Chọn file"' : ''}</div>`}
      ${perm.canEdit ? `<input type="file" accept="image/*" class="og-file" style="display:none;">
      <div class="tlkt-ocell-actions">
        <button type="button" class="btn small secondary og-pick">${has ? 'Đổi ảnh' : 'Chọn file'}</button>
        ${has ? '<button type="button" class="btn small danger og-clear">Xóa ảnh</button>' : ''}
      </div>
      <textarea class="tlkt-grid-input og-caption" style="margin-top:6px;" rows="2" placeholder="Chú thích...">${escapeHtml((cell && cell.chuThich) || '')}</textarea>` : (cell && cell.chuThich ? `<div style="margin-top:6px;font-size:12px;white-space:pre-wrap;">${escapeHtml(cell.chuThich)}</div>` : '')}
    </div>`;
  }

  function oGridHtml(state) {
    const numCols = state.numCols;
    return `<table>
      <thead><tr>
        <th style="width:50px;">#</th>
        ${Array.from({ length: numCols }).map((_, ci) => `<th data-col="${ci}">Cột ${ci + 1}${perm.canEdit ? '<button type="button" class="btn small danger og-del-col" style="display:block;margin:4px auto 0;width:100%;">Xóa cột</button>' : ''}</th>`).join('')}
        ${perm.canEdit ? `<th style="width:70px;"><button type="button" class="btn small secondary" id="btnOgAddCol">+ Cột</button></th>` : ''}
      </tr></thead>
      <tbody>
        ${state.grid.map((row, ri) => `<tr data-row="${ri}">
          <td style="text-align:center;">${ri + 1}${perm.canEdit ? '<br><button type="button" class="btn small danger og-del-row" style="margin-top:4px;">Xóa</button>' : ''}</td>
          ${row.map((cell, ci) => `<td>${ocellHtml(cell, ri, ci)}</td>`).join('')}
        </tr>`).join('')}
      </tbody>
    </table>
    ${perm.canEdit ? `<div style="margin-top:8px;"><button type="button" class="btn small secondary" id="btnOgAddRow">+ Thêm dòng</button></div>` : ''}`;
  }

  function syncOGridFromDom(box, state) {
    box.querySelectorAll('.tlkt-ocell').forEach(cellEl => {
      const ri = Number(cellEl.dataset.row), ci = Number(cellEl.dataset.col);
      const capEl = cellEl.querySelector('.og-caption');
      if (!capEl || !state.grid[ri] || !state.grid[ri][ci]) return;
      state.grid[ri][ci].chuThich = capEl.value;
    });
  }

  function renderOGridBox(box, state) {
    box.innerHTML = oGridHtml(state);
    wireOGridBox(box, state);
  }

  function wireOGridBox(box, state) {
    const btnAddCol = box.querySelector('#btnOgAddCol');
    if (btnAddCol) btnAddCol.addEventListener('click', () => {
      syncOGridFromDom(box, state);
      state.numCols++;
      state.grid.forEach(row => row.push({ anhUrl: null, chuThich: '' }));
      renderOGridBox(box, state);
    });
    const btnAddRow = box.querySelector('#btnOgAddRow');
    if (btnAddRow) btnAddRow.addEventListener('click', () => {
      syncOGridFromDom(box, state);
      state.grid.push(Array.from({ length: state.numCols }, () => ({ anhUrl: null, chuThich: '' })));
      renderOGridBox(box, state);
    });
    box.querySelectorAll('.og-del-col').forEach(btn => btn.addEventListener('click', () => {
      syncOGridFromDom(box, state);
      const ci = Number(btn.closest('[data-col]').dataset.col);
      state.numCols--;
      state.grid.forEach(row => row.splice(ci, 1));
      renderOGridBox(box, state);
    }));
    box.querySelectorAll('.og-del-row').forEach(btn => btn.addEventListener('click', () => {
      syncOGridFromDom(box, state);
      state.grid.splice(Number(btn.closest('[data-row]').dataset.row), 1);
      renderOGridBox(box, state);
    }));
    if (!perm.canEdit) return;
    box.querySelectorAll('.tlkt-ocell').forEach(cellEl => {
      const ri = Number(cellEl.dataset.row), ci = Number(cellEl.dataset.col);
      const fileInput = cellEl.querySelector('.og-file');
      cellEl.querySelector('.og-pick').addEventListener('click', () => fileInput.click());
      const clearBtn = cellEl.querySelector('.og-clear');
      if (clearBtn) clearBtn.addEventListener('click', () => {
        syncOGridFromDom(box, state);
        state.grid[ri][ci].anhUrl = null;
        renderOGridBox(box, state);
      });
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (file) await handleCellImage(box, state, ri, ci, file);
      });
      // v5.14: dan anh Ctrl+V - tinh nang MOI, khong co tien le trong he thong. Nghe truc tiep tren tung
      // o (tabindex="0" de nhan duoc focus/paste) - don gian hon dung 1 "active cell" toan cuc.
      cellEl.addEventListener('paste', async (e) => {
        const items = (e.clipboardData && e.clipboardData.items) || [];
        const imgItem = Array.from(items).find(it => it.type && it.type.indexOf('image/') === 0);
        if (!imgItem) return;
        e.preventDefault();
        const file = imgItem.getAsFile();
        if (file) await handleCellImage(box, state, ri, ci, file);
      });
    });
  }

  async function handleCellImage(box, state, ri, ci, file) {
    try {
      const url = await uploadFile(file, 'motasp');
      syncOGridFromDom(box, state);
      state.grid[ri][ci].anhUrl = url;
      renderOGridBox(box, state);
      toast('Đã tải ảnh lên.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function openMoTaSanPhamEditor(maDH, loai = 'motasp', label = 'Mô tả sản phẩm', tenPhieu, onDone) {
    tenPhieu = tenPhieu || '';
    const qs = '?loai=' + encodeURIComponent(loai);   // v5.34c: dung chung cho motasp | quycach | hinhanhinthue
    const res = await apiGet(`/api/tailieukythuat/motasp/${maDH}${qs}&ten=${encodeURIComponent(tenPhieu)}`);   // v5.56: theo BẢN
    const data = res.data, order = res.order;
    const state = (data && data.oGrid) ? buildGridFromOGrid(data.oGrid) : { numCols: 1, grid: [[{ anhUrl: null, chuThich: '' }]] };
    const motaMauList = (await apiGet('/api/tailieukythuat/motasp-mau' + qs).catch(() => ({ data: [] }))).data || [];   // v5.34e (mẫu theo loai; v5.56 lỗi không chặn mở form)
    const html = `
      <h3>${escapeHtml(label)} — ${escapeHtml(maDH)}${tenPhieu ? ' · Bản: ' + escapeHtml(tenPhieu) : ''}</h3>
      <form id="motaspForm">
        ${tlktHeaderFieldsHtml(data, order, tenPhieu)}
        ${perm.canEdit && motaMauList.length ? `<div class="form-row"><label>Áp mẫu (THAY THẾ lưới ảnh bên dưới)</label><div style="display:flex;gap:8px;"><select id="motaMauSelect" style="flex:1;"><option value="">-- Chọn mẫu --</option>${motaMauList.map(m => `<option value="${m.ID}">${escapeHtml(m.TenMau)}</option>`).join('')}</select><button type="button" class="btn secondary" id="btnApMotaMau">Tải mẫu này</button></div></div>` : ''}
        <div class="form-row"><label>Ảnh mô tả ${perm.canEdit ? '(dán ảnh Ctrl+V vào từng ô, hoặc bấm "Chọn file" — có thể thêm dòng/cột)' : ''}</label>
          <div id="motaspGridBox"></div>
        </div>
        <div class="form-row"><label>Chú ý</label><textarea name="chuY" rows="3" ${perm.canEdit ? '' : 'disabled'}>${escapeHtml((data && data.chuY) || '')}</textarea></div>
        <div class="modal-actions">
          ${perm.canDelete && data ? '<button type="button" class="btn danger" id="btnDeleteDoc">Xóa tài liệu</button>' : ''}
          ${perm.canEdit ? '<button type="button" class="btn secondary" id="btnLuuMotaMau">Lưu thành mẫu</button><button type="button" class="btn secondary" id="btnQlMotaMau">Quản lý mẫu</button>' : ''}
          <button type="button" class="btn secondary" id="btnPrintDoc">🖨️ In</button>
          <button type="button" class="btn secondary" id="btnCancel">${perm.canEdit ? 'Hủy' : 'Đóng'}</button>
          ${perm.canEdit ? '<button type="submit" class="btn">💾 Lưu</button>' : ''}
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    const gridBox = modal.querySelector('#motaspGridBox');
    renderOGridBox(gridBox, state);
    // v5.34e: áp mẫu / lưu thành mẫu / quản lý mẫu (theo loai).
    const btnApMotaMau = modal.querySelector('#btnApMotaMau');
    if (btnApMotaMau) btnApMotaMau.addEventListener('click', async () => {
      const id = modal.querySelector('#motaMauSelect').value;
      if (!id) { toast('Vui lòng chọn 1 mẫu.', 'error'); return; }
      if (!confirm('Áp mẫu sẽ THAY THẾ lưới ảnh đang soạn. Tiếp tục?')) return;
      try { const m = (await apiGet('/api/tailieukythuat/motasp-mau/' + id)).data; const ns = buildGridFromOGrid(m.oGrid || []); state.numCols = ns.numCols; state.grid = ns.grid; renderOGridBox(gridBox, state); toast('Đã áp mẫu.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    });
    const btnLuuMotaMau = modal.querySelector('#btnLuuMotaMau');
    if (btnLuuMotaMau) btnLuuMotaMau.addEventListener('click', async () => {
      syncOGridFromDom(gridBox, state); const ten = prompt('Tên mẫu:'); if (!ten || !ten.trim()) return;
      try { await apiPost('/api/tailieukythuat/motasp-mau' + qs, { tenMau: ten.trim(), oGrid: flattenGrid(state) }); toast('Đã lưu mẫu.', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    });
    const btnQlMotaMau = modal.querySelector('#btnQlMotaMau');
    if (btnQlMotaMau) btnQlMotaMau.addEventListener('click', () => openDocMauManager('/api/tailieukythuat/motasp-mau' + qs, '/api/tailieukythuat/motasp-mau', label));
    modal.querySelector('#btnPrintDoc').addEventListener('click', () => {
      syncOGridFromDom(gridBox, state);
      const fd = new FormData(modal.querySelector('#motaspForm'));
      printMoTaSanPham({ maHang: fd.get('maHang'), dienGiai: fd.get('dienGiai'), ngayCapNhat: fd.get('ngayCapNhat'), nguoiLap: (data && data.nguoiLap) || (currentUser && currentUser.hoTen), chuY: fd.get('chuY'), oGrid: flattenGrid(state), maRap: (order && order.MaRap) || '', tenBan: (fd.get('tenBan') || '').trim() }, maDH, label);   // v5.57 +Mã rập
    });
    const btnDelete = modal.querySelector('#btnDeleteDoc');
    if (btnDelete) btnDelete.addEventListener('click', async () => {
      if (!confirm('Xóa bản tài liệu này?')) return;
      try {
        await apiDelete(`/api/tailieukythuat/motasp/${maDH}${qs}&ten=${encodeURIComponent(tenPhieu)}`);
        closeModal(); toast('Đã xóa.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
    modal.querySelector('#motaspForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!perm.canEdit) return;
      syncOGridFromDom(gridBox, state);
      const fd = new FormData(e.target);
      try {
        await apiPost(`/api/tailieukythuat/motasp/${maDH}${qs}`, {
          maHang: fd.get('maHang'), dienGiai: fd.get('dienGiai'), ngayCapNhat: fd.get('ngayCapNhat'), chuY: fd.get('chuY'), oGrid: flattenGrid(state),
          ten: fd.get('tenBan') || '', oldTen: tenPhieu   // v5.56
        });
        closeModal(); toast('Đã lưu tài liệu.', 'success');
        if (onDone) onDone(); else renderOrderList();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     IN AN - moi loai tai lieu 1 ham "build...BodyHtml" (chi tra ve doan HTML noi dung) + 1 ham
     "printXxx" mong goi printHtml() voi tieu de "<MaDH> - <ten tai lieu>" (de trinh duyet goi y dung
     ten file khi luu PDF - yeu cau v5.14). Tach rieng phan build noi dung de dung lai duoc cho CA in-
     tung-loai LAN in-gop-tat-ca (xem printOrderDocs() - yeu cau tiep theo "in tất cả hoặc từng loại",
     goi tu nut moi tren Danh sach lenh san xuat trong module.qlsx.js).
     ================================================================================================ */
  // v5.57: 2 dòng thông tin chung DÙNG CHUNG cho mọi bản in tài liệu — có Mã rập + Tên bản (nếu có).
  // data.maRap / data.tenBan do nơi gọi truyền vào (lấy từ res.order.MaRap của API).
  function docInfoRowsHtml(data) {
    return `
      <tr><td style="width:50%;"><b>Mã hàng:</b> ${escapeHtml(data.maHang || '')}</td><td><b>Ngày cập nhật:</b> ${fmtDate(data.ngayCapNhat)}</td></tr>
      <tr><td><b>Mã rập:</b> ${escapeHtml(data.maRap || '')}</td><td><b>Người lập:</b> ${escapeHtml(data.nguoiLap || '')}</td></tr>
      <tr><td colspan="2"><b>Diễn giải:</b> ${escapeHtml(data.dienGiai || '')}${data.tenBan ? ' &nbsp;·&nbsp; <b>Bản:</b> ' + escapeHtml(data.tenBan) : ''}</td></tr>`;
  }
  function buildTaiLieuChungBodyHtml(data) {
    const bodyRows = (data.muc || []).map((m, i) => `
      <tr><td style="text-align:center;width:36px;vertical-align:top;"><b>${i + 1}</b></td>
        <td><b>${escapeHtml(m.tieuDe || '').replace(/\n/g, '<br>')}</b>${(m.dong || []).length ? '<br>' + m.dong.map(d => escapeHtml(d.noiDung || '').replace(/\n/g, '<br>')).join('<br>') : ''}</td></tr>`).join('')
      || '<tr><td colspan="2" style="text-align:center;">Chưa có nội dung</td></tr>';
    return `
      <h2 style="text-align:center;">TIÊU CHUẨN KỸ THUẬT</h2>
      <table style="margin-top:10px;">
        ${docInfoRowsHtml(data)}
      </table>
      <table style="margin-top:10px;">${bodyRows}</table>`;
  }
  function printTaiLieuChung(data, maDH) { printHtml(`${maDH} - Tài liệu kỹ thuật chung`, buildTaiLieuChungBodyHtml(data)); }

  // v5.58: BẢN IN theo đúng biểu mẫu khách gửi (thongsodo.xls):
  //   Tiêu đề "THÔNG SỐ KĨ THUẬT" -> "1. BẢNG THÔNG SỐ <ngày>" -> bảng
  //   TT | THÔNG SỐ | VỊ TRÍ ĐO | <các size> | dung sai (+/-) | Ghi chú (1 ô GỘP toàn bảng, chứa
  //   YÊU CẦU KỸ THUẬT + ảnh minh hoạ).
  function buildThongSoDoBodyHtml(data) {
    const cols = data.cols || [];
    const rows = data.rows || [];
    const yc = (data.yeuCauKyThuat || '').trim();
    const anh = Array.isArray(data.anhGhiChu) ? data.anhGhiChu : [];
    const ghiChuCell = `
      ${yc ? `<div style="font-weight:700;">YÊU CẦU KỸ THUẬT</div><div style="white-space:pre-wrap;">${escapeHtml(yc)}</div>` : ''}
      ${anh.length ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${anh.map(u => `<img src="${escapeHtml(u)}" style="width:78px;height:78px;object-fit:contain;">`).join('')}</div>` : ''}`;
    const nRows = rows.length || 1;
    const bodyRows = rows.length
      ? rows.map((r, i) => `<tr>
          <td style="text-align:center;">${i + 1}</td>
          <td><b>${escapeHtml(r.tenDong || '')}</b></td>
          <td>${escapeHtml(r.viTriDo || '')}</td>
          ${cols.map((c, ci) => `<td style="text-align:center;">${escapeHtml((r.values && r.values[ci] != null) ? r.values[ci] : '')}</td>`).join('')}
          <td style="text-align:center;font-style:italic;">${escapeHtml(r.dungSai || '')}</td>
          ${i === 0 ? `<td rowspan="${nRows}" style="vertical-align:top;min-width:230px;font-size:12px;">${ghiChuCell}</td>` : ''}
        </tr>`).join('')
      : `<tr><td colspan="${cols.length + 4}" style="text-align:center;">Chưa có dữ liệu</td></tr>
         <tr><td colspan="${cols.length + 4}"></td><td style="vertical-align:top;font-size:12px;">${ghiChuCell}</td></tr>`;
    return `
      <h2 style="text-align:center;">THÔNG SỐ KĨ THUẬT</h2>
      <table style="margin-top:10px;">
        ${docInfoRowsHtml(data)}
      </table>
      <div style="margin-top:10px;font-weight:700;">1. BẢNG THÔNG SỐ${data.ngayCapNhat ? '  ' + fmtDate(data.ngayCapNhat) : ''}</div>
      <table style="margin-top:6px;width:100%;border-collapse:collapse;" border="1" cellpadding="4">
        <thead>
          <tr>
            <th style="width:34px;">TT</th><th>THÔNG SỐ</th><th>VỊ TRÍ ĐO</th>
            ${cols.map(c => `<th style="text-align:center;">${escapeHtml(c.tenCot)}</th>`).join('')}
            <th style="width:70px;">dung sai (+/-)</th><th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>`;
  }
  function printThongSoDo(data, maDH) { printHtml(`${maDH} - Thông số đo`, buildThongSoDoBodyHtml(data)); }

  function buildMoTaSanPhamBodyHtml(data, heading) {
    const oGrid = data.oGrid || [];
    const numCols = Math.max(0, ...oGrid.map(o => o.cot)) + 1;
    const numRows = Math.max(0, ...oGrid.map(o => o.dong)) + 1;
    const cellAt = (r, c) => oGrid.find(o => o.dong === r && o.cot === c);
    let gridRows = '';
    for (let r = 0; r < numRows; r++) {
      gridRows += '<tr>';
      for (let c = 0; c < numCols; c++) {
        const cell = cellAt(r, c);
        gridRows += `<td style="text-align:center;padding:6px;vertical-align:top;">${cell && cell.anhUrl ? `<img src="${escapeHtml(cell.anhUrl)}" style="width:100%;height:auto;max-height:245mm;object-fit:contain;">` : '<div style="color:#999;">(Khoảng trống)</div>'}${cell && cell.chuThich ? `<div style="margin-top:4px;font-size:12px;white-space:pre-wrap;">${escapeHtml(cell.chuThich)}</div>` : ''}</td>`;
      }
      gridRows += '</tr>';
    }
    return `
      <h2 style="text-align:center;">${escapeHtml(heading || 'MÔ TẢ SẢN PHẨM')}</h2>
      <table style="margin-top:10px;">
        ${docInfoRowsHtml(data)}
      </table>
      <table style="margin-top:10px;width:100%;table-layout:fixed;">${gridRows}</table>
      ${data.chuY ? `<div style="margin-top:14px;border:1px solid #cc4125;border-radius:6px;padding:10px 12px;"><b>Chú ý:</b> ${escapeHtml(data.chuY).replace(/\n/g, '<br>')}</div>` : ''}`;
  }
  function printMoTaSanPham(data, maDH, label = 'Mô tả sản phẩm') { printHtml(`${maDH} - ${label}`, buildMoTaSanPhamBodyHtml(data, (label || '').toUpperCase())); }

  function buildChiDinhNplBodyHtml(rows, maDH, orderInfo) {
    return `
      <h2 style="text-align:center;">CHỈ ĐỊNH NGUYÊN PHỤ LIỆU (NPL)</h2>
      <table style="margin-top:10px;">
        <tr><td style="width:50%;"><b>Mã lệnh SX:</b> ${escapeHtml(maDH)}</td><td><b>Mã hàng:</b> ${escapeHtml((orderInfo && orderInfo.MaSanPham) || '')}</td></tr>
        <tr><td colspan="2"><b>Tên sản phẩm:</b> ${escapeHtml((orderInfo && orderInfo.TenSanPham) || '')}</td></tr>
      </table>
      <table style="margin-top:10px;">
        ${/* v5.88: bản in Chỉ định NPL có cột Ảnh phụ kiện */''}
        <thead><tr><th style="width:38px;">STT</th><th style="width:80px;">Ảnh</th><th>Mã PK</th><th>Tên phụ kiện</th><th>SL</th><th>ĐVT</th><th>Ghi chú</th></tr></thead>
        <tbody>${rows.map((p, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td style="text-align:center;">${p.AnhDaiDien ? `<img src="${escapeHtml(p.AnhDaiDien)}" style="max-width:70px;max-height:70px;object-fit:contain;">` : ''}</td><td>${escapeHtml(p.MaPhuKien)}</td><td>${escapeHtml(p.TenPhuKien)}</td><td>${fmtNumber(p.SoLuong)}</td><td>${escapeHtml(p.DonVi || p.DonViGoc || '')}</td><td>${escapeHtml(p.GhiChu || '')}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;">Chưa chỉ định NPL nào</td></tr>'}</tbody>
      </table>`;
  }
  function printChiDinhNpl(rows, maDH, orderInfo) { printHtml(`${maDH} - Chỉ định NPL`, buildChiDinhNplBodyHtml(rows, maDH, orderInfo)); }

  /* v5.57: IN 4 LOẠI ĐƠN GIÁ theo từng BẢN (trước đây chỉ in được từ trong form soạn).
     Mỗi bản in có Mã hàng/Mã rập/Tên SP + tên bản ở đầu phiếu. */
  function donGiaHeaderHtml(tieuDe, maDH, order, ten) {
    order = order || {};
    return `
      <h2 style="text-align:center;">${escapeHtml(tieuDe)}</h2>
      <table style="margin-top:10px;">
        <tr><td style="width:50%;"><b>Mã lệnh SX:</b> ${escapeHtml(maDH)}</td><td><b>Tên sản phẩm:</b> ${escapeHtml(order.TenSanPham || '')}</td></tr>
        <tr><td><b>Mã rập:</b> ${escapeHtml(order.MaRap || '')}</td><td><b>Bản:</b> ${ten ? escapeHtml(ten) : '(không tên)'}</td></tr>
      </table>`;
  }
  async function printDonGia(maDH, loai, ten) {
    const tenQ = ten !== undefined && ten !== null ? '?ten=' + encodeURIComponent(ten) : '';
    const res = await apiGet(`/api/tailieukythuat/${loai}/${encodeURIComponent(maDH)}${tenQ}`);
    const order = res.order || {};
    let title = '', tableHtml = '';
    if (loai === 'dongiamay') {
      const rows = res.data || [];
      if (!rows.length) { toast('Bản này chưa có dòng đơn giá nào.', 'error'); return; }
      title = 'ĐƠN GIÁ CÔNG ĐOẠN MAY';
      tableHtml = `<table style="width:100%;border-collapse:collapse;margin-top:10px;" border="1" cellpadding="4">
        <thead><tr><th style="width:38px;">STT</th><th>Tên công đoạn</th><th>Giây giờ</th><th>Hệ số công đoạn</th><th>Hệ số công nhân</th><th>Thành tiền</th></tr></thead>
        <tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenCongDoan || '')}</td><td style="text-align:center;">${escapeHtml(String(r.GiayGio != null ? r.GiayGio : ''))}</td><td style="text-align:center;">${escapeHtml(String(r.HeSoCongDoan != null ? r.HeSoCongDoan : ''))}</td><td style="text-align:center;">${escapeHtml(String(r.HeSoCongNhan != null ? r.HeSoCongNhan : ''))}</td><td style="text-align:right;">${fmtNumber(r.ThanhTien)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td></td><td colspan="4" style="text-align:right;font-weight:700;">Tổng</td><td style="text-align:right;font-weight:700;">${fmtNumber((rows.reduce((s, r) => s + (Number(r.ThanhTien) || 0), 0)))}</td></tr></tfoot></table>`;
    } else if (loai === 'dongiagiacong') {
      const rows = res.chosen || [];
      if (!rows.length) { toast('Bản này chưa có hạng mục nào.', 'error'); return; }
      title = 'ĐƠN GIÁ GIAO GIA CÔNG';
      tableHtml = `<table style="width:100%;border-collapse:collapse;margin-top:10px;" border="1" cellpadding="4">
        <thead><tr><th style="width:38px;">STT</th><th>Hạng mục gia công</th><th>Đơn giá</th></tr></thead>
        <tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.TenHangMuc || '')}</td><td style="text-align:right;">${fmtNumber(r.DonGia)}</td></tr>`).join('')}</tbody></table>`;
    } else if (loai === 'dongiainthe') {
      const rows = res.data || [];
      if (!rows.length) { toast('Bản này chưa có dòng nào.', 'error'); return; }
      title = 'ĐƠN GIÁ IN THÊU';
      tableHtml = `<table style="width:100%;border-collapse:collapse;margin-top:10px;" border="1" cellpadding="4">
        <thead><tr><th style="width:38px;">STT</th><th>Tên hạng mục in/thêu</th><th>Đơn giá</th></tr></thead>
        <tbody>${rows.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.Ten || '')}</td><td style="text-align:right;">${fmtNumber(r.DonGia)}</td></tr>`).join('')}</tbody></table>`;
    } else {   // dongialadonggoi
      const d = res.data || {};
      title = 'ĐƠN GIÁ LÀ / ĐÓNG GÓI';
      tableHtml = `<table style="width:100%;border-collapse:collapse;margin-top:10px;" border="1" cellpadding="4">
        <thead><tr><th style="width:38px;">STT</th><th>Hạng mục</th><th>Đơn giá / cái</th></tr></thead>
        <tbody><tr><td style="text-align:center;">1</td><td>LÀ (ủi)</td><td style="text-align:right;">${fmtNumber(d.la)}</td></tr>
        <tr><td style="text-align:center;">2</td><td>ĐÓNG GÓI</td><td style="text-align:right;">${fmtNumber(d.dg)}</td></tr></tbody></table>`;
    }
    printHtml(`${maDH} - ${title}`, donGiaHeaderHtml(title, maDH, order, ten) + tableHtml);
  }

  // Nhan mot doc lay ten hien thi (dung cho toast bao "chua co du lieu" theo dung loai nguoi dung chon).
  const LOAI_LABEL = { tailieuchung: 'Tài liệu kỹ thuật chung', thongsodo: 'Thông số đo', chidinhnpl: 'Chỉ định NPL', motasp: 'Mô tả sản phẩm' };

  // v5.15: goi TU BEN NGOAI module nay (nut "In tài liệu kỹ thuật" tren Danh sách lệnh sản xuất, xem
  // module.qlsx.js renderOrders()) - loai='all' (hoac khong truyen) => gop TAT CA loai DA CO du lieu
  // vao 1 lan in duy nhat (moi loai 1 trang rieng qua page-break-before, bo qua loai chua co gi); loai
  // cu the ('tailieuchung'|'thongsodo'|'chidinhnpl'|'motasp') => chi in DUNG loai do (bao loi qua toast
  // neu lenh san xuat nay chua co du lieu loai do). Khong doi ket qua/hanh vi cua cac man hinh in rieng
  // da co (nut "In" trong tung form soan) - ham nay CHI doc du lieu da luu qua API GET, khong sua gi.
  async function printOrderDocs(maDH, loai) {
    if (loai && loai !== 'all') return printOneOrderDoc(maDH, loai);
    // v5.43: "In tất cả" = gộp 5 loại theo yêu cầu (Thông số KT, Mô tả đường may, Quy cách đóng gói,
    // Hình ảnh in/thêu, Bảng kê BTP), MỖI loại 1 trang, BỎ QUA loại chưa có dữ liệu.
    let tsd, mtsp, qc, hait, bkHtml;
    try {
      [tsd, mtsp, qc, hait, bkHtml] = await Promise.all([
        apiGet(`/api/tailieukythuat/thongsodo/${maDH}`).catch(() => ({ data: null })),
        apiGet(`/api/tailieukythuat/motasp/${maDH}?loai=motasp`).catch(() => ({ data: null })),
        apiGet(`/api/tailieukythuat/motasp/${maDH}?loai=quycach`).catch(() => ({ data: null })),
        apiGet(`/api/tailieukythuat/motasp/${maDH}?loai=hinhanhinthue`).catch(() => ({ data: null })),
        (window.ModuleBangKeBTP && window.ModuleBangKeBTP.buildOrderSectionHtml
          ? window.ModuleBangKeBTP.buildOrderSectionHtml(maDH).catch(() => null) : Promise.resolve(null))
      ]);
    } catch (err) { toast(err.message, 'error'); return; }
    const sections = [];
    if (tsd.data) sections.push(buildThongSoDoBodyHtml(tsd.data));
    if (mtsp.data) sections.push(buildMoTaSanPhamBodyHtml(mtsp.data, 'MÔ TẢ ĐƯỜNG MAY'));
    if (qc.data) sections.push(buildMoTaSanPhamBodyHtml(qc.data, 'QUY CÁCH ĐÓNG GÓI'));
    if (hait.data) sections.push(buildMoTaSanPhamBodyHtml(hait.data, 'HÌNH ẢNH MÔ TẢ IN/THÊU'));
    if (bkHtml) sections.push(bkHtml);
    if (!sections.length) { toast(`Lệnh sản xuất ${maDH} chưa có tài liệu nào để in.`, 'error'); return; }
    const body = sections.map((s, i) => i === 0 ? s : `<div style="page-break-before:always;">${s}</div>`).join('');
    printHtml(`${maDH} - Tài liệu kỹ thuật (Tổng hợp)`, body);
  }

  // v5.57: +tham số `ten` = IN ĐÚNG 1 BẢN (bỏ trống = bản đầu tiên, giữ nguyên hành vi "In tất cả" cũ).
  // Mọi bản in đều gắn Mã rập (lấy từ res.order.MaRap) + tên bản qua docInfoRowsHtml().
  async function printOneOrderDoc(maDH, loai, ten) {
    const tenQ = ten !== undefined && ten !== null ? '&ten=' + encodeURIComponent(ten) : '';
    const withInfo = (data, res) => Object.assign({}, data, {
      maRap: (res && res.order && res.order.MaRap) || '', tenBan: ten || ''
    });
    try {
      if (loai === 'tailieuchung') {
        const res = await apiGet(`/api/tailieukythuat/tailieuchung/${maDH}?_=1${tenQ}`);
        if (!res.data) { toast(`Lệnh sản xuất ${maDH} chưa có ${LOAI_LABEL[loai]}.`, 'error'); return; }
        printTaiLieuChung(withInfo(res.data, res), maDH);
      } else if (loai === 'thongsodo') {
        const res = await apiGet(`/api/tailieukythuat/thongsodo/${maDH}?_=1${tenQ}`);
        if (!res.data) { toast(`Lệnh sản xuất ${maDH} chưa có ${LOAI_LABEL[loai]}.`, 'error'); return; }
        printThongSoDo(withInfo(res.data, res), maDH);
      } else if (loai === 'motasp' || loai === 'quycach' || loai === 'hinhanhinthue') {
        // v5.43: 3 loại dùng chung bảng TaiLieuMoTaSanPham (phân biệt qua ?loai=), 1 builder chung.
        const label = { motasp: 'Mô tả đường may', quycach: 'Quy cách đóng gói', hinhanhinthue: 'Hình ảnh mô tả in/thêu' }[loai];
        const res = await apiGet(`/api/tailieukythuat/motasp/${maDH}?loai=${loai}${tenQ}`);
        if (!res.data) { toast(`Lệnh sản xuất ${maDH} chưa có ${label}.`, 'error'); return; }
        printMoTaSanPham(withInfo(res.data, res), maDH, label);
      } else if (loai === 'dongiamay' || loai === 'dongiagiacong' || loai === 'dongialadonggoi' || loai === 'dongiainthe') {
        await printDonGia(maDH, loai, ten);   // v5.57: in 4 loại đơn giá theo từng bản
      } else if (loai === 'bangkebtp') {
        // v5.43: Bảng kê BTP ở module riêng — mượn builder đã export (module.bangkebtp.js).
        const html = window.ModuleBangKeBTP && window.ModuleBangKeBTP.buildOrderSectionHtml
          ? await window.ModuleBangKeBTP.buildOrderSectionHtml(maDH, ten) : null;
        if (!html) { toast(`Lệnh sản xuất ${maDH} chưa có Bảng kê BTP.`, 'error'); return; }
        printHtml(`${maDH} - Bảng kê BTP`, html);
      } else if (loai === 'chidinhnpl') {
        const [orderInfo, rows] = await Promise.all([
          apiGet('/api/tailieukythuat/orders?loai=chidinhnpl').then(r => (r.data || []).find(o => o.MaDH === maDH) || null),
          apiGet(`/api/qlsx/orders/${maDH}/phukien`).then(r => r.data || [])
        ]);
        if (!rows.length) { toast(`Lệnh sản xuất ${maDH} chưa có ${LOAI_LABEL[loai]}.`, 'error'); return; }
        printChiDinhNpl(rows, maDH, orderInfo);
      }
    } catch (err) { toast(err.message, 'error'); }
  }

  return { render, openChiDinhNPL, printOrderDocs };
})();
