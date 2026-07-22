# CASTEL PROTECT — Discord Bot

Bot Discord avec commande `/dmall` pour envoyer un embed en DM à tous les membres.

## Variables d'environnement (Railway)

| Variable | Description |
|---|---|
| `DISCORD_BOT_TOKEN` | Token du bot (Developer Portal → Bot → Reset Token) |
| `DISCORD_GUILD_ID` | ID du serveur (clic droit sur le serveur → Copier l'ID) |

> L'Application ID est récupéré automatiquement — pas besoin de variable supplémentaire.

## Commandes slash

| Commande | Description | Permission |
|---|---|---|
| `/dmall` | Envoie l'embed en DM à tous les membres | Administrateur |

## Intent requis (Developer Portal → Bot → Privileged Gateway Intents)

- ✅ **Server Members Intent**

## Modifier l'embed

Édite les constantes en haut de `src/index.ts` :

```ts
const EMBED_TITLE       = "VSEY #NEW";
const EMBED_DESCRIPTION = "...";
const EMBED_COLOR       = 0x5865f2;
const BUTTON_LABEL      = "JOIN";
const BUTTON_URL        = "https://discord.gg/...";
```
