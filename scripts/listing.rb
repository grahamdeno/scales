# Reads the App Store listing text (app name, subtitle, description, keywords, promotional text, URLs) for the
# version being prepared, with the App Store Connect API key, and prints it.
# With WRITE=1 it then puts appstore/listing.json (description, keywords, promotional text, subtitle) on the version
# that is still being prepared, and nothing else: it never submits anything. Run by .github/workflows/listing.yml.
require "openssl"; require "json"; require "net/http"; require "base64"
key_id, issuer, path = ENV.fetch("ASC_KEY_ID"), ENV.fetch("ASC_ISSUER_ID"), ENV.fetch("ASC_KEY_PATH")
b64 = ->(s) { Base64.urlsafe_encode64(s, padding: false) }
key = OpenSSL::PKey::EC.new(File.read(path))
head = b64.(JSON.dump(alg: "ES256", kid: key_id, typ: "JWT"))
body = b64.(JSON.dump(iss: issuer, iat: Time.now.to_i, exp: Time.now.to_i + 600, aud: "appstoreconnect-v1"))
der = key.dsa_sign_asn1(OpenSSL::Digest::SHA256.digest("#{head}.#{body}"))
raw = OpenSSL::ASN1.decode(der).value.map { |i| i.value.to_s(2).rjust(32, "\x00") }.join
jwt = "#{head}.#{body}.#{b64.(raw)}"
api = ->(method, url, payload) {
  uri = URI("https://api.appstoreconnect.apple.com#{url}")
  req = Net::HTTP::Patch.new(uri); req["Authorization"] = "Bearer #{jwt}"; req["Content-Type"] = "application/json"; req.body = JSON.dump(payload)
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
  abort "::error::#{uri.path} #{res.code}: #{res.body[0, 400]}" unless res.code.to_i == 200
}
get = ->(url) {
  uri = URI(url.start_with?("http") ? url : "https://api.appstoreconnect.apple.com#{url}")
  req = Net::HTTP::Get.new(uri); req["Authorization"] = "Bearer #{jwt}"
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
  abort "::error::#{uri.path} #{res.code}: #{res.body[0, 300]}" unless res.code.to_i == 200
  JSON.parse(res.body)
}
app = get.("/v1/apps?filter[bundleId]=com.grahamdeno.scales")["data"].first or abort "::error::app not found"
out = { "app" => app.dig("attributes", "name") }
get.("/v1/apps/#{app["id"]}/appInfos")["data"].each do |info|
  get.("/v1/appInfos/#{info["id"]}/appInfoLocalizations")["data"].each do |l|
    a = l["attributes"]; out["info #{info.dig("attributes", "appStoreState") || info.dig("attributes", "state")} #{a["locale"]}"] = a.slice("name", "subtitle", "privacyPolicyUrl", "privacyChoicesUrl")
  end
end
get.("/v1/apps/#{app["id"]}/appStoreVersions?filter[platform]=IOS&limit=5")["data"].each do |v|
  va = v["attributes"]
  get.("/v1/appStoreVersions/#{v["id"]}/appStoreVersionLocalizations")["data"].each do |l|
    a = l["attributes"]; out["version #{va["versionString"]} #{va["appStoreState"]} #{a["locale"]}"] = a.slice("description", "keywords", "promotionalText", "supportUrl", "marketingUrl", "whatsNew")
  end
end
puts JSON.pretty_generate(out)
# The screenshots on each version: per display type, in order, with Apple's processing state (read only).
get.("/v1/apps/#{app["id"]}/appStoreVersions?filter[platform]=IOS&limit=5")["data"].each do |v|
  get.("/v1/appStoreVersions/#{v["id"]}/appStoreVersionLocalizations")["data"].each do |l|
    get.("/v1/appStoreVersionLocalizations/#{l["id"]}/appScreenshotSets")["data"].each do |set|
      shots = get.("/v1/appScreenshotSets/#{set["id"]}/appScreenshots?limit=20")["data"]
      puts "SCREENSHOTS #{v.dig("attributes", "versionString")} #{l.dig("attributes", "locale")} #{set.dig("attributes", "screenshotDisplayType")}: #{shots.length}"
      shots.each_with_index do |sh, i|
        a = sh["attributes"]; st = a.dig("assetDeliveryState", "state"); errs = (a.dig("assetDeliveryState", "errors") || []).map { |e| e["code"] }.join(",")
        puts "  #{i + 1}. #{a["fileName"]} #{a.dig("imageAsset", "width")}x#{a.dig("imageAsset", "height")} #{st}#{errs.empty? ? "" : " " + errs}"
      end
    end
  end
end
if ENV["WRITE"] == "1"
  want = JSON.parse(File.read(File.join(__dir__, "..", "appstore", "listing.json")))
  vers = get.("/v1/apps/#{app["id"]}/appStoreVersions?filter[platform]=IOS&filter[appStoreState]=PREPARE_FOR_SUBMISSION&limit=5")["data"]
  v = vers.find { |x| x.dig("attributes", "versionString") == want["version"] } or abort "::error::no version #{want["version"]} being prepared"
  loc = get.("/v1/appStoreVersions/#{v["id"]}/appStoreVersionLocalizations")["data"].find { |l| l.dig("attributes", "locale") == want["locale"] } or abort "::error::no #{want["locale"]} text"
  api.(:patch, "/v1/appStoreVersionLocalizations/#{loc["id"]}", { data: { type: "appStoreVersionLocalizations", id: loc["id"],
    attributes: want.slice("description", "keywords", "promotionalText") } })
  puts "::notice::description, keywords and promotional text updated on #{want["version"]} (not submitted)"
  if want["subtitle"]
    info = get.("/v1/apps/#{app["id"]}/appInfos")["data"].find { |i| (i.dig("attributes", "appStoreState") || i.dig("attributes", "state")).to_s =~ /PREPARE|WAITING|DEVELOPER/ } || get.("/v1/apps/#{app["id"]}/appInfos")["data"].first
    il = get.("/v1/appInfos/#{info["id"]}/appInfoLocalizations")["data"].find { |l| l.dig("attributes", "locale") == want["locale"] }
    if il && il.dig("attributes", "subtitle") != want["subtitle"]
      api.(:patch, "/v1/appInfoLocalizations/#{il["id"]}", { data: { type: "appInfoLocalizations", id: il["id"], attributes: { subtitle: want["subtitle"] } } })
      puts "::notice::subtitle updated"
    end
  end
end
File.write(ENV["GITHUB_STEP_SUMMARY"] || "/dev/null", "```json\n#{JSON.pretty_generate(out)}\n```\n")
