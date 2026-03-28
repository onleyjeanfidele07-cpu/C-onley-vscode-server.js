param location string = 'eastus'
param appName string = 'onley-vscode'
param environment string = 'prod'
param adminPassword string = 'admin123'
param corsOrigin string = 'https://onley-vscode.azurewebsites.net'param postgresqlAdminUser string = 'postgresadmin'
param postgresqlAdminPassword string = 'SecurePass123!'
var tags = {
  environment: environment
  project: appName
}

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2025-02-01' = {
  name: '${appName}-law'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-ai'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: '${appName}-asp'
  location: location
  kind: 'linux'
  tags: tags
  sku: {
    name: 'B1'
    tier: 'Basic'
    size: 'B1'
    family: 'B'
    capacity: 1
  }
  properties: {
    reserved: true  // for Linux
  }
}

// Web App
resource webApp 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  tags: tags
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      appSettings: [
        {
          name: 'ADMIN_PASSWORD'
          value: adminPassword
        }
        {
          name: 'CORS_ORIGIN'
          value: corsOrigin
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
  }
}

// PostgreSQL Server
resource postgresqlServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: '${appName}-psql'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresqlAdminUser
    administratorLoginPassword: postgresqlAdminPassword
    version: '16'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
  tags: tags
}

// PostgreSQL Database
resource postgresqlDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  name: '${appName}-db'
  parent: postgresqlServer
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Outputs
output webAppUrl string = 'https://${webApp.name}.azurewebsites.net'
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output logAnalyticsWorkspaceId string = logAnalytics.properties.customerId
output postgresqlConnectionString string = 'postgresql://${postgresqlAdminUser}:${postgresqlAdminPassword}@${postgresqlServer.name}.postgres.database.azure.com/${postgresqlDatabase.name}?sslmode=require'