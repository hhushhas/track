import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { generateText } from 'ai'

const modelName = 'anthropic/claude-sonnet-4.6'

export async function generateTrackText(prompt: string) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return {
      model: modelName,
      text: 'Track AI is not configured in this environment.',
    }
  }

  const openrouter = createOpenRouter({ apiKey })
  const { text } = await generateText({
    model: openrouter.chat(modelName),
    prompt,
  })

  return { model: modelName, text }
}
