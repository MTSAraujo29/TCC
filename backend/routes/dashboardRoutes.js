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

// Nova rota para dados mensais do KWHMonthly
router.get("/chart/kwh-monthly-data", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const energyTotalManager = require("../services/energyTotalManager");

    const monthlyData = await energyTotalManager.getMonthlyChartData(userId);

    res.json({
      message: "Dados mensais do KWHMonthly obtidos com sucesso",
      data: monthlyData,
    });
  } catch (error) {
    console.error("Erro ao obter dados mensais do KWHMonthly:", error);
    res.status(500).json({
      message: "Erro ao obter dados mensais do KWHMonthly",
      error: error.message,
    });
  }
});

// Nova rota para fatura estimada
router.get("/estimated-bill", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const energyTotalManager = require("../services/energyTotalManager");

    const estimatedBillData = await energyTotalManager.getEstimatedBill(userId);

    res.json({
      message: "Fatura estimada obtida com sucesso",
      data: estimatedBillData,
    });
  } catch (error) {
    console.error("Erro ao obter fatura estimada:", error);
    res.status(500).json({
      message: "Erro ao obter fatura estimada",
      error: error.message,
    });
  }
});

// Nova rota para economia mensal e redução de CO2
router.get("/monthly-savings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const energyTotalManager = require("../services/energyTotalManager");

    const monthlySavingsData = await energyTotalManager.getMonthlySavings(
      userId
    );

    res.json({
      message: "Economia mensal e redução de CO2 obtidas com sucesso",
      data: monthlySavingsData,
    });
  } catch (error) {
    console.error("Erro ao obter economia mensal:", error);
    res.status(500).json({
      message: "Erro ao obter economia mensal",
      error: error.message,
    });
  }
});

module.exports = router;
