import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { findAvailableSlots, bookAppointment, updateAppointment, getAppointmentsByPhone, cancelAppointment, isDayOpen, fetchScheduleOverrides } from '@/lib/calendar'
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
            console.error('🚫 Invalid API Key. Header:', headerKey, 'Body:', bodyKey)
            // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Support both Z-API (legacy) and Evolution API
        // Evolution API usually sends phone in body.data.key.remoteJid
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

        const audioUrl = isEvolution
            ? body.data?.message?.audioMessage?.url // Evolution might need different handling for audio
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
        } else {
            console.log('👤 Cliente nova. Phone:', phone, 'Error:', customerError?.message)
        }

        // 4. Process Content (Text or Audio)
        let userMessage = text
        if (audioUrl) {
            userMessage = "[ÁUDIO RECEBIDO - Transcrição pendente na v1]"
        }

        if (!userMessage) {
            return NextResponse.json({ status: 'empty-message' })
        }

        // 5. Update History (keep last 20 messages to avoid context overflow)
        let history = session.context_json || []
        history.push({ role: 'user', content: userMessage })
        if (history.length > 20) {
            history = history.slice(-20)
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

        // Fetch Settings for Niche and Global Info
        const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()
        const niche = settings?.niche || 'salon'
        const bizName = settings?.business_name || 'AgendaÍ'
        const welcome = settings?.welcome_message || ''

        // Fetch FAQs for bot knowledge
        const { data: faqs } = await supabase.from('faqs').select('*').eq('active', true)
        const faqsText = faqs && faqs.length > 0
            ? `--- PERGUNTAS FREQUENTES (BASE DE CONHECIMENTO)-- -\n` + faqs.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n')
            : ''

        // Create Niche-based Persona
        const personas = {
            salon: `Você é a Clara, a secretária virtual do ${bizName}. Você é gentil, usa muitos emojis e é especialista em beleza e estética.`,
            barber: `Você é o "Brother", o atendente gente boa da ${bizName}. Você fala de forma descontraída, usa gírias de barbearia (ex: "E aí, fera?", "Beleza, meu caro?") e é focado no estilo do cliente.`,
            clinic: `Você é a Dra. Clara, assistente da ${bizName}. Você é profissional, formal e extremamente organizada. Transmite confiança e saúde.`
        }
        const currentPersona = personas[niche] || personas.salon

        // Fetch active services and format for AI
        const { data: dbServices } = await supabase.from('services').select('*').eq('active', true).order('name')
        const servicesListText = dbServices && dbServices.length > 0
            ? dbServices.map(s => `- ${s.name}: R$ ${s.price.toFixed(2)}`).join('\n')
            : '- Nenhum serviço disponível no momento.'

        let calendarLines = ''
        for (let i = 0; i < 7; i++) {
            const day = now.clone().add(i, 'days')
            const dayName = day.format('dddd')
            const dateLabel = day.format('DD/MM/YYYY')
            const isoDate = day.format('YYYY-MM-DD')
            const isOpen = isDayOpen(isoDate, scheduleOverrides)
            const isOverride = scheduleOverrides.some(o => o.date === isoDate)
            const suffix = isOverride ? ' (exceção)' : ''
            calendarLines += `- ${dayName} ${dateLabel} (${isoDate}) ${isOpen ? '✅ aberto' + suffix : '❌ fechado' + suffix} \n`
        }

        // 7. AI Brain (GPT-4o-mini)
        const messages = [
            {
                role: "system", content: `
${currentPersona}
${welcome ? `Mensagem de Boas-vindas/Aviso: ${welcome}` : ''}

Seu objetivo é agendar serviços, tirar dúvidas sobre preços e informar sobre o estabelecimento.

Hoje é ${todayLabel}.

--- CALENDÁRIO DOS PRÓXIMOS DIAS-- -
    ${calendarLines}
Normalmente funcionamos de terça a sábado, mas pode haver exceções.Consulte SEMPRE o calendário acima para saber se um dia está aberto ou fechado.

    ${customerName ? `
--- CLIENTE IDENTIFICADA ---
Essa cliente já é cadastrada! O nome dela é: ${customerName}.
⚠️ REGRA DE OURO: Chame-a pelo nome (ex: "Oi, ${customerName}!") logo na primeira frase de CADA resposta. Seja carinhosa e atenciosa.
` : `
--- CLIENTE NOVA ---
Você ainda não sabe o nome desta cliente. 
⚠️ REGRA CRÍTICA: Se a cliente quiser agendar, você DEVE perguntar o nome dela antes de usar a ferramenta 'book_appointment'. Você só pode agendar se tiver o nome completo dela para o registro.
`}

${aptsContext}

${isFirstInteraction ? `REGRA DE SAUDAÇÃO: Como esta é a primeira mensagem da conversa, apresente-se: "${greeting}${customerName ? `, ${customerName}` : ''}! Sou o assistente virtual do ${bizName}. Como posso ajudar?".` : `REGRA DE SAUDAÇÃO: NÃO se apresente novamente. Comece a resposta direto com o nome dela: "Oi, ${customerName}..."`}

REGRAS DE COMPORTAMENTO:
1. PRIORIDADE DE AÇÃO: Se o cliente mencionar um serviço e uma data / dia, use 'check_calendar' ou 'book_appointment' IMEDIATAMENTE.
2. AGENDAMENTOS EXISTENTES: Se o cliente já tiver agendamentos(veja acima), mencione - os apenas uma vez.Não deixe que isso impeça de marcar NOVOS horários.
3. FLUXO DE AGENDAMENTO:
- Se o cliente perguntar por horários ou sugerir um dia: Use 'check_calendar'.
   - Se o cliente escolher um horário e você tiver o NOME: Use 'book_appointment' IMEDIATAMENTE após verificar a disponibilidade(se o usuário já demonstrou intenção de marcar).
   - Se não tiver o nome da cliente nova: Peça o nome ANTES de agendar.
4. PÓS-AÇÃO: Após concluir um agendamento ou cancelamento, encerre perguntando: "Posso ajudar em mais alguma coisa?".
5. PROTOCOLO E PREPARO: Você DEVE informar o protocolo de preparo (veja abaixo) COMPLETO sempre que um agendamento for confirmado. Não ignore nenhuma regra, especialmente a regra da cutícula.

6. REGRAS DE INTERATIVIDADE(NOVO):
   - ** Busca por Período **: Antes de listar os horários, pergunte: "Você prefere na parte da manhã ou da tarde?".Use o argumento 'period' na ferramenta 'check_calendar' para filtrar os resultados.
   - ** Venda Adicional(Upsell) **: Sempre que um agendamento estiver prestes a ser confirmado, pergunte: "Gostaria de aproveitar para adicionar mais algum serviço (como uma esmaltação rápida ou remoção)?".
   - ** Prevenção de Conflitos **: Se a cliente quiser dois serviços juntos, tente calcular a duração total e fazer um único agendamento longo em vez de dois separados.

--- TABELA DE PREÇOS (VALORES DINÂMICOS) ---
${servicesListText}

${faqsText}

--- CANCELAMENTO E REAGENDAMENTO-- -
    - Use 'list_my_appointments' para gerenciar agendamentos existentes.
- Sempre confirme a data antes de cancelar ou mudar.
`},
            ...history
        ]

        const tools = [
            {
                type: "function",
                function: {
                    name: "check_calendar",
                    description: "Verifica horários livres na agenda.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string", description: "Data no formato YYYY-MM-DD." },
                            period: { type: "string", enum: ["manha", "tarde"], description: "Filtro de período: 'manha' ou 'tarde'." }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "book_appointment",
                    description: "Realiza o agendamento oficial no sistema. Suporta múltiplos serviços.",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Nome completo do cliente." },
                            services: { type: "array", items: { type: "string" }, description: "Lista de serviços. Ex: ['Banho de Gel']" },
                            service: { type: "string", description: "Serviço único." },
                            startsAt: { type: "string", description: "Data e hora ISO. Ex: 2024-05-20T14:00:00" }
                        },
                        required: ["name", "startsAt"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "list_my_appointments",
                    description: "Lista os agendamentos futuros confirmados do cliente.",
                    parameters: { type: "object", properties: {} }
                }
            },
            {
                type: "function",
                function: {
                    name: "cancel_appointment",
                    description: "Cancela o agendamento do cliente na data informada.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string", description: "Data do agendamento a cancelar YYYY-MM-DD." }
                        },
                        required: ["date"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_appointment",
                    description: "Atualiza um agendamento existente (ex: adicionar um serviço novo no mesmo horário).",
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "O ID do agendamento (obtenha via list_my_appointments)." },
                            services: { type: "array", items: { type: "string" }, description: "Lista atualizada de serviços." }
                        },
                        required: ["id", "services"]
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
            console.log(`🌀 Turno de Ferramentas ${toolTurn} `)

            history.push(aiMsg) // Push the assistant tool call to history
            const toolMessagesForCompletion = [...messages, ...history.slice(messages.length - 1)] // Get recent history including aiMsg

            for (const toolCall of aiMsg.tool_calls) {
                let result = ""
                const args = JSON.parse(toolCall.function.arguments)
                console.log(`🛠️ Executando: ${toolCall.function.name} `, args)

                if (toolCall.function.name === 'check_calendar') {
                    const slots = await findAvailableSlots({
                        requestedDate: args.date,
                        period: args.period
                    })
                    result = JSON.stringify(slots)
                }
                else if (toolCall.function.name === 'book_appointment') {
                    try {
                        const appointment = await bookAppointment({
                            phone: phone,
                            name: args.name,
                            services: args.services || args.service,
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
                    } catch (err) {
                        result = JSON.stringify({ status: "error", message: err.message })
                    }
                }
                else if (toolCall.function.name === 'list_my_appointments') {
                    try {
                        const appointments = await getAppointmentsByPhone(phone)
                        result = JSON.stringify(appointments)
                    } catch (err) {
                        result = JSON.stringify({ status: "error", message: err.message })
                    }
                }
                else if (toolCall.function.name === 'cancel_appointment') {
                    try {
                        const cancelled = await cancelAppointment(phone, args.date)
                        result = JSON.stringify({ status: "success", cancelled })
                    } catch (err) {
                        result = JSON.stringify({ status: "error", message: err.message })
                    }
                }
                else if (toolCall.function.name === 'update_appointment') {
                    try {
                        const updated = await updateAppointment({
                            id: args.id,
                            services: args.services
                        })
                        result = JSON.stringify({ status: "success", updated })
                    } catch (err) {
                        result = JSON.stringify({ status: "error", message: err.message })
                    }
                }

                const toolResult = { role: "tool", tool_call_id: toolCall.id, content: result }
                history.push(toolResult)
            }

            // Next completion to see if more tools are needed or final text
            const nextCompletion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [messages[0], ...history],
                tools: toolTurn < 3 ? tools : undefined
            })

            aiMsg = nextCompletion.choices[0].message
            responseText = aiMsg.content
        }

        // 8. Update History with AI Reply
        if (responseText) {
            history.push({ role: 'assistant', content: responseText })
            await supabase.from('wa_sessions')
                .update({ context_json: history, updated_at: new Date().toISOString() })
                .eq('phone', phone)

            // 9. Send back to WhatsApp (Z-API)
            await sendWhatsAppMessage(phone, responseText)
            console.log('AI Response sent:', responseText)
        }

        return NextResponse.json({ status: 'processed', reply: responseText })

    } catch (error) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

