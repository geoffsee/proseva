import type OpenAI from "openai";
import type { CitationStyle } from "./citationFormatter";
import { getConfig } from "../src/config";

export type DocumentTemplate =
  | "memorandum"
  | "case_brief"
  | "motion"
  | "research_summary"
  | "client_letter"
  | "discovery_summary";

export interface GenerationOptions {
  citationStyle?: CitationStyle;
  includeSummaries?: boolean;
  includeStatutes?: boolean;
  includeCases?: boolean;
  includeDocuments?: boolean;
  customSections?: string[];
  attorneyName?: string;
  clientName?: string;
  courtName?: string;
  motionType?: string;
}

export class LegalDocumentGenerator {
  private openai: OpenAI;
  private caseData: any;
  private template: DocumentTemplate;

  constructor(openai: OpenAI, caseData: any, template: DocumentTemplate) {
    this.openai = openai;
    this.caseData = caseData;
    this.template = template;
  }

  async generate(options: GenerationOptions): Promise<string> {
    const prompt = this.buildPrompt(options);
    const message = await this.openai.chat.completions.create({
      model: getConfig("TEXT_MODEL_SMALL") || "gpt-4o-mini",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    return message.choices[0]?.message?.content || "";
  }

  calculateMetadata(content: string) {
    return {
      wordCount: content.split(/\s+/).length,
      characterCount: content.length,
      template: this.template,
      caseName: this.caseData.name,
    };
  }

  private buildPrompt(options: GenerationOptions): string {
    const parts = [
      `Generate a legal ${this.template.replace(/_/g, " ")} document.`,
      `Case: ${this.caseData.name}`,
      `Citation style: ${options.citationStyle || "bluebook"}`,
    ];

    if (options.attorneyName) parts.push(`Attorney: ${options.attorneyName}`);
    if (options.clientName) parts.push(`Client: ${options.clientName}`);
    if (options.courtName) parts.push(`Court: ${options.courtName}`);
    if (options.motionType) parts.push(`Motion type: ${options.motionType}`);

    if (this.caseData.contextItems?.length) {
      parts.push(
        "\nResearch context:",
        ...this.caseData.contextItems
          .slice(0, 10)
          .map((item: any) => `- ${item.title || item.id}`),
      );
    }

    return parts.join("\n");
  }
}
