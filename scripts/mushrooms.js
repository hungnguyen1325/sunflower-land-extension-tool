// ═══════════════════════════════════════════════════════════════════
// LUỒNG THU HOẠCH NẤM RỪNG (mushrooms.js)
// Dựa vào Game Bridge để xác định nấm xuất hiện trên đảo
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
      screenX: cx,
      screenY: cy,
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

  // Lấy background-image thực tế kể cả từ CSS (nấm render dưới dạng DIV spritesheet, KHÔNG phải <img>)
  function layBackgroundImage(el) {
    if (!el) return "";
    try {
      if (el.style && el.style.backgroundImage && el.style.backgroundImage !== "none") {
        return String(el.style.backgroundImage).toLowerCase();
      }
      const view = el.ownerDocument?.defaultView || window;
      const s = view.getComputedStyle(el);
      return String((s && s.backgroundImage) || "").toLowerCase();
    } catch (_e) {
      return "";
    }
  }

  function timNamDOM() {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    const daThem = new Set();

    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // 1. Nấm render dưới dạng DIV có class mushroom / spritesheet (background-image, KHÔNG có <img>)
      const ungVien = doc.querySelectorAll("div.mushroom, div[class*='mushroom'], .react-responsive-spritesheet-container__move");
      for (const el of ungVien) {
        const rootEl = el.closest("div.mushroom, div[class*='mushroom']") || el;
        const placement = rootEl.closest('[data-map-placement]');
        const target = placement || rootEl;
        if (daThem.has(target) || !xemPhanTuRanh(target)) continue;

        const moveEl = rootEl.querySelector(".react-responsive-spritesheet-container__move") || rootEl;
        const bgImg =
          layBackgroundImage(moveEl) + " " + layBackgroundImage(rootEl);
        const cacImg = Array.from(rootEl.querySelectorAll("img")).map((i) => (i.src || "").toLowerCase());
        const coNam =
          bgImg.includes("wild_mushroom") ||
          bgImg.includes("magic_mushroom") ||
          bgImg.includes("mushroom") ||
          cacImg.some((s) => s.includes("mushroom")) ||
          (rootEl.className && String(rootEl.className).toLowerCase().includes("mushroom"));

        if (coNam) {
          daThem.add(target);
          danhSach.push(target);
        }
      }

      // 2. Quét các placement trên map (fallback)
      const cacO = doc.querySelectorAll('[data-map-placement]');
      for (const el of cacO) {
        if (daThem.has(el) || !xemPhanTuRanh(el)) continue;
        const cacImg = Array.from(el.querySelectorAll("img")).map((i) => (i.src || "").toLowerCase());
        const bgImg = layBackgroundImage(el);
        const coNam =
          cacImg.some((s) => s.includes("mushroom")) ||
          bgImg.includes("wild_mushroom") ||
          bgImg.includes("magic_mushroom") ||
          bgImg.includes("mushroom");
        if (coNam) {
          daThem.add(el);
          danhSach.push(el);
        }
      }
    }
    return danhSach;
  }

  async function tickThuHoachNam() {
    if (dangBan) return false;
    dangBan = true;

    try {
      let state = null;
      if (typeof S.requestBridgeState === "function") {
        state = await S.requestBridgeState(1500);
      }

      const mushroomsBridge = state?.resources?.mushrooms?.total || 0;
      const cacNam = timNamDOM();

      if (cacNam.length === 0 && mushroomsBridge === 0) {
        return false;
      }

      console.log(`%c[SFL Nấm] 🍄 Phát hiện ${cacNam.length || mushroomsBridge} nấm rừng. Tiến hành thu hoạch...`, "color: #9c27b0; font-weight: bold;");

      let daThu = 0;
      for (const rootEl of cacNam) {
        if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) break;
        if (typeof S.isGoblinSwarm === "function" && S.isGoblinSwarm()) break;
        if (!xemPhanTuRanh(rootEl)) continue;

        const nutClick = rootEl.querySelector(".cursor-pointer, [class*='cursor-pointer']") || rootEl;
        clickTam(nutClick);
        daThu++;
        console.log(`[SFL Nấm] 🍄 [${daThu}/${cacNam.length}] Đã thu hoạch 1 cây nấm`);
        await ngu(450 + Math.floor(Math.random() * 200));
      }

      return daThu > 0;
    } catch (err) {
      console.error("[SFL Nấm] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
    }
  }

  S.tickThuHoachNam = tickThuHoachNam;

})(window.SFL = window.SFL || {});
