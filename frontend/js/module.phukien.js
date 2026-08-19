// Phan he QUAN LY PHU KIEN (mac, the bai, chun, day rut, day co...)
// Ledger theo phieu Nhap/Xuat (dau phieu + chi tiet), co the gan Don hang san xuat
// de bao cao "SL phu kien xuat kem theo don hang" ben phan he Quan ly san xuat.
// Phieu Nhap co the gan Nha cung cap + So hoa don (v4.0), khong bat buoc gan don hang.
window.ModulePhuKien = (function () {
  let activeTab = 'phieu';
  let container, currentUser, dm = null;
  /* v6.31: Danh mục → Đơn vị tính, dùng cho 2 ô ĐVT của Danh mục phụ kiện. Tải 1 lần mỗi phiên;
     lỗi thì để rỗng — optDonVi() vẫn giữ giá trị đang lưu nên form không vỡ. */
  let dsDonViTinhPK = [];
  async function taiDonViTinhPK() {
    if (dsDonViTinhPK.length) return dsDonViTinhPK;
    try { dsDonViTinhPK = (await apiGet('/api/danhmuc/donvitinh')).data || []; }
    catch (e) {
      dsDonViTinhPK = [];
      /* v6.31: KHONG nuot loi. Khong co quyen xem Danh muc -> o don vi chi con dung gia tri dang luu,
         nguoi dung khong doi duoc ma khong hieu tai sao. Bao ro mot lan. */
      toast('Không tải được Danh mục đơn vị tính (' + e.message + ') — ô đơn vị chỉ hiện giá trị đang lưu. Cần quyền xem phân hệ Danh mục.', 'info');
    }
    return dsDonViTinhPK;
  }

  function pkOptionLabel(p) { return `${p.MaPhuKien} — ${p.TenPhuKien}${p.Size ? ' (Size ' + p.Size + ')' : ''}`; }

  /* v5.88 — ẢNH PHỤ KIỆN DÙNG CHUNG cho MỌI phiếu NPL (nhập / xuất / chỉ định / tham khảo).
     Ảnh lấy từ Danh mục phụ kiện (DanhMucPhuKien.AnhDaiDien, v5.87) nên khai 1 lần là mọi phiếu đều có.
     `d` là 1 dòng chi tiết phiếu (backend đã trả kèm AnhDaiDien). */
  function anhPKThumbHtml(d) {
    const url = d && (d.AnhDaiDien || d.AnhPhuKien);
    return url ? `<a href="${escapeHtml(url)}" target="_blank" title="Bấm để xem ảnh to"><img src="${escapeHtml(url)}" style="width:42px;height:42px;object-fit:cover;border-radius:4px;"></a>` : '';
  }
  function anhPKPrintHtml(d) {
    const url = d && (d.AnhDaiDien || d.AnhPhuKien);
    return url ? `<img src="${escapeHtml(url)}" style="max-width:70px;max-height:70px;object-fit:contain;">` : '';
  }

  /* v5.94 — DÒNG TỔNG CỘNG SỐ LƯỢNG cho phiếu NPL. Lưu ý nghiệp vụ: 1 phiếu có thể gồm nhiều ĐVT
     khác nhau (cái / mét / kg) nên con số tổng chỉ để ĐỐI CHIẾU NHANH, không phải số liệu kế toán. */
  /* v5.95 có hàm canhBaoLanLoaiPK() chặn 1 phiếu nhập gồm nhiều LOẠI phụ kiện.
     v6.10 — ĐÃ BỎ HẲN hàm đó theo yêu cầu "phiếu nhập phụ kiện bỏ bắt buộc chọn loại phụ kiện, 1 phiếu
     nhập được nhiều loại phụ kiện". Ràng buộc ở backend (kiemTraCungLoaiPK trong routes/phukien.js) cũng
     đã gỡ — nếu chỉ gỡ ở form thì máy chủ vẫn từ chối lưu. Ô "Loại phụ kiện" ở đầu phiếu giữ lại nhưng
     chỉ còn vai trò BỘ LỌC danh sách mã cho dễ tìm. */

  function tongSLPhuKien(lines) {
    return (lines || []).reduce((t, d) => t + (Number(d.SoLuong) || 0), 0);
  }
  function tongTienPhuKien(lines) {
    return (lines || []).reduce((t, d) => t + (Number(d.SoLuong) || 0) * (Number(d.DonGia) || 0), 0);
  }
  // v6.30: bỏ dongTongSLPK() — 2 bảng dùng nó đã có thêm cột Quy đổi/Giá quy đổi nên colspan khác nhau,
  // mỗi bảng tự viết dòng TỔNG CỘNG của mình cho khỏi đếm nhầm cột.

  // v5.3 (muc 5): moi dong can 1 ID rieng bat (khong phu thuoc DOM order) de wire searchableSelectHtml -
  // dung 1 bo dem rieng cho module nay (khong dung chung voi rowCount cua cac form khac).
  let __pkRowSeq = 0;

  /* ================================================================================================
     v6.30: QUY ĐỔI HIỂN THỊ cho từng dòng phiếu nhập/xuất phụ kiện.
     Quy ước trong danh mục phụ kiện (xem placeholder ô "Tỷ lệ quy đổi"):
         1 <ĐVT quy đổi> = TyLeQuyDoi × <ĐVT cơ bản>        vd: 1 Bó = 0,18 Kg
     Suy ra:
         SL theo ĐVT quy đổi = SL(cơ bản) / TyLeQuyDoi
         Giá 1 ĐVT quy đổi   = Giá 1 ĐVT cơ bản × TyLeQuyDoi
     Nếu dòng đang chọn ĐVT = ĐVT quy đổi thì quy NGƯỢC lại về ĐVT cơ bản.
     ⚠️ 2 cột này CHỈ ĐỂ XEM. Hệ thống lưu và cộng tồn theo đúng con số + ĐVT người dùng chọn.
     ================================================================================================ */
  /* v6.32: TỒN quy về ĐVT QUY ĐỔI cho màn hình Thẻ kho / Tồn kho phụ kiện.
     Quy ước danh mục: 1 <ĐVT quy đổi> = <tỷ lệ> × <ĐVT cơ bản>  =>  tồn quy đổi = tồn / tỷ lệ.
     Chưa khai đủ (thiếu ĐVT quy đổi hoặc tỷ lệ) thì trả rỗng — không đoán bừa. */
  function tonQuyDoiHtml(r) {
    const tyLe = Number(r.TyLeQuyDoi) || 0;
    const cb = String(r.DonViCoBan || '').trim(), qd = String(r.DonViQuyDoi || '').trim();
    if (!(tyLe > 0) || !qd || qd === cb) return '<span style="color:#9aa0a6;">—</span>';
    const q = (Number(r.TonKho) || 0) / tyLe;
    return `<b>${fmtNumber(Math.round(q * 10000) / 10000)}</b> <span style="font-size:11px;color:#5f6368;">${escapeHtml(qd)}</span>`;
  }

  /* Chuỗi quy đổi của 1 DÒNG ĐÃ LƯU (dùng cho bản in + cửa sổ xem phiếu).
     Dữ liệu đơn vị lấy kèm trong truy vấn chi tiết phiếu (backend/routes/phukien.js, v6.30). */
  function chuoiQuyDoi(d) {
    const tyLe = Number(d.TyLeQuyDoi) || 0;
    const dvCoBan = String(d.DonViCoBan || '').trim(), dvQuyDoi = String(d.DonViQuyDoi || '').trim();
    const sl = Number(d.SoLuong) || 0;
    if (!(tyLe > 0) || !dvCoBan || !dvQuyDoi || dvCoBan === dvQuyDoi || !sl) return '';
    const dangLaCoBan = String(d.DonVi || dvCoBan).trim() === dvCoBan;
    const q = dangLaCoBan ? sl / tyLe : sl * tyLe;
    return fmtNumber(Math.round(q * 10000) / 10000) + ' ' + (dangLaCoBan ? dvQuyDoi : dvCoBan);
  }
  function chuoiGiaQuyDoi(d) {
    const tyLe = Number(d.TyLeQuyDoi) || 0;
    const dvCoBan = String(d.DonViCoBan || '').trim(), dvQuyDoi = String(d.DonViQuyDoi || '').trim();
    const gia = Number(d.DonGia) || 0;
    if (!(tyLe > 0) || !dvCoBan || !dvQuyDoi || dvCoBan === dvQuyDoi || !gia) return '';
    const dangLaCoBan = String(d.DonVi || dvCoBan).trim() === dvCoBan;
    const g = dangLaCoBan ? gia * tyLe : gia / tyLe;
    return fmtNumber(Math.round(g)) + ' /' + (dangLaCoBan ? dvQuyDoi : dvCoBan);
  }

  function veQuyDoiDong(row) {
    if (!row) return;
    const oQD = row.querySelector('.p-quydoi');
    const oGia = row.querySelector('.p-giaquydoi');
    if (!oQD && !oGia) return;
    let it = null;
    try { it = row.dataset.pkInfo ? JSON.parse(row.dataset.pkInfo) : null; } catch (e) { it = null; }
    const tyLe = Number(it && it.TyLeQuyDoi) || 0;
    const dvCoBan = (it && it.DonViCoBan) || '';
    const dvQuyDoi = (it && it.DonViQuyDoi) || '';
    const sl = Number((row.querySelector('.p-sl') || {}).value) || 0;
    const gia = Number((row.querySelector('.p-dongia') || {}).value) || 0;
    const dvChon = (row.querySelector('.p-dvt') || {}).value || dvCoBan;

    if (oQD) oQD.textContent = '';
    if (oGia) oGia.textContent = '';
    // Chưa khai đủ quy đổi trong danh mục thì không hiện gì (không đoán bừa).
    if (!(tyLe > 0) || !dvQuyDoi || !dvCoBan || dvQuyDoi === dvCoBan) {
      if (oQD && it && !dvQuyDoi) oQD.textContent = '—';
      return;
    }
    const dangLaCoBan = String(dvChon).trim() === String(dvCoBan).trim();
    if (oQD && sl) {
      const q = dangLaCoBan ? sl / tyLe : sl * tyLe;
      oQD.textContent = fmtNumber(Math.round(q * 10000) / 10000) + ' ' + (dangLaCoBan ? dvQuyDoi : dvCoBan);
    }
    if (oGia && gia) {
      const g = dangLaCoBan ? gia * tyLe : gia / tyLe;
      oGia.textContent = fmtNumber(Math.round(g)) + ' /' + (dangLaCoBan ? dvQuyDoi : dvCoBan);
    }
  }
  // Vẽ lại quy đổi cho MỌI dòng đang mở (gọi sau khi dựng lại bảng).
  function veQuyDoiTatCa(root) {
    (root || document).querySelectorAll('#pkRows [data-prow]').forEach(veQuyDoiDong);
  }

  function fillDvtForRow(rid, item) {
    const row = document.querySelector(`[data-rid="${rid}"]`);
    if (!row) return;
    const dvtSelect = row.querySelector('.p-dvt');
    dvtSelect.innerHTML = '';
    if (item) {
      dvtSelect.innerHTML = `<option value="${escapeHtml(item.DonViCoBan)}">${escapeHtml(item.DonViCoBan)}</option>`;
      if (item.DonViQuyDoi) dvtSelect.innerHTML += `<option value="${escapeHtml(item.DonViQuyDoi)}">${escapeHtml(item.DonViQuyDoi)}</option>`;
    }
    // v6.30: nhớ ĐVT cơ bản / ĐVT quy đổi / tỷ lệ của chính phụ kiện này để tính 2 cột quy đổi.
    if (item) {
      row.dataset.pkInfo = JSON.stringify({
        DonViCoBan: item.DonViCoBan || '', DonViQuyDoi: item.DonViQuyDoi || '',
        TyLeQuyDoi: item.TyLeQuyDoi != null ? item.TyLeQuyDoi : null
      });
    } else {
      delete row.dataset.pkInfo;
    }
    veQuyDoiDong(row);
    // v5.8.1 (yeu cau moi "Phieu xuat phu kien chua hien thi so luong chi dinh cua tung phu kien"): dien
    // noi dung "— chi dinh: X" vao span canh nhan "So luong" - span nay CHI ton tai khi dong duoc ve voi
    // pkRowTemplate({showChiDinh:true}) (xem openPhieuXuatCreateModal), nen phai null-check vi Phieu Nhap
    // va Phieu Xuat chua gan don hang khong co phan tu nay trong DOM. item.SLTheoChiDinh chi co gia tri khi
    // list dang dung la danh sach da loc theo NPL cua don hang (GET /donhang/:id/npl), khong co o danh muc
    // day du (dm.phuKien) - nen truoc khi chon don hang, hint se luon rong dung nhu mong doi.
    const hintEl = row.querySelector('.p-slchidinh-hint');
    // v5.83: hint nằm ngay dưới ô Số lượng của dòng (bảng không còn nhãn) -> bỏ dấu gạch đầu dòng.
    if (hintEl) hintEl.textContent = (item && item.SLTheoChiDinh != null) ? `chỉ định: ${fmtNumber(item.SLTheoChiDinh)}` : '';
  }

  // Khung 1 dong "phu kien + so luong + dvt + ghi chu" dung chung cho ca form Phieu Nhap va Phieu Xuat.
  // v5.0 (muc 5a/5b): opts.showLoaiFilter them 1 cot "Loai PK" dau dong (Phieu Nhap) de loc nhanh
  // phu kien phia sau theo loai; opts.phuKienList thay danh sach mac dinh bang 1 danh sach da loc san
  // (Phieu Xuat - chi phu kien da chi dinh NPL cho don hang dang chon).
  // v5.3 (muc 5): o chon Phu kien doi tu <select> sang o go-tim-tu-do (searchableSelectHtml) - "danh
  // ky tu bat ky de tim trong phan chon list phu kien".
  // v5.4 (in phieu Nhap PK): opts.showDonGia them 1 cot "Don gia" - CHI dung khi tao Phieu Nhap
  // (mau_phieu.docx: Phieu Xuat PK khong co cot Don gia, xem openPhieuNhapCreateModal vs Xuat).
  /* v5.83 — BẢNG THẬT (giống Phiếu nhập/xuất kho vải v5.80): 1 hàng tiêu đề cố định + các dòng chỉ
     chứa ô nhập, thay cho kiểu "mỗi dòng lặp lại đầy đủ nhãn" trước đây (nhìn rất rối khi nhiều dòng).
     Bề rộng cột do <colgroup> quyết định nên tiêu đề LUÔN thẳng cột: tên phụ kiện dài nhất -> rộng
     nhất; các cột số hẹp lại. Số cột trong pkColsHtml PHẢI khớp số <th> của pkHeadHtml và số <td>
     của pkRowTemplate — cả 3 cùng đọc opts.showLoaiFilter / opts.showDonGia. */
  function pkColsHtml(opts) {
    opts = opts || {};
    if (opts.showLoaiFilter) {   // Phiếu NHẬP: có cột Loại PK để lọc nhanh
      return `<colgroup><col style="width:14%"><col style="width:24%"><col style="width:9%"><col style="width:8%"><col style="width:11%">${opts.showDonGia ? '<col style="width:9%"><col style="width:11%">' : ''}<col style="width:${opts.showDonGia ? '14' : '34'}%"><col style="width:42px"></colgroup>`;
    }
    return `<colgroup><col style="width:32%"><col style="width:10%"><col style="width:9%"><col style="width:13%">${opts.showDonGia ? '<col style="width:10%"><col style="width:12%">' : ''}<col style="width:${opts.showDonGia ? '14' : '36'}%"><col style="width:42px"></colgroup>`;
  }
  function pkHeadHtml(opts) {
    opts = opts || {};
    return `<thead><tr>
      ${opts.showLoaiFilter ? '<th>Loại PK</th>' : ''}
      ${/* v6.30: 2 cột QUY ĐỔI chỉ để ĐỐI CHIẾU — hệ thống vẫn lưu số lượng/đơn giá theo ĐVT chọn ở
           cột ĐVT. Quy tắc trong danh mục phụ kiện: 1 <ĐVT quy đổi> = <tỷ lệ> × <ĐVT cơ bản>. */''}
      <th>Phụ kiện * (gõ để tìm)</th><th>Số lượng *</th><th>ĐVT</th>
      <th>Quy đổi<div style="font-weight:400;font-size:10px;">(chỉ để xem)</div></th>
      ${opts.showDonGia ? '<th>Đơn giá</th><th>Giá quy đổi<div style="font-weight:400;font-size:10px;">(chỉ để xem)</div></th>' : ''}
      <th>Ghi chú</th><th></th>
    </tr></thead>`;
  }
  function pkRowTemplate(opts) {
    opts = opts || {};
    __pkRowSeq++;
    const rid = String(__pkRowSeq);
    const phuKienList = opts.phuKienList || dm.phuKien;
    const loaiCell = opts.showLoaiFilter
      ? `<td><select class="p-loai" data-rid="${rid}" onchange="window.__pkFilterByLoai(this)"><option value="">-- Tất cả loại --</option>${dm.loaiPhuKien.map(l => `<option value="${escapeHtml(l.TenLoai)}">${escapeHtml(l.TenLoai)}</option>`).join('')}</select></td>`
      : '';
    const donGiaCell = opts.showDonGia ? `<td class="col-so"><input class="p-dongia" type="number" step="0.01" min="0"></td>` : '';
    // v5.8.1: chỗ hiện "chỉ định: X" khi opts.showChiDinh (Phiếu Xuất có gắn đơn hàng — xem
    // openPhieuXuatCreateModal); fillDvtForRow() điền nội dung mỗi khi chọn/đổi phụ kiện trong dòng.
    // v5.83: từ nhãn "Số lượng" chuyển xuống NGAY DƯỚI ô số lượng của chính dòng đó (bảng không còn nhãn).
    const slChiDinhHint = opts.showChiDinh ? `<div class="p-slchidinh-hint" data-rid="${rid}" style="font-size:11px;color:#5f6368;text-align:right;"></div>` : '';
    return `<tr data-prow data-rid="${rid}">
      ${loaiCell}
      ${/* v5.85: opts.selected = chọn sẵn phụ kiện (dùng ở form SỬA phiếu — điền lại dòng đã lưu) */''}
      <td>${phuKienList.length ? searchableSelectHtml('pksel_' + rid, phuKienList, 'PhuKienID', pkOptionLabel, opts.selected) : '<input disabled placeholder="-- Không có phụ kiện --">'}</td>
      <td class="col-so"><input class="p-sl" type="number" step="0.01" min="0">${slChiDinhHint}</td>
      <td><select class="p-dvt"></select></td>
      <td class="p-quydoi" style="text-align:right;font-size:12px;color:#5f6368;"></td>
      ${donGiaCell}
      ${opts.showDonGia ? '<td class="p-giaquydoi" style="text-align:right;font-size:12px;color:#5f6368;"></td>' : ''}
      <td><input class="p-ghichu"></td>
      <td class="col-nut"><button type="button" class="btn small danger p-remove" title="Xóa dòng">X</button></td>
    </tr>`;
  }

  // v5.83: thêm dòng xong thì con trỏ nhảy vào Ô ĐẦU TIÊN của dòng mới (giống kho vải v5.80).
  function pkFocusODauDong(row) {
    if (!row) return;
    setTimeout(() => {
      const el = row.querySelector('.ss-input, input:not([type=hidden]):not([readonly]), select');
      if (el) { el.focus(); try { el.select(); } catch (e) { } }
    }, 30);
  }

  // v5.0 (muc 5a): chon Loai PK trong 1 dong -> chi con phu kien thuoc loai do trong o tim CUNG dong
  // nay (khong anh huong cac dong khac, moi dong loc doc lap). v5.3: rebuild lai datalist + wire lai
  // searchableSelect cho dung danh sach da loc (thay vi doi <select> truoc day).
  window.__pkFilterByLoai = function (select) {
    const rid = select.dataset.rid;
    const loaiVal = select.value;
    const filtered = loaiVal ? dm.phuKien.filter(p => p.TenLoai === loaiVal) : dm.phuKien;
    // v5.8: khong con can tu ve lai <datalist> (da bo hoan toan, thay bang dropdown tu dung - xem
    // common.js) - wireSearchableSelect() ben duoi tu dung danh sach da loc cho ca resolve() lan
    // dropdown goi y.
    const textEl = document.getElementById('pksel_' + rid + '_text');
    const hiddenEl = document.getElementById('pksel_' + rid + '_val');
    if (textEl) textEl.value = '';
    if (hiddenEl) hiddenEl.value = '';
    fillDvtForRow(rid, null);
    wireSearchableSelect('pksel_' + rid, filtered, 'PhuKienID', pkOptionLabel, (match) => fillDvtForRow(rid, match), p => p.AnhDaiDien);   // v5.88
  };

  // Gan cac su kien dung chung cho khung nhieu dong phu kien (#pkRows / #btnAddPk) cua form dang hien thi.
  // rowOpts duoc luu lai va tai su dung moi lan bam "+ Them dong" de dong moi giong dong dau (cung co
  // Loai PK filter hoac cung danh sach phu kien da loc theo NPL don hang) - rowOpts.phuKienList co the
  // la 1 GETTER (xem openPhieuXuatCreateModal) nen luon doc "song" tai thoi diem wire, khong chup 1 lan.
  function wirePkRows(root, rowOpts) {
    rowOpts = rowOpts || {};
    function wireRemove() {
      // v5.83: mỗi dòng là <tr data-prow> (trước là <div>) -> selector phải theo [data-prow],
      // nếu để '> div' sẽ đếm được 0 dòng và nút X không xóa được dòng nào.
      root.querySelectorAll('.p-remove').forEach(btn => btn.onclick = () => {
        if (root.querySelectorAll('#pkRows > [data-prow]').length > 1) btn.closest('[data-prow]').remove();
      });
    }
    function wireRow(row) {
      const rid = row.dataset.rid;
      const list = rowOpts.phuKienList || dm.phuKien;
      wireSearchableSelect('pksel_' + rid, list, 'PhuKienID', pkOptionLabel, (match) => fillDvtForRow(rid, match), p => p.AnhDaiDien);   // v5.88: kèm ảnh
      // v6.30: gõ số lượng / đổi ĐVT / gõ đơn giá -> tính lại 2 cột quy đổi của chính dòng đó.
      ['.p-sl', '.p-dongia'].forEach(sel => {
        const o = row.querySelector(sel);
        if (o) o.addEventListener('input', () => veQuyDoiDong(row));
      });
      const oDvt = row.querySelector('.p-dvt');
      if (oDvt) oDvt.addEventListener('change', () => veQuyDoiDong(row));
    }
    root.querySelectorAll('#pkRows [data-prow]').forEach(wireRow);
    wireRemove();
    root.querySelector('#btnAddPk').addEventListener('click', () => {
      root.querySelector('#pkRows').insertAdjacentHTML('beforeend', pkRowTemplate(rowOpts));
      wireRemove();
      const moi = root.querySelector('#pkRows > [data-prow]:last-child');
      wireRow(moi);
      pkFocusODauDong(moi);   // v5.83
    });
  }

  /* Cập nhật lại danh sách phụ kiện hiển thị trong TẤT CẢ các dòng đang mở.
     v6.16 — MẶC ĐỊNH GIỮ NGUYÊN LỰA CHỌN CỦA TỪNG DÒNG.
     Gốc của lỗi "sửa phiếu nhập, đổi Loại phụ kiện là mất hết phụ kiện đang có": hàm này xưa luôn XÓA
     TRẮNG ô chọn của mọi dòng rồi mới nạp lại danh sách. Với phiếu XUẤT (đổi đơn hàng gắn kèm) thì xóa là
     đúng — danh sách phụ kiện hợp lệ đổi hẳn. Nhưng ô "Loại phụ kiện" ở phiếu NHẬP chỉ là BỘ LỌC cho dễ
     tìm (v6.10), KHÔNG liên quan gì tới nội dung phiếu ⇒ đổi bộ lọc mà mất dòng đã nhập là sai.
     Nay: giữ giá trị + chữ đang hiện của từng dòng, và ĐƯA CHÍNH MÓN ĐANG CHỌN vào danh sách của dòng đó
     (dù nó không thuộc loại đang lọc) để ô gõ-tìm vẫn hiểu được giá trị đó.
     Nơi nào THỰC SỰ cần xóa lựa chọn thì gọi với { xoaLuaChon: true }. */
  function refreshAllRowsPhuKienList(root, phuKienList, opts) {
    const xoa = !!(opts && opts.xoaLuaChon);
    root.querySelectorAll('#pkRows [data-prow]').forEach(row => {
      const rid = row.dataset.rid;
      // v5.8: khong con can tu ve lai <datalist> (da bo hoan toan - xem common.js).
      const textEl = document.getElementById('pksel_' + rid + '_text');
      const hiddenEl = document.getElementById('pksel_' + rid + '_val');
      const giaTriCu = hiddenEl ? hiddenEl.value : '';
      const chuCu = textEl ? textEl.value : '';
      if (xoa) {
        if (textEl) textEl.value = '';
        if (hiddenEl) hiddenEl.value = '';
        fillDvtForRow(rid, null);
      }
      // Danh sách của dòng này = danh sách đã lọc + món đang chọn (nếu nó bị lọc ra ngoài).
      const dsCuaDong = () => {
        const ds = (phuKienList || dm.phuKien || []).slice();
        if (!xoa && giaTriCu && !ds.some(p => String(p.PhuKienID) === String(giaTriCu))) {
          const dangChon = (dm.phuKien || []).find(p => String(p.PhuKienID) === String(giaTriCu));
          if (dangChon) ds.unshift(dangChon);
        }
        return ds;
      };
      wireSearchableSelect('pksel_' + rid, dsCuaDong, 'PhuKienID', pkOptionLabel, (match) => fillDvtForRow(rid, match), p => p.AnhDaiDien);   // v5.88
      if (!xoa) {   // wireSearchableSelect có thể vẽ lại ô -> đặt lại đúng giá trị/chữ cũ
        if (hiddenEl) hiddenEl.value = giaTriCu;
        if (textEl) textEl.value = chuCu;
      }
    });
  }

  function collectPkDetails(root) {
    // v5.83: dòng là <tr data-prow> — KHÔNG dùng '> div' (sẽ gom 0 dòng -> báo "chưa nhập phụ kiện nào").
    return Array.from(root.querySelectorAll('#pkRows > [data-prow]')).map(r => {
      const rid = r.dataset.rid;
      const donGiaEl = r.querySelector('.p-dongia'); // v5.4: chi ton tai o form Nhap (showDonGia)
      return {
        phuKienId: getSearchableValue('pksel_' + rid), soLuong: r.querySelector('.p-sl').value,
        donVi: r.querySelector('.p-dvt').value, ghiChu: r.querySelector('.p-ghichu').value,
        donGia: donGiaEl ? donGiaEl.value : null
      };
    }).filter(d => d.phuKienId && Number(d.soLuong) > 0);
  }

  function getTabs(user) {
    const perm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.PHUKIEN || {});
    const tabs = [];
    if (perm.canView) tabs.push({ key: 'phieunhap', label: 'Phiếu Nhập' });
    if (perm.canView) tabs.push({ key: 'phieuxuat', label: 'Phiếu Xuất' });
    tabs.push({ key: 'thekho', label: 'Thẻ kho / Tồn kho' });
    tabs.push({ key: 'danhmuc', label: 'Danh mục phụ kiện' });
    tabs.push({ key: 'loai', label: 'Loại phụ kiện' });
    return tabs;
  }

  async function render(el, user, tabKey) {
    container = el; currentUser = user;
    const rawPerm = user.isAdmin ? { canView: true, canCreate: true, canEdit: true, canDelete: true } : (user.permissions.PHUKIEN || {});

    // 'phieu' la tab cu da bi tach thanh 'phieunhap'/'phieuxuat', chi con lai o day de xu ly gia tri
    // mac dinh/ton du tu truoc: khong co quyen tao thi ve 'thekho' (giu dung logic cu).
    if (tabKey) activeTab = tabKey;
    else if (activeTab === 'phieu') activeTab = rawPerm.canCreate ? 'phieunhap' : 'thekho';

    // v5.3: giao voi quyen rieng theo chuc nang (tab dang mo) - xem effectivePerm() trong common.js.
    const perm = effectivePerm(user, 'PHUKIEN', activeTab, rawPerm);
    dm = (await apiGet('/api/phukien/danhmuc')).data;

    container.innerHTML = `<div id="pkBody"></div>`;

    if (activeTab === 'phieunhap') return renderPhieuNhap(perm);
    if (activeTab === 'phieuxuat') return renderPhieuXuat(perm);
    if (activeTab === 'danhmuc') return renderDanhMuc(perm);
    if (activeTab === 'loai') return renderLoai(perm);
    return renderTheKho();
  }

  // v5.0 (muc 5a): cap nhat lai option cua TAT CA select "Loai PK" dang mo trong 1 modal, sau khi
  // them 1 loai moi nhanh ngay tai form - giu nguyen lua chon hien tai cua tung select.
  function refreshAllLoaiSelects(root) {
    root.querySelectorAll('.p-loai').forEach(sel => {
      const current = sel.value;
      sel.innerHTML = '<option value="">-- Tất cả loại --</option>' + dm.loaiPhuKien.map(l => `<option value="${escapeHtml(l.TenLoai)}">${escapeHtml(l.TenLoai)}</option>`).join('');
      sel.value = current;
    });
    // v5.95: ô "Loại phụ kiện của phiếu" ở đầu phiếu nhập cũng phải có loại vừa thêm.
    const selPhieu = root.querySelector('#pkLoaiPhieu');
    if (selPhieu) {
      const cur = selPhieu.value;
      // v6.10: ô này nay là BỘ LỌC, mục rỗng phải là "Tất cả loại" (đồng bộ với lúc dựng form).
      selPhieu.innerHTML = '<option value="">-- Tất cả loại --</option>' + dm.loaiPhuKien.map(l => `<option value="${escapeHtml(l.TenLoai)}">${escapeHtml(l.TenLoai)}</option>`).join('');
      selPhieu.value = cur;
    }
  }

  // Khoi "+ Loai PK moi" gon, dung chung cho form Tao phieu Nhap (muc 5a: "Co the ... them Loai PK").
  function loaiMoiInlineHtml() {
    return `<div style="display:flex;gap:8px;align-items:end;margin:8px 0;">
      <div class="form-row" style="flex:1;max-width:240px;margin-bottom:0;"><label>Thêm Loại PK mới</label><input id="inpLoaiMoiNhanh" placeholder="VD: Dây kéo"></div>
      <button type="button" class="btn small secondary" id="btnAddLoaiNhanh">+ Thêm loại PK</button>
    </div>`;
  }
  function wireLoaiMoiInline(modal) {
    modal.querySelector('#btnAddLoaiNhanh').addEventListener('click', async () => {
      const input = modal.querySelector('#inpLoaiMoiNhanh');
      const tenLoai = input.value.trim();
      if (!tenLoai) { toast('Vui lòng nhập tên loại PK.', 'error'); return; }
      try {
        await apiPost('/api/phukien/loai', { tenLoai });
        dm.loaiPhuKien = (await apiGet('/api/phukien/danhmuc')).data.loaiPhuKien;
        refreshAllLoaiSelects(modal);
        input.value = '';
        toast('Đã thêm loại PK: ' + tenLoai, 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ---- Phieu Nhap: danh sach + tao/xem/sua/xoa (muc 5a) ----
  async function renderPhieuNhap(perm) {
    const body = document.getElementById('pkBody');
    const rows = await apiGet('/api/phukien/phieunhap').then(r => r.data);
    body.innerHTML = `
      <div class="toolbar">${perm.canCreate ? '<button class="btn" id="btnAddPhieu">+ Tạo phiếu nhập</button>' : ''}</div>
      <table><thead><tr><th>Số phiếu</th><th>Ngày</th><th>Nhà cung cấp</th><th>Số hóa đơn</th><th>Số dòng PK</th><th>Tổng SL</th><th>Người tạo</th><th>Ghi chú</th><th style="width:190px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>NPK-${String(r.PhieuID).padStart(5, '0')}</td>
        <td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.TenNCC)}</td><td>${escapeHtml(r.SoHoaDon)}</td>
        <td>${r.SoDongPhuKien}</td><td>${fmtNumber(r.TongSoLuong)}</td><td>${escapeHtml(r.NguoiTao)}</td><td>${escapeHtml(r.GhiChu)}</td>
        <td>
          <button type="button" class="btn small secondary act-view" data-id="${r.PhieuID}">Xem/In</button>
          ${perm.canEdit ? `<button type="button" class="btn small secondary act-edit" data-id="${r.PhieuID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button type="button" class="btn small danger act-del" data-id="${r.PhieuID}">Xóa</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Chưa có phiếu nhập nào</td></tr>'}</tbody></table>`;

    if (perm.canCreate) document.getElementById('btnAddPhieu').addEventListener('click', () => openPhieuNhapCreateModal());
    body.querySelectorAll('.act-view').forEach(btn => btn.addEventListener('click', () => openPhieuNhapDetailModal(btn.dataset.id)));
    ganBamDongXemChiTiet(body);   // v6.66.1: bấm cả dòng cũng mở chi tiết
    body.querySelectorAll('.act-edit').forEach(btn => btn.addEventListener('click', () => {
      const row = rows.find(r => String(r.PhieuID) === btn.dataset.id);
      // v5.85: mở form Sửa là hàm async (phải tải chi tiết dòng) -> bắt lỗi để nút không "im lặng".
      openPhieuNhapEditModal(row).catch(err => toast(err.message, 'error'));
    }));
    body.querySelectorAll('.act-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu nhập này? Toàn bộ dòng phụ kiện trong phiếu sẽ bị xóa theo.')) return;
      try { await apiDelete('/api/phukien/phieunhap/' + btn.dataset.id); toast('Đã xóa.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  // v5.4: rebuild dung theo mau_phieu.docx PHIẾU NHẬP KHO PHỤ KIỆN - tach dong Ngay/So/Don vi ban
  // hang/Ngay hoa don rieng tung dong, cot bang them "Loai PK" (d.TenLoai) va "Don gia" (d.DonGia),
  // 2 vai ky: Nguoi lap, Thu kho.
  function printPhieuNhapPK(header, lines) {
    printHtml('Phiếu nhập phụ kiện', `
      ${phieuHeaderHtml('PHIẾU NHẬP KHO PHỤ KIỆN', header.Ngay, header.PhieuID)}
      <p class="p-meta"><b>Đơn vị bán hàng:</b> ${escapeHtml(header.TenNCC || '')}</p>
      <p class="p-meta"><b>Ngày hóa đơn:</b> ${header.NgayHoaDon ? fmtDate(header.NgayHoaDon) : ''}${header.SoHoaDon ? ' &nbsp; <b>Số hóa đơn:</b> ' + escapeHtml(header.SoHoaDon) : ''}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      ${/* v5.88: mọi phiếu NPL đều có cột Ảnh (ảnh khai ở Danh mục phụ kiện) */''}
      ${/* v6.30: 2 cột QUY ĐỔI (số lượng + giá) theo tỷ lệ khai ở Danh mục phụ kiện. */''}
      <table><thead><tr><th style="width:38px;">STT</th><th style="width:80px;">Ảnh</th><th>Mã PK</th><th>Loại PK</th><th>Tên PK</th><th>ĐVT</th><th>Số lượng</th><th>Quy đổi</th><th>Đơn giá</th><th>Giá quy đổi</th></tr></thead>
      ${/* v5.94: + dòng TỔNG CỘNG số lượng (và tổng thành tiền nếu có khai đơn giá) */''}
      <tbody>${lines.map((d, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td style="text-align:center;">${anhPKPrintHtml(d)}</td><td>${escapeHtml(d.MaPhuKien)}</td><td>${escapeHtml(d.TenLoai || '')}</td><td>${escapeHtml(d.TenPhuKien)}</td><td>${escapeHtml(d.DonVi || '')}</td><td style="text-align:right;">${fmtNumber(d.SoLuong)}</td><td style="text-align:right;">${escapeHtml(chuoiQuyDoi(d))}</td><td style="text-align:right;">${d.DonGia != null ? fmtNumber(d.DonGia) : ''}</td><td style="text-align:right;">${escapeHtml(chuoiGiaQuyDoi(d))}</td></tr>`).join('')}
        <tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="5" style="text-align:right;">TỔNG CỘNG</td>
          <td style="text-align:right;">${fmtNumber(tongSLPhuKien(lines))}</td><td></td><td></td>
          <td style="text-align:right;">${tongTienPhuKien(lines) ? 'Thành tiền: ' + fmtNumber(tongTienPhuKien(lines)) : ''}</td></tr></tbody></table>
      <div class="p-sign"><div><div class="line">Người lập</div></div><div><div class="line">Thủ kho</div></div></div>`);
  }

  async function openPhieuNhapDetailModal(phieuId) {
    const res = await apiGet('/api/phukien/phieunhap/' + phieuId);
    const { header, lines } = res.data;
    const modal = openModal(`
      <h3>Phiếu nhập phụ kiện #${header.PhieuID}</h3>
      <p class="p-meta"><b>Ngày:</b> ${fmtDate(header.Ngay)} &nbsp; <b>Nhà cung cấp:</b> ${escapeHtml(header.TenNCC || '')} &nbsp; <b>Số hóa đơn:</b> ${escapeHtml(header.SoHoaDon || '')}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      ${/* v6.30: thêm cột QUY ĐỔI + GIÁ QUY ĐỔI (chỉ để đối chiếu, không lưu). */''}
      <table><thead><tr><th style="width:38px;">STT</th><th style="width:52px">Ảnh</th><th>Mã PK</th><th>Phụ kiện</th><th>Số lượng</th><th>ĐVT</th><th>Quy đổi</th><th>Đơn giá</th><th>Giá quy đổi</th><th>Ghi chú</th></tr></thead>
      <tbody>${lines.map((d, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${anhPKThumbHtml(d)}</td><td>${escapeHtml(d.MaPhuKien)}</td><td>${escapeHtml(d.TenPhuKien)}</td><td style="text-align:right;">${fmtNumber(d.SoLuong)}</td><td>${escapeHtml(d.DonVi || '')}</td><td style="text-align:right;color:#5f6368;">${escapeHtml(chuoiQuyDoi(d))}</td><td style="text-align:right;">${d.DonGia != null ? fmtNumber(d.DonGia) : ''}</td><td style="text-align:right;color:#5f6368;">${escapeHtml(chuoiGiaQuyDoi(d))}</td><td>${escapeHtml(d.GhiChu || '')}</td></tr>`).join('')}
        <tr style="font-weight:700;background:#f1f3f4;"><td></td><td colspan="3" style="text-align:right;">TỔNG CỘNG</td>
          <td style="text-align:right;">${fmtNumber(tongSLPhuKien(lines))}</td><td colspan="2"></td>
          <td style="text-align:right;">${tongTienPhuKien(lines) ? fmtNumber(tongTienPhuKien(lines)) : ''}</td><td colspan="2"></td></tr></tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnClose">Đóng</button>
        ${/* v6.13: sửa được NGAY trong cửa sổ xem — mở từ lịch sử mã phụ kiện không phải quay ra tab Phiếu nhập. */''}
        ${coQuyenSuaPK() ? '<button type="button" class="btn secondary" id="btnSuaPhieu">✏️ Sửa phiếu</button>' : ''}
        <button type="button" class="btn" id="btnPrint">🖨️ In phiếu</button>
      </div>`);
    modal.querySelector('#btnClose').addEventListener('click', closeModal);
    modal.querySelector('#btnPrint').addEventListener('click', () => printPhieuNhapPK(header, lines));
    const bSua = modal.querySelector('#btnSuaPhieu');
    if (bSua) bSua.addEventListener('click', () => openPhieuNhapEditModal(header));
  }
  // Quyền sửa phiếu (chỉ ẩn/hiện nút — máy chủ vẫn kiểm tra lại khi lưu).
  function coQuyenSuaPK() {
    if (!currentUser) return false;
    return !!currentUser.isAdmin || !!((currentUser.permissions || {}).PHUKIEN || {}).canEdit;
  }

  /* v5.85 — SỬA PHIẾU: nay sửa được CẢ CÁC DÒNG PHỤ KIỆN (trước chỉ sửa được đầu phiếu, muốn đổi 1
     dòng phải xóa cả phiếu rồi nhập lại). Dùng đúng bảng nhập liệu của form Tạo (pkColsHtml/pkHeadHtml/
     pkRowTemplate) rồi ĐIỀN SẴN dữ liệu cũ; khi Lưu gửi kèm `details` -> backend ghi đè toàn bộ dòng. */
  function dienDongPhieuVaoBang(root, lines) {
    root.querySelectorAll('#pkRows > [data-prow]').forEach((r, i) => {
      const l = lines[i];
      if (!l) return;
      const rid = r.dataset.rid;
      // Nạp danh sách ĐVT theo phụ kiện của dòng (giống lúc chọn phụ kiện thủ công).
      const item = (dm.phuKien || []).find(p => String(p.PhuKienID) === String(l.PhuKienID));
      fillDvtForRow(rid, item);
      const dvt = r.querySelector('.p-dvt');
      if (dvt && l.DonVi) {
        // ĐVT đã lưu có thể không còn trong danh mục (đổi đơn vị sau này) -> thêm tạm để không mất dữ liệu.
        if (![...dvt.options].some(o => o.value === l.DonVi)) dvt.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(l.DonVi)}">${escapeHtml(l.DonVi)}</option>`);
        dvt.value = l.DonVi;
      }
      r.querySelector('.p-sl').value = l.SoLuong != null ? l.SoLuong : '';
      r.querySelector('.p-ghichu').value = l.GhiChu || '';
      const g = r.querySelector('.p-dongia');
      if (g) g.value = l.DonGia != null ? l.DonGia : '';
      // v6.30: điền xong mới tính được 2 cột quy đổi (fillDvtForRow ở trên chạy lúc ô còn trống).
      veQuyDoiDong(r);
    });
  }
  // Danh sách phụ kiện dùng cho form SỬA = danh sách cơ sở + những phụ kiện ĐANG CÓ trong phiếu (kể cả
  // khi chúng không còn trong danh sách đã chỉ định NPL) — nếu thiếu, ô gõ-tìm sẽ hiện trống dù dữ liệu vẫn còn.
  function gopPhuKienCuaPhieu(base, lines) {
    const out = (base || []).slice();
    (lines || []).forEach(l => {
      if (out.some(p => String(p.PhuKienID) === String(l.PhuKienID))) return;
      const it = (dm.phuKien || []).find(p => String(p.PhuKienID) === String(l.PhuKienID));
      if (it) out.push(it);
    });
    return out;
  }

  async function openPhieuNhapEditModal(row) {
    let lines = [];
    try { lines = (await apiGet('/api/phukien/phieunhap/' + row.PhieuID)).data.lines || []; }
    catch (err) { toast('Không tải được chi tiết phiếu: ' + err.message, 'error'); return; }
    /* v5.95: phiếu nhập chỉ 1 LOẠI phụ kiện — loại của phiếu suy ra từ dòng đầu tiên đang có; đổi loại
       ở ô đầu phiếu thì mọi dòng nạp lại danh sách theo loại mới (phải chọn lại phụ kiện). */
    let loaiPhieu = '';
    if (lines.length) {
      const it0 = (dm.phuKien || []).find(p => String(p.PhuKienID) === String(lines[0].PhuKienID));
      loaiPhieu = (it0 && it0.TenLoai) || lines[0].TenLoai || '';
    }
    const dsTheoLoai = () => gopPhuKienCuaPhieu(
      loaiPhieu ? (dm.phuKien || []).filter(p => (p.TenLoai || '') === loaiPhieu) : (dm.phuKien || []), lines);
    const rowOpts = { showDonGia: true, get phuKienList() { return dsTheoLoai(); } };
    const modal = openModal(`
      <h3>Sửa phiếu nhập phụ kiện #${row.PhieuID}</h3>
      <form id="pkEditForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày *</label><input type="date" name="ngay" value="${new Date(row.Ngay).toISOString().slice(0, 10)}" required></div>
          ${/* v6.10: chỉ là BỘ LỌC, không bắt buộc — phiếu được gồm nhiều loại phụ kiện.
               v6.16: đổi bộ lọc KHÔNG còn xóa các dòng đang có. */''}
          <div class="form-row"><label>Lọc theo loại phụ kiện (chỉ để dễ tìm, không ảnh hưởng phiếu)</label>
            <select id="pkLoaiPhieu"><option value="">-- Tất cả loại --</option>${(dm.loaiPhuKien || []).map(l => `<option value="${escapeHtml(l.TenLoai)}"${l.TenLoai === loaiPhieu ? ' selected' : ''}>${escapeHtml(l.TenLoai)}</option>`).join('')}</select>
            <div class="empty-hint" style="padding:2px 0 0;">Đổi ô này chỉ thu gọn danh sách khi chọn mã — các dòng đã nhập vẫn giữ nguyên.</div></div>
          <div class="form-row"><label>Nhà cung cấp</label><select name="nccId"><option value="">--</option>${opt(dm.nhaCungCap, 'NCC_ID', 'TenNCC', row.NCC_ID)}</select></div>
          <div class="form-row"><label>Số hóa đơn</label><input name="soHoaDon" value="${escapeHtml(row.SoHoaDon || '')}"></div>
          <div class="form-row"><label>Ngày hóa đơn</label><input type="date" name="ngayHoaDon" value="${row.NgayHoaDon ? new Date(row.NgayHoaDon).toISOString().slice(0, 10) : ''}"></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu" value="${escapeHtml(row.GhiChu || '')}"></div>
        </div>
        <div class="lap-wrap"><table class="lap-table">${pkColsHtml(rowOpts)}${pkHeadHtml(rowOpts)}
          <tbody id="pkRows">${(lines.length ? lines.map(l => pkRowTemplate(Object.assign({}, rowOpts, { selected: l.PhuKienID }))).join('') : pkRowTemplate(rowOpts))}</tbody></table></div>
        <button type="button" class="btn small secondary" id="btnAddPk">+ Thêm dòng phụ kiện</button>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wirePkRows(modal, rowOpts);
    dienDongPhieuVaoBang(modal, lines);
    const selLoaiE = modal.querySelector('#pkLoaiPhieu');
    if (selLoaiE) selLoaiE.addEventListener('change', () => {
      /* v6.10: chỉ đổi BỘ LỌC danh sách mã, không đổi bản chất phiếu.
         v6.16: GIỮ NGUYÊN các dòng đang có (mặc định của refreshAllRowsPhuKienList) — trước đây đổi bộ lọc
         là xóa trắng hết phụ kiện đã nhập, muốn thêm 1 dòng loại khác là phải gõ lại cả phiếu. */
      loaiPhieu = selLoaiE.value;
      refreshAllRowsPhuKienList(modal, dsTheoLoai());
      // Dòng thêm mới sau đó cũng phải lấy theo bộ lọc mới -> cập nhật getter của rowOpts (đã là getter).
    });
    modal.querySelector('#pkEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const details = collectPkDetails(modal);
      if (!details.length) { toast('Phiếu phải có ít nhất 1 phụ kiện có số lượng > 0.', 'error'); return; }
      // v6.10: bỏ chặn lẫn loại — phiếu nhập được gồm nhiều loại phụ kiện.
      try {
        await apiPut('/api/phukien/phieunhap/' + row.PhieuID, {
          ngay: fd.get('ngay'), nccId: fd.get('nccId') || null, soHoaDon: fd.get('soHoaDon'),
          ngayHoaDon: fd.get('ngayHoaDon') || null, ghiChu: fd.get('ghiChu'), details
        });
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  function openPhieuNhapCreateModal() {
    /* v5.95: mỗi phiếu nhập chỉ 1 loại phụ kiện -> "Loại PK" đưa lên đầu phiếu.
       v6.10 — BỎ RÀNG BUỘC ĐÓ theo yêu cầu: 1 phiếu nhập ĐƯỢC nhiều loại phụ kiện, và ô "Loại phụ kiện
       của phiếu" KHÔNG còn bắt buộc. Ô đó nay chỉ là BỘ LỌC cho gọn danh sách khi chọn mã (để trống =
       tìm trong tất cả các loại). Ràng buộc ở backend cũng đã gỡ (xem kiemTraCungLoaiPK ở phukien.js). */
    let loaiPhieu = '';
    const dsTheoLoai = () => (loaiPhieu ? (dm.phuKien || []).filter(p => (p.TenLoai || '') === loaiPhieu) : (dm.phuKien || []));
    const rowOpts = { showDonGia: true, get phuKienList() { return dsTheoLoai(); } };
    const modal = openModal(`
      <h3>Tạo phiếu Nhập phụ kiện</h3>
      <form id="pkForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày *</label><input type="date" name="ngay" value="${new Date().toISOString().slice(0, 10)}" required></div>
          ${/* v6.10: KHÔNG còn bắt buộc — chỉ là bộ lọc cho dễ tìm mã. */''}
          <div class="form-row"><label>Lọc theo loại phụ kiện (không bắt buộc)</label>
            <select id="pkLoaiPhieu"><option value="">-- Tất cả loại --</option>${(dm.loaiPhuKien || []).map(l => `<option value="${escapeHtml(l.TenLoai)}">${escapeHtml(l.TenLoai)}</option>`).join('')}</select></div>
          <div class="form-row"><label>Nhà cung cấp</label><select name="nccId"><option value="">--</option>${opt(dm.nhaCungCap, 'NCC_ID', 'TenNCC')}</select></div>
          <div class="form-row"><label>Số hóa đơn</label><input name="soHoaDon" placeholder="VD: HD00123"></div>
          <div class="form-row"><label>Ngày hóa đơn</label><input type="date" name="ngayHoaDon"></div>
        </div>
        <div class="empty-hint" id="pkLoaiHint">Một phiếu nhập được nhiều LOẠI phụ kiện. Ô lọc ở trên chỉ để thu gọn danh sách khi chọn mã — để trống là tìm trong tất cả các loại.</div>
        ${/* v5.83: bảng thật + cuộn NGAY TRONG bảng (.lap-wrap), tiêu đề đứng yên khi cuộn dòng */''}
        <div class="lap-wrap"><table class="lap-table">${pkColsHtml(rowOpts)}${pkHeadHtml(rowOpts)}
          <tbody id="pkRows">${pkRowTemplate(rowOpts)}</tbody></table></div>
        <button type="button" class="btn small secondary" id="btnAddPk">+ Thêm dòng phụ kiện</button>
        ${loaiMoiInlineHtml()}
        <div class="form-row" style="margin-top:10px;"><label>Ghi chú chung</label><input name="ghiChu"></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu phiếu nhập</button>
        </div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wirePkRows(modal, rowOpts);
    wireLoaiMoiInline(modal);
    // v6.10: đổi ô lọc -> chỉ nạp lại danh sách MÃ cho các dòng CHƯA chọn gì; dòng đã chọn giữ nguyên.
    const selLoai = modal.querySelector('#pkLoaiPhieu');
    selLoai.addEventListener('change', () => {
      loaiPhieu = selLoai.value;
      const ds = dsTheoLoai();
      const hint = modal.querySelector('#pkLoaiHint');
      if (hint) hint.textContent = loaiPhieu
        ? `Đang lọc loại "${loaiPhieu}" — có ${ds.length} mã. Vẫn thêm được dòng thuộc loại khác: đổi lại ô lọc này.`
        : 'Một phiếu nhập được nhiều LOẠI phụ kiện. Ô lọc ở trên chỉ để thu gọn danh sách khi chọn mã — để trống là tìm trong tất cả các loại.';
      refreshAllRowsPhuKienList(modal, ds);
    });

    modal.querySelector('#pkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const details = collectPkDetails(modal);
      if (!details.length) { toast('Vui lòng nhập ít nhất 1 phụ kiện có số lượng > 0.', 'error'); return; }
      // v6.10: đã bỏ bước chặn lẫn loại (canhBaoLanLoaiPK) — 1 phiếu nhập được nhiều loại phụ kiện.
      try {
        const res = await apiPost('/api/phukien/phieu', {
          ngay: fd.get('ngay'), loaiPhieu: 'Nhập', nccId: fd.get('nccId') || null, soHoaDon: fd.get('soHoaDon') || null,
          ngayHoaDon: fd.get('ngayHoaDon') || null, ghiChu: fd.get('ghiChu'), details
        });
        toast('Đã lưu phiếu nhập.', 'success');
        closeModal();
        await render(container, currentUser);
        openPhieuNhapDetailModal(res.data.phieuId);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ---- Phieu Xuat: danh sach + tao/xem/sua/xoa (muc 5b) ----
  async function renderPhieuXuat(perm) {
    const body = document.getElementById('pkBody');
    const rows = await apiGet('/api/phukien/phieuxuat').then(r => r.data);
    body.innerHTML = `
      <div class="toolbar">${perm.canCreate ? '<button class="btn" id="btnAddPhieu">+ Tạo phiếu xuất</button>' : ''}</div>
      ${/* v5.84: thêm cột Mã rập (theo đơn hàng gắn kèm) */''}
      <table><thead><tr><th>Số phiếu</th><th>Ngày</th><th>Đơn hàng</th><th>Mã rập</th><th>Số dòng PK</th><th>Tổng SL</th><th>Người tạo</th><th>Ghi chú</th><th style="width:190px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>XPK-${String(r.PhieuID).padStart(5, '0')}</td>
        <td>${fmtDate(r.Ngay)}</td><td>${escapeHtml(r.MaDH || r.MaDon || '')}</td><td>${escapeHtml(r.MaRap || '')}</td>
        <td>${r.SoDongPhuKien}</td><td>${fmtNumber(r.TongSoLuong)}</td><td>${escapeHtml(r.NguoiTao)}</td><td>${escapeHtml(r.GhiChu)}</td>
        <td>
          <button type="button" class="btn small secondary act-view" data-id="${r.PhieuID}">Xem/In</button>
          ${perm.canEdit ? `<button type="button" class="btn small secondary act-edit" data-id="${r.PhieuID}">Sửa</button>` : ''}
          ${perm.canDelete ? `<button type="button" class="btn small danger act-del" data-id="${r.PhieuID}">Xóa</button>` : ''}
        </td></tr>`).join('') || '<tr><td colspan="9" class="empty-hint">Chưa có phiếu xuất nào</td></tr>'}</tbody></table>`;

    if (perm.canCreate) document.getElementById('btnAddPhieu').addEventListener('click', () => openPhieuXuatCreateModal());
    body.querySelectorAll('.act-view').forEach(btn => btn.addEventListener('click', () => openPhieuXuatDetailModal(btn.dataset.id)));
    ganBamDongXemChiTiet(body);   // v6.66.1: bấm cả dòng cũng mở chi tiết
    body.querySelectorAll('.act-edit').forEach(btn => btn.addEventListener('click', () => {
      const row = rows.find(r => String(r.PhieuID) === btn.dataset.id);
      openPhieuXuatEditModal(row).catch(err => toast(err.message, 'error'));
    }));
    body.querySelectorAll('.act-del').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu xuất này? Toàn bộ dòng phụ kiện trong phiếu sẽ bị xóa theo.')) return;
      try { await apiDelete('/api/phukien/phieuxuat/' + btn.dataset.id); toast('Đã xóa.', 'success'); render(container, currentUser); }
      catch (err) { toast(err.message, 'error'); }
    }));
  }

  /* v5.84 — BẢNG "CHỈ ĐỊNH NPL (THAM KHẢO)" trong form Tạo phiếu Xuất phụ kiện.
     Trước đây chọn đơn hàng xong chỉ có 1 dòng chữ "Chỉ hiện N phụ kiện đã Chỉ định NPL" — người lập
     phiếu không thấy ĐÃ CHỈ ĐỊNH BAO NHIÊU, ĐÃ XUẤT BAO NHIÊU, CÒN LẠI BAO NHIÊU nên phải mở tab khác
     để đối chiếu. Nay hiện bảng ngay dưới ô chọn đơn (giống "Chỉ định vải SX (tham khảo)" ở phiếu xuất
     kho vải). SLDaXuat là LŨY KẾ mọi phiếu xuất của đơn (backend GET /donhang/:id/npl, v5.84). */
  function bangChiDinhNplHtml(list) {
    if (!list || !list.length) return '';
    return `<div class="bang-cuon" style="margin:6px 0 10px;max-height:34vh;">
      <table style="font-size:12.5px;">
      <thead><tr><th style="width:52px">Ảnh</th><th>Mã PK</th><th>Tên phụ kiện</th><th>ĐVT</th>
        <th style="text-align:right;">SL chỉ định</th><th style="text-align:right;">Đã xuất</th><th style="text-align:right;">Còn lại</th></tr></thead>
      <tbody>${list.map(p => {
        const cd = Number(p.SLTheoChiDinh || 0), dx = Number(p.SLDaXuat || 0), con = cd - dx;
        return `<tr><td>${anhPKThumbHtml(p)}</td><td>${escapeHtml(p.MaPhuKien)}</td><td>${escapeHtml(p.TenPhuKien)}</td><td>${escapeHtml(p.DonViCoBan || '')}</td>
          <td style="text-align:right;">${fmtNumber(cd)}</td><td style="text-align:right;">${fmtNumber(dx)}</td>
          <td style="text-align:right;font-weight:600;color:${con > 0 ? '#c0392b' : '#1e8e3e'};">${fmtNumber(con)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  // v5.4: rebuild dung theo mau_phieu.docx PHIẾU XUẤT KHO PHỤ KIỆN - cot bang them "Loai PK" (d.TenLoai)
  // va "SL theo chi dinh" (d.SLTheoChiDinh, tu DonHangChiTietPhuKien - xem backend getPhieuDetail),
  // 4 vai ky: Nguoi lap, Bo phan cat, NV chi dinh NPL, Thu kho (truoc chi co 2 vai).
  function printPhieuXuatPK(header, lines) {
    // v5.7: them Anh san pham (header.AnhSanPham - backend da bo sung join, xem getPhieuDetail trong
    // phukien.js) - yeu cau v5.7 "thêm Ảnh sản phẩm vào các bản in".
    const anhSpHtml = header.AnhSanPham ? `<img src="${escapeHtml(header.AnhSanPham)}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;float:right;">` : '';
    printHtml('Phiếu xuất phụ kiện', `
      ${phieuHeaderHtml('PHIẾU XUẤT KHO PHỤ KIỆN', header.Ngay, header.PhieuID)}
      ${anhSpHtml}
      ${/* v5.84: thêm Mã rập cạnh Đơn hàng trên BẢN IN */''}
      <p class="p-meta"><b>Đơn hàng:</b> ${escapeHtml(header.MaDH || header.MaDon || '')}${header.MaRap ? ` &nbsp; <b>Mã rập:</b> ${escapeHtml(header.MaRap)}` : ''}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      ${/* v5.88: + cột Ảnh */''}
      ${/* v6.30: cột QUY ĐỔI (không có tiền — phiếu xuất phụ kiện theo mẫu không thể hiện giá). */''}
      <table><thead><tr><th style="width:38px;">STT</th><th style="width:80px;">Ảnh</th><th>Mã PK</th><th>Loại PK</th><th>Tên PK</th><th>ĐVT</th><th>SL theo chỉ định</th><th>SL thực tế</th><th>Quy đổi</th></tr></thead>
      <tbody>${lines.map((d, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td style="text-align:center;">${anhPKPrintHtml(d)}</td><td>${escapeHtml(d.MaPhuKien)}</td><td>${escapeHtml(d.TenLoai || '')}</td><td>${escapeHtml(d.TenPhuKien)}</td><td>${escapeHtml(d.DonVi || '')}</td><td>${d.SLTheoChiDinh != null ? fmtNumber(d.SLTheoChiDinh) : ''}</td><td>${fmtNumber(d.SoLuong)}</td><td style="text-align:right;">${escapeHtml(chuoiQuyDoi(d))}</td></tr>`).join('')}</tbody></table>
      <div class="p-sign"><div><div class="line">Người lập</div></div><div><div class="line">Bộ phận cắt</div></div><div><div class="line">NV chỉ định NPL</div></div><div><div class="line">Thủ kho</div></div></div>`);
  }

  async function openPhieuXuatDetailModal(phieuId) {
    const res = await apiGet('/api/phukien/phieuxuat/' + phieuId);
    const { header, lines } = res.data;
    const modal = openModal(`
      <h3>Phiếu xuất phụ kiện #${header.PhieuID}</h3>
      <p class="p-meta"><b>Ngày:</b> ${fmtDate(header.Ngay)} &nbsp; <b>Đơn hàng:</b> ${escapeHtml(header.MaDH || header.MaDon || '')}${header.MaRap ? ` &nbsp; <b>Mã rập:</b> ${escapeHtml(header.MaRap)}` : ''}</p>
      ${header.GhiChu ? `<p class="p-meta"><b>Ghi chú:</b> ${escapeHtml(header.GhiChu)}</p>` : ''}
      ${/* v6.30: phiếu XUẤT chỉ thêm cột QUY ĐỔI số lượng, KHÔNG có tiền (giữ đúng mẫu phiếu xuất). */''}
      <table><thead><tr><th style="width:38px;">STT</th><th style="width:52px">Ảnh</th><th>Mã PK</th><th>Phụ kiện</th><th>Số lượng</th><th>SL chỉ định</th><th>ĐVT</th><th>Quy đổi</th><th>Ghi chú</th></tr></thead>
      <tbody>${lines.map((d, __i) => `<tr><td style="text-align:center;">${__i + 1}</td><td>${anhPKThumbHtml(d)}</td><td>${escapeHtml(d.MaPhuKien)}</td><td>${escapeHtml(d.TenPhuKien)}</td><td>${fmtNumber(d.SoLuong)}</td><td>${d.SLTheoChiDinh != null ? fmtNumber(d.SLTheoChiDinh) : '-'}</td><td>${escapeHtml(d.DonVi || '')}</td><td style="text-align:right;color:#5f6368;">${escapeHtml(chuoiQuyDoi(d))}</td><td>${escapeHtml(d.GhiChu || '')}</td></tr>`).join('')}</tbody></table>
      <div class="modal-actions">
        <button type="button" class="btn secondary" id="btnClose">Đóng</button>
        ${coQuyenSuaPK() ? '<button type="button" class="btn secondary" id="btnSuaPhieuX">✏️ Sửa phiếu</button>' : ''}
        <button type="button" class="btn" id="btnPrint">🖨️ In phiếu</button>
      </div>`);
    modal.querySelector('#btnClose').addEventListener('click', closeModal);
    modal.querySelector('#btnPrint').addEventListener('click', () => printPhieuXuatPK(header, lines));
    const bSuaX = modal.querySelector('#btnSuaPhieuX');
    if (bSuaX) bSuaX.addEventListener('click', () => openPhieuXuatEditModal(header));
  }

  async function openPhieuXuatEditModal(row) {
    let lines = [];
    try { lines = (await apiGet('/api/phukien/phieuxuat/' + row.PhieuID)).data.lines || []; }
    catch (err) { toast('Không tải được chi tiết phiếu: ' + err.message, 'error'); return; }
    // Đơn hàng đang gắn -> danh sách phụ kiện theo "Chỉ định NPL" của đơn đó (giữ đúng khóa xuất theo
    // chỉ định của v5.47); cộng thêm các phụ kiện đang có trong phiếu để không mất dòng cũ.
    let dsGoc = dm.phuKien;
    if (row.DonHangID) {
      try { dsGoc = (await apiGet('/api/phukien/donhang/' + row.DonHangID + '/npl')).data || []; } catch (e) { dsGoc = dm.phuKien; }
    }
    let currentPhuKienList = gopPhuKienCuaPhieu(dsGoc, lines);
    const rowOpts = { showChiDinh: true, get phuKienList() { return currentPhuKienList; } };
    const modal = openModal(`
      <h3>Sửa phiếu xuất phụ kiện #${row.PhieuID}</h3>
      <form id="pkEditForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày *</label><input type="date" name="ngay" value="${new Date(row.Ngay).toISOString().slice(0, 10)}" required></div>
          <div class="form-row"><label>Đơn hàng sản xuất</label>
            <select name="donHangId" id="pkOrderSelect"><option value="">-- Không gắn đơn hàng --</option>${opt(dm.donHang, 'DonHangID', 'MaDH', row.DonHangID)}</select></div>
          <div class="form-row"><label>Mã đơn khác / ghi chú đơn</label><input name="maDon" value="${escapeHtml(row.MaDon || '')}"></div>
          <div class="form-row"><label>Mã rập</label><input id="pkMaRap" readonly value="${escapeHtml(row.MaRap || '')}"></div>
          <div class="form-row"><label>Ghi chú</label><input name="ghiChu" value="${escapeHtml(row.GhiChu || '')}"></div>
        </div>
        <div class="empty-hint" id="pkNplHint" style="display:none;"></div>
        <div class="lap-wrap"><table class="lap-table">${pkColsHtml(rowOpts)}${pkHeadHtml(rowOpts)}
          <tbody id="pkRows">${(lines.length ? lines.map(l => pkRowTemplate(Object.assign({}, rowOpts, { selected: l.PhuKienID }))).join('') : pkRowTemplate(rowOpts))}</tbody></table></div>
        <button type="button" class="btn small secondary" id="btnAddPk">+ Thêm dòng phụ kiện</button>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    wirePkRows(modal, rowOpts);
    dienDongPhieuVaoBang(modal, lines);

    // Đổi đơn hàng ngay trong form Sửa (v5.85, giống phiếu xuất kho vải v5.64): nạp lại danh sách phụ
    // kiện theo chỉ định của đơn mới. LƯU Ý: đổi đơn sẽ XÓA lựa chọn phụ kiện của các dòng đang có
    // (bắt buộc chọn lại) — đúng như hành vi của form Tạo.
    const selDon = modal.querySelector('#pkOrderSelect');
    const hint = modal.querySelector('#pkNplHint');
    const oMaRap = modal.querySelector('#pkMaRap');
    selDon.addEventListener('change', async () => {
      const id = selDon.value;
      if (oMaRap) {
        const donCh = (dm.donHang || []).find(d => String(d.DonHangID) === String(id));
        oMaRap.value = (donCh && donCh.MaRap) ? donCh.MaRap : '';
      }
      if (!id) {
        currentPhuKienList = dm.phuKien;
        if (hint) { hint.style.display = 'none'; hint.textContent = ''; }
      } else {
        try {
          const list = (await apiGet('/api/phukien/donhang/' + id + '/npl')).data || [];
          currentPhuKienList = list;
          if (hint) {
            hint.style.display = '';
            hint.textContent = list.length
              ? `Chỉ hiện ${list.length} phụ kiện đã "Chỉ định NPL" cho đơn này — các dòng đang có phải chọn lại phụ kiện.`
              : 'Đơn này CHƯA "Chỉ định NPL" — không có phụ kiện để chọn.';
          }
        } catch (err) { toast(err.message, 'error'); currentPhuKienList = []; }
      }
      // v6.16: đổi ĐƠN HÀNG gắn kèm ở phiếu XUẤT thì danh sách phụ kiện hợp lệ đổi hẳn -> phải chọn lại.
      refreshAllRowsPhuKienList(modal, currentPhuKienList, { xoaLuaChon: true });
    });

    modal.querySelector('#pkEditForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const details = collectPkDetails(modal);
      if (!details.length) { toast('Phiếu phải có ít nhất 1 phụ kiện có số lượng > 0.', 'error'); return; }
      try {
        await apiPut('/api/phukien/phieuxuat/' + row.PhieuID, {
          ngay: fd.get('ngay'), maDon: fd.get('maDon'), ghiChu: fd.get('ghiChu'),
          donHangId: fd.get('donHangId') || null, details
        });
        closeModal(); toast('Đã lưu.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // v5.83: preselectMaDH — mở form với ĐƠN HÀNG chọn sẵn (gọi từ Chỉ định NPL, xem openPhieuXuatFormChoDon).
  function openPhieuXuatCreateModal(preselectMaDH) {
    const modal = openModal(`
      <h3>Tạo phiếu Xuất phụ kiện</h3>
      <form id="pkForm">
        <div class="form-grid">
          <div class="form-row"><label>Ngày *</label><input type="date" name="ngay" value="${new Date().toISOString().slice(0, 10)}" required></div>
          <div class="form-row"><label>Đơn hàng sản xuất (nếu xuất kèm đơn)</label>
            <select name="donHangId" id="pkOrderSelect"><option value="">-- Không gắn đơn hàng --</option>${opt(dm.donHang, 'DonHangID', 'MaDH')}</select></div>
          <div class="form-row"><label>Mã đơn khác / ghi chú đơn</label><input name="maDon" placeholder="VD: chuyền 2, đơn ngoài hệ thống..."></div>
          ${/* v5.84: Mã rập tự điền theo đơn hàng (chỉ để xem/đối chiếu, không gửi lên server) */''}
          <div class="form-row"><label>Mã rập</label><input id="pkMaRap" readonly placeholder="(tự điền theo đơn hàng)"></div>
        </div>
        ${/* v6.66.3: TRẢ HÀNG VỀ NHÀ CUNG CẤP.
              Không thêm cột Đơn giá vào bảng nhập tay — phiếu NHẬP phụ kiện đã có sẵn đơn giá, nên
              chọn thẳng dòng trong phiếu nhập của NCC đó là có giá, số giảm nợ khớp đúng số đã ghi nợ.
              Tích ô này thì bảng nhập tay ẨN đi, thay bằng bảng chọn dòng từ phiếu nhập. */''}
        <div class="form-row" style="margin-top:6px;">
          <label style="display:flex;gap:6px;align-items:center;">
            <input type="checkbox" id="pkTraNCC"> Trả hàng về nhà cung cấp (giảm công nợ phải trả)
          </label>
        </div>
        <div id="pkTraBox" style="display:none;">
          <div class="form-grid">
            <div class="form-row"><label>Nhà cung cấp <span style="color:#c62828;">*</span></label>
              <select id="pkTraNcc"><option value="">-- Chọn nhà cung cấp --</option>${opt(dm.nhaCungCap, 'NCC_ID', 'TenNCC')}</select></div>
            <div class="form-row"><label>Phiếu nhập của NCC <span style="color:#c62828;">*</span></label>
              <select id="pkTraPhieu"><option value="">-- Chọn nhà cung cấp trước --</option></select></div>
          </div>
          <div class="empty-hint" style="color:#e65100;">
            Giá lấy nguyên từ phiếu nhập, không sửa được — để số giảm công nợ khớp đúng số đã ghi nợ lúc nhập.
          </div>
          <div id="pkTraBang"><div class="empty-hint">Chọn phiếu nhập để hiện danh sách phụ kiện.</div></div>
        </div>
        <div id="pkThuongBox">
        <div class="empty-hint" id="pkNplHint" style="display:none;"></div>
        ${/* v5.84: BẢNG "Chỉ định NPL (tham khảo)" — giống bảng chỉ định vải SX ở phiếu xuất kho vải */''}
        <div id="pkCdBox"></div>
        ${/* v5.83: bảng thật + cuộn NGAY TRONG bảng (.lap-wrap) */''}
        <div class="lap-wrap"><table class="lap-table">${pkColsHtml({ showChiDinh: true })}${pkHeadHtml({ showChiDinh: true })}
          <tbody id="pkRows">${pkRowTemplate({ showChiDinh: true })}</tbody></table></div>
        <button type="button" class="btn small secondary" id="btnAddPk">+ Thêm dòng phụ kiện</button>
        </div>
        <div class="form-row" style="margin-top:10px;"><label>Ghi chú chung</label><input name="ghiChu"></div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu phiếu xuất</button>
        </div>
      </form>`);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    let currentPhuKienList = dm.phuKien;
    // v5.8.1: showChiDinh:true de moi dong (dong dau + cac dong them qua "+ Them dong") deu co san
    // span "SL chi dinh" (xem pkRowTemplate) - noi dung chi hien khi currentPhuKienList dang la danh
    // sach da loc theo NPL (sau khi chon don hang) VA dong do da chon 1 phu kien cu the.
    wirePkRows(modal, { showChiDinh: true, get phuKienList() { return currentPhuKienList; } });

    // v5.47: KHÔI PHỤC khóa xuất theo "Chỉ định NPL" — chọn đơn hàng thì CHỈ cho chọn phụ kiện ĐÃ được
    // "Chỉ định NPL" cho đơn đó (GET /donhang/:id/npl). KHÔNG gắn đơn -> vẫn xuất tự do (mọi phụ kiện).
    const pkOrderSel = modal.querySelector('#pkOrderSelect');
    const pkNplHint = modal.querySelector('#pkNplHint');
    const pkCdBox = modal.querySelector('#pkCdBox');
    const pkMaRap = modal.querySelector('#pkMaRap');
    pkOrderSel.addEventListener('change', async () => {
      const id = pkOrderSel.value;
      // v5.84: Mã rập lấy từ danh mục đơn hàng (backend đã gộp từ DonHangChiTietSoDo).
      if (pkMaRap) {
        const donCh = (dm.donHang || []).find(d => String(d.DonHangID) === String(id));
        pkMaRap.value = (donCh && donCh.MaRap) ? donCh.MaRap : '';
      }
      if (!id) {
        currentPhuKienList = dm.phuKien;
        if (pkNplHint) { pkNplHint.style.display = 'none'; pkNplHint.textContent = ''; }
        if (pkCdBox) pkCdBox.innerHTML = '';
      } else {
        try {
          const list = (await apiGet('/api/phukien/donhang/' + id + '/npl')).data || [];
          currentPhuKienList = list;
          if (pkNplHint) {
            pkNplHint.style.display = '';
            pkNplHint.textContent = list.length
              ? `Chỉ hiện ${list.length} phụ kiện đã "Chỉ định NPL" cho đơn này.`
              : 'Đơn này CHƯA "Chỉ định NPL" — không có phụ kiện để chọn. Vào Quản lý sản xuất → Chỉ định NPL để khai trước.';
          }
          if (pkCdBox) pkCdBox.innerHTML = bangChiDinhNplHtml(list);
        } catch (err) { toast(err.message, 'error'); currentPhuKienList = []; if (pkCdBox) pkCdBox.innerHTML = ''; }
      }
      // v6.16: đổi ĐƠN HÀNG gắn kèm ở phiếu XUẤT thì danh sách phụ kiện hợp lệ đổi hẳn -> phải chọn lại.
      refreshAllRowsPhuKienList(modal, currentPhuKienList, { xoaLuaChon: true });
    });

    /* v5.83: đơn hàng chọn sẵn khi vào từ "Chỉ định NPL". BẮT BUỘC bắn sự kiện 'change' thay vì chỉ
       gán .value vì (1) chính listener ở trên mới nạp danh sách phụ kiện theo NPL của đơn, và
       (2) combobox gõ-tìm (enhanceSelects, v5.51) chỉ đồng bộ chữ hiển thị khi có 'change'
       -> nếu thiếu, ô nhìn như đang TRỐNG dù value đã có. */
    if (preselectMaDH) {
      const don = (dm.donHang || []).find(d => String(d.MaDH) === String(preselectMaDH));
      if (don) {
        pkOrderSel.value = don.DonHangID;
        pkOrderSel.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        toast(`Không thấy đơn hàng ${preselectMaDH} trong danh sách chọn — vui lòng chọn thủ công.`, 'error');
      }
    }

    /* ---------- v6.66.3: TRẢ HÀNG VỀ NCC — chọn dòng từ phiếu nhập của chính NCC đó ---------- */
    const oTra = modal.querySelector('#pkTraNCC');
    const selNcc = modal.querySelector('#pkTraNcc');
    const selPhieu = modal.querySelector('#pkTraPhieu');
    oTra.addEventListener('change', () => {
      modal.querySelector('#pkTraBox').style.display = oTra.checked ? '' : 'none';
      modal.querySelector('#pkThuongBox').style.display = oTra.checked ? 'none' : '';
      if (!oTra.checked) { selNcc.value = ''; selPhieu.innerHTML = '<option value="">-- Chọn nhà cung cấp trước --</option>'; }
    });
    selNcc.addEventListener('change', async () => {
      modal.querySelector('#pkTraBang').innerHTML = '<div class="empty-hint">Chọn phiếu nhập...</div>';
      if (!selNcc.value) { selPhieu.innerHTML = '<option value="">-- Chọn nhà cung cấp trước --</option>'; return; }
      const ds = (await apiGet(`/api/phukien/ncc/${selNcc.value}/phieunhap`)).data || [];
      selPhieu.innerHTML = '<option value="">-- Chọn phiếu nhập --</option>' + ds.map(p =>
        `<option value="${p.PhieuID}">NPK-${String(p.PhieuID).padStart(5, '0')} — ${fmtDate(p.Ngay)}`
        + `${p.SoHoaDon ? ' — HĐ ' + escapeHtml(p.SoHoaDon) : ''} — ${fmtTien(p.TongTien)} đ</option>`).join('');
      if (!ds.length) modal.querySelector('#pkTraBang').innerHTML = '<div class="empty-hint">Nhà cung cấp này chưa có phiếu nhập phụ kiện nào.</div>';
    });
    selPhieu.addEventListener('change', async () => {
      const hop = modal.querySelector('#pkTraBang');
      if (!selPhieu.value) { hop.innerHTML = '<div class="empty-hint">Chọn phiếu nhập để hiện danh sách phụ kiện.</div>'; return; }
      hop.innerHTML = '<div class="empty-hint">Đang tải...</div>';
      const kq = await apiGet(`/api/phukien/phieunhap/${selPhieu.value}/dongtra`);
      if (!kq.success) { hop.innerHTML = `<div class="empty-hint" style="color:#c62828;">${escapeHtml(kq.message || 'Lỗi')}</div>`; return; }
      const ds = (kq.data || []).filter(r => Number(r.ConTra) > 0);
      if (!ds.length) { hop.innerHTML = '<div class="empty-hint">Phiếu này không còn dòng nào trả lại được (đã trả hết).</div>'; return; }
      hop.innerHTML = `
        <div class="table-wrap" style="max-height:320px;overflow:auto;">
        <table class="data-table phieu-ke"><thead><tr>
          <th style="width:40px;"></th><th style="width:50px;">STT</th>
          <th>Mã phụ kiện</th><th>Tên phụ kiện</th><th>ĐVT</th>
          <th class="num">SL nhập</th><th class="num">Đã trả</th><th class="num">Còn trả được</th>
          <th class="num">Đơn giá</th><th style="width:110px;">SL trả</th>
        </tr></thead><tbody>
          ${ds.map((r, i) => `<tr data-pkid="${r.PhuKienID}" data-con="${r.ConTra}"
              data-gia="${Number(r.DonGia) || 0}" data-dvt="${escapeHtml(r.DonVi || '')}">
            <td><input type="checkbox" class="pktra-tick"></td>
            <td>${i + 1}</td>
            <td><b>${escapeHtml(r.MaPhuKien || '')}</b></td>
            <td>${escapeHtml(r.TenPhuKien || '')}</td>
            <td>${escapeHtml(r.DonVi || '')}</td>
            <td class="num">${fmtNumber(r.SoLuong)}</td>
            <td class="num">${fmtNumber(r.DaTraNCC)}</td>
            <td class="num"><b>${fmtNumber(r.ConTra)}</b></td>
            <td class="num">${fmtTien(r.DonGia)}</td>
            <td><input type="number" class="pktra-sl" min="0" step="0.01" max="${r.ConTra}" style="width:95px;"></td>
          </tr>`).join('')}
        </tbody></table></div>`;
      /* Tích ô = trả HẾT số còn lại; bỏ tích thì XÓA số — để số lại là dòng vẫn bị tính vào phiếu
         dù đã bỏ tích (lỗi rất dễ gặp). */
      hop.querySelectorAll('.pktra-tick').forEach(cb => cb.addEventListener('change', () => {
        const tr = cb.closest('tr');
        tr.querySelector('.pktra-sl').value = cb.checked ? tr.dataset.con : '';
      }));
      hop.querySelectorAll('.pktra-sl').forEach(o => o.addEventListener('input', () => {
        o.closest('tr').querySelector('.pktra-tick').checked = Number(o.value) > 0;
      }));
    });
    // Gom các dòng trả NCC thành `details` đúng khuôn POST /phieu (kèm donGia lấy từ phiếu nhập).
    function collectTraNCC() {
      return Array.from(modal.querySelectorAll('#pkTraBang tr[data-pkid]')).map(tr => {
        const sl = Number(tr.querySelector('.pktra-sl').value) || 0;
        if (sl <= 0) return null;
        if (sl > Number(tr.dataset.con)) {
          toast(`Dòng ${tr.querySelector('b').textContent}: chỉ còn trả được ${tr.dataset.con}.`, 'error');
          return 'LOI';
        }
        return { phuKienId: Number(tr.dataset.pkid), soLuong: sl, donVi: tr.dataset.dvt || null, donGia: Number(tr.dataset.gia) || null };
      }).filter(Boolean);
    }

    modal.querySelector('#pkForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const traNCC = oTra.checked;
      let details;
      if (traNCC) {
        if (!selNcc.value) { toast('Chưa chọn nhà cung cấp nhận lại hàng.', 'error'); return; }
        details = collectTraNCC();
        if (details.includes('LOI')) return;
        if (!details.length) { toast('Chưa tích phụ kiện nào hoặc chưa nhập số lượng trả.', 'error'); return; }
      } else {
        details = collectPkDetails(modal);
        if (!details.length) { toast('Vui lòng nhập ít nhất 1 phụ kiện có số lượng > 0.', 'error'); return; }
      }
      try {
        const res = await apiPost('/api/phukien/phieu', {
          ngay: fd.get('ngay'), loaiPhieu: 'Xuất', maDon: fd.get('maDon') || null,
          donHangId: traNCC ? null : (fd.get('donHangId') || null), ghiChu: fd.get('ghiChu'), details,
          laTraNCC: traNCC, nccId: traNCC ? Number(selNcc.value) : null
        });
        toast('Đã lưu phiếu xuất.', 'success');
        closeModal();
        await render(container, currentUser);
        openPhieuXuatDetailModal(res.data.phieuId);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // Bang chi tiet nhap/xuat theo 1 ma phu kien (dung chung cho tab The kho khi loc theo 1 ma, va cho
  // popup "Lich su" tu tab Danh muc - v5.3 muc 5). Rows co dang loaiBaoCao:'chitiet' tra ve tu
  // GET /api/phukien/thekho?maPhuKien=...
  /* v6.13: thêm cột SỐ PHIẾU và cho BẤM VÀO DÒNG để mở đúng phiếu nhập/xuất ra xem (trong đó có nút
     Sửa/In). Trước đây lịch sử chỉ có ngày + số lượng, muốn xem phiếu nào phải tự sang tab Phiếu nhập/
     Phiếu xuất mò theo ngày. Gọi wireChiTietPhieuClick(root) sau khi gắn HTML này vào DOM. */
  function chiTietTableHtml(rows) {
    if (!rows.length) return '<div class="empty-hint">Chưa có phát sinh nhập/xuất nào.</div>';
    return `<table><thead><tr><th>Ngày</th><th>Số phiếu</th><th>Loại phiếu</th><th>Đơn hàng</th><th>Nhập</th><th>Xuất</th><th>Tồn cuối</th><th>ĐVT</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${fmtDate(r.ngay)}</td>
        <td>${r.phieuId ? `<a href="javascript:void(0)" class="act-mo-phieu-pk" data-id="${r.phieuId}" data-loai="${escapeHtml(r.loaiPhieu || '')}" title="Bấm để mở phiếu (xem / in / sửa)">#${r.phieuId}</a>` : ''}</td>
        <td>${statusBadge(r.loaiPhieu)}</td><td>${escapeHtml(r.donHang || '')}</td>
        <td style="color:green;font-weight:bold;">${r.nhap > 0 ? fmtNumber(r.nhap) : ''}</td>
        <td style="color:#c0392b;font-weight:bold;">${r.xuat > 0 ? fmtNumber(r.xuat) : ''}</td>
        <td style="font-weight:bold;background:#e8f5e9;">${fmtNumber(r.ton)}</td><td>${escapeHtml(r.dvt || '')}</td></tr>`).join('')}</tbody></table>`;
  }
  function wireChiTietPhieuClick(root) {
    (root || document).querySelectorAll('.act-mo-phieu-pk').forEach(a => a.addEventListener('click', () => {
      const id = a.dataset.id;
      if (String(a.dataset.loai).indexOf('Nh') === 0) openPhieuNhapDetailModal(id);   // 'Nhập'
      else openPhieuXuatDetailModal(id);
    }));
  }

  // ---- The kho / Ton kho ----
  async function renderTheKho() {
    const body = document.getElementById('pkBody');
    body.innerHTML = `
      <div class="header-form" style="display:flex;gap:15px;flex-wrap:wrap;margin-bottom:16px;">
        <div class="form-row" style="flex:2;min-width:220px;"><label>Chọn mã (để trống để xem TẤT CẢ) — gõ để tự lọc</label>
          ${searchableSelectHtml('searchMa', dm.phuKien, 'MaPhuKien', pkOptionLabel)}</div>
        <div class="form-row" style="flex:1;min-width:160px;"><label>Lọc theo loại</label>
          <select id="locLoai"><option value="">-- Tất cả loại --</option>${dm.loaiPhuKien.map(l => `<option value="${escapeHtml(l.TenLoai)}">${escapeHtml(l.TenLoai)}</option>`).join('')}</select></div>
        <div class="form-row" style="align-self:flex-end;">
          <a class="btn small secondary" id="btnExportTheKhoPK" href="/api/phukien/thekho/export">⬇️ Xuất Excel</a>
        </div>
      </div>
      <div id="theKhoResult"></div>`;

    // v5.10: doi <input list="pkList"> (datalist nguyen sinh, loc theo trinh duyet - khong dam bao go
    // ky tu bat ky o giua chuoi van tim duoc) sang searchableSelect dung chung toan he thong tu v5.8 (xem
    // common.js) - day la <datalist> DUY NHAT con sot lai (yeu cau moi "tất cả... trường datalist cho
    // phép đánh ký tự bất kỳ để tìm kiếm" dong nghia phai dong luon cho nay). Dung MaPhuKien (khong phai
    // PhuKienID nhu cac noi khac dung searchableSelect) lam valueKey vi GET /phukien/thekho can dung MA
    // (khop CHINH XAC ben backend) de tra ve dung 1 phu kien; go dang do (chua khop dung 1 dong) se lam
    // getSearchableValue rong -> loadTheKho tu dong roi ve nhanh "xem TAT CA" thay vi bao loi, van dung
    // dung tinh nang cu ("de trong de xem TAT CA").
    let __searchTimer = null;
    function scheduleLoad() {
      clearTimeout(__searchTimer);
      __searchTimer = setTimeout(loadTheKho, 250);
    }
    wireSearchableSelect('searchMa', dm.phuKien, 'MaPhuKien', pkOptionLabel, scheduleLoad);
    document.getElementById('locLoai').addEventListener('change', loadTheKho);
    async function loadTheKho() {
      const ma = getSearchableValue('searchMa');
      const loai = document.getElementById('locLoai').value;
      const params = new URLSearchParams();
      if (ma) params.set('maPhuKien', ma);
      if (loai) params.set('loaiPhuKien', loai);
      const res = await apiGet('/api/phukien/thekho?' + params.toString());
      const rows = res.data;
      const resultEl = document.getElementById('theKhoResult');
      if (!rows.length) { resultEl.innerHTML = '<div class="empty-hint">Không có dữ liệu</div>'; return; }

      if (rows[0].loaiBaoCao === 'chitiet') {
        resultEl.innerHTML = chiTietTableHtml(rows);
        wireChiTietPhieuClick(resultEl);   // v6.13: bấm số phiếu -> mở phiếu
      } else {
        // v6.13: bấm Mã PK ở bảng tổng hợp -> xem ngay lịch sử nhập/xuất của mã đó (không phải gõ tìm lại).
        // v6.32: + cột "Tồn quy đổi" theo ĐVT quy đổi khai ở Danh mục phụ kiện.
        resultEl.innerHTML = `<table><thead><tr><th>Mã PK</th><th>Tên phụ kiện</th><th>Loại</th><th>Tổng nhập</th><th>Tổng xuất</th><th>Tồn kho</th><th>ĐVT</th><th>Tồn quy đổi</th></tr></thead>
          <tbody>${rows.map(r => `<tr><td><a href="javascript:void(0)" class="act-ls-pk" data-ma="${escapeHtml(r.MaPhuKien)}" title="Xem lịch sử nhập/xuất của mã này">${escapeHtml(r.MaPhuKien)}</a></td><td>${escapeHtml(r.TenPhuKien)}</td><td>${escapeHtml(r.TenLoai || '')}</td>
            <td style="color:green;font-weight:bold;">${fmtNumber(r.TongNhap)}</td><td style="color:#c0392b;font-weight:bold;">${fmtNumber(r.TongXuat)}</td>
            <td style="font-weight:bold;background:#e8f5e9;">${fmtNumber(r.TonKho)} ${Number(r.TonKho) < 0 ? '<span class="badge danger">Âm kho</span>' : ''}</td>
            <td>${escapeHtml(r.DonViCoBan || '')}</td>
            <td style="text-align:right;background:#f1f8f4;">${tonQuyDoiHtml(r)}</td></tr>`).join('')}</tbody></table>`;
        resultEl.querySelectorAll('.act-ls-pk').forEach(a => a.addEventListener('click', () => moLichSuPK(a.dataset.ma)));
      }
    }

    loadTheKho();
  }
  /* v6.13: popup LỊCH SỬ NHẬP/XUẤT của 1 mã phụ kiện — dùng được từ mọi nơi (bảng tồn kho, danh mục).
     Trong popup bấm số phiếu là mở phiếu đó ra xem/in/sửa (modal xếp chồng, đóng thì quay lại đây). */
  async function moLichSuPK(maPhuKien) {
    let rows = [];
    try { rows = (await apiGet('/api/phukien/thekho?maPhuKien=' + encodeURIComponent(maPhuKien))).data || []; }
    catch (err) { toast('Không tải được lịch sử: ' + err.message, 'error'); return; }
    const it = (dm.phuKien || []).find(p => String(p.MaPhuKien) === String(maPhuKien)) || {};
    const modal = openModal(`
      <h3>Lịch sử nhập / xuất — ${escapeHtml(maPhuKien)}</h3>
      <p class="empty-hint">${escapeHtml(it.TenPhuKien || '')}${it.TenLoai ? ' · ' + escapeHtml(it.TenLoai) : ''} — bấm vào <b>số phiếu</b> để mở phiếu (xem / in / sửa).</p>
      <div style="max-height:60vh;overflow:auto;">${chiTietTableHtml(rows)}</div>
      <div class="modal-actions"><button type="button" class="btn" id="lsDong">Đóng</button></div>`);
    wireChiTietPhieuClick(modal);
    modal.querySelector('#lsDong').addEventListener('click', closeModal);
  }

  // ---- Danh muc phu kien ----
  function renderDanhMuc(perm) {
    const body = document.getElementById('pkBody');
    const rows = dm.phuKien;
    body.innerHTML = `
      <div class="toolbar">${searchBoxHtml('pkSearchBox')}${perm.canCreate ? '<button class="btn" id="btnAdd">+ Khai báo phụ kiện mới</button>' : ''}</div>
      ${/* v5.87: thêm cột Ảnh (ảnh của phụ kiện, bấm để xem to) — khai ảnh trong form Sửa/Khai báo */''}
      <table><thead><tr><th style="width:56px">Ảnh</th><th>Mã</th><th>Tên phụ kiện</th><th>Loại</th><th>Size</th><th>ĐVT cơ bản</th><th>ĐVT quy đổi</th><th>Tỷ lệ quy đổi</th><th>Ghi chú</th><th style="width:140px">Thao tác</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${r.AnhDaiDien ? `<a href="${escapeHtml(r.AnhDaiDien)}" target="_blank" title="Bấm để xem ảnh to"><img src="${escapeHtml(r.AnhDaiDien)}" style="width:44px;height:44px;object-fit:cover;border-radius:4px;"></a>` : ''}</td>
        <td>${escapeHtml(r.MaPhuKien)}</td><td>${escapeHtml(r.TenPhuKien)}</td><td>${escapeHtml(r.TenLoai || '')}</td>
        <td>${escapeHtml(r.Size || '')}</td><td>${escapeHtml(r.DonViCoBan || '')}</td><td>${escapeHtml(r.DonViQuyDoi || '')}</td>
        <td>${r.TyLeQuyDoi != null ? fmtNumber(r.TyLeQuyDoi) : ''}</td><td>${escapeHtml(r.GhiChu || '')}</td>
        <td>${perm.canEdit ? `<button class="btn small secondary act-edit" data-id="${r.PhuKienID}">Sửa</button>` : ''}
          <button type="button" class="btn small act-history" data-ma="${escapeHtml(r.MaPhuKien)}">Lịch sử</button>
          ${/* v6.56: Xóa — backend đã có sẵn DELETE /api/phukien/items/:id, chỉ thiếu nút. */''}
          ${perm.canDelete ? `<button class="btn small danger act-del-dm" data-id="${r.PhuKienID}" data-ma="${escapeHtml(r.MaPhuKien)}" data-ten="${escapeHtml(r.TenPhuKien || '')}">Xóa</button>` : ''}</td>
      </tr>`).join('') || '<tr><td colspan="10" class="empty-hint">Chưa có danh mục phụ kiện nào</td></tr>'}</tbody></table>`;

    if (perm.canCreate) document.getElementById('btnAdd').addEventListener('click', () => openItemForm(null, perm).catch(err => toast(err.message, 'error')));
    body.querySelectorAll('.act-edit').forEach(btn => btn.addEventListener('click', () => {
      const item = dm.phuKien.find(p => String(p.PhuKienID) === btn.dataset.id);
      openItemForm(item, perm).catch(err => toast(err.message, 'error'));
    }));
    /* v6.56: XÓA mã phụ kiện khỏi danh mục.
       CSDL có khóa ngoại từ phiếu nhập/xuất sang đây, nên mã đã phát sinh chứng từ sẽ bị SQL Server
       chặn — backend bắt lỗi đó và trả câu giải thích. Không tự đi xóa chứng từ theo: xóa mã cho gọn
       danh mục mà mất luôn phiếu nhập/xuất thì tồn kho và công nợ lệch ngay. */
    body.querySelectorAll('.act-del-dm').forEach(btn => btn.addEventListener('click', async () => {
      const nhan = `${btn.dataset.ma}${btn.dataset.ten ? ' — ' + btn.dataset.ten : ''}`;
      if (!confirm(`Xóa mã phụ kiện "${nhan}" khỏi danh mục?\n\nChỉ xóa được mã CHƯA phát sinh phiếu nhập/xuất nào.`)) return;
      try {
        await apiDelete('/api/phukien/items/' + btn.dataset.id);
        toast('Đã xóa mã phụ kiện.', 'success');
        /* Xóa cả `dm` để lần vẽ sau tải lại danh mục từ server. Chỉ gán dm.phuKien = null là hỏng:
           nhiều chỗ khác gọi thẳng dm.phuKien.filter/.map, gặp null là văng lỗi giữa chừng. */
        dm = null;
        render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    }));
    // v5.3 (muc 5): bam "Lich su" -> hien popup ngay tai cho (khong chuyen tab nua) - "khi xem lich su
    // hien popup len, hien chi tiet nhap, xuat co cot don hang, so luong".
    body.querySelectorAll('.act-history').forEach(btn => btn.addEventListener('click', async () => {
      const ma = btn.dataset.ma;
      const item = dm.phuKien.find(p => p.MaPhuKien === ma);
      const modal = openModal(`
        <h3>Lịch sử nhập/xuất — ${escapeHtml(ma)}${item ? ' — ' + escapeHtml(item.TenPhuKien) : ''}</h3>
        <div id="pkHistBody"><div class="empty-hint">Đang tải...</div></div>
        <div class="modal-actions"><button type="button" class="btn secondary" id="btnCloseHist">Đóng</button></div>`);
      modal.querySelector('#btnCloseHist').addEventListener('click', closeModal);
      try {
        const res = await apiGet('/api/phukien/thekho?maPhuKien=' + encodeURIComponent(ma));
        modal.querySelector('#pkHistBody').innerHTML = chiTietTableHtml(res.data);
        wireChiTietPhieuClick(modal);   // v6.13: bấm số phiếu -> mở phiếu nhập/xuất ngay trong popup này
      } catch (err) {
        modal.querySelector('#pkHistBody').innerHTML = `<div class="empty-hint">${escapeHtml(err.message)}</div>`;
      }
    }));
    // v5.10: yeu cau "các danh mục có thêm ô tìm kiếm" - dung ham dung chung o common.js (xem
    // module.danhmuc.js, ap dung cung 1 cach cho tab Danh muc phu kien nay).
    wireTableSearch(body, 'pkSearchBox');
  }

  async function openItemForm(row, perm) {
    await taiDonViTinhPK();   // v6.31: 2 ô ĐVT lấy từ Danh mục → Đơn vị tính
    const isEdit = !!row;
    const html = `
      <h3>${isEdit ? 'Sửa phụ kiện: ' + escapeHtml(row.MaPhuKien) : 'Khai báo phụ kiện / mác mới'}</h3>
      <form id="pkItemForm">
        <div class="form-grid">
          <div class="form-row"><label>Mã phụ kiện *</label><input name="ma" value="${escapeHtml(row ? row.MaPhuKien : '')}" ${isEdit ? 'readonly' : 'required'} placeholder="VD: MAC-MQ-80"></div>
          <div class="form-row"><label>Tên phụ kiện *</label><input name="ten" value="${escapeHtml(row ? row.TenPhuKien : '')}" required placeholder="VD: Mác quần MQ"></div>
          <div class="form-row"><label>Loại phụ kiện</label><select name="loaiPhuKienId"><option value="">--</option>${opt(dm.loaiPhuKien, 'LoaiPhuKienID', 'TenLoai', row ? row.LoaiPhuKienID : '')}</select></div>
          <div class="form-row"><label>Hoặc nhập loại mới</label><input name="loaiMoiText" placeholder="Gõ nếu loại chưa có trong danh sách"></div>
          <div class="form-row"><label>Size</label><input name="size" value="${escapeHtml(row ? (row.Size || '') : '')}" placeholder="VD: 80, S, M, L..."></div>
          ${/* v6.31: CHỌN từ Danh mục → Đơn vị tính thay vì gõ tự do — gõ tay rất dễ thành 2 đơn vị
               khác nhau chỉ vì sai chính tả ("Bó" và "bó"), lúc đó tồn kho tách làm đôi.
               optDonVi() vẫn giữ giá trị cũ nếu nó chưa có trong danh mục, không mất dữ liệu. */''}
          <div class="form-row"><label>ĐVT cơ bản *</label>
            <select name="donViCoBan" required>${optDonVi(dsDonViTinhPK, row ? (row.DonViCoBan || '') : '', { choTrong: !row, nhanTrong: '-- chọn đơn vị --' })}</select></div>
          <div class="form-row"><label>ĐVT quy đổi</label>
            <select name="donViQuyDoi">${optDonVi(dsDonViTinhPK, row ? (row.DonViQuyDoi || '') : '', { choTrong: true, nhanTrong: '-- không quy đổi --' })}</select></div>
          <div class="form-row"><label>Tỷ lệ quy đổi</label><input name="tyLeQuyDoi" type="number" step="any" value="${row && row.TyLeQuyDoi != null ? row.TyLeQuyDoi : ''}" placeholder="VD: 0.18 (1 Bó = 0.18 Kg)"></div>
        </div>
        <div class="form-row"><label>Ghi chú</label><input name="ghiChu" value="${escapeHtml(row ? (row.GhiChu || '') : '')}"></div>
        ${/* v5.87: ảnh phụ kiện — chọn file hoặc chụp thẳng bằng camera (capture) trên điện thoại.
             Không chọn file mới = giữ nguyên ảnh cũ; bấm "Xóa ảnh" mới bỏ ảnh. */''}
        <div class="form-row"><label>Ảnh phụ kiện</label>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            ${row && row.AnhDaiDien ? `<a href="${escapeHtml(row.AnhDaiDien)}" target="_blank"><img id="pkAnhHienTai" src="${escapeHtml(row.AnhDaiDien)}" style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:1px solid var(--border);"></a>` : ''}
            <input type="file" name="anhFile" accept="image/*" capture="environment">
            ${row && row.AnhDaiDien ? '<label style="font-weight:400;font-size:13px;"><input type="checkbox" name="xoaAnh" style="vertical-align:middle;"> Xóa ảnh hiện tại</label>' : ''}
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn secondary" id="btnCancel">Hủy</button>
          <button type="submit" class="btn">Lưu</button>
        </div>
      </form>`;
    const modal = openModal(html);
    modal.querySelector('#btnCancel').addEventListener('click', closeModal);
    modal.querySelector('#pkItemForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        ma: fd.get('ma'), ten: fd.get('ten'), loaiPhuKienId: fd.get('loaiPhuKienId') || null,
        loaiMoiText: fd.get('loaiMoiText') || null, size: fd.get('size'), donViCoBan: fd.get('donViCoBan'),
        donViQuyDoi: fd.get('donViQuyDoi'), tyLeQuyDoi: fd.get('tyLeQuyDoi') || null, ghiChu: fd.get('ghiChu')
      };
      try {
        // v5.87: ảnh -> tải lên trước, chỉ gửi ĐƯỜNG DẪN. KHÔNG gửi khóa anhDaiDien nếu không đổi gì
        // (backend hiểu là giữ nguyên ảnh cũ).
        const anhFile = fd.get('anhFile');
        if (anhFile && anhFile.size) body.anhDaiDien = await uploadFile(anhFile, 'phukien');
        else if (fd.get('xoaAnh')) body.anhDaiDien = '';
        else if (!isEdit) body.anhDaiDien = null;
        if (isEdit) await apiPut('/api/phukien/items/' + row.PhuKienID, body);
        else await apiPost('/api/phukien/items', body);
        closeModal(); toast('Đã lưu danh mục.', 'success'); render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  // ---- Loai phu kien ----
  async function renderLoai(perm) {
    const body = document.getElementById('pkBody');
    body.innerHTML = `
      <div class="card" style="max-width:520px;">
        <h3 style="margin-top:0;">Danh sách loại phụ kiện</h3>
        <table><thead><tr><th>Tên loại phụ kiện</th></tr></thead>
        <tbody>${dm.loaiPhuKien.map(l => `<tr><td>${escapeHtml(l.TenLoai)}</td></tr>`).join('') || '<tr><td class="empty-hint">Chưa có loại nào</td></tr>'}</tbody></table>
      </div>
      ${perm.canCreate ? `
      <div class="card" style="max-width:520px;">
        <h3 style="margin-top:0;">Thêm loại phụ kiện mới</h3>
        <form id="loaiForm">
          <div class="form-row"><label>Tên loại phụ kiện *</label><input name="tenLoai" required placeholder="VD: Mác cổ, Dây rút..."></div>
          <div style="margin-top:10px;"><button type="submit" class="btn">LƯU LOẠI PHỤ KIỆN</button></div>
        </form>
      </div>` : ''}`;

    const form = document.getElementById('loaiForm');
    if (form) form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await apiPost('/api/phukien/loai', { tenLoai: fd.get('tenLoai') });
        toast('Đã thêm loại phụ kiện.', 'success');
        render(container, currentUser);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* v5.83: cho phân hệ khác gọi sang — mở form "Tạo phiếu Xuất phụ kiện" với đơn hàng chọn sẵn.
     Dùng ở Quản lý sản xuất > Chỉ định NPL (nút "📦 Xuất kho"). Đối xứng với
     ModuleKhoVai.openXuatFormChoDon của Chỉ định vải SX (v5.69). */
  async function openPhieuXuatFormChoDon(maDH) {
    openPhieuXuatCreateModal(maDH);
  }

  return { render, getTabs, openPhieuXuatFormChoDon };
})();
