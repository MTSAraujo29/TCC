// backend/services/tasmota.service.js

const mqtt = require('mqtt');
const { PrismaClient } = require('@prisma/client'); // Importa o PrismaClient

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

// Tópicos dos seus Sonoffs (ajuste conforme os Client IDs que você definiu no Tasmota)
// Ex: Se o Client ID do seu Sonoff no Tasmota for 'sonoff_tv_sala', o tópico será 'tele/sonoff_tv_sala/STATE'
const SONOFF_TOPICS = [
    'stat/tasmota_C2BE64/STATUS10',
    'stat/tasmota_C2BE64/STATUS11',
    'stat/tasmota_C2BE64/POWER',
    'tele/tasmota_C2BE64/SENSOR',
    'tele/tasmota_C2BE64/STATE'
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

let mqttClient = null;

// --- Funções de Serviço Tasmota ---

async function initializeMqttClient() {
    if (mqttClient) {
        console.log('Cliente MQTT já inicializado.');
        return mqttClient;
    }

    try {
        console.log(`Tentando conectar ao broker MQTT: ${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`);
        mqttClient = mqtt.connect(`${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`, MQTT_OPTIONS);

        mqttClient.on('connect', () => {
            console.log('Conectado ao broker MQTT HiveMQ Cloud!');
            SONOFF_TOPICS.forEach(topic => {
                mqttClient.subscribe(topic, (err) => {
                    if (!err) {
                        console.log(`Inscrito no tópico: ${topic}`);
                    } else {
                        console.error(`Erro ao se inscrever no tópico ${topic}:`, err);
                    }
                });
            });
        });

        mqttClient.on('message', async(topic, message) => {
            const payload = message.toString();
            console.log(`[MQTT_MESSAGE] Tópico: ${topic}, Payload: ${payload}`);

            try {
                // STATUS10: Dados de energia
                if (topic.endsWith('STATUS10')) {
                    const data = JSON.parse(payload);
                    const tasmotaTopic = topic.split('/')[1]; // Ex: tasmota_C2BE64
                    const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
                    if (!device) {
                        console.warn(`Dispositivo com tasmotaTopic "${tasmotaTopic}" não encontrado no banco de dados. Pulando salvamento.`);
                        return;
                    }
                    if (data.StatusSNS && data.StatusSNS.ENERGY) {
                        const energy = data.StatusSNS.ENERGY;
                        await prisma.energyReading.create({
                            data: {
                                deviceId: device.id,
                                timestamp: new Date(data.StatusSNS.Time || new Date()),
                                power: energy.Power,
                                voltage: energy.Voltage,
                                current: energy.Current,
                                totalEnergy: energy.Total,
                                // Adicione outros campos se existirem no schema.prisma
                            }
                        });
                        console.log(`Leitura de energia salva para o device ${tasmotaTopic}`);
                    }
                }

                // STATUS11: Status do dispositivo (POWER)
                if (topic.endsWith('STATUS11')) {
                    const data = JSON.parse(payload);
                    const tasmotaTopic = topic.split('/')[1];
                    const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
                    if (!device) {
                        console.warn(`Dispositivo com tasmotaTopic "${tasmotaTopic}" não encontrado no banco de dados. Pulando atualização de status.`);
                        return;
                    }
                    if (data.StatusSTS && typeof data.StatusSTS.POWER !== 'undefined') {
                        const isOn = data.StatusSTS.POWER === 'ON';
                        await prisma.device.update({
                            where: { id: device.id },
                            data: { powerState: isOn }
                        });
                        console.log(`Status de powerState atualizado para ${isOn} no device ${tasmotaTopic}`);
                    }
                }

                // SENSOR: Dados de energia periódicos
                if (topic.endsWith('SENSOR')) {
                    const data = JSON.parse(payload);
                    const tasmotaTopic = topic.split('/')[1];
                    const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
                    if (!device) return;
                    if (data.ENERGY) {
                        await prisma.energyReading.create({
                            data: {
                                deviceId: device.id,
                                timestamp: new Date(data.Time || new Date()),
                                power: data.ENERGY.Power,
                                voltage: data.ENERGY.Voltage,
                                current: data.ENERGY.Current,
                                totalEnergy: data.ENERGY.Total,
                            }
                        });
                        console.log(`Leitura de energia (SENSOR) salva para o device ${tasmotaTopic}`);
                    }
                }

                // STATE: Status do dispositivo
                if (topic.endsWith('STATE')) {
                    const data = JSON.parse(payload);
                    const tasmotaTopic = topic.split('/')[1];
                    const device = await prisma.device.findUnique({ where: { tasmotaTopic } });
                    if (!device) return;
                    if (typeof data.POWER !== 'undefined') {
                        const isOn = data.POWER === 'ON';
                        await prisma.device.update({
                            where: { id: device.id },
                            data: { powerState: isOn }
                        });
                        console.log(`Status de powerState (STATE) atualizado para ${isOn} no device ${tasmotaTopic}`);
                    }
                }
            } catch (error) {
                console.error('Erro ao processar ou salvar mensagem MQTT:', error);
                console.log('Mensagem original que causou o erro:', payload);
            }
        });

        mqttClient.on('error', (err) => {
            console.error('Erro no cliente MQTT:', err);
        });

        mqttClient.on('close', () => {
            console.log('Conexão MQTT fechada.');
        });

        mqttClient.on('offline', () => {
            console.log('Cliente MQTT offline. Tentando reconectar...');
        });

        return mqttClient;

    } catch (error) {
        console.error('Erro ao inicializar cliente MQTT:', error);
        throw error;
    }
}

// Exporta o cliente Prisma para que possa ser usado em outros lugares (opcional, mas comum)
// module.exports.prisma = prisma; // Você pode adicionar isso se quiser acessar 'prisma' de outros arquivos

module.exports = {
    initializeMqttClient,
};