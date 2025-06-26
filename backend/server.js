// backend/server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

// Carrega as variáveis de ambiente do .env
// Certifique-se que o caminho está correto se o .env não estiver na raiz do projeto.
// Para esta estrutura, apenas 'require('dotenv').config();' deve bastar se o .env estiver em backend/.env
require('dotenv').config({ path: './.env' });

// --- Instância Global do Prisma (MELHORIA) ---
// Em vez de criar uma nova instância em cada arquivo que usa Prisma,
// é melhor ter uma instância global e passá-la ou exportá-la.
// Se tasmota.service.js já tem a sua, por enquanto deixe como está, mas é algo a considerar.
const prisma = new PrismaClient();

// Configurações de segurança
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERRO: JWT_SECRET não está definido no arquivo .env!');
    process.exit(1); // Encerra a aplicação se a chave secreta não estiver configurada
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cors()); // Para produção, configure as origens permitidas em `cors({ origin: 'http://seufrontend.com' })`

// =========================================================================
// Middleware de Autenticação JWT (ATUALIZADO)
// =========================================================================
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Token de autenticação ausente.' });
    }

    jwt.verify(token, JWT_SECRET, async(err, user) => {
        if (err) {
            console.error('Erro de verificação JWT:', err.message); // Melhor logar a mensagem do erro
            // O erro 'TokenExpiredError' é comum, pode-se lidar especificamente
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expirado. Por favor, faça login novamente.' });
            }
            return res.status(403).json({ message: 'Token inválido. Por favor, faça login novamente.' });
        }

        try {
            // Buscar informações completas do usuário do banco de dados
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
            console.error('Erro ao buscar usuário no DB para autenticação:', dbError);
            return res.status(500).json({ message: 'Erro interno do servidor ao autenticar.' });
        }
    });
}
// Não é necessário exportar authenticateToken com module.exports.authenticateToken aqui
// se você só o utiliza dentro deste arquivo ou o passa como middleware nas rotas.
// Se suas rotas estão em arquivos separados e você as importa, você pode passar `authenticateToken` diretamente.

// =========================================================================
// Importação e Uso das Rotas Modularizadas
// =========================================================================

// Importa os serviços MQTT. Use o nome tasmotaService.
const tasmotaService = require('./services/tasmota.service');

// Importa as rotas de Tasmota (seu arquivo routes/tasmotaRoutes.js)
const tasmotaRoutes = require('./routes/tasmotaRoutes');
// Você pode passar a instância do PrismaClient para as rotas se elas precisarem dela.
// Ex: app.use('/api/tasmota', tasmotaRoutes(prisma)); // E as rotas teriam que aceitar 'prisma' como argumento
app.use('/api/tasmota', tasmotaRoutes);


// Importa as rotas do Dashboard (o novo arquivo routes/dashboardRoutes.js)
const dashboardRoutes = require('./routes/dashboardRoutes');
// Ex: app.use('/api/dashboard', dashboardRoutes(prisma));
app.use('/api/dashboard', dashboardRoutes);

// =========================================================================
// Rotas de Autenticação (Registro e Login)
// =========================================================================

// Rota de saúde (health check)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Rota inicial
app.get('/', (req, res) => {
    res.send('Servidor Backend (Node.js com Express) rodando com Prisma, Hashing e JWT, e integração Tasmota/MQTT!');
});

// Rota para CRIAR CONTA (Registro de Usuário)
app.post('/api/register', async(req, res) => {
    const { name, email, password } = req.body;
    // ... sua lógica de registro ...
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Todos os campos (Nome, Email, Senha) são obrigatórios.' });
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email: email },
        });

        if (existingUser) {
            return res.status(409).json({ message: 'Este email já está registrado. Por favor, faça login.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword,
                // Certifique-se de que o campo 'isAdmin' existe no seu modelo User no schema.prisma
                // Se não existir, remova esta linha ou adicione o campo ao schema.
                isAdmin: email === 'admin123@gmail.com' // Define admin se o email for o do admin
            },
        });

        res.status(201).json({
            message: 'Conta criada com sucesso!',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                isAdmin: newUser.isAdmin
            }
        });

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar registrar. Tente novamente mais tarde.' });
    }
});

// Rota para LOGIN de Usuário
app.post('/api/login', async(req, res) => {
    const { email, password } = req.body;
    // ... sua lógica de login ...
    if (!email || !password) {
        return res.status(400).json({ message: 'Email e Senha são obrigatórios.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: email },
        });

        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email },
            JWT_SECRET, { expiresIn: '1h' }
        );

        res.json({
            message: 'Login bem-sucedido!',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        console.error('Erro ao fazer login do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar fazer login. Tente novamente mais tarde.' });
    }
});


// Inicia o servidor Express E o cliente MQTT
app.listen(PORT, () => {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
    // **Ajuste aqui:** Chame a função correta do tasmotaService
    tasmotaService.initializeMqttClient()
        .then(() => console.log('Cliente MQTT inicializado com sucesso!'))
        .catch(err => console.error('Falha ao inicializar o cliente MQTT:', err));
});

module.exports.authenticateToken = authenticateToken;