import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./config.js";

const data = JSON.parse(readFileSync(join(ROOT, "data", "products.json"), "utf8"));

export const shop = data.shop;
export const categories = data.categories;

const productsById = new Map(data.products.map((p) => [p.id, p]));

export function getCategory(id) {
  return categories.find((c) => c.id === id);
}

export function getProduct(id) {
  return productsById.get(id);
}

export function productsIn(categoryId) {
  return data.products.filter((p) => p.category === categoryId);
}

// Turns the session cart ({ productId: qty }) into priced line items.
// Products removed from products.json are skipped.
export function cartItems(cart) {
  const items = [];
  for (const [id, qty] of Object.entries(cart)) {
    const p = getProduct(id);
    if (p && qty > 0) items.push({ id, name: p.name, price: p.price, qty });
  }
  const total = round2(items.reduce((sum, i) => sum + i.price * i.qty, 0));
  return { items, total };
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}
