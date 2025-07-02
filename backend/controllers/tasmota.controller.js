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
    const { name, tasmotaTopic, macAddress, model, broker } = req.body;
    const userId = req.user.userId; // ID do usuário do token JWT

    if (!name || !tasmotaTopic || !broker) {
        return res.status(400).json({ message: 'Nome, Tópico Tasmota e Broker são obrigatórios.' });
    }

    try {
        // Verifica se o tópico Tasmota já está em uso por QUALQUER usuário,
        // pois tópicos devem ser únicos na rede MQTT para evitar conflitos.
        const existingDeviceByTopic = await prisma.device.findUnique({
            where: { tasmotaTopic: tasmotaTopic },
        });

        if (existingDeviceByTopic) {
            if (existingDeviceByTopic.userId === userId) {
                return res.status(409).json({ message: 'Este tópico Tasmota já está registrado para você.' });
            } else {
                return res.status(409).json({ message: 'Este tópico Tasmota já está em uso por outro usuário. Verifique o tópico do seu dispositivo.' });
            }
        }

        const newDevice = await prisma.device.create({
            data: {
                name,
                tasmotaTopic,
                macAddress: macAddress || null,
                model: model || 'Desconhecido',
                userId,
                powerState: false,
                lastSeen: null,
                ipAddress: null,
                broker, // Salva o broker
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
        if (!device) {
            console.error('[toggleDevicePower] Dispositivo não encontrado no req.device!');
            return res.status(404).json({ message: 'Dispositivo não encontrado no req.device.' });
        }
        console.log(`[toggleDevicePower] Device:`, device);
        const topic = `cmnd/${device.tasmotaTopic}/POWER`;
        const command = state; // O comando é exatamente 'ON' ou 'OFF'
        const broker = device.broker || 'broker1';
        console.log(`[toggleDevicePower] Enviando comando MQTT: ${topic} -> ${command} via ${broker}`);

        // O tasmotaService precisa ter a função publishMqttCommand exportada
        await tasmotaService.publishMqttCommand(topic, command, broker);

        if (state === 'ON') {
            res.status(200).json({ message: 'Dispositivo ligado com sucesso.' });
        } else {
            res.status(200).json({ message: 'Dispositivo desligado com sucesso.' });
        }
    } catch (error) {
        console.error('[toggleDevicePower] Erro ao alternar energia do dispositivo:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao alternar energia do dispositivo.', error: error.message });
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

// NOVA FUNÇÃO: Duplicar dispositivos para outro usuário
async function duplicateDevicesToUser(req, res) {
    const { targetUserId, deviceIds } = req.body;
    const sourceUserId = req.user.userId; // ID do usuário que está fazendo a duplicação

    if (!targetUserId || !deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
        return res.status(400).json({
            message: 'ID do usuário de destino e lista de IDs dos dispositivos são obrigatórios.'
        });
    }

    try {
        // Verificar se o usuário de destino existe
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId }
        });

        if (!targetUser) {
            return res.status(404).json({ message: 'Usuário de destino não encontrado.' });
        }

        // Verificar se o usuário atual é admin ou se está duplicando para si mesmo
        const currentUser = await prisma.user.findUnique({
            where: { id: sourceUserId }
        });

        if (!currentUser.isAdmin && sourceUserId !== targetUserId) {
            return res.status(403).json({
                message: 'Você não tem permissão para duplicar dispositivos para outros usuários.'
            });
        }

        // Buscar os dispositivos que serão duplicados
        const devicesToDuplicate = await prisma.device.findMany({
            where: {
                id: { in: deviceIds },
                userId: sourceUserId
            }
        });

        console.log('[DUPLICAÇÃO] Dispositivos a serem duplicados:', devicesToDuplicate.map(d => ({ id: d.id, tasmotaTopic: d.tasmotaTopic, name: d.name })));

        // Verificar se algum dos dispositivos já existe para o usuário de destino
        const existingDevices = await prisma.device.findMany({
            where: {
                tasmotaTopic: { in: devicesToDuplicate.map(d => d.tasmotaTopic) },
                userId: targetUserId
            }
        });

        console.log('[DUPLICAÇÃO] Dispositivos já existentes para o usuário de destino:', existingDevices.map(d => ({ id: d.id, tasmotaTopic: d.tasmotaTopic, name: d.name })));

        if (existingDevices.length > 0) {
            const existingTopics = existingDevices.map(d => d.tasmotaTopic);
            return res.status(409).json({
                message: `Os seguintes dispositivos já existem para o usuário de destino: ${existingTopics.join(', ')}`
            });
        }

        // Duplicar os dispositivos
        const duplicatedDevices = [];
        for (const device of devicesToDuplicate) {
            try {
                const newDevice = await prisma.device.create({
                    data: {
                        name: device.name,
                        tasmotaTopic: device.tasmotaTopic,
                        macAddress: device.macAddress,
                        model: device.model,
                        userId: targetUserId,
                        powerState: device.powerState,
                        lastSeen: device.lastSeen,
                        ipAddress: device.ipAddress,
                        lastSavedTotalEnergy: device.lastSavedTotalEnergy,
                        broker: device.broker,
                    }
                });
                duplicatedDevices.push(newDevice);
            } catch (err) {
                // Captura erro de unique constraint e retorna mensagem amigável
                if (err.code === 'P2002') {
                    return res.status(409).json({
                        message: `O dispositivo com tópico ${device.tasmotaTopic} já existe para o usuário de destino.`
                    });
                } else {
                    throw err;
                }
            }
        }

        console.log(`Dispositivos duplicados do usuário ${sourceUserId} para o usuário ${targetUserId}:`,
            duplicatedDevices.map(d => d.name));

        res.status(201).json({
            message: `${duplicatedDevices.length} dispositivo(s) duplicado(s) com sucesso!`,
            duplicatedDevices: duplicatedDevices.map(d => ({
                id: d.id,
                name: d.name,
                tasmotaTopic: d.tasmotaTopic,
                broker: d.broker
            }))
        });

    } catch (error) {
        console.error('Erro ao duplicar dispositivos:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao duplicar dispositivos.' });
    }
}

// NOVA FUNÇÃO: Listar usuários (apenas para admins)
async function listUsers(req, res) {
    const userId = req.user.userId;

    try {
        // Verificar se o usuário atual é admin
        const currentUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!currentUser.isAdmin) {
            return res.status(403).json({
                message: 'Você não tem permissão para listar usuários.'
            });
        }

        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                isAdmin: true,
                createdAt: true,
                _count: {
                    select: {
                        devices: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json(users);

    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao listar usuários.' });
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
    duplicateDevicesToUser,
    listUsers,
};