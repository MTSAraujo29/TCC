const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Token de autenticação ausente.' });
    }

    jwt.verify(token, JWT_SECRET, async(err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expirado. Por favor, faça login novamente.' });
            }
            return res.status(403).json({ message: 'Token inválido. Por favor, faça login novamente.' });
        }

        try {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.userId },
                select: { id: true, email: true, isAdmin: true }
            });

            if (!dbUser) {
                return res.status(403).json({ message: 'Usuário não encontrado no banco de dados.' });
            }

            req.user = {
                userId: dbUser.id,
                email: dbUser.email,
                isAdmin: dbUser.isAdmin
            };
            next();
        } catch (dbError) {
            return res.status(500).json({ message: 'Erro interno do servidor ao autenticar.' });
        }
    });
}

module.exports = authenticateToken;