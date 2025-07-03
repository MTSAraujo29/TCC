import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';
import { API_ENDPOINTS } from '../config/api';

function LoginPage() {
    // Hooks
    const navigate = useNavigate();

    // State management
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Event handlers
    const handleSubmit = async(e) => {
        e.preventDefault();
        setError(''); // Clear previous errors

        console.log('Attempting login with:', { email, password });

        try {
            const response = await fetch(API_ENDPOINTS.LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                handleSuccessfulLogin(data);
            } else {
                handleLoginError(data);
            }
        } catch (err) {
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
        localStorage.setItem('isAdmin', data.user.isAdmin);

        navigate('/dashboard');
    };

    const handleLoginError = (data) => {
        console.error('Login failed:', data.message || 'Unknown error');
        setError(data.message || 'Email ou senha inválidos.');
    };

    const handleNetworkError = (err) => {
        console.error('Network error during login:', err);
        setError('Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.');
    };

    // Render
    return ( <
        div className = "container" >
        <
        div className = "card" >
        <
        div className = "logo-icon" > ⚡ < /div> <
        h2 > Login < /h2>

        <
        form onSubmit = { handleSubmit } >
        <
        input type = "email"
        placeholder = "Email"
        required value = { email }
        onChange = {
            (e) => setEmail(e.target.value)
        }
        /> <
        input type = "password"
        placeholder = "Senha"
        required value = { password }
        onChange = {
            (e) => setPassword(e.target.value)
        }
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
        button type = "submit" > Entrar < /button> < /
        form >

        <
        Link to = "/create-account"
        className = "link-button" >
        Criar uma conta <
        /Link> < /
        div > <
        /div>
    );
}

export default LoginPage;