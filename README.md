# Assay

A watch-only tally of the Bitcoin and Monero you hold across every wallet.
Type in the amounts you know, paste in Bitcoin addresses you want watched, and
see one total. It cannot generate a seed, hold a key, or sign anything.

## Deploy

The files are already relative-pathed, so they work from a repo subpath
(`username.github.io/assay/`) as well as a root domain.

1. Push these files to a repo.
2. Settings → Pages → Deploy from branch → `main` / `root`.
3. Open the HTTPS URL. Android/Chrome offers an install prompt; on iOS use
   Share → Add to Home Screen.

HTTPS is required — service workers won't register over `http://`, so the
install and offline behaviour only appear on the deployed URL, not on a
`file://` copy. For local testing: `python3 -m http.server 8080` then visit
`http://localhost:8080` (localhost is treated as secure).

## Where the data lives

`localStorage`, under the key `assay:v1`, on the device only. It survives
refreshes, reboots and closing the app. It does **not** sync between devices,
and it goes if you clear site data or delete the installed app. Use "Save a
backup" — it writes a JSON file with your amounts and watched addresses.

The app also calls `navigator.storage.persist()` to ask the browser not to
evict that data. Without it, Chrome can clear storage under pressure and iOS
Safari clears it after about 7 days of not opening a site that isn't on the
home screen. Installing to the home screen makes the grant much more likely;
the "Your data" panel shows whether it was given.

### Schema

Stored state is version 2. A v1 record held one `address` per watched holding;
v2 holds an `addresses` array so one wallet can span many. Old records and old
backup files migrate automatically on load.

## What talks to the network

| Call | Goes to | Cached? |
|---|---|---|
| Address balance | `mempool.space/api/address/{addr}` | never |
| Prices | CoinGecko, falling back to mempool.space for BTC | never; last values kept on device |
| App shell, icons, fonts | this origin + Google Fonts | yes, by the service worker |

Balances and prices are deliberately never served from the cache. Offline, the
app shows the last figures it saved and marks them as stale rather than
pretending they're current.

Watched addresses are visible to mempool.space. To avoid that, run your own
mempool instance and change the `MEMPOOL` constant in `index.html`.

## Monero

There is no address lookup. Stealth addresses mean an XMR address exposes
nothing publicly, and reading a balance needs your private view key — which
this app will never ask for. Monero amounts are typed by hand.

## Multi-address wallets

One watched holding can hold any number of addresses; their balances are
summed and shown as a single row. Paste them one per line when adding, or tap
a row to add and remove them later. Lookups run three at a time to stay under
mempool.space's rate limit.

Movement is tracked per address: whichever one moves flags the whole wallet,
and the row tells you how many of them changed.

## Bitcoin xpubs

Deliberately not supported. Deriving addresses client-side needs a bundled
crypto library, and an extended public key sitting in browser storage exposes
every address in that wallet, past and future — a worse thing to leak than a
list of individual addresses. Pasting one is rejected with an explanation.

## Updating

Bump `SHELL_VERSION` in `sw.js` whenever `index.html` changes, or installed
copies will keep serving the old shell.
