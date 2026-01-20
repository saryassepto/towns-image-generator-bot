import { makeTownsBot } from '@towns-protocol/bot'
import commands from './commands'

const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const bot = await makeTownsBot(process.env.APP_PRIVATE_DATA!, process.env.JWT_SECRET!, {
    commands,
})

type GeneratedImage = {
    data: Uint8Array
    mimeType: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const generateImage = async (prompt: string, attempt = 1): Promise<GeneratedImage> => {
    const MAX_ATTEMPTS = 5 // allow more retries for cold starts

    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured')
    }

    const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`
    console.log(`[imagine] Requesting Gemini image for prompt="${prompt}" attempt=${attempt}`)

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }],
                },
            ],
            // Hints for image generation; Gemini may ignore/override depending on model defaults.
            generationConfig: {
                responseMimeType: 'application/json',
            },
        }),
    })

    // Handle model loading (503) or other temporary errors
    if (response.status === 503 || response.status === 500) {
        const message = await response.text().catch(() => '')
        console.warn(`[imagine] Gemini model issue (${response.status}): ${message}`)

        if (attempt < MAX_ATTEMPTS) {
            const waitTime = attempt * 5000 // Progressive backoff: 5s, 10s, 15s...
            console.log(`[imagine] Retrying in ${waitTime / 1000}s...`)
            await sleep(waitTime)
            return generateImage(prompt, attempt + 1)
        }
        throw new Error('Model is still loading. Please try again in a minute.')
    }

    const json = (await response.json().catch(async () => {
        const text = await response.text().catch(() => '')
        throw new Error(`Gemini response was not valid JSON. Status=${response.status}, body=${text}`)
    })) as unknown

    if (!response.ok) {
        console.error('[imagine] Gemini API error response', json)
        throw new Error(`Gemini request failed with status ${response.status}`)
    }

    const candidates = (json as any).candidates
    const parts = candidates?.[0]?.content?.parts as Array<{ inlineData?: { mimeType?: string; data?: string } }> | undefined
    const inline = parts?.find((p) => p.inlineData && typeof p.inlineData.data === 'string')?.inlineData

    if (!inline || !inline.data) {
        console.error('[imagine] Gemini response missing inline image data', json)
        throw new Error('Did not receive image data from Gemini')
    }

    const mimeType = inline.mimeType || 'image/png'
    const buffer = Buffer.from(inline.data, 'base64')
    const data = new Uint8Array(buffer)

    if (data.length === 0) {
        throw new Error('Received empty image data from Gemini')
    }

    console.log(`[imagine] Image generated via Gemini (${data.length} bytes, ${mimeType})`)
    return { data, mimeType }
}

bot.onSlashCommand('help', async (handler, { channelId }) => {
    await handler.sendMessage(
        channelId,
        '**Available Commands:**\n\n' +
            '• `/help` - Show this help message\n' +
            '• `/time` - Get the current time\n' +
            '• `/imagine <prompt>` - Generate an image (e.g., `/imagine a cozy cabin in the snow`)\n\n' +
            '**Message Triggers:**\n\n' +
            "• Mention me - I'll respond\n" +
            "• React with 👋 - I'll wave back\n" +
            '• Say "hello" - I\'ll greet you back\n' +
            '• Say "ping" - I\'ll show latency\n' +
            '• Say "react" - I\'ll add a reaction\n',
    )
})

bot.onSlashCommand('time', async (handler, { channelId }) => {
    const currentTime = new Date().toLocaleString()
    await handler.sendMessage(channelId, `Current time: ${currentTime} ⏰`)
})

bot.onSlashCommand('imagine', async (handler, { channelId, args, userId }) => {
    const prompt = args.join(' ').trim()

    if (!prompt) {
        await handler.sendMessage(channelId, 'Please provide a prompt, e.g., `/imagine a sunset over the mountains`')
        return
    }

    if (!GEMINI_API_KEY) {
        console.error('[imagine] Missing GEMINI_API_KEY environment variable')
        await handler.sendMessage(channelId, 'Image generation is not configured. Please set GEMINI_API_KEY.')
        return
    }

    const loadingMessageId = (await handler.sendMessage(
        channelId,
        `🎨 Generating an image for <@${userId}>...\nPrompt: "${prompt}"\n\n_This may take 10-30 seconds if the model is cold-starting..._`,
    )) as unknown as string | undefined

    try {
        const image = await generateImage(prompt)
        await handler.sendMessage(channelId, `✨ Here is your image, <@${userId}>:`, {
            attachments: [
                {
                    type: 'chunked',
                    data: image.data,
                    filename: `imagine-${Date.now()}.png`,
                    mimetype: image.mimeType,
                },
            ],
        })
    } catch (error) {
        console.error('[imagine] Failed to generate image', error)
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        await handler.sendMessage(
            channelId,
            `❌ Sorry, I could not generate the image: ${errorMsg}\n\n💡 Tip: If the model is loading, try again in 30-60 seconds!`,
        )
    } finally {
        if (loadingMessageId) {
            try {
                await handler.adminRemoveEvent(channelId, loadingMessageId)
            } catch (cleanupError) {
                console.warn('[imagine] Failed to remove loading message', cleanupError)
            }
        }
    }
})

bot.onMessage(async (handler, { message, channelId, eventId, createdAt }) => {
    if (message.includes('hello')) {
        await handler.sendMessage(channelId, 'Hello there! 👋')
        return
    }
    if (message.includes('ping')) {
        const now = new Date()
        await handler.sendMessage(channelId, `Pong! 🏓 ${now.getTime() - createdAt.getTime()}ms`)
        return
    }
    if (message.includes('react')) {
        await handler.sendReaction(channelId, eventId, '👍')
        return
    }
})

bot.onReaction(async (handler, { reaction, channelId }) => {
    if (reaction === '👋') {
        await handler.sendMessage(channelId, 'I saw your wave! 👋')
    }
})

const app = bot.start()
export default app
