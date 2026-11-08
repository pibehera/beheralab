# Atoms to Bits Lab | UCLA

Static website for the Behera Research Group in UCLA Materials Science and Engineering. The site uses plain HTML, CSS, JavaScript, and JSON and is deployed from the repository root with GitHub Pages.

## Pages and files

| File | Purpose |
| --- | --- |
| `index.html` | Home page |
| `research.html` | Research directions in a compact editorial grid |
| `people.html` | Principal investigator, group members, and alumni |
| `publications.html` | Publications grouped by year |
| `news.html` | Lab announcements |
| `join.html` | Recruiting and contact information |
| `assets/style.css` | Shared typography, layout, and responsive styles |
| `assets/site.js` | Renders the People, Publications, and News JSON data |
| `assets/lattice.svg` | Original decorative homepage lattice artwork |
| `assets/logo_UCLA_black.svg` | UCLA wordmark used in the navigation |
| `assets/favicon.svg` | Small lattice mark used in browser tabs |
| `data/people.json` | Editable people and alumni data |
| `data/publications.json` | Editable publication data |
| `data/news.json` | Editable news data |

## Editing the site

### Research text and figures

Edit the four research-direction blocks in `research.html`. To add a figure later, place the image in `assets/` and add an `<img>` inside the relevant `.research-direction` with meaningful alt text.

### Add or remove a person

Open `data/people.json` and find the appropriate group in `groups`.

- To add someone, copy one existing person object, add a comma where required, and update `name`, `role`, and `education`.
- To remove someone, delete that complete person object and the adjacent comma if needed.
- Update the `principal_investigator` object or `alumni` array in the same way.

Keep the file valid JSON: use double quotes, do not add comments, and do not leave a trailing comma after the last item.

### Add a person image

Place the optimized image in `assets/`, then add an `image` field to that person in `data/people.json`:

```json
"image": "assets/name.webp"
```

Images are optional. A person without an image renders cleanly without a fake portrait. The PI headshot should use `assets/piush-behera.webp` once the supplied source image is available.

### Hide or unhide a publication

To hide a publication from the website, set both an editorial status and a short reason in `data/publications.json`:

```json
"hidden": true,
"hidden_reason": "reason"
```

Set `hidden` back to `false` to show the publication again. Hidden records remain in the file and the monthly synchronization preserves both fields.

Publication years render as native browser accordions. The current calendar year opens automatically when it has visible publications; otherwise the newest visible year opens. Earlier years begin collapsed, and visitors may open any number of years.

### Add a news item

Open `data/news.json`, copy an existing entry, and update:

- `date`: machine-readable `YYYY-MM-DD`
- `date_label`: the date visitors should see
- `title`: short headline
- `description`: one short paragraph
- `url`: optional internal or external link; use an empty string for no link

News is sorted newest-first in the browser.

## Publication synchronization

`.github/workflows/update-publications.yml` runs on the first day of each month and can also be started manually. It runs `scripts/sync_publications.py`, which:

1. requests the public Google Scholar profile with a normal browser user agent;
2. reads publication rows, following pagination if needed;
3. matches entries by Scholar citation ID, with a normalized-title hash as a fallback;
4. preserves every locally maintained/editorial field, including `hidden` and `hidden_reason`;
5. defaults newly discovered APS March Meeting abstract records to hidden while leaving ordinary APS journal articles visible;
6. keeps unmatched local records so a partial Scholar response cannot erase data;
7. writes atomically only after a non-empty, plausible result is parsed; and
8. commits with the GitHub Actions bot only when `data/publications.json` changes.

To run it manually on a computer with Python 3:

```sh
python scripts/sync_publications.py
```

To run the workflow on GitHub, open **Actions → Update publications → Run workflow**.

Google Scholar is the upstream publication source, but local editorial choices win during synchronization. Google Scholar does not provide a supported profile API, so its markup or automated-access rules may change. The updater is intentionally conservative: it exits with an error and leaves the last committed data untouched if Scholar is blocked, unavailable, empty, or unexpectedly short. The website always renders from the committed JSON file and does not depend on Scholar at page-load time.

## Local preview and validation

Because the editable JSON files are loaded with `fetch`, preview the site through a local web server rather than opening the HTML files directly:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000/`.

Run the repository validation before publishing:

```sh
python scripts/validate_site.py
```

The validation checks all six pages, navigation, local assets and person images, JSON structure, publication ordering and IDs, required editorial exclusions, visible publication years, hidden-publication filtering, removal of the old animation, and the custom domain.

## GitHub Pages and the custom domain

GitHub Pages currently deploys the `main` branch from `/(root)`. Merging changes into `main` updates the live site automatically through that existing Pages configuration.

`CNAME` must remain unchanged and must continue to contain:

```text
beheralab.com
```

Do not delete or rename `CNAME`, and do not change DNS as part of ordinary website maintenance.
