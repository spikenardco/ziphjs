import type {
	MessageButtons,
	MessageEnvelope,
	MessageReceivedEvent,
	SendImageInput,
	SendListInput,
	SendTextInput,
} from "ziphjs";
import { ZiphClient, ZiphError } from "ziphjs";

const client = new ZiphClient({ apiKey: "test-key" });
const text = {
	channel_type: "sms",
	to: "+23276123456",
	text: "Ready",
	idempotencyKey: "text-123",
} satisfies SendTextInput;
const image = {
	to: text.to,
	image: { url: "https://example.test/photo.png" },
	idempotencyKey: "image-123",
} satisfies SendImageInput;
const list = {
	to: text.to,
	text: "Choose",
	list: {
		button_text: "Choose",
		sections: [{ title: "Today", rows: [{ id: "noon", title: "Noon" }] }],
	},
	idempotencyKey: "list-123",
} satisfies SendListInput;

const responses: Promise<MessageEnvelope>[] = [
	client.sendMessage(text),
	client.sendText(text),
	client.sendText({ ...text, channel_type: "whatsapp" }),
	client.sendImage(image),
	client.sendList(list),
	client.sendMessage({ ...image, channel_type: "whatsapp", text: "" as const }),
	client.sendMessage({ ...list, channel_type: "whatsapp" }),
];
void responses;

const smsImage = { ...text, image: image.image };
// @ts-expect-error SMS cannot include an image.
client.sendMessage(smsImage);
const captionAsText = {
	...image,
	channel_type: "whatsapp",
	text: "Caption",
} as const;
// @ts-expect-error An image uses image.caption rather than nonempty text.
client.sendMessage(captionAsText);
const listWithButtons = {
	...list,
	channel_type: "whatsapp" as const,
	buttons: [{ id: "yes", title: "Yes" }] satisfies MessageButtons,
};
client.sendText({
	...text,
	channel_type: "whatsapp",
	buttons: listWithButtons.buttons,
});
// @ts-expect-error A list cannot be combined with buttons.
client.sendMessage(listWithButtons);
// @ts-expect-error Each send requires an idempotency key.
client.sendText({ channel_type: "sms", to: text.to, text: "Ready" });

export function replyId(event: MessageReceivedEvent): string | undefined {
	const phone: string | undefined = event.message.sender_phone;
	void phone;
	return event.message.button_reply?.id ?? event.message.list_reply?.id;
}

const error = new ZiphError(503);
const status: number = error.status;
const requestId: string | undefined = error.meta?.request_id;
void status;
void requestId;
