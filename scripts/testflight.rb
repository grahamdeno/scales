# After an upload: wait for App Store Connect to finish processing the build, set What to Test, add the build to the
# external tester group and submit it for Beta App Review. Run by .github/workflows/ios.yml after the upload.
# It never touches the App Store version, never adds or removes testers, and sends no notification of its own
# (TestFlight's auto-notify on the group decides that).
# Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file), BUILD_NUMBER.
# Optional: TESTER_GROUP (default "Beta testers"), WHAT_TO_TEST_FILE, WAIT_MINUTES (default 30).
require "openssl"; require "json"; require "net/http"; require "base64"
key_id, issuer, path = ENV.fetch("ASC_KEY_ID"), ENV.fetch("ASC_ISSUER_ID"), ENV.fetch("ASC_KEY_PATH")
number = ENV.fetch("BUILD_NUMBER")
group_name = ENV.fetch("TESTER_GROUP", "Beta testers")
b64 = ->(s) { Base64.urlsafe_encode64(s, padding: false) }
key = OpenSSL::PKey::EC.new(File.read(path))
# A fresh token for each call: the wait for processing can outlast one token's 10 minutes.
jwt = -> {
  head = b64.(JSON.dump(alg: "ES256", kid: key_id, typ: "JWT"))
  body = b64.(JSON.dump(iss: issuer, iat: Time.now.to_i, exp: Time.now.to_i + 600, aud: "appstoreconnect-v1"))
  der = key.dsa_sign_asn1(OpenSSL::Digest::SHA256.digest("#{head}.#{body}"))
  raw = OpenSSL::ASN1.decode(der).value.map { |i| i.value.to_s(2).rjust(32, "\x00") }.join
  "#{head}.#{body}.#{b64.(raw)}"
}
api = ->(method, url, payload = nil) {
  uri = URI("https://api.appstoreconnect.apple.com#{url}")
  req = { get: Net::HTTP::Get, post: Net::HTTP::Post, patch: Net::HTTP::Patch }.fetch(method).new(uri)
  req["Authorization"] = "Bearer #{jwt.()}"; req["Content-Type"] = "application/json"; req.body = JSON.dump(payload) if payload
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 60) { |h| h.request(req) }
  [res.code.to_i, (JSON.parse(res.body) rescue {})]
}
detail = ->(out) { (out["errors"] || []).map { |e| e["detail"] || e["title"] }.join("; ")[0, 300] }

code, apps = api.(:get, "/v1/apps?filter[bundleId]=com.grahamdeno.scales")
app = (apps["data"] || []).first or abort "::warning::app not found (#{code})"

# 1. Wait for processing.
deadline = Time.now + 60 * Integer(ENV.fetch("WAIT_MINUTES", "30"))
build = nil
while Time.now < deadline
  code, found = api.(:get, "/v1/builds?filter[app]=#{app["id"]}&filter[version]=#{number}&limit=5")
  row = (found["data"] || []).first
  state = row && row.dig("attributes", "processingState")
  puts "Build #{number}: #{state || "not listed yet"}"
  if state == "VALID" then build = row["id"]; break end
  abort "::error::App Store Connect could not process build #{number} (#{state})" if %w[FAILED INVALID].include?(state)
  sleep 60
end
abort "::warning::Build #{number} was not ready after the wait. Finish it by hand in TestFlight." unless build

# 2. What to Test (needed before Beta App Review).
file = ENV["WHAT_TO_TEST_FILE"]
if file && File.exist?(file)
  text = File.read(file).strip[0, 4000]
  code, _ = api.(:post, "/v1/betaBuildLocalizations", { data: { type: "betaBuildLocalizations",
    attributes: { locale: "en-US", whatsNew: text }, relationships: { build: { data: { type: "builds", id: build } } } } })
  if code == 409
    _, existing = api.(:get, "/v1/builds/#{build}/betaBuildLocalizations")
    loc = (existing["data"] || []).find { |l| l.dig("attributes", "locale") == "en-US" }
    code, _ = api.(:patch, "/v1/betaBuildLocalizations/#{loc["id"]}",
      { data: { type: "betaBuildLocalizations", id: loc["id"], attributes: { whatsNew: text } } }) if loc
  end
  abort "::warning::could not set What to Test (#{code})" unless [200, 201].include?(code)
  puts "::notice::What to Test set on build #{number}"
else
  abort "::warning::no What to Test file (#{file.inspect}); not sending to external testers"
end

# 3. The external group, by name. Testers in it are not changed.
_, groups = api.(:get, "/v1/apps/#{app["id"]}/betaGroups?limit=50")
group = (groups["data"] || []).find { |g| g.dig("attributes", "name") == group_name && !g.dig("attributes", "isInternalGroup") }
abort "::warning::no external TestFlight group named \"#{group_name}\"" unless group
code, out = api.(:post, "/v1/betaGroups/#{group["id"]}/relationships/builds", { data: [{ type: "builds", id: build }] })
abort "::warning::could not add build #{number} to #{group_name} (#{code}): #{detail.(out)}" unless [200, 204].include?(code)
puts "::notice::Build #{number} added to #{group_name}"

# 4. Beta App Review. A build already submitted or already approved is not an error.
code, out = api.(:post, "/v1/betaAppReviewSubmissions",
  { data: { type: "betaAppReviewSubmissions", relationships: { build: { data: { type: "builds", id: build } } } } })
if [200, 201].include?(code)
  puts "::notice::Build #{number} submitted for Beta App Review"
elsif code == 409 || detail.(out) =~ /already/i
  puts "::notice::Build #{number} was already submitted or approved for beta: #{detail.(out)}"
else
  abort "::warning::Beta App Review submission failed (#{code}): #{detail.(out)}"
end
