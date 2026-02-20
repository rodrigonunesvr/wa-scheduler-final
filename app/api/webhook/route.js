import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { findAvailableSlots, bookAppointment } from '@/lib/calendar'

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

        // 4. Process Content (Text or Audio)
        let userMessage = text
        if (audioUrl) {
            userMessage = "[ÁUDIO RECEBIDO - Transcrição pendente na v1]"
        }

        if (!userMessage) {
            return NextResponse.json({ status: 'empty-message' })
        }

        // 5. Update History
        const history = session.context_json || []
        history.push({ role: 'user', content: userMessage })

        // 6. AI Brain (GPT-4o-mini)
        const messages = [
            {
                role: "system", content: `
Você é a Clara, secretária virtual do Espaço Camille Almeida (Espaço C.A.), um estúdio especializado em unhas de gel e esmaltação em gel.
Seu objetivo é agendar serviços, tirar dúvidas sobre preços e informar o protocolo de atendimento.
Hoje é ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

REGRAS DE COMPORTAMENTO:
1. Seja sempre simpática, acolhedora e profissional. Nunca use menus numerados.
2. Se o cliente perguntar sobre horários disponíveis, USE a ferramenta 'check_calendar'.
3. Se o cliente ESCOLHER um horário e informar o NOME, USE 'book_appointment' para confirmar.
4. Após confirmar um agendamento, reforce o protocolo de atendimento de forma gentil.
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
                        const appointment = await bookAppointment({
                            phone: phone,
                            name: args.name,
                            service: args.service,
                            startsAt: args.startsAt
                        })
                        result = JSON.stringify({ status: "success", appointment })
                    } catch (err) {
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
