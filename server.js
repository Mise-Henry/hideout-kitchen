const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── FILE-BASED PERSISTENCE ─────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      var data = fs.readFileSync(DATA_FILE, 'utf8');
      var parsed = JSON.parse(data);
      orderCounter = parsed.counter || 1;
      return parsed.orders || [];
    }
  } catch(e) {
    console.log('Could not load orders file:', e.message);
  }
  return [];
}

function saveOrders() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: orders, counter: orderCounter }), 'utf8');
  } catch(e) {
    console.log('Could not save orders file:', e.message);
  }
}

// Load existing orders on startup
var orders = [];
var orderCounter = 1;
orders = loadOrders();
console.log('Loaded ' + orders.length + ' existing orders from disk');

// ── POST /order — receive order from QR menu ──────────────────────────────
app.post('/order', (req, res) => {
  const { items, orderType, table, name, note, timestamp } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Sipariş boş olamaz' });
  }

  const order = {
    id: orderCounter++,
    items,
    orderType: orderType || 'dinein',
    table: table || '',
    name: name || 'Misafir',
    note: note || '',
    timestamp: timestamp || new Date().toLocaleString('tr-TR'),
    receivedAt: Date.now(),
    status: 'new' // new | preparing | ready | done
  };

  orders.push(order);
  saveOrders();

  // Emit to all connected kitchen screens
  io.emit('new_order', order);

  console.log('Yeni siparis #' + order.id + ' - ' + order.name + ' - ' + order.orderType);

  res.json({ success: true, orderId: order.id });
});

// ── GET /orders — get all active orders ───────────────────────────────────
app.get('/orders', (req, res) => {
  // Return all orders that aren't done
  const active = orders.filter(function(o) { return o.status !== 'done'; });
  res.json(active);
});

// ── POST /order/:id/status — update order status ──────────────────────────
app.post('/order/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const validStatuses = ['new', 'preparing', 'ready', 'done'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Gecersiz durum' });
  }

  const order = orders.find(function(o) { return o.id === id; });
  if (!order) {
    return res.status(404).json({ error: 'Siparis bulunamadi' });
  }

  order.status = status;
  saveOrders();
  io.emit('order_updated', { id: order.id, status: order.status });

  res.json({ success: true });
});

// ── DELETE /order/:id — remove order ─────────────────────────────────────
app.delete('/order/:id', (req, res) => {
  const id = parseInt(req.params.id);
  orders = orders.filter(function(o) { return o.id !== id; });
  saveOrders();
  io.emit('order_removed', { id });
  res.json({ success: true });
});

// ── GET /stats — basic daily stats ───────────────────────────────────────
app.get('/stats', (req, res) => {
  const total = orders.reduce(function(sum, o) {
    return sum + o.items.reduce(function(s, i) { return s + (i.price * i.qty); }, 0);
  }, 0);

  res.json({
    totalOrders: orders.length,
    totalRevenue: total,
    activeOrders: orders.filter(function(o) { return o.status !== 'done'; }).length
  });
});

// ── Socket.io connection ──────────────────────────────────────────────────
io.on('connection', function(socket) {
  console.log('Mutfak ekrani baglandi: ' + socket.id);

  // Send current active orders to newly connected screen
  const active = orders.filter(function(o) { return o.status !== 'done'; });
  socket.emit('init_orders', active);

  socket.on('disconnect', function() {
    console.log('Mutfak ekrani ayrildi: ' + socket.id);
  });
});

// ── Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('Hideout Mutfak Sunucusu calisiyor: port ' + PORT);
});const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── FILE-BASED PERSISTENCE ─────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      var data = fs.readFileSync(DATA_FILE, 'utf8');
      var parsed = JSON.parse(data);
      orderCounter = parsed.counter || 1;
      return parsed.orders || [];
    }
  } catch(e) {
    console.log('Could not load orders file:', e.message);
  }
  return [];
}

function saveOrders() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: orders, counter: orderCounter }), 'utf8');
  } catch(e) {
    console.log('Could not save orders file:', e.message);
  }
}

// Load existing orders on startup
var orders = [];
var orderCounter = 1;
orders = loadOrders();
console.log('Loaded ' + orders.length + ' existing orders from disk');

// ── POST /order — receive order from QR menu ──────────────────────────────
app.post('/order', (req, res) => {
  const { items, orderType, table, name, note, timestamp } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Sipariş boş olamaz' });
  }

  const order = {
    id: orderCounter++,
    items,
    orderType: orderType || 'dinein',
    table: table || '',
    name: name || 'Misafir',
    note: note || '',
    timestamp: timestamp || new Date().toLocaleString('tr-TR'),
    receivedAt: Date.now(),
    status: 'new' // new | preparing | ready | done
  };

  orders.push(order);
  saveOrders();

  // Emit to all connected kitchen screens
  io.emit('new_order', order);

  console.log('Yeni siparis #' + order.id + ' - ' + order.name + ' - ' + order.orderType);

  res.json({ success: true, orderId: order.id });
});

// ── GET /orders — get all active orders ───────────────────────────────────
app.get('/orders', (req, res) => {
  // Return all orders that aren't done
  const active = orders.filter(function(o) { return o.status !== 'done'; });
  res.json(active);
});

// ── POST /order/:id/status — update order status ──────────────────────────
app.post('/order/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const validStatuses = ['new', 'preparing', 'ready', 'done'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Gecersiz durum' });
  }

  const order = orders.find(function(o) { return o.id === id; });
  if (!order) {
    return res.status(404).json({ error: 'Siparis bulunamadi' });
  }

  order.status = status;
  saveOrders();
  io.emit('order_updated', { id: order.id, status: order.status });

  res.json({ success: true });
});

// ── DELETE /order/:id — remove order ─────────────────────────────────────
app.delete('/order/:id', (req, res) => {
  const id = parseInt(req.params.id);
  orders = orders.filter(function(o) { return o.id !== id; });
  saveOrders();
  io.emit('order_removed', { id });
  res.json({ success: true });
});

// ── GET /stats — basic daily stats ───────────────────────────────────────
app.get('/stats', (req, res) => {
  const total = orders.reduce(function(sum, o) {
    return sum + o.items.reduce(function(s, i) { return s + (i.price * i.qty); }, 0);
  }, 0);

  res.json({
    totalOrders: orders.length,
    totalRevenue: total,
    activeOrders: orders.filter(function(o) { return o.status !== 'done'; }).length
  });
});

// ── Socket.io connection ──────────────────────────────────────────────────
io.on('connection', function(socket) {
  console.log('Mutfak ekrani baglandi: ' + socket.id);

  // Send current active orders to newly connected screen
  const active = orders.filter(function(o) { return o.status !== 'done'; });
  socket.emit('init_orders', active);

  socket.on('disconnect', function() {
    console.log('Mutfak ekrani ayrildi: ' + socket.id);
  });
});

// ── Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('Hideout Mutfak Sunucusu calisiyor: port ' + PORT);
});const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── FILE-BASED PERSISTENCE ─────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'orders.json');

function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      var data = fs.readFileSync(DATA_FILE, 'utf8');
      var parsed = JSON.parse(data);
      orderCounter = parsed.counter || 1;
      return parsed.orders || [];
    }
  } catch(e) {
    console.log('Could not load orders file:', e.message);
  }
  return [];
}

function saveOrders() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: orders, counter: orderCounter }), 'utf8');
  } catch(e) {
    console.log('Could not save orders file:', e.message);
  }
}

// Load existing orders on startup
var orders = [];
var orderCounter = 1;
orders = loadOrders();
console.log('Loaded ' + orders.length + ' existing orders from disk');

// ── POST /order — receive order from QR menu ──────────────────────────────
app.post('/order', (req, res) => {
  const { items, orderType, table, name, note, timestamp } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Sipariş boş olamaz' });
  }

  const order = {
    id: orderCounter++,
    items,
    orderType: orderType || 'dinein',
    table: table || '',
    name: name || 'Misafir',
    note: note || '',
    timestamp: timestamp || new Date().toLocaleString('tr-TR'),
    receivedAt: Date.now(),
    status: 'new' // new | preparing | ready | done
  };

  orders.push(order);
  saveOrders();

  // Emit to all connected kitchen screens
  io.emit('new_order', order);

  console.log('Yeni siparis #' + order.id + ' - ' + order.name + ' - ' + order.orderType);

  res.json({ success: true, orderId: order.id });
});

// ── GET /orders — get all active orders ───────────────────────────────────
app.get('/orders', (req, res) => {
  // Return all orders that aren't done
  const active = orders.filter(function(o) { return o.status !== 'done'; });
  res.json(active);
});

// ── POST /order/:id/status — update order status ──────────────────────────
app.post('/order/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  const validStatuses = ['new', 'preparing', 'ready', 'done'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Gecersiz durum' });
  }

  const order = orders.find(function(o) { return o.id === id; });
  if (!order) {
    return res.status(404).json({ error: 'Siparis bulunamadi' });
  }

  order.status = status;
  saveOrders();
  io.emit('order_updated', { id: order.id, status: order.status });

  res.json({ success: true });
});

// ── DELETE /order/:id — remove order ─────────────────────────────────────
app.delete('/order/:id', (req, res) => {
  const id = parseInt(req.params.id);
  orders = orders.filter(function(o) { return o.id !== id; });
  saveOrders();
  io.emit('order_removed', { id });
  res.json({ success: true });
});

// ── GET /stats — basic daily stats ───────────────────────────────────────
app.get('/stats', (req, res) => {
  const total = orders.reduce(function(sum, o) {
    return sum + o.items.reduce(function(s, i) { return s + (i.price * i.qty); }, 0);
  }, 0);

  res.json({
    totalOrders: orders.length,
    totalRevenue: total,
    activeOrders: orders.filter(function(o) { return o.status !== 'done'; }).length
  });
});

// ── Socket.io connection ──────────────────────────────────────────────────
io.on('connection', function(socket) {
  console.log('Mutfak ekrani baglandi: ' + socket.id);

  // Send current active orders to newly connected screen
  const active = orders.filter(function(o) { return o.status !== 'done'; });
  socket.emit('init_orders', active);

  socket.on('disconnect', function() {
    console.log('Mutfak ekrani ayrildi: ' + socket.id);
  });
});

// ── Start server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('Hideout Mutfak Sunucusu calisiyor: port ' + PORT);
});
