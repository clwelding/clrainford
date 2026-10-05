# Database and email setup

The site's own Supabase project (database, file storage, logins) and Resend (email).

## 1. Database

In the Supabase dashboard, open **SQL Editor**, paste all of `schema.sql`, and run it once.

Then add yourself as the first admin, so you can sign in to the shop board:

```sql
insert into clrwf_staff (name, email, role) values ('C. L. Rainford', 'info@clrainford.com', 'admin');
```

## 2. Logins

**Authentication -> URL Configuration**

- Site URL: `https://clrainford.com`
- Redirect URLs: `https://clrainford.com/**` and `https://www.clrainford.com/**`

## 3. Email (Resend)

1. In Resend, verify the domain `clrainford.com`. The emails send from `hello@clrainford.com`.
2. Deploy both functions. JWT verification must be off, because the database and Supabase Auth call them, not a signed-in user:
   ```
   npx supabase functions deploy notify-submission --no-verify-jwt --project-ref <ref>
   npx supabase functions deploy auth-send-email --no-verify-jwt --project-ref <ref>
   ```
3. Set the function secrets:
   ```
   npx supabase secrets set --project-ref <ref> RESEND_API_KEY=<resend key> WEBHOOK_SECRET=<random secret>
   ```
4. Store the same webhook secret and the function URL in Vault (SQL Editor):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-submission', 'notify_submission_url');
   select vault.create_secret('<same random secret>', 'notify_submission_secret');
   ```
5. **Authentication -> Auth Hooks -> Send Email**: point it at the `auth-send-email` function and generate a secret. Then set that secret on the function:
   ```
   npx supabase secrets set --project-ref <ref> SEND_EMAIL_HOOK_SECRET=<hook secret>
   ```

## 4. Site

Put the project URL and publishable key in `assets/js/supabase-client.js`, and the project URL in the `GALLERY_STORAGE_BASE` line of `index.html`, `gallery.html`, `commercial.html`, `residential.html` and `custom/jerk-pits.html`.
