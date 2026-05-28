/**
 * Minimal browser entrypoint for the starter template.
 *
 * Compiled to `harper-app/web/index.js` by `bun run build` and loaded by
 * `harper-app/web/index.html`. Calls `/Hello` and renders the message.
 */

interface HelloResponse {
  readonly message: string;
}

async function renderHello(): Promise<void> {
  const target = document.querySelector<HTMLElement>("[data-hello]");
  if (!target) return;
  const response = await fetch("/Hello");
  const data = (await response.json()) as HelloResponse;
  target.textContent = data.message;
}

void renderHello();
