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
            // Obter o valor atual de energia total para exibição (do banco)
            const currentTotalEnergyForDisplay = await energyTotalManager.getAccumulatedTotalEnergy(device.id);
            // Obter o valor em tempo real do cache
            const liveTotalEnergy = tasmotaService.getTotalEnergyFromCache(device.id);

            let latestReading = device.readings.length > 0 ? device.readings[0] : null;

            // Se há leitura, atualizar o totalEnergy com o valor em tempo real do cache, se existir
            if (latestReading) {
                latestReading = {
                    ...latestReading,
                    totalEnergy: typeof liveTotalEnergy === 'number' ? liveTotalEnergy : currentTotalEnergyForDisplay
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
        console.log(`Leitura enviada para o frontend do ${device.broker} referente ao ${device.name}`);
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
        // Obter o valor em tempo real do cache
        const liveTotalEnergy = tasmotaService.getTotalEnergyFromCache(device.id);
        // Se há leitura, atualizar o totalEnergy com o valor em tempo real do cache, se existir
        if (latestReading) {
            latestReading = {
                ...latestReading,
                totalEnergy: typeof liveTotalEnergy === 'number' ? liveTotalEnergy : currentTotalEnergyForDisplay
            };
        }

        // Adiciona a última leitura diretamente ao objeto, se existir
        const formattedDevice = {
            ...deviceWithDetails,
            latestReading: latestReading,
            readings: undefined // Remove o array readings original
        };

        res.json(formattedDevice);
        console.log(`Leitura enviada para o frontend do ${device.broker} referente ao ${device.name}`);
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
        console.log(`Leitura enviada para o frontend do ${device.broker} referente ao ${device.name}`);
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
    try {
        const device = await prisma.device.findUnique({ where: { id: deviceId, userId: userId } });
        if (!device) {
            return res.status(404).json({ message: 'Dispositivo não encontrado.' });
        }
        // Buscar do cache em memória do serviço Tasmota
        const totalEnergy = require('../services/tasmota.service').getTotalEnergyFromCache(deviceId);
        res.json({ totalEnergy: typeof totalEnergy === 'number' ? totalEnergy : 0 });
    } catch (error) {
        console.error('Erro ao buscar Energia Total do Tasmota:', error);
        res.status(500).json({ message: 'Erro interno ao buscar Energia Total.' });
    }
}

// Criar agendamento ao agendar desligamento
async function scheduleShutdown(req, res) {
    const { device, day, time, repeat } = req.body;
    const userId = req.user.userId;
    try {
        // Buscar dispositivos conforme seleção
        let devicesToSchedule = [];
        if (device === 'sala' || device === 'ambos') {
            const sala = await prisma.device.findFirst({ where: { name: { contains: 'Sala' } } });
            if (sala) devicesToSchedule.push(sala);
        }
        if (device === 'camera' || device === 'ambos') {
            const camera = await prisma.device.findFirst({ where: { name: { contains: 'Câmera' } } });
            if (camera) devicesToSchedule.push(camera);
        }
        if (devicesToSchedule.length === 0) {
            return res.status(404).json({ message: 'Dispositivo não encontrado.' });
        }
        // Montar comando de timer para Tasmota
        const daysMap = {
            'domingo': '1000000',
            'segunda': '0100000',
            'terca': '0010000',
            'quarta': '0001000',
            'quinta': '0000100',
            'sexta': '0000010',
            'sabado': '0000001',
            'todos': '1111111'
        };
        const daysStr = daysMap[day] || '1111111';
        const timerPayload = {
            Enable: 1,
            Time: time,
            Days: daysStr,
            Repeat: repeat ? 1 : 0,
            Mode: 0, // Timer absoluto
            Action: 0 // 0 = desligar
        };
        // Enviar comando para cada dispositivo e salvar agendamento
        for (const dev of devicesToSchedule) {
            const topic = `cmnd/${dev.tasmotaTopic}/Timer1`;
            await tasmotaService.publishMqttCommand(topic, JSON.stringify(timerPayload), dev.broker || 'broker1');
            // Salvar agendamento no banco
            await prisma.schedule.create({
                data: {
                    userId,
                    deviceId: dev.id,
                    day,
                    time,
                    repeat,
                    status: 'ativo',
                }
            });
        }
        // Se for "ambos", deviceId pode ser null para indicar ambos (opcional)
        res.json({ message: 'Agendamento enviado e salvo.' });
    } catch (error) {
        console.error('Erro ao agendar desligamento:', error);
        res.status(500).json({ message: 'Erro ao agendar desligamento.' });
    }
}

// Listar agendamentos do usuário
async function listUserSchedules(req, res) {
    const userId = req.user.userId;
    try {
        const now = new Date();
        // Buscar agendamentos ativos do usuário
        const schedules = await prisma.schedule.findMany({
            where: {
                userId,
                status: 'ativo',
            },
            include: { device: true },
            orderBy: { createdAt: 'desc' }
        });
        // Calcular tempo restante para execução (para não recorrentes)
        const result = schedules.map(sch => {
            let nextExecution = null;
            if (!sch.repeat) {
                // Calcular próxima execução baseada no dia e hora
                const [hh, mm] = sch.time.split(':').map(Number);
                let target = new Date(now);
                // Se for para hoje ou para o próximo dia da semana
                if (sch.day === 'todos') {
                    target.setHours(hh, mm, 0, 0);
                    if (target < now) target.setDate(target.getDate() + 1);
                } else {
                    // Encontrar o próximo dia da semana
                    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
                    const targetDay = dias.indexOf(sch.day);
                    let daysToAdd = (targetDay - now.getDay() + 7) % 7;
                    if (daysToAdd === 0 && (hh < now.getHours() || (hh === now.getHours() && mm <= now.getMinutes()))) {
                        daysToAdd = 7;
                    }
                    target.setDate(target.getDate() + daysToAdd);
                    target.setHours(hh, mm, 0, 0);
                }
                nextExecution = target;
            }
            return {
                id: sch.id,
                deviceName: sch.device ? sch.device.name : 'Ambos',
                day: sch.day,
                time: sch.time,
                repeat: sch.repeat,
                createdAt: sch.createdAt,
                nextExecution,
                status: sch.status
            };
        });
        res.json(result);
    } catch (error) {
        console.error('Erro ao listar agendamentos:', error);
        res.status(500).json({ message: 'Erro ao listar agendamentos.' });
    }
}

// Cancelar agendamento pelo id
async function cancelSchedule(req, res) {
    const userId = req.user.userId;
    const { id } = req.params;
    try {
        const schedule = await prisma.schedule.findUnique({ where: { id } });
        if (!schedule || schedule.userId !== userId) {
            return res.status(404).json({ message: 'Agendamento não encontrado.' });
        }
        await prisma.schedule.update({ where: { id }, data: { status: 'cancelado' } });
        res.json({ message: 'Agendamento cancelado com sucesso.' });
    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        res.status(500).json({ message: 'Erro ao cancelar agendamento.' });
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
    scheduleShutdown,
    listUserSchedules,
    cancelSchedule,
};