// Phan he THE KHO HANG HOA (thanh pham)
window.ModuleKhoHang = (function () {
  let activeTab = 'items';
  let container, currentUser, dm = null;
  // v5.49: giữ bộ lọc Đơn khách đặt hàng qua các lần re-render (thao tác trạng thái/xóa không reset về Tất cả).
  let ordFilterKhach = '';
  /* v6.74.2: chuẩn hoá tên khách để SO KHỚP (bỏ khoảng trắng thừa, không phân biệt hoa/thường).
     Dùng chung cho bộ lọc đơn khách đặt và modal chọn đơn lên phiếu bán hàng — hai chỗ mà so tên
     bằng hai luật khác nhau thì cùng một khách sẽ ra hai kết quả khác nhau.
     KHÔNG bỏ dấu: "An Bình" và "An Binh" là hai tên thật sự khác, gộp ở đây là gộp nhầm. */
  const chuanTenKhach = (x) => String(x == null ? '' : x)
    /* v6.74.6: normalize('NFC') BẮT BUỘC. Tiếng Việt có hai cách lưu cùng một chữ: "ắ" là một ký tự
       U+1EAF, hoặc "a" + hai dấu rời U+0306 U+0301. Hai chuỗi HIỆN LÊN Y HỆT NHAU nhưng JavaScript
       so là KHÁC — đó là lý do danh sách khách ra hai dòng trông giống hệt nhau mà không ai hiểu vì sao.
       Excel/Word/macOS hay sinh ra dạng rời khi copy-dán. */
    .normalize('NFC')
    .trim().replace(/\s+/g, ' ').toLowerCase();
  let ordFilterMaHang = '';
  let ordFilterTrangThai = '';   // v5.53: lọc theo trạng thái đơn khách
  let ordFilterMau = '';         // v5.81: lọc theo màu
  let ordFilterThoiGian = '';    // v5.81: lọc theo thời gian (khớp chuỗi ngày đang hiện, vd "28/07")

  /* v6.21: GIÁ SAU CHIẾT KHẤU — MỘT TỶ LỆ DÙNG CHUNG cho mọi mã hàng (v6.20 từng khai theo từng mã
     hàng, người dùng yêu cầu đánh chung). Tỷ lệ lưu ở CauHinhHeThong: CK_SHOP (mặc định 33), CK_NPP (17).
       Giá shop = Giá bán × (1 − CK_SHOP/100)
       Giá NPP  = Giá SHOP × (1 − CK_NPP/100)     ← chiết khấu CHỒNG, KHÔNG tính lại trên giá bán
     VD giá bán 100.000, 33%/17% → shop 67.000 → NPP 55.610.
     Giá KHÔNG lưu trong CSDL, luôn tính tại chỗ ⇒ sửa Giá bán hoặc tỷ lệ là mọi nơi tự đúng theo. */
  let tyLeCK = { shop: 33, npp: 17 };   // nạp lại từ API mỗi lần render
  function giaShopSauCK(giaBan) {
    return Math.round((Number(giaBan) || 0) * (1 - (Number(tyLeCK.shop) || 0) / 100) * 100) / 100;
  }
  function giaNPPSauCK(giaBan) {
    return Math.round(giaShopSauCK(giaBan) * (1 - (Number(tyLeCK.npp) || 0) / 100) * 100) / 100;
  }
  /* v6.21.1: GIÁ LÀ GIÁ 1 CÁI ⇒ bảng kê in và Excel phải quy SL về Cái (đơn đặt theo Ri mà lấy thẳng
     SL thì thiếu đúng <LoaiRi> lần). Bản sao của slSangCai() ở backend/routes/khohang.js — sửa 1 chỗ
     phải sửa cả 2. Khác fmtDualUnit(): ở đây chỉ cần CON SỐ Cái, không cần chuỗi hiển thị kép. */
  function slSangCai(soLuong, donVi, loaiRi, mh) {   // v6.31: mh = { DonViCoBan, DonViQuyDoi } của mã hàng
    const n = Number(soLuong) || 0, he = Number(loaiRi) || 1;
    return Math.round(laDonViGop(donVi, mh) ? n * he : n);
  }

  function getTabs() {
    return [
      { key: 'items', label: 'Thẻ kho / Tồn kho' },
      { key: 'orders', label: 'Đơn khách đặt hàng' },
      // v6.23: bán hàng nằm TRONG phân hệ Thẻ kho hàng hóa (theo yêu cầu), quyền riêng KHOHANG/banhang.
      { key: 'banhang', label: 'Phiếu bán hàng' },
    // v6.66: hàng khách TRẢ LẠI - hoàn tồn + giảm công nợ. Code nằm ở module.nhaplai.js cho gọn file này.
    { key: 'nhaplai', label: 'Phiếu nhập lại' },
    // v6.78: phiếu nhập kho (từ NCC / từ sản xuất). Code ở module.nhapkho.js cho gọn file này.
    { key: 'nhapkho', label: 'Phiếu nhập kho' },
      // v5.17 (muc 1.2): 1 tab duy nhat gom ca "Tạo báo giá" (muc 1.2.1) va "Danh sách báo giá"
      // (muc 1.2.2) - dung 1 chuc nang ChucNang('KHOHANG','baogiaaloha') duy nhat cho ca 2, giong
      // dung cach nguoi dung mo ta chung la 2 "chuc nang con" cua CUNG 1 chuc nang cha "Báo giá Aloha".
      { key: 'baogiaaloha', label: 'Báo giá Aloha' },
      // v5.63: tài khoản để KHÁCH đăng nhập đặt hàng trên trang công khai (nhân viên tạo, không tự đăng ký).
      { key: 'taikhoankhach', label: 'Tài khoản khách' }
    ];
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    // v5.3: giao voi quyen rieng theo chuc nang (tab dang mo) - xem effectivePerm() trong common.js.
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.KHOHANG || {});
    const perm = effectivePerm(user, 'KHOHANG', activeTab, rawPerm);
    // v5.6: bo cache "chi tai 1 lan" (truoc day "if (!dm)") - danh muc "Loại hàng" (DanhMucNhomSanPham,
    // v5.4) la bang MOI hay duoc them dong ngay trong luc dang thao tac (qua Danh mục → Loại hàng); giu
    // cache vinh vien khien tab nay van hien danh sach CU cho toi khi F5 lai ca trang, de nham la loi
    // "không hiển thị được dữ liệu" (xem HUONG_DAN_CAI_DAT.md Bước 2.10). Chi phi goi lai API nay khong
    // dang ke (bang danh muc nho) nen doi lay du lieu luon moi la hop ly hon giu cache.
    dm = (await apiGet('/api/khohang/danhmuc')).data;

    container.innerHTML = `<div id="khBody"></div>`;

    if (activeTab === 'items') return renderItems(perm);
    if (activeTab === 'baogiaaloha') return renderBaoGiaAloha(perm);
    if (activeTab === 'taikhoankhach') return renderTaiKhoanKhach(perm);   // v5.63
    if (activeTab === 'banhang') return renderBanHang(perm);               // v6.23
    // v6.66: tab Phiếu nhập lại nằm ở file riêng (module.nhaplai.js) cho file này khỏi phình.
    // Quên nạp script thì báo rõ thay vì để trang trắng không hiểu vì sao.
    if (activeTab === 'nhapkho') {
      if (!window.ModuleNhapKho) {
        document.getElementById('khBody').innerHTML =
          '<div class="empty-hint">Chưa nạp module.nhapkho.js — copy file này lên rồi Ctrl+F5.</div>';
        return;
      }
      return window.ModuleNhapKho.render(container, user, activeTab);
    }
    if (activeTab === 'nhaplai') {
      if (!window.ModuleNhapLai) {
        document.getElementById('khBody').innerHTML =
          '<div class="empty-hint">Chưa nạp module.nhaplai.js — copy file này lên rồi Ctrl+F5.</div>';
        return;
      }
      return window.ModuleNhapLai.render(container, user, activeTab);
    }
    return renderOrders(perm);
  }

  /* ================================================================================================
     v5.63: TÀI KHOẢN KHÁCH — nhân viên tạo tài khoản rồi gửi khách (tên đăng nhập + mật khẩu) để
     khách vào LINK DANH MỤC CÔNG KHAI đăng nhập và đặt hàng. Khách KHÔNG tự đăng ký được.
     Đơn khách đặt sẽ vào "Đơn khách đặt hàng" ở trạng thái "Chờ xác nhận" (chưa trừ tồn).
     ================================================================================================ */
  async function renderTaiKhoanKhach(perm) {
    const body = document.getElementById('khBody');
    body.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let rows = [];
    try { rows = (await apiGet('/api/khohang/taikhoankhach')).data || []; }
    catch (e) { body.innerHTML = `<div class="empty-hint">Không tải được danh sách: ${escapeHtml(e.message)}</div>`; return; }
    body.innerHTML = `
      <div class="toolbar">${perm.canCreate ? '<button class="btn" id="btnAddTKK">+ Tạo tài khoản khách</button>' : ''}</div>
      <p class="empty-hint" style="text-align:left;padding:0 0 8px;">Tạo tài khoản rồi gửi khách <b>tên đăng nhập + mật khẩu</b> kèm <b>link danh mục công khai</b> (Danh mục → Danh mục thẻ kho → Copy link). Khách đăng nhập ngay trên link đó để đặt hàng; đơn về mục <b>Đơn khách đặt hàng</b> với trạng thái <b>Chờ xác nhận</b> và <b>chưa trừ tồn kho</b>.</p>
      <table><thead><tr><th>Tên đăng nhập</th><th>Tên khách</th><th>SĐT</th><th>Trạng thái</th><th>Số đơn</th><th>Đăng nhập cuối</th><th style="width:170px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><b>${escapeHtml(r.TenDangNhap)}</b></td><td>${escapeHtml(r.TenKhach)}</td><td>${escapeHtml(r.SDT || '')}</td>
        <td>${r.TrangThai === 'Tạm dừng' ? '<span class="badge danger">Tạm dừng</span>' : '<span class="badge ok">Hoạt động</span>'}</td>
        <td style="text-align:right;">${fmtNumber(r.SoDon || 0)}</td>
        <td>${r.LanDangNhapCuoi ? fmtDate(r.LanDangNhapCuoi) : '—'}</td>
        <td>${perm.canEdit ? `<button class="btn small secondary act-tkk-edit" data-id="${r.TaiKhoanKhachID}">Sửa / Đổi mật khẩu</button> ` : ''}${perm.canDelete ? `<button class="btn small danger act-tkk-del" data-id="${r.TaiKhoanKhachID}">Xóa</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="7" class="empty-hint">Chưa có tài khoản khách nào</td></tr>'}</tbody></table>`;
    const bAdd = document.getElementById('btnAddTKK');
    if (bAdd) bAdd.addEventListener('click', () => openTaiKhoanKhachForm(null, perm));
    body.querySelectorAll('.act-tkk-edit').forEach(b => b.addEventListener('click', () =>
      openTaiKhoanKhachForm(rows.find(x => String(x.TaiKhoanKhachID) === String(b.dataset.id)), perm)));
    body.querySelectorAll('.act-tkk-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Xóa tài khoản khách này? Các đơn đã đặt vẫn được giữ lại.')) return;
      try { await apiDelete('/api/khohang/taikhoankhach/' + b.dataset.id); toast('Đã xóa.', 'success'); renderTaiKhoanKhach(perm); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }
  function openTaiKhoanKhachForm(row, perm) {
    const isEdit = !!row;
    const modal = openModal(`
      <h3>${isEdit ? 'Sửa tài khoản khách' : 'Tạo tài khoản khách'}</h3>
      <form id="tkkForm">
        <div class="form-grid">
          <div class="form-row"><label>Tên đăng nhập *</label><input id="tkk_u" value="${escapeHtml(row ? row.TenDangNhap : '')}" ${isEdit ? 'disabled' : 'required'} placeholder="vd: shopanh"></div>
          <div class="form-row"><label>${isEdit ? 'Mật khẩu mới (để trống = giữ nguyên)' : 'Mật khẩu *'}</label><input type="text" id="tkk_p" placeholder="${isEdit ? 'Để trống nếu không đổi' : 'Tối thiểu 4 ký tự'}"></div>
          <div class="form-row"><label>Tên khách (hiện trên đơn) *</label><input id="tkk_ten" value="${escapeHtml(row ? row.TenKhach : '')}" required></div>
          <div class="form-row"><label>SĐT</label><input id="tkk_sdt" value="${escapeHtml(row ? (row.SDT || '') : '')}"></div>
          <div class="form-row"><label>Email</label><input id="tkk_em" value="${escapeHtml(row ? (row.Email || '') : '')}"></div>
          <div class="form-row"><label>Trạng thái</label><select id="tkk_tt" data-nosearch><option ${row && row.TrangThai === 'Tạm dừng' ? '' : 'selected'}>Hoạt động</option><option ${row && row.TrangThai === 'Tạm dừng' ? 'selected' : ''}>Tạm dừng</option></select></div>
        </div>
        <div class="form-row"><label>Địa chỉ</label><input id="tkk_dc" value="${escapeHtml(row ? (row.DiaChi || '') : '')}"></div>
        <div class="form-row"><label>Ghi chú</label><input id="tkk_gc" value="${escapeHtml(row ? (row.GhiChu || '') : '')}"></div>
        <p class="empty-hint" style="text-align:left;">Mật khẩu được mã hóa khi lưu — sau này không xem lại được, chỉ đặt lại mật khẩu mới. Hãy gửi khách ngay sau khi tạo.</p>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button><button type="submit" class="btn">Lưu</button></div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#tkkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        tenDangNhap: (modal.querySelector('#tkk_u').value || '').trim(),
        matKhau: modal.querySelector('#tkk_p').value || '',
        tenKhach: (modal.querySelector('#tkk_ten').value || '').trim(),
        sdt: (modal.querySelector('#tkk_sdt').value || '').trim() || null,
        email: (modal.querySelector('#tkk_em').value || '').trim() || null,
        diaChi: (modal.querySelector('#tkk_dc').value || '').trim() || null,
        trangThai: modal.querySelector('#tkk_tt').value,
        ghiChu: (modal.querySelector('#tkk_gc').value || '').trim() || null
      };
      if (!isEdit && payload.matKhau.length < 4) { toast('Mật khẩu tối thiểu 4 ký tự.', 'error'); return; }
      try {
        if (isEdit) await apiPut('/api/khohang/taikhoankhach/' + row.TaiKhoanKhachID, payload);
        else await apiPost('/api/khohang/taikhoankhach', payload);
        closeModal(); toast('Đã lưu tài khoản khách.', 'success'); renderTaiKhoanKhach(perm);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.41.4: 2 cột đơn vị hiện tồn ở ĐÚNG cột đơn vị của mặt hàng (cột kia để trống), không quy đổi chéo.
  // (Đã bỏ helper tonQuyDoiHtml — logic đặt cột nằm ngay trong renderItems bên dưới.)

  async function renderItems(perm) {
    const body = document.getElementById('khBody');
    const res = await apiGet('/api/khohang/items');
    const { tongHop, chiTiet } = res.data;
    if (res.data.tyLeCK) tyLeCK = res.data.tyLeCK;   // v6.21: tỷ lệ CK dùng chung
    // v5.4 (muc 1): "Loai hang" (NhaSanXuat/DatNgoai) doi ten hien thi thanh "Nguon hang" de nhuong lai
    // nhan "Loai hang" cho truong nhom san pham MOI (TenNhom, vd Quan be trai/gai) - xem migration_v54.sql.
    // Dong het hang (TongTon<=0) to mau do + ghi chu "Het hang"/"Am kho" - CHI danh sach noi bo nay,
    // KHONG ap dung Catalogue (theo xac nhan cua nguoi dung, xem public.js/catalogue.js khong doi).
    const loaiList = [...new Set(tongHop.map(r => r.TenNhom).filter(Boolean))].sort();
    const dmList = [...new Set(tongHop.map(r => r.TenTheKho).filter(Boolean))].sort();
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <input type="text" id="khSearch" placeholder="Tìm mã hàng / tên hàng / mã ĐH...">
        <select id="khLoai"><option value="">-- Loại hàng --</option>${loaiList.map(x => `<option>${escapeHtml(x)}</option>`).join('')}</select>
        <select id="khDanhMuc"><option value="">-- Danh mục --</option>${dmList.map(x => `<option>${escapeHtml(x)}</option>`).join('')}</select>
        <a class="btn small secondary" href="/api/khohang/items/export">⬇️ Xuất Excel</a>
        ${perm.canCreate ? '<button type="button" class="btn small" id="btnAddNew" style="margin-left:auto;">+ Tạo thẻ kho mới</button>' : ''}
      </div>
      ${/* v6.21: tỷ lệ CK ĐÁNH CHUNG cho mọi mã hàng — sửa 1 chỗ, cả bảng + bảng kê in + Excel đổi theo. */''}
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#f8f9fa;">
        <b style="font-size:13px;">Tỷ lệ chiết khấu dùng chung:</b>
        <label style="font-size:13px;">CK shop <input type="number" id="ckShop" step="0.01" min="0" max="100" value="${tyLeCK.shop}" style="width:74px;"> %</label>
        <label style="font-size:13px;">CK NPP <input type="number" id="ckNPP" step="0.01" min="0" max="100" value="${tyLeCK.npp}" style="width:74px;"> %</label>
        ${perm.canEdit ? '<button type="button" class="btn small" id="btnLuuCK">💾 Lưu tỷ lệ</button>' : ''}
        <span class="empty-hint" style="padding:0;">Giá shop = Giá bán − CK shop. <b>Giá NPP = giá shop − CK NPP</b> (chiết khấu chồng, không tính lại trên giá bán).</span>
      </div>
      <table><thead><tr><th>Ảnh</th><th>Mã hàng</th><th>Tên hàng</th><th>Nguồn hàng</th><th>Loại hàng</th><th>Giá bán</th><th>Giá sau CK shop<div style="font-weight:400;font-size:11px;">(${fmtNumber(tyLeCK.shop)}%)</div></th><th>Giá sau CK NPP<div style="font-weight:400;font-size:11px;">(${fmtNumber(tyLeCK.npp)}% trên giá shop)</div></th><th>Danh mục</th><th>Tổng nhập<div style="font-weight:400;font-size:11px;">(theo Ri)</div></th><th>Tổng xuất<div style="font-weight:400;font-size:11px;">(theo Ri)</div></th><th>Tồn quy ra Cái</th><th>Tồn (Ri)</th><th>Khả dụng<div style="font-weight:400;font-size:11px;">(theo Ri, trừ đơn đang chờ)</div></th><th style="width:130px">Thao tác</th></tr></thead>
      <tbody>${tongHop.map(r => {
        const hetHang = Number(r.TongTon) <= 0;
        // v5.41.5: CẢ 2 cột đều hiện tồn quy đổi. ĐVT (Cái) = số cái; ĐVT (Ri) = số ri kèm hệ số "Ri{hệ số}".
        // Tồn lưu theo đơn vị chính (DonViCoBan): chính=Cái -> cái=tồn, ri=tồn÷hệ số (lẻ ghi "dư N Cái");
        // chính=Ri -> ri=tồn, cái=tồn×hệ số. Hệ số <=1 (không quy đổi ri) -> cột Ri hiện "—".
        const tonKho = Number(r.TongTon) || 0, heRi = Number(r.LoaiRi) || 1;
        const dvLaRi = donViChinhLaGop(r);   // v6.31: theo ĐVT quy đổi của mã hàng, không theo tên "Ri"

        const dvChinh = r.DonViCoBan || 'Cái';   // v6.23.1: đơn vị THẬT của Tổng nhập/xuất/khả dụng
        const tonBadge = tonKho < 0 ? '<span class="badge danger">Âm kho</span>' : (tonKho === 0 ? '<span class="badge danger">Hết hàng</span>' : '');
        const soCaiVal = dvLaRi ? tonKho * heRi : tonKho;
        let soRiHtml;
        if (heRi <= 1) soRiHtml = '—';
        else if (dvLaRi) soRiHtml = `${fmtNumber(tonKho)} Ri${heRi}`;
        // v6.27: nhãn phần dư lấy theo ĐVT chính thật (Cái / Bộ), không ghi cứng "Cái".
        else { const _ri = Math.trunc(tonKho / heRi), _du = tonKho - _ri * heRi; soRiHtml = `${fmtNumber(_ri)} Ri${heRi}${_du ? ` dư ${fmtNumber(_du)} ${escapeHtml(dvChinh)}` : ''}`; }
        const tdDvtCai = `${fmtNumber(soCaiVal)}${tonBadge ? ' ' + tonBadge : ''}`;
        const tdDvtRi = soRiHtml;
        return `<tr data-loai="${escapeHtml(r.TenNhom || '')}" data-dm="${escapeHtml(r.TenTheKho || '')}" data-search="${escapeHtml(((r.MaHang || '') + ' ' + (r.TenHang || '') + ' ' + (r.MaDH || '')).toLowerCase())}" ${hetHang ? 'style="background:#fdecea;"' : ''}>
        ${/* v6.07: ô ảnh nhỏ dùng ẢNH XEM TRƯỚC 160px + loading="lazy" (trước tải đúng file gốc, có ảnh
             vài MB cho 1 ô 40px -> danh sách vài trăm dòng là tải hàng trăm MB). Bấm phóng to vẫn ảnh GỐC
             qua data-src. */''}
        <td>${r.AnhDaiDien ? `<img class="thumb act-zoom-main" loading="lazy" decoding="async" data-src="${escapeHtml(r.AnhDaiDien)}" data-title="${escapeHtml(r.MaHang)}" src="${escapeHtml(anhNho(r.AnhDaiDien, 160))}" style="cursor:pointer;" title="Bấm để phóng to">` : ''}</td>
        ${/* v6.89: mã đã có hàng vào kho bằng PHIẾU NHẬP KHO nhưng CHƯA tạo thẻ kho -> mọi cột của
             bảng này đều 0 (đúng: bảng này chỉ hiện số liệu của thẻ kho). Không nói rõ thì người dùng
             tưởng mất hàng. Số của phiếu nằm ở Báo cáo tồn kho và ở màn Bán hàng. */''}
        <td><a href="javascript:void(0)" class="act-open-hist" data-mahang="${escapeHtml(r.MaHang)}" title="Xem lịch sử &amp; chi tiết theo màu">${escapeHtml(r.MaHang)}</a>${
          Number(r.TongNhapTuPhieu) && Number(r.TongTon) === 0
            ? `<div style="font-size:11px;color:#8a6d3b;">⏳ chưa tạo thẻ kho · phiếu nhập ${fmtNumber(r.TongNhapTuPhieu)} ${escapeHtml(r.DonViCoBan || 'Cái')}</div>`
            : (Number(r.TongNhapTuPhieu) ? `<div style="font-size:11px;color:#5f6368;">+ ${fmtNumber(r.TongNhapTuPhieu)} ${escapeHtml(r.DonViCoBan || 'Cái')} từ phiếu nhập</div>` : '')
        }</td>
        <td>${escapeHtml(r.TenHang)}</td>
        <td>${r.LoaiHang === 'NhaSanXuat' ? `<span class="badge info">Nhà SX${r.MaDH ? ' · ' + escapeHtml(r.MaDH) : ''}</span>` : '<span class="badge warn">Đặt ngoài</span>'}</td>
        <td>${escapeHtml(r.TenNhom || '')}</td>
        <td>${fmtNumber(r.GiaBan)}</td>
        <td><b>${fmtNumber(giaShopSauCK(r.GiaBan))}</b></td>
        <td><b>${fmtNumber(giaNPPSauCK(r.GiaBan))}</b></td>
        ${/* v6.23.1: GHI RÕ ĐƠN VỊ cạnh Tổng nhập / Tổng xuất / Khả dụng. 3 số này lưu theo ĐƠN VỊ
             CHÍNH của TỪNG mã hàng (Cái hoặc Ri) — trước đây để trần nên mã khai đơn vị chính = Ri mà
             số liệu thực chất là Cái sẽ bị đọc nhầm (và 2 cột ĐVT quy đổi cũng nhân sai theo). */''}
        <td>${escapeHtml(r.TenTheKho)}</td>
        <td>${oSoRi(r.TongNhap, r)}</td>
        <td>${oSoRi(r.TongXuat, r)}</td>
        <td>${tdDvtCai}</td>
        <td>${tdDvtRi}</td>
        ${/* v6.23: KHẢ DỤNG = tồn − đang giữ cho các đơn khách đặt chưa xuất phiếu bán hàng. */''}
        <td>${oSoRi(r.TonKhaDung, r, true)}${Number(r.DangGiu) ? `<div style="font-size:11px;color:#e37400;">đang giữ ${soTheoRi(dvLaRi ? Number(r.DangGiu) * heRi : Number(r.DangGiu), heRi).chinh}</div>` : ''}</td>
        <td>
          ${/* v6.71: NÚT BẬT/TẮT NGAY TẠI DÒNG — không phải mở form Sửa chỉ để giấu một mã.
               Trạng thái đọc thẳng từ dữ liệu (CongKhai), bấm là gọi PUT rồi vẽ lại theo kết quả thật,
               KHÔNG tự lật màu ở client trước — lật trước mà lưu hỏng thì màn hình nói dối. */''}
          ${perm.canEdit ? `<button type="button" class="btn small ${Number(r.CongKhai) ? '' : 'secondary'} act-public"
              data-id="${r.MaHangID}" data-mahang="${escapeHtml(r.MaHang)}" data-dang="${Number(r.CongKhai) ? 1 : 0}"
              title="${Number(r.CongKhai) ? 'Đang hiện trên catalogue — bấm để ẩn' : 'Đang ẩn khỏi catalogue — bấm để hiện'}"
              >${Number(r.CongKhai) ? '🌐 Public' : '🔒 Ẩn'}</button>` : ''}
          ${perm.canEdit ? `<button class="btn small secondary act-edit" data-id="${r.MaHangID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button type="button" class="btn small danger act-del" data-id="${r.MaHangID}" data-mahang="${escapeHtml(r.MaHang)}">Xóa</button>` : ''}
        </td>
      </tr>`;
      }).join('') || '<tr><td colspan="15" class="empty-hint">Chưa có thẻ kho nào</td></tr>'}</tbody></table>`;

    // Luu y: truyen null (KHONG phai chiTiet) khi tao moi - chiTiet la mang mau CUA TAT CA ma hang,
    // truyen nham vao day se lam form "Tao the kho moi" hien sot mau cua nhung ma hang khac (bug cu).
    // v6.21: lưu tỷ lệ CK dùng chung (MERGE ở backend nên không cần migration).
    const btnLuuCK = body.querySelector('#btnLuuCK');
    if (btnLuuCK) btnLuuCK.addEventListener('click', async () => {
      const shop = body.querySelector('#ckShop').value, npp = body.querySelector('#ckNPP').value;
      try {
        const r = await apiPut('/api/khohang/cauhinh-ck', { shop, npp });
        tyLeCK = r.data || tyLeCK;
        toast('Đã lưu tỷ lệ chiết khấu — áp cho TẤT CẢ mã hàng.', 'success');
        renderItems(perm);
      } catch (err) { toast(err.message, 'error'); }
    });
    /* v6.71: bật/tắt công khai ngay tại dòng. Chỉ gửi đúng trường `congKhai` — backend giữ nguyên
       mọi trường khác (ISNULL), nên không có chuyện bấm nút này lại làm rơi dữ liệu ô nào khác. */
    body.querySelectorAll('.act-public').forEach(btn => btn.addEventListener('click', async () => {
      const bat = btn.dataset.dang !== '1';
      btn.disabled = true;
      try {
        await apiPut('/api/khohang/items/' + btn.dataset.id + '/congkhai', { congKhai: bat });
        toast(`${btn.dataset.mahang}: ${bat ? 'đã HIỆN trên catalogue' : 'đã ẨN khỏi catalogue'}.`, 'success');
        renderItems(perm);
      } catch (err) { btn.disabled = false; toast(err.message, 'error'); }
    }));
    body.querySelectorAll('.act-edit').forEach(btn => btn.addEventListener('click', () => {
      const row = tongHop.find(r => String(r.MaHangID) === btn.dataset.id);
      /* v6.89: BỎ các dòng chỉ tồn tại trên PHIẾU NHẬP KHO (ID = null, chưa có trong thẻ kho).
         Form Sửa mà nhận chúng thì bấm Lưu sẽ INSERT thành dòng màu thật của thẻ kho — tức là phiếu
         nhập lại "chui" vào thẻ kho, đúng cái phải tránh. */
      openItemForm(row, perm, chiTiet.filter(c => c.MaHangID === row.MaHangID && c.ID != null))
        .catch(err => toast(err.message, 'error'));
    }));
    // v5.40: nút "+ Tạo thẻ kho mới" nằm ngay trong toolbar tab Thẻ kho / Tồn kho (đã bỏ tab tạo riêng).
    const btnAddNew = body.querySelector('#btnAddNew');
    if (btnAddNew) btnAddNew.addEventListener('click', () => openItemForm(null, perm, null).catch(err => toast(err.message, 'error')));
    // v5.3 (muc 2): xoa ma hang theo phan quyen - backend chan neu da co don dat hang lien ket.
    body.querySelectorAll('.act-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm(`Xóa thẻ kho "${btn.dataset.mahang}"? Chỉ xóa được nếu chưa có đơn khách đặt hàng nào liên kết.`)) return;
      try { await apiDelete('/api/khohang/items/' + btn.dataset.id); toast('Đã xóa.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));
    // Bam vao Ma hang cung mo duoc lich su (gop chung voi nut "Lich su" cu cho gon giao dien)
    body.querySelectorAll('.act-open-hist').forEach(a => a.addEventListener('click', () => openHistory(a.dataset.mahang, perm)));
    // v5.4 (muc 1): anh dai dien trong danh sach - bam de phong to. Trang danh sach KHONG phai modal
    // nen dong khong can onClose rieng (dong lightbox se tu quay lai trang danh sach nhu binh thuong).
    body.querySelectorAll('.act-zoom-main').forEach(img => img.addEventListener('click', () => {
      openImageLightbox(img.dataset.src, img.dataset.title);
    }));
    // v5.36: tìm ký tự bất kỳ + lọc Loại hàng / Danh mục (ẩn/hiện dòng, không re-render).
    function applyKhFilter() {
      const q = (body.querySelector('#khSearch').value || '').trim().toLowerCase();
      const loai = body.querySelector('#khLoai').value;
      const dmv = body.querySelector('#khDanhMuc').value;
      body.querySelectorAll('table tbody tr').forEach(tr => {
        if (tr.dataset.search === undefined && !tr.hasAttribute('data-loai')) return; // bỏ qua dòng "empty-hint"
        const ok = (!loai || tr.dataset.loai === loai) && (!dmv || tr.dataset.dm === dmv) && (!q || (tr.dataset.search || '').includes(q));
        tr.style.display = ok ? '' : 'none';
      });
    }
    ['#khSearch', '#khLoai', '#khDanhMuc'].forEach(sel => { const el = body.querySelector(sel); if (el) el.addEventListener(sel === '#khSearch' ? 'input' : 'change', applyKhFilter); });
  }

  // v5.40: "Tạo thẻ kho mới" đã gộp vào toolbar tab "Thẻ kho / Tồn kho" (renderItems) — bỏ tab tạo riêng.

  // Moi dong mau co anh rieng: hien thumbnail anh hien tai (neu co) + input chon anh moi.
  // data-existing-anh giu link anh cu de neu nguoi dung khong chon anh moi thi giu nguyen.
  // v5.0 (muc 4a): khi tao The kho loai "Nha san xuat", opts.colorOptions gioi han danh sach mau
  // duoc chon (chi con mau da chon o cong doan ra lenh san xuat) va opts.soCatReadonly + opts.soCat
  // dien san so luong so cat thuc te, khong cho sua tay.
  let cMauSeq = 0;   // v5.36: id duy nhất cho ô màu searchable ở từng dòng màu
  /* ===== v6.24.2: HIỂN THỊ & NHẬP THEO RI =====
     Kho LƯU theo Cái (bắt buộc, để bán lẻ được — xem v6.24.1), nhưng xưởng NGHĨ VÀ NHẬP THEO RI.
     2 hàm dưới đây là chỗ duy nhất quy đổi cho màn hình Thẻ kho:
       - `heSoRiHienTai` : hệ số quy đổi của mã hàng ĐANG mở form (đặt trước khi vẽ dòng màu).
       - `oNhapRi()`     : ô nhập [số Ri] + [cái lẻ] + ô ẩn giữ TỔNG SỐ CÁI (giá trị thật khi lưu).
       - `soTheoRi()`    : chuỗi hiển thị "23 Ri6 dư 2" từ một số CÁI. */
  let heSoRiHienTai = 1;
  /* v6.34: TÊN đơn vị của mã hàng ĐANG mở form — trước đây ô nhập ghi cứng "Ri"/"Cái" nên mã đã đổi
     ĐVT chính sang Cái/Bộ vẫn hiện nhãn cũ, người dùng không biết con số đang là đơn vị nào. */
  let dvChinhHienTai = 'Cái', dvQuyDoiHienTai = 'Ri';
  /* v6.38: người dùng CHỌN nhập theo đơn vị nào — 'chinh' (Cái/Bộ) hoặc 'quydoi' (Ri).
     Dù chọn gì, ô ẩn `.c-nhap` / `.c-socat` LUÔN giữ số theo ĐVT CHÍNH — đó mới là số ghi vào CSDL. */
  let cheDoNhap = 'chinh';
  /* Ô hiển thị của bảng Thẻ kho: SỐ CHÍNH là RI (đúng cách xưởng nghĩ), số Cái để nhỏ bên dưới.
     `n` là số theo ĐƠN VỊ CHÍNH của mã (Cái hoặc Ri) -> quy về Cái trước rồi mới chia ra Ri. */
  function oSoRi(n, r, damNhat) {
    const he = Number(r.LoaiRi) || 1;
    const laRi = donViChinhLaGop(r);   // v6.31
    const cai = laRi ? (Number(n) || 0) * he : (Number(n) || 0);
    // v6.27: đơn vị gốc có thể là Cái HOẶC Bộ — truyền nhãn thật xuống thay vì ghi cứng "Cái".
    const q = soTheoRi(cai, he, laRi ? 'Cái' : (r.DonViCoBan || 'Cái'));
    const mau = damNhat ? (cai <= 0 ? '#c0392b' : '#137333') : '';
    return `<b${mau ? ` style="color:${mau};"` : ''}>${q.chinh}</b>${q.phu ? `<div style="font-size:11px;color:#5f6368;">${q.phu}</div>` : ''}`;
  }
  function soTheoRi(soCai, heSo, nhanGoc) {
    const n = Number(soCai) || 0, he = Number(heSo) || 1;
    const nhan = nhanGoc || 'Cái';   // v6.27: đơn vị gốc (Cái / Bộ)
    if (he <= 1) return { chinh: fmtNumber(n), phu: '', cai: n };
    const ri = Math.trunc(n / he), du = n - ri * he;
    return { chinh: `${fmtNumber(ri)} Ri${he}${du ? ' dư ' + fmtNumber(du) : ''}`, phu: `${fmtNumber(n)} ${nhan}`, cai: n };
  }
  /* v6.34: MỖI Ô NHẬP CÓ 2 CÁCH GÕ, luôn đồng bộ với nhau — hết cảnh "không biết số này là ri hay cái":
        · ô trái  : theo ĐƠN VỊ TÍNH CHÍNH (đơn vị KHO THẬT SỰ LƯU — Cái / Bộ …)
        · ô phải  : theo ĐƠN VỊ QUY ĐỔI  ([số ri] + [lẻ]), chỉ hiện khi mã có tỷ lệ > 1
     Ô ẩn `.${cls}` giữ giá trị theo ĐVT CHÍNH — đó mới là con số ghi vào CSDL. */
  /* v6.38: MỘT ô nhập duy nhất, gõ theo ĐƠN VỊ ĐANG CHỌN ở đầu form (Cái/Bộ hoặc Ri).
     Ô ẩn `.${cls}` giữ số theo ĐVT CHÍNH — đó mới là số lưu xuống CSDL. */
  function oNhapRi(cls, nhan, giaTriCai, readonly, titleRO) {
    const he = Number(heSoRiHienTai) || 1;
    const chinh = Number(giaTriCai) || 0;
    const ro = readonly ? `readonly title="${titleRO}"` : '';
    const dvC = escapeHtml(dvChinhHienTai || 'Cái'), dvQ = escapeHtml(dvQuyDoiHienTai || 'Ri');
    if (he <= 1) {
      return `<label>${nhan} <span style="font-weight:400;color:#5f6368;">(${dvC})</span></label>
        <input class="${cls}" type="number" value="${chinh}" ${ro}>`;
    }
    const theoQuyDoi = cheDoNhap === 'quydoi';
    const hien = theoQuyDoi ? (chinh / he) : chinh;
    const nhanDV = theoQuyDoi ? dvQ + he : dvC;
    return `<label>${nhan} <span style="font-weight:400;color:#5f6368;">(${nhanDV})</span></label>
      <input class="${cls}-o" type="number" min="0" step="${theoQuyDoi ? 'any' : '1'}" value="${hien}" ${ro}>
      <div class="${cls}-tong" style="font-size:11px;color:#5f6368;">= ${fmtNumber(chinh)} ${dvC}</div>
      <input type="hidden" class="${cls}" value="${chinh}">`;
  }
  // Nối dây các ô Ri/lẻ -> tính tổng số Cái vào ô ẩn (ô ẩn mới là giá trị được lưu).
  /* Gõ ô hiển thị -> quy về ĐVT CHÍNH rồi ghi vào ô ẩn (số thật sự được lưu). */
  function wireNhapRi(root) {
    const he = Number(heSoRiHienTai) || 1;
    if (he <= 1) return;
    const dvC = dvChinhHienTai || 'Cái';
    const theoQuyDoi = cheDoNhap === 'quydoi';
    ['c-socat', 'c-nhap'].forEach(cls => {
      root.querySelectorAll('.' + cls + '-o').forEach(oHien => {
        const boc = oHien.closest('[data-onhap]') || oHien.parentElement;
        const oAn = boc.querySelector('.' + cls);
        const oTong = boc.querySelector('.' + cls + '-tong');
        if (!oAn) return;
        oHien.addEventListener('input', () => {
          const n = Math.round((Number(oHien.value) || 0) * (theoQuyDoi ? he : 1));
          oAn.value = n;
          if (oTong) oTong.textContent = `= ${fmtNumber(n)} ${dvC}`;
        });
      });
    });
  }

  function colorRowTemplate(c, opts) {
    opts = opts || {};
    const existingAnh = c && c.LinkAnh ? c.LinkAnh : '';
    const mauList = opts.colorOptions || dm.mauSac;
    const soCatVal = opts.soCat != null ? opts.soCat : (c ? c.SoCatCai : 0);
    // v5.4 (muc 1): "Nhap" cung dien san + khoa sua giong "So cat", khi tao moi tu don hang da co tien
    // do "Kho nhap" (xem opts.nhapReadonly/opts.nhap tu soNhapTheoMau) - yeu cau "Hiển thị số lượng sổ
    // cắt, số lượng nhập, không được sửa các trường này". Sua tay (+ Them mau / che do Sua) van binh thuong.
    const nhapVal = opts.nhap != null ? opts.nhap : (c ? c.NhapCai : 0);
    return `<div class="form-grid" style="grid-template-columns:1fr .8fr .8fr 1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;" data-crow data-existing-anh="${escapeHtml(existingAnh)}">
      <div>${(function () {
        // v5.36: chế độ THỦ CÔNG (danh sách màu đầy đủ) → ô màu tìm ký tự bất kỳ (searchable);
        // chế độ ràng buộc (Nhà SX, opts.colorOptions) → giữ <select> như cũ.
        if (opts.colorOptions) return `<label>Màu</label><select class="c-mau">${opt(mauList, 'MauSacID', 'TenMau', c ? c.MauSacID : '')}</select>`;
        // v5.46: Màu ĐÁNH TỰ DO hoặc chọn màu sẵn có (input + datalist). Lưu theo TÊN; backend tự tạo màu mới nếu chưa có.
        return `<label>Màu</label><input class="c-mau-free" list="dlMauSac" value="${c ? escapeHtml(c.TenMau || '') : ''}" placeholder="Gõ tên màu mới hoặc chọn màu có sẵn" autocomplete="off">`;
      })()}</div>
      ${/* v6.24.2: NHẬP THEO RI. Kho lưu theo Cái (để bán lẻ được), nhưng người dùng nghĩ và nhập theo
           RI — nên mỗi ô tách thành [số Ri] + [số cái lẻ], ô ẩn giữ TỔNG SỐ CÁI thật để lưu.
           Hệ số ≤ 1 (mã không có ri) thì vẫn 1 ô như cũ. */''}
      ${/* v6.34: bọc bằng div CÓ DẤU (data-onhap) — chỗ vẽ lại khi đổi tỷ lệ/đơn vị phải thay đúng khối
           này. Trước dùng closest('div') nên với markup mới sẽ trỏ nhầm vào ô flex bên trong. */''}
      <div data-onhap="c-socat">${oNhapRi('c-socat', 'Số cắt', soCatVal, opts.soCatReadonly, 'Lấy tự động từ công đoạn Cắt của đơn hàng, không sửa được ở đây')}</div>
      <div data-onhap="c-nhap">${oNhapRi('c-nhap', 'Nhập', nhapVal, opts.nhapReadonly, 'Lấy tự động từ công đoạn Kho nhập của đơn hàng, không sửa được ở đây')}</div>
      <div><label>Ảnh màu</label>
        <div style="display:flex;align-items:center;gap:6px;">
          ${existingAnh ? `<img class="thumb c-thumb" src="${existingAnh}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;">` : `<span class="c-thumb-placeholder" style="width:32px;height:32px;border:1px dashed #dcdfe3;border-radius:4px;display:inline-block;"></span>`}
          <input type="file" class="c-anhfile" accept="image/*" style="flex:1;max-width:140px;font-size:12px;">
        </div>
      </div>
      <div><label>Ghi chú</label><input class="c-ghichu" value="${c && c.GhiChu != null ? escapeHtml(c.GhiChu) : ''}" placeholder="Ghi chú màu..."></div>
      <div><button type="button" class="btn small danger c-remove">X</button></div>
    </div>`;
  }

  function wireColorThumbPreview(modal) {
    modal.querySelectorAll('.c-anhfile').forEach(input => {
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const row = input.closest('[data-crow]');
        const url = URL.createObjectURL(file);
        let img = row.querySelector('.c-thumb');
        if (!img) {
          img = document.createElement('img');
          img.className = 'thumb c-thumb';
          img.style.cssText = 'width:32px;height:32px;object-fit:cover;border-radius:4px;';
          const placeholder = row.querySelector('.c-thumb-placeholder');
          if (placeholder) placeholder.replaceWith(img); else row.querySelector('div > div').prepend(img);
        }
        img.src = url;
      };
    });
  }

  // Loai hang: NhaSanXuat (lien ket 1 don hang san xuat, goi y ma hang/ten hang/mau chinh) hoac
  // DatNgoai (khai bao tay don vi tinh). Moi lan mo form deu dung bien LOCAL (khong global) nen
  // khong bao gio sot du lieu/dong mau cua lan mo truoc - xem ghi chu o cho goi openItemForm().
  async function openItemForm(row, perm, colors, tuPhieuNhap) {
    /* v6.84: `tuPhieuNhap` = { PhieuNKID, SoPhieu, dong: [...] } — mở form TẠO MỚI với mã hàng lấy
       từ một phiếu nhập kho. Dùng cho nút "Tạo thẻ kho" ở tab Phiếu nhập kho và cho ô chọn phiếu
       nhập ngay trong form này. */
    await taiDonViTinh();   // v6.31: 2 ô đơn vị lấy từ Danh mục → Đơn vị tính
    const isEdit = !!row;
    const loaiHangInit = (isEdit && row.LoaiHang === 'NhaSanXuat') || (!isEdit && tuPhieuNhap)
      ? 'NhaSanXuat' : 'DatNgoai';
    // v6.24.2: hệ số quy đổi của CHÍNH mã đang mở -> các ô nhập theo Ri dùng chung hệ số này.
    heSoRiHienTai = isEdit ? (Number(row.LoaiRi) || 1) : 1;
    dvChinhHienTai = (isEdit && row.DonViCoBan) ? row.DonViCoBan : 'Cái';
    dvQuyDoiHienTai = (isEdit && row.DonViQuyDoi) ? row.DonViQuyDoi : 'Ri';
    cheDoNhap = 'chinh';   // v6.38: mở form luôn bắt đầu ở ĐVT chính (đơn vị kho lưu)
    const html = `
      <h3>${isEdit ? 'Sửa thẻ kho: ' + escapeHtml(row.MaHang) : 'Tạo thẻ kho mới'}</h3>
      <form id="iForm">
        <div class="form-grid">
          <div class="form-row"><label>Nguồn hàng</label>
            <select name="loaiHang" id="selLoaiHang">
              <option value="DatNgoai" ${loaiHangInit === 'DatNgoai' ? 'selected' : ''}>Hàng đặt ngoài</option>
              <option value="NhaSanXuat" ${loaiHangInit === 'NhaSanXuat' ? 'selected' : ''}>Hàng nhà sản xuất</option>
            </select>
          </div>
          ${/* v6.82: HÀNG NHÀ SẢN XUẤT KHÔNG CÒN GẮN LỆNH SX Ở ĐÂY NỮA.
               Trước đây chọn "Hàng nhà sản xuất" là bắt chọn một lệnh SX, rồi tự điền mã/tên/màu từ
               lệnh đó — tức thẻ kho phải sinh ra TỪ lệnh sản xuất. Nay hàng do xưởng làm ra vào kho
               bằng PHIẾU NHẬP KHO (tab Phiếu nhập kho), và mã hàng mới cũng tạo ngay trên phiếu đó.
               Ô chọn lệnh SX giữ lại nhưng ẨN HẲN, không gỡ khỏi HTML: dữ liệu cũ vẫn có DonHangID,
               gỡ ô đi thì lúc Sửa thẻ kho cũ sẽ gửi thiếu và xóa mất liên kết đã lưu. */''}
          ${/* v6.83: CHỌN "Hàng nhà sản xuất" -> hiện DANH SÁCH PHIẾU NHẬP KHO của mã hàng này, bấm
               sang xem được. CHỈ ĐỂ XEM, không điền ngược gì vào thẻ kho: phiếu nhập lưu xong LÀ ĐÃ
               CỘNG TỒN, điền thêm số lượng vào đây nữa là tồn bị đếm hai lần.
               Thực tế dùng: lập phiếu nhập kho trước (mã hàng sinh ra ở đó), vào thẻ kho sau chỉ để
               bổ sung giá bán / ảnh / danh mục. */''}
          <div class="form-row" id="blockPhieuNhap" style="${loaiHangInit === 'NhaSanXuat' ? '' : 'display:none;'}">
            <label>${isEdit ? 'Phiếu nhập kho của mã hàng này' : 'Tạo từ phiếu nhập kho'}</label>
            ${isEdit ? '' : `<select id="selPhieuNhap" style="margin-bottom:6px;"><option value="">-- Đang tải danh sách phiếu nhập... --</option></select>`}
            <div id="dsPhieuNhap" class="empty-hint">—</div>
          </div>
          <div class="form-row" id="blockNhaSanXuat" style="display:none;">
            <label>Đơn hàng sản xuất (không dùng nữa)</label>
            ${/* Ô ẩn PHẢI mang sẵn giá trị đang lưu và ĐANG ĐƯỢC CHỌN. Nếu chỉ để mỗi option rỗng thì
                 mở form Sửa một mã hàng cũ rồi bấm Lưu là DonHangID bị ghi đè thành rỗng — mất liên
                 kết lệnh SX của dữ liệu cũ mà không ai biết. */''}
            <select name="donHangId" id="selDonHang">
              <option value="">--</option>
              ${row && row.DonHangID ? `<option value="${row.DonHangID}" selected>${escapeHtml(row.MaDH || ('Đơn #' + row.DonHangID))}</option>` : ''}
            </select>
          </div>
          <div class="form-row" id="blockDonViCoBan">
            <label>Đơn vị tính chính</label>
            ${/* v6.31: lấy từ Danh mục → Đơn vị tính. optDonVi() LUÔN giữ giá trị đang lưu kể cả khi
                 nó không còn trong danh mục — nếu để mất, mở form sửa rồi bấm Lưu là đơn vị bị đổi
                 âm thầm, kéo theo tồn kho bị diễn giải lại sai gấp <tỷ lệ> lần. */''}
            <select name="donViCoBan">${optDonVi(dsDonViTinh, (row && row.DonViCoBan) || 'Cái')}</select>
          </div>
          <div class="form-row" id="blockDonViQuyDoi">
            <label>Đơn vị quy đổi</label>
            <select name="donViQuyDoi">${optDonVi(dsDonViTinh, (row && row.DonViQuyDoi) || 'Ri')}</select>
            <div class="empty-hint" style="margin-top:2px;">Đơn vị GỘP của mã hàng (1 &lt;ĐVT quy đổi&gt; = &lt;tỷ lệ&gt; &lt;ĐVT chính&gt;).
              Hệ thống nhân/chia tỷ lệ theo <b>chính ô này</b>, không theo tên "Ri" nữa.</div>
          </div>
          <div class="form-row"><label>Mã hàng *</label><input name="maHang" id="inpMaHang" value="${escapeHtml(row ? row.MaHang : '')}" required></div>
          <div class="form-row"><label>Tên hàng *</label><input name="tenHang" id="inpTenHang" value="${escapeHtml(row ? row.TenHang : '')}" required></div>
          <div class="form-row"><label>Giá bán</label><input name="giaBan" id="inpGiaBan" type="number" value="${row ? row.GiaBan : 0}">
            ${/* v6.21: KHÔNG nhập % ở đây nữa (tỷ lệ đánh chung ở đầu tab Thẻ kho) — chỉ hiện giá tính ra. */''}
            <div class="empty-hint" id="ttGiaCK" style="margin-top:2px;"></div>
          </div>
          <!-- v5.17 (muc 1.1): 2 truong moi phuc vu chuc nang "Báo giá Aloha" - xem migration_v517.sql -->
          ${/* v6.61: BỎ ô "Giá Aloha" — Báo giá Aloha nay lấy thẳng Giá bán ở trên. Hai ô giá song
               song luôn lệch nhau: sửa giá bán mà quên sửa giá Aloha là báo giá gửi khách sai giá.
               Cột GiaAloha trong CSDL vẫn giữ (dữ liệu cũ không mất), chỉ là không nhập nữa; backend
               đã bọc ISNULL nên không gửi lên là giữ nguyên giá trị cũ. */''}
          <div class="form-row"><label>Mã Barcode</label><input name="maBarcode" value="${escapeHtml(row && row.MaBarcode ? row.MaBarcode : '')}"></div>
          ${/* v6.71: CÔNG TẮC HIỆN MÃ NÀY TRÊN CATALOGUE CÔNG KHAI.
               Trước đây chỉ bật/tắt được theo CẢ DANH MỤC (TheKhoDanhMuc.CongKhai) — muốn giấu 1 mã
               (hàng mẫu, hàng để riêng cho một khách, hàng lỗi) thì không có cách nào.
               Mặc định TÍCH SẴN để giữ đúng thói quen cũ; muốn giấu thì bỏ tích. */''}
          <div class="form-row">
            <label style="display:flex;gap:6px;align-items:center;">
              <input type="checkbox" name="congKhai" id="tkCongKhai" ${!row || row.CongKhai === undefined || Number(row.CongKhai) ? 'checked' : ''}>
              Hiện mã này trên catalogue công khai
            </label>
            <div class="empty-hint" style="margin-top:2px;">Vẫn phải bật công khai cho cả danh mục (Danh mục → Thẻ kho) thì khách mới xem được.</div>
          </div>
          <div class="form-row"><label>Tỷ lệ quy đổi (VD: 5 Cái = 1 Ri)</label><input name="loaiRi" id="inpLoaiRi" type="number" value="${row ? row.LoaiRi : 1}">
            <div class="empty-hint" style="margin-top:2px;">Đổi hệ số xong, các ô Số cắt / Nhập bên dưới sẽ tính lại theo Ri mới.</div></div>
          <!-- v5.4 (muc 1): "Loai hang" MOI (nhom san pham, vd Quan be trai/gai) - KHAC voi "Nguon hang"
               o tren (NhaSanXuat/DatNgoai) - xem migration_v54.sql ve ly do dat ten cot noi bo khac nhau. -->
          <div class="form-row"><label>Loại hàng</label><select name="nhomSanPhamId"><option value="">--</option>${opt(dm.nhomSanPham, 'NhomSanPhamID', 'TenNhom', row ? row.NhomSanPhamID : '')}</select>
            ${!dm.nhomSanPham.length ? '<div class="empty-hint" style="margin-top:4px;">Chưa có danh mục "Loại hàng" nào — vào Danh mục → Loại hàng để thêm mới, rồi quay lại đây (tự tải lại, không cần F5).</div>' : ''}</div>
          <div class="form-row"><label>Danh mục thẻ kho</label><select name="theKhoDanhMucId"><option value="">--</option>${opt(dm.theKhoDanhMuc, 'TheKhoDanhMucID', 'TenTheKho', row ? row.TheKhoDanhMucID : '')}</select></div>
          <div class="form-row"><label>Ảnh đại diện chung</label>
            <div style="display:flex;align-items:center;gap:8px;">
              ${row && row.AnhDaiDien
                ? `<img id="anhDaiDienPreview" class="thumb" src="${escapeHtml(row.AnhDaiDien)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;">`
                : `<span id="anhDaiDienPreview" class="c-thumb-placeholder" style="width:48px;height:48px;border:1px dashed #dcdfe3;border-radius:4px;display:inline-block;"></span>`}
              <input type="file" name="anhFile" id="inpAnhFile" accept="image/*" style="flex:1;">
            </div>
            ${row && row.AnhDaiDien ? '<div class="empty-hint" style="margin-top:2px;">Đã có ảnh (xem trên) — để trống ô chọn file để giữ nguyên, chỉ chọn ảnh mới nếu muốn thay.</div>' : ''}
          </div>
        </div>
        <div class="form-row">
          <label>Chi tiết theo màu (mỗi màu có thể có ảnh riêng)</label>
          ${/* v6.38: CHỌN gõ Số cắt/Nhập theo đơn vị nào. Đổi ô này chỉ đổi CÁCH GÕ và cách hiển thị —
               con số lưu xuống luôn theo ĐVT chính, nên chọn nhầm không làm sai tồn kho. */''}
          <div id="cDonViNhap" style="margin:2px 0 8px;font-size:13px;${(Number(row && row.LoaiRi) || 1) > 1 ? '' : 'display:none;'}">
            Nhập Số cắt / Nhập theo:
            <select id="selDonViNhap" style="width:auto;padding:4px 8px;">
              <option value="chinh">${escapeHtml((row && row.DonViCoBan) || 'Cái')}</option>
              <option value="quydoi">${escapeHtml((row && row.DonViQuyDoi) || 'Ri')}</option>
            </select>
            <span class="empty-hint" style="padding:0;margin-left:6px;">Kho luôn lưu theo <b>${escapeHtml((row && row.DonViCoBan) || 'Cái')}</b> — dòng dưới mỗi ô hiện số đã quy đổi.</span>
          </div>
          ${/* v6.89: mở từ phiếu nhập kho -> nhắc ĐỪNG gõ số lượng vào ô Nhập. Số của phiếu đã nằm
               trong tồn kho qua nguồn chứng từ (vw_TonTheoMau); gõ lại đây là tồn ĐẾM HAI LẦN. */''}
          ${!isEdit && tuPhieuNhap ? `<div class="empty-hint" style="margin:2px 0 8px;border-left:3px solid #f0ad4e;padding-left:8px;">
            Mã này vào kho bằng <b>phiếu nhập kho</b> — số lượng đã tính vào tồn.
            Để ô <b>Nhập</b> = 0, chỉ khai <b>màu / ảnh / giá bán</b>. Gõ số lượng vào đây là tồn bị đếm hai lần.
          </div>` : ''}
          <div id="cRows">${(colors && colors.length ? colors.map(colorRowTemplate) : [colorRowTemplate(null)]).join('')}</div>
          <button type="button" class="btn small secondary" id="btnAddColor">+ Thêm màu</button>
          <datalist id="dlMauSac">${dm.mauSac.map(m => `<option value="${escapeHtml(m.TenMau)}"></option>`).join('')}</datalist>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    // v6.21: xem trước 2 giá sau CK ngay khi gõ Giá bán — dùng CHÍNH 2 hàm của danh sách nên không lệch.
    function veGiaSauCK() {
      const gb = modal.querySelector('#inpGiaBan'), out = modal.querySelector('#ttGiaCK');
      if (!gb || !out) return;
      out.innerHTML = `Giá shop (CK ${fmtNumber(tyLeCK.shop)}%): <b>${fmtNumber(giaShopSauCK(gb.value))}</b>
        &nbsp;·&nbsp; Giá NPP (CK ${fmtNumber(tyLeCK.npp)}% trên giá shop): <b>${fmtNumber(giaNPPSauCK(gb.value))}</b>`;
    }
    const inpGiaBan = modal.querySelector('#inpGiaBan');
    if (inpGiaBan) inpGiaBan.addEventListener('input', veGiaSauCK);
    veGiaSauCK();
    function wireRemove() {
      modal.querySelectorAll('.c-remove').forEach(btn => btn.onclick = () => {
        if (modal.querySelectorAll('#cRows > div').length > 1) btn.closest('[data-crow]').remove();
      });
    }
    wireRemove();
    wireColorThumbPreview(modal);
    wireNhapRi(modal);   // v6.24.2
    /* Đổi "Tỷ lệ quy đổi" -> vẽ lại các ô Số cắt/Nhập theo hệ số mới (giữ nguyên TỔNG SỐ CÁI đang có). */
    /* Vẽ lại 2 ô Số cắt/Nhập của MỌI dòng màu — giữ nguyên con số theo ĐVT chính đang có,
       chỉ đổi cách chia ri/lẻ và nhãn đơn vị. Dùng cho cả đổi TỶ LỆ lẫn đổi ĐƠN VỊ. */
    /* Cập nhật 2 lựa chọn trong ô "Nhập theo" cho khớp ĐVT hiện tại của form, và ẩn đi khi tỷ lệ ≤ 1
       (mã không có quy đổi thì chỉ có 1 đơn vị, hiện ô chọn chỉ tổ rối). */
    function capNhatOChonDonVi() {
      const box = modal.querySelector('#cDonViNhap');
      const sel = modal.querySelector('#selDonViNhap');
      if (!box || !sel) return;
      const he = Number(heSoRiHienTai) || 1;
      box.style.display = he > 1 ? '' : 'none';
      sel.options[0].textContent = dvChinhHienTai || 'Cái';
      sel.options[1].textContent = dvQuyDoiHienTai || 'Ri';
      if (he <= 1) { cheDoNhap = 'chinh'; sel.value = 'chinh'; }
      const ghi = box.querySelector('b');
      if (ghi) ghi.textContent = dvChinhHienTai || 'Cái';
    }

    function veLaiONhap() {
      modal.querySelectorAll('[data-crow]').forEach(row => {
        ['c-socat', 'c-nhap'].forEach(cls => {
          const oChinh = row.querySelector('.' + cls);
          const boc = row.querySelector(`[data-onhap="${cls}"]`);
          if (!oChinh || !boc) return;
          const giaTri = Number(oChinh.value) || 0;
          const ro = oChinh.hasAttribute('readonly');
          boc.innerHTML = oNhapRi(cls, cls === 'c-socat' ? 'Số cắt' : 'Nhập', giaTri, ro, '');
        });
      });
      wireNhapRi(modal);
    }
    const inpLoaiRi = modal.querySelector('#inpLoaiRi');
    if (inpLoaiRi) inpLoaiRi.addEventListener('change', () => {
      const heMoi = Number(inpLoaiRi.value) || 1;
      heSoRiHienTai = heMoi;
      capNhatOChonDonVi();
      veLaiONhap();
    });
    /* v6.38: đổi ô "Nhập theo" -> vẽ lại các ô Số cắt/Nhập theo đơn vị vừa chọn (số lưu KHÔNG đổi). */
    const selDVN = modal.querySelector('#selDonViNhap');
    if (selDVN) selDVN.addEventListener('change', () => { cheDoNhap = selDVN.value || 'chinh'; veLaiONhap(); });

    /* v6.34: đổi ĐVT chính / ĐVT quy đổi trên form -> nhãn ô nhập đổi theo ngay, khỏi phải lưu rồi mở lại.
       v6.36: ĐỔI ĐVT CHÍNH GIỮA "đơn vị GỘP" ↔ "đơn vị GỐC" thì PHẢI HỎI có quy đổi số liệu không.
       Trước đây đổi ô này chỉ đổi CÁI NHÃN, số trong kho giữ nguyên — mã tỷ lệ 6 nhập 45 ri vẫn lưu 45
       nhưng nhãn thành "Bộ" nên đọc ra 45 bộ, xuất/tồn sai theo (ca BD26C042). */
    ['donViCoBan', 'donViQuyDoi'].forEach(ten => {
      const o = modal.querySelector(`[name="${ten}"]`);
      if (!o) return;
      let cu = o.value;
      o.addEventListener('change', () => {
        if (ten === 'donViQuyDoi') { dvQuyDoiHienTai = o.value || 'Ri'; cu = o.value; capNhatOChonDonVi(); veLaiONhap(); return; }

        const moi = o.value || 'Cái';
        const he = Number(heSoRiHienTai) || 1;
        const qd = String(dvQuyDoiHienTai || 'Ri').trim().toLowerCase();
        const cuGop = String(cu || '').trim().toLowerCase() === qd;    // đang quản theo đơn vị GỘP
        const moiGop = String(moi).trim().toLowerCase() === qd;
        const coSo = [...modal.querySelectorAll('.c-nhap, .c-socat')].some(x => Number(x.value) > 0);

        if (he > 1 && coSo && cuGop !== moiGop) {
          const huong = cuGop ? `NHÂN ${he}` : `CHIA ${he}`;
          const hoi = `Mã này đang có số liệu và bạn vừa đổi đơn vị tính chính từ "${cu}" sang "${moi}".\n\n`
            + `• BẤM OK  → quy đổi luôn số liệu (${huong}). Ví dụ 45 ${cu} thành ${cuGop ? 45 * he : 45 / he} ${moi}.\n`
            + `• BẤM CANCEL → chỉ đổi nhãn, GIỮ NGUYÊN con số.\n\n`
            + `Chọn sai là tồn kho lệch đúng ${he} lần. Nếu trước giờ nhập theo "${cu}" thì chọn OK.`;
          if (confirm(hoi)) {
            let loiChia = false;
            modal.querySelectorAll('[data-crow]').forEach(row => {
              ['c-socat', 'c-nhap'].forEach(cls => {
                const oS = row.querySelector('.' + cls);
                if (!oS) return;
                const n = Number(oS.value) || 0;
                if (cuGop) oS.value = n * he;
                else { if (n % he !== 0) loiChia = true; oS.value = Math.round(n / he); }
              });
            });
            if (loiChia) toast(`Có dòng không chia hết cho ${he} nên đã làm tròn — kiểm lại số trước khi lưu.`, 'error');
          }
        }
        cu = moi;
        dvChinhHienTai = moi;
        capNhatOChonDonVi();
        veLaiONhap();
      });
    });
    // v5.36: ô màu searchable (gõ ký tự bất kỳ) cho các dòng màu chế độ thủ công.
    function wireColorMau() {
      document.querySelectorAll('#cRows [data-ssid]').forEach(el => {
        if (el.dataset.wired) return; el.dataset.wired = '1';
        wireSearchableSelect(el.dataset.ssid, dm.mauSac, 'MauSacID', x => x.TenMau, () => {});
      });
    }
    wireColorMau();
    // v5.11 (phản hồi trực tiếp "sửa thẻ kho phần ảnh Ảnh đại diện chung vẫn bị mất mặc dù không sửa"):
    // đã rà soát kỹ toàn bộ luồng lưu (PUT /khohang/items/:id dùng AnhDaiDien=ISNULL(@AnhDaiDien,
    // AnhDaiDien) - CHỈ ghi đè khi thực sự chọn file mới, giữ nguyên nếu không chọn gì - logic lưu đã
    // đúng). Vấn đề thực sự nằm ở CHỖ NÀY: trước đây ô "Ảnh đại diện chung" khi Sửa KHÔNG hiện ảnh đang
    // lưu (khác hẳn "Ảnh màu" từng dòng, vốn đã hiện thumbnail cũ) - người dùng mở Sửa thấy ô chọn file
    // trống trơn, tưởng nhầm là ảnh đã mất dù dữ liệu vẫn còn nguyên trong CSDL. Nay thêm thumbnail hiện
    // đúng ảnh đang lưu (nếu có) + dòng chú thích, và cập nhật xem trước ngay khi chọn ảnh mới - để việc
    // giữ nguyên/thay ảnh nhìn thấy rõ ràng thay vì phải tin suông vào logic phía sau.
    const inpAnhFile = modal.querySelector('#inpAnhFile');
    if (inpAnhFile) {
      inpAnhFile.addEventListener('change', () => {
        const file = inpAnhFile.files && inpAnhFile.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const cur = modal.querySelector('#anhDaiDienPreview');
        if (cur && cur.tagName === 'IMG') {
          cur.src = url;
        } else if (cur) {
          const img = document.createElement('img');
          img.id = 'anhDaiDienPreview'; img.className = 'thumb';
          img.style.cssText = 'width:48px;height:48px;object-fit:cover;border-radius:4px;';
          img.src = url;
          cur.replaceWith(img);
        }
      });
    }
    modal.querySelector('#btnAddColor').addEventListener('click', () => {
      document.getElementById('cRows').insertAdjacentHTML('beforeend', colorRowTemplate(null)); wireRemove(); wireColorThumbPreview(modal); wireColorMau(); wireNhapRi(modal);
    });

    // Danh sach don hang san xuat - bien LOCAL cua lan mo form nay, nap 1 lan khi can (khong global).
    let donHangList = null;
    async function ensureDonHangList() {
      if (donHangList) return donHangList;
      const r = await apiGet('/api/khohang/donhang');
      donHangList = r.data;
      const mapped = donHangList.map(d => ({ DonHangID: d.DonHangID, Label: d.MaDH + ' - ' + d.TenSanPham }));
      const sel = modal.querySelector('#selDonHang');
      sel.innerHTML = '<option value="">-- Chọn đơn hàng --</option>' + opt(mapped, 'DonHangID', 'Label', isEdit ? row.DonHangID : '');
      return donHangList;
    }

    // v5.0 (muc 4a): hang "Nha san xuat" - CHI luc TAO MOI (isEdit=false) - khong cho bam "+ Them mau"
    // (mau bi khoa theo mau chinh cua don hang ra lenh san xuat, xem selDonHang change ben duoi).
    /* v6.82: nút "+ Thêm màu" LUÔN dùng được.
       Trước đây tạo mới mà chọn "Hàng nhà sản xuất" thì khóa nút này, vì màu được chép tự động từ
       lệnh SX. Nay không còn gắn lệnh SX nên khóa lại là bít đường khai màu. */
    function toggleAddColorBtn() {
      modal.querySelector('#btnAddColor').style.display = '';
    }

    /* Nguồn hàng giờ CHỈ còn là nhãn phân loại (Nhà SX / Đặt ngoài) — không đổi bố cục form nữa.
       Đơn vị tính phải khai cho CẢ HAI loại: trước đây hàng nhà SX bị ẩn 2 ô ĐVT vì lấy theo lệnh SX,
       nay không có lệnh SX thì không ẩn được, ẩn là lưu ra mã hàng không có đơn vị. */
    /* Nạp danh sách phiếu nhập kho của mã hàng đang sửa. Tạo mới thì chưa có mã hàng nên chưa có gì
       để tra — hiện dòng nhắc thay vì để trống khó hiểu. */
    let daNapPhieuNhap = false;

    /* Điền các ô của form theo MỘT DÒNG hàng của phiếu nhập. CHỈ điền mã/tên/ĐVT — KHÔNG điền số
       lượng: phiếu nhập lưu xong là đã cộng tồn, điền vào đây nữa là tồn đếm hai lần. */
    async function dienTheoDongPhieu(d2, soPhieu) {
      /* v6.89: điền mã/tên/ĐVT từ dòng phiếu vào form TẠO MỚI. Mã đã có trong danh mục là bình thường
         (phiếu nhập sinh ra), backend nhận cờ tuPhieuNKID nên lưu được — không còn tự nhảy sang form
         Sửa như v6.86-v6.88.
         KHÔNG điền số lượng: tồn của dòng phiếu này đã nằm trong tồn kho qua nguồn phiếu
         (vw_TonTheoMau, migration_v682). Điền vào ô "Nhập" nữa là ĐẾM HAI LẦN. */
      const dat = (sel, v) => { const el = modal.querySelector(sel); if (el && v != null && v !== '') el.value = v; };
      dat('#inpMaHang', d2.MaHang);
      dat('#inpTenHang', d2.TenHang);
      const oDvcb = modal.querySelector('[name="donViCoBan"]');
      if (oDvcb && d2.DonViCoBan) oDvcb.value = d2.DonViCoBan;
      const oDvqd = modal.querySelector('[name="donViQuyDoi"]');
      if (oDvqd && d2.DonViQuyDoi) oDvqd.value = d2.DonViQuyDoi;
      dat('#inpLoaiRi', d2.LoaiRi);
      toast(`Đã điền mã ${d2.MaHang} từ phiếu ${soPhieu}. Khai màu / ảnh / giá bán rồi bấm Lưu. Ô "Nhập" để 0 — số lượng của phiếu đã nằm trong tồn kho.`, 'success');
    }

    /* TẠO MỚI: nạp danh sách phiếu nhập loại SẢN XUẤT, chọn phiếu -> hiện các mã hàng trong phiếu
       để bấm "Dùng mã này". */
    async function napChonPhieuNhap() {
      const sel = modal.querySelector('#selPhieuNhap');
      const o = modal.querySelector('#dsPhieuNhap');
      if (!sel || !o) return;
      try {
        /* v6.88: KHÔNG lọc theo loại nhập nữa. Mã hàng mới có thể đến từ nhà cung cấp chứ không riêng
           gì hàng xưởng làm ra; lọc loaiNhap=SanXuat như bản trước là bỏ sót hẳn nhóm hàng mua ngoài. */
        const ds = (await apiGet('/api/nhapkho/phieu')).data || [];
        const con = ds.filter(p => p.TrangThai !== 'Đã hủy');
        if (!con.length) {
          sel.innerHTML = '<option value="">-- Chưa có phiếu nhập kho nào --</option>';
          o.innerHTML = 'Chưa có phiếu nhập kho nào. Lập ở <b>tab Phiếu nhập kho</b> trước — mã hàng mới sinh ra ở đó rồi quay lại đây bổ sung ảnh / giá bán / màu.';
          return;
        }
        sel.innerHTML = '<option value="">-- Chọn phiếu nhập kho --</option>'
          + con.map(p => `<option value="${p.PhieuNKID}">${escapeHtml(p.SoPhieu)} — ${fmtDate(p.NgayNhap)}${p.MaDH ? ' — ' + escapeHtml(p.MaDH) : ''} (${p.SoDong} dòng)</option>`).join('');
        o.innerHTML = 'Chọn một phiếu nhập ở trên để lấy mã hàng.';
        sel.onchange = async () => {
          if (!sel.value) { o.innerHTML = 'Chọn một phiếu nhập ở trên để lấy mã hàng.'; return; }
          o.textContent = 'Đang tải...';
          try {
            const kq = await apiGet('/api/nhapkho/phieu/' + sel.value);
            const dong = (kq.data && kq.data.chiTiet) || [];
            const sp = (kq.data && kq.data.header && kq.data.header.SoPhieu) || '';
            if (!dong.length) { o.innerHTML = 'Phiếu này không có dòng hàng nào.'; return; }
            o.classList.remove('empty-hint');
            o.innerHTML = `<div class="table-wrap" style="max-height:180px;overflow:auto;">
              <table class="data-table phieu-ke"><thead><tr>
                <th>Mã hàng</th><th>Tên hàng</th><th class="num">SL</th><th>ĐVT</th><th style="width:120px;"></th>
              </tr></thead><tbody>
                ${dong.map((d2, i) => `<tr>
                  <td><b>${escapeHtml(d2.MaHang || '')}</b></td>
                  <td>${escapeHtml(d2.TenHang || '')}</td>
                  <td class="num">${fmtNumber(d2.SoLuong)}</td>
                  <td>${escapeHtml(d2.DonVi || '')}</td>
                  <td><button type="button" class="btn small pn-dung" data-i="${i}">Mở thẻ kho</button></td>
                </tr>`).join('')}
              </tbody></table></div>`;
            o.querySelectorAll('.pn-dung').forEach(b2 => b2.onclick = () =>
              dienTheoDongPhieu(dong[Number(b2.dataset.i)], sp).catch(err => toast(err.message, 'error')));
            // Chỉ 1 dòng thì điền luôn, khỏi bắt bấm thêm một nút vô nghĩa.
            if (dong.length === 1) await dienTheoDongPhieu(dong[0], sp);
          } catch (err) { o.innerHTML = 'Không tải được phiếu: ' + escapeHtml(err.message); }
        };
        // Mở form từ nút "Tạo thẻ kho" ở tab Phiếu nhập kho -> chọn sẵn đúng phiếu đó.
        if (tuPhieuNhap && tuPhieuNhap.PhieuNKID) {
          sel.value = String(tuPhieuNhap.PhieuNKID);
          await sel.onchange();
          /* Phiếu nhiều mã mà bên gọi đã chỉ rõ mã nào thì điền đúng mã đó, khỏi bắt bấm lại. */
          if (tuPhieuNhap.maHang) {
            const nut = [...o.querySelectorAll('.pn-dung')].find((b2, i2) => {
              const tr = b2.closest('tr');
              return tr && tr.querySelector('b') && tr.querySelector('b').textContent.trim() === String(tuPhieuNhap.maHang).trim();
            });
            if (nut) nut.click();
          }
        }
      } catch (err) {
        o.innerHTML = 'Không tải được danh sách phiếu nhập: ' + escapeHtml(err.message);
      }
    }

    async function napPhieuNhap() {
      const o = modal.querySelector('#dsPhieuNhap');
      if (!o || daNapPhieuNhap) return;
      if (!isEdit) { daNapPhieuNhap = true; await napChonPhieuNhap(); return; }
      if (!row || !row.MaHangID) {
        o.innerHTML = 'Mã hàng mới chưa có phiếu nhập nào.';
        daNapPhieuNhap = true;
        return;
      }
      o.textContent = 'Đang tải...';
      try {
        const ds = (await apiGet('/api/nhapkho/theo-mahang/' + row.MaHangID)).data || [];
        daNapPhieuNhap = true;
        if (!ds.length) { o.innerHTML = 'Chưa có phiếu nhập kho nào cho mã hàng này.'; return; }
        o.classList.remove('empty-hint');
        o.innerHTML = `<div class="table-wrap" style="max-height:180px;overflow:auto;">
          <table class="data-table phieu-ke"><thead><tr>
            <th>Số phiếu</th><th>Ngày</th><th>Nguồn</th><th class="num">SL</th><th>ĐVT</th><th>Trạng thái</th>
          </tr></thead><tbody>
            ${ds.map(p => `<tr>
              <td><a href="#" class="pn-xem" data-id="${p.PhieuNKID}"><b>${escapeHtml(p.SoPhieu)}</b></a></td>
              <td>${fmtDate(p.NgayNhap)}</td>
              <td>${escapeHtml(p.LoaiNhap === 'SanXuat' ? ('SX' + (p.MaDH ? ' · ' + p.MaDH : '')) : (p.TenNCC || 'NCC'))}</td>
              <td class="num">${fmtNumber(p.SoLuong)}</td>
              <td>${escapeHtml(p.DonVi || '')}</td>
              <td>${p.TrangThai === 'Đã hủy' ? '<span class="badge red">Đã hủy</span>' : '<span class="badge green">Hoàn thành</span>'}</td>
            </tr>`).join('')}
          </tbody></table></div>`;
        o.querySelectorAll('.pn-xem').forEach(a2 => a2.onclick = (e) => {
          e.preventDefault();
          /* Mở ĐÈ LÊN form thẻ kho (ngăn xếp modal v5.97) — đóng phiếu là quay lại đúng form đang
             nhập dở, không mất dữ liệu người dùng đã gõ. */
          if (window.ModuleNhapKho) window.ModuleNhapKho.xemPhieu(a2.dataset.id);
          else toast('Chưa nạp module.nhapkho.js — copy file này rồi Ctrl+F5.', 'error');
        });
      } catch (err) {
        o.innerHTML = 'Không tải được danh sách phiếu nhập: ' + escapeHtml(err.message);
      }
    }

    function toggleLoaiHangBlocks() {
      const laNhaSanXuat = modal.querySelector('#selLoaiHang').value === 'NhaSanXuat';
      modal.querySelector('#blockPhieuNhap').style.display = laNhaSanXuat ? '' : 'none';
      if (laNhaSanXuat) napPhieuNhap();
      toggleAddColorBtn();
    }
    modal.querySelector('#selLoaiHang').addEventListener('change', toggleLoaiHangBlocks);
    if (loaiHangInit === 'NhaSanXuat') napPhieuNhap();
    toggleAddColorBtn();

    // Goi y tu dong dien ten hang/ma hang/mau chinh khi chon 1 don hang san xuat - CHI ap dung luc
    // TAO MOI (isEdit=false) de tranh xoa mat mau/anh nguoi dung da nhap san khi Sua.
    // v5.0 (muc 4a): danh sach mau GIOI HAN dung mau chinh cua don hang (khong con hien tat ca mau
    // trong danh muc), va "So cat" dien tu dong tu SL luy ke cong doan Cat, KHONG cho sua tay.
    modal.querySelector('#selDonHang').addEventListener('change', async (e) => {
      const donHangId = e.target.value;
      if (!donHangId || isEdit) return;
      try {
        const r = await apiGet(`/api/khohang/donhang/${donHangId}/goiy`);
        const { tenHangGoiY, maHangGoiY, mauChinh, soCatTheoMau, soNhapTheoMau } = r.data;
        modal.querySelector('#inpTenHang').value = tenHangGoiY || '';
        modal.querySelector('#inpMaHang').value = maHangGoiY || '';
        if (Array.isArray(mauChinh) && mauChinh.length) {
          modal.querySelector('#cRows').innerHTML = mauChinh
            .map(m => colorRowTemplate({ MauSacID: m.MauSacID, SoCatCai: 0, NhapCai: 0, LinkAnh: '' }, {
              colorOptions: mauChinh, soCatReadonly: true, soCat: (soCatTheoMau && soCatTheoMau[m.MauSacID]) || 0,
              nhapReadonly: true, nhap: (soNhapTheoMau && soNhapTheoMau[m.MauSacID]) || 0
            })).join('');
          wireRemove(); wireColorThumbPreview(modal); wireNhapRi(modal);
        }
        toggleAddColorBtn();
        toast('Đã tự động điền theo đơn hàng sản xuất, kiểm tra lại trước khi lưu.', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });

    modal.querySelector('#iForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const submitBtn = modal.querySelector('button[type="submit"]');
      submitBtn.disabled = true; submitBtn.textContent = 'Đang lưu...';
      try {
        // v5.41.2: khi SỬA mà KHÔNG chọn ảnh mới -> gửi thẳng ảnh cũ (row.AnhDaiDien) thay vì null,
        // giống cách ảnh màu dùng data-existing-anh. Không phụ thuộc ISNULL phía backend nên ảnh đại
        // diện chung KHÔNG bị mất dù không đụng vào (đây là nguyên nhân ảnh vẫn mất ở các bản trước).
        let anhDaiDien = isEdit ? (row.AnhDaiDien || null) : null;
        const file = fd.get('anhFile');
        if (file && file.size) anhDaiDien = await uploadFile(file, fd.get('maHang'));

        const colorRows = Array.from(modal.querySelectorAll('#cRows > div'));
        const colorsPayload = [];
        for (const r of colorRows) {
          const mauSelEl = r.querySelector('.c-mau');           // dropdown ràng buộc (Nhà SX)
          const freeEl = r.querySelector('.c-mau-free');        // v5.46: ô màu tự do/chọn sẵn
          const mauSacId = mauSelEl ? mauSelEl.value : '';
          const tenMau = freeEl ? freeEl.value.trim() : '';
          if (!mauSacId && !tenMau) continue;                   // bỏ dòng chưa chọn/nhập màu
          const colorFile = r.querySelector('.c-anhfile').files[0];
          let linkAnh = r.dataset.existingAnh || null;
          if (colorFile && colorFile.size) {
            linkAnh = await uploadFile(colorFile, fd.get('maHang') + '_mau' + (mauSacId || tenMau));
          }
          colorsPayload.push({
            mauSacId, tenMau, soCat: r.querySelector('.c-socat').value, nhap: r.querySelector('.c-nhap').value, linkAnh,
            ghiChu: r.querySelector('.c-ghichu') ? r.querySelector('.c-ghichu').value : null   // v5.52
          });
        }
        const loaiHangVal = fd.get('loaiHang');
        const body = {
          maHang: fd.get('maHang'), tenHang: fd.get('tenHang'), giaBan: fd.get('giaBan'),
          loaiRi: fd.get('loaiRi'), theKhoDanhMucId: fd.get('theKhoDanhMucId') || null,
          anhDaiDien, colors: colorsPayload,
          loaiHang: loaiHangVal,
          donHangId: loaiHangVal === 'NhaSanXuat' ? (fd.get('donHangId') || null) : null,
          donViCoBan: fd.get('donViCoBan') || 'Cái',
          donViQuyDoi: fd.get('donViQuyDoi') || 'Ri',
          nhomSanPhamId: fd.get('nhomSanPhamId') || null,
          // v6.61: không gửi giaAloha nữa — backend ISNULL nên giá trị cũ trong CSDL giữ nguyên.
          maBarcode: fd.get('maBarcode') || null,
          congKhai: !!modal.querySelector('#tkCongKhai').checked,  // v6.71
          /* v6.89: nói rõ form này mở từ một PHIẾU NHẬP KHO. Mã hàng đã được phiếu sinh ra trước đó,
             không có cờ này thì backend chặn "Mã hàng đã tồn tại, dùng chức năng Sửa". */
          tuPhieuNKID: (!isEdit && tuPhieuNhap && tuPhieuNhap.PhieuNKID) ? tuPhieuNhap.PhieuNKID : null
        };
        let kq = null;
        if (isEdit) await apiPut('/api/khohang/items/' + row.MaHangID, body);
        else kq = await apiPost('/api/khohang/items', body);

        closeModal();
        toast((kq && kq.message) ? kq.message : 'Đã lưu thẻ kho.', 'success');
        // Tao moi tu tab "Tao the kho moi" (v5.3) -> chuyen sang tab danh sach de thay ngay ket qua.
        if (!isEdit) activeTab = 'items';
        render(container, currentUser);
      } catch (err) {
        toast(err.message, 'error');
        submitBtn.disabled = false; submitBtn.textContent = 'Lưu';
      }
    });
  }

  // v5.19: fmtDualUnit(cai, loaiRi, donViCoBan, donViQuyDoi) chuyen sang common.js (dung CHUNG voi
  // module.qlsx.js cho Cau truc vai/In lenh san xuat - xem ghi chu tai common.js) - giu nguyen cach
  // goi/hanh vi, chi khong con dinh nghia rieng o day.

  // Xem anh phong to - dung chung cho anh dai dien va anh tung mau (muc 4b, mo rong muc 1 v5.4).
  // v5.4: them tham so onCloseCb TUY CHON - khi zoom duoc mo TU BEN TRONG 1 modal khac (vd "chi tiet
  // ma hang" openHistory), modal do se bi THAY THE (openModal khong stack), nen phai truyen callback
  // de dong lightbox quay lai dung modal cu thay vi mat het (giong pattern onClose cua openQuickOrderModal).
  function openImageLightbox(src, title, onCloseCb) {
    const modal = openModal(`
      <h3>${escapeHtml(title || 'Ảnh')}</h3>
      <img src="${src}" style="max-width:100%;max-height:70vh;display:block;margin:0 auto;">
      <div class="modal-actions"><button class="btn secondary" id="btnCloseImg">Đóng</button></div>`,
      onCloseCb ? { onClose: onCloseCb } : undefined);
    modal.querySelector('#btnCloseImg').addEventListener('click', onCloseCb || closeModal);
  }

  // Dat hang nhanh tu man hinh chi tiet mau (muc 4b): co dinh 1 ma hang + 1 mau, cho phep them NHIEU
  // khach cung luc - moi khach 1 dong, gui tuan tu tung don POST /orders (khong gop chung) de doi
  // chieu ton kho chinh xac giua cac khach (khach sau se thay ton da tru cho khach truoc do).
  /* v6.44: chuyển RA NGOÀI openOrderForm để "Đặt hàng nhanh" dùng CHUNG — trước đây chỉ form "Lên đơn
     đặt hàng" có, còn Đặt hàng nhanh gõ cứng Cái/Ri nên hai form ra kết quả khác nhau.

     Đơn vị GỐC của 1 mã hàng: mã quản theo đơn vị GỘP (ĐVT chính trùng ĐVT quy đổi) thì đơn vị gốc
     không được lưu ở đâu cả -> lùi về 'Cái'. Mã bình thường thì ĐVT chính CHÍNH LÀ đơn vị gốc.
     2 lựa chọn = ĐVT gốc + ĐVT quy đổi; mặc định chọn ĐVT quy đổi khi tỷ lệ > 1 vì xưởng đặt theo
     đơn vị gộp (v6.24.4). */
  function dvGocCua(item) {
    const dv = String((item && item.DonViCoBan) || 'Cái').trim();
    return donViChinhLaGop(item) ? 'Cái' : dv;
  }
  function dsDonViCua(item) {
    const he = Number(item && item.LoaiRi) || 1;
    const goc = dvGocCua(item);
    const gop = String((item && item.DonViQuyDoi) || '').trim();
    const ds = [{ giaTri: goc, nhan: goc, macDinh: !(gop && he > 1) }];
    if (gop && gop !== goc) ds.push({ giaTri: gop, nhan: gop + (he > 1 ? he : ''), macDinh: he > 1 });
    return ds;
  }
  function optDonViCua(item) {
    return dsDonViCua(item).map(dv =>
      `<option value="${escapeHtml(dv.giaTri)}" ${dv.macDinh ? 'selected' : ''}>${escapeHtml(dv.nhan)}</option>`).join('');
  }

  /* v6.44: ĐỒNG BỘ với form "Lên đơn đặt hàng". Hai chỗ trước đây lệch nhau, đều sai âm thầm:
       1) Ô Đơn vị gõ cứng "Cái"/"Ri". Mã hàng khai ĐVT quy đổi là "Bộ"/"Tá"/... thì chọn "Ri" xong
          backend KHÔNG nhân hệ số -> giữ hàng thiếu đúng <tỷ lệ> lần, không báo lỗi gì.
          Nay lấy đúng ĐVT chính + ĐVT quy đổi CỦA CHÍNH mã hàng đó (v6.31), kèm dòng quy đổi.
       2) Ô Khách gõ tự do. Tên khách là KHÓA GOM CÔNG NỢ — gõ lệch một dấu là tách thành khách khác.
          Form đầy đủ đã bỏ gõ tự do từ v6.23.2, chỗ này còn sót. Nay cũng chọn từ danh mục. */
  async function openQuickOrderModal(hangInfo, mauSacId, tenMau, perm) {
    const dsKhach = await apiGet('/api/danhmuc/khachhang').then(r => r.data || []).catch(() => []);
    const optKhach = (dsKhach || []).map(k =>
      `<option value="${escapeHtml(k.TenKhachHang)}">${escapeHtml(k.TenKhachHang)}${k.SDT ? ' · ' + escapeHtml(k.SDT) : ''}</option>`).join('');
    const heSo = Number(hangInfo && hangInfo.LoaiRi) || 1;
    let rowCount = 0;
    function rowTemplate() {
      rowCount++;
      return `<div class="form-grid" style="grid-template-columns:1.3fr .8fr .9fr auto;gap:8px;align-items:end;margin-bottom:8px;" data-qrow>
        <div><label>Khách hàng *</label><select class="q-khach" required><option value="">-- chọn khách --</option>${optKhach}</select></div>
        <div><label>Số lượng</label><input class="q-sl" type="number" min="1" value="1">
          <div class="q-quydoi" style="font-size:11px;color:#5f6368;"></div></div>
        <div><label>Đơn vị</label><select class="q-donvi">${optDonViCua(hangInfo)}</select></div>
        <div><button type="button" class="btn small danger q-remove">X</button></div>
      </div>`;
    }
    // Dòng quy đổi: đặt theo đơn vị gộp thì hiện ra bằng bao nhiêu đơn vị chính, để nhìn là biết ngay.
    function capNhatQuyDoi(rowEl) {
      const o = rowEl.querySelector('.q-quydoi');
      if (!o) return;
      const sl = Number(rowEl.querySelector('.q-sl').value) || 0;
      const dv = rowEl.querySelector('.q-donvi').value;
      const goc = dvGocCua(hangInfo);
      o.textContent = (laDonViGop(dv, hangInfo) && heSo > 1 && sl)
        ? `= ${fmtNumber(sl * heSo)} ${goc}` : '';
    }
    // v5.3 (muc 2): thoat khoi "Dat hang nhanh" (Huy / phim Esc / nut ✕) quay lai "Chi tiet ma hang"
    // (openHistory) thay vi mat het luon - dung opts.onClose cua openModal() (xem common.js).
    const backToHistory = () => openHistory(hangInfo.MaHang, perm);
    const modal = openModal(`
      <h3>Đặt hàng nhanh — ${escapeHtml(hangInfo.MaHang)} · ${escapeHtml(tenMau)}</h3>
      <p style="font-size:13px;color:#5f6368;margin-top:-6px;">Có thể thêm nhiều khách cùng lúc, cho đúng 1 mã hàng + 1 màu này.</p>
      <form id="qForm">
        <div id="qRows">${rowTemplate()}</div>
        <div style="display:flex;gap:6px;">
          <button type="button" class="btn small secondary" id="btnAddQ">+ Thêm khách</button>
          ${/* v6.44: giống form đầy đủ — khách chưa có trong danh mục thì thêm ngay tại đây. */''}
          <button type="button" class="btn small secondary" id="btnQThemKhach">+ Khách mới</button>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancelQ">Hủy</button>
          <button type="submit" class="btn">Lưu đặt hàng</button>
        </div>
      </form>`, { onClose: backToHistory });
    modal.querySelector('#btnCancelQ').addEventListener('click', backToHistory);
    function wireRow(rowEl) {
      const btn = rowEl.querySelector('.q-remove');
      if (btn) btn.onclick = () => {
        if (modal.querySelectorAll('#qRows > div').length > 1) rowEl.remove();
      };
      rowEl.querySelector('.q-sl').addEventListener('input', () => capNhatQuyDoi(rowEl));
      rowEl.querySelector('.q-donvi').addEventListener('change', () => capNhatQuyDoi(rowEl));
      capNhatQuyDoi(rowEl);
    }
    modal.querySelectorAll('[data-qrow]').forEach(wireRow);
    modal.querySelector('#btnAddQ').addEventListener('click', () => {
      const box = modal.querySelector('#qRows');
      box.insertAdjacentHTML('beforeend', rowTemplate());
      wireRow(box.lastElementChild);
    });
    // v6.44: thêm khách vào danh mục rồi chọn luôn cho MỌI dòng đang để trống.
    modal.querySelector('#btnQThemKhach').addEventListener('click', async () => {
      const kh = await themKhachNhanh('');
      if (!kh) return;
      dsKhach.push(kh);
      modal.querySelectorAll('.q-khach').forEach(sel => {
        const o = document.createElement('option');
        o.value = kh.TenKhachHang; o.textContent = kh.TenKhachHang + (kh.SDT ? ' · ' + kh.SDT : '');
        sel.appendChild(o);
        if (!sel.value) sel.value = kh.TenKhachHang;
      });
    });
    modal.querySelector('#qForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const rows = Array.from(modal.querySelectorAll('#qRows > div'));
      const submitBtn = modal.querySelector('button[type="submit"]');
      submitBtn.disabled = true; submitBtn.textContent = 'Đang lưu...';
      const errors = [];
      let okCount = 0;
      for (const r of rows) {
        const tenKhach = r.querySelector('.q-khach').value.trim();
        const soLuong = r.querySelector('.q-sl').value;
        const donVi = r.querySelector('.q-donvi').value;
        if (!tenKhach) { errors.push('Chưa chọn khách hàng ở một dòng.'); continue; }
        try {
          await apiPost('/api/khohang/orders', { tenKhach, items: [{ maHangId: hangInfo.MaHangID, mauSacId, soLuong, donVi }] });
          okCount++;
        } catch (err) { errors.push(tenKhach + ': ' + err.message); }
      }
      if (okCount) toast(`Đã lên đơn cho ${okCount} khách.`, 'success');
      if (errors.length) toast(errors.join('\n'), 'error');
      submitBtn.disabled = false; submitBtn.textContent = 'Lưu đặt hàng';
      if (!errors.length) { closeModal(); openHistory(hangInfo.MaHang, perm); }
    });
  }

  // Trang lich su mo rong: chi tiet ton theo tung mau (nhap/xuat/ton, hien song song 2 don vi, +
  // anh theo tung mau va nut "Dat hang" nhanh - muc 4b) + giu nguyen bang lich su ben duoi.
  async function openHistory(maHang, perm) {
    const res = await apiGet(`/api/khohang/items/${encodeURIComponent(maHang)}/history`);
    const { hangInfo, colorDetail, orders } = res.data;
    const loaiRi = hangInfo.LoaiRi;
    const donViCoBan = hangInfo.DonViCoBan;
    const donViQuyDoi = hangInfo.DonViQuyDoi;
    // v5.51: dữ liệu để Sửa đơn + nút thao tác NGAY trong Lịch sử mã hàng (giống màn Đơn khách đặt hàng).
    const itemsRes = await apiGet('/api/khohang/items');
    const allItems = itemsRes.data.tongHop, chiTiet = itemsRes.data.chiTiet;
    const khachList = [...new Set(orders.map(o => o.TenKhach).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    const histStatusButtons = (o) => ['Chờ xử lý', 'Đã giao', 'Đã hủy'].filter(s => s !== o.TrangThai).map(s => `<button class="btn small secondary act-h-status" data-id="${o.DonID}" data-status="${s}">${s}</button>`).join(' ');
    const histActions = !!(perm && (perm.canEdit || perm.canDelete));
    const modal = openModal(`
      <h3>Lịch sử &amp; chi tiết theo màu — ${escapeHtml(hangInfo.MaHang)} (${escapeHtml(hangInfo.TenHang)})</h3>
      ${hangInfo.AnhDaiDien ? `<img class="thumb hist-main-thumb" loading="lazy" decoding="async" src="${escapeHtml(anhNho(hangInfo.AnhDaiDien, 160))}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;cursor:pointer;margin-bottom:10px;" title="Bấm để phóng to ảnh đại diện">` : ''}

      <h4 style="margin:0 0 8px;">Chi tiết theo màu</h4>
      <table><thead><tr><th>Ảnh</th><th>Ghi chú</th><th>Màu</th><th>Nhập</th><th>Xuất</th><th>Tồn</th><th style="width:110px">Thao tác</th></tr></thead>
      <tbody>${colorDetail.map((c, idx) => `<tr>
        <td>${c.LinkAnh ? `<img class="thumb hist-thumb" data-idx="${idx}" loading="lazy" decoding="async" src="${escapeHtml(anhNho(c.LinkAnh, 80))}" style="width:36px;height:36px;object-fit:cover;border-radius:4px;cursor:pointer;">` : ''}</td>
        <td style="white-space:pre-wrap;">${escapeHtml(c.GhiChu || '')}</td>
        <td>${escapeHtml(c.TenMau)}</td>
        ${/* v6.89: cột "Nhập" của lịch sử phải là TỔNG cả 2 nguồn (thẻ kho + phiếu nhập kho), khác
             với ô Nhập của form Sửa (chỉ phần thẻ kho). Endpoint trả cả 2 trường riêng. */''}
        <td>${fmtDualUnit(c.TongNhapCai != null ? c.TongNhapCai : c.NhapCai, loaiRi, donViCoBan, donViQuyDoi)}</td>
        <td>${fmtDualUnit(c.XuatCai, loaiRi, donViCoBan, donViQuyDoi)}</td>
        <td>${fmtDualUnit(c.TonCai, loaiRi, donViCoBan, donViQuyDoi)} ${Number(c.TonCai) < 0 ? '<span class="badge danger">Âm kho</span>' : ''}</td>
        <td>${perm && perm.canCreate ? `<button type="button" class="btn small secondary act-quick-order" data-idx="${idx}">Đặt hàng</button>` : ''}</td>
        </tr>`).join('') || '<tr><td colspan="7" class="empty-hint">Chưa có chi tiết theo màu</td></tr>'}</tbody></table>

      <h4 style="margin:18px 0 8px;">Lịch sử đặt hàng</h4>
      <table><thead><tr><th>Thời gian</th><th>Khách</th><th>Màu</th><th>SL</th><th>Đơn vị</th><th>Trạng thái</th>${histActions ? '<th style="width:320px">Thao tác</th>' : ''}</tr></thead>
      <tbody>${orders.map(r => `<tr><td>${fmtDate(r.ThoiGian)}</td><td>${escapeHtml(r.TenKhach)}</td><td>${escapeHtml(r.TenMau)}</td>
        <td>${fmtNumber(r.SoLuongDat)}</td><td>${escapeHtml(r.DonVi)}</td><td>${statusBadge(r.TrangThai)}</td>${histActions ? `<td>${perm.canEdit ? `<button class="btn small secondary act-h-edit" data-id="${r.DonID}">Sửa</button> ` : ''}${perm.canEdit ? `<button class="btn small secondary act-h-inphieu" data-id="${r.DonID}" title="Chỉ in giấy — không trừ tồn, không đổi trạng thái">🖨️ In</button> ` : ''}${perm.canEdit && r.TrangThai !== 'Đã hủy' ? histStatusButtons(r) + ' ' : ''}${perm.canDelete ? `<button class="btn small danger act-h-del" data-id="${r.DonID}">Xóa</button>` : ''}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${histActions ? 7 : 6}" class="empty-hint">Chưa có lịch sử</td></tr>`}</tbody></table>
      <div class="modal-actions"><button class="btn secondary" id="btnClose">Đóng</button></div>`);
    // Mo rong modal cho vua 2 bang (min() de tren mobile van gioi han theo 96vw nhu CSS mac dinh)
    modal.querySelector('.modal').style.maxWidth = 'min(960px, 96vw)';
    modal.querySelector('#btnClose').addEventListener('click', closeModal);
    // v5.4 (muc 1): dong lightbox (anh dai dien HOAC anh theo mau) phai quay lai dung man hinh
    // "chi tiet ma hang" nay (openHistory), khong duoc mat het - truyen onClose = mo lai openHistory.
    const backToDetail = () => openHistory(maHang, perm);
    const mainThumb = modal.querySelector('.hist-main-thumb');
    if (mainThumb) mainThumb.addEventListener('click', () => openImageLightbox(hangInfo.AnhDaiDien, hangInfo.MaHang + ' · Ảnh đại diện', backToDetail));
    modal.querySelectorAll('.hist-thumb').forEach(img => img.addEventListener('click', () => {
      const c = colorDetail[Number(img.dataset.idx)];
      openImageLightbox(c.LinkAnh, hangInfo.MaHang + ' · ' + c.TenMau, backToDetail);
    }));
    modal.querySelectorAll('.act-quick-order').forEach(btn => btn.addEventListener('click', () => {
      const c = colorDetail[Number(btn.dataset.idx)];
      // v6.44: hàm nay là async (phải tải danh mục khách) -> bắt lỗi, tránh nút "im lặng" khi API hỏng.
      openQuickOrderModal(hangInfo, c.MauSacID, c.TenMau, perm)
        .catch(err => toast('Không mở được Đặt hàng nhanh: ' + err.message, 'error'));
    }));
    // v5.51: thao tác đơn ngay trong Lịch sử — làm xong tự mở lại Lịch sử mã hàng này.
    modal.querySelectorAll('.act-h-edit').forEach(btn => btn.addEventListener('click', () => {
      const o = orders.find(x => String(x.DonID) === btn.dataset.id);
      if (o) openOrderEditModal(o, allItems, chiTiet, khachList, perm, () => openHistory(maHang, perm));
    }));
    modal.querySelectorAll('.act-h-status').forEach(btn => btn.addEventListener('click', async () => {
      try { await apiPut(`/api/khohang/orders/${btn.dataset.id}/status`, { newStatus: btn.dataset.status }); toast('Đã cập nhật.', 'success'); openHistory(maHang, perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
    modal.querySelectorAll('.act-h-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa đơn đặt hàng này? Tồn kho sẽ được hoàn lại nếu đơn đang trừ tồn.')) return;
      try { await apiDelete('/api/khohang/orders/' + btn.dataset.id); toast('Đã xóa đơn.', 'success'); openHistory(maHang, perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
    // v6.42.1: BỎ SÓT Ở v6.42 — nút in trong "Lịch sử mã hàng" vẫn còn chuyển đơn sang "Đã giao".
    // Nay giống 3 nút in kia: chỉ in giấy, không đổi trạng thái, không đụng tồn kho.
    modal.querySelectorAll('.act-h-inphieu').forEach(btn => btn.addEventListener('click', () => {
      const o = orders.find(x => String(x.DonID) === btn.dataset.id);
      if (o) printPhieuDatHang(o.TenKhach, [o], false);
    }));
  }

  /* ===== v6.21: GỘP ĐƠN KHÁCH ĐẶT =====
     "1 mã hàng cùng màu khách đặt trong 1 ngày thì tính gộp vào" → khóa gộp =
       NGÀY + KHÁCH + MÃ HÀNG + MÀU + ĐƠN VỊ.
     ⚠️ Có ĐƠN VỊ trong khóa vì "10 Cái" và "10 Ri" KHÔNG được cộng thành 20 (LoaiRi mỗi mã một khác).
     Mỗi nhóm giữ nguyên danh sách đơn con (`dons`) để vẫn Sửa/Xóa/đổi trạng thái/in từng đơn được.
     Dùng CHUNG cho danh sách trên màn hình VÀ bảng kê in — backend xuất Excel gộp theo cùng khóa này. */
  function gopDonKhach(rows) {
    const map = new Map();
    (rows || []).forEach(o => {
      const ngay = fmtDate(o.ThoiGian) || '';
      const key = [ngay, o.TenKhach || '', o.MaHangID, o.MauSacID, o.DonVi || ''].join('|');
      if (!map.has(key)) {
        map.set(key, {
          key, Ngay: ngay, ts: new Date(o.ThoiGian).getTime() || 0,
          TenKhach: o.TenKhach, MaHangID: o.MaHangID, MaHang: o.MaHang, TenHang: o.TenHang,
          MauSacID: o.MauSacID, TenMau: o.TenMau, DonVi: o.DonVi, GiaBan: o.GiaBan,
          LoaiRi: o.LoaiRi, DonViCoBan: o.DonViCoBan, DonViQuyDoi: o.DonViQuyDoi,   // v6.21.1: để quy SL ra Cái (giá là giá 1 Cái); v6.31: + ĐVT quy đổi để nhận diện đơn vị gộp
          AnhDaiDien: o.AnhDaiDien, SoLuongDat: 0, dons: []
        });
      }
      const g = map.get(key);
      g.SoLuongDat += Number(o.SoLuongDat) || 0;
      g.dons.push(o);
    });
    const ds = [...map.values()];
    /* v6.76: ĐƠN CHƯA XỬ LÝ XONG LUÔN NẰM TRÊN CÙNG.
       Trước đây chỉ đẩy "Chờ xác nhận" lên đầu, còn "Chờ xử lý" (đơn đã xác nhận, đang chờ lên phiếu
       bán hàng) bị trộn lẫn theo ngày — đơn cũ vài tuần chưa xuất hàng trôi xuống tận đáy, đúng cái
       cần làm thì lại khuất nhất.
       Mức ưu tiên: 0 = Chờ xác nhận (cần bấm duyệt) → 1 = Chờ xử lý (cần lên phiếu) → 2 = xong.
       Trong cùng một mức thì mới nhất lên trước. */
    const uuTien = (g) => {
      if (g.dons.some(o => o.TrangThai === 'Chờ xác nhận')) return 0;
      if (g.dons.some(o => o.TrangThai === 'Chờ xử lý')) return 1;
      return 2;
    };
    ds.forEach(g => { g.uuTien = uuTien(g); g.coChoXacNhan = g.uuTien === 0; });
    ds.sort((a, b) => (a.uuTien !== b.uuTien ? a.uuTien - b.uuTien : b.ts - a.ts));
    return ds;
  }

  // v6.21: chuyển ra ngoài renderOrders để nhomRowHtml() dùng chung (trước là hàm lồng trong renderOrders).
  function statusButtons(o) {
    // v5.63: đơn 'Chờ xác nhận' chỉ cho Xác nhận (nút riêng) hoặc Hủy — không cho nhảy thẳng sang
    // 'Đã giao' vì lúc đó tồn kho CHƯA bị trừ.
    /* v6.23: đơn 'Đã xuất hàng' (đã có phiếu bán hàng, đã trừ tồn) KHÔNG cho đổi trạng thái tay —
       muốn quay lại thì HỦY phiếu bán hàng để hệ thống hoàn tồn đúng. */
    if (o.TrangThai === 'Đã xuất hàng') return '<span class="empty-hint" style="padding:0;">đã có phiếu bán hàng — hủy phiếu đó nếu muốn sửa</span>';
    const options = (o.TrangThai === 'Chờ xác nhận' ? ['Đã hủy'] : ['Chờ xử lý', 'Đã giao', 'Đã hủy']).filter(s => s !== o.TrangThai);
    return options.map(s => `<button class="btn small secondary act-status" data-id="${o.DonID}" data-status="${s}">${s}</button>`).join(' ');
  }
  // Các nút thao tác của MỘT đơn (dùng cho cả dòng nhóm 1 đơn và dòng đơn con).
  function donThaoTacHtml(o, perm) {
    /* v6.42: IN LÀ IN — nút in KHÔNG còn đổi trạng thái sang "Đã giao" nữa, nên hiện cho MỌI trạng
       thái (kể cả "Đã xuất hàng"). Trước v6.23 chưa có phiếu bán hàng nên việc trừ tồn phải bám vào
       thao tác in; nay phiếu bán hàng lo trừ tồn + công nợ, in chỉ còn là in giấy. */
    return `${/* v5.63: đơn khách đặt web ở trạng thái "Chờ xác nhận" CHƯA trừ tồn -> nút Xác nhận trừ tồn */''}${perm.canEdit && o.TrangThai === 'Chờ xác nhận' ? `<button class="btn small act-xacnhan" data-id="${o.DonID}" title="Xác nhận đơn và TRỪ TỒN KHO">✔ Xác nhận</button> ` : ''}${perm.canEdit ? `<button class="btn small secondary act-edit-order" data-id="${o.DonID}">Sửa</button> ` : ''}${perm.canEdit ? `<button class="btn small secondary act-inphieu" data-id="${o.DonID}" title="Chỉ in giấy — không trừ tồn, không đổi trạng thái">🖨️ In phiếu</button> ` : ''}${perm.canEdit && o.TrangThai !== 'Đã hủy' ? statusButtons(o) + ' ' : ''}${perm.canDelete ? `<button class="btn small danger act-delete-order" data-id="${o.DonID}">Xóa</button>` : ''}`;
  }
  // 1 nhóm = 1 dòng chính (+ các dòng đơn con ẩn nếu nhóm có nhiều đơn).
  function nhomRowHtml(g, perm) {
    const ids = g.dons.map(d => d.DonID).join(',');
    const nhieu = g.dons.length > 1;
    const tts = [...new Set(g.dons.map(d => d.TrangThai))];
    const coWeb = g.dons.some(d => d.NguonDat === 'Web');
    const ghiChu = g.dons.map(d => d.GhiChuKhach).filter(Boolean);
    // data-trangthai kẹp | ở 2 đầu để lọc bằng includes('|Đã giao|') — nhóm có thể MANG NHIỀU trạng thái.
    // v6.42: data-sl/data-dv để dòng TỔNG CỘNG cộng được ngay trên DOM theo đúng bộ lọc đang áp,
    // không phải chạy lại gopDonKhach() mỗi lần đổi ô lọc.
    const dong = `<tr data-key="${ids}" data-ids="${ids}" data-sl="${Number(g.SoLuongDat) || 0}" data-dv="${escapeHtml(g.DonVi || '')}" data-khach="${escapeHtml(g.TenKhach || '')}" data-mahang="${escapeHtml(g.MaHang || '')}" data-mau="${escapeHtml(g.TenMau || '')}" data-trangthai="|${tts.map(t => escapeHtml(t || '')).join('|')}|" data-tg="${escapeHtml(g.Ngay || '')}">
      <td><input type="checkbox" class="ord-chon" data-ids="${ids}"></td>
      ${/* v5.65: cột Ảnh = ảnh đại diện chung của mã hàng */''}
      <td>${g.AnhDaiDien ? `<img class="thumb act-zoom-main" loading="lazy" decoding="async" data-src="${escapeHtml(g.AnhDaiDien)}" data-title="${escapeHtml((g.MaHang || '') + ' · ' + (g.TenHang || ''))}" src="${escapeHtml(anhNho(g.AnhDaiDien, 160))}" style="cursor:pointer;" title="Bấm để phóng to">` : ''}</td>
      <td>${escapeHtml(g.Ngay)}</td><td>${escapeHtml(g.TenKhach)}</td><td>${escapeHtml(g.MaHang)}</td>
      <td>${escapeHtml(g.TenMau)}</td>
      <td><b>${fmtNumber(g.SoLuongDat)}</b>${nhieu ? `<div style="font-size:11px;color:#5f6368;">gộp ${g.dons.length} đơn</div>` : ''}</td>
      <td>${escapeHtml(g.DonVi)}</td>
      <td>${tts.map(t => statusBadge(t)).join(' ')}${coWeb ? ' <span class="badge info" title="Khách tự đặt trên web">Web</span>' : ''}${ghiChu.length ? `<div style="font-size:11px;color:#5f6368;">Ghi chú: ${escapeHtml(ghiChu.join(' | '))}</div>` : ''}</td>
      <td>${nhieu ? `<button type="button" class="btn small secondary act-mo-nhom" data-key="${ids}">▾ ${g.dons.length} đơn</button>` : donThaoTacHtml(g.dons[0], perm)}</td>
    </tr>`;
    if (!nhieu) return dong;
    const con = g.dons.map(o => `<tr class="ord-sub" data-sub="${ids}" data-id="${o.DonID}" style="display:none;background:#f8f9fa;">
      <td></td><td></td>
      <td style="font-size:12px;color:#5f6368;">${escapeHtml(fmtDate(o.ThoiGian) || '')}</td>
      <td colspan="3" style="font-size:12px;color:#5f6368;">↳ Đơn #${o.DonID}${o.NguonDat === 'Web' ? ' (Web)' : ''}</td>
      <td>${fmtNumber(o.SoLuongDat)}</td><td>${escapeHtml(o.DonVi)}</td>
      <td>${statusBadge(o.TrangThai)}</td>
      <td>${donThaoTacHtml(o, perm)}</td></tr>`).join('');
    return dong + con;
  }

  async function renderOrders(perm) {
    const body = document.getElementById('khBody');
    // v5.64.1: KHÔNG để lỗi tải dữ liệu làm TRẮNG tab — hiện thông báo lỗi cụ thể để biết đường xử lý.
    let itemsRes, ordersRes;
    try {
      body.innerHTML = '<div class="empty-hint">Đang tải...</div>';
      [itemsRes, ordersRes] = await Promise.all([apiGet('/api/khohang/items'), apiGet('/api/khohang/orders')]);
    } catch (e) {
      body.innerHTML = `<div class="empty-hint">Không tải được danh sách đơn đặt hàng.<br><b>${escapeHtml(e.message)}</b><br><br>
        Nếu báo thiếu cột (Invalid column name): hãy chạy <code>database/migration_v657.sql</code> rồi <code>pm2 restart qlnoibo</code>.</div>`;
      return;
    }
    const { tongHop: items, chiTiet } = itemsRes.data;
    const orders = ordersRes.data;
    if (ordersRes.tyLeCK) tyLeCK = ordersRes.tyLeCK;   // v6.21: để bảng kê in tính giá sau CK
    if (ordersRes.canhBao) toast(ordersRes.canhBao, 'info');   // vd chưa chạy migration_v657
    // v6.21: GỘP các đơn cùng (ngày + khách + mã hàng + màu + đơn vị) — xem gopDonKhach().
    const nhomDon = gopDonKhach(orders);
    // v5.44: lọc theo khách + xuất phiếu (theo khách / theo từng đơn); xuất phiếu chuyển đơn sang "Đã giao".
    /* v6.74.2: GỘP KHÁCH Ở BỘ LỌC. Cùng một khách viết lệch nhau ("Cty An Bình", "CTY AN BÌNH ",
       "Cty  An  Bình") trước đây ra 3 dòng lọc riêng — chọn dòng nào cũng chỉ thấy một phần đơn.
       Gộp theo tên đã chuẩn hoá, tên đại diện là bản xuất hiện nhiều nhất (cùng quy tắc với CLI
       utils/gop_ten_khach.js). Việc SO KHỚP khi lọc cũng phải dùng chung chuẩn đó, xem applyOrderFilters().
       ⚠️ Chỉ gộp KHI HIỂN THỊ — dữ liệu vẫn lệch. Gộp hẳn: node utils/gop_ten_khach.js --liet-ke */
    const nhomKh = new Map();
    orders.forEach(o => {
      const k = chuanTenKhach(o.TenKhach);
      if (!k) return;
      if (!nhomKh.has(k)) nhomKh.set(k, new Map());
      const m = nhomKh.get(k);
      m.set(o.TenKhach, (m.get(o.TenKhach) || 0) + 1);
    });
    /* v6.76: XẾP KHÁCH THEO LẦN ĐẶT GẦN NHẤT, không xếp A→Z nữa.
       Danh sách khách dài, khách vừa đặt hàng nằm lẫn đâu đó giữa bảng chữ cái thì phải kéo đi tìm.
       Khách mới đặt là khách đang cần xử lý -> đưa lên đầu. */
    const lanCuoiKhach = new Map();
    orders.forEach(o => {
      const k = chuanTenKhach(o.TenKhach);
      if (!k) return;
      const ts = new Date(o.ThoiGian).getTime() || 0;
      if (ts > (lanCuoiKhach.get(k) || 0)) lanCuoiKhach.set(k, ts);
    });
    const khachList = [...nhomKh.entries()]
      .map(([k, m]) => ({ ten: [...m.entries()].sort((x, y) => y[1] - x[1])[0][0], ts: lanCuoiKhach.get(k) || 0 }))
      .sort((a, b) => (b.ts - a.ts) || a.ten.localeCompare(b.ten, 'vi'))
      .map(x => x.ten);
    const maHangList = [...new Set(orders.map(o => o.MaHang).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    // v5.49: nếu giá trị đang lọc không còn đơn nào (vd vừa xóa đơn cuối của khách đó) -> bỏ lọc để UI khớp.
    if (ordFilterKhach && !khachList.some(t => chuanTenKhach(t) === chuanTenKhach(ordFilterKhach))) ordFilterKhach = '';
    if (ordFilterMaHang && !maHangList.includes(ordFilterMaHang)) ordFilterMaHang = '';
    /* v5.81: LỌC NGAY TẠI TIÊU ĐỀ TỪNG CỘT + CHỌN DÒNG ĐỂ IN.
       - Hàng tiêu đề thứ 2 chứa ô lọc: Thời gian (v5.82: DANH SÁCH chọn tháng/ngày), Khách, Mã hàng, Màu, Trạng thái.
       - Cột đầu là ô tích; tích ở tiêu đề = chọn/bỏ chọn TẤT CẢ dòng ĐANG HIỆN (không chọn dòng bị lọc ẩn).
       - 2 nút in: "In các dòng đang hiện" (theo đúng bộ lọc) và "In dòng đã chọn". */
    const mauList = [...new Set(orders.map(o => o.TenMau).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    if (ordFilterMau && !mauList.includes(ordFilterMau)) ordFilterMau = '';
    /* v5.82: lọc NGÀY bằng DANH SÁCH CHỌN (không gõ tay) — gom các ngày CÓ THẬT trong dữ liệu,
       mới nhất lên đầu. Kèm "Tháng" phía trước để chọn nhanh cả tháng. */
    const ngayMap = new Map();   // 'dd/mm/yyyy' -> mốc thời gian (để sắp xếp giảm dần)
    orders.forEach(o => {
      const s = fmtDate(o.ThoiGian);
      if (!s) return;
      const ts = new Date(o.ThoiGian).getTime() || 0;
      if (!ngayMap.has(s) || ts > ngayMap.get(s)) ngayMap.set(s, ts);
    });
    const ngayList = [...ngayMap.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const thangList = [...new Set(ngayList.map(s => s.slice(3)))];   // mm/yyyy, giữ nguyên thứ tự mới→cũ
    if (ordFilterThoiGian && !ngayList.includes(ordFilterThoiGian) && !thangList.includes(ordFilterThoiGian)) ordFilterThoiGian = '';
    const optLoc = (ds, dangChon) => ds.map(v => `<option value="${escapeHtml(v)}"${dangChon === v ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('');
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${perm.canCreate ? '<button class="btn" id="btnAdd">+ Lên đơn đặt hàng</button>' : ''}
        ${/* v6.42: 2 nút in này CHỈ IN GIẤY — không trừ tồn, không đổi trạng thái, không lọc bỏ đơn
             theo trạng thái. Việc trừ tồn/công nợ do PHIẾU BÁN HÀNG (v6.23) đảm nhiệm. */''}
        ${perm.canEdit ? '<button class="btn small secondary" id="btnInHien" title="Chỉ in giấy — không trừ tồn, không đổi trạng thái">🖨️ In các dòng đang hiện</button>' : ''}
        ${perm.canEdit ? '<button class="btn small secondary" id="btnInChon" title="Chỉ in giấy — không trừ tồn, không đổi trạng thái">🖨️ In các dòng tích chọn (<span id="ordSoChon">0</span>)</button>' : ''}
        ${/* v6.23: chuyển các dòng đang chọn/đang hiện sang PHIẾU BÁN HÀNG (trừ tồn + ghi công nợ). */''}
        ${perm.canEdit ? '<button class="btn" id="btnSangPhieuBH">🧾 Chuyển sang phiếu bán hàng</button>' : ''}
        ${/* v6.21: xuất Excel THEO ĐÚNG bộ lọc đang áp, dữ liệu đã gộp như trên màn hình */''}
        <button class="btn small secondary" id="btnXuatExcelDon">⬇️ Xuất Excel</button>
        <button class="btn small secondary" id="btnXoaLoc">✖ Bỏ lọc</button>
        <span class="empty-hint" style="padding:0;" id="ordDemDong"></span>
      </div>
      <table><thead>
      <tr><th style="width:34px"><input type="checkbox" id="ordChonTatCa" title="Chọn tất cả dòng đang hiện"></th>
        <th style="width:56px">Ảnh</th><th>Thời gian</th><th>Khách</th><th>Mã hàng</th><th>Màu</th><th>SL</th><th>Đơn vị</th><th>Trạng thái</th><th style="width:340px">Thao tác</th></tr>
      <tr class="hang-loc"><th></th><th></th>
        <th><select id="locThoiGian" title="Chọn tháng hoặc ngày"><option value="">— Tất cả —</option>${thangList.length ? `<optgroup label="Theo tháng">${optLoc(thangList, ordFilterThoiGian)}</optgroup>` : ''}${ngayList.length ? `<optgroup label="Theo ngày">${optLoc(ngayList, ordFilterThoiGian)}</optgroup>` : ''}</select></th>
        <th><select id="locKhach"><option value="">— Tất cả —</option>${optLoc(khachList, ordFilterKhach)}</select></th>
        <th><select id="locMaHang"><option value="">— Tất cả —</option>${optLoc(maHangList, ordFilterMaHang)}</select></th>
        <th><select id="locMau"><option value="">— Tất cả —</option>${optLoc(mauList, ordFilterMau)}</select></th>
        <th></th><th></th>
        <th><select id="locTrangThai"><option value="">— Tất cả —</option>${optLoc(['Chờ xác nhận', 'Chờ xử lý', 'Đã xuất hàng', 'Đã giao', 'Đã hủy'], ordFilterTrangThai)}</select></th>
        <th></th></tr>
      </thead>
      ${/* v6.21: 1 DÒNG = 1 NHÓM (ngày + khách + mã hàng + màu + đơn vị), SL đã cộng dồn. Nhóm có nhiều
           đơn thì bấm "▾ N đơn" để mở các đơn con — thao tác Sửa/Xóa/trạng thái/in vẫn theo TỪNG đơn. */''}
      ${/* v6.42: dòng TỔNG CỘNG nằm NGAY ĐẦU tbody và dính khi cuộn (dùng lại .row-tong của v6.28).
           Số lượng KHÔNG cộng gộp giữa các đơn vị khác nhau — Ri, Cái, Bộ là 3 thứ khác nhau, cộng
           chung ra một con số vô nghĩa — nên tách từng đơn vị một dòng. */''}
      <tbody>
        <tr class="row-tong" id="ordDongTong">
          <td></td><td></td>
          <td colspan="4" id="ordTongNhan">TỔNG CỘNG</td>
          <td id="ordTongSL" style="text-align:right;"></td>
          <td id="ordTongDV"></td>
          <td colspan="2"></td>
        </tr>
        ${nhomDon.map(g => nhomRowHtml(g, perm)).join('') || '<tr><td colspan="10" class="empty-hint">Chưa có đơn đặt hàng</td></tr>'}</tbody></table>`;

    /* v5.49/v5.81: áp bộ lọc — biến module-scope để GIỮ bộ lọc khi re-render sau mỗi thao tác.
       v6.21: "dòng" nay là DÒNG NHÓM (`tr[data-key]`); dòng đơn con (`tr[data-sub]`) chỉ hiện khi mở
       nhóm và luôn theo trạng thái ẩn/hiện của nhóm cha. */
    function dongDangHien() {
      return Array.from(body.querySelectorAll('table tbody tr[data-key]')).filter(tr => tr.style.display !== 'none');
    }
    function idsCuaDong(tr) {
      return (tr.dataset.ids || '').split(',').filter(Boolean);
    }
    function capNhatDem() {
      const hienTr = dongDangHien();
      const hien = hienTr.length;
      const soDonHien = hienTr.reduce((s, tr) => s + idsCuaDong(tr).length, 0);
      const chonTr = Array.from(body.querySelectorAll('.ord-chon:checked'));
      const el = body.querySelector('#ordDemDong');
      if (el) el.textContent = `Đang hiện ${hien} / ${nhomDon.length} dòng gộp (${soDonHien} / ${orders.length} đơn)`;
      const sc = body.querySelector('#ordSoChon');
      if (sc) sc.textContent = String(chonTr.length);
      const all = body.querySelector('#ordChonTatCa');
      if (all) all.checked = hien > 0 && chonTr.length >= hien;
      capNhatTong(hienTr, chonTr.length);
    }
    /* v6.42: dòng TỔNG CỘNG — cộng theo ĐÚNG các dòng ĐANG HIỆN (khớp bộ lọc), tách riêng từng
       đơn vị tính. Nếu có dòng đang tích thì hiện thêm tổng của riêng phần đã tích. */
    function capNhatTong(hienTr, soChon) {
      const oSL = body.querySelector('#ordTongSL');
      const oDV = body.querySelector('#ordTongDV');
      const oNhan = body.querySelector('#ordTongNhan');
      if (!oSL || !oDV) return;
      const cong = trs => {
        const m = new Map();
        trs.forEach(tr => {
          const dv = tr.dataset.dv || '(không ghi)';
          m.set(dv, (m.get(dv) || 0) + (Number(tr.dataset.sl) || 0));
        });
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
      };
      const veCot = ds => ({
        sl: ds.map(([, v]) => `<div>${fmtNumber(v)}</div>`).join('') || '<div>0</div>',
        dv: ds.map(([k]) => `<div>${escapeHtml(k)}</div>`).join('') || '<div></div>',
      });
      const tongHien = cong(hienTr);
      const chonTr = soChon ? Array.from(body.querySelectorAll('.ord-chon:checked'))
        .map(cb => cb.closest('tr[data-key]')).filter(Boolean) : [];
      const a = veCot(tongHien);
      if (chonTr.length) {
        const b = veCot(cong(chonTr));
        oNhan.innerHTML = `TỔNG CỘNG — đang hiện (${hienTr.length} dòng)<div style="font-weight:normal;color:#1a73e8;">trong đó đã tích: ${chonTr.length} dòng</div>`;
        oSL.innerHTML = a.sl + '<div style="color:#1a73e8;border-top:1px dashed var(--border);">' + b.sl + '</div>';
        oDV.innerHTML = a.dv + '<div style="color:#1a73e8;border-top:1px dashed var(--border);">' + b.dv + '</div>';
      } else {
        oNhan.innerHTML = `TỔNG CỘNG — đang hiện (${hienTr.length} dòng)`;
        oSL.innerHTML = a.sl;
        oDV.innerHTML = a.dv;
      }
      dinhDongTong();
    }
    /* Dòng tổng phải dính NGAY DƯỚI <thead> (thead ở màn hình này có 2 hàng: tiêu đề + ô lọc, và bản
       thân nó đã dính cách đỉnh một đoạn = thanh tab + thanh công cụ). Đo thật thay vì đoán hằng số:
       lấy `top` mà trình duyệt đang áp cho hàng tiêu đề đầu + chiều cao thật của cả thead. */
    // Tra cứu qua document (không bắt vào biến `body` của lần render này) để listener resize gắn 1 lần
    // vẫn chạy đúng sau mọi lần vẽ lại bảng.
    function dinhDongTong() {
      const tr = document.querySelector('#ordDongTong');
      if (!tr) return;
      const thead = tr.closest('table').querySelector('thead');
      if (!thead) return;
      const th = thead.querySelector('tr:first-child th');
      const base = th ? (parseFloat(getComputedStyle(th).top) || 0) : 0;
      const cao = thead.getBoundingClientRect().height;
      tr.querySelectorAll('td').forEach(td => { td.style.top = (base + cao) + 'px'; });
    }
    if (!window.__ordTongResize) {
      window.addEventListener('resize', dinhDongTong);
      window.__ordTongResize = true;
    }
    function applyOrderFilters() {
      const tg = (ordFilterThoiGian || '').trim().toLowerCase();
      body.querySelectorAll('table tbody tr[data-key]').forEach(tr => {
        // v6.74.2: so tên khách theo CHUẨN HOÁ, không so thô — nếu không thì chọn "Cty An Bình" sẽ
        // bỏ sót các dòng lưu là "CTY AN BÌNH " dù chúng đã được gộp chung một mục trong ô lọc.
        const ok = (!ordFilterKhach || chuanTenKhach(tr.dataset.khach) === chuanTenKhach(ordFilterKhach))
          && (!ordFilterMaHang || tr.dataset.mahang === ordFilterMaHang)
          && (!ordFilterMau || tr.dataset.mau === ordFilterMau)
          // Nhóm có thể mang NHIỀU trạng thái -> khớp 1 trong số đó là đạt.
          && (!ordFilterTrangThai || (tr.dataset.trangthai || '').includes('|' + ordFilterTrangThai + '|'))
          && (!tg || (tr.dataset.tg || '').toLowerCase().includes(tg));
        tr.style.display = ok ? '' : 'none';
        // Dòng bị lọc ẩn thì BỎ TÍCH — tránh in nhầm dòng không nhìn thấy — và ĐÓNG các đơn con.
        if (!ok) {
          const cb = tr.querySelector('.ord-chon'); if (cb) cb.checked = false;
          body.querySelectorAll(`tr[data-sub="${tr.dataset.key}"]`).forEach(s => { s.style.display = 'none'; });
          const btn = tr.querySelector('.act-mo-nhom'); if (btn) btn.textContent = btn.textContent.replace('▴', '▾');
        }
      });
      capNhatDem();
    }
    // v6.21: mở/đóng danh sách đơn con của 1 nhóm.
    body.querySelectorAll('.act-mo-nhom').forEach(btn => btn.addEventListener('click', () => {
      const con = body.querySelectorAll(`tr[data-sub="${btn.dataset.key}"]`);
      const dangMo = con.length && con[0].style.display !== 'none';
      con.forEach(s => { s.style.display = dangMo ? 'none' : ''; });
      btn.textContent = (dangMo ? '▾ ' : '▴ ') + con.length + ' đơn';
    }));
    // v5.65: ảnh đại diện ở cột Ảnh — bấm để phóng to (dùng chung lightbox với tab Thẻ kho).
    body.querySelectorAll('.act-zoom-main').forEach(img => img.addEventListener('click', () => {
      openImageLightbox(img.dataset.src, img.dataset.title);
    }));
    // v5.63: XÁC NHẬN đơn khách đặt web -> trừ tồn kho tại thời điểm này (backend kiểm tra đủ tồn).
    body.querySelectorAll('.act-xacnhan').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xác nhận đơn này? Tồn kho sẽ bị TRỪ ngay sau khi xác nhận.')) return;
      try { await apiPut(`/api/khohang/orders/${btn.dataset.id}/xacnhan`, {}); toast('Đã xác nhận đơn và trừ tồn kho.', 'success'); renderOrders(perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
    body.querySelectorAll('.act-status').forEach(btn => btn.addEventListener('click', async () => {
      try { await apiPut(`/api/khohang/orders/${btn.dataset.id}/status`, { newStatus: btn.dataset.status }); toast('Đã cập nhật.', 'success'); renderOrders(perm); }
      catch (err) { toast(err.message, 'error'); }
    }));

    /* v5.81: ô lọc nằm NGAY DƯỚI tiêu đề từng cột. `data-nosearch` để enhanceSelects (v5.51) KHÔNG
       biến chúng thành combobox gõ-tìm — trong ô tiêu đề chật, dropdown tự dựng sẽ tràn ra ngoài. */
    const gan = (id, xuLy, suKien) => {
      const el = body.querySelector('#' + id);
      if (el) { el.setAttribute('data-nosearch', '1'); el.addEventListener(suKien || 'change', xuLy); }
    };
    gan('locKhach', (e) => { ordFilterKhach = e.target.value; applyOrderFilters(); });
    gan('locMaHang', (e) => { ordFilterMaHang = e.target.value; applyOrderFilters(); });
    gan('locMau', (e) => { ordFilterMau = e.target.value; applyOrderFilters(); });
    gan('locTrangThai', (e) => { ordFilterTrangThai = e.target.value; applyOrderFilters(); });
    // v5.82: lọc ngày là DANH SÁCH CHỌN (tháng mm/yyyy hoặc ngày dd/mm/yyyy) -> nghe 'change'.
    // Giá trị tháng "07/2026" vẫn khớp vì bộ lọc so bằng includes() trên chuỗi "28/07/2026".
    gan('locThoiGian', (e) => { ordFilterThoiGian = e.target.value; applyOrderFilters(); });
    const btnXoaLoc = body.querySelector('#btnXoaLoc');
    if (btnXoaLoc) btnXoaLoc.addEventListener('click', () => {
      ordFilterKhach = ordFilterMaHang = ordFilterMau = ordFilterTrangThai = ordFilterThoiGian = '';
      renderOrders(perm);
    });

    // Ô tích từng dòng + chọn tất cả dòng ĐANG HIỆN.
    body.querySelectorAll('.ord-chon').forEach(cb => cb.addEventListener('change', capNhatDem));
    const chonTatCa = body.querySelector('#ordChonTatCa');
    if (chonTatCa) chonTatCa.addEventListener('change', () => {
      dongDangHien().forEach(tr => { const cb = tr.querySelector('.ord-chon'); if (cb) cb.checked = chonTatCa.checked; });
      capNhatDem();
    });

    /* v6.42: IN TỰ DO — bỏ hẳn việc "in xong thì chuyển sang Đã giao".
       Lịch sử: v5.44 gắn thao tác in với chuyển trạng thái vì lúc đó CHƯA có phiếu bán hàng, in phiếu
       giao hàng là mốc duy nhất đánh dấu hàng đã ra khỏi kho. Từ v6.23 phiếu bán hàng mới là chỗ DUY
       NHẤT trừ tồn (`banhang.js` ghi XuatCai) và ghi công nợ, nên nút in ở đây chỉ còn là in giấy:
         - không lọc bỏ đơn theo trạng thái (in được cả Chờ xác nhận / Đã xuất hàng / Đã hủy),
         - không gọi API đổi trạng thái,
         - không đụng gì tới tồn kho.
       Vì vậy KHÔNG cần re-render sau khi in — dữ liệu không đổi. */
    function inTheoDanhSach(rows, nhan) {
      if (!rows.length) { toast(`${nhan}: không có dòng nào để in.`, 'error'); return; }
      /* v6.42.1: BÁO RÕ ĐANG IN CÁI GÌ. Trước đây in xong không biết phiếu đã nuốt mất dòng nào —
         phải mở từng trang ra đếm tay. Nay hiện luôn: bao nhiêu đơn, mấy khách, mỗi trạng thái mấy
         đơn. Số này lấy NGAY TRƯỚC khi dựng phiếu nên nếu phiếu in ra ít hơn thì lỗi nằm ở khâu
         dựng phiếu, còn nếu số này đã ít rồi thì lỗi ở khâu chọn dòng. */
      const soKhach = new Set(rows.map(o => o.TenKhach || '(không tên)')).size;
      const theoTT = new Map();
      rows.forEach(o => theoTT.set(o.TrangThai || '(trống)', (theoTT.get(o.TrangThai || '(trống)') || 0) + 1));
      const moTa = [...theoTT.entries()].map(([t, n]) => `${t}: ${n}`).join(', ');
      console.log(`[IN PHIẾU] ${nhan} — ${rows.length} đơn / ${soKhach} khách — ${moTa}`, rows);
      /* Dòng tóm tắt IN LÊN CHÍNH TỜ PHIẾU, không dùng toast: window.print() chặn luồng vẽ nên toast
         chưa kịp hiện đã bị hộp thoại in che — báo bằng toast ở đây là báo cho không ai đọc được. */
      const tomTat = `${nhan}: ${rows.length} đơn · ${soKhach} khách · ${moTa}`;
      /* v6.42.2: IN RA MỘT BẢNG KÊ DUY NHẤT, không xé theo khách nữa.
         Trước đây 2 nút này gọi printPhieuNhieuKhach() -> mỗi khách MỘT PHIẾU GIAO HÀNG, ngắt trang
         giữa các phiếu. Chọn 14 dòng của 14 khách thì ra 14 tờ, mỗi tờ đúng 1 dòng, và trên màn hình
         xem trước chỉ thấy trang 1 -> trông y như "in thiếu, chỉ ra 1 khách".
         Lý do cũ (phiếu giao hàng phải của MỘT khách vì khách ký nhận) chỉ đúng với phiếu giao hàng.
         Hai nút này nay là IN DANH SÁCH: in đúng những gì đang thấy trên màn hình, một bảng, có cột
         Khách, có tổng cuối bảng. Muốn phiếu giao hàng từng khách thì dùng nút "In phiếu" ở mỗi dòng. */
      printBangKeDon(rows, tomTat);
    }
    // v6.21: 1 dòng nhóm có thể chứa NHIỀU đơn -> lấy tất cả DonID trong data-ids.
    const btnInHien = body.querySelector('#btnInHien');
    if (btnInHien) btnInHien.addEventListener('click', () => {
      const ids = dongDangHien().flatMap(idsCuaDong);
      inTheoDanhSach(orders.filter(o => ids.includes(String(o.DonID))), 'Các dòng đang hiện');
    });
    const btnInChon = body.querySelector('#btnInChon');
    if (btnInChon) btnInChon.addEventListener('click', () => {
      const ids = Array.from(body.querySelectorAll('.ord-chon:checked')).flatMap(cb => (cb.dataset.ids || '').split(',').filter(Boolean));
      if (!ids.length) { toast('Chưa tích dòng nào. Tích ô đầu dòng, hoặc tích ở tiêu đề để chọn tất cả.', 'error'); return; }
      inTheoDanhSach(orders.filter(o => ids.includes(String(o.DonID))), 'Dòng đã chọn');
    });
    /* v6.21: XUẤT EXCEL — gửi ĐÚNG bộ lọc đang áp sang backend (backend gộp theo cùng khóa với màn hình).
       URL phải dựng LÚC BẤM, không dựng sẵn lúc render: bộ lọc chạy ở phía trình duyệt, link cũ sẽ xuất sai.
       v6.21.1 (sửa "xuất excel đang lỗi"): tải bằng fetch + Blob thay cho <a download="">.
         - <a download=""> để tên rỗng nên trình duyệt hay lưu thành file "export" KHÔNG có .xlsx -> Excel
           mở không được, trông y như lỗi xuất file. Nay ĐẶT THẲNG tên file.
         - Quan trọng hơn: nếu backend trả JSON lỗi thì trước đây nó cũng bị lưu thành .xlsx rỗng/hỏng,
           không ai thấy nguyên nhân. Nay kiểm tra content-type: JSON -> đọc message và toast ra đúng lỗi. */
    const btnXuatExcelDon = body.querySelector('#btnXuatExcelDon');
    if (btnXuatExcelDon) btnXuatExcelDon.addEventListener('click', async () => {
      const p = new URLSearchParams();
      if (ordFilterKhach) p.set('khach', ordFilterKhach);
      if (ordFilterMaHang) p.set('maHang', ordFilterMaHang);
      if (ordFilterMau) p.set('mau', ordFilterMau);
      if (ordFilterTrangThai) p.set('trangThai', ordFilterTrangThai);
      if (ordFilterThoiGian) p.set('tg', ordFilterThoiGian);
      const url = '/api/khohang/orders/export' + (p.toString() ? '?' + p.toString() : '');
      btnXuatExcelDon.disabled = true;
      const nhanCu = btnXuatExcelDon.textContent;
      btnXuatExcelDon.textContent = 'Đang xuất...';
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        const kieu = res.headers.get('content-type') || '';
        if (!res.ok || kieu.includes('application/json')) {
          let msg = 'HTTP ' + res.status;
          try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (e) { /* không phải JSON */ }
          throw new Error(msg);
        }
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'don_khach_dat_hang.xlsx';
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 10000);
        toast('Đã xuất Excel (theo bộ lọc đang áp).', 'success');
      } catch (err) {
        toast('Xuất Excel lỗi: ' + err.message, 'error');
      } finally {
        btnXuatExcelDon.disabled = false; btnXuatExcelDon.textContent = nhanCu;
      }
    });
    // In 1 đơn. v6.42: cũng chỉ in giấy — không đổi trạng thái, không đụng tồn kho.
    body.querySelectorAll('.act-inphieu').forEach(btn => btn.addEventListener('click', () => {
      const o = orders.find(x => String(x.DonID) === btn.dataset.id);
      if (!o) return;
      printPhieuDatHang(o.TenKhach, [o], false);
    }));
    // v5.46: xóa hẳn 1 đơn (hoàn tồn nếu đơn đang trừ tồn).
    body.querySelectorAll('.act-delete-order').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa đơn đặt hàng này? Tồn kho sẽ được hoàn lại nếu đơn đang trừ tồn.')) return;
      try { await apiDelete('/api/khohang/orders/' + btn.dataset.id); toast('Đã xóa đơn.', 'success'); renderOrders(perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
    // v5.49: sửa 1 đơn.
    body.querySelectorAll('.act-edit-order').forEach(btn => btn.addEventListener('click', () => {
      const o = orders.find(x => String(x.DonID) === btn.dataset.id);
      if (o) openOrderEditModal(o, items, chiTiet, khachList, perm);
    }));

    /* v6.23: "Chuyển sang phiếu bán hàng" — lấy các đơn ĐANG TÍCH (nếu không tích thì lấy các dòng
       đang hiện), yêu cầu cùng MỘT khách vì 1 phiếu bán hàng chỉ của 1 khách (khách ký nhận trên phiếu). */
    const btnSangPhieuBH = body.querySelector('#btnSangPhieuBH');
    if (btnSangPhieuBH) btnSangPhieuBH.addEventListener('click', async () => {
      const chon = Array.from(body.querySelectorAll('.ord-chon:checked')).flatMap(cb => (cb.dataset.ids || '').split(',').filter(Boolean));
      const ids = (chon.length ? chon : dongDangHien().flatMap(idsCuaDong)).map(Number);
      const ds = orders.filter(o => ids.includes(Number(o.DonID)));
      const duocXuat = ds.filter(o => (o.TrangThai === 'Chờ xử lý' || o.TrangThai === 'Chờ xác nhận') && !o.PhieuBHID);
      if (!duocXuat.length) {
        toast('Không có đơn nào ở trạng thái "Chờ xử lý"/"Chờ xác nhận" để lên phiếu (đơn đã xuất hàng/đã hủy thì không).', 'error');
        return;
      }
      const khach = [...new Set(duocXuat.map(o => o.TenKhach))];
      if (khach.length > 1) {
        toast(`Đang chọn ${khach.length} khách khác nhau. Một phiếu bán hàng chỉ của MỘT khách — hãy lọc theo 1 khách rồi làm lại.`, 'error');
        return;
      }
      if (duocXuat.length < ds.length) toast(`Bỏ qua ${ds.length - duocXuat.length} đơn không ở trạng thái chờ.`, 'info');
      openChonDonModal(perm, khach[0]).catch(err => toast(err.message, 'error'));
    });

    applyOrderFilters();
    // openOrderForm nay là async (nạp danh mục khách) -> phải .catch kẻo lỗi làm "bấm nút không có gì xảy ra".
    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () =>
      openOrderForm(items, chiTiet, khachList).catch(err => toast(err.message, 'error')));
  }

  // v5.65: dòng ghi chú "BẢN IN LẠI" cho phiếu của đơn ĐÃ GIAO (in lại không đổi trạng thái).
  const ghiChuInLai = (inLai) => inLai
    ? '<div style="text-align:center;font-size:12px;color:#a00;margin-bottom:8px;">(BẢN IN LẠI — đơn đã giao)</div>' : '';

  /* v5.81: in NHIỀU dòng có thể thuộc NHIỀU KHÁCH — gom theo khách, mỗi khách 1 phiếu riêng, ngắt
     trang giữa các phiếu. Một phiếu giao hàng chỉ được của MỘT khách (khách ký nhận trên phiếu). */
  /* v6.42.1: `tomTat` = dòng nhỏ ghi rõ lần in này gồm bao nhiêu đơn / mấy khách / mỗi trạng thái mấy
     đơn. In thẳng lên phiếu để đối chiếu ngay với số dòng đã tích trên màn hình — thiếu dòng nào là
     thấy liền, khỏi phải đếm tay từng trang. */
  const dongTomTat = (tomTat) => tomTat
    ? `<div style="text-align:center;font-size:11px;color:#5f6368;margin-bottom:8px;">${escapeHtml(tomTat)}</div>` : '';

  /* v6.42.2: BẢNG KÊ ĐƠN ĐẶT HÀNG — in NGUYÊN danh sách đang xem thành MỘT bảng (khổ ngang).
     Gộp bằng gopDonKhach() nên số dòng và số lượng khớp đúng màn hình + file Excel.
     Tổng số lượng tách theo TỪNG ĐƠN VỊ (Ri/Cái/Bộ không cộng chung được), kèm tổng quy ra Cái và
     tổng tiền — quy ra Cái mới cộng chung được vì giá lưu theo Cái. */
  function printBangKeDon(rows, tomTat) {
    const ds = gopDonKhach(rows);
    const cai = r => slSangCai(r.SoLuongDat, r.DonVi, r.LoaiRi, r);
    const tongCai = ds.reduce((s, r) => s + cai(r), 0);
    const tongTien = ds.reduce((s, r) => s + cai(r) * (Number(r.GiaBan) || 0), 0);
    const theoDV = new Map();
    ds.forEach(r => theoDV.set(r.DonVi || '(không ghi)', (theoDV.get(r.DonVi || '(không ghi)') || 0) + (Number(r.SoLuongDat) || 0)));
    const dongTongDV = [...theoDV.entries()].map(([dv, sl]) => `${fmtNumber(sl)} ${dv}`).join(' · ');
    const bang = `<table><thead><tr>
        <th>STT</th><th>Thời gian</th><th>Khách</th><th>Mã hàng</th><th>Màu</th>
        <th style="text-align:right;">SL</th><th>Đơn vị</th><th style="text-align:right;">SL (Cái)</th>
        <th style="text-align:right;">Giá bán<div style="font-weight:400;font-size:10px;">(đ/Cái)</div></th>
        <th style="text-align:right;">Thành tiền</th><th>Trạng thái</th></tr></thead>
      <tbody>${ds.map((r, i) => `<tr>
        <td>${i + 1}</td><td>${escapeHtml(r.Ngay || '')}</td><td>${escapeHtml(r.TenKhach || '')}</td>
        <td>${escapeHtml(r.MaHang || '')}</td><td>${escapeHtml(r.TenMau || '')}</td>
        <td style="text-align:right;">${fmtNumber(r.SoLuongDat)}</td><td>${escapeHtml(r.DonVi || '')}</td>
        <td style="text-align:right;">${fmtNumber(cai(r))}</td>
        <td style="text-align:right;">${fmtNumber(r.GiaBan)}</td>
        <td style="text-align:right;">${fmtNumber(cai(r) * (Number(r.GiaBan) || 0))}</td>
        <td>${escapeHtml([...new Set(r.dons.map(d => d.TrangThai))].join(', '))}</td></tr>`).join('')}
        <tr><td colspan="5" style="text-align:right;"><b>TỔNG CỘNG (${ds.length} dòng)</b></td>
          <td colspan="2"><b>${escapeHtml(dongTongDV)}</b></td>
          <td style="text-align:right;"><b>${fmtNumber(tongCai)}</b></td>
          <td></td><td style="text-align:right;"><b>${fmtNumber(tongTien)}</b></td><td></td></tr>
      </tbody></table>`;
    printHtml('Bảng kê đơn đặt hàng', `
      <h2 style="text-align:center;margin:0 0 4px;">BẢNG KÊ ĐƠN ĐẶT HÀNG</h2>
      <div style="text-align:center;margin-bottom:10px;">${fmtNgayThangNam(new Date())}</div>
      ${dongTomTat(tomTat)}
      ${bang}`, { extraStyle: '@page{size:A4 landscape;margin:10mm;} th,td{font-size:11.5px;padding:4px 6px;}' });
  }

  function printPhieuNhieuKhach(rows, inLai, tomTat) {
    const theoKhach = new Map();
    rows.forEach(r => {
      const k = r.TenKhach || '(không tên)';
      if (!theoKhach.has(k)) theoKhach.set(k, []);
      theoKhach.get(k).push(r);
    });
    if (theoKhach.size === 1) {
      const [k, ds] = [...theoKhach.entries()][0];
      printPhieuDatHang(k, ds, inLai, tomTat);
      return;
    }
    const khoi = [...theoKhach.entries()].map(([k, ds], i) => `
      <div style="${i ? 'page-break-before:always;' : ''}">
        <h2 style="text-align:center;margin:0 0 4px;">PHIẾU GIAO HÀNG</h2>
        <div style="text-align:center;margin-bottom:10px;">${fmtNgayThangNam(new Date())}</div>
        ${dongTomTat(tomTat ? `${tomTat} — phiếu ${i + 1}/${theoKhach.size}` : '')}
        ${ghiChuInLai(inLai)}
        <p><b>Khách hàng:</b> ${escapeHtml(k)}</p>
        ${bangKeHtml(ds, 'MaHang', 'Mã hàng')}
        <div class="p-sign"><div><div class="line">Người giao hàng</div></div><div><div class="line">Người nhận hàng</div></div></div>
      </div>`).join('');
    printHtml(`Phiếu giao hàng (${theoKhach.size} khách)`, khoi);
  }

  /* v6.21: BẢNG KÊ dùng chung cho mọi phiếu giao hàng.
     - GỘP các đơn cùng (ngày + khách + mã hàng + màu + đơn vị) qua gopDonKhach() — ĐÚNG cách gộp của
       danh sách trên màn hình và của file Excel, nên 3 nơi không thể lệch số.
     - Thêm 3 cột giá: Giá bán, Giá sau CK shop, Giá sau CK NPP (tính từ Giá bán + tỷ lệ dùng chung).
     `cotDau` = 'MaHang' (phiếu theo khách) hoặc 'TenKhach' (phiếu theo mã hàng). */
  function bangKeHtml(rows, cotDau, nhanCotDau) {
    const ds = gopDonKhach(rows);
    const tong = ds.reduce((s, r) => s + slSangCai(r.SoLuongDat, r.DonVi, r.LoaiRi, r), 0);
    return `<table><thead><tr><th>STT</th><th>${escapeHtml(nhanCotDau)}</th><th>Màu</th><th>SL</th><th>Đơn vị</th>
        <th>SL (Cái)</th>
        <th>Giá bán<div style="font-weight:400;font-size:10px;">(đ/Cái)</div></th>
        <th>Giá sau CK shop<div style="font-weight:400;font-size:10px;">(đ/Cái · CK ${fmtNumber(tyLeCK.shop)}%)</div></th>
        <th>Giá sau CK NPP<div style="font-weight:400;font-size:10px;">(đ/Cái · CK ${fmtNumber(tyLeCK.npp)}% trên giá shop)</div></th></tr></thead>
      <tbody>${ds.map((r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r[cotDau] || '')}</td><td>${escapeHtml(r.TenMau)}</td>
        <td>${fmtNumber(r.SoLuongDat)}</td><td>${escapeHtml(r.DonVi)}</td>
        <td>${fmtNumber(slSangCai(r.SoLuongDat, r.DonVi, r.LoaiRi, r))}</td>
        <td>${fmtNumber(r.GiaBan)}</td><td>${fmtNumber(giaShopSauCK(r.GiaBan))}</td><td>${fmtNumber(giaNPPSauCK(r.GiaBan))}</td></tr>`).join('')}
        <tr><td colspan="5" style="text-align:right;"><b>Tổng SL (Cái)</b></td><td><b>${fmtNumber(tong)}</b></td><td colspan="3"></td></tr></tbody></table>`;
  }

  // v5.44: in "Phiếu giao hàng" cho 1 khách (1 hoặc nhiều dòng đơn). Dùng printHtml chung (có letterhead).
  function printPhieuDatHang(tenKhach, rows, inLai, tomTat) {
    printHtml('Phiếu giao hàng - ' + (tenKhach || ''), `
      <h2 style="text-align:center;margin:0 0 4px;">PHIẾU GIAO HÀNG</h2>
      <div style="text-align:center;margin-bottom:10px;">${fmtNgayThangNam(new Date())}</div>
      ${dongTomTat(tomTat)}
      ${ghiChuInLai(inLai)}
      <p><b>Khách hàng:</b> ${escapeHtml(tenKhach || '')}</p>
      ${bangKeHtml(rows, 'MaHang', 'Mã hàng')}
      <div class="p-sign"><div><div class="line">Người giao hàng</div></div><div><div class="line">Người nhận hàng</div></div></div>`);
  }

  // v5.51: in "Phiếu giao hàng" theo MÃ HÀNG (nhiều khách) — cột Khách thay cho Mã hàng.
  function printPhieuDatHangByMaHang(maHang, rows, inLai) {
    printHtml('Phiếu giao hàng - ' + (maHang || ''), `
      <h2 style="text-align:center;margin:0 0 4px;">PHIẾU GIAO HÀNG</h2>
      <div style="text-align:center;margin-bottom:10px;">${fmtNgayThangNam(new Date())}</div>
      ${ghiChuInLai(inLai)}
      <p><b>Mã hàng:</b> ${escapeHtml(maHang || '')}</p>
      ${bangKeHtml(rows, 'TenKhach', 'Khách')}
      <div class="p-sign"><div><div class="line">Người giao hàng</div></div><div><div class="line">Người nhận hàng</div></div></div>`);
  }

  // v5.0 (muc 4c): chi hien nhung ma hang CON TON (TongTon > 0) trong danh sach chon, va khi chon 1
  // ma hang thi danh sach mau chi con nhung mau THUOC ma hang do (truoc day hien tat ca mau trong
  // danh muc, de nham lan chon mau khong ton tai o ma hang).
  /* v6.23.2: THÊM NHANH KHÁCH HÀNG vào danh mục ngay trong lúc lên đơn / lên phiếu bán hàng.
     Trả về bản ghi khách vừa tạo (hoặc null nếu hủy). Dùng modal RIÊNG chồng lên form đang mở —
     app này KHÔNG chồng modal được (openModal thay thế modal cũ), nên dựng hộp thoại nhỏ tự quản lý. */
  function themKhachNhanh(tenGoiY) {
    return new Promise(resolve => {
      const bg = document.createElement('div');
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
      bg.innerHTML = `<div style="background:#fff;border-radius:8px;padding:16px;max-width:460px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,.3);">
        <h3 style="margin:0 0 10px;">Thêm khách hàng mới</h3>
        <form id="fKhachNhanh">
          <div class="form-row"><label>Tên khách hàng *</label><input id="knTen" required value="${escapeHtml(tenGoiY || '')}"></div>
          <div class="form-row"><label>Số điện thoại</label><input id="knSDT"></div>
          <div class="form-row"><label>Địa chỉ</label><input id="knDiaChi"></div>
          <div class="form-row"><label>Email</label><input id="knEmail"></div>
          <div class="modal-actions" style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
            <button type="button" class="btn secondary" id="knHuy">Hủy</button>
            <button type="submit" class="btn">Lưu khách</button>
          </div>
        </form></div>`;
      document.body.appendChild(bg);
      const dong = kq => { bg.remove(); resolve(kq); };
      bg.querySelector('#knHuy').addEventListener('click', () => dong(null));
      bg.addEventListener('click', e => { if (e.target === bg) dong(null); });
      bg.querySelector('#knTen').focus();
      bg.querySelector('#fKhachNhanh').addEventListener('submit', async e => {
        e.preventDefault();
        const ten = bg.querySelector('#knTen').value.trim();
        if (!ten) { toast('Chưa nhập tên khách.', 'error'); return; }
        const body = {
          TenKhachHang: ten, SDT: bg.querySelector('#knSDT').value.trim() || null,
          DiaChi: bg.querySelector('#knDiaChi').value.trim() || null,
          Email: bg.querySelector('#knEmail').value.trim() || null
        };
        try {
          await apiPost('/api/danhmuc/khachhang', body);
          // API tạo không trả ID -> đọc lại danh mục để lấy đúng bản ghi vừa tạo.
          const ds = (await apiGet('/api/danhmuc/khachhang')).data || [];
          const k = ds.filter(x => x.TenKhachHang === ten).sort((a, b) => b.KhachHangID - a.KhachHangID)[0];
          toast('Đã thêm khách hàng vào danh mục.', 'success');
          dong(k || { KhachHangID: '', TenKhachHang: ten, SDT: body.SDT, DiaChi: body.DiaChi });
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  }

  async function openOrderForm(allItems, chiTiet, khachList) {
    /* v6.89: lọc theo TỒN THỰC (gồm phiếu nhập kho), KHÔNG theo TongTon (chỉ phần thẻ kho) — nếu
       không thì hàng vừa nhập bằng phiếu sẽ không có trong danh sách chọn để đặt/bán. */
    const items = allItems.filter(i => Number(i.TongTonThuc != null ? i.TongTonThuc : i.TongTon) > 0);
    let rowCount = 0;
    // v5.57: options CÓ chọn sẵn (để nút "+ Thêm màu" giữ nguyên mã hàng của dòng đang đứng).
    function optionsSel(list, valKey, textKey, sel) {
      return (list || []).map(o => `<option value="${escapeHtml(String(o[valKey]))}"${String(o[valKey]) === String(sel) ? ' selected' : ''}>${escapeHtml(o[textKey] != null ? String(o[textKey]) : '')}</option>`).join('');
    }
    function colorOptionsFor(maHangId, sel) {
      const colors = chiTiet.filter(c => String(c.MaHangID) === String(maHangId));
      return colors.length ? optionsSel(colors, 'MauSacID', 'TenMau', sel) : '<option value="">-- Chưa có màu --</option>';
    }
    // v5.7: hien Anh dai dien (theo Ma hang) + Anh rieng theo mau (yeu cau v5.7 "Thẻ kho hàng hóa - Lên
    // đơn đặt hàng hiển thị ảnh sản phẩm + ảnh theo từng màu") - du lieu AnhDaiDien/LinkAnh DA CO SAN
    // tren items/chiTiet duoc truyen vao (cung du lieu da dung o renderItems()/openHistory() trong file
    // nay), day CHI la thieu render <img>, khong thieu du lieu.
    function findItem(maHangId) { return items.find(i => String(i.MaHangID) === String(maHangId)); }
    function findColor(maHangId, mauSacId) { return chiTiet.find(c => String(c.MaHangID) === String(maHangId) && String(c.MauSacID) === String(mauSacId)); }
    // v6.07: ô 40px -> dùng ảnh xem trước 80px, không tải file gốc.
    function imgTag(src) { return src ? `<img loading="lazy" decoding="async" src="${escapeHtml(anhNho(src, 80))}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">` : ''; }
    // v5.57 (yêu cầu "1 mã hàng thêm được nhiều màu"): rowTemplate nhận sẵn mã hàng + màu để nút
    // "+ Màu" nhân dòng NGAY DƯỚI dòng đang đứng, GIỮ NGUYÊN mã hàng, chỉ đổi màu. Mỗi dòng vẫn là
    // 1 (mã hàng, màu, SL) khi gửi lên -> KHÔNG đổi API/backend.
    function rowTemplate(preMaHang, preMau) {
      rowCount++;
      const itemId = (preMaHang !== undefined && preMaHang !== null && preMaHang !== '') ? preMaHang : (items.length ? items[0].MaHangID : '');
      const item = findItem(itemId);
      const colors = chiTiet.filter(c => String(c.MaHangID) === String(itemId));
      const colorId = (preMau !== undefined && preMau !== null && preMau !== '') ? preMau : (colors[0] ? colors[0].MauSacID : '');
      const color = findColor(itemId, colorId);
      return `<div class="form-grid" style="grid-template-columns:44px 1.3fr 44px 1fr .8fr .8fr auto auto;gap:8px;align-items:end;margin-bottom:8px;" data-orow>
        <div class="o-img-mahang">${imgTag(item && item.AnhDaiDien)}</div>
        <div><label>Mã hàng</label><select class="o-mahang">${items.length ? optionsSel(items, 'MaHangID', 'MaHang', itemId) : '<option value="">-- Không còn mã hàng nào tồn kho --</option>'}</select></div>
        <div class="o-img-mau">${imgTag(color && color.LinkAnh)}</div>
        <div><label>Màu</label><select class="o-mau">${colorOptionsFor(itemId, colorId)}</select></div>
        ${/* v6.24.4: ĐƠN VỊ mặc định là RI khi mã hàng có hệ số quy đổi > 1 — xưởng đặt hàng theo ri,
             trước đây mặc định "Cái" nên gõ 12 (ý là 12 ri) lại thành 12 cái, phiếu xuất & tồn sai theo.
             Kèm dòng QUY ĐỔI ngay dưới để nhìn là biết đang đặt bao nhiêu cái. */''}
        <div><label>Số lượng</label><input class="o-sl" type="number" min="1" value="1">
          <div class="o-quydoi" style="font-size:11px;color:#5f6368;"></div></div>
        ${/* v6.31: 2 lựa chọn = ĐVT chính + ĐVT quy đổi CỦA CHÍNH mã hàng (trước gõ cứng "Ri" —
             mã khai ĐVT quy đổi khác "Ri" thì backend không nhân hệ số, giữ hàng thiếu <tỷ lệ> lần). */''}
        <div><label>Đơn vị</label><select class="o-donvi">${dsDonViCua(item).map(dv =>
          `<option value="${escapeHtml(dv.giaTri)}" ${dv.macDinh ? 'selected' : ''}>${escapeHtml(dv.nhan)}</option>`).join('')}</select></div>
        <div><button type="button" class="btn small secondary o-addmau" title="Thêm 1 màu nữa cho ĐÚNG mã hàng này">+ Màu</button></div>
        <div><button type="button" class="btn small danger o-remove">X</button></div>
      </div>`;
    }
    /* v6.23.2: khách LẤY TỪ DANH MỤC KHÁCH HÀNG (không gõ tự do nữa) — chưa có thì "+ Khách mới"
       ngay tại đây, nhập đủ Tên / SĐT / Địa chỉ. Tên khách là khóa nhóm công nợ nên phải thống nhất. */
    const dsKhach = await apiGet('/api/danhmuc/khachhang').then(r => r.data || []).catch(() => []);
    const html = `
      <h3>Lên đơn đặt hàng</h3>
      <form id="ordForm">
        <div class="form-row"><label>Khách hàng *</label>
          <div style="display:flex;gap:6px;">
            <select id="ordKhachSel" style="flex:1;"><option value="">-- chọn khách trong danh mục --</option>${dsKhach.map(k => `<option value="${k.KhachHangID}">${escapeHtml(k.TenKhachHang)}${k.SDT ? ' · ' + escapeHtml(k.SDT) : ''}</option>`).join('')}</select>
            <button type="button" class="btn small secondary" id="ordThemKhach">+ Khách mới</button>
          </div>
          <input name="tenKhach" id="ordKhachTen" required readonly placeholder="Chọn khách ở trên" style="margin-top:4px;background:#f8f9fa;">
          <div class="empty-hint" id="ordKhachTT" style="margin-top:2px;"></div>
        </div>
        <div id="oRows">${rowTemplate()}</div>
        <div class="empty-hint" style="${items.length ? 'display:none;' : ''}">Không còn mã hàng nào còn tồn kho để lên đơn.</div>
        <button type="button" class="btn small secondary" id="btnAddO" style="${items.length ? '' : 'display:none;'}">+ Thêm sản phẩm</button>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn" ${items.length ? '' : 'disabled'}>Lưu đơn</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    // v6.23.2: chọn / thêm nhanh khách hàng
    const oSel = modal.querySelector('#ordKhachSel');
    function apKhachOrder(k) {
      modal.querySelector('#ordKhachTen').value = k ? k.TenKhachHang : '';
      modal.querySelector('#ordKhachTT').innerHTML = k
        ? `SĐT: ${escapeHtml(k.SDT || '—')} · Địa chỉ: ${escapeHtml(k.DiaChi || '—')}`
        : 'Chưa có trong danh mục? Bấm <b>+ Khách mới</b>.';
    }
    oSel.addEventListener('change', () => apKhachOrder(dsKhach.find(x => String(x.KhachHangID) === oSel.value)));
    apKhachOrder(null);
    modal.querySelector('#ordThemKhach').addEventListener('click', async () => {
      const k = await themKhachNhanh('');
      if (!k) return;
      dsKhach.push(k);
      oSel.insertAdjacentHTML('beforeend', `<option value="${k.KhachHangID}">${escapeHtml(k.TenKhachHang)}</option>`);
      oSel.value = String(k.KhachHangID);
      apKhachOrder(k);
    });
    function wireRow(rowEl) {
      const mahangSel = rowEl.querySelector('.o-mahang');
      const mauSel = rowEl.querySelector('.o-mau');
      const slInp = rowEl.querySelector('.o-sl');
      const dvSel = rowEl.querySelector('.o-donvi');
      const quyDoi = rowEl.querySelector('.o-quydoi');
      function refreshMauImg() {
        const color = findColor(mahangSel.value, mauSel.value);
        rowEl.querySelector('.o-img-mau').innerHTML = imgTag(color && color.LinkAnh);
      }
      /* v6.24.4: luôn cho thấy đang đặt bao nhiêu CÁI (và ngược lại) để không nhầm đơn vị. */
      function veQuyDoi() {
        const item = findItem(mahangSel.value) || {};
        const he = Number(item.LoaiRi) || 1;
        const n = Number(slInp.value) || 0;
        if (he <= 1 || !n) { quyDoi.textContent = ''; return; }
        const dvG = dvGocCua(findItem(rowEl.querySelector('.o-mahang').value));
        quyDoi.innerHTML = laDonViGop(dvSel.value, findItem(rowEl.querySelector('.o-mahang').value))
          ? `= <b>${fmtNumber(n * he)}</b> ${escapeHtml(dvG)}`
          : `= <b>${fmtNumber(Math.floor(n / he))}</b> Ri${he}${n % he ? ' dư ' + fmtNumber(n % he) : ''}`;
      }
      mahangSel.addEventListener('change', () => {
        rowEl.querySelector('.o-mau').innerHTML = colorOptionsFor(mahangSel.value);
        const item = findItem(mahangSel.value);
        rowEl.querySelector('.o-img-mahang').innerHTML = imgTag(item && item.AnhDaiDien);
        // Đổi mã hàng -> đặt lại đơn vị mặc định + nhãn Ri theo hệ số của mã MỚI.
        // v6.31: đổi mã hàng -> vẽ lại CẢ 2 option theo đơn vị của mã mới (số option có thể khác).
        const ds = dsDonViCua(item);
        dvSel.innerHTML = ds.map(dv => `<option value="${escapeHtml(dv.giaTri)}">${escapeHtml(dv.nhan)}</option>`).join('');
        const mac = ds.find(x => x.macDinh) || ds[0];
        dvSel.value = mac.giaTri;
        refreshMauImg(); veQuyDoi();
      });
      mauSel.addEventListener('change', refreshMauImg);
      slInp.addEventListener('input', veQuyDoi);
      dvSel.addEventListener('change', veQuyDoi);
      veQuyDoi();
    }
    function wireRemove() {
      modal.querySelectorAll('.o-remove').forEach(btn => btn.onclick = () => {
        if (modal.querySelectorAll('#oRows > div').length > 1) btn.closest('[data-orow]').remove();
      });
    }
    // v5.57: "+ Màu" — chèn dòng mới NGAY DƯỚI, cùng mã hàng, tự chọn màu CHƯA dùng của mã hàng đó.
    function wireAddMau() {
      modal.querySelectorAll('.o-addmau').forEach(btn => btn.onclick = () => {
        const rowEl = btn.closest('[data-orow]');
        const maHangId = rowEl.querySelector('.o-mahang').value;
        const daDung = Array.from(modal.querySelectorAll('#oRows [data-orow]'))
          .filter(r => String(r.querySelector('.o-mahang').value) === String(maHangId))
          .map(r => String(r.querySelector('.o-mau').value));
        const colors = chiTiet.filter(c => String(c.MaHangID) === String(maHangId));
        const conLai = colors.find(c => daDung.indexOf(String(c.MauSacID)) === -1);
        if (!colors.length) { toast('Mã hàng này chưa có màu nào trong thẻ kho.', 'error'); return; }
        if (!conLai) { toast('Đã thêm hết các màu của mã hàng này.', 'error'); return; }
        rowEl.insertAdjacentHTML('afterend', rowTemplate(maHangId, conLai.MauSacID));
        wireAllRows();
      });
    }
    function wireAllRows() {
      modal.querySelectorAll('#oRows [data-orow]').forEach(wireRow);
      wireRemove();
      wireAddMau();
    }
    wireAllRows();
    modal.querySelector('#btnAddO').addEventListener('click', () => {
      modal.querySelector('#oRows').insertAdjacentHTML('beforeend', rowTemplate());
      wireAllRows();
    });

    modal.querySelector('#ordForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const orderItems = Array.from(modal.querySelectorAll('#oRows > div')).map(r => ({
        maHangId: r.querySelector('.o-mahang').value, mauSacId: r.querySelector('.o-mau').value,
        soLuong: r.querySelector('.o-sl').value, donVi: r.querySelector('.o-donvi').value
      }));
      // v5.57: chặn trùng (mã hàng + màu) — 1 mã hàng nhiều màu là ĐÚNG, nhưng cùng 1 màu 2 dòng thì sai.
      const key = it => String(it.maHangId) + '|' + String(it.mauSacId);
      const seen = {};
      for (const it of orderItems) {
        if (seen[key(it)]) { toast('Có 2 dòng trùng cùng mã hàng + cùng màu. Hãy gộp số lượng hoặc đổi màu.', 'error'); return; }
        seen[key(it)] = true;
      }
      if (orderItems.some(it => !it.mauSacId)) { toast('Có dòng chưa chọn màu.', 'error'); return; }
      try {
        await apiPost('/api/khohang/orders', { tenKhach: fd.get('tenKhach'), items: orderItems });
        closeModal(); toast('Đã lên đơn.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.49: SỬA 1 đơn đặt hàng — khách gõ tự do/chọn list; mã hàng/màu/SL/đơn vị; backend tính lại tồn.
  function openOrderEditModal(order, allItems, chiTiet, khachList, perm, onDone) {
    function colorOptionsFor(maHangId, selMau) {
      const colors = chiTiet.filter(c => String(c.MaHangID) === String(maHangId));
      return colors.length ? opt(colors, 'MauSacID', 'TenMau', selMau) : '<option value="">-- Chưa có màu --</option>';
    }
    /* v6.31: 2 lựa chọn đơn vị của form Sửa đơn = ĐVT chính + ĐVT quy đổi CỦA CHÍNH mã hàng đó.
       `order` đến từ danh sách đơn (đã kèm DonViCoBan/DonViQuyDoi/LoaiRi); thiếu thì lùi về mã hàng
       trong `allItems`, thiếu nữa thì mới lấy mặc định Cái/Ri. */
    const mhCuaDon = (allItems || []).find(x => String(x.MaHangID) === String(order.MaHangID)) || {};
    const dvChinhDon = order.DonViCoBan || mhCuaDon.DonViCoBan || 'Cái';
    const dvQuyDoiDon = order.DonViQuyDoi || mhCuaDon.DonViQuyDoi || 'Ri';
    const dsDonViDon = [...new Set([dvChinhDon, dvQuyDoiDon, order.DonVi].filter(Boolean))];

    const modal = openModal(`
      <h3>Sửa đơn đặt hàng #${order.DonID}</h3>
      <form id="ordEditForm">
        <div class="form-row"><label>Tên khách *</label><input name="tenKhach" list="dlKhachEdit" value="${escapeHtml(order.TenKhach || '')}" required autocomplete="off" placeholder="Gõ tự do hoặc chọn khách có sẵn"><datalist id="dlKhachEdit">${(khachList || []).map(k => `<option value="${escapeHtml(k)}"></option>`).join('')}</datalist></div>
        <div class="form-grid" style="grid-template-columns:1.3fr 1fr .7fr .7fr;gap:8px;align-items:end;">
          <div><label>Mã hàng</label><select class="oe-mahang">${opt(allItems, 'MaHangID', 'MaHang', order.MaHangID)}</select></div>
          <div><label>Màu</label><select class="oe-mau">${colorOptionsFor(order.MaHangID, order.MauSacID)}</select></div>
          <div><label>Số lượng</label><input class="oe-sl" type="number" min="1" value="${order.SoLuongDat}">
            <div class="oe-quydoi" style="font-size:11px;color:#5f6368;"></div></div>
          ${/* v6.31: 2 lựa chọn = ĐVT chính và ĐVT quy đổi CỦA CHÍNH mã hàng đó (không gõ cứng Cái/Ri). */''}
          <div><label>Đơn vị</label><select class="oe-donvi">${
            dsDonViDon.map(dv => `<option value="${escapeHtml(dv)}" ${String(order.DonVi) === String(dv) ? 'selected' : ''}>${escapeHtml(dv)}</option>`).join('')
          }</select></div>
        </div>
        <p class="empty-hint">Sửa xong tồn kho được tính lại (hoàn số cũ, trừ số mới). Đơn "Đã hủy" chỉ sửa thông tin, không đụng tồn.</p>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="oeCancel">Hủy</button>
          <button type="submit" class="btn">💾 Lưu</button>
        </div>
      </form>`);
    modal.querySelector('#oeCancel').addEventListener('click', closeModal);
    const mh = modal.querySelector('.oe-mahang'), mau = modal.querySelector('.oe-mau');
    // v6.24.4: hiện quy đổi Ri <-> Cái ngay khi sửa, để không lưu nhầm đơn vị.
    const oeSl = modal.querySelector('.oe-sl'), oeDv = modal.querySelector('.oe-donvi'), oeQd = modal.querySelector('.oe-quydoi');
    function veQuyDoiSua() {
      const it = (allItems || []).find(x => String(x.MaHangID) === String(mh.value)) || {};
      const he = Number(it.LoaiRi) || 1, n = Number(oeSl.value) || 0;
      if (he <= 1 || !n) { oeQd.textContent = ''; return; }
      oeQd.innerHTML = laDonViGop(oeDv.value, { DonViCoBan: dvChinhDon, DonViQuyDoi: dvQuyDoiDon })
        ? `= <b>${fmtNumber(n * he)}</b> Cái`
        : `= <b>${fmtNumber(Math.floor(n / he))}</b> Ri${he}${n % he ? ' dư ' + fmtNumber(n % he) : ''}`;
    }
    mh.addEventListener('change', () => { mau.innerHTML = colorOptionsFor(mh.value, ''); veQuyDoiSua(); });
    oeSl.addEventListener('input', veQuyDoiSua);
    oeDv.addEventListener('change', veQuyDoiSua);
    veQuyDoiSua();
    modal.querySelector('#ordEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiPut('/api/khohang/orders/' + order.DonID, {
          tenKhach: fd.get('tenKhach'), maHangId: mh.value, mauSacId: mau.value,
          soLuong: modal.querySelector('.oe-sl').value, donVi: modal.querySelector('.oe-donvi').value
        });
        closeModal(); toast('Đã sửa đơn.', 'success'); if (onDone) onDone(); else renderOrders(perm);   // v5.51: onDone để mở lại Lịch sử mã hàng
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ============ BAO GIA ALOHA (v5.17, muc 1.2) ============
  // Danh sach bao gia da tao (muc 1.2.2) + nut mo form tao moi (muc 1.2.1). Xuat Excel dung the <a
  // href> thang toi route backend (giong dung tien le "⬇️ Tải file mẫu Excel" o module.qlsx.js) -
  // trinh duyet tu tai file qua session cookie hien co, khong can goi fetch/blob rieng.
  async function renderBaoGiaAloha(perm) {
    const body = document.getElementById('khBody');
    const res = await apiGet('/api/khohang/baogia');
    const list = res.data;
    body.innerHTML = `
      <div class="card" style="margin-bottom:12px;">
        <p style="margin-top:0;color:#5f6368;">Chọn mã hàng từ Thẻ kho hàng hóa để lập báo giá gửi Aloha. Mỗi mã hàng chỉ được đưa vào ĐÚNG 1 báo giá trong toàn hệ thống — mã đã có trong 1 báo giá sẽ không hiện ra khi tạo báo giá mới nữa.</p>
        ${perm.canCreate ? '<button class="btn" id="btnNewBaoGia">+ Tạo báo giá mới</button>' : ''}
      </div>
      <table><thead><tr><th>Tên báo giá</th><th>Ngày tạo</th><th>Tên NCC</th><th>Số mã hàng</th><th>Người tạo</th><th style="width:190px">Thao tác</th></tr></thead>
      <tbody>${list.map(b => `
        <tr>
          <td>${escapeHtml(b.TenBaoGia || '(không tên)')}</td>
          <td>${fmtDate(b.NgayTao)}</td>
          <td>${escapeHtml(b.TenNCC || '')}</td>
          <td>${b.SoLuongMaHang}</td>
          <td>${escapeHtml(b.NguoiTao || '')}</td>
          <td>
            <button type="button" class="btn small secondary act-view-baogia" data-id="${b.ID}">Xem/In</button>
            ${perm.canEdit ? `<button type="button" class="btn small secondary act-edit-baogia" data-id="${b.ID}">Sửa</button>` : ''}
            <a class="btn small secondary" href="/api/khohang/baogia/${b.ID}/export">⬇️ Xuất Excel</a>
            ${perm.canDelete ? `<button type="button" class="btn small danger act-del-baogia" data-id="${b.ID}" data-ten="${escapeHtml(b.TenBaoGia || 'báo giá #' + b.ID)}">Xóa</button>` : ''}
          </td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty-hint">Chưa có báo giá nào.</td></tr>'}</tbody></table>`;

    const btnNew = document.getElementById('btnNewBaoGia');
    if (btnNew) btnNew.addEventListener('click', async () => {
      try {
        const candRes = await apiGet('/api/khohang/baogia/candidates');
        openBaoGiaForm(candRes.data);
      } catch (err) { toast(err.message, 'error'); }
    });

    // v5.18 (muc 2.1.1, yeu cau "Bảng danh sách báo giá thêm chức năng xem, in"): dung LAI dung pattern
    // "Xem/In" da co san o module.khovai.js/module.phukien.js (Phieu nhap/xuat kho vai/phu kien) - 1 nut
    // mo modal xem chi tiet TREN MAN HINH, ben trong modal co them nut "In phieu" rieng (printHtml() dung
    // chung, khong phai xuat Excel) - xem openBaoGiaDetailModal()/printBaoGiaFromData() o duoi.
    body.querySelectorAll('.act-view-baogia').forEach(btn => btn.addEventListener('click', () => openBaoGiaDetailModal(btn.dataset.id)));

    // v5.19 (muc 2.1, yeu cau "Tạo báo giá Aloha: thêm chức năng sửa"): lay CA chi tiet bao gia hien co
    // (header + items - de biet ma hang nao DA chon + %VAT dang dung) VA danh sach candidates VOI
    // excludeBaoGiaId=id (de cac ma hang DANG thuoc chinh bao gia nay van hien ra, chon san) - roi mo
    // LAI form Tao (openBaoGiaForm) nhung truyen them existingBaoGia de chuyen sang che do Sua (PUT).
    body.querySelectorAll('.act-edit-baogia').forEach(btn => btn.addEventListener('click', async () => {
      try {
        const [detailRes, candRes] = await Promise.all([
          apiGet('/api/khohang/baogia/' + btn.dataset.id),
          apiGet('/api/khohang/baogia/candidates?excludeBaoGiaId=' + btn.dataset.id)
        ]);
        openBaoGiaForm(candRes.data, detailRes.data);
      } catch (err) { toast(err.message, 'error'); }
    }));

    // Xoa bao gia -> cascade xoa cac dong chi tiet (BaoGiaAlohaChiTiet.BaoGiaAlohaID ON DELETE CASCADE)
    // -> cac ma hang do "duoc tra lai", co the chon lai o bao gia sau (dung y muc dich cua nut Xoa nay).
    body.querySelectorAll('.act-del-baogia').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm(`Xóa báo giá "${btn.dataset.ten}"? Các mã hàng trong báo giá này sẽ có thể được chọn lại ở báo giá khác.`)) return;
      try { await apiDelete('/api/khohang/baogia/' + btn.dataset.id); toast('Đã xóa báo giá.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  /* v6.62: GIÁ BÁN trên thẻ kho là giá ĐÃ GỒM THUẾ. Nên chiều tính bị ĐẢO so với trước:
       Sau VAT   = chính giá bán  (không nhân thêm lần nữa)
       Trước VAT = giá bán / (1 + %VAT)
     Trước đây coi giá lấy vào là giá TRƯỚC thuế rồi nhân lên -> báo giá gửi khách bị cộng thuế
     HAI LẦN (giá 108.000 đã gồm 8% thành 116.640).
     PhanTramVAT lưu dạng PHÂN SỐ (0.08 = 8%) — khác Thẻ kho lưu 20 = 20%, đừng chép công thức qua lại.
     Dùng chung cho modal xem, bản in và Excel để 3 nơi không lệch nhau. */
  function baoGiaSauVat(it) {
    const gia = it.GiaAloha != null ? Number(it.GiaAloha) : null;
    return gia;   // giá bán đã gồm VAT
  }
  function baoGiaTruocVat(it) {
    const vat = Number(it.PhanTramVAT) || 0;
    const gia = it.GiaAloha != null ? Number(it.GiaAloha) : null;
    return gia != null ? gia / (1 + vat) : null;
  }

  // v5.18 (muc 2.1.1): modal "Xem" 1 bao gia - header (Ten bao gia/Ngay tao/Ten Cty SX-NK/Ma+Ten NCC/Ghi
  // chu, dung CHUNG cho ca bao gia - xem chu thich merge o backend/routes/khohang.js) + bang cac ma hang
  // (KHONG lam lai toan bo 28 cot cua file Excel xuat - chi cac cot co du lieu that, du de doi chieu
  // nhanh tren man hinh truoc khi quyet dinh Xuat Excel/In).
  async function openBaoGiaDetailModal(id) {
    const res = await apiGet('/api/khohang/baogia/' + id);
    const { header, items } = res.data;
    function itemsTableHtml() {
      return `<table><thead><tr><th>Mã hàng</th><th>Tên hàng</th><th>Mã Barcode</th><th>Giá trước VAT</th><th>% VAT</th><th>Sau VAT</th><th>Số mầu</th><th>Số cái/1 ri</th></tr></thead>
        <tbody>${items.map(it => `<tr>
          <td>${escapeHtml(it.MaHang)}</td><td>${escapeHtml(it.TenHang)}</td><td>${escapeHtml(it.MaBarcode || '')}</td>
          ${/* v6.62: cột "Giá trước VAT" = giá bán CHIA cho (1+VAT), không phải chính giá bán. */''}
          <td>${baoGiaTruocVat(it) != null ? fmtNumber(Math.round(baoGiaTruocVat(it))) : ''}</td><td>${it.PhanTramVAT != null ? fmtNumber(Number(it.PhanTramVAT) * 100) + '%' : ''}</td>
          <td>${baoGiaSauVat(it) != null ? fmtNumber(Math.round(baoGiaSauVat(it))) : ''}</td>
          <td>${it.SoMau}</td><td>${fmtNumber(it.LoaiRi)}</td>
        </tr>`).join('') || '<tr><td colspan="8" class="empty-hint">Báo giá chưa có mã hàng nào.</td></tr>'}</tbody></table>`;
    }
    const modal = openModal(`
      <h3>Báo giá Aloha — ${escapeHtml(header.TenBaoGia || '(không tên)')}</h3>
      <p class="p-meta"><b>Ngày tạo:</b> ${fmtDate(header.NgayTao)} &nbsp; <b>Người tạo:</b> ${escapeHtml(header.NguoiTao || '')}</p>
      <p class="p-meta"><b>Tên Công ty SX/NK:</b> ${escapeHtml(header.TenCongTySanXuatNhapKhau || '')} &nbsp; <b>Mã NCC:</b> ${escapeHtml(header.MaNCC || '')} &nbsp; <b>Tên NCC:</b> ${escapeHtml(header.TenNCC || '')}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      ${itemsTableHtml()}
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnCloseBaoGiaView">Đóng</button>
        <a class="btn secondary" href="/api/khohang/baogia/${header.ID}/export">⬇️ Xuất Excel</a>
        <button type="button" class="btn" id="btnPrintBaoGiaView">🖨️ In</button>
      </div>`);
    modal.querySelector('#btnCloseBaoGiaView').addEventListener('click', closeModal);
    modal.querySelector('#btnPrintBaoGiaView').addEventListener('click', () => printBaoGiaFromData(header, items));
  }

  // v5.18 (muc 2.1.1): ban in nhanh (khong phai file Excel dung template - xem "Xuất Excel" rieng) - dung
  // chung printHtml() (xem common.js, cung ho tro in Phieu nhap/xuat kho vai/phu kien) danh cho truong
  // hop can 1 ban giay/PDF nhanh de doi chieu, khong can mo Excel.
  function printBaoGiaFromData(header, items) {
    printHtml('Báo giá Aloha — ' + (header.TenBaoGia || ('#' + header.ID)), `
      <h2>DANH SÁCH CÁC MẶT HÀNG MỞ MÃ MỚI</h2>
      <p class="p-meta">${fmtNgayThangNam(header.NgayTao)}</p>
      <p class="p-meta"><b>Tên Công ty SX/NK:</b> ${escapeHtml(header.TenCongTySanXuatNhapKhau || '')}</p>
      <p class="p-meta"><b>Mã NCC:</b> ${escapeHtml(header.MaNCC || '')} &nbsp; <b>Tên NCC:</b> ${escapeHtml(header.TenNCC || '')}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      <table><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng</th><th>Mã Barcode</th><th>Giá trước VAT</th><th>% VAT</th><th>Sau VAT</th><th>Số mầu</th><th>Số cái/1 ri</th></tr></thead>
      <tbody>${items.map((it, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(it.MaHang)}</td><td>${escapeHtml(it.TenHang)}</td><td>${escapeHtml(it.MaBarcode || '')}</td>
        ${/* v6.62: xem ghi chú ở baoGiaTruocVat(). */''}
        <td>${baoGiaTruocVat(it) != null ? fmtNumber(Math.round(baoGiaTruocVat(it))) : ''}</td><td>${it.PhanTramVAT != null ? fmtNumber(Number(it.PhanTramVAT) * 100) + '%' : ''}</td>
        <td>${baoGiaSauVat(it) != null ? fmtNumber(Math.round(baoGiaSauVat(it))) : ''}</td><td>${it.SoMau}</td><td>${fmtNumber(it.LoaiRi)}</td></tr>`).join('')}</tbody></table>
      <div class="p-sign"><div><div class="line">Người đề nghị</div></div></div>`);
  }

  // v5.19 (muc 2.1): them tham so tuy chon prefill (đã chọn san - dung khi Sua, tu items cua bao gia
  // dang sua) - checkbox mac dinh CHECKED va %VAT lay tu du lieu cu thay vi mac dinh 8/disabled.
  function candRowHtml(c, prefill) {
    // v6.61: GiaAloha nay là ALIAS của Giá bán (xem khohang.js) -> đổi nhãn cho khỏi hiểu nhầm.
    const gia = c.GiaAloha != null ? `<span style="color:#5f6368;">(${fmtNumber(c.GiaAloha)}đ)</span>` : '<span style="color:#c0392b;">(chưa có Giá bán)</span>';
    const checked = !!prefill;
    const vatValue = prefill && prefill.PhanTramVAT != null ? Math.round(Number(prefill.PhanTramVAT) * 10000) / 100 : 8;
    return `<label class="bg-cand-row" data-search="${escapeHtml((c.MaHang + ' ' + c.TenHang).toLowerCase())}" style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #eee;">
      <input type="checkbox" class="bg-chk" value="${c.MaHangID}" ${checked ? 'checked' : ''}>
      <span style="flex:1;">${escapeHtml(c.MaHang)} — ${escapeHtml(c.TenHang)} ${gia}</span>
      <span style="white-space:nowrap;">VAT % <input type="number" class="bg-vat" value="${vatValue}" min="0" max="100" step="0.01" style="width:70px;" ${checked ? '' : 'disabled'}></span>
    </label>`;
  }

  // Form tao/sua 1 bao gia (muc 1.2.1 + v5.19 muc 2.1): header (Ten cong ty SX/NK, Ma NCC, Ten NCC -
  // dung CHUNG cho toan bo bao gia, xem chu thich merge o backend/routes/khohang.js) + danh sach chon
  // mã hang. "candidates" khi Sua PHAI duoc goi kem excludeBaoGiaId (xem act-edit-baogia o tren) de cac
  // ma hang dang thuoc CHINH bao gia nay van hien ra (chon san) thay vi bi "an" nham nhu da o bao gia
  // khac. "existingBaoGia" (tuy chon) = { header, items } cua bao gia dang sua -> chuyen form sang che
  // do Sua (tieu de + nut + goi PUT thay vi POST), prefill header + cac dong da chon.
  function openBaoGiaForm(candidates, existingBaoGia) {
    const isEdit = !!existingBaoGia;
    const header = isEdit ? existingBaoGia.header : null;
    const existingItemsByMaHangId = isEdit ? new Map(existingBaoGia.items.map(it => [String(it.MaHangID), it])) : new Map();
    const html = `
      <h3>${isEdit ? 'Sửa báo giá Aloha' : 'Tạo báo giá Aloha mới'}</h3>
      <form id="bgForm">
        <div class="form-grid">
          <div class="form-row"><label>Tên báo giá</label><input name="tenBaoGia" placeholder="VD: Báo giá đợt 1 - Tháng 7/2026" autocomplete="off" value="${escapeHtml((header && header.TenBaoGia) || '')}"></div>
          <div class="form-row"><label>Tên Công ty Sản Xuất/ Nhập Khẩu</label><input name="tenCongTySanXuatNhapKhau" autocomplete="off" value="${escapeHtml((header && header.TenCongTySanXuatNhapKhau) || '')}"></div>
          <div class="form-row"><label>Mã NCC</label><input name="maNCC" autocomplete="off" value="${escapeHtml((header && header.MaNCC) || '')}"></div>
          <div class="form-row"><label>Tên NCC</label><input name="tenNCC" autocomplete="off" value="${escapeHtml((header && header.TenNCC) || '')}"></div>
          <div class="form-row" style="grid-column:1/-1;"><label>Ghi chú</label><input name="ghiChu" autocomplete="off" value="${escapeHtml((header && header.GhiChu) || '')}"></div>
        </div>
        <hr>
        <div class="form-row">
          <label>Chọn mã hàng (${candidates.length} mã hàng có thể báo giá)</label>
          <input type="text" id="bgSearch" placeholder="Tìm theo mã hàng hoặc tên hàng..." autocomplete="off" style="margin-bottom:8px;">
        </div>
        <div id="bgCandList" style="max-height:320px;overflow:auto;border:1px solid #dcdfe3;border-radius:4px;">
          ${candidates.map(c => candRowHtml(c, existingItemsByMaHangId.get(String(c.MaHangID)))).join('') || '<div class="empty-hint" style="padding:10px;">Không còn mã hàng nào để báo giá — tất cả đã có trong báo giá khác.</div>'}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancelBg">Hủy</button>
          <button type="submit" class="btn" ${candidates.length ? '' : 'disabled'}>${isEdit ? 'Lưu thay đổi' : 'Lưu báo giá'}</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancelBg').addEventListener('click', closeModal);

    modal.querySelectorAll('.bg-chk').forEach(chk => chk.addEventListener('change', () => {
      chk.closest('.bg-cand-row').querySelector('.bg-vat').disabled = !chk.checked;
    }));

    const searchInput = modal.querySelector('#bgSearch');
    if (searchInput) searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      modal.querySelectorAll('.bg-cand-row').forEach(row => {
        row.style.display = (!q || row.dataset.search.includes(q)) ? 'flex' : 'none';
      });
    });

    modal.querySelector('#bgForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const items = Array.from(modal.querySelectorAll('.bg-chk:checked')).map(chk => ({
        maHangId: chk.value,
        // Nhap % (VD 8) tren giao dien -> luu duoi dang phan so (0.08) khop PhanTramVAT DECIMAL(5,4).
        phanTramVAT: (Number(chk.closest('.bg-cand-row').querySelector('.bg-vat').value) || 0) / 100
      }));
      if (!items.length) { toast('Chưa chọn mã hàng nào.', 'error'); return; }
      const payload = {
        tenBaoGia: fd.get('tenBaoGia') || null,
        tenCongTySanXuatNhapKhau: fd.get('tenCongTySanXuatNhapKhau') || 'Công ty TNHH thời trang MOYN',
        maNCC: fd.get('maNCC') || null,
        tenNCC: fd.get('tenNCC') || 'Công ty TNHH thời trang MOYN',
        ghiChu: fd.get('ghiChu') || 'Công ty TNHH thời trang MOYN',
        items
      };
      const submitBtn = modal.querySelector('button[type="submit"]');
      submitBtn.disabled = true; submitBtn.textContent = 'Đang lưu...';
      try {
        if (isEdit) await apiPut('/api/khohang/baogia/' + header.ID, payload);
        else await apiPost('/api/khohang/baogia', payload);
        closeModal(); toast('Đã lưu báo giá.', 'success'); render(container, currentUser);
      } catch (err) {
        toast(err.message, 'error');
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Lưu thay đổi' : 'Lưu báo giá';
      }
    });
  }

  /* ================================================================================================
     v6.23 — PHIẾU BÁN HÀNG (= "PHIẾU XUẤT KHO KIÊM BIÊN BẢN BÀN GIAO" theo mẫu Word của công ty)
     ------------------------------------------------------------------------------------------------
     Đây là chứng từ DUY NHẤT trừ tồn thành phẩm (từ v6.23 đơn khách đặt chỉ GIỮ hàng).
     Công thức đúng thứ tự mẫu Word:
       dòng:  Giá bán = Giá bán lẻ − Giá bán lẻ × %CK shop     ·  Thành tiền = Giá bán × SL
       phiếu: Tổng cộng → CK NPP (%×tổng) → Tổng tiền TT → VAT (%×TT) → Tổng tiền sau VAT
     v6.27: giá là giá 1 ĐƠN VỊ TÍNH CHÍNH của mã hàng (Cái hoặc Bộ). slSangCai()/SoLuongCai quy về
     đúng đơn vị đó nên PHÉP TÍNH KHÔNG ĐỔI — chỉ đổi cái NHÃN hiện ra trên form và bản in (xem dvGoc()).
     Mã quản theo 'Ri' (đơn vị GỘP) thì SoLuongCai vẫn là số cái, nên nhãn vẫn là "Cái".
     ================================================================================================ */
  let bhTyLe = { shop: 33, npp: 17, vat: 0 };
  /* v6.31: DANH MUC ĐƠN VỊ TÍNH là nguồn duy nhất cho mọi ô chọn đơn vị (Danh mục → Đơn vị tính).
     Tải 1 lần mỗi phiên; lỗi thì để rỗng — optDonVi() vẫn giữ giá trị đang lưu nên form không vỡ. */
  let dsDonViTinh = [];
  async function taiDonViTinh() {
    if (dsDonViTinh.length) return dsDonViTinh;
    try { dsDonViTinh = (await apiGet('/api/danhmuc/donvitinh')).data || []; }
    catch (e) {
      dsDonViTinh = [];
      /* v6.31: KHONG nuot loi. Khong co quyen xem Danh muc -> o don vi chi con dung gia tri dang luu,
         nguoi dung khong doi duoc ma khong hieu tai sao. Bao ro mot lan. */
      toast('Không tải được Danh mục đơn vị tính (' + e.message + ') — ô đơn vị chỉ hiện giá trị đang lưu. Cần quyền xem phân hệ Danh mục.', 'info');
    }
    return dsDonViTinh;
  }

  async function renderBanHang(perm) {
    const body = document.getElementById('khBody');
    body.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    let res;
    try { res = await apiGet('/api/banhang/phieu'); }
    catch (e) {
      body.innerHTML = `<div class="empty-hint">Không tải được danh sách phiếu bán hàng.<br><b>${escapeHtml(e.message)}</b><br><br>
        Nếu báo thiếu bảng/cột: hãy chạy <code>database/migration_v668.sql</code> rồi <code>pm2 restart qlnoibo</code>.
        Nếu báo không có quyền: cấp chức năng <b>Phiếu bán hàng</b> của phân hệ Thẻ kho hàng hóa trong Ma trận phân quyền.</div>`;
      return;
    }
    const rows = res.data || [];
    if (res.tyLe) bhTyLe = res.tyLe;
    const tongTT = rows.filter(r => r.TrangThai !== 'Đã hủy').reduce((s, r) => s + (Number(r.TongThanhToan) || 0), 0);
    const tongThu = rows.filter(r => r.TrangThai !== 'Đã hủy').reduce((s, r) => s + (Number(r.DaThu) || 0), 0);
    body.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        ${searchBoxHtml()}
        ${perm.canCreate ? '<button class="btn" id="btnPhieuMoi">+ Lập phiếu bán hàng</button>' : ''}
        ${perm.canCreate ? '<button class="btn secondary" id="btnTuDon">📋 Lấy từ đơn khách đặt</button>' : ''}
        ${/* v6.46: xuất Excel — lọc theo KHOẢNG NGÀY + trạng thái, để trống là lấy tất cả. */''}
        <span style="display:flex;gap:4px;align-items:center;">
          <label style="font-size:12px;color:#5f6368;">Từ</label><input type="date" id="bhTuNgay" style="width:140px;">
          <label style="font-size:12px;color:#5f6368;">đến</label><input type="date" id="bhDenNgay" style="width:140px;">
          <select id="bhTrangThai" data-nosearch style="width:130px;"><option value="">— Mọi trạng thái —</option><option value="Hoàn thành">Hoàn thành</option><option value="Đã hủy">Đã hủy</option></select>
          <button class="btn small secondary" id="btnXuatExcelBH">⬇️ Xuất Excel</button>
        </span>
        <span class="empty-hint" style="padding:0;margin-left:auto;">Tổng doanh thu (phiếu chưa hủy): <b>${fmtTien(tongTT)}</b> đ · đã thu <b>${fmtTien(tongThu)}</b> đ · còn phải thu <b style="color:#c0392b;">${fmtTien(tongTT - tongThu)}</b> đ</span>
      </div>
      ${/* v6.27: mỗi phiếu có thể gồm nhiều ĐVT chính khác nhau (Cái/Bộ) nên tiêu đề để trung tính. */''}
      <table><thead><tr><th>Số phiếu</th><th>Ngày</th><th>Khách hàng</th><th>Số dòng</th><th>Tổng SL</th>
        <th>Tiền hàng</th><th>CK NPP</th><th>Thuế GTGT</th><th>Tổng thanh toán</th><th>Đã thu</th><th>Trạng thái</th>
        ${/* v6.75: cột GHI CHÚ — thông tin giao hàng nằm ngay trên danh sách, khỏi mở từng phiếu ra xem. */''}
        <th>Ghi chú</th><th style="width:240px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr ${r.TrangThai === 'Đã hủy' ? 'style="background:#fdecea;"' : ''}>
        <td><a href="javascript:void(0)" class="act-xem" data-id="${r.PhieuBHID}"><b>${escapeHtml(r.SoPhieu)}</b></a></td>
        <td>${fmtDate(r.NgayBan)}</td><td>${escapeHtml(r.TenKhach)}</td>
        <td style="text-align:center;">${r.SoDong}</td><td style="text-align:right;">${fmtNumber(r.TongSLCai)}</td>
        <td style="text-align:right;">${fmtTien(r.TongTienHang)}</td>
        <td style="text-align:right;">${Number(r.TienCKNPP) ? fmtTien(r.TienCKNPP) + `<div style="font-size:11px;color:#5f6368;">${fmtNumber(r.PhanTramCKNPP)}%</div>` : ''}</td>
        <td style="text-align:right;">${Number(r.TienVAT) ? fmtTien(r.TienVAT) + `<div style="font-size:11px;color:#5f6368;">${fmtNumber(r.PhanTramVAT)}%</div>` : ''}</td>
        <td style="text-align:right;"><b>${fmtTien(r.TongThanhToan)}</b></td>
        <td style="text-align:right;">${fmtTien(r.DaThu)}${Number(r.DaThu) < Number(r.TongThanhToan) && r.TrangThai !== 'Đã hủy' ? `<div style="font-size:11px;color:#c0392b;">còn ${fmtTien(Number(r.TongThanhToan) - Number(r.DaThu))}</div>` : ''}</td>
        <td>${r.TrangThai === 'Đã hủy' ? '<span class="badge danger">Đã hủy</span>' : '<span class="badge success">Hoàn thành</span>'}</td>
        ${/* Ghi chú dài thì cắt bớt cho khỏi kéo giãn bảng, rê chuột xem đủ (title). */''}
        <td title="${escapeHtml(r.GhiChu || '')}" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(r.GhiChu || '')}</td>
        ${/* v6.47: xuất riêng 1 phiếu ra Excel (bố cục giống bản in). */''}
        <td><button class="btn small secondary act-in" data-id="${r.PhieuBHID}">🖨️ In</button>
          <button class="btn small secondary act-xls" data-id="${r.PhieuBHID}" data-sp="${escapeHtml(r.SoPhieu || '')}" title="Xuất phiếu này ra Excel">⬇️ Excel</button>
          ${perm.canEdit && r.TrangThai !== 'Đã hủy' && !Number(r.DaThu) ? `<button class="btn small secondary act-sua" data-id="${r.PhieuBHID}" title="Sửa phiếu (hoàn tồn cũ, trừ lại theo số mới)">Sửa</button>` : ''}
          ${perm.canEdit && r.TrangThai !== 'Đã hủy' ? `<button class="btn small secondary act-huy" data-id="${r.PhieuBHID}" title="Hủy phiếu và HOÀN TỒN KHO">Hủy</button>` : ''}
          ${perm.canDelete ? `<button class="btn small danger act-xoa" data-id="${r.PhieuBHID}">Xóa</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="13" class="empty-hint">Chưa có phiếu bán hàng nào</td></tr>'}</tbody></table>`;
    wireTableSearch(body);
    /* v6.23: 2 nút này gọi API bên trong hàm async — PHẢI .catch, kẻo lỗi (vd 403 vì chưa cấp quyền
       chức năng "Thẻ kho / Tồn kho") làm "bấm nút không có gì xảy ra" (bài học cũ của dự án). */
    const b1 = body.querySelector('#btnPhieuMoi');
    if (b1) b1.addEventListener('click', () => openPhieuBanHangForm(perm, []).catch(err => toast(err.message, 'error')));
    const b2 = body.querySelector('#btnTuDon');
    if (b2) b2.addEventListener('click', () => openChonDonModal(perm).catch(err => toast(err.message, 'error')));
    /* v6.46: tải bằng fetch + Blob (không dùng <a download>) — backend có thể trả JSON lỗi (hết quyền,
       thiếu bảng); <a download> sẽ lưu cục JSON đó thành .xlsx hỏng, mở lên không hiểu vì sao.
       Dò content-type để đọc đúng thông báo lỗi ra toast. Cùng cách với Xuất Excel đơn khách (v6.21.1). */
    const bx = body.querySelector('#btnXuatExcelBH');
    if (bx) bx.addEventListener('click', async () => {
      const p = new URLSearchParams();
      const tu = body.querySelector('#bhTuNgay').value;
      const den = body.querySelector('#bhDenNgay').value;
      const tt = body.querySelector('#bhTrangThai').value;
      if (tu && den && tu > den) { toast('Khoảng ngày không hợp lệ: ngày "Từ" đang sau ngày "đến".', 'error'); return; }
      if (tu) p.set('tuNgay', tu);
      if (den) p.set('denNgay', den);
      if (tt) p.set('trangThai', tt);
      bx.disabled = true;
      const nhanCu = bx.textContent;
      bx.textContent = 'Đang xuất...';
      try {
        const r = await fetch('/api/banhang/phieu/export' + (p.toString() ? '?' + p.toString() : ''), { credentials: 'same-origin' });
        const kieu = r.headers.get('content-type') || '';
        if (!r.ok || kieu.includes('application/json')) {
          let msg = 'HTTP ' + r.status;
          try { const j = await r.json(); if (j && j.message) msg = j.message; } catch (e) { /* không phải JSON */ }
          throw new Error(msg);
        }
        const blob = await r.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'phieu_ban_hang.xlsx';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        toast('Đã xuất Excel (2 sheet: Phiếu bán hàng + Chi tiết).', 'success');
      } catch (err) {
        toast('Xuất Excel lỗi: ' + err.message, 'error');
      } finally {
        bx.disabled = false; bx.textContent = nhanCu;
      }
    });
    body.querySelectorAll('.act-xem').forEach(a => a.addEventListener('click', () => xemPhieuBanHang(a.dataset.id, perm)));
    body.querySelectorAll('.act-in').forEach(b => b.addEventListener('click', async () => {
      const d = (await apiGet('/api/banhang/phieu/' + b.dataset.id)).data;
      printPhieuBanHang(d.header, d.chiTiet);
    }));
    // v6.47: xuất 1 phiếu ra Excel — cùng cách tải (fetch + Blob, dò content-type) với nút xuất danh sách.
    body.querySelectorAll('.act-xls').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        const r = await fetch('/api/banhang/phieu/' + b.dataset.id + '/export', { credentials: 'same-origin' });
        const kieu = r.headers.get('content-type') || '';
        if (!r.ok || kieu.includes('application/json')) {
          let msg = 'HTTP ' + r.status;
          try { const j = await r.json(); if (j && j.message) msg = j.message; } catch (e) { /* không phải JSON */ }
          throw new Error(msg);
        }
        const blob = await r.blob();
        /* v6.64: LẤY TÊN FILE DO SERVER ĐẶT (đã gồm số phiếu + tên khách). Trước đây gán đè ở đây
           nên tên khách server đặt bị vứt đi. Không đọc được header thì mới tự dựng. */
        const cd = r.headers.get('content-disposition') || '';
        const khop = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = khop ? decodeURIComponent(khop[1])
          : 'PhieuBanHang_' + String(b.dataset.sp || b.dataset.id).replace(/[^A-Za-z0-9_-]+/g, '_') + '.xlsx';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      } catch (err) {
        toast('Xuất Excel lỗi: ' + err.message, 'error');
      } finally { b.disabled = false; }
    }));
    body.querySelectorAll('.act-sua').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = (await apiGet('/api/banhang/phieu/' + b.dataset.id)).data;
        await openPhieuBanHangForm(perm, [], d);
      } catch (err) { toast(err.message, 'error'); }
    }));
    body.querySelectorAll('.act-huy').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('HỦY phiếu bán hàng này?\n\n• Tồn kho sẽ được HOÀN LẠI đúng số đã xuất.\n• Các đơn khách đặt gắn với phiếu trở về "Chờ xử lý".\n• Công nợ khách hàng giảm tương ứng.')) return;
      try { await apiPut('/api/banhang/phieu/' + b.dataset.id + '/huy', {}); toast('Đã hủy phiếu và hoàn tồn kho.', 'success'); renderBanHang(perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
    body.querySelectorAll('.act-xoa').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('XÓA HẲN phiếu bán hàng này? Tồn kho được hoàn lại (nếu phiếu còn hiệu lực). Không hoàn lại được.')) return;
      try { await apiDelete('/api/banhang/phieu/' + b.dataset.id); toast('Đã xóa phiếu.', 'success'); renderBanHang(perm); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  async function xemPhieuBanHang(id, perm) {
    const d = (await apiGet('/api/banhang/phieu/' + id)).data;
    const h = d.header;
    const modal = openModal(`
      <h3>Phiếu bán hàng ${escapeHtml(h.SoPhieu)} ${h.TrangThai === 'Đã hủy' ? '<span class="badge danger">Đã hủy</span>' : ''}</h3>
      <div class="form-grid">
        <div><b>Ngày:</b> ${fmtDate(h.NgayBan)}</div>
        <div><b>Khách hàng:</b> ${escapeHtml(h.TenKhach)}</div>
        <div><b>SĐT:</b> ${escapeHtml(h.SDT || '')}</div>
        <div><b>Địa chỉ:</b> ${escapeHtml(h.DiaChi || '')}</div>
        <div><b>Người lập:</b> ${escapeHtml(h.NguoiTao || '')}</div>
        <div><b>Đã thu:</b> ${fmtTien(h.DaThu)} / ${fmtTien(h.TongThanhToan)} đ</div>
      </div>
      <div style="max-height:50vh;overflow:auto;margin-top:8px;">${bangChiTietBanHangHtml(d.chiTiet, h)}
        <div style="margin-top:6px;">Số tiền bằng chữ: <i>${escapeHtml(docSoTienBangChu(h.TongThanhToan))}</i></div>
        ${khoiCongNoHtml(h)}</div>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnDong">Đóng</button>
        <button type="button" class="btn" id="btnIn">🖨️ In phiếu</button>
      </div>`);
    modal.querySelector('#btnDong').addEventListener('click', closeModal);
    modal.querySelector('#btnIn').addEventListener('click', () => printPhieuBanHang(h, d.chiTiet));
  }

  // Bảng dòng hàng + chân phiếu (dùng cho cả modal xem và bản in)
  /* ================================================================================================
     v6.27: PHIEU BAN HANG GHI THEO DON VI TINH CHINH cua tung ma hang (Cái / Bộ), khong ghi cung "Cái".
     `SoLuongCai` (ten cot cu) thuc chat la SO LUONG THEO DON VI GOC — voi ma DVT chinh = Bộ thi do
     chinh la SO BỘ, va GiaBanLe la gia 1 BỘ. Chi doi NHAN hien thi, KHONG doi phep tinh nao.
     'Ri' la don vi GOP (SoLuongCai van la so cai) nen ma quan theo Ri van ghi nhan 'Cái'.
     ================================================================================================ */
  function dvGoc(donViCoBan, donViQuyDoi) {
    const dv = String(donViCoBan || 'Cái').trim();
    // v6.31: mã quản theo đơn vị GỘP thì đơn vị gốc không được lưu ở đâu -> lùi về 'Cái'.
    return donViChinhLaGop({ DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi }) ? 'Cái' : dv;
  }
  // Nhan don vi chung cho ca phieu: moi dong cung 1 DVT -> lay DVT do; lan lon -> de trong.
  function dvChungCuaPhieu(ct) {
    const ds = [...new Set((ct || []).map(r => dvGoc(r.DonViCoBan, r.DonViQuyDoi)))];
    return ds.length === 1 ? ds[0] : '';
  }

  /* ================================================================================================
     v6.72 — GỘP CÁC MÀU CỦA CÙNG MỘT MÃ HÀNG VÀO MỘT DÒNG.
     Trước đây mỗi màu một dòng nên phiếu 1 mã 6 màu đã dài 6 dòng, in ra tốn giấy và khó soát.
     Nay mỗi mã một dòng, chi tiết từng màu dồn sang cột ĐVT QUY ĐỔI: "5 Ri6: tím 2, đen 2, hồng 1".

     ⚠️ KHÓA GỘP KHÔNG CHỈ LÀ MÃ HÀNG. Phải gộp theo (mã hàng + ĐVT + giá bán lẻ + %CK shop), vì:
       - Cùng một mã bán hai giá khác nhau trên cùng phiếu (hàng cũ/hàng mới, khách quen/khách lạ)
         mà gộp chung thì phải bịa ra "giá chung" -> thành tiền sẽ không khớp tổng phiếu.
       - Gộp theo giá thì Thành tiền của dòng gộp = ĐÚNG tổng các dòng con, không phải tính lại.
     Nên nếu một mã có hai mức giá, nó vẫn tách làm hai dòng — đúng bản chất, không phải lỗi.
     ================================================================================================ */
  function gopTheoMaHang(ct) {
    const map = new Map();
    (ct || []).forEach(r => {
      const khoa = [r.MaHangID, r.DonVi || '', Number(r.GiaBanLe) || 0, Number(r.PhanTramCKShop) || 0].join('|');
      let g = map.get(khoa);
      if (!g) {
        // Sao chép dòng đầu làm khung, rồi cộng dồn phần số vào — giữ nguyên mọi trường hiển thị khác.
        g = Object.assign({}, r, { SoLuongCai: 0, SoLuong: 0, ThanhTien: 0, mau: [] });
        map.set(khoa, g);
      }
      g.SoLuongCai += Number(r.SoLuongCai) || 0;
      g.SoLuong += Number(r.SoLuong) || 0;
      g.ThanhTien += Number(r.ThanhTien) || 0;
      if (!g.AnhDaiDien && r.AnhDaiDien) g.AnhDaiDien = r.AnhDaiDien;   // dòng đầu thiếu ảnh thì lấy dòng sau
      if (r.TenMau) g.mau.push({ ten: r.TenMau, cai: Number(r.SoLuongCai) || 0 });
    });
    return [...map.values()];
  }

  /* Cột ĐVT QUY ĐỔI (v6.72.1 — xếp theo DÒNG cho dễ soát):
         5 Ri6        <- dòng đầu: TỔNG quy đổi, IN ĐẬM
         Tím 2        <- mỗi màu một dòng, IN NGHIÊNG
         Đen 2
         Hồng 1
     Trước đó dồn tất cả vào một dòng ngăn bằng dấu phẩy: mã nhiều màu là ô đó dài ngoẵng, bảng phải
     co các cột khác lại và chữ bị xuống dòng lung tung.
     Số của từng màu ghi CÙNG ĐƠN VỊ với số tổng ở trên (Ri thì tất cả theo Ri) — trộn Ri với Cái
     trong cùng một ô là người đọc cộng lại không ra tổng.
     Mã không quản theo Ri (hệ số = 1) thì vẫn liệt kê màu, đơn vị là Cái. */
  function moTaQuyDoiVaMau(g) {
    const he = Number(g.LoaiRi) || 1;
    const cai = Number(g.SoLuongCai) || 0;
    if (!cai) return '';
    const soGon = (n) => fmtNumber(Math.round(n * 100) / 100);
    const dsMau = (g.mau || []).filter(m => m.cai > 0);
    const dongMau = dsMau.map(m =>
      `<div style="font-style:italic;">${escapeHtml(m.ten)} ${soGon(he > 1 ? m.cai / he : m.cai)}</div>`).join('');
    if (he <= 1) return dongMau;
    const ri = Math.floor(cai / he), du = cai - ri * he;
    return `<div style="font-weight:bold;">${fmtNumber(ri)} Ri${he}${du ? ` dư ${fmtNumber(du)}` : ''}</div>${dongMau}`;
  }

  function bangChiTietBanHangHtml(ct, h, choIn) {
    const dvChung = dvChungCuaPhieu(ct);
    const oAnh = r => r.AnhDaiDien
      ? `<img src="${escapeHtml(choIn ? r.AnhDaiDien : anhNho(r.AnhDaiDien, 160))}" style="width:44px;height:44px;object-fit:cover;border-radius:4px;">` : '';
    // v6.24: tiêu đề cột CĂN GIỮA cho dễ đọc (mẫu Word cũng căn giữa).
    return `<table style="width:100%;border-collapse:collapse;" border="1" cellpadding="4">
      ${/* v6.24.3: ĐVT QUY ĐỔI đứng NGAY CẠNH SỐ LƯỢNG (trước ở cuối bảng, nhìn rời rạc);
           cột TÊN HÀNG cho rộng gấp đôi các cột số. */''}
      ${/* CĂN GIỮA phải đặt INLINE trên TỪNG <th>: bản in có CSS "th,td{text-align:left}" nên đặt ở
           <tr> sẽ bị đè (kế thừa thua chọn theo thẻ). */''}
      <thead><tr style="background:#f1f3f4;">
        <th style="width:4%;text-align:center;">STT</th><th style="width:11%;text-align:center;">MÃ + ẢNH</th>
        ${/* v6.72.1: bớt TÊN HÀNG 24%->20%, dồn cho ĐVT QUY ĐỔI 10%->14% vì cột này nay chứa cả danh
             sách màu. Tổng các cột vẫn đúng 100%, đổi lệch tổng là bảng in bị tràn mất cột phải. */''}
        <th style="width:20%;text-align:center;">TÊN HÀNG</th><th style="width:5%;text-align:center;">ĐVT</th>
        <th style="width:7%;text-align:center;">SỐ LƯỢNG</th><th style="width:14%;text-align:center;">ĐVT QUY ĐỔI</th>
        <th style="width:10%;text-align:center;">GIÁ BÁN LẺ<div style="font-weight:400;font-size:10px;">(đ/${escapeHtml(dvChung || 'ĐVT')})</div></th>
        <th style="width:6%;text-align:center;">CK SHOP</th><th style="width:10%;text-align:center;">GIÁ BÁN</th>
        <th style="width:13%;text-align:center;">THÀNH TIỀN</th></tr></thead>
      <tbody>
        ${gopTheoMaHang(ct).map((g, i) => `<tr>
          <td style="text-align:center;">${i + 1}</td>
          <td>${escapeHtml(g.MaHang)}<br>${oAnh(g)}</td>
          ${/* v6.23.2: SỐ LƯỢNG luôn in theo CÁI, cột "ĐVT QUY ĐỔI" in theo RI (yêu cầu).
               v6.72: MÀU không còn nằm dưới tên hàng nữa — đã dồn sang cột ĐVT QUY ĐỔI. */''}
          <td>${escapeHtml(g.TenHang)}</td>
          <td style="text-align:center;">${escapeHtml(dvGoc(g.DonViCoBan, g.DonViQuyDoi))}</td>
          <td style="text-align:right;">${fmtNumber(g.SoLuongCai)}</td>
          ${/* v6.72.1: nowrap — mỗi dòng trong ô đã ngắn ("Hồng 1") nên không cần cho xuống dòng nữa;
               để nó tự xuống dòng là tên màu bị cắt làm đôi, đọc rất khó. */''}
          <td style="text-align:right;white-space:nowrap;">${moTaQuyDoiVaMau(g)}</td>
          <td style="text-align:right;">${fmtTien(g.GiaBanLe)}</td>
          <td style="text-align:center;">${fmtNumber(g.PhanTramCKShop)}%</td>
          <td style="text-align:right;">${fmtTien(g.GiaBan)}</td>
          <td style="text-align:right;"><b>${fmtTien(g.ThanhTien)}</b></td></tr>`).join('')}
        <tr style="font-weight:bold;background:#f1f3f4;">
          <td colspan="4" style="text-align:center;">TỔNG CỘNG</td>
          ${/* Phiếu nhiều ĐVT khác nhau thì KHÔNG ghi đơn vị ở dòng tổng — cộng Cái với Bộ là vô nghĩa. */''}
          <td style="text-align:right;">${fmtNumber(h.TongSLCai)}${dvChung ? ' ' + escapeHtml(dvChung) : ''}</td>
          <td style="text-align:right;">${(() => {
            // Tổng số RI = cộng số ri của từng dòng (mỗi mã một hệ số nên phải cộng theo dòng).
            const tong = ct.reduce((s, r) => {
              const he = Number(r.LoaiRi) || 1;
              return s + (he > 1 ? Math.floor((Number(r.SoLuongCai) || 0) / he) : 0);
            }, 0);
            return tong ? fmtNumber(tong) + ' Ri' : '';
          })()}</td>
          <td colspan="3"></td>
          <td style="text-align:right;">${fmtTien(h.TongTienHang)}</td></tr>
        <tr><td colspan="9" style="text-align:right;"><b>CK NPP</b> (${fmtNumber(h.PhanTramCKNPP)}% × tổng cộng)</td>
          <td style="text-align:right;">${fmtTien(h.TienCKNPP)}</td></tr>
        <tr><td colspan="9" style="text-align:right;"><b>TỔNG TIỀN HÀNG</b></td>
          <td style="text-align:right;">${fmtTien(h.TienTruocVAT)}</td></tr>
        <tr><td colspan="9" style="text-align:right;"><b>THUẾ GTGT</b> (${fmtNumber(h.PhanTramVAT)}%)</td>
          <td style="text-align:right;">${fmtTien(h.TienVAT)}</td></tr>
        <tr style="font-weight:bold;background:#e8f0fe;"><td colspan="9" style="text-align:right;">TỔNG TIỀN SAU THUẾ GTGT</td>
          <td style="text-align:right;font-size:15px;">${fmtTien(h.TongThanhToan)}</td></tr>

      </tbody></table>`;
  }

  /* v6.24.5: 2 dòng công nợ đặt DƯỚI dòng "Số tiền bằng chữ" (theo yêu cầu), không nằm trong bảng. */
  function khoiCongNoHtml(h) {
    if (h.CongNoTruoc == null) return '';
    return `<table style="width:56%;margin-left:auto;margin-top:6px;">
      <tr><td style="text-align:right;">Công nợ trước phiếu ${escapeHtml(h.SoPhieu || '')}</td>
        <td style="text-align:right;width:38%;">${fmtTien(h.CongNoTruoc)}</td></tr>
      <tr style="font-weight:bold;background:#fff3e0;"><td style="text-align:right;">TỔNG CÔNG NỢ</td>
        <td style="text-align:right;font-size:15px;">${fmtTien(h.TongCongNo)}</td></tr></table>`;
  }

  // In ĐÚNG khuôn mẫu Word: đầu phiếu công ty, tiêu đề, ngày + số, khách/SĐT/địa chỉ, bảng, tiền bằng chữ, 3 ô ký.
  function printPhieuBanHang(h, ct) {
    const d = new Date(h.NgayBan);
    /* v6.24.5: phiếu 10 cột hay bị TRÀN MẤT CỘT PHẢI khi in. Ép table-layout:fixed (chia cột đúng %
       đã khai), cho xuống dòng trong ô, thu nhỏ chữ/đệm — vừa khít khổ A4 lề 10mm. */
    const styleIn = `
      table{table-layout:fixed;width:100%;}
      th,td{padding:3px 4px;font-size:11.5px;word-wrap:break-word;overflow-wrap:anywhere;}
      h2{font-size:17px;}`;
    /* v6.64: TIÊU ĐỀ TRANG IN = số phiếu + tên khách. Khi người dùng chọn "Lưu thành PDF",
       trình duyệt lấy CHÍNH <title> làm tên file mặc định — nên đặt tiêu đề là đặt luôn tên file
       PDF, không cần thêm gì khác. Dùng dấu '-' thay '/' vì '/' không hợp lệ trong tên file. */
    printHtml(`PhieuBanHang ${h.SoPhieu || ''}${h.TenKhach ? ' - ' + String(h.TenKhach).replace(/[\\/:*?"<>|]/g, '-') : ''}`, `
      <h2 style="text-align:center;margin:0 0 2px;">PHIẾU XUẤT KHO KIÊM BIÊN BẢN BÀN GIAO</h2>
      ${/* v6.24.3: ngày tháng CĂN GIỮA (dưới tiêu đề), số phiếu CĂN PHẢI ở dòng riêng. */''}
      <div style="text-align:center;margin-bottom:2px;">Ngày ${isNaN(d) ? '.....' : d.getDate()} tháng ${isNaN(d) ? '.....' : (d.getMonth() + 1)} năm ${isNaN(d) ? '.....' : d.getFullYear()}</div>
      <div style="text-align:right;margin-bottom:8px;"><b>Số: ${escapeHtml(h.SoPhieu || '')}</b></div>
      ${h.TrangThai === 'Đã hủy' ? '<div style="text-align:center;color:#a00;">(PHIẾU ĐÃ HỦY)</div>' : ''}
      <p style="margin:2px 0;"><b>Khách hàng:</b> ${escapeHtml(h.TenKhach || '')} &nbsp;&nbsp;&nbsp; <b>SĐT:</b> ${escapeHtml(h.SDT || '')}</p>
      <p style="margin:2px 0 8px;"><b>Địa chỉ:</b> ${escapeHtml(h.DiaChi || '')}</p>
      ${bangChiTietBanHangHtml(ct, h, true)}
      <p style="margin:8px 0;"><b>Số tiền bằng chữ:</b> ${escapeHtml(docSoTienBangChu(h.TongThanhToan))}</p>
      ${khoiCongNoHtml(h)}
      ${h.GhiChu ? `<p style="margin:2px 0;"><b>Ghi chú:</b> ${escapeHtml(h.GhiChu)}</p>` : ''}
      <div class="p-sign" style="display:flex;justify-content:space-between;margin-top:26px;text-align:center;">
        <div style="flex:1;"><div class="line">Khách hàng</div></div>
        <div style="flex:1;"><div class="line">Thủ kho</div></div>
        <div style="flex:1;"><div class="line">Người làm phiếu</div></div>
      </div>`, { extraStyle: styleIn, logo: true });
  }

  /* ---------- Chọn đơn khách đặt để chuyển sang phiếu bán hàng ---------- */
  async function openChonDonModal(perm, khachSan) {
    const res = await apiGet('/api/banhang/donchoxuat' + (khachSan ? '?khach=' + encodeURIComponent(khachSan) : ''));
    const don = res.data || [];
    if (res.tyLe) bhTyLe = res.tyLe;
    if (!don.length) { toast('Không còn đơn khách đặt nào đang chờ xuất hàng.', 'info'); return; }
    /* ================================================================================================
       v6.74.1 — SỬA LỖI "không hiện mã hàng, báo chưa tích dòng nào".
       SQL Server so chuỗi KHÔNG phân biệt hoa/thường và BỎ QUA khoảng trắng cuối, còn JavaScript so
       TUYỆT ĐỐI CHÍNH XÁC. Nên `WHERE o.TenKhach = @k` ở máy chủ vẫn trả về đơn của "Cty An Bình ",
       nhưng ở đây `d.TenKhach === khachSan` lại trượt -> bảng rỗng -> bấm Tiếp tục báo "chưa tích đơn nào".
       Cùng một cái tên mà hai tầng hiểu khác nhau thì tầng nào cũng "đúng", chỉ người dùng chịu.
       => Từ đây so tên bằng chuanTen() ở CẢ hai chỗ: lọc bảng và chọn sẵn khách. */
    const chuanTen = chuanTenKhach;   // dùng chung một chuẩn với bộ lọc đơn khách đặt

    /* v6.74.2: GỘP KHÁCH TRONG DANH SÁCH.
       Trước đây ô chọn khách liệt kê nguyên chuỗi tên như đã lưu, nên cùng một khách viết lệch nhau
       ("Cty An Bình", "CTY AN BÌNH ", "Cty  An  Bình") hiện thành 3 dòng riêng — chọn dòng nào cũng
       chỉ thấy một phần đơn của khách đó, rất dễ lên thiếu phiếu mà không ai biết.
       Nay gộp theo tên đã chuẩn hoá; bảng bên dưới cũng lọc theo cùng khoá nên chọn một lần là ra
       ĐỦ đơn của khách, kể cả các bản viết lệch.
       Tên đại diện = bản xuất hiện ở NHIỀU ĐƠN NHẤT — cùng quy tắc với CLI utils/gop_ten_khach.js,
       để hai chỗ không hiểu khác nhau về "tên chuẩn của khách này là gì".
       ⚠️ Đây chỉ là gộp KHI HIỂN THỊ, dữ liệu vẫn còn lệch. Gộp hẳn thì chạy:
            cd D:\QLSX\backend && node utils/gop_ten_khach.js --liet-ke */
    const nhomKhach = new Map();
    don.forEach(d => {
      const k = chuanTen(d.TenKhach);
      if (!k) return;
      if (!nhomKhach.has(k)) nhomKhach.set(k, { dem: new Map(), soDon: 0 });
      const g = nhomKhach.get(k);
      g.soDon++;
      g.dem.set(d.TenKhach, (g.dem.get(d.TenKhach) || 0) + 1);
    });
    const khachList = [...nhomKhach.values()].map(g => {
      const bien = [...g.dem.entries()].sort((a, b) => b[1] - a[1]);
      return { ten: bien[0][0], soDon: g.soDon, soBien: bien.length };
    }).sort((a, b) => a.ten.localeCompare(b.ten, 'vi'));
    const modal = openModal(`
      <h3>Chọn đơn khách đặt để lên phiếu bán hàng</h3>
      <div class="empty-hint" style="text-align:left;">Một phiếu bán hàng chỉ của <b>MỘT khách</b>. Chọn khách rồi tích các đơn cần xuất.
        Đơn đã lên phiếu sẽ chuyển sang <b>"Đã xuất hàng"</b> và <b>trừ tồn kho</b>.</div>
      <div class="form-row"><label>Khách hàng</label>
        <select id="dcxKhach">${khachList.map(k =>
          `<option value="${escapeHtml(k.ten)}">${escapeHtml(k.ten)} — ${k.soDon} đơn${k.soBien > 1 ? ` (gộp ${k.soBien} cách viết tên)` : ''}</option>`).join('')}</select></div>
      <div style="max-height:46vh;overflow:auto;" id="dcxBang"></div>
      <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button>
        <button type="button" class="btn" id="btnTiep">Tiếp tục →</button></div>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    const veBang = () => {
      const k = modal.querySelector('#dcxKhach').value;
      const ds = don.filter(d => chuanTen(d.TenKhach) === chuanTen(k));
      modal.querySelector('#dcxBang').innerHTML = `
        <table><thead><tr><th style="width:34px"><input type="checkbox" id="dcxAll" checked></th><th>Ngày</th><th>Mã hàng</th><th>Màu</th>
          <th>SL đặt</th><th>ĐVT</th><th>Tồn kho</th><th>Trạng thái</th></tr></thead>
        <tbody>${ds.map(d => {
          const cai = slSangCai(d.SoLuongDat, d.DonVi, d.LoaiRi, d);
          const du = Number(d.TonCai) >= cai;
          return `<tr ${du ? '' : 'style="background:#fdecea;"'}>
            <td><input type="checkbox" class="dcx-chon" data-id="${d.DonID}" ${du ? 'checked' : ''} ${du ? '' : 'disabled title="Không đủ tồn kho"'}></td>
            <td>${fmtDate(d.ThoiGian)}</td><td>${escapeHtml(d.MaHang)}</td><td>${escapeHtml(d.TenMau || '')}</td>
            <td style="text-align:right;">${fmtNumber(d.SoLuongDat)}${cai !== Number(d.SoLuongDat) ? `<div style="font-size:11px;">= ${fmtNumber(cai)} ${escapeHtml(dvGoc(d.DonViCoBan, d.DonViQuyDoi))}</div>` : ''}</td>
            <td>${escapeHtml(d.DonVi || '')}</td>
            <td style="text-align:right;${du ? '' : 'color:#c0392b;font-weight:bold;'}">${fmtNumber(d.TonCai)} <span style="font-size:11px;color:#5f6368;">${escapeHtml(dvGoc(d.DonViCoBan, d.DonViQuyDoi))}</span></td>
            <td>${statusBadge(d.TrangThai)}${du ? '' : ' <span class="badge danger">Thiếu tồn</span>'}</td></tr>`;
        }).join('')}</tbody></table>`;
      const all = modal.querySelector('#dcxAll');
      all.addEventListener('change', () => modal.querySelectorAll('.dcx-chon:not([disabled])').forEach(c => { c.checked = all.checked; }));
    };
    modal.querySelector('#dcxKhach').addEventListener('change', veBang);
    /* Chọn sẵn khách: dò theo tên ĐÃ CHUẨN HOÁ chứ không gán thẳng .value.
       Gán .value một chuỗi không khớp option nào thì <select> im lặng nhảy về rỗng — đó chính là lúc
       bảng trống mà không có lời cảnh báo nào. Không dò ra thì giữ option đầu để còn dùng được. */
    if (khachSan) {
      const sel = modal.querySelector('#dcxKhach');
      const op = Array.from(sel.options).find(o => chuanTen(o.value) === chuanTen(khachSan));
      if (op) sel.value = op.value;
      else toast(`Khách "${khachSan}" không có đơn nào đang chờ xuất — đang hiện đơn của "${sel.value}".`, 'info');
    }
    veBang();
    modal.querySelector('#btnTiep').addEventListener('click', () => {
      const ids = Array.from(modal.querySelectorAll('.dcx-chon:checked')).map(c => Number(c.dataset.id));
      if (!ids.length) { toast('Chưa tích đơn nào.', 'error'); return; }
      const chon = don.filter(d => ids.includes(d.DonID));
      openPhieuBanHangForm(perm, chon);
    });
  }

  /* ---------- Form lên phiếu bán hàng (mới hoặc từ đơn đặt) ---------- */
  /* `phieuSua` = { header, chiTiet } khi SỬA phiếu đã có (v6.25.5); bỏ trống = lập phiếu mới. */
  async function openPhieuBanHangForm(perm, donChon, phieuSua) {
    // Số phiếu xem trước + tỷ lệ mặc định
    try {
      const r = (await apiGet('/api/banhang/next-sophieu')).data;
      if (r && r.tyLe) bhTyLe = r.tyLe;
      var soPhieuXem = r ? r.soPhieu : '';
    } catch (e) { var soPhieuXem = ''; }
    // Danh sách mã hàng + màu để thêm dòng thủ công (1 lần gọi, dùng cả 2 nhánh dữ liệu)
    const dItems = (await apiGet('/api/khohang/items')).data;
    const items = dItems.tongHop || [];
    const chiTietMau = dItems.chiTiet || [];
    const khach0 = donChon && donChon.length ? donChon[0].TenKhach : '';
    // v6.23.2: khách hàng chọn từ DANH MỤC (không gõ tự do) — kèm SĐT/địa chỉ để in thẳng lên phiếu.
    const dsKhach = await apiGet('/api/danhmuc/khachhang').then(r => r.data || []).catch(() => []);
    let idx = 0;
    /* v6.23.2: mọi dòng nhập theo CÁI, cột quy đổi hiện RI (yêu cầu: "Số lượng thể hiện cái, đơn vị
       quy đổi là ri") — kể cả dòng lấy từ đơn đặt ghi đơn vị Ri thì cũng quy về Cái ở đây.
       v6.25.4: CÙNG mã hàng + CÙNG màu (của cùng 1 khách) mà khách đặt NHIỀU LẦN thì GỘP thành 1 DÒNG,
       cộng số lượng; giữ danh sách đơn (`donIDs`) để lưu phiếu và khi hủy phiếu trả đúng tất cả đơn đó. */
    const gopDon = new Map();
    (donChon || []).forEach(d => {
      const k = d.MaHangID + '|' + d.MauSacID;
      const cai = slSangCai(d.SoLuongDat, d.DonVi, d.LoaiRi, d);
      if (!gopDon.has(k)) {
        gopDon.set(k, {
          idx: ++idx, maHangId: d.MaHangID, mauSacId: d.MauSacID, maHang: d.MaHang, tenHang: d.TenHang,
          tenMau: d.TenMau, soLuong: 0, donVi: 'Cái', loaiRi: d.LoaiRi, donViCoBan: d.DonViCoBan, donViQuyDoi: d.DonViQuyDoi,
          giaBanLe: d.GiaBan, ckShop: bhTyLe.shop, donIDs: [], moTaDon: []
        });
      }
      const g = gopDon.get(k);
      g.soLuong += cai;
      g.donIDs.push(d.DonID);
      g.moTaDon.push(`#${d.DonID} ${fmtNumber(d.SoLuongDat)} ${d.DonVi}`);
    });
    let dongBanDau = [...gopDon.values()].map(g => ({
      ...g,
      slDonGoc: g.donIDs.length > 1 ? `gộp ${g.donIDs.length} đơn: ${g.moTaDon.join(' + ')}` : g.moTaDon[0]
    }));
    /* v6.25.5: khi SỬA, cộng bù phần tồn mà chính phiếu này đang giữ vào con số "khả dụng" hiển thị —
       nếu không, người dùng thấy "khả dụng 0" dù thực tế sửa tăng vẫn được (backend hoàn tồn trước). */
    const buTon = new Map();
    if (phieuSua) {
      (phieuSua.chiTiet || []).forEach(c => {
        const k = c.MaHangID + '|' + c.MauSacID;
        const heSo = Number(c.LoaiRi) || 1;
        const laRi = donViChinhLaGop(c);   // v6.31
        const slChinh = laRi ? Math.round((Number(c.SoLuongCai) || 0) / heSo) : (Number(c.SoLuongCai) || 0);
        buTon.set(k, (buTon.get(k) || 0) + slChinh);
        buTon.set('mh' + c.MaHangID, (buTon.get('mh' + c.MaHangID) || 0) + slChinh);
      });
    }
    // v6.25.5: SỬA phiếu -> nạp lại các dòng đã lưu (SL luôn theo CÁI như lúc lập phiếu).
    if (phieuSua) {
      dongBanDau = (phieuSua.chiTiet || []).map(c => {
        const ids = String(c.DonIDs || c.DonID || '').split(',').map(x => parseInt(x, 10)).filter(x => x > 0);
        return {
          idx: ++idx, maHangId: c.MaHangID, mauSacId: c.MauSacID, maHang: c.MaHang, tenHang: c.TenHang,
          tenMau: c.TenMau, soLuong: Number(c.SoLuongCai) || 0, donVi: 'Cái', loaiRi: c.LoaiRi, donViCoBan: c.DonViCoBan, donViQuyDoi: c.DonViQuyDoi,
          giaBanLe: c.GiaBanLe, ckShop: c.PhanTramCKShop, donIDs: ids,
          slDonGoc: ids.length ? `từ ${ids.length} đơn: ${ids.map(x => '#' + x).join(', ')}` : ''
        };
      });
    }
    let dong = dongBanDau.slice();

    const modal = openModal(`
      <h3>${phieuSua ? 'Sửa phiếu bán hàng ' + escapeHtml(phieuSua.header.SoPhieu)
        : 'Lập phiếu bán hàng ' + (soPhieuXem ? '<span style="font-size:13px;color:#5f6368;">(số phiếu dự kiến: ' + escapeHtml(soPhieuXem) + ')</span>' : '')}</h3>
      ${phieuSua ? '<div class="empty-hint" style="text-align:left;">Lưu xong hệ thống sẽ <b>hoàn tồn theo phiếu cũ rồi trừ lại theo số mới</b>, các đơn khách đặt gắn phiếu cũng được gắn lại — số phiếu giữ nguyên.</div>' : ''}
      <form id="fBH">
        <div class="form-grid">
          <div class="form-row"><label>Ngày bán *</label><input type="date" name="ngayBan" required value="${phieuSua ? String(phieuSua.header.NgayBan).slice(0, 10) : new Date().toISOString().slice(0, 10)}"></div>
          <div class="form-row"><label>Khách hàng *</label>
            <div style="display:flex;gap:6px;">
              ${/* v6.25.5: khi SỬA phải chọn sẵn đúng khách của phiếu, kẻo lưu lại làm mất KhachHangID. */''}
              <select id="bhKhachSel" style="flex:1;"><option value="">-- chọn khách trong danh mục --</option>${dsKhach.map(k => `<option value="${k.KhachHangID}" ${(phieuSua ? String(k.KhachHangID) === String(phieuSua.header.KhachHangID) : k.TenKhachHang === khach0) ? 'selected' : ''}>${escapeHtml(k.TenKhachHang)}${k.SDT ? ' · ' + escapeHtml(k.SDT) : ''}</option>`).join('')}</select>
              <button type="button" class="btn small secondary" id="bhThemKhach">+ Khách mới</button>
            </div>
            <input type="hidden" name="khachHangId" id="bhKhachId" value="${phieuSua ? (phieuSua.header.KhachHangID || '') : ''}">
            <input name="tenKhach" id="bhKhach" required readonly value="${escapeHtml(phieuSua ? phieuSua.header.TenKhach : khach0)}" placeholder="Chọn khách ở trên" style="margin-top:4px;">
            ${/* v6.69: KHÓA ô tên (readonly) — trước đây gõ sửa được sau khi đã chọn ở dropdown, lệch
                 một khoảng trắng hay một chữ hoa là công nợ tách khách đó thành hai dòng. Ô cùng vai
                 trò ở "Lên đơn đặt hàng" vốn đã readonly, đây là chỗ duy nhất còn hở.
                 Cần tên khác danh mục thì thêm khách mới ở Danh mục rồi chọn lại. */''}
            <div class="empty-hint" style="margin-top:2px;">Công nợ nhóm theo <b>TÊN KHÁCH</b> — chọn từ danh mục để tên luôn khớp.</div>
          </div>
          <div class="form-row"><label>SĐT</label><input name="sdt" id="bhSDT" value="${escapeHtml(phieuSua ? (phieuSua.header.SDT || '') : '')}"></div>
          <div class="form-row"><label>Địa chỉ</label><input name="diaChi" id="bhDiaChi" value="${escapeHtml(phieuSua ? (phieuSua.header.DiaChi || '') : '')}"></div>
          ${/* v6.75: GHI CHÚ chuyển lên NGAY SAU địa chỉ (trước đây nằm tận dưới bảng dòng hàng).
               Ghi chú thường là thông tin giao hàng ("giao thứ 5", "gọi trước khi đến") — thuộc về
               phần thông tin khách, để tít dưới cuối form thì lúc nhập hay quên, lúc đọc lại phải
               cuộn qua cả bảng hàng mới thấy. Cho chiếm trọn 1 hàng để gõ được câu dài. */''}
          <div class="form-row" style="grid-column:1/-1;"><label>Ghi chú</label>
            <input name="ghiChu" value="${escapeHtml(phieuSua ? (phieuSua.header.GhiChu || '') : '')}"></div>
          ${/* v6.24: ô %CK NPP và %VAT đã CHUYỂN XUỐNG chân bảng dòng hàng (đúng khuôn mẫu Word) —
               đừng để 2 nơi cùng id, form sẽ lấy nhầm ô. CK NPP mặc định 0 (khách shop); khách NPP
               bấm nút "Áp 17%" ngay tại chân bảng. */''}
        </div>
        <div class="form-row"><label>Dòng hàng</label>
          <div id="bhDong"></div>
        </div>
        ${/* v6.75: ô Ghi chú CŨ ở đây đã GỠ — đã chuyển lên sau Địa chỉ. Để hai ô cùng name="ghiChu"
             thì FormData lấy ô ĐẦU TIÊN, người dùng gõ vào ô dưới sẽ mất trắng khi lưu. */''}
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">${phieuSua ? 'Lưu thay đổi & tính lại tồn kho' : 'Lưu phiếu & trừ tồn kho'}</button></div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);

    /* v6.23.2: KẺ BẢNG khi nhập (trước là các ô xếp hàng ngang, nhìn không biết ô nào là gì). */
    function dongHtml(r, i) {
      const tuDon = !!(r.donIDs && r.donIDs.length);
      return `<tr class="bh-row" data-idx="${r.idx}" ${tuDon ? 'style="background:#f1f8f1;"' : ''}>
        <td style="text-align:center;">${i + 1}</td>
        <td>${tuDon
          ? `<b>${escapeHtml(r.maHang)}</b><div style="font-size:11px;color:#137333;">${escapeHtml(r.slDonGoc || '')}</div>`
          : `<select class="bh-mahang" style="width:100%;"><option value="">-- chọn mã hàng --</option>${items.map(it => `<option value="${it.MaHangID}" ${String(r.maHangId) === String(it.MaHangID) ? 'selected' : ''}>${escapeHtml(it.MaHang + ' · ' + it.TenHang)} (khả dụng ${fmtNumber(Number(it.TonKhaDungThuc != null ? it.TonKhaDungThuc : it.TonKhaDung) + (buTon.get('mh' + it.MaHangID) || 0))} ${escapeHtml(it.DonViCoBan || 'Cái')})</option>`).join('')}</select>`}</td>
        <td>${tuDon ? escapeHtml(r.tenMau || '') : `<select class="bh-mau" style="width:100%;"><option value="">-- màu --</option></select>`}</td>
        <td style="white-space:nowrap;"><input type="number" class="bh-sl" step="1" min="0" style="width:66px;" value="${r.soLuong != null ? r.soLuong : ''}">
          <span class="bh-dvt" style="font-size:11px;color:#5f6368;">${escapeHtml(dvGoc(r.donViCoBan, r.donViQuyDoi))}</span></td>
        <td class="bh-ri" style="text-align:right;font-size:12px;color:#5f6368;"></td>
        <td><input type="number" class="bh-gia" step="0.01" min="0" style="width:105px;" value="${r.giaBanLe != null ? r.giaBanLe : ''}"></td>
        <td><input type="number" class="bh-ck" step="0.01" min="0" max="100" style="width:64px;" value="${r.ckShop != null ? r.ckShop : bhTyLe.shop}"></td>
        <td class="bh-giaban" style="text-align:right;"></td>
        <td class="bh-tt" style="text-align:right;font-weight:bold;"></td>
        <td style="white-space:nowrap;">
          <button type="button" class="btn small secondary bh-them-duoi" title="Thêm 1 dòng ngay dưới dòng này" style="padding:2px 6px;">+</button>
          <button type="button" class="btn small danger bh-xoa" style="padding:2px 6px;">✕</button></td>
      </tr>`;
    }
    /* v6.24: chân phiếu (Tổng cộng → CK NPP → Tổng tiền TT → VAT → Tổng sau VAT) nằm NGAY TRONG
       bảng nhập, đúng khuôn mẫu Word — nhìn một mạch từ dòng hàng xuống tổng tiền. */
    function chanPhieuHtml() {
      return `<tr class="bh-chan"><td colspan="7" style="text-align:right;font-weight:bold;">TỔNG CỘNG</td>
          <td id="bhTongSL" style="text-align:right;"></td><td id="bhTongHang" style="text-align:right;font-weight:bold;"></td><td></td></tr>
        <tr class="bh-chan"><td colspan="6" style="text-align:right;">CK NPP</td>
          <td><input type="number" name="ckNPP" id="bhCKNPP" step="0.01" min="0" max="100" value="${phieuSua ? phieuSua.header.PhanTramCKNPP : 0}" style="width:64px;"></td>
          <td style="text-align:center;"><button type="button" class="btn small secondary" id="bhApNPP" style="padding:2px 6px;">Áp ${fmtNumber(bhTyLe.npp)}%</button></td>
          <td id="bhTienCK" style="text-align:right;"></td><td></td></tr>
        <tr class="bh-chan"><td colspan="8" style="text-align:right;font-weight:bold;">TỔNG TIỀN HÀNG</td>
          <td id="bhTruocVAT" style="text-align:right;font-weight:bold;"></td><td></td></tr>
        <tr class="bh-chan"><td colspan="6" style="text-align:right;">THUẾ GTGT</td>
          <td><input type="number" name="vat" id="bhVAT" step="0.01" min="0" max="100" value="${phieuSua ? phieuSua.header.PhanTramVAT : bhTyLe.vat}" style="width:64px;"></td>
          <td style="text-align:center;">%</td><td id="bhTienVAT" style="text-align:right;"></td><td></td></tr>
        <tr class="bh-chan" style="background:#e8f0fe;"><td colspan="8" style="text-align:right;font-weight:bold;">TỔNG TIỀN SAU THUẾ GTGT</td>
          <td id="bhTongTT" style="text-align:right;font-weight:bold;font-size:15px;"></td><td></td></tr>
        <tr class="bh-chan"><td colspan="10" id="bhBangChu" style="font-style:italic;color:#5f6368;"></td></tr>`;
    }
    function veDong() {
      modal.querySelector('#bhDong').innerHTML = `<table style="width:100%;">
          <thead><tr style="text-align:center;">
            <th style="width:34px;">STT</th><th>Mã hàng</th><th style="width:130px;">Màu</th>
            ${/* v6.27: mỗi dòng một mã hàng nên ĐVT khác nhau — hiện ĐVT ngay cạnh ô số lượng. */''}
            <th style="width:104px;">Số lượng</th><th style="width:80px;">Quy đổi</th>
            <th style="width:115px;">Giá bán lẻ<div style="font-weight:400;font-size:10px;">(đ/ĐVT chính)</div></th>
            <th style="width:74px;">% CK shop</th><th style="width:100px;">Giá bán</th>
            <th style="width:110px;">Thành tiền</th><th style="width:40px;"></th></tr></thead>
          <tbody id="bhTbody">${dong.map(dongHtml).join('')
            || '<tr class="bh-trong"><td colspan="10" class="empty-hint">Chưa có dòng nào — bấm "+ Thêm dòng hàng".</td></tr>'}
            ${/* v6.25.3: nút thêm dòng nằm NGAY DƯỚI dòng cuối (trong bảng), không phải dưới chân phiếu
                 — thêm xong là gõ tiếp được ngay, không phải cuộn tìm nút. */''}
            <tr class="bh-them-row"><td colspan="10" style="padding:4px;">
              <button type="button" class="btn small secondary" id="bhThem">+ Thêm dòng hàng</button></td></tr>
            ${chanPhieuHtml()}</tbody></table>`;
      modal.querySelectorAll('.bh-row').forEach(noiDayDong);
      // Nút thêm dòng + chân phiếu nằm TRONG bảng -> phải nối dây lại mỗi lần vẽ lại bảng.
      modal.querySelector('#bhThem').addEventListener('click', () => themDongMoi());
      modal.querySelector('#bhCKNPP').addEventListener('input', tinhTong);
      modal.querySelector('#bhVAT').addEventListener('input', tinhTong);
      modal.querySelector('#bhApNPP').addEventListener('click', () => {
        modal.querySelector('#bhCKNPP').value = bhTyLe.npp; tinhTong();
      });
      tinhTong();
    }
    /* v6.24: THÊM DÒNG = chèn 1 <tr> vào bảng đang có (không vẽ lại cả bảng) -> giữ nguyên số đang gõ,
       không mất vị trí con trỏ, và chân phiếu vẫn nằm dưới cùng. */
    /* `sauIdx` = chèn NGAY DƯỚI dòng có idx đó (nút "+" trên từng dòng); bỏ trống = thêm vào cuối. */
    function themDongMoi(sauIdx) {
      const r = { idx: ++idx, maHangId: '', mauSacId: '', soLuong: '', donVi: 'Cái', donViCoBan: '', ckShop: bhTyLe.shop };
      const viTri = sauIdx != null ? dong.findIndex(x => String(x.idx) === String(sauIdx)) : -1;
      if (viTri >= 0) dong.splice(viTri + 1, 0, r); else dong.push(r);
      const trong = modal.querySelector('.bh-trong');
      if (trong) trong.remove();
      const truoc = viTri >= 0
        ? modal.querySelector(`.bh-row[data-idx="${sauIdx}"]`)
        : modal.querySelector('.bh-them-row');
      if (viTri >= 0) truoc.insertAdjacentHTML('afterend', dongHtml(r, 0));
      else truoc.insertAdjacentHTML('beforebegin', dongHtml(r, 0));
      const trMoi = modal.querySelector(`.bh-row[data-idx="${r.idx}"]`);
      noiDayDong(trMoi);
      danhSoLaiSTT();
      tinhTong();
      const oDau = trMoi.querySelector('.bh-mahang') || trMoi.querySelector('.bh-sl');
      if (oDau) oDau.focus();
    }
    function danhSoLaiSTT() {
      modal.querySelectorAll('.bh-row').forEach((el, i) => { el.querySelector('td').textContent = i + 1; });
    }
    function noiDayDong(el) {
      {
        const r = dong.find(x => String(x.idx) === el.dataset.idx);
        if (!r) return;
        const selMau = el.querySelector('.bh-mau');
        if (selMau) {
          const nap = () => {
            const ds = chiTietMau.filter(c => String(c.MaHangID) === String(r.maHangId));
            selMau.innerHTML = '<option value="">-- màu --</option>' + ds.map(c => {
              /* v6.89: PHẢI dùng c.TonCai (đã gồm nguồn PHIẾU NHẬP KHO và đã trừ XuatCai), KHÔNG
                 dùng (NhapCai − XuatCai): NhapCai là số THÔ của thẻ kho, hàng vào kho bằng phiếu
                 nhập có NhapCai = 0 nên dropdown màu sẽ hiện "khả dụng 0" cho hàng thực có. */
              const ton = Number(c.TonCai || 0) - (Number(c.DangGiu) || 0)
                + (buTon.get(c.MaHangID + '|' + c.MauSacID) || 0);
              return `<option value="${c.MauSacID}" ${String(r.mauSacId) === String(c.MauSacID) ? 'selected' : ''}>${escapeHtml(c.TenMau)} (khả dụng ${fmtNumber(ton)})</option>`;
            }).join('');
          };
          nap();
          selMau.addEventListener('change', e => { r.mauSacId = e.target.value; tinhTong(); });
          const selMH = el.querySelector('.bh-mahang');
          selMH.addEventListener('change', e => {
            r.maHangId = e.target.value;
            const it = items.find(x => String(x.MaHangID) === String(r.maHangId)) || {};
            r.loaiRi = it.LoaiRi; r.giaBanLe = it.GiaBan; r.mauSacId = '';
            // v6.27: đổi mã hàng -> đổi luôn nhãn ĐVT chính cạnh ô số lượng (Cái / Bộ).
            r.donViCoBan = it.DonViCoBan || ''; r.donViQuyDoi = it.DonViQuyDoi || '';
            const oDVT = el.querySelector('.bh-dvt');
            if (oDVT) oDVT.textContent = dvGoc(r.donViCoBan, r.donViQuyDoi);
            el.querySelector('.bh-gia').value = it.GiaBan != null ? it.GiaBan : '';
            nap(); tinhTong();
          });
        }
        el.querySelector('.bh-sl').addEventListener('input', e => { r.soLuong = e.target.value; tinhTong(); });
        el.querySelector('.bh-gia').addEventListener('input', e => { r.giaBanLe = e.target.value; tinhTong(); });
        el.querySelector('.bh-ck').addEventListener('input', e => { r.ckShop = e.target.value; tinhTong(); });
        el.querySelector('.bh-them-duoi').addEventListener('click', () => themDongMoi(r.idx));
        el.querySelector('.bh-xoa').addEventListener('click', () => {
          dong = dong.filter(x => x.idx !== r.idx);
          el.remove();
          if (!dong.length) modal.querySelector('.bh-chan').insertAdjacentHTML('beforebegin',
            '<tr class="bh-trong"><td colspan="10" class="empty-hint">Chưa có dòng nào — bấm "+ Thêm dòng hàng".</td></tr>');
          danhSoLaiSTT(); tinhTong();
        });
      }
    }
    function tinhTong() {
      let tongHang = 0, tongCai = 0;
      dong.forEach(r => {
        const cai = slSangCai(r.soLuong, r.donVi, r.loaiRi, { DonViCoBan: r.donViCoBan, DonViQuyDoi: r.donViQuyDoi });   // r.donVi luôn 'Cái' ở form này
        const gia = Math.round((Number(r.giaBanLe) || 0) * (1 - (Number(r.ckShop) || 0) / 100) * 100) / 100;
        const tt = Math.round(gia * cai * 100) / 100;
        r.__tt = tt;
        tongHang += tt; tongCai += cai;
        const tr = modal.querySelector(`.bh-row[data-idx="${r.idx}"]`);
        if (!tr) return;
        tr.querySelector('.bh-tt').textContent = fmtTien(tt);
        tr.querySelector('.bh-giaban').textContent = fmtTien(gia);
        // Cột "Quy đổi": số RI tương ứng (yêu cầu: SL theo Cái, đơn vị quy đổi là Ri)
        const he = Number(r.loaiRi) || 1;
        tr.querySelector('.bh-ri').textContent = he > 1 && cai
          ? `${fmtNumber(Math.floor(cai / he))} Ri${cai % he ? ' dư ' + fmtNumber(cai % he) : ''}` : '';
      });
      const ckNPP = Number(modal.querySelector('#bhCKNPP').value) || 0;
      const vat = Number(modal.querySelector('#bhVAT').value) || 0;
      const tienCK = Math.round(tongHang * ckNPP / 100 * 100) / 100;
      const truocVAT = Math.round((tongHang - tienCK) * 100) / 100;
      const tienVAT = Math.round(truocVAT * vat / 100 * 100) / 100;
      const tong = Math.round((truocVAT + tienVAT) * 100) / 100;
      const dat = (id, v) => { const el = modal.querySelector(id); if (el) el.textContent = v; };
      // v6.27: dòng tổng chỉ ghi đơn vị khi CẢ PHIẾU cùng 1 ĐVT (cộng Cái với Bộ là vô nghĩa).
      const dvT = [...new Set(dong.filter(r => r.maHangId).map(r => dvGoc(r.donViCoBan, r.donViQuyDoi)))];
      dat('#bhTongSL', fmtNumber(tongCai) + (dvT.length === 1 ? ' ' + dvT[0] : ''));
      dat('#bhTongHang', fmtTien(tongHang));
      dat('#bhTienCK', tienCK ? '− ' + fmtTien(tienCK) : '0');
      dat('#bhTruocVAT', fmtTien(truocVAT));
      dat('#bhTienVAT', fmtTien(tienVAT));
      dat('#bhTongTT', fmtTien(tong) + ' đ');
      dat('#bhBangChu', 'Bằng chữ: ' + docSoTienBangChu(tong));
    }
    /* v6.23.2: chọn khách từ danh mục -> tự điền tên + SĐT + địa chỉ; chưa có thì thêm mới ngay tại đây. */
    const selKhach = modal.querySelector('#bhKhachSel');
    function apKhach(k) {
      if (!k) return;
      modal.querySelector('#bhKhachId').value = k.KhachHangID;
      modal.querySelector('#bhKhach').value = k.TenKhachHang;
      modal.querySelector('#bhSDT').value = k.SDT || '';
      modal.querySelector('#bhDiaChi').value = k.DiaChi || '';
    }
    selKhach.addEventListener('change', () => apKhach(dsKhach.find(x => String(x.KhachHangID) === selKhach.value)));
    if (selKhach.value) apKhach(dsKhach.find(x => String(x.KhachHangID) === selKhach.value));
    modal.querySelector('#bhThemKhach').addEventListener('click', async () => {
      const k = await themKhachNhanh(modal.querySelector('#bhKhach').value);
      if (!k) return;
      dsKhach.push(k);
      selKhach.insertAdjacentHTML('beforeend', `<option value="${k.KhachHangID}">${escapeHtml(k.TenKhachHang)}</option>`);
      selKhach.value = String(k.KhachHangID);
      apKhach(k);
    });
    veDong();

    modal.querySelector('#fBH').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      /* v6.51: LƯU THEO ĐÚNG SỐ ĐANG HIỆN TRÊN Ô NHẬP.
         Trước đây payload lấy từ mảng `dong` trong bộ nhớ, mảng này chỉ khớp với màn hình khi mọi sự
         kiện 'input' đều bắn đúng. Chỉ cần MỘT đường vẽ lại dòng mà quên nối lại sự kiện là ô CK gõ
         30 nhưng `r.ckShop` vẫn 33 -> lưu ra 33, không báo lỗi gì.
         Đọc thẳng từ DOM ngay trước khi gửi thì không còn phụ thuộc vào khâu đồng bộ đó nữa: cái gì
         đang hiện trên màn hình là cái được lưu. */
      modal.querySelectorAll('.bh-row').forEach(el => {
        const r = dong.find(x => String(x.idx) === el.dataset.idx);
        if (!r) return;
        const oSL = el.querySelector('.bh-sl');
        const oGia = el.querySelector('.bh-gia');
        const oCK = el.querySelector('.bh-ck');
        if (oSL) r.soLuong = oSL.value;
        if (oGia) r.giaBanLe = oGia.value;
        if (oCK) r.ckShop = oCK.value;
      });
      const dongGui = dong.filter(r => r.maHangId && Number(r.soLuong) > 0).map(r => ({
        maHangId: r.maHangId, mauSacId: r.mauSacId || null, soLuong: r.soLuong, donVi: r.donVi,
        giaBanLe: r.giaBanLe, phanTramCKShop: r.ckShop, donIDs: r.donIDs || []
      }));
      // Ghi lại đúng thứ gửi đi — nếu phiếu lưu ra vẫn khác, mở F12 Console là biết ngay lỗi nằm ở
      // frontend gửi sai hay backend ghi sai, khỏi phải đoán.
      console.log('[PHIẾU BÁN HÀNG] gửi lên:', dongGui.map(d => ({ maHangId: d.maHangId, giaBanLe: d.giaBanLe, ckShop: d.phanTramCKShop })));
      if (!dongGui.length) { toast('Chưa có dòng hàng hợp lệ (cần mã hàng + số lượng).', 'error'); return; }
      // Bắt buộc chọn màu: thẻ kho quản theo màu, không có màu thì không biết trừ tồn ở đâu.
      const thieuMau = dongGui.filter(d => !d.mauSacId);
      if (thieuMau.length) { toast(`${thieuMau.length} dòng chưa chọn MÀU — phải chọn màu để trừ đúng tồn kho.`, 'error'); return; }
      const btn = e.target.querySelector('button[type="submit"]');
      const nhanCu = btn.textContent;
      btn.disabled = true; btn.textContent = 'Đang lưu...';
      try {
        const payload = {
          ngayBan: fd.get('ngayBan'), tenKhach: fd.get('tenKhach'), sdt: fd.get('sdt'), diaChi: fd.get('diaChi'),
          khachHangId: fd.get('khachHangId') || null,
          phanTramCKNPP: fd.get('ckNPP'), phanTramVAT: fd.get('vat'), ghiChu: fd.get('ghiChu'), dong: dongGui
        };
        const r = phieuSua
          ? await apiPut('/api/banhang/phieu/' + phieuSua.header.PhieuBHID, payload)
          : await apiPost('/api/banhang/phieu', payload);
        closeModal();
        toast(`Đã lưu phiếu ${r.data.soPhieu} — tồn kho và công nợ đã tính lại (${fmtTien(r.data.tongThanhToan)} đ).`, 'success');
        activeTab = 'banhang';
        render(container, currentUser);
        // In luôn cho khách ký
        const d = (await apiGet('/api/banhang/phieu/' + r.data.phieuBHID)).data;
        printPhieuBanHang(d.header, d.chiTiet);
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false; btn.textContent = nhanCu;
      }
    });
  }

  /* ================================================================================================
     v6.86: MỞ THẺ KHO CỦA MÃ HÀNG TỪ MỘT PHIẾU NHẬP KHO.
     ⚠️ SỬA LỖI v6.84 "Mã hàng đã tồn tại, dùng chức năng Sửa":
     Phiếu nhập kho lưu xong LÀ ĐÃ SINH mã hàng trong danh mục (nhapkho.js timHoacTaoMaHang) — hàng
     xuất/bán được ngay. Nút "Tạo thẻ kho" của v6.84 lại mở form TẠO MỚI ⇒ lần nào cũng trùng mã,
     không bao giờ lưu được.
     Nay tự dò: mã ĐÃ CÓ thì mở form SỬA đúng mã đó (để bổ sung ảnh / giá bán / màu / danh mục — đúng
     việc còn lại ở thẻ kho); CHƯA CÓ (mã đã bị xóa sau đó) thì mới mở form tạo mới.
     Phiếu nhiều mã hàng thì hỏi chọn mã nào, không tự đoán.

     Không nhận `perm` từ bên gọi: quyền phải lấy theo CHÍNH người đang đăng nhập, tin theo tham số
     bên ngoài truyền vào là mở đường lách quyền.
     ================================================================================================ */
  function quyenTheKho() {
    const rawPerm = currentUser && currentUser.isAdmin
      ? { canView: true, canCreate: true, canEdit: true, canDelete: true }
      : ((currentUser && currentUser.permissions && currentUser.permissions.KHOHANG) || {});
    return effectivePerm(currentUser, 'KHOHANG', 'items', rawPerm);
  }

  async function moTheKhoTheoMa(maHang, phieuNKID) {
    const p = quyenTheKho();
    if (!p.canCreate) { toast('Bạn không có quyền tạo thẻ kho.', 'error'); return; }
    const res = await apiGet('/api/khohang/items');
    if (res.data && res.data.tyLeCK) tyLeCK = res.data.tyLeCK;
    /* v6.89: LUÔN mở form TẠO THẺ KHO MỚI. Mã hàng đã có sẵn trong danh mục (phiếu nhập sinh ra) là
       chuyện bình thường — backend nhận cờ `tuPhieuNKID` nên không báo "Mã hàng đã tồn tại" mà bổ
       sung màu/ảnh/giá bán vào mã đó.
       ⚠️ KHÔNG tự chuyển sang form Sửa như v6.86-v6.88: người dùng bấm "Tạo thẻ kho" là muốn khai
       thẻ kho mới, bị đẩy sang form Sửa với dữ liệu lạ thì không hiểu đang ở đâu. */
    await openItemForm(null, p, null, { PhieuNKID: phieuNKID, maHang });
  }

  async function taoTheKhoTuPhieu(phieuNKID) {
    let dong = [];
    try {
      const kq = await apiGet('/api/nhapkho/phieu/' + phieuNKID);
      dong = (kq.data && kq.data.chiTiet) || [];
    } catch (err) { toast('Không đọc được phiếu nhập: ' + err.message, 'error'); return; }
    if (!dong.length) { toast('Phiếu nhập này không có dòng hàng nào.', 'error'); return; }

    // Gộp theo mã hàng: một mã nhập nhiều dòng (nhiều đợt) thì chỉ hỏi một lần.
    const ma = [...new Set(dong.map(d => d.MaHang).filter(Boolean))];
    if (ma.length === 1) { await moTheKhoTheoMa(ma[0], phieuNKID); return; }

    const modal = openModal(`
      <div class="modal-head"><h3>Phiếu này có ${ma.length} mã hàng — chọn mã cần mở thẻ kho</h3></div>
      <div class="modal-body">
        <div class="table-wrap" style="max-height:320px;overflow:auto;">
        <table class="data-table phieu-ke"><thead><tr>
          <th style="width:50px;">STT</th><th>Mã hàng</th><th>Tên hàng</th><th style="width:130px;"></th>
        </tr></thead><tbody>
          ${ma.map((m, i) => {
            const d = dong.find(x => x.MaHang === m) || {};
            return `<tr><td>${i + 1}</td><td><b>${escapeHtml(m)}</b></td><td>${escapeHtml(d.TenHang || '')}</td>
              <td><button type="button" class="btn small tk-chon" data-ma="${escapeHtml(m)}">Mở thẻ kho</button></td></tr>`;
          }).join('')}
        </tbody></table></div>
      </div>
      <div class="modal-foot"><button class="btn secondary" id="tkcDong">Đóng</button></div>`, { rong: true });
    modal.querySelector('#tkcDong').onclick = () => closeModal();
    modal.querySelectorAll('.tk-chon').forEach(b => b.onclick = async () => {
      closeModal();
      await moTheKhoTheoMa(b.dataset.ma, phieuNKID);
    });
  }

  return { render, getTabs, taoTheKhoTuPhieu };
})();
