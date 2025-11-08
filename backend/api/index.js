// TCC Site/backend/api/index.js
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const mqtt = require("mqtt"); // Importa o módulo MQTT
// Importa o serviço MQTT, ajustando o caminho para o nível correto
const tasmotaService = require("../services/tasmota.service");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const winston = require("winston");
const authenticateToken = require("../middleware/authenticateToken");

// Carrega as variáveis de ambiente. No Render, elas são injetadas diretamente.
// Esta linha é mantida por compatibilidade ou para uso em outros ambientes.
require("dotenv").config();

// --- Instância Global do Prisma ---
const prisma = new PrismaClient();

// Teste de conexão com o banco
prisma
  .$connect()
  .then(() => {
    console.log("✅ Conectado ao banco de dados MongoDB via Prisma");
  })
  .catch((error) => {
    console.error("❌ Erro ao conectar ao banco de dados:", error);
  });

// Configurações de segurança
const JWT_SECRET = process.env.JWT_SECRET;
console.log(`[CONFIG] JWT_SECRET configurado: ${JWT_SECRET ? "Sim" : "Não"}`);
if (JWT_SECRET) {
  console.log(`[CONFIG] JWT_SECRET tamanho: ${JWT_SECRET.length} caracteres`);
  console.log(`[CONFIG] JWT_SECRET início: ${JWT_SECRET.substring(0, 10)}...`);
}

if (!JWT_SECRET) {
  console.error(
    "ERRO: JWT_SECRET não está definido nas variáveis de ambiente! Por favor, configure-o no Render."
  );
}

// Log de todas as variáveis de ambiente para debug
console.log(`[CONFIG] Variáveis de ambiente disponíveis:`);
console.log(`[CONFIG] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[CONFIG] PORT: ${process.env.PORT}`);
console.log(
  `[CONFIG] DATABASE_URL: ${
    process.env.DATABASE_URL ? "Configurado" : "Não configurado"
  }`
);
console.log(
  `[CONFIG] FRONTEND_URL: ${process.env.FRONTEND_URL || "Não configurado"}`
);
console.log(
  `[CONFIG] MQTT_HOST: ${
    process.env.MQTT_HOST ? "Configurado" : "Não configurado"
  }`
);

const app = express();
app.set("trust proxy", 1); // Necessário para identificar IP real atrás de proxy (Render)

// Middlewares
app.use(express.json());
app.use(helmet());

// Middleware de logging para todas as requisições
app.use((req, res, next) => {
  // Log apenas para requisições que não são health check
  if (req.path !== "/health") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// --- CONFIGURAÇÃO CORS ---
// A URL do frontend no Netlify será passada para o Render como uma variável de ambiente (FRONTEND_URL).
// Durante o desenvolvimento local do frontend, usará 'http://localhost:3000'.
const ALLOWED_ORIGIN =
  process.env.FRONTEND_URL || "https://smartenergytcc.com.br";

console.log("Origem permitida para CORS:", ALLOWED_ORIGIN);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requisições sem origem (como apps mobile ou Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Permitir a origem configurada
      if (origin === ALLOWED_ORIGIN) {
        return callback(null, true);
      }

      // Log apenas para origens bloqueadas
      console.log(`[CORS] Origem bloqueada: ${origin}`);
      return callback(new Error("Não permitido pelo CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Configuração do logger Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// =========================================================================
// Middleware de Autenticação JWT
// =========================================================================

// =========================================================================
// Importação e Uso das Rotas Modularizadas
// =========================================================================

// As rotas agora estão no mesmo nível que 'api', então o caminho é "../routes/..."
const tasmotaRoutes = require("../routes/tasmotaRoutes");
app.use("/api/tasmota", tasmotaRoutes);

const dashboardRoutes = require("../routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

// =========================================================================
// Rotas de Autenticação (Registro e Login)
// =========================================================================

// Rota de saúde (health check)
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Rota inicial
app.get("/", (req, res) => {
  res.send("Servidor Rodando 🚀");
});

// Rate limiting para rotas de autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Aumentado para 10 tentativas por IP
  message: {
    message:
      "Muitas tentativas de login/registro. Tente novamente em 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não contar requisições bem-sucedidas
  skipFailedRequests: false, // Contar requisições que falharam
});

// Rotas de autenticação com rate limit e validação
app.post(
  "/api/register",
  authLimiter,
  [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Nome é obrigatório.")
      .isLength({ min: 2, max: 100 })
      .withMessage("Nome deve ter entre 2 e 100 caracteres."),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email é obrigatório.")
      .isEmail()
      .withMessage("Formato de email inválido.")
      .normalizeEmail()
      .isLength({ max: 255 })
      .withMessage("Email muito longo."),
    body("password")
      .notEmpty()
      .withMessage("Senha é obrigatória.")
      .isLength({ min: 6, max: 100 })
      .withMessage("Senha deve ter entre 6 e 100 caracteres."),
  ],
  async (req, res) => {
    console.log("Dados recebidos na API:", req.body); // Log para debug

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ Erros de validação encontrados:");
      errors.array().forEach((error, index) => {
        console.log(
          `  ${index + 1}. Campo: ${error.path}, Valor: ${error.value}, Erro: ${
            error.msg
          }`
        );
      });

      return res.status(400).json({
        message: "Dados inválidos",
        errors: errors.array(),
      });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      console.log("Campos obrigatórios ausentes:", {
        name: !!name,
        email: !!email,
        password: !!password,
      }); // Log para debug
      return res.status(400).json({
        message: "Todos os campos (Nome, Email, Senha) são obrigatórios.",
      });
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: email },
      });

      if (existingUser) {
        return res.status(409).json({
          message: "Este email já está registrado. Por favor, faça login.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await prisma.user.create({
        data: {
          name: name,
          email: email,
          password: hashedPassword,
          isAdmin: email === "admin123@gmail.com",
        },
      });

      res.status(201).json({
        message: "Conta criada com sucesso!",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          isAdmin: newUser.isAdmin,
        },
      });
    } catch (error) {
      console.error("Erro ao registrar usuário:", error);
      res.status(500).json({
        message:
          "Erro interno do servidor ao tentar registrar. Tente novamente mais tarde.",
      });
    }
  }
);

app.post(
  "/api/login",
  authLimiter,
  [
    body("email").isEmail().withMessage("Email inválido.").normalizeEmail(),
    body("password").notEmpty().withMessage("Senha é obrigatória."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email e Senha são obrigatórios." });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: email },
      });

      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas." });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(401).json({ message: "Credenciais inválidas." });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      res.json({
        message: "Login bem-sucedido!",
        token: token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error) {
      console.error("Erro ao fazer login do usuário:", error);
      res.status(500).json({
        message:
          "Erro interno do servidor ao tentar fazer login. Tente novamente mais tarde.",
      });
    }
  }
);

// =========================================================================
// Rotas de Conta do Usuário (Editar e Excluir)
// =========================================================================

// Editar nome e/ou senha da conta
app.put("/api/account", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { name, password } = req.body;
  if (!name && !password) {
    return res
      .status(400)
      .json({ message: "Informe um novo nome ou nova senha." });
  }
  try {
    const updateData = {};
    if (name) updateData.name = name;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
    res.json({ message: "Dados da conta atualizados com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);
    res.status(500).json({ message: "Erro interno ao atualizar conta." });
  }
});

// Excluir conta do usuário
app.delete("/api/account", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    // Remove todos os dispositivos e leituras do usuário antes de remover o usuário
    await prisma.energyReading.deleteMany({ where: { device: { userId } } });
    await prisma.device.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: "Conta excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    res.status(500).json({ message: "Erro interno ao excluir conta." });
  }
});

// =========================================================================
// Inicialização do Cliente MQTT
// =========================================================================
// Esta função será chamada uma vez quando o processo Node.js for iniciado no Render.
tasmotaService.initializeMqttClients();

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
  console.error("❌ Erro capturado pelo middleware global:", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    user: req.user || null,
  });

  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    user: req.user || null,
  });

  // Se for erro de CORS, retornar 403
  if (err.message === "Não permitido pelo CORS") {
    return res.status(403).json({
      message: "Acesso negado. Verifique a origem da requisição.",
      error: "CORS_ERROR",
    });
  }

  res.status(500).json({ message: "Erro interno do servidor." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
