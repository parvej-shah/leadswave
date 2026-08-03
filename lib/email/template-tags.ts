/**
 * Utility functions for replacing template tags (merge tags) and deduplicating signatures.
 */

export type MergeTagData = {
  firstname?: string | null;
  companyname?: string | null;
  website?: string | null;
  category?: string | null;
};

/**
 * Replaces all variations of template tags in email subject lines or body text.
 * Tags supported:
 * - {{firstname}}, {{first_name}}, {{firstName}}, {{name}}
 * - {{companyname}}, {{company_name}}, {{companyName}}, {{company}}
 * - {{website}}, {{site}}, {{url}}
 * - {{category}}, {{niche}}, {{industry}}
 */
export function replaceMergeTags(template: string, data: MergeTagData): string {
  if (!template) return "";

  const firstname = (data.firstname?.trim() || data.companyname?.trim()?.split(" ")[0] || "there").trim();
  const companyname = (data.companyname?.trim() || "your company").trim();
  const website = (data.website?.trim() || "").trim();
  const category = (data.category?.trim() || "services").trim();

  return template
    .replace(/{{\s*(firstname|first_name|firstName|name)\s*}}/gi, firstname)
    .replace(/{{\s*(companyname|company_name|companyName|company)\s*}}/gi, companyname)
    .replace(/{{\s*(website|site|url)\s*}}/gi, website)
    .replace(/{{\s*(category|niche|industry)\s*}}/gi, category);
}

/**
 * Detects and strips manual inline sign-offs (e.g. "Best Regards\nRakib\nFounder...")
 * from the end of draft body copy before a system signature is appended, preventing double signatures.
 */
export function stripInlineSignoff(bodyText: string): string {
  if (!bodyText) return "";

  // Common sign-off patterns at the end of email copy
  const signoffRegex = /\n\s*(?:best\s+regards|regards|kind\s+regards|best|thanks|thank\s+you|sincerely|cheers|yours\s+truly)\b[\s\S]*$/i;

  // Only strip if the sign-off occurs in the bottom 40% of the text
  const match = bodyText.match(signoffRegex);
  if (match && match.index != null && match.index > bodyText.length * 0.4) {
    return bodyText.slice(0, match.index).trimEnd();
  }

  return bodyText.trimEnd();
}
