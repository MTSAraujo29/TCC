// backend/routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");
const authenticateToken = require("../middleware/authenticateToken");

// Rota para obter todos os dados do dashboard (métricas, gráficos, etc.)
// Protegida pelo middleware de autenticação
router.get("/data", authenticateToken, dashboardController.getDashboardData);

// Novas rotas para gráficos reais baseados em EnergyYesterday
router.get(
  "/chart/daily-energy-yesterday",
  authenticateToken,
  dashboardController.getDailyEnergyYesterday
);
router.get(
  "/chart/weekly-energy-yesterday",
  authenticateToken,
  dashboardController.getWeeklyEnergyYesterday
);
router.get(
  "/chart/monthly-energy-data",
  authenticateToken,
  dashboardController.getMonthlyEnergyData
);

// Rota para atualizar o número do WhatsApp do usuário
router.put(
  "/update-whatsapp",
  authenticateToken,
  dashboardController.updateWhatsappNumber
);

module.exports = router;
