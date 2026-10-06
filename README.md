# Behera Lab / Atoms to Bits Lab

Temporary landing page for the Behera Research Group at UCLA.

## GitHub Pages setup

1. Create a GitHub repository. Recommended name: `beheralab`.
2. Upload the files in this folder to the repository root.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch **main** and folder **/(root)**, then save.
6. Under **Custom domain**, enter `beheralab.com`.

The included `CNAME` file contains `beheralab.com`.

## Cloudflare DNS

Create these four A records for the apex domain:

- `@` → `185.199.108.153`
- `@` → `185.199.109.153`
- `@` → `185.199.110.153`
- `@` → `185.199.111.153`

Also create:

- CNAME `www` → `YOUR-GITHUB-USERNAME.github.io`

Replace `YOUR-GITHUB-USERNAME` with your actual GitHub username.

For initial setup/troubleshooting, using **DNS only** in Cloudflare is the simplest approach. Once GitHub shows the domain and HTTPS as healthy, you can decide whether to use Cloudflare proxying.

## Files

- `index.html` — landing page
- `styles.css` — styling
- `CNAME` — GitHub Pages custom-domain file
