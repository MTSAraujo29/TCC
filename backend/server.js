// backend/server.js
const express = require('express');
const path = require('path'); // <<< NOVO: Importe o módulo 'path'
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 10000; // <<< AJUSTADO: Porta para 10000 (comum no Render) ou process.env.PORT

require('dotenv').config({ path: '../.env' }); // Carrega o .env (bom para desenvolvimento local)

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERRO: JWT_SECRET não está definido nas variáveis de ambiente!');
    process.exit(1);
}

// =========================================================================
// 1. Middlewares Essenciais (Vêm primeiro)
// =========================================================================
app.use(express.json()); // Para parsear JSON no corpo das requisições

// Configuração do CORS: Muito importante para permitir requisições do frontend
// Ajuste 'origin' para a URL do seu frontend em produção e desenvolvimento.
app.use(cors({
    // Use a URL pública do seu Render para produção e localhost para desenvolvimento
    origin: process.env.NODE_ENV === 'production' ? 'https://tcc-lrbm.onrender.com' : 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));


// =========================================================================
// 2. Rotas da API (Vêm antes de servir os arquivos estáticos do frontend)
// Todas as suas rotas de API DEVE M VIR NESTA SEÇÃO.
// Se você tem um arquivo de rotas, importe-o e use-o aqui.
// =========================================================================
const ewelinkAuthRoutes = require('./routes/ewelinkAuthRoutes'); // Importe suas rotas da eWeLink
const authRoutes = require('./routes/authRoutes'); // Se você tiver rotas de registro/login separadas

// Rotas de autenticação (registro e login)
app.post('/api/register', async(req, res) => { // Rota de Registro
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

app.post('/api/login', async(req, res) => { // Rota de Login
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

        const token = jwt.sign({ userId: user.id, email: user.email }, // Payload do JWT
            JWT_SECRET, { expiresIn: '1h' }
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

function authenticateToken(req, res, next) { // Middleware de Autenticação JWT
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

// Rotas da eWeLink
app.use('/api/ewelink', ewelinkAuthRoutes);

// Rotas do Dashboard (protegidas por JWT)
// ATENÇÃO: Você tem DUAS rotas '/api/dashboard/data' ou similares.
// Mantenha apenas a que você realmente vai usar para dados reais do dashboard.
// Mantenha apenas a que está com 'authenticateToken' e remova a outra que está comentada.
app.get('/api/dashboard/data', authenticateToken, (req, res) => { // OU /api/dashboard-data como você tinha em outro lugar
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

// A rota abaixo estava duplicada/comentada. Remova-a se não for usar.
/*
app.get('/api/dashboard/data', (req, res) => {
    res.json({
        message: "Dados do dashboard carregados com sucesso (ainda sem dados reais do eWeLink aqui)",
        devices: [
            { id: 'mockDevice1', name: 'Lâmpada Sala', type: 'Lâmpada', status: 'on', consumption_kwh: 0.5 },
            { id: 'mockDevice2', name: 'TV Quarto', type: 'TV', status: 'off', consumption_kwh: 0.2 },
        ],
        daily_consumption_labels: ["2025-06-03", "2025-06-04", "2025-06-05", "2025-06-06", "2025-06-07", "2025-06-08", "2025-06-09"],
        daily_consumption_kwh: [3.2, 3.5, 2.9, 4.1, 3.8, 4.5, 3.9],
    });
});
*/


// =========================================================================
// 3. Rota de Health Check (Pode vir aqui também)
// =========================================================================
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});


// =========================================================================
// 4. Servir os Arquivos Estáticos do Frontend (VEM DEPOIS DE TODAS AS ROTAS DA API)
// ESTA É A SEÇÃO CHAVE PARA O SEU REACT APARECER!
// =========================================================================
// O 'path.join(__dirname, '../frontend/build')' assume que server.js está em 'backend/'
// e a pasta 'build' do frontend está na raiz do seu projeto 'TCC Site/frontend/build'.
app.use(express.static(path.join(__dirname, '../frontend/build')));


// =========================================================================
// 5. Rota Catch-all para o React Router (VEM POR ÚLTIMO)
// ESSENCIAL para que o React Router (client-side routing) funcione.
// Qualquer rota que não seja da API (ex: /login, /dashboard) será redirecionada para o index.html
// =========================================================================
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'build', 'index.html'));
});


// =========================================================================
// 6. Iniciar o Servidor
// =========================================================================
app.listen(PORT, () => {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
    // Adicione esta linha para facilitar a visualização da URL pública no Render logs
    console.log(`Aplicativo acessível em https://tcc-lrbm.onrender.com`);
});