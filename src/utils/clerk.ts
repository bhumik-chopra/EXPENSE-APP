export function getClerkErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'errors' in error) {
    const issues = (error as { errors?: Array<{ longMessage?: string; message?: string; code?: string }> }).errors;
    const firstIssue = Array.isArray(issues) ? issues[0] : undefined;

    if (firstIssue?.longMessage) {
      return firstIssue.longMessage;
    }

    if (firstIssue?.message) {
      return firstIssue.message;
    }

    if (firstIssue?.code) {
      return `Clerk error: ${firstIssue.code}`;
    }
  }

  return fallback;
}
