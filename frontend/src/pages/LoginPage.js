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
    const EyeOpen = (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="12" rx="8" ry="5" />
            <circle cx="12" cy="12" r="2.5" />
        </svg>
    );

    const EyeClosed = (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l22 22" />
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-5.05 0-9.29-3.14-10.74-7.5a10.97 10.97 0 0 1 1.66-3.13" />
            <path d="M9.53 9.53A3.5 3.5 0 0 0 12 15.5c1.38 0 2.63-.83 3.16-2.03" />
        </svg>
    );

    const passwordToggleIcon = uiState.showPassword ? EyeClosed : EyeOpen;
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

    const togglePasswordVisibility = () => {
        setUiState(prev => ({ ...prev, showPassword: !prev.showPassword }));
    };

    // Helper functions
    const handleSuccessfulLogin = (data) => {
        console.log('Login successful:', data);
        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.name);

        try {
            const payload = JSON.parse(atob(data.token.split('.')[1]));
            if (payload.exp) {
                localStorage.setItem('token_exp', payload.exp);
            }
        } catch (e) {
            console.error('Error decoding token:', e);
        }

        navigate('/dashboard');
    };

    const handleLoginError = (data) => {
        console.error('Login failed:', data.message || 'Unknown error');
        setUiState(prev => ({ ...prev, error: data.message || 'Email ou senha inválidos.' }));
    };

    const handleNetworkError = (err) => {
        console.error('Network error during login:', err);
        setUiState(prev => ({
            ...prev,
            error: 'Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.'
        }));
    };

    // Render
    return (
        <div className="container">
            <div className="card">
                <div className="logo-icon">⚡</div>
                <h2>Login</h2>

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

                <button
                    type="button"
                    className="link-button"
                    style={{ marginTop: 16 }}
                    onClick={() => navigate('/')}
                >
                    Voltar
                </button>
            </div>
        </div>
    );
}

export default LoginPage;