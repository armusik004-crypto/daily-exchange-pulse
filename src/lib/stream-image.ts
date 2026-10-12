import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImagePayload = { type?: string; b64_json?: string; error?: { message?: string } };

export async function streamImage(
  endpoint: string,
  input: Record<string, unknown>,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
) {
  const send = (stream: boolean) =>
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, stream }),
    });

  const response = await send(true);
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `د عکس خدمت ستونزه لري (${response.status})`);
  }

  let sawEvent = false;
  let completed = false;
  let failure: string | undefined;
  const parser = createParser({
    onEvent(event) {
      let payload: ImagePayload | undefined;
      try { payload = JSON.parse(event.data) as ImagePayload; } catch { return; }
      if (event.event === "error" || payload.type === "error") {
        sawEvent = true;
        failure = payload.error?.message || "د عکس جوړول ناکام شول.";
        return;
      }
      const type = event.event || payload.type;
      if (type !== "image_generation.partial_image" && type !== "image_generation.completed") return;
      sawEvent = true;
      if (!payload.b64_json) return;
      const isFinal = type === "image_generation.completed";
      flushSync(() => onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal));
      completed ||= isFinal;
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parser.feed(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (failure) throw new Error(failure);
  if (!sawEvent) {
    const fallback = await send(false);
    const data = await fallback.json().catch(() => ({}));
    if (!fallback.ok) throw new Error(data.error || `د عکس خدمت ستونزه لري (${fallback.status})`);
    const image = data.data?.[0]?.b64_json;
    if (!image) throw new Error("عکس ترلاسه نه شو.");
    onFrame(`data:image/png;base64,${image}`, true);
    return;
  }
  if (!completed) throw new Error("د عکس جوړول بشپړ نه شول.");
}