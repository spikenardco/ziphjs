/** @import {
	ApiError,
	ErrorCode,
	MessageEnvelope,
	Meta,
	SendImageInput,
	SendListInput,
	SendMessageInput,
	SendTextInput,
	ZiphOptions,
} from "../types/models.js" */

/** An unsuccessful HTTP response from Ziph. Network errors are not wrapped. */
export class ZiphError extends Error {
	/**
	 * @param {number} status
	 * @param {ApiError} error
	 * @param {Meta | null} [meta]
	 */
	constructor(status, error, meta = null) {
		super(error.message);
		this.name = "ZiphError";
		this.status = status;
		this.code = error.code;
		this.meta = meta;
	}
}

/** Server-side client for sending WhatsApp and SMS messages. */
export class ZiphClient {
	/** @type {string} */
	#apiKey;
	/** @type {URL} */
	#messageUrl;

	/** @param {ZiphOptions} options */
	constructor({ apiKey, baseUrl = "https://api.ziph.dev" }) {
		if (typeof apiKey !== "string" || !apiKey.trim()) {
			throw new TypeError("apiKey must be a non-empty string.");
		}

		this.#apiKey = apiKey;
		this.#messageUrl = new URL(`${baseUrl.replace(/\/+$/, "")}/v1/messages`);

		if (!["http:", "https:"].includes(this.#messageUrl.protocol)) {
			throw new TypeError("baseUrl must use HTTP or HTTPS.");
		}
	}

	/**
	 * Sends a WhatsApp or SMS text message. text is required.
	 * @param {SendTextInput} input
	 * @returns {Promise<MessageEnvelope>}
	 */
	sendText(input) {
		return this.sendMessage(input);
	}

	/**
	 * Sends a WhatsApp image. Use image.caption for accompanying text.
	 * @param {SendImageInput} input
	 * @returns {Promise<MessageEnvelope>}
	 */
	sendImage(input) {
		return this.sendMessage({ ...input, channel_type: "whatsapp" });
	}

	/**
	 * Sends a WhatsApp list menu. Both text and list are required.
	 * @param {SendListInput} input
	 * @returns {Promise<MessageEnvelope>}
	 */
	sendList(input) {
		return this.sendMessage({ ...input, channel_type: "whatsapp" });
	}

	/**
	 * Sends once, without automatic retries. Reuse the same key and unchanged
	 * request if retrying after a network error or an uncertain outcome.
	 * Acceptance does not confirm delivery. idempotencyKey is sent only as a header.
	 * @param {SendMessageInput} input
	 * @returns {Promise<MessageEnvelope>}
	 */
	async sendMessage({ idempotencyKey, ...request }) {
		if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
			throw new TypeError("idempotencyKey must be a non-empty string.");
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
			/** @type {unknown} */
			const body = await response.json().catch(() => null);
			if (
				!body ||
				typeof body !== "object" ||
				!("data" in body) ||
				body.data !== null ||
				!("error" in body) ||
				!body.error ||
				typeof body.error !== "object" ||
				!("code" in body.error) ||
				typeof body.error.code !== "string" ||
				!body.error.code.trim() ||
				!("message" in body.error) ||
				typeof body.error.message !== "string" ||
				!body.error.message.trim() ||
				!("meta" in body) ||
				!body.meta ||
				typeof body.meta !== "object" ||
				!("timestamp" in body.meta) ||
				typeof body.meta.timestamp !== "string" ||
				("request_id" in body.meta && typeof body.meta.request_id !== "string")
			) {
				throw new Error(`Invalid Ziph API response (HTTP ${response.status}).`);
			}
			throw new ZiphError(
				response.status,
				{
					code: /** @type {ErrorCode} */ (body.error.code),
					message: body.error.message,
				},
				/** @type {Meta} */ (body.meta),
			);
		}

		return /** @type {Promise<MessageEnvelope>} */ (response.json());
	}
}
