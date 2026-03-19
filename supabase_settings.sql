-- Criação da tabela de configurações globais do inquilino (SaaS)
CREATE TABLE IF NOT EXISTS public.settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Garante que haverá apenas uma linha
    business_name TEXT NOT NULL DEFAULT 'Meu Estabelecimento',
    niche TEXT NOT NULL DEFAULT 'salon', -- salon, barber, clinic
    primary_color TEXT NOT NULL DEFAULT '#8b5cf6',
    logo_url TEXT,
    welcome_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela de Perguntas Frequentes para o Bot responder
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para FAQ
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura anonima nas faqs" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "Permitir escrita anonima nas faqs" ON public.faqs FOR ALL USING (true);


-- Ativa RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Políticas relaxadas para MVP (restrinja em produção)
CREATE POLICY "Permitir leitura anonima nas settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Permitir atualizacao anonima nas settings" ON public.settings FOR UPDATE USING (true);
CREATE POLICY "Permitir insercao anonima nas settings" ON public.settings FOR INSERT WITH CHECK (true);

-- Inserir o registro padrão caso não exista
INSERT INTO public.settings (id, business_name)
VALUES (1, 'Meu Estabelecimento')
ON CONFLICT (id) DO NOTHING;
