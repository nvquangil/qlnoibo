/* ================================================================================================
   PHIẾU NHẬP KHO HÀNG HÓA  (v6.78)
   Tab trong phân hệ "Thẻ kho hàng hóa", quyền KHOHANG/nhapkho.

   HAI LOẠI NHẬP:
     - Từ NHÀ CUNG CẤP : hàng mua ngoài, có đơn giá → TĂNG công nợ phải trả cho NCC.
     - Từ SẢN XUẤT     : hàng xưởng mình làm ra, gắn lệnh SX, KHÔNG sinh công nợ.

   ⚠️ v6.87 — PHIẾU NHẬP CHỈ LÀ PHIẾU NHẬP, KHÔNG TẠO MÃ HÀNG.
   Mã hàng chưa có trong danh mục thì cứ gõ vào + khai Tên hàng: dòng đó lưu ở trạng thái
   "⏳ chờ tạo thẻ kho" — CHƯA cộng tồn, CHƯA tạo gì trong danh mục. Khi nào thực sự tạo thẻ kho cho
   mã đó (nút "Tạo thẻ kho") thì hệ thống mới gắn mã vào dòng và cộng tồn lúc ấy.
   Bản trước (v6.78–v6.86) tự tạo mã hàng ngay khi lưu phiếu, nên nút "Tạo thẻ kho" luôn báo
   "Mã hàng đã tồn tại" — hai chức năng đá nhau.

   Form và bản in đều KẺ BẢNG theo bộ lớp .phieu-form / .phieu-ke / .phieu-tong (style.css) — cùng
   một kiểu với phiếu nhập lại, để mọi phiếu trong hệ thống nhìn như nhau.
   ================================================================================================ */
(function () {
  let container = null, currentUser = null, perm = {}, dm = null, dsPhieu = [];

  function getTabs() { return [{ key: 'nhapkho', label: 'Phiếu nhập kho' }]; }

  async function render(el, user) {
    container = el; currentUser = user;
    perm = user.isAdmin ? { canView: 1, canCreate: 1, canEdit: 1, canDelete: 1 }
      : effectivePerm(user, 'KHOHANG', 'nhapkho', user.permissions.KHOHANG || {});
    dm = (await apiGet('/api/nhapkho/danhmuc')).data;
    await veKhung();
  }

  async function veKhung() {
    const body = document.getElementById('khBody') || container;
    body.innerHTML = `
      <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div><label>Từ ngày</label><input type="date" id="nkTu"></div>
        <div><label>Đến ngày</label><input type="date" id="nkDen"></div>
        <div><label>Loại nhập</label>
          <select id="nkLoai"><option value="">— Tất cả —</option>
            <option value="NhaCungCap">Từ nhà cung cấp</option>
            <option value="SanXuat">Từ sản xuất</option></select></div>
        <div><label>Số phiếu</label><input type="text" id="nkSoPhieu" placeholder="NK26..."></div>
        <button class="btn secondary" id="nkLoc">Lọc</button>
        <div style="flex:1"></div>
        ${perm.canCreate ? '<button class="btn" id="nkThem">+ Lập phiếu nhập kho</button>' : ''}
        <button class="btn secondary" id="nkExcel">Xuất Excel</button>
      </div>
      <div id="nkBang"><div class="empty-hint">Đang tải...</div></div>`;
    const n = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
    n('nkLoc', taiBang);
    n('nkThem', () => openForm(null));
    n('nkExcel', () => taiFile('/api/nhapkho/phieu/export?' + thamSo().toString(), 'PhieuNhapKho_DanhSach.xlsx'));
    await taiBang();
  }

  function thamSo() {
    const g = (id) => (document.getElementById(id) || {}).value || '';
    const p = new URLSearchParams();
    if (g('nkTu')) p.set('tuNgay', g('nkTu'));
    if (g('nkDen')) p.set('denNgay', g('nkDen'));
    if (g('nkLoai')) p.set('loaiNhap', g('nkLoai'));
    if (g('nkSoPhieu')) p.set('soPhieu', g('nkSoPhieu'));
    return p;
  }

  /* Tải file theo tên SERVER đặt (Content-Disposition) — cùng một kiểu với các phiếu khác. */
  async function taiFile(url, tenDuPhong) {
    const r = await fetch(url, { credentials: 'include' });
    if (!r.ok) { toast('Không tải được file: ' + r.status, 'error'); return; }
    const cd = r.headers.get('content-disposition') || '';
    const khop = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = khop ? decodeURIComponent(khop[1]) : tenDuPhong;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  const nhanLoai = (l) => l === 'SanXuat' ? 'Từ sản xuất' : 'Từ nhà cung cấp';

  async function taiBang() {
    const hop = document.getElementById('nkBang');
    if (!hop) return;
    hop.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    dsPhieu = (await apiGet('/api/nhapkho/phieu?' + thamSo().toString())).data || [];
    if (!dsPhieu.length) { hop.innerHTML = '<div class="empty-hint">Chưa có phiếu nhập kho nào.</div>'; return; }
    const con = dsPhieu.filter(r => r.TrangThai !== 'Đã hủy');
    hop.innerHTML = `
      <div class="table-wrap">
      <table class="data-table"><thead><tr>
        <th style="width:50px;">STT</th><th>Số phiếu</th><th>Ngày</th><th>Loại nhập</th>
        <th>Nhà cung cấp / Lệnh SX</th><th>Số HĐ</th><th class="num">Số dòng</th>
        <th class="num">SL (Cái)</th><th class="num">Tổng tiền</th><th>Trạng thái</th>
        <th style="width:200px;">Thao tác</th>
      </tr></thead><tbody>
        ${dsPhieu.map((r, i) => `
          <tr data-id="${r.PhieuNKID}" ${r.TrangThai === 'Đã hủy' ? 'style="opacity:.55;"' : ''}>
            <td>${i + 1}</td>
            <td><a href="#" class="act-view" data-id="${r.PhieuNKID}"><b>${escapeHtml(r.SoPhieu)}</b></a></td>
            <td>${fmtDate(r.NgayNhap)}</td>
            <td>${nhanLoai(r.LoaiNhap)}</td>
            <td>${escapeHtml(r.LoaiNhap === 'SanXuat' ? (r.MaDH || '') : (r.TenNCC || ''))}</td>
            <td>${escapeHtml(r.SoHoaDon || '')}</td>
            <td class="num">${fmtNumber(r.SoDong)}${Number(r.SoDongCho) ? ` <span class="badge" style="background:#fff3cd;color:#8a6d3b;">⏳ ${r.SoDongCho} chờ thẻ kho</span>` : ''}</td>
            <td class="num">${fmtNumber(r.TongSLCai)}</td>
            <td class="num">${r.LoaiNhap === 'SanXuat' ? '' : fmtTien(r.TongTien)}</td>
            <td>${r.TrangThai === 'Đã hủy' ? '<span class="badge red">Đã hủy</span>' : '<span class="badge green">Hoàn thành</span>'}</td>
            <td>
              <button class="btn small secondary act-view" data-id="${r.PhieuNKID}">Xem</button>
              ${perm.canEdit && r.TrangThai !== 'Đã hủy' ? `<button class="btn small secondary nk-sua" data-id="${r.PhieuNKID}">Sửa</button>` : ''}
              ${perm.canEdit && r.TrangThai !== 'Đã hủy' ? `<button class="btn small warn nk-huy" data-id="${r.PhieuNKID}">Hủy</button>` : ''}
              ${/* v6.87: nút này chỉ hiện khi phiếu CÒN dòng chờ tạo thẻ kho — tức là đúng lúc cần
                   làm việc gì. Trước đây hiện cho mọi phiếu từ sản xuất nên bấm vào thường chỉ nhận
                   thông báo "mã đã tồn tại". Mã đã có thẻ kho rồi thì sửa ở tab Thẻ kho. */''}
              ${Number(r.SoDongCho) && r.TrangThai !== 'Đã hủy' ? `<button class="btn small warn nk-tao-the" data-id="${r.PhieuNKID}">Tạo thẻ kho (${r.SoDongCho})</button>` : ''}
              ${perm.canDelete ? `<button class="btn small danger nk-xoa" data-id="${r.PhieuNKID}">Xóa</button>` : ''}
            </td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr style="font-weight:700;background:#f4f6f8;">
        <td colspan="7">TỔNG CỘNG (không tính phiếu đã hủy)</td>
        <td class="num">${fmtNumber(con.reduce((s, r) => s + (Number(r.TongSLCai) || 0), 0))}</td>
        <td class="num">${fmtTien(con.reduce((s, r) => s + (Number(r.TongTien) || 0), 0))}</td>
        <td colspan="2"></td>
      </tr></tfoot></table></div>`;

    hop.querySelectorAll('.act-view').forEach(b => b.onclick = (e) => { e.preventDefault(); xemPhieu(b.dataset.id); });
    hop.querySelectorAll('.nk-sua').forEach(b => b.onclick = () => openForm(b.dataset.id));
    hop.querySelectorAll('.nk-huy').forEach(b => b.onclick = async () => {
      if (!confirm('Hủy phiếu nhập kho này? Số lượng đã nhập sẽ bị trừ lại khỏi tồn kho.')) return;
      const kq = await apiPut(`/api/nhapkho/phieu/${b.dataset.id}/huy`, {});
      toast(kq.message || 'Đã hủy.', kq.success ? 'success' : 'error');
      if (kq.success) taiBang();
    });
    hop.querySelectorAll('.nk-xoa').forEach(b => b.onclick = async () => {
      if (!confirm('XÓA HẲN phiếu nhập kho này? Không khôi phục được.')) return;
      const kq = await apiDelete(`/api/nhapkho/phieu/${b.dataset.id}`);
      toast(kq.message || 'Đã xóa.', kq.success ? 'success' : 'error');
      if (kq.success) taiBang();
    });
    hop.querySelectorAll('.nk-tao-the').forEach(b => b.onclick = () => sangTaoTheKho(b.dataset.id));
    // v6.66.1: bấm cả dòng cũng mở chi tiết (dùng chung hàm ở common.js)
    if (typeof ganBamDongXemChiTiet === 'function') ganBamDongXemChiTiet(hop);
  }

  /* ================================================================================================
     FORM LẬP / SỬA PHIẾU — kẻ bảng
     ================================================================================================ */
  let dongForm = [];   // các dòng hàng đang nhập trên form

  async function openForm(id) {
    const sua = id ? (await apiGet('/api/nhapkho/phieu/' + id)).data : null;
    const h = sua ? sua.header : null;
    const soPhieu = h ? h.SoPhieu : ((await apiGet('/api/nhapkho/next-sophieu')).data || '');
    const homNay = new Date().toISOString().slice(0, 10);

    dongForm = sua ? sua.chiTiet.map((r, i) => ({
      idx: i, maHangId: r.MaHangID, maHang: r.MaHang, tenHang: r.TenHang, mauSacId: r.MauSacID,
      tenMau: r.TenMau, soLuong: r.SoLuong, donVi: r.DonVi, donGia: r.DonGia, ghiChu: r.GhiChu,
      loaiRi: r.LoaiRi, donViCoBan: r.DonViCoBan, donViQuyDoi: r.DonViQuyDoi
    })) : [{ idx: 0 }];

    const modal = openModal(`
      <div class="modal-head"><h3>${sua ? 'Sửa' : 'Lập'} phiếu nhập kho hàng hóa</h3></div>
      <div class="modal-body">
        <table class="phieu-form">
          <tr>
            <th>Số phiếu</th><td><input type="text" value="${escapeHtml(soPhieu)}" readonly style="width:100%;font-weight:700;"></td>
            <th>Ngày nhập <span class="bat-buoc">*</span></th>
            <td><input type="date" id="nkfNgay" value="${h ? String(h.NgayNhap).slice(0, 10) : homNay}" style="width:100%;"></td>
          </tr>
          <tr>
            <th>Loại nhập <span class="bat-buoc">*</span></th>
            <td><select id="nkfLoai" style="width:100%;">
              <option value="NhaCungCap"${h && h.LoaiNhap === 'NhaCungCap' ? ' selected' : ''}>Từ nhà cung cấp (có công nợ)</option>
              <option value="SanXuat"${h && h.LoaiNhap === 'SanXuat' ? ' selected' : ''}>Từ sản xuất (không công nợ)</option>
            </select></td>
            ${/* v6.80: chỉ vẽ ĐÚNG MỘT ô nguồn. Bản trước nhét cả 2 select rồi ẩn bớt bằng display:none
                 — ô ẩn vẫn chiếm chỗ trong luồng của ô cha nên nhìn như thừa một dòng trống. */''}
            <th id="nkfNhanNguon"></th>
            <td id="nkfONguon"></td>
          </tr>
          <tr>
            <th>Số hóa đơn</th><td><input type="text" id="nkfSoHD" value="${escapeHtml(h ? (h.SoHoaDon || '') : '')}" style="width:100%;"></td>
            <th>Ngày hóa đơn</th><td><input type="date" id="nkfNgayHD" value="${h && h.NgayHoaDon ? String(h.NgayHoaDon).slice(0, 10) : ''}" style="width:100%;"></td>
          </tr>
          <tr>
            <th>Ghi chú</th><td colspan="3"><input type="text" id="nkfGhiChu" value="${escapeHtml(h ? (h.GhiChu || '') : '')}" style="width:100%;"></td>
          </tr>
        </table>

        <div class="phieu-thanh-muc">
          <b>Dòng hàng nhập kho</b>
          <div style="flex:1"></div>
          <button type="button" class="btn small secondary" id="nkfThemDong">+ Thêm dòng</button>
        </div>
        <div class="empty-hint" style="margin:0 0 6px;">
          Mã đã có trong danh mục → cộng tồn ngay khi lưu phiếu.
          Mã <b>chưa có</b> → cứ gõ vào và khai Tên hàng, dòng đó lưu ở trạng thái
          <b style="color:#8a6d3b;">⏳ chờ tạo thẻ kho</b>: phiếu vẫn lưu bình thường nhưng
          <b>chưa cộng tồn</b>. Bấm <b>Tạo thẻ kho</b> ở danh sách phiếu để tạo mã và cộng tồn.
        </div>
        <div id="nkfBang" class="table-wrap" style="max-height:340px;overflow:auto;"></div>
        <div id="nkfTong" style="margin-top:10px;text-align:right;font-weight:700;"></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" id="nkfHuy">Hủy</button>
        <button class="btn" id="nkfLuu">${sua ? 'Lưu thay đổi & tính lại tồn kho' : 'Lưu phiếu & cộng tồn kho'}</button>
      </div>`, { rong: true });

    const $ = (s) => modal.querySelector(s);
    // Nhớ lựa chọn nguồn để đổi qua đổi lại loại nhập không mất cái đã chọn.
    let nhoNcc = h ? (h.NCC_ID || '') : '';
    let nhoDon = h ? (h.DonHangID || '') : '';

    /* Đổi loại nhập thì đổi luôn ô nguồn. Ẩn/hiện chứ không xóa khỏi DOM — để sửa phiếu chọn nhầm
       loại rồi chọn lại vẫn còn nguyên lựa chọn cũ. */
    function apLoai() {
      const sx = $('#nkfLoai').value === 'SanXuat';
      $('#nkfNhanNguon').innerHTML = sx
        ? 'Lệnh sản xuất <span class="bat-buoc">*</span>'
        : 'Nhà cung cấp <span class="bat-buoc">*</span>';
      /* Dựng lại ô nguồn theo loại. Giữ lại lựa chọn cũ nếu người dùng đổi loại rồi đổi về:
         `nhoNcc`/`nhoDon` nhớ giá trị trước đó. */
      $('#nkfONguon').innerHTML = sx
        ? `<select id="nkfDon" style="width:100%;"><option value="">-- Chọn lệnh SX đã hoàn thành --</option>
             ${(dm.donHang || []).map(d2 => `<option value="${d2.DonHangID}">${escapeHtml(d2.MaDH)}${d2.TenSanPham ? ' — ' + escapeHtml(d2.TenSanPham) : ''}</option>`).join('')}
           </select>${(dm.donHang || []).length ? '' : '<div class="empty-hint" style="margin-top:2px;">Chưa có lệnh SX nào ở trạng thái Hoàn thành.</div>'}`
        : `<select id="nkfNcc" style="width:100%;"><option value="">-- Chọn nhà cung cấp --</option>
             ${opt(dm.ncc, 'NCC_ID', 'TenNCC', '')}</select>`;
      const oN = $('#nkfNcc'), oD = $('#nkfDon');
      if (oN) { oN.value = nhoNcc || ''; oN.onchange = () => { nhoNcc = oN.value; }; }
      if (oD) { oD.value = nhoDon || ''; oD.onchange = () => { nhoDon = oD.value; }; }
      veDong();   // vẽ lại để ẩn/hiện cột Đơn giá
    }
    $('#nkfLoai').onchange = apLoai;
    $('#nkfHuy').onclick = () => closeModal();
    $('#nkfThemDong').onclick = () => {
      dongForm.push({ idx: Math.max(0, ...dongForm.map(d => d.idx)) + 1 });
      veDong();
    };

    function veDong() {
      const sx = $('#nkfLoai').value === 'SanXuat';
      $('#nkfBang').innerHTML = `
        <table class="data-table phieu-ke"><thead><tr>
          ${/* v6.80: BỎ cột Màu — phiếu nhập kho không phân màu. Backend dồn vào một màu kỹ thuật
               "(Không phân màu)" vì thẻ kho bắt buộc có màu (khóa MaHangID + MauSacID). */''}
          <th style="width:46px;">STT</th><th style="width:150px;">Mã hàng</th><th>Tên hàng</th>
          <th style="width:100px;">Số lượng</th><th style="width:90px;">ĐVT</th>
          ${sx ? '' : '<th style="width:120px;">Đơn giá</th><th style="width:130px;" class="num">Thành tiền</th>'}
          <th style="width:150px;">Ghi chú</th><th style="width:44px;"></th>
        </tr></thead><tbody>
          ${dongForm.map((d, i) => dongHtml(d, i, sx)).join('')}
        </tbody></table>`;
      ganDong(sx);
      tinhTong(sx);
    }

    function dongHtml(d, i, sx) {
      /* v6.87: dòng CHƯA có mã hàng trong danh mục = dòng chờ tạo thẻ kho.
         ĐVT của mã đã có thì chỉ được chọn trong 2 đơn vị của CHÍNH mã đó (gõ đơn vị lạ là tồn kho
         quy đổi sai). Mã chưa có thì chưa biết 2 đơn vị đó là gì -> cho chọn cả danh mục ĐVT. */
      const cho = !d.maHangId;
      const dsDV = cho
        ? ((dm.donVi || []).map(x => x.TenDonVi).filter(Boolean).length
            ? dm.donVi.map(x => x.TenDonVi).filter(Boolean) : ['Cái', 'Ri'])
        : [d.donViCoBan || 'Cái', d.donViQuyDoi || 'Ri'].filter((x, k, a) => x && a.indexOf(x) === k);
      return `<tr data-idx="${d.idx}">
        <td>${i + 1}</td>
        <td>
          <input type="text" class="nk-ma" list="nkDlMaHang" value="${escapeHtml(d.maHang || '')}" placeholder="Gõ hoặc chọn" style="width:100%;">
          ${d.maHang && cho
            ? '<div style="font-size:11px;color:#8a6d3b;margin-top:2px;">⏳ chưa có trong danh mục — chờ tạo thẻ kho</div>'
            : (d.maHangId ? '<div style="font-size:11px;color:#2e7d32;margin-top:2px;">✔ đã có thẻ kho</div>' : '')}
        </td>
        <td><input type="text" class="nk-ten" value="${escapeHtml(d.tenHang || '')}" placeholder="${cho ? 'BẮT BUỘC khai cho mã mới' : 'tự điền khi chọn mã'}" style="width:100%;"></td>
        <td><input type="number" class="nk-sl" min="0" step="0.01" value="${d.soLuong != null ? d.soLuong : ''}" style="width:100%;"></td>
        <td><select class="nk-dv" style="width:100%;">${dsDV.map(x => `<option${d.donVi === x ? ' selected' : ''}>${escapeHtml(x)}</option>`).join('')}</select></td>
        ${sx ? '' : `<td><input type="number" class="nk-gia" min="0" step="1" value="${d.donGia != null ? d.donGia : ''}" style="width:100%;"></td>
        <td class="num nk-tt">${fmtTien((Number(d.soLuong) || 0) * (Number(d.donGia) || 0))}</td>`}
        <td><input type="text" class="nk-gc" value="${escapeHtml(d.ghiChu || '')}" style="width:100%;"></td>
        <td><button type="button" class="btn small danger nk-bo">✕</button></td>
      </tr>`;
    }

    function ganDong(sx) {
      const lay = (tr) => dongForm.find(x => String(x.idx) === tr.dataset.idx);
      $('#nkfBang').querySelectorAll('tr[data-idx]').forEach(tr => {
        const d = lay(tr);
        const oMa = tr.querySelector('.nk-ma');
        oMa.onchange = () => {
          d.maHang = oMa.value.trim();
          /* Gõ xong mã: dò trong danh mục để tự điền tên + ĐVT. Không dò ra thì để nguyên cho người
             dùng tự khai và tích "Tạo mã mới" — không tự tích hộ, tránh tạo nhầm mã do gõ sai. */
          const mh = (dm.hang || []).find(x => String(x.MaHang).toUpperCase() === d.maHang.toUpperCase());
          if (mh) {
            d.maHangId = mh.MaHangID; d.tenHang = mh.TenHang; d.loaiRi = mh.LoaiRi;
            d.donViCoBan = mh.DonViCoBan; d.donViQuyDoi = mh.DonViQuyDoi;
          } else {
            /* Không dò ra: để dòng ở trạng thái chờ tạo thẻ kho. KHÔNG xóa tên hàng người dùng đã gõ,
               và KHÔNG tự tạo mã — mã hàng mới chỉ sinh ra ở màn Thẻ kho. */
            d.maHangId = null; d.donViCoBan = null; d.donViQuyDoi = null;
          }
          veDong();
        };
        tr.querySelector('.nk-ten').oninput = (e) => { d.tenHang = e.target.value; };
        tr.querySelector('.nk-sl').oninput = (e) => { d.soLuong = e.target.value; capNhatDong(tr, d, sx); };
        tr.querySelector('.nk-dv').onchange = (e) => { d.donVi = e.target.value; };
        tr.querySelector('.nk-gc').oninput = (e) => { d.ghiChu = e.target.value; };
        const oGia = tr.querySelector('.nk-gia');
        if (oGia) oGia.oninput = (e) => { d.donGia = e.target.value; capNhatDong(tr, d, sx); };
        tr.querySelector('.nk-bo').onclick = () => {
          if (dongForm.length <= 1) { toast('Phiếu phải có ít nhất 1 dòng.', 'error'); return; }
          dongForm = dongForm.filter(x => x.idx !== d.idx);
          veDong();
        };
      });
    }

    function capNhatDong(tr, d, sx) {
      if (!sx) {
        const o = tr.querySelector('.nk-tt');
        if (o) o.textContent = fmtTien((Number(d.soLuong) || 0) * (Number(d.donGia) || 0));
      }
      tinhTong(sx);
    }

    function tinhTong(sx) {
      const tong = dongForm.reduce((s, d) => s + (Number(d.soLuong) || 0) * (Number(d.donGia) || 0), 0);
      $('#nkfTong').innerHTML = sx
        ? '<span style="color:#5f6368;">Nhập từ sản xuất — không phát sinh công nợ.</span>'
        : `<span style="font-size:16px;color:#c62828;">TỔNG TIỀN PHẢI TRẢ NCC: ${fmtTien(tong)} đ</span>`;
    }

    // Danh sách gợi ý dùng chung cho mọi dòng
    modal.insertAdjacentHTML('beforeend', `
      <datalist id="nkDlMaHang">${(dm.hang || []).map(x => `<option value="${escapeHtml(x.MaHang)}">${escapeHtml(x.TenHang || '')}</option>`).join('')}</datalist>
`);

    apLoai();

    $('#nkfLuu').onclick = async () => {
      const sx = $('#nkfLoai').value === 'SanXuat';
      const dong = dongForm.filter(d => Number(d.soLuong) > 0).map(d => ({
        maHangId: d.maHangId || null, maHang: d.maHang, tenHang: d.tenHang,
        mauSacId: d.mauSacId || null, tenMau: d.tenMau || null,   // v6.80: không còn ô nhập màu; để trống -> backend dùng màu mặc định
        soLuong: d.soLuong, donVi: d.donVi, donGia: sx ? 0 : d.donGia,
        loaiRi: d.loaiRi, donViCoBan: d.donViCoBan, donViQuyDoi: d.donViQuyDoi, ghiChu: d.ghiChu
      }));
      if (!dong.length) return toast('Chưa có dòng nào có số lượng > 0.', 'error');
      if (!sx && !$('#nkfNcc').value) return toast('Nhập từ nhà cung cấp thì phải chọn nhà cung cấp.', 'error');
      const body = {
        ngayNhap: $('#nkfNgay').value, loaiNhap: sx ? 'SanXuat' : 'NhaCungCap',
        nccId: sx ? null : ($('#nkfNcc').value || null),
        donHangId: sx ? ($('#nkfDon').value || null) : null,
        soHoaDon: $('#nkfSoHD').value || null, ngayHoaDon: $('#nkfNgayHD').value || null,
        ghiChu: $('#nkfGhiChu').value || null, dong
      };
      /* ⚠️ BẮT BUỘC try/catch: apiFetch NÉM LỖI khi máy chủ trả 4xx/5xx chứ không trả {success:false}.
         Bản trước thiếu chỗ này nên chỉ cần máy chủ báo lỗi là handler văng giữa chừng, dòng
         `disabled = false` không bao giờ chạy -> nút Lưu kẹt cứng, bấm không thấy gì xảy ra và
         cũng không có thông báo lỗi nào. Đây đúng là lỗi vừa gặp. */
      $('#nkfLuu').disabled = true;
      try {
        const kq = id ? await apiPut('/api/nhapkho/phieu/' + id, body) : await apiPost('/api/nhapkho/phieu', body);
        if (!kq.success) { toast(kq.message || 'Lỗi khi lưu phiếu.', 'error'); return; }
        toast(kq.message || 'Đã lưu phiếu.', 'success');
        closeModal();
        dm = (await apiGet('/api/nhapkho/danhmuc')).data;   // nạp lại: có thể vừa tạo mã hàng mới
        await taiBang();
        xemPhieu(id || kq.data.phieuNKID);
      } catch (err) {
        toast(err.message || 'Lỗi khi lưu phiếu.', 'error');
      } finally {
        const b2 = $('#nkfLuu');
        if (b2) b2.disabled = false;     // modal có thể đã đóng -> phải kiểm tra trước khi gán
      }
    };
  }

  /* ================================================================================================
     v6.84: SANG TAB THẺ KHO ĐỂ TẠO THẺ KHO TỪ PHIẾU NÀY.
     Phải ĐỔI TAB TRƯỚC rồi mới mở form: form thẻ kho gắn vào #khBody của tab Thẻ kho — mở khi đang
     ở tab Phiếu nhập kho thì đóng form ra là thấy màn hình sai, và các ô của form không tìm thấy
     phần tử cha để bám.
     switchModule là hàm toàn cục của app.js; dò trước rồi mới gọi để nếu app.js đổi cách làm thì
     báo lỗi rõ ràng chứ không im lặng không có gì xảy ra.
     ================================================================================================ */
  async function sangTaoTheKho(phieuNKID) {
    if (typeof switchModule !== 'function' || !window.ModuleKhoHang || !window.ModuleKhoHang.taoTheKhoTuPhieu) {
      toast('Chưa nạp đủ module — copy module.khohang.js rồi Ctrl+F5.', 'error');
      return;
    }
    closeAllModals();                       // đang mở popup xem phiếu thì đóng hết trước khi đổi tab
    await switchModule('KHOHANG', 'items');
    await window.ModuleKhoHang.taoTheKhoTuPhieu(phieuNKID);
  }

  /* ================================================================================================
     XEM CHI TIẾT + IN — kẻ bảng, dùng CHUNG một hàm cho cả màn xem và bản in
     ================================================================================================ */
  function dauPhieuHtml(h) {
    const sx = h.LoaiNhap === 'SanXuat';
    return `
      <table class="phieu-form phieu-xem">
        <tr><th>Số phiếu</th><td><b>${escapeHtml(h.SoPhieu || '')}</b></td>
            <th>Ngày nhập</th><td>${fmtDate(h.NgayNhap)}</td></tr>
        <tr><th>Loại nhập</th><td>${nhanLoai(h.LoaiNhap)}</td>
            <th>${sx ? 'Lệnh sản xuất' : 'Nhà cung cấp'}</th>
            <td><b>${escapeHtml(sx ? (h.MaDH || '') : (h.TenNCC || ''))}</b></td></tr>
        ${sx ? '' : `<tr><th>Địa chỉ NCC</th><td colspan="3">${escapeHtml(h.DiaChiNCC || '')}</td></tr>`}
        <tr><th>Số hóa đơn</th><td>${escapeHtml(h.SoHoaDon || '')}</td>
            <th>Ngày hóa đơn</th><td>${h.NgayHoaDon ? fmtDate(h.NgayHoaDon) : ''}</td></tr>
        <tr><th>Ghi chú</th><td>${escapeHtml(h.GhiChu || '')}</td>
            <th>Người lập</th><td>${escapeHtml(h.NguoiTao || '')}</td></tr>
      </table>`;
  }

  function bangChiTietHtml(ct, h, choIn) {
    const sx = h.LoaiNhap === 'SanXuat';
    const P = 'text-align:right;', G = 'text-align:center;';
    const tongTien = ct.reduce((s, r) => s + (Number(r.ThanhTien) || 0), 0);
    const soCot = sx ? 7 : 9;
    return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;" border="1" cellpadding="4">
      <thead><tr style="background:#f1f3f4;">
        <th style="width:5%;${G}">STT</th><th style="width:15%;${G}">MÃ HÀNG</th>
        <th style="width:${sx ? '38' : '26'}%;${G}">TÊN HÀNG</th><th style="width:13%;${G}">MÀU</th>
        <th style="width:10%;${G}">SỐ LƯỢNG</th><th style="width:7%;${G}">ĐVT</th>
        ${sx ? '' : `<th style="width:11%;${G}">ĐƠN GIÁ</th><th style="width:13%;${G}">THÀNH TIỀN</th>`}
        <th style="width:12%;${G}">GHI CHÚ</th></tr></thead>
      <tbody>
        ${ct.map((r, i) => `<tr>
          <td style="${G}">${i + 1}</td>
          ${/* v6.87: dòng chưa có mã hàng trong danh mục — CHƯA cộng tồn. Ghi rõ cả trên bản in để
               thủ kho đối chiếu biết hàng đã về nhưng chưa vào sổ kho. */''}
          <td>${escapeHtml(r.MaHang || '')}${Number(r.ChoTaoTheKho) ? '<br><span style="font-size:10px;color:#8a6d3b;">⏳ chưa tạo thẻ kho</span>' : ''}</td>
          <td>${escapeHtml(r.TenHang || '')}</td>
          <td>${escapeHtml(r.TenMau || '')}</td>
          <td style="${P}">${fmtNumber(r.SoLuong)}</td>
          <td style="${G}">${escapeHtml(r.DonVi || '')}</td>
          ${sx ? '' : `<td style="${P}">${fmtTien(r.DonGia)}</td><td style="${P}"><b>${fmtTien(r.ThanhTien)}</b></td>`}
          <td>${escapeHtml(r.GhiChu || '')}</td></tr>`).join('')}
        ${sx ? `<tr style="font-weight:bold;background:#f1f3f4;">
          <td colspan="4" style="${G}">TỔNG CỘNG</td>
          <td style="${P}">${fmtNumber(ct.reduce((s, r) => s + (Number(r.SoLuong) || 0), 0))}</td>
          <td colspan="2"></td></tr>`
        : `<tr style="font-weight:bold;background:#f1f3f4;">
          <td colspan="4" style="${G}">TỔNG CỘNG</td>
          <td style="${P}">${fmtNumber(ct.reduce((s, r) => s + (Number(r.SoLuong) || 0), 0))}</td>
          <td colspan="2"></td>
          <td style="${P}">${fmtTien(tongTien)}</td><td></td></tr>`}
      </tbody></table>
      ${sx ? '' : `<p style="margin-top:6px;"><i>Bằng chữ: ${escapeHtml(docSoTienBangChu(tongTien))}</i></p>`}`;
  }

  async function xemPhieu(id) {
    const kq = await apiGet('/api/nhapkho/phieu/' + id);
    if (!kq.success) return toast(kq.message || 'Không mở được phiếu.', 'error');
    const h = kq.data.header, ct = kq.data.chiTiet || [];
    const modal = openModal(`
      <div class="modal-head"><h3>Phiếu nhập kho ${escapeHtml(h.SoPhieu)}
        ${h.TrangThai === 'Đã hủy' ? '<span class="badge red">Đã hủy</span>' : ''}</h3></div>
      <div class="modal-body">
        ${dauPhieuHtml(h)}
        ${bangChiTietHtml(ct, h, false)}
      </div>
      <div class="modal-foot">
        <button class="btn secondary" id="nkvDong">Đóng</button>
        ${perm.canEdit && h.TrangThai !== 'Đã hủy' ? '<button class="btn secondary" id="nkvSua">Sửa</button>' : ''}
        ${ct.some(r => Number(r.ChoTaoTheKho)) && h.TrangThai !== 'Đã hủy' ? '<button class="btn warn" id="nkvTaoThe">Tạo thẻ kho</button>' : ''}
        <button class="btn secondary" id="nkvXls">Xuất Excel</button>
        <button class="btn" id="nkvIn">In phiếu</button>
      </div>`, { rong: true });
    modal.querySelector('#nkvDong').onclick = () => closeModal();
    modal.querySelector('#nkvXls').onclick = () => taiFile(`/api/nhapkho/phieu/${id}/export`, 'PhieuNhapKho.xlsx');
    modal.querySelector('#nkvIn').onclick = () => inPhieu(h, ct);
    const bSua = modal.querySelector('#nkvSua');
    if (bSua) bSua.onclick = () => { closeModal(); openForm(id); };
    const bThe = modal.querySelector('#nkvTaoThe');
    if (bThe) bThe.onclick = () => sangTaoTheKho(id);
  }

  function inPhieu(h, ct) {
    const nguon = h.LoaiNhap === 'SanXuat' ? (h.MaDH || '') : (h.TenNCC || '');
    const tieuDe = `PhieuNhapKho ${h.SoPhieu || ''}${nguon ? ' - ' + String(nguon).replace(/[\\/:*?"<>|]/g, '-') : ''}`;
    printHtml(tieuDe, `
      ${phieuHeaderHtml('PHIẾU NHẬP KHO HÀNG HÓA', h.NgayNhap, h.SoPhieu)}
      ${dauPhieuHtml(h)}
      ${bangChiTietHtml(ct, h, true)}
      <table style="width:100%;margin-top:28px;text-align:center;">
        <tr><td><b>NGƯỜI GIAO HÀNG</b><br><i>(Ký, ghi rõ họ tên)</i></td>
            <td><b>THỦ KHO</b><br><i>(Ký, ghi rõ họ tên)</i></td>
            <td><b>NGƯỜI LẬP PHIẾU</b><br><i>(Ký, ghi rõ họ tên)</i></td></tr>
      </table>`);
  }

  window.ModuleNhapKho = { getTabs, render, xemPhieu, taiBang };
})();
