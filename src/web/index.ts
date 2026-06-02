/**
 * Minimal browser entrypoint for the starter template.
 *
 * Compiled to `harper-app/web/index.js` by `bun run build` and loaded by
 * `harper-app/web/index.html`. Calls `/Hello` and renders the message.
 */

/** Shape of the JSON payload returned by the `/Hello` resource. */
interface HelloResponse {
  readonly message: string;
}

/**
 * Fetches `/Hello` and renders its message into the `[data-hello]` element.
 *
 * Uses `replaceChildren` with a fresh text node rather than assigning
 * `textContent` so the render avoids in-place property mutation.
 * @returns Promise that resolves once the greeting has been rendered.
 */
async function renderHello(): Promise<void> {
  const target = document.querySelector<HTMLElement>("[data-hello]");
  if (!target) return;
  const response = await fetch("/Hello");
  const data = (await response.json()) as HelloResponse;
  target.replaceChildren(document.createTextNode(data.message));
}

void renderHello();
