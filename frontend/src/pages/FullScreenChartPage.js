import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import '../App.css';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';

// ==============================================
// CONSTANTS
// ==============================================
const CHART_MODES = {
    DAY: 'Dia',
    WEEK: 'Semana',
    MONTH: 'Mês'
};

const MOCK_DATA = {
    [CHART_MODES.DAY]: {
        labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
        datasets: [{
            label: 'Consumo Diário (kWh)',
            data: [3.2, 3.5, 2.9, 4.1, 3.8, 4.5, 3.9],
            borderColor: '#00bcd4',
            backgroundColor: 'rgba(0, 188, 212, 0.4)',
            tension: 0.4,
            fill: true,
        }],
    },
    [CHART_MODES.WEEK]: {
        labels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
        datasets: [{
            label: 'Consumo Semanal (kWh)',
            data: [22.5, 24.1, 21.8, 25.3],
            borderColor: '#ff9800',
            backgroundColor: 'rgba(255, 152, 0, 0.4)',
            tension: 0.4,
            fill: true,
        }],
    },
    [CHART_MODES.MONTH]: {
        labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
        datasets: [{
            label: 'Consumo Mensal (kWh)',
            data: [90.2, 95.8, 88.5, 102.1, 99.7, 105.3, 98.0, 101.5, 93.0, 100.1, 97.5, 108.0],
            borderColor: '#e91e63',
            backgroundColor: 'rgba(233, 30, 99, 0.4)',
            tension: 0.4,
            fill: true,
        }],
    }
};

// ==============================================
// UTILITY FUNCTIONS
// ==============================================
const getChartOptions = (viewMode) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        title: {
            display: true,
            text: `Consumo de Energia - ${
                viewMode === CHART_MODES.DAY ? 'Diário' :
                    viewMode === CHART_MODES.WEEK ? 'Semanal' : 'Mensal'
            }`,
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
        x: {
            ticks: { color: '#BBB' },
            grid: {
                color: 'rgba(255,255,255,0.1)',
                borderColor: '#444'
            }
        },
        y: {
            ticks: {
                color: '#BBB',
                callback: function(value) {
                    return Number(value).toFixed(2) + ' kWh';
                }
            },
            grid: {
                color: 'rgba(255,255,255,0.1)',
                borderColor: '#444'
            }
        },
    }
});

const useStyles = (isMobile) => ({
    container: {
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
    },
    backButton: {
        position: 'absolute',
        top: isMobile ? 10 : 30,
        left: isMobile ? 10 : 30,
        padding: isMobile ? '10px 16px' : '12px 28px',
        background: '#1976d2',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: isMobile ? '1em' : '1.2em',
        fontWeight: 'bold',
        cursor: 'pointer',
        zIndex: 10000,
        minWidth: isMobile ? 90 : 120,
        minHeight: isMobile ? 38 : 48,
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
    },
    chartContainer: {
        width: isMobile ? '98vw' : '90vw',
        height: isMobile ? '65vh' : '80vh',
        maxWidth: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewButton: (active) => ({
        margin: isMobile ? '0 2vw 8px 0' : '0 8px',
        padding: isMobile ? '10px 0' : '10px 24px',
        width: isMobile ? '30vw' : 'auto',
        minWidth: isMobile ? 80 : 100,
        background: active ? '#1976d2' : '#444',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: isMobile ? '1em' : '1.1em',
        cursor: 'pointer',
        fontWeight: 'bold',
        boxShadow: active ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
        outline: active ? '2px solid #1976d2' : 'none',
        transition: 'background 0.2s, outline 0.2s',
        display: 'inline-block',
    }),
    viewButtonGroup: {
        marginBottom: 24,
        textAlign: 'center',
        width: isMobile ? '100%' : 'auto',
        display: isMobile ? 'flex' : 'block',
        flexDirection: isMobile ? 'row' : 'unset',
        justifyContent: isMobile ? 'space-between' : 'unset',
        gap: isMobile ? 0 : 8,
    }
});

// ==============================================
// MAIN COMPONENT
// ==============================================
export default function FullScreenChartPage() {
    // Initialize hooks and state
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState(CHART_MODES.DAY);
    const isMobile = window.innerWidth <= 600;
    const styles = useStyles(isMobile);
    const chartData = MOCK_DATA[viewMode];

    // Register ChartJS components
    ChartJS.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        ArcElement
    );

    return (
        <div style={styles.container}>
            <div style={styles.chartContainer}>
                <div style={styles.viewButtonGroup}>
                    {Object.entries(CHART_MODES).map(([key, value]) => (
                        <button
                            key={value}
                            style={styles.viewButton(viewMode === value)}
                            onClick={() => setViewMode(value)}
                        >
                            {key.charAt(0) + key.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>

                <Line
                    data={chartData}
                    options={getChartOptions(viewMode)}
                />
            </div>

            <button
                onClick={() => navigate('/dashboard')}
                style={{
                    ...styles.backButton,
                    position: 'static',
                    margin: isMobile ? '16px auto 8px' : '32px auto 0',
                    display: 'block',
                    left: 'unset',
                    top: 'unset',
                    width: isMobile ? '90vw' : 220,
                    maxWidth: 400,
                }}
            >
                Voltar
            </button>
        </div>
    );
}