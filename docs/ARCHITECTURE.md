# Scales architecture

Scales is a single page app with no build step and no backend. Everything the app does happens on the phone. The only outside services are GitHub Pages (hosting), Google Fonts, and, if a key is saved, the Anthropic API.

The user-facing names (principle, Not today, Still working on it, Living it) differ from some internal names, which were kept so stored data and exports stay compatible:

| On screen | In code and storage |
|---|---|
| Principle | thought (`thoughts`, `scales.thoughts.v1`) |
| Not today | skip (`skip_count`, `lifetime_skips`) |
| Still working on it | keep / reflect (`reflect_count`) |
| Living it | shed (`status: "shed"`, `shed_at`, `evidence`) |

## Where everything sits

```mermaid
flowchart TB
    subgraph host["GitHub Pages (grahamdeno.github.io/scales)"]
        direction LR
        html["index.html<br/>markup, styles, app script"]
        corefile["core.js<br/>pure logic, tested"]
        swfile["sw.js<br/>service worker"]
        mani["manifest.webmanifest<br/>name, colors, icons"]
        icons["icons/"]
    end

    subgraph phone["iPhone: Safari / home screen app"]
        direction TB

        subgraph ui["Screens"]
            direction LR
            header["Header<br/>date, Ledger, Settings"]
            deck["Deck view<br/>card, buttons, Pushing back strip"]
            ledger["Ledger view<br/>totals, rings, In deck / Living it, 12 week grid"]
            sheets["Sheets<br/>Capture, Living it, Evidence, Settings"]
        end

        subgraph logic["App script (index.html) and core.js"]
            direction LR
            engine["Deck engine<br/>pickFrom, weight, act"]
            line["Consideration line<br/>fetchLine, prefetchNext,<br/>clean, fit, vet"]
            store["Storage<br/>save, remove, logActivity"]
            io["Back up / Restore<br/>CSV import / export<br/>starter decks"]
        end

        subgraph device["On-device storage"]
            direction LR
            ls[("localStorage<br/>principles, activity,<br/>prefs, API key")]
            cache[("Cache Storage<br/>app shell, fonts")]
        end

        sw["Service worker"]
    end

    fonts["Google Fonts"]
    api["Anthropic API<br/>Messages endpoint"]
    files["Files / iCloud Drive<br/>JSON backup, CSV"]

    host -- "first visit and updates" --> sw
    sw <--> cache
    sw -.->|network first| fonts

    deck --> engine
    sheets --> engine
    sheets --> io
    engine --> store
    engine --> line
    ledger --> store
    store <--> ls
    io <--> ls
    io <--> files
    line -- "only if a key is saved:<br/>principle text, not today count, days" --> api
    api -- "one short line" --> line
```

## A principle from capture to Living it

```mermaid
stateDiagram-v2
    [*] --> Active: Capture sheet or starter deck<br/>all counts start at 0
    Active --> Active: Not today<br/>count +1, weight up
    Active --> Active: Still working on it<br/>inspections +1, count -1 after 8s on card
    Active --> Nudge: 3 in a row
    Nudge --> Active: Not yet<br/>streak reset
    Active --> LivingSheet: Swipe right / Living it
    Nudge --> LivingSheet: Living it
    LivingSheet --> Active: Not yet
    LivingSheet --> Lived: I live this now<br/>optional evidence line
    Active --> Active: Edit wording<br/>history kept, AI line rewritten
    Lived --> Lived: Add or edit evidence in Ledger
    Lived --> Lived: Edit wording<br/>record kept
    Lived --> [*]: Delete in Ledger
    Active --> [*]: Delete in Ledger
```

## One card on screen

```mermaid
sequenceDiagram
    actor U as User
    participant D as Deck engine
    participant L as Consideration line
    participant S as localStorage
    participant A as Anthropic API

    D->>D: show queued principle, or pickFrom() weighted with cooldown
    D->>L: requestLine(principle)
    alt no API key
        L-->>U: built-in line at once
    else line already prefetched for this exact text
        L-->>U: model line at once
    else not ready yet
        L-->>U: "Considering..." placeholder
        L->>A: prompt with principle text, not today count, days in deck
        A-->>L: short line
        L->>L: clean(), fit() to 25 words, vet() (no exclamation, no echo of long text), up to 3 tries
        L-->>U: model line, or a built-in line if none was usable
    end
    L->>S: remember shown line to avoid repeats
    L->>A: prefetch the line for the next queued principle
    U->>D: swipe left, up, or right
    D->>S: save counts, log today's activity
    D->>D: flyOut() then show the queued principle
```

## Storage keys

| Key | Holds |
|---|---|
| `scales.thoughts.v1` | Every principle by id: text, origin, collection, dates, status, counts, recent lines, evidence |
| `scales.activity.v1` | Per day counts of inspections and Living it, last 120 days |
| `scales.prefs.v1` | Theme choice |
| `scales.apikey.v1` | Anthropic API key, only if saved |

## Key numbers

| Setting | Value | Why |
|---|---|---|
| Weight | 1 + 0.5 per Not today | Avoided principles come back more often |
| Weight cap | 4x | One principle cannot take over the deck |
| Cooldown | last 3 shown (last 1 in a deck of 3 or fewer) | No back to back repeats |
| Dwell check | 8 seconds | A quick swipe up does not erase a Not today |
| Nudge | 3 Still working on it in a row | Prompts the Living it question |
| Line length | 25 words | Room for one complete consideration, still readable at a glance |
| Model output budget | 1024 tokens | The model may reason before answering, and reasoning counts against the budget |
| Swipe threshold | 90 px | Short drags spring back |
| Principle length | 1,500 characters | Capture and Edit share the limit; long enough for a short poem |

## Versioning and updates

`core.js` holds `VERSION` as `MAJOR.MINOR.PATCH` (major for breaking changes, minor for features and enhancements, patch for defect fixes only), shown in Settings under About. The service worker cache is named `scales-v` plus the same version, and tests fail if the two differ or the version is not three numbers. Change both on every release so installed phones drop the old cache, and so the number in Settings confirms which build is running. Each release is tagged in git as `v` plus the version. The service worker fetches same-origin files with `cache: "no-cache"`, so a new release is picked up on the next launch rather than after GitHub Pages' ten minute cache lifetime.

## Tests

`node --test` runs `tests/core.test.js` with no dependencies. It covers weighting, the selection cooldown, answer cleanup and checks (including the short-principle case that once discarded every model line), and the version and offline-cache wiring. GitHub Actions runs the same command on every push to `main`.
