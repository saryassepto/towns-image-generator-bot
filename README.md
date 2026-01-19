# Quickstart Bot

A simple, barebones bot example perfect for beginners learning to build Towns bots.

# Features
- **Slash commands**: Registering and handling `/commands`
- **Image generation**: `/imagine` uses Hugging Face Inference API 🎨
- **Message handling**: Detecting keywords in messages 💬
- **Sending messages**: Posting messages to channels 📢
- **Adding reactions**: Attaching emoji reactions to messages 😀
- **Reaction events**: Responding to user reactions 🔄

## Slash Commands

- `/help` - Shows available commands and message triggers
- `/imagine <prompt>` - Generates an image with Hugging Face (example: `/imagine a cozy cabin in the snow`)
- `/time` - Displays the current server time

## 🖼️ Image Generation with Hugging Face

The bot includes an AI image generation feature powered by the **Hugging Face Inference API**.

- Command: `/imagine <prompt>`
- Backend: `https://api-inference.huggingface.co/models/{model}`
- Default model: `black-forest-labs/FLUX.1-dev`
- The bot:
  - Shows a **loading message** while generating ⏳
  - Calls the Hugging Face model to create an image 🤖
  - Uploads the image as an attachment to Towns 🌐
  - Replies with the generated image in the same channel 📸

## Message Triggers

- Say "hello" - Bot greets you back
- Say "ping" - Bot responds with "Pong!" and latency
- Say "react" - Bot adds a thumbs up reaction to your message

You will need to mention the bot if you're using the `Mentions, Commands, Replies & Reactions` message behavior for your bot.

## Reaction Handling

- React with 👋 to any message - Bot responds with "I saw your wave!"

## 🔐 Getting a Hugging Face API Token

1. Go to your Hugging Face account: `https://huggingface.co`
2. Open **Settings** → **Access Tokens**: `https://huggingface.co/settings/tokens`
3. Click **New token**:
   - Name: e.g. `towns-image-bot`
   - Role: at least **read** / Inference API access
4. Copy the token and set it in your `.env` (or `env.example` template):

```bash
HF_API_TOKEN=hf_your_token_here
```

> 💡 Treat this token like a password. Never commit your real token to Git.

## 🧩 Supported Image Models

You can control which Hugging Face model is used via the `HF_MODEL` environment variable.

Examples:

- `black-forest-labs/FLUX.1-dev` (default)
- `black-forest-labs/FLUX.1-schnell`
- `stabilityai/stable-diffusion-2-1`
- `runwayml/stable-diffusion-v1-5`

Set the model in your environment:

```bash
HF_MODEL=black-forest-labs/FLUX.1-dev
```

> ⚠️ Make sure the model you choose supports image generation via the Inference API.

# Setup

1. Copy `.env.sample` to `.env` and fill in your credentials:

   ```bash
   cp .env.sample .env
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Run the bot:
   ```bash
   bun run dev
   ```

# Environment Variables

Required variables in `.env`:

- `APP_PRIVATE_DATA` - Your Towns app private data (base64 encoded)
- `JWT_SECRET` - JWT secret for webhook authentication
- `PORT` - Port to run the bot on (optional, defaults to 5123)
- `HF_API_TOKEN` - Hugging Face Inference API token (required for `/imagine`)
- `HF_MODEL` - Hugging Face model to use (optional, defaults to `black-forest-labs/FLUX.1-dev`)

# Usage

Once the bot is running, installed to a space and added to a channel:

**Try the slash commands:**

- `/help` - See all available features
- `/imagine a cozy cabin in the snow` - Generate an image from a prompt
- `/time` - Get the current time

**Try the message triggers:**

- Type "hello" anywhere in your message
- Type "ping" to check bot latency
- Type "react" to get a reaction

**Try reactions:**

- Add a 👋 reaction to any message

## 🧪 Example `/imagine` Usage

- `/imagine a futuristic city skyline at sunset`
- `/imagine a cat wearing a spacesuit on the moon`
- `/imagine a watercolor painting of a forest in autumn`

Tips:

- Be **specific**: style, lighting, colors, medium (e.g. "oil painting", "pixel art").
- Avoid unsafe or disallowed content to prevent API errors.

# Code Structure

The bot consists of two main files:

## `src/commands.ts`

Defines the slash commands available to users. Commands registered here appear in the slash command menu.

## `src/index.ts`

Main bot logic with:

1. **Bot initialization** (`makeTownsBot`) - Creates bot instance with credentials and commands
2. **Slash command handlers** (`onSlashCommand`) - Handle `/help`, `/imagine`, and `/time` commands
3. **Message handler** (`onMessage`) - Respond to message keywords (hello, ping, react)
4. **Reaction handler** (`onReaction`) - Respond to emoji reactions (👋)
5. **Bot server setup** (`bot.start()`) - Starts the bot server with a Hono HTTP server

## 🛠️ Troubleshooting Image Generation

- **Bot says HF_API_TOKEN is not configured**
  - Make sure `HF_API_TOKEN` is set in your `.env` and that the process has been restarted.
  - Confirm there are no extra quotes around the token.

- **Bot replies: "Model is still loading. Please try again soon."**
  - Hugging Face is warming up the model (common on first request).
  - Wait a few seconds and try the `/imagine` command again.

- **Bot replies: "Sorry, I could not generate the image right now."**
  - The Hugging Face API returned an error or empty image:
    - Check your server logs for detailed error messages.
    - Verify your HF token is valid and not rate-limited.
    - Confirm `HF_MODEL` is a valid image-generation model.

- **Images are not appearing in Towns**
  - Ensure the bot has permission to send messages and attachments in the channel.
  - Check that your Towns bot credentials (`APP_PRIVATE_DATA`, `JWT_SECRET`) are correct.
  - Review logs for any attachment/handler errors.

## Extending this Bot

To add your own features:

1. **Add a slash command:**
   - Add to `src/commands.ts`
   - Go to `src/index.ts` and create a handler with `bot.onSlashCommand('yourcommand', async (handler, event) => { ... })`

2. **Add message triggers:**
   - Add conditions in the `bot.onMessage()` handler

3. **Handle more events:**
   - Use `bot.onReaction()`, `bot.onMessageEdit()`, `bot.onChannelJoin()`, etc.
