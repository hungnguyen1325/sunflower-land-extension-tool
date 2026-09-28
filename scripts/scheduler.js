// ═══════════════════════════════════════════════════════════════════
// BỘ ĐIỀU PHỐI TUẦN TỰ TOÀN BỘ CÁC LUỒNG (scheduler.js)
// ĐIỀU PHỐI TUẦN TỰ 100% (STRICT SEQUENTIAL) — CHỐNG CHỒNG LẤN TUYỆT ĐỐI
// Đóng sạch sẽ modal giữa các bước, nhịp bước rõ ràng, không bao giờ chạy đè luồng
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangChayVongLap = false;
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Danh sách 15 luồng tuần tự nghiêm ngặt (kèm featureId khớp Popup UI)
  const CAC_LUONG = [
    { id: "load_data", ten: "1. Quét Dữ Liệu", fn: () => S.loadData?.(false) },
    { id: "checkin", ten: "2. Check-in Rương & Thuyền", featureId: 14, fn: () => S.tickCheckin?.() },
    { id: "seeds_buy", ten: "3. Mua Hạt Giống Theo Mùa", featureId: 9, fn: () => S.tickSeedsBuy?.() },
    { id: "tools_buy", ten: "4. Mua Công Cụ Đủ Điều Kiện", featureId: 15, fn: () => S.tickToolsBuy?.() },
    // ── CHU KỲ CANH TÁC RUỘNG ĐẤT BẮT BUỘC ──
    { id: "crops_harvest", ten: "5. Thu Hoạch Ruộng", featureId: 7, fn: () => S.tickCropHarvest?.() },
    { id: "compost", ten: "6. Thu Hoạch & Ủ Phân Compost", featureId: 10, fn: () => S.tickCompost?.() },
    { id: "fertilise", ten: "7. Rắc Phân Sprout Mix", featureId: 7, fn: () => S.tickFertilise?.() },
    { id: "crops_plant", ten: "8. Gieo Hạt Theo Mùa", featureId: 7, fn: () => S.tickCropPlant?.() },
    // ── CÁC TÀI NGUYÊN & HOẠT ĐỘNG KHÁC ──
    { id: "mushrooms", ten: "9. Nhặt Nấm Rừng", featureId: 4, fn: () => S.tickThuHoachNam?.() },
    { id: "flowers", ten: "10. Chăm Sóc & Trồng Hoa", featureId: 8, fn: () => S.tickFlowerAction?.() },
    { id: "honey", ten: "11. Thu Hoạch Mật Ong", featureId: 3, fn: () => S.tickHoney?.() },
    { id: "wood", ten: "12. Chặt Cây Lấy Gỗ", featureId: 5, fn: () => S.tickWoodChop?.() },
    { id: "mining", ten: "13. Đào Khoáng Sản & Dầu", featureId: 6, fn: () => S.tickMining?.() },
    { id: "fruit_tree", ten: "14. Cây Ăn Quả (Thu hoạch & Trồng)", featureId: 11, fn: () => S.tickFruitTree?.() },
    { id: "cooking", ten: "15. Nấu Ăn & Chế Biến", featureId: 12, fn: () => S.tickCooking?.() },
    // ── GIAO ĐƠN & NHẬN THƯỞNG NHIỆM VỤ ĐỘC LẬP ──
    { id: "deliveries", ten: "16. Giao Đơn Hàng Tàu/NPC", featureId: 13, fn: () => S.tickDeliveries?.() },
    { id: "poppy_bounties", ten: "17. Giao Bounties Poppy (Plaza)", featureId: 16, fn: () => S.tickPoppyBounties?.() },
    { id: "weekly_chores", ten: "18. Nhận Thưởng Nhiệm Vụ Tuần (Chores)", featureId: 17, fn: () => S.tickWeeklyChores?.() },
    { id: "treasure_chest", ten: "20. Mở Rương Kho Báu (Chests)", featureId: 19, fn: () => S.tickTreasureChest?.() },
    // ── CÂU CÁ, CÀO MUỐI, MỎ DẦU & PHÁT TRIỂN NÔNG TRẠI ──
    { id: "fishing", ten: "21. Tự Động Câu Cá (Fishing)", featureId: 20, fn: () => S.tickFishing?.() },
    { id: "salt_mining", ten: "22. Cào Muối & Đào Mỏ Dầu", featureId: 21, fn: () => S.tickSaltMining?.() },
    { id: "land_expansion", ten: "23. Mở Rộng Đất & Nâng Đảo", featureId: 22, fn: () => S.tickLandExpansion?.() },
  ];

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

  function isGoblinSwarm() {
    for (const doc of layTaiLieuGame()) {
      if (!doc || !doc.body) continue;
      const txt = (doc.body.textContent || "").toLowerCase();
      if (txt.includes("goblin swarm") || txt.includes("taken over your farm") || txt.includes("wait for them to leave")) {
        return true;
      }
    }
    return false;
  }
  S.isGoblinSwarm = isGoblinSwarm;

  // Tự động tắt vĩnh viễn banner "VIP expired" của game trong localStorage
  try {
    localStorage.setItem("vipExpiryAcknowledged", new Date(Date.now() + 86400000 * 365).toISOString());
  } catch (_e) {}

  function laNutCloseChuan(el) {
    if (!el || !xemPhanTuRanh(el)) return false;
    const src = (el.src || el.getAttribute?.("src") || "").toLowerCase();
    const alt = (el.alt || el.getAttribute?.("alt") || "").toLowerCase();

    // TUYỆT ĐỐI BỎ QUA MỌI THỨ LIÊN QUAN ĐẾN VIP (TRÁNH BẤM MUA VIP)
    const pText = (el.parentElement?.textContent || el.closest?.("div, button, [role='button']")?.textContent || "").toLowerCase();
    if (pText.includes("vip") || src.includes("vip")) {
      return false;
    }
    const vipContainer = el.closest?.('[class*="vip"], [id*="vip"], [data-name*="vip"]');
    if (vipContainer) return false;

    // TUYỆT ĐỐI KHÔNG ĐƯỢC NHẬN NHẦM THÙNG COMPOST CLOSED HOẶC ĐỒ TRÊN ĐẢO!
    if (src.includes("compost") || src.includes("closed") || src.includes("building") || src.includes("island")) {
      return false;
    }
    const laAnhClose = src.includes("/ui/close") || src.includes("/icons/close") || src.includes("close.png") || src.includes("cancel.png") || alt === "close" || alt === "cancel";
    const laAriaClose = el.getAttribute?.("aria-label") === "close";

    // Phải nằm trong modal/dialog thực sự (loại trừ các panel HUD trên màn hình như widget VIP)
    const trongDialog = !!el.closest?.('[role="dialog"], [role="modal"], div[class*="modal"], .fixed.inset-0');
    return (laAnhClose || laAriaClose) && trongDialog;
  }

  // Dọn dẹp sạch sẽ toàn bộ popup giữa các bước (trừ Captcha)
  async function donDepPopupGiuaCacBuoc() {
    if (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen()) return;
    for (let loop = 0; loop < 2; loop++) {
      let daDong = false;
      for (const doc of layTaiLieuGame()) {
        if (!doc || !doc.body) continue;
        const cacAnhClose = doc.querySelectorAll('img[src*="/ui/close"], img[src*="close.png"], img[src*="cancel.png"], button[aria-label="close"]');
        for (const img of cacAnhClose) {
          if (!laNutCloseChuan(img)) continue;
          // Chỉ click button hoặc chính thẻ img close, KHÔNG click div.cursor-pointer cha tránh kích hoạt nội dung bên trong
          const btn = img.closest("button, [role='button']") || img;
          try {
            btn.click();
          } catch (_e) {}
          daDong = true;
          await ngu(200);
          break;
        }
      }
      if (!daDong) break;
    }
    for (const doc of layTaiLieuGame()) {
      try {
        const view = doc.defaultView || window;
        view.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
        doc.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
      } catch (_e) {}
    }
    await ngu(150);
  }

  // ═══════════════════════════════════════════════════════════════════
  // BỘ PHÁT HIỆN GAME LOAD XONG 100% VÀ ĐỢI 5S ỔN ĐỊNH
  // ═══════════════════════════════════════════════════════════════════
  function kiemTraGameDaLoadXong() {
    // 1. Kiểm tra qua Game Bridge State Machine
    if (S.gameState && S.gameState.inventory && (S.gameState.bumpkin || S.gameState.island || S.gameState.resources)) {
      return true;
    }
    if (S.gameService && typeof S.gameService.state?.matches === "function") {
      if (S.gameService.state.matches("playing")) return true;
    }

    // 2. Kiểm tra qua Canvas và HUD trên DOM
    const docs = layTaiLieuGame();
    for (const doc of docs) {
      if (!doc || !doc.body) continue;
      const canvas = doc.querySelector("canvas");
      const hasCanvasReady = canvas && canvas.width > 100 && canvas.height > 100;
      const hasIslandMap = !!doc.querySelector('[data-map-placement], [data-placement-name], .world-map');
      const hasHud = !!doc.querySelector('img[src*="basket"], img[src*="chest.png"], [aria-label="Settings"]');

      // Kiểm tra có đang bị màn hình Loading che không
      const txt = (doc.body.textContent || "").toLowerCase();
      const dangLoading = (txt.includes("connecting to island") || txt.includes("loading island") || (txt.includes("loading...") && !hasIslandMap));

      if (hasCanvasReady && (hasIslandMap || hasHud) && !dangLoading) {
        return true;
      }
    }
    return false;
  }

  async function choGameLoadHoanTatVaOnDinh() {
    console.log("%c[SFL Khởi Động] ⏳ Đang theo dõi tiến trình tải game Sunflower Land...", "color: #ff9800; font-weight: bold; font-size: 13px;");

    let daLoad = false;
    let lanDem = 0;
    while (!daLoad) {
      if (typeof S.requestBridgeState === "function") {
        try {
          const st = await S.requestBridgeState(800);
          if (st && st.inventory && (st.resources || st.bumpkin || st.user)) {
            daLoad = true;
            break;
          }
        } catch (_e) {}
      }

      if (kiemTraGameDaLoadXong()) {
        daLoad = true;
        break;
      }

      lanDem++;
      if (lanDem % 5 === 0) {
        console.log("[SFL Khởi Động] ⏳ Game đang tải dữ liệu và bản đồ đảo, vui lòng chờ...");
      }
      await ngu(1000);
    }

    console.log("%c[SFL Khởi Động] 🎮 GAME ĐÃ TẢI XONG 100%! Đang chờ 5s để thế giới game ổn định hoàn toàn trước khi chạy tool...", "color: #00e676; font-weight: bold; font-size: 14px;");

    for (let sec = 5; sec >= 1; sec--) {
      console.log(`%c[SFL Khởi Động] ⏳ Đang ổn định hệ thống: còn ${sec}s...`, "color: #00bcd4; font-weight: bold;");
      await ngu(1000);
    }

    console.log("%c[SFL Khởi Động] 🚀 THẾ GIỚI GAME ĐÃ HOÀN TOÀN ỔN ĐỊNH! KÍCH HOẠT VÒNG ĐIỀU PHỐI AUTO...", "color: #00e676; font-weight: bold; font-size: 14px;");
  }

  // ═══════ VÒNG LẶP ĐIỀU PHỐI TUẦN TỰ ĐỘC QUYỀN (STRICT SEQUENTIAL) ═══════
  async function vongLapChinh() {
    if (dangChayVongLap) return;
    dangChayVongLap = true;

    // ĐỢI GAME LOAD XONG 100% VÀ ĐỢI 5S ỔN ĐỊNH TRƯỚC KHI CHẠY
    await choGameLoadHoanTatVaOnDinh();

    let soThuTuVongLap = 0;

    while (true) {
      const masterBat = S.cauHinh?.masterBat !== undefined ? !!S.cauHinh.masterBat : true;
      if (!masterBat) {
        await ngu(2000);
        continue;
      }

      soThuTuVongLap++;
      console.log(`%c[SFL Điều Phối] 🔄 BẮT ĐẦU CHU KỲ VÒNG ${soThuTuVongLap}...`, "color: #2196f3; font-weight: bold; font-size: 13px;");

      // Cập nhật Game State tươi mới nhất qua Bridge cho vòng lặp hiện tại
      if (typeof S.requestBridgeState === "function") {
        try { await S.requestBridgeState(1500); } catch (_e) {}
      }

      // Duyệt tuần tự lần lượt qua từng bước một (1 -> 15)
      for (let i = 0; i < CAC_LUONG.length; i++) {
        const luongObj = CAC_LUONG[i];

        // 0. Kiểm tra cấu hình bật/tắt từ Popup UI (nếu người dùng chủ động tắt)
        if (luongObj.featureId !== undefined && S.cauHinh && S.cauHinh[luongObj.featureId] === false) {
          continue;
        }

        // Bỏ qua luồng Checkin nếu hôm nay đã check-in xong (hoặc localStorage đã ghi nhận)
        const todayKey = new Date().toISOString().slice(0, 10);
        if (
          luongObj.id === "checkin" &&
          (S.__daCheckinHomNay ||
            localStorage.getItem("sfl_checkin_done_date") === todayKey ||
            (S.__cooldownCheckin && Date.now() < S.__cooldownCheckin))
        ) {
          continue;
        }

        // Bỏ qua luồng Mua Công Cụ từ vòng 2 trở đi (chỉ chạy 1 lần duy nhất ở vòng 1 cho đến khi tải lại trang)
        if (luongObj.id === "tools_buy" && (soThuTuVongLap > 1 || S.__daMuaCongCuVongDau)) {
          continue;
        }

        // Bỏ qua luồng Mua Hạt Giống nếu số tiền < 0.01 xu hoặc đã mua ở vòng trước
        if (luongObj.id === "seeds_buy") {
          const state = S.gameState || S.userData || {};
          const coins = Number(state?.coins ?? state?.user?.coins ?? state?.balance ?? state?.user?.balanceSFL ?? S.userData?.coins ?? 0);
          if (coins < 0.01) {
            console.log(`%c[SFL Scheduler] 💰 Số dư hiện tại (${coins.toFixed(3)} xu < 0.01 xu) -> Bỏ qua luồng Mua Hạt Giống.`, "color: #ff9800;");
            continue;
          }
          if (soThuTuVongLap > 1 || S.__daMuaHatGiongVongDau) {
            continue;
          }
        }

        // Bỏ qua luồng Compost nếu đang trong thời gian nghỉ cooldown (ngăn chặn spam 100%)
        if (luongObj.id === "compost" && S.__thoiGianNghiCompost && Date.now() < S.__thoiGianNghiCompost) {
          continue;
        }

        // Bỏ qua luồng Rắc Phân nếu số lượng phân bón trong kho <= 0 (ngăn ngừa hành động thừa)
        if (luongObj.id === "fertilise") {
          const inv = S.gameState?.inventory || S.userData?.inventory || {};
          const sproutMix = Number(inv["Sprout Mix"] || 0);
          const rapidRoot = Number(inv["Rapid Root"] || 0);
          const sproutSurprise = Number(inv["Sproutroot Surprise"] || 0);
          const fertiliser = Number(inv["Fertiliser"] || 0);
          const totalPhan = sproutMix + rapidRoot + sproutSurprise + fertiliser;
          if (totalPhan <= 0) {
            continue;
          }
        }

        // Bỏ qua luồng Gieo Hạt nếu trong kho không còn bất kỳ hạt giống đúng mùa nào
        if (luongObj.id === "crops_plant") {
          const state = S.gameState || S.userData || {};
          const inv = state?.inventory || S.userData?.inventory || {};
          const season = ((typeof S.getCurrentSeason === "function" && S.getCurrentSeason()) || state?.user?.season || "spring").toLowerCase();
          const SEASONAL_CROP_PLOT_SEEDS = {
            spring: ["Sunflower Seed", "Rhubarb Seed", "Carrot Seed", "Cabbage Seed", "Soybean Seed", "Corn Seed", "Wheat Seed", "Kale Seed", "Barley Seed"],
            summer: ["Sunflower Seed", "Potato Seed", "Zucchini Seed", "Pepper Seed", "Beetroot Seed", "Cauliflower Seed", "Eggplant Seed", "Radish Seed", "Wheat Seed"],
            autumn: ["Potato Seed", "Pumpkin Seed", "Carrot Seed", "Yam Seed", "Broccoli Seed", "Soybean Seed", "Wheat Seed", "Barley Seed", "Artichoke Seed"],
            winter: ["Sunflower Seed", "Potato Seed", "Cabbage Seed", "Beetroot Seed", "Cauliflower Seed", "Parsnip Seed", "Onion Seed", "Turnip Seed", "Wheat Seed", "Kale Seed"],
          };
          const seedsCuaMua = SEASONAL_CROP_PLOT_SEEDS[season] || SEASONAL_CROP_PLOT_SEEDS.spring;
          const hasSeasonalSeed = seedsCuaMua.some((s) => Number(inv[s] || 0) >= 1);
          if (!hasSeasonalSeed) {
            console.log(`%c[SFL Scheduler] ℹ️ Đã hết hạt giống đúng mùa (${season}) trong kho -> Bỏ qua luồng gieo hạt.`, "color: #9e9e9e;");
            continue;
          }
        }

        // Bỏ qua luồng Hoa nếu không có hoa nở và không đủ hạt giống đúng mùa/nguyên liệu trồng
        if (luongObj.id === "flowers") {
          const state = S.gameState;
          const flowerBeds = (state?.resources?.flowers?.list || []).filter((b) => b && (b.x !== undefined || b.y !== undefined));
          const hasReady = flowerBeds.some((b) => b.isReady);
          const hasEmpty = flowerBeds.some((b) => !b.plantedAt || b.name === "Empty");
          const inv = state?.inventory || S.userData?.inventory || {};
          const season = ((typeof S.getCurrentSeason === "function" && S.getCurrentSeason()) || "spring").toLowerCase();
          const SEASONAL_FLOWER_SEEDS = {
            spring: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Lavender Seed"],
            summer: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Gladiolus Seed"],
            autumn: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Clover Seed"],
            winter: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Edelweiss Seed"],
          };
          const validSeeds = SEASONAL_FLOWER_SEEDS[season] || SEASONAL_FLOWER_SEEDS.spring;
          const hasSeasonalSeed = validSeeds.some((s) => Number(inv[s] || 0) >= 1);
          if (!hasReady && (!hasEmpty || !hasSeasonalSeed)) {
            continue;
          }
        }

        // 1. Kiểm tra và giải Captcha hoặc Tạm khóa Quick Check trước mỗi bước (ĐÓNG BĂNG TUYỆT ĐỐI)
        while ((typeof S.isCaptchaLocked === "function" && S.isCaptchaLocked()) || (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen())) {
          if (typeof S.isCaptchaLocked === "function" && S.isCaptchaLocked()) {
            const lockUntil = typeof S.layThoiGianKhoaCaptcha === "function" ? S.layThoiGianKhoaCaptcha() : 0;
            const remainingSec = Math.max(1, Math.ceil((lockUntil - Date.now()) / 1000));
            const phut = Math.floor(remainingSec / 60);
            const giay = remainingSec % 60;
            console.log(
              `%c[SFL Điều Phối] 🔒 TÀI KHOẢN ĐANG BỊ TẠM KHÓA QUICK CHECK (${phut}:${giay < 10 ? "0" : ""}${giay})! ĐÓNG BĂNG TOÀN BỘ LUỒNG...`,
              "color: #fff; background: #d32f2f; font-weight: bold; font-size: 13px; padding: 2px 6px; border-radius: 3px;"
            );
            S.hanhDongCuoi = `🔒 Tạm khóa Quick Check (${phut}:${giay < 10 ? "0" : ""}${giay})...`;
            await ngu(1000);
            continue;
          }

          console.log("%c[SFL Điều Phối] 🚨 Đang có Captcha trên màn hình! Đóng băng hệ thống để tập trung giải...", "color: #ff3838; font-weight: bold; font-size: 13px;");
          if (typeof S.kiemTraVaGiaiCaptcha === "function") {
            await S.kiemTraVaGiaiCaptcha();
          }
          await ngu(800);
        }

        // 2. Kiểm tra Goblin Swarm
        while (isGoblinSwarm()) {
          console.log("%c[SFL Điều Phối] 👺 Goblin Swarm đang chiếm farm! Đợi 3s...", "color: #ff5252; font-weight: bold;");
          await ngu(3000);
        }

        // 3. Đóng sạch sẽ các popup còn sót lại của bước trước
        await donDepPopupGiuaCacBuoc();

        // Đảm bảo cờ Captcha và khóa Captcha được giải phóng hoàn toàn nếu Captcha đã đóng
        if (typeof S.isCaptchaOpen === "function" && !S.isCaptchaOpen() && (!S.isCaptchaLocked || !S.isCaptchaLocked())) {
          S.__captchaActive = false;
          S.__captchaInterrupted = false;
          if (S.luongDangGiu === "captcha" && typeof S.nhaKhoa === "function") {
            S.nhaKhoa("captcha");
          }
        }

        // 4. Bắt đầu thực thi DUY NHẤT luồng hiện tại và ĐỢI KẾT THÚC HOÀN TOÀN
        console.log(`%c[SFL Điều Phối] ▶️ [BƯỚC ${i + 1}/${CAC_LUONG.length}] BẮT ĐẦU: ${luongObj.ten.toUpperCase()}`, "color: #00bcd4; font-weight: bold; font-size: 12px;");
        S.__captchaInterrupted = false;

        try {
          if (typeof luongObj.fn === "function") {
            await luongObj.fn();
          }
        } catch (err) {
          console.error(`[SFL Điều Phối] Lỗi trong bước ${luongObj.ten}:`, err);
        }

        // 5. Nếu bị ngắt bởi Captcha hoặc bị khóa Quick Check:
        // ĐÓNG BĂNG VÀ GIẢI ĐẾN KHI XONG, RỒI TIẾP TỤC QUAY LẠI CHẠY TIẾP CHÍNH LUỒNG ĐÓ TỪ CHỖ DỪNG!
        if (S.__captchaInterrupted || (typeof S.isCaptchaLocked === "function" && S.isCaptchaLocked()) || (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen())) {
          while (S.__captchaInterrupted || (typeof S.isCaptchaLocked === "function" && S.isCaptchaLocked()) || (typeof S.isCaptchaOpen === "function" && S.isCaptchaOpen())) {
            if (typeof S.isCaptchaLocked === "function" && S.isCaptchaLocked()) {
              const lockUntil = typeof S.layThoiGianKhoaCaptcha === "function" ? S.layThoiGianKhoaCaptcha() : 0;
              const remainingSec = Math.max(1, Math.ceil((lockUntil - Date.now()) / 1000));
              const phut = Math.floor(remainingSec / 60);
              const giay = remainingSec % 60;
              console.log(
                `%c[SFL Điều Phối] 🔒 TÀI KHOẢN ĐANG BỊ TẠM KHÓA QUICK CHECK (${phut}:${giay < 10 ? "0" : ""}${giay})! ĐÓNG BĂNG TOÀN BỘ LUỒNG...`,
                "color: #fff; background: #d32f2f; font-weight: bold; font-size: 13px; padding: 2px 6px; border-radius: 3px;"
              );
              S.hanhDongCuoi = `🔒 Tạm khóa Quick Check (${phut}:${giay < 10 ? "0" : ""}${giay})...`;
              await ngu(1000);
              continue;
            }

            console.log(`%c[SFL Điều Phối] 🚨 Bị ngắt bởi Captcha ở [BƯỚC ${i + 1}: ${luongObj.ten}]! Đóng băng mọi luồng để tập trung giải...`, "color: #ff9800; font-weight: bold;");
            if (typeof S.kiemTraVaGiaiCaptcha === "function") {
              await S.kiemTraVaGiaiCaptcha();
            }
            await ngu(800);
            if (typeof S.isCaptchaOpen === "function" && !S.isCaptchaOpen() && (!S.isCaptchaLocked || !S.isCaptchaLocked())) {
              S.__captchaInterrupted = false;
              break;
            }
          }

          console.log(`%c[SFL Điều Phối] 🔄 ĐÃ GIẢI XONG CAPTCHA! TIẾP TỤC QUAY LẠI HOÀN THÀNH LUỒNG: ${luongObj.ten.toUpperCase()} TỪ CHỖ DỪNG...`, "color: #00e676; font-weight: bold; font-size: 13px;");
          await donDepPopupGiuaCacBuoc();
          i--; // Giảm i để vòng lặp for chạy lại chính bước này
          await ngu(800);
          continue;
        }

        console.log(`[SFL Điều Phối] ✔️ [BƯỚC ${i + 1}/${CAC_LUONG.length}] XONG: ${luongObj.ten}`);

        // 6. Giãn cách tự nhiên như người thật giữa các luồng (1.5s - 2.5s)
        const delay = 1500 + Math.floor(Math.random() * 1000);
        await ngu(delay);
      }

      // Kết thúc 1 chu kỳ hoàn chỉnh (15 bước) -> Nghỉ giải lao 5s - 7s
      console.log(`%c[SFL Điều Phối] 🔄 HOÀN TẤT 1 CHU KỲ (15 LUỒNG) → Nghỉ giải lao 5s trước khi lặp lại...`, "color: #4caf50; font-weight: bold; font-size: 13px;");
      await ngu(5000 + Math.floor(Math.random() * 2000));
    }
  }

  S.vongDieuPhoi = vongLapChinh;

  // Khởi động trình theo dõi tiến trình tải game an toàn (chỉ ở frame game chính)
  setTimeout(() => {
    if (window !== window.top && !document.querySelector('#root, [data-map-placement], canvas')) return;
    vongLapChinh();
  }, 1000);

})(window.SFL = window.SFL || {});
