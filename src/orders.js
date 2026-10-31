import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config.js";

// Orders are kept in a single JSON file. Fine for a small shop;
// swap this module for a real database when volume grows.
const FILE = join(config.dataDir, "orders.json");

mkdirSync(config.dataDir, { recursive: true });
const db = existsSync(FILE)
  ? JSON.parse(readFileSync(FILE, "utf8"))
  : { lastId: 0, orders: [] };

function save() {
  const tmp = FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, FILE);
}

export function createOrder(fields) {
  const order = {
    id: ++db.lastId,
    ...fields,
    status: "new",
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  save();
  return order;
}

export function getOrder(id) {
  return db.orders.find((o) => o.id === id);
}

export function setStatus(id, status) {
  const order = getOrder(id);
  if (!order) return null;
  order.status = status;
  order.updatedAt = new Date().toISOString();
  save();
  return order;
}

export function ordersOfUser(userId, limit = 5) {
  return db.orders.filter((o) => o.userId === userId).slice(-limit).reverse();
}

export function recentOrders(limit = 10) {
  return db.orders.slice(-limit).reverse();
}
