# Reads the App Store listing text (app name, subtitle, description, keywords, promotional text, URLs) for the
# version being prepared, with the App Store Connect API key, and prints it. It changes nothing.
# Run by .github/workflows/listing.yml.
require "openssl"; require "json"; require "net/http"; require "base64"
key_id, issuer, path = ENV.fetch("ASC_KEY_ID"), ENV.fetch("ASC_ISSUER_ID"), ENV.fetch("ASC_KEY_PATH")
b64 = ->(s) { Base64.urlsafe_encode64(s, padding: false) }
key = OpenSSL::PKey::EC.new(File.read(path))
head = b64.(JSON.dump(alg: "ES256", kid: key_id, typ: "JWT"))
body = b64.(JSON.dump(iss: issuer, iat: Time.now.to_i, exp: Time.now.to_i + 600, aud: "appstoreconnect-v1"))
der = key.dsa_sign_asn1(OpenSSL::Digest::SHA256.digest("#{head}.#{body}"))
raw = OpenSSL::ASN1.decode(der).value.map { |i| i.value.to_s(2).rjust(32, "\x00") }.join
jwt = "#{head}.#{body}.#{b64.(raw)}"
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
File.write(ENV["GITHUB_STEP_SUMMARY"] || "/dev/null", "```json\n#{JSON.pretty_generate(out)}\n```\n")
