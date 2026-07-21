# Task Progress

## Todo List

### Push Notification Fix (CRITICAL)
- [x] Identify root cause: Device tokens stored in `DeviceToken` collection but `sendToUser()` reads from `User.fcmTokens`
- [ ] Fix `registerDevice` in `userController.js` to also save token to `User.fcmTokens`
- [ ] Verify all push notification types use the same working path

### Monthly Due Payment Flow
- [ ] Fix auto-redirect after successful payment to MonthlyDue page
- [ ] Update PaymentSuccess navigation to go to MyChits → ChitDetails → MonthlyDue

### Monthly Due Status
- [ ] Modify MonthlyDueScreen to show "Paid" for paid installments
- [ ] Show Next Due Date and Remaining Days
- [ ] Disable Pay Now for paid installments
- [ ] Enable Pay Now only when next installment is due
- [ ] Calculate from MongoDB using due date

### Closed Chits
- [ ] Show "Chit Closed" disabled button for closed chits
- [ ] Backend already rejects payments for closed chits (verify)

### Due Reminder Push Notification
- [ ] Add cron job for due reminders
- [ ] Store notification in MongoDB
- [ ] Send push notification

### Member Names Fix
- [ ] Fix ChitDetailsScreen to show real user names
- [ ] Show "You" for logged-in user
- [ ] Show actual names for other members
- [ ] Show profile initial, member number, join date, status

### Final Verification
- [ ] Verify all requirements are met
- [ ] Provide final report