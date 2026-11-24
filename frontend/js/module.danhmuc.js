// Phan he DANH MUC: quan ly cac bang danh muc dung chung cho toan he thong
window.ModuleDanhMuc = (function () {
  const TABS = [
    { key: 'bophan', label: 'Bộ phận', api: '/api/danhmuc/bophan', idCol: 'BoPhanID',
      fields: [{ name: 'TenBoPhan', label: 'Tên bộ phận', required: true }, { name: 'GhiChu', label: 'Ghi chú' }] },
    { key: 'loaivai', label: 'Loại vải', api: '/api/danhmuc/loaivai', idCol: 'LoaiVaiID',
      fields: [{ name: 'TenLoaiVai', label: 'Tên loại vải', required: true }, { name: 'MaLoai', label: 'Mã loại' }] },
    /* v8.94: + ảnh màu (MauSac.AnhMau, migration_v881). Kiểu ô 'image' — xem fieldHtml/openForm:
       chọn file → upload qua /api/upload → gửi URL. Bảng hiện ảnh thu nhỏ 48px (qua /anh/80/…). */
    { key: 'mausac', label: 'Màu sắc', api: '/api/danhmuc/mausac', idCol: 'MauSacID',
      fields: [{ name: 'MaMau', label: 'Mã màu', required: true }, { name: 'TenMau', label: 'Tên màu', required: true },
               { name: 'AnhMau', label: 'Ảnh màu vải', type: 'image', render: v => anhMauThuNhoHtml(v, 48) }] },
    { key: 'vai', label: 'Danh mục vải (mã vải)', api: '/api/danhmuc/vai', idCol: 'VaiID', custom: 'vai' },
    { key: 'phulieu', label: 'Phụ liệu', api: '/api/danhmuc/phulieu', idCol: 'PhuLieuID', custom: 'phulieu' },
    { key: 'nhagiacong', label: 'Nhà gia công / In thêu', api: '/api/danhmuc/nhagiacong', idCol: 'NhaGiaCongID', custom: 'nhagiacong' },
    /* v9.70 (Nguyen 16/11): CỘNG TÁC VIÊN THIẾT KẾ — chọn ở lệnh SX khi tích "CTV" cạnh ô Thiết kế; đơn giá × số lệnh
       trong tháng = tab Tính lương › Lương CTV. Ngừng hợp tác thì không hiện trong ô chọn của lệnh mới (lệnh cũ giữ). */
    { key: 'congtacvien', label: 'Cộng tác viên thiết kế', api: '/api/danhmuc/congtacvien', idCol: 'CongTacVienID',
      fields: [{ name: 'TenCTV', label: 'Tên cộng tác viên', required: true }, { name: 'SDT', label: 'SĐT' }, { name: 'Email', label: 'Email' },
               { name: 'DonGiaThietKe', label: 'Đơn giá thiết kế (đ / 1 lệnh SX)', type: 'number', render: v => fmtNumber(v) },
               { name: 'NganHang', label: 'Số TK + ngân hàng' },
               { name: 'TrangThai', label: 'Trạng thái', options: [{ value: 'Đang hợp tác', label: 'Đang hợp tác' }, { value: 'Ngừng', label: 'Ngừng hợp tác' }] },
               { name: 'GhiChu', label: 'Ghi chú' }] },
    { key: 'nhacungcap', label: 'Nhà cung cấp', api: '/api/danhmuc/nhacungcap', idCol: 'NCC_ID',
      fields: [{ name: 'TenNCC', label: 'Tên nhà cung cấp', required: true }, { name: 'DiaChi', label: 'Địa chỉ' }, { name: 'SDT', label: 'SĐT' }, { name: 'MaSoThue', label: 'Mã số thuế' },
               /* v7.81: đối tác vừa bán cho mình vừa mua của mình -> chọn đúng dòng bên Danh mục
                  khách hàng để xem công nợ 2 chiều. Để trống = nhà cung cấp thuần tuý.
                  `type:'number'` để lúc lưu ô trống thành NULL chứ không phải chuỗi rỗng. */
               { name: 'KhachHangID', label: 'Đồng thời là khách hàng (để xem công nợ 2 chiều)',
                 type: 'number', optionsApi: '/api/danhmuc/khachhang',
                 optionsValue: 'KhachHangID', optionsLabel: 'TenKhachHang',
                 optionsRong: '— không, chỉ là nhà cung cấp —' },
               /* v9.36 (Nguyen 2026-11-09: "mỗi NCC giá vận chuyển khác nhau") — khai MỘT LẦN ở đây,
                  lập phiếu nhập vải thì tự áp cho từng cây, vẫn sửa tay được trên phiếu.
                  🔴 Phí này chỉ vào GIÁ THÀNH, KHÔNG vào công nợ NCC (cước trả nhà xe, không phải nợ
                  NCC). Đơn vị phải TRÙNG "Đơn giá tính theo" của phiếu nhập thì mới tự áp được. */
               { name: 'PhiVanChuyenDonGia', label: 'Phí vận chuyển — đơn giá (đ/kg hoặc đ/mét)', type: 'number' },
               /* `options` của bộ dựng ô chung là mảng {value,label} — xem napOptions(). Khai sẵn
                  mảng ở đây (không có optionsApi) thì napOptions bỏ qua, dùng đúng mảng này. */
               { name: 'PhiVanChuyenDVT', label: 'Phí vận chuyển — tính theo',
                 options: [{ value: '', label: '— chưa khai —' },
                           { value: 'Kg', label: 'Kg' }, { value: 'Met', label: 'Mét' }] }] },
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
               { name: 'EmailHoaDon', label: 'Email nhận hóa đơn' },
               /* v9.75: % CK hàng ký gửi theo khách — tab Hàng ký gửi › Báo bán tự áp (sửa được trên phiếu). */
               { name: 'PhanTramCKKyGui', label: '% chiết khấu hàng ký gửi (VD 12)', type: 'number' },
               /* v9.77 (migration_v903): NHÓM khách hàng — chọn ngay khi tạo/sửa khách; hoặc gán hàng loạt ở tab
                  "Nhóm khách hàng". Dashboard kinh doanh gom doanh thu / công nợ theo nhóm này.
                  `cot: 'TenNhom'` chỉ có tác dụng ở renderSimpleWithSelect; bảng của tab này dùng `render` bên dưới. */
               { name: 'NhomKhachHangID', label: 'Nhóm khách hàng', type: 'number',
                 optionsApi: '/api/danhmuc/nhomkhachhang', optionsValue: 'NhomKhachHangID', optionsLabel: 'TenNhom',
                 optionsRong: '— chưa gán nhóm —' }] },
    /* v9.77 — NHÓM KHÁCH HÀNG (Nguyen 19/11). Một khách thuộc tối đa MỘT nhóm (cột trên KhachHang), gán được
       ở hai nơi: form khách hàng (ô trên) hoặc nút "Khách hàng trong nhóm" ở tab này. */
    { key: 'nhomkhachhang', label: 'Nhóm khách hàng', api: '/api/danhmuc/nhomkhachhang', idCol: 'NhomKhachHangID',
      custom: 'nhomkhachhang',
      fields: [{ name: 'TenNhom', label: 'Tên nhóm', required: true },
               { name: 'MoTa', label: 'Mô tả' },
               { name: 'ThuTu', label: 'Thứ tự hiện ra', type: 'number' }] },
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
    if (tab.custom === 'nhomkhachhang') return renderNhomKhachHang(body, tab, rows, perm);   // v9.77
    /* v9.77: bảng Khách hàng hiện TÊN nhóm (cột lưu ID). Nạp danh mục nhóm một lần, lỗi/chưa migration ⇒ để trống. */
    if (activeTab === 'khachhang') {
      const f = tab.fields.find(x => x.name === 'NhomKhachHangID');
      if (f && !f.render) {
        const dsN = await apiGet('/api/danhmuc/nhomkhachhang').then(r => r.data || []).catch(() => []);
        const tenCua = new Map(dsN.map(n => [String(n.NhomKhachHangID), n.TenNhom]));
        f.render = (v) => (v == null || v === '' ? '<span class="empty-hint" style="padding:0;">chưa gán</span>' : escapeHtml(tenCua.get(String(v)) || ('#' + v)));
      }
    }
    if (tab.custom === 'loaitaikhoan' || tab.custom === 'taikhoan') return renderTaiKhoan(body, tab, rows, perm);
    if (tab.custom === 'congdoan') return renderCongDoan(body, tab, rows, perm);
    if (tab.custom === 'nhanvien') return renderNhanVien(body, tab, rows, perm);
    if (tab.custom === 'thekhodanhmuc') return renderTheKhoDanhMuc(body, tab, rows, perm);   // v5.62
    /* v6.94: 2 ô ĐVT lấy từ DANH MỤC ĐƠN VỊ TÍNH — nguyên tắc: trường nào đã có danh mục thì đọc từ
       danh mục, không gõ cứng. Phải tải danh mục ĐVT trước khi dựng form. */
    if (tab.custom === 'hanghoa') {
      const dsDV = await apiGet('/api/danhmuc/donvitinh').then(r => (r.data || []).map(x => x.TenDonVi).filter(Boolean)).catch(() => []);
      const optDV = dsDV.map(v => ({ value: v, label: v }));
      /* v7.86: DANH MỤC THẺ KHO ngay tại đây. Trước phải sang Kho hàng hóa → Thẻ kho mới đổi được
         danh mục của một mã, trong khi đây mới là chỗ người dùng vào để sửa cấp mã hàng.
         Lỗi nạp danh sách thì để MỘT lựa chọn rỗng — vẫn sửa được các ô khác, không chặn cả form. */
      const dsDM = await apiGet('/api/danhmuc/thekhodanhmuc').then(r => r.data || []).catch(() => []);
      const optDM = [{ value: '', label: '— không —' }]
        .concat(dsDM.map(x => ({ value: String(x.TheKhoDanhMucID), label: x.TenTheKho || '' })));
      return renderSimpleWithSelect(body, tab, rows, perm, [
        { name: 'MaHang', label: 'Mã hàng', type: 'text', required: true },
        { name: 'TenHang', label: 'Tên hàng (nội bộ)', type: 'text', required: true },
        /* v7.46 (migration_v690): tên ghi trên HÓA ĐƠN GTGT. Để trống = hóa đơn lấy Tên hàng. */
        { name: 'TenHoaDon', label: 'Tên viết hóa đơn (trống = lấy Tên hàng)', type: 'text' },
        { name: 'DonViCoBan', label: 'ĐVT chính', options: optDV },
        { name: 'DonViQuyDoi', label: 'ĐVT quy đổi', options: optDV },
        { name: 'LoaiRi', label: 'Tỷ lệ (1 ĐVT quy đổi = ? ĐVT chính)', type: 'number' },
        { name: 'GiaBan', label: 'Giá bán (1 ĐVT chính)', type: 'number' },
        /* v7.88: GIÁ NHẬP — hệ thống TỰ TÍNH, không gõ tay (`chiXem`), cùng ĐVT với Giá bán nên đặt
           ngay cạnh là so được lãi. Nguồn: hàng mua ngoài lấy bình quân gia quyền từ phiếu nhập NCC;
           hàng tự sản xuất lấy giá thành 1 cái đã chốt ở Báo cáo → Giá vốn. Cùng một con số với
           báo cáo Tồn kho hàng hóa (utils/giaNhapHangHoa.js) — hai màn không được lệch nhau. */
        { name: 'GiaNhap', label: 'Giá nhập (1 ĐVT chính)', chiXem: true,
          dinhDang: (r) => (r.GiaNhap == null
            ? '<span class="empty-hint" style="padding:0;">chưa có</span>'
            : `${fmtNumber(r.GiaNhap)}${r.NguonGiaNhap ? `<div style="font-size:11px;color:#5f6368;">${escapeHtml(r.NguonGiaNhap)}</div>` : ''}`) },
        /* `cot` = tên trường DÙNG ĐỂ HIỆN trong bảng. Ô chọn lưu ID, mà cột bảng in thẳng giá trị
           trường -> không khai `cot` là cả cột hiện ra dãy số vô nghĩa. */
        { name: 'TheKhoDanhMucID', label: 'Danh mục thẻ kho', options: optDM, cot: 'TenTheKho' }
      ]);
    }

    renderGenericTable(body, tab, rows, perm);
  }

  /* ================================================================================================
     v9.77 — NHÓM KHÁCH HÀNG: bảng nhóm + số khách đang thuộc nhóm + nút "Khách hàng trong nhóm"
     (tích chọn hàng loạt). Một khách một nhóm: tích ở đây = chuyển khách khỏi nhóm cũ, bỏ tích = gỡ nhóm.
     ================================================================================================ */
  async function renderNhomKhachHang(body, tab, rows, perm) {
    const dsKH = await apiGet('/api/danhmuc/khachhang').then(r => r.data || []).catch(() => []);
    const demCua = new Map();
    dsKH.forEach(k => { if (k.NhomKhachHangID != null) demCua.set(String(k.NhomKhachHangID), (demCua.get(String(k.NhomKhachHangID)) || 0) + 1); });
    const chuaGan = dsKH.filter(k => k.NhomKhachHangID == null).length;
    body.innerHTML = `
      <div class="toolbar">${searchBoxHtml()}${perm.canCreate ? `<button class="btn" id="btnAdd">+ Thêm nhóm</button>` : ''}</div>
      <div class="empty-hint" style="margin-bottom:6px;">Một khách hàng thuộc <b>tối đa một nhóm</b>. Gán ở đây (tích chọn hàng loạt) hoặc ở từng khách trong tab <b>Khách hàng</b> — cùng một chỗ lưu. Hiện có <b>${chuaGan}</b> khách <b>chưa gán nhóm</b> (Dashboard gom vào dòng "Chưa gán nhóm").</div>
      <table><thead><tr><th>Tên nhóm</th><th>Mô tả</th><th class="num" style="width:90px;">Thứ tự</th><th class="num" style="width:110px;">Số khách</th><th style="width:260px">Thao tác</th></tr></thead>
      ${/* v9.83 (Nguyen 19/11: "khi click vào nhóm khách hiện ra list khách thuộc nhóm đó"): BẤM VÀO
           TÊN NHÓM (hoặc số khách) = XEM danh sách khách của nhóm. Nút "Thêm khách" là việc khác — gán
           thêm — nên tách hẳn hai đường, bấm nhầm không còn mở ra màn gán. */''}
      <tbody>${rows.map(r => `<tr>
        <td><a href="#" class="act-xem-kh" style="font-weight:600;">${escapeHtml(r.TenNhom)}</a></td><td>${escapeHtml(r.MoTa || '')}</td><td class="num">${r.ThuTu == null ? '' : escapeHtml(r.ThuTu)}</td>
        <td class="num"><a href="#" class="act-xem-kh">${demCua.get(String(r.NhomKhachHangID)) || 0}</a></td>
        <td>${perm.canEdit ? `<button class="btn small secondary act-kh">➕ Thêm khách vào nhóm</button> ` : ''}${rowActions(perm)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="empty-hint">Chưa có nhóm nào. Bấm "+ Thêm nhóm" (VD: Shop lẻ, Nhà phân phối, Khách ký gửi, Khách tỉnh).</td></tr>'}</tbody></table>`;
    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openForm(tab, null, perm));
    wireRowActions(body, rows, tab, perm);
    body.querySelectorAll('tbody tr').forEach((tr, i) => {
      const nut = tr.querySelector('.act-kh');
      if (nut && rows[i]) nut.addEventListener('click', () => moGanKhach(rows[i]).catch(e => toast(e.message, 'error')));
      tr.querySelectorAll('.act-xem-kh').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault();
        if (rows[i]) moXemKhachNhom(rows[i], perm).catch(err => toast(err.message, 'error'));
      }));
    });
    wireTableSearch(body);
  }

  /* ================================================================================================
     v9.83 — XEM danh sách khách THUỘC một nhóm (bấm vào tên nhóm). Chỉ đọc + nút gỡ từng khách.
     Tách khỏi màn gán: ở đây không có ô tích nào để lỡ tay bỏ sạch nhóm.
     ================================================================================================ */
  async function moXemKhachNhom(nhom, perm) {
    const ds = ((await apiGet(`/api/danhmuc/nhomkhachhang/${nhom.NhomKhachHangID}/khachhang`)).data || [])
      .filter(k => Number(k.TrongNhom) === 1);
    const modal = openModal(`
      <div class="modal-head"><h3>Khách hàng thuộc nhóm: ${escapeHtml(nhom.TenNhom)} (${ds.length})</h3></div>
      <div class="modal-body">
        <input type="text" id="xkTim" placeholder="Gõ để tìm khách..." style="width:100%;margin-bottom:8px;">
        <div class="table-wrap" style="max-height:420px;overflow:auto;">
        <table class="data-table phieu-ke"><thead><tr><th style="width:40px;">STT</th><th>Khách hàng</th><th>SĐT</th><th style="width:130px;"></th></tr></thead>
        <tbody>${ds.map((k, i) => `<tr data-tim="${escapeHtml(String(k.TenKhachHang || '').toLowerCase())}" data-id="${k.KhachHangID}">
          <td class="num">${i + 1}</td><td>${escapeHtml(k.TenKhachHang)}</td><td>${escapeHtml(k.SDT || '')}</td>
          <td>${perm.canEdit ? '<button type="button" class="btn small danger xk-go">Gỡ khỏi nhóm</button>' : ''}</td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty-hint">Nhóm này chưa có khách hàng nào. Bấm "➕ Thêm khách vào nhóm" ở dòng nhóm để thêm.</td></tr>'}</tbody></table></div>
      </div>
      <div class="modal-actions"><button class="btn secondary" id="xkDong">Đóng</button></div>`);
    modal.querySelector('#xkTim').addEventListener('input', (e) => {
      const q = String(e.target.value || '').trim().toLowerCase();
      modal.querySelectorAll('tbody tr').forEach(tr => { tr.style.display = (!q || (tr.dataset.tim || '').includes(q)) ? '' : 'none'; });
    });
    modal.querySelector('#xkDong').addEventListener('click', () => closeModal());
    modal.querySelectorAll('.xk-go').forEach(b => b.addEventListener('click', async () => {
      const tr = b.closest('tr');
      const ten = tr.children[1].textContent;
      if (!confirm(`Gỡ "${ten}" khỏi nhóm ${nhom.TenNhom}? Khách này sẽ thành "chưa gán nhóm".`)) return;
      b.disabled = true;
      /* Gửi lại DANH SÁCH ĐẦY ĐỦ của nhóm trừ người vừa gỡ — đúng hợp đồng của route gán hàng loạt
         (nó xóa sạch nhóm rồi gán lại), không có route gỡ một người. */
      const conLai = ds.map(x => Number(x.KhachHangID)).filter(id => String(id) !== String(tr.dataset.id));
      try {
        await apiPut(`/api/danhmuc/nhomkhachhang/${nhom.NhomKhachHangID}/khachhang`, { khachHangIds: conLai });
        toast('Đã gỡ khỏi nhóm.', 'success');
        closeModal();
        render(container, currentUser);
      } catch (e) { b.disabled = false; toast(e.message, 'error'); }
    }));
  }
  async function moGanKhach(nhom) {
    /* ================================================================================================
       v9.83 (Nguyen 19/11: "khi gán vào nhóm rồi, ở nhóm khác thêm thì không hiện ra nữa"):
       màn THÊM KHÁCH chỉ còn hai loại — khách CHƯA gán nhóm nào, và khách ĐANG thuộc chính nhóm này
       (để bỏ tích = gỡ ra). Khách đang ở nhóm KHÁC bị loại hẳn khỏi danh sách, không thể vô tình
       kéo khách của nhóm khác sang. Muốn chuyển nhóm: vào nhóm cũ gỡ ra trước (bấm tên nhóm → Gỡ).
       ================================================================================================ */
    const tatCa = (await apiGet(`/api/danhmuc/nhomkhachhang/${nhom.NhomKhachHangID}/khachhang`)).data || [];
    const ds = tatCa.filter(k => Number(k.TrongNhom) === 1 || k.NhomKhachHangID == null);
    const soNhomKhac = tatCa.length - ds.length;
    const modal = openModal(`
      <div class="modal-head"><h3>Thêm khách vào nhóm: ${escapeHtml(nhom.TenNhom)}</h3></div>
      <div class="modal-body">
        <input type="text" id="gkTim" placeholder="Gõ để tìm khách..." style="width:100%;margin-bottom:8px;">
        <div class="empty-hint">Tích = đưa vào nhóm này, bỏ tích = gỡ khỏi nhóm. Một khách chỉ thuộc <b>một</b> nhóm.${
          soNhomKhac > 0 ? ` <b>${soNhomKhac}</b> khách đang thuộc nhóm khác nên <b>không hiện ở đây</b> — muốn chuyển sang nhóm này thì vào nhóm cũ (bấm tên nhóm) gỡ ra trước.` : ''}</div>
        <div class="table-wrap" style="max-height:400px;overflow:auto;">
        <table class="data-table phieu-ke"><thead><tr><th style="width:40px;"></th><th>Khách hàng</th><th>SĐT</th><th>Nhóm hiện tại</th></tr></thead>
        <tbody>${ds.map(k => `<tr data-tim="${escapeHtml(String(k.TenKhachHang || '').toLowerCase())}">
          <td><input type="checkbox" class="gk-ck" value="${k.KhachHangID}" ${Number(k.TrongNhom) === 1 ? 'checked' : ''}></td>
          <td>${escapeHtml(k.TenKhachHang)}</td><td>${escapeHtml(k.SDT || '')}</td>
          <td>${k.NhomKhachHangID == null ? '<span class="empty-hint" style="padding:0;">chưa gán</span>' : escapeHtml(k.TenNhom || '')}</td>
        </tr>`).join('') || '<tr><td colspan="4" class="empty-hint">Danh mục khách hàng đang trống.</td></tr>'}</tbody></table></div>
      </div>
      <div class="modal-actions">
        <button class="btn secondary" id="gkHuy">Hủy</button>
        <button class="btn secondary" id="gkHet">Chọn hết (đang hiện)</button>
        <button class="btn secondary" id="gkBo">Bỏ chọn hết (đang hiện)</button>
        <button class="btn" id="gkLuu">💾 Lưu</button>
      </div>`);
    const hien = () => [...modal.querySelectorAll('tbody tr')].filter(tr => tr.style.display !== 'none');
    modal.querySelector('#gkTim').addEventListener('input', (e) => {
      const q = String(e.target.value || '').trim().toLowerCase();
      modal.querySelectorAll('tbody tr').forEach(tr => { tr.style.display = (!q || (tr.dataset.tim || '').includes(q)) ? '' : 'none'; });
    });
    modal.querySelector('#gkHet').addEventListener('click', () => hien().forEach(tr => { const c = tr.querySelector('.gk-ck'); if (c) c.checked = true; }));
    modal.querySelector('#gkBo').addEventListener('click', () => hien().forEach(tr => { const c = tr.querySelector('.gk-ck'); if (c) c.checked = false; }));
    modal.querySelector('#gkHuy').addEventListener('click', () => closeModal());
    modal.querySelector('#gkLuu').addEventListener('click', async () => {
      /* ⚠️ Đọc TẤT CẢ ô tích (kể cả dòng đang bị ô tìm ẩn) — gửi lên là danh sách ĐẦY ĐỦ của nhóm;
         chỉ đọc dòng đang hiện thì gõ tìm rồi Lưu sẽ gỡ sạch những khách khác khỏi nhóm. */
      const ids = [...modal.querySelectorAll('.gk-ck')].filter(c => c.checked).map(c => Number(c.value));
      const nut = modal.querySelector('#gkLuu'); nut.disabled = true;
      try {
        const kq = await apiPut(`/api/danhmuc/nhomkhachhang/${nhom.NhomKhachHangID}/khachhang`, { khachHangIds: ids });
        closeModal(); toast(`Nhóm "${nhom.TenNhom}": ${kq.data.soKhach} khách hàng.`, 'success');
        render(container, currentUser);
      } catch (e) { nut.disabled = false; toast(e.message, 'error', 8000); }
    });
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
      ${/* v7.86: ô chọn lưu ID nhưng bảng phải hiện TÊN — trường nào khai `cot` thì lấy trường đó.
           v7.88: `chiXem` = cột CHỈ ĐỂ XEM (số do hệ thống tự tính) — có trong bảng nhưng KHÔNG có
           trong form; `dinhDang` = hàm dựng ô, dùng cho cột tiền. */''}
      <table><thead><tr>${cols.map(c => `<th>${fields.find(f=>f.name===c).label}</th>`).join('')}<th style="width:120px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>${fields.map(f => `<td>${f.dinhDang ? f.dinhDang(r) : escapeHtml(r[f.cot || f.name])}</td>`).join('')}<td>${rowActions(perm)}</td></tr>`).join('') || `<tr><td colspan="${cols.length + 1}" class="empty-hint">Chưa có dữ liệu</td></tr>`}</tbody></table>`;
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

  /* v7.81 — Ô CHỌN LẤY DANH SÁCH TỪ MỘT DANH MỤC KHÁC (`optionsApi`).
     Dùng cho "Nhà cung cấp → Đồng thời là khách hàng": phải chọn ĐÚNG dòng trong danh mục khách,
     không gõ tay tên — gõ tay là sớm muộn lệch một dấu cách rồi ghép nhầm tiền của hai đối tác.
     Nạp lỗi (chưa có quyền xem danh mục kia, hoặc chưa chạy migration) thì để danh sách rỗng và vẫn
     mở được form — KHÔNG chặn việc sửa các ô còn lại. */
  async function napOptions(fields) {
    for (const f of fields) {
      if (!f.optionsApi || f.options) continue;
      try {
        const ds = (await apiGet(f.optionsApi)).data || [];
        f.options = [{ value: '', label: f.optionsRong || '— không —' }]
          .concat(ds.map(x => ({ value: x[f.optionsValue], label: String(x[f.optionsLabel] || '') })));
      } catch (e) { f.options = [{ value: '', label: f.optionsRong || '— không —' }]; }
    }
  }

  /* v9.92: thêm tham số `opts` để phân hệ KHÁC mượn đúng form này (xem moFormKhachHang ở cuối file):
       · opts.giaTriSan  — điền sẵn vài ô nhưng VẪN là chế độ THÊM MỚI (khác hẳn truyền `row`, vốn
                           bật chế độ SỬA và sẽ gọi apiPut vào một bản ghi chưa tồn tại).
       · opts.sauKhiLuu  — thay cho render(container, currentUser) mặc định. BẮT BUỘC phải thay khi
                           gọi từ phân hệ khác: `container`/`currentUser` là biến của riêng Danh mục,
                           người dùng chưa từng mở tab Danh mục thì chúng là null ⇒ ném lỗi ngay sau
                           khi đã lưu xong — mất dữ liệu thì không, nhưng người dùng thấy "lỗi" dù
                           khách đã được tạo, rồi bấm Lưu lần nữa thành hai khách trùng tên. */
  async function openForm(tab, row, perm, opts) {
    opts = opts || {};
    const isEdit = !!row;
    const dl = row || opts.giaTriSan || null;   // nguồn điền sẵn (sửa: bản ghi cũ; thêm: giá trị gợi ý)
    await napOptions(tab.fields);   // v7.81
    const html = `
      <h3>${isEdit ? 'Sửa' : 'Thêm'} - ${tab.label}</h3>
      <form id="dmForm">
        ${tab.fields.map(f => (f.options || f.type)
          ? fieldHtml(f, dl)       // v7.81: ô chọn / checkbox / số / ngày -> dùng bộ dựng ô chung
          : `<div class="form-row"><label>${f.label}${f.required ? ' *' : ''}</label>
          <input name="${f.name}" value="${escapeHtml(dl ? (dl[f.name] == null ? '' : dl[f.name]) : '')}" ${f.required ? 'required' : ''}></div>`).join('')}
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wireOAnh(modal);   // v8.94: ô ảnh (xem trước + nút Bỏ ảnh)
    modal.querySelector('#dmForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      const fdChung = new FormData(e.target);
      try {
        /* v8.94: upload ảnh TRƯỚC khi dựng body — cần await nên không nằm trong forEach. */
        await uploadOAnh(e.target, tab.fields);
      } catch (err) { toast('Tải ảnh lên thất bại: ' + err.message, 'error'); return; }
      const fdSauAnh = new FormData(e.target);
      tab.fields.forEach(f => {
        // v6.31: checkbox không tick thì FormData KHÔNG có khoá đó -> phải tự gửi 0, kẻo cột BIT
        // giữ nguyên giá trị cũ và người dùng tưởng đã bỏ tick.
        if (f.type === 'checkbox') { body[f.name] = fdChung.get(f.name) ? 1 : 0; return; }
        // v8.94: ảnh — gửi URL (chuỗi rỗng => null = xóa ảnh). Luôn gửi khóa này: backend chỉ giữ ảnh
        // cũ khi KHÔNG có khóa; form thì có ý định rõ ràng nên phải nói ra.
        if (f.type === 'image') { const u = String(fdSauAnh.get(f.name) || '').trim(); body[f.name] = u || null; return; }
        const v = fdChung.get(f.name);
        body[f.name] = (f.type === 'number') ? (String(v || '').trim() === '' ? null : Number(v)) : v;
      });
      try {
        if (isEdit) await apiPut(`${tab.api}/${row[tab.idCol]}`, body);
        else await apiPost(tab.api, body);
        closeModal(); toast('Đã lưu.', 'success');
        if (opts.sauKhiLuu) await opts.sauKhiLuu(body);   // v9.92: phân hệ khác tự lo phần sau khi lưu
        else render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     🔴 v9.92 — MƯỢN FORM KHÁCH HÀNG CỦA DANH MỤC (Nguyen 23/11)

     *"khách mới lưu danh mục đầy đủ trường như thêm ở danh mục (gọi luôn form nhập ở danh mục khách
     hàng)"*. Trước đây phiếu bán hàng có hộp thoại "thêm khách nhanh" RIÊNG, chỉ 4 ô (tên, SĐT, địa
     chỉ, email) — khách tạo từ đó thiếu Tên viết hóa đơn, MST, địa chỉ/email hóa đơn, % CK ký gửi,
     Nhóm khách hàng. Nay dùng ĐÚNG MỘT form, khai ở TABS['khachhang'] — thêm trường vào danh mục là
     phiếu bán hàng có ngay, không phải nhớ sửa hai nơi.

     Dùng CALLBACK chứ không Promise: người dùng bấm Hủy / Esc / ✕ thì không có gì gọi lại, một
     Promise sẽ treo mãi mãi (và giữ luôn closure của form bán hàng). Callback chỉ chạy khi LƯU XONG.

     `apiPost /api/danhmuc/khachhang` KHÔNG trả về ID, nên đọc lại danh mục rồi lấy bản ghi mới nhất
     trùng tên — y cách themKhachNhanh() cũ vẫn làm.
     ================================================================================================ */
  async function moFormKhachHang(tenGoiY, xongThiGoi) {
    const tab = TABS.find(t => t.key === 'khachhang');
    if (!tab) { toast('Không tìm thấy khai báo danh mục Khách hàng.', 'error'); return; }
    await openForm(tab, null, { canCreate: true }, {
      giaTriSan: String(tenGoiY || '').trim() ? { TenKhachHang: String(tenGoiY).trim() } : null,
      sauKhiLuu: async (body) => {
        const ten = String(body.TenKhachHang || '').trim();
        let k = null;
        try {
          const ds = (await apiGet('/api/danhmuc/khachhang')).data || [];
          k = ds.filter(x => String(x.TenKhachHang) === ten).sort((a, b) => b.KhachHangID - a.KhachHangID)[0] || null;
        } catch (e) { /* đọc lại hỏng thì vẫn trả bản tạm bên dưới — khách ĐÃ tạo rồi, đừng báo lỗi */ }
        if (xongThiGoi) xongThiGoi(k || { KhachHangID: '', TenKhachHang: ten, SDT: body.SDT || '', DiaChi: body.DiaChi || '' });
      }
    });
  }

  function openCustomForm(tab, fields, row, perm, extraHtml, onSubmit) {
    /* v7.88: cột `chiXem` (số hệ thống tự tính, vd Giá nhập) KHÔNG được vào form — dựng ra ô nhập
       cho một con số không sửa được là mời người dùng gõ vào rồi bấm Lưu và tưởng đã đổi. */
    const oNhap = fields.filter(f => !f.chiXem);
    const html = `
      <h3>${row ? 'Sửa' : 'Thêm'} - ${tab.label}</h3>
      <form id="dmForm">
        ${oNhap.map(f => fieldHtml(f, row)).join('')}
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
      oNhap.forEach(f => { body[f.name] = fd.get(f.name); });
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
  /* ============================================================================================
     v8.94 — Ô ẢNH trong form danh mục (kiểu 'image', xem fieldHtml).
     wireOAnh(modal):  chọn file -> xem trước ngay (blob URL, chưa upload); bấm "Bỏ ảnh" -> xóa ô ẩn,
                       xóa xem trước, xóa cả file đang chọn.
     uploadOAnh(form, fields): gọi lúc Lưu — ô file nào có file thì upload qua /api/upload (common.js
                       uploadFile) rồi ghi URL vào ô ẩn cùng tên. Upload hỏng thì ném lỗi, form KHÔNG
                       lưu nửa chừng (không để tên màu lưu rồi mà ảnh mất).
     ============================================================================================ */
  function wireOAnh(modal) {
    modal.querySelectorAll('input[type=file][data-anh-cho]').forEach(oFile => {
      const ten = oFile.dataset.anhCho;
      const oXem = modal.querySelector(`[data-anh-xem="${ten}"]`);
      const oBo = modal.querySelector(`[data-anh-bo="${ten}"]`);
      oFile.addEventListener('change', () => {
        const f = oFile.files && oFile.files[0];
        if (!f) return;
        if (oXem) oXem.innerHTML = `<img src="${URL.createObjectURL(f)}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:4px;border:1px solid #dce3ea;">`;
        if (oBo) oBo.style.display = '';
      });
      if (oBo) oBo.addEventListener('click', () => {
        const oAn = modal.querySelector(`input[type=hidden][name="${ten}"]`);
        if (oAn) oAn.value = '';
        oFile.value = '';
        if (oXem) oXem.innerHTML = '';
        oBo.style.display = 'none';
      });
    });
  }
  async function uploadOAnh(form, fields) {
    for (const f of (fields || []).filter(x => x.type === 'image')) {
      const oFile = form.querySelector(`input[type=file][data-anh-cho="${f.name}"]`);
      const oAn = form.querySelector(`input[type=hidden][name="${f.name}"]`);
      const file = oFile && oFile.files && oFile.files[0];
      if (!file || !oAn) continue;
      oAn.value = await uploadFile(file, 'mau');
    }
  }

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
    /* v8.94: kiểu 'image' — ảnh hiện tại (nếu có) + ô chọn file + nút bỏ ảnh.
       Giá trị thật nằm ở <input type="hidden" name=f.name> (URL /uploads/…). Ô file KHÔNG có name
       nên FormData không gửi nó; openForm() tự upload rồi ghi URL vào ô ẩn trước khi gửi.
       `data-anh-cho` nối ô file với ô ẩn — đừng đổi tên thuộc tính này mà không sửa openForm. */
    if (f.type === 'image') {
      const url = val == null ? '' : String(val);
      return `<div class="form-row"><label>${f.label}</label>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <span class="anh-xem" data-anh-xem="${f.name}">${anhMauThuNhoHtml(url, 64)}</span>
          <input type="hidden" name="${f.name}" value="${escapeHtml(url)}">
          <input type="file" accept="image/*" data-anh-cho="${f.name}" style="font-size:12px;max-width:240px;">
          <button type="button" class="btn small secondary" data-anh-bo="${f.name}" ${url ? '' : 'style="display:none;"'}>Bỏ ảnh</button>
        </div>
        <div class="empty-hint" style="margin-top:2px;">Chọn ảnh mới để thay; "Bỏ ảnh" để xóa ảnh đang có.</div></div>`;
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

  // v9.92: moFormKhachHang để phiếu bán hàng (module.khohang.js) gọi đúng form này, không dựng form thứ hai.
  return { render, getTabs, moFormKhachHang };
})();
