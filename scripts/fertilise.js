// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG RẮC PHÂN SPROUT MIX (fertilise.js)
// Luồng chuẩn mực từ bản v4:
// 1. Quét tìm các ô đất TRỐNG chưa có phân
// 2. Mở giỏ đồ chọn Sprout Mix rồi đóng giỏ đồ
// 3. Lần lượt rắc phân và ghi nhớ các ô đã rắc phân
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  S.cacODaRacPhan = S.cacODaRacPhan || new Set();

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

  function laCoIconPhanBon(el) {
    if (!el) return false;
    const cacIcon = el.querySelectorAll('.z-20 img, [class*="z-20"] img');
    for (const img of cacIcon) {
      if (!xemPhanTuRanh(img)) continue;
      const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();
      if (
        src.includes("sprout_mix") || src.includes("fertiliser") || src.includes("fertilizer") ||
        src.includes("rapid_root") || src.includes("powerup") || src.includes("level_up") ||
        src.includes("stopwatch")
      ) {
        return true;
      }
      const st = img.getAttribute("style") || "";
      const mW = st.match(/width:\s*([\d.]+)px/i);
      const w = mW ? parseFloat(mW[1]) : NaN;
      if (w > 0 && w <= 16.5) return true;
    }
    return false;
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
      el.dispatchEvent(new MouseEvent("mousedown", downOpts));
      el.dispatchEvent(new MouseEvent("mouseup", upOpts));
      el.dispatchEvent(new MouseEvent("click", baseOpts));
      try { el.click?.(); } catch (_e2) {}
      kichHoatReactProps(el);
      if (el.parentElement) kichHoatReactProps(el.parentElement);
    } catch (_e) {}

    const placement = el.closest?.('[data-map-placement]') || el;
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

  function laOBiAnhHuongThoiTiet(el) {
    if (!el) return false;
    const imgs = Array.from(el.querySelectorAll("img"));
    for (const img of imgs) {
      const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();
      if (
        src.includes("weather") || src.includes("disaster") ||
        src.includes("tornado") || src.includes("freeze") || src.includes("frozen") ||
        src.includes("ice") || src.includes("snow") || src.includes("tsunami") ||
        src.includes("lightning") || src.includes("storm") || src.includes("drought")
      ) {
        return true;
      }
    }
    const txt = (el.textContent || "").toLowerCase();
    if (txt.includes("frozen") || txt.includes("drought") || txt.includes("disaster")) {
      return true;
    }
    return false;
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

  function timSlotSproutMix(doc) {
    const imgs = doc.querySelectorAll("img");
    for (const img of imgs) {
      const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();
      if (src.includes("sprout_mix") || src.includes("fertiliser") || src.includes("fertilizer")) {
        const slot = img.closest(".cursor-pointer, button, [class*='cursor-pointer']") || img;
        if (xemPhanTuRanh(slot)) {
          return slot;
        }
      }
    }
    return null;
  }

  // Tìm và chọn Sprout Mix / Rapid Root trên thanh Hotbar nếu có
  function chonPhanTrenHotbar(tenPhan) {
    const docs = layTaiLieuGame();
    for (const doc of docs) {
      if (!doc || !doc.body) continue;
      const imgs = doc.querySelectorAll('img[src*="sprout_mix"], img[src*="rapid_root"], img[src*="fertiliser"]');
      for (const img of imgs) {
        if (!xemPhanTuRanh(img)) continue;
        // Bỏ qua nếu nằm trong modal
        if (img.closest('[role="dialog"], .scrollable, .overflow-y-auto')) continue;
        const btn = img.closest("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']") || img;
        if (xemPhanTuRanh(btn)) {
          console.log(`%c[SFL Bón Phân] 🌾 Chọn ${tenPhan} trực tiếp trên Hotbar!`, "color: #4caf50; font-weight: bold;");
          clickTam(btn);
          return true;
        }
      }
    }
    return false;
  }

  // Chuẩn bị phân bón: ƯU TIÊN 100% GAME BRIDGE & HOTBAR (KHÔNG CẦN MỞ KHO ĐỒ)
  async function chuanBiPhanBon(tenPhan, soLuongKhaDung) {
    console.log(`%c[SFL Bón Phân] 🧪 Lấy phân bón "${tenPhan}" qua Game Bridge (không mở kho đồ)...`, "color: #00bcd4; font-weight: bold;");

    // 1. Thử chọn qua Game Bridge (gọi shortcutItem trong React Context)
    if (typeof S.selectItemBridge === "function") {
      const ok = await S.selectItemBridge(tenPhan, 1500);
      if (ok) {
        console.log(`%c[SFL Bón Phân] ✔️ Game Bridge đã chọn ${tenPhan} thành công trên tay!`, "color: #4caf50; font-weight: bold;");
        return soLuongKhaDung;
      }
    }

    // 2. Thử chọn trực tiếp trên Hotbar ngoài màn hình
    if (chonPhanTrenHotbar(tenPhan)) {
      await ngu(400);
      return soLuongKhaDung;
    }

    // 3. Fallback: Nếu không có Game Bridge và không có trên Hotbar, mở Basket chọn nhanh và đóng ngay
    console.log("[SFL Bón Phân] 📦 Chưa cầm được phân bón -> Mở giỏ đồ chọn nhanh...");
    let dangMo = khoDoDangHienThi();
    if (!dangMo) {
      const iconKho = timIconHoDo();
      if (!iconKho) return 0;
      clickTam(iconKho);
      for (let i = 0; i < 8; i++) {
        await ngu(250);
        if (khoDoDangHienThi()) { dangMo = true; break; }
      }
    }

    if (!dangMo) return 0;

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

      let slot = timSlotSproutMix(doc);
      if (!slot) {
        // Thử click sub-tab "Fertiliser"
        const subTabs = doc.querySelectorAll(".flex.items-center.cursor-pointer, button, [role='tab']");
        for (const st of subTabs) {
          const stTxt = (st.textContent || "").trim();
          if (stTxt.includes("Fertiliser") || stTxt.includes("Fertilizer") || !!st.querySelector('img[src*="sprout_mix"], img[src*="fertiliser"]')) {
            clickTam(st);
            await ngu(300);
            break;
          }
        }
        slot = timSlotSproutMix(doc);
      }

      if (slot) {
        console.log(`%c[SFL Bón Phân] 🧪 Đã click chọn ${tenPhan} trong giỏ đồ!`, "color: #4caf50; font-weight: bold;");
        clickTam(slot);
        await ngu(400);
        await dongHetPopup();
        return soLuongKhaDung;
      }
    }

    await dongHetPopup();
    return 0; // KHÔNG CHỌN ĐƯỢC -> TRẢ VỀ 0, TUYỆT ĐỐI KHÔNG BÁO RẮC KHỐNG!
  }

  // Quét danh sách ô đất TRỐNG HOẶC CÂY ĐANG LỚN CHƯA CÓ PHÂN BÓN
  function timDanhSachODatChuaRacPhan() {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    const daThem = new Set();

    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // 1. Quét theo các thẻ ảnh đất ruộng trên DOM
      const cacAnhDat = Array.from(doc.querySelectorAll("img[src*='soil'], img[src*='sand_dug'], img[src*='volcanosoil'], img[src*='volcano_soil']"));
      for (const img of cacAnhDat) {
        if (!xemPhanTuRanh(img)) continue;
        const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();
        if (src.includes("flower_bed") || src.includes("/flowers/") || src.includes("fruit_patch") || src.includes("/fruit/") || src.includes("composter") || src.includes("tree") || src.includes("rock") || src.includes("beehive")) continue;

        const placement = img.closest('[data-map-placement]') || img.closest('div.absolute[style*="calc(50%"]') || img.parentElement;
        if (!placement || daThem.has(placement) || !xemPhanTuRanh(placement)) continue;

        const cacAnhTrongO = Array.from(placement.querySelectorAll("img")).map((i) => (i.currentSrc || i.src || i.getAttribute("src") || "").toLowerCase());
        if (cacAnhTrongO.some((s) => s.includes("flower_bed") || s.includes("/flowers/") || s.includes("fruit_patch") || s.includes("/fruit/") || s.includes("composter") || s.includes("beehive"))) continue;

        // BỎ QUA CÂY ĐÃ CHÍN (SẴN SÀNG THU HOẠCH - KHÔNG THỂ BÓN PHÂN)
        const anhCayChin = cacAnhTrongO.some((s) => (s.includes("/crops/") || s.includes("/volcano/crops/")) && (s.includes("plant") || s.includes("crop")) && !s.includes("soil") && !s.includes("seed") && !s.includes("seedling") && !s.includes("growing"));
        if (anhCayChin) continue;

        // BỎ QUA Ô ĐÃ CÓ PHÂN BÓN
        const coords = phanTichToaDo(placement.getAttribute("style") || "");
        const coBadgePhan = laCoIconPhanBon(placement);
        const daRacTrongBoNho = S.cacODaRacPhan instanceof Set && S.cacODaRacPhan.has(coords.key);
        if (coBadgePhan || daRacTrongBoNho) continue;

        const nutClick = placement.querySelector(".cursor-pointer, [class*='cursor-pointer']") || img.parentElement || placement;
        daThem.add(placement);
        danhSach.push({ el: nutClick, rootEl: placement, coords });
      }

      // 2. Quét bổ sung từ tất cả container trên bản đồ
      const cacO = Array.from(doc.querySelectorAll('[data-map-placement], div.absolute[style*="calc(50%"]'));
      for (const el of cacO) {
        if (!el || daThem.has(el) || !xemPhanTuRanh(el)) continue;

        const cacAnh = Array.from(el.querySelectorAll("img"));
        const duongDan = cacAnh.map((i) => (i.getAttribute("src") || i.src || "").toLowerCase());

        // Bỏ qua hoa, quả, composter, cây, đá
        if (duongDan.some((s) => s.includes("flower_bed") || s.includes("/flowers/") || s.includes("fruit_patch") || s.includes("/fruit/") || s.includes("composter") || s.includes("tree") || s.includes("rock") || s.includes("beehive"))) continue;

        // Phải là đất ruộng
        const laRuong = duongDan.some((s) => s.includes("soil") || s.includes("sand_dug") || s.includes("volcanosoil") || s.includes("volcano_soil") || s.includes("/crops/")) || (el.innerHTML || "").toLowerCase().includes("soil");
        if (!laRuong) continue;

        // BỎ QUA CÂY ĐÃ CHÍN (SẴN SÀNG THU HOẠCH - KHÔNG THỂ BÓN PHÂN)
        const anhCayChin = duongDan.some((s) => (s.includes("/crops/") || s.includes("/volcano/crops/")) && (s.includes("plant") || s.includes("crop")) && !s.includes("soil") && !s.includes("seed") && !s.includes("seedling") && !s.includes("growing"));
        if (anhCayChin) continue;

        // BỎ QUA Ô ĐÃ CÓ PHÂN BÓN
        const coords = phanTichToaDo(el.getAttribute("style") || "");
        const coBadgePhan = laCoIconPhanBon(el);
        const daRacTrongBoNho = S.cacODaRacPhan instanceof Set && S.cacODaRacPhan.has(coords.key);
        if (coBadgePhan || daRacTrongBoNho) continue;

        const nutClick = el.querySelector(".cursor-pointer, [class*='cursor-pointer']") || el;
        daThem.add(el);
        danhSach.push({ el: nutClick, rootEl: el, coords });
      }
    }
    return danhSach;
  }

  async function tickFertilise() {
    if (dangBan) return false;

    // 0. KIỂM TRA SỐ LƯỢNG PHÂN BÓN TRƯỚC TIÊN (CHỈ CHẠY KHI SỐ LƯỢNG > 0)
    let state = null;
    if (typeof S.requestBridgeState === "function") {
      try {
        state = await S.requestBridgeState(800);
      } catch (_e) {}
    }
    if (!state) state = S.gameState;
    const inv = state?.inventory || S.userData?.inventory || {};

    const sproutMixCount = Number(inv["Sprout Mix"] || 0);
    const rapidRootCount = Number(inv["Rapid Root"] || 0);
    const sproutSurpriseCount = Number(inv["Sproutroot Surprise"] || 0);
    const fertiliserCount = Number(inv["Fertiliser"] || 0);
    const totalPhan = sproutMixCount + rapidRootCount + sproutSurpriseCount + fertiliserCount;

    if (totalPhan <= 0) {
      // Số lượng phân <= 0 -> Thoát ngay lập tức, không xin khóa, không quét DOM, tránh hành động thừa
      return false;
    }

    // 1. Khóa độc quyền toàn cục
    if (typeof S.xinKhoa === "function" && !S.xinKhoa("fertilise")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("fertilise")) {
        return false;
      }

      // Chọn loại phân ưu tiên
      const tenPhan = sproutMixCount > 0 ? "Sprout Mix" : (rapidRootCount > 0 ? "Rapid Root" : (sproutSurpriseCount > 0 ? "Sproutroot Surprise" : "Fertiliser"));
      const soLuongPhanKhaDung = sproutMixCount > 0 ? sproutMixCount : (rapidRootCount > 0 ? rapidRootCount : (sproutSurpriseCount > 0 ? sproutSurpriseCount : fertiliserCount));

      // 3. ƯU TIÊN 1: RẮC PHÂN QUA GAME BRIDGE (ÁP DỤNG CẢ ĐẤT TRỐNG LẪN CÂY ĐANG LỚN CHƯA CÓ PHÂN)
      if (typeof S.bulkFertiliseBridge === "function") {
        console.log(`%c[SFL Bón Phân] 🧪 Rắc phân "${tenPhan}" hàng loạt qua Game Bridge cho các ô đất trống & cây đang lớn...`, "color: #00bcd4; font-weight: bold;");
        const resBulk = await S.bulkFertiliseBridge(tenPhan, 3000);
        if (resBulk && resBulk.ok && (resBulk.count > 0 || resBulk.applied > 0)) {
          console.log(`%c[SFL Bón Phân] 🎉 ĐÃ RẮC PHÂN THÀNH CÔNG cho ${resBulk.count || resBulk.applied} ô ruộng rỗng & cây đang lớn!`, "color: #00e676; font-weight: bold; font-size: 13px;");
          await ngu(400);
          return true;
        }
      }

      // 4. FALLBACK DOM: Quét các ô đất trống và cây đang lớn chưa có phân
      const danhSachO = timDanhSachODatChuaRacPhan();
      if (danhSachO.length === 0) {
        return false;
      }

      const soLuongPhan = await chuanBiPhanBon(tenPhan, soLuongPhanKhaDung);
      if (soLuongPhan <= 0) {
        console.log("%c[SFL Bón Phân] ⚠️ Chưa cầm được phân bón trên tay -> Hủy luồng rắc phân.", "color: #ff9800; font-weight: bold;");
        return false;
      }

      console.log(`%c[SFL Bón Phân] 🧪 Bắt đầu rắc phân "${tenPhan}" cho ${Math.min(danhSachO.length, soLuongPhan)} ô (đất trống + cây đang lớn)...`, "color: #00bcd4; font-weight: bold; font-size: 13px;");

      let daRac = 0;
      for (const o of danhSachO) {
        if (daRac >= soLuongPhan) break;

        if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
          console.log("%c[SFL Bón Phân] 🚨 GẶP CAPTCHA! Tạm dừng để giải ngay...", "color: #ff3838; font-weight: bold;");
          S.__captchaInterrupted = true;
          if (typeof S.kiemTraVaGiaiCaptcha === "function") {
            await S.kiemTraVaGiaiCaptcha();
          }
          await ngu(800);
          if (!S.isCaptchaOpen || !S.isCaptchaOpen()) {
            S.__captchaInterrupted = false;
            console.log("%c[SFL Bón Phân] 🔄 Đã giải xong Captcha! TIẾP TỤC rắc phân...", "color: #4caf50; font-weight: bold;");
            continue;
          }
          break;
        }

        clickTam(o.el);
        if (o.rootEl && o.rootEl !== o.el) {
          kichHoatReactProps(o.rootEl);
        }
        daRac++;
        S.cacODaRacPhan.add(o.coords.key);
        await ngu(250 + Math.floor(Math.random() * 100));
      }

      await dongHetPopup();
      await ngu(400);

      console.log(`%c[SFL Bón Phân] ✔️ Đã rắc phân thành công cho ${daRac} ô ruộng!`, "color: #00e676; font-weight: bold;");
      return daRac > 0;
    } catch (err) {
      console.error("[SFL Bón Phân] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("fertilise");
      }
    }
  }

  S.tickFertilise = tickFertilise;

})(window.SFL = window.SFL || {});
