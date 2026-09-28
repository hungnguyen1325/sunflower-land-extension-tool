// ═══════════════════════════════════════════════════════════════════
// LUỒNG 2 — CHECK-IN THUYỀN TỰ ĐỘNG (checkin.js)
// Dựa vào Game Bridge để kiểm tra trạng thái nhận thưởng hàng ngày
// Tự động kích hoạt khi vào game & Lên lịch chạy lại mỗi ngày lúc 7:00 SÁNG (00:00 UTC)
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
  let timer7hSang = null;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Lấy danh sách tài liệu DOM
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

  // Kiểm tra phần tử hiển thị
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

  // Kích hoạt handler React
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
    kichHoatReactProps(el);
    if (el.parentElement) kichHoatReactProps(el.parentElement);

    // Nhả chuột
    setTimeout(() => {
      try {
        if (typeof el.blur === "function") el.blur();
        el.dispatchEvent(new MouseEvent("mouseout", upOpts));
        el.dispatchEvent(new MouseEvent("mouseleave", upOpts));
      } catch (_e5) {}
    }, 40);

    return true;
  }

  // Đóng modal / popup nếu đang mở (loại trừ các thành phần VIP)
  async function dongModal(doc) {
    if (!doc || !doc.body) return;
    const cacAnhClose = doc.querySelectorAll('img[src*="close"], img[src*="cancel"]');
    for (const img of cacAnhClose) {
      if (xemPhanTuRanh(img)) {
        const pText = (img.parentElement?.textContent || img.closest("div, button")?.textContent || "").toLowerCase();
        if (pText.includes("vip") || (img.src || "").toLowerCase().includes("vip")) continue;
        const nut = img.closest("button, [role='button']") || img;
        clickTam(nut);
        await ngu(300);
        return;
      }
    }
    const cacNut = doc.querySelectorAll("button, [role='button']");
    for (const btn of cacNut) {
      if (!xemPhanTuRanh(btn)) continue;
      const txt = (btn.textContent || "").trim().toLowerCase();
      if (txt.includes("vip")) continue;
      if (txt === "close" || txt === "đóng" || txt === "ok" || txt === "x") {
        clickTam(btn);
        await ngu(300);
        return;
      }
    }
    try {
      const view = doc.defaultView || window;
      view.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
    } catch (_e) {}
  }

  // Tìm điểm vào Nhận Thưởng Hằng Ngày trên map (Rương Kho Báu / Thuyền Daily Reward)
  // ── 1. TÌM RƯƠNG DAILY REWARD (HOẶC HÒM THƯ) TRÊN BẢN ĐỒ ──
  function timRuongDailyReward() {
    const taiLieu = layTaiLieuGame();
    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // Ưu tiên 1: Rương kho báu chuẩn `#daily-reward`
      const ruong1 = doc.querySelector('#daily-reward');
      if (ruong1 && xemPhanTuRanh(ruong1)) {
        return { element: ruong1, doc: doc };
      }

      // Ưu tiên 2: Ảnh rương kho báu treasure_chest
      const cacAnhRuong = doc.querySelectorAll(
        "img[src*='treasure_chest'], img[src*='treasure-chest'], img[src*='daily_reward'], img[src*='streak_box']"
      );
      for (const img of cacAnhRuong) {
        if (xemPhanTuRanh(img)) {
          return { element: img, doc: doc };
        }
      }

      // Ưu tiên 3: Hòm thư LetterBox / Mailbox
      const mailbox = doc.querySelector('img[src*="mailbox"], img[src*="letterbox"], div[data-name="mailbox"]');
      if (mailbox && xemPhanTuRanh(mailbox)) {
        return { element: mailbox, doc: doc };
      }
    }
    return null;
  }

  // ── 2. TÌM THUYỀN RESTOCK (BỔ SUNG HÀNG HÓA HẰNG NGÀY) ──
  // LƯU Ý: trong bản build, ảnh thuyền bị inline base64 -> img[src*="boat"] không khớp.
  // Nhận diện qua dấu hiệu DOM: img trong [data-map-placement] có class cursor-pointer
  // + hover:img-highlight VÀ transform scaleX(-1) (thuyền restock bị lật ngang).
  function timThuyenRestock() {
    const taiLieu = layTaiLieuGame();
    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // Ưu tiên 1: Nhận diện bằng DOM signature (base64 inline)
      const cacMap = doc.querySelectorAll("[data-map-placement]");
      for (const mp of cacMap) {
        const imgs = mp.querySelectorAll("img");
        for (const img of imgs) {
          if (!xemPhanTuRanh(img)) continue;
          const cls = typeof img.className === "string" ? img.className : "";
          if (!cls.includes("cursor-pointer") || !cls.includes("img-highlight")) continue;
          const style = (img.getAttribute("style") || "").toLowerCase();
          if (style.includes("scalex(-1)")) {
            return { element: img, doc: doc };
          }
        }
      }

      // Ưu tiên 2: Ảnh thuyền restock_boat chuẩn của game (khi KHÔNG bundle base64)
      const restockBoat = doc.querySelector('img[src*="restock_boat"]');
      if (restockBoat && xemPhanTuRanh(restockBoat)) {
        return { element: restockBoat, doc: doc };
      }

      // Ưu tiên 3: Ảnh thuyền trên đảo (loại trừ thuyền travel, deliveries)
      const cacAnhThuyen = doc.querySelectorAll("img[src*='boat'], img[src*='ship']");
      for (const img of cacAnhThuyen) {
        if (!xemPhanTuRanh(img)) continue;
        const src = (img.getAttribute("src") || img.src || "").toLowerCase();
        if (
          src.includes("travel") ||
          src.includes("island") ||
          src.includes("deliveries") ||
          src.includes("delivery") ||
          src.includes("merchant") ||
          src.includes("market")
        ) {
          continue;
        }
        return { element: img, doc: doc };
      }
    }
    return null;
  }

  // Tính số mili-giây còn lại đến 7:00 SÁNG (Giờ reset game Sunflower Land - 00:00 UTC)
  function tinhThoiGianDen7hSang() {
    const now = new Date();
    const next7h = new Date();
    if (now.getHours() >= 7) {
      // Đã qua 7h sáng hôm nay -> hẹn 7h sáng ngày mai
      next7h.setDate(next7h.getDate() + 1);
    }
    next7h.setHours(7, 0, 5, 0); // 7:00:05 AM
    const msConLai = Math.max(5000, next7h.getTime() - now.getTime());
    return { msConLai, gioHen: next7h.toLocaleString() };
  }

  // Đặt lịch tự động chạy lại vào 7:00 sáng hôm sau
  function lenLich7hSang() {
    if (timer7hSang) clearTimeout(timer7hSang);

    const { msConLai, gioHen } = tinhThoiGianDen7hSang();
    console.log(
      `%c[SFL Check-in] ⏰ Đã đặt lịch Check-in tự động tiếp theo vào: ${gioHen} (sau ${(msConLai / (1000 * 60 * 60)).toFixed(1)} giờ)`,
      "color: #00bcd4; font-weight: bold;"
    );

    timer7hSang = setTimeout(async () => {
      console.log("%c[SFL Check-in] 🌅 ĐÃ ĐẾN 7:00 SÁNG (00:00 UTC)! Tự động thực hiện Check-in...", "color: #ff9800; font-weight: bold; font-size: 13px;");
      await tickCheckin();
      lenLich7hSang();
    }, msConLai);
  }

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

  // ═══════ [KIỂM TRA CHUẨN XÁC TRẠNG THÁI CHECK-IN HÔM NAY] ═══════
  function kiemTraRuongDaNhan(state) {
    // So sánh theo NGÀY (như isDailyRewardReady của game) — lần nhận hôm qua
    // (sau 00:00 UTC) không được tính là đã nhận hôm nay.
    const todayKey = new Date().toISOString().slice(0, 10);

    // 1. Kiểm tra State từ Game Bridge / S.gameState / S.userData
    const collectedAt = toSafeNumber(
      state?.user?.dailyRewards?.collectedAt ??
      state?.dailyRewards?.chest?.collectedAt ??
      state?.dailyRewards?.collectedAt ??
      S.userData?.user?.dailyRewards?.collectedAt ??
      S.userData?.dailyRewards?.chest?.collectedAt ??
      0
    );
    const collectedKey = collectedAt > 0 ? new Date(collectedAt).toISOString().slice(0, 10) : "";
    if (collectedKey === todayKey) {
      return { daNhan: true, lyDo: `Game State ghi nhận đã nhận lúc ${new Date(collectedAt).toLocaleTimeString("vi-VN")}` };
    }

    if (state?.user?.dailyRewards?.isCollectedToday === true || S.userData?.user?.dailyRewards?.isCollectedToday === true) {
      return { daNhan: true, lyDo: "Game Bridge báo isCollectedToday = true" };
    }

    // 2. Kiểm tra LocalStorage hôm nay
    if (localStorage.getItem("sfl_chest_collected_date") === todayKey) {
      return { daNhan: true, lyDo: `LocalStorage ghi nhận đã nhận hôm nay (${todayKey})` };
    }

    // 3. Kiểm tra DOM thực tế trên đảo:
    // Nếu rương có id="daily-reward" mang src "treasure_chest_opened" -> CHẮC CHẮN ĐÃ NHẬN RỒI!
    for (const doc of layTaiLieuGame()) {
      if (!doc || !doc.body) continue;
      const openedChest = doc.querySelector(
        '#daily-reward[src*="opened"], img[src*="treasure_chest_opened"], img[src*="treasure-chest-opened"]'
      );
      if (openedChest && xemPhanTuRanh(openedChest)) {
        localStorage.setItem("sfl_chest_collected_date", todayKey);
        return { daNhan: true, lyDo: "Ảnh rương trên bản đồ đã ở trạng thái MỞ (treasure_chest_opened)" };
      }
    }

    return { daNhan: false };
  }

  function kiemTraThuyenDaNhan(state) {
    // So sánh theo NGÀY (như canRestockShipment của game) — lần restock hôm qua
    // (sau 00:00 UTC) không được tính là đã restock hôm nay.
    const todayKey = new Date().toISOString().slice(0, 10);

    // 1. Kiểm tra State từ Game Bridge
    const restockedAt = toSafeNumber(
      state?.user?.shipments?.restockedAt ??
      state?.shipments?.restockedAt ??
      S.userData?.user?.shipments?.restockedAt ??
      S.userData?.shipments?.restockedAt ??
      0
    );
    const restockKey = restockedAt > 0 ? new Date(restockedAt).toISOString().slice(0, 10) : "";
    if (restockKey === todayKey) {
      return { daNhan: true, lyDo: `Game State ghi nhận thuyền đã nhận lúc ${new Date(restockedAt).toLocaleTimeString("vi-VN")}` };
    }

    if (state?.user?.shipments?.isRestockedToday === true || S.userData?.user?.shipments?.isRestockedToday === true) {
      return { daNhan: true, lyDo: "Game Bridge báo isRestockedToday = true" };
    }

    // 2. Kiểm tra LocalStorage hôm nay
    if (localStorage.getItem("sfl_shipment_restocked_date") === todayKey) {
      return { daNhan: true, lyDo: `LocalStorage ghi nhận thuyền đã nhận hôm nay (${todayKey})` };
    }

    return { daNhan: false };
  }

  // ═══════ [PHẦN 1] CHECK-IN RƯƠNG DAILY REWARD ═══════
  async function xuLyCheckinRuongDaily(force = false) {
    const todayKey = new Date().toISOString().slice(0, 10);

    let state = S.gameState || S.userData;
    if (!state && typeof S.requestBridgeState === "function") {
      state = await S.requestBridgeState(1500);
    }

    const check = kiemTraRuongDaNhan(state);
    if (!force && check.daNhan) {
      console.log(
        `%c[SFL Check-in] 🎁 [1/2 RƯƠNG DAILY] ✔️ ĐÃ NHẬN HÔM NAY RỒI (${check.lyDo}). Bỏ qua không click lại!`,
        "color: #4caf50; font-weight: bold;"
      );
      localStorage.setItem("sfl_chest_collected_date", todayKey);
      return true;
    }

    console.log(
      `%c[SFL Check-in] 🎁 [1/2 RƯƠNG DAILY] ${force ? "⚡ Ép buộc nhận quà" : "Tiến hành nhận quà"}...`,
      "color: #ff9800; font-weight: bold;"
    );

    // Cách 1: Ưu tiên Game Bridge
    if (typeof S.claimDailyRewardBridge === "function") {
      const resBridge = await S.claimDailyRewardBridge(2500);
      if (resBridge && (resBridge.ok || resBridge.alreadyClaimed)) {
        console.log("%c[SFL Check-in] 🎁 [1/2 RƯƠNG DAILY] 🎉 Nhận quà thành công qua Game Bridge!", "color: #00e676; font-weight: bold; font-size: 13px;");
        localStorage.setItem("sfl_chest_collected_date", todayKey);
        return true;
      }
    }

    // Cách 2: Fallback click DOM rương hoặc hòm thư
    const ruong = timRuongDailyReward();
    if (!ruong) {
      console.log("[SFL Check-in] 🎁 [1/2 RƯƠNG DAILY] ⚠️ Chưa tìm thấy vị trí Rương trên map.");
      return false;
    }

    console.log("[SFL Check-in] 🎁 [1/2 RƯƠNG DAILY] 🖱️ Click vào Rương để mở bảng nhận quà...");
    clickTam(ruong.element);
    await ngu(800);

    let daBamClaim = false;
    let docHienTai = null;
    let modalDaMo = false;

    for (let lan = 0; lan < 10; lan += 1) {
      await ngu(400);
      for (const doc of layTaiLieuGame()) {
        const dlg = doc.querySelector('[role="dialog"], .scrollable, div[class*="modal"]');
        if (dlg && xemPhanTuRanh(dlg)) {
          modalDaMo = true;
          const dlgText = (dlg.textContent || "").toLowerCase();

          // Nếu popup hiển thị đã nhận hoặc đếm ngược đến ngày mai:
          if (
            dlgText.includes("come back tomorrow") ||
            dlgText.includes("already claimed") ||
            dlgText.includes("đã nhận") ||
            dlgText.includes("next reward in")
          ) {
            console.log("%c[SFL Check-in] 🎁 [1/2 RƯƠNG DAILY] ✔️ Bảng quà thông báo đã nhận quà hôm nay rồi!", "color: #4caf50; font-weight: bold;");
            localStorage.setItem("sfl_chest_collected_date", todayKey);
            await dongModal(doc);
            return true;
          }
        }

        const cacNut = doc.querySelectorAll("button, [role='button']");
        for (const btn of cacNut) {
          if (!xemPhanTuRanh(btn) || btn.disabled) continue;
          const txt = (btn.textContent || "").trim().toLowerCase();
          if (txt === "claim" || txt.includes("claim") || txt.includes("nhận")) {
            console.log(`[SFL Check-in] 🎁 [1/2 RƯƠNG DAILY] Bấm nút: "${btn.textContent?.trim()}"`);
            clickTam(btn);
            daBamClaim = true;
            docHienTai = doc;
            break;
          }
        }
        if (daBamClaim) break;
      }
      if (daBamClaim) break;
    }

    if (daBamClaim && docHienTai) {
      await ngu(800);

      // Kiểm tra nếu sau khi check-in có bung Rương kho báu hoặc Captcha
      if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
        console.log("%c[SFL Check-in] 🎁 Phát hiện Rương kho báu sau khi check-in! Đang tự động mở...", "color: #00bcd4; font-weight: bold;");
        if (typeof S.kiemTraVaGiaiCaptcha === "function") {
          await S.kiemTraVaGiaiCaptcha();
        }
      }

      // Xác nhận nút Claim tiếp theo nếu có (ClaimReward popup)
      for (let lan2 = 0; lan2 < 5; lan2 += 1) {
        let daBamXacNhan = false;
        for (const d of layTaiLieuGame()) {
          const cacNut2 = d.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']");
          for (const btn of cacNut2) {
            if (!xemPhanTuRanh(btn) || btn.disabled) continue;
            const txt = (btn.textContent || "").trim().toLowerCase();
            if (
              txt === "claim" || txt.includes("claim") ||
              txt === "continue" || txt.includes("continue") ||
              txt === "sweet!" || txt.includes("sweet") ||
              txt === "awesome!" || txt.includes("awesome") ||
              txt === "woohoo!" || txt.includes("woohoo") ||
              txt === "nhận" || txt.includes("xác nhận") || txt === "ok"
            ) {
              clickTam(btn);
              daBamXacNhan = true;
              break;
            }
          }
          if (daBamXacNhan) break;
        }
        if (!daBamXacNhan) break;
        await ngu(500);
      }
      await dongModal(docHienTai);
      localStorage.setItem("sfl_chest_collected_date", todayKey);
      console.log("%c[SFL Check-in] 🎁 [1/2 RƯƠNG DAILY] 🎉 CHECK-IN RƯƠNG THÀNH CÔNG!", "color: #00e676; font-weight: bold;");
      return true;
    } else {
      for (const doc of layTaiLieuGame()) {
        await dongModal(doc);
      }
      if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
        if (typeof S.kiemTraVaGiaiCaptcha === "function") {
          await S.kiemTraVaGiaiCaptcha();
        }
      }
      if (modalDaMo) {
        localStorage.setItem("sfl_chest_collected_date", todayKey);
        return true;
      }
      return false;
    }
  }

  // ═══════ [PHẦN 2] CHECK-IN THUYỀN RESTOCK (SHIPMENT) ═══════
  async function xuLyCheckinThuyenRestock(force = false) {
    const todayKey = new Date().toISOString().slice(0, 10);

    let state = S.gameState || S.userData;
    if (!state && typeof S.requestBridgeState === "function") {
      state = await S.requestBridgeState(1500);
    }

    const check = kiemTraThuyenDaNhan(state);
    if (!force && check.daNhan) {
      console.log(
        `%c[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] ✔️ ĐÃ NHẬN HÀNG HÔM NAY RỒI (${check.lyDo}). Bỏ qua không click lại!`,
        "color: #4caf50; font-weight: bold;"
      );
      localStorage.setItem("sfl_shipment_restocked_date", todayKey);
      return true;
    }

    console.log(
      `%c[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] ${force ? "⚡ Ép buộc nhận hàng" : "Tiến hành nhận hàng Thuyền Restock"}...`,
      "color: #ff9800; font-weight: bold;"
    );

    // Cách 1: Ưu tiên Game Bridge
    if (typeof S.restockShipmentBridge === "function") {
      const resBridge = await S.restockShipmentBridge(2500);
      if (resBridge && (resBridge.ok || resBridge.alreadyRestocked)) {
        console.log("%c[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] 🎉 Bổ sung hạt giống & công cụ thành công qua Game Bridge!", "color: #00e676; font-weight: bold; font-size: 13px;");
        localStorage.setItem("sfl_shipment_restocked_date", todayKey);
        return true;
      }
      console.log(
        `%c[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] ⚠️ Bridge thất bại: ${JSON.stringify(resBridge)}. Chuyển sang click DOM...`,
        "color: #ff9800; font-weight: bold;"
      );
    }

    // Cách 2: Fallback click DOM thuyền restock
    const thuyen = timThuyenRestock();
    if (!thuyen) {
      console.log("[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] ℹ️ Thuyền Restock hiện không có hoặc chưa cập bến.");
      return false;
    }

    console.log("[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] 🖱️ Click vào Thuyền để mở bảng nhận hàng...");
    clickTam(thuyen.element);
    await ngu(800);

    let daBamRestock = false;
    let docHienTai = null;
    let modalDaMo = false;

    for (let lan = 0; lan < 8; lan += 1) {
      await ngu(400);
      for (const doc of layTaiLieuGame()) {
        const dlg = doc.querySelector('[role="dialog"], .scrollable, div[class*="modal"]');
        if (dlg && xemPhanTuRanh(dlg)) {
          modalDaMo = true;
          const dlgText = (dlg.textContent || "").toLowerCase();
          if (
            dlgText.includes("next free shipment") ||
            dlgText.includes("shipment in") ||
            dlgText.includes("chuyến hàng tiếp theo")
          ) {
            console.log("%c[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] ✔️ Bảng thông báo chuyến hàng miễn phí hôm nay đã nhận rồi!", "color: #4caf50; font-weight: bold;");
            localStorage.setItem("sfl_shipment_restocked_date", todayKey);
            await dongModal(doc);
            return true;
          }
        }

        const cacNut = doc.querySelectorAll("button, [role='button']");
        for (const btn of cacNut) {
          if (!xemPhanTuRanh(btn) || btn.disabled) continue;
          const txt = (btn.textContent || "").trim().toLowerCase();
          if (
            txt.includes("restock") ||
            txt.includes("replenish") ||
            txt.includes("bổ sung") ||
            txt.includes("nhận hàng")
          ) {
            console.log(`[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] Bấm nút: "${btn.textContent?.trim()}"`);
            clickTam(btn);
            daBamRestock = true;
            docHienTai = doc;
            break;
          }
        }
        if (daBamRestock) break;
      }
      if (daBamRestock) break;
    }

    if (daBamRestock && docHienTai) {
      await ngu(1000);
      await dongModal(docHienTai);
      localStorage.setItem("sfl_shipment_restocked_date", todayKey);
      console.log("%c[SFL Check-in] ⛵ [2/2 THUYỀN RESTOCK] 🎉 CHECK-IN THUYỀN RESTOCK THÀNH CÔNG!", "color: #00e676; font-weight: bold;");
      return true;
    } else {
      for (const doc of layTaiLieuGame()) {
        await dongModal(doc);
      }
      if (modalDaMo) {
        localStorage.setItem("sfl_shipment_restocked_date", todayKey);
        return true;
      }
      return false;
    }
  }

  // ═══════ TỔNG ĐIỀU PHỐI CHECK-IN (GỒM CẢ RƯƠNG LẪN THUYỀN) ═══════
  async function tickCheckin(force = false) {
    if (dangBan) return false;
    const todayKey = new Date().toISOString().slice(0, 10);
    if (!force && (S.__daCheckinHomNay || localStorage.getItem("sfl_checkin_done_date") === todayKey)) {
      return true;
    }
    if (!force && S.__cooldownCheckin && Date.now() < S.__cooldownCheckin) return false;

    if (typeof S.xinKhoa === "function" && !S.xinKhoa("checkin")) {
      return false;
    }
    dangBan = true;

    try {
      if (typeof S.isFlowBlocked === "function" && S.isFlowBlocked("checkin")) {
        return false;
      }

      console.log("%c[SFL Check-in] 🚀 BẮT ĐẦU KIỂM TRA CHECK-IN (1. RƯƠNG DAILY & 2. THUYỀN RESTOCK)...", "color: #00bcd4; font-weight: bold;");

      // 1. Check-in Rương Daily Reward
      const okRuong = await xuLyCheckinRuongDaily(force);
      await ngu(600);

      // 2. Check-in Thuyền Restock hàng hóa
      const okThuyen = await xuLyCheckinThuyenRestock(force);
      await ngu(400);

      // 3. Tự động nhận thưởng Mốc Tháng (Season Track) & Codex Milestones
      if (typeof S.claimMilestonesBridge === "function") {
        try {
          const resMls = await S.claimMilestonesBridge(3000);
          if (resMls && resMls.ok && (resMls.claimedTracks > 0 || resMls.claimedCodex > 0)) {
            console.log(
              `%c[SFL Mốc Thưởng Tháng] 🏆 Check-in đã nhận ${resMls.claimedTracks} Mốc Tháng (Track Milestones) & ${resMls.claimedCodex} Mốc Codex!`,
              "color: #ffd700; font-weight: bold; font-size: 13px;"
            );
          }
        } catch (_eMls) {}
      }

      // Đánh dấu hoàn thành hôm nay để scheduler bỏ qua ở tất cả các vòng tiếp theo
      if (okRuong || okThuyen) {
        S.__daCheckinHomNay = true;
        localStorage.setItem("sfl_checkin_done_date", todayKey);
        console.log("%c[SFL Check-in] 🏆 ĐÃ GHI NHẬN CHECK-IN XONG CHO HÔM NAY! Tự động bỏ qua các vòng sau.", "color: #00e676; font-weight: bold; font-size: 13px;");
      }
      lenLich7hSang();

      return okRuong || okThuyen;
    } catch (err) {
      console.error("[SFL Check-in] Lỗi trong quá trình check-in:", err);
      lenLich7hSang();
      return false;
    } finally {
      dangBan = false;
      if (typeof S.nhaKhoa === "function") {
        S.nhaKhoa("checkin");
      }
    }
  }

  // Xuất bản hàm ra namespace toàn cục
  S.tickCheckin = tickCheckin;
  S.lenLich7hSang = lenLich7hSang;
  S.xuLyCheckinRuongDaily = xuLyCheckinRuongDaily;
  S.xuLyCheckinThuyenRestock = xuLyCheckinThuyenRestock;

  // Phím tắt Alt + C để Check-in thủ công (HỖ TRỢ ÉP CHẠY CƯỠNG BỨC CẢ RƯƠNG & THUYỀN)
  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "c" || e.key === "C")) {
      console.log("[SFL Phím Tắt] ⌨️ Kích hoạt Check-in CƯỠNG BỨC RƯƠNG + THUYỀN (Alt + C)...");
      S.__daCheckinHomNay = false;
      S.__cooldownCheckin = 0;
      tickCheckin(true);
    }
  });

})(window.SFL = window.SFL || {});
