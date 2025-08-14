// Importa o cliente Prisma para acesso ao banco de dados
const { PrismaClient } = require("@prisma/client");
// Importa biblioteca para manipular e validar tokens JWT
const jwt = require("jsonwebtoken");
// Cria instância do Prisma para consultas no banco
const prisma = new PrismaClient();

// Chave secreta usada para assinar e validar tokens JWT (configurada no .env)
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware para autenticar requisições usando JWT.
 * Valida o token enviado no cabeçalho e adiciona informações do usuário à requisição.
 */
async function authenticateToken(req, res, next) {
  console.log(`[AUTH] Iniciando autenticação para: ${req.method} ${req.path}`);

  // Obtém o cabeçalho Authorization e extrai o token (Bearer <token>)
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log(`[AUTH] Auth header: ${authHeader ? "Presente" : "Ausente"}`);
  console.log(
    `[AUTH] Token extraído: ${
      token ? token.substring(0, 20) + "..." : "Nenhum"
    }`
  );

  // Se não houver token, retorna erro 401 (não autorizado)
  if (token == null) {
    console.log(`[AUTH] ❌ Token ausente - retornando 401`);
    return res.status(401).json({ message: "Token de autenticação ausente." });
  }

  // Se a chave JWT não estiver configurada, retorna erro 500
  if (!JWT_SECRET) {
    console.error(`[AUTH] ❌ JWT_SECRET não configurado!`);
    return res
      .status(500)
      .json({ message: "Erro de configuração do servidor." });
  }

  console.log(`[AUTH] JWT_SECRET configurado: ${JWT_SECRET ? "Sim" : "Não"}`);

  try {
    console.log(`[AUTH] Verificando token JWT...`);
    // Decodifica e valida o token usando a chave secreta
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log(`[AUTH] Token decodificado:`, decoded);

    // Verifica se o token contém o ID do usuário
    if (!decoded.userId) {
      console.log(`[AUTH] ❌ Token não contém userId`);
      return res
        .status(403)
        .json({ message: "Token inválido - userId ausente." });
    }

    // Busca o usuário no banco usando o ID do token
    console.log(`[AUTH] Buscando usuário no banco: ${decoded.userId}`);
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, isAdmin: true },
    });

    // Se o usuário não for encontrado no banco, retorna erro 403
    if (!dbUser) {
      console.log(
        `[AUTH] ❌ Usuário não encontrado no banco: ${decoded.userId}`
      );
      return res
        .status(403)
        .json({ message: "Usuário não encontrado no banco de dados." });
    }

    console.log(`[AUTH] ✅ Usuário autenticado com sucesso: ${dbUser.email}`);

    // Anexa os dados do usuário autenticado à requisição
    req.user = {
      userId: dbUser.id,
      email: dbUser.email,
      isAdmin: dbUser.isAdmin,
    };

    // Continua para o próximo middleware/rota
    next();
  } catch (error) {
    console.error(`[AUTH] ❌ Erro na autenticação:`, error);

    // Trata erros específicos de JWT
    if (error.name === "TokenExpiredError") {
      console.log(`[AUTH] ❌ Token expirado`);
      return res
        .status(401)
        .json({ message: "Token expirado. Por favor, faça login novamente." });
    } else if (error.name === "JsonWebTokenError") {
      console.log(`[AUTH] ❌ Token inválido: ${error.message}`);
      return res
        .status(403)
        .json({ message: "Token inválido. Por favor, faça login novamente." });
    } else {
      // Erros inesperados (banco de dados ou outros)
      console.log(`[AUTH] ❌ Erro desconhecido: ${error.message}`);
      return res
        .status(500)
        .json({ message: "Erro interno do servidor ao autenticar." });
    }
  }
}

// Exporta o middleware para uso em outras partes do sistema
module.exports = authenticateToken;
