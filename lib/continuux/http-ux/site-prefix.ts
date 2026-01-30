import { Application } from "../http.ts";

export const normalizeSitePrefix = (value?: string) => {
  const raw = (value ?? "").trim();
  if (!raw || raw === "/") return "";
  const noTrail = raw.replace(/\/+$/g, "");
  return noTrail.startsWith("/") ? noTrail : `/${noTrail}`;
};

export const joinSitePrefix = (prefix: string, path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!prefix) return normalized;
  return `${prefix}${normalized}`;
};

export type SitePrefixHelpers = {
  readonly sitePrefix: string;
  readonly applySitePrefix: (path: string) => string;
  readonly safeHttpOpts: { readonly sitePrefix: string };
  readonly mountWithSitePrefix: <
    State extends Record<string, unknown>,
    Vars extends Record<string, unknown>,
  >(
    app: Application<State, Vars>,
  ) => Application<State, Vars>;
};

export const sitePrefixAide = (
  value?: string,
): SitePrefixHelpers => {
  const sitePrefix = normalizeSitePrefix(value);
  const applySitePrefix = (path: string) => joinSitePrefix(sitePrefix, path);

  const mountWithSitePrefix = <
    State extends Record<string, unknown>,
    Vars extends Record<string, unknown>,
  >(
    app: Application<State, Vars>,
  ): Application<State, Vars> => {
    if (!sitePrefix) return app;
    const host = Application.sharedState<State, Vars>({} as State);
    host.mount(sitePrefix, app);
    return host;
  };

  return {
    sitePrefix,
    applySitePrefix,
    safeHttpOpts: { sitePrefix },
    mountWithSitePrefix,
  };
};
