/* ================================================================================================
   PHAN HE DMS — DI TUYEN THI TRUONG                            (v7.23, backend: routes/dms.js)

   5 tab (key PHAI trung ChucNang.MaChucNang trong migration_v686):
     shop     Shop ban le      — danh muc shop thuoc NPP, toa do, anh, lich su cham soc
     tuyen    Tuyen & lich di  — nhom shop thanh tuyen, xep lich nhan vien theo ngay
     ghetham  Ghe tham         — MAN HINH DIEN THOAI: check-in GPS + anh, hoac goi dien/Zalo
     lotrinh  Lo trinh         — ban do Leaflet + timeline theo ngay/thang
     doanhso  Doanh so         — thang/quy/nam theo nhan vien (nguon: phieu ban hang)

   ⚠️ DINH VI chi hoat dong tren HTTPS (secure context). Mo bang http:// thi trinh duyet KHONG hoi
      quyen va tra loi loi ngay — da bat truong hop nay va noi ro cho nguoi dung, khong de "bam khong
      thay gi xay ra".
   ⚠️ BAN DO tai Leaflet tu cdnjs + tile OpenStreetMap. Mang chan thi khung ban do bao "khong tai
      duoc", CAC PHAN CON LAI VAN CHAY (danh sach, check-in, doanh so) — khong de mat ca man hinh vi
      mot thu vien ngoai.
   ================================================================================================ */
window.ModuleDMS = (function () {
  let activeTab = 'shop';
  let container, currentUser, dmPerm;
  let dm = { npp: [], nhanVien: [], tuyen: [], cauHinh: { banKinhM: 200, batBuocAnh: true } };

  const TRANG_THAI_SHOP = ['Tiềm năng', 'Đang bán', 'Tạm dừng', 'Ngừng'];
  const KET_QUA = ['Có đơn', 'Không đơn', 'Đóng cửa', 'Chăm sóc'];
  const THU = [{ v: '2', t: 'T2' }, { v: '3', t: 'T3' }, { v: '4', t: 'T4' }, { v: '5', t: 'T5' },
    { v: '6', t: 'T6' }, { v: '7', t: 'T7' }, { v: '8', t: 'CN' }];

  function getTabs() {
    return [
      { key: 'shop', label: 'Shop bán lẻ' },
      { key: 'tuyen', label: 'Tuyến & lịch đi' },
      { key: 'ghetham', label: 'Ghé thăm / check-in' },
      { key: 'lotrinh', label: 'Lộ trình nhân viên' },
      { key: 'doanhso', label: 'Doanh số nhân viên' }
    ];
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    const raw = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.DMS || {});
    dmPerm = effectivePerm(user, 'DMS', activeTab, raw);
    container.innerHTML = '<div id="dmsBody"><div class="empty-hint">Đang tải...</div></div>';
    try {
      dm = (await apiGet('/api/dms/danhmuc')).data;
    } catch (e) {
      document.getElementById('dmsBody').innerHTML =
        `<div class="empty-hint">Không tải được danh mục.<br><b>${escapeHtml(e.message)}</b><br><br>
         Nếu báo thiếu bảng (Invalid object name): chạy <code>database/migration_v686.sql</code> rồi <code>pm2 restart qlnoibo</code>.</div>`;
      return;
    }
    if (activeTab === 'shop') return renderShop();
    if (activeTab === 'tuyen') return renderTuyen();
    if (activeTab === 'ghetham') return renderGheTham();
    if (activeTab === 'lotrinh') return renderLoTrinh();
    if (activeTab === 'doanhso') return renderDoanhSo();
  }

  /* ============================== TIEN ICH DUNG CHUNG ============================== */
  const optNPP = (chon) => `<option value="">— không thuộc NPP nào —</option>`
    + dm.npp.map(k => `<option value="${k.KhachHangID}" ${String(chon) === String(k.KhachHangID) ? 'selected' : ''}>${escapeHtml(k.TenKhachHang)}</option>`).join('');
  const optNV = (chon, nhan) => `<option value="">${nhan || '— chọn nhân viên —'}</option>`
    + dm.nhanVien.map(n => `<option value="${n.NhanVienID}" ${String(chon) === String(n.NhanVienID) ? 'selected' : ''}>${escapeHtml(n.HoTen)}${n.MaNhanVien ? ' · ' + escapeHtml(n.MaNhanVien) : ''}</option>`).join('');
  /* ⚠️ KHONG dung openImageLightbox() — ham do la BIEN CUC BO trong module.khohang.js, goi tu day la
     "bam khong thay gi xay ra" (ReferenceError giua handler). Tu viet mot cai nho, dung openModal
     chung nen dong lai van quay ve dung bang truoc (modal stack v5.97). */
  function xemAnh(url, tieuDe) {
    const m = openModal(`<h3>${escapeHtml(tieuDe || 'Ảnh')}</h3>
      <div style="text-align:center;"><img src="${escapeHtml(url)}" style="max-width:100%;max-height:70vh;border-radius:6px;"></div>
      <div class="modal-actions"><a class="btn secondary" href="${escapeHtml(url)}" target="_blank" rel="noopener">Mở ảnh gốc</a>
        <button class="btn" id="dmAnhDong">Đóng</button></div>`);
    m.querySelector('#dmAnhDong').addEventListener('click', closeModal);
  }
  const linkMap = (lat, lon, nhan) => (lat != null && lon != null)
    ? `<a href="https://www.google.com/maps?q=${lat},${lon}" target="_blank" rel="noopener" title="Mở Google Maps">${nhan || '📍 xem'}</a>`
    : '<span class="empty-hint" style="padding:0;">chưa có toạ độ</span>';

  /* Xin toa do hien tai. Tra ve {lat, lon, doChinhXacM} hoac nem loi CO CAU DE HIEU — nguyen nhan hay
     gap nhat khong phai "GPS yeu" ma la mo bang http:// hoac chan quyen trong Cai dat trinh duyet. */
  function xinToaDo() {
    return new Promise((ok, loi) => {
      if (!window.isSecureContext) {
        return loi(new Error('Trang đang mở bằng http:// nên trình duyệt KHÔNG cho định vị. Mở lại bằng https:// (địa chỉ HTTPS nội bộ) rồi thử lại.'));
      }
      if (!navigator.geolocation) return loi(new Error('Thiết bị/trình duyệt này không hỗ trợ định vị.'));
      navigator.geolocation.getCurrentPosition(
        p => ok({ lat: p.coords.latitude, lon: p.coords.longitude, doChinhXacM: Math.round(p.coords.accuracy || 0) }),
        e => loi(new Error(e.code === 1
          ? 'Bạn đã từ chối quyền định vị. Vào Cài đặt trình duyệt → Quyền → Vị trí để bật lại cho trang này.'
          : (e.code === 3 ? 'Quá thời gian lấy định vị — ra chỗ thoáng (không trong nhà kín) rồi thử lại.' : 'Không lấy được định vị: ' + e.message))),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  }

  /* Nap Leaflet MOT LAN. Khong tai duoc thi tra false de goi ban do bao ro, khong lam vo ca tab. */
  let __leaflet = null;
  function napLeaflet() {
    if (__leaflet) return __leaflet;
    __leaflet = new Promise((ok) => {
      if (window.L) return ok(true);
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      js.onload = () => ok(!!window.L);
      js.onerror = () => ok(false);
      document.head.appendChild(js);
    });
    return __leaflet;
  }

  /* ================================================================================================
     v7.24 — TU DO NGUON TILE (anh nen ban do)
     Trieu chung da gap: marker xanh hien ra nhung KHONG CO ANH BAN DO. Nghia la Leaflet (cdnjs) tai
     duoc, con MAY CHU TILE bi mang chan — rat hay gap voi tile.openstreetmap.org o mang cong ty/nha
     mang VN. Leaflet khong bao loi gi ca, chi de nen trong => nhin nhu "phan mem loi".
     Nay: tai THU 1 anh tile that tu tung nguon, dung nguon dau tien chay duoc. Khong nguon nao chay
     thi noi ro LA DO MANG CHAN va van liet ke diem kem link Google Maps de con dung duoc.
     Muon dung tile rieng/proxy noi bo: them dong CauHinhHeThong `DMS_TILE_URL` (dang
     https://may-chu/{z}/{x}/{y}.png) — backend tra ve trong /api/dms/danhmuc -> cauHinh.tileUrl.
     ================================================================================================ */
  const NGUON_TILE = [
    { ten: 'OpenStreetMap', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', thu: 'https://a.tile.openstreetmap.org/12/3272/1965.png', ghi: '© OpenStreetMap' },
    { ten: 'OSM Đức',       url: 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png',  thu: 'https://a.tile.openstreetmap.de/12/3272/1965.png',  ghi: '© OpenStreetMap DE' },
    { ten: 'Carto',         url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', thu: 'https://a.basemaps.cartocdn.com/light_all/12/3272/1965.png', ghi: '© OpenStreetMap, © CARTO' }
  ];
  let __tileOk = undefined;   // undefined = chua do, null = khong nguon nao duoc

  function thuMotTile(url, hanMs) {
    return new Promise(ok => {
      const img = new Image();
      const xong = kq => { img.onload = img.onerror = null; ok(kq); };
      const t = setTimeout(() => xong(false), hanMs || 5000);
      img.onload = () => { clearTimeout(t); xong(img.naturalWidth > 0); };
      img.onerror = () => { clearTimeout(t); xong(false); };
      img.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + Date.now();
    });
  }
  async function doNguonTile() {
    if (__tileOk !== undefined) return __tileOk;
    const riengs = (dm.cauHinh && dm.cauHinh.tileUrl) ? [{ ten: 'Tile nội bộ', url: dm.cauHinh.tileUrl,
      thu: dm.cauHinh.tileUrl.replace('{z}', '12').replace('{x}', '3272').replace('{y}', '1965').replace('{s}', 'a'), ghi: '' }] : [];
    for (const n of riengs.concat(NGUON_TILE)) {
      if (await thuMotTile(n.thu)) { __tileOk = n; return n; }
    }
    __tileOk = null;
    return null;
  }

  /* Ve ban do vao 1 the div. `diem` = [{lat, lon, nhan, phu, mau, thuTu}]; `noiTuyen` = ve duong noi. */
  async function veBanDo(divId, diem, noiTuyen) {
    const box = document.getElementById(divId);
    if (!box) return;
    const hopLe = (diem || []).filter(d => d.lat != null && d.lon != null && !isNaN(d.lat) && !isNaN(d.lon));
    box.innerHTML = '<div class="empty-hint">Đang tải bản đồ...</div>';
    const coLeaflet = await napLeaflet();
    const nguon = coLeaflet ? await doNguonTile() : null;

    /* Khong ve duoc thi VAN DUNG DUOC: liet ke diem + link mo Google Maps (ca tuyen mot lan). */
    const veThayThe = (lyDo) => {
      const dsLink = hopLe.map((d, i) => `<div style="padding:2px 0;">
          ${d.thuTu != null ? d.thuTu : i + 1}. ${escapeHtml(d.nhan || '')}
          <a href="https://www.google.com/maps?q=${d.lat},${d.lon}" target="_blank" rel="noopener">📍 mở</a></div>`).join('');
      const caTuyen = hopLe.length > 1
        ? `<a class="btn small secondary" target="_blank" rel="noopener"
             href="https://www.google.com/maps/dir/${hopLe.map(d => d.lat + ',' + d.lon).join('/')}">🗺️ Mở cả tuyến trên Google Maps</a>` : '';
      box.innerHTML = `<div class="empty-hint" style="text-align:left;">
        <b style="color:#a50e0e;">${escapeHtml(lyDo)}</b><br>
        ${caTuyen}
        <div style="margin-top:6px;max-height:300px;overflow:auto;">${dsLink || 'Chưa có điểm nào có toạ độ.'}</div>
        <button type="button" class="btn small secondary dm-thu-lai" style="margin-top:6px;">Thử lại</button></div>`;
      const btn = box.querySelector('.dm-thu-lai');
      if (btn) btn.addEventListener('click', () => { __tileOk = undefined; __leaflet = null; veBanDo(divId, diem, noiTuyen); });
    };

    if (!coLeaflet) return veThayThe('Không tải được thư viện bản đồ — máy này không vào được cdnjs.cloudflare.com.');
    if (!nguon) return veThayThe('Mạng của máy này CHẶN mọi máy chủ ảnh bản đồ (OpenStreetMap / Carto). Nhờ IT mở, hoặc dùng các link Google Maps dưới đây.');
    if (!hopLe.length) { box.innerHTML = '<div class="empty-hint">Chưa có điểm nào có toạ độ để vẽ lên bản đồ.</div>'; return; }

    box.innerHTML = '';
    if (!box.style.height) box.style.height = '420px';
    const map = L.map(box).setView([hopLe[0].lat, hopLe[0].lon], 14);
    L.tileLayer(nguon.url, { maxZoom: 19, attribution: nguon.ghi }).addTo(map);
    const bounds = [];
    hopLe.forEach((d, i) => {
      L.circleMarker([d.lat, d.lon], {
        radius: 9, color: d.mau || '#1a56c4', fillColor: d.mau || '#1a56c4', fillOpacity: 0.85, weight: 2
      }).addTo(map).bindPopup(`<b>${d.thuTu != null ? d.thuTu + '. ' : ''}${escapeHtml(d.nhan || '')}</b>`
        + (d.phu ? '<br>' + escapeHtml(d.phu) : '')
        + `<br><a href="https://www.google.com/maps?q=${d.lat},${d.lon}" target="_blank" rel="noopener">Mở Google Maps</a>`);
      bounds.push([d.lat, d.lon]);
    });
    if (noiTuyen && bounds.length > 1) L.polyline(bounds, { color: '#1a56c4', weight: 3, opacity: 0.6 }).addTo(map);
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
    /* Modal/tab vua hien -> Leaflet do sai kich thuoc, ban do bi xam mot nua. Do lai sau khi ve. */
    setTimeout(() => map.invalidateSize(), 200);
    setTimeout(() => map.invalidateSize(), 800);
  }

  /* ============================== TAB 1: SHOP BAN LE ============================== */
  async function renderShop() {
    const body = document.getElementById('dmsBody');
    let rows;
    try { rows = (await apiGet('/api/dms/shop')).data; }
    catch (e) { body.innerHTML = `<div class="empty-hint">Không tải được danh sách shop: <b>${escapeHtml(e.message)}</b></div>`; return; }
    body.innerHTML = `
      <div class="toolbar">
        ${dmPerm.canCreate ? '<button class="btn" id="dmThemShop">+ Thêm shop</button>' : ''}
        <label>NPP: </label><select id="dmLocNPP" style="width:220px;"><option value="">— Tất cả —</option>${dm.npp.map(k => `<option value="${k.KhachHangID}">${escapeHtml(k.TenKhachHang)}</option>`).join('')}</select>
        <label>Phụ trách: </label><select id="dmLocNV" style="width:200px;">${optNV('', '— Tất cả —')}</select>
        <label>Trạng thái: </label><select id="dmLocTT" data-nosearch style="width:140px;"><option value="">— Tất cả —</option>${TRANG_THAI_SHOP.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
        <button class="btn small secondary" id="dmXemBanDo">🗺️ Xem bản đồ</button>
      </div>
      <div id="dmBanDoShop" style="display:none;height:420px;margin-bottom:12px;border:1px solid #dadce0;border-radius:6px;"></div>
      <table><thead><tr>
        <th style="width:46px">STT</th><th>Mã shop</th><th>Tên shop</th><th>Nhà phân phối</th>
        <th>Liên hệ</th><th>Địa chỉ</th><th style="width:70px">Vị trí</th><th>Phụ trách</th>
        <th>Trạng thái</th><th>Ghé thăm</th><th style="width:200px">Thao tác</th></tr></thead>
      <tbody id="dmShopBody"></tbody></table>`;

    const veBang = () => {
      const npp = document.getElementById('dmLocNPP').value;
      const nv = document.getElementById('dmLocNV').value;
      const tt = document.getElementById('dmLocTT').value;
      const ds = rows.filter(r => (!npp || String(r.NhaPhanPhoiID) === npp)
        && (!nv || String(r.NhanVienPhuTrachID) === nv)
        && (!tt || String(r.TrangThai) === tt));
      document.getElementById('dmShopBody').innerHTML = ds.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td><a href="javascript:void(0)" class="dm-lichsu" data-id="${r.ShopID}" title="Xem lịch sử chăm sóc"><b>${escapeHtml(r.MaShop)}</b></a></td>
        <td>${r.AnhMatTien ? `<img class="thumb dm-anh" data-src="${escapeHtml(r.AnhMatTien)}" src="${escapeHtml(anhNho(r.AnhMatTien, 80))}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;cursor:pointer;vertical-align:middle;margin-right:4px;">` : ''}${escapeHtml(r.TenShop)}</td>
        <td>${escapeHtml(r.TenNPP || '')}</td>
        <td>${escapeHtml(r.NguoiLienHe || '')}${r.SDT ? `<div style="font-size:11px;color:#5f6368;">${escapeHtml(r.SDT)}</div>` : ''}</td>
        <td>${escapeHtml(r.DiaChi || '')}${r.QuanHuyen || r.TinhThanh ? `<div style="font-size:11px;color:#5f6368;">${escapeHtml([r.QuanHuyen, r.TinhThanh].filter(Boolean).join(', '))}</div>` : ''}</td>
        <td>${linkMap(r.Latitude, r.Longitude)}</td>
        <td>${escapeHtml(r.TenNVPhuTrach || '')}</td>
        <td>${statusBadge(r.TrangThai)}</td>
        <td>${Number(r.SoLanGhe) ? `${fmtNumber(r.SoLanGhe)} lần<div style="font-size:11px;color:#5f6368;">gần nhất ${fmtDate(r.LanCuoi)}</div>` : '<span class="empty-hint" style="padding:0;">chưa ghé</span>'}</td>
        <td>
          ${dmPerm.canEdit ? `<button class="btn small secondary dm-sua" data-id="${r.ShopID}">Sửa</button> ` : ''}
          <button class="btn small secondary dm-lichsu" data-id="${r.ShopID}">Lịch sử</button>
          ${dmPerm.canDelete ? ` <button class="btn small danger dm-xoa" data-id="${r.ShopID}">Xóa</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="11" class="empty-hint">Chưa có shop nào — bấm "+ Thêm shop".</td></tr>';

      document.querySelectorAll('.dm-sua').forEach(b => b.addEventListener('click', () => {
        formShop(rows.find(x => String(x.ShopID) === b.dataset.id));
      }));
      document.querySelectorAll('.dm-lichsu').forEach(b => b.addEventListener('click', () => {
        lichSuShop(rows.find(x => String(x.ShopID) === b.dataset.id))
          .catch(err => toast('Không mở được lịch sử: ' + err.message, 'error'));
      }));
      document.querySelectorAll('.dm-xoa').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Xóa shop này?')) return;
        try { await apiDelete('/api/dms/shop/' + b.dataset.id); toast('Đã xóa shop.', 'success'); renderShop(); }
        catch (err) { toast(err.message, 'error'); }
      }));
      document.querySelectorAll('.dm-anh').forEach(img => img.addEventListener('click',
        () => xemAnh(img.dataset.src, 'Ảnh mặt tiền')));
    };
    ['dmLocNPP', 'dmLocNV', 'dmLocTT'].forEach(id => document.getElementById(id).addEventListener('change', veBang));
    if (dmPerm.canCreate) document.getElementById('dmThemShop').addEventListener('click', () => formShop(null));
    document.getElementById('dmXemBanDo').addEventListener('click', () => {
      const box = document.getElementById('dmBanDoShop');
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
      if (box.style.display === 'block') {
        veBanDo('dmBanDoShop', rows.map(r => ({
          lat: r.Latitude, lon: r.Longitude, nhan: r.MaShop + ' · ' + r.TenShop,
          phu: [r.DiaChi, r.TenNPP].filter(Boolean).join(' — '),
          mau: r.TrangThai === 'Đang bán' ? '#137333' : (r.TrangThai === 'Tiềm năng' ? '#b06000' : '#5f6368')
        })), false);
      }
    });
    veBang();
  }

  async function formShop(r) {
    const laSua = !!r;
    const modal = openModal(`
      <h3>${laSua ? 'Sửa shop ' + escapeHtml(r.MaShop) : 'Thêm shop bán lẻ'}</h3>
      <form id="dmFShop">
        <div class="form-grid">
          <div class="form-row"><label>Tên shop *</label><input name="tenShop" required value="${escapeHtml(laSua ? r.TenShop : '')}"></div>
          <div class="form-row"><label>Thuộc nhà phân phối</label><select name="nhaPhanPhoiId">${optNPP(laSua ? r.NhaPhanPhoiID : '')}</select></div>
          <div class="form-row"><label>Người liên hệ</label><input name="nguoiLienHe" value="${escapeHtml(laSua ? (r.NguoiLienHe || '') : '')}"></div>
          <div class="form-row"><label>Điện thoại</label><input name="sdt" value="${escapeHtml(laSua ? (r.SDT || '') : '')}"></div>
          <div class="form-row"><label>Địa chỉ</label><input name="diaChi" value="${escapeHtml(laSua ? (r.DiaChi || '') : '')}"></div>
          <div class="form-row"><label>Quận / Huyện</label><input name="quanHuyen" value="${escapeHtml(laSua ? (r.QuanHuyen || '') : '')}"></div>
          <div class="form-row"><label>Tỉnh / Thành</label><input name="tinhThanh" value="${escapeHtml(laSua ? (r.TinhThanh || '') : '')}"></div>
          <div class="form-row"><label>Nhân viên phụ trách</label><select name="nhanVienPhuTrachId">${optNV(laSua ? r.NhanVienPhuTrachID : '')}</select></div>
          <div class="form-row"><label>Trạng thái</label><select name="trangThai" data-nosearch>${TRANG_THAI_SHOP.map(t => `<option value="${t}" ${laSua && r.TrangThai === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="form-row"><label>Toạ độ (vĩ độ, kinh độ)</label>
            <div style="display:flex;gap:6px;">
              <input name="latitude" id="dmLat" placeholder="21.0278334" style="width:50%;" value="${laSua && r.Latitude != null ? r.Latitude : ''}">
              <input name="longitude" id="dmLon" placeholder="105.8341598" style="width:50%;" value="${laSua && r.Longitude != null ? r.Longitude : ''}">
            </div>
            <button type="button" class="btn small secondary" id="dmLayViTri" style="margin-top:4px;">📍 Lấy vị trí tôi đang đứng</button>
            <div style="font-size:11px;color:#5f6368;">Không khai ở đây cũng được — lần đầu nhân viên check-in tại shop, hệ thống lấy luôn toạ độ đó.</div>
          </div>
          <div class="form-row"><label>Ảnh mặt tiền</label>
            <input type="file" id="dmAnhFile" accept="image/*">
            <input type="hidden" name="anhMatTien" id="dmAnh" value="${escapeHtml(laSua ? (r.AnhMatTien || '') : '')}">
            <div id="dmAnhXem" style="margin-top:4px;">${laSua && r.AnhMatTien ? `<img src="${escapeHtml(anhNho(r.AnhMatTien, 160))}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;">` : ''}</div>
          </div>
        </div>
        <div class="form-row"><label>Ghi chú chăm sóc (gu hàng, kỳ nhập, người quyết định...)</label>
          <textarea name="ghiChu" rows="3">${escapeHtml(laSua ? (r.GhiChu || '') : '')}</textarea></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="dmHuy">Hủy</button>
          <button type="submit" class="btn">${laSua ? 'Lưu thay đổi' : 'Thêm shop'}</button>
        </div>
      </form>`);
    modal.querySelector('#dmHuy').addEventListener('click', closeModal);
    modal.querySelector('#dmLayViTri').addEventListener('click', async () => {
      try {
        const v = await xinToaDo();
        modal.querySelector('#dmLat').value = v.lat.toFixed(7);
        modal.querySelector('#dmLon').value = v.lon.toFixed(7);
        toast(`Đã lấy vị trí (sai số ~${v.doChinhXacM}m).`, 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
    modal.querySelector('#dmAnhFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const url = await uploadFile(f, 'shop');
        modal.querySelector('#dmAnh').value = url;
        modal.querySelector('#dmAnhXem').innerHTML = `<img src="${escapeHtml(anhNho(url, 160))}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;">`;
      } catch (err) { toast('Không tải được ảnh: ' + err.message, 'error'); }
    });
    modal.querySelector('#dmFShop').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const b = {};
      fd.forEach((v, k) => { b[k] = v; });
      try {
        if (laSua) await apiPut('/api/dms/shop/' + r.ShopID, b);
        else await apiPost('/api/dms/shop', b);
        closeModal(); toast(laSua ? 'Đã lưu shop.' : 'Đã thêm shop.', 'success'); renderShop();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  async function lichSuShop(r) {
    const rows = (await apiGet(`/api/dms/shop/${r.ShopID}/lichsu`)).data;
    const modal = openModal(`
      <h3>Lịch sử chăm sóc — ${escapeHtml(r.MaShop)} · ${escapeHtml(r.TenShop)}</h3>
      <div class="form-grid" style="margin-bottom:10px;">
        <div><b>NPP:</b> ${escapeHtml(r.TenNPP || '—')}</div>
        <div><b>Phụ trách:</b> ${escapeHtml(r.TenNVPhuTrach || '—')}</div>
        <div><b>Liên hệ:</b> ${escapeHtml(r.NguoiLienHe || '')} ${escapeHtml(r.SDT || '')}</div>
        <div><b>Vị trí:</b> ${linkMap(r.Latitude, r.Longitude, '📍 mở bản đồ')}</div>
      </div>
      ${r.GhiChu ? `<div class="empty-hint" style="text-align:left;white-space:pre-wrap;">${escapeHtml(r.GhiChu)}</div>` : ''}
      <table><thead><tr><th style="width:46px">STT</th><th>Thời gian</th><th>Hình thức</th><th>Nhân viên</th>
        <th>Kết quả</th><th>Khoảng cách</th><th>Phiếu bán hàng</th><th>Ghi chú</th><th>Ảnh</th></tr></thead>
      <tbody>${rows.map((g, i) => `<tr>
        <td>${i + 1}</td><td>${fmtDateTime(g.ThoiGianVao)}</td>
        <td>${g.LoaiTiepXuc === 'GheTham' ? '🚶 Ghé thăm' : (g.LoaiTiepXuc === 'GoiDien' ? '📞 Gọi điện' : '💬 Zalo')}</td>
        <td>${escapeHtml(g.TenNhanVien || '')}</td>
        <td>${g.KetQua ? statusBadge(g.KetQua) : ''}</td>
        <td>${g.KhoangCachM != null ? `${fmtNumber(g.KhoangCachM)} m${g.NgoaiVung ? ' <span class="badge danger">ngoài vùng</span>' : ''}` : ''}</td>
        <td>${g.SoPhieu ? `${escapeHtml(g.SoPhieu)}<div style="font-size:11px;color:#5f6368;">${fmtTien(g.TongThanhToan)} đ</div>` : ''}</td>
        <td style="white-space:pre-wrap;">${escapeHtml(g.GhiChu || '')}</td>
        <td>${g.Anh ? `<img src="${escapeHtml(anhNho(g.Anh, 80))}" style="width:34px;height:34px;object-fit:cover;border-radius:4px;">` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Chưa có lần tiếp xúc nào</td></tr>'}</tbody></table>
      <div class="modal-actions"><button class="btn secondary" id="dmDong">Đóng</button></div>`);
    modal.querySelector('.modal').style.maxWidth = 'min(1000px, 96vw)';
    modal.querySelector('#dmDong').addEventListener('click', closeModal);
  }

  /* ============================== TAB 2: TUYEN & LICH ============================== */
  async function renderTuyen() {
    const body = document.getElementById('dmsBody');
    const [tRes, sRes] = await Promise.all([apiGet('/api/dms/tuyen'), apiGet('/api/dms/shop')]);
    const { tuyen, chiTiet } = tRes.data;
    const shops = sRes.data;
    const now = new Date();
    body.innerHTML = `
      <div class="toolbar">
        ${dmPerm.canCreate ? '<button class="btn" id="dmThemTuyen">+ Thêm tuyến</button>' : ''}
        ${dmPerm.canCreate ? '<button class="btn secondary" id="dmThemLich">+ Xếp lịch đi</button>' : ''}
        <label>Tháng: </label><input type="number" id="dmLichThang" min="1" max="12" value="${now.getMonth() + 1}" style="width:70px;">
        <label>Năm: </label><input type="number" id="dmLichNam" value="${now.getFullYear()}" style="width:90px;">
        <button class="btn small secondary" id="dmXemLich">Xem lịch</button>
      </div>
      <h4 style="margin:6px 0;">Tuyến bán hàng</h4>
      <table><thead><tr><th style="width:46px">STT</th><th>Mã tuyến</th><th>Tên tuyến</th><th>Nhân viên</th>
        <th>Ngày trong tuần</th><th>Số shop</th><th>Trạng thái</th><th style="width:170px">Thao tác</th></tr></thead>
      <tbody>${tuyen.map((t, i) => `<tr>
        <td>${i + 1}</td><td><b>${escapeHtml(t.MaTuyen)}</b></td><td>${escapeHtml(t.TenTuyen)}</td>
        <td>${escapeHtml(t.TenNhanVien || '')}</td>
        <td>${String(t.ThuTrongTuan || '').split(',').filter(Boolean).map(v => (THU.find(x => x.v === v) || {}).t || v).join(', ')}</td>
        <td>${fmtNumber(t.SoShop)}</td><td>${statusBadge(t.TrangThai)}</td>
        <td>${dmPerm.canEdit ? `<button class="btn small secondary dmt-sua" data-id="${t.TuyenID}">Sửa</button> ` : ''}
            ${dmPerm.canDelete ? `<button class="btn small danger dmt-xoa" data-id="${t.TuyenID}">Xóa</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="8" class="empty-hint">Chưa có tuyến nào</td></tr>'}</tbody></table>
      <h4 style="margin:18px 0 6px;">Lịch đi tuyến trong tháng</h4>
      <div id="dmLichBody"><div class="empty-hint">Bấm "Xem lịch".</div></div>`;

    if (dmPerm.canCreate) {
      document.getElementById('dmThemTuyen').addEventListener('click', () => formTuyen(null, shops, chiTiet));
      document.getElementById('dmThemLich').addEventListener('click', () => formLich());
    }
    document.querySelectorAll('.dmt-sua').forEach(b => b.addEventListener('click',
      () => formTuyen(tuyen.find(x => String(x.TuyenID) === b.dataset.id), shops, chiTiet)));
    document.querySelectorAll('.dmt-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa tuyến này?')) return;
      try { await apiDelete('/api/dms/tuyen/' + b.dataset.id); toast('Đã xóa tuyến.', 'success'); renderTuyen(); }
      catch (err) { toast(err.message, 'error'); }
    }));
    const xemLich = async () => {
      const nam = document.getElementById('dmLichNam').value;
      const thang = document.getElementById('dmLichThang').value;
      const box = document.getElementById('dmLichBody');
      box.innerHTML = '<div class="empty-hint">Đang tải...</div>';
      try {
        const rows = (await apiGet(`/api/dms/lich?nam=${nam}&thang=${thang}`)).data;
        box.innerHTML = `<table><thead><tr><th style="width:46px">STT</th><th>Ngày</th><th>Nhân viên</th><th>Tuyến</th>
          <th>Kế hoạch</th><th>Đã ghé</th><th>Ghi chú</th><th style="width:90px">Thao tác</th></tr></thead>
          <tbody>${rows.map((l, i) => `<tr>
            <td>${i + 1}</td><td>${fmtDate(l.Ngay)}</td><td>${escapeHtml(l.TenNhanVien || '')}</td>
            <td>${escapeHtml(l.TenTuyen || '— đi tự do —')}</td>
            <td>${fmtNumber(l.SoShopKeHoach)} shop</td>
            <td>${fmtNumber(l.SoShopDaGhe)} shop${Number(l.SoShopKeHoach) ? ` <span style="font-size:11px;color:#5f6368;">(${Math.round(100 * l.SoShopDaGhe / l.SoShopKeHoach)}%)</span>` : ''}</td>
            <td>${escapeHtml(l.GhiChu || '')}</td>
            <td>${dmPerm.canDelete ? `<button class="btn small danger dml-xoa" data-id="${l.LichID}">Xóa</button>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="8" class="empty-hint">Tháng này chưa xếp lịch</td></tr>'}</tbody></table>`;
        box.querySelectorAll('.dml-xoa').forEach(b => b.addEventListener('click', async () => {
          try { await apiDelete('/api/dms/lich/' + b.dataset.id); toast('Đã xóa lịch.', 'success'); xemLich(); }
          catch (err) { toast(err.message, 'error'); }
        }));
      } catch (err) { box.innerHTML = `<div class="empty-hint">Không tải được lịch: <b>${escapeHtml(err.message)}</b></div>`; }
    };
    document.getElementById('dmXemLich').addEventListener('click', xemLich);
    xemLich();
  }

  function formTuyen(t, shops, chiTiet) {
    const laSua = !!t;
    const dangCo = laSua ? chiTiet.filter(c => String(c.TuyenID) === String(t.TuyenID)).map(c => String(c.ShopID)) : [];
    const thuCo = laSua ? String(t.ThuTrongTuan || '').split(',') : [];
    const modal = openModal(`
      <h3>${laSua ? 'Sửa tuyến ' + escapeHtml(t.MaTuyen) : 'Thêm tuyến bán hàng'}</h3>
      <form id="dmFTuyen">
        <div class="form-grid">
          <div class="form-row"><label>Tên tuyến *</label><input name="tenTuyen" required value="${escapeHtml(laSua ? t.TenTuyen : '')}"></div>
          <div class="form-row"><label>Nhân viên phụ trách</label><select name="nhanVienId">${optNV(laSua ? t.NhanVienID : '')}</select></div>
        </div>
        <div class="form-row"><label>Ngày trong tuần</label>
          <div>${THU.map(x => `<label style="display:inline-block;margin-right:12px;font-weight:normal;">
            <input type="checkbox" class="dm-thu" value="${x.v}" ${thuCo.indexOf(x.v) !== -1 ? 'checked' : ''}> ${x.t}</label>`).join('')}</div></div>
        <div class="form-row"><label>Shop trong tuyến (thứ tự ghé = thứ tự tích)</label>
          <div style="max-height:260px;overflow:auto;border:1px solid #dadce0;border-radius:6px;padding:6px;">
            ${shops.map(s => `<label style="display:block;font-weight:normal;padding:2px 0;">
              <input type="checkbox" class="dm-shop" value="${s.ShopID}" ${dangCo.indexOf(String(s.ShopID)) !== -1 ? 'checked' : ''}>
              ${escapeHtml(s.MaShop)} · ${escapeHtml(s.TenShop)}${s.TenNPP ? ` <span style="color:#5f6368;">(${escapeHtml(s.TenNPP)})</span>` : ''}</label>`).join('')
              || '<div class="empty-hint">Chưa có shop nào — thêm shop ở tab "Shop bán lẻ" trước.</div>'}
          </div></div>
        <div class="form-row"><label>Mô tả</label><input name="moTa" value="${escapeHtml(laSua ? (t.MoTa || '') : '')}"></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="dmHuy">Hủy</button>
          <button type="submit" class="btn">${laSua ? 'Lưu thay đổi' : 'Thêm tuyến'}</button></div>
      </form>`);
    modal.querySelector('#dmHuy').addEventListener('click', closeModal);
    modal.querySelector('#dmFTuyen').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const b = { tenTuyen: fd.get('tenTuyen'), nhanVienId: fd.get('nhanVienId') || null, moTa: fd.get('moTa') };
      b.thuTrongTuan = [...modal.querySelectorAll('.dm-thu:checked')].map(x => x.value);
      b.shopIds = [...modal.querySelectorAll('.dm-shop:checked')].map(x => Number(x.value));
      try {
        if (laSua) await apiPut('/api/dms/tuyen/' + t.TuyenID, b); else await apiPost('/api/dms/tuyen', b);
        closeModal(); toast('Đã lưu tuyến.', 'success'); renderTuyen();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function formLich() {
    const modal = openModal(`
      <h3>Xếp lịch đi tuyến</h3>
      <form id="dmFLich">
        <div class="form-grid">
          <div class="form-row"><label>Nhân viên *</label><select name="nhanVienId" required>${optNV('')}</select></div>
          <div class="form-row"><label>Ngày *</label><input type="date" name="ngay" required value="${new Date().toISOString().slice(0, 10)}"></div>
          <div class="form-row"><label>Tuyến</label><select name="tuyenId"><option value="">— đi tự do (không theo tuyến) —</option>${dm.tuyen.map(t => `<option value="${t.TuyenID}">${escapeHtml(t.MaTuyen + ' · ' + t.TenTuyen)}</option>`).join('')}</select></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu"></div>
        </div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="dmHuy">Hủy</button>
          <button type="submit" class="btn">Lưu lịch</button></div>
      </form>`);
    modal.querySelector('#dmHuy').addEventListener('click', closeModal);
    modal.querySelector('#dmFLich').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiPost('/api/dms/lich', { nhanVienId: fd.get('nhanVienId'), ngay: fd.get('ngay'), tuyenId: fd.get('tuyenId') || null, ghiChu: fd.get('ghiChu') });
        closeModal(); toast('Đã xếp lịch.', 'success'); renderTuyen();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ============================== TAB 3: GHE THAM (dien thoai) ============================== */
  async function renderGheTham() {
    const body = document.getElementById('dmsBody');
    const ngay = new Date().toISOString().slice(0, 10);
    let d;
    try { d = (await apiGet('/api/dms/homnay?ngay=' + ngay)).data; }
    catch (e) { body.innerHTML = `<div class="empty-hint">Không tải được: <b>${escapeHtml(e.message)}</b></div>`; return; }
    const shops = (await apiGet('/api/dms/shop')).data;
    const daGheIds = new Set(d.daGhe.map(g => String(g.ShopID)));
    body.innerHTML = `
      ${!d.nhanVienId ? `<div class="empty-hint" style="color:#a50e0e;text-align:left;">
        Tài khoản của bạn <b>chưa gắn Nhân viên</b> nên không ghi nhận được ghé thăm.
        Nhờ quản lý vào <b>Quản lý User → Sửa tài khoản → chọn Nhân viên</b>, rồi đăng nhập lại.</div>` : ''}
      <div class="toolbar">
        <b>Hôm nay ${fmtDate(ngay)}</b>
        ${d.lich.length ? `· tuyến: ${d.lich.map(l => escapeHtml(l.TenTuyen || 'tự do')).join(', ')}` : '· chưa xếp lịch (vẫn ghé được shop bất kỳ)'}
        · đã ghé <b>${d.daGhe.length}</b> điểm
        <button class="btn" id="dmCheckin" ${d.nhanVienId ? '' : 'disabled'}>📍 Check-in tại shop</button>
        <button class="btn secondary" id="dmGoiDien" ${d.nhanVienId ? '' : 'disabled'}>📞 Ghi nhận gọi điện / Zalo</button>
        <button class="btn secondary" id="dmLenDon" ${d.nhanVienId ? '' : 'disabled'}>🛒 Lên đơn cho shop</button>
      </div>
      ${d.shopKeHoach.length ? `<h4 style="margin:6px 0;">Shop theo kế hoạch hôm nay</h4>
      <table><thead><tr><th style="width:46px">TT</th><th>Shop</th><th>Địa chỉ</th><th style="width:70px">Vị trí</th><th>Tình trạng</th></tr></thead>
      <tbody>${d.shopKeHoach.map((s, i) => `<tr ${daGheIds.has(String(s.ShopID)) ? 'style="background:#e6f4ea;"' : ''}>
        <td>${i + 1}</td><td><b>${escapeHtml(s.MaShop)}</b> · ${escapeHtml(s.TenShop)}</td>
        <td>${escapeHtml(s.DiaChi || '')}</td><td>${linkMap(s.Latitude, s.Longitude)}</td>
        <td>${daGheIds.has(String(s.ShopID)) ? '<span class="badge ok">đã ghé</span>' : '<span class="badge warn">chưa ghé</span>'}</td>
      </tr>`).join('')}</tbody></table>` : ''}
      <h4 style="margin:18px 0 6px;">Đã ghi nhận hôm nay</h4>
      <table><thead><tr><th style="width:46px">STT</th><th>Giờ</th><th>Shop</th><th>Hình thức</th><th>Kết quả</th><th>Khoảng cách</th></tr></thead>
      <tbody>${d.daGhe.map((g, i) => {
        const s = shops.find(x => String(x.ShopID) === String(g.ShopID)) || {};
        return `<tr><td>${i + 1}</td><td>${fmtDateTime(g.ThoiGianVao).slice(-5)}</td>
          <td>${escapeHtml((s.MaShop || '') + ' · ' + (s.TenShop || ''))}</td>
          <td>${g.LoaiTiepXuc === 'GheTham' ? '🚶' : (g.LoaiTiepXuc === 'GoiDien' ? '📞' : '💬')} ${escapeHtml(g.LoaiTiepXuc)}</td>
          <td>${g.KetQua ? statusBadge(g.KetQua) : ''}</td>
          <td>${g.KhoangCachM != null ? fmtNumber(g.KhoangCachM) + ' m' : ''}${g.NgoaiVung ? ' <span class="badge danger">ngoài vùng</span>' : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty-hint">Chưa ghi nhận điểm nào hôm nay</td></tr>'}</tbody></table>
      <h4 style="margin:18px 0 6px;">Đơn tôi đã lấy (30 ngày gần nhất)</h4>
      <div id="dmDonToi"><div class="empty-hint">Đang tải...</div></div>`;
    const moForm = (loai) => formGheTham(loai, d, shops);
    document.getElementById('dmCheckin').addEventListener('click', () => moForm('GheTham'));
    document.getElementById('dmGoiDien').addEventListener('click', () => moForm('GoiDien'));
    document.getElementById('dmLenDon').addEventListener('click', () => {
      /* Gan don vao LAN GHE GAN NHAT trong ngay cua chinh shop do (neu co) — de mo lan ghe la thay don. */
      formLenDon(shops, d, null).catch(err => toast('Không mở được form lên đơn: ' + err.message, 'error'));
    });
    /* Bang "don toi da lay" — nap rieng de loi o day khong lam trang ca tab. */
    (async () => {
      const box = document.getElementById('dmDonToi');
      try {
        const ds = (await apiGet('/api/dms/donhang')).data;
        box.innerHTML = `<table><thead><tr><th style="width:46px">STT</th><th>Ngày</th><th>Shop</th><th>Mã hàng</th>
          <th>Màu</th><th>SL</th><th>Trạng thái</th><th>Phiếu bán hàng</th></tr></thead>
          <tbody>${ds.map((o, i) => `<tr>
            <td>${i + 1}</td><td>${fmtDate(o.ThoiGian)}</td>
            <td>${escapeHtml(o.MaShop ? o.MaShop + ' · ' + o.TenShop : (o.TenKhach || ''))}</td>
            <td>${escapeHtml(o.MaHang)}</td><td>${escapeHtml(o.TenMau || '')}</td>
            <td>${fmtNumber(o.SoLuongDat)} ${escapeHtml(o.DonVi || '')}</td>
            <td>${statusBadge(o.TrangThai)}</td>
            <td>${o.SoPhieu ? `${escapeHtml(o.SoPhieu)}<div style="font-size:11px;color:#5f6368;">${fmtTien(o.TongThanhToan)} đ</div>` : '<span class="empty-hint" style="padding:0;">chưa lên phiếu</span>'}</td>
          </tr>`).join('') || '<tr><td colspan="8" class="empty-hint">Chưa lấy đơn nào trong 30 ngày</td></tr>'}</tbody></table>`;
      } catch (err) { box.innerHTML = `<div class="empty-hint">Không tải được đơn: <b>${escapeHtml(err.message)}</b></div>`; }
    })();
  }

  function formGheTham(loai, d, shops) {
    const uuTien = d.shopKeHoach.map(s => s.ShopID);
    const dsShop = [...shops].sort((a, b) => (uuTien.indexOf(b.ShopID) - uuTien.indexOf(a.ShopID)));
    const modal = openModal(`
      <h3>${loai === 'GheTham' ? '📍 Check-in tại shop' : '📞 Ghi nhận gọi điện / Zalo'}</h3>
      <form id="dmFGhe">
        <div class="form-row"><label>Shop *</label>
          <select name="shopId" required>${dsShop.map(s => `<option value="${s.ShopID}">${escapeHtml(s.MaShop + ' · ' + s.TenShop)}${uuTien.indexOf(s.ShopID) !== -1 ? ' ★ trong tuyến hôm nay' : ''}</option>`).join('')}</select></div>
        ${loai !== 'GheTham' ? `<div class="form-row"><label>Hình thức</label>
          <select name="loaiTiepXuc" data-nosearch><option value="GoiDien">Gọi điện</option><option value="Zalo">Zalo / tin nhắn</option></select></div>` : ''}
        <div class="form-row"><label>Kết quả</label><select name="ketQua" data-nosearch><option value="">— chọn —</option>${KET_QUA.map(k => `<option value="${k}">${k}</option>`).join('')}</select></div>
        ${loai === 'GheTham' ? `
        <div class="form-row"><label>Vị trí hiện tại ${d.cauHinh.batBuocAnh ? '' : ''}</label>
          <div id="dmViTri" class="empty-hint" style="text-align:left;">Đang lấy định vị...</div>
          <input type="hidden" name="latitude" id="dmGLat"><input type="hidden" name="longitude" id="dmGLon">
          <button type="button" class="btn small secondary" id="dmLayLai">Lấy lại vị trí</button>
        </div>
        <div class="form-row"><label>Ảnh ${d.cauHinh.batBuocAnh ? '<span style="color:#a50e0e;">(bắt buộc)</span>' : ''}</label>
          <input type="file" id="dmGAnhFile" accept="image/*" capture="environment">
          <input type="hidden" name="anh" id="dmGAnh">
          <div id="dmGAnhXem" style="margin-top:4px;"></div></div>` : ''}
        <div class="form-row"><label>Ghi chú (khách nói gì, cần gì lần sau)</label><textarea name="ghiChu" rows="3"></textarea></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="dmHuy">Hủy</button>
          <button type="submit" class="btn">Lưu ghi nhận</button></div>
      </form>`);
    modal.querySelector('#dmHuy').addEventListener('click', closeModal);
    if (loai === 'GheTham') {
      const layViTri = async () => {
        const box = modal.querySelector('#dmViTri');
        box.textContent = 'Đang lấy định vị...';
        try {
          const v = await xinToaDo();
          modal.querySelector('#dmGLat').value = v.lat.toFixed(7);
          modal.querySelector('#dmGLon').value = v.lon.toFixed(7);
          box.innerHTML = `✅ ${v.lat.toFixed(6)}, ${v.lon.toFixed(6)} <span style="color:#5f6368;">(sai số ~${v.doChinhXacM}m)</span>`;
        } catch (err) {
          box.innerHTML = `<span style="color:#a50e0e;">${escapeHtml(err.message)}</span>`;
        }
      };
      modal.querySelector('#dmLayLai').addEventListener('click', layViTri);
      layViTri();
      modal.querySelector('#dmGAnhFile').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const url = await uploadFile(f, 'ghetham');
          modal.querySelector('#dmGAnh').value = url;
          modal.querySelector('#dmGAnhXem').innerHTML = `<img src="${escapeHtml(anhNho(url, 160))}" style="width:90px;height:90px;object-fit:cover;border-radius:6px;">`;
        } catch (err) { toast('Không tải được ảnh: ' + err.message, 'error'); }
      });
    }
    modal.querySelector('#dmFGhe').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const b = { shopId: fd.get('shopId'), loaiTiepXuc: loai === 'GheTham' ? 'GheTham' : fd.get('loaiTiepXuc'),
        ketQua: fd.get('ketQua'), ghiChu: fd.get('ghiChu'),
        latitude: fd.get('latitude') || null, longitude: fd.get('longitude') || null,
        anh: fd.get('anh') || null, lichId: (d.lich[0] || {}).LichID || null };
      try {
        const r = await apiPost('/api/dms/ghetham', b);
        closeModal();
        const kc = r.data.khoangCachM;
        if (r.data.ngoaiVung) {
          toast(`Đã lưu — nhưng vị trí cách shop ${fmtNumber(kc)} m (ngoài bán kính ${fmtNumber(r.data.banKinhM)} m) nên bị đánh dấu để quản lý xem lại.`, 'error');
        } else {
          toast('Đã ghi nhận' + (kc != null ? ` (cách shop ${fmtNumber(kc)} m).` : '.'), 'success');
        }
        renderGheTham();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ---------- FORM LEN DON TAI SHOP (v7.24) ----------
     Chi cho chon MA HANG + MAU con TON KHA DUNG (ton that - hang dang giu cho don khac): nhan vien
     ngoai thi truong khong the hua ban hang khong con. Don CHI GIU HANG, ton chi giam khi xuat phieu
     ban hang — dung nguyen tac v6.23. */
  async function formLenDon(shops, d, shopIdMacDinh) {
    const hb = (await apiGet('/api/dms/hangban')).data;
    const giuMap = new Map(hb.giu.map(g => [g.MaHangID + '|' + g.MauSacID, Number(g.SoGiu) || 0]));
    const khaDung = (mh, ms) => {
      const m = hb.mau.find(x => String(x.MaHangID) === String(mh) && String(x.MauSacID) === String(ms));
      return m ? Math.max(0, Number(m.TonCai || 0) - (giuMap.get(mh + '|' + ms) || 0)) : 0;
    };
    let idx = 0;
    let dong = [{ idx: ++idx }];
    const uuTien = (d.shopKeHoach || []).map(s => s.ShopID);
    const dsShop = [...shops].sort((a, b) => (uuTien.indexOf(b.ShopID) - uuTien.indexOf(a.ShopID)));
    const optMH = (chon) => `<option value="">-- chọn mã hàng --</option>` + hb.items.map(it =>
      `<option value="${it.MaHangID}" ${String(chon) === String(it.MaHangID) ? 'selected' : ''}>${escapeHtml(it.MaHang + ' · ' + it.TenHang)}</option>`).join('');

    const modal = openModal(`
      <h3>🛒 Lên đơn tại shop</h3>
      <form id="dmFDon">
        <div class="form-grid">
          <div class="form-row"><label>Shop *</label><select name="shopId" required>${dsShop.map(s =>
            `<option value="${s.ShopID}" ${String(shopIdMacDinh) === String(s.ShopID) ? 'selected' : ''}>${escapeHtml(s.MaShop + ' · ' + s.TenShop)}${uuTien.indexOf(s.ShopID) !== -1 ? ' ★ tuyến hôm nay' : ''}</option>`).join('')}</select></div>
          <div class="form-row"><label>Ghi chú của khách</label><input name="ghiChu"></div>
        </div>
        <table class="phieu-ke" style="table-layout:fixed;"><thead><tr>
          <th style="width:6%">STT</th><th style="width:34%">Mã hàng</th><th style="width:26%">Màu</th>
          <th style="width:14%">Số lượng</th><th style="width:14%">Khả dụng</th><th style="width:6%"></th>
        </tr></thead><tbody id="dmDonTbody"></tbody></table>
        <button type="button" class="btn small secondary" id="dmThemDong" style="margin-top:6px;">+ Thêm dòng</button>
        <div class="modal-actions"><button type="button" class="btn secondary" id="dmHuy">Hủy</button>
          <button type="submit" class="btn">Lưu đơn</button></div>
      </form>`);
    modal.querySelector('.modal').style.maxWidth = 'min(820px, 96vw)';
    modal.querySelector('#dmHuy').addEventListener('click', closeModal);

    const veDong = () => {
      modal.querySelector('#dmDonTbody').innerHTML = dong.map((r, i) => `<tr data-idx="${r.idx}">
        <td>${i + 1}</td>
        <td><select class="dd-mh" style="width:100%;">${optMH(r.maHangId)}</select></td>
        <td><select class="dd-mau" style="width:100%;"><option value="">-- màu --</option></select></td>
        <td><input type="number" class="dd-sl" min="1" step="1" style="width:100%;" value="${r.soLuong || ''}"></td>
        <td class="dd-kd" style="text-align:right;"></td>
        <td><button type="button" class="btn small danger dd-xoa" style="padding:2px 6px;">✕</button></td>
      </tr>`).join('');
      modal.querySelectorAll('#dmDonTbody tr').forEach(tr => {
        const r = dong.find(x => String(x.idx) === tr.dataset.idx);
        const selMH = tr.querySelector('.dd-mh'), selMau = tr.querySelector('.dd-mau'), oKD = tr.querySelector('.dd-kd');
        const napMau = () => {
          const ds = hb.mau.filter(m => String(m.MaHangID) === String(r.maHangId));
          selMau.innerHTML = '<option value="">-- màu --</option>' + ds.map(m =>
            `<option value="${m.MauSacID}" ${String(r.mauSacId) === String(m.MauSacID) ? 'selected' : ''}>${escapeHtml(m.TenMau)} (khả dụng ${fmtNumber(khaDung(m.MaHangID, m.MauSacID))})</option>`).join('');
          if (r.mauSacId && !ds.some(m => String(m.MauSacID) === String(r.mauSacId))) r.mauSacId = '';
          oKD.textContent = r.maHangId && r.mauSacId ? fmtNumber(khaDung(r.maHangId, r.mauSacId)) : '';
        };
        napMau();
        selMH.addEventListener('change', e => { r.maHangId = e.target.value; r.mauSacId = ''; napMau(); });
        selMau.addEventListener('change', e => { r.mauSacId = e.target.value; napMau(); });
        tr.querySelector('.dd-sl').addEventListener('input', e => { r.soLuong = e.target.value; });
        tr.querySelector('.dd-xoa').addEventListener('click', () => {
          dong = dong.filter(x => x.idx !== r.idx);
          if (!dong.length) dong = [{ idx: ++idx }];
          veDong();
        });
      });
    };
    modal.querySelector('#dmThemDong').addEventListener('click', () => { dong.push({ idx: ++idx }); veDong(); });
    veDong();

    modal.querySelector('#dmFDon').addEventListener('submit', async (e) => {
      e.preventDefault();
      /* Doc lai TU DOM truoc khi gui — bai hoc v7.18: chi tin bien trong bo nho la co dong bi loai am tham. */
      modal.querySelectorAll('#dmDonTbody tr').forEach(tr => {
        const r = dong.find(x => String(x.idx) === tr.dataset.idx);
        if (!r) return;
        const mh = tr.querySelector('.dd-mh'), mau = tr.querySelector('.dd-mau'), sl = tr.querySelector('.dd-sl');
        if (mh && mh.value) r.maHangId = mh.value;
        if (mau) r.mauSacId = mau.value;
        if (sl) r.soLuong = sl.value;
      });
      const gui = dong.filter(r => r.maHangId && Number(r.soLuong) > 0);
      if (!gui.length) { toast('Chưa có dòng hàng hợp lệ (cần mã hàng + số lượng).', 'error'); return; }
      if (gui.length < modal.querySelectorAll('#dmDonTbody tr').length) {
        const thieu = [];
        modal.querySelectorAll('#dmDonTbody tr').forEach((tr, i) => {
          const r = dong.find(x => String(x.idx) === tr.dataset.idx);
          if (!r || !r.maHangId) thieu.push(`dòng ${i + 1}: chưa chọn mã hàng`);
          else if (!(Number(r.soLuong) > 0)) thieu.push(`dòng ${i + 1}: số lượng phải > 0`);
        });
        if (thieu.length) { toast('Chưa lưu — còn dòng chưa hợp lệ:\n• ' + thieu.join('\n• '), 'error'); return; }
      }
      const fd = new FormData(e.target);
      try {
        const r = await apiPost('/api/dms/donhang', {
          shopId: fd.get('shopId'), ghiChu: fd.get('ghiChu'),
          gheThamID: (d.daGhe.filter(g => String(g.ShopID) === String(fd.get('shopId'))).pop() || {}).GheThamID || null,
          dong: gui.map(r2 => ({ maHangId: r2.maHangId, mauSacId: r2.mauSacId, soLuong: r2.soLuong, donVi: 'Cái' }))
        });
        closeModal();
        toast(`Đã lưu đơn ${r.data.soDong} dòng — hàng được giữ, văn phòng bấm "Chuyển sang phiếu bán hàng" để xuất kho.`, 'success');
        renderGheTham();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ============================== TAB 4: LO TRINH ============================== */
  async function renderLoTrinh() {
    const body = document.getElementById('dmsBody');
    const homNay = new Date().toISOString().slice(0, 10);
    body.innerHTML = `
      <div class="toolbar">
        <label>Từ ngày: </label><input type="date" id="dmLtTu" value="${homNay}">
        <label>Đến ngày: </label><input type="date" id="dmLtDen" value="${homNay}">
        <label>Nhân viên: </label><select id="dmLtNV" style="width:220px;">${optNV('', '— Tất cả —')}</select>
        <button class="btn" id="dmLtXem">Xem lộ trình</button>
      </div>
      <div id="dmLtBanDo" style="height:420px;margin-bottom:12px;border:1px solid #dadce0;border-radius:6px;"></div>
      <div id="dmLtBody"><div class="empty-hint">Chọn khoảng ngày rồi bấm "Xem lộ trình".</div></div>`;
    const xem = async () => {
      const tu = document.getElementById('dmLtTu').value;
      const den = document.getElementById('dmLtDen').value;
      const nv = document.getElementById('dmLtNV').value;
      const box = document.getElementById('dmLtBody');
      box.innerHTML = '<div class="empty-hint">Đang tải...</div>';
      try {
        const d = (await apiGet(`/api/dms/lotrinh?tuNgay=${tu}&denNgay=${den}${nv ? '&nhanVienId=' + nv : ''}`)).data;
        box.innerHTML = `
          <h4 style="margin:6px 0;">Tổng hợp theo ngày</h4>
          <table><thead><tr><th style="width:46px">STT</th><th>Ngày</th><th>Nhân viên</th><th>Số điểm</th>
            <th>Có đơn</th><th>Ngoài vùng</th><th>Giờ đầu → cuối</th><th>Đường chim bay</th></tr></thead>
          <tbody>${d.theoNgay.map((g, i) => `<tr>
            <td>${i + 1}</td><td>${fmtDate(g.Ngay)}</td><td>${escapeHtml(g.TenNhanVien || '')}</td>
            <td>${fmtNumber(g.SoDiem)}</td><td>${fmtNumber(g.SoCoDon)}</td>
            <td>${g.SoNgoaiVung ? `<span class="badge danger">${fmtNumber(g.SoNgoaiVung)}</span>` : '0'}</td>
            <td>${fmtDateTime(g.GioDau).slice(-5)} → ${fmtDateTime(g.GioCuoi).slice(-5)}</td>
            <td>${fmtNumber(Math.round(g.MetDiChuyen / 100) / 10)} km</td>
          </tr>`).join('') || '<tr><td colspan="8" class="empty-hint">Khoảng ngày này chưa có ghi nhận</td></tr>'}</tbody></table>
          <div style="font-size:11px;color:#5f6368;margin:4px 0 14px;">⚠️ "Đường chim bay" là tổng khoảng cách thẳng giữa các điểm ghé liên tiếp — LUÔN NHỎ HƠN số km xe chạy thực tế, không dùng để tính công tác phí.</div>
          <h4 style="margin:6px 0;">Từng điểm ghé</h4>
          <table><thead><tr><th style="width:46px">STT</th><th>Thời gian</th><th>Nhân viên</th><th>Shop</th>
            <th>Hình thức</th><th>Kết quả</th><th>Cách shop</th><th>Phiếu bán hàng</th><th>Ghi chú</th></tr></thead>
          <tbody>${d.diem.map((p, i) => `<tr ${p.NgoaiVung ? 'style="background:#fdecea;"' : ''}>
            <td>${i + 1}</td><td>${fmtDateTime(p.ThoiGianVao)}</td><td>${escapeHtml(p.TenNhanVien || '')}</td>
            <td><b>${escapeHtml(p.MaShop)}</b> · ${escapeHtml(p.TenShop)}<div style="font-size:11px;color:#5f6368;">${escapeHtml(p.DiaChi || '')}</div></td>
            <td>${p.LoaiTiepXuc === 'GheTham' ? '🚶 Ghé' : (p.LoaiTiepXuc === 'GoiDien' ? '📞 Gọi' : '💬 Zalo')}</td>
            <td>${p.KetQua ? statusBadge(p.KetQua) : ''}</td>
            <td>${p.KhoangCachM != null ? fmtNumber(p.KhoangCachM) + ' m' : ''}${p.NgoaiVung ? ' <span class="badge danger">ngoài vùng</span>' : ''}</td>
            <td>${p.SoPhieu ? `${escapeHtml(p.SoPhieu)}<div style="font-size:11px;color:#5f6368;">${fmtTien(p.TongThanhToan)} đ</div>` : ''}</td>
            <td style="white-space:pre-wrap;">${escapeHtml(p.GhiChu || '')}</td>
          </tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Không có điểm nào</td></tr>'}</tbody></table>`;
        veBanDo('dmLtBanDo', d.diem.map((p, i) => ({
          lat: p.Latitude != null ? p.Latitude : p.ShopLat,
          lon: p.Longitude != null ? p.Longitude : p.ShopLon,
          thuTu: i + 1, nhan: p.MaShop + ' · ' + p.TenShop,
          phu: `${fmtDateTime(p.ThoiGianVao)} — ${p.TenNhanVien || ''}${p.NgoaiVung ? ' (NGOÀI VÙNG)' : ''}`,
          mau: p.NgoaiVung ? '#a50e0e' : (p.KetQua === 'Có đơn' ? '#137333' : '#1a56c4')
        })), true);
      } catch (err) { box.innerHTML = `<div class="empty-hint">Không tải được lộ trình: <b>${escapeHtml(err.message)}</b></div>`; }
    };
    document.getElementById('dmLtXem').addEventListener('click', xem);
    xem();
  }

  /* ============================== TAB 5: DOANH SO ============================== */
  async function renderDoanhSo() {
    const body = document.getElementById('dmsBody');
    const namNay = new Date().getFullYear();
    body.innerHTML = `
      <div class="toolbar">
        <label>Năm: </label><input type="number" id="dmDsNam" value="${namNay}" style="width:90px;">
        <label>Mốc: </label><select id="dmDsMoc" data-nosearch style="width:120px;">
          <option value="thang">Tháng</option><option value="quy">Quý</option><option value="nam">Năm</option></select>
        <label>Nhân viên: </label><select id="dmDsNV" style="width:220px;">${optNV('', '— Tất cả —')}</select>
        <button class="btn" id="dmDsXem">Xem doanh số</button>
      </div>
      <div id="dmDsBody"><div class="empty-hint">Bấm "Xem doanh số".</div></div>`;
    const xem = async () => {
      const nam = document.getElementById('dmDsNam').value;
      const moc = document.getElementById('dmDsMoc').value;
      const nv = document.getElementById('dmDsNV').value;
      const box = document.getElementById('dmDsBody');
      box.innerHTML = '<div class="empty-hint">Đang tải...</div>';
      try {
        const d = (await apiGet(`/api/dms/doanhso?nam=${nam}&moc=${moc}${nv ? '&nhanVienId=' + nv : ''}`)).data;
        const nhanMoc = m => moc === 'thang' ? 'Tháng ' + m : (moc === 'quy' ? 'Quý ' + m : 'Năm ' + m);
        const hd = new Map(d.hoatDong.map(h => [h.Moc + '|' + h.NhanVienID, h]));
        const tongDS = d.rows.reduce((s, r) => s + Number(r.DoanhSo || 0), 0);
        box.innerHTML = `
          <table><thead><tr><th style="width:46px">STT</th><th>Mốc</th><th>Nhân viên</th><th>Số phiếu</th>
            <th>SL (cái)</th><th>Tiền hàng</th><th>Doanh số</th><th>Lần ghé</th><th>Số shop</th><th>Ngoài vùng</th></tr></thead>
          <tbody>${d.rows.map((r, i) => {
            const h = hd.get(r.Moc + '|' + r.NhanVienID) || {};
            return `<tr>
              <td>${i + 1}</td><td>${nhanMoc(r.Moc)}</td>
              <td>${escapeHtml(r.TenNhanVien || '(chưa gán nhân viên)')}${r.MaNhanVien ? `<div style="font-size:11px;color:#5f6368;">${escapeHtml(r.MaNhanVien)}</div>` : ''}</td>
              <td>${fmtNumber(r.SoPhieu)}</td><td>${fmtNumber(r.TongSLCai)}</td>
              <td style="text-align:right;">${fmtTien(r.TongTienHang)}</td>
              <td style="text-align:right;font-weight:bold;">${fmtTien(r.DoanhSo)}</td>
              <td>${fmtNumber(h.SoLanGhe || 0)}</td><td>${fmtNumber(h.SoShop || 0)}</td>
              <td>${h.SoNgoaiVung ? `<span class="badge danger">${fmtNumber(h.SoNgoaiVung)}</span>` : '0'}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="10" class="empty-hint">Năm ${nam} chưa có phiếu bán hàng nào gắn nhân viên kinh doanh</td></tr>`}</tbody>
          <tfoot><tr><th colspan="6" style="text-align:right;">TỔNG DOANH SỐ</th>
            <th style="text-align:right;">${fmtTien(tongDS)}</th><th colspan="3"></th></tr></tfoot></table>
          <div style="font-size:11px;color:#5f6368;margin:4px 0 14px;">Nguồn: phiếu bán hàng chưa hủy. Phiếu chưa chọn "Nhân viên kinh doanh" sẽ nằm ở dòng <i>(chưa gán nhân viên)</i> — vào Bán hàng → Sửa phiếu để gán.</div>
          <h4 style="margin:6px 0;">Doanh số theo shop / nhà phân phối</h4>
          <table><thead><tr><th style="width:46px">STT</th><th>Nhân viên</th><th>Shop</th><th>Nhà phân phối / khách</th>
            <th>Số phiếu</th><th>Doanh số</th></tr></thead>
          <tbody>${d.theoShop.map((r, i) => `<tr>
            <td>${i + 1}</td><td>${escapeHtml(r.TenNhanVien || '')}</td>
            <td>${r.MaShop ? escapeHtml(r.MaShop + ' · ' + r.TenShop) : '<span class="empty-hint" style="padding:0;">bán trực tiếp</span>'}</td>
            <td>${escapeHtml(r.TenKhachHang || '')}</td>
            <td>${fmtNumber(r.SoPhieu)}</td><td style="text-align:right;">${fmtTien(r.DoanhSo)}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Chưa có dữ liệu</td></tr>'}</tbody></table>`;
      } catch (err) { box.innerHTML = `<div class="empty-hint">Không tải được doanh số: <b>${escapeHtml(err.message)}</b></div>`; }
    };
    document.getElementById('dmDsXem').addEventListener('click', xem);
    xem();
  }

  return { render, getTabs };
})();
