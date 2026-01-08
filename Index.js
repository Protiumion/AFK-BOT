const mineflayer = require("mineflayer");
const { pathfinder, Movements } = require("mineflayer-pathfinder");
const fetch = require("node-fetch");
const { createCanvas, loadImage } = require("canvas");
const Vec3 = require("vec3");

const PASSWORD = "123456"; // change this
const SERVER_IP = "Mega_Martin.aternos.me";
const BOT_NAME = "FastBuilderBot";

// Simple block palette (you can expand later)
const BLOCKS = [
  { r: 255, g: 255, b: 255, name: "white_concrete" },
  { r: 0, g: 0, b: 0, name: "black_concrete" },
  { r: 255, g: 0, b: 0, name: "red_concrete" },
  { r: 0, g: 255, b: 0, name: "lime_concrete" },
  { r: 0, g: 0, b: 255, name: "blue_concrete" }
];

function closestBlock(r, g, b) {
  let best = BLOCKS[0];
  let bestDist = Infinity;

  for (const block of BLOCKS) {
    const d =
      (r - block.r) ** 2 +
      (g - block.g) ** 2 +
      (b - block.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = block;
    }
  }
  return best.name;
}

function startBot() {
  const bot = mineflayer.createBot({
    host: SERVER_IP,
    username: BOT_NAME,
    version: false
  });

  bot.loadPlugin(pathfinder);

  // ===== AUTO LOGIN =====
  bot.on("messagestr", (msg) => {
    const m = msg.toLowerCase();
    if (m.includes("/register")) bot.chat(`/register ${PASSWORD} ${PASSWORD}`);
    if (m.includes("/login")) bot.chat(`/login ${PASSWORD}`);
  });

  bot.once("spawn", () => {
    console.log("✅ Bot spawned");

    const mcData = require("minecraft-data")(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));

    // Anti-AFK every 60 sec
    setInterval(() => {
      bot.look(Math.random() * Math.PI * 2, 0, true);
      bot.setControlState("jump", true);
      setTimeout(() => bot.setControlState("jump", false), 400);
    }, 60000);
  });

  // ===== FASTBUILD COMMAND =====
  bot.on("chat", async (username, message) => {
    if (!message.startsWith("!fastbuild")) return;
    if (username === bot.username) return;

    const args = message.split(" ");
    if (!args[1]) {
      bot.chat("Usage: !fastbuild <image_url>");
      return;
    }

    const imageUrl = args[1];
    bot.chat("⏳ Downloading image...");

    try {
      const img = await loadImage(imageUrl);

      const size = 32; // 32x32 build (safe)
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      const origin = bot.entity.position.floored().offset(1, 0, 1);

      bot.chat("🧱 Building...");

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = (y * size + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 10) continue;

          const blockName = closestBlock(r, g, b);
          const blockId = bot.registry.blocksByName[blockName].id;

          const pos = origin.offset(x, size - y, 0);

          await bot.placeBlock(
            bot.blockAt(pos.offset(0, -1, 0)),
            new Vec3(0, 1, 0),
            { blockId }
          );

          await new Promise(r => setTimeout(r, 120));
        }
      }

      bot.chat("✅ Build complete!");

    } catch (err) {
      console.log(err);
      bot.chat("❌ Failed to build image.");
    }
  });

  // ===== AUTO RECONNECT =====
  bot.on("end", () => {
    console.log("❌ Bot disconnected. Reconnecting...");
    setTimeout(startBot, 5000);
  });

  bot.on("error", console.log);
}

startBot();
