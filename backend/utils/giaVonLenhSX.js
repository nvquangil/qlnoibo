/* ================================================================================================
   TU NAP GIA VON CHO HANG TU SAN XUAT   (v8.90)

   Nguyen 2026-10-12: "Bao cao kinh doanh / Gia von hang hoa: khi co gia thanh san pham tu Quan ly
   san xuat se tu cap nhat vao, khong can phai chay 'lay gia thanh tu lenh SX'."
   Lam ro: "o QLSX co tinh gia thanh san pham. Khi ben do tinh xong, the kho hang hoa co phieu nhap
   kho la lay gia tu do vao."
   Chot luat ghi de: "Cap nhat, nhung CHI KHI CUNG LENH SX DO."

   => Diem kich hoat la PHIEU NHAP KHO HANG HOA loai 'SanXuat'. Do cung la thoi diem tu nhien nhat:
   tinhGiaThanh() lay MAU SO (SL hoan thanh) tu chinh bang PhieuNhapKhoHangChiTiet.

   Day la ban SONG SONG voi utils/giaNhapHangHoa.js (gia von hang mua tu NCC, v8.07). Hai duong
   KHONG dung chung ham vi nguon gia khac han: NCC = binh quan gia quyen cac phieu nhap; tu SX =
   giaThanh1SP tinh on-the-fly tu toan bo chi phi lenh.

   ================================================================================================
   BA DIEU PHAI GIU — ra cheo 2026-10-12 bat duoc ca ba, deu la LOI TIEN
   ================================================================================================

   (1) NAP CHO MOI MA CUA CA LENH, khong chi ma tren phieu vua luu.
       giaThanh1SP = tong chi phi / SL nhap kho cua CA LENH. Nap chi cho ma tren phieu la:
         Lenh 1.000 cai. Dot 1 phieu NK01 nhap ma A 50 cai  -> A = tong CP / 50  (gap 20 lan).
         Dot 2 phieu NK02 nhap ma B 950 cai -> mau so thanh 1.000, B dung gia,
         con A VAN GIU GIA GAP 20 LAN VINH VIEN vi A khong co tren NK02.
       Lenh nhieu size/mau nhap cuon chieu la dinh chac chan, va KHONG BAO GIO tu sua.

   (2) CHI GHI KHI MAU SO DEN TU PHIEU NHAP KHO (gt.donViSLDungTinh === 'Cái').
       tinhGiaThanh() co hai duong lui khi khong co phieu: luy ke cong doan KN, roi SL CAT
       (qlsx.js: slDungTinh = slNhapKho > 0 ? slNhapKho : slCat). Huy/xoa phieu cuoi cung cua lenh
       KHONG lam giaThanh1SP thanh null nhu tuong — no lui ve SL cat, thuong LON HON SL nhap kho
       that => gia von TUT XUONG, lai gop PHINH LEN. Chi co nhanh phieu nhap kho moi duoc gan
       donViSLDungTinh = 'Cái' (qlsx.js), nen do la co duy nhat tin duoc.

   (3) BI LUAT CHAN THI PHAI NOI RA.
       Ma dang mang gia von cua LENH KHAC chinh la truong hop luat co tinh chan. Im lang la nguoi
       dung thay "Da luu phieu" roi tin rang gia von da dung.
   ================================================================================================ */
const { sql } = require('../db');

const so = (v) => (v == null || v === '' || isNaN(Number(v)) ? 0 : Number(v));

async function coBangGiaVon(pool) {
  const r = (await pool.request().query("SELECT OBJECT_ID('GiaVonHangHoa') AS c")).recordset[0] || {};
  return r.c != null;
}

/* MOI ma hang thuoc mot lenh SX — hai duong, gop lai. Cung cach nut "nap hang loat" o
   routes/baocao.js dang lam; viet khac di la hai man hinh ra hai danh sach khac nhau.
     (A) TheKhoHangHoa.DonHangID        — the kho tao tay co chon lenh SX (du lieu cu)
     (B) PhieuNhapKhoHangChiTiet        — ma do phieu nhap kho sinh ra (duong chuan tu v6.89) */
async function maHangCuaLenh(pool, donHangId) {
  const r = await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT DISTINCT MaHangID FROM (
      SELECT h.MaHangID FROM TheKhoHangHoa h WHERE h.DonHangID = @id
      UNION ALL
      SELECT ct.MaHangID
      FROM PhieuNhapKhoHangChiTiet ct
      JOIN PhieuNhapKhoHang p ON p.PhieuNKID = ct.PhieuNKID
                             AND p.TrangThai <> N'Đã hủy' AND p.DonHangID = @id
    ) u WHERE MaHangID IS NOT NULL`);
  return r.recordset.map(x => x.MaHangID);
}

/* ================================================================================================
   LUAT GHI DE  (Nguyen chot 2026-10-12: "Cap nhat, nhung chi khi cung lenh SX do")

   | Gia von dang co                      | Ghi? | Vi sao                                          |
   |--------------------------------------|------|-------------------------------------------------|
   | chua co dong nao                     | GHI  | dien lan dau                                    |
   | NguonGia = 'Khai tay'                | KHONG| nguoi dung co y khai de, may khong duoc de len  |
   | NguonGia = 'Lệnh SX', MaDHNguon NULL | GHI  | khong biet thuoc lenh nao -> coi nhu chua ro    |
   | NguonGia = 'Lệnh SX', CUNG MaDH      | GHI  | nhap bo sung dot sau cua chinh lenh nay         |
   | NguonGia = 'Lệnh SX', KHAC MaDH      | KHONG| gia von dang thuoc ve mot lenh khac             |
   | NguonGia = 'Phiếu nhập NCC'          | GHI  | ma nay da chuyen sang tu san xuat               |

   ⚠️ MaDHNguon NULL phai roi vao nhanh GHI, khong phai nhanh "lenh khac". Cot NguonGia co
   DEFAULT N'Lệnh SX', nen mot dong chen bang SQL tay ma bo qua cot do se thanh 'Lệnh SX' +
   MaDHNguon NULL — neu xep vao "lenh khac" thi dong do DONG BANG vinh vien va im lang.
   ================================================================================================ */
function duocGhi(cu, maDH) {
  if (!cu) return { ok: true };
  if (cu.NguonGia === 'Khai tay') return { ok: false, vi: 'đang khai tay' };
  if (cu.NguonGia === 'Lệnh SX' && cu.MaDHNguon && cu.MaDHNguon !== maDH) {
    return { ok: false, vi: 'giá vốn đang thuộc lệnh ' + cu.MaDHNguon };
  }
  return { ok: true };
}

/* Nap gia von cho MOI ma hang cua mot lenh san xuat.
   Tra { capNhat, giuNguyen, boQua, lyDo, chiTietBoQua, maDH, gia }.
   KHONG BAO GIO throw — cho goi nam SAU commit, nem loi ra la nguoi dung thay "luu that bai"
   trong khi phieu DA nam trong CSDL roi ho luu lan nua thanh hai phieu. */
async function napGiaVonTuLenhSX(pool, donHangId, _khongDung, userId) {
  const tron = { capNhat: 0, giuNguyen: 0, boQua: 0, chiTietBoQua: [] };
  if (!donHangId) return Object.assign(tron, { lyDo: '' });
  if (!await coBangGiaVon(pool)) return Object.assign(tron, { lyDo: 'chưa có bảng GiaVonHangHoa' });

  const dh = (await pool.request().input('id', sql.Int, donHangId)
    .query('SELECT MaDH FROM DonHangSanXuat WHERE DonHangID = @id')).recordset[0];
  if (!dh || !dh.MaDH) return Object.assign(tron, { lyDo: 'không thấy lệnh SX' });

  /* require NGAY TRONG HAM: routes/qlsx.js la module lon va cung require nhieu util khac. Require o
     dau file tao nguy co vong phu thuoc khi ai do them mot require nguoc lai — loi do hien ra thanh
     "tinhGiaThanh is not a function" luc chay, rat kho lan. */
  const { tinhGiaThanh, getOrderByMaDH } = require('../routes/qlsx');
  if (typeof tinhGiaThanh !== 'function' || typeof getOrderByMaDH !== 'function') {
    return Object.assign(tron, { lyDo: 'không gọi được hàm tính giá thành của QLSX' });
  }

  const order = await getOrderByMaDH(pool, dh.MaDH);
  if (!order) return Object.assign(tron, { lyDo: 'không đọc được lệnh ' + dh.MaDH });
  const gt = await tinhGiaThanh(pool, order);
  const gia = so(gt && gt.giaThanh1SP);

  // ĐIỀU (2) — xem đầu file. Mẫu số không đến từ phiếu nhập kho thì KHÔNG đụng vào giá vốn.
  if (gt && gt.donViSLDungTinh !== 'Cái') {
    return Object.assign(tron, {
      lyDo: 'lệnh ' + dh.MaDH + ' chưa có số lượng nhập kho thực tế'
        + (so(gt.slCat) > 0 ? ' (hiện mới có SL cắt — chưa dùng để tính giá vốn)' : '')
    });
  }
  /* Chua tinh duoc gia thi KHONG ghi gi — giu nguyen gia von dang co.
     Ghi 0 la bien lai gop thanh dung bang doanh thu, nhin rat dep va rat sai. */
  if (!(gia > 0)) {
    return Object.assign(tron, { lyDo: 'lệnh ' + dh.MaDH + ' chưa đủ số liệu chi phí' });
  }

  // ĐIỀU (1) — mọi mã của CẢ LỆNH, không chỉ mã trên phiếu vừa lưu.
  const ids = await maHangCuaLenh(pool, donHangId);
  if (!ids.length) return Object.assign(tron, { lyDo: 'lệnh ' + dh.MaDH + ' chưa có mã hàng nào' });

  const dsCu = (await pool.request().query(`
    SELECT gv.MaHangID, gv.GiaVon, gv.NguonGia, gv.MaDHNguon, h.MaHang
    FROM GiaVonHangHoa gv JOIN TheKhoHangHoa h ON h.MaHangID = gv.MaHangID
    WHERE gv.MaHangID IN (${ids.join(',')})`)).recordset;
  const theoId = new Map(dsCu.map(r => [r.MaHangID, r]));

  for (const id of ids) {
    const cu = theoId.get(id);
    const xet = duocGhi(cu, dh.MaDH);
    if (!xet.ok) {
      tron.boQua++;
      tron.chiTietBoQua.push((cu && cu.MaHang ? cu.MaHang : 'mã #' + id) + ': ' + xet.vi);
      continue;
    }
    // Khong co gi doi thi khong ghi — tranh bao "da cap nhat" khi thuc ra khong doi gi.
    if (cu && so(cu.GiaVon) === gia && cu.MaDHNguon === dh.MaDH && cu.NguonGia === 'Lệnh SX') {
      tron.giuNguyen++; continue;
    }
    try {
      await pool.request()
        .input('mh', sql.Int, id).input('gv', sql.Decimal(18, 2), gia)
        .input('madh', sql.NVarChar, dh.MaDH).input('u', sql.Int, userId || null)
        .query(`
          MERGE GiaVonHangHoa WITH (HOLDLOCK) AS t
          USING (SELECT @mh AS MaHangID) AS s ON t.MaHangID = s.MaHangID
          WHEN MATCHED THEN UPDATE SET GiaVon = @gv, NguonGia = N'Lệnh SX', MaDHNguon = @madh,
               NgayCapNhat = CAST(SYSDATETIME() AS DATE), NguoiCapNhatID = @u
          WHEN NOT MATCHED THEN INSERT (MaHangID, GiaVon, NguonGia, MaDHNguon, NgayCapNhat, NguoiCapNhatID)
               VALUES (@mh, @gv, N'Lệnh SX', @madh, CAST(SYSDATETIME() AS DATE), @u);`);
      tron.capNhat++;
    } catch (e) {
      tron.boQua++;
      tron.chiTietBoQua.push('mã #' + id + ': ' + e.message);
      console.error('[giaVonLenhSX] loi ghi gia von MaHangID=' + id + ': ', e.message);
    }
  }
  return Object.assign(tron, { lyDo: '', maDH: dh.MaDH, gia });
}

/* Dung chung cho 4 cho goi o routes/nhapkho.js — de cau thong bao giong het nhau, va de ĐIỀU (3)
   (bi luat chan thi phai noi ra) khong bi quen o mot duong nao. */
function loiNhanGiaVon(kq) {
  if (!kq) return '';
  const phan = [];
  if (kq.capNhat) {
    phan.push(` Đã cập nhật giá vốn ${Number(kq.gia).toLocaleString('vi-VN')} đ/cái cho ${kq.capNhat} mã của lệnh ${kq.maDH}.`);
  }
  if (kq.boQua) {
    phan.push(` KHÔNG cập nhật được ${kq.boQua} mã: ${kq.chiTietBoQua.slice(0, 5).join('; ')}`
      + (kq.chiTietBoQua.length > 5 ? `; và ${kq.chiTietBoQua.length - 5} mã nữa.` : '.'));
  }
  if (!kq.capNhat && !kq.boQua && kq.lyDo) phan.push(` Chưa cập nhật giá vốn: ${kq.lyDo}.`);
  return phan.join('');
}

module.exports = { napGiaVonTuLenhSX, loiNhanGiaVon };
