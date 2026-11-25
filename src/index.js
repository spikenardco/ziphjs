/** An unsuccessful HTTP response from Ziph. Network errors are not wrapped. */
export class ZiphError extends Error {
	/**
	 * @param {number} status
	 * @param {import('./index.d.ts').ApiError | null} [error]
	 * @param {import('./index.d.ts').Meta | null} [meta]
	 */
	constructor(status, error = null, meta = null) {
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
	#apiKey;
	#messageUrl;

	/** @param {import('./index.d.ts').ZiphOptions} options */
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
	 * @param {import('./index.d.ts').SendMessageInput} input
	 * @returns {Promise<import('./index.d.ts').MessageEnvelope>}
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
			const body = await response.json().catch(() => null);
			throw new ZiphError(response.status, body?.error, body?.meta);
		}
		return response.json();
	}
}
