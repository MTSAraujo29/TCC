// backend/scripts/test-mqtt-connection.js

/**
 * Script para testar a conexão MQTT com os brokers
 * Este script pode ser executado separadamente para verificar se a conexão está funcionando
 */

require('dotenv').config();
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt.config');

console.log('=== TESTE DE CONEXÃO MQTT ===');
console.log('Este script testa a conexão com os brokers MQTT configurados');

// Função para testar a conexão com um broker
async function testBrokerConnection(brokerConfig, brokerName) {
  return new Promise((resolve) => {
    console.log(`\n[${brokerName}] Iniciando teste de conexão...`);
    console.log(`[${brokerName}] URL: ${brokerConfig.protocol}://${brokerConfig.host}:${brokerConfig.port}`);
    
    // Configuração do cliente
    const clientId = `mqtt_test_${Math.random().toString(16).substr(2, 8)}`;
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
    
    // Evento de conexão
    client.on('connect', () => {
      clearTimeout(connectionTimeout);
      console.log(`[${brokerName}] SUCESSO: Conectado ao broker!`);
      
      // Tentar se inscrever em um tópico de teste
      const testTopic = brokerName === 'Broker 1' ? 
        mqttConfig.topics.broker1[0] : 
        mqttConfig.topics.broker2[0];
      
      console.log(`[${brokerName}] Tentando se inscrever no tópico: ${testTopic}`);
      
      client.subscribe(testTopic, (err) => {
        if (!err) {
          console.log(`[${brokerName}] SUCESSO: Inscrito no tópico ${testTopic}`);
        } else {
          console.error(`[${brokerName}] ERRO: Falha ao se inscrever no tópico ${testTopic}:`, err.message);
        }
        
        // Encerrar a conexão após o teste
        setTimeout(() => {
          console.log(`[${brokerName}] Encerrando conexão de teste...`);
          client.end(true);
          resolve(true);
        }, 2000);
      });
    });
    
    // Evento de erro
    client.on('error', (err) => {
      clearTimeout(connectionTimeout);
      console.error(`[${brokerName}] ERRO: Falha na conexão:`, err.message);
      client.end(true);
      resolve(false);
    });
  });
}

// Função principal para executar os testes
async function runTests() {
  try {
    console.log('\nVerificando variáveis de ambiente...');
    
    // Verificar variáveis de ambiente do Broker 1
    if (!mqttConfig.broker1.host || !mqttConfig.broker1.username || !mqttConfig.broker1.password) {
      console.error('ERRO: Variáveis de ambiente para o Broker 1 não estão configuradas corretamente');
      console.log('Verifique se MQTT_HOST, MQTT_USERNAME e MQTT_PASSWORD estão definidos no arquivo .env');
    } else {
      console.log('Variáveis de ambiente para o Broker 1 estão configuradas');
    }
    
    // Verificar variáveis de ambiente do Broker 2
    if (!mqttConfig.broker2.host || !mqttConfig.broker2.username || !mqttConfig.broker2.password) {
      console.error('ERRO: Variáveis de ambiente para o Broker 2 não estão configuradas corretamente');
      console.log('Verifique se MQTT_HOST2, MQTT_USERNAME2 e MQTT_PASSWORD2 estão definidos no arquivo .env');
    } else {
      console.log('Variáveis de ambiente para o Broker 2 estão configuradas');
    }
    
    // Testar conexão com o Broker 1
    const broker1Success = await testBrokerConnection(mqttConfig.broker1, 'Broker 1');
    
    // Testar conexão com o Broker 2
    const broker2Success = await testBrokerConnection(mqttConfig.broker2, 'Broker 2');
    
    // Resumo dos resultados
    console.log('\n=== RESUMO DOS TESTES ===');
    console.log(`Broker 1: ${broker1Success ? 'CONECTADO ✅' : 'FALHA ❌'}`);
    console.log(`Broker 2: ${broker2Success ? 'CONECTADO ✅' : 'FALHA ❌'}`);
    
    if (!broker1Success || !broker2Success) {
      console.log('\nSugestões para resolver problemas de conexão:');
      console.log('1. Verifique se as credenciais (usuário/senha) estão corretas');
      console.log('2. Verifique se o host e porta estão corretos');
      console.log('3. Verifique se o broker está online e acessível');
      console.log('4. Verifique se há algum firewall bloqueando a conexão');
      console.log('5. Tente usar uma versão mais antiga do protocolo MQTT (v3.1.1)');
    }
    
  } catch (error) {
    console.error('Erro ao executar os testes:', error);
  }
}

// Executar os testes
runTests();