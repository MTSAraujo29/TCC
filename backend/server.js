// backend/server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

require('dotenv').config({ path: '../.env' }); // Carrega o .env

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERRO: JWT_SECRET não está definido no arquivo .env!');
    process.exit(1);
}

// Middlewares
app.use(express.json());
app.use(cors());

// =========================================================================
// NOVO: Importe as rotas da eWeLink AQUI, ANTES DE USÁ-LAS
// ASSUMA que o arquivo ewelinkAuthRoutes.js está em uma pasta 'routes'
// dentro do seu diretório 'backend'. Ajuste o caminho se for diferente!
// =========================================================================
const ewelinkAuthRoutes = require('./routes/ewelinkAuthRoutes'); // <--- Linha Adicionada/Movida para cá

// Rota de Health Check
app.get('/health', (req, res) => {
    res.status(200).send('OK'); // Ou res.status(200).json({ status: 'healthy' });
});


// Novas rotas para eWeLink OAuth e API
app.use('/api/ewelink', ewelinkAuthRoutes); // <--- Agora ewelinkAuthRoutes está definido

// =========================================================================
// Middleware de Autenticação JWT
// ... (restante do seu código) ...
// =========================================================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Token de autenticação ausente.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido ou expirado.' });
        }
        req.user = user;
        next();
    });
}

// Rota de teste simples
app.get('/', (req, res) => {
    res.send('Servidor Backend (Node.js com Express) rodando com Prisma, Hashing e JWT!');
});

// =========================================================================
// NOVA ROTA PROTEGIDA: Dados para o Dashboard (Simulados)
// =========================================================================
app.get('/api/dashboard/data', authenticateToken, (req, res) => {
    console.log('Acesso à rota de dados do dashboard por:', req.user.email);
    res.json({
        message: 'Dados do Dashboard carregados com sucesso!',
        devices: [
            { id: 'dev1', name: 'Lâmpada Sala', type: 'light', status: 'on', consumption_kwh: 0.15 },
            { id: 'dev2', name: 'Tomada Cozinha', type: 'outlet', status: 'off', consumption_kwh: 0.02 },
            { id: 'dev3', name: 'Ar Condicionado', type: 'ac', status: 'on', consumption_kwh: 1.2 },
            { id: 'dev4', name: 'Geladeira', type: 'refrigerator', status: 'on', consumption_kwh: 0.5 }
        ],
        daily_consumption_kwh: [10.5, 12.0, 8.3, 15.1, 11.7, 13.5, 9.8],
        daily_consumption_labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    });
});

// Exemplo de rota protegida para o dashboard (verifique se o usuário está autenticado no seu sistema)
// ATENÇÃO: Você tem DUAS rotas '/api/dashboard/data'. Isso pode causar confusão.
// Uma delas deve ser removida ou ter um propósito diferente (ex: uma para dados mock, outra para dados reais).
// Mantenha apenas a que você realmente vai usar para dados reais do dashboard após a integração eWeLink.
/* app.get('/api/dashboard/data', (req, res) => {
    res.json({
        message: "Dados do dashboard carregados com sucesso (ainda sem dados reais do eWeLink aqui)",
        devices: [
            { id: 'mockDevice1', name: 'Lâmpada Sala', type: 'Lâmpada', status: 'on', consumption_kwh: 0.5 },
            { id: 'mockDevice2', name: 'TV Quarto', type: 'TV', status: 'off', consumption_kwh: 0.2 },
        ],
        daily_consumption_labels: ["2025-06-03", "2025-06-04", "2025-06-05", "2025-06-06", "2025-06-07", "2025-06-08", "2025-06-09"],
        daily_consumption_kwh: [3.2, 3.5, 2.9, 4.1, 3.8, 4.5, 3.9],
    });
}); */


// Rota para CRIAR CONTA (Registro de Usuário)
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

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
            },
        });

        res.status(201).json({
            message: 'Conta criada com sucesso!',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
            }
        });

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar registrar. Tente novamente mais tarde.' });
    }
});

// Rota para LOGIN de Usuário
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

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

        const token = jwt.sign(
            { userId: user.id, email: user.email }, // Payload do JWT
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Login bem-sucedido!',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        });

    } catch (error) {
        console.error('Erro ao fazer login do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar fazer login. Tente novamente mais tarde.' });
    }
});

// =========================================================================
// Rota Protegida (Exemplo: para buscar dados do Dashboard)
// Agora, para acessar esta rota, o usuário PRECISA enviar um JWT válido.
// =========================================================================
app.get('/api/dashboard-data', authenticateToken, (req, res) => {
    // Se chegou até aqui, o token é válido e req.user contém o payload do token
    console.log('Acesso à rota protegida por:', req.user.email);
    res.json({
        message: 'Bem-vindo ao Dashboard! Você acessou dados protegidos.',
        userData: {
            userId: req.user.userId,
            email: req.user.email,
            // Poderíamos buscar mais informações do usuário no DB aqui se necessário
        }
    });
});


// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});