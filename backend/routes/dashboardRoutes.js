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

// Rotas para previsão de consumo de energia com IA
router.get(
  "/forecast",
  authenticateToken,
  dashboardController.getConsumptionForecast
);
router.post(
  "/prediction/generate",
  authenticateToken,
  dashboardController.generateConsumptionPrediction
);
router.get(
  "/prediction/latest",
  authenticateToken,
  dashboardController.getLatestPrediction
);

module.exports = router;
