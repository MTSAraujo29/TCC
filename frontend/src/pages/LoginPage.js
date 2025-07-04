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
    const [uiState, setUiState] = useState({
        error: '',
        loading: false,
        showPassword: false
    });

    // Constants
    const passwordToggleIcon = uiState.showPassword ? '🙈' : '👁️';
    const passwordToggleTitle = uiState.showPassword ? 'Ocultar senha' : 'Mostrar senha';

    // Event handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUiState(prev => ({ ...prev, error: '', loading: true }));

        try {
            const response = await fetch(API_ENDPOINTS.LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            setUiState(prev => ({ ...prev, loading: false }));

            response.ok ? handleSuccessfulLogin(data) : handleLoginError(data);
        } catch (err) {
            setUiState(prev => ({ ...prev, loading: false }));
            handleNetworkError(err);
        }
    };

    // Helper functions
    const handleSuccessfulLogin = (data) => {
        console.log('Login successful:', data);

        // Store user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.name);

        navigate('/dashboard');
    };

    const handleLoginError = (data) => {
        console.error('Login failed:', data.message || 'Unknown error');
        setUiState(prev => ({ ...prev, error: data.message || 'Email ou senha inválidos.' }));
    };

    const handleNetworkError = (err) => {
        console.error('Network error during login:', err);
        setUiState(prev => ({ ...prev, error: 'Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.' }));
    };

    const togglePasswordVisibility = () => {
        setUiState(prev => ({ ...prev, showPassword: !prev.showPassword }));
    };

    // Render
    return (
        <div className="container">
            <div className="card">
                <div className="logo-icon">⚡</div>
                <h2>Login</h2>

                <button
                    type="button"
                    className="link-button"
                    style={{ marginBottom: 16 }}
                    onClick={() => navigate('/')}
                >
                    Voltar
                </button>

                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                    />

                    <div style={{ position: 'relative' }}>
                        <input
                            type={uiState.showPassword ? 'text' : 'password'}
                            name="password"
                            placeholder="Senha"
                            required
                            value={formData.password}
                            onChange={handleInputChange}
                            style={{ paddingRight: 40 }}
                        />
                        <span
                            onClick={togglePasswordVisibility}
                            style={{
                                position: 'absolute',
                                right: 10,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                cursor: 'pointer',
                                color: '#888',
                                fontSize: 18
                            }}
                            title={passwordToggleTitle}
                        >
                            {passwordToggleIcon}
                        </span>
                    </div>

                    {uiState.error && (
                        <p style={{ color: 'red', fontSize: '0.9em' }}>
                            {uiState.error}
                        </p>
                    )}

                    <button type="submit" disabled={uiState.loading}>
                        {uiState.loading ? 'Entrando' : 'Entrar'}
                        {uiState.loading && <span className="loading-dots">...</span>}
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