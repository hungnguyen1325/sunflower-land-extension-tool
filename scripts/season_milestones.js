// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG NHẬN QUÀ MỐC ĐIỂM SEASON (season_milestones.js)
// Chuyên trách Mốc Điểm Mùa Vụ (Season Track Milestones Free + VIP) & Codex Milestones
// Tự động nhận Trang phục độc quyền, Vé Bonus, Tokens $FLOWER & Hộp quà Tool/Food Box
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function tickSeasonMilestones() {
    if (dangBan) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("season_milestones")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("season_milestones")) {
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

      const isVip = !!state?.user?.isVip;
      const loaiTaiKhoan = isVip ? "👑 VIP (+ Quà Mốc Premium)" : "🌾 THƯỜNG (Quà Mốc Free)";

      console.log(
        `%c[SFL Quà Mốc Season] 🏆 Bắt đầu quét Quà Mốc Điểm Season & Codex (${loaiTaiKhoan})...`,
        "color: #ffd700; font-weight: bold; font-size: 13px;"
      );

      // 2. Nhận thưởng qua Game Bridge
      if (typeof S.claimMilestonesBridge === "function") {
        const res = await S.claimMilestonesBridge(3500);
        if (res && res.ok && (res.claimedTracks > 0 || res.claimedCodex > 0)) {
          console.log(
            `%c[SFL Quà Mốc Season] 🎉 ĐÃ NHẬN THÀNH CÔNG ${res.claimedTracks} QUÀ MỐC ĐIỂM SEASON & ${res.claimedCodex} MỐC CODEX!`,
            "color: #00e676; font-weight: bold; font-size: 14px;"
          );
          return true;
        } else {
          console.log(`[SFL Quà Mốc Season] ℹ️ Chưa có mốc điểm Season nào mới đạt đủ điều kiện để nhận.`);
        }
      }

      return false;
    } catch (err) {
      console.error("[SFL Quà Mốc Season] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("season_milestones");
      }
    }
  }

  S.tickSeasonMilestones = tickSeasonMilestones;

})(window.SFL = window.SFL || {});
