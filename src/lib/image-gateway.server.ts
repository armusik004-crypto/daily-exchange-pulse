export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

export const imageSettings: Omit<ImageConfig, "apiKey"> = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "google/gemini-3-pro-image",
};

export function generateImage(config: ImageConfig, prompt: string, stream = true) {
  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: config.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      ...(stream ? { stream: true } : {}),
    }),
  });
}