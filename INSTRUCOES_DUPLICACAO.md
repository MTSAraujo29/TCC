# Instruções para Duplicar Dispositivos Sonoff

## Objetivo
Adicionar os mesmos dispositivos Sonoff 1 e Sonoff 2 da sua conta para a conta da sua mãe.

## Pré-requisitos
1. Você deve ser um usuário administrador no sistema
2. A conta da sua mãe deve estar criada no sistema
3. Os dispositivos Sonoff 1 e Sonoff 2 devem estar cadastrados na sua conta

## Passos para Duplicação

### 1. Acessar a Página de Gerenciamento
- Faça login no sistema com sua conta de administrador
- No Dashboard, clique em "📱Gerenciar Dispositivos" na sidebar
- Ou acesse diretamente: `/device-management`

### 2. Selecionar os Dispositivos
- Na seção "Seus Dispositivos", você verá todos os seus dispositivos cadastrados
- Marque as caixas de seleção dos dispositivos Sonoff 1 e Sonoff 2
- Ou use "Selecionar Todos" se quiser duplicar todos os dispositivos

### 3. Escolher o Usuário de Destino
- Na seção "Duplicar para Usuário", selecione a conta da sua mãe no dropdown
- O sistema mostrará o nome, email e número de dispositivos de cada usuário

### 4. Executar a Duplicação
- Clique no botão "Duplicar X dispositivo(s)"
- Aguarde a confirmação de sucesso
- Os dispositivos serão duplicados para a conta da sua mãe

## O que Acontece na Duplicação

### Dispositivos Duplicados
- **Nome**: Mantém o mesmo nome original
- **Tópico MQTT**: Mantém o mesmo tópico (importante para não conflitar)
- **Broker**: Mantém a mesma configuração de broker
- **Modelo**: Mantém o mesmo modelo
- **Configurações**: Mantém as configurações básicas

### Dados Separados
- **Leituras de Energia**: Cada usuário terá suas próprias leituras
- **Controle**: Cada usuário pode controlar os dispositivos independentemente
- **Relatórios**: Cada usuário verá apenas seus próprios dados
- **Dashboard**: Cada usuário terá seu próprio dashboard com dados separados

## Importante

### Tópicos MQTT Únicos
- Os dispositivos mantêm o mesmo tópico MQTT porque ambos os usuários precisam receber as mesmas mensagens MQTT
- Isso garante que ambos vejam os dados em tempo real do mesmo dispositivo físico

### Controle Individual
- Cada usuário pode ligar/desligar os dispositivos independentemente
- Os comandos são enviados para o mesmo dispositivo físico
- O último comando enviado é o que prevalece

### Dados Históricos
- Apenas leituras futuras serão separadas por usuário
- Leituras antigas permanecem na conta original
- Cada usuário começará a acumular seus próprios dados a partir da duplicação

## Verificação

### Na Conta da Mãe
1. Faça login com a conta da mãe
2. Vá para o Dashboard
3. Verifique se os dispositivos aparecem na seção "Controle de Energia"
4. Teste o controle ligando/desligando os dispositivos
5. Verifique se os dados em tempo real estão sendo exibidos

### Logs do Sistema
- O backend registrará no console quando a duplicação for realizada
- Mensagens de sucesso ou erro serão exibidas na interface

## Solução de Problemas

### Dispositivo Já Existe
- Se um dispositivo já existe para o usuário de destino, a duplicação falhará
- Remova o dispositivo existente primeiro ou escolha outro usuário

### Erro de Permissão
- Apenas administradores podem duplicar dispositivos
- Verifique se sua conta tem privilégios de administrador

### Dispositivos Não Aparecem
- Verifique se os dispositivos estão online
- Confirme se o campo "broker" está configurado corretamente
- Verifique os logs do backend para erros de conexão MQTT

## Suporte

Se encontrar problemas:
1. Verifique os logs do console do navegador
2. Verifique os logs do backend
3. Confirme se todas as variáveis de ambiente estão configuradas
4. Teste a conectividade MQTT dos dispositivos 