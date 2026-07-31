import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("商汤科技", {
    // === 你只需要改这里 ===
    name: "商汤科技",
    baseUrl: "https://token.sensenova.cn/v1", // ← 改成你的 API 地址
    apiKey: "sk-xxx", // ← 环境变量名，或直接填密钥
    api: "openai-completions", // ← 大多数兼容 OpenAI 的 API 用这个

    models: [
      {
        id: "sensenova-6.7-flash-lite", // ← 改成你的模型名
        name: "sensenova-6.7-flash-lite",
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 256_000,
        maxTokens: 64_000,
      },

      {
        id: "deepseek-v4-flash",
        name: "deepseek-v4-flash",
        reasoning: true,
        input: ["text"],
        compat: {
          supportsReasoningEffort: true,
          supportsDeveloperRole: false,
        },
        cost: { input: 1, output: 2, cacheRead: 0.02, cacheWrite: 0 },
        contextWindow: 1_000_000,
        maxTokens: 64_000,
      },
    ],
  });

  pi.registerProvider("LinuxDo", {
    // === 你只需要改这里 ===
    name: "LinuxDo",
    baseUrl: "https://hub.linux.do/v1", // ← 改成你的 API 地址
    apiKey: "ah-xxx", // ← 环境变量名，或直接填密钥
    api: "openai-completions", // ← 大多数兼容 OpenAI 的 API 用这个

    models: [
      {
        id: "deepseek-v4-flash",
        name: "deepseek-v4-flash",
        reasoning: true,
        compat: {
          supportsReasoningEffort: true,
          supportsDeveloperRole: false,
        },
        input: ["text"],
        cost: { input: 1, output: 2, cacheRead: 0.02, cacheWrite: 0 },
        contextWindow: 1_000_000,
        maxTokens: 64_000,
      },
    ],
  });
}
