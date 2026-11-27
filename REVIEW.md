# ziphjs: JavaScript runtime, TypeScript contracts

> Review snapshot from before the JavaScript migration. File paths, test counts,
> build commands, and references to the current implementation below describe
> that original checkout, not the migrated code.

## Verdict

For this particular SDK, use **plain ESM JavaScript for implementation, JSDoc for checking implementation boundaries, and authored `.d.ts` files for the public contract**.

You already support JavaScript consumers and TypeScript type imports. Changing the authoring language will not unlock that capability; it changes your maintenance workflow. Do it because you prefer writing JavaScript, not because the existing package forces consumers to use TypeScript. It does not.

This is my engineering assessment, not an impersonation of Rich Harris, Ryan Carniato, Evan You, or Anthony Fu, and not a claim about what any of them would choose.

## What I checked

Reviewed `src/index.ts`, `src/types.ts`, `package.json`, `tsconfig.json`, README, both GitHub workflows, and the generated declaration entry point at clean commit `e8c142f4ece10ebfa36e0e4837fa1dd433822ce0`.

Executed:

- `npm run typecheck`: passed.
- `npm test`: successful exit, **zero tests**.
- `npm run build`: passed.
- `npm pack --dry-run`: includes the JavaScript entry and both declaration files.
- A mocked-fetch runtime probe: `new ZiphClient({ apiKey: undefined })` accepted the missing key and sent `Authorization: Bearer undefined`. No live request was sent.

The worktree remains unchanged. This is an architectural and packaging review, not an audit of whether every wire type matches the live Ziph API.

## High-confidence findings

### Required: tests must exist before this migration is trustworthy

The CI test step currently proves only that Node can discover zero tests. There are also no consumer type fixtures exercising the package export map. A migration can preserve a successful build while breaking type imports or widening message inputs.

Keep a small behavioral suite around request URL, authorization and idempotency headers, request body, successful responses, structured HTTP errors, non-JSON HTTP errors, and propagated network failures. Include the byte-length boundary for idempotency keys, with multibyte input so character-count implementations fail.

Add consumer fixtures importing from **`ziphjs`**, not relative source paths. Exercise both `NodeNext` and `bundler` module resolution. Include valid sends and `@ts-expect-error` cases for an SMS image, an image with nonempty text, a list combined with buttons, and a missing idempotency key. Test the installed tarball in a temporary consumer project as a packaging check.

### Required: validate the API key at the constructor boundary

`src/index.ts:43–49` checks the URL protocol but not `apiKey`. JavaScript users can construct a client with an absent key; the README's environment-variable example can encounter exactly that situation. The mocked probe confirmed `Bearer undefined`.

Reject absent, non-string, or blank keys with a clear `TypeError` before sending. This is a runtime contract issue, not an argument for or against TypeScript. Avoid duplicating all server validation in the SDK; key presence and documented idempotency constraints are small, useful local checks.

### Optional: stop minifying this tiny server-side SDK

The existing runtime emits roughly 1.1 kB of minified JavaScript. Your current setup emits no runtime source maps. Readable code and stack traces are worth more here than a small reduction in package bytes. Node 20 can execute the language features this implementation uses without bundling.

### Keep: ESM, no runtime dependencies, one public entry

The current `types`-first conditional export is good. The existing message unions encode useful invalid combinations; preserve them. Do not add CommonJS, multiple runtime variants, a `/types` subpath, a schema dependency, or a new build framework without an actual consumer requirement.

## Recommended shape

```text
src/
  index.js           # Runtime implementation, with JSDoc at boundaries
types/
  index.d.ts         # Public classes and re-exported API types
  models.d.ts        # Existing message/request/response type definitions
```

`src/types.ts` is already type-only. Move its declarations into `types/models.d.ts`; retain their structure and comments. This is still a JavaScript implementation. Declaration files describe code; they contain no executable TypeScript.

If by “purely JavaScript” you mean no TypeScript tools or syntax anywhere, that is a different constraint. You can write JSDoc-only source and generate declarations, but consumers still need declarations in the published package. For your existing unions, the JSDoc-only authoring requirement adds verbosity without a runtime benefit.

### Runtime annotations

Use checked JSDoc to reference the contract rather than rewriting its unions:

```js
/** @import { ZiphOptions, SendTextInput, MessageEnvelope } from '../types/models.js' */

export class ZiphClient {
	/** @type {string} */
	#apiKey;

	/** @param {ZiphOptions} options */
	constructor({ apiKey }) {
		if (typeof apiKey !== "string" || !apiKey.trim()) {
			throw new TypeError("apiKey must be a non-empty string.");
		}
		this.#apiKey = apiKey;
	}

	/**
	 * @param {SendTextInput} input
	 * @returns {Promise<MessageEnvelope>}
	 */
	sendText(input) {
		return this.sendMessage(input);
	}

	// Preserve the existing sendMessage implementation and annotate its boundary.
}
```

This is a shortened illustration, not a replacement implementation: retain URL handling, all methods, and error behavior. In type-only references, `models.js` resolves to `models.d.ts`; you do not need an empty runtime models module.

Configure `tsc --noEmit` with `allowJs: true`, `checkJs: true`, `strict: true`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, and a target matching the minimum supported Node runtime. Keep the applicable existing strictness options. Include `src/**/*.js` and `types/**/*.d.ts`.

### Public declarations

`types/index.d.ts` re-exports the model types and declares the runtime classes:

```ts
import type {
	ApiError,
	ErrorCode,
	FieldError,
	MessageEnvelope,
	Meta,
	SendImageInput,
	SendListInput,
	SendMessageInput,
	SendTextInput,
	ZiphOptions,
} from "./models.js";

export type * from "./models.js";

export declare class ZiphError extends Error {
	status: number;
	code: ErrorCode | null;
	details: FieldError[];
	meta: Meta | null;
	constructor(status: number, error?: ApiError | null, meta?: Meta | null);
}

export declare class ZiphClient {
	#private;
	constructor(options: ZiphOptions);
	sendText(input: SendTextInput): Promise<MessageEnvelope>;
	sendImage(input: SendImageInput): Promise<MessageEnvelope>;
	sendList(input: SendListInput): Promise<MessageEnvelope>;
	sendMessage(input: SendMessageInput): Promise<MessageEnvelope>;
}
```

The tradeoff is explicit: method signatures are maintained in declarations and referenced by implementation JSDoc. `checkJs` checks the implementation's own annotations; it does **not** automatically prove an independently authored package declaration matches the JavaScript exports. Consumer type tests and runtime export/behavior tests are therefore important. Do not claim handwritten declarations cannot drift.

For two classes and four public send methods, that tradeoff is reasonable. If the runtime API grows substantially, reconsider generated declarations to reduce duplication.

### Package metadata

Publish the runtime and declarations directly. Relevant fields:

```json
{
	"type": "module",
	"types": "./types/index.d.ts",
	"exports": {
		".": {
			"types": "./types/index.d.ts",
			"import": "./src/index.js",
			"default": "./src/index.js"
		}
	},
	"files": ["src", "types"],
	"sideEffects": false
}
```

The top-level `types` is a compatibility fallback for tools that do not consult conditional exports. Keep `types` first inside the export condition. Keep the current `engines` requirement unless you intentionally change runtime support. The `default` entry does not produce a CommonJS build or guarantee `require()` support across your supported Node versions.

There is no necessary runtime build step in this design. Remove esbuild only after the migration is verified; retain TypeScript as a development tool for `checkJs` and consumer tests. Update release scripts and workflows so they no longer depend on generating `dist`, and make prepublication checks validate the actual files being shipped.

### Consumer experience

JavaScript:

```js
import { ZiphClient } from "ziphjs";

/** @type {import('ziphjs').SendTextInput} */
const input = {
	channel_type: "sms",
	to: "+23276123456",
	text: "Your order is ready.",
	idempotencyKey: "order-123-ready",
};
```

TypeScript:

```ts
import { ZiphClient } from "ziphjs";
import type { SendTextInput, MessageReceivedEvent } from "ziphjs";

const input = {
	channel_type: "sms",
	to: "+23276123456",
	text: "Your order is ready.",
	idempotencyKey: "order-123-ready",
} satisfies SendTextInput;
```

Types are erased. `MessageReceivedEvent` is not a runtime export, a parser, or a validator. Never add fake JavaScript exports just to make types look importable.

## Alternatives and when to use them

| Approach                                                     | Assessment for ziphjs                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keep TypeScript source and emit JavaScript plus declarations | Already works; lowest migration risk. Prefer this if you do not actually dislike authoring TypeScript.                                                                                                                                                                       |
| JavaScript runtime plus explicit `.d.ts` contracts           | Recommended if JavaScript authoring is the goal. Clear contracts, readable runtime, no required build.                                                                                                                                                                       |
| JavaScript/JSDoc plus generated declarations                 | Valid and supported by TypeScript. Useful for larger inference-friendly APIs. Your type-only public exports still need deliberate exposure; `@import` alone does not re-export all model types. Do not assume generation preserves the current public surface automatically. |

**Bottom line:** choose JavaScript if you prefer JavaScript. Preserve the types as a serious product contract. The larger quality gap today is missing runtime and consumer-type tests, not the source-file extension.

## Reference notes

Official documentation entry points for implementation:

- [Creating declaration files from JavaScript](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html)
- [JSDoc supported types](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)

Live fetching of these documentation pages was unavailable during this review; repository findings and executed checks above were obtained locally.
