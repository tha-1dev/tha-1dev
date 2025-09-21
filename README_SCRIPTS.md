# Thai‑Dev Scripts

## Quick
- Local server: `bash tools/serve_local.sh 8080`
- Push to GitHub: `bash tools/push_to_github.sh tha-1dev thai-dev-pmic-app`
- Switch to production auth config: `bash tools/setup_prod_config.sh`
- Update API base in login.helper.js: `bash tools/update_backend_urls.sh https://your-vercel-app.vercel.app/api`
- Build zip: `bash tools/build_zip.sh`

## Deploy
- Vercel: `bash tools/deploy_vercel.sh`
- Netlify: `bash tools/deploy_netlify.sh`
- Cloudflare Worker (backend): `bash tools/deploy_cloudflare.sh`

See `.env.example` for environment variables.
