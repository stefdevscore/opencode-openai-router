/** The host validates this bounded contract at the server boundary. */
export const RouterRpc = {
  id: "openai-router-controls",
  methods: {
    status: {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: {
        type: "object",
        properties: {
          status: { enum: ["ready", "invalid_config", "unreadable_config", "disposed"] },
          mode: { enum: ["auto", "off", null] },
          profile: { enum: ["economy", "balanced", "quality", null] },
          generation: { type: "integer", minimum: 0 },
          routing: { const: "inactive" },
        },
        required: ["status", "mode", "profile", "generation", "routing"],
        additionalProperties: false,
      },
    },
    catalog: {
      input: { type: "object", properties: {}, additionalProperties: false },
      output: {
        type: "object",
        properties: {
          status: { enum: ["ready", "disconnected", "unavailable", "invalidated"] },
          hostAvailable: { enum: [true, false, null] },
          connected: { enum: [true, false, null] },
          complete: { enum: [true, false, null] },
          fresh: { type: "boolean" },
          models: { type: "array", maxItems: 100, items: { type: "object", properties: { id: { type: "string", maxLength: 128 }, context: { type: ["integer", "null"] }, tools: { enum: [true, false, null] }, input: { type: ["array", "null"], items: { type: "string", maxLength: 64 }, maxItems: 32 }, variants: { type: ["array", "null"], items: { type: "string", maxLength: 128 }, maxItems: 128 } }, required: ["id", "context", "tools", "input", "variants"], additionalProperties: false } },
          truncated: { type: "boolean" },
        },
        required: ["status", "hostAvailable", "connected", "complete", "fresh", "models", "truncated"],
        additionalProperties: false,
      },
    },
  },
  events: {},
} as const;
