// placard-ocr — Apple Vision text recognition over a directory of gallery photos.
//
// This is the A0 workhorse: it turns a take of label photographs into NDJSON that
// the fixture set is built from. It is deliberately a Mac CLI rather than part of
// the app — §11 A0 collects the corpus with a stock camera, and the corpus has to
// be processable before any app exists.
//
// The recognition pipeline itself is not in this file. It is OCRCore.swift, in
// apps/learner/modules/vision-ocr/ios/, shared with the phone so the two cannot
// drift (D3). This file is only what a Mac CLI needs around it: EXIF timestamp and
// GPS, which are what let a take be segmented into venues without hand-sorting
// (see docs/capture-protocol.md), directory walking, and NDJSON output.
//
// Build:  ./tools/ocr/build.sh
// Usage:  placard-ocr <file-or-directory> [--lang en-US,ja-JP] [--fast]

import Foundation
import ImageIO
import CoreLocation

// MARK: - Output shape

struct PhotoResult: Codable {
    let path: String
    let filename: String
    let capturedAt: String?
    let latitude: Double?
    let longitude: Double?
    let pixelWidth: Int?
    let pixelHeight: Int?
    let observations: [Observation]
    /// Observations joined top-to-bottom — the reading order a label is written in.
    let text: String
    /// The same, with confusable punctuation folded to ASCII. **Match against this.**
    let normalizedText: String
    /// Per-photo problems worth a human looking at, e.g. clipped lines.
    let warnings: [String]
    let error: String?

    // Swift's synthesized encoder uses encodeIfPresent for optionals, so a nil field
    // vanishes from the JSON entirely rather than appearing as null. That makes every
    // downstream reader guess whether "no GPS" means absent or unparsed, so encode
    // explicitly and let nil become null.
    enum CodingKeys: String, CodingKey {
        case path, filename, capturedAt, latitude, longitude
        case pixelWidth, pixelHeight, observations, text, normalizedText, warnings, error
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(path, forKey: .path)
        try c.encode(filename, forKey: .filename)
        try c.encode(capturedAt, forKey: .capturedAt)
        try c.encode(latitude, forKey: .latitude)
        try c.encode(longitude, forKey: .longitude)
        try c.encode(pixelWidth, forKey: .pixelWidth)
        try c.encode(pixelHeight, forKey: .pixelHeight)
        try c.encode(observations, forKey: .observations)
        try c.encode(text, forKey: .text)
        try c.encode(normalizedText, forKey: .normalizedText)
        try c.encode(warnings, forKey: .warnings)
        try c.encode(error, forKey: .error)
    }
}

// MARK: - EXIF

struct ExifInfo {
    var capturedAt: String?
    var latitude: Double?
    var longitude: Double?
    var pixelWidth: Int?
    var pixelHeight: Int?
}

func readExif(_ url: URL) -> ExifInfo {
    var info = ExifInfo()
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]
    else { return info }

    info.pixelWidth  = props[kCGImagePropertyPixelWidth]  as? Int
    info.pixelHeight = props[kCGImagePropertyPixelHeight] as? Int

    if let exif = props[kCGImagePropertyExifDictionary] as? [CFString: Any],
       let original = exif[kCGImagePropertyExifDateTimeOriginal] as? String {
        // EXIF is "2026:09:16 14:33:07" — normalize toward ISO 8601.
        let parts = original.split(separator: " ", maxSplits: 1)
        if parts.count == 2 {
            info.capturedAt = parts[0].replacingOccurrences(of: ":", with: "-") + "T" + parts[1]
        } else {
            info.capturedAt = original
        }
    }

    if let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any] {
        if let lat = gps[kCGImagePropertyGPSLatitude] as? Double,
           let ref = gps[kCGImagePropertyGPSLatitudeRef] as? String {
            info.latitude = (ref == "S") ? -lat : lat
        }
        if let lon = gps[kCGImagePropertyGPSLongitude] as? Double,
           let ref = gps[kCGImagePropertyGPSLongitudeRef] as? String {
            info.longitude = (ref == "W") ? -lon : lon
        }
    }
    return info
}

// MARK: - Driver

let imageExtensions: Set<String> = ["heic", "heif", "jpg", "jpeg", "png", "tif", "tiff"]

func collectImages(_ root: URL) -> [URL] {
    var out: [URL] = []
    let fm = FileManager.default
    var isDir: ObjCBool = false
    guard fm.fileExists(atPath: root.path, isDirectory: &isDir) else { return [] }

    if !isDir.boolValue {
        if imageExtensions.contains(root.pathExtension.lowercased()) { out.append(root) }
        return out
    }
    guard let e = fm.enumerator(at: root, includingPropertiesForKeys: nil) else { return [] }
    for case let url as URL in e where imageExtensions.contains(url.pathExtension.lowercased()) {
        out.append(url)
    }
    return out.sorted { $0.path < $1.path }
}

var args = Array(CommandLine.arguments.dropFirst())
var languages = ["en-US"]
var fast = false
/// Recognition runs at each of these scales and the readings are cross-checked.
/// See `recognize` in OCRCore.swift for why a single pass is not enough.
var scales: [Double] = [1.0, 1.6, 2.4]
var inputs: [String] = []

var i = 0
while i < args.count {
    switch args[i] {
    case "--lang":
        i += 1
        if i < args.count { languages = args[i].split(separator: ",").map(String.init) }
    case "--fast":
        fast = true
    case "--single-pass":
        scales = [1.0]
    case "--scales":
        i += 1
        if i < args.count {
            let parsed = args[i].split(separator: ",").compactMap { Double($0) }
            if !parsed.isEmpty { scales = parsed }
        }
    case "-h", "--help":
        print("""
        placard-ocr — Apple Vision OCR over gallery photographs

        USAGE
          placard-ocr <file-or-directory> [--lang en-US,ja-JP] [--fast]
                       [--scales 1.0,1.6,2.4] [--single-pass]

        Recognition runs at several scales by default and flags lines the scales
        disagree about. A single pass is not reliable for accession numbers.

        OUTPUT
          NDJSON on stdout, one object per image. Progress on stderr.

        EXAMPLES
          placard-ocr data/labels/raw/2026-09-16-moma > take.ndjson
          placard-ocr photo.heic --lang en-US,zh-Hans
        """)
        exit(0)
    default:
        inputs.append(args[i])
    }
    i += 1
}

guard !inputs.isEmpty else {
    FileHandle.standardError.write("placard-ocr: no input. Try --help.\n".data(using: .utf8)!)
    exit(2)
}

let files = inputs.flatMap { collectImages(URL(fileURLWithPath: $0)) }
guard !files.isEmpty else {
    FileHandle.standardError.write("placard-ocr: no images found.\n".data(using: .utf8)!)
    exit(1)
}

FileHandle.standardError.write("placard-ocr: \(files.count) image(s), languages \(languages.joined(separator: ","))\n".data(using: .utf8)!)

let encoder = JSONEncoder()
encoder.outputFormatting = [.withoutEscapingSlashes]

for (n, url) in files.enumerated() {
    let exif = readExif(url)
    var observations: [Observation] = []
    var errorText: String? = nil
    do {
        observations = try recognize(url, languages: languages, fast: fast, scales: scales)
    } catch {
        errorText = "\(error)"
    }

    var warnings = qualityWarnings(observations)
    if exif.latitude == nil { warnings.append("no GPS — venue cannot be inferred from this file") }
    if exif.capturedAt == nil { warnings.append("no capture timestamp — cannot be ordered into a take") }

    let result = PhotoResult(
        path: url.path,
        filename: url.lastPathComponent,
        capturedAt: exif.capturedAt,
        latitude: exif.latitude,
        longitude: exif.longitude,
        pixelWidth: exif.pixelWidth,
        pixelHeight: exif.pixelHeight,
        observations: observations,
        text: observations.map(\.text).joined(separator: "\n"),
        normalizedText: observations.map(\.normalizedText).joined(separator: "\n"),
        warnings: warnings,
        error: errorText
    )

    if let data = try? encoder.encode(result), let line = String(data: data, encoding: .utf8) {
        print(line)
    }
    let clippedCount = observations.filter { !$0.clipped.isEmpty }.count
    let normalizedCount = observations.filter { $0.wasNormalized }.count
    let contestedCount = observations.filter { $0.contested }.count
    var note = "  [\(n + 1)/\(files.count)] \(url.lastPathComponent) — \(observations.count) line(s)"
    if clippedCount > 0 { note += ", \(clippedCount) CLIPPED" }
    if normalizedCount > 0 { note += ", \(normalizedCount) NORMALIZED" }
    if contestedCount > 0 { note += ", \(contestedCount) CONTESTED" }
    if let e = errorText { note += " ERROR: \(e)" }
    FileHandle.standardError.write((note + "\n").data(using: .utf8)!)
}
