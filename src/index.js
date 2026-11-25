export * from "./types.js";

/**
 * @typedef {object} ZiphOptions
 * @property {string} apiKey Server-side API key. Never expose it in browser code.
 * @property {string} [baseUrl] API root without /v1. Defaults to https://api.ziph.dev.
 */

/**
 * @typedef {import('./types.js').SendMessageRequest & { idempotencyKey: string }} SendMessageInput
 * The key must be 1–255 bytes. Reuse it with the unchanged request when retrying.
 */

/** An unsuccessful HTTP response from Ziph. Network errors are not wrapped. */
export class ZiphError extends Error {
	/**
	 * @param {number} status
	 * @param {import('./types.js').ApiError | null} [error]
	 * @param {import('./types.js').Meta | null} [meta]
	 */
	constructor(status, error = null, meta = null) {
		super(error?.message ?? `Ziph request failed with HTTP ${status}.`);
		this.name = "ZiphError";
		/** @readonly */
		this.status = status;
		/** @readonly */
		this.code = error?.code ?? null;
		/** @readonly */
		this.details = error?.details ?? [];
		/** @readonly */
		this.meta = meta;
	}
}

/** Server-side client for sending WhatsApp and SMS messages. */
export class ZiphClient {
	#apiKey;
	#messageUrl;

	/** @param {ZiphOptions} options */
	constructor({ apiKey, baseUrl = "https://api.ziph.dev" }) {
		if (typeof apiKey !== "string" || !apiKey.trim()) {
			throw new TypeError("apiKey is required.");
		}

		this.#apiKey = apiKey;
		this.#messageUrl = new URL(`${baseUrl.replace(/\/+$/, "")}/v1/messages`);

		if (!["http:", "https:"].includes(this.#messageUrl.protocol)) {
			throw new TypeError("baseUrl must use HTTP or HTTPS.");
		}
	}

	/**
	 * Sends once, without automatic retries. Reuse the same key and unchanged
	 * request if retrying after a network error or an uncertain outcome.
	 * Acceptance does not confirm delivery. idempotencyKey is sent only as a header.
	 * @param {SendMessageInput} input
	 * @returns {Promise<import('./types.js').MessageEnvelope>}
	 */
	async sendMessage({ idempotencyKey, ...request }) {
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
			const body = /** @type {import('./types.js').ErrorEnvelope | null} */ (
				await response.json().catch(() => null)
			);
			throw new ZiphError(response.status, body?.error, body?.meta);
		}
		return /** @type {Promise<import('./types.js').MessageEnvelope>} */ (
			response.json()
		);
	}
}
