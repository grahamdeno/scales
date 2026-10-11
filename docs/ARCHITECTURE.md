# Scales architecture

Scales is a single page app with no build step and no backend. Everything the app does happens on the phone. The only outside services are GitHub Pages (hosting), Google Fonts, and, if a key is saved, the Anthropic API.

## Where everything sits

```mermaid
flowchart TB
    subgraph host["GitHub Pages (grahamdeno.github.io/scales)"]
        direction LR
        html["index.html<br/>markup, styles, script"]
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
            ledger["Ledger view<br/>totals, rings, list, 12 week grid"]
            sheets["Sheets<br/>Capture, Shed, Settings"]
        end

        subgraph logic["Script inside index.html"]
            direction LR
            engine["Deck engine<br/>weight, pickNext, act"]
            line["Encouraging line<br/>fallbackLine, buildPrompt,<br/>requestLine, valid"]
            store["Storage<br/>save, remove, logActivity"]
            io["Back up / Restore<br/>CSV import / export"]
        end

        subgraph device["On-device storage"]
            direction LR
            ls[("localStorage<br/>thoughts, activity,<br/>prefs, API key")]
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
    line -- "only if a key is saved:<br/>thought text, skip count, days" --> api
    api -- "one short line" --> line
```

## A thought from capture to shed

```mermaid
stateDiagram-v2
    [*] --> Active: Capture sheet<br/>all counts start at 0
    Active --> Active: Skip<br/>skip count +1, weight up
    Active --> Active: Reflect, keep it<br/>reflect +1, skip count -1 after 8s on card
    Active --> Nudge: 3 reflects in a row
    Nudge --> Active: Not yet<br/>streak reset
    Active --> ShedSheet: Swipe right / Shed
    Nudge --> ShedSheet: Shed
    ShedSheet --> Active: Not yet
    ShedSheet --> Shed: Confirm with evidence line
    Shed --> [*]: Delete in Ledger
    Active --> [*]: Delete in Ledger
```

## One card on screen

```mermaid
sequenceDiagram
    actor U as User
    participant D as Deck engine
    participant L as Encouraging line
    participant S as localStorage
    participant A as Anthropic API

    D->>D: pickNext() weighted by skips, skips recent cards
    D->>L: requestLine(thought)
    L-->>U: built-in line shown at once
    alt API key saved
        L->>A: prompt with thought text, skip count, days in deck
        A-->>L: short line
        L->>L: clean() and valid() (15 words max, no echo)
        L-->>U: replace built-in line if same card still showing
        L->>S: remember line to avoid repeats
    end
    U->>D: swipe left, up, or right
    D->>S: save counts, log today's activity
    D->>D: flyOut() then pickNext()
```

## Storage keys

| Key | Holds |
|---|---|
| `scales.thoughts.v1` | Every thought by id: text, origin, dates, status, skip and reflect counts, recent lines, evidence |
| `scales.activity.v1` | Per day counts of inspections and sheds, last 120 days |
| `scales.prefs.v1` | Theme choice |
| `scales.apikey.v1` | Anthropic API key, only if saved |

## Key numbers

| Setting | Value | Why |
|---|---|---|
| Weight | 1 + 0.5 per skip | Avoided thoughts come back more often |
| Weight cap | 4x | One thought cannot take over the deck |
| Dwell check | 8 seconds | A quick swipe up does not erase a skip |
| Nudge | 3 reflects in a row | Prompts the shed question |
| Line length | 15 words | Short enough to read at a glance |
| Swipe threshold | 90 px | Short drags spring back |
