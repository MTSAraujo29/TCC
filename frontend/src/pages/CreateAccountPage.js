import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';
import { API_ENDPOINTS } from '../config/api';

function CreateAccountPage() {
    // Hooks
    const navigate = useNavigate();

    // State management
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Event handlers
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        try {
            const response = await registerUser();
            const data = await response.json();

            if (response.ok) {
                handleRegistrationSuccess(data);
            } else {
                handleRegistrationError(data);
            }
        } catch (err) {
            handleNetworkError(err);
        }
    };

    // Validation
    const validateForm = () => {
        if (formData.password !== formData.confirmPassword) {
            setError('As senhas não coincidem!');
            return false;
        }
        return true;
    };

    // API calls
    const registerUser = async () => {
        return await fetch(API_ENDPOINTS.REGISTER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: formData.name,
                email: formData.email,
                password: formData.password
            }),
        });
    };

    // Response handlers
    const handleRegistrationSuccess = (data) => {
        console.log('Account created successfully:', data);
        alert('Sua conta foi criada com sucesso! Faça login agora.');
        navigate('/login');
    };

    const handleRegistrationError = (data) => {
        console.error('Account creation failed:', data.message || 'Unknown error');
        setError(data.message || 'Erro ao criar conta. Tente novamente.');
    };

    const handleNetworkError = (err) => {
        console.error('Network error during registration:', err);
        setError('Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.');
    };

    // UI components
    const PasswordInput = ({ name, placeholder, value, show, setShow }) => (
        <div style={{ position: 'relative' }}>
            <input
                type={show ? 'text' : 'password'}
                name={name}
                placeholder={placeholder}
                required
                value={value}
                onChange={handleInputChange}
                style={{ paddingRight: 40 }}
            />
            <span
                onClick={() => setShow(v => !v)}
                style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer',
                    color: '#888',
                    fontSize: 18
                }}
                title={show ? 'Ocultar senha' : 'Mostrar senha'}
            >
                {show ? '🙈' : '👁️'}
            </span>
        </div>
    );

    // Render
    return (
        <div className="container">
            <div className="card">
                <div className="logo-icon">⚡</div>
                <h2>Criar Conta</h2>

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
                        type="text"
                        name="name"
                        placeholder="Nome"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                    />

                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                    />

                    <PasswordInput
                        name="password"
                        placeholder="Senha"
                        value={formData.password}
                        show={showPassword}
                        setShow={setShowPassword}
                    />

                    <PasswordInput
                        name="confirmPassword"
                        placeholder="Confirmar Senha"
                        value={formData.confirmPassword}
                        show={showConfirmPassword}
                        setShow={setShowConfirmPassword}
                    />

                    {error && (
                        <p style={{ color: 'red', fontSize: '0.9em' }}>
                            {error}
                        </p>
                    )}

                    <button type="submit">Criar</button>
                </form>

                <Link to="/" className="link-button">
                    Voltar Tela Inicial
                </Link>
            </div>
        </div>
    );
}

export default CreateAccountPage;