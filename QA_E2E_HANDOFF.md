# School Portal — E2E Test Handoff (Web + Mobile)

Thanks for helping test! This is a **throwaway QA environment** — you can't break anything real, so poke around freely. Plan for **~30 min web + ~30 min mobile**.

There are two apps to test, **both using the same accounts**:
- **Web** — the full staff + parent portal in a browser.
- **Mobile** — the Expo app (staff + parents) on a phone.

---

## Accounts (same for web and mobile)

Every account uses the password **`Test@12345`**.

| Role | Login | Password |
| --- | --- | --- |
| Super Admin | `super@sgv.seed` | `Test@12345` |
| Office Admin | `office@sgv.seed` | `Test@12345` |
| Accountant | `accountant@sgv.seed` | `Test@12345` |
| Teacher | `teacher@sgv.seed` | `Test@12345` |
| Parent | `parent@sgv.seed` | `Test@12345` |

> **Signing in:** always choose the **Staff** option/tab — even for the Parent account. It's a QA shortcut; the app loads the correct experience automatically from the account (no phone OTP needed).
>
> The seeded parent is linked to **Aarav Shah (Grade 1 A)**. Test the **Teacher** and **Parent** accounts together — data created as the teacher (homework, marks, messages) should appear for the parent.

---

# Part A — 🌐 Web

**App URL:** `__________________________`  ← (fill in before sending)
Opening it lands on the login screen. Any modern browser is fine.

### 🔑 Super Admin — `super@sgv.seed`
- [ ] Log in → dashboard loads
- [ ] **People** → students and parents load
- [ ] **Academic** setup (classes / sections / subjects) loads
- [ ] **Settings** → change a setting → it saves
- [ ] **Analytics** → charts/tiles render with data
- [ ] **Documents** → list loads
- [ ] Log out cleanly

### 🏢 Office Admin — `office@sgv.seed`
- [ ] Add a **new student** → saves and appears in the list
- [ ] Add / link a **parent** → saves
- [ ] Mark **attendance** for Grade 1 A → saves and reloads correctly
- [ ] Generate a **document** from a template → opens/downloads

### 💰 Accountant — `accountant@sgv.seed`
- [ ] **Fees** → structures and balances load
- [ ] Record a **payment** for a student → saves
- [ ] Open the **receipt** for that payment → renders correctly

### 👩‍🏫 Teacher — `teacher@sgv.seed`
- [ ] Mark **attendance** → saves
- [ ] Assign **homework** to Grade 1 A → appears in the list
- [ ] Enter **exam marks** for a student → saves
- [ ] Send a **message** to Aarav Shah's parent → sends

### 👨‍👩‍👦 Parent — `parent@sgv.seed`
- [ ] Log in → **Home** shows fees + attendance tiles
- [ ] **Attendance** → reflects what the teacher marked
- [ ] **Fees** → balance and any payment show correctly
- [ ] **Homework** → the homework the teacher assigned appears
- [ ] **Messages** → reply to the teacher → sends
- [ ] Confirm the parent only sees **their own child's** data

---

# Part B — 📱 Mobile (Expo)

**How to open the app on your phone:**  `__________________________`
*(sender: fill in — e.g. "Install **Expo Go** from the App Store / Play Store, then scan this QR:" and paste the QR / link, **or** a TestFlight / dev-build install link.)*

Once it opens you'll see the portal screen → pick **Staff** and use the same accounts above.

> Test on a **phone** (not just the simulator) if you can — that's the real target.
> If a screen won't load, first check you have signal/Wi‑Fi, then note it as a bug.

### 👩‍🏫 Teacher — `teacher@sgv.seed`
- [ ] Sign in via **Staff** → land on the home tab, role tab bar shows teacher tabs
- [ ] **Attendance** tab → mark attendance for a section → saves
- [ ] **Homework** → create a homework item → appears in the list
- [ ] **Exam** → enter marks for a student → saves
- [ ] **Messages** → open/send a message to Aarav Shah's parent
- [ ] Pull-to-refresh on a list → refreshes
- [ ] Background the app and reopen → still signed in

### 👨‍👩‍👦 Parent — `parent@sgv.seed`
- [ ] Sign in via **Staff** → parent home shows fees + attendance tiles
- [ ] **Attendance** → ring/calendar reflects the teacher's marking
- [ ] **Fees** → balance + payment show; open an invoice/receipt
- [ ] **Homework** → the teacher's homework appears
- [ ] **Messages** → reply to the teacher → sends
- [ ] **Child switcher** (if shown) → only Aarav Shah is listed
- [ ] Notifications / alerts tab loads without error

### 🔑 Admin (optional, if time) — `super@sgv.seed` or `office@sgv.seed`
- [ ] Sign in via **Staff** → admin tabs appear
- [ ] Open **People**, **Academic**, **Settings** → each loads
- [ ] Add a student or mark attendance → saves

### Cross-app check (nice to have)
- [ ] Do something as the **teacher on web** (assign homework) → confirm it shows for the **parent on mobile**, and vice-versa

---

## 🐞 Bug log

For each issue, fill one row. **Please note Web or Mobile** (and phone model / OS if mobile).

| # | Web / Mobile | Role | Page / action | Expected | What happened | Screenshot? |
| --- | --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |

**General notes / anything confusing (even if not a bug):**

-
-
-
