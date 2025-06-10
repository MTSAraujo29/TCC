// frontend/src/pages/LoginPage.js
import React, { useState } from 'react'; // Importe useState
import { Link, useNavigate } from 'react-router-dom';
import '../App.css'; // Importa o CSS global

function LoginPage() {
    const navigate = useNavigate();
    // Estados para armazenar os valores dos inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(''); // Estado para mensagens de erro

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Limpa mensagens de erro anteriores

        console.log('Tentando fazer login com:', { email, password });

        try {
            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Login bem-sucedido!
                console.log('Login bem-sucedido:', data);
                // Armazena o token JWT no localStorage do navegador
                localStorage.setItem('token', data.token);
                localStorage.setItem('userEmail', data.user.email); // Armazena o email também
                localStorage.setItem('userName', data.user.name); // Armazena o nome também

                navigate('/dashboard'); // Navega para o dashboard
            } else {
                // Erro do backend (ex: credenciais inválidas)
                console.error('Falha no login:', data.message || 'Erro desconhecido');
                setError(data.message || 'Email ou senha inválidos.');
            }
        } catch (err) {
            // Erro de rede
            console.error('Erro de rede ao fazer login:', err);
            setError('Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.');
        }
    };

    return (
        <div className="container">
            <div className="card">
                <div className="logo-icon">⚡</div> {/* Ícone simples */}
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
                    {error && <p style={{ color: 'red', fontSize: '0.9em' }}>{error}</p>} {/* Exibe erro */}
                    <button type="submit">Entrar</button>
                </form>
                <Link to="/create-account" className="link-button">Criar uma conta</Link>
            </div>
        </div>
    );
}

export default LoginPage;