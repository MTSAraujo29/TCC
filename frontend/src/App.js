// frontend/src/App.js
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateAccountPage from './pages/CreateAccountPage';
import AddDevicePage from './pages/AddDevicePage';
import FullScreenChartPage from './pages/FullScreenChartPage';
import HomePage from './pages/HomePage';
import './App.css'; // Estilos globais para a aplicação

function App() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const token = localStorage.getItem('token');
        const tokenExp = localStorage.getItem('token_exp');
        if (token && tokenExp) {
            const now = Math.floor(Date.now() / 1000);
            if (parseInt(tokenExp, 10) > now) {
                if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/create-account') {
                    navigate('/dashboard');
                }
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('token_exp');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                if (location.pathname !== '/') {
                    navigate('/');
                }
            }
        }
    }, [location.pathname]);

    return ( <
        Router >
        <
        Routes > { /* Home route */ } <
        Route path = "/"
        element = { < HomePage / > }
        />

        { /* Authentication routes */ } <
        Route path = "/login"
        element = { < LoginPage / > }
        /> <
        Route path = "/create-account"
        element = { < CreateAccountPage / > }
        />

        { /* App routes */ } <
        Route path = "/dashboard"
        element = { < DashboardPage / > }
        /> <
        Route path = "/add-device"
        element = { < AddDevicePage / > }
        /> <
        Route path = "/grafico-cheio"
        element = { < FullScreenChartPage / > }
        /> < /
        Routes > <
        /Router>
    );
}

export default App;