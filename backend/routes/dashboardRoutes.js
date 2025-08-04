/**
 * Rotas do Dashboard
 * 
 * Define as rotas relacionadas ao painel de controle do usuário,
 * incluindo métricas de consumo, gráficos e configurações.
 * 
 * @module DashboardRoutes
 * @requires express
 * @requires ../controllers/dashboard.controller
 * @requires ../middleware/authenticateToken
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticateToken = require('../middleware/authenticateToken');

// === ROTAS PROTEGIDAS DO DASHBOARD ===

/**
 * GET /data - Obtém todos os dados do dashboard
 * 
 * Retorna métricas consolidadas incluindo:
 * - Consumo mensal, diário e total
 * - Dados para gráficos de tendência
 * - Status dos dispositivos conectados
 * - Informações de custo energético
 */
router.get('/data', authenticateToken, dashboardController.getDashboardData);

/**
 * PUT /update-whatsapp - Atualiza número do WhatsApp
 * 
 * Permite ao usuário configurar/atualizar seu número
 * para recebimento de notificações via WhatsApp
 */
router.put('/update-whatsapp', authenticateToken, dashboardController.updateWhatsappNumber);

module.exports = router;