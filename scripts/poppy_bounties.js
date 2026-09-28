// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG GIAO BOUNTIES CHO POPPY (poppy_bounties.js)
// Chuyên trách Bảng Săn Nông Sản Truy Nã (Mega Bounty Board) tại Plaza
// Tự động đối chiếu kho đồ & Giao hàng đổi Vé Mùa Vụ, Token $FLOWER & Nhận Bounty Bonus
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function tickPoppyBounties() {
    if (dangBan) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("poppy_bounties")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("poppy_bounties")) {
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

      const requests = state?.bounties?.requests || [];
      const inv = state?.inventory || {};
      const bonusClaimed = !!state?.bounties?.bonusClaimed;

      console.log(
        `%c[SFL Poppy Bounties] 🎯 Quét ${requests.length} mục truy nã tại Mega Bounty Board (Poppy Plaza)...`,
        "color: #ff007f; font-weight: bold; font-size: 13px;"
      );

      // Hiển thị bảng chẩn đoán Bounties chi tiết
      if (requests.length > 0) {
        const bountySummary = requests.map((req) => {
          const reqQty = Number(req.quantity || 1);
          const inStock = Number(inv[req.name] || 0);
          const du = inStock >= reqQty;

          let trangThai = "⏳ Chưa đủ hàng";
          if (req.completed) trangThai = "✅ Đã giao xong";
          else if (du) trangThai = "🚀 Đủ hàng (Sẵn sàng giao)";

          return {
            "Mục Truy Nã": req.name,
            "Số Lượng (Kho/Cần)": `${inStock}/${reqQty} ${du ? "✔️" : "❌"}`,
            "Thưởng Xu": `${req.coins || 0} Coins`,
            "Trạng Thái": trangThai,
          };
        });
        console.table(bountySummary);
      }

      // 2. Giao hàng qua Game Bridge
      if (typeof S.sellBountiesBridge === "function") {
        const res = await S.sellBountiesBridge(3500);
        if (res && res.ok && (res.soldCount > 0 || res.bonusClaimed)) {
          console.log(
            `%c[SFL Poppy Bounties] 🎉 ĐÃ GIAO ${res.soldCount} MÓN CHO POPPY! ${res.bonusClaimed ? "🏆 (ĐÃ NHẬN THÊM BOUNTY BONUS)" : ""}`,
            "color: #00e676; font-weight: bold; font-size: 14px;"
          );
          return true;
        } else {
          console.log(`[SFL Poppy Bounties] ℹ️ Chưa có món Bounties nào đủ 100% số lượng trong kho.`);
        }
      }

      return false;
    } catch (err) {
      console.error("[SFL Poppy Bounties] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("poppy_bounties");
      }
    }
  }

  S.tickPoppyBounties = tickPoppyBounties;

})(window.SFL = window.SFL || {});
