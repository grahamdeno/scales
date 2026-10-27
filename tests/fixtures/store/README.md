Test-only certificates for the Scales Plus check in server/ai.mjs, shaped like Apple's StoreKit chain
(P-384 root and intermediate, P-256 leaf, Apple's marker extensions). Made with openssl; the keys sign
nothing real. The server only trusts Apple Root CA - G3 unless a test passes this root's fingerprint.
