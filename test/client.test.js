import assert from "node:assert/strict";
import { test } from "node:test";
import { ZiphClient, ZiphError } from "ziphjs";

const input = {
	channel_type: "sms",
	to: "+23276123456",
	text: "Your order is ready.",
	idempotencyKey: "order-123-ready",
};

const envelope = {
	data: {
		id: "message-123",
		channel_id: null,
		channel_type: "sms",
		recipient_masked: "+23276****56",
		status: "accepted",
		provider_message_id: null,
		failure_code: null,
		created_at: "2026-11-27T12:00:00Z",
		updated_at: "2026-11-27T12:00:00Z",
	},
	meta: { timestamp: "2026-11-27T12:00:00Z", request_id: "request-123" },
};

test("constructor rejects missing, non-string and blank API keys", () => {
	const expectedError = {
		name: "TypeError",
		message: "apiKey must be a non-empty string.",
	};
	assert.throws(() => new ZiphClient({}), expectedError);
	for (const apiKey of [undefined, null, 123, false, {}, [], "", " \t\r\n"]) {
		assert.throws(() => new ZiphClient({ apiKey }), expectedError);
	}
	assert.doesNotThrow(() => new ZiphClient({ apiKey: "k" }));
});

test("send methods preserve the request, headers, URL and response", async (t) => {
	const client = new ZiphClient({
		apiKey: "test-key",
		baseUrl: "https://example.test/api///",
	});
	const requests = [];
	t.mock.method(globalThis, "fetch", async (url, options) => {
		requests.push({ url: String(url), ...options });
		return Response.json(envelope);
	});

	const image = {
		to: input.to,
		image: { url: "https://example.test/photo.png", caption: "Ready" },
		idempotencyKey: "image-123",
	};
	const list = {
		to: input.to,
		text: "Choose a pickup time",
		list: {
			button_text: "Choose",
			sections: [{ title: "Today", rows: [{ id: "noon", title: "Noon" }] }],
		},
		idempotencyKey: "list-123",
	};
	const whatsapp = { ...input, channel_type: "whatsapp" };
	for (const [method, message, body] of [
		[
			"sendText",
			input,
			{ channel_type: "sms", to: input.to, text: input.text },
		],
		[
			"sendImage",
			image,
			{ to: image.to, image: image.image, channel_type: "whatsapp" },
		],
		[
			"sendList",
			list,
			{
				to: list.to,
				text: list.text,
				list: list.list,
				channel_type: "whatsapp",
			},
		],
		[
			"sendMessage",
			whatsapp,
			{ channel_type: "whatsapp", to: input.to, text: input.text },
		],
	]) {
		assert.deepEqual(await client[method](message), envelope);
		const request = requests.at(-1);
		assert.equal(request.url, "https://example.test/api/v1/messages");
		assert.equal(request.method, "POST");
		assert.equal(request.redirect, "error");
		assert.deepEqual(request.headers, {
			Authorization: "Bearer test-key",
			"Content-Type": "application/json",
			"Idempotency-Key": message.idempotencyKey,
		});
		assert.deepEqual(JSON.parse(request.body), body);
	}
	assert.equal(requests.length, 4);
});

test("idempotency keys enforce UTF-8 byte boundaries before sending", async (t) => {
	const client = new ZiphClient({ apiKey: "test-key" });
	const fetch = t.mock.method(globalThis, "fetch", async (url) => {
		assert.equal(String(url), "https://api.ziph.dev/v1/messages");
		return Response.json(envelope);
	});
	for (const key of ["a", `${"é".repeat(127)}a`]) {
		await client.sendMessage({ ...input, idempotencyKey: key });
	}
	assert.equal(fetch.mock.callCount(), 2);
	for (const key of [
		undefined,
		null,
		123,
		"",
		"  ",
		"a".repeat(256),
		"é".repeat(128),
	]) {
		await assert.rejects(
			client.sendMessage({ ...input, idempotencyKey: key }),
			{
				name: "TypeError",
				message: "idempotencyKey must be between 1 and 255 bytes.",
			},
		);
	}
	assert.equal(fetch.mock.callCount(), 2);
});

test("HTTP failures expose API details or a fallback ZiphError", async (t) => {
	const client = new ZiphClient({ apiKey: "test-key" });
	const error = {
		code: "VALIDATION_ERROR",
		message: "Invalid recipient.",
		details: [{ field: "to", message: "Use international format." }],
	};
	const responses = [
		Response.json({ data: null, error, meta: envelope.meta }, { status: 422 }),
		new Response("<html>Bad gateway</html>", { status: 502 }),
		new Response(null, { status: 503 }),
	];
	t.mock.method(globalThis, "fetch", async () => responses.shift());
	await assert.rejects(client.sendMessage(input), (caught) => {
		assert.ok(caught instanceof ZiphError);
		assert.equal(caught.name, "ZiphError");
		assert.equal(caught.message, error.message);
		assert.equal(caught.status, 422);
		assert.equal(caught.code, error.code);
		assert.deepEqual(caught.details, error.details);
		assert.deepEqual(caught.meta, envelope.meta);
		return true;
	});
	for (const status of [502, 503]) {
		await assert.rejects(client.sendMessage(input), (caught) => {
			assert.ok(caught instanceof ZiphError);
			assert.equal(caught.status, status);
			assert.equal(caught.message, `Ziph request failed with HTTP ${status}.`);
			assert.equal(caught.code, null);
			assert.deepEqual(caught.details, []);
			assert.equal(caught.meta, null);
			return true;
		});
	}
});

test("network failures pass through without automatic retries", async (t) => {
	const failure = new TypeError("Connection failed");
	const fetch = t.mock.method(globalThis, "fetch", async () => {
		throw failure;
	});
	await assert.rejects(
		new ZiphClient({ apiKey: "test-key" }).sendMessage(input),
		(caught) => caught === failure,
	);
	assert.equal(fetch.mock.callCount(), 1);
});

test("baseUrl rejects non-HTTP protocols", () => {
	assert.throws(
		() => new ZiphClient({ apiKey: "test-key", baseUrl: "file:///tmp" }),
		{ name: "TypeError", message: "baseUrl must use HTTP or HTTPS." },
	);
});
