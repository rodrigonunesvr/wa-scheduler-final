// ConfiguraÃƒÂ§ÃƒÂµes do SaaS AGENDAÃƒÂ
// Define quais mÃƒÂ³dulos estÃƒÂ£o ativos para o cliente atual

export const SAAS_CONFIG = {
    appName: "AGENDAÃƒÂ",
    version: "4.0.0-AGENDAI",

    // MÃƒÂ³dulos Ativos (Podem ser movidos para o banco no futuro para Multi-Tenant)
    modules: {
        botEnabled: true,       // Ativa/Desativa o robÃƒÂ´ de atendimento IA (Clara)
        whatsappNotify: true,   // Ativa/Desativa notificaÃƒÂ§ÃƒÂµes automÃƒÂ¡ticas por WhatsApp
        multiProfessional: true, // Ativa/Desativa suporte a mÃƒÂºltiplos atendentes
        crmHistory: true,       // Ativa/Desativa histÃƒÂ³rico detalhado da cliente
        paymentsEnabled: true   // Ativa/Desativa exibiÃƒÂ§ÃƒÂ£o de Pix/Pagamento
    },

    // Identidade Visual base
    theme: {
        primaryColor: "#8b5cf6", // Violeta Brand
        glassmorphism: true,
        darkMode: true
    }
}
