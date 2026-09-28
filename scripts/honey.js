// ═══════════════════════════════════════════════════════════════════
// LUỒNG THU HOẠCH MẬT ONG (honey.js)
// Kiểm tra chính xác 100% hũ mật ong đã đầy trước khi thu hoạch
// Tránh click khống hoặc mở modal báo mật chưa đầy
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
    const hasSize = rect.width > 0 && rect.height > 0;
    const hasChildSize = el.firstElementChild ? el.firstElementChild.getBoundingClientRect().width > 0 : false;
    const hasImgSize = el.querySelector("img") ? el.querySelector("img").getBoundingClientRect().width > 0 : false;
    if (!hasSize && !hasChildSize && !hasImgSize && el.offsetWidth <= 0 && el.offsetHeight <= 0) return false;
    const view = el.ownerDocument?.defaultView || window;
    let style;
    try { style = view.getComputedStyle(el); } catch (_e) { return false; }
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function kichHoatReactProps(el) {
    if (!el) return;
    for (const k in el) {
      if (k.startsWith("__reactProps$") || k.startsWith("__reactEventHandlers$") || k.startsWith("__reactFiber$")) {
        const p = el[k]?.memoizedProps || el[k];
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
    const cx = rect.left + (rect.width > 0 ? rect.width / 2 : 16);
    const cy = rect.top + (rect.height > 0 ? rect.height / 2 : 16);

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
      if (el.parentElement) kichHoatReactProps(el.parentElement);
      if (el.firstElementChild) kichHoatReactProps(el.firstElementChild);
    } catch (_e2) {}

    const placement = el.closest?.('[data-map-placement]') || el;
    if (placement && placement !== el) {
      try {
        try { placement.dispatchEvent(new PointerEvent("pointerdown", downOpts)); } catch (_p3) {}
        placement.dispatchEvent(new MouseEvent("click", baseOpts));
        kichHoatReactProps(placement);
      } catch (_e3) {}
    }

    setTimeout(() => {
      try {
        if (typeof el.blur === "function") el.blur();
        el.dispatchEvent(new MouseEvent("mouseout", upOpts));
        el.dispatchEvent(new MouseEvent("mouseleave", upOpts));
        if (placement && placement !== el) {
          if (typeof placement.blur === "function") placement.blur();
          placement.dispatchEvent(new MouseEvent("mouseout", upOpts));
          placement.dispatchEvent(new MouseEvent("mouseleave", upOpts));
        }
      } catch (_e6) {}
    }, 60);

    return true;
  }

  // Quét DOM tìm các tổ ong THỰC SỰ ĐÃ ĐẦY MẬT (Hiển thị biểu tượng Giọt Mật Honey Drop)
  function timToOngDayMatDOM() {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // 1. Quét tìm thẻ ảnh giọt mật Honey Drop (chỉ hiển thị khi hũ mật đã đầy 100%)
      const cacAnhHoneyDrop = Array.from(doc.querySelectorAll("img[src*='honey_drop'], img[alt*='Honey Drop']"));
      for (const img of cacAnhHoneyDrop) {
        if (!xemPhanTuRanh(img)) continue;
        const className = img.className || "";
        // Nếu có class scale-0 hoặc ẩn -> hũ mật CHƯA đầy
        if (className.includes("scale-0") && !className.includes("scale-100")) continue;

        const target = img.closest('[data-map-placement]') || img.closest('div.cursor-pointer') || img.parentElement;
        if (target && !danhSach.includes(target)) danhSach.push(target);
      }

      // 2. Quét từ container beehive có chứa giọt mật sẵn sàng
      const cacContainerBeehive = Array.from(doc.querySelectorAll('[data-map-placement], div.cursor-pointer'));
      for (const box of cacContainerBeehive) {
        if (danhSach.includes(box) || !xemPhanTuRanh(box)) continue;
        const imgBeehive = box.querySelector("img[src*='beehive'], img[alt*='Beehive']");
        if (!imgBeehive) continue;

        const imgDrop = box.querySelector("img[src*='honey_drop'], img[alt*='Honey Drop']");
        if (imgDrop && xemPhanTuRanh(imgDrop)) {
          const dropClass = imgDrop.className || "";
          if (dropClass.includes("honey-drop-ready") || (dropClass.includes("scale-100") && !dropClass.includes("scale-0"))) {
            danhSach.push(box);
          }
        }
      }
    }
    return danhSach;
  }

  async function tickHoney() {
    if (dangBan) return false;

    // Khóa độc quyền luồng mật ong
    if (typeof S.xinKhoa === "function" && !S.xinKhoa("honey")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("honey")) {
        return false;
      }

      // 1. Lấy dữ liệu Game State mới nhất từ Bridge
      let state = null;
      if (typeof S.requestBridgeState === "function") {
        state = await S.requestBridgeState(1500);
      }
      if (!state) state = S.gameState;

      const hivesBridge = state?.resources?.beehives?.list || [];
      const totalHives = state?.resources?.beehives?.total || hivesBridge.length;

      // Danh sách tổ ong ĐÃ ĐẦY 100% mật theo Game Bridge
      const hivesReadyBridge = hivesBridge.filter((h) => h.isReady);

      // In nhật ký tiến độ từng tổ ong
      if (hivesBridge.length > 0) {
        const hiveProgress = hivesBridge.map((h, i) => `Tổ #${i + 1}: ${h.percentage}% (${h.isReady ? "🎁 ĐẦY HŨ" : "⏳ Đang tạo"})`).join(" | ");
        console.log(`%c[SFL Mật Ong] 🐝 Trạng thái ${totalHives} tổ ong: ${hiveProgress}`, "color: #ffb300; font-weight: bold;");
      }

      // ── 1. ƯU TIÊN THU HOẠCH QUA GAME BRIDGE NẾU CÓ TỔ ĐẦY MẬT ──
      if (hivesReadyBridge.length > 0 && typeof S.harvestHoneyBridge === "function") {
        console.log(`%c[SFL Mật Ong] 🍯 Phát hiện ${hivesReadyBridge.length} tổ ong ĐÃ ĐẦY 100% mật! Thu hoạch qua Game Bridge...`, "color: #00e676; font-weight: bold;");
        const res = await S.harvestHoneyBridge(4000);
        if (res && res.ok && res.count > 0) {
          console.log(`%c[SFL Mật Ong] 🎉 ĐÃ THU HOẠCH THÀNH CÔNG ${res.count} hũ mật ong qua Game Bridge!`, "color: #00e676; font-weight: bold; font-size: 14px;");
          return true;
        }
      }

      // ── 2. FALLBACK DOM: CHỈ CLICK KHI XÁC ĐỊNH CHÍNH XÁC HŨ MẬT ĐÃ ĐẦY (Có giọt mật Honey Drop) ──
      const toOngDayMat = timToOngDayMatDOM();

      // NẾU KHÔNG CÓ TỔ NÀO ĐẦY MẬT -> BỎ QUA NGAY, TUYỆT ĐỐI KHÔNG CLICK VÀO TỔ CHƯA ĐẦY!
      if (toOngDayMat.length === 0 && hivesReadyBridge.length === 0) {
        if (totalHives > 0) {
          console.log(`%c[SFL Mật Ong] ℹ️ Chưa có tổ ong nào đầy 100% mật -> Bỏ qua thu hoạch (Tránh mở popup thông báo).`, "color: #9e9e9e;");
        }
        return false;
      }

      const danhSachCanThu = toOngDayMat.length > 0 ? toOngDayMat : [];
      if (danhSachCanThu.length === 0) {
        return false;
      }

      console.log(`%c[SFL Mật Ong] 🍯 Thu hoạch ${danhSachCanThu.length} tổ ong đã đầy mật trên màn hình...`, "color: #ffb300; font-weight: bold;");
      let daThu = 0;
      for (const to of danhSachCanThu) {
        clickTam(to);
        daThu++;
        await ngu(400 + Math.floor(Math.random() * 150));
      }

      return daThu > 0;
    } catch (err) {
      console.error("[SFL Mật Ong] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("honey");
      }
    }
  }

  S.tickHoney = tickHoney;

})(window.SFL = window.SFL || {});
