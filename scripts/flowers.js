// ═══════════════════════════════════════════════════════════════════
// LUỒNG CHĂM SÓC & TRỒNG HOA TOÀN DIỆN (flowers.js)
// Thu hoạch hoa nở & Tự động gieo trồng hoa theo mùa vụ kèm thụ phấn chéo (Crossbreeding)
// TỰ ĐỘNG BỎ QUA NGAY KHI HẾT HẠT GIỐNG HOẶC NGUYÊN LIỆU THỤ PHẤN (KHÔNG SPAM CLICK)
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Danh mục hạt giống hoa theo mùa vụ
  const SEASONAL_FLOWER_SEEDS = {
    spring: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Lavender Seed"],
    summer: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Gladiolus Seed"],
    autumn: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Clover Seed"],
    winter: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Edelweiss Seed"],
  };

  // Danh mục nguyên liệu thụ phấn Set 1
  const SET_1_CROSSBREEDS = [
    { name: "Sunflower", amount: 50 },
    { name: "Beetroot", amount: 10 },
    { name: "Cauliflower", amount: 5 },
    { name: "Parsnip", amount: 5 },
    { name: "Eggplant", amount: 5 },
    { name: "Radish", amount: 5 },
    { name: "Kale", amount: 5 },
    { name: "Blueberry", amount: 3 },
    { name: "Apple", amount: 3 },
    { name: "Banana", amount: 3 },
    { name: "Red Pansy", amount: 1 }, { name: "Yellow Pansy", amount: 1 }, { name: "Purple Pansy", amount: 1 }, { name: "White Pansy", amount: 1 }, { name: "Blue Pansy", amount: 1 },
    { name: "Red Cosmos", amount: 1 }, { name: "Yellow Cosmos", amount: 1 }, { name: "Purple Cosmos", amount: 1 }, { name: "White Cosmos", amount: 1 }, { name: "Blue Cosmos", amount: 1 },
    { name: "Prism Petal", amount: 1 },
    { name: "Red Balloon Flower", amount: 1 }, { name: "Yellow Balloon Flower", amount: 1 }, { name: "Purple Balloon Flower", amount: 1 }, { name: "White Balloon Flower", amount: 1 }, { name: "Blue Balloon Flower", amount: 1 },
    { name: "Red Daffodil", amount: 1 }, { name: "Yellow Daffodil", amount: 1 }, { name: "Purple Daffodil", amount: 1 }, { name: "White Daffodil", amount: 1 }, { name: "Blue Daffodil", amount: 1 },
    { name: "Celestial Frostbloom", amount: 1 },
    { name: "Red Carnation", amount: 1 }, { name: "Yellow Carnation", amount: 1 }, { name: "Purple Carnation", amount: 1 }, { name: "White Carnation", amount: 1 }, { name: "Blue Carnation", amount: 1 },
    { name: "Red Lotus", amount: 1 }, { name: "Yellow Lotus", amount: 1 }, { name: "Purple Lotus", amount: 1 }, { name: "White Lotus", amount: 1 }, { name: "Blue Lotus", amount: 1 },
    { name: "Primula Enigma", amount: 1 }
  ];

  // Danh mục nguyên liệu thụ phấn Set 2
  const SET_2_CROSSBREEDS = [
    { name: "Rhubarb", amount: 25 },
    { name: "Pepper", amount: 15 },
    { name: "Onion", amount: 10 },
    { name: "Artichoke", amount: 8 },
    { name: "Barley", amount: 5 },
    { name: "Red Edelweiss", amount: 1 }, { name: "Yellow Edelweiss", amount: 1 }, { name: "Purple Edelweiss", amount: 1 }, { name: "White Edelweiss", amount: 1 }, { name: "Blue Edelweiss", amount: 1 },
    { name: "Red Gladiolus", amount: 1 }, { name: "Yellow Gladiolus", amount: 1 }, { name: "Purple Gladiolus", amount: 1 }, { name: "White Gladiolus", amount: 1 }, { name: "Blue Gladiolus", amount: 1 },
    { name: "Red Lavender", amount: 1 }, { name: "Yellow Lavender", amount: 1 }, { name: "Purple Lavender", amount: 1 }, { name: "White Lavender", amount: 1 }, { name: "Blue Lavender", amount: 1 },
    { name: "Red Clover", amount: 1 }, { name: "Yellow Clover", amount: 1 }, { name: "Purple Clover", amount: 1 }, { name: "White Clover", amount: 1 }, { name: "Blue Clover", amount: 1 }
  ];

  // Kiểm tra kho có đủ hạt giống hoa ĐÚNG MÙA VÀ nguyên liệu thụ phấn không
  function kiemTraDuDieuKienTrongHoa(state) {
    const inv = state?.inventory || S.userData?.inventory || {};
    const season = ((typeof S.getCurrentSeason === "function" && S.getCurrentSeason()) || "spring").toLowerCase();
    const validSeeds = SEASONAL_FLOWER_SEEDS[season] || SEASONAL_FLOWER_SEEDS.spring;

    // Phải có hạt giống hoa ĐÚNG MÙA
    const availableSeasonalSeeds = validSeeds.filter((s) => Number(inv[s] || 0) >= 1);
    if (availableSeasonalSeeds.length === 0) return false;

    // Kiểm tra có nguyên liệu thụ phấn chéo phù hợp với hạt giống hoa đúng mùa
    const hasSet1Seed = availableSeasonalSeeds.some((s) => ["Sunpetal Seed", "Bloom Seed", "Lily Seed"].includes(s));
    const hasSet2Seed = availableSeasonalSeeds.some((s) => ["Edelweiss Seed", "Gladiolus Seed", "Lavender Seed", "Clover Seed"].includes(s));

    const hasSet1Material = SET_1_CROSSBREEDS.some((cb) => Number(inv[cb.name] || 0) >= cb.amount);
    const hasSet2Material = SET_2_CROSSBREEDS.some((cb) => Number(inv[cb.name] || 0) >= cb.amount);

    return (hasSet1Seed && hasSet1Material) || (hasSet2Seed && hasSet2Material);
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
    }, 40);

    return true;
  }

  // Quét DOM tìm các luống hoa trên đảo
  function timLuongHoaDOM() {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;
      const cacAnhHoa = doc.querySelectorAll("img[src*='flower_bed'], img[src*='/flowers/']");
      for (const img of cacAnhHoa) {
        if (!xemPhanTuRanh(img)) continue;
        const target = img.closest('.cursor-pointer, [class*="cursor-pointer"], [data-map-placement]') || img;
        if (!danhSach.includes(target)) danhSach.push(target);
      }
    }
    return danhSach;
  }

  // ═══════ LUỒNG CHÍNH: THU HOẠCH & TRỒNG HOA ═══════
  async function tickFlowerAction() {
    if (dangBan) return false;

    // 0. Kiểm tra nhanh trạng thái State
    let state = S.gameState;
    if (typeof S.requestBridgeState === "function") {
      try {
        state = await S.requestBridgeState(800);
      } catch (_e) {}
    }
    if (!state) state = S.gameState;

    const rawBeds = state?.resources?.flowers?.list || [];
    const flowerBeds = rawBeds.filter((b) => b && (b.x !== undefined || b.y !== undefined));
    const readyBeds = flowerBeds.filter((b) => b.isReady);
    const emptyBeds = flowerBeds.filter((b) => !b.plantedAt || b.name === "Empty");
    const duDieuKienTrong = kiemTraDuDieuKienTrongHoa(state);

    // NẾU KHÔNG CÓ HOA CHÍN VÀ (KHÔNG CÓ Ô TRỐNG HOẶC KHÔNG ĐỦ HẠT GIỐNG/NGUYÊN LIỆU) -> BỎ QUA NGAY
    if (readyBeds.length === 0 && (emptyBeds.length === 0 || !duDieuKienTrong)) {
      if (emptyBeds.length > 0 && !duDieuKienTrong) {
        console.log(`%c[SFL Hoa] ℹ️ Có ${emptyBeds.length} luống hoa trống nhưng đã hết hạt giống hoa hoặc nguyên liệu thụ phấn -> Bỏ qua luồng hoa.`, "color: #9e9e9e;");
      }
      return false;
    }

    // 1. Khóa độc quyền luồng hoa
    if (typeof S.xinKhoa === "function" && !S.xinKhoa("flowers")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("flowers")) {
        return false;
      }

      let daLamBridge = false;

      // A. THU HOẠCH HOA NỞ (Ready Flowers)
      if (readyBeds.length > 0) {
        const tenHoa = readyBeds.map((b) => b.name).join(", ");
        console.log(`%c[SFL Hoa] 🌸 Tìm thấy ${readyBeds.length} luống hoa đã nở (${tenHoa})! Tiến hành thu hoạch qua Game Bridge...`, "color: #00bcd4; font-weight: bold;");

        if (typeof S.harvestFlowersBridge === "function") {
          const resH = await S.harvestFlowersBridge(readyBeds.map((b) => b.id), 2500);
          if (resH && resH.ok) {
            console.log(`%c[SFL Hoa] 🎉 Thu hoạch thành công ${resH.harvestedCount || readyBeds.length} luống hoa nở!`, "color: #00e676; font-weight: bold; font-size: 13px;");
            daLamBridge = true;
          }
        }
      }

      // B. GIEO TRỒNG HOA VÀO CÁC LUỐNG TRỐNG (Empty Flower Beds)
      if (emptyBeds.length > 0 && duDieuKienTrong) {
        console.log(`%c[SFL Hoa] 🌱 Tìm thấy ${emptyBeds.length} luống hoa trống trên đảo! Tiến hành gieo trồng & thụ phấn chéo qua Game Bridge...`, "color: #ff9800; font-weight: bold;");

        if (typeof S.plantFlowersBridge === "function") {
          const resP = await S.plantFlowersBridge(emptyBeds.map((b) => b.id), 2500);
          if (resP && resP.ok && resP.plantedCount > 0) {
            const details = (resP.plantedDetails || []).map((d) => `${d.seed} (+${d.amount} ${d.crossbreed})`).join(" | ");
            console.log(
              `%c[SFL Hoa] 🎉 ĐÃ GIEO TRỒNG THÀNH CÔNG ${resP.plantedCount} LUỐNG HOA MỚI! (${details})`,
              "color: #00e676; font-weight: bold; font-size: 13px;"
            );
            daLamBridge = true;
          } else {
            console.log(`[SFL Hoa] ℹ️ Đã hết hạt giống hoa hoặc nông sản thụ phấn chéo -> Dừng gieo hoa.`);
          }
        }
      }

      if (daLamBridge) return true;

      // NẾU ĐÃ HẾT HẠT HOẶC NGUYÊN LIỆU -> TUYỆT ĐỐI KHÔNG CLICK DOM BỪA BÃI
      if (!duDieuKienTrong && readyBeds.length === 0) {
        return false;
      }

      // 2. FALLBACK DOM NẾU CÓ HOA CHÍN CẦN THU HOẠCH MÀ BRIDGE CHƯA XỬ LÝ ĐƯỢC
      if (readyBeds.length > 0) {
        const luongs = timLuongHoaDOM();
        let daLam = 0;
        for (const l of luongs) {
          if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
            S.__captchaInterrupted = true;
            break;
          }
          clickTam(l);
          daLam++;
          await ngu(300 + Math.floor(Math.random() * 100));
        }
        return daLam > 0;
      }

      return false;
    } catch (err) {
      console.error("[SFL Hoa] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("flowers");
      }
    }
  }

  S.tickFlowerAction = tickFlowerAction;
  S.tickFlowers = tickFlowerAction;

})(window.SFL = window.SFL || {});
