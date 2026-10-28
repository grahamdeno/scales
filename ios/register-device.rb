# Gets the Apple side ready for automatic signing, with the App Store Connect
# API key: at least one registered iPhone (a placeholder if there are none),
# and an App ID for the app. Xcode 26.6
# can't create these itself with an API key (it reports a misleading
# "Authentication failed").
require "openssl"; require "json"; require "net/http"; require "base64"
key_id, issuer, path = ENV.fetch("ASC_KEY_ID"), ENV.fetch("ASC_ISSUER_ID"), ENV.fetch("ASC_KEY_PATH")
b64 = ->(s) { Base64.urlsafe_encode64(s, padding: false) }
key = OpenSSL::PKey::EC.new(File.read(path))
head = b64.(JSON.dump(alg: "ES256", kid: key_id, typ: "JWT"))
body = b64.(JSON.dump(iss: issuer, iat: Time.now.to_i, exp: Time.now.to_i + 600, aud: "appstoreconnect-v1"))
der = key.dsa_sign_asn1(OpenSSL::Digest::SHA256.digest("#{head}.#{body}"))
raw = OpenSSL::ASN1.decode(der).value.map { |i| i.value.to_s(2).rjust(32, "\x00") }.join
jwt = "#{head}.#{body}.#{b64.(raw)}"
api = ->(method, url, payload = nil) {
  uri = URI(url); req = { get: Net::HTTP::Get, post: Net::HTTP::Post, delete: Net::HTTP::Delete, patch: Net::HTTP::Patch }.fetch(method).new(uri)
  req["Authorization"] = "Bearer #{jwt}"; req["Content-Type"] = "application/json"; req.body = JSON.dump(payload) if payload
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
  [res.code.to_i, (JSON.parse(res.body) rescue {})]
}

bundles = { "com.grahamdeno.scales" => "Scales" }
bundles.each do |ident, name|
  code, found = api.(:get, "https://api.appstoreconnect.apple.com/v1/bundleIds?filter[identifier]=#{ident}&include=bundleIdCapabilities&limit=5")
  abort "::error::bundle lookup failed (#{code}): #{found}" unless code == 200
  rec = (found["data"] || []).find { |b| b.dig("attributes", "identifier") == ident }
  unless rec
    code, made = api.(:post, "https://api.appstoreconnect.apple.com/v1/bundleIds",
      { data: { type: "bundleIds", attributes: { identifier: ident, name: name, platform: "IOS" } } })
    abort "::error::couldn't register #{ident} (#{code}): #{made}" unless [200, 201].include?(code)
    rec = made["data"]; found = { "included" => [] }
    puts "::notice::Registered App ID #{ident}"
  end
  # iCloud in the current mode (with CloudKit support, as Xcode sets it); the Xcode 5 mode makes profiles
  # without the iCloud container entitlements the app uses.
  cap = (found["included"] || []).find { |c| c["type"] == "bundleIdCapabilities" && c.dig("attributes", "capabilityType") == "ICLOUD" }
  if cap
    puts "::notice::iCloud settings: #{JSON.dump(cap.dig('attributes', 'settings'))}"
    unless JSON.dump(cap.dig("attributes", "settings")).include?('"key":"XCODE_6","enabled":true')
      pc, out = api.(:patch, "https://api.appstoreconnect.apple.com/v1/bundleIdCapabilities/#{cap['id']}",
        { data: { type: "bundleIdCapabilities", id: cap["id"], attributes: { capabilityType: "ICLOUD",
          settings: [{ key: "ICLOUD_VERSION", options: [{ key: "XCODE_6", enabled: true }] }] } } })
      puts(pc == 200 ? "::notice::iCloud switched to the current mode" : "::warning::couldn't switch iCloud mode (#{pc}): #{JSON.dump(out)[0, 300]}")
    end
  else
    puts "::warning::iCloud is not on for #{ident}"
  end
  # Profiles made before iCloud was turned on for the App ID (1.77.1) lack the container, and the export
  # would reuse them and fail. Delete any profile for this app that doesn't name the container, so Xcode
  # makes a fresh one with it.
  code, profs = api.(:get, "https://api.appstoreconnect.apple.com/v1/bundleIds/#{rec['id']}/profiles?limit=50")
  if code == 200
    (profs["data"] || []).each do |pr|
      content = Base64.decode64(pr.dig("attributes", "profileContent").to_s)
      ents = content[/<key>Entitlements<\/key>\s*<dict>(.*?)<\/dict>/m, 1].to_s.scan(/<key>([^<]+)<\/key>/).flatten
      puts "::notice::#{pr.dig('attributes', 'name')} (#{pr.dig('attributes', 'profileState')}) entitlements: #{ents.join(', ')}"
      next if content.include?("iCloud.com.grahamdeno.scales") && pr.dig("attributes", "profileState") == "ACTIVE"
      dc, = api.(:delete, "https://api.appstoreconnect.apple.com/v1/profiles/#{pr['id']}")
      puts(dc == 204 ? "::notice::Deleted out-of-date profile #{pr.dig('attributes', 'name')}" : "::warning::couldn't delete profile #{pr.dig('attributes', 'name')} (#{dc})")
    end
  else
    puts "::warning::profile lookup failed (#{code})"
  end
end
code, list = api.(:get, "https://api.appstoreconnect.apple.com/v1/devices?filter[platform]=IOS&limit=5")
abort "::error::devices lookup failed (#{code}): #{list}" unless code == 200
if (list["data"] || []).empty?
  code, out = api.(:post, "https://api.appstoreconnect.apple.com/v1/devices",
    { data: { type: "devices", attributes: { name: "Scales build placeholder", platform: "IOS", udid: "00008110-001A2B3C4D5E6F01" } } })
  abort "::error::device registration failed (#{code}): #{out}" unless [200, 201].include?(code)
  puts "::notice::Registered a placeholder iPhone for signing"
else
  puts "::notice::Team has #{list['data'].size} registered device(s)"
end
