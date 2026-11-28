# SDK upgrade plan: typed actions, menus, and selections

Status: approved and implemented in three atomic local batches. The original
plan below is retained as the design record; verification results are recorded
at the end. No version bump, push, publication, deployment, or live send performed.

## Findings and source of truth

Inspected the last ten commits in `../ziph`, ending at
`docs(interactions): document replacement contracts and verification`, and the
current SDK source and declarations. Six commits introduce the interaction
replacement; the remaining four cover the error contract and earlier list
rendering. The SDK's two existing local error-contract commits already address
that error change.

Canonical sources:

- [API schemas](../ziph/internal/openapi/openapi.json): exclusive action/menu shapes
  and normalized webhook selection.
- [Shared types and validators](../ziph/internal/channel/types.go): field presence,
  variant exclusivity, byte/character limits, and IDs.
- [Send handler](../ziph/internal/handlers/messages.go): strict decoding,
  idempotency-key limit, and replacement fingerprint.
- [API implementation and verification record](../ziph/docs/superpowers/plans/2026-11-28-interaction-contract.md):
  hard cutover and outstanding device/deployment gates.
- [SDK declarations](types/models.d.ts) and [runtime](src/index.js): current
  mismatch.

The API checkout has unrelated uncommitted error-documentation changes. Leave
them untouched. These findings describe the local API design, not confirmation
that it is deployed.

## Recommended design

Replace the SDK's old interaction surface directly. Keep the plain ESM JavaScript
runtime, hand-maintained declarations, snake_case wire fields, and zero runtime
dependencies.

- `sendMessage` remains the generic forwarding method; no new endpoint or payload
  adapter.
- `sendText` supports WhatsApp text with optional actions and SMS text without
  interactions.
- `sendImage` keeps nested `image.caption` and supports optional actions.
- Replace `sendList` with `sendMenu`, which sets `channel_type: "whatsapp"` and
  forwards the new menu unchanged.
- Do not add `sendActions`: actions accompany text/images rather than define
  another message transport.
- No legacy aliases, `buttons`/`list` conversion, generated IDs/headings,
  client-side reply normalization, or compatibility parser.
- Preserve the current error handling, authentication, response types, and
  same-key/no-automatic-retry behavior. Do not restore removed read/list response
  methods or types.

Alternative: expose only `sendMessage` and remove the menu helper entirely. That
minimizes method count, but `sendMenu` is the more consistent replacement for the
SDK's existing type-specific convenience methods. Keeping `sendList` as an alias
would obscure the hard cutover and is not recommended.

## Public type contract

### Outbound actions

Replace the old button exports with `ReplyAction`, `UrlAction`, `CopyAction`,
`CallAction`, `MessageAction`, and `MessageActions`.

- Reply: `{ type?: "reply"; id: string; label: string }`. Explicit empty/null types
  are invalid; omitted type means reply.
- URL: `{ type: "url"; label: string; url: string }`.
- Copy: `{ type: "copy"; label: string; code: string }`.
- Call: `{ type: "call"; label: string; phone_number: string }`.
- Keep forbidden variant fields typed `?: never`, matching the SDK's existing
  exclusive-union style. Non-reply actions cannot carry IDs.
- `MessageActions` is a tuple union allowing one, two, or three actions, following
  the current button collection pattern.
- Document required nonblank/control-free values, 25-character labels, reply IDs
  unique per message and limited to 128 UTF-8 bytes, absolute HTTP(S) URLs, and
  international phone numbers.

### Outbound menus

Replace `ListRow`, `ListSection`, and `MessageListMenu` with `MenuOption`,
`MenuGroup`, and `MessageMenu`.

- Option: `{ id: string; label: string; description?: string }`.
- Group: `{ label: string; options: [MenuOption, ...MenuOption[]] }`.
- `MessageMenu` is an exclusive union of
  `{ label; options: nonempty options; groups?: never }` and
  `{ label; groups: nonempty groups; options?: never }`.
- Preserve the distinction between flat menus and explicitly titled groups.
  Never manufacture a group from flat options.
- Document 1–10 options total across all groups, globally unique option IDs,
  128 UTF-8-byte IDs, opener labels up to 20 characters, group/option labels up to
  24, and descriptions up to 72.
- Use the API to enforce aggregate counts, uniqueness, byte limits, URLs, and
  value rules; do not add a duplicate runtime validation engine or large
  type-level counting system.

Replace `WhatsAppListMessage`/`SendListInput` with
`WhatsAppMenuMessage`/`SendMenuInput`. Update every request union, helper input,
declaration, and JSDoc import together. SMS forbids `actions`, `image`, `menu`, and
`channel_id`; menus forbid images/actions; WhatsApp text and image variants allow
actions. Omit unused interaction fields rather than sending null or empty
collections.

### Inbound selections

Replace `InteractiveReply`, `ReceivedMessage.button_reply`, and
`ReceivedMessage.list_reply` with:

```ts
export interface Selection {
	source: "buttons" | "menu";
	id: string;
	label: string;
	quoted_provider_message_id?: string;
}
```

`ReceivedMessage.selection?: Selection`. Keep the source literal **"buttons"**,
even though the outbound field is named `actions`. Keep webhook `version: 1`,
sender enrichment fields, IDs, timestamps, and `message.text`; for supported
selections, text contains the selected label. URL/copy/call actions do not generate
click webhooks. The SDK only types webhooks; it does not parse, authenticate, or
validate them at runtime.

## Atomic implementation batches

### 1. Replace outbound interaction contracts

Files: `types/models.d.ts`, `types/index.d.ts`, `src/index.js`, outbound examples in
`README.md`.

Deliverable: generic sends, text/image action sends, and flat/grouped menu sends
have matching runtime annotations and public declarations. `sendMenu` replaces
`sendList`; old outbound interaction exports disappear.

Acceptance and verification:

- Compile consumer fixtures under NodeNext and bundler resolution: all four
  action variants, omitted/explicit reply type, image actions, flat menus, and
  grouped menus.
- Negative fixtures must fail for mixed action fields, missing reply IDs,
  empty/null action types, zero/four actions, menus with both/neither collection,
  empty collections, menu/image or menu/action combinations, and SMS interactions.
  Verify forbidden-field failures on typed variables as well as fresh object
  literals where applicable.
- Local HTTP capture must show the exact payload, preserved ordering/IDs/labels,
  forced WhatsApp channel for `sendMenu`, header-only idempotency key, and no
  automatic retries. Keep plain SMS/text/image sends as controls.
- Run `npm run format:check`, `npm run typecheck`, and `git diff --check`; inspect
  the diff and commit this batch before continuing.

### 2. Replace inbound reply types

Files: `types/models.d.ts`, inbound webhook examples in `README.md`.

Deliverable: `selection` is the sole typed reply field; consumers read
`data.message.selection?.id` and can discriminate on `source`.

Acceptance and verification:

- Compile plain-text, button-selection, and menu-selection webhook fixtures,
  with quoted reference both present and absent.
- Assert version 1 and sender fields still typecheck; invalid sources and former
  reply-field accesses fail compilation.
- Cross-check fixtures against the API's current signed-webhook examples/schema.
  No runtime webhook parser or signature helper is introduced.
- Run formatting/typechecking and diff checks, review, then commit independently.

### 3. Document migration and verify the combined package

File: `README.md`; package metadata only if a release/version change is explicitly
requested later.

Deliverable: a clear hard-cutover guide with replacement names, examples, and
retry constraints; no contradictory statement that `sendList` or the old
interaction types remain supported.

Acceptance and verification:

- Document `buttons → actions`, `title → label`, reply `quick_reply → reply`,
  `copy_code → code`, `list → menu`, `button_text → label`,
  `sections/rows → groups/options`, and old reply fields → `selection`. This is
  consumer migration guidance, not automatic runtime conversion.
- State the API's 1–255 UTF-8-byte idempotency-key limit. Keep the SDK's existing
  nonblank check; do not silently add a new local length restriction in this
  interaction change.
- Explain the replacement fingerprint: old keys remain reserved but conflict
  rather than replay, even where a request seems unchanged. Reconcile
  pending/unknown outcomes before producer cutover. Never bypass uncertainty by
  generating a new key.
- Run `npm pack --dry-run`; check the exported package surface, compile README
  examples, and search runtime/declarations/current examples for obsolete
  interaction names. Historical migration prose is allowed.
- Recheck the previously implemented error contract and unaffected send/response
  behavior with temporary probes. Follow the repository's deliberate no-test-suite
  setup rather than adding a test framework as part of this upgrade.
- Review and commit the documentation batch. Report local commit state separately
  from push/publication/deployment state.

These batches are review checkpoints, not separately publishable releases.
Publish only the complete new SDK contract.

## Cutover and release gates

- Coordinate API, gateway, SDK consumers, and webhook handlers. The API
  intentionally keeps the same routes and webhook version 1; there is no
  version-based compatibility negotiation.
- Preserve idempotency records and pause/reconcile old producers and retry queues
  before switching payload contracts. Do not add SDK retry heuristics or status
  lookup APIs to work around this.
- API notes explicitly leave current Android/iOS exact-carrier rendering tests
  outstanding, especially flat menus. Local SDK payload tests cannot establish
  WhatsApp device rendering. Keep the experimental/client-dependent caveat.
- The API repository's SDK guide still names old SDK exports and says the error
  SDK update is pending. Update that external guide when the new SDK version is
  actually available; do not claim publication from local edits.
- Recommend a clearly breaking pre-1.0 release, such as `0.1.0`, rather than a patch.
  Version selection, publishing, pushes, deployment, and live sends are separate
  actions, not authorized by this planning request.

## Implementation and verification record

- Outbound runtime annotations and declarations now expose typed actions,
  exclusive flat/grouped menus, and `sendMenu` instead of `sendList`. Text and
  image helpers retain forbidden-field constraints, including for typed variables.
  No payload converter, compatibility alias, new dependency, or validator added.
- Inbound types expose only `selection`, with sources `buttons` and `menu`.
  Webhook version 1, readable text, optional quoted reference, and sender fields
  are preserved. README examples and migration guidance match the new contract.
- `npm run format:check`, `npm run typecheck`, and `git diff --check` passed.
  Positive and expected-failure consumer fixtures compiled under both NodeNext
  and bundler resolution with strict and exact optional property checks.
- Inbound checks included three fixtures generated directly from the API's
  OpenAPI webhook examples, plain text, both selection sources, optional quoted
  references, unchanged sender fields, and rejection of former reply-field access.
- Eleven local HTTP send scenarios passed, covering all action kinds, default and
  explicit reply type, image captions/actions, both menu presentations, generic
  sends, and plain SMS/text/image controls. Captured requests preserved exact
  fields and order, header-only idempotency keys, helper channel routing, and input
  objects. Each call made one request. The existing absence of a local key-length
  cap was retained; the API still owns that validation.
- Error controls passed for seven status/code pairs, eight malformed/non-JSON
  replies, unchanged network-error identity, and invalid local keys. The existing
  23-code union still matches OpenAPI exactly.
- A deliberate in-memory mutation made the menu helper send SMS; the same payload
  assertion rejected it. The source file was not mutated.
- All six README JavaScript/TypeScript code blocks compiled with the documented
  environment/handler context supplied by fixtures. All four send examples also
  executed with fetch intercepted locally, without external requests.
- `npm pack --dry-run` listed exactly the expected six files: LICENSE, README,
  package metadata, JavaScript runtime, and the two declaration files. The plan
  and temporary probes are not shipped. Legacy interaction names remain only in
  migration/history prose, not runtime, declarations, or executable examples.
- Temporary probes were used instead of adding a test framework, in keeping with
  this repository's existing setup. Package version and release metadata are
  unchanged. The API checkout and its documentation were not edited.

Remaining release gates: reconcile uncertain/in-flight sends before the hard
cutover, coordinate API/gateway/callers/webhook consumers, authorize a release
version and publication separately, and complete exact-carrier Android/iOS
rendering checks. Local SDK checks do not establish device rendering or deployment
readiness.
