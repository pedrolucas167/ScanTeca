export const analyticsCookie = "scanteca_analytics";
export const analyticsPreferenceAge = 180 * 24 * 60 * 60;
export const analyticsChoices = { accepted: "v1-accepted", rejected: "v1-rejected" } as const;

export type AnalyticsPreference = keyof typeof analyticsChoices | null;

export function parseAnalyticsPreference(value?: string): AnalyticsPreference {
  if (value === analyticsChoices.accepted) return "accepted";
  if (value === analyticsChoices.rejected) return "rejected";
  return null;
}

export function browserAnalyticsPreference(): AnalyticsPreference {
  const prefix = `${analyticsCookie}=`;
  const cookie = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
  return parseAnalyticsPreference(cookie?.slice(prefix.length));
}

export const analyticsPages = ["home", "manifesto", "feed"] as const;
export const analyticsVitals = ["CLS", "FCP", "INP", "LCP", "TTFB"] as const;
export const analyticsRatings = ["good", "needs-improvement", "poor"] as const;

export function analyticsPage(pathname: string) {
  switch (pathname) {
    case "/": return "home";
    case "/manifesto": return "manifesto";
    case "/feed": return "feed";
    default: return null;
  }
}
