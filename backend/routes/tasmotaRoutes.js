// backend/routes/tasmotaRoutes.js
const express = require('express');
const router = express.Router();
const tasmotaController = require('../controllers/tasmota.controller');
const authenticateToken = require('../middleware/authenticateToken');

// Rotas para Gerenciamento de Dispositivos (CRUD)
router.post('/devices', authenticateToken, tasmotaController.addDevice); // LINHA 8
router.get('/devices', authenticateToken, tasmotaController.getUserDevices);

// Aplicar o middleware getDevice para rotas que operam em um dispositivo específico
// A ordem é importante: authenticateToken -> getDevice -> função do controlador
router.get('/devices/:deviceId', authenticateToken, tasmotaController.getDevice, tasmotaController.getDeviceDetails);
// router.put('/devices/:deviceId', authenticateToken, tasmotaController.getDevice, tasmotaController.updateDevice); // Opcional
// router.delete('/devices/:deviceId', authenticateToken, tasmotaController.getDevice, tasmotaController.deleteDevice); // Opcional

// Rotas para Leituras de Energia
router.get('/devices/:deviceId/latest-reading', authenticateToken, tasmotaController.getDevice, tasmotaController.getLatestEnergyReading);
router.get('/devices/:deviceId/historical-readings', authenticateToken, tasmotaController.getDevice, tasmotaController.getHistoricalEnergyReadings);

// Rota para Controle de Dispositivo (Ligar/Desligar)
router.post('/devices/:deviceId/power', authenticateToken, tasmotaController.getDevice, tasmotaController.toggleDevicePower);


module.exports = router;