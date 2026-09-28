// ═══════════════════════════════════════════════════════════════════
// LUỒNG NẤU ĂN & CHẾ BIẾN THỰC PHẨM THÔNG MINH (cooking.js)
// Kiểm tra điều kiện CÔNG TRÌNH (Fire Pit, Kitchen, Bakery, Deli, Smoothie Shack)
// Hỗ trợ tự động tính toán hệ số nhân x2 nguyên liệu & chỉ nấu khi công trình đã xây xong
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
      if (typeof PointerEvent !== "undefined") {
        el.dispatchEvent(new PointerEvent("pointerover", { ...baseOpts, pointerId: 1, pointerType: "mouse" }));
        el.dispatchEvent(new PointerEvent("pointerenter", { ...baseOpts, pointerId: 1, pointerType: "mouse" }));
        el.dispatchEvent(new PointerEvent("pointerdown", { ...downOpts, pointerId: 1, pointerType: "mouse", isPrimary: true, pressure: 0.5 }));
      }
    } catch (_e2) {}
    el.dispatchEvent(new MouseEvent("mouseover", baseOpts));
    el.dispatchEvent(new MouseEvent("mouseenter", baseOpts));
    el.dispatchEvent(new MouseEvent("mousedown", downOpts));

    try {
      if (typeof PointerEvent !== "undefined") {
        el.dispatchEvent(new PointerEvent("pointerup", { ...upOpts, pointerId: 1, pointerType: "mouse", isPrimary: true, pressure: 0 }));
      }
    } catch (_e3) {}
    el.dispatchEvent(new MouseEvent("mouseup", upOpts));
    el.dispatchEvent(new MouseEvent("click", upOpts));

    try { el.click?.(); } catch (_e4) {}
    kichHoatReactProps(el);
    if (el.parentElement) kichHoatReactProps(el.parentElement);

    setTimeout(() => {
      try {
        if (typeof el.blur === "function") el.blur();
        el.dispatchEvent(new MouseEvent("mouseout", upOpts));
        el.dispatchEvent(new MouseEvent("mouseleave", upOpts));
      } catch (_e5) {}
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

  // Kiểm tra công trình bếp nào ĐÃ XÂY XONG trên đảo
  function layDanhSachBepDaXay(buildings) {
    const CAC_BEP = [
      { name: "Fire Pit", slug: "fire_pit" },
      { name: "Kitchen", slug: "kitchen" },
      { name: "Bakery", slug: "bakery" },
      { name: "Deli", slug: "deli" },
      { name: "Smoothie Shack", slug: "smoothie_shack" },
    ];

    if (!buildings || typeof buildings !== "object") {
      return CAC_BEP; // Fallback
    }

    const now = Date.now();
    const bepHopLe = [];

    for (const bep of CAC_BEP) {
      const ds = buildings[bep.name];
      if (Array.isArray(ds) && ds.length > 0) {
        const daXong = ds.some((b) => !b.readyAt || b.readyAt <= now);
        if (daXong) {
          bepHopLe.push(bep);
        }
      }
    }

    return bepHopLe.length > 0 ? bepHopLe : CAC_BEP;
  }

  function timCacBepDOM(danhSachBepKhaDung) {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    const slugs = (danhSachBepKhaDung || []).map((b) => b.slug);

    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;
      const cacAnhBep = doc.querySelectorAll(
        "img[src*='fire_pit'], img[src*='kitchen'], img[src*='bakery'], img[src*='deli'], img[src*='smoothie_shack']"
      );
      for (const img of cacAnhBep) {
        if (!xemPhanTuRanh(img)) continue;
        const src = (img.src || "").toLowerCase();
        const laBepKhaDung = slugs.length === 0 || slugs.some((s) => src.includes(s));
        if (!laBepKhaDung) continue;

        const target = img.closest('[data-map-placement]') || img.parentElement;
        if (!danhSach.includes(target)) danhSach.push(target);
      }
    }
    return danhSach;
  }

  // Kiểm tra React Props của nút Cook để biết chính xác có đủ nguyên liệu thực tế (kể cả khi bị x2)
  function kiemTraNutCookKhaThi(btn) {
    if (!btn || !xemPhanTuRanh(btn)) return false;
    if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return false;

    const cls = (btn.className || "").toLowerCase();
    if (cls.includes("opacity-50") || cls.includes("cursor-not-allowed") || cls.includes("bg-brown-600")) {
      return false;
    }

    for (const k in btn) {
      if (k.startsWith("__reactProps$")) {
        const p = btn[k];
        if (p) {
          if (p.disabled === true) return false;
          if (typeof p.hasIngredients === "boolean" && !p.hasIngredients) return false;
        }
      }
    }

    return true;
  }

  async function tickCooking() {
    if (dangBan) return false;
    if (typeof S.xinKhoa === "function" && !S.xinKhoa("cooking")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("cooking")) {
        return false;
      }

      // ── 1. ƯU TIÊN GAME BRIDGE (SIÊU TỐC & CHÍNH XÁC 100%) ──
      let daLamBridge = false;

      // A. Thu hoạch tất cả các món đã nấu chín
      if (typeof S.collectRecipesBridge === "function") {
        const resCol = await S.collectRecipesBridge(2500);
        if (resCol && resCol.ok && resCol.collectedCount > 0) {
          console.log(`%c[SFL Nấu Ăn] 🍲 Thu hoạch thành công ${resCol.collectedCount} món ăn đã nấu chín!`, "color: #00e676; font-weight: bold; font-size: 13px;");
          daLamBridge = true;
        }
      }

      // B. Nấu món ăn ưu tiên điểm kinh nghiệm (XP) cao nhất (tự động tính skill Double Nom x2/x3/x4 nguyên liệu)
      if (typeof S.cookBestRecipesBridge === "function") {
        const resCook = await S.cookBestRecipesBridge(3000);
        if (resCook && resCook.ok && Array.isArray(resCook.cookedList) && resCook.cookedList.length > 0) {
          for (const c of resCook.cookedList) {
            const multiStr = c.multiplier > 1 ? ` (⚡ Skill Double Nom: x${c.multiplier} nguyên liệu)` : "";
            console.log(
              `%c[SFL Nấu Ăn] 🍳 [${c.building}] Bắt đầu nấu: "${c.recipe}" | ⭐ ${c.experience.toLocaleString()} XP${multiStr}`,
              "color: #ff9800; font-weight: bold; font-size: 12px;"
            );
          }
          daLamBridge = true;
        }
      }

      if (daLamBridge) return true;

      // ── 2. FALLBACK DOM NẾU BRIDGE CHƯA KẾT NỐI ──
      let state = S.gameState;
      if (!state && typeof S.requestBridgeState === "function") {
        try { state = await S.requestBridgeState(1200); } catch (_e) {}
      }

      const bepDaXay = layDanhSachBepDaXay(state?.buildings);
      const beps = timCacBepDOM(bepDaXay);
      if (beps.length === 0) return false;

      let daNau = 0;
      for (const bep of beps) {
        clickTam(bep);
        await ngu(700);

        for (const doc of layTaiLieuGame()) {
          // Thu hoạch món đã nấu chín (Claim button)
          const cacBtnClaim = doc.querySelectorAll("button, [role='button'], div.cursor-pointer");
          for (const btn of cacBtnClaim) {
            if (!xemPhanTuRanh(btn)) continue;
            const txt = (btn.textContent || "").toLowerCase();
            if (txt.includes("claim") || txt.includes("collect") || txt.includes("nhận")) {
              console.log(`[SFL Nấu Ăn] 🍲 Thu hoạch món ăn chín: "${btn.textContent?.trim()}"`);
              clickTam(btn);
              daNau++;
              await ngu(500);
              break;
            }
          }

          // Chọn món ăn và nhấn Cook
          const cacBtnCook = doc.querySelectorAll("button, [role='button']");
          for (const btn of cacBtnCook) {
            const txt = (btn.textContent || "").toLowerCase();
            const laNutCook = (txt === "cook" || txt === "nấu" || txt.includes("cook")) && !txt.includes("cooking");

            if (laNutCook && kiemTraNutCookKhaThi(btn)) {
              console.log(`%c[SFL Nấu Ăn] 🍳 Đủ nguyên liệu thực tế! Bắt đầu nấu món...`, "color: #ff9800; font-weight: bold;");
              clickTam(btn);
              daNau++;
              await ngu(500);
              break;
            }
          }

          await dongModal(doc);
        }
      }

      return daNau > 0;
    } catch (err) {
      console.error("[SFL Nấu Ăn] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("cooking");
      }
    }
  }

  S.tickCooking = tickCooking;

})(window.SFL = window.SFL || {});
