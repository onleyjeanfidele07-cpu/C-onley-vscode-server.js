# Guide Déploiement Production

## 🚀 Heroku (Recommandé pour rapidité)

### Prérequis
- Compte Heroku (https://www.heroku.com/)
- Heroku CLI installée
- Git installé
- Code pushe sur GitHub

### Étapes

1. **Login Heroku**
```bash
heroku login
```

2. **Créer une app**
```bash
heroku create your-app-name
```

3. **Configurer les variables**
```bash
heroku config:set NODE_ENV=production
heroku config:set CORS_ORIGIN=https://your-app-name.herokuapp.com
```

4. **Déployer**
```bash
git push heroku main
# ou
git push heroku master
```

5. **Vérifier les logs**
```bash
heroku logs --tail
```

6. **Accéder à l'app**
```bash
heroku open
```

---

## ☁️ Azure App Service

### Prérequis
- Compte Azure
- Azure CLI installé
- Resource Group créé

### Étapes

1. **Créer App Service**
```bash
az appservice plan create --name FormulairePlan --resource-group MyResourceGroup --sku B1 --is-linux
az webapp create --resource-group MyResourceGroup --plan FormulairePlan --name formulaire-app --runtime "NODE|18-lts"
```

2. **Configurer déploiement Git**
```bash
az webapp deployment user set --user-name <username> --password <password>
az webapp deployment source config-local-git --name formulaire-app --resource-group MyResourceGroup
```

3. **Git push déploiement**
```bash
git remote add azure <git-url-from-step-above>
git push azure main
```

4. **Variables d'environnement**
```bash
az webapp config appsettings set --name formulaire-app --resource-group MyResourceGroup --settings NODE_ENV=production CORS_ORIGIN="https://formulaire-app.azurewebsites.net"
```

5. **Vérifier les logs**
```bash
az webapp log stream --name formulaire-app --resource-group MyResourceGroup
```

---

## 🐳 Docker (Flexible)

### 1. Créer Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copier package files
COPY package*.json ./

# Installer dépendances
RUN npm ci --only=production

# Copier le code
COPY . .

# Exposer port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Démarrer
CMD ["npm", "start"]
```

### 2. Build
```bash
docker build -t formulaire-app:latest .
```

### 3. Run local
```bash
docker run -e NODE_ENV=production -e CORS_ORIGIN=http://localhost:3000 -p 3000:3000 formulaire-app:latest
```

### 4. Push vers registry (Azure Container Registry)
```bash
az acr build --registry myregistry --image formulaire-app:latest .
az container create --resource-group MyResourceGroup --name formulaire-app --image myregistry.azurecr.io/formulaire-app:latest --ports 3000 --environment-variables NODE_ENV=production CORS_ORIGIN="https://formulaire-app.location.azurecontainer.io"
```

---

## 🔒 Production Checklist

### Sécurité
- [ ] HTTPS/SSL obligatoire (redirection 80→443)
- [ ] CORS_ORIGIN mis à jour pour domaine réel
- [ ] NODE_ENV = production
- [ ] Rate limiting ajusté (peut augmenter)
- [ ] Valider secrets dans .env (jamais en repo!)
- [ ] CORS whitelist stricte
- [ ] Input validation en place ✓

### Performance
- [ ] Database: Migrer vers PostgreSQL/MongoDB pour production
- [ ] Logs: Envoyer vers CloudWatch/Datadog
- [ ] Monitoring: Alertes sur erreurs
- [ ] Cache: Ajouter Redis si needed
- [ ] CDN: Servir fichiers statiques via CDN

### Maintenance
- [ ] Backups automatiques de la BD
- [ ] Monitoring uptime (Pingdom, UptimeRobot)
- [ ] Alertes sur erreurs 5xx
- [ ] Plan de rollback
- [ ] Documentation API (Swagger/OpenAPI)

---

## 📊 Monitoring & Analytics

### Logs
```bash
# Heroku
heroku logs --tail

# Azure
az webapp log stream --name <app-name> --resource-group <group>

# Local
tail -f logs/submissions.log
```

### Métriques à tracker
- Nombre de soumissions/heure
- Taux d'erreur (4xx/5xx)
- Temps de réponse moyen
- Rate limit hits
- Erreurs validations

---

## 🚨 Troubleshooting

### App ne démarre pas
```bash
# Heroku
heroku logs --tail

# Azure
az webapp log config --name <app> --resource-group <group> --web-server-logging filesystem
```

### Port déjà utilisé
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database locked
Redémarrer l'app ou tuer process Node.

---

## 🔄 CI/CD Recommendations

### GitHub Actions exemple
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: heroku/deploy-github-actions@v3
        with:
          heroku_app_name: ${{ secrets.HEROKU_APP_NAME }}
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
```

### Test avant déploiement
```bash
npm test
npm run lint
npm run security-check
```

---

## 📞 Support

- Docs Heroku: https://devcenter.heroku.com/
- Docs Azure: https://docs.microsoft.com/azure/
- Node.js Best Practices: https://nodejs.org/

