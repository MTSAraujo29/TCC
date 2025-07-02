import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';
import { API_ENDPOINTS } from '../config/api';

function LoginPage() {
    // Hooks
    const navigate = useNavigate();

    // State management
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Helper functions
    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // Event handlers
    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!validateEmail(formData.email)) {
            setError('Por favor, insira um email válido.');
            return;
        }
        if (!formData.password || formData.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(API_ENDPOINTS.LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email.trim(),
                    password: formData.password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || (data.errors && data.errors[0]?.msg) || 'Erro ao fazer login.');
            } else {
                // Security note: Consider more secure storage for tokens
                sessionStorage.setItem('token', data.token);
                localStorage.setItem('userEmail', data.user.email);
                localStorage.setItem('userName', data.user.name);
                navigate('/dashboard');
            }
        } catch (err) {
            setError('Erro de rede. Tente novamente mais tarde.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="card">
                <div className="logo-icon">⚡</div>
                <h2>Login</h2>

                <form onSubmit={handleSubmit} autoComplete="off">
                    <label htmlFor="email">Email:</label>
                    <input
                        id="email"
                        type="email"
                        placeholder="Email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        aria-required="true"
                        autoFocus
                    />

                    <label htmlFor="password">Senha:</label>
                    <input
                        id="password"
                        type="password"
                        placeholder="Senha"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                        aria-required="true"
                        minLength={6}
                    />

                    {error && (
                        <div className="error" role="alert">
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading}>
                        {loading ? 'Entrando...' : 'Entrar'}
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