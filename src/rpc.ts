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
  },
  events: {},
} as const;
