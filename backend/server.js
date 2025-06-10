// backend/server.js
const express = require('express');
const path = require('path'); // <<< IMPORTADO: Módulo 'path' é essencial
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 10000; // Ajuste para 10000 como fallback, comum no Render

require('dotenv').config({ path: '../.env' }); // Carrega o .env (bom para desenvolvimento local)

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    // É crucial que JWT_SECRET esteja nas variáveis de ambiente do Render!
    console.error('ERRO: JWT_SECRET não está definido nas variáveis de ambiente!');
    process.exit(1);
}

// =========================================================================
// 1. Middlewares Essenciais (Vêm primeiro)
// =========================================================================
app.use(express.json()); // Para parsear JSON no corpo das requisições
app.use(express.urlencoded({ extended: true })); // Opcional, para parsear dados de formulário URL-encoded

// Configuração do CORS: Muito importante para permitir requisições do frontend
app.use(cors({
    // Use a URL pública do seu Render para produção e localhost para desenvolvimento
    origin: process.env.NODE_ENV === 'production' ? 'https://tcc-lrbm.onrender.com' : 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));


// =========================================================================
// 2. Rotas da API (Vêm antes de servir os arquivos estáticos do frontend)
// Todas as suas rotas de API DEVE M VIR NESTA SEÇÃO.
// =========================================================================

// <<< LINHA REMOVIDA: A linha "const authRoutes = require('./routes/authRoutes');" foi removida
// <<<                 porque suas rotas de registro/login estão neste arquivo.

const ewelinkAuthRoutes = require('./routes/ewelinkAuthRoutes'); // Importe suas rotas da eWeLink

// Middleware de Autenticação JWT (função usada pelas rotas protegidas)
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

// Rota para CRIAR CONTA (Registro de Usuário)
app.post('/api/register', async(req, res) => {
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
app.post('/api/login', async(req, res) => {
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


// Rotas da eWeLink
app.use('/api/ewelink', ewelinkAuthRoutes);

// Rota para buscar dados do Dashboard (Protegida)
// ATENÇÃO: Havia uma rota duplicada/comentada para o dashboard.
// Mantenha APENAS esta que está protegida com 'authenticateToken'.
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

// A rota original app.get('/') que retornava uma string foi REMOVIDA AQUI,
// pois ela será substituída por servir os arquivos estáticos do frontend.

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
    // Adicione esta linha para facilitar a visualização da URL pública nos logs do Render
    console.log(`Aplicativo acessível em https://tcc-lrbm.onrender.com`);
});