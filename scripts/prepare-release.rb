# Gets an App Store version ready for review with the App Store Connect API key, and stops there: it NEVER submits.
# Steps, each safe to run again:
#   1. the version in appstore/listing.json ("version"): uses it if it exists, else creates it (iOS)
#   2. attaches the build BUILD (version "version", processing finished)
#   3. puts description, keywords, promotional text and What's New from appstore/listing.json on it
#   4. replaces the 6.9-inch iPhone screenshots with appstore/screenshots/*.png, in file-name order
#   5. App Accessibility for iPhone: declares what appstore/listing.json lists under "accessibility"
# Run by .github/workflows/listing.yml with prepare: true and a build number.
require "openssl"; require "json"; require "net/http"; require "base64"; require "digest"
key_id, issuer, path = ENV.fetch("ASC_KEY_ID"), ENV.fetch("ASC_ISSUER_ID"), ENV.fetch("ASC_KEY_PATH")
build_no = ENV.fetch("BUILD").strip
abort "::error::BUILD must be a build number" unless build_no =~ /\A\d+\z/
root = File.join(__dir__, "..")
want = JSON.parse(File.read(File.join(root, "appstore", "listing.json")))
b64 = ->(s) { Base64.urlsafe_encode64(s, padding: false) }
key = OpenSSL::PKey::EC.new(File.read(path))
jwt = -> {
  head = b64.(JSON.dump(alg: "ES256", kid: key_id, typ: "JWT"))
  body = b64.(JSON.dump(iss: issuer, iat: Time.now.to_i, exp: Time.now.to_i + 900, aud: "appstoreconnect-v1"))
  der = key.dsa_sign_asn1(OpenSSL::Digest::SHA256.digest("#{head}.#{body}"))
  raw = OpenSSL::ASN1.decode(der).value.map { |i| i.value.to_s(2).rjust(32, "\x00") }.join
  "#{head}.#{body}.#{b64.(raw)}"
}
call = ->(method, url, payload = nil, soft: false) {
  uri = URI(url.start_with?("http") ? url : "https://api.appstoreconnect.apple.com#{url}")
  req = { get: Net::HTTP::Get, post: Net::HTTP::Post, patch: Net::HTTP::Patch, delete: Net::HTTP::Delete }[method].new(uri)
  req["Authorization"] = "Bearer #{jwt.()}"
  if payload then req["Content-Type"] = "application/json"; req.body = JSON.dump(payload) end
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
  unless [200, 201, 204].include?(res.code.to_i)
    msg = "#{method.upcase} #{uri.path} #{res.code}: #{res.body.to_s[0, 600]}"
    if soft then puts "::warning::#{msg}"; return nil end
    abort "::error::#{msg}"
  end
  res.body.to_s.empty? ? {} : JSON.parse(res.body)
}
get = ->(url) { call.(:get, url) }

app = get.("/v1/apps?filter[bundleId]=com.grahamdeno.scales")["data"].first or abort "::error::app not found"
ver = want.fetch("version")

# 1. The version
vers = get.("/v1/apps/#{app["id"]}/appStoreVersions?filter[platform]=IOS&limit=10")["data"]
v = vers.find { |x| x.dig("attributes", "versionString") == ver }
if v
  st = v.dig("attributes", "appStoreState")
  abort "::error::version #{ver} is #{st}; this only prepares a version that hasn't been submitted" unless st =~ /PREPARE_FOR_SUBMISSION|DEVELOPER_REJECTED|REJECTED|METADATA_REJECTED/
  puts "1. version #{ver} already there (#{st})"
else
  v = call.(:post, "/v1/appStoreVersions", { data: { type: "appStoreVersions", attributes: { platform: "IOS", versionString: ver },
    relationships: { app: { data: { type: "apps", id: app["id"] } } } } })["data"]
  puts "1. version #{ver} created"
end

# 2. The build
b = get.("/v1/builds?filter[app]=#{app["id"]}&filter[version]=#{build_no}&filter[preReleaseVersion.version]=#{ver}&limit=5")["data"].first
abort "::error::build #{build_no} for version #{ver} not found in App Store Connect" unless b
ps = b.dig("attributes", "processingState")
abort "::error::build #{build_no} is #{ps}, not ready yet (try again once Apple finishes processing)" unless ps == "VALID"
call.(:patch, "/v1/appStoreVersions/#{v["id"]}/relationships/build", { data: { type: "builds", id: b["id"] } })
puts "2. build #{build_no} attached"

# 3. The text
loc = get.("/v1/appStoreVersions/#{v["id"]}/appStoreVersionLocalizations")["data"].find { |l| l.dig("attributes", "locale") == want["locale"] } or abort "::error::no #{want["locale"]} text on #{ver}"
attrs = want.slice("description", "keywords", "promotionalText", "whatsNew")
call.(:patch, "/v1/appStoreVersionLocalizations/#{loc["id"]}", { data: { type: "appStoreVersionLocalizations", id: loc["id"], attributes: attrs } })
puts "3. #{attrs.keys.join(", ")} set"

# 4. Screenshots (6.9-inch iPhone)
shots = Dir[File.join(root, "appstore", "screenshots", "*.png")].sort
abort "::error::no screenshots in appstore/screenshots" if shots.empty?
sets = get.("/v1/appStoreVersionLocalizations/#{loc["id"]}/appScreenshotSets")["data"]
set = sets.find { |s| s.dig("attributes", "screenshotDisplayType") == "APP_IPHONE_67" }
set ||= call.(:post, "/v1/appScreenshotSets", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: "APP_IPHONE_67" },
  relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc["id"] } } } } })["data"]
get.("/v1/appScreenshotSets/#{set["id"]}/appScreenshots")["data"].each { |s| call.(:delete, "/v1/appScreenshots/#{s["id"]}") }
shots.each do |f|
  bytes = File.binread(f)
  s = call.(:post, "/v1/appScreenshots", { data: { type: "appScreenshots", attributes: { fileName: File.basename(f), fileSize: bytes.bytesize },
    relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set["id"] } } } } })["data"]
  s.dig("attributes", "uploadOperations").each do |op|
    uri = URI(op["url"])
    req = Net::HTTP.const_get(op["method"].capitalize).new(uri)
    op["requestHeaders"].each { |h| req[h["name"]] = h["value"] }
    req.body = bytes.byteslice(op["offset"], op["length"])
    res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
    abort "::error::upload of #{File.basename(f)} failed: #{res.code}" unless res.code.to_i.between?(200, 299)
  end
  call.(:patch, "/v1/appScreenshots/#{s["id"]}", { data: { type: "appScreenshots", id: s["id"],
    attributes: { uploaded: true, sourceFileChecksum: Digest::MD5.hexdigest(bytes) } } })
  puts "4. screenshot #{File.basename(f)} uploaded"
end

# 5. App Accessibility (iPhone). Not fatal: if Apple's API refuses, it says so and the rest stands.
acc = want["accessibility"]
if acc
  # Only what is declared is sent (Apple's field names vary; anything left out stays undeclared).
  attrs = acc.to_h { |k| [k, true] }
  list = call.(:get, "/v1/apps/#{app["id"]}/accessibilityDeclarations", soft: true)
  if list
    d = list["data"].find { |x| x.dig("attributes", "deviceFamily") == "IPHONE" && x.dig("attributes", "state") != "REPLACED" }
    if d && d.dig("attributes", "state") == "DRAFT"
      ok = call.(:patch, "/v1/accessibilityDeclarations/#{d["id"]}", { data: { type: "accessibilityDeclarations", id: d["id"], attributes: attrs.merge("publish" => true) } }, soft: true)
    else
      made = call.(:post, "/v1/accessibilityDeclarations", { data: { type: "accessibilityDeclarations", attributes: attrs.merge("deviceFamily" => "IPHONE"),
        relationships: { app: { data: { type: "apps", id: app["id"] } } } } }, soft: true)
      ok = made && call.(:patch, "/v1/accessibilityDeclarations/#{made["data"]["id"]}", { data: { type: "accessibilityDeclarations", id: made["data"]["id"], attributes: { publish: true } } }, soft: true)
    end
    puts ok ? "5. accessibility declared for iPhone: #{acc.map { |k| k.sub("supports", "") }.join(", ")}" : "5. accessibility NOT declared (see the warning above); do it by hand in App Accessibility"
  else
    puts "5. accessibility NOT declared (the API refused to list declarations); do it by hand in App Accessibility"
  end
end

puts "::notice::#{ver} with build #{build_no} is ready for review. Nothing was submitted."
