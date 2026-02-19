import { render, screen } from "../../../test-utils";
import { describe, it, expect, vi } from "vitest";
import { TemplateForm } from "./index";
import type { DocumentTemplate } from "../../../types";

const template: DocumentTemplate = {
  id: "1",
  name: "Test Template",
  category: "Test",
  fields: [
    { name: "field1", label: "Field One", type: "text", required: true },
  ],
  outputFormat: "{{field1}}",
};

describe("TemplateForm", () => {
  it("renders template name", () => {
    render(
      <TemplateForm
        template={template}
        fieldValues={{}}
        onFieldChange={vi.fn()}
        onBack={vi.fn()}
        onPreview={vi.fn()}
      />,
    );
    expect(screen.getByText("Test Template")).toBeInTheDocument();
  });

  it("renders fields", () => {
    render(
      <TemplateForm
        template={template}
        fieldValues={{}}
        onFieldChange={vi.fn()}
        onBack={vi.fn()}
        onPreview={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Field One *")[0]).toBeInTheDocument();
  });
});
