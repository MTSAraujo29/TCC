// backend/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticateToken = require('../middleware/authenticateToken');

// Rota para obter todos os dados do dashboard (métricas, gráficos, etc.)
// Protegida pelo middleware de autenticação
router.get('/data', authenticateToken, dashboardController.getDashboardData);

// Rota para atualizar o número do WhatsApp do usuário
router.put('/update-whatsapp', authenticateToken, dashboardController.updateWhatsappNumber);

module.exports = router;