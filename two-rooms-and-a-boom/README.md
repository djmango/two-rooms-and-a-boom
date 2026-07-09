# Two Rooms and a Boom

Play online with friends (three-word room codes + live sync) or print a shuffled deck for the table.

## Stack

- **Cloudflare Workers** + **Durable Objects** (hibernatable WebSockets) for each game room  
  R2 would be wrong here — rooms need live coordination, not object storage.
- Static assets for the UI and offline **print deck**
- Easy codes like `coral-lantern-swift` (~1500³ combinations)

## Develop

```bash
npm install
npm run dev
```

Open the local URL Wrangler prints (usually `http://127.0.0.1:8787`).

## Deploy

```bash
npx wrangler login   # once
npm run deploy
```

## Play

1. **Create room** → share the three-word code  
2. Friends **Join with code** on their phones  
3. Host picks a playset → **Deal & start**  
4. Each player taps to reveal their private role and goes to Room A/B  
5. Host runs the round timer; after the last exchange, **Reveal all / end**

Print mode stays at `/print.html` for physical cards.

## Fan project

Not affiliated with Tuesday Knight Games. Playset ideas inspired by
[playkaboom.com](https://www.playkaboom.com/) / Luke-lwz/kaboom (CC BY-NC-SA).
