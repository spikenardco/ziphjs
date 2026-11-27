// biome-ignore-all lint/correctness/noUnusedPrivateClassMembers: The declaration preserves the runtime class's private-field identity.
import type {
	ApiError,
	ErrorCode,
	MessageEnvelope,
	Meta,
	SendImageInput,
	SendListInput,
	SendMessageInput,
	SendTextInput,
	ZiphOptions,
} from "./models.js";

export type * from "./models.js";

/** An unsuccessful HTTP response from Ziph. Network errors are not wrapped. */
export declare class ZiphError extends Error {
	status: number;
	code: ErrorCode;
	meta: Meta | null;
	constructor(status: number, error: ApiError, meta?: Meta | null);
}

/** Server-side client for sending WhatsApp and SMS messages. */
export declare class ZiphClient {
	#private;
	constructor(options: ZiphOptions);
	/** Sends a WhatsApp or SMS text message. text is required. */
	sendText(input: SendTextInput): Promise<MessageEnvelope>;
	/** Sends a WhatsApp image. Use image.caption for accompanying text. */
	sendImage(input: SendImageInput): Promise<MessageEnvelope>;
	/** Sends a WhatsApp list menu. Both text and list are required. */
	sendList(input: SendListInput): Promise<MessageEnvelope>;
	/**
	 * Sends once, without automatic retries. Reuse the same key and unchanged
	 * request if retrying after a network error or an uncertain outcome.
	 * Acceptance does not confirm delivery. idempotencyKey is sent only as a header.
	 */
	sendMessage(input: SendMessageInput): Promise<MessageEnvelope>;
}
