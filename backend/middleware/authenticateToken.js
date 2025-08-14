const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;

async function authenticateToken(req, res, next) {
    console.log(`[AUTH] Iniciando autenticação para: ${req.method} ${req.path}`);
    
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log(`[AUTH] Auth header: ${authHeader ? 'Presente' : 'Ausente'}`);
    console.log(`[AUTH] Token extraído: ${token ? token.substring(0, 20) + '...' : 'Nenhum'}`);

    if (token == null) {
        console.log(`[AUTH] ❌ Token ausente - retornando 401`);
        return res.status(401).json({ message: 'Token de autenticação ausente.' });
    }

    if (!JWT_SECRET) {
        console.error(`[AUTH] ❌ JWT_SECRET não configurado!`);
        return res.status(500).json({ message: 'Erro de configuração do servidor.' });
    }

    console.log(`[AUTH] JWT_SECRET configurado: ${JWT_SECRET ? 'Sim' : 'Não'}`);

    try {
        console.log(`[AUTH] Verificando token JWT...`);
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log(`[AUTH] Token decodificado:`, decoded);

        if (!decoded.userId) {
            console.log(`[AUTH] ❌ Token não contém userId`);
            return res.status(403).json({ message: 'Token inválido - userId ausente.' });
        }

        console.log(`[AUTH] Buscando usuário no banco: ${decoded.userId}`);
        const dbUser = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, isAdmin: true }
        });

        if (!dbUser) {
            console.log(`[AUTH] ❌ Usuário não encontrado no banco: ${decoded.userId}`);
            return res.status(403).json({ message: 'Usuário não encontrado no banco de dados.' });
        }

        console.log(`[AUTH] ✅ Usuário autenticado com sucesso: ${dbUser.email}`);
        
        req.user = {
            userId: dbUser.id,
            email: dbUser.email,
            isAdmin: dbUser.isAdmin
        };
        
        next();
        
    } catch (jwtError) {
        console.error(`[AUTH] ❌ Erro na verificação JWT:`, jwtError);
        
        if (jwtError.name === 'TokenExpiredError') {
            console.log(`[AUTH] ❌ Token expirado`);
            return res.status(401).json({ message: 'Token expirado. Por favor, faça login novamente.' });
        } else if (jwtError.name === 'JsonWebTokenError') {
            console.log(`[AUTH] ❌ Token inválido: ${jwtError.message}`);
            return res.status(403).json({ message: 'Token inválido. Por favor, faça login novamente.' });
        } else {
            console.log(`[AUTH] ❌ Erro desconhecido: ${jwtError.message}`);
            return res.status(403).json({ message: 'Token inválido. Por favor, faça login novamente.' });
        }
    } catch (dbError) {
        console.error(`[AUTH] ❌ Erro de banco de dados:`, dbError);
        return res.status(500).json({ message: 'Erro interno do servidor ao autenticar.' });
    }
}

module.exports = authenticateToken;