import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

export const config = {
  botToken: process.env.BOT_TOKEN,
  adminChatId: process.env.ADMIN_CHAT_ID?.trim() || null,
  currency: process.env.CURRENCY ?? "$",
  dataDir: resolve(ROOT, process.env.DATA_DIR || "data"),
};
