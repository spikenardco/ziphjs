/**
 * Public types for the Ziph API,
 *
 * Wire fields keep the API's snake_case names.
 */

export type ChannelType = "whatsapp" | "sms";

export type MessageStatus =
	| "processing"
	| "accepted"
	| "delivered"
	| "read"
	| "failed"
	| "unknown";

/** Reply action. Required values must be nonblank and contain no control characters. */
export interface ReplyAction {
	/** Defaults to reply when omitted. */
	type?: "reply";
	/** Caller-supplied, case-sensitive, unique per message, 1–128 UTF-8 bytes. */
	id: string;
	/** 1–25 characters. */
	label: string;
	url?: never;
	code?: never;
	phone_number?: never;
}

export interface UrlAction {
	type: "url";
	/** Nonblank, 1–25 characters, without control characters. */
	label: string;
	/** Absolute http(s) URL. */
	url: string;
	id?: never;
	code?: never;
	phone_number?: never;
}

export interface CopyAction {
	type: "copy";
	/** Nonblank, 1–25 characters, without control characters. */
	label: string;
	/** Nonblank text without control characters. */
	code: string;
	id?: never;
	url?: never;
	phone_number?: never;
}

export interface CallAction {
	type: "call";
	/** Nonblank, 1–25 characters, without control characters. */
	label: string;
	/** International +digits format, up to 15 digits, e.g. +23276123456. */
	phone_number: string;
	id?: never;
	url?: never;
	code?: never;
}

export type MessageAction = ReplyAction | UrlAction | CopyAction | CallAction;

/** 1–3 actions, WhatsApp text or image only. Omit when unused; never null or empty. */
export type MessageActions =
	| [MessageAction]
	| [MessageAction, MessageAction]
	| [MessageAction, MessageAction, MessageAction];

/** WhatsApp image: JPEG or PNG, up to 5 MiB, publicly accessible without redirects. */
export interface MessageImage {
	url: string;
	/** Up to 4096 bytes. Use this instead of text when sending an image. */
	caption?: string;
}

/** Menu values must be nonblank and contain no control characters. */
export interface MenuOption {
	/** Caller-supplied, case-sensitive, unique across the menu, 1–128 UTF-8 bytes. */
	id: string;
	/** 1–24 characters. */
	label: string;
	/** Up to 72 characters. */
	description?: string;
}

export interface MenuGroup {
	/** Nonblank, 1–24 characters, without control characters. */
	label: string;
	options: [MenuOption, ...MenuOption[]];
}

/**
 * Single-select WhatsApp text menu. Exactly one of options or groups; 1–10 options
 * total across all groups. Flat options have no generated heading. Omit when unused.
 */
export type MessageMenu =
	| {
			/** Nonblank opener, 1–20 characters, without control characters. */
			label: string;
			options: [MenuOption, ...MenuOption[]];
			groups?: never;
	  }
	| {
			/** Nonblank opener, 1–20 characters, without control characters. */
			label: string;
			groups: [MenuGroup, ...MenuGroup[]];
			options?: never;
	  };

/** SMS is text only. */
export interface SmsMessage {
	channel_type: "sms";
	/** Recipient in international format, e.g. +23276123456. */
	to: string;
	channel_id?: never;
	/** 1–4096 bytes. */
	text: string;
	actions?: never;
	image?: never;
	menu?: never;
}

export interface WhatsAppTextMessage {
	channel_type: "whatsapp";
	/** Recipient in international format, e.g. +23276123456. */
	to: string;
	/** Uses the default channel when omitted or null. */
	channel_id?: string | null;
	/** 1–4096 UTF-8 bytes. Must include non-whitespace text when adding actions. */
	text: string;
	actions?: MessageActions;
	image?: never;
	menu?: never;
}

export interface WhatsAppImageMessage {
	channel_type: "whatsapp";
	/** Recipient in international format, e.g. +23276123456. */
	to: string;
	/** Uses the default channel when omitted or null. */
	channel_id?: string | null;
	/** Omit, or pass an empty string, and use image.caption instead. */
	text?: "";
	actions?: MessageActions;
	image: MessageImage;
	menu?: never;
}

export interface WhatsAppMenuMessage {
	channel_type: "whatsapp";
	/** Recipient in international format, e.g. +23276123456. */
	to: string;
	/** Uses the default channel when omitted or null. */
	channel_id?: string | null;
	/** Non-whitespace text, 1–4096 UTF-8 bytes. */
	text: string;
	actions?: never;
	image?: never;
	menu: MessageMenu;
}

export type SendMessageRequest =
	| SmsMessage
	| WhatsAppTextMessage
	| WhatsAppImageMessage
	| WhatsAppMenuMessage;

export type ZiphOptions = {
	/** Server-side API key. Never expose it in browser code. */
	apiKey: string;
	/** API root without /v1. Defaults to https://api.ziph.dev. */
	baseUrl?: string;
};

/** The key must be a nonblank string. Reuse it with the unchanged request when retrying. */
export type SendMessageInput = SendMessageRequest & { idempotencyKey: string };

export type SendTextInput = (SmsMessage | WhatsAppTextMessage) & {
	idempotencyKey: string;
};

export type SendImageInput = Omit<WhatsAppImageMessage, "channel_type"> & {
	idempotencyKey: string;
};

export type SendMenuInput = Omit<WhatsAppMenuMessage, "channel_type"> & {
	idempotencyKey: string;
};

/** Selection returned when a recipient answers a quick-reply or list message. */
export interface InteractiveReply {
	id: string;
	title: string;
	quoted_provider_message_id?: string;
}

export interface ReceivedMessage {
	provider_message_id: string;
	/** Original provider address. An @lid address is not a phone number. */
	sender: string;
	/** Unverified display name. Omitted when unavailable. */
	sender_name?: string;
	/** International +digits phone number. Omitted when unknown. */
	sender_phone?: string;
	/** Opaque @lid address without a device suffix. Omitted when unavailable. */
	sender_lid?: string;
	conversation: string;
	text: string;
	button_reply?: InteractiveReply;
	list_reply?: InteractiveReply;
}

export interface MessageReceivedEvent {
	version: 1;
	id: string;
	event: "message.received";
	channel_id: string;
	timestamp: string;
	message: ReceivedMessage;
}

export interface Message {
	id: string;
	channel_id: string | null;
	channel_type: ChannelType;
	recipient_masked: string;
	status: MessageStatus;
	provider_message_id: string | null;
	failure_code: string | null;
	created_at: string;
	updated_at: string;
}

export interface Meta {
	request_id?: string;
	timestamp: string;
}

export interface ResponseEnvelope<T> {
	data: T;
	meta: Meta;
}

export type MessageEnvelope = ResponseEnvelope<Message>;

export type ErrorCode =
	| "AUTH_REQUIRED"
	| "FORBIDDEN"
	| "RATE_LIMITED"
	| "MESSAGE_QUOTA_EXCEEDED"
	| "PLAN_EXPIRED"
	| "NUMBER_LIMIT_EXCEEDED"
	| "BILLING_CONFLICT"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "METHOD_NOT_ALLOWED"
	| "CONFLICT"
	| "CHANNEL_DISCONNECTED"
	| "PROVIDER_UNAVAILABLE"
	| "PROVIDER_TIMEOUT"
	| "PROVIDER_REJECTED"
	| "SEND_OUTCOME_UNKNOWN"
	| "IDEMPOTENCY_CONFLICT"
	| "CHANNEL_TYPE_UNAVAILABLE"
	| "CHANNEL_TYPE_MISMATCH"
	| "MESSAGE_TYPE_UNAVAILABLE"
	| "CONNECTION_METHOD_UNSUPPORTED"
	| "INTERNAL_SERVER_ERROR"
	| "SERVICE_UNAVAILABLE";

export interface ApiError {
	code: ErrorCode;
	message: string;
}

export interface ErrorEnvelope {
	data: null;
	error: ApiError;
	meta: Meta;
}
