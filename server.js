const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const app = express();
const port = process.env.PORT || 3000;

// ===== CONFIGURATION =====
const DB_PATH = path.join(__dirname, 'submissions.db');
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'submissions.log');

// Créer le dossier logs s'il n'existe pas
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ===== MIDDLEWARE =====
// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

// Body parser
app.use(bodyParser.json({ limit: '10kb' }));

// Morgan logging (combiné: console + fichier)
const fileStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
app.use(morgan('combined', { stream: fileStream }));
app.use(morgan('dev')); // aussi en console

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limiter à 100 requêtes par fenêtre par IP
  message: 'Trop de requêtes, veuillez réessayer plus tard.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Auth middleware for admin routes
function authMiddleware(req, res, next) {
  const password = req.headers['x-password'] || req.query.password;
  if (!password || password !== process.env.ADMIN_PASSWORD || 'SecureAdmin2024!') {
    return res.status(401).json({ success: false, message: 'Accès non autorisé. Mot de passe requis.' });
  }
  next();
}

app.use(express.static('public'));

// ===== DATABASE SETUP =====
let db;
if (process.env.DATABASE_URL) {
  // PostgreSQL
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  console.log('✓ Connecté à PostgreSQL');
} else {
  // SQLite (local)
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Erreur connexion DB:', err.message);
      process.exit(1);
    }
    console.log('✓ Connecté à la base SQLite');
  });
}

function initializeDatabase() {
  if (process.env.DATABASE_URL) {
    // PostgreSQL
    db.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        nom TEXT NOT NULL,
        prenoms TEXT NOT NULL,
        sexe TEXT NOT NULL,
        telephone TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Erreur création table:', err.message);
      } else {
        console.log('✓ Table submissions prête (PostgreSQL)');
      }
    });
  } else {
    // SQLite
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS submissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nom TEXT NOT NULL,
          prenoms TEXT NOT NULL,
          sexe TEXT NOT NULL,
          telephone TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          ip_address TEXT,
          user_agent TEXT
        )
      `, (err) => {
        if (err) {
          console.error('Erreur création table:', err.message);
        } else {
          console.log('✓ Table submissions prête (SQLite)');
        }
      });
    });
  }
}

initializeDatabase();

// Helper function for database queries
function dbQuery(sql, params = [], callback) {
  if (process.env.DATABASE_URL) {
    // PostgreSQL
    db.query(sql, params, callback);
  } else {
    // SQLite
    db.run(sql, params, callback);
  }
}

function dbAll(sql, params = [], callback) {
  if (process.env.DATABASE_URL) {
    // PostgreSQL
    db.query(sql, params, callback);
  } else {
    // SQLite
    db.all(sql, params, callback);
  }
}

// ===== VALIDATION ROBUSTE =====
function validateData(payload) {
  const { nom, prenoms, sexe, telephone } = payload;
  
  // Vérification champs requis
  if (!nom || typeof nom !== 'string' || nom.trim().length === 0) {
    return 'Nom est obligatoire et doit être du texte.';
  }
  if (!prenoms || typeof prenoms !== 'string' || prenoms.trim().length === 0) {
    return 'Prénoms sont obligatoires et doivent être du texte.';
  }
  if (!['M', 'F'].includes(sexe)) {
    return 'Sexe doit être M ou F.';
  }
  if (!telephone || typeof telephone !== 'string') {
    return 'Téléphone est obligatoire.';
  }
  
  // Validation format strict
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(telephone)) {
    return 'Téléphone doit contenir exactement 10 chiffres.';
  }
  
  // Validation noms : seulement lettres, espaces, tirets
  const nameRegex = /^[a-zA-ZÀ-ÿ\s\-]+$/;
  if (!nameRegex.test(nom.trim())) {
    return 'Nom ne doit contenir que des lettres, espaces ou tirets.';
  }
  if (!nameRegex.test(prenoms.trim())) {
    return 'Prénoms ne doivent contenir que des lettres, espaces ou tirets.';
  }
  
  // Longueur limitation
  if (nom.length > 100 || prenoms.length > 100) {
    return 'Nom et prénoms ne doivent pas dépasser 100 caractères.';
  }
  
  return null;
}

// ===== ROUTES =====
app.post('/api/submit', (req, res) => {
  const validationError = validateData(req.body);
  if (validationError) {
    console.error(`[VALIDATION ERROR] ${req.ip}: ${validationError}`);
    return res.status(400).json({ success: false, message: validationError });
  }

  const { nom, prenoms, sexe, telephone } = req.body;
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');

  // Insérer en base de données
  if (process.env.DATABASE_URL) {
    // PostgreSQL
    db.query(
      `INSERT INTO submissions (nom, prenoms, sexe, telephone, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [nom, prenoms, sexe, telephone, ipAddress, userAgent],
      (err, result) => {
        if (err) {
          console.error('[DB ERROR]', err.message);
          return res.status(500).json({ success: false, message: 'Erreur serveur.' });
        }

        const submissionId = result.rows[0].id;

        // Log succès
        const logEntry = `[SUBMISSION] ID:${submissionId} | ${nom} ${prenoms} | ${telephone} | IP:${ipAddress}`;
        console.log(logEntry);
        fs.appendFileSync(LOG_FILE, logEntry + '\n');

        return res.json({ 
          success: true, 
          message: 'Formulaire enregistré avec succès.',
          submissionId: submissionId 
        });
      }
    );
  } else {
    // SQLite
    db.run(
      `INSERT INTO submissions (nom, prenoms, sexe, telephone, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nom, prenoms, sexe, telephone, ipAddress, userAgent],
      function(err) {
        if (err) {
          console.error('[DB ERROR]', err.message);
          return res.status(500).json({ success: false, message: 'Erreur serveur.' });
        }

        // Log succès
        const logEntry = `[SUBMISSION] ID:${this.lastID} | ${nom} ${prenoms} | ${telephone} | IP:${ipAddress}`;
        console.log(logEntry);
        fs.appendFileSync(LOG_FILE, logEntry + '\n');

        return res.json({ 
          success: true, 
          message: 'Formulaire enregistré avec succès.',
          submissionId: this.lastID 
        });
      }
    );
  }
});

// Route admin pour voir les submissions (protégée par mot de passe)
app.get('/api/submissions', authMiddleware, limiter, (req, res) => {
  dbAll('SELECT * FROM submissions ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erreur consultation données.' });
    }
    res.json({ success: true, count: rows.length, data: rows });
  });
});

// Route pour exporter les données en CSV (protégée)
app.get('/api/export/csv', authMiddleware, limiter, (req, res) => {
  dbAll('SELECT id, nom, prenoms, sexe, telephone, created_at FROM submissions ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Erreur export données.' });
    }

    const csvWriter = createCsvWriter({
      path: path.join(__dirname, 'export.csv'),
      header: [
        { id: 'id', title: 'ID' },
        { id: 'nom', title: 'Nom' },
        { id: 'prenoms', title: 'Prénoms' },
        { id: 'sexe', title: 'Sexe' },
        { id: 'telephone', title: 'Téléphone' },
        { id: 'created_at', title: 'Date de création' },
      ],
    });

    csvWriter.writeRecords(rows).then(() => {
      res.download(path.join(__dirname, 'export.csv'), 'submissions.csv', (err) => {
        if (err) {
          console.error('Erreur téléchargement CSV:', err);
        }
        // Supprimer le fichier après téléchargement
        fs.unlinkSync(path.join(__dirname, 'export.csv'));
      });
    }).catch((error) => {
      console.error('Erreur écriture CSV:', error);
      res.status(500).json({ success: false, message: 'Erreur génération CSV.' });
    });
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('[ERREUR]', err);
  res.status(err.status || 500).json({ 
    success: false, 
    message: process.env.NODE_ENV === 'production' 
      ? 'Erreur serveur interne.' 
      : err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée.' });
});

// ===== SERVER STARTUP =====
app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${port}`);
  console.log(`📝 Logs: ${LOG_FILE}`);
  console.log(`💾 Base de données: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, fermeture...');
  db.close();
  process.exit(0);
});