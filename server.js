// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname, { index: false }));

// Serve HTML pages explicitly
app.get(['/','/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/incident.html', (req, res) => res.sendFile(path.join(__dirname, 'incident.html')));
app.get('/documents.html', (req, res) => res.sendFile(path.join(__dirname, 'documents.html')));
app.get('/audit.html', (req, res) => res.sendFile(path.join(__dirname, 'audit.html')));
app.get('/regulatory.html', (req, res) => res.sendFile(path.join(__dirname, 'regulatory.html')));
app.get('/findings.html', (req, res) => res.sendFile(path.join(__dirname, 'findings.html')));

// ===== DB Connection =====
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_J1gloZUcFQS2@ep-still-truth-a1051s4o-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

// ===== Multer Setup =====
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `${unique}-${file.originalname}`);
    }
  })
});

// =================== DOCUMENT ROUTES ===================

// Upload document
app.post('/upload', upload.single('file'), async (req, res) => {
  const { document_name, owner_dept } = req.body;
  const file = req.file;
  try {
    const result = await pool.query(
      `INSERT INTO policy_documents
       (document_name, owner_dept, approval_status, last_review, document_approved, file_data, file_name)
       VALUES ($1, $2, 'Pending', NULL, NULL, $3, $4)
       RETURNING document_id`,
      [document_name, owner_dept, file ? fs.readFileSync(file.path) : null, file ? file.originalname : null]
    );
    res.status(201).json({ document_id: result.rows[0].document_id });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all documents
app.get('/documents', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT document_id, document_name, owner_dept, approval_status, last_review, document_approved
      FROM policy_documents ORDER BY document_name
    `);
    res.json(rows);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get document details
app.get('/document/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT document_id, document_name, owner_dept, approval_status, last_review, document_approved, file_name
      FROM policy_documents WHERE document_id = $1
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Download document
app.get('/download/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT file_data, file_name FROM policy_documents WHERE document_id = $1`,
      [req.params.id]
    );
    if (!rows.length || !rows[0].file_data) return res.status(404).send('File not found');
    res.setHeader('Content-Disposition', `attachment; filename="${rows[0].file_name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(rows[0].file_data);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Server error');
  }
});

// Approve document
app.put('/approve/:id', async (req, res) => {
  try {
    const now = new Date();
    const { rows } = await pool.query(`
      UPDATE policy_documents
      SET last_review = $1, 
          approval_status = 'Approved',
          document_approved = COALESCE(document_approved, $1)
      WHERE document_id = $2
      RETURNING last_review, approval_status, document_approved
    `, [now, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate without approving
app.put('/validate/:id', async (req, res) => {
  try {
    const now = new Date();
    const { rows } = await pool.query(`
      UPDATE policy_documents
      SET last_review = $1
      WHERE document_id = $2
      RETURNING last_review, approval_status, document_approved
    `, [now, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Validate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =================== LOGIN ROUTE ===================
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1 AND password = $2",
      [username, password]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, message: "✅ Login successful!" });
    } else {
      res.json({ success: false, message: "❌ Invalid username or password." });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "⚠️ Server error." });
  }
});

// =================== AUDIT ROUTES ===================
app.get("/audits", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM audits ORDER BY audit_date DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Fetch audits error:", error);
    res.status(500).json({ error: "Failed to fetch audits." });
  }
});

app.get("/audit-status-summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT TRIM(LOWER(status)) AS normalized_status, COUNT(*) as count
      FROM audits
      GROUP BY normalized_status
    `);

    const data = result.rows.map((row) => {
      let label;
      switch (row.normalized_status) {
        case "completed": label = "Completed"; break;
        case "scheduled": label = "Scheduled"; break;
        case "in progress": label = "In Progress"; break;
        case "pending": label = "Pending"; break;
        default:
          label = row.normalized_status.charAt(0).toUpperCase() + row.normalized_status.slice(1);
      }
      return { status: label, count: row.count };
    });

    res.json(data);
  } catch (error) {
    console.error("Fetch audit summary error:", error);
    res.status(500).json({ error: "Failed to fetch audit summary." });
  }
});

app.post("/audits", async (req, res) => {
  const { audit_id, audit_name, dept_audited, auditor, audit_date, status } = req.body;
  try {
    const insertQuery = `
      INSERT INTO audits (audit_id, audit_name, dept_audited, auditor, audit_date, status)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;
    `;
    const result = await pool.query(insertQuery, [
      audit_id, audit_name, dept_audited, auditor, audit_date, status,
    ]);
    res.json({ success: true, audit: result.rows[0] });
  } catch (error) {
    console.error("Insert audit error:", error);
    res.status(500).json({ success: false, message: "Failed to add audit." });
  }
});

// =================== INCIDENT ROUTES ===================
app.get("/api/incidents", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM incidents ORDER BY incident_id ASC");
    const toDateStr = (value) => {
      if (!value) return null;
      try {
        const d = value instanceof Date ? value : new Date(value);
        return isNaN(d.getTime()) ? String(value) : d.toISOString().split("T")[0];
      } catch {
        return String(value);
      }
    };
    const formattedRows = result.rows.map((row) => ({
      ...row,
      date_reported: toDateStr(row.date_reported),
    }));
    res.json(formattedRows);
  } catch (error) {
    console.error("Fetch incidents error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

app.post("/submit-incident", upload.single("evidence"), async (req, res) => {
  const { incidentType, severity, date, department, description } = req.body;
  const evidenceFile = req.file ? req.file.filename : null;
  try {
    await pool.query(
      `INSERT INTO incidents 
      (incident_type, severity_level, date_reported, department, description, evidence, status) 
      VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
      [incidentType, severity, date, department, description, evidenceFile]
    );
    res.redirect("/incident.html");
  } catch (error) {
    console.error("Insert incident error:", error);
    res.status(500).send("Database insert failed");
  }
});

// Update incident status
app.put('/api/incidents/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Missing status' });
  try {
    const result = await pool.query(
      `UPDATE incidents SET status = $1 WHERE incident_id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Incident not found' });
    res.json({ success: true, incident: result.rows[0] });
  } catch (error) {
    console.error('Update incident status error:', error);
    res.status(500).json({ error: 'Database update failed' });
  }
});

// Download incident evidence
app.get('/api/incidents/:id/evidence', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT evidence FROM incidents WHERE incident_id = $1', [req.params.id]);
    if (!rows.length || !rows[0].evidence) return res.status(404).send('Evidence not found');
    const evidenceFile = rows[0].evidence;
    const filePath = path.join(uploadDir, evidenceFile);
    if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
    res.download(filePath, evidenceFile);
  } catch (err) {
    console.error('Evidence download error:', err);
    res.status(500).send('Server error');
  }
});

// ===== RISKS & REGULATIONS & DASHBOARD (merged from server1.js) =====

async function ensureSchema() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS risks (
        risk_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        risk_title VARCHAR(255) NOT NULL,
        dept VARCHAR(255),
        review_date DATE NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS risk_tasks (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        risk_id INTEGER NOT NULL REFERENCES risks(risk_id) ON DELETE CASCADE,
        label VARCHAR(255) NOT NULL,
        weight INTEGER NOT NULL DEFAULT 0,
        done BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audits (
        audit_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        audit_name TEXT,
        dept_audited TEXT,
        auditor TEXT,
        audit_date TIMESTAMP,
        status TEXT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        incident_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        incident_type VARCHAR(255) NOT NULL,
        date_reported DATE NOT NULL,
        status VARCHAR(50) NOT NULL,
        severity_level VARCHAR(50) NOT NULL,
        department TEXT,
        description TEXT,
        evidence TEXT,
        risk_id INTEGER REFERENCES risks(risk_id) ON DELETE SET NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS policy_documents (
        document_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        document_name TEXT,
        owner_dept VARCHAR(255) NOT NULL,
        approval_status VARCHAR(50) NOT NULL,
        last_review DATE,
        document_approved TIMESTAMP,
        file_name TEXT,
        file_data BYTEA
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS regulations (
        id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        regulation_name TEXT NOT NULL,
        department TEXT NOT NULL,
        status TEXT NOT NULL,
        last_review DATE,
        next_review DATE,
        summary TEXT
      );
    `);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS department TEXT`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS description TEXT`);
    await pool.query(`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS evidence TEXT`);
    await pool.query(`ALTER TABLE policy_documents ADD COLUMN IF NOT EXISTS document_name TEXT`);
  } catch (e) {
    console.error('Schema ensure failed', e);
  }
}

function defaultTasks(riskName) {
  const name = String(riskName || '').toLowerCase();
  if (/gdpr violation/i.test(name)) {
    return [
      { label: 'Assess data exposure', weight: 20, done: false },
      { label: 'Notify DPO and legal', weight: 15, done: false },
      { label: 'Report to authorities', weight: 15, done: false },
      { label: 'Notify affected individuals', weight: 15, done: false },
      { label: 'Remediate breach', weight: 20, done: false },
      { label: 'Review policies & train staff', weight: 15, done: false },
    ];
  }
  if (/data breach/i.test(name)) {
    return [
      { label: 'Isolate affected systems', weight: 20, done: false },
      { label: 'Investigate breach source', weight: 20, done: false },
      { label: 'Notify IT/security team', weight: 15, done: false },
      { label: 'Patch vulnerabilities', weight: 15, done: false },
      { label: 'Communicate with stakeholders', weight: 15, done: false },
      { label: 'Document and report', weight: 15, done: false },
    ];
  }
  if (/product contamination/i.test(name)) {
    return [
      { label: 'Quarantine affected products', weight: 20, done: false },
      { label: 'Notify quality assurance', weight: 15, done: false },
      { label: 'Conduct root cause analysis', weight: 20, done: false },
      { label: 'Recall products if needed', weight: 20, done: false },
      { label: 'Remediate contamination', weight: 15, done: false },
      { label: 'Review and update SOPs', weight: 10, done: false },
    ];
  }
  if (/labeling error|mislabeling/i.test(name)) {
    return [
      { label: 'Identify mislabeled products', weight: 20, done: false },
      { label: 'Notify regulatory team', weight: 15, done: false },
      { label: 'Correct labeling', weight: 20, done: false },
      { label: 'Recall if distributed', weight: 20, done: false },
      { label: 'Communicate with customers', weight: 15, done: false },
      { label: 'Review labeling process', weight: 10, done: false },
    ];
  }
  if (/safety hazard - workplace/i.test(name)) {
    return [
      { label: 'Isolate hazard area', weight: 20, done: false },
      { label: 'Notify safety officer', weight: 15, done: false },
      { label: 'Investigate root cause', weight: 20, done: false },
      { label: 'Remediate hazard', weight: 20, done: false },
      { label: 'Conduct safety training', weight: 15, done: false },
      { label: 'Update safety protocols', weight: 10, done: false },
    ];
  }
  if (/adverse customer reaction/i.test(name)) {
    return [
      { label: 'Document incident', weight: 20, done: false },
      { label: 'Notify customer service', weight: 15, done: false },
      { label: 'Investigate cause', weight: 20, done: false },
      { label: 'Provide remedy to customer', weight: 20, done: false },
      { label: 'Review product/process', weight: 15, done: false },
      { label: 'Report to management', weight: 10, done: false },
    ];
  }
  if (/fraud|misconduct/i.test(name)) {
    return [
      { label: 'Suspend involved parties', weight: 20, done: false },
      { label: 'Notify compliance/legal', weight: 15, done: false },
      { label: 'Conduct investigation', weight: 20, done: false },
      { label: 'Document findings', weight: 15, done: false },
      { label: 'Implement corrective actions', weight: 20, done: false },
      { label: 'Review controls', weight: 10, done: false },
    ];
  }
  if (/policy violation/i.test(name)) {
    return [
      { label: 'Document violation', weight: 20, done: false },
      { label: 'Notify HR/compliance', weight: 15, done: false },
      { label: 'Investigate incident', weight: 20, done: false },
      { label: 'Counsel involved parties', weight: 20, done: false },
      { label: 'Implement corrective actions', weight: 15, done: false },
      { label: 'Review and update policy', weight: 10, done: false },
    ];
  }
  if (/system failure|downtime/i.test(name)) {
    return [
      { label: 'Notify IT support', weight: 20, done: false },
      { label: 'Diagnose failure', weight: 20, done: false },
      { label: 'Restore system', weight: 20, done: false },
      { label: 'Communicate outage', weight: 15, done: false },
      { label: 'Review incident', weight: 15, done: false },
      { label: 'Update recovery plan', weight: 10, done: false },
    ];
  }
  if (/inventory loss|theft/i.test(name)) {
    return [
      { label: 'Secure area', weight: 20, done: false },
      { label: 'Notify security', weight: 15, done: false },
      { label: 'Investigate loss', weight: 20, done: false },
      { label: 'Document incident', weight: 15, done: false },
      { label: 'Report to authorities', weight: 20, done: false },
      { label: 'Review inventory controls', weight: 10, done: false },
    ];
  }
  if (/supplier non-compliance/i.test(name)) {
    return [
      { label: 'Notify procurement', weight: 20, done: false },
      { label: 'Assess impact', weight: 20, done: false },
      { label: 'Engage supplier', weight: 20, done: false },
      { label: 'Document non-compliance', weight: 15, done: false },
      { label: 'Implement contingency', weight: 15, done: false },
      { label: 'Review supplier agreements', weight: 10, done: false },
    ];
  }
  if (/budget|overrun/i.test(name)) {
    return [
      { label: 'Baseline current spend', weight: 15, done: false },
      { label: 'Negotiate vendor discounts', weight: 20, done: false },
      { label: 'Freeze nonessential purchases', weight: 15, done: false },
      { label: 'Weekly cost variance review', weight: 15, done: false },
      { label: 'Automate spend alerts', weight: 15, done: false },
      { label: 'Reforecast budget with stakeholders', weight: 20, done: false },
    ];
  }
  if (/breach/i.test(name)) {
    return [
      { label: 'Enable MFA for all privileged accounts', weight: 20, done: false },
      { label: 'Patch critical systems', weight: 20, done: false },
      { label: 'Encrypt sensitive data at rest', weight: 15, done: false },
      { label: 'Implement IDS/IPS monitoring', weight: 15, done: false },
      { label: 'Employee security awareness training', weight: 10, done: false },
      { label: 'Backup and disaster recovery test', weight: 20, done: false },
    ];
  }
  return [
    { label: 'Define mitigation plan', weight: 20, done: false },
    { label: 'Assign owner(s)', weight: 10, done: false },
    { label: 'Identify key milestones', weight: 15, done: false },
    { label: 'Execute main mitigation tasks', weight: 35, done: false },
    { label: 'Validate outcomes', weight: 10, done: false },
    { label: 'Close-out and document', weight: 10, done: false },
  ];
}

async function computeRiskProgress(riskId) {
  const prog = await pool.query(
    `SELECT COALESCE(ROUND(CASE WHEN SUM(weight) > 0
              THEN SUM(CASE WHEN done THEN weight ELSE 0 END)::float / SUM(weight) * 100
              ELSE 0 END), 0) AS progress
     FROM risk_tasks WHERE risk_id = $1`,
    [riskId]
  );
  return Number(prog.rows[0]?.progress || 0);
}

function mapProgressToIncidentStatus(progress) {
  const p = Number(progress) || 0;
  if (p === 100) return 'resolved';
  if (p < 35) return 'investigating';
  if (p > 35 && p < 99) return 'in progress';
  return 'in progress';
}

async function logAudit(auditName, dept, status) {
  try {
    await pool.query(
      `INSERT INTO audits (audit_name, dept_audited, auditor, audit_date, status)
       VALUES ($1, $2, $3, NOW(), $4)`,
      [auditName, dept || 'N/A', 'system', status || 'pending']
    );
  } catch (e) {
    console.error('Audit log failed', e);
  }
}

app.get('/api/risks', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.risk_id AS id,
        r.risk_title,
        r.dept,
        r.review_date,
        COALESCE(
          ROUND(
            CASE WHEN SUM(rt.weight) > 0
              THEN SUM(CASE WHEN rt.done THEN rt.weight ELSE 0 END)::float / SUM(rt.weight) * 100
              ELSE 0 END
          ), 0
        ) AS progress,
        'on track' AS status
      FROM risks r
      LEFT JOIN risk_tasks rt ON r.risk_id = rt.risk_id
      GROUP BY r.risk_id
      ORDER BY r.review_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching risks:', error);
    res.status(500).json({ error: 'Failed to fetch risks.' });
  }
});

app.get('/api/risks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const riskResult = await pool.query(
      `SELECT risk_id AS id, risk_title, dept FROM risks WHERE risk_id = $1`,
      [id]
    );
    if (riskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    const risk = riskResult.rows[0];
    let taskResult = await pool.query(
      `SELECT id, label, weight, done FROM risk_tasks WHERE risk_id = $1`,
      [id]
    );
    if (taskResult.rows.length === 0) {
      const seeds = defaultTasks(risk.risk_title);
      await pool.query('BEGIN');
      try {
        for (const t of seeds) {
          await pool.query(
            'INSERT INTO risk_tasks (risk_id, label, weight, done) VALUES ($1, $2, $3, $4)',
            [id, t.label, t.weight, t.done]
          );
        }
        await pool.query('COMMIT');
      } catch (e) {
        try { await pool.query('ROLLBACK'); } catch (_) {}
        throw e;
      }
      taskResult = await pool.query(
        `SELECT id, label, weight, done FROM risk_tasks WHERE risk_id = $1`,
        [id]
      );
    }
    const tasks = taskResult.rows;
    const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
    const completedWeight = tasks.reduce((sum, t) => t.done ? sum + t.weight : sum, 0);
    const progress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    res.json({ ...risk, tasks, progress });
  } catch (error) {
    console.error('Error fetching risk by ID:', error);
    res.status(500).json({ error: 'Failed to fetch risk.' });
  }
});

app.post('/api/risks', async (req, res) => {
  const { risk_title, dept, review_date } = req.body;
  let { tasks } = req.body;
  try {
    await pool.query('BEGIN');
    const insertRiskQuery = `
      INSERT INTO risks (risk_title, dept, review_date)
      VALUES ($1, $2, $3)
      RETURNING risk_id AS id
    `;
    const riskResult = await pool.query(insertRiskQuery, [risk_title, dept, review_date]);
    const riskId = riskResult.rows[0].id;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      tasks = defaultTasks(risk_title);
    }
    const insertTaskQuery = `
      INSERT INTO risk_tasks (risk_id, label, weight, done)
      VALUES ($1, $2, $3, $4)
    `;
    for (const task of tasks) {
      const label = String(task.label || 'Task').slice(0, 200);
      const weight = Number.isFinite(task.weight) ? Math.max(0, Math.min(100, Number(task.weight))) : 0;
      const done = !!task.done;
      await pool.query(insertTaskQuery, [riskId, label, weight, done]);
    }
    await pool.query('COMMIT');
    logAudit(`Risk created: ${risk_title}`, dept, 'pending');
    res.json({ success: true, id: riskId });
  } catch (error) {
    try { await pool.query('ROLLBACK'); } catch (_) {}
    console.error('Error creating risk:', error);
    res.status(500).json({ error: 'Failed to create risk.' });
  }
});

app.put('/api/risks/:id/tasks', async (req, res) => {
  const riskId = req.params.id;
  const { tasks } = req.body;
  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'Invalid tasks payload' });
  }
  try {
    await pool.query('BEGIN');
    for (const t of tasks) {
      const taskId = t.id;
      const done = !!t.done;
      if (taskId == null) continue;
      await pool.query(
        'UPDATE risk_tasks SET done = $3 WHERE risk_id = $1 AND id = $2',
        [riskId, taskId, done]
      );
    }
    const progress = await computeRiskProgress(riskId);
    await pool.query('COMMIT');
    try {
      const derived = mapProgressToIncidentStatus(progress);
      await pool.query('UPDATE incidents SET status = $2 WHERE risk_id = $1', [riskId, derived]);
      logAudit(`Risk progress updated (ID ${riskId}) -> ${progress}%`, null, derived === 'resolved' ? 'completed' : 'in progress');
    } catch (e) {
      console.error('Failed to sync incidents status', e);
    }
    res.json({ success: true, progress });
  } catch (err) {
    try { await pool.query('ROLLBACK'); } catch (_) {}
    console.error('Error updating tasks:', err);
    res.status(500).json({ error: 'Failed to update tasks' });
  }
});

app.delete('/api/risks/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query('DELETE FROM risk_tasks WHERE risk_id = $1', [id]);
    await pool.query('DELETE FROM risks WHERE risk_id = $1', [id]);
    logAudit(`Risk deleted (ID ${id})`, null, 'completed');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete risk' });
  }
});

app.get('/api/regulations', async (req, res) => {
  try {
    const rows = (await pool.query('SELECT id, regulation_name AS name, department, status, last_review, next_review, summary FROM regulations ORDER BY id ASC')).rows;
    res.json(rows);
  } catch (e) {
    console.error('Error fetching regulations', e);
    res.status(500).json({ error: 'Failed to fetch regulations' });
  }
});

app.get('/api/dashboard/compliance-status', async (req, res) => {
  try {
    const rows = (await pool.query('SELECT status FROM incidents')).rows;
    const counts = rows.reduce((acc, r) => { const s = String(r.status || '').toLowerCase(); acc[s] = (acc[s]||0)+1; return acc; }, {});
    const compliant = (counts['investigating'] || 0) + (counts['in progress'] || 0);
    const non_compliant = (counts['resolved'] || 0);
    res.json({ compliant, non_compliant });
  } catch (e) {
    console.error('Dashboard status failed', e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/dashboard/pending', async (req, res) => {
  try {
    const pending = [];
    const risks = (await pool.query(`
      SELECT r.risk_id AS id, r.risk_title, r.dept, r.review_date,
        COALESCE(ROUND(CASE WHEN SUM(rt.weight)>0 THEN SUM(CASE WHEN rt.done THEN rt.weight ELSE 0 END)::float / SUM(rt.weight) * 100 ELSE 0 END),0) AS progress
      FROM risks r LEFT JOIN risk_tasks rt ON r.risk_id=rt.risk_id GROUP BY r.risk_id`)).rows;
    risks.filter(r => Number(r.progress) < 100).forEach(r => {
      pending.push({ type: 'risk', title: r.risk_title, dueDate: r.review_date, progress: r.progress });
    });
    const docs = (await pool.query('SELECT * FROM policy_documents')).rows;
    docs.filter(d => !d.document_approved || (String(d.approval_status||'').toLowerCase() !== 'approved')).forEach(d => {
      pending.push({ type: 'document', title: d.file_name || d.owner_dept, dueDate: d.last_review || null, status: d.approval_status });
    });
    const incs = (await pool.query('SELECT * FROM incidents')).rows;
    incs.filter(i => String(i.status||'').toLowerCase() !== 'resolved').forEach(i => {
      pending.push({ type: 'incident', title: i.incident_type, dueDate: i.date_reported, status: i.status });
    });
    const auds = (await pool.query('SELECT * FROM audits')).rows;
    auds.filter(a => String(a.status||'').toLowerCase() !== 'completed').forEach(a => {
      pending.push({ type: 'audit', title: a.audit_name, dueDate: a.audit_date, status: a.status });
    });
    res.json(pending.slice(0, 20));
  } catch (e) {
    console.error('Pending failed', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// ===== START SERVER =====
ensureSchema().catch((e) => console.error('Schema ensure failed', e));
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

