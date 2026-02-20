import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { findAvailableSlots, bookAppointment, getAppointmentsByPhone, cancelAppointment } from '@/lib/calendar'

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
        }

        // 3.5 Check if client is registered
        let customerName = null
        const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('phone', phone)
            .single()
        if (customer) {
            customerName = customer.name
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

        // 6. Build calendar context for AI
        const moment = (await import('moment-timezone')).default
        await import('moment/locale/pt-br')
        moment.locale('pt-br')
        const now = moment().tz('America/Sao_Paulo')
        const todayLabel = now.format('dddd, DD [de] MMMM [de] YYYY')

        let calendarLines = ''
        for (let i = 0; i < 7; i++) {
            const day = now.clone().add(i, 'days')
            const dayName = day.format('dddd')
            const dateLabel = day.format('DD/MM/YYYY')
            const isoDate = day.format('YYYY-MM-DD')
            const isOpen = day.day() !== 0 && day.day() !== 1
            calendarLines += `- ${dayName} ${dateLabel} (${isoDate}) ${isOpen ? '✅ aberto' : '❌ fechado'}\n`
        }

        // 7. AI Brain (GPT-4o-mini)
        const messages = [
            {
                role: "system", content: `
Você é a Clara, secretária virtual do Espaço Camille Almeida (Espaço C.A.), um estúdio especializado em unhas de gel e esmaltação em gel.
Seu objetivo é agendar serviços, tirar dúvidas sobre preços e informar o protocolo de atendimento.
Hoje é ${todayLabel}.

--- CALENDÁRIO DOS PRÓXIMOS DIAS ---
${calendarLines}
Funcionamos de terça a sábado. Domingo e segunda estamos fechados.
${customerName ? `\n--- CLIENTE IDENTIFICADA ---\nEssa cliente já é cadastrada! O nome dela é: ${customerName}. Chame-a pelo nome de forma carinhosa.\n` : ''}
REGRAS DE COMPORTAMENTO:
1. Seja sempre simpática, acolhedora e profissional. Nunca use menus numerados.
2. Se o cliente perguntar sobre horários disponíveis, USE OBRIGATORIAMENTE a ferramenta 'check_calendar'.
3. Se o cliente ESCOLHER um horário e informar o NOME, USE OBRIGATORIAMENTE 'book_appointment' para confirmar. NUNCA diga que agendou sem usar a ferramenta.
4. Após confirmar um agendamento, SEMPRE informe a data completa (dia da semana + data + horário) e reforce o protocolo de atendimento.
5. Se não souber algo, pergunte educadamente.

--- TABELA DE PREÇOS ---

🔹 UNHAS DE GEL:
- Fibra ou Molde F1: R$ 190,00
- Banho de Gel: R$ 150,00
- Manutenção: R$ 150,00
- Manutenção (outra profissional): R$ 170,00
- Remoção: R$ 45,00

🔹 ESMALTAÇÃO EM GEL:
- Esmaltação Básica: R$ 20,00 (esmalte liso, com glitter, magnético ou refletivo)
- Esmaltação Premium: R$ 25,00 (francesinha lisa sem esmalte embaixo, pó cromado, linhas e formas orgânicas básicas, efeito baby...)
- Esmaltação ou Pó + Francesinha: R$ 35,00
- Esmaltação + Francesinha + Pó: R$ 45,00

--- PROTOCOLO DE ATENDIMENTO ---
Sempre que marcar um horário, informe educadamente as regras abaixo:
- ✅ Enviamos confirmação 1 dia antes. Não esqueça de confirmar!
- ⚠️ Cancelamentos com menos de 24h de antecedência serão cobrados 50% do valor do procedimento.
- ⏰ Tolerância de 20 minutos para atrasos. Após isso, a esmaltação não será realizada.
- 💅 Não faça a cutícula até 3 dias antes do atendimento.
- 📅 Manutenções devem ser feitas em até 25/30 dias.
- ⏳ Cada procedimento leva em média 1h30min a 2h.

--- CANCELAMENTO ---
6. Se o cliente pedir para CANCELAR, USE 'list_my_appointments' para buscar os agendamentos dele.
7. Mostre os agendamentos encontrados (data, hora e serviço) e pergunte qual deseja cancelar.
8. Quando o cliente confirmar, USE 'cancel_appointment' com a DATA do agendamento no formato YYYY-MM-DD.
9. Lembre o cliente que cancelamentos com menos de 24h de antecedência têm cobrança de 50%.

--- REAGENDAMENTO ---
10. Se o cliente pedir para REAGENDAR ou MUDAR HORÁRIO, USE 'list_my_appointments' para listar os agendamentos dele.
11. Pergunte qual agendamento deseja alterar e para qual nova data/horário.
12. USE 'cancel_appointment' para cancelar o agendamento antigo (com a data antiga no formato YYYY-MM-DD).
13. USE 'check_calendar' para verificar se o novo horário está disponível.
14. Se estiver livre, USE 'book_appointment' para agendar o novo horário.
15. Confirme ao cliente a mudança e reforce o protocolo de atendimento.
`},
            ...history
        ]

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            tools: [
                {
                    type: "function",
                    function: {
                        name: "check_calendar",
                        description: "Verifica horários livres na agenda.",
                        parameters: {
                            type: "object",
                            properties: {
                                date: { type: "string", description: "Data no formato YYYY-MM-DD. Se o usuário falar 'amanhã', calcule a data correta." }
                            }
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "book_appointment",
                        description: "Realiza o agendamento oficial no sistema.",
                        parameters: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "Nome completo do cliente." },
                                service: { type: "string", description: "O serviço escolhido (Fibra, Gel, Manutenção, etc)." },
                                startsAt: { type: "string", description: "Data e hora ISO. Ex: 2024-05-20T14:00:00" }
                            },
                            required: ["name", "service", "startsAt"]
                        }
                    }
                },
                {
                    type: "function",
                    function: {
                        name: "list_my_appointments",
                        description: "Lista os agendamentos futuros confirmados do cliente que está conversando.",
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
                                date: { type: "string", description: "Data do agendamento a cancelar no formato YYYY-MM-DD." }
                            },
                            required: ["date"]
                        }
                    }
                }
            ]
        })

        let aiMsg = completion.choices[0].message
        let responseText = aiMsg.content

        // 7. Handle Tool Calls
        if (aiMsg.tool_calls) {
            const toolMessages = [...messages, aiMsg]

            for (const toolCall of aiMsg.tool_calls) {
                let result = ""
                const args = JSON.parse(toolCall.function.arguments)

                if (toolCall.function.name === 'check_calendar') {
                    const slots = await findAvailableSlots({ requestedDate: args.date })
                    result = JSON.stringify(slots)
                }
                else if (toolCall.function.name === 'book_appointment') {
                    try {
                        console.log('🔵 BOOK_APPOINTMENT args:', JSON.stringify(args))
                        const appointment = await bookAppointment({
                            phone: phone,
                            name: args.name,
                            service: args.service,
                            startsAt: args.startsAt
                        })
                        console.log('✅ BOOK_APPOINTMENT success:', JSON.stringify(appointment))
                        result = JSON.stringify({ status: "success", appointment })

                        // Auto-register customer
                        try {
                            await supabase
                                .from('customers')
                                .upsert({ phone: phone, name: args.name }, { onConflict: 'phone' })
                        } catch (e) {
                            console.error('Customer upsert error:', e)
                        }
                    } catch (err) {
                        console.error('❌ BOOK_APPOINTMENT error:', err.message, JSON.stringify(err))
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
                        console.log('🔴 CANCEL args:', JSON.stringify(args), 'phone:', phone)
                        const cancelled = await cancelAppointment(phone, args.date)
                        console.log('✅ CANCEL success:', JSON.stringify(cancelled))
                        result = JSON.stringify({ status: "success", cancelled })
                    } catch (err) {
                        console.error('❌ CANCEL error:', err.message)
                        result = JSON.stringify({ status: "error", message: err.message })
                    }
                }

                toolMessages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: result
                })
            }

            // Second call to finalize AI response
            const finalCompletion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: toolMessages
            })
            responseText = finalCompletion.choices[0].message.content
        }

        // 8. Update History with AI Reply
        if (responseText) {
            history.push({ role: 'assistant', content: responseText })
            await supabase.from('wa_sessions').update({ context_json: history }).eq('phone', phone)

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
