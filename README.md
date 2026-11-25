# ziphjs

Lightweight server-side JavaScript and TypeScript client for sending WhatsApp and
SMS messages with [Ziph](https://ziph.dev). Requires Node.js 20 or later. ESM only;
TypeScript declarations are included. No runtime dependencies.

## Installation

```sh
npm install ziphjs
```

## Quick start

Keep your API key on the server, outside source control. Set `ZIPH_API_KEY` in your
environment, then send a message:

```js
import { ZiphClient } from "ziphjs";

const client = new ZiphClient({ apiKey: process.env.ZIPH_API_KEY });

const { data: message } = await client.sendText({
	channel_type: "sms",
	to: "+23276123456",
	text: "Your order is ready.",
	idempotencyKey: "order-123-ready",
});

console.log(message.id, message.status);
```

Use `channel_type: "whatsapp"` to send WhatsApp text. An optional `channel_id`
selects a WhatsApp channel; omitting it uses the default channel.

The client also exposes `sendImage`, `sendList`, and `sendMessage`. Public request
and response types are exported from `ziphjs`.

Every send requires an `idempotencyKey` of 1–255 bytes. Use a new key per logical
message, and reuse that key with the unchanged request when retrying an uncertain
outcome. The client sends once, without automatic retries. An accepted message is
not confirmation of delivery.

## Errors

Unsuccessful HTTP responses throw `ZiphError`, with `status`, `code`, `details`,
and `meta` properties. Network errors are not wrapped. Invalid client options or
idempotency keys throw `TypeError`.

## Development and releases

Run `npm ci`, `npm run format:check`, `npm run typecheck`, `npm test`, and
`npm run build` before releasing. The test command currently discovers no tests.
Use `npm pack --dry-run` to inspect the package contents without publishing.

The Release workflow runs only on pushed `v*` tags. The tag must match the version
in `package.json`, for example `v0.0.1`. It checks the package, builds it, publishes
to npm using OIDC, then creates a GitHub Release with generated release notes.
Pushing a release tag publishes the package; it is not a preview.

Before using the workflow, configure npm trusted publishing for the package:

- Organization: `spikenardco`
- Repository: `ziphjs`
- Workflow filename: `release.yml`
- Allow direct `npm publish`

If the package does not yet exist on npm, first publish it manually with a
maintainer account so its package settings are available, then configure trusted
publishing for subsequent versions. Do not tag that already-published version for
the publish workflow. No long-lived npm token is needed in GitHub Actions.

## License

Apache-2.0. See [LICENSE](./LICENSE).
