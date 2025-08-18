import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Line } from "react-chartjs-2";
import "../App.css";
import "./FullScreenChartPage.css";
import { API_ENDPOINTS } from "../config/api";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";

// ==============================================
// CONSTANTS
// ==============================================
const CHART_MODES = {
  DAY: "Dia",
  WEEK: "Semana",
  MONTH: "Mês",
};

const MOCK_DATA = {
  [CHART_MODES.DAY]: {
    labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
    datasets: [
      {
        label: "Consumo Diário (kWh)",
        data: [3.2, 3.5, 2.9, 4.1, 3.8, 4.5, 3.9],
        borderColor: "#00bcd4",
        backgroundColor: "rgba(0, 188, 212, 0.4)",
        tension: 0.4,
        fill: true,
      },
    ],
  },
  [CHART_MODES.WEEK]: {
    labels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
    datasets: [
      {
        label: "Consumo Semanal (kWh)",
        data: [22.5, 24.1, 21.8, 25.3],
        borderColor: "#ff9800",
        backgroundColor: "rgba(255, 152, 0, 0.4)",
        tension: 0.4,
        fill: true,
      },
    ],
  },
  [CHART_MODES.MONTH]: {
    labels: [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ],
    datasets: [
      {
        label: "Consumo Mensal (kWh)",
        data: [
          90.2, 95.8, 88.5, 102.1, 99.7, 105.3, 98.0, 101.5, 93.0, 100.1, 97.5,
          108.0,
        ],
        borderColor: "#e91e63",
        backgroundColor: "rgba(233, 30, 99, 0.4)",
        tension: 0.4,
        fill: true,
      },
    ],
  },
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
        viewMode === CHART_MODES.DAY
          ? "Diário"
          : viewMode === CHART_MODES.WEEK
          ? "Semanal"
          : "Mensal"
      }`,
      color: "#FFF",
      font: { size: 22, weight: "600" },
      padding: 20,
    },
    tooltip: {
      backgroundColor: "rgba(0,0,0,0.9)",
      titleColor: "#FFF",
      bodyColor: "#FFF",
      borderColor: "#00bcd4",
      borderWidth: 2,
      cornerRadius: 8,
      displayColors: false,
      titleFont: { size: 14, weight: "600" },
      bodyFont: { size: 13 },
      padding: 12,
    },
  },
  scales: {
    x: {
      ticks: {
        color: "#BBB",
        font: { size: 12, weight: "500" },
      },
      grid: {
        color: "rgba(255,255,255,0.1)",
        borderColor: "#444",
        lineWidth: 1,
      },
    },
    y: {
      ticks: {
        color: "#BBB",
        font: { size: 12, weight: "500" },
        callback: function (value) {
          return Number(value).toFixed(2) + " kWh";
        },
      },
      grid: {
        color: "rgba(255,255,255,0.1)",
        borderColor: "#444",
        lineWidth: 1,
      },
    },
  },
  elements: {
    point: {
      radius: 6,
      hoverRadius: 8,
      backgroundColor: "#00bcd4",
      borderColor: "#fff",
      borderWidth: 2,
    },
    line: {
      borderWidth: 3,
    },
  },
});

// ==============================================
// MAIN COMPONENT
// ==============================================
export default function FullScreenChartPage() {
  // Initialize hooks and state
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState(CHART_MODES.DAY);
  const isMobile = window.innerWidth <= 600;
  const [realDailyChart, setRealDailyChart] = useState(null);
  const [realWeeklyChart, setRealWeeklyChart] = useState(null);
  const [realMonthlyChart, setRealMonthlyChart] = useState(null);

  // Estado para controlar se os dados são reais ou fictícios
  const [isRealData, setIsRealData] = useState(true);
  const [fictionalDataMessage, setFictionalDataMessage] = useState("");

  // Buscar dados reais quando possível (token presente). Fallback para MOCK_DATA
  React.useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    
    // Verificar se o usuário é admin (tem acesso a dados reais)
    const checkUserRole = async () => {
      try {
        const response = await fetch(`${API_ENDPOINTS.DASHBOARD}/data`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsRealData(data.isRealData);
          
          if (!data.isRealData) {
            setFictionalDataMessage("Os dados exibidos são fictícios. Conta não Admin!");
            // Para usuários não-admin, usamos os dados fictícios definidos em MOCK_DATA
            return;
          } else {
            setFictionalDataMessage("");
          }
        }
      } catch (error) {
        console.error("Erro ao verificar tipo de usuário:", error);
      }
    };

    checkUserRole();

    // Só busca dados reais se o usuário for admin
    const fetchDaily = async () => {
      const res = await fetch(API_ENDPOINTS.DASHBOARD_CHART_DAILY_YESTERDAY, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRealDailyChart({
          labels: data.labels,
          datasets: [
            {
              label: data.datasets?.[0]?.label || "Consumo Diário (kWh)",
              data: data.datasets?.[0]?.data || [],
              borderColor: "#00bcd4",
              backgroundColor: "rgba(0, 188, 212, 0.4)",
              tension: 0.4,
              fill: true,
            },
          ],
        });
      }
    };
    const fetchWeekly = async () => {
      const res = await fetch(API_ENDPOINTS.DASHBOARD_CHART_WEEKLY_YESTERDAY, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRealWeeklyChart({
          labels: data.labels,
          datasets: [
            {
              label: data.datasets?.[0]?.label || "Consumo Semanal (kWh)",
              data: data.datasets?.[0]?.data || [],
              borderColor: "#ff9800",
              backgroundColor: "rgba(255, 152, 0, 0.4)",
              tension: 0.4,
              fill: true,
            },
          ],
        });
      }
    };
    const fetchMonthly = async () => {
      const res = await fetch(
        API_ENDPOINTS.DASHBOARD_CHART_MONTHLY_ENERGY_DATA,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setRealMonthlyChart({
          labels: data.labels,
          datasets: [
            {
              label: data.datasets?.[0]?.label || "Consumo Mensal (kWh)",
              data: data.datasets?.[0]?.data || [],
              borderColor: "#e91e63",
              backgroundColor: "rgba(233, 30, 99, 0.4)",
              tension: 0.4,
              fill: true,
            },
          ],
        });
      }
    };
    
    // Só busca dados reais se o usuário for admin
    if (isRealData) {
      fetchDaily();
      fetchWeekly();
      fetchMonthly();
    }
  }, [isRealData]);

  const chartData = (() => {
    // Se não for dados reais (usuário não-admin), sempre use os dados fictícios
    if (!isRealData) {
      if (viewMode === CHART_MODES.DAY)
        return MOCK_DATA[CHART_MODES.DAY];
      if (viewMode === CHART_MODES.WEEK)
        return MOCK_DATA[CHART_MODES.WEEK];
      return MOCK_DATA[CHART_MODES.MONTH];
    }
    
    // Se for dados reais (usuário admin), use os dados reais quando disponíveis
    if (viewMode === CHART_MODES.DAY)
      return realDailyChart || MOCK_DATA[CHART_MODES.DAY];
    if (viewMode === CHART_MODES.WEEK)
      return realWeeklyChart || MOCK_DATA[CHART_MODES.WEEK];
    return realMonthlyChart || MOCK_DATA[CHART_MODES.MONTH];
  })();

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
    <div className="fullscreen-chart-container">
      <div className="fullscreen-chart-background">
        <div className="fullscreen-chart-pattern"></div>
      </div>

      <div className="fullscreen-chart-header">
        <div className="header-content">
          <div className="header-logo">
            <img src="/icon.png" alt="Smart Energy" />
            <h2>Smart Energy</h2>
          </div>
          <h3>Análise Detalhada de Consumo</h3>
          <p>Visualize seus dados de energia em tela cheia</p>
          {fictionalDataMessage && (
            <div className="fictional-data-message">
              <p>{fictionalDataMessage}</p>
            </div>
          )}
        </div>
      </div>

      <div className="fullscreen-chart-content">
        <div className="chart-controls">
          <div className="view-mode-buttons">
            {Object.entries(CHART_MODES).map(([key, value]) => (
              <button
                key={value}
                className={`view-mode-button ${
                  viewMode === value ? "active" : ""
                }`}
                onClick={() => setViewMode(value)}
              >
                <span className="button-icon">
                  {value === CHART_MODES.DAY && "📅"}
                  {value === CHART_MODES.WEEK && "📊"}
                  {value === CHART_MODES.MONTH && "📈"}
                </span>
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="chart-wrapper">
          <div className="chart-container">
            <Line data={chartData} options={getChartOptions(viewMode)} />
          </div>
        </div>

        <div className="chart-footer">
          <button
            onClick={() => navigate("/dashboard")}
            className="back-button"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
