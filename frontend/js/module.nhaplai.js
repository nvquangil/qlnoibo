/* ================================================================================================
   PHIEU NHAP LAI (hang khach tra)   (v6.66)
   Tab nam TRONG phan he "The kho hang hoa", quyen KHOHANG/nhaplai.

   LUONG LAM PHIEU (dung yeu cau nguoi dung):
     1. Chon KHACH HANG
     2. Chon PHIEU BAN HANG da xuat cho khach do
     3. Tich cac MA HANG trong phieu do roi danh SO LUONG tra lai
     (hoac) o "Tu tim ma hang" - van chi tim trong pham vi khach do da mua, vi gia KHOA CUNG theo
     phieu xuat: ma khach chua tung mua thi khong co gia nao de tra ma khong phai doan.

   GIA: form KHONG cho sua gia. Server cung khong doc gia client gui len - no tu truy ve dung dong
   da ban de lay gia. Nho vay so tra lai luon khop dung so da ghi no.
   ================================================================================================ */
(function () {
  let container = null, perm = {}, dsPhieu = [];

  const soCai = (r) => Number(r.SoLuongCai) || 0;

  async function render(el, user, tabKey) {
    container = el;
    perm = user.isAdmin ? { canView: 1, canCreate: 1, canEdit: 1, canDelete: 1 }
      : effectivePerm(user, 'KHOHANG', 'nhaplai', user.permissions.KHOHANG || {});
    await veDanhSach();
  }

  function boLocHtml() {
    return `
      <div class="toolbar" style="gap:8px;flex-wrap:wrap;align-items:flex-end;">
        <div><label>Từ ngày</label><input type="date" id="nlTuNgay"></div>
        <div><label>Đến ngày</label><input type="date" id="nlDenNgay"></div>
        <div><label>Khách hàng</label><input type="text" id="nlKhach" placeholder="Gõ một phần tên..."></div>
        <div><label>Số phiếu</label><input type="text" id="nlSoPhieu" placeholder="NL26..."></div>
        <button class="btn secondary" id="nlLoc">Lọc</button>
        <div style="flex:1"></div>
        ${perm.canCreate ? '<button class="btn" id="nlThem">+ Lập phiếu nhập lại</button>' : ''}
        <button class="btn secondary" id="nlExcel">Xuất Excel</button>
      </div>`;
  }

  function thamSoLoc() {
    const g = (id) => (document.getElementById(id) || {}).value || '';
    const p = new URLSearchParams();
    if (g('nlTuNgay')) p.set('tuNgay', g('nlTuNgay'));
    if (g('nlDenNgay')) p.set('denNgay', g('nlDenNgay'));
    if (g('nlKhach')) p.set('khach', g('nlKhach'));
    if (g('nlSoPhieu')) p.set('soPhieu', g('nlSoPhieu'));
    return p;
  }

  async function veDanhSach() {
    const body = document.getElementById('khBody') || container;
    body.innerHTML = boLocHtml() + '<div id="nlBang"><div class="empty-hint">Đang tải...</div></div>';
    ganSuKienLoc();
    await taiBang();
  }

  function ganSuKienLoc() {
    const n = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
    n('nlLoc', taiBang);
    /* v9.06: openForm là hàm async gọi 2 API ngay dòng đầu — không .catch thì API lỗi là bấm
       "+ Lập phiếu" không có gì xảy ra (đúng lớp lỗi nút Lưu câm vừa sửa bên dưới). */
    n('nlThem', () => openForm().catch(err => toast(err.message, 'error')));
    n('nlExcel', () => {
      const p = thamSoLoc();
      taiFile('/api/nhaplai/phieu/export?' + p.toString(), 'PhieuNhapLai_DanhSach.xlsx');
    });
  }

  /* Tai file theo ten SERVER dat (Content-Disposition) - dung 1 kieu voi phieu ban hang v6.64.
     Tu dat a.download o client se de bay ten server da tinh cong tinh dat. */
  async function taiFile(url, tenDuPhong) {
    /* v9.06: fetch reject (mất mạng) trước đây rơi ra ngoài không ai bắt — "bấm Excel không có
       gì xảy ra". Đỡ ngay tại đây cho cả 3 nơi gọi. */
    let r;
    try { r = await fetch(url, { credentials: 'include' }); }
    catch (err) { toast('Không tải được file: ' + err.message, 'error'); return; }
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

  async function taiBang() {
    const hop = document.getElementById('nlBang');
    if (!hop) return;
    hop.innerHTML = '<div class="empty-hint">Đang tải...</div>';
    /* v9.06: tự đỡ lỗi NGAY TRONG taiBang — mọi nơi gọi (nút Lọc, sau lưu/hủy/xóa) đều hưởng,
       và taiBang không bao giờ reject nên nơi gọi được phép bắn-rồi-quên. Không đỡ thì API lỗi
       là bảng đông cứng ở "Đang tải..." vĩnh viễn, không một chữ. */
    let kq;
    try { kq = await apiGet('/api/nhaplai/phieu?' + thamSoLoc().toString()); }
    catch (err) {
      hop.innerHTML = `<div class="empty-hint">Không tải được danh sách phiếu nhập lại: <b>${escapeHtml(err.message)}</b></div>`;
      return;
    }
    dsPhieu = kq.data || [];
    if (!dsPhieu.length) {
      hop.innerHTML = '<div class="empty-hint">Chưa có phiếu nhập lại nào.</div>';
      return;
    }
    const tongTien = dsPhieu.filter(r => r.TrangThai !== 'Đã hủy').reduce((s, r) => s + (Number(r.TongThanhToan) || 0), 0);
    const tongSL = dsPhieu.filter(r => r.TrangThai !== 'Đã hủy').reduce((s, r) => s + (Number(r.TongSLCai) || 0), 0);
    hop.innerHTML = `
      <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th style="width:50px;">STT</th><th>Số phiếu</th><th>Ngày</th><th>Khách hàng</th>
          <th>Phiếu xuất gốc</th><th>Lý do</th><th class="num">SL (Cái)</th>
          <th class="num">Tiền trả lại</th><th>Trạng thái</th><th style="width:150px;">Thao tác</th>
        </tr></thead>
        <tbody>
          ${dsPhieu.map((r, i) => `
            <tr data-id="${r.PhieuNLID}" ${r.TrangThai === 'Đã hủy' ? 'style="opacity:.55;"' : ''}>
              <td>${i + 1}</td>
              <td><a href="#" class="nl-xem" data-id="${r.PhieuNLID}"><b>${escapeHtml(r.SoPhieu)}</b></a></td>
              <td>${fmtDate(r.NgayNhap)}</td>
              <td>${escapeHtml(r.TenKhach || '')}</td>
              <td>${escapeHtml(r.SoPhieuXuat || '')}</td>
              <td>${escapeHtml(r.LyDo || '')}</td>
              <td class="num">${fmtNumber(r.TongSLCai)}</td>
              <td class="num">${fmtTien(r.TongThanhToan)}</td>
              <td>${r.TrangThai === 'Đã hủy' ? '<span class="badge red">Đã hủy</span>' : '<span class="badge green">Hoàn thành</span>'}</td>
              <td>
                <button class="btn small secondary nl-xem" data-id="${r.PhieuNLID}">Xem</button>
                <button class="btn small secondary nl-xls" data-id="${r.PhieuNLID}">Excel</button>
                ${perm.canEdit && r.TrangThai !== 'Đã hủy' ? `<button class="btn small warn nl-huy" data-id="${r.PhieuNLID}">Hủy</button>` : ''}
                ${perm.canDelete ? `<button class="btn small danger nl-xoa" data-id="${r.PhieuNLID}">Xóa</button>` : ''}
              </td>
            </tr>`).join('')}
        </tbody>
        <tfoot><tr data-tong style="font-weight:700;background:#f4f6f8;">
          <td colspan="6">TỔNG CỘNG (không tính phiếu đã hủy)</td>
          <td class="num">${fmtNumber(tongSL)}</td>
          <td class="num">${fmtTien(tongTien)}</td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table></div>`;
    /* v9.05: ô tìm ký tự bất kỳ ngay trên bảng. Khác hai ô lọc #nlKhach/#nlSoPhieu ở trên (lọc
       PHÍA SERVER, phải bấm nút "Lọc"), ô này lọc tại chỗ theo mọi cột, gõ tới đâu thấy tới đó. */
    themOTimTuDong(hop);
    hop.querySelectorAll('.nl-xem').forEach(b => b.onclick = (e) => {
      e.preventDefault();
      // v9.06: xemPhieu là hàm async — không .catch thì 403/404 là "bấm Xem không có gì xảy ra".
      xemPhieu(b.dataset.id).catch(err => toast(err.message, 'error'));
    });
    hop.querySelectorAll('.nl-xls').forEach(b => b.onclick = () => taiFile(`/api/nhaplai/phieu/${b.dataset.id}/export`, 'PhieuNhapLai.xlsx'));
    /* v9.06: bọc try/catch — apiPut/apiDelete THROW khi backend từ chối (vd phiếu đã hủy rồi),
       không bắt là nút Hủy/Xóa câm. Nhánh `kq.success ? ...` cũ là mã chết: ném trước khi trả về. */
    hop.querySelectorAll('.nl-huy').forEach(b => b.onclick = async () => {
      if (!confirm('Hủy phiếu nhập lại này? Tồn kho và công nợ sẽ trả về như trước khi lập phiếu.')) return;
      try {
        const kq = await apiPut(`/api/nhaplai/phieu/${b.dataset.id}/huy`, {});
        toast(kq.message || 'Đã hủy phiếu.', 'success');
        taiBang();
      } catch (err) { toast(err.message, 'error'); }
    });
    hop.querySelectorAll('.nl-xoa').forEach(b => b.onclick = async () => {
      if (!confirm('XÓA HẲN phiếu nhập lại này? Không khôi phục được.')) return;
      try {
        const kq = await apiDelete(`/api/nhaplai/phieu/${b.dataset.id}`);
        toast(kq.message || 'Đã xóa phiếu.', 'success');
        taiBang();
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ================================================================================================
     FORM LAP PHIEU
     ================================================================================================ */
  async function openForm() {
    const dsKhach = (await apiGet('/api/nhaplai/khach')).data || [];
    if (!dsKhach.length) {
      toast('Chưa có phiếu bán hàng nào nên chưa có gì để nhập lại.', 'error');
      return;
    }
    const soPhieu = (await apiGet('/api/nhaplai/next-sophieu')).data || '';
    const homNay = homNayISO();

    openModal(`
      <div class="modal-head"><h3>Lập phiếu nhập lại — hàng khách trả</h3></div>
      <div class="modal-body">
        <!-- v6.66.1: DAU PHIEU DUNG BANG KE 2 COT nhan/gia tri thay vi cac khoi div roi - nhin
             giong to phieu giay, doc theo hang de doi chieu, khong bi troi cot khi man hep. -->
        <table class="phieu-form">
          <tr>
            <th>Số phiếu</th>
            <td><input type="text" value="${escapeHtml(soPhieu)}" readonly style="width:100%;font-weight:700;"></td>
            <th>Ngày nhập lại <span class="bat-buoc">*</span></th>
            <td><input type="date" id="nlfNgay" value="${homNay}" style="width:100%;"></td>
          </tr>
          <tr>
            <th>Khách hàng <span class="bat-buoc">*</span></th>
            <td><select id="nlfKhach" style="width:100%;"><option value="">-- Chọn khách --</option>
              ${dsKhach.map(k => `<option value="${escapeHtml(k.TenKhach)}">${escapeHtml(k.TenKhach)} (${k.SoPhieu} phiếu)</option>`).join('')}
            </select></td>
            <th>Phiếu xuất (phiếu bán hàng) <span class="bat-buoc">*</span></th>
            <td><select id="nlfPhieu" style="width:100%;"><option value="">-- Chọn khách trước --</option></select></td>
          </tr>
          <tr>
            <th>Lý do trả</th>
            <td><input type="text" id="nlfLyDo" placeholder="Lỗi hàng / sai màu / khách đổi ý..." style="width:100%;"></td>
            <th>Ghi chú</th>
            <td><input type="text" id="nlfGhiChu" style="width:100%;"></td>
          </tr>
        </table>

        <div class="phieu-thanh-muc">
          <b>Chọn mã hàng cần nhập lại</b>
          <input type="text" id="nlfTim" placeholder="Lọc mã hàng / tên / màu trong bảng dưới..." style="flex:1;min-width:200px;">
          <label style="display:flex;gap:6px;align-items:center;font-weight:400;white-space:nowrap;">
            <input type="checkbox" id="nlfMoiPhieu"> Lấy tất cả mã đã mua (mọi phiếu)
          </label>
        </div>
        <div class="empty-hint" id="nlfGoiY" style="margin:0 0 6px;">
          Giá lấy nguyên từ phiếu xuất, không sửa được — để số tiền trả lại khớp đúng số đã ghi nợ.
        </div>
        <div id="nlfBang" class="table-wrap" style="max-height:340px;overflow:auto;">
          <div class="empty-hint">Chọn khách và phiếu xuất để hiện danh sách mã hàng.</div>
        </div>

        <div id="nlfTong" style="margin-top:10px;text-align:right;font-weight:700;"></div>
      </div>
      <div class="modal-foot">
        <button class="btn secondary" id="nlfHuy">Hủy</button>
        <button class="btn" id="nlfLuu">Lưu phiếu nhập lại</button>
      </div>`, { rong: true });

    const $ = (id) => document.getElementById(id);
    const dongHienTai = () => Array.from(document.querySelectorAll('#nlfBang tr[data-bct]'));

    /* ================================================================================================
       v7.99 — SL ĐÃ NHẬP PHẢI SỐNG NGOÀI BẢNG.

       Từ v7.99 ô "Lọc mã hàng" ở chế độ "mọi phiếu" lọc Ở SERVER (vì bỏ chặn 200 dòng, khách nhiều
       dòng thì phải lọc server mới nhẹ). Lọc ở server nghĩa là VẼ LẠI bảng — mà `layDong()` bản cũ
       đọc SL trực tiếp từ DOM.
       Nếu để nguyên: người dùng tích 5 mã, gõ tìm mã thứ 6 -> bảng vẽ lại -> 5 mã kia BIẾN MẤT khỏi
       phiếu mà không một tiếng báo. Đó là lỗi nặng hơn hẳn lỗi đang sửa (hiện thiếu thì còn thấy,
       mất số đã nhập thì lưu sai mà không ai biết).

       Nên SL đã nhập giữ ở Map này, khóa theo PhieuBHChiTietID; bảng vẽ lại thì điền lại từ đây, và
       `layDong()` đọc TỪ ĐÂY chứ không từ DOM. Cùng cách đã áp cho `ktGiaoViecByStage` ở QLSX.

       ⚠️ XÓA MAP khi ĐỔI PHẠM VI dòng (đổi khách / đổi phiếu / bật-tắt "mọi phiếu") — giữ lại là
       lưu cả mã thuộc phiếu khác mà người dùng không còn nhìn thấy. Chỉ GIỮ khi đổi CHỮ TÌM.
       ================================================================================================ */
    const daNhap = new Map();   // PhieuBHChiTietID -> { sl, con }
    const ghiNhap = (bct, sl, con) => {
      const n = Math.round(Number(sl) || 0);
      if (n > 0) daNhap.set(Number(bct), { sl: n, con: Number(con) || 0 });
      else daNhap.delete(Number(bct));
    };

    $('nlfHuy').onclick = () => closeModal();
    $('nlfKhach').onchange = async () => {
      const ten = $('nlfKhach').value;
      const sel = $('nlfPhieu');
      $('nlfBang').innerHTML = '<div class="empty-hint">Chọn phiếu xuất...</div>';
      $('nlfTong').innerHTML = '';
      if (!ten) { sel.innerHTML = '<option value="">-- Chọn khách trước --</option>'; return; }
      const kh = dsKhach.find(k => k.TenKhach === ten) || {};
      sel.dataset.sdt = kh.SDT || ''; sel.dataset.diachi = kh.DiaChi || '';
      // v9.06: bắt lỗi — apiGet ném là ô chọn phiếu đứng trống không lý do (cùng lớp lỗi nút Lưu câm).
      let ds = [];
      try { ds = (await apiGet('/api/nhaplai/phieuxuat?tenKhach=' + encodeURIComponent(ten))).data || []; }
      catch (err) {
        /* Ghi lý do vào CHÍNH ô chọn (toast 3 giây là bay mất) — ô trống trơn thì không phân biệt
           được với "khách này chưa mua gì" (luật v9.04: trạng thái phải nói ra lý do). */
        sel.innerHTML = '<option value="">-- Lỗi tải danh sách phiếu xuất --</option>';
        toast('Không tải được danh sách phiếu xuất của khách: ' + err.message, 'error');
        return;
      }
      // v9.08: ghi rõ phiếu GỬI MẪU ngay trong ô chọn — chế độ một phiếu không có cột "Phiếu xuất".
      sel.innerHTML = '<option value="">-- Chọn phiếu xuất --</option>' + ds.map(p =>
        `<option value="${p.PhieuBHID}">${escapeHtml(p.SoPhieu)}${Number(p.LaHangMau) === 1 ? ' [GỬI MẪU]' : ''} — ${fmtDate(p.NgayBan)} — ${fmtTien(p.TongThanhToan)} đ</option>`).join('');
      if ($('nlfMoiPhieu').checked) taiDong();
    };
    /* Đổi phiếu / bật-tắt "mọi phiếu" = ĐỔI PHẠM VI dòng -> KHÔNG giữ SL đã nhập (xem ghi chú ở daNhap). */
    $('nlfPhieu').onchange = () => taiDong();
    $('nlfMoiPhieu').onchange = () => taiDong();
    /* ================================================================================================
       v7.99 — MỘT handler duy nhất cho ô tìm, và nó quyết định lọc ở đâu:
         · "mọi phiếu"  -> gọi lại server kèm `q` (chặn 200 đã bỏ, danh sách có thể vài nghìn dòng
                           nên phải lọc ở server mới nhẹ). GIỮ SL đã nhập.
         · một phiếu    -> ẩn/hiện tại chỗ, dữ liệu đã nạp đủ và nhỏ (một phiếu), không cần gọi lại.
       Chữ tìm ở hai nhánh khớp nghĩa nhau: backend so trên `MaHang + ' ' + TenHang + ' ' + TenMau`
       đã lowercase, y hệt chuỗi dựng vào `data-tim` bên dưới. Đổi một bên thì phải đổi bên kia.
       ================================================================================================ */
    let henTim = null;
    $('nlfTim').oninput = () => {
      const q = $('nlfTim').value.trim().toLowerCase();
      if ($('nlfMoiPhieu').checked) {
        clearTimeout(henTim);
        henTim = setTimeout(() => taiDong({ giuChon: true }), 350);   // gõ xong mới gọi, không gọi từng ký tự
        return;
      }
      dongHienTai().forEach(tr => {
        tr.style.display = !q || tr.dataset.tim.includes(q) ? '' : 'none';
      });
    };

    async function taiDong(opt) {
      const ten = $('nlfKhach').value;
      const pid = $('nlfPhieu').value;
      const moiPhieu = $('nlfMoiPhieu').checked;
      // v7.99: chỉ nhánh gõ tìm mới truyền giuChon; mọi lối khác là đổi phạm vi -> xóa SL đã nhập.
      if (!(opt && opt.giuChon)) daNhap.clear();
      if (!ten) return;
      if (!moiPhieu && !pid) {
        $('nlfBang').innerHTML = '<div class="empty-hint">Chọn phiếu xuất để hiện các mã hàng trong phiếu đó.</div>';
        return;
      }
      const q = $('nlfTim').value.trim();
      $('nlfBang').innerHTML = '<div class="empty-hint">Đang tải...</div>';
      /* v7.99: chế độ "mọi phiếu" gửi `q` lên server (backend đã nhận sẵn tham số này từ trước,
         chỉ là frontend chưa bao giờ gửi — nên trước đây gõ tìm không với tới được dòng bị chặt).
         v9.06: bắt lỗi — không thì apiGet ném là bảng đứng im ở "Đang tải..." mãi mãi, không ai
         biết vì sao (cùng lớp lỗi với nút Lưu câm). */
      let kq;
      try {
        kq = moiPhieu
          ? await apiGet('/api/nhaplai/timmahang?tenKhach=' + encodeURIComponent(ten)
              + (q ? '&q=' + encodeURIComponent(q) : ''))
          : await apiGet(`/api/nhaplai/phieuxuat/${pid}/dong`);
      } catch (err) {
        $('nlfBang').innerHTML = `<div class="empty-hint">Không tải được danh sách mã hàng: <b>${escapeHtml(err.message)}</b></div>`;
        return;
      }
      const ds = (kq.data || []).filter(r => Number(r.ConTraCai) > 0);
      if (!ds.length) {
        $('nlfBang').innerHTML = `<div class="empty-hint">${q && moiPhieu
          ? 'Không có mã nào khớp "' + escapeHtml(q) + '" trong các phiếu đã mua của khách này.'
          : 'Không còn mã nào trả lại được (đã trả hết hoặc phiếu không có dòng nào).'}</div>`;
        capNhatGoiY(0, moiPhieu, q);
        tinhTong();
        return;
      }
      $('nlfBang').innerHTML = `
        <table class="data-table">
          <thead><tr>
            <th style="width:40px;"></th><th style="width:50px;">STT</th>
            ${moiPhieu ? '<th>Phiếu xuất</th>' : ''}
            <th>Mã hàng</th><th>Tên hàng</th><th>Màu</th>
            ${/* v9.08: + cột "Khách mua luôn". Không có cột này thì dòng đã chốt 3/5 hiện
                 "Đã bán 5 · Đã trả 0 · Còn trả được 2" — phép trừ không ra, người dùng tưởng
                 phần mềm sai. Dữ liệu có sẵn trên dòng (layDongDaBan trả MauDaChotCai). */''}
            <th class="num">Đã bán</th><th class="num">Đã trả</th><th class="num">Khách mua luôn</th><th class="num">Còn trả được</th>
            <th class="num">Giá bán</th><th style="width:110px;">SL trả (Cái)</th>
          </tr></thead>
          <tbody>
            ${ds.map((r, i) => `
              <tr data-bct="${r.PhieuBHChiTietID}" data-con="${r.ConTraCai}" data-gia="${Number(r.GiaBan) || 0}"
                  data-tim="${escapeHtml(((r.MaHang || '') + ' ' + (r.TenHang || '') + ' ' + (r.TenMau || '')).toLowerCase())}">
                <td><input type="checkbox" class="nl-tick"></td>
                <td>${i + 1}</td>
                ${/* v9.08: dòng thuộc PHIẾU GỬI MẪU thì ghi rõ ngay dưới số phiếu — người lập phiếu
                     nhập lại phải phân biệt được "khách trả hàng đã mua" với "khách trả lại mẫu
                     mượn", vì hai thứ đó trông y hệt nhau trên bảng này. Nhãn dùng đúng chữ và
                     đúng màu với badge "Gửi mẫu" ở danh sách Phiếu bán hàng (v7.59). */''}
                ${moiPhieu ? `<td>${escapeHtml(r.SoPhieu || '')}${Number(r.LaHangMau) === 1
                  ? '<div><span class="badge" style="background:#fff7e6;color:#ad6800;border:1px solid #ffd591;">Gửi mẫu</span></div>' : ''}</td>` : ''}
                <td><b>${escapeHtml(r.MaHang || '')}</b></td>
                <td>${escapeHtml(r.TenHang || '')}</td>
                <td>${escapeHtml(r.TenMau || '')}</td>
                <td class="num">${fmtNumber(soCai(r))}</td>
                <td class="num">${fmtNumber(r.DaTraCai)}</td>
                <td class="num">${Number(r.MauDaChotCai) ? `<b style="color:#137333;" title="Khách mua luôn — đã chốt ở sổ Hàng mẫu, không trả lại được nữa">${fmtNumber(r.MauDaChotCai)}</b>` : ''}</td>
                <td class="num"><b>${fmtNumber(r.ConTraCai)}</b></td>
                <td class="num">${fmtTien(r.GiaBan)}</td>
                ${/* v7.99: dien lai SL tu daNhap - bang ve lai (do loc o server) khong duoc lam mat
                     so nguoi dung da nhap.
                     KHONG dat dau ` trong comment nay: no nam BEN TRONG template literal, mot dau `
                     la dong som template -> SyntaxError, ca man hinh dung im. */''}
                ${/* v9.06: mã quản kho theo Ri thì step = hệ số và ghi rõ "bội số N" ngay dưới ô —
                     backend vẫn là người chặn cuối (nhaplai.js chuanBiPhieu), đây chỉ là nói
                     TRƯỚC cho người dùng khỏi gõ 14 vào hàng Ri5 rồi mới biết. Dữ liệu LoaiRi,
                     DonViCoBan, DonViQuyDoi có sẵn trên dòng từ layDongDaBan. KHÔNG lồng backtick:
                     chỉ ternary + nối chuỗi. */''}
                <td><input type="number" class="nl-sl" min="0" step="${(donViChinhLaGop(r) && Number(r.LoaiRi) > 1) ? Number(r.LoaiRi) : 1}" max="${r.ConTraCai}" title="${(donViChinhLaGop(r) && Number(r.LoaiRi) > 1) ? 'Mã quản kho theo Ri — chỉ nhập lại được bội số của ' + Number(r.LoaiRi) + ' Cái' : 'Số lượng trả (Cái)'}" value="${(daNhap.get(Number(r.PhieuBHChiTietID)) || {}).sl || ''}" style="width:95px;">${(donViChinhLaGop(r) && Number(r.LoaiRi) > 1) ? '<div style="font-size:10px;color:#5f6368;">bội số ' + Number(r.LoaiRi) + '</div>' : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
      // v7.99: tích lại các ô đã chọn sau khi vẽ lại.
      $('nlfBang').querySelectorAll('tr[data-bct]').forEach(tr => {
        const g = daNhap.get(Number(tr.dataset.bct));
        if (g) tr.querySelector('.nl-tick').checked = true;
      });
      /* Tich o = mac dinh tra HET so con lai. Nguoi dung go de lai so it hon.
         Bo tich thi xoa so - de o lai se bi tinh vao phieu du da bo tich (bug rat de gap). */
      $('nlfBang').querySelectorAll('.nl-tick').forEach(cb => cb.onchange = () => {
        const tr = cb.closest('tr'), o = tr.querySelector('.nl-sl');
        o.value = cb.checked ? tr.dataset.con : '';
        ghiNhap(tr.dataset.bct, o.value, tr.dataset.con);   // v7.99
        tinhTong();
      });
      $('nlfBang').querySelectorAll('.nl-sl').forEach(o => o.oninput = () => {
        const tr = o.closest('tr');
        tr.querySelector('.nl-tick').checked = Number(o.value) > 0;
        ghiNhap(tr.dataset.bct, o.value, tr.dataset.con);   // v7.99
        tinhTong();
      });
      capNhatGoiY(ds.length, moiPhieu, q);
      tinhTong();
    }

    /* ================================================================================================
       v7.99 — NÓI RÕ ĐANG HIỆN BAO NHIÊU DÒNG, thay cho việc âm thầm cắt ở 200.
       Và nói rõ "đang chọn N mã": ở chế độ lọc-server, mã đã tích có thể KHÔNG còn trên bảng (nằm
       ngoài chữ tìm hiện tại) mà vẫn được lưu — không ghi ra thì người dùng tưởng mình mất chọn.
       ================================================================================================ */
    let gySoDong = 0, gyMoiPhieu = false, gyQ = '';   // ngữ cảnh lần vẽ gần nhất
    function capNhatGoiY(soDong, moiPhieu, q) {
      if (arguments.length) { gySoDong = soDong; gyMoiPhieu = moiPhieu; gyQ = q || ''; }
      const el = $('nlfGoiY');
      if (!el) return;
      const phan = ['Giá lấy nguyên từ phiếu xuất, không sửa được — để số tiền trả lại khớp đúng số đã ghi nợ.'];
      if (gyMoiPhieu) {
        phan.push(`Đang hiện <b>${fmtNumber(gySoDong)}</b> dòng${gyQ ? ' khớp "' + escapeHtml(gyQ) + '"' : ' (tất cả phiếu của khách)'}.`);
        if (!gyQ && gySoDong > 500) phan.push('<b>Nhiều dòng — gõ vài chữ vào ô lọc cho nhẹ và dễ tìm.</b>');
      }
      if (daNhap.size) phan.push(`Đang chọn <b>${daNhap.size}</b> mã${gyMoiPhieu && gyQ ? ' (kể cả mã không khớp chữ tìm hiện tại — vẫn được lưu)' : ''}.`);
      el.innerHTML = phan.join(' ');
    }

    /* Tong tinh o SERVER (POST /tinhthu) chu khong tu nhan o client: neu client tu tinh thi cong thuc
       se troi khoi backend luc nao khong biet - dung mot ban tinh duy nhat. */
    let hen = null;
    function tinhTong() {
      capNhatGoiY();   // v7.99: cập nhật ngay "Đang chọn N mã" (không chờ 350ms tính tiền)
      clearTimeout(hen);
      hen = setTimeout(async () => {
        /* Hẹn 250ms có thể nổ SAU khi modal đã đóng (gõ số rồi bấm Hủy ngay) — lúc đó #nlfTong
           không còn trong DOM, đụng vào là TypeError. Bắt phần tử một lần, không có thì thôi. */
        const oTong = $('nlfTong');
        if (!oTong) return;
        const dong = layDong();
        if (!dong.length) { oTong.innerHTML = ''; return; }
        /* v9.06: apiPost THROW khi 400 nên nhánh if (!kq.success) cũ là MÃ CHẾT — lỗi nghiệp vụ
           (trả quá số còn lại, không phải bội Ri...) làm hứa async chết im lặng và Ô TỔNG ĐỨNG IM
           Ở SỐ CŨ: người dùng nhìn tổng cũ tưởng số mình vừa gõ hợp lệ. Giờ vẽ thẳng câu từ chối
           của backend vào chỗ tổng tiền — thấy NGAY khi gõ, trước cả khi bấm Lưu. */
        let kq;
        try { kq = await apiPost('/api/nhaplai/tinhthu', { tenKhach: $('nlfKhach').value, dong }); }
        catch (err) {
          oTong.innerHTML = `<span style="color:#c62828;font-weight:400;">⚠️ ${escapeHtml(err.message)}</span>`;
          return;
        }
        const t = kq.data.tong;
        oTong.innerHTML = `
          Tổng tiền hàng: ${fmtTien(t.tongTienHang)} &nbsp;|&nbsp;
          CK NPP (${t.ckNPP}%): ${fmtTien(t.tienCKNPP)} &nbsp;|&nbsp;
          VAT (${t.vat}%): ${fmtTien(t.tienVAT)} <br>
          <span style="font-size:16px;color:#1565c0;">TỔNG TRỪ CÔNG NỢ: ${fmtTien(t.tongThanhToan)} đ</span>`;
      }, 250);
    }
    /* ⚠️ v7.99: ĐỌC TỪ `daNhap`, KHÔNG đọc từ DOM nữa.
       Từ v7.99 ô lọc ở chế độ "mọi phiếu" gọi lại server nên bảng bị vẽ lại, và dòng nằm ngoài chữ
       tìm hiện tại KHÔNG có trong DOM. Bản cũ đọc DOM sẽ lưu thiếu đúng những mã đó — người dùng
       tích 5 mã rồi gõ tìm mã thứ 6 là chỉ lưu được 1.
       Backend vẫn kiểm lại từng dòng lúc lưu (POST /phieu dùng chung layDongDaBan) nên map này không
       phải là chỗ tin cậy cuối cùng — chỉ là chỗ giữ ý người dùng cho đúng. */
    function layDong() {
      return [...daNhap.entries()]
        .map(([bct, g]) => ({ phieuBHChiTietID: Number(bct), soLuongCai: Math.round(Number(g.sl) || 0) }))
        .filter(d => d.soLuongCai > 0);
    }

    /* ================================================================================================
       v9.06 — NÚT LƯU CÂM KHI BACKEND TỪ CHỐI (Nguyen báo 2026-10-27).

       Triệu chứng: "nhập đủ SL theo phiếu bán thì lưu được, ít hơn thì bấm Lưu không hoạt động".
       Nguyên nhân KHÔNG nằm ở backend — backend từ chối với câu RẤT rõ (vượt số còn trả, mã quản
       kho theo Ri phải trả bội số Ri, các dòng khác %CK NPP...). Nguyên nhân là apiPost THROW khi
       máy chủ trả 400 (apiFetch gắn status vào Error rồi ném — v7.27), mà handler này không có
       try/catch: lời hứa async chết im lặng, toast không bao giờ hiện, và TỆ NHẤT là dòng
       "disabled = false" nằm SAU await nên KHÔNG BAO GIỜ chạy — nút Lưu bị khóa vĩnh viễn, từ đó
       bấm thêm bao nhiêu lần cũng không có gì xảy ra. Đúng bài học "bấm nút không có gì xảy ra"
       (v6.23) — chính màn này sót.
       Nhánh if (!kq.success) cũ là MÃ CHẾT: apiPost không bao giờ trả về khi success=false. */
    $('nlfLuu').onclick = async () => {
      const dong = layDong();
      if (!$('nlfKhach').value) return toast('Chưa chọn khách hàng.', 'error');
      if (!dong.length) return toast('Chưa tích mã hàng nào hoặc chưa nhập số lượng trả.', 'error');
      const sel = $('nlfPhieu');
      /* Bắt phần tử MỘT LẦN trước khi lưu: lưu xong closeModal() GỠ modal khỏi DOM, lúc đó
         $('nlfLuu') là null — finally mà tra lại theo id là TypeError ở mọi lần lưu THÀNH CÔNG
         (rà chéo v9.06 bắt được). Đặt disabled trên biến đã bắt thì node rời cây vẫn vô hại. */
      const nut = $('nlfLuu');
      nut.disabled = true;
      try {
        const kq = await apiPost('/api/nhaplai/phieu', {
          ngayNhap: $('nlfNgay').value,
          tenKhach: $('nlfKhach').value,
          sdt: sel.dataset.sdt || null,
          diaChi: sel.dataset.diachi || null,
          phieuBHID: sel.value || null,
          lyDo: $('nlfLyDo').value || null,
          ghiChu: $('nlfGhiChu').value || null,
          dong
        });
        toast('Đã lưu phiếu ' + kq.data.soPhieu + ' — trừ công nợ ' + fmtTien(kq.data.tongThanhToan) + ' đ', 'success');
        closeModal();
        taiBang();   // tự đỡ lỗi bên trong, không bao giờ reject (v9.06)
        /* xemPhieu không await: phiếu ĐÃ lưu, mở bản xem lỗi thì chỉ báo riêng việc mở,
           tuyệt đối không để nó rơi vào catch bên dưới như thể LƯU thất bại. */
        xemPhieu(kq.data.phieuNLID).catch(err =>
          toast('Phiếu đã lưu — nhưng không mở được bản xem: ' + err.message, 'error'));
      } catch (err) {
        /* Câu thông báo của backend nói rõ dòng nào, vì sao (vd "mã quản kho theo Ri (1 Ri = 5 Cái)
           nên chỉ nhập lại được bội số của 5") — hiện 8 giây cho người dùng kịp đọc hết. */
        toast(err.message, 'error', 8000);
      } finally {
        nut.disabled = false;
      }
    };
  }

  /* ================================================================================================
     XEM CHI TIET + IN
     ================================================================================================ */
  /* DAU PHIEU dang BANG KE - dung chung boi man Xem va ban IN nen hai cho khong the lech nhau. */
  function dauPhieuHtml(h) {
    return `
      <table class="phieu-form phieu-xem">
        <tr><th>Số phiếu</th><td><b>${escapeHtml(h.SoPhieu || '')}</b></td>
            <th>Ngày nhập lại</th><td>${fmtDate(h.NgayNhap)}</td></tr>
        <tr><th>Khách hàng</th><td><b>${escapeHtml(h.TenKhach || '')}</b></td>
            <th>Điện thoại</th><td>${escapeHtml(h.SDT || '')}</td></tr>
        <tr><th>Địa chỉ</th><td colspan="3">${escapeHtml(h.DiaChi || '')}</td></tr>
        <tr><th>Phiếu xuất gốc</th><td>${escapeHtml(h.SoPhieuXuat || '(nhiều phiếu / tự chọn mã)')}</td>
            <th>Lý do trả</th><td>${escapeHtml(h.LyDo || '')}</td></tr>
        <tr><th>Ghi chú</th><td>${escapeHtml(h.GhiChu || '')}</td>
            <th>Người lập</th><td>${escapeHtml(h.NguoiTao || '')}</td></tr>
      </table>`;
  }

  /* ĐVT gốc của mã hàng (đơn vị lẻ, không phải đơn vị gộp) — dùng cho cột ĐVT như phiếu bán hàng. */
  function dvGoc(donViCoBan, donViQuyDoi) {
    return donViChinhLaGop({ DonViCoBan: donViCoBan, DonViQuyDoi: donViQuyDoi }) ? 'Cái' : (donViCoBan || 'Cái');
  }
  // ĐVT dùng chung của cả phiếu (mọi dòng cùng ĐVT thì mới ghi ở dòng tổng — cộng Cái với Bộ là vô nghĩa)
  function dvChungCuaPhieu(ct) {
    const bo = [...new Set(ct.map(r => dvGoc(r.DonViCoBan, r.DonViQuyDoi)))];
    return bo.length === 1 ? bo[0] : '';
  }

  /* ================================================================================================
     v6.66.2: BẢNG CHI TIẾT + KHỐI TỔNG IN THEO ĐÚNG KHUÔN PHIẾU BÁN HÀNG.
     Trước đây khối tổng là MỘT BẢNG RIÊNG đặt bên dưới -> cột tiền của nó không thẳng hàng với cột
     THÀNH TIỀN của bảng trên (2 bảng, 2 hệ chia cột). Nay các dòng tổng nằm NGAY TRONG bảng chi tiết,
     nhãn gộp `colspan=9` và số tiền rơi đúng vào ô cột 10 -> thẳng hàng tuyệt đối, không phụ thuộc
     bề rộng màn hình hay khổ giấy.
     Thứ tự dòng tổng GIỮ ĐÚNG mẫu Word của phiếu bán hàng, đổi chỗ là hai phiếu đọc lệch nhau.
     ================================================================================================ */
  function bangChiTietHtml(ct, h, choIn) {
    const dvChung = dvChungCuaPhieu(ct);
    /* Căn giữa/phải phải đặt INLINE trên TỪNG ô: bản in có CSS "th,td{text-align:left}" nên đặt ở
       <tr> hay class sẽ bị đè (kế thừa thua chọn theo thẻ) — bài học từ phiếu bán hàng v6.24. */
    const P = 'text-align:right;', G = 'text-align:center;';
    return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;" border="1" cellpadding="4">
      <thead><tr style="background:#f1f3f4;">
        <th style="width:4%;${G}">STT</th><th style="width:12%;${G}">MÃ HÀNG</th>
        <th style="width:26%;${G}">TÊN HÀNG</th><th style="width:6%;${G}">ĐVT</th>
        <th style="width:8%;${G}">SỐ LƯỢNG</th><th style="width:11%;${G}">ĐVT QUY ĐỔI</th>
        <th style="width:10%;${G}">GIÁ BÁN LẺ<div style="font-weight:400;font-size:10px;">(đ/${escapeHtml(dvChung || 'ĐVT')})</div></th>
        <th style="width:6%;${G}">CK SHOP</th><th style="width:9%;${G}">GIÁ BÁN</th>
        <th style="width:13%;${G}">THÀNH TIỀN</th></tr></thead>
      <tbody>
        ${ct.map((r, i) => `<tr>
          <td style="${G}">${i + 1}</td>
          <td>${escapeHtml(r.MaHang || '')}</td>
          <td>${escapeHtml(r.TenHang || '')}${r.TenMau ? '<br><span style="font-style:italic;font-weight:bold;">Màu: ' + escapeHtml(r.TenMau) + '</span>' : ''}</td>
          <td style="${G}">${escapeHtml(dvGoc(r.DonViCoBan, r.DonViQuyDoi))}</td>
          <td style="${P}">${fmtNumber(r.SoLuongCai)}</td>
          <td style="${P}">${(() => {
            const he = Number(r.LoaiRi) || 1, cai = Number(r.SoLuongCai) || 0;
            if (he <= 1 || !cai) return '';
            const ri = Math.floor(cai / he), du = cai - ri * he;
            return `${fmtNumber(ri)} Ri${he}${du ? ` dư ${fmtNumber(du)}` : ''}`;
          })()}</td>
          <td style="${P}">${fmtTien(r.GiaBanLe)}</td>
          <td style="${G}">${fmtNumber(r.PhanTramCKShop)}%</td>
          <td style="${P}">${fmtTien(r.GiaBan)}</td>
          <td style="${P}"><b>${fmtTien(r.ThanhTien)}</b></td></tr>`).join('')}
        <tr data-tong style="font-weight:bold;background:#f1f3f4;">
          <td colspan="4" style="${G}">TỔNG CỘNG</td>
          <td style="${P}">${fmtNumber(h.TongSLCai)}${dvChung ? ' ' + escapeHtml(dvChung) : ''}</td>
          <td style="${P}">${(() => {
            const tong = ct.reduce((s, r) => {
              const he = Number(r.LoaiRi) || 1;
              return s + (he > 1 ? Math.floor((Number(r.SoLuongCai) || 0) / he) : 0);
            }, 0);
            return tong ? fmtNumber(tong) + ' Ri' : '';
          })()}</td>
          <td colspan="3"></td>
          <td style="${P}">${fmtTien(h.TongTienHang)}</td></tr>
        <tr data-tong><td colspan="9" style="${P}"><b>CK NPP</b> (${fmtNumber(h.PhanTramCKNPP)}% × tổng cộng)</td>
          <td style="${P}">${fmtTien(h.TienCKNPP)}</td></tr>
        <tr data-tong><td colspan="9" style="${P}"><b>TỔNG TIỀN HÀNG</b></td>
          <td style="${P}">${fmtTien(h.TienTruocVAT)}</td></tr>
        <tr data-tong><td colspan="9" style="${P}"><b>THUẾ GTGT</b> (${fmtNumber(h.PhanTramVAT)}%)</td>
          <td style="${P}">${fmtTien(h.TienVAT)}</td></tr>
        <tr data-tong style="font-weight:bold;background:#e8f0fe;"><td colspan="9" style="${P}">TỔNG TRỪ CÔNG NỢ KHÁCH HÀNG</td>
          <td style="${P}font-size:15px;">${fmtTien(h.TongThanhToan)}</td></tr>
      </tbody></table>`;
  }

  /* ================================================================================================
     v7.41 — KHOI CONG NO cuoi phieu nhap lai, giong phieu ban hang (module.khohang.js v7.29/v7.30):
         Công nợ trước phiếu <số>      (in cả khi = 0, ghi rõ "chưa phát sinh")
         Hàng trả lại (trừ công nợ)    (in số ÂM — nhìn ra ngay đây là khoản GIẢM nợ)
         CÔNG NỢ HIỆN TẠI
     ⚠️ KHÁC DẤU với phiếu bán hàng: bán hàng thì TỔNG CÔNG NỢ = trước + tiền phiếu; trả hàng thì
     CÔNG NỢ HIỆN TẠI = trước − tiền phiếu. Backend đã tính sẵn `TongCongNo` đúng dấu — ở đây KHÔNG
     tính lại, chỉ in ra, để hai nơi không thể lệch nhau.
     Thiếu dữ liệu thì IN DÒNG ĐỎ báo rõ chứ không bỏ mất khối — bài học v7.29: một dòng báo thiếu
     còn hơn một phiếu sai im lặng (vụ PX26093 mất dòng công nợ mà không ai biết).
     ================================================================================================ */
  function khoiCongNoNhapLaiHtml(h) {
    if (h.CongNoTruoc == null) {
      console.warn('[phieu nhap lai] THIEU CongNoTruoc khi in phieu', h.SoPhieu,
        '- goi /api/nhaplai/phieu/:id de lay du header.');
      return `<table style="width:56%;margin-left:auto;margin-top:6px;">
        <tr><td style="text-align:right;color:#a00;">Công nợ trước phiếu ${escapeHtml(h.SoPhieu || '')}</td>
          <td style="text-align:right;width:38%;color:#a00;">(không lấy được)</td></tr></table>`;
    }
    const khong = Number(h.CongNoTruoc) === 0;
    return `<table style="width:56%;margin-left:auto;margin-top:6px;">
      <tr><td style="text-align:right;">Công nợ trước phiếu ${escapeHtml(h.SoPhieu || '')}${khong ? ' <span style="font-weight:normal;">(chưa phát sinh)</span>' : ''}</td>
        <td style="text-align:right;width:38%;">${fmtTien(h.CongNoTruoc)}</td></tr>
      <tr><td style="text-align:right;">Hàng trả lại (trừ công nợ)</td>
        <td style="text-align:right;color:#c0392b;">−${fmtTien(h.TongThanhToan)}</td></tr>
      <tr style="font-weight:bold;background:#fff3e0;"><td style="text-align:right;">CÔNG NỢ HIỆN TẠI</td>
        <td style="text-align:right;font-size:15px;">${fmtTien(h.TongCongNo)}</td></tr></table>`;
  }

  async function xemPhieu(id) {
    /* v9.06: bỏ nhánh if(!kq.success) — mã chết (apiGet ném trước khi trả về). Lỗi để NGƯỢC lên
       nơi gọi: mọi nơi gọi xemPhieu đều đã .catch + toast. */
    const kq = await apiGet('/api/nhaplai/phieu/' + id);
    const h = kq.data.header, ct = kq.data.chiTiet || [];
    openModal(`
      <div class="modal-head"><h3>Phiếu nhập lại ${escapeHtml(h.SoPhieu)}
        ${h.TrangThai === 'Đã hủy' ? '<span class="badge red">Đã hủy</span>' : ''}</h3></div>
      <div class="modal-body">
        ${dauPhieuHtml(h)}
        ${bangChiTietHtml(ct, h, false)}
        ${khoiCongNoNhapLaiHtml(h) /* v7.41 */}
      </div>
      <div class="modal-foot">
        <button class="btn secondary" id="nlvDong">Đóng</button>
        <button class="btn secondary" id="nlvXls">Xuất Excel</button>
        <button class="btn" id="nlvIn">In phiếu</button>
      </div>`, { rong: true });
    document.getElementById('nlvDong').onclick = () => closeModal();
    document.getElementById('nlvXls').onclick = () => taiFile(`/api/nhaplai/phieu/${id}/export`, 'PhieuNhapLai.xlsx');
    document.getElementById('nlvIn').onclick = () => inPhieu(h, ct);
  }

  function inPhieu(h, ct) {
    /* Ten file PDF: Chrome lay TITLE cua trang chinh lam ten mac dinh khi "Luu thanh PDF"
       (printHtml v6.65 da doi title trang chinh trong luc in). Bo ky tu Windows cam trong ten file. */
    const tieuDe = `PhieuNhapLai ${h.SoPhieu || ''}${h.TenKhach ? ' - ' + String(h.TenKhach).replace(/[\\/:*?"<>|]/g, '-') : ''}`;
    printHtml(tieuDe, `
      ${phieuHeaderHtml('PHIẾU NHẬP LẠI HÀNG (KHÁCH TRẢ)', h.NgayNhap, h.SoPhieu)}
      ${dauPhieuHtml(h)}
      ${bangChiTietHtml(ct, h, true)}
      ${khoiCongNoNhapLaiHtml(h) /* v7.41 */}
      <p style="margin-top:6px;"><i>Bằng chữ: ${escapeHtml(docSoTienBangChu(h.TongThanhToan))}</i></p>
      <table style="width:100%;margin-top:28px;text-align:center;">
        <tr><td><b>NGƯỜI TRẢ HÀNG</b><br><i>(Ký, ghi rõ họ tên)</i></td>
            <td><b>THỦ KHO</b><br><i>(Ký, ghi rõ họ tên)</i></td>
            <td><b>NGƯỜI LẬP PHIẾU</b><br><i>(Ký, ghi rõ họ tên)</i></td></tr>
      </table>`);
  }

  window.ModuleNhapLai = { render, xemPhieu };
})();
