// ═══════════════════════════════════════════════════════════════════
// LUỒNG GIÁM SÁT VÀ TỰ ĐỘNG GIẢI CAPTCHA TỐC ĐỘ CAO (captcha.js)
// Tự động nhận diện, chặn luồng khác, giải Captcha & nhận thưởng
// Hỗ trợ: Goblin (Yêu tinh), Skeleton (Người xương), Moon Seeker, Zombie, Rương kho báu
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangBan = false;
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

  // Kiểm tra phần tử hiển thị
  function xemPhanTuRanh(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const view = el.ownerDocument?.defaultView || window;
    let style;
    try { style = view.getComputedStyle(el); } catch (_e) { return false; }
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  // Kích hoạt React Fiber props (hỗ trợ React 17, 18, Fiber memoizedProps)
  function kichHoatReactProps(el) {
    if (!el) return;
    const fakeEv = {
      stopPropagation: () => {},
      preventDefault: () => {},
      stopImmediatePropagation: () => {},
      target: el,
      currentTarget: el,
      button: 0,
      buttons: 1,
      bubbles: true,
      cancelable: true,
      composed: true,
      isTrusted: true,
    };

    for (const k in el) {
      if (k.startsWith("__reactProps$") || k.startsWith("__reactEventHandlers$") || k.startsWith("__reactFiber$")) {
        const p = el[k]?.memoizedProps || el[k];
        if (p && typeof p === "object") {
          if (typeof p.onPointerDown === "function") {
            try { p.onPointerDown(fakeEv); } catch (_e) {}
          }
          if (typeof p.onMouseDown === "function") {
            try { p.onMouseDown(fakeEv); } catch (_e) {}
          }
          if (typeof p.onPointerUp === "function") {
            try { p.onPointerUp(fakeEv); } catch (_e) {}
          }
          if (typeof p.onMouseUp === "function") {
            try { p.onMouseUp(fakeEv); } catch (_e) {}
          }
          if (typeof p.onClick === "function") {
            try { p.onClick(fakeEv); } catch (_e) {}
          }
          if (typeof p.onOpen === "function") {
            try { p.onOpen(); } catch (_e) {}
          }
        }
      }
    }
  }

  // Click tâm chuẩn xác với đầy đủ chuỗi PointerEvent, MouseEvent và React Props
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
      screenX: cx,
      screenY: cy,
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
    if (el.parentElement?.parentElement) kichHoatReactProps(el.parentElement.parentElement);
    if (el.firstElementChild) kichHoatReactProps(el.firstElementChild);

    // Nhả chuột nhanh sau 20ms
    setTimeout(() => {
      try {
        if (typeof el.blur === "function") el.blur();
        el.dispatchEvent(new MouseEvent("mouseout", upOpts));
        el.dispatchEvent(new MouseEvent("mouseleave", upOpts));
      } catch (_e5) {}
    }, 20);

    return true;
  }

  // ═══════ Giao tiếp với MAIN World Bridge để đọc React Fiber ═══════
  let pendingResolvers = new Map();
  let reqSeq = 0;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data._sfl !== true) return;

    if (data.type === "SFL_CAPTCHA_GRID_RESULT") {
      const reqId = data.reqId;
      if (reqId && pendingResolvers.has(reqId)) {
        const resolve = pendingResolvers.get(reqId);
        pendingResolvers.delete(reqId);
        resolve(data.items || null);
      }
    }

    if (data.type === "SFL_SOLVE_DRAG_PUZZLE_RESULT") {
      const reqId = data.reqId;
      if (reqId && pendingResolvers.has(reqId)) {
        const resolve = pendingResolvers.get(reqId);
        pendingResolvers.delete(reqId);
        resolve(data.res || null);
      }
    }

    if (data.type === "SFL_SOLVE_ROTATE_CAPTCHA_RESULT") {
      const reqId = data.reqId;
      if (reqId && pendingResolvers.has(reqId)) {
        const resolve = pendingResolvers.get(reqId);
        pendingResolvers.delete(reqId);
        resolve(data.res || null);
      }
    }
  });

  // Inject script page-bridge vào MAIN world
  let daInjectBridgeCaptcha = false;
  function injectBridge() {
    if (daInjectBridgeCaptcha || document.getElementById("sfl-page-bridge")) return;
    daInjectBridgeCaptcha = true;
    try {
      const script = document.createElement("script");
      script.id = "sfl-page-bridge";
      script.src = chrome.runtime.getURL("scripts/bridge/page-bridge.js");
      (document.head || document.documentElement).appendChild(script);
    } catch (_e) {}
  }
  injectBridge();

  // Yêu cầu Bridge đọc danh sách 16 ô
  function docGridTuBridge(timeoutMs = 1500) {
    injectBridge();
    return new Promise((resolve) => {
      const reqId = `cap_${Date.now().toString(36)}_${(++reqSeq).toString(36)}`;
      const timer = setTimeout(() => {
        pendingResolvers.delete(reqId);
        resolve(null);
      }, timeoutMs);
      pendingResolvers.set(reqId, (items) => {
        clearTimeout(timer);
        resolve(items);
      });
      window.postMessage({ _sfl: true, type: "SFL_READ_CAPTCHA_GRID", reqId }, "*");
    });
  }

  // Yêu cầu Bridge giải Puzzle Drag Captcha
  function giaiPuzzleQuaBridge(timeoutMs = 3000) {
    injectBridge();
    return new Promise((resolve) => {
      const reqId = `drg_${Date.now().toString(36)}_${(++reqSeq).toString(36)}`;
      const timer = setTimeout(() => {
        pendingResolvers.delete(reqId);
        resolve(null);
      }, timeoutMs);
      pendingResolvers.set(reqId, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
      window.postMessage({ _sfl: true, type: "SFL_SOLVE_DRAG_PUZZLE", reqId }, "*");
    });
  }

  // Yêu cầu Bridge giải Rotate Collectible Captcha
  function giaiRotateQuaBridge(timeoutMs = 2500) {
    injectBridge();
    return new Promise((resolve) => {
      const reqId = `rot_${Date.now().toString(36)}_${(++reqSeq).toString(36)}`;
      const timer = setTimeout(() => {
        pendingResolvers.delete(reqId);
        resolve(null);
      }, timeoutMs);
      pendingResolvers.set(reqId, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
      window.postMessage({ _sfl: true, type: "SFL_SOLVE_ROTATE_CAPTCHA", reqId }, "*");
    });
  }

  // ═══════ Kiểm tra tài khoản có đang bị tạm khóa Quick Check (Lockout / Cooldown) hay không ═══════
  function layThoiGianKhoaCaptcha() {
    // 1. Đọc từ LocalStorage ("captcha.lockedUntil")
    try {
      const val = localStorage.getItem("captcha.lockedUntil");
      if (val) {
        const num = Number(val);
        if (!isNaN(num) && num > Date.now()) {
          return num;
        }
      }
    } catch (_e) {}

    // 2. Đọc từ Game State Machine (failedAt + 5 phút)
    try {
      const state = S.gameState || S.userData;
      const failedAt = state?.captcha?.failedAt;
      if (typeof failedAt === "number" && failedAt > 0) {
        const serverLock = failedAt + 5 * 60 * 1000;
        if (serverLock > Date.now()) {
          return serverLock;
        }
      }
    } catch (_e2) {}

    // 3. Đọc trực tiếp từ DOM nếu modal thông báo khóa đang hiển thị
    const taiLieu = layTaiLieuGame();
    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;
      const txt = (doc.body.textContent || "").toLowerCase();
      const coTextKhoa =
        txt.includes("you failed the captcha") ||
        txt.includes("failed the captcha 2 times") ||
        txt.includes("failed the captcha") ||
        txt.includes("please wait, then you can try again") ||
        txt.includes("anda gagal captcha") ||
        txt.includes("ты не прошёл капчу") ||
        txt.includes("du hast das captcha") ||
        txt.includes("você falhou no captcha") ||
        txt.includes("hai fallito il captcha") ||
        txt.includes("tu as échoué") ||
        txt.includes("¡fallaste el captcha") ||
        txt.includes("キャプチャに") ||
        txt.includes("你验证码失败了");

      if (coTextKhoa) {
        const modal = timModalHienThi(doc, ["failed", "captcha", "please wait", "try again", "warten", "attendi", "espere", "aguarde"]);
        if (modal && xemPhanTuRanh(modal)) {
          return Date.now() + 5 * 60 * 1000;
        }
      }
    }

    return 0;
  }

  function isCaptchaLocked() {
    const lockUntil = layThoiGianKhoaCaptcha();
    return lockUntil > Date.now();
  }

  // ═══════ Kiểm tra Captcha đang mở trên màn hình (Siêu nhạy & chính xác) ═══════
  function isCaptchaOpen() {
    // Nếu đang bị tạm khóa Quick Check -> Coi như Captcha đang hiệu lực để chặn mọi thao tác khác
    if (isCaptchaLocked()) return true;

    const taiLieu = layTaiLieuGame();
    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // 1. Quét nhanh textContent của toàn bộ Body (độ trễ < 0.1ms)
      const bodyTxt = (doc.body.textContent || "").toLowerCase();
      const coTextCaptcha =
        bodyTxt.includes("attempts left:") ||
        bodyTxt.includes("stop the goblins") ||
        bodyTxt.includes("stop the moon seeker") ||
        bodyTxt.includes("stop the skeleton") ||
        bodyTxt.includes("stop the zombie") ||
        bodyTxt.includes("tap the chest") ||
        bodyTxt.includes("chest to open") ||
        bodyTxt.includes("tap to open") ||
        bodyTxt.includes("rotate the item") ||
        bodyTxt.includes("until it is upright") ||
        bodyTxt.includes("drag the crop") ||
        bodyTxt.includes("empty slot") ||
        bodyTxt.includes("quick check!") ||
        bodyTxt.includes("you failed the captcha") ||
        bodyTxt.includes("please wait, then you can try again") ||
        bodyTxt.includes("ranura vacía") ||
        bodyTxt.includes("slot kosong") ||
        bodyTxt.includes("将作物拖到空槽中") ||
        bodyTxt.includes("kéo cây") ||
        bodyTxt.includes("kéo thả") ||
        (bodyTxt.includes("rotate") && bodyTxt.includes("upright")) ||
        (bodyTxt.includes("drag") && (bodyTxt.includes("slot") || bodyTxt.includes("crop") || bodyTxt.includes("item") || bodyTxt.includes("empty"))) ||
        bodyTxt.includes("verify you are human") ||
        bodyTxt.includes("are you a human");

      if (coTextCaptcha) {
        // Đảm bảo phần tử thật sự hiển thị trên màn hình
        const spans = doc.querySelectorAll("span, p, h1, h2, h3, div");
        for (const s of spans) {
          const t = (s.textContent || "").toLowerCase();
          if (
            (t.includes("attempts left:") ||
              t.includes("stop the goblin") ||
              t.includes("moon seeker") ||
              t.includes("skeleton") ||
              t.includes("tap the chest") ||
              t.includes("chest to open") ||
              t.includes("tap to open") ||
              t.includes("rotate the item") ||
              t.includes("until it is upright") ||
              t.includes("drag the crop") ||
              t.includes("empty slot") ||
              t.includes("ranura vacía") ||
              t.includes("slot kosong") ||
              t.includes("将作物拖到空槽中") ||
              t.includes("kéo cây") ||
              t.includes("kéo thả") ||
              t.includes("you failed the captcha") ||
              t.includes("please wait, then you can try again") ||
              (t.includes("rotate") && t.includes("upright")) ||
              (t.includes("drag") && (t.includes("slot") || t.includes("crop") || t.includes("item") || t.includes("empty"))) ||
              (t.includes("quick check!") && (t.includes("farming") || t.includes("challenge") || t.includes("rotate") || t.includes("crop") || t.includes("drag"))) ||
              t.includes("human")) &&
            xemPhanTuRanh(s)
          ) {
            return true;
          }
        }
      }

      // 2. Kiểm tra Grid 16 ô Stop the Goblins / Skeleton / Moon Seeker / Zombie
      const wraps = doc.querySelectorAll("div.flex.flex-wrap.justify-center.items-center, div.flex.flex-wrap");
      for (const w of wraps) {
        if (!xemPhanTuRanh(w)) continue;
        const cellCount = Array.from(w.children).filter(
          (el) => el && el.tagName === "DIV" && el.classList?.contains("cursor-pointer"),
        ).length;
        if (cellCount >= 16 && (bodyTxt.includes("attempts") || bodyTxt.includes("stop") || bodyTxt.includes("seeker"))) {
          return true;
        }
      }
    }
    return false;
  }

  // ═══════ Chuẩn hóa item từ React State (Goblin, Skeleton, Moon Seeker, Zombie) ═══════
  function chuanHoaGridItem(raw) {
    if (!raw || typeof raw !== "object") return null;
    const src = typeof raw.src === "string" ? raw.src : "";
    let isGoblin = false;
    if (typeof raw.isGoblin === "boolean") isGoblin = raw.isGoblin;
    else if (typeof raw.isMoonSeeker === "boolean") isGoblin = raw.isMoonSeeker;
    else if (typeof raw.isZombie === "boolean") isGoblin = raw.isZombie;
    else if (typeof raw.isSkeleton === "boolean") isGoblin = raw.isSkeleton;
    else if (raw.goblin === true || raw.moonSeeker === true || raw.zombie === true || raw.skeleton === true) isGoblin = true;
    else {
      const t = String(raw.type || raw.kind || raw.role || raw.name || "").toLowerCase();
      if (t === "goblin" || t.includes("moon") || t.includes("seeker") || t.includes("zomb") || t.includes("skele")) isGoblin = true;
      if (src && (src.includes("skeleton") || src.includes("goblin") || src.includes("moon_seeker") || src.includes("zombie"))) isGoblin = true;
    }
    return { isGoblin, src };
  }

  // ═══════ Kiểm tra ô đã có icon confirm/cancel (đã click rồi) ═══════
  function oDaClick(cell) {
    const imgs = cell.querySelectorAll("img");
    for (const im of imgs) {
      const u = String(im.currentSrc || im.getAttribute("src") || "").toLowerCase();
      if (u.includes("confirm") || u.includes("cancel") || u.includes("/icons/confirm") || u.includes("/icons/cancel")) return true;
    }
    return false;
  }

  // ═══════ Lấy ảnh mục tiêu bên trong ô để click ═══════
  function layAnhTrongO(cell) {
    const imgs = cell.querySelectorAll("img");
    for (const im of imgs) {
      const low = String(im.currentSrc || im.getAttribute("src") || "").toLowerCase();
      if (!low.startsWith("data:image")) continue;
      const st = String(im.getAttribute("style") || "");
      if (/transform|perspective|skew|rotate|scale/i.test(st)) return im;
    }
    for (const im of imgs) {
      const low = String(im.currentSrc || im.getAttribute("src") || "").toLowerCase();
      if (low.startsWith("data:image")) return im;
    }
    return cell.querySelector("img.h-full.object-contain") || cell.querySelector("img") || cell;
  }

  // ═══════ Quy trình tự động Giải Grid 16 ô Captcha TỐC ĐỘ CAO (TURBO) ═══════
  async function giaiGridCaptcha(doc, wrap) {
    console.log("%c[SFL Captcha] ⚡ Bắt đầu giải Grid 16 ô Captcha (Turbo Mode)...", "color: #00e676; font-weight: bold; font-size: 13px;");
    S.hanhDongCuoi = "🛡️ Đang giải Captcha (Turbo)...";

    // Phản xạ siêu tốc (200ms - 280ms)
    await ngu(200 + Math.floor(Math.random() * 80));

    const cells = Array.from(wrap.children).filter(
      (el) => el && el.tagName === "DIV" && el.classList?.contains("cursor-pointer"),
    ).slice(0, 16);

    if (cells.length < 16) {
      console.log("[SFL Captcha] ⚠️ Không đủ 16 ô grid!");
      return false;
    }

    // Đọc danh sách 16 ô từ MAIN World Bridge
    let items = null;
    for (let lanThu = 1; lanThu <= 3; lanThu += 1) {
      try {
        items = await docGridTuBridge(1200);
      } catch (_e) {
        items = null;
      }
      if (items && Array.isArray(items) && items.length === 16) {
        break;
      }
      if (lanThu < 3) {
        await ngu(200);
      }
    }

    if (!items || !Array.isArray(items) || items.length < 16) {
      console.log("[SFL Captcha] ⚠️ Bridge không đọc được 16 ô React Fiber. Dừng giải để tránh click sai.");
      return false;
    }

    const chuanHoa = items.map((it) => chuanHoaGridItem(it));

    // Lọc ra TẤT CẢ các ô mục tiêu có isGoblin === true (Goblin / Skeleton / Moon Seeker / Zombie)
    const cacMucTieu = [];
    for (let i = 0; i < 16; i += 1) {
      const item = chuanHoa[i];
      if (item && item.isGoblin === true) {
        cacMucTieu.push(i);
      }
    }

    console.log(
      `%c[SFL Captcha] 🎯 Phát hiện ${cacMucTieu.length} ô mục tiêu (Goblin/Người xương): [${cacMucTieu.map((i) => i + 1).join(", ")}]`,
      "color: #4caf50; font-weight: bold; font-size: 13px;"
    );

    if (cacMucTieu.length === 0) {
      console.log("[SFL Captcha] ⚠️ Không tìm thấy ô mục tiêu nào trong dữ liệu Bridge.");
      return false;
    }

    // Click siêu nhanh vào TẤT CẢ các ô mục tiêu (khoảng 80ms - 140ms mỗi ô)
    let daClickCount = 0;
    for (const idx of cacMucTieu) {
      const cell = cells[idx];
      if (!cell || !xemPhanTuRanh(cell) || oDaClick(cell)) continue;
      const inner = layAnhTrongO(cell);
      clickTam(inner !== cell ? inner : cell);
      daClickCount += 1;
      console.log(`[SFL Captcha] ⚡ Click ô mục tiêu số ${idx + 1} (${daClickCount}/${cacMucTieu.length})`);
      await ngu(80 + Math.floor(Math.random() * 60));
    }

    // Đợi ClaimReward popup xuất hiện (onOpen) và bấm nút Claim / Woohoo / Tiếp tục (tối đa 3.5s)
    let daBamClaim = false;
    for (let loop = 0; loop < 15; loop += 1) {
      await ngu(250);
      for (const d of layTaiLieuGame()) {
        const cacNut = d.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']");
        for (const btn of cacNut) {
          if (!xemPhanTuRanh(btn)) continue;
          const txt = (btn.textContent || "").trim().toLowerCase();
          
          if (txt.includes("tap the chest") || txt.includes("chest to open") || txt.includes("stop the")) continue;

          const laNutNhan =
            txt === "claim" || txt.includes("claim") ||
            txt === "continue" || txt.includes("continue") ||
            txt === "tiếp tục" || txt.includes("tiếp tục") ||
            txt === "xác nhận" || txt.includes("xác nhận") ||
            txt === "sweet!" || txt.includes("sweet") ||
            txt === "awesome!" || txt.includes("awesome") ||
            txt === "woohoo!" || txt.includes("woohoo") ||
            txt === "open" || txt === "mở" ||
            txt === "close" || txt === "đóng" || txt === "ok";

          if (laNutNhan) {
            console.log(`%c[SFL Captcha] 🎁 Bấm nút nhận thưởng hoàn tất Captcha: "${txt}"`, "color: #00e676; font-weight: bold;");
            clickTam(btn);
            daBamClaim = true;
            await ngu(400);
            break;
          }
        }
        if (daBamClaim) break;
      }
      if (daBamClaim) break;
    }

    return true;
  }

  // ═══════ Đóng popup thông thường (TUYỆT ĐỐI KHÔNG CHẠY KHI ĐANG CÓ CAPTCHA) ═══════
  async function dongPopupCaptcha() {
    // Captcha trong Sunflower Land KHÔNG CÓ NÚT CLOSE, chỉ đóng khi người chơi giải xong!
    if (isCaptchaOpen()) {
      return false;
    }

    const taiLieu = layTaiLieuGame();
    for (const doc of taiLieu) {
      if (!doc || !doc.body) continue;

      // 1. Tìm nút ảnh close (bỏ qua icon cancel)
      const cacAnhClose = doc.querySelectorAll('img[src*="close"]');
      for (const img of cacAnhClose) {
        if (xemPhanTuRanh(img)) {
          const nut = img.closest("button, [role='button'], div[class*='cursor-pointer']") || img;
          clickTam(nut);
          await ngu(200);
          return true;
        }
      }

      // 2. Tìm nút button có chữ Close, Đóng, OK
      const cacNut = doc.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']");
      for (const btn of cacNut) {
        if (!xemPhanTuRanh(btn)) continue;
        const txt = (btn.textContent || "").trim().toLowerCase();
        if (txt === "close" || txt === "đóng" || txt === "ok") {
          clickTam(btn);
          await ngu(200);
          return true;
        }
      }

      // 3. Gửi phím Escape vào window game
      try {
        const view = doc.defaultView || window;
        view.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
      } catch (_e) {}
    }
    return false;
  }

  // ═══════ Tìm container Modal đang hiển thị chứa từ khóa mục tiêu ═══════
  function timModalHienThi(doc, keywords = []) {
    if (!doc || !doc.body) return null;
    const allSpans = doc.querySelectorAll("span, p, h1, h2, h3, div");
    for (const s of allSpans) {
      if (!xemPhanTuRanh(s)) continue;
      const txt = (s.textContent || "").trim().toLowerCase();
      const match = keywords.some((kw) => txt.includes(kw));
      if (match) {
        const modal = s.closest("[role='dialog'], div[class*='fixed'][class*='inset-0'], div[class*='fixed'], div[class*='bg-brown'], div[class*='p-2'], div[class*='p-1']") ||
                      s.parentElement?.parentElement?.parentElement ||
                      s.parentElement;
        return modal;
      }
    }
    return null;
  }

  // ═══════ Hỗ trợ Captcha Xoay Hình ("Rotate the item until it is upright, then submit") ═══════
  function timPhanTuRotate(container) {
    if (!container) return null;

    // 1. Tìm thẻ ảnh bị xoay
    let targetImg = null;
    const allImgs = container.querySelectorAll("img");
    for (const im of allImgs) {
      if (!xemPhanTuRanh(im)) continue;
      const st = (im.getAttribute("style") || "").toLowerCase();
      const cls = (im.className || "").toLowerCase();
      const src = (im.src || im.getAttribute("src") || "").toLowerCase();
      if (st.includes("rotate(") || im.style?.transform?.includes("rotate(") || cls.includes("transition-transform")) {
        targetImg = im;
        break;
      }
      if (src.includes("nancy") || src.includes("scarecrow") || src.includes("kuebiko") || src.includes("gnome") || src.includes("cat") || src.includes("dog") || src.includes("chicken") || src.includes("beaver") || src.includes("rocket")) {
        targetImg = im;
        break;
      }
    }

    if (!targetImg) {
      const box = container.querySelector('div[class*="w-24"], div[style*="grass_bg"], div[style*="grass_banner_bg"]');
      if (box) targetImg = box.querySelector("img");
    }

    // 2. Tìm các nút điều khiển
    let btnLeft = null;
    let btnRight = null;
    let btnSubmit = null;

    const allButtons = Array.from(container.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']")).filter(xemPhanTuRanh);

    for (const b of allButtons) {
      const txt = (b.textContent || "").trim().toLowerCase();
      const cls = (b.className || "").toLowerCase();
      const im = b.querySelector("img");
      const src = (im?.getAttribute("src") || im?.src || "").toLowerCase();

      const btnEl = b.tagName === "BUTTON" ? b : (b.closest("button") || b);

      if (!btnLeft && (cls.includes("mr-2") || src.includes("arrow_left") || src.includes("left.png") || src.includes("arrow-left"))) {
        btnLeft = btnEl;
      }
      if (!btnRight && (cls.includes("ml-2") || src.includes("arrow_right") || src.includes("right.png") || src.includes("arrow-right"))) {
        btnRight = btnEl;
      }
      if (!btnSubmit && (txt === "submit" || txt.includes("submit") || txt === "xác nhận" || txt === "gửi")) {
        btnSubmit = btnEl;
      }
    }

    // Fallback: trong RotateCollectibleGame có 3 nút: Trái, Phải và Submit
    if ((!btnLeft || !btnRight || !btnSubmit) && allButtons.length >= 3) {
      const pureBtns = allButtons.filter((b) => b.tagName === "BUTTON" || b.getAttribute("role") === "button");
      if (pureBtns.length >= 3) {
        if (!btnLeft) btnLeft = pureBtns[0];
        if (!btnRight) btnRight = pureBtns[1];
        if (!btnSubmit) btnSubmit = pureBtns[2];
      }
    }

    return { targetImg, btnLeft, btnRight, btnSubmit };
  }

  function layGocXoayTuAnh(img) {
    if (!img) return 0;
    const styleStr = img.getAttribute("style") || img.style?.transform || "";
    const m1 = styleStr.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*deg\)/i);
    if (m1) return parseFloat(m1[1]);

    // Thử React Fiber props
    try {
      for (const k in img) {
        if (k.startsWith("__reactProps") || k.startsWith("__reactFiber")) {
          const val = img[k];
          const st = val?.style?.transform || val?.memoizedProps?.style?.transform;
          if (typeof st === "string") {
            const m = st.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*deg\)/i);
            if (m) return parseFloat(m[1]);
          }
        }
      }
    } catch (_e2) {}

    // Thử matrix
    try {
      const tr = window.getComputedStyle(img).transform;
      if (tr && tr !== "none" && tr.startsWith("matrix(")) {
        const parts = tr.slice(7, -1).split(",").map((p) => parseFloat(p.trim()));
        if (parts.length >= 2) {
          const a = parts[0];
          const b = parts[1];
          let deg = Math.round(Math.atan2(b, a) * (180 / Math.PI));
          if (deg < 0) deg += 360;
          return deg;
        }
      }
    } catch (_e) {}

    return 0;
  }

  // ═══════ Xử lý nhận thưởng và đóng hoàn tất sau khi giải xong Captcha ═══════
  async function xuLyNhanThuongVaDong() {
    let daBam = false;
    for (let loop = 0; loop < 15; loop += 1) {
      await ngu(250);
      if (!isCaptchaOpen()) break;

      for (const d of layTaiLieuGame()) {
        const cacNut = d.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']");
        for (const btn of cacNut) {
          if (!xemPhanTuRanh(btn)) continue;
          const txt = (btn.textContent || "").trim().toLowerCase();
          if (txt.includes("tap the chest") || txt.includes("chest to open") || txt.includes("stop the") || txt.includes("rotate the") || txt.includes("drag the")) continue;

          const laNutNhan =
            txt === "claim" || txt.includes("claim") ||
            txt === "continue" || txt.includes("continue") ||
            txt === "tiếp tục" || txt.includes("tiếp tục") ||
            txt === "xác nhận" || txt.includes("xác nhận") ||
            txt === "sweet!" || txt.includes("sweet") ||
            txt === "awesome!" || txt.includes("awesome") ||
            txt === "woohoo!" || txt.includes("woohoo") ||
            txt === "got it" || txt.includes("got it") ||
            txt === "open" || txt === "mở" ||
            txt === "close" || txt === "đóng" || txt === "ok";

          if (laNutNhan) {
            console.log(`%c[SFL Captcha] 🎁 Bấm nút nhận thưởng / hoàn tất: "${txt}"`, "color: #00e676; font-weight: bold;");
            clickTam(btn);
            daBam = true;
            await ngu(350);
            break;
          }
        }
        if (daBam) break;
      }
      if (daBam) {
        await ngu(300);
        if (!isCaptchaOpen()) break;
        daBam = false;
      }
    }
  }

  // ═══════ Giải Captcha Xoay Hình ("Rotate the item until it is upright") ═══════
  async function giaiRotateCaptcha(doc) {
    console.log("%c[SFL Captcha] 🔄 Bắt đầu giải Captcha Xoay Hình (Rotate Upright Challenge)...", "color: #00bcd4; font-weight: bold; font-size: 14px;");
    S.hanhDongCuoi = "🔄 Đang giải Captcha xoay hình...";

    await ngu(300);

    // 1. Thử giải qua Bridge trước (Độ chính xác 100% nhờ React Fiber)
    try {
      const bRes = await giaiRotateQuaBridge(2500);
      if (bRes && bRes.success) {
        console.log("%c[SFL Captcha] 🚀 Bridge giải Rotate Captcha thành công!", "color: #00e676; font-weight: bold;");
        await ngu(500);
        await xuLyNhanThuongVaDong();
        return true;
      }
    } catch (_eB) {}

    // 2. Fallback giải trực tiếp trên content script
    const modal = timModalHienThi(doc, ["rotate the item", "until it is upright", "rotate", "quick check"]) || doc.body;
    if (!modal) return false;

    const { targetImg, btnLeft, btnRight, btnSubmit } = timPhanTuRotate(modal) || {};

    if (!btnSubmit) {
      console.log("[SFL Captcha] ⚠️ Không tìm thấy nút Submit của Rotate Captcha.");
      return false;
    }

    // Xoay hình về góc 0 độ
    for (let loop = 0; loop < 10; loop += 1) {
      const deg = layGocXoayTuAnh(targetImg);
      const steps = Math.round(deg / 45);
      const stepsMod = ((steps % 8) + 8) % 8;

      console.log(`[SFL Captcha] 📐 Góc hiện tại: ${deg}° (bước lệch: ${stepsMod}/8)`);

      if (stepsMod === 0) {
        console.log("%c[SFL Captcha] 🎯 ĐÃ THẲNG ĐỨNG HOÀN TOÀN (0°)! Bấm Submit ngay...", "color: #00e676; font-weight: bold;");
        break;
      }

      if (stepsMod <= 4 && btnLeft) {
        clickTam(btnLeft);
      } else if (btnRight) {
        clickTam(btnRight);
      } else if (btnLeft) {
        clickTam(btnLeft);
      }

      await ngu(250);
    }

    await ngu(300);

    // Click nút Submit
    console.log("%c[SFL Captcha] 🚀 Gửi kết quả Submit...", "color: #00e676; font-weight: bold;");
    clickTam(btnSubmit);
    await ngu(600);

    await xuLyNhanThuongVaDong();
    return true;
  }

  // ═══════ Giải Captcha Kéo Hình Jigsaw Puzzle ("Drag the crop into the empty slot") ═══════
  async function giaiPuzzleDragCaptcha(doc) {
    console.log("%c[SFL Captcha] 🧩 Bắt đầu giải Captcha Kéo Ghép Hình (Puzzle Drag Challenge)...", "color: #00bcd4; font-weight: bold; font-size: 14px;");
    S.hanhDongCuoi = "🧩 Đang giải Captcha kéo ghép hình...";

    await ngu(300);

    // ── BƯỚC 1: THỬ GIẢI QUA MAIN WORLD BRIDGE (Độ chính xác 100% nhờ React Fiber) ──
    try {
      const bridgeRes = await giaiPuzzleQuaBridge(2500);
      if (bridgeRes && bridgeRes.success) {
        console.log("%c[SFL Captcha] 🚀 Bridge giải Puzzle Drag thành công!", "color: #00e676; font-weight: bold;");
        await ngu(500);
        await xuLyNhanThuongVaDong();
        return true;
      }
    } catch (_eBridge) {}

    // ── BƯỚC 2: NẾU BRIDGE CHƯA XONG -> GIẢI TRỰC TIẾP TRÊN CONTENT SCRIPT ──
    const modal = timModalHienThi(doc, ["drag the crop", "empty slot", "drag", "puzzle", "quick check", "ranura", "slot", "kéo", "lọ", "lỗ"]) || doc.body;
    if (!modal) return false;

    // Tìm canvas
    const canvas = modal.querySelector("canvas") || doc.querySelector("canvas");
    if (canvas && xemPhanTuRanh(canvas)) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const CANVAS_WIDTH = canvas.width || 300;
        const CANVAS_HEIGHT = canvas.height || 150;
        const scaleX = rect.width / CANVAS_WIDTH;
        const scaleY = rect.height / CANVAS_HEIGHT;

        let targetX = 0;
        let targetY = 0;
        let pieceX = 15;
        let pieceY = 60;
        let found = false;

        // A. Quét từ React Fiber hooks (PuzzleDragGame: Hook 5 là piecePosRef, Hook 9 là target)
        try {
          for (const k in canvas) {
            if (k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")) {
              let cur = canvas[k];
              while (cur && !found) {
                let hook = cur.memoizedState;
                while (hook) {
                  const val = hook.memoizedState;
                  if (val && typeof val === "object" && !val.current && typeof val.x === "number" && typeof val.y === "number") {
                    if (val.x >= 120) {
                      targetX = val.x;
                      targetY = val.y;
                      found = true;
                    }
                  }
                  if (val && typeof val === "object" && val.current && typeof val.current.x === "number" && typeof val.current.y === "number") {
                    pieceX = val.current.x;
                    pieceY = val.current.y;
                  }
                  hook = hook.next;
                }
                cur = cur.return;
              }
            }
          }
        } catch (_e) {}

        // B. Quét pixel trực tiếp trên Canvas nếu chưa tìm thấy qua Fiber
        if (!found || targetX === 0) {
          try {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
              const data = imgData.data;
              let silMinX = CANVAS_WIDTH, silMaxX = 0, silMinY = CANVAS_HEIGHT, silMaxY = 0;
              let count = 0;

              for (let y = 5; y < CANVAS_HEIGHT - 5; y++) {
                for (let x = 120; x < CANVAS_WIDTH - 5; x++) {
                  const idx = (y * CANVAS_WIDTH + x) * 4;
                  const r = data[idx];
                  const g = data[idx + 1];
                  const b = data[idx + 2];
                  const a = data[idx + 3];

                  // Silhouette màu tối #3e2731 (r=62, g=39, b=49)
                  if (a > 150 && ((Math.abs(r - 62) <= 30 && Math.abs(g - 39) <= 30 && Math.abs(b - 49) <= 30) || (r < 75 && g < 55 && b < 65))) {
                    if (x < silMinX) silMinX = x;
                    if (x > silMaxX) silMaxX = x;
                    if (y < silMinY) silMinY = y;
                    if (y > silMaxY) silMaxY = y;
                    count++;
                  }
                }
              }

              if (count >= 10) {
                targetX = silMinX;
                targetY = silMinY;
                found = true;
              }

              // Quét vị trí piece ở nửa bên trái
              let pMinY = CANVAS_HEIGHT, pCount = 0;
              for (let y = 5; y < CANVAS_HEIGHT - 5; y++) {
                for (let x = 5; x < 90; x++) {
                  const idx = (y * CANVAS_WIDTH + x) * 4;
                  if (data[idx + 3] > 80) {
                    if (y < pMinY) pMinY = y;
                    pCount++;
                  }
                }
              }
              if (pCount > 10) {
                pieceY = pMinY;
              }
            }
          } catch (_e2) {}
        }

        if (!found || targetX === 0) {
          targetX = 210;
          targetY = 60;
        }

        console.log(`%c[SFL Captcha] 🎯 Ghép Puzzle: Mảnh (${pieceX}, ${pieceY}) -> Đích (${targetX}, ${targetY})`, "color: #ff9800; font-weight: bold;");

        // Tâm mảnh ghép 36px / 2 = 18px
        const PIECE_HALF = 18;
        const startClientX = rect.left + (pieceX + PIECE_HALF) * scaleX;
        const startClientY = rect.top + (pieceY + PIECE_HALF) * scaleY;
        const endClientX = rect.left + (targetX + PIECE_HALF) * scaleX;
        const endClientY = rect.top + (targetY + PIECE_HALF) * scaleY;

        const view = doc.defaultView || window;
        const downOpts = {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: view,
          clientX: startClientX,
          clientY: startClientY,
          pageX: startClientX + (view.scrollX || 0),
          pageY: startClientY + (view.scrollY || 0),
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          pressure: 0.5,
          buttons: 1,
          which: 1,
          button: 0,
        };

        // 1. Pointer Down
        canvas.dispatchEvent(new PointerEvent("pointerover", { ...downOpts, buttons: 0 }));
        canvas.dispatchEvent(new PointerEvent("pointerenter", { ...downOpts, buttons: 0 }));
        canvas.dispatchEvent(new PointerEvent("pointerdown", downOpts));
        canvas.dispatchEvent(new MouseEvent("mousedown", downOpts));
        kichHoatReactProps(canvas);

        await ngu(80);

        // 2. Pointer Move (16 bước di chuyển mượt mà)
        const stepsCount = 16;
        for (let s = 1; s <= stepsCount; s++) {
          const curX = startClientX + (endClientX - startClientX) * (s / stepsCount);
          const curY = startClientY + (endClientY - startClientY) * (s / stepsCount);
          const moveOpts = { ...downOpts, clientX: curX, clientY: curY, pageX: curX + (view.scrollX || 0), pageY: curY + (view.scrollY || 0) };
          canvas.dispatchEvent(new PointerEvent("pointermove", moveOpts));
          doc.dispatchEvent(new PointerEvent("pointermove", moveOpts));
          view.dispatchEvent(new PointerEvent("pointermove", moveOpts));
          canvas.dispatchEvent(new MouseEvent("mousemove", moveOpts));
          await ngu(18);
        }

        // 3. Pointer Up & Drop
        const upOpts = { ...downOpts, clientX: endClientX, clientY: endClientY, buttons: 0, pressure: 0 };
        canvas.dispatchEvent(new PointerEvent("pointerup", upOpts));
        doc.dispatchEvent(new PointerEvent("pointerup", upOpts));
        view.dispatchEvent(new PointerEvent("pointerup", upOpts));
        canvas.dispatchEvent(new MouseEvent("mouseup", upOpts));
        canvas.dispatchEvent(new MouseEvent("click", upOpts));
        kichHoatReactProps(canvas);

        await ngu(500);
        console.log("%c[SFL Captcha] 🚀 Đã thả mảnh ghép vào đúng ô bóng!", "color: #00e676; font-weight: bold;");
      }
    } else {
      // ── BƯỚC 3: XỬ LÝ DOM DRAG & DROP (Nếu Captcha dùng thẻ DOM kéo thả) ──
      const draggable = modal.querySelector("[draggable='true'], div[class*='cursor-grab'], img[class*='cursor-grab'], div[class*='touch-none'], img");
      const dropzone = modal.querySelector("div[class*='dashed'], div[class*='slot'], div[class*='border'], div[class*='target'], div[class*='empty']");

      if (draggable && dropzone && xemPhanTuRanh(draggable) && xemPhanTuRanh(dropzone)) {
        console.log("%c[SFL Captcha] 🎯 Phát hiện DOM Drag & Drop: Kéo vật phẩm vào ô đích...", "color: #00bcd4; font-weight: bold;");
        const rStart = draggable.getBoundingClientRect();
        const rEnd = dropzone.getBoundingClientRect();
        const startX = rStart.left + rStart.width / 2;
        const startY = rStart.top + rStart.height / 2;
        const endX = rEnd.left + rEnd.width / 2;
        const endY = rEnd.top + rEnd.height / 2;

        const view = doc.defaultView || window;
        const downOpts = { bubbles: true, cancelable: true, composed: true, view, clientX: startX, clientY: startY, buttons: 1, pointerId: 1, pointerType: "mouse" };

        draggable.dispatchEvent(new PointerEvent("pointerdown", downOpts));
        draggable.dispatchEvent(new MouseEvent("mousedown", downOpts));

        // HTML5 Drag Events
        try {
          const dt = new DataTransfer();
          draggable.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: dt }));
          dropzone.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
          dropzone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
          dropzone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
          draggable.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, dataTransfer: dt }));
        } catch (_eDrag) {}

        const upOpts = { ...downOpts, clientX: endX, clientY: endY, buttons: 0 };
        dropzone.dispatchEvent(new PointerEvent("pointerup", upOpts));
        dropzone.dispatchEvent(new MouseEvent("mouseup", upOpts));
        dropzone.dispatchEvent(new MouseEvent("click", upOpts));
        await ngu(500);
      }
    }

    await xuLyNhanThuongVaDong();
    return true;
  }

  // ═══════ Giải Captcha Rương Kho Báu ("Tap the chest to open it") Chuẩn Xác Tuyệt Đối ═══════
  async function giaiTreasureChest(doc) {
    console.log("%c[SFL Captcha] 📦 Đang mở rương kho báu...", "color: #00bcd4; font-weight: bold; font-size: 13px;");
    S.hanhDongCuoi = "📦 Đang mở rương kho báu...";

    // ── GIAI ĐOẠN 1: TÌM VÀ CLICK DUY NHẤT VÀO ẢNH RƯƠNG TRONG MODAL ──
    for (let tapLoop = 0; tapLoop < 8; tapLoop += 1) {
      let modalChest = null;
      for (const d of layTaiLieuGame()) {
        modalChest = timModalHienThi(d, ["tap the chest", "chest to open", "tap to open", "rương"]);
        if (modalChest) break;
      }

      if (!modalChest) {
        console.log("%c[SFL Captcha] 🗝️ Rương đã mở! Đang chờ nhận quà...", "color: #4caf50; font-weight: bold;");
        break;
      }

      // TÌM CHÍNH XÁC THẺ ẢNH RƯƠNG (ChestCaptcha.tsx: img.absolute w-16 với onClick onOpen)
      // TUYỆT ĐỐI KHÔNG CLICK VÀO BACKGROUND HAY CONTAINER DIV (vì container có onClick={miss})!
      let chestImg = null;
      const imgsInModal = modalChest.querySelectorAll("img");
      for (const img of imgsInModal) {
        if (!xemPhanTuRanh(img)) continue;
        const cls = (img.className || "").toLowerCase();
        const st = (img.getAttribute("style") || "").toLowerCase();
        const src = (img.getAttribute("src") || img.src || "").toLowerCase();

        // Bỏ qua ảnh nền full width
        if (cls.includes("w-full") && !cls.includes("absolute") && !st.includes("perspective")) continue;

        if (
          cls.includes("absolute") ||
          st.includes("perspective") ||
          st.includes("skew") ||
          src.includes("treasure_chest") ||
          src.includes("synced") ||
          src.includes("treasure")
        ) {
          chestImg = img;
          break;
        }
      }

      if (!chestImg) {
        const relDiv = modalChest.querySelector("div.relative");
        if (relDiv) {
          const relImgs = relDiv.querySelectorAll("img");
          if (relImgs.length >= 2 && xemPhanTuRanh(relImgs[1])) {
            chestImg = relImgs[1];
          }
        }
      }

      if (chestImg) {
        console.log("%c[SFL Captcha] 🗝️ Click chuẩn xác vào ảnh Rương kho báu!", "color: #00bcd4; font-weight: bold;");
        clickTam(chestImg);
      }

      await ngu(400);
    }

    await ngu(800);

    // ── GIAI ĐOẠN 2: BẤM NÚT NHẬN THƯỞNG (CLAIM / CONTINUE / SWEET) ──
    let daBamClaim = false;
    for (let loop = 0; loop < 20; loop += 1) {
      for (const d of layTaiLieuGame()) {
        const modalReward = timModalHienThi(d, ["claim", "reward", "congratulations", "you found", "sweet", "awesome", "woohoo", "continue"]) || d;
        const cacNut = modalReward.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']");
        for (const btn of cacNut) {
          if (!xemPhanTuRanh(btn)) continue;
          const txt = (btn.textContent || "").trim().toLowerCase();
          if (txt.includes("tap the chest") || txt.includes("chest to open") || txt.includes("stop the")) continue;

          const laNutNhan =
            txt === "claim" || txt.includes("claim") ||
            txt === "continue" || txt.includes("continue") ||
            txt === "tiếp tục" || txt.includes("tiếp tục") ||
            txt === "nhận" || txt.includes("nhận thưởng") ||
            txt === "sweet!" || txt.includes("sweet") ||
            txt === "awesome!" || txt.includes("awesome") ||
            txt === "woohoo!" || txt.includes("woohoo") ||
            txt === "open" || txt === "mở" ||
            txt === "close" || txt === "đóng" || txt === "ok" ||
            txt === "got it" || txt.includes("got it");

          if (laNutNhan) {
            console.log(`%c[SFL Captcha] 🎁 Bấm nút nhận thưởng: "${txt}"`, "color: #00e676; font-weight: bold;");
            clickTam(btn);
            daBamClaim = true;
            await ngu(400);
            break;
          }
        }
        if (daBamClaim) break;
      }

      if (daBamClaim) {
        await ngu(300);
        if (!isCaptchaOpen()) break;
        daBamClaim = false;
      }

      await ngu(250);
    }

    await dongPopupCaptcha();
    return true;
  }

  // Giải Popup Claim thông thường
  async function giaiPopupClaim(doc) {
    if (isCaptchaOpen()) return false;
    console.log("[SFL Captcha] 🎁 Đang xử lý Popup Nhận thưởng...");
    await ngu(250);

    for (const d of layTaiLieuGame()) {
      const modal = timModalHienThi(d, ["claim", "reward", "congratulations", "you found", "sweet", "awesome", "woohoo"]);
      if (!modal) continue;
      const cacNut = modal.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']");
      for (const btn of cacNut) {
        if (!xemPhanTuRanh(btn)) continue;
        const txt = (btn.textContent || "").trim().toLowerCase();
        if (txt.includes("tap the chest") || txt.includes("chest to open")) continue;
        const laNutClaim =
          txt === "claim" || txt.includes("claim") ||
          txt === "continue" || txt.includes("continue") ||
          txt === "tiếp tục" || txt.includes("tiếp tục") ||
          txt === "sweet!" || txt.includes("sweet") ||
          txt === "awesome!" || txt.includes("awesome") ||
          txt === "woohoo!" || txt.includes("woohoo");
        if (laNutClaim) {
          clickTam(btn);
          await ngu(300);
        }
      }
    }

    await dongPopupCaptcha();
    return true;
  }

  // Điều phối giải Captcha
  async function kiemTraVaGiaiCaptcha() {
    if (!isCaptchaOpen() && !isCaptchaLocked()) return true;

    // Chiếm khóa ưu tiên cao nhất
    if (typeof S.xinKhoa === "function" && !S.xinKhoa("captcha")) {
      return false;
    }

    dangBan = true;
    S.__captchaActive = true;

    // ── NẾU TÀI KHOẢN ĐANG BỊ KHÓA QUICK CHECK DO TRƯỢT 2 LẦN: ĐÓNG BĂNG 100% VÀ ĐẾM NGƯỢC ──
    if (isCaptchaLocked()) {
      while (isCaptchaLocked()) {
        const lockUntil = layThoiGianKhoaCaptcha();
        const remainingSec = Math.max(1, Math.ceil((lockUntil - Date.now()) / 1000));
        const phut = Math.floor(remainingSec / 60);
        const giay = remainingSec % 60;
        const timeStr = `${phut}:${giay < 10 ? "0" : ""}${giay}`;

        console.log(
          `%c[SFL Captcha] 🔒 TÀI KHOẢN ĐANG BỊ TẠM KHÓA QUICK CHECK DO TRƯỢT 2 LẦN (${timeStr})! Đóng băng 100% tất cả luồng...`,
          "color: #fff; background: #d32f2f; font-weight: bold; font-size: 13px; padding: 3px 8px; border-radius: 4px;"
        );
        S.hanhDongCuoi = `🔒 Tạm khóa Quick Check (${timeStr})...`;
        await ngu(1000);
      }

      console.log("%c[SFL Captcha] 🔓 ĐÃ HẾT THỜI GIAN TẠM KHÓA QUICK CHECK! Chuẩn bị kiểm tra minigame mới...", "color: #00e676; font-weight: bold; font-size: 14px;");
      try {
        localStorage.removeItem("captcha.lockedUntil");
      } catch (_e) {}
      await ngu(1500);
    }

    console.log("%c[SFL Captcha] 🚨 PHÁT HIỆN CAPTCHA! Tạm dừng mọi luồng, chờ 2 giây để giao diện ổn định rồi giải...", "color: #ff3838; font-weight: bold; font-size: 14px;");

    // Đợi 2 giây để modal/popup hiển thị và render đầy đủ React Fiber trước khi bắt đầu giải
    await ngu(2000);

    if (!isCaptchaOpen()) {
      return true;
    }

    try {
      const taiLieu = layTaiLieuGame();
      let daGiai = false;

      for (const doc of taiLieu) {
        if (!doc || !doc.body) continue;

        // 1. Kiểm tra Captcha Xoay Hình (Rotate the item until it is upright)
        const txtBody = (doc.body.textContent || "").toLowerCase();
        const coRotate =
          txtBody.includes("rotate the item") ||
          txtBody.includes("until it is upright") ||
          (txtBody.includes("rotate") && txtBody.includes("upright")) ||
          (txtBody.includes("quick check!") && (txtBody.includes("farming") || txtBody.includes("challenge") || txtBody.includes("rotate")) && !doc.querySelector("canvas"));

        if (coRotate) {
          daGiai = await giaiRotateCaptcha(doc);
          if (daGiai) break;
        }

        // 2. Kiểm tra Captcha Kéo Ghép Hình (Puzzle Drag Challenge)
        const coPuzzle =
          txtBody.includes("drag the crop") ||
          txtBody.includes("empty slot") ||
          txtBody.includes("ranura vacía") ||
          txtBody.includes("slot kosong") ||
          txtBody.includes("将作物拖到空槽中") ||
          txtBody.includes("kéo cây") ||
          txtBody.includes("kéo thả") ||
          (txtBody.includes("drag") && (txtBody.includes("slot") || txtBody.includes("crop") || txtBody.includes("item") || txtBody.includes("empty") || txtBody.includes("lọ") || txtBody.includes("lỗ"))) ||
          (txtBody.includes("quick check!") && !!doc.querySelector("canvas"));

        if (coPuzzle) {
          daGiai = await giaiPuzzleDragCaptcha(doc);
          if (daGiai) break;
        }

        // 3. Kiểm tra Grid 16 ô (Stop the Goblins / Moon Seeker / Skeleton / Zombie)
        const wraps = doc.querySelectorAll("div.flex.flex-wrap.justify-center.items-center, div.flex.flex-wrap");
        let coGrid16 = false;
        for (const w of wraps) {
          if (!xemPhanTuRanh(w)) continue;
          const cellCount = Array.from(w.children).filter(
            (el) => el && el.tagName === "DIV" && el.classList?.contains("cursor-pointer"),
          ).length;
          if (cellCount >= 16) {
            coGrid16 = true;
            daGiai = await giaiGridCaptcha(doc, w);
            break;
          }
        }

        // NẾU LÀ GRID 16 Ô: Dừng tại đây, TUYỆT ĐỐI KHÔNG rơi vào xử lý Popup Claim hay bấm nút Close!
        if (coGrid16) {
          break;
        }

        // 4. Kiểm tra Rương kho báu ("Tap the chest to open it" / "Tap to open")
        const coRuong =
          txtBody.includes("tap the chest") ||
          txtBody.includes("chest to open") ||
          txtBody.includes("tap to open") ||
          (txtBody.includes("open") && txtBody.includes("chest")) ||
          txtBody.includes("mở rương");

        if (coRuong) {
          daGiai = await giaiTreasureChest(doc);
          break;
        }

        // 4. Xử lý popup claim thông thường (chỉ chạy khi không phải Captcha challenge)
        if (!isCaptchaOpen()) {
          daGiai = await giaiPopupClaim(doc);
          if (daGiai) break;
        }
      }

      // Đợi modal đóng hẳn với kiểm tra polling
      for (let i = 0; i < 15; i += 1) {
        await ngu(200);
        if (!isCaptchaOpen()) {
          console.log("%c[SFL Captcha] ✔️ ĐÃ GIẢI XONG VÀ ĐÓNG CAPTCHA HOÀN TOÀN!", "color: #00e676; font-weight: bold; font-size: 14px;");
          return true;
        }
      }

      // Nếu Captcha vẫn còn hiển thị, trả về false để hệ thống điều phối TIẾP TỤC ĐÓNG BĂNG, không chạy luồng khác!
      if (isCaptchaOpen()) {
        console.log("%c[SFL Captcha] ⚠️ Captcha vẫn chưa đóng. Tiếp tục giữ khóa và đóng băng toàn bộ luồng...", "color: #ff9800; font-weight: bold;");
        return false;
      }

      return true;
    } catch (err) {
      console.error("[SFL Captcha] Lỗi trong quá trình giải Captcha:", err);
      return false;
    } finally {
      dangBan = false;
      S.__captchaActive = false;
      S.__captchaInterrupted = false;
      if (typeof S.nhaKhoa === "function") S.nhaKhoa("captcha");
    }
  }

  // ═══════ BỘ GIÁM SÁT REAL-TIME ĐỘ NHẠY CAO (XUẤT HIỆN LÀ GIẢI NGAY) ═══════
  let dangGiaiNhanh = false;

  async function tuDongGiaiNgay() {
    if (dangGiaiNhanh || dangBan) return;
    if (!isCaptchaOpen()) return;

    dangGiaiNhanh = true;
    S.__captchaInterrupted = true;
    console.log("%c[SFL Captcha] ⚡ Phát hiện Captcha xuất hiện! Kích hoạt giải ngay lập tức...", "color: #ff3838; font-weight: bold; font-size: 14px;");

    try {
      await kiemTraVaGiaiCaptcha();
    } catch (err) {
      console.error("[SFL Captcha] Lỗi giải nhanh Captcha:", err);
    } finally {
      dangGiaiNhanh = false;
      S.__captchaActive = false;
      S.__captchaInterrupted = false;
      if (typeof S.nhaKhoa === "function") S.nhaKhoa("captcha");
    }
  }

  // 1. Quét liên tục mỗi 300ms
  setInterval(() => {
    if (!dangGiaiNhanh && !dangBan && isCaptchaOpen()) {
      tuDongGiaiNgay();
    }
  }, 300);

  // 2. Bắt ngay lập tức khi DOM thêm phần tử Captcha modal
  try {
    const observer = new MutationObserver(() => {
      if (!dangGiaiNhanh && !dangBan && isCaptchaOpen()) {
        tuDongGiaiNgay();
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch (_e) {}

  // Xuất bản sang không gian tên SFL
  S.isCaptchaOpen = isCaptchaOpen;
  S.isCaptchaLocked = isCaptchaLocked;
  S.layThoiGianKhoaCaptcha = layThoiGianKhoaCaptcha;
  S.kiemTraVaGiaiCaptcha = kiemTraVaGiaiCaptcha;
  S.tuDongGiaiNgay = tuDongGiaiNgay;

})(window.SFL = window.SFL || {});
