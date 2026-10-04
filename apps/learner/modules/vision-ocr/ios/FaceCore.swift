// FaceCore — finds faces in a frame and pixellates them before the frame is kept
// (field-beta §3, D28). Strangers in a gallery didn't consent to being in the corpus,
// and blurring on the server would mean the unblurred frame had already left.
//
// Compiled into the same two hosts as OCRCore.swift, for the same reason: the Mac tool
// can count what this pass would find across the existing corpus, so a change here is
// measured against real frames before it reaches a phone. Its own file rather than a
// part of OCRCore because nothing in it is about reading text.
//
// Same rule as OCRCore: Foundation, Vision, Core Image, ImageIO and UTType only — no AppKit,
// no UIKit, no ExpoModulesCore.

import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

struct FaceScan: Codable {
    /// Each face as Vision found it: normalized to the upright image, origin
    /// bottom-left, [x, y, width, height] — the same convention as an OCR box.
    let boxes: [[Double]]
    let elapsedMs: Int
}

enum FaceError: Error, CustomStringConvertible {
    case unreadable(URL)
    case unwritable(URL)

    var description: String {
        switch self {
        case .unreadable(let url): return "can't read an image at \(url.path)"
        case .unwritable(let url): return "can't write an image to \(url.path)"
        }
    }
}

/// Each detected face is grown by this fraction of its size on every side. Vision's
/// box runs roughly brow to chin and ear to ear; hair, ears and jaw identify a person
/// too.
let faceMargin = 0.35

/// Blocks across the widest side of a pixellated face. Coarse on purpose: a fine
/// mosaic of a face can be matched, and nothing in a contributed frame is about the
/// face.
let blocksPerFace = 8.0

/// Faces in the image, normalized to the upright image (origin bottom-left).
func detectFaces(_ image: CGImage, orientation: CGImagePropertyOrientation) throws -> [CGRect] {
    let request = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
    try handler.perform([request])
    return (request.results ?? []).map(\.boundingBox)
}

/// The file-based entry point: finds the faces in the image at `url`.
///
/// Finding and pixellating are separate steps so the host decides which faces to
/// pixellate. A face in a portrait or on a statue is a face to Vision, and whether
/// that one is blurred is a policy question that belongs where it can change without
/// a native build.
func detectFaces(_ url: URL) throws -> FaceScan {
    let started = Date()
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)
    else { throw FaceError.unreadable(url) }
    let found = try detectFaces(cg, orientation: readOrientation(url))
    return FaceScan(
        boxes: found.map { [$0.minX, $0.minY, $0.width, $0.height].map(Double.init) },
        elapsedMs: Int(Date().timeIntervalSince(started) * 1000))
}

/// Reads `source`, pixellates each box (as `detectFaces` reports them), and writes the
/// result to `destination` with the source's metadata — EXIF, GPS and the orientation
/// tag — carried over untouched. `source` and `destination` may be the same file.
func pixellate(source: URL, destination: URL, boxes: [[Double]], quality: Double = 0.92) throws {
    guard let src = CGImageSourceCreateWithURL(source as CFURL, nil),
          let cg = CGImageSourceCreateImageAtIndex(src, 0, nil)
    else { throw FaceError.unreadable(source) }
    let orientation = readOrientation(source)

    // Vision answered in the upright image's coordinates, but the pixels are stored as
    // the sensor saw them and the orientation tag says how to turn them. Pixellate in
    // stored coordinates and keep the tag, so the file differs from the source only
    // where a face was.
    let stored = CIImage(cgImage: cg)
    let upright = stored.oriented(orientation).extent
    let toStored = stored.orientationTransform(for: orientation).inverted()
    let clamped = stored.clampedToExtent()

    var output = stored
    for box in boxes where box.count == 4 {
        let face = CGRect(x: upright.minX + box[0] * upright.width,
                          y: upright.minY + box[1] * upright.height,
                          width: box[2] * upright.width, height: box[3] * upright.height)
        let region = face
            .insetBy(dx: -face.width * faceMargin, dy: -face.height * faceMargin)
            .applying(toStored)
            .intersection(stored.extent)
            .integral
        guard !region.isEmpty else { continue }
        let block = max(region.width, region.height) / blocksPerFace
        let pixellated = clamped
            .applyingFilter("CIPixellate", parameters: [
                kCIInputScaleKey: block,
                kCIInputCenterKey: CIVector(x: region.minX, y: region.minY),
            ])
            .cropped(to: region)
        output = pixellated.composited(over: output)
    }

    let context = CIContext()
    guard let rendered = context.createCGImage(output, from: stored.extent)
    else { throw FaceError.unwritable(destination) }

    // Written beside the destination and moved over it, so a crash mid-write never
    // leaves a half-written frame where the take expects a whole one.
    let type = CGImageSourceGetType(src) ?? (UTType.jpeg.identifier as CFString)
    let partial = destination.deletingLastPathComponent()
        .appendingPathComponent(".\(destination.lastPathComponent).partial")
    guard let dest = CGImageDestinationCreateWithURL(partial as CFURL, type, 1, nil)
    else { throw FaceError.unwritable(destination) }
    var properties = (CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]) ?? [:]
    properties[kCGImageDestinationLossyCompressionQuality] = quality
    CGImageDestinationAddImage(dest, rendered, properties as CFDictionary)
    guard CGImageDestinationFinalize(dest) else { throw FaceError.unwritable(destination) }
    if FileManager.default.fileExists(atPath: destination.path) {
        _ = try FileManager.default.replaceItemAt(destination, withItemAt: partial)
    } else {
        try FileManager.default.moveItem(at: partial, to: destination)
    }
}
