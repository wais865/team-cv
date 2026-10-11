# Team CV

A simple full-stack app built with **TypeScript**, **Node.js (Express)** and **YAML**.
At this project I showed how to use Yaml file as an Offline database just for learning porpuse.
It shows the CVs of your team members and lets you add, view, edit and delete them.
No database is needed: all data lives in a readable YAML file.

## Features

- **CRUD**: create, read, update and delete team members
- **Profile data**: name, job title, department, date of birth (age is calculated automatically),
  nationality, email, phone, address, bio, skills, languages, hobbies, work experience and a photo
- **Photo upload**: JPG, PNG, WEBP or GIF, with preview; old photos are cleaned up automatically
- **Search**: by name, job, department, city, country, skill, language or hobby
- **YAML everywhere**: data in `data/team.yaml`, settings in `config.yaml`,
  export the whole team or download a single CV as YAML
- **Validation** on both the browser and the server

## Getting started

Requires **Node.js 20 or newer**.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**.

For a production build:

```bash
npm run build
npm start
```

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Builds the UI and runs the server with auto-reload (tsx)  |
| `npm run build`     | Compiles server (`dist/`) and browser code (`public/js/`) |
| `npm start`         | Runs the compiled server                                  |
| `npm run typecheck` | Type-checks everything without writing files              |

> If you change `src/client/app.ts` while `npm run dev` is running, run `npm run build:client` and refresh the page.

## Project structure

```
team-CV/
├── config.yaml              # App settings (title, port, file locations, photo size limit)
├── data/team.yaml           # The "database": all team members
├── uploads/                 # Uploaded photos
├── public/                  # Static UI: index.html, styles.css (+ compiled js/)
└── src/
    ├── shared/types.ts      # TypeScript types used by server AND browser
    ├── server/
    │   ├── server.ts        # Express app + REST API routes
    │   ├── store.ts         # Reads/writes team.yaml (safe, queued writes)
    │   ├── validation.ts    # Input validation + age calculation
    │   └── config.ts        # Loads config.yaml
    └── client/app.ts        # Browser UI logic (compiled to public/js)
```

## REST API

| Method | URL                          | Description                               |
| ------ | ---------------------------- | ----------------------------------------- |
| GET    | `/api/members?q=search`      | List members (optional search)            |
| GET    | `/api/members/:id`           | Get one member                            |
| POST   | `/api/members`               | Create (multipart: `data` JSON + `photo`) |
| PUT    | `/api/members/:id`           | Update (multipart: `data` JSON + `photo`) |
| DELETE | `/api/members/:id`           | Delete member and their photo             |
| GET    | `/api/members/:id/yaml`      | Download one CV as YAML                   |
| GET    | `/api/export`                | Download the whole team as YAML           |
| GET    | `/api/info`                  | App title and subtitle from config.yaml   |

Example: create a member from the command line

```bash
curl -F 'data={"name":"Max Mustermann","jobTitle":"QA Engineer","dateOfBirth":"1990-05-05","skills":["Testing","Cypress"]}' \
     -F photo=@photo.jpg \
     http://localhost:3000/api/members
```

## The YAML data format

```yaml
members:
  - id: 7d1c2a8e-4b1f-4c55-9a51-2f0e6b3c9a01
    name: Lena Hoffmann
    jobTitle: Senior Frontend Developer
    department: Engineering
    dateOfBirth: 1991-04-17
    address:
      street: Torstraße 112
      postalCode: "10119"
      city: Berlin
      country: Germany
    skills: [TypeScript, React]
    hobbies:
      - Bouldering
      - Cooking
    experiences:
      - company: Nordlicht Digital
        position: Senior Frontend Developer
        startDate: 2022-03      # YYYY-MM, no endDate = current job
```

You can edit `data/team.yaml` by hand while the server is running; changes show up on the next page refresh.
Tip: quote postal codes (`"01067"`) so YAML keeps the leading zero.
