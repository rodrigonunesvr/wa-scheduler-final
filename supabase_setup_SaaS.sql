-- Script de Inicialização de Banco de Dados para Clientes SaaS
-- Rode este script inteiramente no SQL Editor do Supabase toda vez que criar um novo projeto para um comprador do SaaS.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Profissionais Dinâmicos (Equipe)
CREATE TABLE IF NOT EXISTS professionals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    role TEXT DEFAULT 'Especialista',
    color TEXT DEFAULT 'border-violet-500',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE professionals DISABLE ROW LEVEL SECURITY;

-- (Opcional, caso ainda não tenha rodado) 2. Tabela de Serviços Dinâmicos
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 60,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE services DISABLE ROW LEVEL SECURITY;

-- 3. Adição da coluna professional_id na tabela de Appointments já existente
-- Rode isso caso sua tabela de Agendamentos (appointments) já tenha sido criada pelas versões anteriores.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS professional_id TEXT;

