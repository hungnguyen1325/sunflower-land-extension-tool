// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG GIAO ĐƠN HÀNG TOÀN DIỆN (deliveries.js)
// HỖ TRỢ ĐỘC QUYỀN TÀI KHOẢN VIP (+2 TICKET THƯỞNG) & TÀI KHOẢN THƯỜNG
// GIAO HẾT ĐƠN ĐỦ NGUYÊN LIỆU QUA GAME BRIDGE — CHỈ SKIP ĐƠN THIẾU ĐỒ ĐỂ LẤY NHIỆM VỤ MỚI
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

  function kichHoatReactProps(el) {
    if (!el) return;
    for (const k in el) {
      if (k.startsWith("__reactProps$") || k.startsWith("__reactEventHandlers$")) {
        const p = el[k];
        if (p) {
          if (typeof p.onPointerDown === "function") {
            try { p.onPointerDown({ stopPropagation: () => {}, preventDefault: () => {}, target: el, currentTarget: el, button: 0 }); } catch (_e) {}
          }
          if (typeof p.onClick === "function") {
            try { p.onClick({ stopPropagation: () => {}, preventDefault: () => {}, target: el, currentTarget: el, button: 0 }); } catch (_e) {}
          }
        }
      }
    }
  }

  function clickTam(el) {
    if (!el) return false;
    const view = el.ownerDocument?.defaultView || window;
    try { if (view && typeof view.focus === "function") view.focus(); } catch (_e) {}
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const baseOpts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: view,
      clientX: cx,
      clientY: cy,
      pageX: cx + (view.scrollX || 0),
      pageY: cy + (view.scrollY || 0),
      which: 1,
      button: 0,
    };
    const downOpts = { ...baseOpts, buttons: 1 };
    const upOpts = { ...baseOpts, buttons: 0 };

    try { el.focus?.({ preventScroll: true }); } catch (_e) {}

    try {
      try { el.dispatchEvent(new PointerEvent("pointerdown", downOpts)); } catch (_p1) {}
      el.dispatchEvent(new MouseEvent("mousedown", downOpts));
      try { el.dispatchEvent(new PointerEvent("pointerup", upOpts)); } catch (_p2) {}
      el.dispatchEvent(new MouseEvent("mouseup", upOpts));
      el.dispatchEvent(new MouseEvent("click", baseOpts));
      try { el.click?.(); } catch (_e2) {}
      kichHoatReactProps(el);
    } catch (_e2) {}

    setTimeout(() => {
      try {
        if (typeof el.blur === "function") el.blur();
      } catch (_e6) {}
    }, 40);

    return true;
  }

  async function dongModal(doc) {
    const cacAnhClose = doc.querySelectorAll('img[src*="close"], img[src*="cancel"]');
    for (const img of cacAnhClose) {
      if (xemPhanTuRanh(img)) {
        const pText = (img.parentElement?.textContent || img.closest("div, button")?.textContent || "").toLowerCase();
        if (pText.includes("vip") || (img.src || "").toLowerCase().includes("vip")) continue;
        const nut = img.closest("button, [role='button']") || img;
        clickTam(nut);
        await ngu(250);
        return;
      }
    }
    try {
      const view = doc.defaultView || window;
      view.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
    } catch (_e) {}
  }

  // ═══════ LUỒNG CHÍNH: GIAO ĐƠN HÀNG TỰ ĐỘNG (VIP & THƯỜNG) ═══════
  async function tickDeliveries() {
    if (dangBan) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("deliveries")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("deliveries")) {
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
      const loaiTaiKhoan = isVip ? "👑 TÀI KHOẢN VIP (+2 Tickets Thưởng)" : "🌾 TÀI KHOẢN THƯỜNG";
      const orders = state?.orders || [];
      const inv = state?.inventory || {};
      const coins = Number(state?.user?.coins ?? state?.coins ?? 0);
      const sfl = Number(state?.user?.balanceSFL ?? state?.balance ?? 0);
      const now = Date.now();

      console.log(
        `%c[SFL Giao Đơn Hàng v6.2] 📦 Quét ${orders.length} đơn hàng NPC / Thuyền (${loaiTaiKhoan})...`,
        isVip ? "color: #ffd700; font-weight: bold; font-size: 13px;" : "color: #00bcd4; font-weight: bold; font-size: 13px;"
      );

      // Hiển thị bảng chi tiết trạng thái tất cả các đơn hàng trong game
      if (orders.length > 0) {
        const orderSummary = orders.map((ord) => {
          let du = true;
          const reqList = [];
          const reqItems = ord.items || {};

          for (const [item, reqQty] of Object.entries(reqItems)) {
            const numReq = Number(reqQty || 0);
            let inStock = 0;
            if (item === "coins") inStock = coins;
            else if (item === "sfl") inStock = sfl;
            else inStock = Number(inv[item] || 0);

            const okItem = inStock >= numReq;
            if (!okItem) du = false;
            reqList.push(`${item}: ${inStock}/${numReq} ${okItem ? "✔️" : "❌"}`);
          }

          let trangThai = "⏳ Chờ nguyên liệu";
          if (ord.completedAt) trangThai = "✅ Đã giao";
          else if (ord.readyAt && ord.readyAt > now) trangThai = "⏰ Chưa đến giờ";
          else if (du) trangThai = "🚀 Đủ hàng (Sẵn sàng giao)";

          // Phân loại ưu tiên: ① Coin → ② Shiny → ③ Khác → ④ Flower (chỉ giao khi có VIP)
          let loaiShip = "③ Khác";
          if (ord.reward?.coins) loaiShip = "① Coin";
          else if (ord.reward?.items?.["Shiny Feather"]) loaiShip = "② Shiny";
          else if (ord.reward?.sfl) loaiShip = "④ Flower (cần VIP)";
          if (ord.reward?.sfl && !isVip) trangThai = "🔒 Flower (acc thường)";

          return {
            "Loại Đơn": loaiShip,
            "Khách Hàng": (ord.from || "NPC").toUpperCase(),
            "Yêu Cầu (Kho/Cần)": reqList.join(" | "),
            "Trạng Thái": trangThai,
          };
        });
        console.table(orderSummary);
      }

      let coHoatDong = false;

      // ── 1. GIAO ĐƠN HÀNG THUYỀN / NPC TIÊU CHUẨN QUA GAME BRIDGE ──
      if (typeof S.deliverOrdersBridge === "function") {
        const res = await S.deliverOrdersBridge(8000, true);
        if (res && res.ok && res.deliveredCount > 0) {
          coHoatDong = true;
          const list = res.deliveredList || [];
          console.log(
            `%c[SFL Giao Đơn Hàng] 🎉 ĐÃ GIAO THÀNH CÔNG ${res.deliveredCount} ĐƠN HÀNG QUA GAME BRIDGE! (${loaiTaiKhoan})`,
            "color: #00e676; font-weight: bold; font-size: 14px;"
          );

          console.table(
            list.map((d) => {
              const itemsStr = Object.entries(d.items || {})
                .map(([name, count]) => `${count}x ${name}`)
                .join(", ");
              const rewardCoins = d.reward?.coins ? `${d.reward.coins} Coins` : "";
              const rewardSfl = d.reward?.sfl ? `${d.reward.sfl} SFL` : "";
              const rewardItems = Object.entries(d.reward?.items || {})
                .map(([name, count]) => `${count}x ${name}`)
                .join(", ");
              const rewardStr = [rewardCoins, rewardSfl, rewardItems].filter(Boolean).join(" + ") || "EXP / Friendship";

              return {
                "Khách Hàng (NPC)": (d.from || "NPC").toUpperCase(),
                "Hàng Đã Giao": itemsStr,
                "Phần Thưởng Nhận Được": rewardStr,
                "Chế Độ VIP": d.isVip ? "👑 VIP (+2 Bonus)" : "Thường",
              };
            })
          );

          // Báo cáo các đơn không giao được đã tự bỏ qua (skip) để nhận nhiệm vụ mới
          if ((res.skippedCount || 0) > 0) {
            console.log(
              `%c[SFL Giao Đơn Hàng] 🚮 Đã BỎ QUA ${res.skippedCount} đơn không giao được để nhận nhiệm vụ mới!`,
              "color: #ff9800; font-weight: bold;"
            );
            console.table(
              (res.skippedList || []).map((s) => ({
                "Khách Hàng (NPC)": (s.from || "NPC").toUpperCase(),
                "Yêu Cầu": Object.entries(s.items || {})
                  .map(([name, count]) => `${count}x ${name}`)
                  .join(", "),
              }))
            );
          }

          // Nếu chỉ skip mà không giao được đơn nào -> vẫn xem như có hoạt động (nhiệm vụ mới sẽ thay vào)
          if ((res.skippedCount || 0) > 0 && res.deliveredCount === 0) {
            coHoatDong = true;
          }

          // Chỉ giao qua Game Bridge (không dùng fallback click DOM để tránh giao nhầm)
          return true;
        } else if (res && res.error) {
          console.log(
            `%c[SFL Giao Đơn Hàng] ⚠️ Bridge giao đơn không thành công: ${res.error}`,
            "color: #ff9800; font-weight: bold;"
          );
          if (res.diag?.length) console.log(`%c[SFL Giao Đơn Hàng] 📋 ${res.diag.join(" | ")}`, "color: #ff9800;");
        } else {
          // ok mà 0 đơn / 0 skip -> không có gì để làm. In diag để biết lý do từng đơn bị loại.
          console.log(
            `%c[SFL Giao Đơn Hàng] ℹ️ Không có đơn nào giao được (0 giao / 0 skip). Xem chi tiết bên dưới:`,
            "color: #ff9800; font-weight: bold;"
          );
          if (res.diag?.length) console.log(`%c[SFL Giao Đơn Hàng] 📋 ${res.diag.join(" | ")}`, "color: #ff9800;");
        }
      } else {
        console.log(
          `%c[SFL Giao Đơn Hàng] ⚠️ Chưa nạp S.deliverOrdersBridge (reload extension + tải lại game trước khi chạy)`,
          "color: #ff9800; font-weight: bold;"
        );
      }

      return false;
    } catch (err) {
      console.error("[SFL Giao Đơn Hàng] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("deliveries");
      }
    }
  }

  S.tickDeliveries = tickDeliveries;

})(window.SFL = window.SFL || {});
