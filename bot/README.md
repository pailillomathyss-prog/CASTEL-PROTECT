# CASTEL PROTECT — Discord Bot

Bot Discord avec commande `+dmall` pour envoyer un embed en DM à tous les membres du serveur.

## Variables d'environnement (Railway)

| Variable | Description |
|---|---|
| `DISCORD_BOT_TOKEN` | Token du bot (Discord Developer Portal) |
| `DISCORD_GUILD_ID` | ID du serveur Discord |

## Commandes

| Commande | Description | Permission |
|---|---|---|
| `+dmall` | Envoie l'embed en DM à tous les membres | Administrateur |

## Prérequis Discord Developer Portal

1. Activer **Server Members Intent** (Bot → Privileged Gateway Intents)
2. Activer **Message Content Intent** (Bot → Privileged Gateway Intents)

## Déploiement Railway

1. Connecte ce repo GitHub à Railway
2. Sélectionne le dossier `bot/` comme **Root Directory**
3. Ajoute les variables d'environnement ci-dessus
4. Deploy !

## Modifier l'embed

Édite les constantes en haut de `src/index.ts` :

```ts
const EMBED_TITLE = 'VSEY #NEW';
const EMBED_DESCRIPTION = '...';
const EMBED_COLOR = 0x5865f2;
const BUTTON_LABEL = 'JOIN';
const BUTTON_URL = 'https://discord.gg/...';
```
