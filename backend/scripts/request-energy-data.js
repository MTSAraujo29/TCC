// backend/scripts/request-energy-data.js

/**
 * Script para solicitar dados de energia dos dispositivos Tasmota
 * Este script envia comandos STATUS10 para os dispositivos e aguarda as respostas
 */

require('dotenv').config();
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt.config');

console.log('=== SOLICITAÇÃO DE DADOS DE ENERGIA ===');
console.log('Este script solicita dados de energia dos dispositivos Tasmota');

// Função para solicitar dados de um dispositivo em um broker específico
async function requestEnergyData(brokerConfig, brokerName, deviceTopic) {
  return new Promise((resolve) => {
    console.log(`\n[${brokerName}] Iniciando solicitação para ${deviceTopic}...`);
    console.log(`[${brokerName}] URL: ${brokerConfig.protocol}://${brokerConfig.host}:${brokerConfig.port}`);
    
    // Configuração do cliente
    const clientId = `mqtt_request_${Math.random().toString(16).substr(2, 8)}`;
    const options = {
      clientId,
      username: brokerConfig.username,
      password: brokerConfig.password,
      clean: true,
      reconnectPeriod: 0, // Não reconectar automaticamente
      connectTimeout: 10000, // 10 segundos de timeout
      rejectUnauthorized: false,
      protocolVersion: 4 // MQTT v3.1.1 para maior compatibilidade
    };
    
    console.log(`[${brokerName}] Opções de conexão:`, JSON.stringify(options, null, 2));
    
    // Criar cliente MQTT
    const client = mqtt.connect(`${brokerConfig.protocol}://${brokerConfig.host}:${brokerConfig.port}`, options);
    
    // Timeout para a conexão
    const connectionTimeout = setTimeout(() => {
      console.error(`[${brokerName}] ERRO: Timeout de conexão após 10 segundos`);
      client.end(true);
      resolve(false);
    }, 10000);
    
    // Timeout para a resposta
    let responseTimeout;
    
    // Evento de conexão
    client.on('connect', () => {
      clearTimeout(connectionTimeout);
      console.log(`[${brokerName}] CONECTADO: Enviando solicitação...`);
      
      // Inscrever no tópico de resposta STATUS10
      const statusTopic = `stat/${deviceTopic}/STATUS10`;
      client.subscribe(statusTopic, (err) => {
        if (!err) {
          console.log(`[${brokerName}] Inscrito no tópico de resposta: ${statusTopic}`);
          
          // Enviar comando para solicitar dados de energia
          const commandTopic = `cmnd/${deviceTopic}/STATUS`;
          console.log(`[${brokerName}] Enviando comando para ${commandTopic}: 10`);
          client.publish(commandTopic, '10');
          
          // Definir timeout para a resposta
          responseTimeout = setTimeout(() => {
            console.error(`[${brokerName}] ERRO: Não recebeu resposta após 5 segundos`);
            client.end(true);
            resolve(false);
          }, 5000);
        } else {
          console.error(`[${brokerName}] ERRO: Falha ao se inscrever no tópico ${statusTopic}:`, err.message);
          client.end(true);
          resolve(false);
        }
      });
    });
    
    // Evento de mensagem
    client.on('message', (topic, message) => {
      if (topic === `stat/${deviceTopic}/STATUS10`) {
        clearTimeout(responseTimeout);
        try {
          const data = JSON.parse(message.toString());
          console.log(`[${brokerName}] SUCESSO: Recebeu dados de energia:`);
          if (data.StatusSNS && data.StatusSNS.ENERGY) {
            console.log(JSON.stringify(data.StatusSNS.ENERGY, null, 2));
            client.end(true);
            resolve(true);
          } else {
            console.log(`[${brokerName}] AVISO: Resposta recebida, mas sem dados de energia:`);
            console.log(JSON.stringify(data, null, 2));
            client.end(true);
            resolve(false);
          }
        } catch (error) {
          console.error(`[${brokerName}] ERRO: Falha ao processar mensagem:`, error.message);
          console.log('Mensagem recebida:', message.toString());
          client.end(true);
          resolve(false);
        }
      }
    });
    
    // Evento de erro
    client.on('error', (err) => {
      clearTimeout(connectionTimeout);
      clearTimeout(responseTimeout);
      console.error(`[${brokerName}] ERRO: Falha na conexão:`, err.message);
      client.end(true);
      resolve(false);
    });
  });
}

// Função principal para executar as solicitações
async function runRequests() {
  try {
    // Dispositivo no Broker 1
    const broker1Device = 'tasmota_C2BE64';
    const broker1Success = await requestEnergyData(mqttConfig.broker1, 'Broker 1', broker1Device);
    
    // Dispositivo no Broker 2
    const broker2Device = 'tasmota_C3B7EC';
    const broker2Success = await requestEnergyData(mqttConfig.broker2, 'Broker 2', broker2Device);
    
    // Resumo dos resultados
    console.log('\n=== RESUMO DAS SOLICITAÇÕES ===');
    console.log(`Dispositivo ${broker1Device} (Broker 1): ${broker1Success ? 'DADOS RECEBIDOS ✅' : 'FALHA ❌'}`);
    console.log(`Dispositivo ${broker2Device} (Broker 2): ${broker2Success ? 'DADOS RECEBIDOS ✅' : 'FALHA ❌'}`);
    
    if (!broker1Success || !broker2Success) {
      console.log('\nSugestões para resolver problemas:');
      console.log('1. Verifique se os dispositivos estão online e conectados aos brokers');
      console.log('2. Verifique se os tópicos estão configurados corretamente');
      console.log('3. Verifique se os dispositivos estão configurados para enviar dados de energia');
      console.log('4. Verifique se há algum firewall bloqueando a conexão');
    }
    
  } catch (error) {
    console.error('Erro ao executar as solicitações:', error);
  }
}

// Executar as solicitações
runRequests();