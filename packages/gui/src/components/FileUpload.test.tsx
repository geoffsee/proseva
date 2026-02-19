import { render, screen, fireEvent, waitFor } from "../test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FileUpload from "./FileUpload";
import * as apiModule from "../lib/api";

function createFile(name: string, size = 1024, type = "application/pdf"): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe("FileUpload", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders drop zone and file input", () => {
    render(<FileUpload />);
    expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
    expect(screen.getByTestId("file-input")).toBeInTheDocument();
    expect(screen.getByText("Browse Files")).toBeInTheDocument();
  });

  it("selecting files displays file list with names and sizes", async () => {
    render(<FileUpload />);
    const input = screen.getByTestId("file-input");
    const file1 = createFile("doc1.pdf", 2048);
    const file2 = createFile("doc2.pdf", 1048576);

    fireEvent.change(input, { target: { files: [file1, file2] } });

    expect(screen.getByText("doc1.pdf")).toBeInTheDocument();
    expect(screen.getByText("doc2.pdf")).toBeInTheDocument();
    expect(screen.getByText("(2.0 KB)")).toBeInTheDocument();
    expect(screen.getByText("(1.0 MB)")).toBeInTheDocument();
  });

  it("removing a file from the list works", () => {
    render(<FileUpload />);
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, {
      target: { files: [createFile("doc1.pdf"), createFile("doc2.pdf")] },
    });

    expect(screen.getByText("doc1.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Remove doc1.pdf"));
    expect(screen.queryByText("doc1.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("doc2.pdf")).toBeInTheDocument();
  });

  it("clicking upload sends FormData with correct files to endpoint", async () => {
    const onComplete = vi.fn();
    const uploadSpy = vi
      .spyOn(apiModule.api.documents, "upload")
      .mockResolvedValue({} as any);

    render(<FileUpload onUploadComplete={onComplete} />);
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [createFile("doc1.pdf")] } });

    fireEvent.click(screen.getByText("Upload 1 file"));

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalled();
    });

    const formData = uploadSpy.mock.calls[0][0];
    expect(formData.get("category")).toBe("_new_filings");
    expect(formData.get("files")).toBeInstanceOf(File);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it("shows loading state during upload", async () => {
    let resolveUpload: (v: any) => void;
    vi.spyOn(apiModule.api.documents, "upload").mockReturnValue(
      new Promise((r) => {
        resolveUpload = r;
      }),
    );

    render(<FileUpload />);
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [createFile("doc.pdf")] },
    });
    fireEvent.click(screen.getByText("Upload 1 file"));

    expect(screen.getByText("Uploading…")).toBeInTheDocument();

    resolveUpload!({} as any);
    await waitFor(() => {
      expect(screen.queryByText("Uploading…")).not.toBeInTheDocument();
    });
  });

  it("shows error message on upload failure", async () => {
    vi.spyOn(apiModule.api.documents, "upload").mockRejectedValue(
      new Error("Server error"),
    );

    render(<FileUpload />);
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [createFile("doc.pdf")] },
    });
    fireEvent.click(screen.getByText("Upload 1 file"));

    await waitFor(() => {
      expect(screen.getByTestId("upload-error")).toHaveTextContent(
        "Server error",
      );
    });
  });

  it("calls onUploadComplete callback on success", async () => {
    const onComplete = vi.fn();
    vi.spyOn(apiModule.api.documents, "upload").mockResolvedValue({} as any);

    render(<FileUpload onUploadComplete={onComplete} />);
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [createFile("doc.pdf")] },
    });
    fireEvent.click(screen.getByText("Upload 1 file"));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
  });

  it("rejects non-PDF files", () => {
    render(<FileUpload />);
    const input = screen.getByTestId("file-input");
    const txtFile = createFile("notes.txt", 1024, "text/plain");
    Object.defineProperty(txtFile, "name", { value: "notes.txt" });

    fireEvent.change(input, { target: { files: [txtFile] } });

    expect(screen.getByTestId("upload-error")).toHaveTextContent(
      "Only PDF files are accepted.",
    );
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("sends Authorization header with upload request", async () => {
    const uploadSpy = vi
      .spyOn(apiModule.api.documents, "upload")
      .mockResolvedValue({} as any);

    render(<FileUpload />);
    const input = screen.getByTestId("file-input");
    fireEvent.change(input, { target: { files: [createFile("doc1.pdf")] } });
    fireEvent.click(screen.getByText("Upload 1 file"));

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalled();
    });
    // The SDK handles auth headers internally via getAuthToken callback
  });

  it("shows default categories in the dropdown", () => {
    render(<FileUpload />);
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [createFile("doc.pdf")] },
    });

    const select = screen.getByTestId("category-select");
    const options = Array.from(select.querySelectorAll("option")).map(
      (o) => o.value,
    );

    expect(options).toContain("_new_filings");
    expect(options).toContain("Motions");
    expect(options).toContain("Orders");
    expect(options).toContain("Evidence");
    expect(options).toContain("Financial Records");
    expect(options).toContain("Discovery");
  });

  it("merges existing categories with defaults", () => {
    render(<FileUpload categories={["Custom Category", "Motions"]} />);
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [createFile("doc.pdf")] },
    });

    const select = screen.getByTestId("category-select");
    const options = Array.from(select.querySelectorAll("option")).map(
      (o) => o.value,
    );

    expect(options).toContain("Custom Category");
    expect(options).toContain("Motions");
    expect(options).toContain("Orders");
    // No duplicates
    expect(options.filter((o) => o === "Motions")).toHaveLength(1);
  });

  it("sends selected category in upload FormData", async () => {
    const uploadSpy = vi
      .spyOn(apiModule.api.documents, "upload")
      .mockResolvedValue({} as any);

    render(<FileUpload />);
    fireEvent.change(screen.getByTestId("file-input"), {
      target: { files: [createFile("doc.pdf")] },
    });

    const select = screen.getByTestId("category-select");
    fireEvent.change(select, { target: { value: "Evidence" } });
    fireEvent.click(screen.getByText("Upload 1 file"));

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalled();
    });

    const formData = uploadSpy.mock.calls[0][0];
    expect(formData.get("category")).toBe("Evidence");
  });
});
