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

`sendMessage` requires `text` for text and list messages. For image messages, omit
`text` or leave it empty and use `image.caption` for a caption.

Use `sendMessage` for any supported message type, or the `sendText`, `sendImage`,
and `sendList` helpers when you want a type-specific method. Request and response
types are exported from `ziphjs`.

Every send needs a nonblank string `idempotencyKey`. The client does not impose
a key-length limit. Use a new key for each message. If you're unsure whether a
request succeeded, retry with the same key and unchanged request. The client
does not retry automatically.

## Typing incoming webhook payloads

`MessageReceivedEvent` is exported for incoming WhatsApp text and interactive
replies. In a JavaScript Hono handler, annotate the parsed body with JSDoc:

```js
/** @type {import("ziphjs").MessageReceivedEvent} */
const data = await c.req.json();

const reply = data.message.button_reply?.id ?? data.message.list_reply?.id;
const phone = data.message.sender_phone;
```

In TypeScript, import the type and supply it to Hono's JSON reader:

```ts
import type { MessageReceivedEvent } from "ziphjs";

const data = await c.req.json<MessageReceivedEvent>();
```

`sender_name`, `sender_phone`, and `sender_lid` are omitted when unavailable.
Check that `sender_phone` exists before using it as a send recipient. The
`sender` address and `sender_lid` may be opaque WhatsApp identifiers, not phone
numbers; `sender_name` is an unverified display name.

These annotations provide static typing, not runtime validation. Verify webhook
signatures against the raw body before parsing, validate the payload, and
deduplicate event IDs before performing business actions.

## Errors

Failed HTTP responses throw `ZiphError`, which includes `status`, `code`, `details`,
and `meta`. Network errors pass through unchanged. Invalid client options or
idempotency keys throw `TypeError`.

The constructor rejects missing, non-string, or whitespace-only API keys with
`TypeError: apiKey must be a non-empty string.`

WhatsApp sends can fail with `NUMBER_LIMIT_EXCEEDED` (HTTP 409) when your
workspace has more channels than its plan allows. This differs from
`MESSAGE_QUOTA_EXCEEDED` (HTTP 429), which means the remaining WhatsApp message
or SMS segment allowance is insufficient.

## Removed read-response types

`MessageDetail`, `MessageDetailEnvelope`, `MessageList`, `MessageListEnvelope`,
`MessageStatusEvent`, and `Message.events` have been removed. They described
lookup/list responses, not send responses. Consumers importing these types must
remove those imports. Send methods still return `MessageEnvelope`, whose `data`
is a `Message`; WhatsApp list-menu types and `sendList` are unchanged.

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
