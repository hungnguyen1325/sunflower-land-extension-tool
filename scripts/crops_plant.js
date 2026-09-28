// ═══════════════════════════════════════════════════════════════════
// LUỒNG TRỒNG HẠT GIỐNG CHUẨN THEO MÙA (crops_plant.js)
// Sử dụng toàn bộ logic gieo hạt theo mùa chuẩn mực từ bản v4
// 1. Quét danh sách các ô ruộng đất trống (bỏ qua luống hoa & vườn quả)
// 2. Mở giỏ đồ chọn hạt giống đúng mùa có sẵn trong kho
// 3. Lần lượt gieo vào các ô ruộng đất trống (tự động đổi loại hạt nếu hết)
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // BẢNG THỜI GIAN PHÁT TRIỂN CỦA CÂY TRỒNG (TÍNH BẰNG GIÂY) - SẮP XẾP TỪ NGẮN NGÀY ĐẾN DÀI NGÀY
  const CROP_GROWTH_SECONDS = {
    "Sunflower Seed": 60,            // 1 phút (ngắn nhất)
    "Potato Seed": 300,             // 5 phút
    "Rhubarb Seed": 600,            // 10 phút
    "Pumpkin Seed": 1800,           // 30 phút
    "Zucchini Seed": 1800,          // 30 phút
    "Carrot Seed": 3600,            // 1 giờ
    "Yam Seed": 3600,               // 1 giờ
    "Cabbage Seed": 7200,           // 2 giờ
    "Broccoli Seed": 7200,          // 2 giờ
    "Soybean Seed": 10800,          // 3 giờ
    "Beetroot Seed": 14400,         // 4 giờ
    "Pepper Seed": 14400,           // 4 giờ
    "Cauliflower Seed": 28800,      // 8 giờ
    "Parsnip Seed": 43200,          // 12 giờ
    "Eggplant Seed": 57600,         // 16 giờ
    "Corn Seed": 72000,             // 20 giờ
    "Onion Seed": 72000,            // 20 giờ
    "Radish Seed": 86400,           // 24 giờ
    "Wheat Seed": 86400,            // 24 giờ
    "Turnip Seed": 86400,           // 24 giờ
    "Kale Seed": 129600,            // 36 giờ
    "Artichoke Seed": 129600,       // 36 giờ
    "Barley Seed": 172800,          // 48 giờ (dài nhất)
  };

  // Danh sách hạt giống cho đất thường theo 4 Mùa - Ưu tiên tăng dần từ ngắn ngày đến dài ngày
  const SEASONAL_CROP_PLOT_SEEDS = {
    spring: ["Sunflower Seed", "Rhubarb Seed", "Carrot Seed", "Cabbage Seed", "Soybean Seed", "Corn Seed", "Wheat Seed", "Kale Seed", "Barley Seed"],
    summer: ["Sunflower Seed", "Potato Seed", "Zucchini Seed", "Pepper Seed", "Beetroot Seed", "Cauliflower Seed", "Eggplant Seed", "Radish Seed", "Wheat Seed"],
    autumn: ["Potato Seed", "Pumpkin Seed", "Carrot Seed", "Yam Seed", "Broccoli Seed", "Soybean Seed", "Wheat Seed", "Barley Seed", "Artichoke Seed"],
    winter: ["Sunflower Seed", "Potato Seed", "Cabbage Seed", "Beetroot Seed", "Cauliflower Seed", "Parsnip Seed", "Onion Seed", "Turnip Seed", "Wheat Seed", "Kale Seed"],
  };

  const CROP_SLUGS = {
    "Sunflower Seed": ["sunflower", "sunflower_seed"],
    "Potato Seed": ["potato", "potato_seed"],
    "Rhubarb Seed": ["rhubarb", "rhubarb_seed"],
    "Carrot Seed": ["carrot", "carrot_seed"],
    "Cabbage Seed": ["cabbage", "cabbage_seed"],
    "Soybean Seed": ["soybean", "soybean_seed"],
    "Pepper Seed": ["pepper", "pepper_seed"],
    "Corn Seed": ["corn", "corn_seed"],
    "Zucchini Seed": ["zucchini", "zucchini_seed"],
    "Pumpkin Seed": ["pumpkin", "pumpkin_seed"],
    "Broccoli Seed": ["broccoli", "broccoli_seed"],
    "Beetroot Seed": ["beetroot", "beetroot_seed"],
    "Yam Seed": ["yam", "yam_seed"],
    "Cauliflower Seed": ["cauliflower", "cauliflower_seed"],
    "Parsnip Seed": ["parsnip", "parsnip_seed"],
    "Wheat Seed": ["wheat", "wheat_seed"],
    "Kale Seed": ["kale", "kale_seed"],
    "Barley Seed": ["barley", "barley_seed"],
    "Artichoke Seed": ["artichoke", "artichoke_seed"],
  };

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

  function phanTichToaDo(styleStr) {
    if (!styleStr) return { x: 0, y: 0, key: "x_0_y_0" };
    const topMatch = styleStr.match(/top:\s*calc\(50%\s*([-+])\s*(\d+(\.\d+)?)px\)/i);
    const leftMatch = styleStr.match(/left:\s*calc\(50%\s*([-+])\s*(\d+(\.\d+)?)px\)/i);
    let y = topMatch ? (topMatch[1] === "-" ? -parseFloat(topMatch[2]) : parseFloat(topMatch[2])) : 0;
    let x = leftMatch ? (leftMatch[1] === "-" ? -parseFloat(leftMatch[2]) : parseFloat(leftMatch[2])) : 0;
    return { x, y, key: `x_${x}_y_${y}` };
  }

  function timIconHoDo() {
    const docs = layTaiLieuGame();
    for (const doc of docs) {
      if (!doc || !doc.body) continue;
      const imgs = doc.querySelectorAll("img");
      for (const img of imgs) {
        const u = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();
        if (u.includes("basket") || u.includes("inventory") || u.includes("chest.png")) {
          const btn = img.closest("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']") || img;
          if (xemPhanTuRanh(btn)) return btn;
        }
      }
    }
    return null;
  }

  function khoDoDangHienThi() {
    const docs = layTaiLieuGame();
    for (const doc of docs) {
      if (!doc || !doc.body) continue;
      const cacModal = doc.querySelectorAll('.scrollable, div[style*="dark_border.png"], [role="dialog"]');
      for (const m of cacModal) {
        if (!xemPhanTuRanh(m)) continue;
        const txt = (m.textContent || "").toLowerCase();
        if (txt.includes("basket") || txt.includes("chest") || txt.includes("inventory") || txt.includes("seeds")) {
          return true;
        }
      }
    }
    return false;
  }

  function laNutCloseChuan(el) {
    if (!el || !xemPhanTuRanh(el)) return false;
    const src = (el.src || el.getAttribute?.("src") || "").toLowerCase();
    const alt = (el.alt || el.getAttribute?.("alt") || "").toLowerCase();

    const pText = (el.parentElement?.textContent || el.closest?.("div, button, [role='button']")?.textContent || "").toLowerCase();
    if (pText.includes("vip") || src.includes("vip")) return false;
    if (el.closest?.('[class*="vip"], [id*="vip"], [data-name*="vip"]')) return false;

    // TUYỆT ĐỐI KHÔNG ĐƯỢC NHẬN NHẦM THÙNG COMPOST CLOSED HOẶC ĐỒ TRÊN ĐẢO!
    if (src.includes("compost") || src.includes("closed") || src.includes("building") || src.includes("island")) {
      return false;
    }
    const laAnhClose = src.includes("/ui/close") || src.includes("/icons/close") || src.includes("close.png") || src.includes("cancel.png") || alt === "close" || alt === "cancel";
    const laAriaClose = el.getAttribute?.("aria-label") === "close";
    const trongDialog = !!el.closest?.('[role="dialog"], [role="modal"], div[class*="modal"], .fixed.inset-0');
    return (laAnhClose || laAriaClose) && trongDialog;
  }

  async function dongHetPopup() {
    const docs = layTaiLieuGame();
    for (const doc of docs) {
      if (!doc || !doc.body) continue;
      const cacBtnClose = doc.querySelectorAll('img[src*="/ui/close"], img[src*="close.png"], img[src*="cancel.png"], button[aria-label="close"]');
      for (const img of cacBtnClose) {
        if (!laNutCloseChuan(img)) continue;
        const btn = img.closest("button, [role='button']") || img;
        clickTam(btn);
        await ngu(250);
        break;
      }
    }
    try {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
    } catch (_e) {}
    await ngu(200);
  }

  // Tìm slot hạt giống trong kho đồ
  function timSlotHatGiong(doc, seedName) {
    const slugs = CROP_SLUGS[seedName] || [seedName.toLowerCase().replace(/\s+/g, "_")];
    const imgs = doc.querySelectorAll("img");
    for (const img of imgs) {
      const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();
      const khop = slugs.some((s) => src.includes(s));
      if (khop) {
        const slot = img.closest(".cursor-pointer, button, [class*='cursor-pointer']") || img;
        if (xemPhanTuRanh(slot)) {
          return slot;
        }
      }
    }
    return null;
  }

  // Tìm và chọn hạt giống trên thanh Hotbar ngoài màn hình nếu có
  function chonHatTrenHotbar(tenHat) {
    const docs = layTaiLieuGame();
    const baseCrop = tenHat.toLowerCase().replace(/\s*seed\s*/i, "").trim();
    for (const doc of docs) {
      if (!doc || !doc.body) continue;
      const imgs = doc.querySelectorAll("img");
      for (const img of imgs) {
        if (!xemPhanTuRanh(img)) continue;
        if (img.closest('[role="dialog"], .scrollable, .overflow-y-auto')) continue;
        const src = (img.src || img.getAttribute("src") || "").toLowerCase();
        const alt = (img.alt || img.getAttribute("alt") || "").toLowerCase();
        const matchSeed =
          (src.includes(baseCrop) && src.includes("seed")) ||
          src.includes(`${baseCrop}_seed`) ||
          (alt.includes(baseCrop) && alt.includes("seed"));

        if (matchSeed) {
          const btn = img.closest("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']") || img;
          if (xemPhanTuRanh(btn)) {
            console.log(`%c[SFL Trồng Ruộng] 🌾 Chọn hạt ${tenHat} trực tiếp trên Hotbar!`, "color: #4caf50; font-weight: bold;");
            clickTam(btn);
            return true;
          }
        }
      }
    }
    return false;
  }

  // Chuẩn bị hạt giống: ƯU TIÊN 100% GAME BRIDGE & HOTBAR (KHÔNG MỞ KHO ĐỒ)
  async function chuanBiHatGiong(tenHatChon, soLuongHat) {
    console.log(`%c[SFL Trồng Ruộng] 🌱 Lấy hạt giống "${tenHatChon}" qua Game Bridge (không mở kho đồ)...`, "color: #00bcd4; font-weight: bold;");

    // 1. Thử chọn qua Game Bridge (gọi shortcutItem trong React Context)
    if (typeof S.selectItemBridge === "function") {
      const ok = await S.selectItemBridge(tenHatChon, 1500);
      if (ok) {
        console.log(`%c[SFL Trồng Ruộng] ✔️ Game Bridge đã chọn ${tenHatChon} thành công trên tay!`, "color: #4caf50; font-weight: bold;");
        return { tenHat: tenHatChon, soLuong: soLuongHat };
      }
    }

    // 2. Thử chọn trực tiếp trên Hotbar ngoài màn hình
    if (chonHatTrenHotbar(tenHatChon)) {
      await ngu(400);
      return { tenHat: tenHatChon, soLuong: soLuongHat };
    }

    // 3. Fallback: Nếu không có Game Bridge và không có trên Hotbar, mở Basket chọn nhanh và đóng ngay
    console.log(`[SFL Trồng Ruộng] 📦 Mở giỏ đồ chọn nhanh hạt ${tenHatChon}...`);
    let dangMo = khoDoDangHienThi();
    if (!dangMo) {
      const iconKho = timIconHoDo();
      if (!iconKho) return null;
      clickTam(iconKho);
      for (let i = 0; i < 8; i++) {
        await ngu(250);
        if (khoDoDangHienThi()) { dangMo = true; break; }
      }
    }

    if (!dangMo) return null;

    for (const doc of layTaiLieuGame()) {
      const cacTab = doc.querySelectorAll(".flex.items-center.cursor-pointer, button, [role='tab']");
      for (const tab of cacTab) {
        if (!xemPhanTuRanh(tab)) continue;
        const txt = (tab.textContent || "").trim();
        if (txt.includes("Basket") || !!tab.querySelector('img[src*="basket"]')) {
          clickTam(tab);
          await ngu(400);
          break;
        }
      }

      let slot = timSlotHatGiong(doc, tenHatChon);
      if (!slot) {
        // Thử click sub-tab "Seeds"
        const subTabs = doc.querySelectorAll(".flex.items-center.cursor-pointer, button, [role='tab']");
        for (const st of subTabs) {
          const stTxt = (st.textContent || "").trim();
          if (stTxt.includes("Seeds") || !!st.querySelector('img[src*="seeds"], img[src*="sunflower_seed"]')) {
            clickTam(st);
            await ngu(300);
            break;
          }
        }
        slot = timSlotHatGiong(doc, tenHatChon);
      }

      if (slot) {
        console.log(`%c[SFL Trồng Ruộng] 🌱 Đã click chọn ${tenHatChon} trong giỏ đồ!`, "color: #4caf50; font-weight: bold;");
        clickTam(slot);
        await ngu(400);
        await dongHetPopup();
        return { tenHat: tenHatChon, soLuong: soLuongHat };
      }
    }

    await dongHetPopup();
    // Vẫn trả về thông tin hạt nếu có số lượng > 0 trong kho để tiến hành click gieo hạt trên đảo
    return { tenHat: tenHatChon, soLuong: soLuongHat };
  }

  // Danh sách từ khóa cấm (tuyệt đối không click nhầm vào bè, NPC, công trình, hoa quả...)
  const TU_KHOA_CAM = [
    "raft", "boat", "prestige", "volcano_prestige_raft", "ferry", "ship", "sail",
    "npc", "bumpkin", "character", "portal", "travel", "island", "scene",
    "flower_bed", "/flowers/", "fruit_patch", "/fruit/", "composter",
    "tree", "rock", "beehive", "building", "workbench", "tent", "house",
    "blacksmith", "chicken", "barn", "hen_house", "pig", "cow", "sheep",
    "decorations", "land/"
  ];

  function laPhanTuBiCam(duongDanArr, noiDungStr) {
    const text = (noiDungStr || "").toLowerCase();
    for (const kw of TU_KHOA_CAM) {
      if (duongDanArr.some((s) => s.includes(kw))) return true;
    }
    return false;
  }

  // Quét danh sách các ô RUỘNG ĐẤT TRỐNG trên đảo để gieo hạt
  function timDanhSachRuongTrongCanGieo() {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    const daThem = new Set();

    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // 1. Quét trực tiếp từ tất cả các thẻ ảnh đất ruộng trên DOM (loại bỏ từ khóa volcano chung chung)
      const cacAnhDat = Array.from(doc.querySelectorAll("img[src*='soil'], img[src*='sand_dug'], img[src*='volcanosoil'], img[src*='volcano_soil']"));
      for (const img of cacAnhDat) {
        if (!xemPhanTuRanh(img)) continue;
        const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();

        // Bỏ qua nếu dính từ khóa cấm (bè, NPC, công trình...)
        if (TU_KHOA_CAM.some((kw) => src.includes(kw))) continue;

        // Bỏ qua đất khô / cằn (chưa có giếng nước)
        if (src.includes("soil_dry") || src.includes("soil_not_fertile") || src.includes("volcanosoildry")) continue;

        const placement = img.closest('[data-map-placement]') || img.closest('div.absolute[style*="calc(50%"]') || img.parentElement;
        if (!placement || daThem.has(placement)) continue;

        const cacAnhTrongO = Array.from(placement.querySelectorAll("img")).map((i) => (i.currentSrc || i.src || i.getAttribute("src") || "").toLowerCase());
        const noiDung = (placement.textContent || "").trim().toLowerCase();

        // Bỏ qua nếu container chứa từ khóa cấm
        if (laPhanTuBiCam(cacAnhTrongO, noiDung)) continue;

        // Đang có cây hoặc đếm giờ -> Bỏ qua
        const coDemGio = /\d+\s*(?:mins?|secs?|hours?|hrs?|m\b|s\b|h\b)|\d+:\d+/i.test(noiDung);
        const laCayDangLon = cacAnhTrongO.some((s) => s.includes("seedling") || s.includes("halfway") || s.includes("almost") || s.includes("growing") || (s.includes("sprout") && !s.includes("sprout_mix")));
        const anhCayChin = cacAnhTrongO.some((s) => (s.includes("/crops/") || s.includes("/volcano/crops/")) && (s.includes("plant") || s.includes("crop")) && !s.includes("soil") && !s.includes("seed") && !s.includes("fertiliser"));
        if (coDemGio || laCayDangLon || anhCayChin) continue;

        const nutClick = placement.querySelector(".cursor-pointer, [class*='cursor-pointer']") || img.parentElement || placement;
        const coords = phanTichToaDo(placement.getAttribute("style") || "");
        daThem.add(placement);
        danhSach.push({ el: nutClick, rootEl: placement, coords });
      }

      // 2. Quét bổ sung từ tất cả container trên bản đồ
      const cacO = Array.from(doc.querySelectorAll('[data-map-placement], div.absolute[style*="calc(50%"]'));
      for (const el of cacO) {
        if (!el || daThem.has(el) || !xemPhanTuRanh(el)) continue;

        const cacAnh = Array.from(el.querySelectorAll("img"));
        const duongDan = cacAnh.map((i) => (i.getAttribute("src") || i.src || "").toLowerCase());
        const noiDung = (el.textContent || "").trim().toLowerCase();

        // Bỏ qua nếu container chứa từ khóa cấm
        if (laPhanTuBiCam(duongDan, noiDung)) continue;

        // Phải là đất ruộng (soil, volcanosoil, sand_dug)
        const laRuong = duongDan.some((s) => s.includes("soil") || s.includes("sand_dug") || s.includes("volcanosoil") || s.includes("volcano_soil")) || (el.innerHTML || "").toLowerCase().includes("soil");
        if (!laRuong) continue;

        // Bỏ qua đất khô cằn / infertile (thiếu giếng nước)
        const laDatKho = duongDan.some((s) => s.includes("soil_dry") || s.includes("soil_not_fertile") || s.includes("volcanosoildry"));
        if (laDatKho) continue;

        // Đang có cây hoặc đếm giờ -> Bỏ qua
        const coDemGio = /\d+\s*(?:mins?|secs?|hours?|hrs?|m\b|s\b|h\b)|\d+:\d+/i.test(noiDung);
        const laCayDangLon = duongDan.some((s) => s.includes("seedling") || s.includes("halfway") || s.includes("almost") || s.includes("growing") || (s.includes("sprout") && !s.includes("sprout_mix")));
        const anhCayChin = duongDan.some((s) => (s.includes("/crops/") || s.includes("/volcano/crops/")) && (s.includes("plant") || s.includes("crop")) && !s.includes("soil") && !s.includes("seed") && !s.includes("fertiliser"));
        if (coDemGio || laCayDangLon || anhCayChin) continue;

        const nutClick = el.querySelector(".cursor-pointer, [class*='cursor-pointer']") || el;
        const coords = phanTichToaDo(el.getAttribute("style") || "");
        daThem.add(el);
        danhSach.push({ el: nutClick, rootEl: el, coords });
      }
    }
    return danhSach;
  }

  // Thực hiện quy trình gieo hạt
  async function tickCropPlant() {
    if (dangBan) return false;

    // 1. Khóa độc quyền toàn cục
    if (typeof S.xinKhoa === "function" && !S.xinKhoa("crops_plant")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("crops_plant")) {
        return false;
      }

      // 1. LUÔN LUÔN QUÉT LẠI BẢN ĐỒ & TÀI NGUYÊN MỚI NHẤT TRƯỚC KHI TRỒNG
      let state = null;
      if (typeof S.requestBridgeState === "function") {
        state = await S.requestBridgeState(2000);
      }
      if (!state) {
        state = S.gameState;
      }

      // Trích xuất danh sách đất ruộng từ dữ liệu Bridge State (CHỈ LẤY CÁC Ô ĐÃ ĐẶT TRÊN MAP)
      let cropList = [];
      if (Array.isArray(state?.resources?.crops?.list)) {
        cropList = state.resources.crops.list.filter(
          (p) => p && (p.x !== undefined || p.y !== undefined)
        );
      } else {
        const cropsState = state?.crops || {};
        cropList = Object.entries(cropsState)
          .filter(([id, p]) => (p?.x !== undefined || p?.coordinates?.x !== undefined) && !p?.removedAt)
          .map(([id, p]) => {
            const plantedAt = Number(p?.crop?.plantedAt ?? p?.plantedAt) || 0;
            const cropName = String(p?.crop?.name || p?.cropName || "").trim();
            const isEmpty = !cropName || plantedAt <= 0;
            return {
              id,
              isEmpty,
              cropName: cropName || "Empty",
              fertiliser: p?.fertiliser?.name || null,
            };
          });
      }

      const emptyPlots = cropList.filter((p) => p.isEmpty);
      const fertilisedEmptyPlots = cropList.filter((p) => p.isEmpty && p.fertiliser);

      console.group(
        `%c 🌾 2. TRẠNG THÁI BẢN ĐỒ & TÀI NGUYÊN (Map Resources) - LUỒNG TRỒNG RUỘNG `,
        "background: #e65100; color: #fff; font-weight: bold; padding: 3px 8px; border-radius: 3px;"
      );
      console.table([
        {
          "Khu vực": "🌱 Đất Ruộng (Crops)",
          "Tổng số ô ruộng (Trên Map)": cropList.length,
          "Ô Đất Trống (Cần Gieo)": emptyPlots.length,
          "Đã Rắc Phân Chưa Trồng": fertilisedEmptyPlots.length,
          "Đang Trồng": cropList.filter((p) => !p.isEmpty).length,
        },
      ]);
      console.groupEnd();

      // Kiểm tra sơ bộ số hạt giống trong kho
      let inv = state?.inventory || S.userData?.inventory || {};

      // ── 1. ƯU TIÊN 100% GAME BRIDGE: TỰ ĐỘNG GIEO TOÀN BỘ Ô TRỐNG (HẠT NGẮN NGÀY -> DÀI NGÀY) ──
      if (typeof S.bulkPlantBridge === "function") {
        console.log("%c[SFL Trồng Ruộng] 🌱 Kích hoạt Gieo Hạt Hàng Loạt qua Game Bridge (Ưu tiên ngắn ngày nhất)...", "color: #00bcd4; font-weight: bold;");
        const resBulk = await S.bulkPlantBridge("AUTO", 5000);
        if (resBulk && resBulk.ok && resBulk.count > 0) {
          console.log(`%c[SFL Trồng Ruộng] 🎉 ĐÃ GIEO HẠT THÀNH CÔNG cho ${resBulk.count} ô ruộng qua Game Bridge!`, "color: #00e676; font-weight: bold; font-size: 14px;");
          if (resBulk.planted && resBulk.planted.length > 0) {
            console.table(resBulk.planted.map((p) => ({ "Hạt Giống": p.seed, "Số Lượng Đã Gieo": `+${p.count}` })));
          }
          return true;
        }
      }

      // ── 2. FALLBACK DOM NẾU GAME BRIDGE CHƯA GIEO HOẶC CÒN Ô RUỘNG TRỐNG TRÊN MÀN HÌNH ──
      console.log("[SFL Trồng Ruộng] 🔍 Quét các ô ruộng trống trên màn hình (Fallback DOM)...");
      const danhSachRuong = timDanhSachRuongTrongCanGieo();
      if (danhSachRuong.length === 0 && emptyPlots.length === 0) {
        console.log("[SFL Trồng Ruộng] ℹ️ Không phát hiện ô ruộng đất trống nào cần gieo.");
        return false;
      }

      const season = ((typeof S.getCurrentSeason === "function" && S.getCurrentSeason()) || state?.user?.season || S.gameSeason || "spring").toLowerCase();
      const seedsCuaMua = SEASONAL_CROP_PLOT_SEEDS[season] || SEASONAL_CROP_PLOT_SEEDS.spring;
      inv = S.gameState?.inventory || state?.inventory || S.userData?.inventory || {};

      // ƯU TIÊN HẠT GIỐNG NGẮN NGÀY TRƯỚC RỒI ĐẾN DÀI NGÀY (CROP_GROWTH_SECONDS TĂNG DẦN)
      const danhSachHatKhaDung = [];
      for (const seedName of seedsCuaMua) {
        const sl = Number(inv[seedName] || 0);
        if (sl > 0) {
          danhSachHatKhaDung.push({
            name: seedName,
            amount: sl,
            seconds: CROP_GROWTH_SECONDS[seedName] || 999999,
          });
        }
      }

      // Sắp xếp hạt giống theo thời gian trồng ngắn ngày nhất đến dài ngày nhất
      danhSachHatKhaDung.sort((a, b) => a.seconds - b.seconds);

      let tenHatChon = danhSachHatKhaDung[0]?.name || null;
      let soLuongHat = danhSachHatKhaDung[0]?.amount || 0;

      // NẾU HẾT HẠT GIỐNG ĐÚNG MÙA -> BỎ QUA NGAY (TUYỆT ĐỐI KHÔNG CỐ LẤY HẠT TRÁI MÙA TRONG KHO)
      if (!tenHatChon || soLuongHat <= 0) {
        console.log(`%c[SFL Trồng Ruộng] ℹ️ Đã hết hạt giống đúng mùa (${season}) trong kho -> Bỏ qua gieo hạt (không dùng hạt trái mùa).`, "color: #9e9e9e;");
        return false;
      }

      let hatInfo = await chuanBiHatGiong(tenHatChon, soLuongHat);
      if (!hatInfo) {
        console.log(`%c[SFL Trồng Ruộng] ⚠️ Chưa cầm được hạt giống trên tay -> Hủy gieo hạt (tránh click khống).`, "color: #ff9800; font-weight: bold;");
        return false;
      }

      console.log(`%c[SFL Trồng Ruộng] 🌾 Bắt đầu gieo hạt "${hatInfo.tenHat}" (Ngắn ngày nhất) cho ${danhSachRuong.length} ô ruộng trống...`, "color: #4caf50; font-weight: bold; font-size: 13px;");

      let soHatConLai = hatInfo.soLuong;
      let daTrong = 0;

      for (let i = 0; i < danhSachRuong.length; i += 1) {
        if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
          console.log("%c[SFL Trồng Ruộng] 🚨 GẶP CAPTCHA! Tạm dừng để giải ngay...", "color: #ff3838; font-weight: bold; font-size: 13px;");
          S.__captchaInterrupted = true;
          if (typeof S.kiemTraVaGiaiCaptcha === "function") {
            await S.kiemTraVaGiaiCaptcha();
          }
          await ngu(800);
          if (!S.isCaptchaOpen || !S.isCaptchaOpen()) {
            S.__captchaInterrupted = false;
            console.log("%c[SFL Trồng Ruộng] 🔄 Đã giải xong Captcha! TIẾP TỤC gieo hạt...", "color: #4caf50; font-weight: bold;");
            i--;
            continue;
          }
          break;
        }

        if (soHatConLai <= 0) {
          console.log(`[SFL Trồng Ruộng] 🔄 Hết loại hạt hiện tại, tìm tiếp loại hạt ngắn ngày kế tiếp...`);
          let tenHatTiep = null;
          let soLuongTiep = 0;

          // Lọc các hạt giống đúng mùa khác còn trong kho và sắp xếp tiếp từ ngắn ngày đến dài ngày
          const tiepCandidates = [];
          for (const sName of seedsCuaMua) {
            if (sName !== hatInfo.tenHat && Number(inv[sName] || 0) > 0) {
              tiepCandidates.push({ name: sName, amount: Number(inv[sName]), seconds: CROP_GROWTH_SECONDS[sName] || 999999 });
            }
          }
          tiepCandidates.sort((a, b) => a.seconds - b.seconds);

          if (tiepCandidates.length > 0) {
            tenHatTiep = tiepCandidates[0].name;
            soLuongTiep = tiepCandidates[0].amount;
          }

          if (!tenHatTiep) {
            console.log(`[SFL Trồng Ruộng] ℹ️ Đã hết toàn bộ hạt giống đúng mùa (${season}) trong kho -> Dừng gieo hạt.`);
            break;
          }
          const hatMoi = await chuanBiHatGiong(tenHatTiep, soLuongTiep);
          if (!hatMoi) break;
          hatInfo = hatMoi;
          soHatConLai = hatInfo.soLuong;
        }

        const oRuong = danhSachRuong[i];
        clickTam(oRuong.el);
        if (oRuong.rootEl && oRuong.rootEl !== oRuong.el) {
          kichHoatReactProps(oRuong.rootEl);
        }
        soHatConLai -= 1;
        daTrong += 1;
        console.log(`[SFL Trồng Ruộng] 🌱 Gieo ${hatInfo.tenHat} vào ô ${daTrong}/${danhSachRuong.length} (${oRuong.coords.key})`);
        await ngu(300 + Math.floor(Math.random() * 150));
      }

      console.log(`%c[SFL Trồng Ruộng] ✔️ Đã gieo thành công ${daTrong}/${danhSachRuong.length} ô ruộng!`, "color: #00e676; font-weight: bold; font-size: 13px;");
      return daTrong > 0;
    } catch (err) {
      console.error("[SFL Trồng Ruộng] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("crops_plant");
      }
    }
  }

  S.tickCropPlant = tickCropPlant;

})(window.SFL = window.SFL || {});
