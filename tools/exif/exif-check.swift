// Prints capture time, offset and GPS for each image, read straight from the file
// with ImageIO — not from Spotlight, which lags on a fresh folder. Run interpreted:
//   swift tools/exif/exif-check.swift data/labels/raw/<take>/*.HEIC
// First check after every import (docs/capture-protocol.md, "When you get back").
import Foundation
import ImageIO
for path in CommandLine.arguments.dropFirst() {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
          let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [String: Any] else { print("\(path): unreadable"); continue }
    let exif = props["{Exif}"] as? [String: Any] ?? [:]
    let gps = props["{GPS}"] as? [String: Any] ?? [:]
    let tiff = props["{TIFF}"] as? [String: Any] ?? [:]
    let name = (path as NSString).lastPathComponent
    let date = exif["DateTimeOriginal"] as? String ?? "-"
    let off = exif["OffsetTimeOriginal"] as? String ?? "-"
    let lat = gps["Latitude"] as? Double
    let lon = gps["Longitude"] as? Double
    let hp = gps["HPositioningError"] as? Double
    let alt = gps["Altitude"] as? Double
    let model = tiff["Model"] as? String ?? "-"
    let latS = lat.map { String(format: "%.5f%@", $0, (gps["LatitudeRef"] as? String) ?? "") } ?? "none"
    let lonS = lon.map { String(format: "%.5f%@", $0, (gps["LongitudeRef"] as? String) ?? "") } ?? "none"
    let hpS = hp.map { String(format: "±%.0fm", $0) } ?? ""
    let altS = alt.map { String(format: "alt %.0fm", $0) } ?? ""
    print("\(name)  \(date) \(off)  \(latS) \(lonS) \(hpS) \(altS)  \(model)  gpsKeys=\(gps.keys.count)")
}
