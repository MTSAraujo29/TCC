import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';
import api from '../config/api';

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
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

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
        setSuccess('');

        // Validation
        if (formData.password !== formData.confirmPassword) {
            setError('As senhas não coincidem!');
            return;
        }

        setLoading(true);
        console.log('Attempting to create account:', formData);

        try {
            const response = await api.post('/register', {
                name: formData.name,
                email: formData.email,
                password: formData.password
            });

            if (response.data.message) {
                setSuccess(response.data.message);
                setTimeout(() => navigate('/login'), 2000);
            } else {
                setError('Erro ao criar conta.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao criar conta ou conexão.');
        } finally {
            setLoading(false);
        }
    };

    // Render
    return (
        <div className="container">
            <div className="card">
                <div className="logo-icon">⚡</div>
                <h2>Criar Conta</h2>

                {success && (
                    <p className="success-message">{success}</p>
                )}

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
                    <input
                        type="password"
                        name="password"
                        placeholder="Senha"
                        required
                        value={formData.password}
                        onChange={handleInputChange}
                    />
                    <input
                        type="password"
                        name="confirmPassword"
                        placeholder="Confirmar Senha"
                        required
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                    />

                    {error && (
                        <p className="error-message">{error}</p>
                    )}

                    <button type="submit" disabled={loading}>
                        {loading ? 'Criando...' : 'Criar'}
                    </button>
                </form>

                <Link to="/" className="link-button">
                    Voltar Tela Inicial
                </Link>
            </div>
        </div>
    );
}

export default CreateAccountPage;