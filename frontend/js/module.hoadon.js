// ================================================================
// HOA DON DIEN TU (v8.36) - ket noi Cong hoa don dien tu Tong cuc Thue.
// GIAI DOAN 1: tab Cau hinh (MST + mat khau TCT) va man dang nhap captcha.
// Tab "Hoa don dau vao"/"Hoa don dau ra" se duoc bo sung o giai doan 2/4.
//
// CAPTCHA DO NGUOI GO - co y, khong tu dong giai. Go sai thi xin anh MOI
// (backend da huy ckey cu), khong cho go lai tren cung mot ma.
// ================================================================
window.ModuleHoaDon = (function () {
  let activeTab = 'dauvao';
  let container, currentUser;

  function getTabs() {
    return [
      { key: 'dauvao', label: 'Hóa đơn đầu vào' },
      { key: 'daura', label: 'Hóa đơn đầu ra' },
      { key: 'cauhinh', label: 'Cấu hình kết nối TCT' }
    ];
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    if (tabKey) activeTab = tabKey;
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.HOADON || {});
    const perm = effectivePerm(user, 'HOADON', activeTab, rawPerm);
    container.innerHTML = '<div id="hdBody"><div class="empty-hint">Đang tải...</div></div>';

    if (activeTab === 'cauhinh') return renderCauHinh(perm);
    return renderHoaDon(perm, activeTab === 'daura' ? 'RA' : 'VAO');
  }

  /* Ky tra cuu dung CHUNG cho ca 2 tab - doi ky o tab nay sang tab kia van giu,
     giong cach module.baocao.js lam (nguoi dung thuong xem cung mot ky). */
  let ky = { tuNgay: '', denNgay: '' };
  function macDinhKy() {
    if (ky.tuNgay && ky.denNgay) return;
    const h = new Date();
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    ky = { tuNgay: iso(new Date(h.getFullYear(), h.getMonth(), 1)), denNgay: iso(h) };
  }

  // ---------------------------------------------------------------- CAU HINH
  async function renderCauHinh(perm) {
    const box = container.querySelector('#hdBody');
    let cfg;
    try {
      cfg = (await apiGet('/api/hoadon/cauhinh')).data;
    } catch (err) {
      box.innerHTML = `<div class="empty-hint">Không đọc được cấu hình: ${escapeHtml(err.message)}</div>`;
      return;
    }

    /* Canh bao thieu HOADON_SECRET NGAY tren man hinh: thieu khoa thi luu mat
       khau se nem loi luc bam Luu, va nguoi dung khong the doan duoc vi sao. */
    const thieuKhoa = !cfg.coKhoaMaHoa
      ? '<div class="empty-hint" style="color:#b00020;text-align:left;">⚠️ Máy chủ chưa khai báo <b>HOADON_SECRET</b> trong file <b>.env</b> — chưa lưu được mật khẩu thuế. Báo IT bổ sung rồi khởi động lại pm2.</div>'
      : '';

    box.innerHTML = `
      <div class="card" style="max-width:640px;">
        <h3 style="margin-top:0;">Cấu hình kết nối Tổng cục thuế</h3>
        ${thieuKhoa}
        <div class="form-grid">
          <div class="form-row"><label>Mã số thuế *</label>
            <input id="hdMst" value="${escapeHtml(cfg.MST || '')}" placeholder="VD: 0111266453" ${perm.canEdit ? '' : 'disabled'}></div>
          <div class="form-row"><label>Tên đơn vị</label>
            <input id="hdTenDonVi" value="${escapeHtml(cfg.TenDonVi || '')}" ${perm.canEdit ? '' : 'disabled'}></div>
          <div class="form-row"><label>Mật khẩu cổng TCT</label>
            <input id="hdMatKhau" type="password" autocomplete="new-password"
              placeholder="${cfg.coMatKhau ? 'Đã lưu — để trống nếu không đổi' : 'Chưa lưu mật khẩu'}" ${perm.canEdit ? '' : 'disabled'}>
            <div class="empty-hint" style="text-align:left;">Mật khẩu được mã hóa trước khi ghi vào CSDL và không bao giờ hiển thị lại. Mỗi lần tải hóa đơn chỉ cần gõ captcha.</div>
          </div>
        </div>
        ${cfg.UpdatedAt ? `<div class="empty-hint" style="text-align:left;">Cập nhật lần cuối: ${fmtDate(cfg.UpdatedAt)}${cfg.UpdatedBy ? ' bởi ' + escapeHtml(cfg.UpdatedBy) : ''}</div>` : ''}
        ${perm.canEdit ? `<div style="display:flex;gap:8px;margin-top:10px;">
          <button type="button" class="btn" id="hdLuuCauHinh">Lưu</button>
          ${cfg.coMatKhau ? '<button type="button" class="btn secondary" id="hdXoaMatKhau">Xóa mật khẩu đã lưu</button>' : ''}
        </div>` : '<div class="empty-hint">Bạn không có quyền sửa cấu hình này.</div>'}
      </div>`;

    if (!perm.canEdit) return;

    box.querySelector('#hdLuuCauHinh').addEventListener('click', async () => {
      try {
        await apiPut('/api/hoadon/cauhinh', {
          mst: box.querySelector('#hdMst').value,
          tenDonVi: box.querySelector('#hdTenDonVi').value,
          matKhau: box.querySelector('#hdMatKhau').value || undefined
        });
        toast('Đã lưu cấu hình.', 'success');
        render(container, currentUser, 'cauhinh');
      } catch (err) { toast('Lỗi: ' + err.message, 'error'); }
    });

    const btnXoa = box.querySelector('#hdXoaMatKhau');
    if (btnXoa) btnXoa.addEventListener('click', async () => {
      if (!confirm('Xóa mật khẩu TCT đã lưu? Lần tải hóa đơn sau sẽ không đăng nhập được cho tới khi nhập lại.')) return;
      try {
        await apiPut('/api/hoadon/cauhinh', {
          mst: box.querySelector('#hdMst').value,
          tenDonVi: box.querySelector('#hdTenDonVi').value,
          xoaMatKhau: true
        });
        toast('Đã xóa mật khẩu đã lưu.', 'success');
        render(container, currentUser, 'cauhinh');
      } catch (err) { toast('Lỗi: ' + err.message, 'error'); }
    });
  }

  // ---------------------------------------------------------------- TRA CỨU
  /* v8.40 — BỐ TRÍ LẠI (yêu cầu Nguyen): màn hình LUÔN mở thẳng vào DANH SÁCH ĐÃ TẢI VỀ, đọc từ
     CSDL, KHÔNG bắt đăng nhập TCT. Đăng nhập chỉ bật lên đúng lúc bấm nút tải — vì xem lại hóa đơn
     cũ là việc hằng ngày, còn tải về từ TCT thì thỉnh thoảng mới làm. */
  async function renderHoaDon(perm, loai) {
    macDinhKy();
    const box = container.querySelector('#hdBody');
    const tenLoai = loai === 'RA' ? 'đầu ra' : 'đầu vào';
    box.innerHTML = `
      <div class="toolbar" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label style="font-size:13px;">Từ ngày <input type="date" id="hdTu" value="${ky.tuNgay}" style="width:auto;"></label>
        <label style="font-size:13px;">Đến ngày <input type="date" id="hdDen" value="${ky.denNgay}" style="width:auto;"></label>
        <button type="button" class="btn small secondary hd-nhanh" data-loai="thang">Tháng này</button>
        <button type="button" class="btn small secondary hd-nhanh" data-loai="thangtruoc">Tháng trước</button>
        <button type="button" class="btn small secondary" id="hdXem">Xem</button>
        ${/* v8.40: GỘP 1 NÚT — tải danh sách xong tải luôn XML+PDF, không bắt bấm 2 lần. */''}
        ${/* v8.41: XML+PDF áp cho CẢ đầu ra (Nguyen đổi ý so với lần chốt "đầu ra chỉ cần Excel"). */''}
        <button type="button" class="btn" id="hdTraCuu">⬇️ Tải từ Tổng cục thuế (danh sách + XML + PDF)</button>
        <span style="margin-left:auto;display:flex;gap:6px;align-items:center;">
          <button type="button" class="btn small secondary" id="hdDungLaiPdf" title="Dựng lại file PDF từ bản HTML đã lưu — không gọi lại cổng TCT">🔄 Dựng lại PDF</button>
          <button type="button" class="btn small secondary" id="hdTaiVe">💾 Tải về máy (.zip)</button>
          <button type="button" class="btn small secondary" id="hdExcel">📊 Xuất Excel</button>
        </span>
      </div>
      <div id="hdKetQua"></div>
      <div id="hdBang"><div class="empty-hint">Đang tải danh sách đã lưu...</div></div>`;

    const oTu = box.querySelector('#hdTu');
    const oDen = box.querySelector('#hdDen');
    const nhoKy = () => { ky.tuNgay = oTu.value; ky.denNgay = oDen.value; };
    oTu.addEventListener('change', nhoKy);
    oDen.addEventListener('change', nhoKy);

    box.querySelectorAll('.hd-nhanh').forEach(b => b.addEventListener('click', () => {
      const h = new Date();
      const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const truoc = b.dataset.loai === 'thangtruoc';
      const dau = new Date(h.getFullYear(), h.getMonth() - (truoc ? 1 : 0), 1);
      const cuoi = truoc ? new Date(h.getFullYear(), h.getMonth(), 0) : h;
      oTu.value = iso(dau); oDen.value = iso(cuoi); nhoKy();
      napBang(loai);
    }));

    box.querySelector('#hdXem').addEventListener('click', () => { nhoKy(); napBang(loai); });

    box.querySelector('#hdExcel').addEventListener('click', () => {
      const qs = new URLSearchParams({ loai, tuNgay: oTu.value, denNgay: oDen.value });
      /* File tai ve: dieu huong thang, KHONG qua apiGet (apiGet doc JSON, se lam
         hong file nhi phan). */
      window.location.href = `/api/hoadon/excel?${qs}`;
    });

    /* v8.40: MỘT nút làm trọn việc — đăng nhập (nếu cần) → tải danh sách → tải luôn XML+PDF.
       Trước đây phải bấm 2 nút riêng và tự nhớ thứ tự. */
    box.querySelector('#hdTraCuu').addEventListener('click', async () => {
      const nut = box.querySelector('#hdTraCuu');
      const kq = box.querySelector('#hdKetQua');
      nhoKy();

      // Chỉ đòi đăng nhập TCT ĐÚNG LÚC NÀY, không chặn ở màn danh sách.
      let tt;
      try { tt = (await apiGet('/api/hoadon/trangthai')).data; } catch (err) {
        kq.innerHTML = `<div class="empty-hint" style="color:#b00020;">${escapeHtml(err.message)}</div>`;
        return;
      }
      if (!tt.daDangNhap) {
        const xong = await moModalDangNhap();
        if (!xong) return;   // người dùng đóng modal / bỏ giữa chừng
      }

      nut.disabled = true;
      try {
        kq.innerHTML = '<div class="empty-hint">Bước 1/2 — đang tải danh sách hóa đơn từ cổng Tổng cục thuế...</div>';
        const r = (await apiPost('/api/hoadon/tracuu', { loai, tuNgay: oTu.value, denNgay: oDen.value })).data;
        let thongBao = `Danh sách: <b>${fmtNumber(r.tong)}</b> hóa đơn ${escapeHtml(tenLoai)} — thêm mới <b>${fmtNumber(r.them)}</b>, cập nhật <b>${fmtNumber(r.capNhat)}</b>${
          r.biLoc ? ` · đã loại <b>${fmtNumber(r.biLoc)}</b> hóa đơn nằm ngoài khoảng ngày` : ''}.`;
        await napBang(loai);

        if (r.tong > 0) {
          kq.innerHTML = `<div class="empty-hint" style="text-align:left;">${thongBao}<br>Bước 2/2 — đang tải XML + PDF (mỗi hóa đơn khoảng 1 giây)...</div>`;
          const f = (await apiPost('/api/hoadon/taifile', { loai, tuNgay: oTu.value, denNgay: oDen.value })).data;
          thongBao += `<br>File: tải mới <b>${fmtNumber(f.taiMoi)}</b>, đã có sẵn <b>${fmtNumber(f.daCo)}</b>${
            f.loi ? `, <b style="color:#b00020;">lỗi ${fmtNumber(f.loi)}</b>` : ''}${
            f.loiChiTiet && f.loiChiTiet.length ? '<br>' + f.loiChiTiet.map(escapeHtml).join('<br>') : ''}`;
          await napBang(loai);
        }
        kq.innerHTML = `<div class="empty-hint" style="text-align:left;color:#137333;">${thongBao}</div>`;
      } catch (err) {
        kq.innerHTML = `<div class="empty-hint" style="text-align:left;color:#b00020;">${escapeHtml(err.message)}</div>`;
      } finally {
        nut.disabled = false;
      }
    });

    box.querySelector('#hdDungLaiPdf').addEventListener('click', async () => {
      const nut = box.querySelector('#hdDungLaiPdf');
      const chon = idDaChon();
      const kq = box.querySelector('#hdKetQua');
      nut.disabled = true;
      kq.innerHTML = `<div class="empty-hint">Đang dựng lại PDF${chon.length ? ` (${chon.length} hóa đơn đã chọn)` : ' (toàn bộ khoảng ngày)'} từ bản HTML đã lưu...</div>`;
      try {
        /* v8.45: CHIA TUNG DOT 5 hóa đơn. Dựng 1 PDF mất 1–3 giây, mà apiPost bỏ cuộc sau 30 giây
           (xem common.js) → gọi 1 lần cho cả khoảng ngày là chắc chắn báo "máy chủ không phản hồi"
           dù server vẫn đang chạy ngon. Chia nhỏ vừa tránh hết giờ, vừa hiện được tiến độ. */
        const ds = chon.length ? chon : idsDangHien.slice();
        if (!ds.length) { kq.innerHTML = '<div class="empty-hint">Không có hóa đơn nào trong khoảng ngày này.</div>'; return; }
        let xong = 0, thieuHtml = 0, loi = 0;
        const loiChiTiet = [];
        for (let i = 0; i < ds.length; i += 5) {
          const dot = ds.slice(i, i + 5);
          kq.innerHTML = `<div class="empty-hint">Đang dựng lại PDF — ${fmtNumber(Math.min(i + dot.length, ds.length))}/${fmtNumber(ds.length)} hóa đơn...</div>`;
          const r = (await apiPost('/api/hoadon/dunglaipdf', { loai, ids: dot })).data;
          xong += r.xong; thieuHtml += r.thieuHtml; loi += r.loi;
          if (r.loiChiTiet) loiChiTiet.push(...r.loiChiTiet);
        }
        kq.innerHTML = `<div class="empty-hint" style="text-align:left;color:#137333;">
          Đã dựng lại <b>${fmtNumber(xong)}</b> file PDF${
          thieuHtml ? ` · <b>${fmtNumber(thieuHtml)}</b> hóa đơn chưa có bản HTML (bấm "Tải từ Tổng cục thuế" trước)` : ''}${
          loi ? `, <b style="color:#b00020;">lỗi ${fmtNumber(loi)}</b>` : ''}${
          loiChiTiet.length ? '<br>' + loiChiTiet.slice(0, 5).map(escapeHtml).join('<br>') : ''}</div>`;
        await napBang(loai);
      } catch (err) {
        kq.innerHTML = `<div class="empty-hint" style="text-align:left;color:#b00020;">${escapeHtml(err.message)}</div>`;
      } finally { nut.disabled = false; }
    });

    const nutTaiVe = box.querySelector('#hdTaiVe');
    if (nutTaiVe) nutTaiVe.addEventListener('click', () => {
      const chon = idDaChon();
      const qs = new URLSearchParams(chon.length
        ? { loai, ids: chon.join(',') }
        : { loai, tuNgay: oTu.value, denNgay: oDen.value });
      // File nhị phân: điều hướng thẳng, KHÔNG qua apiGet (apiGet đọc JSON sẽ làm hỏng file).
      window.location.href = `/api/hoadon/taive?${qs}`;
    });

    napBang(loai);
  }

  /* Danh sach HoaDonID dang tich. Rong = "lam cho TOAN BO khoang ngay dang xem" - de nguoi dung
     khong phai tich tay hang tram dong khi muon tai het. */
  function idDaChon() {
    return Array.from(container.querySelectorAll('.hd-chon:checked')).map(o => Number(o.value));
  }
  /* v8.45: id của các hóa đơn ĐANG HIỆN trên bảng - dùng để chia đợt khi dựng lại PDF hàng loạt. */
  let idsDangHien = [];

  async function napBang(loai) {
    const el = container.querySelector('#hdBang');
    if (!el) return;
    const qs = new URLSearchParams({ loai, tuNgay: ky.tuNgay, denNgay: ky.denNgay });
    let rows;
    try {
      rows = (await apiGet(`/api/hoadon/danhsach?${qs}`)).data || [];
    } catch (err) {
      el.innerHTML = `<div class="empty-hint">Lỗi đọc danh sách: ${escapeHtml(err.message)}</div>`;
      return;
    }
    idsDangHien = rows.map(r => r.HoaDonID);
    if (!rows.length) {
      el.innerHTML = '<div class="empty-hint">Chưa có hóa đơn nào trong khoảng ngày này. Bấm "Tải từ Tổng cục thuế" để lấy về.</div>';
      return;
    }
    const tong = k => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const coCotFile = true;   // v8.41: cả đầu vào lẫn đầu ra đều có cột XML/PDF
    el.innerHTML = `
      <table class="data-table" data-nostt>
        <thead><tr>
          ${coCotFile ? '<th style="width:34px;"><input type="checkbox" id="hdChonHet" title="Chọn tất cả"></th>' : ''}
          <th>Ký hiệu</th><th>Số HĐ</th><th>Ngày lập</th>
          <th>${loai === 'RA' ? 'MST người mua' : 'MST người bán'}</th>
          <th>${loai === 'RA' ? 'Tên người mua' : 'Tên người bán'}</th>
          <th class="col-so">Chưa thuế</th><th class="col-so">Thuế</th><th class="col-so">Tổng TT</th>
          <th>Trạng thái</th>${coCotFile ? '<th>XML</th><th>PDF</th>' : ''}<th>Tra cứu NCC</th>
        </tr></thead>
        <tbody>${rows.map(r => {
          const mst = loai === 'RA' ? r.MstMua : r.MstBan;
          const ten = loai === 'RA' ? r.TenMua : r.TenBan;
          const ma = r.Fkey || r.MaTraCuu || '';
          let link = '';
          if (r.PortalLink) {
            const href = /^https?:\/\//i.test(r.PortalLink) ? r.PortalLink : 'http://' + r.PortalLink;
            link = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">Cổng NCC</a>${ma ? ' · <b>' + escapeHtml(ma) + '</b>' : ''}`;
          } else if (ma) link = '<b>' + escapeHtml(ma) + '</b>';
          /* v8.40: PDF bấm vào MỞ RA XEM ngay (tab mới, ?xem=1 -> Content-Disposition: inline).
             XML thì vẫn tải xuống - trình duyệt không hiển thị XML hóa đơn thành gì hữu ích. */
          const oFile = duoi => {
            if (!r[duoi === 'xml' ? 'CoXml' : 'CoPdf']) return '<span style="color:#b0b0b0;">—</span>';
            return duoi === 'pdf'
              ? `<a href="/api/hoadon/file/${r.HoaDonID}/pdf?xem=1" target="_blank" rel="noopener" title="Mở xem hóa đơn">👁️ Xem</a>`
              : `<a href="/api/hoadon/file/${r.HoaDonID}/xml" title="Tải file XML">XML</a>`;
          };
          return `<tr>
            ${coCotFile ? `<td style="text-align:center;"><input type="checkbox" class="hd-chon" value="${r.HoaDonID}"></td>` : ''}
            <td>${escapeHtml(r.KhhDon || '')}</td>
            <td>${escapeHtml(String(r.ShDon == null ? '' : r.ShDon).padStart(7, '0'))}</td>
            <td>${fmtDate(r.TDLap)}</td>
            <td>${escapeHtml(mst || '')}</td>
            <td>${escapeHtml(ten || '')}</td>
            <td class="col-so">${fmtNumber(r.TgTCThue || 0)}</td>
            <td class="col-so">${fmtNumber(r.TgTThue || 0)}</td>
            <td class="col-so">${fmtNumber(r.TgTTSo || 0)}</td>
            <td>${escapeHtml(r.TrangThai || '')}</td>
            ${coCotFile ? `<td style="text-align:center;">${oFile('xml')}</td><td style="text-align:center;">${oFile('pdf')}</td>` : ''}
            <td>${link}</td>
          </tr>`;
        }).join('')}</tbody>
        ${/* colspan phải đổi theo số cột: có cột file thì thêm 1 (ô tích) ở đầu và 2 (XML/PDF) ở cuối. */''}
        <tfoot data-tong><tr>
          <td colspan="${coCotFile ? 6 : 5}"><b>TỔNG CỘNG (${fmtNumber(rows.length)} hóa đơn)</b></td>
          <td class="col-so"><b>${fmtNumber(tong('TgTCThue'))}</b></td>
          <td class="col-so"><b>${fmtNumber(tong('TgTThue'))}</b></td>
          <td class="col-so"><b>${fmtNumber(tong('TgTTSo'))}</b></td>
          <td colspan="${coCotFile ? 4 : 2}"></td>
        </tr></tfoot>
      </table>`;

    const oChonHet = el.querySelector('#hdChonHet');
    if (oChonHet) oChonHet.addEventListener('change', () => {
      el.querySelectorAll('.hd-chon').forEach(o => { o.checked = oChonHet.checked; });
    });
  }

  /* v8.40: đăng nhập TCT chuyển từ MÀN HÌNH RIÊNG sang HỘP THOẠI bật lên đúng lúc bấm tải.
     Trả về Promise<boolean>: true = đăng nhập xong, false = người dùng đóng/bỏ giữa chừng.
     Gõ sai thì tự xin ảnh MỚI ngay (backend đã hủy ckey cũ, mã cũ dùng 1 lần là hỏng). */
  function moModalDangNhap() {
    return new Promise(giaiQuyet => {
      let xong = false;
      /* Bấm ✕ hoặc Esc cũng PHẢI giải phóng lời hứa, nếu không nút "Tải từ TCT" treo vĩnh viễn.
         openModal có sẵn tham số onClose cho đúng việc này (xem common.js) - dùng nó thay vì tự
         nghĩ ra sự kiện riêng. */
      const modal = openModal(`
        <div style="max-width:420px;">
          <h3 style="margin-top:0;">Đăng nhập cổng Tổng cục thuế</h3>
          <div class="empty-hint" style="text-align:left;">Chỉ cần gõ mã captcha — mã số thuế và mật khẩu đã lưu ở tab Cấu hình.</div>
          <div id="hdCaptchaArea" style="margin-top:8px;"><div class="empty-hint">Đang lấy mã captcha...</div></div>
          <div class="form-row" style="margin-top:8px;"><label>Mã captcha *</label>
            <input id="hdCaptcha" autocomplete="off" placeholder="Gõ đúng mã trong ảnh"></div>
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button type="button" class="btn" id="hdDangNhap">Đăng nhập</button>
            <button type="button" class="btn secondary" id="hdMaMoi">Lấy mã mới</button>
            <button type="button" class="btn secondary" id="hdHuy" style="margin-left:auto;">Hủy</button>
          </div>
        </div>`, { onClose: () => { closeModal(); if (!xong) giaiQuyet(false); } });

      const areaAnh = modal.querySelector('#hdCaptchaArea');
      const oCaptcha = modal.querySelector('#hdCaptcha');

      async function layMa() {
        areaAnh.innerHTML = '<div class="empty-hint">Đang lấy mã captcha...</div>';
        oCaptcha.value = '';
        try {
          const r = (await apiGet('/api/hoadon/captcha')).data;
          areaAnh.innerHTML = `<img src="data:${r.dinhDang};base64,${r.anhBase64}" alt="captcha"
            style="max-width:100%;border:1px solid var(--border);border-radius:4px;background:#fff;">`;
          oCaptcha.focus();
        } catch (err) {
          areaAnh.innerHTML = `<div class="empty-hint" style="color:#b00020;">${escapeHtml(err.message)}</div>`;
        }
      }

      modal.querySelector('#hdMaMoi').addEventListener('click', layMa);
      modal.querySelector('#hdHuy').addEventListener('click', () => { closeModal(); giaiQuyet(false); });
      modal.querySelector('#hdDangNhap').addEventListener('click', async () => {
        try {
          await apiPost('/api/hoadon/dangnhap', { captcha: oCaptcha.value });
          xong = true;
          closeModal();
          toast('Đã đăng nhập cổng Tổng cục thuế.', 'success');
          giaiQuyet(true);
        } catch (err) {
          toast(err.message, 'error');
          layMa();   // ma cu da hong - cap anh MOI de go lai
        }
      });
      oCaptcha.addEventListener('keydown', e => { if (e.key === 'Enter') modal.querySelector('#hdDangNhap').click(); });
      layMa();
    });
  }

  return { getTabs, render };
})();
