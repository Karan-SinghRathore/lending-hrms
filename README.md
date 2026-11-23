# HR prototype — attendance, leave, targets, incentives

Demo build for a lending company: branch staff, loan and collection targets, slab-based incentives.
Next.js (frontend + API in one app) · Prisma · MongoDB · Mantine. No AI.

## Run

The app needs a MongoDB database that is a replica set (MongoDB Atlas always is). Put its link in `.env`:

```
DATABASE_URL="mongodb+srv://<user>:<password>@<cluster>/hrms"
```

```bash
npm install
npm run db:setup   # creates collections and indexes, loads demo data
npm run dev        # http://localhost:3000
```

Without Atlas, a local database works too (needs `mongod` installed). In a second terminal:

```bash
npm run db:local   # local MongoDB on port 27099, data in .mongo-dev/
```

with `DATABASE_URL="mongodb://127.0.0.1:27099/hrms?replicaSet=rs0&directConnection=true"`. The first time only, initialise it: `mongosh --port 27099 --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27099"}]})'`.

Demo data is built around today's date. On the morning of a demo, refresh it:

```bash
npm run seed
```

## Users and roles

There is no login. The menu at the top right switches between one person per role. What each person sees comes from their role, set under **Users & roles** (HR Admin only):

| Role | Demo person | Data | Modules |
|---|---|---|---|
| HR Admin | Neha Agarwal | Whole company | Everything (fixed) |
| HR Executive | Saurabh Mathur | Whole company | All except payroll, incentives, users |
| Branch Manager | Rohit Verma (Jaipur) | Own branch | All except users |
| Accounts | Manisha Joshi | Whole company | Payroll, incentives |
| Employee | Ankit Jain (Jaipur) | Own records | All except recruitment, users |

A role = a data scope (company / branch / self) + a list of modules. The sidebar, every page and every API route check the module list (`getViewer("module")` in `services/viewer.ts`). New roles can be created and people moved between roles on the same screen.

## Where things are

| Path | What |
|---|---|
| `app/(app)/<module>/page.tsx` | Screens (server components that load data) |
| `app/api/` | Backend routes; each one only calls a service |
| `services/` | All business rules: score, incentive slabs, leave balance, attendance, who can see what |
| `components/views/` | Screen UI |
| `components/ui/` | Shared table, stat tile, badges |
| `lib/config.ts` | Product name, company name, leave types, late time, score cap |
| `prisma/schema.prisma`, `prisma/seed.ts` | Collections and demo data |

## What each role can do

| Action | HR | Manager | Employee |
|---|---|---|---|
| Add / edit employee | Yes | No | No |
| Set, change, remove targets (this month, next month, last two) | Yes | No | No |
| Update achieved numbers | Yes | Own branch | No |
| Edit incentive slabs | Yes | View | View |
| Apply for leave, check in / out | Yes | Yes | Yes |
| Approve / reject leave | Any | Direct reports | No |
| Add / remove holidays | Yes | No | No |
| Run payroll, release payment | Yes | Own payslips only | Own payslips only |
| Start joining / exit checklist, tick steps | Start + tick | Tick, own branch | Tick own steps |
| Start / close appraisal cycle, finalise rating + increment | Yes | Reviews direct reports | Self review |
| Open a position, make offer, mark hired, add as employee | Yes | Add candidates, screening + interview for own branch | No access |
| Upload KYC documents | Anyone | Own branch | Own |
| Verify documents, issue letters from templates | Yes | View | View own |
| Create training and assign | Yes | Mark attendance for branch | Mark own complete |

## Rules built in

- Score = disbursal or collection (70%) + files or cases (30%), each capped at 150%.
- For the current month, "projected" is the score at today's pace by month end; the incentive shown is an estimate.
- Leave days skip Sundays and holidays; a request can't overlap another or exceed the balance.
- Check-in after 9:45 am is marked late; the browser location is saved with it.
- A manager sees and edits only their own branch; only HR changes targets and slabs.
- Payroll runs on closed months: fixed pay from CTC, loss of pay from the attendance register, incentive from the payout sheet. Statutory rates in `lib/config.ts` (PAYROLL) are assumptions to confirm with the client's accountant.
- Appraisal steps: self review, manager review, HR finalises. The average target score for the period is filled in automatically.
- After changing `prisma/schema.prisma`: `npx prisma db push`, then restart `npm run dev`.
- Record ids are MongoDB ObjectIds (text). API routes check them with `oid()` from `services/viewer.ts`.
