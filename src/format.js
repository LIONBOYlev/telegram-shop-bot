import { config } from "./config.js";

export function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function money(n) {
  return `${config.currency}${Number(n).toFixed(2)}`;
}

export const STATUS = {
  new: "🆕 New",
  accepted: "✅ Accepted",
  shipped: "🚚 Sent out",
  done: "🎉 Completed",
  cancelled: "❌ Cancelled",
};

// Which statuses the admin can move an order to from its current one.
export const NEXT_STATUS = {
  new: ["accepted", "cancelled"],
  accepted: ["shipped", "cancelled"],
  shipped: ["done"],
  done: [],
  cancelled: [],
};

export const isPickup = (order) => order.address === "Pickup";

export function itemLines(items) {
  return items.map((i) => `• ${esc(i.name)} × ${i.qty} — ${money(i.price * i.qty)}`).join("\n");
}

export function orderText(order, { forAdmin = false } = {}) {
  const lines = [
    `🧾 <b>Order #${order.id}</b> · ${STATUS[order.status]}`,
    "",
    itemLines(order.items),
    "",
    `Total: <b>${money(order.total)}</b>`,
    "",
    `👤 ${esc(order.name)}`,
    `📞 ${esc(order.phone)}`,
    `📍 ${esc(order.address)}`,
  ];
  if (order.comment) lines.push(`💬 ${esc(order.comment)}`);
  if (forAdmin) {
    const who = order.username ? `@${esc(order.username)}` : "open chat";
    lines.push("", `Customer: <a href="tg://user?id=${order.userId}">${who}</a>`);
    lines.push(`Placed: ${new Date(order.createdAt).toLocaleString("en-GB")}`);
  }
  return lines.join("\n");
}

export function customerStatusText(order) {
  const what = {
    accepted: "has been accepted and is being prepared 👨‍🍳",
    shipped: isPickup(order) ? "is ready for pickup 📦" : "is on the way 🚚",
    done: "is completed. Thank you, enjoy! 🎉",
    cancelled: "was cancelled. If you have questions, just write to us.",
  }[order.status];
  return `Your order <b>#${order.id}</b> ${what}`;
}
