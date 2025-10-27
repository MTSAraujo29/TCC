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

// Nova rota para histórico de consumo mensal do modelo KWHMonthly
router.get(
  "/monthly-consumption-history",
  authenticateToken,
  dashboardController.getMonthlyConsumptionHistory
);

// Rota para testar o cálculo mensal (apenas para desenvolvimento)
router.post(
  "/test-monthly-calculation",
  authenticateToken,
  dashboardController.testMonthlyCalculation
);

// Rota para obter detalhes da fatura estimada
router.get(
  "/estimated-bill-details",
  authenticateToken,
  dashboardController.getEstimatedBillDetails
);

// Rota para testar o cálculo da fatura
router.post(
  "/test-bill-calculation",
  authenticateToken,
  dashboardController.testBillCalculation
);

module.exports = router;
