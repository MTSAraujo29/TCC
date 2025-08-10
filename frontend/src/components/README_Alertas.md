# Sistema de Alertas Personalizados - Smart Energy

## Visão Geral

Este projeto agora utiliza um sistema de alertas personalizado que substitui todos os `alert()` nativos do JavaScript por componentes visuais modernos e consistentes com o design do projeto.

## Componentes

### CustomAlert

Componente principal que renderiza os alertas com diferentes tipos e estilos.

### useCustomAlert

Hook personalizado que fornece métodos para exibir diferentes tipos de alertas.

## Como Usar

### 1. Importar o Hook

```javascript
import useCustomAlert from "../hooks/useCustomAlert";

function MinhaPagina() {
  const {
    alertState,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideAlert,
  } = useCustomAlert();

  // ... resto do código
}
```

### 2. Importar o Componente

```javascript
import CustomAlert from "../components/CustomAlert";

// No final do JSX da página
<CustomAlert
  isOpen={alertState.isOpen}
  onClose={hideAlert}
  type={alertState.type}
  title={alertState.title}
  message={alertState.message}
  autoClose={alertState.autoClose}
  autoCloseTime={alertState.autoCloseTime}
/>;
```

### 3. Métodos Disponíveis

#### showSuccess(message, title)

Exibe um alerta de sucesso (verde)

```javascript
showSuccess("Operação realizada com sucesso!", "Sucesso!");
```

#### showError(message, title)

Exibe um alerta de erro (vermelho)

```javascript
showError("Algo deu errado!", "Erro!");
```

#### showWarning(message, title)

Exibe um alerta de aviso (laranja)

```javascript
showWarning("Atenção!", "Aviso!");
```

#### showInfo(message, title)

Exibe um alerta informativo (azul)

```javascript
showInfo("Informação importante", "Info");
```

#### showAlert(options)

Método avançado com opções personalizadas

```javascript
showAlert({
  type: "success",
  message: "Mensagem personalizada",
  title: "Título personalizado",
  autoClose: false, // Não fecha automaticamente
  autoCloseTime: 5000, // Fecha em 5 segundos
});
```

## Tipos de Alerta

- **success**: Verde - Para operações bem-sucedidas
- **error**: Vermelho - Para erros e falhas
- **warning**: Laranja - Para avisos e alertas
- **info**: Azul - Para informações gerais

## Características

- ✅ Design moderno e responsivo
- ✅ Animações suaves
- ✅ Fechamento automático configurável
- ✅ Botão de fechar manual
- ✅ Backdrop com blur
- ✅ Cores consistentes com o projeto
- ✅ Suporte a diferentes tipos de mensagem
- ✅ Títulos automáticos baseados no tipo

## Exemplo Completo

```javascript
import React, { useState } from "react";
import useCustomAlert from "../hooks/useCustomAlert";
import CustomAlert from "../components/CustomAlert";

function ExemploPage() {
  const { alertState, showSuccess, showError, hideAlert } = useCustomAlert();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Simular operação
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showSuccess("Dados salvos com sucesso!", "Operação Concluída!");
    } catch (error) {
      showError("Falha ao salvar dados", "Erro!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Salvando..." : "Salvar"}
      </button>

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
```

## Migração de Alertas Existentes

### Antes (JavaScript nativo)

```javascript
alert("Operação realizada com sucesso!");
```

### Depois (Sistema personalizado)

```javascript
showSuccess("Operação realizada com sucesso!", "Sucesso!");
```

## Benefícios

1. **Consistência Visual**: Todos os alertas seguem o mesmo padrão de design
2. **Melhor UX**: Alertas mais atrativos e profissionais
3. **Responsividade**: Funciona perfeitamente em dispositivos móveis
4. **Acessibilidade**: Melhor suporte para leitores de tela
5. **Customização**: Fácil de personalizar cores e comportamentos
6. **Performance**: Não bloqueia a interface como os alertas nativos

## Notas Importantes

- Sempre inclua o componente `CustomAlert` no final do JSX da página
- Use o hook `useCustomAlert` no início da função do componente
- Os alertas fecham automaticamente após 4 segundos por padrão
- Para alertas que não fecham automaticamente, use `autoClose: false`
- O sistema é totalmente responsivo e funciona em todos os dispositivos
