/**
 * Rotas dos Dispositivos Tasmota
 * 
 * Gerencia todas as operações relacionadas aos dispositivos IoT Tasmota:
 * - CRUD de dispositivos
 * - Controle de energia (ligar/desligar)
 * - Leituras históricas e em tempo real
 * - Agendamentos automáticos
 * 
 * @module TasmotaRoutes
 * @requires express
 * @requires ../controllers/tasmota.controller
 * @requires ../middleware/authenticateToken
 * @requires ../services/tasmota.service
 */

const express = require("express");
const router = express.Router();
const tasmotaController = require("../controllers/tasmota.controller");
const authenticateToken = require("../middleware/authenticateToken");
const tasmotaService = require("../services/tasmota.service");

// === GERENCIAMENTO DE DISPOSITIVOS ===

/**
 * POST /devices - Adiciona novo dispositivo Tasmota
 * Registra um novo dispositivo IoT ao usuário autenticado
 */
router.post("/devices", authenticateToken, tasmotaController.addDevice);

/**
 * GET /devices - Lista todos os dispositivos do usuário
 * Retorna dispositivos com status de conexão e última leitura
 */
router.get("/devices", authenticateToken, tasmotaController.getUserDevices);

/**
 * GET /devices/:deviceId - Detalhes de dispositivo específico
 * Middleware: authenticateToken -> getDevice -> getDeviceDetails
 */
router.get(
  "/devices/:deviceId",
  authenticateToken,
  tasmotaController.getDevice,
  tasmotaController.getDeviceDetails
);

// === LEITURAS DE ENERGIA ===

/**
 * GET /devices/:deviceId/latest-reading - Última leitura de energia
 * Retorna os dados mais recentes de consumo do dispositivo
 */
router.get(
  "/devices/:deviceId/latest-reading",
  authenticateToken,
  tasmotaController.getDevice,
  tasmotaController.getLatestEnergyReading
);

/**
 * GET /devices/:deviceId/historical-readings - Histórico de leituras
 * Retorna dados históricos para geração de gráficos e análises
 */
router.get(
  "/devices/:deviceId/historical-readings",
  authenticateToken,
  tasmotaController.getDevice,
  tasmotaController.getHistoricalEnergyReadings
);

/**
 * GET /devices/:deviceId/total-energy-live - Energia total em tempo real
 * Obtém valor direto do cache MQTT para resposta rápida
 */
router.get(
  "/devices/:deviceId/total-energy-live",
  authenticateToken,
  tasmotaController.getLiveTotalEnergyFromTasmota
);

// === CONTROLE DE DISPOSITIVOS ===

/**
 * POST /devices/:deviceId/power - Controla estado do dispositivo
 * Liga ou desliga o dispositivo via comando MQTT
 */
router.post(
  "/devices/:deviceId/power",
  authenticateToken,
  tasmotaController.getDevice,
  tasmotaController.toggleDevicePower
);

// === AGENDAMENTOS ===

/**
 * GET /schedules - Lista agendamentos do usuário
 * Retorna todos os agendamentos de desligamento configurados
 */
router.get("/schedules", authenticateToken, tasmotaController.listSchedules);

/**
 * POST /schedules - Cria novo agendamento
 * Configura desligamento automático baseado em tempo ou consumo
 */
router.post("/schedules", authenticateToken, tasmotaController.createSchedule);

/**
 * POST /schedule - Agendamento simplificado (compatibilidade)
 * Endpoint alternativo para agendamento de desligamento
 */
router.post("/schedule", authenticateToken, tasmotaController.scheduleShutdown);

module.exports = router;
