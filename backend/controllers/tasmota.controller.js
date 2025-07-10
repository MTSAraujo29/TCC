// backend/controllers/tasmota.controller.js
const tasmotaService = require("../services/tasmota.service");
const energyTotalManager = require("../services/energyTotalManager"); // NOVO: Importa o serviço de energia total
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");

async function enviarAlertaWhatsapp(numero, dispositivo, status) {
  try {
    await axios.post("https://mts29.app.n8n.cloud/webhook-test/sonoff-alerta", {
      number: numero,
      device: dispositivo,
      status: status,
    });
    console.log("Mensagem enviada ao n8n com sucesso!");
  } catch (error) {
    console.error(
      "Erro ao enviar mensagem ao n8n:",
      error.response?.data || error.message
    );
  }
}

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
      return res
        .status(404)
        .json({
          message:
            "Dispositivo não encontrado ou você não tem permissão para acessá-lo.",
        });
    }
    req.device = device; // Adiciona o dispositivo ao objeto de requisição para uso posterior
    next();
  } catch (error) {
    console.error("Erro no middleware getDevice:", error);
    res
      .status(500)
      .json({ message: "Erro interno do servidor ao verificar dispositivo." });
  }
}

// Adicionar um novo dispositivo Tasmota ao usuário
async function addDevice(req, res) {
  const { name, tasmotaTopic, macAddress, model, broker } = req.body;
  const userId = req.user.userId; // ID do usuário do token JWT

  if (!name || !tasmotaTopic || !broker) {
    return res
      .status(400)
      .json({ message: "Nome, Tópico Tasmota e Broker são obrigatórios." });
  }

  try {
    // Verifica se o tópico Tasmota já está em uso por QUALQUER usuário,
    // pois tópicos devem ser únicos na rede MQTT para evitar conflitos.
    const existingDeviceByTopic = await prisma.device.findUnique({
      where: { tasmotaTopic: tasmotaTopic },
    });

    if (existingDeviceByTopic) {
      if (existingDeviceByTopic.userId === userId) {
        return res
          .status(409)
          .json({
            message: "Este tópico Tasmota já está registrado para você.",
          });
      } else {
        return res
          .status(409)
          .json({
            message:
              "Este tópico Tasmota já está em uso por outro usuário. Verifique o tópico do seu dispositivo.",
          });
      }
    }

    const newDevice = await prisma.device.create({
      data: {
        name,
        tasmotaTopic,
        macAddress: macAddress || null,
        model: model || "Desconhecido",
        userId,
        powerState: false,
        lastSeen: null,
        ipAddress: null,
        broker, // Salva o broker
      },
    });
    res
      .status(201)
      .json({
        message: "Dispositivo adicionado com sucesso!",
        device: newDevice,
      });
  } catch (error) {
    console.error("Erro ao adicionar dispositivo:", error);
    res
      .status(500)
      .json({ message: "Erro interno do servidor ao adicionar dispositivo." });
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
        readings: {
          // Inclui a última leitura para exibição na lista
          orderBy: {
            timestamp: "desc",
          },
          take: 1,
        },
      },
    });

    // NOVO: Processar cada dispositivo para usar a nova lógica de energia total
    const formattedDevices = await Promise.all(
      devices.map(async (device) => {
        // Obter o valor atual de energia total para exibição (do banco)
        const currentTotalEnergyForDisplay =
          await energyTotalManager.getAccumulatedTotalEnergy(device.id);
        // Obter o valor em tempo real do cache
        const liveTotalEnergy = tasmotaService.getTotalEnergyFromCache(
          device.id
        );

        let latestReading =
          device.readings.length > 0 ? device.readings[0] : null;

        // Se há leitura, atualizar o totalEnergy com o valor em tempo real do cache, se existir
        if (latestReading) {
          latestReading = {
            ...latestReading,
            totalEnergy:
              typeof liveTotalEnergy === "number"
                ? liveTotalEnergy
                : currentTotalEnergyForDisplay,
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
      })
    );

    res.json(formattedDevices);
    console.log(
      `Leitura enviada para o frontend do ${device.broker} referente ao ${device.name}`
    );
  } catch (error) {
    console.error("Erro ao obter dispositivos do usuário:", error);
    res
      .status(500)
      .json({ message: "Erro interno do servidor ao obter dispositivos." });
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
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    // NOVO: Obter o valor atual de energia total para exibição
    const currentTotalEnergyForDisplay =
      await energyTotalManager.getAccumulatedTotalEnergy(device.id);

    let latestReading =
      deviceWithDetails.readings.length > 0
        ? deviceWithDetails.readings[0]
        : null;
    // Obter o valor em tempo real do cache
    const liveTotalEnergy = tasmotaService.getTotalEnergyFromCache(device.id);
    // Se há leitura, atualizar o totalEnergy com o valor em tempo real do cache, se existir
    if (latestReading) {
      latestReading = {
        ...latestReading,
        totalEnergy:
          typeof liveTotalEnergy === "number"
            ? liveTotalEnergy
            : currentTotalEnergyForDisplay,
      };
    }

    // Adiciona a última leitura diretamente ao objeto, se existir
    const formattedDevice = {
      ...deviceWithDetails,
      latestReading: latestReading,
      readings: undefined, // Remove o array readings original
    };

    res.json(formattedDevice);
    console.log(
      `Leitura enviada para o frontend do ${device.broker} referente ao ${device.name}`
    );
  } catch (error) {
    console.error("Erro ao obter detalhes do dispositivo:", error);
    res
      .status(500)
      .json({
        message: "Erro interno do servidor ao obter detalhes do dispositivo.",
      });
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
      orderBy: { timestamp: "desc" },
    });

    if (!reading) {
      return res
        .status(404)
        .json({
          message:
            "Nenhuma leitura de energia encontrada para este dispositivo.",
        });
    }

    // NOVO: Obter o valor atual de energia total para exibição
    const currentTotalEnergyForDisplay =
      await energyTotalManager.getAccumulatedTotalEnergy(device.id);

    // NOVO: Retornar a leitura com o totalEnergy atualizado
    const updatedReading = {
      ...reading,
      totalEnergy: currentTotalEnergyForDisplay, // Usar o valor acumulado atual
    };

    res.json(updatedReading);
    console.log(
      `Leitura enviada para o frontend do ${device.broker} referente ao ${device.name}`
    );
  } catch (error) {
    console.error("Erro ao obter última leitura de energia:", error);
    res
      .status(500)
      .json({
        message:
          "Erro interno do servidor ao obter a última leitura de energia.",
      });
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
      orderBy: { timestamp: "asc" }, // Para facilitar a visualização cronológica
    });
    res.json(readings);
  } catch (error) {
    console.error("Erro ao obter leituras históricas de energia:", error);
    res
      .status(500)
      .json({
        message: "Erro interno do servidor ao obter leituras históricas.",
      });
  }
}

// Publicar comando para o dispositivo Tasmota (ligar/desligar)
async function toggleDevicePower(req, res) {
  // req.device já foi preenchido pelo middleware getDevice
  const device = req.device;
  const { state } = req.body; // 'ON' ou 'OFF'

  if (!state || (state !== "ON" && state !== "OFF")) {
    return res
      .status(400)
      .json({ message: 'Estado inválido. Use "ON" ou "OFF".' });
  }

  try {
    if (!device) {
      console.error(
        "[toggleDevicePower] Dispositivo não encontrado no req.device!"
      );
      return res
        .status(404)
        .json({ message: "Dispositivo não encontrado no req.device." });
    }
    console.log(`[toggleDevicePower] Device:`, device);
    const topic = `cmnd/${device.tasmotaTopic}/POWER`;
    const command = state; // O comando é exatamente 'ON' ou 'OFF'
    const broker = device.broker || "broker1";
    console.log(
      `[toggleDevicePower] Enviando comando MQTT: ${topic} -> ${command} via ${broker}`
    );

    // O tasmotaService precisa ter a função publishMqttCommand exportada
    await tasmotaService.publishMqttCommand(topic, command, broker);

    if (state === "ON") {
      res.status(200).json({ message: "Dispositivo ligado com sucesso." });
    } else {
      res.status(200).json({ message: "Dispositivo desligado com sucesso." });
    }
    const { deviceName, newStatus } = req.body; // ajuste conforme sua lógica
    if (
      deviceName &&
      (deviceName.toLowerCase().includes("sala") ||
        deviceName.toLowerCase().includes("câmera"))
    ) {
      await enviarAlertaWhatsapp("5562999999999", deviceName, newStatus);
    }
  } catch (error) {
    console.error(
      "[toggleDevicePower] Erro ao alternar energia do dispositivo:",
      error
    );
    res
      .status(500)
      .json({
        message: "Erro interno do servidor ao alternar energia do dispositivo.",
        error: error.message,
      });
  }
}

// Função para retornar o valor de Energia Total diretamente do Tasmota (cache em memória)
async function getLiveTotalEnergyFromTasmota(req, res) {
  const { deviceId } = req.params;
  const userId = req.user.userId;
  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId, userId: userId },
    });
    if (!device) {
      return res.status(404).json({ message: "Dispositivo não encontrado." });
    }
    // Buscar do cache em memória do serviço Tasmota
    const totalEnergy =
      require("../services/tasmota.service").getTotalEnergyFromCache(deviceId);
    res.json({
      totalEnergy: typeof totalEnergy === "number" ? totalEnergy : 0,
    });
  } catch (error) {
    console.error("Erro ao buscar Energia Total do Tasmota:", error);
    res.status(500).json({ message: "Erro interno ao buscar Energia Total." });
  }
}

// Função para agendar desligamento de dispositivos
async function schedulePowerOff(req, res) {
  const { devices, days, repeat, time, timerNumber } = req.body;
  const userId = req.user.userId;

  console.log("[schedulePowerOff] Payload recebido:", {
    devices,
    days,
    repeat,
    time,
    timerNumber,
  });

  // Validação dos dados recebidos
  if (!devices || devices.length === 0) {
    return res
      .status(400)
      .json({ message: "Pelo menos um dispositivo deve ser selecionado." });
  }
  if (!days || days.length === 0) {
    return res
      .status(400)
      .json({ message: "Pelo menos um dia deve ser selecionado." });
  }
  if (!time) {
    return res.status(400).json({ message: "Horário é obrigatório." });
  }
  if (!timerNumber || timerNumber < 1 || timerNumber > 4) {
    return res
      .status(400)
      .json({ message: "Timer inválido. Escolha de 1 a 4." });
  }

  try {
    // Buscar os dispositivos do usuário
    const userDevices = await prisma.device.findMany({
      where: {
        userId: userId,
        tasmotaTopic: {
          in: devices.map((device) => {
            if (device === "sala") return "sonoff_sala";
            if (device === "camera") return "sonoff_camera";
            return device;
          }),
        },
      },
    });

    if (userDevices.length === 0) {
      return res
        .status(404)
        .json({
          message:
            "Nenhum dispositivo encontrado para os tópicos selecionados.",
        });
    }

    // Converter dias da semana para formato do Tasmota
    let tasmotaDaysMask = 0;
    if (repeat) {
      tasmotaDaysMask = 127; // Todos os dias (1111111 em binário)
    } else {
      days.forEach((dayIndex) => {
        const bitMask = 1 << dayIndex;
        tasmotaDaysMask |= bitMask;
      });
    }

    // Para cada dispositivo, enviar comando de agendamento para o timer correto
    const results = [];
    for (const device of userDevices) {
      try {
        const timerCommand = {
          Enable: 1,
          Mode: 0, // Timer
          Time: time,
          Window: 0,
          Days: tasmotaDaysMask,
          Repeat: repeat ? 1 : 0,
          Output: 1,
          Action: 0, // 0 = OFF, 1 = ON
        };
        // O slot do timer é Timer1, Timer2, Timer3, Timer4
        const topic = `cmnd/${device.tasmotaTopic}/Timer${timerNumber}`;
        const broker = device.broker || "broker1";
        await tasmotaService.publishMqttCommand(
          topic,
          JSON.stringify(timerCommand),
          broker
        );
        results.push({
          device: device.name,
          status: "success",
          message: `Agendamento configurado para ${device.name} no Timer ${timerNumber} às ${time}`,
        });
      } catch (error) {
        results.push({
          device: device.name,
          status: "error",
          message: `Erro ao agendar ${device.name}: ${error.message}`,
        });
      }
    }
    const successfulResults = results.filter((r) => r.status === "success");
    if (successfulResults.length === 0) {
      return res
        .status(500)
        .json({
          message: "Erro ao configurar agendamentos.",
          details: results,
        });
    }
    res
      .status(200)
      .json({
        message: "Agendamento configurado com sucesso!",
        details: results,
      });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Erro interno do servidor ao configurar agendamento.",
        error: error.message,
      });
  }
}

// Listar agendamentos do usuário autenticado
async function listSchedules(req, res) {
  try {
    const userId = req.user.userId;
    const schedules = await prisma.schedule.findMany({
      where: { userId },
      orderBy: [{ timerNumber: "asc" }, { createdAt: "desc" }],
    });
    res.json(schedules);
  } catch (error) {
    console.error("[listSchedules] Erro ao buscar agendamentos:", error);
    res.status(500).json({ message: "Erro ao buscar agendamentos." });
  }
}

// Criar agendamento (além de enviar para o Tasmota, salva no banco)
async function createSchedule(req, res) {
  const { devices, days, repeat, time, timerNumber } = req.body;
  const userId = req.user.userId;
  if (!devices || devices.length === 0) {
    return res
      .status(400)
      .json({ message: "Pelo menos um dispositivo deve ser selecionado." });
  }
  if (!days || days.length === 0) {
    return res
      .status(400)
      .json({ message: "Pelo menos um dia deve ser selecionado." });
  }
  if (!time) {
    return res.status(400).json({ message: "Horário é obrigatório." });
  }
  if (!timerNumber || timerNumber < 1 || timerNumber > 4) {
    return res
      .status(400)
      .json({ message: "Timer inválido. Escolha de 1 a 4." });
  }
  try {
    // Salvar no banco
    const schedule = await prisma.schedule.create({
      data: {
        userId,
        deviceIds: devices,
        days,
        repeat,
        time,
        timerNumber,
      },
    });
    // (Opcional) Chamar a lógica de envio para o Tasmota aqui, se necessário
    res
      .status(201)
      .json({ message: "Agendamento salvo com sucesso!", schedule });
  } catch (error) {
    console.error("[createSchedule] Erro ao criar agendamento:", error);
    res.status(500).json({ message: "Erro ao criar agendamento." });
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
  schedulePowerOff, // Nova função exportada
  listSchedules,
  createSchedule,
};
