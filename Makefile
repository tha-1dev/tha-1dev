# Makefile shortcuts
.PHONY: serve push pages vercel netlify cloudflare prod zip

serve:
	bash tools/serve_local.sh 8080

push:
	bash tools/push_to_github.sh tha-1dev thai-dev-pmic-app

prod:
	bash tools/setup_prod_config.sh

vercel:
	bash tools/deploy_vercel.sh

netlify:
	bash tools/deploy_netlify.sh

cloudflare:
	bash tools/deploy_cloudflare.sh

zip:
	bash tools/build_zip.sh
