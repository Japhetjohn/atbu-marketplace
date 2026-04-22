const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

let cache = null;
let lastRead = 0;
const CACHE_TTL = 100; // ms

async function readDB() {
  const now = Date.now();
  if (cache && now - lastRead < CACHE_TTL) {
    return JSON.parse(JSON.stringify(cache));
  }
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    cache = JSON.parse(data);
  } catch {
    cache = { users: [], products: [], orders: [], banks: [] };
  }
  lastRead = now;
  return JSON.parse(JSON.stringify(cache));
}

async function writeDB(db) {
  cache = JSON.parse(JSON.stringify(db));
  await fs.writeFile(DB_PATH, JSON.stringify(cache, null, 2));
}

// User helpers
async function getUsers() {
  const db = await readDB();
  return db.users;
}

async function getUserById(id) {
  const db = await readDB();
  return db.users.find(u => u.id === id);
}

async function getUserByRegNumber(regNumber) {
  const db = await readDB();
  return db.users.find(u => u.regNumber === regNumber);
}

async function getUserByEmail(email) {
  const db = await readDB();
  return db.users.find(u => u.email === email) || null;
}

async function createUser(user) {
  const db = await readDB();
  const existing = db.users.find(u => u.regNumber === user.regNumber);
  if (existing) {
    // Update existing user
    Object.assign(existing, user);
    await writeDB(db);
    return existing;
  }
  db.users.push(user);
  await writeDB(db);
  return user;
}

async function updateUser(id, updates) {
  const db = await readDB();
  const user = db.users.find(u => u.id === id);
  if (user) {
    Object.assign(user, updates);
    await writeDB(db);
    return user;
  }
  return null;
}

// Product helpers
async function getProducts() {
  const db = await readDB();
  return db.products;
}

async function getProductById(id) {
  const db = await readDB();
  return db.products.find(p => p.id === id);
}

async function createProduct(product) {
  const db = await readDB();
  db.products.push(product);
  await writeDB(db);
  return product;
}

// Order helpers
async function getOrders() {
  const db = await readDB();
  return db.orders;
}

async function getOrderById(id) {
  const db = await readDB();
  return db.orders.find(o => o.id === id);
}

async function getOrderByReference(reference) {
  const db = await readDB();
  return db.orders.find(o => o.reference === reference);
}

async function getOrdersByBuyer(buyerId) {
  const db = await readDB();
  return db.orders.filter(o => o.buyerId === buyerId);
}

async function getOrdersBySeller(sellerId) {
  const db = await readDB();
  return db.orders.filter(o => o.sellerId === sellerId);
}

async function createOrder(order) {
  const db = await readDB();
  db.orders.push(order);
  await writeDB(db);
  return order;
}

async function updateOrder(id, updates) {
  const db = await readDB();
  const order = db.orders.find(o => o.id === id);
  if (order) {
    Object.assign(order, updates);
    await writeDB(db);
    return order;
  }
  return null;
}

// Bank helpers
async function getBanks() {
  const db = await readDB();
  return db.banks || [];
}

async function setBanks(banks) {
  const db = await readDB();
  db.banks = banks;
  await writeDB(db);
}

module.exports = {
  readDB,
  writeDB,
  getUsers,
  getUserById,
  getUserByRegNumber,
  getUserByEmail,
  createUser,
  updateUser,
  getProducts,
  getProductById,
  createProduct,
  getOrders,
  getOrderById,
  getOrderByReference,
  getOrdersByBuyer,
  getOrdersBySeller,
  createOrder,
  updateOrder,
  getBanks,
  setBanks,
};
