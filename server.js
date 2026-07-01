const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(cors({
  origin: ['https://www.caidan365.online', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.static(path.join(__dirname, 'public')));

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      babies: [{ id: 'baby_default', name: '小宝贝', birth_date: '2026-06-01', gender: 'male', height: null, weight: null, head_circumference: null, created_at: new Date().toISOString() }],
      feedingRecords: [],
      familyMembers: [],
      vaccineStatus: [],
      vaccineRecords: [],
      parentMemos: [],
      growthRecords: [],
      foods: [],
      articles: [],
      notifications: [],
      settings: {}
    };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let db = loadDB();

// ========== Dashboard ==========
app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = db.feedingRecords.filter(r => r.time && r.time.startsWith(today)).length;
  const typeStats = {};
  db.feedingRecords.forEach(r => {
    if (!typeStats[r.type]) typeStats[r.type] = { type: r.type, count: 0, total_amount: 0, total_duration: 0 };
    typeStats[r.type].count++;
    typeStats[r.type].total_amount += Number(r.amount) || 0;
    typeStats[r.type].total_duration += Number(r.duration) || 0;
  });
  const recentRecords = [...db.feedingRecords].sort((a, b) => (b.time || '').localeCompare(a.time || '')).slice(0, 10);
  res.json({
    babies: db.babies.length, records: db.feedingRecords.length, memos: db.parentMemos.length,
    growth: db.growthRecords.length, foods: db.foods.length, articles: db.articles.length,
    families: db.familyMembers.length, todayRecords, typeStats: Object.values(typeStats), recentRecords
  });
});

// ========== Babies ==========
app.get('/api/babies', (req, res) => res.json(db.babies));
app.post('/api/babies', (req, res) => {
  const { id, name, birth_date, gender, height, weight, head_circumference } = req.body;
  const baby = { id: id || 'baby_' + Date.now(), name, birth_date, gender: gender || 'male', height, weight, head_circumference, created_at: new Date().toISOString() };
  db.babies.push(baby);
  saveDB(db);
  res.json({ id: baby.id, success: true });
});
app.put('/api/babies/:id', (req, res) => {
  const idx = db.babies.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(db.babies[idx], req.body);
  saveDB(db);
  res.json({ success: true });
});
app.delete('/api/babies/:id', (req, res) => {
  db.babies = db.babies.filter(b => b.id !== req.params.id);
  saveDB(db);
  res.json({ success: true });
});

// ========== Feeding Records ==========
app.get('/api/records', (req, res) => {
  let list = [...db.feedingRecords];
  if (req.query.type) list = list.filter(r => r.type === req.query.type);
  if (req.query.date) list = list.filter(r => r.time && r.time.startsWith(req.query.date));
  if (req.query.baby_id) list = list.filter(r => r.baby_id === req.query.baby_id);
  list.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  if (req.query.limit) list = list.slice(0, Number(req.query.limit));
  res.json(list);
});
app.post('/api/records', (req, res) => {
  const r = req.body;
  r.id = r.id || Date.now();
  db.feedingRecords.push(r);
  saveDB(db);
  res.json({ id: r.id, success: true });
});
app.delete('/api/records/:id', (req, res) => {
  const id = Number(req.params.id);
  db.feedingRecords = db.feedingRecords.filter(r => r.id !== id);
  saveDB(db);
  res.json({ success: true });
});

// ========== Family Members ==========
app.get('/api/family', (req, res) => res.json(db.familyMembers));
app.post('/api/family', (req, res) => {
  const m = { id: Date.now(), ...req.body, join_time: new Date().toISOString() };
  db.familyMembers.push(m);
  saveDB(db);
  res.json({ success: true });
});
app.put('/api/family/:id', (req, res) => {
  const idx = db.familyMembers.findIndex(f => f.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(db.familyMembers[idx], req.body);
  saveDB(db);
  res.json({ success: true });
});
app.delete('/api/family/:id', (req, res) => {
  db.familyMembers = db.familyMembers.filter(f => f.id !== Number(req.params.id));
  saveDB(db);
  res.json({ success: true });
});

// ========== Vaccines ==========
app.get('/api/vaccines', (req, res) => res.json({ status: db.vaccineStatus, records: db.vaccineRecords }));
app.put('/api/vaccines/status/:id', (req, res) => {
  const idx = db.vaccineStatus.findIndex(v => v.id === Number(req.params.id));
  if (idx !== -1) db.vaccineStatus[idx].status = req.body.status;
  saveDB(db);
  res.json({ success: true });
});
app.put('/api/vaccines/record/:id', (req, res) => {
  const idx = db.vaccineRecords.findIndex(v => v.id === Number(req.params.id));
  if (idx !== -1) Object.assign(db.vaccineRecords[idx], req.body);
  saveDB(db);
  res.json({ success: true });
});

// ========== Parent Memos ==========
app.get('/api/memos', (req, res) => {
  let list = [...db.parentMemos];
  if (req.query.type) list = list.filter(m => m.type === req.query.type);
  if (req.query.date) list = list.filter(m => m.date === req.query.date);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0));
  res.json(list);
});
app.post('/api/memos', (req, res) => {
  const m = req.body;
  m.id = m.id || Date.now();
  db.parentMemos.push(m);
  saveDB(db);
  res.json({ success: true });
});
app.put('/api/memos/:id', (req, res) => {
  const idx = db.parentMemos.findIndex(m => m.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(db.parentMemos[idx], req.body);
  saveDB(db);
  res.json({ success: true });
});
app.delete('/api/memos/:id', (req, res) => {
  db.parentMemos = db.parentMemos.filter(m => m.id !== Number(req.params.id));
  saveDB(db);
  res.json({ success: true });
});

// ========== Growth Records ==========
app.get('/api/growth', (req, res) => {
  let list = [...db.growthRecords];
  if (req.query.baby_id) list = list.filter(g => g.baby_id === req.query.baby_id);
  list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  res.json(list);
});
app.post('/api/growth', (req, res) => {
  const g = { id: Date.now(), ...req.body };
  db.growthRecords.push(g);
  saveDB(db);
  res.json({ success: true });
});
app.put('/api/growth/:id', (req, res) => {
  const idx = db.growthRecords.findIndex(g => g.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(db.growthRecords[idx], req.body);
  saveDB(db);
  res.json({ success: true });
});
app.delete('/api/growth/:id', (req, res) => {
  db.growthRecords = db.growthRecords.filter(g => g.id !== Number(req.params.id));
  saveDB(db);
  res.json({ success: true });
});

// ========== Foods ==========
app.get('/api/foods', (req, res) => {
  let list = [...db.foods];
  if (req.query.search) list = list.filter(f => f.name && f.name.includes(req.query.search));
  list.sort((a, b) => (b.id || 0) - (a.id || 0));
  res.json(list);
});
app.post('/api/foods', (req, res) => {
  const f = { id: Date.now(), ...req.body };
  db.foods.push(f);
  saveDB(db);
  res.json({ success: true });
});
app.put('/api/foods/:id', (req, res) => {
  const idx = db.foods.findIndex(f => f.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(db.foods[idx], req.body);
  saveDB(db);
  res.json({ success: true });
});
app.delete('/api/foods/:id', (req, res) => {
  db.foods = db.foods.filter(f => f.id !== Number(req.params.id));
  saveDB(db);
  res.json({ success: true });
});

// ========== Articles ==========
app.get('/api/articles', (req, res) => {
  let list = [...db.articles];
  if (req.query.category) list = list.filter(a => a.category === req.query.category);
  if (req.query.status) list = list.filter(a => a.status === req.query.status);
  if (req.query.search) list = list.filter(a => (a.title && a.title.includes(req.query.search)) || (a.summary && a.summary.includes(req.query.search)));
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  res.json(list);
});
app.get('/api/articles/:id', (req, res) => {
  const article = db.articles.find(a => a.id === Number(req.params.id));
  if (!article) return res.status(404).json({ error: 'Not found' });
  res.json(article);
});
app.post('/api/articles', (req, res) => {
  const a = { id: Date.now(), created_at: new Date().toISOString(), ...req.body };
  db.articles.push(a);
  saveDB(db);
  res.json({ success: true });
});
app.put('/api/articles/:id', (req, res) => {
  const idx = db.articles.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(db.articles[idx], req.body);
  saveDB(db);
  res.json({ success: true });
});
app.delete('/api/articles/:id', (req, res) => {
  db.articles = db.articles.filter(a => a.id !== Number(req.params.id));
  saveDB(db);
  res.json({ success: true });
});

// ========== Notifications ==========
app.get('/api/notifications', (req, res) => {
  let list = [...db.notifications];
  if (req.query.active === 'true') list = list.filter(n => n.status === 'active');
  list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  res.json(list);
});
app.post('/api/notifications', (req, res) => {
  const n = { id: Date.now(), created_at: new Date().toISOString(), status: 'active', ...req.body };
  db.notifications.push(n);
  saveDB(db);
  res.json({ success: true, id: n.id });
});
app.put('/api/notifications/:id', (req, res) => {
  const idx = db.notifications.findIndex(n => n.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  Object.assign(db.notifications[idx], req.body);
  saveDB(db);
  res.json({ success: true });
});
app.delete('/api/notifications/:id', (req, res) => {
  db.notifications = db.notifications.filter(n => n.id !== Number(req.params.id));
  saveDB(db);
  res.json({ success: true });
});

// ========== Settings ==========
app.get('/api/settings', (req, res) => res.json(db.settings || {}));
app.put('/api/settings', (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  saveDB(db);
  res.json({ success: true });
});

// ========== Data Sync ==========
app.get('/api/sync/export', (req, res) => {
  res.json({ ...db, exportedAt: new Date().toISOString() });
});
app.post('/api/sync/import', (req, res) => {
  try {
    const data = req.body;
    const keys = ['babies', 'feedingRecords', 'familyMembers', 'vaccineStatus', 'vaccineRecords', 'parentMemos', 'growthRecords', 'foods', 'articles', 'notifications', 'settings'];
    keys.forEach(k => { if (data[k] !== undefined) db[k] = data[k]; });
    saveDB(db);
    res.json({ success: true, message: '数据导入成功' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`🍼 奶食小账本管理后台已启动: http://localhost:${PORT}`);
});
