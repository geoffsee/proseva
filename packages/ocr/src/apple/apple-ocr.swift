import Foundation
import Vision
import PDFKit

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: apple-ocr <file.pdf> [--level accurate|fast]\n", stderr)
    exit(1)
}

let path = CommandLine.arguments[1]
let level: VNRequestTextRecognitionLevel = CommandLine.arguments.contains("--fast")
    ? .fast : .accurate

guard let doc = PDFDocument(url: URL(fileURLWithPath: path)) else {
    fputs("Failed to open PDF: \(path)\n", stderr)
    exit(1)
}

let dpi: CGFloat = 300
let scale = dpi / 72.0

for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let width = Int(bounds.width * scale)
    let height = Int(bounds.height * scale)

    // Render PDF page to CGImage
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(
        data: nil, width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        fputs("Failed to create context for page \(i+1)\n", stderr)
        continue
    }

    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    ctx.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: ctx)

    guard let cgImage = ctx.makeImage() else {
        fputs("Failed to render page \(i+1)\n", stderr)
        continue
    }

    print("\n=== Page \(i+1) ===")

    // Run Vision OCR
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = level
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-US"]

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        fputs("OCR failed on page \(i+1): \(error)\n", stderr)
        continue
    }

    guard let observations = request.results else { continue }

    for obs in observations {
        if let top = obs.topCandidates(1).first {
            print(top.string)
        }
    }
}
