import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { findAvailableSlots, bookAppointment, getAppointmentsByPhone, cancelAppointment, isDayOpen, fetchScheduleOverrides } from '@/lib/calendar'

// 1. Validate Z-API Token
function validateToken(request) {
    const securityToken = request.headers.get('client-token')
    return securityToken === process.env.ZAPI_SECURITY_TOKEN
}

// 2. Main Webhook Handler
export async function POST(request) {
    try {
        const body = await request.json()
        console.log('Webhook received:', JSON.stringify(body, null, 2))

        const isGroup = body.isGroup
        const fromMe = body.fromMe
        if (isGroup || fromMe) {
            return NextResponse.json({ status: 'ignored' })
        }

        const phone = body.phone
        const text = body.message?.text?.message || body.text?.message || ''
        const audioUrl = body.message?.audio?.audioUrl

        if (!phone) {
            return NextResponse.json({ status: 'no-phone' })
        }

        // 3. Load or Create Session
        let { data: session } = await supabase
            .from('wa_sessions')
            .select('*')
            .eq('phone', phone)
            .single()

        if (!session) {
            const { data: newSession } = await supabase
                .from('wa_sessions')
                .insert({ phone, state: 'START', context_json: [] })
                .select()
                .single()
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

        // 3.5 Check if client is registered
        let customerName = null
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('name')
            .eq('phone', phone)
            .single()
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
            ? `\n--- AGENDAMENTOS FUTUROS DESTA CLIENTE ---\n` + futureApts.map(a => `- ${moment(a.starts_at).tz('America/Sao_Paulo').format('DD/MM [às] HH:mm')}: ${a.service_id}`).join('\n')
            : '\nEsta cliente não possui agendamentos futuros registrados.'

        // 6.3 Determine if this is the start of the session (no assistant messages yet)
        const isFirstInteraction = !history.some(m => m.role === 'assistant')

        // Fetch schedule overrides to determine open/closed days dynamically
        const scheduleOverrides = await fetchScheduleOverrides()

        let calendarLines = ''
        for (let i = 0; i < 7; i++) {
            const day = now.clone().add(i, 'days')
            const dayName = day.format('dddd')
            const dateLabel = day.format('DD/MM/YYYY')
            const isoDate = day.format('YYYY-MM-DD')
            const isOpen = isDayOpen(isoDate, scheduleOverrides)
            const isOverride = scheduleOverrides.some(o => o.date === isoDate)
            const suffix = isOverride ? ' (exceção)' : ''
            calendarLines += `- ${dayName} ${dateLabel} (${isoDate}) ${isOpen ? '✅ aberto' + suffix : '❌ fechado' + suffix}\n`
        }

        // 7. AI Brain (GPT-4o-mini)
        const messages = [
            {
                role: "system", content: `
Olá, meu nome é Clara! 😄 Sou a secretária virtual do Espaço Camille Almeida (Espaço C.A.), um estúdio especializado em unhas de gel e esmaltação em gel.
Seu objetivo é agendar serviços, tirar dúvidas sobre preços e informar o protocolo de atendimento.

Hoje é ${todayLabel}.

--- CALENDÁRIO DOS PRÓXIMOS DIAS ---
${calendarLines}
Normalmente funcionamos de terça a sábado, mas pode haver exceções. Consulte SEMPRE o calendário acima para saber se um dia está aberto ou fechado.

${customerName ? `
--- CLIENTE IDENTIFICADA ---
Essa cliente já é cadastrada! O nome dela é: ${customerName}.
SEMPRE chame-a pelo nome de forma carinhosa em TODAS as respostas.
` : `
--- CLIENTE NOVA ---
Você ainda não sabe o nome desta cliente. 
⚠️ REGRA CRÍTICA: Se a cliente quiser agendar, você DEVE perguntar o nome dela antes de usar a ferramenta 'book_appointment'. Você só pode agendar se tiver o nome completo dela para o registro.
`}

${aptsContext}

${isFirstInteraction ? `REGRA DE SAUDAÇÃO: Como esta é a primeira mensagem da conversa, apresente-se: "${greeting}, meu nome é Clara! Como posso ajudar?".` : 'REGRA DE SAUDAÇÃO: NÃO se apresente e NÃO diga seu nome novamente. Apenas responda de forma direta.'}

REGRAS DE COMPORTAMENTO:
1. PRIORIDADE DE AÇÃO: Se o cliente mencionar um serviço e uma data/dia, use 'check_calendar' ou 'book_appointment' IMEDIATAMENTE.
2. AGENDAMENTOS EXISTENTES: Se o cliente já tiver agendamentos (veja acima), mencione-os apenas uma vez. Não deixe que isso impeça de marcar NOVOS horários.
3. FLUXO DE AGENDAMENTO:
   - Se o cliente perguntar por horários ou sugerir um dia: Use 'check_calendar'.
   - Se o cliente escolher um horário e você tiver o NOME: Use 'book_appointment' IMEDIATAMENTE após verificar a disponibilidade (se o usuário já demonstrou intenção de marcar).
   - Se não tiver o nome da cliente nova: Peça o nome ANTES de agendar.
4. PÓS-AÇÃO: Após concluir um agendamento ou cancelamento, encerre perguntando: "Posso ajudar em mais alguma coisa?".
5. PROTOCOLO: Informe o protocolo apenas uma vez após confirmar um agendamento.

--- TABELA DE PREÇOS (VALORES) ---
🔹 UNHAS DE GEL:
- Fibra ou Molde F1: R$ 190,00
- Banho de Gel: R$ 150,00
- Manutenção: R$ 150,00
- Manutenção (outra profissional): R$ 170,00
- Remoção: R$ 45,00

🔹 ESMALTAÇÃO EM GEL:
- Esmaltação Básica: R$ 20,00
- Esmaltação Premium: R$ 25,00
- Esmaltação ou Pó + Francesinha: R$ 35,00
- Esmaltação + Francesinha + Pó: R$ 45,00

--- PROTOCOLO DE ATENDIMENTO ---
- ✅ Enviamos confirmação 1 dia antes.
- ⚠️ Cancelamentos com menos de 24h: multa de 50%.
- ⏰ Tolerância de 20 minutos para atrasos.
- 💅 Não faça a cutícula até 3 dias antes.
- 📅 Manutenções: a cada 25/30 dias.

--- CANCELAMENTO E REAGENDAMENTO ---
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
                            date: { type: "string", description: "Data no formato YYYY-MM-DD." }
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
            console.log(`🌀 Turno de Ferramentas ${toolTurn}`)

            history.push(aiMsg) // Push the assistant tool call to history
            const toolMessagesForCompletion = [...messages, ...history.slice(messages.length - 1)] // Get recent history including aiMsg

            for (const toolCall of aiMsg.tool_calls) {
                let result = ""
                const args = JSON.parse(toolCall.function.arguments)
                console.log(`🛠️ Executando: ${toolCall.function.name}`, args)

                if (toolCall.function.name === 'check_calendar') {
                    const slots = await findAvailableSlots({ requestedDate: args.date })
                    result = JSON.stringify(slots)
                }
                else if (toolCall.function.name === 'book_appointment') {
                    try {
                        const serviceList = args.services || (args.service ? [args.service] : [])
                        const serviceStr = serviceList.length > 1 ? JSON.stringify(serviceList) : serviceList[0]
                        const DURATIONS = { 'Fibra ou Molde F1': 120, 'Banho de Gel': 90, 'Manutenção': 120, 'Manutenção (outra prof.)': 120, 'Remoção': 30, 'Esmaltação Básica': 30, 'Esmaltação Premium': 45, 'Esm. ou Pó + Francesinha': 45, 'Esm. + Francesinha + Pó': 60 }
                        const totalDuration = serviceList.reduce((sum, s) => sum + (DURATIONS[s] || 60), 0)

                        const appointment = await bookAppointment({
                            phone: phone, name: args.name, service: serviceStr, startsAt: args.startsAt, duration: totalDuration
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

// Helper: Send Message via Z-API
async function sendWhatsAppMessage(phone, message) {
    const instanceId = process.env.ZAPI_INSTANCE_ID
    const instanceToken = process.env.ZAPI_INSTANCE_TOKEN
    const clientToken = process.env.ZAPI_SECURITY_TOKEN

    if (!instanceId || !instanceToken) {
        console.error('Missing Z-API Credentials')
        return
    }

    const url = `https://api.z-api.io/instances/${instanceId}/token/${instanceToken}/send-text`

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Client-Token': clientToken // Optional security header
            },
            body: JSON.stringify({
                phone: phone,
                message: message
            })
        })

        if (!response.ok) {
            const errorData = await response.text()
            console.error('Z-API Error:', errorData)
        }
    } catch (error) {
        console.error('Fetch Error:', error)
    }
}
