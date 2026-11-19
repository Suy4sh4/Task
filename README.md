# Tasks

A minimal, dark task list. Type a task, press Enter, click the circle when it's
done and it disappears.

- Zero build step — plain HTML, CSS and JavaScript.
- Works fully offline with `localStorage`.
- Optional cross-device sync through a free Supabase database.

## Run locally

Open `index.html`, or:

```bash
python -m http.server 8000   # visit http://localhost:8000
```

## Host on GitHub Pages

1. Create a public repo (e.g. `my-tasks`) and upload every file in this folder,
   including `.nojekyll`.
2. **Settings → Pages → Deploy from a branch → main / (root) → Save.**
3. Visit `https://<username>.github.io/my-tasks/` after a minute or two.

Paths are relative, so the project-site URL works as-is. GitHub caches assets
for ~10 minutes; if an update looks stale, wait or bump `?v=` in `index.html`.

For a root URL, name the repo `<username>.github.io`.

---

## Optional: sync across devices (Supabase)

Free tier is more than enough for a personal list. Takes ~3 minutes.

### 1. Create the project

1. Sign up at https://supabase.com and create a new project (pick any region,
   set a database password).
2. Wait for it to finish provisioning.

### 2. Create the table

In the left sidebar open **SQL Editor → New query**, paste this, and click
**Run**:

```sql
create table if not exists tasks (
  id text primary key,
  text text not null,
  created_at bigint not null
);

alter table tasks enable row level security;

create policy "personal task access"
  on tasks for all
  using (true)
  with check (true);
```

### 3. Get your credentials

**Settings → API** — copy:

- **Project URL** → e.g. `https://abcdefgh.supabase.co`
- **anon / public key** → the long `eyJ...` string

### 4. Put them in the app

Open `config.js` and fill in:

```js
window.TASKS_CONFIG = {
  supabaseUrl: "https://abcdefgh.supabase.co",
  supabaseAnonKey: "eyJ...",
  pollMs: 4000,
};
```

Save and republish (GitHub Pages may take ~10 min to show the change).

That's it. Add a task on your PC and it appears on your phone within ~4 seconds.

### How sync behaves

- Tasks are written locally first, then pushed — the UI never waits on the network.
- If you're offline, changes queue in `localStorage` and flush when you reconnect.
- Each device checks the server every 4 seconds.
- Leaving `config.js` blank keeps the app 100% local, exactly as before.

### Security note

The anon key is public in the page source, and the policy above allows anyone
with that key to read/write the table. This is fine for a personal app whose URL
isn't shared, but it is **not** authentication. If you ever publish the URL
publicly, add a login (Supabase Auth) or a stricter policy.

## Files

- `index.html` — markup and config includes
- `config.js` — your Supabase credentials (optional)
- `styles.css` — theme, responsive layout, restrained motion
- `app.js` — storage, rendering, sync, focus and announcements
- `favicon.svg`, `.nojekyll`, `README.md`
