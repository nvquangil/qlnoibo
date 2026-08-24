/* ================================================================================================
   CHAN DOAN "CHI DINH VAI SX" — vi sao mot dong khong ra cay vai nao          (chi DOC)     v7.37
   ------------------------------------------------------------------------------------------------
   MOT ban duy nhat cho ca BA tang phong ve, de ba noi khong bao giờ ket luan khac nhau:
     Tang 1 (v7.36) — chan tao ban ghi trung ten o DANH MUC          -> utils/crudFactory.js
     Tang 2 (v7.37) — CANH BAO NGAY LUC KHAI Chi dinh vai SX          -> routes/qlsx.js PUT
     Tang 3 (v7.37) — RA SOAT toan he thong                           -> routes/qlsx.js /rasoat
     va CLI                                                            -> utils/soi_chi_dinh_vai.js

   NAM NHAN LY DO (xep theo thu tu kiem, dung nhan dau tien khop):
     THIEU-ID      Dong chi dinh khong co LoaiVaiID hoac MauSacID (go tu do, chua co trong danh muc)
     LECH-ID       Co cay vai con hang dung TEN loai+mau nhung ID danh muc KHAC  <= benh chinh
     CON-MET-KG-0  Khop dung ID, cay con MET nhung KGNhap = 0 (vai quan theo met/cay)
     HET-THAT      Khop dung ID nhung cay het ca KG va MET
     CHUA-NHAP     Kho khong co cay nao dung loai+mau nay
   Dong khong roi vao nhan nao = XUAT DUOC.

   ⚠️ CON-MET-KG-0 da duoc sua o v7.36 (moi phep loc "con ton" nay tinh ca MetCon — utils/tonVai.js)
   nen tren he thong da cap nhat thi nhan nay khong con xuat hien. Giu lai de con chan doan duoc may
   chua cap nhat, va de neu ai lo quay lai `KGCon > 0` thi lo ra ngay.
   ================================================================================================ */

/* Chuan hoa ten de so khop "gan giong": bo HET khoang trang + khong phan biet hoa thuong.
   KHONG bo dau tieng Viet — bo dau se lam "kẻ" = "ke" = "kê", gop nham hai mau khac nhau. */
const CHUAN = t => `REPLACE(LOWER(LTRIM(RTRIM(ISNULL(${t}, N'@@KHONGCO@@')))), N' ', N'')`;
/* CON HANG = con KG HOAC con MET. Cung dinh nghia voi utils/tonVai.js conHangSQL(). */
const CON_HANG = a => `(${a}.KGCon > 0 OR ${a}.MetCon > 0)`;

/* ------------------------------------------------------------------------------------------------
   CHAN DOAN CAC DONG CHI DINH CUA MOT LENH SX.
   Tra ve mang: { Id, TenPhieu, Kieu, LoaiVaiID, MauSacID, TenLoaiVai, TenMau, SoKGYeuCau, SoMet,
                  DVTVaiYeuCau, KhopID_ConHang, KhopID_ChiConMet, KhopID_HetHan, KhopTen_ConHang,
                  KhopTenLoai_ConHang, KhopTenMau_ConHang, nhan, lyDo, xuatDuoc }
   ------------------------------------------------------------------------------------------------ */
async function chanDoanDon(pool, sql, donHangId) {
  const rs = (await pool.request().input('id', sql.Int, donHangId).query(`
    SELECT cd.Id, cd.TenPhieu, cd.Kieu, cd.LoaiVaiID, cd.MauSacID,
           lv.TenLoaiVai, ms.TenMau, cd.SoKGYeuCau, cd.SoMet, cd.DVTVaiYeuCau,

      /* (1) Khop ID loai + ID mau va CON HANG (con KG hoac con MET) -> dung cai form xuat dang dung */
      (SELECT COUNT(*) FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
       WHERE ${CON_HANG('t')} AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID) AS KhopID_ConHang,

      /* (2) Khop ID, KG het nhung CON MET -> ca "vo hinh" cua he thong chua cap nhat v7.36 */
      (SELECT COUNT(*) FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
       WHERE t.KGCon <= 0 AND t.MetCon > 0 AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID) AS KhopID_ChiConMet,

      /* (3) Khop ID nhung het ca KG va MET */
      (SELECT COUNT(*) FROM vw_TonCayVai t JOIN DanhMucVai dv ON dv.VaiID = t.VaiID
       WHERE t.KGCon <= 0 AND t.MetCon <= 0 AND dv.LoaiVaiID = cd.LoaiVaiID AND dv.MauSacID = cd.MauSacID) AS KhopID_HetHan,

      /* (4) Khop CA HAI TEN va con hang (co the khac ID) -> lon hon (1) la LECH ID TRUNG TEN */
      (SELECT COUNT(*) FROM vw_TonCayVai t
       WHERE ${CON_HANG('t')}
         AND ${CHUAN('t.TenLoaiVai')} = ${CHUAN('lv.TenLoaiVai')}
         AND ${CHUAN('t.TenMau')} = ${CHUAN('ms.TenMau')}) AS KhopTen_ConHang,

      /* (5)(6) Chi khop mot chieu -> de doan la khai lech ten mau hay lech ten loai vai */
      (SELECT COUNT(*) FROM vw_TonCayVai t
       WHERE ${CON_HANG('t')} AND ${CHUAN('t.TenLoaiVai')} = ${CHUAN('lv.TenLoaiVai')}) AS KhopTenLoai_ConHang,
      (SELECT COUNT(*) FROM vw_TonCayVai t
       WHERE ${CON_HANG('t')} AND ${CHUAN('t.TenMau')} = ${CHUAN('ms.TenMau')}) AS KhopTenMau_ConHang
    FROM ChiDinhVaiSX cd
    LEFT JOIN LoaiVai lv ON lv.LoaiVaiID = cd.LoaiVaiID
    LEFT JOIN MauSac ms ON ms.MauSacID = cd.MauSacID
    WHERE cd.DonHangID = @id
    ORDER BY ISNULL(cd.TenPhieu, N''), cd.Kieu, cd.Id`)).recordset;
  return rs.map(phanLoai);
}

/* Gan NHAN + LY DO cho mot dong. Tach rieng de kiem chung duoc bang du lieu gia, khong can CSDL. */
function phanLoai(d) {
  const soKG = Number(d.SoKGYeuCau) || 0, soMet = Number(d.SoMet) || 0;
  const ten = `${d.TenLoaiVai || '(chưa có trong danh mục)'} / ${d.TenMau || '(chưa có trong danh mục)'}`;
  let nhan = '', lyDo = '';

  if (d.KhopID_ConHang > 0) {
    return { ...d, nhan: '', lyDo: '', xuatDuoc: true };
  }
  if (d.LoaiVaiID == null || d.MauSacID == null) {
    nhan = 'THIEU-ID';
    lyDo = `Dòng "${ten}" chưa chọn ${d.LoaiVaiID == null ? 'Loại vải' : ''}`
      + `${d.LoaiVaiID == null && d.MauSacID == null ? ' và ' : ''}${d.MauSacID == null ? 'Màu' : ''}`
      + ' từ danh mục — gõ tự do thì không ghép được với cây vải trong kho.';
  } else if (d.KhopTen_ConHang > 0) {
    nhan = 'LECH-ID';
    lyDo = `Dòng "${ten}": trong kho CÓ ${d.KhopTen_ConHang} cây còn hàng đúng tên loại + màu này, `
      + `nhưng bản ghi danh mục KHÁC ID (chỉ định đang trỏ loại #${d.LoaiVaiID} / màu #${d.MauSacID}). `
      + 'Danh mục có hai bản trùng tên — gộp lại hoặc chọn lại từ gợi ý.';
  } else if (d.KhopID_ChiConMet > 0) {
    nhan = 'CON-MET-KG-0';
    lyDo = `Dòng "${ten}": có ${d.KhopID_ChiConMet} cây khớp đúng danh mục, còn MÉT nhưng KG = 0 `
      + '(vải quản theo mét/cây). Máy chủ chưa cập nhật bản v7.36 nên coi như hết.';
  } else if (d.KhopID_HetHan > 0) {
    nhan = 'HET-THAT';
    lyDo = `Dòng "${ten}": khớp đúng danh mục nhưng ${d.KhopID_HetHan} cây đã xuất hết cả KG và mét.`;
  } else if (d.KhopTenLoai_ConHang > 0) {
    nhan = 'LECH-MAU';
    lyDo = `Dòng "${ten}": kho có ${d.KhopTenLoai_ConHang} cây cùng tên LOẠI VẢI nhưng khác màu — `
      + 'kiểm tra lại tên màu đã chọn.';
  } else if (d.KhopTenMau_ConHang > 0) {
    nhan = 'LECH-LOAI';
    lyDo = `Dòng "${ten}": kho có ${d.KhopTenMau_ConHang} cây cùng tên MÀU nhưng khác loại vải — `
      + 'kiểm tra lại tên loại vải đã chọn.';
  } else {
    nhan = 'CHUA-NHAP';
    lyDo = `Dòng "${ten}": kho chưa có cây vải nào đúng loại + màu này (kể cả đã hết) — cần nhập kho trước.`;
  }
  /* Ghi chu them: dong khong khai KG lan MET van luu duoc, nhung nguoi lap phieu xuat se khong biet
     con thieu bao nhieu. Khong phai ly do chinh nen chi noi them. */
  if (soKG <= 0 && soMet <= 0) lyDo += ' (Dòng này cũng chưa khai KG lẫn số mét.)';
  return { ...d, nhan, lyDo, xuatDuoc: false };
}

/* ------------------------------------------------------------------------------------------------
   DANH MUC TRUNG TEN KHAC ID — chi ro ID nao DANG CO CAY VAI (bản "thật" nên giữ khi gộp).
   ------------------------------------------------------------------------------------------------ */
async function danhMucTrungTen(pool) {
  const loai = (await pool.request().query(`
    SELECT LTRIM(RTRIM(l.TenLoaiVai)) AS Ten, l.LoaiVaiID AS Id,
           (SELECT COUNT(*) FROM DanhMucVai dv WHERE dv.LoaiVaiID = l.LoaiVaiID) AS SoMaVai,
           (SELECT COUNT(*) FROM VaiCay vc JOIN DanhMucVai dv2 ON dv2.VaiID = vc.VaiID
            WHERE dv2.LoaiVaiID = l.LoaiVaiID) AS SoCay,
           (SELECT COUNT(*) FROM ChiDinhVaiSX cd WHERE cd.LoaiVaiID = l.LoaiVaiID) AS SoChiDinh
    FROM LoaiVai l
    WHERE EXISTS (SELECT 1 FROM LoaiVai l2 WHERE l2.LoaiVaiID <> l.LoaiVaiID
                    AND ${CHUAN('l2.TenLoaiVai')} = ${CHUAN('l.TenLoaiVai')})
    ORDER BY LTRIM(RTRIM(l.TenLoaiVai)), l.LoaiVaiID`)).recordset;
  const mau = (await pool.request().query(`
    SELECT LTRIM(RTRIM(m.TenMau)) AS Ten, m.MauSacID AS Id, m.MaMau,
           (SELECT COUNT(*) FROM DanhMucVai dv WHERE dv.MauSacID = m.MauSacID) AS SoMaVai,
           (SELECT COUNT(*) FROM VaiCay vc JOIN DanhMucVai dv2 ON dv2.VaiID = vc.VaiID
            WHERE dv2.MauSacID = m.MauSacID) AS SoCay,
           (SELECT COUNT(*) FROM ChiDinhVaiSX cd WHERE cd.MauSacID = m.MauSacID) AS SoChiDinh
    FROM MauSac m
    WHERE EXISTS (SELECT 1 FROM MauSac m2 WHERE m2.MauSacID <> m.MauSacID
                    AND ${CHUAN('m2.TenMau')} = ${CHUAN('m.TenMau')})
    ORDER BY LTRIM(RTRIM(m.TenMau)), m.MauSacID`)).recordset;
  return { loaiVai: loai, mauSac: mau };
}

/* ------------------------------------------------------------------------------------------------
   TIM ID DANH MUC DUNG khi go TEN (dung cho resolve o Chi dinh vai SX — tang 2a).
   So theo ten CHUAN HOA (bo het khoang trang, khong phan biet hoa thuong) thay vi so chinh xac:
   go them mot khoang trang la truot phep so chinh xac roi TAO BAN MOI — chinh la cach LoaiVaiID
   2153 ra doi ben canh 2144.
   Nhieu ban trung ten thi UU TIEN ban DANG CO CAY VAI (ban "thật"), roi den ban co nhieu ma vai,
   cuoi cung la ID nho nhat — de chi dinh tro dung ban ma hang trong kho dang dung.
   ------------------------------------------------------------------------------------------------ */
async function timIdTheoTen(pool, sql, bang, cotId, cotTen, cotIdTrongDanhMucVai, ten) {
  const t = String(ten == null ? '' : ten).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const rs = (await pool.request().input('t', sql.NVarChar, t).query(`
    SELECT TOP 1 x.${cotId} AS Id
    FROM ${bang} x
    WHERE ${CHUAN(`x.${cotTen}`)} = ${CHUAN('@t')}
    ORDER BY
      (SELECT COUNT(*) FROM VaiCay vc JOIN DanhMucVai dv ON dv.VaiID = vc.VaiID
       WHERE dv.${cotIdTrongDanhMucVai} = x.${cotId}) DESC,
      (SELECT COUNT(*) FROM DanhMucVai dv2 WHERE dv2.${cotIdTrongDanhMucVai} = x.${cotId}) DESC,
      x.${cotId}`)).recordset[0];
  return rs ? rs.Id : null;
}

module.exports = { chanDoanDon, phanLoai, danhMucTrungTen, timIdTheoTen, CHUAN, CON_HANG };
