# FactoryWatch Lite

Full stack machine monitoring dashboard.
Frontend: HTML/JS + Chart.js | Backend: Node.js + Express | Database: SQLite

## Run
    npm install
    npm start
Open http://localhost:3000

## API
- GET  /api/machines       latest reading per machine
- GET  /api/readings/:id   last 30 readings
- GET  /api/alerts         recent alerts
- POST /api/readings       {machine_id, temperature, vibration, power}

## Alert limits (rule engine): temp > 85, vibration > 7, power > 12
