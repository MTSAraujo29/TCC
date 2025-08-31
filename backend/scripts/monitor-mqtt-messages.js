// backend/scripts/monitor-mqtt-messages.js

/**
 * Script para monitorar mensagens MQTT em tempo real
 * Este script se conecta aos brokers e exibe as mensagens recebidas
 */

require('dotenv').config();
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt.config');

console.log('=== MONITOR DE MENSAGENS MQTT ===');
console.log('Este script monitora mensagens MQTT em tempo real');
console.log('Pressione Ctrl+C para encerrar');

// Função para monitorar mensagens de um broker
function monitorBroker(brokerConfig, brokerName) {
  console.log(`\n[${brokerName}] Iniciando monitoramento...`);
  console.log(`[${brokerName}] URL: ${brokerConfig.protocol}://${brokerConfig.host}:${brokerConfig.port}`);
  
  // Configuração do cliente
  const clientId = `mqtt_monitor_${Math.random().toString(16).substr(2, 8)}`;
  const options = {
    clientId,
    username: brokerConfig.username,
    password: brokerConfig.password,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    rejectUnauthorized: false,
    protocolVersion: 4 // MQTT v3.1.1 para maior compatibilidade
  };
  
  console.log(`[${brokerName}] Opções de conexão:`, JSON.stringify(options, null, 2));
  
  // Criar cliente MQTT
  const client = mqtt.connect(`${brokerConfig.protocol}://${brokerConfig.host}:${brokerConfig.port}`, options);
  
  // Evento de conexão
  client.on('connect', () => {
    console.log(`[${brokerName}] CONECTADO: Monitorando mensagens...`);
    
    // Inscrever em todos os tópicos relevantes
    const topics = brokerName === 'Broker 1' ? 
      mqttConfig.topics.broker1 : 
      mqttConfig.topics.broker2;
    
    // Adicionar wildcard para capturar mais mensagens
    const allTopics = [...topics];
    
    // Adicionar tópicos com wildcard para capturar mais mensagens
    if (brokerName === 'Broker 1') {
      allTopics.push('stat/tasmota_C2BE64/#');
      allTopics.push('tele/tasmota_C2BE64/#');
      allTopics.push('cmnd/tasmota_C2BE64/#');
    } else {
      allTopics.push('stat/tasmota_C3B7EC/#');
      allTopics.push('tele/tasmota_C3B7EC/#');
      allTopics.push('cmnd/tasmota_C3B7EC/#');
    }
    
    allTopics.forEach(topic => {
      client.subscribe(topic, (err) => {
        if (!err) {
          console.log(`[${brokerName}] Inscrito no tópico: ${topic}`);
        } else {
          console.error(`[${brokerName}] Erro ao se inscrever no tópico ${topic}:`, err.message);
        }
      });
    });
    
    // Solicitar status dos dispositivos
    if (brokerName === 'Broker 1') {
      setTimeout(() => {
        console.log(`[${brokerName}] Solicitando STATUS10 do dispositivo...`);
        client.publish('cmnd/tasmota_C2BE64/STATUS', '10');
      }, 2000);
    } else {
      setTimeout(() => {
        console.log(`[${brokerName}] Solicitando STATUS10 do dispositivo...`);
        client.publish('cmnd/tasmota_C3B7EC/STATUS', '10');
      }, 2000);
    }
  });
  
  // Evento de mensagem
  client.on('message', (topic, message) => {
    const now = new Date().toISOString();
    try {
      // Tentar analisar como JSON
      const jsonMessage = JSON.parse(message.toString());
      console.log(`\n[${brokerName}] [${now}] Mensagem recebida no tópico: ${topic}`);
      console.log(JSON.stringify(jsonMessage, null, 2));
    } catch (e) {
      // Se não for JSON, mostrar como string
      console.log(`\n[${brokerName}] [${now}] Mensagem recebida no tópico: ${topic}`);
      console.log(message.toString());
    }
  });
  
  // Evento de erro
  client.on('error', (err) => {
    console.error(`[${brokerName}] ERRO: ${err.message}`);
  });
  
  // Evento de reconexão
  client.on('reconnect', () => {
    console.log(`[${brokerName}] Tentando reconectar...`);
  });
  
  // Evento de desconexão
  client.on('close', () => {
    console.log(`[${brokerName}] Conexão fechada`);
  });
  
  // Evento offline
  client.on('offline', () => {
    console.log(`[${brokerName}] Cliente está offline`);
  });
  
  return client;
}

// Iniciar monitoramento para ambos os brokers
const broker1Client = monitorBroker(mqttConfig.broker1, 'Broker 1');
const broker2Client = monitorBroker(mqttConfig.broker2, 'Broker 2');

// Lidar com encerramento do script
process.on('SIGINT', () => {
  console.log('\nEncerrando monitoramento MQTT...');
  broker1Client.end(true, () => {
    broker2Client.end(true, () => {
      console.log('Conexões MQTT encerradas. Saindo.');
      process.exit(0);
    });
  });
});