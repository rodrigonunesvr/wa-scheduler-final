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
            console.log('ÃƒÂ°Ã…Â¸Ã‚Â¤Ã¢â‚¬â€œ MÃƒÆ’Ã‚Â³dulo de Bot desativado no SAAS_CONFIG. Ignorando processamento de IA.')
            return NextResponse.json({ status: 'bot-disabled' })
        }

        const body = await request.json()
        console.log('Webhook received:', JSON.stringify(body, null, 2))

        // Validation check (Support both header and body)
        const headerKey = request.headers.get('apikey')
        const bodyKey = body.apikey
        const currentApiKey = process.env.EVOLUTION_API_KEY

        if (headerKey !== currentApiKey && bodyKey !== currentApiKey) {
            console.error('ÃƒÂ°Ã…Â¸Ã…Â¡Ã‚Â« Invalid API Key. Header:', headerKey, 'Body:', bodyKey)
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
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Error fetching session:', fetchError)
        }

        let session = existingSession

        if (!session) {
            console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Â Ã¢â‚¬Â¢ Criando nova sessÃƒÆ’Ã‚Â£o para:', phone)
            const { data: newSession, error: insertError } = await supabase
                .from('wa_sessions')
                .insert({ phone, state: 'START', context_json: [] })
                .select()
                .maybeSingle()

            if (insertError) {
                console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Error creating session:', insertError)
                return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
            }
            session = newSession
        } else {
            // 3.1 Session Timeout (10 minutes)
            const lastUpdate = new Date(session.updated_at).getTime()
            const nowMs = new Date().getTime()
            const diffMins = (nowMs - lastUpdate) / (1000 * 60)

            if (diffMins > 10) {
                console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬Â¢Ã¢â‚¬â„¢ SessÃƒÆ’Ã‚Â£o expirada (>10min). Resetando histÃƒÆ’Ã‚Â³rico.')
                session.context_json = []
            }
        }

        if (!session) {
            console.error('ÃƒÂ¢Ã‚ÂÃ…â€™ Session is still null after attempt to create')
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
            console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¤ Cliente reconhecida:', customerName)
        } else {
            console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ËœÃ‚Â¤ Cliente nova. Phone:', phone, 'Error:', customerError?.message)
        }

        // 4. Process Content (Text or Audio)
        let userMessage = text
        if (audioUrl) {
            userMessage = "[ÃƒÆ’Ã‚ÂUDIO RECEBIDO - TranscriÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o pendente na v1]"
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
        let greeting = 'OlÃƒÆ’Ã‚Â¡'
        if (currentHour >= 5 && currentHour < 12) greeting = 'Bom dia'
        else if (currentHour >= 12 && currentHour < 18) greeting = 'Boa tarde'
        else greeting = 'Boa noite'

        // 6.2 Fetch Existing Appointments for the client
        const futureApts = await getAppointmentsByPhone(phone)
        const hasApts = futureApts && futureApts.length > 0
        const aptsContext = hasApts
            ? `\n-- - AGENDAMENTOS FUTUROS DESTA CLIENTE-- -\n` + futureApts.map(a => ` - ${moment(a.starts_at).tz('America/Sao_Paulo').format('DD/MM [ÃƒÆ’Ã‚Â s] HH:mm')}: ${a.service_id} `).join('\n')
            : '\nEsta cliente nÃƒÆ’Ã‚Â£o possui agendamentos futuros registrados.'

        // 6.3 Determine if this is the start of the session (no assistant messages yet)
        const isFirstInteraction = !history.some(m => m.role === 'assistant')

        // Fetch Settings for Niche and Global Info
        const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()
        const niche = settings?.niche || 'salon'
        const bizName = settings?.business_name || 'AgendaÃƒÂ'
        const welcome = settings?.welcome_message || ''

        // Fetch FAQs for bot knowledge
        const { data: faqs } = await supabase.from('faqs').select('*').eq('active', true)
        const faqsText = faqs && faqs.length > 0
            ? `--- PERGUNTAS FREQUENTES (BASE DE CONHECIMENTO)-- -\n` + faqs.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n')
            : ''

        // Create Niche-based Persona
        const personas = {
            salon: `VocÃƒÆ’Ã‚Âª ÃƒÆ’Ã‚Â© a Clara, a secretÃƒÆ’Ã‚Â¡ria virtual do ${bizName}. VocÃƒÆ’Ã‚Âª ÃƒÆ’Ã‚Â© gentil, usa muitos emojis e ÃƒÆ’Ã‚Â© especialista em beleza e estÃƒÆ’Ã‚Â©tica.`,
            barber: `VocÃƒÆ’Ã‚Âª ÃƒÆ’Ã‚Â© o "Brother", o atendente gente boa da ${bizName}. VocÃƒÆ’Ã‚Âª fala de forma descontraÃƒÆ’Ã‚Â­da, usa gÃƒÆ’Ã‚Â­rias de barbearia (ex: "E aÃƒÆ’Ã‚Â­, fera?", "Beleza, meu caro?") e ÃƒÆ’Ã‚Â© focado no estilo do cliente.`,
            clinic: `VocÃƒÆ’Ã‚Âª ÃƒÆ’Ã‚Â© a Dra. Clara, assistente da ${bizName}. VocÃƒÆ’Ã‚Âª ÃƒÆ’Ã‚Â© profissional, formal e extremamente organizada. Transmite confianÃƒÆ’Ã‚Â§a e saÃƒÆ’Ã‚Âºde.`
        }
        const currentPersona = personas[niche] || personas.salon

        // Fetch active services and format for AI
        const { data: dbServices } = await supabase.from('services').select('*').eq('active', true).order('name')
        const servicesListText = dbServices && dbServices.length > 0
            ? dbServices.map(s => `- ${s.name}: R$ ${s.price.toFixed(2)}`).join('\n')
            : '- Nenhum serviÃƒÆ’Ã‚Â§o disponÃƒÆ’Ã‚Â­vel no momento.'

        let calendarLines = ''
        for (let i = 0; i < 7; i++) {
            const day = now.clone().add(i, 'days')
            const dayName = day.format('dddd')
            const dateLabel = day.format('DD/MM/YYYY')
            const isoDate = day.format('YYYY-MM-DD')
            const isOpen = isDayOpen(isoDate, scheduleOverrides)
            const isOverride = scheduleOverrides.some(o => o.date === isoDate)
            const suffix = isOverride ? ' (exceÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o)' : ''
            calendarLines += `- ${dayName} ${dateLabel} (${isoDate}) ${isOpen ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ aberto' + suffix : 'ÃƒÂ¢Ã‚ÂÃ…â€™ fechado' + suffix} \n`
        }

        // 7. AI Brain (GPT-4o-mini)
        const messages = [
            {
                role: "system", content: `
${currentPersona}
${welcome ? `Mensagem de Boas-vindas/Aviso: ${welcome}` : ''}

Seu objetivo ÃƒÆ’Ã‚Â© agendar serviÃƒÆ’Ã‚Â§os, tirar dÃƒÆ’Ã‚Âºvidas sobre preÃƒÆ’Ã‚Â§os e informar sobre o estabelecimento.

Hoje ÃƒÆ’Ã‚Â© ${todayLabel}.

--- CALENDÃƒÆ’Ã‚ÂRIO DOS PRÃƒÆ’Ã¢â‚¬Å“XIMOS DIAS-- -
    ${calendarLines}
Normalmente funcionamos de terÃƒÆ’Ã‚Â§a a sÃƒÆ’Ã‚Â¡bado, mas pode haver exceÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes.Consulte SEMPRE o calendÃƒÆ’Ã‚Â¡rio acima para saber se um dia estÃƒÆ’Ã‚Â¡ aberto ou fechado.

    ${customerName ? `
--- CLIENTE IDENTIFICADA ---
Essa cliente jÃƒÆ’Ã‚Â¡ ÃƒÆ’Ã‚Â© cadastrada! O nome dela ÃƒÆ’Ã‚Â©: ${customerName}.
ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â REGRA DE OURO: Chame-a pelo nome (ex: "Oi, ${customerName}!") logo na primeira frase de CADA resposta. Seja carinhosa e atenciosa.
` : `
--- CLIENTE NOVA ---
VocÃƒÆ’Ã‚Âª ainda nÃƒÆ’Ã‚Â£o sabe o nome desta cliente. 
ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â REGRA CRÃƒÆ’Ã‚ÂTICA: Se a cliente quiser agendar, vocÃƒÆ’Ã‚Âª DEVE perguntar o nome dela antes de usar a ferramenta 'book_appointment'. VocÃƒÆ’Ã‚Âª sÃƒÆ’Ã‚Â³ pode agendar se tiver o nome completo dela para o registro.
`}

${aptsContext}

${isFirstInteraction ? `REGRA DE SAUDAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O: Como esta ÃƒÆ’Ã‚Â© a primeira mensagem da conversa, apresente-se: "${greeting}${customerName ? `, ${customerName}` : ''}! Sou o assistente virtual do ${bizName}. Como posso ajudar?".` : `REGRA DE SAUDAÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O: NÃƒÆ’Ã†â€™O se apresente novamente. Comece a resposta direto com o nome dela: "Oi, ${customerName}..."`}

REGRAS DE COMPORTAMENTO:
1. PRIORIDADE DE AÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O: Se o cliente mencionar um serviÃƒÆ’Ã‚Â§o e uma data / dia, use 'check_calendar' ou 'book_appointment' IMEDIATAMENTE.
2. AGENDAMENTOS EXISTENTES: Se o cliente jÃƒÆ’Ã‚Â¡ tiver agendamentos(veja acima), mencione - os apenas uma vez.NÃƒÆ’Ã‚Â£o deixe que isso impeÃƒÆ’Ã‚Â§a de marcar NOVOS horÃƒÆ’Ã‚Â¡rios.
3. FLUXO DE AGENDAMENTO:
- Se o cliente perguntar por horÃƒÆ’Ã‚Â¡rios ou sugerir um dia: Use 'check_calendar'.
   - Se o cliente escolher um horÃƒÆ’Ã‚Â¡rio e vocÃƒÆ’Ã‚Âª tiver o NOME: Use 'book_appointment' IMEDIATAMENTE apÃƒÆ’Ã‚Â³s verificar a disponibilidade(se o usuÃƒÆ’Ã‚Â¡rio jÃƒÆ’Ã‚Â¡ demonstrou intenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de marcar).
   - Se nÃƒÆ’Ã‚Â£o tiver o nome da cliente nova: PeÃƒÆ’Ã‚Â§a o nome ANTES de agendar.
4. PÃƒÆ’Ã¢â‚¬Å“S-AÃƒÆ’Ã¢â‚¬Â¡ÃƒÆ’Ã†â€™O: ApÃƒÆ’Ã‚Â³s concluir um agendamento ou cancelamento, encerre perguntando: "Posso ajudar em mais alguma coisa?".
5. PROTOCOLO E PREPARO: VocÃƒÆ’Ã‚Âª DEVE informar o protocolo de preparo (veja abaixo) COMPLETO sempre que um agendamento for confirmado. NÃƒÆ’Ã‚Â£o ignore nenhuma regra, especialmente a regra da cutÃƒÆ’Ã‚Â­cula.

6. REGRAS DE INTERATIVIDADE(NOVO):
   - ** Busca por PerÃƒÆ’Ã‚Â­odo **: Antes de listar os horÃƒÆ’Ã‚Â¡rios, pergunte: "VocÃƒÆ’Ã‚Âª prefere na parte da manhÃƒÆ’Ã‚Â£ ou da tarde?".Use o argumento 'period' na ferramenta 'check_calendar' para filtrar os resultados.
   - ** Venda Adicional(Upsell) **: Sempre que um agendamento estiver prestes a ser confirmado, pergunte: "Gostaria de aproveitar para adicionar mais algum serviÃƒÆ’Ã‚Â§o (como uma esmaltaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o rÃƒÆ’Ã‚Â¡pida ou remoÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o)?".
   - ** PrevenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o de Conflitos **: Se a cliente quiser dois serviÃƒÆ’Ã‚Â§os juntos, tente calcular a duraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o total e fazer um ÃƒÆ’Ã‚Âºnico agendamento longo em vez de dois separados.

--- TABELA DE PREÃƒÆ’Ã¢â‚¬Â¡OS (VALORES DINÃƒÆ’Ã¢â‚¬Å¡MICOS) ---
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
                    description: "Verifica horÃƒÆ’Ã‚Â¡rios livres na agenda.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string", description: "Data no formato YYYY-MM-DD." },
                            period: { type: "string", enum: ["manha", "tarde"], description: "Filtro de perÃƒÆ’Ã‚Â­odo: 'manha' ou 'tarde'." }
                        }
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "book_appointment",
                    description: "Realiza o agendamento oficial no sistema. Suporta mÃƒÆ’Ã‚Âºltiplos serviÃƒÆ’Ã‚Â§os.",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Nome completo do cliente." },
                            services: { type: "array", items: { type: "string" }, description: "Lista de serviÃƒÆ’Ã‚Â§os. Ex: ['Banho de Gel']" },
                            service: { type: "string", description: "ServiÃƒÆ’Ã‚Â§o ÃƒÆ’Ã‚Âºnico." },
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
                    description: "Atualiza um agendamento existente (ex: adicionar um serviÃƒÆ’Ã‚Â§o novo no mesmo horÃƒÆ’Ã‚Â¡rio).",
                    parameters: {
                        type: "object",
                        properties: {
                            id: { type: "string", description: "O ID do agendamento (obtenha via list_my_appointments)." },
                            services: { type: "array", items: { type: "string" }, description: "Lista atualizada de serviÃƒÆ’Ã‚Â§os." }
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
            console.log(`ÃƒÂ°Ã…Â¸Ã…â€™Ã¢â€šÂ¬ Turno de Ferramentas ${toolTurn} `)

            history.push(aiMsg) // Push the assistant tool call to history
            const toolMessagesForCompletion = [...messages, ...history.slice(messages.length - 1)] // Get recent history including aiMsg

            for (const toolCall of aiMsg.tool_calls) {
                let result = ""
                const args = JSON.parse(toolCall.function.arguments)
                console.log(`ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂºÃ‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Executando: ${toolCall.function.name} `, args)

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

