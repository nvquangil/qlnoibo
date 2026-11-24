// ================================================================
// PHAN HE "HOP DONG MUA BAN" (HOPDONG) — v9.61 (Nguyen 14/11/2026) · v9.62 giai đoạn 2
// ----------------------------------------------------------------
// 3 tab: Danh sách hợp đồng (tạo / sửa / xuất bản / gửi link / OTP / nhật ký / PDF / ký số MOYN),
//        Mẫu hợp đồng (soạn trong phần mềm hoặc tải .docx lên, biến {{...}}), Cấu hình ký.
// v9.62: loại văn bản (hợp đồng / phụ lục / thanh lý) + hợp đồng gốc; hóa đơn điện tử; nhắc hạn ký tự động;
//        ký từ xa qua CA (SmartCA / CSC) cho MOYN; chuỗi tin cậy chứng thư ở bảng "Các bên ký"; chứng thư CA gốc ở Cấu hình.
// Nghiệp vụ ở backend (routes/hopdong.js + utils/hopDongCore.js). Màn hình chỉ gọi API và vẽ.
// Ký số bằng USB token trên máy này: qua công cụ "MOYN Ký số" (js/kysoclient.js + tools/MoynKySo).
// ================================================================
window.ModuleHopDong = (function () {
  let container, currentUser, activeTab = 'danhsach';
  let perm = { canView: true, canCreate: true, canEdit: true, canDelete: true };
  let mauCache = [], khachCache = [], bienChuan = [];
  const TABS = [
    { key: 'danhsach', label: 'Danh sách hợp đồng' },
    { key: 'mau', label: 'Mẫu hợp đồng' },
    { key: 'cauhinh', label: 'Cấu hình ký' }
  ];
  const h = (s) => escapeHtml(s == null ? '' : String(s));
  const money = (v) => (v == null || v === '' ? '' : fmtNumber(Number(v)));
  const num = (v) => Number(v) || 0;
  const MAU_TT = { Nhap: '#5f6368', ChoKy: '#b06000', DangKySo: '#1967d2', ChoMoynKy: '#1967d2', DaKy: '#137333', TuChoi: '#c5221f', HetHan: '#9aa0a6', Huy: '#9aa0a6', LoiKySo: '#c5221f' };
  const TEN_TT = { Nhap: 'Nháp', ChoKy: 'Chờ khách ký', DangKySo: 'Đang ký số', ChoMoynKy: 'Chờ MOYN ký số', DaKy: 'Đã ký', TuChoi: 'Khách từ chối', HetHan: 'Hết hạn', Huy: 'Đã hủy', LoiKySo: 'Lỗi ký số' };
  const TEN_TTT = { ChuaTT: 'Chưa thanh toán', MotPhan: 'Thanh toán một phần', DaTT: 'Đã thanh toán' };
  const TEN_LOAI = { HopDong: 'Hợp đồng', PhuLuc: 'Phụ lục', ThanhLy: 'Biên bản thanh lý' };   // v9.62 — khớp core.TEN_LOAI_VAN_BAN
  const TEN_CACH_KY = { OTP: 'OTP', KySo: 'Chữ ký số', TuDong: 'Ký số tự động (máy chủ)', CongCu: 'USB token (công cụ)', TaiLen: 'Tải lên bản đã ký', TuXa: 'Ký từ xa qua CA' };
  const LOAI_DT = { CongTy: 'Công ty', HoKD: 'Hộ kinh doanh', CaNhan: 'Cá nhân' };
  /* Biến mẫu được điền TỰ ĐỘNG (bên bán từ cấu hình, bên mua từ form, hợp đồng) — không hỏi người dùng. Còn lại sinh ô nhập. */
  const BIEN_TU_DONG = /^(BenBan_|BenMua_|HopDongCha_|SoHopDong$|TenHopDong$|BangHang$|TongTien$|TongTienBangChu$|LoaiVanBan$)/;   // v9.62: + HopDongCha_*, LoaiVanBan (lấy từ hợp đồng gốc đã chọn)

  function getTabs() { return TABS; }
  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    const raw = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.HOPDONG || {});
    perm = effectivePerm(user, 'HOPDONG', activeTab, raw);
    if (activeTab === 'mau') return renderMau();
    if (activeTab === 'cauhinh') return renderCauHinh();
    return renderDanhSach();
  }
  const badge = (tt) => `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;color:#fff;background:${MAU_TT[tt] || '#5f6368'}">${h(TEN_TT[tt] || tt)}</span>`;
  async function taiFile(url, ten) {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) { let m = 'Lỗi tải file.'; try { m = (await res.json()).message || m; } catch (e) { /* bỏ */ } toast(m, 'error'); return; }
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ten; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    } catch (e) { toast(e.message, 'error'); }
  }
  async function guiFile(url, file, them) {
    const fd = new FormData(); fd.append('file', file);
    Object.keys(them || {}).forEach(k => fd.append(k, them[k]));
    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', body: fd });
    let j = {}; try { j = await res.json(); } catch (e) { /* bỏ */ }
    if (!res.ok || j.success === false) { const err = new Error(j.message || 'Lỗi tải lên'); err.data = j; throw err; }
    return j;
  }
  async function napDanhMuc() {
    try { const m = await apiGet('/api/hopdong/mau'); mauCache = m.data || []; bienChuan = m.bienChuan || []; } catch (e) { mauCache = []; }
    try { khachCache = (await apiGet('/api/hopdong/khach')).data || []; } catch (e) { khachCache = []; }
  }

  /* ================================================================ 1. DANH SÁCH ================================================================ */
  let locTT = '', locTTT = '', tuKhoa = '', locLoai = '';   // v9.62: locLoai = HopDong | PhuLuc | ThanhLy | ''
  async function renderDanhSach() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let kq;
    try {
      const qs = new URLSearchParams();
      if (locTT) qs.set('trangThai', locTT);
      if (locTTT) qs.set('thanhToan', locTTT);
      if (tuKhoa) qs.set('q', tuKhoa);
      if (locLoai) qs.set('loaiVanBan', locLoai);
      kq = await apiGet('/api/hopdong?' + qs.toString());
    } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${h(e.message)}</div>`; return; }
    if (kq.chuaCaiDat) { container.innerHTML = '<div class="empty-hint">CSDL chưa chạy <b>migration_v893.sql</b> — chạy xong rồi pm2 restart.</div>'; return; }
    const rows = kq.data || [], dem = kq.dem || {};
    const chip = (ma, nhan, n, loai) => { const dang = loai === 'ttt' ? locTTT === ma : locTT === ma;
      return `<button class="btn small ${dang ? '' : 'secondary'}" data-loc="${ma}" data-loai="${loai || 'tt'}">${h(nhan)}${n != null ? ' (' + n + ')' : ''}</button>`; };
    container.innerHTML = `
      <div class="toolbar" style="flex-wrap:wrap;gap:6px;">
        ${perm.canCreate ? '<button class="btn" id="btnTao">+ Tạo hợp đồng</button>' : ''}
        <input id="oTim" placeholder="Tìm số HĐ / tên / bên mua…" value="${h(tuKhoa)}" style="width:240px;">
        <select id="selLoai" title="Loại văn bản"><option value="">Mọi loại văn bản</option>${Object.keys(TEN_LOAI).map(k => `<option value="${k}" ${locLoai === k ? 'selected' : ''}>${TEN_LOAI[k]}</option>`).join('')}</select>
        <span style="flex:1"></span>
        ${chip('', 'Tất cả', Object.values(dem).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) - (dem.ChuaTT || 0))}
        ${chip('Nhap', 'Nháp', dem.Nhap || 0)} ${chip('ChoKy', 'Chờ ký', dem.ChoKy || 0)} ${chip('DangKySo,ChoMoynKy,LoiKySo', 'Chờ MOYN ký', (dem.DangKySo || 0) + (dem.ChoMoynKy || 0) + (dem.LoiKySo || 0))}
        ${chip('DaKy', 'Đã ký', dem.DaKy || 0)} ${chip('ChuaTT', 'Chưa thanh toán', dem.ChuaTT || 0, 'ttt')} ${chip('TuChoi,HetHan,Huy', 'Từ chối / hết hạn / hủy', (dem.TuChoi || 0) + (dem.HetHan || 0) + (dem.Huy || 0))}
      </div>
      <table><thead><tr><th style="width:38px">STT</th><th>Số HĐ</th><th>Tên hợp đồng</th><th>Bên mua</th><th style="text-align:right">Giá trị</th><th>Trạng thái</th><th>Thanh toán</th><th>Khách mở lần cuối</th><th>Tạo lúc</th><th style="width:120px"></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr class="hd-row" data-id="${r.HopDongMBID}" style="cursor:pointer">
        <td style="text-align:center">${i + 1}</td><td><b>${h(r.SoHopDong)}</b>${r.Nguon === 'PDF' ? ' <span title="PDF soạn sẵn">📎</span>' : ''}${r.LoaiVanBan && r.LoaiVanBan !== 'HopDong' ? '<div style="font-size:11px;color:#1967d2">' + h(TEN_LOAI[r.LoaiVanBan] || r.LoaiVanBan) + '</div>' : ''}${r.SoHoaDon ? '<div style="font-size:11px;color:#5f6368" title="Hóa đơn điện tử">🧾 ' + h(r.SoHoaDon) + '</div>' : ''}</td><td>${h(r.TenHopDong)}</td>
        <td>${h(r.BenMuaTen || r.TenKhachHang || '')}${r.BenMuaNDD ? '<div style="font-size:12px;color:#5f6368">' + h(r.BenMuaNDD) + '</div>' : ''}</td>
        <td style="text-align:right">${money(r.TongTien)}</td><td>${badge(r.TrangThai)}${r.TrangThai === 'ChoKy' && r.HanKy ? '<div style="font-size:11px;color:#5f6368">hạn ' + h(fmtDateTime(r.HanKy)) + '</div>' : ''}${r.LoiKySo ? '<div style="font-size:11px;color:#c5221f" title="' + h(r.LoiKySo) + '">' + h(String(r.LoiKySo).slice(0, 60)) + '</div>' : ''}</td>
        <td>${r.TrangThai === 'DaKy' ? h(TEN_TTT[r.TrangThaiThanhToan] || r.TrangThaiThanhToan) : ''}</td>
        <td>${h(r.KhachMoLanCuoi ? fmtDateTime(r.KhachMoLanCuoi) : '')}</td><td>${h(fmtDateTime(r.CreatedAt))}<div style="font-size:11px;color:#5f6368">${h(r.NguoiTao || '')}</div></td>
        <td><button class="btn small secondary" data-xem="${r.HopDongMBID}">Mở</button></td></tr>`).join('') || '<tr><td colspan="10" class="empty-hint">Chưa có hợp đồng nào.</td></tr>'}</tbody></table>`;
    container.querySelectorAll('[data-loc]').forEach(b => b.addEventListener('click', () => { if (b.dataset.loai === 'ttt') { locTTT = locTTT === b.dataset.loc ? '' : b.dataset.loc; locTT = locTTT ? 'DaKy' : locTT; } else { locTT = b.dataset.loc; locTTT = ''; } renderDanhSach(); }));
    const oTim = container.querySelector('#oTim');
    oTim.addEventListener('keydown', e => { if (e.key === 'Enter') { tuKhoa = oTim.value.trim(); renderDanhSach(); } });
    container.querySelector('#selLoai').addEventListener('change', (e) => { locLoai = e.target.value; renderDanhSach(); });
    const bt = container.querySelector('#btnTao'); if (bt) bt.addEventListener('click', () => openForm(null));
    container.querySelectorAll('[data-xem]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openChiTiet(b.dataset.xem); }));
    container.querySelectorAll('.hd-row').forEach(tr => tr.addEventListener('click', () => openChiTiet(tr.dataset.id)));
  }

  /* ================================================================ 2. FORM TẠO / SỬA ================================================================ */
  async function openForm(d) {
    await napDanhMuc();
    const hd = d ? d.hd : null, bm = (hd && hd.BenMua) || {}, gia = (hd && hd.GiaTriBienObj) || {}, hang = d ? d.hang : [], bk = d ? d.benKhach : null, bmoyn = d ? d.benMoyn : null;
    const sua = !!(hd && !hd.taoMoiTuCha);   // v9.62: hd có taoMoiTuCha = tạo phụ lục/thanh lý từ hợp đồng gốc (điền sẵn, vẫn là TẠO MỚI)
    const o = (ten, nhan, gt, them) => `<div class="form-row"><label>${nhan}</label><input name="${ten}" value="${h(gt)}" ${them || ''}></div>`;
    const optMau = mauCache.map(m => `<option value="${h(m.MaMau)}" ${hd && hd.MaMau === m.MaMau ? 'selected' : ''}>${h(m.TenMau)} (v${m.PhienBan})</option>`).join('');
    const loaiHienTai = (hd && hd.LoaiVanBan) || 'HopDong';
    const html = `
      <h3>${sua ? 'Sửa ' + h(TEN_LOAI[loaiHienTai] || 'hợp đồng').toLowerCase() + ' ' + h(hd.SoHopDong) : 'Tạo ' + (loaiHienTai === 'HopDong' ? 'hợp đồng mua bán / phụ lục / thanh lý' : h(TEN_LOAI[loaiHienTai]).toLowerCase())}</h3>
      <form id="hdForm">
        <div class="form-grid">
          <div class="form-row"><label>Loại văn bản</label><select name="loaiVanBan" id="hdLoai">${Object.keys(TEN_LOAI).map(k => `<option value="${k}" ${loaiHienTai === k ? 'selected' : ''}>${TEN_LOAI[k]}</option>`).join('')}</select></div>
          <div class="form-row" id="khungCha" style="display:none"><label>Hợp đồng gốc (đã ký) *</label><select name="hopDongChaId" id="hdCha"><option value="">-- đang tải --</option></select></div>
          ${o('tenHopDong', 'Tên văn bản *', hd ? hd.TenHopDong : '', 'required')}
          ${o('soHopDong', 'Số văn bản (trống = tự sinh HD/PL/TL<năm><số>)', sua ? hd.SoHopDong : '', sua ? 'readonly' : '')}
          <div class="form-row"><label>Nguồn nội dung</label><select name="nguon" id="hdNguon">
            <option value="Mau" ${!hd || hd.Nguon === 'Mau' ? 'selected' : ''}>Mẫu trong phần mềm (điền biến)</option>
            <option value="PDF" ${hd && hd.Nguon === 'PDF' ? 'selected' : ''}>PDF soạn sẵn (tải lên sau khi lưu)</option></select></div>
          <div class="form-row" id="khungMau"><label>Mẫu hợp đồng</label><select name="maMau" id="hdMau"><option value="">-- chọn mẫu --</option>${optMau}</select></div>
        </div>
        <h4 style="margin:10px 0 4px">Bên mua</h4>
        <div class="form-grid">
          <div class="form-row"><label>Chọn từ danh mục khách hàng</label><select id="hdKhach"><option value="">-- gõ tay --</option>${khachCache.map(k => `<option value="${k.KhachHangID}" ${hd && hd.KhachHangID === k.KhachHangID ? 'selected' : ''}>${h(k.TenKhachHang)}${k.MaSoThue ? ' · ' + h(k.MaSoThue) : ''}</option>`).join('')}</select></div>
          <div class="form-row"><label>Loại đối tác</label><select name="bm_LoaiDoiTac">${['', 'CongTy', 'HoKD', 'CaNhan'].map(v => `<option value="${v}" ${(bm.LoaiDoiTac || '') === v ? 'selected' : ''}>${v ? LOAI_DT[v] : '--'}</option>`).join('')}</select></div>
          ${o('bm_Ten', 'Tên bên mua (tên pháp nhân / hộ KD) *', bm.Ten || '', 'required')}
          ${o('bm_DiaChi', 'Địa chỉ', bm.DiaChi || '')}
          ${o('bm_MST', 'Mã số thuế', bm.MST || '')}
          ${o('bm_SoDKKD', 'Số ĐKKD (hộ KD)', bm.SoDKKD || '')}
          ${o('bm_NgayCapDKKD', 'Ngày cấp ĐKKD', bm.NgayCapDKKD ? String(bm.NgayCapDKKD).slice(0, 10) : '', 'type="date"')}
          ${o('bm_NoiCapDKKD', 'Nơi cấp ĐKKD', bm.NoiCapDKKD || '')}
          ${o('bm_NguoiDaiDien', 'Người đại diện / chủ hộ *', bm.NguoiDaiDien || '', 'required')}
          ${o('bm_ChucVu', 'Chức vụ', bm.ChucVu || '')}
          ${o('bm_CCCD', 'Số CCCD (người đại diện)', bm.CCCD || '')}
          ${o('bm_SDT', 'Điện thoại người ký (nhận OTP SMS) *', bm.SDT || '')}
          ${o('bm_Email', 'Email người ký (nhận link + OTP email) *', bm.Email || '', 'type="email"')}
          <div class="form-row"><label>&nbsp;</label><label style="font-weight:normal"><input type="checkbox" id="hdLuuKhach"> Lưu các ô trên vào danh mục khách hàng</label></div>
        </div>
        <h4 style="margin:10px 0 4px">Người ký phía MOYN <span style="font-weight:normal;font-size:12px;color:#5f6368">(trống = lấy ở Cấu hình ký)</span></h4>
        <div class="form-grid">${o('nm_hoTen', 'Họ tên', bmoyn ? bmoyn.HoTen : '')}${o('nm_chucVu', 'Chức vụ', bmoyn ? bmoyn.ChucVu : '')}${o('nm_email', 'Email', bmoyn ? bmoyn.Email : '')}</div>
        <h4 style="margin:10px 0 4px">Hàng hóa <span style="font-weight:normal;font-size:12px;color:#5f6368">(tùy chọn — mẫu có {{BangHang}} thì in bảng này; tổng tiền tự tính)</span></h4>
        <div style="overflow:auto"><table id="bangHang" data-nostt><thead><tr><th style="width:110px">Mã SP</th><th>Tên sản phẩm</th><th style="width:110px">Màu</th><th style="width:70px">ĐVT</th><th style="width:90px">SL</th><th style="width:110px">Đơn giá</th><th style="width:120px">Thành tiền</th><th style="width:40px"></th></tr></thead>
          <tbody>${(hang || []).map(dongHangHtml).join('')}</tbody>
          <tfoot><tr><td colspan="6" style="text-align:right"><b>TỔNG</b></td><td style="text-align:right" id="hdTong"><b>${money((hang || []).reduce((t, x) => t + num(x.ThanhTien), 0))}</b></td><td></td></tr></tfoot></table></div>
        <button type="button" class="btn small secondary" id="btnThemHang" style="margin-top:4px">+ Dòng hàng</button>
        <div id="khungBien"></div>
        <div class="form-row" style="margin-top:8px"><label>Ghi chú nội bộ</label><input name="ghiChu" value="${h(hd ? hd.GhiChu : '')}"></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnHuy">Hủy</button><button type="submit" class="btn">${sua ? 'Lưu' : 'Tạo văn bản'}</button></div>
      </form>`;
    const modal = openModal(html);
    const form = modal.querySelector('#hdForm');
    const selNguon = modal.querySelector('#hdNguon'), selMau = modal.querySelector('#hdMau'), khungMau = modal.querySelector('#khungMau'), khungBien = modal.querySelector('#khungBien');
    const capNhatNguon = () => { khungMau.style.display = selNguon.value === 'Mau' ? '' : 'none'; veBien(); };
    /* Ô nhập cho biến trong mẫu KHÔNG tự điền được ("điền các trường nhập vào" — Nguyen 14/11). */
    function veBien() {
      if (selNguon.value !== 'Mau') { khungBien.innerHTML = ''; return; }
      const m = mauCache.find(x => x.MaMau === selMau.value);
      const ds = m ? (m.Bien || []).filter(b => !BIEN_TU_DONG.test(b)) : [];
      khungBien.innerHTML = ds.length ? `<h4 style="margin:10px 0 4px">Các trường trong mẫu "${h(m.TenMau)}"</h4><div class="form-grid">${ds.map(b =>
        `<div class="form-row"><label>${h(nhanBien(b))}</label>${/DieuKhoan|GhiChu|MoTa|NoiDungSuaDoi|KetQuaThucHien|NghiaVuKhac/i.test(b) ? `<textarea name="bien_${h(b)}" rows="2">${h(gia[b] || '')}</textarea>` : `<input name="bien_${h(b)}" value="${h(gia[b] || '')}" ${/^(NgayKy|DiaDiemKy)$/.test(b) ? 'placeholder="để trống = tự điền (ngày xuất bản / địa điểm trong Cấu hình)"' : ''}>`}</div>`).join('')}</div>` : (m ? '<div class="empty-hint" style="text-align:left">Mẫu này không có trường nào cần gõ thêm — mọi biến đều tự điền.</div>' : '');
    }
    selNguon.addEventListener('change', capNhatNguon); selMau.addEventListener('change', veBien); capNhatNguon();
    /* v9.62: phụ lục / thanh lý trỏ tới HỢP ĐỒNG gốc đã ký (danh sách tải một lần khi cần). Chọn hợp đồng gốc tự điền bên mua nếu đang trống. */
    const selLoai = modal.querySelector('#hdLoai'), selCha = modal.querySelector('#hdCha'), khungCha = modal.querySelector('#khungCha');
    let dsCha = null;
    async function capNhatLoai() {
      const loai = selLoai.value;
      khungCha.style.display = loai === 'HopDong' ? 'none' : '';
      if (loai === 'HopDong') return;
      if (!dsCha) {
        try { dsCha = ((await apiGet('/api/hopdong?trangThai=DaKy&loaiVanBan=HopDong')).data || []).filter(x => !sua || x.HopDongMBID !== hd.HopDongMBID); }
        catch (e) { dsCha = []; toast('Không tải được danh sách hợp đồng đã ký: ' + e.message, 'error'); }
        const chaId = hd && hd.HopDongChaID ? String(hd.HopDongChaID) : '';
        selCha.innerHTML = '<option value="">-- chọn hợp đồng gốc đã ký --</option>' + dsCha.map(x => `<option value="${x.HopDongMBID}" ${chaId === String(x.HopDongMBID) ? 'selected' : ''}>${h(x.SoHopDong)} — ${h(x.TenHopDong)} (${h(x.BenMuaTen || x.TenKhachHang || '')})</option>`).join('');
        if (!dsCha.length) selCha.innerHTML = '<option value="">(chưa có hợp đồng nào ở trạng thái Đã ký)</option>';
      }
      if (!sua && selMau.value === '' && mauCache.length) { const goiY = mauCache.find(m => m.MaMau === (loai === 'PhuLuc' ? 'PHULUC_CHUAN' : 'THANHLY_CHUAN')); if (goiY) { selMau.value = goiY.MaMau; veBien(); } }
    }
    selLoai.addEventListener('change', capNhatLoai);
    selCha.addEventListener('change', () => {
      const c = (dsCha || []).find(x => String(x.HopDongMBID) === selCha.value); if (!c || sua) return;
      const tenEl = form.elements.tenHopDong; if (tenEl && !tenEl.value.trim()) tenEl.value = (selLoai.value === 'PhuLuc' ? 'Phụ lục hợp đồng ' : 'Biên bản thanh lý hợp đồng ') + c.SoHopDong;
      if (c.KhachHangID && !form.elements.bm_Ten.value.trim()) { const kh = modal.querySelector('#hdKhach'); kh.value = String(c.KhachHangID); kh.dispatchEvent(new Event('change')); }
    });
    if (loaiHienTai !== 'HopDong') capNhatLoai();
    modal.querySelector('#hdKhach').addEventListener('change', (e) => {
      const k = khachCache.find(x => String(x.KhachHangID) === e.target.value); if (!k) return;
      const dat = (n, v) => { const el = form.elements[n]; if (el) el.value = v == null ? '' : v; };
      dat('bm_LoaiDoiTac', k.LoaiDoiTac || ''); dat('bm_Ten', k.TenHoaDon || k.TenKhachHang); dat('bm_DiaChi', k.DiaChiHoaDon || k.DiaChi); dat('bm_MST', k.MaSoThue);
      dat('bm_SoDKKD', k.SoDKKD); dat('bm_NgayCapDKKD', k.NgayCapDKKD || ''); dat('bm_NoiCapDKKD', k.NoiCapDKKD); dat('bm_NguoiDaiDien', k.NguoiDaiDien); dat('bm_ChucVu', k.ChucVuNDD);
      dat('bm_CCCD', k.SoCCCD); dat('bm_SDT', k.SDTNguoiKy || k.SDT); dat('bm_Email', k.EmailNguoiKy || k.EmailHoaDon || k.Email);
    });
    const tbody = modal.querySelector('#bangHang tbody');
    const tinhTong = () => { let t = 0; tbody.querySelectorAll('tr').forEach(tr => { const sl = num(tr.querySelector('[name=SoLuong]').value), dg = num(tr.querySelector('[name=DonGia]').value); const tt = Math.round(sl * dg * 100) / 100; tr.querySelector('.tt').textContent = money(tt); t += tt; }); modal.querySelector('#hdTong').innerHTML = '<b>' + money(t) + '</b>'; };
    const noiDong = () => { tbody.querySelectorAll('tr').forEach(tr => { tr.querySelectorAll('input').forEach(i => { i.oninput = tinhTong; }); const x = tr.querySelector('.xoa'); if (x) x.onclick = () => { tr.remove(); tinhTong(); }; }); };
    modal.querySelector('#btnThemHang').addEventListener('click', () => { tbody.insertAdjacentHTML('beforeend', dongHangHtml({})); noiDong(); });
    noiDong();
    modal.querySelector('#btnHuy').addEventListener('click', closeModal);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const benMua = {}; ['LoaiDoiTac', 'Ten', 'DiaChi', 'MST', 'SoDKKD', 'NgayCapDKKD', 'NoiCapDKKD', 'NguoiDaiDien', 'ChucVu', 'CCCD', 'SDT', 'Email'].forEach(k => { benMua[k] = (fd.get('bm_' + k) || '').toString().trim(); });
      if (!benMua.SDT && !benMua.Email) { toast('Người ký phía khách cần điện thoại hoặc email để nhận link/OTP.', 'error'); return; }
      const giaTriBien = {}; for (const [k, v] of fd.entries()) if (k.startsWith('bien_')) giaTriBien[k.slice(5)] = v;
      const hangRows = Array.from(tbody.querySelectorAll('tr')).map(tr => { const g = (n) => tr.querySelector('[name=' + n + ']').value.trim(); return { MaSanPham: g('MaSanPham'), TenSanPham: g('TenSanPham'), MauSac: g('MauSac'), DonVi: g('DonVi'), SoLuong: num(g('SoLuong')), DonGia: num(g('DonGia')) }; }).filter(x => x.TenSanPham || x.MaSanPham);
      const body = { tenHopDong: fd.get('tenHopDong'), soHopDong: fd.get('soHopDong'), nguon: fd.get('nguon'), maMau: fd.get('maMau'), khachHangId: modal.querySelector('#hdKhach').value || null, benMua, giaTriBien, hang: hangRows,
        loaiVanBan: fd.get('loaiVanBan') || 'HopDong', hopDongChaId: fd.get('hopDongChaId') || null,   // v9.62
        nguoiKyKhach: { hoTen: benMua.NguoiDaiDien, chucVu: benMua.ChucVu, email: benMua.Email, sdt: benMua.SDT }, nguoiKyMoyn: { hoTen: fd.get('nm_hoTen'), chucVu: fd.get('nm_chucVu'), email: fd.get('nm_email') }, ghiChu: fd.get('ghiChu') };
      if (body.loaiVanBan !== 'HopDong' && !body.hopDongChaId) { toast('Chọn hợp đồng gốc cho ' + TEN_LOAI[body.loaiVanBan].toLowerCase() + '.', 'error'); return; }
      if (body.nguon === 'Mau' && !body.maMau) { toast('Chọn mẫu hợp đồng.', 'error'); return; }
      try {
        let id = sua ? hd.HopDongMBID : null;
        if (sua) await apiPut('/api/hopdong/' + id, body); else id = (await apiPost('/api/hopdong', body)).data.HopDongMBID;
        if (modal.querySelector('#hdLuuKhach').checked && body.khachHangId) { try { await apiPut('/api/hopdong/khach/' + body.khachHangId, benMua); } catch (e2) { toast('Lưu danh mục khách lỗi: ' + e2.message, 'error'); } }
        closeModal(); toast('Đã lưu.', 'success');
        openChiTiet(id);
      } catch (err) { toast(err.message, 'error'); }
    });
  }
  function dongHangHtml(x) {
    const i = (n, v, them) => `<input name="${n}" value="${h(v == null ? '' : v)}" ${them || ''} style="width:100%">`;
    return `<tr><td>${i('MaSanPham', x.MaSanPham)}</td><td>${i('TenSanPham', x.TenSanPham)}</td><td>${i('MauSac', x.MauSac)}</td><td>${i('DonVi', x.DonVi || 'Cái')}</td>
      <td>${i('SoLuong', x.SoLuong, 'type="number" step="0.01" min="0"')}</td><td>${i('DonGia', x.DonGia, 'type="number" step="1" min="0"')}</td><td class="tt" style="text-align:right">${money(x.ThanhTien)}</td><td><button type="button" class="btn small secondary xoa">✕</button></td></tr>`;
  }
  function nhanBien(b) {
    const chuan = (bienChuan || []).find(x => x[0] === b);
    if (chuan) return chuan[1];
    return b.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  /* ================================================================ 3. CHI TIẾT ================================================================ */
  async function openChiTiet(id) {
    let d;
    try { d = (await apiGet('/api/hopdong/' + id)).data; } catch (e) { toast(e.message, 'error'); return; }
    const hd = d.hd, bk = d.benKhach, bm = d.benMoyn, tt = hd.TrangThai;
    const nut = (id2, nhan, cls) => `<button type="button" class="btn small ${cls || 'secondary'}" id="${id2}">${nhan}</button>`;
    const choKySoMoyn = ['DangKySo', 'ChoMoynKy', 'LoiKySo'].includes(tt);
    const hanhDong = [
      tt === 'Nhap' && perm.canEdit ? nut('bSua', '✏️ Sửa') : '',
      ['ChoKy', 'TuChoi', 'HetHan'].includes(tt) && perm.canEdit ? nut('bSua', '✏️ Sửa (về nháp)') : '',
      hd.Nguon === 'PDF' && ['Nhap', 'ChoKy', 'TuChoi', 'HetHan'].includes(tt) && perm.canEdit ? nut('bTaiPdfNguon', '📎 Tải PDF soạn sẵn lên') : '',
      hd.Nguon === 'Mau' && ['Nhap', 'ChoKy', 'TuChoi', 'HetHan'].includes(tt) ? nut('bXemTruoc', '👁 Xem trước') : '',
      ['Nhap', 'ChoKy', 'TuChoi', 'HetHan'].includes(tt) && perm.canEdit ? nut('bXuatBan', tt === 'Nhap' ? '🚀 Xuất bản & gửi link ký' : '🔁 Xuất bản lại & gửi', '') : '',
      tt === 'ChoKy' && perm.canEdit ? nut('bGuiLink', '📨 Gửi lại link') + nut('bGuiOtp', '🔑 Gửi lại OTP') + nut('bCopyLink', '🔗 Copy link mới') : '',
      ['ChoKy', 'TuChoi', 'HetHan'].includes(tt) && perm.canEdit ? nut('bThuHoi', '↩ Thu hồi về nháp') : '',
      choKySoMoyn && d.quyenKySo ? nut('bKyLai', '🔁 Ký số lại (tự động)') + (d.kyTuXa && d.kyTuXa.san ? nut('bKyTuXa', '📲 Ký từ xa qua ' + h(d.kyTuXa.tenHienThi || 'CA'), '') : '') + nut('bKyCongCu', '🔐 Ký bằng USB token máy này', d.kyTuXa && d.kyTuXa.san ? 'secondary' : '') + nut('bTaiLenKy', '⬆ Tải lên bản đã ký') : '',
      choKySoMoyn && !d.quyenKySo ? '<span style="font-size:12px;color:#b06000">Bạn chưa có năng lực "Ký số phía MOYN" (Quản trị → Phân quyền).</span>' : '',
      d.coFile.goc ? nut('bPdfGoc', '📄 PDF bản gửi ký') : '',
      d.coFile.khach ? nut('bPdfKhach', '📄 Bản khách đã ký số (file riêng)') : '',
      d.coFile.choMoyn && choKySoMoyn ? nut('bPdfChoMoyn', '📄 PDF chờ MOYN ký (tải về ký token)') : '',
      d.coFile.cuoi ? nut('bPdfCuoi', '✅ Tải PDF đã ký số', '') : '',
      !['DaKy', 'Huy'].includes(tt) && perm.canEdit ? nut('bHuy', '🗑 Hủy') : '',
      tt === 'Nhap' && perm.canDelete ? nut('bXoa', '✕ Xóa nháp') : ''
    ].filter(Boolean).join(' ');
    const benRow = (b) => b ? `<tr><td>${b.Ben === 'MOYN' ? 'Bên bán (MOYN)' : 'Bên mua'}</td><td>${h(b.HoTen)}${b.ChucVu ? '<br><span style="font-size:12px;color:#5f6368">' + h(b.ChucVu) + '</span>' : ''}</td><td>${h(b.Email || '')}<br>${h(b.SDT || '')}</td>
      <td>${b.TrangThai === 'DaKy' ? '✅ Đã ký' : (b.TrangThai === 'TuChoi' ? '❌ Từ chối' : '⏳ Chờ ký')}${b.CachKy ? '<br><span style="font-size:12px">' + h(b.CachKy === 'OTP' ? 'OTP ' + (b.KenhOTP || '') + ' → ' + (b.DichOTP || '') : (TEN_CACH_KY[b.CachKy] || b.CachKy)) + (b.KyTuXaNha ? ' · ' + h(b.KyTuXaNha) + (b.KyTuXaUserId ? ' (' + h(b.KyTuXaUserId) + ')' : '') : '') + '</span>' : ''}</td>
      <td style="font-size:12px">${h(b.KyLuc ? fmtDateTime(b.KyLuc) : '')}${b.IP ? '<br>IP ' + h(b.IP) : ''}${b.ChungThuCN ? '<br>CT: ' + h(b.ChungThuCN) + (b.ChungThuMST ? ' · ' + h(b.ChungThuMST) : '') : ''}${b.ChuoiTinCay ? '<br><span style="color:' + (b.ChuoiTinCay.startsWith('✔') ? '#137333' : (b.ChuoiTinCay.startsWith('✖') ? '#c5221f' : '#b06000')) + '" title="Chuỗi tin cậy chứng thư (CA gốc + CRL)">🔗 ' + h(b.ChuoiTinCay) + '</span>' : ''}${b.LyDoTuChoi ? '<br><span style="color:#c5221f">' + h(b.LyDoTuChoi) + '</span>' : ''}</td></tr>` : '';
    const loai = hd.LoaiVanBan || 'HopDong';
    const con = d.con || [];
    const html = `
      <h3>${loai !== 'HopDong' ? '<span style="font-size:13px;color:#1967d2">' + h(TEN_LOAI[loai] || loai) + '</span> ' : ''}${h(hd.SoHopDong)} — ${h(hd.TenHopDong)} ${badge(tt)}</h3>
      ${hd.HopDongCha_So ? `<div style="font-size:13px;margin-bottom:6px">Thuộc hợp đồng gốc: <a href="#" id="lkCha"><b>${h(hd.HopDongCha_So)}</b></a>${hd.HopDongCha_Ten ? ' — ' + h(hd.HopDongCha_Ten) : ''}${hd.HopDongCha_Ngay ? ' (ký ' + h(fmtDate(hd.HopDongCha_Ngay)) + ')' : ''}</div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${hanhDong}${tt === 'DaKy' && loai === 'HopDong' && perm.canCreate ? nut('bTaoPhuLuc', '➕ Tạo phụ lục') + nut('bTaoThanhLy', '➕ Tạo biên bản thanh lý') : ''}</div>
      ${hd.LoiKySo ? `<div class="empty-hint" style="text-align:left;background:#fdecea;border:1px solid #f5c2c0;border-radius:6px;padding:8px;color:#c5221f">Lỗi ký số: ${h(hd.LoiKySo)}</div>` : ''}
      <table style="font-size:13px"><tr><td style="width:160px"><b>Bên mua</b></td><td>${h((hd.BenMua || {}).Ten)}${(hd.BenMua || {}).MST ? ' · MST ' + h(hd.BenMua.MST) : ''}${(hd.BenMua || {}).DiaChi ? '<br>' + h(hd.BenMua.DiaChi) : ''}</td>
        <td style="width:140px"><b>Giá trị</b></td><td>${money(hd.TongTien)}</td></tr>
        <tr><td><b>Nguồn</b></td><td>${hd.Nguon === 'PDF' ? 'PDF soạn sẵn' + (d.coFile.nguon ? ' (đã tải)' : ' (<b style="color:#c5221f">chưa tải file</b>)') : 'Mẫu ' + h(hd.MaMau) + (hd.PhienBanMau ? ' v' + hd.PhienBanMau : '')}</td>
        <td><b>Thanh toán</b></td><td>${tt === 'DaKy' && perm.canEdit ? `<select id="selTT">${Object.keys(TEN_TTT).map(k => `<option value="${k}" ${hd.TrangThaiThanhToan === k ? 'selected' : ''}>${TEN_TTT[k]}</option>`).join('')}</select>` : h(TEN_TTT[hd.TrangThaiThanhToan] || '')}</td></tr>
        <tr><td><b>Xuất bản</b></td><td>${hd.XuatBanLuc ? 'v' + hd.PhienBan + ' lúc ' + h(fmtDateTime(hd.XuatBanLuc)) + (hd.HanKy ? ' · hạn ký ' + h(fmtDateTime(hd.HanKy)) : '') : '—'}</td><td><b>Mã tra cứu</b></td><td>${h(hd.MaTraCuu || '—')}</td></tr>
        <tr><td><b>Khách ký</b></td><td>${h(hd.KhachKyLuc ? fmtDateTime(hd.KhachKyLuc) : '—')}</td><td><b>Ký xong</b></td><td>${h(hd.KyXongLuc ? fmtDateTime(hd.KyXongLuc) : '—')}</td></tr>
        ${tt === 'DaKy' && hd.LoaiVanBan !== undefined ? `<tr><td><b>Hóa đơn điện tử</b></td><td colspan="3">${perm.canEdit ? `<span style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap">Số <input id="oSoHD" value="${h(hd.SoHoaDon || '')}" style="width:140px" placeholder="số HĐĐT"> ngày <input id="oNgayHD" type="date" value="${h(hd.NgayHoaDon || '')}"> <button type="button" class="btn small secondary" id="bLuuHD">Lưu</button>${hd.SoHoaDon ? '' : ' <span style="font-size:12px;color:#b06000">chưa xuất hóa đơn</span>'}</span>` : (hd.SoHoaDon ? h(hd.SoHoaDon) + (hd.NgayHoaDon ? ' ngày ' + h(fmtDate(hd.NgayHoaDon)) : '') : '<span style="color:#b06000">chưa xuất hóa đơn</span>')}</td></tr>` : ''}
        ${hd.NhacLanCuoi ? `<tr><td><b>Nhắc hạn ký</b></td><td colspan="3">lần cuối ${h(fmtDateTime(hd.NhacLanCuoi))}</td></tr>` : ''}
        <tr><td><b>SHA-256 bản gửi</b></td><td colspan="3" style="font-family:monospace;font-size:11px;word-break:break-all">${h(hd.HashGoc || '—')}</td></tr>
        ${hd.HashCuoi ? `<tr><td><b>SHA-256 bản cuối</b></td><td colspan="3" style="font-family:monospace;font-size:11px;word-break:break-all">${h(hd.HashCuoi)}</td></tr>` : ''}</table>
      ${con.length ? `<h4 style="margin:10px 0 4px">Phụ lục / thanh lý thuộc hợp đồng này</h4><table data-nostt><thead><tr><th>Loại</th><th>Số</th><th>Tên</th><th>Trạng thái</th><th>Tạo lúc</th><th></th></tr></thead>
        <tbody>${con.map(c => `<tr><td>${h(TEN_LOAI[c.LoaiVanBan] || c.LoaiVanBan)}</td><td><b>${h(c.SoHopDong)}</b></td><td>${h(c.TenHopDong)}</td><td>${badge(c.TrangThai)}</td><td>${h(fmtDateTime(c.CreatedAt))}</td><td><button type="button" class="btn small secondary" data-mo-con="${c.HopDongMBID}">Mở</button></td></tr>`).join('')}</tbody></table>` : ''}
      <h4 style="margin:10px 0 4px">Các bên ký</h4>
      <table data-nostt><thead><tr><th>Bên</th><th>Người ký</th><th>Liên hệ</th><th>Kết quả</th><th>Chi tiết</th></tr></thead><tbody>${benRow(bk)}${benRow(bm)}</tbody></table>
      ${d.hang && d.hang.length ? `<h4 style="margin:10px 0 4px">Hàng hóa</h4><table data-nostt><thead><tr><th>Mã SP</th><th>Tên</th><th>Màu</th><th>ĐVT</th><th style="text-align:right">SL</th><th style="text-align:right">Đơn giá</th><th style="text-align:right">Thành tiền</th></tr></thead>
        <tbody>${d.hang.map(x => `<tr><td>${h(x.MaSanPham)}</td><td>${h(x.TenSanPham)}</td><td>${h(x.MauSac)}</td><td>${h(x.DonVi)}</td><td style="text-align:right">${money(x.SoLuong)}</td><td style="text-align:right">${money(x.DonGia)}</td><td style="text-align:right">${money(x.ThanhTien)}</td></tr>`).join('')}</tbody></table>` : ''}
      <h4 style="margin:10px 0 4px">Nhật ký (audit trail) <button type="button" class="btn small secondary" id="bNhatKy">Tải nhật ký</button></h4>
      <div id="khungNhatKy" style="max-height:40vh;overflow:auto"></div>
      <div id="tienTrinh" style="margin-top:8px;font-size:13px;color:#1967d2"></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="bDong">Đóng</button></div>`;
    const modal = openModal(html);
    const Q = (s) => modal.querySelector(s);
    const lamMoi = () => { closeModal(); renderDanhSach(); openChiTiet(id); };
    const tien = (s) => { Q('#tienTrinh').textContent = s || ''; };
    Q('#bDong').addEventListener('click', () => { closeModal(); renderDanhSach(); });
    const on = (s, fn) => { const el = Q(s); if (el) el.addEventListener('click', fn); };
    on('#bSua', () => { closeModal(); openForm(d); });
    on('#bXemTruoc', async () => {
      try { const kq = (await apiGet('/api/hopdong/' + id + '/xem-truoc')).data; if (kq.bienThieu && kq.bienThieu.length) toast('Biến còn trống: ' + kq.bienThieu.join(', '), 'error', 6000); printHtml('Xem truoc ' + hd.SoHopDong, kq.html || '', { noLetterhead: true }); }
      catch (e) { toast(e.message, 'error'); }
    });
    on('#bTaiPdfNguon', () => chonFile('.pdf', async (f) => { try { await guiFile('/api/hopdong/' + id + '/pdf-soan-san', f); toast('Đã tải PDF lên.', 'success'); lamMoi(); } catch (e) { toast(e.message, 'error'); } }));
    on('#bXuatBan', () => openXuatBan(d, lamMoi));
    on('#bGuiLink', async () => { const kenh = await chonKenh('Gửi lại link ký qua'); if (!kenh) return; try { const r = await apiPost('/api/hopdong/' + id + '/gui-link', { kenh }); toast(r.message || 'Đã gửi.', r.success ? 'success' : 'error', 6000); hienLink(r.data && r.data.link); } catch (e) { toast(e.message, 'error', 6000); } });
    on('#bGuiOtp', async () => { const kenh = await chonKenh('Gửi lại OTP qua'); if (!kenh) return; try { const r = await apiPost('/api/hopdong/' + id + '/gui-otp', { kenh }); toast(r.message || 'Đã gửi.', 'success', 6000); } catch (e) { toast(e.message, 'error', 6000); } });
    on('#bCopyLink', async () => { if (!confirm('Tạo link MỚI (link cũ đã gửi sẽ không còn dùng được)?')) return; try { const r = await apiPost('/api/hopdong/' + id + '/gui-link', { kenh: 'email' }); hienLink(r.data && r.data.link); } catch (e) { if (e.data && e.data.data && e.data.data.link) hienLink(e.data.data.link); else toast(e.message, 'error'); } });
    on('#bThuHoi', async () => { if (!confirm('Thu hồi về nháp? Link đã gửi sẽ vô hiệu.')) return; try { await apiPost('/api/hopdong/' + id + '/thu-hoi', {}); toast('Đã thu hồi.', 'success'); lamMoi(); } catch (e) { toast(e.message, 'error'); } });
    on('#bHuy', async () => { const lyDo = prompt('Lý do hủy hợp đồng:'); if (!lyDo) return; try { await apiPost('/api/hopdong/' + id + '/huy', { lyDo }); toast('Đã hủy.', 'success'); lamMoi(); } catch (e) { toast(e.message, 'error'); } });
    on('#bXoa', async () => { if (!confirm('Xóa hợp đồng nháp này?')) return; try { await apiDelete('/api/hopdong/' + id); toast('Đã xóa.', 'success'); closeModal(); renderDanhSach(); } catch (e) { toast(e.message, 'error'); } });
    on('#bPdfGoc', () => taiFile('/api/hopdong/' + id + '/pdf?loai=goc', hd.SoHopDong + '_ban_gui_ky.pdf'));
    on('#bPdfKhach', () => taiFile('/api/hopdong/' + id + '/pdf?loai=khach', hd.SoHopDong + '_khach_ky_so.pdf'));
    on('#bPdfChoMoyn', () => taiFile('/api/hopdong/' + id + '/pdf?loai=chomoyn', hd.SoHopDong + '_cho_MOYN_ky.pdf'));
    on('#bPdfCuoi', () => taiFile('/api/hopdong/' + id + '/pdf?loai=cuoi', hd.SoHopDong + '_da_ky.pdf'));
    on('#bKyLai', async () => { tien('Đang ký số lại…'); try { const r = await apiPost('/api/hopdong/' + id + '/ky-lai', {}); toast(r.message || 'Xong', r.success ? 'success' : 'error', 6000); lamMoi(); } catch (e) { tien(''); toast(e.message, 'error', 8000); } });
    on('#bTaiLenKy', () => chonFile('.pdf', async (f) => { tien('Đang kiểm chữ ký…'); try { const r = await guiFile('/api/hopdong/' + id + '/tai-len-da-ky', f); toast('Đã nhận bản ký số.' + (r.canhBao && r.canhBao.length ? ' Lưu ý: ' + r.canhBao.join(' ') : ''), 'success', 8000); lamMoi(); } catch (e) { tien(''); toast(e.message, 'error', 10000); } }));
    on('#bKyCongCu', async () => {
      try {
        await window.MoynKySo.kyTronLuong({
          chonChungThu: chonChungThuModal, baoTien: tien,
          batDau: async (certDer) => (await apiPost('/api/hopdong/' + id + '/ky-cong-cu/bat-dau', { certDer })).data,
          hoanTat: async (phienKy, chuKy) => apiPost('/api/hopdong/' + id + '/ky-cong-cu/hoan-tat', { phienKy, chuKy })
        });
        toast('Đã ký số bằng USB token.', 'success', 6000); lamMoi();
      } catch (e) { tien(''); toast(e.message, 'error', 10000); }
    });
    const selTT = Q('#selTT'); if (selTT) selTT.addEventListener('change', async () => { try { await apiPut('/api/hopdong/' + id + '/thanh-toan', { trangThai: selTT.value }); toast('Đã cập nhật thanh toán.', 'success'); } catch (e) { toast(e.message, 'error'); } });
    // v9.62: hóa đơn · phụ lục / thanh lý · ký từ xa
    on('#bLuuHD', async () => { try { await apiPut('/api/hopdong/' + id + '/hoa-don', { soHoaDon: Q('#oSoHD').value.trim(), ngayHoaDon: Q('#oNgayHD').value || null }); toast('Đã lưu hóa đơn.', 'success'); lamMoi(); } catch (e) { toast(e.message, 'error'); } });
    on('#lkCha', (e) => { e.preventDefault(); closeModal(); openChiTiet(hd.HopDongChaID); });
    modal.querySelectorAll('[data-mo-con]').forEach(b => b.addEventListener('click', () => { closeModal(); openChiTiet(b.dataset.moCon); }));
    const taoCon = (loaiMoi) => { closeModal(); openForm({ hd: { LoaiVanBan: loaiMoi, HopDongChaID: hd.HopDongMBID, KhachHangID: hd.KhachHangID, BenMua: hd.BenMua, Nguon: 'Mau', TenHopDong: (loaiMoi === 'PhuLuc' ? 'Phụ lục hợp đồng ' : 'Biên bản thanh lý hợp đồng ') + hd.SoHopDong, taoMoiTuCha: true }, hang: [], benKhach: bk, benMoyn: bm }); };
    on('#bTaoPhuLuc', () => taoCon('PhuLuc'));
    on('#bTaoThanhLy', () => taoCon('ThanhLy'));
    on('#bKyTuXa', async () => {
      const userId = prompt('Nhập ' + ((d.kyTuXa && d.kyTuXa.nhanUserId) || 'mã người dùng') + ' của người ký phía MOYN tại ' + ((d.kyTuXa && d.kyTuXa.tenHienThi) || 'nhà cung cấp chữ ký số') + ':', '');
      if (!userId) return;
      const b = Q('#bKyTuXa'); b.disabled = true; tien('Đang gửi yêu cầu ký từ xa…');
      try {
        const x = (await apiPost('/api/hopdong/' + id + '/ky-tu-xa/bat-dau', { userId: userId.trim() })).data;
        tien((x.huongDan || 'Hãy xác nhận trên ứng dụng của nhà cung cấp chữ ký số.') + (x.thongTin && x.thongTin.CN ? ' · Chứng thư: ' + x.thongTin.CN : ''));
        const duong = '/api/hopdong/' + id + '/ky-tu-xa/' + encodeURIComponent(x.phienKy);
        if (x.kieu === 'otp') {
          const otp = prompt('Nhập mã OTP ' + ((d.kyTuXa && d.kyTuXa.tenHienThi) || '') + ' vừa nhận:', '');
          if (!otp) { tien(''); b.disabled = false; return; }
          const r = await apiPost(duong + '/xac-nhan', { otp: otp.trim() });
          toast(r.message || 'Đã ký số từ xa.', 'success', 6000); lamMoi(); return;
        }
        let lan = 0;
        const vong = setInterval(async () => {
          lan += 1;
          if (lan > 90) { clearInterval(vong); tien(''); b.disabled = false; toast('Quá 3 phút chưa xác nhận trên app — bấm ký lại.', 'error', 8000); return; }
          try { const r = await apiGet(duong); if (r.data && r.data.xong) { clearInterval(vong); toast(r.message || 'Đã ký số từ xa.', 'success', 6000); lamMoi(); } else if (r.data && r.data.thongDiep) tien(r.data.thongDiep); }
          catch (e) { clearInterval(vong); tien(''); b.disabled = false; toast(e.message, 'error', 10000); }
        }, 2000);
      } catch (e) { tien(''); b.disabled = false; toast(e.message, 'error', 10000); }
    });
    on('#bNhatKy', async () => {
      try {
        const kq = await apiGet('/api/hopdong/' + id + '/nhatky');
        Q('#khungNhatKy').innerHTML = `${kq.chuoiOk ? '<div style="font-size:12px;color:#137333">✔ Chuỗi băm nhật ký nguyên vẹn (' + kq.data.length + ' dòng)</div>' : '<div style="font-size:12px;color:#c5221f">⚠️ Chuỗi băm KHÔNG khớp từ dòng #' + h(kq.dongHong) + ' — nhật ký có thể đã bị sửa tay trong CSDL.</div>'}
          <table data-nostt style="font-size:12px"><thead><tr><th style="width:130px">Lúc</th><th>Sự kiện</th><th>Người / IP</th><th>Chi tiết</th></tr></thead><tbody>${kq.data.map(r => `<tr><td>${h(fmtDateTime(r.Luc))}</td><td>${h(r.Ten)}</td><td>${h(r.NguoiThucHien || (r.BenKyID ? 'khách' : ''))}${r.IP ? '<br>' + h(r.IP) : ''}</td><td style="word-break:break-all">${h(tomTat(r.ChiTiet))}${r.UserAgent ? '<div style="color:#9aa0a6">' + h(String(r.UserAgent).slice(0, 80)) + '</div>' : ''}</td></tr>`).join('')}</tbody></table>`;
      } catch (e) { toast(e.message, 'error'); }
    });
  }
  function tomTat(s) { try { const c = JSON.parse(s); return Object.keys(c).filter(k => c[k] !== undefined && c[k] !== null && c[k] !== '').map(k => k + ': ' + (typeof c[k] === 'object' ? JSON.stringify(c[k]) : c[k])).join(' · '); } catch (e) { return s || ''; } }
  function chonFile(accept, cb) { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => { if (i.files[0]) cb(i.files[0]); }; i.click(); }
  function chonKenh(tieuDe) {
    return new Promise(resolve => {
      const modal = openModal(`<h3>${h(tieuDe)}</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-k="email">📧 Email</button><button class="btn secondary" data-k="sms">📱 SMS</button><button class="btn secondary" data-k="zalo">💬 Zalo (ZNS)</button></div>
        <p style="font-size:12px;color:#5f6368">SMS / Zalo chỉ gửi được khi máy chủ đã cấu hình nhà cung cấp (xem Cấu hình ký).</p><div class="modal-actions"><button class="btn secondary" id="kHuy">Hủy</button></div>`);
      modal.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => { closeModal(); resolve(b.dataset.k); }));
      modal.querySelector('#kHuy').addEventListener('click', () => { closeModal(); resolve(null); });
    });
  }
  function hienLink(link) {
    if (!link) return;
    const modal = openModal(`<h3>Link ký cho khách</h3><input id="oLink" value="${h(link)}" readonly style="width:100%;font-size:13px"><p style="font-size:12px;color:#5f6368">Gửi link này cho người ký (Zalo/Email/SMS tay). Link cũ đã vô hiệu.</p>
      <div class="modal-actions"><button class="btn" id="bCopy">Copy</button><button class="btn secondary" id="bDongL">Đóng</button></div>`);
    modal.querySelector('#bCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); toast('Đã copy.', 'success'); } catch (e) { modal.querySelector('#oLink').select(); document.execCommand('copy'); toast('Đã copy.', 'success'); } });
    modal.querySelector('#bDongL').addEventListener('click', closeModal);
  }
  function chonChungThuModal(ds) {
    return new Promise(resolve => {
      const modal = openModal(`<h3>Chọn chứng thư số</h3><table data-nostt><tbody>${ds.map((c, i) => `<tr><td>${h(c.subject)}<br><span style="font-size:12px;color:#5f6368">${h(c.issuer || '')} · hết hạn ${h(c.notAfter || '')}</span></td><td><button class="btn small" data-i="${i}">Dùng</button></td></tr>`).join('')}</tbody></table>
        <div class="modal-actions"><button class="btn secondary" id="ctHuy">Hủy</button></div>`);
      modal.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { closeModal(); resolve(ds[Number(b.dataset.i)]); }));
      modal.querySelector('#ctHuy').addEventListener('click', () => { closeModal(); resolve(null); });
    });
  }
  async function openXuatBan(d, sauDo) {
    const hd = d.hd, bk = d.benKhach || {};
    const modal = openModal(`<h3>Xuất bản ${h(hd.SoHopDong)} để ký</h3>
      <p style="font-size:13px">Máy chủ sẽ dựng bản PDF <b>cố định</b> (băm SHA-256), tạo link ký cho <b>${h(bk.HoTen || '')}</b> và gửi qua kênh chọn bên dưới. Sửa nội dung sau bước này = xuất bản lại (link cũ vô hiệu).</p>
      <div class="form-row"><label>Gửi link qua</label><select id="xbKenh"><option value="email" ${bk.Email ? '' : 'disabled'}>Email ${bk.Email ? '(' + h(bk.Email) + ')' : '(chưa khai)'}</option><option value="sms" ${bk.SDT ? '' : 'disabled'}>SMS ${bk.SDT ? '(' + h(bk.SDT) + ')' : '(chưa khai)'}</option><option value="zalo" ${bk.SDT ? '' : 'disabled'}>Zalo ZNS</option><option value="">Không gửi — tôi tự copy link</option></select></div>
      <div class="modal-actions"><button class="btn secondary" id="xbHuy">Hủy</button><button class="btn" id="xbOk">Xuất bản</button></div>`);
    modal.querySelector('#xbHuy').addEventListener('click', closeModal);
    modal.querySelector('#xbOk').addEventListener('click', async () => {
      const kenh = modal.querySelector('#xbKenh').value; modal.querySelector('#xbOk').disabled = true; modal.querySelector('#xbOk').textContent = 'Đang dựng PDF…';
      try {
        const r = (await apiPost('/api/hopdong/' + hd.HopDongMBID + '/xuat-ban', { kenh: kenh || undefined })).data;
        closeModal();
        if (r.bienThieu && r.bienThieu.length) toast('Đã xuất bản nhưng có biến còn trống: ' + r.bienThieu.join(', '), 'error', 8000);
        if (r.gui) toast(r.gui.ok ? `Đã gửi link qua ${r.gui.kenh} tới ${r.gui.dich}.` : `Xuất bản xong nhưng gửi ${r.gui.kenh} lỗi: ${r.gui.loi}`, r.gui.ok ? 'success' : 'error', 8000);
        hienLink(r.link);
        sauDo();
      } catch (e) { modal.querySelector('#xbOk').disabled = false; modal.querySelector('#xbOk').textContent = 'Xuất bản'; toast(e.message, 'error', 8000); }
    });
  }

  /* ================================================================ 4. MẪU HỢP ĐỒNG ================================================================ */
  async function renderMau() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    await napDanhMuc();
    container.innerHTML = `
      <div class="toolbar">${perm.canEdit ? '<button class="btn" id="bThemMau">+ Mẫu mới (soạn)</button> <button class="btn secondary" id="bTaiMau">⬆ Tải file mẫu lên (.docx / .html)</button>' : ''}</div>
      <div class="empty-hint" style="text-align:left;margin-bottom:10px">Mẫu dùng biến dạng <b>{{TenBien}}</b>. Biến <b>bên bán</b> (BenBan_*) lấy từ Cấu hình ký, biến <b>bên mua</b> (BenMua_*) và <b>SoHopDong / TongTien / BangHang</b> lấy từ hợp đồng; biến khác (vd {{ThoiGianGiao}}) sẽ thành <b>ô nhập</b> khi tạo hợp đồng. Giữ điều khoản thỏa thuận ký điện tử — kế toán/luật sư rà câu chữ.</div>
      <table><thead><tr><th>Mã</th><th>Tên mẫu</th><th>Phiên bản</th><th>Biến trong mẫu</th><th>Sửa lần cuối</th><th style="width:300px"></th></tr></thead>
      <tbody>${mauCache.map(m => `<tr><td>${h(m.MaMau)}</td><td>${h(m.TenMau)}</td><td>v${m.PhienBan}</td><td style="font-size:11px;font-family:monospace">${(m.Bien || []).join(', ')}</td><td>${h(m.CapNhatLuc ? fmtDateTime(m.CapNhatLuc) : '')}<div style="font-size:11px;color:#5f6368">${h(m.NguoiSua || '')}</div></td>
        <td><button class="btn small" data-sua="${h(m.MaMau)}">${perm.canEdit ? '✏️ Sửa' : '👁 Xem'}</button> <button class="btn small secondary" data-in="${h(m.MaMau)}">🖨 In thử</button> <button class="btn small secondary" data-ls="${h(m.MaMau)}">🕘 Lịch sử</button> ${perm.canDelete ? `<button class="btn small secondary" data-xoa="${h(m.MaMau)}">✕</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Chưa có mẫu — chạy migration_v893 để có mẫu chuẩn, hoặc tải file mẫu lên.</td></tr>'}</tbody></table>`;
    const on = (s, fn) => { const el = container.querySelector(s); if (el) el.addEventListener('click', fn); };
    on('#bThemMau', () => openSuaMau(null, ''));
    on('#bTaiMau', () => chonFile('.docx,.html,.htm', async (f) => {
      try { const r = (await guiFile('/api/hopdong/mau/tai-len', f)).data; if (r.canhBao && r.canhBao.length) toast('Chuyển đổi có ghi chú: ' + r.canhBao.join('; '), 'error', 6000); openSuaMau(null, r.html, f.name.replace(/\.[^.]+$/, '')); }
      catch (e) { toast(e.message, 'error', 8000); }
    }));
    container.querySelectorAll('[data-sua]').forEach(b => b.addEventListener('click', () => { const m = mauCache.find(x => x.MaMau === b.dataset.sua); openSuaMau(m, m.NoiDung); }));
    container.querySelectorAll('[data-in]').forEach(b => b.addEventListener('click', () => { const m = mauCache.find(x => x.MaMau === b.dataset.in); inThu(m.NoiDung, m.MaMau); }));
    container.querySelectorAll('[data-ls]').forEach(b => b.addEventListener('click', () => openLichSuMau(b.dataset.ls)));
    container.querySelectorAll('[data-xoa]').forEach(b => b.addEventListener('click', async () => { if (!confirm('Xóa mẫu "' + b.dataset.xoa + '"? (bản đang dùng được đẩy vào lịch sử)')) return; try { await apiDelete('/api/hopdong/mau/' + encodeURIComponent(b.dataset.xoa)); toast('Đã xóa.', 'success'); renderMau(); } catch (e) { toast(e.message, 'error', 6000); } }));
  }
  function inThu(noiDung, ten) {
    const html = String(noiDung || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (c, b) => '‹' + b + '›');
    printHtml('In thu mau ' + (ten || ''), `<div style="font-family:'Times New Roman',serif;font-size:13pt;line-height:1.45">${html}</div>`, { noLetterhead: true });
  }
  async function openLichSuMau(ma) {
    let ds = []; try { ds = (await apiGet('/api/hopdong/mau/' + encodeURIComponent(ma) + '/lichsu')).data || []; } catch (e) { toast(e.message, 'error'); return; }
    const modal = openModal(`<h3>Lịch sử mẫu ${h(ma)}</h3>${ds.length ? `<table data-nostt><thead><tr><th>Bản</th><th>Lúc</th><th>Người sửa</th><th></th></tr></thead><tbody>${ds.map(r => `<tr><td>v${r.PhienBan}</td><td>${h(fmtDateTime(r.CapNhatLuc))}</td><td>${h(r.NguoiSua || '')}</td><td><button class="btn small secondary" data-in="${r.LichSuID}">🖨 In thử</button> ${perm.canEdit ? `<button class="btn small" data-dung="${r.LichSuID}">↩ Dùng lại</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty-hint">Chưa có lịch sử.</div>'}
      <div class="modal-actions"><button class="btn secondary" id="lsDong">Đóng</button></div>`);
    modal.querySelector('#lsDong').addEventListener('click', closeModal);
    const tim = (id) => ds.find(x => String(x.LichSuID) === String(id));
    modal.querySelectorAll('[data-in]').forEach(b => b.addEventListener('click', () => inThu((tim(b.dataset.in) || {}).NoiDung, ma)));
    modal.querySelectorAll('[data-dung]').forEach(b => b.addEventListener('click', () => { const r = tim(b.dataset.dung); closeModal(); openSuaMau(mauCache.find(x => x.MaMau === ma) || { MaMau: ma, TenMau: ma }, r.NoiDung); }));
  }
  /* Soạn thảo: contenteditable như Mẫu văn bản HRM (không thêm thư viện). */
  function openSuaMau(m, noiDung, tenGoiY) {
    const moi = !m;
    const nut = (lenh, nhan, tip) => `<button type="button" class="btn small secondary" data-lenh="${lenh}" title="${tip}" style="min-width:34px">${nhan}</button>`;
    const modal = openModal(`<h3>${moi ? 'Mẫu hợp đồng mới' : (perm.canEdit ? 'Sửa mẫu' : 'Xem mẫu') + ': ' + h(m.TenMau)}</h3>
      <div class="form-grid"><div class="form-row"><label>Mã mẫu (chữ, số, gạch dưới)</label><input id="mMa" value="${h(moi ? (tenGoiY || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30) : m.MaMau)}" ${moi ? '' : 'readonly'}></div>
        <div class="form-row"><label>Tên mẫu</label><input id="mTen" value="${h(moi ? (tenGoiY || '') : m.TenMau)}"></div></div>
      <div style="display:grid;grid-template-columns:1fr 240px;gap:12px;align-items:start">
        <div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${nut('bold', '<b>B</b>', 'Đậm')}${nut('italic', '<i>I</i>', 'Nghiêng')}${nut('underline', '<u>U</u>', 'Gạch chân')}${nut('justifyLeft', '⬅', 'Trái')}${nut('justifyCenter', '↔', 'Giữa')}${nut('justifyRight', '➡', 'Phải')}${nut('insertUnorderedList', '• ≡', 'Danh sách')}${nut('removeFormat', '✖ĐD', 'Xóa định dạng')}${nut('undo', '↶', 'Hoàn tác')}${nut('redo', '↷', 'Làm lại')}</div>
          <div id="oSoan" contenteditable="${perm.canEdit ? 'true' : 'false'}" style="border:1px solid #dadce0;border-radius:6px;padding:14px 16px;min-height:320px;max-height:52vh;overflow:auto;background:#fff;font-family:'Times New Roman',serif;font-size:14px;line-height:1.45"></div>
          <div id="canhBao" style="margin-top:6px;font-size:13px;color:#c5221f"></div></div>
        <div><div style="font-weight:600;margin-bottom:4px">Biến điền dữ liệu</div><div style="font-size:12px;color:#5f6368;margin-bottom:6px">Bấm để chèn vào chỗ con trỏ. Biến KHÔNG có trong danh sách vẫn dùng được — nó thành ô nhập khi tạo hợp đồng.</div>
          <div style="max-height:46vh;overflow:auto;border:1px solid #eee;border-radius:6px;padding:6px">${(bienChuan || []).map(b => `<button type="button" class="btn small secondary" data-bien="${h(b[0])}" title="${h(b[1])}" style="display:block;width:100%;text-align:left;margin-bottom:3px;font-family:monospace;font-size:12px">${h(b[0])}</button>`).join('')}</div>
          <input id="bienTuDo" placeholder="Biến tự do, vd ThoiGianGiao" style="margin-top:6px;width:100%"><button type="button" class="btn small secondary" id="bChenTuDo" style="margin-top:4px;width:100%">Chèn biến tự do</button></div>
      </div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="mDong">Đóng</button><button type="button" class="btn secondary" id="mIn">🖨 In thử</button>${perm.canEdit ? '<button type="button" class="btn" id="mLuu">Lưu mẫu</button>' : ''}</div>`);
    const o = modal.querySelector('#oSoan'); o.innerHTML = noiDung || '';
    const chen = (txt) => { o.focus(); try { document.execCommand('insertText', false, txt); } catch (e) { o.innerHTML += txt; } raCanhBao(); };
    const demBien = (s) => (String(s).match(/\{\{\s*[A-Za-z0-9_]+\s*\}\}/g) || []).length;
    const raCanhBao = () => { modal.querySelector('#canhBao').textContent = demBien(o.textContent) > demBien(o.innerHTML) ? '⚠️ Có biến bị thẻ định dạng cắt đôi (bôi đậm nửa chữ) — xóa biến đó rồi chèn lại bằng nút bên phải.' : ''; };
    o.addEventListener('input', raCanhBao);
    modal.querySelectorAll('[data-lenh],[data-bien],#bChenTuDo').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
    modal.querySelectorAll('[data-lenh]').forEach(b => b.addEventListener('click', () => { o.focus(); try { document.execCommand(b.dataset.lenh, false, null); } catch (e) { /* bỏ */ } }));
    modal.querySelectorAll('[data-bien]').forEach(b => b.addEventListener('click', () => chen('{{' + b.dataset.bien + '}}')));
    modal.querySelector('#bChenTuDo').addEventListener('click', () => { const t = modal.querySelector('#bienTuDo').value.replace(/[^A-Za-z0-9_]/g, ''); if (t) chen('{{' + t + '}}'); });
    modal.querySelector('#mDong').addEventListener('click', closeModal);
    modal.querySelector('#mIn').addEventListener('click', () => inThu(o.innerHTML, modal.querySelector('#mMa').value));
    const bLuu = modal.querySelector('#mLuu');
    if (bLuu) bLuu.addEventListener('click', async () => {
      const ma = modal.querySelector('#mMa').value.trim(), ten = modal.querySelector('#mTen').value.trim();
      if (!/^[A-Za-z0-9_]{2,50}$/.test(ma)) { toast('Mã mẫu: chữ, số, gạch dưới (2–50 ký tự).', 'error'); return; }
      if (!o.innerHTML.replace(/<[^>]*>/g, '').trim()) { toast('Nội dung trống.', 'error'); return; }
      bLuu.disabled = true;
      try { await apiPut('/api/hopdong/mau/' + encodeURIComponent(ma), { tenMau: ten || ma, noiDung: o.innerHTML }); closeModal(); toast('Đã lưu mẫu.', 'success'); renderMau(); }
      catch (e) { bLuu.disabled = false; toast(e.message, 'error', 6000); }
    });
  }

  /* ================================================================ 5. CẤU HÌNH KÝ ================================================================ */
  async function renderCauHinh() {
    container.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let kq; try { kq = await apiGet('/api/hopdong/cauhinh'); } catch (e) { container.innerHTML = `<div class="empty-hint">Lỗi: ${h(e.message)}</div>`; return; }
    const c = kq.data || {}, ht = kq.heThong || {}, kenh = ht.kenh || {};
    const o = (ten, nhan, gt, them) => `<div class="form-row"><label>${nhan}</label><input name="${ten}" value="${h(gt)}" ${them || ''}></div>`;
    const dauKenh = (ok) => ok ? '<span style="color:#137333">● sẵn sàng</span>' : '<span style="color:#9aa0a6">○ chưa cấu hình</span>';
    container.innerHTML = `
      <div class="card" style="margin-bottom:12px;font-size:13px">
        <b>Hệ thống (đọc từ backend\\.env — sửa file rồi pm2 restart)</b>
        <table style="margin-top:6px"><tr><td style="width:220px">Ký số MOYN tự động</td><td>${h(ht.kyTuDong === 'tat' ? 'TẮT — người có năng lực "kyso" ký bằng USB token (công cụ MOYN Ký số) hoặc tải lên' : ht.kyTuDong.toUpperCase() + (ht.pfx ? ' · ' + ht.pfx.duongDan : '') + (ht.pkcs11 ? ' · ' + ht.pkcs11.dll : ''))}</td></tr>
          <tr><td>Dấu thời gian (TSA)</td><td>${h(ht.tsaUrl || '(tắt)')} ${ht.tsaCongCong ? '<span style="color:#b06000">— TSA công cộng, không phải TSA được cấp phép tại VN</span>' : ''}</td></tr>
          <tr><td>Kênh gửi link / OTP</td><td>Email ${dauKenh(kenh.email)} · SMS ${dauKenh(kenh.sms)} · Zalo ZNS ${dauKenh(kenh.zalo)}</td></tr>
          <tr><td>Địa chỉ công khai (link ký)</td><td>${h(ht.publicBaseUrl || '(chưa khai PUBLIC_BASE_URL — link sẽ thiếu tên miền)')}</td></tr>
          <tr><td>Ký từ xa qua CA (v9.62)</td><td>${ht.kyTuXa && ht.kyTuXa.san ? '<span style="color:#137333">● ' + h(ht.kyTuXa.tenHienThi || ht.kyTuXa.nha) + '</span> · ' + h(ht.kyTuXa.baseUrl || '') + ' — khách và MOYN ký bằng ' + h(ht.kyTuXa.nhanUserId || 'mã người dùng') + ', xác nhận trên app / OTP, không cần USB token' : '<span style="color:#9aa0a6">○ chưa cấu hình</span> — khai KYTUXA_NHA=vnptsmartca|csc + tài khoản tích hợp trong .env (xem .env.example). <b>Cần hợp đồng dịch vụ với nhà cung cấp.</b>'}</td></tr>
          <tr><td>Chứng thư CA gốc (kiểm chuỗi tin cậy)</td><td>${ht.chungThuGoc && ht.chungThuGoc.ds && ht.chungThuGoc.ds.length ? ht.chungThuGoc.ds.map(x => '<div>● ' + h(x.CN) + (x.denNgay ? ' <span style="color:#5f6368">(đến ' + h(fmtDate(x.denNgay)) + ')</span>' : '') + ' <span style="color:#9aa0a6">' + h(x.file) + '</span></div>').join('') : '<span style="color:#b06000">○ thư mục trống — chưa kiểm được chuỗi tin cậy (vẫn ký được; kiểm bằng Adobe Reader)</span>'}
            <div style="font-size:12px;color:#5f6368">Thư mục: ${h((ht.chungThuGoc && ht.chungThuGoc.thuMuc) || 'backend\\chungthu_goc')} — chép file .cer/.pem của CA gốc + CA trung gian (VNPT-CA, Viettel-CA, FPT-CA, NEAC Root…) vào rồi tải lại trang (không cần restart).${ht.chungThuGoc && ht.chungThuGoc.loi && ht.chungThuGoc.loi.length ? ' <span style="color:#c5221f">Lỗi đọc: ' + h(ht.chungThuGoc.loi.join('; ')) + '</span>' : ''}</div></td></tr>
          ${ht.v894 === false ? '<tr><td style="color:#c5221f">CSDL</td><td style="color:#c5221f">Chưa chạy <b>migration_v894.sql</b> — phụ lục / thanh lý, hóa đơn, chuỗi tin cậy, nhắc hạn chưa hoạt động.</td></tr>' : ''}</table>
        <div style="margin-top:6px"><button class="btn small secondary" id="bKiemKy">🔎 Kiểm bộ ký (đọc chứng thư)</button> <button class="btn small secondary" id="bKyThu">🧪 Ký thử một PDF</button> <a class="btn small secondary" href="/tools/MoynKySo/README.md" target="_blank" style="text-decoration:none">⬇ Công cụ MOYN Ký số (USB token)</a><div id="kqKiem" style="margin-top:6px"></div></div>
      </div>
      <form id="cfgForm"><h4 style="margin:0 0 6px">Bên bán (in vào hợp đồng + trang chứng nhận)</h4>
        <div class="form-grid">${o('tenCongTy', 'Tên pháp nhân', c.tenCongTy)}${o('mst', 'Mã số thuế', c.mst)}${o('diaChi', 'Địa chỉ', c.diaChi)}${o('nguoiKy', 'Người ký (đại diện)', c.nguoiKy)}${o('chucVu', 'Chức vụ', c.chucVu)}${o('sdt', 'Điện thoại', c.sdt)}${o('email', 'Email', c.email, 'type="email"')}${o('soTaiKhoan', 'Số tài khoản ngân hàng', c.soTaiKhoan)}${o('diaDiemKy', 'Địa điểm ký (mặc định)', c.diaDiemKy)}${o('ghiChuThue', 'Ghi chú thuế trên giá (vd: đã bao gồm VAT)', c.ghiChuThue)}</div>
        <h4 style="margin:10px 0 6px">Gửi link & OTP</h4>
        <div class="form-grid">${o('hanLinkNgay', 'Hạn link ký (ngày)', c.hanLinkNgay, 'type="number" min="1" max="90"')}
          <div class="form-row"><label>Kênh mặc định</label><select name="kenhMacDinh">${['email', 'sms', 'zalo'].map(k => `<option value="${k}" ${c.kenhMacDinh === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
          ${o('emailKeToan', 'Email kế toán nhận báo "đã ký xong"', c.emailKeToan, 'type="email"')}</div>
        <h4 style="margin:10px 0 6px">Nhắc hạn ký tự động (v9.62) <span style="font-weight:normal;font-size:12px;color:#5f6368">— mỗi ngày đúng giờ: hợp đồng Chờ ký sắp hết hạn → gửi lại link cho khách (mỗi HĐ nhắc tối đa 1 lần/ngày); quá hạn → chuyển "Hết hạn" + báo kế toán</span></h4>
        <div class="form-grid">
          <div class="form-row"><label>Bật nhắc</label><label style="font-weight:normal"><input type="checkbox" name="batNhac" ${c.batNhac !== false ? 'checked' : ''}> Có</label></div>
          ${o('nhacTruocNgay', 'Nhắc trước hạn (ngày)', c.nhacTruocNgay == null ? 2 : c.nhacTruocNgay, 'type="number" min="0" max="30"')}
          ${o('gioNhac', 'Giờ chạy (HH:MM, giờ VN)', c.gioNhac || '08:30', 'pattern="\\d{1,2}:\\d{2}" placeholder="08:30"')}
          <div class="form-row"><label>&nbsp;</label>${perm.canEdit ? '<button type="button" class="btn small secondary" id="bNhacNgay">▶ Chạy nhắc ngay (thử)</button>' : ''}</div></div>
        ${perm.canEdit ? '<div class="modal-actions" style="justify-content:flex-start"><button type="submit" class="btn">💾 Lưu cấu hình</button></div>' : ''}
      </form>`;
    container.querySelector('#cfgForm').addEventListener('submit', async (e) => {
      e.preventDefault(); const fd = new FormData(e.target); const body = {}; for (const [k, v] of fd.entries()) body[k] = v;
      body.batNhac = !!e.target.elements.batNhac.checked;   // checkbox không tick thì FormData bỏ qua
      try { await apiPut('/api/hopdong/cauhinh', body); toast('Đã lưu cấu hình.', 'success'); } catch (err) { toast(err.message, 'error'); }
    });
    const bNhac = container.querySelector('#bNhacNgay');
    if (bNhac) bNhac.addEventListener('click', async () => { bNhac.disabled = true; try { const r = await apiPost('/api/hopdong/cauhinh/nhac-ngay', {}); toast(r.message || 'Đã chạy.', 'success', 8000); } catch (err) { toast(err.message, 'error', 8000); } bNhac.disabled = false; });
    container.querySelector('#bKiemKy').addEventListener('click', async () => {
      const kq2 = container.querySelector('#kqKiem'); kq2.textContent = 'Đang đọc chứng thư…';
      try { const r = (await apiPost('/api/hopdong/cauhinh/kiem-bo-ky', {})).data; kq2.innerHTML = r.loi ? `<span style="color:#c5221f">Lỗi: ${h(r.loi)}</span>` : (r.chungThu ? `Bộ ký <b>${h(r.loai)}</b>: ${h(r.chungThu.CN)} · MST ${h(r.chungThu.MST || '—')} · cấp bởi ${h(r.chungThu.nguoiCap || '')} · hết hạn ${h(r.chungThu.denNgay ? fmtDate(r.chungThu.denNgay) : '')} ${r.canhBao ? '<b style="color:#c5221f">' + h(r.canhBao) + '</b>' : ''}` : h(r.ghiChu || '')); }
      catch (err) { kq2.innerHTML = `<span style="color:#c5221f">${h(err.message)}</span>`; }
    });
    container.querySelector('#bKyThu').addEventListener('click', () => chonFile('.pdf', async (f) => {
      try {
        const fd = new FormData(); fd.append('file', f);
        const res = await fetch('/api/hopdong/cauhinh/ky-thu', { method: 'POST', credentials: 'same-origin', body: fd });
        if (!res.ok) { let m = 'Lỗi'; try { m = (await res.json()).message || m; } catch (e) { /* bỏ */ } toast(m, 'error', 8000); return; }
        const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ky_thu.pdf'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000);
        toast('Đã ký thử — mở file bằng Adobe Reader, xem bảng Signatures. TSA: ' + (res.headers.get('X-TSA') === 'ok' ? 'có dấu thời gian' : 'KHÔNG có dấu thời gian'), 'success', 8000);
      } catch (e) { toast(e.message, 'error', 8000); }
    }));
  }

  return { render, getTabs };
})();
