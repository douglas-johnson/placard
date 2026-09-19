// VisionOcr — the phone-side host for OCRCore.swift (§4.4, D3).
//
// Deliberately thin. Everything that knows anything about labels is in OCRCore,
// which the Mac corpus tool compiles too; this file only converts between the
// Expo bridge and that code. Recognition runs off the main thread — AsyncFunction
// does that by default — because three Vision passes on a 12-megapixel frame take
// a second or more, and the capture screen must not freeze while they do.

import ExpoModulesCore
import Vision

struct RecognizeOptions: Record {
  @Field var languages: [String] = ["en-US"]
  @Field var fast: Bool = false
  /// Scales the image is recognized at; readings are cross-checked between them.
  /// The default matches the corpus tool, so a line that reads cleanly on the Mac
  /// should read the same way here.
  @Field var scales: [Double] = [1.0, 1.6, 2.4]
}

public class VisionOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VisionOcr")

    AsyncFunction("recognize") { (uri: URL, options: RecognizeOptions?) throws -> [String: Any] in
      let opts = options ?? RecognizeOptions()
      let started = Date()
      let observations = try recognize(uri, languages: opts.languages,
                                       fast: opts.fast, scales: opts.scales)
      let elapsedMs = Int(Date().timeIntervalSince(started) * 1000)

      // Round-trip through JSON so the bridge sees plain dictionaries with exactly
      // the field names the fixtures and the corpus tool's NDJSON use.
      let encoded = try JSONEncoder().encode(observations)
      let plain = try JSONSerialization.jsonObject(with: encoded)

      return [
        "observations": plain,
        "text": observations.map(\.text).joined(separator: "\n"),
        "normalizedText": observations.map(\.normalizedText).joined(separator: "\n"),
        "warnings": qualityWarnings(observations),
        "elapsedMs": elapsedMs,
      ]
    }
  }
}
