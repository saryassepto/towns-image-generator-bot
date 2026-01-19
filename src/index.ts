import { makeTownsBot } from '@towns-protocol/bot'
import commands from './commands'

const HF_DEFAULT_MODEL = 'black-forest-labs/FLUX.1-schnell' // Changed to schnell (faster, free)
const HF_API_URL = 'https://api-inference.huggingface.co/models'
const HF_API_TOKEN = process.env.HF_API_TOKEN
const HF_MODEL = process.env.HF_MODEL ?? HF_DEFAULT_MODEL

const bot = await makeTownsBot(process.env.APP_PRIVATE_DATA!, process.env.JWT_SECRET!, {
    commands,
})

type GeneratedImage = {
    data: Uint8Array
    mimeType: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const generateImage = async (prompt: string, attempt = 1): Promise<GeneratedImage> => {
    const MAX_ATTEMPTS = 5 // Increased from 2

    if (!HF_API_TOKEN) {
        throw new Error('HF_API_TOKEN is not configured')
    }

    const endpoint = `${HF_API_URL}/${encodeURIComponent(HF_MODEL)}`
    console.log(`[imagine] Requesting Hugging Face model=${HF_MODEL} attempt=${attempt}`)

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${HF_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: prompt }),
    })

    // Handle model loading (503) or other temporary errors
    if (response.status === 503 || response.status === 500) {
        const message = await response.text()
        console.warn(`[imagine] Model issue (${response.status}): ${message}`)
        
        if (attempt < MAX_ATTEMPTS) {
            const waitTime = attempt * 5000 // Progressive backoff: 5s, 10s, 15s...
            console.log(`[imagine] Retrying in ${waitTime/1000}s...`)
            await sleep(waitTime)
            return generateImage(prompt, attempt + 1)
        }
        throw new Error('Model is still loading. Please try again in a minute.')
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`Hugging Face request failed (${response.status}): ${errorText || response.statusText}`)
    }

    const mimeType = (response.headers.get('content-type') || 'image/png').split(';')[0]
    const arrayBuffer = await response.arrayBuffer()
    const data = new Uint8Array(arrayBuffer)

    if (data.length === 0) {
        throw new Error('Received empty image data from Hugging Face')
    }

    console.log(`[imagine] Image generated (${data.length} bytes, ${mimeType})`)
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

    if (!HF_API_TOKEN) {
        console.error('[imagine] Missing HF_API_TOKEN environment variable')
        await handler.sendMessage(channelId, 'Image generation is not configured. Please set HF_API_TOKEN.')
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
