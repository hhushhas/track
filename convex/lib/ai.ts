import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, generateText } from "ai";
import type { ModelMessage } from "ai";

const modelName = process.env.AI_MODEL ?? "openai/gpt-5.6-luna";
const documentReaderModelName =
	process.env.AI_DOCUMENT_READER_MODEL ?? "google/gemini-3.1-flash-lite";
const openRouterAppUrl = process.env.OPENROUTER_APP_URL ?? process.env.SITE_URL ?? "https://track.q9labs.ai";
const openRouterAppTitle = process.env.OPENROUTER_APP_TITLE ?? "Track";
const openRouterAppCategories = process.env.OPENROUTER_APP_CATEGORIES ?? "general-chat";

function getOpenRouterAttributionHeaders() {
	return {
		"HTTP-Referer": openRouterAppUrl,
		"X-OpenRouter-Categories": openRouterAppCategories,
		"X-OpenRouter-Title": openRouterAppTitle,
	};
}

function getOpenRouter() {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		return null;
	}
	return createOpenRouter({
		apiKey,
		headers: getOpenRouterAttributionHeaders(),
	});
}

function getOpenRouterApiKey() {
	return process.env.OPENROUTER_API_KEY ?? null;
}

function compactModelText(text: string, maxLength = 1600) {
	const compacted = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
	return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3).trim()}...` : compacted;
}

function normalizeProviderError(error: unknown, model: string): never {
	if (APICallError.isInstance(error)) {
		const message = error.message ? ` message=${compactModelText(error.message, 300)}` : "";
		const status = error.statusCode ? ` status=${error.statusCode}` : "";
		const body = error.responseBody ? ` body=${compactModelText(error.responseBody, 500)}` : "";
		const cause = error.cause ? ` cause=${compactModelText(JSON.stringify(error.cause), 500)}` : "";
		throw new Error(`Provider returned error for ${model}.${status}${message}${body}${cause}`);
	}
	throw error;
}

async function generateOpenRouterText(prompt: string) {
	const apiKey = getOpenRouterApiKey();
	if (!apiKey) {
		return {
			model: modelName,
			text: "Track AI is not configured in this environment.",
		};
	}

	const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			...getOpenRouterAttributionHeaders(),
		},
		body: JSON.stringify({
			messages: [{ role: "user", content: prompt }],
			model: modelName,
			reasoning: { effort: "high" },
		}),
	});
	const rawBody = await response.text();
	let body: {
		choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
		error?: { message?: string; code?: string | number };
		model?: string;
	} | null = null;
	try {
		body = rawBody ? JSON.parse(rawBody) : null;
	} catch {
		throw new Error(`Provider returned non-JSON response for ${modelName}. status=${response.status} body=${compactModelText(rawBody, 500)}`);
	}
	if (!response.ok || body?.error) {
		const providerError = body?.error
			? JSON.stringify(body.error)
			: compactModelText(rawBody, 500);
		throw new Error(`Provider returned error for ${modelName}. status=${response.status} body=${compactModelText(providerError, 500)}`);
	}
	const text = body?.choices?.[0]?.message?.content;
	if (!text) {
		throw new Error(`Provider returned no text for ${modelName}. status=${response.status} body=${compactModelText(rawBody, 500)}`);
	}
	return { model: body?.model ?? modelName, text };
}

export async function generateTrackText(prompt: string | ModelMessage[]) {
	const openrouter = getOpenRouter();
	if (!openrouter) {
		return {
			model: modelName,
			text: "Track AI is not configured in this environment.",
		};
	}

	try {
		if (typeof prompt === "string") {
			return await generateOpenRouterText(prompt);
		}

		const { text } = await generateText({
			model: openrouter.chat(modelName),
			messages: prompt,
			providerOptions: {
				openrouter: {
					reasoning: { effort: "high" },
				},
			},
		});
		return { model: modelName, text };
	} catch (error) {
		normalizeProviderError(error, modelName);
	}
}

export async function generateTrackDocumentNotes(input: {
	context: string;
	data: Uint8Array;
	filename: string;
	mediaType: string;
	question: string;
}) {
	const openrouter = getOpenRouter();
	if (!openrouter) {
		return {
			model: documentReaderModelName,
			text: `${input.filename}: could not read because Track AI is not configured.`,
		};
	}

	const prompt = [
		"You are Track's document reader.",
		"Read the attached file only for evidence relevant to the user's question and nearby conversation context.",
		"Do not write the final assistant answer.",
		"Return compact plain text only: 1-5 short lines, no JSON, no table, no headings.",
		"Start with the filename, then say relevant, not relevant, or could not read.",
		"Include short page/section/location clues and brief quotes when available.",
		"If the file is not useful for the question, say not relevant and stop.",
		"If something is missing or unclear, say missing or unclear in one short phrase.",
		"",
		`User question: ${input.question}`,
		"",
		`Conversation context:\n${input.context}`,
	].join("\n");

	try {
		const { text } = await generateText({
			model: openrouter.chat(documentReaderModelName),
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: prompt },
						{
							type: "file",
							data: input.data,
							filename: input.filename,
							mediaType: input.mediaType,
						},
					],
				},
			],
			providerOptions: {
				openrouter: {
					reasoning: { effort: "high" },
				},
			},
		});

		return { model: documentReaderModelName, text: compactModelText(text) };
	} catch (error) {
		normalizeProviderError(error, documentReaderModelName);
	}
}
