// ================================================================================================
// MOYN Ký số — v9.61 — công cụ cầu nối trang web ký hợp đồng ↔ USB token (Windows).
// ------------------------------------------------------------------------------------------------
// Vì sao cần: trình duyệt KHÔNG đọc được USB token. Mọi nền tảng ký trên web (WeSign, eContract…)
// đều cài một công cụ nhỏ như thế này. Công cụ lắng nghe http://localhost:8765 (dự phòng 8766)
// bằng TcpListener + HTTP tối giản (KHÔNG dùng HttpListener/http.sys để khỏi phải "netsh urlacl" / quyền Admin),
// chỉ trả lời cho trang web của MOYN (CORS: ORIGINS + mạng nội bộ + origins.txt — xem OriginChoPhep) và CHỈ làm ba việc:
//   GET  /ping    → { ok, version }
//   GET  /certs   → danh sách chứng thư CÓ KHÓA RIÊNG trong kho Windows (CurrentUser\My) còn hạn
//   POST /sign    { thumbprint, dataBase64 } → { signatureBase64 }  — ký RSA PKCS#1 v1.5 + SHA-256
//                 lên dữ liệu máy chủ đưa (SET signedAttrs của CMS). Windows/CSP của token tự hỏi PIN.
// Khóa riêng KHÔNG BAO GIỜ rời token. Công cụ không gửi gì ra ngoài localhost, không lưu gì.
// Luôn HỎI người dùng xác nhận trước khi gọi token — trang web không thể ký ngầm.
// Build: xem MoynKySo.csproj. Chạy: mở MoynKySo.exe (biểu tượng khiên ở khay hệ thống), rồi bấm ký trên trang web.
// ================================================================================================
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Windows.Forms;

namespace MoynKySo
{
    static class Program
    {
        const string VERSION = "1.0.1";
        // Origin được gọi: tên miền MOYN (dưới), MỌI địa chỉ mạng nội bộ (10.x / 172.16–31.x / 192.168.x / localhost — nhân viên MOYN
        // mở phần mềm nội bộ qua IP LAN rồi ký), và các dòng trong file origins.txt đặt cạnh MoynKySo.exe (mỗi dòng một origin,
        // vd https://ten-mien-moi.vn). Không có Origin (gõ thẳng địa chỉ) chỉ được /ping. Mỗi lần ký vẫn HỎI người dùng, có ghi rõ trang nào gọi.
        static readonly string[] ORIGINS = { "https://thoitrangmoyn.id.vn", "https://pm.thoitrangmoyn.id.vn", "http://localhost:3000", "http://localhost", "http://127.0.0.1:3000" };
        static bool OriginChoPhep(string origin)
        {
            if (string.IsNullOrEmpty(origin)) return false;
            if (Array.IndexOf(ORIGINS, origin) >= 0) return true;
            try
            {
                string f = Path.Combine(AppContext.BaseDirectory, "origins.txt");
                if (File.Exists(f))
                    foreach (var dong in File.ReadAllLines(f))
                        if (string.Equals(dong.Trim().TrimEnd('/'), origin, StringComparison.OrdinalIgnoreCase)) return true;
            }
            catch { }
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var u)) return false;
            if (u.Scheme != "http" && u.Scheme != "https") return false;
            string h = u.Host;
            if (string.Equals(h, "localhost", StringComparison.OrdinalIgnoreCase)) return true;
            if (h.EndsWith(".thoitrangmoyn.id.vn", StringComparison.OrdinalIgnoreCase)) return true;
            if (IPAddress.TryParse(h, out var ip))
            {
                if (IPAddress.IsLoopback(ip)) return true;
                byte[] b = ip.GetAddressBytes();
                if (b.Length == 4 && (b[0] == 10 || (b[0] == 172 && b[1] >= 16 && b[1] <= 31) || (b[0] == 192 && b[1] == 168))) return true;   // mạng nội bộ
            }
            return false;
        }
        static TcpListener listener;
        static NotifyIcon khay;
        static int cong = 0;

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            foreach (var c in new[] { 8765, 8766 })
            {
                try { listener = new TcpListener(IPAddress.Loopback, c); listener.Start(); cong = c; break; }
                catch (Exception) { listener = null; }
            }
            if (listener == null)
            {
                MessageBox.Show("Không mở được cổng 8765/8766 trên máy này (chương trình khác đang chiếm, hoặc MOYN Ký số đã chạy rồi — xem khay hệ thống).", "MOYN Ký số", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            khay = new NotifyIcon { Icon = System.Drawing.SystemIcons.Shield, Visible = true, Text = "MOYN Ký số — đang chạy ở cổng " + cong };
            var menu = new ContextMenuStrip();
            menu.Items.Add("MOYN Ký số v" + VERSION + " — cổng " + cong).Enabled = false;
            menu.Items.Add("Thoát", null, (s, e) => { khay.Visible = false; try { listener.Stop(); } catch { } Application.Exit(); });
            khay.ContextMenuStrip = menu;
            khay.ShowBalloonTip(3000, "MOYN Ký số", "Đang chạy. Quay lại trang web và bấm \"Ký bằng USB token\".", ToolTipIcon.Info);
            var t = new Thread(VongLap) { IsBackground = true };
            t.Start();
            Application.Run();
        }

        static void VongLap()
        {
            while (true)
            {
                TcpClient client;
                try { client = listener.AcceptTcpClient(); } catch { break; }
                ThreadPool.QueueUserWorkItem(_ => { try { XuLy(client); } catch { } finally { try { client.Close(); } catch { } } });
            }
        }

        // ---------------- HTTP tối giản: 1 request / kết nối, body theo Content-Length ----------------
        static void XuLy(TcpClient client)
        {
            client.ReceiveTimeout = 15000; client.SendTimeout = 15000;
            var ns = client.GetStream();
            var dau = DocDauHttp(ns, out byte[] thanDau);
            if (dau == null) return;
            string[] dong = dau.Split(new[] { "\r\n" }, StringSplitOptions.None);
            string[] yeuCau = dong[0].Split(' ');
            if (yeuCau.Length < 2) return;
            string method = yeuCau[0].ToUpperInvariant(), duong = yeuCau[1].Split('?')[0].TrimEnd('/');
            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 1; i < dong.Length; i++) { int p = dong[i].IndexOf(':'); if (p > 0) headers[dong[i].Substring(0, p).Trim()] = dong[i].Substring(p + 1).Trim(); }
            int len = headers.TryGetValue("Content-Length", out var cl) && int.TryParse(cl, out var n) ? n : 0;
            if (len > 256 * 1024) { Tra(ns, 413, "{\"ok\":false,\"error\":\"Thân quá lớn\"}", null); return; }
            byte[] than = new byte[len];
            Array.Copy(thanDau, 0, than, 0, Math.Min(thanDau.Length, len));
            int daCo = Math.Min(thanDau.Length, len);
            while (daCo < len) { int r = ns.Read(than, daCo, len - daCo); if (r <= 0) break; daCo += r; }
            string origin = headers.TryGetValue("Origin", out var o) ? o : "";
            bool choPhep = OriginChoPhep(origin);
            string cors = choPhep ? origin : null;
            try
            {
                if (method == "OPTIONS") { Tra(ns, choPhep ? 204 : 403, "", cors); return; }
                if (!choPhep && origin != "") { Tra(ns, 403, "{\"ok\":false,\"error\":\"Origin không được phép: " + Esc(origin) + "\"}", null); return; }
                if (method == "GET" && duong == "/ping") { Tra(ns, 200, "{\"ok\":true,\"version\":\"" + VERSION + "\",\"app\":\"MoynKySo\"}", cors); return; }
                if (choPhep && method == "GET" && duong == "/certs") { Tra(ns, 200, DanhSachChungThu(), cors); return; }
                if (choPhep && method == "POST" && duong == "/sign") { Tra(ns, 200, Ky(Encoding.UTF8.GetString(than), origin), cors); return; }
                Tra(ns, choPhep ? 404 : 403, "{\"ok\":false,\"error\":\"" + (choPhep ? "Không có đường dẫn này" : "Chỉ gọi được từ trang web MOYN") + "\"}", cors);
            }
            catch (Exception ex) { Tra(ns, 400, "{\"ok\":false,\"error\":\"" + Esc(ex.Message) + "\"}", cors); }
        }
        static string DocDauHttp(NetworkStream ns, out byte[] phanThan)
        {
            var buf = new byte[65536]; int tong = 0; phanThan = new byte[0];
            while (tong < buf.Length)
            {
                int r; try { r = ns.Read(buf, tong, buf.Length - tong); } catch { return null; }
                if (r <= 0) return null;
                tong += r;
                int idx = TimKetThucDau(buf, tong);
                if (idx >= 0)
                {
                    phanThan = new byte[tong - (idx + 4)]; Array.Copy(buf, idx + 4, phanThan, 0, phanThan.Length);
                    return Encoding.ASCII.GetString(buf, 0, idx);
                }
            }
            return null;
        }
        static int TimKetThucDau(byte[] b, int n) { for (int i = 0; i + 3 < n; i++) if (b[i] == 13 && b[i + 1] == 10 && b[i + 2] == 13 && b[i + 3] == 10) return i; return -1; }
        static void Tra(NetworkStream ns, int ma, string json, string cors)
        {
            byte[] b = Encoding.UTF8.GetBytes(json ?? "");
            var sb = new StringBuilder();
            sb.Append("HTTP/1.1 ").Append(ma).Append(ma == 200 ? " OK" : ma == 204 ? " No Content" : " Error").Append("\r\n");
            sb.Append("Content-Type: application/json; charset=utf-8\r\nContent-Length: ").Append(b.Length).Append("\r\nConnection: close\r\nCache-Control: no-store\r\n");
            if (cors != null)
            {
                sb.Append("Access-Control-Allow-Origin: ").Append(cors).Append("\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n");
                sb.Append("Access-Control-Allow-Private-Network: true\r\nVary: Origin\r\n");   // Chrome: trang HTTPS gọi localhost
            }
            sb.Append("\r\n");
            byte[] dau = Encoding.ASCII.GetBytes(sb.ToString());
            ns.Write(dau, 0, dau.Length); if (b.Length > 0) ns.Write(b, 0, b.Length); ns.Flush();
        }

        // ---------------- chứng thư + ký ----------------
        static string DanhSachChungThu()
        {
            var ds = new List<object>();
            using (var store = new X509Store(StoreName.My, StoreLocation.CurrentUser))
            {
                store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
                foreach (var c in store.Certificates)
                {
                    try
                    {
                        if (!c.HasPrivateKey || c.NotAfter < DateTime.Now) continue;
                        ds.Add(new
                        {
                            thumbprint = c.Thumbprint,
                            subject = c.GetNameInfo(X509NameType.SimpleName, false) + "  (" + c.Subject + ")",
                            issuer = c.GetNameInfo(X509NameType.SimpleName, true),
                            serial = c.SerialNumber,
                            notAfter = c.NotAfter.ToString("dd/MM/yyyy"),
                            certDer = Convert.ToBase64String(c.RawData)
                        });
                    }
                    catch { }
                }
            }
            return JsonSerializer.Serialize(new { ok = true, certs = ds });
        }

        static string Ky(string than, string origin)
        {
            using var doc = JsonDocument.Parse(than);
            string thumb = doc.RootElement.GetProperty("thumbprint").GetString() ?? "";
            byte[] data = Convert.FromBase64String(doc.RootElement.GetProperty("dataBase64").GetString() ?? "");
            if (data.Length < 16 || data.Length > 64 * 1024) throw new Exception("Dữ liệu ký không hợp lệ");
            X509Certificate2 cert = null;
            using (var store = new X509Store(StoreName.My, StoreLocation.CurrentUser))
            {
                store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
                var tim = store.Certificates.Find(X509FindType.FindByThumbprint, thumb, false);
                if (tim.Count > 0) cert = tim[0];
            }
            if (cert == null) throw new Exception("Không thấy chứng thư " + thumb + " (rút token?)");
            // Hỏi người dùng xác nhận trước khi gọi token — tránh trang web ký ngầm nhiều lần.
            var tl = MessageBox.Show("Trang web yêu cầu ký: " + origin + "\n\nKý số bằng chứng thư:\n" + cert.Subject + "\n\nChỉ bấm Yes khi CHÍNH BẠN vừa bấm \"Ký\" trên trang hợp đồng MOYN. Tiếp tục? (Windows/token sẽ hỏi PIN)", "MOYN Ký số", MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2, MessageBoxOptions.DefaultDesktopOnly);
            if (tl != DialogResult.Yes) throw new Exception("Người dùng không đồng ý ký");
            using var rsa = cert.GetRSAPrivateKey();
            if (rsa == null) throw new Exception("Chứng thư không có khóa RSA riêng (chỉ hỗ trợ RSA)");
            byte[] sig = rsa.SignData(data, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);   // CSP/KSP của token hỏi PIN ở đây
            return JsonSerializer.Serialize(new { ok = true, signatureBase64 = Convert.ToBase64String(sig), thumbprint = cert.Thumbprint });
        }

        static string Esc(string s) => (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " ").Replace("\r", " ");
    }
}
