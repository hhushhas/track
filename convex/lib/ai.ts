import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import type { ModelMessage } from "ai";

const modelName = process.env.AI_MODEL ?? "moonshotai/kimi-k2.6";
const documentReaderModelName =
	process.env.AI_DOCUMENT_READER_MODEL ?? "google/gemini-3.1-flash-lite";

function getOpenRouter() {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		return null;
	}
	return createOpenRouter({ apiKey });
}

function compactModelText(text: string, maxLength = 1600) {
	const compacted = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
	return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 3).trim()}...` : compacted;
}

export async function generateTrackText(prompt: string | ModelMessage[]) {
	const openrouter = getOpenRouter();
	if (!openrouter) {
		return {
			model: modelName,
			text: "Track AI is not configured in this environment.",
		};
	}

	if (typeof prompt === "string") {
		const { text } = await generateText({
			model: openrouter.chat(modelName),
			prompt,
		});
		return { model: modelName, text };
	}

	const { text } = await generateText({
		model: openrouter.chat(modelName),
		messages: prompt,
	});
	return { model: modelName, text };
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
	});

	return { model: documentReaderModelName, text: compactModelText(text) };
}
