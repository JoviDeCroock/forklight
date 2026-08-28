// Shapes of the two WebMCP surfaces the e2e suite drives, as Chrome 152
// actually exposes them (there is no shipped .d.ts for either yet).
//
// - `navigator.modelContextTesting` is the automation hook enabled by
//   --enable-features=WebMCPTesting. `listTools()` returns *stripped*
//   descriptors: name, description and a JSON-**string** inputSchema, with no
//   annotations. `executeTool()` takes the input as a JSON string and resolves
//   with the serialized result envelope (also a string).
// - `document.modelContext` is the page-facing API. Its `getTools()` keeps the
//   full descriptor, annotations included, which is where the suite asserts
//   `untrustedContentHint`.

interface WebMcpTestingToolDescriptor {
  name: string;
  description?: string;
  /** JSON string, not an object — the testing hook serializes it. */
  inputSchema?: string;
}

interface WebMcpToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  untrustedContentHint?: boolean;
}

interface WebMcpPageToolDescriptor {
  name: string;
  title?: string;
  description?: string;
  annotations?: WebMcpToolAnnotations;
}

interface WebMcpTesting {
  listTools(): Promise<WebMcpTestingToolDescriptor[]>;
  /** `input` MUST be a JSON string; resolves with the serialized envelope. */
  executeTool(name: string, input: string): Promise<string>;
}

interface WebMcpPageApi {
  getTools(): Promise<WebMcpPageToolDescriptor[]>;
  registerTool(tool: Record<string, unknown>): unknown;
}

interface Navigator {
  readonly modelContextTesting?: WebMcpTesting;
}

interface Document {
  readonly modelContext?: WebMcpPageApi;
}
