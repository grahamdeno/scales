# Read-only look at the App Store version being prepared: its state, the build attached, and every screenshot in
# every set (file name, size, whether Apple has finished processing it). Changes nothing and never submits.
# Run by .github/workflows/listing.yml with check: true.
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
get.("/v1/apps/#{app["id"]}/appStoreVersions?filter[platform]=IOS&limit=5")["data"].each do |v|
  a = v["attributes"]
  puts "VERSION #{a["versionString"]} state #{a["appStoreState"]} (#{v["id"]})"
  b = get.("/v1/appStoreVersions/#{v["id"]}/build")["data"] rescue nil
  if b then ba = b["attributes"]; puts "  build #{ba["version"]} uploaded #{ba["uploadedDate"]} processing #{ba["processingState"]} expired #{ba["expired"]}"
  else puts "  no build attached" end
  next unless a["appStoreState"].to_s =~ /PREPARE|REJECTED|WAITING|READY/
  get.("/v1/appStoreVersions/#{v["id"]}/appStoreVersionLocalizations")["data"].each do |l|
    puts "  locale #{l["attributes"]["locale"]}"
    get.("/v1/appStoreVersionLocalizations/#{l["id"]}/appScreenshotSets")["data"].each do |set|
      shots = get.("/v1/appScreenshotSets/#{set["id"]}/appScreenshots")["data"]
      puts "    #{set["attributes"]["screenshotDisplayType"]}: #{shots.size} screenshots"
      shots.each_with_index do |s, i|
        sa = s["attributes"]; ia = sa["imageAsset"] || {}
        puts "      #{i + 1}. #{sa["fileName"]} #{ia["width"]}x#{ia["height"]} #{sa.dig("assetDeliveryState", "state")} #{sa["fileSize"]} bytes"
      end
    end
  end
end
# Subscriptions and in-app purchases: name, product ID, state. Read-only.
puts "SUBSCRIPTIONS"
(get.("/v1/apps/#{app["id"]}/subscriptionGroups")["data"] rescue []).each do |g|
  puts "  group #{g["attributes"]["referenceName"]} (#{g["id"]})"
  (get.("/v1/subscriptionGroups/#{g["id"]}/subscriptions")["data"] rescue []).each do |s|
    a = s["attributes"]; puts "    #{a["name"]} #{a["productId"]} state #{a["state"]} period #{a["subscriptionPeriod"]}"
  end
end
puts "IN-APP PURCHASES"
(get.("/v1/apps/#{app["id"]}/inAppPurchasesV2")["data"] rescue []).each { |i| a = i["attributes"]; puts "  #{a["name"]} #{a["productId"]} #{a["inAppPurchaseType"]} state #{a["state"]}" }
