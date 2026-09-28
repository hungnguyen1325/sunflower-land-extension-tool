// ═══════════════════════════════════════════════════════════════════
// LUỒNG BAY KHINH KHÍ CẦU — LOVE ISLAND (balloon.js) v1.1
// Tự động nhận diện khung giờ bay và click "Let's go" khi đến giờ
// Bộ giám sát nền độc lập, không nằm trong vòng lặp scheduler
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const CFG = {
    KIEM_TRA_INTERVAL_MS: 60_000,    // Kiểm tra lịch mỗi 60s
    DELAY_SAU_MO_CUA_MS: 2_000,      // Chờ UI ổn định sau khi phát hiện giờ mở
    CHO_MODAL_MS:         6_000,      // Tối đa 6s chờ modal xuất hiện
    DELAY_CLICK_MS:       1_200,      // Giãn cách giữa các bước click
  };

  // ── HELPERS DOM ───────────────────────────────────────────────────

  function layTaiLieuGame() {
    const out = [], seen = new Set();
    const add = (d) => { if (!d || seen.has(d)) return; seen.add(d); out.push(d); };
    const stack = [document];
    add(document);
    while (stack.length) {
      const doc = stack.pop();
      let iframes;
      try { iframes = doc.querySelectorAll("iframe"); } catch (_e) { continue; }
      for (let i = 0; i < iframes.length; i++) {
        try {
          const idoc = iframes[i].contentDocument;
          if (idoc) { add(idoc); stack.push(idoc); }
        } catch (_e) {}
      }
    }
    return out;
  }

  function xemPhanTuRanh(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const v = el.ownerDocument?.defaultView || window;
    let s;
    try { s = v.getComputedStyle(el); } catch (_e) { return false; }
    return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
  }

  function kichHoatReact(el) {
    if (!el) return;
    for (const k in el) {
      if (!k.startsWith("__reactProps$") && !k.startsWith("__reactEventHandlers$")) continue;
      const p = el[k];
      if (!p) continue;
      const fakeEv = { stopPropagation: () => {}, preventDefault: () => {}, target: el, currentTarget: el, button: 0 };
      if (typeof p.onPointerDown === "function") try { p.onPointerDown(fakeEv); } catch (_e) {}
      if (typeof p.onClick      === "function") try { p.onClick(fakeEv);      } catch (_e) {}
    }
  }

  function clickTam(el) {
    if (!el) return false;
    const v = el.ownerDocument?.defaultView || window;
    try { v?.focus?.(); } catch (_e) {}
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const base = {
      bubbles: true, cancelable: true, composed: true, view: v,
      clientX: cx, clientY: cy, screenX: cx, screenY: cy,
      pageX: cx + (v.scrollX || 0), pageY: cy + (v.scrollY || 0),
      which: 1, button: 0,
    };
    try { el.focus?.({ preventScroll: true }); } catch (_e) {}
    try {
      el.dispatchEvent(new PointerEvent("pointerover",  { ...base, pointerId: 1, pointerType: "mouse" }));
      el.dispatchEvent(new PointerEvent("pointerdown",  { ...base, buttons: 1, pointerId: 1, pointerType: "mouse", isPrimary: true, pressure: 0.5 }));
      el.dispatchEvent(new PointerEvent("pointerup",    { ...base, buttons: 0, pointerId: 1, pointerType: "mouse", isPrimary: true }));
    } catch (_e) {}
    el.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mouseup",   { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("click",     { ...base, buttons: 0 }));
    try { el.click?.(); } catch (_e) {}
    kichHoatReact(el);
    if (el.parentElement) kichHoatReact(el.parentElement);
    return true;
  }

  // ── ĐỌC LỊCH BAY TRỰC TIẾP TỪ GAME SERVICE ──────────────────────
  // Bridge KHÔNG extract floatingIsland, nên phải đọc thẳng từ XState

  function layGameState() {
    // Cách 1: qua page-bridge đã inject gameService vào window
    for (const doc of layTaiLieuGame()) {
      try {
        const v = doc.defaultView || window;
        const svc = v.gameService;
        if (!svc) continue;
        const snap = svc.getSnapshot?.() || svc.state;
        const ctx = snap?.context || {};
        const st = ctx.state || ctx.gameState || ctx;
        if (st?.floatingIsland) return st;
      } catch (_e) {}
    }
    // Cách 2: tìm trong React fiber
    for (const doc of layTaiLieuGame()) {
      try {
        const root = doc.getElementById("root");
        if (!root) continue;
        // Duyệt fiber để tìm gameService
        let fiber = root._reactFiber || root[Object.keys(root).find(k => k.startsWith("__reactFiber"))];
        let depth = 0;
        while (fiber && depth++ < 200) {
          const mi = fiber.memoizedState;
          if (mi?.queue?.getSnapshot) {
            try {
              const snap = mi.queue.getSnapshot();
              if (snap?.context?.state?.floatingIsland) return snap.context.state;
            } catch (_e) {}
          }
          fiber = fiber.child || fiber.sibling || fiber.return;
        }
      } catch (_e) {}
    }
    return null;
  }

  function layEventDangActive() {
    try {
      // Ưu tiên 1: đọc từ S.gameState nếu bridge đã extend
      const s1 = S.gameState?.floatingIsland?.schedule || S.userData?.floatingIsland?.schedule;
      if (Array.isArray(s1)) {
        const now = Date.now();
        const ev = s1.find(ev => now >= ev.startAt && now <= ev.endAt);
        if (ev) return ev;
      }

      // Ưu tiên 2: đọc trực tiếp từ XState
      const st = layGameState();
      const s2 = st?.floatingIsland?.schedule;
      if (Array.isArray(s2)) {
        const now = Date.now();
        const ev = s2.find(ev => now >= ev.startAt && now <= ev.endAt);
        if (ev) return ev;
      }
    } catch (_e) {}
    return null;
  }

  function layToanBoLich() {
    try {
      const s1 = S.gameState?.floatingIsland?.schedule || S.userData?.floatingIsland?.schedule;
      if (Array.isArray(s1) && s1.length > 0) return s1;
      const st = layGameState();
      return st?.floatingIsland?.schedule || [];
    } catch (_e) { return []; }
  }

  // ── TÌM WIDGET COUNTDOWN TRÊN HUD ────────────────────────────────
  // FloatingIslandCountdown.tsx render ButtonPanel id="test-stream"
  // hiển thị text "Mystery Island" (key: floatingIsland.isLive)

  function timWidgetCountdown() {
    for (const doc of layTaiLieuGame()) {
      if (!doc?.body) continue;

      // Cách 1: id chuẩn từ source code
      const w = doc.getElementById("test-stream");
      if (w && xemPhanTuRanh(w)) return { element: w, doc };

      // Cách 2: tìm panel chứa text "Mystery Island"
      const allEls = doc.querySelectorAll("div, button, span");
      for (const el of allEls) {
        if (!xemPhanTuRanh(el)) continue;
        const txt = (el.textContent || "").trim();
        if (txt.includes("Mystery Island")) {
          // Tìm phần tử cha gần nhất có thể click
          const clickable = el.closest("button, [role='button'], div.cursor-pointer") || el;
          return { element: clickable, doc };
        }
      }
    }
    return null;
  }

  // ── TÌM NÚT "LET'S GO" TRONG MODAL ──────────────────────────────
  // Source: hotAirBalloon.letsGo = "Let's go"
  // Nút chỉ enabled khi isActive = true

  function timNutLetsGo() {
    const keywords = ["let's go", "lets go", "bay thôi", "đi thôi"];
    for (const doc of layTaiLieuGame()) {
      if (!doc?.body) continue;
      const buttons = doc.querySelectorAll("button, [role='button']");
      for (const btn of buttons) {
        if (!xemPhanTuRanh(btn)) continue;
        if (btn.disabled || btn.hasAttribute("disabled")) continue;
        const txt = (btn.textContent || "").trim().toLowerCase();
        if (keywords.some(k => txt.includes(k))) {
          return { element: btn, doc };
        }
      }
    }
    return null;
  }

  // ── KIỂM TRA MODAL ĐÃ XUẤT HIỆN ─────────────────────────────────
  // Modal chứa text "Ready to fly?" hoặc "Flight times are limited"

  function modalBalloonDangMo() {
    for (const doc of layTaiLieuGame()) {
      if (!doc?.body) continue;
      const txt = (doc.body.textContent || "").toLowerCase();
      if (txt.includes("ready to fly") || txt.includes("flight times") || txt.includes("love charm")) {
        // Xác nhận đây là modal thật (có role=dialog)
        const dialog = doc.querySelector("[role='dialog'], [role='modal'], div.fixed.inset-0");
        if (dialog && xemPhanTuRanh(dialog)) return true;
        // Fallback: có text đặc trưng là đủ
        return true;
      }
    }
    return false;
  }

  // ── COOLDOWN THEO SESSION ─────────────────────────────────────────

  function sessionKey(ev) { return `sfl_balloon_flown_${ev.startAt}`; }
  function daBayRoi(ev) {
    try { return localStorage.getItem(sessionKey(ev)) === "1"; } catch (_e) { return false; }
  }
  function ghiDaBay(ev) {
    try {
      localStorage.setItem(sessionKey(ev), "1");
      const ttl = Math.max(0, ev.endAt - Date.now()) + 120_000;
      setTimeout(() => { try { localStorage.removeItem(sessionKey(ev)); } catch (_e) {} }, ttl);
    } catch (_e) {}
  }

  // ── LUỒNG CHÍNH ───────────────────────────────────────────────────

  async function thucHienBay(ev) {
    console.log(
      `%c[SFL 🎈 Balloon] ✅ Love Island MỞ CỬA! ${new Date(ev.startAt).toLocaleTimeString()} → ${new Date(ev.endAt).toLocaleTimeString()}`,
      "color: #ff69b4; font-weight: bold; font-size: 13px;"
    );

    await ngu(CFG.DELAY_SAU_MO_CUA_MS);

    // BƯỚC 1 — Click widget countdown "Mystery Island" trên HUD
    let buoc1OK = false;
    for (let i = 0; i < 4 && !buoc1OK; i++) {
      const widget = timWidgetCountdown();
      if (widget) {
        console.log("[SFL 🎈 Balloon] 🖱️ Bước 1: Click widget 'Mystery Island' trên HUD...");
        clickTam(widget.element);
        buoc1OK = true;
      } else {
        console.log(`[SFL 🎈 Balloon] ⏳ Bước 1: Chưa thấy widget (${i + 1}/4), chờ 3s...`);
        await ngu(3000);
      }
    }

    if (!buoc1OK) {
      console.log("%c[SFL 🎈 Balloon] ⚠️ Không tìm thấy widget countdown. Bỏ qua lần này.", "color: #ff9800;");
      return false;
    }

    // BƯỚC 2 — Chờ modal HotAirBalloon xuất hiện
    console.log("[SFL 🎈 Balloon] ⏳ Bước 2: Chờ modal balloon mở...");
    const t0 = Date.now();
    while (Date.now() - t0 < CFG.CHO_MODAL_MS) {
      if (modalBalloonDangMo()) break;
      await ngu(400);
    }
    if (!modalBalloonDangMo()) {
      console.log("%c[SFL 🎈 Balloon] ⚠️ Modal không xuất hiện sau click. Bỏ qua.", "color: #ff9800;");
      return false;
    }

    // BƯỚC 3 — Click "Let's go"
    await ngu(CFG.DELAY_CLICK_MS);
    const nutLetsGo = timNutLetsGo();
    if (!nutLetsGo) {
      console.log("%c[SFL 🎈 Balloon] ⚠️ Nút 'Let's go' không tìm thấy hoặc bị disabled (ngoài giờ bay).", "color: #ff9800;");
      return false;
    }

    console.log("[SFL 🎈 Balloon] 🚀 Bước 3: Click 'Let's go'! Đang bay đến Love Island...");
    clickTam(nutLetsGo.element);
    await ngu(2000);

    ghiDaBay(ev);
    console.log(
      "%c[SFL 🎈 Balloon] 🎉 ĐÃ BAY LÊN LOVE ISLAND! Bot sẽ không bay lại trong phiên mở cửa này.",
      "color: #e91e63; font-weight: bold; font-size: 13px;"
    );
    return true;
  }

  // ── VÒNG GIÁM SÁT ─────────────────────────────────────────────────

  async function vongGiamSat() {
    console.log(
      "%c[SFL 🎈 Balloon] 🛫 Giám sát lịch bay Love Island đã khởi động! Kiểm tra mỗi 60s.",
      "color: #ff69b4; font-weight: bold;"
    );

    while (true) {
      try {
        const masterBat  = S.cauHinh?.masterBat !== undefined  ? !!S.cauHinh.masterBat : true;
        const balloonBat = S.cauHinh?.[23]       !== undefined ? !!S.cauHinh[23]       : true;

        if (!masterBat || !balloonBat) {
          await ngu(CFG.KIEM_TRA_INTERVAL_MS);
          continue;
        }

        // Refresh state mới nhất từ bridge
        if (typeof S.requestBridgeState === "function") {
          try { await S.requestBridgeState(1500); } catch (_e) {}
        }

        const ev = layEventDangActive();

        if (!ev) {
          // Log phiên tiếp theo mỗi 5 phút
          const lich = layToanBoLich();
          const now = Date.now();
          const next = lich.filter(e => e.startAt > now).sort((a, b) => a.startAt - b.startAt)[0];
          if (next) {
            const phut = Math.round((next.startAt - now) / 60000);
            if (phut <= 5 || phut % 30 === 0) {
              console.log(
                `%c[SFL 🎈 Balloon] 🕐 Phiên bay tiếp theo lúc ${new Date(next.startAt).toLocaleTimeString()} (còn ~${phut} phút)`,
                "color: #607d8b;"
              );
            }
          }
          await ngu(CFG.KIEM_TRA_INTERVAL_MS);
          continue;
        }

        if (daBayRoi(ev)) {
          const conLai = Math.max(0, Math.ceil((ev.endAt - Date.now()) / 60000));
          console.log(`%c[SFL 🎈 Balloon] ✈️ Đã bay rồi. Cửa đóng sau ~${conLai} phút.`, "color: #9c27b0;");
          await ngu(CFG.KIEM_TRA_INTERVAL_MS);
          continue;
        }

        await thucHienBay(ev);

      } catch (err) {
        console.error("[SFL 🎈 Balloon] Lỗi giám sát:", err);
      }

      await ngu(CFG.KIEM_TRA_INTERVAL_MS);
    }
  }

  // ── PUBLIC API ────────────────────────────────────────────────────

  /** Gọi thủ công: SFL.tickBalloon() */
  S.tickBalloon = async function () {
    const ev = layEventDangActive();
    if (!ev) { console.log("[SFL 🎈 Balloon] Love Island chưa mở cửa."); return; }
    if (daBayRoi(ev)) { console.log("[SFL 🎈 Balloon] Đã bay rồi trong phiên này."); return; }
    await thucHienBay(ev);
  };

  /** Kiểm tra trạng thái: SFL.balloonStatus() */
  S.balloonStatus = function () {
    const ev = layEventDangActive();
    const lich = layToanBoLich();
    const now = Date.now();
    if (!ev) {
      const next = lich.filter(e => e.startAt > now).sort((a, b) => a.startAt - b.startAt)[0];
      if (next) console.log(`[SFL 🎈 Balloon] 🔒 Đóng cửa. Phiên tiếp: ${new Date(next.startAt).toLocaleString()} → ${new Date(next.endAt).toLocaleString()}`);
      else      console.log("[SFL 🎈 Balloon] 🔒 Đóng cửa. Không có lịch bay trong tương lai.");
      return;
    }
    const flown = daBayRoi(ev);
    const conLai = Math.ceil((ev.endAt - now) / 60000);
    console.log(
      `[SFL 🎈 Balloon] ✅ ĐANG MỞ! Đến ${new Date(ev.endAt).toLocaleTimeString()} (còn ~${conLai} phút). ${flown ? "Đã bay ✈️" : "Chưa bay — sẽ bay ngay!"}`
    );
    if (!flown) {
      console.log("[SFL 🎈 Balloon] Gọi SFL.tickBalloon() để bay thủ công ngay bây giờ.");
    }
  };

  /** Force bay lại (xóa cooldown phiên này): SFL.balloonForce() */
  S.balloonForce = async function () {
    const ev = layEventDangActive();
    if (!ev) { console.log("[SFL 🎈 Balloon] Love Island chưa mở cửa."); return; }
    try { localStorage.removeItem(sessionKey(ev)); } catch (_e) {}
    console.log("[SFL 🎈 Balloon] Đã xóa cooldown. Đang bay...");
    await thucHienBay(ev);
  };

  /** Debug: in toàn bộ lịch bay: SFL.balloonSchedule() */
  S.balloonSchedule = function () {
    const lich = layToanBoLich();
    if (!lich.length) { console.log("[SFL 🎈 Balloon] Không có lịch bay nào."); return; }
    console.table(lich.map(ev => ({
      "Bắt đầu": new Date(ev.startAt).toLocaleString(),
      "Kết thúc": new Date(ev.endAt).toLocaleString(),
      "Trạng thái": Date.now() >= ev.startAt && Date.now() <= ev.endAt ? "✅ ĐANG MỞ" :
                    Date.now() < ev.startAt ? "🔒 Sắp tới" : "❌ Đã qua",
    })));
  };

  // ── KHỞI ĐỘNG ─────────────────────────────────────────────────────
  setTimeout(() => {
    if (window !== window.top && !document.querySelector("#root, [data-map-placement], canvas")) return;
    vongGiamSat();
  }, 15_000);

})(window.SFL = window.SFL || {});
