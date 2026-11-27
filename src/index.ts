import type {
	ApiError,
	ErrorCode,
	ErrorEnvelope,
	FieldError,
	MessageEnvelope,
	Meta,
	SendImageInput,
	SendListInput,
	SendMessageInput,
	SendTextInput,
	ZiphOptions,
} from "./types.js";

export type * from "./types.js";

/** An unsuccessful HTTP response from Ziph. Network errors are not wrapped. */
export class ZiphError extends Error {
	declare status: number;
	declare code: ErrorCode | null;
	declare details: FieldError[];
	declare meta: Meta | null;

	constructor(
		status: number,
		error: ApiError | null = null,
		meta: Meta | null = null,
	) {
		super(error?.message ?? `Ziph request failed with HTTP ${status}.`);
		this.name = "ZiphError";
		this.status = status;
		this.code = error?.code ?? null;
		this.details = error?.details ?? [];
		this.meta = meta;
	}
}

/** Server-side client for sending WhatsApp and SMS messages. */
export class ZiphClient {
	#apiKey: string;
	#messageUrl: URL;

	constructor({ apiKey, baseUrl = "https://api.ziph.dev" }: ZiphOptions) {
		this.#apiKey = apiKey;
		this.#messageUrl = new URL(`${baseUrl.replace(/\/+$/, "")}/v1/messages`);

		if (!["http:", "https:"].includes(this.#messageUrl.protocol)) {
			throw new TypeError("baseUrl must use HTTP or HTTPS.");
		}
	}

	/** Sends a WhatsApp or SMS text message. text is required. */
	sendText(input: SendTextInput): Promise<MessageEnvelope> {
		return this.sendMessage(input);
	}

	/** Sends a WhatsApp image. Use image.caption for accompanying text. */
	sendImage(input: SendImageInput): Promise<MessageEnvelope> {
		return this.sendMessage({ ...input, channel_type: "whatsapp" });
	}

	/** Sends a WhatsApp list menu. Both text and list are required. */
	sendList(input: SendListInput): Promise<MessageEnvelope> {
		return this.sendMessage({ ...input, channel_type: "whatsapp" });
	}

	/**
	 * Sends once, without automatic retries. Reuse the same key and unchanged
	 * request if retrying after a network error or an uncertain outcome.
	 * Acceptance does not confirm delivery. idempotencyKey is sent only as a header.
	 */
	async sendMessage({
		idempotencyKey,
		...request
	}: SendMessageInput): Promise<MessageEnvelope> {
		if (
			typeof idempotencyKey !== "string" ||
			!idempotencyKey.trim() ||
			Buffer.byteLength(idempotencyKey) > 255
		) {
			throw new TypeError("idempotencyKey must be between 1 and 255 bytes.");
		}

		const response = await fetch(this.#messageUrl, {
			method: "POST",
			redirect: "error",
			headers: {
				Authorization: `Bearer ${this.#apiKey}`,
				"Content-Type": "application/json",
				"Idempotency-Key": idempotencyKey,
			},
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			// Proxies may return HTML or empty bodies instead of an API envelope.
			const body = (await response
				.json()
				.catch(() => null)) as ErrorEnvelope | null;
			throw new ZiphError(response.status, body?.error, body?.meta);
		}

		return response.json() as Promise<MessageEnvelope>;
	}
}
