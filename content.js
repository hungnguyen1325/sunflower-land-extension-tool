// ═══════════════════════════════════════════════════════════════════
// KHỞI TẠO KHÔNG GIAN TÊN SFL & ĐỒNG BỘ CẤU HÌNH POPUP (content.js)
// ═══════════════════════════════════════════════════════════════════
window.SFL = window.SFL || {};

(function (S) {
  "use strict";

  // Cấu hình từ Popup UI
  S.cauHinh = S.cauHinh || { masterBat: true };

  // Khôi phục cấu hình từ chrome.storage
  try {
    chrome.storage.local.get(["sfl_ui_settings"], (res) => {
      if (res && res.sfl_ui_settings) {
        S.cauHinh = { ...S.cauHinh, ...res.sfl_ui_settings };
      }
    });

    // Lắng nghe thay đổi từ Popup UI real-time
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.sfl_ui_settings && changes.sfl_ui_settings.newValue) {
          S.cauHinh = { ...S.cauHinh, ...changes.sfl_ui_settings.newValue };
        }
      }
    });
  } catch (_e) {}

  // Tự động tắt thông báo "VIP expired" của game trong localStorage (ngăn game hiển thị widget VIP gây click nhầm)
  try {
    localStorage.setItem("vipExpiryAcknowledged", new Date(Date.now() + 86400000 * 365).toISOString());
  } catch (_e) {}

})(window.SFL = window.SFL || {});
