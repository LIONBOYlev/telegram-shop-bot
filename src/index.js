import { config } from "./config.js";
import { createBot } from "./bot.js";

if (!config.botToken) {
  console.error("BOT_TOKEN is missing. Copy .env.example to .env and put your token from @BotFather there.");
  process.exit(1);
}
if (!config.adminChatId) {
  console.warn("ADMIN_CHAT_ID is not set, so orders won't be forwarded. Send /id to the bot to find your ID.");
}

const bot = createBot();

await bot.api.setMyCommands([
  { command: "start", description: "Open the shop" },
  { command: "cart", description: "Show my cart" },
]);

process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());

await bot.start({
  onStart: (me) => console.log(`@${me.username} is running. Press Ctrl+C to stop.`),
});
