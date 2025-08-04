/**
 * Sistema de Monitoramento de Energia - Backend API
 * 
 * Este é o arquivo principal do servidor Express que gerencia:
 * - Autenticação de usuários (JWT)
 * - Rotas modulares para dashboard e dispositivos Tasmota
 * - Configurações de segurança e CORS
 * - Integração com banco de dados Prisma
 * - Inicialização do cliente MQTT para dispositivos IoT
 * 
 * @author TCC Project
 * @version 1.0.0
 */

// === DEPENDÊNCIAS E IMPORTAÇÕES ===
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const mqtt = require("mqtt");
const tasmotaService = require("../services/tasmota.service");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const winston = require("winston");

// Carrega variáveis de ambiente (compatibilidade local/produção)
require("dotenv").config();

// === CONFIGURAÇÕES GLOBAIS ===
const prisma = new PrismaClient();
const app = express();

// Validação de variáveis críticas
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    "ERRO: JWT_SECRET não está definido nas variáveis de ambiente! Por favor, configure-o no Render."
  );
}

// Configuração para proxy (necessário em produção)
app.set("trust proxy", 1);

// === MIDDLEWARES GLOBAIS ===
app.use(express.json());

// Configuração CORS - permite comunicação entre frontend e backend
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

// Sistema de logging estruturado
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// === MIDDLEWARE DE AUTENTICAÇÃO ===
/**
 * Middleware para validação de tokens JWT
 * Verifica se o usuário está autenticado e autorizado
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object  
 * @param {Function} next - Next middleware function
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    return res.status(401).json({ message: "Token de autenticação ausente." });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      console.error("Erro de verificação JWT:", err.message);
      if (err.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({
            message: "Token expirado. Por favor, faça login novamente.",
          });
      }
      return res
        .status(403)
        .json({ message: "Token inválido. Por favor, faça login novamente." });
    }

    try {
      // Valida se o usuário ainda existe no banco de dados
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { id: true, email: true, isAdmin: true },
      });

      if (!dbUser) {
        return res
          .status(403)
          .json({ message: "Usuário não encontrado no banco de dados." });
      }

      req.user = {
        userId: dbUser.id,
        email: dbUser.email,
        isAdmin: dbUser.isAdmin,
      };
      next();
    } catch (dbError) {
      console.error("Erro ao buscar usuário no DB para autenticação:", dbError);
      return res
        .status(500)
        .json({ message: "Erro interno do servidor ao autenticar." });
    }
  });
}

// === ROTAS MODULARES ===
// Importação das rotas organizadas por funcionalidade
const tasmotaRoutes = require("../routes/tasmotaRoutes");
app.use("/api/tasmota", tasmotaRoutes);

const dashboardRoutes = require("../routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

// === ROTAS DE SISTEMA ===
// Health check para monitoramento de status
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Rota inicial informativa
app.get("/", (req, res) => {
  res.send("Servidor Rodando 🚀");
});

// === CONFIGURAÇÃO DE RATE LIMITING ===
// Proteção contra ataques de força bruta em autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Máximo 5 tentativas por IP
  message: {
    message:
      "Muitas tentativas de login/registro. Tente novamente em 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// === ROTAS DE AUTENTICAÇÃO ===

/**
 * Rota para registro de novos usuários
 * Inclui validação de dados e criptografia de senha
 */
app.post(
  "/api/register",
  authLimiter,
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("email").isEmail().withMessage("Email inválido.").normalizeEmail(),
    body("password")
      .isLength({ min: 6 })
      .withMessage("A senha deve ter pelo menos 6 caracteres."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({
          message: "Todos os campos (Nome, Email, Senha) são obrigatórios.",
        });
    }

    try {
      // Verifica se email já está em uso
      const existingUser = await prisma.user.findUnique({
        where: { email: email },
      });

      if (existingUser) {
        return res
          .status(409)
          .json({
            message: "Este email já está registrado. Por favor, faça login.",
          });
      }

      // Criptografa a senha antes de salvar
      const hashedPassword = await bcrypt.hash(password, 10);

      // Cria novo usuário (admin definido por email específico)
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
      res
        .status(500)
        .json({
          message:
            "Erro interno do servidor ao tentar registrar. Tente novamente mais tarde.",
        });
    }
  }
);

/**
 * Rota para autenticação de usuários
 * Gera token JWT válido por 1 hora
 */
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
      // Busca usuário no banco de dados
      const user = await prisma.user.findUnique({
        where: { email: email },
      });

      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas." });
      }

      // Verifica se a senha está correta
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Credenciais inválidas." });
      }

      // Gera token JWT com expiração de 1 hora
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
      res
        .status(500)
        .json({
          message:
            "Erro interno do servidor ao tentar fazer login. Tente novamente mais tarde.",
        });
    }
  }
);

// === GERENCIAMENTO DE CONTA ===

/**
 * Atualiza dados da conta do usuário autenticado
 * Permite alterar nome e/ou senha
 */
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

/**
 * Remove conta do usuário e todos os dados associados
 * Operação irreversível que limpa dispositivos e leituras
 */
app.delete("/api/account", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  
  try {
    // Remove dados em cascata: leituras -> dispositivos -> usuário
    await prisma.energyReading.deleteMany({ where: { device: { userId } } });
    await prisma.device.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    
    res.json({ message: "Conta excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    res.status(500).json({ message: "Erro interno ao excluir conta." });
  }
});

// === INICIALIZAÇÃO DE SERVIÇOS ===
// Inicializa conexões MQTT para comunicação com dispositivos IoT
tasmotaService.initializeMqttClients();

// === TRATAMENTO GLOBAL DE ERROS ===
/**
 * Middleware global para captura e logging de erros
 * Registra erros detalhados e retorna resposta padronizada
 */
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    user: req.user || null,
  });
  res.status(500).json({ message: "Erro interno do servidor." });
});

// === INICIALIZAÇÃO DO SERVIDOR ===
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
