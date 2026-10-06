export function safeRedirectUrl(
  url: string,
  baseUrl: string,
  configuredBase?: string,
  configuredOrigins: string[] = [],
) {
  let canonical: URL;
  try {
    canonical = new URL(configuredBase || baseUrl);
  } catch {
    canonical = new URL(baseUrl);
  }
  const allowedOrigins = configuredOrigins.flatMap((origin) => {
    try {
      return [new URL(origin).origin];
    } catch {
      return [];
    }
  });
  const allowed = new Set([canonical.origin, ...allowedOrigins]);
  try {
    const target = new URL(url, canonical);
    if (
      (target.protocol !== "https:" && target.protocol !== "http:") ||
      !allowed.has(target.origin)
    )
      return canonical.toString();
    return target.toString();
  } catch {
    return canonical.toString();
  }
}
