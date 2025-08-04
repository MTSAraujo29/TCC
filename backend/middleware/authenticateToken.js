/**
 * Middleware de Autenticação JWT
 * 
 * Este middleware é responsável por:
 * - Validar tokens JWT em requisições protegidas
 * - Verificar se o usuário ainda existe no banco de dados
 * - Anexar informações do usuário ao objeto de requisição
 * - Gerenciar diferentes tipos de erros de token
 * 
 * @module AuthenticationMiddleware
 * @requires @prisma/client
 * @requires jsonwebtoken
 */

const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

// === CONFIGURAÇÃO ===
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware para autenticação de rotas protegidas
 * 
 * Extrai e valida o token JWT do header Authorization,
 * verifica sua validade e existência do usuário no banco.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 * 
 * @returns {void} Chama next() se autenticado ou retorna erro HTTP
 */
async function authenticateToken(req, res, next) {
    // Extrai token do header Authorization (formato: "Bearer <token>")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Verifica presença do token
    if (token == null) {
        return res.status(401).json({ message: 'Token de autenticação ausente.' });
    }

    // Valida e decodifica o token JWT
    jwt.verify(token, JWT_SECRET, async(err, user) => {
        if (err) {
            // Tratamento específico para token expirado
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    message: 'Token expirado. Por favor, faça login novamente.' 
                });
            }
            // Outros erros de token (inválido, malformado, etc.)
            return res.status(403).json({ 
                message: 'Token inválido. Por favor, faça login novamente.' 
            });
        }

        try {
            // Verifica se o usuário ainda existe no banco de dados
            // Importante para casos onde o usuário foi removido após gerar o token
            const dbUser = await prisma.user.findUnique({
                where: { id: user.userId },
                select: { id: true, email: true, isAdmin: true }
            });

            if (!dbUser) {
                return res.status(403).json({ 
                    message: 'Usuário não encontrado no banco de dados.' 
                });
            }

            // Anexa informações do usuário ao objeto de requisição
            // para uso em middlewares e rotas subsequentes
            req.user = {
                userId: dbUser.id,
                email: dbUser.email,
                isAdmin: dbUser.isAdmin
            };
            
            next(); // Prossegue para o próximo middleware/rota
        } catch (dbError) {
            console.error('Erro de banco ao validar usuário:', dbError);
            return res.status(500).json({ 
                message: 'Erro interno do servidor ao autenticar.' 
            });
        }
    });
}

module.exports = authenticateToken;