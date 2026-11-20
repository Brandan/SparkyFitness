Pod::Spec.new do |s|
  s.name           = 'AlternateAppIconModule'
  s.version        = '1.0.0'
  s.summary        = 'Switches the Home Screen app icon, independent of the system Light/Dark/Tinted setting.'
  s.author         = 'SparkyFitness'
  s.homepage       = 'https://github.com/CodeWithCJ/SparkyFitness'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = 'MIT'

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
