# Supabase Root CA

`supabase-root-2021-ca.pem` is Supabase's public root certificate for direct Postgres connections (`db.<project-ref>.supabase.co:5432`). It's not a secret — it's the same certificate Supabase's dashboard offers under Settings → Database → SSL Configuration for `sslmode=verify-full`. It's committed here so `scripts/run-migrations.mjs` can verify the server's certificate chain properly instead of disabling TLS verification.
