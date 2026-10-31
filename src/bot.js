import { existsSync } from "node:fs";
import { join } from "node:path";
import { Bot, GrammyError, InlineKeyboard, InputFile, Keyboard, session } from "grammy";
import { FileAdapter } from "@grammyjs/storage-file";
import { config, ROOT } from "./config.js";
import { cartItems, categories, getCategory, getProduct, productsIn, shop } from "./catalog.js";
import { createOrder, getOrder, ordersOfUser, recentOrders, setStatus } from "./orders.js";
import {
  NEXT_STATUS, STATUS, customerStatusText, esc, isPickup, itemLines, money, orderText,
} from "./format.js";

const MAX_QTY = 99;
const HTML = { parse_mode: "HTML" };

const BTN = {
  catalog: "🛍 Catalog",
  cart: "🛒 Cart",
  orders: "📦 My orders",
  help: "ℹ️ Contacts",
  cancel: "❌ Cancel order",
  pickup: "🏃 I'll pick it up",
  skip: "⏭ Skip",
  sharePhone: "📱 Share my number",
};

const mainMenu = new Keyboard()
  .text(BTN.catalog).text(BTN.cart).row()
  .text(BTN.orders).text(BTN.help)
  .resized();
const cancelMenu = new Keyboard().text(BTN.cancel).resized();
const phoneMenu = new Keyboard().requestContact(BTN.sharePhone).row().text(BTN.cancel).resized();
const addressMenu = new Keyboard().text(BTN.pickup).row().text(BTN.cancel).resized();
const commentMenu = new Keyboard().text(BTN.skip).row().text(BTN.cancel).resized();

// ---------- views: each returns [text, inlineKeyboard] ----------

function catalogView() {
  const kb = new InlineKeyboard();
  for (const c of categories) kb.text(c.title, `cat:${c.id}`).row();
  kb.text("🛒 Cart", "cart");
  return [`<b>${esc(shop.name)}</b>\nChoose a category:`, kb];
}

function categoryView(category) {
  const kb = new InlineKeyboard();
  for (const p of productsIn(category.id)) kb.text(`${p.name} · ${money(p.price)}`, `prod:${p.id}`).row();
  kb.text("⬅️ Back", "catalog").text("🛒 Cart", "cart");
  return [`<b>${esc(category.title)}</b>\nTap a product to see details:`, kb];
}

function productText(p) {
  return `<b>${esc(p.name)}</b>\n\n${esc(p.description)}\n\nPrice: <b>${money(p.price)}</b>`;
}

function productKeyboard(p, cart) {
  const qty = cart[p.id] || 0;
  const kb = new InlineKeyboard();
  if (qty) kb.text("➖", `pdec:${p.id}`).text(`${qty} in cart`, "noop").text("➕", `pinc:${p.id}`).row();
  else kb.text("➕ Add to cart", `pinc:${p.id}`).row();
  return kb.text("⬅️ Back", `cat:${p.category}`).text("🛒 Cart", "cart");
}

function cartView(cart) {
  const { items, total } = cartItems(cart);
  if (!items.length) {
    return ["🛒 Your cart is empty.", new InlineKeyboard().text("🛍 Go to catalog", "catalog")];
  }
  const kb = new InlineKeyboard();
  for (const i of items) {
    kb.text("➖", `cdec:${i.id}`).text(`${i.name} × ${i.qty}`, "noop").text("➕", `cinc:${i.id}`).row();
  }
  kb.text("🗑 Clear", "clear").text("🛍 Add more", "catalog").row();
  kb.text(`✅ Checkout · ${money(total)}`, "checkout");
  return [`<b>Your cart</b>\n\n${itemLines(items)}\n\nTotal: <b>${money(total)}</b>`, kb];
}

function adminKeyboard(order) {
  const label = {
    accepted: "✅ Accept",
    shipped: isPickup(order) ? "📦 Ready for pickup" : "🚚 Out for delivery",
    done: "🎉 Completed",
    cancelled: "❌ Cancel",
  };
  const kb = new InlineKeyboard();
  for (const s of NEXT_STATUS[order.status]) kb.text(label[s], `st:${order.id}:${s}`);
  return kb;
}

function photoSource(image) {
  if (/^https?:\/\//.test(image)) return image;
  const file = join(ROOT, "data", "images", image);
  return existsSync(file) ? new InputFile(file) : null;
}

// ---------- helpers ----------

// Shows a view in place of the message the button was on. Photo messages
// can't be edited into text, so those are replaced with a new message.
async function show(ctx, text, keyboard) {
  const opts = { ...HTML, reply_markup: keyboard };
  const msg = ctx.callbackQuery?.message;
  if (msg?.text) {
    try {
      await ctx.editMessageText(text, opts);
    } catch (err) {
      if (!(err instanceof GrammyError && err.description.includes("message is not modified"))) throw err;
    }
    return;
  }
  if (msg) await ctx.deleteMessage().catch(() => {});
  await ctx.reply(text, opts);
}

function changeQty(cart, id, delta) {
  const qty = Math.min(MAX_QTY, Math.max(0, (cart[id] || 0) + delta));
  if (qty) cart[id] = qty;
  else delete cart[id];
  return qty;
}

function isAdmin(ctx) {
  const admin = config.adminChatId;
  return !!admin && (String(ctx.chat?.id) === admin || String(ctx.from?.id) === admin);
}

// ---------- bot ----------

export function createBot(token = config.botToken, botConfig) {
  const bot = new Bot(token, botConfig);

  bot.use(session({
    initial: () => ({ cart: {}, checkout: null }),
    storage: new FileAdapter({ dirName: join(config.dataDir, "sessions") }),
  }));

  // --- commands ---

  bot.command("start", async (ctx) => {
    ctx.session.checkout = null;
    await ctx.reply(
      `👋 Welcome to <b>${esc(shop.name)}</b>!\n\n${esc(shop.about)}\n\nUse the menu below to browse and order.`,
      { ...HTML, reply_markup: mainMenu },
    );
    await ctx.reply(...catalogMessage());
  });

  bot.command("id", (ctx) =>
    ctx.reply(`This chat's ID: <code>${ctx.chat.id}</code>\nPut it in .env as ADMIN_CHAT_ID to receive orders here.`, HTML));

  bot.command("orders", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const orders = recentOrders(15);
    if (!orders.length) return ctx.reply("No orders yet.");
    const lines = orders.map((o) => `#${o.id} · ${esc(o.name)} · ${money(o.total)} · ${STATUS[o.status]}`);
    await ctx.reply(`<b>Latest orders</b>\n\n${lines.join("\n")}\n\nOpen one with /order &lt;number&gt;`, HTML);
  });

  bot.command("order", async (ctx) => {
    if (!isAdmin(ctx)) return;
    const order = getOrder(Number(ctx.match));
    if (!order) return ctx.reply("Order not found. Usage: /order 12");
    await ctx.reply(orderText(order, { forAdmin: true }), { ...HTML, reply_markup: adminKeyboard(order) });
  });

  bot.command("cart", (ctx) => replyCart(ctx));

  // --- checkout: cancel works at any step ---

  bot.hears(BTN.cancel, async (ctx) => {
    ctx.session.checkout = null;
    await ctx.reply("Checkout cancelled. Your cart is saved.", { reply_markup: mainMenu });
  });

  bot.on(["message:text", "message:contact"], async (ctx, next) => {
    const co = ctx.session.checkout;
    if (!co || co.step === "confirm") return next();
    const text = ctx.message.text?.trim();

    switch (co.step) {
      case "name":
        if (!text) return ctx.reply("Please type your name.");
        co.name = text.slice(0, 100);
        co.step = "phone";
        return ctx.reply(
          `Thanks, ${esc(co.name)}! Tap the button to share your phone number, or type it.`,
          { ...HTML, reply_markup: phoneMenu },
        );

      case "phone": {
        const phone = ctx.message.contact?.phone_number ?? text;
        if (!phone || !/^\+?[\d\s()-]{6,20}$/.test(phone)) {
          return ctx.reply("That doesn't look like a phone number. Please try again or use the button.");
        }
        co.phone = phone;
        co.step = "address";
        return ctx.reply("Where should we deliver? Type your address, or choose pickup.", { reply_markup: addressMenu });
      }

      case "address":
        if (!text) return ctx.reply("Please type the address.");
        co.address = text === BTN.pickup ? "Pickup" : text.slice(0, 300);
        co.step = "comment";
        return ctx.reply("Anything else we should know? (delivery time, entrance, etc.)", { reply_markup: commentMenu });

      case "comment": {
        if (!text) return ctx.reply("Please type a comment or tap Skip.");
        co.comment = text === BTN.skip ? "" : text.slice(0, 500);
        co.step = "confirm";
        const { items, total } = cartItems(ctx.session.cart);
        const preview = orderText({ ...co, id: "—", status: "new", items, total }).replace(/^.*\n/, "");
        await ctx.reply("Please check your order:", { reply_markup: { remove_keyboard: true } });
        return ctx.reply(`🧾 <b>Your order</b>\n${preview}`, {
          ...HTML,
          reply_markup: new InlineKeyboard().text("✅ Confirm", "confirm").text("❌ Cancel", "cancel_checkout"),
        });
      }
    }
  });

  // --- main menu ---

  bot.hears(BTN.catalog, (ctx) => ctx.reply(...catalogMessage()));
  bot.hears(BTN.cart, (ctx) => replyCart(ctx));
  bot.hears(BTN.help, (ctx) =>
    ctx.reply(`<b>${esc(shop.name)}</b>\n\n${esc(shop.contact)}`, HTML));

  bot.hears(BTN.orders, async (ctx) => {
    const orders = ordersOfUser(ctx.from.id);
    if (!orders.length) return ctx.reply("You have no orders yet.");
    const lines = orders.map((o) =>
      `<b>#${o.id}</b> · ${money(o.total)} · ${STATUS[o.status]}\n${new Date(o.createdAt).toLocaleDateString("en-GB")}`);
    await ctx.reply(`<b>Your recent orders</b>\n\n${lines.join("\n\n")}`, HTML);
  });

  // --- catalog navigation ---

  bot.callbackQuery("catalog", async (ctx) => {
    await ctx.answerCallbackQuery();
    await show(ctx, ...catalogView());
  });

  bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
    const category = getCategory(ctx.match[1]);
    if (!category) return ctx.answerCallbackQuery("This category is no longer available.");
    await ctx.answerCallbackQuery();
    await show(ctx, ...categoryView(category));
  });

  bot.callbackQuery(/^prod:(.+)$/, async (ctx) => {
    const p = getProduct(ctx.match[1]);
    if (!p) return ctx.answerCallbackQuery("This product is no longer available.");
    await ctx.answerCallbackQuery();
    const photo = p.image && photoSource(p.image);
    if (!photo) return show(ctx, productText(p), productKeyboard(p, ctx.session.cart));
    await ctx.deleteMessage().catch(() => {});
    await ctx.replyWithPhoto(photo, {
      caption: productText(p), ...HTML, reply_markup: productKeyboard(p, ctx.session.cart),
    });
  });

  // + / - on a product card: only the buttons change, so this works for photo cards too
  bot.callbackQuery(/^p(inc|dec):(.+)$/, async (ctx) => {
    const p = getProduct(ctx.match[2]);
    if (!p) return ctx.answerCallbackQuery("This product is no longer available.");
    const qty = changeQty(ctx.session.cart, p.id, ctx.match[1] === "inc" ? 1 : -1);
    await ctx.answerCallbackQuery(qty ? `${p.name}: ${qty} in cart` : `${p.name} removed`);
    await ctx.editMessageReplyMarkup({ reply_markup: productKeyboard(p, ctx.session.cart) }).catch(() => {});
  });

  // --- cart ---

  bot.callbackQuery("cart", async (ctx) => {
    await ctx.answerCallbackQuery();
    await show(ctx, ...cartView(ctx.session.cart));
  });

  bot.callbackQuery(/^c(inc|dec):(.+)$/, async (ctx) => {
    changeQty(ctx.session.cart, ctx.match[2], ctx.match[1] === "inc" ? 1 : -1);
    await ctx.answerCallbackQuery();
    await show(ctx, ...cartView(ctx.session.cart));
  });

  bot.callbackQuery("clear", async (ctx) => {
    ctx.session.cart = {};
    await ctx.answerCallbackQuery("Cart cleared");
    await show(ctx, ...cartView(ctx.session.cart));
  });

  // --- checkout ---

  bot.callbackQuery("checkout", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!cartItems(ctx.session.cart).items.length) return show(ctx, ...cartView(ctx.session.cart));
    ctx.session.checkout = { step: "name" };
    await ctx.reply("Let's place your order 📝\n\nWhat's your name?", { reply_markup: cancelMenu });
  });

  bot.callbackQuery("cancel_checkout", async (ctx) => {
    ctx.session.checkout = null;
    await ctx.answerCallbackQuery("Cancelled");
    await ctx.editMessageText("Checkout cancelled. Your cart is saved.");
    await ctx.reply("You can keep shopping 👇", { reply_markup: mainMenu });
  });

  bot.callbackQuery("confirm", async (ctx) => {
    const co = ctx.session.checkout;
    const { items, total } = cartItems(ctx.session.cart);
    if (co?.step !== "confirm" || !items.length) {
      return ctx.answerCallbackQuery("This order is no longer active.");
    }
    const order = createOrder({
      userId: ctx.from.id,
      username: ctx.from.username ?? null,
      items,
      total,
      name: co.name,
      phone: co.phone,
      address: co.address,
      comment: co.comment,
    });
    ctx.session.cart = {};
    ctx.session.checkout = null;

    await ctx.answerCallbackQuery("Order placed!");
    await ctx.editMessageText(orderText(order), HTML);
    await ctx.reply(
      `✅ Thank you! Order <b>#${order.id}</b> is received.\nWe'll message you here as soon as it's confirmed.`,
      { ...HTML, reply_markup: mainMenu },
    );

    if (config.adminChatId) {
      await ctx.api
        .sendMessage(config.adminChatId, `🔔 New order!\n\n${orderText(order, { forAdmin: true })}`, {
          ...HTML, reply_markup: adminKeyboard(order),
        })
        .catch((err) => console.error(`Could not notify admin about order #${order.id}:`, err.message));
    }
  });

  // --- admin: order status buttons ---

  bot.callbackQuery(/^st:(\d+):(\w+)$/, async (ctx) => {
    if (!isAdmin(ctx)) return ctx.answerCallbackQuery("Only the shop admin can do this.");
    const order = getOrder(Number(ctx.match[1]));
    const status = ctx.match[2];
    if (!order || !NEXT_STATUS[order.status].includes(status)) {
      return ctx.answerCallbackQuery("This action is no longer available.");
    }
    setStatus(order.id, status);
    await ctx.answerCallbackQuery(`Order #${order.id}: ${STATUS[status]}`);
    await ctx.editMessageText(orderText(order, { forAdmin: true }), { ...HTML, reply_markup: adminKeyboard(order) });
    await ctx.api.sendMessage(order.userId, customerStatusText(order), HTML)
      .catch((err) => console.error(`Could not notify customer of order #${order.id}:`, err.message));
  });

  // --- fallbacks ---

  bot.callbackQuery("noop", (ctx) => ctx.answerCallbackQuery());
  bot.on("callback_query:data", (ctx) => ctx.answerCallbackQuery());
  bot.on("message", (ctx) => {
    if (ctx.chat.type !== "private") return;
    return ctx.reply("Please use the menu below 👇", { reply_markup: mainMenu });
  });

  bot.catch((err) => console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error));

  return bot;

  function catalogMessage() {
    const [text, kb] = catalogView();
    return [text, { ...HTML, reply_markup: kb }];
  }

  function replyCart(ctx) {
    const [text, kb] = cartView(ctx.session.cart);
    return ctx.reply(text, { ...HTML, reply_markup: kb });
  }
}
