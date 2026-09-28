// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG NHẬN THƯỞNG NHIỆM VỤ TUẦN (weekly_chores.js)
// Chuyên trách Nhiệm vụ tuần của Hayseed Hank, Raven, Bert, Betty, Finn... & Kingdom Chores
// Tự động quét tiến độ & Nhận ngay Vé Chapter, EXP và Xu thưởng
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function tickWeeklyChores() {
    if (dangBan) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("weekly_chores")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("weekly_chores")) {
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

      const choreBoard = state?.choreBoard?.chores || {};
      const kingdomChores = state?.kingdomChores?.chores || [];
      const totalChores = Object.keys(choreBoard).length + kingdomChores.length;

      console.log(
        `%c[SFL Weekly Chores] 📋 Quét ${totalChores} nhiệm vụ tuần (NPC Chore Board & Kingdom)...`,
        "color: #ff9800; font-weight: bold; font-size: 13px;"
      );

      // 2. Nhận thưởng qua Game Bridge
      if (typeof S.claimChoresBridge === "function") {
        const res = await S.claimChoresBridge(3500);
        if (res && res.ok && res.claimedCount > 0) {
          console.log(
            `%c[SFL Weekly Chores] 🎉 ĐÃ NHẬN THƯỞNG ${res.claimedCount} NHIỆM VỤ TUẦN HOÀN THÀNH!`,
            "color: #00e676; font-weight: bold; font-size: 14px;"
          );
          if (Array.isArray(res.claimedChores)) {
            console.table(res.claimedChores);
          }
          return true;
        } else {
          console.log(`[SFL Weekly Chores] ℹ️ Hiện chưa có thêm nhiệm vụ tuần nào đạt 100% tiến độ để nhận.`);
        }
      }

      return false;
    } catch (err) {
      console.error("[SFL Weekly Chores] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("weekly_chores");
      }
    }
  }

  S.tickWeeklyChores = tickWeeklyChores;

})(window.SFL = window.SFL || {});
