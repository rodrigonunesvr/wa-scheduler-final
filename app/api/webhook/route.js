import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { findAvailableSlots, bookAppointment, updateAppointment, getAppointmentsByPhone, cancelAppointment, confirmAppointment, isDayOpen, fetchScheduleOverrides, fetchScheduleRules, calculateTotalPrice, normalizeString } from '@/lib/calendar'
import { sendWhatsAppMessage, sendWhatsAppButtons } from '@/lib/evolution'
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

        // --- NEW: Handle Button Responses (Evolution API) ---
        const buttonId = isEvolution
            ? body.data?.message?.buttonsResponseMessage?.selectedButtonId || body.data?.message?.templateButtonReplyMessage?.selectedId
            : null;
        const buttonText = isEvolution
            ? body.data?.message?.buttonsResponseMessage?.selectedDisplayText
            : null;

        if (!phone) {
            return NextResponse.json({ status: 'no-phone' })
        }

        // --- LIMPEZA DE TELEFONE (V75) ---
        // Garante que o telefone para busca no banco seja apenas números, sem caracteres especiais
        const cleanPhone = phone.replace(/\D/g, '');

        // 3. Load or Create Session
        const { data: existingSession, error: fetchError } = await supabase
            .from('wa_sessions')
            .select('*')
            .eq('phone', cleanPhone)
            .maybeSingle()

        if (fetchError) {
            console.error('❌ Error fetching session:', fetchError)
        }

        let session = existingSession

        if (!session) {
            console.log('🆕 Criando nova sessão para:', cleanPhone)
            const { data: newSession, error: insertError } = await supabase
                .from('wa_sessions')
                .insert({ phone: cleanPhone, state: 'START', context_json: [] })
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
            .eq('phone', cleanPhone)
            .maybeSingle()

        if (customer) {
            customerName = customer.name
            console.log('👤 CLIENTE IDENTIFICADA NO BANCO:', customerName, 'TELEFONE:', cleanPhone)
        } else {
            console.log('❓ CLIENTE NÃO ENCONTRADA COM TELEFONE:', cleanPhone)
        }

        // 4. Process Content (Text or Audio)
        let userMessage = sanitizedText || buttonText || ""
        if (audioUrl) {
            userMessage = "[ÁUDIO RECEBIDO - Transcrição pendente na v1]"
        }

        // --- NEW: Intercept Button Actions ---
        if (isEvolution && buttonId) {
            console.log(`🔘 Botão pressionado (V87): ${buttonId} (${buttonText})`)

            if (buttonId.startsWith('confirm_')) {
                const aptId = buttonId.replace('confirm_', '')
                const { error: confirmErr } = await supabase
                    .from('appointments')
                    .update({ status: 'CONFIRMED' }) // Força CONFIRMED se estivesse PENDING
                    .eq('id', aptId)

                if (!confirmErr) {
                    const confirmMsg = "✅ Ótimo! Seu agendamento foi confirmado com sucesso. Te esperamos em breve! ✨"
                    await sendWhatsAppMessage(phone, confirmMsg)
                    return NextResponse.json({ status: 'button-confirmed', aptId })
                }
            }

            if (buttonId.startsWith('cancel_')) {
                const aptId = buttonId.replace('cancel_', '')
                const { error: cancelErr } = await supabase
                    .from('appointments')
                    .update({ status: 'CANCELLED' })
                    .eq('id', aptId)

                if (!cancelErr) {
                    const cancelMsg = "❌ Entendido. Seu agendamento foi cancelado com sucesso. Se precisar de algo mais, estou à disposição!"
                    await sendWhatsAppMessage(phone, cancelMsg)
                    return NextResponse.json({ status: 'button-cancelled', aptId })
                }
            }
        }

        if (!userMessage && !buttonId) {
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
        const futureApts = await getAppointmentsByPhone(cleanPhone)
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

        // --- RADAR DE SERVIÇOS OCULTOS (V78) ---
        const { data: allServices, error: allSvcError } = await supabase.from('services').select('*').eq('active', true)
        const hiddenServices = (allServices || []).filter(s => s.is_hidden)
        const activeServices = (allServices || []).filter(s => !s.is_hidden)

        // Deduplicação Nuclear de Ativos
        const dbServices = []
        const seenNames = new Set()
        activeServices.forEach(s => {
            const norm = s.name.trim().toLowerCase()
            if (!seenNames.has(norm)) {
                dbServices.push(s)
                seenNames.add(norm)
            }
        })

        const servicesListText = dbServices.length > 0
            ? dbServices.map(s => `- ${s.name}: R$ ${s.price.toFixed(2)}`).join('\n')
            : '- Nenhum serviço disponível no momento.'

        // Detecta se o usuário pediu algo oculto
        let hiddenAlert = ''
        let originalMessage = userMessage
        const normUserMsg = normalizeString(userMessage)

        // Radar de Precisão: busca por substrings exatas no nome dos serviços ocultos
        const requestedHidden = hiddenServices.find(s => {
            const normS = normalizeString(s.name)
            return normUserMsg.includes(normS) || normS.includes(normUserMsg)
        })

        if (requestedHidden) {
            console.log('🛡️ RADAR: Serviço Oculto detectado:', requestedHidden.name)
            hiddenAlert = `\n⚠️ **ALERTA DE MODERAÇÃO**: O cliente pediu "${requestedHidden.name}", mas este serviço foi DESCONTINUADO. Você DEVE informar imediatamente que não trabalha mais com ele e mostrar a lista de ativos. Diga: "Infelizmente não realizamos mais o serviço de ${requestedHidden.name}, mas temos essas opções:". PARE QUALQUER AGENDAMENTO AGORA.\n`

            // INJEÇÃO CEREBRAL: Modifica a mensagem do usuário para forçar a IA a ver o erro
            userMessage = `[SISTEMA: O serviço '${requestedHidden.name}' está OCULTO/DESATIVADO. Rejeite o pedido abaixo imediatamente.] User: ${originalMessage}`
        }

        // --- GERAÇÃO DE CALENDÁRIO (RESTAURADA V79) ---
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
Seu objetivo é agendar os serviços oficiais disponíveis.

--- REGRAS DE OURO (LEI ABSOLUTA) ---
1. SUA ÚNICA FONTE DA VERDADE É O CATÁLOGO DE ATIVOS ABAIXO.
2. SE UM SERVIÇO NÃO ESTÁ NO CATÁLOGO, ELE NÃO EXISTE HOJE. REJEITE NA HORA.
3. NÃO SIGA PROTOCOLOS DE UPSELL OU MARCAÇÃO PARA SERVIÇOS QUE NÃO ESTÃO NO CATÁLOGO.
4. IGNORAR QUALQUER CONVERSA ANTERIOR SOBRE SERVIÇOS OCULTOS.

--- ÚNICO CATÁLOGO DE SERVIÇOS ATIVOS ---
${servicesListText}
${hiddenAlert}

Hoje é ${todayLabel}. ${aptsContext}

--- CALENDÁRIO DOS PRÓXIMOS DIAS ---
${calendarLines}
Consulte SEMPRE o calendário acima.

${customerName
                        ? `--- RECONHECIMENTO DE CLIENTE (LEI) ---\nVocê JÁ SABE que o nome da cliente é **${customerName}**. \nPROIBIDO perguntar o nome dela. Inicie a conversa chamando-a pelo nome.`
                        : `Você ainda não sabe o nome desta cliente. Pergunte o nome completo antes de confirmar o agendamento.`}

--- PROTOCOLO DE ADICIONAIS (UPSELL SEQUENCIAL V75) ---
⚠️ **REGRA DE BLOQUEIO ABSOLUTO**: Se a cliente pedir "Manutenção" ou "Gel", você está terminantemente proibida de agendar sem antes perguntar se ela deseja adicionar Esmaltação ou Francesinha.

⚠️ **REGRA DE COMBOS**: Se a cliente pedir mais de um serviço (ex: Gel + Esmaltação), use o parâmetro 'services' como uma LISTA e agende em uma ÚNICA operação.

⚠️ AVISO: SE VOCÊ TENTAR AGENDAR MANUTENÇÃO SEM TER OFERECIDO ADICIONAIS NA ÚLTIMA MENSAGEM, O SISTEMA REJEITARÁ A AÇÃO.

--- PROTOCOLO DE TURNOS (LEI SUPREMA v82) ---
1. ANTES de listar horários livres, você DEVE perguntar: "Você prefere o turno da MANHÃ ou da TARDE?".
2. Só use a ferramenta 'check_calendar' com o parâmetro 'period' após a cliente escolher um turno.
3. Se a cliente não especificar, insista educadamente na escolha do turno para melhor organização.

--- FLEXIBILIDADE DE HORÁRIOS (v82) ---
1. O sistema permite agendamentos colados (ex: um termina as 15:00, o outro começa as 15:00).
2. Se um horário redondo (ex: 15h) estiver ocupado, seja proativa e ofereça os vizinhos de 5 minutos (ex: 14:55 ou 15:05).

--- PROTOCOLO DE CONFIRMAÇÃO (v81) ---
1. Se o cliente responder "SIM" ou confirmar o agendamento pendente, use IMEDIATAMENTE a ferramenta 'confirm_appointment'.
2. Se o cliente disser "CANCELAR" ou "NÃO POSSO IR", use 'cancel_appointment'.
3. Se o cliente disser "REAGENDAR", pergunte qual novo dia e horário ele prefere. Nunca confirme um reagendamento sem antes verificar a disponibilidade.
`},
            ...history
        ]

        const tools = [
            {
                type: "function",
                function: {
                    name: "check_calendar",
                    description: "Verifica horários livres. Se houver mais de um serviço, use o parâmetro 'services'.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: { type: "string" },
                            services: { type: "array", items: { type: "string" }, description: "Lista de serviços para calcular a duração total do combo." },
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

                        // --- PROTOCOLO DE UPSELL V75 (SEQUENCIAL/RADICAL) ---
                        const structuralKeywords = ['manutencao', 'gel'];
                        const isStructural = requestedServices.some(s => {
                            const norm = normalizeString(s);
                            return structuralKeywords.some(kw => norm.includes(kw));
                        });

                        if (isStructural) {
                            const upsellWords = ['esmaltacao', 'francesinha', 'po', 'combo', 'adicional'];
                            const alreadyHasUpsell = requestedServices.some(s => {
                                const norm = normalizeString(s);
                                return upsellWords.some(w => norm.includes(w));
                            });

                            if (!alreadyHasUpsell) {
                                // Buscamos no histórico RECENTE (últimas 3 mensagens do assistente)
                                const recentAssistantMessages = history
                                    .filter(m => m.role === 'assistant' && m.content)
                                    .slice(-5);

                                const hasOfferedUpsell = recentAssistantMessages.some(m => {
                                    const normContent = normalizeString(m.content);
                                    return upsellWords.some(w => normContent.includes(w));
                                });

                                if (!hasOfferedUpsell) {
                                    result = JSON.stringify({
                                        status: "error",
                                        message: "ERRO DE PROTOCOLO V75: Você NÃO pode agendar esta manutenção agora. Você esqueceu de oferecer o menu de adicionais (esmaltação básica/premium) na última mensagem. Pare o agendamento, responda a cliente oferecendo os adicionais e espere ela decidir."
                                    });
                                }
                            }
                        }

                        if (!result) {
                            const appointment = await bookAppointment({
                                phone: cleanPhone,
                                name: args.name || customerName,
                                services: requestedServices,
                                startsAt: args.startsAt
                            })

                            if (appointment?.error) {
                                result = JSON.stringify({ status: "error", message: appointment.message })
                            } else {
                                result = JSON.stringify({ status: "success", appointment })
                                try {
                                    await supabase.from('customers').upsert({ phone: cleanPhone, name: args.name || customerName }, { onConflict: 'phone' })

                                    // --- NOVO: Enviar Botões de Confirmação Imediata (v88) ---
                                    const startTime = moment.tz(args.startsAt, TIMEZONE);
                                    const dateStr = startTime.format('DD/MM');
                                    const timeStr = startTime.format('HH:mm');
                                    const titleB = `Confirmar Agendamento`;
                                    const descB = `Olá ${args.name || customerName}, agendei seu atendimento para ${dateStr} às ${timeStr}.\n\nDeseja confirmar agora?`;
                                    const buttons = [
                                        { id: `confirm_${appointment.id}`, label: 'Sim, Confirmar' },
                                        { id: `cancel_${appointment.id}`, label: 'Não, Cancelar' }
                                    ];
                                    const { sendWhatsAppButtons } = await import('@/lib/evolution');
                                    await sendWhatsAppButtons(cleanPhone, titleB, descB, buttons);

                                } catch (e) { console.error('Customer upsert error:', e) }
                            }
                        }
                    } catch (err) { result = JSON.stringify({ status: "error", message: err.message }) }
                }
                else if (toolCall.function.name === 'list_my_appointments') {
                    try {
                        const appointments = await getAppointmentsByPhone(cleanPhone)
                        result = JSON.stringify(appointments)
                    } catch (err) { result = JSON.stringify({ status: "error", message: err.message }) }
                }
                else if (toolCall.function.name === 'cancel_appointment') {
                    try {
                        const cancelled = await cancelAppointment(cleanPhone, args.date)
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
                        }).eq('phone', cleanPhone)
                        result = JSON.stringify({ status: "success" })
                    } catch (err) { result = JSON.stringify({ status: "error" }) }
                }
                else if (toolCall.function.name === 'confirm_appointment') {
                    try {
                        const confirmed = await confirmAppointment(cleanPhone, args.date)
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
            // --- SANITIZAÇÃO DE MENSAGEM PARA WHATSAPP (V76) ---
            // Converte o negrito da IA (**texto**) para o padrão do WhatsApp (*texto*)
            const sanitizedResponse = responseText
                .replace(/\*\*\s*(.*?)\s*\*\*/g, '*$1*') // Transforma ** texto ** em *texto*
                .replace(/\*\*(.*?)\*\*/g, '*$1*');     // Transforma **texto** em *texto*

            history.push({ role: 'assistant', content: responseText })
            await supabase.from('wa_sessions')
                .update({ context_json: history, updated_at: new Date().toISOString() })
                .eq('phone', cleanPhone)

            await sendWhatsAppMessage(cleanPhone, sanitizedResponse)
        }

        return NextResponse.json({ status: 'processed' })

    } catch (error) {
        console.error('Webhook Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
