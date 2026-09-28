// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG THU HOẠCH & Ủ PHÂN COMPOST (compost.js)
// Sử dụng toàn bộ logic chuẩn v4:
// 1. Quét các thùng ủ phân (Basic, Turbo, Premium) trên đảo
// 2. Bỏ qua thùng đang ủ (có progress bar / đếm giờ / cooldown ghi nhớ)
// 3. Mở modal: Thu hoạch phân chín (Collect) nếu có
// 4. Bắt đầu mẻ ủ mới (Compost) nếu đủ nguyên liệu và ghi nhớ cooldown
// 5. Đóng sạch sẽ modal sau khi xử lý xong (Không bao giờ spam)
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Bộ nhớ lưu thời gian ủ của từng loại thùng: { basic: timestamp, turbo: timestamp, premium: timestamp }
  const boNhoCompost = (S.boNhoCompost = S.boNhoCompost || {});

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

  function laNutThatSuKhaDung(btn) {
    if (!btn || !xemPhanTuRanh(btn)) return false;
    if (btn.disabled || btn.getAttribute("disabled") !== null) return false;
    const tokens = String(btn.className || "").split(/\s+/).filter(Boolean);
    if (tokens.includes("cursor-not-allowed") || tokens.includes("disabled") || btn.getAttribute("aria-disabled") === "true") {
      return false;
    }
    return true;
  }

  function laNutCloseChuan(el) {
    if (!el || !xemPhanTuRanh(el)) return false;
    const src = (el.src || el.getAttribute?.("src") || "").toLowerCase();
    const alt = (el.alt || el.getAttribute?.("alt") || "").toLowerCase();

    const pText = (el.parentElement?.textContent || el.closest?.("div, button, [role='button']")?.textContent || "").toLowerCase();
    if (pText.includes("vip") || src.includes("vip")) return false;
    if (el.closest?.('[class*="vip"], [id*="vip"], [data-name*="vip"]')) return false;

    // TUYỆT ĐỐI KHÔNG ĐƯỢC NHẬN NHẦM THÙNG COMPOST CLOSED TRÊN ĐẢO!
    if (src.includes("compost") || src.includes("closed") || src.includes("building") || src.includes("island")) {
      return false;
    }
    const laAnhClose = src.includes("/ui/close") || src.includes("/icons/close") || src.includes("close.png") || src.includes("cancel.png") || alt === "close" || alt === "cancel";
    const laAriaClose = el.getAttribute?.("aria-label") === "close";
    const trongDialog = !!el.closest?.('[role="dialog"], [role="modal"], div[class*="modal"], .fixed.inset-0');
    return (laAnhClose || laAriaClose) && trongDialog;
  }

  function coPopupDangMo() {
    for (const doc of layTaiLieuGame()) {
      if (!doc || !doc.body) continue;
      const dlgs = doc.querySelectorAll('[role="dialog"], div[class*="modal"]');
      for (const d of dlgs) { if (xemPhanTuRanh(d)) return true; }
    }
    return false;
  }

  async function dongHetPopup() {
    for (let vong = 0; vong < 3; vong += 1) {
      let daClick = false;
      for (const doc of layTaiLieuGame()) {
        if (!doc || !doc.body) continue;
        const cacAnhClose = doc.querySelectorAll('img[src*="/ui/close"], img[src*="close.png"], img[src*="cancel.png"], button[aria-label="close"]');
        for (const img of cacAnhClose) {
          if (!laNutCloseChuan(img)) continue;
          const nutDong = img.closest("button, [role='button']") || img;
          clickTam(nutDong);
          daClick = true;
          await ngu(300);
          break;
        }
      }
      if (!daClick) break;
      await ngu(250);
    }
    try {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
    } catch (_e) {}
    await ngu(250);
  }

  function timModalCompost() {
    for (const doc of layTaiLieuGame()) {
      if (!doc || !doc.body) continue;
      // Chỉ quét các dialog / modal thực sự
      const dialogs = doc.querySelectorAll('[role="dialog"], div[class*="modal"]');
      for (const dlg of dialogs) {
        if (!xemPhanTuRanh(dlg)) continue;
        const txt = (dlg.textContent || "").toLowerCase();

        // LOẠI TRỪ TUYỆT ĐỐI các modal không thuộc về Compost
        if (
          txt.includes("workbench") ||
          txt.includes("blacksmith") ||
          txt.includes("land tools") ||
          txt.includes("toolshed") ||
          txt.includes("betty") ||
          txt.includes("daily reward") ||
          txt.includes("daily streak") ||
          txt.includes("streak") ||
          txt.includes("deliveries")
        ) {
          continue;
        }

        // Bắt buộc phải có từ khóa đặc thù của thùng ủ phân
        const coDacTrungCompost =
          txt.includes("composter") ||
          txt.includes("compost bin") ||
          txt.includes("turbo composter") ||
          txt.includes("premium composter") ||
          !!dlg.querySelector('img[src*="compost_bin"], img[src*="composter"]');

        const coHanhDongCompost =
          txt.includes("produce") ||
          txt.includes("collect") ||
          txt.includes("compost") ||
          txt.includes("requirements");

        if (coDacTrungCompost && coHanhDongCompost) {
          return { dlg, doc };
        }
      }
    }
    return null;
  }

  // Kiểm tra xem thùng ủ phân có thanh tiến trình (Progress Bar / Đang bận) hay không
  function coThanhTienTrinh(el) {
    if (!el) return false;

    // 0. Quét ngay bên trong chính phần tử này nếu có
    if (typeof el.querySelector === "function") {
      if (el.querySelector('img[src*="empty_bar"], img[src*="progress"], img[src*="bar"], span.font-pixel, [class*="progress"]')) {
        return true;
      }
    }

    // 1. Quét ngược lên 6 cấp cha (parent elements) để tìm thanh tiến trình
    let cur = el.parentElement || el;
    for (let depth = 0; depth < 6 && cur; depth++) {
      // a. Ảnh thanh tiến trình (empty_bar, progress, bar, timer...)
      if (cur.querySelector('img[src*="empty_bar"], img[src*="progress"], img[src*="bar"]')) {
        return true;
      }
      // b. Thẻ div có fill màu tiến trình (style width + background-color)
      const styleDivs = cur.querySelectorAll('div[style*="width"], div[style*="background-color"]');
      for (const d of styleDivs) {
        const st = (d.getAttribute("style") || "").toLowerCase();
        if (st.includes("width") && (st.includes("%") || st.includes("px")) && (st.includes("background") || st.includes("rgb"))) {
          return true;
        }
      }
      // c. Text đếm giờ hoặc span font-pixel
      if (cur.querySelector("span.font-pixel")) {
        return true;
      }
      const txt = (cur.textContent || "").toLowerCase();
      if (/\d+:\d{2}/.test(txt) || /\d+\s*(?:mins?|secs?|hours?|hrs?|h\b|m\b)/i.test(txt)) {
        return true;
      }
      cur = cur.parentElement;
    }

    // 2. Quét toàn trang xem có empty_bar / progress nào nằm ngay trên vị trí tọa độ của composter không
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const doc = el.ownerDocument || document;
        const allBars = doc.querySelectorAll('img[src*="empty_bar"], img[src*="progress"]');
        for (const bar of allBars) {
          const bRect = bar.getBoundingClientRect();
          if (bRect.width > 0) {
            const dx = Math.abs((rect.left + rect.width / 2) - (bRect.left + bRect.width / 2));
            const dy = Math.abs((rect.top + rect.height / 2) - (bRect.top + bRect.height / 2));
            // Nằm cách composter dưới 120px -> Chính là thanh tiến trình của composter này!
            if (dx < 120 && dy < 120) {
              return true;
            }
          }
        }
      }
    } catch (_e) {}

    return false;
  }

  // Kiểm tra trực tiếp xem thùng ủ trên đảo có đang bận không
  function laThungCompostDangBan(img, root, placement) {
    if (!img) return false;
    const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();

    // 1. Ảnh nắp đóng kín (closed) hoặc đang ủ (composting) -> 100% ĐANG BẬN!
    if (src.includes("closed") || src.includes("composting")) {
      return true;
    }

    // 2. Quét tất cả container cha (root, placement, parent)
    const elementsToCheck = [root, placement, img.parentElement, img.closest("div.cursor-pointer"), img.closest('[data-map-placement]')].filter(Boolean);
    for (const el of elementsToCheck) {
      // Có thanh tiến trình empty_bar hoặc progress
      if (el.querySelector('img[src*="empty_bar"], img[src*="progress"]')) {
        return true;
      }
      // Có span.font-pixel (đếm giờ trên đảo Sunflower Land, ví dụ: 4h, 2h, 45m)
      const fontPixelSpan = el.querySelector("span.font-pixel");
      if (fontPixelSpan) {
        return true;
      }
      // Có text hiển thị thời gian còn lại
      const txt = (el.textContent || "").trim();
      if (/\b\d+\s*[hm]\b/i.test(txt) || /\d+:\d{2}/.test(txt)) {
        return true;
      }
      // Có html chứa thẻ progress hoặc ảnh closed
      const innerHtml = el.innerHTML || "";
      if (innerHtml.includes("empty_bar") || innerHtml.includes("font-pixel") || innerHtml.includes("closed") || innerHtml.includes("composting")) {
        return true;
      }
    }

    // 3. Fallback: Quét theo khoảng cách tọa độ
    if (coThanhTienTrinh(img) || coThanhTienTrinh(root)) {
      return true;
    }

    return false;
  }

  // Quét các thùng ủ phân trên đảo
  function timDanhSachThungCompost() {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    const daThem = new Set();
    const now = Date.now();

    // 0. Cập nhật cooldown từ Game Bridge nếu có
    const bridgeComposters = S.gameState?.composters;
    if (bridgeComposters && typeof bridgeComposters === "object") {
      for (const [k, v] of Object.entries(bridgeComposters)) {
        const keyLow = k.toLowerCase();
        let loai = "basic";
        if (keyLow.includes("premium")) loai = "premium";
        else if (keyLow.includes("turbo")) loai = "turbo";

        const readyAt = Number(v?.producing?.readyAt || v?.readyAt) || 0;
        if (readyAt > now) {
          boNhoCompost[loai] = readyAt;
        }
      }
    }

    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;
      const cacAnh = doc.querySelectorAll('img[src*="composter"], img[src*="compost_bin"]');

      for (const img of cacAnh) {
        if (!xemPhanTuRanh(img)) continue;
        const placement = img.closest('[data-map-placement]');
        const root = placement || img.closest("div.cursor-pointer, [class*='cursor-pointer']") || img.parentElement;
        if (!root || daThem.has(root) || !xemPhanTuRanh(root)) continue;

        const src = (img.currentSrc || img.src || img.getAttribute("src") || "").toLowerCase();
        let loai = "basic";
        if (src.includes("premium")) loai = "premium";
        else if (src.includes("turbo")) loai = "turbo";

        // 1. Nếu đang trong thời gian chờ cooldown ghi nhớ -> Bỏ qua ngay lập tức 100%
        if (boNhoCompost[loai] && now < boNhoCompost[loai]) {
          continue;
        }

        // 2. Phát hiện trạng thái bận / đang ủ trực tiếp trên DOM đảo:
        if (laThungCompostDangBan(img, root, placement)) {
          // Chỉ coi là chín nếu có ảnh _ready hoặc compost_ready rõ ràng
          const daChinPhan = !!(placement || root).querySelector('img[src*="_ready"], img[src*="compost_ready"]');
          if (!daChinPhan) {
            boNhoCompost[loai] = now + 30 * 60 * 1000;
            console.log(`%c[SFL Compost] 🛑 Thùng ${loai.toUpperCase()} ĐANG BẬN Ủ TRÊN ĐẢO (Ảnh closed / có empty_bar / hẹn giờ) -> BỎ QUA 100% KHÔNG MỞ!`, "color: #ff9800; font-weight: bold; font-size: 13px;");
            continue;
          }
        }

        daThem.add(root);
        const nutClick = root.querySelector(".cursor-pointer, [class*='cursor-pointer']") || root;
        danhSach.push({ el: nutClick, rootEl: root, loai });
      }
    }

    // Lọc trùng lặp tuyệt đối: Mỗi loại thùng (basic, turbo, premium) chỉ lấy DUY NHẤT 1 phần tử
    const loaiDaChon = new Set();
    const danhSachChuan = [];
    for (const item of danhSach) {
      if (!loaiDaChon.has(item.loai)) {
        loaiDaChon.add(item.loai);
        danhSachChuan.push(item);
      }
    }

    return danhSachChuan;
  }

  // Xử lý từng thùng ủ phân: Mở -> Collect -> Compost -> Đóng
  async function xuLyThungCompost(thung) {
    console.log(`[SFL Compost] 💩 Kiểm tra thùng ủ phân: ${thung.loai.toUpperCase()}...`);
    clickTam(thung.el);
    await ngu(1000);

    const modalInfo = timModalCompost();
    if (!modalInfo) {
      console.log(`[SFL Compost] ℹ️ Không mở modal (thùng ${thung.loai.toUpperCase()} có thể đang bận) → Đặt cooldown 10 phút.`);
      boNhoCompost[thung.loai] = Date.now() + 10 * 60 * 1000;
      S.__thoiGianNghiCompost = Date.now() + 10 * 60 * 1000;
      await dongHetPopup();
      return false;
    }

    const { dlg } = modalInfo;
    const now = Date.now();
    const modalTxt = (dlg.textContent || "").toLowerCase();

    // ── NHẬN DIỆN TRẠNG THÁI BẬN / ĐANG Ủ TRONG MODAL ──
    const coProgressBarTrongModal =
      !!dlg.querySelector('img[src*="empty_bar"], img[src*="progress"], img[src*="bar"]') ||
      !!dlg.querySelector('div[style*="background-color"][style*="width"]');
    const coDemGioModal = /\d+:\d{2}/.test(modalTxt) || /\d+\s*(?:hours?|hrs?|h\b|mins?|m\b)/i.test(modalTxt);
    const dangBanTrongModal =
      coProgressBarTrongModal ||
      coDemGioModal ||
      modalTxt.includes("composting") ||
      modalTxt.includes("in progress") ||
      modalTxt.includes("producing") ||
      modalTxt.includes("ready in") ||
      modalTxt.includes("collect in") ||
      modalTxt.includes("remaining") ||
      modalTxt.includes("speed up") ||
      modalTxt.includes("boost") ||
      modalTxt.includes("đang ủ") ||
      modalTxt.includes("đang hồi") ||
      modalTxt.includes("thời gian");

    // Nút Collect chỉ hợp lệ khi là Collect / Claim thuần túy (không chứa chữ số đếm giờ)
    const cacNutBanDau = Array.from(dlg.querySelectorAll("button, [role='button']"));
    const nutCollect = cacNutBanDau.find((b) => {
      if (!xemPhanTuRanh(b)) return false;
      const t = (b.textContent || "").trim().toLowerCase();
      if (t.includes("collect in") || t.includes("ready to collect in") || /\d/.test(t)) return false;
      return t === "collect" || t === "claim" || t === "thu hoạch";
    });

    // ── BƯỚC 0: NẾU MODAL ĐANG Ở TAB GUIDE -> CHUYỂN SANG TAB COMPOSTER ──
    const cacTab = dlg.querySelectorAll("button, [role='tab'], div.cursor-pointer");
    for (const t of cacTab) {
      const txt = (t.textContent || "").toLowerCase();
      if (txt.includes("composter") && !txt.includes("guide")) {
        clickTam(t);
        await ngu(400);
        break;
      }
    }

    // ── BƯỚC 1: NẾU THÙNG ĐANG BẬN VÀ KHÔNG CÓ NÚT THU HOẠCH HỢP LỆ ──
    if (dangBanTrongModal && (!nutCollect || !laNutThatSuKhaDung(nutCollect))) {
      let cdMs = 15 * 60 * 1000; // Mặc định 15 phút
      const matchHour = modalTxt.match(/(\d+)\s*(?:hours?|hrs?|h\b)/i);
      const matchMin = modalTxt.match(/(\d+)\s*(?:mins?|m\b)/i);
      if (matchHour || matchMin) {
        const hrs = matchHour ? parseInt(matchHour[1], 10) : 0;
        const mins = matchMin ? parseInt(matchMin[1], 10) : 0;
        cdMs = Math.max(5 * 60 * 1000, (hrs * 60 + mins) * 60 * 1000);
      }
      boNhoCompost[thung.loai] = now + cdMs;
      console.log(`%c[SFL Compost] 🛑 Thùng ${thung.loai.toUpperCase()} ĐANG BẬN (còn ${(cdMs / 60000).toFixed(0)} phút) -> Đóng modal!`, "color: #ff9800; font-weight: bold; font-size: 13px;");
      await dongHetPopup();
      await ngu(300);
      return true;
    }

    // ── BƯỚC 2: THU HOẠCH PHÂN CHÍN (Collect) NẾU CÓ ──
    if (nutCollect && laNutThatSuKhaDung(nutCollect)) {
      console.log(`%c[SFL Compost] 🎁 [Bước 1] Thu hoạch phân chín từ thùng ${thung.loai.toUpperCase()}!`, "color: #4caf50; font-weight: bold;");
      clickTam(nutCollect);
      await ngu(1200);
      delete boNhoCompost[thung.loai];
    }

    // ── BƯỚC 3: KHỞI ĐỘNG MẺ Ủ MỚI (Compost) NẾU RẢNH ──
    let modalHienTai = timModalCompost();
    if (modalHienTai) {
      const dlgCompost = modalHienTai.dlg;
      const cacNutMoi = Array.from(dlgCompost.querySelectorAll("button, [role='button']"));
      const nutCompost = cacNutMoi.find((b) => {
        if (!xemPhanTuRanh(b)) return false;
        const t = (b.textContent || "").trim().toLowerCase();
        if (t.includes("composting") || t.includes("in progress") || /\d/.test(t)) return false;
        return t === "compost" || t === "ủ phân";
      });

      if (nutCompost) {
        if (laNutThatSuKhaDung(nutCompost)) {
          console.log(`%c[SFL Compost] 🚀 [Bước 2] Khởi động mẻ ủ phân mới (${thung.loai.toUpperCase()})!`, "color: #2196f3; font-weight: bold;");
          clickTam(nutCompost);
          await ngu(1200);
          const thoiGianU = thung.loai === "premium" ? 24 * 3600000 : (thung.loai === "turbo" ? 8 * 3600000 : 6 * 3600000);
          boNhoCompost[thung.loai] = now + thoiGianU;
        } else {
          console.log(`[SFL Compost] ⚠️ Thùng ${thung.loai.toUpperCase()} chưa đủ nguyên liệu ủ mẻ mới mùa này.`);
          boNhoCompost[thung.loai] = now + 15 * 60 * 1000;
        }
      } else {
        boNhoCompost[thung.loai] = now + 15 * 60 * 1000;
      }
    }

    // ── BƯỚC 4: ĐÓNG HOÀN TOÀN MODAL COMPOST ──
    await dongHetPopup();
    await ngu(300);
    return true;
  }

  async function tickCompost() {
    if (dangBan) return false;

    const now = Date.now();
    if (S.__thoiGianNghiCompost && now < S.__thoiGianNghiCompost) {
      return false;
    }

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("compost")) {
      return false;
    }

    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("compost")) {
        return false;
      }

      // 1. Cập nhật state mới nhất từ Game Bridge
      let state = S.gameState;
      if (typeof S.requestBridgeState === "function") {
        try {
          state = await S.requestBridgeState(1200);
        } catch (_e) {}
      }

      // 2. ƯU TIÊN XỬ LÝ QUA GAME BRIDGE (SIÊU TỐC, CHÍNH XÁC 100%)
      const bridgeComposters = state?.composters;
      if (Array.isArray(bridgeComposters) && bridgeComposters.length > 0) {
        console.log(`%c[SFL Compost] 🔍 Game Bridge ghi nhận ${bridgeComposters.length} thùng ủ phân...`, "color: #00bcd4; font-weight: bold;");
        let daThaoTacBridge = false;

        for (const c of bridgeComposters) {
          // A. Thu hoạch phân chín (isReady)
          if (c.isReady) {
            console.log(`%c[SFL Compost] 🎁 Thùng "${c.name}" ĐÃ CHÍN PHÂN! Thu hoạch ngay...`, "color: #4caf50; font-weight: bold;");
            if (typeof S.collectCompostBridge === "function") {
              const resCollect = await S.collectCompostBridge(c.name, c.id, 2500);
              if (resCollect && resCollect.ok) {
                console.log(`%c[SFL Compost] 🎉 Thu hoạch thành công phân từ "${c.name}"!`, "color: #00e676; font-weight: bold;");
                delete boNhoCompost[c.name.toLowerCase()];
                daThaoTacBridge = true;
                await ngu(800);
                c.isIdle = true; // Sau khi thu hoạch chuyển sang rảnh
              }
            }
          }

          // B. Khởi động mẻ ủ mới (isIdle) nếu đủ nguyên liệu mùa vụ
          if (c.isIdle) {
            if (c.hasRequirements) {
              console.log(`%c[SFL Compost] 🚀 Thùng "${c.name}" ĐANG RẢNH & ĐỦ NGUYÊN LIỆU! Bắt đầu ủ...`, "color: #2196f3; font-weight: bold;");
              if (typeof S.startComposterBridge === "function") {
                const resStart = await S.startComposterBridge(c.name, c.id, 2500);
                if (resStart && resStart.ok) {
                  console.log(`%c[SFL Compost] 🎉 Đã bắt đầu mẻ ủ mới cho "${c.name}"!`, "color: #00e676; font-weight: bold;");
                  daThaoTacBridge = true;
                  await ngu(800);
                }
              }
            } else {
              const reqText = Object.entries(c.requires || {}).map(([k, v]) => `${v} ${k}`).join(", ");
              console.log(`[SFL Compost] ℹ️ Thùng "${c.name}" đang rảnh nhưng thiếu nguyên liệu mùa vụ (${reqText || "chưa rõ"}).`);
            }
          } else if (c.isProducing) {
            const phutConLai = Math.max(0, Math.ceil((c.readyAt - Date.now()) / 60000));
            console.log(`[SFL Compost] ⏳ Thùng "${c.name}" đang ủ (còn ~${phutConLai} phút).`);
          }
        }

        if (daThaoTacBridge) {
          S.__thoiGianNghiCompost = Date.now() + 3 * 60 * 1000;
          return true;
        }
      }

      // 3. FALLBACK DOM NẾU BRIDGE CHƯA KẾT NỐI
      const danhSach = timDanhSachThungCompost();
      if (danhSach.length === 0) {
        S.__thoiGianNghiCompost = now + 10 * 60 * 1000;
        return false;
      }

      console.log(`%c[SFL Compost] 🖱️ Fallback click DOM kiểm tra thùng ủ phân...`, "color: #ff9800; font-weight: bold;");
      for (let i = 0; i < danhSach.length; i += 1) {
        if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
          S.__captchaInterrupted = true;
          break;
        }
        await xuLyThungCompost(danhSach[i]);
        break;
      }

      S.__thoiGianNghiCompost = Date.now() + 3 * 60 * 1000;
      return true;
    } catch (err) {
      console.error("[SFL Compost] Lỗi trong luồng ủ phân:", err);
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("compost");
      }
    }
  }

  S.tickCompost = tickCompost;

})(window.SFL = window.SFL || {});
