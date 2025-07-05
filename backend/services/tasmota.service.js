// backend/services/tasmota.service.js

// ATENÇÃO: Este serviço utiliza o padrão Singleton para as conexões MQTT.
// NÃO crie novas conexões MQTT em outros arquivos! Sempre utilize as instâncias mqttClient e mqttClient2 deste serviço.
// Isso é fundamental para não exceder o limite de sessões do HiveMQ.

const mqtt = require('mqtt');
const { PrismaClient } = require('@prisma/client'); // Importa o PrismaClient
const energyTotalManager = require('./energyTotalManager'); // Importa o novo serviço

// Instancia o PrismaClient uma única vez
const prisma = new PrismaClient();

// --- Configurações do MQTT (Broker HiveMQ Cloud) ---
// Lendo do .env
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT || 8883;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_PROTOCOL = process.env.MQTT_PROTOCOL || 'mqtts';
const MQTT_URL = process.env.MQTT_URL;
const MQTT_WS_URL = process.env.MQTT_WS_URL;

// --- Configurações do MQTT Broker 2 ---
const MQTT_HOST2 = process.env.MQTT_HOST2;
const MQTT_PORT2 = process.env.MQTT_PORT2 || 8883;
const MQTT_USERNAME2 = process.env.MQTT_USERNAME2;
const MQTT_PASSWORD2 = process.env.MQTT_PASSWORD2;
const MQTT_PROTOCOL2 = process.env.MQTT_PROTOCOL2 || 'mqtts';
const MQTT_URL2 = process.env.MQTT_TLS_URL2;
const MQTT_WS_URL2 = process.env.MQTT_TLS_WS_URL2;

// Tópicos dos seus Sonoffs (ajuste conforme os Client IDs que você definiu no Tasmota)
// Ex: Se o Client ID do seu Sonoff no Tasmota for 'sonoff_tv_sala', o tópico será 'tele/sonoff_tv_sala/STATE'
const SONOFF_TOPICS = [
    'stat/tasmota_C2BE64/STATUS10',
    'stat/tasmota_C2BE64/STATUS11',
    'stat/tasmota_C2BE64/POWER',
    'tele/tasmota_C2BE64/SENSOR',
    'tele/tasmota_C2BE64/STATE',
    'stat/tasmota_C3B7EC/STATUS10',
    'stat/tasmota_C3B7EC/STATUS11',
    'stat/tasmota_C3B7EC/POWER',
    'tele/tasmota_C3B7EC/SENSOR',
    'tele/tasmota_C3B7EC/STATE'
];

// Client ID único para este backend MQTT
const CLIENT_ID = `backend_tcc_monitor_${Math.random().toString(16).substr(2, 8)}`;

const MQTT_OPTIONS = {
    port: MQTT_PORT,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: CLIENT_ID,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 1000,
    protocol: MQTT_PROTOCOL,
    rejectUnauthorized: false // Em produção, para certificados de CA confiável, pode ser true. Para desenvolvimento, false pode ser útil.
};

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

let mqttClient = null;
let mqttClient2 = null;
let mqttClientInitCount = 0;
let mqttClient2InitCount = 0;
let mqttClientInactivityTimer = null;
let mqttClient2InactivityTimer = null;
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

// Cache em memória para o valor mais recente de energia total de cada dispositivo
const lastTotalEnergyCache = {};

function updateTotalEnergyCache(deviceId, valor) {
    lastTotalEnergyCache[deviceId] = valor;
    console.log('CACHE ATUALIZADO:', deviceId, lastTotalEnergyCache[deviceId]);
}

function getTotalEnergyFromCache(deviceId) {
    return lastTotalEnergyCache[deviceId] || null;
}

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

// --- Funções de Serviço Tasmota ---

async function initializeMqttClients() {
    // Broker 1
    if (!mqttClient) {
        mqttClientInitCount++;
        console.log(`[MQTT] Inicializando conexão MQTT 1 (vezes inicializado: ${mqttClientInitCount})`);
        console.log(`Tentando conectar ao broker MQTT 1: ${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`);
        mqttClient = mqtt.connect(`${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`, MQTT_OPTIONS);
        mqttClient.on('connect', () => {
            console.log('Conectado ao broker MQTT 1!');
            SONOFF_TOPICS.filter(t => t.includes('C2BE64')).forEach(topic => {
                mqttClient.subscribe(topic, (err) => {
                    if (!err) {
                        console.log(`[Broker1] Inscrito no tópico: ${topic}`);
                    } else {
                        console.error(`[Broker1] Erro ao se inscrever no tópico ${topic}:`, err);
                    }
                });
            });
            resetMqttClientInactivityTimer(mqttClient, 'mqttClient');
        });
        mqttClient.on('message', (topic, message) => {
            resetMqttClientInactivityTimer(mqttClient, 'mqttClient');
            handleMqttMessage(topic, message, 'broker1');
        });
        mqttClient.on('packetsend', () => {
            resetMqttClientInactivityTimer(mqttClient, 'mqttClient');
        });
        mqttClient.on('close', () => {
            console.warn('[MQTT] Conexão MQTT 1 fechada!');
        });
        mqttClient.on('error', (err) => {
            console.error('[MQTT] Erro na conexão MQTT 1:', err);
        });
    } else {
        console.log('[MQTT] mqttClient já inicializado, reutilizando conexão existente.');
    }
    // Broker 2
    if (!mqttClient2) {
        mqttClient2InitCount++;
        console.log(`[MQTT] Inicializando conexão MQTT 2 (vezes inicializado: ${mqttClient2InitCount})`);
        console.log(`Tentando conectar ao broker MQTT 2: ${MQTT_PROTOCOL2}://${MQTT_HOST2}:${MQTT_PORT2}`);
        mqttClient2 = mqtt.connect(`${MQTT_PROTOCOL2}://${MQTT_HOST2}:${MQTT_PORT2}`, MQTT_OPTIONS2);
        mqttClient2.on('connect', () => {
            console.log('Conectado ao broker MQTT 2!');
            SONOFF_TOPICS.filter(t => t.includes('C3B7EC')).forEach(topic => {
                mqttClient2.subscribe(topic, (err) => {
                    if (!err) {
                        console.log(`[Broker2] Inscrito no tópico: ${topic}`);
                    } else {
                        console.error(`[Broker2] Erro ao se inscrever no tópico ${topic}:`, err);
                    }
                });
            });
            resetMqttClientInactivityTimer(mqttClient2, 'mqttClient2');
        });
        mqttClient2.on('message', (topic, message) => {
            resetMqttClientInactivityTimer(mqttClient2, 'mqttClient2');
            handleMqttMessage(topic, message, 'broker2');
        });
        mqttClient2.on('packetsend', () => {
            resetMqttClientInactivityTimer(mqttClient2, 'mqttClient2');
        });
        mqttClient2.on('close', () => {
            console.warn('[MQTT] Conexão MQTT 2 fechada!');
        });
        mqttClient2.on('error', (err) => {
            console.error('[MQTT] Erro na conexão MQTT 2:', err);
        });
    } else {
        console.log('[MQTT] mqttClient2 já inicializado, reutilizando conexão existente.');
    }
}

// Função centralizada para processar mensagens de ambos os brokers
async function handleMqttMessage(topic, message, broker) {
    const payload = message.toString();
    console.log('MQTT RECEBIDO:', topic, payload);
    try {
        // STATUS10: Dados de energia
        if (topic.endsWith('STATUS10')) {
            const data = JSON.parse(payload);
            const tasmotaTopic = topic.split('/')[1];
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) {
                console.warn(`[${broker}] Dispositivo com tasmotaTopic "${tasmotaTopic}" não encontrado no banco de dados. Pulando salvamento.`);
                return;
            }
            if (device.broker !== broker) {
                console.warn(`[${broker}] Dispositivo encontrado, mas broker não bate. Esperado: ${device.broker}`);
                return;
            }
            if (data.StatusSNS && data.StatusSNS.ENERGY) {
                const energy = data.StatusSNS.ENERGY;
                console.log(`[${broker}] Payload STATUS10 recebido do Tasmota:`, JSON.stringify(energy, null, 2));
                updateTotalEnergyCache(device.id, energy.Total);
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
                console.log(`[${broker}] Dados processados para salvar (STATUS10):`, JSON.stringify(processedData, null, 2));
                const leituraSalva = await prisma.energyReading.create({
                    data: {
                        ...processedData,
                        brokerLabel: broker
                    }
                });
            }
        }

        // STATUS11: Status do dispositivo (POWER)
        if (topic.endsWith('STATUS11')) {
            const data = JSON.parse(payload);
            const tasmotaTopic = topic.split('/')[1];
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) {
                console.warn(`[${broker}] Dispositivo com tasmotaTopic "${tasmotaTopic}" não encontrado no banco de dados. Pulando atualização de status.`);
                return;
            }
            if (device.broker !== broker) {
                console.warn(`[${broker}] Dispositivo encontrado, mas broker não bate. Esperado: ${device.broker}`);
                return;
            }
            if (data.StatusSTS && typeof data.StatusSTS.POWER !== 'undefined') {
                const isOn = data.StatusSTS.POWER === 'ON';
                await prisma.device.update({
                    where: { id: device.id },
                    data: { powerState: isOn }
                });
                // console.log(`Status de powerState atualizado para ${isOn} no device ${tasmotaTopic}`);
            }
        }

        // SENSOR: Dados de energia periódicos
        if (topic.endsWith('SENSOR')) {
            const data = JSON.parse(payload);
            const tasmotaTopic = topic.split('/')[1];
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) return;
            if (device.broker !== broker) {
                console.warn(`[${broker}] Dispositivo encontrado, mas broker não bate. Esperado: ${device.broker}`);
                return;
            }
            if (data.ENERGY) {
                console.log(`[${broker}] Payload SENSOR recebido do Tasmota:`, JSON.stringify(data.ENERGY, null, 2));
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
                console.log(`[${broker}] Dados processados para salvar (SENSOR):`, JSON.stringify(processedData, null, 2));
                const leituraSalva = await prisma.energyReading.create({
                    data: {
                        ...processedData,
                        brokerLabel: broker
                    }
                });
            }
        }

        // STATE: Status do dispositivo
        if (topic.endsWith('STATE')) {
            const data = JSON.parse(payload);
            const tasmotaTopic = topic.split('/')[1];
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) return;
            if (device.broker !== broker) {
                console.warn(`[${broker}] Dispositivo encontrado, mas broker não bate. Esperado: ${device.broker}`);
                return;
            }
            if (typeof data.POWER !== 'undefined') {
                const isOn = data.POWER === 'ON';
                await prisma.device.update({
                    where: { id: device.id },
                    data: { powerState: isOn }
                });
                // console.log(`Status de powerState (STATE) atualizado para ${isOn} no device ${tasmotaTopic}`);
            }
        }

        // POWER: Mudança de estado ON/OFF
        if (topic.endsWith('POWER')) {
            const tasmotaTopic = topic.split('/')[1];
            const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
            if (!device) return;
            if (device.broker !== broker) {
                console.warn(`[${broker}] Dispositivo encontrado, mas broker não bate. Esperado: ${device.broker}`);
                return;
            }
            const isOn = payload === 'ON';
            await prisma.device.update({
                where: { id: device.id },
                data: { powerState: isOn }
            });
            // console.log(`Status de powerState (POWER) atualizado para ${isOn} no device ${tasmotaTopic}`);
        }
    } catch (error) {
        console.error(`[${broker}] Erro ao processar ou salvar mensagem MQTT:`, error);
        console.log('Mensagem original que causou o erro:', payload);
    }
}

// Função para publicar comando no broker correto
async function publishMqttCommand(topic, message, broker) {
    if (broker === 'broker2') {
        if (!mqttClient2) await initializeMqttClients();
        return new Promise((resolve, reject) => {
            mqttClient2.publish(topic, message, (err) => {
                if (err) {
                    console.error('[Broker2] Erro ao publicar comando MQTT:', err);
                    reject(err);
                } else {
                    console.log(`[Broker2] Comando MQTT publicado: ${topic} -> ${message}`);
                    resolve();
                }
            });
        });
    } else {
        if (!mqttClient) await initializeMqttClients();
        return new Promise((resolve, reject) => {
            mqttClient.publish(topic, message, (err) => {
                if (err) {
                    console.error('[Broker1] Erro ao publicar comando MQTT:', err);
                    reject(err);
                } else {
                    console.log(`[Broker1] Comando MQTT publicado: ${topic} -> ${message}`);
                    resolve();
                }
            });
        });
    }
}

// Exporta o cliente Prisma para que possa ser usado em outros lugares (opcional, mas comum)
// module.exports.prisma = prisma; // Você pode adicionar isso se quiser acessar 'prisma' de outros arquivos

// Corrigir exportação: importar utilitários do energyTotalManager
const isLastDayOfMonth = energyTotalManager.isLastDayOfMonth;
const isPenultimateDayOfMonth = energyTotalManager.isPenultimateDayOfMonth;
const calculateMonthlyConsumption = energyTotalManager.calculateMonthlyConsumption;

module.exports = {
    initializeMqttClients,
    publishMqttCommand,
    getTotalEnergyFromCache, // Exporta função para o controller
    isLastDayOfMonth,
    isPenultimateDayOfMonth,
    calculateMonthlyConsumption,
    processEnergyData: energyTotalManager.processEnergyData,
    getCurrentTotalEnergyForDisplay: energyTotalManager.getCurrentTotalEnergyForDisplay,
    getAccumulatedTotalEnergy: energyTotalManager.getAccumulatedTotalEnergy,
};