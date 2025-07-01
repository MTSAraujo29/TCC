// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateAccountPage from './pages/CreateAccountPage';
import AddDevicePage from './pages/AddDevicePage';
import FullScreenChartPage from './pages/FullScreenChartPage';
import HomePage from './pages/HomePage';
import DeviceManagementPage from './pages/DeviceManagementPage';
import './App.css'; // Estilos globais para a aplicação

function App() {
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
        /> <
        Route path = "/device-management"
        element = { < DeviceManagementPage / > }
        /> < /
        Routes > <
        /Router>
    );
}

export default App;