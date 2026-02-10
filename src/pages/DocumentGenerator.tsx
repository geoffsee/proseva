import { useState, useMemo } from "react";
import { TemplateSelector } from "../components/documents/TemplateSelector";
import { TemplateForm } from "../components/documents/TemplateForm";
import { DocumentPreview } from "../components/documents/DocumentPreview";
import type { DocumentTemplate } from "../types";

type Step = "select" | "fill" | "preview";

export default function DocumentGenerator() {
  const [step, setStep] = useState<Step>("select");
  const [selectedTemplate, setSelectedTemplate] =
    useState<DocumentTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const generatedDoc = useMemo(() => {
    if (!selectedTemplate) return "";
    let output = selectedTemplate.outputFormat;
    for (const field of selectedTemplate.fields) {
      const re = new RegExp(`\\{\\{${field.name}\\}\\}`, "g");
      output = output.replace(
        re,
        fieldValues[field.name] ?? `[${field.label}]`,
      );
    }
    return output;
  }, [selectedTemplate, fieldValues]);

  const handleSelect = (t: DocumentTemplate) => {
    setSelectedTemplate(t);
    setFieldValues({});
    setStep("fill");
  };

  if (step === "preview" && selectedTemplate) {
    return (
      <DocumentPreview
        name={selectedTemplate.name}
        content={generatedDoc}
        onBack={() => setStep("fill")}
      />
    );
  }

  if (step === "fill" && selectedTemplate) {
    return (
      <TemplateForm
        template={selectedTemplate}
        fieldValues={fieldValues}
        onFieldChange={(name, value) =>
          setFieldValues({ ...fieldValues, [name]: value })
        }
        onBack={() => {
          setStep("select");
          setSelectedTemplate(null);
        }}
        onPreview={() => setStep("preview")}
      />
    );
  }

  return <TemplateSelector onSelect={handleSelect} />;
}
