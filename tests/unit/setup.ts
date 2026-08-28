// The destructive prepare/commit flow refuses to run without a confirmation
// secret, and `resolveConfirmationSecret()` reads it from the environment at
// dispatch time. Set it before any capability module is imported.
process.env.PRACHT_CONFIRMATION_SECRET ??= "test-only-forklight-confirmation-secret";
