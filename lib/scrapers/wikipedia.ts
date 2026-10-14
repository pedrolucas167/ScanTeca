import { checkDomainRateLimit, extractDomain } from "../rate-limit";

export interface WikipediaArticle {
  title: string;
  content: string;
  url: string;
  extractedAt: number;
  sections?: WikipediaSection[];
  categories?: string[];
  references?: string[];
}

export interface WikipediaSection {
  level: number;
  title: string;
  content: string;
}

export class WikipediaScraper {
  private readonly baseUrl = "https://en.wikipedia.org/api/rest_v1";

  async scrapeArticle(title: string): Promise<WikipediaArticle> {
    const url = `${this.baseUrl}/page/summary/${encodeURIComponent(title)}`;
    
    // Check rate limit before making request
    const domain = extractDomain(url);
    const rateLimitCheck = await checkDomainRateLimit(domain);
    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded for ${domain}. Retry after ${rateLimitCheck.retryAfter}s`
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "ScanTeca/1.0 (https://scanteca.com; research@scanteca.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      title: data.title || title,
      content: data.extract || "",
      url: data.content_urls?.desktop?.page || url,
      extractedAt: Date.now(),
      sections: this.parseSections(data.extract || ""),
      categories: this.extractCategories(data),
      references: this.extractReferences(data),
    };
  }

  async searchArticles(query: string, limit = 5): Promise<WikipediaArticle[]> {
    const url = `${this.baseUrl}/page/search/${encodeURIComponent(query)}?limit=${limit}`;
    
    const domain = extractDomain(url);
    const rateLimitCheck = await checkDomainRateLimit(domain);
    if (!rateLimitCheck.allowed) {
      throw new Error(
        `Rate limit exceeded for ${domain}. Retry after ${rateLimitCheck.retryAfter}s`
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "ScanTeca/1.0 (https://scanteca.com; research@scanteca.com)",
      },
    });

    if (!response.ok) {
      throw new Error(`Wikipedia search error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.pages || !Array.isArray(data.pages)) {
      return [];
    }

    // Fetch full articles for top results
    const articles: WikipediaArticle[] = [];
    for (const page of data.pages.slice(0, limit)) {
      try {
        const article = await this.scrapeArticle(page.title);
        articles.push(article);
      } catch (error) {
        console.error(`Failed to scrape article ${page.title}:`, error);
      }
    }

    return articles;
  }

  private parseSections(extract: string): WikipediaSection[] {
    const sections: WikipediaSection[] = [];
    const lines = extract.split("\n");
    let currentSection: WikipediaSection | null = null;

    for (const line of lines) {
      // Detect headings (Wikipedia uses === for headings in extract)
      const headingMatch = line.match(/^(={2,})\s*(.+?)\s*\1$/);
      if (headingMatch && headingMatch[1] && headingMatch[2]) {
        if (currentSection) {
          sections.push(currentSection);
        }
        const level = headingMatch[1].length - 2; // === is level 1
        currentSection = {
          level: Math.min(level, 3), // Cap at level 3
          title: headingMatch[2].trim(),
          content: "",
        };
      } else if (currentSection) {
        currentSection.content += line + "\n";
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  private extractCategories(_data: any): string[] {
    // Wikipedia API doesn't always return categories in summary
    // This is a placeholder for future enhancement
    return [];
  }

  private extractReferences(data: any): string[] {
    const references: string[] = [];
    
    if (data.content_urls?.desktop) {
      if (data.content_urls.desktop.page) {
        references.push(data.content_urls.desktop.page);
      }
      if (data.content_urls.desktop.revision) {
        references.push(data.content_urls.desktop.revision);
      }
    }

    return references;
  }
}

export const wikipediaScraper = new WikipediaScraper();
