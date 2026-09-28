// ═══════════════════════════════════════════════════════════════════
// LUỒNG ĐÀO KHOÁNG SẢN & KHOAN DẦU (mining.js)
// Dựa vào Game Bridge để kiểm tra mỏ khoáng sẵn sàng và loại Cuốc tương ứng
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

  // Kiểm tra mỏ quặng có đang hồi phục (cooldown / disable) hay không.
  // - Mỏ đang hồi: có div .opacity-50/.opacity-40 bọc ảnh, text đếm giờ (2hrs 59mins, 1hr 9mins...),
  //   KHÔNG có cursor-pointer / hover:img-highlight.
  // - Mỏ sẵn sàng: có .cursor-pointer / .hover:img-highlight, không có opacity-50.
  function laQuangDangHoiPhuc(el, cacSrc, noiDung) {
    if (!el) return true;

    const coMoMo =
      !!el.querySelector(".opacity-50, [class*='opacity-50'], .opacity-40, [class*='opacity-40']") ||
      (el.className && typeof el.className === "string" && el.className.includes("opacity-50"));
    if (coMoMo) return true;

    const coDemGio = /\d+\s*(?:hrs?|mins?|secs?|hours?|m\b|s\b|h\b)|\d+:\d+/i.test(noiDung);
    if (coDemGio) return true;

    const coNutClick =
      !!el.querySelector(".cursor-pointer, [class*='cursor-pointer'], [class*='hover:img-highlight']") ||
      (el.classList && (el.classList.contains("cursor-pointer") || el.classList.contains("hover:img-highlight")));
    if (!coNutClick) return true;

    const laSrcHoi = cacSrc.some((s) =>
      s.includes("cooldown") || s.includes("recovering") || s.includes("depleted") || s.includes("empty_rock")
    );
    if (laSrcHoi) return true;

    return false;
  }

  // Quét toàn bộ map tìm các mỏ quặng SẴN SÀNG đào theo loại (bỏ qua mỏ đang hồi phục)
  function timMoKhoangDOM() {
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

        // Xác định loại mỏ (dùng nhiều pattern để bắt cả file .png / l2_ / hashed URL)
        let loai = null;
        if (cacSrc.some((s) => s.includes("crimstone") || s.includes("uklgriabaabxrujqvla4tbqba"))) loai = "crimstone";
        else if (cacSrc.some((s) => s.includes("sunstone"))) loai = "sunstone";
        else if (cacSrc.some((s) => s.includes("gold_small") || s.includes("gold_rock") || s.includes("l2_gold") || s.includes("gold.png") || s.includes("/gold/"))) loai = "gold";
        else if (cacSrc.some((s) => s.includes("iron_small") || s.includes("iron_rock") || s.includes("l2_iron") || s.includes("iron.png") || s.includes("/iron/"))) loai = "iron";
        else if (cacSrc.some((s) => s.includes("stone_small") || s.includes("stone_rock") || s.includes("l2_stone") || s.includes("stone.png") || s.includes("rock.png") || s.includes("/stone/"))) loai = "stone";
        else if (cacSrc.some((s) => s.includes("/resources/oil/") || s.includes("oil_reserve") || s.includes("uklgrqiaaabxrujqvla4tjy")) ||
          cacAnh.some((img) => (img.getAttribute("alt") || "").toLowerCase().includes("oil reserve"))) loai = "oil";
        if (!loai) continue;

        // Với mỏ dầu: phải có alt="Full oil reserve" và không bị mờ
        if (loai === "oil") {
          const coAltFull = cacAnh.some((img) => (img.getAttribute("alt") || "").toLowerCase().includes("full oil reserve"));
          const coMoMo =
            !!el.querySelector(".opacity-50, [class*='opacity-50'], .opacity-40") ||
            (el.className && typeof el.className === "string" && el.className.includes("opacity-50"));
          if (coMoMo || !coAltFull) continue;
        }

        // Bỏ qua mỏ đang hồi phục / đã cạn
        if (laQuangDangHoiPhuc(el, cacSrc, noiDung)) continue;

        const nutClick =
          el.querySelector(".cursor-pointer, [class*='cursor-pointer'], [class*='hover:img-highlight']") ||
          (el.classList && el.classList.contains("cursor-pointer") ? el : el);
        daThem.add(el);
        danhSach.push({ el: nutClick, loai, doc });
      }
    }
    return danhSach;
  }

  // Tìm nút "Mine"/"Đào" xác nhận trong modal
  function timNutDaoXacNhan(doc) {
    if (!doc) return null;
    const cacNut = doc.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']");
    for (const btn of cacNut) {
      if (!xemPhanTuRanh(btn)) continue;
      const txt = (btn.textContent || "").trim().toLowerCase();
      if ((txt === "mine" || txt === "đào" || txt.includes("collect")) && txt.length < 20) {
        return btn;
      }
    }
    return null;
  }

  // Chẩn đoán: đếm mỏ theo loại CÓ TÍNH cả đang hồi phục + lưu 1 mẫu element
  // để xem DOM thực tế khi tool "có cuốc nhưng không đào".
  function chanDoanMo() {
    const out = { theoLoai: {}, mau: [] };
    for (const doc of layTaiLieuGame()) {
      if (!doc || !doc.body) continue;
      const cacO = doc.querySelectorAll("[data-map-placement]");
      for (const el of cacO) {
        if (daThemCuaChanDoan.has(el) || !xemPhanTuRanh(el)) continue;
        daThemCuaChanDoan.add(el);
        const cacAnh = Array.from(el.querySelectorAll("img"));
        const cacSrc = cacAnh.map((i) => (i.getAttribute("src") || i.src || "").toLowerCase());
        let loai = null;
        if (cacSrc.some((s) => s.includes("crimstone") || s.includes("uklgriabaabxrujqvla4tbqba"))) loai = "crimstone";
        else if (cacSrc.some((s) => s.includes("sunstone"))) loai = "sunstone";
        else if (cacSrc.some((s) => s.includes("gold_small") || s.includes("gold_rock") || s.includes("l2_gold") || s.includes("gold.png") || s.includes("/gold/"))) loai = "gold";
        else if (cacSrc.some((s) => s.includes("iron_small") || s.includes("iron_rock") || s.includes("l2_iron") || s.includes("iron.png") || s.includes("/iron/"))) loai = "iron";
        else if (cacSrc.some((s) => s.includes("stone_small") || s.includes("stone_rock") || s.includes("l2_stone") || s.includes("stone.png") || s.includes("rock.png") || s.includes("/stone/"))) loai = "stone";
        else if (cacSrc.some((s) => s.includes("/resources/oil/") || s.includes("oil_reserve") || s.includes("uklgrqiaaabxrujqvla4tjy")) ||
          cacAnh.some((img) => (img.getAttribute("alt") || "").toLowerCase().includes("oil reserve"))) loai = "oil";
        if (!loai) continue;
        out.theoLoai[loai] = (out.theoLoai[loai] || 0) + 1;
        if (out.mau.length < 3) {
          out.mau.push({
            loai,
            className: String(el.className || ""), 
            src: cacSrc[0] || "", 
            txt: (el.textContent || "").trim().slice(0, 60),
            opacity50: !!el.querySelector(".opacity-50, [class*='opacity-50'], .opacity-40"),
            cursorPointer: !!el.querySelector(".cursor-pointer, [class*='cursor-pointer'], [class*='hover:img-highlight']") || (el.classList && (el.classList.contains("cursor-pointer") || el.classList.contains("hover:img-highlight"))),
          });
        }
      }
    }
    return out;
  }
  const daThemCuaChanDoan = new Set();

  async function tickMining() {
    if (dangBan) return false;
    dangBan = true;

    try {
      let state = null;
      if (typeof S.requestBridgeState === "function") {
        state = await S.requestBridgeState(1500);
      }

      const inv = state?.inventory || {};
      const pickaxes = {
        stone: Number(inv["Pickaxe"] || 0),
        iron: Number(inv["Stone Pickaxe"] || 0),
        gold: Number(inv["Iron Pickaxe"] || 0),
        crimstone: Number(inv["Gold Pickaxe"] || 0),
        sunstone: Number(inv["Gold Pickaxe"] || 0),
        oil: Number(inv["Oil Drill"] || 0),
      };

      // Cập nhật lại số công cụ thực tế từ Game Bridge (sau mỗi lần đào → TRỪ công cụ đã dùng)
      async function capNhatCuocTuBridge() {
        let st = null;
        if (typeof S.requestBridgeState === "function") {
          try { st = await S.requestBridgeState(800); } catch (_e) {}
        }
        const nv = st?.inventory || {};
        pickaxes.stone = Number(nv["Pickaxe"] || 0);
        pickaxes.iron = Number(nv["Stone Pickaxe"] || 0);
        pickaxes.gold = Number(nv["Iron Pickaxe"] || 0);
        pickaxes.crimstone = Number(nv["Gold Pickaxe"] || 0);
        pickaxes.sunstone = Number(nv["Gold Pickaxe"] || 0);
        pickaxes.oil = Number(nv["Oil Drill"] || 0);
      }

      // Tự động mua thêm công cụ khi hết — sau đó cập nhật lại cache
      async function muaThemCongCu() {
        if (typeof S.batchBuyToolsBridge !== "function") return false;
        console.log("[SFL Đào Khoáng] ⛏️ Hết cuốc đào -> Đang tự động mua thêm qua Game Bridge...");
        const res = await S.batchBuyToolsBridge(4000);
        if (res && res.ok) {
          await capNhatCuocTuBridge();
          return (res.crafted?.length || 0) > 0;
        }
        return false;
      }

      console.log(`%c[SFL Đào Khoáng] ⛏️ Cuốc: Đá (${pickaxes.stone}) | Sắt (${pickaxes.iron}) | Vàng (${pickaxes.gold}) | Dầu (${pickaxes.oil})`, "color: #607d8b; font-weight: bold;");

      let daDaoTong = 0;

      // Hàm kiểm tra nhanh Captcha
      async function kiemTraCaptchaMining() {
        if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) {
          console.log("%c[SFL Đào Khoáng] 🚨 GẶP CAPTCHA! Tạm dừng để giải ngay...", "color: #ff3838; font-weight: bold;");
          S.__captchaInterrupted = true;
          if (typeof S.kiemTraVaGiaiCaptcha === "function") {
            await S.kiemTraVaGiaiCaptcha();
          }
          await ngu(800);
          if (!S.isCaptchaOpen || !S.isCaptchaOpen()) {
            S.__captchaInterrupted = false;
            console.log("%c[SFL Đào Khoáng] 🔄 Đã giải xong Captcha! TIẾP TỤC đào khoáng...", "color: #4caf50; font-weight: bold;");
            return false; // Trả về false để TIẾP TỤC vòng lặp đào!
          }
          return true; // Không giải được mới break
        }
        return false;
      }

      // 1. Đào Đá (Stones)
      const soLanDaoTheoLoai = {
        stone: 3,
        iron: 4,
        gold: 4,
        crimstone: 4,
        sunstone: 4,
        oil: 1,
      };

      // Quét đi quét lại tối đa 6 lần; MỖI LẦN dùng danh sách mỏ TƯƠI MỚI
      // để KHÔNG bấm nhầm ô đã đào / ô vị trí đã render lại (hết nhấp nháy giữa các ô)
      const chanDoanBD = chanDoanMo();
      console.log(
        `%c[SFL Đào Khoáng] 🔎 Mỏ phát hiện trong DOM (kể cả đang hồi phục): ${Object.keys(chanDoanBD.theoLoai).map((k) => `${k}=${chanDoanBD.theoLoai[k]}`).join(", ") || "KHÔNG CÓ"}`,
        "color: #03a9f4; font-weight: bold;"
      );

      for (let vongQuet = 0; vongQuet < 6; vongQuet++) {
        if (await kiemTraCaptchaMining()) break;
        if (typeof S.isGoblinSwarm === "function" && S.isGoblinSwarm()) break;

        const quangSanSang = timMoKhoangDOM();
        if (quangSanSang.length === 0) {
          // Chẩn đoán khi "có cuốc nhưng không đào": DOM có mỏ mà lọc ra 0 mỏ sẵn sàng
          if (vongQuet === 0) {
            console.log(
              `%c[SFL Đào Khoáng] ⛔ KHÔNG tìm thấy mỏ SẴN SÀNG đào (đã phát hiện: ${Object.keys(chanDoanBD.theoLoai).map((k) => `${k}=${chanDoanBD.theoLoai[k]}`).join(", ") || "0"})`,
              "color: #ff9800; font-weight: bold;"
            );
            if (chanDoanBD.mau.length) {
              console.log("%c[SFL Đào Khoáng] 📋 Mẫu mỏ bị bỏ qua:", "color: #ff9800;", chanDoanBD.mau[0]);
            }
          }
          break;
        }

        let coDongTac = false;
        for (const q of quangSanSang) {
          if (await kiemTraCaptchaMining()) break;
          if (typeof S.isGoblinSwarm === "function" && S.isGoblinSwarm()) break;

          // Kiểm tra lại phần tử còn hiển thị (DOM đã render lại sau lần đào trước)
          if (!xemPhanTuRanh(q.el)) continue;

          const soLuotCan = soLanDaoTheoLoai[q.loai] || 1;

          // Nếu hết công cụ cho loại mỏ này → thử mua thêm, không mua được thì DỪNG (chống spam)
          let soCuocTier = Number(pickaxes[q.loai] || 0);
          if (soCuocTier <= 0 || Math.floor(soCuocTier / soLuotCan) <= 0) {
            await muaThemCongCu();
            soCuocTier = Number(pickaxes[q.loai] || 0);
            if (soCuocTier <= 0 || Math.floor(soCuocTier / soLuotCan) <= 0) {
              console.log(`%c[SFL Đào Khoáng] ⛏️ Hết công cụ đào "${q.loai}" và không mua được thêm -> Dừng đào để tránh spam.`, "color: #ff9800; font-weight: bold;");
              return daDaoTong > 0;
            }
          }

          for (let hit = 0; hit < soLuotCan; hit++) {
            clickTam(q.el);
            await ngu(120 + Math.floor(Math.random() * 50));
          }

          // Nếu có nút xác nhận Mine/Đào hiện lên → bấm
          const docQ = q.doc || q.el.ownerDocument || document;
          const nutDao = timNutDaoXacNhan(docQ);
          if (nutDao) {
            clickTam(nutDao);
            await ngu(250);
          }

          // ── CẬP NHẬT LẠI CACHE SỐ CÔNG CỤ SAU KHI ĐÀO XONG (trừ công cụ đã dùng) ──
          await capNhatCuocTuBridge();

          daDaoTong++;
          coDongTac = true;
          await ngu(300 + Math.floor(Math.random() * 100));
        }

        // Không thực hiện được động tác nào trong vòng quét này → dừng
        if (!coDongTac) break;
      }

      return daDaoTong > 0;
    } catch (err) {
      console.error("[SFL Đào Khoáng] Lỗi:", err);
      return false;
    } finally {
      dangBan = false;
    }
  }

  S.tickMining = tickMining;

})(window.SFL = window.SFL || {});
