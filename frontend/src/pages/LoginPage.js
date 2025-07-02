// Importações
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';
import api from '../config/api';

function LoginPage() {
    // Hooks
    const navigate = useNavigate();

    // Estados
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Função para lidar com envio do formulário
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await api.post('/login', { email, password });
            const data = response.data;

            if (data.token) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userEmail', data.user.email);
                localStorage.setItem('userName', data.user.name);
                navigate('/dashboard');
            } else {
                setError('Credenciais inválidas.');
            }
        } catch (err) {
            setError('Credenciais inválidas ou erro de conexão.');
        } finally {
            setLoading(false);
        }
    };

    // Renderização
    return (
        <div className="container">
            <div className="card">
                <div className="logo-icon">⚡</div>
                <h2>Login</h2>

                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder="Email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                        type="password"
                        placeholder="Senha"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    {error && (
                        <p style={{ color: 'red', fontSize: '0.9em' }}>{error}</p>
                    )}

                    <button type="submit" disabled={loading}>
                        Entrar
                    </button>
                </form>

                <Link to="/create-account" className="link-button">
                    Criar uma conta
                </Link>
            </div>
        </div>
    );
}

export default LoginPage;
