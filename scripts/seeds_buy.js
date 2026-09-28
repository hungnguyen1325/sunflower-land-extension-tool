// ═══════════════════════════════════════════════════════════════════
// LUỒNG MUA HẠT GIỐNG TỰ ĐỘNG QUA GAME BRIDGE (seeds_buy.js)
// Mua 100% qua Game Bridge API siêu tốc (không mở UI Betty, không tra từng item)
// Mua toàn bộ hạt giống đúng mùa (Crops + Fruits + Flowers + Greenhouse)
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ═══════ QUY TRÌNH MUA HẠT GIỐNG TỰ ĐỘNG QUA GAME BRIDGE ═══════
  // CHỈ CHẠY 1 LẦN DUY NHẤT Ở VÒNG 1, TỪ VÒNG 2 BỎ QUA CHO ĐẾN KHI TẢI LẠI TRANG
  async function tickSeedsBuy(force = false) {
    if (dangBan) return false;

    // 0. KIỂM TRA SỐ DƯ TIỀN TỆ: NẾU < 0.01 XU THÌ BỎ QUA LUỒNG MUA HẠT (Sunflower Seed = 0.01)
    let state = S.gameState || S.userData;
    if (!state && typeof S.requestBridgeState === "function") {
      try { state = await S.requestBridgeState(1500); } catch (_e) {}
    }

    const currentCoins = Number(
      state?.coins ??
      state?.user?.coins ??
      state?.balance ??
      state?.user?.balanceSFL ??
      S.userData?.coins ??
      0
    );

    if (currentCoins < 0.01) {
      console.log(`%c[SFL Mua Hạt Giống] 💰 Số dư hiện tại (${currentCoins.toFixed(3)} xu < 0.01 xu) -> Bỏ qua luồng mua hạt giống để tiết kiệm tiền.`, "color: #ff9800; font-weight: bold;");
      return false;
    }

    if (S.__daMuaHatGiongVongDau && !force) {
      console.log("%c[SFL Mua Hạt Giống] ℹ️ Luồng mua hạt giống đã hoàn thành ở vòng 1 -> Bỏ qua từ vòng 2 cho đến khi tải lại trang.", "color: #9e9e9e;");
      return false;
    }

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("seeds_buy")) {
      return false;
    }
    dangBan = true;
    S.__daMuaHatGiongVongDau = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("seeds_buy")) {
        return false;
      }

      console.log("%c[SFL Mua Hạt Giống] 🌻 Bắt đầu luồng mua hạt giống tự động qua Game Bridge (100% không mở UI shop)...", "color: #ff9800; font-weight: bold; font-size: 13px;");

      // ── MUA TOÀN BỘ HẠT GIỐNG ĐÚNG MÙA QUA GAME BRIDGE ──
      if (typeof S.buySeasonalSeedsBridge !== "function") {
        console.warn("[SFL Mua Hạt Giống] ⚠️ Hàm S.buySeasonalSeedsBridge chưa sẵn sàng, thử đợi Bridge...");
        await ngu(600);
      }

      if (typeof S.buySeasonalSeedsBridge === "function") {
        const res = await S.buySeasonalSeedsBridge(6000);
        if (res && res.ok) {
          const list = res.boughtList || res.bought || [];
          if (list.length > 0) {
            console.log(
              `%c[SFL Mua Hạt Giống] 🎉 ĐÃ MUA THÀNH CÔNG ${list.length} LOẠI HẠT GIỐNG ĐÚNG MÙA QUA GAME BRIDGE! (Đã chi: ${res.totalCoinsSpent?.toLocaleString() || 0} Coins | Còn lại: ${res.remainingCoins?.toLocaleString() || 0} Coins)`,
              "color: #00e676; font-weight: bold; font-size: 14px;"
            );
            console.table(
              list.map((b) => ({
                "Hạt Giống": b.seed,
                "Phân Loại": b.type ? b.type.toUpperCase() : (b.category || "CROP"),
                "Số Lượng": `+${b.amount}`,
                "Đơn Giá": `${b.unitPrice} Coins`,
                "Tổng Chi": `${b.totalCost?.toLocaleString() || 0} Coins`,
              }))
            );
          } else {
            console.log(
              "%c[SFL Mua Hạt Giống] ℹ️ Kho hạt giống đã đầy (≥ 400 hạt) hoặc cửa hàng Betty đã hết lượt bán trong đợt này.",
              "color: #4caf50; font-weight: bold;"
            );
          }
          return true;
        } else {
          console.log("[SFL Mua Hạt Giống] ℹ️ Kết quả mua hạt giống:", res?.error || "Không có hạt nào cần mua thêm.");
        }
      } else {
        console.error("[SFL Mua Hạt Giống] ❌ Lỗi: Game Bridge chưa được nạp đầy đủ!");
      }

      return true;
    } catch (err) {
      console.error("[SFL Mua Hạt Giống] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("seeds_buy");
      }
    }
  }

  S.tickSeedsBuy = tickSeedsBuy;

})(window.SFL = window.SFL || {});
