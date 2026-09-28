// ═══════════════════════════════════════════════════════════════════
// PAGE BRIDGE — MAIN WORLD EXTENSION SCRIPT (page-bridge.js)
// Chạy trong MAIN world để trích xuất 100% dữ liệu Game State
// ═══════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  if (window.__SFL_PAGE_BRIDGE_LOADED__) {
    return;
  }
  window.__SFL_PAGE_BRIDGE_LOADED__ = true;

  let cachedGameService = null;

  function toSafeNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, "").trim());
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value === "object") {
      if (typeof value.toNumber === "function") {
        const parsed = Number(value.toNumber());
        return Number.isFinite(parsed) ? parsed : 0;
      }
      if (typeof value.toString === "function") {
        const parsed = Number(String(value));
        return Number.isFinite(parsed) ? parsed : 0;
      }
    }
    return 0;
  }

  // ── TÍNH MÙA HIỆN TẠI THEO THUẬT TOÁN GỐC CỦA GAME (populateSeason) ──
  // Nguồn: sunflower-land/src/features/game/lib/season.ts
  // Mùa xoay vòng mỗi tuần (7 ngày), bắt đầu từ 2024-12-16T00:00:00Z
  const SEASON_ROTATION = ["spring", "summer", "autumn", "winter"];
  const FIRST_WEEK_START_AT = Date.UTC(2024, 11, 16); // = 1734307200000 (2024-12-16T00:00:00Z)

  function getCurrentSeason(now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const daysSinceStart = Math.floor((t - FIRST_WEEK_START_AT) / (24 * 60 * 60 * 1000));
    const weeksSinceStart = Math.max(Math.floor(daysSinceStart / 7), 0);
    return SEASON_ROTATION[weeksSinceStart % 4] || "spring";
  }

  function isGameService(obj) {
    if (!obj || typeof obj !== "object") return false;
    if (typeof obj.getSnapshot !== "function" || typeof obj.send !== "function") {
      return false;
    }
    try {
      const snap = obj.getSnapshot();
      const ctx = snap?.context || snap?.value?.context || {};
      const state = ctx.state || ctx.gameState || ctx;
      return !!(state && (state.inventory || state.season || state.trees || state.crops || state.coins !== undefined));
    } catch (_e) {
      return false;
    }
  }

  function extractService(input) {
    if (!input || typeof input !== "object") return null;
    if (typeof input.shortcutItem === "function") {
      cachedShortcutItem = input.shortcutItem;
    }
    if (isGameService(input)) return input;
    try {
      for (const key of Object.keys(input)) {
        if (key.startsWith("__")) continue;
        const value = input[key];
        if (value && typeof value === "object" && typeof value.shortcutItem === "function") {
          cachedShortcutItem = value.shortcutItem;
        }
        if (isGameService(value)) return value;
        if (!value || typeof value !== "object") continue;
        for (const sub of Object.keys(value)) {
          if (sub.startsWith("__")) continue;
          if (value[sub] && typeof value[sub] === "object" && typeof value[sub].shortcutItem === "function") {
            cachedShortcutItem = value[sub].shortcutItem;
          }
          if (isGameService(value[sub])) return value[sub];
        }
      }
    } catch (_e) {}
    return null;
  }

  function findGameService() {
    if (cachedGameService && isGameService(cachedGameService)) {
      return cachedGameService;
    }
    cachedGameService = null;

    const elements = document.querySelectorAll("#root, [data-map-placement], div, button, img");
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const fiberKey = Object.keys(el).find(
        (k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")
      );
      if (!fiberKey) continue;
      let f = el[fiberKey];
      for (let depth = 0; depth < 50 && f; depth++) {
        const val = f.memoizedProps?.value;
        if (val && typeof val === "object" && typeof val.shortcutItem === "function") {
          cachedShortcutItem = val.shortcutItem;
        }
        const found = extractService(f.memoizedProps) || extractService(f.memoizedState);
        if (found) {
          cachedGameService = found;
          return cachedGameService;
        }
        f = f.return;
      }
    }
    return null;
  }

  function getGameState() {
    const svc = findGameService();
    if (svc) {
      try {
        const snap = svc.getSnapshot();
        const ctx = snap?.context || snap?.value?.context || {};
        const state = ctx.state || ctx.gameState || ctx;
        if (state) return state;
      } catch (_e) {}
    }
    return null;
  }

  // Trích xuất TOÀN BỘ dữ liệu game chi tiết
  function buildStatePayload() {
    const state = getGameState();
    if (!state) return null;

    const now = Date.now();

    // 1. Thông tin người dùng (User & Farm Profile)
    // Mùa hiện tại tính theo thời gian thực bằng thuật toán populateSeason của game
    let season = getCurrentSeason();

    const exp = toSafeNumber(state.bumpkin?.experience);
    // Tính level cơ bản của Bumpkin từ XP
    const level = Math.max(1, Math.floor(Math.sqrt(exp / 100)) + 1);

    const VIP_TRIAL_PERIOD_MS = 1000 * 60 * 60 * 24 * 7;
    const hasLifetimePass = toSafeNumber(state.inventory?.["Lifetime Farmer Banner"]) > 0;
    const hasTrialVIP = !!state.vip?.trialStartedAt && state.vip?.trialStartedAt > now - VIP_TRIAL_PERIOD_MS;
    const hasValidInGameVIP = !!state.vip?.expiresAt && state.vip?.expiresAt > now;
    const isVip = hasValidInGameVIP || hasLifetimePass || hasTrialVIP;

    const user = {
      farmId: state.id || state.farmId || "N/A",
      username: typeof state.username === "string" ? state.username : (state.bumpkin?.name || "Player"),
      coins: toSafeNumber(state.coins),
      gems: toSafeNumber(state.inventory?.Gem),
      balanceSFL: toSafeNumber(state.balance),
      isVip: isVip,
      vipExpiresAt: state.vip?.expiresAt || null,
      season: String(season).toLowerCase().trim(),
      bumpkinLevel: level,
      bumpkinExp: exp,
      islandType: state.island?.type || "basic",
      islandExpansions: toSafeNumber(state.island?.expansions || state.inventory?.["Basic Land"] || 1),
      skills: state.bumpkin?.skills || {},
      equipped: state.bumpkin?.equipped || {},
      achievements: state.bumpkin?.achievements || {},
      dailyRewards: (() => {
        // So sánh theo NGÀY (như isDailyRewardReady của game) thay vì theo ms
        const todayKey = new Date().toISOString().slice(0, 10);

        // Game lưu thời điểm nhận vào dailyRewards?.chest?.collectedAt
        const rawCollected =
          state.dailyRewards?.chest?.collectedAt ??
          state.dailyRewards?.collectedAt ??
          state.dailyRewards?.collectedDate;
        const collectedAt = toSafeNumber(rawCollected);
        const collectedKey = collectedAt > 0 ? new Date(collectedAt).toISOString().slice(0, 10) : "";
        const isCollectedToday = collectedKey === todayKey;

        return {
          streaks: toSafeNumber(state.dailyRewards?.streaks),
          collectedAt: collectedAt,
          collectedAtText: collectedAt > 0 ? new Date(collectedAt).toLocaleTimeString("vi-VN") + " " + new Date(collectedAt).toLocaleDateString("vi-VN") : "Chưa có",
          isCollectedToday: isCollectedToday,
          isReady: !isCollectedToday,
        };
      })(),
      shipments: (() => {
        const todayKey = new Date().toISOString().slice(0, 10);

        const restockedAt = toSafeNumber(state.shipments?.restockedAt);
        const restockKey = restockedAt > 0 ? new Date(restockedAt).toISOString().slice(0, 10) : "";
        const isRestockedToday = restockKey === todayKey;

        return {
          restockedAt: restockedAt,
          restockedAtText: restockedAt > 0 ? new Date(restockedAt).toLocaleTimeString("vi-VN") + " " + new Date(restockedAt).toLocaleDateString("vi-VN") : "Chưa có",
          isRestockedToday: isRestockedToday,
          canRestock: !isRestockedToday,
        };
      })(),
    };

    // 2. Kho đồ toàn bộ (Full Inventory)
    const inventory = {};
    if (state.inventory && typeof state.inventory === "object") {
      for (const [k, v] of Object.entries(state.inventory)) {
        const val = toSafeNumber(v);
        if (val > 0) inventory[k] = val;
      }
    }

    // 3. Cây gỗ (Trees) với tọa độ x, y
    const trees = [];
    if (state.trees && typeof state.trees === "object") {
      for (const [id, t] of Object.entries(state.trees)) {
        if ((t?.x === undefined && t?.coordinates?.x === undefined) || t?.removedAt > 0) continue;
        const choppedAt = toSafeNumber(t?.wood?.choppedAt ?? t?.choppedAt);
        const recoveredAt = toSafeNumber(t?.wood?.recoveredAt ?? t?.recoveredAt);
        const isReady = choppedAt <= 0 || (recoveredAt > 0 && recoveredAt <= now);
        trees.push({ id, x: toSafeNumber(t?.x ?? t?.coordinates?.x), y: toSafeNumber(t?.y ?? t?.coordinates?.y), isReady, choppedAt });
      }
    }

    // 4. Tài nguyên khoáng sản (Rocks: Stones, Iron, Gold, Crimstone, Sunstone, Oil)
    function serializeRocks(rockMap) {
      const list = [];
      if (!rockMap || typeof rockMap !== "object") return list;
      for (const [id, r] of Object.entries(rockMap)) {
        if ((r?.x === undefined && r?.coordinates?.x === undefined) || r?.removedAt > 0) continue;
        const minedAt = toSafeNumber(r?.stone?.minedAt ?? r?.minedAt);
        const recoveredAt = toSafeNumber(r?.stone?.recoveredAt ?? r?.recoveredAt);
        const isReady = minedAt <= 0 || (recoveredAt > 0 && recoveredAt <= now);
        list.push({ id, x: toSafeNumber(r?.x ?? r?.coordinates?.x), y: toSafeNumber(r?.y ?? r?.coordinates?.y), isReady, minedAt });
      }
      return list;
    }

    const oilList = [];
    if (state.oilReserves && typeof state.oilReserves === "object") {
      for (const [id, o] of Object.entries(state.oilReserves)) {
        if ((o?.x === undefined && o?.coordinates?.x === undefined) || o?.removedAt > 0) continue;
        const drilledAt = toSafeNumber(o?.drilledAt);
        oilList.push({
          id,
          x: toSafeNumber(o?.x ?? o?.coordinates?.x),
          y: toSafeNumber(o?.y ?? o?.coordinates?.y),
          drilled: toSafeNumber(o?.drilled),
          drilledAt,
          isReady: drilledAt <= 0 || drilledAt <= now - 20 * 60 * 1000,
        });
      }
    }

    const minerals = {
      stones: serializeRocks(state.stones),
      iron: serializeRocks(state.iron),
      gold: serializeRocks(state.gold),
      crimstones: serializeRocks(state.crimstones),
      sunstones: serializeRocks(state.sunstones),
      oilReserves: oilList,
    };

    // 5. Đất ruộng & Cây trồng (Crops) với tọa độ x, y
    const crops = [];
    let emptyCropsCount = 0;
    let growingCropsCount = 0;
    let readyCropsCount = 0;

    if (state.crops && typeof state.crops === "object") {
      for (const [id, plot] of Object.entries(state.crops)) {
        if ((plot?.x === undefined && plot?.coordinates?.x === undefined) || plot?.removedAt > 0) continue;
        const plantedAt = toSafeNumber(plot?.crop?.plantedAt ?? plot?.plantedAt);
        const readyAt = toSafeNumber(plot?.crop?.readyAt ?? plot?.readyAt);
        const cropName = String(plot?.crop?.name || plot?.cropName || "").trim();
        const isEmpty = !cropName || plantedAt <= 0;
        const isReady = !isEmpty && readyAt > 0 && readyAt <= now;

        if (isEmpty) emptyCropsCount++;
        else if (isReady) readyCropsCount++;
        else growingCropsCount++;

        crops.push({
          id,
          plotKey: String(id),
          x: toSafeNumber(plot?.x ?? plot?.coordinates?.x),
          y: toSafeNumber(plot?.y ?? plot?.coordinates?.y),
          cropName: cropName || "Empty",
          isEmpty,
          isReady,
          plantedAt,
          readyAt,
          fertiliser: plot?.fertiliser?.name || null,
        });
      }
    }

    // 6. Cây ăn quả (Fruit Patches) với tọa độ x, y
    const FRUIT_GROW_SECONDS = {
      "Tomato": 2 * 3600,
      "Lemon": 4 * 3600,
      "Blueberry": 6 * 3600,
      "Orange": 8 * 3600,
      "Apple": 12 * 3600,
      "Banana": 12 * 3600,
      "Celestine": 6 * 3600,
      "Lunara": 12 * 3600,
      "Duskberry": 24 * 3600,
    };

    const fruitPatches = [];
    if (state.fruitPatches && typeof state.fruitPatches === "object") {
      for (const [id, patch] of Object.entries(state.fruitPatches)) {
        // BỎ QUA Ô ĐẤT CẤT TRONG KHO / RÚT VỀ RƯƠNG (Không có tọa độ x, y trên đảo)
        if ((patch?.x === undefined && patch?.coordinates?.x === undefined) || patch?.removedAt > 0) continue;

        const fruit = patch?.fruit;
        const fruitName = fruit?.name || "";
        const harvestsLeft = toSafeNumber(fruit?.harvestsLeft);
        const startedAt = toSafeNumber(fruit?.harvestedAt || fruit?.plantedAt);
        const growSecs = FRUIT_GROW_SECONDS[fruitName] || (12 * 3600);
        const readyAt = startedAt > 0 ? (startedAt + growSecs * 1000) : 0;
        const isReady = !!fruitName && harvestsLeft > 0 && readyAt > 0 && readyAt <= now;
        const isDead = !!fruitName && harvestsLeft <= 0;
        const isGrowing = !!fruitName && harvestsLeft > 0 && readyAt > now;

        fruitPatches.push({
          id: String(id),
          x: toSafeNumber(patch?.x ?? patch?.coordinates?.x),
          y: toSafeNumber(patch?.y ?? patch?.coordinates?.y),
          name: fruitName || "Empty",
          harvestsLeft,
          harvestedAt: toSafeNumber(fruit?.harvestedAt),
          plantedAt: toSafeNumber(fruit?.plantedAt),
          readyAt,
          isReady,
          isDead,
          isGrowing,
          isEmpty: !fruitName || !fruit?.plantedAt,
          fertiliser: patch?.fertiliser?.name || null,
        });
      }
    }

    // 7. Hoa & Mật ong (Flowers & Beehives) với tọa độ x, y
    const beehives = [];
    const DEFAULT_HONEY_PRODUCTION_TIME = 24 * 60 * 60 * 1000; // 86,400,000 ms = 1 hũ mật đầy 100%

    if (state.beehives && typeof state.beehives === "object") {
      for (const [id, hive] of Object.entries(state.beehives)) {
        if ((hive?.x === undefined && hive?.coordinates?.x === undefined) || hive?.removedAt > 0) continue;

        const baseProduced = toSafeNumber(hive?.honey?.produced);
        const updatedAt = toSafeNumber(hive?.honey?.updatedAt);
        const attachedFlowers = (Array.isArray(hive?.flowers) ? hive.flowers : [])
          .slice()
          .sort((a, b) => (toSafeNumber(a.attachedAt) - toSafeNumber(b.attachedAt)));

        const producedMs = attachedFlowers.reduce((produced, attachedFlower) => {
          const start = Math.max(updatedAt, toSafeNumber(attachedFlower.attachedAt));
          const end = Math.min(now, toSafeNumber(attachedFlower.attachedUntil));
          const honey = Math.max(end - start, 0) * (toSafeNumber(attachedFlower.rate) || 1);
          return produced + honey;
        }, baseProduced);

        const percentage = Math.min(100, Math.round((producedMs / DEFAULT_HONEY_PRODUCTION_TIME) * 10000) / 100);
        const isReady = producedMs >= DEFAULT_HONEY_PRODUCTION_TIME;

        beehives.push({
          id: String(id),
          x: toSafeNumber(hive?.x ?? hive?.coordinates?.x),
          y: toSafeNumber(hive?.y ?? hive?.coordinates?.y),
          honeyProducedMs: producedMs,
          percentage: percentage,
          isReady: isReady,
          swarm: !!hive?.swarm,
        });
      }
    }

    const flowers = [];
    if (state.flowers && typeof state.flowers?.flowerBeds === "object") {
      for (const [id, bed] of Object.entries(state.flowers.flowerBeds)) {
        if ((bed?.x === undefined && bed?.coordinates?.x === undefined) || bed?.removedAt > 0) continue;

        const flower = bed?.flower;
        flowers.push({
          id,
          x: toSafeNumber(bed?.x ?? bed?.coordinates?.x),
          y: toSafeNumber(bed?.y ?? bed?.coordinates?.y),
          name: flower?.name || "Empty",
          plantedAt: toSafeNumber(flower?.plantedAt),
          isReady: flower?.plantedAt ? (toSafeNumber(flower?.readyAt) <= now) : false,
        });
      }
    }

    // 8. Nấm (Mushrooms) với tọa độ x, y
    const mushrooms = [];
    if (state.mushrooms?.mushrooms && typeof state.mushrooms.mushrooms === "object") {
      for (const [id, m] of Object.entries(state.mushrooms.mushrooms)) {
        if (m?.x === undefined && m?.coordinates?.x === undefined) continue;
        mushrooms.push({ id, name: m?.name || "Mushroom", x: toSafeNumber(m?.x ?? m?.coordinates?.x), y: toSafeNumber(m?.y ?? m?.coordinates?.y) });
      }
    }

    // 9. Công trình xây dựng & Tọa độ (Buildings with Coordinates)
    const buildings = {};
    if (state.buildings && typeof state.buildings === "object") {
      for (const [name, list] of Object.entries(state.buildings)) {
        const arr = Array.isArray(list) ? list : (typeof list === "object" ? Object.values(list) : [list]);
        buildings[name] = arr
          .filter((b) => (b?.coordinates?.x !== undefined || b?.x !== undefined) && (b?.coordinates?.y !== undefined || b?.y !== undefined))
          .map((b) => ({
            id: String(b?.id || ""),
            x: toSafeNumber(b?.coordinates?.x ?? b?.x),
            y: toSafeNumber(b?.coordinates?.y ?? b?.y),
            readyAt: toSafeNumber(b?.readyAt),
            createdAt: toSafeNumber(b?.createdAt),
          }));
      }
    }

    // 10. Vật phẩm trang trí & NFT Booster (Collectibles with Coordinates)
    const collectibles = {};
    if (state.collectibles && typeof state.collectibles === "object") {
      for (const [name, list] of Object.entries(state.collectibles)) {
        const arr = Array.isArray(list) ? list : (typeof list === "object" ? Object.values(list) : [list]);
        collectibles[name] = arr
          .filter((c) => (c?.coordinates?.x !== undefined || c?.x !== undefined) && (c?.coordinates?.y !== undefined || c?.y !== undefined))
          .map((c) => ({
            id: String(c?.id || ""),
            x: toSafeNumber(c?.coordinates?.x ?? c?.x),
            y: toSafeNumber(c?.coordinates?.y ?? c?.y),
            readyAt: toSafeNumber(c?.readyAt),
            createdAt: toSafeNumber(c?.createdAt),
          }));
      }
    }

    // 11. Đơn hàng giao nhận (Deliveries / Orders)
    const orders = [];
    if (Array.isArray(state.delivery?.orders)) {
      for (const ord of state.delivery.orders) {
        orders.push({
          id: ord.id,
          from: ord.from,
          items: ord.items,
          reward: ord.reward,
          completedAt: ord.completedAt || null,
        });
      }
    }

    // 12. Dữ liệu Thùng ủ phân (Composters)
    const SEASON_COMPOST_REQUIREMENTS = {
      "Compost Bin": {
        spring: { Rhubarb: 10, Carrot: 5 },
        summer: { Zucchini: 10, Pepper: 2 },
        autumn: { Yam: 15 },
        winter: { Potato: 10, Cabbage: 3 },
      },
      "Turbo Composter": {
        spring: { Soybean: 5, Corn: 3 },
        summer: { Cauliflower: 4, Eggplant: 3 },
        autumn: { Broccoli: 10, Artichoke: 2 },
        winter: { Onion: 5, Turnip: 2 },
      },
      "Premium Composter": {
        spring: { Blueberry: 8, Egg: 5 },
        summer: { Banana: 3, Egg: 5 },
        autumn: { Apple: 4, Tomato: 5 },
        winter: { Lemon: 3, Apple: 3 },
      },
    };

    const compostersList = [];
    const COMPOSTER_NAMES = ["Compost Bin", "Turbo Composter", "Premium Composter"];
    const curSeason = getCurrentSeason();

    for (const cName of COMPOSTER_NAMES) {
      const bList = state.buildings?.[cName];
      if (Array.isArray(bList) && bList.length > 0) {
        for (const b of bList) {
          if (!b) continue;
          const startedAt = toSafeNumber(b.producing?.startedAt);
          const readyAt = toSafeNumber(b.producing?.readyAt);
          const isReady = !!b.producing && readyAt > 0 && readyAt <= now;
          const isProducing = !!b.producing && readyAt > now;
          const isIdle = !b.producing || (!isReady && !isProducing);

          const reqs = SEASON_COMPOST_REQUIREMENTS[cName]?.[curSeason] || {};
          let hasRequirements = Object.keys(reqs).length > 0;
          for (const [item, reqQty] of Object.entries(reqs)) {
            const curQty = toSafeNumber(state.inventory?.[item]);
            if (curQty < reqQty) {
              hasRequirements = false;
              break;
            }
          }

          compostersList.push({
            id: String(b.id || ""),
            name: cName,
            x: toSafeNumber(b.coordinates?.x ?? b.x),
            y: toSafeNumber(b.coordinates?.y ?? b.y),
            isReady,
            isProducing,
            isIdle,
            readyAt,
            startedAt,
            hasRequirements,
            requires: reqs,
          });
        }
      }
    }

    return {
      timestamp: new Date().toLocaleTimeString(),
      coins: toSafeNumber(state.coins ?? state.balance),
      balance: toSafeNumber(state.balance),
      user,
      inventory,
      resources: {
        trees: { total: trees.length, ready: trees.filter((t) => t.isReady).length, list: trees },
        minerals,
        crops: { total: crops.length, empty: emptyCropsCount, growing: growingCropsCount, ready: readyCropsCount, list: crops },
        fruitPatches: { total: fruitPatches.length, list: fruitPatches },
        beehives: { total: beehives.length, list: beehives },
        flowers: { total: flowers.length, list: flowers },
        mushrooms: { total: mushrooms.length, list: mushrooms },
      },
      buildings,
      collectibles,
      orders,
      composters: compostersList,
      farmActivity: state.farmActivity || {},
    };
  }

  // Chuẩn hóa cờ mục tiêu Captcha: Goblin / Moon Seeker / Zombie / Skeleton (Người xương)
  function _normalizeIsTarget(item) {
    if (!item || typeof item !== "object") return false;
    if (item.isGoblin === true || item.isMoonSeeker === true || item.isZombie === true || item.isSkeleton === true) return true;
    if (item.goblin === true || item.moonSeeker === true || item.zombie === true || item.skeleton === true) return true;
    const t = String(item.type || item.kind || item.role || item.name || "").toLowerCase();
    if (t === "goblin" || t.includes("moon") || t.includes("seeker") || t.includes("zomb") || t.includes("skele")) return true;
    if (typeof item.src === "string") {
      const s = item.src.toLowerCase();
      if (s.includes("skeleton") || s.includes("goblin") || s.includes("moonseeker") || s.includes("moon_seeker") || s.includes("zombie")) return true;
    }
    return false;
  }

  function _isCaptchaGridItem(first) {
    if (!first || typeof first !== "object") return false;
    if (typeof first.isGoblin === "boolean" || typeof first.isMoonSeeker === "boolean" || typeof first.isZombie === "boolean" || typeof first.isSkeleton === "boolean") return true;
    if (typeof first.goblin === "boolean" || typeof first.moonSeeker === "boolean" || typeof first.skeleton === "boolean" || typeof first.zombie === "boolean") return true;
    if (typeof first.src === "string" && (first.src.startsWith("data:image") || first.src.includes("crops") || first.src.includes("goblin") || first.src.includes("skeleton") || first.src.includes("npc") || first.src.includes("moonseeker"))) return true;
    return false;
  }

  function _mapCaptchaGridItems(st) {
    return st.map((item, idx) => ({
      index: idx,
      isGoblin: _normalizeIsTarget(item),
      src: typeof item.src === "string" ? item.src.slice(0, 120) : "",
    }));
  }

  function _findGrid16InFiber(f) {
    if (!f) return null;
    let hook = f.memoizedState;
    for (let hi = 0; hi < 80 && hook; hi += 1) {
      const st = hook.memoizedState;
      if (Array.isArray(st) && st.length === 16 && _isCaptchaGridItem(st[0])) {
        return _mapCaptchaGridItems(st);
      }
      if (st && typeof st === "object" && !Array.isArray(st)) {
        try {
          const keys = Object.keys(st);
          for (let ki = 0; ki < keys.length; ki += 1) {
            const val = st[keys[ki]];
            if (Array.isArray(val) && val.length === 16 && _isCaptchaGridItem(val[0])) {
              return _mapCaptchaGridItems(val);
            }
          }
        } catch (_e) {}
      }
      hook = hook.next;
    }
    return null;
  }

  function readCaptchaGridItems() {
    // 1. Quét tất cả các container chứa grid 16 ô trên toàn bộ trang (kể cả trong Headless UI Modal Portal)
    const allWraps = Array.from(
      document.querySelectorAll("div.flex.flex-wrap.justify-center.items-center, div.flex.flex-wrap.justify-center, div.flex.flex-wrap")
    );

    for (let wi = 0; wi < allWraps.length; wi += 1) {
      const wrap = allWraps[wi];
      if (!wrap) continue;

      const children = Array.from(wrap.children).filter(
        (el) => el && el.tagName === "DIV" && el.classList?.contains("cursor-pointer")
      );
      if (children.length !== 16) continue;
      const cells = children;

      // ── CHIẾN LƯỢC 1: Quét trực tiếp React Props & Fiber của từng ô cell và thẻ <img> bên trong ──
      const itemsDirect = [];
      let directTargetCount = 0;

      for (let i = 0; i < 16; i += 1) {
        const cell = cells[i];
        const img = cell.querySelector("img") || cell;

        let rawSrc = "";
        let isTarget = false;

        // A. Thử đọc từ React Props (thường chứa nguyên bản JSX props trước khi bị addNoise đổi thành data:image)
        const imgPropsKey = Object.keys(img).find((k) => k.startsWith("__reactProps") || k.startsWith("__reactEventHandlers"));
        if (imgPropsKey && img[imgPropsKey] && typeof img[imgPropsKey].src === "string") {
          rawSrc = img[imgPropsKey].src;
        }

        // B. Thử đọc từ React Fiber của thẻ <img>
        if (!rawSrc) {
          const imgFiberKey = Object.keys(img).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
          if (imgFiberKey && img[imgFiberKey]) {
            const ifib = img[imgFiberKey];
            rawSrc = ifib.memoizedProps?.src || ifib.pendingProps?.src || "";
          }
        }

        // C. Thử đọc từ React Props/Fiber của ô cell chứa <img>
        if (!rawSrc) {
          const cellFiberKey = Object.keys(cell).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
          if (cellFiberKey && cell[cellFiberKey]) {
            const cfib = cell[cellFiberKey];
            const ch = cfib.memoizedProps?.children || cfib.pendingProps?.children;
            if (ch && ch.props && typeof ch.props.src === "string") {
              rawSrc = ch.props.src;
            }
          }
        }

        // D. Fallback nếu thẻ <img> trên DOM chưa bị addNoise đổi thành base64
        if (!rawSrc || rawSrc.startsWith("data:")) {
          const domSrc = img.getAttribute("src") || img.currentSrc || "";
          if (domSrc && !domSrc.startsWith("data:")) {
            rawSrc = domSrc;
          }
        }

        const sLow = String(rawSrc).toLowerCase();
        if (
          sLow.includes("goblin") ||
          sLow.includes("moonseeker") ||
          sLow.includes("moon_seeker") ||
          sLow.includes("skeleton") ||
          sLow.includes("zombie")
        ) {
          isTarget = true;
          directTargetCount += 1;
        }

        itemsDirect.push({
          index: i,
          isGoblin: isTarget,
          src: sLow.slice(0, 120),
        });
      }

      // Sunflower Land Captcha luôn có đúng 3 mục tiêu (GOBLIN_COUNT = 3)
      if (directTargetCount >= 1 && directTargetCount <= 6) {
        console.log(`%c[SFL Bridge] 🎯 Đọc thành công ${directTargetCount} mục tiêu từ React Props/Fiber trực tiếp của 16 ô!`, "color: #00e676; font-weight: bold;");
        return itemsDirect;
      }

      // ── CHIẾN LƯỢC 2: Duyệt ngược cây React Fiber (f.return) để tìm State items của StopTheGoblins ──
      for (let ci2 = 0; ci2 < cells.length; ci2 += 1) {
        const cell = cells[ci2];
        const fiberKey = Object.keys(cell).find(
          (k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")
        );
        if (!fiberKey) continue;
        let f = cell[fiberKey];
        for (let depth = 0; depth < 100 && f; depth += 1) {
          const found = _findGrid16InFiber(f);
          if (found) {
            console.log("%c[SFL Bridge] 🎯 Tìm thấy 16 ô Captcha từ Hook State của StopTheGoblins!", "color: #00e676; font-weight: bold;");
            return found;
          }
          f = f.return;
        }
      }
    }

    // ── CHIẾN LƯỢC 3: Quét toàn bộ React Fiber từ tất cả các Dialog / Modal Portal ──
    const dialogs = document.querySelectorAll('[role="dialog"], div.fixed.inset-0, #root');
    for (let di = 0; di < dialogs.length; di += 1) {
      const dlg = dialogs[di];
      const dlgFiberKey = Object.keys(dlg).find(
        (k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")
      );
      if (!dlgFiberKey) continue;

      const queue = [dlg[dlgFiberKey]];
      let steps = 0;
      const visited = new Set();
      while (queue.length && steps < 15000) {
        const f = queue.shift();
        steps += 1;
        if (!f || visited.has(f)) continue;
        visited.add(f);
        const found = _findGrid16InFiber(f);
        if (found) {
          console.log("%c[SFL Bridge] 🎯 Tìm thấy 16 ô Captcha qua BFS Portal Tree!", "color: #00e676; font-weight: bold;");
          return found;
        }
        let c = f.child;
        while (c) {
          queue.push(c);
          c = c.sibling;
        }
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // GIẢI TỰ ĐỘNG CAPTCHA KÉO GHÉP HÌNH (PUZZLE DRAG CHALLENGE) QUA FIBER & CANVAS
  // ═══════════════════════════════════════════════════════════════════
  async function solvePuzzleDragCaptcha() {
    console.log("%c[SFL Bridge] 🧩 Đang phân tích và giải Captcha Puzzle Drag...", "color: #00bcd4; font-weight: bold; font-size: 13px;");

    // 1. Tìm thẻ canvas và component PuzzleDragGame
    const canvases = Array.from(document.querySelectorAll("canvas")).filter((c) => {
      const rect = c.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    let puzzleCanvas = null;
    let targetPos = null;
    let piecePos = null;
    let onSuccessFn = null;
    let cropName = null;

    for (const canvas of canvases) {
      const fiberKey = Object.keys(canvas).find(
        (k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance")
      );
      if (!fiberKey) continue;

      let f = canvas[fiberKey];
      for (let depth = 0; depth < 50 && f; depth += 1) {
        // Quét hook state
        let hook = f.memoizedState;
        let foundPieceInFiber = null;
        let foundTargetInFiber = null;
        let foundCropInFiber = null;

        while (hook) {
          const val = hook.memoizedState;

          // Kiểm tra piecePosRef (useRef({ x, y }))
          if (val && typeof val === "object" && val.current && typeof val.current.x === "number" && typeof val.current.y === "number") {
            if (val.current.x <= 50) {
              foundPieceInFiber = val.current;
            }
          }

          // Kiểm tra target (useState({ x, y }))
          if (val && typeof val === "object" && !val.current && typeof val.x === "number" && typeof val.y === "number") {
            if (val.x >= 120) {
              foundTargetInFiber = val;
            }
          }

          // Kiểm tra crop name
          if (typeof val === "string" && val.length > 2 && val.length < 30) {
            foundCropInFiber = val;
          }

          hook = hook.next;
        }

        if (foundTargetInFiber) {
          puzzleCanvas = canvas;
          targetPos = { ...foundTargetInFiber };
          piecePos = foundPieceInFiber ? { ...foundPieceInFiber } : { x: 15, y: 60 };
          cropName = foundCropInFiber;
          if (typeof f.memoizedProps?.onSuccess === "function") {
            onSuccessFn = f.memoizedProps.onSuccess;
          }
          break;
        }

        f = f.return;
      }

      if (puzzleCanvas && targetPos) break;
    }

    // Nếu không tìm thấy canvas từ Fiber, tìm bất kỳ canvas nào trong modal
    if (!puzzleCanvas && canvases.length > 0) {
      for (const c of canvases) {
        const modal = c.closest("[role='dialog'], .fixed, div[class*='modal'], div[class*='Modal']") || c.parentElement;
        const txt = (modal?.textContent || document.body.textContent || "").toLowerCase();
        if (txt.includes("drag") || txt.includes("empty slot") || txt.includes("puzzle") || txt.includes("quick check")) {
          puzzleCanvas = c;
          break;
        }
      }
      if (!puzzleCanvas) puzzleCanvas = canvases[0];
    }

    if (!puzzleCanvas) {
      console.warn("[SFL Bridge] ⚠️ Không tìm thấy thẻ canvas của Puzzle Drag.");
      return { success: false, reason: "no_canvas" };
    }

    const rect = puzzleCanvas.getBoundingClientRect();
    const CANVAS_WIDTH = puzzleCanvas.width || 300;
    const CANVAS_HEIGHT = puzzleCanvas.height || 150;
    const scaleX = rect.width / CANVAS_WIDTH;
    const scaleY = rect.height / CANVAS_HEIGHT;

    // 2. Nếu chưa có tọa độ từ Fiber -> Quét pixel trực tiếp trên Canvas
    if (!targetPos || targetPos.x === undefined) {
      try {
        const ctx = puzzleCanvas.getContext("2d");
        if (ctx) {
          const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          const data = imgData.data;

          let silMinX = CANVAS_WIDTH, silMaxX = 0, silMinY = CANVAS_HEIGHT, silMaxY = 0;
          let silCount = 0;

          // Quét silhouette ở nửa bên phải (x >= 120)
          for (let y = 5; y < CANVAS_HEIGHT - 5; y++) {
            for (let x = 120; x < CANVAS_WIDTH - 5; x++) {
              const idx = (y * CANVAS_WIDTH + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];

              // Silhouette màu tối #3e2731 (r=62, g=39, b=49) hoặc độ sáng thấp
              const isSilhouette =
                a > 150 &&
                ((Math.abs(r - 62) <= 30 && Math.abs(g - 39) <= 30 && Math.abs(b - 49) <= 30) ||
                 (r < 75 && g < 55 && b < 65));

              if (isSilhouette) {
                silCount++;
                if (x < silMinX) silMinX = x;
                if (x > silMaxX) silMaxX = x;
                if (y < silMinY) silMinY = y;
                if (y > silMaxY) silMaxY = y;
              }
            }
          }

          if (silCount > 10) {
            targetPos = {
              x: silMinX,
              y: silMinY,
            };
          }

          // Quét mảnh ghép ở nửa bên trái (x < 100)
          let pMinY = CANVAS_HEIGHT, pMinX = CANVAS_WIDTH, pCount = 0;
          for (let y = 5; y < CANVAS_HEIGHT - 5; y++) {
            for (let x = 5; x < 90; x++) {
              const idx = (y * CANVAS_WIDTH + x) * 4;
              const a = data[idx + 3];
              if (a > 80) {
                pCount++;
                if (x < pMinX) pMinX = x;
                if (y < pMinY) pMinY = y;
              }
            }
          }

          if (pCount > 10) {
            piecePos = {
              x: pMinX <= 25 ? pMinX : 15,
              y: pMinY,
            };
          }
        }
      } catch (_e) {}
    }

    if (!targetPos) {
      targetPos = { x: 210, y: 60 };
    }
    if (!piecePos) {
      piecePos = { x: 15, y: 60 };
    }

    console.log(`%c[SFL Bridge] 🎯 Tọa độ chuẩn xác: Mảnh (${piecePos.x}, ${piecePos.y}) -> Ô trống (${targetPos.x}, ${targetPos.y})`, "color: #00e676; font-weight: bold;");

    // Tâm mảnh ghép (PIECE_SIZE = 36px / 2 = 18px)
    const PIECE_HALF = 18;
    const startClientX = rect.left + (piecePos.x + PIECE_HALF) * scaleX;
    const startClientY = rect.top + (piecePos.y + PIECE_HALF) * scaleY;
    const endClientX = rect.left + (targetPos.x + PIECE_HALF) * scaleX;
    const endClientY = rect.top + (targetPos.y + PIECE_HALF) * scaleY;

    // 3. Thực hiện chuỗi sự kiện Drag & Drop hoàn chỉnh
    const baseOpts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: startClientX,
      clientY: startClientY,
      pageX: startClientX + (window.scrollX || 0),
      pageY: startClientY + (window.scrollY || 0),
      screenX: startClientX,
      screenY: startClientY,
      which: 1,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      pressure: 0.5,
    };

    // A. Pointer Down
    try {
      puzzleCanvas.dispatchEvent(new PointerEvent("pointerover", { ...baseOpts, buttons: 0 }));
      puzzleCanvas.dispatchEvent(new PointerEvent("pointerenter", { ...baseOpts, buttons: 0 }));
      puzzleCanvas.dispatchEvent(new PointerEvent("pointerdown", baseOpts));
    } catch (_e) {}
    try {
      puzzleCanvas.dispatchEvent(new MouseEvent("mouseover", { ...baseOpts, buttons: 0 }));
      puzzleCanvas.dispatchEvent(new MouseEvent("mouseenter", { ...baseOpts, buttons: 0 }));
      puzzleCanvas.dispatchEvent(new MouseEvent("mousedown", baseOpts));
    } catch (_e) {}

    // Kích hoạt React Props onPointerDown trực tiếp
    const canvasFiberKey = Object.keys(puzzleCanvas).find((k) => k.startsWith("__reactProps") || k.startsWith("__reactEventHandlers"));
    const canvasProps = canvasFiberKey ? puzzleCanvas[canvasFiberKey] : null;
    if (typeof canvasProps?.onPointerDown === "function") {
      try {
        canvasProps.onPointerDown({
          ...baseOpts,
          target: puzzleCanvas,
          currentTarget: puzzleCanvas,
          stopPropagation: () => {},
          preventDefault: () => {},
        });
      } catch (_e) {}
    }

    await new Promise((r) => setTimeout(r, 80));

    // B. Pointer Move (16 bước di chuyển tự nhiên)
    const steps = 16;
    for (let s = 1; s <= steps; s++) {
      const progress = s / steps;
      const curX = startClientX + (endClientX - startClientX) * progress;
      const curY = startClientY + (endClientY - startClientY) * progress;

      const moveOpts = {
        ...baseOpts,
        clientX: curX,
        clientY: curY,
        pageX: curX + (window.scrollX || 0),
        pageY: curY + (window.scrollY || 0),
        screenX: curX,
        screenY: curY,
      };

      try {
        puzzleCanvas.dispatchEvent(new PointerEvent("pointermove", moveOpts));
        document.dispatchEvent(new PointerEvent("pointermove", moveOpts));
        window.dispatchEvent(new PointerEvent("pointermove", moveOpts));
      } catch (_e) {}

      try {
        puzzleCanvas.dispatchEvent(new MouseEvent("mousemove", moveOpts));
        document.dispatchEvent(new MouseEvent("mousemove", moveOpts));
      } catch (_e) {}

      if (typeof canvasProps?.onPointerMove === "function") {
        try {
          canvasProps.onPointerMove({
            ...moveOpts,
            target: puzzleCanvas,
            currentTarget: puzzleCanvas,
            stopPropagation: () => {},
            preventDefault: () => {},
          });
        } catch (_e) {}
      }

      await new Promise((r) => setTimeout(r, 18));
    }

    // C. Pointer Up & Drop
    const upOpts = {
      ...baseOpts,
      clientX: endClientX,
      clientY: endClientY,
      pageX: endClientX + (window.scrollX || 0),
      pageY: endClientY + (window.scrollY || 0),
      screenX: endClientX,
      screenY: endClientY,
      buttons: 0,
      pressure: 0,
    };

    try {
      puzzleCanvas.dispatchEvent(new PointerEvent("pointerup", upOpts));
      document.dispatchEvent(new PointerEvent("pointerup", upOpts));
      window.dispatchEvent(new PointerEvent("pointerup", upOpts));
    } catch (_e) {}

    try {
      puzzleCanvas.dispatchEvent(new MouseEvent("mouseup", upOpts));
      document.dispatchEvent(new MouseEvent("mouseup", upOpts));
      puzzleCanvas.dispatchEvent(new MouseEvent("click", upOpts));
    } catch (_e) {}

    if (typeof canvasProps?.onPointerUp === "function") {
      try {
        canvasProps.onPointerUp({
          ...upOpts,
          target: puzzleCanvas,
          currentTarget: puzzleCanvas,
          stopPropagation: () => {},
          preventDefault: () => {},
        });
      } catch (_e) {}
    }

    // D. Đảm bảo onSuccess được gọi nếu PuzzleDragGame chưa tự trigger sau 500ms
    if (typeof onSuccessFn === "function") {
      setTimeout(() => {
        try {
          onSuccessFn();
          console.log("%c[SFL Bridge] 🚀 Đã xác nhận hoàn tất Puzzle Drag qua onSuccess React callback!", "color: #00e676; font-weight: bold;");
        } catch (_e) {}
      }, 500);
    }

    console.log("%c[SFL Bridge] ✔️ Hoàn thành thao tác kéo thả Puzzle Drag!", "color: #00e676; font-weight: bold;");
    return {
      success: true,
      target: targetPos,
      piece: piecePos,
      crop: cropName,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // GIẢI TỰ ĐỘNG CAPTCHA XOAY HÌNH (ROTATE COLLECTIBLE) CHUẨN XÁC 100%
  // ═══════════════════════════════════════════════════════════════════
  async function solveRotateCollectibleCaptcha() {
    console.log("%c[SFL Bridge] 🔄 Đang phân tích và giải Captcha Xoay Hình...", "color: #00bcd4; font-weight: bold; font-size: 13px;");

    // 1. Tìm Modal Captcha Xoay Hình
    const modals = Array.from(document.querySelectorAll("[role='dialog'], .fixed, div[class*='modal'], div[class*='Modal'], #root"));
    let rotateModal = null;
    for (const m of modals) {
      const txt = (m.textContent || "").toLowerCase();
      if (txt.includes("rotate the item") || txt.includes("until it is upright") || (txt.includes("rotate") && txt.includes("submit")) || (txt.includes("quick check") && (txt.includes("farming") || txt.includes("challenge")) && !m.querySelector("canvas"))) {
        rotateModal = m;
        break;
      }
    }
    if (!rotateModal) rotateModal = document.body;

    // 2. Tìm ảnh Collectible đang bị xoay
    let rotateImg = null;
    const allImgs = Array.from(rotateModal.querySelectorAll("img"));
    for (const im of allImgs) {
      const st = (im.getAttribute("style") || im.style?.transform || "").toLowerCase();
      const cls = (im.className || "").toLowerCase();
      const src = (im.src || im.getAttribute("src") || "").toLowerCase();
      if (st.includes("rotate(") || cls.includes("transition-transform") || src.includes("nancy") || src.includes("scarecrow") || src.includes("kuebiko") || src.includes("gnome") || src.includes("cat") || src.includes("dog") || src.includes("chicken") || src.includes("beaver") || src.includes("rocket")) {
        rotateImg = im;
        break;
      }
    }

    // 3. Tìm React Fiber của RotateCollectibleGame
    let rotateFiber = null;
    let currentSteps = null;
    let setStepsDispatcher = null;
    let onSuccessFn = null;

    const candidates = [rotateImg, rotateModal.querySelector("button"), rotateModal].filter(Boolean);
    for (const el of candidates) {
      const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
      if (!fiberKey) continue;

      let f = el[fiberKey];
      for (let depth = 0; depth < 50 && f; depth++) {
        let hook = f.memoizedState;
        let foundCollectible = false;
        let stepsVal = null;
        let dispFn = null;

        while (hook) {
          const val = hook.memoizedState;
          if (typeof val === "string" && ["Nancy", "Scarecrow", "Kuebiko", "Gnome", "Farm Cat", "Farm Dog", "Chicken Coop", "Woody the Beaver", "Rocket Statue"].includes(val)) {
            foundCollectible = true;
          }
          if (typeof val === "number") {
            stepsVal = val;
            if (typeof hook.queue?.dispatch === "function") {
              dispFn = hook.queue.dispatch;
            }
          }
          hook = hook.next;
        }

        if (foundCollectible || (stepsVal !== null && dispFn)) {
          rotateFiber = f;
          currentSteps = stepsVal;
          setStepsDispatcher = dispFn;
          if (typeof f.memoizedProps?.onSuccess === "function") {
            onSuccessFn = f.memoizedProps.onSuccess;
          }
          break;
        }

        f = f.return;
      }
      if (rotateFiber) break;
    }

    // 4. Tìm các nút điều khiển (Trái, Phải, Submit)
    const allButtons = Array.from(rotateModal.querySelectorAll("button, [role='button'], div[class*='cursor-pointer']")).filter((b) => {
      const rect = b.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    let btnLeft = null;
    let btnRight = null;
    let btnSubmit = null;

    for (const b of allButtons) {
      const txt = (b.textContent || "").trim().toLowerCase();
      const cls = (b.className || "").toLowerCase();
      const img = b.querySelector("img");
      const src = (img?.src || img?.getAttribute("src") || "").toLowerCase();

      if (!btnLeft && (src.includes("arrow_left") || src.includes("left.png") || cls.includes("mr-2"))) {
        btnLeft = b.tagName === "BUTTON" ? b : (b.closest("button") || b);
      }
      if (!btnRight && (src.includes("arrow_right") || src.includes("right.png") || cls.includes("ml-2"))) {
        btnRight = b.tagName === "BUTTON" ? b : (b.closest("button") || b);
      }
      if (!btnSubmit && (txt === "submit" || txt.includes("submit") || txt === "xác nhận" || txt === "gửi")) {
        btnSubmit = b.tagName === "BUTTON" ? b : (b.closest("button") || b);
      }
    }

    // Fallback nếu không khớp icon
    if (!btnLeft || !btnRight || !btnSubmit) {
      const pureBtns = allButtons.filter((b) => b.tagName === "BUTTON" || b.getAttribute("role") === "button");
      if (pureBtns.length >= 3) {
        if (!btnLeft) btnLeft = pureBtns[0];
        if (!btnRight) btnRight = pureBtns[1];
        if (!btnSubmit) btnSubmit = pureBtns[2];
      }
    }

    // Helper kích hoạt click chuẩn xác lên button (bao gồm DOM events & React Props)
    function clickNut(btn) {
      if (!btn) return;
      const target = btn.tagName === "BUTTON" ? btn : (btn.closest("button") || btn);
      const view = window;
      const rect = target.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const opts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view,
        clientX: cx,
        clientY: cy,
        which: 1,
        button: 0,
        buttons: 1,
      };

      try { target.dispatchEvent(new PointerEvent("pointerdown", opts)); } catch (_e) {}
      try { target.dispatchEvent(new MouseEvent("mousedown", opts)); } catch (_e) {}
      try { target.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 })); } catch (_e) {}
      try { target.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 })); } catch (_e) {}
      try { target.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 })); } catch (_e) {}
      try { target.click?.(); } catch (_e) {}

      // Kích hoạt React memoizedProps onClick
      for (const k in target) {
        if (k.startsWith("__reactProps") || k.startsWith("__reactEventHandlers")) {
          const p = target[k];
          if (typeof p?.onClick === "function") {
            try { p.onClick({ stopPropagation: () => {}, preventDefault: () => {}, target, currentTarget: target, button: 0 }); } catch (_e) {}
          }
        }
      }
      if (target.firstElementChild) {
        for (const k in target.firstElementChild) {
          if (k.startsWith("__reactProps") || k.startsWith("__reactEventHandlers")) {
            const p = target.firstElementChild[k];
            if (typeof p?.onClick === "function") {
              try { p.onClick({ stopPropagation: () => {}, preventDefault: () => {}, target, currentTarget: target, button: 0 }); } catch (_e) {}
            }
          }
        }
      }
    }

    // Đọc góc xoay chính xác từ DOM hoặc Fiber
    function layStepsHienTai() {
      // Ưu tiên 1: Đọc từ Fiber hook nếu có
      if (rotateFiber) {
        let hook = rotateFiber.memoizedState;
        while (hook) {
          if (typeof hook.memoizedState === "number") {
            return hook.memoizedState;
          }
          hook = hook.next;
        }
      }

      // Ưu tiên 2: Đọc từ inline style của ảnh
      if (rotateImg) {
        const st = rotateImg.getAttribute("style") || rotateImg.style?.transform || "";
        const m = st.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*deg\)/i);
        if (m) {
          const deg = parseFloat(m[1]);
          return Math.round(deg / 45);
        }

        // Đọc từ React Props của ảnh
        for (const k in rotateImg) {
          if (k.startsWith("__reactFiber") || k.startsWith("__reactProps")) {
            const p = rotateImg[k]?.memoizedProps || rotateImg[k];
            const stProp = p?.style?.transform;
            if (typeof stProp === "string") {
              const m2 = stProp.match(/rotate\(\s*(-?\d+(?:\.\d+)?)\s*deg\)/i);
              if (m2) return Math.round(parseFloat(m2[1]) / 45);
            }
          }
        }
      }

      return currentSteps !== null ? currentSteps : 0;
    }

    // 5. Nếu có Dispatcher từ React Fiber -> Set trực tiếp về 0 (0° thẳng đứng)
    if (typeof setStepsDispatcher === "function") {
      try {
        setStepsDispatcher(0);
        console.log("%c[SFL Bridge] 🎯 Đã gán trực tiếp steps = 0 qua React Fiber Dispatcher!", "color: #00e676; font-weight: bold;");
        await new Promise((r) => setTimeout(r, 150));
      } catch (_eDisp) {}
    }

    // 6. Đồng thời xoay bằng click nút để đảm bảo React State & DOM đồng bộ hoàn toàn
    for (let loop = 0; loop < 10; loop++) {
      const steps = layStepsHienTai();
      const stepsMod = ((steps % 8) + 8) % 8;

      console.log(`[SFL Bridge] 📐 Trạng thái xoay: steps = ${steps} (lệch ${stepsMod}/8 bước)`);

      if (stepsMod === 0) {
        console.log("%c[SFL Bridge] 🎯 ĐÃ THẲNG ĐỨNG HOÀN TOÀN (0°)! Chuẩn bị Submit...", "color: #00e676; font-weight: bold;");
        break;
      }

      if (stepsMod <= 4 && btnLeft) {
        clickNut(btnLeft);
      } else if (btnRight) {
        clickNut(btnRight);
      } else if (btnLeft) {
        clickNut(btnLeft);
      }

      await new Promise((r) => setTimeout(r, 220));
    }

    await new Promise((r) => setTimeout(r, 250));

    // 7. Bấm nút Submit
    if (btnSubmit) {
      console.log("%c[SFL Bridge] 🚀 Bấm nút Submit kết quả xoay...", "color: #00e676; font-weight: bold;");
      clickNut(btnSubmit);
    }

    // 8. Dự phòng gọi onSuccess trực tiếp nếu component chưa xử lý sau 500ms
    if (typeof onSuccessFn === "function") {
      setTimeout(() => {
        try {
          onSuccessFn();
          console.log("%c[SFL Bridge] 🚀 Đã xác nhận hoàn tất Rotate Captcha qua onSuccess React callback!", "color: #00e676; font-weight: bold;");
        } catch (_e) {}
      }, 500);
    }

    return { success: true };
  }

  // Tìm hàm shortcutItem từ React Fiber để chọn vật phẩm trực tiếp không cần mở kho
  let cachedShortcutItem = null;
  function findShortcutItemFn() {
    if (typeof cachedShortcutItem === "function") return cachedShortcutItem;
    findGameService();
    if (typeof cachedShortcutItem === "function") return cachedShortcutItem;

    // 2. Thử tìm trên Phaser Game Registry
    try {
      const phaserGame = window.Phaser?.GAMES?.[0] || document.querySelector("canvas")?.__phaserGame;
      const fn = phaserGame?.registry?.get?.("shortcutItem");
      if (typeof fn === "function") {
        cachedShortcutItem = fn;
        return cachedShortcutItem;
      }
    } catch (_e) {}

    // 3. Thử tìm từ các phần tử DOM trên trang bằng cách duyệt ngược f.return
    const elements = document.querySelectorAll('[data-map-placement], [role="button"], button, .cursor-pointer, #root');
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"));
      if (!fiberKey) continue;
      let f = el[fiberKey];
      for (let depth = 0; depth < 50 && f; depth++) {
        const val = f.memoizedProps?.value || f.memoizedProps;
        if (val && typeof val === "object") {
          if (typeof val.shortcutItem === "function") {
            cachedShortcutItem = val.shortcutItem;
            return cachedShortcutItem;
          }
        }
        f = f.return;
      }
    }

    return null;
  }

  // Chọn vật phẩm trên thanh Hotbar ngoài màn hình nếu có
  function selectItemFromHotbar(itemName) {
    const slug = itemName.toLowerCase().replace(/\s+/g, "_");
    const baseCrop = itemName.toLowerCase().replace(/\s*seed\s*/i, "").trim();
    const imgs = document.querySelectorAll("img");
    for (const img of imgs) {
      if (img.closest('[role="dialog"], .scrollable, .overflow-y-auto')) continue;
      const src = (img.src || img.getAttribute("src") || "").toLowerCase();
      const alt = (img.alt || img.getAttribute("alt") || "").toLowerCase();
      const match =
        src.includes(slug) ||
        (src.includes(baseCrop) && src.includes("seed")) ||
        src.includes(`${baseCrop}_seed`) ||
        (alt.includes(baseCrop) && alt.includes("seed")) ||
        (slug.includes("sprout") && (src.includes("sprout_mix") || src.includes("fertiliser"))) ||
        (slug.includes("rapid") && src.includes("rapid_root"));

      if (match) {
        const btn = img.closest("button, [role='button'], div.cursor-pointer, [class*='cursor-pointer']") || img;
        try {
          btn.click();
          return true;
        } catch (_e) {}
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════
  // TÍNH NĂNG CHẾ TẠO / MUA CÔNG CỤ QUA GAME SERVICE (XState Engine)
  // ═══════════════════════════════════════════════════════════════════
  const WORKBENCH_TOOL_SPECS = [
    {
      name: "Gold Pickaxe",
      basePrice: 100,
      ingredients: { Wood: 3, Gold: 3 },
      stockDefault: 5,
      skillName: "Frugal Miner",
      isPickaxe: true,
    },
    {
      name: "Iron Pickaxe",
      basePrice: 80,
      ingredients: { Wood: 3, Iron: 5 },
      stockDefault: 5,
      skillName: "Frugal Miner",
      isPickaxe: true,
    },
    {
      name: "Stone Pickaxe",
      basePrice: 20,
      ingredients: { Wood: 3, Stone: 5 },
      stockDefault: 20,
      skillName: "Frugal Miner",
      isPickaxe: true,
    },
    {
      name: "Pickaxe",
      basePrice: 20,
      ingredients: { Wood: 3 },
      stockDefault: 60,
      skillName: "Frugal Miner",
      isPickaxe: true,
    },
    {
      name: "Oil Drill",
      basePrice: 100,
      ingredients: { Wood: 20, Iron: 9, Leather: 10 },
      stockDefault: 5,
      requiredIsland: "desert",
    },
    {
      name: "Rod",
      basePrice: 20,
      ingredients: { Wood: 3, Stone: 1 },
      stockDefault: 50,
      skillName: "Reel Deal",
    },
    {
      name: "Axe",
      basePrice: 20,
      ingredients: {},
      stockDefault: 200,
      skillName: "Feller's Discount",
    },
  ];

  function calculateToolPrice(toolSpec, state) {
    let price = toolSpec.basePrice;
    const bumpkin = state?.bumpkin;
    const skills = bumpkin?.skills || {};

    if (toolSpec.name === "Axe") {
      const rank = toSafeNumber(skills["Feller's Discount"]);
      if (rank > 0) {
        const multipliers = [0.8, 0.6, 0.5];
        price = price * (multipliers[rank - 1] || 0.5);
      }
    } else if (toolSpec.isPickaxe) {
      const rank = toSafeNumber(skills["Frugal Miner"]);
      if (rank > 0) {
        const multipliers = [0.8, 0.6, 0.5];
        price = price * (multipliers[rank - 1] || 0.5);
      }
    } else if (toolSpec.name === "Rod") {
      const rank = toSafeNumber(skills["Reel Deal"]);
      if (rank > 0) {
        const multipliers = [0.5, 0.4, 0.3];
        price = price * (multipliers[rank - 1] || 0.3);
      }
    }

    if (toSafeNumber(state?.inventory?.["Artist"]) >= 1) {
      price = price * 0.9;
    }

    return Math.max(1, Math.round(price));
  }

  function getMaxCraftableAmount(toolSpec, state, currentCoins, currentInv) {
    const name = toolSpec.name;
    const unitPrice = calculateToolPrice(toolSpec, state);

    // Kiểm tra đảo yêu cầu
    if (toolSpec.requiredIsland) {
      const islandType = String(state?.island?.type || "").toLowerCase();
      if (!islandType.includes(toolSpec.requiredIsland) && !islandType.includes("volcano")) {
        return 0;
      }
    }

    // 1. Kiểm tra stock — CHỈ mua khi server cung cấp stock thực tế > 0
    // TUYỆT ĐỐI KHÔNG dùng stockDefault làm fallback tránh mua khi shop đóng/hết hàng
    let stock = 0;
    if (state.stock && state.stock[name] !== undefined) {
      stock = toSafeNumber(state.stock[name]);
    } else {
      // Không có dữ liệu stock từ server → bỏ qua hoàn toàn, không mua
      return 0;
    }
    if (stock <= 0) return 0;

    // 2. Giới hạn bởi Coins
    const maxAffordable = Math.floor(currentCoins / unitPrice);
    if (maxAffordable <= 0) return 0;

    let maxAmount = Math.min(stock, maxAffordable);

    // 3. Giới hạn bởi nguyên liệu (Ingredients)
    for (const [ingName, ingReq] of Object.entries(toolSpec.ingredients)) {
      const available = toSafeNumber(currentInv[ingName]);
      const maxByIng = Math.floor(available / ingReq);
      maxAmount = Math.min(maxAmount, maxByIng);
      if (maxAmount <= 0) return 0;
    }

    return maxAmount;
  }

  function craftSingleToolViaService(toolName, amount = 1) {
    const svc = findGameService();
    if (!svc) return { ok: false, error: "no_service", message: "Game Service chưa sẵn sàng" };

    const state = getGameState();
    if (!state) return { ok: false, error: "no_state", message: "Không lấy được Game State" };

    const spec = WORKBENCH_TOOL_SPECS.find((t) => t.name.toLowerCase() === String(toolName).toLowerCase()) || {
      name: toolName,
      basePrice: 20,
      ingredients: {},
      stockDefault: 100,
    };

    const currentCoins = toSafeNumber(state.coins);
    const currentInv = {};
    if (state.inventory) {
      for (const [k, v] of Object.entries(state.inventory)) {
        currentInv[k] = toSafeNumber(v);
      }
    }

    const maxQty = getMaxCraftableAmount(spec, state, currentCoins, currentInv);
    const targetAmount = Math.min(amount, maxQty > 0 ? maxQty : amount);

    if (targetAmount <= 0) {
      return { ok: false, error: "not_enough_resources", message: "Không đủ coin hoặc nguyên liệu để chế tạo" };
    }

    try {
      svc.send({
        type: "tool.crafted",
        tool: spec.name,
        amount: targetAmount,
      });

      try { svc.send({ type: "SAVE" }); } catch (_e) {}

      return {
        ok: true,
        tool: spec.name,
        amount: targetAmount,
        cost: calculateToolPrice(spec, state) * targetAmount,
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  function batchBuyToolsViaService() {
    const svc = findGameService();
    if (!svc) return { ok: false, error: "no_service", message: "Game Service chưa sẵn sàng" };

    const state = getGameState();
    if (!state) return { ok: false, error: "no_state", message: "Không lấy được Game State" };

    // GUARD: Phải có state.stock từ server mới được chạy
    // Nếu không có stock data → không mua gì để tránh lạm dụng
    if (!state.stock || typeof state.stock !== "object" || Object.keys(state.stock).length === 0) {
      console.warn("[SFL Bridge] ⚠️ Không có dữ liệu stock từ server → bỏ qua mua công cụ hoàn toàn.");
      return { ok: true, crafted: [], totalCoinsSpent: 0, remainingCoins: toSafeNumber(state.coins) };
    }

    let currentCoins = toSafeNumber(state.coins);
    const currentInv = {};
    if (state.inventory) {
      for (const [k, v] of Object.entries(state.inventory)) {
        currentInv[k] = toSafeNumber(v);
      }
    }

    const craftedList = [];
    let totalCoinsSpent = 0;

    for (const spec of WORKBENCH_TOOL_SPECS) {
      if (currentCoins <= 0) break;

      // Lấy stock thực tế từ server — nếu không có thì bỏ qua
      const stockThucTe = state.stock[spec.name] !== undefined ? toSafeNumber(state.stock[spec.name]) : -1;
      if (stockThucTe < 0) {
        console.log(`[SFL Bridge] ℹ️ ${spec.name}: Không có trong state.stock → bỏ qua`);
        continue;
      }
      if (stockThucTe === 0) {
        console.log(`[SFL Bridge] ℹ️ ${spec.name}: Stock = 0 (hết hàng) → bỏ qua`);
        continue;
      }

      const qty = getMaxCraftableAmount(spec, state, currentCoins, currentInv);
      if (qty <= 0) continue;

      // Giới hạn tối đa theo stock thực tế của server
      const qtyAnToan = Math.min(qty, stockThucTe);
      if (qtyAnToan <= 0) continue;

      const unitPrice = calculateToolPrice(spec, state);
      const cost = unitPrice * qtyAnToan;

      try {
        svc.send({
          type: "tool.crafted",
          tool: spec.name,
          amount: qtyAnToan,
        });

        currentCoins -= cost;
        totalCoinsSpent += cost;
        for (const [ingName, ingReq] of Object.entries(spec.ingredients)) {
          currentInv[ingName] = Math.max(0, (currentInv[ingName] || 0) - ingReq * qtyAnToan);
        }
        currentInv[spec.name] = (currentInv[spec.name] || 0) + qtyAnToan;

        craftedList.push({
          tool: spec.name,
          amount: qtyAnToan,
          unitPrice: unitPrice,
          totalCost: cost,
        });
      } catch (err) {
        console.warn(`[SFL Bridge] Bỏ qua ${spec.name} do lỗi:`, err?.message || err);
      }
    }

    if (craftedList.length > 0) {
      try { svc.send({ type: "SAVE" }); } catch (_e) {}
    }

    return {
      ok: true,
      crafted: craftedList,
      totalCoinsSpent: totalCoinsSpent,
      remainingCoins: currentCoins,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // TÍNH NĂNG MUA HẠT GIỐNG QUA GAME SERVICE (XState Engine)
  // Ưu tiên: Mua hết hạt trong mùa từ rẻ đến đắt (Crops, Fruits, Flowers, Greenhouse)
  // ═══════════════════════════════════════════════════════════════════
  const SEEDS_CATALOG = {
    // Spring
    "Sunflower Seed": { name: "Sunflower Seed", price: 0.01, level: 1, type: "crop" },
    "Potato Seed": { name: "Potato Seed", price: 0.1, level: 1, type: "crop" },
    "Rhubarb Seed": { name: "Rhubarb Seed", price: 0.15, level: 1, type: "crop" },
    "Pumpkin Seed": { name: "Pumpkin Seed", price: 0.2, level: 2, type: "crop" },
    "Zucchini Seed": { name: "Zucchini Seed", price: 0.2, level: 2, type: "crop" },
    "Carrot Seed": { name: "Carrot Seed", price: 0.5, level: 2, type: "crop" },
    "Yam Seed": { name: "Yam Seed", price: 0.5, level: 2, type: "crop" },
    "Cabbage Seed": { name: "Cabbage Seed", price: 1, level: 3, type: "crop" },
    "Broccoli Seed": { name: "Broccoli Seed", price: 1, level: 3, type: "crop" },
    "Soybean Seed": { name: "Soybean Seed", price: 1.5, level: 4, type: "crop" },
    "Beetroot Seed": { name: "Beetroot Seed", price: 2, level: 5, type: "crop" },
    "Pepper Seed": { name: "Pepper Seed", price: 2, level: 5, type: "crop" },
    "Cauliflower Seed": { name: "Cauliflower Seed", price: 3, level: 6, type: "crop" },
    "Parsnip Seed": { name: "Parsnip Seed", price: 5, level: 7, type: "crop" },
    "Wheat Seed": { name: "Wheat Seed", price: 5, level: 10, type: "crop" },
    "Eggplant Seed": { name: "Eggplant Seed", price: 6, level: 8, type: "crop" },
    "Turnip Seed": { name: "Turnip Seed", price: 6, level: 10, type: "crop" },
    "Corn Seed": { name: "Corn Seed", price: 7, level: 9, type: "crop" },
    "Radish Seed": { name: "Radish Seed", price: 7, level: 10, type: "crop" },
    "Kale Seed": { name: "Kale Seed", price: 7, level: 11, type: "crop" },
    "Onion Seed": { name: "Onion Seed", price: 7.5, level: 9, type: "crop" },
    "Artichoke Seed": { name: "Artichoke Seed", price: 9, level: 11, type: "crop" },
    "Barley Seed": { name: "Barley Seed", price: 9, level: 12, type: "crop" },

    // Fruits
    "Tomato Seed": { name: "Tomato Seed", price: 5, level: 13, type: "fruit" },
    "Lemon Seed": { name: "Lemon Seed", price: 15, level: 12, type: "fruit" },
    "Blueberry Seed": { name: "Blueberry Seed", price: 30, level: 14, type: "fruit" },
    "Orange Seed": { name: "Orange Seed", price: 50, level: 15, type: "fruit" },
    "Apple Seed": { name: "Apple Seed", price: 70, level: 16, type: "fruit" },
    "Banana Plant": { name: "Banana Plant", price: 90, level: 16, type: "fruit" },

    // Flowers
    "Sunpetal Seed": { name: "Sunpetal Seed", price: 16, level: 13, type: "flower" },
    "Bloom Seed": { name: "Bloom Seed", price: 32, level: 22, type: "flower" },
    "Lily Seed": { name: "Lily Seed", price: 48, level: 27, type: "flower" },
    "Edelweiss Seed": { name: "Edelweiss Seed", price: 48, level: 20, type: "flower" },
    "Gladiolus Seed": { name: "Gladiolus Seed", price: 48, level: 20, type: "flower" },
    "Lavender Seed": { name: "Lavender Seed", price: 48, level: 20, type: "flower" },
    "Clover Seed": { name: "Clover Seed", price: 48, level: 20, type: "flower" },

    // Greenhouse
    "Rice Seed": { name: "Rice Seed", price: 240, level: 40, type: "greenhouse" },
    "Olive Seed": { name: "Olive Seed", price: 320, level: 40, type: "greenhouse" },
    "Grape Seed": { name: "Grape Seed", price: 380, level: 40, type: "greenhouse" },
  };

  const SEASON_SEEDS_MAP = {
    spring: [
      "Sunflower Seed", "Rhubarb Seed", "Carrot Seed", "Cabbage Seed", "Soybean Seed",
      "Corn Seed", "Wheat Seed", "Kale Seed", "Barley Seed", "Tomato Seed",
      "Blueberry Seed", "Orange Seed", "Sunpetal Seed", "Bloom Seed", "Lily Seed",
      "Lavender Seed", "Rice Seed", "Olive Seed", "Grape Seed"
    ],
    summer: [
      "Sunflower Seed", "Potato Seed", "Zucchini Seed", "Pepper Seed", "Beetroot Seed",
      "Cauliflower Seed", "Eggplant Seed", "Radish Seed", "Wheat Seed", "Lemon Seed",
      "Orange Seed", "Banana Plant", "Sunpetal Seed", "Bloom Seed", "Lily Seed",
      "Gladiolus Seed", "Rice Seed", "Olive Seed", "Grape Seed"
    ],
    autumn: [
      "Potato Seed", "Pumpkin Seed", "Carrot Seed", "Yam Seed", "Broccoli Seed",
      "Soybean Seed", "Wheat Seed", "Barley Seed", "Artichoke Seed", "Tomato Seed",
      "Apple Seed", "Banana Plant", "Sunpetal Seed", "Bloom Seed", "Lily Seed",
      "Clover Seed", "Rice Seed", "Olive Seed", "Grape Seed"
    ],
    winter: [
      "Potato Seed", "Cabbage Seed", "Beetroot Seed", "Cauliflower Seed", "Parsnip Seed",
      "Onion Seed", "Turnip Seed", "Wheat Seed", "Kale Seed", "Lemon Seed",
      "Blueberry Seed", "Apple Seed", "Sunpetal Seed", "Bloom Seed", "Lily Seed",
      "Edelweiss Seed", "Rice Seed", "Olive Seed", "Grape Seed"
    ],
  };

  const SEED_BASE_STOCK = {
    // Crops
    "Sunflower Seed": 800,
    "Potato Seed": 400,
    "Rhubarb Seed": 400,
    "Zucchini Seed": 400,
    "Pumpkin Seed": 300,
    "Carrot Seed": 200,
    "Cabbage Seed": 180,
    "Yam Seed": 180,
    "Soybean Seed": 180,
    "Broccoli Seed": 180,
    "Beetroot Seed": 160,
    "Pepper Seed": 160,
    "Cauliflower Seed": 160,
    "Parsnip Seed": 120,
    "Eggplant Seed": 100,
    "Corn Seed": 100,
    "Onion Seed": 100,
    "Turnip Seed": 80,
    "Radish Seed": 80,
    "Wheat Seed": 80,
    "Kale Seed": 60,
    "Artichoke Seed": 60,
    "Barley Seed": 60,

    // Fruits
    "Tomato Seed": 20,
    "Lemon Seed": 20,
    "Blueberry Seed": 20,
    "Orange Seed": 20,
    "Apple Seed": 20,
    "Banana Plant": 20,

    // Flowers
    "Sunpetal Seed": 16,
    "Bloom Seed": 8,
    "Lily Seed": 4,
    "Edelweiss Seed": 4,
    "Gladiolus Seed": 4,
    "Lavender Seed": 4,
    "Clover Seed": 4,

    // Greenhouse
    "Rice Seed": 10,
    "Olive Seed": 10,
    "Grape Seed": 10,
  };

  function getSeedInventoryLimitMultiplier(seedName) {
    if (["Rice Seed", "Olive Seed", "Grape Seed"].includes(seedName)) return 5;
    if (["Tomato Seed", "Lemon Seed", "Blueberry Seed", "Orange Seed"].includes(seedName)) return 2;
    if (["Apple Seed", "Banana Plant"].includes(seedName)) return 1.5;
    return 2.5;
  }

  function getSeedInventoryLimit(seedName, state) {
    if (["Celestine Seed", "Lunara Seed", "Duskberry Seed"].includes(seedName)) return 10;
    const baseStock = SEED_BASE_STOCK[seedName] || 40;
    const mult = getSeedInventoryLimitMultiplier(seedName);
    let limit = Math.ceil(baseStock * mult);

    // Warehouse boost (1.2x)
    const warehouse = state?.buildings?.Warehouse;
    const hasWarehouse = Array.isArray(warehouse)
      ? warehouse.some((b) => (b.readyAt ?? 0) <= Date.now() && b.coordinates)
      : !!warehouse;
    if (hasWarehouse) {
      limit = Math.ceil(limit * 1.2);
    }
    return limit;
  }

  function calculateSeedPrice(seedSpec, state) {
    if (!seedSpec || !state) return seedSpec?.price || 1;
    let price = seedSpec.price;

    const inv = state.inventory || {};
    const bumpkin = state.bumpkin || {};
    const collectibles = state.collectibles || {};

    if (collectibles["Kuebiko"]?.length > 0 || inv["Kuebiko"]) {
      if (seedSpec.type === "crop") return 0;
    }
    if (seedSpec.type === "flower" && (collectibles["Hungry Caterpillar"]?.length > 0 || inv["Hungry Caterpillar"])) {
      return 0;
    }
    if (seedSpec.name === "Sunflower Seed" && bumpkin.equipped?.secondary === "Sunflower Shield") {
      return 0;
    }
    if (seedSpec.name === "Onion Seed" && bumpkin.equipped?.suit === "Ladybug Suit") {
      price = price * 0.75;
    }
    if (inv["Artist"]?.gte ? inv["Artist"].gte(1) : Number(inv["Artist"] || 0) >= 1) {
      price = price * 0.9;
    }

    return price;
  }

  function getMaxBuyableSeedAmount(seedSpec, state, currentCoins) {
    const bumpkinLevel = state.bumpkin?.level || 1;
    if (seedSpec.level && bumpkinLevel < seedSpec.level) {
      return 0;
    }

    // 1. Kiểm tra điều kiện ô đất trồng (Planting Spot)
    const inv = state.inventory || {};
    if (seedSpec.type === "fruit") {
      const hasFruitPatch = toSafeNumber(inv["Fruit Patch"]) >= 1 || (state.fruitPatches && Object.keys(state.fruitPatches).length > 0);
      if (!hasFruitPatch) return 0;
    }
    if (seedSpec.type === "flower") {
      const hasFlowerBed = toSafeNumber(inv["Flower Bed"]) >= 1 || (state.flowers && Object.keys(state.flowers).length > 0);
      if (!hasFlowerBed) return 0;
    }
    if (seedSpec.type === "greenhouse") {
      const hasGreenhouse = toSafeNumber(inv["Greenhouse"]) >= 1 || !!state.greenhouse;
      if (!hasGreenhouse) return 0;
    }

    // 2. Kiểm tra giới hạn kho (Inventory Limit) - Nếu đã đầy kho thì không mua
    const currentInvQty = toSafeNumber(inv[seedSpec.name]);
    const invLimit = getSeedInventoryLimit(seedSpec.name, state);
    const headroom = Math.max(0, invLimit - currentInvQty);
    if (headroom <= 0) {
      return 0; // Đã đạt giới hạn tối đa hạt giống trong kho
    }

    const unitPrice = calculateSeedPrice(seedSpec, state);

    // 3. CHỈ mua khi server cung cấp stock thực tế — KHÔNG dùng fallback mặc định
    if (!state.stock || state.stock[seedSpec.name] === undefined) {
      return 0; // Không có dữ liệu stock từ server → bỏ qua
    }
    const stock = toSafeNumber(state.stock[seedSpec.name]);
    if (stock <= 0) return 0;

    let maxBuy = Math.min(stock, headroom);
    if (unitPrice > 0) {
      const maxAffordable = Math.floor(currentCoins / unitPrice);
      if (maxAffordable <= 0) return 0;
      maxBuy = Math.min(maxBuy, maxAffordable);
    }

    return maxBuy;
  }

  function batchBuySeedsViaService(requestedSeason = null) {
    const svc = findGameService();
    if (!svc) return { ok: false, error: "no_service", message: "Game Service chưa sẵn sàng" };

    const state = getGameState();
    if (!state) return { ok: false, error: "no_state", message: "Không lấy được Game State" };

    let currentCoins = toSafeNumber(state.coins);
    if (currentCoins <= 0) {
      return { ok: true, bought: [], totalCoinsSpent: 0, message: "Hết Coins trong túi" };
    }

    // GUARD: Phải có state.stock từ server mới được chạy
    // Nếu không có stock data → không mua gì để tránh mua khi shop đóng
    if (!state.stock || typeof state.stock !== "object" || Object.keys(state.stock).length === 0) {
      console.warn("[SFL Bridge] ⚠️ Không có dữ liệu stock hạt giống từ server → bỏ qua mua hạt giống hoàn toàn.");
      return { ok: true, bought: [], totalCoinsSpent: 0, remainingCoins: currentCoins, message: "Không có stock data" };
    }

    const currentSeason = (requestedSeason || getCurrentSeason()).toLowerCase();
    const seedsInSeason = SEASON_SEEDS_MAP[currentSeason] || SEASON_SEEDS_MAP.spring;

    // Sắp xếp hạt giống trong mùa từ rẻ nhất đến đắt nhất
    const candidates = seedsInSeason
      .map((name) => SEEDS_CATALOG[name] || { name, price: 1, level: 1, type: "crop" })
      .sort((a, b) => a.price - b.price);

    const boughtList = [];
    let totalCoinsSpent = 0;

    for (const spec of candidates) {
      if (currentCoins <= 0) break;

      const qty = getMaxBuyableSeedAmount(spec, state, currentCoins);
      if (qty <= 0) continue;

      const unitPrice = calculateSeedPrice(spec, state);
      const cost = unitPrice * qty;

      try {
        svc.send({
          type: "seed.bought",
          item: spec.name,
          amount: qty,
        });

        currentCoins = Math.max(0, currentCoins - cost);
        totalCoinsSpent += cost;

        boughtList.push({
          seed: spec.name,
          amount: qty,
          unitPrice: unitPrice,
          totalCost: cost,
          type: spec.type,
        });

        console.log(`%c[SFL Bridge] 🛒 Đã mua x${qty} "${spec.name}" (${spec.type}) - Hết ${cost} Coins`, "color: #00e676; font-weight: bold;");
      } catch (err) {
        console.warn(`[SFL Bridge] Bỏ qua mua ${spec.name} do lỗi:`, err?.message || err);
      }
    }

    if (boughtList.length > 0) {
      try { svc.send({ type: "SAVE" }); } catch (_e) {}
    }

    return {
      ok: true,
      bought: boughtList,
      boughtList: boughtList,
      totalCoinsSpent: totalCoinsSpent,
      remainingCoins: currentCoins,
      season: currentSeason,
    };
  }

  function buySingleSeedViaService(seedName, amount = 1) {
    const svc = findGameService();
    if (!svc) return { ok: false, error: "no_service" };
    const state = getGameState();
    if (!state) return { ok: false, error: "no_state" };

    const spec = SEEDS_CATALOG[seedName] || { name: seedName, price: 1, level: 1, type: "crop" };
    const currentCoins = toSafeNumber(state.coins);
    const maxQty = getMaxBuyableSeedAmount(spec, state, currentCoins);
    const targetAmount = Math.min(amount, maxQty > 0 ? maxQty : amount);

    if (targetAmount <= 0) {
      return { ok: false, error: "insufficient_funds_or_level", message: "Không đủ Coins hoặc chưa đạt cấp độ" };
    }

    try {
      svc.send({
        type: "seed.bought",
        item: spec.name,
        amount: targetAmount,
      });
      try { svc.send({ type: "SAVE" }); } catch (_e) {}
      const unitPrice = calculateSeedPrice(spec, state);
      return {
        ok: true,
        seed: spec.name,
        amount: targetAmount,
        cost: unitPrice * targetAmount,
      };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  // Lắng nghe yêu cầu từ Content Script
  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data._sfl !== true) return;

    if (data.type === "SFL_READ_CAPTCHA_GRID") {
      const items = readCaptchaGridItems();
      window.postMessage({
        _sfl: true,
        type: "SFL_CAPTCHA_GRID_RESULT",
        reqId: data.reqId,
        items: items,
      }, "*");
      return;
    }

    if (data.type === "SFL_SOLVE_DRAG_PUZZLE") {
      const res = await solvePuzzleDragCaptcha();
      window.postMessage({
        _sfl: true,
        type: "SFL_SOLVE_DRAG_PUZZLE_RESULT",
        reqId: data.reqId,
        res: res,
      }, "*");
      return;
    }

    if (data.type === "SFL_SOLVE_ROTATE_CAPTCHA") {
      const res = await solveRotateCollectibleCaptcha();
      window.postMessage({
        _sfl: true,
        type: "SFL_SOLVE_ROTATE_CAPTCHA_RESULT",
        reqId: data.reqId,
        res: res,
      }, "*");
      return;
    }

    if (data.type === "SFL_SELECT_ITEM") {
      const itemName = data.itemName || "Sprout Mix";
      let ok = false;

      // 1. Thử gọi qua shortcutItem của React Context
      try {
        const fn = findShortcutItemFn();
        if (typeof fn === "function") {
          fn(itemName);
          ok = true;
          console.log(`%c[SFL Bridge] ✔️ shortcutItem("${itemName}") thành công qua React Context!`, "color: #00e676; font-weight: bold;");
        }
      } catch (e) {
        console.warn("[SFL Bridge] shortcutItem lỗi:", e);
      }

      // 2. Thử click trực tiếp trên Hotbar DOM
      if (!ok) {
        ok = selectItemFromHotbar(itemName);
        if (ok) {
          console.log(`%c[SFL Bridge] ✔️ Đã click chọn "${itemName}" trên Hotbar DOM!`, "color: #00e676; font-weight: bold;");
        }
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_SELECT_ITEM_RESULT",
        reqId: data.reqId,
        ok: ok,
        itemName: itemName,
      }, "*");
      return;
    }

    if (data.type === "SFL_BULK_FERTILISE") {
      const svc = findGameService();
      let ok = false;
      let count = 0;
      let error = null;

      if (svc) {
        try {
          const snap = svc.getSnapshot();
          const ctx = snap?.context || snap?.value?.context || {};
          const state = ctx.state || ctx.gameState || ctx;
          const fertName = data.fertiliser || "Sprout Mix";
          const initInv = toSafeNumber(state?.inventory?.[fertName]);

          if (state && state.crops && initInv > 0) {
            const getFertPlotsCount = (s) => Object.values(s?.crops || {}).filter((p) => !!p?.fertiliser).length;
            const initFertCount = getFertPlotsCount(state);

            // 1. Thử gửi event bulk fertilised của game: plots.bulkFertilised
            try {
              svc.send({
                type: "plots.bulkFertilised",
                fertiliser: fertName,
              });
            } catch (_e1) {}
            try {
              svc.send("plots.bulkFertilised", {
                fertiliser: fertName,
              });
            } catch (_e2) {}

            let postSnap = svc.getSnapshot();
            let postState = postSnap?.context?.state || postSnap?.context?.gameState || postSnap?.context || {};
            let postInv = toSafeNumber(postState?.inventory?.[fertName]);
            let postFertCount = getFertPlotsCount(postState);

            let applied = (initInv - postInv) > 0 ? (initInv - postInv) : (postFertCount - initFertCount);

            // 2. Nếu plots.bulkFertilised chưa áp dụng, duyệt từng ô ruộng với plot.fertilised
            if (applied <= 0 && postInv > 0) {
              const plotIds = Object.keys(postState.crops || {});
              for (const id of plotIds) {
                if (postInv <= 0) break;
                const plot = postState.crops[id];
                if (!plot || (plot.x === undefined && plot.coordinates?.x === undefined) || plot.removedAt > 0) continue;
                if (plot.fertiliser) continue; // Đã bón phân rồi thì bỏ qua
                // Bỏ qua cây đã chín
                if (plot.crop && plot.crop.readyAt && plot.crop.readyAt <= Date.now()) continue;

                const plotIdStr = String(id);
                try {
                  svc.send({
                    type: "plot.fertilised",
                    plotId: plotIdStr,
                    fertiliser: fertName,
                  });
                } catch (_e3) {}
                try {
                  svc.send({
                    type: "plot.fertilised",
                    index: plotIdStr,
                    fertiliser: fertName,
                  });
                } catch (_e4) {}
                try {
                  svc.send({
                    type: "plot.fertilised",
                    plotID: plotIdStr,
                    fertiliser: fertName,
                  });
                } catch (_e5) {}
                try {
                  svc.send({
                    type: "plot.fertilised",
                    plotIndex: Number(id),
                    fertiliser: fertName,
                  });
                } catch (_e6) {}
              }

              postSnap = svc.getSnapshot();
              postState = postSnap?.context?.state || postSnap?.context?.gameState || postSnap?.context || {};
              postInv = toSafeNumber(postState?.inventory?.[fertName]);
              postFertCount = getFertPlotsCount(postState);
              applied = (initInv - postInv) > 0 ? (initInv - postInv) : (postFertCount - initFertCount);
            }

            if (applied > 0) {
              ok = true;
              count = applied;
              try { svc.send({ type: "SAVE" }); } catch (_e) {}
            }
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_BULK_FERTILISE_RESULT",
        reqId: data.reqId,
        ok: ok,
        count: count,
        applied: count,
        error: error,
      }, "*");
      return;
    }

    if (data.type === "SFL_BULK_PLANT") {
      const svc = findGameService();
      let ok = false;
      let count = 0;
      let error = null;
      const plantedDetails = [];

      if (svc) {
        try {
          const snap = svc.getSnapshot();
          const ctx = snap?.context || snap?.value?.context || {};
          const state = ctx.state || ctx.gameState || ctx;

          if (state && state.crops) {
            // Lấy toàn bộ ô đất trống thực sự TRÊN ĐẢO (loại bỏ 100% ô cất trong kho/rương đồ)
            const emptyPlotIds = Object.keys(state.crops).filter((id) => {
              const p = state.crops[id];
              if (!p || (p.x === undefined && p.coordinates?.x === undefined) || p.removedAt > 0) return false;
              const plantedAt = toSafeNumber(p.crop?.plantedAt ?? p.plantedAt);
              const cropName = String(p.crop?.name || p.cropName || "").trim();
              return !cropName || plantedAt <= 0;
            });

            if (emptyPlotIds.length > 0) {
              const season = getCurrentSeason();

              const cropTimes = {
                "Sunflower Seed": 60,
                "Potato Seed": 300,
                "Rhubarb Seed": 600,
                "Pumpkin Seed": 1800,
                "Zucchini Seed": 1800,
                "Carrot Seed": 3600,
                "Yam Seed": 3600,
                "Cabbage Seed": 7200,
                "Broccoli Seed": 7200,
                "Soybean Seed": 10800,
                "Beetroot Seed": 14400,
                "Pepper Seed": 14400,
                "Cauliflower Seed": 28800,
                "Parsnip Seed": 43200,
                "Eggplant Seed": 57600,
                "Corn Seed": 72000,
                "Onion Seed": 72000,
                "Radish Seed": 86400,
                "Wheat Seed": 86400,
                "Turnip Seed": 86400,
                "Kale Seed": 129600,
                "Artichoke Seed": 129600,
                "Barley Seed": 172800,
              };

              const SEASONAL_CROP_SEEDS_TABLE = {
                spring: ["Sunflower Seed", "Rhubarb Seed", "Carrot Seed", "Cabbage Seed", "Soybean Seed", "Corn Seed", "Wheat Seed", "Kale Seed", "Barley Seed"],
                summer: ["Sunflower Seed", "Potato Seed", "Zucchini Seed", "Pepper Seed", "Beetroot Seed", "Cauliflower Seed", "Eggplant Seed", "Radish Seed", "Wheat Seed"],
                autumn: ["Potato Seed", "Pumpkin Seed", "Carrot Seed", "Yam Seed", "Broccoli Seed", "Soybean Seed", "Wheat Seed", "Barley Seed", "Artichoke Seed"],
                winter: ["Sunflower Seed", "Potato Seed", "Cabbage Seed", "Beetroot Seed", "Cauliflower Seed", "Parsnip Seed", "Onion Seed", "Turnip Seed", "Wheat Seed", "Kale Seed"],
              };

              let seedOrder = [];
              if (data.seedName && data.seedName !== "AUTO") {
                seedOrder = [data.seedName];
              } else {
                // Chỉ gieo hạt giống đúng mùa vụ hiện tại
                const seasonalCropSeeds = SEASONAL_CROP_SEEDS_TABLE[season] || SEASONAL_CROP_SEEDS_TABLE.spring;
                seedOrder = seasonalCropSeeds
                  .filter((s) => cropTimes[s] !== undefined)
                  .sort((a, b) => (cropTimes[a] || 999999) - (cropTimes[b] || 999999));
              }

              let remainingEmptyPlotIds = [...emptyPlotIds];

              for (const sName of seedOrder) {
                if (remainingEmptyPlotIds.length === 0) break;

                let available = toSafeNumber(state.inventory?.[sName]);
                if (available <= 0) continue;

                // 1. Thử gửi event bulkPlant của game: seeds.bulkPlanted
                let batchPlanted = 0;
                try {
                  try {
                    svc.send({
                      type: "seeds.bulkPlanted",
                      seed: sName,
                    });
                  } catch (_e1) {}
                  try {
                    svc.send("seeds.bulkPlanted", {
                      seed: sName,
                    });
                  } catch (_e2) {}

                  const postSnap = svc.getSnapshot();
                  const postCrops = postSnap?.context?.state?.crops || {};
                  // Kiểm tra số lượng plot đã được gieo
                  const newlyPlanted = remainingEmptyPlotIds.filter((pId) => {
                    const p = postCrops[pId];
                    return p && p.crop && p.crop.plantedAt > 0;
                  });

                  if (newlyPlanted.length > 0) {
                    batchPlanted = newlyPlanted.length;
                    remainingEmptyPlotIds = remainingEmptyPlotIds.filter((pId) => !newlyPlanted.includes(pId));
                    count += batchPlanted;
                    available = Math.max(0, available - batchPlanted);
                  }
                } catch (_bulkErr) {
                  batchPlanted = 0;
                }

                // 2. Nếu seeds.bulkPlanted chưa xử lý hết, duyệt từng ô ruộng với seed.planted
                let singlePlanted = 0;
                if (available > 0 && remainingEmptyPlotIds.length > 0) {
                  const plotsToPlant = [...remainingEmptyPlotIds];
                  for (let pi = 0; pi < plotsToPlant.length; pi++) {
                    if (available <= 0) break;
                    const plotId = plotsToPlant[pi];
                    try {
                      const cropRandomId = Math.random().toString(36).slice(2, 10);
                      try {
                        svc.send({
                          type: "seed.planted",
                          index: String(plotId),
                          item: sName,
                          cropId: cropRandomId,
                        });
                      } catch (_e3) {}
                      try {
                        svc.send("seed.planted", {
                          index: String(plotId),
                          item: sName,
                          cropId: cropRandomId,
                        });
                      } catch (_e4) {}
                      count++;
                      singlePlanted++;
                      available--;
                      remainingEmptyPlotIds = remainingEmptyPlotIds.filter((id) => id !== plotId);
                    } catch (plantErr) {
                      console.warn(`[SFL Bridge] Bỏ qua ô ${plotId} do lỗi:`, plantErr?.message || plantErr);
                    }
                  }
                }

                const totalPlantedThisSeed = batchPlanted + singlePlanted;
                if (totalPlantedThisSeed > 0) {
                  plantedDetails.push({ seed: sName, count: totalPlantedThisSeed });
                  if (state.inventory) {
                    state.inventory[sName] = available;
                  }
                }
              }

              if (count > 0) {
                ok = true;
                try { svc.send({ type: "SAVE" }); } catch (_e) {}
                try { svc.send("SAVE"); } catch (_e) {}
              }
            }
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_BULK_PLANT_RESULT",
        reqId: data.reqId,
        ok: ok,
        count: count,
        planted: plantedDetails,
        error: error,
      }, "*");
      return;
    }

    if (data.type === "SFL_HARVEST_HONEY") {
      const svc = findGameService();
      let ok = false;
      let count = 0;
      let error = null;
      if (svc) {
        try {
          const snap = svc.getSnapshot();
          const ctx = snap?.context || snap?.value?.context || {};
          const state = ctx.state || ctx.gameState || ctx;
          const DEFAULT_HONEY_PRODUCTION_TIME = 24 * 60 * 60 * 1000;
          const now = Date.now();

          if (state && state.beehives) {
            for (const [id, hive] of Object.entries(state.beehives)) {
              const baseProduced = toSafeNumber(hive?.honey?.produced);
              const updatedAt = toSafeNumber(hive?.honey?.updatedAt);
              const attachedFlowers = (Array.isArray(hive?.flowers) ? hive.flowers : [])
                .slice()
                .sort((a, b) => (toSafeNumber(a.attachedAt) - toSafeNumber(b.attachedAt)));

              const producedMs = attachedFlowers.reduce((produced, attachedFlower) => {
                const start = Math.max(updatedAt, toSafeNumber(attachedFlower.attachedAt));
                const end = Math.min(now, toSafeNumber(attachedFlower.attachedUntil));
                const honey = Math.max(end - start, 0) * (toSafeNumber(attachedFlower.rate) || 1);
                return produced + honey;
              }, baseProduced);

              // CHỈ THU HOẠCH KHI HŨ MẬT ĐÃ ĐẦY 100% (>= 86,400,000 ms)
              if (producedMs >= DEFAULT_HONEY_PRODUCTION_TIME) {
                try { svc.send({ type: "beehive.harvested", id: String(id) }); } catch (_e1) {}
                try { svc.send("beehive.harvested", { id: String(id) }); } catch (_e2) {}
                count++;
              }
            }

            if (count > 0) {
              ok = true;
              try { svc.send({ type: "SAVE" }); } catch (_e) {}
              try { svc.send("SAVE"); } catch (_e) {}
            }
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_HARVEST_HONEY_RESULT",
        reqId: data.reqId,
        ok,
        count,
        error,
      }, "*");
      return;
    }

    if (data.type === "SFL_CRAFT_TOOL") {
      const res = craftSingleToolViaService(data.toolName, data.amount || 1);
      window.postMessage({
        _sfl: true,
        type: "SFL_CRAFT_TOOL_RESULT",
        reqId: data.reqId,
        ...res,
      }, "*");
      return;
    }

    if (data.type === "SFL_BATCH_BUY_TOOLS") {
      const res = batchBuyToolsViaService();
      window.postMessage({
        _sfl: true,
        type: "SFL_BATCH_BUY_TOOLS_RESULT",
        reqId: data.reqId,
        ...res,
      }, "*");
      return;
    }

    if (data.type === "SFL_BATCH_BUY_SEEDS") {
      const res = batchBuySeedsViaService(data.season);
      window.postMessage({
        _sfl: true,
        type: "SFL_BATCH_BUY_SEEDS_RESULT",
        reqId: data.reqId,
        ...res,
      }, "*");
      return;
    }

    if (data.type === "SFL_BUY_SINGLE_SEED") {
      const res = buySingleSeedViaService(data.seedName, data.amount || 1);
      window.postMessage({
        _sfl: true,
        type: "SFL_BUY_SINGLE_SEED_RESULT",
        reqId: data.reqId,
        ...res,
      }, "*");
      return;
    }

    if (data.type === "SFL_CLAIM_DAILY_REWARD") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let alreadyClaimed = false;
      if (svc) {
        try {
          // So sánh theo NGÀY (như isDailyRewardReady của game), KHÔNG so theo ms
          // để tránh nhầm lần nhận hôm qua (sau 00:00 UTC) thành "đã nhận hôm nay".
          const todayKey = new Date().toISOString().slice(0, 10);
          const state = getGameState();
          const collectedAt = toSafeNumber(
            state?.dailyRewards?.chest?.collectedAt ?? state?.dailyRewards?.collectedAt
          );
          const collectedKey = collectedAt > 0 ? new Date(collectedAt).toISOString().slice(0, 10) : "";

          if (collectedKey === todayKey) {
            alreadyClaimed = true;
            ok = true;
          } else {
            svc.send("dailyReward.claimed");
            svc.send("CONTINUE");
            try { svc.send({ type: "SAVE" }); } catch (_e) {}

            // Xác minh thực tế: đọc lại trạng thái sau khi gửi event
            const after = getGameState();
            const afterAt = toSafeNumber(
              after?.dailyRewards?.chest?.collectedAt ?? after?.dailyRewards?.collectedAt
            );
            const afterKey = afterAt > 0 ? new Date(afterAt).toISOString().slice(0, 10) : "";
            if (afterKey === todayKey) {
              ok = true;
            } else {
              error = error || "claim_not_applied";
            }
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_CLAIM_DAILY_REWARD_RESULT",
        reqId: data.reqId,
        ok,
        alreadyClaimed,
        error,
      }, "*");
      return;
    }

    if (data.type === "SFL_RESTOCK_SHIPMENT") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let alreadyRestocked = false;
      if (svc) {
        try {
          // So sánh theo NGÀY (như canRestockShipment của game) — không so theo ms
          const todayKey = new Date().toISOString().slice(0, 10);
          const state = getGameState();
          const restockedAt = toSafeNumber(state?.shipments?.restockedAt);
          const restockKey = restockedAt > 0 ? new Date(restockedAt).toISOString().slice(0, 10) : "";
          let gtMay = "?";
          try { gtMay = JSON.stringify(svc.state?.value); } catch (_g) {}

          if (restockKey === todayKey) {
            alreadyRestocked = true;
            ok = true;
            console.log(`%c[SFL Restock] ⛵ Đã restock hôm nay (restockedAt=${restockKey}) - bỏ qua. machine=${gtMay}`, "color:#ff9800;");
          } else {
            console.log(`%c[SFL Restock] ⛵ Machine=${gtMay} | restockedAt(TT)=${restockKey || "chưa có"} -> gửi "shipment.restocked"...`, "color:#03a9f4;");
            svc.send("shipment.restocked");
            try { svc.send({ type: "SAVE" }); } catch (_e) {}

            // Xác minh thực tế: thuyền đã thực sự restock (restockedAt = hôm nay)
            const after = getGameState();
            const afterAt = toSafeNumber(after?.shipments?.restockedAt);
            const afterKey = afterAt > 0 ? new Date(afterAt).toISOString().slice(0, 10) : "";
            if (afterKey === todayKey) {
              ok = true;
              console.log(`%c[SFL Restock] ⛵ ✅ RESTOCK THÀNH CÔNG (restockedAt=${afterKey})!`, "color:#00e676;");
            } else {
              error = error || "restock_not_applied";
              console.log(`%c[SFL Restock] ⛵ ❌ Restock KHÔNG được áp dụng (after restockedAt=${afterKey || "chưa có"}). machine=${gtMay}`, "color:#ff3838;");
            }
          }
        } catch (e) {
          error = e?.message || String(e);
          console.log(`%c[SFL Restock] ⛵ ❌ Lỗi: ${error}`, "color:#ff3838;");
        }
      } else {
        error = "no_service";
        console.warn("[SFL Restock] ⛵ Không tìm thấy game service!");
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_RESTOCK_SHIPMENT_RESULT",
        reqId: data.reqId,
        ok,
        alreadyRestocked,
        error,
      }, "*");
      return;
    }

    if (data.type === "SFL_COLLECT_COMPOST") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      if (svc) {
        try {
          svc.send({
            type: "compost.collected",
            building: data.building,
            buildingId: data.buildingId,
          });
          try { svc.send({ type: "SAVE" }); } catch (_e) {}
          ok = true;
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_COLLECT_COMPOST_RESULT",
        reqId: data.reqId,
        ok,
        error,
      }, "*");
      return;
    }

    if (data.type === "SFL_START_COMPOSTER") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      if (svc) {
        try {
          svc.send({
            type: "composter.started",
            building: data.building,
            buildingId: data.buildingId,
          });
          try { svc.send({ type: "SAVE" }); } catch (_e) {}
          ok = true;
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_START_COMPOSTER_RESULT",
        reqId: data.reqId,
        ok,
        error,
      }, "*");
      return;
    }

    if (data.type === "SFL_HARVEST_FRUIT") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let harvestedCount = 0;
      if (svc) {
        try {
          const patches = svc.state?.context?.state?.fruitPatches || {};
          const patchIds = data.patchIds || (data.patchId !== undefined ? [data.patchId] : Object.keys(patches));
          for (const pId of patchIds) {
            const p = patches[pId];
            if (!p || (p.x === undefined && p.coordinates?.x === undefined) || p.removedAt > 0) continue;
            try {
              svc.send({
                type: "fruit.harvested",
                index: String(pId),
              });
              harvestedCount++;
            } catch (_e) {}
          }
          if (harvestedCount > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_HARVEST_FRUIT_RESULT",
        reqId: data.reqId,
        ok,
        error,
        harvestedCount,
      }, "*");
      return;
    }

    if (data.type === "SFL_REMOVE_DEAD_FRUIT_TREE") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let removedCount = 0;
      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const patches = state?.fruitPatches || {};
          const skills = state?.bumpkin?.skills || {};
          const collectibles = state?.collectibles || {};
          const hasForemanBeaver = !!(collectibles["Foreman Beaver"] && collectibles["Foreman Beaver"].length);
          const hasNoAxeNoWorries = !!skills["No Axe No Worries"];
          const freeAxes = hasForemanBeaver || hasNoAxeNoWorries;

          const axes = toSafeNumber(state?.inventory?.["Axe"]);
          let remAxes = freeAxes ? 9999 : axes;
          const patchIds = data.patchIds || (data.patchId !== undefined ? [data.patchId] : Object.keys(patches));
          for (const pId of patchIds) {
            if (remAxes <= 0) break;
            const p = patches[pId];
            if (!p || (p.x === undefined && p.coordinates?.x === undefined) || p.removedAt > 0) continue;
            // Cây ăn quả chết: có fruit nhưng harvestsLeft hết (bị xóa hoặc <= 0)
            const isDeadTree = p?.fruit && (!p.fruit.harvestsLeft || toSafeNumber(p.fruit.harvestsLeft) <= 0);
            if (isDeadTree) {
              try {
                svc.send({
                  type: "fruitTree.removed",
                  index: String(pId),
                  selectedItem: "Axe",
                });
                removedCount++;
                if (!freeAxes) remAxes--;
              } catch (_e) {}
            }
          }
          if (removedCount > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_REMOVE_DEAD_FRUIT_TREE_RESULT",
        reqId: data.reqId,
        ok,
        error,
        removedCount,
      }, "*");
      return;
    }

    if (data.type === "SFL_PLANT_FRUIT") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let plantedCount = 0;
      const plantedDetails = [];
      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const patches = state?.fruitPatches || {};
          const inventory = state?.inventory || {};
          const season = getCurrentSeason();

          const FRUIT_SEEDS_BY_SEASON = {
            spring: ["Tomato Seed", "Blueberry Seed", "Orange Seed"],
            summer: ["Lemon Seed", "Orange Seed", "Banana Plant"],
            autumn: ["Tomato Seed", "Apple Seed", "Banana Plant"],
            winter: ["Lemon Seed", "Blueberry Seed", "Apple Seed"],
          };
          const ALL_FRUIT_SEEDS = [
            "Apple Seed",
            "Banana Plant",
            "Orange Seed",
            "Blueberry Seed",
            "Lemon Seed",
            "Tomato Seed",
            "Celestine Seed",
            "Lunara Seed",
            "Duskberry Seed",
          ];

          const seasonalSeeds = FRUIT_SEEDS_BY_SEASON[season] || [];
          const candidateSeeds = [...seasonalSeeds, ...ALL_FRUIT_SEEDS.filter((s) => !seasonalSeeds.includes(s))];

          const invSim = {};
          for (const [k, v] of Object.entries(inventory)) {
            invSim[k] = toSafeNumber(v);
          }

          const patchIds = data.patchIds || Object.keys(patches);
          for (const pId of patchIds) {
            const p = patches[pId];
            if (!p || (p.x === undefined && p.coordinates?.x === undefined) || p.removedAt > 0) continue;
            // Chỉ trồng vào ô đất trống (không có fruit hoặc fruit.plantedAt rỗng)
            const isEmpty = !p.fruit || !p.fruit.plantedAt;
            if (!isEmpty) continue;

            let selectedSeed = data.seed;
            if (!selectedSeed || (invSim[selectedSeed] || 0) < 1) {
              selectedSeed = candidateSeeds.find((s) => (invSim[s] || 0) >= 1);
            }
            if (!selectedSeed) break;

            try {
              svc.send({
                type: "fruit.planted",
                index: String(pId),
                seed: selectedSeed,
              });
              plantedCount++;
              plantedDetails.push({ patchId: pId, seed: selectedSeed });
              invSim[selectedSeed] = Math.max(0, (invSim[selectedSeed] || 0) - 1);
            } catch (_e) {}
          }

          if (plantedCount > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_PLANT_FRUIT_RESULT",
        reqId: data.reqId,
        ok,
        error,
        plantedCount,
        plantedDetails,
      }, "*");
      return;
    }

    if (data.type === "SFL_HARVEST_FLOWERS") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let harvestedCount = 0;
      if (svc) {
        try {
          const snap = svc.getSnapshot();
          const ctx = snap?.context || snap?.value?.context || {};
          const state = ctx.state || ctx.gameState || ctx;
          const flowerBeds = state?.flowers?.flowerBeds || {};
          const now = Date.now();
          const bedIds = data.bedIds || Object.keys(flowerBeds);

          for (const bedId of bedIds) {
            const bed = flowerBeds[bedId];
            if (!bed || (bed.x === undefined && bed.coordinates?.x === undefined) || bed.removedAt > 0) continue;
            const flower = bed.flower;
            if (!flower || !flower.plantedAt) continue;
            const readyAt = toSafeNumber(flower.readyAt);
            if (readyAt > now) continue;

            try {
              try { svc.send({ type: "flower.harvested", id: String(bedId) }); } catch (_e1) {}
              try { svc.send("flower.harvested", { id: String(bedId) }); } catch (_e2) {}
              harvestedCount++;
            } catch (_err) {}
          }

          if (harvestedCount > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            try { svc.send("SAVE"); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_HARVEST_FLOWERS_RESULT",
        reqId: data.reqId,
        ok,
        error,
        harvestedCount,
      }, "*");
      return;
    }

    if (data.type === "SFL_PLANT_FLOWERS") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let plantedCount = 0;
      const plantedDetails = [];
      if (svc) {
        try {
          const snap = svc.getSnapshot();
          const ctx = snap?.context || snap?.value?.context || {};
          const state = ctx.state || ctx.gameState || ctx;
          const flowerBeds = state?.flowers?.flowerBeds || {};
          const inventory = state?.inventory || {};
          const season = getCurrentSeason();

          const SEASONAL_FLOWER_SEEDS = {
            spring: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Lavender Seed"],
            summer: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Gladiolus Seed"],
            autumn: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Clover Seed"],
            winter: ["Sunpetal Seed", "Bloom Seed", "Lily Seed", "Edelweiss Seed"],
          };

          const SET_1_SEEDS = ["Sunpetal Seed", "Bloom Seed", "Lily Seed"];
          const SET_1_CROSSBREED_PRIORITY = [
            { name: "Sunflower", amount: 50 },
            { name: "Beetroot", amount: 10 },
            { name: "Cauliflower", amount: 5 },
            { name: "Parsnip", amount: 5 },
            { name: "Eggplant", amount: 5 },
            { name: "Radish", amount: 5 },
            { name: "Kale", amount: 5 },
            { name: "Blueberry", amount: 3 },
            { name: "Apple", amount: 3 },
            { name: "Banana", amount: 3 },
            // Single flowers
            { name: "Red Pansy", amount: 1 }, { name: "Yellow Pansy", amount: 1 }, { name: "Purple Pansy", amount: 1 }, { name: "White Pansy", amount: 1 }, { name: "Blue Pansy", amount: 1 },
            { name: "Red Cosmos", amount: 1 }, { name: "Yellow Cosmos", amount: 1 }, { name: "Purple Cosmos", amount: 1 }, { name: "White Cosmos", amount: 1 }, { name: "Blue Cosmos", amount: 1 },
            { name: "Prism Petal", amount: 1 },
            { name: "Red Balloon Flower", amount: 1 }, { name: "Yellow Balloon Flower", amount: 1 }, { name: "Purple Balloon Flower", amount: 1 }, { name: "White Balloon Flower", amount: 1 }, { name: "Blue Balloon Flower", amount: 1 },
            { name: "Red Daffodil", amount: 1 }, { name: "Yellow Daffodil", amount: 1 }, { name: "Purple Daffodil", amount: 1 }, { name: "White Daffodil", amount: 1 }, { name: "Blue Daffodil", amount: 1 },
            { name: "Celestial Frostbloom", amount: 1 },
            { name: "Red Carnation", amount: 1 }, { name: "Yellow Carnation", amount: 1 }, { name: "Purple Carnation", amount: 1 }, { name: "White Carnation", amount: 1 }, { name: "Blue Carnation", amount: 1 },
            { name: "Red Lotus", amount: 1 }, { name: "Yellow Lotus", amount: 1 }, { name: "Purple Lotus", amount: 1 }, { name: "White Lotus", amount: 1 }, { name: "Blue Lotus", amount: 1 },
            { name: "Primula Enigma", amount: 1 },
          ];

          const SET_2_CROSSBREED_PRIORITY = [
            { name: "Rhubarb", amount: 25 },
            { name: "Pepper", amount: 15 },
            { name: "Onion", amount: 10 },
            { name: "Artichoke", amount: 8 },
            { name: "Barley", amount: 5 },
            // Single flowers
            { name: "Red Edelweiss", amount: 1 }, { name: "Yellow Edelweiss", amount: 1 }, { name: "Purple Edelweiss", amount: 1 }, { name: "White Edelweiss", amount: 1 }, { name: "Blue Edelweiss", amount: 1 },
            { name: "Red Gladiolus", amount: 1 }, { name: "Yellow Gladiolus", amount: 1 }, { name: "Purple Gladiolus", amount: 1 }, { name: "White Gladiolus", amount: 1 }, { name: "Blue Gladiolus", amount: 1 },
            { name: "Red Lavender", amount: 1 }, { name: "Yellow Lavender", amount: 1 }, { name: "Purple Lavender", amount: 1 }, { name: "White Lavender", amount: 1 }, { name: "Blue Lavender", amount: 1 },
            { name: "Red Clover", amount: 1 }, { name: "Yellow Clover", amount: 1 }, { name: "Purple Clover", amount: 1 }, { name: "White Clover", amount: 1 }, { name: "Blue Clover", amount: 1 },
          ];

          const seasonalSeeds = SEASONAL_FLOWER_SEEDS[season] || SEASONAL_FLOWER_SEEDS.spring;

          const invSim = {};
          for (const [k, v] of Object.entries(inventory)) {
            invSim[k] = toSafeNumber(v);
          }

          const bedIds = data.bedIds || Object.keys(flowerBeds);
          for (const bedId of bedIds) {
            const bed = flowerBeds[bedId];
            if (!bed || (bed.x === undefined && bed.coordinates?.x === undefined) || bed.removedAt > 0) continue;
            // Chỉ trồng ô trống
            if (bed.flower && bed.flower.plantedAt) continue;

            // Tìm hạt giống hoa có trong kho đúng mùa
            let selectedSeed = null;
            let selectedCrossbreed = null;

            for (const sName of seasonalSeeds) {
              if ((invSim[sName] || 0) < 1) continue;
              const isSet1 = SET_1_SEEDS.includes(sName);
              const crossList = isSet1 ? SET_1_CROSSBREED_PRIORITY : SET_2_CROSSBREED_PRIORITY;
              const match = crossList.find((cb) => (invSim[cb.name] || 0) >= cb.amount);
              if (match) {
                selectedSeed = sName;
                selectedCrossbreed = match;
                break;
              }
            }

            if (!selectedSeed || !selectedCrossbreed) continue;

            try {
              try {
                svc.send({
                  type: "flower.planted",
                  id: String(bedId),
                  seed: selectedSeed,
                  crossbreed: selectedCrossbreed.name,
                });
              } catch (_e1) {}
              try {
                svc.send("flower.planted", {
                  id: String(bedId),
                  seed: selectedSeed,
                  crossbreed: selectedCrossbreed.name,
                });
              } catch (_e2) {}

              plantedCount++;
              plantedDetails.push({ bedId, seed: selectedSeed, crossbreed: selectedCrossbreed.name, amount: selectedCrossbreed.amount });
              invSim[selectedSeed] = Math.max(0, (invSim[selectedSeed] || 0) - 1);
              invSim[selectedCrossbreed.name] = Math.max(0, (invSim[selectedCrossbreed.name] || 0) - selectedCrossbreed.amount);
            } catch (_plantErr) {}
          }

          if (plantedCount > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            try { svc.send("SAVE"); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_PLANT_FLOWERS_RESULT",
        reqId: data.reqId,
        ok,
        error,
        plantedCount,
        plantedDetails,
      }, "*");
      return;
    }

    if (data.type === "SFL_BUY_SEASONAL_SEEDS") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      const boughtList = [];
      let totalCoinsSpent = 0;
      let remainingCoins = 0;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const coins = toSafeNumber(state?.coins ?? state?.balance);
          remainingCoins = coins;

          if (coins < 0.01) {
            window.postMessage({
              _sfl: true,
              type: "SFL_BUY_SEASONAL_SEEDS_RESULT",
              reqId: data.reqId,
              ok: false,
              error: "insufficient_coins",
              boughtList: [],
              totalCoinsSpent: 0,
              remainingCoins: coins,
            }, "*");
            return;
          }

          const stock = state?.stock || {};
          const inventory = state?.inventory || {};
          const season = getCurrentSeason();
          const collectibles = state?.collectibles || {};

          // Danh mục tất cả hạt giống trong game kèm giá gốc, loại và điểm trồng
          const ALL_SEEDS_CATALOG = [
            // Crops
            { name: "Sunflower Seed", price: 0.01, category: "Crop", level: 1, spot: "Crop Plot" },
            { name: "Potato Seed", price: 0.1, category: "Crop", level: 1, spot: "Crop Plot" },
            { name: "Rhubarb Seed", price: 0.15, category: "Crop", level: 1, spot: "Crop Plot" },
            { name: "Pumpkin Seed", price: 0.2, category: "Crop", level: 2, spot: "Crop Plot" },
            { name: "Zucchini Seed", price: 0.2, category: "Crop", level: 2, spot: "Crop Plot" },
            { name: "Carrot Seed", price: 0.5, category: "Crop", level: 2, spot: "Crop Plot" },
            { name: "Yam Seed", price: 0.5, category: "Crop", level: 2, spot: "Crop Plot" },
            { name: "Cabbage Seed", price: 1, category: "Crop", level: 3, spot: "Crop Plot" },
            { name: "Broccoli Seed", price: 1, category: "Crop", level: 3, spot: "Crop Plot" },
            { name: "Soybean Seed", price: 1.5, category: "Crop", level: 3, spot: "Crop Plot" },
            { name: "Beetroot Seed", price: 2, category: "Crop", level: 3, spot: "Crop Plot" },
            { name: "Pepper Seed", price: 2, category: "Crop", level: 3, spot: "Crop Plot" },
            { name: "Cauliflower Seed", price: 3, category: "Crop", level: 4, spot: "Crop Plot" },
            { name: "Parsnip Seed", price: 5, category: "Crop", level: 4, spot: "Crop Plot" },
            { name: "Eggplant Seed", price: 6, category: "Crop", level: 5, spot: "Crop Plot" },
            { name: "Corn Seed", price: 7, category: "Crop", level: 5, spot: "Crop Plot" },
            { name: "Onion Seed", price: 7, category: "Crop", level: 5, spot: "Crop Plot" },
            { name: "Radish Seed", price: 7, category: "Crop", level: 5, spot: "Crop Plot" },
            { name: "Wheat Seed", price: 9, category: "Crop", level: 5, spot: "Crop Plot" },
            { name: "Turnip Seed", price: 9, category: "Crop", level: 5, spot: "Crop Plot" },
            { name: "Kale Seed", price: 10, category: "Crop", level: 6, spot: "Crop Plot" },
            { name: "Artichoke Seed", price: 12, category: "Crop", level: 6, spot: "Crop Plot" },
            { name: "Barley Seed", price: 15, category: "Crop", level: 6, spot: "Crop Plot" },

            // Fruits (Hoa quả)
            { name: "Tomato Seed", price: 5, category: "Fruit", level: 13, spot: "Fruit Patch" },
            { name: "Lemon Seed", price: 15, category: "Fruit", level: 12, spot: "Fruit Patch" },
            { name: "Blueberry Seed", price: 30, category: "Fruit", level: 13, spot: "Fruit Patch" },
            { name: "Orange Seed", price: 50, category: "Fruit", level: 14, spot: "Fruit Patch" },
            { name: "Apple Seed", price: 70, category: "Fruit", level: 15, spot: "Fruit Patch" },
            { name: "Banana Plant", price: 70, category: "Fruit", level: 16, spot: "Fruit Patch" },

            // Flowers (Hoa)
            { name: "Sunpetal Seed", price: 16, category: "Flower", level: 13, spot: "Flower Bed" },
            { name: "Bloom Seed", price: 32, category: "Flower", level: 22, spot: "Flower Bed" },
            { name: "Lily Seed", price: 48, category: "Flower", level: 27, spot: "Flower Bed" },
            { name: "Edelweiss Seed", price: 96, category: "Flower", level: 35, spot: "Flower Bed" },
            { name: "Gladiolus Seed", price: 96, category: "Flower", level: 35, spot: "Flower Bed" },
            { name: "Lavender Seed", price: 96, category: "Flower", level: 35, spot: "Flower Bed" },
            { name: "Clover Seed", price: 96, category: "Flower", level: 35, spot: "Flower Bed" },

            // Greenhouse
            { name: "Olive Seed", price: 160, category: "Greenhouse", level: 40, spot: "Greenhouse" },
            { name: "Rice Seed", price: 160, category: "Greenhouse", level: 40, spot: "Greenhouse" },
            { name: "Grape Seed", price: 320, category: "Greenhouse", level: 40, spot: "Greenhouse" },
          ];

          // Danh sách hạt giống được phép theo từng mùa vụ
          const SEASONAL_SEEDS_MAP = {
            spring: [
              "Sunflower Seed", "Rhubarb Seed", "Carrot Seed", "Cabbage Seed", "Soybean Seed", "Corn Seed", "Wheat Seed", "Kale Seed", "Barley Seed",
              "Tomato Seed", "Blueberry Seed", "Orange Seed",
              "Sunpetal Seed", "Bloom Seed", "Lily Seed", "Lavender Seed",
              "Rice Seed", "Olive Seed", "Grape Seed"
            ],
            summer: [
              "Sunflower Seed", "Potato Seed", "Zucchini Seed", "Pepper Seed", "Beetroot Seed", "Cauliflower Seed", "Eggplant Seed", "Radish Seed", "Wheat Seed",
              "Lemon Seed", "Orange Seed", "Banana Plant",
              "Sunpetal Seed", "Bloom Seed", "Lily Seed", "Gladiolus Seed",
              "Rice Seed", "Olive Seed", "Grape Seed"
            ],
            autumn: [
              "Potato Seed", "Pumpkin Seed", "Carrot Seed", "Yam Seed", "Broccoli Seed", "Soybean Seed", "Wheat Seed", "Barley Seed", "Artichoke Seed",
              "Tomato Seed", "Apple Seed", "Banana Plant",
              "Sunpetal Seed", "Bloom Seed", "Lily Seed", "Clover Seed",
              "Rice Seed", "Olive Seed", "Grape Seed"
            ],
            winter: [
              "Sunflower Seed", "Potato Seed", "Cabbage Seed", "Beetroot Seed", "Cauliflower Seed", "Parsnip Seed", "Onion Seed", "Turnip Seed", "Wheat Seed", "Kale Seed",
              "Lemon Seed", "Blueberry Seed", "Apple Seed",
              "Sunpetal Seed", "Bloom Seed", "Lily Seed", "Edelweiss Seed",
              "Rice Seed", "Olive Seed", "Grape Seed"
            ],
          };

          const allowedNames = SEASONAL_SEEDS_MAP[season] || SEASONAL_SEEDS_MAP.spring;
          const bumpkinExp = toSafeNumber(state?.bumpkin?.experience);
          function tinhLevelBumpkin(exp) {
            const expNum = Number(exp || 0);
            const levels = [
              [100, 5293405], [90, 4213405], [80, 3253405], [70, 2413405], [60, 1693405],
              [50, 1093405], [40, 480405], [35, 320405], [30, 205405], [25, 122905],
              [20, 64155], [16, 33655], [15, 27905], [14, 22905], [13, 18405],
              [12, 14405], [11, 10905], [10, 7905], [9, 5405], [8, 3405],
              [7, 2155], [6, 1155], [5, 555], [4, 205], [3, 22], [2, 2], [1, 0]
            ];
            for (const [lvl, minExp] of levels) {
              if (expNum >= minExp) return lvl;
            }
            return 1;
          }
          const bumpkinLevel = tinhLevelBumpkin(bumpkinExp);

          // Lọc danh sách hạt giống đúng mùa VÀ ĐỦ ĐIỀU KIỆN LEVEL BUMPKIN, sắp xếp TỪ RẺ ĐẾN ĐẮT
          const seasonalCandidates = ALL_SEEDS_CATALOG
            .filter((s) => allowedNames.includes(s.name) && bumpkinLevel >= s.level)
            .sort((a, b) => a.price - b.price);

          const hasKuebiko = !!(collectibles["Kuebiko"] && collectibles["Kuebiko"].length);
          const hasHungryCaterpillar = !!(collectibles["Hungry Caterpillar"] && collectibles["Hungry Caterpillar"].length);

          for (const s of seasonalCandidates) {
            // 1. Kiểm tra điều kiện ô đất trồng (Planting Spot)
            if (s.category === "Fruit") {
              const hasFruitPatch = toSafeNumber(inventory["Fruit Patch"]) >= 1 || (state.fruitPatches && Object.keys(state.fruitPatches).length > 0);
              if (!hasFruitPatch) continue;
            }
            if (s.category === "Flower") {
              const hasFlowerBed = toSafeNumber(inventory["Flower Bed"]) >= 1 || (state.flowers && Object.keys(state.flowers).length > 0);
              if (!hasFlowerBed) continue;
            }
            if (s.category === "Greenhouse") {
              const hasGreenhouse = toSafeNumber(inventory["Greenhouse"]) >= 1 || !!state.greenhouse;
              if (!hasGreenhouse) continue;
            }

            // 2. Kiểm tra stock trong cửa hàng (NGHIÊM NGẶT: Nếu undefined hoặc <= 0 thì bỏ qua ngay, KHÔNG fallback 400 ảo)
            if (!stock || stock[s.name] === undefined) continue;
            const stockQty = toSafeNumber(stock[s.name]);
            if (stockQty <= 0) continue;

            // 3. Kiểm tra giới hạn kho đồ (Inventory Limit chuẩn theo Sunflower Land)
            const currentInv = toSafeNumber(inventory[s.name]);
            const invLimit = getSeedInventoryLimit(s.name, state);
            const headroom = Math.max(0, invLimit - currentInv);
            if (headroom <= 0) {
              // Đã đạt giới hạn tối đa của loại hạt này trong kho đồ
              continue;
            }

            // 4. Tính đơn giá sau chiết khấu/boosts
            let unitPrice = s.price;
            if (hasKuebiko) unitPrice = 0;
            if (s.category === "Flower" && hasHungryCaterpillar) unitPrice = 0;

            // 5. Tính số lượng tối đa có thể mua (dựa trên coins, stock thực tế và headroom)
            let maxBuy = Math.min(stockQty, headroom);
            if (unitPrice > 0) {
              const affordable = Math.floor(remainingCoins / unitPrice);
              if (affordable <= 0) continue;
              maxBuy = Math.min(maxBuy, affordable);
            }

            if (maxBuy <= 0) continue;

            try {
              svc.send({
                type: "seed.bought",
                item: s.name,
                amount: maxBuy,
              });
              const cost = maxBuy * unitPrice;
              remainingCoins = Math.max(0, remainingCoins - cost);
              totalCoinsSpent += cost;
              boughtList.push({
                seed: s.name,
                category: s.category,
                amount: maxBuy,
                unitPrice: unitPrice,
                totalCost: cost,
              });
            } catch (errBuy) {
              console.warn("[SFL Bridge] Lỗi mua hạt " + s.name + ":", errBuy);
            }
          }

          if (boughtList.length > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_BUY_SEASONAL_SEEDS_RESULT",
        reqId: data.reqId,
        ok,
        error,
        boughtList,
        totalCoinsSpent,
        remainingCoins,
      }, "*");
      return;
    }

    // DANH SÁCH TOÀN BỘ CÔNG THỨC MÓN ĂN & ĐIỂM EXP & NGUYÊN LIỆU GỐC
    const ALL_COOKABLE_RECIPES = [
      { name: "Pizza Margherita", building: "Fire Pit", experience: 25000, ingredients: { Tomato: 30, Cheese: 5, Wheat: 20 } },
      { name: "Antipasto", building: "Fire Pit", experience: 3000, ingredients: { Olive: 2, Grape: 2 } },
      { name: "Rice Bun", building: "Fire Pit", experience: 2600, ingredients: { Rice: 2, Wheat: 50 } },
      { name: "Kale Omelette", building: "Fire Pit", experience: 1250, ingredients: { Egg: 40, Kale: 5 } },
      { name: "Furikake Sprinkle", building: "Fire Pit", experience: 1000, ingredients: { "Fish Flake": 1, Seaweed: 1 } },
      { name: "Gumbo", building: "Fire Pit", experience: 600, ingredients: { Potato: 50, Pumpkin: 30, Carrot: 20, "Red Snapper": 3 } },
      { name: "Fried Tofu", building: "Fire Pit", experience: 400, ingredients: { Soybean: 15, Sunflower: 200 } },
      { name: "Kale Stew", building: "Fire Pit", experience: 400, ingredients: { Kale: 10 } },
      { name: "Cabbers n Mash", building: "Fire Pit", experience: 250, ingredients: { "Mashed Potato": 10, Cabbage: 20 } },
      { name: "Popcorn", building: "Fire Pit", experience: 200, ingredients: { Sunflower: 100, Corn: 5 } },
      { name: "Bumpkin Broth", building: "Fire Pit", experience: 96, ingredients: { Carrot: 10, Cabbage: 5 } },
      { name: "Boiled Eggs", building: "Fire Pit", experience: 90, ingredients: { Egg: 10 } },
      { name: "Mushroom Soup", building: "Fire Pit", experience: 56, ingredients: { "Wild Mushroom": 5 } },
      { name: "Reindeer Carrot", building: "Fire Pit", experience: 36, ingredients: { Carrot: 5 } },
      { name: "Pumpkin Soup", building: "Fire Pit", experience: 24, ingredients: { Pumpkin: 10 } },
      { name: "Rhubarb Tart", building: "Fire Pit", experience: 5, ingredients: { Rhubarb: 3 } },
      { name: "Mashed Potato", building: "Fire Pit", experience: 3, ingredients: { Potato: 8 } },

      { name: "Crimstone Infused Fish Oil", building: "Kitchen", experience: 18000, ingredients: { "Fish Oil": 1, Crimstone: 1 } },
      { name: "Spaghetti al Limone", building: "Kitchen", experience: 15000, ingredients: { Wheat: 10, Lemon: 15, Cheese: 3 } },
      { name: "Creamy Crab Bite", building: "Kitchen", experience: 10000, ingredients: { "Crab Stick": 1, Cheese: 3 } },
      { name: "Caprese Salad", building: "Kitchen", experience: 6000, ingredients: { Cheese: 1, Tomato: 25, Kale: 20 } },
      { name: "Steamed Red Rice", building: "Kitchen", experience: 3000, ingredients: { Rice: 3, Beetroot: 50 } },
      { name: "Surimi Rice Bowl", building: "Kitchen", experience: 3000, ingredients: { "Fish Stick": 1, Rice: 1, Onion: 1 } },
      { name: "Bumpkin Roast", building: "Kitchen", experience: 2500, ingredients: { "Mashed Potato": 20, "Roast Veggies": 5 } },
      { name: "Goblin Brunch", building: "Kitchen", experience: 2500, ingredients: { "Boiled Eggs": 5, "Goblin's Treat": 1 } },
      { name: "Seafood Basket", building: "Kitchen", experience: 2200, ingredients: { Blowfish: 2, Napoleanfish: 2, Sunfish: 2 } },
      { name: "Beetroot Blaze", building: "Kitchen", experience: 2000, ingredients: { "Magic Mushroom": 2, Beetroot: 50 } },
      { name: "Fish n Chips", building: "Kitchen", experience: 2000, ingredients: { "Fancy Fries": 1, Halibut: 1 } },
      { name: "Sushi Roll", building: "Kitchen", experience: 2000, ingredients: { Angelfish: 1, Seaweed: 1, Rice: 2 } },
      { name: "Ocean's Olive", building: "Kitchen", experience: 2000, ingredients: { "Olive Flounder": 1, Olive: 2 } },
      { name: "Fish Omelette", building: "Kitchen", experience: 1500, ingredients: { Egg: 40, Surgeonfish: 1, Butterflyfish: 2 } },
      { name: "Fried Calamari", building: "Kitchen", experience: 1500, ingredients: { Sunflower: 200, Wheat: 15, Squid: 1 } },
      { name: "Fish Burger", building: "Kitchen", experience: 1300, ingredients: { Beetroot: 10, Wheat: 10, "Horse Mackerel": 1 } },
      { name: "Pancakes", building: "Kitchen", experience: 1000, ingredients: { Wheat: 10, Egg: 10, Honey: 6 } },
      { name: "Bumpkin ganoush", building: "Kitchen", experience: 1000, ingredients: { Eggplant: 30, Potato: 50, Parsnip: 10 } },
      { name: "Chowder", building: "Kitchen", experience: 1000, ingredients: { Beetroot: 10, Wheat: 10, Parsnip: 5, Anchovy: 3 } },
      { name: "Tofu Scramble", building: "Kitchen", experience: 1000, ingredients: { Soybean: 20, Egg: 20, Cauliflower: 10 } },
      { name: "Goblin's Treat", building: "Kitchen", experience: 500, ingredients: { Pumpkin: 10, Radish: 20, Cabbage: 10 } },
      { name: "Bumpkin Salad", building: "Kitchen", experience: 290, ingredients: { Beetroot: 20, Parsnip: 10 } },
      { name: "Cauliflower Burger", building: "Kitchen", experience: 255, ingredients: { Cauliflower: 15, Wheat: 5 } },
      { name: "Mushroom Jacket Potatoes", building: "Kitchen", experience: 240, ingredients: { "Wild Mushroom": 10, Potato: 5 } },
      { name: "Fruit Salad", building: "Kitchen", experience: 225, ingredients: { Apple: 1, Orange: 1, Blueberry: 1 } },
      { name: "Club Sandwich", building: "Kitchen", experience: 170, ingredients: { Sunflower: 100, Carrot: 25, Wheat: 5 } },
      { name: "Roast Veggies", building: "Kitchen", experience: 170, ingredients: { Cauliflower: 15, Carrot: 10 } },
      { name: "Sunflower Crunch", building: "Kitchen", experience: 50, ingredients: { Sunflower: 300 } },

      { name: "Lemon Cheesecake", building: "Bakery", experience: 30000, ingredients: { Lemon: 20, Cheese: 5, Egg: 40 } },
      { name: "Honey Cake", building: "Bakery", experience: 4000, ingredients: { Honey: 10, Wheat: 10, Egg: 20 } },
      { name: "Eggplant Cake", building: "Bakery", experience: 1400, ingredients: { Eggplant: 30, Wheat: 10, Egg: 30 } },
      { name: "Parsnip Cake", building: "Bakery", experience: 1300, ingredients: { Parsnip: 45, Wheat: 10, Egg: 30 } },
      { name: "Beetroot Cake", building: "Bakery", experience: 1250, ingredients: { Beetroot: 100, Wheat: 10, Egg: 30 } },
      { name: "Radish Cake", building: "Bakery", experience: 1200, ingredients: { Radish: 25, Wheat: 10, Egg: 30 } },
      { name: "Cauliflower Cake", building: "Bakery", experience: 1190, ingredients: { Cauliflower: 60, Wheat: 10, Egg: 30 } },
      { name: "Wheat Cake", building: "Bakery", experience: 1100, ingredients: { Wheat: 35, Egg: 30 } },
      { name: "Cabbage Cake", building: "Bakery", experience: 860, ingredients: { Cabbage: 90, Wheat: 10, Egg: 30 } },
      { name: "Carrot Cake", building: "Bakery", experience: 750, ingredients: { Carrot: 120, Wheat: 10, Egg: 30 } },
      { name: "Orange Cake", building: "Bakery", experience: 730, ingredients: { Orange: 5, Egg: 30, Wheat: 10 } },
      { name: "Apple Pie", building: "Bakery", experience: 720, ingredients: { Apple: 5, Wheat: 10, Egg: 20 } },
      { name: "Kale & Mushroom Pie", building: "Bakery", experience: 720, ingredients: { "Wild Mushroom": 10, Kale: 5, Wheat: 5 } },
      { name: "Potato Cake", building: "Bakery", experience: 650, ingredients: { Potato: 500, Wheat: 10, Egg: 30 } },
      { name: "Pumpkin Cake", building: "Bakery", experience: 625, ingredients: { Pumpkin: 130, Wheat: 10, Egg: 30 } },
      { name: "Cornbread", building: "Bakery", experience: 600, ingredients: { Corn: 15, Wheat: 5, Egg: 10 } },
      { name: "Sunflower Cake", building: "Bakery", experience: 525, ingredients: { Sunflower: 1000, Wheat: 10, Egg: 30 } },

      { name: "Honey Cheddar", building: "Deli", experience: 15000, ingredients: { Cheese: 3, Honey: 5 } },
      { name: "Blue Cheese", building: "Deli", experience: 6000, ingredients: { Cheese: 2, Blueberry: 10 } },
      { name: "Fermented Fish", building: "Deli", experience: 3000, ingredients: { Tuna: 6 } },
      { name: "Fancy Fries", building: "Deli", experience: 1000, ingredients: { Sunflower: 500, Potato: 500 } },
      { name: "Blueberry Jam", building: "Deli", experience: 500, ingredients: { Blueberry: 5 } },
      { name: "Sauerkraut", building: "Deli", experience: 500, ingredients: { Cabbage: 20 } },
      { name: "Fermented Carrots", building: "Deli", experience: 250, ingredients: { Carrot: 20 } },

      { name: "Slow Juice", building: "Smoothie Shack", experience: 7500, ingredients: { Grape: 10, Kale: 100 } },
      { name: "Grape Juice", building: "Smoothie Shack", experience: 3300, ingredients: { Grape: 5, Radish: 20 } },
      { name: "The Lot", building: "Smoothie Shack", experience: 1500, ingredients: { Blueberry: 1, Orange: 1, Grape: 1, Apple: 1, Banana: 1 } },
      { name: "Banana Blast", building: "Smoothie Shack", experience: 1200, ingredients: { Banana: 10, Egg: 10 } },
      { name: "Sour Shake", building: "Smoothie Shack", experience: 1000, ingredients: { Lemon: 20 } },
      { name: "Bumpkin Detox", building: "Smoothie Shack", experience: 975, ingredients: { Apple: 5, Orange: 5, Carrot: 10 } },
      { name: "Power Smoothie", building: "Smoothie Shack", experience: 775, ingredients: { Blueberry: 10, Kale: 5 } },
      { name: "Apple Juice", building: "Smoothie Shack", experience: 500, ingredients: { Apple: 5 } },
      { name: "Orange Juice", building: "Smoothie Shack", experience: 375, ingredients: { Orange: 5 } },
      { name: "Purple Smoothie", building: "Smoothie Shack", experience: 310, ingredients: { Blueberry: 5, Cabbage: 10 } },
      { name: "Carrot Juice", building: "Smoothie Shack", experience: 200, ingredients: { Carrot: 30 } },
      { name: "Quick Juice", building: "Smoothie Shack", experience: 100, ingredients: { Sunflower: 50, Pumpkin: 40 } },
    ];

    // Thu hoạch tất cả món ăn đã nấu chín
    if (data.type === "SFL_COLLECT_RECIPES") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let collectedCount = 0;
      if (svc) {
        try {
          const now = Date.now();
          const state = svc.state?.context?.state;
          const buildings = state?.buildings || {};
          const cookingBuildings = ["Fire Pit", "Kitchen", "Bakery", "Deli", "Smoothie Shack"];
          for (const bName of cookingBuildings) {
            const list = buildings[bName];
            if (!Array.isArray(list)) continue;
            for (const b of list) {
              const crafting = b.crafting || [];
              const hasReady = crafting.some((item) => toSafeNumber(item.readyAt) <= now);
              if (hasReady) {
                try {
                  svc.send({
                    type: "recipes.collected",
                    building: bName,
                    buildingId: String(b.id),
                  });
                  collectedCount++;
                } catch (_e) {}
              }
            }
          }
          if (collectedCount > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_COLLECT_RECIPES_RESULT",
        reqId: data.reqId,
        ok,
        error,
        collectedCount,
      }, "*");
      return;
    }

    // Nấu món ăn ưu tiên điểm kinh nghiệm (XP) cao nhất, tự động tính hệ số x2/x3/x4 nếu có skill "Double Nom"
    if (data.type === "SFL_COOK_BEST_RECIPES") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      const cookedList = [];
      if (svc) {
        try {
          const now = Date.now();
          const state = svc.state?.context?.state;
          const bumpkin = state?.bumpkin;
          const skills = bumpkin?.skills || {};
          const buildings = state?.buildings || {};
          const inventory = state?.inventory || {};

          // Kiểm tra skill "Double Nom": 1: x2, 2: x3, 3: x4
          let doubleNomLevel = 0;
          if (typeof skills["Double Nom"] === "number") {
            doubleNomLevel = skills["Double Nom"];
          } else if (skills["Double Nom"] === true) {
            doubleNomLevel = 1;
          }
          const ingMultiplier = doubleNomLevel === 1 ? 2 : (doubleNomLevel === 2 ? 3 : (doubleNomLevel === 3 ? 4 : 1));

          // Mô phỏng kho đồ để trừ dần khi nấu nhiều bếp cùng lúc
          const invSim = {};
          for (const [k, v] of Object.entries(inventory)) {
            invSim[k] = toSafeNumber(v);
          }

          const cookingBuildings = ["Fire Pit", "Kitchen", "Bakery", "Deli", "Smoothie Shack"];
          for (const bName of cookingBuildings) {
            const list = buildings[bName];
            if (!Array.isArray(list)) continue;

            for (const b of list) {
              if (b.readyAt && b.readyAt > now) continue;

              const crafting = b.crafting || [];
              // Nếu đang có món đang nấu dở -> bỏ qua bếp này
              if (crafting.some((item) => toSafeNumber(item.readyAt) > now)) continue;

              const recipesForBuilding = ALL_COOKABLE_RECIPES.filter((r) => r.building === bName);

              // Tìm các món đủ nguyên liệu thực tế sau khi đã áp dụng hệ số nhân Double Nom
              const eligible = [];
              for (const r of recipesForBuilding) {
                let enough = true;
                const reqs = {};
                for (const [ingName, baseQty] of Object.entries(r.ingredients)) {
                  const needed = baseQty * ingMultiplier;
                  reqs[ingName] = needed;
                  if ((invSim[ingName] || 0) < needed) {
                    enough = false;
                    break;
                  }
                }
                if (enough) {
                  eligible.push({ ...r, reqs });
                }
              }

              if (eligible.length === 0) continue;

              // ƯU TIÊN MÓN ĂN CÓ KINH NGHIỆM (EXPERIENCE) CAO NHẤT
              eligible.sort((a, b) => b.experience - a.experience);
              const bestRecipe = eligible[0];

              try {
                svc.send({
                  type: "recipe.cooked",
                  item: bestRecipe.name,
                  buildingId: String(b.id),
                });
                cookedList.push({
                  building: bName,
                  recipe: bestRecipe.name,
                  experience: bestRecipe.experience,
                  multiplier: ingMultiplier,
                });
                for (const [ingName, needed] of Object.entries(bestRecipe.reqs)) {
                  invSim[ingName] = Math.max(0, (invSim[ingName] || 0) - needed);
                }
              } catch (_e) {}
            }
          }

          if (cookedList.length > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }
      window.postMessage({
        _sfl: true,
        type: "SFL_COOK_BEST_RECIPES_RESULT",
        reqId: data.reqId,
        ok,
        error,
        cookedList,
      }, "*");
      return;
    }

    // ═══════ GIAO ĐƠN HÀNG (DELIVERIES) — CHỈ QUA GAME BRIDGE ═══════
    // THỨ TỰ ƯU TIÊN GIAO (theo yêu cầu user): ① COIN → ② SHINY (reward Shiny Feather)
    // → ③ KHÁC → ④ FLOWER (reward SFL - NPC hoa). Đơn FLOWER CHỈ giao khi acc có VIP;
    // acc thường GIỮ NGUYÊN đơn flower (không giao, không skip). Chỉ skip đơn THIẾU nguyên
    // liệu (trừ flower của acc thường) để lấy nhiệm vụ mới. Hàm async: chờ máy về "playing"
    // và poll xác minh completedAt/KHÔNG còn đơn THỰC TẾ sau mỗi event.
    async function xuLyDeliverOrders(data) {
      const svc = findGameService();
      const deliveredList = [];
      const skipList = [];
      const diag = [];
      let ok = false;
      let error = null;
      const nguPoll = (ms) => new Promise((r) => setTimeout(r, ms));

      if (!svc) {
        diag.push("no_service");
        console.warn("[SFL Deliver] ⚠️ không tìm thấy game service!");
        return { ok, error: "no_service", deliveredCount: 0, deliveredList, skippedCount: 0, skippedList: skipList, diag };
      }

      // Đọc state TRỰC TIẾP từ CHÍNH snapshot của service ta gửi event (không qua
      // findGameService cache — tránh lấy nhầm instance cũ sau khi game dựng lại máy).
      const choPlaying = async () => {
        for (let i = 0; i < 40; i++) {
          try {
            if (svc.state?.matches?.("playing")) return true;
          } catch (_e) {}
          await nguPoll(40);
        }
        return false;
      };

      const layStateSong = () => {
        try {
          const snap = svc.getSnapshot();
          const ctx = snap?.context || snap?.value?.context || {};
          return ctx.state || ctx.gameState || ctx || null;
        } catch (_e) { return null; }
      };

      const layOrders = () => {
        try {
          const st = layStateSong();
          return (st?.delivery?.orders || []).slice();
        } catch (_e) { return []; }
      };

      const khoiDuNguyenLieu = (ord) => {
        const st = layStateSong();
        if (!st) return false;
        const inv = st.inventory || {};
        const coinsTT = toSafeNumber(st.coins);
        const sflTT = toSafeNumber(st.balance);
        const reqItems = ord.items || {};
        for (const [item, reqAmount] of Object.entries(reqItems)) {
          const numReq = Number(reqAmount || 0);
          if (numReq <= 0) continue;
          if (item === "coins") { if (coinsTT < numReq) return false; }
          else if (item === "sfl") { if (sflTT < numReq) return false; }
          else { if (toSafeNumber(inv[item]) < numReq) return false; }
        }
        return true;
      };

      // Phân loại đơn theo THỨ TỰ ƯU TIÊN của user:
      // 1. COIN (reward.coins) -> giao trước
      // 2. SHINY (reward chứa "Shiny Feather")
      // 3. KHÁC (tickets/items/xps...)
      // 4. FLOWER (reward SFL của NPC hoa) -> CHỈ giao khi acc có VIP
      const xepLoai = (ord) => {
        const r = ord?.reward || {};
        if (toSafeNumber(r.coins) > 0) return "coin";
        if (toSafeNumber((r.items || {})["Shiny Feather"]) > 0) return "shiny";
        if (toSafeNumber(r.sfl) > 0) return "flower";
        return "khac";
      };
      const thuTuUuTien = { coin: 0, shiny: 1, khac: 2, flower: 3 };
      const kyHieuLoai = { coin: "c", shiny: "y", khac: "k", flower: "f" };
      const laFlower = (ord) => xepLoai(ord) === "flower";

      try {
        let giaTriMay = "?";
        try { giaTriMay = JSON.stringify(svc.state?.value); } catch (_e2) {}
        diag.push("machine=" + giaTriMay);

        if (String(giaTriMay).includes("visiting")) {
          diag.push("visiting - bo qua");
          return { ok, error: "visiting", deliveredCount: 0, deliveredList, skippedCount: 0, skippedList: skipList, diag };
        }

        const now = Date.now();
        const firstState = layStateSong();
        diag.push("hasState=" + (firstState ? "yes" : "no"));
        const ds = layOrders();
        diag.push("orders=" + ds.length);
        diag.push(
          "ll(" + ds.map((o) => `${o.id}:${o.completedAt ? "C" : (o.readyAt && o.readyAt > now ? "R" : (khoiDuNguyenLieu(o) ? "S" : "T"))}:${kyHieuLoai[xepLoai(o)]}`).join(",") + ")"
        );

        // Kiểm tra quyền VIP
        const VIP_TRIAL_PERIOD_MS = 1000 * 60 * 60 * 24 * 7;
        const hasLifetimePass = toSafeNumber(firstState?.inventory?.["Lifetime Farmer Banner"]) > 0;
        const hasTrialVIP = !!firstState?.vip?.trialStartedAt && firstState.vip.trialStartedAt > now - VIP_TRIAL_PERIOD_MS;
        const hasValidInGameVIP = !!firstState?.vip?.expiresAt && firstState.vip.expiresAt > now;
        const isVip = hasValidInGameVIP || hasLifetimePass || hasTrialVIP;

        // 1. GIAO ĐƠN theo THỨ TỰ ƯU TIÊN: COIN ➜ SHINY ➜ KHÁC ➜ FLOWER(cần VIP)
        //    Sắp xếp: coin trước, shiny kế, khác sau, flower cuối — giao HẾT đơn đủ nguyên liệu
        //    (kể cả đơn giá trị cao). FLOWER chỉ xử lý khi acc có VIP; acc thường GIỮ NGUYÊN đơn.
        const danhSach = layOrders().sort((a, b) => thuTuUuTien[xepLoai(a)] - thuTuUuTien[xepLoai(b)]);
        for (const ord of danhSach) {
          if (!ord || ord.completedAt) continue;
          if (laFlower(ord) && !isVip) { diag.push(`flower ${ord.id} (${ord.from}) bo qua - acc KHONG VIP`); continue; }
          if (ord.readyAt && ord.readyAt > now) continue;
          if (!khoiDuNguyenLieu(ord)) continue;

          const truoc = layOrders().find((o) => o.id === ord.id);
          diag.push(`deliver id=${ord.id} from=${ord.from} readyAt=${ord.readyAt} machinetruoc=${JSON.stringify(svc.state?.value)}`);

          if (!(await choPlaying())) { diag.push(`deliver ${ord.id} stop - khong sau "playing"`); break; }

          svc.send({ type: "order.delivered", id: ord.id, friendship: true });

          // Xốc xác minh TRỰC TIẾP trên snapshot service vừa send
          let hoanTat = false;
          for (let i = 0; i < 15; i++) {
            const sau = layOrders().find((o) => o.id === ord.id);
            if (sau && sau.completedAt) { hoanTat = true; break; }
            await nguPoll(50);
          }
          diag.push(`deliver ${ord.id} => hoanTat=${hoanTat} sauSend=${!!(truoc && (layOrders().find((o) => o.id === ord.id))?.completedAt)}`);
          if (hoanTat) {
            deliveredList.push({ id: ord.id, from: ord.from, items: ord.items || {}, reward: ord.reward || {}, isVip: isVip });
          }
        }

        // 2. BỎ QUA (SKIP) đơn THIẾU NGUYÊN LIỆU để lấy nhiệm vụ mới (giới hạn ~1 đơn/ngày của game)
        //    - Game CHỈ cho skip đơn tạo NGÀY TRƯỚC (skipOrder.ts ném "Order skipped within 24 hours"
        //      nếu cùng ngày) → đơn tạo hôm nay bỏ qua, chờ mai (vẫn để đơn đó).
        //    - Chỉ break khi skip THÀNH CÔNG (1/ngày); thất bại thì thử tiếp đơn thiếu đồ khác.
        //    - Đơn FLOWER của acc KHÔNG VIP bỏ qua HOÀN TOÀN (không giao, không skip — giữ nguyên).
        const soNgayTrongNam = (t) => {
          const d = new Date(t);
          const dauNam = new Date(d.getFullYear(), 0, 0);
          return Math.floor((d - dauNam) / 86400000);
        };
        const skipDuocHomNay = (ord, nowT) => {
          const c = toSafeNumber(ord.createdAt);
          if (c <= 0) return true; // không rõ ngày tạo -> để game tự quyết
          const cD = new Date(c);
          const nD = new Date(nowT);
          return !(soNgayTrongNam(nowT) === soNgayTrongNam(c) && nD.getFullYear() === cD.getFullYear());
        };
        if (data.skipOrders === undefined || data.skipOrders === true) {
          for (const ord of layOrders()) {
            if (!ord || ord.completedAt) continue;
            if (laFlower(ord) && !isVip) { diag.push(`flower ${ord.id} (${ord.from}) ko skip - acc KHONG VIP`); continue; }
            if (ord.readyAt && ord.readyAt > now) continue;
            if (khoiDuNguyenLieu(ord)) continue; // đủ đồ -> để giao, không skip
            if (!skipDuocHomNay(ord, now)) { diag.push(`skip ${ord.id} (${ord.from}) bo qua - tao hom nay, game chi cho skip ngay mai`); continue; }

            if (!(await choPlaying())) { diag.push(`skip ${ord.id} stop - khong sau "playing"`); break; }

            let daGui = true;
            try {
              svc.send({ type: "order.skipped", id: ord.id });
            } catch (eS) {
              daGui = false;
              diag.push(`skip ${ord.id} loi send: ${eS?.message || String(eS)}`);
            }

            // Xác minh: đơn cũ phải bị LOẠI (game thay bằng đơn mới qua populateOrders)
            let daLoai = false;
            if (daGui) {
              for (let i = 0; i < 15 && !daLoai; i++) {
                const conTonTai = layOrders().some((o) => o.id === ord.id);
                if (!conTonTai) { daLoai = true; break; }
                await nguPoll(50);
              }
            }
            diag.push(`skip id=${ord.id} from=${ord.from} => daLoai=${daLoai}`);
            if (daLoai) {
              skipList.push({ id: ord.id, from: ord.from, items: ord.items || {} });
              break; // game giới hạn 1 skip/ngày — ĐÃ skip thành công
            }
            // Skip thất bại (vd đơn cùng ngày) -> thử đơn thiếu đồ khác
          }
        }

        if (deliveredList.length > 0 || skipList.length > 0) {
          try { svc.send({ type: "SAVE" }); } catch (_e) {}
          ok = true;
        }
      } catch (e) {
        error = e?.message || String(e);
        diag.push("loi=" + error);
      }

      if (diag.length) {
        console.log("%c[SFL Deliver] 📋", "color: #ff9800; font-weight: bold;", diag.join(" | "));
      }
      return { ok, error, deliveredCount: deliveredList.length, deliveredList, skippedCount: skipList.length, skippedList: skipList, diag };
    }

    if (data.type === "SFL_DELIVER_ORDERS") {
      xuLyDeliverOrders(data).then((res) => {
        window.postMessage({
          _sfl: true,
          type: "SFL_DELIVER_ORDERS_RESULT",
          reqId: data.reqId,
          ...res,
        }, "*");
      });
      return;
    }

    // TỰ ĐỘNG NHẬN THƯỞNG NHIỆM VỤ TUẦN (WEEKLY CHORES & KINGDOM CHORES)
    if (data.type === "SFL_CLAIM_CHORES") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      const claimedChores = [];

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const choreBoard = state?.choreBoard?.chores || {};

          // 1. Nhận thưởng NPC Chores / Weekly Chores
          for (const npcName of Object.keys(choreBoard)) {
            const chore = choreBoard[npcName];
            if (!chore || chore.completedAt) continue;

            try {
              svc.send({
                type: "chore.fulfilled",
                npcName: npcName,
              });
              claimedChores.push({ type: "npc", name: npcName, choreName: chore.name || "Chore" });
            } catch (_e) {}
          }

          // 2. Nhận thưởng Kingdom Chores
          const kingdomChores = state?.kingdomChores?.chores || [];
          for (const kChore of kingdomChores) {
            if (!kChore || kChore.completedAt !== undefined || kChore.skippedAt !== undefined) continue;
            try {
              svc.send({
                type: "kingdomChore.completed",
                id: kChore.id,
              });
              claimedChores.push({ type: "kingdom", name: "Kingdom", choreName: kChore.activity || "Kingdom Chore" });
            } catch (_e) {}
          }

          if (claimedChores.length > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_CLAIM_CHORES_RESULT",
        reqId: data.reqId,
        ok,
        error,
        claimedCount: claimedChores.length,
        claimedChores,
      }, "*");
      return;
    }

    // TỰ ĐỘNG GIAO HÀNG TRUY NÃ CHO POPPY (MEGA BOUNTY BOARD)
    if (data.type === "SFL_SELL_BOUNTIES_POPPY") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      const soldBounties = [];
      let bonusClaimed = false;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const inv = state?.inventory || {};
          const requests = state?.bounties?.requests || [];

          // Mô phỏng kho đồ
          const invSim = {};
          for (const [k, v] of Object.entries(inv)) {
            invSim[k] = toSafeNumber(v);
          }

          for (const req of requests) {
            if (!req || req.completed) continue;
            const reqQty = Number(req.quantity || 1);
            const inStock = Number(invSim[req.name] || 0);

            if (inStock >= reqQty) {
              try {
                svc.send({
                  type: "bounty.sold",
                  requestId: req.id,
                });
                invSim[req.name] = Math.max(0, inStock - reqQty);
                soldBounties.push({
                  id: req.id,
                  item: req.name,
                  quantity: reqQty,
                  coins: req.coins || 0,
                });
              } catch (errBounty) {
                console.warn("[SFL Bridge Bounty Error]", req.name, errBounty);
              }
            }
          }

          // Kiểm tra và nhận Bounty Bonus nếu hoàn thành toàn bộ
          const allDone = requests.length > 0 && requests.every((r) => r.completed || soldBounties.some((s) => s.id === r.id));
          if (allDone && !state?.bounties?.bonusClaimed) {
            try {
              svc.send({ type: "bountyBonus.claimed" });
              bonusClaimed = true;
            } catch (_eBonus) {}
          }

          if (soldBounties.length > 0 || bonusClaimed) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_SELL_BOUNTIES_POPPY_RESULT",
        reqId: data.reqId,
        ok,
        error,
        soldCount: soldBounties.length,
        soldBounties,
        bonusClaimed,
      }, "*");
      return;
    }

    // TỰ ĐỘNG NHẬN THƯỞNG MỐC THÁNG / SEASON TRACK & MILESTONES CODEX
    if (data.type === "SFL_CLAIM_MILESTONES") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let claimedTracks = 0;
      let claimedCodex = 0;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const now = Date.now();
          const inv = state?.inventory || {};
          const VIP_TRIAL_PERIOD_MS = 1000 * 60 * 60 * 24 * 7;
          const hasLifetimePass = toSafeNumber(inv["Lifetime Farmer Banner"]) > 0;
          const hasTrialVIP = !!state?.vip?.trialStartedAt && state.vip.trialStartedAt > now - VIP_TRIAL_PERIOD_MS;
          const hasValidInGameVIP = !!state?.vip?.expiresAt && state.vip.expiresAt > now;
          const isVip = hasValidInGameVIP || hasLifetimePass || hasTrialVIP;

          // 1. Nhận thưởng Track Milestones (Free Track)
          for (let step = 0; step < 50; step++) {
            try {
              svc.send({
                type: "trackMilestone.claimed",
                track: "free",
              });
              claimedTracks++;
            } catch (_e) {
              break;
            }
          }

          // 2. Nhận thưởng Track Milestones (Premium Track cho VIP)
          if (isVip) {
            for (let step = 0; step < 50; step++) {
              try {
                svc.send({
                  type: "trackMilestone.claimed",
                  track: "premium",
                });
                claimedTracks++;
              } catch (_e) {
                break;
              }
            }
          }

          // 3. Nhận thưởng Codex Milestones
          const ALL_CODEX_MILESTONES = [
            "Novice Angler", "Advanced Angler", "Expert Angler", "Fish Encyclopedia",
            "Master Angler", "Marine Marvel Master", "Deep Sea Diver", "Marine Biologist",
            "Sunpetal Savant", "Bloom Big Shot", "Lily Luminary"
          ];
          for (const mName of ALL_CODEX_MILESTONES) {
            if (state?.milestones?.[mName]) continue;
            try {
              svc.send({
                type: "milestone.claimed",
                milestone: mName,
              });
              claimedCodex++;
            } catch (_e) {}
          }

          // 4. Nhận thưởng VIP Referral Milestones nếu có
          for (let mId = 1; mId <= 20; mId++) {
            try {
              svc.send({
                type: "vipReferralMilestones.claimed",
                milestone: mId,
              });
            } catch (_e) {}
          }

          if (claimedTracks > 0 || claimedCodex > 0) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
            ok = true;
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_CLAIM_MILESTONES_RESULT",
        reqId: data.reqId,
        ok,
        error,
        claimedTracks,
        claimedCodex,
      }, "*");
      return;
    }

    // TỰ ĐỘNG MỞ RƯƠNG KHO BÁU (TREASURE CHESTS) KHI CÓ CHÌA KHÓA
    if (data.type === "SFL_OPEN_TREASURE_CHEST") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      const openedChests = [];

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const inv = state?.inventory || {};

          const CHEST_KEYS = [
            "Treasure Key",
            "Rare Key",
            "Luxury Key",
            "Sunstone Key",
            "Obsidian Key"
          ];

          for (const keyName of CHEST_KEYS) {
            const count = toSafeNumber(inv[keyName]);
            if (count > 0) {
              try {
                svc.send("REVEAL", {
                  event: {
                    key: keyName,
                    location: "plaza",
                    type: "treasureChest.opened",
                    createdAt: new Date(),
                  },
                });
                openedChests.push({ key: keyName, count: 1 });
              } catch (errOpen) {
                console.warn("[SFL Bridge Chest Error]", keyName, errOpen);
              }
            }
          }

          if (openedChests.length > 0) {
            ok = true;
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_OPEN_TREASURE_CHEST_RESULT",
        reqId: data.reqId,
        ok,
        error,
        openedCount: openedChests.length,
        openedChests,
      }, "*");
      return;
    }

    // TỰ ĐỘNG CÂU CÁ (AUTO FISHING)
    if (data.type === "SFL_AUTO_FISHING") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let castCount = 0;
      const caughtList = [];

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const inv = state?.inventory || {};
          let rodCount = toSafeNumber(inv.Rod);

          const BAIT_PRIORITY = ["Fishing Lure", "Grub", "Red Wiggler", "Earthworm"];
          const invSim = {};
          for (const [k, v] of Object.entries(inv)) {
            invSim[k] = toSafeNumber(v);
          }

          // Tính số lượt câu còn lại hôm nay (Daily Limit)
          const nowStr = new Date().toISOString().split("T")[0];
          const dailyAttempts = state?.fishing?.dailyAttempts?.[nowStr] || 0;
          const extraReels = state?.fishing?.extraReels?.count || 0;
          const maxReels = 20; // Giới hạn cơ bản hàng ngày
          let reelsLeft = Math.max(0, maxReels - dailyAttempts) + extraReels;

          while (reelsLeft > 0 && rodCount > 0) {
            // Tìm mồi câu tốt nhất đang có trong kho
            const availableBait = BAIT_PRIORITY.find((b) => (invSim[b] || 0) > 0);
            if (!availableBait) break;

            try {
              svc.send({
                type: "rod.casted",
                bait: availableBait,
                multiplier: 1,
              });

              invSim[availableBait] = Math.max(0, (invSim[availableBait] || 0) - 1);
              rodCount = Math.max(0, rodCount - 1);
              reelsLeft = Math.max(0, reelsLeft - 1);
              castCount++;
              caughtList.push({ bait: availableBait });
            } catch (errCast) {
              console.warn("[SFL Bridge Fishing Error]", errCast);
              break;
            }
          }

          if (castCount > 0) {
            ok = true;
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_AUTO_FISHING_RESULT",
        reqId: data.reqId,
        ok,
        error,
        castCount,
        caughtList,
      }, "*");
      return;
    }

    // TỰ ĐỘNG CÀO MUỐI & ĐÀO MỎ DẦU (SALT & OIL HARVESTING)
    if (data.type === "SFL_HARVEST_SALT_OIL") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let saltHarvested = 0;
      let oilDrilled = 0;
      let saltFarmUpgraded = false;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const inv = state?.inventory || {};
          const now = Date.now();

          // 1. Thu hoạch Muối (Salt Farm Nodes)
          const saltNodes = state?.saltFarm?.nodes || {};
          let saltRakes = toSafeNumber(inv["Salt Rake"]);

          for (const [nodeId, nodeData] of Object.entries(saltNodes)) {
            if (saltRakes <= 0) break;
            const storedCharges = Number(nodeData?.salt?.storedCharges ?? 0);
            const nextChargeAt = Number(nodeData?.salt?.nextChargeAt ?? 0);
            const isReady = storedCharges > 0 || (nextChargeAt > 0 && nextChargeAt <= now);

            if (isReady) {
              try {
                svc.send({
                  type: "salt.harvested",
                  id: String(nodeId),
                });
                saltRakes--;
                saltHarvested++;
              } catch (errSalt) {
                console.warn("[SFL Bridge Salt Error]", nodeId, errSalt);
              }
            }
          }

          // 2. Đào Mỏ Dầu (Oil Reserves)
          const oilReserves = state?.oilReserves || {};
          let drills = toSafeNumber(inv.Drill) + toSafeNumber(inv["Oil Drill"]);

          for (const [resId, resData] of Object.entries(oilReserves)) {
            if (drills <= 0) break;
            const drilledAt = Number(resData?.drilledAt ?? 0);
            // 20 tiếng hồi mỏ dầu
            const isOilReady = !drilledAt || now - drilledAt >= 20 * 60 * 60 * 1000;

            if (isOilReady) {
              try {
                svc.send({
                  type: "oilReserve.drilled",
                  id: String(resId),
                });
                drills--;
                oilDrilled++;
              } catch (errOil) {
                console.warn("[SFL Bridge Oil Error]", resId, errOil);
              }
            }
          }

          // 3. Tự động Nâng cấp Trại Muối nếu đủ điều kiện
          try {
            const curLevel = Number(state?.saltFarm?.level ?? 0);
            if (curLevel < 4) {
              svc.send({ type: "saltFarm.upgraded" });
              saltFarmUpgraded = true;
            }
          } catch (_eUpgrade) {}

          if (saltHarvested > 0 || oilDrilled > 0 || saltFarmUpgraded) {
            ok = true;
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_HARVEST_SALT_OIL_RESULT",
        reqId: data.reqId,
        ok,
        error,
        saltHarvested,
        oilDrilled,
        saltFarmUpgraded,
      }, "*");
      return;
    }

    // TỰ ĐỘNG MỞ RỘNG Ô ĐẤT & NÂNG CẤP ĐẢO (LAND EXPANSION & ISLAND UPGRADE)
    if (data.type === "SFL_AUTO_EXPAND_UPGRADE") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let landExpanded = false;
      let landRevealed = false;
      let farmUpgraded = false;

      if (svc) {
        try {
          const farmId = Number(svc.state?.context?.farmId || 0);
          const stateBefore = svc.state?.context?.state;
          const oldLandCount = toSafeNumber(stateBefore?.inventory?.["Basic Land"]);
          const oldConstruction = stateBefore?.expansionConstruction;
          const oldIslandType = String(stateBefore?.island?.type || "basic");
          const oldUpgradedAt = toSafeNumber(stateBefore?.island?.upgradedAt);

          // 1. Kiểm tra hoàn thành mở rộng đất đang chờ nhận (Reveal)
          if (oldConstruction && (!oldConstruction.readyAt || Date.now() >= oldConstruction.readyAt)) {
            try {
              svc.send({ type: "landExpansion.revealed" });
              await new Promise((r) => setTimeout(r, 150));
              const stateAfterRev = svc.state?.context?.state;
              if (!stateAfterRev?.expansionConstruction || toSafeNumber(stateAfterRev?.inventory?.["Basic Land"]) > oldLandCount) {
                landRevealed = true;
                ok = true;
              }
            } catch (_eRev) {}
          }

          // 2. Thử Mở rộng thêm ô đất mới (Expand Land) - CHỈ KHI không có ô đất nào đang thi công
          const stateCurrent = svc.state?.context?.state;
          if (!stateCurrent?.expansionConstruction) {
            try {
              svc.send({
                type: "land.expanded",
                farmId: farmId,
              });
              await new Promise((r) => setTimeout(r, 150));
              const stateAfterExp = svc.state?.context?.state;
              if (stateAfterExp?.expansionConstruction && !stateCurrent?.expansionConstruction) {
                landExpanded = true;
                ok = true;
              }
            } catch (_eExp) {}
          }

          // 3. Thử Nâng cấp Đảo mới khi đạt mốc tối đa (Farm Upgrade)
          try {
            svc.send({
              type: "farm.upgraded",
            });
            await new Promise((r) => setTimeout(r, 150));
            const stateAfterFarm = svc.state?.context?.state;
            const newIslandType = String(stateAfterFarm?.island?.type || "basic");
            const newUpgradedAt = toSafeNumber(stateAfterFarm?.island?.upgradedAt);
            if (newIslandType !== oldIslandType || newUpgradedAt > oldUpgradedAt) {
              farmUpgraded = true;
              ok = true;
            }
          } catch (_eFarm) {}

          if (ok) {
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_AUTO_EXPAND_UPGRADE_RESULT",
        reqId: data.reqId,
        ok,
        error,
        landExpanded,
        landRevealed,
        farmUpgraded,
      }, "*");
      return;
    }

    // TỰ ĐỘNG CHĂM SÓC & THU HOẠCH GIA SÚC (ANIMALS: GÀ, BÒ, CỪU)
    if (data.type === "SFL_ANIMALS_ACTION") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let claimedCount = 0;
      let fedCount = 0;
      let lovedCount = 0;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const now = Date.now();
          const buildings = [
            { key: "henHouse", type: "Chicken" },
            { key: "barn", types: ["Sheep", "Cow"] },
          ];

          for (const b of buildings) {
            const animalBuilding = state?.[b.key];
            if (!animalBuilding || !animalBuilding.animals) continue;

            for (const [id, animal] of Object.entries(animalBuilding.animals)) {
              if (!animal) continue;
              const animalType = animal.type || b.type || (b.types && b.types[0]);

              // 1. Thu hoạch sản phẩm sẵn sàng (Trứng, Sữa, Lông cừu...)
              if (animal.state === "ready") {
                try {
                  svc.send({
                    type: "produce.claimed",
                    animal: animalType,
                    id: String(id),
                  });
                  claimedCount++;
                } catch (_eClaim) {}
              }

              // 2. Cho ăn nếu đang đói (idle)
              if (animal.state === "idle") {
                try {
                  svc.send({
                    type: "animal.fed",
                    animal: animalType,
                    id: String(id),
                  });
                  fedCount++;
                } catch (_eFeed) {}
              }

              // 3. Vuốt ve tăng tim nếu đang trong chu kỳ ngủ
              if (animal.state === "loved" || (animal.asleepAt && now > animal.asleepAt)) {
                try {
                  svc.send({
                    type: "animal.loved",
                    animal: animalType,
                    id: String(id),
                  });
                  lovedCount++;
                } catch (_eLove) {}
              }
            }
          }

          if (claimedCount > 0 || fedCount > 0 || lovedCount > 0) {
            ok = true;
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_ANIMALS_ACTION_RESULT",
        reqId: data.reqId,
        ok,
        error,
        claimedCount,
        fedCount,
        lovedCount,
      }, "*");
      return;
    }

    // TỰ ĐỘNG TRỒNG & THU HOẠCH NHÀ KÍNH (GREENHOUSE)
    if (data.type === "SFL_GREENHOUSE_ACTION") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let harvestedCount = 0;
      let plantedCount = 0;
      let oiled = false;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const inv = state?.inventory || {};
          const now = Date.now();
          const pots = state?.greenhouse?.pots || {};

          // 1. Thu hoạch cây nhà kính đã chín
          for (const [potId, pot] of Object.entries(pots)) {
            if (pot?.plant && pot.plant.readyAt && pot.plant.readyAt <= now) {
              try {
                svc.send({
                  type: "greenhouse.harvested",
                  id: String(potId),
                });
                harvestedCount++;
              } catch (_eHarv) {}
            }
          }

          // 2. Tiếp dầu cho nhà kính nếu thiếu dầu
          try {
            const oilAmount = toSafeNumber(state?.greenhouse?.oil?.amount);
            if (oilAmount <= 10 && toSafeNumber(inv.Oil) > 0) {
              svc.send({ type: "greenhouse.oiled" });
              oiled = true;
            }
          } catch (_eOil) {}

          // 3. Gieo hạt cây nhà kính còn trống
          const GREENHOUSE_SEEDS = [
            { seed: "Grape Seed", crop: "Grape" },
            { seed: "Rice Seed", crop: "Rice" },
            { seed: "Olive Seed", crop: "Olive" },
            { seed: "Tomato Seed", crop: "Tomato" },
          ];
          for (const [potId, pot] of Object.entries(pots)) {
            if (!pot?.plant) {
              const available = GREENHOUSE_SEEDS.find((s) => toSafeNumber(inv[s.seed]) > 0);
              if (available) {
                try {
                  svc.send({
                    type: "greenhouse.planted",
                    id: String(potId),
                    plant: available.crop,
                  });
                  inv[available.seed] = Math.max(0, toSafeNumber(inv[available.seed]) - 1);
                  plantedCount++;
                } catch (_ePlant) {}
              }
            }
          }

          if (harvestedCount > 0 || plantedCount > 0 || oiled) {
            ok = true;
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_GREENHOUSE_ACTION_RESULT",
        reqId: data.reqId,
        ok,
        error,
        harvestedCount,
        plantedCount,
        oiled,
      }, "*");
      return;
    }

    // TỰ ĐỘNG NẠP DẦU & THU HOẠCH MÁY TRỒNG TRỌT (CROP MACHINE)
    if (data.type === "SFL_CROP_MACHINE_ACTION") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let harvested = false;
      let oilSupplied = false;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const inv = state?.inventory || {};

          // 1. Thu hoạch sản phẩm từ máy Crop Machine
          try {
            svc.send({ type: "cropMachine.harvested" });
            harvested = true;
          } catch (_eH) {}

          // 2. Tiếp dầu cho Crop Machine
          try {
            if (toSafeNumber(inv.Oil) > 0) {
              svc.send({ type: "cropMachine.oilSupplied" });
              oilSupplied = true;
            }
          } catch (_eOil) {}

          if (harvested || oilSupplied) {
            ok = true;
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_CROP_MACHINE_ACTION_RESULT",
        reqId: data.reqId,
        ok,
        error,
        harvested,
        oilSupplied,
      }, "*");
      return;
    }

    // TỰ ĐỘNG CHĂM SÓC PET & FACTION PET
    if (data.type === "SFL_PETS_ACTION") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let petFedCount = 0;
      let factionPetFed = false;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const pets = state?.pets || {};

          // 1. Cho từng thú cưng (Pet) ăn thức ăn
          for (const petId of Object.keys(pets)) {
            try {
              svc.send({
                type: "pet.fed",
                id: String(petId),
              });
              petFedCount++;
            } catch (_ePet) {}
          }

          // 2. Cho Faction Pet ăn
          try {
            svc.send({ type: "factionPet.fed" });
            factionPetFed = true;
          } catch (_eFP) {}

          if (petFedCount > 0 || factionPetFed) {
            ok = true;
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_PETS_ACTION_RESULT",
        reqId: data.reqId,
        ok,
        error,
        petFedCount,
        factionPetFed,
      }, "*");
      return;
    }

    // TỰ ĐỘNG THU HOẠCH HỐ DUNG NHAM (LAVA PITS)
    if (data.type === "SFL_LAVA_PITS_ACTION") {
      const svc = findGameService();
      let ok = false;
      let error = null;
      let collectedPits = 0;

      if (svc) {
        try {
          const state = svc.state?.context?.state;
          const lavaPits = state?.lavaPits || {};

          for (const pitId of Object.keys(lavaPits)) {
            try {
              svc.send({
                type: "lavaPit.collected",
                id: String(pitId),
              });
              collectedPits++;
            } catch (_eLava) {}
          }

          if (collectedPits > 0) {
            ok = true;
            try { svc.send({ type: "SAVE" }); } catch (_e) {}
          }
        } catch (e) {
          error = e?.message || String(e);
        }
      } else {
        error = "no_service";
      }

      window.postMessage({
        _sfl: true,
        type: "SFL_LAVA_PITS_ACTION_RESULT",
        reqId: data.reqId,
        ok,
        error,
        collectedPits,
      }, "*");
      return;
    }

    if (data.type === "SFL_GET_STATE") {
      const statePayload = buildStatePayload();
      window.postMessage({
        _sfl: true,
        type: "SFL_STATE",
        reqId: data.reqId,
        data: statePayload,
        error: statePayload ? null : "no_service",
      }, "*");
      return;
    }
  });

  // Thông báo Bridge đã sẵn sàng
  window.postMessage({ _sfl: true, type: "SFL_BRIDGE_READY" }, "*");
})();
