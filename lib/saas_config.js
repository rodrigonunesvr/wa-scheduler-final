// ConfiguraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes do SaaS AGENDAÃƒÆ’Ã‚Â
// Define quais mÃƒÆ’Ã‚Â³dulos estÃƒÆ’Ã‚Â£o ativos para o cliente atual

export const SAAS_CONFIG = {
    appName: "AGENDAÃƒÆ’Ã‚Â",
    version: "4.0.0-AGENDAI",

    // MÃƒÆ’Ã‚Â³dulos Ativos (Podem ser movidos para o banco no futuro para Multi-Tenant)
    modules: {
        botEnabled: true,       // Ativa/Desativa o robÃƒÆ’Ã‚Â´ de atendimento IA (Clara)
        whatsappNotify: true,   // Ativa/Desativa notificaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes automÃƒÆ’Ã‚Â¡ticas por WhatsApp
        multiProfessional: true, // Ativa/Desativa suporte a mÃƒÆ’Ã‚Âºltiplos atendentes
        crmHistory: true,       // Ativa/Desativa histÃƒÆ’Ã‚Â³rico detalhado da cliente
        paymentsEnabled: true   // Ativa/Desativa exibiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de Pix/Pagamento
    },

    // Identidade Visual base
    theme: {
        primaryColor: "#8b5cf6", // Violeta Brand
        glassmorphism: true,
        darkMode: true
    }
}
