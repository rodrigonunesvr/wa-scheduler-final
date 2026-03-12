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
            console.log('ðŸ¤– MÃ³dulo de Bot desativado no SAAS_CONFIG. Ignorando processamento de IA.')
            return NextResponse.json({ status: 'bot-disabled' })
        }

        const body = await request.json()
        console.log('Webhook received:', JSON.stringify(body, null, 2))

        // Validation check (Support both header and body)
        const headerKey = request.headers.get('apikey')
        const bodyKey = body.apikey
        const currentApiKey = process.env.EVOLUTION_API_KEY

        if (headerKey !== currentApiKey && bodyKey !== currentApiKey) {
            console.error('ðŸš« Invalid API Key. Header:', headerKey, 'Body:', bodyKey)
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
            console.error('âŒ Error fetching session:', fetchError)
        }

        let session = existingSession

        if (!session) {
            console.log('ðŸ†• Criando nova sessÃ£o para:', phone)
            const { data: newSession, error: insertError } = await supabase
                .from('wa_sessions')
                .insert({ phone, state: 'START', context_json: [] })
                .select()
                .maybeSingle()

            if (insertError) {
                console.error('âŒ Error creating session:', insertError)
                return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
            }
            session = newSession
        } else {
            // 3.1 Session Timeout (10 minutes)
            const lastUpdate = new Date(session.updated_at).getTime()
            const nowMs = new Date().getTime()
            const diffMins = (nowMs - lastUpdate) / (1000 * 60)

            if (diffMins > 10) {
                console.log('ðŸ•’ SessÃ£o expirada (>10min). Resetando histÃ³rico.')
                session.context_json = []
            }
        }

        if (!session) {
            console.error('âŒ Session is still null after attempt to create')
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
            console.log('ðŸ‘¤ Cliente reconhecida:', customerName)
        } else {
            console.log('ðŸ‘¤ Cliente nova. Phone:', phone, 'Error:', customerError?.message)
        }

        // 4. Process Content (Text or Audio)
        let userMessage = text
        if (audioUrl) {
            userMessage = "[ÃUDIO RECEBIDO - TranscriÃ§Ã£o pendente na v1]"
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
        let greeting = 'OlÃ¡'
        if (currentHour >= 5 && currentHour < 12) greeting = 'Bom dia'
        else if (currentHour >= 12 && currentHour < 18) greeting = 'Boa tarde'
        else greeting = 'Boa noite'

        // 6.2 Fetch Existing Appointments for the client
        const futureApts = await getAppointmentsByPhone(phone)
        const hasApts = futureApts && futureApts.length > 0
        const aptsContext = hasApts
            ? `\n-- - AGENDAMENTOS FUTUROS DESTA CLIENTE-- -\n` + futureApts.map(a => ` - ${moment(a.starts_at).tz('America/Sao_Paulo').format('DD/MM [Ã s] HH:mm')}: ${a.service_id} `).join('\n')
            : '\nEsta cliente nÃ£o possui agendamentos futuros registrados.'

        // 6.3 Determine if this is the start of the session (no assistant messages yet)
        const isFirstInteraction = !history.some(m => m.role === 'assistant')

        // Fetch Settings for Niche and Global Info
        const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()
        const niche = settings?.niche || 'salon'
        const bizName = settings?.business_name || 'AgendaÃ'
        const welcome = settings?.welcome_message || ''

        // Fetch FAQs for bot knowledge
        const { data: faqs } = await supabase.from('faqs').select('*').eq('active', true)
        const faqsText = faqs && faqs.length > 0
            ? `--- PERGUNTAS FREQUENTES (BASE DE CONHECIMENTO)-- -\n` + faqs.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n')
            : ''

        // Create Niche-based Persona
        const personas = {
            salon: `VocÃª Ã© a Clara, a secretÃ¡ria virtual do ${bizName}. VocÃª Ã© gentil, usa muitos emojis e Ã© especialista em beleza e estÃ©tica.`,
            barber: `VocÃª Ã© o "Brother", o atendente gente boa da ${bizName}. VocÃª fala de forma descontraÃ­da, usa gÃ­rias de barbearia (ex: "E aÃ­, fera?", "Beleza, meu caro?") e Ã© focado no estilo do cliente.`,
            clinic: `VocÃª Ã© a Dra. Clara, assistente da ${bizName}. VocÃª Ã© profissional, formal e extremamente organizada. Transmite confianÃ§a e saÃºde.`
        }
        const currentPersona = personas[niche] || personas.salon

        // Fetch active services and format for AI
        const { data: dbServices } = await supabase.from('services').select('*').eq('active', true).order('name')
        const servicesListText = dbServices && dbServices.length > 0
            ? dbServices.map(s => `- ${s.name}: R$ ${s.price.toFixed(2)}`).join('\n')
            : '- Nenhum serviÃ§o disponÃ­vel no momento.'

        let calendarLines = ''
        for (let i = 0; i < 7; i++) {
            const day = now.clone().add(i, 'days')
            const dayName = day.format('dddd')
            const dateLabel = day.format('DD/MM/YYYY')
            const isoDate = day.format('YYYY-MM-DD')
            const isOpen = isDayOpen(isoDate, scheduleOverrides)
            const isOverride = scheduleOverrides.some(o => o.date === isoDate)
            const suffix = isOverride ? ' (exceÃ§Ã£o)' : ''
            calendarLines += `- ${dayName} ${dateLabel} (${isoDate}) ${isOpen ? 'âœ… aberto' + suffix : 'âŒ fechado' + suffix} \n`
        }

        // 7. AI Brain (GPT-4o-mini)
        const messages = [
            {
                role: "system", content: `
${currentPersona}
${welcome ? `Mensagem de Boas-vindas/Aviso: ${welcome}` : ''}

Seu objetivo Ã© agendar serviÃ§os, tirar dÃºvidas sobre preÃ§os e informar sobre o estabelecimento.

Hoje Ã© ${todayLabel}.

--- CALENDÃRIO DOS PRÃ“XIMOS DIAS-- -
    ${calendarLines}
Normalmente funcionamos de terÃ§a a sÃ¡bado, mas pode haver exceÃ§Ãµes.Consulte SEMPRE o calendÃ¡rio acima para saber se um dia estÃ¡ aberto ou fechado.

    ${customerName ? `
--- CLIENTE IDENTIFICADA ---
Essa cliente jÃ¡ Ã© cadastrada! O nome dela Ã©: ${customerName}.
âš ï¸ REGRA DE OURO: Chame-a pelo nome (ex: "Oi, ${customerName}!") logo na primeira frase de CADA resposta. Seja carinhosa e atenciosa.
` : `
--- CLIENTE NOVA ---
VocÃª ainda nÃ£o sabe o nome desta cliente. 
âš ï¸ REGRA CRÃTICA: Se a cliente quiser agendar, vocÃª DEVE perguntar o nome dela antes de usar a ferramenta 'book_appointment'. VocÃª sÃ³ pode agendar se tiver o nome completo dela para o registro.
`}

${aptsContext}

${isFirstInteraction ? `REGRA DE SAUDAÃ‡ÃƒO: Como esta Ã© a primeira mensagem da conversa, apresente-se: "${greeting}${customerName ? `, ${customerName}` : ''}! Sou o assistente virtual do ${bizName}. Como posso ajudar?".` : `REGRA DE SAUDAÃ‡ÃƒO: NÃƒO se apresente novamente. Comece a resposta direto com o nome dela: "Oi, ${customerName}..."`}

REGRAS DE COMPORTAMENTO:
1. PRIORIDADE DE AÃ‡ÃƒO: Se o cliente mencionar um serviÃ§o e uma data / dia, use 'check_calendar' ou 'book_appointment' IMEDIATAMENTE.
2. AGENDAMENTOS EXISTENTES: Se o cliente jÃ¡ tiver agendamentos(veja acima), mencione - os apenas uma vez.NÃ£o deixe que isso impeÃ§a de marcar NOVOS horÃ¡rios.
3. FLUXO DE AGENDAMENTO:
- Se o cliente perguntar por horÃ¡rios ou sugerir um dia: Use 'check_calendar'.
   - Se o cliente escolher um horÃ¡rio e vocÃª tiver o NOME: Use 'book_appointment' IMEDIATAMENTE apÃ³s verificar a disponibilidade(se o usuÃ¡rio jÃ¡ demonstrou intenÃ§Ã£o de marcar).
   - Se nÃ£o tiver o nome da cliente nova: PeÃ§a o nome ANTES de agendar.
4. PÃ“S-AÃ‡ÃƒO: ApÃ³s concluir um agendamento ou cancelamento, encerre perguntando: "Posso ajudar em mais alguma coisa?".
5. PROTOCOLO E PREPARO: VocÃª DEVE informar o protocolo de preparo (veja abaixo) COMPLETO sempre que um agendamento for confirmado. NÃ£o ignore nenhuma regra, especialmente a regra da cutÃ­cula.

6. REGRAS DE INTERATIVIDADE(NOVO):
   - ** Busca por PerÃ­odo **: Antes de listar os horÃ¡rios, pergunte: "VocÃª prefere na parte da manhÃ£ ou da tarde?".Use o argumento 'period' na ferramenta 'check_calendar' para filtrar os resultados.
   - ** Venda Adicional(Upsell) **: Sempre que um agendamento estiver prestes a ser confirmado, pergunte: "Gostaria de aproveitar para adicionar mais algum serviÃ§o (como uma esmaltaÃ§Ã£o rÃ¡pida ou remoÃ§Ã£o)?".
   - ** PrevenÃ§Ã£o de Conflitos **: Se a cliente quiser dois serviÃ§os juntos, tente calcular a duraÃ§Ã£o total e fazer um Ãºnico agendamento longo em vez de dois separados.

--- TABELA DE PREÃ‡OS (VALORES DINÃ‚MICOS) ---
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
                    description: "Verifica horÃ¡rios livres na agenda.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string", description: "Data no formato YYYY-MM-DD." },
                            period: { type: "string", enum: ["manha", "tarde"], description: "Filtro de perÃ­odo: 'manha' ou 'tarde'." }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "book_appointment",
                    description: "Realiza o agendamento oficial no sistema. Suporta mÃºltiplos serviÃ§os.",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Nome completo do cliente." },
                            services: { type: "array", items: { type: "string" }, description: "Lista de serviÃ§os. Ex: ['Banho de Gel']" },
                            service: { type: "string", description: "ServiÃ§o Ãºnico." },
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
                    description: "Atualiza um agendamento existente (ex: adicionar um serviÃ§o novo no mesmo horÃ¡rio).",
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "O ID do agendamento (obtenha via list_my_appointments)." },
                            services: { type: "array", items: { type: "string" }, description: "Lista atualizada de serviÃ§os." }
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
            console.log(`ðŸŒ€ Turno de Ferramentas ${toolTurn} `)

            history.push(aiMsg) // Push the assistant tool call to history
            const toolMessagesForCompletion = [...messages, ...history.slice(messages.length - 1)] // Get recent history including aiMsg

            for (const toolCall of aiMsg.tool_calls) {
                let result = ""
                const args = JSON.parse(toolCall.function.arguments)
                console.log(`ðŸ› ï¸ Executando: ${toolCall.function.name} `, args)

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

