// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG CÂU CÁ (fishing.js)
// Tự động sử dụng Cần câu (Rod) & Các loại Mồi câu (Earthworm, Red Wiggler, Grub, Lure)
// Câu cá hàng ngày tối đa giới hạn Daily Limit, thu thập cá hiếm & hoàn thành Codex
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function toSafeNumber(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (typeof val === "string") {
      const p = parseFloat(val);
      return isNaN(p) ? 0 : p;
    }
    if (typeof val === "object" && typeof val.toNumber === "function") {
      try { return val.toNumber(); } catch (_e) { return 0; }
    }
    return 0;
  }

  async function tickFishing() {
    if (dangBan) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("fishing")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("fishing")) {
        return false;
      }

      // 1. Lấy dữ liệu Game State tươi mới nhất qua Bridge
      let state = S.gameState;
      if (typeof S.requestBridgeState === "function") {
        try {
          state = await S.requestBridgeState(1500);
        } catch (_e) {}
      }
      if (!state) state = S.gameState;

      const inv = state?.inventory || {};
      const rodCount = toSafeNumber(inv.Rod);

      const BAITS = ["Fishing Lure", "Grub", "Red Wiggler", "Earthworm"];
      let tongMoi = 0;
      for (const b of BAITS) {
        tongMoi += toSafeNumber(inv[b]);
      }

      if (rodCount <= 0 || tongMoi <= 0) {
        return false;
      }

      console.log(
        `%c[SFL Auto Fishing] 🎣 Chuẩn bị câu cá (${rodCount} Cần câu Rod, ${tongMoi} Mồi câu)...`,
        "color: #00bcd4; font-weight: bold; font-size: 13px;"
      );

      // 2. Thực hiện câu cá qua Game Bridge
      if (typeof S.autoFishingBridge === "function") {
        const res = await S.autoFishingBridge(4500);
        if (res && res.ok && res.castCount > 0) {
          console.log(
            `%c[SFL Auto Fishing] 🐟 ĐÃ CÂU THÀNH CÔNG ${res.castCount} CON CÁ HÔM NAY!`,
            "color: #00e676; font-weight: bold; font-size: 14px;"
          );
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error("[SFL Auto Fishing] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("fishing");
      }
    }
  }

  S.tickFishing = tickFishing;

})(window.SFL = window.SFL || {});
