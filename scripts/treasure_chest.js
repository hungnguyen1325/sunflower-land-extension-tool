// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG MỞ RƯƠNG KHO BÁU KHI CÓ CHÌA KHÓA (treasure_chest.js)
// Tự động quét chìa khóa trong kho: Treasure Key, Rare Key, Luxury Key, Sunstone Key, Obsidian Key
// Mở khóa rương kho báu siêu tốc qua Game Bridge và thu thập toàn bộ báu vật
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
    const view = el.ownerDocument?.defaultView || window;
    try { if (view && typeof view.focus === "function") view.focus(); } catch (_e) {}
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const baseOpts = { bubbles: true, cancelable: true, composed: true, view: view, clientX: cx, clientY: cy };
    try {
      el.dispatchEvent(new PointerEvent("pointerdown", { ...baseOpts, buttons: 1 }));
      el.dispatchEvent(new MouseEvent("mousedown", { ...baseOpts, buttons: 1 }));
      el.dispatchEvent(new PointerEvent("pointerup", { ...baseOpts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent("mouseup", { ...baseOpts, buttons: 0 }));
      el.dispatchEvent(new MouseEvent("click", baseOpts));
      try { el.click?.(); } catch (_e2) {}
    } catch (_e) {}
    return true;
  }

  async function tickTreasureChest() {
    if (dangBan) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("treasure_chest")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("treasure_chest")) {
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
      const CHEST_KEYS = [
        { key: "Treasure Key", name: "Rương Cơ Bản (Treasure Chest)" },
        { key: "Rare Key", name: "Rương Hiếm (Rare Chest)" },
        { key: "Luxury Key", name: "Rương Sang Trọng (Luxury Chest)" },
        { key: "Sunstone Key", name: "Rương Sunstone (Sunstone Chest)" },
        { key: "Obsidian Key", name: "Rương Obsidian (Obsidian Chest)" },
      ];

      let tongChiaKhoa = 0;
      const keyStats = [];
      for (const item of CHEST_KEYS) {
        const sl = toSafeNumber(inv[item.key]);
        tongChiaKhoa += sl;
        if (sl > 0) {
          keyStats.push({
            "Loại Chìa Khóa": item.key,
            "Rương Tương Ứng": item.name,
            "Số Lượng Trong Kho": sl,
            "Trạng Thái": "🗝️ Sẵn sàng mở",
          });
        }
      }

      if (tongChiaKhoa <= 0) {
        return false;
      }

      console.log(
        `%c[SFL Mở Rương Kho Báu] 🗝️ Phát hiện ${tongChiaKhoa} Chìa Khóa Kho Báu trong kho đồ!`,
        "color: #ffd700; font-weight: bold; font-size: 13px;"
      );
      console.table(keyStats);

      // 2. ƯU TIÊN MỞ QUA GAME BRIDGE SIÊU TỐC
      if (typeof S.openTreasureChestsBridge === "function") {
        const res = await S.openTreasureChestsBridge(4000);
        if (res && res.ok && res.openedCount > 0) {
          console.log(
            `%c[SFL Mở Rương Kho Báu] 🎉 ĐÃ MỞ THÀNH CÔNG ${res.openedCount} RƯƠNG KHO BÁU QUA GAME BRIDGE!`,
            "color: #00e676; font-weight: bold; font-size: 14px;"
          );
          return true;
        }
      }

      // 3. FALLBACK DOM NẾU ĐANG MỞ MODAL RƯƠNG
      for (const doc of layTaiLieuGame()) {
        const cacBtnOpen = doc.querySelectorAll("button, [role='button']");
        for (const btn of cacBtnOpen) {
          if (!xemPhanTuRanh(btn) || btn.disabled) continue;
          const txt = (btn.textContent || "").toLowerCase().trim();
          if (txt === "open" || txt === "mở") {
            clickTam(btn);
            await ngu(1000);
            return true;
          }
        }
      }

      return false;
    } catch (err) {
      console.error("[SFL Mở Rương Kho Báu] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("treasure_chest");
      }
    }
  }

  S.tickTreasureChest = tickTreasureChest;

})(window.SFL = window.SFL || {});
