// ═══════════════════════════════════════════════════════════════════
// LUỒNG CHẶT CÂY RỪNG LẤY GỖ (wood.js)
// Dựa vào Game Bridge để kiểm tra cây đã mọc lại & số lượng Rìu (Axe)
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

  // Tìm nút "Chop"/"Timber"/"Chặt" xác nhận trong modal (nếu có)
  function timNutChopXacNhan(doc) {
    if (!doc) return null;
    const cacNut = doc.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']");
    for (const btn of cacNut) {
      if (!xemPhanTuRanh(btn)) continue;
      const txt = (btn.textContent || "").trim().toLowerCase();
      if ((txt === "chop" || txt === "timber" || txt.includes("chặt")) && txt.length < 20) {
        return btn;
      }
    }
    return null;
  }

  // Kiểm tra popup báo thiếu rìu / cần chế tạo rìu
  function kiemTraThieuRiu(doc) {
    if (!doc) return false;
    const cacNhan = doc.querySelectorAll("span, p, div, h2, h3, button");
    for (const el of cacNhan) {
      if (!xemPhanTuRanh(el)) continue;
      const txt = (el.textContent || "").trim().toLowerCase();
      if (
        txt.includes("craft an axe") ||
        txt.includes("you need an axe") ||
        txt.includes("need an axe") ||
        txt.includes("không đủ rìu") ||
        txt.includes("craft 1 axe")
      ) {
        return true;
      }
    }
    return false;
  }

  // Đóng popup nếu xuất hiện
  async function dongPopupNeuCo() {
    const taiLieu = layTaiLieuGame();
    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;
      const imgClose = doc.querySelector('img[src*="close"], img[src*="cancel"]');
      if (imgClose && xemPhanTuRanh(imgClose)) {
        const nut = imgClose.closest("button, [role='button'], div.cursor-pointer") || imgClose;
        clickTam(nut);
        await ngu(300);
        return true;
      }
    }
    return false;
  }

  // Tìm các cây gỗ có thể chặt trên bản đồ (loại trừ gốc cây / cây đang mọc lại)
  function timCayGoDOM() {
    const taiLieu = layTaiLieuGame();
    const danhSach = [];
    const daThem = new Set();

    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;
      const cacO = doc.querySelectorAll('[data-map-placement]');
      for (const el of cacO) {
        if (daThem.has(el) || !xemPhanTuRanh(el)) continue;
        const cacAnh = Array.from(el.querySelectorAll("img"));
        const cacSrc = cacAnh.map((i) => (i.getAttribute("src") || i.src || "").toLowerCase());
        const noiDung = (el.textContent || "").trim().toLowerCase();

        // Cây rừng có thể là file .webp dưới đường dẫn resources/tree/ (theo mùa) hoặc bush_shrub
        const laCayRung = cacSrc.some(
          (s) =>
            s.includes("resources/tree") ||
            s.includes("/tree/") ||
            s.includes("tree.png") ||
            s.includes("_tree.webp") ||
            s.includes("autumn_tree") ||
            s.includes("spring_tree") ||
            s.includes("summer_tree") ||
            s.includes("winter_tree") ||
            s.includes("bush_shrub") ||
            s.includes("tree_stump")
        );
        if (!laCayRung) continue;

        // Bỏ qua nếu là GỐC cây (stump) hoặc đang tái sinh (countdown / opacity-50)
        const laStumpSrc = cacSrc.some((s) => s.includes("stump") || s.includes("tree_stump"));
        const coDemGio = /\d+\s*(?:mins?|secs?|hours?|hrs?|m\b|s\b|h\b)|\d+:\d+/i.test(noiDung);
        const coMoMo = cacAnh.some((i) => (i.className || "").includes("opacity-50"));
        const laGocCay = laStumpSrc || coDemGio || coMoMo;
        if (laGocCay) continue;

        const nutClick = el.querySelector(".cursor-pointer, [class*='cursor-pointer'], [class*='hover:img-highlight']") || el;
        daThem.add(el);
        danhSach.push({ el: nutClick, rootEl: el, doc });
      }
    }
    return danhSach;
  }

  async function tickWoodChop() {
    if (dangBan) return false;
    dangBan = true;

    try {
      let state = null;
      if (typeof S.requestBridgeState === "function") {
        state = await S.requestBridgeState(1500);
      }

      let axeCount = state?.inventory?.["Axe"] || 0;
      if (axeCount <= 0 && typeof S.craftToolBridge === "function") {
        console.log("[SFL Chặt Cây] 🪓 Hết Rìu -> Đang tự động mua thêm Rìu qua Game Bridge...");
        const buyRes = await S.craftToolBridge("Axe", 10);
        if (buyRes?.ok && buyRes.amount > 0) {
          axeCount = buyRes.amount;
          console.log(`%c[SFL Chặt Cây] ✔️ Đã mua thành công ${buyRes.amount} Rìu qua Game Bridge!`, "color: #4caf50; font-weight: bold;");
        }
      }
      if (axeCount <= 0) {
        console.log("[SFL Chặt Cây] ⚠️ Không có Rìu (Axe) trong kho đồ.");
        return false;
      }

      const treesReady = state?.resources?.trees?.ready || 0;
      const treesDOM = timCayGoDOM();

      if (treesDOM.length === 0 && treesReady === 0) {
        return false;
      }

      console.log(`%c[SFL Chặt Cây] 🪓 Có ${axeCount} Rìu | ${treesReady || treesDOM.length} cây gỗ sẵn sàng chặt.`, "color: #795548; font-weight: bold;");

      const daClick = new WeakSet(); // Blacklist: các cây đã click trong vòng này
      let daChat = 0;

      for (const cay of treesDOM) {
        // KIỂM TRA CAPTCHA TRƯỚC MỖI CÂY
        if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
          console.log("%c[SFL Chặt Cây] 🚨 GẶP CAPTCHA! Tạm dừng để giải ngay...", "color: #ff3838; font-weight: bold; font-size: 13px;");
          S.__captchaInterrupted = true;
          if (typeof S.kiemTraVaGiaiCaptcha === "function") {
            await S.kiemTraVaGiaiCaptcha();
          }
          await ngu(800);
          if (!S.isCaptchaOpen || !S.isCaptchaOpen()) {
            S.__captchaInterrupted = false;
            console.log("%c[SFL Chặt Cây] 🔄 Đã giải xong Captcha! TIẾP TỤC chặt cây...", "color: #4caf50; font-weight: bold;");
            continue;
          }
          break;
        }

        if (typeof S.isGoblinSwarm === "function" && S.isGoblinSwarm()) {
          console.log("[SFL Chặt Cây] 👺 Phát hiện Goblin Swarm → dừng chặt cây.");
          break;
        }

        if (daChat >= axeCount) break;

        // Bỏ qua nếu phần tử đã được click trong vòng này
        if (daClick.has(cay.rootEl)) continue;

        // Bỏ qua nếu phần tử đã không còn hiển thị (cây đã chặt, DOM đã cập nhật)
        if (!xemPhanTuRanh(cay.el)) continue;

        // Bỏ qua nếu cây đã chuyển thành stump (DOM cập nhật từ vòng trước)
        const cacSrcHienTai = Array.from(cay.rootEl.querySelectorAll("img"))
          .map(i => (i.getAttribute("src") || i.src || "").toLowerCase());
        const daThanhStump = cacSrcHienTai.some(s => s.includes("stump") || s.includes("tree_stump"));
        const dangDemGio = /\d+\s*(?:mins?|secs?|hours?|hrs?|m\b|s\b|h\b)|\d+:\d+/i.test((cay.rootEl.textContent || "").toLowerCase());
        if (daThanhStump || dangDemGio) {
          console.log("[SFL Chặt Cây] ℹ️ Bỏ qua cây đã chặt rồi (DOM đã cập nhật).");
          continue;
        }

        // Đánh dấu cây này đã click — tránh click lại
        daClick.add(cay.rootEl);

        // Click liên tiếp 3 lần để đốn ngã cây
        for (let hit = 0; hit < 3; hit++) {
          clickTam(cay.el);
          await ngu(150 + Math.floor(Math.random() * 60));
        }

        // Nếu có nút xác nhận Chop hiện lên → bấm
        const doc = cay.doc || cay.el.ownerDocument || document;
        const nutChop = timNutChopXacNhan(doc);
        if (nutChop) {
          clickTam(nutChop);
          await ngu(300);
        }

        // Game báo thiếu rìu → đóng popup và dừng chặt
        if (kiemTraThieuRiu(doc)) {
          console.log("[SFL Chặt Cây] ⚠️ Game hiện thông báo thiếu Rìu → đóng popup và dừng chặt cây");
          await dongPopupNeuCo();
          break;
        }

        daChat++;

        // ── XÁC NHẬN DOM ĐÃ CẬP NHẬT (cây biến mất / thành stump) ──
        // Đợi tối đa 1.5s để React re-render trước khi sang cây tiếp theo
        let daXacNhan = false;
        for (let check = 0; check < 6; check++) {
          await ngu(250);
          const srcSauChat = Array.from(cay.rootEl.querySelectorAll("img"))
            .map(i => (i.getAttribute("src") || i.src || "").toLowerCase());
          const daChuyenStump = srcSauChat.some(s => s.includes("stump") || s.includes("tree_stump"));
          const khongHienNua = !xemPhanTuRanh(cay.rootEl);
          if (daChuyenStump || khongHienNua) {
            daXacNhan = true;
            break;
          }
        }
        if (!daXacNhan) {
          console.log("[SFL Chặt Cây] ⚠️ Cây chưa cập nhật DOM sau 1.5s — có thể click thất bại hoặc mạng chậm.");
        }

        await ngu(200 + Math.floor(Math.random() * 100));
      }

      return daChat > 0;
    } catch (err) {
      console.error("[SFL Chặt Cây] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
    }
  }

  S.tickWoodChop = tickWoodChop;

})(window.SFL = window.SFL || {});
