// Configurações do SaaS AGENDAÍ
// Define quais módulos estão ativos para o cliente atual

export const SAAS_CONFIG = {
    appName: "AGENDAÍ",
    version: "4.0.0-AGENDAI",

    // Módulos Ativos (Podem ser movidos para o banco no futuro para Multi-Tenant)
    modules: {
        botEnabled: true,       // Ativa/Desativa o robô de atendimento IA (Clara)
        whatsappNotify: true,   // Ativa/Desativa notificações automáticas por WhatsApp
        multiProfessional: true, // Ativa/Desativa suporte a múltiplos atendentes
        crmHistory: true,       // Ativa/Desativa histórico detalhado da cliente
        paymentsEnabled: true   // Ativa/Desativa exibição de Pix/Pagamento
    },

    // Identidade Visual base
    theme: {
        primaryColor: "#8b5cf6", // Violeta Brand
        glassmorphism: true,
        darkMode: true
    }
}
