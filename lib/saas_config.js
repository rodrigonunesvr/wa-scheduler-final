// ConfiguraÃ§Ãµes do SaaS AGENDAÃ
// Define quais mÃ³dulos estÃ£o ativos para o cliente atual

export const SAAS_CONFIG = {
    appName: "AGENDAÃ",
    version: "4.0.0-AGENDAI",

    // MÃ³dulos Ativos (Podem ser movidos para o banco no futuro para Multi-Tenant)
    modules: {
        multiProfessional: true, // Ativa/Desativa suporte a mÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºltiplos atendentes
        crmHistory: true,       // Ativa/Desativa histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rico detalhado da cliente
        paymentsEnabled: true   // Ativa/Desativa exibiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o de Pix/Pagamento
    },

    // Identidade Visual base
    theme: {
        primaryColor: "#8b5cf6", // Violeta Brand
        glassmorphism: true,
        darkMode: true
    }
}
