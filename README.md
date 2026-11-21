# Tasks

A minimal, dark task list. Type a task, press Enter, click the circle when it's
done and it disappears.

- Zero build step — plain HTML, CSS and JavaScript.
- Works fully offline with `localStorage`.
- Optional cross-device sync through a free Supabase database.
- Long-press a task for priority + group; toggle **Group** to group the list.

## Run locally

Open `index.html`, or:

```bash
python -m http.server 8000   # visit http://localhost:8000
```

## Host on GitHub Pages

1. Create a public repo (e.g. `my-tasks`) and upload every file in this folder,
   including `.nojekyll` and `apple-touch-icon.png`.
2. **Settings → Pages → Deploy from a branch → main / (root) → Save.**
3. Visit `https://<username>.github.io/my-tasks/` after a minute or two.

Paths are relative, so the project-site URL works as-is. GitHub caches assets
for ~10 minutes; if an update looks stale, wait or bump `?v=` in `index.html`.

For a root URL, name the repo `<username>.github.io`.

## Using it

- **Add** — type and press Enter, or tap the ↑ button at the right of the input
  (it lights up once you type something).
- **Quick group** — type `#College` anywhere in a task to add it straight to
  that group. The tag is stripped from the task text.
- **Complete** — tap the circle; the row fades and disappears.
- **Options** — tap the **⋯** button at the right of any task (or long-press the
  row on phone / right-click on desktop). In the sheet you can:
  - **Edit the task text**
  - **Set priority** — High / Mid / Low / None (small colored dot on the row)
  - **Set group** — type a name or tap an existing one
  - **Delete** the task
- **Group view** — tap **Group** at the top to group tasks by name. Tap again to
  switch back. The preference is remembered on the device.

Tasks are sorted by priority (High → Low → None), then by creation time.

## iPhone home-screen icon

Open the site in **Safari**, tap **Share → Add to Home Screen**. The icon comes
from `apple-touch-icon.png`. If you already added the old bookmark, delete it
from the home screen first and add it again to pick up the new icon.

---

## Supabase sync (optional)

Free tier is plenty. `config.js` is already filled with your credentials.

### Database columns for priority + group

In **Supabase → SQL Editor → New query**, run this once:

```sql
alter table tasks
  add column if not exists priority text,
  add column if not exists group_name text;
```

The app keeps working offline and in local mode even before you run this.

### Recreating the table from scratch

If you ever need to start over:

```sql
create table if not exists tasks (
  id text primary key,
  text text not null,
  created_at bigint not null,
  priority text,
  group_name text
);

alter table tasks enable row level security;

create policy "personal task access" on tasks for all
  using (true) with check (true);
```

### How sync behaves

- Tasks are written locally first, then pushed — the UI never waits on the network.
- If you're offline, changes queue and flush when you reconnect.
- Each device checks the server every 4 seconds.
- Leaving `config.js` blank keeps the app 100% local.

### Security note

The publishable key is public in the page source, and the policy above allows
anyone with that key to read/write the table. Fine for a personal, unshared URL.
Never put the **secret** key in browser code.

## Files

- `index.html` — markup, icon links, sheet markup
- `styles.css` — theme, responsive layout, groups, sheet, restrained motion
- `app.js` — storage, rendering, long-press, grouping, sync, accessibility
- `config.js` — Supabase credentials
- `apple-touch-icon.png`, `favicon.svg`, `.nojekyll`
- `domain-task.is-a.dev.json` — ready-to-submit is-a.dev domain record
