// Phan he QUAN LY SAN XUAT
window.ModuleQLSX = (function () {
  let activeTab = 'dashboard';
  let container, currentUser, dm = null;

  // v5.0: them tab "Ra lenh san xuat" (tach rieng khoi "Danh sach don hang", chi hien voi nguoi co
  // quyen tao don) va "Don gia cong doan may" (man hinh danh muc/dinh gia, xem duoc voi ai co quyen
  // xem QLSX, chinh sua can quyen tao/sua tuong ung o tung nut).
  function getTabs(user) {
    const perm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.QLSX || {});
    const tabs = [{ key: 'dashboard', label: 'Dashboard' }];
    if (perm.canCreate) tabs.push({ key: 'ralenh', label: 'Chỉ định sản xuất' });   // v5.34: đổi tên từ "Ra lệnh sản xuất"
    tabs.push({ key: 'bosungsodo', label: 'Bổ sung sơ đồ' });   // v5.54: shortcut vào Kỹ thuật ghi sơ đồ. v5.55: đẩy KHÔNG điều kiện (ẩn/hiện theo ChucNang 'bosungsodo' như các tab khác, không phụ thuộc quyền TẠO phân hệ)
    // v5.2: doi ten "Danh sach don hang" -> "Danh sach lenh san xuat" (yeu cau v5.2 muc 3d).
    tabs.push({ key: 'orders', label: 'Danh sách lệnh sản xuất' });
    // v5.35: tab standalone "Đơn giá công đoạn may" (danh mục hệ thống cũ CongDoanMay/DonGiaCongDoanMay) ĐÃ BỎ —
    // đơn giá công đoạn may nay khai THEO ĐƠN ở "Tài liệu may/Đóng gói" > "Đơn giá công đoạn may".
    // v5.24 (muc 1.1.1, "thêm trường đơn giá Giao gia công. Thêm nhiều dòng đơn giá"): dinh ban dau la
    // tab danh muc rieng mirror "Đơn giá công đoạn may" - nhung tab 'dongiagiacong' CHUA BAO GIO co ham
    // render (renderDonGiaGiaCong khong ton tai -> bam vao se loi ReferenceError). v5.25 (phan hoi truc
    // tiep "Đơn giá sẽ được nhập liệu ở chỗ này không cần thêm chức năng đơn giá gia công (xóa chức năng
    // đơn giá gia công)"): BO HAN tab nay - hang muc gia cong khai bao/them moi ("+ Mới") truc tiep NGAY
    // tai khu vuc "Đơn giá Giao gia công" trong Ky thuat (xem hangMucGiaCongChonHtml() duoi), khong can
    // man hinh danh muc rieng nua.
    // v5.14: các tài liệu (render bởi window.ModuleTaiLieuKyThuat) hiện thành tab trên menu QLSX.
    // v5.44.4: ĐÃ ẨN tab "Tài liệu kỹ thuật" (tài liệu chung) theo yêu cầu — chỉ IN qua nút "In tài liệu KT"
    // ở Danh sách lệnh SX. Nhập/sửa thông số đo / mô tả / quy cách vẫn ở tab "Tài liệu may/Đóng gói".
    // (Nhánh route 'tailieukythuat' trong render() vẫn giữ nhưng không còn lối vào từ menu.)
    tabs.push({ key: 'tailieumay', label: 'Tài liệu may/Đóng gói' });   // v5.34 (Giai doan B)
    tabs.push({ key: 'tailieuinthe', label: 'Tài liệu in thêu' });   // v5.34c (muc 7)
    tabs.push({ key: 'bangkebtp', label: 'Bảng kê BTP' });   // v5.34 (Giai doan A)
    tabs.push({ key: 'chidinhvaisx', label: 'Chỉ định vải SX' });   // v5.47: KHÔI PHỤC (ẩn/hiện theo phân quyền ChucNang 'chidinhvaisx')
    tabs.push({ key: 'chidinhnpl', label: 'Chỉ định NPL' });   // v5.50: TÁCH RA tab riêng (trước là mục con của "Tài liệu may/Đóng gói"); ẩn/hiện theo ChucNang 'chidinhnpl'
    // v6.04: "Định mức & Hao hụt" CHUYỂN từ phân hệ Kho vải sang đây (ChucNang QLSX/dinhmuc, migration_v664).
    tabs.push({ key: 'dinhmuc', label: 'Định mức & Hao hụt' });
    tabs.push({ key: 'giathanh', label: 'Giá thành sản phẩm' });   // v6.15 (ChucNang QLSX/giathanh, migration_v665)
    // v5.19 (muc 1.1.2 + 1.4): chuc nang con MOI "Chỉ định vải SX" - man hinh khai bao KG vai yeu cau
    // (tai su dung Cau truc vai cua Ra lenh san xuat). An/hien qua Ma tran phan quyen (ChucNangPermissions)
    // nhu moi tab khac - xem visibleTabsOf() trong app.js.
    // v5.24: "Giao nhà gia công" (tab rieng tu v5.19) da BO HAN - viec giao nha gia cong (chon nha +
    // don gia + so luong) gio la 1 phan cua cong doan 'GC' trong Ghi nhan tien do, khong con 2 noi song
    // song lam CUNG 1 viec nua (phan hoi nguoi dung "có những công đoạn trùng nhau"). v5.24/v5.25 tam
    // thoi giu lai "Nhận nhà gia công" nhu 1 tab THUAN XEM rieng.
    // v5.26 (phan hoi truc tiep, xac nhan qua AskUserQuestion: "Giữ lại Giao gia công... bỏ hẳn 'Giao nhà
    // gia công'/'Nhận nhà gia công'"): BO HAN NOT tab "Nhận nhà gia công" - gio KHONG con tab/chuc nang
    // rieng nao cho nha gia cong nua, TOAN BO (gan + xem lai) chi con o dung 1 noi DUY NHAT: cong doan
    // 'GC' trong Ghi nhan tien do (nhap tai cho) + bao cao "Lịch sử cập nhật tiến độ" khi in lenh san xuat
    // (xem khoi tiem log o qlsx.js, da phuc hoi tu v5.25 - gio la NGUON XEM LAI DUY NHAT, khong con du
    // thua voi 1 tab rieng nua).
    // v5.27 (1.2): tab "Chỉ định vải SX" da BO - loai vai o Ra lenh SX gio go tu do, khong con rang buoc
    // xuat vai theo don (xem khovai.js GET /orders + /vaichophep da noi long). ChucNang 'chidinhvaisx'
    // mo coi (giu nguyen quy uoc); cot DonHangChiTietVai.DVTVaiYeuCau/SoKGYeuCau mo coi (khong xoa).
    // v5.21 (muc 8, "Tách Giao nhà in thêu, nhận nhà in thêu ra thành chức năng riêng trong Quản lý sản
    // xuất... không phải trong ghi nhận tiến độ"): 2 tab MOI, doc lap voi luong Ghi nhan tien do (tu
    // v5.22, "Giao/Nhận nhà gia công" o tren CUNG doc lap tuong tu, khong con la cong doan trong luong
    // do nua) - xem renderGiaoNhanNhaInTheu() o duoi.
    // v5.32: 2 tab "Giao/Nhận nhà in thêu" da BO - in theu gio la 2 CONG DOAN (GIT/NIT) trong Ghi nhan
    // tien do (chen giua Cat va Giao gia cong). renderGiaoNhanNhaInTheu() giu lai nhung khong con loi vao (mo coi).
    return tabs;
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    // v5.3: giao voi quyen rieng theo chuc nang (tab dang mo) - xem effectivePerm() trong common.js.
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.QLSX || {});
    const perm = effectivePerm(user, 'QLSX', activeTab, rawPerm);
    if (!dm) dm = (await apiGet('/api/qlsx/danhmuc')).data;

    container.innerHTML = `<div id="qBody"></div>`;

    if (activeTab === 'ralenh') return renderRaLenh(perm);
    if (activeTab === 'bosungsodo') return renderBoSungSoDo(perm);   // v5.54
    if (activeTab === 'dashboard') return renderDashboard(perm);
    // v5.32: routing 'giaonhaintheu'/'nhannhaintheu' da bo (in theu -> cong doan GIT/NIT trong Ghi nhan tien do).
    // v5.14: giao toan bo tab nay cho module rieng (window.ModuleTaiLieuKyThuat) - chuc nang con
    // (tailieuchung/thongsodo/chidinhnpl/motasp) tu quan ly UI/quyen rieng ben trong module do.
    if (activeTab === 'tailieukythuat') return window.ModuleTaiLieuKyThuat.render(document.getElementById('qBody'), currentUser, 'tlkt');
    if (activeTab === 'tailieumay') return window.ModuleTaiLieuKyThuat.render(document.getElementById('qBody'), currentUser, 'tlmay');   // v5.34 (Giai doan B)
    if (activeTab === 'tailieuinthe') return window.ModuleTaiLieuKyThuat.render(document.getElementById('qBody'), currentUser, 'tlinthue');   // v5.34c (muc 7)
    if (activeTab === 'bangkebtp') return window.ModuleBangKeBTP.render(document.getElementById('qBody'), currentUser);   // v5.34
    if (activeTab === 'chidinhvaisx') return renderChiDinhVaiSX(perm);   // v5.47: KHÔI PHỤC "Chỉ định vải SX"
    if (activeTab === 'dinhmuc') return renderDinhMucHaoHut(perm);   // v6.04: chuyển từ Kho vải sang
    if (activeTab === 'giathanh') return renderGiaThanh(perm);       // v6.15
    if (activeTab === 'chidinhnpl') return window.ModuleTaiLieuKyThuat.render(document.getElementById('qBody'), currentUser, 'chidinhnpl');   // v5.50: tab riêng, dùng nhóm 'chidinhnpl' của ModuleTaiLieuKyThuat
    // v5.6: "Danh sách lệnh sản xuất" gio gom 2 nhom quyen KHAC NHAU tu khi tach chuc nang o backend -
    // "Sửa"/"Xóa" (lenh san xuat, van chuc nang 'orders' - dung "perm" nhu cu) va "Ghi tiến độ"/"Giao
    // nhận nhà gia công" (nay la chuc nang 'tiendo' rieng, xem migration_v56.sql + backend qlsx.js) -
    // phai tinh RIENG permTiendo, khong the dung chung "perm" (dang bi khoa theo 'orders') cho 2 nut do.
    const permTiendo = effectivePerm(user, 'QLSX', 'tiendo', rawPerm);
    // v5.15: dung de an/hien nut "In tài liệu kỹ thuật" o Danh sach lenh san xuat - xem renderOrders().
    const permTLKT = effectivePerm(user, 'QLSX', 'tailieukythuat', rawPerm);
    return renderOrders(perm, permTiendo, permTLKT);
  }

  // v5.47: KHÔI PHỤC "Chỉ định vải SX" — khai KG vải yêu cầu theo từng loại vải/màu của đơn (+ sửa/xóa).
  async function renderChiDinhVaiSX(perm) {
    const body = document.getElementById('qBody');
    const orders = (await apiGet('/api/qlsx/chidinhvaisx')).data || [];
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <h3 style="margin:0;">Chỉ định vải SX</h3>
        ${/* v7.37 TẦNG 3: rà soát toàn hệ thống — tìm dòng chỉ định không ghép được cây vải nào
             (thường do danh mục có 2 bản trùng tên khác ID) mà không phải mở từng đơn. */''}
        <button class="btn small secondary" id="btnRaSoatCdv"
          title="Quét mọi lệnh SX: dòng chỉ định nào không ghép được cây vải nào trong kho, và danh mục nào bị trùng tên khác ID">🔍 Rà soát dữ liệu</button>
      </div>
      <p class="empty-hint">Khai KG vải yêu cầu theo từng loại vải/màu của đơn. Chỉ đơn ĐÃ chỉ định mới được chọn khi lập Phiếu xuất kho vải.</p>
      <table><thead><tr><th>Mã ĐH</th><th>Tên sản phẩm</th><th>Chỉ định</th><th>Xuất kho vải</th><th style="width:330px">Thao tác</th></tr></thead>
      <tbody>${orders.map(o => `<tr>
        <td><a href="#" class="act-cdv-lenh" data-madh="${escapeHtml(o.MaDH)}" title="Xem phiếu In lệnh SX">${escapeHtml(o.MaDH)}</a></td><td>${escapeHtml(o.TenSanPham || '')}</td>
        <td>${o.DaChiDinh ? '<span class="badge green">Đã chỉ định</span>' : '<span class="badge">Chưa</span>'}</td>
        <td>${trangThaiXuatKhoHtml(o)}</td>
        <td><button class="btn small secondary act-cdv" data-madh="${escapeHtml(o.MaDH)}">Chỉ định vải (các bản)</button>
          ${/* v5.69: đã chỉ định thì xuất kho được luôn tại đây */''}
          ${o.DaChiDinh && coQuyenXuatVai() ? `<button class="btn small act-cdv-xuat" data-madh="${escapeHtml(o.MaDH)}" title="Lập Phiếu xuất kho vải cho đơn này">📦 Xuất kho</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="empty-hint">Chưa có đơn hàng</td></tr>'}</tbody></table>`;
    body.querySelectorAll('.act-cdv').forEach(b => b.addEventListener('click', () => openCdvBanList(b.dataset.madh, perm)));   // v5.54: mở danh sách BẢN chỉ định
    body.querySelectorAll('.act-cdv-lenh').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); printLenhSanXuat(b.dataset.madh); }));   // v5.53: click Mã ĐH → In lệnh SX
    body.querySelectorAll('.act-cdv-xuat').forEach(b => b.addEventListener('click', () => xuatKhoTheoChiDinh(b.dataset.madh)));   // v5.69
    body.querySelectorAll('.act-xem-phieuxuat').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); xemPhieuXuatCuaDon(a.dataset.madh); }));   // v5.85
    body.querySelector('#btnRaSoatCdv').addEventListener('click', () => moRaSoatChiDinh(perm));   // v7.37
  }

  /* ================================================================================================
     v7.37 TẦNG 3 — MÀN RÀ SOÁT
     Tầng 1 (Danh mục chặn tạo trùng tên) và tầng 2 (cảnh báo lúc khai) chỉ chặn từ nay trở đi. Dữ
     liệu CŨ đã lệch thì không tầng nào thấy — nên cần một chỗ quét lại một lượt.
     Nhãn nguyên nhân do backend gán (utils/chanDoanChiDinhVai.js), frontend chỉ hiển thị — không tự
     suy diễn lại, tránh hai nơi kết luận khác nhau.
     ================================================================================================ */
  const NHAN_MO_TA = {
    'LECH-ID': 'Lệch ID trùng tên — kho CÓ hàng đúng tên loại+màu nhưng bản ghi danh mục khác ID',
    'THIEU-ID': 'Chưa chọn Loại vải / Màu từ danh mục (gõ tự do)',
    'CON-MET-KG-0': 'Còn mét nhưng KG = 0 — máy chủ chưa cập nhật bản v7.36',
    'LECH-MAU': 'Cùng tên loại vải nhưng khác màu — kiểm tra lại tên màu',
    'LECH-LOAI': 'Cùng tên màu nhưng khác loại vải — kiểm tra lại tên loại vải',
    'HET-THAT': 'Khớp đúng danh mục nhưng đã xuất hết (không phải lỗi)',
    'CHUA-NHAP': 'Kho chưa có cây vải nào loại+màu này (không phải lỗi)'
  };
  const NHAN_MAU = { 'LECH-ID': '#c0392b', 'THIEU-ID': '#c0392b', 'CON-MET-KG-0': '#c0392b' };
  const nhanMauCua = n => NHAN_MAU[n] || '#5f6368';

  /* Bảng "dòng chỉ định không ghép được cây vải". Tách thành hàm riêng thay vì nhúng thẳng vào
     template của modal: khối cũ lồng backtick 3 tầng (map trong map trong ternary) rất dễ sai một
     dấu mà không ai thấy. 7 cột — đúng bằng số <th> khai bên dưới. */
  function bangDongLoi(dsLenh) {
    if (!dsLenh.length) return '<p class="empty-hint">Mọi dòng chỉ định đều ghép được cây vải trong kho.</p>';
    const oDon = (o) => `<td rowspan="${o.dong.length}">`
      + `<a href="#" class="act-rs-cdv" data-madh="${escapeHtml(o.MaDH)}"><b>${escapeHtml(o.MaDH)}</b></a>`
      + `<div style="font-size:11px;color:#5f6368;">${escapeHtml(o.TenSanPham || '')}</div></td>`;
    const oId = (id) => `<span style="color:#5f6368;">#${id == null ? 'NULL' : id}</span>`;
    const motDong = (o, x, i) => '<tr>'
      + (i === 0 ? oDon(o) : '')
      + `<td>${escapeHtml(x.tenPhieu) || '<i style="color:#5f6368;">(không tên)</i>'}</td>`
      + `<td>${escapeHtml(x.kieu || '')}</td>`
      + `<td>${escapeHtml(x.tenLoaiVai) || '<i>—</i>'} ${oId(x.loaiVaiID)}</td>`
      + `<td>${escapeHtml(x.tenMau) || '<i>—</i>'} ${oId(x.mauSacID)}</td>`
      + `<td><b style="color:${nhanMauCua(x.nhan)};">${escapeHtml(x.nhan)}</b></td>`
      + `<td style="font-size:12px;">${escapeHtml(x.lyDo)}</td></tr>`;
    const than = dsLenh.map(o => o.dong.map((x, i) => motDong(o, x, i)).join('')).join('');
    return '<table><thead><tr>'
      + '<th>Mã ĐH</th><th>Bản</th><th>Kiểu</th><th>Loại vải (ID)</th><th>Màu (ID)</th><th>Nhãn</th><th>Lý do</th>'
      + `</tr></thead><tbody>${than}</tbody></table>`;
  }

  async function moRaSoatChiDinh(perm) {
    let d;
    try { d = (await apiGet('/api/qlsx/chidinhvaisx/rasoat')).data; }
    catch (err) { return toast('Không rà soát được: ' + err.message, 'error'); }
    const t = d.tong || {};
    const dsNhan = Object.keys(t.theoNhan || {}).sort((a, b) => t.theoNhan[b] - t.theoNhan[a]);
    const dmL = (d.danhMucTrungTen && d.danhMucTrungTen.loaiVai) || [];
    const dmM = (d.danhMucTrungTen && d.danhMucTrungTen.mauSac) || [];

    /* Gộp các bản trùng tên thành nhóm theo TÊN để đọc được ngay "tên này có mấy ID". */
    const nhomTheoTen = (ds) => {
      const m = new Map();
      ds.forEach(x => { if (!m.has(x.Ten)) m.set(x.Ten, []); m.get(x.Ten).push(x); });
      return [...m.entries()];
    };
    const bangTrung = (ds, nhan) => {
      const nhom = nhomTheoTen(ds);
      if (!nhom.length) return `<p class="empty-hint">Không có ${nhan} nào trùng tên. Danh mục sạch.</p>`;
      return `<table><thead><tr><th>Tên ${nhan}</th><th>Các ID trùng tên</th></tr></thead><tbody>${
        nhom.map(([ten, ds2]) => `<tr>
          <td><b>${escapeHtml(ten)}</b></td>
          <td>${ds2.map(x => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 6px;border:1px solid ${x.SoCay > 0 ? '#137333' : '#ccc'};border-radius:4px;">
              #${x.Id}${x.MaMau ? ' (' + escapeHtml(x.MaMau) + ')' : ''}
              · ${x.SoCay} cây · ${x.SoMaVai} mã vải · ${x.SoChiDinh} chỉ định
              ${x.SoCay > 0 ? '<b style="color:#137333;"> ← bản có hàng, GIỮ bản này</b>' : ''}
            </span>`).join('')}</td></tr>`).join('')
      }</tbody></table>`;
    };

    const md = openModal(`
      <h3>Rà soát Chỉ định vải SX</h3>
      <div style="margin-bottom:10px;">
        Quét <b>${t.soLenhSXQuet || 0}</b> lệnh SX · <b>${t.soDongChiDinh || 0}</b> dòng chỉ định ·
        xuất được <b style="color:#137333;">${t.soDongXuatDuoc || 0}</b> ·
        <b style="color:#c0392b;">${t.soDongLoi || 0}</b> dòng không ghép được cây vải nào
        (ở <b>${t.soLenhSXCoLoi || 0}</b> lệnh SX)
      </div>
      ${dsNhan.length ? '<div style="margin-bottom:10px;">' + dsNhan.map(n =>
        `<div style="font-size:12px;color:${nhanMauCua(n)};"><b>${escapeHtml(n)}</b> × ${t.theoNhan[n]} — ${escapeHtml(NHAN_MO_TA[n] || '')}</div>`
      ).join('') + '</div>' : ''}

      <h4 style="margin:14px 0 6px;">1. Danh mục trùng tên khác ID</h4>
      <p class="empty-hint" style="text-align:left;margin:0 0 6px;">Đây là gốc của lỗi "có tồn đúng loại đúng màu mà không xuất được": chỉ định trỏ bản này, cây vải trỏ bản kia.
        Gộp bằng: <code>node utils/doi_ma_loai_vai.js --tu-id=&lt;bản không có hàng&gt; --den-id=&lt;bản có hàng&gt; --gop --ghi</code></p>
      <div style="max-height:26vh;overflow:auto;">
        ${bangTrung(dmL, 'loại vải')}
        ${bangTrung(dmM, 'màu')}
      </div>

      <h4 style="margin:14px 0 6px;">2. Dòng chỉ định không ghép được cây vải</h4>
      <div style="max-height:34vh;overflow:auto;">${bangDongLoi(d.lenhSXLoi || [])}</div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnDongRS">Đóng</button></div>`);
    md.querySelector('#btnDongRS').addEventListener('click', closeModal);
    /* Bấm Mã ĐH -> mở luôn danh sách bản chỉ định của đơn đó để sửa ngay. */
    md.querySelectorAll('.act-rs-cdv').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault(); openCdvBanList(a.dataset.madh, perm);
    }));
  }

  /* ================================================================================================
     v5.69 — TỪ "CHỈ ĐỊNH VẢI SX" LẬP LUÔN PHIẾU XUẤT KHO VẢI
     Trước đây phải tự sang phân hệ Quản lý kho vải → tab Xuất kho → tìm lại đơn trong danh sách dài.
     Nay bấm "📦 Xuất kho" là chuyển sang đó với form mở sẵn, đơn hàng đã chọn, kèm bảng "Chỉ định vải
     SX (tham khảo)" từng màu (SL chỉ định / mét / đã xuất / còn lại) — thủ kho chỉ việc chọn cây + KG.
     Nút chỉ hiện khi (a) đơn ĐÃ chỉ định và (b) người dùng có quyền SỬA ở phân hệ Quản lý kho vải
     (tab Xuất kho vốn yêu cầu canEdit — xem getTabs trong module.khovai.js).
     ================================================================================================ */
  /* v5.70: trạng thái xuất kho vải của đơn, hiện ngay ở màn Chỉ định vải SX.
     So TỔNG SL chỉ định (mọi bản) với TỔNG KG đã xuất theo các phiếu xuất của đơn:
       chưa có phiếu xuất nào          -> "Chưa xuất"
       đã xuất nhưng còn thiếu so chỉ định -> "Xuất một phần" (kèm số)
       đã xuất >= chỉ định             -> "Đã xuất kho"
     Lưu ý: chỉ định có thể khai theo kg HOẶC mét tùy dòng, còn kho xuất theo KG — nên con số này là
     ĐỐI CHIẾU THAM KHẢO, không phải căn cứ kế toán. Xem chi tiết từng màu ở form Tạo phiếu xuất. */
  function trangThaiXuatKhoHtml(o) {
    const soPhieu = Number(o.SoPhieuXuat) || 0;
    const daXuat = Number(o.TongKGDaXuat) || 0;
    const chiDinh = Number(o.TongKGChiDinh) || 0;
    if (!soPhieu && !daXuat) return '<span class="badge">Chưa xuất</span>';
    const so = `<div style="font-size:11px;color:#5f6368;">${fmtNumber(daXuat)}${chiDinh ? ' / ' + fmtNumber(chiDinh) : ''} kg · ${soPhieu} phiếu</div>`;
    const nhan = (chiDinh > 0 && daXuat < chiDinh)
      ? '<span class="badge warn">Xuất một phần</span>'
      : '<span class="badge green">Đã xuất kho</span>';
    // v5.85: bấm vào trạng thái -> xem DANH SÁCH PHIẾU XUẤT đã lập cho đơn này.
    return `<a href="#" class="act-xem-phieuxuat" data-madh="${escapeHtml(o.MaDH)}" title="Xem các phiếu xuất kho vải của đơn này" style="text-decoration:none;">${nhan}${so}</a>`;
  }

  /* v5.85 — POPUP "CÁC PHIẾU ĐÃ XUẤT" của 1 đơn (bấm vào trạng thái Đã xuất kho / Xuất một phần).
     Lấy qua /api/qlsx/chidinhvaisx/:maDH/phieuxuat (gate theo chức năng 'chidinhvaisx') nên người chỉ
     làm QLSX cũng xem được, không cần thêm quyền phân hệ Kho vải. */
  async function xemPhieuXuatCuaDon(maDH) {
    let rows = [];
    try { rows = (await apiGet('/api/qlsx/chidinhvaisx/' + encodeURIComponent(maDH) + '/phieuxuat')).data || []; }
    catch (err) { toast(err.message, 'error'); return; }
    const modal = openModal(`
      <h3>Phiếu xuất kho vải — ${escapeHtml(maDH)}</h3>
      <table><thead><tr><th>Số phiếu</th><th>Ngày xuất</th><th>Người nhận</th><th>Số cây</th><th style="text-align:right;">Tổng KG</th><th style="text-align:right;">Tổng mét</th><th>Người lập</th><th>Ghi chú</th></tr></thead>
      ${/* v5.97: bấm 1 phiếu để xem chi tiết NGAY TẠI ĐÂY (đóng chi tiết sẽ quay lại danh sách này) */''}
      <tbody>${rows.map(r => `<tr class="act-xem-1px" data-id="${r.PhieuXuatID}" style="cursor:pointer;">
        <td>PXV-${String(r.PhieuXuatID).padStart(5, '0')}</td>
        <td>${fmtDate(r.NgayXuat)}</td><td>${escapeHtml(r.NguoiNhan || '')}</td>
        <td>${fmtNumber(r.SoLuongCay)}</td>
        <td style="text-align:right;">${fmtNumber(r.TongKGXuat)}</td>
        <td style="text-align:right;">${fmtNumber(r.TongMet)}</td>
        <td>${escapeHtml(r.NguoiTao || '')}</td><td>${escapeHtml(r.GhiChu || '')}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty-hint">Chưa có phiếu xuất nào cho đơn này.</td></tr>'}</tbody></table>
      <p class="empty-hint">Bấm vào một phiếu để xem / in chi tiết phiếu đó.</p>
      <div class="modal-actions"><button type="button" class="btn secondary" id="pxClose">Đóng</button></div>`);
    modal.querySelector('#pxClose').addEventListener('click', closeModal);
    modal.querySelectorAll('.act-xem-1px').forEach(tr => tr.addEventListener('click', () => xemChiTietPhieuXuatVai(maDH, tr.dataset.id)));
  }

  /* v5.97 — CHI TIẾT 1 PHIẾU XUẤT KHO VẢI mở ngay từ popup "đã xuất kho" (không phải sang phân hệ
     Quản lý kho vải). Đọc qua route của QLSX nên không cần thêm quyền Kho vải; đóng lại là QUAY VỀ
     danh sách phiếu (cơ chế cửa sổ lồng nhau v5.97). */
  async function xemChiTietPhieuXuatVai(maDH, phieuId) {
    let d;
    try { d = (await apiGet(`/api/qlsx/chidinhvaisx/${encodeURIComponent(maDH)}/phieuxuat/${phieuId}`)).data; }
    catch (err) { toast(err.message, 'error'); return; }
    const h = d.header || {}, lines = d.lines || [];
    const tongKg = lines.reduce((t, r) => t + (Number(r.KGXuat) || 0), 0);
    const tongMet = lines.reduce((t, r) => t + (Number(r.SoMet) || 0), 0);
    const body = `<h2 style="text-align:center;">PHIẾU XUẤT KHO VẢI</h2>
      <p class="p-meta"><b>Số phiếu:</b> PXV-${String(h.PhieuXuatID).padStart(5, '0')} &nbsp; <b>Ngày xuất:</b> ${fmtDate(h.NgayXuat)}</p>
      <p class="p-meta"><b>Đơn hàng:</b> ${escapeHtml(h.MaDH || h.MaDon || '')}${h.MaRap ? ` &nbsp; <b>Mã rập:</b> ${escapeHtml(h.MaRap)}` : ''}${h.TenSanPham ? ` &nbsp; <b>Tên SP:</b> ${escapeHtml(h.TenSanPham)}` : ''}</p>
      <p class="p-meta"><b>Chuyền:</b> ${escapeHtml(h.Chuyen || '')} &nbsp; <b>Người nhận:</b> ${escapeHtml(h.NguoiNhan || '')} &nbsp; <b>Mục đích:</b> ${escapeHtml(h.MucDich || '')}</p>
      ${h.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(h.GhiChu)}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="5">
        <thead><tr><th style="width:38px;">STT</th><th>Kiểu</th><th>Mã cây</th><th>Mã vải</th><th>Loại vải</th><th>Màu</th><th>Khổ vải</th><th>KG xuất</th><th>Số mét</th></tr></thead>
        <tbody>${lines.map((r, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(r.KieuVai || 'Chính')}</td><td>${escapeHtml(r.MaCay || '')}</td>
          <td>${escapeHtml(r.MaVai || '')}</td><td>${escapeHtml(r.TenLoaiVai || '')}</td><td>${escapeHtml(r.TenMau || '')}</td>
          <td style="text-align:right;">${r.KhoVaiThucTe != null ? fmtNumber(r.KhoVaiThucTe) : ''}</td>
          <td style="text-align:right;">${fmtNumber(r.KGXuat)}</td>
          <td style="text-align:right;">${r.SoMet != null ? fmtNumber(r.SoMet) : ''}</td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center;">(phiếu chưa có dòng nào)</td></tr>'}
          <tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="6" style="text-align:right;">TỔNG CỘNG</td>
            <td style="text-align:right;">${fmtNumber(Math.round(tongKg * 100) / 100)}</td>
            <td style="text-align:right;">${tongMet ? fmtNumber(Math.round(tongMet * 100) / 100) : ''}</td></tr>
        </tbody></table>`;
    const modal = openModal(`<h3>Chi tiết phiếu xuất kho vải</h3>
      <div style="max-height:60vh;overflow:auto;">${body}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="px1In">🖨️ In phiếu</button>
        <button type="button" class="btn" id="px1Dong">← Quay lại danh sách</button>
      </div>`);
    modal.querySelector('#px1Dong').addEventListener('click', closeModal);
    modal.querySelector('#px1In').addEventListener('click', () => printHtml('Phieu xuat kho vai PXV-' + h.PhieuXuatID, body));
  }

  function coQuyenXuatVai() {
    if (!currentUser) return false;
    if (currentUser.isAdmin) return true;
    const p = (currentUser.permissions || {}).KHOVAI;
    return !!(p && p.canEdit);
  }
  /* v6.18: quyền SỬA / XÓA của chức năng "Ghi nhận tiến độ" (QLSX/tiendo) — dùng cho nút Sửa/Xóa việc đã
     giao ở công đoạn May. Trước đây 2 nút đó khoá cứng theo cờ isAdmin nên cấp quyền trong Ma trận phân
     quyền không có tác dụng; nay ai được cấp Sửa/Xóa chức năng 'tiendo' là làm được (backend gate y hệt). */
  function permTienDo() {
    if (!currentUser) return {};
    const raw = currentUser.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : ((currentUser.permissions || {}).QLSX || {});
    return effectivePerm(currentUser, 'QLSX', 'tiendo', raw) || {};
  }
  function coQuyenSuaTienDo() { return !!permTienDo().canEdit; }
  function coQuyenXoaTienDo() { return !!permTienDo().canDelete; }
  async function xuatKhoTheoChiDinh(maDH) {
    if (!window.ModuleKhoVai || !window.ModuleKhoVai.openXuatFormChoDon) {
      toast('Không mở được màn hình Xuất kho vải (thiếu quyền hoặc chưa tải xong).', 'error');
      return;
    }
    try { closeModal(); } catch (e) { /* không có modal nào đang mở thì bỏ qua */ }
    await switchModule('KHOVAI', 'xuat');
    await window.ModuleKhoVai.openXuatFormChoDon(maDH);
  }

  // v5.54: 1 đơn có NHIỀU bản chỉ định (mỗi bản 1 tên) — danh sách bản + Thêm/Sửa/Xóa/Xem/In từng bản.
  async function openCdvBanList(maDH, perm) {
    const res = await apiGet('/api/qlsx/chidinhvaisx/' + encodeURIComponent(maDH) + '/phieu');
    const { order, phieu } = res.data;
    const rowsHtml = (phieu && phieu.length ? phieu : []).map(p => `<tr>
        <td>${p.TenPhieu ? escapeHtml(p.TenPhieu) : '<i>(không tên)</i>'}</td>
        <td style="text-align:center;">${p.SoDong}</td>
        <td>
          <button class="btn small secondary cdvb-view" data-ten="${escapeHtml(p.TenPhieu)}">Xem</button>
          <button class="btn small secondary cdvb-print" data-ten="${escapeHtml(p.TenPhieu)}">In</button>
          ${perm.canEdit ? `<button class="btn small secondary cdvb-edit" data-ten="${escapeHtml(p.TenPhieu)}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger cdvb-del" data-ten="${escapeHtml(p.TenPhieu)}">Xóa</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="3" class="empty-hint">Chưa có bản chỉ định nào</td></tr>';
    const modal = openModal(`
      <h3>Chỉ định vải SX — ${escapeHtml(order.MaDH)}${order.TenSanPham ? ' · ' + escapeHtml(order.TenSanPham) : ''}${order.MaRap ? ' · Mã rập: ' + escapeHtml(order.MaRap) : ''}</h3>
      <p class="empty-hint">1 đơn có thể có NHIỀU bản chỉ định — đặt tên để phân biệt (vd Áo / Quần / Đợt 1).</p>
      <table><thead><tr><th>Tên bản</th><th>Số dòng</th><th style="width:240px">Thao tác</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cdvbClose">Đóng</button>
        ${/* v5.69: xuất kho ngay từ đây (chỉ khi đã có ít nhất 1 bản chỉ định) */''}
        ${(phieu && phieu.length && coQuyenXuatVai()) ? '<button type="button" class="btn secondary" id="cdvbXuat">📦 Xuất kho theo chỉ định</button>' : ''}
        ${perm.canEdit ? '<button type="button" class="btn" id="cdvbAdd">+ Thêm chỉ định</button>' : ''}
      </div>`);
    modal.querySelector('#cdvbClose').addEventListener('click', closeModal);
    const xuatBtn = modal.querySelector('#cdvbXuat');
    if (xuatBtn) xuatBtn.addEventListener('click', () => xuatKhoTheoChiDinh(maDH));
    const addBtn = modal.querySelector('#cdvbAdd');
    if (addBtn) addBtn.addEventListener('click', () => openChiDinhVaiSXForm(maDH, '', perm, () => openCdvBanList(maDH, perm)));
    modal.querySelectorAll('.cdvb-edit').forEach(b => b.addEventListener('click', () => openChiDinhVaiSXForm(maDH, b.dataset.ten, perm, () => openCdvBanList(maDH, perm))));
    modal.querySelectorAll('.cdvb-view').forEach(b => b.addEventListener('click', () => openChiDinhVaiSXView(maDH, b.dataset.ten)));
    modal.querySelectorAll('.cdvb-print').forEach(b => b.addEventListener('click', () => printChiDinhVaiSX(maDH, b.dataset.ten)));
    modal.querySelectorAll('.cdvb-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa bản chỉ định này?')) return;
      try { await apiDelete('/api/qlsx/chidinhvaisx/' + encodeURIComponent(maDH) + '?ten=' + encodeURIComponent(b.dataset.ten)); toast('Đã xóa bản.', 'success'); openCdvBanList(maDH, perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }
  /* v6.43: gợi ý ĐVT cho các ô GÕ TỰ DO ở Ra lệnh SX. Datalist phải nằm một bản duy nhất trong trang
     (id trùng nhau thì trình duyệt chỉ dùng bản đầu), nên gắn thẳng vào <body> và cập nhật nội dung
     mỗi lần gọi. Trả '' để nhúng được vào chuỗi template ngay chỗ dựng dòng. */
  function ensureDlCvDonVi() {
    let el = document.getElementById('dlCvDonVi');
    if (!el) { el = document.createElement('datalist'); el.id = 'dlCvDonVi'; document.body.appendChild(el); }
    el.innerHTML = (dm && dm.donViTinh || []).map(x => `<option value="${escapeHtml(x.TenDonVi)}">`).join('');
    return '';
  }

  /* v6.43: ô Khách hàng ở Ra lệnh SX giờ là CHỮ. Tách ra 2 đường lưu:
       - gõ TRÙNG tên một khách trong danh mục (không phân biệt hoa/thường, bỏ khoảng trắng thừa)
         -> vẫn lưu khóa nối KhachHangID như trước, công nợ và lọc theo khách không đứt liên kết;
       - gõ tên LẠ -> lưu chữ vào cột riêng của lệnh, Danh mục khách hàng KHÔNG bị thêm gì.
     Để ở mức module vì cả form Ra lệnh SX lẫn form Sửa lệnh đều gọi. */
  /* v6.44: ô SỐ ở Ra lệnh SX cho GÕ TỰ DO.
     `type="number"` không khai `step` thì mặc định step=1 -> chặn luôn số lẻ ("1,5" và cả "1.5" đều
     bị báo "hai giá trị hợp lệ gần nhất là 1 và 2"), lại còn không nhận dấu PHẨY thập phân là kiểu gõ
     quen của bàn phím tiếng Việt. Đổi ô sang chữ và tự đọc số ở đây.
     Quy ước Việt Nam: '.' phân cách nghìn, ',' phân cách thập phân -> "1.234,5" = 1234.5.
     Chỉ có MỘT dấu '.' và không có ',' thì hiểu là dấu thập phân (người gõ "1.5" ý là một rưỡi). */
  function soTuDo(v) {
    let s = String(v == null ? '' : v).trim().replace(/\s+/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function tachKhachHang(ten) {
    const t = String(ten || '').trim();
    if (!t) return { khachHangId: null, tenKhachHangTuDo: null };
    const chuan = s => String(s || '').trim().toLowerCase();
    const kh = ((dm && dm.khachHang) || []).find(k => chuan(k.TenKhachHang) === chuan(t));
    return kh
      ? { khachHangId: kh.KhachHangID, tenKhachHangTuDo: null }
      : { khachHangId: null, tenKhachHangTuDo: t };
  }

  async function openChiDinhVaiSXForm(maDH, tenPhieu, perm, onDone) {
    tenPhieu = tenPhieu || '';
    const res = await apiGet('/api/qlsx/chidinhvaisx/' + encodeURIComponent(maDH) + '?ten=' + encodeURIComponent(tenPhieu));
    const { order, rows } = res.data;
    const _rows = rows;
    let cdvIdx = 0;
    function rowHtml(r) {
      const id = ++cdvIdx;
      return `<div class="form-grid" data-cdvrow data-idx="${id}" style="grid-template-columns:110px 1.4fr 1.4fr 1fr .8fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;">
        <div><label>Kiểu</label><select class="cdv-kieu"><option value="Chính" ${r && r.Kieu === 'Phối' ? '' : 'selected'}>Chính</option><option value="Phối" ${r && r.Kieu === 'Phối' ? 'selected' : ''}>Phối</option></select></div>
        <div><label>Loại vải</label><input class="cdv-lv" list="dlCdvLoaiVai" value="${r ? escapeHtml(r.TenLoaiVai || '') : ''}" placeholder="Gõ tìm / gõ mới" autocomplete="off"></div>
        <div><label>Màu</label><input class="cdv-ms" list="dlCdvMau" value="${r ? escapeHtml(r.TenMau || '') : ''}" placeholder="Gõ tìm / gõ mới" autocomplete="off"></div>
        ${/* v6.44: GÕ TỰ DO cả 3 ô — màn này chỉ ĐƯA RA CHỈ ĐỊNH, chưa ràng buộc vào tồn kho hay
             phép tính nào. Ô số nhận cả dấu phẩy lẫn dấu chấm (soTuDo). */''}
        <div><label>SL yêu cầu</label><input type="text" inputmode="decimal" class="cdv-kg" placeholder="Gõ tự do" value="${r && r.SoKGYeuCau != null ? escapeHtml(String(r.SoKGYeuCau)) : ''}"></div>
        <div><label>Đơn vị</label>${ensureDlCvDonVi()}<input class="cdv-dvt" list="dlCvDonVi" placeholder="Gõ tự do" autocomplete="off" value="${escapeHtml((r && r.DVTVaiYeuCau) || 'Kg')}"></div>
        <div><label>SL yêu cầu (mét)</label><input type="text" inputmode="decimal" class="cdv-met" placeholder="Gõ tự do" value="${r && r.SoMet != null ? escapeHtml(String(r.SoMet)) : ''}"></div>
        <div><button type="button" class="btn small danger cdv-remove">X</button></div>
      </div>`;
    }
    const modal = openModal(`
      <h3>Chỉ định vải SX — ${escapeHtml(order.MaDH)}${order.TenSanPham ? ' · ' + escapeHtml(order.TenSanPham) : ''}${order.MaRap ? ' · Mã rập: ' + escapeHtml(order.MaRap) : ''}</h3>
      <p class="empty-hint">Loại vải/Màu: <b>gõ để tìm</b> trong danh mục HOẶC <b>gõ tên mới</b> (vải chưa có — chỉ định trước, mua sau; hệ thống tự thêm vào danh mục). Rõ <b>Chính/Phối</b> + SL yêu cầu. Độc lập với Ra lệnh SX.</p>
      <datalist id="dlCdvLoaiVai">${dm.loaiVai.map(x => `<option value="${escapeHtml(x.TenLoaiVai)}"></option>`).join('')}</datalist>
      <datalist id="dlCdvMau">${dm.mauSac.map(x => `<option value="${escapeHtml(x.TenMau)}"></option>`).join('')}</datalist>
      <div class="form-row"><label>Tên bản chỉ định</label><input id="cdvTen" value="${escapeHtml(tenPhieu)}" placeholder="VD: Áo / Quần / Đợt 1 (để trống nếu chỉ 1 bản)" ${perm.canEdit ? '' : 'disabled'}></div>
      <div id="cdvRows">${(_rows && _rows.length ? _rows.map(rowHtml) : [rowHtml(null)]).join('')}</div>
      ${perm.canEdit ? '<button type="button" class="btn small secondary" id="cdvAdd">+ Thêm dòng</button>' : ''}
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cdvClose">Đóng</button>
        ${perm.canEdit ? '<button type="button" class="btn" id="cdvSave">💾 Lưu</button>' : ''}
      </div>`);
    function wireRow(rowEl) {
      const rm = rowEl.querySelector('.cdv-remove');
      if (rm) rm.addEventListener('click', () => { if (modal.querySelectorAll('#cdvRows > [data-cdvrow]').length > 1) rowEl.remove(); });
    }
    modal.querySelectorAll('#cdvRows > [data-cdvrow]').forEach(wireRow);
    modal.querySelector('#cdvClose').addEventListener('click', closeModal);
    const addBtn = modal.querySelector('#cdvAdd');
    if (addBtn) addBtn.addEventListener('click', () => {
      const box = modal.querySelector('#cdvRows');
      box.insertAdjacentHTML('beforeend', rowHtml(null));
      wireRow(box.lastElementChild);
    });
    const saveBtn = modal.querySelector('#cdvSave');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const items = Array.from(modal.querySelectorAll('#cdvRows > [data-cdvrow]')).map(rowEl => {
        return {
          kieu: rowEl.querySelector('.cdv-kieu').value,
          tenLoaiVai: (rowEl.querySelector('.cdv-lv').value || '').trim(),
          tenMau: (rowEl.querySelector('.cdv-ms').value || '').trim(),
          soKG: soTuDo(rowEl.querySelector('.cdv-kg').value),     // v6.44: ô chữ, hiểu cả dấu phẩy
          soMet: soTuDo(rowEl.querySelector('.cdv-met').value),
          dvt: rowEl.querySelector('.cdv-dvt') ? rowEl.querySelector('.cdv-dvt').value : 'Kg'   // v5.53: đơn vị chọn theo list
        };
      });
      const tenMoi = (modal.querySelector('#cdvTen') ? modal.querySelector('#cdvTen').value : '').trim();   // v5.54: tên bản
      try {
        const kq = await apiPut('/api/qlsx/chidinhvaisx/' + encodeURIComponent(maDH), { ten: tenMoi, oldTen: tenPhieu, items });
        toast('Đã lưu chỉ định vải SX.', 'success');
        closeModal();
        /* v7.37 TẦNG 2: backend chẩn đoán ngay các dòng vừa lưu. Dòng nào không ghép được cây vải
           nào trong kho thì hiện lý do LUÔN TẠI ĐÂY — trước đây phải đến lúc lập phiếu xuất mới
           phát hiện, mà form xuất chỉ nói chung "Không tìm thấy cây vải phù hợp".
           KHÔNG chặn lưu: chỉ định trước rồi mua vải sau là nghiệp vụ thật (v5.47.2). */
        if (Array.isArray(kq.canhBao) && kq.canhBao.length) baoCanhBaoChiDinh(maDH, kq.canhBao, perm);
        else if (onDone) onDone(); else render(container, currentUser);
      }
      catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     v7.37 TẦNG 2 — POPUP CẢNH BÁO SAU KHI LƯU CHỈ ĐỊNH VẢI SX
     Đã LƯU rồi mới báo (không chặn), vì "chỉ định trước - mua vải sau" là nghiệp vụ thật. Mục đích
     là để người khai biết NGAY dòng nào sẽ không xuất kho được và vì sao, thay vì đến lúc thủ kho
     lập phiếu xuất mới phát hiện.
     Nhãn + lý do do backend gán (utils/chanDoanChiDinhVai.js) — frontend không tự suy diễn lại.
     ================================================================================================ */
  function baoCanhBaoChiDinh(maDH, canhBao, perm) {
    const nang = canhBao.filter(x => NHAN_MAU[x.nhan]);       // LECH-ID / THIEU-ID / CON-MET-KG-0
    const nhe = canhBao.filter(x => !NHAN_MAU[x.nhan]);       // HET-THAT / CHUA-NHAP: không phải lỗi
    const md = openModal(`
      <h3>Đã lưu — nhưng ${canhBao.length} dòng chưa xuất kho được</h3>
      <p class="empty-hint" style="text-align:left;">Chỉ định đã lưu xong. Các dòng dưới đây hiện <b>không ghép được cây vải nào còn hàng</b> trong kho,
        nên khi lập Phiếu xuất kho vải sẽ không thấy cây để chọn.</p>
      ${nang.length ? `<div style="border-left:3px solid #c0392b;padding:8px 10px;margin-bottom:10px;background:#fdf3f2;">
        <b style="color:#c0392b;">Cần xử lý (${nang.length})</b>
        ${nang.map(x => `<div style="margin-top:6px;font-size:13px;">
          <b>${escapeHtml(x.nhan)}</b> · ${escapeHtml(x.kieu || '')} — ${escapeHtml(x.lyDo)}</div>`).join('')}
      </div>` : ''}
      ${nhe.length ? `<div style="border-left:3px solid #bbb;padding:8px 10px;margin-bottom:10px;">
        <b>Chỉ để biết (${nhe.length})</b> — chưa có hàng, không phải lỗi khai báo
        ${nhe.map(x => `<div style="margin-top:6px;font-size:13px;color:#5f6368;">
          <b>${escapeHtml(x.nhan)}</b> · ${escapeHtml(x.kieu || '')} — ${escapeHtml(x.lyDo)}</div>`).join('')}
      </div>` : ''}
      ${nang.some(x => x.nhan === 'LECH-ID') ? `<p class="empty-hint" style="text-align:left;">
        <b>LECH-ID</b> nghĩa là danh mục đang có <b>hai bản ghi trùng tên khác ID</b> — hàng trong kho trỏ bản này,
        chỉ định trỏ bản kia. Bấm <b>🔍 Rà soát dữ liệu</b> ở màn Chỉ định vải SX để xem bản nào đang giữ hàng, rồi gộp lại.</p>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn small secondary" id="btnRSTuCanhBao">🔍 Rà soát dữ liệu</button>
        <button type="button" class="btn secondary" id="btnDongCB">Đóng</button></div>`);
    const dong = () => { closeModal(); render(container, currentUser); };
    md.querySelector('#btnDongCB').addEventListener('click', dong);
    md.querySelector('#btnRSTuCanhBao').addEventListener('click', () => { closeModal(); moRaSoatChiDinh(perm); });
    void maDH;
  }

  // v5.51: bản Xem/In "Chỉ định vải SX" (dùng chung 1 HTML) — cột SL yêu cầu (kg) + (mét).
  function buildChiDinhVaiSXHtml(order, rows, ten) {
    const body = (rows && rows.length ? rows.map((r, i) => `<tr>
        <td>${i + 1}</td><td>${escapeHtml(r.Kieu || 'Chính')}</td>
        <td>${escapeHtml(r.TenLoaiVai || '')}</td><td>${escapeHtml(r.TenMau || '')}</td>
        <td style="text-align:right;">${r.SoKGYeuCau != null ? fmtNumber(r.SoKGYeuCau) + ' (' + escapeHtml(r.DVTVaiYeuCau || 'Kg') + ')' : ''}</td>
        <td style="text-align:right;">${r.SoMet != null ? fmtNumber(r.SoMet) : ''}</td>
      </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;">Chưa có chỉ định</td></tr>');
    return `<h2 style="text-align:center;margin:0 0 4px;">CHỈ ĐỊNH VẢI SẢN XUẤT</h2>
      <p style="text-align:center;margin:0 0 10px;">${fmtNgayThangNam(new Date())}</p>
      <p><b>Mã ĐH:</b> ${escapeHtml(order.MaDH || '')} &nbsp; <b>Sản phẩm:</b> ${escapeHtml(order.TenSanPham || '')} &nbsp; <b>Mã rập:</b> ${escapeHtml(order.MaRap || '')}${ten ? ' &nbsp; <b>Bản:</b> ' + escapeHtml(ten) : ''}</p>
      <table><thead><tr><th>STT</th><th>Kiểu</th><th>Loại vải</th><th>Màu</th><th>SL yêu cầu</th><th>SL yêu cầu (mét)</th></tr></thead>
      <tbody>${body}</tbody></table>`;
  }
  async function openChiDinhVaiSXView(maDH, ten) {
    ten = ten || '';
    const res = await apiGet('/api/qlsx/chidinhvaisx/' + encodeURIComponent(maDH) + '?ten=' + encodeURIComponent(ten));
    const { order, rows } = res.data;
    const modal = openModal(`${buildChiDinhVaiSXHtml(order, rows, ten)}
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="cdvvClose">Đóng</button>
        <button type="button" class="btn" id="cdvvPrint">🖨️ In</button>
      </div>`);
    modal.querySelector('#cdvvClose').addEventListener('click', closeModal);
    modal.querySelector('#cdvvPrint').addEventListener('click', () => printHtml('Chỉ định vải SX - ' + maDH, buildChiDinhVaiSXHtml(order, rows, ten)));
  }
  async function printChiDinhVaiSX(maDH, ten) {
    ten = ten || '';
    const res = await apiGet('/api/qlsx/chidinhvaisx/' + encodeURIComponent(maDH) + '?ten=' + encodeURIComponent(ten));
    const { order, rows } = res.data;
    printHtml('Chỉ định vải SX - ' + maDH, buildChiDinhVaiSXHtml(order, rows, ten));
  }

  async function renderDashboard(perm) {
    const body = document.getElementById('qBody');
    const res = await apiGet('/api/qlsx/dashboard');
    const d = res.data;
    // v5.5: "orders" (toan bo don hang, khong loc) da co san trong response tu truoc nhung frontend
    // chua tung dung - dung lai NGAY DAY de loc phia trinh duyet cho cac the/so co the bam (trang
    // thai, cong doan, nha gia cong/in) MA KHONG can goi them API nao (yeu cau v5.5: cac bao cao/the
    // deu bam vao xem chi tiet duoc).
    const allOrders = d.orders || [];
    const inProgressOrders = d.ordersInProgress || [];
    body.innerHTML = `
      <div class="stat-row">
        <div class="stat-box act-stat" data-status="" style="cursor:pointer;"><div class="num">${d.total}</div><div class="label">Tổng đơn hàng</div></div>
        <div class="stat-box green act-stat" data-status="Hoàn thành" style="cursor:pointer;"><div class="num">${d.completed}</div><div class="label">Hoàn thành</div></div>
        <div class="stat-box purple act-stat" data-status="Đang sản xuất" style="cursor:pointer;"><div class="num">${d.inProgress}</div><div class="label">Đang sản xuất</div></div>
        <div class="stat-box orange act-stat" data-status="Chưa bắt đầu" style="cursor:pointer;"><div class="num">${d.notStarted}</div><div class="label">Chưa bắt đầu</div></div>
        ${/* v6.50: đếm sống theo ngày giao (data-han), không theo cột TrangThai — xem ghi chú ở
             routes/qlsx.js. Thêm ô "Sắp đến hạn" cho khớp danh sách lệnh SX. */''}
        <div class="stat-box red act-stat" data-han="qua" style="cursor:pointer;"><div class="num">${d.overdue}</div><div class="label">Trễ hạn</div></div>
        <div class="stat-box orange act-stat" data-han="sap" style="cursor:pointer;"><div class="num">${d.soonDue || 0}</div><div class="label">Sắp đến hạn (≤5 ngày)</div></div>
      </div>
      <div class="card">
        <h3 style="margin-top:0;">Đơn hàng đang sản xuất</h3>
        <p style="font-size:12px;color:#5f6368;margin-top:-6px;">Bấm vào 1 dòng để xem chi tiết đơn hàng.</p>
        <div style="max-height:360px;overflow-y:auto;">
        <table><thead><tr><th>Mã ĐH</th><th>Sản phẩm</th><th>Khách hàng</th><th>Công đoạn hiện tại</th><th>%</th><th>Ngày giao dự kiến</th><th>Trạng thái</th></tr></thead>
        <tbody>${inProgressOrders.map(o => `<tr class="clickable-row" data-madh="${o.MaDH}" style="cursor:pointer;">
          <td>${escapeHtml(o.MaDH)}</td><td>${escapeHtml(o.TenSanPham)}</td><td>${escapeHtml(o.TenKhachHang || '')}</td>
          <td>${escapeHtml(o.TenCongDoan || '')}</td><td>${o.PhanTramHoanThanh}%</td><td>${fmtDate(o.NgayGiaoDuKien)}</td>
          <td>${statusWithStage(o.TrangThai, o.TenCongDoan, o.TenNhaGiaCong, o.MaCongDoan)}</td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty-hint">Không có đơn hàng đang sản xuất</td></tr>'}</tbody></table>
        </div>
      </div>
      <div class="card">
        <h3 style="margin-top:0;">Số đơn theo công đoạn hiện tại</h3>
        <p style="font-size:12px;color:#5f6368;margin-top:-6px;">Bấm vào 1 số để xem danh sách đơn hàng.</p>
        <table><thead><tr>${d.stages.map(s => `<th>${escapeHtml(s)}</th>`).join('')}</tr></thead>
        <tbody><tr>${d.stages.map(s => `<td class="act-stage" data-stage="${escapeHtml(s)}" style="cursor:pointer;text-decoration:underline;">${d.stageCounts[s] || 0}</td>`).join('')}</tr></tbody></table>
      </div>
      <div class="card">
        <h3 style="margin-top:0;">Báo cáo Nhà gia công</h3>
        <p style="font-size:12px;color:#5f6368;margin-top:-6px;">Bấm vào 1 dòng để xem danh sách đơn hàng. "Số ngày xử lý TB" chỉ tính được khi đã nhập cả Ngày giao lẫn Ngày nhận (Giao/nhận nhà gia công).</p>
        ${vendorTable(d.reportGiaCong, 'GiaCong')}
      </div>
      <div class="card">
        <h3 style="margin-top:0;">Báo cáo Nhà in / thêu</h3>
        ${vendorTable(d.reportIn, 'InTheu')}
      </div>
      ${perm.canEdit ? '<div class="toolbar"><button class="btn secondary" id="btnCheckOverdue">🔔 Kiểm tra & gửi cảnh báo trễ hạn ngay</button></div>' : ''}`;
    // v5.39b: nut "gui canh bao tre han ngay" = hanh dong gui email -> chi user co quyen Sua moi thay.
    const btnCheckOverdue = document.getElementById('btnCheckOverdue');
    if (btnCheckOverdue) btnCheckOverdue.addEventListener('click', async () => {
      try { const r = await apiPost('/api/qlsx/canhbao/chay-ngay', {}); toast(`Đã kiểm tra. Trễ hạn: ${r.data.overdue}, sắp đến hạn: ${r.data.soon}.`, 'success'); }
      catch (err) { toast(err.message, 'error'); }
    });
    // v5.2: click 1 dong trong bang "Dang san xuat" de xem chi tiet don hang (yeu cau v5.2 muc 1).
    body.querySelectorAll('tr.clickable-row').forEach(tr => tr.addEventListener('click', () => openOrderDetail(tr.dataset.madh)));
    // v5.5: click 1 the trang thai -> loc allOrders (khong goi API moi) roi hien popup danh sach (yeu
    // cau v5.5: "Click vao trang thai chi hien thi cac lenh san xuat dang o trang thai do"). The "Tong
    // don hang" (data-status rong) hien TOAN BO, khong loc gi.
    /* v6.50: 2 ô "Trễ hạn"/"Sắp đến hạn" lọc theo NhomHan (backend tính sống từ ngày giao), không
       theo TrangThai — vì không có chỗ nào ghi TrangThai='Trễ hạn' vào CSDL, lọc theo nó ra rỗng. */
    body.querySelectorAll('.act-stat').forEach(el => el.addEventListener('click', () => {
      const status = el.dataset.status;
      const han = el.dataset.han;
      const filtered = han ? allOrders.filter(o => o.NhomHan === han)
        : (status ? allOrders.filter(o => o.TrangThai === status) : allOrders);
      showOrderListPopup(filtered, el.querySelector('.label').textContent);
    }));
    // v5.5: click 1 so trong bang "So don theo cong doan" -> loc theo dung cong doan do.
    body.querySelectorAll('.act-stage').forEach(el => el.addEventListener('click', () => {
      const stage = el.dataset.stage;
      showOrderListPopup(allOrders.filter(o => o.TenCongDoan === stage), 'Công đoạn: ' + stage);
    }));
    // v5.5: click 1 dong trong bao cao Nha gia cong/Nha in -> loc theo dung ten do (field phan biet
    // loc theo TenNhaGiaCong hay TenNhaIn, xem vendorTable).
    body.querySelectorAll('.act-vendor-row').forEach(tr => tr.addEventListener('click', () => {
      const field = tr.dataset.field, ten = tr.dataset.ten;
      const filtered = allOrders.filter(o => (field === 'GiaCong' ? o.TenNhaGiaCong : o.TenNhaIn) === ten);
      showOrderListPopup(filtered, ten);
    }));
  }

  // v5.5: popup dung chung cho moi cach loc tren Dashboard (trang thai/cong doan/nha gia cong) - dung
  // lai du lieu DA fetch (khong goi API rieng), bam 1 dong mo tiep Chi tiet don hang nhu bang chinh.
  function showOrderListPopup(rows, title) {
    const html = `<h3>${escapeHtml(title)} (${rows.length})</h3>
      <div style="max-height:60vh;overflow-y:auto;">
      <table><thead><tr><th>Mã ĐH</th><th>Sản phẩm</th><th>Khách hàng</th><th>Công đoạn</th><th>%</th><th>Ngày giao dự kiến</th><th>Trạng thái</th></tr></thead>
      <tbody>${rows.map(o => `<tr class="clickable-row" data-madh="${o.MaDH}" style="cursor:pointer;">
        <td>${escapeHtml(o.MaDH)}</td><td>${escapeHtml(o.TenSanPham)}</td><td>${escapeHtml(o.TenKhachHang || '')}</td>
        <td>${escapeHtml(o.TenCongDoan || '')}</td><td>${o.PhanTramHoanThanh}%</td><td>${fmtDate(o.NgayGiaoDuKien)}</td>
        <td>${statusWithStage(o.TrangThai, o.TenCongDoan, o.TenNhaGiaCong, o.MaCongDoan)}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="empty-hint">Không có đơn hàng nào</td></tr>'}</tbody></table>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnClosePopupList">Đóng</button></div>`;
    const modal = openModal(html);
    modal.querySelector('#btnClosePopupList').addEventListener('click', closeModal);
    modal.querySelectorAll('tr.clickable-row').forEach(tr => tr.addEventListener('click', () => openOrderDetail(tr.dataset.madh)));
  }

  // v5.2: modal "xem chi tiet don hang" tu Dashboard - tai su dung dung du lieu cua phieu bao cao
  // (GET /orders/:maDH/print) nhung hien ngay trong app (khong mo cua so in moi).
  async function openOrderDetail(maDH) {
    const res = await apiGet(`/api/qlsx/orders/${maDH}/print`);
    const { order, logs, baoCaoNangSuat, vaiXuat } = res.data;
    const ns = baoCaoNangSuat || { slYeuCauCat: 0, slCatThucTe: 0, slNhapKhoThucTe: 0 };
    const vx = vaiXuat || { chiTiet: [], tongKG: 0 };
    const html = `
      <h3>Chi tiết đơn hàng — ${escapeHtml(maDH)}</h3>
      <table><tbody>
        <tr><td style="width:35%"><b>Sản phẩm:</b> ${escapeHtml(order.TenSanPham)}</td><td><b>Khách hàng:</b> ${escapeHtml(order.TenKhachHang || '')}</td></tr>
        <tr><td><b>Ngày giao dự kiến:</b> ${fmtDate(order.NgayGiaoDuKien)}</td><td><b>Tổng SL:</b> ${fmtNumber(order.TongSoLuong)}</td></tr>
        <tr><td><b>Công đoạn hiện tại:</b> ${escapeHtml(order.TenCongDoan || '')}</td><td><b>Trạng thái:</b> ${statusWithStage(order.TrangThai, order.TenCongDoan, order.TenNhaGiaCong, order.MaCongDoan)} (${order.PhanTramHoanThanh}%)</td></tr>
      </tbody></table>
      <h4>Báo cáo năng suất Cắt / Nhập kho</h4>
      <table><thead><tr><th>SL yêu cầu cắt</th><th>SL cắt thực tế</th><th>SL nhập kho thực tế</th></tr></thead>
      <tbody><tr><td>${fmtNumber(ns.slYeuCauCat)}</td><td>${fmtNumber(ns.slCatThucTe)}</td><td>${ns.slNhapKhoThucTe > 0 ? fmtNumber(ns.slNhapKhoThucTe) : 'Chưa nhập kho'}</td></tr></tbody></table>
      <h4>Xuất vải kèm đơn hàng (tổng ${fmtNumber(vx.tongKG)} KG)</h4>
      <table><thead><tr><th style="width:38px;">STT</th><th>Ngày xuất</th><th>Mã cây</th><th>Loại vải</th><th>Màu</th><th>KG xuất</th></tr></thead>
      <tbody>${vx.chiTiet.map((v, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${fmtDate(v.NgayXuat)}</td><td>${escapeHtml(v.MaCay)}</td><td>${escapeHtml(v.TenLoaiVai)}</td><td>${escapeHtml(v.TenMau)}</td><td>${fmtNumber(v.KGXuat)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-hint">Chưa xuất vải nào</td></tr>'}</tbody></table>
      <h4>Lịch sử cập nhật tiến độ</h4>
      <table><thead><tr><th style="width:38px;">STT</th><th>Ngày giờ cập nhật</th><th>Công đoạn</th><th>Người cập nhật</th><th>Chi tiết màu</th><th>Ghi chú</th></tr></thead>
      <tbody>${logs.map((l, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${fmtDateTime(l.ThoiGianNhap)}</td><td>${escapeHtml(l.TenCongDoan)}</td><td>${escapeHtml(l.NguoiCapNhat)}</td>
        <td>${l.chiTietMau.map(c => `${escapeHtml(c.TenMau)}: ${c.SoLuongLuyKe}`).join(', ')}</td><td>${escapeHtml(l.GhiChu || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty-hint">Chưa có lịch sử cập nhật</td></tr>'}</tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnCancel">Đóng</button>
        <button type="button" class="btn" id="btnPrintFromDetail">🖨️ In phiếu</button>
      </div>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#btnPrintFromDetail').addEventListener('click', () => openPrint(maDH));
  }

  // v5.5: them param "field" ('GiaCong'/'InTheu') + data-ten de Dashboard biet loc theo TenNhaGiaCong
  // hay TenNhaIn khi bam vao 1 dong (xem renderDashboard). "Số ngày xử lý TB" khong phai loi/chua lam
  // - da tinh dung tu DATEDIFF (schema.sql, cot computed SoNgayGC/SoNgayIn) NHUNG chi co gia tri khi
  // ca Ngay giao LAN Ngay nhan cua nha gia cong/in do da duoc nhap (qua "Giao/nhan nha gia cong") -
  // doi chu "-" mo ho sang "Chưa đủ dữ liệu" de ro nguyen nhan hon, khong phai sua loi tinh toan.
  function vendorTable(rows, field) {
    if (!rows.length) return '<div class="empty-hint">Chưa có dữ liệu</div>';
    return `<table><thead><tr><th>Tên</th><th>Tổng đơn</th><th>Hoàn thành</th><th>Đang giữ</th><th>Số ngày xử lý TB</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="act-vendor-row" data-field="${field}" data-ten="${escapeHtml(r.ten)}" style="cursor:pointer;">
        <td>${escapeHtml(r.ten)}</td><td>${r.tongDon}</td><td>${r.hoanThanh}</td><td>${r.dangGiu}</td>
        <td>${r.ngayTB != null ? r.ngayTB : '<span style="color:#9aa0a6;">Chưa đủ dữ liệu</span>'}</td></tr>`).join('')}</tbody></table>`;
  }

  // v5.2: doi ten "Danh sach don hang" -> "Danh sach lenh san xuat". Bo nut "Giao vai SX" rieng (nay la
  // 1 cong doan trong Ghi tien do, xem renderStageFields). Them Sua/Xoa theo phan quyen; o muc thao
  // tac CHI hien nut ung voi quyen thuc te cua user (yeu cau v5.2 muc 3d: "chi hien quyen cua user do
  // duoc giao") - Ghi tien do/Giao nhan NCC/Sua can canEdit, Xoa can canDelete, In luon hien (chi xem).
  // v5.6: nhan them "permTiendo" (chuc nang QLSX.'tiendo' - xem migration_v56.sql) RIENG voi "perm"
  // (chuc nang QLSX.'orders') - "Ghi tiến độ"/"Giao/nhận nhà gia công" gate theo permTiendo.canEdit,
  // "Sửa"/"Xóa" lenh van gate theo perm (khong doi). Truoc day ca 2 nhom deu dung chung 1 "perm" nen
  // tach quyen o backend khong the phan anh len UI (nguoi chi duoc giao 'tiendo' se KHONG thay nut nao).
  /* v6.48: CẢNH BÁO DEADLINE trên danh sách lệnh SX.
       còn ≤ 5 ngày tới Ngày giao -> nền VÀNG
       đã quá Ngày giao          -> nền ĐỎ
     Lệnh đã Hoàn thành / Đã hủy thì KHÔNG tô: đơn giao xong đúng hạn mà vẫn đỏ thì bảng đỏ quạch,
     nhìn mãi thành quen rồi bỏ qua luôn cả lệnh đang trễ thật.
     So sánh theo NGÀY (cắt giờ về 0) — để nguyên giờ thì lệnh giao hôm nay lúc 0h00 bị tính là quá hạn. */
  function tinhDeadline(o) {
    const tt = String(o.TrangThai || '').toLowerCase();
    if (tt.includes('hoàn thành') || tt.includes('hủy')) return null;
    if (!o.NgayGiaoDuKien) return null;
    const d = new Date(o.NgayGiaoDuKien);
    if (isNaN(d)) return null;
    d.setHours(0, 0, 0, 0);
    const homNay = new Date(); homNay.setHours(0, 0, 0, 0);
    const con = Math.round((d - homNay) / 86400000);
    if (con < 0) return { nen: '#fdecea', chu: '#c0392b', nhan: `Quá hạn ${-con} ngày` };
    if (con <= 5) return { nen: '#fff8e1', chu: '#a06800', nhan: con === 0 ? 'Đến hạn hôm nay' : `Còn ${con} ngày` };
    return null;
  }

  async function renderOrders(perm, permTiendo, permTLKT) {
    const body = document.getElementById('qBody');
    const res = await apiGet('/api/qlsx/orders');
    const rows = res.data;
    /* v6.48.1: đếm sẵn số lệnh quá hạn / sắp đến hạn để hiện ngay dưới dòng chú giải, và cho BẤM VÀO
       CON SỐ để lọc bảng còn đúng nhóm đó. Gắn `data-dl` lên từng dòng để lọc bằng cách ẩn/hiện,
       không phải vẽ lại bảng — giữ nguyên mọi nút thao tác đã gắn sự kiện. */
    const nhomCua = o => { const d = tinhDeadline(o); return d ? (d.nhan.startsWith('Quá hạn') ? 'qua' : 'sap') : ''; };
    const soQua = rows.filter(o => nhomCua(o) === 'qua').length;
    const soSap = rows.filter(o => nhomCua(o) === 'sap').length;
    const chip = (loc, mau, chu, n, nhan) =>
      `<a href="javascript:void(0)" class="dl-loc" data-loc="${loc}" style="background:${mau};color:${chu};padding:2px 8px;border-radius:10px;font-weight:bold;text-decoration:none;">${nhan}: ${n}</a>`;
    /* v6.48.2: bọc trong <div class="toolbar"> để dùng LUÔN cơ chế thanh dính sẵn có (common.js
       capNhatThanhCongCuDinh): nó tự gắn .sticky-bar và đo chiều cao gán vào biến --bar-h, nhờ đó
       dòng tiêu đề bảng tự tụt xuống dưới thanh này thay vì bị đè. Tự viết position:sticky ở đây thì
       thanh và tiêu đề bảng cùng dính một mốc -> tiêu đề chui xuống dưới, mất hút. */
    body.innerHTML = `
      <div class="toolbar" style="display:block;">
        <div class="empty-hint" style="text-align:left;padding:0 0 4px;">
          <span style="background:#fff8e1;padding:1px 6px;border-radius:3px;">Vàng</span> = còn ≤ 5 ngày tới ngày giao ·
          <span style="background:#fdecea;padding:1px 6px;border-radius:3px;">Đỏ</span> = đã quá ngày giao ·
          lệnh Hoàn thành / Đã hủy không tô màu.
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;">
          ${chip('qua', '#fdecea', '#c0392b', soQua, 'Quá hạn')}
          ${chip('sap', '#fff8e1', '#a06800', soSap, 'Sắp đến hạn (≤5 ngày)')}
          ${chip('', '#f1f3f4', '#3c4043', rows.length, 'Tất cả')}
          <span id="dlDangLoc" style="color:#1a73e8;"></span>
        </div>
      </div>
      <table><thead><tr><th style="width:56px">Ảnh SP</th><th>Mã ĐH</th><th>Tên SP</th><th>Mã Rập</th><th>Khách hàng</th><th>SL</th><th>Ngày ra lệnh</th><th>Ngày giao</th><th>Công đoạn</th><th>%</th><th>Trạng thái</th><th style="width:460px">Thao tác</th></tr></thead>
      ${/* v6.48.2: tô màu bằng CLASS (.dl-qua/.dl-sap trong style.css) chứ không đặt style thẳng vào
           <tr>. Nền vẽ ở <td>, mà quy tắc :hover của bảng cũng nhắm vào <td> — nền đặt ở <tr> nằm
           DƯỚI nền của <td> nên rê chuột vào là màu cảnh báo biến mất. */''}
      <tbody>${rows.map(o => { const n = nhomCua(o); const dl = tinhDeadline(o); return `<tr data-dl="${n}" class="${n ? 'dl-' + n : ''}">
        <td>${o.AnhSanPham ? `<a href="${escapeHtml(o.AnhSanPham)}" target="_blank" rel="noopener" title="Bấm để xem ảnh lớn"><img src="${escapeHtml(o.AnhSanPham)}" style="width:44px;height:44px;object-fit:cover;border-radius:4px;"></a>` : ''}</td>
        ${/* Danh sách CHỈ HIỂN THỊ — sửa thì bấm nút Sửa để mở form chi tiết. */''}
        <td>${escapeHtml(o.MaDH)}</td><td>${escapeHtml(o.TenSanPham)}</td><td>${escapeHtml(o.MaRap || '')}</td><td>${escapeHtml(o.TenKhachHang)}</td>
        <td>${fmtNumber(o.TongSoLuong)}</td>
        <td>${fmtDate(o.NgayDat)}</td>
        <td>${fmtDate(o.NgayGiaoDuKien)}${dl ? `<div style="font-size:11px;font-weight:bold;color:${dl.chu};">${dl.nhan}</div>` : ''}</td>
        ${/* v5.99: đơn nhiều sơ đồ chưa cắt đủ -> nhắc ngay cạnh công đoạn (tổ Cắt vẫn thấy đơn này) */''}
        <td>${escapeHtml(o.TenCongDoan)}${o.ConPhaiCat ? `<div><span class="badge warn" title="Đơn có ${o.SoSoDo} sơ đồ, đã ghi sổ cắt ${o.SoSoDoDaCat} sơ đồ">✂️ Còn cắt ${o.SoSoDoConLai}/${o.SoSoDo} sơ đồ</span></div>` : ''}</td>
        <td>${o.PhanTramHoanThanh}%</td><td>${statusWithStage(o.TrangThai, o.TenCongDoan, o.TenNhaGiaCong, o.MaCongDoan)}</td>
        <td>
          ${permTiendo.canEdit ? `<button class="btn small secondary act-progress" data-madh="${o.MaDH}">Ghi tiến độ</button>` : ''}
          <button class="btn small secondary act-printlenh" data-madh="${o.MaDH}">In lệnh SX</button>
          <button class="btn small secondary act-print" data-madh="${o.MaDH}">In phiếu</button>
          <button class="btn small secondary act-printtlkt" data-madh="${o.MaDH}">In tài liệu KT</button>${''/* v5.44.5: LUÔN hiện nút In tài liệu KT (bỏ gate quyền tailieukythuat) theo yêu cầu */}
          ${perm.canEdit ? `<button class="btn small secondary act-edit" data-madh="${o.MaDH}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger act-delete" data-madh="${o.MaDH}">Xóa</button>` : ''}
        </td></tr>`; }).join('') || '<tr><td colspan="12" class="empty-hint">Chưa có lệnh sản xuất nào trong phạm vi quyền của bạn</td></tr>'}</tbody></table>`;

    /* v6.48.1: bấm con số để lọc bảng. Bấm lại đúng nhóm đang lọc thì bỏ lọc — không phải đi tìm
       nút "Tất cả" mỗi lần. Dòng "chưa có lệnh nào" không có data-dl nên luôn hiện, không bị lọc mất. */
    let dangLoc = '';
    const apLoc = () => {
      body.querySelectorAll('table tbody tr[data-dl]').forEach(tr => {
        tr.style.display = (!dangLoc || tr.dataset.dl === dangLoc) ? '' : 'none';
      });
      body.querySelectorAll('.dl-loc').forEach(a => {
        a.style.outline = (a.dataset.loc === dangLoc && dangLoc) ? '2px solid #1a73e8' : '';
      });
      const el = body.querySelector('#dlDangLoc');
      if (el) el.textContent = dangLoc
        ? `(đang lọc — bấm lại để bỏ lọc)`
        : '';
    };
    body.querySelectorAll('.dl-loc').forEach(a => a.addEventListener('click', () => {
      const l = a.dataset.loc;
      dangLoc = (l && l === dangLoc) ? '' : l;
      apLoc();
    }));

    body.querySelectorAll('.act-progress').forEach(b => b.addEventListener('click', () => openProgressForm(b.dataset.madh, perm)));
    body.querySelectorAll('.act-printlenh').forEach(b => b.addEventListener('click', () => printLenhSanXuat(b.dataset.madh)));
    body.querySelectorAll('.act-print').forEach(b => b.addEventListener('click', () => openPrint(b.dataset.madh)));
    body.querySelectorAll('.act-printtlkt').forEach(b => b.addEventListener('click', () => openPrintTaiLieuKyThuatChooser(b.dataset.madh)));
    body.querySelectorAll('.act-edit').forEach(b => b.addEventListener('click', () => openEditOrderForm(b.dataset.madh)));
    body.querySelectorAll('.act-delete').forEach(b => b.addEventListener('click', () => doDeleteOrder(b.dataset.madh)));
  }

  // v5.15: yeu cau "Danh sách lệnh sản xuất thêm chức năng in Tài liệu kỹ thuật, lựa chọn in tất cả
  // hoặc từng loại" - popup chon nhanh roi giao het cho window.ModuleTaiLieuKyThuat.printOrderDocs()
  // (module.tailieukythuat.js) xu ly, vi noi do da nam san toan bo logic doc/build noi dung 4 loai tai
  // lieu - man hinh nay KHONG tu doc/build gi, chi la 1 lop chon loai mong.
  function openPrintTaiLieuKyThuatChooser(maDH) {
    const html = `
      <h3>In Tài liệu kỹ thuật — ${escapeHtml(maDH)}</h3>
      <p style="color:var(--text-muted);font-size:13px;">Chọn in gộp tất cả (mỗi loại 1 trang riêng, bỏ qua loại chưa có dữ liệu) hoặc in đúng 1 loại.</p>
      <div class="form-row"><button type="button" class="btn" id="btnPrintTlktAll" style="width:100%;">🖨️ In tất cả</button></div>
      <div class="form-row" style="display:flex;flex-direction:column;gap:8px;">
        <button type="button" class="btn small secondary act-printtlkt-one" data-loai="thongsodo">Thông số kỹ thuật</button>
        <button type="button" class="btn small secondary act-printtlkt-one" data-loai="motasp">Mô tả đường may</button>
        <button type="button" class="btn small secondary act-printtlkt-one" data-loai="quycach">Quy cách đóng gói</button>
        <button type="button" class="btn small secondary act-printtlkt-one" data-loai="hinhanhinthue">Hình ảnh mô tả in/thêu</button>
        <button type="button" class="btn small secondary act-printtlkt-one" data-loai="bangkebtp">Bảng kê BTP</button>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancelPrintTlkt">Đóng</button></div>`;
    // v5.16 (muc 3, yeu cau "khi thoát lệnh in quay trở về màn hình In Tài liệu kỹ thuật đang mở"):
    // KHONG con dong modal truoc khi in - printHtml() in qua <iframe> an rieng, khong dung/thay the
    // modal nay, nen chi can KHONG chu dong dong la modal se van con nguyen o do trong suot + sau khi
    // hop thoai in duoc dong (kha nang la vao chinh man hinh chon-loai-in nay, dung y yeu cau).
    const modal = openModal(html);
    modal.querySelector('#btnCancelPrintTlkt').addEventListener('click', closeModal);
    modal.querySelector('#btnPrintTlktAll').addEventListener('click', () => { window.ModuleTaiLieuKyThuat.printOrderDocs(maDH, 'all'); });
    modal.querySelectorAll('.act-printtlkt-one').forEach(btn => btn.addEventListener('click', () => {
      window.ModuleTaiLieuKyThuat.printOrderDocs(maDH, btn.dataset.loai);
    }));
  }

  // v5.2: sua thong tin chung cua lenh san xuat.
  // v5.6: MO RONG cho sua duoc ca cau truc vai (yeu cau v5.6 "sửa lệnh sx sửa cả phần chọn vải") - truoc
  // day cau truc vai KHONG sua duoc o day vi lo vo du lieu tien do phu thuoc (Giao vai/Cat/May theo
  // mau). Gio cho sua NHUNG khoa (🔒, disabled) rieng Loai vai + Mau cua tung khoi mau chinh DA co tien
  // do ghi nhan (detail.mauSacsWithProgress - xem getMauSacsWithProgress() backend) - van sua tu do
  // duoc Don vi/So luong/Anh mau, va them moi/xoa tu do mau phoi (phoi khong theo doi tien do rieng).
  // Nut xoa 1 khoi mau chinh DA khoa van bam duoc nhung se bi CHAN lai (toast giai thich) - kem 1 lop
  // kiem tra AN TOAN THAT SU o backend (PUT /orders/:maDH) phong truong hop code frontend co sai sot.
  async function openEditOrderForm(maDH) {
    const detail = (await apiGet('/api/qlsx/orders/' + maDH)).data;
    const protectedMauSacs = new Set((detail.mauSacsWithProgress || []).map(String));
    let chinhIdxEdit = 0;
    let phoiRowIdxEdit = 0;

    // v5.13: cung 2 ham them-nhanh-vao-danh-muc dung o form Tao moi (renderLenhForm) - xem ghi chu chi
    // tiet o do (khong tai su dung truc tiep duoc vi la closure rieng cua tung form, nhung logic y het).
    async function addLoaiVaiInlineEdit(searchId) {
      const ten = prompt('Tên loại vải mới:');
      if (!ten || !ten.trim()) return;
      try {
        const res = await apiPost('/api/danhmuc/loaivai', { TenLoaiVai: ten.trim() });
        dm.loaiVai.push(res.data);
        document.getElementById(searchId + '_text').value = res.data.TenLoaiVai;
        document.getElementById(searchId + '_val').value = res.data.LoaiVaiID;
        toast('Đã thêm loại vải "' + res.data.TenLoaiVai + '" vào danh mục.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }
    async function addMauSacInlineEdit(searchId) {
      const ten = prompt('Tên màu mới (dùng luôn làm mã màu):');
      if (!ten || !ten.trim()) return;
      try {
        const res = await apiPost('/api/danhmuc/mausac', { MaMau: ten.trim(), TenMau: ten.trim() });
        dm.mauSac.push(res.data);
        document.getElementById(searchId + '_text').value = res.data.TenMau;
        document.getElementById(searchId + '_val').value = res.data.MauSacID;
        toast('Đã thêm màu "' + res.data.TenMau + '" vào danh mục.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }
    // v5.21 (muc 1/2): THAY THE fmtDualUnit() bang fmtQuyDoi() - xem ghi chu chi tiet tai recalcCvTongCong()
    // (form Tao moi, cung logic) - don vi co ban lay tu o Don vi cua khoi mau chinh DAU TIEN dang co tren
    // form (thuong nhat quan ca don).
    function recalcCvTongCongEdit() {
      const area = document.getElementById('editForm');
      if (!area) return;
      const slInputs = Array.from(area.querySelectorAll('#cvChinhRowsEdit .cv-sl'));
      const total = slInputs.reduce((s, i) => s + soTuDo(i.value), 0);   // v6.44: ô chữ -> soTuDo()
      const heSoEl = document.getElementById('inpHeSoQuyDoiEdit');
      const heSo = Number(heSoEl ? heSoEl.value : 1) || 1;
      const firstDonViEl = area.querySelector('#cvChinhRowsEdit .cv-donvi');
      const donVi = firstDonViEl ? firstDonViEl.value : 'Cái';
      const dvqdEl = document.getElementById('inpDonViQuyDoiEdit');
      const dvqd = dvqdEl ? dm.donViQuyDoi.find(d => String(d.ID) === String(dvqdEl.value)) : null;
      const totalEl = document.getElementById('cvTongCongValEdit');
      if (totalEl) totalEl.innerHTML = fmtQuyDoi(total, heSo, dvqd ? dvqd.PhepTinh : null, donVi, dvqd ? dvqd.DonViQuyDoi : null);
    }

    function phoiRowHtmlEdit(prefill) {
      const myIdx = phoiRowIdxEdit++;
      return `<div class="sub-row-item" data-phoirow data-phoiidx="${myIdx}" style="flex-wrap:wrap;">
        <div style="flex:1.3;"><input class="ph-loaitudo" type="text" placeholder="Loại vải phối (tự do)" value="${escapeHtml(prefill ? (prefill.TenLoaiVaiTuDo || prefill.TenLoaiVai || '') : '')}"></div>
        <div style="flex:1.3;"><input class="ph-mautudo" type="text" placeholder="Màu phối (tự do)" value="${escapeHtml(prefill ? (prefill.TenMauTuDo || prefill.TenMau || '') : '')}"></div>
        <select class="phoi-donvi" style="flex:1;">${opt(dm.donViTinh, 'TenDonVi', 'TenDonVi', prefill ? prefill.DonViTinh : '')}</select>
        ${/* v6.44: ô chữ + soTuDo() — cùng lý do với ô Số lượng của màu chính. */''}
        <input type="text" inputmode="decimal" class="phoi-sl" placeholder="SL (gõ tự do)" style="flex:.8;" value="${prefill && prefill.SoLuong != null ? escapeHtml(String(prefill.SoLuong)) : ''}">
        <button type="button" class="btn small danger phoi-remove">X</button>
      </div>`;
    }
    // v5.13 (muc 1.1.3.2/1.1.3.3/1.1.3.4): Loai vai/Mau chinh doi sang o go-tim + nut "+ Mới" (giong form
    // Tao moi); o "protected" (da co tien do) dung readonly (khong con la <select disabled> - o go-tim
    // la input text+hidden, "readonly" giu nguyen gia tri submit duoc nhung khoa khong cho go lai). Anh
    // mau cu doi tu 32x32 object-fit:cover (ep vuong, cat mat anh) sang tu co gian theo anh that.
    function chinhBlockHtmlEdit(prefill) {
      const myIdx = chinhIdxEdit++;
      const isProtected = !!(prefill && protectedMauSacs.has(String(prefill.MauSacID)));
      const roOrDisabled = isProtected ? 'readonly disabled-look' : '';
      return `<div class="card" data-chinh="${myIdx}" data-protected="${isProtected ? '1' : ''}" style="margin-bottom:10px;">
        <div class="form-grid" style="grid-template-columns:1.3fr 1.3fr .8fr .7fr 1.3fr auto;align-items:end;gap:8px;">
          <div><label>Loại vải (chính)</label>
            ${/* v6.49: BỎ readonly — sửa được kể cả khi màu đã có tiến độ, lệnh đang ở công đoạn nào
                 cũng vậy. Vẫn giữ dấu 🔒 nhắc là màu này đã có tiến độ, để người sửa biết mình đang
                 đụng vào dữ liệu đã dùng ở sổ cắt / lương khoán. */''}
            <input class="cv-loaitudo" type="text" placeholder="Nhập loại vải (tự do)" value="${escapeHtml(prefill ? (prefill.TenLoaiVaiTuDo || prefill.TenLoaiVai || '') : '')}"></div>
          <div><label>Màu chính (tham khảo)</label>
            <input class="cv-mautudo" type="text" placeholder="Nhập màu (tự do)" value="${escapeHtml(prefill ? (prefill.TenMauTuDo || prefill.TenMau || '') : '')}"></div>
          ${/* v6.43: GÕ TỰ DO (danh mục chỉ còn là gợi ý). Ra lệnh SX là bước chỉ định, chưa cần khớp
                với danh mục — bắt chọn đúng danh mục làm nghẽn lúc khai lệnh. */''}
          ${ensureDlCvDonVi()}<div><label>Đơn vị</label><input class="cv-donvi" list="dlCvDonVi" value="${prefill && prefill.DonViTinh ? escapeHtml(prefill.DonViTinh) : ''}" placeholder="Gõ tự do" autocomplete="off"></div>
          ${/* v6.44: ô chữ + soTuDo() — xem ghi chú ở soTuDo(). Nhận cả 1,5 và 1.5. */''}
          <div><label>Số lượng</label><input class="cv-sl" type="text" inputmode="decimal" placeholder="Gõ tự do (1,5 hoặc 1.5)" value="${prefill && prefill.SoLuong != null ? escapeHtml(String(prefill.SoLuong)) : ''}"></div>
          <div><label>Ảnh màu</label><input type="file" class="cv-anh" accept="image/*"><input type="hidden" class="cv-anh-url">
            <div class="cv-anh-preview" tabindex="0" title="Dán ảnh (Ctrl+V) hoặc chọn file" style="margin-top:4px;min-height:22px;outline:1px dashed var(--border);border-radius:4px;padding:3px;">${prefill && prefill.AnhMau ? `<img src="${escapeHtml(prefill.AnhMau)}" style="max-width:100px;max-height:100px;width:auto;height:auto;border-radius:4px;border:1px solid var(--border);">` : '<span style="font-size:11px;color:#9aa0a6;">Dán ảnh (Ctrl+V)</span>'}</div>
            ${prefill && prefill.AnhMau ? `<input type="hidden" class="cv-anh-old" value="${escapeHtml(prefill.AnhMau)}">` : ''}
          </div>
          <div><button type="button" class="btn small danger cv-remove-chinh">X</button></div>
        </div>
        <div style="margin-top:6px;"><input class="cv-ghichu" type="text" placeholder="Ghi chú (dòng màu chính này)" value="${escapeHtml(prefill ? (prefill.GhiChu || '') : '')}" style="width:100%;"></div>
        <div class="sub-row-box" data-phoibox>
          <div class="sub-rows">${((prefill && prefill.phoi) || []).map(p => phoiRowHtmlEdit(p)).join('')}</div>
          <button type="button" class="btn small secondary btn-add-phoi">+ Thêm màu phối (nằm trong màu chính này)</button>
        </div>
      </div>`;
    }
    function wireRowImagePreviewEdit(cardEl) {
      const fileInput = cardEl.querySelector('.cv-anh');
      const previewEl = cardEl.querySelector('.cv-anh-preview');
      const urlEl = cardEl.querySelector('.cv-anh-url');
      if (!fileInput || !previewEl) return;
      const showImg = (src) => { previewEl.innerHTML = `<img src="${src}" style="max-width:100px;max-height:100px;width:auto;height:auto;border-radius:4px;border:1px solid var(--border);">`; };
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (urlEl) urlEl.value = '';
        if (file) showImg(URL.createObjectURL(file));
      });
      // v5.27 (1.1e): dan anh (Ctrl+V) - upload NGAY, luu URL vao hidden field (.cv-anh-url).
      previewEl.addEventListener('paste', async (e) => {
        const items = (e.clipboardData && e.clipboardData.items) || [];
        const imgItem = Array.from(items).find(it => it.type && it.type.indexOf('image/') === 0);
        if (!imgItem) return;
        e.preventDefault();
        const file = imgItem.getAsFile();
        if (!file) return;
        try { const url = await uploadFile(file, 'mausac'); if (urlEl) urlEl.value = url; fileInput.value = ''; showImg(url); }
        catch (err) { toast(err.message, 'error'); }
      });
    }
    function wireChinhCardEdit(cardEl) {
      const myIdx = cardEl.dataset.chinh;
      const isProtected = cardEl.dataset.protected === '1';
      // v5.27.1: mau go tu do (khong con searchableSelect/wiring). Loai vai readonly khi isProtected da
      // xu ly bang thuoc tinh HTML trong chinhBlockHtmlEdit.
      wireRowImagePreviewEdit(cardEl);
      cardEl.querySelector('.cv-sl').addEventListener('input', recalcCvTongCongEdit);
      // v5.19: xem ghi chu tuong tu tren wireChinhCard() (form Tao moi).
      // v6.43: ô là <input> -> bắt cả 'input' để tổng cộng cập nhật ngay lúc gõ, không đợi rời ô.
      cardEl.querySelector('.cv-donvi').addEventListener('change', recalcCvTongCongEdit);
      cardEl.querySelector('.cv-donvi').addEventListener('input', recalcCvTongCongEdit);
    }
    function wirePhoiBoxEdit(cardEl) {
      const box = cardEl.querySelector('[data-phoibox]');
      function wireRow(rowEl) {
        const idx = rowEl.dataset.phoiidx;
        rowEl.querySelector('.phoi-remove').addEventListener('click', () => rowEl.remove());
      }
      box.querySelectorAll('[data-phoirow]').forEach(wireRow);
      box.querySelector('.btn-add-phoi').addEventListener('click', () => {
        box.querySelector('.sub-rows').insertAdjacentHTML('beforeend', phoiRowHtmlEdit());
        wireRow(box.querySelector('.sub-rows').lastElementChild);
      });
    }
    function wireChinhRemoveEdit(areaEl) {
      areaEl.querySelectorAll('.cv-remove-chinh').forEach(btn => btn.onclick = () => {
        const card = btn.closest('[data-chinh]');
        /* v6.49: cho xóa cả màu ĐÃ CÓ TIẾN ĐỘ — nhưng hỏi lại một câu, vì tiến độ đã ghi (sổ cắt,
           lương khoán may) sẽ mất dòng cấu trúc vải để đối chiếu. Chặn cứng thì không sửa nổi lệnh
           khai sai màu; im lặng cho xóa thì số liệu lệch mà không ai biết vì sao. */
        if (card.dataset.protected === '1'
          && !confirm('Màu này ĐÃ CÓ TIẾN ĐỘ ghi nhận (Giao vải / Cắt / May...).\n\nXóa khỏi cấu trúc vải thì tiến độ đó vẫn còn trong sổ cắt và lương khoán, nhưng không còn dòng cấu trúc vải để đối chiếu.\n\nVẫn xóa?')) return;
        if (areaEl.querySelectorAll('#cvChinhRowsEdit > [data-chinh]').length > 1) { card.remove(); recalcCvTongCongEdit(); }
      });
    }

    const chinhRowsHtml = (detail.chiTietVai && detail.chiTietVai.length ? detail.chiTietVai : [null]).map(c => chinhBlockHtmlEdit(c)).join('');

    const html = `
      <h3>Sửa lệnh sản xuất — ${escapeHtml(maDH)}</h3>
      <form id="editForm">
        <div class="form-grid">
          <div class="form-row"><label>Tên sản phẩm *</label><input name="tenSanPham" value="${escapeHtml(detail.TenSanPham || '')}" required></div>
          <div class="form-row"><label>Mã đơn hàng</label><input value="${escapeHtml(maDH)}" disabled></div>
          <div class="form-row"><label>Size</label><input name="size" value="${escapeHtml(detail.Size || '')}"></div>
          ${/* v6.43: xem ghi chú ở form Ra lệnh SX. detail.TenKhachHang đã là tên hiển thị (tự do nếu
                có, không thì tên danh mục) do backend gộp sẵn -> đổ thẳng vào ô là đúng cả 2 trường hợp. */''}
          <div class="form-row"><label>Khách hàng</label>
            <div style="display:flex;gap:4px;align-items:center;">
              <input name="khachHangText" id="inpKhachHangEdit" list="dlKhachHangLenhEdit" style="flex:1;" value="${escapeHtml(detail.TenKhachHang || '')}" placeholder="Gõ tên khách (có sẵn hoặc tên mới)" autocomplete="off">
              <button type="button" class="btn small secondary" id="btnAddKHEdit" title="Thêm hẳn khách này vào Danh mục khách hàng">+ Mới</button>
            </div>
            <datalist id="dlKhachHangLenhEdit">${dm.khachHang.map(k => `<option value="${escapeHtml(k.TenKhachHang)}">`).join('')}</datalist>
            <div class="empty-hint" style="padding:2px 0 0;">Tên chưa có trong danh mục vẫn lưu được — chỉ hiện ở lệnh này và các bản in, không thêm vào danh mục.</div></div>
          <div class="form-row"><label>Ngày đặt</label><input type="date" name="ngayDat" value="${detail.NgayDat ? String(detail.NgayDat).slice(0, 10) : ''}"></div>
          <div class="form-row"><label>Deadline ra hàng *</label><input type="date" name="ngayGiao" value="${detail.NgayGiaoDuKien ? String(detail.NgayGiaoDuKien).slice(0, 10) : ''}" required></div>
          <!-- v5.13 (muc 1.1.2): "He so quy doi" sua duoc ngay tai day, thay cho o "Tong so luong" nhap
               tay da bo (muc 1.1.1 - xem hang Tong cong duoi Cau truc vai). -->
          <div class="form-row"><label>Hệ số quy đổi</label><input id="inpHeSoQuyDoiEdit" name="heSoQuyDoi" type="number" min="0" step="0.001" value="${detail.HeSoQuyDoi ?? 1}"></div>
          <!-- v5.21 (muc 1/2): xem ghi chu chi tiet tai form Tao moi (#inpDonViQuyDoi) - cung logic. -->
          <div class="form-row"><label>Đơn vị quy đổi</label><select id="inpDonViQuyDoiEdit">
            <option value="">-- Không quy đổi --</option>
            ${dm.donViQuyDoi.map(d => `<option value="${d.ID}" ${String(d.ID) === String(detail.DonViQuyDoiID || '') ? 'selected' : ''}>${escapeHtml(d.DonViChinh)} → ${escapeHtml(d.DonViQuyDoi)} (${d.PhepTinh === 'Chia' ? '÷' : '×'}${d.HeSo})</option>`).join('')}
          </select></div>
          <div class="form-row"><label>Thiết kế</label>
            <div style="display:flex;gap:4px;"><input name="thietKeVien" id="inpThietKeEdit" value="${escapeHtml(detail.ThietKeVien || '')}" style="flex:1;"><select id="selThietKeEdit" title="Chọn từ danh sách nhân viên" style="max-width:130px;"><option value="">↧ NV</option>${opt(nhanVienKyThuat(), 'HoTen', 'HoTen')}</select></div></div>
          <div class="form-row"><label>Kỹ thuật rập</label>
            <div style="display:flex;gap:4px;"><input name="kyThuatRap" id="inpKyThuatRapEdit" value="${escapeHtml(detail.KyThuatRap || '')}" style="flex:1;"><select id="selKyThuatRapEdit" title="Chọn từ danh sách nhân viên" style="max-width:130px;"><option value="">↧ NV</option>${opt(nhanVienKyThuat(), 'HoTen', 'HoTen')}</select></div></div>
        </div>
        <div class="form-row"><label>Có in thêu</label><label style="font-weight:normal;"><input type="checkbox" id="chkCoInTheuEdit" ${detail.CoInTheu ? 'checked' : ''}> Đơn hàng này có công đoạn in/thêu</label></div>
        <div class="form-row"><label>Dòng hình in</label><input name="dongHinhIn" value="${escapeHtml(detail.DongHinhIn || '')}"></div>
        <div class="form-row"><label>Ảnh sản phẩm ${detail.AnhSanPham ? '(đang có ảnh — chọn file mới nếu muốn thay)' : '(mới)'}</label>
          ${detail.AnhSanPham ? `<div style="margin-bottom:6px;"><img src="${escapeHtml(detail.AnhSanPham)}" style="width:64px;height:64px;object-fit:cover;border-radius:4px;border:1px solid var(--border);"></div>` : ''}
          <input type="file" name="anhSanPhamFile" accept="image/*"></div>
        ${/* v5.92: ảnh hình in có nút XÓA (trước chỉ thay được ảnh mới).
             v6.02: NHIỀU ảnh — thêm/xóa từng ảnh, lưu chung 1 cột nối bằng '\n' (xem anhHinhInBoxHtml). */''}
        <div class="form-row"><label>Ảnh hình in thêu (thêm được nhiều ảnh)</label>${anhHinhInBoxHtml('ahiEdit')}</div>
        <div class="form-row"><label>Ghi chú (LƯU Ý)</label><textarea name="ghiChuLenh" rows="2">${escapeHtml(detail.GhiChuLenh || '')}</textarea></div>
        <div class="form-row"><label>Mác</label><input name="mac" value="${escapeHtml(detail.Mac || '')}" placeholder="VD: Mác MQ sườn áo, thẻ bài MQ... (nhập tự do)"></div>
        <div class="form-row"><label>Phụ kiện (nhập tự do, mỗi dòng 1 loại — có thể thêm nhiều dòng)</label>${phuKienBoxHtml(detail.PhuLieu)}</div>

        <div class="form-row"><label>Cấu trúc vải (mỗi khối là 1 màu chính, màu phối nằm trong khối đó)</label>
          <div id="cvChinhRowsEdit">${chinhRowsHtml}</div>
          <button type="button" class="btn small secondary" id="btnAddChinhEdit">+ Thêm màu chính</button>
          <!-- v5.13 (muc 1.1.3.1): hang Tong cong - xem recalcCvTongCongEdit(). Tu v5.19: 1 span duy
               nhat (khong con 2 span rieng voi don vi hardcode "Cái"/"Ri") - noi dung day du do
               fmtDualUnit() sinh ra (vd "200 Cái (40 Ri5 dư 0 Cái)"). -->
          <div class="sub-total" style="margin-top:8px;">Tổng cộng: <span id="cvTongCongValEdit">0 Cái</span></div>
        </div>
        <p style="font-size:12px;color:#5f6368;">🔒 = màu đã có tiến độ ghi nhận (Giao vải/Cắt/May...) — chỉ sửa được số lượng/ảnh, không đổi loại vải/màu hay xóa được. Phụ kiện chỉ định vẫn không sửa được ở đây — điều chỉnh qua công đoạn "Phụ kiện" ở Ghi tiến độ.</p>

        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);

    modal.querySelectorAll('#cvChinhRowsEdit > [data-chinh]').forEach(card => { wireChinhCardEdit(card); wirePhoiBoxEdit(card); });
    wireChinhRemoveEdit(modal);
    wirePhuKienBox(modal);   // v5.42
    // v5.27 (1.1b/1.1c): them khach hang moi + chon NV thiet ke/ra rap tu danh sach nhan vien (giong form Tao moi).
    const btnKHE = modal.querySelector('#btnAddKHEdit');
    if (btnKHE) btnKHE.addEventListener('click', async () => {
      const ten = prompt('Tên khách hàng mới:'); if (!ten || !ten.trim()) return;
      const sdt = prompt('Số điện thoại (bỏ trống nếu chưa có):') || '';
      const diaChi = prompt('Địa chỉ (bỏ trống nếu chưa có):') || '';
      try {
        const res = await apiPost('/api/danhmuc/khachhang', { TenKhachHang: ten.trim(), SDT: sdt.trim() || null, DiaChi: diaChi.trim() || null }); dm.khachHang.push(res.data);
        // v6.43: ô là input + datalist.
        const dl = modal.querySelector('#dlKhachHangLenhEdit');
        if (dl) { const o = document.createElement('option'); o.value = res.data.TenKhachHang; dl.appendChild(o); }
        const inp = modal.querySelector('#inpKhachHangEdit');
        if (inp) inp.value = res.data.TenKhachHang;
        toast('Đã thêm khách hàng.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    const wireNvPickE = (selId, inpId) => { const s = modal.querySelector('#' + selId); if (s) s.addEventListener('change', () => { if (s.value) { modal.querySelector('#' + inpId).value = s.value; s.value = ''; } }); };
    wireNvPickE('selThietKeEdit', 'inpThietKeEdit');
    wireNvPickE('selKyThuatRapEdit', 'inpKyThuatRapEdit');
    /* v6.02: hộp NHIỀU ảnh hình in (thay khối 1-ảnh + nút "Xóa ảnh" của v5.92). Xóa/thêm ảnh chỉ đổi
       danh sách trên form; chỉ thực sự ghi khi bấm Lưu (bấm nhầm thì đóng form là xong). */
    const wAnhHinhInEdit = wireAnhHinhInBox('ahiEdit', tachAnhHinhIn(detail.AnhHinhIn));
    modal.querySelector('#inpHeSoQuyDoiEdit').addEventListener('input', recalcCvTongCongEdit);
    modal.querySelector('#inpDonViQuyDoiEdit').addEventListener('change', (e) => {
      const dvqd = dm.donViQuyDoi.find(d => String(d.ID) === e.target.value);
      if (dvqd) modal.querySelector('#inpHeSoQuyDoiEdit').value = dvqd.HeSo;
      recalcCvTongCongEdit();
    });
    modal.querySelector('#btnAddChinhEdit').addEventListener('click', () => {
      modal.querySelector('#cvChinhRowsEdit').insertAdjacentHTML('beforeend', chinhBlockHtmlEdit());
      const newCard = modal.querySelector('#cvChinhRowsEdit').lastElementChild;
      wireChinhCardEdit(newCard);
      wirePhoiBoxEdit(newCard);
      wireChinhRemoveEdit(modal);
      recalcCvTongCongEdit();
    });
    recalcCvTongCongEdit();

    modal.querySelector('#editForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        /* v6.02: ảnh hình in = danh sách trên form nối bằng '\n' (ảnh đã tải lên lúc chọn). Gửi thẳng cả
           danh sách, kể cả rỗng -> xóa hết ảnh (SQL ghi đè trực tiếp cột AnhHinhIn). */
        const anhHinhIn = noiAnhHinhIn(wAnhHinhInEdit.layDanhSach());
        // v5.42: cho SỬA ảnh sản phẩm — upload nếu chọn file mới, không thì giữ ảnh cũ (gửi lại URL cũ ở payload).
        let anhSanPham;
        const anhSanPhamFile = fd.get('anhSanPhamFile');
        if (anhSanPhamFile && anhSanPhamFile.size) anhSanPham = await uploadFile(anhSanPhamFile, 'donhang');

        // v5.6: build lai chiTietVai tu #cvChinhRowsEdit - upload anh MOI neu co chon file, giu anh CU
        // (.cv-anh-old) neu khong chon file moi cho khoi da co san tu truoc (khong bi mat anh khi luu
        // lai ma khong doi anh). Luon gui chiTietVai (kich hoat co che reconcile o PUT /orders/:maDH).
        // v5.13: Loai vai/Mau chinh+phoi doc qua getSearchableValue() (o go-tim, khong con la <select>).
        const chiTietVai = await Promise.all(Array.from(modal.querySelectorAll('#cvChinhRowsEdit > [data-chinh]')).map(async card => {
          // v5.27 (1.1e): uu tien anh vua paste (.cv-anh-url) > file moi chon > anh cu (.cv-anh-old).
          let anhMau = (card.querySelector('.cv-anh-url') && card.querySelector('.cv-anh-url').value) || '';
          const anhFile = card.querySelector('.cv-anh').files[0];
          const anhOldEl = card.querySelector('.cv-anh-old');
          if (!anhMau && anhFile) anhMau = await uploadFile(anhFile, 'mausac');
          else if (!anhMau && anhOldEl) anhMau = anhOldEl.value;
          return {
            // v5.27/v5.27.1: loai vai + mau deu go tu do (chi tham khao); MauSacID/LoaiVaiID = null.
            tenLoaiVaiTuDo: (card.querySelector('.cv-loaitudo').value || '').trim() || null,
            loaiVaiId: null,
            tenMauTuDo: (card.querySelector('.cv-mautudo').value || '').trim() || null,
            mauSacId: null,
            ghiChu: (card.querySelector('.cv-ghichu').value || '').trim() || null,
            donVi: card.querySelector('.cv-donvi').value,
            soLuong: soTuDo(card.querySelector('.cv-sl').value),   // v6.44: ô chữ, hiểu cả dấu phẩy
            anhMau,
            phoi: Array.from(card.querySelectorAll('[data-phoirow]')).map(r => ({
              tenLoaiVaiTuDo: (r.querySelector('.ph-loaitudo').value || '').trim() || null,
              loaiVaiId: null,
              tenMauTuDo: (r.querySelector('.ph-mautudo').value || '').trim() || null,
              mauSacId: null,
              donVi: r.querySelector('.phoi-donvi').value,
              soLuong: soTuDo(r.querySelector('.phoi-sl').value)   // v6.44
            }))
          };
        }));

        // v5.13 (muc 1.1.1/1.1.2): bo gui "tongSoLuong" (backend tu tinh tu chiTietVai, xem PUT
        // /orders/:maDH trong qlsx.js) - them gui "heSoQuyDoi".
        await apiPut(`/api/qlsx/orders/${maDH}`, {
          tenSanPham: fd.get('tenSanPham'), size: fd.get('size'),
          ...tachKhachHang(fd.get('khachHangText')),   // v6.43: -> { khachHangId, tenKhachHangTuDo }
          ngayDat: fd.get('ngayDat'), ngayGiao: fd.get('ngayGiao'),
          heSoQuyDoi: fd.get('heSoQuyDoi') || 1,
          // v5.21 (muc 1/2): dong "Danh mục đơn vị quy đổi" da chon (neu co) - de trong = khong quy doi.
          donViQuyDoiId: modal.querySelector('#inpDonViQuyDoiEdit').value || null,
          thietKeVien: fd.get('thietKeVien'), kyThuatRap: fd.get('kyThuatRap'),
          dongHinhIn: fd.get('dongHinhIn'), anhHinhIn,   // v6.02: chuỗi nhiều ảnh nối '\n' ('' = bỏ hết ảnh)
          coInTheu: modal.querySelector('#chkCoInTheuEdit') ? modal.querySelector('#chkCoInTheuEdit').checked : false,   // v5.33
          ghiChuLenh: fd.get('ghiChuLenh'), mac: fd.get('mac') || null, phuLieu: readPhuKien(modal),   // v5.42
          anhSanPham: anhSanPham !== undefined ? anhSanPham : (detail.AnhSanPham || null),   // v5.42: giữ ảnh cũ nếu không chọn ảnh mới
          chiTietVai
        });
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function doDeleteOrder(maDH) {
    if (!confirm(`Xác nhận xóa lệnh sản xuất ${maDH}? Thao tác này không thể hoàn tác.`)) return;
    try {
      await apiDelete(`/api/qlsx/orders/${maDH}`);
      toast('Đã xóa lệnh sản xuất.', 'success');
      render(container, currentUser);
    } catch (err) { toast(err.message, 'error'); }
  }

  // ================= RA LENH SAN XUAT (v5.0 - tach rieng khoi Danh sach don hang) =================
  // Cau truc vai: moi "mau chinh" la 1 khoi (card), mau PHOI nam LONG BEN TRONG khoi do (khac ban
  // cu: 2 dong Chinh/Phoi nam roi nhau khong lien ket). Phu kien can dung (chi dinh NPL) la 1 khoi
  // rieng, chon tu danh muc Quan ly phu kien - CHUA tru kho, chi la ke hoach/chi dinh.
  async function renderRaLenh(perm) {
    const body = document.getElementById('qBody');
    body.innerHTML = `<div id="ralenhArea"></div>`;
    renderLenhForm();
  }

  // v5.42: khối "Phụ kiện" nhập tự do nhiều dòng (dùng chung cho form Tạo + form Sửa lệnh SX).
  // Lưu trong cột PhuLieu dạng chuỗi các dòng nối bằng \n.
  function phuKienRowHtml(val) {
    return `<div class="sub-row-item" data-pkrow style="display:flex;gap:6px;margin-bottom:6px;"><input class="pk-text" type="text" style="flex:1;" placeholder="VD: Mác sườn áo, dây cổ MQ, túi zip, giấy nến..." value="${escapeHtml(val || '')}"><button type="button" class="btn small danger pk-remove">X</button></div>`;
  }
  function phuKienBoxHtml(phuLieuStr) {
    const lines = (phuLieuStr || '').split('\n').map(s => s.trim()).filter(Boolean);
    const rows = (lines.length ? lines : ['']).map(phuKienRowHtml).join('');
    return `<div id="phuKienRows">${rows}</div>
      <button type="button" class="btn small secondary" id="btnAddPhuKien">+ Thêm dòng phụ kiện</button>`;
  }
  function wirePhuKienBox(root) {
    const box = root.querySelector('#phuKienRows');
    const addBtn = root.querySelector('#btnAddPhuKien');
    if (!box) return;
    function wireRow(rowEl) {
      const rm = rowEl.querySelector('.pk-remove');
      if (rm) rm.addEventListener('click', () => {
        if (box.querySelectorAll('[data-pkrow]').length > 1) rowEl.remove();
        else rowEl.querySelector('.pk-text').value = '';
      });
    }
    box.querySelectorAll('[data-pkrow]').forEach(wireRow);
    if (addBtn) addBtn.addEventListener('click', () => { box.insertAdjacentHTML('beforeend', phuKienRowHtml('')); wireRow(box.lastElementChild); });
  }
  function readPhuKien(root) {
    return Array.from(root.querySelectorAll('#phuKienRows [data-pkrow] .pk-text'))
      .map(i => i.value.trim()).filter(Boolean).join('\n') || null;
  }

  function renderLenhForm() {
    const area = document.getElementById('ralenhArea');
    let chinhIdx = 0;
    let phoiRowIdx = 0;

    // v5.13 (muc 1.1.3.2): them nhanh 1 dong Loai vai/Mau MOI ngay tai cho (khong roi form dang dien),
    // luu thang vao danh muc qua API CRUD chung san co (buildCrudRouter, xem backend/routes/danhmuc.js)
    // roi tu chon lai dong vua tao trong dung o go-tim vua bam nut. Dung prompt() don gian (khong dung
    // modal long modal - he thong modal cua app nay la SINGLETON, mo 1 modal moi se dong mat form dang
    // dien) - danh cho thao tac phu, hiem khi dung, khong dang de xay 1 UI rieng phuc tap hon.
    async function addLoaiVaiInline(searchId) {
      const ten = prompt('Tên loại vải mới:');
      if (!ten || !ten.trim()) return;
      try {
        const res = await apiPost('/api/danhmuc/loaivai', { TenLoaiVai: ten.trim() });
        dm.loaiVai.push(res.data);
        document.getElementById(searchId + '_text').value = res.data.TenLoaiVai;
        document.getElementById(searchId + '_val').value = res.data.LoaiVaiID;
        toast('Đã thêm loại vải "' + res.data.TenLoaiVai + '" vào danh mục.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }
    // v5.13: Mau sac can 2 truong (MaMau + TenMau, ca 2 deu required o danh muc - xem danhmuc.js) - dung
    // luon ten nguoi dung go lam ca 2 de giu nhanh/don gian cho thao tac "them tam", co the vao Danh
    // mục → Màu sắc sua lai Ma mau rieng sau neu can chuan hoa.
    async function addMauSacInline(searchId) {
      const ten = prompt('Tên màu mới (dùng luôn làm mã màu):');
      if (!ten || !ten.trim()) return;
      try {
        const res = await apiPost('/api/danhmuc/mausac', { MaMau: ten.trim(), TenMau: ten.trim() });
        dm.mauSac.push(res.data);
        document.getElementById(searchId + '_text').value = res.data.TenMau;
        document.getElementById(searchId + '_val').value = res.data.MauSacID;
        toast('Đã thêm màu "' + res.data.TenMau + '" vào danh mục.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }
    // v5.27 (muc 1.1b): them nhanh 1 khach hang MOI ngay tai form Ra lenh (neu chua co trong danh muc).
    async function addKhachHangInline() {
      const ten = prompt('Tên khách hàng mới:');
      if (!ten || !ten.trim()) return;
      const sdt = prompt('Số điện thoại (bỏ trống nếu chưa có):') || '';
      const diaChi = prompt('Địa chỉ (bỏ trống nếu chưa có):') || '';
      try {
        const res = await apiPost('/api/danhmuc/khachhang', { TenKhachHang: ten.trim(), SDT: sdt.trim() || null, DiaChi: diaChi.trim() || null });
        dm.khachHang.push(res.data);
        // v6.43: ô là input + datalist -> bổ sung gợi ý rồi điền thẳng tên vào ô.
        const dl = document.getElementById('dlKhachHangLenh');
        if (dl) { const o = document.createElement('option'); o.value = res.data.TenKhachHang; dl.appendChild(o); }
        const inp = document.getElementById('inpKhachHang');
        if (inp) inp.value = res.data.TenKhachHang;
        toast('Đã thêm khách hàng "' + res.data.TenKhachHang + '" vào danh mục.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    }

    // v5.13 (muc 1.1.1/1.1.3.1): "Tong so luong" khong con o nhap tay rieng (backend gio tu tinh tong
    // luc luu, xem POST /orders trong qlsx.js) - thay bang 1 hang "Tong cong" doc ngay duoi Cau truc
    // vai, TU CONG DON SL tung mau chinh + nhan voi "He so quy doi" (muc 1.1.2) ra SL sau quy doi, tinh
    // truc tiep tren trinh duyet de nguoi dung thay NGAY khi go (gia tri luu that su van do backend tu
    // tinh lai tu chiTietVai, o day chi de XEM TRUOC).
    // v5.21 (muc 1/2, yeu cau "Làm lại dòng tổng cộng... đơn vị tính chính là ri thì đơn vị quy đổi sẽ
    // là ri x hệ số quy đổi (cái)"): THAY THE fmtDualUnit() (v5.19 - vay tu The kho hang hoa, luon CHIA,
    // sai ban chat) bang fmtQuyDoi() - doc PhepTinh/TenDonViQuyDoi tu dong "Danh mục đơn vị quy đổi" dang
    // duoc chon (#inpDonViQuyDoi, xem migration_v521.sql), khong con hardcode 'Ri'/chia.
    function recalcCvTongCong() {
      const total = Array.from(area.querySelectorAll('#cvChinhRows .cv-sl')).reduce((s, i) => s + soTuDo(i.value), 0);   // v6.44
      const heSoEl = document.getElementById('inpHeSoQuyDoi');
      const heSo = Number(heSoEl ? heSoEl.value : 1) || 1;
      const firstDonViEl = area.querySelector('#cvChinhRows .cv-donvi');
      const donVi = firstDonViEl ? firstDonViEl.value : 'Cái';
      const dvqdEl = document.getElementById('inpDonViQuyDoi');
      const dvqd = dvqdEl ? dm.donViQuyDoi.find(d => String(d.ID) === String(dvqdEl.value)) : null;
      const totalEl = document.getElementById('cvTongCongVal');
      if (totalEl) totalEl.innerHTML = fmtQuyDoi(total, heSo, dvqd ? dvqd.PhepTinh : null, donVi, dvqd ? dvqd.DonViQuyDoi : null);
    }

    // v5.2: them o tai anh RIENG cho tung mau chinh (moi vai chinh 1 anh, yeu cau v5.2 muc 3b) - anh mau
    // phoi khong co (chi mau chinh), luu vao DonHangChiTietVai.AnhMau.
    // v5.13 (muc 1.1.3.2/1.1.3.3): Loai vai/Mau chinh doi sang o go-tim (searchableSelectHtml, dung
    // CHUNG voi Cat/Giao vai...) kem nut "+ Mới" them nhanh vao danh muc.
    function chinhBlockHtml() {
      const myIdx = chinhIdx++;
      return `<div class="card" data-chinh="${myIdx}" style="margin-bottom:10px;">
        <div class="form-grid" style="grid-template-columns:1.3fr 1.3fr .8fr .7fr 1.3fr auto;align-items:end;gap:8px;">
          <div><label>Loại vải (chính)</label>
            <input class="cv-loaitudo" type="text" placeholder="Nhập loại vải (tự do)"></div>
          <div><label>Màu chính (tham khảo)</label>
            <input class="cv-mautudo" type="text" placeholder="Nhập màu (tự do)"></div>
          ${/* v6.43: GÕ TỰ DO — xem ghi chú ở form Sửa lệnh. */''}
          ${ensureDlCvDonVi()}<div><label>Đơn vị</label><input class="cv-donvi" list="dlCvDonVi" placeholder="Gõ tự do" autocomplete="off"></div>
          ${/* v6.44: ô chữ + soTuDo() — nhận cả 1,5 và 1.5. */''}
          <div><label>Số lượng</label><input class="cv-sl" type="text" inputmode="decimal" placeholder="Gõ tự do (1,5 hoặc 1.5)"></div>
          <!-- v5.13 (muc 1.1.3.4): xem truoc anh ngay khi chon, kich thuoc TU CO GIAN theo anh that
               (max-width/max-height lam gioi han, khong ep cung 1 khung vuong nho) - xem wireRowImagePreview(). -->
          <div><label>Ảnh màu</label><input type="file" class="cv-anh" accept="image/*"><input type="hidden" class="cv-anh-url">
            <div class="cv-anh-preview" tabindex="0" title="Bấm vào đây rồi dán ảnh (Ctrl+V), hoặc chọn file" style="margin-top:4px;min-height:22px;outline:1px dashed var(--border);border-radius:4px;padding:3px;font-size:11px;color:#9aa0a6;">Dán ảnh (Ctrl+V)</div></div>
          <div><button type="button" class="btn small danger cv-remove-chinh">X</button></div>
        </div>
        <div style="margin-top:6px;"><input class="cv-ghichu" type="text" placeholder="Ghi chú (dòng màu chính này)" style="width:100%;"></div>
        <div class="sub-row-box" data-phoibox>
          <div class="sub-rows"></div>
          <button type="button" class="btn small secondary btn-add-phoi">+ Thêm màu phối (nằm trong màu chính này)</button>
        </div>
      </div>`;
    }
    // v5.7: bo o "Số lượng"/"Đơn vị" khoi dong vai PHOI luc RA LENH (yeu cau v5.7 "Phần vải phối không
    // cần đánh số lượng, đơn vị tính chỉ chọn loại vải và mầu") - phoi von khong theo doi tien do rieng
    // (xem v5.6), SL/DVT it y nghia o day. CHI ap dung cho form TAO MOI nay - form SUA (phoiRowHtmlEdit)
    // CO Y GIU NGUYEN 2 o nay, vi PUT /orders/:maDH luon reconcile lai TOAN BO chiTietVai moi lan luu,
    // neu bo o nhap o ca form Sua se vo tinh XOA TRANG so lieu SL/DVT phoi da co san tu don hang cu.
    // v5.13: Loai vai/Mau phoi cung doi sang o go-tim + nut "+ Mới", dung 1 bo dem GLOBAL (phoiRowIdx,
    // khong theo chinhIdx) cho id duy nhat - mirror pattern sdAddRowIdx/catPickIdx da dung san.
    function phoiRowHtml() {
      const myIdx = phoiRowIdx++;
      return `<div class="sub-row-item" data-phoirow data-phoiidx="${myIdx}" style="flex-wrap:wrap;">
        <div style="flex:1.3;"><input class="ph-loaitudo" type="text" placeholder="Loại vải phối (tự do)"></div>
        <div style="flex:1.3;"><input class="ph-mautudo" type="text" placeholder="Màu phối (tự do)"></div>
        <button type="button" class="btn small danger phoi-remove">X</button>
      </div>`;
    }
    function wireRowImagePreview(cardEl) {
      const fileInput = cardEl.querySelector('.cv-anh');
      const previewEl = cardEl.querySelector('.cv-anh-preview');
      const urlEl = cardEl.querySelector('.cv-anh-url');
      if (!fileInput || !previewEl) return;
      const showImg = (src) => { previewEl.innerHTML = `<img src="${src}" style="max-width:120px;max-height:120px;width:auto;height:auto;border-radius:4px;border:1px solid var(--border);">`; };
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (urlEl) urlEl.value = '';   // chon file moi -> bo URL da paste truoc do (luc luu se upload file nay)
        if (file) showImg(URL.createObjectURL(file)); else previewEl.textContent = 'Dán ảnh (Ctrl+V)';
      });
      // v5.27 (muc 1.1e): dan anh (Ctrl+V) giong Mo ta san pham - upload NGAY, luu URL vao hidden field.
      previewEl.addEventListener('paste', async (e) => {
        const items = (e.clipboardData && e.clipboardData.items) || [];
        const imgItem = Array.from(items).find(it => it.type && it.type.indexOf('image/') === 0);
        if (!imgItem) return;
        e.preventDefault();
        const file = imgItem.getAsFile();
        if (!file) return;
        try { const url = await uploadFile(file, 'mausac'); if (urlEl) urlEl.value = url; fileInput.value = ''; showImg(url); }
        catch (err) { toast(err.message, 'error'); }
      });
    }
    function wireChinhCard(cardEl) {
      const myIdx = cardEl.dataset.chinh;
      wireRowImagePreview(cardEl);
      cardEl.querySelector('.cv-sl').addEventListener('input', recalcCvTongCong);
      // v5.19: don vi cua khoi mau chinh DAU TIEN gio anh huong nhan hien thi "Tổng cộng" (fmtDualUnit) -
      // can tinh lai neu nguoi dung doi Don vi, khong chi khi doi So luong.
      // v6.43: ô là <input> -> bắt cả 'input'.
      cardEl.querySelector('.cv-donvi').addEventListener('change', recalcCvTongCong);
      cardEl.querySelector('.cv-donvi').addEventListener('input', recalcCvTongCong);
    }
    function wirePhoiBox(cardEl) {
      const box = cardEl.querySelector('[data-phoibox]');
      function wireRow(rowEl) {
        const idx = rowEl.dataset.phoiidx;
        rowEl.querySelector('.phoi-remove').addEventListener('click', () => rowEl.remove());
      }
      box.querySelectorAll('[data-phoirow]').forEach(wireRow);
      box.querySelector('.btn-add-phoi').addEventListener('click', () => {
        box.querySelector('.sub-rows').insertAdjacentHTML('beforeend', phoiRowHtml());
        wireRow(box.querySelector('.sub-rows').lastElementChild);
      });
    }
    function wireChinhRemove() {
      area.querySelectorAll('.cv-remove-chinh').forEach(btn => btn.onclick = () => {
        if (area.querySelectorAll('#cvChinhRows > [data-chinh]').length > 1) { btn.closest('[data-chinh]').remove(); recalcCvTongCong(); }
      });
    }

    area.innerHTML = `
      <div class="card" id="lenhFormCard">
        <h3 style="margin-top:0;">Chỉ định sản xuất</h3>
        <form id="lenhForm">
          <div class="form-grid">
            <div class="form-row"><label>Tên sản phẩm *</label><input name="tenSanPham" required></div>
            <div class="form-row"><label>Mã đơn hàng</label><input id="inpMaDHPreview" value="(đang tạo mã...)" disabled title="Mã đơn hàng do hệ thống tự sinh — chỉ ghi vào CSDL khi bấm Lưu"></div>
            <div class="form-row"><label>Size</label><input name="size" placeholder="VD: 9M - 4Y"></div>
            ${/* v6.43: Khách hàng GÕ TỰ DO. Gõ trùng tên có trong danh mục -> vẫn lưu khóa nối như cũ
                  (công nợ/lọc theo khách không đứt). Gõ tên lạ -> lưu chữ vào riêng lệnh này, KHÔNG
                  đẻ thêm bản ghi trong Danh mục khách hàng. Nút "+ Mới" giữ lại cho ai muốn thêm hẳn
                  vào danh mục. */''}
            <div class="form-row"><label>Khách hàng</label>
              <div style="display:flex;gap:4px;align-items:center;">
                <input name="khachHangText" id="inpKhachHang" list="dlKhachHangLenh" style="flex:1;" placeholder="Gõ tên khách (có sẵn hoặc tên mới)" autocomplete="off">
                <button type="button" class="btn small secondary" id="btnAddKH" title="Thêm hẳn khách này vào Danh mục khách hàng">+ Mới</button>
              </div>
              <datalist id="dlKhachHangLenh">${dm.khachHang.map(k => `<option value="${escapeHtml(k.TenKhachHang)}">`).join('')}</datalist>
              <div class="empty-hint" style="padding:2px 0 0;">Tên chưa có trong danh mục vẫn lưu được — chỉ hiện ở lệnh này và các bản in, không thêm vào danh mục.</div></div>
            <div class="form-row"><label>Ngày đặt</label><input type="date" name="ngayDat" value="${new Date().toISOString().slice(0, 10)}"></div>
            <div class="form-row"><label>Deadline ra hàng *</label><input type="date" name="ngayGiao" required></div>
            <!-- v5.13 (muc 1.1.2): "He so quy doi" MOI, khai bao 1 lan o day - dung CHUNG cho cong doan
                 Cat sau nay thay vi nhap tay tung cay/tung lan Ghi tien do - xem renderStageFields('CAT'). -->
            <div class="form-row"><label>Hệ số quy đổi</label><input id="inpHeSoQuyDoi" name="heSoQuyDoi" type="number" min="0" step="0.001" value="1"></div>
            <!-- v5.21 (muc 1/2): chon 1 dong "Danh mục đơn vị quy đổi" (Danh mục QLSX) - auto-dien lai
                 Hệ số quy đổi o tren (van sua tay duoc rieng) + quyet dinh Phép tính (Nhân/Chia) + nhãn
                 don vi quy doi dung khi hien thi dong "Tổng cộng" (xem recalcCvTongCong()). -->
            <div class="form-row"><label>Đơn vị quy đổi</label><select id="inpDonViQuyDoi">
              <option value="">-- Không quy đổi --</option>
              ${dm.donViQuyDoi.map(d => `<option value="${d.ID}">${escapeHtml(d.DonViChinh)} → ${escapeHtml(d.DonViQuyDoi)} (${d.PhepTinh === 'Chia' ? '÷' : '×'}${d.HeSo})</option>`).join('')}
            </select></div>
            <div class="form-row"><label>Ảnh sản phẩm</label><input type="file" name="anhFile" accept="image/*"></div>
            <div class="form-row"><label>Thiết kế</label>
              <div style="display:flex;gap:4px;"><input name="thietKeVien" id="inpThietKe" placeholder="Chọn NV hoặc gõ tên" style="flex:1;"><select id="selThietKe" title="Chọn từ danh sách nhân viên" style="max-width:130px;"><option value="">↧ NV</option>${opt(nhanVienKyThuat(), 'HoTen', 'HoTen')}</select></div></div>
            <div class="form-row"><label>Kỹ thuật rập</label>
              <div style="display:flex;gap:4px;"><input name="kyThuatRap" id="inpKyThuatRap" placeholder="Chọn NV hoặc gõ tên" style="flex:1;"><select id="selKyThuatRap" title="Chọn từ danh sách nhân viên" style="max-width:130px;"><option value="">↧ NV</option>${opt(nhanVienKyThuat(), 'HoTen', 'HoTen')}</select></div></div>
          </div>
          <div class="form-row"><label>Có in thêu</label><label style="font-weight:normal;"><input type="checkbox" id="chkCoInTheu"> Đơn hàng này có công đoạn in/thêu (bỏ trống = bỏ qua 2 công đoạn Giao/Nhận in thêu)</label></div>
          <div class="form-row"><label>Dòng hình in</label><input name="dongHinhIn" placeholder="VD: In ngực trái logo ABC, in lưng sau chữ XYZ..."></div>
          ${/* v5.92: xem trước + xóa ảnh ngay khi chọn. v6.02: NHIỀU ảnh (xem anhHinhInBoxHtml). */''}
          <div class="form-row"><label>Ảnh hình in thêu (tuỳ chọn — thêm được nhiều ảnh)</label>${anhHinhInBoxHtml('ahiMoi')}</div>
          <div class="form-row"><label>Ghi chú (LƯU Ý)</label><textarea name="ghiChuLenh" rows="2"></textarea></div>
          <div class="form-row"><label>Mác</label><input name="mac" placeholder="VD: Mác MQ sườn áo, thẻ bài MQ... (nhập tự do)"></div>
          <div class="form-row"><label>Phụ kiện (nhập tự do, mỗi dòng 1 loại — có thể thêm nhiều dòng)</label>${phuKienBoxHtml('')}</div>

          <div class="form-row"><label>Cấu trúc vải (mỗi khối là 1 màu chính, màu phối nằm trong khối đó)</label>
            <div id="cvChinhRows">${chinhBlockHtml()}</div>
            <button type="button" class="btn small secondary" id="btnAddChinh">+ Thêm màu chính</button>
            <!-- v5.13 (muc 1.1.3.1): hang Tong cong - xem recalcCvTongCong(). Tu v5.19: 1 span duy nhat
                 (xem ghi chu tai chinhBlockHtmlEdit/cvTongCongValEdit ve ly do bo 2-span hardcode don vi). -->
            <div class="sub-total" style="margin-top:8px;">Tổng cộng: <span id="cvTongCongVal">0 Cái</span></div>
          </div>

          <div style="margin-top:14px;"><button type="submit" class="btn">LƯU LỆNH SẢN XUẤT</button></div>
        </form>
      </div>
      <div id="lenhResult"></div>`;

    wireChinhCard(area.querySelector('[data-chinh]'));
    wirePhoiBox(area.querySelector('[data-chinh]'));
    wireChinhRemove();
    wirePhuKienBox(area);   // v5.42
    document.getElementById('inpHeSoQuyDoi').addEventListener('input', recalcCvTongCong);
    // v5.27 (1.1b): them khach hang moi ngay tren form Ra lenh.
    document.getElementById('btnAddKH').addEventListener('click', addKhachHangInline);
    // v5.27 (1.1c): chon NV thiet ke / ra rap tu danh sach nhan vien (HRM) -> dien vao o ten (van go tay duoc).
    const wireNvPick = (selId, inpId) => { const s = document.getElementById(selId); if (s) s.addEventListener('change', () => { if (s.value) { document.getElementById(inpId).value = s.value; s.value = ''; } }); };
    wireNvPick('selThietKe', 'inpThietKe');
    wireNvPick('selKyThuatRap', 'inpKyThuatRap');
    // v6.02: hộp NHIỀU ảnh hình in ở form RA LỆNH (ảnh tải lên ngay khi chọn, xóa từng ảnh bằng nút ×).
    const wAnhHinhInMoi = wireAnhHinhInBox('ahiMoi', []);
    // v5.27.1: xem truoc Ma DH tu sinh NGAY (chua luu). Chi hien thi - ma that sinh lai luc Luu.
    apiGet('/api/qlsx/next-madh').then(r => { const el = document.getElementById('inpMaDHPreview'); if (el && r.data && r.data.maDH) el.value = r.data.maDH + ' (tự sinh khi lưu)'; }).catch(() => { const el = document.getElementById('inpMaDHPreview'); if (el) el.value = '(tự động sinh khi lưu)'; });
    // v5.21 (muc 1/2): chon 1 dong danh muc -> auto-dien lai He so quy doi (van sua tay duoc them sau
    // do neu can lech voi danh muc) roi tinh lai Tong cong ngay.
    document.getElementById('inpDonViQuyDoi').addEventListener('change', (e) => {
      const dvqd = dm.donViQuyDoi.find(d => String(d.ID) === e.target.value);
      if (dvqd) document.getElementById('inpHeSoQuyDoi').value = dvqd.HeSo;
      recalcCvTongCong();
    });
    document.getElementById('btnAddChinh').addEventListener('click', () => {
      document.getElementById('cvChinhRows').insertAdjacentHTML('beforeend', chinhBlockHtml());
      const newCard = document.getElementById('cvChinhRows').lastElementChild;
      wireChinhCard(newCard);
      wirePhoiBox(newCard);
      wireChinhRemove();
      recalcCvTongCong();
    });

    document.getElementById('lenhForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        let anhSanPham = '';
        const file = fd.get('anhFile');
        if (file && file.size) anhSanPham = await uploadFile(file, 'donhang');

        // v5.5: "Hinh in" them chuc nang tai anh len - van giu nguyen o chu DongHinhIn.
        // v6.02: NHIỀU ảnh — lấy danh sách từ hộp ảnh (đã tải lên lúc chọn), nối bằng '\n'.
        const anhHinhIn = noiAnhHinhIn(wAnhHinhInMoi.layDanhSach());

        // v5.2: upload anh RIENG cho tung mau chinh (tuan tu, Promise.all de khong cho nhau qua lau).
        // v5.13: Loai vai/Mau chinh+phoi doc qua getSearchableValue() (o go-tim, khong con la <select>).
        const chiTietVai = await Promise.all(Array.from(area.querySelectorAll('#cvChinhRows > [data-chinh]')).map(async card => {
          // v5.27 (1.1e): anh mau da paste san (upload -> .cv-anh-url) hoac chon file (upload luc luu).
          let anhMau = (card.querySelector('.cv-anh-url') && card.querySelector('.cv-anh-url').value) || '';
          const anhFile = card.querySelector('.cv-anh').files[0];
          if (!anhMau && anhFile) anhMau = await uploadFile(anhFile, 'mausac');
          return {
            // v5.27/v5.27.1: loai vai + mau deu go tu do (chi tham khao); MauSacID/LoaiVaiID = null.
            tenLoaiVaiTuDo: (card.querySelector('.cv-loaitudo').value || '').trim() || null,
            loaiVaiId: null,
            tenMauTuDo: (card.querySelector('.cv-mautudo').value || '').trim() || null,
            mauSacId: null,
            ghiChu: (card.querySelector('.cv-ghichu').value || '').trim() || null,
            donVi: card.querySelector('.cv-donvi').value,
            soLuong: soTuDo(card.querySelector('.cv-sl').value),   // v6.44: ô chữ, hiểu cả dấu phẩy
            anhMau,
            // v5.7: phoi khong co o SL/DVT o form nay - gui co dinh donVi:null, soLuong:0.
            phoi: Array.from(card.querySelectorAll('[data-phoirow]')).map(r => ({
              tenLoaiVaiTuDo: (r.querySelector('.ph-loaitudo').value || '').trim() || null,
              loaiVaiId: null,
              tenMauTuDo: (r.querySelector('.ph-mautudo').value || '').trim() || null,
              mauSacId: null,
              donVi: null,
              soLuong: 0
            }))
          };
        }));

        // v5.13 (muc 1.1.1/1.1.2): bo gui "tongSoLuong" (backend tu tinh tu chiTietVai, xem POST /orders
        // trong qlsx.js) - them gui "heSoQuyDoi".
        const res = await apiPost('/api/qlsx/orders', {
          tenSanPham: fd.get('tenSanPham'), size: fd.get('size'),
          ...tachKhachHang(fd.get('khachHangText')),   // v6.43: -> { khachHangId, tenKhachHangTuDo }
          ngayDat: fd.get('ngayDat'), ngayGiao: fd.get('ngayGiao'),
          anhSanPham, heSoQuyDoi: fd.get('heSoQuyDoi') || 1,
          // v5.21 (muc 1/2): dong "Danh mục đơn vị quy đổi" da chon (neu co) - de trong = khong quy doi.
          donViQuyDoiId: document.getElementById('inpDonViQuyDoi').value || null,
          thietKeVien: fd.get('thietKeVien'), kyThuatRap: fd.get('kyThuatRap'),
          dongHinhIn: fd.get('dongHinhIn'), anhHinhIn, ghiChuLenh: fd.get('ghiChuLenh'),
          coInTheu: document.getElementById('chkCoInTheu') ? document.getElementById('chkCoInTheu').checked : false,   // v5.33
          mac: fd.get('mac') || null, phuLieu: readPhuKien(area),   // v5.42
          chiTietVai
        });

        toast('Đã tạo lệnh sản xuất ' + res.data.maDH + '.', 'success');
        // v5.8: an form vua nop (khong chi hien ket qua BEN CANH no) - fix "refresh về trang trắng,
        // hiện tại đang lưu lại cấu trúc vải từ phiên trước" (yeu cau v5.8): truoc day #lenhForm van
        // hien nguyen voi du lieu VUA nop ngay canh khung "Đã tạo lệnh", de nguoi dung de hieu nham la
        // trang "không refresh". renderLenhForm() (goi khi bam "Tạo lệnh mới") thay THE TOAN BO
        // area.innerHTML nen tu ve lai form trang - khong can sua gi them o do.
        const oldFormCard = document.getElementById('lenhFormCard');
        if (oldFormCard) oldFormCard.style.display = 'none';
        document.getElementById('lenhResult').innerHTML = `<div class="card" style="background:#eef8ee;border-color:#c8e6c9;">
          <h3 style="margin-top:0;">Đã tạo lệnh sản xuất ${escapeHtml(res.data.maDH)}</h3>
          <button type="button" class="btn" id="btnPrintLenhMoi">🖨️ In lệnh sản xuất</button>
          <button type="button" class="btn secondary" id="btnLenhTiep">Tạo lệnh mới</button>
        </div>`;
        document.getElementById('btnPrintLenhMoi').addEventListener('click', () => printLenhSanXuat(res.data.maDH));
        document.getElementById('btnLenhTiep').addEventListener('click', renderLenhForm);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // In "Lệnh sản xuất" theo bố cục mẫu file "CHỈ ĐỊNH SẢN XUẤT.docx" - phần "Vải áo"/"Vải quần + cổ +
  // túi" cố định của file mẫu được tổng quát thành 1 bảng "Cấu trúc vải" động (hệ thống hiện chưa có
  // trường phân biệt vị trí sử dụng áo/quần theo từng dòng vải), và "Hình in" hiển thị dạng dòng chữ
  // (dòng hình in) theo đúng nội dung nhập ở form, không phải 4 ô ảnh như bản mẫu gốc.
  async function printLenhSanXuat(maDH) {
    // v5.8: khong con can meo "mo cua so TRUOC khi goi API" (chi de phong popup blocker cua
    // window.open() - xem ghi chu printHtml() trong common.js) vi in nay qua <iframe> an, khong bi
    // popup blocker chi phoi bat ke goi truoc hay sau await.
    let res;
    try {
      res = await apiGet(`/api/qlsx/orders/${maDH}/lenh`);
    } catch (e) {
      toast('Lỗi khi lấy dữ liệu lệnh sản xuất: ' + e.message, 'error');
      return;
    }
    const o = res.data;
    const chiTietVai = o.chiTietVai || [];
    // v5.40: THAY bố cục in .docx cũ — in "Chỉ định sản xuất" theo 2 mẫu Excel, TỰ CHỌN theo SỐ MÀU CHÍNH
    // (mỗi phần tử chiTietVai = 1 màu chính; phối lồng bên trong): 1 màu -> buildForm1Mau; >1 -> buildFormNhieuMau.
    // (Bố cục in .docx cũ đã gỡ bỏ; xem 2 hàm buildForm1Mau/buildFormNhieuMau ngay bên dưới hàm này.)
    if (chiTietVai.length > 1) return printHtml('Chỉ định sản xuất - ' + maDH, buildFormNhieuMau(o, chiTietVai));
    return printHtml('Chỉ định sản xuất - ' + maDH, buildForm1Mau(o, chiTietVai));
  }

  // v5.40: 2 hàm dựng form in "Chỉ định sản xuất" theo bố cục FORM CHỈ ĐỊNH SẢN XUẤT.xlsx.
  // Dùng chung nguồn dữ liệu /orders/:maDH/lenh. Field không có nguồn (Phụ liệu, Nhà in) để trống cho ghi tay.
  function joinLoaiMau(loai, mau) {
    return [loai, mau].filter(x => x != null && String(x).trim() !== '').map(escapeHtml).join(' - ');
  }
  function lenhFabricPhoi(c) {
    return (c.phoi && c.phoi.length)
      ? c.phoi.map(p => joinLoaiMau(p.TenLoaiVaiTuDo || p.TenLoaiVai, p.TenMauTuDo || p.TenMau)).filter(Boolean).join(', ')
      : '';
  }
  /* v5.92: ô chọn "Nhân viên thiết kế" và "Kỹ thuật rập" CHỈ liệt kê nhân viên BỘ PHẬN KỸ THUẬT
     (trước đây đổ toàn bộ nhân viên công ty nên rất dài và dễ chọn nhầm).
     So khớp bỏ dấu + chữ thường nên "Kỹ thuật", "Ky thuat", "Phòng Kỹ Thuật"... đều nhận.
     AN TOÀN: nếu công ty CHƯA khai bộ phận nào tên kỹ thuật thì trả về TOÀN BỘ danh sách như cũ —
     tránh trường hợp danh sách rỗng làm không nhập nổi lệnh sản xuất. */
  function nhanVienKyThuat() {
    // Bỏ dấu bằng cách LỌC THEO MÃ KÝ TỰ (0x300–0x36F là các dấu thanh/mũ sau normalize('NFD')),
    // KHÔNG dùng regex chứa ký tự dấu — tránh hỏng khi file bị lưu lại bằng bảng mã khác.
    const chuan = (s) => Array.from(String(s == null ? '' : s).normalize('NFD'))
      .filter(c => { const m = c.codePointAt(0); return m < 0x300 || m > 0x36f; })
      .join('').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
    const ds = (dm.nhanVien || []).filter(nv => chuan(nv.TenBoPhan).includes('ky thuat'));
    return ds.length ? ds : (dm.nhanVien || []);
  }

  /* ================================================================================================
     v6.02 — NHIỀU ẢNH HÌNH IN THÊU (Ra lệnh sản xuất + Sửa lệnh)
     Lưu trong ĐÚNG 1 cột DonHangSanXuat.AnhHinhIn, các đường dẫn nối bằng '\n' — cùng quy ước với
     PhuLieu (v5.42), nên mọi chỗ ĐỌC chỉ cần tách chuỗi, không phải thêm bảng con + JOIN.
     Ảnh được tải lên NGAY khi chọn (giống ảnh cây vải ở công đoạn Cắt v5.87), form chỉ giữ đường dẫn.
     Dữ liệu cũ (1 ảnh, không có '\n') vẫn đọc ra đúng 1 ảnh — không cần chuyển đổi dữ liệu.
     ================================================================================================ */
  function tachAnhHinhIn(s) {
    return String(s == null ? '' : s).split('\n').map(x => x.trim()).filter(Boolean);
  }
  function noiAnhHinhIn(arr) {
    return (arr || []).map(x => String(x || '').trim()).filter(Boolean).join('\n');
  }
  function anhHinhInBoxHtml(idPrefix) {
    return `<div data-anhinbox="${idPrefix}">
        <div id="${idPrefix}List" style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-bottom:6px;"></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="file" id="${idPrefix}File" accept="image/*" capture="environment" multiple style="max-width:260px;">
          <span class="empty-hint" style="padding:0;">Chọn được NHIỀU ảnh cùng lúc · bấm × trên ảnh để xóa</span>
        </div>
      </div>`;
  }
  // Trả về { layDanhSach() } để lúc Lưu đọc danh sách đường dẫn ảnh hiện có trên form.
  function wireAnhHinhInBox(idPrefix, danhSachBanDau) {
    const arr = (danhSachBanDau || []).slice();
    const listEl = document.getElementById(idPrefix + 'List');
    const fileEl = document.getElementById(idPrefix + 'File');
    const ve = () => {
      if (!listEl) return;
      listEl.innerHTML = arr.map((u, i) => `<div style="position:relative;">
          <a href="${escapeHtml(u)}" target="_blank" title="Bấm để xem ảnh to"><img src="${escapeHtml(u)}" style="width:78px;height:78px;object-fit:cover;border-radius:4px;border:1px solid var(--border);"></a>
          <button type="button" class="btn small danger anh-in-xoa" data-i="${i}" title="Xóa ảnh này"
                  style="position:absolute;top:-7px;right:-7px;padding:0 6px;line-height:17px;border-radius:50%;">×</button>
        </div>`).join('') || '<span class="empty-hint" style="padding:0;">Chưa có ảnh hình in</span>';
      listEl.querySelectorAll('.anh-in-xoa').forEach(b => b.addEventListener('click', () => {
        arr.splice(Number(b.dataset.i), 1);
        ve();
      }));
    };
    ve();
    if (fileEl) fileEl.addEventListener('change', async () => {
      const files = Array.from(fileEl.files || []);
      if (!files.length) return;
      let soOK = 0;
      for (const f of files) {
        try { arr.push(await uploadFile(f, 'donhang')); soOK++; }
        catch (err) { toast('Không tải được ảnh ' + f.name + ': ' + err.message, 'error'); }
      }
      fileEl.value = '';   // cho phép chọn lại đúng file đó lần sau
      ve();
      if (soOK) toast(`Đã thêm ${soOK} ảnh hình in (bấm Lưu để áp dụng).`, 'success');
    });
    return { layDanhSach: () => arr.slice() };
  }

  function lenhAnhBlock(o) {
    const a = o.AnhSanPham ? `<img src="${escapeHtml(o.AnhSanPham)}" style="max-width:375px;max-height:375px;object-fit:cover;border-radius:4px;border:1px solid #ccc;">` : '';
    // v6.02: in HẾT các ảnh hình in (trước chỉ in 1 ảnh). Nhiều ảnh thì thu nhỏ lại để vẫn vừa 1 hàng.
    const dsIn = tachAnhHinhIn(o.AnhHinhIn);
    const coCV = dsIn.length > 1 ? Math.max(150, Math.round(375 / Math.min(dsIn.length, 3))) : 375;
    const b = dsIn.map(u => `<img src="${escapeHtml(u)}" style="max-width:${coCV}px;max-height:${coCV}px;object-fit:cover;border-radius:4px;border:1px solid #ccc;">`).join(' ');
    if (!a && !b) return '';
    return `<div style="display:flex;gap:16px;margin:10px 0;">${a ? `<div style="text-align:center;"><div style="font-size:12px;color:#555;margin-bottom:4px;">Ảnh sản phẩm</div>${a}</div>` : ''}${b ? `<div style="text-align:center;"><div style="font-size:12px;color:#555;margin-bottom:4px;">Ảnh hình in${dsIn.length > 1 ? ` (${dsIn.length} ảnh)` : ''}</div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">${b}</div></div>` : ''}</div>`;
  }
  function lenhSignBlock() {
    const n = new Date();
    return `<p class="p-meta" style="text-align:right;margin-top:18px;">Ngày ${n.getDate()} tháng ${n.getMonth() + 1} năm ${n.getFullYear()}</p>
      <div class="p-sign"><div><div class="line">Duyệt sản xuất</div></div><div><div class="line">Người lập phiếu</div></div></div>`;
  }
  // FORM 1 MÀU: đơn chỉ 1 màu chính — bố cục dọc như sheet "Form 1 màu".
  function buildForm1Mau(o, chiTietVai) {
    const c = chiTietVai[0] || {};
    const heSo = Number(o.HeSoQuyDoi) || 1;
    const dvt = c.DonViTinh || (chiTietVai.find(x => x.DonViTinh) || {}).DonViTinh || 'Cái';
    const sl = fmtQuyDoi(o.TongSoLuong, heSo, o.PhepTinhQuyDoi, dvt, o.TenDonViQuyDoi);
    const vaiChinh = joinLoaiMau(c.TenLoaiVaiTuDo || c.TenLoaiVai, c.TenMauTuDo || c.TenMau);
    const vaiPhoi = lenhFabricPhoi(c);
    return `
      <h2 style="text-align:center;margin:0 0 2px;">CHỈ ĐỊNH SẢN XUẤT</h2>
      <div style="text-align:right;font-weight:600;margin-bottom:6px;">Mã ĐH: ${escapeHtml(o.MaDH || '')}</div>
      <table style="margin-top:8px;"><tbody>
        <tr><td><b>Mã sản phẩm:</b> ${escapeHtml(o.MaSanPham || o.MaDH || '')}</td><td><b>Kỹ thuật rập:</b> ${escapeHtml(o.KyThuatRap || '')}</td></tr>
        <tr><td colspan="2"><b>Mã rập (sơ đồ):</b> ${escapeHtml(o.MaRap || '')}</td></tr>
        <tr><td><b>Tên sản phẩm:</b> ${escapeHtml(o.TenSanPham || '')}</td><td><b>Thiết kế:</b> ${escapeHtml(o.ThietKeVien || '')}</td></tr>
        <tr><td colspan="2"><b>Khách hàng:</b> ${escapeHtml(o.TenKhachHang || '')}</td></tr>
        <tr><td><b>Size:</b> ${escapeHtml(o.Size || '')}</td><td><b>Ngày Deadline:</b> ${fmtDate(o.NgayGiaoDuKien)}</td></tr>
        <tr><td><b>Vải chính:</b> ${vaiChinh || '—'}${c.GhiChu ? ` <i>(${escapeHtml(c.GhiChu)})</i>` : ''}</td><td><b>Vải phối:</b> ${vaiPhoi || '—'}</td></tr>
        <tr><td colspan="2"><b>Số lượng:</b> ${sl}</td></tr>
        <tr><td colspan="2"><b>Hình in:</b> ${escapeHtml(o.DongHinhIn || '')}</td></tr>
        <tr><td colspan="2"><b>Mác:</b> ${escapeHtml(o.Mac || '')}</td></tr>
        <tr><td colspan="2"><b>Phụ kiện:</b> ${escapeHtml(o.PhuLieu || '').replace(/\n/g, '<br>')}</td></tr>
        <tr><td colspan="2"><b>Ghi chú:</b> ${escapeHtml(o.GhiChuLenh || '')}</td></tr>
      </tbody></table>
      ${lenhAnhBlock(o)}
      ${lenhSignBlock()}`;
  }
  // FORM NHIỀU MÀU: nhiều màu chính — bảng vải + số lượng theo từng màu như sheet "Form nhiều màu".
  function buildFormNhieuMau(o, chiTietVai) {
    const heSo = Number(o.HeSoQuyDoi) || 1;
    const th = chiTietVai.map((c, i) => `<th>Màu ${i + 1}${c.AnhMau ? `<br><img src="${escapeHtml(c.AnhMau)}" style="max-width:100px;max-height:100px;object-fit:contain;border-radius:4px;">` : ''}</th>`).join('');
    const rChinh = chiTietVai.map(c => `<td>${joinLoaiMau(c.TenLoaiVaiTuDo || c.TenLoaiVai, c.TenMauTuDo || c.TenMau) || '—'}</td>`).join('');
    const rPhoi = chiTietVai.map(c => `<td>${lenhFabricPhoi(c) || '—'}</td>`).join('');
    const rSL = chiTietVai.map(c => `<td>${fmtQuyDoi(c.SoLuong, heSo, o.PhepTinhQuyDoi, c.DonViTinh || 'Cái', o.TenDonViQuyDoi)}</td>`).join('');
    const rGhiChu = chiTietVai.map(c => `<td>${c.GhiChu ? escapeHtml(c.GhiChu) : ''}</td>`).join('');   // v5.47: ghi chú theo từng màu chính
    const hasGhiChu = chiTietVai.some(c => c.GhiChu);
    return `
      <h2 style="text-align:center;margin:0 0 2px;">CHỈ ĐỊNH SẢN XUẤT</h2>
      <div style="text-align:right;font-weight:600;margin-bottom:6px;">Mã ĐH: ${escapeHtml(o.MaDH || '')}</div>
      <table style="margin-top:8px;"><tbody>
        <tr><td><b>Tên sản phẩm:</b> ${escapeHtml(o.TenSanPham || '')}</td><td><b>Mã SP:</b> ${escapeHtml(o.MaSanPham || o.MaDH || '')}</td><td><b>Size:</b> ${escapeHtml(o.Size || '')}</td></tr>
        <tr><td><b>Thiết kế:</b> ${escapeHtml(o.ThietKeVien || '')}</td><td><b>Kỹ thuật rập:</b> ${escapeHtml(o.KyThuatRap || '')}</td><td><b>Deadline ra hàng:</b> ${fmtDate(o.NgayGiaoDuKien)}</td></tr>
        <tr><td colspan="3"><b>Khách hàng:</b> ${escapeHtml(o.TenKhachHang || '')}</td></tr>
        <tr><td colspan="3"><b>Mã rập (sơ đồ):</b> ${escapeHtml(o.MaRap || '')}</td></tr>
      </tbody></table>
      ${lenhAnhBlock(o)}
      <table style="margin-top:8px;"><thead><tr><th style="width:120px;"></th>${th}</tr></thead><tbody>
        <tr><td><b>Vải chính</b></td>${rChinh}</tr>
        <tr><td><b>Vải phối</b></td>${rPhoi}</tr>
        <tr><td><b>Số lượng</b></td>${rSL}</tr>
        ${hasGhiChu ? `<tr><td><b>Ghi chú</b></td>${rGhiChu}</tr>` : ''}
      </tbody></table>
      <div style="font-size:13px;line-height:1.9;margin-top:8px;">
        <b>Hình in:</b> ${escapeHtml(o.DongHinhIn || '')}<br>
        <b>Mác:</b> ${escapeHtml(o.Mac || '')}<br>
        <b>Phụ kiện:</b> ${escapeHtml(o.PhuLieu || '').replace(/\n/g, '<br>')}<br>
        <b>LƯU Ý:</b> ${escapeHtml(o.GhiChuLenh || '')}
      </div>
      ${lenhSignBlock()}`;
  }

  // ---- Ghi nhan tien do: form thay doi theo TUNG cong doan (v4.0, mo rong v5.0/v5.2) ----
  // Ky thuat: Met so do / Kho vai so do / Ma rap + (v5.2) chon Cong doan may ap dung cho don nay kem
  // don gia/he so RIENG cua don hang (DonHangCongDoanMay) - dung tinh luong sau nay.
  // Giao vai (v5.2 - MOI, thay cho nut "Giao vai SX" rieng truoc day): chi hien cay con ton trong kho
  // DUNG loai vai/mau da khai bao o Ra lenh san xuat, ghi KG giao, ma cay hien dang the linh dong.
  // Phu kien (v5.2 - MOI, thay cho khoi "Phu kien can dung" o form Ra lenh): ghi nhan tung dong phu kien.
  // Cat (v5.0/v5.2): ghi theo TUNG CAY vai da duoc "Giao vai" (STT cay A/B/C, SL lop, he so quy doi ->
  // SL cai tu tinh, + v5.2: KG/met da dung tung cay, nhan vien trai vai chon TOI DA 2 nguoi bang checkbox).
  // May: SL luy ke theo mau CHINH (tham khao Don gia + Tong SL cat theo mau va tong so ban cat) +
  // (neu NhaGiaCong = "Nhà Làm") khoi Giao viec noi bo, dropdown Cong doan may CHI hien cong doan da
  // duoc gan cho don hang nay o Ky thuat (v5.2).
  // Kho nhap: SL thuc te nhap kho theo mau CHINH (kem doi chieu SL tong tu Cat, chon Don vi co ban/quy doi).
  // Cong doan khac (Hoan thien, Dong goi...): SL luy ke theo mau CHINH nhu May, co tham khao SL tu Cat.
  // v5.35: "Sổ cắt đã ghi nhận" (read-only) + nút "In sổ cắt" tại công đoạn Cắt — xem lại được kể cả sau khi
  // đã ghi tiến độ. Đọc lần Cắt gần nhất qua GET /orders/:maDH/socat. buildSoCatHtml dùng chung màn hình + in.
  /* v5.89 — SỔ CẮT dựng lại theo yêu cầu:
       - Tiêu đề "SỔ CẮT" CĂN GIỮA trang, số thứ tự sổ nằm RIÊNG 1 DÒNG bên phải phía dưới.
       - Đầu phiếu có thông tin ĐƠN HÀNG (mã lệnh SX, mã hàng, tên SP, khách, size, SL, ngày giao).
       - Dòng thông số: Mét sơ đồ / Khổ vải / Mã rập nay LẤY BÙ từ sơ đồ ở backend nên hiện đủ.
       - Có người trải vải (có thể 2 người) + nhân viên cắt.
       - Bảng thêm cột KG/mét đã dùng (+ Loại vải) và dòng tổng cộng cho cả 2 cột số. */
  function buildSoCatHtml(data) {
    const o = data.order || {};
    /* v5.90: đầu phiếu chuyển thành BẢNG 2 cột nhãn–giá trị cho dễ đọc (trước là 1 dòng dài ngăn bởi
       dấu ·), kèm ẢNH ĐƠN HÀNG bên phải. Ô nào không có dữ liệu thì bỏ hẳn dòng đó. */
    const oCap = (nhan, giaTri) => (giaTri == null || giaTri === ''
      ? '' : `<tr><td style="width:34%;background:#f5f6f8;"><b>${nhan}</b></td><td>${giaTri}</td></tr>`);
    function bangThongTin(r) {
      const hang = [
        oCap('Mã lệnh SX', escapeHtml(o.MaDH || data.maDH || '')),
        oCap('Mã hàng', escapeHtml(o.MaSanPham || '')),
        oCap('Tên sản phẩm', escapeHtml(o.TenSanPham || '')),
        oCap('Khách hàng', escapeHtml(o.TenKhachHang || '')),
        oCap('Size', escapeHtml(o.Size || '')),
        oCap('Tổng SL chỉ định', o.TongSoLuong != null ? fmtNumber(o.TongSoLuong) : ''),
        oCap('Ngày giao dự kiến', o.NgayGiaoDuKien ? fmtDate(o.NgayGiaoDuKien) : ''),
        oCap('Ngày cắt', fmtDate(r.NgayGhiNhan)),
        // v6.01: bỏ dòng "STT sơ đồ" ở đây — số sơ đồ đã nằm ở dòng "Sơ đồ: 1/2" ngay dưới tiêu đề.
        oCap('Mét sơ đồ', r.MetSoDoDai != null ? fmtNumber(r.MetSoDoDai) : ''),
        oCap('Khổ vải', r.KhoVaiSoDo != null ? fmtNumber(r.KhoVaiSoDo) : ''),
        oCap('Mã rập', escapeHtml(r.MaRap || o.MaRap || '')),
        oCap('Người trải vải', escapeHtml(r.NhanVienTraiVai || '')),
        oCap('Người cắt', escapeHtml(r.NhanVienCat || ''))
      ].filter(Boolean).join('');
      const anh = o.AnhSanPham
        ? `<td style="width:130px;vertical-align:top;padding-left:10px;"><img src="${escapeHtml(o.AnhSanPham)}" style="max-width:125px;max-height:160px;object-fit:contain;border:1px solid #ccc;"></td>`
        : '';
      return `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr>
          <td style="vertical-align:top;padding:0;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">${hang}</table>
          </td>${anh}
        </tr></table>`;
    }

    return (data.records || []).map((r, i) => {
      /* v6.01: cột GIẬT CẤP chỉ hiện khi sổ này THỰC SỰ có giật cấp — sổ không giật cấp thì bản in giữ
         nguyên như cũ (đúng yêu cầu "nếu cần, không thì không thể hiện ra"). SL cái của dòng = SoLuongCai
         (lớp × hệ số, cột tính sẵn trong DB) + giật cấp. */
      const coGiatCap = (r.cays || []).some(c => Number(c.SoCaiGiatCap) > 0);
      const caiCuaDong = (c) => Number(c.SoLuongCai || 0) + Number(c.SoCaiGiatCap || 0);
      // v5.87: cột Ảnh cây vải. v5.89: + Loại vải + KG/mét đã dùng.
      const rows = (r.cays || []).map(c => `<tr>
        <td>${escapeHtml(c.MaCay || '')}</td><td>${escapeHtml(c.TenLoaiVai || '')}</td><td>${escapeHtml(c.TenMau || '')}</td>
        <td style="text-align:center;">${escapeHtml(c.SttCay || '')}</td>
        <td style="text-align:right;">${fmtNumber(c.SoLuongLop)}</td>
        <td style="text-align:right;">${fmtNumber(c.HeSoQuyDoi)}</td>
        ${coGiatCap ? `<td style="text-align:right;">${Number(c.SoCaiGiatCap) > 0 ? fmtNumber(c.SoCaiGiatCap) : ''}</td>` : ''}
        <td style="text-align:right;">${fmtNumber(caiCuaDong(c))}</td>
        <td style="text-align:right;">${c.SoKgMetSuDung != null ? fmtNumber(c.SoKgMetSuDung) : ''}</td>
        <td style="text-align:center;">${c.AnhCay ? `<img src="${escapeHtml(c.AnhCay)}" style="max-width:70px;max-height:70px;object-fit:contain;">` : ''}</td></tr>`).join('');
      const tongCai = (r.cays || []).reduce((s, c) => s + caiCuaDong(c), 0);
      const tongGiatCap = (r.cays || []).reduce((s, c) => s + Number(c.SoCaiGiatCap || 0), 0);
      const tongKgMet = (r.cays || []).reduce((s, c) => s + Number(c.SoKgMetSuDung || 0), 0);
      const tongLop = (r.cays || []).reduce((s, c) => s + Number(c.SoLuongLop || 0), 0);   // v5.90
      /* v5.98: khi in/xem RIÊNG 1 sổ, vẫn phải biết đó là sổ thứ mấy trên tổng bao nhiêu sổ của đơn —
         nơi gọi truyền kèm __soHienThi/__tongSo (xem renderSoCatDaGhi). */
      const soSo = r.__soHienThi != null ? r.__soHienThi : (data.records.length > 1 ? (i + 1) : null);
      const tongSoSo = r.__tongSo != null ? r.__tongSo : data.records.length;
      // v6.01: ưu tiên SỐ THỨ TỰ SƠ ĐỒ thật của đơn; không có thì dùng số hiệu sổ cắt.
      const soDoHienThi = r.SoDoThuTu
        ? `${r.SoDoThuTu}${Number(r.TongSoSoDo) > 1 ? '/' + r.TongSoSoDo : ''}`
        : (soSo ? `${soSo}${tongSoSo > 1 ? '/' + tongSoSo : ''}` : '');
      return `${i > 0 ? '<div style="page-break-before:always;height:10px;"></div>' : ''}
        <h2 style="text-align:center;margin:8px 0 2px;text-transform:uppercase;">Sổ cắt</h2>
        ${/* v6.01: dòng này ghi "Sơ đồ: 1/2" (không còn "Sổ số") — lấy ĐÚNG số thứ tự sơ đồ của đơn
             (r.SoDoThuTu); sổ cắt cũ không gắn sơ đồ thì lùi về số hiệu sổ để không bỏ trống. Nhờ vậy
             bảng thông tin bên dưới KHÔNG cần dòng "STT sơ đồ" nữa (trước bị lặp 2 chỗ). */''}
        <div style="text-align:right;font-size:13px;margin-bottom:6px;">
          ${soDoHienThi ? `Sơ đồ: <b>${soDoHienThi}</b>${r.SttSoCat != null ? ' · ' : ''}` : ''}${r.SttSoCat != null ? `STT sổ cắt: <b>${escapeHtml(String(r.SttSoCat))}</b>` : ''}
        </div>
        ${bangThongTin(r)}
        <table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4">
          <thead><tr><th>Mã cây</th><th>Loại vải</th><th>Màu</th><th>STT</th><th>Số lớp</th><th>Hệ số</th>${coGiatCap ? '<th>Giật cấp (cái)</th>' : ''}<th>SL cái</th><th>KG/mét đã dùng</th><th style="width:80px;">Ảnh</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="${coGiatCap ? 10 : 9}" style="text-align:center;">(chưa có cây)</td></tr>`}
            ${/* v5.90: tổng cộng cho CẢ cột Số lớp (không chỉ SL cái / KG-mét). v6.01: + cột giật cấp. */''}
            <tr style="font-weight:bold;"><td colspan="4" style="text-align:right;">Tổng cộng</td><td style="text-align:right;">${fmtNumber(tongLop)}</td><td></td>${coGiatCap ? `<td style="text-align:right;">${fmtNumber(tongGiatCap)}</td>` : ''}<td style="text-align:right;">${fmtNumber(tongCai)}</td><td style="text-align:right;">${tongKgMet ? fmtNumber(tongKgMet) : ''}</td><td></td></tr></tbody>
        </table>`;
    }).join('');
  }
  /* v5.98 — SỔ CẮT ĐÃ GHI: lấy TẤT CẢ các lần cắt (?tatCa=1, trước chỉ lấy lần gần nhất nên cắt 3 hôm
     thì chỉ thấy hôm cuối) + Ô CHỌN xem/in ĐÚNG một sổ. Đồng thời cập nhật dòng "đã ghi bao nhiêu sơ đồ"
     cho khu vực nhập liệu bên dưới (#catDaGhiInfo). */
  async function renderSoCatDaGhi(box, maDH, perm) {
    /* v6.01: dòng "Tổng SL cái" của form Cắt phải gồm CẢ phần ĐÃ GHI ở các sổ cắt trước, không chỉ phần
       đang gõ — nên hàm này ghi số đã ghi vào box.__catDaGhiCai rồi gọi lại box.__recalcCatTong() (hook do
       form Cắt gắn vào). GỐC của "Tổng SL cái (tất cả sơ đồ): 0": đơn đã cắt xong vẫn hiện 0 vì trước đây
       ô này chỉ cộng những dòng đang gõ trong form. */
    const capNhatHook = () => { if (typeof box.__recalcCatTong === 'function') box.__recalcCatTong(); };
    const timInfoEl = (id) => box.querySelector('#' + id) || (box.parentElement && box.parentElement.querySelector('#' + id));
    let data;
    try { data = (await apiGet('/api/qlsx/orders/' + maDH + '/socat?tatCa=1')).data; } catch (e) { return; }
    if (!data || !data.records || !data.records.length) {
      box.__catDaGhiCai = 0;
      const el0 = timInfoEl('catDaGhiInfo');
      if (el0) el0.innerHTML = '<b>Đã ghi:</b> chưa có sổ cắt nào';
      capNhatHook();
      return;
    }
    const recs = data.records;
    const suaDuoc = !perm || perm.canEdit;

    // v6.01: tổng SL cái của 1 sổ = (lớp × hệ số) + giật cấp — dùng chung cho nhãn ô chọn, dòng tổng và hộp xác nhận xóa.
    const tongCaiCuaSo = (r) => (r.cays || []).reduce((s, c) => s + Number(c.SoLuongCai || 0) + Number(c.SoCaiGiatCap || 0), 0);

    // Số sơ đồ ĐÃ GHI (đếm theo sơ đồ khác nhau; sổ không gắn sơ đồ thì tính riêng theo từng sổ).
    const soDoDaGhi = new Set();
    recs.forEach(r => soDoDaGhi.add(r.SoDoID != null ? 'sd' + r.SoDoID : 'td' + r.TienDoID));
    const caiDaGhi = recs.reduce((s, r) => s + tongCaiCuaSo(r), 0);
    box.__catDaGhiCai = caiDaGhi;
    const infoEl = timInfoEl('catDaGhiInfo');
    if (infoEl) infoEl.innerHTML = `<b>Đã ghi:</b> ${fmtNumber(caiDaGhi)} cái · ${soDoDaGhi.size}${recs[0].TongSoSoDo ? '/' + recs[0].TongSoSoDo : ''} sơ đồ · ${recs.length} sổ cắt`;
    capNhatHook();
    const nhanSo = (r, i) => `Sổ ${i + 1}`
      + (r.SttSoCat != null ? ` · STT ${r.SttSoCat}` : '')
      + (Number(r.TongSoSoDo) > 1 && r.SoDoThuTu ? ` · sơ đồ ${r.SoDoThuTu}/${r.TongSoSoDo}` : '')
      + ` · ${fmtDate(r.NgayGhiNhan)} · ${(r.cays || []).length} cây`
      + ` · ${fmtNumber(tongCaiCuaSo(r))} cái`;
    const wrap = document.createElement('div');
    wrap.className = 'form-row';
    wrap.innerHTML = `<label>Sổ cắt đã ghi nhận (${recs.length} sổ) &nbsp;
        <button type="button" class="btn small secondary" id="btnInSoCat">🖨️ In sổ đang chọn</button>
        ${recs.length > 1 ? '<button type="button" class="btn small secondary" id="btnInTatCaSoCat">🖨️ In tất cả</button>' : ''}
        ${suaDuoc ? '<button type="button" class="btn small secondary" id="btnSuaSoCat">✏️ Sửa / thêm cây</button>' : ''}
        ${(perm && perm.canDelete) ? '<button type="button" class="btn small danger" id="btnXoaSoCat">🗑️ Xóa sổ này</button>' : ''}</label>
      ${recs.length > 1 ? `<select id="soCatPicker" style="margin-bottom:6px;">${recs.map((r, i) => `<option value="${r.TienDoID}">${escapeHtml(nhanSo(r, i))}</option>`).join('')}</select>` : ''}
      <div id="soCatXem" style="border:1px solid var(--border);border-radius:6px;padding:8px 10px;background:#fafafa;max-height:340px;overflow:auto;"></div>`;
    box.insertBefore(wrap, box.firstChild);

    const picker = wrap.querySelector('#soCatPicker');
    const chonHienTai = () => {
      const id = picker ? picker.value : String(recs[recs.length - 1].TienDoID);   // 1 sổ: lấy luôn sổ đó
      const i = Math.max(0, recs.findIndex(r => String(r.TienDoID) === String(id)));
      // Gắn số hiệu sổ để bản xem/in riêng vẫn ghi "Sổ số 2/3".
      return Object.assign({}, recs[i], { __soHienThi: i + 1, __tongSo: recs.length });
    };
    const veXem = () => {
      wrap.querySelector('#soCatXem').innerHTML = buildSoCatHtml({ order: data.order, maDH: data.maDH, records: [chonHienTai()] });
    };
    if (picker) {
      picker.value = String(recs[recs.length - 1].TienDoID);   // mặc định mở sổ MỚI NHẤT
      picker.addEventListener('change', veXem);
    }
    veXem();

    wrap.querySelector('#btnInSoCat').addEventListener('click', () =>
      printHtml('Sổ cắt - ' + maDH, buildSoCatHtml({ order: data.order, maDH: data.maDH, records: [chonHienTai()] })));
    const bTatCa = wrap.querySelector('#btnInTatCaSoCat');
    if (bTatCa) bTatCa.addEventListener('click', () => printHtml('Sổ cắt (tất cả) - ' + maDH, buildSoCatHtml(data)));
    const bSua = wrap.querySelector('#btnSuaSoCat');
    if (bSua) bSua.addEventListener('click', () => {
      const r = chonHienTai();
      if (r) openSuaSoCatModal(maDH, r, () => { wrap.remove(); renderSoCatDaGhi(box, maDH, perm); });
    });
    /* v5.99: XÓA SỔ CẮT — nói rõ hệ quả trước khi xóa vì SL cắt của sổ này đang được các công đoạn sau
       và bảng lương trải vải cắt đọc; xóa là mấy con số đó đổi theo. */
    const bXoa = wrap.querySelector('#btnXoaSoCat');
    if (bXoa) bXoa.addEventListener('click', async () => {
      const r = chonHienTai();
      if (!r) return;
      const tongCai = tongCaiCuaSo(r);   // v6.01: gồm cả giật cấp
      const nd = `XÓA sổ cắt số ${r.__soHienThi}/${r.__tongSo}`
        + (r.SttSoCat != null ? ` (STT sổ cắt ${r.SttSoCat})` : '')
        + ` ngày ${fmtDate(r.NgayGhiNhan)}?\n\n`
        + `Sổ này có ${(r.cays || []).length} cây vải, ${fmtNumber(tongCai)} SL cái.\n`
        + `Xóa xong: tổng SL cắt của đơn GIẢM đúng phần này -> ảnh hưởng đối chiếu Kho nhập, lương trải vải cắt và báo cáo năng suất.\n`
        + `Công đoạn hiện tại của đơn KHÔNG bị kéo lùi. Thao tác này KHÔNG hoàn lại được.`;
      if (!confirm(nd)) return;
      try {
        await apiDelete(`/api/qlsx/orders/${encodeURIComponent(maDH)}/socat/${r.TienDoID}`);
        toast('Đã xóa sổ cắt.', 'success');
        wrap.remove();
        renderSoCatDaGhi(box, maDH, perm);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     v6.15 — GIÁ THÀNH SẢN PHẨM CỦA 1 LỆNH SẢN XUẤT
     Chọn lệnh SX từ danh sách -> xem bảng bóc tách 5 nhóm chi phí (vải theo từng cây / phụ kiện / gia công
     ngoài + may nhà làm / in thêu / chi phí chung nhập tay) -> ra giá thành 1 sản phẩm. In được.
     Số liệu lấy từ dữ liệu ĐÃ CÓ, không nhập lại; chỗ nào thiếu đơn giá hay thiếu KG/mét đã dùng thì
     ĐÁNH DẤU ĐỎ chứ không âm thầm tính 0 — nhìn là biết phải đi khai thêm ở đâu.
     ================================================================================================ */
  async function renderGiaThanh(perm) {
    const body = document.getElementById('qBody');
    const orders = (await apiGet('/api/qlsx/giathanh')).data || [];
    body.innerHTML = `
      <h3 style="margin-top:0;">Giá thành sản phẩm</h3>
      <p class="empty-hint">Chọn 1 lệnh sản xuất để bóc tách chi phí: <b>vải đã cắt × đơn giá từng cây</b> · <b>phụ kiện × đơn giá</b>
        · <b>gia công ngoài / may nhà làm</b> · <b>in thêu</b> · <b>chi phí chung</b> (nhập tay).
        Giá thành 1 SP = tổng chi phí ÷ SL hoàn thành (ưu tiên SL nhập kho).</p>
      <table><thead><tr><th>Mã ĐH</th><th>Tên sản phẩm</th><th>Mã hàng</th><th>Tổng SL</th><th>Chi phí chung</th><th style="width:210px">Thao tác</th></tr></thead>
      <tbody>${orders.map(o => `<tr>
        <td><a href="#" class="act-gt-lenh" data-madh="${escapeHtml(o.MaDH)}" title="Xem/in Lệnh sản xuất">${escapeHtml(o.MaDH)}</a></td>
        <td>${escapeHtml(o.TenSanPham || '')}</td><td>${escapeHtml(o.MaSanPham || '')}</td>
        <td style="text-align:right;">${fmtNumber(o.TongSoLuong)}</td>
        <td>${Number(o.SoChiPhiChung) > 0 ? `<span class="badge green">${o.SoChiPhiChung} dòng</span>` : '<span class="badge">Chưa khai</span>'}</td>
        <td><button class="btn small secondary act-gt" data-madh="${escapeHtml(o.MaDH)}">💰 Tính giá thành</button></td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Chưa có lệnh sản xuất nào</td></tr>'}</tbody></table>`;
    body.querySelectorAll('.act-gt').forEach(b => b.addEventListener('click', () => openGiaThanhModal(b.dataset.madh, perm)));
    body.querySelectorAll('.act-gt-lenh').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); printLenhSanXuat(a.dataset.madh); }));
  }

  let __cpcIdx = 0;
  async function openGiaThanhModal(maDH, perm) {
    let d;
    try { d = (await apiGet('/api/qlsx/giathanh/' + encodeURIComponent(maDH))).data; }
    catch (err) { toast('Không tính được giá thành: ' + err.message, 'error'); return; }
    const suaDuoc = !perm || perm.canEdit;
    const dongCPC = (p) => {
      const i = ++__cpcIdx;
      p = p || {};
      return `<tr data-cpcrow data-idx="${i}">
        <td><input class="cpc-ten" value="${escapeHtml(p.TenChiPhi || '')}" placeholder="VD: Điện nước, vận chuyển, khấu hao..."></td>
        <td class="col-so"><input class="cpc-tien" type="number" min="0" step="0.01" value="${p.SoTien != null ? p.SoTien : ''}"></td>
        <td><input class="cpc-ghichu" value="${escapeHtml(p.GhiChu || '')}"></td>
        <td class="col-nut"><button type="button" class="btn small danger cpc-xoa" title="Xóa dòng">X</button></td></tr>`;
    };
    const modal = openModal(`
      <h3>Giá thành sản phẩm — ${escapeHtml(maDH)}</h3>
      <div id="gtXem">${buildGiaThanhBody(d)}</div>
      ${suaDuoc ? `<h4 style="margin:14px 0 4px;">Chi phí chung (nhập tự do)</h4>
      <div class="lap-wrap"><table class="lap-table">
        <colgroup><col style="width:38%"><col style="width:20%"><col><col style="width:42px"></colgroup>
        <thead><tr><th>Tên chi phí</th><th>Số tiền</th><th>Ghi chú</th><th></th></tr></thead>
        <tbody id="cpcRows">${(d.chiPhiChung || []).length ? d.chiPhiChung.map(dongCPC).join('') : dongCPC(null)}</tbody></table></div>
      <div class="toolbar" style="margin-top:6px;">
        <button type="button" class="btn small secondary" id="cpcThem">+ Thêm dòng chi phí</button>
        <button type="button" class="btn small" id="cpcLuu">💾 Lưu chi phí chung &amp; tính lại</button>
        <span class="empty-hint" style="padding:0;">Tổng chi phí chung: <b id="cpcTong">0</b></span>
      </div>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="gtIn">🖨️ In bảng giá thành</button>
        <button type="button" class="btn" id="gtDong">Đóng</button>
      </div>`);
    const tinhTongCPC = () => {
      let t = 0;
      modal.querySelectorAll('[data-cpcrow]').forEach(r => { t += Number(r.querySelector('.cpc-tien').value) || 0; });
      const el = modal.querySelector('#cpcTong');
      if (el) el.textContent = fmtNumber(t);
    };
    const wireCPC = (r) => {
      if (!r) return;
      r.querySelector('.cpc-tien').addEventListener('input', tinhTongCPC);
      r.querySelector('.cpc-xoa').addEventListener('click', () => {
        if (modal.querySelectorAll('[data-cpcrow]').length > 1) r.remove();
        else r.querySelectorAll('input').forEach(i => { i.value = ''; });
        tinhTongCPC();
      });
    };
    modal.querySelectorAll('[data-cpcrow]').forEach(wireCPC);
    tinhTongCPC();
    modal.querySelector('#gtDong').addEventListener('click', closeModal);
    modal.querySelector('#gtIn').addEventListener('click', () => printHtml('Gia thanh - ' + maDH, buildGiaThanhBody(d, true)));
    const bThem = modal.querySelector('#cpcThem');
    if (bThem) bThem.addEventListener('click', () => {
      modal.querySelector('#cpcRows').insertAdjacentHTML('beforeend', dongCPC(null));
      wireCPC(modal.querySelector('#cpcRows [data-cpcrow]:last-child'));
    });
    const bLuu = modal.querySelector('#cpcLuu');
    if (bLuu) bLuu.addEventListener('click', async () => {
      const items = Array.from(modal.querySelectorAll('[data-cpcrow]')).map(r => ({
        tenChiPhi: r.querySelector('.cpc-ten').value || '',
        soTien: r.querySelector('.cpc-tien').value || 0,
        ghiChu: r.querySelector('.cpc-ghichu').value || null
      })).filter(x => String(x.tenChiPhi).trim() || Number(x.soTien) > 0);
      try {
        await apiPut(`/api/qlsx/giathanh/${encodeURIComponent(maDH)}/chiphichung`, { items });
        toast('Đã lưu chi phí chung.', 'success');
        closeModal();
        openGiaThanhModal(maDH, perm);   // mở lại để thấy giá thành tính lại ngay
      } catch (err) { toast(err.message, 'error'); }
    });
  }
  // Bảng bóc tách giá thành — dùng CHUNG cho màn hình và bản in (choIn = thêm đầu phiếu).
  function buildGiaThanhBody(d, choIn) {
    const o = d.order || {};
    const t = d.tong || {};
    const tien = (n) => fmtNumber(Math.round((Number(n) || 0) * 100) / 100);
    const canhBao = (dieuKien, chu) => dieuKien ? ` <span style="color:#c0392b;">⚠️ ${chu}</span>` : '';
    const bang = (tieuDe, cot, dong, tongTien) => `<h4 style="margin:12px 0 4px;">${tieuDe} — <b>${tien(tongTien)}</b></h4>
      <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">
        <thead><tr>${cot.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${dong || `<tr><td colspan="${cot.length}" style="text-align:center;color:#5f6368;">(không có)</td></tr>`}</tbody></table>`;

    const dongVai = (d.vai || []).map(r => `<tr>
      <td>${escapeHtml(r.MaCay)}${canhBao(r.ThieuSoLuong, 'chưa khai KG/mét đã dùng')}</td>
      <td>${escapeHtml(r.TenLoaiVai)} ${escapeHtml(r.TenMau)}</td>
      <td style="text-align:right;">${fmtNumber(r.SoLuong)}</td>
      <td style="text-align:right;">${tien(r.DonGia)}${canhBao(r.ThieuDonGia, 'chưa có đơn giá nhập')}</td>
      <td style="text-align:right;">${tien(r.ThanhTien)}</td></tr>`).join('');
    const dongPK = (d.phuKien || []).map(r => `<tr>
      <td>${escapeHtml(r.MaPhuKien)}</td><td>${escapeHtml(r.TenPhuKien)}</td>
      <td style="text-align:right;">${fmtNumber(r.SoLuong)} ${escapeHtml(r.DonVi)}</td>
      <td style="text-align:right;">${tien(r.DonGia)}${canhBao(r.ThieuDonGia, 'chưa có đơn giá ở phiếu nhập')}</td>
      <td style="text-align:right;">${tien(r.ThanhTien)}</td></tr>`).join('');
    const dongGC = (d.giaCong || []).map(r => `<tr><td>${escapeHtml(r.TenNha)}</td><td>${escapeHtml(r.TenHangMuc)}</td>
      <td style="text-align:right;">${fmtNumber(r.SoLuong)}</td><td style="text-align:right;">${tien(r.DonGia)}</td>
      <td style="text-align:right;">${tien(r.ThanhTien)}</td></tr>`).join('');
    const dongMay = (d.mayNhaLam || []).map(r => `<tr><td>${escapeHtml(r.TenCongDoan)}</td><td>${escapeHtml(r.HoTen)}</td>
      <td style="text-align:right;">${fmtNumber(r.SoLuong)}</td><td style="text-align:right;">${tien(r.DonGia)}</td>
      <td style="text-align:right;">${tien(r.ThanhTien)}</td></tr>`).join('');
    const dongIn = (d.inThe || []).map(r => `<tr><td>${escapeHtml(r.TenNha)}</td><td>${escapeHtml(r.HangMucInThe) || '<span style="color:#5f6368;">(tổng tất cả hạng mục)</span>'}</td>
      <td style="text-align:right;">${fmtNumber(r.SoLuong)}</td><td style="text-align:right;">${tien(r.DonGia)}</td>
      <td style="text-align:right;">${tien(r.ThanhTien)}</td></tr>`).join('');
    const dongCat = (d.boPhanCat || []).map(r => `<tr>
      <td>Sổ ${r.SoSo}${r.SttSoCat != null ? ' · STT ' + escapeHtml(String(r.SttSoCat)) : ''}${canhBao(r.ThieuSoDo, 'chưa khai mét/khổ sơ đồ')}</td>
      <td>${fmtDate(r.NgayGhiNhan)}</td>
      <td style="text-align:right;">${r.MetSoDo != null ? fmtNumber(r.MetSoDo) : ''}</td>
      <td style="text-align:right;">${r.KhoVai != null ? fmtNumber(r.KhoVai) : ''}</td>
      <td style="text-align:right;">${fmtNumber(r.TongLop)}</td>
      <td style="text-align:right;">${tien(r.DonGia)}</td>
      <td style="text-align:right;">${tien(r.ThanhTien)}</td></tr>`).join('');
    const dongCPC = (d.chiPhiChung || []).map(r => `<tr><td>${escapeHtml(r.TenChiPhi)}</td><td>${escapeHtml(r.GhiChu)}</td>
      <td style="text-align:right;">${tien(r.SoTien)}</td></tr>`).join('');

    const dauPhieu = choIn ? `
      <h2 style="text-align:center;margin:8px 0 2px;text-transform:uppercase;">Bảng tính giá thành sản phẩm</h2>
      <div style="text-align:right;font-size:13px;margin-bottom:6px;">Mã ĐH: <b>${escapeHtml(o.MaDH || '')}</b></div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr>
        <td style="vertical-align:top;padding:0;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">
            <tr><td style="width:34%;background:#f5f6f8;"><b>Tên sản phẩm</b></td><td>${escapeHtml(o.TenSanPham || '')}</td></tr>
            ${o.MaSanPham ? `<tr><td style="background:#f5f6f8;"><b>Mã hàng</b></td><td>${escapeHtml(o.MaSanPham)}</td></tr>` : ''}
            ${o.Size ? `<tr><td style="background:#f5f6f8;"><b>Size</b></td><td>${escapeHtml(o.Size)}</td></tr>` : ''}
            <tr><td style="background:#f5f6f8;"><b>Mã rập</b></td><td>${escapeHtml(o.MaRap || '')}</td></tr>
            <tr><td style="background:#f5f6f8;"><b>Tổng SL chỉ định</b></td><td>${o.TongSoLuong != null ? fmtQuyDoi(o.TongSoLuong, o.HeSoQuyDoi, o.PhepTinhQuyDoi, o.DonViTinhLenh || 'Cái', o.TenDonViQuyDoi) : ''}</td></tr>
            <tr><td style="background:#f5f6f8;"><b>SL dùng để tính</b></td><td><b>${fmtNumber(d.slDungTinh)} ${escapeHtml(d.donViSLDungTinh || o.DonViTinhLenh || 'Cái')}</b> (${escapeHtml(d.nguonSL || '')})</td></tr>
          </table>
        </td>${o.AnhSanPham ? `<td style="width:130px;vertical-align:top;padding-left:10px;text-align:center;">
          <img src="${escapeHtml(o.AnhSanPham)}" style="max-width:125px;max-height:150px;object-fit:contain;border:1px solid #ccc;"></td>` : ''}
      </tr></table>` : `
      <div class="empty-hint" style="padding:0 0 6px;">
        ${escapeHtml(o.TenSanPham || '')}${o.MaSanPham ? ' · Mã hàng ' + escapeHtml(o.MaSanPham) : ''}${o.MaRap ? ' · Mã rập ' + escapeHtml(o.MaRap) : ''}<br>
        SL dùng để tính: <b>${fmtNumber(d.slDungTinh)} ${escapeHtml(d.donViSLDungTinh || o.DonViTinhLenh || 'Cái')}</b> (${escapeHtml(d.nguonSL || '')})
        ${Number(d.slNhapKho) > 0 ? '' : ' — <span style="color:#b06000;">chưa nhập kho nên đang lấy SL cắt</span>'}
      </div>`;

    return `${dauPhieu}
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:6px;" border="1" cellpadding="6">
        <tr><td style="width:60%;background:#f5f6f8;"><b>1. Vải (đã cắt × đơn giá từng cây)</b></td><td style="text-align:right;">${tien(t.vai)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>2. Phụ kiện</b></td><td style="text-align:right;">${tien(t.phuKien)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>3. Gia công ngoài</b></td><td style="text-align:right;">${tien(t.giaCong)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>4. May nhà làm (lương khoán may)</b></td><td style="text-align:right;">${tien(t.mayNhaLam)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>5. In thêu</b></td><td style="text-align:right;">${tien(t.inThe)}</td></tr>
        ${/* v6.17: + tiền bàn cắt (bộ phận cắt) — cùng công thức bảng lương trải vải cắt. */''}
        <tr><td style="background:#f5f6f8;"><b>6. Bộ phận cắt (tiền bàn cắt)</b></td><td style="text-align:right;">${tien(t.boPhanCat)}</td></tr>
        <tr><td style="background:#f5f6f8;"><b>7. Chi phí chung</b></td><td style="text-align:right;">${tien(t.chiPhiChung)}</td></tr>
        <tr style="font-weight:700;background:#e8f5e9;"><td>TỔNG CHI PHÍ</td><td style="text-align:right;">${tien(t.tongCong)}</td></tr>
        <tr style="font-weight:700;background:#fff8e1;"><td>GIÁ THÀNH 1 SẢN PHẨM${d.slDungTinh > 0 ? ` (÷ ${fmtNumber(d.slDungTinh)})` : ''}</td>
          <td style="text-align:right;">${d.giaThanh1SP != null ? tien(d.giaThanh1SP) : '<span style="color:#c0392b;">chưa có SL hoàn thành</span>'}</td></tr>
      </table>
      ${bang('1. Vải theo từng cây đã cắt', ['Mã cây', 'Loại vải / màu', 'KG-mét dùng', 'Đơn giá', 'Thành tiền'], dongVai, t.vai)}
      ${bang('2. Phụ kiện đã xuất cho lệnh', ['Mã PK', 'Tên phụ kiện', 'Số lượng', 'Đơn giá', 'Thành tiền'], dongPK, t.phuKien)}
      ${bang('3. Gia công ngoài', ['Nhà gia công', 'Hạng mục', 'SL nhận', 'Đơn giá', 'Thành tiền'], dongGC, t.giaCong)}
      ${bang('4. May nhà làm', ['Công đoạn', 'Nhân viên', 'SL giao', 'Đơn giá/cái', 'Thành tiền'], dongMay, t.mayNhaLam)}
      ${bang('5. In thêu', ['Nhà in thêu', 'Hạng mục', 'SL nhận', 'Đơn giá', 'Thành tiền'], dongIn, t.inThe)}
      ${bang(`6. Bộ phận cắt — tiền bàn cắt (mét sơ đồ × khổ vải × số lớp × ${fmtNumber(d.donGiaCat || 0)})`,
    ['Sổ cắt', 'Ngày cắt', 'Mét sơ đồ', 'Khổ vải', 'Tổng lớp', 'Đơn giá', 'Thành tiền'], dongCat, t.boPhanCat)}
      ${bang('7. Chi phí chung', ['Tên chi phí', 'Ghi chú', 'Số tiền'], dongCPC, t.chiPhiChung)}
      <p style="font-size:11px;color:#666;margin-top:8px;">Vải: KG/mét đã dùng khai ở sổ cắt × đơn giá nhập của chính cây đó (cây chưa khai thì tạm lấy KG đã xuất cho lệnh — có dấu ⚠️).
        Phụ kiện: SL đã xuất cho lệnh × đơn giá của lần nhập gần nhất (phiếu xuất không có cột đơn giá).
        May nhà làm dùng đúng công thức bảng lương khoán may; in thêu theo đơn giá hạng mục đã chọn ở Giao in thêu.</p>`;
  }

  /* ================================================================================================
     v6.12 — GHI NHẬN MAY ĐÃ GỬI: XEM / SỬA / XÓA (làm giống khối "Sổ cắt đã ghi nhận" ở công đoạn Cắt)
     Trước đây bấm "Gửi" ở May là xong, gõ nhầm SL thì phải ghi thêm 1 lần "bù" -> lịch sử rối, luỹ kế sai.
     ================================================================================================ */
  async function renderMayDaGhi(box, maDH, perm) {
    let data;
    try { data = (await apiGet('/api/qlsx/orders/' + encodeURIComponent(maDH) + '/ghinhanmay')).data; } catch (e) { return; }
    const recs = (data && data.records) || [];
    if (!recs.length) return;
    const suaDuoc = !perm || perm.canEdit;
    const tongCua = (r) => (r.mau || []).reduce((s, m) => s + (Number(m.SoLuongLuyKe) || 0), 0);
    /* v6.21.2: lần tạo bởi nút "💾 Lưu giao việc (chưa Gửi)" KHÔNG có dòng SL theo màu (chỉ "Gửi" mới
       ghi TienDoChiTietMau) ⇒ nhãn cũ luôn hiện "0 cái". Nay:
         - có SL theo màu  -> "<tổng> cái"
         - chưa có, nhưng đã giao việc -> "đã giao <tổng SL giao việc> cái (chưa Gửi)"
       để không bao giờ có lần nào hiện ra mà KHÔNG có số lượng. */
    const slGiaoViec = (r) => Number(r.TongSLGiaoViec) || 0;
    const nhan = (r, i) => {
      const tong = tongCua(r);
      const phanSL = tong > 0
        ? `${fmtNumber(tong)} cái`
        : (slGiaoViec(r) > 0 ? `đã giao ${fmtNumber(slGiaoViec(r))} cái (chưa Gửi)` : '0 cái');
      return `Lần ${i + 1} · ${fmtDate(r.NgayGhiNhan)} · ${phanSL}`
        + ((r.mau || []).length ? ` · ${r.mau.length} màu` : '')
        + (Number(r.SoDongGiaoViec) ? ` · ${r.SoDongGiaoViec} dòng giao việc` : '');
    };

    const wrap = document.createElement('div');
    wrap.className = 'form-row';
    wrap.innerHTML = `<label>Ghi nhận May đã gửi (${recs.length} lần) &nbsp;
        ${suaDuoc ? '<button type="button" class="btn small secondary" id="btnSuaMay">✏️ Sửa lần đang chọn</button>' : ''}
        ${(perm && perm.canDelete) ? '<button type="button" class="btn small danger" id="btnXoaMay">🗑️ Xóa lần này</button>' : ''}</label>
      ${recs.length > 1 ? `<select id="mayPicker" style="margin-bottom:6px;">${recs.map((r, i) => `<option value="${r.TienDoID}">${escapeHtml(nhan(r, i))}</option>`).join('')}</select>` : ''}
      <div id="mayXem" style="border:1px solid var(--border);border-radius:6px;padding:8px 10px;background:#fafafa;max-height:260px;overflow:auto;"></div>`;
    box.insertBefore(wrap, box.firstChild);

    const picker = wrap.querySelector('#mayPicker');
    const chonHienTai = () => {
      const id = picker ? picker.value : String(recs[recs.length - 1].TienDoID);
      const i = Math.max(0, recs.findIndex(r => String(r.TienDoID) === String(id)));
      return Object.assign({}, recs[i], { __lan: i + 1 });
    };
    const veXem = () => {
      const r = chonHienTai();
      wrap.querySelector('#mayXem').innerHTML = `
        <div style="font-size:13px;margin-bottom:4px;">Lần ${r.__lan} · Ngày ${fmtDate(r.NgayGhiNhan)}${r.NguoiCapNhat ? ' · ' + escapeHtml(r.NguoiCapNhat) : ''}${r.GhiChu ? ' · ' + escapeHtml(r.GhiChu) : ''}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">
          <thead><tr><th style="width:38px;">STT</th><th>Màu</th><th style="width:140px;">SL lũy kế (cái)</th></tr></thead>
          <tbody>${(r.mau || []).map((m, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(m.TenMau || '')}</td><td style="text-align:right;">${fmtNumber(m.SoLuongLuyKe)}</td></tr>`).join('')
            || `<tr><td colspan="2" style="text-align:center;">(chưa Gửi — lần này chỉ có giao việc, chưa ghi SL theo màu)</td></tr>`}
            <tr style="font-weight:bold;"><td style="text-align:right;">Tổng</td><td style="text-align:right;">${fmtNumber(tongCua(r))}</td></tr></tbody>
        </table>
        ${/* v6.21.2: hiện LUÔN chi tiết giao việc + SL của lần này (trước chỉ ghi "có N dòng" rồi bắt
             người dùng mò xuống bảng lịch sử, nên lần chỉ-giao-việc trông như không có số lượng). */''}
        ${(r.giaoViec || []).length ? `
          <div style="font-size:13px;margin:8px 0 4px;"><b>Giao việc của lần này</b> — tổng <b>${fmtNumber(slGiaoViec(r))}</b> cái / ${r.giaoViec.length} dòng</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">
            <thead><tr><th style="width:38px;">STT</th><th>Nhân viên</th><th>Công đoạn may</th><th>Màu</th><th style="width:90px;">SL</th></tr></thead>
            <tbody>${r.giaoViec.map((g, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(g.TenNhanVien || '')}</td><td>${escapeHtml(g.TenCongDoan || '')}</td><td>${escapeHtml(g.TenMau || '-')}</td><td style="text-align:right;">${fmtNumber(g.SoLuong)}</td></tr>`).join('')}</tbody>
          </table>
          <div class="empty-hint" style="padding:4px 0 0;">Sửa/xóa từng dòng ở ô "Nhân viên &amp; SL" của công đoạn tương ứng, hoặc ở bảng "Lịch sử giao việc nội bộ" bên dưới.</div>`
        : (Number(r.SoDongGiaoViec) ? `<div class="empty-hint" style="padding:4px 0 0;">Lần này có ${r.SoDongGiaoViec} dòng giao việc nội bộ.</div>` : '')}`;
    };
    if (picker) { picker.value = String(recs[recs.length - 1].TienDoID); picker.addEventListener('change', veXem); }
    veXem();

    const bSua = wrap.querySelector('#btnSuaMay');
    if (bSua) bSua.addEventListener('click', () => {
      const r = chonHienTai();
      openSuaGhiNhanMayModal(maDH, r, () => { wrap.remove(); renderMayDaGhi(box, maDH, perm); });
    });
    const bXoa = wrap.querySelector('#btnXoaMay');
    if (bXoa) bXoa.addEventListener('click', async () => {
      const r = chonHienTai();
      const nd = `XÓA ghi nhận May lần ${r.__lan} ngày ${fmtDate(r.NgayGhiNhan)}?\n\n`
        + `Lần này có ${fmtNumber(tongCua(r))} cái (${(r.mau || []).length} màu)`
        + (Number(r.SoDongGiaoViec) ? ` và ${r.SoDongGiaoViec} dòng GIAO VIỆC NỘI BỘ (${fmtNumber(slGiaoViec(r))} cái) — xóa là mất luôn phần giao việc đó, LƯƠNG KHOÁN MAY của các nhân viên trong lần này sẽ giảm theo.\n` : '.\n')
        + `Công đoạn hiện tại của đơn KHÔNG bị kéo lùi. Thao tác này KHÔNG hoàn lại được.`;
      if (!confirm(nd)) return;
      try {
        await apiDelete(`/api/qlsx/orders/${encodeURIComponent(maDH)}/ghinhanmay/${r.TienDoID}`);
        toast('Đã xóa ghi nhận May.', 'success');
        wrap.remove();
        renderMayDaGhi(box, maDH, perm);
      } catch (err) { toast(err.message, 'error'); }
    });
  }
  // Sửa 1 lần ghi nhận May: SL lũy kế theo từng màu + ngày + ghi chú.
  function openSuaGhiNhanMayModal(maDH, rec, onDone) {
    const rows = (rec.mau || []);
    const modal = openModal(`
      <h3>Sửa ghi nhận May — ${escapeHtml(maDH)} · lần ${rec.__lan}</h3>
      <p class="empty-hint">Sửa SL lũy kế theo màu của ĐÚNG lần ghi nhận này (không tạo lần mới).
        Phần giao việc nội bộ của lần này không đổi — sửa ở bảng "Lịch sử giao việc nội bộ".</p>
      <div class="form-grid">
        <div class="form-row"><label>Ngày ghi nhận</label><input type="date" id="smNgay" value="${rec.NgayGhiNhan ? new Date(rec.NgayGhiNhan).toISOString().slice(0, 10) : ''}"></div>
        <div class="form-row"><label>Ghi chú</label><input id="smGhiChu" value="${escapeHtml(rec.GhiChu || '')}"></div>
      </div>
      <div class="lap-wrap"><table class="lap-table">
        <colgroup><col><col style="width:170px"></colgroup>
        <thead><tr><th style="width:38px;">STT</th><th>Màu</th><th>SL lũy kế (cái)</th></tr></thead>
        <tbody>${rows.map((m, __i) => `<tr data-smrow data-mau="${m.MauSacID}"><td style="text-align:center;">${__i + 1}</td>
          <td>${escapeHtml(m.TenMau || '')}</td>
          <td class="col-so"><input class="sm-sl" type="number" min="0" value="${m.SoLuongLuyKe != null ? m.SoLuongLuyKe : ''}"></td></tr>`).join('')
          || '<tr><td colspan="2" class="empty-hint">Lần ghi nhận này không có dòng màu nào.</td></tr>'}</tbody></table></div>
      <div class="toolbar" style="margin-top:6px;"><span class="empty-hint" style="padding:0;">Tổng: <b id="smTong">0</b> cái</span></div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="smHuy">Hủy</button>
        <button type="button" class="btn" id="smLuu">💾 Lưu</button>
      </div>`);
    const tinhLai = () => {
      let t = 0;
      modal.querySelectorAll('[data-smrow]').forEach(r => { t += Number(r.querySelector('.sm-sl').value) || 0; });
      modal.querySelector('#smTong').textContent = fmtNumber(t);
    };
    modal.querySelectorAll('.sm-sl').forEach(i => i.addEventListener('input', tinhLai));
    tinhLai();
    modal.querySelector('#smHuy').addEventListener('click', closeModal);
    modal.querySelector('#smLuu').addEventListener('click', async () => {
      const chiTietMau = Array.from(modal.querySelectorAll('[data-smrow]')).map(r => ({
        mauSacId: Number(r.dataset.mau), soLuong: Number(r.querySelector('.sm-sl').value) || 0
      }));
      try {
        await apiPut(`/api/qlsx/orders/${encodeURIComponent(maDH)}/ghinhanmay/${rec.TienDoID}`, {
          chiTietMau, ngayGhiNhan: modal.querySelector('#smNgay').value || null, ghiChu: modal.querySelector('#smGhiChu').value || null
        });
        closeModal();
        toast('Đã lưu ghi nhận May.', 'success');
        if (onDone) onDone();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     v6.04 — ĐỊNH MỨC & HAO HỤT (chuyển từ phân hệ Kho vải sang Quản lý sản xuất)
     Vào tab -> DANH SÁCH LỆNH SX (chọn từ list, không gõ tên mẫu hàng nữa) -> mở 1 lệnh để khai định mức
     theo TỪNG LOẠI VẢI (kèm ĐVT Kg/Mét) và xem ngay báo cáo hao hụt của chính lệnh đó.
     SL hoàn thành = SL NHẬP KHO thực tế (tiến độ công đoạn Kho nhập), không phải TổngSL × % hoàn thành.
     ================================================================================================ */
  async function renderDinhMucHaoHut(perm) {
    const body = document.getElementById('qBody');
    const orders = (await apiGet('/api/qlsx/dinhmuc')).data || [];
    body.innerHTML = `
      <h3 style="margin-top:0;">Định mức & Hao hụt</h3>
      <p class="empty-hint">Chọn 1 lệnh sản xuất để khai <b>định mức theo từng loại vải</b> (Kg hoặc Mét) và xem hao hụt.
        <b>SL hoàn thành</b> lấy từ <b>số lượng nhập kho</b> thực tế của lệnh đó.</p>
      ${/* v6.05: bấm Mã ĐH = xem/in LỆNH SẢN XUẤT (giống Chỉ định vải SX); cột "Mã hàng" đổi thành MÃ RẬP
           (khai ở công đoạn Kỹ thuật); số lượng hiện kèm ĐƠN VỊ TÍNH; có nút In báo cáo ngay ở cột thao tác. */''}
      <table><thead><tr><th>Mã ĐH</th><th>Tên sản phẩm</th><th>Mã rập</th><th>Tổng SL</th><th>SL nhập kho</th><th>Định mức</th><th style="width:260px">Thao tác</th></tr></thead>
      <tbody>${orders.map(o => `<tr>
        <td><a href="#" class="act-dm-lenh" data-madh="${escapeHtml(o.MaDH)}" title="Xem/in Lệnh sản xuất">${escapeHtml(o.MaDH)}</a></td>
        <td>${escapeHtml(o.TenSanPham || '')}</td><td>${escapeHtml(o.MaRap || '')}</td>
        ${/* v6.06: ĐVT lấy theo ĐÚNG đơn vị đã khai ở Ra lệnh sản xuất (o.DonViTinhLenh), không mặc định "Cái". */''}
        <td style="text-align:right;">${o.TongSoLuong != null ? fmtQuyDoi(o.TongSoLuong, o.HeSoQuyDoi, o.PhepTinhQuyDoi, o.DonViTinhLenh || 'Cái', o.TenDonViQuyDoi) : ''}</td>
        <td style="text-align:right;">${Number(o.SLNhapKho) > 0 ? fmtNumber(o.SLNhapKho) + ' ' + escapeHtml(o.DonViTinhLenh || 'Cái') : '<span class="empty-hint">Chưa nhập kho</span>'}</td>
        <td>${Number(o.SoDongDinhMuc) > 0 ? `<span class="badge green">Đã khai ${o.SoDongDinhMuc} loại vải</span>` : '<span class="badge">Chưa khai</span>'}</td>
        <td><button class="btn small secondary act-dm" data-madh="${escapeHtml(o.MaDH)}">📐 Định mức / hao hụt</button>
          <button class="btn small secondary act-dm-in" data-madh="${escapeHtml(o.MaDH)}" title="In báo cáo định mức &amp; hao hụt">🖨️ In báo cáo</button></td>
      </tr>`).join('') || '<tr><td colspan="7" class="empty-hint">Chưa có lệnh sản xuất nào</td></tr>'}</tbody></table>`;
    body.querySelectorAll('.act-dm').forEach(b => b.addEventListener('click', () => openDinhMucModal(b.dataset.madh, perm)));
    body.querySelectorAll('.act-dm-lenh').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); printLenhSanXuat(a.dataset.madh); }));
    body.querySelectorAll('.act-dm-in').forEach(b => b.addEventListener('click', () => inBaoCaoDinhMuc(b.dataset.madh)));
  }
  // v6.05: in báo cáo định mức/hao hụt KHÔNG cần mở màn nhập liệu (nút ngay ở cột thao tác).
  async function inBaoCaoDinhMuc(maDH) {
    try {
      const d = (await apiGet('/api/qlsx/dinhmuc/' + encodeURIComponent(maDH))).data;
      printHtml('Định mức & hao hụt - ' + maDH, buildHaoHutBody(d, true));
    } catch (err) { toast('Không in được báo cáo: ' + err.message, 'error'); }
  }

  let __dmIdx = 0;
  async function openDinhMucModal(maDH, perm) {
    let d;
    try { d = (await apiGet('/api/qlsx/dinhmuc/' + encodeURIComponent(maDH))).data; }
    catch (err) { toast('Không tải được định mức: ' + err.message, 'error'); return; }
    const suaDuoc = !perm || perm.canEdit;
    const o = d.order || {};
    /* v6.31: lấy từ Danh mục → Đơn vị tính NHƯNG CHỈ 2 đơn vị Kg/Mét — backend tính hao hụt
       (routes/qlsx.js) chỉ phân biệt được 2 đơn vị này, chọn "Yard"/"Cuộn" sẽ bị lưu thành 'Kg'.
       Lọc ở đây để người dùng không chọn được thứ hệ thống không hiểu. */
    const dvtOptions = (chon) => optDonVi(
      (dm.donViTinh || []).filter(x => ['kg', 'mét', 'met'].includes(String(x.TenDonVi || '').trim().toLowerCase())),
      chon || 'Kg');
    const dongHtml = (p) => {
      const idx = ++__dmIdx;
      p = p || {};
      return `<tr data-dmrow data-idx="${idx}">
        <td>${searchableSelectHtml('dmlv_' + idx, dm.loaiVai, 'LoaiVaiID', x => x.TenLoaiVai, p.LoaiVaiID || '')}</td>
        <td class="col-so"><input class="dm-muc" type="number" min="0" step="0.0001" value="${p.DinhMuc != null ? p.DinhMuc : ''}"></td>
        <td class="col-so"><select class="dm-dvt">${dvtOptions(p.DonViTinh)}</select></td>
        <td class="col-so"><input class="dm-hh" type="number" min="0" step="0.01" value="${p.TyLeHaoHut != null ? p.TyLeHaoHut : ''}"></td>
        <td><input class="dm-ghichu" value="${escapeHtml(p.GhiChu || '')}"></td>
        <td class="col-nut"><button type="button" class="btn small danger dm-xoa" title="Xóa dòng">X</button></td></tr>`;
    };
    const daKhai = (d.rows || []).filter(r => !r.ChuaKhai);
    const modal = openModal(`
      <h3>Định mức & hao hụt — ${escapeHtml(maDH)}</h3>
      ${/* v6.05: màn nhập liệu hiện luôn MÃ RẬP + ẢNH SẢN PHẨM để khai định mức không phải mở lệnh SX ra đối chiếu. */''}
      <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:8px;">
        ${o.AnhSanPham ? `<a href="${escapeHtml(o.AnhSanPham)}" target="_blank" title="Bấm để xem ảnh to"><img src="${escapeHtml(o.AnhSanPham)}" style="width:96px;height:96px;object-fit:cover;border-radius:4px;border:1px solid var(--border);"></a>` : ''}
        <div class="empty-hint" style="padding:0;flex:1;">
          <div><b>${escapeHtml(o.TenSanPham || '')}</b>${o.MaSanPham ? ' · Mã hàng ' + escapeHtml(o.MaSanPham) : ''}${o.Size ? ' · Size ' + escapeHtml(o.Size) : ''}</div>
          <div>Mã rập: <b>${escapeHtml(o.MaRap || '(chưa có — khai ở công đoạn Kỹ thuật)')}</b></div>
          <div>Tổng SL chỉ định: <b>${o.TongSoLuong != null ? fmtQuyDoi(o.TongSoLuong, o.HeSoQuyDoi, o.PhepTinhQuyDoi, o.DonViTinhLenh || 'Cái', o.TenDonViQuyDoi) : ''}</b></div>
          <div>SL nhập kho (dùng để tính): <b>${Number(d.slNhapKho) > 0 ? fmtNumber(d.slNhapKho) + ' ' + escapeHtml(o.DonViTinhLenh || 'Cái') : 'chưa nhập kho'}</b></div>
        </div>
      </div>
      <div class="lap-wrap"><table class="lap-table">
        <colgroup><col style="width:32%"><col style="width:14%"><col style="width:10%"><col style="width:14%"><col><col style="width:42px"></colgroup>
        <thead><tr><th>Loại vải</th><th>Định mức / 1 SP</th><th>ĐVT</th><th>Hao hụt cho phép (%)</th><th>Ghi chú</th><th></th></tr></thead>
        <tbody id="dmRows">${(daKhai.length ? daKhai : [{}]).map(dongHtml).join('')}</tbody></table></div>
      ${suaDuoc ? `<div class="toolbar" style="margin-top:6px;">
        <button type="button" class="btn small secondary" id="dmThem">+ Thêm loại vải</button>
        <button type="button" class="btn small" id="dmLuu">💾 Lưu định mức</button>
      </div>` : ''}
      <h4 style="margin:14px 0 4px;">Báo cáo hao hụt</h4>
      <div id="dmBaoCao">${buildHaoHutBody(d)}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="dmIn">🖨️ In báo cáo</button>
        <button type="button" class="btn" id="dmDong">Đóng</button>
      </div>`);

    const wireDong = (r) => {
      if (!r) return;
      wireSearchableSelect('dmlv_' + r.dataset.idx, dm.loaiVai, 'LoaiVaiID', x => x.TenLoaiVai);
      r.querySelector('.dm-xoa').addEventListener('click', () => {
        if (modal.querySelectorAll('[data-dmrow]').length > 1) r.remove();
        else r.querySelectorAll('input').forEach(i => { i.value = ''; });
      });
    };
    modal.querySelectorAll('[data-dmrow]').forEach(wireDong);
    modal.querySelector('#dmDong').addEventListener('click', closeModal);
    modal.querySelector('#dmIn').addEventListener('click', () => printHtml('Định mức & hao hụt - ' + maDH, buildHaoHutBody(d, true)));
    const bThem = modal.querySelector('#dmThem');
    if (bThem) bThem.addEventListener('click', () => {
      modal.querySelector('#dmRows').insertAdjacentHTML('beforeend', dongHtml(null));
      wireDong(modal.querySelector('#dmRows [data-dmrow]:last-child'));
    });
    const bLuu = modal.querySelector('#dmLuu');
    if (bLuu) bLuu.addEventListener('click', async () => {
      const items = Array.from(modal.querySelectorAll('[data-dmrow]')).map(r => ({
        loaiVaiId: getSearchableValue('dmlv_' + r.dataset.idx),
        dinhMuc: r.querySelector('.dm-muc').value || null,
        donViTinh: r.querySelector('.dm-dvt').value || 'Kg',
        tyLeHaoHut: r.querySelector('.dm-hh').value || null,
        ghiChu: r.querySelector('.dm-ghichu').value || null
      })).filter(x => x.loaiVaiId);
      try {
        await apiPut('/api/qlsx/dinhmuc/' + encodeURIComponent(maDH), { items });
        toast('Đã lưu định mức.', 'success');
        closeModal();
        openDinhMucModal(maDH, perm);   // mở lại để thấy ngay báo cáo hao hụt tính theo định mức mới
      } catch (err) { toast(err.message, 'error'); }
    });
  }
  // Bảng báo cáo hao hụt — dùng CHUNG cho màn hình và bản in (choIn = thêm đầu phiếu).
  function buildHaoHutBody(d, choIn) {
    const o = d.order || {};
    const rows = d.rows || [];
    const dvt = (r) => escapeHtml(r.DonViTinh || 'Kg');
    const body = rows.map(r => r.ChuaKhai
      ? `<tr><td>${escapeHtml(r.TenLoaiVai)}</td><td colspan="3" style="color:#b06000;">Chưa khai định mức</td>
         <td style="text-align:right;">${fmtNumber(r.DaCap)} Kg${Number(r.DaCapMet) ? ' / ' + fmtNumber(r.DaCapMet) + ' Mét' : ''}</td>
         <td colspan="4" style="text-align:center;">—</td></tr>`
      : `<tr><td>${escapeHtml(r.TenLoaiVai)}</td>
         <td style="text-align:right;">${r.DinhMuc != null ? fmtNumber(r.DinhMuc) : ''}</td>
         <td>${dvt(r)}</td>
         <td style="text-align:right;">${r.TyLeHaoHut != null ? r.TyLeHaoHut + '%' : ''}</td>
         <td style="text-align:right;">${fmtNumber(r.DaCap)} ${dvt(r)}</td>
         <td style="text-align:right;">${r.LyThuyet != null ? fmtNumber(r.LyThuyet) + ' ' + dvt(r) : ''}</td>
         <td style="text-align:right;">${r.HaoHut != null ? fmtNumber(r.HaoHut) : ''}</td>
         <td style="text-align:right;">${r.HaoHutPhanTram != null ? r.HaoHutPhanTram + '%' : ''}</td>
         <td style="text-align:center;">${r.VuotDinhMuc ? '<span class="badge danger">Vượt định mức</span>' : (r.HaoHutPhanTram != null ? '<span class="badge ok">Đạt</span>' : '')}</td></tr>`).join('');
    /* v6.05: bản in thêm MÃ RẬP + ẢNH SẢN PHẨM, Tổng SL kèm đơn vị tính — cùng khuôn đầu phiếu (bảng
       nhãn–giá trị + ô ảnh bên phải) với bản in Sổ cắt và Phiếu báo cáo đơn hàng. */
    const dauPhieu = choIn ? `
      <h2 style="text-align:center;margin:8px 0 2px;text-transform:uppercase;">Báo cáo định mức &amp; hao hụt vải</h2>
      <div style="text-align:right;font-size:13px;margin-bottom:6px;">Mã ĐH: <b>${escapeHtml(o.MaDH || '')}</b></div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr>
        <td style="vertical-align:top;padding:0;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">
            <tr><td style="width:34%;background:#f5f6f8;"><b>Tên sản phẩm</b></td><td>${escapeHtml(o.TenSanPham || '')}</td></tr>
            ${o.MaSanPham ? `<tr><td style="background:#f5f6f8;"><b>Mã hàng</b></td><td>${escapeHtml(o.MaSanPham)}</td></tr>` : ''}
            ${o.Size ? `<tr><td style="background:#f5f6f8;"><b>Size</b></td><td>${escapeHtml(o.Size)}</td></tr>` : ''}
            <tr><td style="background:#f5f6f8;"><b>Mã rập</b></td><td>${escapeHtml(o.MaRap || '')}</td></tr>
            <tr><td style="background:#f5f6f8;"><b>Tổng SL chỉ định</b></td><td>${o.TongSoLuong != null ? fmtQuyDoi(o.TongSoLuong, o.HeSoQuyDoi, o.PhepTinhQuyDoi, o.DonViTinhLenh || 'Cái', o.TenDonViQuyDoi) : ''}</td></tr>
            <tr><td style="background:#f5f6f8;"><b>SL hoàn thành (nhập kho)</b></td><td><b>${fmtNumber(d.slNhapKho)} ${escapeHtml(o.DonViTinhLenh || 'Cái')}</b></td></tr>
          </table>
        </td>${o.AnhSanPham ? `<td style="width:130px;vertical-align:top;padding-left:10px;text-align:center;">
          <div style="font-size:11px;color:#555;">Ảnh sản phẩm</div>
          <img src="${escapeHtml(o.AnhSanPham)}" style="max-width:125px;max-height:150px;object-fit:contain;border:1px solid #ccc;"></td>` : ''}
      </tr></table>` : '';
    return `${dauPhieu}
      <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">
        <thead><tr><th>Loại vải</th><th>Định mức/SP</th><th>ĐVT</th><th>Hao hụt cho phép</th><th>Đã cấp</th><th>Lý thuyết</th><th>Hao hụt</th><th>Hao hụt %</th><th>So định mức</th></tr></thead>
        <tbody>${body || '<tr><td colspan="9" style="text-align:center;">Chưa khai định mức và chưa xuất vải cho lệnh này</td></tr>'}</tbody>
      </table>
      <p style="font-size:11px;color:#666;">Lý thuyết = Định mức/SP × <b>SL nhập kho</b> (${fmtNumber(d.slNhapKho)} ${escapeHtml(o.DonViTinhLenh || 'Cái')}). Đã cấp = tổng vải đã xuất kho cho lệnh này, gom theo loại vải, lấy theo đúng ĐVT của dòng định mức. Hao hụt = Đã cấp − Lý thuyết.</p>`;
  }

  /* ================================================================================================
     v5.96 — SỬA / THÊM CÂY VÀO SỔ CẮT ĐÃ GHI
     Tự chứa: tự tải danh sách cây vải ĐÃ XUẤT cho đơn (để chọn thêm cây) + hệ số quy đổi của đơn,
     nên gọi được từ bất cứ đâu, không phụ thuộc form Ghi tiến độ đang mở.
     Lưu ý: SL cái = số lớp × hệ số của ĐƠN (server là nguồn sự thật, ở đây chỉ hiển thị cho dễ nhìn).
     ================================================================================================ */
  let __ssIdx = 0;
  async function openSuaSoCatModal(maDH, rec, onDone) {
    let det;
    try { det = (await apiGet('/api/qlsx/orders/' + encodeURIComponent(maDH))).data; }
    catch (err) { toast('Không tải được dữ liệu đơn hàng: ' + err.message, 'error'); return; }
    /* GET /orders/:maDH trả về object PHẲNG (các trường của đơn + giaoVai), KHÔNG bọc trong .order —
       xem cách openProgressForm đọc detail.HeSoQuyDoi / detail.giaoVai. */
    // 1 cây có thể xuất qua NHIỀU phiếu -> giaoVai có thể trùng CayID; lọc trùng cho danh sách gọn.
    const dsCay = [];
    (det.giaoVai || []).forEach(c => { if (!dsCay.some(x => String(x.CayID) === String(c.CayID))) dsCay.push(c); });
    const heSo = Number(det.HeSoQuyDoi) || 1;
    const nhanApp = (c) => `${c.MaCay || ''}${c.TenLoaiVai ? ' · ' + c.TenLoaiVai : ''}${c.TenMau ? ' · ' + c.TenMau : ''}`;
    // v6.01: sổ đang sửa ĐÃ có giật cấp thì bật cột sẵn, không thì để ẩn cho gọn.
    let ssCoGiatCap = (rec.cays || []).some(c => Number(c.SoCaiGiatCap) > 0);
    const dongHtml = (p) => {
      const idx = ++__ssIdx;
      p = p || {};
      return `<tr data-ssrow data-idx="${idx}">
        <td>${searchableSelectHtml('sscay_' + idx, dsCay, 'CayID', nhanApp, p.CayID || '')}</td>
        <td class="col-so"><input class="ss-stt" type="text" value="${escapeHtml(p.SttCay || '')}"></td>
        <td class="col-so"><input class="ss-lop" type="number" min="0" value="${p.SoLuongLop != null ? p.SoLuongLop : ''}"></td>
        ${/* v6.08: hệ số sửa được cho từng cây (mặc định hệ số của đơn). */''}
        <td class="col-so"><input class="ss-heso" type="number" min="0" step="0.001" value="${p.HeSoQuyDoi != null ? p.HeSoQuyDoi : heSo}"></td>
        ${/* v6.01: giật cấp (số CÁI) — cột chỉ hiện khi ô tick "Có cắt giật cấp" đang bật. */''}
        <td class="col-so gc-cell" style="${ssCoGiatCap ? '' : 'display:none;'}"><input class="ss-giatcap" type="number" min="0" value="${p.SoCaiGiatCap != null ? p.SoCaiGiatCap : ''}"></td>
        <td class="col-so"><input class="ss-kgmet" type="number" min="0" step="0.01" value="${p.SoKgMetSuDung != null ? p.SoKgMetSuDung : ''}"></td>
        <td class="col-so"><div class="readonly-fact ss-cai">0</div></td>
        <td class="col-nut">
          <input type="hidden" class="ss-anh" value="${escapeHtml(p.AnhCay || '')}">
          <input type="file" accept="image/*" capture="environment" class="ss-anh-file" style="font-size:11px;max-width:110px;">
          <div class="ss-anh-xem">${p.AnhCay ? `<a href="${escapeHtml(p.AnhCay)}" target="_blank"><img src="${escapeHtml(p.AnhCay)}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></a>` : ''}</div>
        </td>
        <td class="col-nut"><button type="button" class="btn small danger ss-xoa" title="Xóa dòng">X</button></td></tr>`;
    };
    const modal = openModal(`
      <h3>Sửa sổ cắt — ${escapeHtml(maDH)}${rec.SttSoCat != null ? ' · STT sổ ' + escapeHtml(String(rec.SttSoCat)) : ''}</h3>
      <p class="empty-hint">Thêm cây vải cắt tiếp vào ĐÚNG sổ này (không tạo sổ mới). Sửa được STT cây, số lớp, KG/mét, ảnh.
        Ngày cắt của sổ: <b>${fmtDate(rec.NgayGhiNhan)}</b>. Hệ số quy đổi của đơn: <b>${fmtNumber(heSo)}</b>.</p>
      <div class="form-grid">
        <div class="form-row"><label>STT sổ cắt</label><input type="number" id="ssSttSo" value="${rec.SttSoCat != null ? rec.SttSoCat : ''}"></div>
      </div>
      <label class="chk-item" style="font-weight:normal;margin:4px 0;">
        <input type="checkbox" id="ssGcToggle" ${ssCoGiatCap ? 'checked' : ''}> Có cắt giật cấp (ghi số CÁI — không tính vào số lớp)</label>
      <div class="lap-wrap"><table class="lap-table">
        <colgroup><col style="width:26%"><col style="width:8%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:10%"><col style="width:130px"><col style="width:42px"></colgroup>
        <thead><tr><th>Cây vải (đã xuất cho đơn)</th><th>STT</th><th>SL lớp</th><th>Hệ số</th><th class="gc-cell" style="${ssCoGiatCap ? '' : 'display:none;'}">Giật cấp (cái)</th><th>KG/mét đã dùng</th><th>SL cái</th><th>Ảnh</th><th></th></tr></thead>
        <tbody id="ssRows">${(rec.cays || []).map(dongHtml).join('') || dongHtml(null)}</tbody></table></div>
      <div class="toolbar" style="margin-top:6px;">
        <button type="button" class="btn small secondary" id="ssThem">+ Thêm cây vải</button>
        <span class="empty-hint" style="padding:0;">Tổng SL cái: <b id="ssTongCai">0</b> · Tổng lớp: <b id="ssTongLop">0</b></span>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="ssHuy">Hủy</button>
        <button type="button" class="btn" id="ssLuu">💾 Lưu sổ cắt</button>
      </div>`);

    function tinhLai() {
      let cai = 0, lop = 0;
      modal.querySelectorAll('[data-ssrow]').forEach(r => {
        const l = Number(r.querySelector('.ss-lop').value) || 0;
        // v6.01: SL cái = lớp × hệ số + giật cấp (giật cấp ghi bằng CÁI, không nhân hệ số).
        const oGC = r.querySelector('.ss-giatcap');
        const gc = (ssCoGiatCap && oGC) ? (Number(oGC.value) || 0) : 0;
        // v6.08: hệ số theo ô của DÒNG (sửa được), bỏ trống/≤0 thì dùng hệ số của đơn.
        const oHS = r.querySelector('.ss-heso');
        const hs = (oHS && Number(oHS.value) > 0) ? Number(oHS.value) : heSo;
        lop += l; cai += l * hs + gc;
        r.querySelector('.ss-cai').textContent = fmtNumber(Math.round((l * hs + gc) * 100) / 100);
      });
      modal.querySelector('#ssTongCai').textContent = fmtNumber(Math.round(cai * 100) / 100);
      modal.querySelector('#ssTongLop').textContent = fmtNumber(lop);
    }
    function wireDong(r) {
      if (!r) return;
      wireSearchableSelect('sscay_' + r.dataset.idx, dsCay, 'CayID', nhanApp, tinhLai);
      r.querySelector('.ss-lop').addEventListener('input', tinhLai);
      const oGC2 = r.querySelector('.ss-giatcap');   // v6.01
      if (oGC2) oGC2.addEventListener('input', tinhLai);
      const oHS2 = r.querySelector('.ss-heso');      // v6.08
      if (oHS2) oHS2.addEventListener('input', tinhLai);
      r.querySelector('.ss-xoa').addEventListener('click', () => {
        if (modal.querySelectorAll('[data-ssrow]').length > 1) r.remove(); else r.querySelectorAll('input').forEach(i => { i.value = ''; });
        tinhLai();
      });
      const oF = r.querySelector('.ss-anh-file');
      if (oF) oF.addEventListener('change', async () => {
        const f = oF.files && oF.files[0];
        if (!f) return;
        try {
          const url = await uploadFile(f, 'cat');
          r.querySelector('.ss-anh').value = url;
          r.querySelector('.ss-anh-xem').innerHTML = `<a href="${escapeHtml(url)}" target="_blank"><img src="${escapeHtml(url)}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;"></a>`;
        } catch (err) { toast(err.message, 'error'); }
      });
    }
    modal.querySelectorAll('[data-ssrow]').forEach(wireDong);
    // v6.01: ô tick bật/tắt cột giật cấp (tắt thì xóa số đã gõ để không lưu số đang bị ẩn).
    modal.querySelector('#ssGcToggle').addEventListener('change', (e) => {
      ssCoGiatCap = e.target.checked;
      modal.querySelectorAll('.gc-cell').forEach(el => { el.style.display = ssCoGiatCap ? '' : 'none'; });
      if (!ssCoGiatCap) modal.querySelectorAll('.ss-giatcap').forEach(i => { i.value = ''; });
      tinhLai();
    });
    tinhLai();
    modal.querySelector('#ssThem').addEventListener('click', () => {
      modal.querySelector('#ssRows').insertAdjacentHTML('beforeend', dongHtml(null));
      const moi = modal.querySelector('#ssRows [data-ssrow]:last-child');
      wireDong(moi);
      focusODongCat(moi);
      tinhLai();
    });
    modal.querySelector('#ssHuy').addEventListener('click', closeModal);
    modal.querySelector('#ssLuu').addEventListener('click', async () => {
      const chiTietCay = Array.from(modal.querySelectorAll('[data-ssrow]')).map(r => ({
        cayId: getSearchableValue('sscay_' + r.dataset.idx),
        sttCay: r.querySelector('.ss-stt').value || null,
        soLuongLop: r.querySelector('.ss-lop').value || 0,
        heSoQuyDoi: (r.querySelector('.ss-heso') && r.querySelector('.ss-heso').value) || null,   // v6.08
        soCaiGiatCap: (ssCoGiatCap && r.querySelector('.ss-giatcap')) ? (r.querySelector('.ss-giatcap').value || null) : null,   // v6.01
        kgMetSuDung: r.querySelector('.ss-kgmet').value || null,
        anhCay: r.querySelector('.ss-anh').value || null
      })).filter(c => c.cayId && Number(c.soLuongLop) > 0);
      if (!chiTietCay.length) { toast('Sổ cắt phải có ít nhất 1 cây vải với số lớp > 0.', 'error'); return; }
      const idTrung = chiTietCay.map(c => String(c.cayId)).filter((v, i, a) => a.indexOf(v) !== i);
      if (idTrung.length) { toast('Có cây vải bị chọn TRÙNG trong sổ cắt — mỗi cây chỉ 1 dòng.', 'error'); return; }
      try {
        await apiPut(`/api/qlsx/orders/${encodeURIComponent(maDH)}/socat/${rec.TienDoID}`, {
          chiTietCay, sttSoCat: modal.querySelector('#ssSttSo').value || null
        });
        closeModal();
        toast('Đã lưu sổ cắt.', 'success');
        if (onDone) onDone();
      } catch (err) { toast(err.message, 'error'); }
    });
  }
  // Con trỏ nhảy vào ô đầu dòng mới (bản sao gọn của focusODauDong bên kho vải).
  function focusODongCat(row) {
    if (!row) return;
    setTimeout(() => {
      const el = row.querySelector('.ss-input, input:not([type=hidden]):not([readonly])');
      if (el) { el.focus(); try { el.select(); } catch (e) { } }
    }, 30);
  }

  // v5.54: "Bổ sung sơ đồ" — chọn đơn để vào THẲNG công đoạn Kỹ thuật ghi/bổ sung sơ đồ rồi Gửi để chạy tiếp luồng.
  async function renderBoSungSoDo(perm) {
    const body = document.getElementById('qBody');
    const rows = (await apiGet('/api/qlsx/orders-quakythuat')).data || [];   // v5.55: chỉ lệnh đã qua KT, không lọc theo công đoạn user
    body.innerHTML = `
      <h3 style="margin-top:0;">Bổ sung sơ đồ (lệnh đã qua công đoạn Kỹ thuật)</h3>
      <p class="empty-hint">Danh sách các lệnh SX ĐÃ ghi tiến độ công đoạn Kỹ thuật. Chọn đơn để vào lại Kỹ thuật thêm sơ đồ (vd vải về đợt sau); lưu sơ đồ + bấm Gửi — đơn vẫn giữ/đi tiếp các công đoạn sau.</p>
      <table><thead><tr><th>Mã ĐH</th><th>Tên SP</th><th>Mã Rập</th><th>Công đoạn hiện tại</th><th>Số sơ đồ</th><th style="width:170px">Thao tác</th></tr></thead>
      <tbody>${rows.map(o => `<tr><td>${escapeHtml(o.MaDH)}</td><td>${escapeHtml(o.TenSanPham || '')}</td><td>${escapeHtml(o.MaRap || '')}</td><td>${escapeHtml(o.TenCongDoan || '')}</td><td style="text-align:center;">${o.SoSoDo != null ? o.SoSoDo : ''}</td>
        <td><button class="btn small secondary act-bssd" data-madh="${escapeHtml(o.MaDH)}">Bổ sung sơ đồ</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Chưa có lệnh nào qua công đoạn Kỹ thuật</td></tr>'}</tbody></table>`;
    body.querySelectorAll('.act-bssd').forEach(b => b.addEventListener('click', () => openProgressForm(b.dataset.madh, perm, 'KT')));
  }
  async function openProgressForm(maDH, perm, jumpStageCode) {
    // v5.18 (muc 1.2.2): bo goi /vaicay-kho-loc ("cay con ton kho dung loai vai/mau don hang" - nguon du
    // lieu CU cua "Giao vai", da bi go khoi man hinh nay) - cay vai cho cong doan Cat gio lay THANG tu
    // detail.giaoVai (nay la Phieu xuat kho vai THAT, xem getVaiCayDaXuatChoDon() o qlsx.js), khong con
    // can goi rieng API nay nua.
    const [detail, congDoanMayList, phanCongMayRaw, hangMucGiaCongList, dongiaCongDoanMayList, phanCongLaDGRaw] = await Promise.all([
      apiGet('/api/qlsx/orders/' + maDH).then(r => r.data),
      apiGet(`/api/qlsx/orders/${maDH}/congdoanmay`).then(r => r.data),
      // v5.5: lich su "Giao viec noi bo" da ghi nhan truoc do (xem khoi Admin sua o cong doan May) -
      // truoc day form nay chi GHI, khong doc lai duoc gi da giao.
      apiGet(`/api/qlsx/orders/${maDH}/phancongmay`).then(r => r.data).catch(() => []),
      // v5.24 (muc 1.1.1): danh sach "Hạng mục gia công" CHO DON HANG nay (ISNULL override tren gia mac
      // dinh, DaChon danh dau dong da luu rieng cho don - xem GET /orders/:maDH/hangmucgiacong trong
      // qlsx.js) - mirror dung cach congDoanMayList/congDoanMayDaChon o tren.
      apiGet(`/api/qlsx/orders/${maDH}/hangmucgiacong`).then(r => r.data).catch(() => []),
      // v5.34c (muc 6): "Đơn giá công đoạn may" MOI cua don hang (Tai lieu may) -> nguon cong doan cho May giao viec.
      apiGet(`/api/qlsx/orders/${maDH}/dongiacongdoanmay`).then(r => r.data).catch(() => []),
      // v5.38: giao việc LA/DG đã ghi (theo màu) - để hiện "đã giao".
      apiGet(`/api/qlsx/orders/${maDH}/phancongladonggoi`).then(r => r.data).catch(() => [])
    ]);
    // v5.18 (muc 1.2.1/1.2.2): bo 2 cong doan "Chỉ định phụ kiện" (PK) va "Giao vải" (GV) khoi luong Ghi
    // nhan tien do - 2 ma nay KHONG con la diem dung tren duong di cua don hang MOI (xem tinhNextStage()
    // trong qlsx.js, luon bo qua khi tinh cong doan ke tiep) nen cung khong con duoc hien trong o chon
    // Cong doan o day - loc ngay tu day de dropdown (#pCongDoanSelect), stageById/stageCodeOf va
    // renderStageFields() ben duoi deu nhat quan (khong con nhanh 'GV'/'PK' nao ca).
    // v5.22 (muc 1.2, yeu cau "Nếu ở công đoạn Kỹ thuật chỉ chọn Giao gia công thì sẽ không hiện lệnh
    // sản xuất trong ghi nhận tiến độ Công đoạn May"): backend tinhNextStage() da tu dong BO QUA "May"
    // khi giaCongNgoai (khong doi, tu v5.0) nen don GiaCong KHONG BAO GIO thuc su dung o cong doan nay -
    // an them "May" khoi CHINH o chon o day (khong chi dua vao auto-skip) de khong ai co the CHON THU
    // CONG "May" cho 1 don GiaCong tu dropdown nay.
    // v5.24: doi tu 1 dieu kien KenhSanXuat (don gia tri) sang 2 co doc lap DaGiaoNhaLam/DaGiaoGiaCong -
    // dung Y HET dieu kien "chiGiaCongNgoai" ben backend (tinhNextStage() trong qlsx.js): chi bo qua May
    // khi CHI gia cong ngoai (khong co phan Nha Lam nao). Don CU chua tung mo lai 'GC' tu sau nang cap se
    // co ca 2 co = false truoc khi backfill - fallback ve suy luan cu tu NhaGiaCongID/LaNoiBoNhaGiaCong
    // (dong nhat voi migration_v524.sql).
    const giaCongNgoaiFE = (detail.DaGiaoNhaLam || detail.DaGiaoGiaCong)
      ? (!!detail.DaGiaoGiaCong && !detail.DaGiaoNhaLam)
      : (detail.NhaGiaCongID != null && detail.LaNoiBoNhaGiaCong === false);
    // v5.26 (phan hoi truc tiep qua AskUserQuestion: "Luôn hiện MAY đối với quyền sửa, xóa, admin. Không
    // hiện lệnh sản xuất ở công đoạn may nếu ở công đoạn Giao gia công không tích vào Giao nhà làm"):
    // nguoi co quyen Sua/Xoa lenh san xuat (hoac admin) duoc quyen VAN thay "May" trong dropdown ke ca voi
    // don CHI gia cong ngoai (de xu ly ngoai le/sua nham thu cong) - nguoi chi co quyen Ghi tien do
    // ('tiendo', khong co 'orders'.canEdit/canDelete) van bi an nhu cu (hanh vi goc, khong doi).
    const canOverrideMayHide = !!(currentUser && currentUser.isAdmin) || !!(perm && (perm.canEdit || perm.canDelete));
    // v5.30: cong doan "Nhan gia cong" (NGC) CHI hien voi don co giao gia cong (detail.DaGiaoGiaCong) -
    // an voi don khong gia cong (tru nguoi co quyen sua/xoa/admin, giong ngoai le MAY).
    // v5.31: an cong doan GNGC/NNGC cu (Giao/Nhận nhà gia công - da thay bang GC/NGC) khoi dropdown, loc
    // ca theo MaCongDoan lan TenCongDoan de chac chan (ban ghi cu trong DB co the thieu MaCongDoan).
    // v5.33 (muc 3): CHI hien cong doan user duoc phan cong (UserCongDoan -> currentUser.congDoanIds).
    // Rong/khong gan = xem HET (dong nhat backend loc don hang + canUpdateStage). Admin xem het.
    const myStageIds = Array.isArray(currentUser.congDoanIds) ? currentUser.congDoanIds : [];
    const seeAllStages = currentUser.isAdmin || !myStageIds.length;
    const stages = dm.congDoan.filter(s => s.MaCongDoan !== 'GV' && s.MaCongDoan !== 'PK'
      && s.MaCongDoan !== 'GNGC' && s.MaCongDoan !== 'NNGC'
      && s.MaCongDoan !== 'GNIT' && s.MaCongDoan !== 'NNIT'   // v5.33: an in theu cu (trung GIT/NIT moi)
      && s.TenCongDoan !== 'Giao nhà gia công' && s.TenCongDoan !== 'Nhận nhà gia công'
      && s.TenCongDoan !== 'Giao nhà in thêu' && s.TenCongDoan !== 'Nhận nhà in thêu'
      && !(giaCongNgoaiFE && !canOverrideMayHide && s.MaCongDoan === 'MAY')
      && !(!detail.DaGiaoGiaCong && !canOverrideMayHide && s.MaCongDoan === 'NGC')
      && !((s.MaCongDoan === 'GIT' || s.MaCongDoan === 'NIT') && !detail.CoInTheu)   // v5.33: don khong in theu -> an GIT/NIT
      && (seeAllStages || myStageIds.indexOf(s.StageID) !== -1));
    const chinhColors = (detail.chiTietVai || []).filter(ct => ct.Kieu === 'Chính');
    // v5.27.1 (Option 4): danh sach mau cho theo doi tien do May/Kho nhap lay tu KET QUA CAT
    // (detail.catMauList = [{MauSacID, TenMau, SoLuong}]) - KHONG tu Cau truc vai (mau o Ra lenh SX gio
    // go tu do CHI THAM KHAO). Nho vay MauSacID luon that (tu cay vai da cat), khong loi NOT NULL.
    const catMauList = detail.catMauList || [];
    const nhanVienCat = (dm.nhanVien || []).filter(nv => nv.TenBoPhan === 'Cắt');
    const nhanVienMay = (dm.nhanVien || []).filter(nv => nv.TenBoPhan === 'May');
    const slCatTheoMau = detail.slCatTheoMau || {};
    // v5.7: tinh lai TONG SL cat CHI theo mau CHINH (khong gom phoi) ngay tai frontend tu slCatTheoMau
    // (da dung san theo tung MauSacID chinh, xem mauQtyRowsHtml() ben duoi) - fix loi thuc te "Tổng SL
    // cắt (đã quy đổi) chỉ nên sum màu chính, không sum phối": truoc day dung thang detail.slCatTong (1
    // con so tong o backend, cong don CA mau phoi vi mau phoi cung hop le di qua chuoi Giao vai -> Cat
    // ma khong bi loc theo Kieu o bat ky buoc nao). Tinh lai o day (thay vi sua truy van backend) tai
    // dung du lieu CHINH XAC theo tung mau da co san, khong dong cham logic tinh slCatTheoMau o server.
    const slCatTongChinh = catMauList.reduce((sum, ct) => sum + Number(ct.SoLuong || 0), 0);
    const theKho = detail.theKho || { DonViCoBan: 'Cái', DonViQuyDoi: 'Ri', LoaiRi: 1 };
    // v5.13 (muc 1.2.2.2): He so quy doi (Cai/Ri) gio KHAI BAO 1 LAN DUY NHAT tren don hang (Ra lenh
    // san xuat, DonHangSanXuat.HeSoQuyDoi) - dung CHUNG cho MOI cay vai o cong doan Cat, thay vi nhap
    // lai tung dong (xem catPickRowHtml()/wireCatPickRow() ben duoi, da bo o nhap ".cat-heso").
    const heSoQuyDoiDonHang = Number(detail.HeSoQuyDoi) || 1;
    // v5.2: state co the thay doi TRONG luc modal dang mo (them/xoa Giao vai, Phu kien) - dung mang
    // rieng thay vi doc thang tu detail de refresh tai cho khong can dong modal.
    let giaoVaiList = detail.giaoVai || [];
    // v5.14: "Chỉ định NPL" (phụ kiện) đã tách khỏi màn hình này - xem module.tailieukythuat.js (dùng
    // chung 3 API /orders/:maDH/phukien như cũ, chỉ chuyển UI, không đụng chạm state máy công đoạn).
    // v5.13 (muc 1.2.1.1/1.2.1.2): cung 1 pattern list-rieng-luu-ngay nhu giaoVaiList o tren -
    // xem renderSoDoBox()/renderNhaGiaCongChiTietBox() ben duoi.
    let soDoList = detail.soDoList || [];
    let nhaGiaCongChiTietList = detail.nhaGiaCongChiTiet || [];
    let inTheList = [];          // v5.32: nha in theu da giao cho don (nap qua GET /orders/:maDH/inthe khi vao cong doan GIT/NIT)
    let inTheAddIdx = 0;
    // v5.5: "cong doan may DA CHON" nay la 1 danh sach THEM/XOA duoc (tim theo ky tu bat ky) ngay tai
    // form Ky thuat, thay cho checklist hien HET tat ca danh muc (yeu cau v5.5). State rieng vi nguoi
    // dung co the them/xoa TRONG luc modal dang mo, chua luu xuong server cho toi khi bam "Gui".
    // v5.34c (Giai doan C, muc 6): nguon cong doan May = "Đơn giá công đoạn may" MOI (Tai lieu may), thay cho
    // DonHangCongDoanMay (KT). Map ve shape cu {TenCongDoan/DonGia/HeSo} + DgmID (dinh danh dong bang moi).
    let congDoanMayDaChon = (dongiaCongDoanMayList || []).map(r => ({ DgmID: r.ID, CongDoanMayID: null, TenCongDoan: r.TenCongDoan, MaCongDoan: '', DonGia: r.ThanhTien, HeSo: 1 }));
    let phanCongMayList = phanCongMayRaw || [];
    // v5.38: LA (là) / DG (đóng gói) giao việc theo MÀU (bảng riêng PhanCongLaDongGoi). phanCongLaDGList = đã ghi;
    // laDgByMau = state đang nhập theo MauSacID; nhanVienAll = mọi nhân viên (bộ phận Là/Đóng gói).
    let phanCongLaDGList = phanCongLaDGRaw || [];
    let laDgByMau = {};
    let laDgIdx = 0;
    const nhanVienAll = dm.nhanVien || [];
    // v5.24 (muc 1.1.1, "thêm trường đơn giá Giao gia công. Thêm nhiều dòng đơn giá"): state THEM/XOA
    // duoc ngay tai Ky thuat, mirror dung congDoanMayDaChon o tren - xem hangMucGiaCongChonHtml() duoi.
    let hangMucGiaCongDaChon = hangMucGiaCongList.filter(c => c.DaChon);

    const html = `
      <h3>Ghi nhận tiến độ — ${escapeHtml(maDH)}</h3>
      <form id="pForm">
        <div class="form-grid">
          <div class="form-row"><label>Công đoạn *</label>
            <select name="congDoan" id="pCongDoanSelect" required>${stages.map(s => `<option value="${s.StageID}" ${s.StageID === detail.CongDoanHienTaiID ? 'selected' : ''}>${escapeHtml(s.TenCongDoan)}</option>`).join('')}</select>
          </div>
          <div class="form-row"><label>Ngày ghi nhận *</label><input type="date" name="ngayGhiNhan" value="${new Date().toISOString().slice(0, 10)}" required></div>
        </div>
        <div id="pStageFields"></div>
        <div class="form-row"><label>Ghi chú</label><textarea name="ghiChu" rows="2"></textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Gửi</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);

    // ---- Cac mau HTML dung chung ----
    // v5.0: them cot tham khao "Cắt: X" ben canh SL nhap, ap dung cho May va cac cong doan sau Cat khac
    // (khong ap dung rieng cong doan Cat vi Cat gio dung UI theo cay o duoi). Yeu cau v5.2 muc 8 ("cac
    // cong doan sau Cat hien SL da quy doi theo tung mau") DA duoc dap ung boi cot nay.
    function mauQtyRowsHtml() {
      return catMauList.map(ct => `<div class="row-item" style="grid-template-columns:160px 1fr 110px;">
          <div class="form-row"><label>${escapeHtml(ct.TenMau)}</label></div>
          <div class="form-row"><input type="number" min="0" class="mau-qty" data-mausac="${ct.MauSacID}" placeholder="SL lũy kế"></div>
          <div class="form-row"><div class="readonly-fact">Cắt: ${fmtNumber(ct.SoLuong || 0)}</div></div>
        </div>`).join('') || '<div class="empty-hint">Chưa ghi nhận Cắt — chưa có màu để nhập (màu theo dõi lấy từ kết quả Cắt).</div>';
    }
    // v5.2: dropdown "Cong doan may" chi liet ke cac cong doan DA DUOC GAN cho don hang nay o Ky thuat
    // (congDoanMayDaChon) thay vi toan bo danh muc - yeu cau v5.2 muc 6.
    // v5.5: nhan vien go tim (ky tu bat ky) thay cho dropdown co dinh, va o SL chi hien SAU khi da
    // chon xong nhan vien (yeu cau v5.5: "chon xong hien truong danh so luong de giao").
    // v5.8: da go giaoViecRowHtml()/wireGiaoViec() (khoi "Giao việc nội bộ" kieu tu do, 1-dong-1-lan,
    // truoc day rieng cho cong doan May). v5.8.1 (sua theo yeu cau moi "y nguyên bảng ở công đoạn Kỹ
    // Thuật"): cong doan May tung dung LAI Y NGUYEN congDoanMayChonHtml()/wireCongDoanMayChon() (cung 2
    // ham dang dung o Ky thuat) qua 1 khu vuc con rieng #mayCongDoanMayArea trong renderStageFields('May').
    // v5.23 (yeu cau "hiển thị đơn giá từ công đoạn kỹ thuật đã nhập"): quay LAI mo hinh CHI-DOC gia/he
    // so tai May (congDoanMayReadonlyHtml()/wireCongDoanMayReadonly(), dinh nghia ngay sau
    // wireCongDoanMayChon() ben duoi) - Ky thuat gio la NOI DUY NHAT sua duoc gia/he so cong doan may.
    // v5.5: thay bang "Don gia cong doan may (tham khao)" (truoc day hien TOAN BO danh muc he thong,
    // khong lien quan rieng don hang nao) bang bang CHI liet ke cac cong doan DA duoc chon cho DUNG
    // don hang nay o "Ky thuat" (yeu cau v5.5: "Hien thi bang list cong doan cua don hang do da duoc
    // lua chon o cong doan Ky thuat") - cuon rieng voi trang neu dai qua 7 dong.
    function congDoanMayDaChonTableHtml() {
      if (!congDoanMayDaChon.length) return '<div class="empty-hint">Đơn hàng chưa chọn công đoạn may nào ở "Kỹ thuật".</div>';
      const rowsHtml = congDoanMayDaChon.map((c, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(c.MaCongDoan || '')}</td><td>${escapeHtml(c.TenCongDoan)}</td><td>${fmtNumber(c.DonGia || 0)}</td><td>${c.HeSo ?? 1}</td></tr>`).join('');
      const table = `<table><thead><tr><th style="width:38px;">STT</th><th>Mã CD</th><th>Tên công đoạn</th><th>Đơn giá</th><th>Hệ số</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
      return congDoanMayDaChon.length > 7 ? `<div style="max-height:260px;overflow-y:auto;">${table}</div>` : table;
    }
    // v5.5: THEM/XOA cong doan may bang go tim ky tu bat ky (giong pattern phu kien/cay vai da co san
    // trong chinh file nay) thay cho checklist hien HET danh muc (yeu cau v5.5: "khong hien thi het
    // cac cong doan ma chon trong list danh muc, go ky tu bat ky de tim kiem chon xong dien don gia,
    // he so"). congDoanMayDaChon la STATE co the them/xoa NGAY trong luc modal dang mo (xem khai bao
    // "let congDoanMayDaChon" o dau openProgressForm), chi luu that su xuong server luc bam "Gui".
    // v5.7: state MOI (chua luu xuong server) cho "Giao viec noi bo" nhap TRUC TIEP ngay tai cong doan
    // Ky thuat, theo yeu cau v5.7 ("tạo thêm 1 cột ở Công đoạn may đã chọn cho đơn hàng này (ở "Kỹ
    // thuật") và lựa chọn tên nhân viên ở đó có nút thêm nhân viên và số lượng"). Backend KHONG gate
    // giaoViecMay theo ten cong doan dang nop (xem POST /orders/:maDH/tiendo trong qlsx.js) nen khong
    // can doi gi o backend - chi can frontend thu thap dung dinh dang o nhanh nop "Kỹ thuật". Day la
    // THEM MOI, khong thay the khoi "Giao việc nội bộ" da co san o cong doan May (van giu nguyen ben do
    // de nguoi dung con co the giao/doi chieu lai luc DA co SL cat thuc te).
    let ktGiaoVienIdx = 0;
    let ktGiaoViecByStage = {}; // { [congDoanMayId]: [{ idx, nhanVienId, soLuong }] }
    // v6.19: vẽ lại bảng "Lịch sử giao việc nội bộ" sau khi sửa/xóa/lưu ngay tại ô Nhân viên & SL.
    function lamMoiBangLichSuMay() {
      const el = modal.querySelector('#mayPcmArea');
      if (!el) return;
      el.innerHTML = phanCongMayExistingTableHtml();
      wirePhanCongMayEdit(el);
    }
    // v5.7 (fix sau kiem tra doc lap): row LUU LAI ca nhanVienId/soLuong (khong chi idx nhu ban dau) va
    // ktGiaoViecMiniRowHtml/searchableSelectHtml DUNG lai gia tri do de dien san khi ve lai - truoc day
    // chi luu {idx} nen moi lan them/bot 1 CONG DOAN MAY khac (kich hoat setTimeout(renderAreaFn,0) ve
    // lai toan bo khu vuc) se lam MAT trang du lieu nhan vien/SL da nhap cho cac dong khac - cung 1 loi
    // (mat du lieu khi re-render) da duoc fix cho .km-dongia/.km-heso o wireCongDoanMayChon nhung CHUA
    // duoc ap dung cho khoi "Nhan vien & SL" nay luc dau.
    function ktGiaoViecMiniRowHtml(congDoanMayId, row) {
      const uid = 'ktgv_' + congDoanMayId + '_' + row.idx;
      return `<div class="ktgv-row" data-ktgvrow data-idx="${row.idx}" style="display:flex;gap:4px;align-items:center;margin-bottom:4px;flex-wrap:wrap;">
        ${/* v6.66.1: THU NGAN ô tên nhân viên, NỚI RỘNG ô số lượng gấp đôi (56 -> 112px).
             Tên nhân viên chỉ cần đủ để nhận ra người, còn SL là số hay gõ sai nhất — 56px không
             nhìn hết số có 4-5 chữ. flex:1 cũ ăn hết chỗ thừa nên phải bỏ, thay bằng bề rộng cố định. */''}
        <div style="width:150px;min-width:120px;flex:0 0 auto;">${searchableSelectHtml(uid, nhanVienMay, 'NhanVienID', p => p.HoTen, row.nhanVienId || '')}</div>
        <input type="number" min="0" class="ktgv-sl" placeholder="SL" style="width:112px;" value="${row.soLuong || ''}">
        <button type="button" class="btn small danger ktgv-remove" style="padding:2px 8px;">X</button>
      </div>`;
    }
    /* v6.19 — DÒNG ĐÃ LƯU HIỆN NGAY TẠI Ô "Nhân viên & SL" VÀ SỬA ĐƯỢC TẠI CHỖ.
       Trước đây lưu xong dòng biến mất khỏi ô nhập, chỉ còn 1 dòng chữ xám "Đã giao: Tên (SL)" và muốn sửa
       phải xuống bảng "Lịch sử giao việc" bên dưới. Nay mỗi người đã giao là 1 dòng có ô chọn nhân viên +
       ô SL + nút 💾 (lưu sửa) + 🗑️ (xóa) ngay tại đó. Không có quyền Sửa/Xóa thì hiện dạng chữ như cũ. */
    function ktGiaoViecSavedRowHtml(p) {
      const uid = 'ktgvs_' + p.ID;
      const suaDuoc = coQuyenSuaTienDo(), xoaDuoc = coQuyenXoaTienDo();
      if (!suaDuoc && !xoaDuoc) {
        return `<div style="font-size:11px;color:#137333;margin-bottom:3px;">✔ ${escapeHtml(p.TenNhanVien)} (${fmtNumber(p.SoLuong)})</div>`;
      }
      return `<div class="ktgv-srow" data-pcmid="${p.ID}" style="display:flex;gap:4px;align-items:center;margin-bottom:4px;flex-wrap:wrap;background:#f1f8f1;border-radius:4px;padding:2px 3px;">
        <div style="flex:1;min-width:110px;">${searchableSelectHtml(uid, nhanVienMay, 'NhanVienID', x => x.HoTen, p.NhanVienID || '')}</div>
        <input type="number" min="0" class="ktgvs-sl" style="width:56px;" value="${p.SoLuong != null ? p.SoLuong : ''}">
        ${suaDuoc ? '<button type="button" class="btn small ktgvs-luu" title="Lưu sửa dòng này" style="padding:2px 6px;">💾</button>' : ''}
        ${xoaDuoc ? '<button type="button" class="btn small danger ktgvs-xoa" title="Xóa dòng đã giao" style="padding:2px 6px;">🗑️</button>' : ''}
      </div>`;
    }
    function ktGiaoViecCellHtml(congDoanMayId) {
      // "Da giao" doc lai tu phanCongMayList da co san (lich su TOAN BO PhanCongMay cua don hang, xem
      // dau openProgressForm) - loc dung theo CongDoanMayID cua dong nay, khong can goi API rieng.
      // v5.34c (muc 6): khoa theo dong "Đơn giá công đoạn may" MOI (DonGiaCongDoanMayID), khong con CongDoanMayID.
      const daGiao = phanCongMayList.filter(p => String(p.DonGiaCongDoanMayID) === String(congDoanMayId));
      const rows = ktGiaoViecByStage[congDoanMayId] || [];
      const daGiaoHtml = daGiao.length
        ? `<div class="ktgv-saved">${daGiao.map(ktGiaoViecSavedRowHtml).join('')}</div>` : '';
      return `<div data-ktgvcell="${congDoanMayId}">
        ${daGiaoHtml}
        <div class="ktgv-rows">${rows.map(r => ktGiaoViecMiniRowHtml(congDoanMayId, r)).join('')}</div>
        <button type="button" class="btn small secondary ktgv-add" style="font-size:11px;padding:2px 8px;">+ NV</button>
      </div>`;
    }
    function wireKtGiaoViecCell(cellEl, congDoanMayId) {
      function wireRow(rowEl) {
        const idx = rowEl.dataset.idx;
        const row = (ktGiaoViecByStage[congDoanMayId] || []).find(r => String(r.idx) === String(idx));
        wireSearchableSelect('ktgv_' + congDoanMayId + '_' + idx, nhanVienMay, 'NhanVienID', p => p.HoTen, (match) => {
          if (row) row.nhanVienId = match ? match.NhanVienID : '';
        });
        if (row) rowEl.querySelector('.ktgv-sl').addEventListener('input', (e) => { row.soLuong = e.target.value; });
        rowEl.querySelector('.ktgv-remove').addEventListener('click', () => {
          ktGiaoViecByStage[congDoanMayId] = (ktGiaoViecByStage[congDoanMayId] || []).filter(r => String(r.idx) !== String(idx));
          rowEl.remove();
        });
      }
      cellEl.querySelectorAll('[data-ktgvrow]').forEach(wireRow);
      /* v6.19: nối dây cho các dòng ĐÃ LƯU ngay trong ô này (sửa/xóa tại chỗ, không phải xuống bảng lịch
         sử). Gọi API sửa/xóa dòng PhanCongMay theo ID — 2 route đó từ v6.18 đã theo phân quyền. */
      cellEl.querySelectorAll('.ktgv-srow').forEach(srow => {
        const pcmId = srow.dataset.pcmid;
        const p = phanCongMayList.find(x => String(x.ID) === String(pcmId));
        wireSearchableSelect('ktgvs_' + pcmId, nhanVienMay, 'NhanVienID', x => x.HoTen);
        const bLuu = srow.querySelector('.ktgvs-luu');
        if (bLuu) bLuu.addEventListener('click', async () => {
          const nvId = getSearchableValue('ktgvs_' + pcmId);
          const sl = srow.querySelector('.ktgvs-sl').value;
          if (!nvId) { toast('Chưa chọn nhân viên cho dòng này.', 'error'); return; }
          try {
            await apiPut(`/api/qlsx/orders/${encodeURIComponent(maDH)}/phancongmay/${pcmId}`, { nhanVienId: nvId, soLuong: sl || 0 });
            if (p) { p.NhanVienID = nvId; p.SoLuong = Number(sl) || 0; const nv = nhanVienMay.find(x => String(x.NhanVienID) === String(nvId)); if (nv) p.TenNhanVien = nv.HoTen; }
            toast('Đã lưu lại dòng giao việc.', 'success');
            lamMoiBangLichSuMay();
          } catch (err) { toast(err.message, 'error'); }
        });
        const bXoa = srow.querySelector('.ktgvs-xoa');
        if (bXoa) bXoa.addEventListener('click', async () => {
          if (!confirm(`Xóa dòng đã giao cho "${p ? p.TenNhanVien : ''}" (${p ? fmtNumber(p.SoLuong) : ''})?\nLương khoán may của người này sẽ giảm tương ứng.`)) return;
          try {
            await apiDelete(`/api/qlsx/orders/${encodeURIComponent(maDH)}/phancongmay/${pcmId}`);
            phanCongMayList = phanCongMayList.filter(x => String(x.ID) !== String(pcmId));
            srow.remove();
            toast('Đã xóa dòng giao việc.', 'success');
            lamMoiBangLichSuMay();
          } catch (err) { toast(err.message, 'error'); }
        });
      });
      cellEl.querySelector('.ktgv-add').addEventListener('click', () => {
        const idx = ++ktGiaoVienIdx;
        if (!ktGiaoViecByStage[congDoanMayId]) ktGiaoViecByStage[congDoanMayId] = [];
        const row = { idx, nhanVienId: '', soLuong: '' };
        ktGiaoViecByStage[congDoanMayId].push(row);
        cellEl.querySelector('.ktgv-rows').insertAdjacentHTML('beforeend', ktGiaoViecMiniRowHtml(congDoanMayId, row));
        wireRow(cellEl.querySelector(`[data-ktgvrow][data-idx="${idx}"]`));
      });
    }
    // v5.7: them cot thu 5 "Nhân viên & SL" (ktGiaoViecCellHtml) + BAT BUOC ep khoang cach dong deu nhau
    // qua inline style (margin-bottom/padding-bottom/border-bottom co dinh, KHONG con dua vao CSS
    // ":last-child" nhu truoc) - fix loi "khi chọn thêm công đoạn nhảy lên 2 dòng khi chọn 1 công đoạn":
    // truoc day dong DUY NHAT (last-child) mat het margin/padding/border nen thap hon han so voi luc co
    // 2+ dong (dong dau khong con la last-child, bong nhien them lai ~21px) - dinh dang co dinh nay ap
    // dung NHU NHAU bat ke dang co bao nhieu dong, khong con do "nhay".
    // v5.13 (muc 1.2.1.3, yeu cau "Kỹ thuật... không cần hiện phần giao cho nhân viên (Nhà Làm), chỉ
    // thể hiện ở công đoạn May"): them tham so hideGiaoViec (mac dinh false/undefined, GIU NGUYEN hanh
    // vi cu) - Ky thuat goi voi true (an cot "Nhân viên & SL" + luoi 5 cot con 4 cot), May goi KHONG
    // tham so (van hien du nhu truoc, KHONG doi - xem renderMayCongDoanMayArea). Them/xoa/sua don gia/he
    // so cong doan may van hoat dong Y HET o ca 2 noi (khong bi anh huong boi tham so nay).
    function congDoanMayExistingRowsHtml(hideGiaoViec) {
      const cols = hideGiaoViec ? '1.5fr .8fr .8fr 26px' : '1.5fr .8fr .8fr 1.6fr 26px';
      // v5.16 (muc 2.1.1, yeu cau "có thể sửa công đoạn vừa thêm"): TenCongDoan gio la o go-tim SUA
      // DUOC (truoc day la <div> chi doc, chi Don gia/He so sua duoc) - danh sach goi y la TOAN BO danh
      // muc TRU cac dong DA chon o CAC dong KHAC (giu lai chinh dong nay de van hien dung lua chon hien
      // tai). Xem onResolve tuong ung trong wireCongDoanMayChon() - doi lua chon se lam moi ca
      // DonGia/HeSo theo mac dinh cua cong doan MOI (khong giu gia cu, tranh nham lan).
      return congDoanMayDaChon.map(c => {
        const optionsForRow = congDoanMayList.filter(x => String(x.CongDoanMayID) === String(c.CongDoanMayID) || !congDoanMayDaChon.some(y => String(y.CongDoanMayID) === String(x.CongDoanMayID)));
        return `<div class="row-item" data-cdmrow data-cdmid="${c.CongDoanMayID}" style="grid-template-columns:${cols};align-items:start;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--border);">
          <div>${searchableSelectHtml('cdmEdit_' + c.CongDoanMayID, optionsForRow, 'CongDoanMayID', x => x.TenCongDoan + (x.MaCongDoan ? ' (' + x.MaCongDoan + ')' : ''), c.CongDoanMayID)}</div>
          <div><label style="font-size:11px;color:#5f6368;display:block;">Đơn giá</label><input type="number" step="0.01" min="0" class="km-dongia" value="${c.DonGia ?? 0}"></div>
          <div><label style="font-size:11px;color:#5f6368;display:block;">Hệ số</label><input type="number" step="0.0001" min="0" class="km-heso" value="${c.HeSo ?? 1}"></div>
          ${hideGiaoViec ? '' : `<div><label style="font-size:11px;color:#5f6368;display:block;">Nhân viên &amp; SL</label>${ktGiaoViecCellHtml(c.CongDoanMayID)}</div>`}
          <div style="padding-top:6px;"><button type="button" class="btn small danger km-remove" data-id="${c.CongDoanMayID}">X</button></div>
        </div>`;
      }).join('') || '<div class="empty-hint" style="margin-bottom:10px;">Chưa chọn công đoạn may nào.</div>';
    }
    function congDoanMayChonHtml(hideGiaoViec) {
      if (!congDoanMayList.length) return '<div class="empty-hint">Chưa có danh mục công đoạn may (vào tab "Đơn giá công đoạn may" để khai báo).</div>';
      const conLai = congDoanMayList.filter(c => !congDoanMayDaChon.some(x => String(x.CongDoanMayID) === String(c.CongDoanMayID)));
      const cols = hideGiaoViec ? '1.5fr .8fr .8fr 26px' : '1.5fr .8fr .8fr 1.6fr 26px';
      return `<div class="row-repeater">
          <div class="row-item" style="grid-template-columns:${cols};font-weight:600;font-size:12px;color:#5f6368;">
            <div>Công đoạn may</div><div>Đơn giá (đơn này)</div><div>Hệ số</div>${hideGiaoViec ? '' : '<div>Nhân viên &amp; SL (Nhà Làm)</div>'}<div></div>
          </div>
          <div id="cdmBox">${congDoanMayExistingRowsHtml(hideGiaoViec)}</div>
        </div>
        <div class="form-row" style="margin-top:6px;"><label>+ Thêm công đoạn may (gõ để tìm)</label>
          <div style="display:flex;gap:4px;align-items:center;">
            <div style="flex:1;">${conLai.length ? searchableSelectHtml('cdmAdd', conLai, 'CongDoanMayID', c => c.TenCongDoan + (c.MaCongDoan ? ' (' + c.MaCongDoan + ')' : '')) : '<div class="empty-hint">Đã chọn hết toàn bộ danh mục công đoạn may.</div>'}</div>
            <!-- v5.16 (muc 2.1.4): "+ Mới" them nhanh cong doan may CHUA CO trong danh muc, giong het
                 pattern addLoaiVaiInline o Ra lenh SX (xem wireCongDoanMayChon). -->
            <button type="button" class="btn small secondary cdm-addnew" title="Thêm công đoạn may mới vào danh mục">+ Mới</button>
          </div>
        </div>
        <!-- v5.16 (muc 2.1.2): "Lưu công đoạn" - luu ngay danh sach da chon, doc lap voi nut Gửi chinh
             cua form Ghi nhan tien do, cung pattern voi "Lưu nhà gia công"/"Lưu sơ đồ" da co. -->
        <div style="margin-top:8px;"><button type="button" class="btn small" id="btnSaveCongDoanMay">💾 Lưu công đoạn</button></div>`;
    }
    function wireCongDoanMayChon(renderAreaFn) {
      const cdmBox = modal.querySelector('#cdmBox');
      if (!cdmBox) return;
      // v5.7: dong bo NGAY .km-dongia/.km-heso nguoi dung dang go vao state congDoanMayDaChon (truoc day
      // CHI doc luc render, khong bao gio ghi nguoc) - fix loi "chọn công đoạn tiếp theo phải nhập liệu
      // lại từ đầu": moi lan them/bot 1 dong, renderAreaFn ve lai TOAN BO khu vuc tu DUNG state cu, xoa
      // mat gia tri vua go nhung CHUA kip ghi vao state truoc do.
      cdmBox.querySelectorAll('[data-cdmrow]').forEach(rowEl => {
        const id = rowEl.dataset.cdmid;
        const entry = congDoanMayDaChon.find(c => String(c.CongDoanMayID) === String(id));
        if (entry) {
          rowEl.querySelector('.km-dongia').addEventListener('input', (e) => { entry.DonGia = e.target.value; });
          rowEl.querySelector('.km-heso').addEventListener('input', (e) => { entry.HeSo = e.target.value; });
          // v5.16 (muc 2.1.1): doi lua chon cong doan CUA DONG NAY - lam moi TOAN BO nhan dang
          // (CongDoanMayID/TenCongDoan/MaCongDoan) + gia/he so ve MAC DINH cua cong doan MOI.
          const optionsForRow = congDoanMayList.filter(x => String(x.CongDoanMayID) === String(id) || !congDoanMayDaChon.some(y => String(y.CongDoanMayID) === String(x.CongDoanMayID)));
          wireSearchableSelect('cdmEdit_' + id, optionsForRow, 'CongDoanMayID', x => x.TenCongDoan + (x.MaCongDoan ? ' (' + x.MaCongDoan + ')' : ''), (match) => {
            if (!match || String(match.CongDoanMayID) === String(entry.CongDoanMayID)) return;
            if (congDoanMayDaChon.some(c => c !== entry && String(c.CongDoanMayID) === String(match.CongDoanMayID))) {
              toast('Công đoạn này đã được chọn ở dòng khác.', 'error');
              setTimeout(() => renderAreaFn(), 0);
              return;
            }
            entry.CongDoanMayID = match.CongDoanMayID;
            entry.TenCongDoan = match.TenCongDoan;
            entry.MaCongDoan = match.MaCongDoan;
            entry.DonGia = match.DonGia ?? 0;
            entry.HeSo = match.HeSo ?? 1;
            setTimeout(() => renderAreaFn(), 0);
          });
        }
        const ktgvCell = rowEl.querySelector('[data-ktgvcell]');
        if (ktgvCell) wireKtGiaoViecCell(ktgvCell, id);
      });
      cdmBox.querySelectorAll('.km-remove').forEach(btn => btn.addEventListener('click', () => {
        congDoanMayDaChon = congDoanMayDaChon.filter(c => String(c.CongDoanMayID) !== String(btn.dataset.id));
        // v5.7: hoan render sang tick sau (setTimeout 0) - xem giai thich chi tiet o onResolve ben duoi
        // (cung 1 nguyen nhan/cung 1 huong fix cho loi UNIQUE KEY khi luu cong doan may).
        setTimeout(() => renderAreaFn(), 0);
      }));
      if (modal.querySelector('#cdmAdd_text')) {
        const conLai = congDoanMayList.filter(c => !congDoanMayDaChon.some(x => String(x.CongDoanMayID) === String(c.CongDoanMayID)));
        wireSearchableSelect('cdmAdd', conLai, 'CongDoanMayID', c => c.TenCongDoan + (c.MaCongDoan ? ' (' + c.MaCongDoan + ')' : ''), (match) => {
          if (!match) return;
          // v5.7: chan THEM TRUNG (fix goc loi "Violation of UNIQUE KEY constraint 'UQ_DonHangCongDoanMay'"
          // khi luu cong doan may) - phong truong hop hiem o go-tim tu ban phat sinh THEM 1 su kien cho
          // CUNG 1 lan chon (xem giai thich chi tiet trong HUONG_DAN_CAI_DAT.md). Day la lop chan o STATE,
          // doc lap voi lop chan them o backend (PUT /congdoanmay da them de-dup + transaction).
          if (congDoanMayDaChon.some(c => String(c.CongDoanMayID) === String(match.CongDoanMayID))) return;
          congDoanMayDaChon = [...congDoanMayDaChon, { CongDoanMayID: match.CongDoanMayID, TenCongDoan: match.TenCongDoan, MaCongDoan: match.MaCongDoan, DonGia: match.DonGia ?? 0, HeSo: match.HeSo ?? 1 }];
          // v5.7: hoan render sang tick SAU (setTimeout 0) thay vi goi renderAreaFn() NGAY LAP TUC trong
          // luc con dang xu ly su kien input/change cua chinh o tim kiem vua chon - day la nguyen nhan
          // GOC cua loi UNIQUE KEY khi luu: go 1 node dang duoc trinh duyet xu ly du lieu (focus, gia tri
          // vua doi) NGAY GIUA luc no dang phat su kien khien trinh duyet tu phat sinh THEM 1 su kien
          // 'change' de "chot" gia tri truoc khi node bi go khoi DOM - su kien phu nay goi lai CHINH
          // onResolve() lan 2 cho CUNG 1 lan chon, day trung CongDoanMayID vao mang state. Doi 1 tick
          // (setTimeout 0) de su kien hien tai xu ly xong HOAN TOAN roi moi go/ve lai DOM.
          setTimeout(() => renderAreaFn(), 0);
        });
      }
      // v5.16 (muc 2.1.4): "+ Mới" them nhanh 1 cong doan may MOI vao danh muc chung (giong
      // addLoaiVaiInline). Khac addLoaiVaiInline o cho: chon-la-them-luon cho don hang nay NGAY (khong
      // chi dien vao o tim cho roi cho nguoi dung tu chon lai) - vi ngu canh o day la "dang chon cong
      // doan cho don hang", nen tao xong la coi nhu da chon.
      const addNewBtn = modal.querySelector('.cdm-addnew');
      if (addNewBtn) addNewBtn.addEventListener('click', async () => {
        const ten = prompt('Tên công đoạn may mới:');
        if (!ten || !ten.trim()) return;
        try {
          const res = await apiPost('/api/qlsx/macongdoan', { tenCongDoan: ten.trim() });
          congDoanMayList.push(res.data);
          if (!congDoanMayDaChon.some(c => String(c.CongDoanMayID) === String(res.data.CongDoanMayID))) {
            congDoanMayDaChon = [...congDoanMayDaChon, { CongDoanMayID: res.data.CongDoanMayID, TenCongDoan: res.data.TenCongDoan, MaCongDoan: res.data.MaCongDoan, DonGia: res.data.DonGia ?? 0, HeSo: res.data.HeSo ?? 1 }];
          }
          toast('Đã thêm công đoạn "' + res.data.TenCongDoan + '".', 'success');
          renderAreaFn();
        } catch (err) { toast(err.message, 'error'); }
      });
      // v5.16 (muc 2.1.2): "Lưu công đoạn" - doc THANG tu state congDoanMayDaChon (da dong bo qua cac
      // listener .km-dongia/.km-heso/cdmEdit_ o tren nen luon la gia tri MOI NHAT tren man hinh), luu
      // NGAY qua PUT /congdoanmay - KHONG cho nguoi dung phai bam "Gửi" ca form moi luu duoc.
      const btnSaveCdm = modal.querySelector('#btnSaveCongDoanMay');
      if (btnSaveCdm) btnSaveCdm.addEventListener('click', async () => {
        const cdmItems = congDoanMayDaChon.map(c => ({ congDoanMayId: c.CongDoanMayID, donGia: c.DonGia, heSo: c.HeSo }));
        try {
          await apiPut(`/api/qlsx/orders/${maDH}/congdoanmay`, { items: cdmItems });
          toast('Đã lưu công đoạn may.', 'success');
        } catch (err) { toast('Lỗi khi lưu công đoạn may: ' + err.message, 'error'); }
      });
    }
    // v5.24 (muc 1.1.1, "thêm trường đơn giá Giao gia công. Thêm nhiều dòng đơn giá" - theo lam ro cua
    // nguoi dung: "Danh mục hạng mục gia công (giống công đoạn may)"): mirror dung congDoanMayChonHtml()/
    // wireCongDoanMayChon() o tren, bo cot "Nhân viên & SL" (khong ap dung - viec giao nhan vien VAN CHI
    // o cong doan May, khong doi tu v5.23, xac nhan qua cau hoi lam ro). Day la 1 khai bao GIA THAM KHAO/
    // KE HOACH rieng o Ky thuat cho hang muc gia cong, DOC LAP voi "Nhà gia công chi tiết" (chon TUNG NHA
    // + gia + SL rieng, nhap tai cong doan 'GC') - 2 co che khong lien ket voi nhau.
    function hangMucGiaCongExistingRowsHtml() {
      return hangMucGiaCongDaChon.map(c => {
        const optionsForRow = hangMucGiaCongList.filter(x => String(x.HangMucGiaCongID) === String(c.HangMucGiaCongID) || !hangMucGiaCongDaChon.some(y => String(y.HangMucGiaCongID) === String(x.HangMucGiaCongID)));
        return `<div class="row-item" data-hmgcrow data-hmgcid="${c.HangMucGiaCongID}" style="grid-template-columns:1.5fr .8fr 26px;align-items:start;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--border);">
          <div>${searchableSelectHtml('hmgcEdit_' + c.HangMucGiaCongID, optionsForRow, 'HangMucGiaCongID', x => x.TenHangMuc, c.HangMucGiaCongID)}</div>
          <div><label style="font-size:11px;color:#5f6368;display:block;">Đơn giá</label><input type="number" step="0.01" min="0" class="hmgc-dongia" value="${c.DonGia ?? 0}"></div>
          <div style="padding-top:6px;"><button type="button" class="btn small danger hmgc-remove" data-id="${c.HangMucGiaCongID}">X</button></div>
        </div>`;   // v5.30: bo cot "Hệ số" (yeu cau muc 1) - don gia gia cong khong con he so
      }).join('') || '<div class="empty-hint" style="margin-bottom:10px;">Chưa chọn hạng mục gia công nào.</div>';
    }
    // v5.25 (phan hoi truc tiep, sua bug that su - trang thai truoc do KHONG THE nao tao duoc hang muc
    // DAU TIEN vi ham nay return SOM khi danh sach rong, nut "+ Mới" nam SAU doan return do nen khong
    // bao gio duoc ve): bo han nhanh return-som khi hangMucGiaCongList rong - "+ Mới" gio LUON hien duoc,
    // ke ca lan dau tien chua co hang muc nao trong toan he thong (khong con phu thuoc man hinh danh muc
    // rieng nao - da bi xoa, xem getTabs()).
    function hangMucGiaCongChonHtml() {
      const conLai = hangMucGiaCongList.filter(c => !hangMucGiaCongDaChon.some(x => String(x.HangMucGiaCongID) === String(c.HangMucGiaCongID)));
      const oTimHtml = conLai.length
        ? searchableSelectHtml('hmgcAdd', conLai, 'HangMucGiaCongID', c => c.TenHangMuc)
        : `<div class="empty-hint">${hangMucGiaCongList.length ? 'Đã chọn hết toàn bộ danh mục hạng mục gia công.' : 'Chưa có hạng mục gia công nào — bấm "+ Mới" để thêm.'}</div>`;
      return `<div class="row-repeater">
          <div class="row-item" style="grid-template-columns:1.5fr .8fr 26px;font-weight:600;font-size:12px;color:#5f6368;">
            <div>Hạng mục gia công</div><div>Đơn giá (đơn này)</div><div></div>
          </div>
          <div id="hmgcBox">${hangMucGiaCongExistingRowsHtml()}</div>
        </div>
        <div class="form-row" style="margin-top:6px;"><label>+ Thêm hạng mục gia công (gõ để tìm, hoặc bấm "+ Mới" nếu chưa có trong danh mục)</label>
          <div style="display:flex;gap:4px;align-items:center;">
            <div style="flex:1;">${oTimHtml}</div>
            <button type="button" class="btn small secondary hmgc-addnew" title="Thêm hạng mục gia công mới">+ Mới</button>
          </div>
        </div>
        <div style="margin-top:8px;"><button type="button" class="btn small" id="btnSaveHangMucGiaCong">💾 Lưu đơn giá gia công</button></div>`;
    }
    function wireHangMucGiaCongChon(renderAreaFn) {
      const hmgcBox = modal.querySelector('#hmgcBox');
      if (!hmgcBox) return;
      hmgcBox.querySelectorAll('[data-hmgcrow]').forEach(rowEl => {
        const id = rowEl.dataset.hmgcid;
        const entry = hangMucGiaCongDaChon.find(c => String(c.HangMucGiaCongID) === String(id));
        if (entry) {
          rowEl.querySelector('.hmgc-dongia').addEventListener('input', (e) => { entry.DonGia = e.target.value; });
          const optionsForRow = hangMucGiaCongList.filter(x => String(x.HangMucGiaCongID) === String(id) || !hangMucGiaCongDaChon.some(y => String(y.HangMucGiaCongID) === String(x.HangMucGiaCongID)));
          wireSearchableSelect('hmgcEdit_' + id, optionsForRow, 'HangMucGiaCongID', x => x.TenHangMuc, (match) => {
            if (!match || String(match.HangMucGiaCongID) === String(entry.HangMucGiaCongID)) return;
            if (hangMucGiaCongDaChon.some(c => c !== entry && String(c.HangMucGiaCongID) === String(match.HangMucGiaCongID))) {
              toast('Hạng mục này đã được chọn ở dòng khác.', 'error');
              setTimeout(() => renderAreaFn(), 0);
              return;
            }
            entry.HangMucGiaCongID = match.HangMucGiaCongID;
            entry.TenHangMuc = match.TenHangMuc;
            entry.DonGia = match.DonGia ?? 0;
            entry.HeSo = match.HeSo ?? 1;
            setTimeout(() => renderAreaFn(), 0);
          });
        }
      });
      hmgcBox.querySelectorAll('.hmgc-remove').forEach(btn => btn.addEventListener('click', () => {
        hangMucGiaCongDaChon = hangMucGiaCongDaChon.filter(c => String(c.HangMucGiaCongID) !== String(btn.dataset.id));
        // v5.24: hoan render sang tick sau (setTimeout 0), cung ly do voi wireCongDoanMayChon o tren
        // (tranh loi UNIQUE KEY tu su kien 'change' phu sinh khi go node dang duoc trinh duyet xu ly).
        setTimeout(() => renderAreaFn(), 0);
      }));
      if (modal.querySelector('#hmgcAdd_text')) {
        const conLai = hangMucGiaCongList.filter(c => !hangMucGiaCongDaChon.some(x => String(x.HangMucGiaCongID) === String(c.HangMucGiaCongID)));
        wireSearchableSelect('hmgcAdd', conLai, 'HangMucGiaCongID', c => c.TenHangMuc, (match) => {
          if (!match) return;
          if (hangMucGiaCongDaChon.some(c => String(c.HangMucGiaCongID) === String(match.HangMucGiaCongID))) return;
          hangMucGiaCongDaChon = [...hangMucGiaCongDaChon, { HangMucGiaCongID: match.HangMucGiaCongID, TenHangMuc: match.TenHangMuc, DonGia: match.DonGia ?? 0, HeSo: match.HeSo ?? 1 }];
          setTimeout(() => renderAreaFn(), 0);
        });
      }
      const addNewBtn = modal.querySelector('.hmgc-addnew');
      if (addNewBtn) addNewBtn.addEventListener('click', async () => {
        const ten = prompt('Tên hạng mục gia công mới:');
        if (!ten || !ten.trim()) return;
        try {
          const res = await apiPost('/api/qlsx/hangmucgiacong', { tenHangMuc: ten.trim() });
          hangMucGiaCongList.push(res.data);
          if (!hangMucGiaCongDaChon.some(c => String(c.HangMucGiaCongID) === String(res.data.HangMucGiaCongID))) {
            hangMucGiaCongDaChon = [...hangMucGiaCongDaChon, { HangMucGiaCongID: res.data.HangMucGiaCongID, TenHangMuc: res.data.TenHangMuc, DonGia: res.data.DonGiaMacDinh ?? 0, HeSo: res.data.HeSoMacDinh ?? 1 }];
          }
          toast('Đã thêm hạng mục "' + res.data.TenHangMuc + '".', 'success');
          renderAreaFn();
        } catch (err) { toast(err.message, 'error'); }
      });
      const btnSaveHmgc = modal.querySelector('#btnSaveHangMucGiaCong');
      if (btnSaveHmgc) btnSaveHmgc.addEventListener('click', async () => {
        const hmgcItems = hangMucGiaCongDaChon.map(c => ({ hangMucGiaCongId: c.HangMucGiaCongID, donGia: c.DonGia }));   // v5.30: bo heSo
        try {
          await apiPut(`/api/qlsx/orders/${maDH}/hangmucgiacong`, { items: hmgcItems });
          toast('Đã lưu đơn giá gia công.', 'success');
        } catch (err) { toast('Lỗi khi lưu đơn giá gia công: ' + err.message, 'error'); }
      });
    }
    // v5.23 (yeu cau "hiển thị đơn giá từ công đoạn kỹ thuật đã nhập"): ban CHI DOC cho cong doan May -
    // thay the hoan toan congDoanMayChonHtml() (bang SUA duoc, gom ca chon/them/xoa cong doan may + gia/
    // he so) tung dung o May tu v5.8.1. Chon/sua/them/xoa cong doan may + don gia/he so gio la VIEC RIENG
    // cua Ky thuat (renderStageFields('KT')) - May chi HIEN THI LAI (tham khao, KHONG sua duoc) dung
    // NHUNG GI Ky thuat da luu, CHI con cot "Nhân viên & SL" (ktGiaoViecCellHtml/wireKtGiaoViecCell,
    // KHONG doi gi) la sua duoc - dung tinh than "Ky thuat QUYET DINH gia, May THUC THI giao viec".
    // v5.34c (Giai doan C, muc 6): cong doan may lay tu "Đơn giá công đoạn may" MOI (Tai lieu may). Moi dong
    // dinh danh bang DgmID (= DonHangDonGiaCongDoanMay.ID); don gia mot cai = ThanhTien (Giay gio x He so CD x
    // He so CN). Chi hien Thanh tien/cai (read-only) + Nhan vien & SL (edit). Khong con cot He so rieng.
    function congDoanMayReadonlyHtml() {
      if (!congDoanMayDaChon.length) return '<div class="empty-hint">Đơn hàng chưa có "Đơn giá công đoạn may" nào (khai ở "Tài liệu may/Đóng gói").</div>';
      const rowsHtml = congDoanMayDaChon.map(c => `<div class="row-item" data-cdmrow data-cdmid="${c.DgmID}" style="grid-template-columns:1.6fr 1fr 1.8fr;align-items:start;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--border);">
          <div>${escapeHtml(c.TenCongDoan)}</div>
          <div><label style="font-size:11px;color:#5f6368;display:block;">Thành tiền/cái</label><div class="readonly-fact">${fmtNumber(c.DonGia || 0)}</div></div>
          <div><label style="font-size:11px;color:#5f6368;display:block;">Nhân viên &amp; SL</label>${ktGiaoViecCellHtml(c.DgmID)}</div>
        </div>`).join('');
      return `<div class="row-repeater">
          <div class="row-item" style="grid-template-columns:1.6fr 1fr 1.8fr;font-weight:600;font-size:12px;color:#5f6368;">
            <div>Công đoạn may</div><div>Thành tiền/cái (Tài liệu may)</div><div>Nhân viên &amp; SL</div>
          </div>
          <div id="mayCdmBox">${rowsHtml}</div>
        </div>`;
    }
    function wireCongDoanMayReadonly() {
      const cdmBox = modal.querySelector('#mayCdmBox');
      if (!cdmBox) return;
      cdmBox.querySelectorAll('[data-cdmrow]').forEach(rowEl => {
        const ktgvCell = rowEl.querySelector('[data-ktgvcell]');
        if (ktgvCell) wireKtGiaoViecCell(ktgvCell, rowEl.dataset.cdmid);
      });
    }
    // v5.5: liet ke lai TOAN BO "Giao viec noi bo" (PhanCongMay) da tung ghi nhan cho don hang nay
    // (qua nhieu lan Ghi tien do May, khong chi lan gan nhat) - truoc day form nay chi GHI MOI, chua
    // bao gio doc/hien lai duoc gi da giao (xem GET /orders/:maDH/phancongmay). Nut "Sua" CHI hien
    // voi Admin (yeu cau v5.5: "Quyen Admin co the sua ten nhan vien va so luong da giao"), sua NGAY
    // TAI DONG (khong mo modal rieng - modal cua app nay THAY THE chu khong CHONG modal dang mo).
    function phanCongMayExistingTableHtml() {
      if (!phanCongMayList.length) return '<div class="empty-hint">Chưa giao việc nội bộ nào cho đơn hàng này.</div>';
      // v5.6: p.TenMau co the rong (mau khong con bat buoc chon o dong giao viec - xem giaoViecRowHtml)
      // - hien "-" thay vi de trong mo ho.
      const rowsHtml = phanCongMayList.map((p, __i) => `<tr data-pcmrow data-id="${p.ID}">
          <td style="text-align:center;">${__i + 1}</td>
          <td>${fmtDate(p.NgayGhiNhan)}</td><td class="pcm-nv">${escapeHtml(p.TenNhanVien)}</td>
          <td>${escapeHtml(p.TenCongDoan || '')}</td><td>${escapeHtml(p.TenMau || '-')}</td><td class="pcm-sl">${fmtNumber(p.SoLuong)}</td>
          ${/* v6.18: nút Sửa/Xóa theo QUYỀN của chức năng "Ghi nhận tiến độ" (trước là cứng Admin-only nên
               không phân quyền được). Backend cũng đã đổi sang requirePermission edit/delete. */''}
          <td>${coQuyenSuaTienDo() ? `<button type="button" class="btn small secondary pcm-edit" data-id="${p.ID}">Sửa</button> ` : ''}${coQuyenXoaTienDo() ? `<button type="button" class="btn small danger pcm-del" data-id="${p.ID}">Xóa</button>` : ''}</td>
        </tr>`).join('');
      const table = `<table><thead><tr><th style="width:38px;">STT</th><th>Ngày</th><th>Nhân viên</th><th>Công đoạn may</th><th>Màu</th><th>SL</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
      return phanCongMayList.length > 7 ? `<div style="max-height:260px;overflow-y:auto;">${table}</div>` : table;
    }
    function wirePhanCongMayEdit(box) {
      if (!coQuyenSuaTienDo() && !coQuyenXoaTienDo()) return;   // v6.18
      box.querySelectorAll('.pcm-edit').forEach(btn => btn.addEventListener('click', () => {
        const tr = btn.closest('[data-pcmrow]');
        const row = phanCongMayList.find(p => String(p.ID) === btn.dataset.id);
        if (!row || !tr) return;
        tr.querySelector('.pcm-nv').innerHTML = `<select class="pcm-edit-nv">${opt(nhanVienMay, 'NhanVienID', 'HoTen', row.NhanVienID)}</select>`;
        tr.querySelector('.pcm-sl').innerHTML = `<input type="number" min="0" class="pcm-edit-sl" value="${row.SoLuong}" style="width:70px;">`;
        btn.outerHTML = `<button type="button" class="btn small pcm-save" data-id="${row.ID}">Lưu</button>`;
        tr.querySelector('.pcm-save').addEventListener('click', async () => {
          try {
            await apiPut(`/api/qlsx/orders/${maDH}/phancongmay/${row.ID}`, {
              nhanVienId: tr.querySelector('.pcm-edit-nv').value,
              soLuong: tr.querySelector('.pcm-edit-sl').value
            });
            toast('Đã lưu.', 'success');
            const fresh = await apiGet(`/api/qlsx/orders/${maDH}/phancongmay`);
            phanCongMayList = fresh.data || [];
            renderStageFields('May');
          } catch (err) { toast(err.message, 'error'); }
        });
      }));
      // v5.30 (muc 4): nut "Xóa" canh "Sửa" (Admin) - xoa han 1 dong giao viec noi bo da ghi nhan.
      box.querySelectorAll('.pcm-del').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Xóa dòng giao việc nội bộ này?')) return;
        try {
          await apiDelete(`/api/qlsx/orders/${maDH}/phancongmay/${btn.dataset.id}`);
          phanCongMayList = phanCongMayList.filter(p => String(p.ID) !== String(btn.dataset.id));
          toast('Đã xóa.', 'success'); renderStageFields('May');
        } catch (err) { toast(err.message, 'error'); }
      }));
    }

    // v5.8.1 (ban dau - "y nguyên bảng ở công đoạn Kỹ Thuật"): bang "Cong doan may da chon" o CONG ĐOẠN
    // MAY tung dung LAI Y NGUYEN congDoanMayChonHtml()/wireCongDoanMayChon() (sua duoc gia/he so/them/xoa,
    // y het Ky thuat). v5.23 (yeu cau "hiển thị đơn giá từ công đoạn kỹ thuật đã nhập"): DAO NGUOC quyet
    // dinh nay - May gio dung congDoanMayReadonlyHtml()/wireCongDoanMayReadonly() (CHI DOC gia/he so, chi
    // "Nhân viên & SL" con sua duoc) - xem 2 ham do dinh nghia ngay sau wireCongDoanMayChon(), va
    // renderStageFields('MAY') + submit handler ben duoi.

    // v5.0: 1 dong = 1 cay vai da duoc "Giao vai san xuat" cho don hang nay. STT cay goi y theo thu tu
    // A, B, C... nguoi dung co the sua lai. SL cai = SL lop * he so quy doi, tinh truc tiep tren trinh
    // duyet de hien thi ngay (gia tri thuc gui len server tinh lai 1 lan nua cho chac).
    // v5.2: them tieu de (label) ro rang cho tung o + cot "KG/mét đã dùng".
    // v5.13 (muc 1.2.2.2, yeu cau "Trường hệ số không cần nhập lấy luôn từ công đoạn Ra lệnh sx"): bo o
    // nhap ".cat-heso" tung dong, thay bang hien THAM KHAO he so DUY NHAT cua don hang (heSoQuyDoiDonHang,
    // khai bao o Ra lenh SX - xem const o dau openProgressForm) - moi cay vai dung CHUNG 1 he so, khong
    // con nhap/sua duoc tai day. recalcRow()/recalcTotal() (wireCatCayRows ben duoi) doi theo.
    // v5.18 (muc 1.2.2/1.2.3): bo cong doan "Giao vải" (GV) khoi Ghi nhan tien do (xem tinhNextStage()
    // o qlsx.js) - da xoa renderGiaoVaiBox/gvExistingRowsHtml/gvAddRowHtml/wireGiaoVaiBox (dead code sau
    // khi GV khong con trong danh sach cong doan chon duoc - xem `stages` o dau openProgressForm). Cay
    // vai cho cong doan "Cắt" gio lay tu giaoVaiList = detail.giaoVai, nhung BAN THAN detail.giaoVai o
    // backend da doi nguon sang Phieu xuat kho vai THAT (getVaiCayDaXuatChoDon() trong qlsx.js) thay vi
    // GiaoVaiSanXuat "giao tam" - ten bien giu nguyen de it thay doi nhat, chi y nghia du lieu da doi.
    //
    // v5.18 (muc 1.2.3, yeu cau "cho phép chọn cây vải được xuất cho đơn hàng đó để cho vào sơ đồ đó...
    // hiện tại đang hiện sẵn cây vải được xuất vào đơn hàng"): THAY viec map TOAN BO giaoVaiList thanh 1
    // dong co san moi lan render (van hien HET moi cay, du dung hay khong dung so do dang nhap) bang 1 co
    // che THEM tung dong TUONG MINH - nguoi dung tu chon dung cay (trong so cay DA XUAT that cho don
    // hang) can dua vao, giong pattern "Giao vai" cu vua bi go (searchableSelectHtml + nut "+ Thêm dòng")
    // thay vi 1 danh sach tinh luon hien HET moi cay.
    function labelForGiaoVai(r) {
      const ngay = r.NgayGiao ? `, xuất ${fmtDate(r.NgayGiao)}` : '';
      return `${r.MaCay} — ${r.TenLoaiVai || ''} ${r.TenMau || ''} (đã xuất ${fmtNumber(r.KGGiao)} KG${ngay})`;
    }
    let catPickIdx = 0;
    /* v6.01 — GIẬT CẤP: cột SL cái cắt giật cấp của từng cây/bàn cắt. Mặc định KHÔNG hiện (đa số bàn cắt
       không giật cấp); tick "Có cắt giật cấp" mới hiện cột. Giật cấp KHÔNG cộng vào số lớp — chỉ cộng vào
       TỔNG SL CÁI của bàn cắt (nên nó nằm ngoài mọi phép tính theo lớp: bảng kê BTP và lương trải vải cắt
       KHÔNG đổi). Bỏ tick thì xóa luôn số đã gõ để không âm thầm gửi lên số đang bị ẩn. */
    let catCoGiatCap = false;
    /* Ẩn 1 ô trong grid bằng display:none làm các ô SAU đó nhận sai bề rộng cột (ô Ảnh cần 120px sẽ tụt
       xuống 90px, hộp chọn file bị tràn) → phải đổi luôn grid-template-columns của từng dòng theo trạng
       thái tick, chứ không chỉ ẩn ô. Bỏ tick = trở về ĐÚNG bố cục cũ trước v6.01. */
    const CAT_COT_CO_GC = '2fr 70px 90px 90px 85px 110px 90px 120px auto';
    const CAT_COT_KHONG_GC = '2fr 70px 90px 90px 110px 90px 120px auto';
    function catGiatCapToggleHtml(id) {
      return `<label class="chk-item" style="font-weight:normal;margin:4px 0;">
        <input type="checkbox" class="cat-gc-toggle" id="${id}" ${catCoGiatCap ? 'checked' : ''}>
        Có cắt giật cấp (ghi số CÁI — không tính vào số lớp)</label>`;
    }
    function wireGiatCapToggle(scopeEl, recalcFn) {
      const chk = scopeEl.querySelector('.cat-gc-toggle');
      if (!chk) return;
      const apDung = () => {
        catCoGiatCap = chk.checked;
        scopeEl.querySelectorAll('.gc-cell').forEach(el => { el.style.display = catCoGiatCap ? '' : 'none'; });
        scopeEl.querySelectorAll('[data-catpickrow]').forEach(r => { r.style.gridTemplateColumns = catCoGiatCap ? CAT_COT_CO_GC : CAT_COT_KHONG_GC; });
        if (!catCoGiatCap) {
          let coSo = false;
          scopeEl.querySelectorAll('.cat-giatcap').forEach(i => { if (Number(i.value) > 0) coSo = true; i.value = ''; });
          if (coSo) toast('Đã bỏ cột giật cấp — số cái giật cấp đã gõ được xóa.', 'success');
        }
        if (recalcFn) recalcFn();
      };
      chk.addEventListener('change', apDung);
      apDung();
    }
    // v5.42: ẩn cây vải ĐÃ CHỌN ở picker khác khỏi danh sách của picker hiện tại (không cho chọn trùng).
    // Quét mọi picker đang hiển thị (form phẳng / sơ đồ đang mở) + cây đã chọn ở sơ đồ KHÁC
    // (catCrossSoDoChosen do renderCatMultiSoDo cấp; form phẳng để mặc định rỗng). Giữ lại cây của
    // CHÍNH picker đó để không tự loại bỏ giá trị đang chọn.
    let catCrossSoDoChosen = () => [];
    function catChosenExcept(selfId) {
      const set = new Set();
      modal.querySelectorAll('[data-catpickrow]').forEach(rowEl => {
        const id = 'catpick_' + rowEl.dataset.idx;
        if (id === selfId) return;
        const v = getSearchableValue(id);
        if (v) set.add(String(v));
      });
      (catCrossSoDoChosen() || []).forEach(v => { if (v) set.add(String(v)); });
      return set;
    }
    function catAvailListFor(selfId) {
      const chosen = catChosenExcept(selfId);
      const own = String(getSearchableValue(selfId) || '');
      return giaoVaiList.filter(c => { const idc = String(c.CayID); return idc === own || !chosen.has(idc); });
    }
    function catPickRowHtml(pre) {
      const p = pre || {};
      const idx = ++catPickIdx;
      /* v5.87: thêm ô CHỤP/TẢI ẢNH cho TỪNG CÂY VẢI. `capture="environment"` -> điện thoại mở thẳng
         camera sau; máy tính vẫn là hộp chọn file bình thường. Ảnh tải lên ngay khi chọn, chỉ giữ lại
         ĐƯỜNG DẪN trong ô ẩn .cat-anh (đọc lúc Gửi). */
      return `<div class="row-item" style="grid-template-columns:${catCoGiatCap ? CAT_COT_CO_GC : CAT_COT_KHONG_GC};" data-catpickrow data-idx="${idx}">
          <div class="form-row"><label>Cây vải (đã xuất cho đơn)</label>${searchableSelectHtml('catpick_' + idx, giaoVaiList, 'CayID', labelForGiaoVai, p.cayId || '')}</div>
          <div class="form-row"><label>STT</label><input type="text" class="cat-stt" value="${escapeHtml(p.sttCay || '')}"></div>
          <div class="form-row"><label>SL lớp</label><input type="number" min="0" class="cat-lop" value="${p.soLuongLop || ''}"></div>
          ${/* v6.08: HỆ SỐ SỬA ĐƯỢC ngay tại dòng (trước là ô chỉ đọc lấy từ Ra lệnh SX — v5.13 đã bỏ ô nhập
               này, nay mở lại theo yêu cầu). Mặc định vẫn là hệ số của đơn; sửa dòng nào chỉ ảnh hưởng SL
               cái của DÒNG ĐÓ. Bảng TienDoCatChiTietCay vốn đã có cột HeSoQuyDoi riêng từng cây nên không
               cần đổi CSDL. Bỏ trống / nhập ≤ 0 -> máy chủ tự dùng lại hệ số của đơn. */''}
          <div class="form-row"><label>Hệ số (sửa được)</label>
            <input type="number" min="0" step="0.001" class="cat-heso" value="${p.heSoQuyDoi || heSoQuyDoiDonHang}" title="Mặc định lấy từ Ra lệnh SX (${fmtNumber(heSoQuyDoiDonHang)}) — sửa được cho riêng dòng này"></div>
          ${/* v6.01: cột giật cấp — ẩn/hiện theo ô tick "Có cắt giật cấp" (xem wireGiatCapToggle). */''}
          <div class="form-row gc-cell" style="${catCoGiatCap ? '' : 'display:none;'}"><label>Giật cấp (cái)</label><input type="number" min="0" class="cat-giatcap" value="${p.soCaiGiatCap || ''}"></div>
          <div class="form-row"><label>KG/mét đã dùng</label><input type="number" min="0" step="0.01" class="cat-kgmet" value="${p.kgMetSuDung || ''}"></div>
          <div class="form-row"><label>SL cái</label><div class="readonly-fact cat-cai-val">0</div></div>
          <div class="form-row"><label>Ảnh cây vải</label>
            <input type="hidden" class="cat-anh" value="${escapeHtml(p.anhCay || '')}">
            <input type="file" accept="image/*" capture="environment" class="cat-anh-file" style="font-size:11px;max-width:118px;">
            <div class="cat-anh-xem" style="margin-top:3px;">${p.anhCay ? `<a href="${escapeHtml(p.anhCay)}" target="_blank"><img src="${escapeHtml(p.anhCay)}" style="width:46px;height:46px;object-fit:cover;border-radius:4px;"></a>` : ''}</div>
          </div>
          <div class="form-row"><button type="button" class="btn small danger catpick-remove">X</button></div>
        </div>`;
    }
    // 1 dong: gan searchable-select (chon cay trong giaoVaiList) + tinh lai SL cai khi go SL lop + nut
    // xoa dong (giu lai it nhat 1 dong trong khu vuc de luon co cho them cay tiep). recalcFn do noi goi
    // truyen vao - khac nhau giua form phang (0/1 so do) va tung khoi so do rieng (renderCatMultiSoDo).
    function wireCatPickRow(rowEl, recalcFn) {
      // v5.42: truyền list dạng HÀM để lọc động — ẩn cây đã chọn ở picker khác (kể cả sơ đồ khác).
      wireSearchableSelect('catpick_' + rowEl.dataset.idx, () => catAvailListFor('catpick_' + rowEl.dataset.idx), 'CayID', labelForGiaoVai, recalcFn);
      rowEl.querySelector('.cat-lop').addEventListener('input', recalcFn);
      const oGC = rowEl.querySelector('.cat-giatcap');   // v6.01
      if (oGC) oGC.addEventListener('input', recalcFn);
      const oHS = rowEl.querySelector('.cat-heso');      // v6.08
      if (oHS) oHS.addEventListener('input', recalcFn);
      // v5.87: chọn/chụp ảnh -> tải lên NGAY, giữ đường dẫn vào ô ẩn và hiện ảnh nhỏ để biết đã có ảnh.
      const oFile = rowEl.querySelector('.cat-anh-file');
      if (oFile) oFile.addEventListener('change', async () => {
        const f = oFile.files && oFile.files[0];
        if (!f) return;
        try {
          const url = await uploadFile(f, 'cat');
          rowEl.querySelector('.cat-anh').value = url;
          rowEl.querySelector('.cat-anh-xem').innerHTML = `<a href="${escapeHtml(url)}" target="_blank"><img src="${escapeHtml(url)}" style="width:46px;height:46px;object-fit:cover;border-radius:4px;"></a>`;
        } catch (err) { toast(err.message, 'error'); }
      });
      rowEl.querySelector('.catpick-remove').addEventListener('click', () => {
        const siblings = rowEl.parentElement.querySelectorAll('[data-catpickrow]');
        if (siblings.length > 1) rowEl.remove();
        else {
          rowEl.querySelectorAll('input').forEach(i => { i.value = ''; });
          const textEl = document.getElementById('catpick_' + rowEl.dataset.idx + '_text');
          const valEl = document.getElementById('catpick_' + rowEl.dataset.idx + '_val');
          if (textEl) textEl.value = '';
          if (valEl) valEl.value = '';
        }
        recalcFn();
      });
    }
    function wireCatPickList(boxEl, recalcFn) {
      boxEl.querySelectorAll('[data-catpickrow]').forEach(rowEl => wireCatPickRow(rowEl, recalcFn));
    }
    // Tinh SL cai tung dong + tong cua 1 khu vuc (boxEl), ghi ra totalOutEl - dung chung cho form phang
    // (0/1 so do) VA tung khoi so do rieng (renderCatMultiSoDo truyen o hien subtotal cua RIENG khoi do).
    function recalcCatBoxTotal(boxEl, totalOutEl) {
      let sum = 0;
      boxEl.querySelectorAll('[data-catpickrow]').forEach(rowEl => {
        const lop = Number(rowEl.querySelector('.cat-lop').value) || 0;
        // v6.01: SL cái = lớp × hệ số + GIẬT CẤP (giật cấp ghi thẳng bằng CÁI, không nhân hệ số).
        const oGC = rowEl.querySelector('.cat-giatcap');
        const giatCap = (catCoGiatCap && oGC) ? (Number(oGC.value) || 0) : 0;
        // v6.08: hệ số lấy theo Ô CỦA DÒNG (sửa được); bỏ trống/≤0 thì dùng hệ số của đơn.
        const oHS = rowEl.querySelector('.cat-heso');
        const heSo = (oHS && Number(oHS.value) > 0) ? Number(oHS.value) : heSoQuyDoiDonHang;
        const cai = lop * heSo + giatCap;
        rowEl.querySelector('.cat-cai-val').textContent = fmtNumber(Math.round(cai * 100) / 100);
        sum += cai;
      });
      if (totalOutEl) totalOutEl.textContent = fmtNumber(Math.round(sum * 100) / 100);
      return sum;
    }
    // Doc lai danh sach cay da chon trong 1 khu vuc (boxEl) thanh mang chiTietCay gui len backend - dung
    // cho truong hop form phang (0/1 so do, xem renderStageFields('CAT')/submit handler ben duoi).
    function readCatPickRows(boxEl) {
      return Array.from(boxEl.querySelectorAll('[data-catpickrow]')).map(rowEl => ({
        cayId: getSearchableValue('catpick_' + rowEl.dataset.idx),
        sttCay: rowEl.querySelector('.cat-stt').value || null,
        soLuongLop: rowEl.querySelector('.cat-lop').value || 0,
        heSoQuyDoi: (rowEl.querySelector('.cat-heso') && rowEl.querySelector('.cat-heso').value) || null,   // v6.08
        // v6.01: chỉ gửi giật cấp khi ô tick đang bật (tắt tick = coi như không có giật cấp).
        soCaiGiatCap: (catCoGiatCap && rowEl.querySelector('.cat-giatcap')) ? (rowEl.querySelector('.cat-giatcap').value || null) : null,
        kgMetSuDung: rowEl.querySelector('.cat-kgmet').value || null,
        // v5.87: đường dẫn ảnh cây vải (đã tải lên lúc chọn/chụp) — ô ẩn .cat-anh.
        anhCay: (rowEl.querySelector('.cat-anh') && rowEl.querySelector('.cat-anh').value) || null
      })).filter(r => r.cayId && Number(r.soLuongLop) > 0);
    }

    // v5.18 (muc 1.2.3, yeu cau "List chọn sơ đồ cắt... khi chọn sơ đồ mới có màn hình nhập liệu"): don
    // co > 1 so do - THAY viec hien CA N khoi form xep chong cung luc (v5.16) bang 1 o CHON so do dang
    // nhap (dropdown) + CHI 1 khu vuc nhap lieu cho DUNG so do dang chon tai 1 thoi diem. Du lieu cac so
    // do KHAC (khong dang hien tren man hinh) van duoc giu trong catGroupState (bo nho tam cua modal nay)
    // khi nguoi dung doi qua lai giua cac so do - gop het lai thanh payload.catGroups luc bam "Gửi" qua
    // box.__getCatGroupsForSubmit() (submit handler ben duoi goi ham nay thay vi doc thang tren DOM).
    async function renderCatMultiSoDo(box) {
      /* v6.17 — LƯU TỪNG SƠ ĐỒ + SƠ ĐỒ ĐÃ LƯU KHÔNG CÒN HIỆN Ở Ô "SƠ ĐỒ ĐANG NHẬP LIỆU".
         Trước đây phải gõ hết mọi sơ đồ rồi bấm "Gửi" một lần; cắt xong 1 sơ đồ muốn lưu ngay thì không
         được, mà mở lại form thì sơ đồ đã cắt vẫn nằm trong ô chọn nên rất dễ ghi trùng.
         Nay: mỗi sơ đồ có nút "💾 Lưu sơ đồ này" (gửi ĐÚNG 1 sơ đồ qua POST /tiendo với catGroups 1 phần
         tử), và ô chọn chỉ liệt kê sơ đồ CHƯA có sổ cắt. */
      box.innerHTML = '<div class="empty-hint">Đang tải danh sách sơ đồ...</div>';
      // Chốt chặn: nếu người dùng bấm "Gửi" trước khi tải xong thì submit vẫn đi nhánh multi (không crash).
      box.__getCatGroupsForSubmit = () => [];
      const daLuu = new Set();
      try {
        const r = (await apiGet('/api/qlsx/orders/' + encodeURIComponent(maDH) + '/socat?tatCa=1')).data;
        (r && r.records || []).forEach(x => { if (x.SoDoID != null) daLuu.add(String(x.SoDoID)); });
      } catch (e) { /* không đọc được thì coi như chưa lưu sơ đồ nào */ }
      const soDoDaLuu = soDoList.filter(s => daLuu.has(String(s.ID)));
      let soDoConLai = soDoList.filter(s => !daLuu.has(String(s.ID)));
      if (!soDoConLai.length) {
        box.innerHTML = `<div class="empty-hint" style="color:#137333;background:#e8f5e9;border:1px solid #c8e6c9;border-radius:6px;padding:10px 12px;">
            ✅ Cả ${soDoList.length} sơ đồ của lệnh này ĐÃ CÓ SỔ CẮT — không còn sơ đồ nào cần nhập.
            Muốn sửa/thêm cây vào sổ đã ghi thì dùng khối <b>“Sổ cắt đã ghi nhận”</b> bên trên (nút ✏️ Sửa / thêm cây).
          </div>
          <div class="sub-total" style="margin-top:10px;"><b>Tổng SL cái (tất cả sơ đồ):</b> <span id="catTongCaiVal">0</span>
            <span id="catDangNhapInfo" style="margin-left:10px;"></span>
            <span id="catDaGhiInfo" style="margin-left:10px;color:#137333;"></span></div>`;
        box.__recalcCatTong = () => {
          const daGhi = Number(box.__catDaGhiCai) || 0;
          const el = modal.querySelector('#catTongCaiVal');
          if (el) el.textContent = fmtNumber(daGhi);
        };
        renderSoCatDaGhi(box, maDH, perm);
        return;
      }
      const catGroupState = {};
      soDoConLai.forEach(s => { catGroupState[s.ID] = { sttSoCat: '', nhanVienTraiVaiIds: [], nhanVienCatId: '', rows: [] }; });
      // v5.42: cấp cho catChosenExcept() danh sách cây đã chọn ở các sơ đồ KHÁC (không phải sơ đồ đang mở
      // trên DOM — sơ đồ đó đã được quét trực tiếp). Đọc từ catGroupState (được lưu khi chuyển sơ đồ).
      catCrossSoDoChosen = () => {
        const formEl = box.querySelector('#catGroupArea [data-catgroupform]');
        const activeId = formEl ? String(formEl.dataset.sodoid) : null;
        const ids = [];
        soDoConLai.forEach(s => {
          if (String(s.ID) === activeId) return;
          (catGroupState[s.ID].rows || []).forEach(r => { if (r.cayId) ids.push(r.cayId); });
        });
        return ids;
      };

      function soDoLabel(s) {
        const parts = [];
        if (s.MetSoDoDai != null) parts.push(fmtNumber(s.MetSoDoDai) + 'm');
        if (s.KhoVaiSoDo != null) parts.push('khổ ' + fmtNumber(s.KhoVaiSoDo));
        if (s.MaRap) parts.push('rập ' + s.MaRap);
        return (parts.length ? parts.join(', ') : ('Sơ đồ #' + s.ID)) + (s.GhiChu ? ' — ' + s.GhiChu : '');
      }
      function saveActiveGroupState() {
        const formEl = box.querySelector('#catGroupArea [data-catgroupform]');
        if (!formEl) return;
        const st = catGroupState[formEl.dataset.sodoid];
        if (!st) return;
        st.sttSoCat = formEl.querySelector('.cat-grp-sttsocat').value || '';
        st.nhanVienTraiVaiIds = Array.from(formEl.querySelectorAll('.tv-check:checked')).map(c => c.value);
        st.nhanVienCatId = formEl.querySelector('.cat-grp-nhanviencat').value || '';
        st.rows = Array.from(formEl.querySelectorAll('[data-catpickrow]')).map(rowEl => ({
          cayId: getSearchableValue('catpick_' + rowEl.dataset.idx),
          sttCay: rowEl.querySelector('.cat-stt').value || '',
          soLuongLop: rowEl.querySelector('.cat-lop').value || '',
          heSoQuyDoi: (rowEl.querySelector('.cat-heso') && rowEl.querySelector('.cat-heso').value) || '',   // v6.08
          // v6.01: giữ cả giật cấp khi chuyển qua lại giữa các sơ đồ (nếu không, chuyển sơ đồ là mất).
          soCaiGiatCap: (rowEl.querySelector('.cat-giatcap') && rowEl.querySelector('.cat-giatcap').value) || '',
          /* v6.01 (SỬA LỖI CŨ từ v5.87): thiếu dòng này nên ở đơn NHIỀU SƠ ĐỒ, ảnh cây vải chụp xong
             bị MẤT (state không giữ, payload không gửi) — đơn 1 sơ đồ thì vẫn lưu được vì đọc thẳng DOM
             qua readCatPickRows(). */
          anhCay: (rowEl.querySelector('.cat-anh') && rowEl.querySelector('.cat-anh').value) || '',
          kgMetSuDung: rowEl.querySelector('.cat-kgmet').value || ''
        }));
      }
      function recalcGrandTotal() {
        const formEl = box.querySelector('#catGroupArea [data-catgroupform]');
        let curSub = 0;
        const curSoDoId = formEl ? formEl.dataset.sodoid : null;
        if (formEl) curSub = recalcCatBoxTotal(formEl.querySelector('.cat-grp-caybox'), formEl.querySelector('.cat-grp-subtotal'));
        let grand = curSub;
        soDoConLai.forEach(s => {
          if (String(s.ID) === String(curSoDoId)) return;
          // v6.01: sơ đồ không đang mở -> cộng từ bộ nhớ tạm, có kèm phần giật cấp.
          // v6.08: dùng hệ số RIÊNG của dòng đã lưu trong bộ nhớ tạm (bỏ trống thì hệ số của đơn).
          grand += catGroupState[s.ID].rows.reduce((sum, r) => {
            const hs = Number(r.heSoQuyDoi) > 0 ? Number(r.heSoQuyDoi) : heSoQuyDoiDonHang;
            return sum + (Number(r.soLuongLop) || 0) * hs + (catCoGiatCap ? (Number(r.soCaiGiatCap) || 0) : 0);
          }, 0);
        });
        /* v6.01: TỔNG = phần ĐÃ GHI ở các sổ cắt trước (box.__catDaGhiCai, do renderSoCatDaGhi điền) +
           phần ĐANG GÕ trong form. Trước đây chỉ có phần đang gõ nên đơn đã cắt xong mở lại vẫn hiện 0. */
        const daGhi = Number(box.__catDaGhiCai) || 0;
        const grandEl = modal.querySelector('#catTongCaiVal');
        if (grandEl) grandEl.textContent = fmtNumber(Math.round((grand + daGhi) * 100) / 100);
        /* v5.98: đếm số sơ đồ ĐANG chuẩn bị nhập (có ít nhất 1 dòng cây đã chọn + số lớp > 0), tính cả
           sơ đồ đang mở trên màn hình lẫn các sơ đồ đã gõ dở rồi chuyển sang sơ đồ khác. */
        const dnEl = modal.querySelector('#catDangNhapInfo');
        if (dnEl) {
          let soDoDangNhap = 0;
          soDoConLai.forEach(s => {
            const laDangMo = String(s.ID) === String(curSoDoId);
            const rows = laDangMo && formEl
              ? readCatPickRows(formEl.querySelector('.cat-grp-caybox'))
              : (catGroupState[s.ID].rows || []).filter(r => r.cayId && Number(r.soLuongLop) > 0);
            if (rows.length) soDoDangNhap++;
          });
          dnEl.innerHTML = `<b>Đang nhập:</b> ${fmtNumber(Math.round(grand * 100) / 100)} cái · ${soDoDangNhap}/${soDoConLai.length} sơ đồ chưa lưu`;
        }
      }
      // v6.01: renderSoCatDaGhi() chạy SAU (async) nên cần hook để tính lại dòng tổng khi có số đã ghi.
      box.__recalcCatTong = recalcGrandTotal;
      function renderGroupArea(soDoId) {
        const st = catGroupState[soDoId];
        const areaEl = box.querySelector('#catGroupArea');
        const rowsHtml = (st.rows.length ? st.rows : [{}]).map(r => catPickRowHtml(r)).join('');
        areaEl.innerHTML = `<div data-catgroupform data-sodoid="${soDoId}">
            <div class="row-repeater">
              <div class="row-item" style="grid-template-columns:1fr;">
                <div class="form-row"><label>STT sổ cắt</label><input class="cat-grp-sttsocat" type="number" value="${escapeHtml(st.sttSoCat || '')}"></div>
              </div>
              <div class="row-item" style="grid-template-columns:1fr 1fr;">
                <div class="form-row"><label>Nhân viên trải vải (chọn đúng 2 người)</label>
                  <div class="checkbox-list">
                    ${nhanVienCat.map(nv => `<label class="chk-item"><input type="checkbox" class="tv-check" value="${nv.NhanVienID}" ${st.nhanVienTraiVaiIds.indexOf(String(nv.NhanVienID)) !== -1 ? 'checked' : ''}> ${escapeHtml(nv.HoTen)}</label>`).join('') || '<div class="empty-hint">Chưa có nhân viên bộ phận Cắt</div>'}
                  </div>
                </div>
                <div class="form-row"><label>Nhân viên cắt</label><select class="cat-grp-nhanviencat"><option value="">--</option>${opt(nhanVienCat, 'NhanVienID', 'HoTen', st.nhanVienCatId)}</select></div>
              </div>
            </div>
            <div class="form-row"><label>Cây vải đưa vào cắt ở sơ đồ này (chọn trong số cây đã xuất cho đơn hàng)</label>
              ${catGiatCapToggleHtml('catGcToggle_' + soDoId)}
              <div class="row-repeater cat-grp-caybox">${rowsHtml}</div>
              <button type="button" class="btn small secondary cat-grp-addrow">+ Thêm dòng</button>
              ${/* v6.17: lưu NGAY sơ đồ này, không cần chờ nhập hết các sơ đồ khác rồi bấm "Gửi". */''}
              <button type="button" class="btn small cat-grp-luu" style="margin-left:6px;">💾 Lưu sơ đồ này</button>
              <div class="sub-total">SL cái (sơ đồ này): <span class="cat-grp-subtotal">0</span></div>
              <div class="empty-hint" style="padding:2px 0 0;">Lưu xong sơ đồ này sẽ biến mất khỏi ô “Sơ đồ đang nhập liệu” và hiện ở khối “Sổ cắt đã ghi nhận”.</div>
            </div>
          </div>`;
        const formEl = areaEl.querySelector('[data-catgroupform]');
        wireCatPickList(formEl.querySelector('.cat-grp-caybox'), recalcGrandTotal);
        wireGiatCapToggle(formEl, recalcGrandTotal);   // v6.01
        formEl.querySelector('.cat-grp-addrow').addEventListener('click', () => {
          const cayBox = formEl.querySelector('.cat-grp-caybox');
          cayBox.insertAdjacentHTML('beforeend', catPickRowHtml());
          wireCatPickRow(cayBox.lastElementChild, recalcGrandTotal);
        });
        formEl.querySelectorAll('.tv-check').forEach(chk => chk.addEventListener('change', () => {
          const checked = formEl.querySelectorAll('.tv-check:checked');
          if (checked.length > 2) { chk.checked = false; toast('Chỉ được chọn tối đa 2 người trải vải.', 'error'); }
        }));
        formEl.querySelector('.cat-grp-luu').addEventListener('click', () => luuMotSoDo(soDoId));
        recalcGrandTotal();
      }
      /* v6.17: LƯU ĐÚNG 1 SƠ ĐỒ — gửi POST /tiendo với catGroups CHỈ 1 phần tử (backend đã xử lý được từ
         v5.16, mỗi phần tử = 1 bản ghi TienDoSanXuat). Lưu xong: bỏ sơ đồ đó khỏi ô chọn + khỏi bộ nhớ
         tạm, chuyển sang sơ đồ còn lại, và làm mới khối "Sổ cắt đã ghi nhận". */
      async function luuMotSoDo(soDoId) {
        saveActiveGroupState();
        const st = catGroupState[soDoId] || {};
        const chiTietCay = (st.rows || []).filter(r => r.cayId && Number(r.soLuongLop) > 0).map(r => ({
          cayId: r.cayId, sttCay: r.sttCay || null, soLuongLop: r.soLuongLop || 0, kgMetSuDung: r.kgMetSuDung || null,
          soCaiGiatCap: catCoGiatCap ? (r.soCaiGiatCap || null) : null, heSoQuyDoi: r.heSoQuyDoi || null,
          anhCay: r.anhCay || null
        }));
        if (!chiTietCay.length) { toast('Sơ đồ này chưa có cây vải nào có số lớp > 0.', 'error'); return; }
        const ttl = chiTietCay.map(c => String(c.cayId)).filter((v, i, a) => a.indexOf(v) !== i);
        if (ttl.length) { toast('Có cây vải bị chọn TRÙNG trong sơ đồ này — mỗi cây chỉ 1 dòng.', 'error'); return; }
        const oCongDoan = modal.querySelector('[name="congDoan"]');
        const oNgay = modal.querySelector('[name="ngayGhiNhan"]');
        const oGhiChu = modal.querySelector('[name="ghiChu"]');
        try {
          await apiPost(`/api/qlsx/orders/${encodeURIComponent(maDH)}/tiendo`, {
            congDoan: oCongDoan ? oCongDoan.value : null,
            ngayGhiNhan: (oNgay && oNgay.value) || null,
            ghiChu: (oGhiChu && oGhiChu.value) || null,
            catGroups: [{
              soDoId, sttSoCat: st.sttSoCat || null,
              nhanVienTraiVaiIds: st.nhanVienTraiVaiIds || [], nhanVienCatId: st.nhanVienCatId || null,
              chiTietCay
            }]
          });
          toast('Đã lưu sổ cắt của sơ đồ này.', 'success');
        } catch (err) { toast(err.message, 'error'); return; }

        delete catGroupState[soDoId];
        soDoConLai = soDoConLai.filter(s => String(s.ID) !== String(soDoId));
        const picker = box.querySelector('#catSoDoPicker');
        if (!soDoConLai.length) {
          // Hết sơ đồ cần nhập -> vẽ lại cả khối (nhánh "đã xong" ở đầu renderCatMultiSoDo).
          renderCatMultiSoDo(box);
          return;
        }
        if (picker) {
          picker.innerHTML = soDoConLai.map(s => `<option value="${s.ID}">${escapeHtml(soDoLabel(s))}</option>`).join('');
          picker.value = String(soDoConLai[0].ID);
        }
        renderGroupArea(soDoConLai[0].ID);
        // Làm mới khối "Sổ cắt đã ghi nhận" để thấy ngay sổ vừa lưu.
        const wrapCu = box.querySelector('#soCatXem');
        if (wrapCu && wrapCu.closest('.form-row')) wrapCu.closest('.form-row').remove();
        renderSoCatDaGhi(box, maDH, perm);
      }

      box.innerHTML = `<div class="form-row"><label>Sơ đồ đang nhập liệu (${soDoConLai.length}/${soDoList.length} sơ đồ chưa có sổ cắt)</label>
          <select id="catSoDoPicker">${soDoConLai.map(s => `<option value="${s.ID}">${escapeHtml(soDoLabel(s))}</option>`).join('')}</select>
          ${soDoDaLuu.length ? `<div class="empty-hint" style="padding:2px 0 0;color:#137333;">Đã có sổ cắt (không hiện ở đây nữa): ${soDoDaLuu.map(s => escapeHtml(soDoLabel(s))).join(' · ')}</div>` : ''}
        </div>
        <div id="catGroupArea"></div>
        ${/* v5.98: dòng tổng nói rõ luôn ĐÃ GHI mấy sơ đồ (renderSoCatDaGhi điền vào #catDaGhiInfo)
             và ĐANG NHẬP TIẾP mấy sơ đồ (recalcGrandTotal đếm sơ đồ có dữ liệu trong form). */''}
        <div class="sub-total" style="margin-top:10px;">
          <b>Tổng SL cái (tất cả sơ đồ):</b> <span id="catTongCaiVal">0</span>
          <span id="catDangNhapInfo" style="margin-left:10px;"></span>
          <span id="catDaGhiInfo" style="margin-left:10px;color:#137333;"></span>
        </div>`;
      renderGroupArea(soDoConLai[0].ID);
      box.querySelector('#catSoDoPicker').addEventListener('change', (e) => {
        saveActiveGroupState();
        renderGroupArea(e.target.value);
      });

      box.__getCatGroupsForSubmit = () => {
        saveActiveGroupState();
        // v6.17: chỉ gom các sơ đồ CHƯA lưu (sơ đồ đã lưu riêng đã bị bỏ khỏi soDoConLai + catGroupState).
        return soDoConLai.map(s => {
          const st = catGroupState[s.ID] || { rows: [], nhanVienTraiVaiIds: [] };
          const chiTietCay = st.rows.filter(r => r.cayId && Number(r.soLuongLop) > 0).map(r => ({
            cayId: r.cayId, sttCay: r.sttCay || null, soLuongLop: r.soLuongLop || 0, kgMetSuDung: r.kgMetSuDung || null,
            soCaiGiatCap: catCoGiatCap ? (r.soCaiGiatCap || null) : null,   // v6.01
            heSoQuyDoi: r.heSoQuyDoi || null,   // v6.08
            anhCay: r.anhCay || null
          }));
          return { soDoId: s.ID, sttSoCat: st.sttSoCat || null, nhanVienTraiVaiIds: st.nhanVienTraiVaiIds, nhanVienCatId: st.nhanVienCatId || null, chiTietCay };
        }).filter(grp => grp.chiTietCay.length || grp.sttSoCat || grp.nhanVienCatId || grp.nhanVienTraiVaiIds.length);
      };
    }

    // v5.13 (muc 1.2.1.1, yeu cau "Trường Mét sơ đồ, Khổ vải sơ đồ có thẻ thêm nhiều dòng, thêm cột ghi
    // chú ở cuối"): thay 1 bo o nhap DUY NHAT (truoc day nam thang trong renderStageFields('KT')) bang 1
    // danh sach NHIEU "so do" cho don hang, dung CHUNG pattern voi Giao vai/Phu kien o tren - danh sach
    // rieng, luu NGAY qua nut "Luu", doc lap voi lan "Gui" chinh cua form Ghi tien do. Cong doan Cat doc
    // lai danh sach nay de chon "dang cat so do nao" (xem renderStageFields('CAT') + submit handler,
    // chi hien o chon khi > 1 dong - yeu cau 1.2.2.1).
    let sdAddRowIdx = 0;
    function sdExistingRowsHtml() {
      return soDoList.map(s => `<tr data-id="${s.ID}">
        <td>${s.MetSoDoDai != null ? fmtNumber(s.MetSoDoDai) : ''}</td><td>${s.KhoVaiSoDo != null ? fmtNumber(s.KhoVaiSoDo) : ''}</td>
        <td>${escapeHtml(s.MaRap || '')}</td><td>${escapeHtml(s.GhiChu || '')}</td>
        ${/* v7.53: + nút SỬA. Trước chỉ có Xóa — mà gõ sai xong thì xóa KHÔNG được nếu sơ đồ đã dùng ở
              Ghi tiến độ Cắt (khóa ngoại), nên dòng sai nằm vĩnh viễn trên đơn. Dùng CHUNG pattern
              sửa-tại-dòng của "Nhà gia công chi tiết" (ngc-edit) ngay dưới, không mở popup riêng. */''}
        <td><button type="button" class="btn small secondary sd-edit" data-id="${s.ID}">Sửa</button>
            <button type="button" class="btn small danger sd-del" data-id="${s.ID}">Xóa</button></td></tr>`).join('')
        || '<tr><td colspan="5" class="empty-hint">Chưa khai báo sơ đồ nào</td></tr>';
    }
    function sdAddRowHtml() {
      const idx = ++sdAddRowIdx;
      return `<div class="form-grid" style="grid-template-columns:1fr 1fr 1fr 1.5fr auto;gap:8px;align-items:end;margin-bottom:8px;" data-sdaddrow data-idx="${idx}">
        <div><label>Mét sơ đồ</label><input type="number" step="0.01" min="0" class="sd-met"></div>
        <div><label>Khổ vải sơ đồ</label><input type="number" step="0.01" min="0" class="sd-kho"></div>
        <div><label>Mã rập</label><input class="sd-marap"></div>
        <div><label>Ghi chú</label><input class="sd-ghichu"></div>
        <div><button type="button" class="btn small danger sd-remove">X</button></div>
      </div>`;
    }
    function renderSoDoBox(box) {
      box.innerHTML = `
        <div class="form-row"><label>Sơ đồ đã khai báo</label>
          <table><thead><tr><th>Mét sơ đồ</th><th>Khổ vải sơ đồ</th><th>Mã rập</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody id="sdExistingBody">${sdExistingRowsHtml()}</tbody></table>
        </div>
        <div class="form-row"><label>Thêm sơ đồ</label>
          <div id="sdAddRows">${sdAddRowHtml()}</div>
          <button type="button" class="btn small secondary" id="btnAddSdRow">+ Thêm dòng</button>
          <div style="margin-top:8px;"><button type="button" class="btn small" id="btnSaveSoDo">💾 Lưu sơ đồ</button></div>
        </div>`;
      wireSoDoBox(box);
    }
    function wireSoDoBox(box) {
      function wireSdRemove(rowEl) {
        rowEl.querySelector('.sd-remove').addEventListener('click', () => {
          if (box.querySelectorAll('#sdAddRows > [data-sdaddrow]').length > 1) rowEl.remove();
        });
      }
      box.querySelectorAll('#sdAddRows > [data-sdaddrow]').forEach(wireSdRemove);
      box.querySelector('#btnAddSdRow').addEventListener('click', () => {
        box.querySelector('#sdAddRows').insertAdjacentHTML('beforeend', sdAddRowHtml());
        wireSdRemove(box.querySelector('#sdAddRows').lastElementChild);
      });
      /* v7.53: SỬA ngay tại dòng (giống ngc-edit). Sơ đồ ĐÃ dùng ở Ghi tiến độ Cắt thì HỎI trước:
         Mét/Khổ vải sơ đồ CÓ vào phép tính (sổ cắt, lương trải vải cắt), sửa là diễn giải lại số cũ. */
      box.querySelectorAll('.sd-edit').forEach(btn => btn.addEventListener('click', () => {
        const row = soDoList.find(s => String(s.ID) === String(btn.dataset.id));
        if (!row) return;
        const tr = btn.closest('tr');
        const so = v => (v == null ? '' : v);
        tr.innerHTML = `
          <td><input class="sd-e-met" type="number" step="0.01" min="0" value="${so(row.MetSoDoDai)}" style="width:90px;"></td>
          <td><input class="sd-e-kho" type="number" step="0.01" min="0" value="${so(row.KhoVaiSoDo)}" style="width:90px;"></td>
          <td><input class="sd-e-marap" value="${escapeHtml(row.MaRap || '')}"></td>
          <td><input class="sd-e-ghichu" value="${escapeHtml(row.GhiChu || '')}"></td>
          <td><button type="button" class="btn small sd-e-save">Lưu</button>
              <button type="button" class="btn small secondary sd-e-cancel">Hủy</button></td>`;
        tr.querySelector('.sd-e-cancel').addEventListener('click', () => renderSoDoBox(box));
        tr.querySelector('.sd-e-save').addEventListener('click', async () => {
          const body = {
            metSoDoDai: tr.querySelector('.sd-e-met').value || null,
            khoVaiSoDo: tr.querySelector('.sd-e-kho').value || null,
            maRap: tr.querySelector('.sd-e-marap').value || null,
            ghiChu: tr.querySelector('.sd-e-ghichu').value || null
          };
          try {
            /* Cảnh báo TRƯỚC khi ghi, và chỉ khi số liệu vào phép tính thật sự đổi. */
            const doiSo = String(so(row.MetSoDoDai)) !== String(body.metSoDoDai == null ? '' : body.metSoDoDai)
                       || String(so(row.KhoVaiSoDo)) !== String(body.khoVaiSoDo == null ? '' : body.khoVaiSoDo);
            if (doiSo) {
              const kt = await apiGet(`/api/qlsx/orders/${maDH}/sodo/${row.ID}/soluongcat`).catch(() => null);
              const n = kt && kt.data ? Number(kt.data.soLanCat) || 0 : 0;
              if (n > 0 && !confirm(`Sơ đồ này đã được dùng ở ${n} lần Ghi tiến độ Cắt.\n\n`
                + 'Mét sơ đồ / Khổ vải sơ đồ CÓ vào phép tính (sổ cắt, lương trải vải cắt) nên sửa là '
                + 'diễn giải lại các số đã ghi.\n\nVẫn sửa?')) return;
            }
            await apiPut(`/api/qlsx/orders/${maDH}/sodo/${row.ID}`, body);
            const fresh = await apiGet(`/api/qlsx/orders/${maDH}/sodo`);
            soDoList = fresh.data || [];
            toast('Đã cập nhật sơ đồ.', 'success'); renderSoDoBox(box);
          } catch (err) { toast(err.message, 'error'); }
        });
      }));
      box.querySelectorAll('.sd-del').forEach(btn => btn.addEventListener('click', async () => {
        try {
          await apiDelete(`/api/qlsx/orders/${maDH}/sodo/${btn.dataset.id}`);
          soDoList = soDoList.filter(s => String(s.ID) !== String(btn.dataset.id));
          toast('Đã xóa.', 'success'); renderSoDoBox(box);
        } catch (err) { toast(err.message, 'error'); }
      }));
      box.querySelector('#btnSaveSoDo').addEventListener('click', async () => {
        const rows = Array.from(box.querySelectorAll('#sdAddRows > [data-sdaddrow]')).map(r => ({
          metSoDoDai: r.querySelector('.sd-met').value || null,
          khoVaiSoDo: r.querySelector('.sd-kho').value || null,
          maRap: r.querySelector('.sd-marap').value || null,
          ghiChu: r.querySelector('.sd-ghichu').value || null
        })).filter(r => r.metSoDoDai || r.khoVaiSoDo || r.maRap || r.ghiChu);
        if (!rows.length) { toast('Vui lòng nhập ít nhất 1 sơ đồ.', 'error'); return; }
        try {
          await apiPost(`/api/qlsx/orders/${maDH}/sodo`, { rows });
          const fresh = await apiGet(`/api/qlsx/orders/${maDH}/sodo`);
          soDoList = fresh.data || [];
          toast('Đã lưu sơ đồ.', 'success'); renderSoDoBox(box);
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // v5.13 (muc 1.2.1.2, yeu cau "Giao nhà gia công có thể chọn nhiều nhà gia công và thêm cột ghi
    // chú"): day la danh sach BO SUNG (nhieu nha gia cong + ghi chu, chi de theo doi/ghi nhan), KHONG
    // thay the o chon don-nha-gia-cong hien co (searchableSelectHtml('ktNhaGiaCong') o tren, van la
    // nguon DUY NHAT quyet dinh dieu huong bo qua cong doan May - xem tinhNextStage() o backend). Dung
    // CHUNG pattern voi Giao vai/Phu kien/So do.
    // v5.24 (muc 1.3): day gio la co che DUY NHAT de giao nha gia cong (hien o nhanh "Giao gia công" cua
    // cong doan 'GC', xem renderStageFields('GC') duoi day) - them cot SoLuong ("để căn cứ tính lương sau
    // này"), bo doan chu thich "khac Nha Lam" (khong con khai niem "Nha Lam" o CHINH dong nay nua, da
    // tach han sang nhanh "Giao nhà làm" rieng).
    let ngcAddRowIdx = 0;
    // v5.30: "Nha gia cong chi tiet" gio NHOM THEO HANG MUC gia cong (khai o Ky thuat). Moi hang muc co 1
    // don gia CHUNG (chi xem, tu Ky thuat - hangMucGiaCongDaChon.DonGia), duoi do them NHIEU nha + SL tung
    // nha. Bo cot "Don gia" rieng tung nha (khong con nhap don gia tung nha nua). data-hmid gan hang muc
    // vao moi dong de luu HangMucGiaCongID.
    function ngcExistingRowsHtml(hmId) {
      return nhaGiaCongChiTietList.filter(n => String(n.HangMucGiaCongID) === String(hmId)).map(n => `<tr data-id="${n.ID}">
        <td>${escapeHtml(n.TenNha || '')}</td><td style="text-align:right;">${n.SoLuong != null ? fmtNumber(n.SoLuong) : ''}</td><td>${escapeHtml(n.GhiChu || '')}</td>
        <td><button type="button" class="btn small secondary ngc-edit" data-id="${n.ID}">Sửa</button> <button type="button" class="btn small danger ngc-del" data-id="${n.ID}">Xóa</button></td></tr>`).join('')
        || '<tr><td colspan="4" class="empty-hint">Chưa có nhà gia công cho hạng mục này</td></tr>';
    }
    function ngcAddRowHtml(hmId) {
      const idx = ++ngcAddRowIdx;
      return `<div class="form-grid" style="grid-template-columns:2fr 1fr 2fr auto;gap:8px;align-items:end;margin-bottom:6px;" data-ngcaddrow data-idx="${idx}" data-hmid="${hmId}">
        <div><label>Nhà gia công (gõ để tìm)</label>${searchableSelectHtml('ngca_' + idx, dm.nhaGiaCong, 'NhaGiaCongID', n => n.TenNha)}</div>
        <div><label>Số lượng</label><input class="ngc-soluong" type="number" min="0"></div>
        <div><label>Ghi chú</label><input class="ngc-ghichu"></div>
        <div><button type="button" class="btn small danger ngc-remove">X</button></div>
      </div>`;
    }
    /* v5.68 (theo yêu cầu): KHÔNG còn bắt buộc khai đơn giá trước mới giao được gia công.
       Giao trước — khai giá sau đều được:
         - Hạng mục ĐÃ khai giá ở Kỹ thuật  -> hiện đơn giá như cũ.
         - Hạng mục CHƯA khai giá           -> vẫn giao được, cột đơn giá ghi "chưa khai".
       Đơn giá KHÔNG được sao chép vào dòng giao: backend đọc giá bằng OUTER APPLY sang
       DonHangHangMucGiaCong mỗi lần lấy dữ liệu (xem getNhaGiaCongChiTiet trong routes/qlsx.js),
       nên khi Kỹ thuật khai giá sau thì các dòng ĐÃ GIAO tự có giá — không phải giao lại. */
    let ngcHangMucThem = [];        // hạng mục người dùng chủ động mở thêm để giao (chưa khai giá)
    function ngcDanhSachHangMuc() {
      const map = new Map();
      const them = (id, ten, donGia, coGia) => {
        if (id == null || map.has(String(id))) return;
        map.set(String(id), { id, ten: ten || '(không tên)', donGia, coGia });
      };
      hangMucGiaCongDaChon.forEach(hm => them(hm.HangMucGiaCongID, hm.TenHangMuc, hm.DonGia, true));
      // Hạng mục đã lỡ giao từ trước (kể cả khi chưa khai giá) vẫn phải hiện ra để sửa/xóa.
      nhaGiaCongChiTietList.forEach(n => them(n.HangMucGiaCongID, n.TenHangMuc, n.DonGiaHangMuc,
        n.DonGiaHangMuc != null));
      ngcHangMucThem.forEach(id => {
        const c = (hangMucGiaCongList || []).find(x => String(x.HangMucGiaCongID) === String(id));
        if (c) them(c.HangMucGiaCongID, c.TenHangMuc, null, false);
      });
      return [...map.values()];
    }
    function renderNhaGiaCongChiTietBox(box) {
      const ds = ngcDanhSachHangMuc();
      const conLai = (hangMucGiaCongList || []).filter(c => !ds.some(x => String(x.id) === String(c.HangMucGiaCongID)));
      const chonThemHtml = `
        <div class="card" style="padding:8px 10px;margin-bottom:10px;background:#fafbfc;">
          <div class="form-grid" style="grid-template-columns:2fr auto;gap:8px;align-items:end;">
            <div><label>Giao thêm hạng mục khác (chưa khai giá cũng giao được)</label>
              ${conLai.length
                ? `<select id="ngcThemHangMuc"><option value="">-- Chọn hạng mục --</option>${conLai.map(c => `<option value="${c.HangMucGiaCongID}">${escapeHtml(c.TenHangMuc)}</option>`).join('')}</select>`
                : '<div class="empty-hint" style="text-align:left;padding:6px 0;">Đã mở hết danh mục hạng mục gia công.</div>'}
            </div>
            <div>${conLai.length ? '<button type="button" class="btn small secondary" id="btnNgcThemHangMuc">+ Mở hạng mục</button>' : ''}</div>
          </div>
        </div>`;

      const khoiHangMuc = ds.map(hm => `
        <div class="card" style="padding:8px 10px;margin-bottom:10px;" data-hmblock data-hmid="${hm.id}">
          <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(hm.ten)} — Đơn giá: ${hm.coGia
            ? `${fmtNumber(hm.donGia || 0)} <span style="font-weight:normal;color:#5f6368;">(từ Kỹ thuật)</span>`
            : '<span class="badge warn">chưa khai</span> <span style="font-weight:normal;color:#5f6368;">— khai ở Kỹ thuật lúc nào cũng được, giá sẽ tự áp vào các dòng dưới đây</span>'}</div>
          <table><thead><tr><th>Nhà gia công</th><th>Số lượng</th><th>Ghi chú</th><th></th></tr></thead>
            <tbody>${ngcExistingRowsHtml(hm.id)}</tbody></table>
          <div class="ngc-addrows" data-hmid="${hm.id}" style="margin-top:6px;">${ngcAddRowHtml(hm.id)}</div>
          <button type="button" class="btn small secondary ngc-addrow-btn" data-hmid="${hm.id}">+ Thêm nhà</button>
        </div>`).join('');

      box.innerHTML =
        (ds.length ? '' : '<div class="empty-hint" style="text-align:left;">Đơn hàng chưa khai "Đơn giá Giao gia công" ở Kỹ thuật — vẫn giao được ngay: chọn hạng mục bên dưới rồi thêm nhà gia công. Khai giá sau, giá sẽ tự áp vào.</div>')
        + khoiHangMuc + chonThemHtml
        + (ds.length ? '<div style="margin-top:4px;"><button type="button" class="btn small" id="btnSaveNgc">💾 Lưu nhà gia công</button></div>' : '');
      wireNhaGiaCongChiTietBox(box);
      const btnThem = box.querySelector('#btnNgcThemHangMuc');
      if (btnThem) btnThem.addEventListener('click', () => {
        const sel = box.querySelector('#ngcThemHangMuc');
        const id = sel && sel.value;
        if (!id) { toast('Hãy chọn một hạng mục.', 'error'); return; }
        ngcHangMucThem = [...ngcHangMucThem, id];
        renderNhaGiaCongChiTietBox(box);
      });
    }
    function wireNhaGiaCongChiTietBox(box) {
      function wireAddRow(rowEl) {
        wireSearchableSelect('ngca_' + rowEl.dataset.idx, dm.nhaGiaCong, 'NhaGiaCongID', n => n.TenNha);
        rowEl.querySelector('.ngc-remove').addEventListener('click', () => {
          const cont = rowEl.closest('.ngc-addrows');
          if (cont && cont.querySelectorAll('[data-ngcaddrow]').length > 1) rowEl.remove();
        });
      }
      box.querySelectorAll('[data-ngcaddrow]').forEach(wireAddRow);
      // v5.30: "+ Thêm nhà" theo TUNG hang muc (moi block hang muc co khu .ngc-addrows rieng).
      box.querySelectorAll('.ngc-addrow-btn').forEach(btn => btn.addEventListener('click', () => {
        const cont = box.querySelector('.ngc-addrows[data-hmid="' + btn.dataset.hmid + '"]');
        cont.insertAdjacentHTML('beforeend', ngcAddRowHtml(btn.dataset.hmid));
        wireAddRow(cont.lastElementChild);
      }));
      box.querySelectorAll('.ngc-del').forEach(btn => btn.addEventListener('click', async () => {
        try {
          await apiDelete(`/api/qlsx/orders/${maDH}/nhagiacongchitiet/${btn.dataset.id}`);
          nhaGiaCongChiTietList = nhaGiaCongChiTietList.filter(n => String(n.ID) !== String(btn.dataset.id));
          toast('Đã xóa.', 'success'); renderNhaGiaCongChiTietBox(box);
        } catch (err) { toast(err.message, 'error'); }
      }));
      // v5.30: sua-tai-cho 1 dong (nha + SL + ghi chu; don gia lay tu hang muc nen KHONG sua o day).
      box.querySelectorAll('.ngc-edit').forEach(btn => btn.addEventListener('click', () => {
        const row = nhaGiaCongChiTietList.find(n => String(n.ID) === String(btn.dataset.id));
        if (!row) return;
        const tr = btn.closest('tr');
        tr.innerHTML = `<td>${searchableSelectHtml('ngcEdit_' + row.ID, dm.nhaGiaCong, 'NhaGiaCongID', n => n.TenNha, row.NhaGiaCongID)}</td>
          <td><input class="ngc-edit-soluong" type="number" min="0" value="${row.SoLuong != null ? row.SoLuong : ''}" style="width:80px;"></td>
          <td><input class="ngc-edit-ghichu" value="${escapeHtml(row.GhiChu || '')}"></td>
          <td><button type="button" class="btn small ngc-save" data-id="${row.ID}">Lưu</button> <button type="button" class="btn small secondary ngc-cancel">Hủy</button></td>`;
        wireSearchableSelect('ngcEdit_' + row.ID, dm.nhaGiaCong, 'NhaGiaCongID', n => n.TenNha);
        tr.querySelector('.ngc-cancel').addEventListener('click', () => renderNhaGiaCongChiTietBox(box));
        tr.querySelector('.ngc-save').addEventListener('click', async () => {
          const nhaGiaCongId = getSearchableValue('ngcEdit_' + row.ID);
          const soLuong = tr.querySelector('.ngc-edit-soluong').value || null;
          const ghiChu = tr.querySelector('.ngc-edit-ghichu').value || null;
          if (!nhaGiaCongId) { toast('Vui lòng chọn nhà gia công.', 'error'); return; }
          try {
            await apiPut(`/api/qlsx/orders/${maDH}/nhagiacongchitiet/${row.ID}`, { nhaGiaCongId, hangMucGiaCongId: row.HangMucGiaCongID, soLuong, ghiChu });
            const fresh = await apiGet(`/api/qlsx/orders/${maDH}/nhagiacongchitiet`);
            nhaGiaCongChiTietList = fresh.data || [];
            toast('Đã cập nhật.', 'success'); renderNhaGiaCongChiTietBox(box);
          } catch (err) { toast(err.message, 'error'); }
        });
      }));
      const btnSave = box.querySelector('#btnSaveNgc');
      if (btnSave) btnSave.addEventListener('click', async () => {
        const rows = Array.from(box.querySelectorAll('[data-ngcaddrow]')).map(r => ({
          nhaGiaCongId: getSearchableValue('ngca_' + r.dataset.idx),
          hangMucGiaCongId: r.dataset.hmid,
          soLuong: r.querySelector('.ngc-soluong').value || null,
          ghiChu: r.querySelector('.ngc-ghichu').value || null
        })).filter(r => r.nhaGiaCongId);
        if (!rows.length) { toast('Chưa chọn nhà gia công nào để lưu.', 'error'); return; }
        try {
          await apiPost(`/api/qlsx/orders/${maDH}/nhagiacongchitiet`, { rows });
          const fresh = await apiGet(`/api/qlsx/orders/${maDH}/nhagiacongchitiet`);
          nhaGiaCongChiTietList = fresh.data || [];
          toast('Đã lưu nhà gia công.', 'success'); renderNhaGiaCongChiTietBox(box);
        } catch (err) { toast(err.message, 'error'); }
      });
    }

    // v5.32: khối "Nhà in thêu" dùng ở 2 công đoạn GIT (Giao) / NIT (Nhận). Giao: chọn nhiều nhà + SL giao;
    // Nhận: hiện nhà đã giao + SL giao, nhập SL nhận. Lưu ngay qua nút (không qua "Gửi" chính).
    /* v6.01: mỗi dòng giao chọn thêm HẠNG MỤC IN THÊU — danh sách lấy từ "Đơn giá in thêu" của ĐÚNG đơn
       (backend trả kèm ở GET /orders/:maDH/inthe → data.hangMucs). Bảng lương gia công in thêu dùng hạng
       mục này để lấy ĐƠN GIÁ của đúng hạng mục; để trống thì vẫn tính bằng TỔNG đơn giá in thêu như cũ.
       Đơn chưa khai Đơn giá in thêu thì ô chọn rỗng + có nhắc vào Tài liệu kỹ thuật khai trước. */
    let inTheHangMucList = [];
    function itHangMucOptionsHtml(chon) {
      const dc = (v) => String(v == null ? '' : v);
      return `<option value="">(để trống = tổng tất cả hạng mục)</option>`
        + inTheHangMucList.map(h => `<option value="${escapeHtml(h.Ten)}" ${dc(chon) === dc(h.Ten) ? 'selected' : ''}>${escapeHtml(h.Ten)}${h.DonGia != null ? ' — ' + fmtNumber(h.DonGia) : ''}</option>`).join('')
        // Hạng mục đã lưu nhưng KHÔNG còn trong Đơn giá in thêu: vẫn phải hiện ra, không được âm thầm mất.
        + ((chon && !inTheHangMucList.some(h => dc(h.Ten) === dc(chon))) ? `<option value="${escapeHtml(chon)}" selected>${escapeHtml(chon)} (không còn trong Đơn giá in thêu)</option>` : '');
    }
    function inTheAddRowHtml() {
      const idx = ++inTheAddIdx;
      return `<div class="form-grid" style="grid-template-columns:2fr 1.6fr 1fr 1.6fr auto;gap:8px;align-items:end;margin-bottom:6px;" data-itaddrow data-idx="${idx}">
        <div><label>Nhà in thêu (gõ để tìm)</label>${searchableSelectHtml('ita_' + idx, dm.nhaIn, 'NhaGiaCongID', n => n.TenNha)}</div>
        <div><label>Hạng mục in thêu</label><select class="it-hangmuc">${itHangMucOptionsHtml('')}</select></div>
        <div><label>SL giao</label><input class="it-slgiao" type="number" min="0"></div>
        <div><label>Ghi chú</label><input class="it-ghichu"></div>
        <div><button type="button" class="btn small danger it-remove">X</button></div>
      </div>`;
    }
    async function renderInTheBox(box, mode) {
      const res = await apiGet(`/api/qlsx/orders/${maDH}/inthe`);
      inTheList = res.data.rows || [];
      inTheHangMucList = res.data.hangMucs || [];   // v6.01
      if (mode === 'nhan') {
        box.innerHTML = `<table><thead><tr><th style="width:38px;">STT</th><th>Nhà in thêu</th><th>Hạng mục in thêu</th><th>SL giao</th><th>SL nhận</th></tr></thead>
          <tbody>${inTheList.map((n, __i) => `<tr><td style="text-align:center;">${__i + 1}</td>
            <td>${escapeHtml(n.TenNha || '')}</td><td>${escapeHtml(n.HangMucInThe || '')}</td><td style="text-align:right;">${n.SoLuongGiao != null ? fmtNumber(n.SoLuongGiao) : ''}</td>
            <td><input type="number" min="0" class="it-slnhan" data-id="${n.ID}" value="${n.SoLuongNhan != null ? n.SoLuongNhan : ''}" style="width:90px;"></td></tr>`).join('')
            || '<tr><td colspan="4" class="empty-hint">Chưa giao cho nhà in thêu nào (làm ở công đoạn "Giao in thêu").</td></tr>'}</tbody></table>
          ${inTheList.length ? '<div style="margin-top:8px;"><button type="button" class="btn small" id="btnSaveItNhan">💾 Lưu số lượng nhận</button></div>' : ''}`;
        const btn = box.querySelector('#btnSaveItNhan');
        if (btn) btn.addEventListener('click', async () => {
          try {
            for (const i of box.querySelectorAll('.it-slnhan')) await apiPut(`/api/qlsx/orders/${maDH}/inthe/${i.dataset.id}/nhan`, { soLuongNhan: i.value || null });
            toast('Đã lưu số lượng nhận.', 'success');
          } catch (err) { toast(err.message, 'error'); }
        });
        return;
      }
      // mode === 'giao'
      /* v6.01: cột Hạng mục in thêu ở dòng ĐÃ GIAO là ô CHỌN SỬA ĐƯỢC (lưu ngay qua
         PUT /inthe/:id/hangmuc) — các dòng giao từ trước v6.01 chưa có hạng mục mà bảng lương lại đọc
         cột này, nếu chỉ cho chọn lúc thêm mới thì phải xóa dòng rồi giao lại. */
      box.innerHTML = `<table><thead><tr><th style="width:38px;">STT</th><th>Nhà in thêu</th><th>Hạng mục in thêu</th><th>SL giao</th><th>SL nhận</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>${inTheList.map((n, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(n.TenNha || '')}</td>
            <td><select class="it-hm-sua" data-id="${n.ID}" style="min-width:150px;">${itHangMucOptionsHtml(n.HangMucInThe || '')}</select></td>
            <td style="text-align:right;">${n.SoLuongGiao != null ? fmtNumber(n.SoLuongGiao) : ''}</td><td style="text-align:right;">${n.SoLuongNhan != null ? fmtNumber(n.SoLuongNhan) : ''}</td><td>${escapeHtml(n.GhiChu || '')}</td>
            <td><button type="button" class="btn small danger it-del" data-id="${n.ID}">Xóa</button></td></tr>`).join('')
            || '<tr><td colspan="6" class="empty-hint">Chưa có nhà in thêu</td></tr>'}</tbody></table>
        ${inTheHangMucList.length ? '' : '<div class="empty-hint" style="color:#b06000;">Đơn này chưa khai <b>Đơn giá in thêu</b> nên chưa có hạng mục để chọn — vào <b>Tài liệu kỹ thuật → Đơn giá in thêu</b> khai trước (bảng lương in thêu lấy đơn giá từ đó).</div>'}
        <div id="itAddRows" style="margin-top:6px;">${inTheAddRowHtml()}</div>
        <button type="button" class="btn small secondary" id="btnAddItRow">+ Thêm nhà in thêu</button>
        <div style="margin-top:8px;"><button type="button" class="btn small" id="btnSaveItGiao">💾 Lưu giao in thêu</button></div>`;
      box.querySelectorAll('.it-hm-sua').forEach(sel => sel.addEventListener('change', async () => {
        try {
          await apiPut(`/api/qlsx/orders/${maDH}/inthe/${sel.dataset.id}/hangmuc`, { hangMucInThe: sel.value || null });
          toast('Đã lưu hạng mục in thêu.', 'success');
        } catch (err) { toast(err.message, 'error'); }
      }));
      function wireItAddRow(rowEl) {
        wireSearchableSelect('ita_' + rowEl.dataset.idx, dm.nhaIn, 'NhaGiaCongID', n => n.TenNha);
        rowEl.querySelector('.it-remove').addEventListener('click', () => { if (box.querySelectorAll('#itAddRows > [data-itaddrow]').length > 1) rowEl.remove(); });
      }
      box.querySelectorAll('#itAddRows > [data-itaddrow]').forEach(wireItAddRow);
      box.querySelector('#btnAddItRow').addEventListener('click', () => {
        box.querySelector('#itAddRows').insertAdjacentHTML('beforeend', inTheAddRowHtml());
        wireItAddRow(box.querySelector('#itAddRows > [data-itaddrow]:last-child'));
      });
      box.querySelectorAll('.it-del').forEach(b => b.addEventListener('click', async () => {
        try { await apiDelete(`/api/qlsx/orders/${maDH}/inthe/${b.dataset.id}`); toast('Đã xóa.', 'success'); renderInTheBox(box, 'giao'); }
        catch (err) { toast(err.message, 'error'); }
      }));
      box.querySelector('#btnSaveItGiao').addEventListener('click', async () => {
        const rows = Array.from(box.querySelectorAll('#itAddRows > [data-itaddrow]')).map(r => ({
          nhaInId: getSearchableValue('ita_' + r.dataset.idx), soLuongGiao: r.querySelector('.it-slgiao').value || null, ghiChu: r.querySelector('.it-ghichu').value || null,
          hangMucInThe: (r.querySelector('.it-hangmuc') && r.querySelector('.it-hangmuc').value) || null   // v6.01
        })).filter(r => r.nhaInId);
        if (!rows.length) { toast('Chưa chọn nhà in thêu nào.', 'error'); return; }
        try { await apiPost(`/api/qlsx/orders/${maDH}/inthe`, { rows }); toast('Đã lưu giao in thêu.', 'success'); renderInTheBox(box, 'giao'); }
        catch (err) { toast(err.message, 'error'); }
      });
    }

    // v5.14: khối nhập liệu "Phụ kiện" (renderPhuKienBox/wirePhuKienBox/pkExistingRowsHtml/pkAddRowHtml/
    // fillPkDonViForRow) đã CHUYỂN HẲN sang module.tailieukythuat.js (màn hình "Chỉ định NPL" trong chức
    // năng Tài liệu kỹ thuật - yêu cầu v5.14 mục 3: "tách Chỉ định phụ kiện trong ghi nhận tiến độ khỏi
    // ghi nhận tiến độ thành chức năng riêng"). Vẫn dùng CHUNG nguyên 3 API /orders/:maDH/phukien (GET/
    // POST/DELETE) như cũ, chỉ UI chuyển chỗ - xem stageCode === 'PK' ngay bên dưới, nay chỉ còn 1 thông
    // báo + nút mở màn hình mới.

    // v5.9 (yeu cau "Mã công đoạn... mở rộng thành sửa lại toàn bộ các chỗ so sánh trực tiếp theo TÊN
    // công đoạn... sang so sánh theo mã/StageID"): #pCongDoanSelect gio dung StageID lam value (khong
    // con la TenCongDoan) - stageById tra StageID -> ca dong CongDoanSanXuat (co san MaCongDoan, ma ON
    // DINH da duoc khoa cho 8 cong doan he thong qua cot LaHeThong tu migration_v59.sql) de
    // renderStageFields()/submit handler ben duoi so sanh theo ma thay vi TEN hien thi (tu do doi duoc
    // qua Danh muc tu sau khi nang cap nay ma khong con lam gian doan luong Ghi nhan tien do nua).
    const stageById = new Map(stages.map(s => [String(s.StageID), s]));
    function stageCodeOf(rawStageId) {
      const st = stageById.get(String(rawStageId));
      return st ? st.MaCongDoan : null;
    }

    // v5.38: widget giao việc LA/DG theo MÀU (mirror ktGiaoViec nhưng key theo MauSacID; nhân viên = nhanVienAll).
    function laDgMiniRowHtml(mauSacId, row) {
      const uid = 'ladg_' + mauSacId + '_' + row.idx;
      return `<div class="ladg-row" data-ladgrow data-idx="${row.idx}" style="display:flex;gap:4px;align-items:center;margin-bottom:4px;flex-wrap:wrap;">
        <div style="flex:1;min-width:130px;">${searchableSelectHtml(uid, nhanVienAll, 'NhanVienID', p => p.HoTen, row.nhanVienId || '')}</div>
        <input type="number" min="0" class="ladg-sl" placeholder="SL" style="width:64px;" value="${row.soLuong || ''}">
        <button type="button" class="btn small danger ladg-remove" style="padding:2px 8px;">X</button></div>`;
    }
    function laDgCellHtml(mauSacId, stageCode) {
      const daGiao = phanCongLaDGList.filter(p => String(p.MauSacID) === String(mauSacId) && p.MaCongDoan === stageCode);
      const rows = laDgByMau[mauSacId] || [];
      const daGiaoHtml = daGiao.length ? `<div style="font-size:11px;color:#5f6368;margin-bottom:4px;">Đã giao: ${daGiao.map(p => `${escapeHtml(p.TenNhanVien)} (${fmtNumber(p.SoLuong)})`).join(', ')}</div>` : '';
      return `<div data-ladgcell="${mauSacId}">${daGiaoHtml}<div class="ladg-rows">${rows.map(r => laDgMiniRowHtml(mauSacId, r)).join('')}</div>
        <button type="button" class="btn small secondary ladg-add" style="font-size:11px;padding:2px 8px;">+ NV</button></div>`;
    }
    function wireLaDgCell(cellEl, mauSacId) {
      function wireRow(rowEl) {
        const idx = rowEl.dataset.idx;
        const row = (laDgByMau[mauSacId] || []).find(r => String(r.idx) === String(idx));
        wireSearchableSelect('ladg_' + mauSacId + '_' + idx, nhanVienAll, 'NhanVienID', p => p.HoTen, (m) => { if (row) row.nhanVienId = m ? m.NhanVienID : ''; });
        if (row) rowEl.querySelector('.ladg-sl').addEventListener('input', e => { row.soLuong = e.target.value; });
        rowEl.querySelector('.ladg-remove').addEventListener('click', () => { laDgByMau[mauSacId] = (laDgByMau[mauSacId] || []).filter(r => String(r.idx) !== String(idx)); rowEl.remove(); });
      }
      cellEl.querySelectorAll('[data-ladgrow]').forEach(wireRow);
      cellEl.querySelector('.ladg-add').addEventListener('click', () => {
        const idx = ++laDgIdx; if (!laDgByMau[mauSacId]) laDgByMau[mauSacId] = [];
        const row = { idx, nhanVienId: '', soLuong: '' }; laDgByMau[mauSacId].push(row);
        cellEl.querySelector('.ladg-rows').insertAdjacentHTML('beforeend', laDgMiniRowHtml(mauSacId, row));
        wireRow(cellEl.querySelector(`[data-ladgrow][data-idx="${idx}"]`));
      });
    }
    function laDgAreaHtml(stageCode) {
      if (!catMauList.length) return '<div class="empty-hint">Chưa ghi nhận Cắt — chưa có màu để giao.</div>';
      const rowsHtml = catMauList.map(ct => `<div class="row-item" style="grid-template-columns:1.3fr 1fr 2fr;align-items:start;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--border);">
        <div>${escapeHtml(ct.TenMau)}</div>
        <div><label style="font-size:11px;color:#5f6368;display:block;">SL cắt màu</label><div class="readonly-fact">${fmtNumber(ct.SoLuong || 0)}</div></div>
        <div><label style="font-size:11px;color:#5f6368;display:block;">Nhân viên &amp; SL</label>${laDgCellHtml(ct.MauSacID, stageCode)}</div>
      </div>`).join('');
      return `<div class="row-repeater"><div class="row-item" style="grid-template-columns:1.3fr 1fr 2fr;font-weight:600;font-size:12px;color:#5f6368;"><div>Màu chính</div><div>SL cắt</div><div>Nhân viên &amp; SL</div></div><div id="laDgBox">${rowsHtml}</div></div>`;
    }
    function wireLaDgArea() {
      const b2 = modal.querySelector('#laDgBox'); if (!b2) return;
      b2.querySelectorAll('[data-ladgcell]').forEach(cell => wireLaDgCell(cell, cell.dataset.ladgcell));
    }

    function renderStageFields(rawStageId) {
      const box = modal.querySelector('#pStageFields');
      const stageCode = stageCodeOf(rawStageId);
      if (stageCode === 'KT') {
        // v5.13 (muc 1.2.1.1): Met so do/Kho vai so do/Ma rap khong con la 1 dong nhap DUY NHAT tren
        // form chinh nua - chuyen thanh danh sach rieng (renderSoDoBox, nut "Luu" luu ngay, doc lap voi
        // lan "Gui" chinh - CUNG pattern voi Giao vai/Phu kien). Xem submit handler ben duoi (da bo thu
        // thap metSoDoDai/khoVaiSoDo/maRap khoi payload chinh).
        // v5.23 (sua sai v5.21 muc 3 - phan hoi truc tiep "Sau công đoạn cắt có công đoạn giao gia
        // công... Nếu giao nhà làm thì chuyển sang công đoạn may"): toggle "Kênh sản xuất" + chon nha
        // gia cong (radio + ktGiaCongArea cu) da CHUYEN HET sang 1 cong doan MOI rieng 'GC' ("Giao gia
        // công"), dung NGAY SAU Cat, TRUOC May (xem renderStageFields('GC') o duoi + migration_v523.sql)
        // - KHONG con o Ky thuat nua. Ky thuat tu nay CHI con Sơ đồ + chon cong doan may (luon o dang
        // "Nhà Làm"/hideGiaoViec=true - viec giao NHAN VIEN & SL van CHI lam o May nhu truoc, khong doi).
        // v5.34c (Giai doan C, muc 5): khoi "Chọn công đoạn may + đơn giá" da CHUYEN sang "Tài liệu may/Đóng
        // gói" > "Đơn giá công đoạn may" (model moi: Giây giờ x Hệ số CĐ x Hệ số CN). Ky thuat tu nay CHI con
        // "Sơ đồ". Cong doan May lay cong doan tu bang moi (xem congDoanMayReadonlyHtml + GET /dongiacongdoanmay).
        box.innerHTML = `<div class="form-row"><label>Sơ đồ</label><div id="ktSoDoArea"></div></div>`;
        renderSoDoBox(box.querySelector('#ktSoDoArea'));

        // v5.34 (mục 5): khối "Đơn giá Giao gia công (đơn hàng này)" đã CHUYỂN sang "Tài liệu may/Đóng gói"
        // → "Đơn giá giao gia công" (module.tailieukythuat.js, child 'dongiagiacong') — không còn ở Kỹ thuật.
        // (hangMucGiaCongChonHtml/wireHangMucGiaCongChon/hangMucGiaCongDaChon giờ mồ côi ở đây; submit re-save
        // #hmgcBox đã guard null nên vô hại.)
      } else if (stageCode === 'CAT') {
        // v5.18 (muc 1.2.2, dieu kien "cập nhật bên cắt khi có phiếu xuất kho vải"): canh bao ngay tai
        // frontend (backend da CHAN cung - xem POST /orders/:maDH/tiendo) khi don CHUA co Phieu xuat kho
        // vai nao - luc nay giaoVaiList rong, khong co gi de chon vao Cat.
        if (!giaoVaiList.length) {
          box.innerHTML = `<div class="empty-hint" style="color:#c0392b;background:#fdf1f0;border:1px solid #f5c6c2;border-radius:6px;padding:10px 12px;">⚠️ Đơn hàng <b>${escapeHtml(maDH)}</b> chưa có <b>Phiếu xuất kho vải</b> nào — vào <b>Kho vải → Xuất kho vải</b>, xuất vải cho đơn hàng này trước, rồi quay lại đây ghi nhận tiến độ "Cắt" (bắt buộc — máy chủ sẽ từ chối nếu bấm "Gửi" lúc chưa có phiếu xuất).</div>`;
          return;
        }
        // v5.16 (muc 2.2.1/2.2.2, yeu cau "Khi công đoạn kỹ thuật có từ 2 sơ đồ trở lên... mỗi 1 sơ đồ
        // là 1 form nhập liệu riêng"), sua lai o v5.18 (muc 1.2.3, xem renderCatMultiSoDo() o tren - doi
        // tu N khoi form xep chong cung luc sang 1 o CHON so do + 1 khu vuc nhap lieu DUY NHAT). Khi
        // soDoList <= 1 (truong hop pho bien nhat), GIU NGUYEN cau truc form phang, chi doi phan cay vai
        // sang co che THEM tung dong (catPickRowHtml/wireCatPickList - xem dinh nghia o tren).
        if (soDoList.length > 1) {
          renderCatMultiSoDo(box);
        } else {
          // Gia tri chon duoc gui len la soDoId (name="soDoId" - FormData tu doc, khong can
          // getSearchableValue), ghi vao TienDoSanXuat.SoDoID (backend, chi khi cong doan la CAT).
          const soDoHiddenHtml = soDoList.length === 1 ? `<input type="hidden" name="soDoId" value="${soDoList[0].ID}">` : '';
          box.innerHTML = `${soDoHiddenHtml}
            <div class="row-repeater">
              <div class="row-item" style="grid-template-columns:1fr;">
                <div class="form-row"><label>STT sổ cắt</label><input name="sttSoCat" type="number"></div>
              </div>
              <div class="row-item" style="grid-template-columns:1fr 1fr;">
                <div class="form-row"><label>Nhân viên trải vải (chọn đúng 2 người)</label>
                  <div class="checkbox-list" id="traiVaiChecklist">
                    ${nhanVienCat.map(nv => `<label class="chk-item"><input type="checkbox" class="tv-check" value="${nv.NhanVienID}"> ${escapeHtml(nv.HoTen)}</label>`).join('') || '<div class="empty-hint">Chưa có nhân viên bộ phận Cắt</div>'}
                  </div>
                </div>
                <div class="form-row"><label>Nhân viên cắt</label><select name="nhanVienCatId"><option value="">--</option>${opt(nhanVienCat, 'NhanVienID', 'HoTen')}</select></div>
              </div>
            </div>
            <div class="form-row"><label>Cây vải đưa vào cắt (chọn trong số cây đã xuất cho đơn hàng)</label>
              ${catGiatCapToggleHtml('catGcToggle')}
              <div class="row-repeater" id="catCayBox">${catPickRowHtml()}</div>
              <button type="button" class="btn small secondary" id="btnAddCatCay">+ Thêm dòng</button>
              ${/* v5.98: + thông tin đã ghi bao nhiêu sổ cắt (renderSoCatDaGhi điền vào) */''}
              <div class="sub-total">Tổng SL cái (tất cả cây): <span id="catTongCaiVal">0</span>
                <span id="catDangNhapInfo" style="margin-left:10px;"></span>
                <span id="catDaGhiInfo" style="margin-left:10px;color:#137333;"></span></div>
            </div>`;
          const catCayBox = box.querySelector('#catCayBox');
          /* v6.01: TỔNG = đã ghi ở các sổ cắt trước (box.__catDaGhiCai) + đang gõ. Trước đây chỉ cộng phần
             đang gõ nên mở lại đơn đã cắt vẫn thấy 0. Gắn hook để renderSoCatDaGhi (async) tính lại. */
          const recalcCatPhang = () => {
            const dangNhap = recalcCatBoxTotal(catCayBox, null);
            const daGhi = Number(box.__catDaGhiCai) || 0;
            const elTong = modal.querySelector('#catTongCaiVal');
            if (elTong) elTong.textContent = fmtNumber(Math.round((dangNhap + daGhi) * 100) / 100);
            const elDn = modal.querySelector('#catDangNhapInfo');
            if (elDn) elDn.innerHTML = `<b>Đang nhập:</b> ${fmtNumber(Math.round(dangNhap * 100) / 100)} cái`;
          };
          box.__recalcCatTong = recalcCatPhang;
          wireCatPickList(catCayBox, recalcCatPhang);
          wireGiatCapToggle(box, recalcCatPhang);   // v6.01
          box.querySelector('#btnAddCatCay').addEventListener('click', () => {
            catCayBox.insertAdjacentHTML('beforeend', catPickRowHtml());
            wireCatPickRow(catCayBox.lastElementChild, recalcCatPhang);
          });
          box.querySelectorAll('#traiVaiChecklist .tv-check').forEach(chk => chk.addEventListener('change', () => {
            const checked = box.querySelectorAll('#traiVaiChecklist .tv-check:checked');
            if (checked.length > 2) { chk.checked = false; toast('Chỉ được chọn tối đa 2 người trải vải.', 'error'); }
          }));
        }
        renderSoCatDaGhi(box, maDH, perm);   // v5.35: sổ cắt đã ghi + nút In; v5.96: + nút Sửa/thêm cây
      // v5.22 (muc 1.1): nhanh 'GNGC'/'NNGC' (ledger nhieu nha gia cong/nhieu lan giao-nhan) da bi XOA
      // khoi day - khong con la CongDoanSanXuat nua. (LICH SU - "2 tab doc lap Giao/Nhan nha gia cong"
      // nhac o day cho v5.22/v5.23 da bi XOA HAN tu v5.24: giao nha gia cong THUC TE gio hoan toan qua
      // nhanh 'GC' ngay duoi day. v5.26: tab XEM rieng "Nhận nhà gia công" (v5.24/v5.25) cung da bi XOA
      // HAN - CHI con dung 1 noi DUY NHAT cho toan bo nghiep vu nay: cong doan 'GC' o day (nhap) + bao
      // cao "Lịch sử cập nhật tiến độ" khi in lenh san xuat (xem qlsx.js).
      } else if (stageCode === 'GC') {
        // v5.24 (phan hoi "có những công đoạn trùng nhau" - sua tiep v5.23): DOI HAN tu 1 RADIO (chon 1
        // trong 2) sang 2 CHECKBOX DOC LAP "Giao nhà làm"/"Giao gia công" - co the tick CA HAI (don hang
        // chia mot phan lam noi bo, mot phan thue ngoai). Bo han o "Nhà gia công (đại diện)" + o "Đơn giá
        // gia công" rieng cua v5.21-v5.23 - viec giao nha gia cong tu nay CHI con 1 co che DUY NHAT:
        // "Nhà gia công chi tiết" (moi dong = 1 nha + don gia + SO LUONG rieng, xem renderNhaGiaCongChiTietBox
        // da them cot SoLuong) hien NGAY khi tick "Giao gia công", KHONG con qua tab rieng "Giao nhà gia
        // công" nua (tab do da bi XOA - xem getTabs()/render() dau file). Khi tick "Giao nhà làm": hien
        // BANG THAM KHAO cong doan may da nhap o Ky thuat (dung LAI congDoanMayDaChonTableHtml(), CHI
        // DOC) - viec chon NHAN VIEN + SL van CHI lam o cong doan May nhu truoc (xac nhan qua cau hoi lam
        // ro voi nguoi dung, KHONG lap lai o day).
        box.innerHTML = `<div class="form-row"><label>Kênh sản xuất (có thể chọn cả 2 nếu đơn hàng chia một phần làm nội bộ, một phần thuê ngoài)</label>
            <div style="display:flex;gap:20px;">
              <label style="font-weight:normal;"><input type="checkbox" name="gcNhaLam" ${detail.DaGiaoNhaLam ? 'checked' : ''}> Giao nhà làm</label>
              <label style="font-weight:normal;"><input type="checkbox" name="gcGiaCong" ${detail.DaGiaoGiaCong ? 'checked' : ''}> Giao gia công</label>
            </div>
          </div>
          <div id="gcNhaLamArea"></div>
          <div id="gcGiaCongArea"></div>`;

        function renderGcNhaLamArea() {
          const area = box.querySelector('#gcNhaLamArea');
          area.innerHTML = box.querySelector('input[name="gcNhaLam"]').checked
            ? `<div class="form-row"><label>Công đoạn may đã chọn cho đơn hàng này (ở "Kỹ thuật", tham khảo — nhân viên &amp; SL vẫn chọn ở công đoạn "May")</label>${congDoanMayDaChonTableHtml()}</div>`
            : '';
        }
        function renderGcGiaCongArea() {
          const area = box.querySelector('#gcGiaCongArea');
          if (box.querySelector('input[name="gcGiaCong"]').checked) {
            area.innerHTML = `<div class="form-row"><label>Giao gia công theo hạng mục (chọn hạng mục + đơn giá ở "Kỹ thuật" → thêm nhiều nhà gia công + số lượng cho từng hạng mục; đơn giá dùng chung của hạng mục, chỉ xem)</label><div id="ktNhaGiaCongChiTietArea"></div></div>`;
            renderNhaGiaCongChiTietBox(box.querySelector('#ktNhaGiaCongChiTietArea'));
          } else {
            area.innerHTML = '';
          }
        }
        renderGcNhaLamArea();
        renderGcGiaCongArea();
        box.querySelector('input[name="gcNhaLam"]').addEventListener('change', renderGcNhaLamArea);
        box.querySelector('input[name="gcGiaCong"]').addEventListener('change', renderGcGiaCongArea);
      } else if (stageCode === 'MAY') {
        // v5.5: chua chon nha gia cong nao cung coi nhu "Nha Lam" - dong nhat voi quy uoc da co san o
        // backend tinhNextStage() ("chua giao cho ai -> gia dinh se lam noi bo, khong nhay qua May").
        // v5.8: doi dieu kien tu so sanh TEN sang dung NhaGiaCongID/LaNoiBoNhaGiaCong (xem migration_v58.sql
        // + getOrderByMaDH trong qlsx.js) - khong con phu thuoc chuoi "Nhà Làm" hien thi.
        // v5.21 (muc 3): uu tien doc trang thai tuong minh da chon o cong doan 'GC' - dong nhat voi
        // giaCongNgoai o backend tinhNextStage(). Don CU chua tung mo lai 'GC' fallback ve cach suy luan
        // CU tu NhaGiaCongID/LaNoiBoNhaGiaCong.
        // v5.24: doi tu detail.KenhSanXuat (don gia tri, mo coi tu v5.24) sang 2 co doc lap
        // DaGiaoNhaLam/DaGiaoGiaCong - May hien "Cong doan may" (showGiaoViec=true) tru khi don CHI gia
        // cong ngoai (giong dieu kien giaCongNgoaiFE o tren/chiGiaCongNgoai o backend).
        const showGiaoViec = (detail.DaGiaoNhaLam || detail.DaGiaoGiaCong)
          ? !(!!detail.DaGiaoGiaCong && !detail.DaGiaoNhaLam)
          : (!detail.NhaGiaCongID || !!detail.LaNoiBoNhaGiaCong);
        box.innerHTML = `
          ${/* v6.12: hiện "số bàn cắt đang tính / TỔNG số bàn cắt của đơn" (vd 6/7) — đơn cắt nhiều đợt
               thì 2 số này khác nhau, nhìn là biết còn đợt cắt chưa được tính vào. */''}
          <div class="form-row"><label>Tổng SL cắt (đã quy đổi, chỉ tính màu chính)</label>
            <div class="readonly-fact">${fmtNumber(slCatTongChinh)} cái — Số bàn cắt: ${fmtNumber(detail.slCatSoBan || 0)}/${fmtNumber(detail.slCatSoBanTatCa != null ? detail.slCatSoBanTatCa : (detail.slCatSoBan || 0))} bàn${Number(detail.slCatSoBanTatCa || 0) > Number(detail.slCatSoBan || 0) ? ' <span style="color:#b06000;">(đơn cắt nhiều đợt — số trên chỉ tính đợt cắt gần nhất)</span>' : ''}</div></div>
          ${showGiaoViec ? `<div class="form-row"><label>Công đoạn may đã chọn cho đơn hàng này (ở "Kỹ thuật")</label><div id="mayCongDoanMayArea"></div></div>` : `<div class="form-row"><label>Công đoạn may đã chọn cho đơn hàng này (ở "Kỹ thuật")</label>${congDoanMayDaChonTableHtml()}</div>`}
          <div class="form-row"><label>Số lượng lũy kế theo màu (tham khảo SL cắt từng màu)</label>
            <div class="row-repeater">${mauQtyRowsHtml()}</div>
          </div>
          ${showGiaoViec ? `<div class="form-row"><label>Lịch sử giao việc nội bộ đã ghi nhận</label>
            <div id="mayPcmArea">${phanCongMayExistingTableHtml()}</div></div>` : ''}`;
        if (showGiaoViec) {
          // v5.8.1: dung 1 khu vuc con RIENG (#mayCongDoanMayArea) de ve lai, tranh xoa trang cac o "SL
          // lũy kế theo màu" (.mau-qty, o nhap KHONG luu state) moi khi doi 1 dong "Nhân viên & SL" - CUNG
          // 1 loai loi da tung fix cho Ky thuat qua renderKyThuatCongDoanMayArea() (xem ham do o tren).
          // v5.23 (yeu cau "hiển thị đơn giá từ công đoạn kỹ thuật đã nhập"): doi tu congDoanMayChonHtml()/
          // wireCongDoanMayChon() (bang SUA duoc gia/he so/them/xoa cong doan, y nguyen Ky thuat - cach cu
          // tu v5.8.1) sang congDoanMayReadonlyHtml()/wireCongDoanMayReadonly() (bang CHI DOC gia/he so,
          // chi con "Nhân viên & SL" sua duoc - xem 2 ham do o tren, ngay sau wireCongDoanMayChon()).
          function renderMayCongDoanMayArea() {
            const area = box.querySelector('#mayCongDoanMayArea');
            if (!area) return;
            /* v6.18: thêm nút "💾 Lưu giao việc" NGAY dưới bảng nhân viên & SL — giao được ai thì lưu người
               đó, "Gửi" để dành cho lúc CHỐT công đoạn (Gửi mới đẩy con trỏ công đoạn sang bước sau). */
            area.innerHTML = congDoanMayReadonlyHtml()
              + `<div class="toolbar" style="margin-top:6px;">
                   <button type="button" class="btn small" id="btnLuuGiaoViecMay">💾 Lưu giao việc (chưa Gửi)</button>
                   <span class="empty-hint" style="padding:0;">Lưu để giữ phần đã giao; khi nào xong hết mới bấm <b>Gửi</b> để chốt công đoạn.</span>
                 </div>`;
            wireCongDoanMayReadonly();
            const bLuuGV = area.querySelector('#btnLuuGiaoViecMay');
            if (bLuuGV) bLuuGV.addEventListener('click', async () => {
              const cellBox = box.querySelector('#mayCdmBox') || area;
              const items = Array.from(cellBox.querySelectorAll('[data-ktgvrow]')).map(rowEl => {
                const cell = rowEl.closest('[data-ktgvcell]');
                const cdmId = cell ? cell.dataset.ktgvcell : null;
                return {
                  nhanVienId: getSearchableValue('ktgv_' + cdmId + '_' + rowEl.dataset.idx),
                  dongiaCongDoanMayId: cdmId,
                  soLuong: rowEl.querySelector('.ktgv-sl').value
                };
              }).filter(g => g.nhanVienId && g.dongiaCongDoanMayId && g.soLuong !== '');
              if (!items.length) { toast('Chưa có dòng giao việc nào (chọn nhân viên + nhập SL).', 'error'); return; }
              // Cùng khống chế như lúc Gửi: tổng SL giao trong 1 công đoạn ≤ tổng SL cắt màu chính.
              for (const cell of cellBox.querySelectorAll('[data-ktgvcell]')) {
                const tongCell = Array.from(cell.querySelectorAll('.ktgv-sl')).reduce((s, i) => s + (Number(i.value) || 0), 0);
                if (slCatTongChinh > 0 && tongCell > slCatTongChinh) {
                  toast(`Tổng SL giao trong 1 công đoạn (${fmtNumber(tongCell)}) vượt tổng SL cắt màu chính (${fmtNumber(slCatTongChinh)}).`, 'error');
                  return;
                }
              }
              const oNgay = modal.querySelector('[name="ngayGhiNhan"]');
              try {
                await apiPost(`/api/qlsx/orders/${encodeURIComponent(maDH)}/giaoviecmay`, {
                  items, ngayGhiNhan: (oNgay && oNgay.value) || null
                });
                toast(`Đã lưu ${items.length} dòng giao việc.`, 'success');
                /* v6.19: KHÔNG chỉ xoá trắng ô rồi thôi — nạp lại danh sách đã giao và VẼ LẠI khu vực này,
                   để mấy dòng vừa lưu HIỆN NGAY TẠI ĐÓ dưới dạng dòng sửa-được (💾/🗑️). Xoá các dòng nhập
                   tạm (ktGiaoViecByStage) vì chúng đã thành dòng đã lưu — nếu giữ lại thì bấm "Gửi" sau đó
                   sẽ ghi trùng thêm 1 lần nữa. */
                try {
                  phanCongMayList = (await apiGet(`/api/qlsx/orders/${encodeURIComponent(maDH)}/phancongmay`)).data || [];
                } catch (e) { /* không tải lại được thì thôi, dữ liệu đã lưu xong */ }
                ktGiaoViecByStage = {};
                renderMayCongDoanMayArea();
                lamMoiBangLichSuMay();
              } catch (err) { toast(err.message, 'error'); }
            });
          }
          renderMayCongDoanMayArea();
          wirePhanCongMayEdit(box);
        }
        // v6.12: khối "Ghi nhận May đã gửi" — xem/sửa/xóa từng lần đã Gửi (giống sổ cắt ở công đoạn Cắt).
        renderMayDaGhi(box, maDH, perm);
      } else if (stageCode === 'KN') {
        box.innerHTML = `<div class="form-row"><label>Số lượng thực tế nhập kho theo màu</label>
          <div class="row-repeater">${catMauList.map(ct => `
            <div class="row-item" style="grid-template-columns:140px 1fr 140px 110px;">
              <div class="form-row"><label>${escapeHtml(ct.TenMau)}</label></div>
              <div class="form-row"><label>SL tổng từ Cắt</label><div class="readonly-fact">${fmtNumber(ct.SoLuong || 0)}</div></div>
              <div class="form-row"><label>SL thực tế nhập kho</label><input type="number" min="0" class="kho-qty" data-mausac="${ct.MauSacID}"></div>
              ${/* v6.31: CHỈ hiện ô đơn vị quy đổi khi mã hàng THẬT SỰ có khai ĐVT quy đổi.
                   Trước đây thiếu thì vẫn hiện "Ri", nhưng backend (qlsx.js ~3187) chỉ nhân hệ số khi
                   DonViQuyDoi khác rỗng -> chọn "Ri" là ghi vào kho THIẾU đúng <tỷ lệ> lần, im lặng. */''}
              <div class="form-row"><label>Đơn vị</label><select class="kho-donvi" data-mausac="${ct.MauSacID}">${
                [...new Set([theKho.DonViCoBan || 'Cái', String(theKho.DonViQuyDoi || '').trim()].filter(Boolean))]
                  .map(dv => `<option value="${escapeHtml(dv)}">${escapeHtml(dv)}</option>`).join('')
              }</select>${!String(theKho.DonViQuyDoi || '').trim() && Number(theKho.LoaiRi) > 1
                ? '<div class="empty-hint" style="color:#b26a00;">Mã này có tỷ lệ quy đổi nhưng CHƯA khai "ĐVT quy đổi" ở Thẻ kho — chỉ nhập được theo đơn vị chính.</div>' : ''}</div>
            </div>`).join('') || '<div class="empty-hint">Chưa ghi nhận Cắt — chưa có màu để nhập kho.</div>'}</div>
          </div>`;
      } else if (stageCode === 'GIT') {
        // v5.32: Giao in theu - hien tong SL ban cat mau chinh (tham khao) + chon NHIEU nha in theu + SL giao.
        box.innerHTML = `<div class="form-row"><label>Tổng SL bàn cắt (màu chính)</label><div class="readonly-fact">${fmtNumber(slCatTongChinh)} cái</div></div>
          <div class="form-row"><label>Giao nhà in thêu (chọn nhiều nhà + số lượng giao)</label><div id="gitArea"></div></div>`;
        renderInTheBox(box.querySelector('#gitArea'), 'giao');
      } else if (stageCode === 'NIT') {
        // v5.32: Nhan in theu - hien nha da giao + SL giao, nhap SL nhan.
        box.innerHTML = `<div class="form-row"><label>Nhận hàng in thêu về (nhập SL nhận từng nhà đã giao ở công đoạn "Giao in thêu")</label><div id="nitArea"></div></div>`;
        renderInTheBox(box.querySelector('#nitArea'), 'nhan');
      } else if (stageCode === 'NGC') {
        // v5.30: "Nhan gia cong" - hien cac nha DA GIAO (nhaGiaCongChiTietList, gan o cong doan 'GC') kem
        // hang muc + SL giao, nhap SL NHAN tung nha. Luu NGAY qua nut "💾 Lưu số lượng nhận" (PUT .../:id/nhan),
        // KHONG qua "Gửi" chinh (bam Gửi chi de chuyen cong doan).
        box.innerHTML = `<div class="form-row"><label>Nhận hàng gia công về (nhập SL nhận cho từng nhà đã giao ở công đoạn "Giao gia công")</label>
          <table><thead><tr><th style="width:38px;">STT</th><th>Hạng mục</th><th>Nhà gia công</th><th>SL giao</th><th>SL nhận</th></tr></thead>
          <tbody>${nhaGiaCongChiTietList.map((n, __i) => `<tr><td style="text-align:center;">${__i + 1}</td>
            <td>${escapeHtml(n.TenHangMuc || '')}</td><td>${escapeHtml(n.TenNha || '')}</td>
            <td style="text-align:right;">${n.SoLuong != null ? fmtNumber(n.SoLuong) : ''}</td>
            <td><input type="number" min="0" class="ngc-nhan" data-id="${n.ID}" value="${n.SoLuongNhan != null ? n.SoLuongNhan : ''}" style="width:90px;"></td></tr>`).join('')
            || '<tr><td colspan="4" class="empty-hint">Chưa giao gia công cho nhà nào (làm ở công đoạn "Giao gia công").</td></tr>'}</tbody></table>
          ${nhaGiaCongChiTietList.length ? '<div style="margin-top:8px;"><button type="button" class="btn small" id="btnSaveNhan">💾 Lưu số lượng nhận</button></div>' : ''}
        </div>`;
        const btnSaveNhan = box.querySelector('#btnSaveNhan');
        if (btnSaveNhan) btnSaveNhan.addEventListener('click', async () => {
          const inputs = Array.from(box.querySelectorAll('.ngc-nhan'));
          try {
            for (const i of inputs) {
              await apiPut(`/api/qlsx/orders/${maDH}/nhagiacongchitiet/${i.dataset.id}/nhan`, { soLuongNhan: i.value || null });
            }
            const fresh = await apiGet(`/api/qlsx/orders/${maDH}/nhagiacongchitiet`);
            nhaGiaCongChiTietList = fresh.data || [];
            toast('Đã lưu số lượng nhận.', 'success');
          } catch (err) { toast(err.message, 'error'); }
        });
      } else if (stageCode === 'LA' || stageCode === 'DG') {
        // v5.38: Bộ phận LÀ/ĐÓNG GÓI - mỗi màu chính thêm nhân viên + SL, khống chế ≤ SL cắt từng màu.
        box.innerHTML = `<div class="form-row"><label>Bộ phận ${stageCode === 'LA' ? 'LÀ (ủi)' : 'ĐÓNG GÓI'} — thêm nhân viên &amp; SL theo từng màu chính (tổng SL giao mỗi màu ≤ SL cắt màu đó)</label>${laDgAreaHtml(stageCode)}</div>`;
        wireLaDgArea();
      } else {
        box.innerHTML = `<div class="form-row"><label>Số lượng lũy kế theo màu</label>
          <div class="row-repeater">${mauQtyRowsHtml()}</div></div>`;
      }
    }

    // Doc gia tri THUC TE dang duoc chon tren select (khong dung truc tiep detail.CongDoanHienTaiID) -
    // phong truong hop don hang da "Hoàn thành" (CongDoanHienTaiID = null) thi trinh duyet tu chon option
    // dau tien, tranh lech giua dropdown hien thi va bo field duoc ve ben duoi.
    renderStageFields(modal.querySelector('#pCongDoanSelect').value);
    modal.querySelector('#pCongDoanSelect').addEventListener('change', (e) => renderStageFields(e.target.value));
    // v5.54: "Bổ sung sơ đồ" nhảy thẳng tới công đoạn Kỹ thuật (nếu công đoạn đó hiện trong dropdown của user).
    if (jumpStageCode) {
      const js = stages.find(s => s.MaCongDoan === jumpStageCode);
      const sel = modal.querySelector('#pCongDoanSelect');
      if (js && sel) { sel.value = String(js.StageID); renderStageFields(sel.value); }
    }

    modal.querySelector('#pForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const congDoan = fd.get('congDoan');
      // v5.9: congDoan (gui len backend) gio la StageID - stageCode (MaCongDoan) chi dung O DAY, phia
      // client, de quyet dinh thu thap field nao (xem stageCodeOf() o tren) - khong gui stageCode len
      // backend, backend tu tra cuu lai MaCongDoan tu StageID (xem POST /orders/:maDH/tiendo).
      const stageCode = stageCodeOf(congDoan);
      const payload = { congDoan, ngayGhiNhan: fd.get('ngayGhiNhan'), ghiChu: fd.get('ghiChu') };

      if (stageCode === 'KT') {
        // v5.13 (muc 1.2.1.1): Met so do/Kho vai so do/Ma rap KHONG con gui kem lan "Gui" chinh nua -
        // da chuyen sang danh sach "Sơ đồ" rieng (renderSoDoBox), luu NGAY qua nut "Lưu sơ đồ" cua rieng
        // no (cung pattern voi Giao vai/Phu kien) - xem POST /orders/:maDH/sodo.
        // v5.23 (sua sai v5.21 muc 3): payload.nhaGiaCongId/kenhSanXuat/donGiaGiaCongNgoai KHONG con thu
        // thap o day nua - da chuyen sang nhanh 'GC' rieng (xem duoi) - Ky thuat tu nay CHI con gui cong
        // doan may + giao viec noi bo (luon o dang "Nhà Làm"/hideGiaoViec=true - xem renderStageFields('KT')).
        // v5.34c (Giai doan C, muc 5): Ky thuat KHONG con luu cong doan may / giao viec noi bo - da chuyen
        // sang "Tài liệu may/Đóng gói" (don gia) + cong doan May (giao viec nhan vien & SL). Chi con Sơ đồ,
        // luu rieng qua nut cua no. (Cac ham congDoanMayChonHtml/wireCongDoanMayChon nay thanh dead code.)
        // v5.24 (muc 1.1.1): re-luu "Đơn giá Giao gia công" tren lan Gui chinh (an toan du phong, cung
        // pattern voi cdmItems o tren - nut "💾 Lưu đơn giá gia công" da luu ngay khi bam, day chi la
        // luoi du phong neu nguoi dung quen bam ma bam thang "Gửi").
        const hmgcBoxEl = modal.querySelector('#hmgcBox');
        if (hmgcBoxEl) {
          const hmgcItems = Array.from(hmgcBoxEl.querySelectorAll('[data-hmgcrow]')).map(row => ({
              hangMucGiaCongId: row.dataset.hmgcid,
              donGia: row.querySelector('.hmgc-dongia').value
            }));   // v5.30: bo heSo
          try { await apiPut(`/api/qlsx/orders/${maDH}/hangmucgiacong`, { items: hmgcItems }); }
          catch (err) { toast('Lỗi khi lưu đơn giá gia công: ' + err.message, 'error'); return; }
        }
      } else if (stageCode === 'GC') {
        // v5.24 (phan hoi "có những công đoạn trùng nhau" - thay the han "Kênh sản xuất" RADIO + nha gia
        // cong dai dien/don gia cua v5.23 bang 2 CHECKBOX doc lap): gui dung trang thai hien tai cua 2 o
        // tick (co the CA HAI cung true) - backend chi ghi 2 co BIT, KHONG con nhan NhaGiaCongID/
        // KenhSanXuat/DonGiaGiaCongNgoai nua (xem POST /orders/:maDH/tiendo trong qlsx.js).
        payload.daGiaoNhaLam = !!modal.querySelector('input[name="gcNhaLam"]:checked');
        payload.daGiaoGiaCong = !!modal.querySelector('input[name="gcGiaCong"]:checked');
        // "Nhà gia công chi tiết" (chon nha + gia + SL) chi hien/thu thap khi tick "Giao gia công" - luu
        // NGAY qua nut instant-save rieng "💾 Lưu nhà gia công" (renderNhaGiaCongChiTietBox, khong doi tu
        // truoc), KHONG gui kem trong payload cua lan "Gửi" chinh nay (khac cdmItems/hmgcItems o tren -
        // "Nhà gia công chi tiết" von da luon la instant-save-only, chua tung co luoi du phong o "Gửi").
      } else if (stageCode === 'CAT') {
        const stageFieldsBox = modal.querySelector('#pStageFields');
        if (stageFieldsBox.__getCatGroupsForSubmit) {
          // v5.18 (muc 1.2.3): don co > 1 so do - box.__getCatGroupsForSubmit() (gan boi renderCatMultiSoDo()
          // o tren) gop du lieu so do DANG hien tren DOM + cac so do KHAC da luu trong bo nho tam
          // (catGroupState) thanh payload.catGroups, dung HET nguyen cau truc/y nghia voi backend nhu v5.16
          // (backend tao NHIEU ban ghi TienDoSanXuat, gan chung NhomTienDoID - xem POST /orders/:maDH/tiendo).
          payload.catGroups = stageFieldsBox.__getCatGroupsForSubmit();
          if (!payload.catGroups.length) { toast('Vui lòng nhập dữ liệu cho ít nhất 1 sơ đồ.', 'error'); return; }
        } else {
          payload.sttSoCat = fd.get('sttSoCat') || null;
          // v5.13 (muc 1.2.2.1): gui kem soDoId (tu o chon khi > 1 dong, hoac input an khi dung 1 dong -
          // xem renderStageFields('CAT') o tren) - backend chi ghi vao TienDoSanXuat.SoDoID khi cong doan
          // dang nop la CAT (POST /orders/:maDH/tiendo), null neu don hang chua khai bao so do nao.
          payload.soDoId = fd.get('soDoId') || null;
          payload.nhanVienTraiVaiIds = Array.from(modal.querySelectorAll('#traiVaiChecklist .tv-check:checked')).map(c => c.value);
          payload.nhanVienCatId = fd.get('nhanVienCatId') || null;
          // v5.13 (muc 1.2.2.2): KHONG con gui heSoQuyDoi tung dong nua - backend gio tu lay THANG tu
          // DonHangSanXuat.HeSoQuyDoi (xem const heSoDonHang trong POST /orders/:maDH/tiendo o qlsx.js),
          // khong con tin theo gia tri client gui (tranh sai lech neu FE/BE khong dong bo).
          // v5.18 (muc 1.2.3): doc qua readCatPickRows() (xem dinh nghia o tren) thay vi doc truc tiep
          // rowEl.dataset.cayid tinh - cay vai gio duoc CHON qua searchable-select (catpick_*), khong con
          // la 1 dong tinh san gan san CayID tren data-attribute nua.
          payload.chiTietCay = readCatPickRows(modal.querySelector('#catCayBox'));
        }
      // v5.22 (muc 1.1): nhanh 'GNGC'/'NNGC' da bi XOA khoi day - xem ghi chu tuong ung o renderStageFields()
      // o tren (2 tab doc lap "Giao/Nhan nha gia cong" co submit rieng, khong con qua form Ghi nhan tien do nay).
      } else if (stageCode === 'MAY') {
        payload.chiTietMau = Array.from(modal.querySelectorAll('.mau-qty')).filter(i => i.value !== '').map(i => ({ mauSacId: i.dataset.mausac, soLuong: i.value }));
        // v5.23 (yeu cau "hiển thị đơn giá từ công đoạn kỹ thuật đã nhập"): bang "Cong doan may da chon"
        // o May gio la #mayCdmBox CHI DOC (congDoanMayReadonlyHtml(), xem renderStageFields('MAY')) -
        // KHONG con sua duoc gia/he so tai day nua (viec do gio thuoc rieng Ky thuat) nen KHONG con goi
        // PUT /congdoanmay o day (khac han nhanh "Kỹ thuật" o tren) - chi con thu thap giao viec noi bo.
        const mayCdmBoxEl = modal.querySelector('#mayCdmBox');
        if (mayCdmBoxEl) {
          // v5.33 (muc công đoạn may): khống chế tổng SL giao nhân viên trong 1 công đoạn <= tổng SL cắt (màu chính).
          for (const cell of mayCdmBoxEl.querySelectorAll('[data-ktgvcell]')) {
            const tongCell = Array.from(cell.querySelectorAll('.ktgv-sl')).reduce((s, i) => s + (Number(i.value) || 0), 0);
            if (slCatTongChinh > 0 && tongCell > slCatTongChinh) {
              toast(`Tổng SL giao cho nhân viên trong 1 công đoạn (${fmtNumber(tongCell)}) vượt quá tổng SL cắt màu chính (${fmtNumber(slCatTongChinh)}). Vui lòng chỉnh lại.`, 'error');
              return;
            }
          }
          // v5.34c (muc 6): cdmId nay la DgmID (DonHangDonGiaCongDoanMay.ID) - gui dongiaCongDoanMayId de
          // backend luu vao PhanCongMay.DonGiaCongDoanMayID (khong con CongDoanMayID cho May).
          payload.giaoViecMay = Array.from(mayCdmBoxEl.querySelectorAll('[data-ktgvrow]')).map(rowEl => {
            const cell = rowEl.closest('[data-ktgvcell]');
            const cdmId = cell ? cell.dataset.ktgvcell : null;
            const idx = rowEl.dataset.idx;
            return {
              nhanVienId: getSearchableValue('ktgv_' + cdmId + '_' + idx),
              dongiaCongDoanMayId: cdmId,
              soLuong: rowEl.querySelector('.ktgv-sl').value
            };
          }).filter(g => g.nhanVienId && g.dongiaCongDoanMayId && g.soLuong !== '');
        }
      } else if (stageCode === 'KN') {
        payload.chiTietMau = Array.from(modal.querySelectorAll('.kho-qty')).filter(i => i.value !== '').map(i => {
          const mauSacId = i.dataset.mausac;
          const donViDaChon = modal.querySelector(`.kho-donvi[data-mausac="${mauSacId}"]`).value;
          return { mauSacId, soLuong: i.value, donViDaChon };
        });
      } else if (stageCode === 'GIT' || stageCode === 'NIT') {
        // v5.32: in theu (giao/nhan) da luu ngay qua nut instant-save - "Gửi" chi ghi nhan + chuyen cong doan.
      } else if (stageCode === 'NGC') {
        // v5.30: SL nhan da luu ngay qua nut "💾 Lưu số lượng nhận" - "Gửi" chi ghi nhan cong doan + chuyen
        // buoc (khong gui chiTietMau theo mau).
      } else if (stageCode === 'LA' || stageCode === 'DG') {
        // v5.38: khống chế tổng SL giao mỗi màu ≤ SL cắt màu đó, rồi gom giaoViecLaDG.
        const laDgBoxEl = modal.querySelector('#laDgBox');
        if (laDgBoxEl) {
          for (const cell of laDgBoxEl.querySelectorAll('[data-ladgcell]')) {
            const mauId = cell.dataset.ladgcell;
            const ct = catMauList.find(c => String(c.MauSacID) === String(mauId));
            const capSL = ct ? Number(ct.SoLuong) || 0 : 0;
            const tongCell = Array.from(cell.querySelectorAll('.ladg-sl')).reduce((s, i) => s + (Number(i.value) || 0), 0);
            if (capSL > 0 && tongCell > capSL) { toast(`Màu "${ct ? ct.TenMau : ''}": tổng SL giao (${fmtNumber(tongCell)}) vượt SL cắt màu (${fmtNumber(capSL)}). Vui lòng chỉnh lại.`, 'error'); return; }
          }
          payload.giaoViecLaDG = Array.from(laDgBoxEl.querySelectorAll('[data-ladgrow]')).map(rowEl => {
            const cell = rowEl.closest('[data-ladgcell]'); const mauId = cell ? cell.dataset.ladgcell : null; const idx = rowEl.dataset.idx;
            return { nhanVienId: getSearchableValue('ladg_' + mauId + '_' + idx), mauSacId: mauId, soLuong: rowEl.querySelector('.ladg-sl').value };
          }).filter(g => g.nhanVienId && g.mauSacId && g.soLuong !== '');
        }
      } else {
        payload.chiTietMau = Array.from(modal.querySelectorAll('.mau-qty')).filter(i => i.value !== '').map(i => ({ mauSacId: i.dataset.mausac, soLuong: i.value }));
      }

      try {
        await apiPost(`/api/qlsx/orders/${maDH}/tiendo`, payload);
        closeModal(); toast('Đã ghi nhận tiến độ.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.20 (muc 3, "Xóa chức năng Giao/nhận nhà gia công, in thêu trong danh sách lệnh sản xuất"): da xoa
  // openVendorForm() + nut kich hoat no o renderOrders(). Backend POST /orders/:maDH/vendor (route rieng
  // cho modal cu) cung da bi xoa tuong ung.
  // v5.21 (muc 8): "Giao/nhận nhà in thêu" tach HAN ra 2 tab doc lap (xem renderGiaoNhanNhaInTheu() o
  // duoi) khong con gate/anh huong gi den tinhNextStage() nua - van dung LAI dung cot DonHangSanXuat.
  // v5.22 (muc 1.1): "Giao/nhận nhà gia công" (GNGC/NNGC) DAO NGUOC dung nhu v5.20 dinh - tu THAT la 2
  // cong doan trong Ghi nhan tien do, nay CUNG tach HAN ra 2 tab doc lap - khong con anh huong gi den
  // tinhNextStage() nua.
  // v5.24: "Giao nhà gia công" (tab rieng cua v5.22) da bi XOA HAN - giao nha gia cong THUC TE gio CHI
  // con qua cong doan 'GC' (renderStageFields('GC') o tren). "Nhận nhà gia công" con lai la 1 tab THUAN
  // XEM (xem khoi NHAN NHA GIA CONG, cuoi file nay) - khong con dung GiaoNhaGiaCongChiTiet/
  // NhanNhaGiaCongChiTiet (mo coi tu v5.24), chi con doc thang DonHangChiTietNhaGiaCong.

  // ================= DON GIA CONG DOAN MAY (v5.0) — DEAD CODE tu v5.35 =================
  // Tab standalone da bo (xem getTabs + routing). Giu ham nay + routes /dongiamay,/macongdoan o backend
  // (orphan, khong goi tu UI) vi bang CongDoanMay/DonGiaCongDoanMay con duoc payroll fallback dung.
  async function renderDonGiaMay(perm) {
    const body = document.getElementById('qBody');
    const rows = (await apiGet('/api/qlsx/dongiamay')).data;
    body.innerHTML = `
      <div class="toolbar">
        ${perm.canCreate ? '<button class="btn" id="btnAddCongDoan">+ Thêm danh mục công đoạn</button>' : ''}
        <a class="btn small secondary" href="/api/qlsx/dongiamay/template">⬇️ Tải file mẫu Excel</a>
        ${perm.canCreate ? '<button class="btn small secondary" id="btnImportExcel">⬆️ Tải Excel lên</button><input type="file" id="fileImportExcel" accept=".xlsx,.xls" style="display:none;">' : ''}
      </div>
      <table><thead><tr><th>Mã CD</th><th>Tên công đoạn</th><th>Bộ phận</th><th>Đơn giá</th><th>Hệ số</th>${perm.canEdit ? '<th></th>' : ''}</tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.MaCongDoan || '')}</td><td>${escapeHtml(r.TenCongDoan)}</td><td>${escapeHtml(r.BoPhanMay || '')}</td>
        <td>${fmtNumber(r.DonGia || 0)}</td><td>${r.HeSo ?? 1}</td>
        ${perm.canEdit ? `<td><button class="btn small secondary act-editgia" data-id="${r.CongDoanMayID}">Sửa giá</button></td>` : ''}
      </tr>`).join('') || `<tr><td colspan="${perm.canEdit ? 6 : 5}" class="empty-hint">Chưa có công đoạn nào</td></tr>`}</tbody></table>`;

    if (perm.canCreate) {
      document.getElementById('btnAddCongDoan').addEventListener('click', openMaCongDoanForm);
      document.getElementById('btnImportExcel').addEventListener('click', () => document.getElementById('fileImportExcel').click());
      document.getElementById('fileImportExcel').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData(); fd.append('file', file);
        try {
          const res = await fetch('/api/qlsx/dongiamay/import', { method: 'POST', credentials: 'include', body: fd });
          const data = await res.json();
          if (!data.success) throw new Error(data.message || 'Lỗi khi nhập Excel.');
          toast(`Đã nhập ${data.data.count} dòng.`, 'success'); render(container, currentUser);
        } catch (err) { toast(err.message, 'error'); }
      });
    }
    if (perm.canEdit) {
      body.querySelectorAll('.act-editgia').forEach(btn => btn.addEventListener('click', () => openDonGiaForm(btn.dataset.id, rows.find(r => String(r.CongDoanMayID) === btn.dataset.id))));
    }
  }

  function openMaCongDoanForm() {
    const html = `
      <h3>Thêm danh mục công đoạn may</h3>
      <form id="cdForm">
        <div class="form-row"><label>Mã công đoạn</label><input name="maCongDoan" placeholder="VD: MC001"></div>
        <div class="form-row"><label>Tên công đoạn *</label><input name="tenCongDoan" required></div>
        <div class="form-row"><label>Bộ phận</label>
          <select name="boPhanMay"><option value="1 kim">1 kim</option><option value="Vắt sổ">Vắt sổ</option><option value="Khác">Khác (ghi rõ ở ghi chú)</option></select></div>
        <div class="form-row"><label>Ghi chú</label><input name="ghiChu"></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#cdForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiPost('/api/qlsx/macongdoan', { maCongDoan: fd.get('maCongDoan'), tenCongDoan: fd.get('tenCongDoan'), boPhanMay: fd.get('boPhanMay'), ghiChu: fd.get('ghiChu') });
        closeModal(); toast('Đã thêm công đoạn.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function openDonGiaForm(congDoanMayId, row) {
    const html = `
      <h3>Đơn giá — ${escapeHtml(row.TenCongDoan)}</h3>
      <form id="dgForm">
        <div class="form-row"><label>Đơn giá (VNĐ)</label><input name="donGia" type="number" step="0.01" min="0" value="${row.DonGia || 0}"></div>
        <div class="form-row"><label>Hệ số</label><input name="heSo" type="number" step="0.0001" min="0" value="${row.HeSo ?? 1}"></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#dgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiPut('/api/qlsx/dongiamay/' + congDoanMayId, { donGia: fd.get('donGia'), heSo: fd.get('heSo') });
        closeModal(); toast('Đã lưu đơn giá.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.26 (phan hoi truc tiep qua AskUserQuestion: "Giữ lại Giao gia công... bỏ hẳn 'Giao nhà gia công'/
  // 'Nhận nhà gia công'"): tab XEM rieng "Nhận nhà gia công" (renderNhanNhaGiaCong/openNhanNhaGiaCongDetail,
  // GET /nhannhagiacong/orders o qlsx.js) da bi XOA HAN - khong con tab/chuc nang rieng nao cho nha gia
  // cong nua. Toan bo nghiep vu (gan nha + xem lai) gio CHI con o cong doan 'GC' trong Ghi nhan tien do
  // (nhap qua renderNhaGiaCongChiTietBox, xem tren) + bao cao "Lịch sử cập nhật tiến độ" khi in lenh san
  // xuat (xem khoi tiem log trong qlsx.js - la NGUON XEM LAI DUY NHAT tu nay). ChucNang 'nhannhagiacong'
  // (seed tu migration_v519.sql) MO COI - giu nguyen lam checkbox phan quyen "chet" (dung quy uoc chung,
  // giong 'giaonhagiacong' cung da mo coi tu v5.24).

  // ================= GIAO / NHAN NHA IN THEU (v5.21 muc 8) =================
  // "loai" = 'giao' hoac 'nhan' - CHUC NANG DOC LAP, KHONG con gate/chan luong Ghi nhan tien do (tu
  // v5.22 GNGC/NNGC o tren CUNG khong con, xem GIAO/NHAN NHA GIA CONG phia tren) - dung LAI dung 3 cot
  // DonHangSanXuat.NhaInID/NgayGiaoIn/NgayNhanIn (khong doi schema). "Giao": chon 1 nha in/theu (danh
  // muc LoaiHinh='InTheu') + ngay giao,
  // ap dung cho TAT CA don hang (cho giao lai/doi nha bat ky luc nao, khong khoa sau lan giao dau vi
  // khong co "chi tiet" nhieu nha nhu ben gia cong). "Nhan": CHI hien don DA duoc giao (NhaInID IS NOT
  // NULL) - hien ten nha da giao (chi-doc), chi ghi ngay nhan, KHONG can nhap so luong (dung y "Phân này
  // không cần nhập số lượng" cua yeu cau).
  async function renderGiaoNhanNhaInTheu(perm, loai) {
    const isGiao = loai === 'giao';
    const apiBase = isGiao ? 'giaonhaintheu' : 'nhannhaintheu';
    const tieuDe = isGiao ? 'Giao nhà in thêu' : 'Nhận nhà in thêu';
    const body = document.getElementById('qBody');
    const rows = (await apiGet(`/api/qlsx/${apiBase}`)).data;
    body.innerHTML = `
      <h3>${tieuDe}</h3>
      <p style="font-size:13px;color:#5f6368;">${isGiao
        ? 'Chọn nhà in/thêu và ngày giao cho từng đơn hàng — không cần nhập số lượng.'
        : 'Chỉ hiển thị đơn hàng đã được giao cho 1 nhà in/thêu (ở tab "Giao nhà in thêu") — chỉ ghi nhận ngày nhận.'}</p>
      <table><thead><tr><th>Mã ĐH</th><th>Sản phẩm</th><th>Tổng SL (màu chính)</th><th>Nhà in/thêu</th><th>Ngày giao</th>${!isGiao ? '<th>Ngày nhận</th>' : ''}<th></th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${escapeHtml(r.MaDH)}</td><td>${escapeHtml(r.TenSanPham || '')}</td>
        <td style="text-align:right;">${fmtNumber(r.TongSLCat || 0)}</td>
        <td>${escapeHtml(r.TenNhaIn || '')}</td><td>${r.NgayGiaoIn ? fmtDate(r.NgayGiaoIn) : ''}</td>
        ${!isGiao ? `<td>${r.NgayNhanIn ? fmtDate(r.NgayNhanIn) : ''}</td>` : ''}
        <td><button type="button" class="btn small act-gnit" data-madh="${escapeHtml(r.MaDH)}">${perm.canEdit ? (isGiao ? (r.NhaInID ? 'Sửa' : 'Giao') : 'Ghi nhận') : 'Xem'}</button></td>
      </tr>`).join('') || `<tr><td colspan="${isGiao ? 6 : 7}" class="empty-hint">${isGiao ? 'Chưa có đơn hàng nào' : 'Chưa có đơn hàng nào được giao cho nhà in/thêu'}</td></tr>`}</tbody></table>`;
    body.querySelectorAll('.act-gnit').forEach(btn => btn.addEventListener('click', () => openGiaoNhanNhaInTheuModal(btn.dataset.madh, rows.find(r => r.MaDH === btn.dataset.madh), loai, perm)));
  }

  function openGiaoNhanNhaInTheuModal(maDH, row, loai, perm) {
    const isGiao = loai === 'giao';
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateCurrent = isGiao ? row.NgayGiaoIn : row.NgayNhanIn;
    const html = `
      <h3>${isGiao ? 'Giao' : 'Nhận'} nhà in thêu — ${escapeHtml(maDH)}</h3>
      <form id="gnitForm">
        <div class="form-row"><label>Nhà in/thêu</label>
          ${isGiao ? searchableSelectHtml('gnitNha', dm.nhaIn, 'NhaGiaCongID', n => n.TenNha, row.NhaInID || '')
                   : `<div class="readonly-fact">${escapeHtml(row.TenNhaIn || '')}</div>`}
        </div>
        <div class="form-row"><label>${isGiao ? 'Ngày giao' : 'Ngày nhận'}</label>
          <input type="date" name="ngay" value="${dateCurrent ? String(dateCurrent).slice(0, 10) : todayStr}"></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          ${perm.canEdit ? '<button type="submit" class="btn">Lưu</button>' : ''}
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    if (isGiao) wireSearchableSelect('gnitNha', dm.nhaIn, 'NhaGiaCongID', n => n.TenNha, () => {});
    if (perm.canEdit) {
      modal.querySelector('#gnitForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          if (isGiao) {
            const nhaInId = getSearchableValue('gnitNha');
            if (!nhaInId) { toast('Vui lòng chọn nhà in/thêu.', 'error'); return; }
            await apiPost(`/api/qlsx/orders/${maDH}/giaonhaintheu`, { nhaInId, ngayGiaoIn: fd.get('ngay') });
          } else {
            await apiPost(`/api/qlsx/orders/${maDH}/nhannhaintheu`, { ngayNhanIn: fd.get('ngay') });
          }
          closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
        } catch (err) { toast(err.message, 'error'); }
      });
    }
  }

  // v5.27 (1.2): "Chỉ định vải SX" (renderChiDinhVaiSX/openChiDinhVaiSXForm + GET/PUT /chidinhvaisx*)
  // da BO HAN - loai vai o Ra lenh SX gio go tu do, khong con rang buoc xuat vai theo don hang. ChucNang
  // 'chidinhvaisx' mo coi (giu quy uoc); cot DonHangChiTietVai.DVTVaiYeuCau/SoKGYeuCau mo coi (khong xoa).

  /* v6.03 — Đầu phiếu BÁO CÁO ĐƠN HÀNG SẢN XUẤT: bảng nhãn–giá trị (trước là 3 dòng chữ dài ngăn bởi
     dấu cách, khó đọc khi in) + ô ảnh sản phẩm bên phải. Ô nào không có dữ liệu thì BỎ HẲN dòng đó.
     Thêm "Số lượng sơ đồ" (đã khai / đã có sổ cắt) — backend trả SoSoDo + SoSoDoDaCat ở GET /orders/:maDH/print. */
  function bangThongTinBaoCao(o, anhHtml, dvtLenh) {
    const cap = (nhan, giaTri) => (giaTri == null || giaTri === ''
      ? '' : `<tr><td style="width:34%;background:#f5f6f8;"><b>${nhan}</b></td><td>${giaTri}</td></tr>`);
    /* v6.04: đếm sơ đồ của ĐÚNG lệnh này. Đơn cũ (trước v5.13) không có dòng nào trong "Sơ đồ" mà chỉ có
       các sổ cắt -> backend trả SoSoDoTuSoCat để không hiện "Chưa khai báo sơ đồ" trong khi đã cắt. */
    const soSoDo = Number(o.SoSoDo) || 0;
    const soTuSoCat = Number(o.SoSoDoTuSoCat) || 0;
    const daCat = Number(o.SoSoDoDaCat) || 0;
    const soDoText = soSoDo
      ? `${fmtNumber(soSoDo)} sơ đồ${daCat ? ` — đã có sổ cắt: ${fmtNumber(daCat)}/${fmtNumber(soSoDo)}` : ' — chưa cắt sơ đồ nào'}`
      : (soTuSoCat ? `${fmtNumber(soTuSoCat)} sơ đồ (theo sổ cắt đã ghi — lệnh chưa khai bảng Sơ đồ)` : 'Chưa khai báo sơ đồ');
    const hang = [
      cap('Sản phẩm', escapeHtml(o.TenSanPham || '')),
      cap('Mã hàng', escapeHtml(o.MaSanPham || '')),
      cap('Khách hàng', escapeHtml(o.TenKhachHang || '')),
      cap('Size', escapeHtml(o.Size || '')),
      cap('Mã rập', escapeHtml(o.MaRap || '')),
      cap('Số lượng sơ đồ', soDoText),
      cap('Ngày đặt', fmtDate(o.NgayDat)),
      cap('Ngày giao dự kiến', fmtDate(o.NgayGiaoDuKien)),
      // v6.04: Tổng SL kèm ĐƠN VỊ TÍNH (+ quy đổi nếu đơn có khai đơn vị quy đổi) — dùng chung fmtQuyDoi
      // với dòng "Tổng cộng" của Cấu trúc vải để 2 chỗ không bao giờ lệch cách hiển thị.
      // v6.06: đơn vị lấy theo ĐVT khai ở Ra lệnh SX (Cấu trúc vải), không mặc định "Cái".
      cap('Tổng SL', o.TongSoLuong != null ? fmtQuyDoi(o.TongSoLuong, o.HeSoQuyDoi, o.PhepTinhQuyDoi, dvtLenh || 'Cái', o.TenDonViQuyDoi) : ''),
      cap('Trạng thái', escapeHtml(o.TrangThai || '')),
      cap('% hoàn thành', o.PhanTramHoanThanh != null ? o.PhanTramHoanThanh + '%' : '')
    ].filter(Boolean).join('');
    return `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr>
        <td style="vertical-align:top;padding:0;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;" border="1" cellpadding="4">${hang}</table>
        </td>${anhHtml ? `<td style="width:130px;vertical-align:top;padding-left:10px;text-align:center;">${anhHtml}</td>` : ''}
      </tr></table>`;
  }

  // ---- In phieu bao cao don hang (tien do) - khong doi so voi v4.0 ----
  async function openPrint(maDH) {
    // v5.8: xem ghi chu tuong tu tren printLenhSanXuat() - khong con can mo cua so in truoc khi await.
    let res;
    try {
      res = await apiGet(`/api/qlsx/orders/${maDH}/print`);
    } catch (e) {
      toast('Lỗi khi lấy dữ liệu phiếu báo cáo: ' + e.message, 'error');
      return;
    }
    const { order, logs, baoCaoNangSuat, phuKienXuat, vaiXuat, chiTietVai } = res.data;
    const ns = baoCaoNangSuat || { slYeuCauCat: 0, slCatThucTe: 0, slNhapKhoThucTe: 0, slNhapKhoQuyDoi: false };
    const pk = phuKienXuat || [];
    const vx = vaiXuat || { chiTiet: [], tongKG: 0 };
    const cv = chiTietVai || [];
    const haoHutCat = ns.slYeuCauCat > 0 ? Math.round((1 - ns.slCatThucTe / ns.slYeuCauCat) * 1000) / 10 : null;
    const haoHutNhapKho = ns.slCatThucTe > 0 ? Math.round((1 - ns.slNhapKhoThucTe / ns.slCatThucTe) * 1000) / 10 : null;
    // v5.7: ghi chu "(đã quy đổi)" khi so lieu lay tu The kho hang hoa da cong don dung 1 don vi (xem
    // backend /orders/:maDH/print) - phan biet voi truong hop chua co The kho (van la tong tho, co the
    // lan don vi Cai/Ri neu co lan nao ghi Kho nhap bang "Ri").
    const slNhapKhoHtml = ns.slNhapKhoThucTe > 0 ? fmtNumber(ns.slNhapKhoThucTe) + (ns.slNhapKhoQuyDoi ? ' (đã quy đổi)' : '') : 'Chưa nhập kho';
    // v5.7 (sua lai theo phan hoi truc tiep): dong tom tat "Cau truc vai" - yeu cau moi nhat "hiển thị rõ
    // Vải chính: loại vải, mầu / Vải phối: loại vải, mầu. Giống như Cấu trúc vải trong in lệnh sx". Ban
    // v5.7 truoc do CHI hien loai vai (thieu mau rieng cho tung dong phoi, mau chinh bi don ra 1 cum
    // "(màu ...)" rieng o CUOI ca dong thay vi gan dung vao tung vai) - nay dung Y HET cong thuc
    // chinhLine/phoiLine cua printLenhSanXuat() (xem ham do o tren, cung doc tu 1 nguon du lieu
    // getChiTietVaiNested() nen KHONG can doi gi o backend) de 2 phieu hien NHAT QUAN 1 dinh dang.
    const cauTrucVaiHtml = cv.length ? cv.map(c => {
      const chinhLine = `<b>Vải chính:</b> ${escapeHtml(c.TenLoaiVaiTuDo || c.TenLoaiVai || '')} - ${escapeHtml(c.TenMauTuDo || c.TenMau || '')}${c.GhiChu ? ' <i>(' + escapeHtml(c.GhiChu) + ')</i>' : ''}`;
      const phoiLine = (c.phoi && c.phoi.length)
        ? `<br><b>Vải phối:</b> ${c.phoi.map(p => `${escapeHtml(p.TenLoaiVaiTuDo || p.TenLoaiVai || '')} - ${escapeHtml(p.TenMauTuDo || p.TenMau || '')}`).join(', ')}`
        : '';
      return `<p style="font-size:13px;">${chinhLine}${phoiLine}</p>`;
    }).join('') : '';

    // v5.6: hien ten nha gia cong/nha in (yeu cau v5.6 "trong bảng lịch sử... hiển thị thêm tên nhà gia
    // công, nhà in"). Viec giao/nhan nha gia cong KHONG di qua TienDoSanXuat (chi la cot don le tren
    // DonHangSanXuat, ghi de moi lan luu - xem POST /orders/:maDH/vendor) nen KHONG co "lich su" nhieu
    // dong that su theo tung lan giao/nhan de chen VAO trong bang - hien 1 dong thong tin RIENG (gia tri
    // hien tai + ngay giao/nhan gan nhat) ngay TREN bang lich su thay vi bam them cot gia (se ngo nhan
    // la 1 su kien rieng cho tung dong tien do, trong khi thuc chat chi la 1 gia tri dung chung ca don).
    const vendorInfoHtml = (order.TenNhaGiaCong || order.TenNhaIn) ? `
      <p style="font-size:13px;">
        ${order.TenNhaGiaCong ? `<b>Nhà gia công:</b> ${escapeHtml(order.TenNhaGiaCong)}${order.NgayGiaoGC ? ' — giao ' + fmtDate(order.NgayGiaoGC) : ''}${order.NgayNhanGC ? ' / nhận ' + fmtDate(order.NgayNhanGC) : ''}` : ''}
        ${order.TenNhaGiaCong && order.TenNhaIn ? ' &nbsp;|&nbsp; ' : ''}
        ${order.TenNhaIn ? `<b>Nhà in:</b> ${escapeHtml(order.TenNhaIn)}${order.NgayGiaoIn ? ' — giao ' + fmtDate(order.NgayGiaoIn) : ''}${order.NgayNhanIn ? ' / nhận ' + fmtDate(order.NgayNhanIn) : ''}` : ''}
      </p>` : '';

    // v5.7: them Anh san pham (order.AnhSanPham DA CO SAN tren object order tu truoc - chi la CHUA duoc
    // ve ra man hinh in nay, khong can doi backend) - yeu cau v5.7 "thêm Ảnh sản phẩm vào các bản in".
    // v6.03: ảnh vào Ô RIÊNG bên phải bảng thông tin (bỏ float:right — float làm lệch bảng khi in).
    // v6.04: + ẢNH IN THÊU (nhiều ảnh, xem tachAnhHinhIn) xếp NGAY DƯỚI ảnh sản phẩm trong cùng ô đó.
    const anhSpHtml = [
      order.AnhSanPham ? `<div><div style="font-size:11px;color:#555;">Ảnh sản phẩm</div><img src="${escapeHtml(order.AnhSanPham)}" style="max-width:125px;max-height:150px;object-fit:contain;border:1px solid #ccc;"></div>` : '',
      tachAnhHinhIn(order.AnhHinhIn).length
        ? `<div style="margin-top:6px;"><div style="font-size:11px;color:#555;">Ảnh in thêu</div>${tachAnhHinhIn(order.AnhHinhIn).map(u => `<img src="${escapeHtml(u)}" style="max-width:125px;max-height:120px;object-fit:contain;border:1px solid #ccc;margin-bottom:4px;">`).join('')}</div>`
        : ''
    ].filter(Boolean).join('');

    printHtml(`Phiếu báo cáo ${maDH}`, `
      ${/* v6.03: tiêu đề CĂN GIỮA, Mã ĐH nằm RIÊNG 1 dòng căn phải bên dưới, phần thông tin còn lại KẺ BẢNG
           (nhãn – giá trị) kèm ảnh sản phẩm bên phải — cùng bố cục với bản in Sổ cắt (v5.90). */''}
      <h2 style="text-align:center;margin:8px 0 2px;">PHIẾU BÁO CÁO ĐƠN HÀNG SẢN XUẤT</h2>
      <div style="text-align:right;font-size:13px;margin-bottom:6px;">Mã ĐH: <b>${escapeHtml(order.MaDH)}</b></div>
      ${/* v6.06: ĐVT của lệnh = ĐVT dòng Cấu trúc vải đầu tiên có khai (đúng nguồn bản in Lệnh SX dùng). */''}
      ${bangThongTinBaoCao(order, anhSpHtml, (cv.find(x => x.DonViTinh) || {}).DonViTinh || 'Cái')}

      <h3>Báo cáo năng suất Cắt / Nhập kho</h3>
      <table><thead><tr><th>SL yêu cầu cắt</th><th>SL cắt thực tế</th><th>Hao hụt cắt (%)</th><th>SL nhập kho thực tế</th><th>Hao hụt cắt→nhập kho (%)</th></tr></thead>
      <tbody><tr>
        <td>${fmtNumber(ns.slYeuCauCat)}</td><td>${fmtNumber(ns.slCatThucTe)}</td><td>${haoHutCat != null ? haoHutCat + '%' : '-'}</td>
        <td>${slNhapKhoHtml}</td><td>${haoHutNhapKho != null ? haoHutNhapKho + '%' : '-'}</td>
      </tr></tbody></table>
      <p style="font-size:11px;color:#666;">* SL cắt thực tế / nhập kho thực tế lấy từ lần "Ghi tiến độ" gần nhất tại đúng công đoạn "Cắt" / "Kho nhập". Nếu đơn hàng chưa ghi nhận tiến độ ở công đoạn nào, số liệu tương ứng sẽ là 0 (riêng SL nhập kho hiện "Chưa nhập kho").</p>

      <h3>Xuất vải kèm đơn hàng</h3>
      ${cauTrucVaiHtml}
      <p style="font-size:13px;">Tổng đã xuất: <b>${fmtNumber(vx.tongKG)} KG</b></p>
      <table><thead><tr><th style="width:38px;">STT</th><th>Ngày xuất</th><th>Mã cây</th><th>Loại vải</th><th>Màu</th><th>KG xuất</th></tr></thead>
      <tbody>${vx.chiTiet.map((v, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${fmtDate(v.NgayXuat)}</td><td>${escapeHtml(v.MaCay)}</td><td>${escapeHtml(v.TenLoaiVai)}</td><td>${escapeHtml(v.TenMau)}</td><td>${fmtNumber(v.KGXuat)}</td></tr>`).join('') || '<tr><td colspan="5">Chưa xuất vải nào cho đơn hàng này</td></tr>'}</tbody></table>

      <h3>Phụ kiện xuất kèm đơn hàng</h3>
      <table><thead><tr><th style="width:38px;">STT</th><th>Mã phụ kiện</th><th>Tên phụ kiện</th><th>SL đã xuất</th><th>SL chỉ định</th><th>ĐVT</th></tr></thead>
      <tbody>${pk.map((p, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${escapeHtml(p.MaPhuKien)}</td><td>${escapeHtml(p.TenPhuKien)}</td><td>${fmtNumber(p.TongSoLuong)}</td><td>${p.SLTheoChiDinh != null ? fmtNumber(p.SLTheoChiDinh) : '-'}</td><td>${escapeHtml(p.DonVi || '')}</td></tr>`).join('') || '<tr><td colspan="5">Chưa xuất phụ kiện nào kèm đơn hàng này</td></tr>'}</tbody></table>

      <h3>Lịch sử cập nhật tiến độ</h3>
      ${vendorInfoHtml}
      <table><thead><tr><th>Ngày giờ cập nhật</th><th>Công đoạn</th><th>Người cập nhật</th><th>Chi tiết màu</th><th>Ghi chú</th></tr></thead>
      <tbody>${logs.map(l => {
        // v5.7: "Chi tiet mau" hien them Don vi (Kho nhap) / Ten nha gia cong (May) NGAY tren tung dong
        // lich su - yeu cau v5.7. Ca 2 truong chi co gia tri cho du lieu ghi TU SAU KHI nang cap (xem
        // migration_v57.sql) - du lieu cu hon se rong, KHONG bia them thong tin khong co that.
        const mauHtml = l.chiTietMau.map(c => `${escapeHtml(c.TenMau)}: ${c.SoLuongLuyKe}${c.DonViDaChon ? ' ' + escapeHtml(c.DonViDaChon) : ''}`).join(', ');
        const ncgHtml = l.TenNhaGiaCongTaiThoiDiem ? `${mauHtml ? '<br>' : ''}<span style="color:#666;">Nhà gia công: ${escapeHtml(l.TenNhaGiaCongTaiThoiDiem)}</span>` : '';
        return `<tr><td>${fmtDateTime(l.ThoiGianNhap)}</td><td>${escapeHtml(l.TenCongDoan)}</td><td>${escapeHtml(l.NguoiCapNhat)}</td>
        <td>${mauHtml}${ncgHtml}</td><td>${escapeHtml(l.GhiChu)}</td></tr>`;
      }).join('') || '<tr><td colspan="5">Chưa có lịch sử cập nhật</td></tr>'}</tbody></table>`);
  }

  return { render, getTabs, printLenhSanXuat };   // v5.53: export printLenhSanXuat để module khác (tài liệu, BTP) mở phiếu In lệnh SX
})();
