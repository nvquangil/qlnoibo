// Phan he QUAN LY KHO VAI (theo cay vai)
window.ModuleKhoVai = (function () {
  let activeTab = 'dashboard';
  let container, currentUser, dm = null;
  // Cay vai duoc chon tu tab "Ton theo cay" (nut "Xuat kho") de tu dong dien san dong dau tien
  // khi renderXuat() chay - doc xong thi xoa ngay, chi ap dung 1 lan.
  let pendingXuatCayId = null;
  // Cache danh sach tat ca cay vai (available=false) da tai o tab "Ton theo cay", dung lai cho
  // chuc nang tim + in lai tem theo ma cay o tab "In tem" de khong phai goi lai API nhieu lan.
  let rollsAllCache = null;

  function getTabs(user) {
    const perm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.KHOVAI || {});
    const tabs = [
      { key: 'dashboard', label: 'Tồn kho' },
      { key: 'rolls', label: 'Tồn theo cây' }
    ];
    if (perm.canCreate) tabs.push({ key: 'nhap', label: 'Nhập kho' });
    if (perm.canEdit) tabs.push({ key: 'xuat', label: 'Xuất kho' });
    /* v6.04: tab "Định mức & Hao hụt" ĐÃ CHUYỂN sang phân hệ Quản lý sản xuất (khai theo LỆNH SX + theo
       LOẠI VẢI, SL hoàn thành lấy từ SL nhập kho). Bỏ hẳn ở đây để không có 2 nơi cho ra 2 con số khác
       nhau. renderDinhMuc/openDinhMucForm bên dưới + các route /api/khovai/dinhmuc|haohut giữ lại (mồ
       côi) cho dữ liệu cũ, KHÔNG còn lối vào từ menu. */
    if (perm.canCreate) tabs.push({ key: 'kiemke', label: 'Kiểm kê' });
    tabs.push({ key: 'tem', label: 'In tem theo ngày nhập' });
    return tabs;
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    // v5.3: giao voi quyen rieng theo chuc nang (tab dang mo) - xem effectivePerm() trong common.js.
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.KHOVAI || {});
    const perm = effectivePerm(user, 'KHOVAI', activeTab, rawPerm);
    if (!dm) dm = (await apiGet('/api/khovai/danhmuc')).data;

    container.innerHTML = `<div id="kvBody"></div>`;

    if (activeTab === 'dashboard') return renderDashboard();
    if (activeTab === 'rolls') return renderRolls(perm);
    if (activeTab === 'nhap') return renderNhap(perm);
    if (activeTab === 'xuat') return renderXuat(perm);
    if (activeTab === 'dinhmuc') return renderDinhMuc(perm);
    if (activeTab === 'kiemke') return renderKiemKe(perm);
    if (activeTab === 'tem') return renderTem(perm);
  }

  // v5.4 (muc 2): popup dung chung hien danh sach cay vai (STT + day du cot) cho ca 2 kieu drilldown -
  // bam Ma vai/Loai vai/Mau (renderDashboard + renderRolls) hoac bam Trang thai (renderRolls).
  function showCayListPopup(filteredRows, label) {
    const modal = openModal(`
      <h3>Danh sách cây vải — ${escapeHtml(label || '')}</h3>
      <table><thead><tr><th>STT</th><th>Mã cây</th><th>Mã vải</th><th>Loại vải</th><th>Màu</th><th>KG nhập</th><th>KG còn</th><th>Trạng thái</th><th>Ngày nhập</th></tr></thead>
      <tbody>${filteredRows.map((r, i) => `<tr><td>${i + 1}</td><td>${maCayLinkHtml(r)}</td><td>${escapeHtml(r.MaVai)}</td>
        <td>${escapeHtml(r.TenLoaiVai)}</td><td>${escapeHtml(r.TenMau)}</td><td>${fmtNumber(r.KGNhap)}</td><td>${fmtNumber(r.KGCon)}</td>
        <td>${statusBadge(r.TrangThai)}</td><td>${fmtDate(r.NgayNhap)}</td></tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Không có cây vải nào</td></tr>'}</tbody></table>
      <div class="modal-actions"><button class="btn secondary" id="btnCloseCayPopup">Đóng</button></div>`);
    modal.querySelector('.modal').style.maxWidth = 'min(900px, 96vw)';
    wireMaCayLink(modal);   // v6.13
    modal.querySelector('#btnCloseCayPopup').addEventListener('click', closeModal);
  }

  /* ================================================================================================
     v6.13 — LỊCH SỬ NHẬP / XUẤT CỦA TỪNG CÂY VẢI
     Mọi chỗ hiện MÃ CÂY đều bấm được: mở popup lịch sử của cây đó (phiếu nhập + các phiếu xuất + xuất
     vật tư + kiểm kê + sổ cắt). Trong popup bấm tiếp SỐ PHIẾU là mở đúng phiếu ra xem/in/sửa — nhờ ngăn
     xếp modal (v5.97), đóng phiếu sẽ quay lại đúng popup lịch sử chứ không thoát hẳn.
     maCayLinkHtml(r) cần r.CayID; hàng nào không có CayID thì in chữ thường, không bấm được.
     ================================================================================================ */
  // Quyền sửa phiếu (chỉ để ẩn/hiện nút — máy chủ vẫn kiểm tra lại khi lưu).
  function coQuyenSuaKhoVai() {
    if (!currentUser) return false;
    return !!currentUser.isAdmin || !!((currentUser.permissions || {}).KHOVAI || {}).canEdit;
  }
  function maCayLinkHtml(r) {
    const ma = escapeHtml(r.MaCay || '');
    if (!r || r.CayID == null) return ma;
    return `<a href="javascript:void(0)" class="act-cay-ls" data-cayid="${r.CayID}" title="Xem lịch sử nhập/xuất của cây này">${ma}</a>`;
  }
  function wireMaCayLink(root) {
    (root || document).querySelectorAll('.act-cay-ls').forEach(a =>
      a.addEventListener('click', () => openCayLichSuModal(a.dataset.cayid)));
  }
  async function openCayLichSuModal(cayId) {
    let d;
    try { d = (await apiGet('/api/khovai/cay/' + encodeURIComponent(cayId) + '/lichsu')).data; }
    catch (err) { toast('Không tải được lịch sử cây vải: ' + err.message, 'error'); return; }
    const c = d.cay || {};
    const bang = (tieuDe, cot, dong) => `<h4 style="margin:10px 0 4px;">${tieuDe}</h4>
      <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">
        <thead><tr>${cot.map(x => `<th>${x}</th>`).join('')}</tr></thead>
        <tbody>${dong || `<tr><td colspan="${cot.length}" style="text-align:center;color:#5f6368;">(không có)</td></tr>`}</tbody></table>`;

    const dongNhap = d.nhap ? `<tr>
        <td><a href="javascript:void(0)" class="act-mo-pn" data-id="${d.nhap.PhieuNhapID}" title="Mở phiếu nhập">#${d.nhap.PhieuNhapID}</a></td>
        <td>${fmtDate(d.nhap.NgayNhap)}</td><td>${escapeHtml(d.nhap.TenNCC || '')}</td><td>${escapeHtml(d.nhap.SoHoaDon || '')}</td>
        <td style="text-align:right;">${fmtNumber(c.KGNhap)}</td><td style="text-align:right;">${c.SoMet != null ? fmtNumber(c.SoMet) : ''}</td>
        <td>${escapeHtml(d.nhap.NguoiTao || '')}</td></tr>` : '';
    const dongXuat = (d.xuat || []).map(x => `<tr>
        <td><a href="javascript:void(0)" class="act-mo-px" data-id="${x.PhieuXuatID}" title="Mở phiếu xuất">#${x.PhieuXuatID}</a></td>
        <td>${fmtDate(x.NgayXuat)}</td><td>${escapeHtml(x.MaDH || x.MaDon || '')}</td><td>${escapeHtml(x.KieuVai || '')}</td>
        <td style="text-align:right;">${fmtNumber(x.KGXuat)}</td><td style="text-align:right;">${x.SoMet != null ? fmtNumber(x.SoMet) : ''}</td>
        <td>${escapeHtml(x.NguoiNhan || x.NguoiTao || '')}</td></tr>`).join('');
    const dongVatTu = (d.xuatVatTu || []).map(x => `<tr><td>#${x.PhieuVatTuID}</td><td>${fmtDate(x.NgayXuat)}</td>
        <td>${escapeHtml(x.MaDon || '')}</td><td style="text-align:right;">${fmtNumber(x.KGXuat)}</td>
        <td style="text-align:right;">${x.SoMet != null ? fmtNumber(x.SoMet) : ''}</td></tr>`).join('');
    const dongCat = (d.soCat || []).map(x => `<tr><td>${fmtDate(x.NgayGhiNhan)}</td><td>${escapeHtml(x.MaDH || '')}</td>
        <td>${escapeHtml(x.SttCay || '')}</td><td style="text-align:right;">${fmtNumber(x.SoLuongLop)}</td>
        <td style="text-align:right;">${x.SoKgMetSuDung != null ? fmtNumber(x.SoKgMetSuDung) : ''}</td></tr>`).join('');
    const dongKK = (d.kiemKe || []).map(x => `<tr><td>${fmtDate(x.NgayKiem)}</td><td style="text-align:right;">${fmtNumber(x.KGHeThong)}</td>
        <td style="text-align:right;">${fmtNumber(x.KGThucTe)}</td><td>${escapeHtml(x.GhiChu || '')}</td></tr>`).join('');

    const modal = openModal(`
      <h3>Lịch sử cây vải — ${escapeHtml(c.MaCay || '')}</h3>
      <p class="empty-hint">${escapeHtml(c.MaVai || '')} · ${escapeHtml(c.TenLoaiVai || '')} ${escapeHtml(c.TenMau || '')}
        ${c.KhoVaiThucTe != null ? ' · khổ ' + fmtNumber(c.KhoVaiThucTe) : ''}
        — Nhập <b>${fmtNumber(c.KGNhap)}</b> KG${c.SoMet != null ? ' / ' + fmtNumber(c.SoMet) + ' m' : ''}
        · CÒN <b>${fmtNumber(c.KGCon != null ? c.KGCon : 0)}</b> KG · ${statusBadge(c.TrangThai)}
        <br>Bấm vào <b>số phiếu</b> để mở phiếu ra xem / in / sửa.</p>
      <div style="max-height:62vh;overflow:auto;">
        ${bang('Phiếu nhập', ['Số phiếu', 'Ngày nhập', 'Nhà cung cấp', 'Số hóa đơn', 'KG nhập', 'Số mét', 'Người tạo'], dongNhap)}
        ${bang('Phiếu xuất kho vải', ['Số phiếu', 'Ngày xuất', 'Đơn hàng', 'Kiểu vải', 'KG xuất', 'Số mét', 'Người nhận'], dongXuat)}
        ${(d.xuatVatTu || []).length ? bang('Xuất vật tư (phần vải)', ['Số phiếu', 'Ngày xuất', 'Mã đơn', 'KG xuất', 'Số mét'], dongVatTu) : ''}
        ${(d.soCat || []).length ? bang('Đã đưa vào sổ cắt', ['Ngày cắt', 'Lệnh SX', 'STT cây', 'Số lớp', 'KG/mét dùng'], dongCat) : ''}
        ${(d.kiemKe || []).length ? bang('Kiểm kê', ['Ngày kiểm', 'KG hệ thống', 'KG thực tế', 'Ghi chú'], dongKK) : ''}
      </div>
      <div class="modal-actions"><button type="button" class="btn" id="clsDong">Đóng</button></div>`);
    modal.querySelector('.modal').style.maxWidth = 'min(980px, 96vw)';
    modal.querySelectorAll('.act-mo-pn').forEach(a => a.addEventListener('click', () => openNhapDetailModal(a.dataset.id)));
    modal.querySelectorAll('.act-mo-px').forEach(a => a.addEventListener('click', () => openXuatDetailModal(a.dataset.id)));
    modal.querySelector('#clsDong').addEventListener('click', closeModal);
  }

  async function renderDashboard() {
    const body = document.getElementById('kvBody');
    const res = await apiGet('/api/khovai/dashboard');
    const { stats, tonKho } = res.data;
    // v5.4 (muc 2): them cot STT + bam Ma vai/Loai vai/Mau mo popup cac cay thuoc ma vai do. Man hinh
    // nay khong san co danh sach cay (chi co so lieu tong hop) nen phai tu tai/dung lai rollsAllCache.
    body.innerHTML = `
      <div class="stat-row">
        <div class="stat-box"><div class="num">${stats.soMaVai}</div><div class="label">Số mã vải</div></div>
        <div class="stat-box green"><div class="num">${fmtNumber(stats.tongTonKG.toFixed(2))}</div><div class="label">Tổng tồn (KG)</div></div>
        <div class="stat-box red"><div class="num">${stats.soMaCanhBao}</div><div class="label">Mã dưới tồn tối thiểu</div></div>
        <div class="stat-box purple"><div class="num">${stats.tongCayConTon}</div><div class="label">Số cây còn tồn</div></div>
      </div>
      <div class="toolbar"><a class="btn small secondary" href="/api/khovai/dashboard/export">⬇️ Xuất Excel</a></div>
      <table><thead><tr><th>STT</th><th>Mã vải</th><th>Mã PM</th><th>Mã loại</th><th>Loại vải</th><th>Màu</th><th>Tồn (KG)</th><th>Tồn tối thiểu</th><th>Cây còn tồn</th><th>Trạng thái</th><th>Vị trí kho</th></tr></thead>
      <tbody>${tonKho.map((r, idx) => `<tr>
        <td>${idx + 1}</td>
        <td class="act-drill-vai" data-mavai="${escapeHtml(r.MaVai)}" style="cursor:pointer;text-decoration:underline;" title="Xem các cây vải thuộc mã này">${escapeHtml(r.MaVai)}</td>
        <td>${escapeHtml(r.MaPM)}</td><td>${escapeHtml(r.MaLoai)}</td>
        <td class="act-drill-vai" data-mavai="${escapeHtml(r.MaVai)}" style="cursor:pointer;" title="Xem các cây vải thuộc mã này">${escapeHtml(r.TenLoaiVai)}</td>
        <td class="act-drill-vai" data-mavai="${escapeHtml(r.MaVai)}" style="cursor:pointer;" title="Xem các cây vải thuộc mã này">${escapeHtml(r.TenMau)}</td>
        <td>${fmtNumber(Number(r.TonKG).toFixed(2))} ${r.TonToiThieuKG != null && Number(r.TonKG) < Number(r.TonToiThieuKG) ? '<span class="badge danger">Thấp</span>' : ''}</td>
        <td>${fmtNumber(r.TonToiThieuKG)}</td><td>${r.CayConTon}</td>
        <td>${['Nguyên cây', 'Cây lẻ', 'Hết'].map(st => {
          const n = st === 'Nguyên cây' ? r.SoCayNguyenCay : st === 'Cây lẻ' ? r.SoCayLe : r.SoCayHet;
          if (!n) return '';
          return `<span class="act-drill-status-agg" data-mavai="${escapeHtml(r.MaVai)}" data-status="${st}" style="cursor:pointer;text-decoration:underline;margin-right:8px;${st === 'Hết' ? 'color:#c0392b;' : ''}" title="Xem các cây ${st}">${st}: ${n}</span>`;
        }).join('') || '<span class="empty-hint">-</span>'}</td>
        <td>${escapeHtml(r.ViTriKho)}</td>
      </tr>`).join('') || '<tr><td colspan="11" class="empty-hint">Chưa có dữ liệu tồn kho</td></tr>'}</tbody></table>`;

    body.querySelectorAll('.act-drill-vai').forEach(td => td.addEventListener('click', async () => {
      const maVai = td.dataset.mavai;
      if (!rollsAllCache) rollsAllCache = await apiGet('/api/khovai/rolls?available=false').then(r => r.data);
      showCayListPopup(rollsAllCache.filter(r => r.MaVai === maVai), maVai);
    }));
    // v5.6: bam vao 1 trong 3 nhan Trang thai (Nguyen cay/Cay le/Het) o tab Ton kho tong hop -> popup
    // danh sach cay CUA DUNG ma vai do VA dung trang thai do (yeu cau v5.6 "kích vào trạng thái hiện ra
    // danh sách các cây vải thuộc trạng thái đó" - tab nay truoc day CHUA co cot Trang thai/drilldown
    // nay, chi co o tab "Tồn theo cây"; xem SoCayNguyenCay/SoCayLe/SoCayHet moi trong vw_TonKhoVai).
    body.querySelectorAll('.act-drill-status-agg').forEach(el => el.addEventListener('click', async () => {
      const maVai = el.dataset.mavai, status = el.dataset.status;
      if (!rollsAllCache) rollsAllCache = await apiGet('/api/khovai/rolls?available=false').then(r => r.data);
      showCayListPopup(rollsAllCache.filter(r => r.MaVai === maVai && r.TrangThai === status), maVai + ' — ' + status);
    }));
  }

  async function renderRolls(perm) {
    const body = document.getElementById('kvBody');
    const res = await apiGet('/api/khovai/rolls?available=false');
    const rows = res.data;
    rollsAllCache = rows; // cache lai cho tab "In tem" dung ham tim theo ma cay (GIU DU ca cay het)
    // v5.36: "tồn cây" chỉ hiện cây CÒN TỒN (KGCon>0), tự ẩn cây Hết. (rollsAllCache van du cho In tem.)
    const shownRows = rows.filter(r => Number(r.KGCon) > 0);
    const colCount = perm.canEdit ? 18 : 17;   // v5.53: +Khổ vải/Số mét đã xuất/Số mét còn
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="fSearch" placeholder="Tìm theo mã cây / mã vải...">
        <button type="button" class="btn small secondary" id="btnQrRolls">📷 Quét QR tìm cây</button>
        <a class="btn small secondary" href="/api/khovai/rolls/export">⬇️ Xuất Excel</a>
      </div>
      <table id="rollsTable"><thead><tr><th>STT</th><th>Mã cây</th><th>Mã vải</th><th>Mã PM</th><th>Mã loại</th><th>Loại vải</th><th>Màu</th><th>KG nhập</th><th>KG đã xuất</th><th>KG còn</th><th>Khổ vải</th><th>Số mét</th><th>Số mét đã xuất</th><th>Số mét còn</th><th>Trạng thái</th><th>Ngày nhập</th><th>QR</th>${perm.canEdit ? '<th>Thao tác</th>' : ''}</tr></thead>
      <tbody>${shownRows.map((r, i) => rowHtml(r, i)).join('') || `<tr><td colspan="${colCount}" class="empty-hint">Chưa có cây vải nào còn tồn</td></tr>`}</tbody></table>`;
    // v5.4 (muc 2): them STT (danh lai theo thu tu dang hien thi, ke ca sau khi loc) + bam Trang thai
    // (xem cac cay CUNG trang thai) hoac Ma vai/Loai vai/Mau (xem cac cay CUNG ma vai) de mo popup -
    // loc HOAN TOAN CLIENT-SIDE tu `rows` da tai san (khac renderDashboard phai tu tai/dung cache).
    function rowHtml(r, i) {
      return `<tr><td>${i + 1}</td><td>${maCayLinkHtml(r)}</td>
        <td class="act-drill-vai" data-mavai="${escapeHtml(r.MaVai)}" style="cursor:pointer;text-decoration:underline;" title="Xem các cây vải cùng mã">${escapeHtml(r.MaVai)}</td>
        <td>${escapeHtml(r.MaPM)}</td><td>${escapeHtml(r.MaLoai)}</td>
        <td class="act-drill-vai" data-mavai="${escapeHtml(r.MaVai)}" style="cursor:pointer;" title="Xem các cây vải cùng mã">${escapeHtml(r.TenLoaiVai)}</td>
        <td class="act-drill-vai" data-mavai="${escapeHtml(r.MaVai)}" style="cursor:pointer;" title="Xem các cây vải cùng mã">${escapeHtml(r.TenMau)}</td>
        <td>${fmtNumber(r.KGNhap)}</td><td>${fmtNumber(r.KGDaXuat)}</td><td>${fmtNumber(r.KGCon)}</td><td>${r.KhoVai != null ? fmtNumber(r.KhoVai) : ''}</td><td>${r.SoMet != null ? fmtNumber(r.SoMet) : ''}</td><td>${r.MetDaXuat != null ? fmtNumber(r.MetDaXuat) : ''}</td><td>${r.MetCon != null ? fmtNumber(r.MetCon) : ''}</td>
        <td class="act-drill-status" data-status="${escapeHtml(r.TrangThai)}" style="cursor:pointer;" title="Xem các cây vải cùng trạng thái">${statusBadge(r.TrangThai)}</td><td>${fmtDate(r.NgayNhap)}</td>
        <td>${r.QRCode ? `<a href="${r.QRCode}" target="_blank">Xem QR</a>` : ''}</td>
        ${perm.canEdit ? `<td>${Number(r.KGCon) > 0 ? `<button type="button" class="btn small secondary act-xuat-cay" data-cayid="${r.CayID}">Xuất kho</button>` : ''}</td>` : ''}</tr>`;
    }
    function wireRowActions() {
      body.querySelectorAll('.act-xuat-cay').forEach(btn => btn.onclick = () => {
        pendingXuatCayId = btn.dataset.cayid;
        activeTab = 'xuat';
        render(container, currentUser);
      });
      body.querySelectorAll('.act-drill-vai').forEach(td => td.addEventListener('click', () => {
        showCayListPopup(shownRows.filter(r => r.MaVai === td.dataset.mavai), td.dataset.mavai);
      }));
      body.querySelectorAll('.act-drill-status').forEach(td => td.addEventListener('click', () => {
        showCayListPopup(shownRows.filter(r => r.TrangThai === td.dataset.status), 'Trạng thái: ' + td.dataset.status);
      }));
      wireMaCayLink(body);   // v6.13: bấm Mã cây -> lịch sử nhập/xuất của cây
    }
    wireRowActions();
    // Go bat ky ky tu nao de loc - quet TOAN BO cac cot dang co trong du lieu (khong chi Ma cay/Ma vai
    // nhu truoc), vd go ten mau, ten loai vai, vi tri kho, trang thai... deu loc duoc.
    document.getElementById('fSearch').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      const filtered = shownRows.filter(r => Object.values(r).join(' ').toLowerCase().includes(q));
      document.querySelector('#rollsTable tbody').innerHTML = filtered.map((r, i) => rowHtml(r, i)).join('') || `<tr><td colspan="${colCount}" class="empty-hint">Không tìm thấy</td></tr>`;
      wireRowActions();
    });
    /* v5.73: QUÉT TEM CÓ SẴN ĐỂ TRA CỨU NGAY — dùng được với MỌI tem (tem cũ chỉ có mã cây cũng
       được, không cần in lại). Quét xong: lọc danh sách về đúng cây đó + hiện luôn thông tin chính
       (loại vải, màu, khổ, còn bao nhiêu, vị trí) và cột Thao tác có nút "Xuất kho" cho cây đó. */
    document.getElementById('btnQrRolls').addEventListener('click', () => {
      openQrScanner(text => {
        const c = timCayTheoMa(rollsAllCache, text);        // v5.76: so khớp đã chuẩn hoá
        const ma = (c && c.MaCay) || maCayTuQR(text) || String(text || '').trim();
        const input = document.getElementById('fSearch');
        input.value = ma;
        input.dispatchEvent(new Event('input'));
        if (!c) { toast(`Không tìm thấy mã cây "${ma}" trong kho vải.`, 'error'); return; }
        toast(`${c.MaCay}\n${c.TenLoaiVai || ''} ${c.TenMau || ''}` +
          `${c.KhoVai != null ? ' · khổ ' + fmtNumber(c.KhoVai) : ''}\n` +
          `Nhập ${fmtNumber(c.KGNhap)} KG${c.SoMet != null ? ' / ' + fmtNumber(c.SoMet) + ' m' : ''}` +
          ` · đã xuất ${fmtNumber(c.KGDaXuat)} · CÒN ${fmtNumber(c.KGCon)} KG` +
          `${c.MetCon != null ? ' / ' + fmtNumber(c.MetCon) + ' m' : ''}` +
          `${c.ViTriKho ? '\nVị trí ' + c.ViTriKho : ''}${c.NgayNhap ? ' · nhập ' + fmtDate(c.NgayNhap) : ''}`,
          Number(c.KGCon) > 0 ? 'success' : 'info');
      });
    });
  }

  // v5.0: tab Nhap kho gio la MAN HINH DANH SACH cac phieu da tao (xem/in/sua/xoa theo quyen), nut
  // "+ Tao phieu" mo form nhieu cay nhu truoc nhung trong 1 modal - thay vi form la toan bo noi dung
  // tab nhu phien ban cu (khong xem lai duoc phieu cu, khong in lai duoc sau khi roi khoi man hinh).
  async function renderNhap(perm) {
    const body = document.getElementById('kvBody');
    const rows = await apiGet('/api/khovai/nhap').then(r => r.data);
    body.innerHTML = `
      <div class="toolbar">${perm.canCreate ? '<button class="btn" id="btnAddNhap">+ Tạo phiếu nhập kho</button>' : ''}</div>
      <table><thead><tr><th>Số phiếu</th><th>Ngày nhập</th><th>Nhà cung cấp</th><th>Số hóa đơn</th><th>Số cây</th><th>Tổng KG</th><th>Tổng mét</th><th>Người tạo</th><th>Ghi chú</th><th style="width:190px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        ${/* v6.57: NK- -> NKV- (Nhập Kho Vải). Phụ kiện đang là NPK-/XPK-, vải để NK-/XK- thì nhìn
             hai loại phiếu na ná nhau, đối chiếu dễ lẫn. */''}
        <td>NKV-${String(r.PhieuNhapID).padStart(5, '0')}</td>
        <td>${fmtDate(r.NgayNhap)}</td><td>${escapeHtml(r.TenNCC)}</td><td>${escapeHtml(r.SoHoaDon)}</td>
        <td>${r.SoLuongCay}</td><td>${fmtNumber(r.TongKGNhap)}</td><td>${fmtNumber(r.TongMet)}</td><td>${escapeHtml(r.NguoiTao)}</td><td>${escapeHtml(r.GhiChu)}</td>
        <td>
          <button type="button" class="btn small secondary act-view" data-id="${r.PhieuNhapID}">Xem/In</button>
          ${perm.canEdit ? `<button type="button" class="btn small secondary act-edit" data-id="${r.PhieuNhapID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button type="button" class="btn small danger act-del" data-id="${r.PhieuNhapID}">Xóa</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="10" class="empty-hint">Chưa có phiếu nhập kho nào</td></tr>'}</tbody></table>`;

    if (perm.canCreate) document.getElementById('btnAddNhap').addEventListener('click', () => openNhapCreateModal());
    body.querySelectorAll('.act-view').forEach(btn => btn.addEventListener('click', () => openNhapDetailModal(btn.dataset.id)));
    ganBamDongXemChiTiet(body);   // v6.66.1: bấm cả dòng cũng mở chi tiết
    body.querySelectorAll('.act-edit').forEach(btn => btn.addEventListener('click', () => {
      const row = rows.find(r => String(r.PhieuNhapID) === btn.dataset.id);
      openNhapEditModal(row);
    }));
    body.querySelectorAll('.act-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu nhập này? Chỉ xóa được nếu các cây vải trong phiếu CHƯA phát sinh xuất kho/giao vải sản xuất/kiểm kê.')) return;
      try { await apiDelete('/api/khovai/nhap/' + btn.dataset.id); toast('Đã xóa.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  // v5.4: rebuild dung theo mau_phieu.docx - tach dong Ngay/So/Don vi ban hang/Ngay hoa don rieng
  // tung dong (thay vi gop 1 dong nhu truoc), cot bang dung thu tu Ma vai|Loai vai|Mau|Kho vai|Gia
  // nhap|KG nhap|Ma cay, va 3 vai ky: Nguoi lap, QC Vai, Thu kho (truoc chi co 2 vai).
  function printPhieuNhapFromData(header, lines) {
    printHtml('Phiếu nhập kho vải', `
      ${phieuHeaderHtml('PHIẾU NHẬP KHO VẢI', header.NgayNhap, header.PhieuNhapID)}
      <p class="p-meta"><b>Đơn vị bán hàng:</b> ${escapeHtml(header.TenNCC || '')}</p>
      <p class="p-meta"><b>Ngày hóa đơn:</b> ${header.NgayHoaDon ? fmtDate(header.NgayHoaDon) : ''}${header.SoHoaDon ? ' &nbsp; <b>Số hóa đơn:</b> ' + escapeHtml(header.SoHoaDon) : ''}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã vải</th><th>Loại vải</th><th>Mầu</th><th>Khổ vải</th><th>Giá nhập</th><th>KG nhập</th><th>Số mét</th><th>Mã cây tự sinh</th></tr></thead>
      ${/* v5.93: + dòng TỔNG CỘNG kg / mét ở cuối bảng */''}
      <tbody>${lines.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaVai)}</td><td>${escapeHtml(r.TenLoaiVai)}</td><td>${escapeHtml(r.TenMau)}</td><td>${fmtNumber(r.KhoVaiThucTe)}</td><td>${fmtNumber(r.DonGiaNhap)}</td><td>${fmtNumber(r.KGNhap)}</td><td>${r.SoMet != null ? fmtNumber(r.SoMet) : ''}</td><td>${escapeHtml(r.MaCay)}</td></tr>`).join('')}
        ${dongTongKgMet(lines, 'KGNhap', 'SoMet', 6, 1)}</tbody></table>
      <div class="p-sign"><div><div class="line">Người lập</div></div><div><div class="line">QC Vải</div></div><div><div class="line">Thủ kho</div></div></div>`);
  }

  async function openNhapDetailModal(phieuNhapId) {
    const res = await apiGet('/api/khovai/nhap/' + phieuNhapId);
    const { header, lines } = res.data;
    const modal = openModal(`
      <h3>Phiếu nhập kho #${header.PhieuNhapID}</h3>
      <p class="p-meta"><b>Ngày nhập:</b> ${fmtDate(header.NgayNhap)} &nbsp; <b>Nhà cung cấp:</b> ${escapeHtml(header.TenNCC || '')} &nbsp; <b>Số hóa đơn:</b> ${escapeHtml(header.SoHoaDon || '')}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã cây</th><th>Loại vải</th><th>Màu</th><th>KG nhập</th><th>Số mét</th><th>Khổ TT</th><th>GSM</th><th>Đơn giá</th><th>Trạng thái</th></tr></thead>
      ${/* v6.13: Mã cây bấm được -> xem lịch sử nhập/xuất của chính cây đó (modal xếp chồng). */''}
      <tbody>${lines.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${maCayLinkHtml(r)}</td><td>${escapeHtml(r.TenLoaiVai)}</td><td>${escapeHtml(r.TenMau)}</td>
        <td>${fmtNumber(r.KGNhap)}</td><td>${r.SoMet != null ? fmtNumber(r.SoMet) : ''}</td><td>${fmtNumber(r.KhoVaiThucTe)}</td><td>${fmtNumber(r.GSM)}</td><td>${fmtNumber(r.DonGiaNhap)}</td><td>${statusBadge(r.TrangThai)}</td></tr>`).join('')}
        ${dongTongKgMet(lines, 'KGNhap', 'SoMet', 4, 4)}</tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnCloseNhapView">Đóng</button>
        ${/* v6.13: sửa được NGAY trong cửa sổ xem — mở từ lịch sử cây vải không phải quay ra tab Nhập kho. */''}
        ${coQuyenSuaKhoVai() ? '<button type="button" class="btn secondary" id="btnSuaNhapView">✏️ Sửa phiếu</button>' : ''}
        <button type="button" class="btn secondary" id="btnPrintTemNhapView">🏷️ In tem (máy tính)</button>
        <button type="button" class="btn secondary" id="btnPrintTemNhapMang">🖨️ In tem qua máy in mạng</button>
        <button type="button" class="btn" id="btnPrintNhapView">🖨️ In phiếu</button>
      </div>`);
    modal.querySelector('#btnCloseNhapView').addEventListener('click', closeModal);
    wireMaCayLink(modal);   // v6.13
    const bSuaN = modal.querySelector('#btnSuaNhapView');
    if (bSuaN) bSuaN.addEventListener('click', () => openNhapEditModal(header));
    modal.querySelector('#btnPrintNhapView').addEventListener('click', () => printPhieuNhapFromData(header, lines));
    // v5.12: khoi phuc nut in tem bi mat (yeu cau v5.12 "lúc trước có phần in tem các cây mới nhập, hiện
    // tại không thấy") - dung lai NGUYEN VEN printTemHangLoat() cua tab "In tem theo ngày nhập" (khong
    // tao ham/HTML rieng) de luon nhat quan neu tab do doi mau tem sau nay. printTemHangLoat can QRCode/
    // MaCay/TenLoaiVai/TenMau/KGNhap/NgayNhap tren MOI dong - GET /nhap/:id da co du tat ca TRU NgayNhap
    // (chi co tren header, khong lap lai tren tung dong) nen bo sung thu cong truoc khi in. Mac dinh kho
    // "doc" (giong lua chon mac dinh cua tab "In tem") - khong them lua chon doc/ngang o day de giu modal
    // don gian, nguoi dung can kho "ngang" van dung duoc tab "In tem theo ngày nhập" rieng (khong doi).
    modal.querySelector('#btnPrintTemNhapView').addEventListener('click', () => {
      printTemHangLoat(lines.map(l => ({ ...l, NgayNhap: header.NgayNhap })), 'doc');
    });
    // v5.45.3: in tem các cây vừa nhập qua MÁY IN MẠNG (dùng chung printTemMang; server lấy dữ liệu theo MaCay).
    modal.querySelector('#btnPrintTemNhapMang').addEventListener('click', () => printTemMang(lines));
  }

  // v5.3 (muc 3): sua DAY DU phieu nhap - dong da phat sinh giao dich khac (CoPhatSinh) chi cho sua
  // KG nhap (khong duoc thap hon DaXuat)/kho TT/GSM/vi tri/don gia, khoa doi Loai vai/Mau; dong CHUA
  // phat sinh gi thi sua het; co the them dong moi hoac xoa dong (dong xoa cung phai chua phat sinh gi).
  async function openNhapEditModal(row) {
    const detail = await apiGet('/api/khovai/nhap/' + row.PhieuNhapID);
    const { lines } = detail.data;
    let rowCount = 0;
    // v5.80: bảng thật, cùng bố cục với form Tạo phiếu nhập + thêm cột Mã cây (chỉ xem).
    const COLS_SUA = `<colgroup>
      <col style="width:17%"><col style="width:23%"><col style="width:23%"><col style="width:8%"><col style="width:7%">
      <col style="width:9%"><col style="width:8%"><col style="width:9%"><col style="width:42px">
    </colgroup>`;
    const HEAD_SUA = `<thead><tr>
      <th>Mã cây</th><th>Loại vải *</th><th>Màu *</th><th>Khổ vải</th><th>GSM</th><th>KG nhập</th><th>Số mét</th><th>Đơn giá</th><th></th>
    </tr></thead>`;
    function rowTemplate(line) {
      rowCount++;
      const idx = rowCount;
      const locked = !!(line && line.CoPhatSinh);
      const cayId = line ? line.CayID : '';
      const maCay = line ? line.MaCay : '';
      return `<tr data-row data-idx="${idx}" data-cayid="${cayId}" data-macay="${escapeHtml(maCay)}">
        <td>${maCay ? `<input value="${escapeHtml(maCay)}" readonly title="Mã cây không đổi được">` : '<span style="font-size:12px;color:#5f6368;">Cây mới</span>'}</td>
        ${/* v6.59: PHẢI CÓ option rỗng. opt() không tự sinh option rỗng, nên nếu LoaiVaiID/MauSacID
             đã lưu KHÔNG còn trong danh mục (loại vải bị xóa hoặc gộp — xem utils/doi_ma_loai_vai.js)
             thì <select> rơi về mục ĐẦU TIÊN. Bấm Lưu là đổi im lặng loại vải/màu của dòng đó, không
             báo gì. Có option rỗng + `required` thì trình duyệt chặn ngay và người dùng thấy ô trống
             để tự chọn lại. */''}
        <td><select class="r-loai" ${locked ? 'disabled' : ''} required><option value="">-- chọn loại vải --</option>${opt(dm.loaiVai, 'LoaiVaiID', 'TenLoaiVai', line ? line.LoaiVaiID : '')}</select></td>
        <td><select class="r-mau" ${locked ? 'disabled' : ''} required><option value="">-- chọn màu --</option>${opt(dm.mauSac, 'MauSacID', 'TenMau', line ? line.MauSacID : '')}</select></td>
        <td class="col-so"><input class="r-kho" type="number" step="0.01" value="${line && line.KhoVaiThucTe != null ? line.KhoVaiThucTe : ''}"></td>
        <td class="col-so"><input class="r-gsm" type="number" step="0.01" value="${line && line.GSM != null ? line.GSM : ''}"></td>
        ${/* v5.89: KG KHÔNG bắt buộc nữa — nhập theo KG hoặc theo MÉT hoặc cả hai (kiểm tra khi Lưu). */''}
        <td class="col-so"><input class="r-kg" type="number" step="0.01" min="${locked ? line.DaXuat : 0}" value="${line ? line.KGNhap : ''}"${locked ? ` title="Không giảm dưới số đã dùng: ${fmtNumber(line.DaXuat)}"` : ''}></td>
        <td class="col-so"><input class="r-met" type="number" step="0.01" min="0" value="${line && line.SoMet != null ? line.SoMet : ''}"></td>
        <td class="col-so col-gia"><input class="r-gia" type="number" step="0.01" min="0" value="${line && line.DonGiaNhap != null ? line.DonGiaNhap : ''}"></td>
        <td class="col-nut"><button type="button" class="btn small danger r-remove" ${locked ? 'disabled title="Đã phát sinh giao dịch khác, không xóa được dòng này"' : ''}>X</button></td>
      </tr>`;
    }
    const html = `
      <h3>Sửa phiếu nhập #${row.PhieuNhapID}</h3>
      <p style="font-size:13px;color:#5f6368;margin-top:-6px;">Dòng có khóa (🔒) là cây đã phát sinh xuất kho/giao vải sản xuất/kiểm kê - chỉ sửa được KG nhập (không giảm dưới số đã dùng), khổ vải, GSM, đơn giá; không đổi được loại vải/màu hay xóa dòng đó.</p>
      <form id="nEditForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày nhập *</label><input type="date" name="ngayNhap" value="${new Date(row.NgayNhap).toISOString().slice(0, 10)}" required></div>
          <div class="form-row"><label>Nhà cung cấp</label><select name="nccId"><option value="">--</option>${opt(dm.nhaCungCap, 'NCC_ID', 'TenNCC', row.NCC_ID)}</select></div>
          <div class="form-row"><label>Số hóa đơn</label><input name="soHoaDon" value="${escapeHtml(row.SoHoaDon || '')}"></div>
          <div class="form-row"><label>Ngày hóa đơn</label><input type="date" name="ngayHoaDon" value="${row.NgayHoaDon ? new Date(row.NgayHoaDon).toISOString().slice(0, 10) : ''}"></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu" value="${escapeHtml(row.GhiChu || '')}"></div>
        </div>
        <div class="lap-wrap"><table class="lap-table">${COLS_SUA}${HEAD_SUA}
          <tbody id="rollRows">${lines.map(rowTemplate).join('') || rowTemplate(null)}</tbody></table></div>
        <button type="button" class="btn small secondary" id="btnAddRoll">+ Thêm cây vải</button>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    function wireRemove() {
      modal.querySelectorAll('.r-remove').forEach(btn => btn.onclick = () => {
        if (modal.querySelectorAll('#rollRows > [data-row]').length > 1) btn.closest('[data-row]').remove();
        else toast('Phiếu phải còn ít nhất 1 dòng.', 'error');
      });
    }
    wireRemove();
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#btnAddRoll').addEventListener('click', () => {
      modal.querySelector('#rollRows').insertAdjacentHTML('beforeend', rowTemplate(null));
      wireRemove();
      focusODauDong(modal.querySelector('#rollRows > [data-row]:last-child'));   // v5.80
    });
    modal.querySelector('#nEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const editLines = Array.from(modal.querySelectorAll('#rollRows > [data-row]')).map(r => ({
        cayId: r.dataset.cayid || null, maCay: r.dataset.macay || null,
        loaiVaiId: r.querySelector('.r-loai').value, mauSacId: r.querySelector('.r-mau').value,
        khoVaiThucTe: r.querySelector('.r-kho').value || null, gsm: r.querySelector('.r-gsm').value || null,
        kgNhap: r.querySelector('.r-kg').value, soMet: r.querySelector('.r-met').value || null, donGiaNhap: r.querySelector('.r-gia').value || null
      }));
      if (canhBaoThieuSoLuong(editLines, 'kgNhap', 'soMet', 'KG nhập')) return;   // v5.89
      try {
        await apiPut('/api/khovai/nhap/' + row.PhieuNhapID, {
          ngayNhap: fd.get('ngayNhap'), nccId: fd.get('nccId') || null, soHoaDon: fd.get('soHoaDon'),
          ngayHoaDon: fd.get('ngayHoaDon') || null, ghiChu: fd.get('ghiChu'),
          lines: editLines
        });
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function openNhapCreateModal() {
    if (!dm.loaiVai.length || !dm.mauSac.length) {
      toast('Vui lòng khai báo danh mục Loại vải và Màu sắc trước (phân hệ Danh mục).', 'error');
      return;
    }
    let rowCount = 0;
    /* v5.80: BẢNG THẬT — 1 hàng tiêu đề + các dòng chỉ có ô nhập. Bề rộng cột do <colgroup> quyết
       định: Loại vải + Màu rộng nhất (tên dài), các cột SỐ hẹp. */
    const COLS_NHAP = `<colgroup>
      <col style="width:27%"><col style="width:27%"><col style="width:9%"><col style="width:8%">
      <col style="width:10%"><col style="width:9%"><col style="width:10%"><col style="width:42px">
    </colgroup>`;
    const HEAD_NHAP = `<thead><tr>
      <th>Loại vải *</th><th>Màu *</th><th>Khổ vải</th><th>GSM</th><th>KG nhập</th><th>Số mét</th><th>Đơn giá</th><th></th>
    </tr></thead>`;
    function rowTemplate() {
      rowCount++;
      const idx = rowCount;
      // v5.78: KHÔNG còn ô "Mã cây (QR)" — mã cây do hệ thống tự sinh khi lưu.
      return `<tr data-row data-idx="${idx}">
        <td><select class="r-loai" required>${opt(dm.loaiVai, 'LoaiVaiID', 'TenLoaiVai')}</select></td>
        <td><select class="r-mau" required>${opt(dm.mauSac, 'MauSacID', 'TenMau')}</select></td>
        <td class="col-so"><input class="r-kho" type="number" step="0.01"></td>
        <td class="col-so"><input class="r-gsm" type="number" step="0.01"></td>
        ${/* v5.89: KG KHÔNG bắt buộc — có thể nhập theo KG, theo MÉT, hoặc cả hai (kiểm tra khi Lưu). */''}
        <td class="col-so"><input class="r-kg" type="number" step="0.01" min="0"></td>
        <td class="col-so"><input class="r-met" type="number" step="0.01" min="0"></td>
        <td class="col-so col-gia"><input class="r-gia" type="number" step="0.01" min="0"></td>
        <td class="col-nut"><button type="button" class="btn small danger r-remove" title="Xóa dòng">X</button></td>
      </tr>`;
    }
    const modal = openModal(`
      <h3>Tạo phiếu nhập kho vải (nhiều cây 1 lần)</h3>
      <p style="font-size:13px;color:#5f6368;margin-top:-6px;">Chọn Loại vải + Màu — hệ thống tự tìm hoặc tự tạo mã vải tương ứng, không cần nhớ mã. Mã cây do hệ thống tự sinh khi lưu.</p>
      <form id="nForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày nhập *</label><input type="date" name="ngayNhap" value="${new Date().toISOString().slice(0, 10)}" required></div>
          <div class="form-row"><label>Nhà cung cấp</label><select name="nccId"><option value="">--</option>${opt(dm.nhaCungCap, 'NCC_ID', 'TenNCC')}</select></div>
          <div class="form-row"><label>Số hóa đơn</label><input name="soHoaDon"></div>
          <div class="form-row"><label>Ngày hóa đơn</label><input type="date" name="ngayHoaDon"></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu"></div>
        </div>
        <div class="lap-wrap"><table class="lap-table">${COLS_NHAP}${HEAD_NHAP}
          <tbody id="rollRows">${rowTemplate()}</tbody></table></div>
        <button type="button" class="btn small secondary" id="btnAddRoll">+ Thêm cây vải</button>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancelNhap">Hủy</button>
          <button type="submit" class="btn">Lưu nhập kho</button>
        </div>
      </form>`);

    function wireRemove() {
      modal.querySelectorAll('.r-remove').forEach(btn => btn.onclick = () => {
        if (modal.querySelectorAll('#rollRows > [data-row]').length > 1) btn.closest('[data-row]').remove();
      });
    }
    wireRemove();

    /* v5.78: ĐÃ BỎ toàn bộ phần "nhập kho bằng quét QR" (thêm ở v5.70–v5.73) theo yêu cầu — mã cây
       trở lại CHỈ do hệ thống tự sinh. Quét QR để TRA CỨU cây vẫn còn ở tab "Tồn theo cây" và ở 2
       form Xuất kho (dùng maCayTuQR/timCayTheoMa ở cấp module, KHÔNG xoá mấy hàm đó).
       Route backend `/api/khovai/tracuu-macay` và khả năng nhận `roll.maCay` ở POST /nhap vẫn giữ
       (không còn ai gọi từ form này, nhưng là lớp chặn trùng mã cây — vô hại). */

    // v5.3 (muc 3): luu nhap dang do vao localStorage - khoi phuc lai neu tat/bat lai trinh duyet
    // truoc khi bam Luu (xem saveDraft/loadDraft/clearDraft trong common.js).
    const DRAFT_KEY = 'khovai_nhap';
    function collectDraftNhap() {
      const fd = new FormData(modal.querySelector('#nForm'));
      const rolls = Array.from(modal.querySelectorAll('#rollRows > [data-row]')).map(r => ({
        loaiVaiId: r.querySelector('.r-loai').value, mauSacId: r.querySelector('.r-mau').value,
        khoVaiThucTe: r.querySelector('.r-kho').value, gsm: r.querySelector('.r-gsm').value,
        kgNhap: r.querySelector('.r-kg').value, soMet: r.querySelector('.r-met').value, donGiaNhap: r.querySelector('.r-gia').value
      }));
      return { ngayNhap: fd.get('ngayNhap'), nccId: fd.get('nccId'), soHoaDon: fd.get('soHoaDon'), ngayHoaDon: fd.get('ngayHoaDon'), ghiChu: fd.get('ghiChu'), rolls };
    }
    modal.querySelector('#nForm').addEventListener('input', () => saveDraft(DRAFT_KEY, collectDraftNhap()));

    const draft = loadDraft(DRAFT_KEY);
    if (draft && Array.isArray(draft.rolls) && draft.rolls.length) {
      modal.querySelector('[name="nccId"]').value = draft.nccId || '';
      modal.querySelector('[name="soHoaDon"]').value = draft.soHoaDon || '';
      modal.querySelector('[name="ngayHoaDon"]').value = draft.ngayHoaDon || '';
      modal.querySelector('[name="ghiChu"]').value = draft.ghiChu || '';
      modal.querySelector('#rollRows').innerHTML = draft.rolls.map(() => rowTemplate()).join('');
      modal.querySelectorAll('#rollRows > [data-row]').forEach((r, i) => {
        const d = draft.rolls[i];
        r.querySelector('.r-loai').value = d.loaiVaiId || '';
        r.querySelector('.r-mau').value = d.mauSacId || '';
        r.querySelector('.r-kho').value = d.khoVaiThucTe || '';
        r.querySelector('.r-gsm').value = d.gsm || '';
        r.querySelector('.r-kg').value = d.kgNhap || '';
        r.querySelector('.r-met').value = d.soMet || '';
        r.querySelector('.r-gia').value = d.donGiaNhap || '';
      });
      wireRemove();
      toast('Đã khôi phục dữ liệu nhập kho đang dở từ lần trước (chưa lưu).', 'success');
    }

    modal.querySelector('#btnCancelNhap').addEventListener('click', () => { clearDraft(DRAFT_KEY); closeModal(); });
    modal.querySelector('#btnAddRoll').addEventListener('click', () => {
      modal.querySelector('#rollRows').insertAdjacentHTML('beforeend', rowTemplate());
      wireRemove();
      // v5.80: con trỏ nhảy vào ô ĐẦU TIÊN (Loại vải) của dòng mới — không phải bấm chuột lại.
      focusODauDong(modal.querySelector('#rollRows > [data-row]:last-child'));
    });

    modal.querySelector('#nForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      // v5.82 FIX: từ v5.80 mỗi cây vải là 1 <tr data-row>, KHÔNG còn <div>. Chỗ này còn sót
      // '#rollRows > div' nên gom được 0 dòng -> gửi rolls=[] -> backend trả
      // "Thiếu ngày nhập hoặc danh sách cây vải." dù form đã điền đủ.
      const rolls = Array.from(modal.querySelectorAll('#rollRows > [data-row]')).map(r => ({
        // v5.78: không gửi maCay nữa -> backend tự sinh mã như trước v5.70.
        loaiVaiId: r.querySelector('.r-loai').value, mauSacId: r.querySelector('.r-mau').value,
        khoVaiThucTe: r.querySelector('.r-kho').value || null,
        gsm: r.querySelector('.r-gsm').value || null, kgNhap: r.querySelector('.r-kg').value,
        soMet: r.querySelector('.r-met').value || null,
        donGiaNhap: r.querySelector('.r-gia').value || null
      }));
      if (canhBaoThieuSoLuong(rolls, 'kgNhap', 'soMet', 'KG nhập')) return;   // v5.89
      try {
        const res = await apiPost('/api/khovai/nhap', { ngayNhap: fd.get('ngayNhap'), nccId: fd.get('nccId') || null, soHoaDon: fd.get('soHoaDon'), ngayHoaDon: fd.get('ngayHoaDon') || null, ghiChu: fd.get('ghiChu'), rolls });
        clearDraft(DRAFT_KEY);
        toast('Đã nhập kho.', 'success');
        closeModal();
        await render(container, currentUser); // ve lai danh sach phieu
        openNhapDetailModal(res.data.phieuNhapId); // mo luon phieu vua tao de xem/in
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.0: tab Xuat kho gio la MAN HINH DANH SACH cac phieu da tao (xem/in/sua/xoa theo quyen), nut
  // "+ Tao phieu" mo form nhieu cay nhu truoc nhung trong 1 modal.
  async function renderXuat(perm) {
    const body = document.getElementById('kvBody');
    const rows = await apiGet('/api/khovai/xuat').then(r => r.data);
    body.innerHTML = `
      <div class="toolbar">${perm.canEdit ? '<button class="btn" id="btnAddXuat">+ Tạo phiếu xuất kho</button>' : ''}</div>
      <table><thead><tr><th>Số phiếu</th><th>Ngày xuất</th><th>Mã đơn</th><th>Người nhận</th><th>Số cây</th><th>Tổng KG</th><th>Tổng mét</th><th>Người tạo</th><th style="width:190px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        ${/* v6.57: XK- -> XKV- (Xuất Kho Vải). */''}
        <td>XKV-${String(r.PhieuXuatID).padStart(5, '0')}</td>
        <td>${fmtDate(r.NgayXuat)}</td><td>${escapeHtml(r.MaDH || r.MaDon)}</td><td>${escapeHtml(r.NguoiNhan)}</td>
        <td>${r.SoLuongCay}</td><td>${fmtNumber(r.TongKGXuat)}</td><td>${fmtNumber(r.TongMet)}</td><td>${escapeHtml(r.NguoiTao)}</td>
        <td>
          <button type="button" class="btn small secondary act-view" data-id="${r.PhieuXuatID}">Xem/In</button>
          ${perm.canEdit ? `<button type="button" class="btn small secondary act-edit" data-id="${r.PhieuXuatID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button type="button" class="btn small danger act-del" data-id="${r.PhieuXuatID}">Xóa</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Chưa có phiếu xuất kho nào</td></tr>'}</tbody></table>`;

    if (perm.canEdit) document.getElementById('btnAddXuat').addEventListener('click', () => openXuatCreateModal());
    body.querySelectorAll('.act-view').forEach(btn => btn.addEventListener('click', () => openXuatDetailModal(btn.dataset.id)));
    ganBamDongXemChiTiet(body);   // v6.66.1: bấm cả dòng cũng mở chi tiết
    body.querySelectorAll('.act-edit').forEach(btn => btn.addEventListener('click', () => {
      const row = rows.find(r => String(r.PhieuXuatID) === btn.dataset.id);
      openXuatEditModal(row);
    }));
    body.querySelectorAll('.act-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu xuất này? KG đã xuất trên các cây liên quan sẽ được hoàn lại vào tồn kho.')) return;
      try { await apiDelete('/api/khovai/xuat/' + btn.dataset.id); toast('Đã xóa.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));

    // Cay vai duoc chi dinh san tu tab "Ton theo cay" (nut "Xuat kho") - neu co, mo luon modal tao
    // phieu voi cay do da chon san (giu nguyen trai nghiem cu, du tab Xuat kho gio la man hinh list).
    if (pendingXuatCayId) {
      const cayId = pendingXuatCayId;
      pendingXuatCayId = null;
      if (perm.canEdit) openXuatCreateModal(cayId);
    }
  }

  // v5.4: rebuild dung theo mau_phieu.docx - cot bang them "SL theo chi dinh" (r.SLTheoChiDinh, xem
  // backend GET /xuat/:id) va cot "Ghi chu" (de TRONG - phieu giay danh cho ghi chu tay sau khi in,
  // khong co truong luu rieng trong CSDL), 4 vai ky: Nguoi lap, Bo phan cat, NV chi dinh NPL, Thu kho.
  function printPhieuXuatFromData(header, lines) {
    // v5.7: them Anh san pham (header.AnhSanPham - backend da bo sung join, xem GET /xuat/:id trong
    // khovai.js) - yeu cau v5.7 "thêm Ảnh sản phẩm vào các bản in".
    const anhSpHtml = header.AnhSanPham ? `<img src="${escapeHtml(header.AnhSanPham)}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;float:right;">` : '';
    printHtml('Phiếu xuất kho vải', `
      ${phieuHeaderHtml('PHIẾU XUẤT KHO VẢI', header.NgayXuat, header.PhieuXuatID)}
      ${anhSpHtml}
      ${/* v5.94: + Mã rập (gộp từ sơ đồ của đơn hàng gắn kèm) trên bản in */''}
      <p class="p-meta"><b>Đơn hàng:</b> ${escapeHtml(header.MaDH || header.MaDon || '')}${header.MaRap ? ` &nbsp; <b>Mã rập:</b> ${escapeHtml(header.MaRap)}` : ''}${header.TenSanPham ? ` &nbsp; <b>Tên SP:</b> ${escapeHtml(header.TenSanPham)}` : ''}</p>
      ${header.Chuyen ? `<p class="p-meta"><b>Chuyền:</b> ${escapeHtml(header.Chuyen)}</p>` : ''}
      ${header.NguoiNhan ? `<p class="p-meta"><b>Người nhận:</b> ${escapeHtml(header.NguoiNhan)}</p>` : ''}
      ${header.MucDich ? `<p class="p-meta"><b>Mục đích:</b> ${escapeHtml(header.MucDich)}</p>` : ''}
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã vải</th><th>Loại vải</th><th>Mầu</th><th>Kiểu</th><th>Mã cây</th><th>Khổ vải</th><th>Kg chỉ định</th><th>SL xuất thực tế</th><th>Số mét</th><th>Ghi chú</th></tr></thead>
      ${/* v5.93: + dòng TỔNG CỘNG (kg xuất thực tế / số mét) ở cuối bảng */''}
      <tbody>${lines.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.MaVai)}</td><td>${escapeHtml(r.TenLoaiVai)}</td><td>${escapeHtml(r.TenMau)}</td><td>${escapeHtml(r.KieuVai || 'Chính')}</td><td>${escapeHtml(r.MaCay)}</td><td>${fmtNumber(r.KhoVaiThucTe)}</td><td>${r.SLTheoChiDinh != null ? fmtNumber(r.SLTheoChiDinh) : ''}</td><td>${fmtNumber(r.KGXuat)}</td><td>${r.SoMet != null ? fmtNumber(r.SoMet) : ''}</td><td></td></tr>`).join('')}
        ${dongTongKgMet(lines, 'KGXuat', 'SoMet', 8, 1)}</tbody></table>
      <div class="p-sign"><div><div class="line">Người lập</div></div><div><div class="line">Bộ phận cắt</div></div><div><div class="line">NV chỉ định NPL</div></div><div><div class="line">Thủ kho</div></div></div>`);
  }

  async function openXuatDetailModal(phieuXuatId) {
    const res = await apiGet('/api/khovai/xuat/' + phieuXuatId);
    const { header, lines } = res.data;
    const modal = openModal(`
      <h3>Phiếu xuất kho #${header.PhieuXuatID}</h3>
      <p class="p-meta"><b>Ngày xuất:</b> ${fmtDate(header.NgayXuat)} &nbsp; <b>Mã đơn:</b> ${escapeHtml(header.MaDH || header.MaDon || '')}${header.MaRap ? ` &nbsp; <b>Mã rập:</b> ${escapeHtml(header.MaRap)}` : ''} &nbsp; <b>Chuyền:</b> ${escapeHtml(header.Chuyen || '')}</p>
      <p class="p-meta"><b>Người nhận:</b> ${escapeHtml(header.NguoiNhan || '')} &nbsp; <b>Mục đích:</b> ${escapeHtml(header.MucDich || '')}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      <table><thead><tr><th style="width:38px;">STT</th><th>Kiểu</th><th>Mã cây</th><th>Loại vải</th><th>Màu</th><th>KG xuất</th><th>Số mét</th></tr></thead>
      ${/* v6.13: Mã cây bấm được -> xem lịch sử nhập/xuất của chính cây đó (modal xếp chồng). */''}
      <tbody>${lines.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.KieuVai || 'Chính')}</td><td>${maCayLinkHtml(r)}</td><td>${escapeHtml(r.TenLoaiVai)}</td><td>${escapeHtml(r.TenMau)}</td><td>${fmtNumber(r.KGXuat)}</td><td>${r.SoMet != null ? fmtNumber(r.SoMet) : ''}</td></tr>`).join('')}
        ${dongTongKgMet(lines, 'KGXuat', 'SoMet', 5, 0)}</tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnCloseXuatView">Đóng</button>
        ${coQuyenSuaKhoVai() ? '<button type="button" class="btn secondary" id="btnSuaXuatView">✏️ Sửa phiếu</button>' : ''}
        <button type="button" class="btn" id="btnPrintXuatView">🖨️ In phiếu</button>
      </div>`);
    modal.querySelector('#btnCloseXuatView').addEventListener('click', closeModal);
    wireMaCayLink(modal);   // v6.13
    const bSuaX = modal.querySelector('#btnSuaXuatView');
    if (bSuaX) bSuaX.addEventListener('click', () => openXuatEditModal(header));
    modal.querySelector('#btnPrintXuatView').addEventListener('click', () => printPhieuXuatFromData(header, lines));
  }

  // v5.3 (muc 3): sua DAY DU phieu xuat (truoc chi sua dau phieu). Danh sach cay chon = cay con ton
  // (KGCon>0 noi chung) HOP VOI chinh cac cay dang dung trong phieu nay (tinh lai "con lai NEU BO QUA
  // phieu nay" = KGNhap-OtherXuat, vi vw_TonCayVai da tru ca xuat cua chinh phieu dang sua, se thap
  // hon thuc te neu dung thang so lieu do). Backend se kiem tra lai chinh xac truoc khi ghi.
  async function openXuatEditModal(row) {
    const [detailRes, rollsRes] = await Promise.all([
      apiGet('/api/khovai/xuat/' + row.PhieuXuatID),
      apiGet('/api/khovai/rolls?available=true')
    ]);
    const { lines } = detailRes.data;
    const rollMap = {};
    rollsRes.data.forEach(r => { rollMap[r.CayID] = r; });
    lines.forEach(l => {
      // v5.7: giu lai (...existing) cac truong da co tu rollsRes (vd ViTriKho, NgayNhap - xem
      // labelForRoll ben duoi) truoc khi de dong nay GHI DE - truoc day ghi de bang 1 object RUT GON
      // (chi CayID/MaCay/TenLoaiVai/TenMau/KGCon) lam MAT cac truong khac cho NHUNG cay DA CO trong
      // phieu (cay khong con "available" o noi khac van co the da ton tai tu rollsRes truoc do). Neu
      // cay nay KHONG co san trong rollsRes (vd da het o noi khac), existing rong - labelForRoll ben
      // duoi van an toan vi cac truong ViTriKho/NgayNhap la tuy chon (optional chaining ngam qua ||'').
      const existing = rollMap[l.CayID] || {};
      rollMap[l.CayID] = {
        ...existing,
        CayID: l.CayID, MaCay: l.MaCay, TenLoaiVai: l.TenLoaiVai, TenMau: l.TenMau,
        ViTriKho: l.ViTriKho ?? existing.ViTriKho, NgayNhap: l.NgayNhap ?? existing.NgayNhap,
        KGCon: Math.round((Number(l.KGNhap) - Number(l.OtherXuat)) * 100) / 100
      };
    });
    const currentRolls = Object.values(rollMap);
    // v5.7: bo sung Vi tri kho + Ngay nhap vao nhan hien thi - yeu cau v5.7 "ô tìm kiếm mã cây... hiển
    // thị đầy đủ thông tin cây vải".
    // v5.8: danh sach goi y gio la dropdown TU DUNG (.ss-dropdown, xem common.js/style.css) thay cho
    // <datalist> nguyen sinh - hien THAY DAY DU nhan nay (tu xuong dong neu dai, khong con bi trinh
    // duyet tu cat bot chu) dung yeu cau v5.8 "mã cây search dropdown hiển thị đầy đủ thông tin" (xem
    // xuatvai.png). Ham labelForRoll() ban than khong doi.
    function labelForRoll(r) {
      const kho = (r.KhoVai != null && r.KhoVai !== '') ? `, khổ ${fmtNumber(r.KhoVai)}` : '';
      const met = (r.SoMet != null && r.SoMet !== '') ? `, ${fmtNumber(r.SoMet)} m` : '';
      const viTri = r.ViTriKho ? `, vị trí ${r.ViTriKho}` : '';
      const ngay = r.NgayNhap ? `, nhập ${new Date(r.NgayNhap).toLocaleDateString('vi-VN')}` : '';
      return `${r.MaCay} — ${r.TenLoaiVai || ''} ${r.TenMau || ''} — còn ${fmtNumber(r.KGCon)} KG${kho}${met}${viTri}${ngay}`;
    }

    let rowCount = 0;
    // v5.80: bảng thật, cùng bố cục với form Tạo phiếu xuất.
    const COLS_XUAT_SUA = `<colgroup>
      <col style="width:11%"><col style="width:52%"><col style="width:11%"><col style="width:11%">
      <col style="width:90px"><col style="width:42px">
    </colgroup>`;
    const HEAD_XUAT_SUA = `<thead><tr>
      <th>Kiểu</th><th>Mã cây</th><th>KG xuất</th><th>Số mét</th><th></th><th></th>
    </tr></thead>`;
    function rowTemplate(line) {
      rowCount++;
      const idx = rowCount;
      const preselect = line ? line.CayID : null;
      const kieu = line && line.KieuVai === 'Phối' ? 'Phối' : 'Chính';   // v5.31
      return `<tr data-row data-idx="${idx}" data-lineid="${line ? line.ID : ''}">
        <td><select class="xe-kieu"><option value="Chính"${kieu === 'Chính' ? ' selected' : ''}>Chính</option><option value="Phối"${kieu === 'Phối' ? ' selected' : ''}>Phối</option></select></td>
        <td>${searchableSelectHtml('xecay_' + idx, currentRolls, 'CayID', labelForRoll, preselect)}</td>
        ${/* v5.89: KG KHÔNG bắt buộc — xuất theo KG hoặc theo MÉT hoặc cả hai (kiểm tra khi Lưu). */''}
        <td class="col-so"><input class="xe-kg" type="number" step="0.01" min="0" value="${line ? line.KGXuat : ''}"></td>
        <td class="col-so"><input class="xe-met" type="number" step="0.01" min="0" value="${line && line.SoMet != null ? line.SoMet : ''}"></td>
        <td class="col-nut"><button type="button" class="btn small secondary xe-qr" title="Quét QR chọn cây">📷 QR</button></td>
        <td class="col-nut"><button type="button" class="btn small danger xe-remove" title="Xóa dòng">X</button></td>
      </tr>`;
    }

    /* v5.64: CHO PHÉP GÁN / ĐỔI / GỠ LỆNH SẢN XUẤT ngay trong form Sửa phiếu xuất.
       Trước đây phiếu xuất tự do (không gắn đơn) lỡ tạo rồi thì phải XÓA phiếu và xuất lại mới gắn
       được đơn — nay chọn thẳng ở đây. Danh sách lệnh SX lấy từ QLSX; lỗi tải danh sách KHÔNG được
       chặn việc sửa phiếu (vẫn sửa được các phần khác). */
    // Dùng /api/khovai/orders (KHÔNG dùng /api/qlsx/orders): cùng quyền KHOVAI với màn này — người
    // làm kho vải thường KHÔNG có quyền QLSX, gọi nhầm sẽ bị 403 và danh sách rỗng.
    let dsDonHang = [];
    try { dsDonHang = (await apiGet('/api/khovai/orders')).data || []; } catch (e) { dsDonHang = []; }
    const donHienTai = row.DonHangID != null ? String(row.DonHangID) : '';
    const optDon = ['<option value="">— Không gắn đơn (xuất tự do) —</option>']
      .concat(dsDonHang.map(d => `<option value="${d.DonHangID}"${String(d.DonHangID) === donHienTai ? ' selected' : ''}>${escapeHtml(d.MaDH)}${d.TenSanPham ? ' — ' + escapeHtml(d.TenSanPham) : ''}</option>`))
      .join('');
    // Đơn hiện tại có thể KHÔNG nằm trong danh sách trả về (vd đơn đã hoàn thành/bị lọc) -> thêm thủ công để không bị mất liên kết khi lưu.
    const thieuDonHienTai = donHienTai && !dsDonHang.some(d => String(d.DonHangID) === donHienTai);

    const html = `
      <h3>Sửa phiếu xuất #${row.PhieuXuatID}</h3>
      <p style="font-size:13px;color:#5f6368;margin-top:-6px;">Hệ thống sẽ kiểm tra lại tồn kho trước khi lưu.</p>
      <form id="xEditForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày xuất *</label><input type="date" name="ngayXuat" value="${new Date(row.NgayXuat).toISOString().slice(0, 10)}" required></div>
          <div class="form-row"><label>Người nhận</label><input name="nguoiNhan" value="${escapeHtml(row.NguoiNhan || '')}"></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu" value="${escapeHtml(row.GhiChu || '')}"></div>
        </div>
        <div class="form-row"><label>Lệnh sản xuất (gắn đơn cho phiếu xuất tự do)</label>
          <select id="xeDonHang">${thieuDonHienTai ? `<option value="${escapeHtml(donHienTai)}" selected>${escapeHtml(row.MaDH || row.MaDon || ('Đơn #' + donHienTai))} (đang gắn)</option>` : ''}${optDon}</select>
          <div style="font-size:11px;color:#5f6368;">Chọn để gắn đơn cho phiếu đã xuất tự do; chọn "Không gắn đơn" để gỡ. Sau khi gắn, các cây vải của phiếu này sẽ hiện ở công đoạn Cắt của đơn đó.</div>
        </div>
        <div class="lap-wrap"><table class="lap-table">${COLS_XUAT_SUA}${HEAD_XUAT_SUA}
          <tbody id="xeRows">${lines.map(rowTemplate).join('') || rowTemplate(null)}</tbody></table></div>
        <button type="button" class="btn small secondary" id="btnAddXe">+ Thêm cây vải</button>
        <button type="button" class="btn small secondary" id="btnQrXe">📷 Quét QR liên tục</button>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);

    function wireRow(rowEl) {
      const idx = rowEl.dataset.idx;
      wireSearchableSelect('xecay_' + idx, currentRolls, 'CayID', labelForRoll);
      rowEl.querySelector('.xe-remove').onclick = () => {
        if (modal.querySelectorAll('#xeRows > [data-row]').length > 1) rowEl.remove();
        else toast('Phiếu phải còn ít nhất 1 dòng.', 'error');
      };
      rowEl.querySelector('.xe-qr').onclick = () => {
        openQrScanner(text => {
          const found = timCayTheoMa(currentRolls, text);   // v5.76
          if (!found) { baoLoiQuetCay(text); return; }
          modal.querySelector('#xecay_' + idx + '_text').value = labelForRoll(found);
          modal.querySelector('#xecay_' + idx + '_val').value = found.CayID;
        });
      };
    }
    modal.querySelectorAll('#xeRows [data-row]').forEach(wireRow);
    modal.querySelector('#btnAddXe').addEventListener('click', () => {
      modal.querySelector('#xeRows').insertAdjacentHTML('beforeend', rowTemplate(null));
      const moi = modal.querySelector('#xeRows [data-row]:last-child');
      wireRow(moi);
      focusODauDong(moi);   // v5.80
    });
    // v5.12 (yeu cau "quét QR liên tục tự thêm cây tìm thấy"): quet lien tuc TU DONG THEM 1 dong moi cho
    // MOI cay tim thay - khac nut "Quét QR" tren tung dong (.xe-qr trong wireRow() o tren, giu nguyen
    // khong doi) CHI dien vao dong DANG co san, dung de sua/dien 1 dong don le. Bo qua neu cay do DA co
    // san trong danh sach (so getSearchableValue() cua het cac dong hien tai) de tranh them trung 1 cay
    // nhieu lan neu vo tinh quet lai (vd giu QR lau trong khung hinh, dua ra roi dua vao lai).
    modal.querySelector('#btnQrXe').addEventListener('click', () => {
      openQrScanner((text) => {
        const found = timCayTheoMa(currentRolls, text);   // v5.76
        if (!found) { baoLoiQuetCay(text); return; }
        const usedIds = Array.from(modal.querySelectorAll('#xeRows > [data-row]')).map(r => getSearchableValue('xecay_' + r.dataset.idx));
        if (usedIds.includes(String(found.CayID))) { toast('Cây ' + found.MaCay + ' đã có trong danh sách.', 'error'); return; }
        modal.querySelector('#xeRows').insertAdjacentHTML('beforeend', rowTemplate({ CayID: found.CayID, ID: '', KGXuat: '' }));
        wireRow(modal.querySelector('#xeRows [data-row]:last-child'));
        toast('Đã thêm cây ' + found.MaCay + '.', 'success');
      }, { continuous: true });
    });

    modal.querySelector('#xEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const editLines = Array.from(modal.querySelectorAll('#xeRows > [data-row]')).map(r => ({
        id: r.dataset.lineid || null,
        cayId: getSearchableValue('xecay_' + r.dataset.idx),
        kgXuat: r.querySelector('.xe-kg').value,
        soMet: r.querySelector('.xe-met').value || null,
        kieuVai: r.querySelector('.xe-kieu') ? r.querySelector('.xe-kieu').value : 'Chính'   // v5.31
      }));
      if (canhBaoThieuSoLuong(editLines.filter(l => l.cayId), 'kgXuat', 'soMet', 'KG xuất')) return;   // v5.89
      try {
        const selDon = modal.querySelector('#xeDonHang');
        await apiPut('/api/khovai/xuat/' + row.PhieuXuatID, {
          ngayXuat: fd.get('ngayXuat'), chuyen: fd.get('chuyen'), nguoiNhan: fd.get('nguoiNhan'),
          mucDich: fd.get('mucDich'), ghiChu: fd.get('ghiChu'), lines: editLines,
          donHangId: selDon ? (selDon.value || null) : undefined   // v5.64: gán/đổi/gỡ lệnh SX
        });
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* v5.69: `preselectMaDH` — mở form với ĐƠN HÀNG chọn sẵn. Dùng cho nút "📦 Xuất kho theo chỉ định"
     ở Quản lý sản xuất > Chỉ định vải SX (thủ kho không phải tự tìm lại đơn trong danh sách dài). */
  async function openXuatCreateModal(preselectCayId, preselectMaDH) {
    const [rollsRes, ordersRes] = await Promise.all([apiGet('/api/khovai/rolls?available=true'), apiGet('/api/khovai/orders')]);
    const availableRolls = rollsRes.data;
    const orders = ordersRes.data;
    let currentRolls = availableRolls; // danh sach cay dang cho phep chon trong cac dong (doi khi chon/bo don hang)
    let rowCount = 0;

    // v5.0: khi xuat gan don hang, danh sach cay chi gom nhung cay da duoc "Giao vai san xuat" cho don
    // do (xem backend /orders/:id/vaichophep) - KGGiaoTam la so KG da giao tam truoc do, hien kem de
    // thu kho doi chieu voi so thuc te dinh xuat.
    // v5.3 (muc 3): them Loai vai + Mau vao nhan hien thi (truoc chi co Ma cay + KG con) - ap dung ca
    // vai chinh lan vai phoi vi danh sach cay khong loc theo Kieu (Chinh/Phoi) khi khong gan don hang.
    // v5.7: bo sung Vi tri kho + Ngay nhap (da co san tren object tu vw_TonCayVai, xem GET /rolls va
    // /orders/:id/vaichophep o backend - chi chua dung trong nhan hien thi) - yeu cau v5.7 "ô tìm kiếm
    // mã cây... hiển thị đầy đủ thông tin cây vải".
    // v5.8: day chinh la o "Tạo phiếu xuất kho vải" bi cat bot chu trong anh chup nguoi dung gui kem yeu
    // cau v5.8 (xuatvai.png) - goc do la <datalist> nguyen sinh cua trinh duyet tu cat chu, KHONG phai do
    // labelForRoll() thieu thong tin (nhan o day da day du tu v5.7). Da fix bang dropdown tu dung
    // (.ss-dropdown, xem common.js/style.css) thay cho <datalist> - khong doi gi o labelForRoll() nay.
    function labelForRoll(r) {
      const giaoTam = r.KGGiaoTam != null ? ` (đã giao tạm ${fmtNumber(r.KGGiaoTam)} KG)` : '';
      const kho = (r.KhoVai != null && r.KhoVai !== '') ? `, khổ ${fmtNumber(r.KhoVai)}` : '';
      const met = (r.SoMet != null && r.SoMet !== '') ? `, ${fmtNumber(r.SoMet)} m` : '';
      const viTri = r.ViTriKho ? `, vị trí ${r.ViTriKho}` : '';
      const ngay = r.NgayNhap ? `, nhập ${new Date(r.NgayNhap).toLocaleDateString('vi-VN')}` : '';
      return `${r.MaCay} — ${r.TenLoaiVai || ''} ${r.TenMau || ''} — còn ${fmtNumber(r.KGCon)} KG${kho}${met}${viTri}${ngay}${giaoTam}`;
    }

    /* v5.80: bảng thật — Mã cây là cột RỘNG NHẤT (nhãn dài: mã + loại vải + màu + KG còn + vị trí). */
    const COLS_XUAT = `<colgroup>
      <col style="width:11%"><col style="width:52%"><col style="width:11%"><col style="width:11%">
      <col style="width:90px"><col style="width:42px">
    </colgroup>`;
    const HEAD_XUAT = `<thead><tr>
      <th>Kiểu</th><th>Mã cây</th><th>KG xuất</th><th>Số mét</th><th></th><th></th>
    </tr></thead>`;
    function rowTemplate(preselect) {
      rowCount++;
      const idx = rowCount;
      return `<tr data-row data-idx="${idx}">
        <td><select class="x-kieu"><option value="Chính">Chính</option><option value="Phối">Phối</option></select></td>
        <td>${searchableSelectHtml('xcay_' + idx, currentRolls, 'CayID', labelForRoll, preselect)}</td>
        ${/* v5.89: KG KHÔNG bắt buộc — xuất theo KG hoặc theo MÉT hoặc cả hai (kiểm tra khi Lưu). */''}
        <td class="col-so"><input class="x-kg" type="number" step="0.01" min="0"></td>
        <td class="col-so"><input class="x-met" type="number" step="0.01" min="0"></td>
        <td class="col-nut"><button type="button" class="btn small secondary x-qr" title="Quét QR chọn cây">📷 QR</button></td>
        <td class="col-nut"><button type="button" class="btn small danger x-remove" title="Xóa dòng">X</button></td>
      </tr>`;   // v5.31: them cot Kiểu (Chính/Phối)
    }

    function rowsBodyHtml(usePreselect) {
      if (!currentRolls.length) return '';
      return rowTemplate(usePreselect ? preselectCayId : null);
    }

    const modal = openModal(`
      <h3>Tạo phiếu xuất kho vải (nhiều cây 1 lần)</h3>
      <form id="xForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày xuất *</label><input type="date" name="ngayXuat" value="${new Date().toISOString().slice(0, 10)}" required></div>
          <div class="form-row"><label>Đơn hàng sản xuất</label>
            <select name="donHangId" id="xOrderSelect">
              <option value="">-- Xuất tự do (không gắn đơn hàng) --</option>
              ${orders.map(o => `<option value="${o.DonHangID}">${escapeHtml(o.MaDH + ' - ' + o.TenSanPham)}</option>`).join('')}
            </select>
          </div>
          ${/* v5.76: đổi "Mã đơn hàng" -> "MÃ RẬP" (tự điền theo đơn đã chọn, chỉ xem). Mã đơn hàng đã
                hiện ở ô trên nên không cần nhập lại; mã rập mới là thứ bộ phận cắt cần đối chiếu.
                Cột PhieuXuatVai.MaDon vẫn LƯU mã đơn hàng như cũ (không đổi ý nghĩa dữ liệu cũ) — xem
                lúc submit ở dưới. */''}
          <div class="form-row"><label>Mã rập</label><input id="xMaRap" readonly placeholder="tự điền theo đơn hàng"></div>
          <div class="form-row"><label>Người nhận</label><input name="nguoiNhan"></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu"></div>
          ${/* v6.66: TRẢ HÀNG VỀ NHÀ CUNG CẤP. Tích ô này thì phiếu xuất GIẢM công nợ phải trả cho NCC
                (congno.js: congNoNCC + soChiTietNCC). Đơn giá KHÔNG phải gõ — hệ thống lấy đúng
                VaiCay.DonGiaNhap của từng cây, nên số giảm nợ luôn khớp số đã ghi nợ lúc nhập. */''}
          <div class="form-row">
            <label style="display:flex;gap:6px;align-items:center;">
              <input type="checkbox" id="xTraNCC" name="laTraNCC"> Trả nhà cung cấp
            </label>
          </div>
          <div class="form-row" id="xNccWrap" style="display:none;">
            <label>Nhà cung cấp nhận lại <span style="color:#c62828;">*</span></label>
            <select name="nccId" id="xNccId"><option value="">-- Chọn nhà cung cấp --</option>${opt(dm.nhaCungCap, 'NCC_ID', 'TenNCC')}</select>
          </div>
          ${/* v6.66.4: chọn NCC -> chỉ ra PHIẾU NHẬP của chính NCC đó; chọn phiếu nhập -> danh sách cây
                vải bên dưới chỉ còn cây của phiếu đó. Trả hàng là trả đúng lô đã nhập. */''}
          <div class="form-row" id="xNhapWrap" style="display:none;">
            <label>Phiếu nhập của NCC <span style="color:#c62828;">*</span></label>
            <select id="xPhieuNhapId"><option value="">-- Chọn nhà cung cấp trước --</option></select>
          </div>
        </div>
        <div class="empty-hint" id="xTraNCCHint" style="display:none;color:#e65100;">
          Chỉ chọn được cây vải thuộc phiếu nhập đã chọn. Phiếu này sẽ <b>giảm công nợ phải trả</b> cho
          nhà cung cấp, tính theo <b>đơn giá nhập của từng cây</b> — không phải gõ giá.
        </div>
        <!-- v5.19 (muc 3.1, yeu cau "nếu theo đơn hàng thì hiển thị tổng số lượng theo chỉ định vải SX
             để tham khảo xuất hàng"): chi THAM KHAO (khong chan/khoa gi) - xem applyOrderFilter(). -->
        <div id="xChiDinhInfo"></div>
        <div class="lap-wrap"><table class="lap-table">${COLS_XUAT}${HEAD_XUAT}
          <tbody id="xRows">${rowsBodyHtml(true)}</tbody></table></div>
        <div class="empty-hint" id="xEmptyHint" style="${currentRolls.length ? 'display:none;' : ''}">Không còn cây vải nào trong kho để xuất</div>
        <button type="button" class="btn small secondary" id="btnAddX" style="${currentRolls.length ? '' : 'display:none;'}">+ Thêm cây vải</button>
        <button type="button" class="btn small secondary" id="btnQrX" style="${currentRolls.length ? '' : 'display:none;'}">📷 Quét QR liên tục</button>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancelXuat">Hủy</button>
          <button type="submit" class="btn" id="btnSubmitX" style="${currentRolls.length ? '' : 'display:none;'}">Lưu xuất kho</button>
        </div>
      </form>`);
    modal.querySelector('#btnCancelXuat').addEventListener('click', closeModal);

    function wireRow(rowEl) {
      const idx = rowEl.dataset.idx;
      wireSearchableSelect('xcay_' + idx, currentRolls, 'CayID', labelForRoll);
      const removeBtn = rowEl.querySelector('.x-remove');
      if (removeBtn) removeBtn.onclick = () => {
        if (modal.querySelectorAll('#xRows > [data-row]').length > 1) rowEl.remove();
      };
      const qrBtn = rowEl.querySelector('.x-qr');
      if (qrBtn) qrBtn.onclick = () => {
        openQrScanner(text => {
          const found = timCayTheoMa(currentRolls, text);   // v5.76: so khớp đã chuẩn hoá
          if (!found) { baoLoiQuetCay(text); return; }      // tra cứu để báo ĐÚNG nguyên nhân
          modal.querySelector('#xcay_' + idx + '_text').value = labelForRoll(found);
          modal.querySelector('#xcay_' + idx + '_val').value = found.CayID;
        });
      };
    }
    function wireAllRows() {
      modal.querySelectorAll('#xRows [data-row]').forEach(wireRow);
    }
    wireAllRows();

    modal.querySelector('#btnAddX').addEventListener('click', () => {
      modal.querySelector('#xRows').insertAdjacentHTML('beforeend', rowTemplate());
      const moi = modal.querySelector('#xRows [data-row]:last-child');
      wireRow(moi);
      focusODauDong(moi);   // v5.80: con trỏ vào ô đầu tiên của dòng mới
    });
    // v5.12 (yeu cau "quét QR liên tục tự thêm cây tìm thấy"): giong het logic o openXuatEditModal - xem
    // ghi chu chi tiet o do. Tim trong currentRolls (DA loc dung theo don hang dang chon, neu co) nen tu
    // dong gioi han dung pham vi cho phep giong nut "Quét QR" tung dong (.x-qr trong wireRow(), khong doi).
    modal.querySelector('#btnQrX').addEventListener('click', () => {
      openQrScanner((text) => {
        const found = timCayTheoMa(currentRolls, text);   // v5.76
        if (!found) { baoLoiQuetCay(text); return; }
        const usedIds = Array.from(modal.querySelectorAll('#xRows > [data-row]')).map(r => getSearchableValue('xcay_' + r.dataset.idx));
        if (usedIds.includes(String(found.CayID))) { toast('Cây ' + found.MaCay + ' đã có trong danh sách.', 'error'); return; }
        modal.querySelector('#xRows').insertAdjacentHTML('beforeend', rowTemplate(found.CayID));
        wireRow(modal.querySelector('#xRows [data-row]:last-child'));
        toast('Đã thêm cây ' + found.MaCay + '.', 'success');
      }, { continuous: true });
    });

    // Tach rieng thanh ham dat ten de dung lai duoc khi KHOI PHUC DRAFT (muc duoi) - giu nguyen y
    // het logic cu cua listener 'change', chi khac la co the goi truc tiep voi 1 gia tri donHangId cho san.
    async function applyOrderFilter(donHangId, keepRows) {
      const maRapInput = modal.querySelector('#xMaRap');       // v5.76: trước là #xMaDon (Mã đơn hàng)
      const chiDinhInfoEl = modal.querySelector('#xChiDinhInfo');
      if (donHangId) {
        const order = orders.find(o => String(o.DonHangID) === donHangId);
        maRapInput.value = (order && order.MaRap) ? order.MaRap : '';   // đơn chưa có sơ đồ -> để trống
        try {
          const res = await apiGet('/api/khovai/orders/' + donHangId + '/vaichophep');
          currentRolls = res.data.cayChoPhep;
          const cd = res.data.chiDinhVaiSX || {};
          const theoMau = res.data.chiDinhTheoMau || [];
          const coChiDinh = (Number(cd.TongKGYeuCauChinh) || 0) > 0 || (Number(cd.TongKGYeuCauPhoi) || 0) > 0;
          // v5.21 (yeu cau muc 6, "Hiển thị số lượng chỉ định từng mầu trong phần tạo phiếu xuất kho"):
          // bo sung bang chi tiet TUNG MAU (LoaiVai+MauSac) ben duoi dong tong Chinh/Phoi cu - lay tu
          // GET /orders/:donHangId/vaichophep (chiDinhTheoMau, xem backend/routes/khovai.js).
          const theoMauRows = theoMau.map(r => {
            const con = (Number(r.SoKGYeuCau) || 0) - (Number(r.KGDaXuat) || 0);
            return `<tr>
              <td>${escapeHtml(r.Kieu || '')}</td>
              <td>${escapeHtml(r.TenLoaiVai || '')}</td>
              <td>${escapeHtml(r.TenMau || '')}</td>
              <td style="text-align:right;">${fmtNumber(r.SoKGYeuCau)} (${escapeHtml(r.DVTVaiYeuCau || 'kg')})</td>
              <td style="text-align:right;">${r.SoMet != null ? fmtNumber(r.SoMet) : ''}</td>
              <td style="text-align:right;">${fmtNumber(r.KGDaXuat)}</td>
              <td style="text-align:right;${con < 0 ? 'color:#c0392b;font-weight:600;' : ''}">${fmtNumber(con)}</td>
            </tr>`;
          }).join('');
          chiDinhInfoEl.innerHTML = coChiDinh ? `
            <div class="form-row" style="background:#f4f7fb;border:1px solid #dce3ea;border-radius:4px;padding:8px 10px;margin-bottom:8px;font-size:13px;">
              <b>Chỉ định vải SX (tham khảo):</b>
              Vải chính yêu cầu ${fmtNumber(cd.TongKGYeuCauChinh)} kg${(Number(cd.TongMetChinh) || 0) ? ' / ' + fmtNumber(cd.TongMetChinh) + ' m' : ''} &nbsp;|&nbsp; Vải phối yêu cầu ${fmtNumber(cd.TongKGYeuCauPhoi)} kg${(Number(cd.TongMetPhoi) || 0) ? ' / ' + fmtNumber(cd.TongMetPhoi) + ' m' : ''}
              &nbsp;|&nbsp; Đã xuất cho đơn này: ${fmtNumber(cd.TongKGDaXuat)} kg
              ${theoMauRows ? `
              <table style="width:100%;margin-top:6px;border-collapse:collapse;">
                <thead><tr style="border-bottom:1px solid #dce3ea;">
                  <th style="text-align:left;padding:2px 4px;">Kiểu</th>
                  <th style="text-align:left;padding:2px 4px;">Loại vải</th>
                  <th style="text-align:left;padding:2px 4px;">Màu</th>
                  <th style="text-align:right;padding:2px 4px;">SL chỉ định</th>
                  <th style="text-align:right;padding:2px 4px;">Mét chỉ định</th>
                  <th style="text-align:right;padding:2px 4px;">KG đã xuất</th>
                  <th style="text-align:right;padding:2px 4px;">Còn lại</th>
                </tr></thead>
                <tbody>${theoMauRows}</tbody>
              </table>` : ''}
            </div>` : '';
        } catch (err) { toast(err.message, 'error'); currentRolls = []; chiDinhInfoEl.innerHTML = ''; }
      } else {
        maRapInput.value = '';
        currentRolls = availableRolls;
        chiDinhInfoEl.innerHTML = '';
      }
      if (!keepRows) modal.querySelector('#xRows').innerHTML = rowsBodyHtml(false);
      const emptyHint = modal.querySelector('#xEmptyHint');
      // v5.20 (muc 4/4.1, "Bỏ hẳn công đoạn giao vải, Lấy thông tin vải từ Chỉ định vải sx"): cong doan
      // "Giao vải" (GV) da bi loai khoi luong Ghi nhan tien do tu v5.18 va nay khong con la nguon du
      // lieu cho man hinh nay nua (xem GET /orders/:donHangId/vaichophep trong khovai.js) - thong bao cu
      // nhac den cong doan do da LOI THOI, doi sang huong dan dung "Chỉ định vải SX"/Cấu trúc vải.
      emptyHint.textContent = donHangId
        ? 'Không tìm thấy cây vải tồn kho phù hợp với Cấu trúc vải (Loại vải/Màu) đã khai báo cho đơn hàng này — kiểm tra lại Cấu trúc vải ở Ra lệnh sản xuất (Quản lý sản xuất) hoặc tồn kho vải hiện tại, sau đó thử lại.'
        : 'Không còn cây vải nào trong kho để xuất';
      emptyHint.style.display = currentRolls.length ? 'none' : '';
      modal.querySelector('#btnAddX').style.display = currentRolls.length ? '' : 'none';
      modal.querySelector('#btnQrX').style.display = currentRolls.length ? '' : 'none';
      modal.querySelector('#btnSubmitX').style.display = currentRolls.length ? '' : 'none';
      if (!keepRows) wireAllRows();
    }
    modal.querySelector('#xOrderSelect').addEventListener('change', (e) => applyOrderFilter(e.target.value, false));

    /* v6.66.4: vẽ lại các dòng chọn cây theo `currentRolls` hiện tại — dùng khi lọc theo PHIẾU NHẬP
       của NCC (trả hàng). Tách hàm riêng thay vì gọi applyOrderFilter(): hàm đó gắn với ĐƠN HÀNG
       SẢN XUẤT, mượn nó sẽ kéo theo cả phần chỉ định vải và thông báo không liên quan. */
    function veLaiDongTheoRolls() {
      const rowsEl = modal.querySelector('#xRows');
      if (!rowsEl) return;
      rowCount = 0;
      rowsEl.innerHTML = rowsBodyHtml(false);
      const co = currentRolls.length > 0;
      const hint = modal.querySelector('#xEmptyHint');
      if (hint) {
        hint.textContent = modal.querySelector('#xTraNCC') && modal.querySelector('#xTraNCC').checked
          ? 'Chọn nhà cung cấp và phiếu nhập để hiện các cây vải trả lại được.'
          : 'Không còn cây vải nào trong kho để xuất';
        hint.style.display = co ? 'none' : '';
      }
      ['#btnAddX', '#btnQrX', '#btnSubmitX'].forEach(s => {
        const e = modal.querySelector(s); if (e) e.style.display = co ? '' : 'none';
      });
      wireAllRows();
    }

    // v5.3 (muc 3): luu nhap dang do vao localStorage - khoi phuc lai neu tat/bat lai trinh duyet
    // truoc khi bam Luu (xem saveDraft/loadDraft/clearDraft trong common.js). Rieng man hinh nay lay
    // ca "text" hien thi cua o tim cay (khong chi ID) de dien lai dung nhu nguoi dung da go.
    const DRAFT_KEY = 'khovai_xuat';
    function collectDraftXuat() {
      const fd = new FormData(modal.querySelector('#xForm'));
      const rows = Array.from(modal.querySelectorAll('#xRows > [data-row]')).map(r => ({
        cayText: modal.querySelector('#xcay_' + r.dataset.idx + '_text').value,
        cayId: getSearchableValue('xcay_' + r.dataset.idx),
        kgXuat: r.querySelector('.x-kg').value,
        soMet: r.querySelector('.x-met').value
      }));
      return {
        ngayXuat: fd.get('ngayXuat'), donHangId: fd.get('donHangId'),   // v5.76: bỏ maDon (ô đó nay là Mã rập, chỉ xem)
        chuyen: fd.get('chuyen'), nguoiNhan: fd.get('nguoiNhan'), mucDich: fd.get('mucDich'), ghiChu: fd.get('ghiChu'),
        rows
      };
    }
    modal.querySelector('#xForm').addEventListener('input', () => saveDraft(DRAFT_KEY, collectDraftXuat()));

    (async () => {
      /* v5.69: mở từ "Chỉ định vải SX" -> chọn sẵn đơn hàng và BỎ QUA khôi phục nháp.
         (Nháp cũ có thể của đơn KHÁC — khôi phục vào đây sẽ ghi nhầm đơn.) */
      if (preselectMaDH) {
        const od = orders.find(o => String(o.MaDH) === String(preselectMaDH));
        if (!od) {
          toast(`Đơn ${preselectMaDH} chưa lập được phiếu xuất (kiểm tra lại Chỉ định vải SX của đơn).`, 'error');
          return;
        }
        const sel = modal.querySelector('#xOrderSelect');
        sel.value = String(od.DonHangID);
        /* v5.76 SỬA: phải BẮN sự kiện 'change' — mọi <select> trong modal đã bị enhanceSelects (v5.51)
           thay bằng ô gõ-tìm, ô đó chỉ đồng bộ chữ hiển thị khi select phát 'change'. Trước đây chỉ
           gán .value rồi gọi applyOrderFilter() nên dữ liệu ĐÚNG mà ô "Đơn hàng sản xuất" TRÔNG NHƯ
           TRỐNG. Sự kiện change cũng tự chạy applyOrderFilter (listener bên dưới) nên không gọi lại. */
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      /* v6.66: ô "Trả nhà cung cấp" — chỉ hiện dropdown NCC khi có tích, để form xuất cho sản xuất
         (đại đa số trường hợp) không bị thêm một ô lạ. Đặt ngay ở đây để chạy dù có draft hay không. */
      const oTra = modal.querySelector('#xTraNCC');
      if (oTra) {
        const selNcc = modal.querySelector('#xNccId');
        const selNhap = modal.querySelector('#xPhieuNhapId');
        const doiHien = () => {
          const b = oTra.checked;
          modal.querySelector('#xNccWrap').style.display = b ? '' : 'none';
          modal.querySelector('#xNhapWrap').style.display = b ? '' : 'none';
          modal.querySelector('#xTraNCCHint').style.display = b ? '' : 'none';
          if (!b) {
            selNcc.value = '';
            selNhap.innerHTML = '<option value="">-- Chọn nhà cung cấp trước --</option>';
            currentRolls = availableRolls;          // bỏ tích -> quay lại toàn kho như cũ
            veLaiDongTheoRolls();
          }
        };
        oTra.addEventListener('change', doiHien);
        /* Chọn NCC -> nạp danh sách phiếu nhập CỦA CHÍNH NCC ĐÓ. Đổi NCC thì xóa luôn phiếu đang chọn,
           không thì còn sót phiếu của NCC cũ trong ô mà nhìn như đã đổi. */
        selNcc.addEventListener('change', async () => {
          selNhap.innerHTML = '<option value="">-- Chọn phiếu nhập --</option>';
          currentRolls = [];
          veLaiDongTheoRolls();
          if (!selNcc.value) { selNhap.innerHTML = '<option value="">-- Chọn nhà cung cấp trước --</option>'; return; }
          const ds = (await apiGet(`/api/khovai/ncc/${selNcc.value}/phieunhap`)).data || [];
          if (!ds.length) { toast('Nhà cung cấp này chưa có phiếu nhập vải nào.', 'error'); return; }
          selNhap.innerHTML = '<option value="">-- Chọn phiếu nhập --</option>' + ds.map(p =>
            `<option value="${p.PhieuNhapID}">NKV-${String(p.PhieuNhapID).padStart(5, '0')} — ${fmtDate(p.NgayNhap)}`
            + `${p.SoHoaDon ? ' — HĐ ' + escapeHtml(p.SoHoaDon) : ''} — ${p.SoCay} cây / ${fmtNumber(p.TongKGNhap)} KG</option>`).join('');
        });
        selNhap.addEventListener('change', async () => {
          if (!selNhap.value) { currentRolls = []; veLaiDongTheoRolls(); return; }
          const ds = (await apiGet(`/api/khovai/phieunhap/${selNhap.value}/cay`)).data || [];
          currentRolls = ds;
          if (!ds.length) toast('Phiếu nhập này không còn cây vải nào tồn để trả.', 'error');
          veLaiDongTheoRolls();
        });
        doiHien();
      }
      const draft = loadDraft(DRAFT_KEY);
      if (!draft || !Array.isArray(draft.rows) || !draft.rows.length) return;
      modal.querySelector('[name="nguoiNhan"]').value = draft.nguoiNhan || '';
      modal.querySelector('[name="ghiChu"]').value = draft.ghiChu || '';
      if (draft.donHangId) {
        modal.querySelector('#xOrderSelect').value = draft.donHangId;
        await applyOrderFilter(draft.donHangId, true);
      }
      modal.querySelector('#xRows').innerHTML = draft.rows.map(() => rowTemplate()).join('');
      modal.querySelectorAll('#xRows [data-row]').forEach((r, i) => { wireRow(r); });
      modal.querySelectorAll('#xRows [data-row]').forEach((r, i) => {
        const d = draft.rows[i];
        modal.querySelector('#xcay_' + r.dataset.idx + '_text').value = d.cayText || '';
        modal.querySelector('#xcay_' + r.dataset.idx + '_val').value = d.cayId || '';
        r.querySelector('.x-kg').value = d.kgXuat || '';
        r.querySelector('.x-met').value = d.soMet || '';
      });
      toast('Đã khôi phục dữ liệu xuất kho đang dở từ lần trước (chưa lưu).', 'success');
    })();

    modal.querySelector('#btnCancelXuat').addEventListener('click', () => { clearDraft(DRAFT_KEY); closeModal(); });

    modal.querySelector('#xForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const rolls = Array.from(modal.querySelectorAll('#xRows > [data-row]')).map(r => ({
        cayId: getSearchableValue('xcay_' + r.dataset.idx), kgXuat: r.querySelector('.x-kg').value, soMet: r.querySelector('.x-met').value || null,
        kieuVai: r.querySelector('.x-kieu') ? r.querySelector('.x-kieu').value : 'Chính'   // v5.31
      }));
      if (!rolls.length) {
        toast('Không có cây vải nào để xuất.', 'error');
        return;
      }
      if (rolls.some(r => !r.cayId)) {
        toast('Vui lòng gõ và chọn đúng cây vải (từ danh sách gợi ý) cho tất cả các dòng.', 'error');
        return;
      }
      if (canhBaoThieuSoLuong(rolls, 'kgXuat', 'soMet', 'KG xuất')) return;   // v5.89
      try {
        /* v5.76: ô "Mã đơn hàng" đã đổi thành "Mã rập" (chỉ xem) nên không còn input name="maDon".
           Cột PhieuXuatVai.MaDon vẫn ghi MÃ ĐƠN HÀNG như trước để không đổi ý nghĩa dữ liệu/bản in cũ —
           lấy từ đơn đang chọn trong ô "Đơn hàng sản xuất". */
        const donHangIdChon = fd.get('donHangId') || null;
        const donChon = donHangIdChon ? orders.find(o => String(o.DonHangID) === String(donHangIdChon)) : null;
        // v6.66: trả NCC — chặn ngay ở form cho người dùng thấy lỗi tại chỗ (backend cũng chặn lần nữa).
        const traNCC = !!(modal.querySelector('#xTraNCC') || {}).checked;
        const nccIdChon = traNCC ? ((modal.querySelector('#xNccId') || {}).value || '') : '';
        if (traNCC && !nccIdChon) return toast('Đã tích "Trả nhà cung cấp" — hãy chọn nhà cung cấp nhận lại.', 'error');
        const res = await apiPost('/api/khovai/xuat', {
          ngayXuat: fd.get('ngayXuat'), maDon: donChon ? donChon.MaDH : null, donHangId: donHangIdChon, chuyen: fd.get('chuyen'),
          nguoiNhan: fd.get('nguoiNhan'), mucDich: fd.get('mucDich'), ghiChu: fd.get('ghiChu'), rolls,
          laTraNCC: traNCC, nccId: nccIdChon || null
        });
        clearDraft(DRAFT_KEY);
        toast('Đã xuất kho.', 'success');
        closeModal();
        await render(container, currentUser); // ve lai danh sach phieu
        openXuatDetailModal(res.data.phieuXuatId); // mo luon phieu vua tao de xem/in
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ---- Dinh muc vai & bao cao hao hut ----
  async function renderDinhMuc(perm) {
    const body = document.getElementById('kvBody');
    const [dmResRaw, haoHutRes] = await Promise.all([apiGet('/api/khovai/dinhmuc'), apiGet('/api/khovai/haohut')]);
    const dinhMucRows = dmResRaw.data;
    const haoHutRows = haoHutRes.data;

    body.innerHTML = `
      <div class="card">
        <h3 style="margin-top:0;">Định mức vải theo mẫu hàng</h3>
        <div class="toolbar">${perm.canCreate ? '<button class="btn" id="btnAddDinhMuc">+ Thêm định mức</button>' : ''}</div>
        <table><thead><tr><th>Mẫu hàng</th><th>Mã vải</th><th>Định mức (KG/SP)</th><th>Tỷ lệ hao hụt cho phép (%)</th><th>Ghi chú</th><th style="width:120px">Thao tác</th></tr></thead>
        <tbody>${dinhMucRows.map(d => `<tr><td>${escapeHtml(d.MauHang)}</td><td>${escapeHtml(d.MaVai)}</td><td>${fmtNumber(d.DinhMucKGTrenSP)}</td>
          <td>${fmtNumber(d.TyLeHaoHut)}</td><td>${escapeHtml(d.GhiChu)}</td>
          <td>${perm.canEdit ? `<button class="btn small secondary act-edit-dm" data-id="${d.ID}">Sửa</button>` : ''} ${perm.canDelete ? `<button class="btn small danger act-del-dm" data-id="${d.ID}">Xóa</button>` : ''}</td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Chưa có định mức nào</td></tr>'}</tbody></table>
      </div>
      <div class="card">
        <h3 style="margin-top:0;">Báo cáo hao hụt theo đơn hàng</h3>
        <table><thead><tr><th>Mã ĐH</th><th>Sản phẩm</th><th>SL hoàn thành</th><th>KG đã cấp</th><th>Định mức KG/SP</th><th>KG lý thuyết</th><th>Hao hụt KG</th><th>Hao hụt %</th><th>So định mức</th></tr></thead>
        <tbody>${haoHutRows.map(r => `<tr><td>${escapeHtml(r.maDH)}</td><td>${escapeHtml(r.tenSanPham)}</td><td>${fmtNumber(r.slHoanThanh)}</td>
          <td>${fmtNumber(r.kgCap)}</td><td>${r.dinhMucKG != null ? fmtNumber(r.dinhMucKG) : '<span class="empty-hint">Chưa khai báo</span>'}</td>
          <td>${r.kgLyThuyet != null ? fmtNumber(r.kgLyThuyet) : ''}</td><td>${r.haoHutKG != null ? fmtNumber(r.haoHutKG) : ''}</td>
          <td>${r.haoHutPhanTram != null ? r.haoHutPhanTram + '%' : ''}</td>
          <td>${r.vuotDinhMuc ? '<span class="badge danger">Vượt định mức</span>' : (r.haoHutPhanTram != null ? '<span class="badge ok">Đạt</span>' : '')}</td>
        </tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Chưa có đơn hàng nào cấp vải hoặc có định mức để so sánh</td></tr>'}</tbody></table>
      </div>`;

    if (perm.canCreate) document.getElementById('btnAddDinhMuc').addEventListener('click', () => openDinhMucForm(null, perm));
    body.querySelectorAll('.act-edit-dm').forEach(btn => btn.addEventListener('click', () => {
      const row = dinhMucRows.find(d => String(d.ID) === btn.dataset.id);
      openDinhMucForm(row, perm);
    }));
    body.querySelectorAll('.act-del-dm').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa định mức này?')) return;
      try { await apiDelete('/api/khovai/dinhmuc/' + btn.dataset.id); toast('Đã xóa.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  function openDinhMucForm(row, perm) {
    const isEdit = !!row;
    const html = `
      <h3>${isEdit ? 'Sửa định mức' : 'Thêm định mức'}</h3>
      <form id="dmVaiForm">
        <div class="form-row"><label>Tên mẫu hàng * (phải khớp đúng "Tên sản phẩm" trong đơn hàng sản xuất)</label>
          <input name="mauHang" value="${escapeHtml(row ? row.MauHang : '')}" required></div>
        <div class="form-row"><label>Mã vải</label><select name="vaiId"><option value="">--</option>${opt(dm.vai, 'VaiID', 'MaVai', row ? row.VaiID : '')}</select></div>
        <div class="form-grid">
          <div class="form-row"><label>Định mức (KG/sản phẩm)</label><input name="dinhMucKgTrenSp" type="number" step="0.0001" value="${row ? row.DinhMucKGTrenSP : ''}"></div>
          <div class="form-row"><label>Tỷ lệ hao hụt cho phép (%)</label><input name="tyLeHaoHut" type="number" step="0.01" value="${row ? row.TyLeHaoHut : ''}"></div>
        </div>
        <div class="form-row"><label>Ghi chú</label><input name="ghiChu" value="${escapeHtml(row ? row.GhiChu : '')}"></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#dmVaiForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        mauHang: fd.get('mauHang'), vaiId: fd.get('vaiId') || null,
        dinhMucKgTrenSp: fd.get('dinhMucKgTrenSp') || null, tyLeHaoHut: fd.get('tyLeHaoHut') || null,
        ghiChu: fd.get('ghiChu')
      };
      try {
        if (isEdit) await apiPut('/api/khovai/dinhmuc/' + row.ID, body);
        else await apiPost('/api/khovai/dinhmuc', body);
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ---- Kiem ke kho vai ----
  async function renderKiemKe(perm) {
    const body = document.getElementById('kvBody');
    const [rollsRes, historyRes] = await Promise.all([apiGet('/api/khovai/rolls?available=true'), apiGet('/api/khovai/kiemke')]);
    const rolls = rollsRes.data;
    const history = historyRes.data;

    let rowCount = 0;
    function rowTemplate() {
      rowCount++;
      return `<div class="form-grid" style="grid-template-columns:2fr 1fr 1.5fr auto;gap:8px;align-items:end;margin-bottom:8px;" data-krow>
        <div><label>Mã cây (hệ thống: ... KG)</label><select class="k-cay">${opt(rolls.map(r => ({ id: r.CayID, label: `${r.MaCay} — hệ thống ${fmtNumber(r.KGCon)} KG` })), 'id', 'label')}</select></div>
        <div><label>KG thực tế *</label><input class="k-kg" type="number" step="0.01" min="0" required></div>
        <div><label>Ghi chú</label><input class="k-ghichu"></div>
        <div><button type="button" class="btn small danger k-remove">X</button></div>
      </div>`;
    }

    body.innerHTML = `
      <div class="card" style="max-width:900px;">
        <h3 style="margin-top:0;">Kiểm kê kho vải</h3>
        ${perm.canCreate && rolls.length ? `
        <form id="kkForm">
          <div class="form-row"><label>Ngày kiểm *</label><input type="date" name="ngayKiem" value="${new Date().toISOString().slice(0, 10)}" required style="max-width:200px;"></div>
          <div id="kkRows">${rowTemplate()}</div>
          <button type="button" class="btn small secondary" id="btnAddK">+ Thêm cây vải</button>
          <div style="margin-top:14px;"><button type="submit" class="btn">Lưu kiểm kê</button></div>
        </form>` : '<div class="empty-hint">Không có cây vải nào để kiểm kê hoặc bạn không có quyền tạo mới.</div>'}
      </div>
      <div class="card">
        <h3 style="margin-top:0;">Lịch sử kiểm kê</h3>
        <table><thead><tr><th>Ngày kiểm</th><th>Mã cây</th><th>Mã vải</th><th>KG hệ thống</th><th>KG thực tế</th><th>Chênh lệch</th><th>Người kiểm</th><th>Ghi chú</th></tr></thead>
        <tbody>${history.map(h => `<tr><td>${fmtDate(h.NgayKiem)}</td><td>${escapeHtml(h.MaCay)}</td><td>${escapeHtml(h.MaVai)}</td>
          <td>${fmtNumber(h.KGHeThong)}</td><td>${fmtNumber(h.KGThucTe)}</td>
          <td>${Number(h.ChenhLech) !== 0 ? `<span class="badge ${Number(h.ChenhLech) < 0 ? 'danger' : 'warn'}">${fmtNumber(h.ChenhLech)}</span>` : '<span class="badge ok">0</span>'}</td>
          <td>${escapeHtml(h.NguoiKiem)}</td><td>${escapeHtml(h.GhiChu)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty-hint">Chưa có lần kiểm kê nào</td></tr>'}</tbody></table>
      </div>`;

    function wireRemove() {
      body.querySelectorAll('.k-remove').forEach(btn => btn.onclick = () => {
        if (body.querySelectorAll('#kkRows > div').length > 1) btn.closest('[data-krow]').remove();
      });
    }
    const addBtn = document.getElementById('btnAddK');
    if (addBtn) { wireRemove(); addBtn.addEventListener('click', () => { document.getElementById('kkRows').insertAdjacentHTML('beforeend', rowTemplate()); wireRemove(); }); }

    const form = document.getElementById('kkForm');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const items = Array.from(document.querySelectorAll('#kkRows > div')).map(r => ({
        cayId: r.querySelector('.k-cay').value, kgThucTe: r.querySelector('.k-kg').value, ghiChu: r.querySelector('.k-ghichu').value
      }));
      try {
        await apiPost('/api/khovai/kiemke', { ngayKiem: fd.get('ngayKiem'), items });
        toast('Đã lưu kiểm kê.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ---- In tem QR hang loat theo ngay nhap + in lai theo ma cay ----
  // v5.45: gửi tem tới máy in mạng (raw socket 9100, cấu hình ở "Cài đặt máy in mạng").
  async function printTemMang(rows) {
    const maCays = (rows || []).map(r => r.MaCay).filter(Boolean);
    if (!maCays.length) { toast('Không có cây vải để in.', 'error'); return; }
    try {
      const res = await apiPost('/api/khovai/print-tem', { maCays });
      toast('Đã gửi ' + ((res.data && res.data.printed) || maCays.length) + ' tem tới máy in mạng.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function openPrinterConfig() {
    let cfg = {};
    try { cfg = (await apiGet('/api/khovai/printer-config')).data || {}; } catch (e) { /* dùng mặc định */ }
    const modal = openModal(`
      <h3>Cài đặt máy in tem (qua mạng)</h3>
      <form id="pcForm">
        <div class="form-row"><label>Địa chỉ IP máy in</label><input name="ip" value="${escapeHtml(cfg.ip || '')}" placeholder="VD: 192.168.1.50"></div>
        <div class="form-row"><label>Cổng</label><input name="port" type="number" value="${cfg.port || 9100}"></div>
        <div class="form-row"><label>Khổ tem</label><select name="kho"><option value="doc" ${cfg.kho !== 'ngang' ? 'selected' : ''}>A6 dọc</option><option value="ngang" ${cfg.kho === 'ngang' ? 'selected' : ''}>A6 ngang</option></select></div>
        <div class="form-row"><label>Loại lệnh in</label><select name="loaiLenh"><option value="TSPL" ${cfg.loaiLenh !== 'ZPL' ? 'selected' : ''}>TSPL (TSC / Godex / Xprinter)</option><option value="ZPL" ${cfg.loaiLenh === 'ZPL' ? 'selected' : ''}>ZPL (Zebra)</option></select></div>
        <div class="form-row"><label>Độ phân giải (DPI)</label><select name="dpi"><option value="203" ${String(cfg.dpi) !== '300' ? 'selected' : ''}>203 dpi (phổ biến)</option><option value="300" ${String(cfg.dpi) === '300' ? 'selected' : ''}>300 dpi</option></select></div>
        <div class="form-row"><label style="font-weight:normal;"><input type="checkbox" name="enabled" ${cfg.enabled ? 'checked' : ''}> Bật in qua máy in mạng</label></div>
        <p style="font-size:12px;color:#888;">Máy in tem kết nối mạng LAN, cổng raw 9100. Chữ trên tem sẽ bỏ dấu tiếng Việt để in rõ.</p>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="pcCancel">Đóng</button>
          <button type="button" class="btn secondary" id="pcTest">🔌 Kiểm tra kết nối</button>
          <button type="submit" class="btn">💾 Lưu</button>
        </div>
      </form>`);
    modal.querySelector('#pcCancel').addEventListener('click', closeModal);
    modal.querySelector('#pcTest').addEventListener('click', async () => {
      const fd = new FormData(modal.querySelector('#pcForm'));
      try {
        const res = await apiPost('/api/khovai/printer-test', { ip: fd.get('ip'), port: fd.get('port') });
        toast(res.message || 'Kết nối được máy in.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    modal.querySelector('#pcForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiPost('/api/khovai/printer-config', { ip: fd.get('ip'), port: fd.get('port'), kho: fd.get('kho'), loaiLenh: fd.get('loaiLenh'), dpi: fd.get('dpi'), enabled: fd.get('enabled') === 'on' });
        toast('Đã lưu cấu hình máy in.', 'success'); closeModal();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function renderTem(perm) {
    const body = document.getElementById('kvBody');
    body.innerHTML = `
      ${perm.canEdit ? '<div style="margin-bottom:10px;"><button class="btn small secondary" id="btnPrinterCfg">⚙️ Cài đặt máy in mạng</button></div>' : ''}
      <div class="card" style="max-width:560px;">
        <h3 style="margin-top:0;">In tem QR theo ngày nhập</h3>
        <div class="form-row"><label>Chọn ngày nhập</label><input type="date" id="temDate" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div class="form-row"><label>Khổ tem (A6)</label>
          <label style="margin-right:16px;font-weight:normal;"><input type="radio" name="temKho" value="doc" checked> Khổ dọc</label>
          <label style="font-weight:normal;"><input type="radio" name="temKho" value="ngang"> Khổ ngang</label>
        </div>
        <button class="btn" id="btnLoadTem">Tải danh sách</button>
        <div id="temResult" style="margin-top:14px;"></div>
      </div>
      <div class="card" style="max-width:560px;">
        <h3 style="margin-top:0;">In lại tem theo mã cây</h3>
        <div class="form-row"><label>Gõ mã cây cần in lại</label><input type="text" id="temCaySearch" placeholder="VD: VAI010726001"></div>
        <div id="temCayResult" style="margin-top:10px;"></div>
      </div>`;

    function khoInDaChon() {
      const el = body.querySelector('input[name="temKho"]:checked');
      return el ? el.value : 'doc';
    }

    const cfgBtn = document.getElementById('btnPrinterCfg');
    if (cfgBtn) cfgBtn.addEventListener('click', openPrinterConfig);

    document.getElementById('btnLoadTem').addEventListener('click', async () => {
      const ngay = document.getElementById('temDate').value;
      if (!ngay) return;
      const res = await apiGet('/api/khovai/rolls?available=false&ngayNhap=' + ngay);
      const rows = res.data;
      const resultEl = document.getElementById('temResult');
      if (!rows.length) { resultEl.innerHTML = '<div class="empty-hint">Không có cây vải nào nhập ngày này</div>'; return; }
      resultEl.innerHTML = `<p>Tìm thấy <b>${rows.length}</b> tem. <button class="btn" id="btnPrintTem">In tem (máy tính)</button> <button class="btn secondary" id="btnPrintTemMang">🖨️ In qua máy in mạng</button></p>`;
      document.getElementById('btnPrintTem').addEventListener('click', () => printTemHangLoat(rows, khoInDaChon()));
      document.getElementById('btnPrintTemMang').addEventListener('click', () => printTemMang(rows));
    });

    // In lai theo ma cay: dung lai cache tu tab "Ton theo cay" neu con, khong thi tai lai tu API
    document.getElementById('temCaySearch').addEventListener('input', async (e) => {
      const q = e.target.value.trim().toLowerCase();
      const resultEl = document.getElementById('temCayResult');
      if (!q) { resultEl.innerHTML = ''; return; }
      if (!rollsAllCache) rollsAllCache = (await apiGet('/api/khovai/rolls?available=false')).data;
      const found = rollsAllCache.filter(r => r.MaCay.toLowerCase().includes(q));
      if (!found.length) { resultEl.innerHTML = '<div class="empty-hint">Không tìm thấy cây vải phù hợp</div>'; return; }
      if (found.length > 1) {
        resultEl.innerHTML = `<div class="empty-hint">Tìm thấy ${found.length} cây phù hợp, vui lòng gõ chính xác hơn để còn đúng 1 kết quả</div>`;
        return;
      }
      const r = found[0];
      resultEl.innerHTML = `<p>${escapeHtml(r.MaCay)} — ${escapeHtml(r.TenLoaiVai)} - ${escapeHtml(r.TenMau)} (còn ${fmtNumber(r.KGCon)} KG)
        <button class="btn small" id="btnPrintOne">In tem (máy tính)</button> <button class="btn small secondary" id="btnPrintOneMang">🖨️ Máy in mạng</button></p>`;
      document.getElementById('btnPrintOne').addEventListener('click', () => printTemHangLoat([r], khoInDaChon()));
      document.getElementById('btnPrintOneMang').addEventListener('click', () => printTemMang([r]));
    });
  }

  // In tem kho A6 (105mm x 148mm), moi tem 1 trang. khoIn = 'doc' (mac dinh, anh QR tren - info duoi)
  // hoac 'ngang' (anh QR va info nam ngang, @page doi chieu 148mm x 105mm).
  /* v5.73: NỘI DUNG MÃ QR TRÊN TEM — trước đây QR chỉ chứa MÃ CÂY, nên quét vào phiếu nhập không có
     thông tin gì để điền. Nay QR mang thêm khổ vải / KG / số mét theo dạng key=value mà form nhập đọc
     được (xem docNoiDungQR trong openNhapCreateModal).
     CỐ Ý KHÔNG nhét Loại vải/Màu vào QR: tên có DẤU tiếng Việt, máy quét cầm tay (kiểu bàn phím) hay
     gõ sai dấu. Loại vải/Màu được máy chủ suy ra từ tiền tố mã cây (route /tracuu-macay) nên vẫn đủ.
     Tem in TỪ BẢN NÀY TRỞ ĐI có thông tin đầy đủ; tem in trước đó vẫn quét được (chỉ có mã cây). */
  /* ==============================================================================================
     v5.73 — ĐỌC NỘI DUNG MÃ QR TRÊN TEM CÂY VẢI (dùng CHUNG cho mọi chỗ quét)
     Tem in từ v5.73 mang chuỗi "MaCay=..;Kho=..;KG=..;Met=.." — tem in TRƯỚC đó chỉ có mã cây trơn.
     BẤT KỲ nơi nào quét QR cũng phải đi qua maCayTuQR() trước khi so với MaCay; nếu so trực tiếp
     với cả chuỗi payload thì tem mới sẽ "không tìm thấy cây nào".
     ============================================================================================== */
  function docNoiDungQRVai(text) {
    const s = String(text || '').trim();
    if (!s) return {};
    if (s.startsWith('{')) { try { return JSON.parse(s); } catch (e) { /* không phải JSON */ } }
    /* v5.76 SỬA: trước đây đòi PHẢI có dấu ; | hoặc xuống dòng mới coi là key=value. Tem của cây
       KHÔNG khai khổ/KG/mét chỉ có đúng 1 cặp "MaCay=XXX" (không có dấu ;) nên bị coi là chữ trơn
       => mã cây thành cả chuỗi "MaCay=XXX" => quét không khớp cây nào. Nay chỉ cần có dấu = hoặc :
       và tách được ít nhất 1 cặp thì hiểu là key=value. */
    if (/[=:]/.test(s)) {
      const o = {};
      s.split(/[;|\n]+/).forEach(p => {
        const m = p.split(/[=:]/);
        if (m.length >= 2 && m[0].trim()) o[m[0].trim().toLowerCase()] = m.slice(1).join('=').trim();
      });
      if (Object.keys(o).length) return o;
    }
    return { macay: s };
  }
  /* v5.76: tìm cây theo mã QUÉT ĐƯỢC — so sánh đã CHUẨN HOÁ (bỏ khoảng trắng đầu/cuối + không phân
     biệt hoa thường). Đây là gốc của lỗi "quét báo không có nhưng gõ tìm vẫn ra": ô gõ-tìm so khớp
     kiểu "chứa" và không phân biệt hoa thường, còn code quét cũ so === tuyệt đối nên lệch 1 khoảng
     trắng hay 1 chữ hoa là trượt. Bước cuối thử khớp kiểu "chứa" cho tem in bị cắt mất ký tự. */
  function timCayTheoMa(danhSach, text) {
    const ma = String(maCayTuQR(text) || text || '').trim().toUpperCase();
    if (!ma) return null;
    const chuan = (v) => String(v == null ? '' : v).trim().toUpperCase();
    return (danhSach || []).find(r => chuan(r.MaCay) === ma)
      || (danhSach || []).find(r => chuan(r.MaCay).includes(ma) || ma.includes(chuan(r.MaCay)))
      || null;
  }
  /* Quét không thấy trong danh sách cho phép -> tra cứu để nói ĐÚNG nguyên nhân, thay vì gộp 3 lý do
     ("hết hàng / không đúng loại vải / không có mã") vào 1 câu như trước. */
  async function baoLoiQuetCay(text) {
    const ma = String(maCayTuQR(text) || text || '').trim();
    if (!ma) { toast('Không đọc được mã từ QR.', 'error'); return; }
    let tra = null;
    try { tra = (await apiGet('/api/khovai/tracuu-macay?maCay=' + encodeURIComponent(ma))).data; } catch (e) { }
    if (!tra || !tra.daTonTai) { toast(`Không có mã cây "${ma}" trong kho vải.`, 'error'); return; }
    const c = tra.cay || {};
    if (Number(c.KGCon) <= 0) {
      toast(`Cây "${ma}" ĐÃ HẾT (${c.TenLoaiVai || ''} ${c.TenMau || ''} — nhập ${fmtNumber(c.KGNhap)}, đã xuất ${fmtNumber(c.KGDaXuat)}).`, 'error');
      return;
    }
    toast(`Cây "${ma}" còn ${fmtNumber(c.KGCon)} KG nhưng là ${c.TenLoaiVai || ''} ${c.TenMau || ''} — ` +
      `KHÔNG khớp Loại vải/Màu đã khai trong Cấu trúc vải của đơn hàng đang chọn.\n` +
      `Muốn xuất cây này: bỏ chọn đơn hàng (xuất tự do), hoặc sửa Cấu trúc vải ở Ra lệnh sản xuất.`, 'error');
  }
  function layTruongQR(o, ...tenList) {
    for (const t of tenList) {
      for (const k of Object.keys(o)) {
        if (k.toLowerCase().replace(/[\s_-]/g, '') === t) {
          const v = o[k];
          if (v !== '' && v != null) return v;
        }
      }
    }
    return null;
  }
  function maCayTuQR(text) {
    return String(layTruongQR(docNoiDungQRVai(text), 'macay', 'ma', 'code', 'id') || '').trim();
  }

  /* v5.80: sau khi thêm dòng mới -> đưa con trỏ vào Ô ĐẦU TIÊN của dòng đó.
     Phải chờ 1 nhịp: mọi <select> trong modal được enhanceSelects (v5.51) thay bằng ô gõ-tìm qua
     MutationObserver (chạy sau, không đồng bộ) — focus ngay lập tức sẽ bắt được <select> đã bị ẩn. */
  /* v5.89 — KG KHÔNG CÒN BẮT BUỘC ở phiếu nhập/xuất vải (có nhà cung cấp giao theo mét, có nơi theo kg,
     có nơi ghi cả hai). Đổi lại phải kiểm tra khi Lưu: MỖI DÒNG ít nhất có KG hoặc Số mét > 0 —
     nếu không, dòng đó vô nghĩa (và ở phiếu xuất backend sẽ bỏ qua im lặng).
     Trả về CHỈ SỐ dòng đầu tiên bị thiếu (0-based), -1 nếu mọi dòng đều hợp lệ. */
  function dongThieuSoLuong(ds, fKg, fMet) {
    return (ds || []).findIndex(d => !(Number(d[fKg]) > 0) && !(Number(d[fMet]) > 0));
  }
  function canhBaoThieuSoLuong(ds, fKg, fMet, tenKg) {
    const i = dongThieuSoLuong(ds, fKg, fMet);
    if (i < 0) return false;
    toast(`Dòng ${i + 1}: phải nhập ${tenKg} hoặc Số mét (ít nhất một trong hai).`, 'error');
    return true;
  }

  /* v5.93: DÒNG TỔNG CỘNG (số kg + số mét) cho phiếu nhập/xuất vải — dùng chung cho cả cửa sổ xem
     chi tiết lẫn bản in, để 4 chỗ luôn cộng giống hệt nhau. `soCotTruoc` = số cột đứng trước cột KG
     (dùng cho colspan của ô chữ "TỔNG CỘNG"), `soCotSau` = số cột trống phía sau cột Số mét. */
  function congKgMet(lines, fKg, fMet) {
    return (lines || []).reduce((t, r) => ({
      kg: t.kg + (Number(r[fKg]) || 0),
      met: t.met + (Number(r[fMet]) || 0)
    }), { kg: 0, met: 0 });
  }
  function dongTongKgMet(lines, fKg, fMet, soCotTruoc, soCotSau) {
    const t = congKgMet(lines, fKg, fMet);
    return `<tr style="font-weight:700;background:#f1f3f4;">
      <td colspan="${soCotTruoc}" style="text-align:right;">TỔNG CỘNG</td>
      <td style="text-align:right;">${fmtNumber(Math.round(t.kg * 100) / 100)}</td>
      <td style="text-align:right;">${t.met ? fmtNumber(Math.round(t.met * 100) / 100) : ''}</td>
      ${soCotSau > 0 ? `<td colspan="${soCotSau}"></td>` : ''}</tr>`;
  }

  function focusODauDong(row) {
    if (!row) return;
    setTimeout(() => {
      const el = row.querySelector('.ss-input, input:not([type=hidden]):not([readonly]), select');
      if (el) { el.focus(); try { el.select(); } catch (e) { } }
    }, 30);
  }

  function noiDungTemQR(r) {
    const kho = (r.KhoVai != null && r.KhoVai !== '') ? r.KhoVai : r.KhoVaiThucTe;
    const p = ['MaCay=' + String(r.MaCay || '')];
    if (kho != null && kho !== '') p.push('Kho=' + kho);
    if (r.KGNhap != null && r.KGNhap !== '') p.push('KG=' + r.KGNhap);
    if (r.SoMet != null && r.SoMet !== '') p.push('Met=' + r.SoMet);
    return p.join(';');
  }
  function anhQRTem(r) {
    return 'https://quickchart.io/qr?text=' + encodeURIComponent(noiDungTemQR(r));
  }

  function printTemHangLoat(rows, khoIn) {
    const ngang = khoIn === 'ngang';
    const pageSize = ngang ? '148mm 105mm' : '105mm 148mm';
    const cards = rows.map(r => `
      <div class="tem-card ${ngang ? 'ngang' : 'doc'}">
        <div class="tem-qr-wrap"><img src="${anhQRTem(r)}" class="tem-qr"></div>
        <div class="tem-info-wrap">
          <div class="tem-ma">${escapeHtml(r.MaCay)}</div>
          <div class="tem-info">${escapeHtml(r.TenLoaiVai)} - ${escapeHtml(r.TenMau)}</div>
          ${/* v5.75: BỎ dòng trống, khớp đúng tem in qua máy in mạng (temInfoVN ở backend/routes/khovai.js).
                Sửa danh sách dòng ở đây thì phải sửa cả bên đó, nếu không 2 tem lại lệch nhau. */''}
          ${(r.KhoVai != null && r.KhoVai !== '') || (r.KhoVaiThucTe != null && r.KhoVaiThucTe !== '') ? `<div class="tem-info">Khổ vải: ${fmtNumber((r.KhoVai != null && r.KhoVai !== '') ? r.KhoVai : r.KhoVaiThucTe)} cm</div>` : ''}
          ${r.KGNhap != null && r.KGNhap !== '' ? `<div class="tem-info">KG nhập: ${fmtNumber(r.KGNhap)}</div>` : ''}
          ${r.SoMet != null && r.SoMet !== '' ? `<div class="tem-info">Số mét: ${fmtNumber(r.SoMet)}</div>` : ''}
          <div class="tem-info">Ngày nhập: ${fmtDate(r.NgayNhap)}</div>
        </div>
      </div>`).join('');
    // v5.8: doi tu window.open('', '_blank') + document.write + <script>window.print()</script> (KHONG
    // co null-check - se loi neu bi popup blocker chan - VA la 1 nguyen nhan gay "treo/chuyen qua tab in,
    // khong thao tac duoc tab chinh" - xem ghi chu chi tiet tren printHtml() trong common.js) sang
    // printHtml() dung <iframe> an: khong tao tab/window moi nen khong bi trinh duyet tu chuyen tab, va
    // khong bi popup blocker can thiep.
    printHtml('In tem QR', cards, {
      noLetterhead: true,
      extraStyle: `
        @page { size: ${pageSize}; margin: 6mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
        /* v5.45.2: dùng CHIỀU CAO CỐ ĐỊNH theo mm (bằng vùng in A6 trừ lề 6mm) thay cho min-height:100vh —
           trên iPad/mobile Safari 'vh' tính theo viewport màn hình (không phải trang A6) làm tem bị lệch/tràn
           sang trang khác; dùng mm cố định thì in trên điện thoại KHỚP với máy tính. */
        html, body { height: auto; }
        .tem-card { width: 100%; height: ${ngang ? '92mm' : '135mm'}; display: flex; align-items: center; justify-content: center; text-align: center; page-break-after: always; overflow: hidden; }
        .tem-card:last-child { page-break-after: auto; }
        .tem-card.doc { flex-direction: column; gap: 2mm; justify-content: center; }
        .tem-card.ngang { flex-direction: row; gap: 6mm; align-items: center; padding: 0 4mm; }
        .tem-qr-wrap { flex-shrink: 0; }
        /* v5.0: tem phu khoang 80% kho giay A6 - kho giay 105x148mm (hoac 148x105mm khi ngang), tru
           6mm le moi ben con lai 93x136mm (hoac 136x93mm) vung in duoc; 75mm ~ 80% canh ngan cua vung
           do, nen QR + chu chiem phan lon to giay thay vi 140px (~37mm) nho nhu truoc.
           v5.3 (muc 3): khổ NGANG rieng QR nho hon (55mm thay vi 75mm dung chung voi kho doc) vi
           chieu rong con lai cho chu qua hep (136mm - 75mm QR - gap = chi ~51mm), lam chu bi tran/mat
           chu; giam QR + rieng font nho hon + .tem-info-wrap co lai duoc (min-width:0 + break-word) de
           chu LUON XUONG DONG gon trong phan con lai thay vi bi cat/tran ra ngoai trang. */
        /* v5.45.3: phóng CÂN ĐỐI cho ĐẦY khổ A6 (giữ đủ thông tin) — QR to hơn + chữ lớn hơn. Đơn vị mm/pt
           cố định để in trên điện thoại KHỚP máy tính. */
        /* v5.51: QR 74mm cả dọc & ngang.
           v5.74 (theo yêu cầu): GIẢM 50% -> 37mm. Dùng đơn vị mm cố định nên in từ ĐIỆN THOẠI và
           từ MÁY TÍNH ra kích thước GIỐNG NHAU (không dùng px/vh vì phụ thuộc màn hình thiết bị). */
        .tem-card.doc .tem-qr { width: 37mm; height: 37mm; }
        .tem-card.ngang .tem-qr { width: 37mm; height: 37mm; }
        .tem-info-wrap { text-align: left; min-width: 0; overflow-wrap: break-word; word-break: break-word; }
        .tem-card.doc .tem-info-wrap { text-align: center; }
        .tem-card.ngang .tem-info-wrap { flex: 1; }
        .tem-ma { font-weight: bold; margin-bottom: 8px; }
        .tem-card.doc .tem-ma { font-size: 16pt; }
        .tem-card.ngang .tem-ma { font-size: 22pt; }
        .tem-info { margin-top: 6px; }
        .tem-card.doc .tem-info { font-size: 10pt; }
        .tem-card.ngang .tem-info { font-size: 12pt; line-height: 1.4; }
      `
    });
  }

  /* v5.69: cho phân hệ khác gọi sang — mở form "Tạo phiếu xuất kho vải" với đơn hàng chọn sẵn.
     Dùng ở Quản lý sản xuất > Chỉ định vải SX (nút "📦 Xuất kho theo chỉ định"). */
  async function openXuatFormChoDon(maDH) {
    await openXuatCreateModal(null, maDH);
  }

  return { render, getTabs, openXuatFormChoDon };
})();
