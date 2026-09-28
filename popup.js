// ═══════════════════════════════════════════════════════════════════════
// GIAO DIỆN ĐIỀU KHIỂN AUTO POPUP v6 (popup.js)
// Đồng bộ 100% các tính năng nông trại thực tế (Ẩn các luồng chạy ngầm tự động)
// ═══════════════════════════════════════════════════════════════════════

const FEATURES = [
  {
    id: "masterBat",
    icon: "⚡",
    title: "BẬT / TẮT TOÀN BỘ AUTO",
    default: true,
    isMaster: true
  },
  {
    id: 14,
    icon: "🎁",
    title: "Tự động Check-in Rương & Thuyền quà ngày",
    default: true
  },
  {
    id: 15,
    icon: "🔨",
    title: "Tự động mua Công Cụ (Rìu, Cuốc, Cần câu...)",
    default: true
  },
  {
    id: 9,
    icon: "🛒",
    title: "Tự động mua Hạt Giống theo mùa (Betty)",
    default: true
  },
  {
    id: 7,
    icon: "🌾",
    title: "Tự động Canh Tác Ruộng (Gặt, Rắc phân, Gieo)",
    default: true
  },
  {
    id: 10,
    icon: "💩",
    title: "Tự động Ủ & Thu hoạch Phân (Compost)",
    default: true
  },
  {
    id: 4,
    icon: "🍄",
    title: "Tự động nhặt Nấm Rừng (Mushrooms)",
    default: true
  },
  {
    id: 8,
    icon: "🌸",
    title: "Tự động Trồng & Thu Hoạch Hoa (Flower Bed)",
    default: true
  },
  {
    id: 3,
    icon: "🍯",
    title: "Tự động Thu Hoạch Mật Ong (Beehive)",
    default: true
  },
  {
    id: 5,
    icon: "🪓",
    title: "Tự động Chặt Cây Lấy Gỗ (Tree)",
    default: true
  },
  {
    id: 6,
    icon: "⛏️",
    title: "Tự động Đào Khoáng Sản & Dầu (Mining)",
    default: true
  },
  {
    id: 11,
    icon: "🍎",
    title: "Tự động Thu Hoạch & Trồng Cây Ăn Quả (Fruit)",
    default: true
  },
  {
    id: 12,
    icon: "🍳",
    title: "Tự động Nấu Ăn & Chế Biến Món Ăn (Cooking)",
    default: true
  },
  {
    id: 13,
    icon: "📦",
    title: "Tự động Giao Đơn Hàng Tàu/NPC (Deliveries)",
    default: true
  },
  {
    id: 16,
    icon: "🎯",
    title: "Tự động Giao Bounties Poppy (Plaza Board)",
    default: true
  },
  {
    id: 17,
    icon: "📋",
    title: "Tự động Nhận Thưởng Nhiệm Vụ Tuần (Weekly Chores)",
    default: true
  },
  {
    id: 18,
    icon: "🏆",
    title: "Tự động Nhận Quà Mốc Điểm Season (Track)",
    default: true
  },
  {
    id: 19,
    icon: "🗝️",
    title: "Tự động Mở Khóa Rương Kho Báu (Treasure Chests)",
    default: true
  },
  {
    id: 20,
    icon: "🎣",
    title: "Tự động Câu Cá Hàng Ngày (Auto Fishing)",
    default: true
  },
  {
    id: 21,
    icon: "🧂",
    title: "Tự động Cào Muối & Khai Thác Mỏ Dầu",
    default: true
  },
  {
    id: 22,
    icon: "🏝️",
    title: "Tự động Mở Rộng Đất & Nâng Cấp Đảo",
    default: true
  },
  {
    id: "autoReload",
    icon: "🔄",
    title: "Tự động Reload sau 1 giờ (nếu đã lưu game)",
    default: true
  }
];

// Danh sách quặng cần đào (Mining Targets)
const MINE_TARGETS = [
  { id: "mineTargetStone", label: "Đá", default: true },
  { id: "mineTargetIron", label: "Sắt", default: true },
  { id: "mineTargetGold", label: "Vàng", default: true },
  { id: "mineTargetCrimstone", label: "Crimstone", default: true },
  { id: "mineTargetSunstone", label: "Sunstone", default: false },
  { id: "mineTargetOil", label: "Dầu mỏ", default: true }
];

// DOM references
let ids = {};
const statusText = document.getElementById("statusText");
const statusBadge = document.getElementById("statusBadge");

// Render UI dynamically
function renderAppStructure() {
  const mainApp = document.querySelector(".main_app");
  if (!mainApp) return;

  mainApp.innerHTML = "";

  // 1. Render main features
  FEATURES.forEach((feat) => {
    const menuItem = document.createElement("label");
    menuItem.className = "menu-item" + (feat.isMaster ? " master-item" : "");
    menuItem.innerHTML = `
        <div class="menu-item-icon">${feat.icon}</div>
        <div class="menu-item-title">${feat.title}</div>
        <div class="switch">
            <input type="checkbox" id="${feat.id}" name="${feat.id}">
            <span class="slider"></span>
        </div>
    `;
    mainApp.appendChild(menuItem);
    ids[feat.id] = menuItem.querySelector(`input[id="${feat.id}"]`);
  });

  // 2. Render mine target chips
  const mineSection = document.createElement("div");
  mineSection.className = "mine-section";
  mineSection.innerHTML = `<div class="section-title">Quặng cần khai thác</div>`;
  const chipWrap = document.createElement("div");
  chipWrap.className = "mine-target-bunch";
  MINE_TARGETS.forEach((mine) => {
    const chip = document.createElement("label");
    chip.className = "mine-chip";
    chip.innerHTML = `
        <input type="checkbox" id="${mine.id}" name="${mine.id}">
        <span>${mine.label}</span>
    `;
    chipWrap.appendChild(chip);
    ids[mine.id] = chip.querySelector(`input[id="${mine.id}"]`);
  });
  mineSection.appendChild(chipWrap);
  mainApp.appendChild(mineSection);
}

function setStatus(text, tone = "neutral") {
  if (statusText) statusText.textContent = text;
  if (statusBadge) {
    statusBadge.className = "status-badge";
    if (tone === "live") {
      statusBadge.textContent = "Đang chạy";
      statusBadge.classList.add("live");
      return;
    }
    if (tone === "warn") {
      statusBadge.textContent = "Tạm dừng";
      statusBadge.classList.add("warn");
      return;
    }
    statusBadge.textContent = "Sẵn sàng";
    statusBadge.classList.add("live");
  }
}

function readUiSettings() {
  const settings = {};

  FEATURES.forEach((feat) => {
    if (ids[feat.id]) {
      settings[feat.id] = !!ids[feat.id].checked;
    }
  });

  MINE_TARGETS.forEach((mine) => {
    if (ids[mine.id]) {
      settings[mine.id] = !!ids[mine.id].checked;
    }
  });

  return settings;
}

function renderSettings(settings) {
  FEATURES.forEach((feat) => {
    if (ids[feat.id]) {
      ids[feat.id].checked = settings[feat.id] !== undefined ? !!settings[feat.id] : feat.default;
    }
  });

  MINE_TARGETS.forEach((mine) => {
    if (ids[mine.id]) {
      ids[mine.id].checked = settings[mine.id] !== undefined ? !!settings[mine.id] : mine.default;
    }
  });
}

const STORAGE_KEY = "sfl_ui_settings";

function loadSettingsFromStorage() {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const saved = res?.[STORAGE_KEY];
    if (saved && typeof saved === "object") {
      renderSettings(saved);
    } else {
      const defaults = {};
      FEATURES.forEach((f) => (defaults[f.id] = f.default));
      MINE_TARGETS.forEach((m) => (defaults[m.id] = m.default));
      renderSettings(defaults);
    }
    setStatus("Đã kết nối Sunflower Land", "live");
  });
}

function saveSettingsToStorage() {
  const current = readUiSettings();
  chrome.storage.local.set({ [STORAGE_KEY]: current }, () => {
    setStatus("Đã lưu cấu hình", "live");
    setTimeout(() => {
      setStatus("Đang chạy tự động", "live");
    }, 1200);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderAppStructure();
  loadSettingsFromStorage();

  // Attach change listeners to save real-time
  const mainApp = document.querySelector(".main_app");
  if (mainApp) {
    mainApp.addEventListener("change", () => {
      saveSettingsToStorage();
    });
  }
});
