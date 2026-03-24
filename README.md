# Formulaire App - Guide Complet

Application web moderne avec formulaire de contact, validation côté client/serveur, et persistance SQLite.

## 🚀 Quick Start (Local)

### 1. Installation
```bash
npm install
```

### 2. Démarrer le serveur
```bash
npm start
```

Accéder à `http://localhost:3000`

### 3. Vérifier les données
```bash
curl http://localhost:3000/api/submissions
```

---

## 📦 Stack Technique

- **Frontend**: HTML5, CSS3, Vanilla JS (fetch API)
- **Backend**: Node.js + Express.js
- **Database**: SQLite3
- **Security**: CORS, Rate limiting, Validation robuste
- **Logging**: Morgan logs + fichier

---

## 🔒 Sécurité

### Fonctionnalités implémentées
- ✅ Validation stricte (côté serveur + client)
- ✅ CORS configurée (whitelist d'origines)
- ✅ Rate limiting: 100 req/15 min par IP
- ✅ Limitation taille payload: 10KB max
- ✅ Logging complet pour audit
- ✅ Sanitization automatique des entrées

### À ajouter en production
- [ ] Authentification (JWT/OAuth)
- [ ] HTTPS obligatoire
- [ ] CSP (Content Security Policy) headers
- [ ] SQL injection prevention (utiliser prepared statements - ✅ déjà fait)
- [ ] DDOS protection
- [ ] Input sanitization supplémentaire

---

## 📊 Base de Données

**Fichier**: `submissions.db` (SQLite)

**Table `submissions`**:
```sql
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL,
  prenoms TEXT NOT NULL,
  sexe TEXT NOT NULL,
  telephone TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);
```

### Requêtes utiles
```bash
# Voir tous les soumis
curl http://localhost:3000/api/submissions

# Voir les logs
tail -f logs/submissions.log
```

---

## ☁️ Déploiement

### Option 1: Heroku (Plus simple)

1. Créer compte Heroku
2. Installer Heroku CLI
3. Configurer git:
```bash
heroku create your-app-name
git push heroku main
```

4. Variables d'environnement:
```bash
heroku config:set CORS_ORIGIN=https://your-app-name.herokuapp.com
heroku config:set NODE_ENV=production
```

### Option 2: Azure App Service

1. Créer App Service (Node.js 18+)
2. Configurer déploiement depuis Git
3. Variables d'environnement dans Azure Portal:
```
CORS_ORIGIN = https://your-app.azurewebsites.net
NODE_ENV = production
```

4. Déployer:
```bash
git push azure main
```

### Option 3: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build et push:
```bash
docker build -t your-registry/formulaire-app:latest .
docker push your-registry/formulaire-app:latest
```

---

## 📝 API Documentation

### POST /api/submit
Soumettre les données du formulaire.

**Request**:
```json
{
  "nom": "Dupont",
  "prenoms": "Jean",
  "sexe": "M",
  "telephone": "0123456789"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "message": "Formulaire enregistré avec succès.",
  "submissionId": 1
}
```

**Response (Error)**:
```json
{
  "success": false,
  "message": "Téléphone doit contenir exactement 10 chiffres."
}
```

### GET /api/submissions
Récupérer les 100 dernières soumissions (⚠️ Non protégé - À sécuriser!).

### GET /api/health
Vérifier l'état du serveur.

---

## 🚨 Notes de Production

1. **Database**: SQLite est OK pour petit traffic. Pour large scale, utiliser PostgreSQL/MongoDB
2. **Logs**: Envoyer vers service externe (CloudWatch, Datadog, etc.)
3. **Authentication**: Ajouter API key ou JWT token
4. **Validation**: Utiliser `joi` ou `yup` pour schema stricte
5. **Rate limiting**: Augmenter limits ou utiliser Redis
6. **HTTPS**: Forcer redirection HTTP → HTTPS

---

## 📄 Fichiers Principaux

```
.
├── server.js              # Serveur principal
├── public/
│   ├── index.html        # Frontend HTML
│   └── style.css         # Styles
├── submissions.db        # Base de données SQLite
├── logs/
│   └── submissions.log   # Log des soumissions
├── package.json          # Dépendances
├── .env                  # Config locale (git ignored)
├── Procfile              # Config Heroku
├── app.json              # Config déploiement
└── README.md             # Ce fichier
```

---

## 🤝 Support & Contribution

Pour améliorer : fork → modifiez → pull request!

---

## 📜 License

MIT
