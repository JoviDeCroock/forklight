import "@pracht/core";

declare module "@pracht/core" {
  interface Register {
    context: {
      env: Env;
      executionContext: ExecutionContext;
      /** Set by the session middleware; keys this visitor's incident state. */
      sessionId?: string;
    };
  }
}
