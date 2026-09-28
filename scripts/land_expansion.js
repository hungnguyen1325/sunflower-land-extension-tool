// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG MỞ RỘNG Ô ĐẤT & NÂNG CẤP ĐẢO (land_expansion.js)
// Tự động kiểm tra điều kiện cấp độ Bumpkin, Vàng, Gỗ, Đá để Mở Rộng Ô Đất (Basic Land)
// Tự động Khám phá đất mới hoàn thành (Land Reveal) & Nâng cấp Đảo Mới (Farm Upgrade)
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function tickLandExpansion() {
    if (dangBan) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("land_expansion")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("land_expansion")) {
        return false;
      }

      // 1. Lấy dữ liệu Game State tươi mới nhất
      let state = S.gameState;
      if (typeof S.requestBridgeState === "function") {
        try {
          state = await S.requestBridgeState(1500);
        } catch (_e) {}
      }
      if (!state) state = S.gameState;

      const islandType = (state?.island?.type || "basic").toUpperCase();
      console.log(
        `%c[SFL Mở Đất & Nâng Đảo] 🏝️ Kiểm tra nâng cấp đất đai & phát triển Đảo (${islandType})...`,
        "color: #8bc34a; font-weight: bold; font-size: 13px;"
      );

      // 2. Thực hiện qua Game Bridge
      if (typeof S.autoExpandUpgradeBridge === "function") {
        const res = await S.autoExpandUpgradeBridge(3500);
        if (res && res.ok && (res.landExpanded || res.landRevealed || res.farmUpgraded)) {
          console.log(
            `%c[SFL Mở Đất & Nâng Đảo] 🎉 THÀNH CÔNG: ${res.landExpanded ? "🌱 ĐÃ MỞ RỘNG Ô ĐẤT MỚI! " : ""}${res.landRevealed ? "✨ ĐÃ HOÀN THÀNH KHÁM PHÁ ĐẤT! " : ""}${res.farmUpgraded ? "🏰 ĐÃ NÂNG CẤP ĐẢO MỚI!" : ""}`,
            "color: #00e676; font-weight: bold; font-size: 14px;"
          );
          return true;
        } else {
          console.log(
            "%c[SFL Mở Đất & Nâng Đảo] ℹ️ Chưa đủ điều kiện (Coins, Tài nguyên, Cấp độ) hoặc chưa đến thời gian mở rộng / nâng đảo.",
            "color: #9e9e9e;"
          );
          return false;
        }
      }

      return false;
    } catch (err) {
      console.error("[SFL Mở Đất & Nâng Đảo] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("land_expansion");
      }
    }
  }

  S.tickLandExpansion = tickLandExpansion;

})(window.SFL = window.SFL || {});
