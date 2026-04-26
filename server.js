var express = require('express');
var http = require('http');
var Server = require('socket.io').Server;
var cors = require('cors');
var fs = require('fs');
var path = require('path');

var app = express();
var server = http.createServer(app);

var io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── FILE-BASED PERSISTENCE ────────────────────────────────────────────────
var DATA_FILE = path.join(__dirname, 'orders.json');
var orders = [];
var orderCounter = 1;

function loadOrders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      var data = fs.readFileSync(DATA_FILE, 'utf8');
      var parsed = JSON.parse(data);
      orderCounter = parsed.counter || 1;
      return parsed.orders || [];
    }
  } catch(e) {
    console.log('Could not load orders:', e.message);
  }
  return [];
}

function saveOrders() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ orders: orders, counter: orderCounter }), 'utf8');
  } catch(e) {
    console.log('Could not save orders:', e.message);
  }
}

orders = loadOrders();
console.log('Loaded ' + orders.length + ' orders from disk');

// ── POST /order ───────────────────────────────────────────────────────────
app.post('/order', function(req, res) {
  var body = req.body;
  if (!body.items || body.items.length === 0) {
    return res.status(400).json({ error: 'Siparis bos olamaz' });
  }

  var order = {
    id: orderCounter++,
    items: body.items,
    orderType: body.orderType || 'dinein',
    table: body.table || '',
    name: body.name || 'Misafir',
    note: body.note || '',
    timestamp: body.timestamp || new Date().toLocaleString('tr-TR'),
    receivedAt: Date.now(),
    status: 'new'
  };

  orders.push(order);
  saveOrders();
  io.emit('new_order', order);
  console.log('Yeni siparis #' + order.id);
  res.json({ success: true, orderId: order.id });
});

// ── GET /orders ───────────────────────────────────────────────────────────
app.get('/orders', function(req, res) {
  res.json(orders);
});

// ── POST /order/:id/status ────────────────────────────────────────────────
app.post('/order/:id/status', function(req, res) {
  var id = parseInt(req.params.id);
  var status = req.body.status;
  var valid = ['new', 'preparing', 'ready', 'done'];
  if (valid.indexOf(status) === -1) {
    return res.status(400).json({ error: 'Gecersiz durum' });
  }
  var order = null;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === id) { order = orders[i]; break; }
  }
  if (!order) return res.status(404).json({ error: 'Siparis bulunamadi' });
  order.status = status;
  saveOrders();
  io.emit('order_updated', { id: order.id, status: order.status });
  res.json({ success: true });
});

// ── DELETE /order/:id ─────────────────────────────────────────────────────
app.delete('/order/:id', function(req, res) {
  var id = parseInt(req.params.id);
  var next = [];
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id !== id) next.push(orders[i]);
  }
  orders = next;
  saveOrders();
  io.emit('order_removed', { id: id });
  res.json({ success: true });
});

// ── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', function(socket) {
  console.log('Mutfak ekrani baglandi: ' + socket.id);
  socket.emit('init_orders', orders);
  socket.on('disconnect', function() {
    console.log('Mutfak ekrani ayrildi: ' + socket.id);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────
var PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('Hideout Mutfak Sunucusu calisiyor: port ' + PORT);
});
