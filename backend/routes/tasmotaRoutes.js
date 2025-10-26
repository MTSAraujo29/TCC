// backend/routes/tasmotaRoutes.js
const express = require("express");
const router = express.Router();
const tasmotaController = require("../controllers/tasmota.controller");
const authenticateToken = require("../middleware/authenticateToken");
const tasmotaService = require("../services/tasmota.service");

// Rotas para Gerenciamento de Dispositivos (CRUD)
router.post("/devices", authenticateToken, tasmotaController.addDevice); // LINHA 8
router.get("/devices", authenticateToken, tasmotaController.getUserDevices);

// Aplicar o middleware getDevice para rotas que operam em um dispositivo específico
// A ordem é importante: authenticateToken -> getDevice -> função do controlador
router.get(
  "/devices/:deviceId",
  authenticateToken,
  tasmotaController.getDevice,
  tasmotaController.getDeviceDetails
);
// router.put('/devices/:deviceId', authenticateToken, tasmotaController.getDevice, tasmotaController.updateDevice); // Opcional
// router.delete('/devices/:deviceId', authenticateToken, tasmotaController.getDevice, tasmotaController.deleteDevice); // Opcional

// Rotas para Leituras de Energia
router.get(
  "/devices/:deviceId/latest-reading",
  authenticateToken,
  tasmotaController.getDevice,
  tasmotaController.getLatestEnergyReading
);
router.get(
  "/devices/:deviceId/historical-readings",
  authenticateToken,
  tasmotaController.getDevice,
  tasmotaController.getHistoricalEnergyReadings
);

// Rota para Controle de Dispositivo (Ligar/Desligar)
router.post(
  "/devices/:deviceId/power",
  authenticateToken,
  tasmotaController.getDevice,
  tasmotaController.toggleDevicePower
);

// Rota para Agendamento de Desligamento
router.post("/schedule", authenticateToken, tasmotaController.scheduleShutdown);

// Rotas para Agendamentos de Desligamento
router.get("/schedules", authenticateToken, tasmotaController.listSchedules);
router.post("/schedules", authenticateToken, tasmotaController.createSchedule);

// Nova rota para buscar Energia Total diretamente do Tasmota (apenas admin)
const {
  getLiveTotalEnergyFromTasmota,
} = require("../controllers/tasmota.controller");
router.get(
  "/devices/:deviceId/total-energy-live",
  authenticateToken,
  getLiveTotalEnergyFromTasmota
);

// Rota de teste para verificar a lógica de detecção do último dia do mês
router.get("/test-last-day-detection", authenticateToken, (req, res) => {
  try {
    const energyTotalManager = require("../services/energyTotalManager");
    const testResult = energyTotalManager.testLastDayDetection();
    res.json({
      message: "Teste de detecção do último dia do mês executado",
      result: testResult,
    });
  } catch (error) {
    console.error("Erro no teste de detecção:", error);
    res.status(500).json({
      message: "Erro ao executar teste de detecção",
      error: error.message,
    });
  }
});

// Rota para verificar status de salvamento por broker
router.get(
  "/devices/:deviceId/broker-save-status",
  authenticateToken,
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const userId = req.user.userId;

      // Verifica se o dispositivo pertence ao usuário
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();

      const device = await prisma.device.findUnique({
        where: { id: deviceId, userId: userId },
      });

      if (!device) {
        return res.status(404).json({
          message:
            "Dispositivo não encontrado ou você não tem permissão para acessá-lo.",
        });
      }

      const energyTotalManager = require("../services/energyTotalManager");
      const brokerStatus = await energyTotalManager.checkBrokerSaveStatus(
        deviceId
      );

      res.json({
        message: "Status de salvamento por broker obtido com sucesso",
        deviceId: deviceId,
        deviceName: device.name,
        brokerStatus: brokerStatus,
      });
    } catch (error) {
      console.error(
        "Erro ao verificar status de salvamento por broker:",
        error
      );
      res.status(500).json({
        message: "Erro ao verificar status de salvamento por broker",
        error: error.message,
      });
    }
  }
);

// Rota para inserir dados históricos no KWHMonthly (apenas admin)
router.post("/insert-historical-data", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();

    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({
        message:
          "Acesso negado. Apenas administradores podem executar esta operação.",
      });
    }

    // Dados históricos fornecidos
    const historicalData = [
      { month: 6, year: 2024, consumption: 15.321 },
      { month: 7, year: 2024, consumption: 19.845 },
      { month: 8, year: 2024, consumption: 21.527 },
      { month: 9, year: 2024, consumption: 18.462 },
    ];

    console.log("🚀 Iniciando inserção de dados históricos via API...");

    // Buscar todos os usuários
    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      return res.status(404).json({
        message: "Nenhum usuário encontrado no banco de dados.",
      });
    }

    // Buscar todos os dispositivos
    const devices = await prisma.device.findMany({
      select: { id: true, name: true, userId: true, broker: true },
    });

    if (devices.length === 0) {
      return res.status(404).json({
        message: "Nenhum dispositivo encontrado no banco de dados.",
      });
    }

    let totalInserted = 0;
    const insertedData = [];

    // Para cada usuário
    for (const user of users) {
      // Para cada mês histórico
      for (const data of historicalData) {
        // Buscar dispositivos deste usuário
        const userDevices = devices.filter((d) => d.userId === user.id);

        if (userDevices.length === 0) {
          continue;
        }

        // Para cada dispositivo do usuário
        for (const device of userDevices) {
          // Dividir o consumo entre os brokers
          const consumptionPerBroker = data.consumption / userDevices.length;

          // Inserir dados para broker1
          const broker1Record = await prisma.kWHMonthly.create({
            data: {
              deviceId: device.id,
              userId: user.id,
              month: data.month,
              year: data.year,
              brokerLabel: "broker1",
              totalEnergyAccumulated: consumptionPerBroker,
              monthlyConsumption: consumptionPerBroker,
              timestamp: new Date(data.year, data.month - 1, 28),
            },
          });

          // Inserir dados para broker2
          const broker2Record = await prisma.kWHMonthly.create({
            data: {
              deviceId: device.id,
              userId: user.id,
              month: data.month,
              year: data.year,
              brokerLabel: "broker2",
              totalEnergyAccumulated: consumptionPerBroker,
              monthlyConsumption: consumptionPerBroker,
              timestamp: new Date(data.year, data.month - 1, 28),
            },
          });

          totalInserted += 2;
          insertedData.push({
            user: user.email,
            device: device.name,
            month: data.month,
            year: data.year,
            consumption: consumptionPerBroker,
            brokers: ["broker1", "broker2"],
          });
        }
      }
    }

    console.log(
      `🎉 Inserção concluída! Total de registros inseridos: ${totalInserted}`
    );

    res.json({
      message: "Dados históricos inseridos com sucesso!",
      totalInserted: totalInserted,
      usersProcessed: users.length,
      devicesProcessed: devices.length,
      insertedData: insertedData,
    });
  } catch (error) {
    console.error("Erro ao inserir dados históricos:", error);
    res.status(500).json({
      message: "Erro ao inserir dados históricos",
      error: error.message,
    });
  }
});

// Rota para verificar dados históricos inseridos
router.get("/historical-data-status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();

    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({
        message:
          "Acesso negado. Apenas administradores podem executar esta operação.",
      });
    }

    // Buscar todos os dados do KWHMonthly
    const monthlyData = await prisma.kWHMonthly.findMany({
      include: {
        device: {
          select: { name: true, broker: true },
        },
        user: {
          select: { email: true },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { brokerLabel: "asc" }],
    });

    // Agrupar por mês/ano
    const groupedData = {};
    monthlyData.forEach((record) => {
      const key = `${record.year}-${record.month.toString().padStart(2, "0")}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          month: record.month,
          year: record.year,
          totalConsumption: 0,
          records: [],
        };
      }
      groupedData[key].totalConsumption += record.monthlyConsumption;
      groupedData[key].records.push({
        device: record.device.name,
        broker: record.brokerLabel,
        consumption: record.monthlyConsumption,
        user: record.user.email,
      });
    });

    // Converter para array
    const summaryData = Object.values(groupedData).map((data) => ({
      month: data.month,
      year: data.year,
      totalConsumption: parseFloat(data.totalConsumption.toFixed(3)),
      recordCount: data.records.length,
      records: data.records,
    }));

    res.json({
      message: "Dados históricos obtidos com sucesso!",
      totalRecords: monthlyData.length,
      summary: summaryData,
      rawData: monthlyData,
    });
  } catch (error) {
    console.error("Erro ao obter dados históricos:", error);
    res.status(500).json({
      message: "Erro ao obter dados históricos",
      error: error.message,
    });
  }
});

module.exports = router;
