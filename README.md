# ziphjs

Lightweight JavaScript and TypeScript client for sending WhatsApp and
SMS messages with [Ziph](https://ziph.dev). No runtime dependencies.

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

Every send needs an `idempotencyKey` of 1 to 255 bytes. Use a new key for each
message. If you're unsure whether a request succeeded, retry with the same key
and unchanged request. The client does not retry automatically.

## Errors

Failed HTTP responses throw `ZiphError`, which includes `status`, `code`, `details`,
and `meta`. Network errors pass through unchanged. Invalid client options or
idempotency keys throw `TypeError`.

## Development and releases

Run `npm ci`, `npm run format:check`, `npm run typecheck`, `npm test`, and
`npm run build` before releasing. The test command currently discovers no tests.
Use `npm pack --dry-run` to inspect the package contents without publishing.

## License

Apache-2.0. See [LICENSE](./LICENSE).
