Pod::Spec.new do |s|
  s.name           = 'VisionOcr'
  s.version        = '0.1.0'
  s.summary        = 'On-device Apple Vision OCR for Placard'
  s.description    = 'Wraps the OCR pipeline shared with tools/ocr as an Expo module.'
  s.author         = 'Placard'
  s.homepage       = 'https://github.com/douglas-johnson/placard'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'ImageIO'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
