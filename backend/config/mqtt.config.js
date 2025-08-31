// backend/config/mqtt.config.js

/**
 * Configuração centralizada para conexões MQTT
 * Este arquivo contém todas as configurações necessárias para conectar aos brokers MQTT
 */

require('dotenv').config();

// --- Configurações do MQTT (Broker HiveMQ Cloud) ---
const MQTT_CONFIG = {
  broker1: {
    host: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT || 8883,
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    protocol: process.env.MQTT_PROTOCOL || 'mqtts',
    url: process.env.MQTT_URL,
    wsUrl: process.env.MQTT_WS_URL,
    options: {
      clean: true,
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30000,
      rejectUnauthorized: false,
      protocolVersion: 4, // Usando MQTT 4.0 para maior compatibilidade
    }
  },
  broker2: {
    host: process.env.MQTT_HOST2,
    port: process.env.MQTT_PORT2 || 8883,
    username: process.env.MQTT_USERNAME2,
    password: process.env.MQTT_PASSWORD2,
    protocol: process.env.MQTT_PROTOCOL2 || 'mqtts',
    url: process.env.MQTT_TLS_URL2,
    wsUrl: process.env.MQTT_TLS_WS_URL2,
    options: {
      clean: true,
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30000,
      rejectUnauthorized: false,
      protocolVersion: 4, // Usando MQTT 4.0 para maior compatibilidade
    }
  },
  topics: {
    broker1: [
      'stat/tasmota_C2BE64/STATUS10',
      'stat/tasmota_C2BE64/STATUS11',
      'stat/tasmota_C2BE64/POWER',
      'tele/tasmota_C2BE64/SENSOR',
      'tele/tasmota_C2BE64/STATE'
    ],
    broker2: [
      'stat/tasmota_C3B7EC/STATUS10',
      'stat/tasmota_C3B7EC/STATUS11',
      'stat/tasmota_C3B7EC/POWER',
      'tele/tasmota_C3B7EC/SENSOR',
      'tele/tasmota_C3B7EC/STATE'
    ]
  },
  // Tempo de inatividade antes de desconectar (5 minutos)
  inactivityTimeout: 5 * 60 * 1000
};

module.exports = MQTT_CONFIG;