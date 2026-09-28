// ═══════════════════════════════════════════════════════════════════
// LUỒNG TỰ ĐỘNG XỬ LÝ POPUP SONG SONG (auto_popup.js)
// Chạy ngầm song song 100% — Tự động bấm "Tap to Continue", "Claim", "Reload", "OK", "Got it"...
// Tự động hồi sinh game khi gặp lỗi "Something went wrong / Reload", dọn sạch thông báo rác
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let dangXuLy = false;
  const lichSuClick = new Map(); // Lưu lịch sử click để chống click lặp vô tận

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

    return true;
  }

  // Danh sách từ khóa an toàn cần tự động bấm (Continue, Claim, OK, Reload...)
  const TU_KHOA_CLICK_AN_TOAN = [
    "tap to continue",
    "tap anywhere to continue",
    "tap continue",
    "continue",
    "tiếp tục",
    "claim",
    "nhận thưởng",
    "claim reward",
    "claim free gift",
    "open chest",
    "tap to open",
    "sweet!",
    "awesome!",
    "woohoo!",
    "open",
    "got it",
    "understood",
    "acknowledge",
    "ok",
    "close",
    "đóng",
    "accept",
    "confirm",
    "dismiss",
    "reload",
    "refresh",
    "try again",
    "thử lại",
    "tải lại",
    "reconnect"
  ];

  // Danh sách từ khóa cấm kỵ tuyệt đối không click (tránh mua VIP, rút tiền, crypto...)
  const TU_KHOA_CAM_KY = [
    "buy vip",
    "vip pass",
    "purchase",
    "mint",
    "withdraw",
    "deposit",
    "crypto",
    "matic",
    "pol",
    "connect wallet",
    "upgrade to vip",
    "renew vip"
  ];

  async function kiemTraVaXuLyPopupSongSong() {
    if (dangXuLy) return;

    // Chỉ tạm dừng khi người dùng tắt công tắc tổng (Master Switch)
    if (S.cauHinh && S.cauHinh.masterBat === false) {
      return;
    }

    // Nếu Captcha đang mở hoặc tài khoản đang bị tạm khóa Quick Check -> Nhường quyền 100%
    if ((typeof S.isCaptchaLocked === "function" && S.isCaptchaLocked()) || (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen())) {
      return;
    }

    // Nếu Goblin Swarm đang chiếm đảo -> Bỏ qua
    if (typeof S.isGoblinSwarm === "function" && S.isGoblinSwarm()) {
      return;
    }

    const bayGio = Date.now();
    dangXuLy = true;

    try {
      for (const doc of layTaiLieuGame()) {
        if (!doc || !doc.body) continue;

        // 1. KIỂM TRA LỖI TREO GAME (Something went wrong / Reload / Connection lost)
        const txtBody = (doc.body.textContent || "").toLowerCase();
        const coLoiHeThong =
          (txtBody.includes("something went wrong") || txtBody.includes("connection lost") || txtBody.includes("network error")) &&
          !txtBody.includes("captcha");

        if (coLoiHeThong) {
          const nutReload = Array.from(doc.querySelectorAll("button, [role='button'], div.cursor-pointer")).find((b) => {
            const t = (b.textContent || "").trim().toLowerCase();
            return t.includes("reload") || t.includes("refresh") || t.includes("try again") || t.includes("tải lại");
          });

          if (nutReload && xemPhanTuRanh(nutReload)) {
            console.log("%c[SFL Auto Popup] ⚡ Phát hiện lỗi game -> Tự động bấm nút RELOAD để hồi sinh!", "color: #ff3838; font-weight: bold; font-size: 13px;");
            clickTam(nutReload);
            await ngu(1500);
            return;
          }
        }

        // 2. TÌM CÁC MODAL/DIALOG POPUP ĐANG NỔI TRÊN MÀN HÌNH
        const modals = doc.querySelectorAll(
          ".fixed.inset-0, [role='dialog'], [role='modal'], div[class*='modal'], div[class*='Modal'], div.backdrop-blur, div[style*='z-index: 50'], div[style*='z-index: 100']"
        );

        for (const modal of modals) {
          if (!xemPhanTuRanh(modal)) continue;

          // Bỏ qua nếu là Captcha hoặc bảng tạm khóa Quick Check
          const modalText = (modal.textContent || "").toLowerCase();
          if (
            modalText.includes("stop the") ||
            modalText.includes("tap the chest") ||
            modalText.includes("prove you") ||
            modalText.includes("quick check") ||
            modalText.includes("rotate the item") ||
            modalText.includes("drag the crop") ||
            modalText.includes("you failed the captcha") ||
            modalText.includes("please wait, then you can try again") ||
            modalText.includes("failed the captcha 2 times")
          ) {
            continue;
          }

          // Bỏ qua nếu là modal mua VIP
          if (modalText.includes("vip pass") || modalText.includes("buy vip") || modalText.includes("renew vip")) {
            // Thử tìm nút đóng (X) an toàn để tắt modal VIP nếu có
            const nutDong = modal.querySelector('img[src*="/ui/close"], img[src*="close.png"], button[aria-label="close"]');
            if (nutDong && xemPhanTuRanh(nutDong)) {
              clickTam(nutDong);
              await ngu(300);
            }
            continue;
          }

          // Tìm các nút bấm thỏa mãn điều kiện an toàn
          const cacNut = modal.querySelectorAll("button, [role='button'], div[class*='cursor-pointer'], a[class*='cursor-pointer'], img[src*='chest']");
          for (const btn of cacNut) {
            if (!xemPhanTuRanh(btn)) continue;
            const txt = (btn.textContent || btn.getAttribute("aria-label") || "").trim().toLowerCase();

            // Kiểm tra từ khóa cấm
            if (TU_KHOA_CAM_KY.some((kw) => txt.includes(kw))) continue;

            // Kiểm tra từ khóa hợp lệ
            const hopLe = TU_KHOA_CLICK_AN_TOAN.some((kw) => txt.includes(kw)) || btn.tagName === "IMG";
            if (!hopLe) continue;

            // Chống spam click cùng 1 nút liên tục trong 2 giây
            const nutId = btn.id || (txt + "_" + Math.round(btn.getBoundingClientRect().top));
            const lanCuoiClick = lichSuClick.get(nutId) || 0;
            if (bayGio - lanCuoiClick < 2000) continue;

            lichSuClick.set(nutId, bayGio);
            console.log(`%c[SFL Auto Popup] 👆 Tự động bấm: "${txt.toUpperCase() || 'POPUP / CHEST'}"`, "color: #00e676; font-weight: bold; font-size: 12px;");
            clickTam(btn);
            await ngu(350);
            break;
          }
        }
      }
    } catch (err) {
      // Giữ im lặng trong background watcher
    } finally {
      dangXuLy = false;
    }
  }

  // Khởi chạy vòng lặp giám sát song song mỗi 600ms
  setInterval(kiemTraVaXuLyPopupSongSong, 600);

  S.kiemTraVaXuLyPopupSongSong = kiemTraVaXuLyPopupSongSong;

  // ═══════════════════════════════════════════════════════════════════
  // TỰ ĐỘNG RELOAD SAU 1 GIỜ NẾU GAME ĐÃ LƯU (Auto Reload Feature)
  // Tự động reload, không cần xác nhận người dùng
  // ═══════════════════════════════════════════════════════════════════
  let daKhoiDongAutoReload = false;
  let thoiGianReloadCuoi = Date.now();

  function kiemTraGameDaLuu() {
    const bridgeUpdateTime = S.gameBridgeUpdatedAt || 0;
    const gioVuaQua = Date.now() - 3600000;

    return bridgeUpdateTime > gioVuaQua;
  }

  async function kiemTraVaThucHienAutoReload() {
    if (daKhoiDongAutoReload) return;
    daKhoiDongAutoReload = true;

    while (true) {
      await ngu(60000);

      if (!S.cauHinh?.autoReload) continue;
      if (S.cauHinh?.masterBat === false) continue;

      if ((typeof S.isCaptchaLocked === "function" && S.isCaptchaLocked()) ||
          (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) ||
          (typeof S.isGoblinSwarm === "function" && S.isGoblinSwarm())) {
        continue;
      }

      const bayGio = Date.now();
      const thoiGianTuReloadCuoi = bayGio - thoiGianReloadCuoi;

      if (thoiGianTuReloadCuoi < 3600000) continue;

      const daLuu = kiemTraGameDaLuu();

      if (daLuu) {
        console.log("%c[SFL Auto Reload] 🔄 Đã quá 1 giờ và game đã lưu -> Tự động reload trang!", "color: #00e676; font-weight: bold; font-size: 13px;");
        thoiGianReloadCuoi = bayGio;
        location.reload();
        return;
      } else {
        console.log("%c[SFL Auto Reload] ⏳ Đã quá 1 giờ nhưng game CHƯA lưu -> Đợi thêm 5 phút rồi kiểm tra lại", "color: #ff9800; font-weight: bold; font-size: 13px;");
        thoiGianReloadCuoi = bayGio - 300000;
      }
    }
  }

  setTimeout(() => {
    kiemTraVaThucHienAutoReload();
  }, 5000);

})(window.SFL = window.SFL || {});
