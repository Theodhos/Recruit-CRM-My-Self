# CRM — faqja publike e punëve (careers)

Ky projekt është vetëm faqja publike `/jobs` e CRM-së. Nuk përmban kodin e CRM-së.

- Liston **punët e publikuara në CRM** (statusi *Published* dhe e shënuar *Publish this job on the company website*).
- Çdo punë ka faqen e vet (`/job/<id>`) dhe formularin e aplikimit (`/apply/<id>`).
- **Aplikimet kthehen në CRM**: kandidati krijohet vetë te Candidates dhe vendoset në pipeline të punës.
- Një punë që fshihet, mbyllet ose skadon në CRM zhduket nga kjo faqe vetë. Nuk ka asgjë për të kopjuar.

## Si lidhet me CRM-në

Faqja nuk ruan asgjë vetë. Për çdo vizitë ajo (nga serveri) pyet CRM-në:

| Çfarë | Adresa e CRM-së |
|---|---|
| Lista e punëve | `GET  {CRM_API_URL}/api/v1/public/jobs?organisation={CAREERS_ORG}` |
| Aplikimi | `POST {CRM_API_URL}/api/v1/public/applications` |

Kërkesat bëhen nga serveri i faqes drejt serverit të CRM-së, kështu që **nuk nevojitet CORS** dhe nuk ndryshon asgjë në CRM
kur ndryshon domeni i kësaj faqeje.

## Konfigurimi (variablat)

Kopjo `.env.example` në `.env` ose vendosi te vendi ku ekzekutohet.

| Variabla | Kuptimi | Shembull |
|---|---|---|
| `CRM_API_URL` | Adresa e CRM-së | `https://crm.example.com` |
| `CAREERS_ORG` | Slug-u i organizatës në CRM (punët e kujt shfaqen) | `acme-recruiting` |
| `PORT` | Porta ku dëgjon faqja | `3100` |
| `HOST` | Vetëm për serverin: `127.0.0.1` pas një reverse proxy, `0.0.0.0` në Docker | `127.0.0.1` |

## Ekzekutimi lokal

Kërkon Node 20 ose më të ri (nuk ka varësi për t'u instaluar).

```bash
CRM_API_URL=https://crm.example.com CAREERS_ORG=acme-recruiting node serve.mjs
# hap http://localhost:3100/jobs
```

Ose me skedarin `.env`: `npm run start:env`.

## Me Docker

```bash
cp .env.example .env      # ndrysho vlerat
docker compose up -d --build
# http://localhost:3100/jobs
```

## Vercel (rekomandohet)

Projekti është gati për Vercel: faqet ekzekutohen si funksion (`api/index.mjs`), skedarët statikë shërbehen nga `public/`,
dhe `vercel.json` drejton `/jobs`, `/job/<id>` dhe `/apply/<id>` te funksioni.

1. Ngarkoje projektin në GitHub (shih më poshtë).
2. Te vercel.com: **Add New → Project → Import** repo-n. Lëri `Framework Preset: Other`, pa Build Command.
3. Te **Settings → Environment Variables** shto:
   - `CRM_API_URL` = `https://crm.example.com`
   - `CAREERS_ORG` = `acme-recruiting`
4. **Deploy**. Hap `https://<projekti>.vercel.app/jobs`.
5. Domeni yt: **Settings → Domains → Add** (p.sh. `jobs.domeni.com`) dhe te ofruesi i DNS krijo regjistrin që të tregon Vercel
   (CNAME te `cname.vercel-dns.com` për nën-domen, ose A record `76.76.21.21` për domenin e plotë).

Në Vercel:
- Faqet ruhen 60 sekonda në cache: një punë e re ose e hequr në CRM shfaqet brenda një minute.
- CV-ja mund të jetë deri në **4 MB** (kufiri i Vercel për një kërkesë është 4.5 MB).
- Faqja `/health` kthen `{"ok":true}` për kontroll.

## Në server të vet (Docker ose systemd)

Alternativë ndaj Vercel, p.sh. në VPS-in ekzistues:

1. Te ofruesi i domenit, krijo një **A record** (p.sh. `jobs.domeni.com`) që tregon IP-në e serverit.
2. Në server, shto domenin në Caddy (shih `deploy/Caddyfile.example`). Caddy merr vetë certifikatën HTTPS.
3. Ekzekuto me Docker (`docker compose up -d --build`), ose me `deploy/careers.service.example` si shërbim systemd.
   Edhe këtu CV-ja është deri në 4 MB, njësoj si në Vercel.

## Pamja dhe tekstet

- Titulli i faqes: `{{ORG}} Engagement Hub` te `templates/list.html`.
- Logo, ngjyrat dhe linku i LinkedIn: `templates/*.html` dhe `public/assets/`.
- Mënyra si shfaqen përshkrimi, paga dhe tipi i punës: `lib/site.mjs`.

## Ngarkimi në GitHub

```bash
git init
git add .
git commit -m "Public careers page of the CRM"
git branch -M main
git remote add origin https://github.com/<llogaria>/<repo>.git
git push -u origin main
```

`.env` nuk ngarkohet (është te `.gitignore`), vetëm `.env.example`.
