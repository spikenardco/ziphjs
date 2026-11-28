# ziphjs

Lightweight JavaScript and TypeScript client for sending WhatsApp and
SMS messages with [Ziph](https://ziph.dev). No runtime dependencies.

The client covers sending messages; it does not list messages or look up message
details. Incoming webhook types support handling replies to your messages.

## Installation

```sh
npm install ziphjs
```

## Quick start

Set `ZIPH_API_KEY` in your server environment. Keep it out of source control and
browser code.

```js
import { ZiphClient } from "ziphjs";

const client = new ZiphClient({ apiKey: process.env.ZIPH_API_KEY });

const { data: message } = await client.sendMessage({
	channel_type: "whatsapp",
	to: "+23276123456",
	text: "Your order is ready.",
	idempotencyKey: "order-123-ready",
});

console.log(message.id, message.status);
```

WhatsApp messages use your default channel. To choose another, pass its
`channel_id`. For SMS, use `channel_type: "sms"`.

`sendMessage` requires `text` for text and menu messages. For image messages, omit
`text` or leave it empty and use `image.caption` for a caption.

Use `sendMessage` for any supported message type, or the `sendText`, `sendImage`,
and `sendMenu` helpers when you want a type-specific method. Request and response
types are exported from `ziphjs`.

Every send needs a nonblank string `idempotencyKey`. The API allows 1–255 UTF-8
bytes; the client checks that the key is nonblank but leaves length validation to
the API. Use a new key for each new logical message. If you're unsure whether a
request succeeded, retry with the same key and unchanged request. The client does
not retry automatically.

## Actions and menus

Add one to three `actions` to WhatsApp text or image messages. Omitted action
`type` means `reply`; reply IDs are required, case-sensitive, unique within the
message, and limited to 128 UTF-8 bytes. Explicit empty or null types are invalid.

```js
await client.sendText({
	channel_type: "whatsapp",
	to: "+23276123456",
	text: "Confirm your order?",
	actions: [
		{ id: "confirm", label: "Confirm" },
		{ type: "url", label: "View order", url: "https://example.com/orders/42" },
	],
	idempotencyKey: "order-42-confirm",
});
```

Each action accepts only its own fields:

| Action | Fields                                                                           |
| ------ | -------------------------------------------------------------------------------- |
| Reply  | `type?: "reply"`, `id`, `label`                                                  |
| URL    | `type: "url"`, `label`, `url` (absolute HTTP(S))                                 |
| Copy   | `type: "copy"`, `label`, `code`                                                  |
| Call   | `type: "call"`, `label`, `phone_number` (international +digits, up to 15 digits) |

Labels allow 1–25 characters. Required values must be nonblank and contain no
control characters. Non-reply actions require an explicit type and cannot carry
an `id`, even empty or null. URL, copy, and call actions do not generate click
webhooks. For image actions, use `sendImage` with `image: { url, caption }` and
`actions`; do not use top-level text for a caption.

`sendMenu` sets `channel_type: "whatsapp"` for you. Supply `text` and a `menu`
with a `label` and exactly one of flat `options` or explicitly labeled `groups`:

```js
await client.sendMenu({
	to: "+23276123456",
	text: "How can we help?",
	menu: {
		label: "View options",
		options: [
			{ id: "track", label: "Track my order" },
			{
				id: "support",
				label: "Contact support",
				description: "Talk to our team",
			},
		],
	},
	idempotencyKey: "order-42-menu",
});
```

For groups, replace `menu.options` with `menu.groups`:

```js
await client.sendMenu({
	to: "+23276123456",
	text: "Choose a service.",
	menu: {
		label: "View services",
		groups: [
			{ label: "Orders", options: [{ id: "track", label: "Track my order" }] },
			{ label: "Help", options: [{ id: "support", label: "Contact support" }] },
		],
	},
	idempotencyKey: "services-menu-42",
});
```

Menus allow 1–10 options total across all groups. Each group needs a label and
at least one option; groups cannot contain groups. IDs must be unique across the
whole menu and contain 1–128 UTF-8 bytes. Menu opener labels allow 1–20 characters,
group and option labels 1–24, and descriptions up to 72. Required values cannot be
blank or contain control characters. Flat options have no generated group heading;
explicit groups preserve their labels and order.

Menus require non-whitespace WhatsApp text and cannot be combined with actions
or images. SMS is text only. Omit unused interaction fields; null and empty
collections are invalid. The API validates values, limits, and unknown fields;
the SDK forwards request fields without translating or validating their content.

Interactive rendering is experimental and depends on the recipient's WhatsApp
client. Acceptance does not guarantee rendering. Flat menus still require
exact-carrier verification on current Android/iOS clients.

## Typing incoming webhook payloads

`MessageReceivedEvent` is exported for incoming WhatsApp text and interactive
replies. In a JavaScript Hono handler, annotate the parsed body with JSDoc:

```js
/** @type {import("ziphjs").MessageReceivedEvent} */
const data = await c.req.json();

const reply = data.message.selection?.id;
const phone = data.message.sender_phone;
```

In TypeScript, import the type and supply it to Hono's JSON reader:

```ts
import type { MessageReceivedEvent } from "ziphjs";

const data = await c.req.json<MessageReceivedEvent>();
```

Supported reply action and menu selections use `message.selection` with `source`
(`"buttons"` or `"menu"`), `id`, and `label`. The source for reply actions is
`"buttons"`, not `"actions"`. `message.text` also contains the selected label.
`selection.quoted_provider_message_id` is omitted when unavailable; ordinary text
messages omit `selection`. URL, copy, and call actions do not generate click
webhooks. The webhook envelope still uses `version: 1`.

`sender_name`, `sender_phone`, and `sender_lid` are omitted when unavailable.
Check that `sender_phone` exists before using it as a send recipient. The
`sender` address and `sender_lid` may be opaque WhatsApp identifiers, not phone
numbers; `sender_name` is an unverified display name.

These annotations provide static typing, not runtime validation. Verify webhook
signatures against the raw body before parsing, validate the payload, and
deduplicate event IDs before performing business actions.

## Errors

Failed HTTP responses with a valid API error envelope throw `ZiphError`, which
includes `status`, `code`, `message`, and `meta`. Use `code` for programmatic
decisions; `message` is a safe explanation for display, not a value to parse.
Malformed or non-JSON error responses throw a plain `Error` identifying an invalid
API response. Network errors pass through unchanged. Invalid client options or
idempotency keys throw `TypeError`.

`ZiphError.details`, `ApiError.details`, and the exported `FieldError` type have
been removed. When constructing `ZiphError` directly, supply the required API
error with `code` and `message`; the constructor no longer invents defaults.

The `ZiphClient` constructor rejects missing, non-string, or whitespace-only API
keys with `TypeError: apiKey must be a non-empty string.`

WhatsApp sends can fail with `NUMBER_LIMIT_EXCEEDED` (HTTP 409) when your
workspace has more channels than its plan allows. This differs from
`MESSAGE_QUOTA_EXCEEDED` (HTTP 429), which means the remaining WhatsApp message
or SMS segment allowance is insufficient.

Send failures distinguish rejection, unavailability, and uncertain outcomes:

- HTTP 422 `PROVIDER_REJECTED`: the provider rejected the request before accepting
  the message.
- HTTP 503 `PROVIDER_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, or
  `CHANNEL_TYPE_UNAVAILABLE`: the provider, service, or channel type is unavailable.
- HTTP 504 `PROVIDER_TIMEOUT`: a provider operation timed out outside an uncertain
  send.
- HTTP 502 `SEND_OUTCOME_UNKNOWN`: acceptance could not be confirmed. If you retry,
  use only the same idempotency key and unchanged request, never a new key. A
  timeout or lost response does not prove that the message was rejected.

The client does not retry automatically. After a network or protocol error during
a send, acceptance may also be uncertain; the same-key, unchanged-request retry
rule applies.

## Migrating interactions

The action/menu contract replaces the former interaction payloads without aliases
or automatic conversion. Update producers and webhook consumers together:

| Previous                                                    | Replacement                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `buttons`, `MessageButton`, `MessageButtons`                | `actions`, `MessageAction`, `MessageActions`                            |
| `QuickReplyButton`, `UrlButton`, `CopyButton`, `CallButton` | `ReplyAction`, `UrlAction`, `CopyAction`, `CallAction`                  |
| Action `title`, `type: "quick_reply"`, `copy_code`          | `label`, `type: "reply"` (or omit type), `code`                         |
| `list`, `MessageListMenu`, `WhatsAppListMessage`            | `menu`, `MessageMenu`, `WhatsAppMenuMessage`                            |
| `sendList`, `SendListInput`                                 | `sendMenu`, `SendMenuInput`                                             |
| `button_text`, `sections`, `rows`, `title`                  | `label`, `groups`, `options`, `label`; or flat `options` without groups |
| `ListSection`, `ListRow`                                    | `MenuGroup`, `MenuOption`                                               |
| `button_reply` / `list_reply`, `InteractiveReply`           | `selection`, `Selection`, with `source`, `id`, and `label`              |

All previous names above are removed from the SDK's methods and exported types.
The API rejects old and unknown payload fields. JavaScript callers must update
their payloads too; the client does not translate them. Webhooks retain version 1,
so do not rely on a version bump to detect the new reply shape.

The API also uses a new request fingerprint. Keys used under the previous
fingerprint remain reserved but return `409 IDEMPOTENCY_CONFLICT` rather than
replaying, even when a request appears unchanged. Reconcile in-flight and unknown
sends before switching producers, and pause old retry queues. Never generate a
new key to bypass an uncertain send.

Within the new contract, omitted and explicit `type: "reply"` are equivalent for
retries. Changing IDs, labels, option order, or flat/grouped presentation changes
the request. The SDK preserves those values and their order. Coordinate the API,
gateway, SDK callers, and webhook handlers for the hard cutover; there is no
compatibility window.

## Removed read-response types

`MessageDetail`, `MessageDetailEnvelope`, `MessageList`, `MessageListEnvelope`,
`MessageStatusEvent`, and `Message.events` have been removed. They described
lookup/list responses, not send responses. Consumers importing these types must
remove those imports. Send methods still return `MessageEnvelope`, whose `data`
is a `Message`.

## Development and releases

The runtime is plain ESM JavaScript in `src/index.js`. TypeScript declarations
live in `types/index.d.ts` and `types/models.d.ts`; consumers can import types
directly from `ziphjs`. There is no compilation or bundling step.

Run `npm ci`, `npm run format:check`, and `npm run typecheck` before releasing.
Typechecking checks the JavaScript through JSDoc and the public declarations
under both NodeNext and bundler resolution.

Use `npm pack --dry-run` to inspect the package contents without publishing.
The package ships `src` and `types` directly. Keep public declarations and
implementation annotations in sync when changing the API.

## License

Apache-2.0. See [LICENSE](./LICENSE).
