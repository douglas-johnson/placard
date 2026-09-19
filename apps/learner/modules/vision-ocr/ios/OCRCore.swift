// OCRCore — the Apple Vision text-recognition pipeline Placard uses everywhere.
//
// This one file is compiled into two hosts:
//
//   - the Mac CLI in tools/ocr/, which processes the A0 corpus (D3)
//   - the VisionOcr Expo module, which runs on the phone (§4.4)
//
// It lives here, in the app module, because CocoaPods needs a pod's sources under the
// podspec's own directory, while `swiftc` will happily compile a file from anywhere.
// The CLI's build.sh reaches over to this path. The point of sharing rather than
// porting is that every lesson the corpus taught — D9, D14, D19, D21, D27 — is
// embodied in this code, and a second copy would silently stop learning them.
//
// Nothing in here depends on Foundation beyond what iOS and macOS both have. Keep it
// that way: no AppKit, no UIKit, no ExpoModulesCore.

import Foundation
import Vision
import ImageIO

// MARK: - Output shape

struct Observation: Codable {
    let text: String
    let confidence: Float
    /// Normalized, origin bottom-left, as Vision reports it.
    let box: [Double]   // [x, y, width, height]
    /// Distinct readings of this line across the scales tried. One entry means every
    /// pass agreed.
    let variants: [String]
    /// True when the scales disagreed — treat the text as unconfirmed.
    let contested: Bool
    /// `text` with confusable punctuation folded to ASCII. See `confusableMap`.
    let normalizedText: String
    /// True when normalization actually changed something — i.e. Vision returned at
    /// least one character that looks like ASCII punctuation but isn't.
    let wasNormalized: Bool
    /// Which frame edges this line's box runs into: "L", "R", "T", "B".
    ///
    /// This exists because **Vision's confidence does not detect truncation.** A line
    /// clipped by the edge of the photo comes back at 1.00 with a plausible-looking
    /// result — "these" reads as "hese", "vulnerabilities" as "/ulnerabilities". The
    /// glyphs it could see, it read perfectly; it has no opinion about the ones outside
    /// the frame. So confidence cannot be a correctness gate (§4.7), and the geometry
    /// has to do that job instead.
    let clipped: [String]
}

/// A box within this much of a frame edge counts as running into it. Vision reports
/// normalized coordinates that land a hair outside 0...1, hence the tolerance.
let edgeTolerance = 0.01

// MARK: - Normalization

/// Characters Vision returns that *look* like ordinary ASCII punctuation but aren't.
///
/// This matters far more than it sounds. On an MCNY label the accession `38.447.4`
/// came back as `38.447•4` — the third separator read as U+2022 BULLET, at 1.00
/// confidence, on a line no edge had clipped. Neither of the quality signals this tool
/// has would ever catch it, and the result is that §4.3's primary key silently stops
/// matching anything in the institution's catalog.
///
/// The general problem: OCR output is *Unicode*, and a glyph rendered in a serif face
/// at small size can resolve to any of a dozen near-identical codepoints. Anything that
/// gets pattern-matched — accession numbers above all — has to be folded to a
/// restricted character set first.
let confusableMap: [Character: Character] = [
    // dot-like
    "\u{2022}": ".",   // BULLET
    "\u{00B7}": ".",   // MIDDLE DOT
    "\u{2027}": ".",   // HYPHENATION POINT
    "\u{22C5}": ".",   // DOT OPERATOR
    "\u{30FB}": ".",   // KATAKANA MIDDLE DOT
    "\u{FF0E}": ".",   // FULLWIDTH FULL STOP
    "\u{2219}": ".",   // BULLET OPERATOR
    // dash-like — an en dash in a date range is meaningful, but a figure dash or
    // non-breaking hyphen inside an accession number is noise.
    "\u{2010}": "-",   // HYPHEN
    "\u{2011}": "-",   // NON-BREAKING HYPHEN
    "\u{2012}": "-",   // FIGURE DASH
    "\u{2212}": "-",   // MINUS SIGN
    "\u{FF0D}": "-",   // FULLWIDTH HYPHEN-MINUS
    // quote-like
    "\u{2018}": "'", "\u{2019}": "'", "\u{201C}": "\"", "\u{201D}": "\"",
    "\u{02BC}": "'",
    // space-like
    "\u{00A0}": " ", "\u{2007}": " ", "\u{202F}": " ",
]

/// Letters from other scripts that are visually identical to Latin ones.
///
/// Vision returned `СТY` for `CITY` on an English sign with `en-US` as the only
/// recognition language — Cyrillic ES and TE, U+0421 and U+0422. Same failure as the
/// bullet in D14, one character class up, and the stakes are the same: a Cyrillic Х in
/// `X2011.4.10368.168` is invisible to a human reader and matches nothing.
let homoglyphMap: [Character: Character] = [
    // Cyrillic uppercase
    "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H", "І": "I", "Ј": "J", "К": "K",
    "М": "M", "О": "O", "Р": "P", "Ѕ": "S", "Т": "T", "Х": "X", "У": "Y",
    // Cyrillic lowercase
    "а": "a", "с": "c", "е": "e", "і": "i", "ј": "j", "о": "o", "р": "p", "ѕ": "s",
    "х": "x", "у": "y",
    // Greek uppercase
    "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M",
    "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Υ": "Y", "Χ": "X",
    // Greek lowercase
    "ο": "o", "ν": "v",
]

/// Folds confusables to ASCII.
///
/// Punctuation folds unconditionally. Letters fold only inside a token that already
/// contains ASCII alphanumerics, so a genuinely Cyrillic or Greek word on a
/// multilingual label — which New York labels have (D16) — passes through untouched,
/// while `СТY` and a Cyrillic Х inside an accession number do not.
func normalize(_ text: String) -> String {
    let punctuationFolded = String(text.map { confusableMap[$0] ?? $0 })
    return punctuationFolded
        .split(separator: " ", omittingEmptySubsequences: false)
        .map { token -> String in
            let hasASCII = token.contains { $0.isASCII && ($0.isLetter || $0.isNumber) }
            let hasHomoglyph = token.contains { homoglyphMap[$0] != nil }
            guard hasASCII && hasHomoglyph else { return String(token) }
            return String(token.map { homoglyphMap[$0] ?? $0 })
        }
        .joined(separator: " ")
}

// MARK: - Image loading

/// The EXIF orientation of an image file, defaulting to `.up`. Phone cameras store
/// the sensor frame and an orientation tag rather than rotating pixels, and Vision
/// has to be told which way is up or the reading order is nonsense.
func readOrientation(_ url: URL) -> CGImagePropertyOrientation {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any],
          let raw = props[kCGImagePropertyOrientation] as? UInt32
    else { return .up }
    return CGImagePropertyOrientation(rawValue: raw) ?? .up
}

/// Scales the image by `factor`, returning nil if that isn't possible.
func scaled(_ image: CGImage, by factor: Double) -> CGImage? {
    if factor == 1.0 { return image }
    let w = Int(Double(image.width) * factor), h = Int(Double(image.height) * factor)
    guard w > 0, h > 0, w < 20000, h < 20000,
          let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                              bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { return nil }
    ctx.interpolationQuality = .high
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
    return ctx.makeImage()
}

// MARK: - Recognition

struct RawLine {
    let text: String
    let confidence: Float
    let box: CGRect
}

func recognizeOnce(_ image: CGImage, orientation: CGImagePropertyOrientation,
                   languages: [String], fast: Bool) throws -> [RawLine] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = fast ? .fast : .accurate
    request.recognitionLanguages = languages
    // Off by default: language correction "fixes" artist names and accession
    // numbers into ordinary English words, which is precisely wrong here.
    request.usesLanguageCorrection = false

    let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
    try handler.perform([request])

    return (request.results ?? []).compactMap { obs in
        guard let top = obs.topCandidates(1).first else { return nil }
        return RawLine(text: top.string, confidence: top.confidence, box: obs.boundingBox)
    }
}

/// Runs recognition at several scales and cross-checks the results.
///
/// This exists because a single pass cannot be trusted with the primary key. On one
/// MCNY label the accession `X2011.4.10368.168` read three different ways at three
/// scales — each dropping a *different* separator, none of them flagged by confidence
/// or geometry (§4.3, D14, D21). Shooting closer doesn't fix it; past a sweet spot the
/// reading degrades again.
///
/// It is the same move the project already makes elsewhere: a claim corroborated by
/// independent observations is stronger than one asserted once (§5, §8.2). Here the
/// independent observers are the same recognizer at different resolutions.
func recognize(_ base: CGImage, orientation: CGImagePropertyOrientation,
               languages: [String], fast: Bool, scales: [Double]) throws -> [Observation] {
    var passes: [[RawLine]] = []
    for factor in scales {
        guard let img = scaled(base, by: factor) else { continue }
        passes.append(try recognizeOnce(img, orientation: orientation,
                                        languages: languages, fast: fast))
    }
    guard let reference = passes.first else { return [] }

    return reference.map { line in
        // Match this line in the other passes by box-centre proximity. Normalized
        // coordinates make centres comparable across scales.
        let centre = CGPoint(x: line.box.midX, y: line.box.midY)
        var readings = [line.text]
        for pass in passes.dropFirst() {
            let nearest = pass.min { a, b in
                hypot(a.box.midX - centre.x, a.box.midY - centre.y)
                    < hypot(b.box.midX - centre.x, b.box.midY - centre.y)
            }
            if let n = nearest,
               hypot(n.box.midX - centre.x, n.box.midY - centre.y) < 0.02 {
                readings.append(n.text)
            }
        }
        var distinct: [String] = []
        for r in readings where !distinct.contains(r) { distinct.append(r) }

        let b = line.box
        var clipped: [String] = []
        if b.origin.x <= edgeTolerance { clipped.append("L") }
        if b.origin.x + b.size.width >= 1.0 - edgeTolerance { clipped.append("R") }
        if b.origin.y + b.size.height >= 1.0 - edgeTolerance { clipped.append("T") }
        if b.origin.y <= edgeTolerance { clipped.append("B") }

        let normalized = normalize(line.text)
        return Observation(
            text: line.text,
            confidence: line.confidence,
            box: [b.origin.x, b.origin.y, b.size.width, b.size.height],
            variants: distinct,
            contested: distinct.count > 1,
            normalizedText: normalized,
            wasNormalized: normalized != line.text,
            clipped: clipped
        )
    }
}

/// The file-based entry point both hosts actually call: loads the image, reads its
/// orientation, recognizes, and returns lines in reading order.
func recognize(_ url: URL, languages: [String], fast: Bool, scales: [Double]) throws -> [Observation] {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let base = CGImageSourceCreateImageAtIndex(src, 0, nil)
    else { return [] }
    return readingOrder(try recognize(base, orientation: readOrientation(url),
                                      languages: languages, fast: fast, scales: scales))
}

/// Vision returns observations in no guaranteed order. A tombstone label only
/// makes sense top-to-bottom, so sort by descending y (origin is bottom-left),
/// then left-to-right for lines sharing a band.
func readingOrder(_ obs: [Observation]) -> [Observation] {
    obs.sorted { a, b in
        let ay = a.box[1], by = b.box[1]
        if abs(ay - by) > 0.012 { return ay > by }
        return a.box[0] < b.box[0]
    }
}

// MARK: - Quality warnings

/// The per-image problems a human should look at, phrased the same way on both
/// hosts so a warning seen in the app can be found in the corpus tool's output.
func qualityWarnings(_ observations: [Observation]) -> [String] {
    var warnings: [String] = []
    let clippedCount = observations.filter { !$0.clipped.isEmpty }.count
    if clippedCount > 0 {
        warnings.append("\(clippedCount) of \(observations.count) line(s) run into the frame edge and are probably truncated")
    }
    let contestedCount = observations.filter { $0.contested }.count
    if contestedCount > 0 {
        warnings.append("\(contestedCount) line(s) read differently at different scales — see variants; do not trust these without a human confirming them")
    }
    let normalizedCount = observations.filter { $0.wasNormalized }.count
    if normalizedCount > 0 {
        warnings.append("\(normalizedCount) line(s) contained characters that look like ASCII punctuation but aren't — compare text and normalizedText")
    }
    return warnings
}
