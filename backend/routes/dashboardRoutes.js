// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticateToken = require('../middleware/authenticateToken');

// Rota para obter todos os dados do dashboard (métricas, gráficos, etc.)
// Protegida pelo middleware de autenticação
router.get('/data', authenticateToken, dashboardController.getDashboardData);

module.exports = router;