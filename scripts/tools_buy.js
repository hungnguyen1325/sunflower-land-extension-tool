// ═══════════════════════════════════════════════════════════════════
// LUỒNG MUA & CHẾ TẠO CÔNG CỤ THÔNG MINH QUA GAME BRIDGE (tools_buy.js)
// Hoàn toàn không phụ thuộc DOM hay mở bàn Workbench/Blacksmith!
// Tương tác trực tiếp qua Game Bridge (XState Game Service) siêu tốc, chuẩn xác 100%
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function layTaiLieuGame() {
    const out = [];
    const daThay = new Set();
    const them = (doc) => {
      if (!doc || daThay.has(doc)) return;
      daThay.add(doc);
      out.push(doc);
    };
    const nganXep = [];
    them(document);
    nganXep.push(document);
    while (nganXep.length) {
      const doc = nganXep.pop();
      let iframes;
      try { iframes = doc.querySelectorAll("iframe"); } catch (_e) { continue; }
      for (let i = 0; i < iframes.length; i += 1) {
        try {
          const idoc = iframes[i].contentDocument;
          if (idoc) { them(idoc); nganXep.push(idoc); }
        } catch (_e2) {}
      }
    }
    return out;
  }

  function xemPhanTuRanh(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const view = el.ownerDocument?.defaultView || window;
    let style;
    try { style = view.getComputedStyle(el); } catch (_e) { return false; }
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function clickTam(el) {
    if (!el) return false;
    try { el.click?.(); } catch (_e) {}
    return true;
  }

  function laNutCloseChuan(el) {
    if (!el || !xemPhanTuRanh(el)) return false;
    const src = (el.src || el.getAttribute?.("src") || "").toLowerCase();
    const alt = (el.alt || el.getAttribute?.("alt") || "").toLowerCase();

    const pText = (el.parentElement?.textContent || el.closest?.("div, button, [role='button']")?.textContent || "").toLowerCase();
    if (pText.includes("vip") || src.includes("vip")) return false;
    if (el.closest?.('[class*="vip"], [id*="vip"], [data-name*="vip"]')) return false;

    if (src.includes("compost") || src.includes("closed") || src.includes("building") || src.includes("island")) {
      return false;
    }
    const laAnhClose = src.includes("/ui/close") || src.includes("/icons/close") || src.includes("close.png") || src.includes("cancel.png") || alt === "close" || alt === "cancel";
    const laAriaClose = el.getAttribute?.("aria-label") === "close";
    const trongDialog = !!el.closest?.('[role="dialog"], [role="modal"], div[class*="modal"], .fixed.inset-0');
    return (laAnhClose || laAriaClose) && trongDialog;
  }

  // Đóng bất kỳ popup nào còn sót lại (dọn dẹp giao diện sạch sẽ)
  async function dongHetTatCaPopup() {
    const taiLieu = layTaiLieuGame();
    for (let loop = 0; loop < 2; loop += 1) {
      let coPopupDong = false;
      for (const doc of taiLieu) {
        if (!doc || !doc.body) continue;
        const cacAnhClose = doc.querySelectorAll('img[src*="/ui/close"], img[src*="close.png"], img[src*="cancel.png"], button[aria-label="close"]');
        for (const img of cacAnhClose) {
          if (!laNutCloseChuan(img)) continue;
          const nut = img.closest("button, [role='button']") || img;
          clickTam(nut);
          coPopupDong = true;
          await ngu(150);
          break;
        }
      }
      if (!coPopupDong) break;
      await ngu(150);
    }
  }

  // ═══════ QUY TRÌNH MUA CÔNG CỤ TỰ ĐỘNG QUA GAME BRIDGE ═══════
  // CHỈ CHẠY 1 LẦN DUY NHẤT Ở VÒNG 1, TỪ VÒNG 2 BỎ QUA CHO ĐẾN KHI TẢI LẠI TRANG
  async function tickToolsBuy(force = false) {
    if (dangBan) return false;

    if (S.__daMuaCongCuVongDau && !force) {
      console.log("%c[SFL Mua Công Cụ] ℹ️ Luồng mua công cụ đã hoàn thành ở vòng 1 -> Bỏ qua từ vòng 2 cho đến khi tải lại trang.", "color: #9e9e9e;");
      return false;
    }

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("tools_buy")) {
      return false;
    }
    dangBan = true;
    S.__daMuaCongCuVongDau = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("tools_buy")) {
        return false;
      }

      console.log("%c[SFL Mua Công Cụ] 🛠️ Bắt đầu luồng mua công cụ tự động qua Game Bridge (không dùng DOM)...", "color: #2196f3; font-weight: bold; font-size: 13px;");

      // 1. Lấy trạng thái Game State mới nhất từ Game Bridge
      let state = S.gameState;
      if (!state && typeof S.requestBridgeState === "function") {
        state = await S.requestBridgeState(2000);
      }

      const coins = Number(state?.user?.coins ?? state?.coins ?? 0);
      console.log(`%c[SFL Mua Công Cụ] 🪙 Số dư hiện tại: ${coins.toLocaleString()} Coins`, "color: #ff9800; font-weight: bold;");

      if (coins < 20) {
        console.log("%c[SFL Mua Công Cụ] ℹ️ Số dư < 20 coins (không đủ tiền mua bất kỳ công cụ nào) -> Bỏ qua.", "color: #9e9e9e;");
        return true;
      }

      // 2. Chế tạo / Mua công cụ tự động qua Game Bridge (XState Engine)
      if (typeof S.batchBuyToolsBridge !== "function") {
        console.warn("[SFL Mua Công Cụ] ⚠️ Hàm S.batchBuyToolsBridge chưa sẵn sàng, thử đợi Bridge...");
        await ngu(800);
      }

      if (typeof S.batchBuyToolsBridge !== "function") {
        console.error("[SFL Mua Công Cụ] ❌ Lỗi: Game Bridge chưa được nạp đầy đủ!");
        return false;
      }

      const result = await S.batchBuyToolsBridge(5000);

      if (!result || !result.ok) {
        console.warn("[SFL Mua Công Cụ] ⚠️ Game Bridge phản hồi lỗi:", result?.error || result?.message || "Không phản hồi");
        return false;
      }

      const crafted = result.crafted || [];
      if (crafted.length === 0) {
        console.log("%c[SFL Mua Công Cụ] ℹ️ Kho công cụ đã đầy hoặc không có công cụ nào đủ điều kiện tài nguyên để mua thêm.", "color: #4caf50; font-weight: bold;");
        return true;
      }

      // 3. Báo cáo chi tiết danh sách công cụ đã mua thành công
      console.log(
        `%c[SFL Mua Công Cụ] ✔️ ĐÃ MUA THÀNH CÔNG ${crafted.length} LOẠI CÔNG CỤ QUA GAME BRIDGE! (Đã chi: ${result.totalCoinsSpent.toLocaleString()} Coins | Còn lại: ${result.remainingCoins?.toLocaleString()} Coins)`,
        "color: #4caf50; font-weight: bold; font-size: 14px;"
      );

      console.table(
        crafted.map((c) => ({
          "Công Cụ": c.tool,
          "Số Lượng": `+${c.amount}`,
          "Đơn Giá": `${c.unitPrice} Coins`,
          "Tổng Chi Tiêu": `${c.totalCost.toLocaleString()} Coins`,
        }))
      );

      // Cập nhật lại cache state sau khi mua thành công
      if (typeof S.requestBridgeState === "function") {
        await S.requestBridgeState(1000);
      }

      return true;
    } catch (err) {
      console.error("[SFL Mua Công Cụ] Lỗi:", err);
      return false;
    } finally {
      await dongHetTatCaPopup();
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("tools_buy");
      }
    }
  }

  S.tickToolsBuy = tickToolsBuy;
  S.buyToolsBridge = tickToolsBuy;

})(window.SFL = window.SFL || {});
