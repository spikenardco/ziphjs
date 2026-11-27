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

/** Buttons: 1–3 per message, WhatsApp only. */
export interface QuickReplyButton {
	/** Defaults to quick_reply when omitted. */
	type?: "" | "quick_reply";
	/** Unique per message, 1–128 bytes. */
	id: string;
	/** 1–25 characters. */
	title: string;
	url?: never;
	copy_code?: never;
	phone_number?: never;
}

export interface UrlButton {
	type: "url";
	title: string;
	/** Absolute http(s) URL. */
	url: string;
	id?: never;
	copy_code?: never;
	phone_number?: never;
}

export interface CopyButton {
	type: "copy";
	title: string;
	copy_code: string;
	id?: never;
	url?: never;
	phone_number?: never;
}

export interface CallButton {
	type: "call";
	title: string;
	/** International format, e.g. +23276123456. */
	phone_number: string;
	id?: never;
	url?: never;
	copy_code?: never;
}

export type MessageButton =
	| QuickReplyButton
	| UrlButton
	| CopyButton
	| CallButton;

export type MessageButtons =
	| [MessageButton]
	| [MessageButton, MessageButton]
	| [MessageButton, MessageButton, MessageButton];

/** WhatsApp image: JPEG or PNG, up to 5 MiB, publicly accessible without redirects. */
export interface MessageImage {
	url: string;
	/** Up to 4096 bytes. Use this instead of text when sending an image. */
	caption?: string;
}

/** Single-select WhatsApp list menu. Cannot be combined with buttons or an image. */
export interface ListRow {
	/** Unique per message, 1–128 bytes. */
	id: string;
	/** 1–24 characters. */
	title: string;
	/** Up to 72 characters. */
	description?: string;
}

export interface ListSection {
	/** 1–24 characters. */
	title: string;
	rows: [ListRow, ...ListRow[]];
}

export interface MessageListMenu {
	/** Caption of the menu button, 1–20 characters. */
	button_text: string;
	/** 1–10 sections, at most 10 rows in total. */
	sections: [ListSection, ...ListSection[]];
}

/** SMS is text only. */
export interface SmsMessage {
	channel_type: "sms";
	/** Recipient in international format, e.g. +23276123456. */
	to: string;
	channel_id?: never;
	/** 1–4096 bytes. */
	text: string;
	buttons?: never;
	image?: never;
	list?: never;
}

export interface WhatsAppTextMessage {
	channel_type: "whatsapp";
	/** Recipient in international format, e.g. +23276123456. */
	to: string;
	/** Uses the default channel when omitted or null. */
	channel_id?: string | null;
	/** 1–4096 bytes. Must include non-whitespace text when adding buttons. */
	text: string;
	buttons?: MessageButtons;
	image?: never;
	list?: never;
}

export interface WhatsAppImageMessage {
	channel_type: "whatsapp";
	/** Recipient in international format, e.g. +23276123456. */
	to: string;
	/** Uses the default channel when omitted or null. */
	channel_id?: string | null;
	/** Omit, or pass an empty string, and use image.caption instead. */
	text?: "";
	buttons?: MessageButtons;
	image: MessageImage;
	list?: never;
}

export interface WhatsAppListMessage {
	channel_type: "whatsapp";
	/** Recipient in international format, e.g. +23276123456. */
	to: string;
	/** Uses the default channel when omitted or null. */
	channel_id?: string | null;
	/** 1–4096 bytes. */
	text: string;
	buttons?: never;
	image?: never;
	list: MessageListMenu;
}

export type SendMessageRequest =
	| SmsMessage
	| WhatsAppTextMessage
	| WhatsAppImageMessage
	| WhatsAppListMessage;

export type ZiphOptions = {
	/** Server-side API key. Never expose it in browser code. */
	apiKey: string;
	/** API root without /v1. Defaults to https://api.ziph.dev. */
	baseUrl?: string;
};

/** The key must be 1–255 bytes. Reuse it with the unchanged request when retrying. */
export type SendMessageInput = SendMessageRequest & { idempotencyKey: string };

export type SendTextInput = (
	| Pick<SmsMessage, "channel_type" | "to" | "text">
	| Pick<
			WhatsAppTextMessage,
			"channel_type" | "to" | "text" | "channel_id" | "buttons"
	  >
) & { idempotencyKey: string };

export type SendImageInput = Pick<
	WhatsAppImageMessage,
	"to" | "channel_id" | "image" | "buttons"
> & { idempotencyKey: string };

export type SendListInput = Pick<
	WhatsAppListMessage,
	"to" | "channel_id" | "text" | "list"
> & { idempotencyKey: string };

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

export interface MessageStatusEvent {
	id: string;
	status: MessageStatus;
	failure_code: string | null;
	occurred_at: string;
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
	events?: MessageStatusEvent[];
}

export interface MessageDetail extends Message {
	events: MessageStatusEvent[];
}

export interface MessageList {
	messages: Message[];
	/** Pass as `before` when listing; null on the last page. */
	next_cursor: string | null;
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
export type MessageDetailEnvelope = ResponseEnvelope<MessageDetail>;
export type MessageListEnvelope = ResponseEnvelope<MessageList>;

export type ErrorCode =
	| "AUTH_REQUIRED"
	| "MESSAGE_QUOTA_EXCEEDED"
	| "PLAN_EXPIRED"
	| "NUMBER_LIMIT_EXCEEDED"
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "CHANNEL_DISCONNECTED"
	| "PROVIDER_UNAVAILABLE"
	| "PROVIDER_TIMEOUT"
	| "PROVIDER_REJECTED"
	| "IDEMPOTENCY_CONFLICT"
	| "CHANNEL_TYPE_UNAVAILABLE"
	| "CHANNEL_TYPE_MISMATCH"
	| "MESSAGE_TYPE_UNAVAILABLE"
	| "INTERNAL_SERVER_ERROR";

export interface FieldError {
	field: string;
	message: string;
}

export interface ApiError {
	code: ErrorCode;
	message: string;
	details: FieldError[];
}

export interface ErrorEnvelope {
	data: null;
	error: ApiError;
	meta: Meta;
}
