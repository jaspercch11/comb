// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

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

const auditsDb = pool;

// Ensure optional schema for filtering UI-created risks
(async function ensureSchema(){
  try {
    await pool.query(`ALTER TABLE risks ADD COLUMN IF NOT EXISTS created_via TEXT`);
    await pool.query(`ALTER TABLE risks ADD COLUMN IF NOT EXISTS hidden_in_findings BOOLEAN DEFAULT FALSE`);
  } catch (e) {
    console.warn('ensureSchema skipped or failed:', e?.message || e);
  }
})();

// ---- Helpers used in risk routes ----
async function computeRiskProgress(riskId) {
  const { rows } = await auditsDb.query(
    `SELECT 
        COALESCE(SUM(weight), 0) AS total, 
        COALESCE(SUM(CASE WHEN done THEN weight ELSE 0 END), 0) AS done
     FROM risk_tasks WHERE risk_id = $1`,
    [riskId]
  );
  const total = Number(rows[0].total) || 0;
  const done = Number(rows[0].done) || 0;
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function mapProgressToIncidentStatus(progress) {
  // tweak if you want more states; this keeps it simple
  return progress >= 100 ? 'resolved' : 'in progress';
}

function logAudit(message, dept = null, status = 'info') {
  // Keep it safe: just log. (If you want DB audit logs, insert into your audits table here.)
  console.log('[AUDIT]', { message, dept, status, at: new Date().toISOString() });
}

// Server-side seeding used by GET /api/risks/:id when a risk has no tasks yet
function defaultTasks(riskTitle = 'generic') {
  const t = (label, weight) => ({ label, weight, done: false });
  // You can mirror the client seeds; here's a compact generic set:
  return [
    t('Define mitigation plan', 20),
    t('Assign owner(s)', 10),
    t('Identify key milestones', 15),
    t('Execute main mitigation tasks', 35),
    t('Validate outcomes', 10),
    t('Close-out and document', 10)
  ];
}

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

app.put('/audits/:id', async (req, res) => {
  const { id } = req.params;
  const { audit_name, dept_audited, auditor, audit_date, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE audits SET audit_name=$2, dept_audited=$3, auditor=$4, audit_date=$5, status=$6 WHERE audit_id=$1 RETURNING *`,
      [id, audit_name, dept_audited, auditor, audit_date, status]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, audit: result.rows[0] });
  } catch (e) {
    console.error('Update audit error:', e);
    res.status(500).json({ success: false, error: 'Failed to update audit' });
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

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// ===== Extra routes from server1.js =====

app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  try {
    const { owner_dept, approval_status, last_review, document_approved } = req.body;
    const file = req.file;
    const out = await auditsDb.query(
      `INSERT INTO policy_documents (owner_dept, approval_status, last_review, document_approved, file_name, file_data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING document_id`,
      [owner_dept, approval_status, last_review || null, String(document_approved) === 'true', file?.originalname || null, file?.buffer || null]
    );
    logAudit(`Document uploaded: ${file?.originalname || ''}`, owner_dept, approval_status);
    res.json({ success: true, document_id: out.rows[0].document_id });
  } catch (e) {
    console.error('Upload failed', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/dashboard/compliance-status', async (req, res) => {
  try {
    const rows = (await auditsDb.query('SELECT status FROM incidents')).rows;
    const counts = rows.reduce((acc, r) => { const s = String(r.status || '').toLowerCase(); acc[s] = (acc[s]||0)+1; return acc; }, {});
    const compliant = (counts['investigating'] || 0) + (counts['in progress'] || 0);
    const non_compliant = (counts['resolved'] || 0);
    res.json({ compliant, non_compliant });
  } catch (e) {
    console.error('Dashboard status failed', e);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/regulations', async (req, res) => {
  try {
    const rows = (await auditsDb.query('SELECT * FROM regulations ORDER BY regulation_id ASC')).rows;
    res.json(rows);
  } catch (e) {
    console.error('Error fetching regulations', e);
    res.status(500).json({ error: 'Failed to fetch regulations' });
  }
});

app.get('/graph-data', async (req, res) => {
  try {
    const result = await auditsDb.query('SELECT COUNT(*) AS total FROM audits');
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/documents/:id/view', async (req, res) => {
  const { id } = req.params;
  try {
    const row = (await auditsDb.query('SELECT file_name, file_data FROM policy_documents WHERE document_id=$1', [id])).rows[0];
    if (!row || !row.file_data) return res.status(404).end();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(row.file_data);
  } catch (e) {
    console.error('View failed', e);
    res.status(500).end();
  }
});

/* ============================================
   >>> REGULATIONS & DASHBOARD API <<<
   ============================================ */

app.get('/api/risks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const riskResult = await auditsDb.query(
      `SELECT risk_id AS id, risk_title, dept FROM risks WHERE risk_id = $1`,
      [id]
    );

    if (riskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    const risk = riskResult.rows[0];

    let taskResult = await auditsDb.query(
      `SELECT id, label, weight, done FROM risk_tasks WHERE risk_id = $1`,
      [id]
    );

    // Auto-seed tasks for risks inserted directly in DB with no tasks
    if (taskResult.rows.length === 0) {
      const seeds = defaultTasks(risk.risk_title);
      await auditsDb.query('BEGIN');
      try {
        for (const t of seeds) {
          await auditsDb.query(
            'INSERT INTO risk_tasks (risk_id, label, weight, done) VALUES ($1, $2, $3, $4)',
            [id, t.label, t.weight, t.done]
          );
        }
        await auditsDb.query('COMMIT');
      } catch (e) {
        try { await auditsDb.query('ROLLBACK'); } catch (_) {}
        throw e;
      }

      taskResult = await auditsDb.query(
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

// POST create new risk with tasks (auto-seed if tasks missing)

app.get('/api/documents/:id/download', async (req, res) => {
  const { id } = req.params;
  try {
    const row = (await auditsDb.query('SELECT file_name, file_data FROM policy_documents WHERE document_id=$1', [id])).rows[0];
    if (!row || !row.file_data) return res.status(404).end();
    res.setHeader('Content-Disposition', `attachment; filename="${row.file_name || 'file'}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(row.file_data);
  } catch (e) {
    console.error('Download failed', e);
    res.status(500).end();
  }
});

app.get('/api/dashboard/pending', async (req, res) => {
  try {
    const pending = [];
    // risks with progress < 100
    const risks = (await auditsDb.query(`
      SELECT r.risk_id AS id, r.risk_title, r.dept, r.review_date,
        COALESCE(ROUND(CASE WHEN SUM(rt.weight)>0 THEN SUM(CASE WHEN rt.done THEN rt.weight ELSE 0 END)::float / SUM(rt.weight) * 100 ELSE 0 END),0) AS progress
      FROM risks r LEFT JOIN risk_tasks rt ON r.risk_id=rt.risk_id GROUP BY r.risk_id`)).rows;
    risks.filter(r => Number(r.progress) < 100).forEach(r => {
      pending.push({ type: 'risk', title: r.risk_title, dueDate: r.review_date, progress: r.progress });
    });
    // documents not approved/validated
    const docs = (await auditsDb.query('SELECT * FROM policy_documents')).rows;
    docs.filter(d => !d.document_approved || (String(d.approval_status||'').toLowerCase() !== 'approved')).forEach(d => {
      pending.push({ type: 'document', title: d.file_name || d.owner_dept, dueDate: d.last_review || null, status: d.approval_status });
    });
    // incidents not resolved
    const incs = (await auditsDb.query('SELECT * FROM incidents')).rows;
    incs.filter(i => String(i.status||'').toLowerCase() !== 'resolved').forEach(i => {
      pending.push({ type: 'incident', title: i.incident_type, dueDate: i.date_reported, status: i.status });
    });
    // audits not completed
    const auds = (await auditsDb.query('SELECT * FROM audits')).rows;
    auds.filter(a => String(a.status||'').toLowerCase() !== 'completed').forEach(a => {
      pending.push({ type: 'audit', title: a.audit_name, dueDate: a.audit_date, status: a.status });
    });
    res.json(pending.slice(0, 20));
  } catch (e) {
    console.error('Pending failed', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// Notifications feed
app.get('/api/notifications', async (req, res) => {
  function toDate(value) {
    if (!value) return null;
    try {
      const d = value instanceof Date ? value : new Date(value);
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  function cap(s){ s=String(s||''); return s.charAt(0).toUpperCase()+s.slice(1); }
  try {
    const [incRes, audRes, docRes, riskRes] = await Promise.all([
      auditsDb.query('SELECT incident_id, incident_type, status, severity_level, date_reported FROM incidents ORDER BY date_reported DESC LIMIT 20'),
      auditsDb.query('SELECT audit_id, audit_name, status, audit_date FROM audits ORDER BY audit_date DESC LIMIT 20'),
      auditsDb.query('SELECT document_id, file_name, owner_dept, approval_status, last_review FROM policy_documents ORDER BY document_id DESC LIMIT 20'),
      auditsDb.query(`
        SELECT r.risk_id, r.risk_title, r.dept, r.review_date,
          COALESCE(ROUND(CASE WHEN SUM(rt.weight)>0 THEN SUM(CASE WHEN rt.done THEN rt.weight ELSE 0 END)::float / SUM(rt.weight) * 100 ELSE 0 END),0) AS progress
        FROM risks r LEFT JOIN risk_tasks rt ON r.risk_id=rt.risk_id
        GROUP BY r.risk_id
        ORDER BY r.risk_id DESC LIMIT 20`)
    ]);

    const notifications = [];

    incRes.rows.forEach(r => {
      notifications.push({
        id: `incident-${r.incident_id}`,
        type: 'incident',
        title: r.incident_type || 'Incident',
        message: `${cap(r.status)}${r.severity_level ? ' • ' + r.severity_level : ''}`,
        date: r.date_reported,
        severity: r.severity_level || null
      });
    });

    audRes.rows.forEach(r => {
      notifications.push({
        id: `audit-${r.audit_id}`,
        type: 'audit',
        title: r.audit_name || 'Audit',
        message: cap(r.status),
        date: r.audit_date
      });
    });

    docRes.rows.forEach(r => {
      notifications.push({
        id: `doc-${r.document_id}`,
        type: 'document',
        title: r.file_name || r.owner_dept || 'Document',
        message: r.approval_status ? cap(r.approval_status) : 'Pending',
        date: r.last_review
      });
    });

    riskRes.rows.forEach(r => {
      notifications.push({
        id: `risk-${r.risk_id}`,
        type: 'risk',
        title: r.risk_title || 'Risk',
        message: `Progress: ${r.progress}%`,
        date: r.review_date
      });
    });

    notifications.sort((a,b)=>{
      const da = toDate(a.date)?.getTime() || 0;
      const db = toDate(b.date)?.getTime() || 0;
      return db - da;
    });

    res.json(notifications.slice(0, 50));
  } catch (e) {
    console.error('Notifications failed', e);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/risks  -> create a risk and (optionally) tasks
app.post('/api/risks', async (req, res) => {
  try {
    const { risk_title, dept, review_date, tasks } = req.body;

    if (!risk_title) return res.status(400).json({ error: 'risk_title is required' });

    // Insert risk
    let r;
    try {
      r = await auditsDb.query(
        `INSERT INTO risks (risk_title, dept, review_date, created_via)
         VALUES ($1, $2, $3, 'ui') RETURNING risk_id AS id, risk_title, dept, review_date`,
        [risk_title, dept || null, review_date || null]
      );
    } catch (e) {
      // Fallback if created_via column doesn't exist
      r = await auditsDb.query(
        `INSERT INTO risks (risk_title, dept, review_date)
         VALUES ($1, $2, $3) RETURNING risk_id AS id, risk_title, dept, review_date`,
        [risk_title, dept || null, review_date || null]
      );
    }
    const risk = r.rows[0];

    // Insert tasks if provided (or leave empty)
    if (Array.isArray(tasks) && tasks.length) {
      const values = [];
      const params = [];
      tasks.forEach((t, i) => {
        params.push(risk.id, t.label || 'Task', Number(t.weight) || 0, !!t.done);
        values.push(`($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length})`);
      });
      await auditsDb.query(
        `INSERT INTO risk_tasks (risk_id, label, weight, done) VALUES ${values.join(',')}`,
        params
      );
    }

    const progress = await computeRiskProgress(risk.id);
    res.status(201).json({ ...risk, progress });
  } catch (err) {
    console.error('Create risk failed:', err);
    res.status(500).json({ error: 'Failed to create risk' });
  }
});

// DELETE /api/risks/:id -> delete tasks then risk
app.delete('/api/risks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await auditsDb.query('BEGIN');
    // Unlink incidents referencing this risk to avoid FK violation
    await auditsDb.query('UPDATE incidents SET risk_id = NULL WHERE risk_id = $1', [id]);
    // Delete tasks first due to FK
    await auditsDb.query('DELETE FROM risk_tasks WHERE risk_id = $1', [id]);
    // Delete the risk
    const out = await auditsDb.query('DELETE FROM risks WHERE risk_id = $1 RETURNING risk_id', [id]);
    await auditsDb.query('COMMIT');

    if (!out.rowCount) return res.status(404).json({ error: 'Risk not found' });
    res.json({ success: true });
  } catch (e) {
    try { await auditsDb.query('ROLLBACK'); } catch (_) {}
    console.error('Delete risk failed:', e);
    res.status(500).json({ error: 'Failed to delete risk' });
  }
});


/* ============================================
   >>> SERVER START <<<
   ============================================ */

app.get('/api/risks', async (req, res) => {
  try {
    const result = await auditsDb.query(`
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

// Risks for Findings view only (exclude those hidden in findings)
app.get('/api/risks/findings', async (req, res) => {
  try {
    const result = await auditsDb.query(`
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
      WHERE COALESCE(r.hidden_in_findings, FALSE) = FALSE
      GROUP BY r.risk_id
      ORDER BY r.review_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching findings risks:', error);
    res.status(500).json({ error: 'Failed to fetch risks.' });
  }
});

// Hide a risk from Findings (do not delete DB rows)
app.put('/api/risks/:id/hide-in-findings', async (req, res) => {
  const { id } = req.params;
  try {
    await auditsDb.query('UPDATE risks SET hidden_in_findings = TRUE WHERE risk_id = $1', [id]);
    res.json({ success: true });
  } catch (e) {
    console.error('Hide in findings failed', e);
    res.status(500).json({ error: 'Failed to hide risk in findings' });
  }
});

// Only UI-created risks (used by Findings UI to prevent auto-synced entries)
app.get('/api/risks/ui', async (req, res) => {
  try {
    const result = await auditsDb.query(`
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
      WHERE COALESCE(r.created_via, '') = 'ui'
      GROUP BY r.risk_id
      ORDER BY r.review_date ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching UI risks:', error);
    res.status(500).json({ error: 'Failed to fetch risks.' });
  }
});

// GET a single risk with tasks

app.get('/api/documents', async (req, res) => {
  const { owner, status } = req.query;
  try {
    const clauses = [];
    const params = [];
    if (owner) { params.push(`%${owner}%`); clauses.push(`owner_dept ILIKE $${params.length}`); }
    if (status) { params.push(status); clauses.push(`approval_status = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = (await auditsDb.query(`SELECT document_id, owner_dept, approval_status, last_review, document_approved, file_name FROM policy_documents ${where} ORDER BY document_id DESC`, params)).rows;
    res.json(rows);
  } catch (e) {
    console.error('Error fetching documents', e);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.put('/api/incidents/:id', async (req, res) => {
  const { id } = req.params;
  const { incident_type, date_reported, status, severity_level, risk_id } = req.body;
  try {
    const out = await auditsDb.query(
      `UPDATE incidents SET incident_type=$2, date_reported=$3, status=$4, severity_level=$5, risk_id=$6
       WHERE incident_id=$1 RETURNING *`,
      [id, incident_type, date_reported, status, severity_level, risk_id || null]
    );
    logAudit(`Incident updated: ${incident_type || id}`, null, status || 'pending');
    res.json(out.rows[0]);
  } catch (e) {
    console.error('Error updating incident', e);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

app.put('/api/risks/:id/tasks', async (req, res) => {
  const riskId = req.params.id;
  const { tasks } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'Invalid tasks payload' });
  }

  try {
    await auditsDb.query('BEGIN');

    for (const t of tasks) {
      const taskId = t.id;
      const done = !!t.done;
      if (taskId == null) continue;
      await auditsDb.query(
        'UPDATE risk_tasks SET done = $3 WHERE risk_id = $1 AND id = $2',
        [riskId, taskId, done]
      );
    }

    // Recalculate progress to return for convenience
    const progress = await computeRiskProgress(riskId);

    await auditsDb.query('COMMIT');

    // Update related incidents' status if linked
    try {
      const derived = mapProgressToIncidentStatus(progress);
      await auditsDb.query('UPDATE incidents SET status = $2 WHERE risk_id = $1', [riskId, derived]);
      logAudit(`Risk progress updated (ID ${riskId}) -> ${progress}%`, null, derived === 'resolved' ? 'completed' : 'in progress');
    } catch (e) {
      console.error('Failed to sync incidents status', e);
    }

    res.json({ success: true, progress });
  } catch (err) {
    try { await auditsDb.query('ROLLBACK'); } catch (_) {}
    console.error('Error updating tasks:', err);
    res.status(500).json({ error: 'Failed to update tasks' });
  }
});

// DELETE risk and its tasks
