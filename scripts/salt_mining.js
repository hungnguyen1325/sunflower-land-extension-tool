// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG CÀO MUỐI & ĐÀO MỎ DẦU (salt_mining.js)
// Tự động sử dụng Cào muối (Salt Rake) để thu hoạch các ô muối (Salt Farm Nodes)
// Tự động sử dụng Mũi khoan (Drill) để khai thác Mỏ Dầu (Oil Reserves) & Nâng cấp Salt Farm
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

  async function tickSaltMining() {
    if (dangBan) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("salt_mining")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("salt_mining")) {
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

      const inv = state?.inventory || {};
      const saltRakes = toSafeNumber(inv["Salt Rake"]);
      const drills = toSafeNumber(inv.Drill) + toSafeNumber(inv["Oil Drill"]);
      const saltNodes = Object.keys(state?.saltFarm?.nodes || {}).length;
      const oilReserves = Object.keys(state?.oilReserves || {}).length;

      if ((saltRakes <= 0 || saltNodes <= 0) && (drills <= 0 || oilReserves <= 0)) {
        return false;
      }

      console.log(
        `%c[SFL Khai Thác Muối & Dầu] 🧂 Kiểm tra ${saltNodes} Ô Muối (${saltRakes} Cào Rake) & ${oilReserves} Mỏ Dầu (${drills} Khoan Drill)...`,
        "color: #ff9800; font-weight: bold; font-size: 13px;"
      );

      // 2. Thu hoạch qua Game Bridge
      if (typeof S.harvestSaltOilBridge === "function") {
        const res = await S.harvestSaltOilBridge(3500);
        if (res && res.ok && (res.saltHarvested > 0 || res.oilDrilled > 0 || res.saltFarmUpgraded)) {
          console.log(
            `%c[SFL Khai Thác Muối & Dầu] 🎉 THÀNH CÔNG: Đã cào ${res.saltHarvested} Muối, Đào ${res.oilDrilled} Mỏ Dầu! ${res.saltFarmUpgraded ? "🏰 (ĐÃ NÂNG CẤP TRẠI MUỐI)" : ""}`,
            "color: #00e676; font-weight: bold; font-size: 14px;"
          );
          return true;
        }
      }

      return false;
    } catch (err) {
      console.error("[SFL Khai Thác Muối & Dầu] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("salt_mining");
      }
    }
  }

  S.tickSaltMining = tickSaltMining;

})(window.SFL = window.SFL || {});
