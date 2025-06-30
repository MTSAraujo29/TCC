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
    const [successMessage, setSuccessMessage] = useState('');

    // Handle input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Form submission handler
    const handleSubmit = async(e) => {
        e.preventDefault();
        setError('');

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError('As senhas não coincidem!');
            return;
        }

        console.log('Attempting to create account:', formData);

        try {
            const response = await fetch(API_ENDPOINTS.REGISTER, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password
                }),
            });

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

    // Helper functions
    const handleRegistrationSuccess = (data) => {
        setSuccessMessage('Sua conta foi criada com sucesso! Faça login agora.');
        setTimeout(() => {
            setSuccessMessage('');
            navigate('/login');
        }, 2500);
    };

    const handleRegistrationError = (data) => {
        console.error('Account creation failed:', data.message || 'Unknown error');
        setError(data.message || 'Erro ao criar conta. Tente novamente.');
    };

    const handleNetworkError = (err) => {
        console.error('Network error during registration:', err);
        setError('Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.');
    };

    // Render
    return ( <
        div className = "container" > {
            successMessage && ( <
                div className = "custom-toast success-toast" > { successMessage } < /div>
            )
        } <
        div className = "card" >
        <
        div className = "logo-icon" > ⚡ < /div> <
        h2 > Criar Conta < /h2>

        <
        form onSubmit = { handleSubmit } >
        <
        input type = "text"
        name = "name"
        placeholder = "Nome"
        required value = { formData.name }
        onChange = { handleInputChange }
        /> <
        input type = "email"
        name = "email"
        placeholder = "Email"
        required value = { formData.email }
        onChange = { handleInputChange }
        /> <
        input type = "password"
        name = "password"
        placeholder = "Senha"
        required value = { formData.password }
        onChange = { handleInputChange }
        /> <
        input type = "password"
        name = "confirmPassword"
        placeholder = "Confirmar Senha"
        required value = { formData.confirmPassword }
        onChange = { handleInputChange }
        />

        {
            error && ( <
                p style = {
                    { color: 'red', fontSize: '0.9em' }
                } > { error } <
                /p>
            )
        }

        <
        button type = "submit" > Criar < /button> < /
        form >

        <
        Link to = "/"
        className = "link-button" >
        Voltar para login <
        /Link> < /
        div > <
        /div>
    );
}

export default CreateAccountPage;