import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import '../App.css';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

// Receber props ou buscar dados do localStorage/contexto se necessário
// Aqui, para simplificação, vamos buscar os mesmos dados mockados da DashboardPage
const mockDailyData = {
    labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
    datasets: [{
        label: 'Consumo Diário (kWh)',
        data: [3.2, 3.5, 2.9, 4.1, 3.8, 4.5, 3.9],
        borderColor: '#00bcd4',
        backgroundColor: 'rgba(0, 188, 212, 0.4)',
        tension: 0.4,
        fill: true,
    }],
};

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        title: {
            display: true,
            text: 'Consumo de Energia - Diário',
            color: '#FFF',
            font: { size: 22 }
        },
        tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#FFF',
            bodyColor: '#FFF',
            borderColor: '#FFF',
            borderWidth: 1,
        }
    },
    scales: {
        x: { ticks: { color: '#BBB' }, grid: { color: 'rgba(255,255,255,0.1)', borderColor: '#444' } },
        y: {
            ticks: {
                color: '#BBB',
                callback: function(value) {
                    return Number(value).toFixed(2) + ' kWh';
                }
            },
            grid: { color: 'rgba(255,255,255,0.1)', borderColor: '#444' }
        },
    }
};

export default function FullScreenChartPage() {
    const navigate = useNavigate();
    return ( <
        div style = {
            {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: '#222',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }
        } >
        <
        button onClick = {
            () => navigate('/dashboard')
        }
        style = {
            {
                position: 'absolute',
                top: 30,
                left: 30,
                padding: '12px 28px',
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1.2em',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 10000
            }
        } >
        Voltar <
        /button> <
        div style = {
            { width: '90vw', height: '80vh', maxWidth: 1200 }
        } >
        <
        Line data = { mockDailyData }
        options = { chartOptions }
        /> < /
        div > <
        /div>
    );
}