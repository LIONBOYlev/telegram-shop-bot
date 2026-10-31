# Telegram Shop Bot

A ready-to-use Telegram bot for small shops, cafés and Instagram sellers. Customers browse the catalog, fill a cart and place an order without leaving Telegram. The owner gets every order instantly and updates its status with one tap, and the customer is notified automatically.

Built with **Node.js** and **[grammY](https://grammy.dev)**.

<!-- Add a screenshot or GIF here, e.g. ![demo](docs/demo.gif) -->

## Features

**For customers**
- 🛍 Catalog with categories and product cards (optional photos)
- 🛒 Cart with ➕/➖ buttons and a live total
- 📝 Step-by-step checkout: name → phone (one-tap share) → delivery address or pickup → comment
- ✅ Order summary and confirmation before it is placed
- 🔔 Automatic status messages: accepted, on the way / ready for pickup, completed
- 📦 "My orders" history

**For the shop owner**
- Every new order is sent to your Telegram (private chat or a staff group)
- Status buttons on each order: Accept → Out for delivery → Completed, or Cancel
- `/orders` lists the latest orders, `/order 12` opens one
- Products, prices and shop info live in one JSON file: no coding needed to change them
- Carts are saved to disk, so they survive a restart

## Quick start

1. **Create a bot.** Open [@BotFather](https://t.me/BotFather), send `/newbot` and copy the token.
2. **Install.** Requires Node.js 18 or newer.
   ```bash
   npm install
   ```
3. **Configure.** Copy `.env.example` to `.env` and paste your token into `BOT_TOKEN`.
4. **Run.**
   ```bash
   npm start
   ```
5. **Connect the admin.** Send `/id` to your bot, put the number it replies with into `ADMIN_CHAT_ID` in `.env`, and restart. To send orders to a staff group instead, add the bot to the group, send `/id` there and use that ID.

## Settings (`.env`)

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Token from @BotFather |
| `ADMIN_CHAT_ID` | Where new orders are sent (your user ID or a group ID) |
| `CURRENCY` | Symbol shown before prices, e.g. `$`, `€`, `֏` (default `$`) |
| `DATA_DIR` | Folder for orders and saved carts (default `data`) |

## Editing the catalog

Everything is in [`data/products.json`](data/products.json):

```json
{
  "shop": { "name": "Demo Coffee", "about": "…", "contact": "…" },
  "categories": [{ "id": "coffee", "title": "☕ Coffee" }],
  "products": [
    {
      "id": "latte",
      "category": "coffee",
      "name": "Latte",
      "price": 3.5,
      "description": "Mild and creamy.",
      "image": "latte.jpg"
    }
  ]
}
```

`image` is optional. Use a full `https://` link, or a file name from `data/images/`. Restart the bot after editing.

## Project structure

```
src/
  index.js     starts the bot
  bot.js       menus, catalog, cart, checkout and admin handlers
  catalog.js   reads products.json, calculates cart totals
  orders.js    saves orders to data/orders.json
  format.js    message texts and order statuses
  config.js    reads .env
data/
  products.json
```

## Running 24/7

On a VPS (Ubuntu, Oracle Cloud free tier, etc.) the simplest way is [pm2](https://pm2.keymetrics.io):

```bash
npm install -g pm2
pm2 start src/index.js --name shop-bot
pm2 save && pm2 startup
```

## Ideas for extending

Online payments (Telegram Payments, Stripe), stock tracking, promo codes, a Google Sheets export of orders, multiple languages, or an admin panel to edit products from inside Telegram.

## License

MIT
