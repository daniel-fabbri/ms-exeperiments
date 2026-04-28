# MS Experiments

Static experiment-preview environment for a captured copy of microsoft.com.
Routes by `?ref=…` to swap chat / decision-module variants.

## Files
- `index.html` — captured page with experiment shell (header, sidebar, ask-card)
- `script.js` — minimal router; sets `body[data-ref]` and wires close/sidebar
- `style.css` — header, sidebar, ask-card and per-variant visibility rules
- `staticwebapp.config.json` — Azure Static Web Apps configuration

## Variants
| Ref | What changes |
|---|---|
| `98fh349f8349j02d3i` | Control chat — shows the dark "Can we help you?" popover |
| `9487948v094jf09f40` | Discover A — Ask-AI card with 3 chips, no input |
| `543348v094jf34243v` | Discover B — Ask-AI card with PC/Azure chips + input |
| `8737948v25c09f4023` | Discover C — Ask-AI card with input only |
| `43tgbny848v2576yuj` | Surface Explorer control — baseline |
| `89fh4384090230j00r` | Surface Explorer — reveals the personalized recommendations module |

## Local development
Open `index.html` directly in a browser, or serve the folder:

```powershell
npx http-server . -p 8080
```

Then visit `http://localhost:8080/?ref=89fh4384090230j00r`.

## Azure Static Web Apps deployment
1. Push to GitHub.
2. In Azure Portal → Create resource → Static Web App.
3. Connect the GitHub repo and pick this branch.
4. Build preset: **Custom** (no build step).
5. App location: `/`
6. Output location: *(leave empty)*

Azure will create a GitHub Actions workflow and deploy on every push.
