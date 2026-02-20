import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { findAvailableSlots } from '@/lib/calendar'

// 1. Validate Z-API Token
function validateToken(request) {
    const securityToken = request.headers.get('client-token')
    return securityToken === process.env.ZAPI_SECURITY_TOKEN
}

// 2. Main Webhook Handler
export async function POST(request) {
    try {
        // Security Check
        // if (!validateToken(request)) {
        //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        // }

        const body = await request.json()

        // Z-API sends many events. We only care about: 'on-message-received'
        // but the structure varies. Let's assume standard structure.
        console.log('Webhook received:', JSON.stringify(body, null, 2))

        // Validations: Ignore groups, ignore self
        const isGroup = body.isGroup
        const fromMe = body.fromMe
        if (isGroup || fromMe) {
            return NextResponse.json({ status: 'ignored' })
        }

        const phone = body.phone
        const text = body.message?.text?.message || '' // Adjust based on Z-API payload
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
            // TODO: Whisper Transcription
            // const transcription = await transcribeAudio(audioUrl)
            // userMessage = transcription
            userMessage = "[ÁUDIO RECEBIDO - Transcrição pendente na v1]"
        }

        if (!userMessage) {
            return NextResponse.json({ status: 'empty-message' })
        }

        // 5. Update History
        const history = session.context_json || []
        history.push({ role: 'user', content: userMessage })

        // 6. AI Brain (GPT-4o-mini)
        // We provide tools to the LLM so it can "look" at the calendar
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system", content: `
          Você é a Clara, secretária virtual do Espaço C.A.
          Seu objetivo é agendar serviços de manicure/estética.
          
          Regras:
          1. Seja simpática e humana. Nada de menus (Digite 1).
          2. Se o cliente pedir horário, USE a ferramenta 'check_calendar'.
          3. Se o cliente confirmar um horário, USE 'book_appointment'.
          4. Se não souber, pergunte.
          
          Serviços: Fibra, Gel, Manutenção.
        `},
                ...history
            ],
            tools: [
                {
                    type: "function",
                    function: {
                        name: "check_calendar",
                        description: "Verifica horários livres na agenda.",
                        parameters: {
                            type: "object",
                            properties: {
                                date: { type: "string", description: "Data no formato YYYY-MM-DD. Se for hoje/amanhã, converta." }
                            }
                        }
                    }
                }
            ]
        })

        const aiMsg = completion.choices[0].message
        let responseText = aiMsg.content

        // 7. Handle Tool Calls
        if (aiMsg.tool_calls) {
            for (const toolCall of aiMsg.tool_calls) {
                if (toolCall.function.name === 'check_calendar') {
                    const args = JSON.parse(toolCall.function.arguments)
                    // Call our lib
                    const slots = await findAvailableSlots({ requestedDate: args.date, appointments: [], blocks: [] })
                    // Note: appointments/blocks should be fetched from DB real-time here.
                    // For MVP, we simulated empty arrays in findAvailableSlots call, but valid implementation needs DB fetch.

                    // Feed back to AI
                    const functionResult = {
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(slots)
                    }

                    // Second call to generate text based on slots
                    const verification = await openai.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: [...history, aiMsg, functionResult]
                    })
                    responseText = verification.choices[0].message.content
                }
            }
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
