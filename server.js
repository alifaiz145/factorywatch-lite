const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Database ----------
const db = new Database("factory.db");
db.exec(`
CREATE TABLE IF NOT EXISTS machines (id INTEGER PRIMARY KEY, name TEXT, location TEXT);
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id INTEGER,
  temperature REAL, vibration REAL, power REAL, ts DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, machine_id INTEGER,
  message TEXT, ts DATETIME DEFAULT CURRENT_TIMESTAMP);
`);
if (db.prepare("SELECT COUNT(*) c FROM machines").get().c === 0) {
  const ins = db.prepare("INSERT INTO machines (name, location) VALUES (?, ?)");
  ["CNC Lathe", "Hydraulic Press", "Conveyor Motor"].forEach((n, i) => ins.run(n, "Line " + (i + 1)));
}

// ---------- Rule engine ----------
const LIMITS = { temperature: 85, vibration: 7, power: 12 };
function saveReading({ machine_id, temperature, vibration, power }) {
  db.prepare("INSERT INTO readings (machine_id, temperature, vibration, power) VALUES (?,?,?,?)")
    .run(machine_id, temperature, vibration, power);
  const data = { temperature, vibration, power };
  for (const k in LIMITS) {
    if (data[k] > LIMITS[k]) {
      db.prepare("INSERT INTO alerts (machine_id, message) VALUES (?,?)")
        .run(machine_id, `${k} high: ${data[k].toFixed(1)} (limit ${LIMITS[k]})`);
    }
  }
}

// ---------- REST API ----------
app.get("/api/machines", (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, r.temperature, r.vibration, r.power, r.ts FROM machines m
    LEFT JOIN readings r ON r.id = (SELECT MAX(id) FROM readings WHERE machine_id = m.id)`).all();
  res.json(rows);
});
app.get("/api/readings/:id", (req, res) => {
  const rows = db.prepare("SELECT * FROM readings WHERE machine_id=? ORDER BY id DESC LIMIT 30")
    .all(req.params.id);
  res.json(rows.reverse());
});
app.get("/api/alerts", (req, res) => {
  res.json(db.prepare(`SELECT a.*, m.name FROM alerts a JOIN machines m ON m.id=a.machine_id
    ORDER BY a.id DESC LIMIT 15`).all());
});
// Real IoT devices can POST here (HTTP protocol)
app.post("/api/readings", (req, res) => {
  const { machine_id, temperature, vibration, power } = req.body;
  if ([machine_id, temperature, vibration, power].some(v => typeof v !== "number"))
    return res.status(400).json({ error: "machine_id, temperature, vibration, power must be numbers" });
  saveReading(req.body);
  res.status(201).json({ ok: true });
});

// ---------- Sensor simulator (replace with real devices) ----------
setInterval(() => {
  db.prepare("SELECT id FROM machines").all().forEach(({ id }) => {
    const spike = Math.random() < 0.08;
    saveReading({
      machine_id: id,
      temperature: 60 + Math.random() * 20 + (spike ? 15 : 0),
      vibration: 2 + Math.random() * 4 + (spike ? 3 : 0),
      power: 6 + Math.random() * 5 + (spike ? 3 : 0),
    });
  });
}, 2000);

app.listen(3000, () => console.log("FactoryWatch Lite running at http://localhost:3000"));
