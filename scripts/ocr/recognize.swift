import Foundation
import Vision
import ImageIO
let data = FileHandle.standardInput.readDataToEndOfFile()
do {
 guard let source = CGImageSourceCreateWithData(data as CFData, nil), let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString:Any], let width=properties[kCGImagePropertyPixelWidth] as? Int, let height=properties[kCGImagePropertyPixelHeight] as? Int, width > 0, height > 0, width*height <= 24000000 else { throw NSError(domain:"InvalidImage",code:1) }
 let request = VNRecognizeTextRequest()
 request.recognitionLevel = .accurate
 request.recognitionLanguages = ["ko-KR", "en-US"]
 request.usesLanguageCorrection = false
 try VNImageRequestHandler(data:data).perform([request])
 let lines = (request.results ?? []).compactMap { observation -> [String:Any]? in
  guard let candidate = observation.topCandidates(1).first else { return nil }
  return ["text":candidate.string,"confidence":candidate.confidence,"x":observation.boundingBox.minX,"y":observation.boundingBox.minY]
 }
 let result = try JSONSerialization.data(withJSONObject:["lines":lines,"engine":"apple-vision-v1"])
 FileHandle.standardOutput.write(result)
} catch { FileHandle.standardError.write(Data("OCR_FAILED".utf8)); exit(1) }
