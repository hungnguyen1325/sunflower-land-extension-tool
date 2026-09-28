// ═══════════════════════════════════════════════════════════════════
// GAME DATA MODULE (data.json & game_data.js)
// Trích xuất 100% dữ liệu gốc từ mã nguồn Sunflower Land
// Cung cấp dữ liệu về Mùa Vụ, Hạt Giống, Cây Ăn Quả, Hoa, Công Cụ
// ═══════════════════════════════════════════════════════════════════
(function (S) {
  "use strict";

  const GAME_DATA = {
  "version": "1.0.0",
  "updatedAt": "2026-08-28T04:52:51.871Z",
  "seasons": {
    "spring": [
      "Sunflower Seed",
      "Rhubarb Seed",
      "Carrot Seed",
      "Cabbage Seed",
      "Soybean Seed",
      "Corn Seed",
      "Wheat Seed",
      "Kale Seed",
      "Barley Seed",
      "Tomato Seed",
      "Blueberry Seed",
      "Orange Seed",
      "Sunpetal Seed",
      "Bloom Seed",
      "Lily Seed",
      "Lavender Seed",
      "Rice Seed",
      "Olive Seed",
      "Grape Seed"
    ],
    "summer": [
      "Sunflower Seed",
      "Potato Seed",
      "Zucchini Seed",
      "Pepper Seed",
      "Beetroot Seed",
      "Cauliflower Seed",
      "Eggplant Seed",
      "Radish Seed",
      "Wheat Seed",
      "Lemon Seed",
      "Orange Seed",
      "Banana Plant",
      "Sunpetal Seed",
      "Bloom Seed",
      "Lily Seed",
      "Gladiolus Seed",
      "Rice Seed",
      "Olive Seed",
      "Grape Seed"
    ],
    "autumn": [
      "Potato Seed",
      "Pumpkin Seed",
      "Carrot Seed",
      "Yam Seed",
      "Broccoli Seed",
      "Soybean Seed",
      "Wheat Seed",
      "Barley Seed",
      "Artichoke Seed",
      "Tomato Seed",
      "Apple Seed",
      "Banana Plant",
      "Sunpetal Seed",
      "Bloom Seed",
      "Lily Seed",
      "Clover Seed",
      "Rice Seed",
      "Olive Seed",
      "Grape Seed"
    ],
    "winter": [
      "Potato Seed",
      "Cabbage Seed",
      "Beetroot Seed",
      "Cauliflower Seed",
      "Parsnip Seed",
      "Onion Seed",
      "Turnip Seed",
      "Wheat Seed",
      "Kale Seed",
      "Lemon Seed",
      "Blueberry Seed",
      "Apple Seed",
      "Sunpetal Seed",
      "Bloom Seed",
      "Lily Seed",
      "Edelweiss Seed",
      "Rice Seed",
      "Olive Seed",
      "Grape Seed"
    ]
  },
  "seeds": {
    "Sunflower Seed": {
      "name": "Sunflower Seed",
      "yield": "Sunflower",
      "type": "crop",
      "price": 0.01,
      "sellPrice": 0.02,
      "plantSeconds": 60,
      "bumpkinLevel": 1,
      "plantingSpot": "Crop Plot",
      "description": "A sunny flower",
      "seasons": [
        "spring",
        "summer"
      ]
    },
    "Potato Seed": {
      "name": "Potato Seed",
      "yield": "Potato",
      "type": "crop",
      "price": 0.1,
      "sellPrice": 0.14,
      "plantSeconds": 300,
      "bumpkinLevel": 1,
      "plantingSpot": "Crop Plot",
      "description": "Healthier than you might think.",
      "seasons": [
        "summer",
        "autumn",
        "winter"
      ]
    },
    "Rhubarb Seed": {
      "name": "Rhubarb Seed",
      "yield": "Rhubarb",
      "type": "crop",
      "price": 0.15,
      "sellPrice": 0.24,
      "plantSeconds": 600,
      "bumpkinLevel": 1,
      "plantingSpot": "Crop Plot",
      "description": "A great addition to any pie.",
      "seasons": [
        "spring"
      ]
    },
    "Pumpkin Seed": {
      "name": "Pumpkin Seed",
      "yield": "Pumpkin",
      "type": "crop",
      "price": 0.2,
      "sellPrice": 0.4,
      "plantSeconds": 1800,
      "bumpkinLevel": 2,
      "plantingSpot": "Crop Plot",
      "description": "There's more to pumpkin than pie.",
      "seasons": [
        "autumn"
      ]
    },
    "Zucchini Seed": {
      "name": "Zucchini Seed",
      "yield": "Zucchini",
      "type": "crop",
      "price": 0.2,
      "sellPrice": 0.4,
      "plantSeconds": 1800,
      "bumpkinLevel": 2,
      "plantingSpot": "Crop Plot",
      "description": "A summer squash.",
      "seasons": [
        "summer"
      ]
    },
    "Carrot Seed": {
      "name": "Carrot Seed",
      "yield": "Carrot",
      "type": "crop",
      "price": 0.5,
      "sellPrice": 0.8,
      "plantSeconds": 3600,
      "bumpkinLevel": 2,
      "plantingSpot": "Crop Plot",
      "description": "They're good for your eyes!",
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "Yam Seed": {
      "name": "Yam Seed",
      "yield": "Yam",
      "type": "crop",
      "price": 0.5,
      "sellPrice": 0.8,
      "plantSeconds": 3600,
      "bumpkinLevel": 2,
      "plantingSpot": "Crop Plot",
      "description": "Sweet and versatile root vegetable.",
      "seasons": [
        "autumn"
      ]
    },
    "Cabbage Seed": {
      "name": "Cabbage Seed",
      "yield": "Cabbage",
      "type": "crop",
      "price": 1,
      "sellPrice": 1.5,
      "plantSeconds": 7200,
      "bumpkinLevel": 3,
      "plantingSpot": "Crop Plot",
      "description": "Once a luxury, now a food for many.",
      "seasons": [
        "spring",
        "winter"
      ]
    },
    "Broccoli Seed": {
      "name": "Broccoli Seed",
      "yield": "Broccoli",
      "type": "crop",
      "price": 1,
      "sellPrice": 1.5,
      "plantSeconds": 7200,
      "bumpkinLevel": 3,
      "plantingSpot": "Crop Plot",
      "description": "Tiny trees for your tummy.",
      "seasons": [
        "autumn"
      ]
    },
    "Soybean Seed": {
      "name": "Soybean Seed",
      "yield": "Soybean",
      "type": "crop",
      "price": 1.5,
      "sellPrice": 2.3,
      "plantSeconds": 10800,
      "bumpkinLevel": 4,
      "plantingSpot": "Crop Plot",
      "description": "A versatile legume with countless uses.",
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "Beetroot Seed": {
      "name": "Beetroot Seed",
      "yield": "Beetroot",
      "type": "crop",
      "price": 2,
      "sellPrice": 2.8,
      "plantSeconds": 14400,
      "bumpkinLevel": 5,
      "plantingSpot": "Crop Plot",
      "description": "Good for soup!",
      "seasons": [
        "summer",
        "winter"
      ]
    },
    "Pepper Seed": {
      "name": "Pepper Seed",
      "yield": "Pepper",
      "type": "crop",
      "price": 2,
      "sellPrice": 3,
      "plantSeconds": 14400,
      "bumpkinLevel": 5,
      "plantingSpot": "Crop Plot",
      "description": "Add some spice to your farm.",
      "seasons": [
        "summer"
      ]
    },
    "Cauliflower Seed": {
      "name": "Cauliflower Seed",
      "yield": "Cauliflower",
      "type": "crop",
      "price": 3,
      "sellPrice": 4.25,
      "plantSeconds": 28800,
      "bumpkinLevel": 6,
      "plantingSpot": "Crop Plot",
      "description": "Excellent subclass of a cabbage.",
      "seasons": [
        "summer",
        "winter"
      ]
    },
    "Parsnip Seed": {
      "name": "Parsnip Seed",
      "yield": "Parsnip",
      "type": "crop",
      "price": 5,
      "sellPrice": 6.5,
      "plantSeconds": 43200,
      "bumpkinLevel": 7,
      "plantingSpot": "Crop Plot",
      "description": "Not to be mistaken for a carrot.",
      "seasons": [
        "winter"
      ]
    },
    "Eggplant Seed": {
      "name": "Eggplant Seed",
      "yield": "Eggplant",
      "type": "crop",
      "price": 6,
      "sellPrice": 8,
      "plantSeconds": 57600,
      "bumpkinLevel": 8,
      "plantingSpot": "Crop Plot",
      "description": "Nature's purple masterpiece.",
      "seasons": [
        "summer"
      ]
    },
    "Corn Seed": {
      "name": "Corn Seed",
      "yield": "Corn",
      "type": "crop",
      "price": 7,
      "sellPrice": 9,
      "plantSeconds": 72000,
      "bumpkinLevel": 9,
      "plantingSpot": "Crop Plot",
      "description": "Sun-kissed grains of summer richness.",
      "seasons": [
        "spring"
      ]
    },
    "Onion Seed": {
      "name": "Onion Seed",
      "yield": "Onion",
      "type": "crop",
      "price": 7.5,
      "sellPrice": 10,
      "plantSeconds": 72000,
      "bumpkinLevel": 9,
      "plantingSpot": "Crop Plot",
      "description": "Layer upon layer of flavor.",
      "seasons": [
        "winter"
      ]
    },
    "Radish Seed": {
      "name": "Radish Seed",
      "yield": "Radish",
      "type": "crop",
      "price": 7,
      "sellPrice": 9.5,
      "plantSeconds": 86400,
      "bumpkinLevel": 10,
      "plantingSpot": "Crop Plot",
      "description": "Takes time but is worth the wait!",
      "seasons": [
        "summer"
      ]
    },
    "Wheat Seed": {
      "name": "Wheat Seed",
      "yield": "Wheat",
      "type": "crop",
      "price": 5,
      "sellPrice": 7,
      "plantSeconds": 86400,
      "bumpkinLevel": 10,
      "plantingSpot": "Crop Plot",
      "description": "The most traded crop in the world.",
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "Turnip Seed": {
      "name": "Turnip Seed",
      "yield": "Turnip",
      "type": "crop",
      "price": 6,
      "sellPrice": 8,
      "plantSeconds": 86400,
      "bumpkinLevel": 10,
      "plantingSpot": "Crop Plot",
      "description": "A hearty winter root.",
      "seasons": [
        "winter"
      ]
    },
    "Kale Seed": {
      "name": "Kale Seed",
      "yield": "Kale",
      "type": "crop",
      "price": 7,
      "sellPrice": 10,
      "plantSeconds": 129600,
      "bumpkinLevel": 11,
      "plantingSpot": "Crop Plot",
      "description": "A bumpkin power food.",
      "seasons": [
        "spring",
        "winter"
      ]
    },
    "Artichoke Seed": {
      "name": "Artichoke Seed",
      "yield": "Artichoke",
      "type": "crop",
      "price": 9,
      "sellPrice": 12,
      "plantSeconds": 129600,
      "bumpkinLevel": 11,
      "plantingSpot": "Crop Plot",
      "description": "A thorny crown of flavor.",
      "seasons": [
        "autumn"
      ]
    },
    "Barley Seed": {
      "name": "Barley Seed",
      "yield": "Barley",
      "type": "crop",
      "price": 9,
      "sellPrice": 12,
      "plantSeconds": 172800,
      "bumpkinLevel": 12,
      "plantingSpot": "Crop Plot",
      "description": "Golden grain for bread and brews.",
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "Tomato Seed": {
      "name": "Tomato Seed",
      "yield": "Tomato",
      "type": "fruit",
      "price": 5,
      "sellPrice": 6,
      "plantSeconds": 7200,
      "bumpkinLevel": 13,
      "plantingSpot": "Fruit Patch",
      "description": "Rich in Lycopene",
      "seasons": [
        "spring",
        "autumn"
      ]
    },
    "Lemon Seed": {
      "name": "Lemon Seed",
      "yield": "Lemon",
      "type": "fruit",
      "price": 15,
      "sellPrice": 18,
      "plantSeconds": 14400,
      "bumpkinLevel": 12,
      "plantingSpot": "Fruit Patch",
      "description": "Because sometimes, you just can't squeeze an orange!",
      "seasons": [
        "summer",
        "winter"
      ]
    },
    "Blueberry Seed": {
      "name": "Blueberry Seed",
      "yield": "Blueberry",
      "type": "fruit",
      "price": 30,
      "sellPrice": 38,
      "plantSeconds": 21600,
      "bumpkinLevel": 14,
      "plantingSpot": "Fruit Patch",
      "description": "A Goblin's weakness",
      "seasons": [
        "spring",
        "winter"
      ]
    },
    "Orange Seed": {
      "name": "Orange Seed",
      "yield": "Orange",
      "type": "fruit",
      "price": 50,
      "sellPrice": 60,
      "plantSeconds": 28800,
      "bumpkinLevel": 15,
      "plantingSpot": "Fruit Patch",
      "description": "Vitamin C to keep your Bumpkin Healthy",
      "seasons": [
        "spring",
        "summer"
      ]
    },
    "Apple Seed": {
      "name": "Apple Seed",
      "yield": "Apple",
      "type": "fruit",
      "price": 70,
      "sellPrice": 85,
      "plantSeconds": 43200,
      "bumpkinLevel": 16,
      "plantingSpot": "Fruit Patch",
      "description": "Perfect for homemade apple pies",
      "seasons": [
        "autumn",
        "winter"
      ]
    },
    "Banana Plant": {
      "name": "Banana Plant",
      "yield": "Banana",
      "type": "fruit",
      "price": 90,
      "sellPrice": 110,
      "plantSeconds": 57600,
      "bumpkinLevel": 16,
      "plantingSpot": "Fruit Patch",
      "description": "A bunch of monkey business",
      "seasons": [
        "summer",
        "autumn"
      ]
    },
    "Celestine Seed": {
      "name": "Celestine Seed",
      "yield": "Celestine",
      "type": "fruit",
      "price": 120,
      "sellPrice": 150,
      "plantSeconds": 86400,
      "bumpkinLevel": 20,
      "plantingSpot": "Fruit Patch",
      "description": "Harvested only during full moon.",
      "seasons": []
    },
    "Lunara Seed": {
      "name": "Lunara Seed",
      "yield": "Lunara",
      "type": "fruit",
      "price": 180,
      "sellPrice": 220,
      "plantSeconds": 129600,
      "bumpkinLevel": 25,
      "plantingSpot": "Fruit Patch",
      "description": "Glows with moonlight essence.",
      "seasons": []
    },
    "Duskberry Seed": {
      "name": "Duskberry Seed",
      "yield": "Duskberry",
      "type": "fruit",
      "price": 250,
      "sellPrice": 300,
      "plantSeconds": 172800,
      "bumpkinLevel": 30,
      "plantingSpot": "Fruit Patch",
      "description": "A mystical berry of twilight.",
      "seasons": []
    },
    "Sunpetal Seed": {
      "name": "Sunpetal Seed",
      "type": "flower",
      "price": 16,
      "plantSeconds": 86400,
      "bumpkinLevel": 13,
      "plantingSpot": "Flower Bed",
      "description": "A seed of vibrant sunpetal blossoms.",
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "Bloom Seed": {
      "name": "Bloom Seed",
      "type": "flower",
      "price": 32,
      "plantSeconds": 172800,
      "bumpkinLevel": 22,
      "plantingSpot": "Flower Bed",
      "description": "A seed that blossoms into radiant flowers.",
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "Lily Seed": {
      "name": "Lily Seed",
      "type": "flower",
      "price": 48,
      "plantSeconds": 432000,
      "bumpkinLevel": 27,
      "plantingSpot": "Flower Bed",
      "description": "A seed of elegant lily flowers.",
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "Edelweiss Seed": {
      "name": "Edelweiss Seed",
      "type": "flower",
      "price": 48,
      "plantSeconds": 259200,
      "bumpkinLevel": 20,
      "plantingSpot": "Flower Bed",
      "description": "A hardy mountain flower seed.",
      "seasons": [
        "winter"
      ]
    },
    "Gladiolus Seed": {
      "name": "Gladiolus Seed",
      "type": "flower",
      "price": 48,
      "plantSeconds": 259200,
      "bumpkinLevel": 20,
      "plantingSpot": "Flower Bed",
      "description": "Tall and magnificent sword lilies.",
      "seasons": [
        "summer"
      ]
    },
    "Lavender Seed": {
      "name": "Lavender Seed",
      "type": "flower",
      "price": 48,
      "plantSeconds": 259200,
      "bumpkinLevel": 20,
      "plantingSpot": "Flower Bed",
      "description": "Calming purple fragrance.",
      "seasons": [
        "spring"
      ]
    },
    "Clover Seed": {
      "name": "Clover Seed",
      "type": "flower",
      "price": 48,
      "plantSeconds": 259200,
      "bumpkinLevel": 20,
      "plantingSpot": "Flower Bed",
      "description": "Brings luck to your honey harvest.",
      "seasons": [
        "autumn"
      ]
    },
    "Rice Seed": {
      "name": "Rice Seed",
      "yield": "Rice",
      "type": "greenhouse_crop",
      "price": 240,
      "sellPrice": 320,
      "plantSeconds": 115200,
      "bumpkinLevel": 40,
      "plantingSpot": "Greenhouse",
      "description": "A staple food for many.",
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "Olive Seed": {
      "name": "Olive Seed",
      "yield": "Olive",
      "type": "greenhouse_crop",
      "price": 320,
      "sellPrice": 400,
      "plantSeconds": 158400,
      "bumpkinLevel": 40,
      "plantingSpot": "Greenhouse",
      "description": "Zesty with a rich history.",
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    },
    "Grape Seed": {
      "name": "Grape Seed",
      "yield": "Grape",
      "type": "greenhouse_fruit",
      "price": 380,
      "sellPrice": 480,
      "plantSeconds": 187200,
      "bumpkinLevel": 40,
      "plantingSpot": "Greenhouse",
      "description": "Sweet clusters for wine and snacks.",
      "seasons": [
        "spring",
        "summer",
        "autumn",
        "winter"
      ]
    }
  },
  "tools": {
    "Axe": {
      "name": "Axe",
      "basePrice": 5,
      "ingredients": {
        "Wood": 1
      },
      "stock": 200,
      "bumpkinLevel": 1,
      "skillName": "Woodchopper",
      "description": "Chop trees to gather wood."
    },
    "Pickaxe": {
      "name": "Pickaxe",
      "basePrice": 20,
      "ingredients": {
        "Wood": 3
      },
      "stock": 60,
      "bumpkinLevel": 1,
      "skillName": "Frugal Miner",
      "description": "Mine stones and minerals."
    },
    "Stone Pickaxe": {
      "name": "Stone Pickaxe",
      "basePrice": 20,
      "ingredients": {
        "Wood": 3,
        "Stone": 5
      },
      "stock": 20,
      "bumpkinLevel": 1,
      "skillName": "Frugal Miner",
      "description": "Mine iron ores."
    },
    "Iron Pickaxe": {
      "name": "Iron Pickaxe",
      "basePrice": 80,
      "ingredients": {
        "Wood": 3,
        "Iron": 5
      },
      "stock": 5,
      "bumpkinLevel": 1,
      "skillName": "Frugal Miner",
      "description": "Mine gold and rich mineral nodes."
    },
    "Gold Pickaxe": {
      "name": "Gold Pickaxe",
      "basePrice": 100,
      "ingredients": {
        "Wood": 3,
        "Gold": 3
      },
      "stock": 5,
      "bumpkinLevel": 1,
      "skillName": "Frugal Miner",
      "description": "Mine valuable crimstone and special nodes."
    },
    "Rod": {
      "name": "Rod",
      "basePrice": 10,
      "ingredients": {
        "Wood": 3
      },
      "stock": 50,
      "bumpkinLevel": 1,
      "description": "Catch fish and treasures from the sea."
    },
    "Sand Shovel": {
      "name": "Sand Shovel",
      "basePrice": 25,
      "ingredients": {
        "Wood": 5,
        "Stone": 2
      },
      "stock": 25,
      "bumpkinLevel": 1,
      "description": "Dig for treasure in the sand."
    }
  }
};

  S.GAME_DATA = GAME_DATA;
  S.SEASONAL_SEEDS = GAME_DATA.seasons;
  S.ALL_SEEDS_DATA = GAME_DATA.seeds;
  S.ALL_TOOLS_DATA = GAME_DATA.tools;

  // Hàm tiện ích tra cứu nhanh thông tin hạt giống
  S.getSeedInfo = function (seedName) {
    return GAME_DATA.seeds[seedName] || null;
  };

  // Hàm lấy danh sách hạt giống theo mùa (sắp xếp từ rẻ đến đắt hoặc theo thời gian)
  S.getSeedsForSeason = function (season = "spring", sortBy = "price") {
    const s = season.toLowerCase();
    const list = GAME_DATA.seasons[s] || GAME_DATA.seasons.spring;
    const items = list.map((name) => GAME_DATA.seeds[name]).filter(Boolean);

    if (sortBy === "price") {
      items.sort((a, b) => a.price - b.price);
    } else if (sortBy === "time") {
      items.sort((a, b) => a.plantSeconds - b.plantSeconds);
    }
    return items;
  };

  console.log("%c[SFL GameData] 📚 Đã nạp thành công bộ dữ liệu Game Data từ mã nguồn gốc Sunflower Land!", "color: #00e676; font-weight: bold; font-size: 12px;");
})(window.SunflowerBot = window.SunflowerBot || {});
