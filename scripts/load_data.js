// ═══════════════════════════════════════════════════════════════════
// LUỒNG 1 — LOAD DATA & ĐỊNH DẠNG DỮ LIỆU NGƯỜI DÙNG (load_data.js)
// Sử dụng Game Bridge để lấy 100% dữ liệu tài khoản, tài nguyên & kho đồ
// Đảm bảo: CHỈ TỰ ĐỘNG LOAD VÀ IN ĐÚNG 1 LẦN DUY NHẤT khi vào game!
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  let dangTai = false;
  let daInDuLieu = false; // Cờ đảm bảo CHỈ IN ĐÚNG 1 LẦN
  const ngu = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Kiểm tra đúng frame game chính để tránh bị in lặp lại ở các iframe phụ
  function chayDungFrame() {
    try {
      const coRoot = !!document.querySelector("#root, [data-map-placement], canvas");
      if (coRoot) return true;
      if (window === window.top) return true;
      return false;
    } catch (_e) {
      return true;
    }
  }

  // Định dạng in ra Console siêu đẹp mắt với CSS màu
  function inThongTinRaConsole(data) {
    if (!data || !data.user) {
      return;
    }

    const u = data.user;
    const res = data.resources || {};
    const inv = data.inventory || {};
    const bld = data.buildings || {};

    console.clear?.();
    console.log(
      `%c 🌻 SUNFLOWER LAND — BÁO CÁO DỮ LIỆU TÀI KHOẢN (v5.0.0) 🌻 `,
      "background: #2e7d32; color: #fff; font-size: 16px; font-weight: bold; padding: 6px 12px; border-radius: 4px; border: 2px solid #81c784;"
    );

    // ── 1. THÔNG TIN NGƯỜI DÙNG ──
    console.group(
      `%c 👤 1. HỒ SƠ NÔNG TRẠI (Profile & Farm) `,
      "background: #1565c0; color: #fff; font-weight: bold; padding: 3px 8px; border-radius: 3px;"
    );
    const dr = u.dailyRewards || {};
    console.table([
      { "Thông tin": "Tên Người Chơi", "Giá trị": u.username },
      { "Thông tin": "Farm ID", "Giá trị": u.farmId },
      { "Thông tin": "🌸 Mùa Hiện Tại", "Giá trị": u.season.toUpperCase() },
      { "Thông tin": "Cấp Độ Bumpkin", "Giá trị": `Level ${u.bumpkinLevel} (${u.bumpkinExp.toLocaleString()} XP)` },
      { "Thông tin": "💰 Số Dư SFL", "Giá trị": `${u.balanceSFL.toFixed(4)} SFL` },
      { "Thông tin": "🪙 Coins", "Giá trị": `${u.coins.toLocaleString()} Coins` },
      { "Thông tin": "💎 Gems", "Giá trị": `${u.gems.toLocaleString()} Gems` },
      { "Thông tin": "🏝️ Loại Đảo", "Giá trị": `${u.islandType} (${u.islandExpansions} mảnh đất)` },
      { "Thông tin": "🎁 Điểm Danh Hằng Ngày", "Giá trị": `Chuỗi ${dr.streaks || 0} ngày | ${dr.isCollectedToday ? "Đã nhận (" + (dr.collectedAtText || "Hôm nay") + ")" : "Chưa nhận (Sẵn sàng)"}` },
      { "Thông tin": "⛵ Thuyền Hàng Hằng Ngày", "Giá trị": `${u.shipments?.isRestockedToday ? "Đã nhận (" + (u.shipments?.restockedAtText || "Hôm nay") + ")" : "Chưa nhận (Sẵn sàng restock)"}` },
    ]);
    console.groupEnd();

    // ── 1.1 KỸ NĂNG & TRANG BỊ BUMPKIN ──
    const skills = u.skills || {};
    const equipped = u.equipped || {};
    const skillList = Object.keys(skills);

    console.group(
      `%c ⚡ 1.1 KỸ NĂNG & TRANG BỊ BUMPKIN (Skills & Wearables) `,
      "background: #6a1b9a; color: #fff; font-weight: bold; padding: 3px 8px; border-radius: 3px;"
    );
    if (skillList.length > 0) {
      console.log(`%c✨ Kỹ Năng Đã Mở Khóa (${skillList.length} Skills):`, "color: #e040fb; font-weight: bold;", skillList.join(", "));
    } else {
      console.log("Chưa mở khóa kỹ năng nào.");
    }
    if (Object.keys(equipped).length > 0) {
      console.log("%c👗 Trang Bị Đang Mặc:", "color: #ab47bc; font-weight: bold;", equipped);
    }
    console.groupEnd();

    // ── 2. TÀI NGUYÊN BẢN ĐỒ ──
    console.group(
      `%c 🌾 2. TRẠNG THÁI BẢN ĐỒ & TÀI NGUYÊN (Map Resources) `,
      "background: #e65100; color: #fff; font-weight: bold; padding: 3px 8px; border-radius: 3px;"
    );

    const crops = res.crops || {};
    const trees = res.trees || {};
    const min = res.minerals || {};

    console.table([
      { "Khu vực": "🌱 Đất Ruộng (Crops)", "Tổng số": crops.total || 0, "Trống": crops.empty || 0, "Đang Trồng": crops.growing || 0, "Sẵn Sàng Gặt": crops.ready || 0 },
      { "Khu vực": "🪓 Cây Rừng (Trees)", "Tổng số": trees.total || 0, "Sẵn Sàng Chặt": trees.ready || 0, "Đang Mọc": (trees.total || 0) - (trees.ready || 0), "Ghi chú": "" },
      { "Khu vực": "🪨 Mỏ Đá (Stones)", "Tổng số": min.stones?.length || 0, "Sẵn Sàng": min.stones?.filter(s => s.isReady).length || 0, "Đang Hồi": 0, "Ghi chú": "" },
      { "Khu vực": "⛏️ Mỏ Sắt (Iron)", "Tổng số": min.iron?.length || 0, "Sẵn Sàng": min.iron?.filter(s => s.isReady).length || 0, "Đang Hồi": 0, "Ghi chú": "" },
      { "Khu vực": "✨ Mỏ Vàng (Gold)", "Tổng số": min.gold?.length || 0, "Sẵn Sàng": min.gold?.filter(s => s.isReady).length || 0, "Đang Hồi": 0, "Ghi chú": "" },
      { "Khu vực": "💎 Crimstone / Sunstone", "Tổng số": (min.crimstones?.length || 0) + (min.sunstones?.length || 0), "Sẵn Sàng": 0, "Đang Hồi": 0, "Ghi chú": "" },
      { "Khu vực": "🍎 Cây Ăn Quả (Fruit Patches)", "Tổng số": res.fruitPatches?.total || 0, "Chi tiết": res.fruitPatches?.list?.map(f => f.name).filter(n => n !== "Empty").join(", ") || "Không có", "Đang Hồi": "", "Ghi chú": "" },
      { "Khu vực": "🍯 Tổ Ong (Beehives)", "Tổng số": res.beehives?.total || 0, "Sẵn Sàng Lấy": res.beehives?.list?.filter(b => b.isReady).length || 0, "Đang Hồi": "", "Ghi chú": "" },
      { "Khu vực": "🌸 Luống Hoa (Flowers)", "Tổng số": res.flowers?.total || 0, "Chi tiết": res.flowers?.list?.map(fl => fl.name).filter(n => n !== "Empty").join(", ") || "Trống", "Đang Hồi": "", "Ghi chú": "" },
      { "Khu vực": "🍄 Nấm Rừng (Mushrooms)", "Tổng số": res.mushrooms?.total || 0, "Chi tiết": res.mushrooms?.list?.map(m => m.name).join(", ") || "Không có", "Đang Hồi": "", "Ghi chú": "" },
    ]);
    console.groupEnd();

    // ── 3. TÚI ĐỒ / KHO VẬT PHẨM (Inventory) ──
    console.group(
      `%c 🎒 3. KHO ĐỒ CHI TIẾT (Full Inventory) `,
      "background: #4a148c; color: #fff; font-weight: bold; padding: 3px 8px; border-radius: 3px;"
    );

    const invRows = Object.entries(inv)
      .filter(([k, v]) => v > 0)
      .map(([k, v]) => ({ "Tên Vật Phẩm": k, "Số Lượng": typeof v === "number" ? v.toLocaleString() : v }));

    if (invRows.length > 0) {
      console.table(invRows);
    } else {
      console.log("Kho đồ rỗng hoặc chưa có dữ liệu.");
    }
    console.groupEnd();

    // ── 4. CÔNG TRÌNH & ĐƠN HÀNG ──
    if (Object.keys(bld).length > 0 || (Array.isArray(data.orders) && data.orders.length > 0)) {
      console.group(
        `%c 🏭 4. CÔNG TRÌNH & ĐƠN HÀNG (Buildings & Orders) `,
        "background: #006064; color: #fff; font-weight: bold; padding: 3px 8px; border-radius: 3px;"
      );
      if (Object.keys(bld).length > 0) {
        console.log("%cCông trình đã đặt:", "color: #00bcd4; font-weight: bold;", bld);
      }
      if (Array.isArray(data.orders) && data.orders.length > 0) {
        console.log("%cĐơn hàng NPC:", "color: #00bcd4; font-weight: bold;", data.orders);
      }
      console.groupEnd();
    }

    // ── 4. THÙNG Ủ PHÂN COMPOST ──
    if (Array.isArray(data.composters) && data.composters.length > 0) {
      console.group(
        `%c 💩 4. THÙNG Ủ PHÂN COMPOST (${data.composters.length} Thùng) `,
        "background: #795548; color: #fff; font-weight: bold; padding: 3px 8px; border-radius: 3px;"
      );
      const rows = data.composters.map((c) => {
        let trangThai = "Rảnh";
        if (c.isReady) trangThai = "🎁 Chín (Sẵn sàng thu hoạch!)";
        else if (c.isProducing) {
          const phut = Math.max(0, Math.ceil((c.readyAt - Date.now()) / 60000));
          trangThai = `⏳ Đang ủ (còn ~${phut} phút)`;
        } else if (c.hasRequirements) {
          trangThai = "🟢 Sẵn sàng ủ mẻ mới (Đủ nguyên liệu)";
        } else {
          const reqStr = Object.entries(c.requires || {}).map(([k, v]) => `${v} ${k}`).join(", ");
          trangThai = `⚠️ Thiếu nguyên liệu: ${reqStr}`;
        }
        return {
          "Thùng Ủ": c.name,
          "Trạng Thái": trangThai,
          "Yêu Cầu Mùa Vụ": Object.entries(c.requires || {}).map(([k, v]) => `${v} ${k}`).join(", ") || "Không",
        };
      });
      console.table(rows);
      console.groupEnd();
    }

    console.log(
      `%c ✔️ Dữ liệu đã được nạp thành công lúc: ${data.timestamp} | Bạn có thể gọi S.loadData(true) bất kỳ lúc nào để in lại! `,
      "color: #4caf50; font-weight: bold; font-size: 12px;"
    );
  }

  // Hàm thực thi luồng tải dữ liệu (Chỉ in 1 lần duy nhất)
  async function loadData(batBuocIn = false) {
    if (dangTai) return S.userData;
    dangTai = true;

    try {
      let statePayload = null;

      // Yêu cầu Bridge đọc state
      if (typeof S.requestBridgeState === "function") {
        statePayload = await S.requestBridgeState(3000);
      }

      if (!statePayload) {
        await ngu(800);
        if (typeof S.requestBridgeState === "function") {
          statePayload = await S.requestBridgeState(3000);
        }
      }

      if (statePayload && statePayload.user) {
        S.userData = statePayload;
        S.gameState = statePayload;
        // Ưu tiên mùa tính theo thời gian thực chuẩn của game (populateSeason)
        const computedSeason = typeof S.getCurrentSeason === "function" ? S.getCurrentSeason() : null;
        if (computedSeason) {
          S.gameSeason = computedSeason;
        } else if (statePayload.user?.season) {
          S.gameSeason = statePayload.user.season;
        }

        // CHỈ IN ĐÚNG 1 LẦN nếu chưa in, hoặc khi người dùng gọi chủ động batBuocIn = true
        if (!daInDuLieu || batBuocIn) {
          daInDuLieu = true;
          if (chayDungFrame()) {
            inThongTinRaConsole(statePayload);
          }
        }
        return statePayload;
      }
      return null;
    } catch (err) {
      console.error("[SFL Load Data] Lỗi khi nạp dữ liệu:", err);
      return null;
    } finally {
      dangTai = false;
    }
  }

  // Xuất bản hàm ra namespace toàn cục
  S.loadData = loadData;
  S.inThongTinRaConsole = inThongTinRaConsole;
  S.chayDungFrame = chayDungFrame;

})(window.SFL = window.SFL || {});
