# Fix Cleaner Application Admin Emails

## Goal
Send the admin the same immediate email alert for a new cleaner application that already works for bookings and quote requests.

## Confirmed cause
- Cleaner applications are saving successfully.
- The database trigger creates the admin bell notification only; it does not send email.
- The cleaner application page sends an acknowledgement to the applicant, but it does not request an admin email.
- Booking and quote forms each make a separate `admin_new_submission` email request after saving, which is the missing step in the cleaner application flow.

## Changes
1. After a cleaner application saves, send two independent emails:
   - Applicant acknowledgement, as currently implemented.
   - Admin alert to the shared BlueRiver inbox using the existing transactional email service.
2. Include the applicant's name, email, phone, cleaning service type, and a direct link to **Admin → Cleaner Applications**.
3. Keep email delivery non-blocking so an email-provider delay cannot make a successfully saved application appear to have failed.
4. Log applicant-email and admin-email failures separately for easier diagnosis without exposing technical messages to the applicant.

## Verification
- Submit a cleaner application using a test email.
- Confirm the application appears under **Admin → Cleaner Applications**.
- Confirm the admin bell alert appears.
- Confirm the applicant receives the acknowledgement email.
- Confirm the shared admin inbox receives a “New Cleaner Application” alert with a working admin link.
- Check the email service logs for a successful cleaner-application admin alert and confirm existing booking and quote alerts remain unchanged.

## Technical details
- Reuse the existing `send-transactional-email` function and its `admin_new_submission` template.
- Update only the cleaner application submission flow; no database or authentication changes are required.
