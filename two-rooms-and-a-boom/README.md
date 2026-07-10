# Two Rooms and a Boom

Vite + React UI on **Cloudflare Workers**, with live rooms on **Durable Objects**
(hibernatable WebSockets). Print mode stays available for physical cards.

## Why this stack

| Need | Choice |
|------|--------|
| UI | Vite + React |
| Hosting | Cloudflare Workers (SPA assets + API) |
| Realtime rooms | Durable Objects (not R2/D1: those aren’t for live coordination) |
| Join codes | Three easy words (`coral-lantern-swift`) |

## Develop

```bash
npm install
npm run dev
```

## Deploy

```bash
npx wrangler login   # once
npm run deploy
```

`npm run deploy` (build then `wrangler deploy`) is required: a bare
`wrangler deploy` has no built assets to serve. `npm install` also runs the
build via a `postinstall` hook, so Cloudflare Workers Builds' default deploy
command (`npx wrangler deploy`) works out of the box with no dashboard
configuration needed.

## Play

1. **Create room** → share the three-word code  
2. Friends open `/play/<code>` on their phones  
3. Host picks a playset → **Deal & start**  
4. Tap to reveal your private role → go to Room A/B  
5. Host runs the timer; **Reveal all / end** when finished  

Print deck: `/print`

## Fan project

Not affiliated with Tuesday Knight Games. Playset ideas inspired by
[playkaboom.com](https://www.playkaboom.com/) / Luke-lwz/kaboom (CC BY-NC-SA).
