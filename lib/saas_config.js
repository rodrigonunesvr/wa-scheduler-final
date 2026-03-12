// ConfiguraÃ§Ãµes do SaaS AGENDAÃ
// Define quais mÃ³dulos estÃ£o ativos para o cliente atual

export const SAAS_CONFIG = {
    appName: "AGENDAÃ",
    version: "4.0.0-AGENDAI",

    // MÃ³dulos Ativos (Podem ser movidos para o banco no futuro para Multi-Tenant)
    modules: {
        botEnabled: true,       // Ativa/Desativa o robÃ´ de atendimento IA (Clara)
        whatsappNotify: true,   // Ativa/Desativa notificaÃ§Ãµes automÃ¡ticas por WhatsApp
        multiProfessional: true, // Ativa/Desativa suporte a mÃºltiplos atendentes
        crmHistory: true,       // Ativa/Desativa histÃ³rico detalhado da cliente
        paymentsEnabled: true   // Ativa/Desativa exibiÃ§Ã£o de Pix/Pagamento
    },

    // Identidade Visual base
    theme: {
        primaryColor: "#8b5cf6", // Violeta Brand
        glassmorphism: true,
        darkMode: true
    }
}
