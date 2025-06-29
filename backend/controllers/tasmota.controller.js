// backend/controllers/tasmota.controller.js
const tasmotaService = require('../services/tasmota.service');
const energyTotalManager = require('../services/energyTotalManager'); // NOVO: Importa o serviço de energia total
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// A função 'getDevice' é um bom middleware para rotas que precisam de um 'deviceId'
// Certifique-se de que ela seja usada nas rotas apropriadas em tasmotaRoutes.js.
async function getDevice(req, res, next) {
    const { deviceId } = req.params;
    const userId = req.user.userId; // ID do usuário do token JWT

    try {
        const device = await prisma.device.findUnique({
            where: { id: deviceId, userId: userId }, // Garante que o dispositivo pertence ao usuário
        });

        if (!device) {
            return res.status(404).json({ message: 'Dispositivo não encontrado ou você não tem permissão para acessá-lo.' });
        }
        req.device = device; // Adiciona o dispositivo ao objeto de requisição para uso posterior
        next();
    } catch (error) {
        console.error('Erro no middleware getDevice:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao verificar dispositivo.' });
    }
}


// Adicionar um novo dispositivo Tasmota ao usuário
async function addDevice(req, res) {
    const { name, tasmotaTopic, macAddress, model } = req.body;
    const userId = req.user.userId; // ID do usuário do token JWT

    if (!name || !tasmotaTopic) {
        return res.status(400).json({ message: 'Nome e Tópico Tasmota são obrigatórios.' });
    }

    try {
        // Verifica se o tópico Tasmota já está em uso por QUALQUER usuário,
        // pois tópicos devem ser únicos na rede MQTT para evitar conflitos.
        const existingDeviceByTopic = await prisma.device.findUnique({
            where: { tasmotaTopic: tasmotaTopic },
        });

        if (existingDeviceByTopic) {
            // Se o tópico já existe e pertence ao usuário atual, é um erro de duplicação.
            // Se o tópico existe e pertence a OUTRO usuário, é um conflito e não pode ser adicionado.
            if (existingDeviceByTopic.userId === userId) {
                return res.status(409).json({ message: 'Este tópico Tasmota já está registrado para você.' });
            } else {
                return res.status(409).json({ message: 'Este tópico Tasmota já está em uso por outro usuário. Verifique o tópico do seu dispositivo.' });
            }
        }

        // Agora, cria o dispositivo.
        // O `powerState` inicial pode ser `false` (desligado) ou `true` (se você quiser um padrão).
        // `lastSeen` e `ipAddress` podem ser nulos e serão preenchidos pela telemetria MQTT.
        const newDevice = await prisma.device.create({
            data: {
                name,
                tasmotaTopic,
                macAddress: macAddress || null, // Permite nulo se não fornecido
                model: model || 'Desconhecido', // Define um valor padrão
                userId,
                powerState: false, // Estado inicial
                lastSeen: null,
                ipAddress: null,
            },
        });
        res.status(201).json({ message: 'Dispositivo adicionado com sucesso!', device: newDevice });
    } catch (error) {
        console.error('Erro ao adicionar dispositivo:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao adicionar dispositivo.' });
    }
}

// Obter todos os dispositivos de um usuário
// Essa função já é usada em dashboard.controller.js, mas aqui é para uma API específica.
async function getUserDevices(req, res) {
    const userId = req.user.userId;
    try {
        const devices = await prisma.device.findMany({
            where: { userId: userId },
            include: {
                readings: { // Inclui a última leitura para exibição na lista
                    orderBy: {
                        timestamp: 'desc',
                    },
                    take: 1,
                },
            },
        });

        // NOVO: Processar cada dispositivo para usar a nova lógica de energia total
        const formattedDevices = await Promise.all(devices.map(async(device) => {
            // Obter o valor atual de energia total para exibição
            const currentTotalEnergyForDisplay = await energyTotalManager.getAccumulatedTotalEnergy(device.id);

            let latestReading = device.readings.length > 0 ? device.readings[0] : null;

            // NOVO: Se há leitura, atualizar o totalEnergy com o valor acumulado atual
            if (latestReading) {
                latestReading = {
                    ...latestReading,
                    totalEnergy: currentTotalEnergyForDisplay // Usar o valor acumulado atual
                };
            }

            return {
                id: device.id,
                name: device.name,
                tasmotaTopic: device.tasmotaTopic,
                macAddress: device.macAddress,
                model: device.model,
                powerState: device.powerState,
                lastSeen: device.lastSeen,
                ipAddress: device.ipAddress,
                latestReading: latestReading,
            };
        }));

        res.json(formattedDevices);
    } catch (error) {
        console.error('Erro ao obter dispositivos do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao obter dispositivos.' });
    }
}

// Obter informações detalhadas de um dispositivo (incluindo última leitura)
async function getDeviceDetails(req, res) {
    // req.device já foi preenchido pelo middleware getDevice
    const device = req.device;

    try {
        // Incluir a última leitura diretamente na query principal para ser mais eficiente
        const deviceWithDetails = await prisma.device.findUnique({
            where: { id: device.id },
            include: {
                readings: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                },
            },
        });

        // NOVO: Obter o valor atual de energia total para exibição
        const currentTotalEnergyForDisplay = await energyTotalManager.getAccumulatedTotalEnergy(device.id);

        let latestReading = deviceWithDetails.readings.length > 0 ? deviceWithDetails.readings[0] : null;

        // NOVO: Se há leitura, atualizar o totalEnergy com o valor acumulado atual
        if (latestReading) {
            latestReading = {
                ...latestReading,
                totalEnergy: currentTotalEnergyForDisplay // Usar o valor acumulado atual
            };
        }

        // Adiciona a última leitura diretamente ao objeto, se existir
        const formattedDevice = {
            ...deviceWithDetails,
            latestReading: latestReading,
            readings: undefined // Remove o array readings original
        };

        res.json(formattedDevice);
    } catch (error) {
        console.error('Erro ao obter detalhes do dispositivo:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao obter detalhes do dispositivo.' });
    }
}


// Obter a última leitura de energia de um dispositivo
// Esta função pode ser simplificada, pois getDeviceDetails já a inclui.
// Você pode decidir se quer manter uma rota separada para isso.
async function getLatestEnergyReading(req, res) {
    // req.device já foi preenchido pelo middleware getDevice
    const device = req.device; // Garante que o dispositivo pertence ao usuário

    try {
        const reading = await prisma.energyReading.findFirst({
            where: { deviceId: device.id },
            orderBy: { timestamp: 'desc' },
        });

        if (!reading) {
            return res.status(404).json({ message: 'Nenhuma leitura de energia encontrada para este dispositivo.' });
        }

        // NOVO: Obter o valor atual de energia total para exibição
        const currentTotalEnergyForDisplay = await energyTotalManager.getAccumulatedTotalEnergy(device.id);

        // NOVO: Retornar a leitura com o totalEnergy atualizado
        const updatedReading = {
            ...reading,
            totalEnergy: currentTotalEnergyForDisplay // Usar o valor acumulado atual
        };

        res.json(updatedReading);
    } catch (error) {
        console.error('Erro ao obter última leitura de energia:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao obter a última leitura de energia.' });
    }
}

// Obter leituras históricas de energia de um dispositivo
async function getHistoricalEnergyReadings(req, res) {
    // req.device já foi preenchido pelo middleware getDevice
    const device = req.device;
    const { days } = req.query; // Query parameter para número de dias

    const numDays = parseInt(days) || 7; // Padrão para 7 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - numDays);

    try {
        const readings = await prisma.energyReading.findMany({
            where: {
                deviceId: device.id,
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { timestamp: 'asc' }, // Para facilitar a visualização cronológica
        });
        res.json(readings);
    } catch (error) {
        console.error('Erro ao obter leituras históricas de energia:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao obter leituras históricas.' });
    }
}

// Publicar comando para o dispositivo Tasmota (ligar/desligar)
async function toggleDevicePower(req, res) {
    // req.device já foi preenchido pelo middleware getDevice
    const device = req.device;
    const { state } = req.body; // 'ON' ou 'OFF'

    if (!state || (state !== 'ON' && state !== 'OFF')) {
        return res.status(400).json({ message: 'Estado inválido. Use "ON" ou "OFF".' });
    }

    try {
        const topic = `cmnd/${device.tasmotaTopic}/POWER`;
        const command = state; // O comando é exatamente 'ON' ou 'OFF'

        // O tasmotaService precisa ter a função publishMqttCommand exportada
        await tasmotaService.publishMqttCommand(topic, command);

        // Opcional: Atualizar o powerState do Device no DB.
        // O ideal é que o tasmota.service.js, ao receber o status do Tasmota (stat/+/POWER),
        // atualize o powerState no DB. Mas para feedback mais rápido, pode-se fazer aqui.
        // Contudo, é mais seguro que o estado no DB reflita o estado REAL do dispositivo via MQTT.
        // Portanto, a linha abaixo é comentada, confiando na atualização via MQTT de telemetria.
        // await prisma.device.update({
        //     where: { id: device.id },
        //     data: { powerState: state === 'ON' }
        // });


        res.status(200).json({ message: `Comando '${state}' enviado com sucesso para ${device.name} (Tópico: ${topic}).` });
    } catch (error) {
        console.error('Erro ao alternar energia do dispositivo:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao alternar energia do dispositivo.' });
    }
}

// Função para retornar o valor de Energia Total diretamente do Tasmota (cache em memória)
async function getLiveTotalEnergyFromTasmota(req, res) {
    const { deviceId } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.isAdmin;
    if (!isAdmin) {
        return res.status(403).json({ message: 'Apenas administradores podem acessar este dado.' });
    }
    try {
        const device = await prisma.device.findUnique({ where: { id: deviceId, userId: userId } });
        if (!device) {
            return res.status(404).json({ message: 'Dispositivo não encontrado.' });
        }
        // Buscar do cache em memória do serviço Tasmota
        const totalEnergy = require('../services/tasmota.service').getTotalEnergyFromCache(deviceId);
        if (totalEnergy === null || typeof totalEnergy === 'undefined') {
            return res.status(404).json({ message: 'Valor de Energia Total não disponível no momento.' });
        }
        res.json({ totalEnergy });
    } catch (error) {
        console.error('Erro ao buscar Energia Total do Tasmota:', error);
        res.status(500).json({ message: 'Erro interno ao buscar Energia Total.' });
    }
}

// Exportar funções
module.exports = {
    getDevice, // Middleware para verificar posse do dispositivo (usado nas rotas)
    addDevice,
    getUserDevices,
    getDeviceDetails,
    getLatestEnergyReading,
    getHistoricalEnergyReadings,
    toggleDevicePower,
    getLiveTotalEnergyFromTasmota,
};