/**
 * Serviço Tasmota MQTT
 * 
 * Gerencia comunicação MQTT com dispositivos Tasmota IoT.
 * Implementa padrão Singleton para conexões MQTT para otimizar
 * recursos e respeitar limites de sessões do broker.
 * 
 * Funcionalidades principais:
 * - Conexão dual com múltiplos brokers MQTT
 * - Processamento automático de dados de energia
 * - Cache em memória para valores em tempo real
 * - Gerenciamento de inatividade e reconexão
 * - Publicação de comandos para controle de dispositivos
 * 
 * @module TasmotaService
 * @requires mqtt
 * @requires @prisma/client
 * @requires ./energyTotalManager
 * 
 * IMPORTANTE: Este serviço utiliza padrão Singleton para conexões MQTT.
 * NÃO crie novas conexões em outros arquivos! Use sempre as instâncias
 * mqttClient e mqttClient2 deste serviço para não exceder limites do broker.
 */

const mqtt = require('mqtt');
const { PrismaClient } = require('@prisma/client');
const energyTotalManager = require('./energyTotalManager');

// === CONFIGURAÇÃO GLOBAL ===
const prisma = new PrismaClient();

// Configurações do Broker MQTT Principal (HiveMQ Cloud)
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT || 8883;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_PROTOCOL = process.env.MQTT_PROTOCOL || 'mqtts';
const MQTT_URL = process.env.MQTT_URL;
const MQTT_WS_URL = process.env.MQTT_WS_URL;

// Configurações do Broker MQTT Secundário
const MQTT_HOST2 = process.env.MQTT_HOST2;
const MQTT_PORT2 = process.env.MQTT_PORT2 || 8883;
const MQTT_USERNAME2 = process.env.MQTT_USERNAME2;
const MQTT_PASSWORD2 = process.env.MQTT_PASSWORD2;
const MQTT_PROTOCOL2 = process.env.MQTT_PROTOCOL2 || 'mqtts';
const MQTT_URL2 = process.env.MQTT_TLS_URL2;
const MQTT_WS_URL2 = process.env.MQTT_TLS_WS_URL2;

// === CONFIGURAÇÃO DE TÓPICOS ===
// Tópicos dos dispositivos Sonoff/Tasmota monitorados
// Formato: tipo/client_id/comando
const SONOFF_TOPICS = [
    // Dispositivo tasmota_C2BE64
    'stat/tasmota_C2BE64/STATUS10',  // Dados de energia
    'stat/tasmota_C2BE64/STATUS11',  // Status do dispositivo
    'stat/tasmota_C2BE64/POWER',     // Estado liga/desliga
    'tele/tasmota_C2BE64/SENSOR',    // Dados periódicos de sensores
    'tele/tasmota_C2BE64/STATE',     // Estado geral do dispositivo
    
    // Dispositivo tasmota_C3B7EC
    'stat/tasmota_C3B7EC/STATUS10',
    'stat/tasmota_C3B7EC/STATUS11',
    'stat/tasmota_C3B7EC/POWER',
    'tele/tasmota_C3B7EC/SENSOR',
    'tele/tasmota_C3B7EC/STATE'
];

// === CONFIGURAÇÃO DE CONEXÃO ===
// Client ID único para evitar conflitos
const CLIENT_ID = `backend_tcc_monitor_${Math.random().toString(16).substr(2, 8)}`;

// Opções de conexão para Broker Principal
const MQTT_OPTIONS = {
    port: MQTT_PORT,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: CLIENT_ID,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 1000,
    protocol: MQTT_PROTOCOL,
    rejectUnauthorized: false // Para desenvolvimento; em produção usar true com certificados válidos
};

// Opções de conexão para Broker Secundário
const MQTT_OPTIONS2 = {
    port: MQTT_PORT2,
    username: MQTT_USERNAME2,
    password: MQTT_PASSWORD2,
    clientId: CLIENT_ID,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 1000,
    protocol: MQTT_PROTOCOL2,
    rejectUnauthorized: false
};

// === VARIÁVEIS DE ESTADO ===
// Instâncias Singleton dos clientes MQTT
let mqttClient = null;
let mqttClient2 = null;

// Contadores para debug de inicializações
let mqttClientInitCount = 0;
let mqttClient2InitCount = 0;

// Timers para gerenciamento de inatividade
let mqttClientInactivityTimer = null;
let mqttClient2InactivityTimer = null;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

// === CACHE DE DADOS ===
// Cache em memória para valores mais recentes de energia total
// Permite acesso rápido sem consultar banco de dados
const lastTotalEnergyCache = {};

/**
 * Atualiza cache com valor mais recente de energia total
 * 
 * @param {string} deviceId - ID do dispositivo
 * @param {number} valor - Valor de energia total em kWh
 */
function updateTotalEnergyCache(deviceId, valor) {
    lastTotalEnergyCache[deviceId] = valor;
}

/**
 * Obtém valor de energia total do cache
 * 
 * @param {string} deviceId - ID do dispositivo
 * @returns {number|null} Valor em cache ou null se não disponível
 */
function getTotalEnergyFromCache(deviceId) {
    return lastTotalEnergyCache[deviceId] || null;
}

// === GERENCIAMENTO DE INATIVIDADE ===

/**
 * Reseta timer de inatividade para cliente MQTT específico
 * Previne desconexões desnecessárias durante comunicação ativa
 * 
 * @param {Object} client - Instância do cliente MQTT
 * @param {string} clientName - Nome identificador do cliente
 */
function resetMqttClientInactivityTimer(client, clientName) {
    if (clientName === 'mqttClient') {
        if (mqttClientInactivityTimer) clearTimeout(mqttClientInactivityTimer);
        mqttClientInactivityTimer = setTimeout(() => {
            console.warn(`[MQTT] ${clientName} inativo por mais de 5 minutos. Desconectando...`);
            client.end(true, () => {
                console.log(`[MQTT] ${clientName} desconectado por inatividade.`);
            });
        }, INACTIVITY_TIMEOUT_MS);
    } else if (clientName === 'mqttClient2') {
        if (mqttClient2InactivityTimer) clearTimeout(mqttClient2InactivityTimer);
        mqttClient2InactivityTimer = setTimeout(() => {
            console.warn(`[MQTT] ${clientName} inativo por mais de 5 minutos. Desconectando...`);
            client.end(true, () => {
                console.log(`[MQTT] ${clientName} desconectado por inatividade.`);
            });
        }, INACTIVITY_TIMEOUT_MS);
    }
}

// === INICIALIZAÇÃO DE CLIENTES MQTT ===

/**
 * Inicializa conexões MQTT com ambos os brokers
 * 
 * Implementa padrão Singleton para reutilizar conexões existentes.
 * Configura inscrições automáticas nos tópicos dos dispositivos
 * e handlers para eventos de conexão, mensagem e erro.
 * 
 * @async
 * @function initializeMqttClients
 */
async function initializeMqttClients() {
    // === INICIALIZAÇÃO DO BROKER PRINCIPAL ===
    if (!mqttClient) {
        mqttClientInitCount++;
        console.log(`[MQTT] Inicializando conexão MQTT 1 (tentativa: ${mqttClientInitCount})`);
        console.log(`Conectando ao broker: ${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`);
        
        mqttClient = mqtt.connect(`${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`, MQTT_OPTIONS);
        
        // Handler de conexão bem-sucedida
        mqttClient.on('connect', () => {
            console.log('✅ Conectado ao broker MQTT principal!');
            
            // Inscreve apenas nos tópicos do dispositivo C2BE64
            SONOFF_TOPICS.filter(t => t.includes('C2BE64')).forEach(topic => {
                mqttClient.subscribe(topic, (err) => {
                    if (!err) {
                        console.log(`[Broker1] ✅ Inscrito no tópico: ${topic}`);
                    } else {
                        console.error(`[Broker1] ❌ Erro ao se inscrever no tópico ${topic}:`, err);
                    }
                });
            });
            resetMqttClientInactivityTimer(mqttClient, 'mqttClient');
        });
        
        // Handler de mensagens recebidas
        mqttClient.on('message', (topic, message) => {
            resetMqttClientInactivityTimer(mqttClient, 'mqttClient');
            handleMqttMessage(topic, message, 'broker1');
        });
        
        // Handler de pacotes enviados (para reset de timer)
        mqttClient.on('packetsend', () => {
            resetMqttClientInactivityTimer(mqttClient, 'mqttClient');
        });
        
        // Handlers de eventos de conexão
        mqttClient.on('close', () => {
            console.warn('⚠️ [MQTT] Conexão principal fechada!');
        });
        
        mqttClient.on('error', (err) => {
            console.error('❌ [MQTT] Erro na conexão principal:', err);
        });
    } else {
        console.log('ℹ️ [MQTT] Cliente principal já inicializado, reutilizando conexão.');
    }
    
    // === INICIALIZAÇÃO DO BROKER SECUNDÁRIO ===
    if (!mqttClient2) {
        mqttClient2InitCount++;
        console.log(`[MQTT] Inicializando conexão MQTT 2 (tentativa: ${mqttClient2InitCount})`);
        console.log(`Conectando ao broker: ${MQTT_PROTOCOL2}://${MQTT_HOST2}:${MQTT_PORT2}`);
        
        mqttClient2 = mqtt.connect(`${MQTT_PROTOCOL2}://${MQTT_HOST2}:${MQTT_PORT2}`, MQTT_OPTIONS2);
        
        // Handler de conexão bem-sucedida
        mqttClient2.on('connect', () => {
            console.log('✅ Conectado ao broker MQTT secundário!');
            
            // Inscreve apenas nos tópicos do dispositivo C3B7EC
            SONOFF_TOPICS.filter(t => t.includes('C3B7EC')).forEach(topic => {
                mqttClient2.subscribe(topic, (err) => {
                    if (!err) {
                        console.log(`[Broker2] ✅ Inscrito no tópico: ${topic}`);
                    } else {
                        console.error(`[Broker2] ❌ Erro ao se inscrever no tópico ${topic}:`, err);
                    }
                });
            });
            resetMqttClientInactivityTimer(mqttClient2, 'mqttClient2');
        });
        
        // Handler de mensagens recebidas
        mqttClient2.on('message', (topic, message) => {
            resetMqttClientInactivityTimer(mqttClient2, 'mqttClient2');
            handleMqttMessage(topic, message, 'broker2');
        });
        
        // Handler de pacotes enviados
        mqttClient2.on('packetsend', () => {
            resetMqttClientInactivityTimer(mqttClient2, 'mqttClient2');
        });
        
        // Handlers de eventos de conexão
        mqttClient2.on('close', () => {
            console.warn('⚠️ [MQTT] Conexão secundária fechada!');
        });
        
        mqttClient2.on('error', (err) => {
            console.error('❌ [MQTT] Erro na conexão secundária:', err);
        });
    } else {
        console.log('ℹ️ [MQTT] Cliente secundário já inicializado, reutilizando conexão.');
    }
}

// === PROCESSAMENTO DE MENSAGENS MQTT ===

/**
 * Processa mensagens MQTT recebidas de ambos os brokers
 * 
 * Identifica tipo de mensagem pelo sufixo do tópico e processa
 * dados de energia, status de dispositivos e comandos de controle.
 * 
 * Tipos de mensagem suportados:
 * - STATUS10: Dados completos de energia
 * - STATUS11: Status atual do dispositivo
 * - SENSOR: Dados periódicos de sensores
 * - STATE: Estado geral do dispositivo
 * - POWER: Mudanças de estado liga/desliga
 * 
 * @param {string} topic - Tópico MQTT da mensagem
 * @param {Buffer} message - Payload da mensagem
 * @param {string} broker - Identificador do broker (broker1/broker2)
 */
async function handleMqttMessage(topic, message, broker) {
    const payload = message.toString();
    
    try {
        // === PROCESSAMENTO STATUS10 (Dados de Energia) ===
        if (topic.endsWith('STATUS10')) {
            const data = JSON.parse(payload);
            const tasmotaTopic = topic.split('/')[1];
            
            // Validação de dispositivo no banco
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) {
                console.warn(`[${broker}] ⚠️ Dispositivo "${tasmotaTopic}" não encontrado no banco. Ignorando.`);
                return;
            }
            
            // Validação de broker correto
            if (device.broker !== broker) {
                console.warn(`[${broker}] ⚠️ Broker incorreto para dispositivo. Esperado: ${device.broker}`);
                return;
            }
            
            // Processamento de dados de energia
            if (data.StatusSNS && data.StatusSNS.ENERGY) {
                const energy = data.StatusSNS.ENERGY;
                console.log(`[${broker}] 📊 Dados STATUS10 recebidos:`, JSON.stringify(energy, null, 2));
                
                // Atualiza cache para acesso rápido
                updateTotalEnergyCache(device.id, energy.Total);
                
                // Processa dados através do energyTotalManager
                const processedData = await energyTotalManager.processEnergyData({
                    power: energy.Power,
                    voltage: energy.Voltage,
                    current: energy.Current,
                    totalEnergy: energy.Total,
                    EnergyToday: energy.Today,
                    EnergyYesterday: energy.Yesterday,
                    ApparentPower: energy.ApparentPower,
                    ReactivePower: energy.ReactivePower,
                    PowerFactor: energy.Factor,
                    timestamp: new Date()
                }, device.id, tasmotaTopic);
                
                console.log(`[${broker}] 💾 Salvando dados processados:`, JSON.stringify(processedData, null, 2));
                
                // Salva no banco com identificação do broker
                await prisma.energyReading.create({
                    data: {
                        ...processedData,
                        brokerLabel: broker
                    }
                });
            }
        }

        // === PROCESSAMENTO STATUS11 (Status do Dispositivo) ===
        if (topic.endsWith('STATUS11')) {
            const data = JSON.parse(payload);
            const tasmotaTopic = topic.split('/')[1];
            
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) {
                console.warn(`[${broker}] ⚠️ Dispositivo "${tasmotaTopic}" não encontrado. Ignorando STATUS11.`);
                return;
            }
            
            if (device.broker !== broker) {
                console.warn(`[${broker}] ⚠️ Broker incorreto para STATUS11. Esperado: ${device.broker}`);
                return;
            }
            
            // Atualiza estado de energia do dispositivo
            if (data.StatusSTS && typeof data.StatusSTS.POWER !== 'undefined') {
                const isOn = data.StatusSTS.POWER === 'ON';
                await prisma.device.update({
                    where: { id: device.id },
                    data: { powerState: isOn }
                });
            }
        }

        // === PROCESSAMENTO SENSOR (Dados Periódicos) ===
        if (topic.endsWith('SENSOR')) {
            const data = JSON.parse(payload);
            const tasmotaTopic = topic.split('/')[1];
            
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) return;
            
            if (device.broker !== broker) {
                console.warn(`[${broker}] ⚠️ Broker incorreto para SENSOR. Esperado: ${device.broker}`);
                return;
            }
            
            // Processa dados de energia periódicos
            if (data.ENERGY) {
                console.log(`[${broker}] 📊 Dados SENSOR recebidos:`, JSON.stringify(data.ENERGY, null, 2));
                
                updateTotalEnergyCache(device.id, data.ENERGY.Total);
                
                const processedData = await energyTotalManager.processEnergyData({
                    power: data.ENERGY.Power,
                    voltage: data.ENERGY.Voltage,
                    current: data.ENERGY.Current,
                    totalEnergy: data.ENERGY.Total,
                    EnergyToday: data.ENERGY.Today,
                    EnergyYesterday: data.ENERGY.Yesterday,
                    ApparentPower: data.ENERGY.ApparentPower,
                    ReactivePower: data.ENERGY.ReactivePower,
                    PowerFactor: data.ENERGY.Factor,
                    timestamp: new Date()
                }, device.id, tasmotaTopic);
                
                console.log(`[${broker}] 💾 Salvando dados SENSOR:`, JSON.stringify(processedData, null, 2));
                
                await prisma.energyReading.create({
                    data: {
                        ...processedData,
                        brokerLabel: broker
                    }
                });
            }
        }

        // === PROCESSAMENTO STATE (Estado Geral) ===
        if (topic.endsWith('STATE')) {
            const data = JSON.parse(payload);
            const tasmotaTopic = topic.split('/')[1];
            
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) return;
            
            if (device.broker !== broker) {
                console.warn(`[${broker}] ⚠️ Broker incorreto para STATE. Esperado: ${device.broker}`);
                return;
            }
            
            // Atualiza estado de energia baseado em STATE
            if (typeof data.POWER !== 'undefined') {
                const isOn = data.POWER === 'ON';
                await prisma.device.update({
                    where: { id: device.id },
                    data: { powerState: isOn }
                });
            }
        }

        // === PROCESSAMENTO POWER (Controle Liga/Desliga) ===
        if (topic.endsWith('POWER')) {
            const tasmotaTopic = topic.split('/')[1];
            
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) return;
            
            if (device.broker !== broker) {
                console.warn(`[${broker}] ⚠️ Broker incorreto para POWER. Esperado: ${device.broker}`);
                return;
            }
            
            // Atualiza estado baseado em comando POWER
            const isOn = payload === 'ON';
            await prisma.device.update({
                where: { id: device.id },
                data: { powerState: isOn }
            });
        }
        
    } catch (error) {
        console.error(`[${broker}] ❌ Erro ao processar mensagem MQTT:`, error);
        console.log('📄 Payload que causou erro:', payload);
    }
}

// === PUBLICAÇÃO DE COMANDOS ===

/**
 * Publica comandos MQTT no broker apropriado
 * 
 * Seleciona automaticamente o cliente correto baseado no
 * parâmetro broker e garante que a conexão esteja ativa.
 * 
 * @param {string} topic - Tópico MQTT para publicação
 * @param {string} message - Mensagem/comando a ser enviado
 * @param {string} broker - Broker de destino (broker1/broker2)
 * @returns {Promise<void>} Resolve quando comando for enviado
 */
async function publishMqttCommand(topic, message, broker) {
    if (broker === 'broker2') {
        // Garante que cliente secundário esteja inicializado
        if (!mqttClient2) await initializeMqttClients();
        
        return new Promise((resolve, reject) => {
            mqttClient2.publish(topic, message, (err) => {
                if (err) {
                    console.error('[Broker2] ❌ Erro ao publicar comando:', err);
                    reject(err);
                } else {
                    console.log(`[Broker2] ✅ Comando enviado: ${topic} -> ${message}`);
                    resolve();
                }
            });
        });
    } else {
        // Garante que cliente principal esteja inicializado
        if (!mqttClient) await initializeMqttClients();
        
        return new Promise((resolve, reject) => {
            mqttClient.publish(topic, message, (err) => {
                if (err) {
                    console.error('[Broker1] ❌ Erro ao publicar comando:', err);
                    reject(err);
                } else {
                    console.log(`[Broker1] ✅ Comando enviado: ${topic} -> ${message}`);
                    resolve();
                }
            });
        });
    }
}

// === IMPORTAÇÃO DE UTILITÁRIOS ===
// Importa funções auxiliares do energyTotalManager para compatibilidade
const isLastDayOfMonth = energyTotalManager.isLastDayOfMonth;
const isPenultimateDayOfMonth = energyTotalManager.isPenultimateDayOfMonth;
const calculateMonthlyConsumption = energyTotalManager.calculateMonthlyConsumption;

// === EXPORTAÇÕES ===
module.exports = {
    // Funções principais do serviço
    initializeMqttClients,
    publishMqttCommand,
    
    // Funções de cache
    getTotalEnergyFromCache,
    
    // Funções utilitárias (delegadas ao energyTotalManager)
    isLastDayOfMonth,
    isPenultimateDayOfMonth,
    calculateMonthlyConsumption,
    processEnergyData: energyTotalManager.processEnergyData,
    getCurrentTotalEnergyForDisplay: energyTotalManager.getCurrentTotalEnergyForDisplay,
    getAccumulatedTotalEnergy: energyTotalManager.getAccumulatedTotalEnergy,
};