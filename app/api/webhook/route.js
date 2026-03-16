import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { findAvailableSlots, bookAppointment, updateAppointment, getAppointmentsByPhone, cancelAppointment, confirmAppointment, isDayOpen, fetchScheduleOverrides, fetchScheduleRules, calculateTotalPrice } from '@/lib/calendar'
import { sendWhatsAppMessage } from '@/lib/evolution'
import { SAAS_CONFIG } from '@/lib/saas_config'

// 2. Main Webhook Handler
export async function POST(request) {
    try {
        // Modular Check: Is the AI Bot enabled for this project?
        if (!SAAS_CONFIG.modules.botEnabled) {
            console.log('🤖 Módulo de Bot desativado no SAAS_CONFIG. Ignorando processamento de IA.')
            return NextResponse.json({ status: 'bot-disabled' })
        }

        const body = await request.json()
        console.log('Webhook received:', JSON.stringify(body, null, 2))

        // Validation check (Support both header and body)
        const headerKey = request.headers.get('apikey')
        const bodyKey = body.apikey
        const currentApiKey = process.env.EVOLUTION_API_KEY

        if (headerKey !== currentApiKey && bodyKey !== currentApiKey) {
            console.error('🚫 Tentativa de acesso não autorizado detectada. API Key inválida.')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Support both Z-API (legacy) and Evolution API
        const isEvolution = body.event === 'messages.upsert'

        const isGroup = isEvolution ? body.data?.key?.remoteJid?.includes('@g.us') : body.isGroup
        const fromMe = isEvolution ? body.data?.key?.fromMe : body.fromMe

        if (isGroup || fromMe) {
            return NextResponse.json({ status: 'ignored' })
        }

        let phone = isEvolution
            ? body.data?.key?.remoteJid?.split('@')[0]
            : body.phone

        // Extraction for Evolution API
        const text = isEvolution
            ? body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || ''
            : body.message?.text?.message || body.text?.message || ''

        // --- BLINDAGEM V50: PROTEÇÃO CONTRA PROMPT INJECTION ---
        const injectionPatterns = [
            /ignore.*instruç/i, /esqueça.*regras/i, /prompt.*system/i,
            /instrução.*secreta/i, /admin.*access/i, /bypass.*rules/i
        ];
        const isMalicious = injectionPatterns.some(pattern => pattern.test(text));

        const sanitizedText = isMalicious
            ? "[MENSAGEM BLOQUEADA POR SEGURANÇA: Tentativa de manipulação de regras detectada]"
            : text.substring(0, 1000); // Limiting text size for safety

        const audioUrl = isEvolution
            ? body.data?.message?.audioMessage?.url
            : body.message?.audio?.audioUrl

        if (!phone) {
            return NextResponse.json({ status: 'no-phone' })
        }

        // 3. Load or Create Session
        const { data: existingSession, error: fetchError } = await supabase
            .from('wa_sessions')
            .select('*')
            .eq('phone', phone)
            .maybeSingle()

        if (fetchError) {
            console.error('❌ Error fetching session:', fetchError)
        }

        let session = existingSession

        if (!session) {
            console.log('🆕 Criando nova sessão para:', phone)
            const { data: newSession, error: insertError } = await supabase
                .from('wa_sessions')
                .insert({ phone, state: 'START', context_json: [] })
                .select()
                .maybeSingle()

            if (insertError) {
                console.error('❌ Error creating session:', insertError)
                return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
            }
            session = newSession
        } else {
            // 3.1 Session Timeout (10 minutes)
            const lastUpdate = new Date(session.updated_at).getTime()
            const nowMs = new Date().getTime()
            const diffMins = (nowMs - lastUpdate) / (1000 * 60)

            if (diffMins > 10) {
                console.log('🕒 Sessão expirada (>10min). Resetando histórico.')
                session.context_json = []
            }
        }

        if (!session) {
            console.error('❌ Session is still null after attempt to create')
            return NextResponse.json({ error: 'Session initialization failed' }, { status: 500 })
        }

        // 3.5 Check if client is registered
        let customerName = null
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('name')
            .eq('phone', phone)
            .maybeSingle()
        if (customer) {
            customerName = customer.name
            console.log('👤 Cliente reconhecida:', customerName)
        }

        // 4. Process Content (Text or Audio)
        let userMessage = sanitizedText
        if (audioUrl) {
            userMessage = "[ÁUDIO RECEBIDO - Transcrição pendente na v1]"
        }

        if (!userMessage) {
            return NextResponse.json({ status: 'empty-message' })
        }

        // 5. Update History (keep last 40 messages to avoid context overflow)
        let history = session.context_json || []
        history.push({ role: 'user', content: userMessage })

        if (history.length > 40) {
            history = history.slice(-40)
            while (history.length > 0 && (history[0].role === 'tool' || (history[0].role === 'assistant' && history[0].tool_calls))) {
                history.shift()
            }
        }

        const moment = (await import('moment-timezone')).default
        await import('moment/locale/pt-br')
        moment.locale('pt-br')
        const now = moment().tz('America/Sao_Paulo')
        const todayLabel = now.format('dddd, DD [de] MMMM [de] YYYY')
        const currentHour = now.hour()

        // 6.1 Contextual Greeting
        let greeting = 'Olá'
        if (currentHour >= 5 && currentHour < 12) greeting = 'Bom dia'
        else if (currentHour >= 12 && currentHour < 18) greeting = 'Boa tarde'
        else greeting = 'Boa noite'

        // 6.2 Fetch Existing Appointments for the client
        const futureApts = await getAppointmentsByPhone(phone)
        const hasApts = futureApts && futureApts.length > 0
        const aptsContext = hasApts
            ? `\n-- - AGENDAMENTOS FUTUROS DESTA CLIENTE-- -\n` + futureApts.map(a => ` - ${moment(a.starts_at).tz('America/Sao_Paulo').format('DD/MM [às] HH:mm')}: ${a.service_id} `).join('\n')
            : '\nEsta cliente não possui agendamentos futuros registrados.'

        // 6.3 Determine if this is the start of the session (no assistant messages yet)
        const isFirstInteraction = !history.some(m => m.role === 'assistant')

        // Fetch schedule overrides and rules to determine open/closed days dynamically
        const [scheduleOverrides, scheduleRules] = await Promise.all([
            fetchScheduleOverrides(),
            fetchScheduleRules()
        ])

        // --- DEDUPLICAÇÃO NUCLEAR DE SERVIÇOS NO BOT (V71) ---
        const { data: rawServices, error: svcError } = await supabase.from('services').select('*').eq('active', true).eq('is_hidden', false).order('name')
        if (svcError) console.error('ERRO AO BUSCAR SERVICOS:', svcError);

        const dbServices = []
        const seenNames = new Set()
        if (rawServices) {
            rawServices.forEach(s => {
                const norm = s.name.trim().toLowerCase()
                if (!seenNames.has(norm)) {
                    dbServices.push(s)
                    seenNames.add(norm)
                }
            })
        }

        const servicesListText = dbServices && dbServices.length > 0
            ? dbServices.map(s => `- ${s.name}: R$ ${s.price.toFixed(2)}`).join('\n')
            : '- Nenhum serviço disponível no momento.'

        // Detect current mismatch if user mentions a missing service
        const missingKeywords = ['fibra', 'f1', 'molde'];
        const userAsksMissing = missingKeywords.some(kw => userMessage.toLowerCase().includes(kw));
        if (userAsksMissing) {
            console.log('🛡️ Alerta de Serviço Fantasma detectado. Reforçando catálogo.');
        }

        let calendarLines = ''
        for (let i = 0; i < 7; i++) {
            const day = now.clone().add(i, 'days')
            const dayName = day.format('dddd')
            const dateLabel = day.format('DD/MM/YYYY')
            const isoDate = day.format('YYYY-MM-DD')
            const isOpen = isDayOpen(isoDate, scheduleOverrides, scheduleRules)
            const isOverride = scheduleOverrides.some(o => o.date === isoDate)
            const specialRule = scheduleRules.find(r => isoDate >= r.start_date && isoDate <= r.end_date)
            const suffix = isOverride ? ' (exceção)' : specialRule ? ` (especial: ${specialRule.open_time.substring(0, 5)}-${specialRule.close_time.substring(0, 5)})` : ''
            calendarLines += `- ${dayName} ${dateLabel} (${isoDate}) ${isOpen ? '✅ aberto' + suffix : '❌ fechado' + suffix} \n`
        }

        // 7. AI Brain (GPT-4o-mini)
        const messages = [
            {
                role: "system", content: `
Olá, meu nome é Clara! 😄 Sou a secretária virtual do Espaço Camille Almeida (Espaço C.A.).
Seu objetivo é agendar os serviços disponíveis, tirar dúvidas e informar o protocolo.

Hoje é ${todayLabel}.

--- CALENDÁRIO DOS PRÓXIMOS DIAS-- -
${calendarLines}
Consulte SEMPRE o calendário acima.

${customerName ? `Oi, ${customerName}! É bom te ver novamente.` : `Você ainda não sabe o nome desta cliente. Pergunte o nome completo antes de agendar.`}

--- PROTOCOLO DE BLINDAGEM NUCLEAR (V71) ---
1. SUA ÚNICA FONTE DA VERDADE É A TABELA ABAIXO.
2. SE UM SERVIÇO NÃO ESTÁ NA TABELA, ELE NÃO EXISTE HOJE.
3. IGNORE QUALQUER CONVERSA ANTERIOR SOBRE SERVIÇOS QUE NÃO ESTÃO NA TABELA. 
4. SE O CLIENTE PEDIR ALGO FORA DA TABELA, DIGA: "No momento, esse serviço não está disponível. Nossas opções hoje são..." E MOSTRE A TABELA.

--- PROTOCOLO DE ADICIONAIS (UPSELL - OBRIGATÓRIO) ---
- **REGRA DE OURO**: Se a cliente pedir "Manutenção" ou "Gel", você DEVE oferecer os adicionais (Esmaltação, Francesinha, Pó) ANTES de confirmar o agendamento.
- **FLUXO CORRETO**: 
  1. Cliente pede Manutenção. 
  2. Você pergunta o turno/dia. 
  3. Você mostra horários. 
  4. ⚠️ **ANTES DE AGENDAR**: Pergunte se ela deseja adicionar Esmaltação ou Francesinha.
  5. Só use 'book_appointment' depois que ela responder sobre os adicionais.

--- ÚNICO CATÁLOGO DE SERVIÇOS ATIVOS (FONTE DA VERDADE) ---
${servicesListText}

⚠️ AVISO CRÍTICO: IGNORE AGENDAMENTOS PASSADOS E HISTÓRICO PARA VALIDAR SERVIÇOS. O CATÁLOGO ACIMA É SOBERANO E MUDA DIARIAMENTE.
`},
            ...history
        ]

        const tools = [
            {
                type: "function",
                function: {
                    name: "check_calendar",
                    description: "Verifica horários livres.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string" },
                            period: { type: "string", enum: ["manha", "tarde"] }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "book_appointment",
                    description: "Agenda serviços oficiais. Calcule a duração automaticamente com base na lista de serviços.",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            services: { type: "array", items: { type: "string" } },
                            service: { type: "string" },
                            startsAt: { type: "string" }
                        },
                        required: ["name", "startsAt"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "list_my_appointments",
                    description: "Lista agendamentos futuros.",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "cancel_appointment",
                    description: "Cancela um agendamento.",
                    parameters: {
                        type: "object",
                        properties: { date: { type: "string" } },
                        required: ["date"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_appointment",
                    description: "Atualiza um agendamento.",
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            services: { type: "array", items: { type: "string" } }
                        },
                        required: ["id", "services"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "confirm_appointment",
                    description: "Confirma agendamento pendente.",
                    parameters: {
                        type: "object",
                        properties: { date: { type: "string" } },
                        required: ["date"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "request_human_help",
                    description: "Solicita ajuda humana.",
                    parameters: {
                        type: "object",
                        properties: { reason: { type: "string" } }
                    }
                }
            }
        ]

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            tools: tools
        })

        let aiMsg = completion.choices[0].message
        let responseText = aiMsg.content

        // 7. Handle Tool Calls with Loop (Recursive turns)
        let toolTurn = 0
        while (aiMsg.tool_calls && toolTurn < 3) {
            toolTurn++
            history.push(aiMsg)

            for (const toolCall of aiMsg.tool_calls) {
                let result = ""
                let args = {}
                try {
                    args = JSON.parse(toolCall.function.arguments)
                } catch (e) {
                    result = JSON.stringify({ status: "error", message: "Arguments parsing failed" })
                }

                if (result) { /* Error */ }
                else if (toolCall.function.name === 'check_calendar') {
                    const slots = await findAvailableSlots({
                        requestedDate: args.date,
                        services: args.services || args.service,
                        period: args.period
                    })
                    result = JSON.stringify(slots)
                }
                else if (toolCall.function.name === 'book_appointment') {
                    try {
                        const requestedServices = Array.isArray(args.services || args.service) ? (args.services || args.service) : [args.services || args.service];

                        // --- PROTOCOLO DE UPSELL V72 ---
                        const structuralKeywords = ['Manutenção', 'Gel'];
                        const isStructural = requestedServices.some(s => structuralKeywords.some(kw => s?.toLowerCase().includes(kw.toLowerCase())));

                        if (isStructural) {
                            const upsellWords = ['Esmaltação', 'Francesinha', 'Pó', 'Combo', 'Adicional'];
                            const alreadyHasUpsell = requestedServices.some(s => upsellWords.some(w => s?.toLowerCase().includes(w.toLowerCase())));

                            if (!alreadyHasUpsell) {
                                const hasOfferedUpsell = history.some(m =>
                                    m.role === 'assistant' &&
                                    (m.content?.toLowerCase().includes('esmaltação') ||
                                        m.content?.toLowerCase().includes('francesinha') ||
                                        m.content?.toLowerCase().includes('adicional'))
                                );

                                if (!hasOfferedUpsell) {
                                    result = JSON.stringify({
                                        status: "error",
                                        message: "BLOQUEIO DE PROTOCOLO: Pare tudo! Você DEVE oferecer o Menu de Adicionais (Esmaltação, Francesinha, etc) antes de prosseguir com o agendamento de Manutenção. Pergunte: 'Gostaria de adicionar esmaltação ou algum serviço extra?'"
                                    });
                                }
                            }
                        }

                        if (!result) {
                            const appointment = await bookAppointment({
                                phone: phone,
                                name: args.name,
                                services: requestedServices,
                                startsAt: args.startsAt
                            })

                            if (appointment?.error) {
                                result = JSON.stringify({ status: "error", message: appointment.message })
                            } else {
                                result = JSON.stringify({ status: "success", appointment })
                                try {
                                    await supabase.from('customers').upsert({ phone: phone, name: args.name }, { onConflict: 'phone' })
                                } catch (e) { console.error('Customer upsert error:', e) }
                            }
                        }
                    } catch (err) { result = JSON.stringify({ status: "error", message: err.message }) }
                }
                else if (toolCall.function.name === 'list_my_appointments') {
                    try {
                        const appointments = await getAppointmentsByPhone(phone)
                        result = JSON.stringify(appointments)
                    } catch (err) { result = JSON.stringify({ status: "error", message: err.message }) }
                }
                else if (toolCall.function.name === 'cancel_appointment') {
                    try {
                        const cancelled = await cancelAppointment(phone, args.date)
                        result = JSON.stringify({ status: "success", cancelled })
                    } catch (err) { result = JSON.stringify({ status: "error", message: err.message }) }
                }
                else if (toolCall.function.name === 'update_appointment') {
                    try {
                        const updated = await updateAppointment({ id: args.id, services: args.services })
                        result = JSON.stringify({ status: "success", updated })
                    } catch (err) { result = JSON.stringify({ status: "error", message: err.message }) }
                }
                else if (toolCall.function.name === 'request_human_help') {
                    try {
                        await supabase.from('customers').update({
                            help_requested: true,
                            help_requested_at: new Date().toISOString(),
                            help_notes: args.reason || 'Sinalizado ao atendente.'
                        }).eq('phone', phone)
                        result = JSON.stringify({ status: "success" })
                    } catch (err) { result = JSON.stringify({ status: "error" }) }
                }
                else if (toolCall.function.name === 'confirm_appointment') {
                    try {
                        const confirmed = await confirmAppointment(phone, args.date)
                        result = JSON.stringify(confirmed)
                    } catch (err) { result = JSON.stringify({ status: "error" }) }
                }

                const toolResult = { role: "tool", tool_call_id: toolCall.id, content: result }
                history.push(toolResult)
            }

            const nextCompletion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [messages[0], ...history],
                tools: toolTurn < 3 ? tools : undefined
            })
            aiMsg = nextCompletion.choices[0].message
            responseText = aiMsg.content
        }

        // 8. Update History and Database
        if (responseText) {
            history.push({ role: 'assistant', content: responseText })
            await supabase.from('wa_sessions')
                .update({ context_json: history, updated_at: new Date().toISOString() })
                .eq('phone', phone)
            await sendWhatsAppMessage(phone, responseText)
        }

        return NextResponse.json({ status: 'processed' })

    } catch (error) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
