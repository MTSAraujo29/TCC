import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import "./DashboardPage.css";
import { API_ENDPOINTS } from "../config/api";
import CustomAlert from "../components/CustomAlert";
import useCustomAlert from "../hooks/useCustomAlert";

// Importações do Chart.js
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
import { Line, Doughnut } from "react-chartjs-2";

// Registra os componentes necessários do Chart.js
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

function DashboardPage() {
  const navigate = useNavigate();
  const { alertState, showSuccess, showError, showWarning, hideAlert } =
    useCustomAlert();
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  // ALTERADO: `devices` agora guardará os dispositivos do Tasmota (reais ou fictícios)
  const [devices, setDevices] = useState([]);

  // Estados para as métricas exibidas
  const [currentMonthConsumption, setCurrentMonthConsumption] =
    useState("0.00 kWh");
  const [dailyConsumption, setDailyConsumption] = useState("0.00 kWh");
  const [totalConsumption, setTotalConsumption] = useState("0.00 kWh");

  // Estado para controlar a seção ativa na sidebar
  const [activeSection, setActiveSection] = useState("inicio");

  // Estado para mensagens de feedback dos dispositivos
  const [deviceMessage, setDeviceMessage] = useState("");

  // NOVO: Estado para controlar o modo de visualização do gráfico (day, week, month)
  const [viewMode, setViewMode] = useState("day");

  // NOVO: Estado para indicar se os dados exibidos são reais ou fictícios
  const [isRealData, setIsRealData] = useState(false);
  // NOVO: Estado para a mensagem de dados fictícios
  const [fictionalDataMessage, setFictionalDataMessage] = useState("");

  // Cache para evitar logs repetitivos no frontend
  const [lastLoggedData, setLastLoggedData] = useState(null);
  const [lastLogTime, setLastLogTime] = useState(0);

  // Dados fictícios para os modos de visualização do gráfico principal.
  // Estes serão usados quando isRealData for false.
  const mockDailyData = {
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
  };

  const mockWeeklyData = {
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
  };

  const mockMonthlyData = {
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
  };

  // NOVO: Estado para armazenar o valor em tempo real do consumo total
  const [liveTotalEnergy, setLiveTotalEnergy] = useState(null);

  // Estados para modais de edição/exclusão de conta
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [editPassword, setEditPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // [1] Adicionar estado para menu mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // [2] Função para detectar largura da tela
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 700 && isMobileMenuOpen)
        setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileMenuOpen]);

  // [3] Função para fechar menu ao pressionar ESC
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileMenuOpen]);

  // Adicionar estado para mensagem de sessão expirada
  const [sessionExpired, setSessionExpired] = useState(false);

  // NOVO: Estado para armazenar o valor ao vivo de energia total dos dispositivos ligados
  const [liveTotalEnergySum, setLiveTotalEnergySum] = useState(0);

  // Adicione estados para armazenar o valor ao vivo de cada dispositivo
  const [liveTotalEnergyBroker1, setLiveTotalEnergyBroker1] = useState(0);
  const [liveTotalEnergyBroker2, setLiveTotalEnergyBroker2] = useState(0);

  // Função para buscar o valor ao vivo de energia total dos dispositivos ligados
  const fetchLiveTotalEnergySum = useCallback(async () => {
    const token = localStorage.getItem("token");
    const promises = devices
      .filter((d) => d.powerState)
      .map(async (d) => {
        try {
          const res = await fetch(
            API_ENDPOINTS.TASMOTA + `/devices/${d.id}/total-energy-live`,
            {
              headers: { Authorization: "Bearer " + token },
            }
          );
          const data = await res.json();
          return typeof data.totalEnergy === "number" ? data.totalEnergy : 0;
        } catch {
          return 0;
        }
      });
    const values = await Promise.all(promises);
    setLiveTotalEnergySum(values.reduce((sum, val) => sum + val, 0));
  }, [devices]);

  // Atualiza sempre que a lista de dispositivos mudar
  useEffect(() => {
    fetchLiveTotalEnergySum();
  }, [devices, fetchLiveTotalEnergySum]);

  // Função para buscar o valor ao vivo de energia total de cada dispositivo individualmente
  const fetchLiveTotalEnergyIndividual = useCallback(async () => {
    const token = localStorage.getItem("token");
    // Broker1 (Sonoff Sala)
    if (devices[0] && devices[0].powerState) {
      try {
        const res = await fetch(
          API_ENDPOINTS.TASMOTA + `/devices/${devices[0].id}/total-energy-live`,
          {
            headers: { Authorization: "Bearer " + token },
          }
        );
        const data = await res.json();
        setLiveTotalEnergyBroker1(
          typeof data.totalEnergy === "number" ? data.totalEnergy : 0
        );
      } catch {
        setLiveTotalEnergyBroker1(0);
      }
    } else {
      setLiveTotalEnergyBroker1(0);
    }
    // Broker2 (Sonoff Câmera)
    if (devices[1] && devices[1].powerState) {
      try {
        const res = await fetch(
          API_ENDPOINTS.TASMOTA + `/devices/${devices[1].id}/total-energy-live`,
          {
            headers: { Authorization: "Bearer " + token },
          }
        );
        const data = await res.json();
        setLiveTotalEnergyBroker2(
          typeof data.totalEnergy === "number" ? data.totalEnergy : 0
        );
      } catch {
        setLiveTotalEnergyBroker2(0);
      }
    } else {
      setLiveTotalEnergyBroker2(0);
    }
  }, [devices]);

  useEffect(() => {
    fetchLiveTotalEnergyIndividual();
  }, [devices, fetchLiveTotalEnergyIndividual]);

  // Adicionar estado para armazenar o gráfico pizza do backend
  const [consumptionByTypeChartData, setConsumptionByTypeChartData] =
    useState(null);

  // Estados para dados reais dos gráficos (dia e semana)
  const [realDailyChartData, setRealDailyChartData] = useState(null);
  const [realWeeklyChartData, setRealWeeklyChartData] = useState(null);
  const [realMonthlyChartData, setRealMonthlyChartData] = useState(null);

  // ALTERADO: `getChartData` agora usará dados reais quando `isRealData` for true.
  // Por enquanto, `daily_consumption_kwh` é mockado no backend para ambos, então esta parte não muda muito.
  // Mas no futuro, esta função precisaria buscar dados históricos REAIS.
  const getChartData = () => {
    switch (viewMode) {
      case "day":
        return realDailyChartData || mockDailyData;
      case "week":
        return realWeeklyChartData || mockWeeklyData;
      case "month":
        return realMonthlyChartData || mockMonthlyData;
      default:
        return realDailyChartData || mockDailyData;
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: `Consumo de Energia - ${
          viewMode === "day"
            ? "Diário"
            : viewMode === "week"
            ? "Semanal"
            : "Mensal"
        }`,
        color: "#FFF",
        font: { size: 18 },
      },
      tooltip: {
        backgroundColor: "rgba(0,0,0,0.8)",
        titleColor: "#FFF",
        bodyColor: "#FFF",
        borderColor: "#FFF",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#BBB" },
        grid: { color: "rgba(255,255,255,0.1)", borderColor: "#444" },
      },
      y: {
        ticks: {
          color: "#BBB",
          callback: function (value) {
            return Number(value).toFixed(2) + " kWh";
          },
        },
        grid: { color: "rgba(255,255,255,0.1)", borderColor: "#444" },
      },
    },
  };

  const consumptionByTypeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: { color: "#FFF" },
      },
      title: {
        display: true,
        text: "Consumo por Tipo de Dispositivo",
        color: "#FFF",
        font: { size: 18 },
      },
      tooltip: {
        backgroundColor: "rgba(0,0,0,0.8)",
        titleColor: "#FFF",
        bodyColor: "#FFF",
        borderColor: "#FFF",
        borderWidth: 1,
        callbacks: {
          label: function (context) {
            let label = context.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed !== null) {
              label += context.parsed.toFixed(2) + " kWh";
            }
            return label;
          },
        },
      },
    },
  };

  // NOVO: Função para alternar o status do dispositivo Tasmota via backend
  const toggleDevicePower = useCallback(
    async (deviceId, currentPowerState, deviceName) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setDeviceMessage("Você não está logado.");
        return;
      }

      const newState = currentPowerState ? "OFF" : "ON"; // Inverte o estado
      setDeviceMessage(`Enviando comando para ${deviceName}: ${newState}...`);

      try {
        const response = await fetch(
          `${API_ENDPOINTS.TASMOTA}/devices/${deviceId}/power`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ state: newState }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          setDeviceMessage(data.message);
          // O estado do dispositivo será atualizado no frontend quando o backend receber
          // a mensagem MQTT de confirmação do Tasmota e salvar no DB,
          // e o fetchDashboardData for chamado novamente (ou um mecanismo de atualização em tempo real).
          // Para simplificar, vou re-chamar o fetchDashboardData após um breve delay.
          setTimeout(() => {
            fetchDashboardData(); // Re-fetch para atualizar o estado dos dispositivos
          }, 2000); // Aumentado para 2 segundos para garantir atualização
        } else {
          setDeviceMessage(data.message || "Erro ao alternar o dispositivo.");
        }
      } catch (error) {
        setDeviceMessage("Erro de rede ao tentar controlar o dispositivo.");
        console.error("Erro ao controlar dispositivo:", error);
      } finally {
        setTimeout(() => setDeviceMessage(""), 5000); // Limpa a mensagem após 5 segundos
      }
    },
    []
  );

  // ALTERADO: `toggleDeviceStatus` para dispositivos mockados
  const toggleDeviceStatus = (id) => {
    setDevices((prevDevices) =>
      prevDevices.map((device) => {
        if (device.id === id && !isRealData) {
          // Apenas altere mocks se não for dado real
          const newStatus = device.powerState ? "off" : "on"; // Assuming powerState is boolean
          setDeviceMessage(
            `Dispositivo "${device.name}" ${
              newStatus === "on" ? "Ligado" : "Desligado"
            } (Fictício).`
          );
          setTimeout(() => setDeviceMessage(""), 3000);
          return { ...device, powerState: newStatus === "on" };
        }
        return device;
      })
    );
  };

  // Função centralizada para buscar os dados do dashboard
  const fetchDashboardData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setSessionExpired(true);
      return;
    }

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

        // Cache para evitar logs repetitivos
        const currentTime = Date.now();
        const timeSinceLastLog = currentTime - lastLogTime;
        const dataChanged = JSON.stringify(data) !== lastLoggedData;

        // Só loga se passou mais de 30 segundos ou se os dados mudaram significativamente
        if (!lastLoggedData || timeSinceLastLog > 30000 || dataChanged) {
          console.log("Dados do Dashboard (backend) recebidos:", data);
          setLastLoggedData(JSON.stringify(data));
          setLastLogTime(currentTime);
        }

        // NOVO: Define se os dados são reais ou fictícios
        setIsRealData(data.isRealData);
        if (!data.isRealData) {
          setFictionalDataMessage(
            "Os dados exibidos são fictícios. Conta não Admin!"
          );
        } else {
          setFictionalDataMessage("");
        }

        // ATUALIZADO: `setDevices` agora usa `data.userDevices`
        setDevices(data.userDevices || []);

        const chartDataArray =
          data.mainChartData &&
          data.mainChartData.datasets &&
          data.mainChartData.datasets[0]
            ? data.mainChartData.datasets[0].data
            : [];
        const totalConsumptionKwh = chartDataArray.reduce(
          (sum, val) => sum + val,
          0
        );
        setCurrentMonthConsumption(`${totalConsumptionKwh.toFixed(2)} kWh`);
        setTotalConsumption(`${totalConsumptionKwh.toFixed(2)} kWh`);
        if (chartDataArray.length > 0) {
          setDailyConsumption(
            `${chartDataArray[chartDataArray.length - 1].toFixed(2)} kWh`
          );
        } else {
          setDailyConsumption("0.00 kWh");
        }

        // NOVO: Salvar o gráfico pizza fictício do backend
        setConsumptionByTypeChartData(data.consumptionByTypeChartData || null);
      } else if (response.status === 401 || response.status === 403) {
        setSessionExpired(true);
        localStorage.removeItem("token");
        localStorage.removeItem("token_exp");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        return;
      } else {
        console.error("Erro ao carregar dados do Dashboard:", response.status);
      }
    } catch (error) {
      console.error("Erro de rede ao buscar dados do dashboard:", error);
    }
  }, [navigate]); // 'fetchDashboardData' agora depende apenas de 'navigate'"

  // Atualizar função para buscar Energia Total diretamente do endpoint live para admin
  const fetchLiveTotalEnergy = useCallback(async (deviceId) => {
    if (!deviceId) return;
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `${API_ENDPOINTS.TASMOTA}/devices/${deviceId}/total-energy-live`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setLiveTotalEnergy(data.totalEnergy);
      } else {
        setLiveTotalEnergy(0);
      }
    } catch (err) {
      setLiveTotalEnergy(0);
    }
  }, []);

  // Buscar o valor em tempo real sempre que o device principal mudar
  useEffect(() => {
    let intervalId;
    if (devices.length > 0 && devices[0].id) {
      fetchLiveTotalEnergy(devices[0].id);
      intervalId = setInterval(() => {
        fetchLiveTotalEnergy(devices[0].id);
      }, 5 * 60 * 1000); // 5 minutos
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [devices, fetchLiveTotalEnergy]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUserName = localStorage.getItem("userName");
    const storedUserEmail = localStorage.getItem("userEmail");

    if (!token) {
      setSessionExpired(true);
      return;
    }

    setUserName(storedUserName ? storedUserName.split("@")[0] : "");
    setUserEmail(storedUserEmail || "");

    fetchDashboardData(); // Chama a função para buscar os dados

    // Atualização automática a cada 10 segundos (aumentado de 5 para 10)
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 10000);

    // Limpa o intervalo ao sair do componente
    return () => clearInterval(interval);
  }, [navigate, fetchDashboardData]); // Dependência adicionada 'fetchDashboardData'

  // Função para logout (usada em vários lugares)
  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    navigate("/"); // Redireciona para a HomePage
  }, [navigate]);

  // Logout automático após 10 minutos
  useEffect(() => {
    const logoutTimer = setTimeout(() => {
      showWarning(
        "Por segurança, você foi desconectado após 10 minutos de sessão. Faça login novamente.",
        "Sessão Expirada"
      );
      setTimeout(() => {
        handleLogout();
      }, 3000);
    }, 600000); // 10 minutos
    return () => clearTimeout(logoutTimer);
  }, [handleLogout, showWarning]);

  // FUNÇÃO PARA GERAR O RELATÓRIO
  // ALTERADO: Adapte esta função para considerar `isRealData` e os dados reais.
  const generateReport = useCallback(() => {
    let totalSavings = 0;
    let totalOverspend = 0;
    let smartUsageCount = 0;
    let nonSmartUsageCount = 0;

    const devicesToReport = devices; // Usa os devices do estado, que já serão reais ou fictícios.

    const reportDetails = devicesToReport.map((device) => {
      // Se for dados reais, use latestReading.power. Se fictício, use um valor padrão.
      const currentConsumptionPower = device.latestReading
        ? device.latestReading.power
        : 0.1; // Watts
      const currentConsumptionKwh = device.latestReading
        ? device.latestReading.totalEnergy
        : 0.1; // kWh acumulado
      let recommendation = "";
      let potentialImpactKwh = 0; // Impacto em kWh

      // Lógica de recomendação: pode ser mais sofisticada com base em AI no futuro.
      // Por enquanto, exemplos baseados no estado/consumo.
      if (isRealData) {
        if (device.powerState && currentConsumptionPower > 100) {
          // Dispositivo ligado e com alto consumo (ex: 100W)
          recommendation =
            "Alto consumo atual. Considere automação para desligamento quando ocioso.";
          potentialImpactKwh = -(currentConsumptionKwh * 0.1); // Ex: 10% de potencial overspend
          nonSmartUsageCount++;
        } else if (!device.powerState) {
          recommendation = "Dispositivo desligado. Ótima gestão de energia!";
          potentialImpactKwh = currentConsumptionKwh * 0.05; // Ex: Pequena economia por estar desligado
          smartUsageCount++;
        } else {
          recommendation =
            "Uso normal. Verifique configurações para otimização contínua.";
          potentialImpactKwh = 0;
        }
      } else {
        // Dados Fictícios
        if (device.powerState && Math.random() > 0.7) {
          recommendation =
            "Sugerimos uso de temporizadores ou automação para desligar automaticamente.";
          potentialImpactKwh = -(currentConsumptionKwh * 0.5);
          nonSmartUsageCount++;
        } else if (!device.powerState && Math.random() > 0.3) {
          recommendation = "Dispositivo desligado. Ótima gestão de energia!";
          potentialImpactKwh = currentConsumptionKwh * 0.2;
          smartUsageCount++;
        } else {
          recommendation =
            "Uso consistente. Considere automação para otimização.";
          potentialImpactKwh = 0;
        }
      }

      if (potentialImpactKwh < 0) {
        totalOverspend += Math.abs(potentialImpactKwh);
      } else {
        totalSavings += potentialImpactKwh;
      }

      return {
        name: device.name,
        status: device.powerState ? "Ligado" : "Desligado", // Use powerState
        type: device.model || "Dispositivo", // Use model do Tasmota ou tipo genérico
        recommendation: recommendation,
        potentialImpact: potentialImpactKwh.toFixed(2),
      };
    });

    const overallImpact = totalSavings - totalOverspend;
    let overallMessage = "";
    if (overallImpact > 0) {
      overallMessage = `Com base no seu uso atual, há uma *potencial economia de energia de ${overallImpact.toFixed(
        2
      )} kWh* no próximo mês, caso adote as sugestões.`;
    } else if (overallImpact < 0) {
      overallMessage = `Seu consumo pode *aumentar em ${Math.abs(
        overallImpact
      ).toFixed(2)} kWh* no próximo mês sem otimização.`;
    } else {
      overallMessage =
        "Seu uso de energia está estável. Pequenos ajustes podem gerar economia.";
    }

    return {
      summary: {
        totalDevices: devicesToReport.length,
        smartUsageDevices: smartUsageCount,
        nonSmartUsageDevices: nonSmartUsageCount,
        totalSavings: totalSavings.toFixed(2),
        totalOverspend: totalOverspend.toFixed(2),
        overallMessage: overallMessage,
      },
      details: reportDetails,
    };
  }, [devices, isRealData]); // Dependências para useCallback

  const report = generateReport(); // Usa o nome genérico 'report'

  // Função para abrir modal de edição
  const openEditModal = () => {
    setEditName(userName);
    setEditPassword("");
    setEditError("");
    setShowEditModal(true);
  };
  // Função para editar nome/senha
  const handleEditAccount = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError("");
    const token = localStorage.getItem("token");
    if (!editName && !editPassword) {
      setEditError("Preencha um novo nome ou nova senha.");
      setEditLoading(false);
      return;
    }
    try {
      const response = await fetch(API_ENDPOINTS.ACCOUNT, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName !== userName ? editName : undefined,
          password: editPassword || undefined,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        showSuccess(
          "Dados atualizados com sucesso! Faça login novamente.",
          "Dados Atualizados!"
        );
        setShowEditModal(false);
        setTimeout(() => {
          handleLogout();
        }, 2000);
      } else {
        setEditError(data.message || "Erro ao atualizar dados.");
      }
    } catch (err) {
      setEditError("Erro de rede ao atualizar dados.");
    }
    setEditLoading(false);
  };
  // Função para abrir modal de exclusão
  const openDeleteModal = () => {
    setDeleteError("");
    setShowDeleteModal(true);
  };
  // Função para excluir conta
  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(API_ENDPOINTS.ACCOUNT, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        showSuccess("Conta excluída com sucesso!", "Conta Excluída!");
        setShowDeleteModal(false);
        setTimeout(() => {
          handleLogout();
        }, 2000);
      } else {
        setDeleteError(data.message || "Erro ao excluir conta.");
      }
    } catch (err) {
      setDeleteError("Erro de rede ao excluir conta.");
    }
    setDeleteLoading(false);
  };

  // Adicionar este useEffect para observar mudanças no token e resetar o estado do dashboard
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    // Resetar estados principais ao trocar de token (login/logout)
    setDevices([]);
    setIsRealData(false);
    setFictionalDataMessage("");
    setCurrentMonthConsumption("0.00 kWh");
    setDailyConsumption("0.00 kWh");
    setTotalConsumption("0.00 kWh");
    fetchDashboardData();
  }, [localStorage.getItem("token")]);

  // Função utilitária para pegar energia total por broker
  function getTotalEnergyByBroker(devices, brokerLabel) {
    const device = devices.find((d) => d.broker === brokerLabel);
    return device &&
      device.latestReading &&
      typeof device.latestReading.totalEnergy === "number"
      ? device.latestReading.totalEnergy
      : 0;
  }

  // [NOVO] Estado para controlar a seção EcoBot
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "EcoBot",
      text: "🤖 **Olá! Eu sou o EcoBot, seu assistente de energia!**\n\nPosso te explicar sobre:\n\n⚡ **Conceitos elétricos:** Tensão, corrente, potências, fator de potência\n💰 **Economia:** O que influencia sua conta de energia\n🔌 **Diferenças:** 110V vs 220V no Brasil\n\nPergunte sobre qualquer tema relacionado à energia elétrica!",
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // [NOVO] Função inteligente para responder perguntas sobre energia
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();

    // Adicionar mensagem do usuário ao chat
    setChatMessages((prev) => [
      ...prev,
      { sender: userName, text: userMessage },
    ]);

    // Limpar input imediatamente
    setChatInput("");

    // Processar a mensagem e gerar resposta inteligente
    setTimeout(() => {
      const botResponse = generateEcoBotResponse(userMessage);

      // Adicionar resposta do bot ao chat
      setChatMessages((prev) => [
        ...prev,
        { sender: "EcoBot", text: botResponse },
      ]);
    }, 800);
  };

  // [NOVO] Função para gerar respostas inteligentes do EcoBot
  const generateEcoBotResponse = (userMessage) => {
    const message = userMessage.toLowerCase();

    // Perguntas sobre Tensão
    if (
      message.includes("tensão") ||
      message.includes("voltagem") ||
      message.includes("110v") ||
      message.includes("220v")
    ) {
      if (
        message.includes("diferença") ||
        message.includes("por que") ||
        message.includes("brasil")
      ) {
        return `🔌 **Diferenças de Tensão no Brasil:**

No Brasil, temos duas tensões principais:
• **110V**: Mais comum no Nordeste e algumas regiões do Sudeste
• **220V**: Mais comum no Sul, Centro-Oeste e parte do Sudeste

**Por que isso acontece?**
Historicamente, cada região escolheu uma tensão baseada em:
• Disponibilidade de equipamentos na época
• Infraestrutura elétrica existente
• Padrões internacionais adotados

**Impacto na conta:**
A tensão NÃO afeta o valor da sua conta de energia. O que importa é o **consumo em kWh**, independente se é 110V ou 220V.`;
      } else {
        return `⚡ **O que é Tensão Elétrica?**

**Tensão (Voltagem)** é a "força" que empurra os elétrons através dos fios elétricos. É medida em **Volts (V)**.

**Como funciona:**
• **110V**: Menor força, mais segura para contato acidental
• **220V**: Maior força, mais eficiente para equipamentos de alta potência

**Exemplos práticos:**
• **110V**: Lâmpadas, TV, computador, carregadores
• **220V**: Ar condicionado, máquina de lavar, chuveiro elétrico`;
      }
    }

    // Perguntas sobre Corrente
    if (
      message.includes("corrente") ||
      message.includes("amperes") ||
      message.includes("amp")
    ) {
      return `⚡ **O que é Corrente Elétrica?**

**Corrente** é o fluxo de elétrons através de um condutor. É medida em **Amperes (A)**.

**Analogia simples:**
Imagine um rio:
• **Tensão (V)** = Altura da queda d'água
• **Corrente (A)** = Quantidade de água que passa por segundo
• **Potência (W)** = Força total da água

**Exemplos práticos:**
• **1A**: Lâmpada LED pequena
• **5A**: TV ou computador
• **10A**: Ar condicionado pequeno
• **20A+**: Chuveiro elétrico, máquina de lavar`;
    }

    // Perguntas sobre Potência
    if (
      message.includes("potência") ||
      message.includes("watts") ||
      message.includes("watt")
    ) {
      return `⚡ **O que é Potência Elétrica?**

**Potência** é a quantidade de energia consumida por segundo. É medida em **Watts (W)**.

**Fórmula fundamental:**
**Potência (W) = Tensão (V) × Corrente (A)**

**Exemplos práticos:**
• **Lâmpada LED**: 9W
• **TV**: 100-200W
• **Computador**: 200-500W
• **Ar condicionado**: 1000-3000W
• **Chuveiro elétrico**: 4000-6000W

**Dica importante:**
Quanto maior a potência, maior o consumo de energia e maior o impacto na sua conta!`;
    }

    // Perguntas sobre kWh
    if (
      message.includes("kwh") ||
      message.includes("quilowatt") ||
      message.includes("energia")
    ) {
      return `⚡ **O que é kWh (Quilowatt-hora)?**

**kWh** é a unidade de medida da **energia elétrica consumida**.

**Como calcular:**
**Energia (kWh) = Potência (W) × Tempo (h) ÷ 1000**

**Exemplos práticos:**
• **Lâmpada 9W ligada por 1 hora** = 0,009 kWh
• **TV 100W ligada por 2 horas** = 0,2 kWh
• **Ar condicionado 2000W por 1 hora** = 2 kWh

**Na sua conta:**
A concessionária cobra por cada kWh consumido. Quanto mais tempo você deixar os aparelhos ligados, maior será o consumo!`;
    }

    // Perguntas sobre Fator de Potência
    if (
      message.includes("fator de potência") ||
      message.includes("fator") ||
      message.includes("potência aparente")
    ) {
      return `⚡ **O que é Fator de Potência?**

**Fator de Potência** é a relação entre potência ativa (real) e potência aparente. Varia de 0 a 1.

**Tipos de Potência:**
• **Potência Ativa (W)**: Energia realmente consumida
• **Potência Aparente (VA)**: Energia total fornecida
• **Potência Reativa (var)**: Energia que "vai e volta"

**Fator de Potência = Potência Ativa ÷ Potência Aparente**

**Exemplos:**
• **Resistivo (lâmpada, chuveiro)**: Fator = 1,0 (ideal)
• **Indutivo (motor, transformador)**: Fator < 1,0
• **Capacitivo (capacitor)**: Fator < 1,0

**Importância:**
Fatores baixos podem gerar multas na conta de energia!`;
    }

    // Perguntas sobre Economia
    if (
      message.includes("economia") ||
      message.includes("economizar") ||
      message.includes("conta") ||
      message.includes("gasto")
    ) {
      return `💰 **Como Economizar Energia Elétrica?**

**Dicas práticas:**
• **Desligue aparelhos em standby** (TV, computador, carregadores)
• **Use lâmpadas LED** (consomem até 80% menos)
• **Ajuste a temperatura do ar condicionado** (cada grau = 7% de economia)
• **Acumule roupas** para usar a máquina de lavar cheia
• **Prefira o chuveiro elétrico** no modo verão

**Hábitos que fazem diferença:**
• **Desligar luzes** ao sair dos cômodos
• **Usar a luz natural** quando possível
• **Manter geladeira** longe de fontes de calor
• **Limpar filtros** do ar condicionado regularmente

**Lembre-se:** Pequenas mudanças geram grandes economias ao longo do tempo!`;
    }

    // Resposta padrão para perguntas não reconhecidas
    return `🤖 **Olá! Eu sou o EcoBot, seu assistente de energia!**

Posso te explicar sobre:

⚡ **Conceitos elétricos:** Tensão, corrente, potências, fator de potência
💰 **Economia:** O que influencia sua conta de energia
🔌 **Diferenças:** 110V vs 220V no Brasil

**Pergunte sobre qualquer tema relacionado à energia elétrica!**

**Exemplos de perguntas:**
• "O que é tensão elétrica?"
• "Diferença entre 110V e 220V no Brasil"
• "Como economizar energia?"
• "O que é kWh?"
• "Fator de potência"`;
  };

  // ========== ESTADOS PARA AGENDAMENTO DE DESLIGAMENTO ==========
  const [scheduleDevice, setScheduleDevice] = useState("");
  const [scheduleDay, setScheduleDay] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleRepeat, setScheduleRepeat] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [scheduleMessageColor, setScheduleMessageColor] = useState("#1976d2");
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [enableTimers, setEnableTimers] = useState(false);
  // NOVO: Estado para ação ON/OFF
  const [scheduleAction, setScheduleAction] = useState("OFF");

  // Estados auxiliares para dropdowns
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [showDayDropdown, setShowDayDropdown] = useState(false);
  // Estado auxiliar para dropdown de slot
  const [showSlotDropdown, setShowSlotDropdown] = useState(false);

  // Substituir opções de dispositivos para usuários não admin
  const nonAdminDevices = [
    { value: "lampada_sala", label: "Lâmpada Sala" },
    { value: "tomada_cozinha", label: "Tomada Cozinha" },
    { value: "ar_condicionado", label: "Ar Condicionado" },
    { value: "chuveiro", label: "Chuveiro" },
    { value: "tv_sala", label: "TV Sala" },
    { value: "ambos", label: "Ambos" },
  ];

  // Novo estado para controlar o dropdown customizado dos dispositivos fictícios
  const [showNonAdminDeviceDropdown, setShowNonAdminDeviceDropdown] =
    useState(false);

  // Função para enviar agendamento para o backend
  async function handleScheduleShutdown(e) {
    e.preventDefault();
    setScheduleMessage("");
    setScheduleMessageColor("#1976d2");
    if (!isRealData) {
      setTimeout(() => {
        setScheduleMessage("Agendamento fictício realizado com sucesso!");
        setScheduleMessageColor("green");
        setScheduleDevice("");
        setScheduleDay("");
        setScheduleTime("");
        setScheduleRepeat(false);
        // NOVO: resetar ação para OFF
        setScheduleAction("OFF");
      }, 500);
      return;
    }
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(API_ENDPOINTS.TASMOTA + "/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          device: scheduleDevice,
          day: scheduleDay,
          time: scheduleTime,
          repeat: scheduleRepeat,
          slot: selectedSlot,
          enableTimers: enableTimers,
          action: scheduleAction, // NOVO: envia ação ON/OFF
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setScheduleMessage("Agendamento realizado com sucesso!");
        setScheduleMessageColor("green");
        setScheduleDevice("");
        setScheduleDay("");
        setScheduleTime("");
        setScheduleRepeat(false);
        setScheduleAction("OFF"); // resetar para OFF
      } else {
        setScheduleMessage(data.message || "Erro ao agendar desligamento.");
        setScheduleMessageColor("red");
      }
    } catch (err) {
      setScheduleMessage("Erro de conexão com o servidor.");
      setScheduleMessageColor("red");
    }
  }

  const getConsumptionByTypeData = () => {
    // Se não for admin e existir dado fictício do backend, usa ele direto
    if (
      !isRealData &&
      consumptionByTypeChartData &&
      consumptionByTypeChartData.labels &&
      consumptionByTypeChartData.data
    ) {
      return {
        labels: consumptionByTypeChartData.labels,
        datasets: [
          {
            data: consumptionByTypeChartData.data,
            backgroundColor: consumptionByTypeChartData.backgroundColor,
            borderColor: consumptionByTypeChartData.backgroundColor?.map((c) =>
              c.replace("0.7", "1")
            ),
            borderWidth: 1,
          },
        ],
      };
    }
    // Lógica antiga para admin
    if (devices.length >= 2) {
      const sala = devices[0];
      const camera = devices[1];
      const salaYesterday =
        sala.latestReading &&
        typeof sala.latestReading.EnergyYesterday === "number"
          ? sala.latestReading.EnergyYesterday
          : 0;
      const cameraYesterday =
        camera.latestReading &&
        typeof camera.latestReading.EnergyYesterday === "number"
          ? camera.latestReading.EnergyYesterday
          : 0;
      return {
        labels: ["Sala", "Câmera"],
        datasets: [
          {
            data: [salaYesterday, cameraYesterday],
            backgroundColor: ["#00bcd4", "#ff9800"],
            borderColor: ["#00838f", "#f57c00"],
            borderWidth: 1,
          },
        ],
      };
    }
    // Fallback para lógica antiga se não houver dois dispositivos
    const deviceTypeConsumption = {};
    devices.forEach((device) => {
      const type = device.model || "Dispositivo de Energia";
      const consumption =
        device.latestReading &&
        typeof device.latestReading.EnergyYesterday === "number"
          ? device.latestReading.EnergyYesterday
          : 0;
      if (deviceTypeConsumption[type]) {
        deviceTypeConsumption[type] += consumption;
      } else {
        deviceTypeConsumption[type] = consumption;
      }
    });
    const labels = Object.keys(deviceTypeConsumption);
    const data = Object.values(deviceTypeConsumption);
    const singleColor = ["#00bcd4"];
    const singleBorder = ["#00838f"];
    const backgroundColors =
      labels.length === 1
        ? singleColor
        : [
            "#00bcd4",
            "#ff9800",
            "#e91e63",
            "#4caf50",
            "#9c27b0",
            "#f44336",
            "#2196f3",
            "#ffeb3b",
          ];
    const borderColors =
      labels.length === 1
        ? singleBorder
        : [
            "#00838f",
            "#f57c00",
            "#c2185b",
            "#388e3c",
            "#7b1fa2",
            "#d32f2f",
            "#1976d2",
            "#fbc02d",
          ];
    return {
      labels: labels.length > 0 ? labels : ["Nenhum dado"],
      datasets: [
        {
          data: data.length > 0 ? data : [1],
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    };
  };

  const getSuggestedDevicesData = () => {
    if (!isRealData) {
      return [
        {
          id: 1,
          name: "Lâmpada do Quarto (Fictícia)",
          suggestion: "Instalar temporizador para desligar automaticamente.",
        },
        {
          id: 2,
          name: "Ar Condicionado (Fictício)",
          suggestion: "Configurar automação para ajustar temperatura ao sair.",
        },
        {
          id: 3,
          name: "Geladeira (Fictícia)",
          suggestion:
            "Verificar vedação da porta para evitar perda de energia.",
        },
        {
          id: 4,
          name: "TV da Sala (Fictícia)",
          suggestion: "Ativar modo de economia de energia nas configurações.",
        },
      ];
    }
    // Lógica para dados reais (simplificada)
    const suggestions = [];
    devices.forEach((device) => {
      if (
        device.powerState &&
        device.latestReading &&
        device.latestReading.power > 100
      ) {
        suggestions.push({
          id: device.id,
          name: device.name,
          suggestion: `Dispositivo ligado com alto consumo (${device.latestReading.power}W). Considere automação ou desligamento quando não estiver em uso.`,
        });
      } else if (!device.powerState) {
        suggestions.push({
          id: device.id,
          name: device.name,
          suggestion: `Dispositivo ${device.name} está desligado. Ótima gestão de energia!`,
        });
      } else {
        suggestions.push({
          id: device.id,
          name: device.name,
          suggestion: `Consumo de ${device.name} está normal. Pequenos ajustes podem otimizar mais.`,
        });
      }
    });
    return suggestions;
  };

  // Adicione o useEffect para fechar dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event) {
      // Dispositivo
      if (
        showDeviceDropdown &&
        !event.target.closest(".device-dropdown-btn") &&
        !event.target.closest(".device-dropdown-menu")
      ) {
        setShowDeviceDropdown(false);
      }
      // Dias da Semana
      if (
        showDayDropdown &&
        !event.target.closest(".day-dropdown-btn") &&
        !event.target.closest(".day-dropdown-menu")
      ) {
        setShowDayDropdown(false);
      }
      // Slots
      if (
        showSlotDropdown &&
        !event.target.closest(".slot-dropdown-btn") &&
        !event.target.closest(".slot-dropdown-menu")
      ) {
        setShowSlotDropdown(false);
      }
    }
    if (showDeviceDropdown || showDayDropdown || showSlotDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDeviceDropdown, showDayDropdown, showSlotDropdown]);

  // Buscar dados reais quando usuário é admin (isRealData) e modo de visualização mudar
  useEffect(() => {
    const fetchRealCharts = async () => {
      const token = localStorage.getItem("token");
      if (!token || !isRealData) return;
      try {
        if (viewMode === "day") {
          const res = await fetch(
            API_ENDPOINTS.DASHBOARD_CHART_DAILY_YESTERDAY,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (res.ok) {
            const data = await res.json();
            setRealDailyChartData({
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
        } else if (viewMode === "week") {
          const res = await fetch(
            API_ENDPOINTS.DASHBOARD_CHART_WEEKLY_YESTERDAY,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (res.ok) {
            const data = await res.json();
            setRealWeeklyChartData({
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
        } else if (viewMode === "month") {
          const res = await fetch(
            API_ENDPOINTS.DASHBOARD_CHART_MONTHLY_ENERGY_DATA,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (res.ok) {
            const data = await res.json();
            setRealMonthlyChartData({
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
        }
      } catch (e) {
        console.warn("Falha ao buscar gráficos reais:", e);
      }
    };
    fetchRealCharts();
  }, [viewMode, isRealData]);

  if (sessionExpired) {
    return (
      <div
        className="modal-overlay"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0,0,0,0.5)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="modal-content"
          style={{
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 4px 32px rgba(0,0,0,0.2)",
            padding: 32,
            maxWidth: 350,
            width: "90%",
            textAlign: "center",
            position: "relative",
          }}
        >
          <img
            src="/icon.png"
            alt="Ícone"
            style={{
              width: 64,
              height: 64,
              marginBottom: 16,
              marginTop: -48,
            }}
          />{" "}
          <h2 style={{ marginBottom: 16, color: "#222" }}>
            Sua sessão expirou <br /> faça login novamente!!
          </h2>{" "}
          <button
            style={{
              marginTop: 16,
              padding: "10px 32px",
              background: "#00bcd4",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 18,
              fontWeight: "bold",
              cursor: "pointer",
            }}
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("token_exp");
              localStorage.removeItem("userName");
              localStorage.removeItem("userEmail");
              setSessionExpired(false);
              navigate("/");
            }}
          >
            OK{" "}
          </button>{" "}
        </div>{" "}
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* ==================== SIDEBAR ==================== */}
      <div className="sidebar">
        <div className="logo-icon-sidebar">
          <img src="/icon.png" alt="Smart Energy" />
        </div>
        <div
          className={`menu-item ${activeSection === "inicio" ? "active" : ""}`}
          onClick={() => setActiveSection("inicio")}
        >
          {" "}
          Home{" "}
        </div>
        <div
          className={`menu-item ${
            activeSection === "controle" ? "active" : ""
          }`}
          onClick={() => setActiveSection("controle")}
        >
          {" "}
          Controle de Energia{" "}
        </div>
        <div
          className={`menu-item ${
            activeSection === "relatorios" ? "active" : ""
          }`}
          onClick={() => setActiveSection("relatorios")}
        >
          {" "}
          Relatórios{" "}
        </div>
        <div
          className={`menu-item ${activeSection === "ecobot" ? "active" : ""}`}
          onClick={() => setActiveSection("ecobot")}
        >
          <img src={process.env.PUBLIC_URL + "/ST.png"} alt="EcoBot" />
          EcoBot{" "}
        </div>
        <div
          className={`menu-item ${
            activeSection === "configuracoes" ? "active" : ""
          }`}
          onClick={() => setActiveSection("configuracoes")}
        >
          {" "}
          Configurações{" "}
        </div>
        <div className="sidebar-bottom">
          <button onClick={handleLogout} className="logout-button-sidebar">
            <span style={{ fontSize: "1rem" }}></span>
            Sair
          </button>
        </div>
      </div>
      {/* ==================== MOBILE MENU ==================== */}{" "}
      {window.innerWidth <= 700 && (
        <div className="mobile-menu-bar">
          <img src="/icon.png" alt="Ícone" className="mobile-menu-icon" />
          <span className="mobile-menu-title">Smart Energy</span>
          <button
            className="hamburger-btn"
            onClick={() => {
              if (isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
              } else {
                setIsMobileMenuOpen(true);
              }
            }}
          >
            <span className="hamburger-icon">
              {isMobileMenuOpen ? "✕" : "☰"}
            </span>
          </button>
        </div>
      )}
      {/* Mobile Menu Overlay */}
      {/* Mobile Sidebar Overlay */}
      {window.innerWidth <= 700 && isMobileMenuOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      {/* Mobile Sidebar Menu */}
      {window.innerWidth <= 700 && (
        <div className={`mobile-sidebar ${isMobileMenuOpen ? "open" : ""}`}>
          <div className="mobile-sidebar-header">
            <span className="mobile-sidebar-title">Smart Energy</span>
            <button
              className="mobile-sidebar-close-btn"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="mobile-sidebar-content">
            <div
              className="mobile-sidebar-item"
              onClick={() => {
                setActiveSection("inicio");
                setIsMobileMenuOpen(false);
              }}
            >
              Home
            </div>

            <div
              className="mobile-sidebar-item"
              onClick={() => {
                setActiveSection("controle");
                setIsMobileMenuOpen(false);
              }}
            >
              Controle de Energia
            </div>

            <div
              className="mobile-sidebar-item"
              onClick={() => {
                setActiveSection("relatorios");
                setIsMobileMenuOpen(false);
              }}
            >
              Relatórios
            </div>

            <div
              className="mobile-sidebar-item"
              onClick={() => {
                setActiveSection("ecobot");
                setIsMobileMenuOpen(false);
              }}
            >
              <img
                src={process.env.PUBLIC_URL + "/ST.png"}
                alt="EcoBot"
                style={{ width: "20px", height: "20px", marginRight: "10px" }}
              />
              EcoBot
            </div>

            <div
              className="mobile-sidebar-item"
              onClick={() => {
                setActiveSection("configuracoes");
                setIsMobileMenuOpen(false);
              }}
            >
              Configurações
            </div>

            <div
              className="mobile-sidebar-item mobile-sidebar-logout"
              onClick={() => {
                handleLogout();
                setIsMobileMenuOpen(false);
              }}
            >
              Sair da Conta
            </div>
          </div>
        </div>
      )}
      {/* ==================== MAIN CONTENT ==================== */}{" "}
      <div className="main-content">
        {" "}
        {/* Data Mode Notification */}{" "}
        {fictionalDataMessage && (
          <div className="data-mode-notification"> {fictionalDataMessage} </div>
        )}
        {/* ========== HOME SECTION ========== */}{" "}
        {activeSection === "inicio" && (
          <>
            <h2> Olá, {userName}! </h2>
            {/* Metrics Grid */}
            <div className="metrics-grid">
              <div className="metric-card">
                <h3>Consumo Atual (Watts)</h3>
                <p>
                  {devices.length > 0
                    ? devices
                        .reduce(
                          (sum, d) =>
                            sum +
                            (d.latestReading &&
                            d.powerState &&
                            typeof d.latestReading.power === "number"
                              ? d.latestReading.power
                              : 0),
                          0
                        )
                        .toFixed(2) + " W"
                    : "0.00 W"}
                </p>
              </div>
              <div className="metric-card">
                <h3>Consumo Mensal (kWh)</h3>
                <p>{currentMonthConsumption}</p>
              </div>
              <div className="metric-card">
                <h3>Consumo Total (kWh)</h3>
                <p>{liveTotalEnergySum.toFixed(2)} kWh</p>
              </div>
              <div className="metric-card">
                <h3>Fatura Estimada</h3>
                <p>
                  R${" "}
                  {(devices.length > 0
                    ? devices.reduce(
                        (sum, d) =>
                          sum +
                          (d.latestReading &&
                          d.powerState &&
                          typeof d.latestReading.totalEnergy === "number"
                            ? d.latestReading.totalEnergy
                            : 0),
                        0
                      ) * 0.75
                    : 0
                  ).toFixed(2)}
                </p>
              </div>
              <div className="metric-card">
                <h3>Corrente Atual (A)</h3>
                <p>
                  {devices
                    .filter(
                      (d) =>
                        d.powerState &&
                        d.latestReading &&
                        typeof d.latestReading.current === "number"
                    )
                    .reduce((sum, d) => sum + d.latestReading.current, 0)
                    .toFixed(2)}
                  A
                </p>
              </div>
              <div className="metric-card">
                <h3>Economia Mensal</h3>
                <p>R$ 12,50</p>
              </div>
            </div>
            {/* Main Chart Area */}
            <div className="chart-area-main">
              <div className="chart-card-main">
                <div className="view-mode-buttons">
                  <button
                    onClick={() => setViewMode("day")}
                    className={
                      viewMode === "day" ? "active-view-button" : "view-button"
                    }
                  >
                    Dia
                  </button>
                  <button
                    onClick={() => setViewMode("week")}
                    className={
                      viewMode === "week" ? "active-view-button" : "view-button"
                    }
                  >
                    Semana
                  </button>
                  <button
                    onClick={() => setViewMode("month")}
                    className={
                      viewMode === "month"
                        ? "active-view-button"
                        : "view-button"
                    }
                  >
                    Mês
                  </button>
                </div>
                <div className="chart-container-wrapper">
                  {getChartData().labels.length > 0 ? (
                    <Line data={getChartData()} options={chartOptions} />
                  ) : (
                    <p className="chart-loading-message">
                      Carregando dados do gráfico...
                    </p>
                  )}
                </div>
                <button
                  className="expand-chart-button"
                  onClick={() => navigate("/grafico-cheio")}
                >
                  Expandir Gráfico
                </button>
              </div>
            </div>
            {/* Bottom Sections */}{" "}
            <div className="bottom-sections-grid">
              <div className="bottom-card consumption-by-type-card">
                <div className="chart-legend-vertical">
                  <div className="chart-wrapper-pizza">
                    <Doughnut
                      data={getConsumptionByTypeData()}
                      options={{
                        ...consumptionByTypeOptions,
                        plugins: {
                          ...consumptionByTypeOptions.plugins,
                          legend: { display: false },
                          datalabels: { display: false },
                        },
                      }}
                    />
                  </div>
                  <div className="legend-list">
                    {(() => {
                      const data = getConsumptionByTypeData();
                      const total = data.datasets[0].data.reduce(
                        (a, b) => a + b,
                        0
                      );
                      return data.labels.map((label, idx) => {
                        const percent =
                          total > 0
                            ? (
                                (data.datasets[0].data[idx] / total) *
                                100
                              ).toFixed(1)
                            : "0.0";
                        return (
                          <span className="legend-item" key={label}>
                            <span
                              className="legend-color"
                              style={{
                                background:
                                  data.datasets[0].backgroundColor[idx],
                              }}
                            />
                            <span className="legend-label">{label}:</span>
                            <span className="legend-value">{percent} %</span>
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
              <div className="bottom-card suggested-devices-card">
                <h3> Dispositivos Sugeridos </h3>{" "}
                <p className="suggestions-description">
                  Sugestões para otimizar o consumo de energia em seus
                  dispositivos.{" "}
                </p>{" "}
                <ul className="device-suggestion-list">
                  {getSuggestedDevicesData().length > 0 ? (
                    getSuggestedDevicesData().map((device) => (
                      <li key={device.id}>
                        <strong> {device.name}: </strong> {device.suggestion}
                      </li>
                    ))
                  ) : (
                    <li className="no-suggestions-message">
                      Nenhuma sugestão no momento.
                    </li>
                  )}
                </ul>{" "}
              </div>{" "}
            </div>{" "}
          </>
        )}
        {/* ========== ENERGY CONTROL SECTION ========== */}
        {activeSection === "controle" && (
          <>
            <h2>Controle de Dispositivos</h2>
            <div className="energy-control-section">
              {deviceMessage && (
                <p className="device-feedback-message">{deviceMessage}</p>
              )}
              <h3>Meus Dispositivos de Energia</h3>
              {devices.length > 0 ? (
                <div className="device-control-list">
                  {devices.map((device) => (
                    <div key={device.id} className="device-control-item">
                      <span className="device-control-name">{device.name}</span>
                      <div className="device-control-buttons">
                        <button
                          onClick={() =>
                            toggleDevicePower(
                              device.id,
                              device.powerState,
                              device.name
                            )
                          }
                          className="device-toggle-button power-on"
                          type="button"
                          disabled={device.powerState}
                        >
                          Ligar
                        </button>
                        <button
                          onClick={() =>
                            toggleDevicePower(
                              device.id,
                              device.powerState,
                              device.name
                            )
                          }
                          className="device-toggle-button power-off"
                          type="button"
                          disabled={!device.powerState}
                        >
                          Desligar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-devices-message">
                  Nenhum dispositivo encontrado.
                </p>
              )}
            </div>
            {/* Card: Agendar Desligamento */}
            <div className="schedule-shutdown-card">
              <h2 className="schedule-card-title">Agendar ON/OFF</h2>
              <form
                onSubmit={handleScheduleShutdown}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                {/* Dispositivo */}
                <div
                  className="form-group"
                  style={{ position: "relative", marginBottom: 18 }}
                >
                  <label
                    style={{
                      textAlign: "center",
                      width: "100%",
                      display: "block",
                    }}
                  >
                    Dispositivo:
                  </label>
                  <div
                    style={{ width: "100%", maxWidth: 260, margin: "0 auto" }}
                  >
                    {!isRealData ? (
                      <div style={{ position: "relative", width: "100%" }}>
                        <button
                          type="button"
                          onClick={() =>
                            setShowNonAdminDeviceDropdown((v) => !v)
                          }
                          style={{
                            width: "100%",
                            background: "#23243a",
                            color: scheduleDevice ? "#fff" : "#bbb",
                            border: "2px solid #4a4a7e",
                            borderRadius: 10,
                            padding: "10px 18px",
                            fontWeight: "bold",
                            fontSize: "1rem",
                            cursor: "pointer",
                            textAlign: "left",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            transition: "all 0.2s",
                          }}
                          className="device-dropdown-btn"
                        >
                          {scheduleDevice
                            ? nonAdminDevices.find(
                                (opt) => opt.value === scheduleDevice
                              )?.label || "Selecionar"
                            : "Selecionar"}
                          <span style={{ marginLeft: 8, fontSize: 18 }}>
                            &#9662;
                          </span>
                        </button>
                        {showNonAdminDeviceDropdown && (
                          <div
                            style={{
                              position: "absolute",
                              top: 48,
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: 220,
                              background: "#23243a",
                              border: "2px solid #4a4a7e",
                              borderRadius: 10,
                              zIndex: 10,
                              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 6,
                              padding: 8,
                            }}
                          >
                            {nonAdminDevices.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setScheduleDevice(opt.value);
                                  setShowNonAdminDeviceDropdown(false);
                                }}
                                style={{
                                  background:
                                    scheduleDevice === opt.value
                                      ? "#00bcd4"
                                      : "#23243a",
                                  color:
                                    scheduleDevice === opt.value
                                      ? "#fff"
                                      : "#bbb",
                                  border:
                                    scheduleDevice === opt.value
                                      ? "2px solid #00bcd4"
                                      : "2px solid #4a4a7e",
                                  borderRadius: 8,
                                  padding: "7px 4px",
                                  fontWeight: "bold",
                                  fontSize: "0.92rem",
                                  cursor: "pointer",
                                  margin: 2,
                                  minWidth: 0,
                                  minHeight: 0,
                                  textAlign: "center",
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowDeviceDropdown((v) => !v)}
                        style={{
                          width: "100%",
                          background: "#23243a",
                          color: scheduleDevice ? "#fff" : "#bbb",
                          border: "2px solid #4a4a7e",
                          borderRadius: 10,
                          padding: "10px 18px",
                          fontWeight: "bold",
                          fontSize: "1rem",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          transition: "all 0.2s",
                        }}
                        className="device-dropdown-btn"
                      >
                        {scheduleDevice
                          ? [
                              { value: "sala", label: "Sala" },
                              { value: "camera", label: "Câmera" },
                              { value: "ambos", label: "Ambos" },
                            ].find((opt) => opt.value === scheduleDevice)
                              ?.label || "Selecionar"
                          : "Selecionar"}
                        <span style={{ marginLeft: 8, fontSize: 18 }}>
                          &#9662;
                        </span>
                      </button>
                    )}
                    {isRealData && showDeviceDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: 48,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 220,
                          background: "#23243a",
                          border: "2px solid #4a4a7e",
                          borderRadius: 10,
                          zIndex: 10,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                          display: "flex",
                          flexDirection: "column",
                        }}
                        className="device-dropdown-menu"
                      >
                        {[
                          { value: "sala", label: "Sala" },
                          { value: "camera", label: "Câmera" },
                          { value: "ambos", label: "Ambos" },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setScheduleDevice(opt.value);
                              setShowDeviceDropdown(false);
                            }}
                            style={{
                              background:
                                scheduleDevice === opt.value
                                  ? "#00bcd4"
                                  : "#23243a",
                              color:
                                scheduleDevice === opt.value ? "#fff" : "#bbb",
                              border: "none",
                              borderBottom: "1px solid #444",
                              borderRadius: 0,
                              padding: "7px 10px",
                              fontWeight: "bold",
                              fontSize: "0.95rem",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.2s",
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Dia da Semana */}
                <div
                  className="form-group"
                  style={{ position: "relative", marginBottom: 18 }}
                >
                  <label
                    style={{
                      textAlign: "center",
                      width: "100%",
                      display: "block",
                    }}
                  >
                    Dia da Semana:
                  </label>
                  <div
                    style={{ width: "100%", maxWidth: 260, margin: "0 auto" }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowDayDropdown((v) => !v)}
                      style={{
                        width: "100%",
                        background: "#23243a",
                        color: scheduleDay ? "#fff" : "#bbb",
                        border: "2px solid #4a4a7e",
                        borderRadius: 10,
                        padding: "10px 18px",
                        fontWeight: "bold",
                        fontSize: "1rem",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.2s",
                      }}
                      className="day-dropdown-btn"
                    >
                      {scheduleDay
                        ? [
                            { value: "todos", label: "Todos" },
                            { value: "domingo", label: "Dom" },
                            { value: "segunda", label: "Seg" },
                            { value: "terca", label: "Ter" },
                            { value: "quarta", label: "Qua" },
                            { value: "quinta", label: "Qui" },
                            { value: "sexta", label: "Sex" },
                            { value: "sabado", label: "Sáb" },
                          ].find((opt) => opt.value === scheduleDay)?.label ||
                          "Selecionar"
                        : "Selecionar"}
                      <span style={{ marginLeft: 8, fontSize: 18 }}>
                        &#9662;
                      </span>
                    </button>
                    {showDayDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: 48,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 220,
                          maxHeight: 220,
                          overflowY: "auto",
                          background: "#23243a",
                          border: "2px solid #4a4a7e",
                          borderRadius: 10,
                          zIndex: 10,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 0,
                        }}
                        className="day-dropdown-menu"
                      >
                        {[
                          { value: "todos", label: "Todos" },
                          { value: "domingo", label: "Dom" },
                          { value: "segunda", label: "Seg" },
                          { value: "terca", label: "Ter" },
                          { value: "quarta", label: "Qua" },
                          { value: "quinta", label: "Qui" },
                          { value: "sexta", label: "Sex" },
                          { value: "sabado", label: "Sáb" },
                        ].map((opt, idx) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setScheduleDay(opt.value);
                              setShowDayDropdown(false);
                            }}
                            style={{
                              background:
                                scheduleDay === opt.value
                                  ? "#00bcd4"
                                  : "#23243a",
                              color:
                                scheduleDay === opt.value ? "#fff" : "#bbb",
                              border: "none",
                              borderBottom: idx < 6 ? "1px solid #444" : "none",
                              borderRight:
                                idx % 2 === 0 ? "1px solid #444" : "none",
                              borderRadius: 0,
                              padding: "7px 10px",
                              fontWeight: "bold",
                              fontSize: "0.95rem",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "all 0.2s",
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label
                    style={{
                      textAlign: "center",
                      width: "100%",
                      display: "block",
                    }}
                  >
                    Horário:
                  </label>
                  <style>{`
                    .schedule-time-input-custom {
                      width: 30%;
                      display: block;
                      margin: 0 auto;
                      min-width: 90px;
                      max-width: 140px;
                    }
                  `}</style>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    required
                    style={{
                      width: "40%",
                      display: "block",
                      margin: "0 auto",
                      minWidth: 90,
                      maxWidth: 140,
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    margin: "16px 0 8px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={scheduleRepeat}
                    onChange={(e) => setScheduleRepeat(e.target.checked)}
                    id="repeat-weekly-checkbox"
                    style={{ width: 18, height: 18, marginRight: 8 }}
                  />
                  <label
                    htmlFor="repeat-weekly-checkbox"
                    style={{
                      color: "#fff",
                      fontWeight: 500,
                      fontSize: "1.08rem",
                      cursor: "pointer",
                      margin: 0,
                    }}
                  >
                    Repetir semanalmente
                  </label>
                </div>

                {/* Botões de Slot */}
                <div
                  className="form-group"
                  style={{ position: "relative", marginBottom: 18 }}
                >
                  <label
                    style={{
                      textAlign: "center",
                      width: "100%",
                      display: "block",
                    }}
                  >
                    Slot:
                  </label>
                  <div
                    style={{ width: "100%", maxWidth: 260, margin: "0 auto" }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowSlotDropdown((v) => !v)}
                      style={{
                        width: "100%",
                        background: "#23243a",
                        color: selectedSlot ? "#fff" : "#bbb",
                        border: "2px solid #4a4a7e",
                        borderRadius: 10,
                        padding: "10px 18px",
                        fontWeight: "bold",
                        fontSize: "1rem",
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.2s",
                      }}
                      className="slot-dropdown-btn"
                    >
                      {selectedSlot ? `Slot ${selectedSlot}` : "Selecionar"}
                      <span style={{ marginLeft: 8, fontSize: 18 }}>
                        &#9662;
                      </span>
                    </button>
                    {showSlotDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: 48,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 120,
                          background: "#23243a",
                          border: "2px solid #4a4a7e",
                          borderRadius: 10,
                          zIndex: 10,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 0,
                        }}
                        className="slot-dropdown-menu"
                      >
                        {[1, 2, 3, 4].map((slot, idx) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setSelectedSlot(slot);
                              setShowSlotDropdown(false);
                            }}
                            style={{
                              background:
                                selectedSlot === slot ? "#00bcd4" : "#23243a",
                              color: selectedSlot === slot ? "#fff" : "#bbb",
                              border: "none",
                              borderBottom: idx < 2 ? "1px solid #444" : "none",
                              borderRight:
                                idx % 2 === 0 ? "1px solid #444" : "none",
                              borderRadius: 0,
                              padding: "7px 8px",
                              fontWeight: "bold",
                              fontSize: "0.85rem",
                              cursor: "pointer",
                              textAlign: "center",
                              transition: "all 0.2s",
                            }}
                          >
                            {`Slot ${slot}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Enable Timers */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    margin: "6px 0 10px 0",
                  }}
                >
                  <label
                    style={{
                      color: "#fff",
                      fontWeight: 500,
                      fontSize: "1.1rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={enableTimers}
                      onChange={(e) => setEnableTimers(e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                    Habilitar temporizadores
                  </label>
                </div>

                {/* NOVO: Checkbox ON/OFF */}
                <div
                  className="form-group"
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 24,
                    marginBottom: 12,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: 500,
                      color: "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={scheduleAction === "ON"}
                      onChange={() => setScheduleAction("ON")}
                      style={{ width: 18, height: 18 }}
                    />
                    ON
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: 500,
                      color: "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={scheduleAction === "OFF"}
                      onChange={() => setScheduleAction("OFF")}
                      style={{ width: 18, height: 18 }}
                    />
                    OFF
                  </label>
                </div>

                <button
                  type="submit"
                  className="schedule-button"
                  style={{
                    marginTop: 8,
                    marginBottom: 0,
                    padding: "8px 0",
                    fontSize: "1rem",
                  }}
                >
                  Agendar Desligamento
                </button>

                {scheduleMessage && (
                  <p
                    style={{
                      color: scheduleMessageColor,
                      marginTop: "6px",
                      textAlign: "center",
                      fontSize: "0.98rem",
                    }}
                  >
                    {scheduleMessage}
                  </p>
                )}
              </form>
            </div>
          </>
        )}
        {/* ========== REPORTS SECTION ========== */}
        {activeSection === "relatorios" && (
          <div className="reports-section">
            <h2>Relatórios de Consumo</h2>
            <div className="report-summary-card">
              <h3>Resumo Geral</h3>
              <p>
                Total de Dispositivos:{" "}
                <strong>{report.summary.totalDevices}</strong>
              </p>
              <p>
                Com uso Inteligente (estimado):{" "}
                <strong>{report.summary.smartUsageDevices}</strong>
              </p>
              <p>
                Dispositivos com Otimização Pendente (estimado):{" "}
                <strong>{report.summary.nonSmartUsageDevices}</strong>
              </p>
              <p className="overall-report-message">
                {report.summary.overallMessage}
              </p>
            </div>
            {isRealData && devices.length > 0 && devices[0].latestReading && (
              <div className="energy-realtime-card">
                <h3> Dados em Tempo Real do Dispositivo Sonoff Sala </h3>{" "}
                <table className="energy-realtime-table">
                  <tbody className="energy-realtime-tbody">
                    <tr>
                      <td> Tensão </td>{" "}
                      <td>
                        {" "}
                        {devices[0].powerState &&
                        typeof devices[0].latestReading.voltage === "number"
                          ? devices[0].latestReading.voltage.toFixed(2)
                          : "0.00"}
                        V{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Corrente </td>{" "}
                      <td>
                        {" "}
                        {devices[0].powerState &&
                        typeof devices[0].latestReading.current === "number"
                          ? devices[0].latestReading.current.toFixed(2)
                          : "0.00"}
                        A{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Potência Ativa </td>{" "}
                      <td>
                        {" "}
                        {devices[0].powerState &&
                        typeof devices[0].latestReading.power === "number"
                          ? devices[0].latestReading.power.toFixed(2)
                          : "0.00"}
                        W{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Potência Aparente </td>{" "}
                      <td>
                        {" "}
                        {devices[0].powerState &&
                        typeof devices[0].latestReading.ApparentPower ===
                          "number"
                          ? devices[0].latestReading.ApparentPower.toFixed(2)
                          : "0.00"}
                        VA{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Potência Reativa </td>{" "}
                      <td>
                        {" "}
                        {devices[0].powerState &&
                        typeof devices[0].latestReading.ReactivePower ===
                          "number"
                          ? devices[0].latestReading.ReactivePower.toFixed(2)
                          : "0.00"}
                        var{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Fator de Potência </td>{" "}
                      <td>
                        {" "}
                        {devices[0].powerState &&
                        typeof devices[0].latestReading.PowerFactor === "number"
                          ? devices[0].latestReading.PowerFactor.toFixed(2)
                          : "0.00"}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Energia Hoje </td>{" "}
                      <td>
                        {" "}
                        {typeof devices[0].latestReading.EnergyToday ===
                        "number"
                          ? devices[0].latestReading.EnergyToday.toFixed(2)
                          : "--"}
                        kWh{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Energia Ontem </td>{" "}
                      <td>
                        {" "}
                        {typeof devices[0].latestReading.EnergyYesterday ===
                        "number"
                          ? devices[0].latestReading.EnergyYesterday.toFixed(2)
                          : "--"}
                        kWh{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Energia Total </td>{" "}
                      <td>
                        {" "}
                        {devices[0].powerState
                          ? liveTotalEnergyBroker1.toFixed(2) + " kWh"
                          : "0.00 kWh"}{" "}
                      </td>{" "}
                    </tr>{" "}
                  </tbody>{" "}
                </table>{" "}
              </div>
            )}
            {isRealData && devices.length > 1 && devices[1].latestReading && (
              <div
                className="energy-realtime-card"
                style={{ marginTop: "32px" }}
              >
                <h3> Dados em Tempo Real do Dispositivo Sonoff Câmera </h3>{" "}
                <table className="energy-realtime-table">
                  <tbody className="energy-realtime-tbody">
                    <tr>
                      <td> Tensão </td>{" "}
                      <td>
                        {" "}
                        {devices[1].powerState &&
                        typeof devices[1].latestReading.voltage === "number"
                          ? devices[1].latestReading.voltage.toFixed(2)
                          : "0.00"}
                        V{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Corrente </td>{" "}
                      <td>
                        {" "}
                        {devices[1].powerState &&
                        typeof devices[1].latestReading.current === "number"
                          ? devices[1].latestReading.current.toFixed(2)
                          : "0.00"}
                        A{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Potência Ativa </td>{" "}
                      <td>
                        {" "}
                        {devices[1].powerState &&
                        typeof devices[1].latestReading.power === "number"
                          ? devices[1].latestReading.power.toFixed(2)
                          : "0.00"}
                        W{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Potência Aparente </td>{" "}
                      <td>
                        {" "}
                        {devices[1].powerState &&
                        typeof devices[1].latestReading.ApparentPower ===
                          "number"
                          ? devices[1].latestReading.ApparentPower.toFixed(2)
                          : "0.00"}
                        VA{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Potência Reativa </td>{" "}
                      <td>
                        {" "}
                        {devices[1].powerState &&
                        typeof devices[1].latestReading.ReactivePower ===
                          "number"
                          ? devices[1].latestReading.ReactivePower.toFixed(2)
                          : "0.00"}
                        var{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Fator de Potência </td>{" "}
                      <td>
                        {" "}
                        {devices[1].powerState &&
                        typeof devices[1].latestReading.PowerFactor === "number"
                          ? devices[1].latestReading.PowerFactor.toFixed(2)
                          : "0.00"}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Energia Hoje </td>{" "}
                      <td>
                        {" "}
                        {typeof devices[1].latestReading.EnergyToday ===
                        "number"
                          ? devices[1].latestReading.EnergyToday.toFixed(2)
                          : "--"}
                        kWh{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Energia Ontem </td>{" "}
                      <td>
                        {" "}
                        {typeof devices[1].latestReading.EnergyYesterday ===
                        "number"
                          ? devices[1].latestReading.EnergyYesterday.toFixed(2)
                          : "--"}
                        kWh{" "}
                      </td>{" "}
                    </tr>{" "}
                    <tr>
                      <td> Energia Total </td>{" "}
                      <td>
                        {" "}
                        {devices[1].powerState
                          ? liveTotalEnergyBroker2.toFixed(2) + " kWh"
                          : "0.00 kWh"}{" "}
                      </td>{" "}
                    </tr>{" "}
                  </tbody>{" "}
                </table>{" "}
              </div>
            )}
            <h3> Detalhes por Dispositivo </h3>{" "}
            <div className="device-report-list">
              {" "}
              {report.details.length > 0 ? (
                report.details.map((detail, index) => (
                  <div key={index} className="device-report-item">
                    <h4> {detail.name} </h4>{" "}
                    <p>
                      Status Atual:{" "}
                      <span
                        className={
                          devices[index] && devices[index].powerState
                            ? "status-on-text"
                            : "status-off-text"
                        }
                      >
                        {" "}
                        {devices[index] && devices[index].powerState
                          ? "Ligado"
                          : "Desligado"}{" "}
                      </span>{" "}
                    </p>{" "}
                    <p> Tipo: {detail.type} </p>{" "}
                    <p> Recomendação: {detail.recommendation} </p>{" "}
                    {parseFloat(detail.potentialImpact) !== 0.0 && (
                      <p
                        className={
                          parseFloat(detail.potentialImpact) > 0
                            ? "impact-positive"
                            : "impact-negative"
                        }
                      >
                        Impacto Potencial: {detail.potentialImpact}
                        kWh no próximo mês{" "}
                      </p>
                    )}{" "}
                  </div>
                ))
              ) : (
                <p className="no-reports-message">
                  {" "}
                  Nenhum relatório disponível.{" "}
                </p>
              )}{" "}
            </div>{" "}
          </div>
        )}
        {/* ========== ECOBOT SECTION ========== */}
        {activeSection === "ecobot" && (
          <div className="main-content2">
            <div className="ecobot-container">
              <h1 className="ecobot-title">
                Olá, eu sou
                <img
                  src={process.env.PUBLIC_URL + "/EcoBotSF.png"}
                  alt="EcoBot"
                  className="ecobot-h1-img"
                />
              </h1>
              <h4 className="ecobot-subtitle">
                Aqui {userName}, você pode me perguntar sobre conceitos de
                energia elétrica, entender o que influencia sua conta de luz e
                receber dicas para um uso mais eficiente dos seus
                eletrodomésticos. Fique à vontade!
              </h4>
            </div>
            <div className="ecobot-chat-container">
              <div className="ecobot-messages">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`ecobot-message ${
                      msg.sender === "EcoBot" ? "ecobot" : "user"
                    }`}
                  >
                    {msg.sender === "EcoBot" ? (
                      <>
                        <img
                          src={process.env.PUBLIC_URL + "/ST.png"}
                          alt="EcoBot"
                          className="ecobot-chat-avatar"
                        />
                        <span className="ecobot-message-text">{msg.text}</span>
                      </>
                    ) : (
                      <>
                        <span className="user-chat-avatar">
                          {userName && userName.length > 0
                            ? userName[0].toUpperCase()
                            : "U"}
                        </span>
                        <span className="user-message-text">{msg.text}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="ecobot-input-form">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="ecobot-input"
                />
                <button type="submit" className="ecobot-send-button">
                  Enviar
                </button>
              </form>
            </div>
          </div>
        )}
        {/* ========== SETTINGS SECTION ========== */}{" "}
        {activeSection === "configuracoes" && (
          <>
            <div className="settings-section">
              <h2> Configurações da Conta </h2>
              <div className="user-settings-card">
                <h3> Informações do Usuário </h3>{" "}
                <p>
                  <strong> Nome de Usuário: </strong> {userName}{" "}
                </p>{" "}
                <p>
                  <strong> Email: </strong> {userEmail}{" "}
                </p>{" "}
                <p>
                  <button
                    className="edit-profile-button"
                    onClick={openEditModal}
                  >
                    Editar Perfil
                  </button>
                </p>
                <p className="settings-note">
                  * Após editar ou excluir a conta, será necessário fazer login
                  novamente.{" "}
                </p>{" "}
              </div>
              {/* Edit Account Modal */}{" "}
              {showEditModal && (
                <div className="modal-overlay">
                  <div className="modal-card">
                    <h3> Editar Conta </h3>{" "}
                    <form onSubmit={handleEditAccount}>
                      <label> Novo Nome: </label>{" "}
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Novo nome"
                      />
                      <label> Nova Senha: </label>{" "}
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Nova senha"
                      />
                      {editError && (
                        <p className="error-message"> {editError} </p>
                      )}
                      <div className="button-group small-buttons">
                        <button
                          type="submit"
                          disabled={editLoading}
                          className="submit-button small-btn"
                        >
                          {" "}
                          {editLoading ? "Salvando..." : "Salvar"}{" "}
                        </button>{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setShowEditModal(false);
                            openDeleteModal();
                          }}
                          className="delete-account-button small-btn"
                        >
                          Excluir Conta{" "}
                        </button>{" "}
                        <button
                          type="button"
                          onClick={() => setShowEditModal(false)}
                          className="cancel-button small-btn"
                        >
                          Cancelar{" "}
                        </button>{" "}
                      </div>{" "}
                    </form>{" "}
                  </div>{" "}
                </div>
              )}
              {/* Delete Account Modal */}{" "}
              {showDeleteModal && (
                <div className="modal-overlay">
                  <div className="modal-card">
                    <h3> Excluir Conta </h3>{" "}
                    <p>
                      Tem certeza que deseja excluir sua conta ? Esta ação é
                      irreversível.{" "}
                    </p>{" "}
                    {deleteError && (
                      <p className="error-message"> {deleteError} </p>
                    )}{" "}
                    <div className="button-group">
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteLoading}
                        className="delete-button"
                      >
                        {" "}
                        {deleteLoading ? "Excluindo..." : "Excluir"}{" "}
                      </button>{" "}
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        className="cancel-button"
                      >
                        Cancelar{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>{" "}
                </div>
              )}
              <div className="tasmota-settings-card">
                <h3> Gerenciamento de Dispositivos </h3>{" "}
                <p className="device-management-description">
                  Aqui você pode gerenciar seus dispositivos Tasmota.{" "}
                </p>
                {isRealData ? (
                  <p>
                    <button
                      className="add-device-btn"
                      onClick={() => navigate("/add-device")}
                    >
                      Adicionar Novo Dispositivo{" "}
                    </button>{" "}
                    <button
                      className="refresh-devices-btn"
                      onClick={fetchDashboardData}
                    >
                      Atualizar Lista de Dispositivos{" "}
                    </button>{" "}
                  </p>
                ) : (
                  <p className="admin-only-message">
                    O gerenciamento completo de dispositivos está disponível
                    apenas para a conta de administrador.{" "}
                  </p>
                )}{" "}
              </div>{" "}
            </div>
            <div className="settings-logout-section">
              <button onClick={handleLogout} className="settings-logout-button">
                <span className="logout-icon">🔒</span>
                Sair da Conta
              </button>
            </div>
          </>
        )}
      </div>
      <CustomAlert
        isOpen={alertState.isOpen}
        onClose={hideAlert}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        autoClose={alertState.autoClose}
        autoCloseTime={alertState.autoCloseTime}
      />
    </div>
  );
}

export default DashboardPage;
