// Phan he DANH MUC: quan ly cac bang danh muc dung chung cho toan he thong
window.ModuleDanhMuc = (function () {
  const TABS = [
    { key: 'bophan', label: 'Bộ phận', api: '/api/danhmuc/bophan', idCol: 'BoPhanID',
      fields: [{ name: 'TenBoPhan', label: 'Tên bộ phận', required: true }, { name: 'GhiChu', label: 'Ghi chú' }] },
    { key: 'loaivai', label: 'Loại vải', api: '/api/danhmuc/loaivai', idCol: 'LoaiVaiID',
      fields: [{ name: 'TenLoaiVai', label: 'Tên loại vải', required: true }, { name: 'MaLoai', label: 'Mã loại' }] },
    { key: 'mausac', label: 'Màu sắc', api: '/api/danhmuc/mausac', idCol: 'MauSacID',
      fields: [{ name: 'MaMau', label: 'Mã màu', required: true }, { name: 'TenMau', label: 'Tên màu', required: true }] },
    { key: 'vai', label: 'Danh mục vải (mã vải)', api: '/api/danhmuc/vai', idCol: 'VaiID', custom: 'vai' },
    { key: 'phulieu', label: 'Phụ liệu', api: '/api/danhmuc/phulieu', idCol: 'PhuLieuID', custom: 'phulieu' },
    { key: 'nhagiacong', label: 'Nhà gia công / In thêu', api: '/api/danhmuc/nhagiacong', idCol: 'NhaGiaCongID', custom: 'nhagiacong' },
    { key: 'nhacungcap', label: 'Nhà cung cấp', api: '/api/danhmuc/nhacungcap', idCol: 'NCC_ID',
      fields: [{ name: 'TenNCC', label: 'Tên nhà cung cấp', required: true }, { name: 'DiaChi', label: 'Địa chỉ' }, { name: 'SDT', label: 'SĐT' }, { name: 'MaSoThue', label: 'Mã số thuế' }] },
    /* v7.45: thêm 4 ô THÔNG TIN XUẤT HÓA ĐƠN (migration_v689). Hóa đơn GTGT xuất từ phiếu bán hàng
       đọc thẳng từ đây, để trống thì tự lùi về tên/địa chỉ của phiếu.
       ⚠️ "Tên khách hàng" KHÔNG dùng cho hóa đơn: nó là khóa gom công nợ (congno.js gom theo chuỗi
       tên), nên tên pháp nhân phải khai riêng ở ô "Tên viết hóa đơn". */
    { key: 'khachhang', label: 'Khách hàng', api: '/api/danhmuc/khachhang', idCol: 'KhachHangID',
      fields: [{ name: 'TenKhachHang', label: 'Tên khách hàng (tên gọi hàng ngày)', required: true },
               { name: 'DiaChi', label: 'Địa chỉ giao hàng' },
               { name: 'SDT', label: 'SĐT' },
               { name: 'Email', label: 'Email liên lạc' },
               { name: 'TenHoaDon', label: 'Tên viết hóa đơn (tên pháp nhân)' },
               { name: 'MaSoThue', label: 'Mã số thuế (chỉ nhập số)' },
               { name: 'DiaChiHoaDon', label: 'Địa chỉ hóa đơn' },
               { name: 'EmailHoaDon', label: 'Email nhận hóa đơn' }] },
    // v5.62: có thêm CÔNG KHAI theo từng danh mục (link riêng gửi khách xem) -> dùng renderer riêng.
    { key: 'thekhodanhmuc', label: 'Danh mục thẻ kho', api: '/api/danhmuc/thekhodanhmuc', idCol: 'TheKhoDanhMucID',
      custom: 'thekhodanhmuc',
      fields: [{ name: 'TenTheKho', label: 'Tên nhóm thẻ kho', required: true }] },
    // v5.4: "Loai hang" cua The kho hang hoa (vd Quan be trai, Quan be gai) - KHAC voi truong
    // "Nguon hang" (NhaSanXuat/DatNgoai) trong form The kho hang hoa. Xem migration_v54.sql.
    { key: 'nhomsanpham', label: 'Loại hàng', api: '/api/danhmuc/nhomsanpham', idCol: 'NhomSanPhamID',
      fields: [{ name: 'TenNhom', label: 'Tên loại hàng', required: true }] },
    /* v6.94: DANH MỤC HÀNG HÓA — sửa được Mã hàng / Tên hàng, việc trước giờ không làm được ở đâu cả.
       ⚠️ Đây là CHÍNH bảng TheKhoHangHoa, KHÔNG phải bảng mới: thẻ kho, phiếu nhập, phiếu bán hàng đều
       trỏ vào nó. Tạo một bảng "danh mục hàng hóa" riêng là hai nguồn sự thật cho cùng một thứ.
       Đổi mã hàng an toàn vì mọi bảng khác lưu MaHangID (khóa số), không lưu chuỗi mã. */
    { key: 'hanghoa', label: 'Hàng hóa (mã hàng)', api: '/api/danhmuc/hanghoa', idCol: 'MaHangID', custom: 'hanghoa' },
    { key: 'congdoan', label: 'Công đoạn sản xuất', api: '/api/danhmuc/congdoan', idCol: 'StageID', custom: 'congdoan' },
    /* v6.31: đây là NGUỒN DUY NHẤT cho mọi ô chọn đơn vị trong phần mềm.
       "Là đơn vị gộp" = đơn vị gom nhiều đơn vị gốc (Ri, Tá, Thùng) — chỉ để gợi ý/cảnh báo trên
       giao diện; phép tính tồn kho dựa vào ô "ĐVT quy đổi" của TỪNG mã hàng, không dựa vào cờ này. */
    { key: 'donvitinh', label: 'Đơn vị tính', api: '/api/danhmuc/donvitinh', idCol: 'DonViTinhID',
      fields: [{ name: 'TenDonVi', label: 'Tên đơn vị tính', required: true },
               { name: 'LaDonViGop', label: 'Là đơn vị gộp (Ri, Tá, Thùng…)', type: 'checkbox',
                 render: v => (v === true || v === 1) ? '✔ gộp' : '' },
               { name: 'ThuTu', label: 'Thứ tự hiện ra', type: 'number' },
               { name: 'GhiChu', label: 'Ghi chú' }] },
    // v5.21 (muc 1): danh muc CAP don vi quy doi (vd Ri -> Cái, x5) - dung o Ra lenh san xuat de dinh
    // dang dong "Tổng cộng" cua Cau truc vai (xem module.qlsx.js).
    { key: 'donviquydoi', label: 'Đơn vị quy đổi', api: '/api/danhmuc/donviquydoi', idCol: 'ID', custom: 'donviquydoi' },
    { key: 'congdoanmay', label: 'Công đoạn may', api: '/api/danhmuc/congdoanmay', idCol: 'CongDoanMayID',
      fields: [{ name: 'TenCongDoan', label: 'Tên công đoạn may', required: true }, { name: 'GhiChu', label: 'Ghi chú' }] },
    { key: 'maysanxuat', label: 'Máy sản xuất', api: '/api/danhmuc/maysanxuat', idCol: 'MaySanXuatID',
      fields: [{ name: 'TenMay', label: 'Tên máy (VD: 1 kim, Vắt sổ)', required: true }, { name: 'GhiChu', label: 'Ghi chú' }] },
    { key: 'nhanvien', label: 'Nhân viên', api: '/api/danhmuc/nhanvien', idCol: 'NhanVienID', custom: 'nhanvien' },
    /* v6.23: 2 danh mục cho phân hệ Công nợ (API nằm ở routes/congno.js nhưng gate bằng quyền DANHMUC).
       "Tính chi phí KD" = khoản chi thuộc loại này có được coi là chi phí kinh doanh không (dùng cho
       báo cáo lãi lỗ sẽ làm sau). Dùng select Có/Không thay checkbox để đi theo đúng khuôn renderSimpleWithSelect. */
    { key: 'loaitaikhoan', label: 'Loại tài khoản', api: '/api/congno/loaitaikhoan', idCol: 'LoaiTKID', custom: 'loaitaikhoan' },
    { key: 'taikhoan', label: 'Danh mục tài khoản', api: '/api/congno/taikhoan', idCol: 'TaiKhoanID', custom: 'taikhoan' },
    // v6.24: số tài khoản ngân hàng của công ty — dùng khi phiếu thu/chi chọn "Chuyển khoản" + sổ quỹ ngân hàng.
    { key: 'taikhoannganhang', label: 'Tài khoản ngân hàng', api: '/api/congno/taikhoannganhang', idCol: 'TaiKhoanNHID',
      fields: [
        { name: 'TenNganHang', label: 'Tên ngân hàng', required: true },
        { name: 'SoTaiKhoan', label: 'Số tài khoản', required: true },
        { name: 'ChuTaiKhoan', label: 'Chủ tài khoản' },
        { name: 'ChiNhanh', label: 'Chi nhánh' },
        { name: 'SoDuDauKy', label: 'Số dư đầu kỳ' },
        { name: 'GhiChu', label: 'Ghi chú' }
      ] },
    { key: 'cauhinh', label: 'Cấu hình hệ thống', api: '/api/danhmuc/cauhinh', custom: 'cauhinh' }
  ];

  let activeTab = TABS[0].key;
  let container, currentUser, cache = {};

  function getTabs() {
    return TABS.map(t => ({ key: t.key, label: t.label }));
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    // v5.3: giao voi quyen rieng theo chuc nang (tab dang mo) - xem effectivePerm() trong common.js.
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.DANHMUC || {});
    const perm = effectivePerm(user, 'DANHMUC', activeTab, rawPerm);
    container.innerHTML = `<div id="dmBody"></div>`;
    await renderTabBody(perm);
  }

  async function renderTabBody(perm) {
    const tab = TABS.find(t => t.key === activeTab);
    const body = document.getElementById('dmBody');
    body.innerHTML = '<div class="empty-hint">Đang tải...</div>';

    if (tab.custom === 'cauhinh') return renderCauHinh(body, tab, perm);

    const res = await apiGet(tab.api);
    const rows = res.data;

    if (tab.custom === 'vai') return renderVaiTab(body, tab, rows, perm);
    if (tab.custom === 'phulieu') return renderSimpleWithSelect(body, tab, rows, perm, [
      { name: 'LoaiPhuLieu', label: 'Loại phụ liệu', options: ['The bai', 'Mac', 'Chun', 'Tui bong', 'Khac'].map(v => ({ value: v, label: v })) },
      { name: 'MaPhuLieu', label: 'Mã phụ liệu', type: 'text', required: true },
      { name: 'TenPhuLieu', label: 'Tên phụ liệu', type: 'text', required: true },
      { name: 'DonViTinh', label: 'Đơn vị tính', type: 'text' },
      { name: 'GhiChu', label: 'Ghi chú', type: 'text' }
    ]);
    if (tab.custom === 'nhagiacong') return renderSimpleWithSelect(body, tab, rows, perm, [
      { name: 'TenNha', label: 'Tên nhà', type: 'text', required: true },
      { name: 'LoaiHinh', label: 'Loại hình', options: [{ value: 'GiaCong', label: 'Gia công' }, { value: 'InTheu', label: 'In thêu' }] },
      { name: 'DiaChi', label: 'Địa chỉ', type: 'text' },
      { name: 'SDT', label: 'SĐT', type: 'text' },
      { name: 'GhiChu', label: 'Ghi chú', type: 'text' }
    ]);
    // v5.21 (muc 1): "Phép tính" la select Nhan/Chia (giong pattern LoaiHinh cua nhagiacong o tren) - moi
    // dong la 1 cap don vi doc lap, cho phep tao NHIEU cap (yeu cau "Tạo nhiều danh mục đơn vị quy đổi").
    if (tab.custom === 'donviquydoi') return renderSimpleWithSelect(body, tab, rows, perm, [
      { name: 'DonViChinh', label: 'Đơn vị chính', type: 'text', required: true },
      { name: 'DonViQuyDoi', label: 'Đơn vị quy đổi', type: 'text', required: true },
      { name: 'HeSo', label: 'Hệ số', type: 'text', required: true },
      { name: 'PhepTinh', label: 'Phép tính', options: [
        { value: 'Nhan', label: 'Nhân (Chính × Hệ số = Quy đổi)' },
        { value: 'Chia', label: 'Chia (Chính ÷ Hệ số = Quy đổi)' }
      ] },
      { name: 'GhiChu', label: 'Ghi chú', type: 'text' }
    ]);
    if (tab.custom === 'loaitaikhoan' || tab.custom === 'taikhoan') return renderTaiKhoan(body, tab, rows, perm);
    if (tab.custom === 'congdoan') return renderCongDoan(body, tab, rows, perm);
    if (tab.custom === 'nhanvien') return renderNhanVien(body, tab, rows, perm);
    if (tab.custom === 'thekhodanhmuc') return renderTheKhoDanhMuc(body, tab, rows, perm);   // v5.62
    /* v6.94: 2 ô ĐVT lấy từ DANH MỤC ĐƠN VỊ TÍNH — nguyên tắc: trường nào đã có danh mục thì đọc từ
       danh mục, không gõ cứng. Phải tải danh mục ĐVT trước khi dựng form. */
    if (tab.custom === 'hanghoa') {
      const dsDV = await apiGet('/api/danhmuc/donvitinh').then(r => (r.data || []).map(x => x.TenDonVi).filter(Boolean)).catch(() => []);
      const optDV = dsDV.map(v => ({ value: v, label: v }));
      return renderSimpleWithSelect(body, tab, rows, perm, [
        { name: 'MaHang', label: 'Mã hàng', type: 'text', required: true },
        { name: 'TenHang', label: 'Tên hàng', type: 'text', required: true },
        { name: 'DonViCoBan', label: 'ĐVT chính', options: optDV },
        { name: 'DonViQuyDoi', label: 'ĐVT quy đổi', options: optDV },
        { name: 'LoaiRi', label: 'Tỷ lệ (1 ĐVT quy đổi = ? ĐVT chính)', type: 'number' },
        { name: 'GiaBan', label: 'Giá bán (1 ĐVT chính)', type: 'number' }
      ]);
    }

    renderGenericTable(body, tab, rows, perm);
  }

  function renderGenericTable(body, tab, rows, perm) {
    const cols = tab.fields.map(f => f.name);
    body.innerHTML = `
      <div class="toolbar">${searchBoxHtml()}${perm.canCreate ? `<button class="btn" id="btnAdd">+ Thêm mới</button>` : ''}</div>
      <table><thead><tr>${cols.map(c => `<th>${labelOf(tab, c)}</th>`).join('')}<th style="width:120px">Thao tác</th></tr></thead>
      ${/* v6.31: cột nào khai `render` thì dùng hàm đó (vd cột BIT hiện "✔ gộp" thay vì "true"). */''}
      <tbody>${rows.map(r => `<tr>${tab.fields.map(f => `<td>${f.render ? f.render(r[f.name]) : escapeHtml(r[f.name])}</td>`).join('')}
        <td>${rowActions(perm)}</td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty-hint">Chưa có dữ liệu</td></tr>`}</tbody></table>`;

    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openForm(tab, null, perm));
    wireRowActions(body, rows, tab, perm);
    wireTableSearch(body);
  }

  /* v6.23: 2 danh mục của phân hệ Công nợ. Viết riêng (không dùng renderGenericTable) vì cần HIỆN
     cho người đọc: "Tính chi phí KD" ra Có/Không thay vì 1/0, và tên loại thay vì LoaiTKID.
     Form vẫn dùng openCustomForm() chung nên giá trị lưu là giá trị THẬT (1/0, LoaiTKID). */
  async function renderTaiKhoan(body, tab, rows, perm) {
    const laLoai = tab.custom === 'loaitaikhoan';
    const loaiList = laLoai ? [] : ((await apiGet('/api/congno/loaitaikhoan')).data || []);
    const fields = laLoai ? [
      { name: 'TenLoai', label: 'Tên loại tài khoản', type: 'text', required: true },
      // v6.25: loại này dùng khi lập PHIẾU THU hay PHIẾU CHI (lọc dropdown tài khoản trên 2 form đó).
      { name: 'LoaiPhieu', label: 'Dùng cho phiếu', options: [
        { value: 'Thu', label: 'Phiếu thu' }, { value: 'Chi', label: 'Phiếu chi' },
        { value: 'Cả hai', label: 'Cả hai' }] },
      { name: 'TinhChiPhiKD', label: 'Tính chi phí kinh doanh', options: [
        { value: '0', label: 'Không' }, { value: '1', label: 'Có — tính vào chi phí kinh doanh' }] },
      { name: 'GhiChu', label: 'Ghi chú', type: 'text' }
    ] : [
      { name: 'MaTK', label: 'Mã TK', type: 'text', required: true },
      { name: 'TenTK', label: 'Tên tài khoản', type: 'text', required: true },
      { name: 'LoaiTKID', label: 'Loại tài khoản', options: loaiList.map(l => ({
        value: String(l.LoaiTKID), label: l.TenLoai + (l.TinhChiPhiKD ? ' (tính CPKD)' : '') })) },
      { name: 'GhiChu', label: 'Ghi chú', type: 'text' }
    ];
    const cot = laLoai
      ? [['TenLoai', 'Tên loại tài khoản'], ['LoaiPhieu', 'Dùng cho phiếu'], ['__cpkd', 'Tính chi phí KD'], ['GhiChu', 'Ghi chú']]
      : [['MaTK', 'Mã TK'], ['TenTK', 'Tên tài khoản'], ['TenLoai', 'Loại tài khoản'], ['LoaiPhieu', 'Dùng cho phiếu'], ['__cpkd', 'Tính chi phí KD'], ['GhiChu', 'Ghi chú']];
    const oCPKD = r => r.TinhChiPhiKD ? '<span class="badge warn">Có</span>' : '<span class="badge">Không</span>';
    body.innerHTML = `
      <div class="toolbar">${searchBoxHtml()}${perm.canCreate ? '<button class="btn" id="btnAdd">+ Thêm mới</button>' : ''}</div>
      ${laLoai ? '<div class="empty-hint" style="text-align:left;">Tích "Có" cho các loại là <b>chi phí kinh doanh</b> (mua NPL, gia công, lương, vận chuyển, quản lý...). Các khoản như trả nợ gốc, tạm ứng, rút vốn thì chọn "Không".</div>' : ''}
      <table><thead><tr>${cot.map(c => `<th>${c[1]}</th>`).join('')}<th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>${cot.map(c => `<td>${c[0] === '__cpkd' ? oCPKD(r) : escapeHtml(r[c[0]])}</td>`).join('')}
        <td>${rowActions(perm)}</td></tr>`).join('') || `<tr><td colspan="${cot.length + 1}" class="empty-hint">Chưa có dữ liệu</td></tr>`}</tbody></table>`;
    if (perm.canCreate) body.querySelector('#btnAdd').addEventListener('click', () => openCustomForm(tab, fields, null, perm));
    wireRowActions(body, rows, tab, perm, fields);
    wireTableSearch(body);
  }

  function renderSimpleWithSelect(body, tab, rows, perm, fields) {
    tab._fields = fields;
    const cols = fields.map(f => f.name);
    body.innerHTML = `
      <div class="toolbar">${searchBoxHtml()}${perm.canCreate ? `<button class="btn" id="btnAdd">+ Thêm mới</button>` : ''}</div>
      <table><thead><tr>${cols.map(c => `<th>${fields.find(f=>f.name===c).label}</th>`).join('')}<th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(r[c])}</td>`).join('')}<td>${rowActions(perm)}</td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty-hint">Chưa có dữ liệu</td></tr>`}</tbody></table>`;
    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openCustomForm(tab, fields, null, perm));
    wireRowActions(body, rows, tab, perm, fields);
    wireTableSearch(body);
  }

  /* ================================================================================================
     v5.62: DANH MỤC THẺ KHO + CÔNG KHAI TỪNG DANH MỤC.
     Mỗi danh mục có 1 đường link riêng dạng  <địa chỉ phần mềm>/catalogue.html?dm=<mã link>
     - Chỉ danh mục BẬT "Công khai" mới xem được; chưa bật thì mở link báo không tồn tại.
     - Link dựng từ window.location.origin (cùng địa chỉ đang dùng phần mềm) — không cần cấu hình gì.
     ================================================================================================ */
  /* v5.66/.2: link gửi khách phải là địa chỉ CÔNG KHAI, không phải địa chỉ nhân viên đang dùng.
     Thứ tự ưu tiên:
       1. PUBLIC_BASE_URL trong backend/.env (chuẩn nhất — dùng khi nhân viên vào qua Cloudflare
          Tunnel / tên miền nội bộ khác với địa chỉ khách dùng).
       2. Nếu bỏ trống: lấy tên máy đang mở, BỎ cổng (đúng khi cổng công khai = 80). */
  let __baseCongKhai = null;
  async function taiBaseCongKhai() {
    if (__baseCongKhai !== null) return __baseCongKhai;
    try {
      const d = await (await fetch('/api/public/thongtin')).json();
      __baseCongKhai = (d && d.success && d.data && d.data.baseUrl) ? d.data.baseUrl : '';
    } catch (e) { __baseCongKhai = ''; }
    return __baseCongKhai;
  }
  function linkCongKhai(slug) {
    const base = __baseCongKhai || (window.location.protocol + '//' + window.location.hostname);
    return base + '/catalogue.html?dm=' + encodeURIComponent(slug || '');
  }
  // Bỏ dấu tiếng Việt -> mã link (giống cách sinh Slug trong migration_v656).
  function taoSlug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  async function renderTheKhoDanhMuc(body, tab, rows, perm) {
    await taiBaseCongKhai();   // v5.66.2: biết địa chỉ công khai trước khi vẽ cột "Đường link"
    body.innerHTML = `
      <div class="toolbar">${searchBoxHtml()}${perm.canCreate ? `<button class="btn" id="btnAdd">+ Thêm mới</button>` : ''}</div>
      <p class="empty-hint" style="text-align:left;padding:0 0 8px;">Bật <b>Công khai</b> cho danh mục nào thì danh mục đó có đường link riêng để gửi khách xem (khách không cần đăng nhập, chỉ thấy đúng danh mục đó). Danh mục chưa bật: mở link sẽ báo không tồn tại.</p>
      <table><thead><tr>
        <th>Tên nhóm thẻ kho</th><th style="width:110px;">Công khai</th><th>Đường link cho khách</th><th style="width:210px">Thao tác</th>
      </tr></thead>
      <tbody>${rows.map(r => {
        const slug = r.Slug || '';
        const bat = !!r.CongKhai;
        return `<tr>
          <td>${escapeHtml(r.TenTheKho)}${r.TieuDeCongKhai ? `<div style="font-size:11px;color:#5f6368;">Tiêu đề khách thấy: ${escapeHtml(r.TieuDeCongKhai)}</div>` : ''}</td>
          <td style="text-align:center;">${bat ? '<span class="badge ok">Đang bật</span>' : '<span class="badge">Tắt</span>'}</td>
          <td>${bat && slug ? `<div style="font-size:12px;word-break:break-all;">${escapeHtml(linkCongKhai(slug))}</div>` : '<span style="color:#9aa0a6;font-size:12px;">—</span>'}</td>
          <td style="white-space:nowrap;">
            ${bat && slug ? `<button class="btn small secondary act-copy" data-slug="${escapeHtml(slug)}">📋 Copy link</button>
              <a class="btn small secondary" href="${escapeHtml(linkCongKhai(slug))}" target="_blank" rel="noopener">Xem</a>` : ''}
            ${rowActions(perm)}
          </td></tr>`;
      }).join('') || `<tr><td colspan="4" class="empty-hint">Chưa có dữ liệu</td></tr>`}</tbody></table>`;

    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openTheKhoDanhMucForm(tab, null, perm));
    body.querySelectorAll('tbody tr').forEach((tr, i) => {
      const row = rows[i]; if (!row) return;
      const e1 = tr.querySelector('.act-edit'); if (e1) e1.addEventListener('click', () => openTheKhoDanhMucForm(tab, row, perm));
      const d1 = tr.querySelector('.act-del'); if (d1) d1.addEventListener('click', () => doDelete(tab, row));
      const c1 = tr.querySelector('.act-copy');
      if (c1) c1.addEventListener('click', async () => {
        const link = linkCongKhai(c1.dataset.slug);
        try { await navigator.clipboard.writeText(link); toast('Đã copy link. Dán vào Zalo/Messenger để gửi khách.', 'success'); }
        catch (e) { prompt('Copy đường link này:', link); }   // trình duyệt cũ / không cho phép clipboard
      });
    });
    wireTableSearch(body);
  }
  function openTheKhoDanhMucForm(tab, row, perm) {
    const isEdit = !!row;
    const modal = openModal(`
      <h3>${isEdit ? 'Sửa' : 'Thêm'} - Danh mục thẻ kho</h3>
      <form id="tkdmForm">
        <div class="form-row"><label>Tên nhóm thẻ kho *</label><input name="TenTheKho" value="${escapeHtml(row ? row.TenTheKho : '')}" required></div>
        <fieldset style="border:1px solid #e0e0e0;border-radius:6px;padding:10px 12px;">
          <legend style="font-weight:600;">Chia sẻ công khai cho khách xem</legend>
          <label style="display:block;margin-bottom:10px;"><input type="checkbox" id="tk_congkhai" ${row && row.CongKhai ? 'checked' : ''}> <b>Công khai danh mục này</b> (khách mở link xem được, không cần đăng nhập)</label>
          <div class="form-row"><label>Mã đường link (không dấu, không khoảng trắng)</label>
            <input name="Slug" id="tk_slug" value="${escapeHtml(row ? (row.Slug || '') : '')}" placeholder="vd: hang-he-2026">
            <div style="font-size:11px;color:#5f6368;">Để trống = tự sinh từ tên danh mục. Link sẽ là: <span id="tk_preview" style="word-break:break-all;"></span></div>
          </div>
          <div class="form-row"><label>Tiêu đề khách nhìn thấy</label><input name="TieuDeCongKhai" value="${escapeHtml(row ? (row.TieuDeCongKhai || '') : '')}" placeholder="Để trống = dùng tên danh mục"></div>
          <div class="form-row"><label>Mô tả ngắn (tùy chọn)</label><input name="MoTaCongKhai" value="${escapeHtml(row ? (row.MoTaCongKhai || '') : '')}" placeholder="vd: Bảng hàng hè 2026 - liên hệ 09xx để đặt"></div>
        </fieldset>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    const inpTen = modal.querySelector('[name="TenTheKho"]');
    const inpSlug = modal.querySelector('#tk_slug');
    const preview = modal.querySelector('#tk_preview');
    const veLink = () => { preview.textContent = linkCongKhai(inpSlug.value.trim() || taoSlug(inpTen.value)); };
    veLink();
    inpTen.addEventListener('input', veLink);
    inpSlug.addEventListener('input', veLink);
    modal.querySelector('#tkdmForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const ten = (fd.get('TenTheKho') || '').trim();
      const body = {
        TenTheKho: ten,
        CongKhai: modal.querySelector('#tk_congkhai').checked ? 1 : 0,
        Slug: (fd.get('Slug') || '').trim() ? taoSlug(fd.get('Slug')) : taoSlug(ten),
        TieuDeCongKhai: (fd.get('TieuDeCongKhai') || '').trim() || null,
        MoTaCongKhai: (fd.get('MoTaCongKhai') || '').trim() || null
      };
      try {
        if (isEdit) await apiPut(`${tab.api}/${row[tab.idCol]}`, body);
        else await apiPost(tab.api, body);
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) {
        toast(err.message.indexOf('UX_TheKhoDanhMuc_Slug') !== -1 || /duplicate|trùng/i.test(err.message)
          ? 'Mã đường link này đã dùng cho danh mục khác. Hãy đổi mã đường link.' : err.message, 'error');
      }
    });
  }

  function labelOf(tab, name) { return (tab.fields.find(f => f.name === name) || {}).label || name; }

  function rowActions(perm) {
    return `${perm.canEdit ? `<button class="btn small secondary act-edit">Sửa</button>` : ''} ${perm.canDelete ? `<button class="btn small danger act-del">Xóa</button>` : ''}`;
  }

  // v5.10: searchBoxHtml()/wireTableSearch() chuyen sang common.js (dung CHUNG cho ca module.danhmuc.js
  // lan module.phukien.js - xem renderDanhMuc trong module.phukien.js) thay vi khai bao rieng trong
  // closure cua file nay, tranh trung lap code khi ap dung cho module thu 2.

  function wireRowActions(body, rows, tab, perm, customFields) {
    body.querySelectorAll('tbody tr').forEach((tr, i) => {
      const row = rows[i]; if (!row) return;
      const editBtn = tr.querySelector('.act-edit');
      const delBtn = tr.querySelector('.act-del');
      if (editBtn) editBtn.addEventListener('click', () => customFields ? openCustomForm(tab, customFields, row, perm) : openForm(tab, row, perm));
      if (delBtn) delBtn.addEventListener('click', () => doDelete(tab, row));
    });
  }

  async function doDelete(tab, row) {
    if (!confirm('Xác nhận xóa bản ghi này?')) return;
    try {
      await apiDelete(`${tab.api}/${row[tab.idCol]}`);
      toast('Đã xóa.', 'success');
      render(container, currentUser);
    } catch (err) { toast(err.message, 'error'); }
  }

  function openForm(tab, row, perm) {
    const isEdit = !!row;
    const html = `
      <h3>${isEdit ? 'Sửa' : 'Thêm'} - ${tab.label}</h3>
      <form id="dmForm">
        ${tab.fields.map(f => `<div class="form-row"><label>${f.label}${f.required ? ' *' : ''}</label>
          <input name="${f.name}" value="${escapeHtml(row ? row[f.name] : '')}" ${f.required ? 'required' : ''}></div>`).join('')}
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#dmForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      const fdChung = new FormData(e.target);
      tab.fields.forEach(f => {
        // v6.31: checkbox không tick thì FormData KHÔNG có khoá đó -> phải tự gửi 0, kẻo cột BIT
        // giữ nguyên giá trị cũ và người dùng tưởng đã bỏ tick.
        if (f.type === 'checkbox') { body[f.name] = fdChung.get(f.name) ? 1 : 0; return; }
        const v = fdChung.get(f.name);
        body[f.name] = (f.type === 'number') ? (String(v || '').trim() === '' ? null : Number(v)) : v;
      });
      try {
        if (isEdit) await apiPut(`${tab.api}/${row[tab.idCol]}`, body);
        else await apiPost(tab.api, body);
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function openCustomForm(tab, fields, row, perm, extraHtml, onSubmit) {
    const html = `
      <h3>${row ? 'Sửa' : 'Thêm'} - ${tab.label}</h3>
      <form id="dmForm">
        ${fields.map(f => fieldHtml(f, row)).join('')}
        ${extraHtml || ''}
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#dmForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {};
      fields.forEach(f => { body[f.name] = fd.get(f.name); });
      try {
        if (onSubmit) { await onSubmit(body, row); }
        else if (row) await apiPut(`${tab.api}/${row[tab.idCol]}`, body);
        else await apiPost(tab.api, body);
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
    return modal;
  }

  // v5.9: them f.readonlyIf(row) (tuy chon, mac dinh khong dung o bat ky tab nao khac ngoai "Cong doan
  // san xuat" - xem renderCongDoan) - khi tra ve true, o nhap thanh readonly (van GUI dung gia tri cu len
  // server khi submit vi FormData van doc duoc input readonly, khac voi disabled se KHONG gui gi ca) kem
  // 1 dong chu thich nho giai thich ly do. Day chi la lop UX - chan THAT SU nam o backend (xem
  // backend/routes/danhmuc.js PUT /congdoan/:id).
  function fieldHtml(f, row) {
    const val = row ? row[f.name] : '';
    if (f.options) {
      return `<div class="form-row"><label>${f.label}</label><select name="${f.name}">
        ${f.options.map(o => `<option value="${o.value}" ${String(o.value) === String(val) ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select></div>`;
    }
    const isReadonly = typeof f.readonlyIf === 'function' && f.readonlyIf(row);
    /* v6.31: thêm 2 kiểu ô — 'checkbox' (cột BIT) và 'number'. Trước chỉ có text/date, nên cột BIT
       hiện ra là ô chữ ghi "true/false" và lưu xuống thành chuỗi. */
    if (f.type === 'checkbox') {
      return `<div class="form-row"><label>${f.label}</label>
        <label style="font-weight:400;"><input type="checkbox" name="${f.name}" value="1" ${(val === true || val === 1 || val === '1') ? 'checked' : ''} ${isReadonly ? 'disabled' : ''}> Có</label></div>`;
    }
    const inputVal = f.type === 'date' && val ? String(val).slice(0, 10) : (val == null ? '' : val);
    return `<div class="form-row"><label>${f.label}${f.required ? ' *' : ''}${isReadonly ? ' 🔒' : ''}</label>
      <input type="${f.type === 'date' ? 'date' : (f.type === 'number' ? 'number' : 'text')}" name="${f.name}" value="${escapeHtml(inputVal)}" ${f.required ? 'required' : ''} ${isReadonly ? 'readonly' : ''}>
      ${isReadonly && f.readonlyHint ? `<div class="empty-hint" style="margin-top:2px;">${escapeHtml(f.readonlyHint)}</div>` : ''}</div>`;
  }

  // ---- Tab rieng: Danh muc Vai (can chon Loai vai + Mau sac) ----
  // Ghi chu: GET /api/danhmuc/vai chi tra ve cot tho cua DanhMucVai (LoaiVaiID/MauSacID), KHONG join
  // san TenLoaiVai/TenMau - truoc day bang nay bi hien Loai vai/Mau TRONG do template doc thang
  // r.TenLoaiVai/r.TenMau (khong ton tai). Fix bang cach tu resolve qua map LoaiVaiID/MauSacID ->
  // ten (+ MaLoai) ngay tai day, dung lai loaiVaiList/mauSacList da co san.
  async function renderVaiTab(body, tab, rows, perm) {
    const [loaiVaiRes, mauSacRes] = await Promise.all([apiGet('/api/danhmuc/loaivai'), apiGet('/api/danhmuc/mausac')]);
    const loaiVaiList = loaiVaiRes.data, mauSacList = mauSacRes.data;
    const loaiVaiById = new Map(loaiVaiList.map(l => [String(l.LoaiVaiID), l]));
    const mauSacById = new Map(mauSacList.map(m => [String(m.MauSacID), m]));
    body.innerHTML = `
      <div class="toolbar">${searchBoxHtml()}${perm.canCreate ? `<button class="btn" id="btnAdd">+ Thêm mã vải</button>` : ''}</div>
      <table><thead><tr><th>Mã vải</th><th>Mã PM</th><th>Mã loại</th><th>Loại vải</th><th>Màu</th><th>Khổ vải</th><th>GSM</th><th>Vị trí kho</th><th>Tồn tối thiểu (KG)</th><th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => {
        const lv = loaiVaiById.get(String(r.LoaiVaiID));
        const ms = mauSacById.get(String(r.MauSacID));
        return `<tr><td>${escapeHtml(r.MaVai)}</td><td>${escapeHtml(r.MaPM)}</td><td>${escapeHtml(lv ? lv.MaLoai : '')}</td><td>${escapeHtml(lv ? lv.TenLoaiVai : '')}</td><td>${escapeHtml(ms ? ms.TenMau : '')}</td>
        <td>${fmtNumber(r.KhoVai)}</td><td>${fmtNumber(r.GSM)}</td><td>${escapeHtml(r.ViTriKho)}</td><td>${fmtNumber(r.TonToiThieuKG)}</td>
        <td>${rowActions(perm)}</td></tr>`;
      }).join('') || `<tr><td colspan="10" class="empty-hint">Chưa có dữ liệu</td></tr>`}</tbody></table>`;

    const fields = [
      { name: 'MaVai', label: 'Mã vải', type: 'text', required: true },
      { name: 'MaPM', label: 'Mã PM', type: 'text' },
      { name: 'LoaiVaiID', label: 'Loại vải', options: loaiVaiList.map(l => ({ value: l.LoaiVaiID, label: l.TenLoaiVai })) },
      { name: 'MauSacID', label: 'Màu', options: mauSacList.map(m => ({ value: m.MauSacID, label: m.TenMau })) },
      { name: 'KhoVai', label: 'Khổ vải', type: 'text' },
      { name: 'GSM', label: 'GSM', type: 'text' },
      { name: 'ViTriKho', label: 'Vị trí kho', type: 'text' },
      { name: 'TonToiThieuKG', label: 'Tồn tối thiểu (KG)', type: 'text' },
      { name: 'GhiChu', label: 'Ghi chú', type: 'text' }
    ];
    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openCustomForm(tab, fields, null, perm));
    wireRowActions(body, rows, tab, perm, fields);
    wireTableSearch(body);
  }

  // ---- Tab rieng: Cong doan san xuat (co thu tu) ----
  // v5.7: bo sung "Ma cong doan" (yeu cau v5.7 "Danh mục Công đoạn sản xuất – thêm mã công đoạn, để
  // công đoạn Ghi nhận tiến độ liên kết theo mã, không bị đứt khi đổi tên công đoạn"). Pham vi v5.7 CHI
  // dung o muc them cot + hien thi trong danh muc nay - CHUA fix triet de toan bo diem so sanh theo ten.
  // v5.9 (yeu cau moi "mở rộng thành sửa lại toàn bộ các chỗ... sang so sánh theo mã/StageID"): TOAN BO
  // cac diem so sanh theo TenCongDoan trong qlsx.js/khohang.js/middleware/auth.js da duoc doi sang dung
  // MaCongDoan/StageID (xem migration_v59.sql) - vi vay Ma cong doan cua 8 dong HE THONG (cot LaHeThong)
  // gio duoc KHOA khong cho sua o day (chan that su o backend PUT /congdoan/:id, day chi la khoa UX) -
  // tranh chi CHUYEN fragility tu TenCongDoan sang MaCongDoan. Ten cong doan/Thu tu van sua tu do duoc.
  function renderCongDoan(body, tab, rows, perm) {
    body.innerHTML = `
      <p style="color:#5f6368;font-size:13px;">Thứ tự công đoạn quyết định luồng chuyển tiếp khi bộ phận sản xuất ghi nhận tiến độ. Mã công đoạn dùng để tham chiếu ổn định — 8 công đoạn hệ thống (đánh dấu 🔒) đã khóa mã, không thể đổi; vẫn đổi được Tên công đoạn/Thứ tự bình thường.</p>
      <div class="toolbar">${searchBoxHtml()}${perm.canCreate ? `<button class="btn" id="btnAdd">+ Thêm công đoạn</button>` : ''}</div>
      <table><thead><tr><th>Thứ tự</th><th>Mã công đoạn</th><th>Tên công đoạn</th><th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr><td>${r.ThuTu}</td><td>${escapeHtml(r.MaCongDoan || '')}${r.LaHeThong ? ' 🔒' : ''}</td><td>${escapeHtml(r.TenCongDoan)}</td><td>${rowActions(perm)}</td></tr>`).join('') || `<tr><td colspan="4" class="empty-hint">Chưa có dữ liệu</td></tr>`}</tbody></table>`;
    const fields = [
      { name: 'TenCongDoan', label: 'Tên công đoạn', type: 'text', required: true },
      {
        name: 'MaCongDoan', label: 'Mã công đoạn', type: 'text',
        readonlyIf: (row) => !!(row && row.LaHeThong),
        readonlyHint: 'Công đoạn hệ thống — mã này được hệ thống dùng để nhận diện đúng luồng chuyển công đoạn, không thể đổi.'
      },
      { name: 'ThuTu', label: 'Thứ tự', type: 'text', required: true }
    ];
    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openCustomForm(tab, fields, null, perm));
    wireRowActions(body, rows, tab, perm, fields);
    wireTableSearch(body);
  }

  // ---- Tab rieng: Nhan vien (danh sach cong nhan theo bo phan - nen cho giao viec Cat/May + luong/cham cong sau nay) ----
  // v5.2: bo sung cot/truong May san xuat (vd "1 kim", "Vat so") - de biet nhan vien dang ngoi may nao,
  // phuc vu tinh luong sau nay (yeu cau v5.2 muc 2).
  async function renderNhanVien(body, tab, rows, perm) {
    const [bpRes, mayRes] = await Promise.all([apiGet('/api/danhmuc/bophan'), apiGet('/api/danhmuc/maysanxuat')]);
    const boPhanList = bpRes.data;
    const mayList = mayRes.data;
    const bpName = (id) => (boPhanList.find(b => String(b.BoPhanID) === String(id)) || {}).TenBoPhan || '';
    const mayName = (id) => (mayList.find(m => String(m.MaySanXuatID) === String(id)) || {}).TenMay || '';
    body.innerHTML = `
      <div class="toolbar">${searchBoxHtml()}${perm.canCreate ? `<button class="btn" id="btnAdd">+ Thêm nhân viên</button>` : ''}</div>
      <table><thead><tr><th>Mã NV</th><th>Họ tên</th><th>Bộ phận</th><th>Máy sản xuất</th><th>SĐT</th><th>Ngày vào</th><th>Trạng thái</th><th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.MaNhanVien || '')}</td><td>${escapeHtml(r.HoTen)}</td><td>${escapeHtml(bpName(r.BoPhanID))}</td>
        <td>${escapeHtml(mayName(r.MaySanXuatID))}</td>
        <td>${escapeHtml(r.SDT || '')}</td><td>${fmtDate(r.NgayVao)}</td>
        <td>${r.TrangThai === 'Đang làm' ? '<span class="badge ok">Đang làm</span>' : '<span class="badge danger">Đã nghỉ</span>'}</td>
        <td>${rowActions(perm)}</td></tr>`).join('') || `<tr><td colspan="8" class="empty-hint">Chưa có nhân viên nào</td></tr>`}</tbody></table>`;

    const fields = [
      { name: 'HoTen', label: 'Họ tên', type: 'text', required: true },
      { name: 'MaNhanVien', label: 'Mã nhân viên', type: 'text' },
      { name: 'BoPhanID', label: 'Bộ phận', options: boPhanList.map(b => ({ value: b.BoPhanID, label: b.TenBoPhan })) },
      { name: 'MaySanXuatID', label: 'Máy sản xuất', options: [{ value: '', label: '--' }, ...mayList.map(m => ({ value: m.MaySanXuatID, label: m.TenMay }))] },
      { name: 'SDT', label: 'Số điện thoại', type: 'text' },
      { name: 'NgayVao', label: 'Ngày vào làm', type: 'date' },
      { name: 'TrangThai', label: 'Trạng thái', options: [{ value: 'Đang làm', label: 'Đang làm' }, { value: 'Đã nghỉ', label: 'Đã nghỉ' }] },
      { name: 'GhiChu', label: 'Ghi chú', type: 'text' }
    ];
    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openCustomForm(tab, fields, null, perm));
    wireRowActions(body, rows, tab, perm, fields);
    wireTableSearch(body);
  }

  // ---- Tab rieng: Cau hinh he thong (key-value) ----
  async function renderCauHinh(body, tab, perm) {
    const res = await apiGet(tab.api);
    const cfg = res.data;
    body.innerHTML = `
      <div class="card" style="max-width:480px;">
        <form id="cfgForm">
          <div class="form-row"><label>Email nhận cảnh báo trễ hạn (cách nhau bởi dấu phẩy)</label>
            <input name="EmailCanhBao" value="${escapeHtml(cfg.EmailCanhBao || '')}"></div>
          <div class="form-row"><label>Số ngày cảnh báo trước hạn giao</label>
            <input name="SoNgayCanhBaoTruocHan" value="${escapeHtml(cfg.SoNgayCanhBaoTruocHan || '')}"></div>
          ${perm.canEdit ? '<button type="submit" class="btn">Lưu cấu hình</button>' : ''}
        </form>
      </div>`;
    if (perm.canEdit) {
      document.getElementById('cfgForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await apiPut(tab.api, { EmailCanhBao: fd.get('EmailCanhBao'), SoNgayCanhBaoTruocHan: fd.get('SoNgayCanhBaoTruocHan') });
          toast('Đã lưu cấu hình.', 'success');
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  }

  return { render, getTabs };
})();
