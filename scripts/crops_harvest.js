// ═══════════════════════════════════════════════════════════════════
// LUỒNG THU HOẠCH RUỘNG CÂY TRỒNG (crops_harvest.js)
// CHỈ THU HOẠCH các ô ruộng nông sản đã chín (Sunflower, Potato, Wheat...)
// Không trồng cây, không bón phân, không can thiệp các tài nguyên khác
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Lấy danh sách document của game (kể cả iframe)
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
      try {
        iframes = doc.querySelectorAll("iframe");
      } catch (_e) {
        continue;
      }
      for (let i = 0; i < iframes.length; i += 1) {
        try {
          const idoc = iframes[i].contentDocument;
          if (idoc) { them(idoc); nganXep.push(idoc); }
        } catch (_e2) {}
      }
    }
    return out;
  }

  // Kiểm tra phần tử đang hiển thị
  function xemPhanTuRanh(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const view = el.ownerDocument?.defaultView || window;
    let style;
    try {
      style = view.getComputedStyle(el);
    } catch (_e) {
      return false;
    }
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  // Kích hoạt trực tiếp handler React
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

  // Click chuẩn xác vào tâm phần tử
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
      pageX: cx + (view.scrollX || 0),
      pageY: cy + (view.scrollY || 0),
      which: 1,
      button: 0,
    };
    const downOpts = { ...baseOpts, buttons: 1 };
    const upOpts = { ...baseOpts, buttons: 0 };

    try { el.focus?.({ preventScroll: true }); } catch (_e) {}

    // Pointer & Mouse Down
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

    // Pointer & Mouse Up
    try {
      if (typeof PointerEvent !== "undefined") {
        el.dispatchEvent(new PointerEvent("pointerup", { ...upOpts, pointerId: 1, pointerType: "mouse", isPrimary: true, pressure: 0 }));
      }
    } catch (_e3) {}
    el.dispatchEvent(new MouseEvent("mouseup", upOpts));
    el.dispatchEvent(new MouseEvent("click", upOpts));

    try { el.click?.(); } catch (_e4) {}

    // Kích hoạt React Fiber handler
    kichHoatReactProps(el);
    if (el.parentElement) kichHoatReactProps(el.parentElement);

    // Gửi sự kiện cho placement cha nếu có
    const placement = el.closest?.('[data-map-placement]');
    if (placement && placement !== el) {
      try { placement.dispatchEvent(new MouseEvent("click", upOpts)); } catch (_e5) {}
      kichHoatReactProps(placement);
    }

    // Nhả chuột
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

  // Tìm danh sách các ô ruộng cây trồng đã chín trên giao diện (DOM)
  function timDanhSachCayChinDOM() {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    const daThem = new Set();

    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // 1. Quét qua các ảnh nông sản đã chín (plant.png, crop.png, /crops/)
      const cacAnhPlant = doc.querySelectorAll("img[src*='plant.png'], img[src*='plant.webp'], img[src*='/crops/'], img[src*='/volcano/crops/']");
      for (const img of cacAnhPlant) {
        if (!xemPhanTuRanh(img)) continue;
        const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();

        // Kiểm tra đúng là ảnh cây chín, loại trừ đất trống, hạt giống, mầm cây chưa chín, phân bón
        const laPlantChin = (src.includes("/crops/") || src.includes("/volcano/crops/")) &&
                            (src.includes("plant") || src.includes("crop")) &&
                            !src.includes("soil") && !src.includes("seed") &&
                            !src.includes("sprout_mix") && !src.includes("fertiliser") && !src.includes("rapid_root") &&
                            !src.includes("seedling") && !src.includes("halfway") && !src.includes("almost");
        if (!laPlantChin) continue;

        const placement = img.closest('[data-map-placement]') || img.closest('div.cursor-pointer, [class*="cursor-pointer"]') || img.parentElement;
        if (!placement || daThem.has(placement) || !xemPhanTuRanh(placement)) continue;

        const textToanBo = (placement.textContent || "").toLowerCase();
        const cacSrcTrongO = Array.from(placement.querySelectorAll("img")).map((i) => (i.src || "").toLowerCase());
        const laCompost = cacSrcTrongO.some((s) => s.includes("compost") || s.includes("turbo") || s.includes("premium"));
        const laVatPhamCam = cacSrcTrongO.some((s) => s.includes("raft") || s.includes("boat") || s.includes("prestige") || s.includes("npc") || s.includes("bumpkin") || s.includes("decorations") || s.includes("land/"));
        const coThanhTienTrinh = !!placement.querySelector("div[style*='background-color']");
        const coDemGio = /\d+\s*(?:mins?|secs?|hours?|hrs?|m\b|s\b|h\b)|\d+:\d+/i.test(textToanBo);

        if (laCompost || laVatPhamCam || coThanhTienTrinh || coDemGio) continue;

        daThem.add(placement);
        danhSach.push({
          element: img || placement,
          placement: placement,
          src: src,
        });
      }
    }

    return danhSach;
  }

  // ═══════ LUỒNG THU HOẠCH CHÍNH ═══════
  async function tickCropHarvest() {
    if (dangBan) return false;

    // Khóa độc quyền luồng thu hoạch
    if (typeof S.xinKhoa === "function" && !S.xinKhoa("crops_harvest")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("crops_harvest")) {
        return false;
      }

      // 1. Kiểm tra qua Game Bridge trước xem có ô nào chín không
      let state = null;
      if (typeof S.requestBridgeState === "function") {
        state = await S.requestBridgeState(1500);
      }

      const readyCropsBridge = state?.resources?.crops?.ready || 0;
      console.log(`%c[SFL Thu Hoạch] 🌾 Kiểm tra ruộng: ${readyCropsBridge} ô chín (theo Bridge)...`, "color: #ff9800; font-weight: bold;");

      // 2. Quét danh sách các ô cây chín trên màn hình
      const cacCayChin = timDanhSachCayChinDOM();

      if (cacCayChin.length === 0) {
        console.log("[SFL Thu Hoạch] ⏳ Không có ô ruộng nào đang chín cần thu hoạch.");
        return false;
      }

      console.log(`%c[SFL Thu Hoạch] 🚜 Phát hiện ${cacCayChin.length} ô ruộng đã chín sẵn sàng gặt!`, "color: #4caf50; font-weight: bold; font-size: 13px;");

      const daClickO = new WeakSet(); // Blacklist: các ô đã click trong vòng này

      let daThuHoach = 0;
      for (const item of cacCayChin) {
        // KIỂM TRA CAPTCHA TRƯỚC MỖI CÚ CLICK: NẾU XUẤT HIỆN LẬP TỨC DỪNG NGAY
        if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
          console.log("%c[SFL Thu Hoạch] 🚨 PHÁT HIỆN CAPTCHA! Lập tức dừng thu hoạch để giải ngay...", "color: #ff3838; font-weight: bold; font-size: 13px;");
          S.__captchaInterrupted = true;
          if (typeof S.kiemTraVaGiaiCaptcha === "function") {
            await S.kiemTraVaGiaiCaptcha();
          }
          await ngu(800);
          if (!S.isCaptchaOpen || !S.isCaptchaOpen()) {
            S.__captchaInterrupted = false;
            S.__captchaActive = false;
            if (typeof S.xinKhoa === "function") S.xinKhoa("crops_harvest");
            console.log("%c[SFL Thu Hoạch] 🔄 Đã giải xong Captcha! TIẾP TỤC thu hoạch các ô còn lại...", "color: #4caf50; font-weight: bold; font-size: 13px;");
            continue;
          }
          break;
        }

        const target = item.element || item.placement;
        if (!target || !xemPhanTuRanh(target)) continue;

        // Bỏ qua nếu ô này đã được click rồi (tránh double-click)
        if (daClickO.has(item.placement)) continue;

        // Xác nhận lại ô vẫn còn chín NGAY TRƯỚC KHI CLICK
        // (ô có thể đã được gặt bởi click trước đó nếu render nhanh)
        const srcHienTai = Array.from(item.placement.querySelectorAll("img"))
          .map(i => (i.getAttribute("src") || i.src || "").toLowerCase());
        const vanConChin = srcHienTai.some(s =>
          (s.includes("/crops/") || s.includes("/volcano/crops/")) &&
          (s.includes("plant") || s.includes("crop")) &&
          !s.includes("soil") && !s.includes("seed") &&
          !s.includes("halfway") && !s.includes("almost") && !s.includes("seedling")
        );
        if (!vanConChin) {
          console.log("[SFL Thu Hoạch] ℹ️ Ô đã được gặt rồi (DOM đã cập nhật) → bỏ qua.");
          continue;
        }

        // Đánh dấu ô đã click
        daClickO.add(item.placement);

        clickTam(target);
        daThuHoach += 1;
        console.log(`[SFL Thu Hoạch] ✂️ Thu hoạch ô ${daThuHoach}/${cacCayChin.length}`);

        // ── XÁC NHẬN DOM ĐÃ CẬP NHẬT (ô chuyển sang trống / không còn plant) ──
        // Đợi tối đa 1.5s để React re-render
        let daXacNhan = false;
        for (let check = 0; check < 5; check++) {
          await ngu(300);
          const srcSauGat = Array.from(item.placement.querySelectorAll("img"))
            .map(i => (i.getAttribute("src") || i.src || "").toLowerCase());
          const vanCoChinSauGat = srcSauGat.some(s =>
            (s.includes("/crops/") || s.includes("/volcano/crops/")) &&
            (s.includes("plant") || s.includes("crop")) &&
            !s.includes("soil") && !s.includes("seed") &&
            !s.includes("halfway") && !s.includes("almost") && !s.includes("seedling")
          );
          if (!vanCoChinSauGat || !xemPhanTuRanh(item.placement)) {
            daXacNhan = true;
            break;
          }
        }
        if (!daXacNhan) {
          console.log("[SFL Thu Hoạch] ⚠️ Ô ruộng chưa cập nhật sau 1.5s — click có thể thất bại.");
        }
      }

      console.log(`%c[SFL Thu Hoạch] ✔️ Hoàn tất thu hoạch ${daThuHoach} ô ruộng!`, "color: #00e676; font-weight: bold; font-size: 13px;");

      return daThuHoach > 0;
    } catch (err) {
      console.error("[SFL Thu Hoạch] Lỗi trong quá trình thu hoạch ruộng:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("crops_harvest");
      }
    }
  }

  // Xuất bản hàm ra namespace toàn cục
  S.tickCropHarvest = tickCropHarvest;

  // Lắng nghe phím tắt hoặc tự chạy khi cần
  window.addEventListener("keydown", (e) => {
    // Nhấn Alt + H để gặt ruộng ngay lập tức
    if (e.altKey && (e.key === "h" || e.key === "H")) {
      console.log("[SFL Phím Tắt] ⌨️ Kích hoạt Thu Hoạch Ruộng (Alt + H)...");
      tickCropHarvest();
    }
  });

})(window.SFL = window.SFL || {});
